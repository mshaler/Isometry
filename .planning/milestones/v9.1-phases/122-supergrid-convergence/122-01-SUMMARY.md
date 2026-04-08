---
phase: 122-supergrid-convergence
plan: "01"
subsystem: pivot
tags: [data-adapter, bridge, mock, pivot-grid, pivot-table, convergence]
dependency_graph:
  requires: []
  provides: [DataAdapter interface, MockDataAdapter, BridgeDataAdapter]
  affects: [PivotTable, PivotGrid, HarnessShell]
tech_stack:
  added: []
  patterns: [DataAdapter pattern (Adapter GoF), dependency injection, TDD red-green]
key_files:
  created:
    - src/views/pivot/DataAdapter.ts
    - src/views/pivot/MockDataAdapter.ts
    - src/views/pivot/BridgeDataAdapter.ts
    - tests/views/pivot/DataAdapter.test.ts
  modified:
    - src/views/pivot/PivotTable.ts
decisions:
  - "BridgeDataAdapter.fetchData uses getCellKey (PivotMockData format: rowPath.join('|')::colPath.join('|')) not buildCellKey (RECORD_SEP format) — ensures key format consistency with PivotGrid's existing lookup code"
  - "PivotTable._renderAll uses .then() chain instead of async method to avoid making the entire rerender method async (which would require caller changes)"
  - "BridgeDataAdapter uses axisGranularity (not granularity) from SuperDensityState — discovered and fixed during TypeScript check"
metrics:
  duration_seconds: 247
  completed_date: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 122 Plan 01: DataAdapter Interface + PivotTable Wiring Summary

**One-liner:** DataAdapter interface with MockDataAdapter (PivotMockData harness) and BridgeDataAdapter (WorkerBridge+providers production) wired into PivotTable replacing hardcoded mock data.

## What Was Built

### Task 1: DataAdapter interface + MockDataAdapter + BridgeDataAdapter

Created three new files:

**`src/views/pivot/DataAdapter.ts`** — interface with `getAllDimensions`, `getRowDimensions`, `getColDimensions`, `setRowDimensions`, `setColDimensions`, `fetchData`, optional `subscribe?`, optional `getProviderContext?`.

**`src/views/pivot/MockDataAdapter.ts`** — wraps PivotMockData. `getAllDimensions()` returns `allDimensions` (6 dims). `fetchData()` calls `generateMockData(rows, cols, 12345)`. Default row/col dims match previous PivotTable hardcoded defaults. No `subscribe` needed (static data).

**`src/views/pivot/BridgeDataAdapter.ts`** — wraps WorkerBridge + providers. Constructor accepts `{ bridge, provider, filter, density, coordinator, schema?, calcExplorer?, depthGetter? }`. `getAllDimensions()` deduplicates rowAxes + colAxes from provider. `getRowDimensions`/`getColDimensions` convert AxisMapping[] to HeaderDimension[]. `setRowDimensions`/`setColDimensions` write back via provider.setRowAxes/setColAxes. `fetchData()` builds SuperGridQueryConfig from axes + filter.compile() + density.getState().axisGranularity, calls bridge.superGridQuery(), converts CellDatum[] to Map using getCellKey. `subscribe()` delegates to coordinator. `getProviderContext()` returns all raw dependencies.

19 tests covering all 7 specified behaviors in both adapters.

### Task 2: Wire DataAdapter into PivotTable

Updated `src/views/pivot/PivotTable.ts`:
- Added `adapter?: DataAdapter` to `PivotTableOptions`
- Removed direct imports of `generateMockData` and `allDimensions` from PivotMockData
- Added `import { MockDataAdapter } from './MockDataAdapter'`
- Defaults to `new MockDataAdapter()` when no adapter provided
- State initializes from `adapter.getRowDimensions()` / `adapter.getColDimensions()`
- `_getAvailable()` uses `this._adapter.getAllDimensions()` instead of `allDimensions`
- Dimension mutation handlers call `adapter.setRowDimensions`/`setColDimensions` to persist back
- `_renderAll()` now calls `this._adapter.fetchData(rows, cols).then(data => this._grid.render(...))`
- `mount()` wires `adapter.subscribe?()` → `_renderAll()` for external data changes
- `destroy()` calls `_adapterUnsub?.()`

HarnessShell unchanged — `new PivotTable({ registry })` still works because MockDataAdapter is the default.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong field name on SuperDensityState**
- **Found during:** Task 2 TypeScript check
- **Issue:** BridgeDataAdapter used `densityState.granularity` but SuperDensityState field is `axisGranularity`
- **Fix:** Changed to `densityState.axisGranularity`
- **Files modified:** src/views/pivot/BridgeDataAdapter.ts, tests/views/pivot/DataAdapter.test.ts
- **Commit:** 2de19879

**2. [Rule 1 - Bug] Fixed mock density state in test to use correct field names**
- **Found during:** Task 2 TypeScript check
- **Issue:** Test mock used `{ granularity: null }` instead of `{ axisGranularity: null, regionConfig: null }`
- **Fix:** Updated mock to match SuperDensityState shape
- **Files modified:** tests/views/pivot/DataAdapter.test.ts
- **Commit:** 2de19879

## Verification

- `npx vitest run tests/views/pivot/` — 569/569 tests passing (26 test files)
- `npx tsc --noEmit` — 0 errors in src/views/pivot/ (pre-existing errors in tests/etl-validation/ and tests/seams/ui/ are out of scope)
- HarnessShell (`?harness=1`) unchanged — MockDataAdapter is the default path

## Self-Check: PASSED

All required files exist:
- FOUND: src/views/pivot/DataAdapter.ts
- FOUND: src/views/pivot/MockDataAdapter.ts
- FOUND: src/views/pivot/BridgeDataAdapter.ts
- FOUND: tests/views/pivot/DataAdapter.test.ts

All task commits exist:
- FOUND: 75301e6a (Task 1 — DataAdapter + MockDataAdapter + BridgeDataAdapter)
- FOUND: 2de19879 (Task 2 — Wire DataAdapter into PivotTable)
