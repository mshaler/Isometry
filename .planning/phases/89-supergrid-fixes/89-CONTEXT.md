# Phase 89: SuperGrid Fixes - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Three targeted SuperGrid improvements: (1) wire Property Depth control in PropertiesExplorer to re-render cards at selected depth, (2) fix row headers to show full text with ellipsis overflow and drag-resizable width, (3) show dataset name in command bar after Command-K load with brief loading state.

</domain>

<decisions>
## Implementation Decisions

### Row header text + resize
- Overflow text: ellipsis truncation with tooltip on hover showing full text
- Drag-resizable width with persistence via ui_state table (matches SuperGridSizer column width pattern)
- All row header levels share one uniform width — single drag handle, single persisted value
- Constraints: 40px minimum / 300px maximum width
- Default width remains 80px (ROW_HEADER_LEVEL_WIDTH constant becomes the default, not the fixed value)

### Property Depth control
- Depth selector lives inside PropertiesExplorer panel (consistent with existing explorer pattern)
- Control type: dropdown with named levels (e.g., 'Shallow (1)', 'Medium (2)', 'Deep (3)', 'All')
- Default depth = 1 (top-level properties only)
- Depth change triggers immediate re-render (no transition animation) — new supergrid:query with updated column set

### Dataset name display
- Dataset name shown as secondary subtitle text in the command bar area
- Loading state: inline "Loading…" text in subtitle, transitions to dataset name on completion
- Empty state: subtitle area hidden/empty when no dataset is loaded
- No document title update — command bar subtitle only

### Claude's Discretion
- Resize handle visual style (cursor, divider line, drag affordance)
- Exact dropdown named level labels and how many levels to offer
- Tooltip delay and positioning for row header overflow
- How depth maps to SchemaProvider column filtering

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperGrid rendering
- `src/views/SuperGrid.ts` — ROW_HEADER_LEVEL_WIDTH constant, _rowHeaderDepth, _renderCells(), buildGridTemplateColumns()
- `src/styles/supergrid.css` — .row-header.sg-header, .col-header styles

### Resize patterns
- `src/views/SuperGrid.ts` — SuperGridSizer column resize with Pointer Events, ui_state persistence

### Properties Explorer
- `src/ui/PropertiesExplorer.ts` — LATCH-grouped property catalog, field toggles, chip badges
- `src/providers/SchemaProvider.ts` — Runtime PRAGMA introspection, LATCH classification, column metadata

### Command bar
- `src/ui/CommandBar.ts` — App icon, command input, diamond icon callback

### Dataset loading
- `src/sample/SampleDataManager.ts` — evictAndLoad() for dataset replacement flow
- `src/views/CatalogSuperGrid.ts` — Dataset click handler, active row detection

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridSizer`: Column resize with Pointer Events — pattern to replicate for row header resize
- `ui_state` table: Key-value persistence for view state — use for row header width
- `PropertiesExplorer`: Already has LATCH chip badges, select dropdowns, toggle patterns — depth dropdown fits naturally
- `CommandBar`: Has app icon area and click callbacks — subtitle text area needs adding

### Established Patterns
- CSS Grid with sticky headers: Row headers use `position: sticky` with cascading left offsets
- `ROW_HEADER_LEVEL_WIDTH = 80` constant: Currently fixed, needs to become a dynamic default
- Worker bridge supergrid:query: Depth change would modify the SQL column set in the Worker
- Event delegation: SuperGrid uses `.closest()` delegation on gridEl — row header resize should follow same pattern

### Integration Points
- `_renderCells()` in SuperGrid: Where rowHeaderDepth and buildGridTemplateColumns are called — width value flows through here
- `SchemaProvider.getAllAxisColumns()`: Returns column metadata — depth filtering would happen here or in the query builder
- `CommandBar` constructor: Needs subtitle element addition and update method
- `SampleDataManager.evictAndLoad()` / CatalogSuperGrid click handler: Where dataset name becomes available after load

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

*Phase: 89-supergrid-fixes*
*Context gathered: 2026-03-18*
