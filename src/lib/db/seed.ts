/**
 * Seeds the 13 system tags.
 * Run with: npm run db:seed
 *
 * Safe to run multiple times — skips tags that already exist by name.
 */
import { db } from './index';
import { tags } from './schema';
import { isNull, eq, and } from 'drizzle-orm';

const SYSTEM_TAGS = [
  'Tell me about yourself',
  'Why are you leaving?',
  'Why this role?',
  'Product strategy & prioritisation',
  'Delivery & execution',
  'OKRs & planning',
  'Stakeholder management & conflict',
  'Leadership style & team development',
  'AI adoption & hands-on experience',
  'Compensation expectations',
  'Technical depth',
  'Cross-functional / matrix working',
  'Research & discovery approach',
  'Practice session',
];

async function seed() {
  console.log('Seeding system tags...');

  for (const name of SYSTEM_TAGS) {
    // Check if system tag already exists (userId IS NULL and same name)
    const existing = await db
      .select()
      .from(tags)
      .where(and(isNull(tags.userId), eq(tags.name, name)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(tags).values({
        name,
        isSystem: true,
        userId: null,
      });
      console.log(`  Created: ${name}`);
    } else {
      console.log(`  Skipped (exists): ${name}`);
    }
  }

  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
