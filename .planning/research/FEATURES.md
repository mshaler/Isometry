# Feature Landscape: v5.2 SuperCalc + Workbench Phase B

**Domain:** SQL aggregate calculations, rich markdown editing, embedded data charts, histogram filters, category chip filters
**Researched:** 2026-03-09
**Confidence:** HIGH -- patterns well-established from Excel/Notion/Airtable/AG Grid (aggregate footers), GitHub/DEV.to/Jira (markdown toolbars), Observable/Tableau (embedded charts), Airbnb/Crossfilter (histogram filters), Algolia/Notion (category chips)

**Comparable products studied:** Excel Pivot Tables (aggregate footers), Google Sheets (SUBTOTAL), Notion (Calculate footer + database views), Airtable (Summary Bar per group), AG Grid (aggFunc + groupTotalRow), GitHub (markdown toolbar), DEV.to (markdown toolbar), Observable (reactive chart cells), Tableau (embedded viz), Airbnb (histogram price slider), Crossfilter (coordinated histograms)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or broken.

### 1. SQL Aggregate Footer Rows

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| SUM/AVG/COUNT/MIN/MAX per column per group | Every pivot table (Excel, Google Sheets, Notion, Airtable, AG Grid) shows per-group subtotals at group boundaries. Notion: "Calculate" at column footer. Airtable: summary bar per group. AG Grid: `aggFunc` per column definition | **Medium** | SuperGridQuery, PAFVProvider, SuperGrid renderer | Already have `AggregationMode` type and aggregation support in SuperGridQuery (Phase 55 PROJ-06). Need per-column extension, not from-scratch |
| Grand total row (all groups) | Excel pivot tables ALWAYS show grand total; Airtable summary bar includes total for entire view. Baserow shows footer aggregation for full column | **Low** | Same query infrastructure, additional pinned bottom row | Single additional SQL query without GROUP BY, same aggregate functions. Renders as pinned bottom row |
| Per-column function selector | Users expect different functions per column (SUM for amounts, AVG for ratings, COUNT for everything). Notion: click footer to pick function. AG Grid: `aggFunc` per column definition | **Medium** | Workbench panel UI, per-column config model | Config stored in ui_state (Tier 2). Map of `{field: AggregationMode}`. Default: COUNT for all columns |
| Aggregates respect active filters | When filters narrow the dataset, aggregates must recalculate. Airtable explicitly notes "aggregations respect active filters on the view" | **Low** | Already handled -- SuperGridQuery composes FilterProvider WHERE | Zero additional work for filter scoping. SuperGridQuery already builds WHERE from FilterProvider.compile() |
| Numeric-only aggregate guard | SUM/AVG on text columns should show dash or be disabled, not error. Notion defaults to COUNTA for text, SUM for numbers | **Low** | Column type detection from schema | sql.js returns 0 for SUM on text (not error), but UX should disable SUM/AVG options for non-numeric fields. Only `priority`, `sort_order`, `latitude`, `longitude` are numeric in schema |
| Footer row visual distinction | Footer rows must be visually distinct from data rows (bold, background tint, separator line). Every spreadsheet does this | **Low** | CSS class `.sg-footer-row` with design tokens | Use existing `--sg-*` token family. Bold text + subtle background tint + top border separator |

**Implementation insight:** The existing `buildSuperGridQuery()` already supports an `aggregation` config field (Phase 55 PROJ-06) that compiles to `SUM(field) AS count`, `AVG(field) AS count`, etc. SuperCalc extends this to produce multiple aggregates per group. The efficient approach is a single SELECT with multiple aggregate expressions:

```sql
SELECT folder, SUM(priority) AS sum_priority, AVG(sort_order) AS avg_sort_order, COUNT(*) AS count_all
FROM cards WHERE deleted_at IS NULL GROUP BY folder
```

**Existing code touchpoints:**
- `SuperGridQuery.ts` -- extend `buildSuperGridQuery()` or add `buildAggregateFooterQuery()`
- `supergrid.handler.ts` -- new handler for aggregate query (or extend existing)
- `SuperGrid.ts` -- inject footer rows into CSS Grid after each group's data rows
- `types.ts` -- `AggregationMode` already defined ('count' | 'sum' | 'avg' | 'min' | 'max')

### 2. Markdown Formatting Toolbar

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Bold/Italic/Link buttons | Universal standard (GitHub, Notion, Jira, VS Code, Windows Notepad 2025). Toolbar makes existing Cmd+B/I/K discoverable. DEV.to: "buttons for common formatting with keyboard shortcut tooltips" | **Low** | Existing `_wrapSelection('**', '**')` method | Already implemented as keyboard shortcuts in NotebookExplorer. Toolbar is buttons that call the same method |
| Heading buttons (H1-H3) | Standard in all markdown editors. Prefix-based wrapping (`# `, `## `, `### `) | **Low** | New `_prefixLine()` helper | Line-prefix differs from inline-wrap -- operates on full line(s), not selection endpoints |
| List buttons (UL, OL, checklist) | Expected in any writing tool. Multi-line selection should prefix EACH line | **Low** | Same `_prefixLine()` pattern | `- ` for UL, `1. ` for OL, `- [ ] ` for checklist. Multi-line: iterate `\n`-split lines |
| Code/blockquote buttons | Standard formatting options. Inline code wraps with backticks, blockquote prefixes with `> ` | **Low** | `_wrapSelection` for inline code, `_prefixLine` for blockquote | Inline code: backtick wrapper. Code block: triple-backtick multi-line wrapper. Blockquote: `> ` prefix per line |
| Shortcut tooltip on each button | Every modern toolbar shows shortcuts on hover. "Bold (Cmd+B)" | **Trivial** | `title` attribute on buttons | Standard `title` tooltip. No custom tooltip system needed |
| Toolbar disabled in Preview mode | Buttons should be inactive when viewing rendered preview | **Trivial** | Existing `_activeTab` state | Add `disabled` attribute or `pointer-events: none` when `_activeTab === 'preview'` |

**Implementation insight:** DEV.to's toolbar uses two core functions: `undoOrAddFormattingForInlineSyntax` (bold, italic, code) and `undoOrAddFormattingForMultilineSyntax` (lists, code blocks, blockquotes). The existing `_wrapSelection(before, after)` handles the first category. A new `_prefixLine(prefix)` handles the second.

**Existing code touchpoints:**
- `NotebookExplorer.ts` -- add toolbar DOM in `mount()`, add `_prefixLine()` method
- `notebook-explorer.css` -- toolbar layout styles

### 3. Notebook Persistence to Database

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Content survives page reload | Currently session-only (`_content` class field). Users WILL lose work. This is the most frustrating gap in the notebook | **Medium** | ui_state table via StateManager + WorkerBridge | Store as `ui_state` key `'notebook'` with Markdown text as value. Follows existing Tier 2 persistence pattern (FilterProvider, PAFVProvider, DensityProvider all use this) |
| Debounced auto-save | Users expect auto-save (Google Docs, Notion, Apple Notes). No save button | **Low** | 500ms debounce (matches StateManager pattern) | Use `markDirty()` debounce from StateManager. Immediate write on tab switch to Preview |
| Content loads on app start | Notebook should show previously-written content when app opens | **Low** | `StateManager.restore()` flow | NotebookExplorer implements `PersistableProvider` interface (toJSON/setState/resetToDefaults). StateManager restores on init |
| Content syncs via CloudKit | Desktop notes should appear on mobile | **Medium** | CloudKit record sync (v4.1 infrastructure) | If stored in `ui_state`, needs ui_state included in CKSyncEngine record types. Currently only cards and connections sync. Evaluate promoting to Tier 1 or adding ui_state sync |

**Existing code touchpoints:**
- `NotebookExplorer.ts` -- implement `PersistableProvider`, register with StateManager
- `StateManager.ts` -- register notebook provider (existing `registerProvider()` API)
- `ui-state.handler.ts` -- no changes needed (generic key-value handler)

### 4. Category Chip Multi-Select Filters

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Clickable tag/category chips | Visual, scannable filter controls for categorical data. Current checkbox lists work but feel utilitarian compared to chip UIs in Notion, Airtable, Algolia | **Medium** | FilterProvider.setAxisFilter(), existing distinct values fetch | Chips replace checkbox lists for `folder`, `status`, `card_type` fields in Category (C) and `priority` in Hierarchy (H) sections |
| Selected chip visual distinction | Active chips filled/highlighted vs outlined inactive. Standard faceted search pattern | **Low** | CSS `.latch-chip--active` class toggle | Background fill + text color inversion for active state. Use existing design tokens |
| Count badge per chip | "Blue (47)" tells users how many items match before selecting. Prevents zero-result frustration. Airtable and Notion both show counts | **Medium** | Per-value COUNT query via extended `db:distinct-values` handler | Extend to return `{value, count}[]`. Single query: `SELECT field, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY field` |
| "Clear all" for chip section | One-click reset for a filter group. Standard in faceted search | **Low** | Existing `_handleClearAll()` in LatchExplorers | Already implemented. Extend to clear chip-based filters identically |
| Horizontal wrap layout | Chips flow horizontally, wrapping to next line. Standard chip layout | **Low** | CSS `display: flex; flex-wrap: wrap; gap: 6px` | Max-height with scroll for 20+ values |

**Implementation insight:** Category chips are a visual upgrade over the existing D3 `selection.join()` checkbox rendering in LatchExplorers. The filter wiring is identical (`FilterProvider.setAxisFilter(field, selectedValues)`). The change is purely presentation: checkbox labels become chip buttons. The D3 data join pattern (enter/update/exit) works identically for chips.

**Existing code touchpoints:**
- `LatchExplorers.ts` -- replace `_renderCheckboxes()` with `_renderChips()` for C and H sections
- `latch-explorers.css` -- chip component styles
- `supergrid.handler.ts` or new handler -- extend distinct-values to include counts

### 5. Histogram Scrubber Filters

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Distribution visualization (bar chart over range) | Airbnb price slider established this as the gold standard for range filtering. Shows data shape before filtering | **High** | D3 SVG mini bar chart, range query for histogram bins, LatchExplorers integration | Full pipeline: (1) fetch range from db, (2) compute bins, (3) render SVG bars, (4) overlay range handles |
| Drag-to-select range | Click and drag on histogram to define min/max filter range. Two-handle slider overlaid on histogram bars | **High** | Pointer event handling, FilterProvider.addFilter({gte/lte}) | Crossfilter pattern: <30ms interaction. Two handles that constrain range. Bars outside range dim |
| Auto-binning | Histogram bins auto-detect appropriate granularity for numeric and time fields | **Medium** | SQL-based binning or d3.bin() configuration | 10-20 bins for numeric. For time fields, use existing STRFTIME_PATTERNS from SuperGridQuery |
| Keyboard accessible range | WCAG 2.1 AA. Arrow keys adjust range handles, Home/End for min/max | **Medium** | ARIA slider role attributes | `role="slider"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow` |
| Responsive to filter changes | When other filters narrow dataset, histogram reflects filtered subset | **Medium** | Re-query on FilterProvider change | Subscribe to FilterProvider changes, re-fetch histogram data with current WHERE clause |

**Implementation insight:** The histogram scrubber is the highest-complexity feature. Simplification: use sql.js for binning queries rather than client-side d3.bin(). SQL approach:

```sql
SELECT CAST((priority - min_val) / bin_width AS INT) AS bin,
       COUNT(*) AS count, MIN(priority) AS bin_min, MAX(priority) AS bin_max
FROM cards, (SELECT MIN(priority) AS min_val, (MAX(priority) - MIN(priority) + 1) / 10.0 AS bin_width
             FROM cards WHERE deleted_at IS NULL)
WHERE deleted_at IS NULL GROUP BY bin ORDER BY bin
```

**Existing code touchpoints:**
- `LatchExplorers.ts` -- add histogram sections for Time (T) and numeric fields
- New `HistogramScrubber.ts` -- standalone component with D3 SVG rendering + pointer interaction
- New worker handler or extension -- histogram binning queries
- `FilterProvider` -- existing `addFilter({gte/lte})` handles range filter application

---

## Differentiators

Features that set the product apart. Not expected by users, but valued when present.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Embedded D3 chart blocks in notebook** | Observable-style reactive chart cells reflecting live query data. No other local-first tool does this. The defining differentiator of v5.2 | **High** | Notebook persistence (must ship first), SuperGridQuery data feed, custom marked renderer, DOMPurify SVG allowlist | Chart blocks are NOT full Observable -- pre-configured mini-visualizations (bar, line, sparkline) bound to current grid data. Use markdown fence syntax |
| Toolbar toggle formatting | GitHub/DEV.to detect existing formatting and toggle it off. Bold on bold text removes bold. Professional touch | **Medium** | Detection of existing markdown syntax around selection | DEV.to: `undoOrAddFormattingForInlineSyntax` checks if wrapped in markers and removes. Adds ~30 lines to `_wrapSelection()` |
| Aggregate-aware collapse | Footer aggregates update when column headers collapse. Collapsed group shows aggregate of collapsed children | **Medium** | Existing collapse system (v3.1) + aggregate footer re-query | Footer SQL must be re-issued when collapse state changes to reflect narrower group |
| Multiple calc functions per footer | Show SUM and AVG simultaneously in the same footer row | **Low** | Multiple cells per column in footer row | Single SQL query returns all requested aggregates per group |
| Chart block auto-refresh | Charts update when switching to Preview tab to reflect latest grid data | **Low** | Re-query on tab switch event | Fetch fresh SuperGridQuery data when switching to Preview, re-render chart SVG |
| Chart block type selector | User picks bar/line/sparkline/pie per block | **Medium** | Chart factory pattern, D3 renderer per type | Start with bar chart only. Line and sparkline are low-cost additions |
| Chip color coding by category value | Status chips green/yellow/red. Folder chips distinct colors. Notion-style colored tags | **Medium** | Color mapping per value, d3.scaleOrdinal | d3.scaleOrdinal(d3.schemeCategory10) for automatic color assignment |
| Histogram current-value indicator | When active cell has a numeric value, histogram shows a vertical line at that position | **Low** | Active cell value + histogram SVG overlay | Links SuperGrid active cell to histogram distribution context |
| SQL ROLLUP subtotals | Multi-level subtotals for N-level axis stacking. Excel does this automatically in pivot tables | **High** | SQL ROLLUP support in sql.js, multi-level footer injection | Powerful but complex rendering. Defer to future milestone |

---

## Anti-Features

Features to explicitly NOT build in v5.2.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **HyperFormula / formula engine** | ~500KB bundle, unsolved PAFV formula syntax. Permanently replaced by SQL DSL approach (PROJECT.md). Would need cell reference system, formula parser, circular dependency detection | SQL GROUP BY with SUM/AVG/COUNT/MIN/MAX via `buildSuperGridQuery()` extension. `AggregationMode` type already exists |
| **contenteditable notebook editor** | contenteditable is notoriously buggy, especially in WKWebView. Cursor positioning, selection, undo are fragile. Every major editor (ProseMirror, TipTap, Slate) exists because contenteditable is broken | Markdown textarea with formatting toolbar buttons calling `_wrapSelection()` / `_prefixLine()`. Preview via marked + DOMPurify (already working) |
| **Full Observable reactive notebook runtime** | Observable's cell dependency graph is an entire runtime (~100KB+). Cells reference other cells, topological sort determines execution order. Massive scope far beyond v5.2 | Pre-configured chart blocks with fixed data binding (current grid query result). No cell-to-cell reactivity |
| **In-cell formula editing (=SUM(A1:A10))** | Requires cell reference system (A1 or R1C1), formula parser, circular dependency detection, recalculation engine. Cells in SuperGrid are group intersections, not individual data points | SQL aggregate footer rows. Footer rows are the appropriate abstraction for PAFV projection (aggregation over group, not over cell range) |
| **Crossfilter.js dependency** | 65KB library with own data model duplicating sql.js. Dimensional indexing competes with SQLite indexes. Violates "database is the truth" (D-001) | sql.js for all filtering (system of record). Histogram queries use GROUP BY binning. Re-query on filter change fast enough for 1K-10K cards |
| **execCommand() for formatting** | Deprecated API (MDN: "no longer recommended"). Not supported in textarea elements -- only works with contenteditable | Selection-based text wrapping via `selectionStart`/`selectionEnd` (already in `_wrapSelection()`) |
| **Cross-device notebook sync in v5.2** | Requires promoting notebook to CKSyncEngine record type or adding ui_state sync. Significant CloudKit schema change | Use Tier 2 ui_state persistence for v5.2. Evaluate CloudKit sync in future milestone |
| **Client-side d3.bin() for histogram** | Fetching all raw values to client for binning wastes bandwidth when sql.js can compute bins in Worker | SQL-based binning in Worker thread. Single query returns bin edges and counts |
| **Conditional formatting rules** | Requires formula engine and per-cell style evaluation. Out of scope per PROJECT.md | Not in v5.2 scope |
| **Chip drag-and-drop reorder** | Adds interaction complexity for marginal value. Filter order does not affect semantics | Click-to-toggle is sufficient for multi-select. Chip order follows alphabetical/value sort |
| **Real-time chart updates on every filter change** | Charts re-rendering while user adjusts filters causes flicker and performance overhead | Fetch chart data only on Preview tab activation. Stable rendering, no flicker |

---

## Feature Dependencies

```
SQL Aggregate Footer Rows:
  SuperGridQuery.buildSuperGridQuery() [existing] -> Aggregate footer SQL [new method/extension]
  PAFVProvider.compile() [existing] -> GROUP BY axes
  FilterProvider.compile() [existing] -> WHERE clause (aggregates respect filters)
  SuperGrid.ts renderer [existing] -> Footer row DOM injection after each group
  Workbench panel [new UI] -> Per-column function selector
  types.ts AggregationMode [existing] -> count|sum|avg|min|max
  StateManager [existing] -> Persist aggregate config (Tier 2)

Markdown Formatting Toolbar:
  NotebookExplorer._wrapSelection() [existing] -> Inline formatting (bold, italic, link, code)
  _prefixLine() [new helper] -> Block formatting (headings, lists, blockquote)
  Toolbar DOM [new] -> Buttons wired to formatting helpers
  _activeTab state [existing] -> Toolbar disabled in Preview mode

Notebook Persistence:
  ui_state table [existing] -> Storage mechanism
  StateManager [existing] -> Debounced auto-save via markDirty()
  PersistableProvider interface [existing] -> toJSON()/setState()/resetToDefaults()

D3 Chart Blocks (depends on persistence):
  Notebook persistence [MUST ship first] -> Chart content saved across reloads
  SuperGridQuery data [existing] -> Chart data source
  D3 SVG rendering [new] -> Chart visualization pipeline
  marked custom renderer [new] -> Parse chart fence syntax in markdown
  DOMPurify ALLOWED_TAGS extension [modify] -> Allow SVG elements in preview

Category Chips:
  FilterProvider.setAxisFilter() [existing] -> Multi-select filter application
  db:distinct-values handler [existing, extend] -> Return {value, count}[]
  LatchExplorers._renderCheckboxes() [existing, replace] -> _renderChips()
  D3 selection.join [existing pattern] -> Chip enter/update/exit lifecycle

Histogram Scrubber:
  D3 SVG mini chart [new] -> Bar rendering in LATCH panel
  FilterProvider.addFilter({gte/lte}) [existing] -> Range filter application
  New histogram binning query [new handler] -> SQL-based bin computation
  Pointer events [new] -> Drag-to-select range interaction
  LatchExplorers [existing] -> Container integration
```

**Critical dependency chain:**
1. **Notebook persistence MUST ship before D3 chart blocks** -- chart content needs to survive reload
2. **Aggregate footer rows are fully independent** -- no dependency on other v5.2 features
3. **Formatting toolbar is independent** -- extends existing NotebookExplorer
4. **Histogram and chips are independent of each other** but both extend LatchExplorers
5. **Category chips should ship before histograms** -- lower complexity, validates the LATCH panel extension pattern

---

## MVP Recommendation

### Phase 1: SuperCalc Foundation (aggregate footers)
Priority: **Highest** -- headline feature of v5.2, no dependencies on other features.

1. SQL aggregate footer query builder (extend SuperGridQuery or new method)
2. Footer row renderer (inject `.sg-footer-row` after each group in CSS Grid)
3. Per-column aggregate config (Map of `{field: AggregationMode}`, Tier 2 persistence)
4. Workbench aggregate panel (dropdown per column, or inline footer cell click like Notion)
5. Grand total row (pinned bottom row with cross-group aggregates)

### Phase 2: Notebook Phase B (persistence + toolbar)
Priority: **High** -- persistence eliminates most frustrating gap; toolbar is low-cost discoverability win.

6. Notebook persistence (implement PersistableProvider, register with StateManager)
7. Formatting toolbar (bold/italic/heading/list/link/code buttons)
8. Keyboard shortcut extensions (Cmd+Shift+1/2/3 for H1/H2/H3)

### Phase 3: LATCH Phase B (chips + histograms)
Priority: **Medium** -- visual filter upgrades.

9. Category chip multi-select filters (replace checkbox lists in C and H sections)
10. Histogram scrubber for time fields (D3 SVG mini chart with drag-to-select range)

### Phase 4: Chart Blocks (differentiator)
Priority: **Lower** -- highest complexity, depends on Phase 2 persistence.

11. D3 chart block rendering (bar chart bound to current grid query)
12. Custom marked renderer (parse chart fence syntax)
13. DOMPurify SVG allowlist (extend ALLOWED_TAGS for SVG elements)

**Defer beyond v5.2:**
- Per-group per-column aggregate config (ship global per-column first)
- SQL ROLLUP hierarchical subtotals (complex rendering for N-level stacking)
- Crossfilter coordination (use sql.js re-query instead)
- Chart block type selector beyond bar chart (add incrementally)
- Toggle formatting detection (professional touch, not blocking)

---

## Complexity Assessment

| Feature | Lines of Code (est.) | Test Coverage Needed | Risk Level |
|---------|---------------------|---------------------|------------|
| Aggregate footer rows | 400-600 TS | SQL query tests, renderer tests, Workbench panel tests, filter-scoping tests | **Low** -- extends proven SuperGridQuery and PAFVProvider patterns |
| Grand total row | 100-150 TS | Pinned row rendering, aggregate accuracy | **Low** -- subset of footer row work |
| Formatting toolbar | 200-300 TS + 100 CSS | Button rendering, formatting output (bold/italic/heading/list), disabled-in-preview | **Low** -- mechanical DOM work extending existing `_wrapSelection()` |
| Notebook persistence | 150-250 TS | StateManager integration, round-trip, restore-on-start | **Low** -- follows established Tier 2 PersistableProvider pattern |
| Category chips | 300-400 TS + 150 CSS | Chip rendering, filter integration, count queries, D3 join lifecycle | **Medium** -- new visual component, identical filter wiring |
| Histogram scrubber | 500-700 TS + 200 CSS | Binning logic, SVG rendering, range interaction, keyboard a11y, filter integration | **High** -- most novel component, full D3 mini-viz pipeline |
| D3 chart blocks | 600-900 TS + 100 CSS | Chart rendering, data binding, marked renderer, DOMPurify SVG, lifecycle | **High** -- multiple integration points |

**Total estimated new code:** ~2,350-3,400 TS + ~550 CSS lines

---

## Sources

### Aggregate Footer Rows
- [Notion Table View -- Calculate Footer](https://www.notion.com/help/tables)
- [Airtable Summary Bar](https://support.airtable.com/docs/using-the-summary-bar-in-airtable-views)
- [AG Grid Aggregation](https://www.ag-grid.com/javascript-data-grid/aggregation/)
- [AG Grid Total Rows](https://www.ag-grid.com/javascript-data-grid/aggregation-total-rows/)
- [Baserow Footer Aggregation](https://baserow.io/user-docs/footer-aggregation)
- [SQL ROLLUP and GROUPING SETS](https://medium.com/@glbaris19/sql-group-by-grouping-sets-pivot-rollup-78f77a51a7d9)
- [Google Sheets Pivot Table Guide](https://smoothsheet.com/blog/how-to/google-sheets-pivot-table/)
- [Aggregations in Power Pivot](https://support.microsoft.com/en-us/office/aggregations-in-power-pivot-f36a448a-4962-4baf-baa2-68187b6387ce)

### Markdown Formatting Toolbar
- [DEV.to -- How We Made the Markdown Toolbar](https://dev.to/devteam/how-we-made-the-markdown-toolbar-4f09)
- [Markdown Keyboard Shortcuts Guide](https://blog.markdowntools.com/posts/markdown-keyboard-shortcuts-and-hotkeys-guide)
- [Jira Markdown and Keyboard Shortcuts](https://support.atlassian.com/jira-software-cloud/docs/markdown-and-keyboard-shortcuts/)
- [MDN -- execCommand (deprecated)](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
- [EasyMDE -- Embeddable Markdown Editor](https://github.com/Ionaru/easy-markdown-editor)

### Embedded Chart Blocks
- [Observable Notebook Architecture](https://observablehq.com/documentation/notebooks/)
- [Observable Advanced Embeds](https://observablehq.com/documentation/embeds/advanced)
- [D3 Sparklines with Codrops](https://tympanus.net/codrops/2022/03/29/building-an-interactive-sparkline-graph-with-d3/)
- [Building Dashboards with D3](https://embeddable.com/blog/how-to-build-dashboards-with-d3)
- [Designing Real-Time Dashboards with D3.js](https://reintech.io/blog/designing-real-time-data-dashboards-d3-js)

### Histogram Scrubber Filters
- [Crossfilter Library](https://square.github.io/crossfilter/)
- [Airbnb Rheostat Slider](https://github.com/airbnb/rheostat)
- [Smashing Magazine -- Designing Perfect Slider](https://www.smashingmagazine.com/2017/07/designing-perfect-slider/)
- [ArcGIS -- Select and Filter with Histograms](https://pro.arcgis.com/en/pro-app/latest/help/data/knowledge/select-and-filter-content-with-histograms.htm)

### Category Chip Filters
- [Filter UI Patterns 2025](https://bricxlabs.com/blogs/universal-search-and-filters-ui)
- [Faceted Search Best Practices -- Algolia](https://www.algolia.com/blog/ux/faceted-search-and-navigation)
- [Faceted Search Best Practices 2026](https://www.brokenrubik.com/blog/faceted-search-best-practices)
- [Filter UI and UX 101](https://www.uxpin.com/studio/blog/filter-ui-and-ux/)
- [SaaS Filter UI Examples](https://arounda.agency/blog/filter-ui-examples)
