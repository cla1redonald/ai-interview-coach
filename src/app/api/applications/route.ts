import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications } from '@/lib/db/schema';
import { eq, and, like, desc, count, gte, sql } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  encryptJobDescription,
  decryptJobDescription,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import { getJinaReaderClient } from '@/lib/services';
import type { ApplicationStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES: ApplicationStatus[] = [
  'researching', 'assessed', 'applying',
  'applied', 'interviewing', 'rejected',
  'offer', 'withdrawn',
];

// ─── GET /api/applications — list with filtering and pagination ───────────────

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const batchId = searchParams.get('batch_id');
  const company = searchParams.get('company');
  const minFit = searchParams.get('min_fit');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
  const order = searchParams.get('order') ?? 'created_at_desc';

  try {
    // Build where conditions — always scope to userId
    const conditions: ReturnType<typeof eq>[] = [eq(jobApplications.userId, userId)];

    if (status && VALID_STATUSES.includes(status as ApplicationStatus)) {
      conditions.push(eq(jobApplications.status, status));
    }
    if (batchId) {
      conditions.push(eq(jobApplications.batchId, batchId));
    }
    if (company) {
      conditions.push(like(jobApplications.companyName, `%${company}%`));
    }
    if (minFit) {
      const minFitNum = parseInt(minFit, 10);
      if (!isNaN(minFitNum)) {
        conditions.push(gte(jobApplications.fitScoreOverall, minFitNum) as ReturnType<typeof eq>);
      }
    }

    const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

    // Determine order column
    let orderClause;
    if (order === 'fit_score_desc') {
      orderClause = desc(jobApplications.fitScoreOverall);
    } else if (order === 'company_asc') {
      orderClause = sql`${jobApplications.companyName} ASC`;
    } else {
      // Default: created_at_desc
      orderClause = desc(jobApplications.createdAt);
    }

    const [rows, totalResult] = await Promise.all([
      db.select()
        .from(jobApplications)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      db.select({ total: count() })
        .from(jobApplications)
        .where(whereClause),
    ]);

    // Decrypt jobDescription if encryption is enabled
    const decrypted = isEncryptionEnabled()
      ? rows.map(row => ({
          ...row,
          ...decryptJobDescription({ jobDescription: row.jobDescription }),
        }))
      : rows;

    return Response.json({
      applications: decrypted,
      total: totalResult[0]?.total ?? 0,
    });
  } catch (err) {
    console.error('GET /api/applications error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// ─── POST /api/applications — create a new job application ───────────────────

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

  // ─── Validate required fields ─────────────────────────────────────────────

  const jobTitle = typeof b.jobTitle === 'string' ? b.jobTitle.trim() : '';
  if (!jobTitle) {
    return Response.json({ error: 'jobTitle is required' }, { status: 400 });
  }
  if (jobTitle.length > 200) {
    return Response.json({ error: 'jobTitle max 200 characters' }, { status: 400 });
  }

  let companyName = typeof b.companyName === 'string' ? b.companyName.trim() : '';
  if (companyName.length > 200) {
    return Response.json({ error: 'companyName max 200 characters' }, { status: 400 });
  }

  const jobUrl = typeof b.jobUrl === 'string' ? b.jobUrl.trim() : null;
  let jobDescription = typeof b.jobDescription === 'string' ? b.jobDescription.trim() : '';

  // At least one of jobDescription or jobUrl is required
  if (!jobDescription && !jobUrl) {
    return Response.json(
      { error: 'At least one of jobDescription or jobUrl is required' },
      { status: 400 }
    );
  }

  if (jobDescription.length > 50000) {
    return Response.json({ error: 'jobDescription max 50,000 characters' }, { status: 400 });
  }

  const salary = typeof b.salary === 'string' ? b.salary.trim() : null;
  if (salary && salary.length > 100) {
    return Response.json({ error: 'salary max 100 characters' }, { status: 400 });
  }

  const location = typeof b.location === 'string' ? b.location.trim() : null;
  if (location && location.length > 200) {
    return Response.json({ error: 'location max 200 characters' }, { status: 400 });
  }

  // ─── URL scraping (only when jobDescription is absent) ───────────────────

  let scraped = false;
  let warning: string | undefined;

  if (jobUrl && !jobDescription) {
    try {
      const jina = getJinaReaderClient();
      const result = await jina.scrapeJobListing(jobUrl);
      jobDescription = result.description ?? '';
      scraped = true;

      // Auto-extract company name from the scraped listing if not provided
      if (!companyName && result.company) {
        companyName = result.company.slice(0, 200);
      }
    } catch (scrapeErr) {
      console.warn('Job listing scrape failed (non-fatal):', scrapeErr);
      warning = 'Could not scrape job listing — application created with empty job description.';
      jobDescription = '';
    }
  }

  // companyName is required — must have it by now
  if (!companyName) {
    return Response.json({ error: 'companyName is required' }, { status: 400 });
  }

  // ─── Encrypt and insert ───────────────────────────────────────────────────

  try {
    const now = new Date().toISOString();
    const encryptedFields = isEncryptionEnabled()
      ? encryptJobDescription({ jobDescription })
      : { jobDescription };

    const [inserted] = await db.insert(jobApplications)
      .values({
        userId,
        jobTitle,
        companyName,
        jobUrl: jobUrl || null,
        jobDescription: encryptedFields.jobDescription,
        salary: salary || null,
        location: location || null,
        updatedAt: now,
      })
      .returning();

    // Return decrypted jobDescription in the response
    const result = isEncryptionEnabled()
      ? { ...inserted, jobDescription }
      : inserted;

    return Response.json(
      { application: result, scraped, ...(warning ? { warning } : {}) },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/applications error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
