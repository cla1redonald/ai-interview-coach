import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import {
  jobApplications,
  companyResearch,
  fitAssessments,
  generatedMaterials,
  examples,
  exampleTags,
  tags,
} from '@/lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  decryptExampleFields,
  encryptMaterialContent,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { queryUserVectors } from '@/lib/vector/upstash';
import { callWithTool } from '@/lib/ai/call-with-tool';
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
import { createHash } from 'crypto';
import type {
  MaterialType,
  DimensionScore,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

const FIT_THRESHOLD_DEFAULT = parseInt(
  process.env.FIT_THRESHOLD_DEFAULT ?? '70',
  10
);

// ─── Helpers to adapt materials toolSchema to callWithTool format ─────────────
//
// The materials prompts use Anthropic's `input_schema` key, but callWithTool
// expects a `parameters` key (Vercel AI SDK format). This adapter normalises
// the two formats transparently.

interface MaterialsToolSchema {
  name: string;
  input_schema?: object;
  parameters?: object;
  description?: string;
}

function adaptToolSchema(raw: object): {
  name: string;
  description: string;
  parameters: object;
} {
  const schema = raw as MaterialsToolSchema;
  return {
    name: schema.name,
    description: schema.description ?? `Call ${schema.name}`,
    parameters: schema.parameters ?? schema.input_schema ?? {},
  };
}

// ─── Compute a stable prompt hash ────────────────────────────────────────────

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

// ─── POST /api/applications/[id]/materials ────────────────────────────────────

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
  // Materials generation — 5 req/min per IP
  if (!checkRateLimit(ip, 5)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const types = Array.isArray(b.types) ? (b.types as MaterialType[]) : [];
  const force = b.force === true;
  const masterCv = typeof b.masterCv === 'string' ? b.masterCv : undefined;
  const fitThresholdOverride =
    typeof b.fitThreshold === 'number' ? b.fitThreshold : undefined;

  if (types.length === 0) {
    return Response.json(
      { error: 'types array is required and must be non-empty' },
      { status: 400 }
    );
  }

  const validTypes: MaterialType[] = ['cv', 'cover_letter', 'tracking_note'];
  const invalidTypes = types.filter(t => !validTypes.includes(t));
  if (invalidTypes.length > 0) {
    return Response.json(
      { error: `Invalid material types: ${invalidTypes.join(', ')}` },
      { status: 400 }
    );
  }

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

  // Assessment must exist before generating materials
  if (!application.assessedAt) {
    return Response.json(
      { error: 'Run fit assessment first.' },
      { status: 422 }
    );
  }

  // ─── Fit threshold check ─────────────────────────────────────────────────────

  const effectiveThreshold =
    fitThresholdOverride !== undefined ? fitThresholdOverride : FIT_THRESHOLD_DEFAULT;

  if (
    application.fitScoreOverall !== null &&
    application.fitScoreOverall < effectiveThreshold
  ) {
    return Response.json(
      {
        error: `Fit score (${application.fitScoreOverall}) is below the threshold (${effectiveThreshold}). Pass fitThreshold: 0 in the body to generate anyway.`,
        fit_score: application.fitScoreOverall,
        threshold: effectiveThreshold,
      },
      { status: 422 }
    );
  }

  // ─── Decrypt job description ─────────────────────────────────────────────────

  const plainJobDescription = isEncryptionEnabled()
    ? decryptJobDescription({ jobDescription: application.jobDescription }).jobDescription
    : application.jobDescription;

  // ─── Load fit assessment ──────────────────────────────────────────────────────

  const [assessmentRow] = await db
    .select()
    .from(fitAssessments)
    .where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    )
    .limit(1);

  if (!assessmentRow) {
    return Response.json(
      { error: 'Fit assessment data not found. Please re-run assessment.' },
      { status: 422 }
    );
  }

  // Parse stored JSON fields
  const greenFlags: string[] = assessmentRow.greenFlags
    ? (JSON.parse(assessmentRow.greenFlags) as string[])
    : [];
  const redFlags: string[] = assessmentRow.redFlags
    ? (JSON.parse(assessmentRow.redFlags) as string[])
    : [];

  // ─── Load company research (optional) ────────────────────────────────────────

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

  // ─── Get matched examples via vector similarity ───────────────────────────────

  let matchedExampleIds: string[] = [];

  try {
    const queryEmbedding = await generateEmbedding(plainJobDescription);
    const vectorMatches = await queryUserVectors(queryEmbedding, userId, 20, 0.0);
    matchedExampleIds = vectorMatches.map(m => m.id);
  } catch {
    // Vector matching failed — fall back to all examples (capped)
    const allExamples = await db
      .select({ id: examples.id })
      .from(examples)
      .where(eq(examples.userId, userId));
    matchedExampleIds = allExamples.slice(0, 20).map(e => e.id);
  }

  // ─── Fetch example rows and their tags ───────────────────────────────────────

  let matchedExampleRows: {
    id: string;
    question: string;
    answer: string;
    qualityRating: string | null;
  }[] = [];

  if (matchedExampleIds.length > 0) {
    matchedExampleRows = await db
      .select({
        id: examples.id,
        question: examples.question,
        answer: examples.answer,
        qualityRating: examples.qualityRating,
      })
      .from(examples)
      .where(
        and(
          inArray(examples.id, matchedExampleIds),
          eq(examples.userId, userId)
        )
      );
  }

  const tagRows =
    matchedExampleRows.length > 0
      ? await db
          .select({
            exampleId: exampleTags.exampleId,
            tagName: tags.name,
          })
          .from(exampleTags)
          .innerJoin(tags, eq(exampleTags.tagId, tags.id))
          .where(inArray(exampleTags.exampleId, matchedExampleRows.map(e => e.id)))
      : [];

  const tagsByExampleId = new Map<string, string[]>();
  for (const { exampleId, tagName } of tagRows) {
    if (!tagsByExampleId.has(exampleId)) tagsByExampleId.set(exampleId, []);
    tagsByExampleId.get(exampleId)!.push(tagName);
  }

  // Decrypt example fields
  const decryptedExamples = matchedExampleRows.map(ex => {
    const plain = isEncryptionEnabled()
      ? decryptExampleFields({ question: ex.question, answer: ex.answer })
      : { question: ex.question, answer: ex.answer };
    return {
      ...ex,
      question: plain.question,
      answer: plain.answer,
      tags: tagsByExampleId.get(ex.id) ?? [],
    };
  });

  // ─── Compute prompt hash ──────────────────────────────────────────────────────

  const promptHash = computePromptHash(
    plainJobDescription,
    decryptedExamples.map(e => e.id),
    masterCv
  );

  // ─── Generate materials for each requested type ───────────────────────────────

  const warnings: string[] = [];
  const generatedResults: {
    id: string;
    jobApplicationId: string;
    userId: string;
    type: MaterialType;
    content: string;
    version: number;
    exampleIdsUsed: string[];
    promptHash: string | null;
    createdAt: string;
    updatedAt: string;
  }[] = [];

  const dbNow = new Date().toISOString();

  for (const materialType of types) {
    try {
      let rawContent = '';
      let exampleIdsUsed: string[] = [];

      if (materialType === 'cv') {
        const cvExamples: CvExample[] = decryptedExamples.map(ex => ({
          id: ex.id,
          question: ex.question,
          answer: ex.answer,
          tags: ex.tags,
          qualityRating: ex.qualityRating ?? undefined,
        }));

        const { system, user, toolSchema } = buildCvPrompt({
          masterCv,
          examples: cvExamples,
          jobDescription: plainJobDescription,
          fitAssessment: {
            archetype: assessmentRow.archetype,
            greenFlags,
            overallScore: assessmentRow.overallScore ?? 0,
          },
          companyName: application.companyName,
          jobTitle: application.jobTitle,
        });

        const result = await callWithTool<{
          content: string;
          exampleIdsUsed?: string[];
          warnings?: string[];
        }>(system, user, adaptToolSchema(toolSchema));

        rawContent = result.content;
        exampleIdsUsed = result.exampleIdsUsed ?? [];
        if (result.warnings?.length) {
          warnings.push(...result.warnings.map(w => `[cv] ${w}`));
        }
      } else if (materialType === 'cover_letter') {
        const coverExamples: CoverLetterExample[] = decryptedExamples.slice(0, 5).map(ex => ({
          id: ex.id,
          question: ex.question,
          answer: ex.answer,
          tags: ex.tags,
        }));

        const coverResearch: CoverLetterCompanyResearch | null = researchRow
          ? {
              recentNews: researchRow.recentNews ?? undefined,
              cultureSignals: researchRow.cultureSignals ?? undefined,
              missionAndValues: researchRow.missionAndValues ?? undefined,
              fundingStage: researchRow.fundingStage ?? undefined,
              industry: researchRow.industry ?? undefined,
            }
          : null;

        const { system, user, toolSchema } = buildCoverLetterPrompt({
          companyResearch: coverResearch,
          fitAssessment: {
            greenFlags,
            archetype: assessmentRow.archetype,
          },
          examples: coverExamples,
          jobDescription: plainJobDescription,
          companyName: application.companyName,
          jobTitle: application.jobTitle,
        });

        const result = await callWithTool<{
          content: string;
          exampleIdsUsed?: string[];
        }>(system, user, adaptToolSchema(toolSchema));

        rawContent = result.content;
        exampleIdsUsed = result.exampleIdsUsed ?? [];
      } else if (materialType === 'tracking_note') {
        // Build dimension scores for tracking note
        const dimensionScores: TrackingDimensionScore[] = [];

        const parseDim = (raw: string | null, name: string): void => {
          if (!raw) return;
          try {
            const dim = JSON.parse(raw) as DimensionScore;
            dimensionScores.push({
              dimension: name,
              score: dim.score * 10, // convert 1-10 to 0-100 for display
              evidence: dim.evidence,
            });
          } catch {
            // skip unparseable dimension
          }
        };

        parseDim(assessmentRow.dimDomainIndustry, 'Domain / Industry');
        parseDim(assessmentRow.dimSeniority, 'Seniority');
        parseDim(assessmentRow.dimScope, 'Scope');
        parseDim(assessmentRow.dimTechnical, 'Technical');
        parseDim(assessmentRow.dimMission, 'Mission');
        parseDim(assessmentRow.dimLocation, 'Location');
        parseDim(assessmentRow.dimCompensation, 'Compensation');
        parseDim(assessmentRow.dimCulture, 'Culture');

        const matchedForTracking: MatchedExample[] = decryptedExamples.map(ex => ({
          question: ex.question,
          tags: ex.tags,
        }));

        const { system, user, toolSchema } = buildTrackingNotePrompt({
          companyName: application.companyName,
          jobTitle: application.jobTitle,
          fitScore: assessmentRow.overallScore ?? 0,
          archetype: assessmentRow.archetype,
          companyResearch: researchRow
            ? {
                fundingStage: researchRow.fundingStage ?? undefined,
                companySize: researchRow.companySize ?? undefined,
                headquarters: researchRow.headquarters ?? undefined,
                industry: researchRow.industry ?? undefined,
                recentNews: researchRow.recentNews ?? undefined,
              }
            : undefined,
          dimensionScores,
          redFlags,
          greenFlags,
          matchedExamples: matchedForTracking,
        });

        const result = await callWithTool<{ content: string }>(
          system,
          user,
          adaptToolSchema(toolSchema)
        );

        rawContent = result.content;
        exampleIdsUsed = decryptedExamples.map(e => e.id);
      }

      // ─── Encrypt content + determine version ──────────────────────────────────

      const storedContent = encryptMaterialContent(rawContent);

      let version = 1;

      if (force) {
        // Find the highest existing version for this type
        const existing = await db
          .select({ version: generatedMaterials.version })
          .from(generatedMaterials)
          .where(
            and(
              eq(generatedMaterials.jobApplicationId, params.id),
              eq(generatedMaterials.userId, userId),
              eq(generatedMaterials.type, materialType)
            )
          );

        if (existing.length > 0) {
          version = Math.max(...existing.map(r => r.version)) + 1;
        }
      }

      // ─── Insert row ───────────────────────────────────────────────────────────

      const [inserted] = await db
        .insert(generatedMaterials)
        .values({
          jobApplicationId: params.id,
          userId,
          type: materialType,
          content: storedContent,
          version,
          exampleIdsUsed: JSON.stringify(exampleIdsUsed),
          promptHash,
          updatedAt: dbNow,
        })
        .returning();

      generatedResults.push({
        id: inserted.id,
        jobApplicationId: inserted.jobApplicationId,
        userId: inserted.userId,
        type: inserted.type as MaterialType,
        content: rawContent, // return plaintext to caller
        version: inserted.version,
        exampleIdsUsed,
        promptHash: inserted.promptHash,
        createdAt: inserted.createdAt ?? dbNow,
        updatedAt: inserted.updatedAt ?? dbNow,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unknown error';
      warnings.push(`[${materialType}] Generation failed: ${msg}`);
      console.error(
        `POST /api/applications/[id]/materials — ${materialType} failed:`,
        err
      );
    }
  }

  // ─── Update materialsAt on the application ────────────────────────────────────

  if (generatedResults.length > 0) {
    await db
      .update(jobApplications)
      .set({ materialsAt: dbNow, updatedAt: dbNow })
      .where(
        and(
          eq(jobApplications.id, params.id),
          eq(jobApplications.userId, userId)
        )
      );
  }

  return Response.json({
    materials: generatedResults,
    examples_used: decryptedExamples.length,
    warnings,
  });
}
