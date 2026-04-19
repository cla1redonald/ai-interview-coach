import { describe, it, expect, vi } from 'vitest';
import { parseMarkdownListings } from '@/lib/batch/parse-markdown';

// ─── parseMarkdownListings ────────────────────────────────────────────────────

describe('parseMarkdownListings — basic extraction', () => {
  it('extracts the correct number of listings from two headings', () => {
    const markdown = `
## Head of Product — Moonpig
https://example.com/job/123
London / hybrid, £120-140k

## Senior PM — Deliveroo
We are looking for a Senior PM to join our team.
`.trim();
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(2);
  });

  it('extracts correct job title and company from em dash separator', () => {
    const markdown = `## Head of Product — Moonpig\nSome job description here.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobTitle).toBe('Head of Product');
    expect(listings[0].companyName).toBe('Moonpig');
  });

  it('extracts correct job title and company from en dash separator', () => {
    const markdown = `## Senior PM – Deliveroo\nJob description.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobTitle).toBe('Senior PM');
    expect(listings[0].companyName).toBe('Deliveroo');
  });

  it('handles missing company — returns empty string for companyName', () => {
    const markdown = `## VP Engineering\nJob description without a company separator.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobTitle).toBe('VP Engineering');
    expect(listings[0].companyName).toBe('');
  });

  it('returns empty array when markdown has no ## headings', () => {
    const markdown = `Just some text without any headings at all.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(0);
  });

  it('handles single listing with only a heading', () => {
    const markdown = `## CTO — Acme Corp`;
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(1);
    expect(listings[0].jobTitle).toBe('CTO');
    expect(listings[0].companyName).toBe('Acme Corp');
  });
});

describe('parseMarkdownListings — URL detection', () => {
  it('detects a URL as jobUrl when it is the first non-empty line after the heading', () => {
    const markdown = `## Senior PM — Stripe\nhttps://boards.greenhouse.io/stripe/jobs/999\nJob description text.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobUrl).toBe('https://boards.greenhouse.io/stripe/jobs/999');
  });

  it('does not set jobUrl when no URL is present — stores text as description', () => {
    const markdown = `## Product Director — Monzo\nWe are looking for a product leader.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobUrl).toBeNull();
    expect(listings[0].jobDescription).toContain('We are looking for a product leader');
  });

  it('treats http:// URLs as jobUrl (not just https)', () => {
    const markdown = `## Engineer — OldCo\nhttp://jobs.oldco.com/123\nJob text.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobUrl).toBe('http://jobs.oldco.com/123');
  });

  it('treats non-URL first line as start of job description', () => {
    const markdown = `## Data Scientist — TechCo\nAbout us: we are a data company.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobUrl).toBeNull();
    expect(listings[0].jobDescription).toContain('About us');
  });

  it('stores remaining lines after URL as job description', () => {
    const markdown = `## PM — StartupCo\nhttps://example.com/job/1\nThis is the full job description.\nMultiple lines here.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobUrl).toBe('https://example.com/job/1');
    expect(listings[0].jobDescription).toContain('This is the full job description');
  });
});

describe('parseMarkdownListings — max listings enforcement', () => {
  it('rejects more than 10 listings — returns all parsed (caller enforces limit)', () => {
    // The parser itself returns all listings; the route enforces the limit.
    // This test verifies the parser correctly returns 11 listings.
    const headings = Array.from({ length: 11 }, (_, i) =>
      `## Job ${i + 1} — Company ${i + 1}\nDescription ${i + 1}.`
    ).join('\n\n');

    const listings = parseMarkdownListings(headings);
    expect(listings).toHaveLength(11);
  });

  it('parses exactly 10 listings without issue', () => {
    const headings = Array.from({ length: 10 }, (_, i) =>
      `## Job ${i + 1} — Company ${i + 1}\nDescription.`
    ).join('\n\n');
    const listings = parseMarkdownListings(headings);
    expect(listings).toHaveLength(10);
  });
});

describe('parseMarkdownListings — dash separator variants', () => {
  it('splits on em dash (—)', () => {
    const listings = parseMarkdownListings(`## Director of Product — Figma\nDesc.`);
    expect(listings[0].jobTitle).toBe('Director of Product');
    expect(listings[0].companyName).toBe('Figma');
  });

  it('splits on en dash (–)', () => {
    const listings = parseMarkdownListings(`## Head of Engineering – Notion\nDesc.`);
    expect(listings[0].jobTitle).toBe('Head of Engineering');
    expect(listings[0].companyName).toBe('Notion');
  });

  it('handles job title with an internal hyphen', () => {
    // "Senior Full-Stack Engineer — Acme" — should split on the em dash, preserving the hyphen in title
    const listings = parseMarkdownListings(`## Senior Full-Stack Engineer — Acme\nDesc.`);
    expect(listings[0].jobTitle).toBe('Senior Full-Stack Engineer');
    expect(listings[0].companyName).toBe('Acme');
  });

  it('handles company name with spaces', () => {
    const listings = parseMarkdownListings(`## VP Product — World of Books\nDesc.`);
    expect(listings[0].companyName).toBe('World of Books');
  });
});

describe('parseMarkdownListings — multiple listings', () => {
  it('preserves all listings with their respective details', () => {
    const markdown = `
## Head of Product — Moonpig
https://moonpig.com/jobs/1
London hybrid

## Senior PM — Deliveroo
https://deliveroo.com/jobs/2
This is the job description for Deliveroo.
`.trim();
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(2);
    expect(listings[0].companyName).toBe('Moonpig');
    expect(listings[0].jobUrl).toBe('https://moonpig.com/jobs/1');
    expect(listings[1].companyName).toBe('Deliveroo');
    expect(listings[1].jobUrl).toBe('https://deliveroo.com/jobs/2');
  });

  it('handles listings with no job description body', () => {
    const markdown = `## CPO — Figma\n\n## CTO — Linear`;
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(2);
    expect(listings[0].jobDescription).toBe('');
    expect(listings[1].jobDescription).toBe('');
  });
});

// ─── Batch counter logic ──────────────────────────────────────────────────────
// These tests verify the counter increment logic independently of the route.

describe('batch counter increment logic', () => {
  function simulateCompletion(
    initialCompleted: number,
    initialFailed: number,
    total: number,
    success: boolean
  ) {
    const newCompleted = success ? initialCompleted + 1 : initialCompleted;
    const newFailed = success ? initialFailed : initialFailed + 1;
    const allDone = (newCompleted + newFailed) >= total;
    return { newCompleted, newFailed, allDone };
  }

  it('increments completedJobs on success', () => {
    const result = simulateCompletion(0, 0, 3, true);
    expect(result.newCompleted).toBe(1);
    expect(result.newFailed).toBe(0);
    expect(result.allDone).toBe(false);
  });

  it('increments failedJobs on failure', () => {
    const result = simulateCompletion(0, 0, 3, false);
    expect(result.newCompleted).toBe(0);
    expect(result.newFailed).toBe(1);
    expect(result.allDone).toBe(false);
  });

  it('marks allDone when completedJobs + failedJobs reaches totalJobs', () => {
    const result = simulateCompletion(2, 0, 3, true);
    expect(result.newCompleted).toBe(3);
    expect(result.allDone).toBe(true);
  });

  it('marks allDone when last job fails', () => {
    const result = simulateCompletion(2, 0, 3, false);
    expect(result.newFailed).toBe(1);
    expect(result.allDone).toBe(true);
  });

  it('marks allDone with mixed success and failure', () => {
    const result = simulateCompletion(1, 1, 3, true);
    expect(result.newCompleted).toBe(2);
    expect(result.newFailed).toBe(1);
    expect(result.allDone).toBe(true);
  });

  it('never decrements counters on success', () => {
    const result = simulateCompletion(5, 2, 10, true);
    expect(result.newCompleted).toBeGreaterThan(5);
    expect(result.newFailed).toBe(2);
  });
});

// ─── Timing budget logic ──────────────────────────────────────────────────────
// Tests verify the timing check logic independently.

describe('timing budget early return', () => {
  it('returns early when elapsed time exceeds budget before a step', () => {
    const BUDGET = 45000;

    function shouldContinue(startTime: number, now: number): boolean {
      return now - startTime < BUDGET;
    }

    // Scenario: start at 0, now = 50000 (50s elapsed) — over budget
    expect(shouldContinue(0, 50000)).toBe(false);
  });

  it('continues when elapsed time is within budget', () => {
    const BUDGET = 45000;

    function shouldContinue(startTime: number, now: number): boolean {
      return now - startTime < BUDGET;
    }

    // Scenario: start at 0, now = 10000 (10s elapsed) — within budget
    expect(shouldContinue(0, 10000)).toBe(true);
  });

  it('returns early at exactly the budget boundary', () => {
    const BUDGET = 45000;

    function shouldContinue(startTime: number, now: number): boolean {
      return now - startTime < BUDGET;
    }

    // At exactly 45000ms — NOT less than budget, so should NOT continue
    expect(shouldContinue(0, 45000)).toBe(false);
  });

  it('handles non-zero start times correctly', () => {
    const BUDGET = 45000;

    function shouldContinue(startTime: number, now: number): boolean {
      return now - startTime < BUDGET;
    }

    const start = 1000000;
    // 30s elapsed — within budget
    expect(shouldContinue(start, start + 30000)).toBe(true);
    // 46s elapsed — over budget
    expect(shouldContinue(start, start + 46000)).toBe(false);
  });

  it('uses Date.now() pattern — mock verifies early return trigger', () => {
    const BUDGET = 45000;

    let callCount = 0;
    const mockNow = vi.fn(() => {
      callCount++;
      // First call: start time (0)
      // Second call: simulate 50s elapsed
      return callCount === 1 ? 0 : 50000;
    });

    const startTime = mockNow();
    const elapsedCheck = mockNow() - startTime;

    expect(elapsedCheck).toBeGreaterThanOrEqual(BUDGET);
    expect(mockNow).toHaveBeenCalledTimes(2);
  });
});

// ─── parseMarkdownListings — edge cases ──────────────────────────────────────

describe('parseMarkdownListings — edge cases', () => {
  it('handles empty string input gracefully', () => {
    const listings = parseMarkdownListings('');
    expect(listings).toHaveLength(0);
  });

  it('handles whitespace-only input gracefully', () => {
    const listings = parseMarkdownListings('   \n\n   ');
    expect(listings).toHaveLength(0);
  });

  it('ignores content before the first ## heading', () => {
    const markdown = `
Some preamble text here.
This should be ignored.

## Head of Product — Acme
Job description.
`.trim();
    const listings = parseMarkdownListings(markdown);
    expect(listings).toHaveLength(1);
    expect(listings[0].companyName).toBe('Acme');
  });

  it('handles multi-line job descriptions', () => {
    const markdown = `## PM — Company
Line one of description.
Line two of description.
Line three of description.`;
    const listings = parseMarkdownListings(markdown);
    expect(listings[0].jobDescription).toContain('Line one');
    expect(listings[0].jobDescription).toContain('Line two');
    expect(listings[0].jobDescription).toContain('Line three');
  });
});
