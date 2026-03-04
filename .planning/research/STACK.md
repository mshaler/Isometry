# Stack Research — v3.0 SuperGrid Complete

**Domain:** Interactive multidimensional grid with PAFV axis controls, drag-and-drop, zoom/pan, density, selection, sorting, filtering, and FTS5-powered search
**Researched:** 2026-03-03
**Confidence:** HIGH — all key D3 modules verified against official d3js.org documentation; FTS5 auxiliary function behavior verified against SQLite official docs and community reports; CSS native APIs verified against MDN; zero new npm dependencies required (see conclusion)

---

## Context: Locked Existing Stack (Do Not Re-Research)

These are validated and complete. No changes needed:

| Technology | Version | Status |
|------------|---------|--------|
| TypeScript | 5.9.x (strict) | Locked |
| D3.js | 7.9.0 | Locked — full bundle includes all submodules needed |
| sql.js | 1.14.0 (custom FTS5 WASM, 756KB) | Locked — FTS5 auxiliary functions (highlight, snippet) available |
| Vite | 7.3.1 | Locked |
| Vitest | 4.0.18 | Locked |
| jsdom | 28.1.0 | Locked |
| @vitest/web-worker | 4.0.18 | Locked |
| Worker Bridge (typed RPC, correlation IDs) | Project code | Locked |
| PAFVProvider (xAxis/yAxis/groupBy single axis) | Project code | Needs extension (stacked axes) |
| SuperStackHeader (CSS Grid span algorithm) | Project code | Locked — reused as-is |
| SuperGridQuery (GROUP BY builder) | Project code | Needs Worker wiring |
| FilterProvider (WHERE clause compiler) | Project code | Locked — SuperFilter wires to this |
| DensityProvider (time granularity → strftime) | Project code | Needs extension (4-level Janus model) |
| SelectionProvider (ephemeral Tier 3) | Project code | Needs extension (z-axis awareness) |
| MutationManager (undo/redo command pattern) | Project code | Locked |

**This document covers ONLY what is needed for the 12 new Super* features.**

---

## Conclusion Up Front: Zero New npm Dependencies

All 12 Super* features (SuperDynamic, SuperSize, SuperZoom, SuperDensity, SuperSelect, SuperPosition, SuperCards, SuperTime, SuperSort, SuperFilter, SuperSearch, plus Foundation wiring) can be built entirely with:

1. **D3.js v7.9 already installed** — d3-drag, d3-zoom, d3-brush, d3-time, d3-time-format, d3-array (group/rollup) are all included in the full d3 bundle
2. **Web platform APIs already available** — Pointer Events API, ResizeObserver, CSS position:sticky, CSS transform, requestAnimationFrame
3. **sql.js 1.14 already installed** — FTS5 with highlight()/snippet() auxiliary functions and bm25() ranking
4. **TypeScript 5.9 already installed** — all new code is pure TypeScript

The rationale for each feature's implementation approach follows below.

---

## Recommended Stack by Feature Group

### Group 1: Foundation Wiring

**What:** Extend PAFVProvider to hold stacked axes arrays (rowAxes[], colAxes[]) instead of single xAxis/yAxis; wire SuperGridQuery to Worker; read dynamic axis state in SuperGrid.ts.

**Stack:** Pure TypeScript + existing Worker Bridge (db:query message type). No new libraries.

**Key decision:** PAFVProvider gains `rowAxes: AxisMapping[]` and `colAxes: AxisMapping[]` arrays alongside the existing single-axis fields. The existing `compile()` method continues working for non-SuperGrid views. SuperGrid reads `rowAxes`/`colAxes` and passes them to `buildSuperGridQuery()`. The query result goes through the Worker via `db:query`, same as all other views.

**SQL safety:** All axis fields in the arrays still flow through `validateAxisField()` from the existing allowlist. No new allowlist entries needed for the initial feature set.

---

### Group 2: SuperDynamic — Drag-and-Drop Axis Repositioning

**What:** Users drag column header axes to row header area (and vice versa) to transpose the grid. Axis assignments update PAFVProvider; grid reflows with D3 transition.

**Stack decision: HTML5 native Drag Events, NOT d3.drag**

This mirrors the KanbanView decision (already locked as architectural truth):

> d3.drag intercepts native `dragstart`, captures it, and prevents its default action. This permanently corrupts HTML5 `dataTransfer` during active drag gestures. KanbanView already uses HTML5 DnD for this reason (locked decision).

For axis repositioning:
- `dragstart` on header div: `event.dataTransfer.setData('text/plain', axisId)`
- Drop zones (row header area, col header area, MiniNav staging): `dragover` + `drop`
- On `drop`: read `axisId`, call `pafvProvider.moveAxisToRows(axisId)` or `pafvProvider.moveAxisToCols(axisId)`
- PAFVProvider notifies subscribers; SuperGrid re-renders with D3 transition

**d3.drag IS appropriate for one sub-case:** reordering within the same axis stack (e.g., swap row axis 0 and row axis 1). This is pure pointer tracking without dataTransfer. Use `d3.drag()` with pointer events for in-stack reordering, HTML5 DnD for cross-area axis moving.

**Ghost element:** Create a custom drag image via `event.dataTransfer.setDragImage(ghostEl, offsetX, offsetY)` — pure DOM, no library needed.

**D3 transition on reflow:** After PAFVProvider state updates, `render()` calls `d3.transition().duration(300)` on grid container for smooth reflow. Already in the toolkit.

---

### Group 3: SuperSize — Cell and Header Resizing

**What:** Drag resize handles on header edges to change column widths and row heights. Shift+drag for bulk resize. Double-click edge for auto-fit.

**Stack decision: Pointer Events API (native browser), NOT any library**

Implementation:
```typescript
// On each resize handle element (4px strip at right/bottom edge of header cell)
handle.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault();
  handle.setPointerCapture(e.pointerId);  // capture keeps events flowing after cursor leaves
  // Track initial position and cell dimension
});

handle.addEventListener('pointermove', (e: PointerEvent) => {
  if (!e.buttons) return;
  const delta = e.clientX - startX;
  newWidth = Math.max(MIN_WIDTH, startWidth + delta);
  // Update CSS grid-template-columns directly
  gridEl.style.gridTemplateColumns = rebuildGridTemplateColumns(newWidths);
});

handle.addEventListener('pointerup', () => {
  // Persist widths to StateManager (Tier 2)
});
```

**Why Pointer Events over Mouse Events:** Single event model handles mouse, touch, and Apple Pencil. `setPointerCapture()` eliminates the fragile `document.addEventListener('mousemove')` pattern that can miss `mouseup` events.

**Why no ResizeObserver for SuperSize:** ResizeObserver detects when an element's size *changes* — it's for responding to container changes. SuperSize is *causing* size changes via drag. ResizeObserver is useful after resize to update dependent layout measurements (e.g., recalculate sticky header positions after a column resize), but not for the drag gesture itself.

**Persistence:** Column widths and row heights stored in `ui_state` table via StateManager (existing Tier 2 mechanism). Key: `supergrid.colWidths` and `supergrid.rowHeights` as JSON objects keyed by axis value.

**CSS Grid integration:** The current SuperGrid already uses CSS `grid-template-columns`. SuperSize updates the same property. `grid-column: span N` headers still work correctly because their width is derived from the leaf column widths they span.

---

### Group 4: SuperZoom — Cartographic Navigation

**What:** Pinch/scroll zoom anchored to upper-left corner (not cursor-centered). Pan with drag. Row and column headers remain sticky (frozen). Cannot pan past table boundaries.

**Stack decision: d3-zoom (already in d3 bundle) for gesture capture, CSS transform for rendering, CSS position:sticky for frozen headers**

D3-zoom provides:
- Unified mouse wheel + touch pinch gesture handling
- `zoom.translateExtent([[0,0],[maxX,maxY]])` to prevent overscroll
- Programmatic control via `zoom.scaleTo(selection, k, [0, 0])` to anchor to upper-left

The key insight from d3-zoom docs: the `_p_` parameter on `scaleTo` / `scaleBy` controls the anchor point. Default is viewport center. Passing `[0, 0]` pins to the upper-left corner — exactly the Apple Numbers-style behavior required.

**Implementation pattern (HTML elements, not SVG):**
```typescript
const zoom = d3.zoom<HTMLElement, unknown>()
  .scaleExtent([0.25, 4])
  .translateExtent([[0, 0], [totalGridWidth, totalGridHeight]])
  .on('zoom', (event) => {
    const { x, y, k } = event.transform;
    // Apply to the scrollable inner grid, not the sticky-header wrapper
    gridContentEl.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
    gridContentEl.style.transformOrigin = '0 0';
  });

// Override wheel behavior to pin zoom to upper-left:
zoomContainer.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = -e.deltaY / 300;
  // scaleTo with [0,0] anchor — upper-left pinned
  d3.select(zoomContainer).call(
    zoom.scaleBy as any, Math.exp(delta), [0, 0]
  );
}, { passive: false });
```

**CSS position:sticky for frozen headers:** Row headers (column 1) get `position: sticky; left: 0; z-index: 2`. Column headers (rows 1..N) get `position: sticky; top: 0; z-index: 2`. The corner cell gets `z-index: 3`. This is pure CSS — no JavaScript required for header pinning during zoom/pan.

**Browser support for position:sticky with CSS Grid:** Fully supported in all modern browsers (Chrome 91+, Firefox 59+, Safari 7.1+, Edge 91+). iOS 17+ / macOS 14+ (the project's native shell targets) are well within this.

**Why not d3.zoom's default scroll behavior:** The default wheel handler scales around the cursor position, which is disorienting for spreadsheet-style grids. The custom wheel handler with explicit `[0, 0]` anchor gives Numbers-style behavior.

---

### Group 5: SuperDensity — 4-Level Janus Density Model

**What:** Four orthogonal density controls: Value (hierarchy collapse), Extent (hide empty cells), View (spreadsheet vs matrix), Region (per-axis density mixing).

**Stack decision: Extend DensityProvider with new state shape + SQL compilation logic. No new libraries.**

The existing DensityProvider handles time granularity for calendar views. SuperDensity requires a new `SuperDensityState` (separate from DensityProvider to avoid breaking existing calendar/timeline density):

```typescript
interface SuperDensityState {
  // Level 1: Value density — per-axis granularity (e.g., month→quarter→year)
  axisGranularity: Map<string, TimeGranularity | 'raw'>;

  // Level 2: Extent density — hide empty intersections
  hideEmpty: boolean;

  // Level 3: View density — spreadsheet (1 card/row) vs matrix (count at intersection)
  viewMode: 'spreadsheet' | 'matrix';

  // Level 4: Region density — per-axis density levels (future; v3.0 ships as stub)
  regionConfig: Map<string, 'dense' | 'sparse'>;
}
```

**SQL compilation:** Levels 1 and 2 affect the query. Level 3 affects client-side rendering only. Level 4 is deferred.

- Level 1 (Value): When axis granularity is 'quarter', the GROUP BY uses DensityProvider's existing `strftime` quarter expression on that axis field. Extend `buildSuperGridQuery()` to accept per-axis granularity and emit the appropriate expression.
- Level 2 (Extent): When `hideEmpty = true`, the SQL query naturally produces only populated intersections (GROUP BY without OUTER JOIN). When `hideEmpty = false`, a Cartesian product of all axis values must be generated client-side and intersected with query results to show empty cells. The current SuperGrid already does client-side empty cell rendering — this just makes it conditional.

**Persistence:** SuperDensityState serializes to `ui_state` table via StateManager (Tier 2), same as other providers.

---

### Group 6: SuperSelect — Z-Axis Aware Selection

**What:** Lasso selection, click selection, multi-select with modifier keys, header group selection. Z-axis awareness means selection targets only data cells (not headers) when lassoing in the data area.

**Stack decision: Pointer Events API for lasso rubber-band, SelectionProvider extension for z-aware state. NO d3-brush (SVG-only, incompatible with CSS Grid).**

d3-brush requires SVG `<g>` elements — confirmed from official d3-brush documentation. SuperGrid uses CSS Grid HTML divs. d3-brush cannot be applied directly.

**Lasso implementation with Pointer Events:**
```typescript
// On the data-cell area overlay (transparent div spanning data rows x data cols)
lassoOverlay.addEventListener('pointerdown', startLasso);
lassoOverlay.addEventListener('pointermove', updateLasso);
lassoOverlay.addEventListener('pointerup', commitLasso);

function commitLasso(endEvent: PointerEvent) {
  // Use getBoundingClientRect() on each data cell
  // to determine which cells intersect the lasso rect
  const lassoRect = { x: startX, y: startY, width: ..., height: ... };
  const cellEls = gridEl.querySelectorAll<HTMLElement>('.data-cell');
  const selected: string[] = [];
  for (const el of cellEls) {
    if (rectsIntersect(el.getBoundingClientRect(), lassoRect)) {
      selected.push(el.dataset.cardId!);
    }
  }
  selectionProvider.setSelection(selected);
}
```

**Visual lasso rect:** A `position: fixed` div that tracks pointer position. No library needed.

**Z-axis disambiguation:** The lasso overlay has `pointer-events: none` during normal state and `pointer-events: all` when the user initiates a drag in the data area (detected by `pointerdown` target being a data cell or empty data area, not a header). This prevents accidental lasso when dragging a resize handle.

**SelectionProvider extension:** Add `selectionContext: 'data' | 'header' | 'supercards'` to SelectionProvider state (still Tier 3, never persisted). Header group selection fires when clicking a parent or child header — selects all card IDs under that header's data range.

**Modifier key support:**
- Cmd+click: toggle single item in selection
- Shift+click: range select (rectangular from last single-click anchor)
- Lasso drag: replace selection (or Cmd+lasso to add to existing)

All via standard keyboard event `.metaKey` / `.shiftKey` checks — no library needed.

---

### Group 7: SuperPosition — Coordinate Tracking

**What:** Logical PAFV coordinate tracking (axis values, not pixels) that survives view transitions. Recomputed on transition (not canonical state).

**Stack decision: Pure TypeScript type, stored in PAFVProvider + StateManager. No new libraries.**

```typescript
interface PAFVCoordinate {
  rowValues: string[];   // current values along row axes (e.g., ['Q1', 'January'])
  colValues: string[];   // current values along col axes (e.g., ['Engineering'])
  scrollAnchorCard?: string;  // card ID at top-left of viewport (for scroll restoration)
}
```

SuperPosition is derived state: when the user is viewing a particular region of the grid, the visible cells' axis values are captured as `PAFVCoordinate`. On view transition, the coordinate is translated to the new view's axis mapping (e.g., `colValues[0] = 'Engineering'` → Kanban column 'Engineering' scrolled into view).

**No new persistence needed:** PAFVCoordinate is Tier 2 (persists within view family, suspends across). Stored in PAFVProvider's existing `_suspendedStates` map. The existing `LATCHViewState` shape in the SuperGrid.md spec already includes `viewportAnchor: PAFVCoordinate`.

---

### Group 8: SuperCards — Generated Header and Aggregation Cards

**What:** Header cards (distinct visual style from data cards), aggregation cards (COUNT, SUM rows/columns), audit cards (computed value indicators).

**Stack decision: Pure D3 data join on a separate `supercard` data array, different CSS class. No new libraries.**

SuperCards are rendered by the same CSS Grid layout as data cells — they are just extra cells in the grid with `data-supercard="true"` and distinct CSS:

```typescript
interface SuperCardDatum {
  type: 'header-span' | 'aggregation' | 'computed';
  rowKey: string;
  colKey: string;
  value: string | number;
  formula?: string;  // for SuperCalc integration (future)
}
```

Aggregation row/column: After the SuperGridQuery returns GROUP BY results with `COUNT(*) AS count`, the SuperGrid accumulates totals per column and per row, then renders aggregation SuperCards in a pinned footer row and a pinned right column. These are CSS Grid cells at `grid-row: -1` (last row) and `grid-column: -1` (last column).

**Why not a separate DOM layer:** SuperCards exist in the same CSS Grid as data cells and headers. Their `grid-row` and `grid-column` values place them exactly where needed. Keeping them in the same grid eliminates coordinate synchronization between parallel DOM structures.

**Exclusion from FTS5:** SuperCards are never in the `cards` table. They are generated from query results and rendered client-side. FTS5 search queries the `cards` table directly — SuperCards are not in the result set by definition.

---

### Group 9: SuperTime — Smart Time Hierarchy

**What:** Auto-parse date strings from card data. Auto-select appropriate hierarchy level (Year/Quarter/Month/Week/Day) based on data date range. Non-contiguous time selection.

**Stack decision: d3-time + d3-time-format (already in d3 bundle). NO date-fns, NO Temporal API.**

**Why d3-time over date-fns:** d3-time is already bundled with d3.js v7.9.0. Adding date-fns (~40KB min+gzip for the parse module) just to avoid using the already-present d3-time-format is wasteful. The architecture constraint "boring stack wins" applies.

**Why not Temporal API:** The Temporal API is still a Stage 3 TC39 proposal as of 2026. No stable polyfill-free availability in WKWebView (iOS 17 / macOS 14). Do not use.

**Multi-format parsing using d3-time-format:**
```typescript
// Try formats in priority order (most specific to least)
const DATE_FORMATS = [
  d3.utcParse('%Y-%m-%dT%H:%M:%S.%LZ'),  // ISO 8601 with ms
  d3.utcParse('%Y-%m-%dT%H:%M:%SZ'),       // ISO 8601
  d3.utcParse('%Y-%m-%d'),                  // ISO date only
  d3.timeParse('%B %d, %Y'),               // "January 15, 2024"
  d3.timeParse('%b %d, %Y'),               // "Jan 15, 2024"
  d3.timeParse('%m/%d/%Y'),                // US date
  d3.timeParse('%d/%m/%Y'),                // EU date
];

function parseDate(str: string): Date | null {
  for (const parser of DATE_FORMATS) {
    const result = parser(str);
    if (result !== null) return result;
  }
  return null;
}
```

**Smart hierarchy selection using d3-time:**
```typescript
function smartHierarchy(dates: Date[]): TimeGranularity {
  const span = d3.timeDay.count(d3.min(dates)!, d3.max(dates)!);
  if (span > 365 * 2) return 'year';
  if (span > 90) return 'quarter';
  if (span > 14) return 'month';
  if (span > 3) return 'week';
  return 'day';
}
```

**Time hierarchy headers:** Use the existing DensityProvider `strftime` patterns to group dates. The hierarchy (Year > Quarter > Month > Week > Day) is generated by building multi-level axis values — the existing `buildHeaderCells()` algorithm handles the nesting once the axis values are structured correctly.

**Non-contiguous selection:** A `Set<string>` of selected time period keys (e.g., `{'2024-Q1', '2024-Q3'}`). Time periods not in the set are excluded via a WHERE clause filter compiled through FilterProvider's existing `in` operator. Selection state is Tier 1 (always persists across view transitions).

---

### Group 10: SuperSort — PAFV-Aware Per-Group Sorting

**What:** Click column/row headers to sort within-group. Multi-sort with priority. Sort does not cross group boundaries.

**Stack decision: Extend SuperGridQueryConfig with per-group sort parameters. Pure TypeScript + existing SQL compiler. No new libraries.**

Per-group sorting in SQL uses `ORDER BY` with the group key first, then the sort field:
```sql
-- Sort months within each quarter, alphabetically
SELECT created_at, status, COUNT(*) AS count, GROUP_CONCAT(id) AS card_ids
FROM cards
WHERE deleted_at IS NULL
GROUP BY created_at, status
ORDER BY created_at ASC, name ASC  -- quarter first (group key), then name (sort field)
```

The existing `buildSuperGridQuery()` already generates an ORDER BY clause from axis directions. SuperSort adds `sortField` and `sortDirection` overrides to `SuperGridQueryConfig`:

```typescript
interface SuperGridQueryConfig {
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
  where: string;
  params: unknown[];
  // NEW:
  sortOverrides?: Array<{ field: AxisField; direction: 'asc' | 'desc' }>;
}
```

All `sortOverrides` fields flow through `validateAxisField()` — SQL safety maintained.

**Client-side sort state:** A `SortState` class (new, but trivial — a typed array with toggle logic) is stored in the supergrid component. It persists as Tier 1 state (survives any view transition).

**Header click zone:** Single click → sort asc → click again → sort desc → click again → clear. Visual indicator (▲/▼) on the header cell.

---

### Group 11: SuperFilter — Excel-Style Auto-Filter Dropdowns

**What:** Click filter icon on any header to open a dropdown with unique values and checkboxes. Filter compiles to WHERE clause via FilterProvider's existing `in` operator.

**Stack decision: Custom HTML dropdown, FilterProvider.addFilter() with 'in' operator. No new libraries.**

The dropdown is a `position: absolute` div rendered below the filter icon click target. It contains:
1. A search input (plain `<input>`) for filtering the unique values list
2. A scrollable list of checkboxes (one per unique value for that axis field)
3. "Select All" / "Clear" buttons

**Unique values query:** A new Worker message type (`db:distinct-values`) that runs:
```sql
SELECT DISTINCT {field} FROM cards WHERE deleted_at IS NULL ORDER BY {field} ASC
```
Field is allowlist-validated before interpolation. This query runs via the existing Worker Bridge typed RPC.

**Filter compilation:** Each checked value compiles to `FilterProvider.addFilter({ field, operator: 'in', value: selectedValues })`. The existing `compileFilters()` already handles the `in` operator with parameterized values.

**Active filter indicator:** A dot or highlight on the header cell when that field has an active filter from FilterProvider. Read from `filterProvider.getFilters()`.

**Dropdown state:** Ephemeral (Tier 3). Opens/closes via DOM show/hide. Not persisted. Selected values propagate immediately to FilterProvider (Tier 1 persistence).

---

### Group 12: SuperSearch — FTS5-Powered Faceted In-Grid Search

**What:** FTS5 search across card content. Results highlighted in-situ within the grid. Prefix matching, faceted by current PAFV context.

**Stack decision: FTS5 highlight() auxiliary function + sql.js 1.14 custom WASM build + D3 data join for highlighting. No new libraries.**

**FTS5 highlight() function:** Available in the existing custom sql.js WASM build (compiled with `-DSQLITE_ENABLE_FTS5`). Usage:
```sql
SELECT cards.id, highlight(nodes_fts, 0, '<mark>', '</mark>') AS name_highlighted
FROM nodes_fts
JOIN cards ON cards.rowid = nodes_fts.rowid
WHERE nodes_fts MATCH ? AND cards.deleted_at IS NULL
ORDER BY bm25(nodes_fts)
```

**Important constraint from research:** `highlight()` and `snippet()` can only be called within a query that uses the `MATCH` operator on an FTS5 table. They cannot be used in GROUP BY contexts or subqueries that lose the FTS5 match context. This means SuperSearch cannot directly combine FTS5 highlight results with the SuperGridQuery GROUP BY aggregation.

**Solution: Two-step approach**
1. Run the FTS5 MATCH query to get matching card IDs and highlighted fragments
2. The SuperGrid renders normally (existing GROUP BY query)
3. Cells containing matched card IDs get a `.fts-match` CSS class
4. Card IDs from step 1 are stored in a `searchResultSet: Set<string>` (Tier 1 state)
5. D3 data join updates `.data-cell` elements: cells with matched cards get `data-has-match="true"` and show highlight indicators

**Prefix matching:** FTS5 porter tokenizer with `MATCH 'proj*'` for prefix search. The existing `search.handler.ts` already implements this pattern (verified in v0.1).

**Faceted scope:** When a PAFV filter is active (e.g., folder = 'Engineering'), pass the active WHERE conditions to the FTS5 query via a JOIN with the cards table to scope results to the current view context.

**Performance:** FTS5 search target is <100ms for 10K cards. Already validated in v0.1 benchmarks. SuperSearch reuses the same query path (Worker Bridge → search.handler → FTS5 MATCH → rowid join).

**Search bar placement:** A `<input type="search">` element in the SuperGrid's control chrome area. Debounced with `setTimeout(300ms)` before firing the Worker query. No library needed for debounce — plain closure.

---

## Stack Patterns by Variant

**For features that produce SQL queries (SuperFilter, SuperSort, SuperTime, SuperSearch):**
- Compile via existing provider system (FilterProvider, buildSuperGridQuery)
- All fields through validateAxisField() or ALLOWED_FILTER_FIELDS
- Execute via Worker Bridge db:query message
- Never raw SQL from UI input

**For features that produce DOM changes without SQL (SuperSize, SuperDynamic, SuperCards, SuperSelect):**
- Use D3 data join with key function on every .data() call (mandatory per project rules)
- CSS Grid property updates via direct style manipulation
- D3 transitions for animated changes (duration 200-300ms)

**For features that use gesture events (SuperZoom, SuperSize, SuperDynamic, SuperSelect lasso):**
- Prefer Pointer Events API (pointerdown/pointermove/pointerup) over Mouse Events
- Use setPointerCapture() to maintain event flow when pointer leaves element
- HTML5 DnD events only for cross-zone axis repositioning (SuperDynamic)

**For state persistence (all features):**
- Visual/rendering state: Tier 3 (ephemeral, always resets)
- Axis assignments, sort order, filter state, density level: Tier 2 (persists within view family)
- FTS5 search query, selection, active filters: Tier 1 (always persists across views)

---

## Core Technologies (No Changes)

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| TypeScript | 5.9.x | All new feature code | Locked |
| D3.js | 7.9.0 | d3-drag, d3-zoom, d3-time, d3-time-format, d3-array (group/rollup) | Already installed — submodules included in bundle |
| sql.js | 1.14.0 custom FTS5 | FTS5 highlight(), bm25(), MATCH queries | Already installed |
| CSS Grid | Browser native | Grid layout, sticky headers, position:sticky | Already used |
| Pointer Events API | Browser native | Resize handles, lasso selection | No library needed |

## Supporting Libraries (No New Additions)

| Feature | What's Needed | Where It Comes From |
|---------|---------------|---------------------|
| SuperDynamic drag | HTML5 DnD events + d3.drag for in-stack reorder | Browser native + d3 bundle |
| SuperSize resize | Pointer Events (pointerdown/pointermove/pointerup) + setPointerCapture | Browser native |
| SuperZoom zoom/pan | d3-zoom (scaleBy with [0,0] anchor) + CSS transform + position:sticky | d3 bundle + CSS |
| SuperDensity 4-level model | New TypeScript state class + existing strftime patterns | Project code extension |
| SuperSelect lasso | Pointer Events + getBoundingClientRect() on grid cells | Browser native |
| SuperPosition coordinate tracking | PAFVCoordinate type + existing StateManager | Project code extension |
| SuperCards generated cards | D3 data join + CSS class variation | d3 bundle + CSS |
| SuperTime date parsing | d3-time-format (parsers), d3-time (intervals for smart hierarchy) | d3 bundle |
| SuperSort per-group sorting | SuperGridQueryConfig extension + ORDER BY clause | Project code extension |
| SuperFilter dropdowns | Custom HTML div + FilterProvider 'in' operator | Project code + browser native |
| SuperSearch FTS5 | FTS5 highlight() in sql.js + Set<string> for result highlighting | Already installed |
| Foundation wiring | PAFVProvider array extension + SuperGridQuery Worker wiring | Project code extension |

---

## Installation

No new packages required. All 12 features build on the existing stack.

```bash
# Verify current installed versions (no changes)
npm ls d3 sql.js typescript vite vitest

# Expected output confirms existing versions are correct:
# d3@7.9.0
# sql.js@1.14.0
# typescript@5.9.3
# vite@7.3.1
# vitest@4.0.18
```

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| HTML5 DnD for cross-zone axis repositioning | d3.drag for all dragging | d3.drag intercepts dragstart and prevents dataTransfer. KanbanView (v0.5) already established this architectural truth. |
| d3-zoom with [0,0] anchor override | Custom CSS transform tracking | d3-zoom provides unified mouse+touch+pinch gesture handling. Custom implementation would duplicate wheel event math and touch gesture handling. d3-zoom is already in the bundle. |
| Pointer Events API for resize handles | d3.drag for resize handles | d3.drag works, but Pointer Events setPointerCapture() is cleaner — events don't require a document-level listener and don't interfere with d3.drag elsewhere in the grid. Both are viable; Pointer Events is simpler in this context. |
| d3-time-format for date parsing | date-fns v4 | date-fns is ~40-80KB additional bundle weight. d3-time-format is already included in the d3 bundle. "Boring stack wins" — no new dependency. |
| d3-time-format for date parsing | Temporal API | Temporal API is TC39 Stage 3, no stable native support in WKWebView (iOS 17). Avoid unstable APIs. |
| Custom HTML dropdown for SuperFilter | floating-ui / popper.js | Adds a dependency for a dropdown. The SuperFilter dropdown has simple placement requirements (below the header cell). Absolute positioning relative to the header cell suffices. |
| d3-brush for lasso | Custom Pointer Events lasso | d3-brush is SVG-only (confirmed from official docs). SuperGrid is HTML CSS Grid. d3-brush cannot apply. Custom Pointer Events lasso is necessary. |
| FTS5 highlight() with two-step approach | FTS5 highlight() combined with GROUP BY | FTS5 auxiliary functions (highlight, snippet) cannot be used in GROUP BY context — "unable to use function highlight in the requested context" error. Two-step approach separates concerns correctly. |
| ResizeObserver for layout measurement | Manual size tracking | ResizeObserver detects container size changes (useful for updating grid layout after window resize or sidebar toggle). Not needed for SuperSize drag gesture itself, but useful for reactive layout updates. May be used for a specific sub-problem (detecting when sticky headers need z-index adjustment). |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| react-grid-layout, ag-grid, handsontable | Framework dependencies incompatible with "no React, no framework" constraint (D-001 locked). They also own their own rendering, conflicting with D3 data join IS state management. | Custom CSS Grid + D3 |
| HyperFormula | Deferred per milestone scope. SuperCalc is explicitly out of scope for v3.0. | Not applicable until SuperCalc milestone |
| date-fns, dayjs, luxon | Additional bundle weight for functionality already available in d3-time + d3-time-format. | d3-time-format (already in bundle) |
| floating-ui / @popperjs/core | Dependency for dropdown positioning. SuperFilter dropdown placement is simple enough for `position: absolute` relative to header cell. | Native CSS absolute positioning |
| d3-lasso (GitHub: skokenes/d3-lasso) | Unmaintained plugin (last commit 2018). The core lasso logic is 50 lines of Pointer Events code. | Custom Pointer Events lasso |
| Temporal API | TC39 Stage 3 as of 2026, no stable native support in WKWebView targets. | d3-time-format parsers with sequential format fallback |
| d3-brush | SVG-only, cannot work with CSS Grid HTML elements. | Custom Pointer Events lasso |
| Additional Worker message types beyond existing protocol | Worker Bridge protocol is locked (5 message types). New SuperGrid-specific query types should use the existing db:query message type with different SQL, not new message types. | Existing db:query + db:distinct-values extension (aligned with existing pattern) |

---

## Version Compatibility

| Component | Compatible With | Notes |
|-----------|-----------------|-------|
| d3-zoom v3.0 | d3 v7.9.0 | Included in d3 bundle; [0,0] anchor for scaleBy/scaleTo confirmed in v3 docs |
| d3-drag v3.0 | d3 v7.9.0 | Included in bundle; HTML5 DnD conflict with dragstart is documented behavior |
| d3-time v3.2 | d3 v7.9.0 | Included in bundle; timeDay.count(), timeInterval.range() confirmed |
| d3-time-format v4.1 | d3 v7.9.0 | Included in bundle; utcParse/timeParse multi-format sequential fallback confirmed |
| d3-array v3.2 | d3 v7.9.0 | Included in bundle; group/rollup nested Map confirmed |
| FTS5 highlight() | sql.js 1.14.0 (custom WASM) | Available when compiled with -DSQLITE_ENABLE_FTS5; must be called within MATCH query context |
| Pointer Events API | iOS 17+ / macOS 14+ / Chrome 55+ | Full support in all project targets; setPointerCapture() available |
| CSS position:sticky + CSS Grid | iOS 17+ / macOS 14+ | Full support. sticky within grid requires grid to not have overflow:auto on the same element as sticky children — a known wrinkle, documented in CSS-Tricks |
| ResizeObserver | iOS 13.4+ / macOS 10.15.4+ (Safari 13.1+) | Well within project targets (iOS 17 / macOS 14) |

---

## Sources

- d3js.org d3-drag official docs — dragstart interception, dataTransfer incompatibility confirmed: https://d3js.org/d3-drag
- d3js.org d3-zoom official docs — scaleTo/scaleBy [p] anchor parameter, translateExtent, constrain(): https://d3js.org/d3-zoom
- d3js.org d3-brush official docs — SVG-only requirement confirmed: https://d3js.org/d3-brush
- d3js.org d3-time official docs — timeDay.count(), timeTicks, interval methods: https://d3js.org/d3-time
- d3js.org d3-time-format official docs — timeParse/utcParse, multi-format sequential fallback pattern: https://d3js.org/d3-time-format
- d3js.org d3-array group docs — group/rollup nested Map, multi-key hierarchy: https://d3js.org/d3-array/group
- SQLite FTS5 official docs — highlight(), snippet(), bm25() auxiliary function context requirements: https://sqlite.org/fts5.html
- SQLite forum / GitHub gist — "unable to use function highlight in the requested context" in GROUP BY context confirmed: https://gist.github.com/lemon24/49b0a999b26f7a40ba23d8d4fab4a828
- MDN Pointer Events — setPointerCapture(), pointermove, pointerdown/pointerup: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- CSS-Tricks — position:sticky with CSS Grid wrinkles: https://css-tricks.com/how-to-use-css-grid-for-sticky-headers-and-footers/
- Isometry PROJECT.md — confirmed d3 v7.9, sql.js 1.14.0, KanbanView HTML5 DnD decision (locked): /Users/mshaler/Developer/Projects/Isometry/.planning/PROJECT.md
- Isometry package.json — confirmed installed versions: /Users/mshaler/Developer/Projects/Isometry/package.json
- Isometry src/views/KanbanView.ts — HTML5 DnD pattern established (locked): does NOT use d3.drag (comment line 14)
- Isometry src/providers/allowlist.ts — ALLOWED_AXIS_FIELDS for SQL safety context

---

*Stack research for: Isometry v3.0 SuperGrid Complete — 12 Super* interactive features on existing D3.js/CSS Grid/sql.js stack*
*Researched: 2026-03-03*
