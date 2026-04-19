# Orchestrator Agent -- Committed Knowledge

## Stack Constraints as Explicit Prompt Input

**Context:** Launching the architect agent for a new project.

**Learning:** The architect defaulted to Supabase because it's the portfolio standard. The constraint "no free Supabase slots" was in the user's conversation but not in the architect's prompt. This caused a full spec rewrite.

**Action:** Always include a `## Constraints` block in the architect's input prompt:
```
## Constraints
- Database: Turso (SQLite) -- user has no free Supabase slots
- Auth: Auth.js (Google OAuth)
- Deployment: Vercel
- Do NOT use: Supabase, Firebase
```
Never rely on conversation context reaching the architect through implicit channels.

**Source:** StoryBank Phase 1 / 2026-04-18

---

## TypeScript Build Gate Between Waves

**Context:** Launching parallel engineering threads in waves where later waves depend on earlier wave output.

**Learning:** Type errors from Wave 2 leaked into Wave 3, causing engineers to fix each other's TypeScript errors. This wasted ~15 minutes across multiple threads.

**Action:** After each wave completes, run `tsc --noEmit` before launching the next wave. This takes ~5 seconds and catches type errors before they cascade. If the build fails, fix the errors before proceeding.

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Cross-Cutting Integration Thread Pattern

**Context:** A module (encryption, analytics, caching) is built by one thread but needs to be integrated into routes owned by other threads.

**Learning:** The encryption module was built with full tests but never wired into transcript/example API routes. No thread was explicitly tasked with integration. Only caught by the reviewer.

**Action:** When a cross-cutting capability is in the build plan:
1. Build the module in its own thread (Thread N)
2. After Thread N completes, create an explicit integration thread (Thread N+1) with scope: "Wire [module] into routes [list]"
3. The integration thread's file ownership includes both the module AND the consuming routes

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Thread Specs Should Highlight Non-Default Decisions

**Context:** Writing thread specs for engineers who will implement against an architecture document.

**Learning:** The schema used ISO-8601 text timestamps instead of the SQLite-default integer timestamps. The engineer missed this in the architecture doc and initially implemented integer timestamps.

**Action:** Each thread spec should include a "Key decisions that differ from defaults" section:
```
## Non-Default Decisions (read carefully)
- Timestamps: ISO-8601 text strings, NOT integer epoch
- IDs: cuid2 via @paralleldrive/cuid2, NOT autoincrement
- System tags: userId = null, NOT a separate boolean column
```

**Source:** StoryBank Phase 1 / 2026-04-18

---

## 10-Thread Granularity Was Right

**Context:** Deciding how many threads to use for a ~8,000-line feature build.

**Learning:** 10 threads in 6 waves was the right granularity for StoryBank Phase 1. Each thread had clear scope, a deliverable, and explicit file ownership. No file conflicts occurred.

**Action:** For builds of similar scope (5-10 features, ~5,000-10,000 lines), target 8-12 threads. Split by feature surface area (UI page + API route + lib module = one thread). Do not split below the feature boundary (e.g., "API only" and "UI only" for the same feature) unless they can run in truly independent waves.

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Spec-First Process: Designer + Strategist + PM Before Engineering

**Context:** Launching engineering threads for a feature build with multiple inter-connected components.

**Learning:** In both the Unified Experience build and Phase 2, adding a spec phase (designer, strategist, PM producing separate spec documents) before any engineer thread started prevented mid-build surprises. In the Unified Experience, the PM caught a missing API endpoint that would have blocked Thread B mid-build. In Phase 2, the PM resolved 6 conflicts between the architecture and UX specs before engineering started — including a batch input paradigm conflict that would have produced inconsistent implementations across two threads.

**Action:** For any build involving:
- Multiple inter-connected UI pages and API routes
- A separate UX spec and architecture spec (both may conflict)
- More than 5 engineering threads

Run a spec phase first:
1. Designer produces UX spec (component props, visual states, accessibility)
2. Strategist challenges prioritisation and identifies missing integrations
3. PM resolves conflicts between UX and architecture specs, writes acceptance criteria with edge cases

The spec phase adds ~30-60 minutes but prevents hours of mid-build rework. Validated in 2 consecutive projects.

**Source:** StoryBank Unified Experience (first instance) + Phase 2 (second instance) / 2026-04-19

---

## Add a Sweep Phase Before Review

**Context:** The build is feature-complete. All threads have delivered. `tsc --noEmit` passes. About to launch review agents.

**Learning:** In StoryBank, the review found 19 issues. 47% were pivot debris (old service references in docs/dead pages), 32% were partial integration (encryption on writes but not reads), and 21% were missing quality gates (no error boundaries, inconsistent UX, missing rate limits). All of these are cheap to fix BEFORE review but expensive to find and fix AFTER review because the review generates a long remediation list that requires re-context.

**Action:** Before launching review agents, run a sweep phase:
1. **Pivot sweep:** For each service swap in the git log, grep for old service name across all file types. Delete or update all references.
2. **Cross-cutting wiring audit:** For each module in `src/lib/` that provides a cross-cutting capability, grep for its imports across all route files AND all page files. Verify both read and write paths.
3. **Production readiness checklist:** Error boundaries on all pages, rate limiting on public routes, admin auth on internal endpoints, input validation with fallbacks on all query params, consistent delete/destructive action patterns.
4. **Dead code pass:** Search for placeholder text ("ships in Thread", "TODO", "coming soon"), unused pages, unused type files, dead function params.

This sweep takes 20-30 minutes and prevents the review from surfacing dozens of known-pattern issues.

**Source:** StoryBank Phase 2 review / 2026-04-18 -- 19 issues found, estimated 20 min prevention vs 2+ hr remediation

---

## Pre-Planned Fallbacks Eliminate Blocking

**Context:** Specifying a dependency with uncertain compatibility.

**Learning:** CipherStash's SQLite incompatibility was discovered at build time, but because the fallback (AES-256-GCM) was defined in the architecture spec, the engineer pivoted instantly with no debate or redesign.

**Action:** For any dependency marked as uncertain in the architecture spec, require the architect to define: (1) the primary approach, (2) the fallback approach, (3) the trigger condition for switching. Engineers should be pre-authorised to take the fallback without waiting for orchestrator approval.

**Source:** StoryBank Phase 1 / 2026-04-18

---

## Spec the Timing Budget for Vercel Batch Pipelines

**Context:** The architecture spec includes a long-running pipeline (multiple external calls + LLM synthesis per item) that will run on Vercel.

**Learning:** Vercel serverless functions have a 60s timeout. A pipeline of research + assessment + materials for one item takes 40-90s. Without a pre-specified timing budget, an engineer either (a) tries to fit everything in one call and hits the timeout, or (b) invents an ad-hoc budget without knowing the design intent.

**Action:** For any pipeline on Vercel where the per-item cost exceeds 30s, the architecture spec must include:
1. The processing model: "one item per request, client polls"
2. The timing budget: `TIMING_BUDGET_MS = function_timeout - 15000` (15s safety margin)
3. The return contract: `{ remaining: N, processed_this_call: M }` so the client knows whether to poll again

Include this in the architecture spec section for the batch route, not just in code comments.

**Source:** StoryBank Phase 2 / 2026-04-19 -- batch pipeline design
