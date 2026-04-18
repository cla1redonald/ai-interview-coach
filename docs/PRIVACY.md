# StoryBank — Privacy & Encryption

**Version:** 1.0
**Date:** 2026-04-18

---

## What data StoryBank handles

StoryBank stores sensitive interview data including:

- Full interview transcripts (salary discussions, reasons for leaving, performance history)
- Q&A examples extracted from those transcripts
- Compensation claims and consistency tracking entries

This data is personal and commercially sensitive. A data breach would be harmful to the user's career.

---

## Encryption approach

### CipherStash evaluation

CipherStash was the original specified approach for encrypted search. After evaluation, CipherStash's SDK (`@cipherstash/protect`) targets PostgreSQL only — it has no libSQL/SQLite support. The fallback defined in ARCHITECTURE.md Section 8 was taken.

### AES-256-GCM field-level encryption

Sensitive text fields are encrypted using **AES-256-GCM** via Node.js built-in `crypto` (no third-party dependency).

**Module:** `src/lib/encryption/index.ts`

**Algorithm:** AES-256-GCM
- 256-bit key
- 96-bit random IV per encryption call
- 128-bit GCM authentication tag (tamper detection)

**Fields encrypted:**

| Table | Field | Encrypted |
|-------|-------|-----------|
| `transcripts` | `rawText` | Yes |
| `examples` | `question` | Yes |
| `examples` | `answer` | Yes |
| All other fields | IDs, dates, ratings, tags | No |

Non-encrypted fields contain no sensitive free-text. Metadata like interview dates and company names are stored in plaintext for filtering — this is an accepted trade-off for Phase 1.

### Key derivation

The encryption key is derived from the `ENCRYPTION_KEY` environment variable. If `ENCRYPTION_KEY` is not set, `AUTH_SECRET` is used as a fallback (this means data is still encrypted, just under the auth session key).

Both raw secrets are passed through SHA-256 to produce a deterministic 32-byte AES key.

```
ENCRYPTION_KEY (or AUTH_SECRET)
        │
        ▼
  SHA-256 digest
        │
        ▼
  32-byte AES key
        │
        ▼
  AES-256-GCM encrypt/decrypt
```

### Storage format

Each encrypted value is stored as a single TEXT column in Turso/SQLite. The format is:

```
base64(JSON({ ciphertext: string, iv: string, tag: string }))
```

This is opaque to the database — Turso sees only base64 strings.

### When encryption is active

Encryption is **optional in Phase 1**. If neither `ENCRYPTION_KEY` nor `AUTH_SECRET` is set, `isEncryptionEnabled()` returns false and API routes use plaintext directly.

In practice, `AUTH_SECRET` is always set (required for Auth.js), so data is always encrypted at the application layer.

---

## Keyword search

Because fields are encrypted with a random IV, exact-match or LIKE queries against ciphertext are not possible.

**Phase 1 search strategy:**

- Keyword search (`GET /api/examples?q=leadership`) uses Upstash Vector similarity as the primary mechanism — semantic search across encrypted data without decrypting.
- Fallback: If vectors are not yet generated for a user's examples (e.g. immediately after upload), the API decrypts fields in-memory and applies a plaintext filter before returning results.

This is functionally equivalent to SQLite LIKE search with the privacy story that plaintext is never stored on disk.

**CipherStash "encrypted AND searchable" is out of scope for Phase 1.** The privacy story is "encrypted at rest." CipherStash can be revisited if the project migrates to PostgreSQL.

---

## What is NOT encrypted

- Upstash Vector embeddings — numerical vectors (1024 floats). Source text cannot be reconstructed from embeddings.
- Metadata: IDs, timestamps, ratings, tag names, company names, interviewer names — plaintext.

Company names and interviewer names are an accepted gap. Users should be aware that these field values are stored in plaintext in the Turso database.

---

## Threat model

| Threat | Mitigated? | How |
|--------|-----------|-----|
| Turso database breach (read access) | Partial | Sensitive free-text fields encrypted at application layer |
| Turso database breach (full export) | Partial | Same — ciphertext without the key is unreadable |
| ENCRYPTION_KEY leaked | No | Data readable if key and ciphertext both exposed |
| Cross-user data access | Yes | Every query filters by `userId = session.user.id` |
| Client-side key exposure | Yes | All encryption is server-side only, never in client bundle |
| Tampered ciphertext | Yes | GCM auth tag verification rejects any modification |

---

## Key rotation

Key rotation is not implemented in Phase 1. To rotate the encryption key:

1. Decrypt all rows using the old key
2. Re-encrypt with the new key
3. Update `ENCRYPTION_KEY` in production

This is a manual process. A key rotation utility can be added in a future phase if required.

---

*PRIVACY.md — StoryBank Phase 1 v1.0*
