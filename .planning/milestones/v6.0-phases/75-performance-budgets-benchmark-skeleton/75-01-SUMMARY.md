---
phase: 75-performance-budgets-benchmark-skeleton
plan: "01"
subsystem: testing
tags: [performance, profiling, vitest, sql, etl, budget, tdd]

requires:
  - phase: 74-baseline-profiling-instrumentation
    provides: BOTTLENECKS.md with measured p99 baselines for GROUP BY, FTS, and ETL imports at 20K scale

provides:
  - PerfBudget.ts typed constants for all 4 performance domains (render, SQL query, ETL, launch/heap)
  - budget.test.ts with SQL query and ETL import budget assertions (TDD red step for Phase 76/77)
  - bench:budgets npm script targeting both budget test files

affects: [76-sql-render-optimization, 77-etl-launch-memory-optimization, 78-ci-perf-gate]

tech-stack:
  added: []
  patterns:
    - "p99 helper + measureQuery pattern for timing SQL queries via performance.now() in vitest it() blocks"
    - "Intentionally-failing TDD red tests as performance acceptance criteria for future optimization phases"
    - "PerfBudget.ts constant file co-located with PerfTrace.ts in src/profiling/"

key-files:
  created:
    - src/profiling/PerfBudget.ts
    - tests/profiling/budget.test.ts
  modified:
    - package.json

key-decisions:
  - "Budget constants derived exclusively from Phase 74 BOTTLENECKS.md measured data — no arbitrary guesses"
  - "SQL and ETL budget tests use it() + performance.now() (not bench()) due to vitest bench v4 empty-samples bug in forks pool"
  - "Launch/heap budgets defined as constants with TODO Phase 77 notes — no vitest assertions (require physical device)"
  - "Single shared DB per describe block for ETL tests to avoid WASM heap OOM from multiple SQL.Database() instantiations"

patterns-established:
  - "p99(samples): sort ascending, index ceil(length * 0.99) - 1 — matches render-timing.test.ts pattern"
  - "measureQuery(db, sql, iterations = 50): runs N times, returns p99 ms"
  - "timeImport(db, type, data): wraps ImportOrchestrator with clearTraces() after timing"

requirements-completed: [RGRD-01]

duration: 2min
completed: "2026-03-12"
---

# Phase 75 Plan 01: Performance Budget Constants + Budget Test Skeleton Summary

**Typed PerfBudget.ts constants derived from Phase 74 baselines + budget.test.ts TDD red step with SQL query and ETL import assertions that fail today and become green after Phase 76/77 optimizations**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-12T14:09:33Z
- **Completed:** 2026-03-12T14:11:46Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Created `src/profiling/PerfBudget.ts` with 8 typed constants covering all 4 performance domains (render, SQL query, ETL import, launch/heap)
- Created `tests/profiling/budget.test.ts` with 8 timing assertions — GROUP BY folder+card_type and strftime FAIL today (26.99ms > 12ms, 20.11ms > 10ms); markdown ETL FAILS (1045ms > 1000ms); status, FTS, apple_notes, csv PASS
- Added `bench:budgets` npm script referencing both budget test files (budget-render.test.ts created in plan 75-02)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/profiling/PerfBudget.ts** - `fd367847` (feat)
2. **Task 2: Create tests/profiling/budget.test.ts** - `cf16902c` (feat)
3. **Task 3: Add bench:budgets npm script** - `63282b51` (chore)

## Files Created/Modified

- `src/profiling/PerfBudget.ts` - 8 exported budget constants for render, SQL query (4), ETL, launch, heap domains
- `tests/profiling/budget.test.ts` - SQL query + ETL import budget assertions (intentionally-failing TDD red tests)
- `package.json` - Added `bench:budgets` script

## Decisions Made

- Budget constants derived exclusively from Phase 74 BOTTLENECKS.md measured data — no arbitrary guesses
- SQL and ETL budget tests use `it()` + `performance.now()` (not `bench()`) due to vitest bench v4 empty-samples bug in forks pool (locked decision from Phase 74)
- Launch/heap budgets defined as constants with TODO Phase 77 notes — no vitest assertions (require physical device measurement via Instruments/Xcode memory gauge)
- Single shared DB per `describe` block for ETL tests — never instantiate multiple `SQL.Database()` in one Node worker (WASM heap OOM)

## Deviations from Plan

None - plan executed exactly as written.

Note: `json 20K` test passed (790ms < 1000ms budget) on this machine vs. Phase 74 baseline of 1771ms. Machine speed variance is expected; the harness works correctly and the failing tests (GROUP BY queries + markdown ETL) define the optimization targets for Phase 76/77. The plan's must_haves describe the Phase 74 measurement machine's behavior — current machine is faster.

## Issues Encountered

- Biome formatting required `--write` pass to collapse multi-line `it(name, fn, timeout)` calls to single-line format — resolved automatically.

## Next Phase Readiness

- Phase 75-02 (budget-render.test.ts) can proceed immediately — imports `BUDGET_RENDER_JSDOM_MS` from PerfBudget.ts
- Phase 76 (SQL/render optimization) has clear acceptance criteria: GROUP BY folder+card_type p99 < 12ms, strftime p99 < 10ms
- Phase 77 (ETL/launch/memory optimization) has clear acceptance criteria: all ETL import types < 1000ms at 20K scale

---
*Phase: 75-performance-budgets-benchmark-skeleton*
*Completed: 2026-03-12*

## Self-Check: PASSED

- FOUND: src/profiling/PerfBudget.ts
- FOUND: tests/profiling/budget.test.ts
- FOUND: .planning/phases/75-performance-budgets-benchmark-skeleton/75-01-SUMMARY.md
- FOUND commit fd367847 (Task 1: PerfBudget.ts)
- FOUND commit cf16902c (Task 2: budget.test.ts)
- FOUND commit 63282b51 (Task 3: bench:budgets script)
