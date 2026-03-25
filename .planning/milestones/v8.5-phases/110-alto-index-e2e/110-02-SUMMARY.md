---
phase: 110-alto-index-e2e
plan: "02"
subsystem: testing
tags: [playwright, e2e, alto-index, etl, fts5, card-type-schema]

# Dependency graph
requires:
  - phase: 110-01
    provides: importAltoIndex helper, 11 fixture files (500 cards total)
  - phase: 109-etl-test-infrastructure
    provides: importNativeCards, resetDatabase, assertCatalogRow in e2e/helpers/etl.ts
provides:
  - e2e/alto-index.spec.ts: Full E2E spec for alto-index import pipeline (4 describe blocks)
  - schema support for reference/message/media card_type values
affects: [CI e2e job, any code using CardType union]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single test per describe block pattern for data-dependent E2E tests (import once, verify multiple assertions)"
    - "Direct queryAll(FTS5_MATCH) for FTS5 verification instead of UI interaction"

key-files:
  created:
    - e2e/alto-index.spec.ts
  modified:
    - e2e/helpers/etl.ts
    - src/database/schema.sql
    - src/database/queries/types.ts
    - src/ui/CardPropertyFields.ts
    - src/views/CardRenderer.ts

key-decisions:
  - "assertCatalogRow not used for alto_index in dedup test — alto_index cards have individual source values (alto_notes, alto_contacts, etc.), not 'alto_index', so check 3 would always fail. Import catalog verified directly via import_sources query instead."
  - "FTS5 test asserts totalCount >= 500 (not > 500) since fixtures produce exactly 500 cards; isBulkImport triggers at > 500 so the bulk path is not exercised by exactly 500 cards. Test verifies FTS5 is populated regardless of bulk vs incremental path."
  - "card_type CHECK constraint extended to include reference/message/media — alto-index fixture generator always produced these types; schema was never updated to match."

patterns-established:
  - "Use direct SQL queryAll for catalog verification when assertCatalogRow has source field mismatch"

requirements-completed: [ALTO-02, ALTO-03, ALTO-04, ALTO-05]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 110 Plan 02: Alto-Index E2E Spec Summary

**4-describe-block Playwright E2E spec verifying alto-index type correctness (11 types), dedup idempotency, FTS5 population, and purge-then-replace behavior; required schema extension to allow reference/message/media card types**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-03-22T21:44:27Z
- **Completed:** 2026-03-22T21:50:51Z
- **Tasks:** 2 (executed together)
- **Files created/modified:** 6

## Accomplishments

- Created `e2e/alto-index.spec.ts` with 4 describe blocks and all tests passing:
  1. **Type correctness** — loops through all 11 ALTO_TYPES, queries cards by source, asserts card_type matches expected value
  2. **Dedup idempotency** — imports twice, asserts identical card count after purge-then-replace re-import
  3. **FTS5 population** — imports 500 cards, asserts `cards_fts MATCH 'Note*'` returns > 0 results
  4. **Purge-then-replace** — seeds meryl-streep sample data, imports alto-index, asserts non-alto cards = 0 and connections = 0
- All 4 tests pass in 9.8s total via `npx playwright test e2e/alto-index.spec.ts`

## Task Commits

1. **Tasks 1+2: Create full alto-index E2E spec** — `d5079e7c` (feat)

## Files Created/Modified

- `e2e/alto-index.spec.ts` — New: 200+ LOC, 4 describe blocks, 4 test cases
- `src/database/schema.sql` — Extended card_type CHECK constraint (added reference, message, media)
- `src/database/queries/types.ts` — Extended CardType union (added reference, message, media)
- `src/ui/CardPropertyFields.ts` — Added CARD_TYPES/LABELS entries for reference, message, media
- `src/views/CardRenderer.ts` — Added CARD_TYPE_ICONS entries for reference, message, media
- `e2e/helpers/etl.ts` — Fixed assertCatalogRow: JOIN pattern for import_runs, cards_inserted field name

## Decisions Made

- alto_index assertCatalogRow not used for dedup test (source field mismatch — see key-decisions above)
- FTS5 test verifies bulk-or-incremental path via FTS5 MATCH query, not by inspecting isBulkImport flag
- Schema extended (Rule 1 auto-fix) rather than modifying fixtures — fixtures were always correct per the plan's type mapping table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Schema CHECK constraint too narrow for alto-index card types**
- **Found during:** Task 1 test run — `CHECK constraint failed: card_type IN ('note', 'task', 'event', 'resource', 'person')`
- **Issue:** alto-index fixtures use `reference`, `message`, `media` card types but schema CHECK constraint only allowed the original 5 types. Generator script always produced these types; schema was never updated.
- **Fix:** Extended CHECK constraint in `schema.sql`, `CardType` union in `types.ts`, and UI records in `CardPropertyFields.ts` and `CardRenderer.ts`
- **Files modified:** `src/database/schema.sql`, `src/database/queries/types.ts`, `src/ui/CardPropertyFields.ts`, `src/views/CardRenderer.ts`
- **Commit:** `d5079e7c`

**2. [Rule 1 - Bug] assertCatalogRow used wrong column name and wrong JOIN pattern**
- **Found during:** Task 1 dedup test — `no such column: source_type` error in import_runs query
- **Issue 1:** `import_runs` does not have `source_type` column — must JOIN with `import_sources` to filter by source_type
- **Issue 2:** `runRow?.card_count` field doesn't exist in `import_runs` — correct field is `cards_inserted`
- **Fix:** Changed query to JOIN with import_sources, changed field access to `cards_inserted`
- **Files modified:** `e2e/helpers/etl.ts`
- **Commit:** `d5079e7c`

## User Setup Required

None — all tests run via `npx playwright test e2e/alto-index.spec.ts`.

## Next Phase Readiness

- Phase 110 Plan 02 complete — both ALTO-02..05 requirements satisfied
- Phase 110 is complete (all 2 plans done)
- v8.5 ETL E2E Test Suite progressing: Phase 110 done, Phases 111-113 remaining

---
*Phase: 110-alto-index-e2e*
*Completed: 2026-03-22*
