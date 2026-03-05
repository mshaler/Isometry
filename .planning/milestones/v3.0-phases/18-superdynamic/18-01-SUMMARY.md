---
phase: 18-superdynamic
plan: 01
subsystem: ui
tags: [html5-dnd, drag-drop, supergrid, pafvprovider, axis-transpose, typescript]

# Dependency graph
requires:
  - phase: 17-supergrid-dynamic-axis-reads
    provides: SuperGrid._fetchAndRender pipeline, StateCoordinator subscription, SuperGridProviderLike, getStackedGroupBySQL
  - phase: 15-pafvprovider-stacked-axes
    provides: PAFVProvider.setColAxes/setRowAxes with validation and subscriber notification
provides:
  - HTML5 DnD axis transpose in SuperGrid (row→col and col→row via grip handles)
  - AxisDragPayload module-level singleton pattern
  - SuperGridProviderLike extended with setColAxes/setRowAxes
  - Drop zone elements with dragover/dragleave/drop handlers
  - Min-1-axis and no-duplicate-field constraint enforcement
affects:
  - 18-superdynamic (plans 02+: same-dimension reorder, animation, persistence)
  - Any future phase modifying SuperGrid or SuperGridProviderLike

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTML5 DnD module-level dragPayload singleton (dataTransfer.getData blocked during dragover)"
    - "Grip handle dragstart sets _dragPayload at module level; drop zone reads it and nulls it"
    - "Drop handler calls provider.setColAxes/setRowAxes — StateCoordinator subscription auto-triggers _fetchAndRender"
    - "Axis field stored in grip (not displayed value) — rowCell.value is data value, rowAxes[0].field is the axis"
    - "Drop zone elements wired once in mount() as persistent overlays on _rootEl"

key-files:
  created: []
  modified:
    - src/views/types.ts
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "AxisDragPayload.field stores the axis field name (e.g. 'card_type'), NOT the displayed value (e.g. 'note') — grips must encode the axis field for cross-dimension transpose to target the correct provider array"
  - "Drop zones created once in mount() as absolute-positioned overlay strips on _rootEl — avoids re-wiring on every _renderCells() call"
  - "Grip dragstart uses e.stopPropagation() to prevent header collapse click handler from firing"
  - "Drop zones are persistent (not part of CSS Grid flow) — no deduplication guard needed unlike KanbanView column bodies"
  - "SuperGridProviderLike extended to include setColAxes/setRowAxes — existing test mocks updated to satisfy new interface"

patterns-established:
  - "Axis DnD: grip handles on col/row headers set _dragPayload singleton at dragstart; drop zones read and null it at drop time"
  - "Constraint enforcement at interaction layer: min-1 and no-duplicate checks in _wireDropZone before calling provider"

requirements-completed: [DYNM-01, DYNM-02]

# Metrics
duration: 44min
completed: 2026-03-04
---

# Phase 18 Plan 01: SuperDynamic Axis DnD Summary

**HTML5 drag-drop axis transpose for SuperGrid using module-level _dragPayload singleton, .axis-grip handles on all headers, and drop zones that call provider.setColAxes/setRowAxes with min-1 and no-duplicate constraint guards**

## Performance

- **Duration:** 44 min
- **Started:** 2026-03-04T18:13:00Z
- **Completed:** 2026-03-04T18:57:48Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Extended `SuperGridProviderLike` interface with `setColAxes(axes)` and `setRowAxes(axes)` — PAFVProvider already implements both
- Added `AxisDragPayload` type and `_dragPayload` module-level singleton (STATE.md locked constraint) outside the SuperGrid class
- Added `.axis-grip` handles to all column headers (in `_createColHeaderCell`) and row headers (in `_renderCells` row loop)
- Created persistent `[data-drop-zone="col"]` and `[data-drop-zone="row"]` overlay elements wired once in `mount()`
- Implemented cross-dimension transpose drop handler with min-1-axis and no-duplicate-field guards
- Drop handler calls `provider.setColAxes/setRowAxes` — StateCoordinator subscription fires `_fetchAndRender()` automatically (no direct call)
- Added 10 new DYNM-01/DYNM-02 tests; full suite: 1292 tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SuperGridProviderLike and add dragPayload singleton + grip handles + cross-dimension transpose** - `6fa95249` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `/Users/mshaler/Developer/Projects/Isometry/src/views/types.ts` - Added `setColAxes` and `setRowAxes` to `SuperGridProviderLike` interface
- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` - Added `AxisDragPayload` type, `_dragPayload` singleton, grip handles on col/row headers, `_colDropZoneEl`/`_rowDropZoneEl` fields, drop zones in `mount()`, `_wireDropZone()` method with full constraint enforcement
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` - Updated existing mocks to satisfy new interface (setColAxes/setRowAxes), added DragEvent polyfill and 10 new DYNM-01/DYNM-02 tests

## Decisions Made
- **Axis field vs displayed value in grip**: The grip dragstart handler stores `axisField` (e.g. `'card_type'`) in `_dragPayload.field`, not `cell.value` (e.g. `'note'`). This was a discovered pitfall — row headers display data values ('A', 'B'), not axis fields. The field comes from `colAxes[levelIdx].field` for col headers and `rowAxes[0].field` for row headers.
- **Drop zones wired in mount(), not renderCells()**: Drop zones are persistent `<div>` elements appended to `_rootEl` with `position: absolute`. This avoids re-registering listeners on every render. The grid DOM is cleared on each `_renderCells()` call, so any elements added there would need deduplication guards.
- **Grip in col header replaces textContent assignment**: Previously `el.textContent = cell.value` — now the label is a `<span>` inside the div alongside the `.axis-grip` span. Updated one existing test that used `=== 'note'` strict equality to use `.includes('note')`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Axis grip must store field name, not displayed value**
- **Found during:** Task 1 (implementation + testing)
- **Issue:** Initial implementation set `_dragPayload.field = cell.value` (the axis value like 'note', 'A') instead of the axis field name ('card_type', 'folder'). Cross-dimension transpose targets the wrong provider array.
- **Fix:** Changed `_createColHeaderCell` to accept `axisField` parameter from `colAxes[levelIdx].field`; row header grip reads `rowAxes[0].field`. The field name is what identifies which provider array entry to move, not the displayed value.
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** Tests for setColAxes/setRowAxes calls with correct field names pass
- **Committed in:** 6fa95249 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Updated all existing mock providers to satisfy new interface**
- **Found during:** Task 1 (test update phase)
- **Issue:** 4 inline `SuperGridProviderLike` constructions in the test file lacked `setColAxes`/`setRowAxes` after the interface was extended. TypeScript would reject them.
- **Fix:** Added `setColAxes: vi.fn()` and `setRowAxes: vi.fn()` to: `makeMockProvider` factory, two inline `emptyProvider` objects, and one inline provider in the FOUN-11 coordinator test.
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 1292 tests pass, no TypeScript errors
- **Committed in:** 6fa95249 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug — wrong field identity; 1 missing critical — interface conformance)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Initial test helper `fireDragEvent` dispatched events but `_dragPayload` wasn't being set — traced to the axis field vs value confusion (bug fixed above)
- jsdom DragEvent polyfill was already at module level in the test file (placed before `describe` block) — no conflict with KanbanView.test.ts polyfill since test files run in separate contexts

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DYNM-01/DYNM-02: Cross-dimension transpose complete and tested
- DYNM-03: Same-dimension axis reorder (in-stack, plan 18-02 or 18-03) — ready to implement; grip handles are already rendered
- DYNM-04: 300ms D3 transition after reflow — will add to `_fetchAndRender()` after render; transitions.ts crossfade pattern is the reference
- DYNM-05: Persistence across view switches — already handled by PAFVProvider.toJSON()/setState() (Phase 15/17)

---
*Phase: 18-superdynamic*
*Completed: 2026-03-04*
