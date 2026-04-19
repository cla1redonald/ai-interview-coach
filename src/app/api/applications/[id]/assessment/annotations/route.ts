import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, fitAssessments } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';

// ─── PATCH /api/applications/[id]/assessment/annotations ──────────────────────
// Persists user-authored dismissed red flags and dimension annotations.
// These are user data — they survive force re-assessment.

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  if (!checkRateLimit(ip, 20)) {
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
  const dimensionAnnotations =
    b.dimensionAnnotations !== undefined
      ? (b.dimensionAnnotations as Record<string, string>)
      : undefined;
  const dismissedRedFlags =
    b.dismissedRedFlags !== undefined
      ? (b.dismissedRedFlags as string[])
      : undefined;

  if (dimensionAnnotations === undefined && dismissedRedFlags === undefined) {
    return Response.json(
      { error: 'Provide at least one of: dimensionAnnotations, dismissedRedFlags' },
      { status: 400 }
    );
  }

  // ─── Verify application ownership ──────────────────────────────────────────

  const [application] = await db
    .select({ id: jobApplications.id })
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      )
    )
    .limit(1);

  if (!application) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // ─── Find the assessment row ─────────────────────────────────────────────────

  const [existing] = await db
    .select()
    .from(fitAssessments)
    .where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    )
    .limit(1);

  if (!existing) {
    return Response.json(
      { error: 'No assessment found for this application.' },
      { status: 404 }
    );
  }

  // ─── Build update payload ────────────────────────────────────────────────────

  const updateFields: Record<string, string> = {
    updatedAt: new Date().toISOString(),
  };

  if (dimensionAnnotations !== undefined) {
    updateFields.dimensionAnnotations = JSON.stringify(dimensionAnnotations);
  }
  if (dismissedRedFlags !== undefined) {
    updateFields.dismissedRedFlags = JSON.stringify(dismissedRedFlags);
  }

  // ─── Persist ─────────────────────────────────────────────────────────────────

  const [updated] = await db
    .update(fitAssessments)
    .set(updateFields)
    .where(
      and(
        eq(fitAssessments.jobApplicationId, params.id),
        eq(fitAssessments.userId, userId)
      )
    )
    .returning();

  // Deserialise JSON fields for the response
  return Response.json({
    assessment: {
      ...updated,
      dismissedRedFlags: updated.dismissedRedFlags
        ? (JSON.parse(updated.dismissedRedFlags) as string[])
        : [],
      dimensionAnnotations: updated.dimensionAnnotations
        ? (JSON.parse(updated.dimensionAnnotations) as Record<string, string>)
        : {},
    },
  });
}
