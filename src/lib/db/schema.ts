import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { createId } from '@paralleldrive/cuid2';

// ─── Shared helpers ─────────────────────────────────────────────────────────

// IDs: cuid2 — collision-resistant, URL-safe, no DB sequence required
const id  = () => text('id').primaryKey().$defaultFn(() => createId());

// Timestamps: ISO-8601 text strings per v2.0 spec
const now = (col: string) => text(col).$defaultFn(() => new Date().toISOString());

// ─── Auth.js adapter tables ──────────────────────────────────────────────────
// Required by @auth/drizzle-adapter. Auth.js manages their lifecycle.

export const users = sqliteTable('user', {
  id:            text('id').primaryKey().$defaultFn(() => createId()),
  name:          text('name'),
  email:         text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'timestamp_ms' }),
  image:         text('image'),
});

export const accounts = sqliteTable('account', {
  userId:            text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:              text('type').notNull(),
  provider:          text('provider').notNull(),
  providerAccountId: text('providerAccountId').notNull(),
  refresh_token:     text('refresh_token'),
  access_token:      text('access_token'),
  expires_at:        integer('expires_at'),
  token_type:        text('token_type'),
  scope:             text('scope'),
  id_token:          text('id_token'),
  session_state:     text('session_state'),
});

export const sessions = sqliteTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId:       text('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires:      integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

export const verificationTokens = sqliteTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token:      text('token').notNull(),
  expires:    integer('expires', { mode: 'timestamp_ms' }).notNull(),
});

// ─── StoryBank tables ────────────────────────────────────────────────────────

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
  extractedAt:     text('extracted_at'),      // null = not yet extracted; ISO datetime when set
  createdAt:       now('created_at'),
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
  createdAt:      now('created_at'),
  updatedAt:      text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Tags — system (userId null) and user-defined
export const tags = sqliteTable('tags', {
  id:        id(),
  userId:    text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = system tag
  name:      text('name').notNull(),
  isSystem:  integer('is_system', { mode: 'boolean' }).default(false),
  createdAt: now('created_at'),
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
  interviewDate: text('interview_date'),     // "YYYY-MM-DD"
  createdAt:     now('created_at'),
});
