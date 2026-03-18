# Phase 88: Data Explorer + Catalog - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the Data Explorer panel with 4 collapsible sections (Import/Export, Catalog, Apps, DB Utilities). Create an internal `datasets` registry table auto-populated on every import completion. Catalog renders as a full SuperGrid instance bound to the datasets table. Dataset selection triggers the Phase 85 eviction path. SuperGrid-only initially; ViewZipper integration deferred.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout + Mount
- Data Explorer takes over the entire panel-rail area (where Properties/Projection/LATCH explorers live) when activated from SidebarNav
- Workbench panels hide while Data Explorer is active; re-activating a workbench section (Properties, Projection, etc.) switches back
- 4 sections rendered as CollapsibleSection instances — consistent with existing workbench explorer panels
- SidebarNav `data-explorer` → `catalog` click expands the Catalog collapsible section (and optionally collapses others); same for other sub-items
- SidebarNav `onActivateItem('data-explorer', 'catalog')` callback wires to Data Explorer panel mount + section expand

### Datasets Registry Table
- New `datasets` table (not extending import_sources or using a view)
- Columns include all 4 metadata categories:
  - **Core:** name, source_type, card_count, created_at
  - **Import provenance:** filename, last_imported_at, import_run_id (FK to import_runs)
  - **Active flag:** is_active INTEGER (only one row = 1 at a time)
  - **Size/stats:** connection_count, file_size_bytes
- Auto-populated on every import completion — CatalogWriter upserts a dataset row after each successful import
- Sample data loads also create a dataset entry (source_type = 'sample')
- FK to import_sources for source lineage

### Catalog as SuperGrid
- Full SuperGrid instance with PAFV axis stacking — not a simplified table
- Bound to the `datasets` table (separate query handler or datasets-specific SQL)
- Default columns: name, source_type, card_count, connection_count, last_imported_at
- Active dataset row visually highlighted (accent background or bold treatment)
- Dataset selection: click row → confirmation dialog ("Switch to Dataset X? Current data will be replaced.") → trigger Phase 85 eviction path (evictAll → DELETE → re-import → SchemaProvider re-introspection → provider resets)
- The eviction path is the same one built in Phase 85 — reuse, don't rebuild

### Import/Export Section
- Import button opens existing file picker (web: `<input type="file">`, native: fileImporter)
- Export buttons for CSV, JSON, Markdown — using existing ExportOrchestrator
- Drag-and-drop zone for file imports — visual drop target area
- No import history table in this phase (import_runs data available but display deferred)

### DB Utilities Section
- Database stats: card count, connection count, database size — simple SQL COUNT queries
- Vacuum / optimize button: runs VACUUM and REINDEX on demand
- Export database file: download raw .sqlite checkpoint for backup

### Apps Section
- Stub panel with "Coming soon" placeholder — matches existing stub pattern from SidebarNav (GRAPH, Formula, Interface Builder stubs)

### Claude's Discretion
- Exact confirmation dialog design (AppDialog vs custom modal)
- How the SuperGrid instance for Catalog is wired (separate WorkerBridge handler vs reusing supergrid:query with a table param)
- Drag-and-drop implementation details (HTML5 drag events vs library)
- Database file export mechanism (web: Blob download, native: share sheet)
- Whether vacuum runs synchronously or with a loading indicator
- Exact highlight style for active dataset row

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Data Explorer Panel
- `src/ui/SidebarNav.ts` — Section definitions (data-explorer with catalog/extensions items), onActivateItem callback, 3-state toggle pattern
- `src/ui/WorkbenchShell.ts` — Panel-rail container where explorer panels mount, CollapsibleSection creation pattern
- `src/ui/CollapsibleSection.ts` — Collapsible panel primitive with toggle, chevron, max-height transition, localStorage persistence, ARIA

### Datasets Registry + Catalog
- `src/database/schema.sql` — Existing import_sources and import_runs tables (lines 168-197), cards schema for reference
- `src/etl/CatalogWriter.ts` — Import provenance tracking, upsertSource pattern, recordImportRun — extend for datasets upsert
- `src/etl/ImportOrchestrator.ts` — Import completion flow where datasets table should be populated
- `src/sample/SampleDataManager.ts` — Sample data loading with source='sample' tagging — needs dataset entry creation

### Eviction Path (Phase 85)
- `src/views/ViewManager.ts` — evictAll() implementation, onLoadSample callback chain
- `src/providers/SchemaProvider.ts` — re-introspection after data load, refresh() method
- `src/providers/FilterProvider.ts` — clearFilters for dataset switch
- `src/providers/PAFVProvider.ts` — VIEW_DEFAULTS reset on dataset switch

### SuperGrid (for Catalog rendering)
- `src/views/supergrid/` — SuperGrid subsystem (10 files) — Catalog will instantiate a SuperGrid bound to datasets table
- `src/worker/handlers/` — Worker handlers for supergrid:query — may need datasets-specific handler or parameterization

### Import/Export
- `src/etl/ExportOrchestrator.ts` — CSV/JSON/Markdown export flow
- `src/etl/index.ts` — ETL barrel exports

### Architecture
- `CLAUDE-v5.md` — Locked architecture decisions D-001..D-011
- `v5/Modules/Core/Contracts.md` — Schema contracts and types
- `v5/Modules/DataExplorer.md` — ETL spec (parsers, dedup, export, catalog)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **CollapsibleSection**: Full collapse/expand API with ARIA — reuse for all 4 Data Explorer sections
- **SidebarNav**: Already has `data-explorer` section with `catalog` and `extensions` items — onActivateItem callback ready to wire
- **CatalogWriter**: Already tracks import_sources + import_runs — extend with datasets table upsert
- **ExportOrchestrator**: CSV/JSON/Markdown export already implemented — wire to Export buttons
- **AppDialog**: `<dialog>` wrapper for confirmation dialog on dataset switch
- **SampleDataManager**: SQL seed loading — needs dataset entry creation on load

### Established Patterns
- **Panel mount/destroy lifecycle**: All explorer panels use mount(container)/update()/destroy() — Data Explorer panel follows same pattern
- **Provider setter injection**: Late-binding providers use setter injection (Phase 69-73)
- **data-state attribute selectors**: Phase 86 pattern for CSS state toggle — use for active panel switching
- **Stub panels**: SidebarNav uses `.collapsible-section__stub*` classes for GRAPH/Formula/Interface Builder — reuse for Apps stub

### Integration Points
- SidebarNav.onActivateItem → Data Explorer panel mount (new wiring)
- WorkbenchShell panel-rail → hide existing panels, show Data Explorer (new toggle)
- CatalogWriter.recordImportRun → also upsert datasets row (extend existing flow)
- Catalog SuperGrid row click → confirmation → ViewManager eviction path (new flow, reuses Phase 85 evict)
- Import button → existing file picker / ImportOrchestrator flow
- Export buttons → existing ExportOrchestrator flow

</code_context>

<specifics>
## Specific Ideas

- The eviction path for Catalog dataset switch MUST be the same path built in Phase 85 — no separate eviction mechanism
- Catalog SuperGrid should feel like a real SuperGrid (PAFV, density controls) not a stripped-down data table — the whole point is that the catalog IS a SuperGrid view of the datasets table
- Phase 85 CONTEXT.md noted: "The eviction path should be the same whether triggered by Command-K, Catalog selection (Phase 88), or any future dataset switch mechanism"
- No import history display in this phase — keep Import/Export section focused on actions (import, export, drag-drop)

</specifics>

<deferred>
## Deferred Ideas

- ViewZipper integration for Catalog — per phase goal, deferred
- Import history table (display of import_runs audit trail) — future enhancement
- Per-dataset saved filter/axis configurations — noted in Phase 85 deferred ideas
- Native source shortcuts in Apps section — future phase
- Catalog search/filter (filtering the datasets list) — future if needed

</deferred>

---

*Phase: 88-data-explorer-catalog*
*Context gathered: 2026-03-18*
