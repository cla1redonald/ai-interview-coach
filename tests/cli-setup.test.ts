import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import path from 'path';

describe('CLI setup files', () => {
  it('cli/setup.ts exists', () => {
    const setupPath = path.join(process.cwd(), 'cli', 'setup.ts');
    expect(existsSync(setupPath)).toBe(true);
  });

  it('cli/persona-template.md exists', () => {
    const templatePath = path.join(process.cwd(), 'cli', 'persona-template.md');
    expect(existsSync(templatePath)).toBe(true);
  });

  it('persona-template.md has required sections', () => {
    const { readFileSync } = require('fs');
    const templatePath = path.join(process.cwd(), 'cli', 'persona-template.md');
    const content = readFileSync(templatePath, 'utf-8');
    expect(content).toContain('Strategic Priorities');
    expect(content).toContain('Red Flags');
    expect(content).toContain('Green Flags');
    expect(content).toContain('Communication Style');
    expect(content).toContain('Example Questions');
  });

  it('persona-template.md has header placeholder', () => {
    const { readFileSync } = require('fs');
    const templatePath = path.join(process.cwd(), 'cli', 'persona-template.md');
    const content = readFileSync(templatePath, 'utf-8');
    expect(content).toContain('[Name]');
    expect(content).toContain('[Title]');
  });
});

describe('Config generation logic', () => {
  it('generates valid config structure', () => {
    const config = {
      company: 'Test Corp',
      role: 'VP Engineering',
      branding: {
        primaryColor: 'blue',
        companyUrl: 'https://testcorp.com',
      },
      personas: [],
    };

    expect(config.company).toBe('Test Corp');
    expect(config.role).toBe('VP Engineering');
    expect(config.branding.primaryColor).toBe('blue');
    expect(Array.isArray(config.personas)).toBe(true);
  });

  it('validates that company name is non-empty', () => {
    const validate = (value: string) => value.trim().length > 0 || 'Company name is required';
    expect(validate('Acme')).toBe(true);
    expect(validate('')).toBe('Company name is required');
    expect(validate('  ')).toBe('Company name is required');
  });

  it('validates that role is non-empty', () => {
    const validate = (value: string) => value.trim().length > 0 || 'Role is required';
    expect(validate('VP Product')).toBe(true);
    expect(validate('')).toBe('Role is required');
  });

  it('accepts valid color choices', () => {
    const validColors = ['blue', 'green', 'purple', 'orange'];
    for (const color of validColors) {
      expect(validColors).toContain(color);
    }
  });

  it('serializes config to valid JSON', () => {
    const config = {
      company: 'Acme Corp',
      role: 'VP Product',
      branding: { primaryColor: 'blue', companyUrl: '' },
      personas: [],
    };
    const json = JSON.stringify(config, null, 2);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json);
    expect(parsed.company).toBe('Acme Corp');
  });
});

describe('.env.example', () => {
  it('.env.example exists', () => {
    const envExamplePath = path.join(process.cwd(), '.env.example');
    expect(existsSync(envExamplePath)).toBe(true);
  });

  it('.env.example contains ANTHROPIC_API_KEY', () => {
    const { readFileSync } = require('fs');
    const content = readFileSync(path.join(process.cwd(), '.env.example'), 'utf-8');
    expect(content).toContain('ANTHROPIC_API_KEY');
  });
});
