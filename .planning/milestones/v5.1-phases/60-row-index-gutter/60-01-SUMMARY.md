---
phase: 60-row-index-gutter
plan: 01
subsystem: ui
tags: [supergrid, css-grid, spreadsheet, gutter, row-index]

# Dependency graph
requires:
  - phase: 59-value-first-rendering
    provides: spreadsheet viewMode detection, sg-cell rendering pipeline
  - phase: 58-css-semantic-classes
    provides: sg-cell, sg-header, sg-corner-cell CSS classes, design tokens
provides:
  - 28px row index gutter column in spreadsheet mode with sequential 1..N numbering
  - Gutter corner cell at header/gutter intersection (z-index 4, sticky)
  - buildGridTemplateColumns showRowIndex parameter (backward-compatible)
  - SuperGridSizer showRowIndex passthrough for live resize
affects: [61-column-resize, supergrid-views]

# Tech tracking
tech-stack:
  added: []
  patterns: [gutterOffset pattern for CSS Grid column shifting]

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/views/supergrid/SuperStackHeader.ts
    - src/views/supergrid/SuperGridSizer.ts
    - src/styles/supergrid.css
    - tests/views/SuperStackHeader.test.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "gutterOffset (0 or 1) added to all gridColumn calculations rather than modifying buildHeaderCells colStart values"
  - "Gutter corner cell z-index 4 (above existing corner z-index 3) for proper stacking"
  - "SuperGridSizer receives _getShowRowIndex callback to maintain gutter during live resize"
  - "Row header sticky left offset includes 28px gutter width when active"

patterns-established:
  - "gutterOffset pattern: const gutterOffset = this._showRowIndex ? 1 : 0 applied to all gridColumn calculations"
  - "_showRowIndex instance flag derived from densityProvider viewMode, recomputed each _renderCells()"

requirements-completed: [RGUT-01, RGUT-02, RGUT-03, RGUT-04, RGUT-05]

# Metrics
duration: 9min
completed: 2026-03-08
---

# Phase 60 Plan 01: Row Index Gutter Summary

**28px gutter column with sticky sequential row numbers (1..N) in spreadsheet mode, hidden in matrix mode, with z-index 4 corner cell**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T22:55:32Z
- **Completed:** 2026-03-08T23:04:33Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- buildGridTemplateColumns extended with showRowIndex/gutterWidth params (backward-compatible defaults)
- Gutter corner cells rendered at header intersection with sticky positioning and z-index 4
- Sequential row index cells (1..N) rendered in spreadsheet mode gutter column
- All gridColumn offsets (corner, col header, row header, data cells) shift correctly with gutterOffset
- SuperGridSizer updated to pass showRowIndex through to buildGridTemplateColumns during live resize
- 8 new tests (3 buildGridTemplateColumns + 5 RGUT regression) -- all pass
- Matrix mode correctly renders zero gutter elements
- Row numbers re-sequence correctly after hide-empty filtering

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend buildGridTemplateColumns and render gutter cells** - `ae5ceecc` (feat)
2. **Task 2: RGUT-05 regression tests for gutter presence and absence** - `4a34dc31` (test)

**Plan metadata:** (pending -- docs commit)

## Files Created/Modified
- `src/views/supergrid/SuperStackHeader.ts` - Added showRowIndex/gutterWidth params to buildGridTemplateColumns
- `src/views/SuperGrid.ts` - Added _showRowIndex flag, gutterOffset, gutter corner cells, gutter row index cells
- `src/views/supergrid/SuperGridSizer.ts` - Added _getShowRowIndex callback, showRowIndex passthrough in applyWidths
- `src/styles/supergrid.css` - Enhanced .sg-row-index with border, sizing, flex centering, background
- `tests/views/SuperStackHeader.test.ts` - 3 new buildGridTemplateColumns tests for showRowIndex param
- `tests/views/SuperGrid.test.ts` - 5 RGUT regression tests (gutter presence, absence, corner, filtering, sticky)

## Decisions Made
- Used gutterOffset (0 or 1) applied to all gridColumn calculations rather than modifying buildHeaderCells colStart values -- simpler, keeps header algorithm untouched
- Gutter corner cell z-index 4 (above existing corner z-index 3) ensures gutter corner always visible during scroll
- SuperGridSizer receives _getShowRowIndex callback (same pattern as _getZoomLevel) for consistent live resize behavior
- Row header sticky left offset includes 28px gutter width when gutter active -- prevents row headers overlapping gutter

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- jsdom normalizes `style.left = '0'` to `'0px'` -- test assertions adjusted to expect `'0px'` instead of `'0'`

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Gutter column complete; all existing tests pass (423 total, zero regressions)
- 2 pre-existing test failures (e2e/supergrid-visual.spec.ts, SuperGridSelect lasso highlight) unrelated to this phase
- Ready for Phase 61 (next phase in milestone)

## Self-Check: PASSED

- All 6 modified files exist on disk
- Both task commits (ae5ceecc, 4a34dc31) found in git log
- 423 tests pass (391 existing + 3 buildGridTemplateColumns + 5 RGUT + 24 SuperStackHeader)
- Zero TypeScript errors in modified files
- Zero biome diagnostics in modified source files

---
*Phase: 60-row-index-gutter*
*Completed: 2026-03-08*
