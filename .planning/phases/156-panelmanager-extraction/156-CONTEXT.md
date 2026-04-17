# Phase 156: PanelManager Extraction - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract explorer show/hide/toggle orchestration from main.ts into a PanelManager class wired to PanelRegistry. Deliverable: PanelManager owns all 8 explorer panel lifecycles, main.ts loses ~300 LOC of toggle spaghetti, all explorer behaviors work identically to before extraction.

</domain>

<decisions>
## Implementation Decisions

### Lazy-mount Migration Strategy
- **D-01:** Fat factory closures — move wiring logic into `PanelFactory` closures that capture `bridge`/`coordinator`/`selection`/etc from PanelManager's constructor scope. Each explorer gets a self-contained factory. DataExplorer's ~150 LOC factory closure moves out of main.ts into its own file (or grouped logically with related panel factories), not inlined in main.ts.

### Coupled Toggle Logic
- **D-02:** PanelManager owns coupling rules declaratively. Explicit group/coupling methods (e.g., `showGroup('integrate')` shows DataExplorer+Properties together). Coupling rules are co-located with panel definitions, not scattered in dock callbacks. The dock `onActivateItem` callback becomes a thin router that delegates to PanelManager.

### Visibility State Tracking
- **D-03:** Mount once, toggle visibility. PanelManager tracks `mounted` and `visible` separately. First show runs the factory (mount); subsequent show/hide toggles `display:none`. Explorers preserve their internal state when hidden. PanelRegistry's enable/disable handles mount/unmount lifecycle; PanelManager adds a visibility layer on top. This replaces the loose `dataExplorerVisible`/`latchFiltersVisible`/`formulasVisible` booleans and `*Mounted` flags.

### Dock Routing Extraction
- **D-04:** Panel logic moves into PanelManager, view logic stays in the dock callback. All panel show/hide/toggle calls move into PanelManager methods (e.g., `toggle('catalog')`, `onSectionChange()`). View switching (`viewManager.switchTo()`) stays in the dock callback since it's not panel orchestration. Dock callback shrinks to: route view switches + call PanelManager for everything else.

### Claude's Discretion
- Whether PanelManager is a new class or extends/wraps PanelRegistry
- File organization for panel factory closures (one file per explorer vs grouped)
- Whether to add a `toggle(id)` convenience method to PanelManager
- How `syncTopSlotVisibility()` / `syncBottomSlotVisibility()` calls are handled (moved into PanelManager or called via onChange listener)
- Whether `dockToPanelMap` merges into PanelManager's configuration or stays as a separate mapping

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Panel Architecture
- `src/ui/panels/PanelRegistry.ts` — Existing lifecycle management (enable/disable, dependency enforcement, factory pattern, broadcastUpdate, onChange)
- `src/ui/panels/PanelTypes.ts` — PanelMeta, PanelHook, PanelFactory interfaces
- `src/ui/panels/index.ts` — Barrel export

### Extraction Target
- `src/main.ts` lines 751-1025 — 5 hand-rolled show/hide function pairs (DataExplorer, PropertiesExplorer, ProjectionExplorer, LatchFilters, FormulasExplorer) with lazy-mount logic
- `src/main.ts` lines 1133-1237 — Dock-to-panel toggle routing (`onActivateItem` callback) with manual visibility booleans and coupled hide logic

### Requirements
- `.planning/REQUIREMENTS.md` — BEHV-01 (PanelManager class), BEHV-02 (PanelRegistry wiring), BEHV-03 (~300 LOC removal from main.ts)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **PanelRegistry** (`src/ui/panels/PanelRegistry.ts`): 221 LOC, fully functional. Has enable/disable with transitive dependency enforcement, factory-based lazy instantiation, broadcastUpdate(), onChange subscription. Currently used by only 2 panels (notebook, stories-stub).
- **PanelTypes interfaces**: PanelMeta (id, name, icon, description, dependencies, defaultEnabled), PanelHook (mount/unmount/resize/update/destroy), PanelFactory (() => PanelHook)
- **DockNav** (`src/ui/DockNav.ts`): Already has `setItemPressed()` for toggle state UI

### Established Patterns
- PanelRegistry's factory pattern: `register(meta, factory)` auto-calls factory on first enable
- Enable/disable calls destroy() — but D-03 says we need a visibility layer (mount-once, toggle display), so PanelManager must sit between PanelRegistry lifecycle and CSS visibility
- `syncTopSlotVisibility()` / `syncBottomSlotVisibility()` — called after every show/hide to adjust container layout

### Integration Points
- main.ts `onActivateItem` callback — the primary consumer of show/hide functions; will become PanelManager's thin routing client
- `coordinator.scheduleUpdate()` — called from explorer subscriptions; PanelManager factories must capture coordinator
- `bridge` — needed by DataExplorer, LatchExplorers, PropertiesExplorer, CatalogSuperGrid factories
- `schemaProvider` — needed by PropertiesExplorer, ProjectionExplorer, LatchExplorers factories
- `selection`, `pafv`, `alias`, `superDensity`, `auditState`, `actionToast`, `filter` — various explorer constructor dependencies

### Panels to Migrate (5 hand-rolled + 2 already on PanelRegistry)
1. DataExplorer — heaviest factory (~150 LOC), coupled with PropertiesExplorer and CatalogSuperGrid
2. PropertiesExplorer — coupled with DataExplorer (shown/hidden together)
3. ProjectionExplorer — coupled with supergrid view type
4. LatchExplorers — independent toggle, bottom slot
5. FormulasExplorer — independent toggle, bottom slot, already uses formulasPanelFactory()
6. Notebook — already on PanelRegistry (keep as-is)
7. Stories-stub — already on PanelRegistry (keep as-is)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The existing PanelRegistry is the foundation; PanelManager is the orchestration layer on top.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 156-panelmanager-extraction*
*Context gathered: 2026-04-17*
