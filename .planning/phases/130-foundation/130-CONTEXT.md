# Phase 130: Foundation - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-dataset ui_state isolation is established so all subsequent v10.0 features (defaults, presets, tour) can store and restore configuration per-dataset without key collisions. Three requirements: FNDX-01 (namespacing + migration), FNDX-02 (ViewManager isSwitching guard), FNDX-03 (preset key namespace reservation).

</domain>

<decisions>
## Implementation Decisions

### Key Namespace Format
- **D-01:** Domain-first format: `pafv:{datasetId}:rowAxes` — consistent with existing `notebook:{cardId}` pattern from v5.2. Domain prefix groups related keys; datasetId is the second segment; leaf key is the third.

### Migration Strategy
- **D-02:** Eager rename on boot — detect flat keys (e.g., `pafv:rowAxes`) and rename in-place to active dataset's namespace (`pafv:{datasetId}:rowAxes`). One-time migration, old flat keys removed after rename. No dual-write period.

### isSwitching Guard Behavior
- **D-03:** Silently drop — set `_isSwitching = true` in ViewManager during `switchTo()`. Provider notifications that fire during the switch are ignored (not queued, not blocked). The newly mounted view fetches fresh data on mount, so nothing is lost.

### Dataset Scoping Split
- **D-04:** Split: scoped + global. Only provider state keys that vary per dataset get namespaced (pafv, filter, density, sort, calc). Global keys stay flat (theme, sidebar collapse, latch overrides, tour completion). StateManager distinguishes scoped vs global providers at registration time.

### Claude's Discretion
- Which specific provider keys are scoped vs global — Claude determines based on whether the provider's state is dataset-dependent
- Migration detection heuristic — how to identify flat keys vs already-namespaced keys
- `preset:` prefix rejection mechanism in StateManager.registerProvider()

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `CLAUDE-v5.md` — Canonical architectural decisions D-001 through D-010 (especially D-005: three-tier persistence)
- `.planning/PROJECT.md` — Project-level decisions and constraints

### Core Modules
- `src/providers/StateManager.ts` — Current flat-key registration, restore(), markDirty(), _migrateState()
- `src/providers/types.ts` — PersistableProvider interface definition
- `src/views/ViewManager.ts` — switchTo() method, view lifecycle, coordinator subscription
- `src/worker/handlers/ui-state.handler.ts` — Worker-side ui_state CRUD operations

### Requirements
- `.planning/REQUIREMENTS.md` — FNDX-01, FNDX-02, FNDX-03 definitions

### Prior Art
- `src/ui/NotebookExplorer.ts` — `notebook:{cardId}` namespacing pattern (v5.2 precedent)
- `src/worker/handlers/datasets.handler.ts` — Dataset ID management and lifecycle

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `StateManager.registerProvider(key, provider)` — extend with scoped vs global flag
- `StateManager._migrateState()` — already handles field filtering on restore; can be extended for key migration
- `ViewManager.switchTo()` — add _isSwitching guard around destroy/mount sequence
- `notebook:{cardId}` key convention — proven domain-first namespacing pattern

### Established Patterns
- Provider subscription pattern: `subscribe(callback) => unsubscribe` — all Tier 2 providers implement this
- Auto-persist via `enableAutoPersist()` with debounced writes at 500ms
- WorkerBridge message protocol for ui_state: `ui:get`, `ui:set`, `ui:getAll`, `ui:delete`

### Integration Points
- `src/main.ts` — app boot sequence where StateManager.restore() is called (migration runs here)
- `src/worker/handlers/datasets.handler.ts` — dataset lifecycle events (create, delete) that may need ui_state cleanup
- CatalogSuperGrid dataset eviction — when deleting a dataset, scoped keys should be cleaned up

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 130-foundation*
*Context gathered: 2026-03-27*
