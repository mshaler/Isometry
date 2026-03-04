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
- [ ] **FOUN-05**: Worker handles `supergrid:query` message type executing `buildSuperGridQuery()` and returning `{ cells: [{rowKey, colKey, count, card_ids}] }`
- [ ] **FOUN-06**: Worker handles `db:distinct-values` message type for column distinct value queries
- [ ] **FOUN-07**: WorkerBridge exposes typed `superGridQuery()` method with correlation ID tracking
- [ ] **FOUN-08**: SuperGrid reads stacked axes from PAFVProvider dynamically instead of hardcoded `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD`
- [ ] **FOUN-09**: SuperGrid fetches grouped cell data via `bridge.superGridQuery()` instead of in-memory card filtering
- [ ] **FOUN-10**: SuperGrid re-renders on PAFVProvider state changes via subscription
- [ ] **FOUN-11**: Multiple provider changes within one StateCoordinator 16ms batch produce exactly one `superGridQuery()` call

### SuperDynamic

- [ ] **DYNM-01**: User can drag a row axis header to the column axis area to transpose the grid
- [ ] **DYNM-02**: User can drag a column axis header to the row axis area to transpose the grid
- [ ] **DYNM-03**: User can reorder axes within the same dimension (row-to-row, col-to-col) via drag
- [ ] **DYNM-04**: Axis transpose triggers grid reflow with 300ms D3 transition animation
- [ ] **DYNM-05**: Axis assignments persist via PAFVProvider + StateManager across view switches

### SuperPosition

- [ ] **POSN-01**: SuperPositionProvider tracks current PAFV coordinates (rowValues + colValues + scrollAnchorCard) as Tier 3 ephemeral state
- [ ] **POSN-02**: PAFV coordinates survive axis transpose (tracked by axis values, not pixel positions)
- [ ] **POSN-03**: Returning to SuperGrid from another view restores the last viewed coordinate position

### SuperZoom

- [ ] **ZOOM-01**: User can zoom in/out via mouse wheel or trackpad pinch with upper-left corner pinned
- [ ] **ZOOM-02**: Row headers and column headers stay visible (frozen) during scroll via CSS position:sticky
- [ ] **ZOOM-03**: Zoom is implemented via CSS Custom Property column/row width scaling, not CSS transform
- [ ] **ZOOM-04**: User cannot scroll past table boundaries (scroll extent is bounded)

### SuperSize

- [ ] **SIZE-01**: User can drag column header edge to resize column width
- [ ] **SIZE-02**: User can double-click column header edge to auto-fit column width to content
- [ ] **SIZE-03**: User can Shift+drag to bulk-resize all columns proportionally
- [ ] **SIZE-04**: Column widths persist to Tier 2 state via PAFVProvider across sessions

### SuperSelect

- [ ] **SLCT-01**: User can click a data cell to select its card(s)
- [ ] **SLCT-02**: User can Cmd+click to toggle-add cells to selection
- [ ] **SLCT-03**: User can Shift+click to select a rectangular 2D range of cells
- [ ] **SLCT-04**: User can lasso-drag to select cells within a rubber-band rectangle
- [ ] **SLCT-05**: Clicking a header selects all cards under that header's data range
- [ ] **SLCT-06**: Z-axis click zones discriminate header clicks from data cell clicks from SuperCard clicks
- [ ] **SLCT-07**: Escape key clears all selection
- [ ] **SLCT-08**: Lasso uses post-render cell bounding box cache (no per-event DOM reads)

### SuperDensity

- [ ] **DENS-01**: Level 1 Value Density: user can collapse time hierarchy levels (day → week → month → quarter → year) via control
- [ ] **DENS-02**: Level 2 Extent Density: user can hide/show empty intersections (rows/columns with no matching cards)
- [ ] **DENS-03**: Level 3 View Density: user can toggle between spreadsheet mode (cells show card previews) and matrix mode (cells show counts only)
- [ ] **DENS-04**: Level 4 Region Density: data structure defined and stubbed (no UI in v3.0)
- [ ] **DENS-05**: Collapsed headers show aggregate card counts (user can see data is grouped, not lost)
- [ ] **DENS-06**: Density changes set `gridColumn`/`gridRow` in both D3 enter AND update callbacks (no misalignment on collapse)

### SuperSort

- [ ] **SORT-01**: User can click a column/row header to cycle sort: ascending → descending → none
- [ ] **SORT-02**: User can Cmd+click headers for multi-sort with priority ordering
- [ ] **SORT-03**: Active sort shows visual indicator (▲/▼) on the header
- [ ] **SORT-04**: Sort operates within groups only (does not cross group boundaries)

### SuperFilter

- [ ] **FILT-01**: User can click a filter icon on column/row headers to open auto-filter dropdown
- [ ] **FILT-02**: Dropdown shows checkbox list of distinct values for that axis, populated from current query result (no additional Worker query on open)
- [ ] **FILT-03**: Select All and Clear buttons in dropdown for bulk operations
- [ ] **FILT-04**: Active filter shows visual indicator on header
- [ ] **FILT-05**: Removing all filters restores the unfiltered grid

### SuperSearch

- [ ] **SRCH-01**: User can activate in-grid search via Cmd+F keyboard shortcut
- [ ] **SRCH-02**: Search input queries FTS5 with debounced 300ms delay
- [ ] **SRCH-03**: Matching cells are highlighted via CSS class + `<mark>` tags rendered by D3 data join (not innerHTML injection)
- [ ] **SRCH-04**: FTS MATCH clause is folded into compound `supergrid:query` (not a separate Worker call)
- [ ] **SRCH-05**: Clearing search removes all highlights immediately
- [ ] **SRCH-06**: Search highlights survive consecutive re-renders from filter/axis changes

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
| FOUN-05 | Phase 16 | Pending |
| FOUN-06 | Phase 16 | Pending |
| FOUN-07 | Phase 16 | Pending |
| FOUN-08 | Phase 17 | Pending |
| FOUN-09 | Phase 17 | Pending |
| FOUN-10 | Phase 17 | Pending |
| FOUN-11 | Phase 17 | Pending |
| DYNM-01 | Phase 18 | Pending |
| DYNM-02 | Phase 18 | Pending |
| DYNM-03 | Phase 18 | Pending |
| DYNM-04 | Phase 18 | Pending |
| DYNM-05 | Phase 18 | Pending |
| POSN-01 | Phase 19 | Pending |
| POSN-02 | Phase 19 | Pending |
| POSN-03 | Phase 19 | Pending |
| ZOOM-01 | Phase 19 | Pending |
| ZOOM-02 | Phase 19 | Pending |
| ZOOM-03 | Phase 19 | Pending |
| ZOOM-04 | Phase 19 | Pending |
| SIZE-01 | Phase 20 | Pending |
| SIZE-02 | Phase 20 | Pending |
| SIZE-03 | Phase 20 | Pending |
| SIZE-04 | Phase 20 | Pending |
| SLCT-01 | Phase 21 | Pending |
| SLCT-02 | Phase 21 | Pending |
| SLCT-03 | Phase 21 | Pending |
| SLCT-04 | Phase 21 | Pending |
| SLCT-05 | Phase 21 | Pending |
| SLCT-06 | Phase 21 | Pending |
| SLCT-07 | Phase 21 | Pending |
| SLCT-08 | Phase 21 | Pending |
| DENS-01 | Phase 22 | Pending |
| DENS-02 | Phase 22 | Pending |
| DENS-03 | Phase 22 | Pending |
| DENS-04 | Phase 22 | Pending |
| DENS-05 | Phase 22 | Pending |
| DENS-06 | Phase 22 | Pending |
| SORT-01 | Phase 23 | Pending |
| SORT-02 | Phase 23 | Pending |
| SORT-03 | Phase 23 | Pending |
| SORT-04 | Phase 23 | Pending |
| FILT-01 | Phase 24 | Pending |
| FILT-02 | Phase 24 | Pending |
| FILT-03 | Phase 24 | Pending |
| FILT-04 | Phase 24 | Pending |
| FILT-05 | Phase 24 | Pending |
| SRCH-01 | Phase 25 | Pending |
| SRCH-02 | Phase 25 | Pending |
| SRCH-03 | Phase 25 | Pending |
| SRCH-04 | Phase 25 | Pending |
| SRCH-05 | Phase 25 | Pending |
| SRCH-06 | Phase 25 | Pending |
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
