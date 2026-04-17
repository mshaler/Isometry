# Requirements: Isometry v12.0 Explorer Panel Polish

**Defined:** 2026-04-17
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v12.0 Requirements

Requirements for Explorer Panel Polish milestone. Each maps to roadmap phases.

### Visual Consistency

- [ ] **VCSS-01**: All explorer CSS selectors scoped to component namespace (`.algo-explorer__*`, `.visual-explorer__*`) with zero cross-component class collisions
- [ ] **VCSS-02**: All 8 explorers use `--space-*`, `--text-*`, `--border-*`, `--bg-*` design tokens exclusively — zero hardcoded px/color values in explorer CSS
- [ ] **VCSS-03**: AlgorithmExplorer CSS migrated from `.nv-*` to `.algo-explorer__*` namespace
- [ ] **VCSS-04**: VisualExplorer CSS migrated from `.dim-btn`/`.dim-switcher` to `.visual-explorer__*` namespace
- [ ] **VCSS-05**: Clear visual boundaries between DockNav strip, top-slot explorers, view content, and bottom-slot explorers (border/spacing/background differentiation)
- [ ] **VCSS-06**: Consistent typography scale across all explorer headers, labels, and content (unified hierarchy)

### Behavioral Cleanup

- [ ] **BEHV-01**: PanelManager class extracted from main.ts owning all explorer show/hide/toggle orchestration
- [ ] **BEHV-02**: PanelManager wired to existing PanelRegistry infrastructure for lifecycle management
- [ ] **BEHV-03**: Explorer toggle spaghetti removed from main.ts (~300 LOC reduction)
- [ ] **BEHV-04**: Unified persistence pattern: bridge `ui:set` for durable state, transient for ephemeral — documented and consistent across all 8 explorers
- [ ] **BEHV-05**: PropertiesExplorer triple-persistence reduced to single canonical pattern
- [ ] **BEHV-06**: AlgorithmExplorer wired to SchemaProvider for dynamic numeric field detection (replaces NUMERIC_FIELDS_FALLBACK)
- [ ] **BEHV-07**: CalcExplorer wired to SchemaProvider for dynamic field detection (replaces hardcoded field sets)

### Explorer Content Polish

- [ ] **EXPX-01**: LatchExplorers chips render `aria-selected` attribute reflecting filter state
- [ ] **EXPX-02**: ProjectionExplorer wells have accessible labels (aria-label on drop zones)
- [ ] **EXPX-03**: CalcExplorer column dropdowns have accessible labels
- [ ] **EXPX-04**: DataExplorer Catalog section displays dataset list with source type, card count, and import date
- [ ] **EXPX-05**: DataExplorer Catalog supports re-import action per dataset
- [ ] **EXPX-06**: DataExplorer Catalog supports delete-by-dataset with confirmation dialog
- [ ] **EXPX-07**: DataExplorer Catalog shows active dataset row highlighting
- [ ] **EXPX-08**: CalcExplorer shows visual feedback for active aggregations (glyph or highlight on active columns)
- [ ] **EXPX-09**: CalcExplorer shows column type indicators (numeric vs text)
- [ ] **EXPX-10**: Event delegation pattern applied to explorers with dynamic content (LatchExplorers chips, PropertiesExplorer toggles)

## Future Requirements

### Deferred

- **EXPX-F01**: Explorer drag-to-reorder panel ordering (PanelRegistry supports it, UI not wired)
- **EXPX-F02**: LatchExplorers chip sorting UI (by count, alphabetical)
- **EXPX-F03**: NotebookExplorer formatting toolbar accessibility audit

## Out of Scope

| Feature | Reason |
|---------|--------|
| New explorer panels (Maps, Stories, InterfaceBuilder) | Stubs exist; full implementation is a separate milestone |
| Explorer panel resize handles | Panel layout is fixed flex; drag resize adds complexity without clear value |
| Cross-device explorer state sync | Device-local by design (D-005) |
| Explorer theming beyond design tokens | Existing 5-theme system covers this via CSS custom properties |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| VCSS-01 | TBD | Pending |
| VCSS-02 | TBD | Pending |
| VCSS-03 | TBD | Pending |
| VCSS-04 | TBD | Pending |
| VCSS-05 | TBD | Pending |
| VCSS-06 | TBD | Pending |
| BEHV-01 | TBD | Pending |
| BEHV-02 | TBD | Pending |
| BEHV-03 | TBD | Pending |
| BEHV-04 | TBD | Pending |
| BEHV-05 | TBD | Pending |
| BEHV-06 | TBD | Pending |
| BEHV-07 | TBD | Pending |
| EXPX-01 | TBD | Pending |
| EXPX-02 | TBD | Pending |
| EXPX-03 | TBD | Pending |
| EXPX-04 | TBD | Pending |
| EXPX-05 | TBD | Pending |
| EXPX-06 | TBD | Pending |
| EXPX-07 | TBD | Pending |
| EXPX-08 | TBD | Pending |
| EXPX-09 | TBD | Pending |
| EXPX-10 | TBD | Pending |

**Coverage:**
- v12.0 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-04-17*
*Last updated: 2026-04-17 after initial definition*
