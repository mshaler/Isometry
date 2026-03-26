# Phase 125: Dataset Lifecycle Management - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

User can manage imported directory datasets independently -- viewing them in the catalog as distinct rows, deleting a single dataset without touching others, refreshing via re-import (single directory), and previewing changes before a re-import commits. Requirements: DSET-01, DSET-02, DSET-03, DSET-04.

</domain>

<decisions>
## Implementation Decisions

### Catalog dataset rows (DSET-01)
- Inline action buttons per dataset row: delete (trash icon) and re-import (refresh icon) in a dedicated actions column
- Per-dataset scoped card counts (WHERE source = X), not global counts -- fix CatalogWriter to count per-dataset instead of all cards
- Add actions column to existing 5 columns (name, source_type, card_count, connection_count, last_imported_at)
- Buttons visible on hover (always visible on mobile/touch)

### Delete-by-dataset (DSET-02)
- Delete cross-boundary connections: if either end belongs to the deleted dataset, remove the connection
- Remove catalog row entirely (DELETE from datasets table) -- no tombstone/inactive state
- No undo (not via MutationManager) -- confirmation dialog with card count is the safety gate
- Re-import is the recovery path if deletion was accidental

### Re-import flow (DSET-03)
- Store directory path in datasets row so re-import can re-read same path without re-picking
- Re-import button re-reads the stored path for that single subdirectory only (not full discovery)
- Falls back to file picker if stored path is no longer accessible (security-scoped bookmark expired, directory moved)
- Reuse existing ImportToast for progress reporting during parse+dedup phase
- DedupEngine handles source-scoped dedup with alto_index sourceType normalization (from Phase 124)

### Diff preview (DSET-04)
- Two-phase flow: parse+dedup first (ImportToast shows progress) -> diff modal opens when DedupResult ready -> user Commits or Cancels
- AppDialog modal with summary counts at top (N new, N modified, N deleted) + collapsible sections per category listing card names
- If diff shows zero changes (all unchanged): skip modal, show brief "no changes" toast instead
- Commit button triggers SQLiteWriter to apply inserts/updates/deletes; Cancel discards the DedupResult

### Claude's Discretion
- Exact modal layout and styling for diff preview
- Confirmation dialog wording for delete
- How to handle security-scoped bookmark refresh for stored paths
- Column widths and hover behavior for action buttons
- Whether to show "unchanged" count in diff summary or just new/modified/deleted

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` -- DSET-01..04 definitions and traceability

### Existing catalog infrastructure
- `src/views/CatalogSuperGrid.ts` -- PivotTable-based catalog rendering, CatalogProviderAdapter, CatalogBridgeAdapter, field definitions
- `src/worker/handlers/datasets.handler.ts` -- datasets:query/stats/vacuum/recent-cards Worker handlers
- `src/etl/CatalogWriter.ts` -- DatasetRow type, upsertDataset(), recordImportRun(), upsertSource()

### Dedup and import pipeline
- `src/etl/DedupEngine.ts` -- DedupResult (toInsert/toUpdate/toSkip/deletedIds), source-scoped classification, connection resolution
- `src/worker/handlers/etl-import-native.handler.ts` -- Native import handler, alto-index flow
- `src/etl/ImportOrchestrator.ts` -- Import orchestration, progress reporting

### UI patterns
- `src/ui/DataExplorerPanel.ts` -- DataExplorerPanel with Catalog section mount point, onPickAltoDirectory callback
- `src/ui/DirectoryDiscoverySheet.ts` -- showModal() pattern for alto-index directory selection
- `src/ui/AppDialog.ts` -- Reusable modal dialog (confirmation pattern)

### Native bridge
- `src/native/NativeBridge.ts` -- native:request-alto-import handler, security-scoped resource access

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CatalogSuperGrid`: Already renders dataset rows via PivotTable. Actions column can be added to CATALOG_FIELDS array and CatalogProviderAdapter
- `DedupEngine.process()`: Returns complete DedupResult with toInsert/toUpdate/toSkip/deletedIds -- diff preview data is already computed
- `AppDialog`: Reusable modal for both delete confirmation and diff preview
- `ImportToast`: Existing progress UI for import operations
- `CatalogWriter.upsertDataset()`: Upserts by (name, source_type) with ON CONFLICT -- needs per-dataset scoped count fix

### Established Patterns
- Worker message protocol: datasets:query handler returns all rows; new handlers needed for datasets:delete and datasets:reimport
- CatalogSuperGrid event delegation: click handler uses data-row-key from MutationObserver stamping
- DedupEngine source-scoped: loads existing cards WHERE source = ? -- already partition-aware
- Phase 124: alto_index_* normalises to alto_index for DedupEngine lookup

### Integration Points
- CatalogSuperGrid needs actions column rendering + click handlers for delete/re-import buttons
- Worker needs new message types: datasets:delete (remove cards + connections + catalog row) and datasets:reimport (parse + dedup without commit)
- NativeBridge needs to support re-reading a stored directory path (security-scoped bookmark)
- ImportToast -> DiffPreviewDialog handoff: toast closes, modal opens with DedupResult data
- SQLiteWriter commit: existing write path but needs to be callable separately from parse (two-phase)

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- open to standard approaches for the UI. Key implementation note: the two-phase commit for re-import (parse+dedup -> preview -> commit/cancel) requires splitting the current import pipeline so SQLiteWriter runs only after user confirmation.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 125-dataset-lifecycle-management*
*Context gathered: 2026-03-26*
