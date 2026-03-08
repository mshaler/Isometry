---
phase: 52-sample-data-empty-states
plan: 01
subsystem: data
tags: [sample-data, json, sql, tdd, worker-bridge]

# Dependency graph
requires:
  - phase: 43-empty-states
    provides: "VIEW_EMPTY_MESSAGES and filtered-empty state patterns"
provides:
  - "SampleDataset type interface (src/sample/types.ts)"
  - "Three curated dataset JSON files (apple-revenue, northwind, meryl-streep)"
  - "SampleDataManager class with load/clear/hasSampleData/getDatasets/getDefaultDataset"
affects: [52-02, welcome-panel, command-palette, sync-boundary]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Sample data tagged with source='sample' for surgical deletion and audit identification", "INSERT OR REPLACE for idempotent card loading, INSERT OR IGNORE for connections", "Day-of-year modulo rotation for default dataset selection"]

key-files:
  created: [src/sample/types.ts, src/sample/SampleDataManager.ts, src/sample/datasets/apple-revenue.json, src/sample/datasets/northwind.json, src/sample/datasets/meryl-streep.json, tests/sample/SampleDataManager.test.ts]
  modified: []

key-decisions:
  - "Datasets injected via constructor (not imported inside SampleDataManager) for testability and Plan 02 wiring flexibility"
  - "Tags JSON.stringify'd and is_collective converted to 0/1 integer matching SQLite column expectations"
  - "Non-null assertion on getDefaultDataset() array access (constructor invariant: datasets.length > 0)"

patterns-established:
  - "Sample data source convention: source='sample', source_id='{dataset-id}:{card-slug}', deterministic IDs (sample-*)"
  - "SampleDataManager as thin bridge orchestrator: no DedupEngine, direct db:exec for ephemeral data"

requirements-completed: [SMPL-06, SMPL-02]

# Metrics
duration: 7min
completed: 2026-03-08
---

# Phase 52 Plan 01: Sample Datasets + SampleDataManager Summary

**Three curated dataset JSON files (Apple Revenue 16 cards, Northwind 17 cards, Meryl Streep 16 cards) with SampleDataManager orchestrator class and 17 TDD unit tests**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-08T15:52:57Z
- **Completed:** 2026-03-08T16:00:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Created SampleDataset/SampleCard/SampleConnection type interfaces matching the CanonicalCard schema
- Authored three distinct dataset JSON files with realistic content spanning all LATCH axes (Location, Alphabet, Time, Category, Hierarchy)
- Built SampleDataManager class with load/clear/hasSampleData/getDatasets/getDefaultDataset methods
- Full TDD coverage: 17 passing tests validating INSERT params, tags serialization, boolean conversion, idempotent loading

## Task Commits

Each task was committed atomically:

1. **Task 1: SampleDataset type + three dataset JSON files** - `ed452e3d` (feat)
2. **Task 2: SampleDataManager class with TDD** - `266b3cd6` (feat)

_TDD: tests written RED (failing), implementation GREEN (passing), no refactor needed._

## Files Created/Modified
- `src/sample/types.ts` - SampleDataset, SampleCard, SampleConnection interfaces
- `src/sample/SampleDataManager.ts` - Load/clear orchestrator using WorkerBridge db:exec/db:query
- `src/sample/datasets/apple-revenue.json` - 16 cards (product launches 2001-2024), 12 connections (hub + evolved_into chains), defaultView='timeline'
- `src/sample/datasets/northwind.json` - 17 cards (categories/products/suppliers/customers/orders), 12 connections (star topology), defaultView='network'
- `src/sample/datasets/meryl-streep.json` - 16 cards (films/awards 1978-2024), 12 connections (starred_in + won_award), defaultView='timeline'
- `tests/sample/SampleDataManager.test.ts` - 17 unit tests with mock WorkerBridge

## Decisions Made
- Datasets injected via constructor rather than imported inside SampleDataManager -- keeps the class testable and lets Plan 02 handle the Vite JSON imports in main.ts
- Tags are JSON.stringify'd before INSERT (SQLite stores tags as JSON string column)
- is_collective boolean converted to 0/1 integer (SQLite INTEGER column)
- Used non-null assertion on getDefaultDataset() array access since datasets.length > 0 is a constructor invariant

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three dataset JSON files ready for import via `import appleRevenue from './datasets/apple-revenue.json'`
- SampleDataManager ready for wiring in main.ts (Plan 02)
- Plan 02 will wire datasets into welcome panel, command palette, and sync boundary

---
*Phase: 52-sample-data-empty-states*
*Completed: 2026-03-08*
