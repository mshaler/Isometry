---
phase: 99-superstack-plugin
plan: 01
subsystem: pivot-plugins
tags: [plugin-registry, superstack, spanning, tdd, pivot-grid]
dependency_graph:
  requires: [98-01]
  provides: [superstack.spanning plugin, plugin-grid bridge]
  affects: [PivotGrid, PivotTable, HarnessShell, FeatureCatalog, PluginRegistry]
tech_stack:
  added: []
  patterns: [plugin-hook afterRender, registry constructor injection, TDD red-green-refactor]
key_files:
  created:
    - src/views/pivot/plugins/SuperStackSpans.ts
    - tests/views/pivot/SuperStackSpans.test.ts
  modified:
    - src/views/pivot/plugins/PluginRegistry.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/PivotTable.ts
    - src/views/pivot/PivotGrid.ts
    - src/views/pivot/harness/HarnessShell.ts
    - src/styles/pivot.css
decisions:
  - "Plugin-grid bridge: PivotGrid.setRegistry() + runAfterRender() call after overlay render; one integration, all future plugins benefit"
  - "SuperStackSpans afterRender removes .pv-col-span/.pv-row-span then re-renders with N-level buildHeaderCells algorithm"
  - "RenderContext extended with layout: GridLayout in afterRender call — SuperStackSpans reads sizing from ctx.layout"
  - "FeatureCatalog.registerCatalog() replaces superstack.spanning noop immediately after loop via registry.setFactory()"
  - "HarnessShell.onChange triggers pivotTable.rerender() in addition to persistState() for live toggle updates"
metrics:
  duration_seconds: 25
  tasks_completed: 1
  tasks_total: 1
  files_created: 2
  files_modified: 6
  tests_added: 13
  completed_date: "2026-03-21"
---

# Phase 99 Plan 01: Plugin-Grid Bridge + SuperStack Spanning Plugin Summary

Port SuperStackHeader.buildHeaderCells() into a new pivot plugin module and wire the PluginRegistry pipeline into PivotGrid/PivotTable so enabling `superstack.spanning` in the harness sidebar immediately replaces default PivotSpans headers with N-level run-length spanning cells in the overlay.

## What Was Built

### SuperStackSpans.ts — New Plugin Module

Ported the proven `buildHeaderCells()` algorithm from `src/views/supergrid/SuperStackHeader.ts` (Phase 7) into a new self-contained pivot plugin module. Key adaptations:

- Input: `string[][]` axis value tuples (from visibleRows/visibleCols in RenderContext)
- Output: `HeaderCell[][]` with absolute positioning data (colStart, colSpan, level, parentPath, isCollapsed)
- `applyCardinalityGuard()` truncates to 50 leaf columns, replacing excess with a single "Other" bucket
- `createSuperStackSpansPlugin()` returns a PluginHook whose `afterRender` hook:
  1. Removes existing `.pv-col-span` and `.pv-row-span` elements from the overlay
  2. Calls `buildHeaderCells()` on visibleCols (column headers) and visibleRows (row headers)
  3. Renders each HeaderCell as an absolutely-positioned `<div>` with correct CSS classes and scroll transform
  4. Adds chevron (`▼`/`▶`) + count suffix for non-leaf (collapsible) cells — Plan 02 will add click handlers
- Collapse support: passes empty `Set<string>()` for this plan; Plan 02's superstack.collapse plugin will inject a shared collapsedSet

### Plugin-Grid Bridge (one-time integration)

All future plugins benefit from the same wiring:

- `PivotGrid.setRegistry(registry)` — stores registry reference
- `PivotGrid.getOverlayEl()` — exposes overlay element for plugins
- After `_renderOverlay()` completes, PivotGrid builds a `RenderContext & { layout: GridLayout }` and calls `registry.runAfterRender(overlayEl, ctx)`
- `_handleScroll()` calls `registry.runOnScroll(scrollLeft, scrollTop, ctx)` for scroll-aware plugins
- Layout sizing (headerWidth, headerHeight, cellWidth, cellHeight) is passed via `ctx.layout` — SuperStackSpans reads sizing from this to position headers correctly

### PivotTable Updates

- `PivotTableOptions.registry?: PluginRegistry` — optional constructor injection
- `PivotTable.rerender()` public method — enables HarnessShell to trigger re-render on toggle changes
- Constructor calls `this._grid.setRegistry(registry)` if registry provided

### FeatureCatalog Update

`registerCatalog()` now calls `registry.setFactory('superstack.spanning', createSuperStackSpansPlugin)` after the noop loop — the plugin is immediately wired for all future HarnessShell instances.

### PluginRegistry.setFactory()

New method that replaces a factory for an already-registered plugin. If the plugin is currently enabled, destroys the old instance and creates a new one from the new factory.

### HarnessShell Update

- Passes `{ registry: this._registry }` to PivotTable constructor
- `onChange` callback now also calls `this._pivotTable.rerender()` — enabling/disabling a plugin immediately updates the grid

### CSS Classes Added

Added to `src/styles/pivot.css`:
- `.pv-col-span--collapsible` — cursor: pointer, hover tint
- `.pv-col-span--collapsed` — placeholder for Plan 02 visual state
- `.pv-row-span--collapsible` — cursor: pointer, hover tint
- `.pv-row-span--collapsed` — placeholder for Plan 02 visual state
- `.pv-agg-cell` — accent-light background + 3px accent left border for aggregated cells
- `.pv-span-chevron` — muted-fg color, accent on parent hover
- `.pv-span-count` — 0.6875rem, muted-fg color for "(n)" count suffix

## Tests Added (13 new)

All tests in `tests/views/pivot/SuperStackSpans.test.ts`:

1. `buildHeaderCells` 2-level: parent spans merge consecutive children correctly
2. `buildHeaderCells` cardinality guard: 60 columns → 50 with "Other" bucket
3. `buildHeaderCells` single-level: no merging, 1:1 spans
4. `buildHeaderCells` empty input: returns `{ headers: [], leafCount: 0 }`
5. `buildHeaderCells` 3-level: merges at all levels respecting parent-boundary
6. `createSuperStackSpansPlugin()` returns PluginHook with `afterRender` function
7. `afterRender` clears old headers and re-renders with algorithm output
8. `afterRender` with empty dimensions does not throw
9. `PivotTable` accepts optional registry in constructor
10. `PivotTable` works without registry (backwards compatibility)
11. `PivotTable` exposes `rerender()` method
12. `PluginRegistry.setFactory()` replaces factory and new factory runs in pipeline
13. `PluginRegistry.setFactory()` on unknown id is a no-op

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes on Plan Deviations

**Action G wording vs implementation:** The plan suggests `setFactory` calls `entry.instance.destroy?.(); entry.instance = factory()` when plugin is enabled. Implemented exactly as described — the currently enabled instance is torn down and a fresh one is created from the new factory.

**FeatureCatalog approach:** The plan offers three options (overwrite loop, `registerImplementedPlugins()`, or `setFactory`). Went with `setFactory` called inside `registerCatalog()` directly — simplest, no extra function needed.

**RenderContext layout extension:** Plan says "extend RenderContext or pass via plugin instance closure". Used type intersection `RenderContext & { layout: GridLayout }` passed directly in the afterRender ctx — cleanest pattern, no closure needed.

## Self-Check: PASSED

- [x] `src/views/pivot/plugins/SuperStackSpans.ts` exists, exports `createSuperStackSpansPlugin` and `MAX_LEAF_COLUMNS`
- [x] `tests/views/pivot/SuperStackSpans.test.ts` exists with 13 test cases
- [x] `src/views/pivot/PivotTable.ts` contains `registry` in `PivotTableOptions` and `rerender()` method
- [x] `src/views/pivot/PivotGrid.ts` contains `setRegistry` and `runAfterRender` call
- [x] `src/views/pivot/harness/HarnessShell.ts` passes `registry` to PivotTable constructor
- [x] `src/views/pivot/plugins/PluginRegistry.ts` contains `setFactory` method
- [x] `src/styles/pivot.css` contains `.pv-col-span--collapsible`, `.pv-agg-cell`, `.pv-span-chevron`, `.pv-span-count`
- [x] `npx vitest run tests/views/pivot/SuperStackSpans.test.ts` exits 0 (13/13 pass)
- [x] `npx vitest run tests/views/pivot/PluginRegistry.test.ts` exits 0 (no regressions)
- [x] All 67 pivot tests pass
- [x] Commit 23928b27 exists
