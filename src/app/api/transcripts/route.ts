import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts } from '@/lib/db/schema';
import { eq, and, like, desc, count } from 'drizzle-orm';
import { encryptTranscriptFields, decryptTranscriptFields, isEncryptionEnabled } from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_ROUNDS = ['screening', 'first', 'second', 'final', 'other'] as const;
type InterviewRound = typeof VALID_ROUNDS[number];

// GET /api/transcripts — list user's transcripts with optional filtering
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const company = searchParams.get('company');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  try {
    // Build where conditions
    const conditions = [eq(transcripts.userId, userId)];
    if (company) {
      conditions.push(like(transcripts.company, `%${company}%`));
    }
    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    const [rows, totalResult] = await Promise.all([
      db.select()
        .from(transcripts)
        .where(whereClause)
        .orderBy(desc(transcripts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() })
        .from(transcripts)
        .where(whereClause),
    ]);

    const decrypted = isEncryptionEnabled()
      ? rows.map(row => ({ ...row, ...decryptTranscriptFields({ rawText: row.rawText }) }))
      : rows;

    return Response.json({
      transcripts: decrypted,
      total: totalResult[0]?.total ?? 0,
    });
  } catch (err) {
    console.error('GET /api/transcripts error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/transcripts — create a new transcript
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkRateLimit(ip, 10)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  const rawText = typeof b.rawText === 'string' ? b.rawText.trim() : '';

  if (!title) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  if (title.length > 200) {
    return Response.json({ error: 'Title too long (max 200 characters)' }, { status: 400 });
  }
  if (!rawText || rawText.length < 10) {
    return Response.json({ error: 'rawText must be at least 10 characters' }, { status: 400 });
  }
  if (rawText.length > 100000) {
    return Response.json({ error: 'Transcript too long (max 100,000 characters)' }, { status: 400 });
  }

  const interviewRound = typeof b.interviewRound === 'string' ? b.interviewRound : null;
  if (interviewRound && !VALID_ROUNDS.includes(interviewRound as InterviewRound)) {
    return Response.json(
      { error: `interviewRound must be one of: ${VALID_ROUNDS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const now = new Date().toISOString();
    const encryptedFields = isEncryptionEnabled()
      ? encryptTranscriptFields({ rawText })
      : { rawText };

    const [inserted] = await db.insert(transcripts)
      .values({
        userId,
        title,
        rawText: encryptedFields.rawText,
        company: typeof b.company === 'string' ? b.company.trim() || null : null,
        interviewerName: typeof b.interviewerName === 'string' ? b.interviewerName.trim() || null : null,
        interviewerRole: typeof b.interviewerRole === 'string' ? b.interviewerRole.trim() || null : null,
        interviewDate: typeof b.interviewDate === 'string' ? b.interviewDate || null : null,
        interviewRound: (interviewRound as InterviewRound) ?? null,
        updatedAt: now,
      })
      .returning();

    const result = isEncryptionEnabled()
      ? { ...inserted, ...decryptTranscriptFields({ rawText: inserted.rawText }) }
      : inserted;

    return Response.json({ transcript: result }, { status: 201 });
  } catch (err) {
    console.error('POST /api/transcripts error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
