# Phase 169: Status Slot - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see live ingestion counts (cards, connections, last import timestamp) in the SuperWidget status slot. Counts update immediately after import/delete/mutation events. The status slot DOM updates without re-rendering the canvas or tab content (STAT-04). No new DataExplorerPanel features; no integration tests (Phase 170).

</domain>

<decisions>
## Implementation Decisions

### Display Layout
- **D-01:** Inline bar — single horizontal row: `42 cards · 18 connections · Imported 2 min ago`. Compact, fits the narrow status slot naturally. Three text spans separated by dot separators.

### Timestamp Format
- **D-02:** Pure relative time — `2 min ago`, `1 hour ago`, `yesterday`. Updated on each refresh cycle (piggybacks on existing `refreshDataExplorer()` cadence). No absolute time fallback.

### Empty / Zero State
- **D-03:** Always show zero counts — `0 cards · 0 connections · No imports yet`. Slot is always visible with consistent layout. No layout shift on first import. "No imports yet" replaces the timestamp when `import_runs` is empty.

### Claude's Discretion
- Who owns the status slot render: ExplorerCanvas (via a `updateStatus()` method) vs a standalone StatusSlot class — pick whichever preserves CANV-06 and slot-scoped updates
- Whether to extend `refreshDataExplorer()` or create a parallel refresh path for status data
- DOM structure within the status slot (spans, separators, class names) — follow existing SuperWidget/DataExplorerPanel conventions
- Relative time formatting implementation (custom formatter vs lightweight utility) — keep it simple, no external dependencies
- SQL query approach: single compound query vs separate COUNT queries — optimize for minimal Worker roundtrips

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Substrate
- `src/superwidget/SuperWidget.ts` — `_statusEl` (line ~73), `statusEl` getter (line ~180), 4-slot grid layout with data-slot="status"
- `src/superwidget/projection.ts` — CanvasComponent interface, Projection type

### Data Sources
- `src/ui/DataExplorerPanel.ts` — `updateStats()` method (line ~134) takes `{ card_count, connection_count, db_size_bytes }` — existing stats shape
- `src/etl/CatalogWriter.ts` — `import_runs` table INSERT (line ~55), catalog query joining import_runs (line ~259)

### Refresh Trigger Pattern
- `src/main.ts` — `refreshDataExplorer()` (line ~688) queries stats via Worker bridge and calls `updateStats()`. Called from 8+ mutation sites (imports, deletes, sample data). This is the existing refresh pattern to extend or parallel.

### ExplorerCanvas (Phase 167-168)
- `src/superwidget/ExplorerCanvas.ts` — Current implementation with tab containers, `getPanel()` accessor
- `.planning/phases/167-explorercanvas-core/167-CONTEXT.md` — D-01 (full panel mount), D-02 (closure capture), D-03 (sidebar removed)
- `.planning/phases/168-tab-system/168-CONTEXT.md` — D-03 (CSS hide/show), D-04 (onProjectionChange)

### Contracts
- `.planning/STATE.md` §Accumulated Context — CANV-06 contract, slot-scoped status updates constraint

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperWidget._statusEl`: Already exists in DOM with `data-slot="status"`, `min-height: 0` CSS, render-count tracking — just needs children
- `refreshDataExplorer()`: Existing refresh pipeline that already queries card_count, connection_count, db_size_bytes from Worker — extend to also update status slot
- `DataExplorerPanel.updateStats()`: Takes the exact stats shape needed for cards + connections — status slot needs the same data plus last import timestamp

### Established Patterns
- Slot-scoped updates: SuperWidget tracks `data-render-count` per slot — status slot update must not increment canvas or tab render counts
- Worker bridge query: `refreshDataExplorer()` sends a bridge message to Worker, receives stats — same pattern for import_runs timestamp query
- DOM convention: `data-slot` attributes on SuperWidget slots, `data-render-count` for tracking

### Integration Points
- `main.ts` `refreshDataExplorer()`: Natural extension point — after updating DataExplorerPanel stats, also update the status slot with the same data plus a timestamp query
- `ExplorerCanvas`: May need a `updateStatus(el)` or similar if status rendering is owned by the canvas rather than main.ts
- Worker bridge: May need a new query or an extended response to include `last_import_at` from `import_runs`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 169-status-slot*
*Context gathered: 2026-04-21*
