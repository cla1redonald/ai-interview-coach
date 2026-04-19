import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, companyResearch, fitAssessments, generatedMaterials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  decryptJobDescription,
  decryptResearchFields,
} from '@/lib/encryption';
import type { ApplicationStatus } from '@/lib/types';

export const runtime = 'nodejs';

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_STATUSES: ApplicationStatus[] = [
  'researching', 'assessed', 'applying',
  'applied', 'interviewing', 'rejected',
  'offer', 'withdrawn',
];

// ─── GET /api/applications/[id] — full detail with related data ───────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const [application] = await db.select()
      .from(jobApplications)
      .where(and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      ))
      .limit(1);

    if (!application) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    // Decrypt jobDescription
    const decryptedApplication = isEncryptionEnabled()
      ? { ...application, ...decryptJobDescription({ jobDescription: application.jobDescription }) }
      : application;

    // Load related data in parallel
    const [researchRows, assessmentRows, materialRows] = await Promise.all([
      db.select().from(companyResearch)
        .where(and(
          eq(companyResearch.jobApplicationId, params.id),
          eq(companyResearch.userId, userId)
        ))
        .limit(1),
      db.select().from(fitAssessments)
        .where(and(
          eq(fitAssessments.jobApplicationId, params.id),
          eq(fitAssessments.userId, userId)
        ))
        .limit(1),
      db.select().from(generatedMaterials)
        .where(and(
          eq(generatedMaterials.jobApplicationId, params.id),
          eq(generatedMaterials.userId, userId)
        )),
    ]);

    // Decrypt research sensitive fields
    const research = researchRows[0] ?? null;
    const decryptedResearch = research && isEncryptionEnabled()
      ? {
          ...research,
          ...decryptResearchFields({
            recentNews: research.recentNews,
            cultureSignals: research.cultureSignals,
            keyPeople: research.keyPeople,
          }),
        }
      : research;

    return Response.json({
      application: decryptedApplication,
      research: decryptedResearch,
      assessment: assessmentRows[0] ?? null,
      materials: materialRows,
    });
  } catch (err) {
    console.error('GET /api/applications/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// ─── PATCH /api/applications/[id] — update user-editable fields ──────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const [existing] = await db.select({ id: jobApplications.id })
    .from(jobApplications)
    .where(and(
      eq(jobApplications.id, params.id),
      eq(jobApplications.userId, userId)
    ))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const now = new Date().toISOString();

  // Build update payload — only allow user-editable fields
  const updates: Record<string, unknown> = { updatedAt: now };

  if (typeof b.jobTitle === 'string' && b.jobTitle.trim()) {
    const trimmed = b.jobTitle.trim();
    if (trimmed.length > 200) {
      return Response.json({ error: 'jobTitle max 200 characters' }, { status: 400 });
    }
    updates.jobTitle = trimmed;
  }

  if (typeof b.companyName === 'string' && b.companyName.trim()) {
    const trimmed = b.companyName.trim();
    if (trimmed.length > 200) {
      return Response.json({ error: 'companyName max 200 characters' }, { status: 400 });
    }
    updates.companyName = trimmed;
  }

  if (Object.prototype.hasOwnProperty.call(b, 'salary')) {
    updates.salary = typeof b.salary === 'string' ? (b.salary.slice(0, 100) || null) : null;
  }

  if (Object.prototype.hasOwnProperty.call(b, 'location')) {
    updates.location = typeof b.location === 'string' ? (b.location.slice(0, 200) || null) : null;
  }

  if (Object.prototype.hasOwnProperty.call(b, 'notes')) {
    updates.notes = typeof b.notes === 'string' ? b.notes || null : null;
  }

  if (typeof b.status === 'string') {
    if (!VALID_STATUSES.includes(b.status as ApplicationStatus)) {
      return Response.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }
    updates.status = b.status;
  }

  try {
    const [updated] = await db.update(jobApplications)
      .set(updates)
      .where(and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      ))
      .returning();

    // Decrypt jobDescription for response
    const result = isEncryptionEnabled()
      ? { ...updated, ...decryptJobDescription({ jobDescription: updated.jobDescription }) }
      : updated;

    return Response.json({ application: result });
  } catch (err) {
    console.error('PATCH /api/applications/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// ─── DELETE /api/applications/[id] — delete application (CASCADE handles rows) ─

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  const [existing] = await db.select({ id: jobApplications.id })
    .from(jobApplications)
    .where(and(
      eq(jobApplications.id, params.id),
      eq(jobApplications.userId, userId)
    ))
    .limit(1);

  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    await db.delete(jobApplications)
      .where(and(
        eq(jobApplications.id, params.id),
        eq(jobApplications.userId, userId)
      ));

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/applications/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
