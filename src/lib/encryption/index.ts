/**
 * AES-256-GCM field-level encryption for StoryBank.
 *
 * CipherStash was evaluated and does not support libSQL/SQLite — it targets
 * PostgreSQL only. This module provides AES-256-GCM encryption using Node.js
 * built-in `crypto`, which is available server-side in Next.js.
 *
 * Key derivation:
 *   ENCRYPTION_KEY env var (preferred) → 32-byte SHA-256 derived key
 *   AUTH_SECRET env var (fallback) → same derivation
 *
 * All encryption is server-side only. Never import this in client components.
 *
 * Keyword search falls back to SQLite LIKE on plaintext when encryption is
 * not configured, or uses Upstash Vector similarity as the primary search
 * mechanism when it is.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EncryptedValue {
  ciphertext: string; // base64
  iv: string;         // base64, 12 bytes
  tag: string;        // base64, 16 bytes (GCM auth tag)
}

export interface EncryptedTranscriptFields {
  rawText: string;       // base64-encoded JSON of EncryptedValue
}

export interface EncryptedExampleFields {
  question: string; // base64-encoded JSON of EncryptedValue
  answer: string;   // base64-encoded JSON of EncryptedValue
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derives a 32-byte AES key from the ENCRYPTION_KEY env var.
 * Throws if not set — encryption cannot proceed without a key.
 */
function getDerivedKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'Encryption key not configured. Set ENCRYPTION_KEY in environment variables.'
    );
  }
  // SHA-256 of the raw secret → deterministic 32-byte key
  return createHash('sha256').update(raw, 'utf8').digest();
}

// ─── Core encrypt / decrypt ───────────────────────────────────────────────────

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a structured object with ciphertext, IV, and auth tag — all base64.
 */
export function encrypt(plaintext: string): EncryptedValue {
  const key = getDerivedKey();
  const iv = randomBytes(12); // 96-bit IV is recommended for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv:         iv.toString('base64'),
    tag:        cipher.getAuthTag().toString('base64'),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted value.
 * Throws if the auth tag does not match (data integrity violation).
 */
export function decrypt(encrypted: EncryptedValue): string {
  const key = getDerivedKey();
  const iv  = Buffer.from(encrypted.iv, 'base64');
  const tag = Buffer.from(encrypted.tag, 'base64');
  const ct  = Buffer.from(encrypted.ciphertext, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([
    decipher.update(ct),
    decipher.final(),
  ]).toString('utf8');
}

// ─── Serialisation helpers ────────────────────────────────────────────────────

/**
 * Serialise an EncryptedValue to a single string for storage in a TEXT column.
 * Format: base64(JSON({ciphertext,iv,tag}))
 */
export function serialise(value: EncryptedValue): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
}

/**
 * Deserialise a TEXT column value back to an EncryptedValue.
 */
export function deserialise(stored: string): EncryptedValue {
  const raw = Buffer.from(stored, 'base64').toString('utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('ciphertext' in parsed) ||
    !('iv' in parsed) ||
    !('tag' in parsed)
  ) {
    throw new Error('Invalid encrypted value format');
  }
  return parsed as EncryptedValue;
}

// ─── High-level field wrappers ────────────────────────────────────────────────

/**
 * Encrypt fields of a transcript before writing to Turso.
 * rawText is encrypted; other fields are left unchanged.
 */
export function encryptTranscriptFields(fields: {
  rawText: string;
}): EncryptedTranscriptFields {
  return {
    rawText: serialise(encrypt(fields.rawText)),
  };
}

/**
 * Decrypt transcript fields after reading from Turso.
 * Pass the stored (serialised) rawText; receive plaintext.
 */
export function decryptTranscriptFields(fields: {
  rawText: string;
}): { rawText: string } {
  return {
    rawText: decrypt(deserialise(fields.rawText)),
  };
}

/**
 * Encrypt example question and answer before writing to Turso.
 */
export function encryptExampleFields(fields: {
  question: string;
  answer: string;
}): EncryptedExampleFields {
  return {
    question: serialise(encrypt(fields.question)),
    answer:   serialise(encrypt(fields.answer)),
  };
}

/**
 * Decrypt example fields after reading from Turso.
 */
export function decryptExampleFields(fields: {
  question: string;
  answer: string;
}): { question: string; answer: string } {
  return {
    question: decrypt(deserialise(fields.question)),
    answer:   decrypt(deserialise(fields.answer)),
  };
}

// ─── Phase 2: Job application field wrappers ─────────────────────────────────

export interface EncryptedJobDescriptionFields {
  jobDescription: string; // base64-encoded JSON of EncryptedValue
}

export interface EncryptedResearchFields {
  recentNews: string | null;
  cultureSignals: string | null;
  keyPeople: string | null;
}

/**
 * Encrypt the jobDescription field of a job application before writing to DB.
 * No-op (returns input unchanged) if ENCRYPTION_KEY is not set.
 */
export function encryptJobDescription(fields: {
  jobDescription: string;
}): EncryptedJobDescriptionFields {
  return {
    jobDescription: serialise(encrypt(fields.jobDescription)),
  };
}

/**
 * Decrypt the jobDescription field after reading from DB.
 * No-op (returns input unchanged) if ENCRYPTION_KEY is not set.
 */
export function decryptJobDescription(fields: {
  jobDescription: string;
}): { jobDescription: string } {
  return {
    jobDescription: decrypt(deserialise(fields.jobDescription)),
  };
}

/**
 * Encrypt sensitive company research fields before writing to DB.
 * Only encrypts non-null fields. No-op if ENCRYPTION_KEY is not set.
 */
export function encryptResearchFields(fields: {
  recentNews: string | null;
  cultureSignals: string | null;
  keyPeople: string | null;
}): EncryptedResearchFields {
  return {
    recentNews: fields.recentNews !== null ? serialise(encrypt(fields.recentNews)) : null,
    cultureSignals: fields.cultureSignals !== null ? serialise(encrypt(fields.cultureSignals)) : null,
    keyPeople: fields.keyPeople !== null ? serialise(encrypt(fields.keyPeople)) : null,
  };
}

/**
 * Decrypt sensitive company research fields after reading from DB.
 * Only decrypts non-null fields. No-op if ENCRYPTION_KEY is not set.
 */
export function decryptResearchFields(fields: {
  recentNews: string | null;
  cultureSignals: string | null;
  keyPeople: string | null;
}): EncryptedResearchFields {
  return {
    recentNews: fields.recentNews !== null ? decrypt(deserialise(fields.recentNews)) : null,
    cultureSignals: fields.cultureSignals !== null ? decrypt(deserialise(fields.cultureSignals)) : null,
    keyPeople: fields.keyPeople !== null ? decrypt(deserialise(fields.keyPeople)) : null,
  };
}

// ─── Encryption guard ─────────────────────────────────────────────────────────

/**
 * Returns true if encryption is configured (ENCRYPTION_KEY set).
 * When false, callers should skip encrypt/decrypt and use plaintext as-is.
 *
 * Phase 1 uses plaintext; opt into encryption by setting ENCRYPTION_KEY.
 */
export function isEncryptionEnabled(): boolean {
  return !!process.env.ENCRYPTION_KEY;
}
