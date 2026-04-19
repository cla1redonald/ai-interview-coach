import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { jobApplications, generatedMaterials } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isEncryptionEnabled,
  encryptMaterialContent,
  decryptMaterialContent,
} from '@/lib/encryption';
import { checkRateLimit } from '@/lib/rate-limit';
import type { MaterialType } from '@/lib/types';

export const runtime = 'nodejs';

// ─── PATCH /api/applications/[id]/materials/[materialId] ──────────────────────
// Saves user-edited material content. Encrypts on write, decrypts on return.

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; materialId: string } }
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
  const content = typeof b.content === 'string' ? b.content : null;

  if (content === null) {
    return Response.json(
      { error: 'content (string) is required' },
      { status: 400 }
    );
  }

  if (content.trim().length === 0) {
    return Response.json(
      { error: 'content must not be empty' },
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

  // ─── Verify material ownership ───────────────────────────────────────────────

  const [material] = await db
    .select()
    .from(generatedMaterials)
    .where(
      and(
        eq(generatedMaterials.id, params.materialId),
        eq(generatedMaterials.jobApplicationId, params.id),
        eq(generatedMaterials.userId, userId)
      )
    )
    .limit(1);

  if (!material) {
    return Response.json({ error: 'Material not found' }, { status: 404 });
  }

  // ─── Encrypt + persist ───────────────────────────────────────────────────────

  const storedContent = encryptMaterialContent(content);
  const updatedAt = new Date().toISOString();

  const [updated] = await db
    .update(generatedMaterials)
    .set({ content: storedContent, updatedAt })
    .where(
      and(
        eq(generatedMaterials.id, params.materialId),
        eq(generatedMaterials.userId, userId)
      )
    )
    .returning();

  // Decrypt for response
  const plainContent = isEncryptionEnabled()
    ? decryptMaterialContent(updated.content)
    : updated.content;

  return Response.json({
    material: {
      id: updated.id,
      jobApplicationId: updated.jobApplicationId,
      userId: updated.userId,
      type: updated.type as MaterialType,
      content: plainContent,
      version: updated.version,
      exampleIdsUsed: updated.exampleIdsUsed
        ? (JSON.parse(updated.exampleIdsUsed) as string[])
        : [],
      promptHash: updated.promptHash,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  });
}
