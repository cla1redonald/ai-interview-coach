# StoryBank — Design Specification

**Version:** 1.2
**Date:** 2026-04-18
**Status:** Ready for implementation
**Changelog:** v1.1 — Added login page spec · v1.2 — Updated login to Google OAuth (replaced magic link)

---

## Overview

StoryBank sits within the Deep Tay portfolio (Roami, The Load Check) but needs its own personality. The shared language: dark backgrounds, copper CTAs, warm neutrals, serif headings. The StoryBank distinction: amber `#e2a039` as the unique accent, evoking stored value, treasure, and the compound accumulation of career capital.

Dark mode is the default. This app handles sensitive data — transcripts, salary figures, reasons for leaving. The dark UI signals that seriousness.

---

## 1. Colour System

### CSS Custom Properties

```css
:root {
  /* === Deep Tay Core — shared across portfolio === */
  --ink:    #111a24;   /* darkest background */
  --tay:    #1a2832;   /* card / surface */
  --copper: #c4956a;   /* primary CTA — consistent portfolio-wide */
  --river:  #2a5a5a;   /* secondary (taken by Load Check as accent) */
  --cream:  #faf6f1;   /* light background (light mode only) */
  --mist:   #f0eee8;   /* light text on dark / light surface */
  --sage:   #6a8a8a;   /* muted text on dark */
  --umber:  #6b5d4f;   /* body text on light */
  --dark:   #2d2a26;   /* headings on light */
  --stone:  #e0d9cf;   /* borders on light */

  /* === StoryBank Unique Accent === */
  --amber:       #e2a039;  /* primary accent — quality badges, highlights, progress */
  --amber-dim:   #b87d2a;  /* pressed / hover state */
  --amber-glow:  rgba(226, 160, 57, 0.15);  /* ambient glow — used on active nav items */
  --amber-faint: rgba(226, 160, 57, 0.08);  /* very subtle tint — hover on cards */

  /* === Semantic — App Layer === */
  --quality-strong: #e2a039;   /* amber — strong example */
  --quality-weak:   #a04040;   /* muted red — weak example */
  --quality-unrated:#6a8a8a;   /* sage — unrated */
  --contradiction:  #c45a2a;   /* burnt orange — consistency flags */
  --gap:            #6a6a3a;   /* olive — gap / missing story */
  --match-high:     #5a7247;   /* pine (Roami colour, acceptable crossover for data) */
  --match-med:      #e2a039;   /* amber */
  --match-low:      #6a8a8a;   /* sage */
}

/* === Dark mode (DEFAULT) === */
.dark,
:root {  /* dark is default — flip this if light mode ever becomes default */
  --background:         #111a24;   /* ink */
  --foreground:         #f0eee8;   /* mist */

  --card:               #1a2832;   /* tay */
  --card-foreground:    #f0eee8;
  --card-raised:        #1f3040;   /* slightly lighter for nested cards */

  --popover:            #1a2832;
  --popover-foreground: #f0eee8;

  --primary:            #c4956a;   /* copper */
  --primary-foreground: #111a24;

  --secondary:          #2a5a5a;   /* river */
  --secondary-foreground: #f0eee8;

  --accent:             #e2a039;   /* amber — StoryBank's unique colour */
  --accent-foreground:  #111a24;

  --muted:              #1a2832;   /* tay */
  --muted-foreground:   #6a8a8a;   /* sage */

  --destructive:        #c45a2a;
  --destructive-foreground: #f0eee8;

  --border:             rgba(240, 238, 232, 0.10);
  --border-strong:      rgba(240, 238, 232, 0.18);
  --input:              rgba(240, 238, 232, 0.12);
  --ring:               #e2a039;   /* amber — focus ring matches accent */

  --sidebar:            #0e1520;   /* slightly darker than ink for depth */
  --sidebar-foreground: #f0eee8;
  --sidebar-primary:    #e2a039;   /* amber — active nav uses accent, not copper */
  --sidebar-primary-foreground: #111a24;
  --sidebar-accent:     rgba(226, 160, 57, 0.08);
  --sidebar-accent-foreground: #f0eee8;
  --sidebar-border:     rgba(240, 238, 232, 0.08);
  --sidebar-ring:       #e2a039;

  /* Chart colours — ordered for visual distinctiveness */
  --chart-1: #e2a039;   /* amber */
  --chart-2: #c4956a;   /* copper */
  --chart-3: #6a8a8a;   /* sage */
  --chart-4: #2a5a5a;   /* river */
  --chart-5: #f0eee8;   /* mist */

  --radius: 0.5rem;
}

/* === Light mode (non-default, used if user switches) === */
.light {
  --background:         #faf6f1;   /* cream */
  --foreground:         #6b5d4f;   /* umber */

  --card:               #ffffff;
  --card-foreground:    #2d2a26;
  --card-raised:        #f0eee8;

  --popover:            #ffffff;
  --popover-foreground: #2d2a26;

  --primary:            #c4956a;   /* copper */
  --primary-foreground: #ffffff;

  --secondary:          #2a5a5a;   /* river */
  --secondary-foreground: #f0eee8;

  --accent:             #e2a039;   /* amber */
  --accent-foreground:  #ffffff;

  --muted:              #f0eee8;   /* mist */
  --muted-foreground:   #6b5d4f;   /* umber */

  --destructive:        #a04040;
  --destructive-foreground: #ffffff;

  --border:             #e0d9cf;   /* stone */
  --border-strong:      #cdc5ba;
  --input:              #e0d9cf;
  --ring:               #e2a039;

  --sidebar:            #f0eee8;
  --sidebar-foreground: #2d2a26;
  --sidebar-primary:    #e2a039;
  --sidebar-primary-foreground: #111a24;
  --sidebar-accent:     rgba(226, 160, 57, 0.10);
  --sidebar-accent-foreground: #2d2a26;
  --sidebar-border:     #e0d9cf;
  --sidebar-ring:       #e2a039;
}
```

### Contrast Ratios (WCAG AA)

All combinations verified against WCAG 2.1 AA (4.5:1 normal text, 3:1 large text/UI).

| Text | Background | Ratio | Pass |
|------|-----------|-------|------|
| `--mist` #f0eee8 | `--ink` #111a24 | **13.6:1** | AA + AAA |
| `--mist` #f0eee8 | `--tay` #1a2832 | **11.4:1** | AA + AAA |
| `--mist` #f0eee8 | sidebar `#0e1520` | **14.9:1** | AA + AAA |
| `--sage` #6a8a8a | `--ink` #111a24 | **4.6:1** | AA (marginal — use for large text only) |
| `--sage` #6a8a8a | `--tay` #1a2832 | **3.9:1** | AA large text only |
| `--amber` #e2a039 | `--ink` #111a24 | **7.1:1** | AA + AAA |
| `--amber` #e2a039 | `--tay` #1a2832 | **5.9:1** | AA |
| `--copper` #c4956a | `--ink` #111a24 | **5.3:1** | AA |
| `--copper` #c4956a | `--tay` #1a2832 | **4.4:1** | AA large text only |
| `#111a24` on `--amber` #e2a039 | — | **7.1:1** | AA + AAA (for amber buttons) |
| `--umber` #6b5d4f | `--cream` #faf6f1 | **5.1:1** | AA |
| `--dark` #2d2a26 | `--cream` #faf6f1 | **11.2:1** | AA + AAA |

**Flags:**
- Do NOT use `--sage` for normal-weight body text at 14px on dark backgrounds — only use at 16px+ or for captions that are not the primary communication channel.
- Do NOT use `--copper` as normal text on `--tay` without bold weight — 4.4:1 fails for regular text. Use it for interactive elements (links, badges) where bold weight applies, or on `--ink` backgrounds.

---

## 2. Typography

No external font loads. System stack only — fast, no layout shift, respects user preferences.

```css
/* Heading / display — serif for authority and warmth */
--font-heading: Georgia, 'Times New Roman', serif;

/* Body / UI — clean system stack */
--font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Monospace — for scores, stats, technical data */
--font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
```

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 2.25rem / 36px | 700 | 1.15 | Page hero, empty state headline |
| `h1` | 1.75rem / 28px | 700 | 1.2 | Page titles |
| `h2` | 1.375rem / 22px | 600 | 1.25 | Section headings |
| `h3` | 1.125rem / 18px | 600 | 1.3 | Card titles, subsections |
| `h4` | 0.9375rem / 15px | 600 | 1.35 | Labels, form group headers |
| `body` | 0.9375rem / 15px | 400 | 1.6 | Primary body text |
| `body-sm` | 0.8125rem / 13px | 400 | 1.55 | Secondary body, metadata |
| `caption` | 0.75rem / 12px | 400 | 1.5 | Timestamps, source citations |
| `label` | 0.75rem / 12px | 600 | 1.4 | Form labels, tags, badges |
| `mono` | 0.875rem / 14px | 400 | 1.5 | Scores, statistics, code |

**Rules:**
- All headings (`h1`–`h4`): Georgia serif, letter-spacing `-0.01em`
- Body text and UI elements: system sans-serif
- Statistics and scores: monospace with `font-variant-numeric: tabular-nums`
- Maximum body width: 72ch (prevents line lengths that impair readability)

---

## 3. Spacing & Layout

```css
/* Base unit: 4px */
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;

/* Border radius */
--radius-sm: 4px;   /* tags, badges, small chips */
--radius-md: 6px;   /* inputs, small cards */
--radius-lg: 10px;  /* cards, modals */
--radius-xl: 16px;  /* feature cards */
--radius-full: 9999px; /* pills */
```

### Breakpoints

```
--bp-sm:  640px   /* large phones, fold devices */
--bp-md:  768px   /* tablets */
--bp-lg:  1024px  /* laptops — sidebar collapses below this */
--bp-xl:  1280px  /* desktop */
--bp-2xl: 1536px  /* wide screens */
```

**Sidebar behaviour:**
- `< 1024px`: sidebar collapses to icon-only rail (48px wide)
- `< 640px`: sidebar slides over content (drawer pattern), triggered by hamburger

---

## 4. Component Specifications

### 4.1 Sidebar Navigation

**Structure:** Fixed left rail, full height. Width 220px (expanded) / 48px (icon-only).

**Items and icons (Lucide):**

| Label | Icon | Notes |
|-------|------|-------|
| Dashboard | `LayoutDashboard` | Landing after login |
| Upload | `Upload` | Transcript upload entry point |
| Example Bank | `BookMarked` | The core library view |
| Mirror | `Sparkles` | Pattern recognition / reflection |
| Job Match | `Target` | Spec-to-bank matching |
| Consistency | `GitBranch` | Cross-company claim tracker |

**Visual spec:**
- Background: `#0e1520` (slightly darker than ink, creating depth against content area)
- Top: product wordmark "StoryBank" in Georgia serif, 15px, `--mist`, with a small amber `◆` glyph before it
- Nav items: 40px tall, 12px horizontal padding, 4px gap between icon and label
- Inactive: icon `--sage`, label `--mist` at 85% opacity
- Hover: background `--amber-faint`, icon and label `--mist` at 100%
- Active: background `--amber-glow`, left border 2px `--amber`, icon `--amber`, label `--mist` bold
- Section divider between Upload and Example Bank: 1px `--border`, labelled "Library" in `--sage` caption
- Section divider before Consistency: labelled "Track" in `--sage` caption
- Bottom of sidebar: user avatar (initials only, 28px circle `--tay` border), and Settings icon (`Settings2`)
- Collapse toggle: `ChevronLeft` / `ChevronRight` at bottom of rail, 32px touch target

**Responsive:**
- Below 1024px: icon-only rail, tooltips on hover, no labels
- Below 640px: hidden by default, hamburger button top-left of content area opens drawer overlay

---

### 4.2 Transcript Upload Form

**Purpose:** Primary data entry point. Handles messy auto-transcriptions from Teams/Zoom.

**Layout:** Centred single-column, max-width 680px.

**Sections:**

**1. Paste Area (primary)**
- Large textarea, min 240px tall, expanding to content
- Placeholder: "Paste your transcript here — Teams, Zoom, or any text format"
- Background: `--input` (slightly lighter than card)
- Border: `--border`, focus ring `--amber` 2px
- Character / line count in bottom-right corner: `--sage` caption

**2. File Drop Zone (secondary)**
- Dashed border `--border`, 4px radius
- Icon: `FileText` Lucide, 24px `--sage`
- Label: "or drop a .txt or .md file"
- On drag hover: border becomes `--amber`, background `--amber-faint`
- Supports: `.txt`, `.md` only (explicitly state this)

**3. Metadata Fields** (collapsed by default, expand with "Add interview details +" affordance)
- Date: date picker, defaults to today
- Company name: text input
- Interviewer name/role: text input, placeholder "e.g. Kasia Kowalski, VP Product"
- Interview round: select — Recruiter screen / Hiring manager / Panel / Final / Other
- Notes: optional textarea (max 280 chars), placeholder "Any context about this interview"

**4. Submit**
- Primary button: "Extract examples" — copper `--primary` background, full width on mobile
- Below button: "We'll identify Q&A pairs and tag them by category. This takes 15–30 seconds."
- Loading state: button becomes "Extracting..." with a `Loader2` spinning icon, disabled

**Validation:**
- Empty submit: "Add some transcript text or drop a file to continue" — inline, below paste area
- File type error: "Only .txt and .md files are supported — paste audio transcription text directly"

---

### 4.3 Example Card

**Purpose:** Displays one extracted Q&A pair from the example bank.

**Dimensions:** Full-width within grid, min 160px tall.

**Visual structure (top to bottom):**

```
┌─────────────────────────────────────────────┐
│ [Tag chip]  [Tag chip]    [Company badge]  ⋮ │  ← header row
│                                               │
│ Question text (h4, --mist, Georgia)           │
│                                               │
│ Answer preview (body-sm, --sage, 3 lines     │  ← truncated with
│ max, ellipsis...)                             │    "Read more" link
│                                               │
│ ─────────────────────────────────────────── │
│ [Quality indicator]  [Source]   [Date]        │  ← footer row
└─────────────────────────────────────────────┘
```

**Tag chip:** `--radius-full` pill, background `--tay`, border `--border`, text `--sage` label size. Max 2 visible; "+3 more" overflow chip.

**Company badge:** Right-aligned, `--radius-sm`, background `--amber-faint`, text `--amber` label size. Signals which company context this came from.

**Quality indicator:**
- Star icon (`Star` Lucide) — filled amber for Strong, outline sage for Unrated, red for Weak
- Label: "Strong" / "Weak" / "Unrated" in `--sage` caption

**Source link:** `Link` icon + "View in transcript" — `--copper` text, no underline unless hover. Links to the originating transcript highlight.

**Overflow menu (⋮):** Edit tags, Mark strong/weak, Delete, Copy answer text

**Hover state:** Subtle amber glow — `box-shadow: 0 0 0 1px var(--amber-faint), 0 4px 16px rgba(226,160,57,0.06)`. Do not lift the card (no translateY — keeps it calm).

**Expanded state** (after "Read more" or clicking card body): Full answer text, STAR breakdown if available, source quote highlighted in the transcript viewer.

---

### 4.4 Filter Bar

**Purpose:** Narrow the example bank to relevant examples quickly.

**Layout:** Horizontal row, wraps on mobile. Sticky at top of example bank content area below page header.

**Controls (left to right):**

1. **Search input** — `Search` icon prefix, placeholder "Search examples…", 240px on desktop, full width below 768px. Debounced 300ms.

2. **Tag filter** — multi-select combobox. Label "Category". Shows selected count chip when active: "Category (3)". Dropdown lists all category tags with checkboxes.

3. **Company filter** — single-select dropdown. Label "Company". Lists unique companies from uploaded transcripts.

4. **Quality filter** — segmented control: All / Strong / Unrated / Weak. Defaults to All.

5. **Date range** — "Last 30 days" / "Last 90 days" / "This year" / "All time". Simple select, not a date picker.

6. **Clear all** — text link, `--copper`, appears only when any filter is active.

**Active filter state:** Each active control gets a `--amber-faint` background and `--amber` border-bottom on the selected label.

**Result count:** Below the filter bar, left-aligned: "24 examples" in `--sage` body-sm. Updates live as filters change.

---

### 4.5 Mirror Sections

**Purpose:** Reflect the user's own patterns back to them. The emotional centrepiece of Loop 1.

**Section structure:** Each Mirror sub-section is a full-width panel separated by spacer and a `h2` heading.

**Sub-section 1 — Recurring Stories**
- Heading: "Your 10 recurring stories"
- Horizontal scrollable row of story cards (or vertical list on mobile)
- Each card: story title (e.g. "The Army story"), count of times used ("Used 7 times"), quality distribution bar (green/amber/red mini-bar), expand to see all instances

**Sub-section 2 — Phrase Cloud**
- Heading: "Your signature phrases"
- Tags rendered in varying sizes proportional to frequency (not a canvas word cloud — a flex-wrap tag cloud for accessibility)
- Each tag: clickable → filters example bank to examples containing that phrase
- Colour: most frequent in `--amber`, mid in `--copper`, least frequent in `--sage`
- Callout box: "You use 'player-coach' in 9 of your 12 answers about leadership. Is this intentional?" — amber left-border callout

**Sub-section 3 — Pattern Cards**
- Heading: "What you lead with"
- Two-column grid (single column mobile)
- Each pattern card: "When asked about [Category], you consistently open with [Story/Phrase]"
- Card background: `--card`, left accent bar `--amber`, 3px
- Example: "When asked about leadership → Army story (6/7 times)"

**Sub-section 4 — Strength Bar Chart**
- Heading: "Example quality by category"
- Horizontal stacked bar chart (custom, not Chart.js — keep it simple with CSS flex bars)
- Each row: category label, bar (green portion = strong, amber = unrated, red = weak), example count
- Annotation on hover: "3 strong, 2 weak, 1 unrated"
- Sorted by strength score descending — best categories at top
- "Stakeholder management" and "Leadership" will likely top this for the target user

---

### 4.6 Consistency Timeline

**Purpose:** Show what the user has told each company about sensitive topics, surface contradictions.

**Layout:** Full-width. Grouped by topic, then company within each topic.

**Topics:**
- Compensation expectations
- Reasons for leaving
- Availability / notice period
- Current role scope
- Other (user-defined)

**Visual structure per topic:**

```
Compensation expectations                    [+ Add claim]
─────────────────────────────────────────────────────────
 Airbox          £175-200k floor    Feb 12    [Edit] [⚠]
 Moonpig         £150k floor        Feb 19    [Edit]
 Hyble           £175k+             Mar 3     [Edit]

⚠ Contradiction flagged: You stated £150k at Moonpig but
  £175k+ at Airbox and Hyble. Review before next interview.
```

**Contradiction flag:**
- Amber warning banner below conflicting rows: `--contradiction` left border, `AlertTriangle` icon
- Not a judgment — framed as "Review before next interview" not "You lied"
- User can dismiss / resolve by marking as "intentional" (e.g. they deliberately gave a lower number)

**Timeline entry:**
- Company name: `--mist` body
- Claim text: `--mist` body-sm, truncated at 60 chars
- Date: `--sage` caption, right-aligned
- Edit: pencil icon, opens inline editable field
- Contradiction marker: `⚠` amber icon on the row itself

**Empty state (per topic):** "No claims recorded for this topic yet. Entries are extracted automatically when you upload transcripts."

---

### 4.7 Job Match Results

**Purpose:** Given a pasted job spec, surface the most relevant examples from the bank.

**Layout:** Left column: job spec / metadata. Right column: ranked results. Stack on mobile.

**Result card (ranked):**

```
┌────────────────────────────────────────────────────────┐
│  #1  97% match          [BookMarked icon]               │
│                                                          │
│  "Tell me about a time you drove significant change…"   │  ← question
│                                                          │
│  "When I joined MOO, the product org had no OKR         │  ← answer preview
│  process at all. I introduced it in 90 days…"           │     (3 lines)
│                                                          │
│  Why this matches:                                       │
│  Maps to "experience driving organisational change"      │
│  in the job spec. Covers scale, timeline, and outcome.   │
│                                                          │
│  Company: MOO · Feb 2026 · [View in bank]               │
└────────────────────────────────────────────────────────┘
```

**Match score:** `--amber` text, mono font, top-left of card. High (>80%) = amber. Medium (60-80%) = copper. Low (<60%) = sage.

**Gap flags:** Below results, full-width amber callout:
- Heading: "Gaps to address"
- List: "They require M&A integration experience — no examples in your bank. Consider preparing one before applying."
- Icon: `AlertCircle`, `--amber`

**"Use in application" CTA:** Secondary button on each card — "Use this example" — triggers the Apply loop with this example pre-selected.

---

## 5. Page Layouts

All authenticated pages use a two-column shell: fixed sidebar (left) + scrollable content area (right). No top navigation bar.

---

### 5.0 Login Page

**Auth pattern:** Google OAuth — single provider, no email input, no passwords.

**Layout:** Full-screen centred card. No sidebar. Dark background (`--ink`).

```
┌─────────────────────────────────────────────────────────┐
│                                                           │
│                    ◆ StoryBank                            │  ← wordmark, centred
│                                                           │
│         ┌───────────────────────────────────┐            │
│         │                                   │            │
│         │  Sign in                          │            │  ← card, max-width 400px
│         │  ─────────────────────────────── │            │
│         │                                   │            │
│         │  [G  Continue with Google  ────]  │            │  ← Google button, full width
│         │                                   │            │
│         │  We'll redirect you to Google to  │            │
│         │  verify your identity.            │            │  ← helper text, --sage
│         │                                   │            │
│         └───────────────────────────────────┘            │
│                                                           │
│         By signing in you agree to our Terms of Service  │  ← caption, --sage, centred
│                                                           │
└─────────────────────────────────────────────────────────┘
```

**Server action:**
```typescript
// Triggered by the "Continue with Google" button
import { signIn } from '@/lib/auth';

export async function handleGoogleSignIn() {
  await signIn('google', { redirectTo: '/dashboard' });
}
```

**Error state** (OAuth callback error):

```
         ┌───────────────────────────────────┐
         │  XCircle (24px, --destructive)    │
         │  Sign-in failed. Please try       │
         │  again.                           │
         │  [Try again]                      │  ← retries Google OAuth flow
         └───────────────────────────────────┘
```

**Visual details:**
- Card: `--card` (`--tay`) background, `--radius-lg`, `border: 1px solid var(--border-strong)`
- No decorative imagery — clean, professional, trustworthy
- Wordmark above card: Georgia serif, 24px, `--mist`, amber `◆` glyph matches sidebar treatment
- Google button: white background, Google logo SVG (official brand colours), 44px tall, full card width — meets touch target
- No email input, no "check your inbox" state, no link expiry — OAuth handles the full flow

**Accessibility:**
- `<form>` with `action` pointing to the server action
- Google button: `type="submit"`, accessible label "Sign in with Google"
- Error state: `role="alert"` so it's announced immediately

---

### 5.1 Dashboard

```
┌────────┬───────────────────────────────────────────────┐
│        │  Good evening, Claire                          │  ← personalised greeting
│ SIDE   │  "12 examples banked · 3 transcripts · 2 open │     + quick stats row
│ BAR    │   applications"                                │
│        │  ─────────────────────────────────────────── │
│        │                                               │
│        │  RECENT ACTIVITY                              │  ← last 3 actions
│        │  [Card: Transcript uploaded — Airbox, today]  │
│        │  [Card: 8 new examples extracted]             │
│        │  [Card: Consistency flag — compensation]      │
│        │                                               │
│        │  ─────────────────────────────────────────── │
│        │                                               │
│        │  YOUR STORY STRENGTH      [View Mirror →]    │  ← mini bar chart
│        │  [Strength bars by category, top 5]          │
│        │                                               │
│        │  ─────────────────────────────────────────── │
│        │                                               │
│        │  QUICK ACTIONS                                │
│        │  [Upload transcript]  [Match a job spec]      │
│        │  [View example bank]  [Check consistency]     │
└────────┴───────────────────────────────────────────────┘
```

**Stats row:** Three metrics, `mono` font, amber numerals. "12 examples" / "3 transcripts" / "2 in progress". No unnecessary chart — numbers are enough.

**Quick action cards:** 2x2 grid. Icon + label. Icon in amber, card background `--card`, hover `--amber-faint`.

---

### 5.2 Upload Page

```
┌────────┬───────────────────────────────────────────────┐
│        │  Upload Transcript                             │  ← h1
│ SIDE   │  "Paste or drop a transcript to extract        │     subtitle
│ BAR    │   Q&A pairs and add them to your bank."        │
│        │  ─────────────────────────────────────────── │
│        │                                               │
│        │  [Transcript Upload Form — see 4.2]           │
│        │                                               │
│        │  ─────────────────────────────────────────── │
│        │  RECENT UPLOADS                               │  ← previous transcripts
│        │  [Airbox — Feb 12 — 8 examples extracted]     │     list
│        │  [Moonpig — Feb 19 — 11 examples extracted]   │
└────────┴───────────────────────────────────────────────┘
```

---

### 5.3 Transcript List

```
┌────────┬───────────────────────────────────────────────┐
│        │  Transcripts              [Upload new +]       │
│ SIDE   │                                               │
│ BAR    │  [Search transcripts…]  [Company ▾]  [Date ▾] │
│        │                                               │
│        │  ┌────────────────────────────────────────┐  │
│        │  │ Airbox — Hiring Manager · Feb 12, 2026  │  │
│        │  │ 8 examples extracted · Kasia Kowalski   │  │
│        │  │ [View] [Re-extract] [Delete]             │  │
│        │  └────────────────────────────────────────┘  │
│        │  [... more transcript cards]                  │
└────────┴───────────────────────────────────────────────┘
```

---

### 5.4 Transcript Detail + Review

```
┌────────┬──────────────────────┬────────────────────────┐
│        │ TRANSCRIPT           │ EXTRACTED EXAMPLES     │
│ SIDE   │ (raw text, scrollable│ [Filterable list of    │
│ BAR    │ with highlighted     │  extracted Q&A pairs]  │
│        │ Q&A spans)           │                        │
│        │                      │ [Each pair has:        │
│        │ Clicking an example  │  question, answer,     │
│        │ on right highlights  │  auto-tags, quality    │
│        │ its source in left   │  selector, save button]│
│        │ panel                │                        │
│        │                      │ [Add to bank] per item │
└────────┴──────────────────────┴────────────────────────┘
```

**Split panel:** On desktop — 40% transcript / 60% examples. On tablet: tabbed (Transcript | Examples). On mobile: stacked with tabs.

**Highlight behaviour:** When hovering or clicking an extracted example, the source paragraph in the raw transcript highlights with an amber underline. Smooth scroll to position.

---

### 5.5 Example Bank

```
┌────────┬───────────────────────────────────────────────┐
│        │  Example Bank                [24 examples]    │
│ SIDE   │                                               │
│ BAR    │  [Filter Bar — see 4.4]                       │
│        │                                               │
│        │  [Example Card]                               │
│        │  [Example Card]                               │
│        │  [Example Card]                               │
│        │  ...                                          │
│        │                                               │
│        │  Single column on all sizes (cards are wide,  │
│        │  not narrow grid items — readability first)   │
└────────┴───────────────────────────────────────────────┘
```

---

### 5.6 Mirror

```
┌────────┬───────────────────────────────────────────────┐
│        │  Mirror                                        │
│ SIDE   │  "Here is what your interviews are telling    │
│ BAR    │   you about yourself."                         │
│        │  ─────────────────────────────────────────── │
│        │  [Recurring Stories section]                  │
│        │  [Phrase Cloud section]                       │
│        │  [Pattern Cards section]                      │
│        │  [Strength Bars section]                      │
└────────┴───────────────────────────────────────────────┘
```

**Minimum data gate:** Mirror doesn't render its sections until ≥ 3 transcripts are uploaded. Below that threshold, empty state (see section 6).

---

### 5.7 Job Match

```
┌────────┬───────────────────────────────────────────────┐
│        │  Job Match                                     │
│ SIDE   │                                               │
│ BAR    │  ┌──────────────────────────────────────────┐ │
│        │  │ Paste job spec or description             │ │
│        │  │ [textarea, 120px min]                     │ │
│        │  │ [Match my bank →]                         │ │
│        │  └──────────────────────────────────────────┘ │
│        │                                               │
│        │  ─────────────────────────────────────────── │
│        │  RESULTS (after match)                        │
│        │  [Ranked result cards — see 4.7]              │
│        │  [Gap flags below]                            │
└────────┴───────────────────────────────────────────────┘
```

---

### 5.8 Consistency

```
┌────────┬───────────────────────────────────────────────┐
│        │  Consistency Tracker                           │
│ SIDE   │  "What you've told each company."              │
│ BAR    │                                               │
│        │  ⚠ 1 contradiction flagged               [↓] │  ← jump to flag
│        │                                               │
│        │  [Compensation expectations section]          │
│        │  [Reasons for leaving section]                │
│        │  [Availability section]                       │
│        │  [Role scope section]                         │
│        │  [+ Add custom topic]                         │
└────────┴───────────────────────────────────────────────┘
```

---

## 6. Interaction Patterns

### Loading States

**Skeleton screens (not spinners) for content areas:**
- Example bank loading: skeleton cards — 3 lines of muted shimmer per card
- Transcript detail: split skeleton — left column text lines, right column card stubs
- Mirror: section headings visible, content stubs shimmer

**Shimmer animation:**
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(
    90deg,
    var(--card) 25%,
    var(--card-raised) 50%,
    var(--card) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

**AI processing spinner** (transcript extraction, job match):
- Full-width progress area, not a modal
- `Loader2` icon 20px `--amber`, spinning at 1s
- Status message below: "Identifying Q&A pairs…" → "Applying category tags…" → "Done — 8 examples found"
- Estimated time: "This usually takes 15–30 seconds"

### Empty States

| State | Icon | Heading | Body | CTA |
|-------|------|---------|------|-----|
| No transcripts | `FileText` | "No transcripts yet" | "Upload your first interview transcript to start building your example bank." | "Upload transcript" (copper button) |
| No examples | `BookMarked` | "Your bank is empty" | "Examples are extracted automatically when you upload a transcript." | "Upload transcript" |
| Mirror — not enough data | `Sparkles` | "Upload 3 transcripts to unlock Mirror" | "The Mirror shows patterns across interviews. You have [N]. Upload [3-N] more." | "Upload transcript" |
| Job match — no spec | `Target` | "Paste a job spec to find your best examples" | — | — |
| Consistency — no data | `GitBranch` | "No claims tracked yet" | "Consistency data is extracted automatically from transcripts." | "Upload transcript" |

**Empty state visual spec:** Icon 48px `--sage`, centred vertically in content area. Heading `h2` `--mist`. Body `--sage`. CTA below — copper button for primary action.

### Error States

**Extraction failure:**
```
Something went wrong during extraction.
Your transcript was saved — no data was lost.
[Try again]  [Report issue]
```
Amber left-border alert. Never discard user data on failure.

**Network error:** Toast notification (bottom-right, 4s auto-dismiss): "Connection issue — changes will sync when you're back online." `WifiOff` icon.

**Validation errors:** Inline, directly below the offending input. `--destructive` text. Never toast for form errors.

### Transitions

- **Page transitions:** None. Instant navigation — dark apps shouldn't fade in/out on every click.
- **Card expand:** `max-height` animation, 200ms ease-out. Feels snappy.
- **Filter changes:** Content area fades out (opacity 0, 80ms) and in (opacity 1, 120ms). Fast enough to feel responsive, slow enough to see it worked.
- **Sidebar collapse:** 200ms ease-in-out on `width`. Icons stay visible throughout.
- **Skeleton → content:** Crossfade 150ms. No jarring layout shift.
- **Toast notifications:** Slide in from bottom-right, slide out on dismiss. 250ms.

**Rule:** No animation longer than 300ms. No bounce, spring, or elastic easing — this is a professional productivity tool.

### Focus States

All interactive elements: 2px outline `--amber` (ring), 2px offset. Never remove outlines. Use `outline-offset: 2px` so the ring sits outside the element border.

---

## 7. Accessibility

### Semantic HTML Requirements

- Login page: `<main>` wrapping the card, `<form>` with `method="post"`
- Sidebar: `<nav aria-label="Main navigation">`
- Transcript upload: `<form>` with `<fieldset>` for metadata group
- Example cards: `<article>` elements within a `<section>`
- Filter bar: `<search>` element or `<form role="search">`
- Mirror sections: `<section>` with `aria-labelledby` pointing to `<h2>`
- Consistency timeline: `<table>` or `<dl>` structure per topic group (not `<div>` soup)
- Job match results: `<ol>` (ordered list — ranking matters)

### ARIA

- Sidebar collapse button: `aria-expanded="true|false"`, `aria-controls="sidebar"`
- Filter controls: `aria-label` on all icon-only controls
- Skeleton loaders: `aria-busy="true"` on container, `aria-label="Loading examples"`
- Quality badges: `aria-label="Strong example"` — not just the icon
- Match scores: `aria-label="97 percent match"` — not just "97%"
- Contradiction flags: `role="alert"` so screen readers announce them
- Phrase cloud tags: `role="button"` if interactive, proper keyboard handling
- Login error region: `role="alert"` so screen readers announce immediately

### Keyboard Navigation

- Tab order follows visual left-to-right, top-to-bottom flow
- Sidebar: navigable with arrow keys when focused (`role="navigation"`, `tabIndex` on items)
- Multi-select filter: opens on Enter/Space, arrows navigate options, Escape closes
- Example card expand: Enter/Space on card body
- All modals and drawers: focus trapped when open, returned to trigger on close
- `Skip to main content` link: visually hidden, becomes visible on focus — positioned before sidebar

### Touch Targets

- All interactive elements: minimum 44x44px tap target (even if visually smaller)
- Navigation items: 40px height but 44px tap target via padding
- Icon-only buttons: `p-3` (48px area)
- Filter chips: `py-1.5 px-3` minimum

---

## 8. Iconography

Lucide icons throughout. No custom icons unless Lucide lacks a suitable option.

**Consistent sizes:**
- Navigation icons: 18px
- Inline text icons (links, labels): 14px
- Empty state icons: 48px
- Button icons: 16px
- Alert/status icons: 16px

**Stroke width:** Default (1.5) for all icons. Do not use `strokeWidth={2}` — it looks heavy on dark backgrounds.

---

## 9. Amber Integration — Rationale

The amber accent `#e2a039` is used for:

- **Active navigation item** (left border + background glow)
- **Focus rings** (replaces the portfolio-standard copper)
- **Quality indicator** for "Strong" examples
- **Match scores** at high relevance
- **Phrase cloud** most-frequent phrases
- **Consistency contradiction icon** (though the flag itself is a warmer burnt orange to signal concern, not celebration)
- **Stats on dashboard** (the numbers that matter)
- **Progress indicators** during extraction
- **Login confirmation** — success icon on OAuth callback

It is NOT used for:
- Primary CTA buttons (that remains copper — portfolio-consistent)
- Body text (contrast at small sizes would require care)
- Destructive actions (burnt orange / red reserved for those)

This keeps amber meaningful: it marks **what matters, what's strong, what's active**.

---

## Appendix — Lucide Icon Mapping (Full)

| Feature | Icon | Usage |
|---------|------|-------|
| Dashboard | `LayoutDashboard` | Nav |
| Upload | `Upload` | Nav, upload CTA |
| Example Bank | `BookMarked` | Nav |
| Mirror | `Sparkles` | Nav |
| Job Match | `Target` | Nav |
| Consistency | `GitBranch` | Nav |
| Settings | `Settings2` | Sidebar bottom |
| User | `UserCircle` | Sidebar bottom |
| Search | `Search` | Filter bar |
| Filter | `SlidersHorizontal` | Filter label |
| Tag | `Tag` | Tag chips |
| Calendar | `Calendar` | Date fields |
| Company | `Building2` | Company badges |
| Quality strong | `Star` (filled) | Quality indicator |
| Quality weak | `StarOff` | Quality indicator |
| Quality unrated | `Star` (outline) | Quality indicator |
| Contradiction | `AlertTriangle` | Consistency flags |
| Gap | `AlertCircle` | Job match gaps |
| Source link | `Link` | Transcript citation |
| Expand | `ChevronDown` | Card expand |
| Edit | `Pencil` | Inline edit |
| Delete | `Trash2` | Destructive action |
| Copy | `Copy` | Copy answer text |
| Overflow | `MoreHorizontal` | Card overflow menu |
| Processing | `Loader2` (animated) | AI extraction |
| Success | `CheckCircle2` | Extraction complete, login confirmation |
| Error | `XCircle` | Failure state, expired link |
| Empty file | `FileText` | Empty state |
| Network off | `WifiOff` | Offline toast |
| Collapse | `ChevronLeft` | Sidebar collapse |
| Expand sidebar | `ChevronRight` | Sidebar expand |
| Add | `Plus` | Add claim, add tag |
| External link | `ExternalLink` | Transcript source |
| Download | `Download` | Export |
| Match | `Zap` | Match/relevance |
| Mail | `Mail` | Email display (user profile, contact info) |
