# StoryBank — Session Handoff

**Date:** 2026-04-19
**Session:** Unified Experience build (Threads A, B, D)

---

## Session Summary

Built three threads of the Unified Experience on top of Phase 1 (Example Bank):

- **Thread D (Nav Polish):** Sidebar section labels renamed Library → BUILD, Track → APPLY, Prepare → PRACTISE. Practice icon changed from `MessageCircle` to `Mic`. Dashboard quick action "Check consistency" replaced with "Start a practice session".
- **Thread A (Focus Flow):** `/practice` page reads `?focus=` and `?gap=` query params. `PracticeContextBanner` shows as full banner before persona selection, collapses to chip after. `focusTopic` injected into `/api/chat` system prompt (sanitised: trim, 200 chars, no newlines). Mirror `StrengthMap` shows "Practice [category] →" CTA below categories where weak+unrated > strong. Job Match gap cards show "Practice this gap →" CTA linking to `/practice?gap=[requirement]`.
- **Thread B (Save to Bank):** `POST /api/examples` handler added — auth, validation, encryption, auto-tags "Practice session" when `transcriptId` is null. "Practice session" added as 14th system tag in `seed.ts`. `ChatInterface` gains `onFeedbackComplete` callback that fires after feedback streaming completes, returns the full message array. `extractQAPairs()` utility in `src/lib/practice-utils.ts` — filters to 50+ word answers, auto-selects non-filler. `SaveToBankPrompt` inline card after feedback. `SaveToBankModal` with checkboxes, inline edit, and sequential `POST /api/examples` saves.

**Thread C (Dashboard "Where to Focus" module) was deferred.** Not built this session.

## Current State

- **Branch:** `main`
- **Deploy status:** NOT DEPLOYED — code complete, not yet on Vercel
- **Build:** Should pass (not re-verified after UE build — run `npm run build` before deploying)
- **Tests:** Were 85/85 passing before this session; new components not yet unit-tested

## What Was Built

| Feature | Status |
|---------|--------|
| Turso DB + Drizzle schema | Done (Phase 1) |
| Auth.js Google OAuth login | Done (Phase 1) |
| Transcript upload (paste/file) | Done (Phase 1) |
| Two-pass AI extraction + auto-tagging | Done (Phase 1) |
| AES-256-GCM encryption (opt-in via ENCRYPTION_KEY) | Done (Phase 1) |
| Example Bank UI (filters, STAR, quality rating) | Done (Phase 1) |
| OpenAI text-embedding-3-small + Upstash Vector | Done (Phase 1) |
| Job spec matching + gap analysis | Done (Phase 1) |
| Mirror Effect (4-panel analysis) | Done (Phase 1) |
| Consistency Tracker (contradiction detection) | Done (Phase 1) |
| Security fixes (P0-1, P0-2, P0-3, P1-3, P1-4, P1-5) | Done (Phase 1) |
| Thread D: Nav BUILD/APPLY/PRACTISE + Mic icon | Done (UE) |
| Thread D: Dashboard "Start a practice session" CTA | Done (UE) |
| Thread A: /practice reads ?focus= and ?gap= params | Done (UE) |
| Thread A: PracticeContextBanner (banner + chip modes) | Done (UE) |
| Thread A: focusTopic injected into /api/chat | Done (UE) |
| Thread A: StrengthMap "Practice [category] →" CTAs | Done (UE) |
| Thread A: Job Match "Practice this gap →" CTAs | Done (UE) |
| Thread B: POST /api/examples | Done (UE) |
| Thread B: "Practice session" system tag (14th) | Done (UE) |
| Thread B: ChatInterface onFeedbackComplete callback | Done (UE) |
| Thread B: extractQAPairs() utility | Done (UE) |
| Thread B: SaveToBankPrompt | Done (UE) |
| Thread B: SaveToBankModal | Done (UE) |
| Thread C: Dashboard "Where to Focus" module | **Deferred** |

## Key Files

- **Architecture:** `docs/ARCHITECTURE.md` (v2.1 — includes UE changes)
- **Design:** `docs/DESIGN.md` (v1.3 — includes new nav structure and UE components)
- **Privacy:** `docs/PRIVACY.md` (encryption approach)
- **Practice page:** `src/app/(app)/practice/page.tsx`
- **Practice utils:** `src/lib/practice-utils.ts` (extractQAPairs)
- **PracticeContextBanner:** `src/components/storybank/PracticeContextBanner.tsx`
- **SaveToBankPrompt:** `src/components/storybank/SaveToBankPrompt.tsx`
- **SaveToBankModal:** `src/components/storybank/SaveToBankModal.tsx`
- **POST /api/examples:** `src/app/api/examples/route.ts` (GET was already there; POST added)
- **/api/chat (updated):** `src/app/api/chat/route.ts` (focusTopic param + sanitisation)
- **AppSidebar (updated):** `src/components/storybank/AppSidebar.tsx` (BUILD/APPLY/PRACTISE sections)
- **StrengthMap (updated):** `src/components/storybank/StrengthMap.tsx` (practice CTAs)
- **Match page (updated):** `src/app/(app)/match/page.tsx` (GapCard practice CTAs)
- **Dashboard (updated):** `src/app/(app)/dashboard/page.tsx` ("Start a practice session" CTA)
- **seed.ts (updated):** `src/lib/db/seed.ts` (14 system tags including "Practice session")
- **PRD:** `~/claudesidian/01_Projects/Next_Chapter/Ideas/interview-coach-PRD.md`
- **Retro:** `RETRO-phase1.md` (Phase 1 learnings)

## GitHub Issues

| # | Issue | Phase | Status |
|---|-------|-------|--------|
| 1 | Deploy Phase 1 to Vercel | Phase 1 | Open |
| 2 | Add error boundaries to UI pages | Phase 1 | Open |
| 3 | Add per-user rate limiting on AI routes | Phase 1 | Open |
| 4 | Add input length limits on high-cost fields | Phase 1 | Open |
| 12 | Thread A: Focus Flow | UE | Done |
| 13 | Thread B: Save to Bank | UE | Done |
| 15 | Thread C: Dashboard "Where to Focus" module | UE | Open — deferred |
| 16 | Thread D: Nav Polish | UE | Done |

(Issues 5–11 are Phase 2/3 features — company research, fit assessment, tailored materials, batch mode, mock interview integration, outcome tracking, rename repo.)

## Open Items

- **Not deployed** — Issue #1 has the full deploy checklist (Turso, Upstash Vector, Google OAuth, OpenAI, env vars, db:migrate, db:seed)
- **Thread C deferred** — Dashboard "Where to Focus" module (surfacing the most actionable next step based on Mirror + Match data)
- **Practice-saved examples have no embeddings** — `POST /api/examples` does not trigger embedding generation. These examples will not appear in job spec matching until a backfill runs or the example is patched. Consider adding embedding generation to the POST handler or surfacing this in the UI.
- **Build not re-verified** after UE changes — run `npm run build` and `npm test` before deploying

## Stack

Next.js 14 App Router · TypeScript · Turso (SQLite) + Drizzle ORM · Auth.js v5 (Google OAuth) · Upstash Vector · OpenAI (text-embedding-3-small) · Anthropic API · AES-256-GCM encryption · Tailwind CSS · Deep Tay palette

---

## Resume Prompt

```
I'm continuing work on StoryBank at /Users/clairedonald/ai-interview-coach/.

Phase 1 (Example Bank) and the Unified Experience (Threads A, B, D) are code-complete
but NOT deployed. Read HANDOFF.md for full state.

What's left before deploy:
1. Run `npm run build` and `npm test` to verify nothing broke in the UE build
2. Deploy to Vercel (GitHub Issue #1):
   - Create Turso database
   - Create Upstash Vector index (1024 dims, cosine metric)
   - Set up Google OAuth credentials
   - Add all env vars to Vercel
   - Run db:migrate + db:seed against production
   - Smoke test full flow with real transcript data

After deploy:
- Thread C: Dashboard "Where to Focus" module (Issue #15)
- Phase 1 hardening: Issues #2-4
- Embedding generation on POST /api/examples (practice-saved examples currently have no vectors)

Key docs: docs/ARCHITECTURE.md (v2.1), docs/DESIGN.md (v1.3)
GitHub Project: https://github.com/users/cla1redonald/projects/3
```
