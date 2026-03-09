# Project Research Summary

**Project:** Isometry v5.2 SuperCalc + Workbench Phase B
**Domain:** SQL aggregate calculations, rich notebook editing with embedded charts, histogram/chip filter upgrades
**Researched:** 2026-03-09
**Confidence:** HIGH

## Executive Summary

v5.2 adds three feature clusters to the existing Isometry v5 web runtime: (1) SuperCalc -- SQL-driven aggregate footer rows in SuperGrid with per-column function selectors, (2) Workbench Notebook Phase B -- formatting toolbar, database persistence, and embedded D3 chart blocks in Markdown preview, and (3) LATCH Phase B -- histogram scrubber filters for time/numeric fields and category chip multi-select filters. These are well-understood patterns drawn from Excel/Notion/Airtable (aggregate footers), GitHub/DEV.to (markdown toolbars), Observable (embedded charts), and Airbnb/Crossfilter (histogram filters).

The recommended approach builds entirely on the existing stack: zero new npm dependencies, one new Worker message type (`supergrid:calc`), and modifications to 10-11 existing files. The architecture maps cleanly onto established patterns -- parallel Worker queries for SuperCalc, textarea Markdown insertion for the toolbar, `ui_state` key-value persistence for notebook content, post-sanitization D3 mount for chart blocks, and D3 `selection.join()` for histogram bars and category chips. Total estimated new code is 2,350-3,400 lines of TypeScript plus ~550 lines of CSS across 6 phases.

The principal risks are: (1) the existing `_wrapSelection()` method destroys the browser undo stack when modifying `textarea.value` directly -- this must be fixed before adding toolbar buttons, (2) D3 chart blocks must never inject SVG through DOMPurify's sanitizer -- a two-pass rendering approach (placeholder divs then programmatic D3 mount) is mandatory, (3) if notebook persistence uses a new column on `cards`, there is no schema migration runner and CloudKit's `INSERT OR REPLACE` will silently wipe unrecognized columns, and (4) histogram scrubbers must atomically replace (not compound) range filters on shared fields. All four risks have clear, documented mitigations.

## Key Findings

### Recommended Stack

No changes to `package.json`. Every feature is implemented with the existing stack: TypeScript 5.9 (strict), sql.js 1.14 (FTS5 WASM), D3.js v7.9, marked, DOMPurify, Vite 7.3, Vitest 4.0, Biome 2.4.6.

**New API surface used from existing dependencies:**
- **d3.brushX()** (from d3-brush, already in d3 umbrella) -- drag-to-select range interaction for histogram scrubbers
- **marked.use() renderer extension** -- intercepts fenced `chart` code blocks to produce placeholder divs for D3 chart mounting
- **SQLite aggregate functions** (SUM, AVG, COUNT, MIN, MAX via sql.js) -- all SuperCalc computation; GROUP BY with multiple aggregate expressions in a single query

No alternatives were needed. Chart.js/Recharts rejected (200KB+ for mini-charts when D3 is loaded). Prosemirror/TipTap rejected (100-500KB for a notebook sidebar). Crossfilter.js rejected (65KB with its own data model duplicating sql.js, violates D-001).

### Expected Features

**Must have (table stakes):**
- SQL aggregate footer rows (SUM/AVG/COUNT/MIN/MAX per column per group) -- every spreadsheet/pivot tool provides this
- Grand total row (pinned bottom, cross-group aggregates)
- Per-column function selector with numeric-only guard (disable SUM/AVG for text columns)
- Markdown formatting toolbar (bold/italic/heading/list/link/code buttons)
- Notebook persistence to database (auto-save, survive reload, load on mount)
- Category chip multi-select filters with count badges
- Histogram scrubber filters for time/numeric fields with drag-to-select range

**Should have (differentiators):**
- Embedded D3 chart blocks in notebook preview -- Observable-style mini-visualizations bound to grid data; the defining differentiator of v5.2
- Toolbar toggle formatting (bold on bold text removes bold)
- Aggregate-aware collapse (footer updates when groups collapse)
- Chart block type selector (bar/line/sparkline/pie)
- Chip color coding by category value (Notion-style colored tags)

**Defer beyond v5.2:**
- HyperFormula / formula engine (replaced by SQL DSL)
- contenteditable notebook editor (textarea + Markdown is sufficient)
- Full Observable reactive notebook runtime (too much scope)
- In-cell formula editing (A1-style references require entire calculation engine)
- Cross-device notebook sync (requires CloudKit schema changes)
- SQL ROLLUP hierarchical subtotals (complex multi-level rendering)
- Crossfilter.js coordination (sql.js re-query is sufficient)
- Conditional formatting rules (requires formula engine)

### Architecture Approach

All five integration points map onto existing patterns with no new architectural concepts. SuperCalc uses a parallel `supergrid:calc` Worker query with a different GROUP BY granularity from the existing cell query, rendered as sticky `position: sticky; bottom: 0` footer rows in the CSS Grid. The notebook toolbar adds buttons that call the existing `_wrapSelection()` method (after fixing the undo stack issue) and a new `_insertBlock()` prefix method. Notebook persistence stores content via the existing `ui:set`/`ui:get` Worker handlers against the `ui_state` table with a `notebook:content` key. D3 chart blocks use a two-pass approach: custom `marked` renderer outputs sanitizable placeholder divs, then `_mountChartBlocks()` creates D3 SVG programmatically after DOMPurify runs. LATCH histogram/chips extend `LatchExplorers` sections with new sub-component rendering methods wired to the existing `FilterProvider` API.

**Major components modified (no new files):**
1. **SuperGridQuery.ts** -- new `buildSuperCalcQuery()` function for column-level aggregates
2. **SuperGrid.ts** -- new `_renderFooterRow()` method, parallel query dispatch via `Promise.all()`
3. **NotebookExplorer.ts** -- toolbar DOM, `_insertBlock()`, persistence via bridge, custom `marked` renderer, `_mountChartBlocks()` post-render
4. **LatchExplorers.ts** -- `_renderHistogram()` in Time section, `_renderChips()` in Category section
5. **PAFVProvider.ts** -- new `calcConfig` state for aggregate function selection
6. **protocol.ts** -- new `supergrid:calc` request/response types

### Critical Pitfalls

1. **Textarea undo stack destruction (P4)** -- The existing `_wrapSelection()` sets `textarea.value` directly, which destroys the browser's native undo history. Every toolbar action makes Cmd+Z non-functional. Fix: use `document.execCommand('insertText')` or `textarea.setRangeText()` which preserve the undo stack. This must be refactored BEFORE adding toolbar buttons.

2. **DOMPurify XSS bypass via chart blocks (P3)** -- If SVG tags are added to DOMPurify's allowlist for chart rendering, SVG's `<script>`, `onload`, and `<foreignObject>` vectors open XSS in the WKWebView context. Fix: two-pass rendering where DOMPurify sees only safe placeholder divs, then D3 creates SVG programmatically after sanitization. Never use `.html()` for user-derived content in charts.

3. **Schema migration absent for existing databases (P1)** -- If notebook persistence requires a new column or table, existing hydrated databases will lack it. There is no `PRAGMA user_version` tracking, no migration runner, and the checkpoint hydration path skips `applySchema()` entirely. Fix: add migration infrastructure if a schema change is needed. Alternatively, the `ui_state` key-value approach avoids this entirely for v5.2.

4. **CloudKit INSERT OR REPLACE wipes new columns (P2)** -- `buildCardMergeSQL()` hard-codes 26 column names. `INSERT OR REPLACE` is DELETE + INSERT, so any column not listed is set to NULL. Adding a column without updating the merge SQL and CloudKit record mapping causes silent cross-device data loss. Fix: update merge SQL, or better, migrate to `INSERT ... ON CONFLICT DO UPDATE SET` (UPSERT) which preserves unmentioned columns.

5. **FilterProvider range filters compound instead of replacing (P8)** -- Histogram scrubbers and LATCH time presets both add `gte`/`lte` filters on the same fields. `addFilter()` appends, creating competing WHERE clauses. Fix: add `setRangeFilter(field, min, max)` that atomically replaces range filters for a given field.

## Implications for Roadmap

Based on research, suggested phase structure (6 phases, continuing from Phase 61):

### Phase 62: SuperCalc Footer Rows
**Rationale:** Headline feature of v5.2 with zero dependencies on other v5.2 features. Highest user value, proven patterns from Excel/Notion/AG Grid.
**Delivers:** Per-column SQL aggregate footer rows (SUM/AVG/COUNT/MIN/MAX), grand total row, per-column function selector in Workbench panel.
**Addresses:** All 6 table-stakes aggregate features from FEATURES.md.
**Avoids:** P6 (footer breaks virtualizer) by using sticky positioning excluded from row count; P7 (double Worker trips) by using Promise.all() for parallel queries; P9 (collapse collision) by using distinct D3 key prefixes; P14 (SUM on text) by validating column type; P16 (gutterOffset) by applying same offset as data cells.
**Estimated:** 500-750 TS lines, LOW risk.

### Phase 63: Notebook Formatting Toolbar
**Rationale:** Independent, low-complexity UI work. Must ship before persistence (content worth saving) and before charts (chart insertion button).
**Delivers:** Bold/italic/heading/list/link/code toolbar buttons above textarea, `_insertBlock()` prefix helper for block-level formatting, chart block insertion button.
**Addresses:** All 6 table-stakes toolbar features from FEATURES.md.
**Avoids:** P4 (undo stack destruction) by refactoring `_wrapSelection()` to use undo-safe insertion FIRST; P17 (buttons active in preview) by disabling toolbar on tab switch.
**Estimated:** 200-300 TS + 100 CSS lines, LOW risk.

### Phase 64: Notebook Persistence
**Rationale:** Depends on Phase 63 (toolbar makes content worth persisting). Must ship before charts (chart content needs to survive reload). Uses existing `ui_state` infrastructure -- zero schema migration needed.
**Delivers:** Debounced auto-save (1s), content loads on app start, flush-on-destroy safety net.
**Addresses:** 3 of 4 persistence features from FEATURES.md (CloudKit sync deferred).
**Avoids:** P5 (content lost on destroy) by synchronous flush in `destroy()`; P10 (scope ambiguity) by choosing global `ui_state` for v5.2 (per-card deferred). P1/P2 (schema migration / CloudKit wipe) entirely avoided by not adding a new column -- uses existing `ui_state` table.
**Estimated:** 150-250 TS lines, LOW risk.

### Phase 65: D3 Chart Blocks
**Rationale:** Depends on Phases 63 (toolbar chart button) and 64 (persistence). Highest complexity but the defining differentiator of v5.2. Isolated from SuperCalc and LATCH work.
**Delivers:** Bar chart blocks in notebook preview, custom `marked` renderer for chart fence syntax, DOMPurify-safe SVG rendering, chart data from existing `db:query` handler.
**Addresses:** Primary differentiator from FEATURES.md (embedded D3 chart blocks).
**Avoids:** P3 (XSS bypass) by two-pass rendering with D3 mounting AFTER sanitization; P11 (breaks code blocks) by returning `false` for non-chart languages in custom renderer; P18 (re-fetch on every toggle) by caching chart data with dirty flag.
**Estimated:** 600-900 TS + 100 CSS lines, MEDIUM risk (new rendering pattern).

### Phase 66: LATCH Histogram Scrubbers
**Rationale:** Independent of all notebook/calc work. Higher complexity than chips, but delivers a distinctive interaction pattern. Benefits from existing `db:query` and `FilterProvider` infrastructure.
**Delivers:** D3 SVG mini bar chart in Time section, d3.brushX drag-to-select range, SQL-based temporal binning, keyboard-accessible range handles.
**Addresses:** All 5 histogram features from FEATURES.md.
**Avoids:** P8 (compounding filters) by adding `setRangeFilter()` to FilterProvider; P15 (ISO date binning) by using SQL `strftime()` for server-side temporal bucketing; P19 (ghost filter on brush clear) by handling null selection in brush end event.
**Estimated:** 500-700 TS + 200 CSS lines, MEDIUM risk (d3.brushX + date mapping).

### Phase 67: Category Chips
**Rationale:** Independent, lowest risk of the LATCH features. Validates the LatchExplorers extension pattern before the more complex histogram work (though both can proceed in parallel).
**Delivers:** Clickable chip pills replacing checkboxes for low-cardinality fields, count badges per chip, horizontal wrap layout.
**Addresses:** All 5 chip features from FEATURES.md.
**Avoids:** P12 (duplicate checkbox UI) by replacing checkboxes in Category/Hierarchy sections, not supplementing them.
**Estimated:** 300-400 TS + 150 CSS lines, LOW risk.

### Phase Ordering Rationale

- SuperCalc (62) first because it is the headline feature with zero dependencies -- delivers immediate value
- Toolbar (63) before persistence (64) because content editing must exist before persistence matters
- Persistence (64) before charts (65) because chart content must survive reload to be useful
- Charts (65) last in the notebook chain due to dependency on both toolbar and persistence
- LATCH phases (66-67) are fully independent of all notebook/calc work and can proceed in parallel with Phases 62-65
- Chips (67) is lower risk than histograms (66) and validates the LatchExplorers extension pattern

**Parallelization graph:**
```
62 (SuperCalc)      63 (Toolbar) --> 64 (Persist) --> 65 (Charts)
66 (Histogram)      67 (Chips)
```

Phases 62, 63, 66, and 67 have zero interdependencies. Phase 64 blocks on 63. Phase 65 blocks on 63 and 64.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 62 (SuperCalc):** Moderate -- footer row interaction with SuperGridVirtualizer (P6) and collapse aggregate mode (P9) needs careful integration testing against the existing 4,342-line SuperGrid.ts
- **Phase 65 (D3 Chart Blocks):** Moderate -- custom `marked` renderer + post-sanitization D3 mount is a new pattern for this codebase; security review of the XSS boundary is mandatory
- **Phase 66 (Histogram Scrubbers):** Moderate -- `d3.brushX()` interaction, temporal binning, and FilterProvider `setRangeFilter()` are all new patterns

Phases with standard patterns (skip research-phase):
- **Phase 63 (Toolbar):** Standard -- well-documented toolbar-over-textarea pattern; GitHub's `markdown-toolbar-element` is a direct reference implementation
- **Phase 64 (Persistence):** Standard -- follows established `PersistableProvider` / `ui_state` pattern already used by 4+ providers
- **Phase 67 (Chips):** Standard -- D3 `selection.join()` for button elements, same FilterProvider API as existing checkboxes

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all features verified against existing package.json |
| Features | HIGH | Patterns drawn from 10+ comparable products (Excel, Notion, Airtable, AG Grid, GitHub, DEV.to, Observable, Airbnb, Crossfilter, Algolia) |
| Architecture | HIGH | All integration points verified by reading existing source code with line-number references |
| Pitfalls | HIGH | 19 pitfalls identified from codebase analysis; critical pitfalls (P1-P5) have exact line references and tested mitigations |

**Overall confidence:** HIGH

### Gaps to Address

- **Notebook scope decision:** Per-card content (new column on `cards`) vs global scratch pad (`ui_state` key). Research recommends `ui_state` for v5.2 to avoid schema migration and CloudKit complexity. If per-card is desired later, it requires migration infrastructure (P1), CloudKit merge update (P2), and FTS5 trigger updates (P13).
- **Chart block data source:** Full dataset or current filter state? Research recommends full dataset for v5.2 with a `filtered: true` flag for future enhancement. This avoids re-rendering charts on every filter change.
- **Histogram bucket granularity:** Monthly binning is recommended for date fields spanning typical ranges. Adaptive bucketing (weekly for <3 months, yearly for >10 years) may be needed but can be addressed during phase planning.
- **Category chip vs checkbox threshold:** UX decision needed -- research recommends chips when field cardinality < 20, checkboxes otherwise. The cutoff affects which LATCH sections render chips vs checkboxes.
- **Undo-safe textarea insertion method:** Both `execCommand('insertText')` and `setRangeText()` are viable. The `execCommand` approach is WebKit-tested but technically deprecated. `setRangeText()` is the modern standard. Final choice should be validated against WKWebView during Phase 63 planning.

## Sources

### Primary (HIGH confidence -- codebase analysis)
- `src/views/supergrid/SuperGridQuery.ts` -- existing query builder, AggregationMode type
- `src/views/SuperGrid.ts` -- 4,342-line renderer, virtualizer, collapse, gutter patterns
- `src/ui/NotebookExplorer.ts` -- existing `_wrapSelection()`, `_renderPreview()`, DOMPurify config
- `src/ui/LatchExplorers.ts` -- existing checkbox rendering, time presets, FilterProvider wiring
- `src/providers/PAFVProvider.ts` -- existing provider state management pattern
- `src/providers/FilterProvider.ts` -- existing `addFilter()`, `setAxisFilter()`, `compile()` API
- `src/database/Database.ts` -- checkpoint hydration path, no migration runner
- `src/bridge/NativeBridge.ts` -- `buildCardMergeSQL()` INSERT OR REPLACE with 26 columns
- `src/database/schema.sql` -- `ui_state` table, FTS5 triggers

### Secondary (HIGH confidence -- ecosystem documentation)
- [D3 v7 API: d3.brushX()](https://d3js.org/d3-brush) -- d3-brush included in d3 umbrella
- [marked renderer extension API](https://marked.js.org/using_pro) -- `marked.use()` configuration
- [GitHub markdown-toolbar-element](https://github.com/github/markdown-toolbar-element) -- reference implementation for undo-safe textarea formatting
- [text-field-edit library](https://github.com/fregante/text-field-edit) -- undo-safe textarea modification patterns
- [Mozilla Bug 1523270](https://bugzilla.mozilla.org/show_bug.cgi?id=1523270) -- textarea undo history lost on programmatic value assignment
- [SQLite PRAGMA user_version](https://www.sqlite.org/pragma.html#pragma_user_version) -- migration version tracking

### Secondary (HIGH confidence -- comparable product analysis)
- Notion Table View Calculate Footer, Airtable Summary Bar, AG Grid Aggregation -- aggregate footer patterns
- DEV.to Markdown Toolbar implementation -- toolbar button + `_wrapSelection` architecture
- Observable Notebook Architecture -- chart block rendering model (simplified for v5.2)
- Crossfilter Library, Airbnb Rheostat -- histogram scrubber interaction patterns
- Algolia Faceted Search, Notion database views -- category chip filter patterns

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
