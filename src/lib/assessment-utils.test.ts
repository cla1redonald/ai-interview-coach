import { describe, it, expect } from 'vitest';
import type { FitWeights } from '@/lib/types';
import { DEFAULT_FIT_WEIGHTS } from '@/lib/types';

// ─── Inline the weighted score calculator so it can be tested standalone ─────
// (mirrors the logic in the assess route)

function calculateOverallScore(
  scores: {
    domain: number;
    seniority: number;
    scope: number;
    technical: number;
    mission: number;
    location: number;
    compensation: number;
    culture: number;
  },
  weights: FitWeights
): number {
  const totalWeight =
    weights.domain +
    weights.seniority +
    weights.scope +
    weights.technical +
    weights.mission +
    weights.location +
    weights.compensation +
    weights.culture;

  const weightedSum =
    scores.domain * weights.domain +
    scores.seniority * weights.seniority +
    scores.scope * weights.scope +
    scores.technical * weights.technical +
    scores.mission * weights.mission +
    scores.location * weights.location +
    scores.compensation * weights.compensation +
    scores.culture * weights.culture;

  return Math.round((weightedSum / totalWeight) * 10);
}

// ─── Inline prompt hash logic ─────────────────────────────────────────────────
// (mirrors the logic in the materials route)

import { createHash } from 'crypto';

function computePromptHash(
  jobDescription: string,
  exampleIds: string[],
  masterCv?: string
): string {
  const sorted = [...exampleIds].sort();
  const masterCvHash = masterCv
    ? createHash('sha256').update(masterCv, 'utf8').digest('hex').slice(0, 16)
    : '';
  return createHash('sha256')
    .update([jobDescription, ...sorted, masterCvHash].join('|'), 'utf8')
    .digest('hex');
}

// ─── calculateOverallScore ────────────────────────────────────────────────────

describe('calculateOverallScore', () => {
  it('returns 100 when all dimension scores are 10 with default weights', () => {
    const allTen = {
      domain: 10,
      seniority: 10,
      scope: 10,
      technical: 10,
      mission: 10,
      location: 10,
      compensation: 10,
      culture: 10,
    };
    expect(calculateOverallScore(allTen, DEFAULT_FIT_WEIGHTS)).toBe(100);
  });

  it('returns 10 when all dimension scores are 1 with default weights', () => {
    const allOne = {
      domain: 1,
      seniority: 1,
      scope: 1,
      technical: 1,
      mission: 1,
      location: 1,
      compensation: 1,
      culture: 1,
    };
    expect(calculateOverallScore(allOne, DEFAULT_FIT_WEIGHTS)).toBe(10);
  });

  it('produces a weighted average, not a simple average', () => {
    // Give domain (weight 15) a score of 10 and everything else a score of 1
    // Expected: totalWeight=100, weightedSum = 10*15 + 1*85 = 235
    // overallScore = round((235/100) * 10) = round(23.5) = 24
    const scores = {
      domain: 10,
      seniority: 1,
      scope: 1,
      technical: 1,
      mission: 1,
      location: 1,
      compensation: 1,
      culture: 1,
    };
    const result = calculateOverallScore(scores, DEFAULT_FIT_WEIGHTS);
    expect(result).toBe(24);
  });

  it('respects custom weight overrides', () => {
    // All scores = 5 with equal weights of 1 each → weighted avg = 5 → score = 50
    const evenWeights: FitWeights = {
      domain: 1,
      seniority: 1,
      scope: 1,
      technical: 1,
      mission: 1,
      location: 1,
      compensation: 1,
      culture: 1,
    };
    const allFive = {
      domain: 5,
      seniority: 5,
      scope: 5,
      technical: 5,
      mission: 5,
      location: 5,
      compensation: 5,
      culture: 5,
    };
    expect(calculateOverallScore(allFive, evenWeights)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    // Force a result that needs rounding:
    // totalWeight=100 (default). Give domain score=6, rest=5
    // weightedSum = 6*15 + 5*85 = 90 + 425 = 515
    // 515/100 * 10 = 51.5 → rounds to 52
    const scores = {
      domain: 6,
      seniority: 5,
      scope: 5,
      technical: 5,
      mission: 5,
      location: 5,
      compensation: 5,
      culture: 5,
    };
    expect(calculateOverallScore(scores, DEFAULT_FIT_WEIGHTS)).toBe(52);
  });

  it('returns a value between 10 and 100 for typical inputs', () => {
    const scores = {
      domain: 7,
      seniority: 6,
      scope: 8,
      technical: 5,
      mission: 9,
      location: 7,
      compensation: 6,
      culture: 8,
    };
    const result = calculateOverallScore(scores, DEFAULT_FIT_WEIGHTS);
    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(100);
  });
});

// ─── computePromptHash ────────────────────────────────────────────────────────

describe('computePromptHash', () => {
  it('returns a 64-character hex string', () => {
    const hash = computePromptHash('Job desc', ['id1', 'id2']);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic — same inputs produce same hash', () => {
    const h1 = computePromptHash('Job desc', ['a', 'b', 'c']);
    const h2 = computePromptHash('Job desc', ['a', 'b', 'c']);
    expect(h1).toBe(h2);
  });

  it('is order-independent for exampleIds — sorts before hashing', () => {
    const h1 = computePromptHash('Job desc', ['c', 'a', 'b']);
    const h2 = computePromptHash('Job desc', ['a', 'b', 'c']);
    expect(h1).toBe(h2);
  });

  it('changes when jobDescription changes', () => {
    const h1 = computePromptHash('Job A', ['id1']);
    const h2 = computePromptHash('Job B', ['id1']);
    expect(h1).not.toBe(h2);
  });

  it('changes when exampleIds change', () => {
    const h1 = computePromptHash('Job desc', ['id1']);
    const h2 = computePromptHash('Job desc', ['id1', 'id2']);
    expect(h1).not.toBe(h2);
  });

  it('changes when masterCv is added', () => {
    const h1 = computePromptHash('Job desc', ['id1']);
    const h2 = computePromptHash('Job desc', ['id1'], 'Full CV content here');
    expect(h1).not.toBe(h2);
  });

  it('handles empty exampleIds array', () => {
    const hash = computePromptHash('Job desc', []);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

// ─── DEFAULT_FIT_WEIGHTS validation ──────────────────────────────────────────

describe('DEFAULT_FIT_WEIGHTS', () => {
  it('sums to exactly 100', () => {
    const total = Object.values(DEFAULT_FIT_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(100);
  });

  it('has all positive weight values', () => {
    for (const [key, value] of Object.entries(DEFAULT_FIT_WEIGHTS)) {
      expect(value, `${key} weight must be positive`).toBeGreaterThan(0);
    }
  });
});
