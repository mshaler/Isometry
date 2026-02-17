# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-16)

**Core value:** Transform the Isometry ecosystem with a capture-shell-preview workflow that bridges rapid note-taking with AI-assisted development, seamlessly integrating notebook cards into the existing PAFV+LATCH+GRAPH knowledge system.

**Current focus:** v6.9 Polymorphic Views & Foundation — IN PROGRESS

## Current Position

Phase: 112 (Technical Debt Sprint)
Plan: 02 COMPLETE — Services directory refactoring done
Status: Phase 112-02 complete — query services moved to query/ subdirectory
Last activity: 2026-02-17 — Plan 112-02 executed

Progress: [█████████░] 89%
Overall: v6.9 Polymorphic Views & Foundation — IN PROGRESS

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

### Pending Todos

**Phase 110:** View Continuum Foundation (Track A Wave 1)
- [x] Plan 110-01: Gallery view with CSS Grid masonry + TanStack Virtual
- [x] Plan 110-02: List view with hierarchical tree + keyboard navigation

**Phase 112:** Technical Debt (runs parallel with 110-111)
- [x] Plan 112-01: Knip audit and unused export removal (275 -> 91 unused exports)
- [x] Plan 112-02: src/services directory reorganization (3 files moved to query/)
- [ ] Plan 112-03: TipTap test infrastructure

### Blockers/Concerns

**Technical Debt (Track B targets):**
- knip unused exports: 91 remaining (down from 275, reduced by 67%)
- Directory health: src/services (22/15 files)
- TipTap automated tests: Manual test plan in place, need infrastructure

**View Continuum (Track A context):**
- CSS primitives exist but aren't consumed by renderers
- GridContinuumController exists but uses legacy D3 projections
- Need to bridge controller logic to CSS Grid approach

## Session Continuity

Last session: 2026-02-17
Completed: Plan 112-02 — Services directory refactoring (3 files to query/, 3 re-export stubs)
Next: Phase 112-03 (TipTap tests), or Phase 111 (ViewDispatcher)
Resume file: N/A

**Stopped at:** Completed 112-02-PLAN.md (services directory refactoring)

---
*Updated: 2026-02-17 (plan 112-02 complete, services directory refactored)*
