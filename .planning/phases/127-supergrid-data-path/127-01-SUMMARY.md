---
phase: 127-supergrid-data-path
plan: 01
subsystem: ui
tags: [supergrid, pivot-grid, d3, data-adapter, empty-state, error-banner]

# Dependency graph
requires:
  - phase: 122-supergrid-refactor
    provides: BridgeDataAdapter + DataAdapter interface + PivotGrid/PivotTable architecture
provides:
  - FetchDataResult interface — fetchData now returns data + rowCombinations + colCombinations
  - PivotGrid.render() accepts explicit row/col combinations instead of calling generateCombinations
  - Two-state empty state in PivotTable (no-axes + no-data)
  - Error banner with Retry Query button for fetchData failures
affects: [128-supergrid-calc-footer, 129-catalog-supergrid-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - FetchDataResult return type pattern — adapters extract unique combinations from query result keys
    - Empty state ownership — PivotTable intercepts before grid.render(), PivotGrid is display-only
    - Alphabetical sort of row/col combinations from BridgeDataAdapter for stable display

key-files:
  created: []
  modified:
    - src/views/pivot/DataAdapter.ts
    - src/views/pivot/BridgeDataAdapter.ts
    - src/views/pivot/MockDataAdapter.ts
    - src/views/pivot/PivotGrid.ts
    - src/views/pivot/PivotTable.ts
    - src/views/CatalogSuperGrid.ts
    - tests/views/pivot/DataAdapter.test.ts
    - tests/views/pivot/PivotTable.test.ts

key-decisions:
  - "FetchDataResult: fetchData returns {data, rowCombinations, colCombinations} instead of bare Map — enables PivotGrid to render real axis values from query results"
  - "PivotTable owns empty state: grid.render() is only called when data exists; PivotTable intercepts no-axes and no-data before calling fetchData or render()"
  - "BridgeDataAdapter sorts combinations alphabetically per level for stable display order across re-renders"
  - "CatalogDataAdapter preserves query insertion order for combinations (datasets:query result order is stable)"

patterns-established:
  - "FetchDataResult pattern: DataAdapter.fetchData() returns {data, rowCombinations, colCombinations} — combinations derived from actual query keys, not static HeaderDimension.values"
  - "Empty state ownership: orchestrator (PivotTable) intercepts empty states before delegating to renderer (PivotGrid)"

requirements-completed: [SGRD-01, SGRD-02]

# Metrics
duration: 20min
completed: 2026-03-27
---

# Phase 127 Plan 01: SuperGrid Data Path Summary

**Fixed SuperGrid data path: PivotGrid now renders real sql.js query results via FetchDataResult with dynamic row/col combinations, plus two-state empty state (no-axes / no-data) and error banner with Retry Query.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-27T20:00:00Z
- **Completed:** 2026-03-27T20:20:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Added `FetchDataResult` interface to `DataAdapter.ts` — `fetchData()` now returns `{data, rowCombinations, colCombinations}` instead of a bare `Map`
- Fixed the root cause: `BridgeDataAdapter.fetchData()` extracts unique row/col combinations from `CellDatum[]` keys so `PivotGrid` can render without static `HeaderDimension.values`
- Added two-state empty state to `PivotTable`: "No axes configured" (skips fetchData) and "No matching cards" (zero-row result)
- Added error banner with "Retry Query" button for fetchData failures
- Updated `MockDataAdapter`, `CatalogDataAdapter`, and all tests to match new interface

## Task Commits

1. **Task 1: Fix PivotGrid to derive row/col combinations from data Map keys** - `f0c7b14f` (feat)
2. **Task 2: Add two-state empty state handling and error banner** - `1fd9225b` (feat)

## Files Created/Modified
- `src/views/pivot/DataAdapter.ts` - Added `FetchDataResult` interface; updated `fetchData` signature
- `src/views/pivot/BridgeDataAdapter.ts` - Updated `fetchData` to extract unique combinations from CellDatum[] keys with alphabetical sort
- `src/views/pivot/MockDataAdapter.ts` - Updated `fetchData` to return `FetchDataResult` wrapping `generateCombinations()`
- `src/views/pivot/PivotGrid.ts` - Updated `render()` to accept `rowCombinations`/`colCombinations` params; removed `generateCombinations` import; added `_lastRowCombinations`/`_lastColCombinations` fields
- `src/views/pivot/PivotTable.ts` - Updated `_renderAll()` with `hasAxes` guard and `result.data.size === 0` check; added `_showEmptyState()`, `_clearEmptyState()`, `_showErrorBanner()`, `_clearErrorBanner()` methods
- `src/views/CatalogSuperGrid.ts` - Updated `CatalogDataAdapter.fetchData()` to return `FetchDataResult`
- `tests/views/pivot/DataAdapter.test.ts` - Updated tests to use `FetchDataResult` shape
- `tests/views/pivot/PivotTable.test.ts` - Updated `grid.render()` calls to pass combinations; updated empty state test

## Decisions Made
- FetchDataResult chosen over extending HeaderDimension.values to avoid mutating the type contract used across the codebase
- PivotTable owns empty state rather than PivotGrid — cleaner separation: PivotGrid is a pure renderer, PivotTable is the orchestrator
- BridgeDataAdapter sorts combinations alphabetically for stable display across re-renders; CatalogDataAdapter preserves query order (more meaningful for catalog view)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated CatalogDataAdapter.fetchData() to return FetchDataResult**
- **Found during:** Task 1 (TypeScript typecheck after DataAdapter interface change)
- **Issue:** `CatalogSuperGrid.ts` implements `DataAdapter` with `fetchData()` returning bare `Map<string, number | null>` — type error after interface change
- **Fix:** Updated `CatalogDataAdapter.fetchData()` to return `FetchDataResult` with insertion-order combinations from the query result
- **Files modified:** `src/views/CatalogSuperGrid.ts`
- **Verification:** `npx tsc --noEmit` exits with code 0
- **Committed in:** `f0c7b14f` (Task 1 commit)

**2. [Rule 1 - Bug] Updated DataAdapter test assertions to use FetchDataResult**
- **Found during:** Task 1 (TypeScript typecheck on test files)
- **Issue:** `tests/views/pivot/DataAdapter.test.ts` and `tests/views/pivot/PivotTable.test.ts` used old `fetchData()` return type and old `render()` signature
- **Fix:** Updated both test files to use `.data`, `.rowCombinations`, `.colCombinations` accessors and pass combinations to `grid.render()`
- **Files modified:** `tests/views/pivot/DataAdapter.test.ts`, `tests/views/pivot/PivotTable.test.ts`
- **Verification:** All 569 pivot tests pass
- **Committed in:** `f0c7b14f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 1 bugs from interface cascade)
**Impact on plan:** Both auto-fixes required for correctness after interface change. No scope creep.

## Issues Encountered
None beyond the interface cascade caught by TypeScript.

## Next Phase Readiness
- Data path fixed: PivotGrid renders real sql.js results when axes are configured and data exists
- Empty states render per UI-SPEC copy
- Ready for Phase 127 Plan 02 (CalcExplorer footer rows — SGRD-03)

---
*Phase: 127-supergrid-data-path*
*Completed: 2026-03-27*
