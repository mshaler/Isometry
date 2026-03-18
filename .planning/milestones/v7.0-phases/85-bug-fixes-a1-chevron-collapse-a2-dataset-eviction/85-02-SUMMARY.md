---
phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction
plan: "02"
subsystem: ui
tags: [sql.js, SampleDataManager, SchemaProvider, ViewManager, dataset-eviction, playwright, vitest]

requires:
  - phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction
    provides: Phase context and A1 chevron collapse fix (85-01)

provides:
  - evictAll() method on SampleDataManager — full DELETE FROM cards + connections
  - SchemaProvider.refresh() — re-notifies subscribers without PRAGMA re-introspection
  - ViewManager.showLoading() — public wrapper for immediate loading spinner
  - Full eviction pipeline in main.ts onLoadSample callback
  - Vitest integration test (4 tests) proving zero-bleed with real sql.js
  - Playwright E2E test confirming zero film cards after dataset switch

affects:
  - main.ts onLoadSample callback
  - SampleDataManager future callers
  - SchemaProvider subscribers (LatchExplorers, ProjectionExplorer, PropertiesExplorer)

tech-stack:
  added: []
  patterns:
    - "evictAll() delete-then-load pattern: DELETE all connections then cards (FK order), reset providers, load, refresh SchemaProvider"
    - "Public showLoading() delegates to private _showLoading() for external pipeline use"
    - "WorkerBridgeLike mock wrapping real Database for seam integration tests"

key-files:
  created:
    - tests/seams/ui/dataset-eviction.test.ts
    - e2e/dataset-eviction.spec.ts
  modified:
    - src/sample/SampleDataManager.ts
    - src/providers/SchemaProvider.ts
    - src/views/ViewManager.ts
    - src/main.ts

key-decisions:
  - "evictAll() deletes connections before cards for explicit FK ordering (connections table has FK on source_id/target_id)"
  - "SchemaProvider.refresh() calls _scheduleNotify() without re-introspecting PRAGMA — DDL is constant across all datasets, re-notification achieves same effect"
  - "ViewManager.showLoading() added as public method to expose immediate spinner for external pipeline (not delayed 200ms like _fetchAndRender internal timer)"
  - "E2E zero-bleed asserted via film card type count (meryl-streep has films, northwind-graph does not)"

patterns-established:
  - "Dataset eviction pipeline: showLoading → evictAll → provider resets → load → schemaProvider.refresh → scheduleUpdate → switchTo"
  - "WorkerBridgeLike bridge mock pattern: db.run for db:exec, db.exec for db:query — enables SampleDataManager testing without Worker thread"

requirements-completed: [EVIC-01, EVIC-02, EVIC-03, EVIC-04, EVIC-05]

duration: 8min
completed: 2026-03-17
---

# Phase 85 Plan 02: Dataset Eviction Summary

**Full dataset eviction pipeline: evictAll() + provider resets + SchemaProvider.refresh() + Playwright zero-bleed E2E test**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-17T23:23:00Z
- **Completed:** 2026-03-17T23:31:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Replaced partial `source='sample'` deletion with full `evictAll()` that DELETEs all connections then all cards
- Added `SchemaProvider.refresh()` to re-notify subscribers (LatchExplorers, ProjectionExplorer) after dataset switch without re-querying PRAGMA
- Wired full eviction pipeline in `main.ts` onLoadSample: showLoading → evictAll → filter/pafv/selection/superPosition resets → load → refresh → scheduleUpdate → switchTo
- 4 vitest integration tests passing with real sql.js proving zero-bleed invariant
- Playwright E2E test confirming zero film cards after meryl-streep → northwind-graph switch

## Task Commits

Each task was committed atomically:

1. **Task 1: Add evictAll, SchemaProvider.refresh, ViewManager.showLoading, wire pipeline** - `795927b5` (feat)
2. **Task 2: Add vitest integration test for dataset eviction zero-bleed** - `dd46270b` (test)
3. **Task 3: Add Playwright E2E test for dataset switch visual zero-bleed** - `b535a283` (test)

## Files Created/Modified

- `src/sample/SampleDataManager.ts` — Added `evictAll()`: DELETE FROM connections + DELETE FROM cards
- `src/providers/SchemaProvider.ts` — Added `refresh()`: re-notifies subscribers via `_scheduleNotify()`
- `src/views/ViewManager.ts` — Added `showLoading()`: public wrapper delegating to `_showLoading()`
- `src/main.ts` — Rewrote `onLoadSample` callback with full 7-step eviction pipeline
- `tests/seams/ui/dataset-eviction.test.ts` — 4 integration tests using real sql.js + WorkerBridgeLike mock
- `e2e/dataset-eviction.spec.ts` — Playwright E2E test: meryl-streep → northwind-graph zero film bleed

## Decisions Made

- `evictAll()` deletes connections before cards to respect FK ordering (connections reference card IDs)
- `SchemaProvider.refresh()` calls `_scheduleNotify()` without re-introspecting PRAGMA — DDL is constant across all datasets
- `ViewManager.showLoading()` is a public wrapper to enable immediate spinner from the eviction pipeline, bypassing the internal 200ms delay timer in `_fetchAndRender()`
- E2E zero-bleed assertion uses `card_type = 'film'` — meryl-streep dataset has film cards, northwind-graph does not

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added public ViewManager.showLoading() method**
- **Found during:** Task 1 (wiring eviction pipeline)
- **Issue:** Plan specified `viewManager.showLoading?.()` but `_showLoading()` is private. No public loading method existed.
- **Fix:** Added `showLoading(): void` as a public method that delegates to the private `_showLoading()` with JSDoc explaining the distinction from the internal delayed timer
- **Files modified:** `src/views/ViewManager.ts`
- **Verification:** TypeScript zero src/ errors; `viewManager.showLoading()` callable in main.ts
- **Committed in:** `795927b5` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing public method)
**Impact on plan:** Essential for correctness — the private method couldn't be called from main.ts. No scope creep.

## Issues Encountered

None — all steps followed plan as specified once the showLoading public method was added.

## Next Phase Readiness

- Dataset eviction pipeline complete and tested
- schemaProvider.refresh() pattern available for any future dataset-switching flows
- evictAll() can be reused from Catalog or other dataset entry points
- Zero pre-existing src/ TypeScript errors introduced by these changes

---
*Phase: 85-bug-fixes-a1-chevron-collapse-a2-dataset-eviction*
*Completed: 2026-03-17*
