---
phase: 163-projection-state-machine
plan: 01
subsystem: ui
tags: [typescript, state-machine, pure-functions, superwidget, projection, reference-equality]

# Dependency graph
requires:
  - phase: 162-substrate-layout
    provides: SuperWidget slot structure (header, canvas, status, tabs) that Projection maps to
provides:
  - Projection interface with 6 readonly fields exported from src/superwidget/projection.ts
  - CanvasType, CanvasBinding, ZoneRole string literal union types
  - ValidationResult discriminated union type (consumed by Plan 02)
  - switchTab, setCanvas, setBinding, toggleTabEnabled pure transition functions with reference equality contract
affects: [164-projection-rendering, 165-canvas-stubs-registry, 163-02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reference equality guard: no-op transitions return exact input reference (never spread)"
    - "ReadonlyArray<string> for serializable tab ID lists (JSON round-trip safe)"
    - "Discriminated union ValidationResult for first-violation validation"

key-files:
  created:
    - src/superwidget/projection.ts
    - tests/superwidget/projection.test.ts
  modified: []

key-decisions:
  - "Reference equality contract is load-bearing: no-op guard paths return `return proj` (never `return { ...proj }`) for Phase 164 render bail-out"
  - "setBinding Bound guard only applies to non-View canvasTypes; Unbound is always allowed if different"
  - "toggleTabEnabled guards against removing the current activeTabId to prevent invalid state"
  - "ValidationResult exported in Plan 01 but validateProjection deferred to Plan 02 per plan scope"

patterns-established:
  - "Reference equality guard pattern: return input reference directly on invalid/no-op transitions"
  - "Projection as immutable value object — spread operator only in mutation paths"
  - "TDD with explicit toBe (not toEqual) for no-op reference equality assertions"

requirements-completed: [PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05]

# Metrics
duration: 10min
completed: 2026-04-21
---

# Phase 163 Plan 01: Projection State Machine Summary

**Immutable Projection type with switchTab/setCanvas/setBinding/toggleTabEnabled pure transition functions enforcing reference equality contract for Phase 164 render bail-out**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-21T08:53:27Z
- **Completed:** 2026-04-21T09:03:00Z
- **Tasks:** 1 (TDD: red-green-refactor)
- **Files modified:** 2

## Accomplishments

- Defined Projection interface with 6 readonly fields: canvasType, canvasBinding, zoneRole, canvasId, activeTabId, enabledTabIds (ReadonlyArray<string>)
- Implemented 4 standalone transition functions with strict reference equality contract — all no-op guard paths return the exact input reference
- Exported ValidationResult discriminated union type for Plan 02 (validateProjection not yet implemented, per plan scope)
- 22 tests covering PROJ-01 through PROJ-05 including explicit toBe reference equality assertions for all no-op paths
- TypeScript strict mode passes with zero errors

## Task Commits

1. **Task 1: TDD — Projection type + 4 transition functions (PROJ-01..05)** - `0f28602f` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/superwidget/projection.ts` — Projection type, CanvasType/CanvasBinding/ZoneRole unions, ValidationResult, switchTab/setCanvas/setBinding/toggleTabEnabled functions
- `tests/superwidget/projection.test.ts` — 22 tests covering PROJ-01..05 with toBe reference equality assertions

## Decisions Made

- `setBinding` Bound guard only applies when `canvasType !== 'View'`; Unbound transitions are always allowed when different from current binding — this keeps the function correct even for Projection objects in theoretically invalid states
- `toggleTabEnabled` guards against removing `activeTabId` — trying to disable the active tab returns original reference unchanged (cannot create an invalid Projection where activeTabId is not in enabledTabIds)
- `ValidationResult` type exported now so Plan 02 can import it without a circular dependency

## Deviations from Plan

None — plan executed exactly as written. TDD red-green-refactor cycle completed cleanly.

## Issues Encountered

None. Full test suite shows failures only in `.claude/worktrees/agent-aa5a2a1f/` (parallel agent worktree — pre-existing, unrelated to this plan). TypeScript strict passes with zero errors.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `src/superwidget/projection.ts` is ready for Plan 02 (validateProjection) to extend with PROJ-06/PROJ-07
- All 4 transition functions ready for Phase 164 wiring into `SuperWidget.commitProjection()`
- Reference equality contract verified — Phase 164 render bail-out can use `===` on Projection objects

---
*Phase: 163-projection-state-machine*
*Completed: 2026-04-21*
