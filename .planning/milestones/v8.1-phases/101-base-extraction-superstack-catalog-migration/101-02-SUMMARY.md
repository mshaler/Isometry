---
phase: 101-base-extraction-superstack-catalog-migration
plan: "02"
subsystem: pivot-plugin-registry
tags: [plugin-registry, superstack, refactor, shared-state]
dependency_graph:
  requires: [101-01]
  provides: [STKM-01, STKM-02]
  affects: [FeatureCatalog, PluginRegistry, HarnessShell]
tech_stack:
  added: []
  patterns:
    - internal shared state creation inside registerCatalog()
    - public notifyChange() wrapper for registry change propagation
    - closure-based factory injection for shared-state plugins
key_files:
  created:
    - tests/views/pivot/SuperStackCatalog.test.ts
  modified:
    - src/views/pivot/plugins/PluginRegistry.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/harness/HarnessShell.ts
    - tests/views/pivot/FeatureCatalogCompleteness.test.ts
decisions:
  - "notifyChange() added as public wrapper around private _notify() — cleanest way for catalog-wired plugins to trigger re-renders without accessing private members"
  - "All 3 shared-state objects (SuperStackState, zoomState, calcConfig) created inside registerCatalog() — registerCatalog() is the single source of truth for all plugin wiring"
  - "HarnessShell constructor reduced to 4 lines with zero setFactory calls"
metrics:
  duration: ~8 minutes
  completed: "2026-03-21"
  tasks_completed: 2
  files_modified: 5
  tests_added: 7
  tests_total: 214
---

# Phase 101 Plan 02: SuperStack Catalog Migration Summary

**One-liner:** Migrated superstack.collapse and superstack.aggregate from HarnessShell closure wiring into registerCatalog() with internal shared SuperStackState, reducing stubs from 12 to 10 and making HarnessShell a pure layout shell.

## What Was Built

### Task 1: Migrate shared state into registerCatalog + clean HarnessShell

**TDD cycle completed** (RED → GREEN → no refactor needed):

- Added `notifyChange(): void` public method to `PluginRegistry` — wraps private `_notify()`, allowing plugins wired in `registerCatalog()` to trigger re-renders without accessing private members
- Rewrote `registerCatalog()` to create all shared state objects internally:
  - `const superStackState: SuperStackState` — shared across spanning, collapse, and aggregate
  - `const zoomState = createZoomState()` — shared across zoom scale and slider
  - `const calcConfig = { aggFunctions: new Map<number, AggFunction>() }` — shared across footer and config
- Registered `superstack.collapse` and `superstack.aggregate` with real factories using closure capture of shared state
- Removed `createSuperStackSpansPlugin` individual factory call — now uses closure wrapping shared state
- Removed all 8 extra shared-state imports from HarnessShell.ts (SuperStackCollapse, SuperStackAggregate, SuperZoomWheel, SuperZoomSlider, SuperCalcFooter, SuperCalcConfig, ZoomState, AggFunction type)
- Removed all 7 `setFactory()` override calls from HarnessShell constructor
- HarnessShell constructor: 4 lines, zero `setFactory` calls

Created `tests/views/pivot/SuperStackCatalog.test.ts` with 7 behavioral tests:
- Both superstack plugins NOT in getStubIds() after registerCatalog()
- Collapse plugin hook shape (afterRender, onPointerEvent, destroy)
- Aggregate plugin hook shape (afterRender)
- Collapse onPointerEvent consumes pointerdown on collapsible header
- Shared state: aggregate reads collapse state (pv-agg-cell applied to marked cells)
- notifyChange() triggers onChange listeners

### Task 2: Update completeness test + full regression check

- Added `'superstack.collapse'` and `'superstack.aggregate'` to implemented array
- Removed workaround comment about "wired via HarnessShell setFactory closures"
- Updated stub count from `toHaveLength(12)` to `toHaveLength(10)`
- Updated comment: `// Current: 27 total - 17 implemented in registerCatalog = 10 stubs`
- Full pivot test suite: **214 tests pass, 0 regressions**

## Deviations from Plan

None — plan executed exactly as written. The `notifyChange()` approach described in CONTEXT.md was the chosen solution and was straightforward to implement.

## Commits

| Hash | Message |
|------|---------|
| `88503092` | feat(101-02): migrate superstack shared state into registerCatalog + add notifyChange() |
| `6ca4c5c2` | feat(101-02): update completeness guard — 17 implemented, 10 stubs |

## Verification

All acceptance criteria met:
- `PluginRegistry.ts` contains `notifyChange(): void`
- `FeatureCatalog.ts` contains `import { createSuperStackCollapsePlugin` (no `as any` cast)
- `FeatureCatalog.ts` contains `registry.setFactory('superstack.collapse'`
- `FeatureCatalog.ts` contains `registry.setFactory('superstack.aggregate'`
- `FeatureCatalog.ts` contains `const superStackState: SuperStackState`
- `FeatureCatalog.ts` contains `registry.notifyChange()` in collapse factory closure
- `HarnessShell.ts` does NOT contain `setFactory` (count: 0)
- `HarnessShell.ts` does NOT contain `SuperStackState`
- `HarnessShell.ts` does NOT contain `createZoomState`
- `HarnessShell.ts` does NOT contain `calcConfig`
- `HarnessShell.ts` import block: only PluginRegistry, registerCatalog, FeaturePanel, PivotTable
- `tests/views/pivot/SuperStackCatalog.test.ts` passes (7/7)
- `FeatureCatalogCompleteness.test.ts` stub count: 10
- All 214 pivot tests pass

## Self-Check: PASSED
