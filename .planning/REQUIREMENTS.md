# Requirements: Isometry v10.0 Smart Defaults + Layout Presets

**Defined:** 2026-03-27
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v10.0 Requirements

Smart default view configurations for all 20 dataset types, named explorer layout presets for workflow-based panel arrangements, and an in-app guided tour with per-dataset annotations. Progressive approach: SuperGrid defaults first, then other views, then layout presets, then tour.

### Foundation

- [x] **FNDX-01**: Per-dataset ui_state key namespacing (`pafv:{datasetId}:rowAxes`) with migration from flat keys
- [x] **FNDX-02**: ViewManager `isSwitching` guard prevents provider notifications during view transitions
- [x] **FNDX-03**: `preset:` key namespace reserved in ui_state conventions with collision prevention

### Default SuperGrid Configurations

- [x] **SGDF-01**: ViewDefaultsRegistry maps all 20 source types to SuperGrid axis/sort/density/calc defaults
- [x] **SGDF-02**: Every default axis assignment validated through SchemaProvider.isValidColumn() before apply
- [x] **SGDF-03**: Graceful fallback when expected columns missing — renders best available instead of empty
- [x] **SGDF-04**: Per-dataset override layer in ui_state allows user customization above source-type defaults
- [x] **SGDF-05**: "Reset to defaults" action restores source-type defaults, clearing per-dataset overrides
- [x] **SGDF-06**: Defaults applied on first import only — flag-gated by `view:defaults:applied:{datasetId}`

### Other View Defaults

- [x] **OVDF-01**: ViewDefaultsRegistry extended with best-view-per-dataset-type for Timeline, Network, Kanban, Tree where meaningful
- [x] **OVDF-02**: View-specific axis/sort/filter defaults for non-SuperGrid views per dataset type
- [x] **OVDF-03**: Recommendation badges (✦) in SidebarNav view switcher indicating best views for current dataset
- [x] **OVDF-04**: Auto-switch to recommended view on first import of a dataset type

### Named Layout Presets

- [ ] **PRST-01**: 4 built-in layout presets (Data Integration, Writing, LATCH Analytics, GRAPH Synthetics) with panel visibility/collapse/order
- [ ] **PRST-02**: User can save current explorer layout as a named custom preset
- [ ] **PRST-03**: Preset switching via command palette category and dedicated UI picker
- [ ] **PRST-04**: Key-based dict serialization (`Record<storageKey, boolean>`) for forward/backward compatibility
- [ ] **PRST-05**: Preset apply registered as undoable mutation via MutationManager
- [ ] **PRST-06**: Auto-suggest preset when switching datasets based on dataset-to-preset association

### Guided Tour

- [ ] **TOUR-01**: driver.js integrated with selector-based step anchoring via `data-tour-target` attributes
- [ ] **TOUR-02**: Per-dataset-type tour variants with dataset-aware annotations (e.g., "Your contacts are grouped by company")
- [ ] **TOUR-03**: Tour survives view switches — re-queries selectors after ViewManager.switchTo() completes
- [ ] **TOUR-04**: Tour completion state persisted to ui_state (`tour:completed:{tourId}`)
- [ ] **TOUR-05**: Tour re-triggerable from command palette and help menu
- [ ] **TOUR-06**: Opt-in launch — tooltip prompt after first import, never auto-forced

### UAT

- [ ] **UATX-01**: Manual UAT pass through each default view × dataset type with fix iterations
- [ ] **UATX-02**: Preset switching UAT across all 4 built-in presets verifying panel states restore correctly

## Future Requirements

### Layout Enhancements

- **LYOT-01**: Full VS Code-style drag-and-drop panel rearrangement (dock left/right/bottom, split, float)
- **LYOT-02**: Panel resize with persistent proportions
- **LYOT-03**: Layout export/import as JSON for sharing configurations

### Tour Enhancements

- **TRNH-01**: Interactive tour steps (e.g., "try dragging an axis to the Projection panel")
- **TRNH-02**: Tour analytics (completion rate, drop-off step)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full drag-and-drop panel rearrangement | Named presets first, then DnD in future milestone |
| CloudKit sync for presets | Local-first scope; JSON export/import is the safety valve |
| Tour auto-launch on every app start | Anti-pattern per research — opt-in only |
| Full-screen spotlight overlay tour | Lower completion rates than tooltip-based approach |
| Per-view-type presets (separate from explorer layout) | Explorer layout presets capture view state implicitly |
| Custom tour authoring UI | Built-in tours sufficient for v10.0 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FNDX-01 | Phase 130 | Complete |
| FNDX-02 | Phase 130 | Complete |
| FNDX-03 | Phase 130 | Complete |
| SGDF-01 | Phase 131 | Complete |
| SGDF-02 | Phase 131 | Complete |
| SGDF-03 | Phase 131 | Complete |
| SGDF-04 | Phase 131 | Complete |
| SGDF-05 | Phase 131 | Complete |
| SGDF-06 | Phase 131 | Complete |
| OVDF-01 | Phase 132 | Complete |
| OVDF-02 | Phase 132 | Complete |
| OVDF-03 | Phase 132 | Complete |
| OVDF-04 | Phase 132 | Complete |
| PRST-01 | Phase 133 | Pending |
| PRST-02 | Phase 133 | Pending |
| PRST-03 | Phase 133 | Pending |
| PRST-04 | Phase 133 | Pending |
| PRST-05 | Phase 133 | Pending |
| PRST-06 | Phase 133 | Pending |
| TOUR-01 | Phase 134 | Pending |
| TOUR-02 | Phase 134 | Pending |
| TOUR-03 | Phase 134 | Pending |
| TOUR-04 | Phase 134 | Pending |
| TOUR-05 | Phase 134 | Pending |
| TOUR-06 | Phase 134 | Pending |
| UATX-01 | Phase 135 | Pending |
| UATX-02 | Phase 135 | Pending |

**Coverage:**
- v10.0 requirements: 27 total
- Satisfied: 0
- Pending: 27
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-27*
*Last updated: 2026-03-27 — traceability mapped to phases 130-135*
