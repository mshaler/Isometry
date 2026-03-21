---
phase: 96-dnd-migration
plan: 01
subsystem: ui
tags: [pointer-events, drag-drop, supergrid, WKWebView, axis-reorder]

# Dependency graph
requires:
  - phase: 95-projection-explorer-pointer-dnd
    provides: Canonical pointer DnD pattern (pointerdown/pointermove/pointerup + setPointerCapture + ghost + getBoundingClientRect hit-testing)
provides:
  - SuperGrid axis grip pointer-event DnD (row and col grips)
  - Ghost chip CSS class .sg-axis-grip--ghost with LATCH color border
  - _pointerHitTestDropZones() for drop zone highlighting during drag
  - _handlePointerDrop() with reorder/transpose guards and FLIP snapshot capture
  - data-sg-drop-target test escape hatch for jsdom zero-rect hit-testing
affects: [96-02-dnd-migration, tests/views/SuperGrid.test.ts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "data-sg-drop-target attribute on drop zones for jsdom test escape hatch (pointer events + getBoundingClientRect incompatibility)"
    - "setPointerCapture?.() optional chaining for jsdom compatibility (method not implemented in jsdom)"
    - "Drop zones are children of _rootEl (not _gridEl) -- all pointer hit-testing must query _rootEl"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/styles/supergrid.css
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Used optional chaining (setPointerCapture?.()) instead of if-guard for jsdom compatibility -- more idiomatic and concise"
  - "Drop zone hit-testing queries _rootEl not _gridEl: drop zones are appended to root wrapper (parent of grid), not to grid itself"
  - "Test escape hatch data-sg-drop-target attribute on drop zone: tests set this before pointerup, _handlePointerDrop checks it first before real getBoundingClientRect hit-test"
  - "Preserved dataset['reorderTargetIndex'] mechanism from HTML5 DnD tests: _handlePointerDrop reads it from the matched drop zone"
  - "_wireDropZone body emptied (not removed): drop zone elements still created as pointer hit-test targets with .axis-drop-zone class"

patterns-established:
  - "Pointer DnD test helpers: firePointerEvent(el, type, coords) + fireGripToDrop(grip, dropZone) + fireSameDimDrop(grip, dropZone, targetIdx)"
  - "Ghost chip cleanup: _ghostEl?.remove() + _ghostEl = null + document.body.style.cursor = '' + dragSourceEl.style.opacity = '' in single _handlePointerDrop method"

requirements-completed: [DND-01, DND-02, DND-05]

# Metrics
duration: 45min
completed: 2026-03-19
---

# Phase 96 Plan 01: DnD Migration - SuperGrid Axis Grip Summary

**SuperGrid axis grip DnD migrated from HTML5 (dragstart/drop) to pointer events (pointerdown/pointermove/pointerup) with ghost chip, LATCH color border, drop zone hit-testing, and insertion line — works in WKWebView**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-19T03:00:00Z
- **Completed:** 2026-03-19T03:45:00Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Migrated row and col header axis grips from HTML5 DnD to pointer events — grips no longer set `draggable="true"` or listen to `dragstart`/`dragend`
- Ghost chip `.sg-axis-grip--ghost` follows cursor with LATCH family color border (borderLeftColor from `LATCH_COLORS`)
- `_pointerHitTestDropZones()` highlights drop zones with `drag-over` class during `pointermove`
- `_handlePointerDrop()` preserves all business logic: same-dimension reorder (reorderColAxes/reorderRowAxes), cross-dimension transpose (setColAxes/setRowAxes), all guards (min-1 axis, no duplicates, TIME-04 period clear), FLIP snapshot capture
- Updated 404-test SuperGrid test suite to use pointer event helpers; all tests pass
- `_calcReorderTargetIndex` signature updated from `(e: DragEvent, ...)` to `(clientX, clientY, ...)` — cleaner and not tied to event type

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ghost chip CSS and migrate SuperGrid grip DnD to pointer events** - `3dcd7276` (feat)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Row and col grip listeners replaced; _ghostEl module var added; _calcReorderTargetIndex signature changed; _wireDropZone emptied; _pointerHitTestDropZones and _handlePointerDrop added; getLatchFamily/LATCH_COLORS imported from latch.ts
- `src/styles/supergrid.css` - .sg-axis-grip--ghost class added (position:fixed, pointer-events:none, z-index:9999, opacity:0.8)
- `tests/views/SuperGrid.test.ts` - DnD tests migrated to pointer event helpers; fireDragEvent removed; firePointerEvent/fireGripToDrop/fireSameDimDrop added; DragEvent polyfill block removed

## Decisions Made
- `setPointerCapture?.()` optional chaining for jsdom (method not implemented): cleaner than if-guard
- `data-sg-drop-target` test escape hatch: tests set this on drop zone before pointerup; `_handlePointerDrop` checks it before real hit-test (avoids jsdom zero-rect problem)
- Drop zones are children of `_rootEl` not `_gridEl`: both `_pointerHitTestDropZones` and `_handlePointerDrop` updated to query `_rootEl`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Drop zones are children of _rootEl, not _gridEl**
- **Found during:** Task 1 (test execution)
- **Issue:** `_pointerHitTestDropZones` and `_handlePointerDrop` queried `this._gridEl.querySelectorAll('.axis-drop-zone')` but drop zones are appended to `root` (parent of `grid`) in `mount()` — query returned empty NodeList
- **Fix:** Changed both methods to query `this._rootEl` instead of `this._gridEl`
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** 404/404 SuperGrid tests pass after fix
- **Committed in:** 3dcd7276 (Task 1 commit)

**2. [Rule 1 - Bug] jsdom does not implement setPointerCapture**
- **Found during:** Task 1 (test execution — TypeError: grip.setPointerCapture is not a function)
- **Issue:** jsdom does not implement `setPointerCapture`/`releasePointerCapture` on HTMLElement
- **Fix:** Added optional chaining (`grip.setPointerCapture?.(e.pointerId)` and `grip.releasePointerCapture?.(e.pointerId)`) on both row and col grip handlers
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** No more TypeError in test runs; 404/404 pass
- **Committed in:** 3dcd7276 (Task 1 commit)

**3. [Rule 1 - Bug] Test helpers used HTML5 DnD events not pointer events**
- **Found during:** Task 1 (test execution)
- **Issue:** `fireDragEvent`, `fireSameDimDrop` used `DragEvent(dragstart/dragover/drop)` which no longer fire the implementation; `getAttribute('draggable')` check expected `'true'` but grips no longer have `draggable` attribute
- **Fix:** Replaced `fireDragEvent` with `firePointerEvent`/`fireGripToDrop`/`fireSameDimDrop` using `PointerEvent`; updated draggable assertion to `toBeNull()`; removed jsdom DragEvent polyfill block
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 404 SuperGrid tests pass
- **Committed in:** 3dcd7276 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs found during test execution)
**Impact on plan:** All three fixes were necessary for correctness and test compatibility. No scope creep.

## Issues Encountered
- Plan referenced `.row-drop-zone, .col-drop-zone` CSS classes but actual drop zones use `.axis-drop-zone axis-drop-zone--col/row` with `data-drop-zone="col|row"` — corrected automatically
- jsdom getBoundingClientRect returns zero-sized rects, making real hit-testing impossible in tests — solved with `data-sg-drop-target` escape hatch

## Next Phase Readiness
- SuperGrid axis grip DnD complete (pointer events, ghost, drop zones, reorder, transpose)
- Phase 96-02 covers KanbanView card drag and DataExplorerPanel file import

---
*Phase: 96-dnd-migration*
*Completed: 2026-03-19*
