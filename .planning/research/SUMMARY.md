# Project Research Summary

**Project:** Isometry v4.1 SuperGrid Foundation
**Domain:** Polymorphic data projection platform
**Researched:** 2026-02-05
**Confidence:** HIGH

## Executive Summary

SuperGrid represents a fundamentally different approach to data visualization — rather than building separate view components, it implements a unified coordinate system where the same LATCH-filtered dataset can render through multiple spatial projections (Gallery → List → Kanban → Grid → SuperGrid). This polymorphic design, combined with Isometry's proven sql.js + D3.js bridge elimination architecture, creates a unique competitive advantage that no existing grid system offers.

The recommended approach leverages Isometry's existing foundation while extending it through a three-layer z-axis architecture: D3.js handles sparsity (individual cells), React manages density (navigation, spanning, overlays), and sql.js provides direct data access without serialization overhead. This preserves the core v4 performance benefits while adding revolutionary grid capabilities.

Key risks center on maintaining D3.js data binding integrity, preventing WASM memory overflow as datasets scale, and avoiding React-D3 lifecycle conflicts. These are all well-understood patterns with proven mitigation strategies. The architecture builds incrementally on working foundations rather than requiring rewrites.

## Key Findings

### Recommended Stack

The research confirms Isometry's existing stack choice while identifying specific extensions needed for SuperGrid functionality. The core sql.js + D3.js + React architecture remains optimal, with targeted additions for grid-specific features.

**Core technologies:**
- **@dnd-kit/core (v6.3.1)**: Modern drag-drop for axis reordering — replaces deprecated react-dnd with better performance and accessibility
- **d3-selection-multi (v3.0.0)**: Bulk attribute setting for nested headers — optimizes complex grid rendering
- **react-window (existing)**: Virtual scrolling foundation — already proven for performance at scale
- **immer (v10.1.1)**: Immutable PAFV state updates — handles complex axis assignments without mutation
- **sql.js (existing)**: Direct WASM queries — maintains bridge elimination architecture

### Expected Features

SuperGrid features divide into foundational table stakes, competitive differentiators, and deliberate anti-features to avoid complexity traps.

**Must have (table stakes):**
- Basic cell rendering with D3.js data binding
- Row/column headers with LATCH dimension mapping
- Virtual scrolling for 10k+ cell performance
- Keyboard navigation and cell selection
- Column resizing and basic sorting

**Should have (competitive):**
- Nested PAFV headers with hierarchical spanning — signature SuperGrid feature
- Dynamic axis assignment via drag-drop wells — real-time view reconfiguration
- Grid continuum transitions — same data, multiple projections
- Janus density model — orthogonal zoom/pan controls
- Direct sql.js binding — zero serialization overhead

**Defer (v2+):**
- LATCH-aware formulas and calculation scope
- Bipolar origin mode for Eisenhower Matrix layouts
- SuperZoom cartographic navigation
- Advanced audit and overlay systems

### Architecture Approach

SuperGrid integrates as a three-layer z-axis system that preserves Isometry's bridge elimination architecture while extending D3.js rendering capabilities. The z-axis separation ensures clean responsibilities: React controls density and navigation (z=1), D3.js renders sparse data cells (z=0), with React overlays for expanded content (z=2).

**Major components:**
1. **Enhanced DatabaseService** — adds PAFV coordinate queries while maintaining synchronous sql.js pattern
2. **Extended PAFVContext** — maps LATCH dimensions to grid axes, generates coordinate-aware SQL
3. **SuperGrid D3 Renderer** — four GridBlocks (MiniNav, Column Headers, Row Headers, Data Cells) with proper data binding
4. **React Integration Layer** — header spanning logic, density controls, card overlays without DOM conflicts

### Critical Pitfalls

Based on analysis of grid system failures and Isometry's architecture patterns, the most dangerous pitfalls center on data binding integrity and memory management.

1. **D3 Data Binding Without Key Functions** — causes 50% performance degradation and DOM thrashing; always use `.data(cards, d => d.id).join()` pattern
2. **WASM Memory Overflow** — sql.js databases >100MB exhaust WASM memory space; implement proper disposal and monitoring
3. **SQL Performance Regression** — dynamic PAFV queries bypass static indexes causing 10x slowdowns; create composite indexes for common LATCH combinations
4. **React-D3 Lifecycle Conflicts** — mixing DOM ownership causes double updates; maintain strict separation via refs
5. **PAFV State Synchronization Drift** — axis assignments become inconsistent between UI and rendering; implement validation layer

## Implications for Roadmap

Based on research, suggested phase structure prioritizes foundation stability, then builds SuperGrid incrementally to minimize integration risks:

### Phase 1: Foundation Stabilization (4 weeks)
**Rationale:** Bridge elimination architecture must be proven stable before SuperGrid additions
**Delivers:** Verified sql.js + D3.js integration with TypeScript compilation cleanup
**Addresses:** Core table stakes (basic rendering, data binding)
**Avoids:** Building on unstable foundations that cause rework

### Phase 2: PAFV Grid Core (6 weeks)
**Rationale:** PAFV axis assignment is the key differentiator requiring solid implementation first
**Delivers:** Dynamic axis assignment with basic grid rendering
**Uses:** Enhanced PAFVContext, @dnd-kit integration, D3.js GridBlock system
**Implements:** Single-level headers, axis wells, coordinate mapping

### Phase 3: SuperGrid Headers (4 weeks)
**Rationale:** Nested headers are signature feature but require solid PAFV foundation
**Delivers:** Multi-level hierarchical headers with visual spanning
**Addresses:** Primary differentiator (nested PAFV headers)
**Avoids:** Header spanning performance pitfalls through careful implementation

### Phase 4: Grid Continuum (3 weeks)
**Rationale:** View transitions leverage existing architecture with minimal new complexity
**Delivers:** Seamless transitions between Gallery/List/Kanban/Grid views
**Uses:** Existing filter system with PAFV coordinate translation
**Implements:** Janus translation layer for semantic position preservation

### Phase Ordering Rationale

- **Foundation-first approach** prevents building SuperGrid on unstable architecture
- **PAFV-centric sequencing** prioritizes unique differentiator over standard grid features
- **Incremental complexity** adds one major system per phase to avoid integration overwhelm
- **Performance validation gates** ensure each phase maintains sql.js architectural benefits

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (SuperGrid Headers):** Complex CSS spanning calculations need performance profiling with real hierarchies
- **Phase 4 (Grid Continuum):** Janus coordinate translation algorithms need validation with diverse datasets

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Well-documented TypeScript/sql.js integration patterns
- **Phase 2 (PAFV Core):** Existing PAFVContext extension, established D3.js patterns

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | IsometryKB provides detailed architectural specifications; existing codebase validates patterns |
| Features | HIGH | Competitive analysis and IsometryKB evolution show clear feature differentiation |
| Architecture | HIGH | Three-layer z-axis pattern extensively documented; integration points clearly defined |
| Pitfalls | HIGH | Historical CardBoard failure analysis provides comprehensive pitfall catalog |

**Overall confidence:** HIGH

### Gaps to Address

The research provides comprehensive coverage with minimal gaps requiring validation:

- **Performance metrics with large datasets:** Exact sql.js performance characteristics with 100k+ records need measurement during Phase 1
- **Touch interaction patterns:** Mobile gesture support for nested headers needs UX validation during Phase 3
- **Memory usage scaling:** WASM memory consumption patterns with complex grid hierarchies need monitoring during implementation

## Sources

### Primary (HIGH confidence)
- IsometryKB/notes/SuperGrid.md — Core architecture specification and design principles
- IsometryKB/notes/supergrid-architecture-v4.md — Three-layer z-axis pattern and Janus density model
- IsometryKB/notes/apple-notes/CardBoard/SuperGrid*.md — Historical evolution and proven patterns
- /Users/mshaler/Developer/Projects/Isometry/src/types/supergrid.ts — Current TypeScript interfaces
- /Users/mshaler/Developer/Projects/Isometry/src/d3/SuperGrid.ts — Existing D3.js implementation baseline

### Secondary (MEDIUM confidence)
- @dnd-kit documentation and performance analysis — Modern drag-drop replacement rationale
- D3.js v7 performance patterns — Data binding best practices and anti-patterns
- sql.js WASM limitations research — Memory management and scaling considerations
- Competitive analysis (AG Grid, React Table, Airtable) — Feature differentiation validation

### Tertiary (LOW confidence)
- Exact performance metrics — Extrapolated from general patterns, need measurement
- Phase timing estimates — Based on complexity assessment, subject to implementation reality
- Touch interaction UX patterns — Inferred from mobile grid usage, needs validation

---
*Research completed: 2026-02-05*
*Ready for roadmap: yes*