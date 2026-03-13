---
phase: 75-performance-budgets-benchmark-skeleton
plan: 02
subsystem: testing
tags: [vitest, jsdom, performance, benchmarks, supergrid, d3]

# Dependency graph
requires:
  - phase: 75-01
    provides: BUDGET_RENDER_JSDOM_MS = 128ms constant in src/profiling/PerfBudget.ts

provides:
  - tests/profiling/budget-render.test.ts with jsdom render budget assertions (TDD red step)
  - .benchmarks/main.json baseline from Phase 74 for Phase 78 regression comparison

affects: [76-render-optimization, 78-ci-bench-regression]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "it() + performance.now() timing in jsdom for render budget assertions (not bench())"
    - "Hand-authored .benchmarks/main.json schema committed to repo for CI regression baseline"
    - "Self-contained test file helpers (no cross-file imports in forks pool isolation)"

key-files:
  created:
    - tests/profiling/budget-render.test.ts
    - .benchmarks/main.json
  modified: []

key-decisions:
  - "budget-render.test.ts intentionally has 2 failing tests (dual/triple axis) — TDD red step for Phase 76 render optimization"
  - ".benchmarks/main.json uses hand-authored schema, not vitest reporter JSON (bench() empty-samples bug in forks pool)"
  - "All mock helpers copied inline to budget-render.test.ts (vitest forks pool isolates modules — cannot import from render-timing.test.ts)"

patterns-established:
  - "Budget test file uses // @vitest-environment jsdom and imports BUDGET_* constants from PerfBudget.ts"
  - ".benchmarks/ directory is git-tracked (not gitignored) — required for Phase 78 CI diff"

requirements-completed: [RGRD-01, RGRD-03]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 75 Plan 02: Budget Render Test + Baseline JSON Summary

**jsdom render budget assertions (TDD red) with dual/triple axis failing against 128ms, plus committed .benchmarks/main.json baseline from Phase 74 data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-12T14:14:08Z
- **Completed:** 2026-03-12T14:17:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created budget-render.test.ts with 3 render timing assertions against BUDGET_RENDER_JSDOM_MS (128ms)
- Verified TDD red step: single axis 20K PASSES (p99 ~103ms), dual 5K FAILS (p99 ~535ms), triple 20K FAILS (p99 ~302ms)
- Created .benchmarks/main.json with 13 Phase 74 baseline measurements and 8 Phase 75 budget targets for Phase 78 CI regression

## Task Commits

Each task was committed atomically:

1. **Task 1: Create budget-render.test.ts** - `6c6680f0` (test)
2. **Task 2: Create .benchmarks/main.json** - `f1650c38` (chore)

## Files Created/Modified

- `tests/profiling/budget-render.test.ts` - jsdom render budget assertions; single PASS, dual/triple FAIL (TDD red)
- `.benchmarks/main.json` - Phase 74 baseline measurements + Phase 75 budgets; hand-authored schema for Phase 78 regression

## Decisions Made

- All mock helpers (mulberry32, makeSyntheticCells, makeMockBridge, etc.) copied inline rather than imported — vitest forks pool module isolation prevents cross-file helper sharing
- .benchmarks/main.json uses hand-authored schema instead of vitest reporter output because vitest bench v4 returns empty samples in --run mode with forks pool

## Deviations from Plan

None - plan executed exactly as written. Biome lint fixes (import order, `**` operator, inline it() format) were cosmetic-only corrections during initial authoring, not deviations.

## Issues Encountered

None. Biome flagged 3 auto-fixable style issues (import order, Math.pow → `**` exponentiation, it() formatting) on first check, resolved immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- budget-render.test.ts provides the failing assertions that Phase 76 render optimization must satisfy
- .benchmarks/main.json provides the baseline that Phase 78 CI regression detection will compare against
- Phase 75 plan 03 (if any) or Phase 76 can begin immediately

## Self-Check: PASSED

- FOUND: tests/profiling/budget-render.test.ts
- FOUND: .benchmarks/main.json
- FOUND: 75-02-SUMMARY.md
- FOUND commit: 6c6680f0 (test(75-02): budget-render.test.ts)
- FOUND commit: f1650c38 (chore(75-02): .benchmarks/main.json)

---
*Phase: 75-performance-budgets-benchmark-skeleton*
*Completed: 2026-03-12*
