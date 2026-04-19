# StoryBank — Phase 2 APPLY Loop UX Specification

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Ready for architect review and engineer implementation
**Depends on:** DESIGN.md v1.3, UX-UNIFIED-EXPERIENCE.md v1.0
**Features:** Company Research (6.8) · Fit Assessment (6.9) · Tailored Materials (6.10) · Batch Mode (6.11)

---

## Design Intent

Phase 1 built the story archive. Phase 2 deploys it. The APPLY loop is where a senior professional takes a specific opportunity — a job listing — and transforms it into a personalised research brief, a calibrated fit score, and ready-to-send materials. The user is in control throughout. Nothing is final until they decide it is.

The design has three principles specific to this phase:

**1. The Fit Assessment is the centrepiece.** This is the screen that earns trust. Eight dimensions, scored honestly, with red flags visible — not buried. The radar chart is a deliberate choice: it externalises a complex judgment into something the user can argue with, annotate, and act on.

**2. Edited, not generated.** Every piece of generated content is presented in an editable state by default. There is no "view generated CV" screen — there is only "here is your CV, edit it here." The framing reinforces that the user owns the output.

**3. Batch mode is a table, not a wall of cards.** Senior professionals running 4–8 parallel processes need a command-centre view, not an infinite scroll. The batch summary is a sortable, filterable table with inline quick-actions.

---

## 1. Information Architecture

### 1.1 Sidebar Additions

Phase 2 expands the APPLY section. Job Match moves from BUILD to APPLY (it is an application action, not a library-building action). The new Phase 2 pages sit inside APPLY.

**Updated NAV_SECTIONS for AppSidebar.tsx:**

```
Dashboard
Upload

──── BUILD ────
Example Bank
Mirror

──── APPLY ────
Job Match         ← moves here from BUILD (was between Mirror and Consistency)
Research          ← new (6.8)
Fit Assessment    ← new (6.9)
Materials         ← new (6.10)
Batch             ← new (6.11)
Consistency

──── PRACTISE ────
Practice
```

**Rationale for moving Job Match:** Job Match already sits in the APPLY loop conceptually — it is the first step in evaluating a specific opportunity. Moving it makes the APPLY section tell a coherent story: Match → Research → Fit → Materials. Consistency remains at the bottom of APPLY as it spans all active processes.

**Icon mapping (new items):**

| Label | Icon | Rationale |
|-------|------|-----------|
| Research | `Globe` | Company research — external world |
| Fit Assessment | `BarChart3` | Scoring/analysis — fits the radar/bar data |
| Materials | `FileOutput` | Output/export — signals generation |
| Batch | `Layers` | Multiple items processed together |

All icons: Lucide, `strokeWidth={1.5}`, 18px in sidebar.

### 1.2 URL Structure

```
/research              → Company Research landing (list of researched companies)
/research/new          → Start new research (paste URL or description)
/research/[id]         → Research detail for one company

/fit                   → Fit Assessment landing (list of assessments)
/fit/new               → Start new assessment
/fit/[id]              → Assessment detail for one job

/materials             → Materials landing (list of generated sets)
/materials/[id]        → Materials detail (CV, cover letter, tracking note)
/materials/[id]/cv     → CV editor (full-screen)
/materials/[id]/cover  → Cover letter editor (full-screen)

/batch                 → Batch Mode (upload multiple listings, view pipeline + table)
```

### 1.3 Single-Job Navigation Flow

For a single opportunity, the user moves through four connected pages in sequence. Each page has a persistent contextual header showing the job title and company, with forward/back navigation between phases.

```
/research/new  →  /research/[id]  →  /fit/[id]  →  /materials/[id]
     ↑                  ↑                ↑                 ↑
  Paste URL/       Research           Fit score        CV, cover
  description      results +          (8 dims)         letter,
                   annotations                         tracking note
```

The `[id]` is a shared `job_id` — each research result, fit assessment, and materials set links to the same underlying job record. This allows navigation between phases without re-entering data.

### 1.4 Cross-Loop Navigation

From Job Match (existing, BUILD loop): The existing gap analysis cards gain a "Research this company" link alongside "Practice this gap →" — routing to `/research/new?company=[company]&from=match`.

From Materials: A "Back to Fit Assessment" breadcrumb link is always present on Materials pages. The materials workflow should never feel like a dead end.

---

## 2. Page Designs

### 2.1 Research Landing — `/research`

**Purpose:** Entry point for all company research. Shows past research results, allows starting new.

**States:**

**Empty state (no research yet):**
```
┌────────────────────────────────────────────────────────────┐
│  [Globe icon, 48px, --sage]                                │
│                                                            │
│  No company research yet                                   │
│  h2, --mist                                               │
│                                                            │
│  Paste a job listing URL or description to research        │
│  the company before you apply.                            │
│  body-sm, --sage                                          │
│                                                            │
│  [Research a company]     ← copper button, links to /research/new
└────────────────────────────────────────────────────────────┘
```

**Loaded state:**
```
┌─────────┬──────────────────────────────────────────────────┐
│ SIDEBAR │  Research                  [+ New research]       │
│         │  h1, --mist                  copper button        │
│         │                                                   │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ [Building2 18px]  Airbox                    │  │
│         │  │ Series B · Fintech · 200 employees           │  │
│         │  │ Researched Feb 12, 2026                      │  │
│         │  │ [View research →]  [Start fit assessment →]  │  │
│         │  └─────────────────────────────────────────────┘  │
│         │  ┌─────────────────────────────────────────────┐  │
│         │  │ [Building2 18px]  Hyble                     │  │
│         │  │ Series A · HRTech · 80 employees             │  │
│         │  │ Researched Mar 3, 2026                       │  │
│         │  │ [View research →]  [View fit assessment →]   │  │
│         │  └─────────────────────────────────────────────┘  │
└─────────┴──────────────────────────────────────────────────┘
```

**Company Research Card:**
- Background: `--card`, border: `1px solid var(--border)`, `--radius-lg`
- Company name: h3, `--mist`, Georgia serif
- Descriptor line: body-sm, `--sage` — stage · sector · size
- Date: caption, `--sage`
- Two text links: `--copper`
- Hover: `--amber-faint` background tint, no lift

**Responsive:** Cards are full-width single column on all breakpoints. No grid — readability first, consistent with Example Bank pattern.

---

### 2.2 New Research — `/research/new`

**Purpose:** User provides a job listing (URL or pasted text). System researches the company and returns structured results.

**Layout:** Single column, max-width 680px, centred. Consistent with Upload page pattern.

**Component structure:**

```
┌─────────────────────────────────────────────────────┐
│  Research a company                                  │  h1
│  Paste a job listing URL or the full description.   │  body-sm, --sage
│  We'll research the company so you don't have to.   │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Job listing URL  (optional)                │    │  input
│  │  https://...                                │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ── or paste the full job description ──────────── │  section divider
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  [textarea, 200px min, expanding]           │    │
│  │  Paste the full job posting here...         │    │
│  └─────────────────────────────────────────────┘    │
│  [N characters]                                     │  caption, --sage, right-aligned
│                                                     │
│  ── Company details (optional) ─────────────────── │
│  Company name    [text input, autofilled from URL]  │
│  Job title       [text input]                      │
│                                                     │
│  [Research this company →]    ← copper button, full-width on mobile
│  "This takes 20–40 seconds."  ← caption, --sage, below button
└─────────────────────────────────────────────────────┘
```

**Input validation:**
- Either URL or textarea must have content — enforce on submit
- URL: validate format, show inline error "That doesn't look like a valid URL" if malformed
- Empty submit: "Paste a job URL or description to continue" below the textarea

**Loading state (after submit):**

Replace the form with a full-width progress panel. Do not use a spinner over the form — replace the entire content area. This signals that real work is happening and prevents re-submission.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  [Loader2, 32px, --amber, spinning]                 │
│                                                     │
│  Researching Airbox...                              │  h3, --mist
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  ✓  Company overview                        │    │  completed step
│  │  ✓  Funding and growth stage                │    │  completed step
│  │  ◌  Recent news and announcements           │    │  in progress
│  │  ·  Tech stack and engineering culture      │    │  pending
│  │  ·  Key people (CEO, hiring manager)        │    │  pending
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  "Usually takes 20–40 seconds"                      │  caption, --sage
│                                                     │
└─────────────────────────────────────────────────────┘
```

Progress steps: completed = `CheckCircle2` 14px `--match-high`; in progress = `Loader2` 14px `--amber` spinning; pending = bullet `·` `--sage`. Each step is body-sm, `--mist` when completed, `--amber` when in progress, `--sage` when pending.

---

### 2.3 Research Detail — `/research/[id]`

**Purpose:** Display structured research results. Allow user to annotate and proceed to fit assessment.

**Layout:** Two sections stacked vertically. Above the fold: company overview + key metrics. Below the fold: detailed sections in a card grid, then annotation area and next-step CTA.

**Job context header (persistent across all APPLY pages for this job):**

```
┌────────────────────────────────────────────────────────────┐
│  [Building2 16px --sage]  Airbox — VP Product              │  h3, --mist
│  ← Back to Research list    Research · Fit · Materials →   │  breadcrumb + progress pills
└────────────────────────────────────────────────────────────┘
```

Progress pills: "Research" (filled `--amber` background, `--ink` text) → "Fit" (outline `--border`, `--sage` text) → "Materials" (outline `--border`, `--sage` text). The active pill is filled amber. Completed pills use `--copper` outline with `--copper` text. This gives the user a clear sense of where they are in the process.

**Company Overview Block:**

```
┌─────────────────────────────────────────────────────────────┐
│  Airbox                                                      │  h2, Georgia, --mist
│  Series B · Fintech · London · ~200 employees               │  body-sm, --sage
│                                                             │
│  ┌──────────┬──────────┬──────────┬───────────┐             │
│  │  Series B │  £12M    │  2019    │  ~200     │             │
│  │  Stage    │  Raised  │  Founded │  People   │             │
│  └──────────┴──────────┴──────────┴───────────┘             │
│                                                             │
│  Overview paragraph (2–3 sentences, --mist, body)           │
└─────────────────────────────────────────────────────────────┘
```

Metric grid: 4-up on desktop, 2-up on tablet, 2-up on mobile. Each metric cell: background `--card-raised`, `--radius-md`, padding `--space-4`. Value: mono font, `--amber`, 18px. Label: caption, `--sage`, uppercase.

**Research Sections (card grid, 2 columns desktop / 1 column mobile):**

```
┌───────────────────────────┐  ┌───────────────────────────┐
│  Recent News              │  │  Tech Stack               │
│  [3 bullet items]         │  │  [tags: React, Rails,     │
│                           │  │   Postgres, AWS]           │
└───────────────────────────┘  └───────────────────────────┘

┌───────────────────────────┐  ┌───────────────────────────┐
│  Mission & Culture        │  │  Key People               │
│  [paragraph]              │  │  CEO: Marcus Webb         │
│                           │  │  CPO: Kasia Kowalski      │
│                           │  │  Hiring mgr: [unknown]    │
└───────────────────────────┘  └───────────────────────────┘
```

Each section card: background `--card`, border `1px solid var(--border)`, `--radius-lg`, padding `--space-5 --space-6`. Section heading: h4, `--mist`. Content: body-sm, `--sage` for secondary info, `--mist` for names/data.

**Red flag callouts (when the system identifies a risk):**

```
┌─────────────────────────────────────────────────────────────┐
│  [AlertTriangle 16px --contradiction]                       │
│  Revenue not publicly disclosed — compensation offer may    │
│  be below stated range. Verify before progressing.          │
└─────────────────────────────────────────────────────────────┘
```

Background: `rgba(196, 90, 42, 0.08)`, border-left: `3px solid var(--contradiction)`, `--radius-md`. Text: body-sm, `--mist`. These appear inline within the relevant section card, not as a separate panel.

**Uncertain claims (distinguished from red flags):**

Rendered inline within section content with a `~` prefix and `--sage` italic text: "~Glassdoor reviews suggest average tenure < 18 months (unverified)". This is softer than a red flag — it flags provenance without alarming the user.

**User Annotations Area:**

Below the research sections, a collapsible panel:

```
┌─────────────────────────────────────────────────────────────┐
│  [ChevronDown]  My notes on this company                    │  collapsible header
├─────────────────────────────────────────────────────────────┤
│  [textarea, 3 lines, expandable]                            │
│  "Add your own observations, context, or questions..."      │
│  Saved automatically.   [Undo last change]                  │
└─────────────────────────────────────────────────────────────┘
```

Background: `--card`, border-left: `3px solid var(--river)`, `--radius-md`. Auto-save on blur, debounced 800ms. "Saved automatically" appears as a caption `--sage` below — not a toast. "Undo last change" appears for 5 seconds after each auto-save, then hides.

**Next Step CTA (sticky bottom bar on mobile, inline on desktop):**

```
┌─────────────────────────────────────────────────────────────┐
│  [BarChart3 16px --amber]  Ready to assess your fit?        │
│  Based on this research, assess how well this role matches  │
│  your profile across 8 dimensions.                         │
│                                                             │
│  [Start Fit Assessment →]     ← amber button               │
└─────────────────────────────────────────────────────────────┘
```

On mobile: fixed to bottom of viewport, full-width, background `--tay`, border-top `--border`. On desktop: inline card at bottom of page content.

**Error state (research failed or timed out):**
```
Research couldn't be completed.
We saved your job description — no data was lost.
This sometimes happens with paywalled sites or unusual formatting.

[Try again]  [Continue without research →]
```
"Continue without research" links to `/fit/new?job_id=[id]` — the user should never be blocked from progressing.

---

### 2.4 Fit Assessment Landing — `/fit`

Mirrors the Research landing in structure. Same empty/loaded states. Each card shows: company, job title, overall fit score (prominent), date assessed.

**Loaded state:**

```
┌──────────────────────────────────────────────────────────┐
│  Fit Assessment                    [+ New assessment]    │
│                                                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Airbox — VP Product                                │ │
│  │                                                     │ │
│  │  Overall fit:  [████████░░]  78 / 100               │ │  --amber progress bar
│  │                                                     │ │
│  │  Archetype: Executive Leader                        │ │  amber badge
│  │  Feb 12, 2026                                       │ │
│  │                                                     │ │
│  │  [View assessment →]  [Generate materials →]        │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Overall fit score bar: background track `--card-raised`, fill `--amber` (>= 70), `--copper` (50–69), `--sage` (< 50). Height 6px, `--radius-full`.

---

### 2.5 New Fit Assessment — `/fit/new`

**Purpose:** Run an 8-dimension assessment. Can be linked from research (with pre-populated company data) or entered directly.

**Layout:** Single column, max-width 680px. Input form, then results replace it (no new page navigation — same-page state transition).

**Input form:**

```
┌─────────────────────────────────────────────────────────────┐
│  Assess your fit                                             │  h1
│  We'll score this role across 8 dimensions and give you     │  body-sm, --sage
│  an overall fit assessment.                                 │
│                                                             │
│  Job listing                                               │  label
│  [textarea, 160px, paste full spec or use existing]         │
│                                                             │
│  ── or link to a research result ──                        │  section divider
│                                                             │
│  [Select from your research list ▾]                         │  dropdown
│  Shows: "Airbox — researched Feb 12" etc.                  │
│                                                             │
│  Your profile context  (optional — helps calibrate)        │  label
│  [textarea, 80px, "Paste your current role / key context"] │
│                                                             │
│  [Run fit assessment →]   copper button, full width mobile  │
└─────────────────────────────────────────────────────────────┘
```

**Loading state:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Loader2 32px --amber spinning]                            │
│                                                             │
│  Scoring your fit for Airbox VP Product...                  │  h3, --mist
│                                                             │
│  Evaluating 8 dimensions · This takes 20–35 seconds        │  body-sm, --sage
│                                                             │
│  [simple amber progress shimmer bar, indeterminate]         │
└─────────────────────────────────────────────────────────────┘
```

Do not show individual dimension scores as they arrive — wait for the full result, then animate them in together. Partial scores invite premature judgment on incomplete data.

---

### 2.6 Fit Assessment Detail — `/fit/[id]`

**Purpose:** The visual centrepiece of Phase 2. Display all 8 dimension scores with the radar chart as the hero, supported by bar scores, archetype badge, and red flag annotations.

**Full page layout:**

```
┌─────────────────────────────────────────────────────────────┐
│  [Job context header: Airbox — VP Product · breadcrumb]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ── FIT OVERVIEW ──────────────────────────────────────── │
│                                                             │
│  ┌──────────────────────┐  ┌───────────────────────────┐   │
│  │                      │  │  Overall Fit              │   │
│  │   [Radar Chart]      │  │  78 / 100                 │   │  mono, amber, 36px
│  │   8 spokes           │  │                           │   │
│  │   --amber fill       │  │  Archetype                │   │
│  │                      │  │  [Executive Leader]       │   │  amber badge
│  │                      │  │                           │   │
│  │                      │  │  ⚠ 2 red flags           │   │  contradiction colour
│  │                      │  │  ~ 1 uncertain claim      │   │  sage
│  └──────────────────────┘  └───────────────────────────┘   │
│                                                             │
│  ── DIMENSION SCORES ──────────────────────────────────── │
│                                                             │
│  [8 dimension score rows]                                  │
│                                                             │
│  ── RED FLAGS ─────────────────────────────────────────── │
│                                                             │
│  [flag cards]                                              │
│                                                             │
│  ── ANNOTATIONS ───────────────────────────────────────── │
│                                                             │
│  [user notes + edit affordance]                            │
│                                                             │
│  [Generate Materials →]   amber button                     │
└─────────────────────────────────────────────────────────────┘
```

**Responsive:** On mobile, the radar chart and score summary stack vertically (chart first, then summary). Dimension scores remain single column.

#### 2.6.1 Radar Chart Component

**What it shows:** An 8-spoke radar chart. Each spoke maps to one assessment dimension. The score (1–10) determines how far out along the spoke the data point sits. The area enclosed by all 8 points is filled `--amber` at 20% opacity. The outline of the shape is `--amber` at 80% opacity. The outer ring (maximum score) is `--border`.

**Dimensions (the 8 spokes):**
1. Domain / Industry
2. Seniority
3. Scope
4. Technical
5. Mission / Purpose
6. Location
7. Compensation
8. Culture

**Implementation note for engineer:** This is an SVG radar chart — no Chart.js. The chart is drawn from scratch using calculated polygon coordinates. This keeps bundle size down and gives full control over the Deep Tay styling. The chart is not interactive (no hover states on individual spokes) — the dimension detail rows below provide the detailed breakdown.

**Visual spec:**
- Container: 240px × 240px on desktop, 200px × 200px on mobile
- Background: `--card-raised`, `--radius-lg`
- Spoke labels: caption, `--sage`, positioned outside the outer ring
- Outer ring: stroke `var(--border)`, stroke-width 1
- Inner rings (25%, 50%, 75%): stroke `var(--border)` at 40% opacity, stroke-width 0.5
- Spoke lines: stroke `var(--border)`, stroke-width 0.5
- Data polygon fill: `rgba(226, 160, 57, 0.18)`
- Data polygon stroke: `var(--amber)`, stroke-width 1.5
- Data point circles: `--amber` filled, radius 3

**Accessibility:** The radar chart is `aria-hidden="true"`. The dimension score rows below provide the accessible representation. Include `<title>` and `<desc>` inside the `<svg>` for screen readers that do expose SVG: "Fit assessment radar chart for [company] [role]. Scores range from 1 to 10 across 8 dimensions."

#### 2.6.2 Dimension Score Rows

Eight rows, one per dimension. Ordered: Domain, Seniority, Scope, Technical, Mission, Location, Compensation, Culture.

```
┌─────────────────────────────────────────────────────────────┐
│  Domain / Industry                               8 / 10     │
│  ████████░░  [progress bar, 80% fill]                       │
│  "12 years in B2B SaaS with fintech exposure.               │
│  Strong industry match for this stage."                     │
│  ⚠ Red flag: No direct payments experience          [Expand]│
└─────────────────────────────────────────────────────────────┘
```

**Row visual spec:**
- Background: `--card`, `--radius-md`, border `1px solid var(--border)`
- Dimension label: h4, `--mist`
- Score: mono font, `--amber` (8–10), `--copper` (6–7), `--sage` (1–5), right-aligned
- Progress bar: height 4px, `--radius-full`. Fill colour matches score colour. Track: `--card-raised`
- Rationale text: body-sm, `--sage`, 2 lines max (expandable)
- Red flag inline: `AlertTriangle` 14px `--contradiction`, body-sm `--mist`
- Uncertain claim inline: `~` prefix, body-sm italic `--sage`
- Expand chevron: `ChevronDown` 14px `--sage`, right-aligned, reveals full rationale text

**Collapsed by default:** Only show 2 lines of rationale plus any red flag. Expand on chevron click. Expanded state shows full AI reasoning, source citations (where available), and a user annotation field.

**User annotation per dimension:**

When expanded, below the AI rationale:

```
Your notes on this dimension:
[small textarea, 1 line, expandable — "Add your own assessment..."]
Saved automatically.
```

This lets the user push back on or supplement the AI score. Their annotation persists and renders below the rationale on subsequent views.

#### 2.6.3 Overall Score and Archetype

**Overall score:** Weighted average of 8 dimensions. Displayed as a large mono number: `78 / 100`. `--amber` for 70+, `--copper` for 50–69, `--sage` for below 50.

**Weighting:** Compensation, Seniority, and Location default to weight 2x. All others 1x. The weighting is shown to the user ("Compensation and seniority are weighted more heavily as deal-breakers") in a collapsed info callout below the score.

**Archetype badge:** A single descriptor badge derived from the dominant score profile. Examples:

| Profile | Badge |
|---------|-------|
| High seniority, scope, domain — lower technical | `Executive Leader` |
| High technical, lower seniority | `IC Specialist` |
| High mission, culture — lower compensation | `Mission-Driven` |
| Balanced across all dimensions ≥ 7 | `Strong All-Round` |
| Any dimension ≤ 3 | `Key Gaps Present` |
| Compensation ≤ 4 or Location ≤ 4 | `Deal-Breaker Risk` |

Badge visual: `--radius-full` pill, background `--amber-faint`, border `1px solid var(--amber)`, text `--amber` label size, font-semibold. The `Deal-Breaker Risk` variant uses `--contradiction` colours instead.

#### 2.6.4 Red Flags Section

Displayed below the dimension rows. Only rendered if ≥ 1 red flag exists.

```
┌─────────────────────────────────────────────────────────────┐
│  [AlertTriangle 16px --contradiction]  Red Flags             │  h3
│  Review these before applying.                              │  body-sm, --sage
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Compensation misalignment                           │   │  flag title, h4, --mist
│  │  The listed range (£100–120k) is below your stated  │   │  body-sm, --sage
│  │  floor of £150k. This could be a deal-breaker.      │   │
│  │  [View in Consistency →]                            │   │  --copper link
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Stage mismatch                                      │   │
│  │  You've led post-Series C teams; Airbox is Series B  │   │
│  │  and may expect founder-mode leadership.             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

Flag card: background `rgba(196, 90, 42, 0.06)`, border-left `3px solid var(--contradiction)`, `--radius-md`, padding `--space-4`. Title: h4, `--mist`. Body: body-sm, `--sage`.

Each flag can be dismissed: a small "Not a concern for me [×]" link appears on hover, `--sage` caption. Dismissed flags move to a collapsed "Dismissed flags" section at the bottom — never deleted, but out of the primary view.

---

### 2.7 Materials Landing — `/materials`

Same structure as Research and Fit landings. Each card shows: company, job title, what has been generated (CV · Cover Letter · Tracking Note), date.

Generation status chips per card: "CV" `--match-high` (generated), "Cover letter" `--amber` (draft), "Tracking note" `--sage` (not started).

---

### 2.8 Materials Detail — `/materials/[id]`

**Purpose:** The generation and editing hub. All three document types live here. The user generates, previews, edits inline, and exports from a single screen.

**Layout:** Three-tab horizontal navigation at top of content area. Tabs: CV · Cover Letter · Tracking Note.

```
┌─────────────────────────────────────────────────────────────┐
│  [Job context header: Airbox — VP Product · breadcrumb]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Materials                                                  │  h1
│  Your tailored documents for this role.                    │  body-sm, --sage
│                                                             │
│  [CV]  [Cover Letter]  [Tracking Note]    ← tab row        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│  [Active tab content]                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Tab visual spec:** Tabs use the existing pattern from shadcn/ui. Active tab: bottom border 2px `--amber`, text `--mist`. Inactive: no border, text `--sage`. Hover: text `--mist`. Background: `--card`.

#### 2.8.1 CV Tab

**States: not generated / generating / generated+editable**

**Not generated:**
```
┌─────────────────────────────────────────────────────────────┐
│  [FileOutput 48px --sage]                                   │
│                                                             │
│  No CV generated yet                                        │  h3, --mist
│                                                             │
│  We'll tailor your master CV template to this role,         │  body-sm, --sage
│  drawing on your example bank for the experience section.  │
│                                                             │
│  [Generate CV for Airbox →]    ← amber button               │
└─────────────────────────────────────────────────────────────┘
```

**Generating:**
```
[Loader2 32px --amber spinning]

Generating your CV for Airbox VP Product...

Drawing on 6 examples from your bank.   ← body-sm, --sage
This takes 15–25 seconds.
```

**Generated (edit-first layout):**

The generated CV is presented as an **editable document by default**, not as a read-only preview. The user lands in editing mode. This is the key UX decision for materials: the framing is "here is your draft, make it yours" not "here is the finished output."

```
┌─────────────────────────────────────────────────────────────┐
│                                              [Download PDF] │  copper button
│                                              [Copy text]    │  text link, --copper
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                                                       │  │
│  │  [Editable document area]                             │  │  background: --card-raised
│  │                                                       │  │  border: 1px solid --border
│  │  Full name (editable h2)                              │  │  --radius-lg, padding --space-8
│  │  Role title | Location | Email                        │  │
│  │                                                       │  │
│  │  SUMMARY                                              │  │
│  │  [editable paragraph]                                 │  │
│  │                                                       │  │
│  │  EXPERIENCE                                           │  │
│  │  MOO.com — VP Product (2022–present)                  │  │
│  │  [editable bullet points]                             │  │
│  │                                                       │  │
│  │  [...]                                                │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  [Regenerate]  ← text link, --sage, with warning tooltip   │
│  "Regenerating will overwrite your edits."                  │
└─────────────────────────────────────────────────────────────┘
```

**Editable document area:** This is a `<div contenteditable="true">` with controlled styling. Autosave on blur. Do not use a rich text editor (Tiptap, Quill) — the overhead is not justified. Plain contenteditable with clean paste handling (strip incoming styles) is sufficient for the use case.

Content font: system sans-serif. Light mode palette inside the editable area (the document itself should look like a document, not a dark-mode card). Specifically: background `#ffffff`, text `#111111`, internal font size 14px/16px per heading level. The surrounding chrome remains dark-mode.

**Example bank attribution:** Where a bullet point was drawn from a specific example in the bank, it carries a small `[→ Bank]` superscript link in `--copper`. This is informational only — clicking navigates to that example in `/examples/[id]` in a new tab. If the user edits that bullet, the attribution link is removed automatically.

**Regenerate warning:** "Regenerating will overwrite your edits." Tooltip on hover (`--tay` background tooltip, `--mist` text). If the user has made edits, clicking Regenerate shows a confirmation dialog before overwriting.

#### 2.8.2 Cover Letter Tab

Same three states (not generated / generating / generated). The generated output follows the same edit-first pattern. The editable area is a simpler single-text block (not sections).

**Specific addition: Company-specific hooks panel**

Above the editable area, when generated:

```
┌─────────────────────────────────────────────────────────────┐
│  [Sparkles 14px --amber]  Company-specific hooks used       │  label, --amber
│                                                             │
│  · Airbox's Series B milestone (March 2026 news)            │  body-sm, --sage
│  · Their engineering-led culture (Glassdoor theme)         │
│  · The hiring manager's background in payments (LinkedIn)  │
└─────────────────────────────────────────────────────────────┘
```

Background: `--amber-faint`, border `1px solid var(--amber)`, `--radius-md`. This panel reassures the user that the letter is genuinely tailored, not a generic template. Each hook is a bullet; collapsible if > 3 hooks.

#### 2.8.3 Tracking Note Tab

**Purpose:** A structured note in Obsidian-compatible Markdown format summarising this application. Ready to paste into a vault.

The tracking note is always auto-generated — no "Generate" button. When the user opens this tab for the first time, it generates silently (2–5 seconds). If the user already has research and fit data, generation is near-instantaneous.

```
┌─────────────────────────────────────────────────────────────┐
│  [Copy to clipboard]    [Open in editor]                    │  buttons, --copper
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  ---                                                   │  │  monospace code block
│  │  company: Airbox                                       │  │  background: --card-raised
│  │  role: VP Product                                      │  │  border: 1px solid --border
│  │  status: Applied                                       │  │  font: --font-mono, 13px
│  │  fit_score: 78                                         │  │  color: --mist
│  │  archetype: Executive Leader                           │  │
│  │  date: 2026-02-12                                      │  │
│  │  ---                                                   │  │
│  │                                                        │  │
│  │  # Airbox — VP Product                                 │  │
│  │                                                        │  │
│  │  ## Company Overview                                   │  │
│  │  Series B fintech, ~200 people, London...              │  │
│  │                                                        │  │
│  │  ## Fit Assessment                                     │  │
│  │  Overall: 78/100 · 2 red flags                         │  │
│  │                                                        │  │
│  │  ## Key Examples to Use                                │  │
│  │  - [[MOO Army story]] — maps to change leadership      │  │
│  │  - [[MOO OKR rollout]] — maps to product strategy      │  │
│  │                                                        │  │
│  │  ## My Notes                                           │  │
│  │  [user's annotations from research + fit]              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  "This is Obsidian-compatible Markdown. Copy and paste     │  caption, --sage
│  it into your vault."                                       │
└─────────────────────────────────────────────────────────────┘
```

The tracking note is not editable inline — it is a generated read-only output. The "Open in editor" button opens a full-screen modal with a plain textarea containing the raw Markdown, where the user can make edits and copy the final version.

---

### 2.9 Batch Mode — `/batch`

**Purpose:** Upload and process multiple job listings simultaneously. View pipeline status and a summary table of results, ranked by fit.

**Layout:** Two vertical sections. Top: upload panel + pipeline progress. Bottom: results table (visible once ≥ 1 job completes).

**Batch Upload Panel:**

```
┌─────────────────────────────────────────────────────────────┐
│  Batch Job Analysis                                          │  h1
│  Add multiple job listings to research and score at once.  │  body-sm, --sage
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Job 1: [URL or paste text]           [×]   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │  Job 2: [URL or paste text]           [×]   │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  │  [+ Add another listing]    ← text link, --copper   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Run batch analysis →]    copper button                    │
│  "Processing 2 listings. Usually takes 1–2 minutes total." │  caption, --sage
└─────────────────────────────────────────────────────────────┘
```

Maximum 10 jobs per batch (enforce with inline message "Maximum 10 listings per batch"). Minimum 2 (if only 1, redirect to single-job flow with a message: "For a single listing, use the Research flow for more detail").

Each job input row: background `--card`, border `1px solid var(--border)`, `--radius-md`, text input for URL or short label, small `[×]` remove button at right. The URL is optional — a text label is enough for identification.

**Pipeline Progress Panel (shown once batch is submitted):**

Replaces the upload panel. Shows real-time status for each job.

```
┌─────────────────────────────────────────────────────────────┐
│  Processing 3 listings...                                    │  h3, --mist
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [CheckCircle2 --match-high]  Airbox VP Product      │  │  completed
│  │  Researched · Fit scored · Score: 78                 │  │  body-sm, --sage
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [Loader2 --amber spinning]   Hyble VP Product       │  │  in progress
│  │  Running fit assessment...                           │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  [·  --sage]                  World of Books         │  │  pending
│  │  Queued                                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [1 of 3 complete]   [████░░░░░░]  33%                     │  caption, --sage
└─────────────────────────────────────────────────────────────┘
```

Each job row: background `--card`, `--radius-md`, border `1px solid var(--border)`. Status icon (completed / in-progress / pending) on left, job label + status line below. The status line updates in real-time as the pipeline progresses.

Overall progress bar: height 6px, `--radius-full`, fill `--amber`, track `--card-raised`. Text: "N of M complete".

**Results Table (appears below pipeline, progressively fills as jobs complete):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Results                            [Sort: Fit score ▾]  [Export CSV]       │
├──────────────────┬──────────┬─────────┬──────────────┬─────────────────────┤
│  Company / Role  │  Fit     │ Archetype│  Red Flags   │  Actions            │
├──────────────────┼──────────┼─────────┼──────────────┼─────────────────────┤
│  Airbox          │  78/100  │ Exec     │  ⚠ 2         │  [Research] [Fit]  │
│  VP Product      │  ████░░  │ Leader   │              │  [Materials]        │
├──────────────────┼──────────┼─────────┼──────────────┼─────────────────────┤
│  World of Books  │  71/100  │ Strong   │  ⚠ 1         │  [Research] [Fit]  │
│  Product Director│  ███░░░  │ All-Round│              │  [Materials]        │
├──────────────────┼──────────┼─────────┼──────────────┼─────────────────────┤
│  Hyble           │  64/100  │ Mission  │  ⚠ 3         │  [Research] [Fit]  │
│  VP Product      │  ██░░░░  │ Driven   │              │  [Materials]        │
└──────────────────┴──────────┴─────────┴──────────────┴─────────────────────┘
```

**Table visual spec:**
- Table container: background `--card`, border `1px solid var(--border)`, `--radius-lg`, overflow hidden
- Header row: background `--tay`, text `--sage` label size, uppercase, `letter-spacing: 0.05em`
- Body rows: alternating background `--card` / `--card-raised`, border-bottom `1px solid var(--border)`
- Fit score: mini progress bar (same as landing card) + mono score number, `--amber` / `--copper` / `--sage` by tier
- Archetype: `--sage` body-sm
- Red Flags: `AlertTriangle` 14px `--contradiction` + count
- Actions: three text links `--copper`, stacked or inline depending on column width

**Sorting:** Default sort: highest fit score first. User can sort by Fit, Red Flags count, alphabetical by company. Sort icon in column header: `ChevronUp` / `ChevronDown` 12px. The active sort column header is `--mist` text.

**Responsive table (below 768px):** The table collapses into a stacked card list. Each card contains all the same information vertically. The horizontal table is not shown on mobile — it is too wide to be useful.

**Export CSV:** Top-right of results section. Downloads a CSV with columns: Company, Role, Fit Score, Archetype, Red Flag Count, Research URL, Fit Detail URL, Materials URL. `--copper` text link.

---

## 3. Component Specifications

### 3.1 JobContextHeader

**Purpose:** Persistent identity banner shown at the top of Research, Fit, and Materials pages for a specific job. Grounds the user in the job they are working on.

**Props:**
```typescript
interface JobContextHeaderProps {
  company: string;
  role: string;
  jobId: string;
  currentPhase: 'research' | 'fit' | 'materials';
  hasResearch: boolean;
  hasFit: boolean;
  hasMaterials: boolean;
}
```

**Visual:**
- Height: 48px, full-width, background `--tay`, border-bottom `1px solid var(--border)`
- Left: `Building2` 16px `--sage` + company em-dash role in h4 `--mist`, truncated at 40 chars
- Right: three phase pills ("Research" · "Fit Assessment" · "Materials") linked to their respective pages
- Phase pill active state: background `--amber`, text `--ink`, `--radius-full`, font-semibold
- Phase pill completed (has data): background transparent, border `1px solid var(--copper)`, text `--copper`
- Phase pill not-yet: background transparent, border `1px solid var(--border)`, text `--sage`
- Phase pills not shown on mobile — replaced by a "Back" link only

**Accessibility:**
- `nav aria-label="Application phases"` wrapping the phase pills
- Each pill: `aria-current="page"` on the active one
- `aria-label` on each pill includes the completion state: "Research — completed", "Fit Assessment — current page", "Materials — not started"

---

### 3.2 RadarChart

**Purpose:** SVG radar chart for 8-dimension fit display.

**Props:**
```typescript
interface RadarChartProps {
  dimensions: Array<{
    label: string;
    score: number;  // 1–10
  }>;
  size?: number;   // default 240
}
```

**SVG rendering logic:**
- Centre point: `(size/2, size/2)`
- Radius: `(size/2) - labelPadding` (labelPadding = 28px for labels)
- Spoke angle for dimension `i`: `(2π/8) * i - π/2` (start from top)
- Score point for dimension `i`: `centre + (score/10) * radius * [cos(angle), sin(angle)]`
- Three inner rings at 25%, 50%, 75% radius: stroke `var(--border)` opacity 40%
- Labels: `<text>` elements positioned at 110% radius from centre

**Colours:**
- Polygon fill: `rgba(226, 160, 57, 0.18)`
- Polygon stroke: `var(--amber)`, stroke-width 1.5
- Data point circles: fill `var(--amber)`, radius 3px
- Spoke lines: stroke `var(--border)`, stroke-width 0.5
- Outer ring: stroke `var(--border)`, stroke-width 1

**Animation:** When the chart first renders (after data loads), animate the polygon points from the centre outward. CSS `clip-path` animation or SVG stroke-dashoffset over 600ms ease-out. Do not animate on re-render — only on first mount.

**Accessibility:** `aria-hidden="true"` on the `<svg>`. The accessible representation is in the DimensionScoreRow list.

---

### 3.3 DimensionScoreRow

**Purpose:** Single row in the fit assessment breakdown.

**Props:**
```typescript
interface DimensionScoreRowProps {
  dimension: string;
  score: number;  // 1–10
  rationale: string;
  redFlag?: string;
  uncertainClaim?: string;
  userAnnotation?: string;
  onAnnotationSave: (text: string) => void;
}
```

**States:** collapsed (default) / expanded (on chevron click)

**Collapsed height:** ~72px (label + score + bar + first line of rationale)
**Expanded:** full rationale + red flag + uncertain claim + annotation textarea

**Score colour logic:**
```
score >= 8  → var(--amber)
score >= 6  → var(--copper)
score < 6   → var(--sage)
```

**Accessibility:**
- Row: `<article aria-label="[dimension] score: [N] out of 10">`
- Expand button: `aria-expanded`, `aria-controls="dimension-[id]-detail"`
- Score: `aria-label="[N] out of 10"` (not just the number)
- Red flag: `role="alert"` if present (announced to screen readers)
- Annotation textarea: `aria-label="Your notes on [dimension]"`

---

### 3.4 FlagCard

**Purpose:** Renders a single red flag from the fit assessment.

**Props:**
```typescript
interface FlagCardProps {
  title: string;
  description: string;
  relatedDimension?: string;
  consistencyLink?: string;  // links to /consistency if flag relates to a tracked claim
  onDismiss: () => void;
  dismissed: boolean;
}
```

**Visual:** Described in Section 2.6.4. Not rendered if `dismissed` is true — the row appears in the "Dismissed flags" accordion instead.

**Dismiss interaction:** On hover, a `[Not a concern for me ×]` appears at bottom-right of the card. Font: caption, `--sage`. On click, the card slides out (height animation to 0, 200ms) and the parent updates dismissed state. Dismiss is persistent — survives page refresh.

---

### 3.5 MaterialsEditor

**Purpose:** Contenteditable document editing area with autosave.

**Props:**
```typescript
interface MaterialsEditorProps {
  initialContent: string;   // HTML string from generation
  onSave: (content: string) => void;  // called on blur, debounced
  onRegenerateRequest: () => void;
  hasUnsavedEdits: boolean;
  exampleAttributions?: Array<{
    elementId: string;
    exampleId: string;
    exampleQuestion: string;
  }>;
}
```

**Autosave behaviour:** On blur, debounced 800ms. Visual feedback: a subtle "Saved" caption `--sage` fades in below the editor for 2 seconds, then fades out. Not a toast.

**Paste handling:** Strip all inline styles and external formatting from pasted content. Accept only plain text — convert pasted rich text to unstyled paragraphs. This prevents users from pasting styled content that breaks the document appearance.

**Regenerate guard:** If `hasUnsavedEdits` is true when Regenerate is clicked, show a shadcn `AlertDialog`: "Regenerating will overwrite your changes. This cannot be undone." with Confirm and Cancel options.

**Accessibility:**
- The contenteditable div must have `role="textbox"`, `aria-multiline="true"`, `aria-label="[CV/Cover Letter] content, editable"`
- `aria-describedby` pointing to an autosave status region
- Autosave status region: `aria-live="polite"`, visually hidden when no message

---

### 3.6 BatchPipelineRow

**Purpose:** Single job row in the batch pipeline progress panel.

**Props:**
```typescript
interface BatchPipelineRowProps {
  jobLabel: string;
  status: 'pending' | 'researching' | 'scoring' | 'complete' | 'error';
  fitScore?: number;
  errorMessage?: string;
}
```

**Status rendering:**
- `pending`: bullet `·` `--sage`, status text "Queued"
- `researching`: `Loader2` 14px `--amber` spinning, "Researching company..."
- `scoring`: `Loader2` 14px `--amber` spinning, "Running fit assessment..."
- `complete`: `CheckCircle2` 14px `--match-high`, "Score: [N]" in mono `--amber`
- `error`: `XCircle` 14px `--destructive`, error message in `--mist`, retry link `--copper`

**Transition from in-progress to complete:** The status icon crossfades (150ms) from spinner to checkmark. The fit score slides in from the right (translateX 8px → 0, opacity 0 → 1, 200ms).

---

### 3.7 BatchResultsTable

**Purpose:** Sortable summary table for batch results.

**Props:**
```typescript
interface BatchResultsTableProps {
  results: Array<{
    jobId: string;
    company: string;
    role: string;
    fitScore: number;
    archetype: string;
    redFlagCount: number;
    researchId: string;
    fitId: string;
    materialsId?: string;
  }>;
  onSort: (field: 'fit' | 'flags' | 'company') => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}
```

**Keyboard navigation:**
- Table headers with sort: `role="button"`, `aria-sort="ascending|descending|none"`
- Keyboard: Enter/Space on sortable header activates sort
- Row actions: Tab-navigable, each action link in the Actions column is individually focusable

**Mobile:** Below 768px, renders as `BatchResultsCard` list instead (one card per result, same data vertically arranged).

---

## 4. User Flows

### 4.1 Single Job Flow: Research → Fit → Materials

**Preconditions:** User is authenticated, has ≥ 1 example in their bank, and has a job listing to work with.

```
Step 1  /research/new
        User pastes job listing URL for "Airbox VP Product".
        Clicks "Research this company".
        [Loading state — 20–40 seconds, shows progress steps]

Step 2  /research/[id]  — auto-redirected after research completes
        Sees structured company overview: Series B, £12M raised,
        ~200 people, fintech.
        Reads Recent News section — sees Series B announcement.
        Notices red flag: "Compensation range £100–120k listed
        — below stated floor."
        Adds annotation: "Ask Marcus about comp flexibility in
        first screen. Series B may have equity kicker."
        Clicks "Start Fit Assessment →"

Step 3  /fit/[id]  — auto-redirected, no separate /fit/new needed
        when arriving from research
        Assessment runs (20–35s).
        Lands on fit detail.
        Sees radar chart — strong spokes for Domain, Seniority,
        Mission. Weak spoke for Compensation.
        Score: 74/100. Archetype: "Executive Leader".
        Red flags: 2. Expands "Compensation" dimension row —
        reads rationale, adds own note: "Willing to flex if
        equity is meaningful."
        Dismisses the "Stage mismatch" flag as not a concern.
        Clicks "Generate Materials →"

Step 4  /materials/[id]
        CV tab active. CV is generated in ~20s.
        Reads summary section — it's pulled the MOO leadership
        narrative accurately. Edits one bullet to be more
        specific.
        Switches to Cover Letter tab.
        Sees company-specific hooks used: Series B announcement,
        engineering-led culture.
        Reads generated letter — makes 2 edits.
        Switches to Tracking Note tab.
        Sees auto-generated Obsidian note.
        Copies to clipboard. Pastes into vault.

Flow complete. Three documents ready. No context switching — all
within one job_id thread.
```

**Navigation between steps:** At any point, the `JobContextHeader` phase pills allow jumping back to Research or Fit without losing edits. Forward navigation to a phase that hasn't been completed yet is blocked with a tooltip: "Run the fit assessment first to generate materials."

---

### 4.2 Batch Flow: Multiple Listings → Pipeline → Table

```
Step 1  /batch
        User clicks "+ Add another listing" three times.
        Adds URLs or text labels for:
        - Airbox VP Product
        - World of Books Product Director
        - Hyble VP Product

Step 2  Clicks "Run batch analysis →"
        Upload panel replaced by pipeline progress panel.
        Airbox starts first, shows "Researching company..."
        After ~35s, Airbox completes: "Score: 78".
        World of Books begins.

Step 3  While pipeline runs, the results table starts
        populating below the pipeline panel.
        Airbox row appears immediately upon completion.
        User can click "Fit →" on the Airbox row to view
        that fit assessment in detail while the others process.
        They navigate to /fit/[airbox-id], review, return to
        /batch — World of Books is now complete too.

Step 4  All 3 complete. Pipeline panel shows all green.
        Table fully populated, sorted by fit score:
        Airbox (78) > World of Books (71) > Hyble (64)

Step 5  User clicks "Export CSV" — downloads batch_results.csv.
        Pastes summary into decision spreadsheet.
        Clicks "Materials →" on Airbox to generate tailored docs.

Batch flow complete. User has a ranked view of 3 opportunities
in ~3 minutes total.
```

---

### 4.3 BUILD to APPLY: Example Bank → Materials

A user is in their Example Bank and wants to check how their examples would fare in a job application.

```
Step 1  /examples (Example Bank)
        User is reviewing examples tagged "Strategy".
        Notices the "Match a job spec →" quick action in the
        page header.

Step 2  /match  (existing Job Match page, now under APPLY)
        Pastes Airbox job spec.
        Gets ranked example list — 5 matches.
        Notices gap: "No M&A integration examples."
        Clicks "Practice this gap →" — navigates to
        /practice?gap=M%26A+integration

Step 3  /practice?gap=M%26A+integration
        Practises. Saves answer to bank.

Step 4  /research/new
        Now has a prepared story. Starts research on Airbox.
        Proceeds through Research → Fit → Materials as per
        Flow 4.1.
```

The connective tissue between flows is the job listing's `job_id`. When a user arrives at `/research/new` from `/match`, the job spec they pasted into match is pre-populated into the research form if passed as a query param (`?spec_from=match`). This avoids re-entry.

---

### 4.4 Editing Generated Materials

```
Step 1  /materials/[id] — CV tab
        User sees generated CV. Content is immediately editable.
        They click into the summary paragraph and edit directly.
        On blur, "Saved" caption appears briefly.

Step 2  User wants to try a different version.
        Clicks "Regenerate" (text link, --sage).
        If edits exist: confirmation dialog appears.
        User confirms. New version generated (15–25s loading).
        Old version is overwritten.

Step 3  User wants a PDF.
        Clicks "Download PDF" button.
        PDF is generated server-side (print stylesheet applied
        to the document content). Downloads as
        "CV_Airbox_VP_Product.pdf".

Step 4  User wants to copy the plain text.
        Clicks "Copy text" (text link below Download PDF).
        Full text content copied to clipboard.
        "Copied" confirmation replaces the link text for 2s.
```

**Unsaved edits guard:** If the user attempts to navigate away from a Materials page with unsaved edits (edits not yet auto-saved), the browser `beforeunload` event fires a confirmation: "You have unsaved changes. Leave anyway?" This only triggers if autosave has genuinely not fired yet (i.e., user edits and immediately tries to navigate within the same second).

---

## 5. Design Decisions

### 5.1 Radar Chart Over Bar Chart

**Decision:** Use a radar chart for the 8-dimension overview, supplemented by bar scores in the detailed rows.

**Rationale:** The radar chart serves a specific function — it externalises the shape of fit at a glance. A balanced candidate reads as a near-octagonal polygon; a candidate with a fatal flaw reads as a polygon with a collapsed spike. The user recognises the pattern before reading the numbers. Bar charts are better for comparison; the radar is better for profile recognition.

The risk with radar charts — that they obscure magnitude — is mitigated by the dimension rows directly below, where every score is presented as an explicit number and bar. The radar is a visual summary, not the source of truth.

**Why not a card grid of scores?** Cards with numbers feel like a report card. The radar feels like a profile. Senior executives are pattern matchers — the shape gives them something to react to.

---

### 5.2 Edit-First, Not Preview-First

**Decision:** Generated materials land in editing mode by default, not a "preview" modal.

**Rationale:** The framing of "here is a preview" followed by "now edit" introduces a step and a psychological handoff that undermines ownership. If the user lands in editing mode, the implicit message is: this is your document, not the AI's document. The AI drafted it; you own it. This produces better engagement and better outputs — users who edit lightly produce better materials than users who treat generated content as final.

**Implication:** The editable area must look like a real document, not an AI output box. The light-on-white interior (inside the dark surrounding chrome) is deliberate — it signals "this is a document" not "this is a prompt response."

---

### 5.3 Job Context Header as a Persistent Rail

**Decision:** A 48px header row showing company and phase progress persists across Research, Fit, and Materials pages for the same job.

**Rationale:** Without this, the user has to mentally track "I'm looking at Airbox data" every time they navigate between phases. The context header serves as an anchor — it is the same across all three pages, so the user knows they are working on the same job without re-reading breadcrumbs.

**Why not a sidebar within the APPLY section?** A nested sidebar adds complexity and consumes horizontal space that the content needs. The 48px header is minimal but persistent.

---

### 5.4 Batch Mode is a Table, Not Cards

**Decision:** The batch results view is a table, not a grid of cards.

**Rationale:** The target user — running 4–8 active processes — needs to compare and prioritise. Cards spread information horizontally (you can only see one dimension at a time per card). A table shows all five key data points side by side, which is what comparisons require. Sortability is a natural affordance of tables; it would require an extra UI element on cards.

**Why not a kanban?** Kanban optimises for tracking state changes over time (e.g., "Applied → Interview scheduled → Offer"). The user's primary need at this stage is ranking and selecting, not workflow tracking. A sortable table serves that better.

---

### 5.5 Uncertain Claims vs Red Flags

**Decision:** Two distinct visual treatments for research and fit concerns.

**Rationale:** "Compensation range listed is below your floor" (red flag) and "Glassdoor reviews suggest high attrition — unverified" (uncertain claim) are different in kind. The first is a factual comparison; the second is a provenance concern. Treating both as warnings conflates certainty and uncertainty. The `~` prefix + italic + sage colouring for uncertain claims signals "worth noting, not confirmed" without alarming the user unnecessarily.

**WCAG note on italic text:** Italic body-sm `--sage` at 13px on `--card` background fails contrast at small sizes. The uncertain claim text therefore uses `--mist` at 80% opacity (effectively `rgba(240, 238, 232, 0.8)`) which passes AA for its use as supplementary information.

---

### 5.6 Auto-generate Tracking Note

**Decision:** The tracking note tab generates automatically when opened, without a user action.

**Rationale:** The tracking note is a byproduct of data that already exists (research summary, fit scores, user annotations, matched examples). There is no configuration needed, and no reason to gate it behind a "Generate" button. The user has done the work — the tracking note summarises it. Automatic generation signals "this is a service, not a form."

**Risk:** If auto-generation fails silently, the user sees an empty tab. Mitigate with: if generation takes > 3 seconds, show a `Loader2` spinner with "Compiling your tracking note...". If it errors, show the error state with a "Retry" link — never a blank tab.

---

### 5.7 Moving Job Match to APPLY

**Decision:** Job Match moves from BUILD to APPLY in the sidebar.

**Rationale:** Job Match requires a specific job to be useful. It is not a library-building activity — the user is not adding to their bank, they are evaluating a specific opportunity against their bank. The APPLY section now tells a coherent story: "I have a job. Let me match it, research the company, score my fit, and produce materials." Leaving Job Match in BUILD creates a structural lie — it implies building when the user is applying.

**Impact:** This is a one-line change in `AppSidebar.tsx`. Mirror loses one item from BUILD, but Upload + Example Bank + Mirror remain a coherent group (capture → organise → reflect).

---

## 6. Accessibility Baseline

### Semantic HTML Requirements (Phase 2 pages)

- Research landing: `<section aria-labelledby="research-heading">` wrapping the card list
- Research detail sections: `<section aria-labelledby="section-[name]-heading">` per research section
- Fit assessment: `<main>` with `<section aria-labelledby>` per major block (overview, dimensions, red flags)
- Dimension score list: `<ol>` (ordered — the sequence of dimensions is defined, not arbitrary)
- Red flags: `<ul>` (unordered), each flag `<li role="alert">` to announce to screen readers
- Materials tabs: shadcn `Tabs` component with `role="tablist"`, `role="tab"`, `role="tabpanel"` — already handled by shadcn
- Batch pipeline: `<ul aria-label="Pipeline progress">` with `aria-live="polite"` on the container (announces completions)
- Batch results table: `<table>` with `<thead>`, `<tbody>`, `<th scope="col">`, `<td>`. Not a div grid.
- Editable materials area: `role="textbox" aria-multiline="true"` on the contenteditable div

### ARIA

- JobContextHeader phase pills: `aria-current="page"` on active, `aria-label="[Phase] — [status]"` on each
- RadarChart: `aria-hidden="true"`, `<title>` and `<desc>` inside SVG
- DimensionScoreRow expand: `aria-expanded`, `aria-controls`
- Red flag dismiss: `aria-label="Dismiss flag: [title]"`
- BatchPipelineRow in-progress: `aria-busy="true"` on row container
- Batch results sort buttons: `aria-sort="ascending|descending|none"` on `<th>` elements
- MaterialsEditor autosave region: `aria-live="polite"`, `aria-atomic="true"`

### Keyboard Navigation

- Phase pills in JobContextHeader: Tab-navigable, Enter activates
- DimensionScoreRow expand: Space/Enter on the row or chevron
- Red flag dismiss: Tab-navigable, Enter/Space triggers dismiss confirmation
- Batch results table: standard table keyboard navigation; column sort on Enter/Space
- Materials tabs: Arrow keys navigate between tabs (shadcn default), Tab moves into tab panel
- ContentEditable area: Tab moves focus out of the editor (not inserts a tab character)

### Focus Management

- After batch job completes: focus stays on the pipeline panel (do not auto-move to table)
- After flag dismiss: focus moves to the next flag card, or to the "Red Flags" section heading if it was the last flag
- After "Copy to clipboard" in tracking note: focus stays on the copy button, aria-live announces "Copied"
- Modal dialogs (regenerate confirmation, tracking note editor): standard focus trap, return focus to trigger on close

### Touch Targets

All interactive elements maintain the existing 44×44px minimum from DESIGN.md. Specific attention to:
- DimensionScoreRow expand chevron: wrapped in a 44×44 invisible tap area
- Flag dismiss link: minimum 44px tap height (achieved via padding)
- Batch table action links: stacked vertically on mobile cards with 44px minimum height each

---

## 7. Icon Additions for Phase 2

All Lucide, `strokeWidth={1.5}`:

| Feature | Icon | Size in context |
|---------|------|----------------|
| Research nav | `Globe` | 18px (sidebar) |
| Fit Assessment nav | `BarChart3` | 18px (sidebar) |
| Materials nav | `FileOutput` | 18px (sidebar) |
| Batch nav | `Layers` | 18px (sidebar) |
| Company badge | `Building2` | 16px (context header), 18px (cards) |
| Fit progress bar | `BarChart3` | 14px (inline label) |
| Company hooks | `Sparkles` | 14px (cover letter panel) — reused from Mirror |
| Regenerate | `RefreshCw` | 14px (inline link) |
| Download PDF | `Download` | 16px (button icon) — reused from DESIGN.md |
| Copy text | `Copy` | 14px (inline link) — reused |
| Pipeline complete | `CheckCircle2` | 14px — reused |
| Pipeline error | `XCircle` | 14px — reused |
| Pipeline pending | (text bullet) | — |

---

## 8. Empty States (Phase 2)

| Page | Icon | Heading | Body | CTA |
|------|------|---------|------|-----|
| /research (no research) | `Globe` | "No company research yet" | "Paste a job listing to research the company before you apply." | "Research a company" (copper) |
| /fit (no assessments) | `BarChart3` | "No fit assessments yet" | "Research a company first, then run a fit assessment." | "Research a company" (copper) |
| /materials (no materials) | `FileOutput` | "No materials generated yet" | "Complete a fit assessment to generate tailored CV and cover letter." | "Start a fit assessment" (copper) |
| /batch (no results yet) | `Layers` | "Add listings to get started" | "Add 2–10 job listings to research and score them together." | — (form is the CTA) |
| Materials CV tab (not generated) | `FileText` | "No CV generated yet" | "We'll tailor your master CV to this role, drawing on your example bank." | "Generate CV for [company]" (amber) |
| Research — research failed | `AlertCircle` | "Research couldn't complete" | "Try again, or continue without research." | "Try again" + "Continue without research →" |

---

## 9. Amber Integration — Phase 2 Extensions

Amber continues to signal "what matters, what's active" in Phase 2:

- **Fit score (high tier, 70+):** mono amber number and bar fill
- **Active phase pill:** in the JobContextHeader, amber fill on active step
- **Radar chart data polygon:** amber fill + stroke (the user's actual fit shape)
- **Dimension scores (8–10/10):** amber text
- **Archetype badge:** amber border and text on the default badge
- **"Start Fit Assessment →" CTA:** amber button (not copper) — this is the most important action on the research detail page, warranting amber treatment
- **"Generate CV" CTA:** amber button — similarly, a phase-completing action
- **Batch pipeline: in-progress spinner:** `--amber`

Copper (`--primary`) remains the default CTA colour for actions that start a flow or navigate to a new area. Amber is reserved for phase-completing or high-value moments within a flow — the decisions that represent progress toward a prepared application.

---

*UX-PHASE2-APPLY.md — StoryBank Phase 2*
*Next step: Architect reviews information architecture (Section 1), data model requirements (new `jobs`, `research`, `fit_assessments`, `materials` tables), and confirms Phase 2 URL structure before engineer builds.*
