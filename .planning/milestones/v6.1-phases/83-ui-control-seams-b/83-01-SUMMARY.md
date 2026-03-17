---
phase: 83-ui-control-seams-b
plan: 01
subsystem: testing
tags: [vitest, sql.js, fts5, etl, seam-tests, SQLiteWriter, searchCards]

# Dependency graph
requires:
  - phase: 79-test-infrastructure
    provides: realDb() WASM factory with production schema
  - phase: 8-etl
    provides: SQLiteWriter batched write with FTS optimization
  - phase: search
    provides: searchCards() FTS5 MATCH query

provides:
  - ETL-to-FTS5 seam test suite (8 tests, EFTS-01..02)
  - Verification that SQLiteWriter trigger path and bulk rebuild path both produce searchable FTS5 results

affects: [phase-84-ui-polish, any phase that modifies SQLiteWriter or searchCards]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "makeCard() inline factory for CanonicalCard with sensible defaults and Partial<> overrides"
    - "db.exec() for raw SQL count verification alongside high-level searchCards() assertions"
    - "EFTS-02b bulk path: 502 cards (501 + unique target) with writeCards(cards, true) triggers disable/rebuild FTS path"

key-files:
  created:
    - tests/seams/etl/etl-fts.test.ts
  modified: []

key-decisions:
  - "Do NOT use seedCards() for ETL seam tests — SQLiteWriter is the SUT and must perform all inserts itself (seedCards uses raw SQL INSERT which bypasses SQLiteWriter)"
  - "Soft-delete exclusion verified via raw SQL UPDATE then searchCards() — tests the deleted_at IS NULL JOIN in searchCards not the FTS index itself"
  - "EFTS-02b uses 502 cards (501 + 1 unique target) to guarantee the bulk threshold (>500) is crossed and FTS rebuild path is exercised"

patterns-established:
  - "ETL seam tests: realDb() + SQLiteWriter as SUT + searchCards() as query surface, no mocks, no Worker thread needed"
  - "makeCard() factory pattern: explicit 25-field default + Partial<> overrides at the call site for readable tests"

requirements-completed:
  - EFTS-01
  - EFTS-02

# Metrics
duration: 7min
completed: 2026-03-17
---

# Phase 83 Plan 01: ETL-to-FTS5 Seam Tests Summary

**8 seam tests verifying SQLiteWriter-to-FTS5 pipeline via trigger path (INSERT fires cards_fts_ai) and bulk rebuild path (disable triggers → insert 501+ cards → rebuild), plus searchCards() round-trip and soft-delete exclusion**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-17T13:38:37Z
- **Completed:** 2026-03-17T13:45:40Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- 8 tests covering both FTS code paths in SQLiteWriter: trigger path (writeCards false) and bulk rebuild path (writeCards true, 501+ cards)
- EFTS-01: Verified name search, content search, rowcount parity, and empty-result guard for trigger path
- EFTS-02: Verified updateCards() FTS update (old name excluded / new name findable), bulk import FTS rebuild, rowcount parity after bulk import, and soft-delete exclusion via deleted_at IS NULL JOIN in searchCards()

## Task Commits

1. **Task 1: ETL-to-FTS5 seam tests (trigger path + searchCards round-trip)** - `5efe3747` (feat)

## Files Created/Modified
- `tests/seams/etl/etl-fts.test.ts` - 8 seam tests (EFTS-01a..d, EFTS-02a..d) verifying SQLiteWriter → FTS5 → searchCards() pipeline

## Decisions Made
- Used `makeCard()` inline factory (not `seedCards()`) because SQLiteWriter is the SUT — bypassing it via raw SQL inserts would defeat the purpose of the seam test
- Soft-delete test uses raw `db.run()` UPDATE to set `deleted_at` directly, then verifies `searchCards()` excludes via its `AND c.deleted_at IS NULL` JOIN condition
- EFTS-02b uses 502 cards total (501 in loop + 1 named target) so the >500 BULK_THRESHOLD is crossed and the disable/rebuild code path is fully exercised

## Deviations from Plan

None — plan executed exactly as written. All 8 tests passed on first run with zero implementation changes needed (production code was already correct).

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- ETL seam tests complete; all 4 seam domains now have coverage: filter (CELL, PAFV), coordinator (density), UI (histogram, commandbar, view-tab-bar), ETL (FTS5)
- Phase 83 plan 01 complete; ready for next plan in phase 83 or phase 84 (UI polish)

---
*Phase: 83-ui-control-seams-b*
*Completed: 2026-03-17*
