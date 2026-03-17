---
phase: 82-ui-control-seams-a
plan: 01
subsystem: testing
tags: [vitest, jsdom, sql.js, ViewTabBar, HistogramScrubber, FilterProvider, PAFVProvider]

# Dependency graph
requires:
  - phase: 81-coordinator-density-seams
    provides: flushCoordinatorCycle pattern and makeProviders/realDb harness
  - phase: 80-filter-seam-tests
    provides: queryWithFilter pattern and seedCards harness
provides:
  - tests/seams/ui/view-tab-bar.test.ts — ViewTabBar-to-PAFVProvider seam (VTAB-01, VTAB-02)
  - tests/seams/ui/histogram-filter.test.ts — HistogramScrubber-to-FilterProvider SQL seam (HIST-01, HIST-02)
affects: [Phase 84-ui-polish, any future UI control seam tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "jsdom environment via // @vitest-environment jsdom for DOM-dependent seam tests that also need sql.js WASM"
    - "Seam tests verify the provider-side contract the UI control fulfills — no direct HistogramScrubber instantiation needed"
    - "ViewTabBar with mountTarget: container appends nav directly to container (not as insertBefore sibling)"

key-files:
  created:
    - tests/seams/ui/view-tab-bar.test.ts
    - tests/seams/ui/histogram-filter.test.ts
  modified: []

key-decisions:
  - "Use // @vitest-environment jsdom per-file annotation for tests needing both DOM APIs and sql.js WASM — confirmed working by etl-progress.test.ts precedent"
  - "Histogram seam tests call FilterProvider.setRangeFilter/clearRangeFilter directly — scrubber's D3 pixel-to-bin mapping is a rendering concern outside the seam boundary"
  - "ViewTabBar seam test uses mountTarget: container so nav is appended to container (not insertBefore sibling hack) — enables clean DOM queries within container"

patterns-established:
  - "jsdom + WASM: per-file @vitest-environment jsdom annotation works alongside sql.js globalSetup — both can coexist in the same test file"
  - "UI control seam tests verify the provider contract the control fulfills, not internal D3/DOM rendering mechanics"

requirements-completed: [VTAB-01, VTAB-02, HIST-01, HIST-02]

# Metrics
duration: 8min
completed: 2026-03-17
---

# Phase 82 Plan 01: UI Control Seams A Summary

**18 seam tests across ViewTabBar->PAFVProvider (ARIA + family suspension) and HistogramScrubber->FilterProvider (range filter SQL round-trip) using real sql.js and jsdom**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-17T12:12:22Z
- **Completed:** 2026-03-17T12:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 8 ViewTabBar seam tests: tab click sets PAFVProvider.viewType, coordinator fires, ARIA aria-selected/roving tabindex update, LATCH-GRAPH-LATCH round-trips restore axis state via structuredClone suspension
- 10 HistogramScrubber seam tests: setRangeFilter/clearRangeFilter produce correct SQL WHERE for numeric (priority) and date (due_at) fields, compound range+axis filter, idempotent clear
- Both test files use real sql.js via makeProviders + realDb — no mocked providers
- Established jsdom + WASM coexistence pattern for UI seam tests

## Task Commits

Each task was committed atomically:

1. **Task 1: ViewTabBar-to-PAFVProvider seam tests** - `cfb3805a` (feat)
2. **Task 2: HistogramScrubber-to-FilterProvider seam tests** - `9ebc21f8` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified

- `tests/seams/ui/view-tab-bar.test.ts` — 8 tests covering VTAB-01 (click->setViewType, coordinator notification, multiple tabs) and VTAB-02 (ARIA aria-selected, roving tabindex, LATCH-GRAPH round-trips for list/grid/supergrid views)
- `tests/seams/ui/histogram-filter.test.ts` — 10 tests covering HIST-01 (setRangeFilter with numeric/date fields, tight ranges, full range) and HIST-02 (clear round-trips, compound filter, idempotent clear, null-selection equivalent)

## Decisions Made

- Used `// @vitest-environment jsdom` annotation for ViewTabBar tests since they need DOM APIs (document, click events) — confirmed compatible with sql.js WASM by etl-progress.test.ts precedent
- ViewTabBar instantiated with `mountTarget: container` so the nav appends directly inside the test container instead of using the insertBefore sibling pattern — cleaner test DOM queries
- HistogramScrubber not instantiated in the seam tests — only its output contract (FilterProvider state) is verified, keeping D3 brush pixel mapping out of scope per the plan's strategy

## Deviations from Plan

None — plan executed exactly as written.

The only adjustment was adding `// @vitest-environment jsdom` at the top of `view-tab-bar.test.ts` (Rule 3: fix blocking issue — `document is not defined` in node environment). This was anticipated behavior for DOM-dependent tests.

## Issues Encountered

- Initial ViewTabBar test run failed with `document is not defined` because default vitest environment is `node`. Fixed immediately by adding `// @vitest-environment jsdom` per the established project pattern (see `tests/ui/ViewTabBar.test.ts`).

## Next Phase Readiness

- UI seam test foundation complete for Phase 82 Plan 01
- 18 UI control seam tests passing in `tests/seams/ui/`
- Ready for Phase 82 Plan 02 (remaining UI control seams)

---
*Phase: 82-ui-control-seams-a*
*Completed: 2026-03-17*
