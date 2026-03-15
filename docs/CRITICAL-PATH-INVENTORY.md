# Critical Path Inventory

## App Starting State (Baseline for ALL Flows)

Every flow below begins from this identical state:

- **Data:** "Meryl Streep Career" sample dataset loaded (47 films, 35 persons, 21 awards, ~140 edges)
- **View:** Timeline (the dataset's `defaultView` — the app auto-navigated here after sample load)
- **Filters:** None active. No axis filters, no range filters, no text search, no time presets
- **Selection:** No card selected (`SelectionProvider` empty)
- **PAFV:** `VIEW_DEFAULTS` for Timeline applied (whatever `pafv.setViewType('timeline')` produces)
- **Panels:** Notebook collapsed, Calc collapsed, Properties/Projection/LATCH expanded (WorkbenchShell defaults)
- **Theme:** System default
- **Notebook:** No card bound (hidden, since no selection)

---

## Flow 0: Cold start -> sample data load -> first render

**Short name:** Cold start renders without race conditions

**Interaction sequence:**
1. App launches fresh (no prior data, no ui_state)
2. Welcome panel appears with "Explore Isometry" heading and "Try: Meryl Streep Career" button
3. User clicks "Try: Meryl Streep Career"
4. Sample SQL seeds the database (47 films, 35 persons, 21 awards, ~140 edges)
5. App auto-navigates to Timeline view (dataset's `defaultView`)
6. Timeline renders with correct card count, no loading spinner persists
7. LATCH panel's Category chips populate with values and counts from the seed data
8. ViewTabBar shows "Timeline" as active tab

**Modules touched:**
`SampleDataManager.load('meryl-streep')` -> `WorkerBridge.importFile('sql', merylStreepSql)` -> `StateCoordinator.scheduleUpdate()` -> `ViewManager.switchTo('timeline')` -> `PAFVProvider.setViewType('timeline')` -> `QueryBuilder.buildCardQuery()` -> `WorkerBridge.send('db:query')` -> `TimelineView.mount()` -> `TimelineView.render(cards)` -> `Announcer.announce()`

Race condition surface: `ViewManager.switchTo()` triggers both an immediate `_fetchAndRender()` AND a `StateCoordinator` subscription callback from `setViewType()`. The second call must not orphan the first timer (the stuck-spinner fix from v4.2).

Parallel: `LatchExplorers.mount()` -> `_fetchAllDistinctValues()` -> `fetchDistinctValuesWithCounts()` (5 fields) -> chip rendering

**Observable success condition:**
Timeline view visible with cards. No loading spinner visible. Tab bar shows Timeline as active. LATCH Category section has populated chips with non-zero counts. No console errors. ARIA announcement fired with card count > 0.

---

## Flow 1: Switch views to explore the same data in different layouts

**Short name:** View switching preserves card count

**Interaction sequence:**
1. User reads the Timeline, notes card count (ARIA label says "X cards")
2. User clicks "SuperGrid" tab in the ViewTabBar (or presses Cmd+9)
3. SuperGrid appears with CSS Grid headers and data cells
4. User clicks "Network" tab (or Cmd+7)
5. Network view appears with force-directed nodes and edges
6. User clicks "List" tab (or Cmd+1)
7. List view appears with all cards in a flat table

**Modules touched:**
`ViewTabBar` -> `ViewManager.switchTo()` -> `PAFVProvider.setViewType()` -> `QueryBuilder.buildCardQuery()` -> `WorkerBridge.send('db:query')` -> `[View].mount()` -> `[View].render()` -> `Announcer.announce()`

For SuperGrid specifically: `SuperGrid.mount()` -> `SuperGrid._fetchAndRender()` -> `WorkerBridge.send('supergrid:query')` (bypasses ViewManager's query path entirely)

For NetworkView: `WorkerBridge.send('graph:simulate')` (off-thread force layout)

**Observable success condition:**
Each view renders with the same card count. Announcer fires "Switched to [View] view, N cards" with identical N. Tab bar highlights the active tab. No loading spinner persists after render.

---

## Flow 2: Filter by category chip -> grid + footer + chart all update

**Short name:** Category filter propagates to grid, footer, and chart

**Interaction sequence:**
1. User switches to SuperGrid (Cmd+9)
2. User opens LATCH panel > Category section
3. Category section shows chip pills for `folder`, `status`, `card_type` fields with count badges
4. User clicks the "Film" chip under the Folder field group
5. Chip turns active (accent background), badge count on Category section shows "1"
6. SuperGrid re-renders showing only Film cards
7. Footer row values change to reflect filtered subset
8. If user had a notebook chart open (see Flow 6), the chart re-queries with the filter

**Modules touched:**
`LatchExplorers._handleChipClick('folder', 'Film')` -> `FilterProvider.setAxisFilter('folder', ['Film'])` -> `StateCoordinator.scheduleUpdate()` -> `SuperGrid._fetchAndRender()` -> `WorkerBridge.send('supergrid:query', {where, params})` -> CSS Grid re-render -> `SuperGrid._renderFooterRow()` -> `WorkerBridge.send('supergrid:calc', {rowAxes, colAxes, where, params, aggregates})`

Parallel: `LatchExplorers._onFilterChange()` -> badge update + chip active state sync + "Clear all" button appears

Parallel (if active): `ChartRenderer.startFilterSubscription()` -> `WorkerBridge.send('chart:query', {where, params})`

**Observable success condition:**
Only cards where `folder = 'Film'` appear in the grid. Footer totals are smaller than before filtering. The "Film" chip has `latch-chip--active` class. The LATCH Category section badge shows "1". The "Clear all" button is visible.

---

## Flow 3: Configure SuperGrid axes via Projection Explorer

**Short name:** Drag axis property -> SuperGrid restructures

**Interaction sequence:**
1. User switches to SuperGrid (Cmd+9)
2. User opens Projection Explorer panel
3. User sees X well with `card_type` chip, Y well with `folder` chip, Available well with remaining chips
4. User drags `status` from Available well into X well
5. SuperGrid re-renders with 2-level column headers (card_type x status)
6. Cell counts redistribute across the new axis grid
7. User drags `card_type` from X well back to Available well
8. SuperGrid re-renders with only `status` as col axis

**Modules touched:**
`ProjectionExplorer._handleBetweenWellMove('status', 'available', 'x')` -> `PAFVProvider.setColAxes([...existing, {field:'status', direction:'asc'}])` -> `StateCoordinator.scheduleUpdate()` -> `SuperGrid._fetchAndRender()` -> `WorkerBridge.send('supergrid:query', {colAxes: [{card_type}, {status}], rowAxes: [{folder}]})` -> `buildHeaderCells()` -> CSS Grid header rendering

Also: `CalcExplorer._render()` (re-renders dropdowns for new axis fields via PAFVProvider subscription)

**Observable success condition:**
Column headers show nested structure matching the new axes. Cell counts total to the same N as before (no cards lost or duplicated). CalcExplorer dropdown list updates to include the newly-assigned field.

---

## Flow 4: Select a card -> Notebook loads content

**Short name:** Card selection drives notebook binding

**Interaction sequence:**
1. User switches to Network view (Cmd+7)
2. User clicks a node (e.g., "Sophie's Choice")
3. NotebookExplorer panel becomes visible (was hidden with no selection)
4. Write tab shows an empty textarea (no prior notebook content for this card)
5. User types "# My notes on this film"
6. After 500ms, content auto-saves to `ui_state` via bridge
7. User clicks a different node ("Kramer vs. Kramer")
8. Notebook flushes "Sophie's Choice" content, loads "Kramer vs. Kramer" content (empty if new)

**Modules touched:**
`NetworkView` click handler -> `SelectionProvider.select(cardId)` -> `NotebookExplorer._onSelectionChange()` -> flush old: `WorkerBridge.send('ui:set', {key: 'notebook:oldId', value})` -> show panel: `_setVisible(true)` -> load new: `WorkerBridge.send('ui:get', {key: 'notebook:newId'})` -> textarea update

**Observable success condition:**
Notebook appears when first card is selected. Content changes when switching cards. Returning to first card shows the previously typed content (round-trip through `ui_state`). No flash of stale content during card switch.

---

## Flow 5: Write notebook with chart block -> preview renders D3 chart

**Short name:** Chart block renders in preview with current filters

**Interaction sequence:**
1. User has a card selected (from Flow 4 or any view)
2. User opens Notebook panel, Write tab is active
3. User types a chart code block:
   ````
   ```chart
   type: bar
   x: card_type
   ```
   ````
4. User clicks "Preview" tab
5. Markdown renders; chart placeholder becomes a D3 bar chart
6. Chart shows card_type distribution for the current (unfiltered) dataset
7. User applies a filter in LATCH (e.g., folder = "Film")
8. Chart re-queries and re-renders with filtered data (live update)

**Modules touched:**
Tab switch: `NotebookExplorer._switchTab('preview')` -> `_renderPreview()` -> `marked.parse()` -> `DOMPurify.sanitize()` -> `ChartRenderer.mountCharts()` -> parse `data-chart-config` -> `WorkerBridge.send('chart:query', {chartType:'bar', xField:'card_type', ...})` -> D3 SVG render into placeholder div

Filter live update: `ChartRenderer.startFilterSubscription()` -> `FilterProvider.subscribe()` -> 300ms debounce -> re-query with new `where`/`params` -> generation counter check -> D3 SVG re-render

**Observable success condition:**
Preview tab shows a rendered bar chart (SVG inside `.notebook-chart-card` div). Chart labels match the `card_type` values in the dataset. After filtering, chart bars change to reflect only filtered cards. Generation counter prevents stale results from overwriting current chart.

---

## Flow 6: Apply histogram scrubber -> cross-component filter update

**Short name:** Histogram brush filters all views

**Interaction sequence:**
1. User switches to SuperGrid (Cmd+9)
2. User opens LATCH panel > Hierarchy section
3. Histogram scrubber appears under the "Priority" field
4. User drags a brush across the histogram selecting priority range 2-4
5. All views re-render showing only cards with priority between 2 and 4
6. SuperGrid footer updates to reflect filtered subset
7. LATCH "Clear all" button appears
8. Category chip counts update (some decrease)

**Modules touched:**
`HistogramScrubber._onBrushEnd()` -> `FilterProvider.setRangeFilter('priority', {min:2, max:4})` -> `StateCoordinator.scheduleUpdate()` -> `SuperGrid._fetchAndRender()` -> `WorkerBridge.send('supergrid:query', {where: '...AND priority >= ? AND priority <= ?', params: [2, 4]})` -> CSS Grid re-render

Parallel: `LatchExplorers._onFilterChange()` -> badge update, clear-all visibility
Parallel: `LatchExplorers.update()` -> `fetchDistinctValuesWithCounts()` re-queries (counts change under range filter)
Parallel: `HistogramScrubber._renderHistogram()` preserves brush selection visual

**Observable success condition:**
Only cards with priority in [2, 4] appear. Histogram shows active brush highlight. Badge on Hierarchy section shows "1". SuperGrid footer totals match the filtered subset. Chip counts in Category section decrease to reflect fewer visible cards.

---

## Flow 7: Text search -> filter propagation across views

**Short name:** Alphabet search filters card list

**Interaction sequence:**
1. User is on any view (e.g., List view, Cmd+1)
2. User opens LATCH panel > Alphabet section
3. User types "Sophie" in the search input
4. After 300ms debounce, the view re-renders showing only cards whose `name` contains "Sophie"
5. Badge on Alphabet section shows "1"
6. User clears the input (backspace to empty)
7. All cards reappear

**Modules touched:**
`LatchExplorers._populateAlphabet()` input listener -> 300ms debounce -> `_handleSearchInput('Sophie')` -> `FilterProvider.addFilter({field:'name', operator:'contains', value:'Sophie'})` -> `StateCoordinator.scheduleUpdate()` -> `ViewManager._fetchAndRender()` -> `QueryBuilder.buildCardQuery()` (compiles FTS5 or LIKE clause) -> `WorkerBridge.send('db:query')` -> `[View].render()`

**Observable success condition:**
Only cards with "Sophie" in name render. Card count in announcer matches the filter. Clearing the input restores full dataset. Badge appears/disappears correctly.

---

## Flow 8: Configure footer aggregation via CalcExplorer

**Short name:** Calc aggregation mode change updates footer

**Interaction sequence:**
1. User switches to SuperGrid (Cmd+9)
2. User expands the Calc panel (collapsed by default)
3. CalcExplorer shows dropdowns for each axis-assigned field (e.g., Folder: COUNT, Priority: SUM)
4. User changes Priority from SUM to AVG
5. Footer row updates: Priority column now shows AVG(priority) per column group
6. User changes Priority to OFF
7. Priority column disappears from footer row

**Modules touched:**
`CalcExplorer` select change -> `_config.columns['priority'] = 'avg'` -> `_persist()` (debounced 300ms -> `WorkerBridge.send('ui:set', {key:'calc:config'})`) -> `_onConfigChange(config)` -> `StateCoordinator.scheduleUpdate()` -> `SuperGrid._fetchAndRender()` -> `SuperGrid._renderFooterRow()` -> `WorkerBridge.send('supergrid:calc', {rowAxes, colAxes, where, params, aggregates: {priority:'avg'}})` -> footer cells populated

**Observable success condition:**
Footer values change from SUM to AVG (numbers get smaller for priority). Setting to OFF removes the field from the footer entirely. Config persists: refreshing the page and returning to SuperGrid shows the same AVG setting.

---

## Flow 9: Network node click -> exclusive selection + notebook sync

**Short name:** Network click selects exclusively, notebook follows

**Interaction sequence:**
1. User switches to Network view (Cmd+7)
2. Force layout stabilizes, nodes and edges appear
3. User clicks node A -- it highlights, notebook panel shows and binds to card A
4. User clicks node B (standard click, no modifier key) -- node A deselects, node B highlights, notebook switches to card B
5. User Shift-clicks node C -- nodes B and C are both selected (multi-select), notebook shows card B (first selected)
6. User standard-clicks node D -- only node D selected (exclusive), notebook switches to card D

**Modules touched:**
Click: `NetworkView` click handler -> modifier check -> `SelectionProvider.select(B)` (exclusive) or `SelectionProvider.toggle(C)` (with Shift/Cmd/Ctrl) -> `NotebookExplorer._onSelectionChange()` -> flush/load cycle -> notebook content update

**Observable success condition:**
Standard click always results in exactly 1 selected node. Shift/Cmd/Ctrl click adds to selection. Notebook always binds to the first selected card ID. The previously active card's notebook content is flushed before loading the new card. No chart disappearance on click (Bug #6 scenario prevented).

---

## Flow 10: Clear all filters -> verify full reset

**Short name:** Clear all restores unfiltered state

**Interaction sequence:**
1. User has multiple active filters: a category chip (folder = Film), a text search ("Sophie"), and a histogram brush (priority 2-4)
2. SuperGrid shows a small subset of cards
3. User clicks "Clear all" in LATCH panel
4. All filters removed: axis filters, text search, range filters, histogram brushes
5. SuperGrid re-renders showing all cards
6. All chip active states cleared, all badges = 0, search input cleared
7. Histograms re-render without brush selection
8. "Clear all" button disappears

**Modules touched:**
`LatchExplorers._handleClearAll()` -> `FilterProvider.clearAllAxisFilters()` -> `FilterProvider.removeFilter()` (name contains) -> `FilterProvider.clearRangeFilter()` (priority, time fields) -> `HistogramScrubber.clearBrush()` -> `StateCoordinator.scheduleUpdate()` -> all views re-query -> `LatchExplorers._onFilterChange()` -> badge/chip/visibility updates

**Observable success condition:**
Card count returns to full dataset count. No chips have active state. No badges show counts. Search input is empty. No histogram has a brush selection. "Clear all" button is hidden. Footer totals match unfiltered aggregation.

---

## Flow 11: Compound filter -> verify conjunction correctness

**Short name:** Multiple filter types compose correctly

**Interaction sequence:**
1. User clicks "Film" chip in Category (folder = Film)
2. Card count drops (only Film cards)
3. User types "Meryl" in Alphabet search
4. Card count drops further (Film cards whose name contains "Meryl")
5. User clicks "This Year" preset in Time section on `created_at`
6. Card count drops further (Film cards named "Meryl" created this year)
7. User removes the "Film" chip (click again to toggle off)
8. Card count increases (all card types named "Meryl" created this year)

**Modules touched:**
Each filter step: `FilterProvider.setAxisFilter()` or `.addFilter()` -> `QueryBuilder.buildCardQuery()` compiles compound WHERE clause (axis filter AND FTS/LIKE AND date range) -> `WorkerBridge.send('db:query', {sql, params})` -> `[View].render()`

Chip toggle off: `FilterProvider.setAxisFilter('folder', [])` -> rebuilds WHERE without folder clause

**Observable success condition:**
At each step, card count strictly decreases (conjunction narrows). Removing one filter broadens results. The count after removing "Film" is greater than before but less than removing all filters. All three filter badges are independently visible. Each view (if switched to) shows the same filtered subset.
