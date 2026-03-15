---
phase: 84-ui-polish
plan: 4
subsystem: ui
tags: [keyboard-navigation, aria, roving-tabindex, accessibility, a11y]

requires: []
provides:
  - Roving tabindex navigation in CommandBar settings menu (ArrowDown/Up/Home/End/Escape)
  - Roving tabindex navigation in ViewTabBar (ArrowRight/Left/Home/End with wrap-around)
  - 38 passing tests across CommandBar and ViewTabBar (17 new keyboard nav tests)
affects: [a11y, keyboard-users, WCAG compliance]

tech-stack:
  added: []
  patterns:
    - "Roving tabindex: one tabindex=0 per component, rest -1, updated on focus change"
    - "Document-level keydown handler for menu keyboard events (centralized in existing _onDocumentKeydown)"
    - "nav-level keydown for tablist keyboard events (ArrowRight/Left wrap-around)"

key-files:
  created:
    - tests/ui/ViewTabBar.test.ts
  modified:
    - src/ui/CommandBar.ts
    - tests/ui/CommandBar.test.ts

key-decisions:
  - "Committed tasks 1-4 (both source files) together since they form one atomic implementation unit"
  - "Extended existing _onDocumentKeydown handler for Arrow/Home/End rather than adding a second listener"
  - "ViewTabBar keydown listener placed on nav element to capture events from all child buttons via bubbling"

patterns-established:
  - "Roving tabindex pattern: tabindex=0 on active item, tabindex=-1 on all others, updated via _focusItem()"
  - "_moveFocus(delta) wraps using modulo: (current + delta + length) % length"

requirements-completed: [WA4]

duration: 8min
completed: 2026-03-15
---

# Phase 84 Plan 4: Keyboard navigation for CommandBar menu and ViewTabBar Summary

**Roving tabindex ARIA keyboard contracts for CommandBar (ArrowDown/Up/Home/End/Escape) and ViewTabBar (ArrowRight/Left/Home/End) with 38 passing tests**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-15T16:57:00Z
- **Completed:** 2026-03-15T16:59:30Z
- **Tasks:** 5
- **Files modified:** 3 (CommandBar.ts, ViewTabBar.ts, CommandBar.test.ts) + 1 created (ViewTabBar.test.ts)

## Accomplishments

- CommandBar: added `_getMenuItems()`, `_focusItem()`, `_moveFocus()` private helpers implementing roving tabindex pattern
- CommandBar: `_createMenuItem()` now sets `tabindex="-1"` on all items; `_openDropdown()` focuses first item and sets `tabindex="0"`
- CommandBar: extended `_onDocumentKeydown` with ArrowDown/Up/Home/End/Escape cases — Escape now returns focus to trigger
- ViewTabBar: initial tabindex in constructor (first tab = 0, rest = -1); `setActive()` updates tabindex alongside aria-selected; nav keydown listener for ArrowRight/Left/Home/End with wrap-around
- 17 new keyboard navigation tests added; all 38 tests (21 existing + 17 new) pass with zero regressions

## Task Commits

1. **Tasks 1-4: Source implementation** - `86686a82` (feat)
2. **Task 5: Keyboard navigation tests** - `a8d0dbc2` (test)

## Files Created/Modified

- `src/ui/CommandBar.ts` - Added roving tabindex helpers, tabindex on menu items, extended keydown handler
- `src/ui/ViewTabBar.ts` - Added initial tabindex in constructor, tabindex in setActive(), keydown listener on nav
- `tests/ui/CommandBar.test.ts` - Added 7 keyboard navigation tests (28 total)
- `tests/ui/ViewTabBar.test.ts` - Created with 10 tests (lifecycle, roving tabindex, arrow key navigation)

## Decisions Made

- Tasks 1-4 committed together as one atomic implementation commit since both source files implement the same ARIA pattern and are meaningless without each other.
- Extended the existing `_onDocumentKeydown` handler in CommandBar rather than adding a second document listener, keeping the centralized dismiss logic clean.
- ViewTabBar keydown listener placed on the `nav` element so it captures keyboard events from all child tab buttons via bubbling — no per-button listeners needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in unrelated files (SuperGrid, AppDialog) were confirmed pre-existing and out of scope.

## Next Phase Readiness

- Keyboard navigation contracts fulfilled for CommandBar menu and ViewTabBar
- WA4 requirement complete
- Both components now WCAG 2.1 compliant for keyboard interaction patterns

---
*Phase: 84-ui-polish*
*Completed: 2026-03-15*
