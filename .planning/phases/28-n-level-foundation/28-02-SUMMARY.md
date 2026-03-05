---
phase: 28-n-level-foundation
plan: 02
subsystem: ui
tags: [supergrid, pafv, compound-keys, n-level, stacking, d3, cell-keys]

# Dependency graph
requires:
  - phase: 28-01
    provides: keys.ts shared utility (buildDimensionKey, buildCellKey, parseCellKey, findCellInData, RECORD_SEP, UNIT_SEP)
provides:
  - SuperGrid._renderCells uses buildCellKey for cellMap preindex (all N axis levels)
  - D3 data join key function uses RECORD_SEP (\x1e) between dimensions — uniquely identifies N-level cells
  - dataset['key'] uses RECORD_SEP (\x1e) between dimensions, UNIT_SEP (\x1f) within — single format for all consumers
  - _getCellCardIds delegates to findCellInData from keys.ts (single source of truth)
  - _getRectangularRangeCardIds uses buildDimensionKey for compound range selection
  - Asymmetric depth grid rendering: rows and col dimensions independently support different stacking depths
affects:
  - 28-03 (SuperGridSelect lasso/click lookup via dataset['key'] now uses RECORD_SEP format)
  - 28-04 (BBoxCache keying via dataset['key'] now uses RECORD_SEP format)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SuperGrid._renderCells delegates all key construction to keys.ts — no inline \x1f/\x1e literals in rendering pipeline"
    - "colValueToStart map uses full compound col key (parentPath\\x1fvalue) matching buildDimensionKey output"
    - "Hide-empty filter uses tuple-based comparison for N-level axis deduplication"
    - "UNIT_SEP (\\x1f) joins axis levels within a single dimension; RECORD_SEP (\\x1e) separates row from col dimension"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "RECORD_SEP (\\x1e) replaces old \\x1f between row/col in dataset['key'] — deliberate format change, all construction+parsing uses same separator"
  - "colValueToStart map keyed by full compound col key (parentPath\\x1fvalue) to correctly map multi-level leaf cols to grid positions"
  - "Fix-3 regression test updated to expect new \\x1e separator — documents intentional format evolution from Phase 28"
  - "Row header Cmd+click select-all preserved as primary-axis-only for backward compat — N-level row select is out of scope for Plan 02"

patterns-established:
  - "All SuperGrid key construction flows through keys.ts — no consumer builds its own \\x1f/\\x1e keys inline"
  - "Cell placement loop reconstructs compound keys from HeaderCell.parentPath + UNIT_SEP + value — matching SuperStackHeader parentPath convention"

requirements-completed: [STAK-03, STAK-04]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 28 Plan 02: SuperGrid Compound Key Integration Summary

**SuperGrid._renderCells pipeline fully wired to keys.ts compound key utility — cells now use RECORD_SEP (\\x1e) between row/col dimensions and UNIT_SEP (\\x1f) within dimensions for all N-level axis configurations**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T22:43:36Z
- **Completed:** 2026-03-05T22:48:47Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- SuperGrid._renderCells now constructs N-level tuple keys for all cells: `colTuples`, `rowTuples`, hide-empty filter, cellMap preindex all use compound keys from keys.ts (STAK-03)
- Cell placement loop reconstructs full compound keys from `HeaderCell.parentPath + UNIT_SEP + value` — enabling correct lookup for multi-level axes where leaf values may repeat across parents
- D3 data join key function and `dataset['key']` updated to use RECORD_SEP (`\x1e`) between row/col dimensions — uniqueness guaranteed for asymmetric depth grids (STAK-04)
- `_getCellCardIds` refactored to single line using `findCellInData` from keys.ts — eliminates old single-field parsing
- `_getRectangularRangeCardIds` uses `buildDimensionKey` for compound range rectangle — Shift+click selection works correctly with N-level axes
- Full TDD cycle: 4 RED tests (STAK-03/STAK-04), GREEN implementation, all 310 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Integrate compound keys into SuperGrid _renderCells pipeline** - `89d257e7` (feat)

_Note: TDD task — tests written first (RED), then implementation (GREEN), committed together_

## Files Created/Modified

- `src/views/SuperGrid.ts` — Added keys.ts import; replaced single-field axis extraction with N-level tuple construction; updated cellMap, cell placement loop, D3 key function, dataset key, click handler, _getCellCardIds, _getRectangularRangeCardIds
- `tests/views/SuperGrid.test.ts` — Added 5 new compound key tests (Phase 28 describe block); updated Fix-3 regression test to expect new \x1e format

## Decisions Made

- RECORD_SEP (`\x1e`) is the definitive row/col boundary separator — the old `\x1f` between dimensions is retired
- `colValueToStart` map uses full compound col key so multi-level leaf columns map correctly to CSS Grid column positions
- Fix-3 regression test updated (not left broken) because the format change is intentional — documented as Phase 28 evolution

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated Fix-3 regression test to match new key format**
- **Found during:** Task 1 (GREEN phase — test run)
- **Issue:** "Regression: Fix 3 — cell key encoding with \x1f separator" test hardcoded `\x1f` separator between row/col, but Plan 28-02 intentionally changes this to `\x1e`
- **Fix:** Updated test assertions to expect `\x1e` separator and renamed describe block to "compound key separators"
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 310 tests pass with new format
- **Committed in:** 89d257e7 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug: stale test asserting old separator format)
**Impact on plan:** Fix required for correctness — stale test was documenting the old format that Plan 28-02 is specifically replacing. No scope creep.

## Issues Encountered

None — implementation followed plan exactly. The SuperStackHeader `parentPath` convention (already using `\x1f`-joined ancestor values) made compound key reconstruction straightforward.

## Next Phase Readiness

- All SuperGrid key construction and parsing now flows through keys.ts — Plan 28-03 (SuperGridSelect lasso) and Plan 28-04 (BBoxCache) can import keys.ts without any SuperGrid-side changes
- dataset['key'] format locked as `rowDimKey\x1ecolDimKey` — all consumers reading this attribute will get compound keys
- 310 passing tests, zero regressions across 1938 total suite tests

---
*Phase: 28-n-level-foundation*
*Completed: 2026-03-05*
