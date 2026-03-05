---
phase: 22-superdensity
plan: 01
subsystem: ui
tags: [supergrid, density, provider, d3, tdd, typescript]

# Dependency graph
requires:
  - phase: 21-superselect
    provides: SuperGridSelectionLike narrow interface pattern, _noOpSelectionAdapter pattern
  - phase: 20-supersize
    provides: SuperGridProviderLike with colWidths, SuperGridSizer integration
  - phase: 19-superposition-superzoom
    provides: SuperGridPositionLike pattern, optional 5th/6th constructor arg pattern
provides:
  - SuperDensityProvider class implementing PersistableProvider (Tier 2 persistence)
  - ViewMode type ('spreadsheet' | 'matrix') in src/providers/types.ts
  - SuperDensityState interface in src/providers/types.ts
  - SuperGridDensityLike narrow interface in src/views/types.ts
  - SuperGrid 7th constructor arg with no-op default (backward-compat)
  - Density subscription wiring in SuperGrid.mount() with hybrid routing
  - DENS-06 compliance documented in D3 .join().each() chain
affects: [22-superdensity-plan02, 22-superdensity-plan03, future-supergrid-density-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SuperGridDensityLike narrow interface follows SuperGridProviderLike / SuperGridFilterLike pattern"
    - "Hybrid density routing: granularity changes trigger Worker re-query; hideEmpty/viewMode are client-side"
    - "_noOpDensityProvider constant at module level — same pattern as _noOpPositionProvider"
    - "queueMicrotask batching for subscriber notifications (same as DensityProvider)"

key-files:
  created:
    - src/providers/SuperDensityProvider.ts
    - tests/providers/SuperDensityProvider.test.ts
  modified:
    - src/providers/types.ts
    - src/views/types.ts
    - src/views/SuperGrid.ts
    - src/main.ts

key-decisions:
  - "SuperDensityProvider is a new PersistableProvider (not an extension of PAFVState) — density concerns orthogonal to axis assignments"
  - "Hybrid routing in SuperGrid density subscription: granularity change triggers _fetchAndRender(); hideEmpty/viewMode triggers _renderCells() from _lastCells cache"
  - "DENS-06: chained .each() after .join() already fires on both enter and update — existing code is correct; added explanatory comment"
  - "SuperDensityProvider IS registered with StateCoordinator (unlike SuperPositionProvider) — density changes participate in coordinator batch"

patterns-established:
  - "SuperGridDensityLike: minimal narrow interface over SuperDensityProvider for SuperGrid injection"
  - "Defensive copy on getState() — { ...this._state } — prevents external mutation of provider state"
  - "regionConfig: null stub field — DENS-04 Region density placeholder, no UI in v3.0"

requirements-completed: [DENS-04, DENS-06]

# Metrics
duration: 5min
completed: 2026-03-05
---

# Phase 22 Plan 01: SuperDensity Foundation Summary

**SuperDensityProvider with queueMicrotask batching and SuperGridDensityLike narrow interface wired as optional 7th SuperGrid constructor arg**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-05T03:44:16Z
- **Completed:** 2026-03-05T03:49:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created SuperDensityProvider implementing PersistableProvider with full toJSON/setState/resetToDefaults, axisGranularity/hideEmpty/viewMode/regionConfig state, and queueMicrotask batching
- Added ViewMode type and SuperDensityState interface to src/providers/types.ts
- Added SuperGridDensityLike narrow interface to src/views/types.ts
- Wired SuperDensityProvider as optional 7th constructor arg in SuperGrid with no-op default (all 127 existing tests pass unchanged)
- Implemented hybrid density routing in SuperGrid.mount(): granularity changes trigger Worker re-query; hideEmpty/viewMode changes re-render client-side from _lastCells
- Registered SuperDensityProvider with StateCoordinator in main.ts; exposed on window.__isometry
- Documented DENS-06 compliance: D3 chained .each() after .join() correctly fires on both enter and update, ensuring gridColumn/gridRow are re-applied on density-collapsed layouts
- 11 new unit tests covering all 10 specified behaviors plus unsubscribe function

## Task Commits

Each task was committed atomically:

1. **Task 1: SuperDensityProvider, types, and SuperGridDensityLike** - `32598ba8` (test + feat: TDD RED+GREEN)
2. **Task 2: Wire SuperDensityProvider into SuperGrid and main.ts** - `2f836326` (feat)

## Files Created/Modified

- `src/providers/SuperDensityProvider.ts` - SuperDensityProvider class implementing PersistableProvider
- `src/providers/types.ts` - Added ViewMode type and SuperDensityState interface
- `src/views/types.ts` - Added SuperGridDensityLike narrow interface
- `src/views/SuperGrid.ts` - Added 7th constructor arg, _noOpDensityProvider, density subscription in mount(), cleanup in destroy(), DENS-06 comment
- `src/main.ts` - Create SuperDensityProvider, register with coordinator, pass to SuperGrid, expose on window
- `tests/providers/SuperDensityProvider.test.ts` - 11 unit tests

## Decisions Made

- SuperDensityProvider is a standalone new PersistableProvider (not extending PAFVState) — density concerns are orthogonal to axis assignments, separate provider keeps PersistableProvider contracts clean
- Hybrid routing in density subscription: granularity changes require Worker re-query (SQL GROUP BY expression changes); hideEmpty and viewMode are pure client-side transforms
- DENS-06 is already satisfied by the existing D3 chained .each() pattern — no code change needed, added documentation comment explaining why
- SuperDensityProvider IS registered with StateCoordinator (unlike SuperPositionProvider which is NOT) — density changes are slow discrete user actions, not high-frequency scroll events

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The D3 DENS-06 gap mentioned in research was confirmed to already be handled correctly by the existing `update => update` identity callback with chained `.each()` — verified by running existing tests and confirming all 138 pass.

## Next Phase Readiness

- SuperDensityProvider foundation complete — ready for Plan 02 (time hierarchy collapse / strftime GROUP BY rewrite) and Plan 03 (hide-empty filter + matrix mode)
- SuperGridDensityLike interface ready to consume in Plans 02 and 03
- StateCoordinator integration established — density state changes flow through existing coordinator batch pipeline

---
*Phase: 22-superdensity*
*Completed: 2026-03-05*
