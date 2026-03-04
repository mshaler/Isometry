# Feature Research

**Domain:** Interactive multidimensional grid — Super* feature set for Isometry v3.0 SuperGrid Complete
**Researched:** 2026-03-03
**Confidence:** HIGH — derived from `v5/Modules/SuperGrid.md` (canonical spec, 56KB), `v5/Modules/Core/Providers.md` (already-built provider layer), `.planning/PROJECT.md`, and cross-referenced against AG Grid, Excel, Google Sheets, and Airtable interaction patterns via web research.

---

## Context: What Already Exists vs. What Is New

**Already built (do not rebuild):**
- SuperStack: nested PAFV headers with CSS Grid `grid-column: span N` run-length spanning — ships in v1.0
- FilterProvider, PAFVProvider, SelectionProvider, DensityProvider — all built, tested, and in production
- Base SuperGrid: 2D grid renders from sql.js queries via D3 data join with stable key functions
- Nine D3 views including list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid
- MutationManager with command-pattern undo/redo
- Three-tier state persistence (Durable/Session/Ephemeral)
- FTS5 search infrastructure (21 tests, FTS5 WASM build)

**v3.0 adds 12 Super* interactive features on top of this foundation:**
SuperDynamic, SuperSize, SuperZoom, SuperDensity, SuperSelect, SuperPosition, SuperCards, SuperTime, SuperSort, SuperFilter, SuperSearch, and the PAFVProvider stacked axes + SuperGridQuery Worker wiring foundation.

SuperCalc and SuperAudit are explicitly deferred (HyperFormula dependency deferred per milestone context).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that any power grid — Excel, Google Sheets, Airtable Grid, AG Grid — provides. Missing these makes SuperGrid feel like a mockup rather than a real tool. Users coming from spreadsheets expect all of these on day one.

| Feature | Why Expected | Complexity | Depends On |
|---------|--------------|------------|------------|
| **SuperSort** — per-column/group sorting | Every spreadsheet and table has clickable column headers that sort. Not having this makes the grid feel read-only. User expects single-click asc, double-click desc, Cmd+click multi-sort. | MEDIUM | PAFVProvider.setSort() already exists; needs header click wiring + SQL ORDER BY in SuperGridQuery |
| **SuperFilter** — auto-filter dropdowns per header | Excel's most-used feature after sorting. Clicking a column header reveals a checkbox list of distinct values to include/exclude. Users scan for rows matching specific values without writing queries. | MEDIUM | FilterProvider already compiles WHERE clauses; needs per-column distinct value queries + dropdown UI in header chrome |
| **SuperSearch** — in-grid FTS5 text search | Global search bar that highlights matching cells in the grid. Users expect Cmd+F behavior. "Find in sheet" is standard in Numbers, Sheets, Excel. FTS5 is already built. | LOW | FilterProvider.setSearchQuery() already exists; needs visual highlight layer in D3 renderer + search input in toolbar |
| **SuperSize** — column/row resize via drag handle | Any grid that cannot be resized feels broken. Users drag the border between column headers to widen a column. Double-click auto-fits. Expected in 100% of grid UIs. | MEDIUM | Needs resize edge hit-detection (4px strips), CSS/SVG dimension mutations, persistence in view_state, interaction with SuperStack span calculation |
| **SuperSelect** — cell and group selection | Clicking a cell should select it (highlight it, show selection state). Cmd+click adds to selection. Shift+click selects a range. Header click selects the group. This is the prerequisite for any bulk action. | MEDIUM | SelectionProvider already handles single/multi/range selection logic; needs z-axis disambiguation for header vs. data cell vs. SuperCard (geometric click zones per SuperGrid.md Section 6) |
| **SuperDensity** — 4-level density controls | Users on data-heavy tasks want compact rows. Users reviewing cards want spacious rows. Excel has row height. Numbers has density presets. The 4-level Janus model (Value/Extent/View/Region) provides this. At minimum, Value Density (time hierarchy collapse) and Extent Density (hide empty intersections) are table stakes. | MEDIUM | DensityProvider.setAxisDensity() and getDensitySQL() already exist; needs UI controls (sliders/toggles) wired to provider, SQL GROUP BY regeneration on density change |
| **SuperZoom** — pan/scroll with pinned corner | When a grid has many rows and columns, the top-left headers must stay visible as you scroll. Excel calls this "freeze panes." Users immediately notice when headers scroll away. | MEDIUM | Needs sticky header implementation in CSS or SVG fixed-position overlay, pinned upper-left corner per resolved design decision in SuperGrid.md Section 9 |

**Confidence:** HIGH — all of these appear in AG Grid, TanStack Table, Excel, Google Sheets, Airtable Grid, and Numbers. The user expectation is consistent across all spreadsheet-adjacent products. The provider infrastructure for most is already built — complexity is in wiring, not inventing.

---

### Differentiators (Competitive Advantage)

Features unique to Isometry's PAFV model. No spreadsheet does axis repositioning as a first-class operation. No pivot tool exposes this level of multidimensional control in a fluid interaction model.

| Feature | Value Proposition | Complexity | Depends On |
|---------|-------------------|------------|------------|
| **SuperDynamic** — drag-and-drop axis repositioning (transpose) | Users can drag a row axis to the column position, instantly transposing the grid. No spreadsheet exposes this as a direct manipulation. Excel TRANSPOSE is a formula. Google Sheets TRANSPOSE is a function. Airtable cannot transpose at all. This is the PAFV "any axis maps to any plane" promise made tangible. | HIGH | PAFVProvider.reorderRowAxes/reorderColAxes already defined; needs D3 drag behavior on header cells, PAFVProvider mutation on drop, full grid reflow on axis change. Most complex interaction in v3.0. |
| **SuperPosition** — coordinate tracking across view transitions | The grid remembers which cell the user was looking at when they switch views. Return to SuperGrid and you're back at the same coordinate. No other tool does this across view types. | MEDIUM | Needs a coordinate system (rowKey + colKey) persisted in view_state (Tier 2 family state). SuperZoom viewport position is Ephemeral (Tier 3). SuperPosition is the coordinate index, distinct from pixel scroll position. |
| **SuperCards** — generated aggregation cards at group intersections | Group intersections show computed cards (COUNT, SUM, etc.) rather than just being empty. These are distinct from data cards — they are views over a group. Clicking shows a tooltip; double-clicking opens the formula editor (SuperCalc — deferred). This is what makes SuperGrid feel like a multidimensional pivot surface rather than a grouped list. | HIGH | Needs new card type rendering in D3 (distinct visual treatment — dashed border, italic text), aggregation SQL (COUNT, SUM, AVG per group), z-layer hit-test integration (SuperCard body is lowest priority hit target per SuperGrid.md Section 6) |
| **SuperTime** — smart time hierarchy + non-contiguous selection | Time axis collapses/expands across levels: timestamp → day → week → month → quarter → year. Selecting a non-contiguous set of time periods (Q1 + Q3) is possible. No existing tool handles non-contiguous time period selection in a grid — they all require continuous ranges. | HIGH | DensityProvider time hierarchy SQL already defined (strftime patterns for day/week/month/quarter/year); needs UI for hierarchy level picker, non-contiguous selection logic that overrides continuous range assumption in SelectionProvider |
| **PAFVProvider stacked axes + SuperGridQuery Worker wiring** (foundation) | This is the prerequisite for dynamic axis manipulation. Currently SuperGrid reads static axis assignments. The foundation wires PAFVProvider's stacked rowAxes/colAxes state to live sql.js GROUP BY queries via the Worker bridge. Without this, none of the other Super* features can drive the grid dynamically. | HIGH | PAFVProvider.grouping.{rowAxes, colAxes} already defined in state shape; needs SuperGridQuery message type in WorkerBridge, sql.js GROUP BY compilation from axis stack, D3 re-render on PAFVProvider subscription |

**Confidence:** HIGH for SuperDynamic and SuperCards (directly specified in SuperGrid.md with detailed behavior). HIGH for SuperPosition (three-tier state model is locked). MEDIUM for SuperTime non-contiguous selection (time hierarchy is specified but non-contiguous selection behavior needs careful design against SelectionProvider's existing anchor-based range logic).

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time cell editing in-grid** | "Spreadsheets let you type directly into a cell." Users expect inline cell editing like Excel. | SuperGrid is a projection surface — cells display card data (which can have rich content, connections, tags, etc.). Inline editing in a grid cell constrains to a single-line text field and breaks the card data model. The existing card detail view (double-click to open) handles full editing. A grid-inline editor would be a second editing surface with different constraints. | Double-click on data cell opens the card detail/edit view. This is already specified as the behavior in SuperGrid.md Section 6 (Data Cell: Double Click = "Open card detail/edit view"). |
| **Virtual scrolling for 100K+ rows** | Developers reach for virtualization when they see "grid" and assume massive datasets. | sql.js runs in WASM with a realistic ceiling around 50K-100K cards before performance degrades. The SuperGrid query aggregates cards into group intersections — a 10K-card database with 5 row axes and 4 column axes might produce only 200 visible cells. The rendering unit is not rows but group intersections. Cell count is bounded by cardinality of axes, not card count. | Lazy-render off-screen headers as an optimization if consistently exceeding performance budgets. The performance requirement is <500ms for 10K cards, which is achievable without virtualization. Revisit if benchmark fails. |
| **Spreadsheet-style formula entry (HyperFormula) in this milestone** | SuperCalc and SuperAudit were originally in scope. HyperFormula enables Excel-compatible formulas (SUM, AVERAGE, VLOOKUP, etc.). | HyperFormula is a substantial dependency (~500KB). The formula reference syntax for PAFV-scoped dimensional formulas (how to reference "all cards in Q1 Engineering group") is an unsolved design problem — see SuperGrid.md Section 10 open questions. Building this before the formula syntax is designed risks building the wrong thing. | Defer SuperCalc and SuperAudit to v3.1+. SuperCards in v3.0 show COUNT aggregations using SQL (not HyperFormula). The spec explicitly defers this per milestone context. |
| **Configurable column pinning (freeze columns mid-grid)** | Excel allows you to freeze any column, not just the left edge. Users ask for this when they have wide grids. | SuperGrid's row headers are the PAFV axis labels, not arbitrary data columns. Pinning a data column (a column inside the grid, not a header) requires restructuring the rendering model to distinguish pinned vs. scrollable columns. The header pinning (SuperZoom upper-left anchor) is already the correct model. | SuperZoom pins the entire header region (row headers + column headers) to the upper-left corner. This is the correct behavior for a multidimensional axis grid. Individual data column pinning is a spreadsheet concept that does not map to the PAFV model. |
| **Conditional formatting rules** | Users coming from Excel want "highlight cells where value > 100 in red." | Conditional formatting requires a formula engine (HyperFormula — deferred) and a separate rule-management UI. It adds visual complexity that competes with the density model. SuperDensity already provides progressive disclosure of detail. | Encode visual state in card data (status, priority, tags) and let those drive cell styling through the existing LATCH category system. A "priority: high" card can have a red border without a separate conditional formatting rule engine. |

---

## Feature Dependencies

```
[PAFVProvider stacked axes + SuperGridQuery Worker wiring] ← FOUNDATION
    └──required-by──> [SuperDynamic] (axis drag-drop drives PAFVProvider)
    └──required-by──> [SuperDensity] (density SQL feeds GROUP BY)
    └──required-by──> [SuperSort] (ORDER BY appended to SuperGridQuery)
    └──required-by──> [SuperFilter] (WHERE clauses from FilterProvider)
    └──required-by──> [SuperTime] (time hierarchy SQL in GROUP BY)
    └──required-by──> [SuperCards] (aggregation queries per group)
    └──required-by──> [SuperSearch] (FTS5 WHERE feeds re-query)

[SuperPosition] ← coordinate tracking
    └──required-by──> [SuperZoom] (zoom restores to SuperPosition coordinates)
    └──enhances──> [SuperDynamic] (coordinates survive axis transpose)

[SuperSelect] ← selection z-layer disambiguation
    └──enhances──> [SuperDynamic] (selected cells move with axis)
    └──enhances──> [SuperCards] (selecting a SuperCard shows tooltip, not card select)
    └──enhances──> [SuperFilter] (header click → select group → filter to group)
    └──required-by──> [SuperTime] (non-contiguous time selection extends SelectionProvider)

[SuperSize] ← column/row resize
    └──independent-of──> most features (resize is visual-only, no SQL change)
    └──interacts-with──> [SuperStack span calculation] (resize changes px widths, spanning must reflow)
    └──interacts-with──> [SuperDynamic] (drag-dropped axis inherits persisted column width)

[SuperDensity Level 1: Value Density]
    └──required-by──> [SuperTime] (time hierarchy IS value density for time axis)

[SuperCards]
    └──requires──> [PAFVProvider stacked axes + SuperGridQuery Worker wiring]
    └──requires──> [SuperSelect] (different click behavior for SuperCard vs. data card)
    └──independent-of──> [SuperCalc] (v3.0 SuperCards use SQL COUNT only, not formulas)

[SuperSearch]
    └──requires──> [PAFVProvider stacked axes + SuperGridQuery Worker wiring]
    └──enhances──> [SuperFilter] (search narrows the data, filter narrows the view)
    └──reuses──> [FilterProvider.setSearchQuery() — already built]

[SuperFilter]
    └──requires──> [PAFVProvider stacked axes + SuperGridQuery Worker wiring]
    └──reuses──> [FilterProvider.setFilter() — already built]
    └──enhances──> [SuperSearch] (filter + search compose via AND in WHERE clause)

[SuperSort]
    └──requires──> [PAFVProvider stacked axes + SuperGridQuery Worker wiring]
    └──reuses──> [PAFVProvider.setSort() — already built]
```

### Dependency Notes

- **Foundation must ship first.** PAFVProvider stacked axes + SuperGridQuery Worker wiring is the prerequisite for dynamic axis manipulation. Without it, the grid is statically configured and cannot respond to user interaction. Every other Super* feature depends on this.
- **SuperPosition before SuperZoom.** Zoom restores to the last viewed coordinate. If coordinates are not tracked (SuperPosition), zoom has no anchor to restore to. SuperPosition also survives axis transpose — this is the key value of tracking by PAFV keys rather than pixel positions.
- **SuperSelect must handle z-layers before SuperCards.** If SuperCards are rendered before z-layer hit-test disambiguation (SuperSelect), clicks on SuperCards will accidentally select data cards beneath them. The geometric click zone logic (SuperGrid.md Section 6) must be implemented before SuperCards are interactive.
- **SuperTime extends SuperDensity, not replaces it.** SuperTime's time hierarchy collapse/expand is the Value Density mechanism applied to the time axis. SuperDensity Level 1 must work for generic axes first; SuperTime adds non-contiguous selection and smart hierarchy auto-grouping on top.
- **SuperSort and SuperFilter are orthogonal.** They compose naturally (filtered data can be sorted) and can be developed in parallel. Both append to the same SQL query via PAFVProvider + FilterProvider.

---

## MVP Definition

This is v3.0 (SuperGrid Complete), not a new product. Every feature in this milestone IS the MVP gate. The SuperGrid.md Section 11 acceptance criteria define the launch gate explicitly. Organized by build order:

### Foundation + Core Interaction (Build First)

- [ ] **PAFVProvider stacked axes + SuperGridQuery Worker wiring** — Without this, no other feature can drive the grid dynamically. This is Phase 1 of the build sequence per SuperGrid.md Section 8.
- [ ] **SuperPosition** — Coordinate tracking for all future features. First item in the spec's implementation sequence. Must exist before zoom, dynamic, and any feature that preserves position.
- [ ] **SuperSelect** — Z-axis aware selection with geometric click zones. Prerequisite for SuperCards (different click behavior) and SuperDynamic (selected cells follow axis moves).
- [ ] **SuperSize** — Column resize. Table stakes — without it, wide content is inaccessible.
- [ ] **SuperDynamic** — Axis drag-and-drop transpose. The signature differentiator. Complex but central to the PAFV promise.

### Navigation + Density

- [ ] **SuperZoom** — Pinned upper-left corner with pan. Table stakes for any large grid.
- [ ] **SuperDensity** — 4-level Janus model (Value + Extent as MVP minimum). Value Density collapses time hierarchy; Extent Density shows/hides empty intersections.

### Data Operations

- [ ] **SuperSort** — Per-column/group sort with header click. Table stakes.
- [ ] **SuperFilter** — Auto-filter dropdowns per column header. Table stakes.
- [ ] **SuperSearch** — FTS5 in-grid search with cell highlighting. Table stakes (Cmd+F behavior).
- [ ] **SuperTime** — Time hierarchy collapse + non-contiguous selection. Differentiator.

### Presentation

- [ ] **SuperCards** — Generated aggregation cards (COUNT) at group intersections. Differentiator. Requires SuperSelect z-layer logic.

### Deferred (NOT in v3.0)

- [ ] **SuperCalc** — HyperFormula PAFV-scoped formulas. Formula syntax unresolved. HyperFormula dependency substantial. Deferred to v3.1+.
- [ ] **SuperAudit** — Computed value visual distinction. Depends on SuperCalc. Deferred to v3.1+.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Build Order |
|---------|------------|---------------------|----------|-------------|
| PAFVProvider foundation wiring | HIGH (blocks all others) | HIGH | P1 | 1st |
| SuperPosition | HIGH (blocks zoom + dynamic) | MEDIUM | P1 | 2nd |
| SuperSelect | HIGH (blocks SuperCards) | MEDIUM | P1 | 3rd |
| SuperSort | HIGH (table stakes) | LOW | P1 | 4th |
| SuperFilter | HIGH (table stakes) | MEDIUM | P1 | 5th |
| SuperSearch | HIGH (table stakes, FTS5 ready) | LOW | P1 | 6th |
| SuperSize | HIGH (table stakes) | MEDIUM | P1 | 7th |
| SuperDynamic | HIGH (signature differentiator) | HIGH | P1 | 8th |
| SuperZoom | HIGH (table stakes for large grids) | MEDIUM | P1 | 9th |
| SuperDensity | HIGH (Janus model is core) | MEDIUM | P1 | 10th |
| SuperTime | MEDIUM (differentiator) | HIGH | P1 | 11th |
| SuperCards | MEDIUM (differentiator) | HIGH | P1 | 12th |
| SuperCalc | HIGH (deferred) | VERY HIGH | P3 | v3.1+ |
| SuperAudit | MEDIUM (deferred) | HIGH | P3 | v3.1+ |

**Priority key:**
- P1: Required for v3.0 milestone completion
- P2: Should ship in v3.0, add if time permits (none in this scope — all are P1)
- P3: Explicitly deferred per milestone context

---

## Competitor Feature Analysis

How the Super* features relate to what users know from existing tools:

| Feature | Excel / Numbers | Google Sheets | Airtable Grid | AG Grid (headless) | Isometry SuperGrid Approach |
|---------|-----------------|---------------|---------------|--------------------|-----------------------------|
| Column sort | Click header, asc/desc/multi | Click header | Click header | Sort by column | Same UX, but sort is PAFV-aware (sorts within each group independently via PAFVProvider.setSort) |
| Auto-filter | Dropdown per column header with checkboxes | Same | Same | Same | Same UX. FilterProvider already compiles the WHERE clause. The dropdown UI is new. |
| In-grid search | Cmd+F highlight bar | Same | Global search, not in-grid | Configurable | Cmd+F activates FTS5 search. Matching cells are highlighted via D3 class. FTS5 already built. |
| Column resize | Drag resize edge, double-click auto-fit | Same | Same | Same | Same UX. Resize edges at 4px borders. SuperGrid.md Section 6 specifies double-click auto-fit. |
| Multi-select | Click+Shift/Cmd, lasso | Same | Checkbox column | Row selection | Cmd+click toggle, Shift+click range, lasso drag. SelectionProvider already handles this logic. Z-layer disambiguation (headers vs. data vs. SuperCards) is Isometry-specific. |
| Density/zoom | Row height drag, zoom % slider | Zoom % | Row height | Configurable | 4-level Janus model: Value (hierarchy collapse), Extent (empty hide), View (spreadsheet vs. matrix), Region (per-axis density). More structured than pixel-level row height. |
| Scroll with frozen headers | Freeze Panes | Freeze rows/columns | Column pinning | Column pinning | SuperZoom pins upper-left corner. No arbitrary column pinning (anti-feature per PAFV model). |
| Axis transpose | TRANSPOSE formula | TRANSPOSE function | No transpose | No transpose | Direct manipulation: drag row axis to column position. No formula, no re-import. This is the core PAFV differentiator. |
| Time grouping | Group dates by month/quarter in pivot | No native grouping | Group by date field | Custom | Time hierarchy collapse: day/week/month/quarter/year with smooth animation. SQL strftime patterns already in DensityProvider. |
| Aggregation at intersections | Pivot table cell shows SUM | Same via QUERY | Summary row (not intersection) | Aggregation plugins | SuperCards: generated cards at group intersections with COUNT (v3.0) and formula aggregations (v3.1+). Intersection-level is unique. |

---

## What Users Already Know (Transition UX)

Users coming from Excel/Google Sheets bring strong muscle memory. SuperGrid should honor these conventions to minimize learning:

| Convention | Excel Behavior | SuperGrid Should Match |
|------------|---------------|----------------------|
| Column sort | Single click: asc → desc → none cycle | Match exactly |
| Resize handle | Hover shows resize cursor at column border, drag to resize, double-click auto-fit | Match exactly per SuperGrid.md Section 6 |
| Cmd+F / Ctrl+F | Opens find bar that highlights cells | Match: opens SuperSearch toolbar input |
| Shift+click range | Selects rectangular range | Match via SelectionProvider existing anchor logic |
| Cmd+click | Adds to selection | Match via SelectionProvider toggle option |
| Right-click on header | Context menu: Sort, Filter, Hide, etc. | Match: right-click shows context menu per SuperGrid.md Section 6 |
| Escape | Clears selection / cancels operation | Match via SelectionProvider.selectNone() |
| Double-click cell | Edit cell | Isometry: opens card detail. Users will learn this quickly. |
| Column header filter indicator | Funnel icon shows when filter is active | Match: show indicator in column header when FilterProvider has active filter for that column |

**Where SuperGrid intentionally departs:**
- **No in-grid typing** — Cards have rich content, not text cells. Double-click opens the card detail view.
- **No arbitrary column pinning** — The PAFV axis model has header columns (which are always pinned by SuperZoom) and data cells (which scroll). This is different from Excel's arbitrary column freeze.
- **Axis drag** is not a spreadsheet convention. Users need discovery affordance: a drag handle indicator in the axis header, tooltip on hover explaining "drag to transpose."

---

## Sources

- `v5/Modules/SuperGrid.md` — canonical SuperGrid spec (56KB), all feature behaviors, acceptance criteria, interaction tables, design decisions
- `v5/Modules/Core/Providers.md` — PAFVProvider, FilterProvider, SelectionProvider, DensityProvider — all existing APIs that Super* features wire into
- `.planning/PROJECT.md` — v3.0 milestone scope, deferred features list, constraints
- AG Grid feature set: [AG Grid high-performance grid](https://www.ag-grid.com/)
- TanStack Table sorting/filtering: [TanStack Table column filtering guide](https://tanstack.dev/table/latest/docs/guide/column-filtering)
- Data table UX patterns: [Pencil & Paper — Enterprise data table UX](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- Pivot table UX: [Holistics pivot table UX improvements 2024](https://docs.holistics.io/release-notes/2024-04-pivot-ux)
- Enterprise table design: [Stephanie Walter — resources for complex data tables](https://stephaniewalter.design/blog/essential-resources-design-complex-data-tables/)
- Lasso selection patterns: [ReactFlow lasso selection example](https://reactflow.dev/examples/whiteboard/lasso-selection)

---

*Feature research for: Isometry v3.0 SuperGrid Complete — 12 Super* interactive features*
*Researched: 2026-03-03*
