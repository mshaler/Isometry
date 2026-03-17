---
phase: 81-coordinator-density-seams
plan: 01
subsystem: testing
tags: [vitest, seam-tests, coordinator, density, filter, bridge-spy]

# Dependency graph
requires:
  - phase: 79-test-infrastructure
    provides: makeProviders(), realDb(), ProviderStack harness
  - phase: 80-filter-pafv-seams
    provides: seam test patterns (filter-sql.test.ts, pafv-celldatum.test.ts)
provides:
  - "8 coordinator-to-bridge seam tests covering CORD-01..03 and DENS-01..02"
  - "tests/seams/coordinator/coordinator-density.test.ts — bridge spy pattern implementation"
affects: [82-ui-seams, 83-etl-seams]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Bridge spy pattern: vi.fn() inside coordinator.subscribe() captures provider state at callback-fire time"
    - "flushCoordinatorCycle(): 2x Promise.resolve() + vi.advanceTimersByTime(20) + Promise.resolve()"
    - "Fresh vi.fn() per test (not shared in beforeEach) to avoid cross-test bleed"
    - "State captured INSIDE callback (not at subscribe time) matching production _fetchAndRender() pattern"

key-files:
  created:
    - tests/seams/coordinator/coordinator-density.test.ts
  modified: []

key-decisions:
  - "Bridge spy captures filter.compile() + density.getState() inside coordinator callback, not outside — matches production read-at-fire-time pattern"
  - "No exact SQL string matching — toContain() on where and params only — avoids brittleness from SQL formatting changes"

patterns-established:
  - "Coordinator seam test pattern: makeProviders(db) + coordinator.subscribe(bridgeSpy) + flushCoordinatorCycle()"
  - "Fresh vi.fn() per test for isolation, not shared in beforeEach"

requirements-completed: [CORD-01, CORD-02, CORD-03, DENS-01, DENS-02]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 81 Plan 01: Coordinator-Density Seams Summary

**8 seam tests proving filter and density state propagates through real StateCoordinator to bridge spy with correct params — batching, teardown, and regression guards all green.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T17:54:00Z
- **Completed:** 2026-03-16T17:54:35Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `tests/seams/coordinator/coordinator-density.test.ts` with 8 tests covering all 5 requirements
- CORD-01: two tests confirm filter changes (folder, status) propagate correct where+params to bridge spy
- CORD-02: 3 rapid synchronous mutations batch into exactly 1 spy call with the final state
- CORD-03: two tests confirm destroy() prevents all subsequent callbacks (post-destroy mutations + mid-batch cancel)
- DENS-01: hideEmpty and viewMode changes each propagate correct densityState fields to spy
- DENS-02: regression guard confirms density-to-coordinator registration is intact (GREEN on arrival)

## Task Commits

1. **Task 1: Write coordinator-to-bridge and density seam tests** - `f619b36d` (feat)

## Files Created/Modified
- `tests/seams/coordinator/coordinator-density.test.ts` — 8 seam tests, bridge spy pattern, flushCoordinatorCycle utility

## Decisions Made
- Captured state INSIDE coordinator callback (not at subscribe time) — matches production _fetchAndRender() pattern where fresh state is always read at callback-fire time
- Used toContain() for where clause and params assertions rather than exact SQL string matching — avoids brittleness

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 81 Plan 01 complete — coordinator and density seam tests all green
- Ready for next plan in Phase 81 (if any) or Phase 82 (UI seams)

---
*Phase: 81-coordinator-density-seams*
*Completed: 2026-03-16*
