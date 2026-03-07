---
phase: 43-empty-states-first-launch
plan: 01
subsystem: ui
tags: [empty-state, welcome-panel, import-cta, filter, viewmanager, css]

# Dependency graph
requires:
  - phase: 05-view-lifecycle
    provides: ViewManager with _showEmpty(), _fetchAndRender()
  - phase: 04-filter-provider
    provides: FilterProvider.resetToDefaults() for Clear Filters action
provides:
  - Contextual empty states: welcome panel, filtered-empty, view-specific messages
  - FilterProviderLike narrow interface for ViewManager dependency injection
  - VIEW_EMPTY_MESSAGES constant with icon/heading/description for all 9 view types
  - Import File and Import from Mac CTA event wiring in main.ts
affects: [43-02-density-empty, 44-keyboard-shortcuts, native-import]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async empty state detection via unfiltered COUNT query"
    - "Narrow interface pattern (FilterProviderLike) for cross-provider dependency"
    - "CustomEvent bridge between ViewManager CTAs and main.ts import handlers"

key-files:
  created: []
  modified:
    - src/views/ViewManager.ts
    - src/styles/views.css
    - src/main.ts
    - tests/views/ViewManager.test.ts
    - tests/views/transitions.test.ts

key-decisions:
  - "Unfiltered COUNT query distinguishes welcome (0 cards) from filtered-empty (>0 cards hidden)"
  - "FilterProviderLike kept narrow in ViewManager.ts, not in types.ts"
  - "Import CTAs use CustomEvent dispatch, main.ts handles native/web file picker branching"
  - "VIEW_EMPTY_MESSAGES uses Unicode symbols for icons (no external icon library)"

patterns-established:
  - "Async _showEmpty() with bridge count query for contextual detection"
  - "CustomEvent pattern for cross-component communication without tight coupling"

requirements-completed: [EMPTY-01, EMPTY-02, EMPTY-03]

# Metrics
duration: 10min
completed: 2026-03-07
---

# Phase 43 Plan 01: Empty States + First Launch Summary

**Contextual empty states with welcome panel (Import File/Import from Mac CTAs), filtered-empty with Clear Filters + view-specific messages for all 9 views**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-07T19:38:43Z
- **Completed:** 2026-03-07T19:48:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Welcome panel (EMPTY-01) shows "Welcome to Isometry" with Import File CTA when DB has zero cards
- Filtered-empty panel (EMPTY-02) shows view-specific message + Clear Filters button when filters hide all results
- View-specific messages (EMPTY-03) for all 9 views: list, grid, kanban, calendar, timeline, gallery, network, tree, supergrid
- Import File button triggers file picker (web: ephemeral input, native: Swift bridge message)
- Import from Mac button (native-only) triggers Swift ImportSourcePickerView
- 8 new tests covering all empty state modes, CTA interactions, and view-specific headings

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Add failing tests** - `85c8e460` (test)
2. **Task 1 (GREEN): Implement contextual empty states** - `cbbccc42` (feat)
3. **Task 2: Wire import CTAs in main.ts** - `2ad62bfb` (feat)

_TDD: Task 1 followed red-green-refactor. Refactor was minimal (no separate commit needed)._

## Files Created/Modified
- `src/views/ViewManager.ts` - FilterProviderLike interface, VIEW_EMPTY_MESSAGES, async _showEmpty(), _showWelcome(), _showFilteredEmpty()
- `src/styles/views.css` - .view-empty-panel, .view-empty-heading, .import-file-btn, .clear-filters-btn styles
- `src/main.ts` - Pass filter to ViewManager, import event listeners (isometry:import-file, isometry:import-native)
- `tests/views/ViewManager.test.ts` - 8 new tests for contextual empty states, updated 3 existing tests for async count query
- `tests/views/transitions.test.ts` - Added filter to ViewManagerConfig mock

## Decisions Made
- Used unfiltered COUNT query (not QueryBuilder) to distinguish welcome vs filtered-empty -- QueryBuilder applies filters which would always return 0 in both cases
- FilterProviderLike kept narrow in ViewManager.ts (not shared types.ts) because only resetToDefaults() is needed
- Import CTA buttons dispatch CustomEvents rather than directly calling import code -- decouples ViewManager from import infrastructure
- VIEW_EMPTY_MESSAGES uses Unicode text symbols (trigram, grid, calendar emoji) rather than external icon library

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 existing tests broken by async _showEmpty()**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** Existing tests used simple mock bridge that didn't handle the new count query call from _showEmpty()
- **Fix:** Updated "clears loading spinner" test to resolve both card and count queries, "retry button" test to accept >= 2 calls, "shows empty state" test to use makeMockBridgeWithCount
- **Files modified:** tests/views/ViewManager.test.ts
- **Verification:** All 27 tests pass
- **Committed in:** cbbccc42 (GREEN phase commit)

**2. [Rule 3 - Blocking] Fixed transitions.test.ts ViewManagerConfig**
- **Found during:** Task 1 (GREEN phase, tsc check)
- **Issue:** transitions.test.ts creates ViewManager without filter property, causing TS2345
- **Fix:** Added `filter: { resetToDefaults: vi.fn() }` to ViewManagerConfig in test
- **Files modified:** tests/views/transitions.test.ts
- **Verification:** tsc --noEmit passes
- **Committed in:** cbbccc42 (GREEN phase commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Parallel phase executions (44, 45, 46) had uncommitted changes in the working tree that were swept into the GREEN phase commit. This included .planning/ state files and a 43-02-SUMMARY.md. The actual code changes are correct and isolated.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Empty state infrastructure complete, ready for Plan 02 (density-aware empty state in SuperGrid)
- Native Swift side may need handlers for `native:request-file-import` and `native:show-import-source-picker` messages
- All 27 ViewManager tests pass, zero TypeScript errors, biome lint clean

---
*Phase: 43-empty-states-first-launch*
*Completed: 2026-03-07*
