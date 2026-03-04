# Project Research Summary

**Project:** Isometry v3.0 SuperGrid Complete
**Domain:** Interactive multidimensional grid with drag-and-drop axis control, zoom/pan, density, selection, sorting, filtering, and FTS5-powered search
**Researched:** 2026-03-03
**Confidence:** HIGH

## Executive Summary

Isometry v3.0 SuperGrid Complete adds 12 Super* interactive features to the existing D3.js/CSS Grid/sql.js stack. The product delivers two categories of features: table stakes that match spreadsheet conventions users bring from Excel, Numbers, and Google Sheets (sort, filter, search, resize, selection, zoom/pan, density controls) and genuine differentiators unique to the PAFV model that no spreadsheet tool offers (axis drag-and-drop transpose, multidimensional aggregation cards at group intersections, smart time hierarchy with non-contiguous period selection). The existing installed stack is complete — zero new npm dependencies are required. All 12 features build entirely on D3 v7.9 (submodules already bundled), sql.js 1.14 (FTS5 WASM already compiled), TypeScript 5.9, the existing Provider layer, and browser-native Pointer Events and CSS Grid APIs.

The correct build approach is a strict three-layer dependency: a Foundation phase first (PAFVProvider stacked-axes extension + SuperGridQuery Worker wiring + SuperGrid dynamic axis reads), then Core Interactivity (SuperDynamic, SuperZoom, SuperSize, SuperSelect), then Data Operations (SuperSort, SuperFilter, SuperSearch, SuperDensity, SuperTime), and finally SuperCards as the milestone-closing aggregation feature. The Foundation is non-negotiable: the current SuperGrid renders with hardcoded `DEFAULT_COL_FIELD = 'card_type'` and `DEFAULT_ROW_FIELD = 'folder'` constants and filters cards in-memory — it cannot respond to user axis manipulation, cannot produce COUNT aggregates for SuperCards, and cannot compose with FilterProvider or DensityProvider at query time. Every Super* feature depends on the Foundation being live.

The primary risks are architectural. Eight critical pitfalls are documented with verified prevention strategies. The five most dangerous are: (1) PAFVProvider stacked-axes shape mismatch — adding `colAxes`/`rowAxes` arrays without wiring them to a new `getStackedGroupBySQL()` method leaves the existing `compile()` path returning flat single-axis SQL, causing the grid to silently render wrong; (2) Worker round-trip accumulation — multiple providers firing must produce exactly one compound query per frame or the UI freezes on rapid axis changes; (3) SuperZoom architectural conflict — applying d3.zoom transforms to a CSS `overflow:auto` container is unrecoverable without a full rewrite and must be decided before the first zoom commit; (4) HTML5 DnD `dataTransfer.getData()` blocking during `dragover` — discriminating axis drag types requires a module-level singleton, not the dataTransfer API; (5) FTS highlight DOM ownership — search highlights must be passed as data to the D3 render cycle, never injected via innerHTML outside the data join.

## Key Findings

### Recommended Stack

The locked stack is correct and complete. No new dependencies are needed. All 12 Super* features are buildable from the installed set.

**Core technologies:**
- TypeScript 5.9 (strict): All new feature code — locked, unchanged, no action needed
- D3.js 7.9.0: d3-drag (in-stack reorder only), d3-time/d3-time-format (date parsing + smart hierarchy for SuperTime), d3-array group/rollup (nested Map for multi-level axis tuples) — all submodules already in the full d3 bundle; d3-brush is explicitly NOT usable (SVG-only, cannot work with CSS Grid HTML elements)
- sql.js 1.14.0 (custom FTS5 WASM): FTS5 `highlight()`, `snippet()`, `bm25()` for SuperSearch — already installed; critical constraint: `highlight()` and `snippet()` can only be called within a `MATCH` query context, never in GROUP BY — requires two-step approach (FTS rowid clause folded into main query, not a separate query)
- Pointer Events API (browser native): SuperSize resize handles, SuperSelect lasso — preferred over Mouse Events for `setPointerCapture()` stability; `setPointerCapture()` eliminates fragile `document.addEventListener('mousemove')` patterns
- HTML5 DnD events (browser native): SuperDynamic cross-zone axis repositioning ONLY — d3.drag intercepts `dragstart` and permanently blocks `dataTransfer` during the gesture (locked architectural truth from KanbanView v0.5); d3.drag IS used for in-stack reordering (same zone, pure pointer tracking without dataTransfer)
- CSS position:sticky + CSS Grid (browser native): SuperZoom frozen headers — no JavaScript for header pinning, pure CSS; fully supported on iOS 17+ / macOS 14+
- SuperZoom implementation: CSS Custom Property column/row width scaling (`--col-width-Jan: 80px`), NOT d3.zoom transform on the CSS Grid container — overflow:auto and CSS transform conflict is architectural and has no incremental fix

**What NOT to use:**
- d3-brush: SVG-only — confirmed from official d3-brush docs; cannot apply to CSS Grid HTML elements
- Temporal API: TC39 Stage 3 as of 2026, no stable native support in WKWebView (iOS 17); use d3-time-format instead
- date-fns / luxon / dayjs: redundant weight; d3-time-format (already in bundle) handles all required date formats
- floating-ui / @popperjs/core: SuperFilter dropdown placement is simple enough for CSS `position: absolute` relative to header cell
- HyperFormula: explicitly deferred to v3.1+ (SuperCalc/SuperAudit); formula reference syntax for PAFV dimensional coordinates is an open design problem; ~500KB bundle cost
- Any additional Worker message types beyond existing protocol: SuperGrid queries use the existing `db:query` pattern extended with one new `supergrid:query` type; do not add per-feature message types

### Expected Features

**Must have (table stakes — users expect these from any grid):**
- SuperSort — click column/row headers to sort asc/desc/none cycle; multi-sort with priority; per-group only (sort does not cross group boundaries); `▲/▼` visual indicator on header
- SuperFilter — auto-filter dropdown per column header; checkbox list of distinct values; Select All/Clear buttons; compiles to FilterProvider 'in' operator; filter indicator on header when active; dropdown populated from current supergrid:query result (zero additional Worker round-trips on open)
- SuperSearch — FTS5 MATCH query folded into supergrid:query compound WHERE clause; matching cells get CSS class + `<mark>` tags via D3 render cycle; prefix matching via porter tokenizer; debounced 300ms; Cmd+F behavior
- SuperSize — drag resize handles on 4px header edge strips; double-click auto-fit; Shift+drag bulk resize; column widths stored via CSS Custom Properties; persisted to Tier 2 state via StateManager
- SuperSelect — click/Cmd-click/Shift-click/lasso selection; z-axis click zone disambiguation (header vs. data cell vs. SuperCard); rectangular 2D range select (NOT the linear list-view range); header click selects all cards under that header's data range
- SuperZoom — pinch/scroll zoom anchored to upper-left corner (not cursor-center, unlike d3.zoom default); sticky frozen row and column headers via CSS position:sticky; no scroll past table boundaries
- SuperDensity — 4-level Janus model: Level 1 Value (time hierarchy collapse), Level 2 Extent (hide/show empty intersections), Level 3 View (spreadsheet vs. matrix mode), Level 4 Region (per-axis density — stub in v3.0); Level 1 and Level 2 are table stakes minimum

**Should have (competitive differentiators — no other tool does these):**
- SuperDynamic — drag-and-drop axis repositioning; users drag row axis header to column position (or vice versa); immediate grid reflow via PAFVProvider.setColAxes() + StateCoordinator; axis transpose with D3 transition (300ms); no spreadsheet tool offers this as direct manipulation (Excel TRANSPOSE is a formula, Airtable cannot transpose)
- SuperCards — generated aggregation cards at group intersections; COUNT aggregations from supergrid:query result; distinct visual style (dashed border, italic text); pinned at `grid-row: -1` / `grid-column: -1`; excluded from SelectionProvider and FTS results
- SuperTime — auto-parse date strings using d3-time-format with sequential format fallback (ISO 8601 → US date → EU date); smart hierarchy selection based on data date span (day/week/month/quarter/year); non-contiguous time period selection (e.g., Q1 + Q3 simultaneously — no other tool supports this in a grid)
- SuperPosition — PAFV coordinate tracking (axis values, not pixel positions) that survives view transitions; Tier 3 ephemeral; `PAFVCoordinate { rowValues, colValues, scrollAnchorCard }`; consumed by SuperZoom for scroll restoration and SuperSelect for lasso coordinate reference

**Defer to v3.1+:**
- SuperCalc — HyperFormula PAFV-scoped formulas; formula reference syntax for dimensional coordinates is an open design problem (SuperGrid.md Section 10); ~500KB bundle cost; HyperFormula must run on main thread (not Worker) when added
- SuperAudit — computed value visual distinction via CSS class; depends on SuperCalc; one-liner in render but meaningless without SuperCalc

### Architecture Approach

The architecture is a layered extension of the existing Provider/View/Worker system with minimal surface area changes. PAFVProvider gains `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` arrays alongside existing single-axis fields — fully backward-compatible, no other view affected. SuperGrid.ts gets a rewritten `render()` that reads stacked axes from PAFVProvider instead of hardcoded constants, and fetches grouped cell data via a new `bridge.superGridQuery()` call instead of in-memory card filtering. A new `supergrid:query` Worker message type executes `buildSuperGridQuery()` — already correct SQL but currently dead code — and returns `{ cells: [{rowKey, colKey, count, card_ids}] }`. SuperGrid bypasses ViewManager's generic `_fetchAndRender()` path (same pattern as NetworkView) and manages its own fetch lifecycle. New Sub-components live in `src/views/supergrid/` following the existing SuperStackHeader pattern.

**Major components:**
1. `PAFVProvider` (EXTEND) — add `colAxes`/`rowAxes` arrays with `setColAxes()`/`setRowAxes()` using existing `validateAxisField()` allowlist; update `VIEW_DEFAULTS.supergrid`; add `getStackedGroupBySQL()` method separate from `compile()` to avoid breaking 8 other views
2. `SuperPositionProvider` (NEW, Tier 3) — scroll offset `{x, y}` + cell bounding box `Map<string, DOMRect>`; mirrors SelectionProvider pattern exactly; never registered with StateCoordinator (would cause 60 supergrid:query calls/second during scroll); consumed by SuperGridZoom and SuperGridSelect
3. `SuperGrid.ts` (REWRITE render()) — remove `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD` constants; accept PAFVProvider-compatible in constructor; call `bridge.superGridQuery()`; orchestrate Sub-components; inline private methods for SuperDynamic, SuperDensity, SuperSort, SuperTime
4. `supergrid.handler.ts` (NEW Worker handler) — imports `buildSuperGridQuery`, validates payload axes via same `validateAxisField()` calls already in `buildSuperGridQuery`, executes via `db.exec()`, returns grouped cell rows
5. Sub-components in `src/views/supergrid/`: `SuperGridSizer.ts` (resize), `SuperGridZoom.ts` (wheel/pinch), `SuperGridSelect.ts` (lasso + z-disambiguation), `SuperGridFilter.ts` (auto-filter dropdown), `SuperGridSearch.ts` (FTS panel), `SuperGridCards.ts` (aggregation DOM)
6. `WorkerBridge` + `protocol.ts` (EXTEND) — add `superGridQuery()` typed method and `supergrid:query` + `db:distinct-values` to `WorkerRequestType` union

**Unchanged (verified by direct code inspection):** SuperStackHeader.ts (already handles 1–3 level tuples, MAX_LEAF_COLUMNS=50), FilterProvider, SelectionProvider, DensityProvider, StateCoordinator, MutationManager, QueryBuilder, all ETL files, all Swift native files.

**Key scaling constraint:** SuperGrid cell count is bounded by `MAX_LEAF_COLUMNS = 50` per axis dimension, so the grid is at most 50×50 = 2,500 cells regardless of card count. Performance is determined by SQL aggregation speed and DOM cell count, not total card count. sql.js WASM handles GROUP BY queries for 10K cards in <100ms. No virtualization required.

### Critical Pitfalls

1. **PAFVProvider stacked-axes shape mismatch (Foundation blocker)** — Adding `colAxes`/`rowAxes` to PAFVState without also creating a dedicated `getStackedGroupBySQL()` method leaves the existing `compile()` path returning flat single-axis SQL. The grid renders as a flat two-column grid regardless of configured axes — no error, no warning, just wrong output. Prevention: define the new stacked-axis method completely separate from `compile()`; keep backward compatibility by leaving all existing single-axis fields untouched for the 8 other views. Address in Phase 1 — getting this wrong forces rewrites across every subsequent phase.

2. **Worker round-trip accumulation** — Multiple providers firing in the same StateCoordinator 16ms batch (filter + PAFVProvider change is the common case) must produce exactly one `workerBridge.superGridQuery()` call per frame, not one per source. SuperSearch's FTS clause must fold into the compound query as a `WHERE rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)` condition — not a separate parallel query. Prevention: establish the single-query contract in the Foundation phase before any feature adds a second query path; every subsequent phase must comply. Warning sign: multiple `workerBridge.query()` calls in the Performance profiler during a single filter change.

3. **SuperZoom CSS overflow + D3 transform conflict (architectural, no incremental fix)** — `overflow: auto` on the CSS Grid container and `transform: scale()` from d3.zoom do not compose. The upper-left anchor drifts, boundary enforcement breaks, and sticky headers decouple from the grid. There is no incremental fix — the conflict is architectural. Prevention: implement SuperZoom as CSS Custom Property column/row width scaling (`--col-width-{key}: {px}`) rather than a CSS transform; pan is standard browser scroll with `scrollLeft`/`scrollTop` bounds checking; no d3.zoom on the container. This architectural decision must be locked before any zoom prototype commit.

4. **HTML5 DnD `dataTransfer.getData()` blocked during `dragover`** — The browser security model prevents reading dataTransfer in `dragenter`/`dragover`. SuperDynamic needs to discriminate axis types (row vs. col vs. filter) to show correct drop zone indicators and conditionally accept/reject drops. Prevention: use a module-level singleton `let dragPayload: {axisType: 'row' | 'col'; field: string} | null = null`; write on `dragstart`, read in `dragover`, clean up in `dragend`. This is the same internal pattern used by React DnD, Sortable.js, and AG Grid.

5. **FTS5 highlight overwrites D3-managed DOM** — Injecting `<mark>` tags into cells via `innerHTML` outside the D3 render cycle gets overwritten on the next data join pass. Highlights appear briefly then vanish on any filter change or axis update. Prevention: pass search state as data — add `matchedTerms: string[]` to CellDatum; the D3 `.each()` callback is the only writer to cell innerHTML; if `d.matchedTerms.length > 0`, the callback produces `<mark>`-decorated content during its own render pass. No secondary DOM writer.

6. **Lasso `getBoundingClientRect()` O(N×M) per mousemove** — Calling `getBoundingClientRect()` on all 2,500 cells inside each mousemove handler forces 150,000 synchronous layout flushes per second at 60Hz. The grid becomes completely unusable during lasso drag. Prevention: build a `Map<string, DOMRect>` coordinate cache in a single batch pass after each D3 render cycle; lasso mousemove reads from cache (pure arithmetic, no DOM reads); invalidate cache on any render that changes cell positions.

7. **Density collapse shifts `colStart` — data cells misalign** — When Month collapses to Quarter, all subsequent `colStart` values shift. The D3 update selection correctly identifies existing cells by key but if `gridColumn` is only set in the enter join function (not in the merged update `.each()` callback), data cells stay at their old CSS Grid positions while headers render in the new positions. Prevention: always set `gridColumn` and `gridRow` in both enter AND update `.each()` callbacks; never assign grid placement only in enter; add a density-collapse alignment test before implementing any density controls.

8. **Storing axis state inside SuperGrid.ts instead of PAFVProvider** — Adding `private colAxes: AxisMapping[]` to SuperGrid.ts as instance state orphans axis configuration on view destroy, breaks StateManager persistence, and breaks StateCoordinator re-trigger on axis changes. Prevention: all axis state lives in PAFVProvider following the established pattern for every other view; SuperGrid reads axes from the provider on every render, never stores its own copy.

## Implications for Roadmap

Based on combined research, the build order is strictly determined by hard data flow dependencies. Foundation (Phases 1-3) is strictly ordered because each phase enables the next. Within Core Interactivity, SuperZoom and SuperPosition must be built together; SuperSize and SuperSelect both depend on SuperPosition. Data Operations can partially overlap once Foundation is complete. SuperCards is last because it requires both the Foundation's grouped query result and SuperSelect's z-layer click disambiguation.

### Phase 1: PAFVProvider Stacked Axes (Foundation Part 1)

**Rationale:** Every Super* feature reads axis configuration from PAFVProvider. The `colAxes`/`rowAxes` arrays must exist and serialize correctly before any other work begins. The shape mismatch pitfall (silent wrong output, not an error) makes getting this right the highest-priority correctness concern in the entire milestone.

**Delivers:** PAFVProvider exposes `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` with `setColAxes()`/`setRowAxes()` using existing `validateAxisField()` allowlist; `getStackedGroupBySQL()` method separate from `compile()`; `VIEW_DEFAULTS.supergrid` updated with sensible defaults (`card_type` × `folder`); `toJSON()`/`setState()` round-trips arrays correctly; all 8 other views unaffected.

**Addresses:** Foundation wiring (FEATURES.md P1 build order 1st); PAFVProvider stacked-axes shape mismatch (PITFALLS.md Pitfall 1)

**Key TDD tests:** configure 2 row axes + 2 col axes → verify `getStackedGroupBySQL()` returns 2-field GROUP BY each dimension (not the flat single-axis output of `compile()`); `toJSON()`/`setState()` round-trip for stacked arrays; non-supergrid views call `compile()` and get unchanged output.

**Research flag:** Standard patterns — API is fully specified in ARCHITECTURE.md Pattern 1. No additional research needed.

### Phase 2: SuperGridQuery Worker Wiring (Foundation Part 2)

**Rationale:** `SuperGridQuery.buildSuperGridQuery()` already produces correct SQL but is dead code — it is not imported by SuperGrid.ts and has no execution path. This phase gives it execution infrastructure and establishes the single-query-per-frame contract that all subsequent phases must honor.

**Delivers:** `supergrid:query` + `db:distinct-values` Worker message types in `protocol.ts`; `supergrid.handler.ts` that imports `buildSuperGridQuery`, validates payload axes via `validateAxisField()`, executes via `db.exec()`, returns `{ cells: [{rowKey, colKey, count, card_ids}] }`; `WorkerBridge.superGridQuery()` typed method; handler registered in `handlers/index.ts`.

**Addresses:** Foundation wiring (FEATURES.md); Worker round-trip accumulation (PITFALLS.md Pitfall 2)

**Key TDD tests:** valid axis config → grouped result rows with correct GROUP BY; invalid field → SQL safety error thrown (validateAxisField); empty result → `{ cells: [] }`; 4 providers firing simultaneously → exactly 1 `workerBridge.superGridQuery()` call per StateCoordinator batch.

**Research flag:** Standard patterns — all required types and handler structure documented in ARCHITECTURE.md Pattern 3.

### Phase 3: SuperGrid Dynamic Axis Reads (Foundation Part 3)

**Rationale:** SuperGrid.ts currently uses hardcoded `DEFAULT_COL_FIELD` and `DEFAULT_ROW_FIELD` constants and filters cards in-memory. This phase replaces both with live PAFVProvider reads and Worker queries, completing the Foundation and making the grid dynamically query-driven for the first time.

**Delivers:** SuperGrid.ts accepts PAFVProvider-compatible in constructor; reads stacked axes from PAFVProvider on every render; calls `bridge.superGridQuery()` instead of in-memory card filtering; renders multi-level headers via existing SuperStackHeader (unchanged); ViewManager passes `pafv` to SuperGrid constructor.

**Addresses:** Foundation wiring; in-memory card filtering anti-pattern (PITFALLS.md Anti-Pattern 2)

**Key TDD tests:** mock PAFVProvider with 2 different axis configurations → different headers rendered; supergrid:query grouped result → correct cells in correct CSS Grid positions; empty query result → empty state rendered (not previous stale cells).

**Research flag:** Standard patterns — rewrite scope documented precisely in ARCHITECTURE.md Pattern 2.

### Phase 4: SuperDynamic — Axis Drag-and-Drop Transpose

**Rationale:** The signature PAFV differentiator. Depends on Foundation (PAFVProvider stacked axes + live query path). HTML5 DnD for cross-zone axis moves; d3.drag for in-stack reordering within the same dimension. The drag payload singleton must be established before any code that needs to discriminate drag types in `dragover`.

**Delivers:** Users can drag row axis header to column position (and vice versa); grid reflows with D3 transition (300ms) on axis change; axis assignments persist via PAFVProvider + StateManager; drag ghost element offset 20px from cursor (not centered — avoids obscuring drop zone indicators); module-level `dragPayload` singleton for `dragover` discrimination.

**Addresses:** SuperDynamic (FEATURES.md — Differentiator, highest P1 complexity); HTML5 DnD dataTransfer pitfall (PITFALLS.md Pitfall 4)

**Key TDD tests:** mock dragstart on row axis → dragover on col area reads correct axisType from singleton; drop calls `pafv.setColAxes()` with reordered axes and triggers re-query (not just visual reorder); d3.drag on same-zone reorder (not HTML5 DnD).

**Research flag:** No additional research needed. DnD pattern fully documented in STACK.md Group 2.

### Phase 5: SuperPosition + SuperZoom (Build Together)

**Rationale:** SuperPositionProvider must exist before SuperZoom can write scroll offsets and before SuperSelect can read cell bounding boxes. The CSS Custom Property zoom architecture (not d3.zoom transform) must be decided before any zoom code is written — retrofitting is a full rewrite with no incremental path.

**Delivers:** `SuperPositionProvider.ts` (Tier 3, never persisted, never in StateCoordinator) with `setScrollOffset({x, y})` and cell bounding box `Map<string, DOMRect>`; `SuperGridZoom.ts` wheel/pinch handler applying CSS Custom Property column/row width scaling; CSS `position:sticky` frozen headers (no JavaScript for pinning); upper-left anchor behavior matches Apple Numbers zoom.

**Addresses:** SuperZoom (FEATURES.md — Table Stakes); SuperPosition (FEATURES.md — Differentiator)

**Key TDD tests:** zoom to 200% → upper-left cell's viewport position unchanged; zoom + scroll + zoom → stable upper-left anchor (no drift); SuperPositionProvider subscription does NOT trigger StateCoordinator re-render.

**Avoids:** D3 zoom transform on CSS Grid container (PITFALLS.md Pitfall 7 — architectural conflict, no fix); registering SuperPositionProvider with StateCoordinator (PITFALLS.md Anti-Pattern 4 — 60 supergrid:query calls/second during scroll).

**Research flag:** No additional research needed. CSS Custom Property zoom approach documented in PITFALLS.md.

### Phase 6: SuperSize — Column and Row Resize

**Rationale:** Table stakes — any grid without resize feels broken. Pointer Events API with `setPointerCapture()` is the correct gesture implementation (not Mouse Events, not d3.drag). CSS Custom Properties for column widths avoid the layout thrash pitfall that emerges at 30+ columns with continuous drag.

**Delivers:** `SuperGridSizer.ts` with `pointerdown`/`pointermove`/`pointerup` listeners on 4px header edge strips; `setPointerCapture()` for stable event flow; CSS Custom Property (`--col-width-{key}`) updates on drag; double-click auto-fit; column widths persisted to Tier 2 state in PAFVProvider (not inline `style.width` — prevents SuperZoom width read conflicts).

**Addresses:** SuperSize (FEATURES.md — Table Stakes); CSS Grid template recalculation pitfall (PITFALLS.md Pitfall 3)

**Avoids:** Storing column widths in inline `style.width` (PITFALLS.md Technical Debt table); rebuilding `gridTemplateColumns` string on every drag event (cache previous template, diff before setting).

**Research flag:** Standard patterns. Pointer Events API documented in STACK.md Group 3.

### Phase 7: SuperSelect — Z-Axis Aware Selection

**Rationale:** Table stakes (multi-select) and hard prerequisite for SuperCards (SuperCards need different click behavior — selecting a SuperCard must not select data cards beneath it). The cell bounding box cache pattern established here feeds into SuperSearch and prevents the O(N×M) per-event-handler performance collapse.

**Delivers:** `SuperGridSelect.ts` with SVG lasso overlay positioned over CSS Grid; cell bounding box cache (`Map<string, DOMRect>`) built once after each render; lasso mousemove reads from cache (no DOM reads per event); `SelectionProvider.selectAll(cardIds)` called with card IDs (not cell keys) on lasso commit; z-axis click zone logic (header → no data selection, data cell → card selection, SuperCard body → lowest priority hit target); rectangular 2D range select on Shift+click; Escape clears selection.

**Addresses:** SuperSelect (FEATURES.md — Table Stakes + prerequisite for SuperCards); lasso getBoundingClientRect O(N×M) pitfall (PITFALLS.md Pitfall 6); 2D rectangular range vs. linear list range pitfall (PITFALLS.md UX table)

**Avoids:** d3-brush (SVG-only — confirmed from official docs); linear range selection from list views in a 2D grid; calling `getBoundingClientRect()` inside mousemove handlers.

**Research flag:** Standard patterns. Lasso implementation documented in STACK.md Group 6.

### Phase 8: SuperDensity — 4-Level Janus Model

**Rationale:** First phase that changes CSS Grid column count. The layout thrash benchmark (50-column density change in <16ms) must be established here before any further column-count-changing features. `SuperDensityState` is a separate type from the existing `DensityProvider` — not an extension of it — to avoid breaking calendar/timeline density.

**Delivers:** `SuperDensityState` interface (axisGranularity Map, hideEmpty boolean, viewMode enum, regionConfig stub); Level 1 Value density (time hierarchy collapse via strftime in GROUP BY); Level 2 Extent density (hide/show empty intersections); Level 3 View density (spreadsheet vs. matrix rendering); Level 4 Region density (stub — data structure defined, no UI); collapsed headers show aggregate counts (reassures users data is not lost); `gridColumn`/`gridRow` set in both enter AND update `.each()` callbacks (not only enter).

**Addresses:** SuperDensity (FEATURES.md — Table Stakes); density collapse colStart alignment pitfall (PITFALLS.md Pitfall 8)

**Key TDD tests:** collapse Month → Quarter → verify data cells appear in correct column index (not old colStart); collapse → expand → verify cells return to correct positions; density change cell-alignment test written before any density control UI is added.

**Research flag:** Standard patterns. SQL compilation for time granularity documented in STACK.md Group 5.

### Phase 9: SuperSort — Per-Group Sorting

**Rationale:** Table stakes. Lowest implementation cost of all features. Pure extension of existing `PAFVProvider.setSort()` pattern via `sortOverrides` field in `SuperGridQueryConfig`. Composes orthogonally with SuperFilter — can be developed in parallel after Foundation is complete.

**Delivers:** Click column/row header → asc → desc → none cycle; multi-sort with priority; `▲/▼` visual indicator; `SortState` class storing typed sort array; sort does not cross group boundaries (ORDER BY group key first, then sort field); all `sortOverrides` fields validated through `validateAxisField()`.

**Addresses:** SuperSort (FEATURES.md — Table Stakes, P1 build order 4th)

**Research flag:** No additional research needed. SQL ORDER BY pattern documented in STACK.md Group 10.

### Phase 10: SuperFilter — Auto-Filter Dropdowns

**Rationale:** Table stakes. Depends on Foundation (Worker wiring) because the dropdown must be populated from the already-fetched supergrid:query result — not a new round-trip query. A new-query approach causes 100–300ms dropdown open delay. FilterProvider.addFilter() already exists and is unchanged.

**Delivers:** `SuperGridFilter.ts` per-column filter icon in header chrome; `position: absolute` dropdown with scrollable checkbox list; distinct column values populated from current `colKey`/`rowKey` values in last supergrid:query result (zero additional queries on open); Select All/Clear buttons using `FilterProvider.clearAxis()`; active filter indicator on header; `db:distinct-values` Worker message for initial population when result set is not yet available.

**Addresses:** SuperFilter (FEATURES.md — Table Stakes, P1 build order 5th); filter dropdown round-trip timing pitfall (PITFALLS.md UX table)

**Key TDD tests:** dropdown opens instantly (no Worker query); selected values call `filterProvider.addFilter()` with 'in' operator; filter indicator appears on header; clear button calls `FilterProvider.clearAxis()` correctly.

**Research flag:** No additional research needed. Pattern documented in STACK.md Group 11.

### Phase 11: SuperSearch — FTS5 In-Grid Search

**Rationale:** Table stakes (Cmd+F). FTS5 infrastructure already validated in v0.1. The FTS clause must fold into the main supergrid:query compound query (not a separate Worker call) to maintain the one-query-per-frame contract. D3 data join must be the only writer to cell innerHTML.

**Delivers:** `SuperGridSearch.ts` search input in SuperGrid toolbar; FTS5 `MATCH` clause folded into `supergrid:query` WHERE as `WHERE rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`; matching cells get `.fts-match` CSS class; D3 `.each()` callback produces `<mark>`-decorated content when `d.matchedTerms.length > 0`; `<mark>` styled with `display: inline; padding: 0` (no box model changes that affect cell height); clearing search removes all highlights; debounced 300ms before Worker query; stale responses discarded via correlation ID comparison.

**Addresses:** SuperSearch (FEATURES.md — Table Stakes, P1 build order 6th); FTS highlight DOM ownership pitfall (PITFALLS.md Pitfall 5); Worker round-trip accumulation (search must not add a second query path)

**Key TDD tests:** search → filter change → verify highlights survive 3 consecutive re-renders (D3 data join, not innerHTML injection); clear search → verify no stale marks remain; FTS MATCH clause appears in compound supergrid:query, not as separate Worker message.

**Research flag:** Standard patterns. FTS5 two-step approach and `<mark>` DOM safety documented in STACK.md Group 12 and PITFALLS.md Pitfall 5.

### Phase 12: SuperTime — Smart Time Hierarchy

**Rationale:** Differentiator. Extends SuperDensity Level 1 (Value Density) specifically for time axes. d3-time-format (already bundled) handles all required date formats. Non-contiguous selection extends SelectionProvider with a `Set<string>` of time period keys — the only view that needs this capability.

**Delivers:** Auto-parse date strings using d3-time-format sequential format fallback (ISO 8601 with ms → ISO 8601 → ISO date → US date → EU date); `smartHierarchy()` function using `d3.timeDay.count()` to select appropriate level based on data date span; date parsing runs once per query result (not per cell on each render); non-contiguous time period selection via `Set<string>` of period keys (e.g., `{'2024-Q1', '2024-Q3'}`); selected/unselected periods compile to FilterProvider 'in' operator WHERE clause; time hierarchy headers rendered via existing `buildHeaderCells()` with correct tuple structure.

**Addresses:** SuperTime (FEATURES.md — Differentiator, P1 build order 11th); mixed date format normalization (PITFALLS.md "Looks Done But Isn't")

**Avoids:** Temporal API (TC39 Stage 3, not stable in WKWebView); synchronous date parsing per cell on each render (parse once per query result batch).

**Research flag:** No additional research needed. d3-time patterns and smart hierarchy documented in STACK.md Group 9.

**Gap to address:** The interaction design for non-contiguous period selection (how users discover and activate it, what the visual state looks like during multi-period selection) needs explicit design before implementation. The data model is clear (`Set<string>` of period keys); the UI affordance is not specified in the current spec.

### Phase 13: SuperCards — Aggregation Cards at Group Intersections

**Rationale:** Differentiator and the most architecturally constrained feature. Requires Foundation (grouped query result with COUNT), SuperSelect (z-layer click discrimination — SuperCard body is lowest priority hit target), and SuperDensity (to know what GROUP BY level the count aggregates against). Closes the milestone.

**Delivers:** `SuperGridCards.ts` generating aggregation card DOM within CSS Grid; COUNT from `supergrid:query` cell data; optional SUM of numeric fields when available; distinct visual style (dashed border, italic text, `data-supercard="true"` attribute); aggregation cells at `grid-row: -1` / `grid-column: -1` (CSS Grid last-row/column placement); excluded from `SelectionProvider.getSelectedIds()` and from FTS search results and card counts; SuperCard click shows tooltip (not card selection).

**Addresses:** SuperCards (FEATURES.md — Differentiator, P1 build order 12th)

**Key TDD tests:** SuperCards are excluded from `selectionProvider.getSelectedIds()` result; SuperCards do not appear in FTS search results; COUNT value in SuperCard matches GROUP BY result count for that group; clicking SuperCard body does not select underlying data cards.

**Research flag:** No additional research needed. Component architecture and DOM placement documented in ARCHITECTURE.md and STACK.md Group 8.

### Phase Ordering Rationale

- **Foundation (Phases 1-3) is strictly ordered** by data flow dependency: stacked axes must exist in PAFVProvider before the Worker handler can receive them; the Worker handler must exist before SuperGrid can replace in-memory filtering; SuperGrid must be dynamically query-driven before any feature can drive it.
- **SuperDynamic (Phase 4) after Foundation** because it reads from and writes to PAFVProvider stacked axes to drive the live query. Without Foundation, axis changes have no effect.
- **SuperZoom + SuperPosition together (Phase 5)** because they share `SuperPositionProvider` as their data exchange point; building them separately creates a chicken-and-egg dependency.
- **SuperSize (Phase 6) after SuperPosition** because resize coordinate math references the provider's scroll offset for correct positioning.
- **SuperSelect (Phase 7) before SuperCards** because SuperCards require z-layer click disambiguation to be in place before they become interactive — clicking a SuperCard before Phase 7 would accidentally select data cards beneath it.
- **SuperDensity (Phase 8) before SuperSort/Filter/Search/Time** because it changes column count (the CSS Grid column count mutation performance benchmark must pass before any subsequent feature adds more column-count-changing paths). SuperSort and SuperFilter can proceed after Phase 8 in parallel.
- **SuperCards (Phase 13) last** because it requires Foundation (grouped query result), SuperSelect (z-layer), and SuperDensity (correct COUNT level). No other feature depends on SuperCards.
- **SuperCalc and SuperAudit deferred** — formula reference syntax for PAFV dimensional coordinates is an open design problem; HyperFormula adds ~500KB; deferred to v3.1+.

### Research Flags

Phases with standard patterns (no additional research needed):
- **All 13 phases** — All implementation patterns, APIs, and integration approaches are fully documented with HIGH confidence in STACK.md, ARCHITECTURE.md, and PITFALLS.md. Direct codebase inspection verified all existing file states. No phase requires `/gsd:research-phase` during planning.

The only unresolved design question is the SuperTime non-contiguous period selection UI affordance (how users discover and activate multi-period selection). The data model is clear; the interaction design needs explicit design work before Phase 12 implementation begins. This is a UX design gap, not a research gap.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies verified against official docs (d3js.org, sqlite.org, MDN); installed versions confirmed in package.json; zero new dependencies validated by systematic elimination of every alternative; FTS5 auxiliary function MATCH-context constraint confirmed via SQLite official docs + community report |
| Features | HIGH | Derived from 56KB canonical SuperGrid.md spec + cross-referenced against AG Grid, TanStack Table, Excel, Google Sheets, Airtable, Numbers interaction patterns; feature classification as table stakes vs. differentiator is consistent across all reference products; dependency graph confirmed complete |
| Architecture | HIGH | Based on direct source code inspection of all affected files (SuperGrid.ts 341 LOC confirming hardcoded constants and in-memory filtering; PAFVProvider.ts confirming single-axis state only; SuperGridQuery.ts 110 LOC confirming dead code status; SuperStackHeader.ts 264 LOC confirming unchanged compatibility; protocol.ts confirming `supergrid:query` absent); no guesswork — actual code state confirmed for every integration point |
| Pitfalls | HIGH (7 of 8); MEDIUM (1 of 8) | 7 critical pitfalls derived from first principles against actual codebase and verified against official browser/D3/SQLite documentation; HTML5 DnD dataTransfer blocking and `getBoundingClientRect()` forced layout are well-documented browser behaviors; MEDIUM confidence only for HyperFormula PAFV coordinate mapping (deferred to v3.1+, limited published post-mortems for this specific integration pattern) |

**Overall confidence:** HIGH

### Gaps to Address

- **SuperTime non-contiguous selection UI affordance:** The data model is clear (`Set<string>` of time period keys compiled to FilterProvider 'in' operator). The interaction design — how users discover and activate multi-period selection, what the visual state looks like during selection, how to deselect individual periods — is not specified in SuperGrid.md. Needs explicit design before Phase 12 planning.
- **SuperSize persistence decision:** Column widths can be stored in PAFVProvider state (`colWidths: Record<string, number>` in PAFVState supergrid section) or in a dedicated `ui_state` key via StateManager. ARCHITECTURE.md notes both options without prescribing one. Recommend PAFVProvider (Tier 2, consistent with axis assignments, persists within view family). Confirm during Phase 6 kickoff.
- **SuperDensity Region density (Level 4):** Data structure is defined in STACK.md (`regionConfig: Map<string, 'dense' | 'sparse'>`). No UI design or interaction model exists for per-axis density mixing. Stubbed in v3.0 — flag for v3.1+ design work.
- **HyperFormula PAFV coordinate bijection (v3.1+ design problem):** How dimensional axis values map to HyperFormula cell indices through density changes (collapsed axes shift cell indices) is noted as an open design problem in SuperGrid.md Section 10. Explicitly deferred — not a gap for this v3.0 roadmap.

## Sources

### Primary (HIGH confidence)
- `v5/Modules/SuperGrid.md` — 56KB canonical SuperGrid spec; all feature behaviors, acceptance criteria, interaction tables, design decisions, open questions
- `v5/Modules/Core/Providers.md` — PAFVProvider, FilterProvider, SelectionProvider, DensityProvider existing APIs; StateCoordinator 16ms batch behavior
- `.planning/PROJECT.md` — v3.0 milestone scope, deferred features list, constraints
- Direct codebase inspection (all verified 2026-03-03): `src/views/SuperGrid.ts` (341 LOC — hardcoded constants, in-memory filtering confirmed), `src/views/supergrid/SuperGridQuery.ts` (110 LOC — dead code, correct SQL confirmed), `src/views/supergrid/SuperStackHeader.ts` (264 LOC — 1–3 level tuple support, MAX_LEAF_COLUMNS=50 confirmed), `src/providers/PAFVProvider.ts` (single-axis state only confirmed), `src/worker/protocol.ts` (`supergrid:query` absent confirmed), `src/views/ViewManager.ts` (_fetchAndRender path confirmed), `src/providers/SelectionProvider.ts` (Tier 3 pattern confirmed), `src/providers/StateCoordinator.ts` (setTimeout(16) batching confirmed), `src/providers/allowlist.ts` + `src/providers/types.ts` (AxisField union covers all needed fields confirmed), `package.json` (installed versions confirmed)
- d3js.org official documentation: d3-drag (dragstart interception, dataTransfer incompatibility), d3-zoom (scaleTo/scaleBy [p] anchor parameter), d3-brush (SVG-only requirement confirmed), d3-time (timeDay.count(), timeInterval.range()), d3-time-format (utcParse/timeParse sequential fallback), d3-array (group/rollup nested Map)
- SQLite FTS5 official documentation — `highlight()`, `snippet()`, `bm25()` auxiliary function MATCH context requirements; GROUP BY context restriction confirmed
- MDN Pointer Events — `setPointerCapture()`, `pointerdown`/`pointermove`/`pointerup` behavior and browser support

### Secondary (MEDIUM confidence)
- SQLite community forum / GitHub gist (lemon24) — "unable to use function highlight in the requested context" in GROUP BY — FTS auxiliary function MATCH restriction in practice confirmed
- CSS-Tricks — position:sticky with CSS Grid: sticky within grid requires grid element to not have `overflow:auto` on the same element as sticky children (known wrinkle)
- Web Worker postMessage transfer costs (Milner, 2024) — 1,000 keys sub-ms, 10,000 keys ~2.5ms — basis for one-query-per-frame performance contract
- CSS Grid explicit placement performance (moldstud.com) — explicit sizing reduces reflow events 40% vs. content-driven sizing; basis for CSS Custom Property column width approach
- AG Grid, TanStack Table feature sets — table stakes feature classification validation
- Pencil & Paper Enterprise data table UX, Stephanie Walter enterprise table design — interaction pattern validation
- ReactFlow lasso selection example — lasso coordinate cache pattern validation

### Tertiary (LOW confidence — deferred domain)
- HyperFormula Known Limitations (handsontable.com) — one workbook per instance, circular reference returns #CYCLE; PAFV coordinate mapping behavior under density changes — inferred from architecture, not tested; deferred to v3.1+

---
*Research completed: 2026-03-03*
*Ready for roadmap: yes*
