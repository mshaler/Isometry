# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** v6.9 Polymorphic Views & Foundation — IN PROGRESS

## Current Position

Phase: 113 (Network Graph Integration) IN PROGRESS
Plan: 02 COMPLETE — Network Graph SQL Integration
Status: Track C progressing — 2/3 plans executed
Last activity: 2026-02-17 — Plan 113-02 executed

Progress: [█████████░] 92%
Overall: v6.9 Polymorphic Views & Foundation — Track C Progressing

## Active Milestones

### v6.9 Polymorphic Views & Foundation — IN PROGRESS

**Goal:** Enable full Grid Continuum (Gallery/List/Kanban/Grid/SuperGrid) with CSS primitives, clean up technical debt, polish Network/Timeline views, and complete Three-Canvas notebook integration.

**Four Tracks:**
- **Track A:** View Continuum Integration (Gallery/List/Kanban → CSS Grid + PAFV)
- **Track B:** Technical Debt Sprint (knip, directory health, TipTap tests)
- **Track C:** Network/Timeline Polish (SQL hooks, Preview tabs)
- **Track D:** Three-Canvas Notebook (Capture+Shell+Preview integration)

**Parallelization:** A+B parallel → C (after A) → D (after C)

**Progress:**
[█████████░] 89%
- Requirements: 20 defined (9 P0, 9 P1, 2 P2)

### v6.8 CSS Primitives — SHIPPED 2026-02-16

**Status:** ✅ COMPLETE — Archived

**Deliverables:**
- ✓ Tier 1 tokens.css (dark + light themes)
- ✓ Tier 2 primitives (supergrid, kanban, timeline, gallery)
- ✓ Tier 3 chrome (sticky-headers, selection, scroll-shadows, tooltip, sidebar, accordion, dialog)
- ✓ css-primitives.ts reader utility
- ✓ chrome-index.css aggregator

### v6.7 CSS Grid Integration — SHIPPED 2026-02-16

**Status:** ✅ COMPLETE — Archived

## Performance Metrics

**Recent Milestones:**
- v6.8 CSS Primitives: 3 phases (107, 108, 109), ~2 days
- v6.7 CSS Grid Integration: 1 phase (106), 4 plans, ~1 day
- v6.6 CSS Grid SuperGrid: 1 phase (105), 6 sub-phases, ~2 days

**Velocity:**
- Average plan duration: ~5-8 minutes
- Recent trend: Stable (small, focused plans executing efficiently)

## Accumulated Context

### Decisions

**v6.9 Planning:**
- TRACK-PARALLEL-01: Tracks A+B can run in parallel (independent concerns)
- TRACK-SEQUENCE-01: Track C depends on A (views need CSS primitives wired)
- TRACK-SEQUENCE-02: Track D depends on C (canvas integration needs working views)

**Previous milestones:** See STATE.md archive for v6.1-v6.8 decisions.
- [Phase 110]: GALLERY-ROW-VIRT-01: Row-based virtualization (not CSS Grid auto-fit) because TanStack Virtual translateY is incompatible with auto-fit layout
- [Phase 110-02]: LIST-01: ListRow.tsx pre-committed in 110-01 with identical spec content
- [Phase 110-02]: LIST-02: Groups start collapsed (empty Set) to avoid overwhelming users on initial load
- [Phase 110-02]: LIST-03: stable transformCards function outside component to prevent useSQLiteQuery re-runs
- [Phase 110-02]: LIST-04: folder ?? '(No Folder)' fallback ensures all cards appear in tree
- [Phase 112-01]: KNIP-BARREL-01: Add 33 barrel file entry points to knip.json to eliminate false positives
- [Phase 112-01]: EXPORT-PATTERN-01: Keep named exports, remove default exports where no external dependencies
- [Phase 112-01]: COMPAT-ALIAS-01: Retain backward-compatibility aliases that are actively imported
- [Phase 112]: STUB-PATTERN-01: Use explicit named re-exports rather than wildcard to maintain type safety
- [Phase 112]: QUERY-GROUPING-01: Group facet-discovery, query-executor, TagService in query/ as all perform data access operations
- [Phase 112-03]: JSDOM-MOCK-01: Mock getBoundingClientRect/getClientRects for ProseMirror in JSDOM
- [Phase 112-03]: TEST-PATTERN-01: Use TestEditorWrapper with children render prop for editor access
- [Phase 112-03]: IMMEDIATE-RENDER-01: Use immediatelyRender: true for TipTap test stability
- [Phase 111-01]: KANBAN-DRAG-01: Function form for useDrag item prevents stale closure issues
- [Phase 111-01]: KANBAN-FACET-01: Y-axis PAFV mapping determines column facet with 'status' fallback
- [Phase 111-01]: KANBAN-UNCAT-01: Cards with null facet go to '(Uncategorized)' column
- [Phase 111-02]: GRID-PLACEHOLDER-01: Grid/SuperGrid modes show placeholder (SuperGridCSS requires PAFV config from parent)
- [Phase 111-03]: ALLOC-01: allocateAxes() returns defaults (status/folder) when no mappings set
- [Phase 111-03]: PERSIST-01: sessionStorage over localStorage for session-scoped selection
- [Phase 111-03]: PERSIST-02: Silent catch on quota errors to prevent UI crashes
- [Phase 113-01]: LIFECYCLE-01: ForceSimulationManager destroy() clears DOM, nullifies refs, removes event handlers
- [Phase 113-01]: HOOK-EFFECT-01: Two-effect pattern separates manager creation (once) from simulation lifecycle (on data change)
- [Phase 113-01]: AUTO-STOP-01: Simulation auto-stops after maxTicks (300) or maxTime (3000ms) to prevent runaway CPU
- [Phase 113-02]: SQLQUERY-01: useSQLiteQuery replaces useLiveData for consistent data fetching pattern
- [Phase 113-02]: FILTER-01: LATCH filters compile to SQL WHERE clause with compileFilters()
- [Phase 113-02]: SIMULATION-01: useForceSimulation hook manages D3 force simulation lifecycle
- [Phase 113-02]: SELECTION-01: SelectionContext integration enables cross-canvas selection sync
- [Phase 113-02]: EXTENDED-VIEW-01: ViewDispatcher accepts ExtendedViewMode for Grid Continuum + network/timeline

### Pending Todos

**Phase 110:** View Continuum Foundation (Track A Wave 1) ✅ COMPLETE
- [x] Plan 110-01: Gallery view with CSS Grid masonry + TanStack Virtual
- [x] Plan 110-02: List view with hierarchical tree + keyboard navigation

**Phase 111:** View Continuum Integration (Track A Wave 2) ✅ COMPLETE
- [x] Plan 111-01: KanbanView with react-dnd drag-drop and SQL UPDATE persistence
- [x] Plan 111-02: ViewDispatcher + Cmd+1-5 keyboard shortcuts (8 tests)
- [x] Plan 111-03: PAFV Axis Allocation + Selection Sync (18 tests)

**Phase 112:** Technical Debt (runs parallel with 110-111) ✅ COMPLETE
- [x] Plan 112-01: Knip audit and unused export removal (275 -> 91 unused exports)
- [x] Plan 112-02: src/services directory reorganization (3 files moved to query/)
- [x] Plan 112-03: TipTap test infrastructure (93 tests across 7 extensions)

**Phase 113:** Network Graph Integration (Track C) IN PROGRESS
- [x] Plan 113-01: Force Simulation Lifecycle Management (18 tests)
- [x] Plan 113-02: NetworkGraph with SQL query hooks (18 tests)
- [ ] Plan 113-03: Preview tab integration (pending)

### Blockers/Concerns

**Technical Debt (Track B targets):**
- knip unused exports: 91 remaining (down from 275, reduced by 67%)
- Directory health: src/services (8/15 files - within limit after refactoring)
- TipTap automated tests: ✅ 93 tests across 7 extensions (infrastructure complete)

**View Continuum (Track A context):**
- ✅ Track A Complete: Gallery/List/Kanban views with CSS Grid + PAFV
- ✅ ViewDispatcher with Cmd+1-5 keyboard shortcuts operational
- ✅ allocateAxes() provides mode-specific axis configuration
- ✅ Selection persists across view transitions and page refresh
- Ready for Track C (Network/Timeline Polish)

## Session Continuity

Last session: 2026-02-17
Completed: Phase 113-02 — Network Graph SQL Integration (18 tests)
Next: Phase 113-03 (Preview tab integration)
Resume file: N/A

**Stopped at:** Completed Phase 113-02 (Network Graph SQL Integration) - Track C progressing

---
*Updated: 2026-02-17 (Phase 113-02 complete, Track C Network Graph Integration progressing)*
