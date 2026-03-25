# Phase 122: SuperGrid Convergence - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning
**Source:** Codebase exploration + conversation

<domain>
## Phase Boundary

Replace the monolithic production `SuperGrid.ts` (~5K LOC) with the plugin-based `PivotGrid` architecture (`PluginRegistry` + 27 composable plugins) wired to real `WorkerBridge` data. After this phase, there is ONE SuperGrid codebase — the plugin-based one — serving both production and the test harness.

**What changes:** Data flow into PivotGrid, ViewManager wiring, CatalogSuperGrid adapter, dead code deletion
**What does NOT change:** Plugin implementations, shared `/supergrid/` utilities, harness `?harness=1` functionality

</domain>

<decisions>
## Implementation Decisions

### Architecture — DataAdapter Interface
- PivotGrid currently uses `PivotMockData.ts` for data. Create a `DataAdapter` interface that abstracts data sourcing.
- `MockDataAdapter` wraps PivotMockData (for harness). `BridgeDataAdapter` wraps WorkerBridge + providers (for production).
- PivotGrid constructor accepts `DataAdapter` instead of raw mock data.

### Wiring — ViewManager Factory
- `main.ts` line ~321 has `viewFactory['supergrid']` that creates `new SuperGrid(...)`. Replace with `PivotGrid`-based construction using `BridgeDataAdapter`.
- PivotGrid must implement the `IView` interface (`mount`/`render`/`destroy` lifecycle) that ViewManager expects.

### Wiring — Provider Injection
- Production SuperGrid receives: PAFVProvider, FilterProvider, WorkerBridge, StateCoordinator, SuperPositionProvider, SuperGridSelectionAdapter, SuperDensityProvider, SchemaProvider
- The `BridgeDataAdapter` must proxy these to the appropriate plugin hooks (transformData, transformLayout, render, afterRender)

### CatalogSuperGrid
- `CatalogSuperGrid.ts` creates adapter objects (`CatalogBridgeAdapter`, `CatalogFilterAdapter`, `CatalogProviderAdapter`) and passes them to `SuperGrid`. After convergence, it should pass them through a `CatalogDataAdapter` to `PivotGrid`.

### Deletion
- After all tests pass with PivotGrid, delete `src/views/SuperGrid.ts` and update all imports.

### Shared Utilities Unchanged
- Both implementations already import from `src/views/supergrid/` (keys.ts, SortState.ts, SuperGridBBoxCache.ts, etc.). These stay exactly as-is.

### Claude's Discretion
- Exact DataAdapter method signatures
- Plugin hook wiring order for provider data
- Whether to create a thin `SuperGrid` re-export for backward compatibility or update all imports directly
- Test migration strategy (update imports vs shimming)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Production SuperGrid
- `src/views/SuperGrid.ts` — Current monolithic implementation (~5K LOC) to be replaced
- `src/views/CatalogSuperGrid.ts` — Catalog variant that wraps SuperGrid (335 LOC)
- `src/main.ts` — ViewManager factory wiring (line ~321 for supergrid factory)

### Plugin Architecture
- `src/views/pivot/PivotGrid.ts` — Plugin-based grid renderer (671 LOC)
- `src/views/pivot/PivotTable.ts` — Orchestrator that wires PivotGrid + PluginRegistry (167 LOC)
- `src/views/pivot/plugins/PluginRegistry.ts` — Plugin lifecycle and pipeline (280 LOC)
- `src/views/pivot/harness/HarnessShell.ts` — Test harness shell (130 LOC)
- `src/views/pivot/plugins/` — All 27 plugin implementations

### Shared Grid Utilities
- `src/views/supergrid/` — 9 shared modules used by BOTH implementations

### Provider Contracts
- `src/providers/` — PAFVProvider, FilterProvider, SuperDensityProvider, etc.
- `src/database/WorkerBridge.ts` — Bridge to sql.js Worker
- `src/coordinator/StateCoordinator.ts` — State management

</canonical_refs>

<specifics>
## Specific Ideas

- The `IView` interface has `mount(container)`, `render()`, `destroy()` methods. PivotGrid/PivotTable already has `mount`/`render`/`destroy` — may just need the interface signature.
- PivotGrid.setRegistry() is how plugins get wired in. The production path should create a default registry with all 27 plugins enabled.
- CalcExplorer (Phase 62) wires into SuperGrid for aggregate config. This connection must survive convergence via the DataAdapter.
- SchemaProvider dynamic fields (Phase 71 DYNM-10) drive SuperGrid column generation. DataAdapter must proxy schema changes.

</specifics>

<deferred>
## Deferred Ideas

- Performance benchmarking of PivotGrid vs monolithic SuperGrid (can be done post-convergence if needed)
- Plugin hot-reload in production (currently harness-only feature)
- Plugin marketplace / user-installable plugins

</deferred>

---

*Phase: 122-supergrid-convergence*
*Context gathered: 2026-03-25 via codebase exploration*
