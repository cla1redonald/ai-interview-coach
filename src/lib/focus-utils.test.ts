import { describe, it, expect } from 'vitest';
import {
  detectContradiction,
  buildCategoryStats,
  findWeakestCategory,
  findLowestStrengthCategory,
  computeFocusData,
  type ConsistencyRow,
  type ExampleRow,
} from './focus-utils';

// ─── detectContradiction ──────────────────────────────────────────────────────

describe('detectContradiction', () => {
  it('returns null when there are no rows', () => {
    expect(detectContradiction([])).toBeNull();
  });

  it('returns null when all topics appear for only one company', () => {
    const rows: ConsistencyRow[] = [
      { topic: 'salary', company: 'Acme' },
      { topic: 'start_date', company: 'Acme' },
      { topic: 'salary', company: 'Acme' }, // same company repeated
    ];
    expect(detectContradiction(rows)).toBeNull();
  });

  it('detects a contradiction when the same topic appears across 2 companies', () => {
    const rows: ConsistencyRow[] = [
      { topic: 'salary', company: 'Acme' },
      { topic: 'salary', company: 'BetaCorp' },
    ];
    const result = detectContradiction(rows);
    expect(result).not.toBeNull();
    expect(result?.topic).toBe('salary');
    expect(result?.companyCount).toBe(2);
  });

  it('returns the company count accurately when 3 companies claim the same topic', () => {
    const rows: ConsistencyRow[] = [
      { topic: 'leaving_reason', company: 'Acme' },
      { topic: 'leaving_reason', company: 'BetaCorp' },
      { topic: 'leaving_reason', company: 'Gamma Ltd' },
    ];
    const result = detectContradiction(rows);
    expect(result?.companyCount).toBe(3);
  });

  it('only flags topics with 2+ companies, ignores single-company topics', () => {
    const rows: ConsistencyRow[] = [
      { topic: 'role_scope', company: 'OnlyCo' }, // single company — not a contradiction
      { topic: 'salary', company: 'Acme' },
      { topic: 'salary', company: 'BetaCorp' },   // contradiction
    ];
    const result = detectContradiction(rows);
    expect(result?.topic).toBe('salary');
  });
});

// ─── buildCategoryStats ───────────────────────────────────────────────────────

describe('buildCategoryStats', () => {
  it('returns empty map for empty input', () => {
    expect(buildCategoryStats([])).toEqual(new Map());
  });

  it('skips rows with null tagName', () => {
    const rows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'strong', tagName: null },
    ];
    expect(buildCategoryStats(rows).size).toBe(0);
  });

  it('counts strong, weak, neutral, and unrated correctly', () => {
    const rows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'strong',  tagName: 'Leadership' },
      { exampleId: '2', qualityRating: 'weak',    tagName: 'Leadership' },
      { exampleId: '3', qualityRating: 'neutral', tagName: 'Leadership' },
      { exampleId: '4', qualityRating: null,      tagName: 'Leadership' }, // unrated
    ];
    const stats = buildCategoryStats(rows);
    const leadership = stats.get('Leadership')!;
    expect(leadership.strong).toBe(1);
    expect(leadership.weak).toBe(1);
    expect(leadership.neutral).toBe(1);
    expect(leadership.unrated).toBe(1);
    expect(leadership.total).toBe(4);
  });

  it('handles multiple categories independently', () => {
    const rows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'strong', tagName: 'Leadership' },
      { exampleId: '2', qualityRating: 'weak',   tagName: 'Communication' },
    ];
    const stats = buildCategoryStats(rows);
    expect(stats.get('Leadership')?.strong).toBe(1);
    expect(stats.get('Communication')?.weak).toBe(1);
  });
});

// ─── findWeakestCategory ──────────────────────────────────────────────────────

describe('findWeakestCategory', () => {
  it('returns null when the map is empty', () => {
    expect(findWeakestCategory(new Map())).toBeNull();
  });

  it('returns null when every category has at least one strong example', () => {
    const stats = buildCategoryStats([
      { exampleId: '1', qualityRating: 'strong', tagName: 'Leadership' },
      { exampleId: '2', qualityRating: 'weak',   tagName: 'Leadership' },
    ]);
    expect(findWeakestCategory(stats)).toBeNull();
  });

  it('returns the category with zero strong examples', () => {
    const stats = buildCategoryStats([
      { exampleId: '1', qualityRating: 'weak',   tagName: 'Communication' },
      { exampleId: '2', qualityRating: 'strong', tagName: 'Leadership' },
    ]);
    const result = findWeakestCategory(stats);
    expect(result?.name).toBe('Communication');
  });

  it('returns the category with the most weak/unrated when multiple zero-strong categories exist', () => {
    const rows: ExampleRow[] = [
      // Communication — 1 weak
      { exampleId: '1', qualityRating: 'weak', tagName: 'Communication' },
      // Problem Solving — 2 weak
      { exampleId: '2', qualityRating: 'weak', tagName: 'Problem Solving' },
      { exampleId: '3', qualityRating: 'weak', tagName: 'Problem Solving' },
    ];
    const stats = buildCategoryStats(rows);
    const result = findWeakestCategory(stats);
    expect(result?.name).toBe('Problem Solving');
    expect(result?.weakCount).toBe(2);
  });
});

// ─── findLowestStrengthCategory ───────────────────────────────────────────────

describe('findLowestStrengthCategory', () => {
  it('returns null for empty map', () => {
    expect(findLowestStrengthCategory(new Map())).toBeNull();
  });

  it('returns null for a category with total = 0', () => {
    // Manually construct a degenerate stat that shouldn't happen in practice
    const stats = new Map([
      ['Empty', { strong: 0, weak: 0, neutral: 0, unrated: 0, total: 0 }],
    ]);
    expect(findLowestStrengthCategory(stats)).toBeNull();
  });

  it('returns the category with the lowest strong/total ratio', () => {
    const rows: ExampleRow[] = [
      // Leadership: 1 strong / 2 total = 0.5
      { exampleId: '1', qualityRating: 'strong', tagName: 'Leadership' },
      { exampleId: '2', qualityRating: 'weak',   tagName: 'Leadership' },
      // Communication: 1 strong / 3 total ≈ 0.333
      { exampleId: '3', qualityRating: 'strong', tagName: 'Communication' },
      { exampleId: '4', qualityRating: 'weak',   tagName: 'Communication' },
      { exampleId: '5', qualityRating: 'weak',   tagName: 'Communication' },
    ];
    const stats = buildCategoryStats(rows);
    const result = findLowestStrengthCategory(stats);
    expect(result?.name).toBe('Communication');
  });
});

// ─── computeFocusData (integration) ──────────────────────────────────────────

describe('computeFocusData', () => {
  it('returns null when example count is below 5', () => {
    expect(computeFocusData(4, [], [])).toBeNull();
  });

  it('returns null when count is exactly 5 but no signals exist', () => {
    // 5 examples, single-company consistency, all strong
    const consistencyRows: ConsistencyRow[] = [
      { topic: 'salary', company: 'Acme' },
    ];
    const exampleRows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'strong', tagName: 'Leadership' },
    ];
    // No contradiction, no weak category, but 1 category with ratio 1.0
    // The fallback (lowest-strength) still fires since there's a category
    const result = computeFocusData(5, consistencyRows, exampleRows);
    expect(result?.type).toBe('lowest-strength');
  });

  it('prioritises consistency contradiction over weak category', () => {
    const consistencyRows: ConsistencyRow[] = [
      { topic: 'salary', company: 'Acme' },
      { topic: 'salary', company: 'BetaCorp' },
    ];
    const exampleRows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'weak', tagName: 'Leadership' },
    ];
    const result = computeFocusData(5, consistencyRows, exampleRows);
    expect(result?.type).toBe('consistency');
    expect(result?.category).toBe('salary');
    expect(result?.href).toBe('/consistency');
  });

  it('surfaces weak-category when no contradiction exists', () => {
    const exampleRows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'weak', tagName: 'Problem Solving' },
      { exampleId: '2', qualityRating: 'weak', tagName: 'Problem Solving' },
      { exampleId: '3', qualityRating: 'strong', tagName: 'Leadership' },
    ];
    const result = computeFocusData(5, [], exampleRows);
    expect(result?.type).toBe('weak-category');
    expect(result?.category).toBe('Problem Solving');
    expect(result?.href).toContain('/practice?focus=');
  });

  it('URL-encodes spaces in category name for practice href', () => {
    const exampleRows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'weak', tagName: 'Problem Solving' },
    ];
    const result = computeFocusData(5, [], exampleRows);
    expect(result?.href).toBe('/practice?focus=Problem%20Solving');
  });

  it('falls back to lowest-strength when all categories have >= 1 strong', () => {
    const exampleRows: ExampleRow[] = [
      // Leadership: 2 strong / 2 = 1.0
      { exampleId: '1', qualityRating: 'strong', tagName: 'Leadership' },
      { exampleId: '2', qualityRating: 'strong', tagName: 'Leadership' },
      // Communication: 1 strong / 3 = 0.333 — lowest
      { exampleId: '3', qualityRating: 'strong', tagName: 'Communication' },
      { exampleId: '4', qualityRating: 'weak',   tagName: 'Communication' },
      { exampleId: '5', qualityRating: 'weak',   tagName: 'Communication' },
    ];
    const result = computeFocusData(5, [], exampleRows);
    expect(result?.type).toBe('lowest-strength');
    expect(result?.category).toBe('Communication');
  });

  it('returns null when example count is 0', () => {
    expect(computeFocusData(0, [], [])).toBeNull();
  });

  it('includes company count in consistency detail text', () => {
    const consistencyRows: ConsistencyRow[] = [
      { topic: 'start_date', company: 'A' },
      { topic: 'start_date', company: 'B' },
      { topic: 'start_date', company: 'C' },
    ];
    const result = computeFocusData(5, consistencyRows, []);
    expect(result?.detail).toBe('Varies across 3 companies');
  });

  it('includes weak count in weak-category detail text', () => {
    const exampleRows: ExampleRow[] = [
      { exampleId: '1', qualityRating: 'weak', tagName: 'Resilience' },
      { exampleId: '2', qualityRating: null,   tagName: 'Resilience' }, // unrated
    ];
    const result = computeFocusData(5, [], exampleRows);
    expect(result?.detail).toBe('No strong examples yet (2 weak or unrated)');
  });
});
