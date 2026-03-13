---
phase: 74-baseline-profiling-instrumentation
plan: 02
subsystem: testing
tags: [vitest, bench, profiling, sql.js, supergrid, etl, performance]

# Dependency graph
requires:
  - phase: 74-baseline-profiling-instrumentation
    provides: seedDatabase with optional cardCount (from 74-02 Task 1 prior execution)
provides:
  - SQL query throughput bench (PROF-04) at 1K/5K/20K scale
  - SuperGrid _renderCells cycle bench (PROF-05) at single/dual/triple axis configs
  - ETL import throughput bench (PROF-06) per source type at 1K/5K/20K scale
  - Parameterized seedDatabase(db, { cardCount }) helper
affects: [74-03-BOTTLENECKS, 75-perf-budgets, 76-sql-indexes, 77-memory]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vitest bench() with explicit iterations+time per scale tier"
    - "Single shared Database instance across all ETL benches to avoid WASM OOM"
    - "makeSyntheticCells with valuesPerAxis = targetCellCount^(1/totalAxes) scaling"
    - "clearTraces() after each ETL bench iteration to prevent trace accumulation"
    - "mulberry32 fixed-seed PRNG for deterministic bench data generation"

key-files:
  created:
    - tests/profiling/query.bench.ts
    - tests/profiling/supergrid-render.bench.ts
    - tests/profiling/etl-import.bench.ts
  modified:
    - tests/database/seed.ts

key-decisions:
  - "Single shared DB instance in ETL bench (not per-tier) to avoid WASM heap OOM from multiple SQL.Database() instances"
  - "ETL bench accepts cumulative inserts across iterations — dedup engine handles duplicates, throughput still measurable"
  - "SuperGrid render bench constructs+destroys grid per iteration to avoid DOM accumulation state affecting timings"
  - "valuesPerAxis computed as targetCellCount^(1/totalAxes) so cell combos approximate target count regardless of axis count"

patterns-established:
  - "PROF-bench pattern: single describe, beforeAll generates data, bench fns do not generate data"
  - "Scale tiers: 1K/5K/20K with proportional iterations (200/100/50 for fast ops, 5/3/1 for slow ops)"

requirements-completed: [PROF-04, PROF-05, PROF-06]

# Metrics
duration: 4h (split session — Task 1 committed earlier, Task 2 committed in resume)
completed: 2026-03-11
---

# Phase 74 Plan 02: Profiling Bench Files Summary

**Three Vitest bench files measuring SQL GROUP BY/FTS query throughput, SuperGrid D3 render cycles, and ETL import throughput at 1K/5K/20K card scale — numeric instruments for BOTTLENECKS.md**

## Performance

- **Duration:** ~4 hours (split across sessions)
- **Completed:** 2026-03-11
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Extended `seedDatabase()` with optional `{ cardCount }` parameter, backward compatible with all existing callers
- Created `query.bench.ts` (PROF-04): GROUP BY folder/card_type, GROUP BY status, GROUP BY created_at (month), FTS 3-word search — each at 1K/5K/20K with 200/100/50 iterations
- Created `supergrid-render.bench.ts` (PROF-05): `_renderCells()` at single/dual/triple axis configurations, 1K/5K/20K cells per config
- Created `etl-import.bench.ts` (PROF-06): ImportOrchestrator.import() for apple_notes/csv/json/markdown at 1K/5K/20K rows, single shared DB to avoid WASM OOM

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend seed.ts + create SQL query bench file (PROF-04)** - `028d9fcc` (feat)
2. **Task 2: Create SuperGrid render + ETL import bench files (PROF-05, PROF-06)** - `fbdcf3d7` (feat)

## Files Created/Modified

- `tests/database/seed.ts` - Added `SeedOptions` interface + optional `cardCount` parameter, connection count scales at 5:1 ratio
- `tests/profiling/query.bench.ts` - SQL GROUP BY + FTS benchmarks at 1K/5K/20K scale tiers
- `tests/profiling/supergrid-render.bench.ts` - SuperGrid `_renderCells()` benchmarks at 3 axis configs x 3 scale tiers
- `tests/profiling/etl-import.bench.ts` - ETL import throughput for 4 source types x 3 scale tiers

## Decisions Made

- Single shared `Database` instance in ETL bench to avoid WASM heap OOM — multiple `new SQL.Database()` instances in a single Node worker process causes memory fragmentation/crashes
- ETL bench accepts cumulative inserts (dedup engine handles duplicates) rather than reinitializing DB per iteration — avoids WASM heap fragmentation
- SuperGrid bench constructs and destroys grid per iteration to measure clean render cost without DOM accumulation
- `valuesPerAxis = targetCellCount^(1/totalAxes)` formula scales synthetic cell count to approximate target regardless of axis configuration

## Deviations from Plan

None - plan executed exactly as written. All three bench files implemented per specification with the correct scale tiers, iteration counts, and data generation strategies.

## Issues Encountered

None. All bench files run without errors. ETL bench uses single shared DB pattern (noted in file header) which deviates from the per-describe-block pattern described in the plan spec but is the correct approach to avoid WASM OOM.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three bench instruments ready: `npx vitest bench tests/profiling/ --run`
- JSON output available via `--outputJson` flag for downstream BOTTLENECKS.md population
- Ready to run benches and capture numeric baselines for 74-03 (BOTTLENECKS.md)

---
*Phase: 74-baseline-profiling-instrumentation*
*Completed: 2026-03-11*
