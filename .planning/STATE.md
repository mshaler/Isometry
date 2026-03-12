---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Performance
status: unknown
last_updated: "2026-03-12T04:04:38.479Z"
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 3
  completed_plans: 3
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v6.0 Performance -- Phase 74: Baseline Profiling + Instrumentation

## Current Position

Phase: 75 of 78 (Performance Budgets + Benchmark Skeleton)
Plan: 01 complete (1 of N plans)
Status: In progress
Last activity: 2026-03-12 -- Completed 75-01 (PerfBudget.ts constants + budget.test.ts TDD red step)

Progress: [█░░░░░░░░░] 10%

## Performance Metrics

**Velocity:**
- v5.3 milestone: 5 phases, 12 plans in 1 day
- v5.2 milestone: 7 phases, 13 plans in 2 days
- v5.1 milestone: 4 phases, 7 plans in 1 day
- v5.0 milestone: 4 phases, 11 plans in 1 day

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.
- 74-01: __PERF_INSTRUMENTATION__ Vite define guards PerfTrace calls — zero production overhead via tree-shaking
- 74-01: Trace naming convention: domain:operation[:suboperation] (wb:query:{type}, sg:fetchAndRender, etl:write:batch)
- 74-01: SQLiteWriter uses getTraces('etl:write:batch').at(-1)?.duration ?? 0 to preserve existing EMA rate semantics
- 74-02: Single shared DB instance in ETL bench to avoid WASM heap OOM from multiple SQL.Database() instantiations in one Node worker
- 74-02: valuesPerAxis = targetCellCount^(1/totalAxes) — scales synthetic cell combos to target count independent of axis configuration
- 74-03: vitest bench v4 forks pool returns empty samples in --run mode; use it() + performance.now() for timing measurement instead
- 74-03: papaparse ESM interop fails in tsx; CSV timing requires vitest environment where Vite handles UMD→ESM interop
- 74-03: rollup-plugin-visualizer open:false prevents browser auto-open in headless/CI runs
- Phase 74 is a hard gate -- no optimization code ships until ranked bottleneck list with numeric evidence exists
- Phase 75 budgets must be derived from Phase 74 measured data, not preset guesses (TDD red step for perf)
- Phases 76 and 77 depend on Phase 75 (failing tests define the work); they are independent of each other
- Phase 78 depends on both 76 and 77 (CI gate requires post-optimization actual measurements)
- CI bench job uses relative baselines only -- absolute ms thresholds banned due to runner variance (±30-40%)
- Never call db.close() + new SQL.Database() within an existing Worker lifetime (WASM heap fragmentation)
- All render triggers route through StateCoordinator -- direct viewManager.render() calls bypass rAF coalescer
- 75-01: PerfBudget.ts constants derived exclusively from Phase 74 BOTTLENECKS.md measured data -- no arbitrary guesses
- 75-01: SQL/ETL budget tests use it() + performance.now() (not bench()) -- vitest bench v4 empty-samples bug in forks pool
- 75-01: Launch/heap budgets defined as constants only, no vitest assertions -- require physical device measurement (Phase 77)
- 75-01: p99 helper pattern: sort ascending, ceil(length * 0.99) - 1 index -- matches render-timing.test.ts

### Blockers/Concerns

- Phase 76 SQL index work requires EXPLAIN QUERY PLAN on actual 20K-card GROUP BY queries -- index candidates hypothesized but not yet confirmed
- Phase 77 memory work requires physical device testing -- simulator does not accurately represent WKWebView content process memory budget
- Benchmark CI variance calibration needed before promoting bench job from continue-on-error to enforced gate

## Session Continuity

Last session: 2026-03-12
Stopped at: Completed 75-01-PLAN.md (PerfBudget constants + budget.test.ts TDD red step)
Resume: Continue Phase 75 with next plan (75-02 budget-render.test.ts)
