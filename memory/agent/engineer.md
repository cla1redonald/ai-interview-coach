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

---

## Double-Click Guard on Async Save Buttons

**Context:** Building a UI button that triggers one or more async API calls (save, submit, delete).

**Learning:** The SaveToBankModal fires N sequential POST calls when the user clicks save. React's `useState` setter is async -- checking `if (saving) return` at the top of the handler does not prevent double-clicks because the state update has not rendered by the time the second click fires. The second invocation sees `saving === false` and enters the handler, duplicating all API calls.

**Action:** Use a `useRef` guard alongside the `useState` flag:
```typescript
const savingRef = useRef(false);
const [saving, setSaving] = useState(false);

const handleSave = async () => {
  if (savingRef.current) return;  // synchronous check blocks second click
  savingRef.current = true;
  setSaving(true);               // triggers re-render for UI feedback
  // ... perform async work ...
  savingRef.current = false;
  setSaving(false);
};
```
Apply this pattern to every button that triggers an async server call. The ref provides synchronous blocking; the state provides UI feedback (disabled styling, "Saving..." text).

**Source:** StoryBank Unified Experience / 2026-04-19 -- SaveToBankModal double-click race condition

---

## Promise.allSettled for Multi-Source External Fetches

**Context:** Building a pipeline that calls multiple independent external services (scrapers, search APIs, data providers) and must continue if some fail.

**Learning:** The Phase 2 research pipeline calls Jina Reader, Companies House, and Gemini Search in parallel. With `Promise.all`, any single failure (Jina 403, CH rate limit, Gemini quota) would abort the whole pipeline. With `Promise.allSettled`, each service result is independent. The route checks whether at least one succeeded; if all fail it returns 503; if some fail it continues with warnings.

**Action:** For any pipeline calling N independent external services:
1. Use `Promise.allSettled([...])` not `Promise.all`
2. Check each result's `.status === 'fulfilled'` independently
3. If all fail: return an appropriate error (503 or similar)
4. If some fail: collect warnings, continue with available data
5. Never use sequential awaits when services can run in parallel

```typescript
const [jinaResult, chResult, geminiResult] = await Promise.allSettled([
  fetchFromJina(),
  fetchFromCompaniesHouse(),
  fetchFromGemini(),
]);

const jinaOk = jinaResult.status === 'fulfilled' && jinaResult.value !== null;
const chOk = chResult.status === 'fulfilled' && chResult.value !== null;

if (!jinaOk && !chOk && !geminiResult.status) {
  return Response.json({ error: 'All sources failed' }, { status: 503 });
}
```

**Source:** StoryBank Phase 2 / 2026-04-19 -- research pipeline `/api/applications/[id]/research`

---

## Tool Schema Format Adapter (input_schema vs parameters)

**Context:** Building API routes that use Anthropic SDK prompt modules alongside a `callWithTool` helper written for the Vercel AI SDK format.

**Learning:** Anthropic SDK uses `input_schema` as the key for tool input schemas. Vercel AI SDK uses `parameters`. When prompt modules (written to Anthropic format) are passed to a `callWithTool` helper (written to Vercel format), the schemas are silently misread. The fix is a local adapter function. The mistake is duplicating this adapter in every route file instead of extracting it once.

**Action:** When an Anthropic-format tool schema must be passed to a Vercel-SDK-format helper:
1. Create `src/lib/ai/adapt-tool-schema.ts` with the normalisation logic
2. Import from it in every route that calls `callWithTool` with Anthropic-format prompt modules
3. Never copy-paste the adapter inline into route files

```typescript
// src/lib/ai/adapt-tool-schema.ts
export function adaptToolSchema(raw: object): { name: string; description: string; parameters: object } {
  const s = raw as { name: string; input_schema?: object; parameters?: object; description?: string };
  return {
    name: s.name,
    description: s.description ?? `Call ${s.name}`,
    parameters: s.parameters ?? s.input_schema ?? {},
  };
}
```

**Source:** StoryBank Phase 2 / 2026-04-19 -- `adaptToolSchema` duplicated in materials route and batch run route

---

## Timing-Budget Pattern for Vercel Serverless Batch Processing

**Context:** Building a long-running pipeline (research + assessment + materials = 40-90s total) on Vercel where functions time out at 60s.

**Learning:** The correct approach is: process one item per request, check `Date.now() - startTime < BUDGET_MS` before each step, and return early with a `remaining` count if the budget is exceeded. The client polls until `remaining === 0`. This is preferable to queue-based systems for small-scale (1-10 item) batch jobs where complexity is not warranted.

**Action:** For batch pipelines on Vercel:
1. Process one item per request (not all items in one request)
2. Set budget = (function timeout - safety margin). For 60s limit: `BUDGET_MS = 45000`
3. Check `Date.now() - startTime < BUDGET_MS` before each major step
4. Return early with `{ remaining: N }` if budget exceeded — the client calls again
5. Never attempt to process all N items in a single function invocation

```typescript
const BUDGET_MS = 45000; // 45s leaves 15s headroom before Vercel 60s kill
const startTime = Date.now();

// Step 1
if (Date.now() - startTime < BUDGET_MS) {
  await runResearch(app);
} else {
  return Response.json({ remaining, processed_this_call: 0 });
}

// Step 2
if (Date.now() - startTime < BUDGET_MS) {
  await runAssessment(app);
} else {
  return Response.json({ remaining, processed_this_call: 0 });
}
```

**Source:** StoryBank Phase 2 / 2026-04-19 -- `/api/batch/[id]/run` processing pipeline
