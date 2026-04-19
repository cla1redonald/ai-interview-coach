import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { batchRuns, jobApplications } from '@/lib/db/schema';
import { createId } from '@paralleldrive/cuid2';
import {
  isEncryptionEnabled,
  encryptJobDescription,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import { parseMarkdownListings } from '@/lib/batch/parse-markdown';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_LISTINGS = 10;

// ─── POST /api/batch ──────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  // Batch creation — 2 req/min per IP
  if (!checkRateLimit(ip, 2)) {
    return Response.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const markdown = typeof b.markdown === 'string' ? b.markdown.trim() : '';
  if (!markdown) {
    return Response.json({ error: 'markdown is required' }, { status: 400 });
  }

  const fitThreshold =
    typeof b.fitThreshold === 'number'
      ? Math.max(0, Math.min(100, b.fitThreshold))
      : 70;

  // ─── Parse listings ────────────────────────────────────────────────────────

  const listings = parseMarkdownListings(markdown);

  if (listings.length === 0) {
    return Response.json(
      { error: 'No listings found. Use ## headings to separate each job.' },
      { status: 400 }
    );
  }

  if (listings.length > MAX_LISTINGS) {
    return Response.json(
      {
        error: `Too many listings. Maximum is ${MAX_LISTINGS}, got ${listings.length}.`,
      },
      { status: 400 }
    );
  }

  // ─── Validate each listing has at least a jobTitle ────────────────────────

  for (const listing of listings) {
    if (!listing.jobTitle) {
      return Response.json(
        { error: 'Each listing must have a job title in the ## heading.' },
        { status: 400 }
      );
    }
    // companyName defaults to empty string if unparseable — tolerated
  }

  // ─── Create batch row ─────────────────────────────────────────────────────

  const dbNow = new Date().toISOString();
  const batchId = createId();

  try {
    const [batch] = await db
      .insert(batchRuns)
      .values({
        id: batchId,
        userId,
        inputMarkdown: markdown,
        status: 'pending',
        totalJobs: listings.length,
        completedJobs: 0,
        failedJobs: 0,
        fitThreshold,
        summaryTable: null,
        warnings: null,
        updatedAt: dbNow,
      })
      .returning();

    // ─── Create application rows ─────────────────────────────────────────────

    const applicationInserts = listings.map((listing) => {
      const encryptedFields = isEncryptionEnabled()
        ? encryptJobDescription({ jobDescription: listing.jobDescription || '' })
        : { jobDescription: listing.jobDescription || '' };

      return {
        id: createId(),
        userId,
        jobTitle: listing.jobTitle,
        companyName: listing.companyName || listing.jobTitle,
        jobUrl: listing.jobUrl,
        jobDescription: encryptedFields.jobDescription,
        salary: listing.salary,
        location: listing.location,
        status: 'researching' as const,
        batchId,
        updatedAt: dbNow,
      };
    });

    const insertedApps = await db
      .insert(jobApplications)
      .values(applicationInserts)
      .returning();

    const applicationSummaries = insertedApps.map((app) => ({
      id: app.id,
      jobTitle: app.jobTitle,
      companyName: app.companyName,
    }));

    return Response.json(
      {
        batch: {
          id: batch.id,
          userId: batch.userId,
          status: batch.status,
          totalJobs: batch.totalJobs,
          completedJobs: batch.completedJobs,
          failedJobs: batch.failedJobs,
          fitThreshold: batch.fitThreshold,
          summaryTable: batch.summaryTable,
          warnings: batch.warnings ? JSON.parse(batch.warnings) : [],
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
        },
        applications: applicationSummaries,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/batch error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
