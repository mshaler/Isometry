# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline.

## v4.4 Requirements — SuperGrid PAFV Projection

Wire SuperGrid to consume PAFV axis mappings for 2D card positioning with dynamic headers and smooth transitions.

### Projection Core (Shipped v4.4)

- [x] **PROJ-01**: SuperGrid reads current axis mappings from PAFVContext and uses them to determine grid layout — v4.4
- [x] **PROJ-02**: X-axis mapping determines column headers — unique facet values become columns — v4.4
- [x] **PROJ-03**: Y-axis mapping determines row headers — unique facet values become rows — v4.4
- [x] **PROJ-04**: Cards position at the intersection of their X and Y facet values (same X+Y → same cell) — v4.4
- [x] **PROJ-05**: Cards with null/undefined facet values appear in an "Unassigned" bucket row or column — v4.4

### Header Generation (Shipped v4.4)

- [x] **HDR-01**: Column headers are dynamically generated from unique X-axis facet values in the dataset — v4.4
- [x] **HDR-02**: Row headers are dynamically generated from unique Y-axis facet values in the dataset — v4.4
- [x] **HDR-03**: Headers respect facet type formatting (dates formatted, categories labeled) — v4.4

### Stacked/Nested Headers (Shipped v4.5)

- [x] **STACK-01**: Multi-level header hierarchy renders when multiple facets assigned to same plane (stacked axes) — v4.5
- [x] **STACK-02**: Parent header cells visually span across their child headers (Excel pivot table style) — v4.5
- [x] **STACK-03**: Header clicks allow sorting by that level of the hierarchy — v4.5

## v4.6 Requirements — SuperGrid Polish

Complete SuperGrid projection system with animated view transitions and sparse/dense cell filtering.

### View Transitions

- [ ] **TRANS-01**: Changing axis mapping triggers animated card repositioning (300ms D3 transitions)
- [ ] **TRANS-02**: Header elements animate when plane assignment changes
- [ ] **TRANS-03**: Selection state is preserved during view transitions (selected cards stay selected)

### Density Filtering

- [ ] **DENS-01**: Sparse mode (DensityLevel 1) renders full Cartesian grid including empty cells
- [ ] **DENS-02**: Dense mode (DensityLevel 2) hides empty cells, shows only populated intersections
- [ ] **DENS-03**: Janus pan control triggers sparse/dense filtering in GridRenderingEngine

## Validated Requirements (Shipped)

### v5.0 Type Safety Restoration (shipped 2026-02-10)

- [x] **TSFIX-01 through TSFIX-12**: All 1,347 TypeScript compilation errors eliminated — v5.0

### v4.2 Three-Canvas Notebook (shipped 2026-02-10)

- [x] **SHELL-01 through SHELL-06**: Shell integration complete — v4.2
- [x] **PREV-01 through PREV-07**: Preview visualization complete — v4.2
- [x] **EDIT-01 through EDIT-04**: TipTap editor migration complete — v4.2
- [x] **SYNC-01 through SYNC-03**: Live data synchronization complete — v4.2

### v4.3 Navigator Integration (shipped 2026-02-10)

- [x] **FOUND-01 through FOUND-05**: Property classification foundation complete — v4.3
- [x] **NAV-01 through NAV-05**: Navigator UI integration complete — v4.3

## Future Requirements

Deferred to future releases. Tracked but not in current roadmap.

### Shell AI Integration

- **SHAI-01**: User can chat with Claude AI in dedicated Shell tab
- **SHAI-02**: User sees streaming responses with typing indicator
- **SHAI-03**: User benefits from rate limit queue preventing API errors
- **SHAI-04**: User can use MCP tools for enhanced context

### Advanced Editor

- **AEDT-01**: User can embed D3 visualizations inline in editor
- **AEDT-02**: User can see version history per block
- **AEDT-03**: User can use formula bar with PAFV-aware functions

### Advanced Projection

- **APROJ-01**: Color plane projection (cards colored by facet value)
- **APROJ-02**: Size plane projection (cards sized by facet value)
- **APROJ-03**: GRAPH bucket axis support (position by graph metrics)
- **APROJ-04**: SuperStack nested headers (multi-level hierarchy)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Color/Size/Shape plane projections | Shipped in Phase 57-03 |
| GRAPH bucket axis support | Needs research on how to position by graph metrics |
| SuperDensity Janus controls integration | Shipped in Phase 57-01 |
| Real-time collaboration | Single-user local-first app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | Phase 56 | Complete |
| PROJ-02 | Phase 56 | Complete |
| PROJ-03 | Phase 56 | Complete |
| PROJ-04 | Phase 56 | Complete |
| PROJ-05 | Phase 56 | Complete |
| HDR-01 | Phase 57 | Complete |
| HDR-02 | Phase 57 | Complete |
| HDR-03 | Phase 57 | Complete |
| STACK-01 | Phase 60 | Complete |
| STACK-02 | Phase 60 | Complete |
| STACK-03 | Phase 60 | Complete |
| TRANS-01 | Phase 61 | Pending |
| TRANS-02 | Phase 61 | Pending |
| TRANS-03 | Phase 61 | Pending |
| DENS-01 | Phase 62 | Pending |
| DENS-02 | Phase 62 | Pending |
| DENS-03 | Phase 62 | Pending |

**Coverage:**
- v4.4/v4.5 shipped: 11 requirements
- v4.6 requirements: 6 total
- Mapped to phases: 6/6 (100% coverage)

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-12 (v4.6 roadmap created - Phases 61-62 mapped)*
