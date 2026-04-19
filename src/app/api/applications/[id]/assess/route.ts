import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import {
  jobApplications,
  companyResearch,
  fitAssessments,
  examples,
  exampleTags,
  tags,
  consistencyEntries,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  decryptExampleFields,
  decryptResearchFields,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { queryUserVectors } from '@/lib/vector/upstash';
import {
  buildArchetypeDetectionPrompt,
  buildFitScoringPrompt,
  type ExampleForFitScoring,
  type ConsistencyEntryForScoring,
} from '@/lib/prompts/fit-assessment';
import { callWithTool } from '@/lib/ai/call-with-tool';
import type {
  FitWeights,
  DimensionScore,
  RoleArchetype,
} from '@/lib/types';
import { DEFAULT_FIT_WEIGHTS } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ─── Types returned by Claude tool calls ─────────────────────────────────────

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

// ─── Weighted average calculation ─────────────────────────────────────────────

function calculateOverallScore(
  scoring: FitScoringResult,
  weights: FitWeights
): number {
  const totalWeight =
    weights.domain +
    weights.seniority +
    weights.scope +
    weights.technical +
    weights.mission +
    weights.location +
    weights.compensation +
    weights.culture;

  const weightedSum =
    scoring.dimDomainIndustry.score * weights.domain +
    scoring.dimSeniority.score * weights.seniority +
    scoring.dimScope.score * weights.scope +
    scoring.dimTechnical.score * weights.technical +
    scoring.dimMission.score * weights.mission +
    scoring.dimLocation.score * weights.location +
    scoring.dimCompensation.score * weights.compensation +
    scoring.dimCulture.score * weights.culture;

  // Each dimension is 1-10, multiply weighted average by 10 to get 1-100
  return Math.round((weightedSum / totalWeight) * 10);
}

// ─── POST /api/applications/[id]/assess ───────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  // Assessment is moderately expensive — 3 req/min per IP
  if (!checkRateLimit(ip, 3)) {
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
  const force = b.force === true;
  const weightsOverride = b.weights as Partial<FitWeights> | undefined;

  // ─── Load and verify ownership ──────────────────────────────────────────────

  const [application] = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      )
    )
    .limit(1);

  if (!application) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Return 409 if already assessed and force not set
  if (application.assessedAt && !force) {
    return Response.json(
      { error: 'Assessment already completed. Pass force: true to re-run.' },
      { status: 409 }
    );
  }

  // ─── Research check ─────────────────────────────────────────────────────────
  // Load companyResearch row — may be null (user skipped research).
  // If researchedAt is null we check whether a row exists anyway.
  // We allow assessment with null research, but need the data if present.

  const [researchRow] = await db
    .select()
    .from(companyResearch)
    .where(
      and(
        eq(companyResearch.jobApplicationId, params.id),
        eq(companyResearch.userId, userId)
      )
    )
    .limit(1);

  // researchedAt === null AND no research row means they truly skipped.
  // We still allow assessment but will flag it in confidence.
  const hasResearch = !!researchRow;

  // ─── Decrypt job description ─────────────────────────────────────────────────

  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  // ─── Build weights ───────────────────────────────────────────────────────────

  const weights: FitWeights = {
    ...DEFAULT_FIT_WEIGHTS,
    ...(weightsOverride ?? {}),
  };

  // ─── Load user examples ──────────────────────────────────────────────────────

  const allExamples = await db
    .select()
    .from(examples)
    .where(eq(examples.userId, userId));

  // ─── Attempt vector similarity matching ─────────────────────────────────────

  let matchedExampleIds: string[] = [];
  let vectorMatchingFailed = false;

  if (allExamples.length > 0) {
    try {
      const queryEmbedding = await generateEmbedding(plainJobDescription);
      const vectorMatches = await queryUserVectors(
        queryEmbedding,
        userId,
        20,
        0.0 // use threshold 0 to get top-N regardless of score
      );
      matchedExampleIds = vectorMatches.map(m => m.id);
    } catch {
      // Vector matching failed — fall back to tag-based matching
      vectorMatchingFailed = true;
    }
  }

  // ─── Tag-based fallback ──────────────────────────────────────────────────────

  if (vectorMatchingFailed || matchedExampleIds.length === 0) {
    // Extract keywords from job description (simple tokenisation)
    const jdWords = new Set(
      plainJobDescription
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 4)
    );

    // Load tags and filter examples whose tags overlap with JD keywords
    const tagRows = await db
      .select({
        exampleId: exampleTags.exampleId,
        tagName: tags.name,
      })
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

  // ─── Fetch full example rows for matched IDs ─────────────────────────────────

  let matchedExamples: typeof allExamples = [];
  if (matchedExampleIds.length > 0) {
    matchedExamples = await db
      .select()
      .from(examples)
      .where(
        and(
          inArray(examples.id, matchedExampleIds),
          eq(examples.userId, userId)
        )
      );
  }

  // Fetch tags for matched examples
  const matchedTagRows =
    matchedExamples.length > 0
      ? await db
          .select({
            exampleId: exampleTags.exampleId,
            tagName: tags.name,
          })
          .from(exampleTags)
          .innerJoin(tags, eq(exampleTags.tagId, tags.id))
          .where(inArray(exampleTags.exampleId, matchedExamples.map(e => e.id)))
      : [];

  const tagsByExampleId = new Map<string, string[]>();
  for (const { exampleId, tagName } of matchedTagRows) {
    if (!tagsByExampleId.has(exampleId)) tagsByExampleId.set(exampleId, []);
    tagsByExampleId.get(exampleId)!.push(tagName);
  }

  // Decrypt and shape examples for the prompt
  const examplesForScoring: ExampleForFitScoring[] = matchedExamples.map(ex => {
    const plain = isEncryptionEnabled()
      ? decryptExampleFields({ question: ex.question, answer: ex.answer })
      : { question: ex.question, answer: ex.answer };
    return {
      id: ex.id,
      question: plain.question,
      answer: plain.answer,
      tags: tagsByExampleId.get(ex.id) ?? [],
      qualityRating: ex.qualityRating ?? undefined,
    };
  });

  // ─── Load consistency entries ─────────────────────────────────────────────────

  const consistencyRows = await db
    .select()
    .from(consistencyEntries)
    .where(eq(consistencyEntries.userId, userId));

  const consistencyForScoring: ConsistencyEntryForScoring[] = consistencyRows.map(c => ({
    topic: c.topic,
    claim: c.claim,
  }));

  // ─── Prepare company research for the prompt ──────────────────────────────────

  let researchForPrompt: object | null = null;
  if (hasResearch && researchRow) {
    // Decrypt sensitive research fields before passing to the prompt
    const decryptedSensitive = isEncryptionEnabled()
      ? decryptResearchFields({
          recentNews: researchRow.recentNews,
          cultureSignals: researchRow.cultureSignals,
          keyPeople: researchRow.keyPeople,
        })
      : {
          recentNews: researchRow.recentNews,
          cultureSignals: researchRow.cultureSignals,
          keyPeople: researchRow.keyPeople,
        };

    researchForPrompt = {
      companySize: researchRow.companySize,
      fundingStage: researchRow.fundingStage,
      industry: researchRow.industry,
      headquarters: researchRow.headquarters,
      techStack: researchRow.techStack,
      missionAndValues: researchRow.missionAndValues,
      foundedYear: researchRow.foundedYear,
      recentNews: decryptedSensitive.recentNews,
      cultureSignals: decryptedSensitive.cultureSignals,
      keyPeople: decryptedSensitive.keyPeople,
    };
  }

  // ─── Call 1: Archetype detection ──────────────────────────────────────────────

  let archetypeResult: ArchetypeResult;
  try {
    const { system, user, toolSchema } = buildArchetypeDetectionPrompt({
      jobDescription: plainJobDescription,
    });
    archetypeResult = await callWithTool<ArchetypeResult>(system, user, toolSchema);
  } catch (err) {
    console.error('Archetype detection (Claude) failed:', err);
    return Response.json(
      { error: 'Archetype detection failed. Please try again.' },
      { status: 503 }
    );
  }

  // ─── Call 2: Fit scoring ──────────────────────────────────────────────────────

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
    console.error('Fit scoring (Claude) failed:', err);
    return Response.json(
      { error: 'Fit scoring failed. Please try again.' },
      { status: 503 }
    );
  }

  // ─── Calculate overall score ─────────────────────────────────────────────────

  const overallScore = calculateOverallScore(scoringResult, weights);

  // ─── If force: preserve dismissed flags and dimension annotations ──────────────

  let dismissedRedFlags: string[] = [];
  let dimensionAnnotations: string | null = null;

  if (force) {
    const [existingAssessment] = await db
      .select({
        dismissedRedFlags: fitAssessments.dismissedRedFlags,
        dimensionAnnotations: fitAssessments.dimensionAnnotations,
      })
      .from(fitAssessments)
      .where(
        and(
          eq(fitAssessments.jobApplicationId, params.id),
          eq(fitAssessments.userId, userId)
        )
      )
      .limit(1);

    if (existingAssessment) {
      try {
        dismissedRedFlags = existingAssessment.dismissedRedFlags
          ? (JSON.parse(existingAssessment.dismissedRedFlags) as string[])
          : [];
      } catch {
        dismissedRedFlags = [];
      }
      dimensionAnnotations = existingAssessment.dimensionAnnotations ?? null;
    }

    // Delete existing assessment row before re-inserting
    await db.delete(fitAssessments).where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    );
  }

  // ─── Write to DB ──────────────────────────────────────────────────────────────

  const dbNow = new Date().toISOString();

  const dimToStore = (dim: DimensionScoreRaw): string =>
    JSON.stringify(dim as DimensionScore);

  try {
    const [inserted] = await db
      .insert(fitAssessments)
      .values({
        jobApplicationId: params.id,
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
        weights: JSON.stringify(weights),
        redFlags: JSON.stringify(scoringResult.redFlags),
        greenFlags: JSON.stringify(scoringResult.greenFlags),
        exampleIdsUsed: JSON.stringify(matchedExamples.map(e => e.id)),
        dismissedRedFlags: JSON.stringify(dismissedRedFlags),
        dimensionAnnotations,
        updatedAt: dbNow,
      })
      .returning();

    // Update jobApplications with assessment summary
    await db
      .update(jobApplications)
      .set({
        assessedAt: dbNow,
        fitScoreOverall: overallScore,
        fitArchetype: archetypeResult.archetype,
        status: 'assessed',
        updatedAt: dbNow,
      })
      .where(
        and(
          eq(jobApplications.id, params.id),
          eq(jobApplications.userId, userId)
        )
      );

    // Shape response: parse dimension JSON back to objects
    const assessmentResponse = {
      ...inserted,
      dimDomainIndustry: scoringResult.dimDomainIndustry,
      dimSeniority: scoringResult.dimSeniority,
      dimScope: scoringResult.dimScope,
      dimTechnical: scoringResult.dimTechnical,
      dimMission: scoringResult.dimMission,
      dimLocation: scoringResult.dimLocation,
      dimCompensation: scoringResult.dimCompensation,
      dimCulture: scoringResult.dimCulture,
      weights,
      redFlags: scoringResult.redFlags,
      greenFlags: scoringResult.greenFlags,
      exampleIdsUsed: matchedExamples.map(e => e.id),
      dismissedRedFlags,
    };

    return Response.json({
      assessment: assessmentResponse,
      archetype: archetypeResult.archetype,
      overall_score: overallScore,
      red_flags: scoringResult.redFlags,
      green_flags: scoringResult.greenFlags,
    });
  } catch (err) {
    console.error('POST /api/applications/[id]/assess DB error:', err);
    return Response.json({ error: 'Failed to save assessment' }, { status: 500 });
  }
}
