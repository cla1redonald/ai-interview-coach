# Reviewer Agent -- Committed Knowledge

## Check Cross-Cutting Modules Are Actually Wired In

**Context:** Reviewing a build that includes a standalone module (encryption, analytics, caching) alongside the routes that should use it.

**Learning:** In StoryBank Phase 1, the encryption module was built with full tests (241 lines) but never imported or called from any API route. Data flowed as plaintext. Only caught during review.

**Action:** For every module in `src/lib/` that provides a cross-cutting capability:
1. Grep for imports of the module across all route files
2. If the module exists but is never imported, flag as P0
3. If the module is imported but its functions are never called, flag as P0
4. Specifically check: encryption modules should be called in every read/write path for the fields they're supposed to protect

**Update (Phase 2 review):** This pattern recurred. The module WAS imported in the enrich route (write path) but NOT in 4 read paths (transcript detail, review page, breakdown API, mirror/analyze API). Partial wiring is as dangerous as no wiring. The check must enumerate all read AND write paths, not just verify "at least one import exists."

**Source:** StoryBank Phase 1 / 2026-04-18 (recurred Phase 2 review)

---

## Blast Radius Check After Service Swaps

**Context:** Reviewing a codebase where a dependency was swapped (auth provider, embedding service, etc.) during the build.

**Learning:** In StoryBank, three services were swapped mid-build (Voyage AI -> OpenAI, Resend -> Google OAuth, CipherStash -> AES-256-GCM). The new implementations worked, but 9 issues (47% of all findings) were debris from the old services: dead pages, stale doc references, dead function params, stale env comments.

**Action:** Before completing a review on any project that had mid-build pivots:
1. Check the git log for swap/refactor commits
2. For each swapped service, grep for the old service name across all file types (not just .ts -- include .md, .env, .json)
3. Flag any reference outside of explicit "evaluated and rejected" documentation
4. Check for dead pages that served the old flow (e.g., signup page from magic link auth)

**Source:** StoryBank Phase 2 review / 2026-04-18

---

## Read memory/shared/common-mistakes.md Before Reviewing

**Context:** Starting any code review.

**Learning:** The Phase 1 retro documented "Cross-Cutting Module Not Wired In" as a known pattern with a specific detection step (grep for imports). The Phase 2 review found the same pattern recurring -- the knowledge existed but was not applied during the review.

**Action:** Before starting a review, read `memory/shared/common-mistakes.md`. For each entry that has a "Detection" section, execute that detection step. Do not rely on general awareness -- run the actual grep/check described. This turns passive knowledge into active verification.

**Source:** StoryBank Phase 2 review / 2026-04-18

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

---

## Audit Existing Code When Modifying a File

**Context:** Reviewing changes to an existing file where the engineer added new functionality.

**Learning:** In the StoryBank Unified Experience build, the engineer added `focusTopic` parsing and sanitisation to `/api/chat/route.ts`. The new code was correct and well-secured. But the existing code in the same file did not validate `msg.role` -- a client could inject `{ role: "system" }` messages into the LLM call. This was a P0 prompt injection vector that had existed since Phase 1 but was only caught when the reviewer audited the whole file during the UE review.

**Action:** When reviewing changes to an existing file:
1. Do not limit review to the diff. Read the entire route handler or component.
2. For API routes: verify that ALL input fields are validated, not just the newly added ones.
3. For chat/LLM routes specifically: check that `msg.role` is validated against an allowlist (`['user', 'assistant']`).
4. Apply the question: "If I were writing this file from scratch today with current security knowledge, what would I do differently?" Any gap between that answer and the current code is a finding.

**Source:** StoryBank Unified Experience / 2026-04-19 -- P0 prompt injection in existing /api/chat code discovered during review of focusTopic additions
