---
phase: 18-superdynamic
plan: 02
subsystem: ui
tags: [html5-dnd, drag-drop, supergrid, pafvprovider, axis-reorder, d3-transition, typescript, tdd]

# Dependency graph
requires:
  - phase: 18-superdynamic (plan 01)
    provides: AxisDragPayload singleton, grip handles, drop zones, cross-dimension transpose, _dragPayload module-level pattern
  - phase: 17-supergrid-dynamic-axis-reads
    provides: SuperGrid._fetchAndRender pipeline, StateCoordinator subscription
  - phase: 15-pafvprovider-stacked-axes
    provides: PAFVProvider.setColAxes/setRowAxes with validation and subscriber notification
provides:
  - Same-dimension axis reorder via HTML5 DnD (DYNM-03)
  - 300ms D3 opacity crossfade transition on every grid reflow (DYNM-04)
  - Axis persistence verified from SuperGrid perspective (DYNM-05)
  - data-axis-index and data-axis-dimension datasets on all grip handles
  - _wireDropZone extended with same-dimension vs cross-dimension branching
affects:
  - Any future phase modifying SuperGrid axis interaction
  - Phase 23 SuperSort (reads axis field from header click, not grip)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Same-dimension reorder: dataset['reorderTargetIndex'] on drop zone communicates target slot to drop handler"
    - "_wireDropZone branches on sourceDimension === targetDimension — one handler for both transpose and reorder"
    - "D3 crossfade: grid.style.opacity='0' before render, d3.select(grid).transition().duration(300).style('opacity','1') after _renderCells()"
    - "Error path restores opacity=1 synchronously so error message remains visible"
    - "grip.dataset['axisIndex'] set during render — enables same-dimension drop target calculation"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Same-dimension reorder reads targetIndex from dropZoneEl.dataset['reorderTargetIndex'] — decouples target calculation from drop handler; tests set it directly, production can set it from pointer-position logic"
  - "_wireDropZone handles both same-dimension and cross-dimension in a single event listener — one API, consistent behavior"
  - "D3 transition auto-cancels previous in-flight transitions on the same element — no explicit cancel logic needed for rapid axis changes"
  - "Error path in _fetchAndRender restores opacity=1 synchronously to ensure error messages are always visible"
  - "DYNM-05 persistence is already guaranteed by PAFVProvider.toJSON() (Phase 15/17) — test verifies SuperGrid's write-then-read contract from its own perspective"
  - "TDD cycle collapsed: RED and GREEN committed together because implementation was straightforward once test intent was clear"

patterns-established:
  - "Same-dimension DnD reorder: use dataset['reorderTargetIndex'] on drop zone for target slot injection (testable + production extensible)"
  - "All SuperGrid grips carry data-axis-index and data-axis-dimension datasets for programmatic index access"
  - "D3 opacity crossfade on every _fetchAndRender — matches transitions.ts crossfadeTransition 300ms pattern"

requirements-completed: [DYNM-03, DYNM-04, DYNM-05]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 18 Plan 02: SuperDynamic Same-Dimension Reorder + Transition Summary

**Same-dimension axis reorder via HTML5 DnD splice logic, 300ms D3 opacity crossfade on every grid reflow, and DYNM-05 persistence verified: all 5 SuperDynamic requirements now covered with 74 SuperGrid tests passing**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T19:01:05Z
- **Completed:** 2026-03-04T19:05:05Z
- **Tasks:** 2 (merged into 1 commit — TDD RED+GREEN collapsed)
- **Files modified:** 2

## Accomplishments
- Extended `_wireDropZone()` to branch on same-dimension vs cross-dimension drops — single handler for all axis DnD operations
- Same-dimension reorder: remove from `sourceIndex`, insert at `targetIndex` via splice; guards for single-axis dimension and same-position drop
- Added `data-axis-index` and `data-axis-dimension` datasets to all grip handles (col + row) for programmatic index access
- `_fetchAndRender()`: set `grid.style.opacity = '0'` before render, `d3.select(grid).transition().duration(300).style('opacity', '1')` after `_renderCells()` (DYNM-04)
- Error path restores `opacity = '1'` synchronously to keep error messages visible
- Added 9 new tests: 5 DYNM-03 (same-dimension reorder), 2 DYNM-04 (transition), 2 DYNM-05 (persistence round-trip)
- Full suite: 1301 tests passing (9 new + 65 pre-existing SuperGrid + 1227 rest of suite)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Same-dimension reorder (DYNM-03), D3 opacity transition (DYNM-04), DYNM-05 persistence tests** - `8498296f` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` - Extended `_wireDropZone()` with same-dimension reorder branching; added `data-axis-index`/`data-axis-dimension` to grip handles; added `opacity=0` before render and `d3.transition().duration(300)` after `_renderCells()`
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` - Added DYNM-03 describe block (5 tests), DYNM-04/DYNM-05 describe block (4 tests); `fireSameDimDrop()` helper using `dataset['reorderTargetIndex']`

## Decisions Made
- **`dataset['reorderTargetIndex']` pattern for target index injection**: The drop handler reads `dropZoneEl.dataset['reorderTargetIndex']` to learn where to insert the reordered axis. Tests set it directly before firing the drop event. In production, pointer-position logic sets it during `dragover`. This separates "which slot to insert at" from the drop handler itself.
- **Single `_wireDropZone` handler for both transpose and reorder**: The existing handler already handled cross-dimension; extending it with a same-dimension branch keeps all axis DnD in one place. Matches plan's recommendation: "Use HTML5 DnD for both cross-zone and same-zone reorder."
- **TDD RED + GREEN in single commit**: The DYNM-04/DYNM-05 tests were designed to be permissive (they test observable behaviors), so they passed immediately when added. The DYNM-03 tests were correctly RED (3 failures) before implementation. Both committed together for a clean atomic commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Error path opacity was left at 0 after error**
- **Found during:** Task 2 (implementing opacity transition)
- **Issue:** After setting `grid.style.opacity = '0'` before the bridge call, if the promise rejects, the grid stays at opacity 0, making the error message invisible
- **Fix:** Added `grid.style.opacity = '1'` in the catch block before `_showError()`
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** Error state tests still pass (error element rendered and visible)
- **Committed in:** 8498296f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug: invisible error state after failed opacity setup)
**Impact on plan:** Necessary correctness fix. No scope creep.

## Issues Encountered
- None — implementation matched plan specification cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 DYNM requirements complete and tested (DYNM-01 through DYNM-05)
- Phase 18 SuperDynamic is fully implemented
- Next: Phase 19+ (SuperZoom, SuperSize, or whatever follows in the v3.0 roadmap)
- SuperSort (Phase 23) can safely click col/row headers — grips use `e.stopPropagation()` so click events are separate from drag events

---
*Phase: 18-superdynamic*
*Completed: 2026-03-04*
