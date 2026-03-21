---
phase: 100
plan: 03
subsystem: pivot-plugins
tags: [supercalc, plugin-registry, feature-catalog, harness, tdd]
dependency_graph:
  requires: [100-01, 100-02]
  provides: [supercalc-footer, supercalc-config, full-catalog-registration]
  affects: [FeatureCatalog, HarnessShell, stub-count-guard]
tech_stack:
  added: []
  patterns: [shared-config-map, tdd-red-green, registry-setFactory-override]
key_files:
  created:
    - src/views/pivot/plugins/SuperCalcFooter.ts
    - src/views/pivot/plugins/SuperCalcConfig.ts
    - tests/views/pivot/SuperCalc.test.ts
  modified:
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/harness/HarnessShell.ts
    - tests/views/pivot/FeatureCatalogCompleteness.test.ts
    - src/styles/pivot.css
    - src/styles/harness.css
decisions:
  - "Shared aggFunctions Map passed by reference from HarnessShell to both supercalc.footer and supercalc.config — same pattern as SuperZoom's shared ZoomState"
  - "createZoomState not re-imported in FeatureCatalog (only HarnessShell needs it) — avoids unnecessary coupling"
  - "computeAggregate is a pure exported function for unit testability without needing DOM/context"
  - "COUNT returns 0 for empty/all-null arrays (not null) — matches SQL COUNT semantics"
  - "SUM of all-null array returns 0 (null treated as 0) per plan spec; empty array returns null"
metrics:
  duration_seconds: 243
  completed_date: "2026-03-21"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 5
  tests_added: 30
  tests_total_pivot: 199
---

# Phase 100 Plan 03: SuperCalc Plugins + Full Catalog Registration Summary

SuperCalc aggregate footer + config plugins implemented via TDD; all 11 Phase 100 plugin factories registered in FeatureCatalog with shared state wiring in HarnessShell; stub count progression guard updated from 26 to 15.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SuperCalc plugins — footer row + aggregate config | 6e438d89 | SuperCalcFooter.ts, SuperCalcConfig.ts, pivot.css, harness.css, SuperCalc.test.ts |
| 2 | Catalog registration + HarnessShell wiring + stub count update | 30a8ce63 | FeatureCatalog.ts, HarnessShell.ts, FeatureCatalogCompleteness.test.ts |

## What Was Built

### SuperCalcFooter.ts (~130 LOC)

- `AggFunction` type: `'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'NONE'`
- `computeAggregate(fn, values)`: pure function handling all 6 aggregate types with correct null/empty semantics
- `createSuperCalcFooterPlugin(sharedConfig?)`: afterRender creates sticky `.pv-calc-footer` with per-column glyph (∑ x̄ # ↓ ↑) + formatted values; destroy() removes footer

### SuperCalcConfig.ts (~100 LOC)

- `createSuperCalcConfigPlugin(sharedConfig, onConfigChange?)`: afterRender creates `.hns-calc-config` sidebar section with per-column `<select>` dropdowns; updates shared aggFunctions Map on change and calls rerender callback

### FeatureCatalog.ts updates

- Added 11 `registry.setFactory()` calls for: supersize.col-resize, supersize.header-resize, supersize.uniform-resize, superzoom.slider, superzoom.scale, supersort.header-click, supersort.chain, superscroll.virtual, superscroll.sticky-headers, supercalc.footer, supercalc.config
- Total setFactory calls now: 12 (1 existing + 11 new)

### HarnessShell.ts updates

- Creates `zoomState` via `createZoomState()` and overrides superzoom factories with properly wired closures
- Creates `calcConfig` with empty `aggFunctions` Map and overrides supercalc factories with closures passing the shared config

### FeatureCatalogCompleteness.test.ts updates

- `implemented` array expanded from 1 to 12 plugins
- Stub count assertion updated from `toHaveLength(26)` to `toHaveLength(15)`

### CSS additions

- `pivot.css`: `.pv-calc-footer`, `.pv-calc-cell`, `.pv-calc-cell:first-child`, `.pv-calc-glyph`
- `harness.css`: `.hns-calc-config`, `.hns-calc-col-row`, `.hns-calc-col-row select`

## computeAggregate Semantics

| Function | Empty array | All-null | Mixed |
|----------|-------------|----------|-------|
| SUM | null | 0 (null as 0) | sum of all (null=0) |
| AVG | null | null | mean of non-null |
| COUNT | 0 | 0 | count of non-null |
| MIN | null | null | min of non-null |
| MAX | null | null | max of non-null |
| NONE | null | null | null |

## Tests

- 30 new tests in `tests/views/pivot/SuperCalc.test.ts` (all pass)
- All 199 pivot tests pass (11 test files)
- Completeness guard stub count: 26 → 15

## Deviations from Plan

None — plan executed exactly as written. Minor deviation: removed `createZoomState` from FeatureCatalog imports (plan suggested importing it, but it's only needed in HarnessShell). This is a cleanliness improvement with no behavioral impact.

## Self-Check: PASSED

- SuperCalcFooter.ts: FOUND
- SuperCalcConfig.ts: FOUND
- SuperCalc.test.ts: FOUND
- commit 65e0a7a0 (RED tests): FOUND
- commit 6e438d89 (GREEN implementation): FOUND
- commit 30a8ce63 (catalog + harness wiring): FOUND
