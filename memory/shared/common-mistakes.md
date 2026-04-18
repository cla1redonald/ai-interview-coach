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
