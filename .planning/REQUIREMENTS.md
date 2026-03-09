# Requirements: Isometry v5.2

**Defined:** 2026-03-09
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.

## v5.2 Requirements

Requirements for v5.2 SuperCalc + Workbench Phase B. Each maps to roadmap phases.

### SuperCalc

- [x] **CALC-01**: SuperGrid displays aggregate footer row at bottom of each row group with SUM/AVG/COUNT/MIN/MAX results
- [x] **CALC-02**: Aggregate function per column is configurable via Workbench panel section
- [x] **CALC-03**: Aggregate functions auto-detect column type (COUNT for text, SUM for numbers) as defaults
- [x] **CALC-04**: Aggregation computed via separate `supergrid:calc` Worker query using SQL GROUP BY (not client-side math)
- [x] **CALC-05**: Footer rows visually distinct (different background, bold text) and work correctly with virtual scrolling
- [x] **CALC-06**: Footer rows update live when filters, density, or axis assignments change

### Notebook

- [x] **NOTE-01**: Formatting toolbar with bold, italic, heading, list, and link buttons above textarea
- [x] **NOTE-02**: Toolbar uses undo-safe textarea insertion (document.execCommand or InputEvent, not direct value assignment)
- [ ] **NOTE-03**: Notebook is per-card — each card has its own markdown content, switching cards loads the relevant note
- [ ] **NOTE-04**: Notebook markdown persisted via ui_state table (`notebook:{cardId}` key convention)
- [ ] **NOTE-05**: Notebook content survives app reload and is included in database checkpoint (CloudKit sync via existing flow)
- [ ] **NOTE-06**: D3 chart blocks embedded in notebook preview using custom marked extension with fenced syntax
- [ ] **NOTE-07**: Chart blocks render current filtered SuperGrid data (live dashboard reflecting active filters/search)
- [ ] **NOTE-08**: Chart block SVG rendered via two-pass approach — DOMPurify sanitizes first, D3 mounts into placeholders after

### LATCH Phase B

- [ ] **LTPB-01**: Histogram scrubber in LATCH explorer showing value distribution for numeric/date fields via D3 bins
- [ ] **LTPB-02**: Histogram supports drag-to-select range filtering via d3.brushX with live SuperGrid update
- [ ] **LTPB-03**: Category chips displayed for categorical fields (cardinality < 20) with click-to-toggle multi-select
- [ ] **LTPB-04**: Category chips show count badges and integrate with existing FilterProvider

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### SuperCalc Extended

- **CALC-F01**: Grand total row aggregating all visible data at grid bottom
- **CALC-F02**: Derived/calculated columns (e.g., "days since created", "priority score")
- **CALC-F03**: Cell-level formulas referencing other cells (A1:B5 style)
- **CALC-F04**: Conditional formatting rules driven by aggregate thresholds

### Notebook Extended

- **NOTE-F01**: Notebook content indexed in FTS5 for full-text search
- **NOTE-F02**: Image/attachment embedding in notebook
- **NOTE-F03**: Notebook export to standalone Markdown file

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| HyperFormula integration | Permanently replaced by SQL DSL -- ~500KB bundle, unsolved PAFV formula syntax |
| Schema migration infrastructure | ui_state table already exists; no new tables needed for v5.2 |
| CloudKit ui_state sync extension | Notebook content syncs via existing database checkpoint flow |
| Per-cell formulas | Requires full formula engine; deferred to future SuperCalc Extended |
| Notebook image uploads | Storage/bandwidth complexity; markdown text only for v5.2 |
| LATCH histogram for non-numeric fields | Histograms only for numeric and date fields; text uses category chips |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CALC-01 | Phase 62 | Complete |
| CALC-02 | Phase 62 | Complete |
| CALC-03 | Phase 62 | Complete |
| CALC-04 | Phase 62 | Complete |
| CALC-05 | Phase 62 | Complete |
| CALC-06 | Phase 62 | Complete |
| NOTE-01 | Phase 63 | Complete |
| NOTE-02 | Phase 63 | Complete |
| NOTE-03 | Phase 64 | Pending |
| NOTE-04 | Phase 64 | Pending |
| NOTE-05 | Phase 64 | Pending |
| NOTE-06 | Phase 65 | Pending |
| NOTE-07 | Phase 65 | Pending |
| NOTE-08 | Phase 65 | Pending |
| LTPB-01 | Phase 66 | Pending |
| LTPB-02 | Phase 66 | Pending |
| LTPB-03 | Phase 67 | Pending |
| LTPB-04 | Phase 67 | Pending |

**Coverage:**
- v5.2 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation (18/18 mapped)*
