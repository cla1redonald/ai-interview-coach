import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags, transcripts } from '@/lib/db/schema';
import { eq, and, like, desc, inArray, or, isNull } from 'drizzle-orm';
import { decryptExampleFields, encryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/examples — list user's examples with optional filtering + joined tags
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const transcriptId = searchParams.get('transcript_id');
  const quality = searchParams.get('quality');
  const keyword = searchParams.get('q');
  const company = searchParams.get('company');
  const tagIds = searchParams.getAll('tag_id');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  try {
    // Build where conditions — always scope to userId
    const conditions: ReturnType<typeof eq>[] = [eq(examples.userId, userId)];

    if (transcriptId) {
      conditions.push(eq(examples.transcriptId, transcriptId));
    }

    if (quality === 'unrated') {
      conditions.push(isNull(examples.qualityRating) as ReturnType<typeof eq>);
    } else if (quality && ['strong', 'weak', 'neutral'].includes(quality)) {
      conditions.push(eq(examples.qualityRating, quality));
    }

    if (keyword) {
      conditions.push(
        or(
          like(examples.question, `%${keyword}%`),
          like(examples.answer, `%${keyword}%`)
        ) as ReturnType<typeof eq>
      );
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    let rows = await db.select()
      .from(examples)
      .where(whereClause)
      .orderBy(desc(examples.createdAt))
      .limit(500); // fetch more for tag/company filtering below

    // Filter by tag IDs — post-query join filter (SQLite doesn't support EXISTS easily with Drizzle)
    const allExampleIds = rows.map(r => r.id);

    // Fetch all tag joins for these examples
    let tagJoins: Array<{ exampleId: string; tagId: string; name: string; isSystem: boolean | null; userId: string | null }> = [];
    if (allExampleIds.length > 0) {
      tagJoins = await db
        .select({
          exampleId: exampleTags.exampleId,
          tagId: exampleTags.tagId,
          name: tags.name,
          isSystem: tags.isSystem,
          userId: tags.userId,
        })
        .from(exampleTags)
        .innerJoin(tags, eq(exampleTags.tagId, tags.id))
        .where(inArray(exampleTags.exampleId, allExampleIds));
    }

    const tagsByExampleId = new Map<string, typeof tagJoins>();
    for (const tj of tagJoins) {
      if (!tagsByExampleId.has(tj.exampleId)) {
        tagsByExampleId.set(tj.exampleId, []);
      }
      tagsByExampleId.get(tj.exampleId)!.push(tj);
    }

    // Filter by tagIds if provided — example must have ALL specified tags
    if (tagIds.length > 0) {
      rows = rows.filter(row => {
        const exTags = tagsByExampleId.get(row.id) ?? [];
        const exTagIds = exTags.map(t => t.tagId);
        return tagIds.every(tid => exTagIds.includes(tid));
      });
    }

    // Filter by company — join to transcripts to get company name
    if (company) {
      // Fetch company info from transcripts for this user's examples that have a transcriptId
      const transcriptIds = Array.from(new Set(rows.map(r => r.transcriptId).filter(Boolean) as string[]));
      const transcriptCompanies = new Map<string, string | null>();
      if (transcriptIds.length > 0) {
        const transcriptRows = await db.select({ id: transcripts.id, company: transcripts.company })
          .from(transcripts)
          .where(inArray(transcripts.id, transcriptIds));
        for (const tr of transcriptRows) {
          transcriptCompanies.set(tr.id, tr.company);
        }
      }
      const lowerCompany = company.toLowerCase();
      rows = rows.filter(row => {
        if (!row.transcriptId) return false;
        const c = transcriptCompanies.get(row.transcriptId);
        return c?.toLowerCase().includes(lowerCompany) ?? false;
      });
    }

    const total = rows.length;
    const paginated = rows.slice(offset, offset + limit);

    // Enrich with tags
    const enriched = paginated.map(r => ({
      ...r,
      tags: (tagsByExampleId.get(r.id) ?? []).map(tj => ({
        id: tj.tagId,
        name: tj.name,
        isSystem: tj.isSystem ?? false,
        userId: tj.userId,
      })),
    }));

    // Also fetch transcript companies for enriched examples (for display)
    const enrichedTranscriptIds = Array.from(new Set(enriched.map(r => r.transcriptId).filter(Boolean) as string[]));
    const transcriptMap = new Map<string, { company: string | null }>();
    if (enrichedTranscriptIds.length > 0) {
      const tRows = await db.select({ id: transcripts.id, company: transcripts.company })
        .from(transcripts)
        .where(inArray(transcripts.id, enrichedTranscriptIds));
      for (const tr of tRows) {
        transcriptMap.set(tr.id, { company: tr.company });
      }
    }

    const final = enriched.map(r => {
      const decrypted = isEncryptionEnabled()
        ? decryptExampleFields({ question: r.question, answer: r.answer })
        : { question: r.question, answer: r.answer };
      return {
        ...r,
        ...decrypted,
        company: r.transcriptId ? (transcriptMap.get(r.transcriptId)?.company ?? null) : null,
      };
    });

    return Response.json({ examples: final, total });
  } catch (err) {
    console.error('GET /api/examples error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/examples — create a new example directly (e.g. from practice session)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkRateLimit(ip, 20)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { question, answer, transcriptId, qualityRating, tagIds } = body as {
      question: unknown;
      answer: unknown;
      transcriptId: unknown;
      qualityRating: unknown;
      tagIds: unknown;
    };

    // Validate required fields
    if (typeof question !== 'string' || !question.trim()) {
      return Response.json({ error: 'Question and answer are required' }, { status: 400 });
    }
    if (typeof answer !== 'string' || !answer.trim()) {
      return Response.json({ error: 'Question and answer are required' }, { status: 400 });
    }
    if (question.length > 2000) {
      return Response.json({ error: 'Question too long (max 2000 chars)' }, { status: 400 });
    }
    if (answer.length > 5000) {
      return Response.json({ error: 'Answer too long (max 5000 chars)' }, { status: 400 });
    }

    // If transcriptId provided, verify it belongs to this user
    if (transcriptId && typeof transcriptId === 'string') {
      const [transcript] = await db.select({ id: transcripts.id })
        .from(transcripts)
        .where(and(eq(transcripts.id, transcriptId), eq(transcripts.userId, userId)))
        .limit(1);
      if (!transcript) {
        return Response.json({ error: 'Transcript not found' }, { status: 400 });
      }
    }

    // Encrypt fields if encryption is enabled
    const finalFields = isEncryptionEnabled()
      ? encryptExampleFields({ question: question.trim(), answer: answer.trim() })
      : { question: question.trim(), answer: answer.trim() };

    // Insert example
    const [created] = await db.insert(examples).values({
      userId,
      transcriptId: (typeof transcriptId === 'string' && transcriptId) ? transcriptId : null,
      question: finalFields.question,
      answer: finalFields.answer,
      qualityRating: (typeof qualityRating === 'string' && qualityRating) ? qualityRating : null,
      sourcePosition: null,
    }).returning();

    // Auto-apply "Practice session" tag when there is no transcriptId
    if (!transcriptId) {
      const [practiceTag] = await db.select({ id: tags.id })
        .from(tags)
        .where(and(isNull(tags.userId), eq(tags.name, 'Practice session')))
        .limit(1);
      if (practiceTag) {
        await db.insert(exampleTags).values({
          exampleId: created.id,
          tagId: practiceTag.id,
        }).onConflictDoNothing();
      }
    }

    // Apply additional tags if provided
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      const typedTagIds = tagIds.filter((t): t is string => typeof t === 'string');
      if (typedTagIds.length > 0) {
        const validTags = await db.select({ id: tags.id })
          .from(tags)
          .where(
            and(
              inArray(tags.id, typedTagIds),
              or(isNull(tags.userId), eq(tags.userId, userId))
            )
          );
        for (const vt of validTags) {
          await db.insert(exampleTags).values({
            exampleId: created.id,
            tagId: vt.id,
          }).onConflictDoNothing();
        }
      }
    }

    // Generate embedding for search (non-blocking — don't fail the request)
    try {
      const { formatExampleForEmbedding, generateEmbedding } = await import('@/lib/embeddings/openai');
      const { upsertExampleVector } = await import('@/lib/vector/upstash');
      const embeddingText = formatExampleForEmbedding(question.trim(), answer.trim());
      const vector = await generateEmbedding(embeddingText);
      await upsertExampleVector(created.id, userId, vector);
    } catch (embeddingErr) {
      console.warn(`Embedding generation failed for example ${created.id}:`, embeddingErr);
      // Don't fail the request — backfill can catch this later
    }

    return Response.json({ example: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/examples error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
