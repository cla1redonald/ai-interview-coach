/**
 * Unit tests for Phase 2 field-level encryption extensions.
 *
 * Tests cover:
 * - encryptJobDescription / decryptJobDescription
 * - encryptResearchFields / decryptResearchFields
 * - No-op behaviour when fields are null (research fields)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  encryptJobDescription,
  decryptJobDescription,
  encryptResearchFields,
  decryptResearchFields,
  isEncryptionEnabled,
} from '../src/lib/encryption/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

const TEST_KEY = 'test-encryption-key-for-unit-tests-only-32chars!!';

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
});

// ─── encryptJobDescription / decryptJobDescription ───────────────────────────

describe('encryptJobDescription / decryptJobDescription', () => {
  it('round-trips a typical job description', () => {
    const original = 'We are looking for a Senior Product Manager to join our team...';
    const enc = encryptJobDescription({ jobDescription: original });
    const dec = decryptJobDescription({ jobDescription: enc.jobDescription });
    expect(dec.jobDescription).toBe(original);
  });

  it('encrypts: stored value differs from plaintext', () => {
    const original = 'job description content';
    const enc = encryptJobDescription({ jobDescription: original });
    expect(enc.jobDescription).not.toBe(original);
  });

  it('round-trips an empty job description', () => {
    const enc = encryptJobDescription({ jobDescription: '' });
    const dec = decryptJobDescription({ jobDescription: enc.jobDescription });
    expect(dec.jobDescription).toBe('');
  });

  it('round-trips a long job description (50k chars)', () => {
    const original = 'x'.repeat(50000);
    const enc = encryptJobDescription({ jobDescription: original });
    const dec = decryptJobDescription({ jobDescription: enc.jobDescription });
    expect(dec.jobDescription).toBe(original);
  });

  it('encrypted value is a string (TEXT-column safe)', () => {
    const enc = encryptJobDescription({ jobDescription: 'test' });
    expect(typeof enc.jobDescription).toBe('string');
  });
});

// ─── encryptResearchFields / decryptResearchFields ───────────────────────────

describe('encryptResearchFields / decryptResearchFields', () => {
  it('round-trips all three fields', () => {
    const fields = {
      recentNews: '- Raised Series B in Q1 2025',
      cultureSignals: 'Glassdoor 4.1/5, flexible working mentioned',
      keyPeople: 'CEO: Jane Smith (ex-Google)',
    };
    const enc = encryptResearchFields(fields);
    const dec = decryptResearchFields(enc);
    expect(dec.recentNews).toBe(fields.recentNews);
    expect(dec.cultureSignals).toBe(fields.cultureSignals);
    expect(dec.keyPeople).toBe(fields.keyPeople);
  });

  it('preserves null fields (does not encrypt nulls)', () => {
    const fields = { recentNews: null, cultureSignals: null, keyPeople: null };
    const enc = encryptResearchFields(fields);
    expect(enc.recentNews).toBeNull();
    expect(enc.cultureSignals).toBeNull();
    expect(enc.keyPeople).toBeNull();
  });

  it('handles mixed null / non-null fields', () => {
    const fields = {
      recentNews: 'Some news',
      cultureSignals: null,
      keyPeople: 'CEO: Alice',
    };
    const enc = encryptResearchFields(fields);
    const dec = decryptResearchFields(enc);
    expect(dec.recentNews).toBe('Some news');
    expect(dec.cultureSignals).toBeNull();
    expect(dec.keyPeople).toBe('CEO: Alice');
  });

  it('encrypts: stored non-null values differ from plaintext', () => {
    const fields = {
      recentNews: 'news content',
      cultureSignals: 'culture content',
      keyPeople: 'people content',
    };
    const enc = encryptResearchFields(fields);
    expect(enc.recentNews).not.toBe(fields.recentNews);
    expect(enc.cultureSignals).not.toBe(fields.cultureSignals);
    expect(enc.keyPeople).not.toBe(fields.keyPeople);
  });

  it('encrypts fields independently (same plaintext → different ciphertext)', () => {
    const fields = {
      recentNews: 'same text',
      cultureSignals: 'same text',
      keyPeople: 'same text',
    };
    const enc = encryptResearchFields(fields);
    // Each field should produce a different ciphertext (random IV per encryption)
    expect(enc.recentNews).not.toBe(enc.cultureSignals);
    expect(enc.recentNews).not.toBe(enc.keyPeople);
  });

  it('round-trips markdown content with special chars', () => {
    const fields = {
      recentNews: '- **Funding:** £12M Series A (2024)\n- CEO quoted: "We\'re doubling down on AI"',
      cultureSignals: null,
      keyPeople: null,
    };
    const enc = encryptResearchFields(fields);
    const dec = decryptResearchFields(enc);
    expect(dec.recentNews).toBe(fields.recentNews);
  });
});

// ─── isEncryptionEnabled guard ────────────────────────────────────────────────

describe('isEncryptionEnabled', () => {
  it('returns true when ENCRYPTION_KEY is set', () => {
    expect(isEncryptionEnabled()).toBe(true);
  });

  it('returns false when ENCRYPTION_KEY is absent', () => {
    delete process.env.ENCRYPTION_KEY;
    expect(isEncryptionEnabled()).toBe(false);
  });
});
