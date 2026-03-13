---
phase: 74-baseline-profiling-instrumentation
plan: 01
subsystem: profiling
tags: [performance, instrumentation, perf-trace, vite-define, worker-bridge, etl, supergrid]

# Dependency graph
requires: []
provides:
  - PerfTrace utility (startTrace/endTrace/getTraces/clearTraces) with __PERF_INSTRUMENTATION__ compile-time gate
  - wb:query:{type} marks on WorkerBridge send + handleResponse round-trips (PROF-01)
  - sg:fetchAndRender + sg:render marks in ViewManager._fetchAndRender (PROF-02)
  - etl:parse, etl:dedup, etl:write, etl:write:batch marks in ImportOrchestrator + SQLiteWriter (PROF-03)
affects: [74-02, 74-03, 74-04, 75, 76, 77, 78]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "__PERF_INSTRUMENTATION__ Vite define constant for zero-cost production builds (defined in vite.config.ts, vite.config.native.ts, vitest.config.ts)"
    - "PerfTrace startTrace/endTrace pattern: places performance.mark({name}:start) / performance.mark({name}:end) + performance.measure(name)"
    - "getTraces(name).at(-1)?.duration pattern for extracting last batch elapsed time"

key-files:
  created:
    - src/profiling/PerfTrace.ts
    - tests/profiling/PerfTrace.test.ts
  modified:
    - src/vite-env.d.ts
    - vite.config.ts
    - vite.config.native.ts
    - vitest.config.ts
    - src/worker/WorkerBridge.ts
    - src/views/ViewManager.ts
    - src/etl/ImportOrchestrator.ts
    - src/etl/SQLiteWriter.ts

key-decisions:
  - "Keep existing Date.now() debug latency logging in WorkerBridge alongside PerfTrace — PerfTrace adds parallel high-res measurement, does not replace console.log"
  - "endTrace on all exit paths of _fetchAndRender (empty, render, and catch branches) prevents orphaned marks"
  - "SQLiteWriter getTraces('etl:write:batch').at(-1)?.duration fallback to 0 preserves existing EMA rate calculation semantics"

patterns-established:
  - "PerfTrace guard pattern: all calls check __PERF_INSTRUMENTATION__ at runtime; Vite tree-shakes to no-ops in production builds"
  - "Trace naming convention: domain:operation[:suboperation] (e.g., wb:query:db:query, sg:fetchAndRender, etl:write:batch)"

requirements-completed: [PROF-01, PROF-02, PROF-03]

# Metrics
duration: 12min
completed: 2026-03-11
---

# Phase 74 Plan 01: PerfTrace Instrumentation Summary

**Unified performance instrumentation layer via `startTrace/endTrace` wrapping `performance.mark/measure` across WorkerBridge, ViewManager, and ETL pipeline — compiles to zero-cost no-ops in production via `__PERF_INSTRUMENTATION__` Vite define**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-11T19:04:00Z
- **Completed:** 2026-03-11T19:16:00Z
- **Tasks:** 2
- **Files modified:** 9 (1 new module, 1 new test file, 7 instrumented)

## Accomplishments

- Created `src/profiling/PerfTrace.ts` with startTrace/endTrace/getTraces/clearTraces guards behind `__PERF_INSTRUMENTATION__`
- Added `__PERF_INSTRUMENTATION__` Vite define to both vite configs + vitest.config, and the global declaration to vite-env.d.ts
- Instrumented all 3 runtime domains: WorkerBridge round-trips (`wb:query:{type}`), ViewManager render cycle (`sg:fetchAndRender`, `sg:render`), ETL pipeline (`etl:parse`, `etl:dedup`, `etl:write`, `etl:write:batch`)
- Migrated SQLiteWriter batch timing from raw `performance.now()` to PerfTrace — `getTraces('etl:write:batch').at(-1)?.duration` feeds the existing EMA rate calculation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create PerfTrace utility + Vite define constant** - `eb7aaf96` (feat)
2. **Task 2: Instrument WorkerBridge, ViewManager, ImportOrchestrator, SQLiteWriter** - `1ed321a4` (feat)

## Files Created/Modified

- `src/profiling/PerfTrace.ts` - New module: startTrace/endTrace/getTraces/clearTraces with __PERF_INSTRUMENTATION__ guard
- `tests/profiling/PerfTrace.test.ts` - 6 unit tests covering happy path, multi-trace accumulation, name isolation, clearTraces, entry shape
- `src/vite-env.d.ts` - Added `declare const __PERF_INSTRUMENTATION__: boolean`
- `vite.config.ts` - Added `define: { __PERF_INSTRUMENTATION__ }` block
- `vite.config.native.ts` - Added `define: { __PERF_INSTRUMENTATION__ }` block
- `vitest.config.ts` - Added `define: { __PERF_INSTRUMENTATION__ }` block (NODE_ENV !== 'production' = true in tests)
- `src/worker/WorkerBridge.ts` - wb:query:{type} marks on send and handleResponse (PROF-01)
- `src/views/ViewManager.ts` - sg:fetchAndRender + sg:render marks in _fetchAndRender (PROF-02)
- `src/etl/ImportOrchestrator.ts` - etl:parse, etl:dedup, etl:write marks on pipeline stages (PROF-03)
- `src/etl/SQLiteWriter.ts` - etl:write:batch marks replace raw performance.now() (PROF-03)

## Decisions Made

- Kept existing `Date.now()` debug logging in WorkerBridge alongside PerfTrace — the two are complementary (console.log for ad-hoc debugging, PerfTrace for structured batch analysis)
- Added `endTrace('sg:fetchAndRender')` on all three exit paths of `_fetchAndRender` (empty-state, render-success, and catch branches) to prevent orphaned :start marks from accumulating
- Used `getTraces('etl:write:batch').at(-1)?.duration ?? 0` pattern in SQLiteWriter to preserve the existing EMA rate calculation semantics with zero behavioral change

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- PerfTrace instrumentation is live and collecting `PerformanceEntry` measures at all 3 runtime domains
- Bench harness (74-02) can now call `getTraces()` to read accumulated measures after warm-up runs
- BOTTLENECKS.md authoring (74-03) depends on bench data from 74-02

---
*Phase: 74-baseline-profiling-instrumentation*
*Completed: 2026-03-11*
