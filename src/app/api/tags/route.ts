import { auth } from '@/lib/auth';
import { db } from '@/lib/db/index';
import { tags } from '@/lib/db/schema';
import { eq, isNull, or, asc } from 'drizzle-orm';

// GET /api/tags — return system tags (userId null) + user's custom tags, system first alphabetically
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const rows = await db.select()
      .from(tags)
      .where(or(
        isNull(tags.userId),
        eq(tags.userId, userId)
      ))
      .orderBy(tags.isSystem, asc(tags.name));

    // Sort: system tags first (isSystem = true/1), then user tags, both alphabetical
    const sorted = [...rows].sort((a, b) => {
      if (a.isSystem && !b.isSystem) return -1;
      if (!a.isSystem && b.isSystem) return 1;
      return a.name.localeCompare(b.name);
    });

    return Response.json({ tags: sorted });
  } catch (err) {
    console.error('GET /api/tags error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/tags — create a custom tag for the user
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const name = typeof b.name === 'string' ? b.name.trim() : '';

  if (!name) {
    return Response.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 60) {
    return Response.json({ error: 'name must be 60 characters or fewer' }, { status: 400 });
  }

  try {
    // Check for duplicate — case-insensitive match against this user's tags and system tags
    const allUserTags = await db.select()
      .from(tags)
      .where(or(
        isNull(tags.userId),
        eq(tags.userId, userId)
      ));

    const duplicate = allUserTags.find(
      t => t.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      return Response.json(
        { error: 'A tag with this name already exists' },
        { status: 409 }
      );
    }

    const [inserted] = await db.insert(tags)
      .values({
        userId,
        name,
        isSystem: false,
      })
      .returning();

    return Response.json({ tag: inserted }, { status: 201 });
  } catch (err) {
    console.error('POST /api/tags error:', err);
    return Response.json({ error: 'Database error' }, { status: 500 });
  }
}
