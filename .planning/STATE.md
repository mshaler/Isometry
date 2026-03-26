---
gsd_state_version: 1.0
milestone: v9.3
milestone_name: View Wiring Fixes
status: ready_to_plan
stopped_at: Phase 127 ready to plan
last_updated: "2026-03-26"
last_activity: 2026-03-26 — Roadmap created for v9.3 (Phases 127-129)
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-26)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v9.3 View Wiring Fixes — Phase 127: SuperGrid Data Path

## Current Position

Phase: 127 of 129 (SuperGrid Data Path)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-26 — v9.3 roadmap created, phases 127-129 defined

Progress: [░░░░░░░░░░] 0%

## Milestone History

- ✅ v8.5 ETL E2E Test Suite: Phases 109-113 complete (5 phases, 12 plans, 30 reqs)
- ✅ v9.0 Graph Algorithms: Phases 114-119 complete (6 phases, 13 plans, 23 reqs)
- ✅ v9.1 Ship Prep: Phases 120-122 complete (3 phases, 8 plans, TestFlight-ready)
- ✅ v9.2 Alto Index Import: Phases 123-126 complete (4 phases, 7 plans, 13 reqs)

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.
- [Phase 122]: BridgeDataAdapter uses getCellKey not buildCellKey for key consistency with PivotGrid lookups
- [Phase 122]: 336 monolithic SuperGrid DOM-internal tests marked it.skip(CONV-06) -- behavior verified by E2E
- [Phase 125]: dataset_id column (not source-based partitioning) chosen for per-dataset card scoping
- [Phase 126]: directoryPath spread into etl:import-native payload only when not undefined

### Data Path Boundaries (critical for v9.3)

- SuperGrid (PivotGrid): uses BridgeDataAdapter exclusively -- does NOT touch ViewManager._fetchAndRender()
- TimelineView + NetworkView: use ViewManager._fetchAndRender() + view-specific secondary queries
- TimelineView empty state: triggered by internal due_at filter, not ViewManager zero-row result
- NetworkView: secondary async db:exec for connections + graph:simulate Worker call after initial render
- List/Grid/Kanban/Calendar/Gallery/Tree: share ViewManager._fetchAndRender() path, batch-diagnosable

### Blockers/Concerns

None at roadmap creation. Diagnostic investigation needed per phase to identify specific wiring breaks.

## Session Continuity

Last session: 2026-03-26
Stopped at: v9.3 roadmap creation complete
Resume: /gsd:plan-phase 127
