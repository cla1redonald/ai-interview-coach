import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import path from 'path';

// Import the utility functions from personas lib
import { filenameToId, parsePersonaHeader, deriveIcon, defaultPersonas } from '../src/lib/personas';

describe('filenameToId()', () => {
  it('converts simple filename to id', () => {
    expect(filenameToId('CEO_Generic.md')).toBe('ceo-generic');
  });

  it('converts multi-word filename to id', () => {
    expect(filenameToId('VP_Product_Generic.md')).toBe('vp-product-generic');
  });

  it('handles filename without extension gracefully', () => {
    expect(filenameToId('CEO_Generic')).toBe('ceo-generic');
  });

  it('lowercases the result', () => {
    expect(filenameToId('CTO_Generic.md')).toBe('cto-generic');
  });
});

describe('parsePersonaHeader()', () => {
  it('parses well-formed header', () => {
    const content = '# Alex Rivera - Chief Executive Officer\n\nSome content';
    const result = parsePersonaHeader(content, 'alex-rivera');
    expect(result.name).toBe('Alex Rivera');
    expect(result.title).toBe('Chief Executive Officer');
  });

  it('falls back to id when header is malformed', () => {
    const content = 'No header here\n\nSome content';
    const result = parsePersonaHeader(content, 'jordan-chen');
    expect(result.name).toBe('jordan chen');
    expect(result.title).toBe('Interviewer');
  });

  it('handles extra whitespace around separator', () => {
    const content = '# Sam Lee  -  VP Engineering\nContent';
    const result = parsePersonaHeader(content, 'sam-lee');
    expect(result.name).toBe('Sam Lee');
    expect(result.title).toBe('VP Engineering');
  });
});

describe('deriveIcon()', () => {
  it('returns CEO icon for CEO title', () => {
    expect(deriveIcon('Chief Executive Officer')).toBe('👔');
  });

  it('returns CTO icon for CTO title', () => {
    expect(deriveIcon('Chief Technology Officer')).toBe('💻');
  });

  it('returns CFO icon for CFO title', () => {
    expect(deriveIcon('Chief Financial Officer')).toBe('💰');
  });

  it('returns analytics icon for Analytics Director', () => {
    expect(deriveIcon('Analytics Director')).toBe('📊');
  });

  it('returns default icon for unknown title', () => {
    expect(deriveIcon('Mystery Role')).toBe('👤');
  });

  it('is case-insensitive', () => {
    expect(deriveIcon('chief executive officer')).toBe('👔');
  });
});

describe('defaultPersonas', () => {
  it('exports at least 3 personas', () => {
    expect(Object.keys(defaultPersonas).length).toBeGreaterThanOrEqual(3);
  });

  it('each persona has required fields', () => {
    for (const persona of Object.values(defaultPersonas)) {
      expect(persona.id).toBeDefined();
      expect(persona.name).toBeDefined();
      expect(persona.title).toBeDefined();
      expect(typeof persona.id).toBe('string');
      expect(typeof persona.name).toBe('string');
      expect(typeof persona.title).toBe('string');
    }
  });

  it('persona ids match their map keys', () => {
    for (const [key, persona] of Object.entries(defaultPersonas)) {
      expect(persona.id).toBe(key);
    }
  });
});

describe('example personas directory', () => {
  const exampleDir = path.join(process.cwd(), 'personas', 'example');

  it('example directory exists', () => {
    expect(existsSync(exampleDir)).toBe(true);
  });

  it('contains at least 3 persona files', () => {
    const files = readdirSync(exampleDir).filter((f) => f.endsWith('.md'));
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it('each persona file has a valid header', () => {
    const files = readdirSync(exampleDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(path.join(exampleDir, file), 'utf-8');
      const firstLine = content.split('\n')[0];
      expect(firstLine).toMatch(/^#\s+.+\s+-\s+.+/);
    }
  });

  it('each persona file has required sections', () => {
    const requiredSections = [
      'Strategic Priorities',
      'Red Flags',
      'Green Flags',
      'Communication Style',
      'Example Questions',
    ];
    const files = readdirSync(exampleDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(path.join(exampleDir, file), 'utf-8');
      for (const section of requiredSections) {
        expect(content).toContain(section);
      }
    }
  });

  it('no persona contains company-specific references', () => {
    const files = readdirSync(exampleDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const content = readFileSync(path.join(exampleDir, file), 'utf-8').toLowerCase();
      expect(content).not.toContain('on the beach');
      expect(content).not.toContain('otb');
      expect(content).not.toContain('claire');
    }
  });
});
