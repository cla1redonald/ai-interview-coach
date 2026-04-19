# StoryBank — Session Handoff

**Date:** 2026-04-19
**Session:** Phase 2 deploy + post-build cleanup

---

## Session Summary

Deployed Phase 2 (APPLY Loop) to production:

- **Schema push:** `npx drizzle-kit push` applied 5 new tables to Turso production DB
- **Deploy:** `vercel --prod` — build clean, all routes compiled
- **Smoke test:** Login (200), auth providers (200), personas API (200, 3 personas), authenticated endpoints (401 as expected), batch (405 for unsupported GET)
- **Env var audit:** 12 vars confirmed on Vercel; 2 missing (`GEMINI_API_KEY`, `COMPANIES_HOUSE_API_KEY`) — required for company research pipeline but not yet obtained
- **Late agent notifications:** All 5 background agents from the Phase 2 orchestrated build reported in (Threads 7, 8, 9, reviewer, retro) — all work already committed and deployed

## Current State

- **Branch:** `main`
- **Last commit:** `d023fcf` — docs: update HANDOFF.md for Phase 2 completion
- **Build:** Passes (`npm run build` clean)
- **Tests:** 297/297 passing, 13 test files
- **TSC:** Clean, 0 errors
- **Deploy status:** LIVE at https://ai-interview-coach-virid.vercel.app
- **Live status:** Phase 1 fully functional; Phase 2 UI routes serve but company research pipeline will error until API keys are added

## What's Live

| Feature | Status |
|---------|--------|
| Phase 1 Example Bank (upload, extract, enrich, search, match, practice, mirror, consistency) | Live |
| Unified Experience (sidebar nav, transcript review, example detail) | Live |
| Phase 1 Hardening (rate limit, validation, error boundaries) | Live |
| Phase 2 UI routes (research, fit, materials, batch) | Live (routes serve) |
| Phase 2 research pipeline (Jina + Gemini + Companies House) | Blocked — needs API keys |

## Open Issues

### Blocking: API keys needed for Phase 2 research pipeline

Two keys must be added to Vercel before the APPLY loop works end-to-end:

1. **`GEMINI_API_KEY`** — Get from [Google AI Studio](https://aistudio.google.com/apikey) (free, 500 req/day)
2. **`COMPANIES_HOUSE_API_KEY`** — Get from [Companies House API](https://developer.company-information.service.gov.uk/) (free, UK company data)

```bash
echo -n "YOUR_KEY" | vercel env add GEMINI_API_KEY production --sensitive
echo -n "YOUR_KEY" | vercel env add COMPANIES_HOUSE_API_KEY production --sensitive
vercel --prod
```

Optional: `JINA_API_KEY` (higher rate limit; works without it at 20 RPM)

### Review warnings (deferred to Phase 3)

| Severity | Issue | File |
|----------|-------|------|
| CRITICAL-2 | In-memory rate limiter (serverless) | `src/lib/rate-limit.ts` |
| WARNING-1 | calculateOverallScore duplicated | `assess/route.ts` + `batch/[id]/run/route.ts` |
| WARNING-2 | SSRF in Jina URL construction | `src/lib/services/jina-reader.ts` |
| WARNING-3 | Prompt injection via companyName | `src/lib/services/gemini-search.ts` |
| WARNING-4 | Non-atomic batch counter update | `src/app/api/batch/[id]/run/route.ts` |
| WARNING-6 | MaterialsEditor saves on any blur | `src/components/storybank/MaterialsEditor.tsx` |
| WARNING-7 | Unvalidated annotation shapes | `src/app/api/applications/[id]/assessment/annotations/route.ts` |
| WARNING-8 | Gemini model typed as `any` | `src/lib/services/gemini-search.ts` |

### Cleanup items (low priority)

- `source_type` metadata values are stale (`'firecrawl'`, `'exa'` instead of `'jina'`, `'gemini'`)
- `ARCHITECTURE-PHASE2.md` scope line still reads "Phase 1"
- `adaptToolSchema` duplicated in materials route + batch run route — extract to `src/lib/ai/`

## Key Files

- **Specs:** `docs/PRODUCT-SPEC-PHASE2.md`, `docs/ARCHITECTURE-PHASE2.md`, `docs/UX-PHASE2-APPLY.md`
- **Schema:** `src/lib/db/schema.ts` (5 new tables: jobApplications, companyResearch, fitAssessments, generatedMaterials, batchRuns)
- **Service clients:** `src/lib/services/` (jina-reader, gemini-search, companies-house)
- **Prompts:** `src/lib/prompts/` (research-synthesis, fit-assessment, materials-cv, materials-cover, materials-tracking)
- **API routes:** `src/app/api/applications/`, `src/app/api/batch/`
- **UI pages:** `src/app/(app)/research/`, `src/app/(app)/fit/`, `src/app/(app)/materials/`, `src/app/(app)/batch/`
- **Components:** `src/components/storybank/` (RadarChart, DimensionScoreRow, FlagCard, JobContextHeader, MaterialsEditor, MasterCvModal, BatchPipelineRow, BatchResultsTable)
- **Retro:** `RETRO-phase2.md`

## Stack

Next.js 14 App Router · TypeScript · Turso (SQLite) + Drizzle ORM · Auth.js v5 (Google OAuth) · Upstash Vector · OpenAI (text-embedding-3-small) · Anthropic API · Gemini Flash (grounded search) · Jina AI Reader · Companies House API · AES-256-GCM encryption · Tailwind CSS · Deep Tay palette

---

## Resume Prompt

```
I'm continuing work on StoryBank at /Users/clairedonald/ai-interview-coach/.

Phase 1 (Example Bank) and Phase 2 (APPLY Loop) are deployed and live at
https://ai-interview-coach-virid.vercel.app. 297 tests passing, build clean.
Read HANDOFF.md for full state.

Immediate next steps:
1. Add GEMINI_API_KEY + COMPANIES_HOUSE_API_KEY to Vercel (see HANDOFF.md)
2. Redeploy and smoke test the full APPLY flow end-to-end
3. Thread C: Dashboard "Where to Focus" module (Issue #15)
4. Address Phase 3 review warnings (see HANDOFF.md open issues)

Key docs: docs/PRODUCT-SPEC-PHASE2.md, docs/ARCHITECTURE-PHASE2.md
```
