import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  encrypt,
  decrypt,
  serialise,
  deserialise,
} from './index';

// ─── Core AES-256-GCM round-trip (key derivation requires ENCRYPTION_KEY) ────

describe('encrypt / decrypt round-trip', () => {
  const TEST_KEY = 'test-encryption-key-for-unit-tests-only';
  let original: string | undefined;

  beforeAll(() => {
    original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (original === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it('decrypts back to original plaintext for a short string', () => {
    const plain = 'Hello, this is a cover letter.';
    const enc = encrypt(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('decrypts back to original plaintext for multiline markdown', () => {
    const plain = `# CV\n\n## Experience\n\nSenior PM at Acme (2020-2024)\n- Led growth by 40%`;
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('produces different ciphertext on repeated calls (random IV)', () => {
    const plain = 'Same content twice';
    const enc1 = encrypt(plain);
    const enc2 = encrypt(plain);
    expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    expect(enc1.iv).not.toBe(enc2.iv);
  });

  it('throws on tampered auth tag', () => {
    const plain = 'Tamper test';
    const enc = encrypt(plain);
    // Flip a byte in the tag
    const tagBytes = Buffer.from(enc.tag, 'base64');
    tagBytes[0] ^= 0xff;
    const tampered = { ...enc, tag: tagBytes.toString('base64') };
    expect(() => decrypt(tampered)).toThrow();
  });
});

// ─── serialise / deserialise ──────────────────────────────────────────────────

describe('serialise / deserialise', () => {
  const TEST_KEY = 'test-serialise-key';
  let original: string | undefined;

  beforeAll(() => {
    original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (original === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it('round-trips through serialise → deserialise', () => {
    const plain = 'Cover letter content';
    const enc = encrypt(plain);
    const stored = serialise(enc);
    const restored = deserialise(stored);
    expect(restored.ciphertext).toBe(enc.ciphertext);
    expect(restored.iv).toBe(enc.iv);
    expect(restored.tag).toBe(enc.tag);
  });

  it('serialised value is a base64 string', () => {
    const enc = encrypt('test');
    const stored = serialise(enc);
    // base64 characters only
    expect(stored).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it('throws on invalid stored format', () => {
    expect(() => deserialise('not-valid-base64-json')).toThrow();
  });

  it('full pipeline: encrypt → serialise → deserialise → decrypt', () => {
    const plain = 'Full pipeline test for material content';
    const stored = serialise(encrypt(plain));
    const result = decrypt(deserialise(stored));
    expect(result).toBe(plain);
  });
});

// ─── encryptMaterialContent / decryptMaterialContent guard ───────────────────
//
// We test the high-level wrappers by importing them at module level.
// The ENCRYPTION_KEY is set for the first two suites above; here we test the
// no-op path (no key set) by temporarily deleting it.

describe('material content helper — no-op when key not set', () => {
  let original: string | undefined;

  beforeAll(() => {
    original = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
  });

  afterAll(() => {
    if (original !== undefined) {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it('encryptMaterialContent returns input unchanged when no key is set', async () => {
    // Use static import path — vitest will re-evaluate isEncryptionEnabled()
    // at call time because it reads process.env inline
    const { encryptMaterialContent } = await import('./index');
    const plain = 'Plaintext material';
    expect(encryptMaterialContent(plain)).toBe(plain);
  });

  it('decryptMaterialContent returns input unchanged when no key is set', async () => {
    const { decryptMaterialContent } = await import('./index');
    const plain = 'Already plain text';
    expect(decryptMaterialContent(plain)).toBe(plain);
  });
});

// ─── decryptMaterialContent graceful fallback ─────────────────────────────────

describe('decryptMaterialContent — graceful fallback', () => {
  let original: string | undefined;

  beforeAll(() => {
    original = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'fallback-test-key';
  });

  afterAll(() => {
    if (original === undefined) {
      delete process.env.ENCRYPTION_KEY;
    } else {
      process.env.ENCRYPTION_KEY = original;
    }
  });

  it('returns plaintext rows unchanged when content is not a valid encrypted blob', async () => {
    const { decryptMaterialContent } = await import('./index');
    // A plaintext row written before encryption was enabled
    const plainRow = 'A plain text row written before encryption was enabled';
    const result = decryptMaterialContent(plainRow);
    expect(result).toBe(plainRow);
  });
});
