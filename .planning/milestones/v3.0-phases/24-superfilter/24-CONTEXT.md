# Phase 24: SuperFilter - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can filter grid contents per column/row axis via auto-filter dropdowns populated instantly from current query results. Covers filter icon triggers, checkbox dropdown UI, active-filter indicators, per-axis and global clearing, and FilterProvider integration. FTS search integration (Phase 25), aggregation cards (Phase 27), and new filter operator types are out of scope.

</domain>

<decisions>
## Implementation Decisions

### Dropdown trigger & placement
- Filter icon uses hover-reveal pattern (opacity 0 → visible on header hover) — same as existing sort icon
- Icon placement relative to sort icon: Claude's discretion based on existing header layout
- Both row and column headers get filter icons (FILT-01: "column or row header")
- Dropdown positioning: Claude's discretion — must account for sticky header constraints and scroll container overflow

### Checkbox interactions
- Text search/filter input at top of dropdown for high-cardinality axes (type-to-filter the checkbox list)
- Left-click toggles checkbox; right-click or Cmd+click does "only this value" (uncheck all others)
- Each checkbox row shows value count from cached supergrid:query result cells (e.g., "Marketing (12)") — no extra Worker query
- Live-update: filter applies immediately as checkboxes change (no "Apply" button)
- Dropdown dismisses on click-outside or Escape key

### Filter indicator & clearing
- Active-filter indicator: filter icon changes from outline/subtle to filled/colored when filter is active on that axis (mirrors sort icon going bold when active)
- Both per-axis clear (Clear button inside each dropdown) and global clear (toolbar or keyboard shortcut)
- Clicking the active-filter indicator opens the dropdown (does NOT immediately clear the filter) — icon always does one thing
- Deselecting all values in a dropdown restores unfiltered state (FILT-05) — treat "nothing selected" same as "everything selected"

### Multi-axis filter behavior
- AND/intersection logic: cell visible only if its row value AND col value are both in selected sets
- Filtered-out values disappear entirely from the grid (grid shrinks to show only matching data)
- Composition order: SuperFilter narrows via SQL WHERE first, then hide-empty (DENS-02) removes zero-count rows/cols from the filtered result
- Filter state persists via FilterProvider/StateManager (Tier 2 persistence) — survives view switches and page refreshes

### Claude's Discretion
- Filter icon placement relative to sort icon (left vs right)
- Dropdown positioning strategy (within scroll container vs floating portal)
- Exact dropdown styling (width, max-height, padding, scrollbar behavior)
- Global "clear all filters" placement (toolbar button, keyboard shortcut, or both)
- Animation/transition for dropdown open/close
- How filter state is represented internally in FilterProvider (new axis-filter concept vs reusing existing Filter type with 'in' operator)

</decisions>

<specifics>
## Specific Ideas

- Excel-style auto-filter pattern: dropdown with checkboxes, search input, Select All / Clear buttons
- Value counts in dropdown leverage cached _lastCells data — zero Worker round-trip on open (FILT-02)
- "Only this value" shortcut (right-click/Cmd+click) — power-user fast isolation
- Filled/colored icon for active state mirrors the sort icon's bold/opacity pattern from Phase 23

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FilterProvider` (src/providers/FilterProvider.ts): Already supports `addFilter()`, `removeFilter()`, `clearFilters()`, `compile()` with `'in'` operator. Can represent axis filters as `{ field: axisField, operator: 'in', value: selectedValues[] }`
- `SuperStackHeader.buildHeaderCells()`: Computes header cells with colStart/colSpan — filter icons attach to these cells
- `SortState` + `_createSortIcon()`: Phase 23 pattern for hover-reveal icons on leaf headers with click handlers and stopPropagation — directly reusable pattern for filter icons
- `WorkerBridge.distinctValues()` + `db:distinct-values` handler: Already exists for fallback when no cached cells available (initial state before first query)
- `SuperGridSizer.addHandleToHeader()`: Pattern for attaching interactive elements to header cells

### Established Patterns
- **Hover-reveal header actions**: Sort icon uses opacity 0 → 0.5 on mouseenter, with rAF-deferred parent event listener attachment. Filter icon should follow identical pattern.
- **Provider → coordinator → re-render**: Mutations go through provider setters, StateCoordinator batches notifications, `_fetchAndRender()` fires. Filter changes should follow this pipeline.
- **queueMicrotask batching**: FilterProvider already batches subscriber notifications — multiple rapid filter changes produce one notification.
- **Allowlist validation**: FilterProvider validates field names via `validateFilterField()` — axis filter fields must be in the allowlist.
- **Client-side filtering from _lastCells**: Hide-empty (DENS-02) already filters `_lastCells` without re-querying. Dropdown population should read from `_lastCells` similarly.

### Integration Points
- `SuperGrid._renderCells()` (line 777+): Where header cells are created — filter icons attach here alongside sort icons
- `SuperGrid._createColHeaderCell()`: Creates individual column header elements — filter icon creation hooks in here
- Row header creation loop (line 937+): Where row header elements are built — filter icons for rows attach here
- `FilterProvider.addFilter()` / `removeFilter()`: Axis filters compile to `field IN (?)` clauses
- `StateCoordinator.subscribe()`: Filter provider changes trigger re-render through existing subscription pipeline
- `_lastCells` cache: Dropdown reads distinct values from this cache for zero-latency open (FILT-02)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 24-superfilter*
*Context gathered: 2026-03-04*
