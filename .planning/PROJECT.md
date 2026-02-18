# Isometry

**Domain:** Native knowledge management with hybrid PAFV+LATCH+GRAPH visualization
**Type:** Native iOS/macOS applications with React prototype bridge
**Timeline:** Production-ready native implementation

## What This Is

Isometry is a polymorphic data projection platform where the same LATCH-filtered, GRAPH-connected dataset renders through PAFV spatial projection as gallery, list, kanban, grid, network, or timeline — with view transitions that change the SQL projection, not the data. The Three-Canvas notebook (Capture + Shell + Preview) provides the unified workspace for knowledge capture and visualization.

## Core Value

Polymorphic data projection with zero context loss — the same cards appear across all views, selection syncs everywhere, and the underlying data model (LPG in SQLite) is queryable in real-time.

## Current State

**v7.0 SHIPPED (2026-02-17)** — Polymorphic Views & Apple Notes Sync

The platform now supports the full Grid Continuum (Gallery/List/Kanban) with resizable Three-Canvas layout and direct Apple Notes synchronization. Key capabilities:

- **Grid Continuum:** 5 view modes (Gallery, List, Kanban, Grid, SuperGrid) with PAFV axis allocation
- **Three-Canvas Notebook:** Resizable Capture/Shell/Preview with panel size persistence
- **Cross-view selection:** Click in any view → selection visible everywhere via SelectionContext
- **Direct Apple Notes sync:** SQLite access to NoteStore.sqlite eliminates alto-index.json bugs
- **ForceSimulationManager:** Lifecycle-managed D3 force simulations with auto-stop
- **CSS Primitives:** Full design token system with view-specific primitives

**Codebase:** 203,347 LOC TypeScript, 9,413 LOC CSS

## Next Milestone: v7.1 (Planning)

Focus areas to consider:
- Interactive Shell (Claude AI, terminal, GSD GUI) — deferred from v6.0
- CloudKit sync for cross-device access
- Performance optimization for 10K+ nodes

## Requirements

### Validated (Shipped)

**v7.0 — Polymorphic Views & Apple Notes Sync:**
- ✓ REQ-A-01: Gallery View Renderer — GalleryView with TanStack Virtual, 60fps at 500+ items
- ✓ REQ-A-02: List View Renderer — ListView with hierarchical tree, keyboard navigation
- ✓ REQ-A-03: Kanban View Renderer — KanbanView with react-dnd, SQL UPDATE persistence
- ✓ REQ-A-04: Grid Continuum Mode Switcher — ViewDispatcher routing, keyboard shortcuts
- ✓ REQ-A-05: PAFV Axis Allocation per View Mode — GridContinuumController.allocateAxes()
- ✓ REQ-A-06: Cross-View Selection Synchronization — SelectionContext sync across modes
- ✓ REQ-B-01: Knip Unused Exports Cleanup — 275→91 (67% reduction)
- ✓ REQ-B-02: src/services Directory Refactoring — directory health maintained
- ✓ REQ-B-03: TipTap Automated Test Infrastructure — 93 tests established
- ✓ REQ-C-01: Network Graph SQL Integration — ForceSimulationManager, useForceSimulation hook
- ✓ REQ-C-02: Timeline View SQL Integration — TimelineView with adaptive tick labels
- ✓ REQ-C-03: Preview Tab Integration — Network/Timeline as selectable tabs
- ✓ REQ-C-04: Force Simulation Lifecycle Management — start/stop/reheat/destroy, auto-stop
- ✓ REQ-D-01: Three-Canvas Layout — react-resizable-panels v3, localStorage persistence
- ✓ REQ-D-02: Cross-Pane Selection Sync — bidirectional selection, cross-canvas messaging
- ✓ REQ-D-03: View State Preservation — per-tab scroll/zoom via usePreviewSettings
- ✓ REQ-D-04: Pane Resize Coordination — PaneLayoutContext, debounced resize
- ✓ REQ-NF-01: Performance Targets — 60fps achieved across all views
- ✓ REQ-NF-02: CSS Primitives Consumption — all views consume primitives-*.css
- ✓ REQ-NF-03: Test Coverage — unit tests for all view renderers and integration

**v6.8 and earlier:** See `.planning/MILESTONES.md` for complete validated requirements

### Active (Next Milestone)

To be defined during `/gsd:new-milestone`

### Out of Scope

- Mobile/iOS port — desktop-first
- Real-time collaboration — single-user focused
- Video/audio content — text and structured data only
- AI model fine-tuning — use foundation models via MCP

## Context

**v7.0 shipped with:**
- 8 phases (110-117) covering 4 parallel tracks
- 23 plans executed over 2 days
- 203K+ LOC codebase in TypeScript strict mode
- Three-canvas notebook fully integrated
- Apple Notes direct sync eliminating data integrity bugs

**Technical architecture:**
- React 18 + TypeScript strict mode
- sql.js (SQLite in WASM) for client-side queries
- D3.js for force/network visualizations
- TanStack Virtual for 500+ item virtualization
- CSS Grid for tabular layouts with native spanning
- react-resizable-panels for pane management

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| CSS Grid for SuperGrid | Native spanning, no coordinate math | ✓ Good — 84 tests, 4 themes |
| D3.js for force/network | Force simulation requires D3 | ✓ Good — lifecycle managed |
| TanStack Virtual for virtualization | React-native, row-based | ✓ Good — 60fps at 500+ items |
| react-dnd for kanban | Simpler than dnd-kit | ✓ Good — clean API |
| react-resizable-panels v3 | Group/Panel/Separator API | ✓ Good — localStorage persistence |
| Direct Apple Notes SQLite | Eliminates alto-index bugs | ✓ Good — correct folder hierarchy |
| ForceSimulationManager class | Prevents memory leaks | ✓ Good — explicit lifecycle |
| Row-based virtualization | CSS Grid auto-fit incompatible with TanStack | ✓ Good — solved the API conflict |
| sessionStorage for view state | Per-session, not persistent | ✓ Good — user expectation match |

---
*Last updated: 2026-02-17 after v7.0 milestone*
