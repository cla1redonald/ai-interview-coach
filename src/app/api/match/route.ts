import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { generateEmbedding } from '@/lib/embeddings/openai';
import { queryUserVectors } from '@/lib/vector/upstash';
import { decryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';
import { callWithTool } from '@/lib/ai/call-with-tool';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  MATCHING_SYSTEM,
  buildExplanationUserMessage,
  EXPLANATION_SCHEMA,
  buildGapAnalysisUserMessage,
  GAP_ANALYSIS_SCHEMA,
  type PairForExplanation,
} from '@/lib/prompts/matching';

export const runtime = 'nodejs';
export const maxDuration = 60;

const DEFAULT_MATCH_COUNT = 5;
const MAX_MATCH_COUNT = 20;
const DEFAULT_THRESHOLD = 0.5;

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkRateLimit(ip, 10)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const jobSpec = typeof b.job_spec === 'string' ? b.job_spec.trim() : '';

  if (!jobSpec) {
    return Response.json({ error: 'job_spec is required' }, { status: 400 });
  }

  if (jobSpec.length > 5000) {
    return Response.json({ error: 'Job spec too long (max 5,000 characters)' }, { status: 400 });
  }

  const matchCount = Math.min(
    typeof b.match_count === 'number' ? Math.max(1, Math.round(b.match_count)) : DEFAULT_MATCH_COUNT,
    MAX_MATCH_COUNT
  );
  const matchThreshold =
    typeof b.match_threshold === 'number' ? b.match_threshold : DEFAULT_THRESHOLD;

  // 1. Generate embedding for job spec (input_type: 'query')
  let queryEmbedding: number[];
  try {
    queryEmbedding = await generateEmbedding(jobSpec);
  } catch (err) {
    console.error('OpenAI embedding error:', err);
    return Response.json({ error: 'Failed to generate job spec embedding' }, { status: 500 });
  }

  // 2. Query Upstash Vector — per-user filter
  let vectorMatches: { id: string; score: number }[];
  try {
    vectorMatches = await queryUserVectors(queryEmbedding, userId, matchCount, matchThreshold);
  } catch (err) {
    console.error('Upstash Vector query error:', err);
    return Response.json({ error: 'Failed to query vector index' }, { status: 500 });
  }

  if (vectorMatches.length === 0) {
    // Check if the user has any examples at all to give a useful error
    const [anyExample] = await db
      .select({ id: examples.id })
      .from(examples)
      .where(eq(examples.userId, userId))
      .limit(1);

    if (!anyExample) {
      return Response.json(
        { error: 'No examples in your bank yet. Upload a transcript to get started.' },
        { status: 422 }
      );
    }

    return Response.json(
      { error: 'No examples with embeddings match this job spec. Try running the backfill endpoint or uploading more transcripts.' },
      { status: 422 }
    );
  }

  // 3. Fetch full example rows from Turso by returned IDs (verify ownership via userId filter)
  const matchIds = vectorMatches.map(m => m.id);
  const scoreById = new Map(vectorMatches.map(m => [m.id, m.score]));

  const exampleRows = await db
    .select()
    .from(examples)
    .where(and(inArray(examples.id, matchIds), eq(examples.userId, userId)));

  // Also fetch tags for matched examples
  const tagJoins = await db
    .select({
      exampleId: exampleTags.exampleId,
      tagId: exampleTags.tagId,
      name: tags.name,
      isSystem: tags.isSystem,
      userId: tags.userId,
    })
    .from(exampleTags)
    .innerJoin(tags, eq(exampleTags.tagId, tags.id))
    .where(inArray(exampleTags.exampleId, matchIds));

  const tagsByExampleId = new Map<string, typeof tagJoins>();
  for (const tj of tagJoins) {
    if (!tagsByExampleId.has(tj.exampleId)) tagsByExampleId.set(tj.exampleId, []);
    tagsByExampleId.get(tj.exampleId)!.push(tj);
  }

  // Sort examples by score descending (Upstash may not return in order)
  // Decrypt fields if encryption is enabled
  const sortedExamples = exampleRows
    .sort((a, b) => (scoreById.get(b.id) ?? 0) - (scoreById.get(a.id) ?? 0))
    .map(e =>
      isEncryptionEnabled()
        ? { ...e, ...decryptExampleFields({ question: e.question, answer: e.answer }) }
        : e
    );

  // 4. Run gap analysis + get job spec summary (Claude)
  let jobSpecSummary = '';
  let gaps: Array<{ requirement: string; gap_description: string }> = [];

  try {
    const matchedQuestions = sortedExamples.map(e => e.question);
    const gapResult = await callWithTool<{
      job_spec_summary: string;
      gaps: Array<{ requirement: string; gap_description: string }>;
    }>(
      MATCHING_SYSTEM,
      buildGapAnalysisUserMessage(jobSpec, matchedQuestions),
      GAP_ANALYSIS_SCHEMA
    );
    jobSpecSummary = gapResult.job_spec_summary ?? '';
    gaps = gapResult.gaps ?? [];
  } catch (err) {
    console.error('Gap analysis error (non-fatal):', err);
    jobSpecSummary = '';
    gaps = [];
  }

  // 5. Generate one-sentence explanation per match (Claude)
  const pairsForExplanation: PairForExplanation[] = sortedExamples.map((e, i) => ({
    index: i,
    question: e.question,
    answer: e.answer.slice(0, 400), // truncate for token efficiency
    score: scoreById.get(e.id) ?? 0,
  }));

  const explanationsByIndex = new Map<number, string>();

  try {
    const explanationResult = await callWithTool<{
      explanations: Array<{ index: number; explanation: string }>;
    }>(
      MATCHING_SYSTEM,
      buildExplanationUserMessage(jobSpecSummary || jobSpec.slice(0, 500), pairsForExplanation),
      EXPLANATION_SCHEMA
    );
    for (const e of explanationResult.explanations ?? []) {
      explanationsByIndex.set(e.index, e.explanation);
    }
  } catch (err) {
    console.error('Explanation generation error (non-fatal):', err);
  }

  // 6. Build response
  const matches = sortedExamples.map((e, i) => ({
    example: {
      ...e,
      tags: (tagsByExampleId.get(e.id) ?? []).map(tj => ({
        id: tj.tagId,
        name: tj.name,
        isSystem: tj.isSystem ?? false,
        userId: tj.userId,
      })),
    },
    similarity: scoreById.get(e.id) ?? 0,
    explanation: explanationsByIndex.get(i) ?? '',
  }));

  return Response.json({
    matches,
    gaps,
    job_spec_summary: jobSpecSummary,
  });
}
