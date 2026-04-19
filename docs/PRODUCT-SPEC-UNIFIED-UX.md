# StoryBank — Product Spec Addendum: Unified Experience

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Engineering-ready — approved for build
**Author:** Product Manager
**Input:** UX-UNIFIED-EXPERIENCE.md v1.0 (2026-04-18)

This document translates the UX spec into buildable requirements. Read UX-UNIFIED-EXPERIENCE.md first for visual specs and rationale. This document does not repeat what is already there — it adds what is missing: acceptance criteria, edge cases, data model analysis, API contracts, scope decisions, and thread breakdown.

---

## 1. Scope Decision: Challenge on All-P0 Designation

The UX spec marks all 10 items as P0. That is not a prioritisation — it is a wish list. Forcing a rank:

### True P0 — Ships together, or the integration does not exist

| Item | Why it is the anchor |
|------|----------------------|
| Focus/Gap query param on Practice page | Nothing links to Practice with context without this |
| System prompt injection for focus topic | Focus param is useless without this — user gets a generic session |
| Mirror → Practice CTA link | First entry point into the focus flow |
| Job Match → Practice CTA link | Second entry point — completes the loop |

These four are a single unit. If you ship any one without the others, you ship a dead link or a confusing experience. Ship as one thread.

### P1 — High value, but does not block the integration

| Item | Why it can slip one sprint |
|------|---------------------------|
| "Save to Bank" post-practice modal | Closes the loop, but the loop still exists without it. Users can still navigate the connected flow. |
| Dashboard "Where to Focus" module | Improves discoverability but the connections exist in Mirror and Match regardless |

These are the features that make the product feel *smart*. They are not table stakes for the integration to exist, but they are what makes the integration feel deliberate rather than incidental. Target for sprint 2 if sprint 1 scope is tight.

### P2 — Polish, no user impact if deferred

| Item | Why it can wait |
|------|----------------|
| Nav section label rename (Library/Track/Prepare → BUILD/APPLY/PRACTISE) | Cosmetic. Does not affect any flow. |
| Practice icon change MessageCircle → Mic | One line. Ship it in any passing PR. |
| Dashboard quick-action update | Replace "Check consistency" with "Start practice". Low stakes — users can still navigate. |
| "Practice session" system tag in seed | Only needed if Save to Bank ships. Move to P1 thread. |
| Dashboard sessions count | The UX spec already deferred this. Keep it deferred. |

### Decision

**Minimum viable integration = Thread A (focus param + system prompt + two CTAs).** This makes the product feel connected. Everything else is enrichment.

If the sprint has capacity: add Thread B (Save to Bank) and Thread C (Where to Focus) immediately after. If not, ship Thread A and users will feel the difference on day one.

---

## 2. Acceptance Criteria (P0 Items — Given/When/Then)

### Item 1: Dashboard "Where to Focus" module

**Precondition:** User has >= 5 examples in their bank.

**AC-1.1 — Consistency flag takes priority**
- Given: user has >= 1 active contradiction in consistency_entries (detected by `/api/consistency/check`)
- When: dashboard loads
- Then: the focus card renders with `--contradiction` left border, showing the conflict topic and a link to `/consistency`
- And: only one card is shown (not multiple)

**AC-1.2 — Weak coverage surfaced when no contradiction exists**
- Given: user has > 5 examples total AND no active consistency contradiction AND >= 1 category where strong count = 0
- When: dashboard loads
- Then: the focus card shows the category with the most weak/unrated examples, amber left border, and a CTA linking to `/practice?focus=[encoded category name]`

**AC-1.3 — Unsaved practice nudge (requires practice_sessions table — defer to Thread D)**
- Out of scope for initial build. See deferred items.

**AC-1.4 — Lowest strength score fallback**
- Given: user has > 5 examples AND no contradiction AND all categories have at least 1 strong example
- When: dashboard loads
- Then: focus card shows the category with the lowest `strength_score` from Mirror analysis data with a link to `/practice?focus=[category]`

**AC-1.5 — Empty state (< 5 examples)**
- Given: user has < 5 examples
- When: dashboard loads
- Then: "Where to Focus" module is NOT rendered. The space is filled by the existing quick-actions grid.
- And: no error state, no skeleton, no placeholder text

**AC-1.6 — Loading state**
- Given: user has > 5 examples and the backend call is in flight
- When: dashboard is rendering
- Then: a single skeleton card of the same height as the focus card is shown
- And: skeleton disappears when data resolves

**AC-1.7 — Mirror data not yet run**
- Given: user has > 5 examples but has never run Mirror analysis
- When: dashboard loads
- Then: the backend has no strength_map data. The focus module shows the unsaved practice nudge if applicable, otherwise does not render.
- Note: The dashboard must not call `/api/mirror/analyze` (expensive AI call). It needs a lightweight data source — see Section 4 (API Contract).

---

### Item 2: "Save to Bank" post-practice modal

**AC-2.1 — Prompt appears after feedback only**
- Given: user is in a practice session with at least 1 substantive user message (> 80 words)
- When: user clicks "Get Feedback" and feedback is fully rendered
- Then: the amber "Save to your Example Bank?" prompt card appears below the feedback panel
- And: the prompt does NOT appear before feedback is requested
- And: the prompt does NOT appear if the session has zero user messages > 80 words

**AC-2.2 — Skip dismisses for the session**
- Given: Save to Bank prompt is visible
- When: user clicks "Skip"
- Then: the prompt card is hidden for the remainder of the session
- And: if the user clicks "Back to Practice" and then "Get Feedback" again in the same session, the prompt does NOT re-appear

**AC-2.3 — "Review and save" opens modal**
- Given: Save to Bank prompt is visible
- When: user clicks "Review and save"
- Then: a modal opens showing all user messages from the session that are > 80 words
- And: each entry shows the preceding assistant question and the user answer
- And: entries > 80 words AND not starting with a filler phrase ("I don't know", "I'm not sure", "I usually") are pre-checked
- And: entries < 80 words OR starting with a filler phrase are pre-unchecked
- And: the button label reads "Save [N] answers" where N reflects the currently checked count

**AC-2.4 — Count updates as user checks/unchecks**
- Given: modal is open with 3 entries checked
- When: user unchecks one entry
- Then: button label updates to "Save 2 answers" without page reload
- And: an `aria-live="polite"` region announces the count change

**AC-2.5 — Save creates examples rows**
- Given: user has checked 2 entries and clicks "Save 2 answers"
- When: the save completes
- Then: 2 new rows are created in `examples` with `transcriptId: null`, `qualityRating: null`
- And: each row is tagged with the "Practice session" system tag
- And: if a focus/gap param was active for this session, the focus topic is also applied as a tag (see AC-2.7)
- And: modal closes and a success toast shows "2 answers saved to your bank"

**AC-2.6 — Save with zero checked is blocked**
- Given: modal is open and user has unchecked all entries
- When: button label shows "Save 0 answers"
- Then: the save button is disabled (not just greyed — `disabled` attribute set)

**AC-2.7 — Focus topic tag propagation**
- Given: user arrived at `/practice?focus=Stakeholder+management%20%26+conflict` (URL-encoded)
- When: examples are saved via the modal
- Then: each saved example is also tagged with the matching system tag "Stakeholder management & conflict" if it exists in the tags table
- And: if no matching system tag exists, the tag is created as a user tag for this user

**AC-2.8 — API failure mid-save**
- Given: user clicks "Save 2 answers" and the API returns a 500 or network error
- When: save fails
- Then: modal remains open, an inline error message appears: "Save failed — please try again"
- And: checked state is preserved
- And: user can retry

**AC-2.9 — Edit answer before saving**
- Given: modal is open
- When: user clicks "Edit answer" on any entry
- Then: the answer text becomes an editable textarea (same behaviour as existing example edit flows)
- And: edited text is what gets saved, not the original chat message

---

### Item 3: Focus/Gap query param on Practice page

**AC-3.1 — Banner renders when param is present**
- Given: user navigates to `/practice?focus=Stakeholder+management`
- When: page loads
- Then: an amber context banner appears above PersonaSelector
- And: banner text reads "Practising with focus: Stakeholder management. Your Mirror analysis flagged this as a weak area."

**AC-3.2 — Gap param renders different copy**
- Given: user navigates to `/practice?gap=M%26A+integration`
- When: page loads
- Then: banner text reads "Practising a gap: M&A integration. Identified from your Job Match analysis."

**AC-3.3 — Clear removes the banner and the param**
- Given: focus banner is visible
- When: user clicks "Clear"
- Then: banner is hidden
- And: URL updates to `/practice` (param removed via `router.replace`, no page reload)
- And: if no persona has been selected yet, the topic is NOT injected into the first chat message

**AC-3.4 — Banner collapses to chip after persona selection**
- Given: focus banner is visible and user selects a persona
- When: ChatInterface renders
- Then: full banner is replaced by a small chip next to the interviewer name showing the topic
- And: chip has an × button that clears the focus for the remainder of the session

**AC-3.5 — Invalid or unrecognised focus param**
- Given: user navigates to `/practice?focus=nonexistent-category-xyz`
- When: page loads
- Then: banner still renders with the param value as-is ("Practising with focus: nonexistent-category-xyz")
- And: no error is thrown — the backend will inject whatever topic string was provided
- And: no attempt is made to validate the topic against known tags on the frontend

**AC-3.6 — Both focus and gap params present**
- Given: user navigates to `/practice?focus=foo&gap=bar` (malformed URL)
- When: page loads
- Then: `focus` param takes precedence; `gap` param is ignored
- And: banner renders with focus copy

**AC-3.7 — Multiple tabs with different params**
- Given: user has `/practice?focus=Stakeholder` open in Tab A and `/practice?gap=M%26A` open in Tab B
- When: user interacts with each tab independently
- Then: each tab maintains its own state — they do not share React state
- And: this is the correct behaviour; no cross-tab coordination is needed

---

### Item 4: System prompt injection for focus topic

**AC-4.1 — Focus topic injected when param is active**
- Given: user selected a persona with focus param "Stakeholder management & conflict" active
- When: `POST /api/chat` is called for the first message
- Then: the system prompt includes the additional context block:
  ```
  Additional context for this session: The candidate has requested focus on
  Stakeholder management & conflict. Please open with a question in this area
  and ensure at least 3 of your questions probe this topic specifically.
  ```

**AC-4.2 — Injection only on first message of session**
- Given: focus is active and user has already exchanged 4 messages
- When: user sends message 5
- Then: the focus injection is still present (it is part of the system prompt, which is sent on every request in the current implementation)
- Note: the system prompt is reconstructed on every `/api/chat` call from the persona file + mode, so the focus context must be passed in the request body and appended on the server each time

**AC-4.3 — No injection when focus is cleared**
- Given: user clicked "Clear" on the focus banner before selecting a persona
- When: any chat message is sent
- Then: no focus context block appears in the system prompt

**AC-4.4 — Focus topic is sanitised before injection**
- Given: focus param contains a string up to 200 characters
- When: injected into system prompt
- Then: the string is trimmed and truncated to 200 characters
- And: any newline characters in the topic string are replaced with spaces before injection (prevents prompt injection via crafted URLs)

---

### Item 5: Mirror → Practice CTA link

**AC-5.1 — Link appears for weak categories**
- Given: Mirror analysis has run and rendered the StrengthMap component
- When: a category row has `strong < weak + unrated` (weak coverage condition)
- Then: a small link "Practice [category name]" appears below that category row
- And: the link navigates to `/practice?focus=[URL-encoded category name]`

**AC-5.2 — Link does not appear for strong categories**
- Given: a category has strong >= weak + unrated
- When: StrengthMap renders
- Then: no Practice link appears for that category

**AC-5.3 — Link is not shown when Mirror has not been run**
- Given: Mirror page is in idle or insufficient state
- When: page renders
- Then: no Practice links exist (StrengthMap is not rendered)

---

### Item 6: Job Match → Practice CTA link

**AC-6.1 — Link appears on each gap item**
- Given: Match has run and returned gaps
- When: GapCard renders
- Then: a "Practice this gap" link appears below the gap description
- And: the link navigates to `/practice?gap=[URL-encoded requirement string]`

**AC-6.2 — No link when gaps array is empty**
- Given: Match returns zero gaps
- When: results render
- Then: no Practice links appear in the gaps section

---

### Item 7: "Practice session" system tag in seed

**AC-7.1 — Tag exists after seed runs**
- Given: `npm run db:seed` is executed
- When: tags table is queried for `name = 'Practice session'` AND `is_system = true` AND `user_id IS NULL`
- Then: exactly one row exists

**AC-7.2 — Seed is idempotent**
- Given: seed has already been run once
- When: seed is run again
- Then: no duplicate row is created (existing behaviour — seed already checks for duplicates)

---

### Items 8–10: Nav and Quick Action updates

**AC-8.1 — Nav section labels updated**
- Given: user opens the app
- When: sidebar renders in expanded state
- Then: section labels read "BUILD", "APPLY", "PRACTISE"
- And: "Library" and "Track" labels no longer appear

**AC-9.1 — Practice icon changed**
- Given: sidebar renders
- When: Practice nav item is visible
- Then: icon is `Mic` from lucide-react, not `MessageCircle`

**AC-10.1 — Dashboard quick actions updated**
- Given: dashboard renders
- When: quick actions grid loads
- Then: four items are: "Upload transcript", "Match a job spec", "Start a practice session", "View example bank"
- And: "Check consistency" does NOT appear in the quick actions grid

---

## 3. Edge Cases and Error States

### 3.1 Empty bank — "Where to Focus" module

**User has 0 examples:**
Do not render the module. Do not show a skeleton. Expand the quick-actions grid to fill the space. The current 2x2 grid can become a 2x3 or simply given more vertical padding. No error message — the user does not yet have data worth focusing on.

**User has 1–4 examples:**
Same as 0 examples. The threshold is 5 (matching Mirror's `MIN_EXAMPLES` constant in `/api/mirror/analyze/route.ts`). Do not render the module below this threshold.

**User has 5+ examples but Mirror has never been run:**
The dashboard cannot call `/api/mirror/analyze` (it is expensive). The lightweight dashboard API (see Section 4) must compute strength data directly from the DB, not from a cached Mirror result. This means the "Where to Focus" logic runs independently from Mirror — it queries examples+tags directly.

### 3.2 Practice session with only 1 message exchange

**Definition of "1 message exchange":** user sends one message (answer), assistant replies once. Total messages array length = 3 (opening Hello + assistant question + user answer).

**Behaviour:** "Get Feedback" button already uses `messages.length > 2` as its condition to appear. A session with exactly 1 exchange (3 messages) would show the Get Feedback button. After feedback, the Save to Bank prompt applies the 80-word filter. If the single answer is > 80 words, 1 entry will be offered. If it is < 80 words, the Save to Bank prompt does NOT appear (no entries pass the threshold).

**Do not show the Save to Bank prompt if zero entries pass the word-count filter.** The prompt card's conditional render: `extractedPairs.length > 0 ? <SaveToBankPrompt /> : null`

### 3.3 User navigates to `/practice?focus=nonexistent-category-xyz`

Already covered in AC-3.5. Render the banner with the raw string. Do not validate. Do not throw. The system prompt injection will pass the string to Claude, which will attempt to frame questions around whatever topic was given — even a nonsense string will not break the session, it will simply produce generic questions.

This is acceptable. The only way to get a nonexistent-category URL is by constructing it manually or via a stale link. The user experience degrades gracefully.

### 3.4 Chat API fails mid-practice — Save to Bank flow with partial data

The `messages` state in `ChatInterface` is built up client-side as each message arrives. If the API fails mid-stream:
- The partial assistant message is already in state (the streaming update pattern in ChatInterface stores incomplete content)
- The error handler appends a "Sorry, there was an error" assistant message

**Save to Bank with partial data:** The Q&A extraction runs over `messages` state at the moment "Get Feedback" is clicked. If a previous turn had an API failure, the "Sorry, there was an error" assistant message will appear in the extraction. The 80-word filter on user messages handles this cleanly — a short error acknowledgement from the user ("ok I'll try again") will be excluded. The errored assistant message appears as the "Q" in a pair, which is ugly but harmless.

**Mitigation (implementation note, not a gate):** Filter out assistant messages matching the exact error string `'Sorry, there was an error. Please try again.'` from the Q&A pair extraction. This is a one-line check in the extraction logic.

### 3.5 Multiple browser tabs with different focus params

Each tab runs an independent React component tree. `useSearchParams()` reads from the URL of that specific tab. There is no shared state between tabs. This requires no special handling. Confirmed in AC-3.7.

### 3.6 User clicks "Get Feedback" with only very short answers

**Threshold:** 80 words per UX spec.

If all user messages are < 80 words:
- Feedback is still requested and returned by the API (the feedback prompt does not check answer length)
- The feedback may comment on answer brevity — this is correct behaviour
- The Save to Bank prompt does NOT appear (no entries pass the threshold)
- This is not an error state — it is a legitimate outcome

**Do not block "Get Feedback" based on answer length.** The length filter only governs what the Save to Bank modal offers, not whether feedback can be requested.

### 3.7 "Practice session" tag missing from DB (seed not run on fresh deploy)

If the "Practice session" tag does not exist in the DB when Save to Bank runs:

The current `POST /api/examples` route does not handle tags inline — it creates the example row. Tag association is a separate operation.

The save flow must:
1. Look up the "Practice session" tag by name with `is_system = true` and `user_id IS NULL`
2. If not found, create it as a system tag (or log the error and save without the tag rather than blocking the save)

**Decision:** Save without the system tag rather than fail the save. Log a warning. The tag omission is recoverable (a backfill migration can tag existing practice examples later). A failed save is not.

---

## 4. Data Model: Is "No Schema Changes" True?

**Short answer: No — the UX spec underestimates the schema work.**

### 4.1 What the UX spec claims

"No schema changes except the 'Practice session' system tag."

### 4.2 What is actually needed

**Required for P0 (Save to Bank):**

The existing `examples` table already supports `transcriptId: null`. The existing `POST /api/examples` endpoint... does not exist yet. Reviewing `/api/examples/route.ts`: there is a `GET` handler but **no `POST` handler**. The UX spec assumes `POST /api/examples` exists. It does not.

This is a required addition, not just a tag seed. The engineer must implement `POST /api/examples`.

**Required for "Where to Focus" on Dashboard:**

The UX spec says the dashboard reads from "the existing Mirror + Consistency APIs." The Mirror API is `POST /api/mirror/analyze` — an AI call that takes 10–20 seconds. Calling it on every dashboard page load is not acceptable.

Two options:
- **Option A (preferred):** Add a lightweight `GET /api/dashboard/focus` route that reads directly from the DB (examples + tags + consistency_entries) without calling Claude. This route computes strength data deterministically from stored examples, then applies the priority logic (consistency flag → weak category → lowest strength). No AI calls, fast response.
- **Option B (heavier):** Cache Mirror results in the DB and read from cache. This requires a new `mirror_cache` table with `userId`, `analysis JSON`, `generatedAt`. The UX spec did not call this out and it is more scope than needed.

**Decision: Option A.** Build `GET /api/dashboard/focus`. No new tables needed for this endpoint.

**Optional for deferred P1 (sessions count):**

The UX spec proposes a `practice_sessions` table. This is correctly deferred. Do not build it now.

### 4.3 Summary of schema changes

| Change | Required for | Status |
|--------|-------------|--------|
| Add "Practice session" to seed.ts | Save to Bank | New line in SYSTEM_TAGS array |
| `POST /api/examples` handler | Save to Bank | New route handler in existing file |
| `GET /api/dashboard/focus` route | Where to Focus module | New file |
| `practice_sessions` table | Sessions count stat | Deferred |

No Drizzle schema migrations required. The `examples` table already has all columns needed for practice-sourced examples (`transcriptId` nullable, `qualityRating` nullable). The `exampleTags` junction handles tag associations.

---

## 5. API Contract

### 5.1 POST /api/examples (new handler — same file as existing GET)

This endpoint does not exist. It must be created.

**Request body:**
```typescript
{
  question: string;           // required, max 2000 chars
  answer: string;             // required, max 5000 chars
  transcriptId?: string | null;  // null for practice-sourced examples
  qualityRating?: 'strong' | 'weak' | 'neutral' | null;  // null = unrated
  tagIds?: string[];          // array of existing tag IDs to associate
  sourcePosition?: string | null;  // null for practice-sourced examples
}
```

**Response (201):**
```typescript
{
  example: {
    id: string;
    userId: string;
    question: string;
    answer: string;
    transcriptId: string | null;
    qualityRating: string | null;
    createdAt: string;
    tags: Array<{ id: string; name: string; isSystem: boolean }>;
  }
}
```

**Errors:**
- `400` — missing or empty `question` or `answer`
- `400` — `question` exceeds 2000 chars or `answer` exceeds 5000 chars
- `400` — `transcriptId` provided but does not belong to this user
- `401` — unauthenticated
- `500` — DB error

**Auth:** Session-required. `userId` taken from session, never from body.

**Tag association:** If `tagIds` is provided and non-empty, insert rows into `exampleTags` in the same request. If any `tagId` does not exist in the `tags` table, skip it (do not error).

---

### 5.2 GET /api/dashboard/focus (new route)

**Purpose:** Lightweight dashboard data — no AI calls. Returns the single highest-priority focus item and stats.

**Request:** No body. Auth session provides userId.

**Response (200):**
```typescript
{
  focus: {
    type: 'consistency' | 'weak-category' | 'lowest-strength' | null;
    category?: string;           // for weak-category, lowest-strength
    exampleCount?: number;       // total examples in that category
    strongCount?: number;        // strong examples in that category
    company?: string;            // for consistency (first conflicting company)
    conflictDescription?: string; // for consistency
    href: string;                // destination link
  } | null;
  // focus is null if user has < 5 examples (module should not render)

  stats: {
    examples: number;
    transcripts: number;
    inProgress: number;
    // sessions: deferred
  };
}
```

**Priority logic (server-side):**

1. Check `consistency_entries` for this user. If any topic has entries from 2+ companies, call `/api/consistency/check` inline... No — this also invokes Claude. Instead: check if 2+ `consistency_entries` rows exist for the same `topic` with different `company` values. If yes, return `type: 'consistency'` with a link to `/consistency`. The actual contradiction detection still happens on the Consistency page.

2. If no consistency signal: query examples + exampleTags + tags. Build per-category counts. If any category has `strong = 0` AND `total >= 1`: return `type: 'weak-category'` for the category with the most `weak + unrated` examples.

3. If all categories have at least 1 strong: return `type: 'lowest-strength'` for the category with the lowest ratio `strong / total`.

4. If user has < 5 examples total: return `{ focus: null, stats: {...} }`.

**Why consistency check is heuristic here:** Calling `/api/consistency/check` from the dashboard would trigger Claude for every dashboard load. The heuristic (2+ entries for same topic across different companies) is a signal that a conflict *may* exist, which is sufficient to prompt the user to review. The actual Claude analysis only runs when they click through to the Consistency page.

---

### 5.3 Changes to POST /api/chat (focus/gap injection)

**Additional field in request body:**
```typescript
{
  messages: Message[];
  personaId: string;
  mode: 'practice' | 'feedback';
  focusTopic?: string | null;   // NEW — URL-decoded topic string, max 200 chars
}
```

**Server-side change in `/api/chat/route.ts`:**

In the `POST` handler, after extracting `messages`, `personaId`, `mode` from the body, also extract `focusTopic`. Validate: trim, truncate to 200 chars, replace newlines with spaces.

In the system prompt construction, when `mode === 'practice'` and `focusTopic` is truthy, append to the practice system prompt:

```
\n\nAdditional context for this session: The candidate has requested focus on
${sanitisedTopic}. Please open with a question in this area and ensure at least
3 of your questions probe this topic specifically.
```

This append happens inside the existing ternary that constructs `systemPrompt`. No new functions required — it is a conditional string interpolation.

**Frontend change in `ChatInterface.tsx`:**

`ChatInterface` currently accepts `personaId`, `mode`, `onModeChange`. Add a new optional prop:

```typescript
interface ChatInterfaceProps {
  personaId: string;
  mode: 'practice' | 'feedback';
  onModeChange: (mode: 'practice' | 'feedback') => void;
  focusTopic?: string | null;   // NEW
}
```

Pass `focusTopic` in the `fetch('/api/chat', ...)` body alongside `messages`, `personaId`, and `mode`. The topic is included on every call (it is part of the system prompt reconstruction), not just the first.

**`practice/page.tsx` change:**

Read `?focus` and `?gap` params using `useSearchParams()`. Since this is a `'use client'` page, this is available without wrapping in Suspense (it already has `'use client'`). Derive `focusTopic`:

```typescript
const focusTopic = searchParams.get('focus') ?? searchParams.get('gap') ?? null;
```

Pass `focusTopic` to `ChatInterface`. Also use it to render the context banner and pass to the persona selector handoff.

---

### 5.4 Save to Bank: exact POST body per example

When the user confirms the modal, the client makes N sequential `POST /api/examples` calls (one per checked entry). Do not batch — keep it simple and match the single-row API contract above.

```typescript
// Per selected QAPair:
POST /api/examples
{
  question: pair.question,          // assistant message text
  answer: pair.editedAnswer,        // user message text (post-edit if edited)
  transcriptId: null,
  qualityRating: null,
  tagIds: [
    practiceSessionTagId,           // resolved from tags table by name lookup
    ...focusTopicTagIds,            // if focus/gap param was active — 0 or 1 entries
  ]
}
```

**Tag resolution before saving:** Before the modal opens (or on modal open), the client should fetch the "Practice session" tag ID. This requires a call to `GET /api/tags` (which already exists) filtered by name. If not found, proceed without it — do not block the save.

---

## 6. Build Threads

Threads are designed for parallel execution. Dependencies noted.

### Thread A: Focus Flow (P0)
**What:** Focus/gap query params, Practice context banner, chip collapse, system prompt injection, Mirror CTA, Match CTA, nav updates, icon swap.

**Files touched:**
- `/src/app/(app)/practice/page.tsx` — read params, render banner, pass focusTopic
- `/src/components/ChatInterface.tsx` — add focusTopic prop, pass to API
- `/src/app/api/chat/route.ts` — add focusTopic to request parsing and system prompt
- `/src/app/(app)/mirror/page.tsx` + `StrengthMap` component — add Practice CTA link
- `/src/app/(app)/match/page.tsx` + `GapCard` component — add Practice CTA link
- `/src/components/storybank/AppSidebar.tsx` — rename section labels, swap icon
- New component: `PracticeContextBanner` (as specified in UX spec Section 7.2)

**Dependencies:** None. This is the base thread.

**Estimated effort:** Medium-low. The system prompt inject is 10 lines. The banner is a new component but spec is fully defined. The CTAs are link additions.

---

### Thread B: Save to Bank (P1)
**What:** Save to Bank prompt card, Q&A extraction logic, modal with checkboxes, POST /api/examples, "Practice session" seed tag.

**Files touched:**
- `/src/app/api/examples/route.ts` — add POST handler
- `/src/lib/db/seed.ts` — add "Practice session" to SYSTEM_TAGS
- `/src/app/(app)/practice/page.tsx` — render SaveToBankPrompt after feedback
- `/src/components/ChatInterface.tsx` — expose messages to parent (currently internal state), trigger save prompt on feedback mode entry
- New component: `SaveToBankPrompt` (inline card)
- New component: `SaveToBankModal` (modal with checkboxes)
- New utility: `extractQAPairs(messages)` in `/src/lib/practice-utils.ts`

**Dependencies:** Depends on Thread A completing if you want focus topic tags to be applied. Can ship Thread B without Thread A and simply skip the focus tag. However, the "Practice session" tag must exist (requires seed to run on deploy).

**Implementation note — messages access:** `ChatInterface` currently owns `messages` state internally. `practice/page.tsx` does not have access to it. Thread B requires either:
- Lifting `messages` state to `practice/page.tsx` and passing it down as props
- Adding an `onFeedbackComplete(messages)` callback prop to `ChatInterface`

The callback approach is lower risk (smaller diff). Add `onFeedbackComplete?: (messages: Message[]) => void` to `ChatInterfaceProps` and call it from `handleGetFeedback` after the streaming response completes.

**Estimated effort:** Medium. The modal is the most complex piece — checkbox state, count updates, edit mode, async save with error handling.

---

### Thread C: Where to Focus Dashboard Module (P1)
**What:** New `GET /api/dashboard/focus` route, `WherToFocusCard` component, dashboard integration.

**Files touched:**
- New file: `/src/app/api/dashboard/focus/route.ts`
- New component: `WhereFocusCard` in `/src/components/storybank/WhereFocusCard.tsx`
- `/src/app/(app)/dashboard/page.tsx` — fetch focus data, conditionally render module, update quick actions array

**Dependencies:** None. This thread is independent. Can ship before or after Thread A.

**Implementation note:** The dashboard page is currently a Server Component (async function, direct DB queries, no 'use client'). Adding the "Where to Focus" module requires a client-side fetch with a loading state, which means either:
- Convert the dashboard to a hybrid page with a client `WhereFocusCard` that fetches its own data
- Keep the dashboard as Server Component and pass focus data as props from a server-side fetch

**Preferred approach:** Keep dashboard as Server Component. Fetch focus data server-side using a direct DB query (same pattern as existing stats queries). Pass result as a prop to a new `WhereFocusCard` client component. No new loading state needed — server renders the card with data already resolved.

**Estimated effort:** Medium. The route logic has several conditional branches but all are deterministic DB queries. The component is well-spec'd.

---

### Thread D: Nav and Quick Action Polish (P2)
**What:** Sidebar section labels, icon swap, dashboard quick-action grid update.

**Files touched:**
- `/src/components/storybank/AppSidebar.tsx` — update NAV_SECTIONS
- `/src/app/(app)/dashboard/page.tsx` — update quick actions array

**Dependencies:** None. Can be shipped as a standalone PR at any time.

**Estimated effort:** Trivial — under 30 minutes.

---

### Thread ordering recommendation

If the sprint is time-constrained:
1. Thread D (30 min) — ship immediately, zero risk
2. Thread A (1–2 days) — this is the integration. Ship as soon as complete.
3. Thread B (2–3 days) — closes the loop
4. Thread C (1–2 days) — makes the loop discoverable

Threads A, B, C can run in parallel across engineers if available.

---

## 7. Success Metrics

These are measurable outcomes, not proxy metrics. Evaluate at 30 days post-launch.

### Metric 1: Focus param usage rate
**What:** Percentage of practice sessions initiated via a focus/gap param (i.e., `?focus=` or `?gap=` present when PersonaSelector is shown).

**Baseline:** 0% (feature does not exist).

**Target:** 25% of practice sessions within 30 days of Thread A shipping.

**Why it matters:** If users are navigating directly to `/practice` rather than clicking through from Mirror or Match, the integration is not working — either the CTAs are not visible or the user mental model has not shifted.

**How to measure:** Log `focusTopic` presence in `POST /api/chat` server-side. A non-null `focusTopic` on the first message of a session = focus-param-initiated session.

---

### Metric 2: Save to Bank conversion rate
**What:** Of sessions where the Save to Bank prompt appears (at least 1 qualifying answer exists), what percentage result in at least 1 example being saved?

**Baseline:** 0% (feature does not exist).

**Target:** 40% of eligible sessions result in at least 1 example saved.

**Why it matters:** If users dismiss the prompt every time, either the answers are genuinely not worth saving (the AI pre-selection is wrong) or the friction of the modal is too high. Below 20% indicates a UX problem with the modal.

**How to measure:** Track in server logs: prompts shown vs `POST /api/examples` calls with `transcriptId: null` in the same session window.

---

### Metric 3: Examples with Practice session tag as a share of total examples
**What:** Count of examples tagged "Practice session" as a percentage of all examples at 30 days.

**Baseline:** 0%.

**Target:** No fixed target — directionally, this should grow week-over-week as users complete practice sessions and save answers. A flat line at 0% after 30 days means Save to Bank is not being used.

**Why it matters:** This is the data flywheel metric. If practice examples are accumulating, the bank is growing without requiring real interview transcripts. This is the core value proposition of the integration.

---

### Metric 4: Mirror analysis runs after a practice session (within 48 hours)
**What:** Of users who complete a practice session and save at least 1 example, what percentage run Mirror analysis within 48 hours?

**Baseline:** Establish at launch (currently no concept of "after a practice session").

**Target:** 30% of practice-to-save users run Mirror within 48 hours.

**Why it matters:** This measures whether the feedback loop is closing — user practices, saves, checks their updated strength map. If this is low, the "Where to Focus" module on the dashboard is needed urgently to prompt the re-check.

---

### Metric 5: Reduction in zero-coverage categories for active users
**What:** For users with > 10 examples, track the count of categories with zero strong examples at week 1 vs week 4.

**Baseline:** Measure at Thread A launch.

**Target:** Active users (> 1 practice session in the period) show a 20% reduction in zero-coverage categories over 4 weeks.

**Why it matters:** This is the product outcome metric. If the integration is working, users are practising weak areas and saving examples that fill gaps. A flat or increasing zero-coverage count means the loop is not closing even when the tooling is in place.

---

## 8. Known Gaps and Open Questions

The following items are not resolved by this spec and require a decision before Thread B ships:

**OQ-1: Messages state ownership**
ChatInterface owns `messages` internally. Thread B requires the parent to access messages after feedback. Decision needed: lift state to parent or use callback? Recommendation: callback (`onFeedbackComplete`). This is a smaller diff and does not require refactoring how ChatInterface manages streaming state.

**OQ-2: Tag lookup strategy for Save to Bank**
When saving practice examples, the client needs the ID of the "Practice session" system tag to include in `tagIds`. Options:
- Fetch all tags at modal open (`GET /api/tags`) and find by name
- Add a `GET /api/tags?name=Practice+session` filter (requires extending the tags API)
- Hardcode lookup on the server-side in `POST /api/examples` when `transcriptId` is null (server auto-applies the Practice session tag without the client needing the ID)

**Recommendation:** Option 3 — server-side auto-tag. If `transcriptId` is null and "Practice session" tag exists in the DB, the `POST /api/examples` handler automatically associates it. The client does not need to look up or pass the tag ID. This simplifies the client and moves the business logic server-side where it belongs.

**OQ-3: Dashboard Server Component vs hybrid**
Confirmed recommendation in Thread C notes above: keep dashboard as Server Component, fetch focus data server-side. But this means the dashboard page needs access to the Drizzle queries for the focus logic. Either inline the queries in `dashboard/page.tsx` (fine for initial ship) or call the new focus route via `fetch` from the server component (adds latency, not recommended).

**Recommendation:** Inline the focus DB queries directly in `dashboard/page.tsx` as a server-side computation. The route `GET /api/dashboard/focus` is still useful for future client-side use but is not required for the initial dashboard render.

---

*PRODUCT-SPEC-UNIFIED-UX.md — StoryBank Unified Experience Addendum v1.0*
*Next step: Engineer reviews Sections 4–5 (data model + API contract) and confirms implementation approach for OQ-1 through OQ-3 before starting Thread A.*
