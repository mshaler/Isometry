# Requirements: Isometry v4.1 SuperGrid Foundation

**Defined:** 2026-02-05
**Core Value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

## v4.1 Requirements

Requirements for SuperGrid Foundation milestone. Foundation systems provide essential grid functionality, differentiators establish unique competitive advantages.

### Foundation Systems

- [ ] **FOUND-01**: System renders basic grid cells with D3.js data binding using key functions for performance
- [ ] **FOUND-02**: System displays row headers with LATCH dimension mapping (Location, Alphabet, Time, Category, Hierarchy)
- [ ] **FOUND-03**: System displays column headers with LATCH dimension mapping and visual hierarchy indication
- [ ] **FOUND-04**: System implements virtual scrolling for 10k+ cells maintaining 60fps performance
- [ ] **FOUND-05**: System supports keyboard navigation (arrow keys, tab, enter) with visible cell selection
- [ ] **FOUND-06**: System enables column resizing with drag handles and preserves width state
- [ ] **FOUND-07**: System provides basic sorting by clicking column headers with visual sort indicators

### SuperGrid Differentiators

- [ ] **DIFF-01**: System renders nested PAFV headers with hierarchical spanning across multiple dimension levels
- [ ] **DIFF-02**: System enables dynamic axis assignment via drag-drop wells for real-time view reconfiguration
- [ ] **DIFF-03**: System supports grid continuum transitions between gallery, list, kanban, and grid projections
- [ ] **DIFF-04**: System implements Janus density model with orthogonal zoom (value) and pan (extent) controls
- [ ] **DIFF-05**: System binds D3.js directly to sql.js queries with zero serialization overhead
- [ ] **DIFF-06**: System updates grid layout in real-time when LATCH dimensions are reassigned between spatial planes
- [ ] **DIFF-07**: System preserves semantic position during view transitions using Janus coordinate translation
- [ ] **DIFF-08**: System maintains consistent PAFV context across all grid interactions and transformations

### Integration Requirements

- [ ] **INTEG-01**: System integrates with existing PAFVContext without breaking current LATCH filtering
- [ ] **INTEG-02**: System uses existing sql.js foundation maintaining bridge elimination architecture
- [ ] **INTEG-03**: System preserves existing TypeScript interfaces and extends them for grid-specific features
- [ ] **INTEG-04**: System maintains compatibility with existing D3.js visualization components
- [ ] **INTEG-05**: System coordinates with existing React context providers without state conflicts

## Future Requirements

Deferred to later milestones. Tracked but not in current roadmap.

### Advanced Features

- **ADV-01**: LATCH-aware formulas and calculation scope with cell dependencies
- **ADV-02**: Bipolar origin mode for Eisenhower Matrix and quadrant-based layouts
- **ADV-03**: SuperZoom cartographic navigation with pinned anchor points
- **ADV-04**: Advanced audit overlay system with formula visibility toggle
- **ADV-05**: Cell expansion with inline content editing and rich media support

### Performance Optimization

- **PERF-01**: Memory management for 100k+ cell datasets with lazy loading
- **PERF-02**: Touch gesture support for mobile nested header interaction
- **PERF-03**: Accessibility compliance with screen reader and keyboard-only navigation
- **PERF-04**: Export capabilities (CSV, Excel, PDF) with layout preservation

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Single-user focused, conflicts with local-first architecture |
| Advanced formula engine | Defer complex calculations to future milestone, focus on visualization |
| Custom cell renderers | Generic grid cells sufficient for foundation, defer customization |
| Infinite scroll | Virtual scrolling with pagination more performant and predictable |
| Mobile app integration | Desktop web focus first, mobile adaptation in future milestone |
| Data import/export | Existing sql.js foundation handles this, not grid-specific |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 34 | Pending |
| FOUND-02 | Phase 34 | Pending |
| FOUND-03 | Phase 34 | Pending |
| FOUND-04 | Phase 34 | Pending |
| FOUND-05 | Phase 35 | Pending |
| FOUND-06 | Phase 35 | Pending |
| FOUND-07 | Phase 35 | Pending |
| DIFF-01 | Phase 36 | Pending |
| DIFF-02 | Phase 35 | Pending |
| DIFF-03 | Phase 37 | Pending |
| DIFF-04 | Phase 36 | Pending |
| DIFF-05 | Phase 35 | Pending |
| DIFF-06 | Phase 35 | Pending |
| DIFF-07 | Phase 37 | Pending |
| DIFF-08 | Phase 35 | Pending |
| INTEG-01 | Phase 34 | Pending |
| INTEG-02 | Phase 34 | Pending |
| INTEG-03 | Phase 34 | Pending |
| INTEG-04 | Phase 34 | Pending |
| INTEG-05 | Phase 34 | Pending |

**Coverage:**
- v4.1 requirements: 20 total
- Mapped to phases: 20
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-05*
*Last updated: 2026-02-05 after roadmap creation*