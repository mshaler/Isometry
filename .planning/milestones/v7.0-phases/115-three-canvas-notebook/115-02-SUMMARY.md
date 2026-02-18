---
phase: 115-three-canvas-notebook
plan: 02
subsystem: ui
tags: [react, selection-context, tiptap, vitest, notebook, capture]

# Dependency graph
requires:
  - phase: 115-01
    provides: resizable panels and NotebookLayout three-canvas structure
  - phase: 113-02
    provides: SelectionContext with lastSelectedId cross-canvas sync
provides:
  - Capture pane shows multi-select count badge when >1 cards selected in Preview
  - Capture pane shows "In Preview" indicator when single-selected card matches active
  - Reverse sync via isometry:load-card custom event (future card picker integration)
  - 7 unit tests covering bidirectional selection sync scenarios
affects: [115-03, 115-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useRef-based stable callback pattern for event listeners (syncAndLoadRef)"
    - "Custom event bus (isometry:load-card) for future Capture card picker reverse sync"
    - "Deep-provider mock pattern for CaptureComponent test isolation"

key-files:
  created:
    - src/components/notebook/__tests__/CaptureSelectionSync.test.tsx
  modified:
    - src/components/notebook/CaptureComponent.tsx

key-decisions:
  - "SYNC-03-REF-01: syncAndLoadRef (useRef + reassignment) instead of useCallback for reverse sync — avoids stale closure issues with selectionSelect and loadCard without adding them to event listener dependencies"
  - "SYNC-03-EVENT-01: isometry:load-card custom event for reverse sync enables future card picker to trigger sync without prop drilling"
  - "INDICATOR-01: 'In Preview' badge only shown for single selection (not multi-select) to avoid noise when primary view is count badge"

patterns-established:
  - "Selection badge pattern: show count when >1 selected, show context label when exactly 1 matches active card"
  - "Event-driven reverse sync: custom event bus decouples card picker (not yet built) from CaptureComponent internals"

# Metrics
duration: 5min
completed: 2026-02-17
---

# Phase 115 Plan 02: Selection Sync Summary

**Bidirectional SelectionContext sync in CaptureComponent: multi-select count badge, single-select "In Preview" indicator, and event-driven reverse sync for future card picker**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-17T18:44:03Z
- **Completed:** 2026-02-17T18:49:00Z
- **Tasks:** 2
- **Files modified:** 2 (1 modified, 1 created)

## Accomplishments
- Added multi-select count indicator ("N selected") in Capture header, visible when Preview has >1 cards selected
- Added "In Preview" badge when single-selected Preview card matches the Capture active card
- Implemented `syncAndLoadRef` pattern for reverse sync (Capture -> SelectionContext) triggered by `isometry:load-card` custom event
- Created 7 unit tests covering all sync scenarios with deep-provider mock isolation

## Task Commits

Each task was committed atomically:

1. **Task 1: Enhance CaptureComponent selection response** - `f093d9ff` (feat)
2. **Task 2: Add selection sync tests** - `9c1314bb` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/components/notebook/CaptureComponent.tsx` - Added selection count badge, "In Preview" indicator, syncAndLoadRef reverse sync pattern, isometry:load-card event listener
- `src/components/notebook/__tests__/CaptureSelectionSync.test.tsx` - 7 tests: count badge, single/no select, loadCard on lastSelectedId change, reverse sync via custom event, cleanup on unmount

## Decisions Made
- **SYNC-03-REF-01:** Used `useRef` for the `syncAndLoadRef` callback instead of `useCallback` to avoid adding `selectionSelect` and `loadCard` to the event listener's `useEffect` dependency array. This prevents re-registering the event listener on every selection change.
- **SYNC-03-EVENT-01:** Used `isometry:load-card` custom event (matching existing `isometry:save-card` and `isometry:send-to-shell` patterns in the component) for the reverse sync entry point. This decouples the future card picker UI from CaptureComponent internals.
- **INDICATOR-01:** "In Preview" badge only shown for `selectedIds.size === 1` — when multi-select is active, the count badge takes precedence. Avoids showing both simultaneously.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted mock strategy for CaptureComponent test isolation**
- **Found during:** Task 2 (test creation)
- **Issue:** Plan specified mocking `useCardLoader` hook, but CaptureComponent uses `useNotebook` (from NotebookContext) and `useTipTapEditor` (from `@/hooks`) — no `useCardLoader` exists in the codebase
- **Fix:** Mocked `useNotebook` and `useTipTapEditor` directly, plus ThemeContext and SQLiteProvider. Used same deep-provider mock approach as existing PreviewComponent.persistence.test.tsx
- **Files modified:** CaptureSelectionSync.test.tsx
- **Verification:** All 7 tests pass
- **Committed in:** 9c1314bb (Task 2 commit)

**2. [Rule 1 - Bug] Fixed test regex collision with EmptyCardView text**
- **Found during:** Task 2 (test run)
- **Issue:** `queryByText(/selected/i)` matched "No card selected" in EmptyCardView, causing false positive on "nothing selected" test
- **Fix:** Changed to `queryByText(/\d+ selected/i)` to match only the count badge pattern
- **Files modified:** CaptureSelectionSync.test.tsx
- **Verification:** Test 3 passes, all 7 pass
- **Committed in:** 9c1314bb (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug/mismatch corrections)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- TypeScript "declared but never read" error for `handleLoadCard` in Task 1 — resolved by adopting `syncAndLoadRef` pattern that satisfies both the TS compiler and the plan's reverse sync requirement without dead code.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Selection sync complete: Preview -> Capture (load card on lastSelectedId) and Capture -> SelectionContext (reverse sync via event)
- Ready for Plan 115-03: Cross-Canvas Messaging (Shell integration)
- No blockers

---
*Phase: 115-three-canvas-notebook*
*Completed: 2026-02-17*
