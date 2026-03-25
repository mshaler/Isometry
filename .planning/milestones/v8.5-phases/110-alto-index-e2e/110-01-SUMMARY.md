---
phase: 110-alto-index-e2e
plan: "01"
subsystem: testing
tags: [playwright, e2e, fixtures, alto-index, etl, fts5]

# Dependency graph
requires:
  - phase: 109-etl-test-infrastructure
    provides: importNativeCards, CanonicalCard interface, resetDatabase, assertCatalogRow in e2e/helpers/etl.ts
provides:
  - notes.json fixture with 250 cards (crosses FTS5 bulk rebuild threshold when combined with other types)
  - importAltoIndex() E2E helper that merges all 11 alto-index fixture types into a single import call
affects: [110-02, subsequent alto-index E2E specs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture regeneration via generator script with committed JSON as source of truth for CI determinism"
    - "importAltoIndex merges all 11 production fixture types (excludes edge-cases.json test-only source)"

key-files:
  created: []
  modified:
    - tests/fixtures/alto-index/generate-alto-fixtures.mjs
    - tests/fixtures/alto-index/notes.json
    - e2e/helpers/etl.ts

key-decisions:
  - "edge-cases.json excluded from importAltoIndex — uses source='alto_edge_cases' which is test-only, not a production subdirectory type"
  - "ESM __dirname pattern (fileURLToPath + import.meta.url) matches existing isometry.ts convention in e2e/helpers/"

patterns-established:
  - "importAltoIndex reads 11 fixture files from tests/fixtures/alto-index/ via fs.readFileSync, merges into single CanonicalCard[], calls importNativeCards with sourceType='alto_index'"

requirements-completed: [ALTO-01]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 110 Plan 01: Alto-Index Fixture Bump + importAltoIndex Helper Summary

**notes.json expanded to 250 cards (500 total across 11 fixture types) and importAltoIndex E2E helper added to load the full alto-index dataset in a single call**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-22T21:37:00Z
- **Completed:** 2026-03-22T21:42:40Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Bumped generate-alto-fixtures.mjs `generateNotes()` default count from 25 to 250 and regenerated notes.json with 250 CanonicalCard objects
- Total fixture count across 11 types is now 500 (510 with edge-cases.json), crossing the 501-card FTS5 bulk rebuild threshold required by subsequent specs
- Added `importAltoIndex()` to e2e/helpers/etl.ts: reads all 11 fixture files, merges into one array, calls `importNativeCards` with `sourceType='alto_index'`
- Added `fs`, `path`, and `fileURLToPath` imports using the same ESM `__dirname` pattern as the existing isometry.ts helper

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump notes.json fixture to 250 cards** - `821d509c` (feat)
2. **Task 2: Add importAltoIndex helper to e2e/helpers/etl.ts** - `4172e378` (feat)

**Plan metadata:** `b29a08ef` (docs: complete plan)

## Files Created/Modified
- `tests/fixtures/alto-index/generate-alto-fixtures.mjs` - generateNotes() default changed to 250, write call updated to 250
- `tests/fixtures/alto-index/notes.json` - Regenerated with 250 note cards (source='alto_notes')
- `e2e/helpers/etl.ts` - Added fs/path/fileURLToPath imports, __dirname definition, and importAltoIndex() function

## Decisions Made
- `edge-cases.json` excluded from `importAltoIndex` — its `source: 'alto_edge_cases'` is a test-only type, not one of the 11 production subdirectory types. Including it would pollute alto_index import counts with edge-case-specific data.
- Used `fileURLToPath(import.meta.url)` + `path.dirname` for `__dirname` to match the ESM convention already established in `e2e/helpers/isometry.ts`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. Pre-existing TypeScript errors in `src/worker/handlers/graph-algorithms.handler.ts` and `tests/seams/ui/dataset-eviction.test.ts` are out of scope; `e2e/helpers/etl.ts` passes tsc cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- notes.json has 250 cards; total fixture count is 510 (500 across 11 production types + 10 edge cases)
- `importAltoIndex` exported from `e2e/helpers/etl.ts` and ready for use in 110-02 spec file
- FTS5 bulk rebuild threshold (501 cards) will be crossed on import

---
*Phase: 110-alto-index-e2e*
*Completed: 2026-03-22*
