# Retrospective: 19 Review Findings (2026-04-18)

**Project:** StoryBank (ai-interview-coach)
**Trigger:** 3 review agents (docs, code, QA) ran post-build and surfaced 19 issues (5 P0, 7 P1, 7 P2)
**Question:** How did 19 issues accumulate in a project that already had a Phase 1 retrospective and committed knowledge?

---

## Root Cause Analysis

### The issues fall into three distinct categories:

**Category A: Tech Debt from Pivots (9 issues -- 47%)**

These exist because the codebase changed direction mid-build and nobody went back to clean up the wake.

| Issue | Pivot That Caused It |
|-------|---------------------|
| 6 docs files still reference Voyage AI, Resend, CipherStash | Voyage->OpenAI, Resend->Google OAuth, CipherStash->AES-256-GCM |
| Dead signup page with "Authentication ships in Thread 1" placeholder | Resend magic link -> Google OAuth (signup page became redundant) |
| Dead `types.ts` file | Types moved to `src/lib/types/index.ts` but old file never deleted |
| Dead `inputType` param on embedding functions | Voyage AI had input types, OpenAI does not |
| Stale `.env.example` comments | Referenced old services |
| CipherStash still mentioned in PRIVACY.md as "can be revisited" | Reads as current roadmap, not historical context |

**Why it happened:** Each pivot was a focused swap -- the engineer changed the implementation, got it working, and moved on. Nobody ran a "blast radius" check after each swap: what else references the old thing? Docs, dead pages, dead params, and stale env comments are invisible to `tsc --noEmit`.

**Category B: Missed During Implementation (6 issues -- 32%)**

These are bugs or gaps that should have been caught during the build but were not.

| Issue | Why It Was Missed |
|-------|-------------------|
| 4 files reading encrypted DB fields without decrypting | Known pattern from Phase 1 retro (encryption module not wired in). The wiring was partially done in the enrich route but skipped on read paths. |
| Pass 2 corrections writing back unencrypted | The enrich route decrypts before processing but the correction update originally wrote plaintext back. Fixed in enrich but the review found the original pattern on other routes. |
| TOCTOU gap -- userId missing from WHERE on Pass 2 correction updates | The `where` clause on the update used only `eq(examples.id, ...)` without `eq(examples.userId, userId)`. Copy-paste from a context where ownership was already verified by the SELECT. |
| "Approve All" button in ReviewPanel doesn't persist | Local state change with no API call behind it. Feature was scaffolded in the UI thread but the API integration was never done. |
| NaN on pagination params | `parseInt` without fallback. Classic. |
| Enrich route had no idempotency guard initially | EnrichTrigger component fires on mount. No check for "already enriched" meant re-running on every page visit. (Note: the current code DOES have the `enrichedAt` guard -- this was fixed during build but the review found the original pattern in the component mount logic.) |

**Why it happened:** Two root causes. First, the encryption wiring problem is a repeat of the Phase 1 finding -- the cross-cutting module was built but integration was incomplete. The committed knowledge in `memory/shared/common-mistakes.md` literally describes this pattern, but it was not applied to the read paths. Second, the ReviewPanel "Approve All" and pagination issues are standard "scaffolded but not finished" gaps that happen when UI threads and API threads have different owners and no integration verification.

**Category C: Never Had a Gate For This (4 issues -- 21%)**

These are not bugs from implementation -- they are categories of quality that the project never checked for.

| Issue | What Gate Would Catch It |
|-------|-------------------------|
| Backfill endpoint has no admin auth (any logged-in user can trigger) | Endpoint security audit checklist |
| Rate limiting gap on /api/chat | Rate limit audit across all public/semi-public routes |
| No error boundaries anywhere | Error boundary checklist for production readiness |
| Inconsistent delete confirmation (2-click, window.confirm, none) | UX consistency audit |
| `callWithTool` duplicated across 3 route files | DRY/refactor pass after feature-complete |
| Next.js 15 async params pattern not used | Framework upgrade checklist |

**Why it happened:** The build plan had no explicit quality gates for these. The orchestrator's exit criteria were "TypeScript builds, features work, tests pass." There was no "production readiness checklist" covering security hardening, UX consistency, error handling, or code deduplication. These are not bugs -- they are polish and hardening work that was never scoped.

---

## The Deeper Pattern

The 19 issues break down to a single structural problem: **the build process has no "sweep" phase after the feature work is done.**

The current flow is:

```
Architect -> Engineer (waves) -> tsc gate -> next wave -> ... -> Review
```

The review found everything. The problem is that review happened AFTER the build was considered "done." By then, 19 issues had accumulated across 16 commits.

What is missing is a sweep between "features complete" and "review":

```
Architect -> Engineer (waves) -> tsc gate -> ... -> SWEEP -> Review
```

The sweep would cover:
1. **Blast radius check after pivots:** grep for every reference to the old service/pattern and update or delete
2. **Cross-cutting wiring audit:** for every module in `src/lib/`, verify it is imported and called where it should be
3. **Production readiness checklist:** error boundaries, rate limiting, admin auth, input validation
4. **UX consistency audit:** are delete flows, loading states, and error states consistent?
5. **Dead code removal:** unused pages, params, types, files

---

## What the Phase 1 Retro Already Knew

The committed knowledge in `memory/shared/common-mistakes.md` already documented:

- "Cross-Cutting Module Not Wired In" -- encryption module built but never imported from routes
- The reviewer knowledge in `memory/agent/reviewer.md` says to grep for imports of cross-cutting modules

These patterns were identified but not fully applied. The encryption was wired into the enrich route (writes) but not into the read paths (transcript detail, review page, breakdown API, mirror/analyze API). The learning was specific enough ("grep for imports") but nobody ran that grep before calling the build complete.

**Diagnosis:** The retro captured the right lesson but it did not become a mandatory gate. It was knowledge, not a checklist item. Knowledge gets forgotten between sessions. Checklists do not.

---

## Actionable Takeaways

### 1. Add a "Pivot Sweep" to the build process

After any service/dependency swap (auth provider, embedding service, encryption approach), run:
```
grep -r "OLD_SERVICE_NAME" --include="*.ts" --include="*.tsx" --include="*.md" --include="*.env*"
```
Delete or update every hit. Commit the sweep as a separate commit with message `chore: sweep references to [old service]`.

**Owner:** Engineer (or orchestrator if delegating)
**When:** Immediately after any swap commit, before moving to the next feature

### 2. Create a Production Readiness Checklist

Before any review phase, run through:

- [ ] Every route: auth check present?
- [ ] Every route with user input: input validation with fallbacks?
- [ ] Every admin/internal endpoint: admin auth or token gate?
- [ ] Every page: error boundary wrapping async data fetches?
- [ ] Every destructive action: consistent confirmation pattern?
- [ ] Every cross-cutting module in `src/lib/`: grep for imports, verify called on all paths?
- [ ] Rate limiting on all public-facing routes?
- [ ] `tsc --noEmit` passes?
- [ ] No dead pages/routes (check for placeholder text like "ships in Thread X")?

**Owner:** Orchestrator (delegates to engineer, verifies before launching review)

### 3. Treat Committed Knowledge as Checklist Input, Not Just Documentation

The retro pattern entries in `memory/` are useful but passive. Before each review, the reviewer agent should read `memory/shared/common-mistakes.md` and explicitly check for each known pattern. Not "be aware of" -- actually grep for and verify.

**Owner:** Reviewer agent prompt should include: "Before reviewing, read memory/shared/common-mistakes.md. For each entry, run the detection step described."

### 4. Scope UX Consistency as a Thread

Inconsistent delete confirmations, missing error boundaries, and unfinished UI interactions (Approve All) happen because they span multiple feature threads but no single thread owns the horizontal. After all feature threads complete, add a "UX Hardening" thread with scope:
- Consistent error states
- Consistent delete/destructive flows
- Verify all buttons have working API calls behind them
- Error boundaries on every page

### 5. Dedup Pass After Feature-Complete

`callWithTool` duplicated across 3 files is the kind of thing that happens naturally during parallel thread development. Each thread builds what it needs. After merge, run a dedup pass to extract shared utilities. This is 15 minutes of work but easy to forget.

---

## Issue Classification Summary

| Category | Count | % | Preventable By |
|----------|-------|---|----------------|
| Tech debt from pivots | 9 | 47% | Pivot sweep grep |
| Missed during implementation | 6 | 32% | Cross-cutting wiring audit + integration verification |
| Never had a gate | 4 | 21% | Production readiness checklist |

---

## Severity vs Prevention Effort

The 5 P0s (encryption not decrypting on read paths, unencrypted write-back, idempotency gap, dead signup page, TOCTOU) could all have been prevented by two actions:
1. Running the "cross-cutting module wiring" check from the existing committed knowledge
2. Running a blast radius grep after the auth pivot

Total estimated prevention effort: 20 minutes. Total review-and-fix effort after the fact: 2+ hours across 3 review agents and the subsequent fix session.

**The cheapest time to find a bug is before you declare the build done.**
