import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { examples, exampleTags, tags, transcripts } from '@/lib/db/schema';
import { eq, and, like, desc, inArray, or, isNull } from 'drizzle-orm';
import { decryptExampleFields, isEncryptionEnabled } from '@/lib/encryption';

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
