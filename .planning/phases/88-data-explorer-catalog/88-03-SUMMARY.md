---
phase: 88-data-explorer-catalog
plan: 03
subsystem: ui
tags: [catalog-supergrid, data-explorer, sidebar-nav, wiring, sample-data]

# Dependency graph
requires:
  - phase: 88-01
    provides: datasets table DDL, CatalogWriter, datasets:query/stats/vacuum handlers
  - phase: 88-02
    provides: DataExplorerPanel UI shell, getCatalogBodyEl() mount point
  - phase: 17
    provides: SuperGrid class with adapter-injection constructor
  - phase: 86
    provides: WorkbenchShell with panel rail, SidebarNav

provides:
  - CatalogSuperGrid wrapper with real SuperGrid instance bound to datasets table
  - DataExplorerPanel wired into SidebarNav (onActivateItem data-explorer branch)
  - showDataExplorer / hideDataExplorer panel-rail toggle pattern
  - refreshDataExplorer() calling datasets:stats and catalog SuperGrid refresh
  - handleDatasetSwitch() reusing Phase 85 eviction path + deactivate-all/activate-one
  - Export flow via bridge.send('etl:export') per plan contract
  - refreshDataExplorer() hooked into importFile and importNative completions
  - SampleDataManager.load() creates datasets registry entry after seed load
  - WorkbenchShell.getPanelRailEl() accessor for panel rail mount target

affects: [DataExplorerPanel, SidebarNav, SampleDataManager, WorkbenchShell]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CatalogProviderAdapter/CatalogBridgeAdapter/CatalogFilterAdapter — adapter pattern for SuperGrid without PAFVProvider/FilterProvider"
    - "datasets:query → CellDatum flatMap — one CellDatum per (dataset, field) with col_key=field, row_key=dataset_id"
    - "Event delegation on container for row click interception — dataset id from data-row-key attribute"
    - "showDataExplorer/hideDataExplorer panel-rail toggle — hide siblings, show data-explorer root"
    - "refreshDataExplorer() — datasets:stats + catalogGrid.refresh() on mount, import completion"
    - "SampleDataManager datasets upsert via bridge.send('db:exec') with COUNT(*) subqueries"

key-files:
  created:
    - src/views/CatalogSuperGrid.ts
  modified:
    - src/main.ts
    - src/ui/WorkbenchShell.ts
    - src/sample/SampleDataManager.ts

key-decisions:
  - "CatalogBridgeAdapter encodes is_active as count (1=active, 0=inactive) in CellDatum — reuses existing count field without new interface changes"
  - "Event delegation on container for click vs SuperGridSelect adapter — simpler, no SuperGrid internals access needed"
  - "handleDatasetSwitch uses evictAll() then deactivate-all/activate-one SQL — consistent with Phase 85 eviction pattern, no new eviction mechanism"
  - "WorkbenchShell.getPanelRailEl() added as accessor — cleaner than querySelector on shell element"
  - "SampleDataManager datasets upsert uses ON CONFLICT(name, source_type) DO UPDATE — same key as CatalogWriter.upsertSampleDataset"

patterns-established:
  - "CatalogSuperGrid mini-coordinator pattern: Set<() => void> callbacks, refresh() fires all — lets CatalogSuperGrid control when SuperGrid re-fetches"
  - "showDataExplorer lazy-mount pattern: first call creates and mounts, subsequent calls show/hide"

requirements-completed: [DEXP-01, DEXP-03, DEXP-07]

# Metrics
duration: 10min
completed: 2026-03-18
---

# Phase 88 Plan 03: Data Explorer Wiring Summary

**CatalogSuperGrid adapter with real SuperGrid instance bound to datasets table, DataExplorerPanel wired into SidebarNav with panel-rail toggle, import/export flows connected, and SampleDataManager creating dataset entries on load**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-18T15:32:00Z
- **Completed:** 2026-03-18T15:42:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created CatalogSuperGrid.ts (300 LOC) with CatalogProviderAdapter, CatalogBridgeAdapter, CatalogFilterAdapter — real SuperGrid instance bound to datasets table via datasets:query worker handler
- CatalogBridgeAdapter converts each DatasetRow into 5 CellDatum (one per field: name, source_type, card_count, connection_count, last_imported_at) with col_key=field, row_key=dataset_id, count=is_active
- Event delegation on mount container intercepts dataset row clicks via data-row-key attribute
- Dataset click triggers AppDialog confirmation then handleDatasetSwitch() which reuses Phase 85 eviction path (evictAll + deactivate-all/activate-one SQL)
- DataExplorerPanel wired into SidebarNav.onActivateItem with data-explorer branch — showDataExplorer/hideDataExplorer toggle workbench panel visibility
- refreshDataExplorer() fetches datasets:stats (card_count, connection_count, db_size_bytes) and triggers catalog SuperGrid refresh on mount and after import completions
- Export flow uses bridge.send('etl:export') with Blob download via createObjectURL
- SampleDataManager.load() now upserts a datasets registry row after seeding cards/connections
- WorkbenchShell.getPanelRailEl() accessor added to expose panel rail for DataExplorerPanel mounting

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CatalogSuperGrid adapter and wire DataExplorerPanel into main.ts** - `067b0614` (feat)
2. **Task 2: Wire SampleDataManager to create dataset entries** - `2de9d947` (feat)

## Files Created/Modified

- `src/views/CatalogSuperGrid.ts` - CatalogSuperGrid wrapper with CatalogProviderAdapter, CatalogBridgeAdapter, CatalogFilterAdapter — 300 LOC
- `src/main.ts` - showDataExplorer/hideDataExplorer/refreshDataExplorer/handleDatasetSwitch, DataExplorerPanel + CatalogSuperGrid instantiation, SidebarNav data-explorer branch, import wrapper refresh hooks
- `src/ui/WorkbenchShell.ts` - Added getPanelRailEl() public accessor
- `src/sample/SampleDataManager.ts` - datasets upsert after Stage 2 (edges) load completes

## Decisions Made

- CatalogBridgeAdapter encodes is_active as count field in CellDatum — avoids new CellDatum interface changes, count=1 for active row provides hook for future CSS styling
- Event delegation on container for row click vs SuperGridSelect adapter — SuperGrid internals not exposed, delegation simpler and robust
- handleDatasetSwitch uses Phase 85 evictAll eviction path + two separate db:exec calls for deactivate-all and activate-one — consistent pattern, no new eviction mechanism
- WorkbenchShell.getPanelRailEl() added as accessor — cleaner than querySelector, follows existing getSidebarEl() pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing API] Added WorkbenchShell.getPanelRailEl()**
- **Found during:** Task 1
- **Issue:** Plan called `shell.getPanelRailEl()` but WorkbenchShell only exposed getSidebarEl() and getSectionBody() — no panel rail accessor
- **Fix:** Added getPanelRailEl() method matching getSidebarEl() pattern
- **Files modified:** src/ui/WorkbenchShell.ts
- **Commit:** 067b0614

**2. [Rule 1 - Bug] Fixed AxisMapping direction required field**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `{ field: 'name' as AxisMapping['field'] }` missing required `direction` property
- **Fix:** Added `direction: 'asc'` to the default colAxes entry
- **Files modified:** src/views/CatalogSuperGrid.ts
- **Commit:** 067b0614

**3. [Rule 1 - Bug] Fixed Uint8Array to Blob conversion**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** `new Blob([data as Uint8Array])` — TypeScript strict mode rejected `Uint8Array<ArrayBufferLike>` as BlobPart (expects `ArrayBufferView<ArrayBuffer>`)
- **Fix:** Used `new Uint8Array(data.buffer as ArrayBuffer)` to ensure concrete ArrayBuffer type
- **Files modified:** src/main.ts
- **Commit:** 067b0614

**4. [Rule 1 - Bug] Fixed SuperGridProviderLike adapter missing required methods**
- **Found during:** Task 1 (TypeScript compilation)
- **Issue:** Plan's CatalogProviderAdapter sketch omitted `reorderColAxes`, `reorderRowAxes`, `getAggregation` which are required by the full SuperGridProviderLike interface (added in Phase 31/84)
- **Fix:** Added all three methods as no-ops/constants to CatalogProviderAdapter
- **Files modified:** src/views/CatalogSuperGrid.ts
- **Commit:** 067b0614

**5. [Rule 1 - Bug] Fixed CalcQueryResult type mismatch**
- **Found during:** Task 1 (reading types.ts)
- **Issue:** Plan suggested `return { values: {} }` for calcQuery — but CalcQueryResult is `{ rows: Array<{groupKey, values}> }`, not `{ values: {} }`
- **Fix:** Return `{ rows: [] }` matching the actual CalcQueryResult interface
- **Files modified:** src/views/CatalogSuperGrid.ts
- **Commit:** 067b0614

---

**Total deviations:** 5 auto-fixed (Rules 1 and 2 — bugs and missing API)
**Impact on plan:** All TypeScript correctness fixes, no behavior change.

## Issues Encountered

Pre-existing TypeScript errors in tests/seams/etl/etl-fts.test.ts, tests/seams/ui/calc-explorer.test.ts, and tests/views/GalleryView.test.ts — not caused by this plan, out of scope.

## Next Phase Readiness

- Phase 88 complete: all 3 plans delivered
- Data Explorer is a working feature: catalog SuperGrid renders dataset rows, import/export wired, DB stats live, dataset switch confirmed via AppDialog
- Sample data loads register dataset entries for Catalog display
- TypeScript compiles cleanly across all src/ files

---
## Self-Check: PASSED

- src/views/CatalogSuperGrid.ts: FOUND
- src/sample/SampleDataManager.ts: FOUND (modified)
- Commit 067b0614: FOUND
- Commit 2de9d947: FOUND

---
*Phase: 88-data-explorer-catalog*
*Completed: 2026-03-18*
