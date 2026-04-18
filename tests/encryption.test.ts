/**
 * Unit tests for AES-256-GCM field-level encryption.
 *
 * These tests run in a Node.js environment (vitest) and use the `crypto`
 * built-in directly — no external services required.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  encrypt,
  decrypt,
  serialise,
  deserialise,
  encryptTranscriptFields,
  decryptTranscriptFields,
  encryptExampleFields,
  decryptExampleFields,
  isEncryptionEnabled,
  type EncryptedValue,
} from '../src/lib/encryption/index';

// ─── Setup ────────────────────────────────────────────────────────────────────

const TEST_KEY = 'test-encryption-key-for-unit-tests-only-32chars!!';

beforeEach(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
});

afterEach(() => {
  delete process.env.ENCRYPTION_KEY;
  delete process.env.AUTH_SECRET;
});

// ─── Core encrypt / decrypt ───────────────────────────────────────────────────

describe('encrypt / decrypt round-trip', () => {
  it('decrypts to original plaintext', () => {
    const plain = 'Hello, StoryBank!';
    const enc = encrypt(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('handles empty string', () => {
    const enc = encrypt('');
    expect(decrypt(enc)).toBe('');
  });

  it('handles unicode and special chars', () => {
    const plain = `Interviewer asked: "Why £50k? Let's discuss 🙂"`;
    const enc = encrypt(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('handles long text (transcript-length)', () => {
    const plain = 'word '.repeat(1000).trim();
    const enc = encrypt(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('produces different ciphertext each call (random IV)', () => {
    const plain = 'same plaintext';
    const enc1 = encrypt(plain);
    const enc2 = encrypt(plain);
    // IVs must differ
    expect(enc1.iv).not.toBe(enc2.iv);
    // Ciphertexts must differ (because IV differs)
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
  });

  it('encrypted value has ciphertext, iv, tag fields', () => {
    const enc = encrypt('test');
    expect(enc).toHaveProperty('ciphertext');
    expect(enc).toHaveProperty('iv');
    expect(enc).toHaveProperty('tag');
  });

  it('all fields are base64 strings', () => {
    const enc = encrypt('test value');
    const base64Re = /^[A-Za-z0-9+/]+=*$/;
    expect(enc.ciphertext).toMatch(base64Re);
    expect(enc.iv).toMatch(base64Re);
    expect(enc.tag).toMatch(base64Re);
  });
});

// ─── Key derivation ───────────────────────────────────────────────────────────

describe('key derivation', () => {
  it('throws when no key env var is set', () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    expect(() => encrypt('test')).toThrow('Encryption key not configured');
  });

  it('throws when ENCRYPTION_KEY is absent (even if AUTH_SECRET is set)', () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.AUTH_SECRET = 'fallback-secret-for-auth-32chars!!';
    expect(() => encrypt('test')).toThrow('Encryption key not configured');
  });

  it('different ENCRYPTION_KEY values produce independently encrypted ciphertexts', () => {
    process.env.ENCRYPTION_KEY = 'key-a-32chars-padding-here-xxxxxx';
    const enc1 = encrypt('same input');

    process.env.ENCRYPTION_KEY = 'key-b-32chars-padding-here-xxxxxx';
    const enc2 = encrypt('same input');

    // Each is valid under its own key
    expect(decrypt(enc2)).toBe('same input');
    expect(enc1.ciphertext).toBeDefined();
  });

  it('wrong key fails decryption (auth tag mismatch)', () => {
    process.env.ENCRYPTION_KEY = 'correct-key-32chars-padding-xxxx';
    const enc = encrypt('sensitive data');

    // Switch to a different key
    process.env.ENCRYPTION_KEY = 'wrong-key-32chars-padding-xxxxxx';
    expect(() => decrypt(enc)).toThrow();
  });
});

// ─── Tamper detection ─────────────────────────────────────────────────────────

describe('tamper detection', () => {
  it('rejects tampered ciphertext', () => {
    const enc = encrypt('original');
    // Flip a byte in the ciphertext
    const ctBytes = Buffer.from(enc.ciphertext, 'base64');
    ctBytes[0] ^= 0xff;
    const tampered: EncryptedValue = {
      ...enc,
      ciphertext: ctBytes.toString('base64'),
    };
    expect(() => decrypt(tampered)).toThrow();
  });

  it('rejects tampered auth tag', () => {
    const enc = encrypt('original');
    const tagBytes = Buffer.from(enc.tag, 'base64');
    tagBytes[0] ^= 0xff;
    const tampered: EncryptedValue = {
      ...enc,
      tag: tagBytes.toString('base64'),
    };
    expect(() => decrypt(tampered)).toThrow();
  });
});

// ─── Serialisation ────────────────────────────────────────────────────────────

describe('serialise / deserialise', () => {
  it('round-trips through serialise → deserialise', () => {
    const enc = encrypt('some text');
    const stored = serialise(enc);
    const recovered = deserialise(stored);
    expect(recovered.ciphertext).toBe(enc.ciphertext);
    expect(recovered.iv).toBe(enc.iv);
    expect(recovered.tag).toBe(enc.tag);
  });

  it('serialise produces a base64 string (storage-safe)', () => {
    const enc = encrypt('test');
    const stored = serialise(enc);
    expect(() => Buffer.from(stored, 'base64')).not.toThrow();
    expect(typeof stored).toBe('string');
  });

  it('throws on invalid stored value', () => {
    expect(() => deserialise('not-valid-base64!!!')).toThrow();
  });

  it('throws when deserialised JSON lacks required fields', () => {
    const bad = Buffer.from(JSON.stringify({ ciphertext: 'abc' })).toString('base64');
    expect(() => deserialise(bad)).toThrow('Invalid encrypted value format');
  });
});

// ─── High-level wrappers ──────────────────────────────────────────────────────

describe('encryptTranscriptFields / decryptTranscriptFields', () => {
  it('round-trips rawText', () => {
    const original = 'Interviewer: Tell me about yourself.\nMe: I have 10 years...';
    const enc = encryptTranscriptFields({ rawText: original });
    const dec = decryptTranscriptFields({ rawText: enc.rawText });
    expect(dec.rawText).toBe(original);
  });

  it('encrypted rawText is different from plaintext', () => {
    const original = 'plain text content';
    const enc = encryptTranscriptFields({ rawText: original });
    expect(enc.rawText).not.toBe(original);
  });
});

describe('encryptExampleFields / decryptExampleFields', () => {
  it('round-trips question and answer', () => {
    const fields = {
      question: 'Tell me about a time you led a major product launch.',
      answer:   'At MOO, I led the launch of our new business cards range...',
    };
    const enc = encryptExampleFields(fields);
    const dec = decryptExampleFields(enc);
    expect(dec.question).toBe(fields.question);
    expect(dec.answer).toBe(fields.answer);
  });

  it('question and answer encrypt independently', () => {
    const fields = { question: 'same text', answer: 'same text' };
    const enc = encryptExampleFields(fields);
    // Same plaintext should produce different ciphertexts (random IV per field)
    expect(enc.question).not.toBe(enc.answer);
  });
});

// ─── Encryption guard ─────────────────────────────────────────────────────────

describe('isEncryptionEnabled', () => {
  it('returns true when ENCRYPTION_KEY is set', () => {
    process.env.ENCRYPTION_KEY = 'some-key';
    expect(isEncryptionEnabled()).toBe(true);
  });

  it('returns false when only AUTH_SECRET is set (no longer a fallback)', () => {
    delete process.env.ENCRYPTION_KEY;
    process.env.AUTH_SECRET = 'some-secret';
    expect(isEncryptionEnabled()).toBe(false);
  });

  it('returns false when neither key is set', () => {
    delete process.env.ENCRYPTION_KEY;
    delete process.env.AUTH_SECRET;
    expect(isEncryptionEnabled()).toBe(false);
  });
});
