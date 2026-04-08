---
phase: 140-transform-pipeline-wiring
plan: "01"
subsystem: PivotGrid / PluginRegistry
tags: [plugin-pipeline, refactor, transform, cell-placement, render]
dependency_graph:
  requires: []
  provides: [transform-pipeline-wired, cells-in-render-context]
  affects: [PivotGrid, PluginTypes, all-plugin-tests]
tech_stack:
  added: []
  patterns: [pipeline-transform, flat-cell-array, layout-pass-through]
key_files:
  created: []
  modified:
    - src/views/pivot/PivotGrid.ts
    - src/views/pivot/plugins/PluginTypes.ts
    - tests/views/pivot/helpers/makePluginHarness.ts
    - tests/views/pivot/CrossPluginBehavioral.test.ts
    - tests/views/pivot/PluginRegistry.test.ts
    - tests/views/pivot/SuperAudit.test.ts
    - tests/views/pivot/SuperDensity.test.ts
    - tests/views/pivot/SuperSearch.test.ts
    - tests/views/pivot/SuperSelect.test.ts
    - tests/views/pivot/SuperSize.test.ts
    - tests/views/pivot/SuperSort.test.ts
    - tests/views/pivot/SuperStackAggregate.test.ts
    - tests/views/pivot/SuperStackCatalog.test.ts
    - tests/views/pivot/SuperStackCollapse.test.ts
    - tests/views/pivot/SuperStackSpans.test.ts
    - tests/views/pivot/SuperZoom.test.ts
decisions:
  - "Kept _headerWidth/_headerHeight/_cellWidth/_cellHeight as default/initial values for initial layout construction; layout.* used by render layers"
  - "cells: [] passed in scroll/pointerdown handlers since those contexts do not need real cell data"
metrics:
  duration_seconds: 530
  completed_date: "2026-04-08"
  tasks_completed: 2
  files_changed: 16
---

# Phase 140 Plan 01: Transform Pipeline Wiring Summary

**One-liner:** Wired runTransformData + runTransformLayout into PivotGrid.render() with flat CellPlacement[] pipeline and layout passthrough to both rendering layers.

## What Was Built

Plugin pipeline hooks were dead code paths before this plan. PivotGrid built cells inline inside `_renderTable` and used `this._cellWidth/cellHeight` directly for layout — bypassing the PluginRegistry entirely.

After this plan:
- `render()` builds a flat `CellPlacement[]` before any render layer
- An initial `GridLayout` is constructed from instance defaults
- `runTransformData(cells, ctx)` and `runTransformLayout(layout, ctx)` are called on the registry (when present)
- Transformed cells are grouped by `rowIdx` into a `Map<number, CellPlacement[]>` for `_renderTable` lookup
- `_renderTable` and `_renderOverlay` both receive `layout: GridLayout` and use `layout.*` for all sizing/positioning
- The `afterRender` ctx now includes `cells: transformedCells` and `layout: transformedLayout`
- `RenderContext.cells: CellPlacement[]` added as required field

## Tasks Completed

### Task 1: Unify CellPlacement, add cells to RenderContext, wire transform pipeline

**Commit:** bf7cbb36

Changes:
- Deleted private `interface CellPlacement` from `PivotGrid.ts` (lines 47-52)
- Added `CellPlacement` to the `PluginTypes` import in `PivotGrid.ts`
- Added `cells: CellPlacement[]` field to `RenderContext` in `PluginTypes.ts`
- Refactored `render()` to build flat cells + layout before `calculateSpans`
- Added transform pipeline block (runTransformData + runTransformLayout)
- Grouped transformed cells into `cellsByRow` Map
- Updated `_renderTable` signature: `data` replaced by `cellsByRow + layout`
- Updated `_renderTable` to use `layout.*` for all sizing, use `cellsByRow.get(rowIdx)` for cell data
- Updated `_renderOverlay` signature: added `layout: GridLayout`
- Updated `_renderOverlay` to use `layout.*` for all positioning
- Added `cells: []` to overlay pointerdown and scroll handler contexts
- Updated 14 test files: added `cells: []` to all `makeCtx`/`makeMinCtx`/inline ctx objects

### Task 2: Verify full test suite pass

All 1138 pivot/plugin unit tests pass. TypeScript compiles clean. Pre-existing E2E/bench/etl-validation failures are unrelated to these changes (require browser/server/filesystem fixtures).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All pipeline hooks are fully wired through to both rendering layers.

## Verification

```
grep -n 'interface CellPlacement' src/views/pivot/PivotGrid.ts  → (empty — deleted)
grep -n 'import.*CellPlacement.*PluginTypes' src/views/pivot/PivotGrid.ts → line 22: import type { CellPlacement, GridLayout, RenderContext }
grep -n 'runTransformData' src/views/pivot/PivotGrid.ts → line 258: transformedCells = this._registry.runTransformData(cells, ctx)
grep -n 'runTransformLayout' src/views/pivot/PivotGrid.ts → line 259: transformedLayout = this._registry.runTransformLayout(layout, ctx)
grep -n 'cells: CellPlacement' src/views/pivot/plugins/PluginTypes.ts → line 79: cells: CellPlacement[]
npx tsc --noEmit → exit 0
npx vitest run tests/views/pivot/ → 1138 passed
```

## Self-Check: PASSED
