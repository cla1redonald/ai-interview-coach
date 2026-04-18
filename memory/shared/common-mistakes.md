# Common Mistakes -- Committed Knowledge

## Architect Defaults to Wrong Stack

**What happens:** The architect produces a full spec using the portfolio-default database (Supabase) despite the user having constraints that rule it out (e.g., no free slots). The entire spec must be rewritten.

**Root cause:** Stack constraints are mentioned in conversation but not injected into the architect's input prompt. The architect defaults to what it knows as standard.

**Prevention:** The orchestrator must include a `## Constraints` block in the architect's prompt listing: database, auth provider, deployment target, and any explicit "do not use" items. Never rely on conversation context alone.

**Detection:** Review the architect's spec before launching any engineering threads. Verify the stack matches the stated constraints.

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Cross-Cutting Module Not Wired In

**What happens:** A capability like encryption or analytics is built as a standalone module with tests, but never integrated into the routes that should use it. The module exists but does nothing in production.

**Root cause:** The module thread has file ownership over `src/lib/[module]/`, but the API routes are owned by other threads. No thread is explicitly tasked with wiring the module into existing routes.

**Prevention:** After any cross-cutting module (encryption, caching, logging), the orchestrator must create a dedicated "integration" thread that runs after both the module and the consuming routes are built. This thread's explicit scope is "wire X into routes Y, Z."

**Detection:** The reviewer should check: for every cross-cutting module, is it actually called from the routes it's supposed to protect/enhance? Grep for imports of the module in route files.

**Source:** StoryBank Phase 1 / 2026-04-18 -- encryption module built but not wired into transcript/example routes

---

## String Interpolation Injection in External Service Filters

**What happens:** A userId or other user-controlled value is interpolated directly into a filter string for an external service (e.g., Upstash Vector: `filter: "userId = '${userId}'"`). If the value contains quotes or special characters, the filter query can be manipulated.

**Root cause:** SQL injection is a well-known pattern, but the same vulnerability class exists in any service that accepts string-based filter syntax. Engineers may not recognise it because the service (Upstash Vector) is unfamiliar.

**Prevention:** Any string interpolation into an external service query must include input validation. For cuid2 IDs: `/^[a-z0-9]{20,32}$/`. For general strings: escape or reject special characters. Prefer parameterised queries when the service supports them.

**Detection:** Grep for template literals in service client files (e.g., `filter:` in vector clients). Any `${variable}` inside a filter string is a red flag.

**Source:** StoryBank Phase 1 / 2026-04-18 -- Upstash Vector userId filter injection risk

---

## Schema Mismatch Between Spec and Implementation

**What happens:** The architecture spec defines one format (e.g., ISO-8601 text timestamps) but the implementing engineer uses a different format (e.g., Unix integer timestamps). Downstream consumers break or produce wrong results.

**Root cause:** The engineer didn't read (or missed) the specific design decision in the spec. The spec may bury critical choices in prose paragraphs rather than calling them out.

**Prevention:** The orchestrator should include a "Key decisions that differ from defaults" section in each thread spec. Format: "IMPORTANT: Timestamps are ISO-8601 text strings, NOT integer epoch. See ARCHITECTURE.md Section 2."

**Detection:** After each wave, diff the implementation against the spec for key fields: ID format, timestamp format, nullable vs. required, default values.

**Source:** StoryBank Phase 1 / 2026-04-18 -- integer vs. ISO-8601 timestamp mismatch

---

## Pivot Debris Left Behind After Service Swap

**What happens:** A dependency is swapped (auth provider, embedding service, encryption library) and the new implementation works, but the old service is still referenced in docs, dead pages, env comments, function params, and type files. The codebase looks like it uses two services simultaneously.

**Root cause:** The swap is treated as a focused implementation task. The engineer changes the code that matters (the module, the routes that call it) and confirms the new path works. Nobody runs a blast radius search for all other references to the old service. Docs, placeholder pages, dead params, and env comments are invisible to `tsc --noEmit`.

**Prevention:** After every service swap commit, run a blast radius grep before moving to the next task:
```
grep -r "OLD_SERVICE" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.env*"
```
Delete or update every hit. Commit as `chore: sweep references to [old service]`.

**Detection:** Reviewer should grep for the names of any service listed in the architecture spec's "evaluated and rejected" section. If those names appear outside the rejection note itself, they are debris.

**Source:** StoryBank Phase 2 review / 2026-04-18 -- 9 of 19 issues (47%) were pivot debris from Voyage->OpenAI, Resend->Google OAuth, CipherStash->AES-256-GCM swaps

---

## Cross-Cutting Module Partially Wired (Write Path Only)

**What happens:** A cross-cutting module (encryption, logging) is correctly wired into write paths (create, update) but not read paths (detail pages, API GETs, analysis endpoints). Data is encrypted on save but returned as ciphertext blobs on read.

**Root cause:** The integration thread focuses on the "obvious" paths -- where data enters the system. Read paths feel passive and are skipped because "they just SELECT and return." But with encryption, a SELECT returns ciphertext unless decryption is explicitly called.

**Prevention:** When wiring a cross-cutting module, enumerate ALL paths (not just writes):
1. Write paths: POST, PUT, PATCH routes that INSERT or UPDATE
2. Read paths: GET routes, detail pages, list pages, analysis/aggregation endpoints
3. Delete paths: any cleanup needed

For encryption specifically: every route that reads an encrypted field must call the decrypt function before returning data to the client.

**Detection:** For each encrypted field, grep for all SELECT queries on that table. For each SELECT, verify the decrypt function is called on the result before it reaches `Response.json()` or a component render.

**Source:** StoryBank Phase 2 review / 2026-04-18 -- 4 routes reading encrypted fields without decrypting (recurrence of Phase 1 "Cross-Cutting Module Not Wired In" pattern, now split by read/write asymmetry)
