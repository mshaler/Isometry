---
phase: 101-base-extraction-superstack-catalog-migration
plan: 01
subsystem: plugin-registry
tags: [base-plugins, plugin-registry, tdd, refactoring]
dependency_graph:
  requires: []
  provides: [base.grid, base.headers, base.config]
  affects: [FeatureCatalog, PluginRegistry, FeatureCatalogCompleteness]
tech_stack:
  added: []
  patterns: [delegation-pattern, noop-lifecycle-wrapper, tdd-red-green]
key_files:
  created:
    - src/views/pivot/plugins/BaseGrid.ts
    - src/views/pivot/plugins/BaseHeaders.ts
    - src/views/pivot/plugins/BaseConfig.ts
    - tests/views/pivot/BasePlugins.test.ts
  modified:
    - src/views/pivot/plugins/FeatureCatalog.ts
    - tests/views/pivot/FeatureCatalogCompleteness.test.ts
decisions:
  - "Delegation pattern: base plugins are lifecycle wrappers (no-op hooks) because PivotGrid/PivotTable own the actual rendering — plugin presence enables registry dependency resolution"
  - "Stub count reduced 15 → 12 by registering base.grid, base.headers, base.config with real factories in registerCatalog()"
metrics:
  duration: "~2 minutes"
  completed: "2026-03-21"
  tasks_completed: 2
  files_changed: 6
---

# Phase 101 Plan 01: Base Plugin Extraction Summary

**One-liner:** Three no-op lifecycle wrapper plugins (base.grid, base.headers, base.config) extracted into dedicated files and registered in registerCatalog() via the delegation pattern, reducing stub count from 15 to 12.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create base plugin factories + tests (TDD RED+GREEN) | 4ab7d1ae | BaseGrid.ts, BaseHeaders.ts, BaseConfig.ts, BasePlugins.test.ts |
| 2 | Register base factories in FeatureCatalog + update completeness test | 50cd50a4 | FeatureCatalog.ts, FeatureCatalogCompleteness.test.ts |

## What Was Built

Three base plugin factory files were created following the delegation pattern. Each wraps a lifecycle stub rather than duplicating rendering logic that PivotGrid/PivotTable already own:

- **BaseGrid.ts** — `createBaseGridPlugin()` returns `{ afterRender() {}, destroy() {} }`. PivotGrid.render() drives the D3 data join; this plugin exists for registry presence and dependency resolution.
- **BaseHeaders.ts** — `createBaseHeadersPlugin()` returns `{ afterRender() {} }`. PivotGrid renders single-level headers natively; superstack.spanning extends this with N-level spanning.
- **BaseConfig.ts** — `createBaseConfigPlugin()` returns `{ afterRender() {}, destroy() {} }`. PivotTable mounts PivotConfigPanel directly; this plugin registers the lifecycle.

FeatureCatalog.ts was updated to import all three factories and call `registry.setFactory()` for each in `registerCatalog()`. The completeness guard was updated: implemented count advances from 12 to 15, stub count drops from 15 to 12.

## Test Results

- BasePlugins.test.ts: 8/8 tests pass (factory shape + callable lifecycle)
- FeatureCatalogCompleteness.test.ts: 6/6 tests pass (stub count now 12)
- Full pivot suite: 207/207 tests pass (no regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

Files verified:
- src/views/pivot/plugins/BaseGrid.ts: exists with `export function createBaseGridPlugin`
- src/views/pivot/plugins/BaseHeaders.ts: exists with `export function createBaseHeadersPlugin`
- src/views/pivot/plugins/BaseConfig.ts: exists with `export function createBaseConfigPlugin`
- tests/views/pivot/BasePlugins.test.ts: 120 lines, contains all 3 factory names
- src/views/pivot/plugins/FeatureCatalog.ts: contains setFactory calls for all 3
- tests/views/pivot/FeatureCatalogCompleteness.test.ts: stub count = 12
