# Requirements: Isometry v6.1 Test Harness

**Defined:** 2026-03-15
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Source:** docs/Isometry-Test-Harness-Reconciled.md (gap analysis from external AI handoff, reconciled against v6.0 shipped state)

## v6.1 Requirements

### Infrastructure

- [x] **INFR-01**: `realDb()` factory creates in-memory sql.js DB with production schema, no seed data
- [x] **INFR-02**: `makeProviders()` factory wires FilterProvider, PAFVProvider, SuperDensityProvider, SelectionProvider, StateCoordinator in correct init order
- [x] **INFR-03**: Smoke tests verify both factories work (insert-query round-trip, provider-coordinator notify)

### Seam: Filter to SQL

- [x] **FSQL-01**: eq/neq/in filters execute against real sql.js and return correct row subsets
- [x] **FSQL-02**: FTS search and FTS+field compound filters return correct results from real DB
- [x] **FSQL-03**: Range filters and axis filters execute correctly against real sql.js
- [x] **FSQL-04**: Allowlist validation prevents SQL injection before query execution
- [x] **FSQL-05**: Soft-deleted rows excluded from all filter query results

### Seam: PAFV to CellDatum

- [x] **CELL-01**: 1-axis and 2-axis configurations produce CellDatum with correct counts at each intersection
- [x] **CELL-02**: `__agg__` prefix regression guard -- no column name collision between GROUP BY and aggregate
- [x] **CELL-03**: hideEmpty flag correctly includes/excludes zero-count cells
- [x] **CELL-04**: sortOverrides produce correctly ordered card_ids within cells

### Seam: Coordinator to View

- [x] **CORD-01**: Filter change propagates through real StateCoordinator to trigger bridge re-query with updated params
- [x] **CORD-02**: Rapid filter changes batch into exactly one re-query
- [x] **CORD-03**: View destroy prevents stale re-queries after teardown

### Seam: Density to Bridge

- [x] **DENS-01**: hideEmpty and viewMode changes propagate through coordinator to bridge query params
- [x] **DENS-02**: Density provider changes trigger re-query via coordinator (regression guard -- should be GREEN on arrival)

### Seam: ViewTabBar to ViewManager

- [x] **VTAB-01**: Tab click sets PAFVProvider viewType and fires coordinator notification
- [x] **VTAB-02**: Active tab has aria-selected=true; LATCH-GRAPH round-trip preserves axis state

### Seam: Histogram to Filter

- [x] **HIST-01**: Scrubber drag events fire setRangeFilter with correct min/max
- [x] **HIST-02**: Range filter round-trips to SQL WHERE clause; reset clears filter

### Seam: CommandBar to Provider

- [x] **CMDB-01**: Cmd+F focuses search, Cmd+K opens palette, Escape clears search query
- [x] **CMDB-02**: CommandBar destroy removes keydown listener (no action after teardown)

### Seam: ETL to FTS5

- [ ] **EFTS-01**: XLSX and CSV imports produce FTS5-searchable cards via searchCards()
- [ ] **EFTS-02**: cards_fts rowcount matches cards rowcount; re-import updates FTS index

### Seam: WorkbenchShell Wiring

- [ ] **WBSH-01**: mount() wires providers before first render; initial view matches PAFVProvider default
- [ ] **WBSH-02**: destroy() cleans all subscriptions (no callbacks after teardown)

### Seam: CalcExplorer

- [ ] **CALC-01**: mount() creates DOM; axis changes rebuild dropdowns; numeric vs text field options correct
- [ ] **CALC-02**: Config change fires onConfigChange callback; destroy() cleans up

### Test Scripts

- [x] **SCRP-01**: package.json has `test:seams` and `test:harness` scripts targeting seam + helper tests

## Future Requirements

None -- this is a hardening milestone. Future work (v7.0+) depends on this quality gate passing.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Pixel snapshot / visual regression tests | Behavioral assertions only -- architectural decision |
| CloudKit sync integration tests | Requires iCloud account; not automatable in CI |
| Playwright E2E browser tests | Seam tests cover integration contracts |
| Performance / benchmark expansion | v6.0 already has perf budgets and CI bench job |
| D3 force simulation correctness | Client-side filtered subsets, not data pipeline |
| Duplicate ETL unit tests | Existing round-trip tests already cover parsers |
| GeometryBroadcast / sleeper wire | Ships dormant; no behavior to test until activated |
| sqlite-vec / semantic similarity | Deferred to v7.0+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFR-01 | Phase 79 | Complete |
| INFR-02 | Phase 79 | Complete |
| INFR-03 | Phase 79 | Complete |
| SCRP-01 | Phase 79 | Complete |
| FSQL-01 | Phase 80 | Complete |
| FSQL-02 | Phase 80 | Complete |
| FSQL-03 | Phase 80 | Complete |
| FSQL-04 | Phase 80 | Complete |
| FSQL-05 | Phase 80 | Complete |
| CELL-01 | Phase 80 | Complete |
| CELL-02 | Phase 80 | Complete |
| CELL-03 | Phase 80 | Complete |
| CELL-04 | Phase 80 | Complete |
| CORD-01 | Phase 81 | Complete |
| CORD-02 | Phase 81 | Complete |
| CORD-03 | Phase 81 | Complete |
| DENS-01 | Phase 81 | Complete |
| DENS-02 | Phase 81 | Complete |
| VTAB-01 | Phase 82 | Complete |
| VTAB-02 | Phase 82 | Complete |
| HIST-01 | Phase 82 | Complete |
| HIST-02 | Phase 82 | Complete |
| CMDB-01 | Phase 82 | Complete |
| CMDB-02 | Phase 82 | Complete |
| EFTS-01 | Phase 83 | Pending |
| EFTS-02 | Phase 83 | Pending |
| WBSH-01 | Phase 83 | Pending |
| WBSH-02 | Phase 83 | Pending |
| CALC-01 | Phase 83 | Pending |
| CALC-02 | Phase 83 | Pending |

**Coverage:**
- v6.1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
