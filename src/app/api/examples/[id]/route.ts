import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { generateEmbedding, formatExampleForEmbedding } from '@/lib/embeddings/voyage';
import { upsertExampleVector, deleteExampleVector } from '@/lib/vector/upstash';

const VALID_QUALITY_RATINGS = ['strong', 'weak', 'neutral'] as const;
type QualityRating = typeof VALID_QUALITY_RATINGS[number];

// PATCH /api/examples/[id] — update user-layer fields only
export async function PATCH(
  request: Request,
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;

  // Build update payload — only allow user-layer fields
  const updates: Partial<typeof example> & { updatedAt?: string } = {
    updatedAt: new Date().toISOString(),
  };

  if (typeof b.question === 'string' && b.question.trim()) {
    updates.question = b.question.trim();
  }
  if (typeof b.answer === 'string' && b.answer.trim()) {
    updates.answer = b.answer.trim();
  }
  if (b.qualityRating === null || (typeof b.qualityRating === 'string' && VALID_QUALITY_RATINGS.includes(b.qualityRating as QualityRating))) {
    updates.qualityRating = b.qualityRating as QualityRating | null;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'starSituation')) {
    updates.starSituation = typeof b.starSituation === 'string' ? b.starSituation : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'starTask')) {
    updates.starTask = typeof b.starTask === 'string' ? b.starTask : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'starAction')) {
    updates.starAction = typeof b.starAction === 'string' ? b.starAction : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'starResult')) {
    updates.starResult = typeof b.starResult === 'string' ? b.starResult : null;
  }
  if (Object.prototype.hasOwnProperty.call(b, 'starReflection')) {
    updates.starReflection = typeof b.starReflection === 'string' ? b.starReflection : null;
  }

  try {
    // Handle tag replacement if tagIds provided
    if (Array.isArray(b.tagIds)) {
      const tagIds = (b.tagIds as unknown[]).filter((id): id is string => typeof id === 'string');
      // Delete existing tags
      await db.delete(exampleTags).where(eq(exampleTags.exampleId, params.id));
      // Insert new tags
      if (tagIds.length > 0) {
        await db.insert(exampleTags).values(
          tagIds.map(tagId => ({ exampleId: params.id, tagId }))
        );
      }
    }

    const [updated] = await db.update(examples)
      .set(updates)
      .where(eq(examples.id, params.id))
      .returning();

    // Fetch joined tags
    const tagJoins = await db
      .select({
        tagId: exampleTags.tagId,
        name: tags.name,
        isSystem: tags.isSystem,
        userId: tags.userId,
      })
      .from(exampleTags)
      .innerJoin(tags, eq(exampleTags.tagId, tags.id))
      .where(eq(exampleTags.exampleId, params.id));

    // Regenerate embedding async if question or answer changed — do not await
    const questionChanged = typeof b.question === 'string' && b.question.trim();
    const answerChanged = typeof b.answer === 'string' && b.answer.trim();
    if (questionChanged || answerChanged) {
      const newQuestion = (updates.question ?? example.question) as string;
      const newAnswer = (updates.answer ?? example.answer) as string;
      generateEmbedding(formatExampleForEmbedding(newQuestion, newAnswer), 'document')
        .then(embedding => upsertExampleVector(params.id, userId, embedding))
        .catch(err => console.error('Async embedding update error:', err));
    }

    return Response.json({
      example: {
        ...updated,
        tags: tagJoins.map(tj => ({
          id: tj.tagId,
          name: tj.name,
          isSystem: tj.isSystem ?? false,
          userId: tj.userId,
        })),
      },
    });
  } catch (err) {
    console.error('PATCH /api/examples/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/examples/[id]
export async function DELETE(
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

  try {
    await db.delete(examples).where(eq(examples.id, params.id));
    // Delete vector — synchronous, best-effort
    await deleteExampleVector(params.id).catch(err =>
      console.error('Vector delete error (non-fatal):', err)
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/examples/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
