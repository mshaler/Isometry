# Requirements: Isometry v3.0 SuperGrid Complete

**Defined:** 2026-03-03
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v3.0 Requirements

Requirements for SuperGrid Complete. Each maps to roadmap phases.

### Foundation

- [x] **FOUN-01**: PAFVProvider exposes `colAxes: AxisMapping[]` and `rowAxes: AxisMapping[]` with setter methods validated against existing allowlist
- [x] **FOUN-02**: PAFVProvider provides `getStackedGroupBySQL()` method separate from `compile()` that returns multi-field GROUP BY SQL from stacked axes
- [x] **FOUN-03**: PAFVProvider stacked axes serialize/deserialize via `toJSON()`/`setState()` with round-trip fidelity
- [x] **FOUN-04**: All 8 non-SuperGrid views continue using `compile()` unaffected by stacked axes addition
- [x] **FOUN-05**: Worker handles `supergrid:query` message type executing `buildSuperGridQuery()` and returning `{ cells: [{rowKey, colKey, count, card_ids}] }`
- [x] **FOUN-06**: Worker handles `db:distinct-values` message type for column distinct value queries
- [x] **FOUN-07**: WorkerBridge exposes typed `superGridQuery()` method with correlation ID tracking
- [x] **FOUN-08**: SuperGrid reads stacked axes from PAFVProvider dynamically instead of hardcoded `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD`
- [x] **FOUN-09**: SuperGrid fetches grouped cell data via `bridge.superGridQuery()` instead of in-memory card filtering
- [x] **FOUN-10**: SuperGrid re-renders on PAFVProvider state changes via subscription
- [x] **FOUN-11**: Multiple provider changes within one StateCoordinator 16ms batch produce exactly one `superGridQuery()` call

### SuperDynamic

- [x] **DYNM-01**: User can drag a row axis header to the column axis area to transpose the grid
- [x] **DYNM-02**: User can drag a column axis header to the row axis area to transpose the grid
- [x] **DYNM-03**: User can reorder axes within the same dimension (row-to-row, col-to-col) via drag
- [x] **DYNM-04**: Axis transpose triggers grid reflow with 300ms D3 transition animation
- [x] **DYNM-05**: Axis assignments persist via PAFVProvider + StateManager across view switches

### SuperPosition

- [x] **POSN-01**: SuperPositionProvider tracks current PAFV coordinates (rowValues + colValues + scrollAnchorCard) as Tier 3 ephemeral state
- [x] **POSN-02**: PAFV coordinates survive axis transpose (tracked by axis values, not pixel positions)
- [x] **POSN-03**: Returning to SuperGrid from another view restores the last viewed coordinate position

### SuperZoom

- [x] **ZOOM-01**: User can zoom in/out via mouse wheel or trackpad pinch with upper-left corner pinned
- [x] **ZOOM-02**: Row headers and column headers stay visible (frozen) during scroll via CSS position:sticky
- [x] **ZOOM-03**: Zoom is implemented via CSS Custom Property column/row width scaling, not CSS transform
- [x] **ZOOM-04**: User cannot scroll past table boundaries (scroll extent is bounded)

### SuperSize

- [x] **SIZE-01**: User can drag column header edge to resize column width
- [x] **SIZE-02**: User can double-click column header edge to auto-fit column width to content
- [x] **SIZE-03**: User can Shift+drag to bulk-resize all columns proportionally
- [x] **SIZE-04**: Column widths persist to Tier 2 state via PAFVProvider across sessions

### SuperSelect

- [x] **SLCT-01**: User can click a data cell to select its card(s)
- [x] **SLCT-02**: User can Cmd+click to toggle-add cells to selection
- [x] **SLCT-03**: User can Shift+click to select a rectangular 2D range of cells
- [x] **SLCT-04**: User can lasso-drag to select cells within a rubber-band rectangle
- [x] **SLCT-05**: Clicking a header selects all cards under that header's data range
- [x] **SLCT-06**: Z-axis click zones discriminate header clicks from data cell clicks from SuperCard clicks
- [x] **SLCT-07**: Escape key clears all selection
- [x] **SLCT-08**: Lasso uses post-render cell bounding box cache (no per-event DOM reads)

### SuperDensity

- [x] **DENS-01**: Level 1 Value Density: user can collapse time hierarchy levels (day → week → month → quarter → year) via control
- [x] **DENS-02**: Level 2 Extent Density: user can hide/show empty intersections (rows/columns with no matching cards)
- [x] **DENS-03**: Level 3 View Density: user can toggle between spreadsheet mode (cells show card previews) and matrix mode (cells show counts only)
- [x] **DENS-04**: Level 4 Region Density: data structure defined and stubbed (no UI in v3.0)
- [x] **DENS-05**: Collapsed headers show aggregate card counts (user can see data is grouped, not lost)
- [x] **DENS-06**: Density changes set `gridColumn`/`gridRow` in both D3 enter AND update callbacks (no misalignment on collapse)

### SuperSort

- [x] **SORT-01**: User can click a column/row header to cycle sort: ascending → descending → none
- [x] **SORT-02**: User can Cmd+click headers for multi-sort with priority ordering
- [x] **SORT-03**: Active sort shows visual indicator (▲/▼) on the header
- [x] **SORT-04**: Sort operates within groups only (does not cross group boundaries)

### SuperFilter

- [x] **FILT-01**: User can click a filter icon on column/row headers to open auto-filter dropdown
- [x] **FILT-02**: Dropdown shows checkbox list of distinct values for that axis, populated from current query result (no additional Worker query on open)
- [x] **FILT-03**: Select All and Clear buttons in dropdown for bulk operations
- [x] **FILT-04**: Active filter shows visual indicator on header
- [x] **FILT-05**: Removing all filters restores the unfiltered grid

### SuperSearch

- [x] **SRCH-01**: User can activate in-grid search via Cmd+F keyboard shortcut
- [x] **SRCH-02**: Search input queries FTS5 with debounced 300ms delay
- [x] **SRCH-03**: Matching cells are highlighted via CSS class + `<mark>` tags rendered by D3 data join (not innerHTML injection)
- [x] **SRCH-04**: FTS MATCH clause is folded into compound `supergrid:query` (not a separate Worker call)
- [x] **SRCH-05**: Clearing search removes all highlights immediately
- [x] **SRCH-06**: Search highlights survive consecutive re-renders from filter/axis changes

### SuperTime

- [ ] **TIME-01**: Time axis auto-detects date fields and parses via d3-time-format sequential format fallback
- [ ] **TIME-02**: Smart hierarchy selects appropriate time level (day/week/month/quarter/year) based on data date span
- [ ] **TIME-03**: User can manually override time hierarchy level
- [ ] **TIME-04**: User can select non-contiguous time periods (e.g., Q1 + Q3) via Cmd+click on time headers
- [ ] **TIME-05**: Non-contiguous time selection compiles to FilterProvider 'in' operator WHERE clause

### SuperCards

- [ ] **CARD-01**: Group intersections display generated aggregation cards showing COUNT of cards in that group
- [ ] **CARD-02**: SuperCards have distinct visual style (dashed border, italic text) distinguishable from data cards
- [ ] **CARD-03**: Clicking a SuperCard shows a tooltip with aggregation details (not card selection)
- [ ] **CARD-04**: SuperCards are excluded from SelectionProvider results (selecting all does not include SuperCards)
- [ ] **CARD-05**: SuperCards are excluded from FTS search results and card counts

### Polish

- [ ] **PLSH-01**: SuperGrid renders 50×50 cell grid in <16ms (CSS Grid layout + D3 data join budget)
- [ ] **PLSH-02**: SuperGridQuery GROUP BY on 10K cards completes in <100ms
- [ ] **PLSH-03**: Axis transpose reflow completes in <300ms including transition animation
- [ ] **PLSH-04**: All SuperGrid keyboard shortcuts documented in help overlay (Cmd+F, Escape, Shift+click, Cmd+click)
- [ ] **PLSH-05**: Right-click context menu on headers offers Sort, Filter, Hide options

## v3.1+ Requirements

Deferred to future release. Tracked but not in current roadmap.

### SuperCalc

- **CALC-01**: User can enter PAFV-scoped formulas in SuperCard cells (HyperFormula engine)
- **CALC-02**: Formula references use PAFV dimensional coordinates (not cell indices)
- **CALC-03**: Formulas support standard functions (SUM, AVERAGE, COUNT, MIN, MAX)

### SuperAudit

- **AUDT-01**: Computed values display with distinct visual treatment (background tint, formula icon)
- **AUDT-02**: User can distinguish computed aggregation values from raw data values at a glance

## Out of Scope

| Feature | Reason |
|---------|--------|
| In-grid cell editing | Cards have rich content; double-click opens card detail view (SuperGrid.md Section 6) |
| Virtual scrolling for 100K+ rows | Grid renders group intersections (max 2,500 cells), not individual rows; cardinality guard at 50 |
| Arbitrary column pinning (mid-grid freeze) | PAFV axis model has header columns (always pinned by SuperZoom) and data cells (scroll); not an Excel-style spreadsheet |
| Conditional formatting rules | Requires formula engine (deferred); LATCH category system handles visual state via card data |
| Real-time collaborative editing | Deferred per PROJECT.md — future milestone |
| HyperFormula dependency in v3.0 | Formula reference syntax for PAFV coordinates is unsolved; ~500KB bundle; deferred to v3.1+ |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 15 | Complete |
| FOUN-02 | Phase 15 | Complete |
| FOUN-03 | Phase 15 | Complete |
| FOUN-04 | Phase 15 | Complete |
| FOUN-05 | Phase 16 | Complete |
| FOUN-06 | Phase 16 | Complete |
| FOUN-07 | Phase 16 | Complete |
| FOUN-08 | Phase 17 | Complete |
| FOUN-09 | Phase 17 | Complete |
| FOUN-10 | Phase 17 | Complete |
| FOUN-11 | Phase 17 | Complete |
| DYNM-01 | Phase 18 | Complete |
| DYNM-02 | Phase 18 | Complete |
| DYNM-03 | Phase 18 | Complete |
| DYNM-04 | Phase 18 | Complete |
| DYNM-05 | Phase 18 | Complete |
| POSN-01 | Phase 19 | Complete |
| POSN-02 | Phase 19 | Complete |
| POSN-03 | Phase 19 | Complete |
| ZOOM-01 | Phase 19 | Complete |
| ZOOM-02 | Phase 19 | Complete |
| ZOOM-03 | Phase 19 | Complete |
| ZOOM-04 | Phase 19 | Complete |
| SIZE-01 | Phase 20 | Complete |
| SIZE-02 | Phase 20 | Complete |
| SIZE-03 | Phase 20 | Complete |
| SIZE-04 | Phase 20 | Complete |
| SLCT-01 | Phase 21 | Complete |
| SLCT-02 | Phase 21 | Complete |
| SLCT-03 | Phase 21 | Complete |
| SLCT-04 | Phase 21 | Complete |
| SLCT-05 | Phase 21 | Complete |
| SLCT-06 | Phase 21 | Complete |
| SLCT-07 | Phase 21 | Complete |
| SLCT-08 | Phase 21 | Complete |
| DENS-01 | Phase 22 | Complete |
| DENS-02 | Phase 22 | Complete |
| DENS-03 | Phase 22 | Complete |
| DENS-04 | Phase 22 | Complete |
| DENS-05 | Phase 22 | Complete |
| DENS-06 | Phase 22 | Complete |
| SORT-01 | Phase 23 | Complete |
| SORT-02 | Phase 23 | Complete |
| SORT-03 | Phase 23 | Complete |
| SORT-04 | Phase 23 | Complete |
| FILT-01 | Phase 24 | Complete |
| FILT-02 | Phase 24 | Complete |
| FILT-03 | Phase 24 | Complete |
| FILT-04 | Phase 24 | Complete |
| FILT-05 | Phase 24 | Complete |
| SRCH-01 | Phase 25 | Complete |
| SRCH-02 | Phase 25 | Complete |
| SRCH-03 | Phase 25 | Complete |
| SRCH-04 | Phase 25 | Complete |
| SRCH-05 | Phase 25 | Complete |
| SRCH-06 | Phase 25 | Complete |
| TIME-01 | Phase 26 | Pending |
| TIME-02 | Phase 26 | Pending |
| TIME-03 | Phase 26 | Pending |
| TIME-04 | Phase 26 | Pending |
| TIME-05 | Phase 26 | Pending |
| CARD-01 | Phase 27 | Pending |
| CARD-02 | Phase 27 | Pending |
| CARD-03 | Phase 27 | Pending |
| CARD-04 | Phase 27 | Pending |
| CARD-05 | Phase 27 | Pending |
| PLSH-01 | Phase 27 | Pending |
| PLSH-02 | Phase 27 | Pending |
| PLSH-03 | Phase 27 | Pending |
| PLSH-04 | Phase 27 | Pending |
| PLSH-05 | Phase 27 | Pending |

**Coverage:**
- v3.0 requirements: 71 total (11 FOUN + 5 DYNM + 3 POSN + 4 ZOOM + 4 SIZE + 8 SLCT + 6 DENS + 4 SORT + 5 FILT + 6 SRCH + 5 TIME + 5 CARD + 5 PLSH)
- Mapped to phases: 71
- Unmapped: 0

---
*Requirements defined: 2026-03-03*
*Last updated: 2026-03-03 — traceability table completed after roadmap creation*
