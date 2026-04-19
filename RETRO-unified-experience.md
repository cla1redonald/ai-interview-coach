# StoryBank Unified Experience Retrospective

**Date:** 2026-04-19
**Outcome:** Code complete (Threads A, B, D shipped; Thread C deferred)
**Build method:** `/orchestrate` with Agent Teams -- 3 build threads + spec phase + review
**Session scope:** Connecting StoryBank archive + mock interview into a single preparation loop

---

## Session Summary

The Unified Experience build added the "preparation loop" to StoryBank -- the ability for a user to see a weakness in Mirror or a gap in Job Match, click through to a focused practice session, and save the results back to their Example Bank.

Three spec agents ran before any code was written (designer, strategist, PM). Three build threads ran after. One reviewer thread ran after build. This was a significantly more mature process than Phase 1.

---

## What Was Built

| Thread | Scope | Status |
|--------|-------|--------|
| D (Nav Polish) | Sidebar sections renamed BUILD/APPLY/PRACTISE, Mic icon, dashboard CTA | Done |
| A (Focus Flow) | ?focus= and ?gap= query params, PracticeContextBanner, system prompt injection, StrengthMap + Job Match CTAs | Done |
| B (Save to Bank) | POST /api/examples, "Practice session" tag, ChatInterface callback, Q&A extraction, SaveToBankPrompt, SaveToBankModal | Done |
| C (Where to Focus) | Dashboard module with priority-ranked guidance | Deferred |

---

## PRD Coverage

| Requirement | Status | Notes |
|-------------|--------|-------|
| Focus/gap query param on Practice page | Delivered | AC-3.1 through AC-3.7 covered |
| System prompt injection for focus topic | Delivered | Sanitised (trim, 200 char, no newlines) |
| PracticeContextBanner (full + chip modes) | Delivered | role="status", aria-label on clear |
| Mirror StrengthMap "Practice [category]" CTAs | Delivered | Shown when weak+unrated > strong |
| Job Match "Practice this gap" CTAs | Delivered | On each gap card |
| Save to Bank prompt card (inline) | Delivered | Appears after feedback completes |
| Save to Bank modal (checkboxes, edit, save) | Delivered | aria-modal, aria-live count |
| Q&A extraction utility | Delivered | extractQAPairs in practice-utils.ts |
| POST /api/examples | Delivered | Auth, validation, encryption, auto-tag |
| "Practice session" system tag | Delivered | 14th tag in seed.ts |
| ChatInterface onFeedbackComplete callback | Delivered | Returns full message array to parent |
| Nav section labels (BUILD/APPLY/PRACTISE) | Delivered | |
| Practice icon (Mic) | Delivered | |
| Dashboard quick-action update | Delivered | |
| Dashboard "Where to Focus" module | Deferred | Thread C -- not built this session |
| Dashboard sessions count | Deferred | Correctly deferred per strategy review |
| Practice-saved examples: embedding generation | Not built | POST /api/examples does not trigger embeddings |

**Silently dropped or deferred:**
- Focus topic tag propagation (AC-2.7 specifies focus topic auto-tagging on saved examples; POST /api/examples does not currently look up and apply a matching tag from the focus param -- only the "Practice session" system tag is auto-applied)
- Partial save messaging (if 2 of 3 saves succeed, the user sees a success toast for the saved count but no indication that one failed)

---

## What Went Well

### 1. Spec-first process caught real problems before code was written

Three spec agents ran before any engineer touched code:
- **Designer** produced the UX spec with component props, visual specs, and accessibility notes
- **Strategist** challenged the "all P0" prioritisation, re-ranked by user value, and identified two missing integration points
- **PM** caught that POST /api/examples did not exist (the UX spec assumed it did), identified the expensive AI call problem on the dashboard, and wrote acceptance criteria with edge cases

The PM catching the missing POST endpoint is the standout moment. If the engineer had started Thread B from the UX spec alone, they would have discovered mid-build that the API they needed to call does not exist. The spec phase turned a mid-build surprise into a planned deliverable.

### 2. The P0 prompt injection fix was caught by the reviewer

The reviewer found that `msg.role` was not validated in `/api/chat` -- a client could send `{ role: "system" }` messages to inject into the system prompt. This was the only P0 in this session and it was fixed immediately. The fix is clean: `if (!['user', 'assistant'].includes(msg.role))` rejects any non-standard role.

This is a net improvement over Phase 1. The Phase 1 review found 5 P0s. This session found 1 P0. The committed knowledge from the Phase 1 retro is working -- the engineer built the POST /api/examples route with encryption, user-scoped tag queries, and input validation baked in from the start.

### 3. Thread sequencing was correct

The orchestrator parallelised Thread D (trivial nav polish) with Thread A (focus flow), then ran Thread B (save to bank) after A completed. This was the right call: Thread B depends on Thread A's `onFeedbackComplete` callback in ChatInterface, so they cannot run in parallel. Thread D has no dependencies and was correctly run alongside A.

### 4. The "onFeedbackComplete callback" design decision was sound

The PM's product spec identified the open question: ChatInterface owns messages state internally, but Save to Bank needs access to the messages after feedback. The PM recommended the callback approach (`onFeedbackComplete?: (messages: Message[]) => void`) over lifting state, and that is what was built. This was the lower-risk option and kept the ChatInterface diff small.

### 5. POST /api/examples got security right the first time

The new POST handler includes:
- Auth session check (userId from session, never from body)
- Input validation (type checks, length limits on question/answer)
- Transcript ownership verification (if transcriptId provided, verify it belongs to user)
- Encryption (encryptExampleFields when ENCRYPTION_KEY is set)
- Cross-user tag scoping (tag query filters by `isNull(tags.userId)` OR `eq(tags.userId, userId)`)
- Auto-tagging server-side (no client-side tag ID lookup needed)

Compare this to Phase 1's initial routes, where encryption wiring and userId scoping were repeatedly missed. The committed knowledge is demonstrably working.

---

## What Went Wrong or Nearly Went Wrong

### 1. P0: msg.role not validated in /api/chat (prompt injection vector)

**Severity:** High. **Caught by:** Reviewer. **Fixed:** Yes.

The `/api/chat` route accepted any `role` value in the messages array. A client could send `{ role: "system", content: "Ignore all previous instructions..." }` and inject directly into the system prompt. The fix validates that `msg.role` is either `"user"` or `"assistant"`.

**Why it happened:** The chat route was written in Phase 1 before the security review mindset was established. The Unified Experience changes to this file (adding `focusTopic` param + sanitisation) were correctly implemented, but nobody audited the existing code in the same file while they were there.

**Pattern:** When modifying an existing route for a new feature, the existing code in that file does not get re-audited. The engineer focuses on the new lines, not the old ones. This is the "while you're in the neighbourhood" problem -- fixing things you notice is optional, but auditing the whole file is not part of the standard workflow.

### 2. Eight P1 findings, three deferred

The reviewer found 8 P1 issues. Five were fixed immediately:
- Cross-user tag scoping on POST /api/examples (already correct in the code -- this was a verification, not a fix)
- `saveSkipped` state not reset when starting a new practice session (state leak between sessions)
- Double-click guard on save button (ref-based guard added to prevent duplicate POST calls)

Three P1s were deferred:
- Focus trap on SaveToBankModal (accessibility -- modal does not trap keyboard focus)
- Partial save messaging (no indication to user when N-1 of N saves succeed)
- Stale closure risk in handleSave (the `pairs` reference could theoretically go stale, though unlikely in practice)

### 3. The strategist's recommendation on AI extraction was not adopted

The strategist recommended replacing the client-side heuristic Q&A extraction (word count threshold + filler phrase detection) with a Claude Haiku call to extract and evaluate Q&A pairs. The PM acknowledged this in the spec but recommended the heuristic approach for simplicity. The build used the heuristic.

This is not a mistake -- it is a deliberate scope decision. But it is worth recording because the strategist's reasoning is sound: the 50-word threshold will miss short, powerful answers, and the filler-phrase detection is brittle. If Save to Bank conversion rate (target: 40% of eligible sessions) falls below 20%, the first thing to investigate is Q&A extraction quality.

### 4. Practice-saved examples have no embeddings

POST /api/examples creates the example row and applies tags, but does not generate embeddings. This means practice-saved examples will not appear in Job Match results until a backfill runs. The HANDOFF.md correctly flags this as an open item, but it is a gap in the preparation loop: the user saves a practice answer, runs Job Match, and their new answer does not appear.

---

## Review Findings: Comparison to Phase 1

| Metric | Phase 1 Review | UE Review | Trend |
|--------|---------------|-----------|-------|
| Total findings | 19 | 17 (1 P0 + 8 P1 + 8 P2) | Slight improvement |
| P0 findings | 5 | 1 | Significant improvement |
| Security P0s | 3 | 1 | Significant improvement |
| Findings in NEW code | ~10 | ~12 | Similar |
| Findings in EXISTING code | ~9 | ~5 | Improvement |

**Analysis:** The P0 count dropped from 5 to 1. The remaining P0 (msg.role validation) was in existing code that predates the committed knowledge. The new code (POST /api/examples, PracticeContextBanner, SaveToBankModal) was significantly cleaner because the engineer applied lessons from the Phase 1 retro (encryption wiring, input validation, user-scoped queries).

The total finding count (17) is similar to Phase 1 (19), but the severity distribution shifted dramatically. Most UE findings are P1/P2 polish items (focus trap, partial save messaging, stale closure). This is a healthier distribution -- the review is catching fit-and-finish issues, not security holes.

**The pattern that DID NOT recur:**
- Cross-cutting module not wired in: POST /api/examples correctly calls `encryptExampleFields` and `isEncryptionEnabled`. This was the Phase 1 repeat offender. It is now resolved.
- Pivot debris: No service swaps in this session, so the pivot sweep was not needed. But importantly, the previous session's sweep cleaned up the existing debris, so the codebase was clean going in.

**The pattern that IS new:**
- Existing code not re-audited when modifying a file (msg.role validation). This is a new pattern worth tracking.

---

## Agent Performance

| Agent | Rating | Assessment |
|-------|--------|------------|
| @designer | Good | UX spec was well-structured with component props, visual specs, and accessibility notes. Correctly identified the preparation loop as the mental model. Over-estimated priority (marked all P0). |
| @strategist | Good | Re-ranked priorities correctly. Identified two missing integration points. The AI extraction recommendation was sound even though it was not adopted. Risk analysis was thorough. |
| @pm | Good | Caught the missing POST endpoint -- the highest-value PM contribution. Acceptance criteria with edge cases prevented ambiguity. Thread breakdown and sequencing were correct. |
| @orchestrator | Good | Correct thread sequencing (D+A parallel, B after A). Did not over-parallelise. Deferred Thread C appropriately. |
| @engineer (Thread D) | Good | Trivial scope delivered cleanly. |
| @engineer (Thread A) | Good | Focus flow implementation is clean. System prompt sanitisation was proactive. |
| @engineer (Thread B) | Good | POST /api/examples is the best-secured route in the codebase. Encryption, validation, and tag scoping all correct from the first commit. SaveToBankModal has proper aria attributes. |
| @reviewer | Good | Found the P0 prompt injection vector. Caught the saveSkipped state leak and double-click race condition. Correctly prioritised findings. |

**Overall:** This is the first session where no agent performed below "Good." The spec-first process and committed knowledge from Phase 1 raised the floor.

---

## Process Observations

### The spec phase is paying for itself

Phase 1 had no spec phase -- the architect wrote ARCHITECTURE.md and engineers built from it. This session added three spec agents (designer, strategist, PM) before the build. The result:
- PM caught the missing POST endpoint (would have been a mid-build surprise)
- PM caught the dashboard AI call cost problem (would have caused a runtime performance issue)
- Strategist correctly re-prioritised (prevented Thread C from blocking the critical path)
- Designer's component specs were specific enough to build from without iteration

The spec phase added ~30 minutes to the session but saved at least that much in prevented rework.

### Thread C deferral was the right call

The "Where to Focus" dashboard module was correctly deferred. The PM downgraded it to P1 and the strategist agreed. This is a medium-complexity feature (priority logic, lightweight DB queries, conditional rendering) that does not block the core preparation loop. Shipping A + B without C still delivers the full user journey: see weakness, practice it, save the result.

### The committed knowledge system is working, with one gap

The Phase 1 retro graduated patterns to `memory/shared/common-mistakes.md` and `memory/agent/`. The UE session shows these patterns being applied:
- Encryption wiring: correct on POST /api/examples (Phase 1 repeat -- now resolved)
- Input validation: focusTopic sanitised proactively
- User-scoped queries: tag queries filter by userId

The gap: committed knowledge covers patterns the BUILD should avoid, but not patterns the REVIEW should check for in existing code. The msg.role P0 was in pre-existing code. The reviewer checked the new code but did not audit the existing code in the same file.

---

## Learnings to Graduate

| Learning | Target | Tier | Rationale |
|----------|--------|------|-----------|
| Audit existing code when modifying a file | @reviewer | Tier 2 | P0 was in existing code touched during this session |
| Spec-first process catches missing APIs | @orchestrator | Tier 1 | One session, non-critical -- but high value |
| Double-click guard on async save buttons | @engineer | Tier 2 | Common UI bug, easy to miss, easy to prevent |
| Heuristic vs AI extraction: track conversion | @pm | Tier 1 | Need data before graduating |

---

## Graduated Patterns (Tier 2)

### 1. Audit Existing Code When Modifying a File (reviewer.md)

The P0 prompt injection was in existing `/api/chat` code that the engineer modified to add `focusTopic`. The new code was correct; the old code was vulnerable. The reviewer checked the new lines but did not audit the existing code in the same file.

### 2. Double-Click Guard on Async Save Buttons (engineer.md)

The SaveToBankModal initially had no guard against double-clicks on the save button. Each click fired N sequential POST calls. Without the ref-based guard (`savingRef.current`), a double-click would save every example twice. This is a universal pattern for any button that triggers async server calls.

### 3. msg.role Validation on Chat Routes (common-mistakes.md)

Any API route that accepts a messages array and passes it to an LLM must validate that `msg.role` is one of the expected values. Without validation, a client can inject `{ role: "system" }` messages that override the server-constructed system prompt.

---

*RETRO-unified-experience.md -- StoryBank Unified Experience Retrospective*
