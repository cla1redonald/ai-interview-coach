import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags } from '@/lib/db/schema';
import { eq, and, like, desc, count, inArray, or } from 'drizzle-orm';

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
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  try {
    const conditions: ReturnType<typeof eq>[] = [eq(examples.userId, userId)];

    if (transcriptId) {
      conditions.push(eq(examples.transcriptId, transcriptId));
    }
    if (quality === 'unrated') {
      // handled separately via isNull
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

    const [rows, totalResult] = await Promise.all([
      db.select()
        .from(examples)
        .where(whereClause)
        .orderBy(desc(examples.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() })
        .from(examples)
        .where(whereClause),
    ]);

    // Join tags for each example
    const exampleIds = rows.map(r => r.id);
    let tagJoins: Array<{ exampleId: string; tagId: string; name: string; isSystem: boolean | null; userId: string | null }> = [];

    if (exampleIds.length > 0) {
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
        .where(inArray(exampleTags.exampleId, exampleIds));
    }

    const tagsByExampleId = new Map<string, typeof tagJoins>();
    for (const tj of tagJoins) {
      if (!tagsByExampleId.has(tj.exampleId)) {
        tagsByExampleId.set(tj.exampleId, []);
      }
      tagsByExampleId.get(tj.exampleId)!.push(tj);
    }

    const enriched = rows.map(r => ({
      ...r,
      tags: (tagsByExampleId.get(r.id) ?? []).map(tj => ({
        id: tj.tagId,
        name: tj.name,
        isSystem: tj.isSystem ?? false,
        userId: tj.userId,
      })),
    }));

    return Response.json({
      examples: enriched,
      total: totalResult[0]?.total ?? 0,
    });
  } catch (err) {
    console.error('GET /api/examples error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
