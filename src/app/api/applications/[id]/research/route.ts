import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, companyResearch } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  encryptResearchFields,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  getJinaReaderClient,
  getCompaniesHouseClient,
  getGeminiSearchClient,
} from '@/lib/services';
import type { CompanyPagesResult } from '@/lib/services/jina-reader';
import { buildResearchSynthesisPrompt } from '@/lib/prompts/research-synthesis';
import { callWithTool } from '@/lib/ai/call-with-tool';
import type { ResearchSource } from '@/lib/types';
import { extractCompanyUrl } from '@/lib/utils/extract-company-url';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Claude synthesis result type ────────────────────────────────────────────

interface SynthesisResult {
  companySize?: string | null;
  fundingStage?: string | null;
  revenue?: string | null;
  foundedYear?: string | null;
  headquarters?: string | null;
  industry?: string | null;
  recentNews?: string | null;
  techStack?: string | null;
  cultureSignals?: string | null;
  keyPeople?: string | null;
  missionAndValues?: string | null;
}

// ─── POST /api/applications/[id]/research ─────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  // Research is expensive — 3 req/min per IP
  if (!checkRateLimit(ip, 3)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // force defaults to false when body is absent or invalid
    body = {};
  }
  const b = body as Record<string, unknown>;
  const force = b.force === true;

  // ─── Load and verify ownership ────────────────────────────────────────────

  const [application] = await db.select()
    .from(jobApplications)
    .where(and(
      eq(jobApplications.id, params.id),
      eq(jobApplications.userId, userId)
    ))
    .limit(1);

  if (!application) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Return 409 if already researched and force not set
  if (application.researchedAt && !force) {
    return Response.json(
      { error: 'Research already completed. Pass force: true to re-run.' },
      { status: 409 }
    );
  }

  // Decrypt jobDescription for use in the prompt
  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  // ─── Step 1: Gather data in parallel (within 60s budget) ─────────────────

  const warnings: string[] = [];
  const sources: ResearchSource[] = [];
  const now = new Date().toISOString();

  const [jinaResult, chResult, geminiResult] = await Promise.allSettled([
    // Jina Reader: scrape company homepage + about/careers page
    (async () => {
      const jina = getJinaReaderClient();
      const companyUrl = extractCompanyUrl(application.jobUrl, application.companyName);
      if (!companyUrl) return null;
      const pages = await jina.scrapeCompanyPages(companyUrl);
      sources.push({ url: companyUrl, source_type: 'firecrawl', fetched_at: now });
      return pages;
    })(),

    // Companies House: search + profile + filings
    (async () => {
      const ch = getCompaniesHouseClient();
      const results = await ch.searchCompany(application.companyName);
      if (!results.length) return null;
      const [profile, filings] = await Promise.all([
        ch.getCompanyProfile(results[0].company_number),
        ch.getFilingHistory(results[0].company_number),
      ]);
      sources.push({
        url: `https://find-and-update.company-information.service.gov.uk/company/${results[0].company_number}`,
        source_type: 'companies_house',
        fetched_at: now,
      });
      return { profile, filings, companyNumber: results[0].company_number };
    })(),

    // Gemini: news + culture search
    (async () => {
      const gemini = getGeminiSearchClient();
      const [news, culture] = await Promise.all([
        gemini.searchCompanyNews(application.companyName),
        gemini.searchCompanyCulture(application.companyName),
      ]);
      // Add news sources
      for (const item of news.slice(0, 3)) {
        if (item.url) {
          sources.push({ url: item.url, source_type: 'exa', fetched_at: now });
        }
      }
      return { news, culture };
    })(),
  ]);

  // Check: at least one service must have succeeded
  const jinaOk = jinaResult.status === 'fulfilled' && jinaResult.value !== null;
  const chOk = chResult.status === 'fulfilled' && chResult.value !== null;
  const geminiOk = geminiResult.status === 'fulfilled' && geminiResult.value !== null;

  if (!jinaOk && !chOk && !geminiOk) {
    // Collect the actual errors for logging
    const errors = [jinaResult, chResult, geminiResult]
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason));
    console.error('All research services failed:', errors);
    return Response.json(
      { error: 'All research sources failed. Please try again later.', details: errors },
      { status: 503 }
    );
  }

  // Collect per-service warnings for partial failures
  if (!jinaOk && jinaResult.status === 'rejected') {
    warnings.push(`Web scraping unavailable: ${jinaResult.reason?.message ?? 'unknown error'}`);
  }
  if (!chOk && chResult.status === 'rejected') {
    warnings.push(`Companies House unavailable: ${chResult.reason?.message ?? 'unknown error'}`);
  }
  if (!geminiOk && geminiResult.status === 'rejected') {
    warnings.push(`News search unavailable: ${geminiResult.reason?.message ?? 'unknown error'}`);
  }

  // ─── Step 2: Build Jina pages array for the prompt ───────────────────────

  const scrapedPages: { url: string; markdown: string }[] = [];
  if (jinaOk) {
    const pages = jinaResult.value as CompanyPagesResult;
    const companyUrl = extractCompanyUrl(application.jobUrl, application.companyName);
    if (pages.homepage && companyUrl) {
      scrapedPages.push({ url: companyUrl, markdown: pages.homepage });
    }
    if (pages.aboutPage) {
      scrapedPages.push({ url: `${companyUrl}/about`, markdown: pages.aboutPage });
    }
    if (pages.careersPage) {
      scrapedPages.push({ url: `${companyUrl}/careers`, markdown: pages.careersPage });
    }
  }

  // ─── Step 3: Synthesise with Claude ───────────────────────────────────────

  let synthesis: SynthesisResult;
  try {
    const { system, user, toolSchema } = buildResearchSynthesisPrompt({
      companyName: application.companyName,
      jobDescription: plainJobDescription,
      scrapedPages: scrapedPages.length > 0 ? scrapedPages : undefined,
      companiesHouseData: chOk
        ? {
            profile: (chResult.value as { profile: object | null }).profile ?? undefined,
            filings: (chResult.value as { filings: object[] }).filings ?? [],
          }
        : undefined,
      searchResults: geminiOk
        ? {
            news: (geminiResult.value as { news: { title: string; url: string; text: string; publishedDate?: string }[] }).news,
            culture: (geminiResult.value as { culture: { title: string; url: string; text: string }[] }).culture,
          }
        : undefined,
    });

    synthesis = await callWithTool<SynthesisResult>(system, user, toolSchema);
  } catch (err) {
    console.error('Research synthesis (Claude) failed:', err);
    return Response.json({ error: 'Research synthesis failed' }, { status: 500 });
  }

  // ─── Step 4: Encrypt sensitive fields + write to DB ──────────────────────

  const encryptedResearch = isEncryptionEnabled()
    ? encryptResearchFields({
        recentNews: synthesis.recentNews ?? null,
        cultureSignals: synthesis.cultureSignals ?? null,
        keyPeople: synthesis.keyPeople ?? null,
      })
    : {
        recentNews: synthesis.recentNews ?? null,
        cultureSignals: synthesis.cultureSignals ?? null,
        keyPeople: synthesis.keyPeople ?? null,
      };

  const companiesHouseNumber = chOk
    ? (chResult.value as { companyNumber: string }).companyNumber
    : null;
  const companiesHouseData = chOk
    ? {
        profile: (chResult.value as { profile: object | null }).profile,
        filings: (chResult.value as { filings: object[] }).filings,
      }
    : null;

  try {
    // Delete existing research row if re-running (force: true)
    if (application.researchedAt) {
      await db.delete(companyResearch)
        .where(and(
          eq(companyResearch.jobApplicationId, params.id),
          eq(companyResearch.userId, userId)
        ));
    }

    const dbNow = new Date().toISOString();

    const [insertedResearch] = await db.insert(companyResearch)
      .values({
        jobApplicationId: params.id,
        userId,
        companySize: synthesis.companySize ?? null,
        fundingStage: synthesis.fundingStage ?? null,
        revenue: synthesis.revenue ?? null,
        foundedYear: synthesis.foundedYear ?? null,
        headquarters: synthesis.headquarters ?? null,
        industry: synthesis.industry ?? null,
        recentNews: encryptedResearch.recentNews,
        techStack: synthesis.techStack ?? null,
        cultureSignals: encryptedResearch.cultureSignals,
        keyPeople: encryptedResearch.keyPeople,
        missionAndValues: synthesis.missionAndValues ?? null,
        sources: JSON.stringify(sources),
        companiesHouseNumber,
        companiesHouseData: companiesHouseData ? JSON.stringify(companiesHouseData) : null,
        updatedAt: dbNow,
      })
      .returning();

    // Mark application as researched
    await db.update(jobApplications)
      .set({ researchedAt: dbNow, updatedAt: dbNow })
      .where(and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      ));

    // Return plaintext (decrypt for response)
    const responseResearch = {
      ...insertedResearch,
      recentNews: synthesis.recentNews ?? null,
      cultureSignals: synthesis.cultureSignals ?? null,
      keyPeople: synthesis.keyPeople ?? null,
      sources,
    };

    const sourcesUsed = [jinaOk, chOk, geminiOk].filter(Boolean).length;

    return Response.json({
      research: responseResearch,
      sources_used: sourcesUsed,
      warnings,
    });
  } catch (err) {
    console.error('POST /api/applications/[id]/research DB error:', err);
    return Response.json({ error: 'Failed to save research' }, { status: 500 });
  }
}
