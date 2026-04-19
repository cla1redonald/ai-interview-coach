# StoryBank Phase 2 — Architecture Specification (APPLY Loop)

**Version:** 1.0
**Date:** 2026-04-19
**Status:** Ready for review
**Scope:** Phase 2 — Company Research, Fit Assessment, Tailored Materials, Batch Mode
**Depends on:** Phase 1 ARCHITECTURE.md v2.1

**Stack:** Same as Phase 1 — Next.js 14 App Router, Turso (SQLite) + Drizzle ORM, Upstash Vector, Auth.js v5, Anthropic API, AES-256-GCM

**New external services:** Companies House API (free), Jina AI Reader (free), Gemini Flash with Google Search grounding (free)

---

## 1. System Overview

Phase 2 adds the APPLY loop to StoryBank. Phase 1 (BUILD) helps the user accumulate and organise their career stories. Phase 2 helps them _use_ those stories: research a target company, assess fit, and generate tailored application materials.

The four features form a pipeline. Each step can run independently, but the full value comes from running them in sequence: **Research** feeds **Fit Assessment**, which gates **Materials Generation**. **Batch Mode** orchestrates the pipeline across multiple roles.

### Architecture Extension

```
Phase 1 (BUILD loop)                    Phase 2 (APPLY loop)
┌────────────────────┐                  ┌──────────────────────────────────┐
│ Transcripts        │                  │                                  │
│ Examples           │──────────────────▶  Fit Assessment                  │
│ Tags               │  example bank    │  (scores 8 dimensions using      │
│ Mirror             │  feeds into      │   examples + research + profile)  │
│ Consistency        │                  │                                  │
│ Match              │                  │         ▲            │           │
└────────────────────┘                  │         │            ▼           │
                                        │  Company Research    Materials   │
                                        │  (scrape + search    Generation  │
                                        │   + synthesise)      (CV, cover  │
                                        │                      letter,     │
                                        │         ▲            note)       │
                                        │         │                        │
                                        │  Batch Mode                      │
                                        │  (orchestrates N roles           │
                                        │   through the pipeline)          │
                                        └──────────────────────────────────┘

External Services:
┌──────────────┐  ┌───────────────┐  ┌──────────────┐
│ Companies    │  │ Jina AI       │  │ Gemini Flash │
│ House API    │  │ Reader        │  │ + Google     │
│ (UK, free)   │  │ (r.jina.ai)   │  │ Search       │
│ 2 req/sec    │  │ free, fetch() │  │ grounding    │
│ HTTP basic   │  │ URL→markdown  │  │ (free 500/d) │
└──────────────┘  └───────────────┘  └──────────────┘
```

### Vercel Function Timeout Constraint

Vercel serverless functions have a 60-second timeout on the Pro plan (10s on Hobby). Several pipeline steps (company research, fit assessment) involve multiple external API calls and LLM synthesis. The architecture handles this with:

1. **Step-based execution** — each pipeline step is its own API call from the client. The client orchestrates the sequence, not a single long-running function.
2. **Intermediate persistence** — each step writes its result to the database. If the next step fails, the user does not lose prior work.
3. **Parallel external calls within a step** — Companies House, Firecrawl, and Exa queries within the research step run via `Promise.allSettled`, typically completing in 8-15s total.

---

## 2. New Database Schema

All new tables follow the Phase 1 conventions: cuid2 IDs, ISO-8601 text timestamps, `userId` on every row, application-layer access control.

### 2.1 Table: `job_applications`

The central entity for Phase 2. Each row represents one target role the user is researching or applying to. All Phase 2 data hangs off this table.

```typescript
// Additions to src/lib/db/schema.ts

export const jobApplications = sqliteTable('job_applications', {
  id:              id(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // ─── Job listing data ──────────────────────────────────────────────
  jobTitle:        text('job_title').notNull(),
  companyName:     text('company_name').notNull(),
  jobUrl:          text('job_url'),            // original listing URL, nullable (user may paste text)
  jobDescription:  text('job_description').notNull(),  // pasted or scraped job listing text
  salary:          text('salary'),             // free text — "£120-140k" or "competitive"
  location:        text('location'),           // free text — "London / hybrid"

  // ─── Pipeline status ───────────────────────────────────────────────
  // Each field is null until that step completes. Allows resume on failure.
  researchedAt:    text('researched_at'),      // ISO datetime — company research complete
  assessedAt:      text('assessed_at'),        // ISO datetime — fit assessment complete
  materialsAt:     text('materials_at'),       // ISO datetime — materials generated

  // ─── Fit assessment result (denormalised for fast reads) ────────────
  fitScoreOverall: integer('fit_score_overall'),  // 1-100 (weighted average * 10, stored as int)
  fitArchetype:    text('fit_archetype'),         // 'exec' | 'ic' | 'portfolio' | 'advisory' | 'hybrid'

  // ─── User workflow ─────────────────────────────────────────────────
  status:          text('status').notNull().default('researching'),
  // 'researching' | 'assessed' | 'applying' | 'applied' | 'interviewing' | 'rejected' | 'offer' | 'withdrawn'
  notes:           text('notes'),              // free-text user notes
  batchId:         text('batch_id'),           // null for single-role; set for batch operations

  createdAt:       now('created_at'),
  updatedAt:       text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

**Design decisions:**

- **Single row per role, not per company.** A user might apply to two roles at the same company. Company research is duplicated (or cached — see Section 4.3), but each application has its own fit assessment and materials. This is intentional: the same company can be a great fit for one role and a poor fit for another.
- **`fitScoreOverall` stored as integer 1-100** rather than a float. Avoids SQLite float precision issues. Display layer divides by 10 to show "7.2/10".
- **Status column** enables a simple kanban/tracker view in a future UI iteration. Not used by the pipeline itself.

### 2.2 Table: `company_research`

Structured research output. One row per job application. Encrypted when `ENCRYPTION_KEY` is set (company data is sensitive in aggregate).

```typescript
export const companyResearch = sqliteTable('company_research', {
  id:               id(),
  jobApplicationId: text('job_application_id').notNull()
    .references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:           text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ─── Structured fields (populated by research pipeline) ────────────
  companySize:      text('company_size'),       // "51-200 employees" or "Large enterprise"
  fundingStage:     text('funding_stage'),       // "Series B" or "Public" or "Bootstrapped"
  revenue:          text('revenue'),             // "£10-50M ARR" — text, not number
  foundedYear:      text('founded_year'),        // "2019"
  headquarters:     text('headquarters'),        // "London, UK"
  industry:         text('industry'),            // "EdTech" or "B2B SaaS"

  // ─── Rich text fields (LLM-synthesised summaries) ──────────────────
  recentNews:       text('recent_news'),         // markdown — 3-5 bullet points
  techStack:        text('tech_stack'),          // markdown — known technologies
  cultureSignals:   text('culture_signals'),     // markdown — Glassdoor, careers page, values
  keyPeople:        text('key_people'),          // markdown — CEO, CPO, hiring manager if found
  missionAndValues: text('mission_and_values'),  // markdown — company mission statement / purpose

  // ─── Source metadata ───────────────────────────────────────────────
  // JSON array of { url, source_type, fetched_at } — what was actually scraped/queried
  sources:          text('sources'),             // serialised JSON

  // ─── Companies House data (UK only) ────────────────────────────────
  companiesHouseNumber: text('companies_house_number'),
  companiesHouseData:   text('companies_house_data'),  // serialised JSON — full CH response

  createdAt:        now('created_at'),
  updatedAt:        text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

### 2.3 Table: `fit_assessments`

One row per job application. Contains the 8-dimension breakdown.

```typescript
export const fitAssessments = sqliteTable('fit_assessments', {
  id:               id(),
  jobApplicationId: text('job_application_id').notNull()
    .references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:           text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // ─── Archetype ─────────────────────────────────────────────────────
  archetype:        text('archetype').notNull(),
  // 'exec' | 'ic' | 'portfolio' | 'advisory' | 'hybrid'
  archetypeRationale: text('archetype_rationale'),

  // ─── 8 dimension scores — each stored as JSON text ─────────────────
  // Format per dimension: { "score": 7, "evidence": "...", "confidence": "high"|"medium"|"low" }
  dimDomainIndustry:   text('dim_domain_industry'),
  dimSeniority:        text('dim_seniority'),
  dimScope:            text('dim_scope'),
  dimTechnical:        text('dim_technical'),
  dimMission:          text('dim_mission'),
  dimLocation:         text('dim_location'),
  dimCompensation:     text('dim_compensation'),
  dimCulture:          text('dim_culture'),

  // ─── Aggregated result ─────────────────────────────────────────────
  overallScore:     integer('overall_score'),    // 1-100 (weighted average * 10)
  weights:          text('weights'),             // serialised JSON — { domain: 15, seniority: 15, ... }
  redFlags:         text('red_flags'),           // serialised JSON array of strings
  greenFlags:       text('green_flags'),         // serialised JSON array of strings

  // ─── Evidence trail ────────────────────────────────────────────────
  // Which examples were used as evidence (by ID)
  exampleIdsUsed:   text('example_ids_used'),    // serialised JSON array of cuid2 strings

  createdAt:        now('created_at'),
  updatedAt:        text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

**Dimension score JSON format:**

```typescript
interface DimensionScore {
  score: number;         // 1-10
  evidence: string;      // 1-3 sentence explanation
  confidence: 'high' | 'medium' | 'low';
  // 'low' means "insufficient data to score — this is a guess"
  // Displayed as "unverified" in the UI
}
```

**Default weights (configurable per user in future):**

| Dimension | Default Weight |
|-----------|---------------|
| Domain/Industry Match | 15 |
| Seniority Alignment | 15 |
| Scope Match | 15 |
| Technical Fit | 10 |
| Mission/Purpose | 10 |
| Location/Logistics | 15 |
| Compensation Alignment | 10 |
| Culture & Team | 10 |
| **Total** | **100** |

### 2.4 Table: `generated_materials`

Stores generated CV, cover letter, and tracking note for each application.

```typescript
export const generatedMaterials = sqliteTable('generated_materials', {
  id:               id(),
  jobApplicationId: text('job_application_id').notNull()
    .references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:           text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  type:             text('type').notNull(),
  // 'cv' | 'cover_letter' | 'tracking_note'

  content:          text('content').notNull(),   // markdown
  version:          integer('version').notNull().default(1),
  // User can regenerate — version increments. Only latest version is used; old versions kept for audit.

  // ─── Generation metadata ───────────────────────────────────────────
  exampleIdsUsed:   text('example_ids_used'),    // serialised JSON — which examples fed this
  promptHash:       text('prompt_hash'),         // SHA-256 of the input prompt — detect if regeneration is needed

  createdAt:        now('created_at'),
  updatedAt:        text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

### 2.5 Table: `batch_runs`

Tracks batch processing operations.

```typescript
export const batchRuns = sqliteTable('batch_runs', {
  id:              id(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  // ─── Input ─────────────────────────────────────────────────────────
  inputMarkdown:   text('input_markdown').notNull(),  // raw markdown with multiple job listings

  // ─── Status ────────────────────────────────────────────────────────
  status:          text('status').notNull().default('pending'),
  // 'pending' | 'running' | 'completed' | 'failed'
  totalJobs:       integer('total_jobs').notNull().default(0),
  completedJobs:   integer('completed_jobs').notNull().default(0),
  failedJobs:      integer('failed_jobs').notNull().default(0),

  // ─── Config ────────────────────────────────────────────────────────
  fitThreshold:    integer('fit_threshold').notNull().default(70),
  // Minimum fit score (1-100) to trigger materials generation

  // ─── Output ────────────────────────────────────────────────────────
  summaryTable:    text('summary_table'),  // markdown table of results, generated at completion
  warnings:        text('warnings'),       // serialised JSON array — uncertain claims, API failures

  createdAt:       now('created_at'),
  updatedAt:       text('updated_at').$defaultFn(() => new Date().toISOString()),
});
```

### 2.6 Entity Relationship Diagram

```
users
  │
  ├── jobApplications (1:many)
  │     │
  │     ├── companyResearch (1:1)
  │     │
  │     ├── fitAssessments (1:1)
  │     │     └── references examples via exampleIdsUsed (JSON)
  │     │
  │     └── generatedMaterials (1:many — one per type, versioned)
  │           └── references examples via exampleIdsUsed (JSON)
  │
  ├── batchRuns (1:many)
  │     └── jobApplications reference batchRuns via batchId
  │
  └── examples (Phase 1 — read-only from Phase 2 perspective)
        └── used as evidence by fitAssessments and generatedMaterials
```

### 2.7 Data Contract Layer Map (Phase 2)

| Table | Column | Layer | Notes |
|-------|--------|-------|-------|
| `jobApplications` | `jobTitle`, `companyName`, `jobUrl`, `jobDescription`, `salary`, `location` | **USER** | User-provided or scraped from listing |
| `jobApplications` | `researchedAt`, `assessedAt`, `materialsAt`, `fitScoreOverall`, `fitArchetype` | SYSTEM | Set by pipeline steps |
| `jobApplications` | `status`, `notes` | **USER** | User workflow management |
| `jobApplications` | `batchId` | SYSTEM | Set by batch mode |
| `companyResearch` | all structured fields | SYSTEM | Pipeline output, regeneratable |
| `companyResearch` | `sources` | SYSTEM | Audit trail for research provenance |
| `fitAssessments` | all dimension scores | SYSTEM | Pipeline output, regeneratable |
| `fitAssessments` | `weights` | **USER** | Default weights now, user-configurable later |
| `generatedMaterials` | `content` | SYSTEM | Generated content, user may edit post-generation |
| `generatedMaterials` | `version` | SYSTEM | Auto-incremented on regeneration |
| `batchRuns` | all | SYSTEM | Pipeline orchestration state |

**Rule:** Phase 2 NEVER writes to Phase 1 tables. The example bank is read-only from the APPLY loop perspective. If a user edits an example after materials were generated, the materials are stale — the UI shows a "source data changed" indicator using `promptHash`.

---

## 3. API Routes

All routes require authentication via `auth()`. All follow the existing pattern: check `session.user.id`, filter by `userId`, return 401/404 as appropriate.

### 3.1 POST /api/applications

Create a new job application. Optionally scrape the job listing URL.

**Auth:** Required

**Request body:**
```typescript
{
  jobTitle: string;              // required
  companyName: string;           // required
  jobDescription?: string;       // required if jobUrl is not provided
  jobUrl?: string;               // if provided and jobDescription is empty, scrape via Firecrawl
  salary?: string;
  location?: string;
}
```

**Behaviour:**
- If `jobUrl` is provided and `jobDescription` is empty, scrape the URL via Firecrawl to extract the listing text
- If both `jobUrl` and `jobDescription` are provided, use the provided text (user paste takes priority)
- Scraping failure is non-fatal — create the application with empty `jobDescription` and return a warning
- Encrypt `jobDescription` if `ENCRYPTION_KEY` is set

**Response 201:**
```typescript
{
  application: JobApplication;
  scraped: boolean;         // true if jobDescription came from Firecrawl
  warning?: string;         // if scraping failed
}
```

**Errors:** 400 missing fields, 400 neither jobUrl nor jobDescription provided, 401, 500

---

### 3.2 GET /api/applications

List user's job applications with filtering.

**Auth:** Required

**Query params:**
```
?status=researching          // filter by status
?batch_id=cuid               // filter by batch
?company=Moonpig             // partial match on companyName
?min_fit=70                  // minimum fitScoreOverall
?limit=20&offset=0
?order=created_at_desc       // default | fit_score_desc | company_asc
```

**Response 200:** `{ applications: JobApplication[], total: number }`

---

### 3.3 GET /api/applications/[id]

Get a single application with all related data.

**Auth:** Required (ownership check)

**Response 200:**
```typescript
{
  application: JobApplication;
  research: CompanyResearch | null;
  assessment: FitAssessment | null;
  materials: GeneratedMaterial[];
}
```

---

### 3.4 PATCH /api/applications/[id]

Update user-editable fields (status, notes, salary, location).

**Auth:** Required (ownership check)

**Request body (all optional):**
```typescript
{
  jobTitle?: string;
  companyName?: string;
  salary?: string;
  location?: string;
  status?: ApplicationStatus;
  notes?: string;
}
```

**Response 200:** `{ application: JobApplication }`

---

### 3.5 DELETE /api/applications/[id]

Deletes the application and cascades to research, assessment, and materials.

**Auth:** Required (ownership check)

**Response 204:** No content

---

### 3.6 POST /api/applications/[id]/research

Run company research for a specific application. This is the first pipeline step.

**Auth:** Required (ownership check)

**Request body:**
```typescript
{
  force?: boolean;  // re-run even if already researched
}
```

**What it does (within 60s budget):**

1. **Validate** — load application, verify ownership, check if already researched (return 409 unless `force`)
2. **Extract company name and URL** from the application
3. **Run three data-gathering tasks in parallel** via `Promise.allSettled`:
   - **Jina Reader:** Scrape company website homepage + careers/about page via `r.jina.ai` (2 requests max, returns markdown)
   - **Companies House:** Search by company name, fetch company profile + filing history (3 requests max, rate-limited to 2/sec)
   - **Gemini Flash:** Grounded search for recent news, funding rounds, culture signals (2 queries with `googleSearch` tool)
4. **Synthesise** — pass all gathered data to Claude Sonnet 4.5 with a structured output schema
5. **Write** — INSERT `companyResearch` row, UPDATE `jobApplications.researchedAt`

**Timing budget:**
- Jina Reader: 2-6s (2 pages via r.jina.ai)
- Companies House: 2-4s (3 sequential requests at 2/sec)
- Gemini Flash grounded search: 3-8s (2 queries with googleSearch tool)
- Claude synthesis: 3-8s
- **Total: 10-26s** — well within 60s

**Response 200:**
```typescript
{
  research: CompanyResearch;
  sources_used: number;
  warnings: string[];  // e.g., "Companies House returned no results — company may be non-UK"
}
```

**Errors:** 400 missing id, 404, 409 already researched, 500 (all external services failed — at least one must succeed)

---

### 3.7 POST /api/applications/[id]/assess

Run fit assessment for a specific application. Requires company research to exist.

**Auth:** Required (ownership check)

**Request body:**
```typescript
{
  force?: boolean;
  weights?: Record<string, number>;  // override default weights for this assessment
}
```

**What it does:**

1. **Validate** — load application + research, verify ownership, check if already assessed
2. **Load user context:**
   - All user examples from Turso (question, answer, quality rating, tags)
   - Consistency entries (to cross-reference claims)
   - Company research data
3. **Detect archetype** — Claude analyses the job description to classify the role archetype (exec, IC, portfolio, advisory, hybrid). This shapes the scoring rubric.
4. **Score 8 dimensions** — single Claude call with structured output:
   - Each dimension gets a 1-10 score, evidence text, and confidence level
   - Dimensions with insufficient data get `confidence: "low"` and are labelled "unverified" in the UI
   - Red flags are explicitly surfaced (e.g., "Role requires 5+ years people management; your examples show 2 years")
5. **Calculate overall score** — weighted average using provided or default weights, stored as integer 1-100
6. **Write** — INSERT `fitAssessments` row, UPDATE `jobApplications.assessedAt`, `fitScoreOverall`, `fitArchetype`

**Response 200:**
```typescript
{
  assessment: FitAssessment;
  archetype: string;
  overall_score: number;  // 1-100
  red_flags: string[];
  green_flags: string[];
}
```

**Errors:** 400, 404, 409, 422 (no research — run research first), 500

---

### 3.8 POST /api/applications/[id]/materials

Generate tailored materials for a specific application. Requires fit assessment to exist and score >= threshold.

**Auth:** Required (ownership check)

**Request body:**
```typescript
{
  types: ('cv' | 'cover_letter' | 'tracking_note')[];  // which materials to generate
  fitThreshold?: number;   // override default 70 (1-100 scale)
  force?: boolean;         // regenerate even if materials exist
  masterCv?: string;       // user's master CV text (markdown), used as template for tailored CV
}
```

**What it does:**

1. **Validate** — load application + research + assessment, verify ownership
2. **Gate check** — if `fitScoreOverall < fitThreshold`, return 422 with explanation
3. **Load relevant examples** — select examples whose tags/embeddings match the job description. Use vector similarity (same as `/api/match`) to find the top 10 most relevant examples.
4. **Generate each requested material type** — sequential Claude calls (each ~5-10s):

   **Tailored CV (`cv`):**
   - Input: master CV template + top 10 relevant examples + job description + fit assessment
   - Output: reordered CV with relevant experience emphasised, irrelevant sections de-prioritised
   - Constraint: never fabricate experience. Only reorder and emphasise.

   **Cover Letter (`cover_letter`):**
   - Input: company research + fit assessment green flags + top 5 relevant examples + job description
   - Output: three-paragraph structure:
     1. Opening hook tied to company-specific insight from research
     2. Two proof points from example bank, mapped to job requirements
     3. Forward-looking close with specific contribution statement
   - Style: direct, human voice, no "I am writing to express my interest"

   **Tracking Note (`tracking_note`):**
   - Input: all pipeline outputs (research + assessment + materials summary)
   - Output: Obsidian-compatible markdown with frontmatter:
     ```yaml
     ---
     company: "Acme Corp"
     role: "Head of Product"
     fit_score: 82
     status: applying
     applied_date:
     next_step:
     ---
     ```
   - Body: research summary, fit scores table, key talking points, red flags to address, reminders

5. **Write** — INSERT `generatedMaterials` rows (one per type), UPDATE `jobApplications.materialsAt`
6. **Version handling** — if materials already exist for a type and `force` is true, increment version and insert new row

**Response 200:**
```typescript
{
  materials: GeneratedMaterial[];
  examples_used: number;
  warnings: string[];  // e.g., "No master CV provided — generated from examples only"
}
```

**Errors:** 400, 404, 409 materials exist (use force), 422 fit below threshold, 422 no assessment, 500

---

### 3.9 POST /api/batch

Create and run a batch processing operation.

**Auth:** Required

**Request body:**
```typescript
{
  markdown: string;        // markdown containing multiple job listings
  fitThreshold?: number;   // default 70 (1-100 scale) — skip materials below this
}
```

**Markdown format expected:**

```markdown
## Head of Product — Moonpig
https://example.com/job/123
London / hybrid, £120-140k

## Senior PM — Deliveroo
Pasted job description here...
Multiple paragraphs are fine.

## VP Product — Monzo
https://another-url.com/job/456
```

Each `##` heading starts a new listing. First line after heading is either a URL (scraped) or the start of a pasted description. Optional metadata line for location/salary.

**What it does:**

1. **Parse** — extract individual listings from the markdown. Each `##` becomes a `jobApplication`.
2. **Create batch run** — INSERT `batchRuns` row with `totalJobs` count
3. **Create applications** — INSERT one `jobApplications` row per listing, all with `batchId` set
4. **Return immediately** — the response contains the batch ID and created application IDs. The client polls for progress.

**Response 201:**
```typescript
{
  batch: BatchRun;
  applications: { id: string; jobTitle: string; companyName: string }[];
}
```

The client then calls `POST /api/batch/[id]/run` to start processing.

---

### 3.10 POST /api/batch/[id]/run

Start or resume processing a batch. Each application goes through research -> assess -> materials (if above threshold). The client polls `GET /api/batch/[id]` for progress.

**Auth:** Required (ownership check)

**Request body:**
```typescript
{
  masterCv?: string;  // passed through to materials generation
}
```

**What it does:**

1. **Load** all applications for this batch, sorted by creation order
2. **Process one application at a time** (sequential, not parallel — respects rate limits and keeps each invocation under 60s):
   - Run research (skip if already done)
   - Run assessment (skip if already done)
   - If `fitScoreOverall >= fitThreshold`, run materials generation (CV + cover letter + tracking note)
3. **Update batch progress** — increment `completedJobs` or `failedJobs` after each application
4. **Early return** — process only as many applications as fit within a ~50s budget. Return with `status: 'running'` if more remain. Client calls again to continue.

**Response 200:**
```typescript
{
  batch: BatchRun;
  processed_this_call: number;
  remaining: number;
}
```

---

### 3.11 GET /api/batch/[id]

Get batch status and summary.

**Auth:** Required (ownership check)

**Response 200:**
```typescript
{
  batch: BatchRun;
  applications: (JobApplication & {
    fitScoreOverall: number | null;
    materialsGenerated: boolean;
  })[];
}
```

---

## 4. External Service Integration

### 4.1 Service Client Architecture

Each external service gets its own module under `src/lib/services/`. Service clients handle authentication, rate limiting, error handling, and response normalisation. They are stateless — no connection pooling required.

```
src/lib/services/
├── companies-house.ts     // Companies House API client
├── jina-reader.ts        // Jina AI Reader URL→markdown client
└── gemini-search.ts      // Gemini Flash with Google Search grounding
```

### 4.2 Companies House API

**API:** `https://api.company-information.service.gov.uk`
**Auth:** HTTP Basic Auth — API key as username, empty password
**Rate limit:** 2 requests per second (enforced by CH, not us)
**Cost:** Free

```typescript
// src/lib/services/companies-house.ts

interface CompaniesHouseConfig {
  apiKey: string;
  baseUrl: string;  // 'https://api.company-information.service.gov.uk'
}

interface CompanySearchResult {
  company_number: string;
  title: string;
  company_status: string;
  date_of_creation: string;
  address_snippet: string;
}

interface CompanyProfile {
  company_number: string;
  company_name: string;
  type: string;           // 'ltd', 'plc', etc.
  company_status: string; // 'active', 'dissolved', etc.
  date_of_creation: string;
  registered_office_address: object;
  sic_codes: string[];    // Standard Industrial Classification
  accounts: {
    last_accounts: { made_up_to: string; type: string };
    next_due: string;
  };
  confirmation_statement: {
    last_made_up_to: string;
    next_due: string;
  };
}

export class CompaniesHouseClient {
  // Search for a company by name — returns top 5 matches
  async searchCompany(name: string): Promise<CompanySearchResult[]>

  // Get full company profile by company number
  async getCompanyProfile(companyNumber: string): Promise<CompanyProfile>

  // Get filing history (last 5 entries — useful for recent accounts)
  async getFilingHistory(companyNumber: string, limit?: number): Promise<FilingEntry[]>
}
```

**Rate limit enforcement:**

```typescript
// Simple token bucket — 2 requests per second
class RateLimiter {
  private lastRequestTime = 0;
  private readonly minInterval = 500; // 2 req/sec = 500ms between requests

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }
    this.lastRequestTime = Date.now();
  }
}
```

**Error handling:**
- 404: Company not found — non-fatal. Return empty result with warning "Company not found on Companies House — may be non-UK or use a different registered name."
- 429: Rate limited — retry after 1s, max 2 retries
- 5xx: Companies House is down — non-fatal. Log warning, continue with other sources.

### 4.3 Jina AI Reader

**API:** `https://r.jina.ai/{url}` — prepend to any URL, returns clean markdown
**Auth:** Optional API key via `Authorization: Bearer` header (free key = 500 RPM, 10M tokens)
**Cost:** Free (no API key: 20 RPM; with free key: 500 RPM, 10M tokens on signup)
**Package:** None — plain `fetch()` call

```typescript
// src/lib/services/jina-reader.ts

export class JinaReaderClient {
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  // Scrape a single URL and return markdown content
  async scrapeUrl(url: string): Promise<{
    markdown: string;
    title: string;
    sourceUrl: string;
    scrapedAt: string;
  }>

  // Scrape a job listing URL — extracts structured job data
  async scrapeJobListing(url: string): Promise<{
    jobTitle: string;
    companyName: string;
    description: string;
    salary?: string;
    location?: string;
  }>

  // Scrape company website pages (homepage + about/careers)
  async scrapeCompanyPages(companyUrl: string): Promise<{
    homepage: string;     // markdown
    aboutPage: string;    // markdown (if found)
    careersPage: string;  // markdown (if found)
  }>
}
```

**Implementation:**
```typescript
async scrapeUrl(url: string) {
  const headers: Record<string, string> = { 'Accept': 'text/markdown' };
  if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
  const res = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Jina Reader error: ${res.status}`);
  const markdown = await res.text();
  return { markdown, title: '', sourceUrl: url, scrapedAt: new Date().toISOString() };
}
```

**Page discovery strategy for company research:**
1. Scrape the homepage URL via Jina Reader
2. From the scraped markdown, extract links matching `/about`, `/careers`, `/team`, `/values`, `/culture` patterns
3. Scrape the best-matching link (one additional request)
4. Total: 2 Jina requests per company research run

**Error handling:**
- Timeout (>15s): Abort and continue with other sources
- 403/Blocked: Some sites block scrapers. Non-fatal — log warning, rely on Gemini grounding and Companies House.
- Rate limit (429): Retry once after 1s. If using free key, 500 RPM is generous.

### 4.4 Gemini Flash with Google Search Grounding

**Package:** `@google/generative-ai`
**Auth:** Google AI Studio API key (free tier)
**Cost:** Free — 500 grounded requests/day on Gemini Flash
**Model:** `gemini-2.5-flash` with `tools: [{ googleSearch: {} }]`

```typescript
// src/lib/services/gemini-search.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiSearchClient {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  // Search for recent news about a company (last 12 months)
  async searchCompanyNews(companyName: string): Promise<{
    results: Array<{
      title: string;
      url: string;
      text: string;       // snippet
      publishedDate: string;
    }>;
  }>

  // Search for culture/employee signals
  async searchCompanyCulture(companyName: string): Promise<{
    results: Array<{
      title: string;
      url: string;
      text: string;
    }>;
  }>
}
```

**Implementation:**
```typescript
async searchCompanyNews(companyName: string) {
  const model = this.genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });
  const prompt = `Find recent news about "${companyName}" from the last 12 months. Focus on: funding rounds, acquisitions, product launches, partnerships, leadership changes. Return a JSON array of { title, url, text, publishedDate } objects. Maximum 5 results.`;
  const result = await model.generateContent(prompt);
  // Parse grounded response with citations
  return { results: parseGeminiSearchResults(result) };
}
```

**Search queries (structured prompts, not user-generated):**
- News: `"Find recent news about {companyName} from the last 12 months..."` — Gemini uses Google Search grounding to find and cite real results
- Culture: `"Find employee reviews, culture signals, and workplace information about {companyName}..."` — grounded in Glassdoor, LinkedIn, careers pages

**Error handling:**
- API error: Non-fatal. Research continues with Jina Reader + Companies House data.
- Empty results: Expected for small/private companies. Log, do not warn the user.
- Rate limit (500/day): More than sufficient for a single-user app. Log if exceeded.

### 4.5 Service Initialisation

All service clients are lazy-initialised singletons. If the API key is missing, the client throws on first use — it is not imported until needed.

```typescript
// src/lib/services/index.ts

import { CompaniesHouseClient } from './companies-house';
import { JinaReaderClient } from './jina-reader';
import { GeminiSearchClient } from './gemini-search';

let _companiesHouse: CompaniesHouseClient | null = null;
let _jinaReader: JinaReaderClient | null = null;
let _geminiSearch: GeminiSearchClient | null = null;

export function getCompaniesHouseClient(): CompaniesHouseClient {
  if (!_companiesHouse) {
    const key = process.env.COMPANIES_HOUSE_API_KEY;
    if (!key) throw new Error('COMPANIES_HOUSE_API_KEY not set');
    _companiesHouse = new CompaniesHouseClient({
      apiKey: key,
      baseUrl: 'https://api.company-information.service.gov.uk',
    });
  }
  return _companiesHouse;
}

export function getJinaReaderClient(): JinaReaderClient {
  if (!_jinaReader) {
    // Jina Reader works without an API key (20 RPM), but a free key gets 500 RPM
    const key = process.env.JINA_API_KEY;  // optional
    _jinaReader = new JinaReaderClient(key);
  }
  return _jinaReader;
}

export function getGeminiSearchClient(): GeminiSearchClient {
  if (!_geminiSearch) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error('GEMINI_API_KEY not set');
    _geminiSearch = new GeminiSearchClient(key);
  }
  return _geminiSearch;
}
```

### 4.6 Graceful Degradation Matrix

| Service | If missing API key | If API returns error | If timeout |
|---------|-------------------|---------------------|------------|
| Companies House | Skip CH data. Warning: "No Companies House API key — UK company data unavailable." | Skip CH data. Warning in response. | Skip after 10s. |
| Jina Reader | Works without key (20 RPM). If service down, skip scraping — user must paste job description. Research uses Gemini + CH only. | Skip that URL. Warning in response. | Skip after 15s. |
| Gemini Flash | Skip news/culture search. Research uses Jina Reader + CH only. | Skip. Warning in response. | Skip after 10s. |
| Anthropic | **Fatal.** Cannot synthesise research or run assessment. Return 503. | Retry once. If second attempt fails, return 503. | Retry once with shorter input (truncate scraped content). |

**Minimum viable research:** At least ONE of (Jina Reader, Gemini Search, Companies House) must return data. If all three fail, return 503 with error "Could not gather any company data. Check your API keys and try again."

---

## 5. Pipeline Architecture

### 5.1 Step-Based Execution Model

The pipeline is NOT a single long-running job. Each step is an independent API call, orchestrated by the client (browser).

```
Client (browser)                         Server (API routes)
─────────────────                        ────────────────────

1. POST /api/applications
   { jobTitle, companyName, ... }  ──▶   Create application row
                                   ◀──   { application }

2. POST /api/applications/[id]/research
   { }                             ──▶   Run 3 external services + Claude synthesis
                                   ◀──   { research, warnings }
                                         (~10-25s)

3. POST /api/applications/[id]/assess
   { weights? }                    ──▶   Load examples + research, Claude scoring
                                   ◀──   { assessment, red_flags, green_flags }
                                         (~8-15s)

4. POST /api/applications/[id]/materials
   { types, masterCv? }           ──▶   Claude generates each material type
                                   ◀──   { materials }
                                         (~15-30s)
```

**Why client-orchestrated, not server-orchestrated:**

1. **Timeout safety** — each step fits within 60s individually. A single function running all steps would exceed 60s for most roles.
2. **Resumability** — if research succeeds but assessment fails (e.g., Claude rate limit), the user can retry assessment without re-running research.
3. **User control** — the user can review research output before deciding to run assessment. They might edit the company name or add notes between steps.
4. **Progress feedback** — the client shows step-by-step progress (research spinning, assessment spinning, materials spinning).

### 5.2 Batch Mode Orchestration

Batch mode differs from single-role flow because it processes multiple applications. The challenge: Vercel's 60s timeout means a single function call cannot process even two applications end-to-end.

**Solution: Chunked processing with client polling.**

```
Client                                    Server
──────                                    ──────

1. POST /api/batch
   { markdown }                    ──▶    Parse markdown → create N applications
                                   ◀──    { batch, applications[] }

2. POST /api/batch/[id]/run
   { masterCv? }                   ──▶    Process applications[0..K]
                                          (as many as fit in ~50s)
                                   ◀──    { processed: K, remaining: N-K }

3. (poll) POST /api/batch/[id]/run ──▶    Process applications[K..K+J]
                                   ◀──    { processed: J, remaining: N-K-J }

... repeat until remaining == 0 ...

4. GET /api/batch/[id]             ──▶    Return final summary
                                   ◀──    { batch, applications[] }
```

**Processing order within each chunk:**
1. Research all applications first (embarrassingly parallel within rate limits, but sequential to stay under 60s)
2. Assess all researched applications
3. Generate materials for applications above threshold

**Why sequential within each function call, not parallel:**
- Companies House: 2 req/sec rate limit. Parallel requests hit 429.
- Firecrawl: metered API. Parallel scraping is expensive and may hit rate limits.
- Claude: concurrent requests are fine, but each takes 5-10s. Two Claude calls in parallel = 10s, not 20s. But three+ concurrent calls with full context windows risk OpenAI/Anthropic rate limits.
- **Decision:** Process one application per function invocation. Simple, predictable, debuggable. For a batch of 10 roles, that is 10 polling cycles of ~15-30s each. Total wall time: 3-5 minutes. Acceptable for a batch operation.

### 5.3 Pipeline State Machine

Each `jobApplication` row tracks its pipeline state via the three timestamp fields:

```
                    researchedAt    assessedAt      materialsAt
                    ────────────    ──────────      ───────────
Created             null            null            null
Research done       "2026-04-19"    null            null
Assessment done     "2026-04-19"    "2026-04-19"    null
Materials done      "2026-04-19"    "2026-04-19"    "2026-04-19"

Research failed     null            null            null
                    (retry: call research again)

Assessment failed   "2026-04-19"    null            null
                    (retry: call assess again — research is preserved)
```

No separate `pipelineStatus` enum. The three timestamps ARE the state. The API checks:
- Research endpoint: rejects if `researchedAt` is set (unless `force`)
- Assess endpoint: rejects if `researchedAt` is null (prerequisite)
- Materials endpoint: rejects if `assessedAt` is null (prerequisite)

---

## 6. Data Flow: BUILD Loop to APPLY Loop

### 6.1 How Examples Feed Fit Assessment

The fit assessment needs to evaluate the user's experience against the job requirements. It does this by:

1. **Vector similarity match** — generate embedding of the job description, query Upstash Vector for the user's top 20 most relevant examples (same mechanism as Phase 1's `/api/match`)
2. **Full example load** — fetch all matched example rows from Turso with their tags, quality ratings, and STAR breakdowns
3. **Context window assembly** — pack the job description, company research, and top examples into a single Claude prompt
4. **Dimension scoring** — Claude scores each dimension using the examples as evidence

This means:
- Examples with embeddings contribute to scoring. Examples without embeddings are invisible to the fit assessment.
- Quality ratings inform confidence. If the user has rated an example "strong", it carries more weight. "Weak" examples are mentioned as development areas.
- STAR breakdowns, when present, give Claude richer evidence to work with.

### 6.2 How Examples Feed Materials Generation

**Tailored CV:**
- Top 10 examples by vector similarity to the job description
- Examples are used to identify which experience areas to emphasise
- STAR breakdowns are used to flesh out achievement bullet points

**Cover Letter:**
- Top 5 examples, filtered to those with quality rating "strong"
- Used as proof points in the second paragraph
- The cover letter generator is explicitly instructed to quote specific achievements from the examples, not to fabricate

**Tracking Note:**
- Does not directly use examples — it summarises the research and assessment outputs

### 6.3 Consistency Integration

The fit assessment also checks `consistencyEntries` for the target company. If the user has previously claimed different compensation figures or leaving reasons to this company, the assessment surfaces that as a red flag.

---

## 7. Prompt Architecture

New prompts live in `src/lib/prompts/` alongside the Phase 1 prompts.

### 7.1 New Prompt Files

```
src/lib/prompts/
├── extraction-pass1.ts     (existing)
├── extraction-pass2.ts     (existing)
├── tagging.ts              (existing)
├── consistency.ts          (existing)
├── matching.ts             (existing)
├── mirror.ts               (existing)
├── research-synthesis.ts   (new — Phase 2)
├── fit-assessment.ts       (new — Phase 2)
├── materials-cv.ts         (new — Phase 2)
├── materials-cover.ts      (new — Phase 2)
└── materials-tracking.ts   (new — Phase 2)
```

### 7.2 Prompt Design Principles

All Phase 2 prompts follow the same conventions as Phase 1:

1. **Structured output via tool use** — every prompt uses `callWithTool<T>()` with a JSON schema. No free-text parsing.
2. **System prompt sets role and constraints.** User message provides data.
3. **Explicit "say unverified, not guess" instructions** — every prompt that generates assessments includes: "If you lack sufficient data for a dimension, assign confidence: 'low'. Do not fabricate evidence. Say 'Insufficient data to assess' rather than guessing."
4. **Anti-slop directive** — materials generation prompts include: "Write in a direct, human voice. Do not use phrases like 'I am writing to express my interest', 'leverage my experience', 'synergize', 'passionate about', 'cutting-edge', or 'dynamic environment'. Be specific. Every sentence must contain a concrete fact, number, or outcome."
5. **Token budget awareness** — company research can produce 5,000-10,000 tokens of raw scraped text. The synthesis prompt truncates inputs to fit within 16k output tokens:
   - Scraped website content: 3,000 tokens max (first 3k chars of markdown)
   - Companies House data: 1,000 tokens max
   - Exa results: 2,000 tokens max (top 5 results, 400 chars each)
   - Job description: 2,000 tokens max
   - Examples (for assessment): 200 tokens each, max 20 = 4,000 tokens

---

## 8. Encryption (Phase 2 Fields)

Apply the same AES-256-GCM pattern from Phase 1. New encrypt/decrypt wrappers in `src/lib/encryption/index.ts`:

```typescript
// Add to existing encryption module

export interface EncryptedResearchFields {
  recentNews: string;
  cultureSignals: string;
  keyPeople: string;
}

export function encryptResearchFields(fields: {
  recentNews: string;
  cultureSignals: string;
  keyPeople: string;
}): EncryptedResearchFields {
  return {
    recentNews:     serialise(encrypt(fields.recentNews)),
    cultureSignals: serialise(encrypt(fields.cultureSignals)),
    keyPeople:      serialise(encrypt(fields.keyPeople)),
  };
}

export function decryptResearchFields(fields: EncryptedResearchFields): {
  recentNews: string;
  cultureSignals: string;
  keyPeople: string;
} {
  return {
    recentNews:     decrypt(deserialise(fields.recentNews)),
    cultureSignals: decrypt(deserialise(fields.cultureSignals)),
    keyPeople:      decrypt(deserialise(fields.keyPeople)),
  };
}

export interface EncryptedMaterialFields {
  content: string;
}

export function encryptMaterialFields(fields: { content: string }): EncryptedMaterialFields {
  return { content: serialise(encrypt(fields.content)) };
}

export function decryptMaterialFields(fields: EncryptedMaterialFields): { content: string } {
  return { content: decrypt(deserialise(fields.content)) };
}
```

**What gets encrypted:**
- `companyResearch`: `recentNews`, `cultureSignals`, `keyPeople` (contain personal names and company intel)
- `generatedMaterials`: `content` (contains the user's tailored CV and cover letter)
- `fitAssessments`: NOT encrypted (scores and evidence are not PII; they reference example IDs, not content)
- `jobApplications`: `jobDescription` is encrypted (may contain salary data and internal company info)

---

## 9. TypeScript Types (Phase 2)

```typescript
// Additions to src/lib/types/index.ts

// ─── Phase 2: APPLY loop types ──────────────────────────────────────────────

export type ApplicationStatus =
  | 'researching' | 'assessed' | 'applying'
  | 'applied' | 'interviewing' | 'rejected'
  | 'offer' | 'withdrawn';

export type RoleArchetype = 'exec' | 'ic' | 'portfolio' | 'advisory' | 'hybrid';

export type MaterialType = 'cv' | 'cover_letter' | 'tracking_note';

export type DimensionConfidence = 'high' | 'medium' | 'low';

export interface DimensionScore {
  score: number;              // 1-10
  evidence: string;           // 1-3 sentence explanation
  confidence: DimensionConfidence;
}

export interface FitWeights {
  domain: number;      // default 15
  seniority: number;   // default 15
  scope: number;       // default 15
  technical: number;   // default 10
  mission: number;     // default 10
  location: number;    // default 15
  compensation: number; // default 10
  culture: number;     // default 10
}

export const DEFAULT_FIT_WEIGHTS: FitWeights = {
  domain: 15,
  seniority: 15,
  scope: 15,
  technical: 10,
  mission: 10,
  location: 15,
  compensation: 10,
  culture: 10,
};

export interface ResearchSource {
  url: string;
  source_type: 'firecrawl' | 'companies_house' | 'exa' | 'user_provided';
  fetched_at: string;  // ISO-8601
}

export interface JobApplication {
  id: string;
  userId: string;
  jobTitle: string;
  companyName: string;
  jobUrl: string | null;
  jobDescription: string;
  salary: string | null;
  location: string | null;
  researchedAt: string | null;
  assessedAt: string | null;
  materialsAt: string | null;
  fitScoreOverall: number | null;
  fitArchetype: RoleArchetype | null;
  status: ApplicationStatus;
  notes: string | null;
  batchId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyResearch {
  id: string;
  jobApplicationId: string;
  userId: string;
  companySize: string | null;
  fundingStage: string | null;
  revenue: string | null;
  foundedYear: string | null;
  headquarters: string | null;
  industry: string | null;
  recentNews: string | null;
  techStack: string | null;
  cultureSignals: string | null;
  keyPeople: string | null;
  missionAndValues: string | null;
  sources: ResearchSource[];
  companiesHouseNumber: string | null;
  companiesHouseData: object | null;
  createdAt: string;
  updatedAt: string;
}

export interface FitAssessment {
  id: string;
  jobApplicationId: string;
  userId: string;
  archetype: RoleArchetype;
  archetypeRationale: string | null;
  dimDomainIndustry: DimensionScore;
  dimSeniority: DimensionScore;
  dimScope: DimensionScore;
  dimTechnical: DimensionScore;
  dimMission: DimensionScore;
  dimLocation: DimensionScore;
  dimCompensation: DimensionScore;
  dimCulture: DimensionScore;
  overallScore: number;         // 1-100
  weights: FitWeights;
  redFlags: string[];
  greenFlags: string[];
  exampleIdsUsed: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedMaterial {
  id: string;
  jobApplicationId: string;
  userId: string;
  type: MaterialType;
  content: string;
  version: number;
  exampleIdsUsed: string[];
  promptHash: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchRun {
  id: string;
  userId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  fitThreshold: number;
  summaryTable: string | null;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Phase 2: API Request/Response shapes ────────────────────────────────────

export interface CreateApplicationRequest {
  jobTitle: string;
  companyName: string;
  jobDescription?: string;
  jobUrl?: string;
  salary?: string;
  location?: string;
}

export interface RunResearchRequest {
  force?: boolean;
}

export interface RunAssessmentRequest {
  force?: boolean;
  weights?: Partial<FitWeights>;
}

export interface GenerateMaterialsRequest {
  types: MaterialType[];
  fitThreshold?: number;
  force?: boolean;
  masterCv?: string;
}

export interface CreateBatchRequest {
  markdown: string;
  fitThreshold?: number;
}

export interface RunBatchRequest {
  masterCv?: string;
}
```

---

## 10. New Environment Variables

```bash
# Phase 2: External services (all free)
COMPANIES_HOUSE_API_KEY=[key]          # UK Companies House API (free, register at https://developer.company-information.service.gov.uk/)
JINA_API_KEY=[key]                     # Jina AI Reader (optional — works without key at 20 RPM, free key gets 500 RPM)
GEMINI_API_KEY=[key]                   # Google AI Studio API key (free tier, 500 grounded searches/day)
FIT_THRESHOLD_DEFAULT=70               # Minimum fit score (1-100) to gate materials generation
```

**All external service keys are optional.** The pipeline degrades gracefully (see Section 4.6). At minimum, the user can paste a job description and the system runs assessment + materials without external research. Jina Reader even works without a key (just at lower rate limit).

---

## 11. File Structure (Phase 2 Additions)

```
src/
├── app/
│   ├── (app)/
│   │   ├── applications/              Phase 2 pages
│   │   │   ├── page.tsx               Application list / kanban
│   │   │   ├── new/page.tsx           Create new application
│   │   │   └── [id]/
│   │   │       ├── page.tsx           Application detail — pipeline view
│   │   │       ├── research/page.tsx  Research results view
│   │   │       ├── fit/page.tsx       Fit assessment radar chart
│   │   │       └── materials/page.tsx Generated materials with copy/export
│   │   └── batch/
│   │       ├── page.tsx               Batch input + progress
│   │       └── [id]/page.tsx          Batch results summary table
│   │
│   └── api/
│       ├── applications/
│       │   ├── route.ts               GET (list) + POST (create)
│       │   └── [id]/
│       │       ├── route.ts           GET + PATCH + DELETE
│       │       ├── research/route.ts  POST — run company research
│       │       ├── assess/route.ts    POST — run fit assessment
│       │       └── materials/route.ts POST — generate materials
│       └── batch/
│           ├── route.ts               POST — create batch
│           └── [id]/
│               ├── route.ts           GET — batch status
│               └── run/route.ts       POST — run/resume batch processing
│
├── lib/
│   ├── services/
│   │   ├── index.ts                   Lazy-init service factory
│   │   ├── companies-house.ts         Companies House API client
│   │   ├── jina-reader.ts            Jina AI Reader URL→markdown client
│   │   └── gemini-search.ts          Gemini Flash with Google Search grounding
│   │
│   └── prompts/
│       ├── research-synthesis.ts      Company research synthesis prompt
│       ├── fit-assessment.ts          8-dimension fit assessment prompt
│       ├── materials-cv.ts            Tailored CV generation prompt
│       ├── materials-cover.ts         Cover letter generation prompt
│       └── materials-tracking.ts      Tracking note generation prompt
│
└── components/
    └── storybank/
        ├── ApplicationCard.tsx         Card for application list
        ├── PipelineProgress.tsx        Step-by-step pipeline progress indicator
        ├── ResearchSummary.tsx         Structured company research display
        ├── FitRadar.tsx               8-dimension radar/spider chart
        ├── DimensionScoreCard.tsx      Individual dimension with evidence
        ├── MaterialPreview.tsx         Rendered markdown preview with copy button
        ├── BatchInput.tsx             Markdown input with listing parser preview
        └── BatchSummaryTable.tsx       Sortable results table with fit scores
```

---

## 12. Migration Strategy

### 12.1 Database Migrations

Phase 2 tables are purely additive. No modifications to existing Phase 1 tables. Migration:

```bash
npx drizzle-kit generate   # generates migration SQL from schema diff
npx drizzle-kit migrate    # applies to Turso
```

All new tables use the same `id()` and `now()` helpers. Foreign keys reference existing `users.id` and new `jobApplications.id`.

### 12.2 Sidebar Navigation

The sidebar already has a BUILD and APPLY section label (from the Unified Experience build). Phase 2 adds items under APPLY:

```
BUILD
  Upload
  Transcripts
  Examples
  Mirror
  Consistency

APPLY                          ← existing label
  Match                        ← existing
  Applications                 ← NEW (Phase 2)
  Batch                        ← NEW (Phase 2)

PRACTISE                       ← existing label
  Practice                     ← existing
```

### 12.3 Rollback

- Delete Phase 2 API routes — no effect on Phase 1
- Drop Phase 2 tables — cascades clean up all Phase 2 data
- Remove sidebar nav items — BUILD and PRACTISE sections unaffected

---

## 13. Complexity Assessment

| Component | Complexity | Notes |
|-----------|-----------|-------|
| Schema: 5 new tables | Low-Medium | Follows established patterns. Drizzle handles migration. |
| Application CRUD | Low | Standard CRUD, same pattern as transcripts. |
| Company Research pipeline | **High** | 3 external APIs + rate limiting + graceful degradation + LLM synthesis. Most novel code in Phase 2. |
| Companies House client | Medium | Simple REST API, but rate limiting and UK-specific company matching add nuance. |
| Firecrawl client | Low-Medium | SDK does the heavy lifting. Page discovery logic adds some complexity. |
| Exa AI client | Low | SDK call with hardcoded queries. |
| Research synthesis prompt | Medium | Must produce structured output from heterogeneous inputs (scraped HTML, API JSON, search snippets). |
| Fit Assessment | **High** | 8-dimension scoring with archetype detection, evidence trails, confidence levels, red flag surfacing. Most complex prompt engineering in Phase 2. |
| Materials: CV | Medium-High | Must respect master CV structure, not fabricate, and emphasise correctly. Template adherence is tricky. |
| Materials: Cover Letter | Medium | Three-paragraph structure is constraining enough to get good results. Anti-slop directive is critical. |
| Materials: Tracking Note | Low | Template-driven, minimal LLM creativity needed. |
| Batch parsing | Medium | Markdown parsing with edge cases (missing URLs, multi-paragraph descriptions, missing headings). |
| Batch orchestration | Medium-High | Chunked processing with state management across multiple function invocations. Timing budget management. |
| Encryption extensions | Low | Same AES-256-GCM pattern, new field wrappers. |

**High-complexity items requiring early validation:**
1. **Company Research** — test with 10 real companies before building the UI. Verify that Companies House search returns the right entity, Firecrawl extracts useful content, and Exa returns relevant results.
2. **Fit Assessment prompt** — test with 5 real job descriptions against Claire's actual example bank. Verify scoring is calibrated (not all 8s, not all 3s).

---

## 14. Key Decisions and Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Pipeline orchestration | Client-side step-by-step, not server-side saga | Vercel 60s timeout makes server-side orchestration impossible without a queue. Client-side is simpler, gives user control, and each step is independently retryable. |
| One application per role, not per company | Application-centric | The same company can be a good fit for one role and a bad fit for another. Company research may duplicate, but fit/materials are always role-specific. |
| External service degradation | `Promise.allSettled` + minimum one source | Research should never hard-fail because Companies House is down. Graceful degradation produces useful output even with partial data. |
| Fit threshold default | Environment variable `FIT_THRESHOLD_DEFAULT`, default 70 | Easy to change without redeploy. Read once at startup. |
| Companies House rate limit | In-process token bucket (500ms interval) | Only 2-3 CH requests per research run. No need for distributed rate limiting (Redis, etc.). Simple `setTimeout` is sufficient. |
| Batch processing | Sequential per application, chunked per function call | Parallel processing hits rate limits and makes debugging hard. Sequential is slower but predictable. 10 roles in 5 minutes is fine for a batch use case. |
| Fit score storage | Integer 1-100 on `jobApplications` (denormalised) | Enables sorting and filtering applications by fit score without joining to `fitAssessments`. Display layer divides by 10. |
| Dimension scores in columns vs JSON | Separate columns per dimension | Enables future SQL queries like "show all roles where location score < 5". JSON blob would require parsing. The 8 dimensions are fixed — no extensibility needed. |
| Materials versioning | Insert new row with incremented version | Preserves history without complexity. UI shows latest version. User can view older versions if needed. |
| Master CV input | User pastes it per request, not stored | CV evolves frequently. Storing a master CV adds CRUD overhead. Paste-per-request is simpler and ensures the latest version is always used. This can become a stored entity in a future iteration. |
| Archetype detection | Pre-scoring step, not post-hoc | The archetype shapes which dimensions matter most. An IC role should weight technical higher than stakeholder management. Detection first allows the scoring rubric to adapt. |
| Anti-slop in prompts | Explicit blocklist of phrases | "Do not use 'leverage', 'synergize', etc." in the system prompt is more effective than a post-processing filter. The model understands the constraint. |
| Tracking note format | Obsidian-compatible markdown with YAML frontmatter | Matches Claire's Obsidian vault structure. Can be copy-pasted or saved directly. No custom format to learn. |
| Encryption scope | Research fields + materials content, not fit scores | Fit scores (1-10 numbers) are not PII. Research contains company intel and personal names. Materials contain the user's tailored CV. Both warrant encryption. |
| New packages | `@google/generative-ai` — one addition | Jina Reader uses plain `fetch()` (no package). Companies House uses raw `fetch`. Gemini grounding needs the Google AI SDK. No new UI dependencies — existing shadcn/ui + Tailwind cover all Phase 2 components. |

---

## 15. Accuracy Profile (Phase 2 AI Components)

| Component | Accuracy Target | How Validated | Risk if Wrong |
|-----------|----------------|---------------|---------------|
| Company research synthesis | >85% factual accuracy on structured fields | Cross-check 10 companies against manual research | Medium — wrong company size or funding stage misleads fit assessment |
| Archetype detection | >90% correct classification | Test against 20 real job descriptions | Low — user can override, and mis-classification shifts weights but does not block scoring |
| Fit dimension scoring | Calibrated 1-10 (not all clustered at 6-8) | Test with 10 known-good and known-bad matches | Medium — inflated scores lead to wasted applications |
| Red flag detection | >80% recall on genuine mismatches | Test with roles where Claire knows she is underqualified | High — missed red flags = false confidence |
| Confidence levels | "low" correctly assigned when data is insufficient | Test with minimal-info roles (no salary, no location) | Medium — false "high" confidence on guessed scores |
| CV tailoring | Zero fabricated experience | Manual review of 5 generated CVs against master | **Critical** — fabricated experience is career-ending |
| Cover letter quality | Specific proof points from example bank, no generic fluff | Manual review of 5 generated letters | Medium — generic letters are useless but not harmful |
| Batch markdown parsing | >95% correct extraction of title/company/URL | Test with 10 varied markdown formats | Low — parsing errors are visible in the preview step |

**Critical validation before launch:** The CV generation prompt MUST be tested with 5 real job descriptions to verify it never fabricates roles, companies, or achievements that do not exist in the example bank or master CV. This is the highest-stakes AI component in the entire system.

---

## 16. Future Considerations (Out of Scope for Phase 2)

These are noted for awareness but are NOT in the Phase 2 build:

1. **User profile table** — a dedicated profile with career summary, target salary range, preferred locations. Currently this data is inferred from examples and consistency entries. A profile table would improve fit assessment accuracy.
2. **Stored master CV** — rather than pasting per request, store and version the master CV.
3. **Weight presets by archetype** — auto-adjust dimension weights based on detected archetype.
4. **Application pipeline webhooks** — notify when Companies House data changes or new news appears.
5. **Company research caching** — if the user applies to two roles at the same company, share the research. Requires a company-level entity separate from applications.
6. **Export to PDF** — convert generated CV and cover letter to PDF. Currently markdown-only.

---

*ARCHITECTURE-PHASE2.md -- StoryBank Phase 2 v1.0 (APPLY Loop)*
