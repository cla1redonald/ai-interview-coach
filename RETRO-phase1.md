# StoryBank Phase 1 Retrospective

**Date:** 2026-04-18
**Outcome:** Shipped (code complete, not yet deployed)
**Build method:** `/orchestrate` with Agent Teams -- 10 threads across 6 waves
**Duration:** ~90 minutes (single session)
**Total code added:** ~7,900 lines across 46 files (excluding node_modules)

---

## What Was Built

StoryBank Phase 1 delivers a career story management platform on top of an existing AI Interview Coach app. The build preserved the original mock interview feature at `/` while adding:

| Feature | Files | Lines |
|---------|-------|-------|
| Drizzle schema + Turso database | `src/lib/db/` (3 files) | ~140 |
| Auth.js magic link auth | `src/lib/auth.ts`, middleware, login pages | ~80 |
| Transcript upload + CRUD | API routes + UploadForm component | ~650 |
| Two-pass AI extraction pipeline | `src/app/api/extract/route.ts` + 4 prompt modules | ~640 |
| Auto-tagging + consistency extraction | Integrated into extract pipeline | ~170 |
| Example Bank UI | Page + 9 components (ExampleCard, FilterBar, etc.) | ~2,300 |
| AES-256-GCM encryption | `src/lib/encryption/index.ts` + tests | ~430 |
| Voyage AI embeddings + Upstash Vector | `src/lib/embeddings/`, `src/lib/vector/` | ~215 |
| Job spec matching + gap analysis | API route + page + 2 components | ~970 |
| Mirror Effect (4-panel analysis) | API route + page + 4 components | ~1,130 |
| Consistency Tracker | API routes + page + component | ~980 |
| Security fixes (P0 + P1) | 9 files modified | ~300 |

**17 StoryBank components**, **12 new API routes**, **6 prompt modules**, **1 encryption module with 236-line test suite**.

---

## PRD Coverage

The original requirements were defined in ARCHITECTURE.md v2.0 and DESIGN.md. Assessment:

| Requirement | Status | Notes |
|-------------|--------|-------|
| Turso + Drizzle schema (all tables) | Delivered | Schema matches architecture spec exactly |
| Auth.js magic link via Resend | Delivered | JWT strategy, Drizzle adapter, middleware exclusions |
| Transcript upload (paste + file) | Delivered | Full metadata form, file drop zone |
| Two-pass Q&A extraction | Delivered | Pass 1 extract, Pass 2 verify+correct, both via tool calling |
| Auto-tagging (13 system categories) | Delivered | Single-call batched tagging |
| Consistency claim extraction | Delivered | Integrated into extract pipeline |
| Example Bank with filters | Delivered | Tag, company, quality, keyword filters; STAR breakdown |
| Quality rating (strong/weak/neutral) | Delivered | User-controlled, never auto-overwritten |
| AES-256-GCM encryption | Delivered | CipherStash fallback executed as planned |
| Voyage AI + Upstash Vector embeddings | Delivered | Document/query input types, batch generation |
| Job spec matching + gap analysis | Delivered | Vector similarity + Claude explanation + gap flags |
| Mirror Effect (4 panels) | Delivered | Recurring stories, phrase cloud, patterns, strength map |
| Consistency Tracker + contradiction detection | Delivered | LLM-based contradiction flagging |
| Backfill endpoint | Delivered | `/api/embeddings/backfill` for recovery |
| Deep Tay palette + amber accent | Delivered | Per DESIGN.md spec |
| Sidebar navigation | Delivered | AppSidebar component with all nav items |
| Security review + fixes | Delivered | 3 P0s + P1s identified and resolved |
| README + PRIVACY.md | Delivered | Comprehensive documentation |

**Silently dropped or deferred:**
- Login page UI (auth routes exist but login page component not in build commits -- may rely on Auth.js default or was built in foundation wave)
- Dashboard page (not visible in commits -- may be placeholder)
- Upload page as a standalone route (UploadForm component exists but dedicated `/upload` page not confirmed)
- Transcript list page (transcript detail exists, list page may be placeholder)
- CipherStash encrypted search (correctly deferred per architecture; LIKE fallback active)

---

## What Went Well

### 1. Parallel execution with file ownership
10 threads in 6 waves with zero file conflicts. The orchestrator assigned explicit file ownership to each thread, so no two engineers touched the same file. This is the single most important pattern for multi-thread builds.

### 2. Architecture spec as single source of truth
ARCHITECTURE.md v2.0 was comprehensive enough that engineers could work independently. Schema, API contracts, type definitions, access control patterns, and error shapes were all specified. Engineers didn't have to guess.

### 3. CipherStash fallback was pre-planned
Thread 3 discovered CipherStash doesn't support SQLite/libSQL. Because the architecture spec explicitly defined AES-256-GCM as the fallback, the pivot was instant -- no debate, no redesign, no blocked threads. The encryption module was shipped in a single commit with 241 lines of tests.

### 4. Security review caught real issues
The reviewer found 3 genuine P0s: missing userId filter on match route DB fetch, encryption not wired into read/write paths, and unvalidated userId in Upstash Vector filter string interpolation. All were fixed in a single commit. The reviewer did their job.

### 5. Non-fatal error handling in the extract pipeline
The extraction pipeline treats Pass 2, tagging, consistency extraction, and embedding generation as non-fatal. If any sub-step fails, the core Q&A pairs are still saved. This is good resilience design for a 4-step AI pipeline where any external call could fail.

### 6. Data layer separation (User vs System)
The architecture explicitly defined which fields are USER layer (never auto-overwritten) and which are SYSTEM layer (safe to regenerate). This prevented the extraction pipeline from ever destroying user edits -- a critical correctness property for a tool where users invest time curating their examples.

---

## What Didn't Go Well

### 1. Architect used wrong database (Supabase instead of Turso)
**Severity: High. Cost: ~20 minutes + full rewrite.**

The architect's first spec used Supabase (RLS, Row Level Security, pg_vector) despite the user having stated she had no free Supabase slots. The entire ARCHITECTURE.md had to be rewritten to v2.0 for Turso/Drizzle/Upstash.

**Root cause:** The architect didn't verify constraints before designing. Supabase is the portfolio default, so the architect defaulted to it.

**Fix:** Stack constraints must be in the architect's input prompt, not just the conversation history. The orchestrator should inject a `## Constraints` section listing database, auth, and deployment targets before the architect begins.

### 2. Schema timestamp format mismatch
**Severity: Medium. Cost: ~10 minutes.**

The foundation engineer initially used integer timestamps (Unix epoch). The architecture spec called for ISO-8601 text strings. This had to be realigned.

**Root cause:** The engineer didn't read the "Timestamps stored as ISO-8601 text strings" line in the schema design principles. The architect wrote it; the engineer missed it.

**Fix:** The orchestrator should include a "Key decisions that differ from defaults" section in each thread spec, highlighting choices like timestamp format that deviate from what an engineer might assume.

### 3. Cross-thread TypeScript build breaks
**Severity: Medium. Cost: ~15 minutes.**

Engineers in later waves had to fix TypeScript errors introduced by earlier waves. This is inherent to parallel builds where later threads depend on shared types.

**Root cause:** No build verification gate between waves. The orchestrator launched Wave 3 before confirming Wave 2's output compiled cleanly.

**Fix:** Add a mandatory `tsc --noEmit` check after each wave completes, before launching the next wave. This takes ~5 seconds and prevents cascading type errors.

### 4. CipherStash incompatibility not caught until runtime
**Severity: Low (mitigated by fallback). Cost: minimal.**

The architecture spec listed CipherStash as the primary encryption approach, but its SQLite incompatibility wasn't discovered until the engineer tried to install the SDK. The fallback was pre-defined, so impact was minimal -- but the spec should have flagged this as a verified risk vs. an assumed risk.

**Fix:** For any dependency where compatibility is uncertain, the architecture spec should mark it as "unverified" and require a spike task before the main build thread. Format: `CipherStash: UNVERIFIED against libSQL. Spike: run npm install + import test before building integration.`

### 5. Encryption built but not wired in
**Severity: High (security). Caught by reviewer.**

Thread 3 built the encryption module with full tests, but the encrypt/decrypt calls were never wired into the transcript and example API routes. The data was flowing as plaintext despite the module existing. Only caught during code review.

**Root cause:** The encryption thread had explicit file ownership over `src/lib/encryption/`, but the API routes were owned by other threads. No thread was explicitly tasked with "wire encryption into existing routes."

**Fix:** When a capability (like encryption) is cross-cutting, the orchestrator must either (a) assign a wiring task to a later thread, or (b) include wiring instructions in every thread that touches the affected routes. Option (a) is safer -- create a dedicated "integration" thread after the capability is built.

### 6. Upstash Vector filter injection risk
**Severity: High (security). Caught by reviewer.**

The `queryUserVectors` function interpolated `userId` directly into the Upstash filter string: `filter: "userId = '${userId}'"`. If `userId` contained quotes, this could manipulate the filter query. Fixed by adding a regex validation (`/^[a-z0-9]{20,32}$/`) to reject non-cuid2 values.

**Root cause:** String interpolation into query filters is a well-known injection pattern, but the architecture spec didn't flag it because Upstash Vector's filter syntax is less familiar than SQL.

**Fix:** Default to parameterised queries wherever a service supports them. When string interpolation is the only option (as with Upstash), add input validation immediately -- don't wait for review.

---

## Agent Performance

| Agent | Rating | Assessment |
|-------|--------|------------|
| @architect | Fair | Produced a comprehensive spec, but wrong database on first attempt. The v2.0 rewrite was thorough. |
| @designer | Good | DESIGN.md is detailed, consistent, and implementable. WCAG contrast ratios verified. No revisions needed. |
| @engineer-foundation | Good | Schema and auth delivered cleanly. Timestamp format mismatch was a minor oversight. |
| @engineer-upload | Good | Clean CRUD implementation. UploadForm component is the largest at 435 lines -- well-structured. |
| @engineer-cipherstash | Good | Pivoted to AES-256-GCM quickly. 241-line test suite is thorough. Did not wire into routes (not in scope). |
| @engineer-extraction | Good | Most complex thread. Two-pass pipeline with structured output is well-implemented. Non-fatal error handling is a strong pattern. |
| @engineer-bankui | Good | 2,300 lines of UI across 9 components. FilterBar, ExampleCard, and ReviewPanel are well-structured. |
| @engineer-embeddings | Good | Voyage AI + Upstash integration clean. Batch processing with rate limiting. |
| @engineer-consistency | Good | Contradiction detection via LLM is pragmatic for the data complexity. |
| @reviewer | Good | Found 3 genuine P0s. Security audit was effective. |
| @docs | Good | README rewritten, PRIVACY.md added. |
| @engineer-security | Good | Fixed all findings in a single commit. userId validation on Upstash filter was the right fix. |

---

## Key Learnings

### L1: Stack constraints must be explicit input to the architect
The architect defaulted to the portfolio-standard stack (Supabase) because the constraint "no free Supabase slots" was in conversation, not in the architect's system prompt. This cost a full spec rewrite.

**Action:** The orchestrator must include a `## Constraints` block in the architect's prompt listing: database, auth provider, deployment target, and any "do not use" items.

### L2: Cross-cutting capabilities need a wiring thread
Encryption was built in isolation and never connected to the routes it was supposed to protect. Any capability that touches multiple files owned by different threads must have an explicit integration task.

**Action:** After any cross-cutting module (encryption, analytics, caching), create a dedicated wiring thread that runs after both the module and the consuming routes are built.

### L3: TypeScript build check between waves
Type errors from Wave 2 leaked into Wave 3, causing engineers to fix each other's mistakes. A 5-second `tsc --noEmit` after each wave would catch this.

**Action:** Add a `tsc --noEmit` gate after each wave completes, before launching the next.

### L4: String interpolation into external service queries is an injection risk
Upstash Vector's filter syntax requires string interpolation. Without input validation, this is the same class of vulnerability as SQL injection.

**Action:** Any string interpolation into an external service filter must include input validation. Add this to the security checklist.

### L5: Pre-planned fallbacks save time
CipherStash's incompatibility could have blocked Thread 3 for hours. Because the fallback (AES-256-GCM) was defined in the architecture spec, the pivot was immediate.

**Action:** For any unproven dependency, always define the fallback in the architecture spec, not after discovery.

### L6: The reviewer is essential, not optional
Without the reviewer, three P0 security issues would have shipped. The 15-minute review cost saved significant post-deploy risk.

**Action:** Never skip the review phase, even under time pressure.

---

## Graduated Patterns (Tier 2 -- Committed Knowledge)

The following patterns have been written to `memory/` for durable use across future builds:

### Graduated to `memory/shared/common-mistakes.md`:
1. **Architect defaults to wrong stack** -- stack constraints must be in the prompt
2. **Cross-cutting module not wired in** -- needs explicit integration thread
3. **String interpolation injection in external service filters** -- validate input format

### Graduated to `memory/agent/architect.md`:
1. **Constraint verification before design** -- never assume stack from portfolio defaults
2. **Unverified dependency flagging** -- mark "UNVERIFIED" and require spike

### Graduated to `memory/agent/orchestrator.md`:
1. **Stack constraints as explicit prompt input**
2. **TypeScript build gate between waves**
3. **Cross-cutting integration thread pattern**
4. **Thread spec should highlight non-default decisions**

### Graduated to `memory/agent/engineer.md`:
1. **Input validation on external service filter interpolation**
2. **Non-fatal pipeline step pattern** (try/catch, proceed with partial results)

### Graduated to `memory/agent/reviewer.md`:
1. **Check cross-cutting modules are actually wired in**
2. **Check string interpolation in external service queries**

---

## Recommendations for Phase 2

1. **Deploy and smoke-test Phase 1 first.** The code is written but not deployed. Before adding features, deploy to Vercel and verify the full flow: login -> upload -> extract -> view examples -> match -> mirror -> consistency. Fix any runtime issues discovered.

2. **Wire encryption into real usage.** Encryption is opt-in via `ENCRYPTION_KEY`. Decide whether Phase 2 requires it to be on by default or remains opt-in. If on by default, existing plaintext data needs a migration.

3. **Test with real transcript data.** The extraction pipeline has not been tested against real interview transcripts. Use Claire's `Interview_Questions_and_Answers.md` as the first test case. Verify extraction accuracy, tagging accuracy, and consistency claim detection against known ground truth.

4. **Add error boundaries to UI pages.** The pages call API routes that can fail (Claude API errors, Turso timeouts). Client-side error boundaries with retry buttons would improve UX.

5. **Add the dashboard and transcript list pages.** These appear to be placeholders or minimal implementations. They're the first things a user sees after login.

6. **Consider rate limiting on AI-heavy routes.** `/api/extract`, `/api/match`, and `/api/mirror/analyze` each make 1-4 Claude API calls. Without rate limiting, a user could run up significant API costs. Add per-user rate limits.

7. **Add loading states per DESIGN.md.** The design spec defines skeleton screens, shimmer animations, and progress indicators. Verify these are implemented in the UI pages.

---

## Process Observations

- **10 threads was the right granularity.** Each thread had a clear scope, deliverable, and file ownership. Smaller threads (e.g., splitting Upload into "API" and "UI") would have added coordination overhead without benefit. Larger threads (combining extraction + bank UI) would have been too long for a single agent context window.

- **The 6-wave structure correctly serialised dependencies.** Foundation before features, features before cross-cutting analysis (mirror, consistency), everything before review. The only gap was the missing build gate between waves.

- **ARCHITECTURE.md v2.0 was the MVP of the project.** Every engineer referenced it. The schema, API contracts, and type definitions were used verbatim. Investing time in the spec paid for itself many times over in reduced confusion and rework.

- **DESIGN.md was used but could be more prescriptive.** The component specs were detailed enough to implement, but didn't specify exact Tailwind classes. Engineers made reasonable choices, but this meant visual consistency depended on each engineer's taste. For a design-heavy product, consider including a component library or Storybook reference.

---

*RETRO-phase1.md -- StoryBank Phase 1 Retrospective*
