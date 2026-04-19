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
  enrichedAt:      text('enriched_at'),      // null = not yet enriched; ISO datetime when set
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

// ─── Phase 2: APPLY loop tables ──────────────────────────────────────────────

// Job Applications — central entity for the APPLY pipeline
export const jobApplications = sqliteTable('job_applications', {
  id:              id(),
  userId:          text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jobTitle:        text('job_title').notNull(),
  companyName:     text('company_name').notNull(),
  jobUrl:          text('job_url'),
  jobDescription:  text('job_description').notNull(),
  salary:          text('salary'),
  location:        text('location'),
  researchedAt:    text('researched_at'),
  assessedAt:      text('assessed_at'),
  materialsAt:     text('materials_at'),
  fitScoreOverall: integer('fit_score_overall'),
  fitArchetype:    text('fit_archetype'),
  status:          text('status').notNull().default('researching'),
  notes:           text('notes'),
  batchId:         text('batch_id'),
  createdAt:       now('created_at'),
  updatedAt:       text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Company Research — structured research output for a job application
export const companyResearch = sqliteTable('company_research', {
  id:                   id(),
  jobApplicationId:     text('job_application_id').notNull().references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:               text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companySize:          text('company_size'),
  fundingStage:         text('funding_stage'),
  revenue:              text('revenue'),
  foundedYear:          text('founded_year'),
  headquarters:         text('headquarters'),
  industry:             text('industry'),
  recentNews:           text('recent_news'),
  techStack:            text('tech_stack'),
  cultureSignals:       text('culture_signals'),
  keyPeople:            text('key_people'),
  missionAndValues:     text('mission_and_values'),
  sources:              text('sources'),              // serialised JSON
  companiesHouseNumber: text('companies_house_number'),
  companiesHouseData:   text('companies_house_data'), // serialised JSON
  createdAt:            now('created_at'),
  updatedAt:            text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Fit Assessments — 8-dimension fit scoring for a job application
export const fitAssessments = sqliteTable('fit_assessments', {
  id:                    id(),
  jobApplicationId:      text('job_application_id').notNull().references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:                text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  archetype:             text('archetype').notNull(),
  archetypeRationale:    text('archetype_rationale'),
  dimDomainIndustry:     text('dim_domain_industry'),
  dimSeniority:          text('dim_seniority'),
  dimScope:              text('dim_scope'),
  dimTechnical:          text('dim_technical'),
  dimMission:            text('dim_mission'),
  dimLocation:           text('dim_location'),
  dimCompensation:       text('dim_compensation'),
  dimCulture:            text('dim_culture'),
  overallScore:          integer('overall_score'),
  weights:               text('weights'),             // serialised JSON
  redFlags:              text('red_flags'),           // serialised JSON array
  greenFlags:            text('green_flags'),         // serialised JSON array
  exampleIdsUsed:        text('example_ids_used'),   // serialised JSON array
  dismissedRedFlags:     text('dismissed_red_flags'), // serialised JSON array — PM Decision 3
  dimensionAnnotations:  text('dimension_annotations'), // serialised JSON — PM Decision 4
  createdAt:             now('created_at'),
  updatedAt:             text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Generated Materials — CV, cover letter, and tracking notes per application
export const generatedMaterials = sqliteTable('generated_materials', {
  id:               id(),
  jobApplicationId: text('job_application_id').notNull().references(() => jobApplications.id, { onDelete: 'cascade' }),
  userId:           text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:             text('type').notNull(),           // 'cv'|'cover_letter'|'tracking_note'
  content:          text('content').notNull(),
  version:          integer('version').notNull().default(1),
  exampleIdsUsed:   text('example_ids_used'),        // serialised JSON array
  promptHash:       text('prompt_hash'),
  createdAt:        now('created_at'),
  updatedAt:        text('updated_at').$defaultFn(() => new Date().toISOString()),
});

// Batch Runs — orchestration state for multi-role batch processing
export const batchRuns = sqliteTable('batch_runs', {
  id:            id(),
  userId:        text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inputMarkdown: text('input_markdown').notNull(),
  status:        text('status').notNull().default('pending'),
  totalJobs:     integer('total_jobs').notNull().default(0),
  completedJobs: integer('completed_jobs').notNull().default(0),
  failedJobs:    integer('failed_jobs').notNull().default(0),
  fitThreshold:  integer('fit_threshold').notNull().default(70),
  summaryTable:  text('summary_table'),
  warnings:      text('warnings'),
  createdAt:     now('created_at'),
  updatedAt:     text('updated_at').$defaultFn(() => new Date().toISOString()),
});
