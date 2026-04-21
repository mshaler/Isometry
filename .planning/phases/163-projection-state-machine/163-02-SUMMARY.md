---
phase: 163-projection-state-machine
plan: 02
subsystem: ui
tags: [typescript, state-machine, pure-functions, superwidget, projection, validation, purity]

# Dependency graph
requires:
  - phase: 163-01
    provides: Projection type + 4 transition functions from projection.ts
provides:
  - validateProjection function completing the projection.ts module
  - PROJ-06 test coverage (4 invalid states, no-throw contract)
  - PROJ-07 test coverage (repeated-call consistency + frozen-input mutation guard)
affects: [164-projection-rendering, 165-canvas-stubs-registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First-violation validation: fixed check order (enabledTabIds.length → activeTabId → Bound guard → canvasId) with documented rationale"
    - "Frozen-input mutation test: Object.freeze() on input + enabledTabIds to verify no mutation across all 5 functions"
    - "Single-violation-per-test discipline: each PROJ-06 test violates exactly ONE condition to avoid ordering dependence"

key-files:
  created: []
  modified:
    - src/superwidget/projection.ts
    - tests/superwidget/projection.test.ts

key-decisions:
  - "Check order in validateProjection is enabledTabIds.length === 0 FIRST (before activeTabId membership) — empty array makes includes() vacuously false, masking the real error"
  - "Each PROJ-06 invalid-state test uses an input where only one condition is violated to avoid ordering dependence"

requirements-completed: [PROJ-06, PROJ-07]

# Metrics
duration: ~5min
completed: 2026-04-21
---

# Phase 163 Plan 02: validateProjection + Purity Assertions Summary

**validateProjection completing the projection state machine — first-violation semantics with frozen-input purity verification across all 5 functions**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-21T12:59:36Z
- **Completed:** 2026-04-21T13:04:08Z
- **Tasks:** 1 (TDD: red-green-refactor)
- **Files modified:** 2

## Accomplishments

- Implemented `validateProjection` with D-05 first-violation semantics: fixed check order (enabledTabIds.length → activeTabId membership → Bound on non-View → empty canvasId) with comment documenting why order matters
- Added 20 new tests covering PROJ-06 (4 invalid states × assertion + no-throw variant, plus well-formed happy path) and PROJ-07 (repeated-call consistency for all 5 functions, frozen-input mutation guard for all 5 functions)
- All 42 tests in `projection.test.ts` pass; TypeScript strict passes with zero errors
- Full suite shows 42 pre-existing failures in `.claude/worktrees/agent-ac4f0df8/` (parallel agent worktree, unrelated)

## Task Commits

1. **Task 1: TDD — validateProjection + purity assertions (PROJ-06, PROJ-07)** - `0a4f56ef` (feat)

## Files Created/Modified

- `src/superwidget/projection.ts` — Added `validateProjection` function with first-violation check order and explanatory comment
- `tests/superwidget/projection.test.ts` — Added `validateProjection` import + 2 new describe blocks: `PROJ-06: validateProjection` (10 tests) and `PROJ-07: purity` (10 tests)

## Decisions Made

- Check order in `validateProjection`: `enabledTabIds.length === 0` must precede the `includes(activeTabId)` check — an empty array makes `includes()` return false for any value, which would incorrectly report the wrong error reason
- Each PROJ-06 test violates exactly one condition (per Research Pitfall 4) so test results are independent of check ordering

## Deviations from Plan

None — plan executed exactly as written. TDD red-green-refactor cycle completed cleanly.

## Issues Encountered

None. TypeScript strict passes. Full suite failures are all in the parallel agent worktree, pre-existing and unrelated.

## User Setup Required

None.

## Next Phase Readiness

- `src/superwidget/projection.ts` is complete: all 5 functions exported, all PROJ-01..07 requirements satisfied
- Phase 164 can import `validateProjection` as the safety gate before `commitProjection` DOM mutation
- Reference equality contract verified — Phase 164 render bail-out can use `===` on Projection objects

---

## Self-Check

- src/superwidget/projection.ts — FOUND
- tests/superwidget/projection.test.ts — FOUND
- Commit 0a4f56ef — FOUND

## Self-Check: PASSED
