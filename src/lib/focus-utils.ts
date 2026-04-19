// ── Where to Focus computation ────────────────────────────────────────────────
// Pure functions with no DB or external dependencies — fully testable.

export type FocusType = 'consistency' | 'weak-category' | 'lowest-strength';

export type FocusData = {
  type: FocusType;
  category: string;
  detail: string;
  href: string;
} | null;

export type ConsistencyRow = {
  topic: string;
  company: string;
};

export type ExampleRow = {
  exampleId: string;
  qualityRating: string | null;
  tagName: string | null;
};

/**
 * Given raw rows from the consistency_entries table, detect whether any topic
 * is claimed across 2 or more distinct companies (a contradiction signal).
 * Returns the first matching contradiction, or null.
 */
export function detectContradiction(
  rows: ConsistencyRow[]
): { topic: string; companyCount: number } | null {
  const topicCompanies = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!topicCompanies.has(row.topic)) {
      topicCompanies.set(row.topic, new Set());
    }
    topicCompanies.get(row.topic)!.add(row.company);
  }

  const found = Array.from(topicCompanies.entries()).find(
    ([, companies]) => companies.size >= 2
  );

  if (!found) return null;
  const [topic, companies] = found;
  return { topic, companyCount: companies.size };
}

type CategoryStat = {
  strong: number;
  weak: number;
  neutral: number;
  unrated: number;
  total: number;
};

/**
 * Given example rows (with quality ratings and system tag names), build a
 * per-category stats map.
 */
export function buildCategoryStats(rows: ExampleRow[]): Map<string, CategoryStat> {
  const stats = new Map<string, CategoryStat>();

  for (const row of rows) {
    if (!row.tagName) continue;

    if (!stats.has(row.tagName)) {
      stats.set(row.tagName, { strong: 0, weak: 0, neutral: 0, unrated: 0, total: 0 });
    }

    const stat = stats.get(row.tagName)!;
    stat.total++;

    if (row.qualityRating === 'strong') stat.strong++;
    else if (row.qualityRating === 'weak') stat.weak++;
    else if (row.qualityRating === 'neutral') stat.neutral++;
    else stat.unrated++;
  }

  return stats;
}

/**
 * From category stats, find the category with zero strong examples but the
 * most weak/unrated examples (Priority 2).
 */
export function findWeakestCategory(
  stats: Map<string, CategoryStat>
): { name: string; weakCount: number } | null {
  let weakestCategory: { name: string; weakCount: number } | null = null;

  for (const [name, stat] of Array.from(stats.entries())) {
    if (stat.strong === 0 && stat.total >= 1) {
      const weakCount = stat.weak + stat.unrated;
      if (!weakestCategory || weakCount > weakestCategory.weakCount) {
        weakestCategory = { name, weakCount };
      }
    }
  }

  return weakestCategory;
}

/**
 * From category stats, find the category with the lowest strong/total ratio
 * (Priority 3 fallback — only used when every category has at least 1 strong).
 */
export function findLowestStrengthCategory(
  stats: Map<string, CategoryStat>
): { name: string; ratio: number } | null {
  let lowestCategory: { name: string; ratio: number } | null = null;

  for (const [name, stat] of Array.from(stats.entries())) {
    if (stat.total === 0) continue;
    const ratio = stat.strong / stat.total;
    if (!lowestCategory || ratio < lowestCategory.ratio) {
      lowestCategory = { name, ratio };
    }
  }

  return lowestCategory;
}

/**
 * Top-level orchestrator: takes raw DB rows and returns the single highest-
 * priority FocusData record to display, or null if no signal.
 *
 * Priority order:
 *   1. Consistency contradiction
 *   2. Weak category (zero strong examples)
 *   3. Lowest strength ratio (fallback)
 */
export function computeFocusData(
  exampleCount: number,
  consistencyRows: ConsistencyRow[],
  exampleRows: ExampleRow[]
): FocusData {
  if (exampleCount < 5) return null;

  // Priority 1: consistency contradiction
  const contradiction = detectContradiction(consistencyRows);
  if (contradiction) {
    return {
      type: 'consistency',
      category: contradiction.topic,
      detail: `Varies across ${contradiction.companyCount} companies`,
      href: '/consistency',
    };
  }

  // Priority 2 & 3: category strength analysis
  const categoryStats = buildCategoryStats(exampleRows);

  const weakest = findWeakestCategory(categoryStats);
  if (weakest) {
    return {
      type: 'weak-category',
      category: weakest.name,
      detail: `No strong examples yet (${weakest.weakCount} weak or unrated)`,
      href: `/practice?focus=${encodeURIComponent(weakest.name)}`,
    };
  }

  const lowest = findLowestStrengthCategory(categoryStats);
  if (lowest) {
    return {
      type: 'lowest-strength',
      category: lowest.name,
      detail: `Lowest strength ratio in your bank`,
      href: `/practice?focus=${encodeURIComponent(lowest.name)}`,
    };
  }

  return null;
}
