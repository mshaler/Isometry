---
phase: 22-superdensity
plan: 03
subsystem: ui
tags: [supergrid, density, hide-empty, view-mode, spreadsheet, matrix, heat-map, d3, typescript, tdd]

# Dependency graph
requires:
  - phase: 22-superdensity-plan01
    provides: SuperDensityProvider foundation, SuperGridDensityLike interface, hideEmpty/viewMode state fields
  - phase: 22-superdensity-plan02
    provides: Density toolbar DOM in mount(), _updateDensityToolbar() method, _hiddenIndicatorEl field

provides:
  - Hide-empty checkbox in density toolbar with reactive filtering of all-zero rows and columns (DENS-02)
  - "+N hidden" badge (.supergrid-hidden-badge) showing total hidden row+column count
  - View mode <select data-control="view-mode"> in density toolbar (DENS-03)
  - Spreadsheet mode: card pills (.card-pill) with "+N more" overflow badge (.overflow-badge) for cells with >3 card IDs
  - Matrix mode: d3.scaleSequential().interpolateBlues heat map background colors on non-empty cells
  - Client-side re-render path: hideEmpty/viewMode changes call _renderCells() from _lastCells (no Worker re-query)
  - 15 new DENS-02/DENS-03 tests

affects: [future-supergrid-density-ui, v3.0-superdensity-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "d3.scaleSequential().domain([0, maxCount]).interpolator(d3.interpolateBlues): heat map computed once before D3 loop"
    - "Hide-empty filter: colValues/rowValues filtered via cells.some(c => count > 0) before passing to buildHeaderCells()"
    - "Spreadsheet card pills: max 3 visible per cell, overflow-badge for remaining"
    - "_updateHiddenBadge(): lazily creates .supergrid-hidden-badge, hides when count=0"
    - "_noOpDensityProvider defaults to viewMode='matrix' to preserve count-badge backward compatibility"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "_noOpDensityProvider changed from viewMode='spreadsheet' to viewMode='matrix' — backward compat for 127 pre-existing tests that check count badges"
  - "Hide-empty filter applied to colValues/rowValues BEFORE buildHeaderCells() — filtered values drive CSS Grid layout"
  - "d3.scaleSequential maxCount computed once per _renderCells() call — avoids O(N) recalculation inside D3 .each()"
  - "Spreadsheet card pills show raw card_ids (not card names) — card name lookup deferred to v3.1 per plan guidance"
  - "Density toolbar ALWAYS visible (for hide-empty + view-mode) — granularity picker hidden when no time axis (DENS-01 remains scoped to Plan 02)"

patterns-established:
  - "Client-side density re-render: density subscription notifies → compare _lastGranularity → if same, call _renderCells() without _fetchAndRender()"
  - "CellPlacement interface extended with cardIds: string[] to support spreadsheet mode pill rendering"

requirements-completed: [DENS-02, DENS-03]

# Metrics
duration: 12min
completed: 2026-03-05
---

# Phase 22 Plan 03: SuperDensity Extent + View Density Summary

**Hide-empty client-side filter removing all-zero rows/columns with "+N hidden" badge, spreadsheet mode card pills, and matrix mode d3.interpolateBlues heat map**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-05T03:54:17Z
- **Completed:** 2026-03-05T04:06:53Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Implemented Level 2 Extent Density (DENS-02): hide-empty checkbox in density toolbar; `_renderCells()` filters colValues/rowValues to remove rows/columns where all cells have count=0; "+N hidden" badge (`.supergrid-hidden-badge`) shows total hidden count, hidden when count=0
- Implemented Level 3 View Density (DENS-03): view mode `<select data-control="view-mode">` added to toolbar; matrix mode uses `d3.scaleSequential().interpolator(d3.interpolateBlues)` heat map; spreadsheet mode renders card pills (`.card-pill`) with overflow badge (`.overflow-badge`) for cells with >3 cards
- Client-side re-render path confirmed: hideEmpty/viewMode changes detected in density subscription (granularity unchanged) → `_renderCells(this._lastCells, ...)` without Worker re-query
- Fixed `_noOpDensityProvider` to default to `viewMode='matrix'` to preserve backward compatibility with all 127 pre-existing count-badge tests
- Extended `CellPlacement` interface with `cardIds: string[]` for spreadsheet mode rendering
- 15 new TDD tests: 8 for DENS-02 (hide-empty filter, badge behavior, client-side re-render, axis change reactivity), 7 for DENS-03 (card pills, overflow badge, heat map, mode toggle, toolbar control)

## Task Commits

Implementation was included in prior Plan 02 commit (mislabeled) due to multi-plan execution:

1. **Task 1 + Task 2: Hide-empty filter + view mode rendering** - `01488318` (feat) — implementation
2. **Tests: DENS-02/DENS-03 describe blocks** - `1a73cdef` (docs) — test additions

## Files Created/Modified

- `src/views/SuperGrid.ts` — Added hide-empty checkbox + view-mode select to toolbar; hide-empty filter in `_renderCells()`; `_updateHiddenBadge()` method; matrix heat map via `d3.interpolateBlues`; spreadsheet card pills with overflow; `_noOpDensityProvider` viewMode default changed to 'matrix'
- `tests/views/SuperGrid.test.ts` — Added `makeMockDensityProvider()` helper; 8 DENS-02 tests; 7 DENS-03 tests; updated DENS granularity picker test to reflect toolbar-always-visible behavior

## Decisions Made

- `_noOpDensityProvider` defaults to `viewMode='matrix'` — ensures all existing tests continue to see count-badge rendering (backward compatibility) without requiring every test to inject a density provider
- Hide-empty filter applied before `buildHeaderCells()` — filtered axis values drive CSS Grid layout; cells outside the filtered set are excluded from `cellPlacements`
- `d3.scaleSequential maxCount` computed once per `_renderCells()` call, not inside the D3 `.each()` loop — avoids N recalculations
- Spreadsheet card pills show raw card_ids (not card names) — per plan guidance, card name lookup via `db:query` bridge extension is deferred; pill visual treatment satisfies the density switch requirement
- Density toolbar ALWAYS visible (no time-axis gating at toolbar level) — granularity picker is hidden when no time axis (Plan 02 responsibility)

## Deviations from Plan

None — plan executed exactly as written. The Plan 02 SUMMARY documents an auto-fix where the toolbar-always-visible behavior was pre-implemented, which this plan consumed correctly.

## Issues Encountered

- Previous execution had committed Plan 03 implementation inside the Plan 02 commit (`01488318`). The test additions were in a subsequent commit (`1a73cdef`). This plan's execution verified the implementation is correct and all 152 tests pass.
- `_noOpDensityProvider` was initially set to `viewMode='spreadsheet'` which broke 127 pre-existing count-badge tests. Fixed by changing the default to `viewMode='matrix'` (matrix mode preserves the original count-badge rendering).

## Next Phase Readiness

- Phase 22 SuperDensity complete: DENS-01 (granularity), DENS-02 (hide-empty), DENS-03 (view mode), DENS-04 (region stub), DENS-05 (aggregate counts), DENS-06 (D3 update callback) all satisfied
- 152 SuperGrid tests pass (up from 127 at start of Phase 22)
- Ready for Phase 23 planning

---
*Phase: 22-superdensity*
*Completed: 2026-03-05*

## Self-Check: PASSED

- `.planning/phases/22-superdensity/22-03-SUMMARY.md` - FOUND (this file)
- `src/views/SuperGrid.ts` — FOUND: hideEmptyCheckbox, viewModeSelect, card-pill, interpolateBlues, supergrid-hidden-badge all present
- `tests/views/SuperGrid.test.ts` — FOUND: 152 tests passing, DENS-02 and DENS-03 describe blocks present
- Implementation commit `01488318` — FOUND in git log
- Test commit `1a73cdef` — FOUND in git log
