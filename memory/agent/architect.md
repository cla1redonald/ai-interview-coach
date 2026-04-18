# Architect Agent -- Committed Knowledge

## Verify Stack Constraints Before Designing

**Context:** Starting a new architecture spec for a project in a portfolio with established defaults.

**Learning:** Never assume the default stack applies. The user may have constraints (no free Supabase slots, can't use a specific provider, cost limits) that rule out the standard choice. Designing against the wrong stack wastes the architect's time and forces a full rewrite.

**Action:** Before writing any spec, verify: (1) database choice is confirmed, (2) auth provider is confirmed, (3) deployment target is confirmed, (4) any "do not use" items are listed. If this information is not in the prompt, ask before designing.

**Source:** StoryBank Phase 1 / 2026-04-18 -- Supabase spec rewritten to Turso after user clarified constraints

---

## Flag Unverified Dependencies

**Context:** Specifying a dependency (SDK, service, library) that has not been tested against the project's specific stack.

**Learning:** CipherStash was listed as the primary encryption solution, but its compatibility with SQLite/libSQL was assumed, not verified. When the engineer tried to install it, it failed. The fallback (AES-256-GCM) saved the thread, but the false confidence in the primary path was avoidable.

**Action:** For any dependency where compatibility is uncertain, mark it explicitly as `UNVERIFIED` in the spec and define: (1) the fallback approach, (2) a spike task to verify compatibility before the main build begins. Format: `CipherStash: UNVERIFIED against libSQL. Fallback: AES-256-GCM via Node crypto. Spike: npm install + import test.`

**Source:** StoryBank Phase 1 / 2026-04-18 -- CipherStash doesn't support SQLite

---

## Define Data Layer Ownership

**Context:** Designing a system where AI pipelines write to the same tables that users edit.

**Learning:** Explicitly separating USER layer fields (never auto-overwritten) from SYSTEM layer fields (safe to regenerate) in the architecture spec prevented the extraction pipeline from ever destroying user edits. This contract was referenced by multiple threads and prevented subtle data corruption.

**Action:** For any table touched by both AI pipelines and user actions, include a "Data Contract Layer Map" table in the spec listing each column, its ownership layer, and the rules for who can write to it.

**Source:** StoryBank Phase 1 / 2026-04-18 -- ARCHITECTURE.md Section 5
