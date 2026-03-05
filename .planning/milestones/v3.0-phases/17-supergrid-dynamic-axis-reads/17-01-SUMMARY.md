---
phase: 17-supergrid-dynamic-axis-reads
plan: 01
subsystem: ui
tags: [supergrid, dependency-injection, statecoordinator, workerbridge, pafvprovider, tdd, typescript]

requires:
  - phase: 16-supergridquery-worker-wiring
    provides: WorkerBridge.superGridQuery() with rAF coalescing and CellDatum[] response type
  - phase: 15-pafvprovider-stacked-axes
    provides: PAFVProvider.getStackedGroupBySQL() returning colAxes/rowAxes AxisMapping arrays

provides:
  - SuperGrid constructor injection: (provider, filter, bridge, coordinator) 4-arg pattern
  - SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike narrow interfaces in types.ts
  - mount() subscribes to StateCoordinator and fires immediate bridge.superGridQuery()
  - render(cards) as explicit no-op with intent comment
  - destroy() that unsubscribes coordinator and clears all internal state
  - _fetchAndRender() pipeline: provider axes -> filter compile -> bridge.superGridQuery() -> _renderCells()
  - _renderCells() full CSS Grid pipeline driven by CellDatum[] from bridge (not in-memory CardDatum[])
  - VIEW_DEFAULTS fallback when provider returns empty axes
  - Collapse click handler uses cached _lastCells without re-querying bridge
  - main.ts viewFactory updated: new SuperGrid(pafv, filter, bridge, coordinator)

affects:
  - 17-02: Plan 02 will flesh out _renderCells with advanced D3 data join and multi-axis stacking
  - Future plans using SuperGrid must provide all 4 constructor args

tech-stack:
  added: []
  patterns:
    - Narrow interface pattern: SuperGridBridgeLike/SuperGridProviderLike/SuperGridFilterLike extract only what SuperGrid needs from each dependency
    - Bridge-driven render: SuperGrid.render(cards) is a no-op; data flows through bridge.superGridQuery() triggered by StateCoordinator subscription
    - Cached collapse re-render: collapse click re-renders from _lastCells without re-querying bridge (avoids unnecessary Worker messages)
    - VIEW_DEFAULTS fallback: empty axes from provider fall back to card_type/folder defaults in _fetchAndRender, not in PAFVProvider

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/views/types.ts
    - src/main.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "SuperGrid.render(cards) is an intentional no-op with comment explaining the bridge-driven data pattern — IView compliance without misuse"
  - "VIEW_DEFAULTS fallback lives in _fetchAndRender(), not in PAFVProvider — SuperGrid owns the fallback decision, provider is view-type agnostic"
  - "Collapse click handler uses cached _lastCells without re-querying bridge — avoids unnecessary Worker round-trips on UI interaction"
  - "Narrow interfaces (SuperGridBridgeLike/SuperGridProviderLike/SuperGridFilterLike) in types.ts — tests use mocks, production uses real providers"

patterns-established:
  - "Bridge-driven view pattern: view subscribes to StateCoordinator, calls bridge query method, renders from query response (not from coordinator-supplied cards)"
  - "Constructor injection with narrow interfaces: 4 dependencies, each reduced to only the methods the view actually calls"

requirements-completed: [FOUN-08, FOUN-10]

duration: 4min
completed: 2026-03-04
---

# Phase 17 Plan 01: SuperGrid Constructor Injection + Lifecycle Refactor Summary

**SuperGrid rewritten from zero-arg in-memory filtering to 4-arg dependency-injected lifecycle: PAFVProvider axis reads, StateCoordinator subscription, and WorkerBridge query pipeline with CellDatum-driven CSS Grid rendering**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-04T16:35:58Z
- **Completed:** 2026-03-04T16:39:46Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 4

## Accomplishments

- Rewrote SuperGrid.ts from zero-arg/in-memory pattern to dependency-injected lifecycle with PAFVProvider axis reads
- Added SuperGridBridgeLike, SuperGridProviderLike, and SuperGridFilterLike narrow interfaces to types.ts
- mount() now subscribes to StateCoordinator and fires an immediate bridge.superGridQuery() call
- render(cards) is a documented no-op; all data flows through the bridge query pipeline
- destroy() correctly unsubscribes from coordinator, preventing memory leaks after view swap
- Updated main.ts viewFactory: `new SuperGrid(pafv, filter, bridge, coordinator)`
- 30 tests pass (16 new Phase 17 tests + 14 updated existing tests), 0 regressions across 1257 total tests

## Task Commits

TDD cycle with two atomic commits:

1. **RED — Failing tests** - `8b968255` (test)
2. **GREEN — Implementation** - `ba97d7f9` (feat)

## Files Created/Modified

- `src/views/SuperGrid.ts` - Rewrote with 4-arg constructor, mount/render/destroy lifecycle, _fetchAndRender pipeline, _renderCells CSS Grid engine
- `src/views/types.ts` - Added SuperGridBridgeLike, SuperGridProviderLike, SuperGridFilterLike narrow interfaces
- `src/main.ts` - Updated viewFactory: `new SuperGrid(pafv, filter, bridge, coordinator)`
- `tests/views/SuperGrid.test.ts` - Added 16 new Phase 17 tests (FOUN-08, FOUN-10, lifecycle, interface compliance); updated 14 existing tests for 4-arg constructor

## Decisions Made

- `render(cards)` is an intentional no-op with a comment explaining the bridge-driven data pattern — IView compliance without misuse
- VIEW_DEFAULTS fallback lives in `_fetchAndRender()`, not in PAFVProvider — SuperGrid owns the fallback decision, provider is view-type agnostic (per Phase 15 decision)
- Collapse click handler uses cached `_lastCells` without re-querying bridge — avoids unnecessary Worker round-trips on pure UI interaction
- Narrow interfaces (SuperGridBridgeLike/SuperGridProviderLike/SuperGridFilterLike) extracted into types.ts — each interface is the minimal contract SuperGrid actually needs

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- SuperGrid constructor injection pattern established — Plan 02 can flesh out _renderCells with advanced D3 data join, multi-axis stacking (up to 3 levels), and CSS Custom Property density scaling
- All 4 dependencies are wired in main.ts and verified working through the full lifecycle test suite

## Self-Check: PASSED

All created/modified files exist on disk. All task commits found in git history.

---
*Phase: 17-supergrid-dynamic-axis-reads*
*Completed: 2026-03-04*
