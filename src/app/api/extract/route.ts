import { anthropic } from '@ai-sdk/anthropic';
import { generateText, jsonSchema, tool } from 'ai';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts, examples, tags, exampleTags, consistencyEntries } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { generateBatchEmbeddings, formatExampleForEmbedding } from '@/lib/embeddings/voyage';
import { upsertExampleVector } from '@/lib/vector/upstash';
import {
  EXTRACTION_PASS1_SYSTEM,
  EXTRACTION_PASS1_SCHEMA,
  buildPass1UserMessage,
  prependLineNumbers,
} from '@/lib/prompts/extraction-pass1';
import {
  EXTRACTION_PASS2_SYSTEM,
  EXTRACTION_PASS2_SCHEMA,
  buildPass2UserMessage,
  type RawPair,
} from '@/lib/prompts/extraction-pass2';
import {
  TAGGING_SYSTEM,
  TAGGING_SCHEMA,
  buildTaggingUserMessage,
  type PairForTagging,
} from '@/lib/prompts/tagging';
import {
  CONSISTENCY_SYSTEM,
  CONSISTENCY_SCHEMA,
  buildConsistencyUserMessage,
  type PairForConsistency,
} from '@/lib/prompts/consistency';

export const runtime = 'nodejs';
// Extraction is synchronous and can take 30-60s for long transcripts
export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-5-20250929';

// ─── Helper: call Claude with a tool and parse the result ────────────────────

async function callWithTool<T>(
  systemPrompt: string,
  userMessage: string,
  toolDef: { name: string; description: string; parameters: object }
): Promise<T> {
  const toolInstance = tool({
    description: toolDef.description,
    inputSchema: jsonSchema(toolDef.parameters as Parameters<typeof jsonSchema>[0]),
  });

  const result = await generateText({
    model: anthropic(MODEL),
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    tools: { [toolDef.name]: toolInstance },
    toolChoice: { type: 'tool', toolName: toolDef.name },
    maxOutputTokens: 8000,
  });

  const toolCall = result.toolCalls.find(tc => tc.toolName === toolDef.name);
  if (!toolCall) {
    throw new Error(`Claude did not call the ${toolDef.name} tool`);
  }
  // AI SDK v6: tool input is in .input (StaticToolCall) or .args (DynamicToolCall)
  const callAsAny = toolCall as unknown as { input?: T; args?: T };
  return (callAsAny.input ?? callAsAny.args) as T;
}

// ─── Types for Claude tool responses ─────────────────────────────────────────

interface Pass1Result {
  pairs: RawPair[];
}

interface Pass2Correction {
  index: number;
  issue: string;
  corrected_question?: string;
  corrected_answer?: string;
  corrected_start_line?: number;
  corrected_end_line?: number;
  remove?: boolean;
}

interface Pass2Result {
  corrections: Pass2Correction[];
  warnings: string[];
}

interface TaggingResultItem {
  index: number;
  tags: string[];
}

interface TaggingResult {
  results: TaggingResultItem[];
}

interface ConsistencyClaim {
  topic: 'compensation' | 'leaving_reason' | 'start_date' | 'role_scope';
  claim: string;
}

interface ConsistencyResultItem {
  index: number;
  claims: ConsistencyClaim[];
}

interface ConsistencyResult {
  results: ConsistencyResultItem[];
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const transcriptId = typeof b.transcript_id === 'string' ? b.transcript_id.trim() : '';
  const force = b.force === true;

  if (!transcriptId) {
    return Response.json({ error: 'transcript_id is required' }, { status: 400 });
  }

  // Load transcript — verify ownership
  const [transcript] = await db.select()
    .from(transcripts)
    .where(and(
      eq(transcripts.id, transcriptId),
      eq(transcripts.userId, userId)
    ))
    .limit(1);

  if (!transcript) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // Check if already extracted
  if (transcript.extractedAt && !force) {
    return Response.json(
      { error: 'Transcript already extracted. Pass force: true to re-extract.' },
      { status: 409 }
    );
  }

  // Load system tags for tag name → ID resolution
  const systemTags = await db.select()
    .from(tags)
    .where(isNull(tags.userId));

  // Also load user's custom tags
  const userTags = await db.select()
    .from(tags)
    .where(eq(tags.userId, userId));

  const allTags = [...systemTags, ...userTags];
  const tagByName = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

  // Prepend line numbers
  const numberedTranscript = prependLineNumbers(transcript.rawText);

  // ─── Pass 1: Extract Q&A pairs ────────────────────────────────────────────

  let rawPairs: RawPair[];
  try {
    const pass1 = await callWithTool<Pass1Result>(
      EXTRACTION_PASS1_SYSTEM,
      buildPass1UserMessage(numberedTranscript),
      EXTRACTION_PASS1_SCHEMA
    );
    rawPairs = pass1.pairs ?? [];
  } catch (err) {
    console.error('Pass 1 extraction error:', err);
    return Response.json({ error: 'Extraction Pass 1 failed' }, { status: 500 });
  }

  if (rawPairs.length === 0) {
    return Response.json(
      { error: 'No Q&A pairs could be extracted from this transcript' },
      { status: 422 }
    );
  }

  // ─── Pass 2: Verify and correct ───────────────────────────────────────────

  let warnings: string[] = [];
  try {
    const pass2 = await callWithTool<Pass2Result>(
      EXTRACTION_PASS2_SYSTEM,
      buildPass2UserMessage(numberedTranscript, rawPairs),
      EXTRACTION_PASS2_SCHEMA
    );

    warnings = pass2.warnings ?? [];

    // Apply corrections
    const toRemove = new Set<number>();
    for (const c of pass2.corrections ?? []) {
      if (c.index < 0 || c.index >= rawPairs.length) continue;
      if (c.remove) {
        toRemove.add(c.index);
        continue;
      }
      const pair = rawPairs[c.index];
      if (c.corrected_question) pair.question = c.corrected_question;
      if (c.corrected_answer) pair.answer = c.corrected_answer;
      if (c.corrected_start_line != null) pair.source_start_line = c.corrected_start_line;
      if (c.corrected_end_line != null) pair.source_end_line = c.corrected_end_line;
    }

    // Remove flagged pairs (reverse order to preserve indices)
    rawPairs = rawPairs.filter((_, i) => !toRemove.has(i));
  } catch (err) {
    // Pass 2 failure is non-fatal — proceed with Pass 1 results
    console.error('Pass 2 verification error (non-fatal):', err);
    warnings.push('Verification pass failed — pairs may have minor errors');
  }

  // ─── Auto-tag all pairs (batched — single API call) ───────────────────────

  const pairsForTagging: PairForTagging[] = rawPairs.map((p, i) => ({
    index: i,
    question: p.question,
    answer: p.answer,
  }));

  let tagResults: TaggingResultItem[] = [];
  try {
    const tagging = await callWithTool<TaggingResult>(
      TAGGING_SYSTEM,
      buildTaggingUserMessage(pairsForTagging),
      TAGGING_SCHEMA
    );
    tagResults = tagging.results ?? [];
  } catch (err) {
    console.error('Tagging error (non-fatal):', err);
    warnings.push('Auto-tagging failed — pairs have no tags');
  }

  // Build index → tag names map
  const tagsByIndex = new Map<number, string[]>();
  for (const r of tagResults) {
    tagsByIndex.set(r.index, r.tags ?? []);
  }

  // ─── Extract consistency claims (batched — single API call) ───────────────

  const pairsForConsistency: PairForConsistency[] = rawPairs.map((p, i) => ({
    index: i,
    question: p.question,
    answer: p.answer,
  }));

  let consistencyResults: ConsistencyResultItem[] = [];
  try {
    const consistency = await callWithTool<ConsistencyResult>(
      CONSISTENCY_SYSTEM,
      buildConsistencyUserMessage(pairsForConsistency, transcript.company ?? null),
      CONSISTENCY_SCHEMA
    );
    consistencyResults = consistency.results ?? [];
  } catch (err) {
    console.error('Consistency extraction error (non-fatal):', err);
    warnings.push('Consistency claim extraction failed');
  }

  // Build index → claims map
  const claimsByIndex = new Map<number, ConsistencyClaim[]>();
  for (const r of consistencyResults) {
    if (r.claims?.length > 0) {
      claimsByIndex.set(r.index, r.claims);
    }
  }

  // ─── Persist to database ──────────────────────────────────────────────────

  const now = new Date().toISOString();
  const insertedExamples: Array<{ id: string; index: number }> = [];

  try {
    for (let i = 0; i < rawPairs.length; i++) {
      const pair = rawPairs[i];
      const sourcePosition = JSON.stringify({
        start_line: pair.source_start_line,
        end_line: pair.source_end_line,
      });

      const [inserted] = await db.insert(examples)
        .values({
          userId,
          transcriptId,
          question: pair.question,
          answer: pair.answer,
          sourcePosition,
          updatedAt: now,
        })
        .returning({ id: examples.id });

      insertedExamples.push({ id: inserted.id, index: i });
    }

    // Insert example_tags
    for (const { id: exampleId, index } of insertedExamples) {
      const tagNames = tagsByIndex.get(index) ?? [];
      for (const name of tagNames) {
        const tagId = tagByName.get(name.toLowerCase());
        if (tagId) {
          await db.insert(exampleTags).values({ exampleId, tagId });
        }
      }
    }

    // Insert consistency entries
    for (const { id: exampleId, index } of insertedExamples) {
      const claims = claimsByIndex.get(index) ?? [];
      for (const claim of claims) {
        await db.insert(consistencyEntries).values({
          userId,
          exampleId,
          company: transcript.company ?? 'Unknown',
          topic: claim.topic,
          claim: claim.claim,
          interviewDate: transcript.interviewDate ?? null,
        });
      }
    }

    // Mark transcript as extracted
    await db.update(transcripts)
      .set({ extractedAt: now, updatedAt: now })
      .where(eq(transcripts.id, transcriptId));
  } catch (err) {
    console.error('Database persist error:', err);
    return Response.json({ error: 'Failed to save extracted pairs' }, { status: 500 });
  }

  // ─── Generate embeddings and upsert to Upstash Vector ────────────────────
  // Synchronous — extraction is already slow, adding embeddings is acceptable.

  try {
    const embeddingInputs = insertedExamples.map(({ index }) => {
      const pair = rawPairs[index];
      return formatExampleForEmbedding(pair.question, pair.answer);
    });

    if (embeddingInputs.length > 0) {
      const embeddings = await generateBatchEmbeddings(embeddingInputs, 'document');
      await Promise.all(
        insertedExamples.map(({ id: exampleId }, i) =>
          upsertExampleVector(exampleId, userId, embeddings[i])
        )
      );
    }
  } catch (err) {
    // Non-fatal — examples are in DB; backfill endpoint can recover missing vectors
    console.error('Embedding generation error (non-fatal):', err);
  }

  // ─── Build response ───────────────────────────────────────────────────────

  const extractedPairs = rawPairs.map((p, i) => ({
    question: p.question,
    answer: p.answer,
    source_start_line: p.source_start_line,
    source_end_line: p.source_end_line,
    suggested_tags: tagsByIndex.get(i) ?? [],
    consistency_claims: claimsByIndex.get(i) ?? [],
  }));

  const consistencyClaimsTotal = Array.from(claimsByIndex.values()).reduce(
    (sum, claims) => sum + claims.length,
    0
  );

  return Response.json({
    pairs_extracted: rawPairs.length,
    pairs: {
      pairs: extractedPairs,
      extraction_warnings: warnings,
    },
    consistency_claims_found: consistencyClaimsTotal,
  });
}
