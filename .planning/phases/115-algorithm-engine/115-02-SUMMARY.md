---
phase: 115-algorithm-engine
plan: 02
subsystem: testing
tags: [graphology, betweenness-centrality, performance-benchmark, sqrt-sampling, vitest-bench]

# Dependency graph
requires:
  - phase: 115-01
    provides: handleGraphCompute with sqrt(n)-pivot betweenness centrality implementation
provides:
  - Performance benchmark validating betweenness centrality at n=2000 within 2-second budget
  - vitest bench.ts include glob enabling bench files to run via vitest run
affects: [116-schema-integration, 117-network-view, ci-bench-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bench-as-test: use it() with performance.now() assertions in .bench.ts files for hard-budget validation"
    - "Erdos-Renyi graph seeding: stride-based deterministic topology for reproducible benchmark graphs"

key-files:
  created:
    - tests/worker/graph-algorithms.bench.ts
  modified:
    - vitest.config.ts

key-decisions:
  - "Used it() with performance.now() instead of bench() — single-pass wall-clock measurement sufficient to confirm sqrt(n) sampling activates; bench() repeated iterations would inflate total suite time without additional signal"
  - "Added **/*.bench.[jt]s to vitest include glob (Rule 3 auto-fix) — required for npx vitest run to discover .bench.ts files without the standard .test.ts extension"
  - "Stride-based graph topology (step = prime offsets 7, 113) for deterministic connectivity without seeded RNG — avoids need for external seeding utility"

patterns-established:
  - "Performance budget assertions: DURATION_BUDGET_MS constant + expect(durationMs).toBeLessThan() pattern for hard budget tests"
  - "Bench file setup: 120s beforeAll timeout for large graph generation (2000 cards + 6000 connections)"

requirements-completed: [ALGO-02]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 115 Plan 02: Algorithm Engine — Benchmark Summary

**Betweenness centrality at n=2000 performance benchmark confirming sqrt(n)-pivot sampling completes in under 2 seconds (~1180ms observed)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T21:49:26Z
- **Completed:** 2026-03-22T21:51:35Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `tests/worker/graph-algorithms.bench.ts` with 2000-node Erdos-Renyi graph benchmark
- Confirmed sqrt(n)-pivot sampling activates at n=2000 and keeps betweenness centrality within 2-second budget (observed: ~1180ms)
- Added `**/*.bench.[jt]s` to vitest include glob to enable `vitest run` to discover `.bench.ts` files

## Task Commits

Each task was committed atomically:

1. **Task 1: Create betweenness centrality performance benchmark at n=2000** - `a40bc52f` (feat)

## Files Created/Modified

- `tests/worker/graph-algorithms.bench.ts` - 2000-node betweenness centrality performance benchmark with hard 2s budget assertion
- `vitest.config.ts` - Added `**/*.bench.[jt]s` to include glob (Rule 3 auto-fix for benchmark discoverability)

## Decisions Made

- Used `it()` with `performance.now()` assertions rather than `bench()` — the goal is validating a one-time budget threshold, not measuring iteration statistics. A single warm pass is sufficient to confirm the sqrt(n) heuristic activates.
- Stride-based graph generation (offsets 7, 113) avoids clustering artifacts while remaining fully deterministic without external seeding utilities.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added .bench.ts to vitest include glob**
- **Found during:** Task 1 (running verification command)
- **Issue:** Vitest default include glob `**/*.{test,spec}.*.ts` does not match `.bench.ts` extension; `npx vitest run tests/worker/graph-algorithms.bench.ts` returned "No test files found"
- **Fix:** Added `'**/*.bench.[jt]s'` to `test.include` array in `vitest.config.ts`
- **Files modified:** `vitest.config.ts`
- **Verification:** `npx vitest run tests/worker/graph-algorithms.bench.ts` now finds and runs the file; both tests pass
- **Committed in:** `a40bc52f` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the plan's verification command to work. No scope creep — vitest config change is minimal and consistent with how other bench files are structured.

## Issues Encountered

None — benchmark ran cleanly on first attempt. Observed centrality duration ~1180ms at n=2000 confirms sqrt(n) sampling is well within the 2-second budget with ~820ms headroom.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ALGO-02 benchmark is in place as a regression guard for the betweenness centrality heuristic
- Phase 116 (Schema Integration) can proceed — all Phase 115 requirements satisfied
- The `.bench.[jt]s` vitest include glob also enables future bench files to be run via `vitest run` without additional config changes

---
*Phase: 115-algorithm-engine*
*Completed: 2026-03-22*
