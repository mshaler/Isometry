# Phase 131: SuperGrid Defaults - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

ViewDefaultsRegistry maps all 20 source types (9 SourceType enum values + alto_index catch-all) to SuperGrid axis defaults. On first import, SuperGrid auto-configures with a meaningful col/row axis layout. Users can manually override, and a "Reset to defaults" action restores source-type defaults. Six requirements: SGDF-01 through SGDF-06.

</domain>

<decisions>
## Implementation Decisions

### Default Axis Mappings
- **D-01:** Hand-curated per source type — each of the 9 SourceType values gets a specific colAxes + rowAxes mapping. No heuristic-based or LATCH-derived auto-selection.
- **D-02:** One `alto_index` catch-all entry covers all dynamic `alto_index_*` directory types. Alto Index data is structurally similar across directories (same protobuf schema).
- **D-03:** Registry scope is axes only (colAxes + rowAxes). Sort, density, and calc keep their current generic defaults. The roadmap mentions "axis/sort/density/calc" but sort/density/calc are not source-type-specific enough to warrant per-type mappings.

### Fallback Strategy
- **D-04:** Ordered fallback list per registry entry. Each mapping has a priority array: e.g., `[company, folder, card_type]`. Try each in order via `SchemaProvider.isValidColumn()`; first valid one wins. If none valid, leave that axis empty (existing SuperGrid empty state handles it).

### Override Detection
- **D-05:** Compare-against-registry approach — no dirty flag, no extra state. On every axis change, compare current PAFV colAxes/rowAxes against what the registry would produce for this source_type (after fallback resolution). If different → show Reset button. Pure comparison function, no storage.

### Registry Architecture
- **D-06:** Static Map in a new file `src/providers/ViewDefaultsRegistry.ts`. Frozen `Map<string, DefaultMapping>` — compile-time constants, zero database overhead. Matches STATE.md decision: "ViewDefaultsRegistry is a static Map — no database, no migrations, compile-time constants."
- **D-07:** Alto Index key matching uses prefix match — registry key is `'alto_index'`, lookup logic tries exact match first, then `startsWith` prefix match. Same pattern as `DedupEngine`'s `sourceType.startsWith('alto_index_') ? 'alto_index' : sourceType`.

### Claude's Discretion
- Specific column names in each source type's default mapping (e.g., whether apple_notes defaults to `folder` cols + `title` rows, or some other combination) — Claude determines based on typical schema columns for each parser
- The DefaultMapping TypeScript interface shape
- Whether `applyDefaults()` lives on PAFVProvider or as a standalone function consuming the registry

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `CLAUDE-v5.md` — Canonical architectural decisions D-001 through D-010 (especially D-005: three-tier persistence)
- `.planning/PROJECT.md` — Project-level decisions and constraints

### Phase 130 Foundation (prerequisite)
- `.planning/phases/130-foundation/130-CONTEXT.md` — Per-dataset key namespacing decisions (D-01..D-04), scoped vs global key split
- `src/providers/StateManager.ts` — Scoped key registration, restore(), markDirty(), active dataset lifecycle

### Core Modules
- `src/providers/PAFVProvider.ts` — Current VIEW_DEFAULTS constant (line 59), PAFVState interface (line 33), axis mapping types
- `src/providers/SchemaProvider.ts` — `isValidColumn()` (line 211), `getAllAxisColumns()`, LATCH classification
- `src/providers/types.ts` — AxisMapping, CompiledAxis, PersistableProvider interfaces
- `src/providers/allowlist.ts` — validateAxisField() runtime validation

### Source Type Definitions
- `src/etl/types.ts` — SourceType union (line 18): 9 values
- `src/etl/ImportOrchestrator.ts` — `getSourceName()` (line 284): source type display names
- `src/worker/handlers/datasets.handler.ts` — Dataset lifecycle, source_type in datasets table
- `src/worker/handlers/etl-import-native.handler.ts` — Alto Index `alto_index_*` prefix convention (line 33)

### UI (approved spec)
- `.planning/phases/131-supergrid-defaults/131-UI-SPEC.md` — Approved UI contract: Reset button, AppDialog, silent first-import, fallback behavior

### Database Schema
- `src/database/schema.sql` — datasets table with `source_type TEXT NOT NULL` (line 212)

### Requirements
- `.planning/REQUIREMENTS.md` — SGDF-01 through SGDF-06 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PAFVProvider.VIEW_DEFAULTS` (line 59) — existing per-ViewType defaults; new registry adds per-source-type layer on top
- `SchemaProvider.isValidColumn()` — validation gate for all axis assignments (SGDF-02 requirement)
- `DedupEngine` alto_index prefix matching — proven `startsWith('alto_index_')` pattern to reuse
- `AppDialog.show()` — confirmation dialog for reset action (UI-SPEC approved)
- `PropertiesExplorer._renderFooter()` — footer button pattern to mirror in ProjectionExplorer

### Established Patterns
- Provider subscription: `subscribe(callback) => unsubscribe` — PAFVProvider already implements this
- Auto-persist via `enableAutoPersist()` with debounced writes at 500ms
- Per-dataset scoped keys: `{providerKey}:{datasetId}:{leaf}` (Phase 130 D-01)
- First-import flag: `view:defaults:applied:{datasetId}` key in ui_state (from REQUIREMENTS.md SGDF-06)

### Integration Points
- `src/main.ts` — import flow where defaults should be applied after dataset creation
- `src/views/CatalogSuperGrid.ts` — dataset selection triggers axis application
- `src/ui/ProjectionExplorer.ts` — Reset button placement and visibility logic
- WorkerBridge `ui:set` / `ui:get` — flag persistence for first-import gate

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

*Phase: 131-supergrid-defaults*
*Context gathered: 2026-03-27*
