---
phase: 31-drag-reorder
plan: 01
subsystem: providers
tags: [pafv, reorder, collapse, persistence, supergrid]

# Dependency graph
requires:
  - phase: 30-collapse-system
    provides: collapse state accessors (CLPS-05), collapse key format (level\x1fparentPath\x1fvalue)
provides:
  - reorderColAxes(fromIndex, toIndex) on PAFVProvider — non-destructive axis splice
  - reorderRowAxes(fromIndex, toIndex) on PAFVProvider — non-destructive axis splice
  - _remapCollapseKeys helper — level swap for 2-axis stacks, clear for 3+
  - SuperGridProviderLike interface updated with reorder methods
  - 20 TDD tests covering reorder behavior + persistence round-trip
affects: [31-02 (visual drag UX depends on reorder methods), supergrid]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "reorderColAxes/reorderRowAxes splice axes without resetting colWidths/sortOverrides/collapseState"
    - "_remapCollapseKeys: level swap for 2-axis stacks, clear for 3+ (pragmatic simplification)"
    - "Shared _reorderAxes private method handles both col and row dimensions"

key-files:
  created: []
  modified:
    - src/providers/PAFVProvider.ts
    - src/views/types.ts
    - tests/providers/PAFVProvider.test.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Collapse keys cleared for 3+ axis stacks on reorder (pragmatic — parentPath encoding makes surgical remap error-prone)"
  - "2-axis stack collapse keys get level index swap (parentPath is trivial at 2 levels)"
  - "Shared _reorderAxes private method handles both dimensions to avoid code duplication"

patterns-established:
  - "reorder methods preserve colWidths/sortOverrides (field-based, not index-based)"
  - "All inline SuperGridProviderLike mocks must include reorderColAxes/reorderRowAxes stubs"

requirements-completed: [DRAG-REORDER-BACKEND]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 31 Plan 01: Reorder Backend Summary

**PAFVProvider reorderColAxes/reorderRowAxes with non-destructive axis splice, collapse key remapping for 2-level stacks, and persistence round-trip validation**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T20:26:16Z
- **Completed:** 2026-03-06T20:31:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added reorderColAxes and reorderRowAxes methods that splice axes in-place without resetting colWidths, sortOverrides, or collapseState
- Implemented _remapCollapseKeys: swaps level indices for 2-axis stacks, clears collapse state for 3+ axis stacks (pragmatic simplification)
- Updated SuperGridProviderLike interface and all 30+ inline test mocks with reorder method stubs (zero test regressions)
- 20 new TDD tests: 13 for reorder behavior + 7 for persistence round-trip (total 157 PAFVProvider tests, 330 SuperGrid tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: PAFVProvider reorderColAxes/reorderRowAxes + collapse key remapping** - `0a29ea57` (feat)
2. **Task 2: Persistence round-trip tests for reordered axis order and collapse state** - `27f77596` (test)

## Files Created/Modified
- `src/providers/PAFVProvider.ts` - Added reorderColAxes, reorderRowAxes, _reorderAxes, _remapCollapseKeys methods
- `src/views/types.ts` - Added reorderColAxes/reorderRowAxes to SuperGridProviderLike interface
- `tests/providers/PAFVProvider.test.ts` - 20 new tests: reorder splice, preservation, no-op guards, collapse key remap, persistence round-trip
- `tests/views/SuperGrid.test.ts` - Updated all 30+ inline SuperGridProviderLike mocks with reorder method stubs

## Decisions Made
- Collapse keys cleared for 3+ axis stacks on reorder: parentPath encoding makes surgical remap error-prone at 3+ levels. Users' collapsed headers reset on 3+ level reorder.
- 2-axis stack collapse keys get level index swap: at 2 levels, parentPath is either empty (level 0) or a single value (level 1), making swap safe.
- Shared _reorderAxes private method handles both col and row dimensions to avoid code duplication.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- reorderColAxes and reorderRowAxes are ready for Plan 02 to wire into the SuperGrid drop handler
- Plan 02 should call reorderColAxes/reorderRowAxes for same-dimension drops (instead of setColAxes/setRowAxes)
- All existing test infrastructure updated and passing

## Self-Check: PASSED

- All 4 modified files exist on disk
- Commits 0a29ea57 and 27f77596 verified in git log
- reorderColAxes, reorderRowAxes, _remapCollapseKeys methods confirmed in PAFVProvider.ts
- 157 PAFVProvider tests pass, 330 SuperGrid tests pass

---
*Phase: 31-drag-reorder*
*Completed: 2026-03-06*
