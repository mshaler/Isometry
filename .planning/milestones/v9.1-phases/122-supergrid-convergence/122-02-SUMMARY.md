---
phase: 122-supergrid-convergence
plan: "02"
subsystem: views/pivot
tags: [supergrid, pivot, convergence, production, catalog]
dependency_graph:
  requires:
    - 122-01 (BridgeDataAdapter, DataAdapter, PivotTable with adapter support)
  provides:
    - ProductionSuperGrid IView wrapper (CONV-02)
    - main.ts factory uses ProductionSuperGrid (CONV-02)
    - CatalogSuperGrid uses PivotTable+CatalogDataAdapter (CONV-04)
  affects:
    - src/main.ts (supergrid view factory)
    - src/views/index.ts (barrel export)
    - src/views/CatalogSuperGrid.ts (full rewrite)
    - src/views/pivot/BridgeDataAdapter.ts (setters added)
tech_stack:
  added: []
  patterns:
    - IView wrapper around PivotTable (ProductionSuperGrid)
    - DataAdapter over existing bridge/provider/filter adapters (CatalogDataAdapter)
    - d3.datum() read from <tr> for DOM attribute stamping
key_files:
  created:
    - src/views/pivot/ProductionSuperGrid.ts
  modified:
    - src/views/pivot/BridgeDataAdapter.ts
    - src/main.ts
    - src/views/index.ts
    - src/views/CatalogSuperGrid.ts
decisions:
  - "ProductionSuperGrid exposes setCalcExplorer/setSchemaProvider/setDepthGetter to maintain same API as monolithic SuperGrid — wiring code in main.ts unchanged"
  - "BridgeDataAdapter setters added as post-construction mutators (no constructor churn); store in existing private fields"
  - "CatalogDataAdapter maps datasets as row dimension (DATASET_DIM) and field names as col dimension, giving natural row-per-dataset layout in PivotGrid"
  - "data-row-key stamping: MutationObserver reads d3.datum() from <tr> elements (PivotGrid binds rowPath via D3 data join) and stamps data-row-key on <tr> and .pv-data-cell children"
  - "Fallback density provider created inline in ProductionSuperGrid for optional densityProvider config"
metrics:
  duration: "~5 minutes"
  completed: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 122 Plan 02: PivotGrid Production Wiring Summary

ProductionSuperGrid IView wrapper and main.ts factory switch + CatalogSuperGrid migration to PivotTable with a catalog-specific DataAdapter.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ProductionSuperGrid IView wrapper + main.ts factory switch | c3d0ee32 | ProductionSuperGrid.ts (new), BridgeDataAdapter.ts, main.ts, index.ts |
| 2 | CatalogSuperGrid uses PivotTable with CatalogDataAdapter | 648966f6 | CatalogSuperGrid.ts |

## What Was Built

**Task 1: ProductionSuperGrid**

`src/views/pivot/ProductionSuperGrid.ts` — new IView wrapper that:
- Creates a `PluginRegistry` and registers all 27 plugins via `registerCatalog()`
- Creates a `BridgeDataAdapter` wrapping production providers (bridge, pafv, filter, density, coordinator)
- Creates a `PivotTable` with the registry and adapter
- Implements `IView` (mount/render/destroy) — `render()` is a no-op since PivotTable self-manages via BridgeDataAdapter's `subscribe()` hook
- Exposes `setCalcExplorer()`, `setSchemaProvider()`, `setDepthGetter()` delegating to BridgeDataAdapter

`src/views/pivot/BridgeDataAdapter.ts` — three post-construction setters added:
- `setCalcExplorer(explorer)` — stores in `_calcExplorer`
- `setSchemaProvider(sp)` — stores in `_schema`
- `setDepthGetter(getter)` — stores in `_depthGetter`

`src/main.ts` — supergrid factory replaced:
- Removed: `new SuperGrid(pafv, filter, bridge, coordinator, ...)`
- Added: `new ProductionSuperGrid({ provider: pafv, filter, bridge, coordinator, ... })`
- All three `set*` calls preserved (same API surface)

`src/views/index.ts` — barrel export updated:
- `export { SuperGrid } from './SuperGrid'` → `export { ProductionSuperGrid as SuperGrid } from './pivot/ProductionSuperGrid'`

**Task 2: CatalogSuperGrid**

`src/views/CatalogSuperGrid.ts` — full rewrite using PivotTable:
- Added `CatalogDataAdapter` implementing `DataAdapter`:
  - Row dimension: `DATASET_DIM` with dataset IDs as values (populated dynamically in `fetchData()`)
  - Col dimension: fixed `'field'` with values `['name', 'source_type', 'card_count', 'connection_count', 'last_imported_at']`
  - `fetchData()` calls `CatalogBridgeAdapter.superGridQuery()` and converts CellDatum[] to `Map<cellKey, number|null>` using `getCellKey([datasetId], [fieldName])`
  - `subscribe()` delegates to the mini coordinator
- `CatalogSuperGrid._pivotTable` replaces `_superGrid` field
- `mount()` creates `new PivotTable({ adapter: this._dataAdapter })`
- `refresh()` fires coordinator callbacks (unchanged behavior)
- `destroy()` calls `this._pivotTable.destroy()` instead of `this._superGrid.destroy()`
- `_stampRowKeys()`: reads D3 datum from `<tr>` elements (`d3.select(tr).datum()` returns `rowPath: string[]`), stamps `data-row-key = rowPath[0]` on `<tr>` and `.pv-data-cell` children
- MutationObserver: on each render cycle, calls `_stampRowKeys()` then `_applyActiveRowHighlight()`
- Click handler: unchanged — still reads `data-row-key` from DOM; now looks up name/sourceType from `CatalogBridgeAdapter.lastDatasets` cache instead of DOM queries

## Verification

- `npx tsc --noEmit`: 0 errors in src/ (pre-existing test file errors unchanged)
- `npx vitest run tests/views/pivot/`: 569/569 tests pass, 26 test files
- `src/main.ts` contains `new ProductionSuperGrid({` — no `new SuperGrid(`
- `src/main.ts` does NOT import from `./views/SuperGrid`
- `src/views/CatalogSuperGrid.ts` imports from `./pivot/PivotTable` — no import from `./SuperGrid`
- HarnessShell unchanged (uses MockDataAdapter, unaffected by this plan)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] BridgeDataAdapter lacked setter methods**
- **Found during:** Task 1 implementation
- **Issue:** Plan called for `ProductionSuperGrid.setCalcExplorer/setSchemaProvider/setDepthGetter` to delegate to BridgeDataAdapter, but BridgeDataAdapter had no such setters.
- **Fix:** Added three post-construction setter methods to BridgeDataAdapter that store values in existing private fields
- **Files modified:** `src/views/pivot/BridgeDataAdapter.ts`
- **Commit:** c3d0ee32

**2. [Rule 1 - Bug] SuperDensityState missing regionConfig field**
- **Found during:** Task 1 (ProductionSuperGrid fallback density)
- **Issue:** Inline fallback `SuperDensityState` object was missing required `regionConfig: null` field
- **Fix:** Added `regionConfig: null` to the fallback state object
- **Files modified:** `src/views/pivot/ProductionSuperGrid.ts`
- **Commit:** c3d0ee32

**3. [Rule 1 - Bug] CellDatum index signature requires bracket notation**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** `CellDatum` has `[key: string]: unknown` index signature; TypeScript requires bracket notation for `cell.row_key` / `cell.col_key`
- **Fix:** Changed all `.row_key` / `.col_key` accesses to `['row_key']` / `['col_key']`
- **Files modified:** `src/views/CatalogSuperGrid.ts`
- **Commit:** 648966f6

## Self-Check: PASSED

- FOUND: src/views/pivot/ProductionSuperGrid.ts
- FOUND: src/views/CatalogSuperGrid.ts
- FOUND: commit c3d0ee32 (feat(122-02): ProductionSuperGrid IView wrapper + main.ts factory switch)
- FOUND: commit 648966f6 (feat(122-02): CatalogSuperGrid uses PivotTable with CatalogDataAdapter)
