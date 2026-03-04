# Pitfalls Research

**Domain:** SuperGrid Complete — adding 13 interactive Super* features to existing CSS Grid + D3 data join system
**Researched:** 2026-03-03
**Confidence:** HIGH — pitfalls derived from first principles against the actual existing codebase (SuperGrid.ts, SuperStackHeader.ts, SuperGridQuery.ts, PAFVProvider.ts, Providers.md), verified against official D3, SQLite FTS5, and browser rendering documentation; LOW for HyperFormula-specific integration (limited published post-mortems)

---

## Critical Pitfalls

### Pitfall 1: PAFVProvider Stacked-Axes Shape Mismatch Breaks the Foundation Phase

**What goes wrong:**
The existing PAFVProvider stores `xAxis: AxisMapping | null`, `yAxis: AxisMapping | null`, `groupBy: AxisMapping | null` — exactly one field per plane. SuperGrid needs `rowAxes: AxisMapping[]` and `colAxes: AxisMapping[]` (arrays supporting 1–3 stacked levels). If the Foundation phase extends PAFVProvider without changing the shape, every downstream Super* feature that reads `pafvProvider.compile()` continues receiving flat single-axis SQL. The SuperGrid renderer gets no GROUP BY for stacked axes. The grid renders as a single-level flat grid even though PAFV state has multiple axes configured.

**Why it happens:**
The existing compile() method is clean and correct for the 8 other views. Extending it for SuperGrid stacked axes is additive work, not a replacement. Developers underestimate this and add `rowAxes`/`colAxes` to PAFVState without also updating compile(), getProjectionSQL(), and the persistence serialization format — leaving the old single-axis path as the fallback.

**How to avoid:**
In the Foundation phase, define a SuperGrid-specific method on PAFVProvider: `getStackedGroupBySQL(): { rowSQL: string; colSQL: string }` that is separate from the existing compile() path used by other views. Never try to make compile() handle both flat and stacked cases. Keep backward compatibility by keeping the old fields for the 8 other views. The stacked shape lives inside `grouping: { rowAxes: AxisMapping[], colAxes: AxisMapping[] }` as already specified in Providers.md, but that sub-field must be wired to the actual SuperGrid renderer — not just persisted.

**Warning signs:**
- SuperGrid renders as a 2-column flat grid regardless of how many axes are configured in the axis picker
- `pafvProvider.compile()` returns a GROUP BY with only one field per dimension
- PAFVProvider persistence tests pass but SuperGrid integration tests show wrong axis count
- Adding a second row axis appears to have no visual effect on the grid

**Phase to address:** Foundation phase (first phase) — before any other Super* feature. All other features assume PAFVProvider correctly exposes stacked axes. Getting this wrong here forces rewrites in every subsequent phase.

---

### Pitfall 2: Worker Query Latency Accumulates — Each Provider Change Triggers a Separate Round-Trip

**What goes wrong:**
SuperGrid has 4 providers that all trigger re-queries: FilterProvider, PAFVProvider, DensityProvider, and (for highlights) a new search query channel. The StateCoordinator batches within 16ms, but a single user interaction that touches two providers (e.g., changing a filter that also affects density) triggers two Worker round-trips in the same frame. At 50 columns × 50 rows (2,500 cells) with FTS highlighting, each round-trip takes 10–80ms in sql.js WASM depending on query complexity. Two round-trips stall the frame. The UI appears to freeze on rapid axis changes.

**Why it happens:**
StateCoordinator coalesces at the JavaScript layer (16ms setTimeout), but the coalesced "sources" array still causes the renderer to issue one `workerBridge.query()` per source type (filter query + density query + search query), not one batched query. The existing pattern is: `if (sources.includes('filter') || sources.includes('pafv')) requery()` — this issues only ONE requery, which is correct. The trap is adding a separate search-highlight requery path that runs independently of the main data requery.

**How to avoid:**
SuperGrid must issue exactly one Worker round-trip per rendered frame. All SQL fragments (WHERE from FilterProvider, GROUP BY from PAFVProvider, density level from DensityProvider, FTS rowids from search) must be assembled into a single compound query before sending to the Worker. Build a `SuperGridQuery` composer that takes compiled fragments from all providers and produces one SQL string. Wire SuperSearch to append a `WHERE rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` clause to the same query — not a separate query.

**Warning signs:**
- Performance profiler shows multiple `workerBridge.query()` calls per animation frame
- Grid flickers during rapid filter changes (partial data renders between two round-trips)
- Frame budget exceeded (>16ms) on moderate datasets (500–1000 cards)
- Adding FTS search causes visible latency spike even on small datasets

**Phase to address:** Foundation phase (Worker wiring). Establish the single-query contract before any feature adds a second query path. Every subsequent Super* phase must comply with the one-query-per-frame contract.

---

### Pitfall 3: CSS Grid `grid-template-columns` Mutation Causes Full Layout Recalculation on Every Render

**What goes wrong:**
The current SuperGrid.render() sets `grid.style.gridTemplateColumns` on every call. When SuperDensity collapses a time hierarchy (Month → Quarter), the leaf column count changes. When SuperSize resizes a column, the template string changes. When SuperDynamic reorders axes, the template rebuilds. Each mutation to `grid-template-columns` forces the browser to recalculate the entire grid layout — including all N×M cell positions. At 50 columns × 50 rows (2,500 cells) with explicit `grid-column` and `grid-row` on every cell, this is O(N×M) style recalculation. On low-end hardware (iOS with heavy WebView overhead), this exceeds 16ms at 30+ columns.

**Why it happens:**
Developers set the column template and then individually place every cell with inline `style.gridColumn` and `style.gridRow`. Both mutations happen in the same script task. Browsers batch style reads (they don't thrash), but the grid template recalculation is expensive because it invalidates ALL child layout simultaneously. The existing implementation (SuperGrid.ts line 145 and 154) already does this — it works at current card counts but breaks at high cardinality.

**How to avoid:**
Two strategies, both required together. First: cache the previous `gridTemplateColumns` string and skip setting it if unchanged. Second: use CSS Custom Properties to drive column widths for SuperSize instead of rebuilding the template string. Set `--col-width-Jan: 80px` and use `repeat(auto columns, var(--col-width))` where possible so width changes don't require rebuilding the template. For columns that genuinely change count (axis reorder, density collapse), accept the full recalc but ensure it happens at most once per frame via the StateCoordinator 16ms batch.

**Warning signs:**
- Browser DevTools "Layout" time spikes >8ms on density changes
- Resize handle drag produces visible jank at 30+ columns
- Chrome Performance panel shows repeated "Recalculate Style" entries within a single frame
- Frame budget exceeded exclusively on density-level changes (not on data changes)

**Phase to address:** SuperDensity phase (the first phase that changes column count). Also add a performance benchmark for 50 columns during this phase.

---

### Pitfall 4: HTML5 Drag-and-Drop Cannot Read DataTransfer During `dragover` — Axis Drop Target Breaks

**What goes wrong:**
SuperDynamic uses HTML5 drag-and-drop to reposition axis headers. The natural implementation stores the dragged axis descriptor in `event.dataTransfer.setData('text/plain', JSON.stringify(axisDescriptor))`. The drop target's `dragover` handler tries to read `event.dataTransfer.getData('text/plain')` to determine what is being dragged (and whether this drop zone accepts it). This always returns an empty string. The drop zone cannot conditionally accept or reject the drag. Visual feedback (highlight the correct drop zone, dim invalid zones) is impossible with this pattern.

**Why it happens:**
This is a browser security restriction: `dataTransfer.getData()` is intentionally blocked during `dragenter` and `dragover` events. It only returns data in `drop` and `dragend` handlers. This is a well-known HTML5 DnD limitation that the Kanban implementation (which uses HTML5 DnD) did not encounter because Kanban only has one type of draggable item. SuperDynamic has different item types (row axis, column axis, filter axis) that need discriminated drop zones.

**How to avoid:**
Use a module-level variable as the drag state carrier, not dataTransfer. Before starting a drag, write `currentDragPayload = { axisType: 'rowAxis', field: 'folder' }` to a module singleton. The `dragover` handler reads from the singleton instead of from dataTransfer. Clean up the singleton in `dragend` regardless of whether drop succeeded. This is the same pattern used by React DnD, Sortable.js, and AG Grid internally.

```typescript
// Module singleton — not dataTransfer
let dragPayload: { axisType: 'row' | 'col' | 'filter'; field: string } | null = null;

header.addEventListener('dragstart', (e) => {
  dragPayload = { axisType: 'row', field: cell.field };
  e.dataTransfer!.effectAllowed = 'move';
});

dropZone.addEventListener('dragover', (e) => {
  if (dragPayload?.axisType === 'row') {  // Works: singleton readable
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'move';
    dropZone.classList.add('drop-active');
  }
});
```

**Warning signs:**
- Drop zones highlight for ALL drag operations regardless of item type
- Cannot distinguish "dragging a row axis" from "dragging a column axis" during hover
- `dataTransfer.getData()` returns `''` in `dragover` — this is correct browser behavior, not a bug
- Identical symptom to the Kanban KanbanView drag implementation that used HTML5 DnD

**Phase to address:** SuperDynamic phase. Write the drag payload singleton before any other DnD feature attempts to add visual discrimination.

---

### Pitfall 5: FTS5 Highlight Overwrites D3-Managed DOM — Data Join Key Collision

**What goes wrong:**
SuperSearch finds matching cards via FTS5 and highlights their cell content by injecting `<mark>` tags around matched text. The implementation mutates `el.innerHTML` directly inside cells. On the next D3 data join cycle (triggered by any provider change), D3's update selection overwrites the cell's content by re-running the `.each()` callback — erasing the `<mark>` tags. Alternatively, if the highlight sets `innerHTML` with `<mark>` and D3 later calls `innerHTML = newContent`, the highlight flickers on every upstream state change. The practical result: highlights disappear on the next render cycle.

**Why it happens:**
D3 data joins own the DOM inside each `.data-cell` element. Any direct DOM mutation to cells that are in D3's selection is overwritten on the next render. The existing SuperGrid `.each()` callback sets `el.innerHTML` directly (lines 280–283 in SuperGrid.ts). Search highlight wants to modify the same innerHTML. Two writers, one DOM node — last write wins.

**How to avoid:**
Never let SuperSearch mutate innerHTML inside D3-managed cells. Instead, track search state as data — add a `matchedTerms: string[]` property to CellDatum. The D3 `.each()` callback is the only writer to cell innerHTML. If `d.matchedTerms.length > 0`, the callback wraps matched text in `<mark>` during its own pass. This means: SuperSearch queries FTS5, collects matching card IDs, updates a `searchMatchSet: Set<string>` on the renderer, and the next D3 render cycle (which runs immediately via the search state notification) produces `<mark>`-decorated content. No secondary DOM writer exists.

**Warning signs:**
- Search highlights appear briefly then disappear on mouse move or filter change
- Highlight reappears only after typing another character in the search box
- No highlights after the first axis change after a search
- Browser DevTools shows innerHTML being set twice per render on matched cells

**Phase to address:** SuperSearch phase. Also relevant to SuperAudit (which similarly wants to decorate cells with computed-value indicators).

---

### Pitfall 6: Selection Lasso in CSS Grid Requires Explicit Coordinate Mapping — `getBoundingClientRect()` Per Cell is O(N×M)

**What goes wrong:**
SuperSelect's lasso draws an SVG rubber-band overlay and then tests whether each data cell intersects the lasso polygon. The straightforward implementation calls `el.getBoundingClientRect()` for every `.data-cell` element inside the `mousemove` handler. At 50 columns × 50 rows = 2,500 cells, 2,500 `getBoundingClientRect()` calls per mouse move event (which fires at 60Hz) = 150,000 layout queries per second. The browser serializes these queries, forcing synchronous layout. The main thread stalls. Lasso drag is completely unusable.

**Why it happens:**
`getBoundingClientRect()` forces a synchronous style recalculation and layout flush to return current coordinates. Calling it in a loop inside an event handler defeats the browser's batching. This is the single most common performance mistake in custom selection implementations.

**How to avoid:**
Build a cell coordinate cache that is computed once after each render (not per mouse event). After every D3 render cycle, iterate all `.data-cell` elements once, call `getBoundingClientRect()` in a single batch pass, and store results in a `Map<string, DOMRect>` keyed by cell key (`rowKey:colKey`). The lasso mousemove handler reads from the cache. Invalidate the cache on render (axis change, density change, resize). The mousemove handler is then pure arithmetic — no DOM reads.

```typescript
// Built once after D3 render, before any lasso interaction
private rebuildCellCache(): void {
  this.cellCache.clear();
  for (const el of this.gridEl!.querySelectorAll<HTMLElement>('.data-cell')) {
    const key = el.dataset['key']!;
    this.cellCache.set(key, el.getBoundingClientRect());
  }
}
```

**Warning signs:**
- Lasso drag causes visible CPU spike in browser DevTools
- Chrome Performance panel shows "Forced synchronous layout" inside mousemove handlers
- Lasso feels "laggy" — the rubber-band rect renders fine but selection updates are delayed
- The freeze worsens linearly with column × row count (50×50 is 25× worse than 10×10)

**Phase to address:** SuperSelect phase. Establish the cache pattern before the lasso implementation to prevent the O(N×M) per-event-handler mistake.

---

### Pitfall 7: SuperZoom Pan-Lock Breaks When `overflow: auto` Scroll and D3 Zoom Transform Coexist

**What goes wrong:**
The existing SuperGrid uses `overflow: auto` on the root div for scrolling (SuperGrid.ts line 84). SuperZoom wants to add pinch-to-zoom with a fixed upper-left anchor. If SuperZoom applies a D3 zoom transform (scale + translate) to the grid container, the CSS `overflow: auto` scroll and the D3 transform conflict: scrolling moves the container within its parent viewport, D3 zoom scales the container relative to its own origin. The two coordinate systems diverge. The "pinned upper-left" behavior breaks: zooming in causes the upper-left corner to drift right and down instead of staying fixed. The grid also allows scrolling past its boundaries, violating the "no overscroll" requirement.

**Why it happens:**
D3's built-in zoom transform (`d3.zoom()`) anchors to the cursor by default and uses an SVG `transform` attribute — it was designed for SVG viewports. CSS Grid containers don't have an SVG coordinate system. Applying a CSS `transform: scale()` to a scrollable container creates a new stacking context and breaks scroll boundary detection. The two paradigms (CSS overflow scroll vs. CSS transform zoom) are not designed to compose.

**How to avoid:**
Do not use D3's zoom on the CSS Grid container. Instead, implement SuperZoom as a scale-factor applied to CSS Custom Properties and explicit pixel values. When the user zooms in by factor F: multiply all column widths by F (update `--col-width` CSS custom properties), multiply all row heights by F. The scroll container stays as-is. "Upper-left anchor" is achieved because growing column widths pushes content rightward/downward from the upper-left — no transform needed. Pan is standard browser scroll. Boundary enforcement uses `scrollLeft` and `scrollTop` bounds checking.

**Warning signs:**
- Zooming in causes the top-left header to visually shift rather than stay pinned
- Scrolling becomes erratic after a zoom change — can scroll past last column
- Row headers (column 1) stay in place but column headers scroll away (stacking context bug)
- Zoom → scroll → zoom produces compounding position drift

**Phase to address:** SuperZoom phase. Architectural decision must be made before the first zoom prototype commit. Retrofitting from D3 transform to CSS custom property approach after implementation is a full rewrite.

---

### Pitfall 8: Density Collapse Changes Column Count, Breaking All Explicit `grid-column` Placements

**What goes wrong:**
When SuperDensity collapses January/February/March into Q1 (one leaf column instead of three), the `colStart` values for all subsequent columns shift. The existing SuperStackHeader.buildHeaderCells() correctly recomputes `colStart` values — but only for the header cells it returns. Data cells are placed using `colStart` values captured at render time. If the density change re-renders headers but reuses stale data cell positions (because the D3 update selection skips DOM-identical cells), data cells end up in wrong columns. A card that was in "March" (colStart=4) now occupies column 4 in a grid where column 4 is "Q2" — data appears in the wrong cell.

**Why it happens:**
The D3 data join key `d.rowKey + ':' + d.colKey` identifies cells by their axis value, not their CSS grid position. When the same cell datum (rowKey:'Work', colKey:'March') still exists after a density collapse but its `colStart` has shifted, the D3 update selection (which correctly identifies it as an existing cell) runs the update callback — but the update callback must still call `el.style.gridColumn = newColStart`. If the developer forgets to update `gridColumn` in the update path (only sets it in the enter path), the cell stays at its old grid position.

**How to avoid:**
In the D3 data join, always update `gridColumn` and `gridRow` in both the `enter` join function AND the merged update selection's `.each()` callback. Never assign grid placement only in `enter`. After any density change, the entire cell coordinate map is stale. The cell coordinate cache (from Pitfall 6) must be invalidated and rebuilt. Add a test: "collapse Month→Quarter, verify data cells for 'Engineering' row appear in Q1 column not in column 4."

**Warning signs:**
- After density collapse, some cells appear in wrong columns (off by the number of collapsed leaves)
- Data cells for visible axis values suddenly overlap header cells
- The header renders correctly after collapse but data cells are misaligned
- The bug disappears after a full re-render triggered by an unrelated data change

**Phase to address:** SuperDensity phase. Write the density-change cell-alignment test before implementing any density controls.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Storing column widths in inline `style.width` on cells | Simple resize implementation | SuperZoom can't read width uniformly; drag resize duplicates width state | Never — use CSS Custom Properties from SuperSize phase onward |
| Calling `this.render(this.lastCards)` for collapse toggle (existing code) | Simple re-render path | Bypasses Worker query cycle — collapse state diverges from actual data when cards mutate during collapse | Acceptable only until Worker wiring is complete; remove in Foundation phase |
| Treating `colStart` as derived-at-render-time | Avoids a coordinate store | Density collapse invalidation requires full recompute; breaks if colStart is cached anywhere else | Never cache colStart — always derive from `buildHeaderCells()` output |
| SuperSearch issuing a separate `workerBridge.query()` for FTS | Simple code path | Two Worker round-trips per search keystroke; violates one-query-per-frame contract | Never — fold FTS rowid clause into the main SuperGridQuery |
| HyperFormula instance initialized eagerly at app load | Available immediately | HyperFormula is ~500KB bundle; delays WASM initialization if loaded before sql.js completes | Never — lazy-load via dynamic `import()` only when first formula is entered |
| Storing selection as a Set of `rowKey:colKey` strings | Simple SuperSelect implementation | Selection becomes stale when density changes collapse the cell key (Q1 vs Jan); requires invalidation on density change | Acceptable if selection is cleared on every density/axis change (Tier 3 ephemeral) |

---

## Integration Gotchas

Common mistakes when connecting Super* features to existing providers and the Worker bridge.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| PAFVProvider stacked axes → SuperGridQuery | Reading `pafvProvider.compile()` which returns flat single-axis SQL | Use `pafvProvider.getStackedGroupBySQL()` — a new method returning `{ rowSQL: string; colSQL: string }` |
| DensityProvider collapse → SuperStackHeader | Passing `densityProvider.getDensitySQL()` result directly as a GROUP BY field | Pass density level to a dedicated `buildDensityAxisValues()` helper that generates the correct time bucket tuples for `buildHeaderCells()` input |
| SelectionProvider → 2D grid | Using `orderedIdsGetter()` (linear) for Shift+click range selection | Range selection in a 2D grid requires a rectangular range (rowStart, rowEnd, colStart, colEnd) — the linear `orderedIdsGetter` pattern from list views does not map to 2D without explicit row/column index tracking |
| FilterProvider active filter → SuperFilter dropdown | Rendering all unique column values from fresh SQL to populate the dropdown | The dropdown must open instantly — populate from the current GROUP BY result set (already fetched), not a new round-trip query |
| Worker Bridge correlation IDs → SuperSearch | Sending un-debounced keystrokes directly to the Worker | Debounce search input at 150ms before sending; stale responses (from superseded queries) must be discarded using correlation ID comparison |
| HyperFormula cell references → PAFV coordinates | Using A1 spreadsheet notation | Map PAFV axis values to HyperFormula cell coordinates via a stable bijection that updates when density changes (collapsed axes shift cell indices) |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `getBoundingClientRect()` per cell in mouse handlers | CPU spike on lasso drag; selection lag grows with grid size | Build a coordinate cache after each render; read from cache in handlers | >15×15 cells (225 cells per event at 60Hz) |
| Full grid clear + re-render on collapse toggle | Blank flash on every header click | D3 enter/update/exit with stable key functions — no `innerHTML = ''` full clear | >50 visible cells; any collapse interaction feels broken |
| One Worker query per provider notification | Frame budget exceeded on rapid filter change | StateCoordinator sources array → single compound query | >2 providers firing in the same 16ms window (common: filter + PAFV change together) |
| `grid-template-columns` rebuilt as string on every resize | Jank on handle drag at 30+ columns | Cache previous template; use CSS Custom Properties for individual column widths | >20 columns during continuous drag |
| D3 `.data()` without key function on cell reorder | Cells jump to wrong positions after axis reorder; enter/exit fires unnecessarily | `d => d.rowKey + ':' + d.colKey` key function on every `.data()` call | Any axis reorder or density change (immediate) |
| Synchronous time hierarchy parsing per cell on each render | Slow renders when time axis has many distinct date strings | Parse and bucket all date values once per query result, not once per cell during render | >200 distinct date values in the result set |
| HyperFormula recalculating on every MutationManager exec | Formula recalc blocks main thread on bulk imports | Gate HyperFormula recalc behind a `requestIdleCallback`; never trigger recalc inside MutationManager notification | >10 formula cells with >100 card mutations in flight |

---

## UX Pitfalls

Common user experience mistakes specific to SuperGrid features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Zoom anchors to center (D3 default) | Upper-left cells disappear off-screen when zooming in; user loses context | Pin zoom anchor to upper-left corner; grow columns/rows toward lower-right |
| Filter dropdown populated via new Worker query (slow open) | Dropdown feels sluggish; 100–300ms delay before values appear | Populate filter dropdown from already-fetched GROUP BY result; zero additional query |
| Density slider changes without visual confirmation of data preservation | Users fear data is lost when Month collapses to Quarter | Show aggregate counts in collapsed header cells (Q1: 42 items); reassure via counts |
| Lasso starts from a header cell click | User tries to resize a column, accidentally enters lasso mode | Lasso mode must only activate on pointer-down in the data cell area; headers and row header area block lasso initiation |
| Axis drag with visual ghost follows cursor at center | Ghost obscures the drop zone indicator; user cannot see where axis will land | Position ghost at an offset (20px right, 20px down) from cursor; never center the ghost on the cursor |
| Shift+click range selection follows linear card order | In a 2D grid, Shift+click from upper-left to lower-right should select a rectangle, not a diagonal strip | SuperSelect must implement rectangular range selection (rowA:rowB × colA:colB) for 2D grid — not the linear range used in list/kanban |
| FTS highlight marks trigger text re-wrap in narrow cells | Content shifts when `<mark>` tag adds background — changing cell height | `<mark>` must be styled with `display: inline; padding: 0` — no box model additions that affect height |
| Column resize does not show neighboring column impact | User resizes January to 200px; February overflows | Show a resize preview line that spans all rows; update minmax() constraint live during drag |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **SuperDynamic (axis drag):** Ghost header renders during drag, drop zones highlight — but verify drop actually calls `pafvProvider.reorderRowAxes()` or `reorderColAxes()` and triggers a Worker re-query, not just a visual reorder
- [ ] **SuperSize (resize):** Column drag handle moves smoothly — but verify sizes are persisted to `app_state` in SQLite via StateCoordinator and survive page reload
- [ ] **SuperZoom (zoom):** Pinch zoom scales the grid — but verify row headers (frozen column 1) remain visible and aligned with data rows at all zoom levels
- [ ] **SuperDensity (collapse):** Month collapses to Quarter visually — but verify that `COUNT(*)` aggregates correctly at the Quarter level (not showing the count of only the first month's bucket)
- [ ] **SuperSelect (lasso):** Lasso draws a rubber band — but verify that `selectionProvider.selectAll(selectedIds)` is called with card IDs (not cell keys) and that the existing Cmd+Z undo path is not broken by the lasso selecting a different type of entity
- [ ] **SuperSearch (FTS highlight):** Matching cells show `<mark>` — but verify that clearing the search field removes all highlights and that the next full re-render does not leave stale marks
- [ ] **SuperFilter (dropdown):** Dropdown shows unique values — but verify the "Select All" / "Clear" buttons work correctly with the existing `FilterProvider.clearAxis()` API and that filter indicators appear on the header
- [ ] **SuperCalc (formulas):** Formula evaluates correctly — but verify that HyperFormula's cell index mapping updates when density collapses (a formula referencing "January" must still resolve correctly when the axis is at "Quarter" density)
- [ ] **SuperTime (date parsing):** ISO dates parse correctly — but verify that mixed-format dates from ETL imports (Excel serial numbers, "Jan 15, 2024" strings, ISO 8601) all normalize to the same canonical form before the time hierarchy bucketing runs
- [ ] **SuperCards (aggregation):** Aggregation rows appear at the bottom — but verify that SuperCards are excluded from `SelectionProvider.getSelectedIds()` and do not appear in FTS5 search results or card counts
- [ ] **SuperAudit (computed highlight):** Computed cells have a background tint — but verify the tint is implemented via CSS class (not inline style) so it survives D3 update selection passes that reset inline styles

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| PAFVProvider shape mismatch discovered mid-milestone | HIGH | Freeze other Super* phases; fix `getStackedGroupBySQL()` and re-run Foundation tests; all downstream phases already depend on the correct API |
| Two-query-per-frame issue found after SuperSearch ships | MEDIUM | Refactor SuperSearch to pass FTS clause to `buildSuperGridQuery()`; add `searchRowIds: string[] \| null` to SuperGridQueryConfig; no data model changes needed |
| D3 key function omitted on cell data join — cells at wrong positions | LOW | Add key function to `.data(cellData, d => ...)` call; full re-render corrects positions immediately; no state corruption |
| Cell coordinate cache invalidation bug in lasso select | MEDIUM | Add `rebuildCellCache()` call at end of every D3 render cycle; audit all paths that trigger render without calling cache rebuild |
| HyperFormula formula-to-PAFV coordinate mapping breaks after density change | HIGH | Density change must invalidate all HyperFormula cell content and reload from sql.js results; treat HyperFormula as a compute engine, not a data store — never let it be the source of truth for cell values |
| CSS Grid overflow + D3 zoom transform conflict | HIGH | Remove D3 zoom from grid container; reimplement SuperZoom using CSS Custom Property column width scaling; no incremental fix exists — the conflict is architectural |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| PAFVProvider stacked-axes shape mismatch | Foundation (Phase 1) | Integration test: configure 2 row axes + 2 col axes → verify SQL has 2-field GROUP BY each dimension |
| Worker round-trip accumulation | Foundation (Phase 1) | Performance test: 4 providers fire simultaneously → verify exactly 1 `workerBridge.query()` call per frame |
| CSS Grid template recalc on every render | SuperDensity (first phase changing column count) | Perf benchmark: 50-column density change completes in <16ms on iPhone 13 class hardware |
| HTML5 DnD `dataTransfer.getData()` blocked in `dragover` | SuperDynamic | Unit test: verify drop zone accepts only correct axis type during dragover; verify wrong type shows rejection indicator |
| FTS highlight overwrites D3-managed DOM | SuperSearch | Test: apply search, trigger filter change, verify highlights survive 3 consecutive re-renders |
| Lasso `getBoundingClientRect()` O(N×M) per mousemove | SuperSelect | Performance test: lasso drag across 50×50 grid produces no "Forced synchronous layout" in Chrome DevTools |
| SuperZoom pan-lock breaks with overflow + D3 transform | SuperZoom | Test: zoom to 200%, verify upper-left cell's viewport position unchanged; test: zoom + scroll + zoom produces stable upper-left anchor |
| Density collapse shifts `colStart` — data cells misalign | SuperDensity | Test: collapse Month→Quarter, verify all data cells appear in correct column index |
| Selection linear range vs. 2D rectangular range | SuperSelect | Test: Shift+click in 2D grid selects rectangle (rowA–rowB × colA–colB), not diagonal |
| HyperFormula cell mapping breaks on density change | SuperCalc | Test: collapse Month→Quarter while a formula references January; verify formula result unchanged after collapse |

---

## Sources

- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — current implementation baseline
- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperStackHeader.ts` — buildHeaderCells pattern
- Existing codebase: `/Users/mshaler/Developer/Projects/Isometry/src/providers/PAFVProvider.ts` — current single-axis state shape
- [Isometry v5 Providers Specification](../v5/Modules/Core/Providers.md) — StateCoordinator 16ms batch, query-on-demand pattern
- [Isometry v5 SuperGrid Specification](../v5/Modules/SuperGrid.md) — 4-quadrant layout, four-level density model, state tiers
- [D3 Selection Joining](https://d3js.org/d3-selection/joining) — key function requirement for stable updates (HIGH confidence)
- [SQLite FTS5 highlight() auxiliary function](https://sqlite.org/fts5.html) — FTS5 highlight produces a copy, not in-place DOM decoration (HIGH confidence)
- [HyperFormula Known Limitations](https://hyperformula.handsontable.com/guide/known-limitations.html) — one workbook per instance, circular reference returns #CYCLE (MEDIUM confidence)
- [Web Worker postMessage transfer costs](https://www.jameslmilner.com/posts/web-worker-performance/) — 1,000 keys sub-ms, 10,000 keys ~2.5ms — basis for one-query-per-frame requirement (MEDIUM confidence)
- [CSS Grid explicit placement performance](https://moldstud.com/articles/p-optimizing-performance-best-practices-for-css-grid-and-flexbox) — explicit sizing reduces reflow events 40% vs. content-driven sizing (MEDIUM confidence)
- HTML5 DnD `dataTransfer.getData()` blocked during `dragover` — documented browser security restriction, verified against MDN DataTransfer API (HIGH confidence)
- Browser forced synchronous layout from `getBoundingClientRect()` in event handlers — first principles, verified against Chrome DevTools performance documentation (HIGH confidence)

---
*Pitfalls research for: SuperGrid Complete — 13 interactive Super* features on CSS Grid + D3*
*Researched: 2026-03-03*
