import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, and, inArray, or, isNull } from 'drizzle-orm';
import { decryptExampleFields, isEncryptionEnabled, encrypt, serialise } from '@/lib/encryption';
import { generateEmbedding, formatExampleForEmbedding } from '@/lib/embeddings/openai';
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

      // Verify tag ownership — only allow system tags or user's own tags
      if (tagIds.length > 0) {
        const validTags = await db.select({ id: tags.id }).from(tags)
          .where(and(
            inArray(tags.id, tagIds),
            or(isNull(tags.userId), eq(tags.userId, userId))
          ));
        const validTagIds = new Set(validTags.map(t => t.id));
        const filteredTagIds = tagIds.filter(id => validTagIds.has(id));

        await db.delete(exampleTags).where(eq(exampleTags.exampleId, params.id));
        if (filteredTagIds.length > 0) {
          await db.insert(exampleTags).values(
            filteredTagIds.map(tagId => ({ exampleId: params.id, tagId }))
          );
        }
      } else {
        await db.delete(exampleTags).where(eq(exampleTags.exampleId, params.id));
      }
    }

    // Encrypt question/answer before update if encryption is enabled
    if (isEncryptionEnabled()) {
      if (updates.question !== undefined) {
        updates.question = serialise(encrypt(updates.question as string));
      }
      if (updates.answer !== undefined) {
        updates.answer = serialise(encrypt(updates.answer as string));
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

    // Decrypt for embedding and response — use plaintext from request body (not encrypted DB values)
    const plainQuestion = typeof b.question === 'string' && b.question.trim() ? b.question.trim() : null;
    const plainAnswer = typeof b.answer === 'string' && b.answer.trim() ? b.answer.trim() : null;

    // Regenerate embedding async if question or answer changed — do not await
    if (plainQuestion || plainAnswer) {
      const embeddingQuestion = plainQuestion ?? example.question;
      const embeddingAnswer = plainAnswer ?? example.answer;
      generateEmbedding(formatExampleForEmbedding(embeddingQuestion, embeddingAnswer))
        .then(embedding => upsertExampleVector(params.id, userId, embedding))
        .catch(err => console.error('Async embedding update error:', err));
    }

    // Decrypt returned row before sending to client
    const decryptedUpdated = isEncryptionEnabled()
      ? { ...updated, ...decryptExampleFields({ question: updated.question, answer: updated.answer }) }
      : updated;

    return Response.json({
      example: {
        ...decryptedUpdated,
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
