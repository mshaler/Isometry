---
phase: 103-supercalc-v2-null-handling-filter-scope
plan: "01"
subsystem: pivot-plugins
tags: [supercalc, null-handling, aggregate, filter-scope, tdd, types]
dependency_graph:
  requires: []
  provides: [NullMode, CountMode, ScopeMode, ColCalcConfig, CalcConfig, AggResult, allRows]
  affects: [SuperCalcConfig, FeatureCatalog, PivotGrid, RenderContext]
tech_stack:
  added: []
  patterns:
    - AggResult structured return (value + optional warning) replaces bare number|null
    - null-substitution working array pattern for 'zero' mode
    - allRows captured before hide-empty filter for scope:'all' support
key_files:
  created: []
  modified:
    - src/views/pivot/plugins/SuperCalcFooter.ts
    - src/views/pivot/plugins/PluginTypes.ts
    - src/views/pivot/plugins/SuperCalcConfig.ts
    - src/views/pivot/plugins/FeatureCatalog.ts
    - src/views/pivot/PivotGrid.ts
    - tests/views/pivot/SuperCalc.test.ts
    - tests/views/pivot/BasePlugins.test.ts
    - tests/views/pivot/PluginRegistry.test.ts
    - tests/views/pivot/SuperAudit.test.ts
    - tests/views/pivot/SuperDensity.test.ts
    - tests/views/pivot/SuperScroll.test.ts
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
  - "computeAggregate returns AggResult object (not number|null) — eliminates call-site type narrowing"
  - "SUM with nullMode 'exclude' preserves original reduce behavior (null as 0) for backward compat"
  - "allRows placed on RenderContext (not CalcConfig) — it's a render-pipeline concern, not config"
  - "getColConfig exported helper provides lazy defaults (SUM/exclude/column) for missing col entries"
  - "createSuperCalcConfigPlugin migrated to accept CalcConfig (replaces aggFunctions Map shape)"
metrics:
  duration_seconds: 440
  completed_date: "2026-03-22"
  tasks_completed: 1
  files_modified: 20
requirements: [SC2-01, SC2-02, SC2-03, SC2-04, SC2-05, SC2-06, SC2-07, SC2-09, SC2-10, SC2-14, SC2-15]
---

# Phase 103 Plan 01: SuperCalc v2 Core Types + Logic Summary

SuperCalc v2 core: NullMode/CountMode/AggResult types and computeAggregate logic with RenderContext.allRows scope support, TDD-executed with 53 tests all passing.

## Tasks

### Task 1: Types + computeAggregate + allRows (TDD)

**Status:** Complete
**Commits:**
- `85f54123` — test(103-01): add failing tests for NullMode/CountMode/AggResult/scope (RED)
- `2050359b` — feat(103-01): implement NullMode/CountMode/AggResult + allRows scope support (GREEN + auto-fixes)

**What was built:**

**SuperCalcFooter.ts — new types:**
- `NullMode = 'exclude' | 'zero' | 'strict'`
- `CountMode = 'column' | 'all'`
- `ScopeMode = 'view' | 'all'`
- `ColCalcConfig { fn, nullMode, countMode }`
- `CalcConfig { cols: Map<number, ColCalcConfig>, scope: ScopeMode }`
- `AggResult { value: number | null, warning?: 'incomplete-data' }`
- `WARNING_GLYPH = '\u26A0'`
- `getColConfig(calcConfig, colIdx)` helper with lazy defaults

**computeAggregate — new signature and semantics:**
- Signature: `(fn, values, nullMode, countMode) => AggResult`
- `nullMode 'exclude'`: existing behavior (SUM treats null as 0, AVG/MIN/MAX skip nulls)
- `nullMode 'zero'`: substitutes 0 for all nulls before computing; AVG divides by total rows
- `nullMode 'strict'`: returns `{ value: null, warning: 'incomplete-data' }` if any null present
- `countMode 'all'`: COUNT returns `values.length` (total rows, ignores nulls)
- `countMode 'column'`: COUNT returns non-null count (original behavior, zero-substitution doesn't change this)

**PluginTypes.ts:**
- Added `allRows: string[][]` to `RenderContext` interface after `visibleRows`

**PivotGrid.ts:**
- Captures `const allRows = rowCombinations` before hide-empty filter in `render()`
- Adds `allRows` to main render ctx object
- Adds `allRows: []` to scroll handler and overlay pointerdown ctx objects

**SuperCalcConfig.ts + FeatureCatalog.ts:**
- `createSuperCalcConfigPlugin` migrated from `{ aggFunctions: Map }` to `CalcConfig`
- `FeatureCatalog` constructs `CalcConfig { cols: new Map(), scope: 'view' }`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SUM with exclude returning null for all-null arrays**
- **Found during:** GREEN phase after first test run
- **Issue:** New implementation filtered null values before SUM, making all-null arrays return null. Original behavior was null=0 via reduce, so `SUM([null, null])` was `0`.
- **Fix:** Added explicit SUM/exclude early-return path using original `reduce((acc, v) => acc + (v ?? 0), 0)` to preserve backward compat before the working-array split.
- **Files modified:** `src/views/pivot/plugins/SuperCalcFooter.ts`
- **Commit:** `2050359b`

**2. [Rule 1 - Bug] 14 test files missing allRows on RenderContext**
- **Found during:** TypeScript check after GREEN implementation
- **Issue:** Adding `allRows: string[][]` as required field to `RenderContext` broke 14 test files' makeCtx/minimalCtx factory functions.
- **Fix:** Added `allRows: []` to all affected ctx factory functions across 14 test files.
- **Files modified:** 14 test files (BasePlugins, PluginRegistry, SuperAudit, SuperDensity, SuperScroll, SuperSearch, SuperSelect, SuperSize, SuperSort, SuperStackAggregate, SuperStackCatalog, SuperStackCollapse, SuperStackSpans, SuperZoom)
- **Commit:** `2050359b`

## Test Results

- SuperCalc.test.ts: 53/53 passing (43 new + 10 migrated regression tests)
- All pivot tests: 307/307 passing
- TypeScript: 0 errors

## Self-Check: PASSED

- FOUND: src/views/pivot/plugins/SuperCalcFooter.ts
- FOUND: src/views/pivot/plugins/PluginTypes.ts
- FOUND: src/views/pivot/PivotGrid.ts
- FOUND: tests/views/pivot/SuperCalc.test.ts
- FOUND: commit 85f54123 (RED phase)
- FOUND: commit 2050359b (GREEN phase)
