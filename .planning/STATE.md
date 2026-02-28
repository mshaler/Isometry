---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: Web Runtime
status: active
last_updated: "2026-02-28T21:28:30Z"
progress:
  total_phases: 5
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-28)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 5 — Core D3 Views + Transitions

## Current Position

```
[Phase 3] [Phase 4] [Phase 5] [Phase 6] [Phase 7]
                        |
                        v (active — Plan 02 of 4 complete)
```

Phase: 5 (05-core-d3-views-transitions) — IN PROGRESS
Plan: 02 complete → ListView (SVG single-column + sort), GridView (responsive grid)
Status: Plan 02 complete — ListView and GridView implement IView, 715 tests passing
Last activity: 2026-02-28 — 05-02 (ListView + GridView) complete

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
| Phase 04-providers-mutationmanager P06 | 6 | 2 tasks | 8 files |
| Phase 04-providers-mutationmanager P07 | 275 | 2 tasks | 7 files |
| Phase 05-core-d3-views-transitions P01 | 5 | 2 tasks | 8 files |
| Phase 05-core-d3-views-transitions P02 | 4 | 2 tasks | 4 files |

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
- [Phase 04-providers-mutationmanager]: WorkerBridge.exec() public method added as bridge for MutationManager — keeps send() private while giving typed db:exec access
- [Phase 04-providers-mutationmanager]: MutationBridge interface extracted from MutationManager — decouples from WorkerBridge concrete class for clean test mocking
- [Phase 04-providers-mutationmanager]: batchMutation pre-reverses inverse array at creation time — undo() iterates inverse[] in order, no reversal needed in MutationManager
- [Phase 04-providers-mutationmanager]: setupMutationShortcuts reads navigator.platform at call time, not module load, to allow vi.stubGlobal() overrides in tests
- [Phase 04-providers-mutationmanager]: SQL injection double-validation tests use _filters direct access to bypass addFilter() and prove compile() is the second line of defence
- [Phase 05-core-d3-views-transitions 05-01]: jsdom installed as dev dependency — vitest default is node environment; ViewManager tests require DOM APIs via @vitest-environment jsdom directive
- [Phase 05-core-d3-views-transitions 05-01]: WorkerBridgeLike and PAFVProviderLike minimal interfaces extracted in types.ts — decouples ViewManager from concrete implementations for clean test mocking (matching MutationBridge pattern)
- [Phase 05-core-d3-views-transitions 05-01]: ViewManager.switchTo() teardown ordering: unsubscribe coordinator first, cancel loading timer, then destroy view — prevents coordinator firing into a half-torn-down view
- [Phase 05-core-d3-views-transitions 05-01]: Loading spinner uses .is-visible CSS class toggle rather than inline style — allows CSS layer to override if needed
- [Phase 05-core-d3-views-transitions 05-02]: D3 .transition() on 'transform' attr crashes jsdom via parseSvg in d3-interpolate — set transform directly with .attr(); use transition only for opacity
- [Phase 05-core-d3-views-transitions 05-02]: GridView.render() reads container.clientWidth at call time — tests use Object.defineProperty(container, 'clientWidth', { configurable: true, value: N })
- [Phase 05-core-d3-views-transitions 05-02]: exit uses .remove() synchronously — avoids async RAF jsdom issues with D3 opacity-then-remove transition chains

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

Last session: 2026-02-28T21:28:30Z
Stopped at: Completed 05-core-d3-views-transitions/05-02-PLAN.md — ListView (SVG single-column + sort toolbar), GridView (responsive grid), 715 tests passing
Resume: Phase 5 Plan 02 complete. Continue with `gsd:execute-phase 05` for remaining Phase 5 plans (KanbanView, transitions)
