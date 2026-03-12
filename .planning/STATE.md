---
gsd_state_version: 1.0
milestone: v6.0
milestone_name: Performance
status: unknown
last_updated: "2026-03-12T15:55:26.242Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 8
  completed_plans: 8
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-11)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v6.0 Performance -- Phase 74: Baseline Profiling + Instrumentation

## Current Position

Phase: 76 of 78 (Render Optimization)
Plan: 02 complete (2 of N plans)
Status: In progress
Last activity: 2026-03-12 -- Completed 76-02 (payload truncation + supergrid:cell-detail + virtualizer validation)

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
- [Phase 75]: budget-render.test.ts intentionally has 2 failing tests (dual/triple axis) — TDD red step for Phase 76 render optimization
- [Phase 75]: .benchmarks/main.json uses hand-authored schema committed to repo for Phase 78 CI regression baseline (not vitest reporter — bench() empty-samples bug)
- [Phase 76-render-optimization]: 76-01: Composite idx_cards_sg_folder_type triggers USING COVERING INDEX, eliminating TEMP B-TREE for folder+card_type GROUP BY
- [Phase 76-render-optimization]: 76-01: usesIndex() helper accepts both USING INDEX and USING COVERING INDEX — SQLite emits COVERING INDEX when all projected columns fit in the index
- [Phase 76-render-optimization]: 76-01: All 6 expression indexes confirmed via EXPLAIN QUERY PLAN; quarter complex expression activates despite compound formula
- [Phase 76-render-optimization]: card_names truncated in parallel with card_ids (both capped at 50) — parallel arrays must align for CellDatum integrity
- [Phase 76-render-optimization]: VIRTUALIZATION_THRESHOLD=100 confirmed correct — dual-axis PAFV leaf rows are ~5 at 20K cards; cell payload truncation is the right fix
- [Phase 76-render-optimization]: OVERSCAN_ROWS=5 confirmed — 140px scroll buffer at 28px row height; jsdom cannot measure flicker for further tuning

### Blockers/Concerns

- Phase 76 SQL index work: RESOLVED — 6 indexes confirmed via EXPLAIN QUERY PLAN, SQL budgets pass in isolation
- Phase 77 memory work requires physical device testing -- simulator does not accurately represent WKWebView content process memory budget
- Benchmark CI variance calibration needed before promoting bench job from continue-on-error to enforced gate
- SQL budget tests fail in full-suite parallel runs due to CPU contention — pre-existing, not a Phase 76 regression

## Session Continuity

Last session: 2026-03-12
Stopped at: Completed 76-02-PLAN.md (payload truncation + supergrid:cell-detail + virtualizer validation)
Resume: Continue Phase 76 with next plan (76-03 if exists, else Phase 77)
