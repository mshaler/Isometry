---
phase: 89-supergrid-fixes
plan: 01
subsystem: ui
tags: [supergrid, resize, css, pointer-events, persistence]

# Dependency graph
requires:
  - phase: 89-supergrid-fixes
    provides: Phase context and research identifying row header resize gap
provides:
  - Dynamic _rowHeaderWidth field on SuperGrid replacing fixed ROW_HEADER_LEVEL_WIDTH constant
  - setRowHeaderLevelWidth() public method on SuperGridSizer with immediate _rebuildGridTemplate
  - applyWidths 6-param signature forwarding rowHeaderLevelWidth to buildGridTemplateColumns
  - Drag resize handle on deepest-level row headers (40-300px clamped)
  - Row header width persistence via ui_state 'supergrid:row-header-width'
  - Row header ellipsis overflow with native title tooltip
  - 12 seam tests for SGFX-02
affects: [supergrid, workbench, catalog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pointer Events setPointerCapture pattern for row header resize (mirrors col resize in SuperGridSizer)"
    - "position:sticky preserved on row headers — resize handle uses absolute positioning inside sticky (not relative override)"
    - "Fire-and-forget async IIFE in sync mount() for best-effort persistence restore"
    - "Dynamic field pattern: constant becomes default initializer, instance field carries runtime value"

key-files:
  created:
    - tests/seams/ui/supergrid-row-header-resize.test.ts
  modified:
    - src/views/SuperGrid.ts
    - src/views/supergrid/SuperGridSizer.ts
    - src/styles/supergrid.css

key-decisions:
  - "position:sticky preserved on deepest-level row header elements — resize handle uses position:absolute inside sticky (NOT position:relative override) to avoid breaking sticky behavior"
  - "Row header width clamped 40-300px at resize time and at persistence restore"
  - "Persistence restore wrapped in async IIFE before _fetchAndRender() — best-effort (catch swallowed), default width used on error"
  - "setRowHeaderLevelWidth() calls _rebuildGridTemplate() immediately — live update during drag without waiting for _renderCells"

requirements-completed: [SGFX-02]

# Metrics
duration: 9min
completed: 2026-03-18
---

# Phase 89 Plan 01: SuperGrid Row Header Resize Summary

**Drag-resizable row headers with ellipsis overflow, native tooltip, and ui_state persistence — width clamped 40-300px, synced via `supergrid:row-header-width` key**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-18T13:42:56Z
- **Completed:** 2026-03-18T13:51:31Z
- **Tasks:** 1 (TDD: red + green)
- **Files modified:** 4

## Accomplishments
- Row headers now show ellipsis overflow when axis values are too long, with full text in native OS tooltip via `title` attribute
- Drag resize handle on deepest-level row headers; live resize updates all row headers uniformly via pointer events with setPointerCapture
- Width clamped between 40px and 300px; persists to ui_state and restores on next mount
- SuperGridSizer.applyWidths gains 6th parameter; _rebuildGridTemplate uses stored _rowHeaderLevelWidth for live drag consistency
- 12 new seam tests covering clamping logic, applyWidths forwarding, and setRowHeaderLevelWidth behavior

## Task Commits

1. **Task 1: Row header resize — SuperGrid dynamic width + SuperGridSizer signature + CSS + tests** - `971b3b4f` (feat)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Dynamic _rowHeaderWidth field, resize handle wiring, _persistRowHeaderWidth, _updateRowHeaderStickyOffsets, persistence restore in mount()
- `src/views/supergrid/SuperGridSizer.ts` - _rowHeaderLevelWidth field, setRowHeaderLevelWidth() method, applyWidths 6th param, _rebuildGridTemplate uses stored width
- `src/styles/supergrid.css` - Row header min-width:0/overflow:hidden/text-overflow:ellipsis, .row-header-resize-handle absolute position with col-resize cursor
- `tests/seams/ui/supergrid-row-header-resize.test.ts` - 12 SGFX-02 seam tests (clamping, applyWidths forwarding, setRowHeaderLevelWidth)

## Decisions Made
- **position:sticky preserved**: Deepest-level row header elements keep `position: sticky` (for scrolling behavior). The resize handle uses `position: absolute` inside the sticky element. An earlier attempt overrode sticky with `position: relative` which broke POSN-02 test — reverted.
- **Async IIFE for persistence restore**: mount() is synchronous but ui:get is async. Used a fire-and-forget async IIFE to restore width before first _fetchAndRender(), with catch swallowing errors so a slow/failing bridge doesn't block mount.
- **setRowHeaderLevelWidth triggers _rebuildGridTemplate**: The method immediately rebuilds grid-template-columns so the live drag feedback loop doesn't need a full _renderCells() cycle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed position:relative override on sticky row headers**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan spec said to set `el.style.position = 'relative'` on deepest-level headers for the resize handle. This overrode the existing `position: sticky` and broke POSN-02 test ("row headers have position:sticky after render").
- **Fix:** Removed the `el.style.position = 'relative'` assignment. The resize handle uses `position: absolute` which works correctly inside `position: sticky`.
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** POSN-02 test passes; resize handle renders correctly
- **Committed in:** 971b3b4f (Task 1 commit)

**2. [Rule 1 - Bug] Fixed corrupted template literal in _updateRowHeaderStickyOffsets**
- **Found during:** Task 1 (Python string substitution)
- **Issue:** Python replacement script for backtick template literal produced `el.style.left = ;` (missing the template expression) due to shell substitution collision.
- **Fix:** Second targeted Python replacement to restore the correct `\`${levelIdx * this._rowHeaderWidth + gutterOffset}px\`` expression.
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** SuperGrid.test.ts passes; no parse errors
- **Committed in:** 971b3b4f (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bugs)
**Impact on plan:** Both fixes essential for correctness. No scope creep.

## Issues Encountered
None beyond the two auto-fixed bugs above.

## Next Phase Readiness
- Row header resize (SGFX-02) complete
- Plans 02 and 03 can proceed independently (they address different SGFX requirements)

---
*Phase: 89-supergrid-fixes*
*Completed: 2026-03-18*
