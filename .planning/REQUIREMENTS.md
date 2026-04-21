# Requirements: Isometry v13.1 Data Explorer Canvas

**Defined:** 2026-04-21
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v13.1 Requirements

Requirements for Data Explorer Canvas milestone. Each maps to roadmap phases.

### Explorer Canvas

- [x] **EXCV-01**: ExplorerCanvas implements CanvasComponent (mount/destroy) and replaces ExplorerCanvasStub in the canvas registry
- [x] **EXCV-02**: ExplorerCanvas renders three tab sections (Import/Export, Catalog, DB Utilities) mapped to existing DataExplorerPanel content
- [x] **EXCV-03**: Tab switching updates the canvas slot content via commitProjection's activeTabId — no full canvas destroy/remount
- [x] **EXCV-04**: ExplorerCanvas mount re-uses existing DataExplorerPanel section DOM builders without rewriting business logic
- [x] **EXCV-05**: SuperWidget.ts maintains zero references to ExplorerCanvas class (CANV-06 contract preserved)

### Status Slot

- [x] **STAT-01**: Status slot displays live card count from sql.js (updated on import/delete/mutation)
- [x] **STAT-02**: Status slot displays live connection count from sql.js
- [x] **STAT-03**: Status slot displays last import timestamp from import_runs catalog table
- [x] **STAT-04**: Status slot content updates without re-rendering the canvas or tab content (slot-scoped update)

### Integration Testing

- [x] **EINT-01**: Cross-seam test verifies ExplorerCanvas mount produces real DataExplorerPanel content (not stub placeholder)
- [x] **EINT-02**: Cross-seam test verifies tab switching between Import/Export, Catalog, and DB Utilities tabs
- [x] **EINT-03**: Cross-seam test verifies status slot ingestion counts update after a simulated import
- [ ] **EINT-04**: Playwright WebKit smoke test updated to exercise ExplorerCanvas with tab switching

## Future Requirements

Deferred to subsequent v13.x milestones. Tracked but not in current roadmap.

### v13.2 SuperGrid View Canvas
- **SGVC-01**: Real SuperGrid View Canvas replaces ViewCanvasStub
- **SGVC-02**: ViewZipper integrated with View Canvas

### v13.3 Card Editor Canvas
- **CEDC-01**: Real Card Editor Canvas replaces EditorCanvasStub

### v13.4+ Later
- **COMP-01**: Widget composition (widgets-within-widgets)
- **ZONE-01**: Zone layout shell (Workbench outer container)
- **STOR-01**: Story serialization (layouts as persisted nodes)
- **ANIM-01**: Animated transitions between projections
- **KBNV-01**: Keyboard navigation between tabs
- **SYNC-01**: CloudKit sync of workbench layouts

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| View/Editor Canvas implementations | Stubs remain — real implementations land in v13.2/v13.3 |
| New DataExplorerPanel features | Re-mount existing content only; new features are separate milestones |
| Import progress in status slot | Ingestion counts only; progress bar deferred |
| Zone layout shell | Requires multiple SuperWidget instances; own milestone (v13.5) |
| Tab persistence across sessions | Tab state is ephemeral (Projection is session-only); persistence deferred |
| Status slot animation | Live counts update instantly; animation is polish for later |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EXCV-01 | Phase 167 | Complete |
| EXCV-02 | Phase 168 | Complete |
| EXCV-03 | Phase 168 | Complete |
| EXCV-04 | Phase 167 | Complete |
| EXCV-05 | Phase 167 | Complete |
| STAT-01 | Phase 169 | Complete |
| STAT-02 | Phase 169 | Complete |
| STAT-03 | Phase 169 | Complete |
| STAT-04 | Phase 169 | Complete |
| EINT-01 | Phase 170 | Complete |
| EINT-02 | Phase 170 | Complete |
| EINT-03 | Phase 170 | Complete |
| EINT-04 | Phase 170 | Pending |

**Coverage:**
- v13.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0

---
*Requirements defined: 2026-04-21*
