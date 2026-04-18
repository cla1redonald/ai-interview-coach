import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { consistencyEntries } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// DELETE /api/consistency/[id] — delete a consistency entry (ownership verified)
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = params;

  try {
    const [existing] = await db
      .select()
      .from(consistencyEntries)
      .where(and(eq(consistencyEntries.id, id), eq(consistencyEntries.userId, userId)))
      .limit(1);

    if (!existing) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    await db
      .delete(consistencyEntries)
      .where(and(eq(consistencyEntries.id, id), eq(consistencyEntries.userId, userId)));

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/consistency/[id] error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
