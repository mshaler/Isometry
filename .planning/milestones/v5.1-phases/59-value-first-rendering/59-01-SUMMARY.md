---
phase: 59-value-first-rendering
plan: 01
subsystem: ui
tags: [supergrid, spreadsheet, d3, css, fts5, value-first]

# Dependency graph
requires:
  - phase: 58-css-visual-baseline
    provides: "CSS class migration for SuperGrid cells (.sg-cell, data-view-mode, sg-row--alt)"
provides:
  - "Plain text card name rendering in spreadsheet cells (span.sg-cell-name)"
  - "+N overflow badge for multi-card cells (span.sg-cell-overflow-badge)"
  - "Card name cache (_cardNameCache Map) populated from query results"
  - "FTS5 mark highlighting adapted to .sg-cell-name elements"
  - "Search dimming works for spreadsheet cells (no longer neutralized by SuperCard)"
affects: [59-02, 60-column-resize, 61-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["value-first cell rendering: plain text name + overflow badge instead of pill widgets"]

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - src/styles/supergrid.css
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Spreadsheet cells show first card name as plain text, not card pills with SuperCard count badge"
  - "Overflow uses compact +N format (not +N more) for spreadsheet-native appearance"
  - "hasSuperCard check explicitly excludes spreadsheet mode to enable search dimming"
  - "FTS5 mark selector changed from .card-pill to .sg-cell-name"

patterns-established:
  - "Value-first rendering: spreadsheet cells show data values, matrix cells show interactive SuperCards"

requirements-completed: [VFST-01, VFST-02, VFST-04]

# Metrics
duration: 7min
completed: 2026-03-08
---

# Phase 59 Plan 01: Value-First Cell Rendering Summary

**Plain text card names with +N overflow badge replace pill/SuperCard rendering in SuperGrid spreadsheet cells, with adapted FTS5 mark highlighting**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-08T22:17:03Z
- **Completed:** 2026-03-08T22:24:11Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Spreadsheet cells now show plain text card names (span.sg-cell-name) instead of card pills and SuperCard count badges
- Multi-card cells display first card name + compact "+N" overflow badge (span.sg-cell-overflow-badge)
- Card name cache (_cardNameCache) populated from query results and cleared each _fetchAndRender cycle
- FTS5 search mark highlighting works with new .sg-cell-name DOM structure
- Search dimming correctly applies to spreadsheet cells (no longer neutralized by SuperCard presence)
- Matrix mode rendering completely unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Plain text cell rendering with +N badge and card name cache** - `079be7a8` (feat)
2. **Task 2: FTS5 mark highlighting adaptation for plain text cells** - `6c2fdd87` (test)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Replaced spreadsheet pill/SuperCard rendering with plain text name + badge; updated hasSuperCard check; updated FTS5 mark selector; added _cardNameCache
- `src/styles/supergrid.css` - Updated spreadsheet flex-direction to row; added .sg-cell-name and .sg-cell-overflow-badge rules
- `tests/views/SuperGrid.test.ts` - Added 9 new tests (5 VFST-01 + 4 VFST-04); updated 7 legacy tests for new DOM structure

## Decisions Made
- Used compact "+N" format (not "+N more") for overflow badge -- more spreadsheet-native
- Spreadsheet mode hasSuperCard explicitly returns false to enable search dimming (previously all spreadsheet cells were neutral to search due to SuperCard presence)
- Card name cache uses Map<string, string> for O(1) lookups, cleared at start of each _fetchAndRender

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 7 legacy tests asserting old pill/SuperCard behavior**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Existing tests (DENS-03 Tests 1-2, SRCH-03 x2, CARD-01 x2, CARD-02 spreadsheet) assert card-pill and SuperCard elements that no longer exist in spreadsheet mode
- **Fix:** Updated assertions to match new value-first DOM structure (.sg-cell-name, .sg-cell-overflow-badge, no .card-pill, no SuperCard in spreadsheet)
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 385 tests pass
- **Committed in:** 079be7a8 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test updates were necessary and expected -- the plan explicitly replaces the rendering approach. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Value-first rendering complete, ready for Phase 59 Plan 02 (column resize or additional spreadsheet features)
- All 385 SuperGrid tests pass, zero TypeScript errors in modified files, zero Biome diagnostics

---
*Phase: 59-value-first-rendering*
*Completed: 2026-03-08*

## Self-Check: PASSED
- All source files exist
- All commits verified (079be7a8, 6c2fdd87)
- SUMMARY.md created
