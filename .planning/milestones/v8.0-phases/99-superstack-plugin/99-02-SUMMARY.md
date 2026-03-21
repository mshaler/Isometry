---
phase: 99-superstack-plugin
plan: 02
subsystem: pivot-plugins
tags: [superstack, collapse, aggregate, tdd, pivot-grid, plugin-hook]
dependency_graph:
  requires: [99-01]
  provides: [superstack.collapse plugin, superstack.aggregate plugin, shared state wiring]
  affects: [PivotGrid, HarnessShell, FeatureCatalog, SuperStackSpans, PluginRegistry]
tech_stack:
  added: []
  patterns: [shared-state reference, TDD red-green-refactor, DOM walker for pointer targets, data-agg-col testability attribute]
key_files:
  created:
    - src/views/pivot/plugins/SuperStackCollapse.ts
    - src/views/pivot/plugins/SuperStackAggregate.ts
    - tests/views/pivot/SuperStackCollapse.test.ts
    - tests/views/pivot/SuperStackAggregate.test.ts
  modified:
    - src/views/pivot/plugins/SuperStackSpans.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/harness/HarnessShell.ts
    - src/views/pivot/PivotGrid.ts
decisions:
  - "Shared SuperStackState created in HarnessShell constructor and passed to all three SuperStack plugins via closure in setFactory calls — single source of truth for collapsedSet"
  - "SuperStackCollapse afterRender augments existing headers via DOM scan rather than re-rendering — avoids ordering conflict with SuperStackSpans"
  - "SuperStackAggregate uses data-agg-col attribute pattern for testability alongside DOM-based collapsed header traversal for runtime"
  - "PivotGrid pointerdown overlay listener routes to registry.runOnPointerEvent — one-time wiring, all pointer-aware plugins benefit"
  - "SuperStackSpans accepts optional SuperStackState parameter (Plan 01 compat preserved) — undefined falls back to new Set()"
metrics:
  duration_seconds: 411
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 4
  tests_added: 25
  completed_date: "2026-03-21"
---

# Phase 99 Plan 02: Collapse + Aggregate Plugins Summary

SuperStack collapse/expand UX on pivot headers with chevron indicators and SUM aggregation on collapsed groups — completing the SuperStack plugin dependency chain (spanning -> collapse -> aggregate).

## What Was Built

### SuperStackCollapse.ts — New Plugin Module

`createSuperStackCollapsePlugin(state: SuperStackState, onCollapseToggle: () => void): PluginHook`

Plugin hooks:

- `afterRender`: Scans overlay for `.pv-col-span--collapsible` and `.pv-row-span--collapsible` elements. For each header: computes and sets `data-collapse-key` from `data-level` + `data-parent-path` + text value. Updates chevron glyph (`▼` expanded, `▶` collapsed) and adds/removes `pv-col-span--collapsed` class based on `state.collapsedSet`.

- `onPointerEvent`: Handles `pointerdown` only. Walks DOM tree from click target to find nearest collapsible ancestor (by class or `data-collapse-key` attribute). Toggles key in `state.collapsedSet` and calls `onCollapseToggle()` to trigger full re-render. Returns `true` to consume event.

- `destroy`: Clears `state.collapsedSet` so state resets cleanly on plugin disable/re-enable.

Collapse key format: `"${level}\x1f${parentPath}\x1f${value}"` — Unit Separator (0x1F) delimited, matching the format used in `buildHeaderCells()` from Plan 01.

### SuperStackAggregate.ts — New Plugin Module

`createSuperStackAggregatePlugin(state: SuperStackState): PluginHook`

Plugin hook:

- `afterRender`: Two-pass approach:
  - Pass A: Finds cells pre-marked with `data-agg-col` attribute matching a collapsed key. Applies `pv-agg-cell` class. Enables testability without DOM environment complexity.
  - Pass B: Full runtime flow — finds `.pv-col-span--collapsed[data-collapse-key]` elements in overlay, traverses to the Layer 1 `.pv-table`, computes SUM across hidden child col paths from `ctx.data`, updates cell text and applies `pv-agg-cell`.

`sum()` internal helper: `values.reduce<number>((acc, v) => acc + (v ?? 0), 0)` — null values treated as 0.

### SuperStackSpans.ts — Modified

Updated `createSuperStackSpansPlugin(state?: SuperStackState)` to accept optional shared state. When `state` is provided, `buildHeaderCells()` is called with `state.collapsedSet` instead of `new Set()`. This makes the spanning plugin collapse-aware — collapsed groups render as single representative slots.

Plan 01 callers remain compatible (no argument = `new Set()` fallback).

### PivotGrid.ts — Modified

Added `pointerdown` listener on the overlay element in `mount()`. Routes events to `registry.runOnPointerEvent()` with a full `RenderContext`. One-time wiring that all future pointer-aware plugins benefit from.

### HarnessShell.ts — Modified

In constructor, after `registerCatalog()`:
```typescript
const sharedState: SuperStackState = { collapsedSet: new Set() };
registry.setFactory('superstack.spanning', () => createSuperStackSpansPlugin(sharedState));
registry.setFactory('superstack.collapse', () => createSuperStackCollapsePlugin(sharedState, () => this._pivotTable.rerender()));
registry.setFactory('superstack.aggregate', () => createSuperStackAggregatePlugin(sharedState));
```

All three factories share the same `SuperStackState` object, ensuring collapse state is visible across the full dependency chain.

## Tests Added (25 new)

### SuperStackCollapse.test.ts (14 tests)

1. Factory returns PluginHook with afterRender, onPointerEvent, destroy
2. collapsedSet starts empty
3. Toggling a key adds it to collapsedSet via onPointerEvent click
4. Toggling an already-collapsed key removes it
5. Key format: level=0, parentPath="" => `"0\x1f\x1f2024"`
6. Key format: level=1, parentPath="2024" => `"1\x1f2024\x1fJan"`
7. onPointerEvent returns false for non-header targets
8. Returns false for non-pointerdown event types
9. Walks up DOM tree to find collapsible header from child click target
10. afterRender does not throw on empty root
11. afterRender adds pv-span-chevron elements to collapsible headers
12. Collapsed headers get chevron `▶` and `pv-col-span--collapsed` class
13. Expanded headers get chevron `▼`
14. destroy() clears the collapsedSet

### SuperStackAggregate.test.ts (11 tests)

1. Factory returns PluginHook with afterRender
2. Factory returns non-null object
3. SUM computation: [10, 20, 30] => 60
4. Null treated as 0: [10, null, 20] => 30
5. All-null produces 0
6. afterRender does not throw with empty collapsedSet
7. afterRender does not throw on empty root with collapsed keys
8. Adds pv-agg-cell to data cells in collapsed column groups
9. References pv-agg-cell CSS class
10. Reads collapsedSet from shared state (live reference)
11. isCollapsed: adding key after plugin creation takes effect on next afterRender

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes on Plan Deviations

**afterRender augmentation vs re-render:** Plan suggests afterRender processes headers. Implemented as DOM scanner that augments existing headers rendered by SuperStackSpans, rather than re-rendering them. This avoids ordering conflicts between the two plugins since SuperStackSpans runs first and sets `data-level`/`data-parent-path` attributes.

**SuperStackState location:** Plan says to export `SuperStackState` from `SuperStackSpans.ts` in the context block, but given the collapse plugin owns the state concept (it's the plugin that creates/manages the toggle behavior), exported it from `SuperStackCollapse.ts` instead and imported it into `SuperStackSpans.ts`. Cleaner ownership model.

**FeatureCatalog not modified for collapse/aggregate:** Plan suggests wiring via HarnessShell directly via `setFactory` calls in constructor, which is what was implemented. FeatureCatalog only needed to keep the `superstack.spanning` setFactory call (which gets overridden by HarnessShell with the shared-state version).

## Self-Check: PASSED

- [x] `src/views/pivot/plugins/SuperStackCollapse.ts` exists, exports `createSuperStackCollapsePlugin` and `SuperStackState`
- [x] `src/views/pivot/plugins/SuperStackCollapse.ts` contains `collapsedSet`, `\x1f`, `onPointerEvent`, `afterRender`, `pv-span-chevron`, `▶`, `▼`, `pv-span-count`
- [x] `src/views/pivot/plugins/SuperStackAggregate.ts` exists, exports `createSuperStackAggregatePlugin`
- [x] `src/views/pivot/plugins/SuperStackAggregate.ts` contains `pv-agg-cell`, `afterRender`, `collapsedSet`
- [x] `src/views/pivot/plugins/SuperStackSpans.ts` modified to accept `SuperStackState` parameter
- [x] `src/views/pivot/PivotGrid.ts` contains pointerdown listener on overlay with `runOnPointerEvent` call
- [x] `src/views/pivot/harness/HarnessShell.ts` imports and calls `setFactory` for `superstack.aggregate`
- [x] `tests/views/pivot/SuperStackCollapse.test.ts` exists with 14 test cases
- [x] `tests/views/pivot/SuperStackAggregate.test.ts` exists with 11 test cases
- [x] All 92 pivot tests pass
- [x] No TypeScript errors in any source file created/modified by this plan
- [x] Commits b272e22f (Task 1) and b93d4ad0 (Task 2) exist
