# StoryBank Phase 2 Retrospective — APPLY Loop

**Date:** 2026-04-19
**Outcome:** Code complete (9 threads shipped, not yet deployed)
**Build method:** `/orchestrate` with Agent Teams — 9 threads across 5 waves
**Thread sequencing:** Threads 1-4 parallel → Thread 5 → Threads 6+8 parallel → Threads 7+9 parallel
**Duration:** Single session
**Scale:** 5 new DB tables, 9 new API routes, 8 new UI components, ~212 new tests (85 → 297)

---

## What Was Built

| Thread | Scope | Status |
|--------|-------|--------|
| 1-4 (parallel) | Schema, services (Jina/Gemini/Companies House), prompts (research synthesis, fit assessment, materials), encryption extensions | Done |
| 5 | Application CRUD + research pipeline route | Done |
| 6 (parallel w/ 8) | Assessment + materials API routes | Done |
| 8 (parallel w/ 6) | Research + Fit Assessment UI pages and components | Done |
| 7 (parallel w/ 9) | Batch API (create + run) | Done |
| 9 (parallel w/ 7) | Materials + Batch UI | Done |

---

## PRD Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Company Research (Jina Reader + Gemini + Companies House) | Delivered | Three-source parallel fetch with `Promise.allSettled` |
| 8-dimension Fit Assessment (archetype detection + scoring) | Delivered | Two-step Claude tool call pattern |
| Tailored Materials (CV, cover letter, tracking note) | Delivered | Three separate prompt modules |
| Batch Mode (markdown parse + sequential processing) | Delivered | Timing-budget-aware, 1 app per call |
| Application CRUD | Delivered | POST/GET/PATCH/DELETE with ownership checks |
| Dismissed red flags persisted to DB | Delivered | `fitAssessments.dismissedRedFlags` JSON column |
| Per-dimension user annotations persisted | Delivered | `fitAssessments.dimensionAnnotations` JSON column |
| Master CV via localStorage | Delivered | `storybank_master_cv` key, never server-stored |
| Fit threshold gate on materials (default 70/100) | Delivered | 422 with bypass option (`fitThreshold: 0`) |
| Re-research / re-assess with user data preservation | Delivered | `force: true` preserves dismissed flags + annotations |
| AES-256-GCM encryption for new sensitive fields | Delivered | Job descriptions, research fields, material content |
| Radar chart (custom SVG, no charting library) | Delivered | 8-spoke polygon, `aria-hidden`, pure geometry |
| Free service stack (no Firecrawl/Exa) | Delivered | Jina Reader + Gemini grounded search + Companies House |
| Rate limiting on all new routes | Delivered | Research: 3/min, Assessment: 3/min, Batch run: 1/min |
| PDF download | Out of scope | Correctly deferred per Phase 2 Product Spec Decision 6 |
| `/applications` list page | Out of scope | Correctly deferred per Product Spec Decision 1 |

**No requirements silently dropped.** The two out-of-scope items were explicit decisions in the product spec, not omissions.

---

## What Went Well

### 1. The spec-first process graduated from Phase 1 learning to Phase 2 practice

Phase 2 had a full set of pre-build specs: architecture spec (ARCHITECTURE-PHASE2.md), UX spec (UX-PHASE2-APPLY.md), and product spec (PRODUCT-SPEC-PHASE2.md). The product spec explicitly resolved 6 conflicts between the architecture and UX specs before any engineer touched code. This is the same pattern that was identified as high-value in the Unified Experience retro. It prevented mid-build surprises on every one of the 6 conflict points.

The highest-value resolution was Decision 2 (Batch Input): the architecture expected a raw markdown textarea; the UX expected a row-based form. The PM resolved this by making the row-based form client-side serialise to markdown. Without this resolution, Thread 9 would have implemented a markdown textarea (from the architecture spec) or the batch API would have been redesigned mid-build (from the UX spec).

### 2. `Promise.allSettled` for the research pipeline is the correct pattern for multi-source external fetches

The research route fetches Jina Reader, Companies House, and Gemini Search in parallel via `Promise.allSettled`. Each can fail independently without blocking the others. The route checks whether at least one succeeded; if all fail it returns 503; if some fail it continues and logs warnings. This pattern was implemented correctly from Thread 1 onwards and held consistent through both the single-application route and the batch run route.

This is materially better than sequential fetches (would triple latency) or `Promise.all` (any failure blocks all). The 15-second Jina timeout, the Companies House 2 req/sec rate limit, and Gemini's free tier quota all make partial failure the normal case in production, not the edge case.

### 3. The adaptToolSchema adapter solved a real cross-spec inconsistency without a code change

The materials prompts were written with Anthropic's `input_schema` key format. The `callWithTool` helper was written to the Vercel AI SDK's `parameters` key format. Rather than rewriting all the prompt modules or the helper, Thread 6 added a local `adaptToolSchema` adapter function that normalises the two formats at the call site. The function is 10 lines, has a clear docstring, and is duplicated exactly in the batch run route (same problem, same solution).

The duplication is noted: `adaptToolSchema` appears in two routes but is not in `src/lib/`. This is Category C tech debt (no dedup pass after feature-complete). It is not a bug.

### 4. Test approach was well-calibrated for the constraints

297 tests from 85 is a 3.5x increase. The approach is notable for what it chose to test and what it didn't:

- **Pure-function unit tests:** `parseMarkdownListings`, `extractCompanyUrl`, `serializeRowsToMarkdown`, CSV generation, weighted score calculation, batch counter logic, timing budget logic — all tested as pure functions extracted from the implementation.
- **Encryption round-trips:** `encryptJobDescription`, `encryptResearchFields`, `encryptMaterialContent` — all tested with real AES-256-GCM via `beforeEach` env setup.
- **UI logic extracted and tested:** RadarChart geometry, score colour logic, red flag dismiss logic, form validation — all tested as standalone functions, not React components. TypeScript catches component shape errors; pure-function tests catch logic errors.
- **Skipped:** End-to-end route tests requiring Claude API mocks, database fixtures, or network calls. This is the right call for a parallel-thread build.

This is a pragmatic test strategy: test everything that can be tested cheaply and correctly; skip what requires expensive mocking.

### 5. Encryption applied correctly across all write and read paths from Thread 1

The Phase 2 encryption commit showed all new sensitive fields (job description, research fields: recentNews/cultureSignals/keyPeople, material content) were encrypted on write and decrypted on read. The read path includes: research GET routes, assessment GET routes, materials GET routes, and the batch run pipeline (which reads from all three). The previous Phase 1 pattern of "encrypt on write, forget to decrypt on read" did not recur in Phase 2.

This is the clearest evidence that the committed knowledge system works: the Phase 1 retro documented "Cross-Cutting Module Partially Wired (Write Path Only)" and that pattern did not appear in Phase 2.

### 6. The batch run route's timing-budget pattern is correct for Vercel's serverless constraints

The batch run route (`POST /api/batch/[id]/run`) processes one application per call, checks `Date.now() - startTime < 45000ms` before each step, and returns early with `remaining` count if the budget is exceeded. The client polls until `remaining === 0`. This is the right pattern for long-running pipelines on Vercel (60s limit on Pro): the client orchestrates retries, not the server.

The 45-second budget gives 15 seconds of headroom before Vercel kills the function. Each step (research, assessment, materials) can individually take 20-35 seconds, which is why each step is wrapped in a budget check.

---

## What Didn't Go Well

### 1. `adaptToolSchema` duplicated across two route files

The adapter function for normalising `input_schema` vs `parameters` in tool call formats appears in both `src/app/api/applications/[id]/materials/route.ts` and `src/app/api/batch/[id]/run/route.ts`. It should live in `src/lib/ai/call-with-tool.ts` or a new `src/lib/ai/adapt-tool-schema.ts`.

**Root cause:** Threads 6 and 7 owned these files independently. Each thread solved the same problem. No dedup pass ran after feature-complete.

**Cost:** Not a bug, but a maintenance risk. When the tool call format is updated, two files must be changed. One will be missed.

**Fix:** Extract to `src/lib/ai/adapt-tool-schema.ts` and import from both routes. This is a 10-minute fix.

### 2. The `source_type` field values are stale pivot debris

In the research route, `sources.push({ url: ..., source_type: 'firecrawl', ... })` and `sources.push({ url: ..., source_type: 'exa', ... })`. Firecrawl and Exa are the services the architecture evaluated and rejected (Phase 2 used Jina Reader and Gemini Search respectively). The `source_type` values are wrong — they should be `'jina_reader'` and `'gemini_search'`.

This is a direct repeat of the pivot debris pattern from Phase 1. The service swap was correctly implemented (Jina Reader works) but the stale service names survived in the metadata.

**Root cause:** No pivot sweep ran after Jina Reader was confirmed as the Firecrawl replacement and Gemini Search as the Exa replacement.

**Impact:** Low (metadata only, does not affect behaviour) but confusing for debugging and future engineers.

### 3. ARCHITECTURE.md v2.1 scope description is now stale

`ARCHITECTURE.md` line 6 says: `Scope: Phase 1 — Example Bank + Unified Experience`. Phase 2 routes (`/api/applications`, `/api/batch`) are implemented but not documented in the main architecture document. `ARCHITECTURE-PHASE2.md` exists separately, but the main architecture document serves as the system overview and is now incomplete.

**Fix:** Update the scope header and extend the system overview diagram in `ARCHITECTURE.md` to include Phase 2 routes, or add a clear cross-reference to `ARCHITECTURE-PHASE2.md`.

### 4. The batch run route re-loads application state by querying the DB after processing, but it reads from a stale batch counter

In the batch run route, `completedJobs` and `failedJobs` are read from the `batch` variable loaded at the start of the request. After processing, the route increments these values in-memory and writes the new totals. If two requests for the same batch run concurrently, both will read the same initial counter values and write non-additive totals. The UI limits this to one call at a time by disabling the "Process next" button during processing, but there is no server-side idempotency guard.

**Root cause:** The batch pipeline is designed for sequential execution (client polls one at a time). The timing budget and one-app-per-call design implicitly prevents concurrency. The UI enforces this. But there is no `SELECT FOR UPDATE` or optimistic concurrency check at the DB layer.

**Impact:** Low risk in practice (single-user tool, UI enforces sequencing) but worth noting for future multi-user or programmatic batch access.

---

## Test Strategy Observations

| Coverage type | Phase 2 | Assessment |
|---|---|---|
| Pure utility functions | High | extractCompanyUrl (22 tests), parseMarkdownListings (21 tests), serializeRowsToMarkdown (9 tests) |
| Encryption round-trips | Full | All new encrypted fields tested |
| UI logic functions | High | Radar geometry, score colours, form validation, status display |
| API route integration | None | Correct decision — Claude API mocking is expensive and brittle |
| External service clients | None | Jina, Gemini, Companies House not unit-tested — right call for free services with no SDK types |
| Timing budget logic | Present | Extracted as pure function, 5 tests |
| Batch counter logic | Present | Extracted as pure function, 6 tests |

The test count growth (85 → 297) reflects disciplined extraction of testable pure functions from route and component logic, not superficial test inflation. This is the right approach for a parallel-thread build.

---

## Agent Performance

| Agent/Thread | Rating | Assessment |
|---|---|---|
| @orchestrator | Good | Thread sequencing was correct. The 5-wave structure (1-4 parallel, then 5, then 6+8, then 7+9) correctly serialised dependencies. Product spec was resolved before engineers started. |
| @architect | Good | ARCHITECTURE-PHASE2.md was detailed and implementable. The free service stack constraint was honoured. The timing budget solution was pre-planned. |
| @pm | Good | 6-decision conflict resolution was high-value. Batch serialisation Decision 2 saved a mid-build redesign. The ACs with edge cases were specific enough to build from without iteration. |
| @engineer (Threads 1-4) | Good | Clean parallel work. Services, prompts, schema, encryption all delivered consistently. No cross-thread conflicts. |
| @engineer (Thread 5) | Good | Application CRUD + research pipeline correct. Promise.allSettled pattern was well-implemented. |
| @engineer (Thread 6) | Good | Assessment route is the most complex in the codebase (archetype detection + scoring + vector matching + tag fallback + force-rerun with user data preservation). Well-structured. |
| @engineer (Thread 7) | Good | Batch run timing budget implementation is clean. One-app-per-call is the right design. |
| @engineer (Thread 8) | Good | RadarChart SVG without a charting library is a good pattern. Form validation tests extracted cleanly. |
| @engineer (Thread 9) | Good | Batch UI with row-based input serialising to markdown is correct per product spec. CSV export and localStorage tests are thorough. |

**Overall:** Second consecutive session where no agent performed below "Good". The spec-first process is raising the floor consistently.

---

## Process Observations

### The multi-spec approach works at Phase 2 scale

Phase 1 had one spec (ARCHITECTURE.md). Phase 2 had three (ARCHITECTURE-PHASE2.md, UX-PHASE2-APPLY.md, PRODUCT-SPEC-PHASE2.md). The product spec's explicit conflict resolution was essential at this scope. Six conflicts between the architecture and UX specs were resolved before any engineer built. Without the PM layer, those six conflicts would have surfaced mid-build as blocking questions or produced inconsistent implementations across threads.

### The 9-thread granularity was correct

Threads 1-4 are deliberately thin (services, prompts, schema, encryption) — they build infrastructure that later threads depend on. Running them in parallel caps the foundation wave at ~30 minutes rather than ~2 hours sequential. Threads 5, 6, 7, 8, 9 are feature threads. Each has a clear deliverable and explicit file ownership. No file conflicts occurred.

The test count distribution (Thread 7/9 own the most tests — batch and UI logic) reflects that the more logic-heavy threads wrote more tests, not that other threads were under-tested.

### The committed knowledge system is demonstrably working

**Patterns that did NOT recur:**
- Encrypt on write, forget to decrypt on read: not a single instance in Phase 2
- String interpolation injection: no new instances (existing instance in Upstash client already fixed)
- Schema mismatch (integer vs ISO-8601 timestamps): not a single instance in 5 new DB tables

**Patterns that DID recur (identified above):**
- Pivot debris: `source_type: 'firecrawl'` / `source_type: 'exa'` in research metadata
- `adaptToolSchema` duplicated across two files (post-feature-complete dedup not done)

The recurrence rate is lower than Phase 1. The graduating patterns are less severe (metadata labelling, missing dedup) vs Phase 1 (encryption not wired, userId missing from WHERE).

---

## Learnings to Graduate

| Learning | Target | Tier | Rationale |
|---|---|---|---|
| `Promise.allSettled` for multi-source external fetches | @engineer | Tier 2 | New pattern, correct approach, likely to recur in any multi-source pipeline |
| Dedup pass after feature-complete | @orchestrator | Tier 1 | Seen once (adaptToolSchema) — wait for second occurrence |
| Pivot debris in metadata strings | @engineer | Tier 1 | Variant of existing common-mistake (pivot debris) — not new enough to graduate separately |
| Tool schema format adapter (input_schema vs parameters) | @engineer | Tier 2 | Specific to Anthropic SDK + Vercel AI SDK coexistence — likely to recur in any project using both |
| Timing-budget pattern for Vercel serverless batch processing | @engineer | Tier 2 | New pattern, correct design, will recur on Vercel-hosted pipelines |

---

## Graduated Patterns (Tier 2)

### 1. Promise.allSettled for Multi-Source External Fetches

The research pipeline correctly uses `Promise.allSettled` rather than `Promise.all` or sequential awaits. This pattern will recur in any pipeline that calls multiple external services where partial failure is normal.

### 2. Tool Schema Format Adapter (input_schema vs parameters)

When Anthropic SDK prompt modules use `input_schema` but the `callWithTool` helper expects `parameters` (Vercel AI SDK format), a local adapter function normalises the two formats. The adapter should live in `src/lib/ai/` and be imported, not duplicated per-route.

### 3. Timing-Budget Pattern for Serverless Batch Processing

On Vercel (60s function timeout), long-running batch pipelines must process one item per request with a timing budget check before each step. The client polls until `remaining === 0`. The server never runs past the budget.

---

*RETRO-phase2.md — StoryBank Phase 2 Retrospective*
