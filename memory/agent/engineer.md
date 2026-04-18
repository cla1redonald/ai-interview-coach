# Engineer Agent -- Committed Knowledge

## Validate Input Before String Interpolation in External Service Queries

**Context:** Building a client for an external service (Upstash Vector, Algolia, etc.) that accepts string-based filter syntax.

**Learning:** Interpolating `userId` directly into Upstash Vector's filter string (`filter: "userId = '${userId}'"`) creates an injection vulnerability identical in class to SQL injection. If the userId contained quotes, the filter query could be manipulated to return other users' data.

**Action:** Before any string interpolation into an external service filter:
1. Validate the input format with a regex (e.g., cuid2: `/^[a-z0-9]{20,32}$/`)
2. Reject values that don't match -- throw an error, don't sanitise
3. If the service supports parameterised queries, use those instead
4. Add this validation in the service client module, not in the calling route

**Source:** StoryBank Phase 1 / 2026-04-18 -- Upstash Vector userId filter injection

---

## Non-Fatal Pipeline Step Pattern

**Context:** Building a multi-step AI pipeline where each step calls an external API (LLM, embedding service, vector store).

**Learning:** The StoryBank extraction pipeline has 6 steps: Pass 1 extract, Pass 2 verify, auto-tag, consistency extract, DB persist, embedding generation. Steps 2-4 and 6 are wrapped in try/catch and treated as non-fatal. If any fails, the core Q&A pairs are still saved. This is the correct pattern for pipelines where partial results are better than no results.

**Action:** For multi-step AI pipelines:
1. Identify the "core" step (the one that produces the primary value) -- this must succeed or return an error
2. All enhancement steps (verification, tagging, embedding) should be non-fatal: try/catch, log the error, add a warning to the response
3. Provide a recovery mechanism for failed enhancement steps (e.g., backfill endpoint for missing embeddings)
4. Document which steps are fatal vs. non-fatal in the pipeline architecture

**Source:** StoryBank Phase 1 / 2026-04-18 -- `/api/extract/route.ts`

---

## Read the Spec's Design Decisions Section

**Context:** Implementing a schema or data model against an architecture spec.

**Learning:** The architecture spec said "Timestamps stored as ISO-8601 text strings" but the implementing engineer initially used integer timestamps (the SQLite default). This caused a mismatch that had to be fixed.

**Action:** Before implementing any schema: read the "Design Principles" or "Key Decisions" section of the architecture spec end-to-end. Pay special attention to: timestamp format, ID generation strategy, nullable vs. required fields, and any field that says "NOT [the default]."

**Source:** StoryBank Phase 1 / 2026-04-18
