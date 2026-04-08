---
phase: 141-layer-event-bridge
plan: "01"
subsystem: pivot
tags: [event-bridge, plugin-pipeline, data-attributes, pointer-events, css]
dependency_graph:
  requires: []
  provides: [EVNT-01, EVNT-02, EVNT-03]
  affects: [SuperSelectClick, SuperAuditOverlay, PluginRegistry.runOnPointerEvent, PluginRegistry.runAfterRender]
tech_stack:
  added: []
  patterns: [D3 attr chain for data attributes, event delegation on scroll container, TDD red-green]
key_files:
  created:
    - tests/views/pivot/PivotGrid.render.test.ts
  modified:
    - src/views/pivot/PivotGrid.ts
    - src/styles/pivot.css
decisions:
  - Data attributes added to D3 enter+merge chain on .pv-data-cell (data-key, data-row, data-col)
  - Pointer bridge on scroll container (not overlay) so event target is a real data cell with attributes
  - afterRender rootEl changed to _scrollContainer so plugins can querySelectorAll('.pv-data-cell')
  - Three private cache fields added to expose last render state to pointer handler
metrics:
  duration: ~10 minutes
  completed: 2026-04-07
  tasks_completed: 2
  files_changed: 3
---

# Phase 141 Plan 01: Layer Event Bridge Summary

Wire Layer 1 data cells to the plugin pipeline: data-key/data-row/data-col attrs on cells via D3 enter+merge, pointerdown event delegation from scroll container to PluginRegistry with real RenderContext, and afterRender rootEl switched from overlay to scroll container so SuperSelect/SuperAudit can query .pv-data-cell elements.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Data attributes, pointer event bridge, afterRender rootEl fix, user-select CSS | 035c03bd | src/views/pivot/PivotGrid.ts, src/styles/pivot.css |
| 2 | Integration tests for data attributes, pointer bridge, and afterRender rootEl | a7c9a2c7 | tests/views/pivot/PivotGrid.render.test.ts |

## What Was Built

**EVNT-01 — Data attributes on cells:**
In `PivotGrid._renderTable()`, the D3 enter+merge chain for `.pv-data-cell` now sets `data-key`, `data-row`, and `data-col` attributes from `CellPlacement.key`, `.rowIdx`, and `.colIdx`. SuperSelectClick and SuperAuditOverlay already read these attributes — they were simply never set before this plan.

**EVNT-02 — Pointer event bridge:**
A `pointerdown` listener is added to `_scrollContainer` in `mount()`. The handler builds a full `RenderContext` from cached render state (`_lastVisibleRows`, `_lastVisibleCols`, `_lastTransformedCells`) and calls `PluginRegistry.runOnPointerEvent('pointerdown', e, ctx)`. Three new private fields (`_lastVisibleRows`, `_lastVisibleCols`, `_lastTransformedCells`) are populated at the end of the transform pipeline in `render()`. The overlay `pointerdown` listener is left intact for header/resize interactions.

**EVNT-03a — afterRender rootEl fix:**
`runAfterRender(this._scrollContainer!, ctx)` replaces `runAfterRender(this._overlayEl, ctx)`. The `.pv-toolbar` creation block continues to target `_overlayEl` for toolbar mounting — only the rootEl passed to plugins changes.

**EVNT-03b — user-select: none:**
`user-select: none` added to the `.pv-data-cell` rule in `src/styles/pivot.css` to prevent browser text selection during drag operations.

## Verification

```
grep -n "data-key" src/views/pivot/PivotGrid.ts      → line 472: .attr('data-key', (d) => d.key)
grep -n "pointerdown" src/views/pivot/PivotGrid.ts   → scroll container listener at line 110
grep -n "runAfterRender" src/views/pivot/PivotGrid.ts → _scrollContainer! at line 354
grep -n "user-select" src/styles/pivot.css            → user-select: none at line 338
npx tsc --noEmit                                       → 0 errors
npx vitest run tests/views/pivot/PivotGrid.render.test.ts → 11/11 pass
npx vitest run tests/views/pivot/               → 1149/1149 pass (no regressions)
```

## Deviations from Plan

None — plan executed exactly as written. TypeScript strict mode required non-null assertions (`!`) on `mock.calls[0]` in two test lines; fixed immediately (Rule 1 — bug fix in test code).

## Known Stubs

None.

## Self-Check: PASSED
