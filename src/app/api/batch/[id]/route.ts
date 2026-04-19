import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { batchRuns, jobApplications, generatedMaterials } from '@/lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const maxDuration = 30;

// ─── GET /api/batch/[id] ─────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // ─── Load batch + ownership check ────────────────────────────────────────

  const [batch] = await db
    .select()
    .from(batchRuns)
    .where(
      and(
        eq(batchRuns.id, params.id),
        eq(batchRuns.userId, userId)
      )
    )
    .limit(1);

  if (!batch) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // ─── Load all applications for this batch ────────────────────────────────

  const applications = await db
    .select()
    .from(jobApplications)
    .where(
      and(
        eq(jobApplications.batchId, params.id),
        eq(jobApplications.userId, userId)
      )
    );

  // ─── Check materialsGenerated for each application ───────────────────────
  // One count query per application — acceptable for batches up to 10 apps.

  const applicationsWithMaterials = await Promise.all(
    applications.map(async (app) => {
      const [materialCount] = await db
        .select({ total: count() })
        .from(generatedMaterials)
        .where(
          and(
            eq(generatedMaterials.jobApplicationId, app.id),
            eq(generatedMaterials.userId, userId)
          )
        );

      return {
        ...app,
        materialsGenerated: (materialCount?.total ?? 0) > 0,
      };
    })
  );

  return Response.json({
    batch: {
      id: batch.id,
      userId: batch.userId,
      status: batch.status,
      totalJobs: batch.totalJobs,
      completedJobs: batch.completedJobs,
      failedJobs: batch.failedJobs,
      fitThreshold: batch.fitThreshold,
      summaryTable: batch.summaryTable,
      warnings: batch.warnings ? (JSON.parse(batch.warnings) as string[]) : [],
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    },
    applications: applicationsWithMaterials,
  });
}
