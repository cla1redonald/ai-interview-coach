/**
 * Unit tests for extractCompanyUrl helper.
 *
 * This is a pure function — no mocking required.
 */

import { describe, it, expect } from 'vitest';
import { extractCompanyUrl } from '../src/lib/utils/extract-company-url';

// ─── Happy path — ATS path-based URLs ────────────────────────────────────────

describe('extractCompanyUrl — ATS path patterns', () => {
  it('extracts slug from Greenhouse path URL', () => {
    const result = extractCompanyUrl(
      'https://boards.greenhouse.io/airbox/jobs/123456',
      'Airbox'
    );
    expect(result).toBe('https://airbox.com');
  });

  it('extracts slug from Lever URL', () => {
    const result = extractCompanyUrl(
      'https://jobs.lever.co/stripe/abc-def-123',
      'Stripe'
    );
    expect(result).toBe('https://stripe.com');
  });

  it('extracts slug from Workable apply URL', () => {
    const result = extractCompanyUrl(
      'https://apply.workable.com/monzo/j/ABCDEF/',
      'Monzo'
    );
    expect(result).toBe('https://monzo.com');
  });
});

// ─── Happy path — ATS subdomain patterns ─────────────────────────────────────

describe('extractCompanyUrl — ATS subdomain patterns', () => {
  it('extracts subdomain from Greenhouse subdomain URL', () => {
    const result = extractCompanyUrl(
      'https://deliveroo.greenhouse.io/jobs/12345',
      'Deliveroo'
    );
    expect(result).toBe('https://deliveroo.com');
  });

  it('extracts subdomain from BambooHR URL', () => {
    const result = extractCompanyUrl(
      'https://acme.bamboohr.com/jobs/view.php?id=123',
      'Acme Corp'
    );
    expect(result).toBe('https://acme.com');
  });
});

// ─── Happy path — Direct career sites ────────────────────────────────────────

describe('extractCompanyUrl — direct career subdomain', () => {
  it('strips careers. subdomain', () => {
    const result = extractCompanyUrl(
      'https://careers.monzo.com/jobs/senior-pm',
      'Monzo'
    );
    expect(result).toBe('https://monzo.com');
  });

  it('strips jobs. subdomain', () => {
    const result = extractCompanyUrl(
      'https://jobs.gocardless.com/engineering/123',
      'GoCardless'
    );
    expect(result).toBe('https://gocardless.com');
  });

  it('strips apply. subdomain', () => {
    const result = extractCompanyUrl(
      'https://apply.example.com/positions/456',
      'Example'
    );
    expect(result).toBe('https://example.com');
  });
});

// ─── Happy path — Direct company URLs ────────────────────────────────────────

describe('extractCompanyUrl — direct company URLs', () => {
  it('returns root domain for a direct company job page', () => {
    const result = extractCompanyUrl(
      'https://www.acme.com/careers/software-engineer',
      'Acme'
    );
    expect(result).toBe('https://www.acme.com');
  });
});

// ─── Fallback — company name heuristic ───────────────────────────────────────

describe('extractCompanyUrl — company name fallback', () => {
  it('constructs URL from company name when jobUrl is null', () => {
    const result = extractCompanyUrl(null, 'Airbox');
    expect(result).toBe('https://airbox.com');
  });

  it('lowercases company name', () => {
    const result = extractCompanyUrl(null, 'STRIPE');
    expect(result).toBe('https://stripe.com');
  });

  it('removes spaces from multi-word company name', () => {
    const result = extractCompanyUrl(null, 'Go Cardless');
    expect(result).toBe('https://gocardless.com');
  });

  it('strips special characters from company name', () => {
    const result = extractCompanyUrl(null, 'Acme & Co.');
    expect(result).toBe('https://acmeco.com');
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('extractCompanyUrl — edge cases', () => {
  it('returns null when both jobUrl and companyName are absent', () => {
    const result = extractCompanyUrl(null, '');
    expect(result).toBeNull();
  });

  it('returns null when companyName produces an empty slug', () => {
    const result = extractCompanyUrl(null, '!!??**');
    expect(result).toBeNull();
  });

  it('handles invalid jobUrl gracefully and falls back to company name', () => {
    const result = extractCompanyUrl('not-a-valid-url', 'Airbox');
    expect(result).toBe('https://airbox.com');
  });

  it('handles a URL with no path gracefully', () => {
    const result = extractCompanyUrl('https://example.com', 'Example');
    expect(result).toBe('https://example.com');
  });
});
