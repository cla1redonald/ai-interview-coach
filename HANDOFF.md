# StoryBank — Session Handoff

**Date:** 2026-04-19
**Session:** Phase 2 APPLY Loop build (9 threads)

---

## Session Summary

Built the complete Phase 2 APPLY loop via 9-thread orchestrated build:

- **Threads 1-4 (parallel):** Schema (5 tables), service clients (Jina Reader, Gemini Search, Companies House), AI prompts (research synthesis, fit assessment, CV, cover letter, tracking note), sidebar nav update
- **Thread 5:** Application CRUD + research pipeline (3-way parallel gather + Claude synthesis)
- **Threads 6+8 (parallel):** Assessment + Materials API routes; Research + Fit UI pages + 8 components
- **Threads 7+9 (parallel):** Batch API (markdown parser, one-per-call pipeline); Materials + Batch UI pages + 4 components
- **Review pass:** Fixed 2 critical issues (encrypted fields in batch pipeline, material content decryption)
- **Retro:** 5 learnings graduated to committed knowledge

## Current State

- **Branch:** `main`
- **Last commit:** `5b1f263` — review fixes (decrypt research fields in batch + material content in GET)
- **Build:** Passes (`npm run build` clean)
- **Tests:** 297/297 passing, 13 test files
- **TSC:** Clean, 0 errors
- **Deploy status:** NOT YET DEPLOYED — code complete, needs schema push + env vars + deploy

## What Was Built

| Feature | Status |
|---------|--------|
| Phase 1 Example Bank (10 threads) | Done |
| Unified Experience (Threads A, B, D) | Done |
| Phase 1 Hardening (rate limit, validation, error boundaries) | Done |
| **Phase 2: Company Research** | Done |
| — Jina AI Reader (free, fetch-based scraping) | Done |
| — Gemini Flash + Google Search grounding (free, 500/day) | Done |
| — Companies House API (free, UK company data) | Done |
| — 3-way parallel gather + Claude synthesis | Done |
| — Research UI: /research, /research/new, /research/[id] | Done |
| **Phase 2: Fit Assessment** | Done |
| — Archetype detection (exec/ic/portfolio/advisory/hybrid) | Done |
| — 8-dimension scoring with weighted average | Done |
| — SVG radar chart (no charting library) | Done |
| — Red flag dismiss + dimension annotations (persisted) | Done |
| — Fit UI: /fit, /fit/[id] with interactive dimension rows | Done |
| **Phase 2: Tailored Materials** | Done |
| — CV generation (anti-fabrication, master CV support) | Done |
| — Cover letter (13-phrase anti-slop blocklist) | Done |
| — Tracking note (Obsidian-compatible markdown) | Done |
| — ContentEditable editor with paste-strip + auto-save | Done |
| — Materials UI: /materials, /materials/[id] (3-tab hub) | Done |
| **Phase 2: Batch Mode** | Done |
| — Markdown parser (row-based UI → markdown wire format) | Done |
| — One-app-per-call pipeline (45s budget, early return) | Done |
| — Batch UI: input/pipeline/results views, CSV export | Done |
| **Review Fixes** | Done |
| — Decrypt research fields in batch pipeline (CRITICAL-1) | Done |
| — Decrypt material content in GET response (WARNING-5) | Done |

## Key Files (Phase 2)

- **Specs:** `docs/PRODUCT-SPEC-PHASE2.md`, `docs/ARCHITECTURE-PHASE2.md`, `docs/UX-PHASE2-APPLY.md`
- **Schema:** `src/lib/db/schema.ts` (5 new tables: jobApplications, companyResearch, fitAssessments, generatedMaterials, batchRuns)
- **Service clients:** `src/lib/services/` (jina-reader, gemini-search, companies-house)
- **Prompts:** `src/lib/prompts/` (research-synthesis, fit-assessment, materials-cv, materials-cover, materials-tracking)
- **API routes:** `src/app/api/applications/`, `src/app/api/batch/`
- **UI pages:** `src/app/(app)/research/`, `src/app/(app)/fit/`, `src/app/(app)/materials/`, `src/app/(app)/batch/`
- **Components:** `src/components/storybank/` (RadarChart, DimensionScoreRow, FlagCard, JobContextHeader, MaterialsEditor, MasterCvModal, BatchPipelineRow, BatchResultsTable, etc.)
- **Retro:** `RETRO-phase2.md`

## Review Findings (remaining)

| Severity | Issue | Status |
|----------|-------|--------|
| CRITICAL-1 | Batch decrypt research fields | **FIXED** |
| CRITICAL-2 | In-memory rate limiter (serverless) | Deferred — acceptable for single-user beta |
| WARNING-1 | calculateOverallScore duplicated | Noted for Phase 3 |
| WARNING-2 | SSRF in Jina URL construction | Noted for Phase 3 |
| WARNING-3 | Prompt injection via companyName | Noted for Phase 3 |
| WARNING-4 | Non-atomic batch counter update | Noted for Phase 3 |
| WARNING-5 | Unencrypted materials in GET | **FIXED** |
| WARNING-6 | MaterialsEditor saves on any blur | Noted for Phase 3 |
| WARNING-7 | Unvalidated annotation shapes | Noted for Phase 3 |
| WARNING-8 | Gemini model typed as `any` | Noted for Phase 3 |

## Deploy Checklist

1. `npx drizzle-kit push` — apply Phase 2 schema to Turso production DB
2. Add env vars to Vercel:
   - `GEMINI_API_KEY` (required for company research)
   - `JINA_API_KEY` (optional, higher rate limit)
   - `COMPANIES_HOUSE_API_KEY` (required for UK company data)
   - `FIT_THRESHOLD_DEFAULT` (optional, defaults to 70)
3. `vercel --prod`
4. Smoke test: login → research new company → fit assessment → materials generation → batch mode

## Stack

Next.js 14 App Router · TypeScript · Turso (SQLite) + Drizzle ORM · Auth.js v5 (Google OAuth) · Upstash Vector · OpenAI (text-embedding-3-small) · Anthropic API · Gemini Flash (grounded search) · Jina AI Reader · Companies House API · AES-256-GCM encryption · Tailwind CSS · Deep Tay palette

---

## Resume Prompt

```
I'm continuing work on StoryBank at /Users/clairedonald/ai-interview-coach/.

Phase 1 (Example Bank), Unified Experience, and Phase 2 (APPLY Loop) are
code-complete. 297 tests passing, build clean. Read HANDOFF.md for full state.

Phase 2 is NOT YET DEPLOYED. Deploy checklist:
1. npx drizzle-kit push (apply Phase 2 schema)
2. Add GEMINI_API_KEY, COMPANIES_HOUSE_API_KEY to Vercel
3. vercel --prod
4. Smoke test the full APPLY flow

After deploy:
- Address remaining review warnings (see HANDOFF.md review findings)
- Thread C: Dashboard "Where to Focus" module (Issue #15)
- Phase 3 planning

Key docs: docs/PRODUCT-SPEC-PHASE2.md, docs/ARCHITECTURE-PHASE2.md
```
