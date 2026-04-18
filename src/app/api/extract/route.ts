import { anthropic } from '@ai-sdk/anthropic';
import { generateText, jsonSchema, tool } from 'ai';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts, examples } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptTranscriptFields, encryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';
import {
  EXTRACTION_PASS1_SYSTEM,
  EXTRACTION_PASS1_SCHEMA,
  buildPass1UserMessage,
  prependLineNumbers,
} from '@/lib/prompts/extraction-pass1';
import { type RawPair } from '@/lib/prompts/extraction-pass2';

export const runtime = 'nodejs';
export const maxDuration = 60;

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
  const callAsAny = toolCall as unknown as { input?: T; args?: T };
  return (callAsAny.input ?? callAsAny.args) as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Pass1Result {
  pairs: RawPair[];
}

// ─── Route handler — Pass 1 only (fits within 60s) ──────────────────────────

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

  // Decrypt rawText if encryption is enabled
  const decryptedTranscript = isEncryptionEnabled()
    ? { ...transcript, ...decryptTranscriptFields({ rawText: transcript.rawText }) }
    : transcript;

  // Check if already extracted
  if (decryptedTranscript.extractedAt && !force) {
    return Response.json(
      { error: 'Transcript already extracted. Pass force: true to re-extract.' },
      { status: 409 }
    );
  }

  // Prepend line numbers
  const numberedTranscript = prependLineNumbers(decryptedTranscript.rawText);

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

  // ─── Persist to database (examples only — tags/consistency come from /enrich) ─

  const now = new Date().toISOString();

  try {
    for (const pair of rawPairs) {
      const sourcePosition = JSON.stringify({
        start_line: pair.source_start_line,
        end_line: pair.source_end_line,
      });

      const encryptedExampleFields = isEncryptionEnabled()
        ? encryptExampleFields({ question: pair.question, answer: pair.answer })
        : { question: pair.question, answer: pair.answer };

      await db.insert(examples)
        .values({
          userId,
          transcriptId,
          question: encryptedExampleFields.question,
          answer: encryptedExampleFields.answer,
          sourcePosition,
          updatedAt: now,
        });
    }

    // Mark transcript as extracted
    await db.update(transcripts)
      .set({ extractedAt: now, updatedAt: now })
      .where(and(eq(transcripts.id, transcriptId), eq(transcripts.userId, userId)));
  } catch (err) {
    console.error('Database persist error:', err);
    return Response.json({ error: 'Failed to save extracted pairs' }, { status: 500 });
  }

  return Response.json({
    pairs_extracted: rawPairs.length,
    pairs: rawPairs.map(p => ({
      question: p.question,
      answer: p.answer,
      source_start_line: p.source_start_line,
      source_end_line: p.source_end_line,
    })),
  });
}
