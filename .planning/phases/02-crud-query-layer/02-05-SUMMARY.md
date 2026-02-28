---
phase: 02-crud-query-layer
plan: 05
subsystem: database
tags: [sql.js, sqlite, vitest, bench, fts5, performance, tdd, seeding]

# Dependency graph
requires:
  - phase: 02-crud-query-layer
    plan: 01
    provides: createCard for PERF-01 and PERF-02 benchmarks
  - phase: 02-crud-query-layer
    plan: 03
    provides: searchCards for PERF-03 FTS benchmark
  - phase: 02-crud-query-layer
    plan: 04
    provides: connectedCards for PERF-04 graph traversal benchmark

provides:
  - "seedDatabase(): reusable 10K-card / 50K-connection database seeding utility"
  - "SEED_CONFIG: configuration constants for benchmark dataset"
  - "performance.bench.ts: Vitest bench() suite with p99 reporting for all 4 PERF requirements"
  - "performance-assertions.test.ts: automated pass/fail p95 enforcement gate for CI"

affects: [Phase 3 providers, future performance regression testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seed once, benchmark many: seedDatabase() called in beforeAll, reused across all bench/assert iterations"
    - "p99 as conservative p95 proxy: tinybench exposes p99 not p95; if p99 < threshold then p95 necessarily passes"
    - "Dual verification: bench() for human-readable reporting + assertion test for automated CI gate"
    - "BEGIN/COMMIT batching for bulk seed inserts (cards then connections separately)"
    - "INSERT OR IGNORE for connection seeding to handle UNIQUE constraint collisions without crashing"

key-files:
  created:
    - tests/database/seed.ts
    - tests/database/seed.test.ts
    - tests/database/performance.bench.ts
    - tests/database/performance-assertions.test.ts
  modified: []

key-decisions:
  - "p99 used as conservative proxy for p95 in bench() output — tinybench does not expose p95 (p95 <= p99 by definition, so p99 < threshold implies p95 < threshold)"
  - "Dual file approach: bench() for human reporting, assertion test for CI enforcement — Vitest bench() does not support programmatic assertions on percentile values"
  - "Hub card seeded with 200 direct connections to ensure rich graph topology for PERF-04 traversal"
  - "INSERT OR IGNORE on connections to handle UNIQUE(source_id, target_id, via_card_id, label) collisions silently"
  - "it() timeout as 2nd arg (not describe() 3rd arg) — Vitest 4 removed describe(name, fn, {timeout}) signature"

patterns-established:
  - "Performance test pattern: seed once in beforeAll, time many iterations, compute p95 from sorted samples"
  - "computeP95(samples): sort array, take index ceil(0.95 * n) - 1 for the 95th percentile value"

requirements-completed: [PERF-01, PERF-02, PERF-03, PERF-04]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 2 Plan 05: Performance Benchmarks Summary

**Vitest bench() + p95 assertion tests validating all 4 PERF thresholds on a seeded 10K-card / 50K-connection sql.js database**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T11:10:16Z
- **Completed:** 2026-02-28T11:13:46Z
- **Tasks:** 2 (TDD seed utility + benchmark suite)
- **Files modified:** 4

## Accomplishments

- Implemented `seedDatabase()` seeding 10K cards + 50K connections in ~1.9s using batched transactions
- Created `performance.bench.ts` with Vitest bench() suite for all 4 PERF requirements (PERF-01..04)
- Created `performance-assertions.test.ts` providing automated pass/fail enforcement using p95 calculation
- All 4 PERF thresholds verified: PERF-01 (<10ms), PERF-02 (<1s), PERF-03 (<100ms), PERF-04 (<500ms)
- 151/151 total tests passing across all Phase 1 and Phase 2 modules

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for seed utility** - `a98eaa9` (test)
2. **Task 1 GREEN: seedDatabase() implementation** - `74addab` (feat)
3. **Task 2: Performance benchmark suite and assertion tests** - `b106e7b` (feat)

_TDD execution for Task 1: RED (16 failing tests committed) then GREEN (implementation committed)_

## Files Created/Modified

- `tests/database/seed.ts` - Reusable seeding utility: seedDatabase() + SEED_CONFIG + SeedResult interface
- `tests/database/seed.test.ts` - 16 TDD tests for seed API contract (SEED_CONFIG shape, card/connection counts, variety)
- `tests/database/performance.bench.ts` - Vitest bench() suite with p99 reporting for PERF-01..04
- `tests/database/performance-assertions.test.ts` - Automated p95 assertion tests for all 4 PERF thresholds

## Decisions Made

- **p99 as p95 proxy:** tinybench (Vitest's bench engine) exposes p75, p99, p995, p999 but not p95. p99 < threshold conservatively implies p95 < threshold since p95 <= p99 by definition.
- **Dual-file approach:** bench() for human-readable percentile tables (useful during development), assertion test for automated CI gate. Vitest bench() does not support `expect()` assertions on percentile values.
- **Hub card with 200 connections:** cardIds[0] receives 200 direct outgoing connections before random seeding, ensuring a rich graph topology for the PERF-04 traversal benchmark.
- **INSERT OR IGNORE for connections:** The schema has `UNIQUE(source_id, target_id, via_card_id, label)`, so random pairs may collide. INSERT OR IGNORE silently skips duplicates rather than crashing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Vitest 4 incompatible describe() timeout signature**
- **Found during:** Task 2 (performance assertions test)
- **Issue:** Used `describe('name', fn, { timeout: 120_000 })` — the third-argument options form was deprecated in Vitest 3 and removed in Vitest 4. Vitest 4 threw `TypeError: Signature "test(name, fn, { ... })" was deprecated in Vitest 3 and removed in Vitest 4`.
- **Fix:** Moved timeout from `describe(name, fn, { timeout })` to `it('name', fn, timeout)` as the second argument to `it()`.
- **Files modified:** `tests/database/performance-assertions.test.ts`
- **Verification:** All 4 performance assertion tests pass (9s total including seeding)
- **Committed in:** `b106e7b` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Vitest 4 API incompatibility)
**Impact on plan:** Trivial fix. No scope creep, no architectural change.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 fully complete: all query modules (cards, connections, search, graph) implemented and validated
- All 4 PERF thresholds verified at realistic scale (10K cards / 50K connections)
- 151/151 tests passing across all Phase 1 and Phase 2 modules
- seedDatabase() reusable for future performance regression testing in Phase 3+
- Ready for Phase 3: Providers (FilterProvider, AxisProvider, SelectionProvider, DensityProvider, ViewProvider)

## Self-Check: PASSED

- FOUND: tests/database/seed.ts
- FOUND: tests/database/seed.test.ts
- FOUND: tests/database/performance.bench.ts
- FOUND: tests/database/performance-assertions.test.ts
- FOUND: .planning/phases/02-crud-query-layer/02-05-SUMMARY.md
- FOUND: commit a98eaa9 (RED phase)
- FOUND: commit 74addab (GREEN phase)
- FOUND: commit b106e7b (Task 2)
- All 151 tests passing

---
*Phase: 02-crud-query-layer*
*Completed: 2026-02-28*
