import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { consistencyEntries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { checkRateLimit } from '@/lib/rate-limit';

const VALID_TOPICS = ['compensation', 'leaving_reason', 'start_date', 'role_scope'] as const;
type ConsistencyTopic = typeof VALID_TOPICS[number];

const TOPIC_LABELS: Record<ConsistencyTopic, string> = {
  compensation: 'Compensation Expectations',
  leaving_reason: 'Reasons for Leaving',
  start_date: 'Start Date / Availability',
  role_scope: 'Current Role Scope',
};

interface ConsistencyEntry {
  id: string;
  userId: string;
  exampleId: string | null;
  company: string;
  topic: string;
  claim: string;
  interviewDate: string | null;
  createdAt: string;
}

interface ConsistencyConflict {
  topic: ConsistencyTopic;
  entries: ConsistencyEntry[];
  conflict_description: string;
}

const MODEL = 'claude-sonnet-4-5-20250929';

async function detectConflicts(
  topic: ConsistencyTopic,
  entries: ConsistencyEntry[]
): Promise<ConsistencyConflict | null> {
  // Only check topics with entries from 2+ different companies
  const companies = new Set(entries.map(e => e.company));
  if (companies.size < 2) return null;

  const topicLabel = TOPIC_LABELS[topic];
  const entriesText = entries
    .map(
      e =>
        `- ${e.company} (${e.interviewDate ?? 'date unknown'}): "${e.claim}"`
    )
    .join('\n');

  const prompt = `You are reviewing claims a job candidate made to different companies about "${topicLabel}".

Claims:
${entriesText}

Identify if there is a GENUINE contradiction — where materially different information was given.

A contradiction IS:
- Different salary figures that cannot be explained by rounding (e.g. £150k vs £175k)
- Different reasons for leaving (e.g. "redundancy" vs "seeking growth")
- Materially different start date claims (e.g. "1 week" vs "3 months")
- Materially different role scope claims (e.g. "team of 5" vs "team of 30")

A contradiction is NOT:
- Rounding to the nearest £5k (e.g. £175k vs £180k)
- Slightly different phrasing of the same core message
- More detail added to one answer vs another
- Acceptable variations in how something is framed

If there is a genuine contradiction, respond with: CONTRADICTION: [brief description of the conflict]
If there is no genuine contradiction, respond with: NO CONTRADICTION`;

  try {
    const result = await generateText({
      model: anthropic(MODEL),
      maxOutputTokens: 256,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = result.text.trim();

    if (text.startsWith('CONTRADICTION:')) {
      const description = text.replace('CONTRADICTION:', '').trim();
      return {
        topic,
        entries,
        conflict_description: description,
      };
    }
    return null;
  } catch (err) {
    console.error(`Contradiction detection failed for topic ${topic}:`, err);
    return null;
  }
}

// POST /api/consistency/check — run contradiction detection across all user entries
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

  try {
    const rows = await db
      .select()
      .from(consistencyEntries)
      .where(eq(consistencyEntries.userId, userId));

    // Group by topic
    const byTopic: Record<ConsistencyTopic, ConsistencyEntry[]> = {
      compensation: [],
      leaving_reason: [],
      start_date: [],
      role_scope: [],
    };

    for (const row of rows) {
      const topic = row.topic as ConsistencyTopic;
      if (VALID_TOPICS.includes(topic)) {
        byTopic[topic].push(row as ConsistencyEntry);
      }
    }

    // Run contradiction detection in parallel for all topics with 2+ entries
    const conflictResults = await Promise.all(
      VALID_TOPICS.map(topic => detectConflicts(topic, byTopic[topic]))
    );

    const conflicts: ConsistencyConflict[] = conflictResults.filter(
      (c): c is ConsistencyConflict => c !== null
    );

    return Response.json({
      conflicts,
      all_entries_by_topic: byTopic,
    });
  } catch (err) {
    console.error('POST /api/consistency/check error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
