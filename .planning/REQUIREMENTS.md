# Requirements: Isometry v9.3 View Wiring Fixes

**Defined:** 2026-03-26
**Core Value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization — sql.js queries directly feed D3.js data joins.

## v9.3 Requirements

Fix broken view rendering across all 9 views, with urgent priority on SuperGrid, Timeline, and NetworkView showing no cards/nodes. Broader UI/UX pass across remaining views.

### SuperGrid

- [x] **SGRD-01**: PivotGrid renders cell data from sql.js via BridgeDataAdapter — cells show counts, headers show axis labels
- [x] **SGRD-02**: SuperGrid shows informative empty state when no axes configured or no data matches
- [x] **SGRD-03**: CalcExplorer footer aggregate rows (SUM/AVG/COUNT/MIN/MAX) render correctly below data cells

### Timeline

- [ ] **TMLN-01**: TimelineView renders cards with `due_at` dates on SVG timeline with correct temporal positioning
- [ ] **TMLN-02**: TimelineView shows contextual empty feedback when all cards lack `due_at` (not just when DB query returns zero)
- [ ] **TMLN-03**: Swimlane grouping by status/field works correctly with sub-row overlap handling

### Network / Graph

- [ ] **NETW-01**: NetworkView renders card nodes with connection edges and stable force-directed layout
- [ ] **NETW-02**: Graph algorithm overlays work (community colors, centrality sizing, path/MST edge highlighting)
- [ ] **NETW-03**: AlgorithmExplorer controls render and function (radio group, Run button, parameter sliders)
- [ ] **NETW-04**: Source/target picker and legend panel display correctly

### Other Views

- [ ] **VIEW-01**: ListView renders cards in list layout
- [ ] **VIEW-02**: GridView renders cards in grid layout
- [ ] **VIEW-03**: KanbanView renders cards in column lanes with drag-drop
- [ ] **VIEW-04**: CalendarView renders cards on calendar dates
- [ ] **VIEW-05**: GalleryView renders card tiles
- [ ] **VIEW-06**: TreeView renders hierarchical card layout with expand/collapse

### Cross-View UX

- [ ] **CVUX-01**: View switching via SidebarNav, Cmd+1-9, and command palette works for all 9 views
- [ ] **CVUX-02**: Empty states display correctly for each view type when no cards match current filters

## Future Requirements

### View Enhancements

- **VENH-01**: View-specific performance optimization (lazy rendering, virtualization)
- **VENH-02**: View-specific keyboard shortcuts and accessibility refinements
- **VENH-03**: Cross-view selection persistence (Tier 3 only per D-005)

## Out of Scope

| Feature | Reason |
|---------|--------|
| New view types | Existing 9 views cover all LATCH/GRAPH projection needs |
| In-grid cell editing | Cards have rich content; double-click opens card detail view |
| Virtual scrolling rework | v4.1 SuperGridVirtualizer + content-visibility sufficient |
| View-specific themes | v7.0 theme system applies uniformly across all views |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SGRD-01 | Phase 127 | Complete |
| SGRD-02 | Phase 127 | Complete |
| SGRD-03 | Phase 127 | Complete |
| TMLN-01 | Phase 128 | Pending |
| TMLN-02 | Phase 128 | Pending |
| TMLN-03 | Phase 128 | Pending |
| NETW-01 | Phase 128 | Pending |
| NETW-02 | Phase 128 | Pending |
| NETW-03 | Phase 128 | Pending |
| NETW-04 | Phase 128 | Pending |
| VIEW-01 | Phase 129 | Pending |
| VIEW-02 | Phase 129 | Pending |
| VIEW-03 | Phase 129 | Pending |
| VIEW-04 | Phase 129 | Pending |
| VIEW-05 | Phase 129 | Pending |
| VIEW-06 | Phase 129 | Pending |
| CVUX-01 | Phase 129 | Pending |
| CVUX-02 | Phase 129 | Pending |

**Coverage:**
- v9.3 requirements: 18 total
- Satisfied: 0
- Pending: 18
- Mapped to phases: 18
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 — phase assignments added (Phases 127-129)*
