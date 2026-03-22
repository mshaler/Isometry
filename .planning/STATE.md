---
gsd_state_version: 1.0
milestone: v8.5
milestone_name: ETL E2E Test Suite
status: Roadmap created
stopped_at: Completed 114-02-PLAN.md
last_updated: "2026-03-22T09:42:53.004Z"
last_activity: 2026-03-22 -- v9.0 roadmap created (phases 114-118)
progress:
  total_phases: 10
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v9.0 Graph Algorithms

## Current Position

Phase: Not started (roadmap created, awaiting v8.5 completion)
Plan: --
Status: Roadmap created
Last activity: 2026-03-22 -- v9.0 roadmap created (phases 114-118)

Progress: [░░░░░░░░░░] 0%

## Milestone History

- ✅ v8.0 SuperGrid Redesign: Phases 97-100 complete (4 phases, 7 plans, 14 plugins shipped)
- ✅ v8.1 Plugin Registry Complete: Phases 101-102 complete (2 phases, 6 plans, all 27 plugins wired)
- ✅ v8.2 SuperCalc v2: Phase 103 complete (1 phase, 2 plans, NullMode/CountMode/AggResult)
- ✅ v8.3 Plugin E2E Test Suite: Phases 104-107 complete (4 phases, 8 plans, 20 reqs, CI hard gate)
- ✅ v8.4 Consolidate View Navigation: Phase 108 complete (1 phase, 2 plans, ViewZipper removed)
- 🚧 v8.5 ETL E2E Test Suite: Phases 109-113 in progress (0/5 phases)

## v9.0 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 114 | Storage Foundation | GFND-01, GFND-02, GFND-03 | Not started |
| 115 | Algorithm Engine | ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05, ALGO-06 | Not started |
| 116 | Schema Integration | PAFV-01, PAFV-02, PAFV-03, CTRL-01, CTRL-02 | Not started |
| 117 | NetworkView Enhancement | NETV-01, NETV-02, NETV-03, NETV-04, NETV-05 | Not started |
| 118 | Polish + E2E | GFND-04, PAFV-04, CTRL-03, CTRL-04 | Not started |

## Performance Metrics

**Velocity:**
- v8.4 milestone: 1 phase, 2 plans
- v8.3 milestone: 4 phases, 8 plans
- v8.2 milestone: 1 phase, 2 plans
- v8.1 milestone: 2 phases, 6 plans
- v8.0 milestone: 4 phases, 7 plans

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

**v9.0 design decisions (from research):**
- graphology 0.26.0 + graphology-shortest-path + graphology-metrics + graphology-communities-louvain for 5 of 6 algorithms; custom Kruskal's ~50 LOC for MST
- All algorithm computation runs inside the Worker; graphology Graph object never crosses postMessage
- graph_metrics sql.js table is the sole persistence and query layer for algorithm results (no JS-side Maps)
- Dual-circle overlay pattern for NetworkView: base circle retains source-provenance fill; .algorithm-overlay circle carries algorithm color
- Betweenness centrality uses √n-pivot sampling when nodes > 2000 (O(n*m) blocked at 10K+)
- Monotonically incrementing currentRenderToken stamps each algorithm request; stale responses discarded
- Louvain tests use seeded RNG ({ rng: () => 0.5 }); assert community membership invariants, never specific IDs
- [Phase 109-etl-test-infrastructure]: CanonicalCard interface duplicated in e2e/helpers/etl.ts rather than imported from src/ to keep E2E helpers self-contained
- [Phase 109-etl-test-infrastructure]: queryAll/exec exposed on window.__isometry with no debug flag gating - __isometry namespace is already dev/debug-only
- [Phase 109-etl-test-infrastructure]: mockPermission uses window.__mock_permission_{adapter} key convention; revoked deletes key
- [Phase 109]: Programmatic JSDOM requires global.document + global.Event injection; global.document alone is insufficient when tests dispatch Event objects
- [Phase 114-storage-foundation]: graph_metrics table uses INSERT OR REPLACE for idempotent upsert; sanitizeAlgorithmResult returns shallow copy to avoid mutation; computed_at optional on input, supplied by writeGraphMetrics
- [Phase 114]: Named { UndirectedGraph } import required from graphology — default export is Graph (mixed), not UndirectedGraph

### Research Flags

- Phase 116 (SuperGridQuery LEFT JOIN): Verify current SuperGridQuery SELECT/GROUP BY builder before planning -- may need a `metricsColumns: Set<string>` parameter
- Phase 117 (NetworkView dual-circle): Verify D3 enter/update/exit key function approach with second .algorithm-overlay circle before finalizing requirements

### Blockers/Concerns

None. Awaiting v8.5 completion before beginning Phase 114.

## Session Continuity

Last session: 2026-03-22T09:42:53.000Z
Stopped at: Completed 114-02-PLAN.md
Resume: Begin with /gsd:plan-phase 114 after v8.5 ships
