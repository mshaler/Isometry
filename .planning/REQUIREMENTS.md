# Requirements: Isometry v13.0 SuperWidget Substrate

**Defined:** 2026-04-21
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v13.0 Requirements

Requirements for SuperWidget substrate milestone. Each maps to roadmap phases.

### Substrate Layout

- [x] **SLAT-01**: SuperWidget renders four named slots (header, canvas, status, tabs) as CSS Grid layout with `data-slot` attributes
- [x] **SLAT-02**: Config gear renders as child of tabs slot with `data-tab-role="config"` and `margin-left: auto` positioning (flex container)
- [x] **SLAT-03**: Status slot is always present in DOM with zero-height when empty (min-height: 0, not display: none)
- [x] **SLAT-04**: Tab bar supports horizontal scroll with CSS `mask-image` edge fade when tabs overflow
- [x] **SLAT-05**: SuperWidget follows mount(container)/destroy() lifecycle matching existing component convention
- [x] **SLAT-06**: CSS uses `--sw-*` namespace for all SuperWidget custom properties, bundled via import (no `<link>` tags)
- [x] **SLAT-07**: SuperWidget root element has `flex: 1 1 auto; min-height: 0` to prevent CSS Grid height collapse in flex chain

### Projection State Machine

- [x] **PROJ-01**: Projection type defines canvasType, canvasBinding, zoneRole, canvasId, activeTabId, enabledTabIds
- [x] **PROJ-02**: `switchTab` returns original reference on invalid tabId (reference equality contract)
- [x] **PROJ-03**: `setCanvas` transitions projection to new canvasId and canvasType
- [x] **PROJ-04**: `setBinding` rejects Bound on non-View canvas types (returns original reference)
- [x] **PROJ-05**: `toggleTabEnabled` returns original reference when state would not change
- [ ] **PROJ-06**: `validateProjection` returns `{valid, reason?}` and never throws; catches invalid activeTabId, Bound on non-View, empty canvasId, empty enabledTabIds
- [ ] **PROJ-07**: All transition functions are pure (same input produces same output, no side effects)

### Projection Rendering

- [ ] **RNDR-01**: SuperWidget accepts a Projection and renders the correct canvas content
- [ ] **RNDR-02**: `commitProjection` validates before rendering; rejects invalid projections with console warning and no DOM change
- [ ] **RNDR-03**: Tab switch re-renders canvas slot only — header, status, and tabs slots remain stable (slot-scoped re-render)
- [ ] **RNDR-04**: Canvas type switch calls destroy() on prior canvas before mount() on new canvas, resetting data-render-count to 1
- [ ] **RNDR-05**: Header slot displays zone theme label via lookup from `projection.zoneRole` (self-contained, no parent dependency)

### Canvas Stubs + Registry

- [ ] **CANV-01**: ExplorerCanvasStub renders with `data-canvas-type="Explorer"`, canvasId text, and data-render-count
- [ ] **CANV-02**: ViewCanvasStub renders with `data-canvas-type="View"` and supports Bound mode with `data-sidecar` child element
- [ ] **CANV-03**: EditorCanvasStub renders with `data-canvas-type="Editor"`, Unbound only
- [ ] **CANV-04**: Canvas registry maps canvasId to CanvasRegistryEntry with typed CanvasComponent interface
- [ ] **CANV-05**: View registry entries include `defaultExplorerId` field declaring bound Explorer pairing
- [ ] **CANV-06**: SuperWidget.ts references only CanvasComponent interface — zero references to concrete stub classes
- [ ] **CANV-07**: Stubs are labeled in filename and top-of-file comment as stubs for replacement in v13.1+

### Integration Testing

- [ ] **INTG-01**: Cross-seam test covers Explorer→View/Bound transition with sidecar appearance and zone theme update
- [ ] **INTG-02**: Cross-seam test covers View/Bound→Unbound transition with sidecar disappearance
- [ ] **INTG-03**: Cross-seam test covers View→Editor transition with zone theme update
- [ ] **INTG-04**: Cross-seam test verifies invalid projection (Bound on Editor) produces no DOM change and logs warning
- [ ] **INTG-05**: Cross-seam test verifies switchTab to disabled tabId preserves original projection reference
- [ ] **INTG-06**: Cross-seam test verifies rapid commit of 10 projections results in final state only (no intermediate leak)
- [ ] **INTG-07**: Playwright WebKit smoke test passes for the integration matrix in CI

## Future Requirements

Deferred to subsequent v13.x milestones. Tracked but not in current roadmap.

### v13.1 Data Explorer Canvas
- **DEXP-01**: Real Data Explorer Canvas replaces ExplorerCanvasStub
- **DEXP-02**: Status slot populated with ingestion counts (first tenant)

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
| Real Canvas implementations | Stubs only — real Explorers/Views/Editors land in v13.1+ |
| Zone layout shell | Requires multiple SuperWidget instances; own milestone (v13.5) |
| Widget composition | Two-level bound recursion semantics; own milestone (v13.4) |
| ViewZipper | Requires real View Canvas to be meaningful (v13.2) |
| Story serialization | Projection persistence deferred to v13.6 |
| Animated transitions | Future polish milestone |
| Keyboard tab navigation | Full ARIA audit deferred until real content exists |
| Performance benchmarks | SuperWidget perf lands after real Canvases (v6.0 precedent) |
| Accessibility audit | Needs real content to audit meaningfully |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLAT-01 | Phase 162 | Complete |
| SLAT-02 | Phase 162 | Complete |
| SLAT-03 | Phase 162 | Complete |
| SLAT-04 | Phase 162 | Complete |
| SLAT-05 | Phase 162 | Complete |
| SLAT-06 | Phase 162 | Complete |
| SLAT-07 | Phase 162 | Complete |
| PROJ-01 | Phase 163 | Complete |
| PROJ-02 | Phase 163 | Complete |
| PROJ-03 | Phase 163 | Complete |
| PROJ-04 | Phase 163 | Complete |
| PROJ-05 | Phase 163 | Complete |
| PROJ-06 | Phase 163 | Pending |
| PROJ-07 | Phase 163 | Pending |
| RNDR-01 | Phase 164 | Pending |
| RNDR-02 | Phase 164 | Pending |
| RNDR-03 | Phase 164 | Pending |
| RNDR-04 | Phase 164 | Pending |
| RNDR-05 | Phase 164 | Pending |
| CANV-01 | Phase 165 | Pending |
| CANV-02 | Phase 165 | Pending |
| CANV-03 | Phase 165 | Pending |
| CANV-04 | Phase 165 | Pending |
| CANV-05 | Phase 165 | Pending |
| CANV-06 | Phase 165 | Pending |
| CANV-07 | Phase 165 | Pending |
| INTG-01 | Phase 166 | Pending |
| INTG-02 | Phase 166 | Pending |
| INTG-03 | Phase 166 | Pending |
| INTG-04 | Phase 166 | Pending |
| INTG-05 | Phase 166 | Pending |
| INTG-06 | Phase 166 | Pending |
| INTG-07 | Phase 166 | Pending |

**Coverage:**
- v13.0 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-21*
*Last updated: 2026-04-21 — traceability table populated after roadmap creation*
