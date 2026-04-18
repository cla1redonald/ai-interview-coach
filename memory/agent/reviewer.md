# Reviewer Agent -- Committed Knowledge

## Check Cross-Cutting Modules Are Actually Wired In

**Context:** Reviewing a build that includes a standalone module (encryption, analytics, caching) alongside the routes that should use it.

**Learning:** In StoryBank Phase 1, the encryption module was built with full tests (241 lines) but never imported or called from any API route. Data flowed as plaintext. Only caught during review.

**Action:** For every module in `src/lib/` that provides a cross-cutting capability:
1. Grep for imports of the module across all route files
2. If the module exists but is never imported, flag as P0
3. If the module is imported but its functions are never called, flag as P0
4. Specifically check: encryption modules should be called in every read/write path for the fields they're supposed to protect

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Check String Interpolation in External Service Queries

**Context:** Reviewing service client files that connect to external APIs (vector stores, search services, etc.).

**Learning:** The Upstash Vector client interpolated `userId` directly into a filter string without input validation. This is the same class of vulnerability as SQL injection, but in a less familiar context.

**Action:** Grep for template literals (`${`) inside any service client file. For each occurrence:
1. Is the interpolated value user-controlled (even indirectly, like a session userId)?
2. Is the value validated before interpolation?
3. Does the service support parameterised queries instead?
Flag any unvalidated string interpolation into a service query as P0.

**Source:** StoryBank Phase 1 / 2026-04-18
