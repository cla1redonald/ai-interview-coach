import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts, examples, tags, exampleTags, consistencyEntries } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { decryptTranscriptFields, decryptExampleFields, encryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';
import { generateBatchEmbeddings, formatExampleForEmbedding } from '@/lib/embeddings/openai';
import { upsertExampleVector } from '@/lib/vector/upstash';
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
import { callWithTool } from '@/lib/ai/call-with-tool';
import { prependLineNumbers } from '@/lib/prompts/extraction-pass1';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface TaggingResult {
  results: Array<{ index: number; tags: string[] }>;
}

interface ConsistencyResult {
  results: Array<{
    index: number;
    claims: Array<{
      topic: 'compensation' | 'leaving_reason' | 'start_date' | 'role_scope';
      claim: string;
    }>;
  }>;
}

// ─── Route handler — Pass 2 + Tagging + Consistency + Embeddings ────────────

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

  if (!transcriptId) {
    return Response.json({ error: 'transcript_id is required' }, { status: 400 });
  }

  // Load transcript
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

  // Idempotency guard — don't re-run enrichment
  if (transcript.enrichedAt) {
    return Response.json({ message: 'Already enriched', skipped: true });
  }

  // Load examples for this transcript
  const exampleRows = await db.select()
    .from(examples)
    .where(and(
      eq(examples.transcriptId, transcriptId),
      eq(examples.userId, userId)
    ));

  if (exampleRows.length === 0) {
    return Response.json({ error: 'No examples found — run extraction first' }, { status: 422 });
  }

  // Decrypt transcript and examples
  const decryptedTranscript = isEncryptionEnabled()
    ? { ...transcript, ...decryptTranscriptFields({ rawText: transcript.rawText }) }
    : transcript;

  const decryptedExamples = exampleRows.map(e =>
    isEncryptionEnabled()
      ? { ...e, ...decryptExampleFields({ question: e.question, answer: e.answer }) }
      : e
  );

  const numberedTranscript = prependLineNumbers(decryptedTranscript.rawText);

  // Build rawPairs from existing examples for Pass 2
  const rawPairs: RawPair[] = decryptedExamples.map(e => {
    const pos = e.sourcePosition ? JSON.parse(e.sourcePosition) : {};
    return {
      question: e.question,
      answer: e.answer,
      source_start_line: pos.start_line ?? 0,
      source_end_line: pos.end_line ?? 0,
    };
  });

  // Build pairs for tagging/consistency
  const pairsForTagging: PairForTagging[] = decryptedExamples.map((e, i) => ({
    index: i,
    question: e.question,
    answer: e.answer,
  }));

  const pairsForConsistency: PairForConsistency[] = pairsForTagging;

  // Load tags for resolution
  const systemTags = await db.select().from(tags).where(isNull(tags.userId));
  const userTags = await db.select().from(tags).where(eq(tags.userId, userId));
  const allTags = [...systemTags, ...userTags];
  const tagByName = new Map(allTags.map(t => [t.name.toLowerCase(), t.id]));

  // ─── Run Pass 2, Tagging, Consistency in parallel ─────────────────────────

  const [pass2Result, taggingResult, consistencyResult] = await Promise.allSettled([
    callWithTool<Pass2Result>(
      EXTRACTION_PASS2_SYSTEM,
      buildPass2UserMessage(numberedTranscript, rawPairs),
      EXTRACTION_PASS2_SCHEMA
    ),
    callWithTool<TaggingResult>(
      TAGGING_SYSTEM,
      buildTaggingUserMessage(pairsForTagging),
      TAGGING_SCHEMA
    ),
    callWithTool<ConsistencyResult>(
      CONSISTENCY_SYSTEM,
      buildConsistencyUserMessage(pairsForConsistency, decryptedTranscript.company ?? null),
      CONSISTENCY_SCHEMA
    ),
  ]);

  const warnings: string[] = [];

  // ─── Apply Pass 2 corrections ─────────────────────────────────────────────

  if (pass2Result.status === 'fulfilled') {
    const { corrections } = pass2Result.value;
    for (const c of corrections ?? []) {
      if (c.index < 0 || c.index >= decryptedExamples.length) continue;
      if (c.remove) continue; // Skip removals for now — examples already saved
      const example = decryptedExamples[c.index];
      const updates: Record<string, string> = {};
      if (c.corrected_question) updates.question = c.corrected_question;
      if (c.corrected_answer) updates.answer = c.corrected_answer;
      if (Object.keys(updates).length > 0) {
        try {
          const q = updates.question ?? example.question;
          const a = updates.answer ?? example.answer;
          const finalSet = isEncryptionEnabled()
            ? { ...encryptExampleFields({ question: q, answer: a }), updatedAt: new Date().toISOString() }
            : { ...updates, updatedAt: new Date().toISOString() };
          await db.update(examples)
            .set(finalSet)
            .where(and(eq(examples.id, example.id), eq(examples.userId, userId)));
        } catch (err) {
          console.error('Pass 2 correction update error:', err);
        }
      }
    }
    warnings.push(...(pass2Result.value.warnings ?? []));
  } else {
    console.error('Pass 2 error (non-fatal):', pass2Result.reason);
    warnings.push('Verification pass failed');
  }

  // ─── Apply tags ───────────────────────────────────────────────────────────

  if (taggingResult.status === 'fulfilled') {
    for (const r of taggingResult.value.results ?? []) {
      if (r.index < 0 || r.index >= decryptedExamples.length) continue;
      const exampleId = decryptedExamples[r.index].id;
      for (const name of r.tags ?? []) {
        const tagId = tagByName.get(name.toLowerCase());
        if (tagId) {
          try {
            await db.insert(exampleTags).values({ exampleId, tagId });
          } catch (err) {
            console.error('Tag insert error:', err);
          }
        }
      }
    }
  } else {
    console.error('Tagging error (non-fatal):', taggingResult.reason);
    warnings.push('Auto-tagging failed');
  }

  // ─── Apply consistency entries ────────────────────────────────────────────

  if (consistencyResult.status === 'fulfilled') {
    for (const r of consistencyResult.value.results ?? []) {
      if (r.index < 0 || r.index >= decryptedExamples.length) continue;
      const exampleId = decryptedExamples[r.index].id;
      for (const claim of r.claims ?? []) {
        try {
          await db.insert(consistencyEntries).values({
            userId,
            exampleId,
            company: decryptedTranscript.company ?? 'Unknown',
            topic: claim.topic,
            claim: claim.claim,
            interviewDate: decryptedTranscript.interviewDate ?? null,
          });
        } catch (err) {
          console.error('Consistency insert error:', err);
        }
      }
    }
  } else {
    console.error('Consistency error (non-fatal):', consistencyResult.reason);
    warnings.push('Consistency extraction failed');
  }

  // ─── Generate embeddings ──────────────────────────────────────────────────

  try {
    const embeddingInputs = decryptedExamples.map(e =>
      formatExampleForEmbedding(e.question, e.answer)
    );

    if (embeddingInputs.length > 0) {
      const embeddings = await generateBatchEmbeddings(embeddingInputs);
      await Promise.all(
        decryptedExamples.map((e, i) =>
          upsertExampleVector(e.id, userId, embeddings[i])
        )
      );
    }
  } catch (err) {
    console.error('Embedding generation error (non-fatal):', err);
    warnings.push('Embedding generation failed — run backfill later');
  }

  // Mark transcript as enriched (idempotency)
  await db.update(transcripts)
    .set({ enrichedAt: new Date().toISOString() })
    .where(eq(transcripts.id, transcriptId));

  return Response.json({
    enriched: true,
    examples_processed: decryptedExamples.length,
    warnings,
  });
}
