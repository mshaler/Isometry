---
phase: 20-supersize
plan: "02"
subsystem: supergrid
tags: [supergrid, column-resize, pointer-events, tdd, SIZE-01, SIZE-02, SIZE-03, SIZE-04]
dependency_graph:
  requires: [20-01-buildGridTemplateColumns-refactor]
  provides: [SuperGridSizer, column-resize-handles, auto-fit, shift-drag-normalize, colWidths-persistence]
  affects: [SuperGrid, SuperGridSizer]
tech_stack:
  added: []
  patterns:
    - SuperGridSizer lifecycle mirrors SuperZoom (attach/detach, no DOM events on class itself)
    - Pointer Events setPointerCapture for drag tracking (finger-lift safe, no document-level mousemove)
    - CSS.escape fallback pattern for jsdom/test environments (typeof CSS !== 'undefined' guard)
    - data-col-key attribute on data cells enables auto-fit content measurement
    - onWidthsChange callback decouples persistence from interaction (called only on pointerup)
    - _sizer created in constructor (not mount) to enable persistence load before first render
key_files:
  created:
    - src/views/supergrid/SuperGridSizer.ts
    - tests/views/supergrid/SuperGridSizer.test.ts
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts
decisions:
  - CSS.escape has no fallback in jsdom — used typeof guard with manual regex escape as fallback
  - _sizer initialized in constructor (not mount) so persisted widths load before first render
  - onZoomChange callback in SuperGrid wires _sizer.applyWidths() after SuperZoom.applyZoom() — zoom still sets --sg-row-height/--sg-zoom, sizer rebuilds grid-template-columns with new zoom
  - pointermove/pointerup/pointercancel always-listening pattern (vs add-in-pointerdown) — simpler code, dragging state guards handle the no-op case
  - addHandleToHeader called once per leaf header per _renderCells() call — handles accumulate on re-renders (new div appended each time); acceptable for current use since _renderCells clears grid DOM first
metrics:
  duration: "7 min"
  completed: "2026-03-04"
  tasks: 2
  files: 4
requirements_satisfied: [SIZE-01, SIZE-02, SIZE-03, SIZE-04]
---

# Phase 20 Plan 02: SuperGridSizer — Column Resize Handler Summary

SuperGridSizer Pointer Events column resize: drag right edge of leaf header to resize, double-click to auto-fit content, Shift+drag to normalize all columns, widths persist via PAFVProvider.setColWidths() and restore on mount.

## What Was Built

### SuperGridSizer (src/views/supergrid/SuperGridSizer.ts)

New class following the SuperZoom lifecycle pattern (attach/detach):

**Constants:**
- `MIN_COL_WIDTH = 48` — minimum column width in base px
- `AUTO_FIT_PADDING = 24` — breathing room added to measured content
- `AUTO_FIT_MAX = 400` — maximum auto-fit base width

**Lifecycle:**
- `attach(gridEl)` — stores grid element reference for style updates
- `detach()` — nulls element refs, clears drag state

**State management:**
- `getColWidths()` / `setColWidths(map)` — defensive copies, base px values (pre-zoom)
- `resetColWidths()` — clears all widths
- `setLeafColKeys(keys)` / `getLeafColKeys()` — tracks current visible leaf columns for Shift+drag

**`addHandleToHeader(headerEl, colKey)`:**
- Appends 8px `div.col-resize-handle` (position:absolute, right:0) to leaf header
- Sets `headerEl.style.position = 'relative'` if not already positioned
- Wires Pointer Events:
  - `pointerdown`: left click only, `setPointerCapture`, `stopPropagation`, stores drag state
  - `pointermove`: `dx / zoomLevel` base width calc, clamped to MIN_COL_WIDTH; Shift+drag normalizes all `_leafColKeys`
  - `pointerup`: `releasePointerCapture`, fires `onWidthsChange(widths)` callback
  - `pointercancel`: reverts to `startWidth`, does NOT fire `onWidthsChange`
  - `dblclick`: measures `max(label.scrollWidth, data cells scrollWidth)` + AUTO_FIT_PADDING, divides by zoom, fires `onWidthsChange`

**`applyWidths(leafColKeys, zoomLevel, gridEl, rowHeaderWidth?)`:**
- Calls `buildGridTemplateColumns` and sets `gridEl.style.gridTemplateColumns`
- Used by SuperGrid's onZoomChange callback to rebuild grid layout after zoom

### SuperGrid Wiring (src/views/SuperGrid.ts)

**Constructor additions:**
- Creates `_sizer: SuperGridSizer` with `getZoomLevel` and `onWidthsChange` callbacks
- `onWidthsChange` converts Map to `Record<string, number>` and calls `provider.setColWidths()`
- Loads persisted widths from `provider.getColWidths()` immediately after construction

**mount():**
- `_sizer.attach(grid)` called before first render

**destroy():**
- `_sizer.detach()` called for cleanup

**onZoomChange callback (SuperZoom):**
- After `_showZoomToast()`, calls `_sizer.applyWidths()` to rebuild grid-template-columns with new zoom

**_renderCells():**
- `_sizer.setLeafColKeys(leafColKeys)` — updates leaf key tracking after each render
- `buildGridTemplateColumns(leafColKeys, _sizer.getColWidths(), ...)` — uses sizer's widths
- `_sizer.addHandleToHeader(el, cell.value)` — adds handles to leaf-level headers only
- `el.dataset['colKey'] = d.colKey` — enables dblclick auto-fit to query cells by column

### Test Coverage (146 tests passing)

**SuperGridSizer.test.ts** — 45 new tests:
- Constants, state management (getColWidths/setColWidths/reset/defensive copies)
- attach/detach lifecycle
- Handle DOM structure (cursor, position, width, headerEl.position:relative)
- Drag sequence (pointerdown/pointermove/pointerup): button guard, capture, dx/zoom, clamping, 2x zoom
- Shift+drag bulk normalize: sets all leafColKeys, populates missing keys
- pointercancel revert: restores startWidth, no onWidthsChange
- dblclick auto-fit: scrollWidth measurement, AUTO_FIT_PADDING, AUTO_FIT_MAX clamping, 2x zoom, data cell measurement
- applyWidths: gridTemplateColumns output, zoom scaling, empty keys, rowHeaderWidth override

**SuperGrid.test.ts** — 8 new SIZE tests:
- SIZE-01: resize handles on leaf column headers; drag does not trigger bridge.superGridQuery()
- SIZE-04: drag calls provider.setColWidths(); initial widths loaded from provider.getColWidths(); data-col-key on data cells
- _sizer lifecycle: attach in mount, detach in destroy

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CSS.escape not available in jsdom test environment**

- **Found during:** Task 1 GREEN phase — `TypeError: Cannot read properties of undefined (reading 'escape')` in dblclick handler tests
- **Issue:** `CSS.escape()` is a browser API not polyfilled by jsdom
- **Fix:** Added `typeof CSS !== 'undefined' && CSS.escape` guard with manual regex fallback: `.replace(/([^\w-])/g, '\\$1')`
- **Files modified:** `src/views/supergrid/SuperGridSizer.ts`
- **Commit:** included in 6fcdb534

### Pre-existing Failures (Out of Scope)

`tests/worker/supergrid.handler.test.ts` — 5 pre-existing failures (`db.prepare is not a function`). Confirmed pre-existing by stash-reverting to baseline. Not caused by this plan's changes.

## TDD Cycle

### Task 1 (SuperGridSizer):
1. **RED** — wrote 45 SuperGridSizer tests (commit: 17f3872d). Module doesn't exist → all fail.
2. **GREEN** — created SuperGridSizer.ts with full Pointer Events implementation. 40 tests pass, 5 fail on CSS.escape (Rule 1 auto-fix applied). (commit: 6fcdb534)
3. **REFACTOR** — none needed.

### Task 2 (SuperGrid wiring):
1. **RED** — added 8 SIZE tests to SuperGrid.test.ts (commit: 8185e060). 5 fail (handles not wired), 3 pass (provider.getColWidths already called).
2. **GREEN** — wired SuperGridSizer into SuperGrid constructor, mount, destroy, onZoomChange, _renderCells. All 146 tests pass. (commit: cad7dd0b)
3. **REFACTOR** — none needed.

## Self-Check: PASSED

Files exist:
- `src/views/supergrid/SuperGridSizer.ts`: FOUND (full implementation with Pointer Events)
- `tests/views/supergrid/SuperGridSizer.test.ts`: FOUND (45 tests)
- `src/views/SuperGrid.ts`: FOUND (_sizer integration, data-col-key attributes)
- `tests/views/SuperGrid.test.ts`: FOUND (8 new SIZE tests)

Commits exist:
- 17f3872d: test(20-02) — TDD RED SuperGridSizer tests
- 6fcdb534: feat(20-02) — SuperGridSizer implementation
- 8185e060: test(20-02) — TDD RED SuperGrid SIZE integration tests
- cad7dd0b: feat(20-02) — SuperGrid SuperGridSizer wiring
