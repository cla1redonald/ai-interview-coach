import { describe, it, expect } from 'vitest';

// Test the config module
describe('coach.config.json', () => {
  it('loads without errors', async () => {
    const config = await import('../coach.config.json');
    expect(config).toBeDefined();
  });

  it('has required top-level fields', async () => {
    const config = (await import('../coach.config.json')).default;
    expect(config).toHaveProperty('company');
    expect(config).toHaveProperty('role');
    expect(config).toHaveProperty('branding');
    expect(config).toHaveProperty('personas');
  });

  it('company is a non-empty string', async () => {
    const config = (await import('../coach.config.json')).default;
    expect(typeof config.company).toBe('string');
    expect(config.company.length).toBeGreaterThan(0);
  });

  it('role is a non-empty string', async () => {
    const config = (await import('../coach.config.json')).default;
    expect(typeof config.role).toBe('string');
    expect(config.role.length).toBeGreaterThan(0);
  });

  it('branding has primaryColor and companyUrl', async () => {
    const config = (await import('../coach.config.json')).default;
    expect(config.branding).toHaveProperty('primaryColor');
    expect(config.branding).toHaveProperty('companyUrl');
  });

  it('branding.primaryColor is a valid color', async () => {
    const config = (await import('../coach.config.json')).default;
    const validColors = ['blue', 'green', 'purple', 'orange', 'red', 'indigo'];
    expect(validColors).toContain(config.branding.primaryColor);
  });

  it('personas is an array', async () => {
    const config = (await import('../coach.config.json')).default;
    expect(Array.isArray(config.personas)).toBe(true);
  });

  it('does not contain company-specific OTB references', async () => {
    const config = (await import('../coach.config.json')).default;
    const configStr = JSON.stringify(config).toLowerCase();
    expect(configStr).not.toContain('on the beach');
    expect(configStr).not.toContain('otb');
  });
});

describe('src/lib/config.ts exports', () => {
  it('exports company string', async () => {
    const { company } = await import('../src/lib/config');
    expect(typeof company).toBe('string');
    expect(company.length).toBeGreaterThan(0);
  });

  it('exports role string', async () => {
    const { role } = await import('../src/lib/config');
    expect(typeof role).toBe('string');
    expect(role.length).toBeGreaterThan(0);
  });

  it('exports branding object', async () => {
    const { branding } = await import('../src/lib/config');
    expect(branding).toBeDefined();
    expect(typeof branding.primaryColor).toBe('string');
  });

  it('exports default config object', async () => {
    const config = (await import('../src/lib/config')).default;
    expect(config).toBeDefined();
    expect(config.company).toBeDefined();
    expect(config.role).toBeDefined();
  });
});
