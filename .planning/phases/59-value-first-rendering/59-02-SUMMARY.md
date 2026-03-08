---
phase: 59-value-first-rendering
plan: 02
subsystem: ui
tags: [supergrid, spreadsheet, tooltip, hover, overflow-badge, selection]

# Dependency graph
requires:
  - phase: 59-value-first-rendering
    plan: 01
    provides: "Plain text card name + overflow badge rendering in spreadsheet cells"
provides:
  - "Hover-triggered tooltip on +N overflow badge showing all card names"
  - "Click-to-select in tooltip via addToSelection"
  - "150ms mouseleave dismiss delay for cursor movement tolerance"
  - "Comprehensive VFST-03 and VFST-05 regression tests"
affects: [60-column-resize, 61-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: ["hover-triggered tooltip with mouseleave delay for cursor movement tolerance"]

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Overflow tooltip uses same visual styling as SuperCard tooltip (inline styles matching design tokens)"
  - "150ms dismiss delay allows cursor movement from badge to tooltip without flickering"
  - "Card names resolved from _cardNameCache first, then d.cardNames fallback, then cardId"
  - "No additional CSS rules needed -- tooltip styled inline matching existing pattern"

patterns-established:
  - "Hover tooltip with delayed dismiss: mouseenter opens, mouseleave starts timer, re-enter cancels timer"

requirements-completed: [VFST-03, VFST-05]

# Metrics
duration: 11min
completed: 2026-03-08
---

# Phase 59 Plan 02: Overflow Badge Tooltip Summary

**Hover-triggered tooltip on +N overflow badge with all card names, click-to-select, and delayed dismiss for cursor movement tolerance**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-08T22:27:05Z
- **Completed:** 2026-03-08T22:38:06Z
- **Tasks:** 1 (TDD: red-green-refactor)
- **Files modified:** 2

## Accomplishments
- Hovering the +N overflow badge opens a tooltip listing ALL card names in the cell
- Clicking a card name in the tooltip adds it to the selection set via addToSelection
- Tooltip dismisses on mouseleave with 150ms delay, allowing cursor movement from badge to tooltip
- Only one tooltip open at a time (close previous before opening new)
- Tooltip cleanup in _renderCells and destroy() prevents orphaned DOM elements
- 5 VFST-03 tests and 1 VFST-05 comprehensive regression test added (391 total tests pass)

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests for overflow badge tooltip** - `ab00e5ec` (test)
2. **Task 1 (GREEN): Implement overflow tooltip with click-to-select** - `f500d0bd` (feat)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Added _openOverflowTooltip, _closeOverflowTooltip methods; mouseenter/mouseleave on badge; cleanup in _renderCells and destroy()
- `tests/views/SuperGrid.test.ts` - Added 6 new tests: 5 VFST-03 (badge mouseenter, card names, count header, no badge on single-card, dismiss delay) + 1 VFST-05 regression

## Decisions Made
- Overflow tooltip follows identical visual pattern to existing SuperCard tooltip (same background, border, shadow, font tokens via inline styles) for consistency
- 150ms dismiss delay chosen to match common tooltip hover tolerance (enough for cursor movement, short enough to feel responsive)
- Card name resolution chain: _cardNameCache -> d.cardNames[i] -> cardId (fallback to raw ID if name unavailable)
- No CSS rules added -- .sg-cell-overflow-badge from Plan 01 already has correct cursor:default per locked decision

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test timer strategy for async mount + timer assertions**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Tests using vi.useFakeTimers() in beforeEach caused async mount (await new Promise(setTimeout)) to hang indefinitely
- **Fix:** Non-timer tests use real timers; dismiss delay test enables fake timers inline with vi.advanceTimersByTimeAsync for mount
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 391 tests pass
- **Committed in:** f500d0bd (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test timer fix was necessary for test reliability. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 59 (Value-First Rendering) complete with all 5 VFST requirements satisfied
- Ready for Phase 60 (Column Resize) or Phase 61 (Polish)
- All 391 SuperGrid tests pass, zero TypeScript errors in modified files, zero Biome diagnostics

---
*Phase: 59-value-first-rendering*
*Completed: 2026-03-08*

## Self-Check: PASSED
- All source files exist
- All commits verified (ab00e5ec, f500d0bd)
- SUMMARY.md created
