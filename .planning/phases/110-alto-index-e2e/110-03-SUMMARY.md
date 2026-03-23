---
phase: 110-alto-index-e2e
plan: "03"
subsystem: testing
tags: [e2e, playwright, fts5, fixtures, alto-index]

# Dependency graph
requires:
  - phase: 110-alto-index-e2e
    provides: E2E spec structure and importAltoIndex helper for alto-index pipeline tests
provides:
  - notes.json with 252 cards (total 502 fixtures crossing isBulkImport > 500 threshold)
  - FTS5 bulk rebuild code path exercised in E2E test suite
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixture count must strictly exceed threshold (not equal) to exercise bulk code path"

key-files:
  created: []
  modified:
    - tests/fixtures/alto-index/generate-alto-fixtures.mjs
    - tests/fixtures/alto-index/notes.json
    - e2e/alto-index.spec.ts

key-decisions:
  - "Two extra notes (250->252) chosen as minimal crossing of the strict > 500 threshold; avoids over-engineering"
  - "Spec assertion updated from toBeGreaterThanOrEqual(500) to toBeGreaterThan(500) to match the actual isBulkImport condition"

patterns-established:
  - "Gap closure: fixture counts must strictly exceed threshold values in production code, not merely match them"

requirements-completed:
  - ALTO-04

# Metrics
duration: 5min
completed: 2026-03-23
---

# Phase 110 Plan 03: FTS5 Bulk Rebuild Threshold Gap Closure Summary

**Bumped notes.json from 250 to 252 cards (total 502) so the FTS5 bulk rebuild code path (isBulkImport = totalCards > 500) is now exercised by the E2E test suite**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-23T02:46:00Z
- **Completed:** 2026-03-23T02:51:05Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments
- Identified that exactly 500 fixture cards left isBulkImport=false (strict > 500 threshold never crossed)
- Updated generate-alto-fixtures.mjs to use 252 as the default/call-site for generateNotes
- Regenerated notes.json with 252 cards, bringing total to 502
- Updated FTS5 describe block assertion from >= 500 to > 500 and test name to "502-card"

## Task Commits

Each task was committed atomically:

1. **Task 1: Bump notes fixture to 252 cards and update spec assertion** - `524c7835` (fix)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `tests/fixtures/alto-index/generate-alto-fixtures.mjs` - Changed generateNotes default and call from 250 to 252
- `tests/fixtures/alto-index/notes.json` - Regenerated with 252 cards (was 250)
- `e2e/alto-index.spec.ts` - FTS5 block: assertion strict > 500, test name updated, comments updated

## Decisions Made
- Two extra notes is the minimal change to cross the threshold without touching other fixture types
- toBeGreaterThan(500) precisely mirrors the production isBulkImport = totalCards > 500 condition

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- FTS5 bulk rebuild path is now covered by E2E
- Phase 110 gap closure complete; all 5 ALTO requirements exercised
- Ready to run full alto-index E2E suite: `npx playwright test e2e/alto-index.spec.ts`

---
*Phase: 110-alto-index-e2e*
*Completed: 2026-03-23*
