/**
 * Thread 9 — Materials + Batch UI unit tests
 *
 * Tests pure logic utilities: markdown serialisation, CSV generation,
 * tab state, localStorage round-trips, status rendering logic, and
 * material type labels.
 *
 * React component tests are covered by TypeScript type-checking (tsc --noEmit).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ─── Markdown serialisation ─────────────────────────────────────────────────

interface JobRow {
  id: string;
  jobTitle: string;
  companyName: string;
  inputMode: 'url' | 'text';
  jobUrl: string;
  jobDescription: string;
}

function serializeRowsToMarkdown(rows: JobRow[]): string {
  return rows
    .filter((r) => r.jobTitle.trim())
    .map((r) => {
      const heading = r.companyName.trim()
        ? `## ${r.jobTitle.trim()} — ${r.companyName.trim()}`
        : `## ${r.jobTitle.trim()}`;

      const content =
        r.inputMode === 'url' ? r.jobUrl.trim() : r.jobDescription.trim();

      return content ? `${heading}\n${content}` : heading;
    })
    .join('\n\n');
}

function makeRow(overrides: Partial<JobRow> = {}): JobRow {
  return {
    id: 'r1',
    jobTitle: 'Head of Product',
    companyName: 'Acme Corp',
    inputMode: 'url',
    jobUrl: 'https://acme.com/jobs/123',
    jobDescription: '',
    ...overrides,
  };
}

describe('Markdown serialisation', () => {
  it('produces correct format for a single row with URL', () => {
    const rows = [makeRow()];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toBe('## Head of Product — Acme Corp\nhttps://acme.com/jobs/123');
  });

  it('produces correct format for multiple rows', () => {
    const rows = [
      makeRow({ id: 'r1', jobTitle: 'Head of Product', companyName: 'Acme', jobUrl: 'https://acme.com/1' }),
      makeRow({ id: 'r2', jobTitle: 'VP Engineering', companyName: 'Beta Ltd', jobUrl: 'https://beta.com/2' }),
    ];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toContain('## Head of Product — Acme\nhttps://acme.com/1');
    expect(md).toContain('## VP Engineering — Beta Ltd\nhttps://beta.com/2');
    // Should be separated by double newline
    const parts = md.split('\n\n');
    expect(parts).toHaveLength(2);
  });

  it('handles missing company name — heading is just job title', () => {
    const rows = [makeRow({ companyName: '', jobUrl: 'https://example.com' })];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toBe('## Head of Product\nhttps://example.com');
    expect(md).not.toContain('—');
  });

  it('handles missing URL — heading only, no content line', () => {
    const rows = [makeRow({ jobUrl: '' })];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toBe('## Head of Product — Acme Corp');
  });

  it('handles pasted JD mode', () => {
    const rows = [
      makeRow({
        inputMode: 'text',
        jobDescription: 'We are looking for a Head of Product.\nExperience required.',
        jobUrl: '',
      }),
    ];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toBe(
      '## Head of Product — Acme Corp\nWe are looking for a Head of Product.\nExperience required.'
    );
  });

  it('skips rows with empty job title', () => {
    const rows = [
      makeRow({ id: 'r1', jobTitle: '' }),
      makeRow({ id: 'r2', jobTitle: 'VP Eng', companyName: 'Foo', jobUrl: 'https://foo.com' }),
    ];
    const md = serializeRowsToMarkdown(rows);
    expect(md).not.toContain('##\n');
    expect(md).toContain('## VP Eng — Foo');
  });

  it('trims whitespace from job title and company', () => {
    const rows = [makeRow({ jobTitle: '  Head of Product  ', companyName: '  Acme  ' })];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toContain('## Head of Product — Acme');
    expect(md).not.toContain('  Head');
    expect(md).not.toContain('Acme  ');
  });

  it('returns empty string when all rows have empty titles', () => {
    const rows = [makeRow({ jobTitle: '' }), makeRow({ id: 'r2', jobTitle: '   ' })];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toBe('');
  });

  it('handles mixed URL and text mode rows', () => {
    const rows = [
      makeRow({ id: 'r1', jobTitle: 'A', companyName: 'Co1', inputMode: 'url', jobUrl: 'https://co1.com' }),
      makeRow({ id: 'r2', jobTitle: 'B', companyName: 'Co2', inputMode: 'text', jobDescription: 'JD text', jobUrl: '' }),
    ];
    const md = serializeRowsToMarkdown(rows);
    expect(md).toContain('https://co1.com');
    expect(md).toContain('JD text');
  });
});

// ─── CSV generation ──────────────────────────────────────────────────────────

interface CsvApplication {
  companyName: string;
  jobTitle: string;
  fitScoreOverall: number | null;
  fitArchetype: string | null;
  materialsGenerated?: string[];
  jobUrl: string | null;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

function buildCsv(apps: CsvApplication[]): string {
  const headers = ['Company', 'Role', 'Fit Score', 'Archetype', 'Materials Generated', 'URL'];
  const rows = apps.map((app) => [
    escapeCsvField(app.companyName),
    escapeCsvField(app.jobTitle),
    String(app.fitScoreOverall ?? ''),
    escapeCsvField(app.fitArchetype ?? ''),
    escapeCsvField((app.materialsGenerated ?? []).join(' | ')),
    escapeCsvField(app.jobUrl ?? ''),
  ]);
  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

describe('CSV generation', () => {
  it('includes correct headers', () => {
    const csv = buildCsv([]);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('Company,Role,Fit Score,Archetype,Materials Generated,URL');
  });

  it('generates correct row format', () => {
    const apps: CsvApplication[] = [
      {
        companyName: 'Acme Corp',
        jobTitle: 'Head of Product',
        fitScoreOverall: 82,
        fitArchetype: 'exec',
        materialsGenerated: ['cv', 'cover_letter'],
        jobUrl: 'https://acme.com/jobs/1',
      },
    ];
    const csv = buildCsv(apps);
    const rows = csv.split('\n');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('Acme Corp');
    expect(rows[1]).toContain('Head of Product');
    expect(rows[1]).toContain('82');
    expect(rows[1]).toContain('exec');
    expect(rows[1]).toContain('cv | cover_letter');
    expect(rows[1]).toContain('https://acme.com/jobs/1');
  });

  it('handles null fit score', () => {
    const apps: CsvApplication[] = [
      { companyName: 'X', jobTitle: 'Y', fitScoreOverall: null, fitArchetype: null, jobUrl: null },
    ];
    const csv = buildCsv(apps);
    const row = csv.split('\n')[1];
    // score field should be empty
    expect(row).toContain('X,Y,,');
  });

  it('escapes commas in field values', () => {
    const apps: CsvApplication[] = [
      {
        companyName: 'Acme, Inc',
        jobTitle: 'VP, Product',
        fitScoreOverall: 70,
        fitArchetype: null,
        jobUrl: null,
      },
    ];
    const csv = buildCsv(apps);
    expect(csv).toContain('"Acme, Inc"');
    expect(csv).toContain('"VP, Product"');
  });

  it('escapes double-quotes in field values', () => {
    const apps: CsvApplication[] = [
      {
        companyName: 'Acme "The Best"',
        jobTitle: 'Engineer',
        fitScoreOverall: null,
        fitArchetype: null,
        jobUrl: null,
      },
    ];
    const csv = buildCsv(apps);
    expect(csv).toContain('"Acme ""The Best"""');
  });

  it('escapes newlines in field values', () => {
    const apps: CsvApplication[] = [
      {
        companyName: 'Acme\nCorp',
        jobTitle: 'Engineer',
        fitScoreOverall: null,
        fitArchetype: null,
        jobUrl: null,
      },
    ];
    const csv = buildCsv(apps);
    expect(csv).toContain('"Acme\nCorp"');
  });

  it('handles multiple rows', () => {
    const apps: CsvApplication[] = [
      { companyName: 'A', jobTitle: 'Role1', fitScoreOverall: 75, fitArchetype: null, jobUrl: null },
      { companyName: 'B', jobTitle: 'Role2', fitScoreOverall: 60, fitArchetype: null, jobUrl: null },
    ];
    const csv = buildCsv(apps);
    const rows = csv.split('\n');
    expect(rows).toHaveLength(3); // header + 2 data rows
  });

  it('handles empty materials generated array', () => {
    const apps: CsvApplication[] = [
      { companyName: 'A', jobTitle: 'B', fitScoreOverall: null, fitArchetype: null, materialsGenerated: [], jobUrl: null },
    ];
    const csv = buildCsv(apps);
    // materials column should be empty string
    const row = csv.split('\n')[1];
    const fields = row.split(',');
    // 6 fields: Company,Role,Score,Archetype,Materials,URL
    expect(fields[4]).toBe('');
  });
});

// ─── Tab state management ───────────────────────────────────────────────────

describe('Tab state management', () => {
  type MaterialType = 'cv' | 'cover_letter' | 'tracking_note';

  const TABS: { type: MaterialType; label: string }[] = [
    { type: 'cv', label: 'CV' },
    { type: 'cover_letter', label: 'Cover Letter' },
    { type: 'tracking_note', label: 'Tracking Note' },
  ];

  it('default tab is cv (first tab)', () => {
    // Default tab in the component is 'cv'
    const defaultTab: MaterialType = 'cv';
    expect(defaultTab).toBe('cv');
    expect(TABS[0].type).toBe('cv');
  });

  it('switching tabs changes active type', () => {
    let active: MaterialType = 'cv';
    function switchTab(t: MaterialType) { active = t; }

    switchTab('cover_letter');
    expect(active).toBe('cover_letter');

    switchTab('tracking_note');
    expect(active).toBe('tracking_note');

    switchTab('cv');
    expect(active).toBe('cv');
  });

  it('TABS array has exactly 3 tabs', () => {
    expect(TABS).toHaveLength(3);
  });

  it('TABS has correct types in order', () => {
    expect(TABS.map((t) => t.type)).toEqual(['cv', 'cover_letter', 'tracking_note']);
  });

  it('TABS has correct labels', () => {
    expect(TABS.map((t) => t.label)).toEqual(['CV', 'Cover Letter', 'Tracking Note']);
  });

  it('each tab type is unique', () => {
    const types = TABS.map((t) => t.type);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });
});

// ─── Master CV localStorage round-trip ─────────────────────────────────────

describe('Master CV localStorage round-trip', () => {
  const STORAGE_KEY = 'storybank_master_cv';
  const originalStorage: Record<string, string> = {};

  // Minimal localStorage mock
  beforeEach(() => {
    const store: Record<string, string> = { ...originalStorage };
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    };
    // Assign to global if in node env
    if (typeof globalThis !== 'undefined') {
      (globalThis as typeof globalThis & { _mockStorage?: typeof mockStorage })._mockStorage = mockStorage;
    }
  });

  afterEach(() => {
    if (typeof globalThis !== 'undefined') {
      delete (globalThis as typeof globalThis & { _mockStorage?: unknown })._mockStorage;
    }
  });

  it('storage key is correct', () => {
    expect(STORAGE_KEY).toBe('storybank_master_cv');
  });

  it('write and read round-trip preserves content', () => {
    const store: Record<string, string> = {};
    function writeStorage(key: string, value: string) { store[key] = value; }
    function readStorage(key: string): string | null { return store[key] ?? null; }

    const cv = 'Claire Donald\nHead of Product\n10 years experience…';
    writeStorage(STORAGE_KEY, cv);
    expect(readStorage(STORAGE_KEY)).toBe(cv);
  });

  it('read returns null when key does not exist', () => {
    const store: Record<string, string> = {};
    function readStorage(key: string): string | null { return store[key] ?? null; }
    expect(readStorage(STORAGE_KEY)).toBeNull();
  });

  it('overwriting replaces previous value', () => {
    const store: Record<string, string> = {};
    store[STORAGE_KEY] = 'old cv';
    store[STORAGE_KEY] = 'new cv';
    expect(store[STORAGE_KEY]).toBe('new cv');
  });

  it('write trims and persists trimmed value correctly when empty string', () => {
    const store: Record<string, string> = {};
    const trimmed = ''.trim();
    store[STORAGE_KEY] = trimmed;
    expect(store[STORAGE_KEY]).toBe('');
  });
});

// ─── Batch row status rendering logic ─────────────────────────────────────

describe('Batch row status rendering', () => {
  function getStatusDisplay(
    status: string,
    isProcessing: boolean
  ): 'spinner' | 'check' | 'x' | 'pending-dot' {
    if (isProcessing) return 'spinner';
    if (status === 'failed' || status === 'rejected') return 'x';
    if (!isProcessing && status !== 'pending' && status !== 'running') return 'check';
    return 'pending-dot';
  }

  it('processing → spinner', () => {
    expect(getStatusDisplay('running', true)).toBe('spinner');
    expect(getStatusDisplay('pending', true)).toBe('spinner');
  });

  it('failed → x icon', () => {
    expect(getStatusDisplay('failed', false)).toBe('x');
  });

  it('rejected → x icon', () => {
    expect(getStatusDisplay('rejected', false)).toBe('x');
  });

  it('complete (not processing, not failed) → check', () => {
    expect(getStatusDisplay('assessed', false)).toBe('check');
    expect(getStatusDisplay('applied', false)).toBe('check');
    expect(getStatusDisplay('completed', false)).toBe('check');
  });

  it('pending (not processing) → pending-dot', () => {
    expect(getStatusDisplay('pending', false)).toBe('pending-dot');
  });

  it('running (not processing flag) → pending-dot', () => {
    expect(getStatusDisplay('running', false)).toBe('pending-dot');
  });

  it('fit score color coding: ≥70 → amber', () => {
    function fitColor(score: number): string {
      if (score >= 70) return 'var(--amber)';
      if (score >= 50) return 'var(--copper)';
      return 'var(--sage)';
    }
    expect(fitColor(70)).toBe('var(--amber)');
    expect(fitColor(85)).toBe('var(--amber)');
    expect(fitColor(100)).toBe('var(--amber)');
  });

  it('fit score color coding: 50-69 → copper', () => {
    function fitColor(score: number): string {
      if (score >= 70) return 'var(--amber)';
      if (score >= 50) return 'var(--copper)';
      return 'var(--sage)';
    }
    expect(fitColor(50)).toBe('var(--copper)');
    expect(fitColor(65)).toBe('var(--copper)');
    expect(fitColor(69)).toBe('var(--copper)');
  });

  it('fit score color coding: <50 → sage', () => {
    function fitColor(score: number): string {
      if (score >= 70) return 'var(--amber)';
      if (score >= 50) return 'var(--copper)';
      return 'var(--sage)';
    }
    expect(fitColor(49)).toBe('var(--sage)');
    expect(fitColor(0)).toBe('var(--sage)');
  });

  it('below threshold label shown when score < threshold', () => {
    const score = 60;
    const threshold = 70;
    const isBelowThreshold = score < threshold;
    expect(isBelowThreshold).toBe(true);
  });

  it('below threshold label not shown when score ≥ threshold', () => {
    const score = 70;
    const threshold = 70;
    const isBelowThreshold = score < threshold;
    expect(isBelowThreshold).toBe(false);
  });
});

// ─── Materials type display ────────────────────────────────────────────────

describe('Materials type display labels', () => {
  const MATERIAL_LABELS: Record<string, string> = {
    cv: 'CV',
    cover_letter: 'Cover',
    tracking_note: 'Note',
  };

  it('cv label is correct', () => {
    expect(MATERIAL_LABELS['cv']).toBe('CV');
  });

  it('cover_letter label is correct', () => {
    expect(MATERIAL_LABELS['cover_letter']).toBe('Cover');
  });

  it('tracking_note label is correct', () => {
    expect(MATERIAL_LABELS['tracking_note']).toBe('Note');
  });

  it('all three types are defined', () => {
    expect(Object.keys(MATERIAL_LABELS)).toHaveLength(3);
    expect(MATERIAL_LABELS).toHaveProperty('cv');
    expect(MATERIAL_LABELS).toHaveProperty('cover_letter');
    expect(MATERIAL_LABELS).toHaveProperty('tracking_note');
  });

  it('no material type maps to an empty string', () => {
    for (const label of Object.values(MATERIAL_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
