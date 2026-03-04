# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit. v2.0 wraps that runtime in a native SwiftUI multiplatform shell. v3.0 completes SuperGrid as a fully dynamic, interactive PAFV projection surface.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- ✅ **v1.1 ETL Importers** — Phases 8-10 (shipped 2026-03-02)
- ✅ **v2.0 Native Shell** — Phases 11-14 (shipped 2026-03-03)
- 📋 **v3.0 SuperGrid Complete** — Phases 15-27 (planned)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) — SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) — completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) — completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.1 ETL Importers (Phases 8-10) — SHIPPED 2026-03-02</summary>

- [x] Phase 8: ETL Foundation + Apple Notes Parser (5/5 plans) — completed 2026-03-01
- [x] Phase 9: Remaining Parsers + Export Pipeline (5/5 plans) — completed 2026-03-02
- [x] Phase 10: Progress Reporting + Polish (2/2 plans) — completed 2026-03-02

See: `.planning/milestones/v1.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v2.0 Native Shell (Phases 11-14) — SHIPPED 2026-03-03</summary>

- [x] Phase 11: Xcode Shell + WKURLSchemeHandler (2/2 plans) — completed 2026-03-02
- [x] Phase 12: Bridge + Data Persistence (3/3 plans) — completed 2026-03-03
- [x] Phase 13: Native Chrome + File Import (3/3 plans) — completed 2026-03-03
- [x] Phase 14: iCloud + StoreKit Tiers (3/3 plans) — completed 2026-03-03

See: `.planning/milestones/v2.0-ROADMAP.md` for full details.

</details>

### 📋 v3.0 SuperGrid Complete (In Progress)

**Milestone Goal:** Ship all Super* interactive features to make SuperGrid a fully dynamic, interactive PAFV projection surface — query-driven from sql.js, axis-configurable via drag-and-drop, navigable via zoom/scroll, and selectable with z-axis awareness.

- [x] **Phase 15: PAFVProvider Stacked Axes** — Extend PAFVProvider with colAxes/rowAxes arrays and getStackedGroupBySQL() (completed 2026-03-04)
- [x] **Phase 16: SuperGridQuery Worker Wiring** — Wire SuperGridQuery dead code to Worker via supergrid:query message type (completed 2026-03-04)
- [ ] **Phase 17: SuperGrid Dynamic Axis Reads** — Replace hardcoded constants with live PAFVProvider reads and Worker queries
- [ ] **Phase 18: SuperDynamic** — Drag-and-drop axis transpose between row and column dimensions
- [ ] **Phase 19: SuperPosition + SuperZoom** — Coordinate tracking and CSS Custom Property zoom with frozen headers
- [ ] **Phase 20: SuperSize** — Direct manipulation column resize with Pointer Events API and Tier 2 persistence
- [ ] **Phase 21: SuperSelect** — Z-axis aware selection with lasso, Cmd+click, Shift+click, and bounding box cache
- [ ] **Phase 22: SuperDensity** — 4-level Janus density model (Value/Extent/View/Region stub)
- [ ] **Phase 23: SuperSort** — Per-group header sort cycle with multi-sort priority and visual indicators
- [ ] **Phase 24: SuperFilter** — Auto-filter dropdowns populated from current query result with FilterProvider integration
- [ ] **Phase 25: SuperSearch** — FTS5 in-grid search folded into compound supergrid:query with D3-managed highlights
- [ ] **Phase 26: SuperTime** — Smart time hierarchy auto-detection and non-contiguous period selection
- [ ] **Phase 27: SuperCards + Polish** — Aggregation cards at group intersections, performance benchmarks, keyboard shortcuts

## Phase Details

### Phase 15: PAFVProvider Stacked Axes
**Goal**: PAFVProvider exposes multi-axis configuration that all Super* features can read and write
**Depends on**: Phase 14 (v2.0 complete — PAFVProvider exists with single-axis state)
**Requirements**: FOUN-01, FOUN-02, FOUN-03, FOUN-04
**Success Criteria** (what must be TRUE):
  1. User can configure two row axes and two column axes via PAFVProvider setters without affecting any of the 8 non-SuperGrid views
  2. getStackedGroupBySQL() returns a multi-field GROUP BY clause that is separate from and does not alter the output of compile()
  3. Axis configuration round-trips through toJSON()/setState() with full fidelity (no data loss on serialization)
  4. All existing non-SuperGrid view tests pass unchanged after PAFVProvider extension
**Plans**: 2 plans

Plans:
- [ ] 15-01-PLAN.md — PAFVState extension, VIEW_DEFAULTS update, setColAxes/setRowAxes setters with validation
- [ ] 15-02-PLAN.md — getStackedGroupBySQL() method, isPAFVState() backward compatibility, serialization round-trip

### Phase 16: SuperGridQuery Worker Wiring
**Goal**: SuperGridQuery dead code becomes executable via a typed Worker message type with single-query-per-frame contract
**Depends on**: Phase 15
**Requirements**: FOUN-05, FOUN-06, FOUN-07
**Success Criteria** (what must be TRUE):
  1. WorkerBridge.superGridQuery() sends a supergrid:query message and receives grouped cell results ({ cells: [{rowKey, colKey, count, card_ids}] })
  2. Worker rejects invalid axis fields via validateAxisField() and returns a typed error (not a runtime crash)
  3. db:distinct-values message type returns distinct column values for filter dropdown population
  4. Four providers firing simultaneously within one StateCoordinator 16ms batch produce exactly one superGridQuery() call
**Plans**: 2 plans

Plans:
- [ ] 16-01-PLAN.md — Protocol extension + supergrid.handler.ts with buildSuperGridQuery execution and axis validation
- [ ] 16-02-PLAN.md — WorkerBridge.superGridQuery() with rAF coalescing and distinctValues() typed method

### Phase 17: SuperGrid Dynamic Axis Reads
**Goal**: SuperGrid renders from live PAFVProvider state and Worker query results instead of hardcoded constants and in-memory filtering
**Depends on**: Phase 16
**Requirements**: FOUN-08, FOUN-09, FOUN-10, FOUN-11
**Success Criteria** (what must be TRUE):
  1. Changing PAFVProvider axis configuration causes SuperGrid to render different headers and cells without a page reload
  2. SuperGrid fetches grouped cell data from Worker (supergrid:query) and renders correct cells in correct CSS Grid positions
  3. SuperGrid subscribes to PAFVProvider state changes and re-renders automatically
  4. Multiple provider changes within one 16ms batch produce exactly one Worker query call (no UI freeze on rapid axis changes)
**Plans**: TBD

Plans:
- [ ] 17-01: SuperGrid constructor accepts PAFVProvider; remove DEFAULT_COL_FIELD/DEFAULT_ROW_FIELD constants
- [ ] 17-02: SuperGrid render() calls bridge.superGridQuery() and maps grouped results to CSS Grid cells
- [ ] 17-03: StateCoordinator subscription wiring and batch deduplication test

### Phase 18: SuperDynamic
**Goal**: Users can drag axis headers between row and column dimensions to transpose the grid in real time
**Depends on**: Phase 17
**Requirements**: DYNM-01, DYNM-02, DYNM-03, DYNM-04, DYNM-05
**Success Criteria** (what must be TRUE):
  1. User can drag a row axis header into the column area and the grid reflows with correct new column dimensions
  2. User can drag a column axis header into the row area and the grid reflows with correct new row dimensions
  3. User can reorder axes within the same dimension (row-to-row or col-to-col) via drag
  4. Grid reflow after axis transpose completes with a 300ms D3 transition animation
  5. Axis assignments survive view switches (leaving SuperGrid and returning shows same axis configuration)
**Plans**: TBD

Plans:
- [ ] 18-01: Module-level dragPayload singleton for HTML5 DnD cross-zone discrimination
- [ ] 18-02: Drag handlers (dragstart/dragover/drop) for axis transpose between dimensions
- [ ] 18-03: d3.drag in-stack reordering for same-dimension reorder + PAFVProvider persistence

### Phase 19: SuperPosition + SuperZoom
**Goal**: Users can zoom in/out via trackpad pinch or mouse wheel with frozen headers and upper-left corner anchor; PAFV coordinates are tracked for cross-view restoration
**Depends on**: Phase 17
**Requirements**: POSN-01, POSN-02, POSN-03, ZOOM-01, ZOOM-02, ZOOM-03, ZOOM-04
**Success Criteria** (what must be TRUE):
  1. User can zoom in/out via mouse wheel or trackpad pinch; the upper-left corner cell stays fixed (does not drift)
  2. Row headers and column headers remain visible during horizontal and vertical scroll (CSS position:sticky)
  3. User cannot scroll past the table's last row or last column (scroll extent is bounded)
  4. Returning to SuperGrid from another view restores the previously viewed scroll position
  5. SuperPositionProvider state changes do not trigger supergrid:query Worker calls
**Plans**: TBD

Plans:
- [ ] 19-01: SuperPositionProvider (Tier 3 ephemeral, not in StateCoordinator) with scroll offset and cell bbox cache
- [ ] 19-02: SuperGridZoom.ts — CSS Custom Property column/row width scaling via wheel/pinch events
- [ ] 19-03: CSS position:sticky frozen headers, scroll boundary enforcement, and position restore on view return

### Phase 20: SuperSize
**Goal**: Users can resize columns by dragging header edges with Pointer Events API; widths persist across sessions
**Depends on**: Phase 19
**Requirements**: SIZE-01, SIZE-02, SIZE-03, SIZE-04
**Success Criteria** (what must be TRUE):
  1. User can drag the right edge of a column header to resize that column width in real time
  2. User can double-click a column header edge to auto-fit the column width to its content
  3. User can Shift+drag a column header edge to resize all columns proportionally
  4. Column widths are restored after closing and reopening the app (Tier 2 persistence via PAFVProvider)
**Plans**: TBD

Plans:
- [ ] 20-01: SuperGridSizer.ts with Pointer Events (pointerdown/pointermove/pointerup) and setPointerCapture()
- [ ] 20-02: CSS Custom Property (--col-width-{key}) updates on drag; double-click auto-fit
- [ ] 20-03: Shift+drag bulk resize and PAFVProvider Tier 2 persistence for column widths

### Phase 21: SuperSelect
**Goal**: Users can select cells via click, Cmd+click, Shift+click, and lasso drag with z-axis click zone discrimination; selection is fast with a bounding box cache
**Depends on**: Phase 19
**Requirements**: SLCT-01, SLCT-02, SLCT-03, SLCT-04, SLCT-05, SLCT-06, SLCT-07, SLCT-08
**Success Criteria** (what must be TRUE):
  1. User can click a data cell to select its cards; Cmd+click adds/removes from selection; Shift+click selects a rectangular 2D range
  2. User can lasso-drag to select all cells within a rubber-band rectangle
  3. Clicking a header selects all cards under that header's data range
  4. Clicking a header, data cell, and SuperCard (once SuperCards exist) produces the correct action for each z-axis zone
  5. Pressing Escape clears all selection
  6. Lasso does not cause layout thrash (reads from bounding box cache, not live DOM)
**Plans**: TBD

Plans:
- [ ] 21-01: Cell bounding box cache (Map<string, DOMRect>) built after each render cycle; invalidation on render
- [ ] 21-02: SuperGridSelect.ts SVG lasso overlay with pointer events and cache-based hit testing
- [ ] 21-03: Click/Cmd+click/Shift+click 2D rectangular range, header select-all, Escape clear, z-axis discrimination

### Phase 22: SuperDensity
**Goal**: Users can control grid information density at four levels (Value, Extent, View, Region); density changes do not misalign cells
**Depends on**: Phase 17
**Requirements**: DENS-01, DENS-02, DENS-03, DENS-04, DENS-05, DENS-06
**Success Criteria** (what must be TRUE):
  1. User can collapse time hierarchy levels (day to week to month to quarter to year) via a density control; collapsed headers show aggregate card counts
  2. User can hide or show empty intersections (cells with no matching cards)
  3. User can toggle between spreadsheet mode (card previews in cells) and matrix mode (counts only in cells)
  4. After any density change, all data cells appear in their correct CSS Grid positions (no misalignment between header positions and data cell positions)
**Plans**: TBD

Plans:
- [ ] 22-01: SuperDensityState interface (axisGranularity, hideEmpty, viewMode, regionConfig stub) separate from DensityProvider
- [ ] 22-02: Level 1 Value density (time hierarchy collapse via strftime GROUP BY) with aggregate count display
- [ ] 22-03: Level 2 Extent density (hide/show empty intersections) and Level 3 View density (spreadsheet vs matrix); gridColumn/gridRow set in both enter AND update callbacks

### Phase 23: SuperSort
**Goal**: Users can sort grid contents by clicking column or row headers; sort stays within groups and does not cross group boundaries
**Depends on**: Phase 22
**Requirements**: SORT-01, SORT-02, SORT-03, SORT-04
**Success Criteria** (what must be TRUE):
  1. User can click a column or row header to cycle sort: ascending, then descending, then unsorted
  2. User can Cmd+click multiple headers to establish a multi-sort with visible priority ordering
  3. Active sort shows a visual indicator (▲ for ascending, ▼ for descending) on the sorted header
  4. Sorting a column that spans multiple groups sorts within each group independently (cards do not cross group boundaries)
**Plans**: TBD

Plans:
- [ ] 23-01: SortState class with typed sort array; click-to-cycle and Cmd+click multi-sort header handlers
- [ ] 23-02: validateAxisField() validation of sortOverrides fields and ORDER BY group-key-first SQL compilation
- [ ] 23-03: Visual sort indicators (▲/▼) on headers and integration with supergrid:query compound query

### Phase 24: SuperFilter
**Goal**: Users can filter grid contents per column/row axis via auto-filter dropdowns populated instantly from current query results
**Depends on**: Phase 22
**Requirements**: FILT-01, FILT-02, FILT-03, FILT-04, FILT-05
**Success Criteria** (what must be TRUE):
  1. User can click a filter icon on a column or row header to open a dropdown showing checkboxes for distinct values
  2. The dropdown opens with no delay (populated from current supergrid:query result, not a new Worker query)
  3. User can use Select All and Clear buttons to bulk-operate on filter values
  4. A visual indicator on the header shows when a filter is active for that axis
  5. Deselecting all filter values returns the grid to its unfiltered state
**Plans**: TBD

Plans:
- [ ] 24-01: SuperGridFilter.ts per-header filter icon and position:absolute dropdown with scrollable checkbox list
- [ ] 24-02: Populate dropdown from last supergrid:query result colKey/rowKey values; zero Worker round-trip on open
- [ ] 24-03: Select All/Clear via FilterProvider.clearAxis(); active filter indicator; db:distinct-values fallback for initial state

### Phase 25: SuperSearch
**Goal**: Users can search the grid via Cmd+F with FTS5-powered highlighting that survives re-renders and is managed entirely by the D3 data join
**Depends on**: Phase 22
**Requirements**: SRCH-01, SRCH-02, SRCH-03, SRCH-04, SRCH-05, SRCH-06
**Success Criteria** (what must be TRUE):
  1. Pressing Cmd+F activates a search input in the SuperGrid toolbar
  2. Typing in the search input highlights matching cells after a 300ms debounce delay
  3. Matching cells show mark-tagged highlighted text; the highlights survive subsequent filter or axis changes
  4. Clearing the search input removes all highlights immediately with no residual marks
  5. The FTS MATCH clause is folded into the compound supergrid:query (search does not add a second Worker round-trip)
**Plans**: TBD

Plans:
- [ ] 25-01: SuperGridSearch.ts search panel with Cmd+F activation and 300ms debounced input
- [ ] 25-02: FTS5 MATCH clause folded into supergrid:query WHERE as subquery; matchedTerms[] in CellDatum
- [ ] 25-03: D3 .each() callback produces mark-decorated content from matchedTerms; stale response discard via correlation ID; highlights survive re-renders

### Phase 26: SuperTime
**Goal**: Users can use date fields as grid axes with auto-detected hierarchy; non-contiguous time periods can be selected simultaneously
**Depends on**: Phase 22
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. A date field used as an axis auto-parses mixed date string formats and renders as a time hierarchy without user configuration
  2. The grid automatically selects an appropriate time level (day/week/month/quarter/year) based on the date span of the data
  3. User can manually override the time hierarchy level via a control
  4. User can Cmd+click non-contiguous time period headers (e.g., Q1 and Q3) to select both simultaneously
  5. Non-contiguous time period selection filters the grid to show only cards from the selected periods
**Plans**: TBD

Plans:
- [ ] 26-01: d3-time-format sequential fallback date parser; smartHierarchy() function using d3.timeDay.count()
- [ ] 26-02: Time hierarchy header rendering via buildHeaderCells() with correct tuple structure; manual override control
- [ ] 26-03: Non-contiguous period selection via Set<string> of period keys compiled to FilterProvider 'in' operator

### Phase 27: SuperCards + Polish
**Goal**: Aggregation cards at group intersections close the milestone; performance benchmarks pass and keyboard shortcuts are documented
**Depends on**: Phase 21, Phase 22
**Requirements**: CARD-01, CARD-02, CARD-03, CARD-04, CARD-05, PLSH-01, PLSH-02, PLSH-03, PLSH-04, PLSH-05
**Success Criteria** (what must be TRUE):
  1. Each group intersection cell shows a generated aggregation card with the COUNT of cards in that group; the visual style (dashed border, italic text) is distinct from data cards
  2. Clicking a SuperCard shows a tooltip with aggregation details; clicking the SuperCard body does not select the data cards beneath it
  3. SuperCards are excluded from SelectionProvider results and FTS search results
  4. A 50×50 cell SuperGrid renders in under 16ms; SuperGridQuery GROUP BY on 10K cards completes in under 100ms; axis transpose reflow completes in under 300ms
  5. All SuperGrid keyboard shortcuts are documented in the help overlay (Cmd+F, Escape, Shift+click, Cmd+click); right-click on headers offers Sort, Filter, Hide
**Plans**: TBD

Plans:
- [ ] 27-01: SuperGridCards.ts aggregation card DOM generation from supergrid:query COUNT data; distinct visual style
- [ ] 27-02: SuperCard click tooltip; z-axis exclusion from SelectionProvider and FTS; data-supercard attribute
- [ ] 27-03: PLSH-01 through PLSH-03 performance benchmark suite; PLSH-04 keyboard shortcut help overlay; PLSH-05 right-click context menu

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 3/3 | Complete | 2026-03-01 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. ETL Foundation + Apple Notes Parser | v1.1 | 5/5 | Complete | 2026-03-01 |
| 9. Remaining Parsers + Export Pipeline | v1.1 | 5/5 | Complete | 2026-03-02 |
| 10. Progress Reporting + Polish | v1.1 | 2/2 | Complete | 2026-03-02 |
| 11. Xcode Shell + WKURLSchemeHandler | v2.0 | 2/2 | Complete | 2026-03-02 |
| 12. Bridge + Data Persistence | v2.0 | 3/3 | Complete | 2026-03-03 |
| 13. Native Chrome + File Import | v2.0 | 3/3 | Complete | 2026-03-03 |
| 14. iCloud + StoreKit Tiers | v2.0 | 3/3 | Complete | 2026-03-03 |
| 15. PAFVProvider Stacked Axes | 2/2 | Complete    | 2026-03-04 | - |
| 16. SuperGridQuery Worker Wiring | 2/2 | Complete   | 2026-03-04 | - |
| 17. SuperGrid Dynamic Axis Reads | v3.0 | 0/3 | Not started | - |
| 18. SuperDynamic | v3.0 | 0/3 | Not started | - |
| 19. SuperPosition + SuperZoom | v3.0 | 0/3 | Not started | - |
| 20. SuperSize | v3.0 | 0/3 | Not started | - |
| 21. SuperSelect | v3.0 | 0/3 | Not started | - |
| 22. SuperDensity | v3.0 | 0/3 | Not started | - |
| 23. SuperSort | v3.0 | 0/3 | Not started | - |
| 24. SuperFilter | v3.0 | 0/3 | Not started | - |
| 25. SuperSearch | v3.0 | 0/3 | Not started | - |
| 26. SuperTime | v3.0 | 0/3 | Not started | - |
| 27. SuperCards + Polish | v3.0 | 0/3 | Not started | - |

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers shipped: 2026-03-02*
*v2.0 Native Shell shipped: 2026-03-03*
*v3.0 SuperGrid Complete phases added: 2026-03-03*
