# Phase 110: Alto-Index E2E - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end Playwright testing of all 11 alto-index subdirectory types — verifying import correctness (card_type + field mapping), dedup idempotency, FTS5 bulk rebuild at 501+ cards, and purge-then-replace behavior. This is a test-only phase — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### Fixture strategy
- Combine all 11 subdirectory fixture JSON files into one alto_index import (matches real usage — alto-index is always imported as one batch)
- Bump notes.json from 25 to ~250 cards using generate-alto-fixtures.mjs to cross the 501 FTS5 bulk rebuild threshold (~250 notes + ~250 from 10 other types = ~500+)
- Each type's fixture cards focus on fields unique to that type (e.g. calendar: event_start/event_end, books: author/genre/progress). Shared fields (name, created_at) covered once in notes
- Committed JSON fixtures are source of truth — deterministic CI runs, no runtime generation

### Spec organization
- Single spec file: `e2e/alto-index.spec.ts` with 4 describe blocks:
  1. Type correctness (11 individual test cases, one per subdirectory type)
  2. Dedup idempotency (re-import same fixtures, assert zero net-new cards)
  3. FTS5 bulk rebuild (501+ card import triggers bulk path, CommandBar search finds cards)
  4. Purge-then-replace (sample data seeded first, absent after alto-index import)
- New `importAltoIndex` helper in `e2e/helpers/etl.ts` — loads all 11 JSON fixtures, merges into one array, calls `importNativeCards` with sourceType='alto_index'
- One test case per subdirectory type (11 total) — each asserts correct card_type and type-specific field mapping

### Purge assertion approach
- Seed non-alto-index cards via `sampleManager.load()` (same as cold-start.spec.ts)
- After alto-index import, assert sample cards are absent (SELECT COUNT(*) WHERE source != alto-index sources)
- Verify BOTH cards AND connections tables are purged (handler does DELETE FROM connections then DELETE FROM cards)
- Alto-index cards must be present after purge+import

### CI integration
- Add to existing E2E CI job (not a separate job). Playwright already runs sequentially (workers: 1)
- Fixture JSON files committed to repo (tests/fixtures/alto-index/*.json)

### Claude's Discretion
- Exact test timeout values per describe block
- Whether to screenshot on each type assertion or only on failure (existing config: only-on-failure)
- FTS5 search query strings for CommandBar verification
- Edge case fixtures (Unicode, empty content, null fields) — already present in notes.json from generate script

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Alto-Index implementation
- `src/worker/handlers/etl-import-native.handler.ts` — Purge-then-replace logic (DELETE FROM connections/cards/datasets for alto_index sourceType), DedupEngine + SQLiteWriter flow, bulk import optimization at 500+ cards
- `tests/etl-validation/etl-alto-index-full.test.ts` — Full load test reference (11 subdirectory inventory with card counts, parser routing per type)

### E2E testing patterns
- `e2e/helpers/etl.ts` — Phase 109 ETL helpers: `importNativeCards`, `assertCatalogRow`, `resetDatabase` — the foundation for the new `importAltoIndex` helper
- `e2e/helpers/isometry.ts` — Core E2E helpers: `waitForAppReady`, `importAltoNotes`, `getCardCount`
- `e2e/cold-start.spec.ts` — Sample data loading pattern via `sampleManager.load()` (used for purge seed strategy)
- `e2e/supergrid-visual.spec.ts` — Existing E2E spec pattern (sequential describe blocks, screenshot capture)
- `playwright.config.ts` — E2E config: sequential execution, workers: 1, Vite dev server, 60s timeout

### Fixtures
- `tests/fixtures/alto-index/generate-alto-fixtures.mjs` — Fixture generator script for all 11 types (notes, contacts, calendar, messages, books, calls, safari-history, kindle, reminders, safari-bookmarks, voice-memos)
- `tests/fixtures/alto-index/*.json` — 11 committed fixture files (currently ~25 cards each; notes.json to be bumped to ~250)

### FTS5 search
- `src/worker/handlers/search.handler.ts` — FTS5 search handler
- `src/worker/WorkerBridge.ts` §249 — FTS5 query interface

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `importNativeCards(page, cards, sourceType)` — E2E helper that injects CanonicalCard[] through bridge, same path as Swift native adapters
- `assertCatalogRow(page, sourceType, expectedMinCards)` — Verifies import_sources, import_runs, and cards table entries
- `resetDatabase(page)` — Clears cards/connections/catalog tables for test isolation
- `waitForAppReady(page)` — Waits for `__isometry` to be available with bridge, viewManager, sampleManager
- `getCardCount(page)` — Returns card count from database
- `generate-alto-fixtures.mjs` — Generates fixture JSON with randomUUID, varied fields, edge cases (long titles, Unicode, special chars)

### Established Patterns
- Sequential E2E execution: `fullyParallel: false, workers: 1` — each test builds on prior state
- `page.evaluate()` for all database queries via `__isometry.queryAll()` and `__isometry.exec()`
- Fixture JSON committed to repo, deterministic test data
- `assertCatalogRow` pattern for verifying import provenance

### Integration Points
- `e2e/helpers/etl.ts` — New `importAltoIndex` helper extends this file
- `e2e/` directory — New `alto-index.spec.ts` joins 20+ existing specs
- CI pipeline — Same `e2e` job, no pipeline changes needed

</code_context>

<specifics>
## Specific Ideas

- The 11 subdirectory types and their parser routing from the full load test: notes (apple_notes parser), contacts/calendar/messages/books/calls/safari-history/kindle/reminders/safari-bookmarks/voice-memos (all markdown parser)
- The source field values per type: alto_notes, alto_contacts, alto_calendar, alto_messages, alto_books, alto_calls, alto_safari_history, alto_kindle, alto_reminders, alto_safari_bookmarks, alto_voice_memos
- FTS5 bulk rebuild triggers at totalCards > 500 (isBulkImport constant in etl-import-native.handler.ts)
- Purge order is connections → cards → datasets (FK constraint safe)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 110-alto-index-e2e*
*Context gathered: 2026-03-22*
