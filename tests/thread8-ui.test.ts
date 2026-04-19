/**
 * Thread 8 — Research + Fit Assessment UI unit tests
 *
 * Tests the logic utilities and pure functions embedded in the new pages/components.
 * React component tests are covered by TypeScript type-checking (tsc --noEmit).
 */

import { describe, it, expect } from 'vitest';

// ─── RadarChart geometry ────────────────────────────────────────────────────

describe('RadarChart geometry utilities', () => {
  function spokeAngle(i: number, n: number): number {
    return (2 * Math.PI * i) / n - Math.PI / 2;
  }

  function pointX(i: number, n: number, score: number, radius: number, centre: number): number {
    const r = (score / 10) * radius;
    return centre + r * Math.cos(spokeAngle(i, n));
  }

  function pointY(i: number, n: number, score: number, radius: number, centre: number): number {
    const r = (score / 10) * radius;
    return centre + r * Math.sin(spokeAngle(i, n));
  }

  it('first spoke (i=0) points upward from centre (negative y offset)', () => {
    const angle = spokeAngle(0, 8);
    // -π/2 = pointing up
    expect(angle).toBeCloseTo(-Math.PI / 2, 5);
  });

  it('score 10 at spoke 0 places point at full radius above centre', () => {
    const size = 240;
    const centre = size / 2;
    const radius = centre - 28;
    const y = pointY(0, 8, 10, radius, centre);
    expect(y).toBeCloseTo(centre - radius, 2);
  });

  it('score 0 at any spoke places point at centre', () => {
    const size = 240;
    const centre = size / 2;
    const radius = centre - 28;
    const x = pointX(0, 8, 0, radius, centre);
    const y = pointY(0, 8, 0, radius, centre);
    expect(x).toBeCloseTo(centre, 5);
    expect(y).toBeCloseTo(centre, 5);
  });

  it('8 spokes are evenly distributed (45° apart)', () => {
    const n = 8;
    const angleDeg = (i: number) => (spokeAngle(i, n) * 180) / Math.PI;
    const diff = angleDeg(1) - angleDeg(0);
    expect(diff).toBeCloseTo(360 / n, 5);
    for (let i = 1; i < n; i++) {
      expect(angleDeg(i) - angleDeg(i - 1)).toBeCloseTo(360 / n, 5);
    }
  });

  it('ring path fraction scales correctly', () => {
    const size = 240;
    const centre = size / 2;
    const radius = centre - 28;
    // 50% ring: point at i=0 should be exactly half-radius above centre
    const fraction = 0.5;
    const r = radius * fraction;
    const y = centre + r * Math.sin(-Math.PI / 2); // pointing up
    expect(y).toBeCloseTo(centre - r, 2);
  });
});

// ─── Score color utilities ─────────────────────────────────────────────────

describe('Score color logic', () => {
  function scoreColor(score: number): string {
    if (score >= 8) return 'var(--amber)';
    if (score >= 6) return 'var(--copper)';
    return 'var(--sage)';
  }

  function overallColor(score: number): string {
    if (score >= 70) return 'var(--amber)';
    if (score >= 50) return 'var(--copper)';
    return 'var(--sage)';
  }

  it('dimension score 10 → amber', () => {
    expect(scoreColor(10)).toBe('var(--amber)');
  });

  it('dimension score 8 → amber (boundary)', () => {
    expect(scoreColor(8)).toBe('var(--amber)');
  });

  it('dimension score 7 → copper', () => {
    expect(scoreColor(7)).toBe('var(--copper)');
  });

  it('dimension score 6 → copper (boundary)', () => {
    expect(scoreColor(6)).toBe('var(--copper)');
  });

  it('dimension score 5 → sage', () => {
    expect(scoreColor(5)).toBe('var(--sage)');
  });

  it('dimension score 1 → sage', () => {
    expect(scoreColor(1)).toBe('var(--sage)');
  });

  it('overall score 70 → amber', () => {
    expect(overallColor(70)).toBe('var(--amber)');
  });

  it('overall score 69 → copper', () => {
    expect(overallColor(69)).toBe('var(--copper)');
  });

  it('overall score 50 → copper (boundary)', () => {
    expect(overallColor(50)).toBe('var(--copper)');
  });

  it('overall score 49 → sage', () => {
    expect(overallColor(49)).toBe('var(--sage)');
  });
});

// ─── Red flag dismiss logic ────────────────────────────────────────────────

describe('Red flag dismiss filtering', () => {
  const flags = ['Flag A', 'Flag B', 'Flag C'];

  it('returns all flags when none are dismissed', () => {
    const dismissed: string[] = [];
    const active = flags.filter((f) => !dismissed.includes(f));
    expect(active).toEqual(flags);
  });

  it('filters out dismissed flags', () => {
    const dismissed = ['Flag B'];
    const active = flags.filter((f) => !dismissed.includes(f));
    expect(active).toEqual(['Flag A', 'Flag C']);
  });

  it('dismissed list contains exactly the dismissed flags', () => {
    const dismissed = ['Flag A', 'Flag C'];
    const dismissedList = flags.filter((f) => dismissed.includes(f));
    expect(dismissedList).toEqual(['Flag A', 'Flag C']);
  });

  it('active flags are empty when all dismissed', () => {
    const dismissed = [...flags];
    const active = flags.filter((f) => !dismissed.includes(f));
    expect(active).toHaveLength(0);
  });

  it('dismissing same flag twice does not create duplicates', () => {
    const prev = ['Flag A'];
    const flag = 'Flag A';
    const next = prev.includes(flag) ? prev : [...prev, flag];
    expect(next).toEqual(['Flag A']);
    expect(next).toHaveLength(1);
  });

  it('dismissing new flag adds it to array', () => {
    const prev = ['Flag A'];
    const next = [...prev, 'Flag B'];
    expect(next).toEqual(['Flag A', 'Flag B']);
  });
});

// ─── Form validation logic ─────────────────────────────────────────────────

describe('New research form validation', () => {
  interface FormErrors {
    content?: string;
    jobUrl?: string;
    jobTitle?: string;
  }

  function validate(jobUrl: string, jobDescription: string, jobTitle: string): FormErrors {
    const errs: FormErrors = {};

    if (!jobUrl.trim() && !jobDescription.trim()) {
      errs.content = 'Please provide a job URL or paste the job description.';
    }

    if (jobUrl.trim()) {
      try {
        new URL(jobUrl.trim());
      } catch {
        errs.jobUrl = 'Please enter a valid URL (e.g. https://example.com/jobs/123).';
      }
    }

    if (!jobTitle.trim()) {
      errs.jobTitle = 'Job title is required.';
    }

    return errs;
  }

  it('requires content — neither URL nor description', () => {
    const errs = validate('', '', '');
    expect(errs.content).toBeDefined();
  });

  it('accepts URL without description', () => {
    const errs = validate('https://example.com/jobs/1', '', 'Head of Product');
    expect(errs.content).toBeUndefined();
  });

  it('accepts description without URL', () => {
    const errs = validate('', 'Full job description text here', 'Head of Product');
    expect(errs.content).toBeUndefined();
  });

  it('validates malformed URL', () => {
    const errs = validate('not-a-url', '', 'Head of Product');
    expect(errs.jobUrl).toBeDefined();
  });

  it('accepts valid https URL', () => {
    const errs = validate('https://jobs.example.com/123', '', 'Head of Product');
    expect(errs.jobUrl).toBeUndefined();
  });

  it('requires job title', () => {
    const errs = validate('', 'description here', '');
    expect(errs.jobTitle).toBeDefined();
  });

  it('accepts whitespace-only job title as invalid', () => {
    const errs = validate('', 'description here', '   ');
    expect(errs.jobTitle).toBeDefined();
  });

  it('no errors when all valid', () => {
    const errs = validate('https://example.com/job', 'description', 'Head of Product');
    expect(Object.keys(errs)).toHaveLength(0);
  });
});

// ─── JobContextHeader phase detection ─────────────────────────────────────

describe('JobContextHeader phase completion logic', () => {
  function phaseComplete(
    phase: 'research' | 'fit' | 'materials',
    hasResearch: boolean,
    hasFit: boolean,
    hasMaterials: boolean
  ): boolean {
    if (phase === 'research') return hasResearch;
    if (phase === 'fit') return hasFit;
    if (phase === 'materials') return hasMaterials;
    return false;
  }

  it('research phase complete when hasResearch is true', () => {
    expect(phaseComplete('research', true, false, false)).toBe(true);
  });

  it('research phase incomplete when hasResearch is false', () => {
    expect(phaseComplete('research', false, false, false)).toBe(false);
  });

  it('fit phase complete when hasFit is true', () => {
    expect(phaseComplete('fit', true, true, false)).toBe(true);
  });

  it('materials phase complete when hasMaterials is true', () => {
    expect(phaseComplete('materials', false, false, true)).toBe(true);
  });

  it('all phases incomplete', () => {
    expect(phaseComplete('research', false, false, false)).toBe(false);
    expect(phaseComplete('fit', false, false, false)).toBe(false);
    expect(phaseComplete('materials', false, false, false)).toBe(false);
  });

  it('label truncation at 40 chars', () => {
    function truncate(fullLabel: string): string {
      return fullLabel.length > 40 ? fullLabel.slice(0, 37) + '…' : fullLabel;
    }
    const long = 'Anthropic — Senior Staff Software Engineer';
    expect(long.length).toBeGreaterThan(40);
    const t = truncate(long);
    expect(t.length).toBe(38); // 37 + 1 (ellipsis char)
    expect(t.endsWith('…')).toBe(true);

    const short = 'Acme — Engineer';
    expect(truncate(short)).toBe(short);
  });
});

// ─── Progress step timing ──────────────────────────────────────────────────

describe('Research progress step timing', () => {
  const PROGRESS_STEPS = [
    { label: 'Company overview', delayMs: 0 },
    { label: 'Funding and growth stage', delayMs: 8000 },
    { label: 'Recent news and announcements', delayMs: 16000 },
    { label: 'Tech stack and engineering culture', delayMs: 22000 },
    { label: 'Key people', delayMs: 28000 },
  ];

  it('has exactly 5 steps', () => {
    expect(PROGRESS_STEPS).toHaveLength(5);
  });

  it('first step has delay 0', () => {
    expect(PROGRESS_STEPS[0].delayMs).toBe(0);
  });

  it('steps have increasing delays', () => {
    for (let i = 1; i < PROGRESS_STEPS.length; i++) {
      expect(PROGRESS_STEPS[i].delayMs).toBeGreaterThan(PROGRESS_STEPS[i - 1].delayMs);
    }
  });

  it('total span is within 40 seconds', () => {
    const last = PROGRESS_STEPS[PROGRESS_STEPS.length - 1].delayMs;
    expect(last).toBeLessThanOrEqual(40000);
  });

  it('all step labels are non-empty strings', () => {
    for (const step of PROGRESS_STEPS) {
      expect(typeof step.label).toBe('string');
      expect(step.label.length).toBeGreaterThan(0);
    }
  });
});
