# Requirements: Isometry v8.1

**Defined:** 2026-03-21
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v1 Requirements

Requirements for v8.1 Plugin Registry Complete. Each maps to roadmap phases.

### Base Extraction

- [x] **BASE-01**: base.grid factory extracts core cell rendering from PivotGrid into PluginHook
- [x] **BASE-02**: base.headers factory extracts header span rendering into PluginHook
- [x] **BASE-03**: base.config factory extracts DnD config panel into PluginHook

### SuperStack Catalog Migration

- [x] **STKM-01**: superstack.collapse factory registered via registerCatalog() (migrate from HarnessShell closure)
- [x] **STKM-02**: superstack.aggregate factory registered via registerCatalog() (migrate from HarnessShell closure)

### SuperDensity

- [ ] **DENS-01**: superdensity.mode-switch factory toggles density levels (compact/normal/comfortable/spacious)
- [ ] **DENS-02**: superdensity.mini-cards factory renders compact card previews in cells at high density
- [ ] **DENS-03**: superdensity.count-badge factory shows card count badges on group intersections

### SuperSearch

- [ ] **SRCH-01**: supersearch.input factory adds search input field with debounced filtering
- [ ] **SRCH-02**: supersearch.highlight factory marks matching cells/text in grid

### SuperSelect

- [ ] **SLCT-01**: superselect.click factory enables single-cell and Cmd+click multi-select
- [ ] **SLCT-02**: superselect.lasso factory enables drag-to-select rectangular region
- [ ] **SLCT-03**: superselect.keyboard factory enables Shift+arrow range selection

### SuperAudit

- [ ] **AUDT-01**: superaudit.overlay factory renders change tracking CSS overlay (new/modified/deleted)
- [ ] **AUDT-02**: superaudit.source factory color-codes cells by import source provenance

## v2 Requirements

### Data Source Progression

- **DATA-01**: Alto Index JSON data source adapter for HarnessShell
- **DATA-02**: Full sql.js data source adapter wiring PivotGrid to existing Worker Bridge

## Out of Scope

| Feature | Reason |
|---------|--------|
| Production integration of pivot grid into main app | v8.x is harness-only development |
| Replacing existing SuperGrid views | Pivot grid is parallel development track |
| New plugin categories beyond FeatureCatalog 27 | Complete existing catalog first |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BASE-01 | Phase 101 | Complete |
| BASE-02 | Phase 101 | Complete |
| BASE-03 | Phase 101 | Complete |
| STKM-01 | Phase 101 | Complete |
| STKM-02 | Phase 101 | Complete |
| DENS-01 | Phase 102 | Pending |
| DENS-02 | Phase 102 | Pending |
| DENS-03 | Phase 102 | Pending |
| SRCH-01 | Phase 102 | Pending |
| SRCH-02 | Phase 102 | Pending |
| SLCT-01 | Phase 102 | Pending |
| SLCT-02 | Phase 102 | Pending |
| SLCT-03 | Phase 102 | Pending |
| AUDT-01 | Phase 102 | Pending |
| AUDT-02 | Phase 102 | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after roadmap creation — all 15 requirements mapped*
