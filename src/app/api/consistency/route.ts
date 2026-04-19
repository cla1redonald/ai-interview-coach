import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { consistencyEntries } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_TOPICS = ['compensation', 'leaving_reason', 'start_date', 'role_scope'] as const;
type ConsistencyTopic = typeof VALID_TOPICS[number];

// GET /api/consistency — list all consistency entries for the user, grouped by topic
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const rows = await db
      .select()
      .from(consistencyEntries)
      .where(eq(consistencyEntries.userId, userId))
      .orderBy(desc(consistencyEntries.interviewDate));

    const byTopic: Record<ConsistencyTopic, typeof rows> = {
      compensation: [],
      leaving_reason: [],
      start_date: [],
      role_scope: [],
    };

    for (const row of rows) {
      const topic = row.topic as ConsistencyTopic;
      if (VALID_TOPICS.includes(topic)) {
        byTopic[topic].push(row);
      }
    }

    return Response.json({ entries: rows, by_topic: byTopic });
  } catch (err) {
    console.error('GET /api/consistency error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/consistency — create a manual consistency entry
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  if (!checkRateLimit(ip, 5)) {
    return Response.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const company = typeof b.company === 'string' ? b.company.trim() : '';
  const topic = typeof b.topic === 'string' ? b.topic.trim() : '';
  const claim = typeof b.claim === 'string' ? b.claim.trim() : '';
  const interviewDate = typeof b.interviewDate === 'string' ? b.interviewDate || null : null;

  if (!company) {
    return Response.json({ error: 'company is required' }, { status: 400 });
  }
  if (company.length > 100) {
    return Response.json({ error: 'Company name too long (max 100 characters)' }, { status: 400 });
  }
  if (!claim) {
    return Response.json({ error: 'claim is required' }, { status: 400 });
  }
  if (claim.length > 2000) {
    return Response.json({ error: 'Claim too long (max 2,000 characters)' }, { status: 400 });
  }
  if (topic.length > 200) {
    return Response.json({ error: 'Topic too long (max 200 characters)' }, { status: 400 });
  }
  if (!VALID_TOPICS.includes(topic as ConsistencyTopic)) {
    return Response.json(
      { error: `topic must be one of: ${VALID_TOPICS.join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const [inserted] = await db
      .insert(consistencyEntries)
      .values({
        userId,
        company,
        topic,
        claim,
        interviewDate,
        exampleId: null,
      })
      .returning();

    return Response.json({ entry: inserted }, { status: 201 });
  } catch (err) {
    console.error('POST /api/consistency error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
