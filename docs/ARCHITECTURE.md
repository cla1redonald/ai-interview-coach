# StoryBank — Architecture Specification

**Version:** 2.0
**Date:** 2026-04-18
**Status:** Approved for build
**Scope:** Phase 1 — Example Bank

**Stack:** Next.js 14 App Router · Turso (SQLite) + Drizzle ORM · Upstash Vector · Auth.js (NextAuth v5) · OpenAI · Anthropic API · AES-256-GCM

---

## 1. System Overview

StoryBank is built by extending the existing AI Interview Coach app (Next.js 14 App Router, stateless, no database, no auth). Phase 1 adds a persistent data layer, user authentication, and the example bank feature set on top of the working mock interview foundation.

The existing `/api/chat` and `/api/personas` routes are preserved unchanged. All new routes live in `src/app/api/` alongside them.

### Architecture Pattern

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App Router                 │
│                                                      │
│  Pages: /dashboard, /upload, /transcripts,           │
│          /examples, /mirror, /match, /consistency    │
│  Preserved: / (mock interview — unchanged)           │
│                                                      │
│  API Routes:                                         │
│  Preserved: /api/chat, /api/personas                 │
│  New:       /api/transcripts, /api/extract,          │
│             /api/extract/enrich,                     │
│             /api/examples, /api/match,               │
│             /api/mirror, /api/consistency,           │
│             /api/tags                                │
│  Auth:      /api/auth/[...nextauth]                  │
└────────────────────┬────────────────────────────────┘
                     │
    ┌────────────────┼──────────────────────┐
    │                │                      │
┌───▼──────┐  ┌──────▼──────┐  ┌───────────▼────────┐
│  Turso   │  │  Anthropic  │  │  Upstash Vector    │
│ (SQLite) │  │  API        │  │                    │
│          │  │             │  │  1024-dim vectors  │
│  Drizzle │  │  Sonnet 4.5 │  │  per-user filter   │
│  ORM     │  │  extraction │  │                    │
└──────────┘  └─────────────┘  └────────────────────┘
                                        ▲
┌──────────┐  ┌─────────────┐          │
│  Auth.js │  │  AES-256-GCM│   OpenAI generates
│ (NextAuth│  │             │   embeddings → stored
│   v5)    │  │  Field-level│   in Upstash
│  Google  │  │  encryption │
│  OAuth   │  │  (optional) │
└──────────┘  └─────────────┘
```

### Auth.js Session Flow

```
Browser → /api/auth/[...nextauth] → Auth.js handler
                                         │
                              Google OAuth redirect
                                         │
                              Session in signed JWT cookie
                                         │
API Routes: auth() helper → session.user.id
            every DB query: WHERE userId = session.user.id
```

No database-level RLS. Ownership enforced at application layer — every Drizzle query includes `where(eq(table.userId, userId))`. See Section 3.

---

## 2. Database Schema (Drizzle + Turso/SQLite)

### Design Principles

- IDs use `cuid2` (`@paralleldrive/cuid2`) — collision-resistant, URL-safe, no database sequence required
- No `vector` column on `examples` — embeddings live in Upstash Vector, keyed by `example.id`
- `sourcePosition` stored as serialized JSON text (SQLite has no native JSONB)
- `updatedAt` maintained by the application before each UPDATE call (SQLite has no `ON UPDATE` triggers in libSQL)
- System tags use `userId = null` — readable by all users, not deletable
- Timestamps stored as ISO-8601 text strings (`"YYYY-MM-DDTHH:mm:ssZ"`)
- Cascade deletes via Drizzle `references(..., { onDelete: 'cascade' })` or `set null`

### Drizzle Schema

```typescript
// src/lib/db/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// ─── Shared helpers ────────────────────────────────────────────────────────
const id  = () => text('id').primaryKey().$defaultFn(() => createId());
const now = () => text('created_at').$defaultFn(() => new Date().toISOString());

// ─── Auth.js adapter tables ────────────────────────────────────────────────
// These are required by @auth/drizzle-adapter. Auth.js manages their lifecycle.

export const users = sqliteTable('users', {
  id:            text('id').primaryKey(),
  name:          text('name'),
  email:         text('email').notNull().unique(),
  emailVerified: text('email_verified'),   // ISO datetime
  image:         text('image'),
  createdAt:     now(),
});

export const accounts = sqliteTable('accounts', {
  id:                id(),
  userId:            text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  provider:          text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  refreshToken:      text('refresh_token'),
  accessToken:       text('access_token'),
  expiresAt:         integer('expires_at'),
  tokenType:         text('token_type'),
  scope:             text('scope'),
  idToken:           text('id_token'),
  sessionState:      text('session_state'),
});

export const sessions = sqliteTable('sessions', {
  id:           id(),
  sessionToken: text('session_token').notNull().unique(),
  userId:       text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      text('expires').notNull(),
});

export const verificationTokens = sqliteTable('verification_tokens', {
  identifier: text('identifier').notNull(),
  token:      text('token').notNull(),
  expires:    text('expires').notNull(),
});

// ─── USER LAYER (never auto-updated) ──────────────────────────────────────

// Transcripts — raw interview recordings
export const transcripts = sqliteTable('transcripts', {
  id:              id(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title:           text('title').notNull(),
  rawText:         text('raw_text').notNull(),
  company:         text('company'),
  interviewerName: text('interviewer_name'),
  interviewerRole: text('interviewer_role'),
  interviewDate:   text('interview_date'),    // "YYYY-MM-DD"
  interviewRound:  text('interview_round'),   // 'screening'|'first'|'second'|'final'|'other'
  extractedAt:     text('extracted_at'),      // null = not yet extracted
  createdAt:       now(),
  updatedAt:       text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Q&A pairs extracted from transcripts
export const examples = sqliteTable('examples', {
  id:             id(),
  userId:         text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transcriptId:   text('transcript_id').references(() => transcripts.id, { onDelete: 'set null' }),
  question:       text('question').notNull(),
  answer:         text('answer').notNull(),
  // Source citation — JSON string: { "start_line": 42, "end_line": 55 }
  sourcePosition: text('source_position'),
  // User-assigned quality — NEVER auto-overwritten by extraction pipeline
  qualityRating:  text('quality_rating'),    // 'strong'|'weak'|'neutral'|null
  // STAR+Reflection — user-edited; AI pre-populates only on explicit "break down" action
  starSituation:  text('star_situation'),
  starTask:       text('star_task'),
  starAction:     text('star_action'),
  starResult:     text('star_result'),
  starReflection: text('star_reflection'),
  // NOTE: No embedding column — vectors stored in Upstash Vector, keyed by this row's id
  createdAt:      now(),
  updatedAt:      text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// ─── SYSTEM LAYER (safe to evolve) ────────────────────────────────────────

// Tags — system (userId null) and user-defined
export const tags = sqliteTable('tags', {
  id:        id(),
  userId:    text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name:      text('name').notNull(),
  isSystem:  integer('is_system', { mode: 'boolean' }).default(false),
  createdAt: now(),
});

// Example-Tag junction
export const exampleTags = sqliteTable('example_tags', {
  exampleId: text('example_id').notNull().references(() => examples.id, { onDelete: 'cascade' }),
  tagId:     text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
});

// Consistency tracker entries
export const consistencyEntries = sqliteTable('consistency_entries', {
  id:            id(),
  userId:        text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  exampleId:     text('example_id').references(() => examples.id, { onDelete: 'set null' }),
  company:       text('company').notNull(),
  topic:         text('topic').notNull(),    // 'compensation'|'leaving_reason'|'start_date'|'role_scope'
  claim:         text('claim').notNull(),
  interviewDate: text('interview_date'),
  createdAt:     now(),
});
```

### Drizzle Client

```typescript
// src/lib/db/index.ts

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
  url:       process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

export const db = drizzle(client, { schema });
```

### Drizzle Config

```typescript
// drizzle.config.ts (project root)

import type { Config } from 'drizzle-kit';

export default {
  schema:    './src/lib/db/schema.ts',
  out:       './drizzle/migrations',
  dialect:   'turso',
  dbCredentials: {
    url:       process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
} satisfies Config;
```

### Seed: System Tags

```typescript
// src/lib/db/seed.ts

import { db } from './index';
import { tags } from './schema';

const SYSTEM_TAGS = [
  'Tell me about yourself',
  'Why are you leaving?',
  'Why this role?',
  'Product strategy & prioritisation',
  'Delivery & execution',
  'OKRs & planning',
  'Stakeholder management & conflict',
  'Leadership style & team development',
  'AI adoption & hands-on experience',
  'Compensation expectations',
  'Technical depth',
  'Cross-functional / matrix working',
  'Research & discovery approach',
];

export async function seedSystemTags() {
  for (const name of SYSTEM_TAGS) {
    // Check before insert — SQLite does not support UNIQUE NULL NOT DISTINCT
    const existing = await db.select().from(tags)
      .where(and(eq(tags.name, name), isNull(tags.userId)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(tags).values({ name, isSystem: true, userId: null });
    }
  }
}
```

---

## 3. Access Control (Application Layer)

There is no database-level RLS. Every query touching user data MUST include a `userId` filter. This is enforced by convention — every API route follows the pattern below.

### Standard route pattern

```typescript
// src/app/api/[route]/route.ts

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { transcripts } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  // Always filter by userId — never omit this
  const rows = await db.select()
    .from(transcripts)
    .where(eq(transcripts.userId, userId));

  return Response.json({ transcripts: rows });
}
```

### Ownership check for single-row operations

```typescript
// For GET/PATCH/DELETE by ID — verify ownership before operating
// Returns 404 for both "not found" and "owned by another user" (prevents info leakage)
const [row] = await db.select()
  .from(transcripts)
  .where(and(
    eq(transcripts.id, id),
    eq(transcripts.userId, userId)
  ))
  .limit(1);

if (!row) return Response.json({ error: 'Not found' }, { status: 404 });
```

### System tags query

```typescript
import { or, isNull } from 'drizzle-orm';

const allTags = await db.select()
  .from(tags)
  .where(or(
    eq(tags.userId, userId),
    isNull(tags.userId)       // system tags have userId = null
  ));
```

---

## 4. Authentication (Auth.js / NextAuth v5)

### Auth.js Configuration

```typescript
// src/lib/auth.ts

import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import Google from 'next-auth/providers/google';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',   // JWT works with Edge middleware; no DB session lookup per request
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    session({ session, token }) {
      // user.id is not exposed by default — must be added here
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
```

### Auth API Route

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

### Middleware

```typescript
// middleware.ts (project root)

import { auth } from '@/lib/auth';

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isAuthenticated = !!req.auth;

  const PUBLIC_PATHS = [
    '/',
    '/login',
    '/api/auth',
    '/api/chat',       // mock interview — stays public
    '/api/personas',   // mock interview — stays public
  ];

  const isPublic = PUBLIC_PATHS.some(
    p => pathname === p || pathname.startsWith(p + '/')
  );

  if (!isAuthenticated && !isPublic) {
    return Response.redirect(new URL('/login', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 5. Data Contract Layer Map

Every field is explicitly owned by either the user layer (protected) or the system layer (safe to overwrite). This prevents AI pipeline overwrites from destroying user work.

| Table | Column | Layer | Notes |
|-------|--------|-------|-------|
| `transcripts` | `rawText` | **USER** | Never modified after upload |
| `transcripts` | `title`, `company`, `interviewerName`, `interviewerRole`, `interviewDate`, `interviewRound` | **USER** | User-provided metadata |
| `transcripts` | `extractedAt` | SYSTEM | Set when extraction pipeline runs |
| `examples` | `question`, `answer` | **USER** | User can edit post-extraction |
| `examples` | `qualityRating` | **USER** | Only ever set by explicit user action |
| `examples` | `starSituation`, `starTask`, `starAction`, `starResult`, `starReflection` | **USER** | User edits; AI pre-populates only on explicit "break down" action |
| `examples` | `sourcePosition` | SYSTEM | Set by extraction pipeline |
| Upstash Vector | embedding (keyed by `example.id`) | SYSTEM | Generated async, safe to regenerate |
| `tags` | `name`, `isSystem` | SYSTEM | System tags seeded, not user-editable |
| `tags` | `name` (user-created) | **USER** | User-defined, never auto-deleted |
| `exampleTags` | all | **USER** | Tag assignments are user-controlled |
| `consistencyEntries` | `claim`, `company`, `topic` | **USER** | User can edit/delete |
| `consistencyEntries` | (auto-extracted) | SYSTEM | Auto-populated by pipeline; user can delete |

**Rule:** The extraction pipeline may INSERT new `examples` rows. It may NEVER UPDATE existing `examples.qualityRating`, `examples.star*`, or any user-entered field. If re-extraction runs on a transcript, new pairs are inserted alongside existing ones; the user deletes duplicates.

---

## 6. TypeScript Types

```typescript
// src/lib/types/index.ts

// ─── Existing types (preserved) ───────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  id?: string;
}

export interface ChatSession {
  id: string;
  personaId: string;
  messages: Message[];
  timestamp: Date;
}

export interface Persona {
  id: string;
  name: string;
  title: string;
  icon?: string;
  content?: string;
}

// ─── New StoryBank types ───────────────────────────────────────────────────

export type InterviewRound   = 'screening' | 'first' | 'second' | 'final' | 'other';
export type QualityRating    = 'strong' | 'weak' | 'neutral';
export type ConsistencyTopic = 'compensation' | 'leaving_reason' | 'start_date' | 'role_scope';

export interface User {
  id: string;
  name: string | null;
  email: string;
  createdAt: string;
}

export interface Transcript {
  id: string;
  userId: string;
  title: string;
  rawText: string;
  company: string | null;
  interviewerName: string | null;
  interviewerRole: string | null;
  interviewDate: string | null;       // "YYYY-MM-DD"
  interviewRound: InterviewRound | null;
  extractedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourcePosition {
  start_line: number;
  end_line: number;
}

export interface Example {
  id: string;
  userId: string;
  transcriptId: string | null;
  question: string;
  answer: string;
  sourcePosition: SourcePosition | null;
  qualityRating: QualityRating | null;
  starSituation: string | null;
  starTask: string | null;
  starAction: string | null;
  starResult: string | null;
  starReflection: string | null;
  // No embedding field — stored in Upstash Vector
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];   // joined by API layer
}

export interface Tag {
  id: string;
  userId: string | null;
  name: string;
  isSystem: boolean;
  createdAt: string;
}

export interface ConsistencyEntry {
  id: string;
  userId: string;
  exampleId: string | null;
  company: string;
  topic: ConsistencyTopic;
  claim: string;
  interviewDate: string | null;
  createdAt: string;
}

// ─── API Request/Response shapes ──────────────────────────────────────────

export interface CreateTranscriptRequest {
  title: string;
  rawText: string;
  company?: string;
  interviewerName?: string;
  interviewerRole?: string;
  interviewDate?: string;
  interviewRound?: InterviewRound;
}

export interface ExtractRequest {
  transcript_id: string;
  force?: boolean;
}

export interface ExtractedPair {
  question: string;
  answer: string;
  source_start_line: number;
  source_end_line: number;
  suggested_tags: string[];
  consistency_claims?: ConsistencyClaimExtract[];
}

export interface ConsistencyClaimExtract {
  topic: ConsistencyTopic;
  claim: string;
}

export interface ExtractionResult {
  pairs: ExtractedPair[];
  extraction_warnings: string[];
}

export interface UpdateExampleRequest {
  question?: string;
  answer?: string;
  qualityRating?: QualityRating | null;
  starSituation?: string | null;
  starTask?: string | null;
  starAction?: string | null;
  starResult?: string | null;
  starReflection?: string | null;
  tagIds?: string[];
}

export interface MatchRequest {
  job_spec: string;
  match_count?: number;      // default 5, max 20
  match_threshold?: number;  // cosine similarity floor, default 0.5
}

export interface MatchResult {
  example: Example;
  similarity: number;
  explanation: string;
}

export interface GapItem {
  requirement: string;
  gap_description: string;
}

export interface MatchResponse {
  matches: MatchResult[];
  gaps: GapItem[];
  job_spec_summary: string;
}

export interface MirrorAnalysis {
  recurring_stories: StoryCluster[];
  phrase_analysis: PhraseCount[];
  pattern_recognition: PatternInsight[];
  strength_map: StrengthCategory[];
}

export interface StoryCluster {
  label: string;
  example_ids: string[];
  companies: string[];
  count: number;
}

export interface PhraseCount {
  phrase: string;
  count: number;
  appears_in_strong: boolean;
}

export interface PatternInsight {
  tag_name: string;
  pattern: string;
  example_ids: string[];
}

export interface StrengthCategory {
  tag_name: string;
  strong: number;
  weak: number;
  neutral: number;
  unrated: number;
}

export interface ConsistencyConflict {
  topic: ConsistencyTopic;
  entries: ConsistencyEntry[];
  conflict_description: string;
}

export interface ConsistencyCheckResponse {
  conflicts: ConsistencyConflict[];
  all_entries_by_topic: Record<ConsistencyTopic, ConsistencyEntry[]>;
}
```

---

## 7. API Contracts

All new routes require authentication. Auth.js `auth()` reads the JWT session from cookies and returns `session.user.id`. Routes return `401` if no valid session.

Common error shape:
```typescript
{ "error": "Human-readable message" }
```

---

### POST /api/transcripts

**Auth:** Required

**Request body:**
```typescript
{
  title: string;              // required
  rawText: string;            // required, min 10 chars
  company?: string;
  interviewerName?: string;
  interviewerRole?: string;
  interviewDate?: string;     // "YYYY-MM-DD"
  interviewRound?: "screening" | "first" | "second" | "final" | "other";
}
```

**Response 201:** `{ transcript: Transcript }`

**Errors:** 400 missing fields · 400 invalid interviewRound · 401 unauthenticated · 500 Turso error

---

### GET /api/transcripts

**Auth:** Required

**Query params:** `?company=Moonpig` · `?limit=20&offset=0`

**Response 200:** `{ transcripts: Transcript[], total: number }`

---

### GET /api/transcripts/[id]

**Auth:** Required (ownership via `AND userId = session.user.id`)

**Response 200:** `{ transcript: Transcript }`

**Errors:** 404 not found or not owned

---

### DELETE /api/transcripts/[id]

Deletes transcript. Examples retain their row; `transcriptId` becomes null (Drizzle `onDelete: 'set null'`).

**Auth:** Required · **Response 204:** No content · **Errors:** 404

---

### POST /api/extract

Pass 1 Q&A extraction only. Synchronous; expect 10-20s for long transcripts.

**Auth:** Required

**Request body:** `{ transcript_id: string, force?: boolean }`

**What it does:**
1. Load transcript from Turso; verify `userId` ownership
2. Pass 1: Send `rawText` (with prepended line numbers) to `claude-sonnet-4-5` → `ExtractedPair[]`
3. INSERT pairs → `examples`, UPDATE `transcripts.extractedAt`

**Response 200:**
```typescript
{
  pairs_extracted: number;
  pairs: ExtractionResult;
}
```

**Errors:** 400 missing id · 404 not found · 409 already extracted (send `force: true`) · 500 Claude error

**Prompt architecture** (in `src/lib/prompts/`):

- **Pass 1:** raw_text with line numbers prepended; structured JSON output schema; attribute questions to interviewer, answers to candidate; every quote MUST cite `source_start_line` and `source_end_line`

---

### POST /api/extract/enrich

Pass 2 verification, auto-tagging, consistency extraction, and embedding generation. Triggered by the transcript review page on mount after Pass 1 completes.

**Auth:** Required

**Request body:** `{ transcript_id: string }`

**What it does (all sub-steps run via `Promise.allSettled` in parallel):**
1. Load transcript and its extracted `examples` from Turso; verify `userId` ownership
2. Pass 2: Send pairs + original transcript back to Claude → verify and correct misattributions
3. Auto-tag each pair via Claude using the 13-category taxonomy → INSERT `exampleTags`
4. Extract consistency claims per pair → INSERT `consistencyEntries`
5. Generate OpenAI text-embedding-3-small embeddings for all examples → upsert to Upstash Vector (key = `example.id`, metadata `{ userId }`)

Sub-steps 2–5 run in parallel. If any sub-step fails, the others continue — partial enrichment is better than no enrichment.

**Response 200:**
```typescript
{
  examples_enriched: number;
  consistency_claims_found: number;
  embeddings_generated: number;
  errors: string[];   // non-fatal errors from any sub-step
}
```

**Errors:** 400 missing id · 404 not found · 422 no examples to enrich · 500 fatal error

**Prompt architecture** (in `src/lib/prompts/`):

- **Pass 2:** original + extracted pairs; flag misattributed turns, split answers; return corrected pairs only
- **Tagging:** question + answer → 1-3 tag names from the predefined taxonomy
- **Consistency:** per Q&A pair → null or `{ topic, claim }` for tracked topics

---

### GET /api/examples

**Auth:** Required

**Query params:**
```
?tag_id=cuid               // filter by tag (repeatable)
?transcript_id=cuid
?company=Moonpig           // JOIN to transcripts.company
?quality=strong            // strong | weak | neutral | unrated
?q=leadership              // keyword LIKE on question + answer
?limit=20&offset=0
?order=created_at_desc     // default | quality_desc
```

**Response 200:** `{ examples: Example[], total: number }` (includes joined `tags[]`)

**Implementation:** Keyword search uses Upstash Vector similarity as the primary mechanism. Falls back to in-memory plaintext filtering when vectors are not yet generated for a user's examples.

---

### PATCH /api/examples/[id]

Update user-layer fields only.

**Auth:** Required

**Request body (all optional):**
```typescript
{
  question?: string;
  answer?: string;
  qualityRating?: "strong" | "weak" | "neutral" | null;
  starSituation?: string | null;
  starTask?: string | null;
  starAction?: string | null;
  starResult?: string | null;
  starReflection?: string | null;
  tagIds?: string[];   // full replacement, not additive
}
```

If `question` or `answer` changes, Upstash Vector embedding is regenerated async.

**Response 200:** `{ example: Example }` · **Errors:** 404

---

### DELETE /api/examples/[id]

Deletes the example, cascades `exampleTags`, deletes the Upstash Vector entry. `consistencyEntries.exampleId` → null.

**Auth:** Required · **Response 204** · **Errors:** 404

---

### POST /api/match

Match a job spec to the user's example bank via vector similarity.

**Auth:** Required

**Request body:** `{ job_spec: string, match_count?: number, match_threshold?: number }`

**What it does:**
1. Generate embedding of `job_spec` via OpenAI (`text-embedding-3-small`)
2. Query Upstash Vector with `filter: "userId = '[uid]'"`, `topK = match_count`
3. Fetch full `examples` rows from Turso by returned IDs
4. Claude generates one-sentence explanation per match
5. Claude extracts key requirements from job spec
6. Flag requirements with no match above threshold as gaps

**Response 200:**
```typescript
{ matches: MatchResult[], gaps: GapItem[], job_spec_summary: string }
```

**Errors:** 400 empty job_spec · 422 no examples with embeddings · 500 OpenAI/Claude error

---

### POST /api/mirror/analyze

Four-panel mirror analysis. Computed on demand.

**Auth:** Required · **Request body:** `{}`

**Minimum gate:** Returns `{ insufficient_data: true, examples_count: N }` if user has fewer than 5 examples.

**What it does:**
1. Load all user examples + tags from Turso
2. Fetch all user vectors from Upstash Vector by example IDs
3. Cluster by cosine distance < 0.25 → label clusters via Claude
4. TF-IDF n-gram phrase extraction (2-3 words, min 2 occurrences)
5. Per-tag pattern summary via Claude
6. `qualityRating` aggregation per tag → strength map

**Response 200:** `{ analysis: MirrorAnalysis, examples_analyzed: number, generated_at: string }`

---

### POST /api/consistency/check

**Auth:** Required · **Request body:** `{}`

**What it does:**
1. Load all user `consistencyEntries` from Turso, grouped by topic
2. For topics with 2+ entries from different companies: Claude identifies genuine contradictions
3. Return entries + flagged conflicts

**Response 200:**
```typescript
{ conflicts: ConsistencyConflict[], all_entries_by_topic: Record<ConsistencyTopic, ConsistencyEntry[]> }
```

---

### GET /api/tags

**Auth:** Required · **Response 200:** `{ tags: Tag[] }` (system tags first, then user-defined, both alphabetical)

---

### POST /api/tags

**Auth:** Required · **Request:** `{ name: string }`

**Response 201:** `{ tag: Tag }` · **Errors:** 400 empty/too long · 409 duplicate name for this user

---

## 8. Encryption

Field-level encryption uses AES-256-GCM via Node.js `crypto`. See PRIVACY.md for implementation details.

---

## 9. Upstash Vector + OpenAI Embedding Pipeline

### Upstash Vector Client

```typescript
// src/lib/vector/upstash.ts

import { Index } from '@upstash/vector';

export const vectorIndex = new Index({
  url:   process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Upsert embedding when example is created or updated
export async function upsertExampleVector(
  exampleId: string,
  userId: string,
  embedding: number[]
): Promise<void> {
  await vectorIndex.upsert({
    id:       exampleId,
    vector:   embedding,
    metadata: { userId },   // userId in metadata enables per-user filter
  });
}

// Query similar examples for a single user
export async function queryUserVectors(
  queryEmbedding: number[],
  userId: string,
  topK: number = 10,
  scoreThreshold: number = 0.5
): Promise<{ id: string; score: number }[]> {
  const results = await vectorIndex.query({
    vector:          queryEmbedding,
    topK,
    includeMetadata: true,
    filter:          `userId = '${userId}'`,
  });
  return results
    .filter(r => r.score >= scoreThreshold)
    .map(r => ({ id: String(r.id), score: r.score }));
}

// Delete when example is deleted
export async function deleteExampleVector(exampleId: string): Promise<void> {
  await vectorIndex.delete(exampleId);
}
```

**Index configuration:** 1024 dimensions, cosine similarity metric. Create in the Upstash console before first use.

### OpenAI Embedding Service

```typescript
// src/lib/embeddings/openai.ts

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function generateEmbedding(
  text: string
): Promise<number[]>

export async function generateBatchEmbeddings(
  texts: string[],
  batchSize: number = 20
): Promise<number[][]>
```

Model: `text-embedding-3-small` (1024 dimensions). Uses the OpenAI npm SDK. Exponential backoff with 3 retries.

### Embedding Input Format

```
Q: [question text]
A: [answer text]
```

Combining question and answer captures both context and content, improving similarity match quality.

### When Embeddings Are Generated

| Trigger | Action |
|---------|--------|
| `POST /api/extract/enrich` completes | Generate embeddings for all new examples via OpenAI `text-embedding-3-small`; upsert to Upstash Vector. Runs in parallel with Pass 2 and tagging via `Promise.allSettled`. |
| `PATCH /api/examples/[id]` modifies `question` or `answer` | Regenerate and upsert async. Return 200 immediately. |
| `DELETE /api/examples/[id]` | Delete vector from Upstash Vector. Synchronous. |
| `POST /api/embeddings/backfill` | Generate missing vectors for all user examples. Admin/dev endpoint, not in UI. |

### Mirror Analysis Vector Fetch

Fetch example IDs from Turso first, then batch-fetch vectors from Upstash:

```typescript
const exampleIds = await db.select({ id: examples.id })
  .from(examples)
  .where(eq(examples.userId, userId));

const vectors = await vectorIndex.fetch(
  exampleIds.map(r => r.id),
  { includeVectors: true }
);
// vectors: Array<{ id, vector: number[] }>
```

---

## 10. File Structure

Existing files are marked `(existing)`.

```
/Users/clairedonald/ai-interview-coach/
│
├── src/
│   ├── app/
│   │   ├── globals.css              (existing — updated with Deep Tay vars)
│   │   ├── layout.tsx               (existing — updated with SessionProvider)
│   │   │
│   │   ├── (auth)/                  unauthenticated route group
│   │   │   └── login/
│   │   │       └── page.tsx         Google OAuth sign-in button
│   │   │
│   │   ├── (app)/                   protected route group
│   │   │   ├── layout.tsx           sidebar nav + auth guard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── upload/page.tsx
│   │   │   ├── transcripts/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── review/page.tsx
│   │   │   ├── examples/page.tsx
│   │   │   ├── mirror/page.tsx
│   │   │   ├── match/page.tsx
│   │   │   └── consistency/page.tsx
│   │   │
│   │   ├── page.tsx                 (existing — mock interview, preserved unchanged)
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   └── [...nextauth]/route.ts
│   │       ├── chat/route.ts        (existing — unchanged)
│   │       ├── personas/route.ts    (existing — unchanged)
│   │       ├── transcripts/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── extract/
│   │       │   ├── route.ts             Pass 1 extraction
│   │       │   └── enrich/route.ts      Pass 2 + Tagging + Consistency + Embeddings
│   │       ├── examples/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── match/route.ts
│   │       ├── mirror/
│   │       │   └── analyze/route.ts
│   │       ├── consistency/
│   │       │   └── check/route.ts
│   │       └── tags/route.ts
│   │
│   ├── components/
│   │   ├── PersonaSelector.tsx      (existing)
│   │   ├── ChatInterface.tsx        (existing)
│   │   ├── ui/                      (existing shadcn)
│   │   └── storybank/
│   │       ├── ExampleCard.tsx
│   │       ├── FilterBar.tsx
│   │       ├── StarBreakdown.tsx
│   │       ├── QualityBadge.tsx
│   │       ├── TagPicker.tsx
│   │       ├── MatchResultCard.tsx
│   │       ├── GapAnalysis.tsx
│   │       ├── StrengthMap.tsx
│   │       └── ConsistencyTimeline.tsx
│   │
│   └── lib/
│       ├── config.ts                (existing)
│       ├── utils.ts                 (existing)
│       ├── personas.ts              (existing)
│       ├── rate-limit.ts            (existing)
│       ├── auth.ts                  Auth.js config
│       ├── types/
│       │   └── index.ts             expanded from existing types.ts
│       ├── db/
│       │   ├── index.ts             Turso + Drizzle client
│       │   ├── schema.ts            Drizzle schema
│       │   └── seed.ts              system tag seed
│       ├── vector/
│       │   └── upstash.ts           Upstash Vector client
│       ├── embeddings/
│       │   └── openai.ts            OpenAI text-embedding-3-small service
│       ├── encryption/
│       │   └── index.ts             AES-256-GCM field-level encryption
│       └── prompts/
│           ├── extraction-pass1.ts
│           ├── extraction-pass2.ts
│           ├── tagging.ts
│           ├── consistency.ts
│           ├── matching.ts
│           └── mirror.ts
│
├── drizzle/
│   ├── migrations/                  auto-generated by drizzle-kit
│   └── drizzle.config.ts
│
├── docs/
│   ├── ARCHITECTURE.md              (this file)
│   ├── METHODOLOGY.md               (existing)
│   └── PRIVACY.md                   (Thread 3)
│
├── personas/                        (existing)
├── cli/                             (existing)
├── tests/                           (existing)
├── coach.config.json                (existing)
└── middleware.ts                    (new — Auth.js session middleware)
```

---

## 11. Migration Strategy

### Constraint: Preserve Mock Interview

`/` (page.tsx, ChatInterface.tsx, PersonaSelector.tsx, `/api/chat`, `/api/personas`) must continue working identically. Verified by the existing Vitest test suite throughout Phase 1.

### Approach

**Step 1: Route groups (non-breaking)**
Create `(app)/` route group for protected pages. Root `page.tsx` stays at `/` — never moved. Route groups do not affect URL structure.

**Step 2: Auth middleware (additive)**
`middleware.ts` at project root. Explicitly excludes `/`, `/api/chat`, `/api/personas` from auth requirements. Mock interview stays fully public.

**Step 3: Root layout update (additive)**
Add `SessionProvider` from Auth.js. The mock interview page preserves its existing `bg-gradient-to-b from-blue-50` styling. Deep Tay theme is scoped inside `(app)/` layout only.

**Step 4: Dependencies (additive)**
`@libsql/client`, `drizzle-orm`, `next-auth`, `@auth/drizzle-adapter`, `@upstash/vector`, `@paralleldrive/cuid2` — none of these affect existing API routes.

**Step 5: Database schema (append-only)**
Drizzle migrations only CREATE new tables. Nothing to migrate from (app was stateless).

### Rollback

- Delete `(app)/` route group → no effect on `/`
- Remove `middleware.ts` → no effect on existing routes
- New tables and Turso connection have zero effect on stateless code

---

## 12. Complexity Assessment

| Component | Complexity | Notes |
|-----------|-----------|-------|
| Thread 0: Schema + foundation | Low-Medium | Drizzle + Turso is simpler than Supabase; no RLS configuration |
| Thread 1: Auth | Medium | Auth.js v5 Google OAuth; JWT strategy; Drizzle adapter |
| Thread 2: Transcript upload | Low-Medium | Standard CRUD with Drizzle |
| Thread 3: Encryption | Low-Medium | AES-256-GCM via Node.js `crypto`; no third-party dependency |
| Thread 4: Q&A extraction | **High** | Two-pass Claude + structured output + source citation |
| Thread 5: Example bank UI | Medium | Complex filter state; STAR breakdown UX |
| Thread 6: OpenAI + Upstash Vector | Medium | Two external services; test metadata filter syntax first |
| Thread 7: Job spec matching | Medium | Relies on Thread 6; gap analysis adds Claude call |
| Thread 8: Mirror effect | Medium-High | Vector clustering + phrase analysis + Claude synthesis |
| Thread 9: Consistency tracker | Medium | Auto-extraction hooked into Thread 4 pipeline |

**Validate early (before building Thread 7 on top of Thread 6):**
Test `filter: "userId = 'x'"` against a real Upstash Vector index with dummy data. Confirm the metadata filter syntax works correctly before the matching feature depends on it.

---

## 13. Environment Variables

```bash
# Turso
TURSO_DATABASE_URL=libsql://[db-name]-[org].turso.io
TURSO_AUTH_TOKEN=[token]

# Auth.js
NEXTAUTH_SECRET=[random 32+ char secret]
NEXTAUTH_URL=http://localhost:3000    # production URL in Vercel env

# Google OAuth
GOOGLE_CLIENT_ID=[google-client-id]
GOOGLE_CLIENT_SECRET=[google-client-secret]

# Anthropic (already exists)
ANTHROPIC_API_KEY=[key]

# OpenAI (embeddings)
OPENAI_API_KEY=[key]

# Upstash Vector
UPSTASH_VECTOR_REST_URL=https://[index].upstash.io
UPSTASH_VECTOR_REST_TOKEN=[token]

# AES-256-GCM encryption (optional — plaintext stored if absent)
ENCRYPTION_KEY=[run: openssl rand -base64 32]
```

---

## 14. Key Decisions and Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Database | Turso (SQLite) + Drizzle ORM | Claire's two Supabase free slots are taken; Turso is serverless SQLite, simpler ops, Drizzle gives full type safety |
| Auth | Auth.js v5 Google OAuth | No password management; OAuth is lower-friction than magic link; JWT strategy works with Edge middleware |
| Vector store | Upstash Vector | Managed, serverless-friendly; metadata filtering handles per-user isolation without namespace-per-user |
| ID generation | cuid2 | SQLite has no `gen_random_uuid()`; cuid2 is URL-safe, collision-resistant |
| Access control | App-layer `WHERE userId = session.user.id` | No RLS in SQLite/Turso; explicit WHERE on every query; same security outcome as RLS |
| Route organization | `(auth)/` and `(app)/` route groups | Clean separation; mock interview at `/` untouched |
| System tags | `userId = null` shared rows | No per-user duplication; `or(eq(userId), isNull(userId))` query pattern |
| Re-extraction | Insert-only (never UPDATE user fields) | Preserves user edits; user deletes duplicates |
| Embedding timing | Sync in `/api/extract`, async on `PATCH` | Extract is already slow — acceptable. PATCH should feel instant. |
| Upstash metadata filter | `userId` in vector metadata | Prevents cross-user leakage without namespace-per-user complexity |
| Encryption | AES-256-GCM via Node.js `crypto` | CipherStash evaluated and rejected (no libSQL/SQLite support); Node.js built-in avoids third-party dependency |
| Consistency detection | LLM-based | Numerical variations and framing differences too complex for rule-based matching |
| STAR fields | Nullable, user-controlled only | Never auto-overwritten; "Break down" button is an explicit user action |
| Auth middleware scope | Excludes `/`, `/api/chat`, `/api/personas` | Mock interview stays fully public |

---

## 15. Accuracy Profile (AI Components)

| Component | Accuracy Target | How Validated | Risk if Wrong |
|-----------|----------------|---------------|---------------|
| Q&A extraction | > 90% correct attribution | Test against Claire's `Interview_Questions_and_Answers.md` | Low — user reviews in review UI |
| Auto-tagging | > 80% first-choice correct | Manual spot check 20 examples | Low — user can re-tag |
| Consistency extraction | > 85% recall on explicit claims | Test against known compensation claims | Medium — missed claim = missed contradiction |
| Job spec matching | Relevant top 5 > 70% of time | User judgment on 10 real job specs | Low — user sees results directly |
| Gap analysis | False negative rate < 20% | Manual check against real gaps | Medium — missed gap = false confidence |
| Mirror phrase analysis | Top phrases are real patterns | User review (personal data — user knows) | Low — cosmetic |
| Contradiction detection | True positive rate > 80% | Test with synthetic contradictions | Low — "visibility only" framing |

---

*ARCHITECTURE.md — StoryBank Phase 1 v2.0 (Turso + Upstash Vector + Auth.js)*
