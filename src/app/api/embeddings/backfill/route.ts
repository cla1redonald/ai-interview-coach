import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { generateBatchEmbeddings, formatExampleForEmbedding } from '@/lib/embeddings/openai';
import { upsertExampleVector, fetchExistingVectorIds } from '@/lib/vector/upstash';

export const runtime = 'nodejs';
export const maxDuration = 300;

const BATCH_SIZE = 8;

// POST /api/embeddings/backfill — admin only (requires ADMIN_TOKEN)
// Finds all examples without vectors and generates embeddings for them.
export async function POST(request: Request) {
  const adminToken = request.headers.get('x-admin-token');
  if (!process.env.ADMIN_TOKEN || adminToken !== process.env.ADMIN_TOKEN) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // Load all examples for this user
  const userExamples = await db
    .select({ id: examples.id, question: examples.question, answer: examples.answer })
    .from(examples)
    .where(eq(examples.userId, userId));

  if (userExamples.length === 0) {
    return Response.json({ backfilled: 0, total: 0, message: 'No examples found' });
  }

  // Determine which already have vectors
  const allIds = userExamples.map(e => e.id);
  const existingIds = await fetchExistingVectorIds(allIds);

  const missing = userExamples.filter(e => !existingIds.has(e.id));

  if (missing.length === 0) {
    return Response.json({
      backfilled: 0,
      total: userExamples.length,
      message: 'All examples already have embeddings',
    });
  }

  // Generate and upsert embeddings in batches
  let backfilled = 0;
  const errors: string[] = [];

  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const inputs = batch.map(e => formatExampleForEmbedding(e.question, e.answer));

    try {
      const embeddings = await generateBatchEmbeddings(inputs, BATCH_SIZE);
      await Promise.all(
        batch.map((e, j) => upsertExampleVector(e.id, userId, embeddings[j]))
      );
      backfilled += batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Batch ${i / BATCH_SIZE + 1}: ${msg}`);
      console.error('Backfill batch error:', err);
    }
  }

  return Response.json({
    backfilled,
    total: userExamples.length,
    missing: missing.length,
    errors: errors.length > 0 ? errors : undefined,
    message: `Backfilled ${backfilled} of ${missing.length} missing embeddings`,
  });
}
