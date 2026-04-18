import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';

const BREAKDOWN_SYSTEM_PROMPT = `You are a structured interview coach. Break the given interview answer into STAR+Reflection format.

Respond with valid JSON only, using this exact structure:
{
  "situation": "The context and background",
  "task": "What was required or the challenge faced",
  "action": "What the candidate specifically did — be concrete",
  "result": "The outcome, ideally with metrics or measurable impact",
  "reflection": "What was learned or what would be done differently"
}

Rules:
- Use direct, first-person language as if the candidate is speaking
- Keep each field to 2-4 sentences maximum
- Extract metrics from the answer if present
- If a STAR element is not present in the answer, make a reasonable inference from context but keep it brief
- The reflection should be forward-looking and genuine, not generic`;

const MODEL = 'claude-sonnet-4-5-20250929';

// POST /api/examples/[id]/breakdown — call Claude to pre-populate STAR+Reflection fields
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const [example] = await db.select()
    .from(examples)
    .where(and(
      eq(examples.id, params.id),
      eq(examples.userId, userId)
    ))
    .limit(1);

  if (!example) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  const decrypted = isEncryptionEnabled()
    ? { ...example, ...decryptExampleFields({ question: example.question, answer: example.answer }) }
    : example;

  const userMessage = `Question: ${decrypted.question}

Answer: ${decrypted.answer}

Break this answer into STAR+Reflection format.`;

  try {
    const result = await generateText({
      model: anthropic(MODEL),
      system: BREAKDOWN_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      maxOutputTokens: 1024,
    });

    const text = result.text;

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return Response.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return Response.json({
      situation: parsed.situation ?? '',
      task: parsed.task ?? '',
      action: parsed.action ?? '',
      result: parsed.result ?? '',
      reflection: parsed.reflection ?? '',
    });
  } catch (err) {
    console.error('POST /api/examples/[id]/breakdown error:', err);
    return Response.json({ error: 'AI breakdown failed' }, { status: 500 });
  }
}
