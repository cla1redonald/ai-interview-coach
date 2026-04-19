# StoryBank — Unified Experience Design

**Version:** 1.0
**Date:** 2026-04-18
**Status:** Recommended — ready for engineer implementation
**Author:** UX/UI Designer

---

## The Problem in One Sentence

Right now StoryBank asks users to context-switch between two unrelated tasks: building a story archive and practising delivery. The product has the data to connect them, but it does not.

---

## Mental Model: The Preparation Loop

The target user — a Director, VP, or C-suite candidate actively running 3–6 parallel interview processes — does not think in features. They think in a preparation cycle that looks like this:

```
Upload real transcript  →  Extract what worked  →  Spot weak areas
        ↑                                                  ↓
  Save practice                                    Practice those
  to bank                                          weak areas
        ↑                                                  ↓
  Get AI feedback  ←─────────  Choose interviewer ←───  Go to Practice
```

The two experiences are not parallel features. Practice is what you do *because* you identified a gap in StoryBank. And what you do in Practice should flow *back into* StoryBank as new material.

The redesign creates that loop explicitly.

---

## 1. Information Architecture

### Current State (flat list, 7 items)

```
Dashboard
Upload
──── Library ────
Example Bank
Mirror
Job Match
──── Track ────
Consistency
──── Prepare ────
Practice
```

Practice is orphaned in its own section with no connection to anything above it. "Library" and "Track" are not meaningful user-facing concepts — they are developer categories.

### Proposed State (3 sections, purpose-led)

```
Dashboard

──── BUILD ────
Upload
Example Bank
Mirror

──── APPLY ────
Job Match
Consistency

──── PRACTISE ────
Practice
```

**Section rationale:**

- **BUILD** — everything that adds to your bank. Upload feeds Example Bank; Mirror reads from it. These three pages form a tight loop. The section name describes what the user is doing: building their story archive.

- **APPLY** — everything that uses your bank for a specific purpose. Job Match takes a job spec and returns ranked examples. Consistency takes your full history and surfaces contradictions. Both require a populated bank to be useful.

- **PRACTISE** — a single destination that connects to both BUILD and APPLY. It has its own section because it operates differently (real-time, interactive) but the label signals it is the delivery layer, not a separate product.

**Icon updates** (Lucide, stroke 1.5):

| Label | Icon | Change from current |
|-------|------|---------------------|
| Dashboard | `LayoutDashboard` | No change |
| Upload | `Upload` | No change |
| Example Bank | `BookMarked` | No change |
| Mirror | `Sparkles` | No change |
| Job Match | `Target` | No change |
| Consistency | `GitBranch` | No change |
| Practice | `Mic` | Change from `MessageCircle`. `Mic` signals performance/delivery, not just chat. |

The icon change for Practice is the only update needed. It reinforces that Practice is a different mode — live performance — not just another information view.

---

## 2. Dashboard Redesign

The current dashboard shows three counts and four quick-action links. It is accurate but not purposeful. A time-poor senior professional needs to land here and immediately know: *what should I do next?*

### Proposed Dashboard Layout

```
┌────────────────────────────────────────────────────────────┐
│  Good morning, Claire                                       │
│  Here is where your preparation stands.                     │
│                                                             │
│  ┌──────────┬──────────┬──────────┬──────────────────────┐ │
│  │    24    │    6     │    3     │   Last active:        │ │
│  │ examples │transcripts│sessions │   2 days ago          │ │
│  └──────────┴──────────┴──────────┴──────────────────────┘ │
│                                                             │
│  ── WHERE TO FOCUS ─────────────────────────────────────── │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ⚠  Weak coverage: Stakeholder management             │   │
│  │    You have 1 example rated strong, 3 weak or        │   │
│  │    unrated. This comes up in most senior interviews. │   │
│  │    [Practice this →]  [View examples →]              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◆  Consistency flag active                           │   │
│  │    Compensation expectation varies across 3          │   │
│  │    companies. Review before your next interview.     │   │
│  │    [View flag →]                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ── QUICK ACTIONS ──────────────────────────────────────── │
│  [Upload transcript]  [Match a job spec]                    │
│  [Start a practice session]  [View example bank]            │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**The "Where to Focus" module is the key addition.** It replaces the generic stats with opinionated guidance. It reads from the existing data (strength map from Mirror, consistency flags) and surfaces the single most important thing the user should do today.

**Logic for "Where to Focus" (priority order):**

1. If an active consistency contradiction exists → surface it with a link to Consistency
2. If any category has zero strong examples and the user has > 5 examples total → surface as a weak coverage alert with a link to Practice pre-filtered to that category
3. If the user has a practice session in the last 48 hours with no follow-up example saved → surface a "save your practice answers" nudge with a link to the session
4. Otherwise → show the category with the lowest strength score from Mirror

Only show one focus item at a time, prioritised in this order. The card uses `--contradiction` left border for contradictions, `--amber` left border for everything else.

**Stats row update:** Add "sessions" as the fourth metric (count of completed practice sessions). This makes Practice visible as a first-class activity in the number line at the top.

**Quick actions:** Replace the current 2x2 grid with a 2x2 that includes Practice as one of the four permanent actions. Remove "Check consistency" from quick actions (it is surfaced in the focus module when relevant).

| Position | Action |
|----------|--------|
| Top left | Upload transcript |
| Top right | Match a job spec |
| Bottom left | Start a practice session |
| Bottom right | View example bank |

---

## 3. User Journey Map

### Journey A: Upload → Extract → Identify Weakness → Practice → Save

This is the primary flywheel journey. A user returns after a real interview.

```
Step 1  /upload
        User pastes transcript from Airbox hiring manager round.
        Fills metadata: Company "Airbox", Round "Hiring manager".
        Clicks "Extract examples". 15-30s processing.

Step 2  /transcripts/[id]/review
        Sees 11 extracted Q&A pairs.
        Rates 3 as Strong. Leaves 2 as Weak. Leaves 6 unrated.
        Saves all. Navigates to Mirror.

Step 3  /mirror
        Strength map shows "Stakeholder management" is the
        weakest category — 1 strong, 2 weak.
        Mirror callout: "Your weakest area. Practice before
        your next Airbox round."
        CTA: [Practice stakeholder management]
        → This links to /practice?focus=Stakeholder+management
          (new query param — see Section 5)

Step 4  /practice?focus=Stakeholder+management
        Focus param causes the Practice page to pre-populate
        context: "Practising: Stakeholder management"
        User picks a persona. Persona opens with a stakeholder
        management question (system prompt receives the focus hint).
        User practises. Clicks "Get feedback".
        Feedback identifies two strong answers.

Step 5  End of session — Save to Bank modal
        (new feature — see Section 5)
        Modal: "2 answers look worth saving. Add them to your
        example bank?"
        User reviews, edits, confirms.
        Two new examples added to Example Bank tagged
        "Stakeholder management & conflict", source "Practice session".

Step 6  Return to dashboard
        Strength map has improved slightly.
        Focus module no longer flags stakeholder management.
        User uploads the next transcript.
```

### Journey B: Job Spec → Match → Spot Gap → Practice Gap → Apply

A user has a job spec for a role they are targeting.

```
Step 1  /match
        User pastes VP Product job spec from Hyble.
        Match returns top 5 examples.
        Gap analysis: "No examples for M&A integration.
        They've just completed an acquisition."

Step 2  Still on /match
        Gap card CTA: [Practice this gap]
        → /practice?gap=M%26A+integration
        (new query param — see Section 5)

Step 3  /practice?gap=M%26A+integration
        Practice page shows context banner:
        "Gap identified: M&A integration. Your AI interviewer
        will probe this area."
        User practises. Gets feedback. Has a usable answer.

Step 4  End of session — Save to Bank
        New example saved: "M&A integration — Hyble context"
        Immediately usable in the next Job Match run for Hyble.
```

---

## 4. The Integration Points

There are three specific places where the two experiences need to connect. All three are small surface area changes — no architectural rewrites.

### Integration Point 1: Practice → StoryBank (Save to Bank modal)

**What it is:** After a practice session ends (user clicks "Get Feedback" and has reviewed the feedback), a persistent prompt appears offering to save practice answers into the Example Bank.

**Where it lives:** Below the feedback panel on `/practice`, appearing only after feedback is requested.

**Visual spec:**

```
┌──────────────────────────────────────────────────────────┐
│  ◆  Save to your Example Bank?                           │
│                                                          │
│  Your answers during this session can become examples    │
│  in your bank. They will be tagged "Practice session"    │
│  and marked as unrated until you review them.            │
│                                                          │
│  [Review and save →]   [Skip]                            │
└──────────────────────────────────────────────────────────┘
```

Card uses `--amber-faint` background, `--amber` left border (3px), `--radius-lg`. The "Review and save" button opens a modal.

**The modal:**

```
┌─────────────────────────────────────────────────────────────┐
│  Save practice answers to Example Bank          [X]          │
│                                                              │
│  Review each answer. Uncheck any you don't want to save.     │
│                                                              │
│  ☑  Q: Tell me about a time you managed a difficult          │
│     stakeholder...                                           │
│     A: "When I was at MOO, the CFO and I had different..."   │
│     [Edit answer]                                            │
│                                                              │
│  ☑  Q: How do you handle conflicting priorities...           │
│     A: "I use a framework I adapted from..."                 │
│     [Edit answer]                                            │
│                                                              │
│  ☐  Q: Where do you see yourself in five years...            │
│     A: "Honestly I usually deflect this one..."              │
│     (This answer would not make a useful example)            │
│                                                              │
│  All saved answers will be tagged: [Practice session] [Add tags +]
│                                                              │
│  [Save 2 answers to bank]                                    │
└─────────────────────────────────────────────────────────────┘
```

The AI is responsible for pre-selecting which answers are worth saving. It should check the checkbox on any answer that is substantive (> 2 sentences, references a specific situation). It should uncheck throwaway responses. The user overrides.

**Data flow:** Each saved answer creates an `examples` row with:
- `transcriptId: null`
- `question` from the practice exchange
- `answer` from the practice exchange
- `qualityRating: null` (unrated — user to rate later)
- source tag: "Practice session" (auto-applied system tag — requires a new system tag seed)
- Optional: persona name in the `interviewerRole` equivalent field

**New system tag required:** "Practice session" — same pattern as the 13 existing system tags in `src/lib/db/seed.ts`.

---

### Integration Point 2: Mirror / Job Match → Practice (Focus param)

**What it is:** Two existing pages gain a CTA that links to Practice with context. Practice receives this context via a URL query param and displays a brief banner explaining the focus. The persona system prompt receives the focus topic as an additional instruction.

**The links:**

From Mirror, below any weak category in the strength bar chart:
```
[Practice stakeholder management →]
→ /practice?focus=Stakeholder+management
```

From Job Match, below any gap card:
```
[Practice this gap →]
→ /practice?gap=M%26A+integration
```

**Practice page with focus param:**

```
┌──────────────────────────────────────────────────────────┐
│  Practising with focus: Stakeholder management            │
│  Your Mirror analysis flagged this as a weak area.        │
│  Your interviewer will probe this topic.         [Clear] │
└──────────────────────────────────────────────────────────┘

  Select an interviewer to practice with:
  [PersonaSelector — unchanged]
```

Visual: Amber left-border callout above the persona selector. It persists until the user clicks "Clear" or selects a persona, at which point it appears as a smaller context chip above the chat interface.

**System prompt injection:** When a `focus` or `gap` param is present and a persona is selected, append to the persona's system prompt:

```
Additional context for this session: The candidate has requested focus on
[focus/gap topic]. Please open with a question in this area and ensure at
least 3 of your questions probe this topic specifically.
```

This is a single conditional append in the `/api/chat` route — minimal code change, high impact.

---

### Integration Point 3: Practice sessions in the Dashboard stats

**What it is:** The dashboard already shows examples, transcripts, and in-progress counts. Adding a sessions count completes the picture.

**Implementation:** This requires tracking when a practice session concludes (user clicks "Get Feedback"). A lightweight approach: log sessions to a new `practice_sessions` table with just `id`, `userId`, `personaId`, `createdAt`. No conversation content stored — just the fact that a session happened.

Alternatively (lower complexity): infer from the Save to Bank modal interactions. If this is too much scope, skip the sessions count and leave the stats row at three metrics. The other two integration points are higher value.

**Decision:** Defer the sessions count. It is a nice-to-have. The two functional integration points (Save to Bank, Focus param) are the ones that make the product feel unified. Ship those first.

---

## 5. What Requires Building (Minimal List)

These are the net-new elements needed to bridge the two experiences. Everything else is a label change or link addition.

| Item | Effort | Priority |
|------|--------|----------|
| Dashboard "Where to Focus" module | Medium — reads Mirror + Consistency APIs, renders adaptive card | P0 |
| "Save to Bank" post-practice modal | Medium — new modal component, Q&A extraction from chat history, `examples` INSERT | P0 |
| Focus/Gap query param on Practice page | Low — read URL param, render callout banner | P0 |
| System prompt injection for focus topic | Low — conditional append in `/api/chat` route | P0 |
| Mirror → Practice CTA link | Trivial — add link to StrengthMap component | P0 |
| Job Match → Practice CTA link | Trivial — add link to GapAnalysis component | P0 |
| "Practice session" system tag in seed | Trivial — one line in `seed.ts` | P0 |
| Nav section labels update (BUILD / APPLY / PRACTISE) | Trivial — update `NAV_SECTIONS` in `AppSidebar.tsx` | P0 |
| Practice nav icon change: `MessageCircle` → `Mic` | Trivial — swap one import | P0 |
| Dashboard quick-action update (add Practice, remove Consistency) | Trivial — update array in `dashboard/page.tsx` | P0 |
| Dashboard stats row: add sessions count | Medium — new table or inferred count | Defer |

**Total P0 scope:** Two meaningful features (Focus param + Save to Bank modal), three trivial link additions, four trivial UI updates, and a revised dashboard module. This is achievable in a single engineering sprint.

---

## 6. Page-by-Page Change Summary

### `/dashboard`
- Replace generic greeting "Welcome to StoryBank" with personalised greeting + "Here is where your preparation stands"
- Add "Where to Focus" adaptive card (reads Mirror strength map + Consistency API)
- Update stats: add sessions or leave at 3 (see Section 4)
- Update quick-action grid: replace "Check consistency" with "Start a practice session"

### `/mirror` (StrengthMap component)
- Below each category row in the strength bar chart, if `weak > strong + unrated`, add a small copper link: "Practice [category] →" linking to `/practice?focus=[category]`

### `/match` (GapAnalysis component)
- Below each gap item, add a secondary action: "Practice this gap →" linking to `/practice?gap=[requirement]`

### `/practice`
- Read `?focus` and `?gap` query params from URL
- If either is present, render amber context banner above PersonaSelector
- When persona is selected with a focus/gap active, inject topic into system prompt via `/api/chat`
- After "Get Feedback" is clicked and feedback rendered, show "Save to Bank" prompt card below feedback panel

### `AppSidebar`
- Update `NAV_SECTIONS` section labels: "Library" → "BUILD", "Track" → "APPLY", "Prepare" → "PRACTISE"
- Update Practice icon: `MessageCircle` → `Mic`

### `src/lib/db/seed.ts`
- Add "Practice session" to `SYSTEM_TAGS` array

---

## 7. Component Specs for New Elements

### 7.1 "Where to Focus" Card

**Props:**
```typescript
interface FocusCardProps {
  type: 'consistency' | 'weak-category' | 'unsaved-practice' | 'lowest-strength';
  category?: string;       // for weak-category, lowest-strength
  exampleCount?: number;   // for weak-category
  company?: string;        // for consistency
  href: string;            // destination link
}
```

**Visual:**
- Background: `var(--card)`, radius `--radius-lg`
- Left border: 3px — `var(--contradiction)` for `consistency` type, `var(--amber)` for all others
- Icon: `AlertTriangle` for consistency, `TrendingUp` for weak-category/lowest-strength, `Archive` for unsaved-practice
- Title: bold, `--mist`, 15px
- Body: `--sage`, 13px, max 2 lines
- Two buttons below body: primary action (copper button, small), secondary action (text link)

**States:** Loading state shows a single skeleton card of the same height. If no actionable data is found (user has < 5 examples), the module is not rendered — the space is taken by a larger quick-actions grid instead.

---

### 7.2 Practice Context Banner

**Props:**
```typescript
interface PracticeContextBannerProps {
  type: 'focus' | 'gap';
  topic: string;
  onClear: () => void;
}
```

**Visual:**
- Full-width, above PersonaSelector
- Background: `var(--amber-faint)`, border `1px solid var(--amber)`, radius `--radius-md`
- Left: `Crosshair` icon (18px, `--amber`) + label text
- Right: "Clear" text button (`--sage`, becomes `--mist` on hover)
- Once a persona is selected: collapses to a small chip next to the interviewer name: `[Crosshair 14px] Stakeholder management [×]`

**Text templates:**
- `focus`: "Practising with focus: [topic]. Your Mirror analysis flagged this as a weak area."
- `gap`: "Practising a gap: [topic]. Identified from your Job Match analysis."

---

### 7.3 Save to Bank Prompt Card

**Props:**
```typescript
interface SaveToBankPromptProps {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  personaName: string;
  onSave: (selectedPairs: QAPair[]) => Promise<void>;
  onSkip: () => void;
}
```

**Behaviour:**
- Appears below the feedback panel. Not a modal at this stage — it is inline.
- Clicking "Review and save" opens a modal (separate component).
- "Skip" dismisses the card entirely for this session.
- The card itself has amber left border to draw the eye without being alarming.

**The Save Modal:**

```
┌─────────────────────────────────────────────────────────┐
│ Save practice answers               [×]                  │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ Select the answers worth keeping:                       │
│                                                         │
│ [list of QA pairs with checkboxes — see above]          │
│                                                         │
│ Tags applied to all: [Practice session ×] [+ Add]       │
│                                                         │
│ [Save N answers]   [Cancel]                             │
└─────────────────────────────────────────────────────────┘
```

Modal dimensions: max-width 640px, max-height 80vh, scrollable. Uses existing shadcn Dialog component.

**Q&A pair extraction from chat history:** The Save to Bank flow needs to turn a conversation into Q&A pairs. The logic:
1. Walk `messages` array
2. Group `assistant` turn followed by `user` turn(s) until next `assistant` turn
3. If the user turn is longer than 80 words → treat as a substantive answer, offer to save
4. Auto-check if > 80 words and does not start with "I" followed by a filler phrase ("I don't know", "I'm not sure", "I usually")
5. This is client-side logic — no additional API call needed for selection

The actual saving calls `POST /api/examples` with `transcriptId: null`. The question text is the assistant's message. The answer is the user's response.

---

## 8. Accessibility Notes for New Components

**Save to Bank Modal:**
- Focus traps inside dialog when open
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing to modal title
- Checkboxes: proper `<label>` association, not just visual styling
- Confirm button: `aria-live="polite"` region updates count as user checks/unchecks ("2 answers selected")
- Return focus to "Review and save" button on close/cancel

**Practice Context Banner:**
- `role="status"` so screen readers announce when the focus topic is set
- Clear button: `aria-label="Clear practice focus: [topic]"`

**Focus module on Dashboard:**
- `role="status"` on the module container — content changes based on data
- Links have descriptive text ("Practice stakeholder management", not "Practice this")

---

## 9. What This Does Not Change

To be explicit about scope:

- **No new routes.** All new interactions happen within existing pages or as modal overlays.
- **No schema changes** except the "Practice session" system tag and optionally a `practice_sessions` table (deferred).
- **No changes to the mock interview engine.** `/api/chat` and `/api/personas` are unchanged except for the focus-topic system prompt append, which is a conditional 2-line addition.
- **The existing UX of Practice is preserved.** PersonaSelector and ChatInterface components are unchanged. The additions are a banner before selection and a save prompt after feedback.
- **The Deep Tay design system is unchanged.** All new components use existing CSS variables.

---

## 10. Why This Specific Approach

There are two broader alternatives that were considered and rejected:

**Alternative A: Merge Practice into transcript upload.** Have practice sessions automatically create transcript entries, treated identically to real transcripts. Rejected because practice sessions are structurally different — they are synthetic conversations with an AI, not real interviews. Mixing them with real interview data would corrupt the Mirror analysis (patterns from real interviews are meaningful; patterns from practice are circular). The explicit "Practice session" tag preserves the distinction without losing the data.

**Alternative B: Build a dedicated "Job Application" workflow.** Create a new concept (an Application) that groups a job spec, matched examples, practice sessions, and consistency notes. Rejected because this is scope expansion, not integration. The user's mental model is simpler: they have one bank of stories and one place to practise. A new object type adds cognitive load.

The chosen approach — a focus param, a save prompt, and a revised dashboard — is minimal surface area with maximum connection. The product already has all the data it needs. The job is to surface the connections, not to build new systems.

---

*UX-UNIFIED-EXPERIENCE.md — StoryBank v1.0*
*Next step: Architect reviews Section 4 (Integration Points 1–3) for feasibility sign-off before engineer builds.*
