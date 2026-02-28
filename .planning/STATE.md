---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Web Runtime
status: unknown
last_updated: "2026-02-28T20:27:13.806Z"
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 7
  completed_plans: 5
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 4 — Providers + MutationManager

## Current Position

```
[Phase 3] [Phase 4] [Phase 5] [Phase 6] [Phase 7]
             |
             v (active — Plans 01-04 of 10 complete)
```

Phase: 4 (04-providers-mutationmanager)
Plan: 05 complete → Plan 06 next
Status: Plans 04-01..04-05 complete — FilterProvider, PAFVProvider, DensityProvider, SelectionProvider, StateCoordinator, QueryBuilder, StateManager delivered
Last activity: 2026-02-28 — 04-05 (QueryBuilder + StateManager) complete

## Performance Metrics

| Metric | v0.1 Result | v1.0 Target |
|--------|-------------|-------------|
| Tests passing | 151 | TBD |
| TypeScript LOC | 3,378 | TBD |
| Insert p99 | <10ms | — |
| FTS p99 | <100ms | — |
| Graph traversal p99 | <500ms | — |
| Render p95 (100 cards) | — | <16ms |
| Phase 04-providers-mutationmanager P04 | 4 | 2 tasks | 5 files |
| Phase 04-providers-mutationmanager P03 | 3 | 2 tasks | 4 files |
| Phase 04-providers-mutationmanager P02 | 2 | 2 tasks | 5 files |
| Phase 04-providers-mutationmanager P01 | 5 | 2 tasks | 6 files |
| Phase 04-providers-mutationmanager P05 | 4 | 2 tasks | 6 files |

## Accumulated Context

### Decisions

All architectural decisions locked in PROJECT.md / CLAUDE-v5.md:
- D-001..D-010: Final, not re-opened
- TDD enforcement: Red-green-refactor for every feature, non-negotiable
- Custom FTS5 WASM: Emscripten build complete (sql.js 1.14, 756KB)
- withStatement pattern: Stubbed in Phase 2 (throws); implement in Phase 3
- db.exec()/db.run(): Used in v0.1; Worker query modules reuse these directly
- D3 key function: Mandatory on every .data() call from Phase 5 first view forward — cannot be retrofitted
- [Phase 04-providers-mutationmanager]: Used db.exec('SELECT changes()') after db.run() for row-change count in handleDbExec — Database class does not expose getRowsModified() directly
- [Phase 04-providers-mutationmanager]: INSERT OR REPLACE with explicit strftime updated_at in handleUiSet — schema DEFAULT only fires on INSERT, not REPLACE
- [Phase 04-providers-mutationmanager]: FilterProvider validates field/operator at both addFilter() and compile() — double validation handles JSON-restored state
- [Phase 04-providers-mutationmanager]: Error messages start with 'SQL safety violation:' for grep-ability — established as standard across all providers
- [Phase 04-providers-mutationmanager 04-03]: PAFVProvider suspends state via structuredClone when crossing LATCH/GRAPH family boundary — prevents reference aliasing
- [Phase 04-providers-mutationmanager 04-03]: VIEW_DEFAULTS map per view type: kanban defaults to groupBy status; all others default to null axes
- [Phase 04-providers-mutationmanager 04-03]: DensityProvider setState validates timeField+granularity eagerly; PAFVProvider defers axis validation to compile()
- [Phase 04-providers-mutationmanager 04-04]: SelectionProvider is Tier 3 — no toJSON/setState/resetToDefaults; omission is intentional (D-005/PROV-05)
- [Phase 04-providers-mutationmanager 04-04]: Two-tier batching: providers queueMicrotask (self-notify), StateCoordinator setTimeout(16) (cross-provider — fires after all microtasks drain)
- [Phase 04-providers-mutationmanager 04-04]: range(id, allIds) takes ordered list as parameter — Phase 5 views pass their current sorted card list
- [Phase 04-providers-mutationmanager 04-05]: QueryBuilder: buildGroupedQuery() prefers axis.groupBy over density.groupExpr when both are non-empty
- [Phase 04-providers-mutationmanager 04-05]: WorkerBridge.send() made public so StateManager/MutationManager can call bridge.send() directly for ui:* and db:* operations
- [Phase 04-providers-mutationmanager 04-05]: StateManager.restore() skips providers with no stored key (leaves at defaults) — correct behavior for fresh installs

### Dependencies to Add (Phase 3 setup)

- `d3@7.9.0` — runtime
- `@types/d3@7.4.3` — dev
- `@vitest/web-worker@4.0.18` — dev (must match installed Vitest version exactly)
- tsconfig.json: add `"WebWorker"` to `lib` array

### Pending Todos

- Plan Phase 3 (Worker Bridge) before starting implementation
- Research flag: Phase 7 (SuperGrid SuperStack algorithm + graph algorithm sourcing) needs `gsd:research-phase` before planning

### Blockers/Concerns

- WKWebView WASM MIME type rejection: wasm-compat.ts spike exists; validate in real WKWebView during Phase 3 — Vite dev server masks this entirely
- SuperGrid SuperStack header spanning: no documented D3 analogue; needs research spike before Phase 7 planning
- Graph algorithm implementations (PageRank, Louvain): must be zero-DOM-dependency for Worker context; source at Phase 7 planning time

### Phase 3 Entry State

- v0.1 complete: 3,378 LOC, 151 tests, all 4 perf thresholds pass
- Worker Bridge spec: CLAUDE-v5.md D-002, v5/Modules/Core/WorkerBridge.md (canonical)
- Existing query modules to reuse: src/database/queries/ (cards, connections, search, graph)
- withStatement stub: currently throws in Phase 2; needs Database.prepare() in Phase 3

## Session Continuity

Last session: 2026-02-28T20:25:57Z
Stopped at: Completed 04-providers-mutationmanager/04-05-PLAN.md — QueryBuilder + StateManager (258 provider tests passing)
Resume: Run `gsd:execute-phase 04-providers-mutationmanager 06` for MutationManager
