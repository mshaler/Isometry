# Phase 23: SuperSort - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-group header sort cycle with multi-sort priority and visual indicators. Users can click column or row headers to sort grid contents; sort stays within groups and does not cross group boundaries. Requirements: SORT-01, SORT-02, SORT-03, SORT-04.

</domain>

<decisions>
## Implementation Decisions

### Click-to-sort interaction
- Dedicated sort icon button (e.g., `⇅`) added to each leaf header — NOT a modifier on existing click
- Sort icon sits to the right of the header label text
- Icon appears on header hover only; active sorts stay visible always (Notion/Linear pattern)
- Both column AND row headers support sorting — full parity
- Existing click behaviors are preserved unchanged: plain click = collapse/expand, Cmd+click = select all cards

### Multi-sort UX
- Cmd+click the sort icon = add to multi-sort chain
- Plain click the sort icon = single-sort (replaces any existing sort)
- Multi-sort priority shown as numbered badges: ▲¹ ▼² ▲³
- Third click on sort icon cycles to unsorted (asc → desc → none), removing that field from the sort list
- A "Clear all sorts" button also appears in the header area when any sort is active (belt and suspenders)
- Claude's discretion on max simultaneous sort fields

### Sort indicators (▲/▼)
- Only leaf (innermost) header level gets sort icons — parent spanning headers never have sort controls
- Inactive state: subtle `⇅` on hover, nothing visible when not hovering and no sort active
- Active state: bold ▲ or ▼ with numbered priority superscript
- Claude's discretion on text characters vs SVG icons
- Claude's discretion on whether sorted headers get a background tint

### Sort-within-groups boundary
- Group headers stay in their axis-determined order (PAFVProvider direction) — only cards WITHIN each group reorder
- Sort state persists when collapsed headers are expanded — sort is global, not per-group
- Sort state lives in PAFVProvider and round-trips through toJSON()/setState() — survives view switches and session restores
- When DensityProvider collapses time fields (e.g., day → month), sort operates within each time group independently — time grouping is always the outer boundary (consistent with SORT-04)

### Claude's Discretion
- Sort icon visual style (Unicode vs SVG)
- Whether sorted headers get a subtle background highlight
- Maximum number of simultaneous sort fields (suggested: 3 matching axis depth)
- Loading skeleton or transition during sort re-query
- SortState class internal structure and API surface
- How sortOverrides integrates with existing ORDER BY in buildSuperGridQuery

</decisions>

<specifics>
## Specific Ideas

- Sort interaction should feel like Google Sheets / Notion — click a column header sort icon, see immediate reorder with arrow indicator
- Multi-sort priority numbering (▲¹ ▼²) matches Google Sheets multi-column sort visual language
- Hover-to-reveal sort icon keeps headers clean when not actively sorting

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperStackHeader.buildHeaderCells()` — run-length spanning algorithm generates `HeaderCell[]` per level with `colStart`, `colSpan`, `isCollapsed`. Sort icons attach to leaf-level cells only.
- `SuperGridQuery.buildSuperGridQuery()` — already generates ORDER BY from axis directions. `sortOverrides` extends this (research doc STACK.md already identifies the pattern: add `sortOverrides?: Array<{ field: AxisField; direction: 'asc' | 'desc' }>` to `SuperGridQueryConfig`).
- `validateAxisField()` — existing allowlist validation for SQL safety. All sort fields must pass through this.
- `ListView.SortState` — existing sort state interface in ListView (`{ field: SortField; direction: SortDirection }`). Can inform SuperSort's SortState class design.
- `PAFVProvider` — already handles stacked axis state with `toJSON()`/`setState()` serialization. Sort state should follow the same persistence pattern.

### Established Patterns
- Header click handlers: `SuperGrid.ts` lines 1389-1415 show existing plain click = collapse, Cmd+click = selection pattern. Sort icon is a new child element with its own click handler (stopPropagation prevents bubble to collapse handler).
- Coordinator subscription: `_fetchAndRender()` fires on state change. Sort state changes should trigger this same cycle — modify sort → coordinator notifies → _fetchAndRender() → buildSuperGridQuery with sortOverrides → _renderCells().
- D3 data join for cells: `_renderCells()` uses D3 enter/update/exit. Sort changes cause re-query (new ORDER BY) → new CellDatum[] → D3 join re-renders.

### Integration Points
- `SuperGridQueryConfig` — extend with `sortOverrides` field for ORDER BY injection
- `supergrid.handler.ts` — passes config to `buildSuperGridQuery()`, sort fields flow through automatically
- `PAFVProvider` state — add sort array to serializable state
- `StateCoordinator` subscription — sort changes trigger re-render via existing subscription path
- Header DOM creation (`_renderCells` header section, lines ~1350-1418) — add sort icon element to leaf header cells

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 23-supersort*
*Context gathered: 2026-03-04*
