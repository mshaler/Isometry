# Feature Landscape

**Domain:** SuperGrid polymorphic data visualization
**Researched:** 2026-02-05

## Executive Summary

SuperGrid polymorphic visualization represents a fundamentally different approach to data grids — rather than building separate view components, it implements a unified coordinate system that can render the same LATCH-filtered dataset through multiple spatial projections. Based on extensive analysis of IsometryKB patterns and existing Isometry v4 architecture, SuperGrid breaks new ground with its Janus Density Model, nested PAFV headers with dimensional spanning, and direct sql.js integration for zero-serialization data binding.

The feature landscape divides into foundational table stakes (basic grid functionality), competitive differentiators (unique SuperGrid capabilities), and deliberate anti-features to avoid complexity traps that plague traditional grid systems.

## Table Stakes

Features users expect from any modern data grid. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Basic Cell Rendering | Fundamental grid display | Low | D3.js data binding with sql.js queries |
| Row/Column Headers | Grid navigation requirement | Low | Static headers before spanning logic |
| Cell Selection | User interaction foundation | Medium | Single/multi-select with keyboard nav |
| Keyboard Navigation | Accessibility & power user expectation | Medium | Arrow keys, Tab, Enter patterns |
| Scroll Performance | Large dataset usability | High | Virtual scrolling with 10k+ cells |
| Resize Columns | User customization expectation | Medium | Drag handles with proportional sizing |
| Sort by Column | Basic data manipulation | Low | SQL ORDER BY integration |
| Export Data | Data portability requirement | Low | CSV/JSON export from sql.js |
| Responsive Layout | Mobile/tablet compatibility | Medium | Adaptive cell sizing and header collapse |
| Undo/Redo | Data editing safety net | High | Operation stack with ACID transactions |

## Differentiators

Features that set SuperGrid apart from existing grid systems. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Nested PAFV Headers** | Hierarchical data visualization no one else has | High | Signature SuperGrid feature - visual spanning across hierarchy levels |
| **Grid Continuum** | Same data, multiple views seamlessly | High | Gallery → List → Kanban → Grid → SuperGrid transitions |
| **Janus Density Model** | Orthogonal zoom/pan controls | High | Independent value density (zoom) and extent density (pan) |
| **Dynamic Axis Assignment** | Drag LATCH dimensions between planes | High | Real-time PAFV remapping with smooth transitions |
| **Direct sql.js Binding** | Zero serialization overhead | Medium | D3.js queries SQLite in same memory space |
| **Bipolar Origin Mode** | Eisenhower Matrix & 2D semantic grids | Medium | Center-origin coordinates for quadrant semantics |
| **Anchor Origin Mode** | Traditional spreadsheet layouts | Low | Corner-origin for hierarchical data |
| **SuperStack Spanning** | Visual header spanning without merged cells | High | Pure CSS/SVG spanning preserves data model |
| **LATCH-Aware Formulas** | Multidimensional calculations | High | Formula scope respects PAFV context |
| **SuperZoom Navigation** | Cartographic grid navigation | Medium | Pinned upper-left anchor like Maps.app |
| **Coordinate Persistence** | Position survives view transitions | Medium | Janus translation layer maintains context |
| **Four-Quadrant Layout** | MiniNav + Headers + Data separation | Low | Clean rendering boundary definitions |

## Anti-Features

Features to explicitly NOT build. Common mistakes in grid systems.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Merged Data Cells** | Breaks selection, copy/paste, and formula scope | Use visual spanning with CSS/SVG overlays |
| **Complex ORM Layer** | Performance killer, debugging nightmare | Direct SQL with TypeScript interfaces |
| **Cell-Level State Management** | Memory explosion with large grids | D3's data join IS state management |
| **External State Managers** | Redux/Zustand conflicts with D3 patterns | Use D3 data binding + React contexts only |
| **Native Bridge Complexity** | 40KB overhead, serialization bottleneck | sql.js eliminates all bridge code |
| **Infinite Scroll** | Poor UX for data grids, breaks keyboard nav | Virtual scrolling with known boundaries |
| **Real-time Everything** | Performance degradation, battery drain | Selective real-time based on user focus |
| **Auto-Save Every Keystroke** | Database thrashing, poor performance | Debounced saves with explicit save points |
| **Complex Drag-Drop Framework** | Over-engineering, poor touch support | Simple PAFV chip movement with snap zones |
| **Pivot Table UI** | Complexity explosion, poor mobile UX | LATCH filtering with visual aggregation |
| **Advanced Query Builder** | Scope creep, SQL is better for power users | Direct SQL with syntax highlighting |
| **Custom Undo Framework** | Reinventing the wheel, edge case bugs | Browser/system undo + SQL transactions |

## Feature Dependencies

```
Foundation Layer:
- sql.js Integration → Basic Cell Rendering
- Basic Cell Rendering → Row/Column Headers
- Row/Column Headers → Cell Selection

SuperGrid Core:
- PAFV Context → Dynamic Axis Assignment
- Dynamic Axis Assignment → Grid Continuum
- Grid Continuum → Nested PAFV Headers
- Coordinate System → Bipolar/Anchor Origins

Advanced Features:
- Nested PAFV Headers → SuperStack Spanning
- Janus Density Model → SuperZoom Navigation
- PAFV Context → LATCH-Aware Formulas
```

## MVP Recommendation

For SuperGrid Foundation (v4.1), prioritize:

1. **Direct sql.js Integration** - Proves bridge elimination architecture
2. **Basic PAFV Headers** - Single-level row/column headers with LATCH mapping
3. **Dynamic Axis Assignment** - Drag chips between wells (rows/columns/available)
4. **Anchor Origin Mode** - Traditional grid coordinates (0,0 at top-left)
5. **Basic Grid Continuum** - Switch between List → Grid views

Defer to post-MVP:
- **SuperStack Spanning**: Complex visual spanning logic, needs solid foundation first
- **Janus Density Model**: Advanced UX concept, requires user feedback on basic grid
- **Bipolar Origin Mode**: Specialized feature, Eisenhower Matrix can wait
- **LATCH-Aware Formulas**: Formula system is a major feature deserving its own phase
- **SuperZoom Navigation**: Nice-to-have, not core grid functionality

## Competitive Analysis

**Existing Solutions Analyzed:**
- AG Grid: Industry standard, but heavy and lacks axis assignment
- React Table: Hooks-based, but no polymorphic view support
- MUI DataGrid: Good UX, but no grid continuum concept
- Airtable: Best view switching UX, but proprietary and limited
- Notion: Great table/board views, but no hierarchical headers

**SuperGrid's Unique Position:**
- Only system with polymorphic view continuum (same data, multiple projections)
- Only system with nested PAFV headers across arbitrary dimensions
- Only system with orthogonal density controls (Janus model)
- Only system with direct WASM SQLite integration for zero serialization
- Only system designed specifically for LATCH filtering + GRAPH connectivity

## Implementation Insights from IsometryKB

**Key Patterns Discovered:**

1. **Four-Grid Architecture**: SuperGrid consists of MiniNav, Column Headers, Row Headers, and Data Cells - each with distinct rendering responsibilities

2. **Z-Axis Layer Stack**:
   - z=0 Sparsity (D3 data floor)
   - z=1 Density (React controls)
   - z=2 Overlay (Cards/modals)

3. **Janus Translation**: Positions recomputed across view transitions rather than preserved literally - maintains semantic meaning while adapting to new coordinate systems

4. **Density-Dimensionality Unification**: SuperDensity controls semantic precision (sparse: "January" vs dense: "Q1") without losing fidelity

5. **Grid Continuum Mapping**:
   - Gallery: 0 explicit axes (position only)
   - List: 1 axis (vertical)
   - Kanban: 1 facet (columns)
   - 2D Grid: 2 axes (x/y)
   - SuperGrid: n axes (stacked z-headers)

## Technical Architecture Requirements

**From Existing Isometry Implementation:**

- **TypeScript**: Strict mode compliance with comprehensive interfaces
- **sql.js**: Direct WASM SQLite queries, no bridge serialization
- **D3.js v7**: Data binding with .join() and key functions always
- **React 18**: Context providers for PAFV state management
- **Vitest**: TDD workflow with tests before implementation
- **Performance**: 60fps rendering with 10k+ cards via virtual scrolling

**SuperGrid-Specific Requirements:**

- **Coordinate System**: Support both Anchor (0,0 corner) and Bipolar (0,0 center) origins
- **PAFV Integration**: Hook into existing PAFVContext for axis assignments
- **LATCH Awareness**: Column/row headers map to LATCH dimensions (Location, Alphabet, Time, Category, Hierarchy)
- **View Persistence**: Grid state survives transitions to other views (Network, Kanban, Timeline)

## Sources

**HIGH Confidence (Context7/Official Sources):**
- IsometryKB/notes/SuperGrid.md - Core architecture specification
- IsometryKB/notes/supergrid-architecture-v4.md - PAFV implementation details
- IsometryKB/notes/apple-notes/CardBoard/SuperGrid*.md - Design evolution patterns
- /Users/mshaler/Developer/Projects/Isometry/src/types/supergrid.ts - Current TypeScript interfaces
- /Users/mshaler/Developer/Projects/Isometry/src/d3/SuperGrid.ts - Existing D3 implementation

**MEDIUM Confidence (Web Research Verified):**
- Modern data grid drag-drop patterns from AG Grid, MUI DataGrid, RevoGrid documentation
- View switching patterns from Airtable, Notion, project management tools
- Sparse grid visualization research from academic papers (2025)

**LOW Confidence (Flagged for Validation):**
- Exact performance characteristics of sql.js with large datasets
- Touch interaction patterns for nested header spanning
- Memory usage patterns with 10k+ cells in browser environment

This research provides comprehensive foundation for SuperGrid v4.1 implementation, prioritizing proven patterns while identifying unique differentiators that set SuperGrid apart from existing grid systems.