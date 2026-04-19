import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import {
  batchRuns,
  jobApplications,
  companyResearch,
  fitAssessments,
  generatedMaterials,
  examples,
  exampleTags,
  tags,
  consistencyEntries,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  encryptResearchFields,
  decryptExampleFields,
  encryptMaterialContent,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  getJinaReaderClient,
  getCompaniesHouseClient,
  getGeminiSearchClient,
} from '@/lib/services';
import type { CompanyPagesResult } from '@/lib/services/jina-reader';
import { buildResearchSynthesisPrompt } from '@/lib/prompts/research-synthesis';
import {
  buildArchetypeDetectionPrompt,
  buildFitScoringPrompt,
  type ExampleForFitScoring,
  type ConsistencyEntryForScoring,
} from '@/lib/prompts/fit-assessment';
import { buildCvPrompt, type CvExample } from '@/lib/prompts/materials-cv';
import {
  buildCoverLetterPrompt,
  type CoverLetterExample,
  type CoverLetterCompanyResearch,
} from '@/lib/prompts/materials-cover';
import {
  buildTrackingNotePrompt,
  type DimensionScore as TrackingDimensionScore,
  type MatchedExample,
} from '@/lib/prompts/materials-tracking';
import { callWithTool } from '@/lib/ai/call-with-tool';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { queryUserVectors } from '@/lib/vector/upstash';
import { extractCompanyUrl } from '@/lib/utils/extract-company-url';
import { createHash } from 'crypto';
import type {
  ResearchSource,
  FitWeights,
  DimensionScore,
  RoleArchetype,
  MaterialType,
} from '@/lib/types';
import { DEFAULT_FIT_WEIGHTS } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Timing budget ────────────────────────────────────────────────────────────

const TIMING_BUDGET_MS = 45000;

// ─── Local types ─────────────────────────────────────────────────────────────

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

interface ArchetypeResult {
  archetype: RoleArchetype;
  rationale: string;
}

interface DimensionScoreRaw {
  score: number;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
}

interface FitScoringResult {
  dimDomainIndustry: DimensionScoreRaw;
  dimSeniority: DimensionScoreRaw;
  dimScope: DimensionScoreRaw;
  dimTechnical: DimensionScoreRaw;
  dimMission: DimensionScoreRaw;
  dimLocation: DimensionScoreRaw;
  dimCompensation: DimensionScoreRaw;
  dimCulture: DimensionScoreRaw;
  redFlags: string[];
  greenFlags: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateOverallScore(
  scoring: FitScoringResult,
  weights: FitWeights
): number {
  const totalWeight =
    weights.domain + weights.seniority + weights.scope + weights.technical +
    weights.mission + weights.location + weights.compensation + weights.culture;

  const weightedSum =
    scoring.dimDomainIndustry.score * weights.domain +
    scoring.dimSeniority.score * weights.seniority +
    scoring.dimScope.score * weights.scope +
    scoring.dimTechnical.score * weights.technical +
    scoring.dimMission.score * weights.mission +
    scoring.dimLocation.score * weights.location +
    scoring.dimCompensation.score * weights.compensation +
    scoring.dimCulture.score * weights.culture;

  return Math.round((weightedSum / totalWeight) * 10);
}

function computePromptHash(
  jobDescription: string,
  exampleIds: string[],
  masterCv?: string
): string {
  const sorted = [...exampleIds].sort();
  const masterCvHash = masterCv
    ? createHash('sha256').update(masterCv, 'utf8').digest('hex').slice(0, 16)
    : '';
  return createHash('sha256')
    .update([jobDescription, ...sorted, masterCvHash].join('|'), 'utf8')
    .digest('hex');
}

function adaptToolSchema(raw: object): {
  name: string;
  description: string;
  parameters: object;
} {
  const schema = raw as {
    name: string;
    input_schema?: object;
    parameters?: object;
    description?: string;
  };
  return {
    name: schema.name,
    description: schema.description ?? `Call ${schema.name}`,
    parameters: schema.parameters ?? schema.input_schema ?? {},
  };
}

// ─── Research pipeline ───────────────────────────────────────────────────────

async function runResearch(
  applicationId: string,
  userId: string,
  application: {
    companyName: string;
    jobUrl: string | null;
    jobDescription: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  const now = new Date().toISOString();
  const warnings: string[] = [];
  const sources: ResearchSource[] = [];

  const [jinaResult, chResult, geminiResult] = await Promise.allSettled([
    (async () => {
      const jina = getJinaReaderClient();
      const companyUrl = extractCompanyUrl(application.jobUrl, application.companyName);
      if (!companyUrl) return null;
      const pages = await jina.scrapeCompanyPages(companyUrl);
      sources.push({ url: companyUrl, source_type: 'firecrawl', fetched_at: now });
      return pages;
    })(),

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

    (async () => {
      const gemini = getGeminiSearchClient();
      const [news, culture] = await Promise.all([
        gemini.searchCompanyNews(application.companyName),
        gemini.searchCompanyCulture(application.companyName),
      ]);
      for (const item of news.slice(0, 3)) {
        if (item.url) sources.push({ url: item.url, source_type: 'exa', fetched_at: now });
      }
      return { news, culture };
    })(),
  ]);

  const jinaOk = jinaResult.status === 'fulfilled' && jinaResult.value !== null;
  const chOk = chResult.status === 'fulfilled' && chResult.value !== null;
  const geminiOk = geminiResult.status === 'fulfilled' && geminiResult.value !== null;

  if (!jinaOk && !chOk && !geminiOk) {
    return { success: false, error: 'All research sources failed' };
  }

  if (!jinaOk && jinaResult.status === 'rejected') {
    warnings.push(`Web scraping unavailable: ${(jinaResult.reason as Error)?.message ?? 'unknown'}`);
  }
  if (!chOk && chResult.status === 'rejected') {
    warnings.push(`Companies House unavailable: ${(chResult.reason as Error)?.message ?? 'unknown'}`);
  }
  if (!geminiOk && geminiResult.status === 'rejected') {
    warnings.push(`News search unavailable: ${(geminiResult.reason as Error)?.message ?? 'unknown'}`);
  }

  const scrapedPages: { url: string; markdown: string }[] = [];
  if (jinaOk) {
    const pages = jinaResult.value as CompanyPagesResult;
    const companyUrl = extractCompanyUrl(application.jobUrl, application.companyName);
    if (pages.homepage && companyUrl) {
      scrapedPages.push({ url: companyUrl, markdown: pages.homepage });
    }
    if (pages.aboutPage) scrapedPages.push({ url: `${companyUrl}/about`, markdown: pages.aboutPage });
    if (pages.careersPage) scrapedPages.push({ url: `${companyUrl}/careers`, markdown: pages.careersPage });
  }

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
    return { success: false, error: `Research synthesis failed: ${(err as Error).message}` };
  }

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

  const dbNow = new Date().toISOString();

  await db.insert(companyResearch).values({
    jobApplicationId: applicationId,
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
  });

  await db.update(jobApplications)
    .set({ researchedAt: dbNow, updatedAt: dbNow })
    .where(and(
      eq(jobApplications.id, applicationId),
      eq(jobApplications.userId, userId)
    ));

  if (warnings.length > 0) {
    console.warn(`[batch/run] Research warnings for ${applicationId}:`, warnings);
  }

  return { success: true };
}

// ─── Assessment pipeline ─────────────────────────────────────────────────────

async function runAssessment(
  applicationId: string,
  userId: string,
  application: {
    companyName: string;
    jobDescription: string;
    jobTitle: string;
  }
): Promise<{ success: boolean; overallScore?: number; error?: string }> {
  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  // Load research (optional)
  const [researchRow] = await db.select()
    .from(companyResearch)
    .where(and(
      eq(companyResearch.jobApplicationId, applicationId),
      eq(companyResearch.userId, userId)
    ))
    .limit(1);

  // Load examples for this user
  const allExamples = await db.select()
    .from(examples)
    .where(eq(examples.userId, userId));

  // Vector matching (with tag fallback)
  let matchedExampleIds: string[] = [];

  if (allExamples.length > 0) {
    try {
      const queryEmbedding = await generateEmbedding(plainJobDescription);
      const vectorMatches = await queryUserVectors(queryEmbedding, userId, 20, 0.0);
      matchedExampleIds = vectorMatches.map(m => m.id);
    } catch {
      // Tag-based fallback
      const jdWords = new Set(
        plainJobDescription.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 4)
      );
      const tagRows = await db.select({ exampleId: exampleTags.exampleId, tagName: tags.name })
        .from(exampleTags)
        .innerJoin(tags, eq(exampleTags.tagId, tags.id))
        .where(eq(tags.userId, userId));

      const exampleScores = new Map<string, number>();
      for (const { exampleId, tagName } of tagRows) {
        const normalised = tagName.toLowerCase();
        if (jdWords.has(normalised) || Array.from(jdWords).some(w => normalised.includes(w))) {
          exampleScores.set(exampleId, (exampleScores.get(exampleId) ?? 0) + 1);
        }
      }
      matchedExampleIds = Array.from(exampleScores.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id);
    }
  }

  let matchedExamples: typeof allExamples = [];
  if (matchedExampleIds.length > 0) {
    matchedExamples = await db.select()
      .from(examples)
      .where(and(inArray(examples.id, matchedExampleIds), eq(examples.userId, userId)));
  }

  const matchedTagRows = matchedExamples.length > 0
    ? await db.select({ exampleId: exampleTags.exampleId, tagName: tags.name })
        .from(exampleTags)
        .innerJoin(tags, eq(exampleTags.tagId, tags.id))
        .where(inArray(exampleTags.exampleId, matchedExamples.map(e => e.id)))
    : [];

  const tagsByExampleId = new Map<string, string[]>();
  for (const { exampleId, tagName } of matchedTagRows) {
    if (!tagsByExampleId.has(exampleId)) tagsByExampleId.set(exampleId, []);
    tagsByExampleId.get(exampleId)!.push(tagName);
  }

  const examplesForScoring: ExampleForFitScoring[] = matchedExamples.map(ex => {
    const plain = isEncryptionEnabled()
      ? decryptExampleFields({ question: ex.question, answer: ex.answer })
      : { question: ex.question, answer: ex.answer };
    return { id: ex.id, question: plain.question, answer: plain.answer, tags: tagsByExampleId.get(ex.id) ?? [], qualityRating: ex.qualityRating ?? undefined };
  });

  const consistencyRows = await db.select()
    .from(consistencyEntries)
    .where(eq(consistencyEntries.userId, userId));

  const consistencyForScoring: ConsistencyEntryForScoring[] = consistencyRows.map(c => ({ topic: c.topic, claim: c.claim }));

  let researchForPrompt: object | null = null;
  if (researchRow) {
    researchForPrompt = {
      companySize: researchRow.companySize,
      fundingStage: researchRow.fundingStage,
      industry: researchRow.industry,
      headquarters: researchRow.headquarters,
      techStack: researchRow.techStack,
      missionAndValues: researchRow.missionAndValues,
      foundedYear: researchRow.foundedYear,
      recentNews: researchRow.recentNews,
      cultureSignals: researchRow.cultureSignals,
      keyPeople: researchRow.keyPeople,
    };
  }

  // Archetype detection
  let archetypeResult: ArchetypeResult;
  try {
    const { system, user, toolSchema } = buildArchetypeDetectionPrompt({ jobDescription: plainJobDescription });
    archetypeResult = await callWithTool<ArchetypeResult>(system, user, toolSchema);
  } catch (err) {
    return { success: false, error: `Archetype detection failed: ${(err as Error).message}` };
  }

  // Fit scoring
  let scoringResult: FitScoringResult;
  try {
    const { system, user, toolSchema } = buildFitScoringPrompt({
      jobDescription: plainJobDescription,
      archetype: archetypeResult.archetype,
      companyResearch: researchForPrompt,
      examples: examplesForScoring,
      consistencyEntries: consistencyForScoring,
    });
    scoringResult = await callWithTool<FitScoringResult>(system, user, toolSchema);
  } catch (err) {
    return { success: false, error: `Fit scoring failed: ${(err as Error).message}` };
  }

  const overallScore = calculateOverallScore(scoringResult, DEFAULT_FIT_WEIGHTS);
  const dimToStore = (dim: DimensionScoreRaw): string => JSON.stringify(dim as DimensionScore);
  const dbNow = new Date().toISOString();

  await db.insert(fitAssessments).values({
    jobApplicationId: applicationId,
    userId,
    archetype: archetypeResult.archetype,
    archetypeRationale: archetypeResult.rationale,
    dimDomainIndustry: dimToStore(scoringResult.dimDomainIndustry),
    dimSeniority: dimToStore(scoringResult.dimSeniority),
    dimScope: dimToStore(scoringResult.dimScope),
    dimTechnical: dimToStore(scoringResult.dimTechnical),
    dimMission: dimToStore(scoringResult.dimMission),
    dimLocation: dimToStore(scoringResult.dimLocation),
    dimCompensation: dimToStore(scoringResult.dimCompensation),
    dimCulture: dimToStore(scoringResult.dimCulture),
    overallScore,
    weights: JSON.stringify(DEFAULT_FIT_WEIGHTS),
    redFlags: JSON.stringify(scoringResult.redFlags),
    greenFlags: JSON.stringify(scoringResult.greenFlags),
    exampleIdsUsed: JSON.stringify(matchedExamples.map(e => e.id)),
    dismissedRedFlags: JSON.stringify([]),
    dimensionAnnotations: null,
    updatedAt: dbNow,
  });

  await db.update(jobApplications)
    .set({ assessedAt: dbNow, fitScoreOverall: overallScore, fitArchetype: archetypeResult.archetype, status: 'assessed', updatedAt: dbNow })
    .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)));

  return { success: true, overallScore };
}

// ─── Materials pipeline ──────────────────────────────────────────────────────

async function runMaterials(
  applicationId: string,
  userId: string,
  application: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    fitScoreOverall: number | null;
  },
  masterCv?: string
): Promise<{ success: boolean; error?: string }> {
  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  // Load assessment
  const [assessmentRow] = await db.select()
    .from(fitAssessments)
    .where(and(eq(fitAssessments.jobApplicationId, applicationId), eq(fitAssessments.userId, userId)))
    .limit(1);

  if (!assessmentRow) {
    return { success: false, error: 'Assessment row not found' };
  }

  const greenFlags: string[] = assessmentRow.greenFlags ? JSON.parse(assessmentRow.greenFlags) as string[] : [];
  const redFlags: string[] = assessmentRow.redFlags ? JSON.parse(assessmentRow.redFlags) as string[] : [];

  // Load company research (optional)
  const [researchRow] = await db.select()
    .from(companyResearch)
    .where(and(eq(companyResearch.jobApplicationId, applicationId), eq(companyResearch.userId, userId)))
    .limit(1);

  // Get matched examples via vector similarity
  let matchedExampleIds: string[] = [];
  try {
    const queryEmbedding = await generateEmbedding(plainJobDescription);
    const vectorMatches = await queryUserVectors(queryEmbedding, userId, 20, 0.0);
    matchedExampleIds = vectorMatches.map(m => m.id);
  } catch {
    const allExamples = await db.select({ id: examples.id }).from(examples).where(eq(examples.userId, userId));
    matchedExampleIds = allExamples.slice(0, 20).map(e => e.id);
  }

  let matchedExampleRows: { id: string; question: string; answer: string; qualityRating: string | null }[] = [];
  if (matchedExampleIds.length > 0) {
    matchedExampleRows = await db.select({ id: examples.id, question: examples.question, answer: examples.answer, qualityRating: examples.qualityRating })
      .from(examples)
      .where(and(inArray(examples.id, matchedExampleIds), eq(examples.userId, userId)));
  }

  const tagRows = matchedExampleRows.length > 0
    ? await db.select({ exampleId: exampleTags.exampleId, tagName: tags.name })
        .from(exampleTags)
        .innerJoin(tags, eq(exampleTags.tagId, tags.id))
        .where(inArray(exampleTags.exampleId, matchedExampleRows.map(e => e.id)))
    : [];

  const tagsByExampleId = new Map<string, string[]>();
  for (const { exampleId, tagName } of tagRows) {
    if (!tagsByExampleId.has(exampleId)) tagsByExampleId.set(exampleId, []);
    tagsByExampleId.get(exampleId)!.push(tagName);
  }

  const decryptedExamples = matchedExampleRows.map(ex => {
    const plain = isEncryptionEnabled()
      ? decryptExampleFields({ question: ex.question, answer: ex.answer })
      : { question: ex.question, answer: ex.answer };
    return { ...ex, question: plain.question, answer: plain.answer, tags: tagsByExampleId.get(ex.id) ?? [] };
  });

  const promptHash = computePromptHash(plainJobDescription, decryptedExamples.map(e => e.id), masterCv);
  const dbNow = new Date().toISOString();

  const materialTypes: MaterialType[] = ['cv', 'cover_letter', 'tracking_note'];

  for (const materialType of materialTypes) {
    try {
      let rawContent = '';
      let exampleIdsUsed: string[] = [];

      if (materialType === 'cv') {
        const cvExamples: CvExample[] = decryptedExamples.map(ex => ({
          id: ex.id, question: ex.question, answer: ex.answer, tags: ex.tags, qualityRating: ex.qualityRating ?? undefined,
        }));
        const { system, user, toolSchema } = buildCvPrompt({
          masterCv,
          examples: cvExamples,
          jobDescription: plainJobDescription,
          fitAssessment: { archetype: assessmentRow.archetype, greenFlags, overallScore: assessmentRow.overallScore ?? 0 },
          companyName: application.companyName,
          jobTitle: application.jobTitle,
        });
        const result = await callWithTool<{ content: string; exampleIdsUsed?: string[] }>(system, user, adaptToolSchema(toolSchema));
        rawContent = result.content;
        exampleIdsUsed = result.exampleIdsUsed ?? [];
      } else if (materialType === 'cover_letter') {
        const coverExamples: CoverLetterExample[] = decryptedExamples.slice(0, 5).map(ex => ({
          id: ex.id, question: ex.question, answer: ex.answer, tags: ex.tags,
        }));
        const coverResearch: CoverLetterCompanyResearch | null = researchRow
          ? { recentNews: researchRow.recentNews ?? undefined, cultureSignals: researchRow.cultureSignals ?? undefined, missionAndValues: researchRow.missionAndValues ?? undefined, fundingStage: researchRow.fundingStage ?? undefined, industry: researchRow.industry ?? undefined }
          : null;
        const { system, user, toolSchema } = buildCoverLetterPrompt({
          companyResearch: coverResearch,
          fitAssessment: { greenFlags, archetype: assessmentRow.archetype },
          examples: coverExamples,
          jobDescription: plainJobDescription,
          companyName: application.companyName,
          jobTitle: application.jobTitle,
        });
        const result = await callWithTool<{ content: string; exampleIdsUsed?: string[] }>(system, user, adaptToolSchema(toolSchema));
        rawContent = result.content;
        exampleIdsUsed = result.exampleIdsUsed ?? [];
      } else if (materialType === 'tracking_note') {
        const dimensionScores: TrackingDimensionScore[] = [];
        const parseDim = (raw: string | null, name: string): void => {
          if (!raw) return;
          try {
            const dim = JSON.parse(raw) as DimensionScore;
            dimensionScores.push({ dimension: name, score: dim.score * 10, evidence: dim.evidence });
          } catch { /* skip */ }
        };
        parseDim(assessmentRow.dimDomainIndustry, 'Domain / Industry');
        parseDim(assessmentRow.dimSeniority, 'Seniority');
        parseDim(assessmentRow.dimScope, 'Scope');
        parseDim(assessmentRow.dimTechnical, 'Technical');
        parseDim(assessmentRow.dimMission, 'Mission');
        parseDim(assessmentRow.dimLocation, 'Location');
        parseDim(assessmentRow.dimCompensation, 'Compensation');
        parseDim(assessmentRow.dimCulture, 'Culture');

        const matchedForTracking: MatchedExample[] = decryptedExamples.map(ex => ({ question: ex.question, tags: ex.tags }));
        const { system, user, toolSchema } = buildTrackingNotePrompt({
          companyName: application.companyName,
          jobTitle: application.jobTitle,
          fitScore: assessmentRow.overallScore ?? 0,
          archetype: assessmentRow.archetype,
          companyResearch: researchRow
            ? { fundingStage: researchRow.fundingStage ?? undefined, companySize: researchRow.companySize ?? undefined, headquarters: researchRow.headquarters ?? undefined, industry: researchRow.industry ?? undefined, recentNews: researchRow.recentNews ?? undefined }
            : undefined,
          dimensionScores,
          redFlags,
          greenFlags,
          matchedExamples: matchedForTracking,
        });
        const result = await callWithTool<{ content: string }>(system, user, adaptToolSchema(toolSchema));
        rawContent = result.content;
        exampleIdsUsed = decryptedExamples.map(e => e.id);
      }

      const storedContent = encryptMaterialContent(rawContent);

      await db.insert(generatedMaterials).values({
        jobApplicationId: applicationId,
        userId,
        type: materialType,
        content: storedContent,
        version: 1,
        exampleIdsUsed: JSON.stringify(exampleIdsUsed),
        promptHash,
        updatedAt: dbNow,
      });
    } catch (err) {
      console.error(`[batch/run] Materials ${materialType} failed for ${applicationId}:`, err);
      // Non-fatal: continue to next material type
    }
  }

  // Update materialsAt regardless of partial failures
  await db.update(jobApplications)
    .set({ materialsAt: dbNow, updatedAt: dbNow })
    .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)));

  return { success: true };
}

// ─── POST /api/batch/[id]/run ────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  // Run endpoint — 1 req/min (prevents spam-clicking)
  if (!checkRateLimit(ip, 1)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const b = body as Record<string, unknown>;
  const masterCv = typeof b.masterCv === 'string' ? b.masterCv : undefined;

  // ─── Load batch + ownership check ────────────────────────────────────────

  const [batch] = await db
    .select()
    .from(batchRuns)
    .where(and(eq(batchRuns.id, params.id), eq(batchRuns.userId, userId)))
    .limit(1);

  if (!batch) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // ─── Load all applications sorted by createdAt ASC ───────────────────────

  const allApps = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.batchId, params.id), eq(jobApplications.userId, userId)));

  // Sort by createdAt ascending (earliest first)
  allApps.sort((a, b) => {
    const aTime = a.createdAt ?? '';
    const bTime = b.createdAt ?? '';
    return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
  });

  // ─── Find first unprocessed application ──────────────────────────────────
  //
  // An application is "batch-pending" when it has not yet been assessed AND
  // is not already marked complete or failed. The batch pipeline marks apps
  // 'complete' or 'failed' at the end of each run call, so this is the
  // reliable completion signal.

  const pendingApp = allApps.find(
    (app) => !app.assessedAt && app.status !== 'complete' && app.status !== 'failed'
  );

  if (!pendingApp) {
    // All done or no pending apps
    const remaining = allApps.filter(app => app.status !== 'complete' && app.status !== 'failed').length;

    // Mark batch complete if all apps are processed
    if (remaining === 0 || (batch.completedJobs + batch.failedJobs) >= batch.totalJobs) {
      const dbNow = new Date().toISOString();
      const [updatedBatch] = await db.update(batchRuns)
        .set({ status: 'completed', updatedAt: dbNow })
        .where(eq(batchRuns.id, params.id))
        .returning();

      return Response.json({
        batch: {
          id: updatedBatch.id,
          userId: updatedBatch.userId,
          status: updatedBatch.status,
          totalJobs: updatedBatch.totalJobs,
          completedJobs: updatedBatch.completedJobs,
          failedJobs: updatedBatch.failedJobs,
          fitThreshold: updatedBatch.fitThreshold,
          summaryTable: updatedBatch.summaryTable,
          warnings: updatedBatch.warnings ? JSON.parse(updatedBatch.warnings) : [],
          createdAt: updatedBatch.createdAt,
          updatedAt: updatedBatch.updatedAt,
        },
        processed_this_call: 0,
        remaining: 0,
      });
    }

    return Response.json({
      batch: {
        id: batch.id,
        userId: batch.userId,
        status: batch.status,
        totalJobs: batch.totalJobs,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        fitThreshold: batch.fitThreshold,
        summaryTable: batch.summaryTable,
        warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },
      processed_this_call: 0,
      remaining,
    });
  }

  // ─── Mark batch as running ────────────────────────────────────────────────

  const dbNow = new Date().toISOString();
  await db.update(batchRuns)
    .set({ status: 'running', updatedAt: dbNow })
    .where(eq(batchRuns.id, params.id));

  // ─── Process the pending application ─────────────────────────────────────

  let processFailed = false;
  let finalScore: number | undefined;

  // Step 1: Research
  if (Date.now() - startTime < TIMING_BUDGET_MS) {
    try {
      const researchResult = await runResearch(pendingApp.id, userId, {
        companyName: pendingApp.companyName,
        jobUrl: pendingApp.jobUrl,
        jobDescription: pendingApp.jobDescription,
      });

      if (!researchResult.success) {
        console.warn(`[batch/run] Research failed for ${pendingApp.id}: ${researchResult.error}`);
        // Non-fatal: continue to assessment
      }
    } catch (err) {
      console.error(`[batch/run] Research threw for ${pendingApp.id}:`, err);
      // Non-fatal: skip to assessment
    }
  } else {
    // Timing budget exceeded — return early
    const remaining = allApps.filter(app => !app.assessedAt && app.status !== 'complete' && app.status !== 'failed').length;
    return Response.json({
      batch: {
        id: batch.id,
        userId: batch.userId,
        status: 'running',
        totalJobs: batch.totalJobs,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        fitThreshold: batch.fitThreshold,
        summaryTable: batch.summaryTable,
        warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },
      processed_this_call: 0,
      remaining,
    });
  }

  // Step 2: Assessment
  if (Date.now() - startTime < TIMING_BUDGET_MS) {
    try {
      const assessResult = await runAssessment(pendingApp.id, userId, {
        companyName: pendingApp.companyName,
        jobDescription: pendingApp.jobDescription,
        jobTitle: pendingApp.jobTitle,
      });

      if (!assessResult.success) {
        console.error(`[batch/run] Assessment failed for ${pendingApp.id}: ${assessResult.error}`);
        processFailed = true;
      } else {
        finalScore = assessResult.overallScore;
      }
    } catch (err) {
      console.error(`[batch/run] Assessment threw for ${pendingApp.id}:`, err);
      processFailed = true;
    }
  } else {
    // Timing budget exceeded after research
    const remaining = allApps.filter(app => !app.assessedAt && app.status !== 'complete' && app.status !== 'failed').length;
    return Response.json({
      batch: {
        id: batch.id,
        userId: batch.userId,
        status: 'running',
        totalJobs: batch.totalJobs,
        completedJobs: batch.completedJobs,
        failedJobs: batch.failedJobs,
        fitThreshold: batch.fitThreshold,
        summaryTable: batch.summaryTable,
        warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
      },
      processed_this_call: 0,
      remaining,
    });
  }

  // Step 3: Materials (only if assessment succeeded and score >= threshold)
  if (!processFailed && finalScore !== undefined && finalScore >= batch.fitThreshold) {
    if (Date.now() - startTime < TIMING_BUDGET_MS) {
      try {
        // Re-load app to get latest state (fitScoreOverall updated by assessment)
        const [refreshedApp] = await db.select()
          .from(jobApplications)
          .where(and(eq(jobApplications.id, pendingApp.id), eq(jobApplications.userId, userId)))
          .limit(1);

        if (refreshedApp) {
          await runMaterials(pendingApp.id, userId, {
            companyName: refreshedApp.companyName,
            jobTitle: refreshedApp.jobTitle,
            jobDescription: refreshedApp.jobDescription,
            fitScoreOverall: refreshedApp.fitScoreOverall,
          }, masterCv);
        }
      } catch (err) {
        console.error(`[batch/run] Materials threw for ${pendingApp.id}:`, err);
        // Non-fatal: still mark as complete (partial success)
      }
    }
  }

  // ─── Update application status + batch counters ───────────────────────────

  const statusNow = new Date().toISOString();

  if (processFailed) {
    await db.update(jobApplications)
      .set({ status: 'failed', updatedAt: statusNow })
      .where(and(eq(jobApplications.id, pendingApp.id), eq(jobApplications.userId, userId)));

    await db.update(batchRuns)
      .set({ failedJobs: batch.failedJobs + 1, updatedAt: statusNow })
      .where(eq(batchRuns.id, params.id));
  } else {
    await db.update(jobApplications)
      .set({ status: 'complete', updatedAt: statusNow })
      .where(and(eq(jobApplications.id, pendingApp.id), eq(jobApplications.userId, userId)));

    await db.update(batchRuns)
      .set({ completedJobs: batch.completedJobs + 1, updatedAt: statusNow })
      .where(eq(batchRuns.id, params.id));
  }

  // ─── Calculate remaining and check if batch is fully done ────────────────

  const updatedApps = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.batchId, params.id), eq(jobApplications.userId, userId)));

  const remaining = updatedApps.filter(
    app => app.status !== 'complete' && app.status !== 'failed'
  ).length;

  const newCompletedJobs = processFailed ? batch.completedJobs : batch.completedJobs + 1;
  const newFailedJobs = processFailed ? batch.failedJobs + 1 : batch.failedJobs;
  const allDone = (newCompletedJobs + newFailedJobs) >= batch.totalJobs;

  const batchStatus = allDone ? 'completed' : 'running';
  const finalUpdateNow = new Date().toISOString();

  const [finalBatch] = await db.update(batchRuns)
    .set({
      status: batchStatus,
      completedJobs: newCompletedJobs,
      failedJobs: newFailedJobs,
      updatedAt: finalUpdateNow,
    })
    .where(eq(batchRuns.id, params.id))
    .returning();

  return Response.json({
    batch: {
      id: finalBatch.id,
      userId: finalBatch.userId,
      status: finalBatch.status,
      totalJobs: finalBatch.totalJobs,
      completedJobs: finalBatch.completedJobs,
      failedJobs: finalBatch.failedJobs,
      fitThreshold: finalBatch.fitThreshold,
      summaryTable: finalBatch.summaryTable,
      warnings: finalBatch.warnings ? JSON.parse(finalBatch.warnings) : [],
      createdAt: finalBatch.createdAt,
      updatedAt: finalBatch.updatedAt,
    },
    processed_this_call: 1,
    remaining,
  });
}
