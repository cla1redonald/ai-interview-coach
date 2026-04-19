# StoryBank Phase 2 — Product Specification (APPLY Loop)

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Ready for engineer
**Author:** @pm
**Depends on:** ARCHITECTURE-PHASE2.md v1.0, UX-PHASE2-APPLY.md v1.0, ARCHITECTURE.md v2.1

---

## Overview

This document is the executable build spec for Phase 2. It translates the architecture and UX specs into acceptance criteria, resolves conflicts between them, answers open questions, and breaks the work into parallelisable build threads.

Read this document alongside the two source specs. Where this document conflicts with them, this document takes precedence — it reflects decisions made after reviewing both specs together.

---

## Part 1 — Resolved Conflicts and Gap Decisions

Before reading the ACs, understand these six cross-spec decisions. The engineer must follow these, not the underlying specs where they differ.

### Decision 1: URL Structure

**Conflict:** ARCHITECTURE-PHASE2 routes through `/api/applications/[id]/research` and `/api/applications/[id]/assess`. UX-PHASE2 routes the UI through `/research/[id]`, `/fit/[id]`, `/materials/[id]` as separate top-level paths sharing a `job_id`.

**Decision:** Keep both patterns — they serve different purposes and do not conflict.

- **API routes** follow the architecture spec: `/api/applications/[id]/research`, `/api/applications/[id]/assess`, `/api/applications/[id]/materials`. The `job_application` is the central entity on the server.
- **UI routes** follow the UX spec: `/research/[id]`, `/fit/[id]`, `/materials/[id]`. The `[id]` in each is the same `job_application.id`. This satisfies the UX "one thread per job" requirement while keeping the API clean.
- **No `/applications` list page** in Phase 2 UI — the Research, Fit, and Materials landing pages each serve as their own list. Batch Mode is the cross-cutting view.

### Decision 2: Batch Input Paradigm

**Conflict:** The architecture describes a markdown textarea (`## Heading` per listing) as the batch input format. The UX describes individual URL/text input rows with add/remove controls.

**Decision:** Build the UX row-based input (maximum 10 rows) as the primary interface. The row-based UI sends a single request to `POST /api/batch` with the listings serialised into the markdown format the API expects. This is a client-side serialisation step — the server API remains unchanged. The markdown format becomes an internal wire format, not a user-facing feature.

**Implication for the engineer:** The `POST /api/batch` body still uses `{ markdown: string }` as specified. The batch page client serialises the row-based form into that markdown format before submitting. The markdown parser on the server must handle the exact format the client produces — document this contract in the batch route file.

### Decision 3: Red Flag Dismiss Persistence

**Gap:** The UX specifies that dismissed red flags survive page refresh. The schema has no column for this.

**Decision:** Add a `dismissedRedFlags` column to `fitAssessments`:

```typescript
dismissedRedFlags: text('dismissed_red_flags'),  // serialised JSON array of flag strings
```

This is a SYSTEM-layer column that records user workflow state. The engineer adds this to the migration alongside the other Phase 2 tables. The dismiss action calls `PATCH /api/applications/[id]` (or a new endpoint — see Thread 4 below).

### Decision 4: Per-Dimension User Annotations

**Gap:** The UX specifies user annotation textareas inside each dimension score row (persist after page refresh). The schema has no column for this.

**Decision:** Add a `dimensionAnnotations` column to `fitAssessments`:

```typescript
dimensionAnnotations: text('dimension_annotations'),  // serialised JSON: { domain?: string, seniority?: string, ... }
```

Keys match the dimension names: `domain`, `seniority`, `scope`, `technical`, `mission`, `location`, `compensation`, `culture`. Values are free text. The same `PATCH` mechanism used for dismiss persistence handles annotation saves.

### Decision 5: Master CV Input Location

**Gap:** The architecture treats `masterCv` as a paste-per-request field in the materials generation request body. The UX never shows a UI for this input.

**Decision:** The master CV is entered in the Materials tab before generation. When the user clicks "Generate CV for [Company]", a modal appears with a textarea pre-populated from `localStorage` (key: `storybank_master_cv`). The user reviews/edits and confirms. The value is cached in `localStorage` so subsequent CV generations are pre-filled. It is never stored server-side (consistent with the architecture decision in Section 14 of ARCHITECTURE-PHASE2).

**The engineer must:**
1. Add a `MasterCvModal` component
2. Read/write `localStorage` key `storybank_master_cv`
3. Pass the value as `masterCv` in the `POST /api/applications/[id]/materials` request

### Decision 6: PDF Download

**Conflict:** The UX flow (Section 4.4) specifies a "Download PDF" button on the CV tab. The architecture explicitly puts "Export to PDF" in Future Considerations (Section 16) and does not spec the API for it.

**Decision:** PDF download is OUT OF SCOPE for Phase 2. The "Download PDF" button described in the UX is replaced by a "Copy as plain text" action only. The CTA label on the CV tab becomes "Copy text" (the existing secondary action in the UX spec becomes the primary action). If the user asks about PDF export, the in-app message is: "PDF export is coming soon. Use Copy text and paste into your preferred document editor."

---

## Part 2 — Acceptance Criteria

### Feature 1: Company Research

#### Application Creation (prerequisite to research)

**AC-1.1:** User can create a job application by providing job title (required), company name (required), and either a job URL or pasted job description (at least one required). Salary and location are optional.

**AC-1.2:** If a job URL is provided and job description is empty, the system scrapes the URL via Jina Reader and populates the job description field. If scraping fails, the application is created with an empty job description and the response includes `warning: "Could not scrape the URL — paste the job description manually."` The user is never blocked from creating the application.

**AC-1.3:** If both URL and job description are provided, the pasted description takes priority. The URL is stored but not scraped.

**AC-1.4:** Company name is auto-extracted from the scraped job listing when the URL is provided and company name field is empty. If extraction fails, the company name field remains empty and the user must fill it.

**AC-1.5:** Applications are stored per user. A user can have multiple applications to the same company with different roles. Each application has its own independent pipeline state.

**AC-1.6:** Invalid URL format shows inline error "That doesn't look like a valid URL" before submission. Empty submit (neither URL nor description) shows "Paste a job URL or description to continue."

#### Research Execution

**AC-1.7:** Research runs when user submits the `/research/new` form. The UI replaces the form with a progress panel showing named steps. Steps are: "Company overview", "Funding and growth stage", "Recent news and announcements", "Tech stack and engineering culture", "Key people". Progress is simulated client-side (steps advance at fixed intervals) because the API is a single call — the step animation signals that work is happening, not actual sub-step completion.

**AC-1.8:** Research calls three external services in parallel (Jina Reader, Companies House, Gemini Search). At least one must return data for research to succeed. If all three fail, return HTTP 503 with `error: "Could not gather any company data. Check your API keys and try again."` The UI shows the error state with "Try again" and "Continue without research" options.

**AC-1.9:** If a single service fails (not all three), research continues with the remaining data. Warnings are stored in the `sources` field of `companyResearch` and surfaced as inline `~` uncertain claims in the research detail UI.

**AC-1.10:** If the company is non-UK or not found in Companies House, the system continues without CH data and adds a warning `"Company not found on Companies House — may be non-UK or use a different registered name."` This is an uncertain claim, not a red flag.

**AC-1.11:** Research results persist. If the user navigates away and returns to `/research/[id]`, all structured fields and rich text sections are displayed without re-running research.

**AC-1.12:** A user can force re-research by clicking a "Re-research" option (accessible from an overflow menu on the research detail page, not a prominent CTA). Re-research overwrites the existing `companyResearch` row and updates `researchedAt`. A confirmation dialog appears: "This will replace all existing research data for [Company]. Continue?"

**AC-1.13:** The research detail page displays: company name (h2), descriptor line (funding stage, sector, headquarters), metric grid (stage, amount raised, founded year, employee count), and four section cards (Recent News, Tech Stack, Mission and Culture, Key People). Sections with no data display "No information found" in `--sage` italic — never blank.

**AC-1.14:** Red flags from research (e.g., compensation mismatch, non-disclosed revenue) appear inline within the relevant section card as amber-bordered callouts. They use `--contradiction` colour and `AlertTriangle` icon. They are distinct from uncertain claims (`~` prefix, italic sage).

**AC-1.15:** User annotations on the research detail page auto-save on blur with 800ms debounce. The save is confirmed with "Saved automatically" caption (not a toast). "Undo last change" appears for 5 seconds after each save. Annotations are stored in `jobApplications.notes` (the existing free-text field).

**AC-1.16:** "Continue without research" from the error state navigates to `/fit/[id]` with the `job_application` already created. The fit assessment handles the missing research gracefully (see AC-2.7).

**AC-1.17:** Research cards in the `/research` landing list show: company name, descriptor (funding stage, sector, employee count), date researched, and two actions: "View research" and "Start fit assessment" (or "View fit assessment" if already assessed).

**AC-1.18:** Empty state on `/research` shows Globe icon, heading "No company research yet", body text "Paste a job listing URL or description to research the company before you apply.", CTA "Research a company" linking to `/research/new`.

#### Edge Cases

**AC-1.19:** If Jina Reader times out (>15s), research continues with Companies House and Gemini Search data only. The research detail page displays the partial data without indication that Jina Reader failed (it is irrelevant to the user). The `sources` field records which services were used.

**AC-1.20:** If a company website returns 403 (blocks scrapers), Jina Reader returns an error. Research continues with other sources. No warning is surfaced to the user — many legitimate companies block scrapers.

**AC-1.21:** Companies House rate limit (2 req/sec): the client enforces a 500ms delay between requests using a simple in-process token bucket. If a 429 is received, retry once after 1s. If the second attempt fails, skip Companies House and continue.

**AC-1.22:** Jina Reader works without `JINA_API_KEY` (at lower 20 RPM rate limit). If `GEMINI_API_KEY` is not set, skip Gemini Search. If `COMPANIES_HOUSE_API_KEY` is not set, skip Companies House. The research endpoint does not return 503 for missing optional keys — it degrades to whatever sources are available.

---

### Feature 2: Fit Assessment

#### Assessment Execution

**AC-2.1:** Fit assessment requires company research to exist (`researchedAt` not null). If research is missing, return HTTP 422 with `error: "Run company research first."` The UI shows the "Continue without research" path — if the user arrived via the error state from research, the assess endpoint must handle null `companyResearch` gracefully (see AC-2.7).

**AC-2.2:** Assessment loads all user examples from Turso (all, not just those with embeddings), generates an embedding of the job description, queries Upstash Vector for the top 20 most similar examples, then fetches the full rows for those examples. Gemini Searchmples without embeddings are excluded from vector similarity but can be passed if they have tags matching the job description keywords.

**AC-2.3:** Assessment detects the role archetype first (single Claude call), then scores 8 dimensions using the archetype-adjusted rubric (second Claude call). Both calls use structured output via tool use — no free-text parsing.

**AC-2.4:** Each dimension score is 1-10 with evidence text (1-3 sentences) and confidence level (`high`, `medium`, `low`). `low` confidence means "insufficient data to score — this is a guess." Low-confidence dimensions render as "unverified" in the UI with `~` prefix styling.

**AC-2.5:** Overall score is stored as integer 1-100 (weighted average * 10) in `jobApplications.fitScoreOverall`. The weights default to: domain 15, seniority 15, scope 15, technical 10, mission 10, location 15, compensation 10, culture 10. These are not user-configurable in Phase 2.

**AC-2.6:** Red flags are explicit, named concerns — not generic low scores. A dimension scoring 4/10 does not automatically generate a red flag. A red flag requires a specific mismatch the LLM can articulate: "Role requires 5+ years people management; your examples show 2 years." Green flags follow the same pattern.

**AC-2.7:** If `companyResearch` is null (user used "Continue without research"), the assessment runs with only the job description and example bank. Dimensions that rely on company research (`culture`, `mission`, `technical`) receive `confidence: "low"` automatically. The overall score is still computed and displayed. The assessment detail page shows a banner: "Research data was not available for this assessment. Culture, Mission, and Technical scores are unverified."

**AC-2.8:** Assessment results persist. Navigating away and returning to `/fit/[id]` shows the stored results immediately without re-running.

**AC-2.9:** Re-assessment is available via an overflow menu ("Re-assess"). Confirmation dialog: "This will replace your existing fit assessment. Your dimension annotations will be preserved." Re-assessment overwrites `fitAssessments` and updates `assessedAt` and `fitScoreOverall` on `jobApplications`. `dimensionAnnotations` and `dismissedRedFlags` are NOT overwritten — they are user-layer data.

**AC-2.10:** The loading state for fit assessment shows an indeterminate amber shimmer bar and "Evaluating 8 dimensions · This takes 20–35 seconds." Individual dimension scores do not appear until all 8 are ready. Partial results are not shown.

#### Assessment Detail UI

**AC-2.11:** The radar chart renders as an SVG polygon, 8 spokes, drawn without Chart.js or any charting library. The chart is `aria-hidden="true"`. The accessible representation is the dimension score row list below.

**AC-2.12:** Dimension score rows are collapsed by default (2 lines of rationale visible). Expand on chevron click (Space/Enter keyboard). Expanded state shows full rationale, confidence indicator, any red flag or uncertain claim, and the user annotation textarea.

**AC-2.13:** Score colours: `--amber` for scores 8-10, `--copper` for 6-7, `--sage` for 1-5. This applies to the score number, the progress bar fill, and any dimension-level red flag inline.

**AC-2.14:** Archetype badge uses the six-archetype mapping specified in UX-PHASE2 Section 2.6.3. `Deal-Breaker Risk` badge uses `--contradiction` colours. All others use `--amber`.

**AC-2.15:** Red flags section only renders if one or more flags exist. Each flag card has: title, description, and a dismiss affordance ("Not a concern for me ×") that appears on hover. Dismissed flags move to a collapsed "Dismissed flags" accordion below the main list. Dismissed state is persisted to `fitAssessments.dismissedRedFlags`.

**AC-2.16:** Per-dimension annotations auto-save on blur, debounced 800ms. Annotation saves call `PATCH /api/applications/[id]/assessment/annotations` (new endpoint — see Thread 4). The "Saved" confirmation is a caption, not a toast.

**AC-2.17:** The `/fit` landing list shows each assessment card with: company + role, progress bar + score, archetype badge, date assessed, and two actions: "View assessment" and "Generate materials" (or "View materials" if already generated).

**AC-2.18:** Empty state on `/fit` shows BarChart3 icon, heading "No fit assessments yet", body "Research a company first, then run a fit assessment.", CTA "Research a company" linking to `/research/new`.

#### Edge Cases

**AC-2.19:** If Claude fails during archetype detection (first call), return HTTP 503. Do not attempt the scoring call with undefined archetype — the archetype shapes the rubric. The UI shows: "Assessment failed. Try again." with a retry button.

**AC-2.20:** If the user has zero examples in their bank, the assessment runs but all dimensions receive `confidence: "low"` and a single banner displays: "You have no examples in your bank. Add examples from transcripts or practice sessions to improve fit accuracy."

**AC-2.21:** If the user's examples have no embeddings (newly created, not yet enriched), the fit assessment falls back to tag-based matching. The assessment still runs — it just has less evidence. A banner notes: "Your examples haven't been indexed yet. Fit accuracy will improve after the index completes."

---

### Feature 3: Tailored Materials

#### Materials Generation

**AC-3.1:** Materials generation requires a fit assessment to exist (`assessedAt` not null). If no assessment exists, return HTTP 422 with `error: "Run fit assessment first."` The UI shows "Start Fit Assessment →" as the CTA.

**AC-3.2:** Default fit threshold for materials generation is 70 (on 1-100 scale). If `fitScoreOverall < 70`, the materials endpoint returns HTTP 422 with a message explaining the threshold. The UI shows: "Your fit score ([N]/100) is below the threshold for materials generation (70/100). You can lower the threshold or improve your score by adding more relevant examples." A "Generate anyway" option bypasses the threshold with `fitThreshold: 0` in the request.

**AC-3.3:** Three material types — CV, Cover Letter, Tracking Note — are generated independently (each is its own API call, not batched). The CV and Cover Letter are generated on user demand (explicit "Generate" button per tab). The Tracking Note is generated automatically when the user opens that tab for the first time.

**AC-3.4:** CV generation uses: master CV text (from `localStorage` via `MasterCvModal`), top 10 examples by vector similarity to job description, fit assessment, job description. If no master CV is provided, generate from examples only and add warning: "No master CV provided — CV generated from examples only. Review carefully."

**AC-3.5:** CV generation never fabricates roles, companies, titles, dates, or quantified achievements that are not present in the master CV or example bank. The system prompt includes explicit anti-fabrication instructions. This is a critical constraint — see Accuracy Profile in Part 3.

**AC-3.6:** Cover letter uses a three-paragraph structure: (1) opening hook tied to company research insight, (2) two proof points from the example bank mapped to job requirements, (3) forward-looking close with specific contribution statement. Anti-slop phrases are blocked in the system prompt (see ARCHITECTURE-PHASE2 Section 7.2).

**AC-3.7:** Tracking Note generates from existing pipeline outputs (research summary, fit scores, user annotations, matched examples). It does not make additional LLM calls if research and assessment data are present. Generation time target: under 5 seconds for a complete pipeline. If research or assessment are missing, generate from whatever is available.

**AC-3.8:** Generated materials are stored in `generatedMaterials` with `type`, `content` (markdown), `version` (starting at 1), and `exampleIdsUsed`. On regeneration with `force: true`, version increments and a new row is inserted. The UI shows only the latest version.

**AC-3.9:** The `promptHash` field stores a SHA-256 of the inputs used to generate the content. When any referenced example changes (content edited), `promptHash` becomes stale. The CV and Cover Letter tabs display a banner: "Your example bank has changed since this was generated. [Regenerate →]" This is checked by comparing the current hash of inputs against the stored `promptHash` on page load.

**AC-3.10:** Regenerate action: if the user has made edits to the content since generation, show a confirmation dialog before overwriting: "Regenerating will overwrite your changes. This cannot be undone." If no edits have been made, proceed without confirmation.

#### Materials UI

**AC-3.11:** The materials page uses a three-tab layout (CV, Cover Letter, Tracking Note). The active tab is indicated by a 2px bottom border in `--amber`.

**AC-3.12:** CV and Cover Letter tabs render in edit-first mode. Content is immediately editable via `contenteditable="true"`. The editable area has a light-mode interior (white background, dark text) inside the dark chrome. This signals "document" not "AI output box."

**AC-3.13:** Paste into the editable area strips all incoming styles and external formatting. Only plain text is accepted. This prevents layout corruption from paste events.

**AC-3.14:** Auto-save triggers on blur, debounced 800ms. Auto-saved content is persisted to `generatedMaterials.content` via `PATCH /api/applications/[id]/materials/[material_id]` (new endpoint — see Thread 5). The save confirmation is a caption "Saved" that fades in below the editor for 2 seconds.

**AC-3.15:** Gemini Searchmple attribution: bullet points in the CV that were derived from a specific example carry a `[→ Bank]` superscript link in `--copper`. Clicking opens that example in `/examples/[id]` in a new tab. When the user edits the attributed bullet, the attribution link is removed. Attribution is stored as data attributes on the HTML elements — not persisted to the database.

**AC-3.16:** The Cover Letter tab includes a "Company-specific hooks used" panel above the editable area (rendered only when generated). This panel lists the research insights that were used to personalise the letter (e.g., "Airbox's Series B milestone", "engineering-led culture from Glassdoor"). Background: `--amber-faint`, border `1px solid var(--amber)`. Collapsible if more than 3 hooks.

**AC-3.17:** Tracking Note is rendered as a read-only code block (monospace, `--card-raised` background). Two actions: "Copy to clipboard" and "Open in editor". "Open in editor" opens a full-screen modal with a plain textarea containing the raw Markdown for user editing. Edits in the modal are not auto-saved — the user copies from the modal manually.

**AC-3.18:** "Copy text" action on CV and Cover Letter tabs copies the plain text content (strip HTML tags) to the clipboard. Button text changes to "Copied" for 2 seconds, then reverts. An `aria-live="polite"` region announces "Copied to clipboard".

**AC-3.19:** The `/materials` landing list shows each materials set as a card: company + role, generation status chips (CV, Cover Letter, Tracking Note — each shows generated/not generated state), date generated.

**AC-3.20:** Empty state for CV tab (not yet generated): FileOutput icon, "No CV generated yet", body text explaining the master CV template, amber "Generate CV for [Company]" button.

**AC-3.21:** Empty state on `/materials` landing: FileOutput icon, "No materials generated yet", body "Complete a fit assessment to generate tailored CV and cover letter.", CTA "Start a fit assessment" linking to `/fit/new`.

#### Edge Cases

**AC-3.22:** If the user has no examples with vector embeddings, materials generation proceeds using only the master CV (if provided). A banner displays: "No indexed examples found. CV and cover letter are generated from your master CV only."

**AC-3.23:** If `masterCv` is not provided and no examples exist, materials generation returns HTTP 422: "Provide a master CV or add examples to your bank to generate materials." The UI shows both CTAs: "Add examples →" and a field to paste the master CV.

**AC-3.24:** Materials generation timeout (Vercel 60s): CV + cover letter + tracking note sequential calls may exceed 60s for long job descriptions. Generate CV first, then cover letter, then tracking note in separate API calls — not a single batched call. Each tab triggers its own generation request.

**AC-3.25:** Tracking Note auto-generation failure: if the generation fails silently, never show a blank tab. Show a `Loader2` spinner for up to 3 seconds, then an error state with "Compiling your tracking note failed. [Retry]".

---

### Feature 4: Batch Mode

#### Batch Input

**AC-4.1:** Batch input accepts 2-10 job listings via a row-based UI. Each row has a text input (URL or short label) and a remove button. "+ Add another listing" adds rows up to the maximum.

**AC-4.2:** Attempting to add an 11th row shows inline message: "Maximum 10 listings per batch." The "+ Add" button disables.

**AC-4.3:** If only 1 row is entered and the user submits, show: "For a single listing, use the Research flow for more detail →" with a link to `/research/new`. Do not process the batch.

**AC-4.4:** Before submitting, each row's input is validated: a URL input must be a valid URL format, or it is treated as a text label (company/role name). No row can be empty.

**AC-4.5:** The client serialises the row-based form into the markdown format expected by `POST /api/batch`: each row becomes `## [label or derived title]\n[url or empty]`. This serialisation happens client-side before the API call.

**AC-4.6:** On submit, the batch record is created and the client immediately receives back the batch ID and list of created `jobApplication` IDs. The form is replaced by the pipeline progress panel.

#### Batch Processing

**AC-4.7:** The client polls `POST /api/batch/[id]/run` after receiving the initial batch response. Each `/run` call processes as many applications as fit within a ~50s budget (typically 1 application end-to-end per call). The client re-calls `/run` until `remaining === 0`.

**AC-4.8:** The pipeline progress panel shows a row per job with real-time status: pending (bullet), researching (spinning amber loader), scoring (spinning amber loader), complete (green checkmark + score), error (red X + message + retry link).

**AC-4.9:** Overall progress bar (amber fill) shows `N of M complete` beneath it. Progress updates whenever any job status changes.

**AC-4.10:** Results table populates progressively as jobs complete — rows appear as each job finishes, sorted by fit score descending by default. The user does not have to wait for all jobs to complete before reviewing results.

**AC-4.11:** If a single job in the batch fails (one service down, one LLM error), it is marked `failedJobs++` on the `batchRuns` row, the row in the UI shows an error state with a "Retry this job" link, and processing continues with the next job. The batch is not aborted.

**AC-4.12:** A failed batch job can be retried individually. Retry re-calls `POST /api/batch/[id]/run` which resumes from the failed job (skipping already-completed jobs via the timestamp state machine).

**AC-4.13:** "Export CSV" button downloads `batch_results.csv` with columns: Company, Role, Fit Score, Archetype, Red Flag Count, Research URL, Fit Detail URL, Materials URL. This is a client-side CSV generation from the current table state — no separate API endpoint required.

**AC-4.14:** From the batch results table, clicking "Research", "Fit", or "Materials" links navigates to the respective detail page for that job: `/research/[id]`, `/fit/[id]`, `/materials/[id]`.

**AC-4.15:** The batch results table is sortable by fit score (default, descending), red flag count, and company name (alphabetical). Sort state is URL-encoded as a query param (`?sort=fit_desc`) so sharing the URL preserves sort order.

**AC-4.16:** Below 768px, the batch results table collapses to a stacked card list (one card per result, same data arranged vertically). The table is not shown on mobile.

**AC-4.17:** Batch mode does not generate materials automatically — it researches and assesses all jobs, but materials generation is user-initiated per job from the results table. This is intentional: the user should review fit scores before generating documents.

#### Edge Cases

**AC-4.18:** If all jobs in a batch fail (total network failure, API keys invalid), `batchRuns.status` → `failed`. The UI shows: "Batch processing failed. Check your API keys and try again." with a "Retry all" button.

**AC-4.19:** If the batch polling cycle is interrupted (user closes tab, browser crash), the batch resumes correctly on next page load. `GET /api/batch/[id]` returns the current state; the client re-starts polling from there if `status === 'running'`.

**AC-4.20:** Maximum batch size enforced server-side as well as client-side. If `POST /api/batch` receives more than 10 listings in the markdown, return HTTP 400: "Maximum 10 listings per batch."

---

## Part 3 — Sidebar Update

The sidebar requires a one-file update to `AppSidebar.tsx`. This is Thread 1 and has no dependencies.

**Updated NAV_SECTIONS:**

```typescript
import {
  Globe,       // Research
  BarChart3,   // Fit Assessment
  FileOutput,  // Materials
  Layers,      // Batch
  Target,      // Job Match (moves from BUILD to APPLY)
  // ... existing imports
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Upload', href: '/upload', icon: Upload },
    ],
  },
  {
    label: 'BUILD',
    items: [
      { label: 'Gemini Searchmple Bank', href: '/examples', icon: BookMarked },
      { label: 'Mirror', href: '/mirror', icon: Sparkles },
      // Job Match removed from BUILD
    ],
  },
  {
    label: 'APPLY',
    items: [
      { label: 'Job Match', href: '/match', icon: Target },     // moved here
      { label: 'Research', href: '/research', icon: Globe },    // new
      { label: 'Fit', href: '/fit', icon: BarChart3 },          // new
      { label: 'Materials', href: '/materials', icon: FileOutput }, // new
      { label: 'Batch', href: '/batch', icon: Layers },         // new
      { label: 'Consistency', href: '/consistency', icon: GitBranch },
    ],
  },
  {
    label: 'PRACTISE',
    items: [
      { label: 'Practice', href: '/practice', icon: Mic },
    ],
  },
];
```

**Active path matching note:** The existing `pathname.startsWith(item.href + '/')` logic already handles nested routes (e.g., `/research/new` activates the Research nav item). No changes needed to the matching logic.

---

## Part 4 — Build Threads

Threads are designed to maximise parallelism. Where a thread has a dependency, it is explicit. Threads with no dependency can start immediately.

### Thread 1: Database Schema + Sidebar (no dependencies)

**Scope:**
- Add 5 new tables to `/Users/clairedonald/ai-interview-coach/src/lib/db/schema.ts`: `jobApplications`, `companyResearch`, `fitAssessments`, `generatedMaterials`, `batchRuns`
- Add the two Phase 2 columns missing from the architecture spec (see Decisions 3 and 4): `dismissedRedFlags` and `dimensionAnnotations` on `fitAssessments`
- Add Phase 2 types to `/Users/clairedonald/ai-interview-coach/src/lib/types/index.ts`
- Run `npx drizzle-kit generate` and commit the migration file
- Update `/Users/clairedonald/ai-interview-coach/src/components/storybank/AppSidebar.tsx` with the new nav sections (Part 3 above)

**Files owned:**
- `src/lib/db/schema.ts`
- `src/lib/types/index.ts`
- `src/components/storybank/AppSidebar.tsx`
- `drizzle/migrations/[new migration].sql`

**Reasoning level:** Low. Schema is fully specified. The sidebar change is a data update to the constants array.

**Exit criteria:**
- Migration file generated without errors
- `schema.ts` exports all 5 new table definitions
- `types/index.ts` exports all Phase 2 types
- AppSidebar renders 4 new APPLY items; Job Match has moved from BUILD to APPLY; no TypeScript errors

---

### Thread 2: External Service Clients (no dependencies)

**Scope:**
- Implement `src/lib/services/companies-house.ts` — `CompaniesHouseClient` class with `searchCompany`, `getCompanyProfile`, `getFilingHistory`, and the in-process `RateLimiter`
- Implement `src/lib/services/jina-reader.ts` — `JinaReaderClient` with `scrapeUrl`, `scrapeJobListing`, `scrapeCompanyPages` (plain `fetch()` to `r.jina.ai`, no npm package)
- Implement `src/lib/services/gemini-search.ts` — `GeminiSearchClient` with `searchCompanyNews`, `searchCompanyCulture` (Gemini Flash + `googleSearch` tool)
- Implement `src/lib/services/index.ts` — lazy-init singleton factories for all three
- Add package install: `@google/generative-ai`

**Files owned:**
- `src/lib/services/companies-house.ts` (new)
- `src/lib/services/jina-reader.ts` (new)
- `src/lib/services/gemini-search.ts` (new)
- `src/lib/services/index.ts` (new)
- `package.json`

**Reasoning level:** Medium. Rate limiting for Companies House needs careful implementation. Gemini grounding response parsing needs structured extraction. Each client must handle its specific error cases per ARCHITECTURE-PHASE2 Section 4.

**Exit criteria:**
- All three clients compile without TypeScript errors
- `CompaniesHouseClient` enforces 500ms minimum interval between requests (token bucket)
- `JinaReaderClient` works with and without `JINA_API_KEY` (different rate limits)
- `GeminiSearchClient` uses `googleSearch` tool and parses grounded results with citations
- All clients return non-fatal results (partial data + warning) on individual service errors
- `getCompaniesHouseClient()` throws at first use if `COMPANIES_HOUSE_API_KEY` is not set (not at import time)
- `getGeminiSearchClient()` throws at first use if `GEMINI_API_KEY` is not set

---

### Thread 3: Research Prompts (no dependencies)

**Scope:**
- Implement `src/lib/prompts/research-synthesis.ts` — structured output prompt for synthesising Jina Reader + CH + Gemini Search data into `CompanyResearch` fields
- Implement `src/lib/prompts/fit-assessment.ts` — two-call prompt set: archetype detection and 8-dimension scoring. All calls use `callWithTool<T>()`

**Files owned:**
- `src/lib/prompts/research-synthesis.ts` (new)
- `src/lib/prompts/fit-assessment.ts` (new)

**Reasoning level:** High. These are the most complex prompts in Phase 2. Key constraints:
- Research synthesis must handle heterogeneous input quality (sparse CH data + rich Jina Reader data must produce usable output)
- Fit assessment must produce calibrated scores (not all clustered at 6-8) and must assign `confidence: 'low'` when evidence is absent
- Red flags must be specific (not "compensation is low" but "stated floor £150k; listing shows £100-120k")
- Anti-fabrication in all prompts
- Token budget truncation as specified in ARCHITECTURE-PHASE2 Section 7.2

**Exit criteria:**
- Both files export typed prompt builder functions
- Research synthesis output matches `CompanyResearch` schema (all fields nullable)
- Fit assessment output matches `FitAssessment` schema (8 `DimensionScore` objects, archetype, flags)
- Prompts include explicit "say unverified, not guess" instruction
- Manual test: run research synthesis against one real company with real scraped data — verify structured fields populate correctly

---

### Thread 4: Materials Prompts (no dependencies, parallel with Thread 3)

**Scope:**
- Implement `src/lib/prompts/materials-cv.ts` — tailored CV prompt with anti-fabrication constraint
- Implement `src/lib/prompts/materials-cover.ts` — three-paragraph cover letter with anti-slop blocklist and company hook injection
- Implement `src/lib/prompts/materials-tracking.ts` — Obsidian-compatible markdown tracking note

**Files owned:**
- `src/lib/prompts/materials-cv.ts` (new)
- `src/lib/prompts/materials-cover.ts` (new)
- `src/lib/prompts/materials-tracking.ts` (new)

**Reasoning level:** Medium-High for CV and cover letter; Low for tracking note.

**CV prompt critical requirements:**
- System prompt must include: "You may ONLY use roles, companies, dates, titles, and achievements that are explicitly present in the master CV template or the provided examples. Do not add, imply, or extrapolate any experience that is not explicitly stated. If you cannot improve a section with available data, leave it as-is."
- Output is a full CV in markdown, not just the changed sections
- The prompt must accept: master CV text (may be null), top 10 examples, job description, fit assessment archetype and top green flags

**Exit criteria:**
- All three files export typed prompt builder functions
- Manual test: run CV prompt with a real master CV and 5 examples against a real job description — verify no fabricated experience appears
- Manual test: run cover letter prompt — verify no generic phrases from the blocklist appear

---

### Thread 5: Application + Research API Routes (depends on Thread 1, Thread 2, Thread 3)

**Scope:**
- `POST /api/applications` — create application, optional Jina Reader URL scrape
- `GET /api/applications` — list with filters
- `GET /api/applications/[id]` — get with research, assessment, materials
- `PATCH /api/applications/[id]` — update user fields
- `DELETE /api/applications/[id]` — delete with cascade
- `POST /api/applications/[id]/research` — run company research pipeline
- Encryption wrappers for Phase 2 fields (extend `src/lib/encryption/index.ts`)

**Files owned:**
- `src/app/api/applications/route.ts` (new)
- `src/app/api/applications/[id]/route.ts` (new)
- `src/app/api/applications/[id]/research/route.ts` (new)
- `src/lib/encryption/index.ts` (extend)

**Reasoning level:** High for the research route. Standard CRUD routes are Low.

The research route orchestrates three parallel external service calls plus Claude synthesis within the 60s Vercel budget. Follow the timing budget from ARCHITECTURE-PHASE2 Section 3.6 precisely. Use `Promise.allSettled` for the three external calls. Claude synthesis runs after all three complete (or time out).

**Exit criteria:**
- `POST /api/applications` returns 201 with application; scraping failure returns 201 with `warning` field
- `POST /api/applications/[id]/research` returns 200 with `CompanyResearch`; returns 409 if already researched without `force`; returns 503 only if ALL three services fail
- All routes return 401 for unauthenticated requests
- All routes filter by `userId` — cross-user access returns 404
- Encryption wraps `companyResearch.recentNews`, `cultureSignals`, `keyPeople` and `jobApplications.jobDescription` when `ENCRYPTION_KEY` is set

---

### Thread 6: Assessment + Materials API Routes (depends on Thread 1, Thread 3, Thread 4, Thread 5)

**Scope:**
- `POST /api/applications/[id]/assess` — run fit assessment
- `POST /api/applications/[id]/materials` — generate materials
- `PATCH /api/applications/[id]/assessment/annotations` — save dimension annotations and dismissed flags (new endpoint not in architecture spec, required by Decisions 3 and 4)
- `PATCH /api/applications/[id]/materials/[material_id]` — save edited material content (new endpoint not in architecture spec, required by AC-3.14)
- Encryption wrappers for materials content

**Files owned:**
- `src/app/api/applications/[id]/assess/route.ts` (new)
- `src/app/api/applications/[id]/materials/route.ts` (new)
- `src/app/api/applications/[id]/assessment/annotations/route.ts` (new)
- `src/app/api/applications/[id]/materials/[material_id]/route.ts` (new)
- `src/lib/encryption/index.ts` (extend further)

**Reasoning level:** High for assess (vector search + example loading + two-call Claude). Medium for materials (three sequential Claude calls).

Key implementation notes:
- Assessment must load all user examples, run vector similarity for top 20, fetch full rows, then assemble context window. Token budget applies (see ARCHITECTURE-PHASE2 Section 7.2).
- Materials generation: generate CV, cover letter, and tracking note as separate API calls from the client (not batched). The `/materials` endpoint accepts `types: ['cv']` or `types: ['cover_letter']` for individual generation.
- `promptHash`: compute SHA-256 of the concatenated input (job description + example IDs + master CV hash). Store on `generatedMaterials.promptHash`.

**Exit criteria:**
- `POST /api/applications/[id]/assess` returns 200 with `FitAssessment`; returns 422 without research; returns 409 if already assessed without `force`
- `POST /api/applications/[id]/materials` returns 422 if fit score below threshold; returns 422 if no assessment
- Annotation and material content PATCH endpoints return 200 and persist correctly
- Materials `content` is encrypted when `ENCRYPTION_KEY` is set

---

### Thread 7: Batch API Routes (depends on Thread 1, Thread 5, Thread 6)

**Scope:**
- `POST /api/batch` — parse markdown, create `batchRuns` row, create N `jobApplications` rows
- `POST /api/batch/[id]/run` — process one application end-to-end (research + assess + materials if above threshold), return progress
- `GET /api/batch/[id]` — return batch status and application list

**Files owned:**
- `src/app/api/batch/route.ts` (new)
- `src/app/api/batch/[id]/route.ts` (new)
- `src/app/api/batch/[id]/run/route.ts` (new)

**Reasoning level:** Medium-High. The `run` endpoint must manage timing: stay under 50s, process one application, update counters, return remaining count. Timing management is critical — if the function runs over 60s, Vercel kills it silently and the batch stalls.

Markdown parsing: the client sends the markdown format produced by the batch form serialisation. Document the exact expected format in a comment at the top of the route file.

**Exit criteria:**
- `POST /api/batch` creates `batchRuns` row and N `jobApplications` rows; returns 400 if > 10 listings; returns 201 with batch + applications list
- `POST /api/batch/[id]/run` processes one application and returns `{ processed_this_call: 1, remaining: N }`. Does not process the same application twice (checks timestamp state).
- `GET /api/batch/[id]` returns batch status and all applications with `fitScoreOverall` and `materialsGenerated` fields
- One-application processing completes within 50s (test with a real slow company)

---

### Thread 8: Research + Fit UI Pages (depends on Thread 1, Thread 5, Thread 6)

**Scope:**
- `/research/new` — research input form + loading state + redirect on completion
- `/research/[id]` — research detail with metric grid, section cards, red flags, annotations, CTA
- `/fit` — fit assessment landing (list)
- `/fit/new` — fit assessment input form (linked from research)
- `/fit/[id]` — fit assessment detail with radar chart, dimension rows, red flags section, annotations, CTA
- `JobContextHeader` component
- `RadarChart` component (SVG, no charting library)
- `DimensionScoreRow` component
- `FlagCard` component

**Files owned:**
- `src/app/(app)/research/page.tsx` (new)
- `src/app/(app)/research/new/page.tsx` (new)
- `src/app/(app)/research/[id]/page.tsx` (new)
- `src/app/(app)/fit/page.tsx` (new)
- `src/app/(app)/fit/new/page.tsx` (new)
- `src/app/(app)/fit/[id]/page.tsx` (new)
- `src/components/storybank/JobContextHeader.tsx` (new)
- `src/components/storybank/RadarChart.tsx` (new)
- `src/components/storybank/DimensionScoreRow.tsx` (new)
- `src/components/storybank/FlagCard.tsx` (new)

**Reasoning level:** High. The radar chart SVG math is moderately complex. The annotation auto-save requires careful debounce handling. The progress animation during research loading must feel authentic without being deceptive.

Key implementation note for `/research/new` loading state: The progress steps are simulated client-side (5 steps advancing on a timer) because the API is a single call. Steps should advance at: 0s, 8s, 16s, 22s, 28s approximately. If the API responds before all steps complete, skip to complete state immediately. If the API errors, show the error state and stop the timer.

**Exit criteria:**
- Radar chart renders correctly in SVG for all 8 dimensions with amber fill polygon
- Radar chart is `aria-hidden` with title/desc inside SVG
- Dimension rows collapse/expand via chevron (Space/Enter keyboard)
- Red flag dismiss persists across page refresh (via API PATCH)
- Dimension annotations persist across page refresh (via API PATCH)
- Progress steps in loading state animate at realistic cadence
- `/research/new` redirects to `/research/[id]` on success
- "Continue without research" from error state navigates to `/fit/[id]` with application pre-created
- All empty states match the spec (correct icon, heading, body, CTA)

---

### Thread 9: Materials + Batch UI Pages (depends on Thread 1, Thread 6, Thread 7)

**Scope:**
- `/materials` — materials landing
- `/materials/[id]` — three-tab materials hub (CV, Cover Letter, Tracking Note)
- `/batch` — batch input + pipeline progress + results table
- `MaterialsEditor` component (contenteditable with autosave)
- `MasterCvModal` component (localStorage-backed)
- `BatchPipelineRow` component
- `BatchResultsTable` component (with mobile card fallback)

**Files owned:**
- `src/app/(app)/materials/page.tsx` (new)
- `src/app/(app)/materials/[id]/page.tsx` (new)
- `src/app/(app)/batch/page.tsx` (new)
- `src/components/storybank/MaterialsEditor.tsx` (new)
- `src/components/storybank/MasterCvModal.tsx` (new)
- `src/components/storybank/BatchPipelineRow.tsx` (new)
- `src/components/storybank/BatchResultsTable.tsx` (new)

**Reasoning level:** High for MaterialsEditor and Batch polling. Medium for the rest.

Key implementation notes:
- `MaterialsEditor` uses `contenteditable="true"` (not Tiptap or Quill). Strip incoming paste styles. Autosave on blur. `role="textbox" aria-multiline="true"`.
- `MasterCvModal` reads/writes `localStorage` key `storybank_master_cv`. Pre-populates on open. Never stores server-side.
- Batch polling: the client calls `POST /api/batch/[id]/run` on a 2-second interval until `remaining === 0`. Use `useInterval` or `setTimeout` in a `useEffect`. Stop polling on tab close (component unmount).
- `BatchResultsTable` generates CSV client-side from the results array (no API call). Use `URL.createObjectURL` for the download.
- Tracking Note: auto-generate on tab first open. Show spinner if > 1s. Never show a blank tab.
- PDF download is OUT OF SCOPE — show "Copy text" only (see Decision 6).

**Exit criteria:**
- Contenteditable area pastes plain text only (test with styled Word paste)
- Autosave fires on blur and confirms with "Saved" caption (not toast)
- Master CV modal pre-populates from localStorage on reopen
- Batch polling restarts correctly on page reload if batch is mid-run
- CSV export downloads with correct headers and data
- Results table sorts correctly on all three sort fields
- Below 768px, table collapses to card list
- Tracking Note generates within 5 seconds for a complete pipeline; shows error state with Retry if it fails

---

## Part 5 — Resolved Questions

All open questions have been answered by the user (2026-04-19):

### Q1 — External Services: FREE STACK APPROVED

**Decision:** Replace paid services with free alternatives:
- **Jina Reader → Jina AI Reader** (free, `fetch('https://r.jina.ai/' + url)`, no npm package)
- **Gemini Search AI → Gemini Flash with Google Search grounding** (free, 500/day, `@google/generative-ai` package)
- **Companies House → unchanged** (already free)

**New env vars:** `JINA_API_KEY` (optional, gets higher rate limit), `GEMINI_API_KEY` (required for company research)

### Q2 — Fit Score Threshold: ENV VAR, DEFAULT 70

**Decision:** Read from `FIT_THRESHOLD_DEFAULT` environment variable, defaulting to 70 if not set.

### Q3 — Batch Size Limit: 10

**Decision:** Maximum 10 listings per batch. Enforced client-side and server-side.

### Q4 — Job Match Navigation: MOVE NOW

**Decision:** Move Job Match from BUILD to APPLY in the sidebar. Coherent flow: Match → Research → Fit → Materials.

### Q5 — Encryption Key

**Action required:** Verify `ENCRYPTION_KEY` is in the Vercel production environment before deploying Phase 2. If it is not set, all Phase 2 company data, research content, and generated materials will be stored in plaintext.

---

## Part 6 — Accuracy Validation Gates

These must be completed before calling Phase 2 done. Not optional.

### Gate 1: CV Anti-Fabrication (before shipping Thread 9)

Run the CV generation prompt with:
1. A real master CV (Claire's)
2. 10 real examples from the bank
3. A real job description

Manual review: verify every role title, company name, employment date, and quantified achievement in the output appears verbatim in either the master CV or the examples. Flag any fabrication as a critical bug. Do not ship CV generation until this passes on 5 real test cases.

### Gate 2: Fit Assessment Calibration (before shipping Thread 8)

Run the fit assessment against 5 role types:
1. A clearly excellent match (expected score: 80+)
2. A clearly poor match (expected score: <40)
3. A borderline role (expected: 55-70)
4. A role with a specific deal-breaker (e.g., wrong location)
5. A role with missing data (no salary, no location)

Review: scores should be spread across the range, not clustered. The deal-breaker role should show the deal-breaking dimension with `confidence: 'high'` and a red flag. The missing-data role should show `confidence: 'low'` on the unresolvable dimensions.

### Gate 3: Company Research Accuracy (before shipping Thread 5)

Test the research pipeline against 5 real companies:
1. A UK-listed company with Companies House data (e.g., a Series B London startup)
2. A large UK public company (e.g., Rightmove)
3. A non-UK company (test that CH gracefully returns empty + warning)
4. A company with an active Glassdoor presence
5. A small company with minimal web presence

Review: structured fields (size, stage, founded year) should be factually correct. Verify against manual lookup. Flag any factual error as a high-priority bug.

---

## Part 7 — Thread Dependency Summary

```
Thread 1: Schema + Sidebar       ← no dependencies. Start immediately.
Thread 2: Service Clients        ← no dependencies. Start immediately.
Thread 3: Research Prompts       ← no dependencies. Start immediately.
Thread 4: Materials Prompts      ← no dependencies. Start immediately.

Thread 5: Research API Routes    ← depends on: Thread 1 ✓, Thread 2 ✓, Thread 3 ✓
Thread 6: Assessment/Materials   ← depends on: Thread 1 ✓, Thread 3 ✓, Thread 4 ✓, Thread 5 ✓
Thread 7: Batch API Routes       ← depends on: Thread 1 ✓, Thread 5 ✓, Thread 6 ✓

Thread 8: Research + Fit UI      ← depends on: Thread 1 ✓, Thread 5 ✓, Thread 6 ✓
Thread 9: Materials + Batch UI   ← depends on: Thread 1 ✓, Thread 6 ✓, Thread 7 ✓
```

**Maximum parallelism at start:** Threads 1, 2, 3, 4 can all start simultaneously.

**Critical path:** Thread 1 → Thread 5 → Thread 6 → Thread 8. This is the longest sequential dependency chain. Prioritise Thread 1 completion to unblock the pipeline.

---

*PRODUCT-SPEC-PHASE2.md — StoryBank Phase 2 v1.0*
*@pm — 2026-04-19*
