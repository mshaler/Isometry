# Requirements: Isometry v14.0

**Defined:** 2026-04-22
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v14.0 Requirements

Requirements for Horizontal Ribbon Navigation milestone.

### Dock Wiring

- [ ] **WIRE-01**: User can click Data Explorer icon and the explorer panel toggles visible/hidden in sidecar
- [ ] **WIRE-02**: User can click Filter icon and the LATCH filters panel toggles in sidecar
- [ ] **WIRE-03**: User can click Formulas icon and the formulas panel toggles in sidecar
- [ ] **WIRE-04**: User can click any Visualize icon (SuperGrid, Timeline, Maps, Charts, Graphs) and the view switches
- [ ] **WIRE-05**: User can click Settings icon and settings/command palette opens
- [ ] **WIRE-06**: Active state visually highlights the currently selected dock item

### Horizontal Ribbon

- [ ] **HRIB-01**: Navigation ribbon renders as a horizontal bar below the tab strip
- [ ] **HRIB-02**: Verb-noun sections (Integrate/Visualize/Analyze/Activate/Help) flow left-to-right separated by vertical dividers
- [ ] **HRIB-03**: Each item shows Lucide icon + text label horizontally
- [ ] **HRIB-04**: SuperWidget CSS grid removes sidebar column; ribbon occupies a new row between tabs and canvas
- [ ] **HRIB-05**: Canvas area spans full viewport width (no 48px sidebar)
- [ ] **HRIB-06**: Keyboard navigation works horizontally (ArrowLeft/Right instead of Up/Down)
- [ ] **HRIB-07**: Active item uses accent color highlight (same visual as current dock)

### Stories Stub

- [ ] **STOR-01**: Stories ribbon row renders below the navigation ribbon
- [ ] **STOR-02**: Stories ribbon contains 3-4 placeholder Lucide icons with labels (e.g., "New Story", "Play", "Share")
- [ ] **STOR-03**: All Stories items are visually disabled (greyed out, cursor: not-allowed, no click handler)

### Datasets Stub

- [ ] **DSET-01**: Datasets ribbon row renders below the Stories ribbon
- [ ] **DSET-02**: Datasets ribbon contains 3-4 placeholder Lucide icons with labels (e.g., "Import", "Export", "Browse")
- [ ] **DSET-03**: All Datasets items are visually disabled (greyed out, cursor: not-allowed, no click handler)

## Future Requirements

Deferred to later milestones.

### Stories (Functional)

- **STOR-F01**: User can create a named story (saved sequence of view states)
- **STOR-F02**: User can play a story as a slideshow
- **STOR-F03**: User can share/export a story

### Datasets (Functional)

- **DSET-F01**: Datasets ribbon shows imported dataset chips from catalog registry
- **DSET-F02**: User can click a dataset chip to switch active dataset
- **DSET-F03**: Dataset chips show card count badges
- **DSET-F04**: User can import/export from Datasets ribbon

## Out of Scope

| Feature | Reason |
|---------|--------|
| Ribbon collapse/minimize | Complexity for stub milestone; defer to UX polish |
| Ribbon customization (drag-reorder sections) | No user need yet |
| Ribbon right-click context menus | Stub ribbons have no actions |
| Minimap thumbnails in horizontal ribbon | Layout doesn't support thumbnails; minimap deferred |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WIRE-01 | — | Pending |
| WIRE-02 | — | Pending |
| WIRE-03 | — | Pending |
| WIRE-04 | — | Pending |
| WIRE-05 | — | Pending |
| WIRE-06 | — | Pending |
| HRIB-01 | — | Pending |
| HRIB-02 | — | Pending |
| HRIB-03 | — | Pending |
| HRIB-04 | — | Pending |
| HRIB-05 | — | Pending |
| HRIB-06 | — | Pending |
| HRIB-07 | — | Pending |
| STOR-01 | — | Pending |
| STOR-02 | — | Pending |
| STOR-03 | — | Pending |
| DSET-01 | — | Pending |
| DSET-02 | — | Pending |
| DSET-03 | — | Pending |

**Coverage:**
- v14.0 requirements: 19 total
- Mapped to phases: 0
- Unmapped: 19 ⚠️

---
*Requirements defined: 2026-04-22*
*Last updated: 2026-04-22 after initial definition*
