# Requirements: Isometry

**Defined:** 2026-02-10
**Core Value:** Polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as grid, kanban, network, or timeline.

## v4.4 Requirements — SuperGrid PAFV Projection

Wire SuperGrid to consume PAFV axis mappings for 2D card positioning with dynamic headers and smooth transitions.

### Projection Core

- [ ] **PROJ-01**: SuperGrid reads current axis mappings from PAFVContext and uses them to determine grid layout
- [ ] **PROJ-02**: X-axis mapping determines column headers — unique facet values become columns
- [ ] **PROJ-03**: Y-axis mapping determines row headers — unique facet values become rows
- [ ] **PROJ-04**: Cards position at the intersection of their X and Y facet values (same X+Y → same cell)
- [ ] **PROJ-05**: Cards with null/undefined facet values appear in an "Unassigned" bucket row or column

### Header Generation

- [ ] **HDR-01**: Column headers are dynamically generated from unique X-axis facet values in the dataset
- [ ] **HDR-02**: Row headers are dynamically generated from unique Y-axis facet values in the dataset
- [ ] **HDR-03**: Headers respect facet type formatting (dates formatted, categories labeled)

### Transitions

- [ ] **TRANS-01**: Changing axis mapping triggers animated card repositioning (D3 transitions)
- [ ] **TRANS-02**: New cells animate in (enter), removed cells animate out (exit) during transitions
- [ ] **TRANS-03**: Empty cells toggle between sparse mode (full Cartesian) and dense mode (populated only)

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
| Color/Size/Shape plane projections | Future phase — focus on X/Y positioning first |
| GRAPH bucket axis support | Needs research on how to position by graph metrics |
| SuperStack nested headers | Separate feature, not needed for basic PAFV projection |
| SuperDensity Janus controls integration | Already implemented, just needs wiring (not new feature) |
| Real-time collaboration | Single-user local-first app |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROJ-01 | Phase 56 | Pending |
| PROJ-02 | Phase 56 | Pending |
| PROJ-03 | Phase 56 | Pending |
| PROJ-04 | Phase 56 | Pending |
| PROJ-05 | Phase 56 | Pending |
| HDR-01 | Phase 57 | Pending |
| HDR-02 | Phase 57 | Pending |
| HDR-03 | Phase 57 | Pending |
| TRANS-01 | Phase 58 | Pending |
| TRANS-02 | Phase 58 | Pending |
| TRANS-03 | Phase 58 | Pending |

**Coverage:**
- v4.4 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-10*
*Last updated: 2026-02-10 after v4.4 milestone start*
