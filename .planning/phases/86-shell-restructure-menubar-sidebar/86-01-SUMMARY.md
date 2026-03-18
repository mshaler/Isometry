---
phase: 86-shell-restructure-menubar-sidebar
plan: 01
subsystem: ui
tags: [commandbar, workbench-shell, layout, css, typescript]

# Dependency graph
requires:
  - phase: 83-ui-control-seams-b
    provides: WorkbenchShell seam tests and two-column layout foundation
  - phase: 84-ui-polish
    provides: CollapsibleSection state model, explorer-backed section patterns
provides:
  - Restructured menubar with wordmark center, palette trigger left, 36px settings right
  - Two-column shell layout with 200px sidebar placeholder and flex-1 main content
  - getSidebarEl() method on WorkbenchShell for Plan 02 SidebarNav mounting
  - Removal of ViewTabBar from menubar and main.ts
affects:
  - 86-shell-restructure-menubar-sidebar (Plan 02 uses getSidebarEl() to mount SidebarNav)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "workbench-body flex-row wrapper pattern: CommandBar full-width top, then flex-row body with sidebar (fixed) + main (flex:1)"
    - "Wordmark non-interactive: pointer-events:none + user-select:none on span element"
    - "DEPRECATED comment pattern: mark removed CSS classes as DEPRECATED instead of deleting (dead code safety)"

key-files:
  created: []
  modified:
    - src/ui/CommandBar.ts
    - src/styles/workbench.css
    - src/ui/WorkbenchShell.ts
    - src/main.ts
    - tests/seams/ui/workbench-shell.test.ts
    - tests/ui/WorkbenchShell.test.ts

key-decisions:
  - "Keep app-icon button as palette trigger (left zone) rather than removing it — smaller footprint, consistent ARIA label, no behavior change"
  - "DEPRECATED CSS comment over deletion — .workbench-command-bar__input and .workbench-tab-bar-slot rules preserved as dead code with deprecation comment to avoid breaking hypothetical external consumers"
  - "getSidebarEl() replaces getTabBarSlot() as the public shell slot accessor — Plan 02 SidebarNav will mount here"

patterns-established:
  - "workbench-body pattern: two-column body wrapper below CommandBar using flex-row"

requirements-completed: [MENU-01, MENU-02, MENU-03, MENU-04]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 86 Plan 01: Shell Restructure (Menubar + Sidebar Layout) Summary

**Three-zone menubar with centered "Isometry" wordmark, 36px settings gear, and two-column shell layout (200px sidebar placeholder + flex-1 main) replacing single-column ViewTabBar layout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T04:15:14Z
- **Completed:** 2026-03-18T04:18:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Menubar now has exactly 3 zones: diamond palette trigger (left, 28px), "Isometry" wordmark (center, flex:1), settings gear (right, 36px enlarged from 28px)
- WorkbenchShell converted from single flex-column to two-column layout via `.workbench-body` wrapper with `.workbench-sidebar` (200px) and `.workbench-main` (flex:1)
- ViewTabBar completely removed from main.ts — views still switchable via Cmd+1..9 and command palette
- All 30 WorkbenchShell tests pass (10 seam + 20 unit), all 52 UI seam tests pass, zero src/ TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Restructure CommandBar DOM and CSS for menubar changes** - `3fc85060` (feat)
2. **Task 2: Convert WorkbenchShell to two-column layout, remove ViewSwitcher slot, and update seam tests** - `6af14813` (feat)

## Files Created/Modified

- `src/ui/CommandBar.ts` - Removed command input pill, added wordmark span (center, non-interactive)
- `src/styles/workbench.css` - Added wordmark CSS, enlarged settings trigger to 36px, added workbench-body/sidebar/main layout rules, deprecated tab-bar-slot
- `src/ui/WorkbenchShell.ts` - Two-column layout constructor, replaced _tabBarSlot with _sidebarEl, getTabBarSlot() -> getSidebarEl()
- `src/main.ts` - Removed ViewTabBar import and instantiation, simplified onViewSwitch callback
- `tests/seams/ui/workbench-shell.test.ts` - Updated WBSH-01b and WBSH-01f for new DOM structure
- `tests/ui/WorkbenchShell.test.ts` - Updated DOM order test and getTabBarSlot -> getSidebarEl test

## Decisions Made

- Keep app-icon button as palette trigger in left zone — no behavior change, smaller footprint than input pill
- DEPRECATED CSS comments over deletion — preserves dead code safely with explicit labeling
- getSidebarEl() is the new public slot accessor for Plan 02 SidebarNav mounting

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated tests/ui/WorkbenchShell.test.ts to match new DOM structure**
- **Found during:** Task 2 (WorkbenchShell conversion)
- **Issue:** Older unit test file at tests/ui/WorkbenchShell.test.ts referenced getTabBarSlot() and .workbench-tab-bar-slot — would break with removed method
- **Fix:** Updated DOM order test to check .workbench-body structure; replaced getTabBarSlot() test with getSidebarEl() test
- **Files modified:** tests/ui/WorkbenchShell.test.ts
- **Verification:** All 20 tests in file pass
- **Committed in:** 6af14813 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (blocking test fix)
**Impact on plan:** Required to prevent test suite failure. No scope creep.

## Issues Encountered

Pre-existing TypeScript errors in tests/seams/etl/etl-fts.test.ts, tests/seams/ui/calc-explorer.test.ts, and tests/views/GalleryView.test.ts — these are unrelated to Phase 86 changes and were present before execution. Zero src/ errors.

## Next Phase Readiness

- `.workbench-sidebar` DOM element is ready for Plan 02 SidebarNav mounting via `shell.getSidebarEl()`
- Two-column layout CSS (workbench-body, workbench-sidebar, workbench-main) is in place
- Menubar is clean with 3 zones, matching UAT spec requirements MENU-01..04

---
*Phase: 86-shell-restructure-menubar-sidebar*
*Completed: 2026-03-18*

## Self-Check: PASSED

- src/ui/CommandBar.ts: FOUND
- src/ui/WorkbenchShell.ts: FOUND
- src/styles/workbench.css: FOUND
- src/main.ts: FOUND
- .planning/phases/86-shell-restructure-menubar-sidebar/86-01-SUMMARY.md: FOUND
- Commit 3fc85060 (Task 1): FOUND
- Commit 6af14813 (Task 2): FOUND
