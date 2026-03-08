# Requirements: Isometry v5.1 SuperGrid Spreadsheet UX

**Defined:** 2026-03-08
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.
**Source:** Cross-model review (Gemini + Codex) synthesized in `docs/SUPERGRID_SPREADSHEET_UX_HANDOFF.md`

## v5.1 Requirements

### CSS Visual Baseline

- [x] **CSSB-01**: design-tokens.css has `--sg-*` structural tokens (cell-padding, cell-font-size, cell-alt-bg, header-bg, gridline, selection-border, selection-bg, number-font, frozen-shadow)
- [x] **CSSB-02**: supergrid.css has semantic classes (sg-cell, sg-header, sg-selected, sg-row--alt, sg-numeric, sg-row-index, sg-corner-cell) with token-driven properties
- [x] **CSSB-03**: Cell and header elements use sg-cell/sg-header CSS classes; presentational inline styles (border, padding, non-selected bg-color) replaced
- [x] **CSSB-04**: Zebra striping via sg-row--alt on alternating row groups in spreadsheet mode
- [x] **CSSB-05**: Mode-scoped CSS overrides (`[data-view-mode]`) differentiate spreadsheet vs matrix cell padding

### Value-First Rendering

- [x] **VFST-01**: spreadsheet-classic rendering shows card name as plain text (1 card) or first name + `+N` badge (2+ cards), not pill elements
- [x] **VFST-02**: Card name cache (Map<id, name>) populated from query results, invalidated per `_fetchAndRender()`
- [ ] **VFST-03**: SuperCard tooltip triggers on `+N` badge hover (`.sg-cell-overflow-badge`), not whole cell
- [x] **VFST-04**: FTS5 `<mark>` highlighting preserved in classic mode cells via existing DOM-walking logic
- [ ] **VFST-05**: Regression tests: single-card plain text, multi-card `+N` badge, FTS marks present

### Row Index Gutter

- [ ] **RGUT-01**: 28px `sg-row-index` gutter column prepended as leftmost CSS Grid track in spreadsheet mode
- [ ] **RGUT-02**: Sequential row numbers (1..N) rendered in non-interactive gutter cells
- [ ] **RGUT-03**: `sg-corner-cell` at gutter/header intersection with sticky positioning (z-index 4)
- [ ] **RGUT-04**: Gutter hidden in matrix mode (`_showRowIndex = false`)
- [ ] **RGUT-05**: Regression tests: gutter elements present in spreadsheet mode, absent in matrix mode

### Active Cell Focus

- [ ] **ACEL-01**: Single `_activeCellKey` tracked independently of multi-cell selection set
- [ ] **ACEL-02**: `sg-cell--active` CSS class with outline ring on focused cell
- [ ] **ACEL-03**: Row/column crosshair highlights (`sg-col--active-crosshair`, `sg-row--active-crosshair`)
- [ ] **ACEL-04**: 6x6px `sg-fill-handle` affordance at bottom-right of active cell (visual only, pointer-events: none)
- [ ] **ACEL-05**: Active cell moves on click, previous crosshair classes cleared
- [ ] **ACEL-06**: Regression tests: active cell class present, crosshair classes on headers/row, movement on re-click

## Future Requirements

### Keyboard Navigation (Phase D — deferred)

- **KNAV-01**: Arrow-key cell navigation between active cells
- **KNAV-02**: Tab/Enter flow navigation within row/across rows
- **KNAV-03**: Functional fill handle (range-fill) on drag

## Out of Scope

| Feature | Reason |
|---------|--------|
| A/B/C column letters as primary headers | Anti-PAFV: SuperGrid columns are semantic LATCH facet projections, not positional indices |
| Toolbar IA split (Sheet vs Data controls) | Correct direction; defer to SuperFilter/SuperSearch context when toolbar has enough controls |
| Visual regression snapshot tests | Add after inline style migration settles; baseline instability during this pass |
| Classic optional column letters (secondary) | Low value given semantic headers; revisit if user research demands |
| Arrow-key cell navigation | Conflicts with lasso interaction model; requires focus management architecture |
| Tab/Enter flow navigation | Same dependency as arrow-key nav |
| Functional fill handle (range-fill) | No data model support for range-fill semantics |
| Row gutter interactivity (select-all, row highlight) | Visual-only in this pass; interactive gutter is Phase D |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CSSB-01 | Phase 58 | Complete |
| CSSB-02 | Phase 58 | Complete |
| CSSB-03 | Phase 58 | Complete |
| CSSB-04 | Phase 58 | Complete |
| CSSB-05 | Phase 58 | Complete |
| VFST-01 | Phase 59 | Complete |
| VFST-02 | Phase 59 | Complete |
| VFST-03 | Phase 59 | Pending |
| VFST-04 | Phase 59 | Complete |
| VFST-05 | Phase 59 | Pending |
| RGUT-01 | Phase 60 | Pending |
| RGUT-02 | Phase 60 | Pending |
| RGUT-03 | Phase 60 | Pending |
| RGUT-04 | Phase 60 | Pending |
| RGUT-05 | Phase 60 | Pending |
| ACEL-01 | Phase 61 | Pending |
| ACEL-02 | Phase 61 | Pending |
| ACEL-03 | Phase 61 | Pending |
| ACEL-04 | Phase 61 | Pending |
| ACEL-05 | Phase 61 | Pending |
| ACEL-06 | Phase 61 | Pending |

**Coverage:**
- v5.1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-08*
*Last updated: 2026-03-08 after initial definition*
