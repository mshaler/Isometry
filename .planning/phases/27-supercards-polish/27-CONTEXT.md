# Phase 27: SuperCards + Polish - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Aggregation cards at group intersections close the v3.0 milestone. Each row-column intersection in the SuperGrid displays a generated SuperCard showing the COUNT of cards in that group. Performance benchmarks enforce hard budgets on render, query, and reflow operations. Keyboard shortcuts are documented in a help overlay, and right-click context menus provide Sort/Filter/Hide actions on headers.

Requirements: CARD-01 through CARD-05, PLSH-01 through PLSH-05.

</domain>

<decisions>
## Implementation Decisions

### SuperCard Visual Design
- SuperCard REPLACES the existing count badge in matrix mode (not a separate element)
- In spreadsheet mode, SuperCard appears as the first element above card pills
- Content is COUNT ONLY (e.g. "12") — no label, no mini-summary
- Dashed border + italic text per requirements (CARD-02)
- SuperCards are ALWAYS visually distinct from heat map coloring — they do not participate in the d3.interpolateBlues gradient, even in matrix mode
- Background tint (transparent vs subtle gray): Claude's Discretion

### SuperCard Interaction
- Click shows a tooltip with count header + scrollable list of card titles in that intersection
- Tooltip dismissed by clicking outside it (click-away pattern)
- Clicking a card title in the tooltip list SELECTS that card in the grid (adds to SelectionProvider)
- Tooltip stays open for multi-select — user can click multiple card titles
- SuperCards are excluded from ALL selection paths: single click, Cmd+click toggle, Shift+click range, lasso selection, and any future "select all" gesture (CARD-04)
- SuperCards are excluded from FTS search results and card counts (CARD-05)
- `data-supercard` attribute on SuperCard DOM elements for selection exclusion filtering
- Tooltip visual polish (shadow, animation, hover highlights): Claude's Discretion

### Help Overlay + Keyboard Shortcuts
- Triggered by BOTH a '?' button in the SuperGrid toolbar area AND the Cmd+/ keyboard shortcut
- Scope: SuperGrid shortcuts organized by category (Navigation, Selection, Search, Sort, Filter, Zoom)
- Covers all existing shortcuts: Cmd+F (search), Escape (clear), Shift+click (range select), Cmd+click (toggle/period), Cmd+0 (zoom reset), and any others documented in code
- Right-click context menu: CUSTOM styled popup (not native browser context menu)
- Context menu matches SuperGrid visual style, can include icons and shortcut hints
- Context menu items are CONTEXT-AWARE: sort direction reflects current state, "Hide column" becomes "Show hidden (N)" when columns are hidden, filter state shown

### Performance Benchmarks
- Vitest performance tests (`.perf.test.ts` files) with tolerance margins (e.g. 16ms +/- 20%)
- Fixed seed random generator for reproducible synthetic test data
- PLSH-01: 50x50 grid render < 16ms (tolerance ~19.2ms)
- PLSH-02: SuperGridQuery GROUP BY on 10K cards < 100ms (tolerance ~120ms)
- PLSH-03: Axis transpose reflow < 300ms (tolerance ~360ms)
- Tests only — no dev mode FPS overlay or runtime performance indicators
- CI enforcement: block merge on regression (hard guarantee)

### Claude's Discretion
- SuperCard background styling (transparent vs subtle tint)
- Tooltip visual polish level (shadow depth, fade animation, hover states)
- Exact tolerance percentages for performance benchmarks
- Help overlay layout and styling details
- Context menu animation and positioning logic

</decisions>

<specifics>
## Specific Ideas

- SuperCard in matrix mode replaces the existing count badge element — same DOM position, new styling
- Tooltip card list should show card titles (not IDs) — requires fetching title from card_ids
- Context menu should show keyboard shortcut hints next to each action (e.g. "Sort ascending ↑ (click header)")
- Help overlay categories should mirror the actual feature groupings from Phases 19-26

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridQuery.ts`: Already has `COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids` — SuperCard data source is ready
- `SelectionProvider.ts`: Tier 3 ephemeral provider with toggle(), range(), select() — SuperCard exclusion adds a filter check
- `SuperGridSelect.ts`: Lasso selection module — needs SuperCard exclusion via `data-supercard` attribute check
- `SuperGridBBoxCache.ts`: BBox cache for cell dimensions — SuperCards participate in same layout grid
- `SuperGridSizer.ts`: Column width management — no changes needed, SuperCards use existing column widths
- `SortState.ts`: Sort state with Cmd+click multi-sort — context menu "Sort" action wires to existing sort infrastructure
- `SuperZoom.ts`: Zoom with Cmd+0 reset — help overlay documents this shortcut
- `NetworkView.ts`: Only existing tooltip pattern in codebase — can reference for tooltip implementation approach

### Established Patterns
- D3 data join in `_renderCells()`: SuperCards must integrate into the existing `.selectAll('.data-cell').data().join()` pipeline
- `CellDatum` shape `{ card_type, folder, count, card_ids }` — SuperCard reads `count` and `card_ids` directly
- Dashed border pattern from period selection (teal accent `rgba(0,150,136,0.18)`) — similar visual language for SuperCards
- Phase 22 DENS-03 view modes (matrix/spreadsheet) — SuperCard rendering branches on `densityState.viewMode`
- `data-*` attributes on DOM elements (e.g. `data-rowKey`, `data-colKey`) — `data-supercard` follows this convention

### Integration Points
- `_renderCells()` in SuperGrid.ts (~line 1007): Main rendering pipeline where SuperCard DOM generation hooks in
- `.data-cell` D3 selection: SuperCard styling applied in the `.each()` callback based on presence/absence of card data
- `SelectionProvider.select()/.toggle()/.range()`: Need to filter out IDs from SuperCard elements
- Filter/Sort toolbar area: '?' help button added alongside existing toolbar chrome
- Header `contextmenu` event: New listener on col/row header elements for right-click popup

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 27-supercards-polish*
*Context gathered: 2026-03-05*
