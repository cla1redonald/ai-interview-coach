import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { transcripts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decryptTranscriptFields, isEncryptionEnabled } from '@/lib/encryption';

// GET /api/transcripts/[id] — full transcript detail
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
    const [row] = await db.select()
      .from(transcripts)
      .where(and(
        eq(transcripts.id, params.id),
        eq(transcripts.userId, userId)
      ))
      .limit(1);

    if (!row) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const result = isEncryptionEnabled()
      ? { ...row, ...decryptTranscriptFields({ rawText: row.rawText }) }
      : row;

    return Response.json({ transcript: result });
  } catch (err) {
    console.error('GET /api/transcripts/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/transcripts/[id] — delete a transcript
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const [existing] = await db.select({ id: transcripts.id })
      .from(transcripts)
      .where(and(
        eq(transcripts.id, params.id),
        eq(transcripts.userId, userId)
      ))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(transcripts)
      .where(and(
        eq(transcripts.id, params.id),
        eq(transcripts.userId, userId)
      ));

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/transcripts/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
