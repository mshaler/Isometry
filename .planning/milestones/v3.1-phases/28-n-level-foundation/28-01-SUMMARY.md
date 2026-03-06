---
phase: 28-n-level-foundation
plan: 01
subsystem: ui
tags: [supergrid, pafv, compound-keys, n-level, stacking, d3]

# Dependency graph
requires: []
provides:
  - PAFVProvider accepts any number of axes per dimension (no depth limit)
  - Shared compound key utility at src/views/supergrid/keys.ts (single source of truth)
  - buildDimensionKey: \x1f-joined string for N-level dimension keys
  - buildCellKey: row\x1e col compound key for cell identification
  - parseCellKey: splits compound key at first \x1e boundary
  - findCellInData: O(N) reverse-lookup by compound key
affects:
  - 28-02 (SuperGrid N-level cell key refactor will import keys.ts)
  - 28-03 (SuperGridSelect cell lookup will use findCellInData)
  - 28-04 (BBoxCache keying will use buildCellKey)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Compound key format: \\x1f within dimension, \\x1e between dimensions — matches SuperStackHeader parentPath"
    - "Null/undefined axis values coerce to 'None' — matches existing SuperGrid convention"
    - "TDD red-green: write failing tests first, implement minimum to pass"

key-files:
  created:
    - src/views/supergrid/keys.ts
    - tests/views/supergrid/keys.test.ts
  modified:
    - src/providers/PAFVProvider.ts
    - src/views/supergrid/SuperGridQuery.ts
    - tests/providers/PAFVProvider.test.ts

key-decisions:
  - "Depth limit removed from PAFVProvider._validateStackedAxes — any number of axes per dimension now allowed"
  - "Compound key separators: \\x1f (UNIT_SEP) within a dimension, \\x1e (RECORD_SEP) between row and col dimensions"
  - "findCellInData uses O(N) scan via buildCellKey — acceptable for SuperGrid cell counts (hundreds)"

patterns-established:
  - "keys.ts is the single source of truth for all SuperGrid key construction and parsing"
  - "buildCellKey = buildDimensionKey(row) + \\x1e + buildDimensionKey(col)"
  - "parseCellKey splits only at first \\x1e — any additional occurrences go into colKey"

requirements-completed: [STAK-01, STAK-02]

# Metrics
duration: 4min
completed: 2026-03-05
---

# Phase 28 Plan 01: N-Level Foundation Summary

**PAFVProvider depth cap removed and shared compound key utility created using \x1f/\x1e separator convention matching SuperStackHeader parentPath**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-05T22:37:01Z
- **Completed:** 2026-03-05T22:40:54Z
- **Tasks:** 2
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments

- Removed the hard 3-axis-per-dimension limit from PAFVProvider._validateStackedAxes — N-level stacking now unblocked at the provider layer (STAK-01)
- Created src/views/supergrid/keys.ts as the single source of truth for all SuperGrid key construction and parsing, with 4 exported functions and 2 separator constants (STAK-02)
- Full TDD cycle completed: RED (tests fail against old code), GREEN (implementation passes), all 150 tests pass across both test files
- JSDoc updated in PAFVProvider and SuperGridQuery to remove "Maximum 3" and "Up to 3" references

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove PAFVProvider 3-axis cap and update tests** - `bfd1398e` (feat)
2. **Task 2: Create shared compound key utility (keys.ts)** - `f83f2bc7` (feat)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN), committed together per task_

## Files Created/Modified

- `src/providers/PAFVProvider.ts` — Removed `if (axes.length > 3)` block; updated JSDoc on _validateStackedAxes, setColAxes, setRowAxes
- `src/views/supergrid/SuperGridQuery.ts` — Updated colAxes/rowAxes JSDoc from "Up to 3" to "any number (N-level stacking supported)"
- `tests/providers/PAFVProvider.test.ts` — Changed 4-axis tests from toThrow to not.toThrow; added 7-distinct-col and 5-distinct-row tests
- `src/views/supergrid/keys.ts` — New shared utility: UNIT_SEP, RECORD_SEP, buildDimensionKey, buildCellKey, parseCellKey, findCellInData
- `tests/views/supergrid/keys.test.ts` — 28 tests covering separators, 1-4 level axes, null/undefined coercion, edge cases for all 4 functions

## Decisions Made

- Depth limit entirely removed (not increased to a higher number) — any number of axes is valid, only duplicate-field and SQL-allowlist constraints remain
- Separator choice confirmed: \x1f (UNIT_SEP) within a single dimension's key, \x1e (RECORD_SEP) between the row and col dimension keys — exactly matching SuperStackHeader's parentPath convention
- findCellInData uses O(N) linear scan via buildCellKey comparison — no index structure needed at SuperGrid cell counts

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- PAFVProvider now accepts 4+ axes per dimension — Plan 02 can wire N-level axes into SuperGrid row header rendering and D3 cell key function without hitting any provider-level barrier
- keys.ts is ready for import by SuperGrid, SuperGridSelect, and BBoxCache in Plan 02
- All existing 122 PAFVProvider tests still pass — no regressions

---
*Phase: 28-n-level-foundation*
*Completed: 2026-03-05*
