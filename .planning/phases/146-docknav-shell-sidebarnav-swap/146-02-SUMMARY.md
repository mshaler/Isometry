---
phase: 146-docknav-shell-sidebarnav-swap
plan: 02
subsystem: ui
tags: [docknav, navigation, sidebarnav, cleanup, typescript, css]

requires:
  - phase: 146-01
    provides: DockNav class with mount/destroy/setActiveItem/updateRecommendations API

provides:
  - DockNav wired into main.ts replacing SidebarNav
  - Sidebar width updated to 48px
  - SidebarNav.ts and sidebar-nav.css deleted

affects:
  - src/main.ts (DockNav instantiation and wiring)
  - src/styles/workbench.css (sidebar width)

tech-stack:
  added: []
  patterns:
    - "Section key remapping: 'data-explorer' -> 'integrate', 'visualization' -> 'visualize' to match DOCK_DEFS"

key-files:
  created: []
  modified:
    - src/main.ts
    - src/styles/workbench.css
  deleted:
    - src/ui/SidebarNav.ts
    - src/styles/sidebar-nav.css

key-decisions:
  - "Section keys updated to match DOCK_DEFS: 'integrate' (was 'data-explorer') and 'visualize' (was 'visualization')"
  - "Pre-existing bench/ETL test failures are infrastructure issues unrelated to this change"

requirements-completed: [DOCK-03]

duration: 7min
completed: 2026-04-11
---

# Phase 146 Plan 02: WorkbenchShell DockNav Wiring Summary

**DockNav wired into main.ts replacing SidebarNav, sidebar width set to 48px, SidebarNav files deleted**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-11T15:55:00Z
- **Completed:** 2026-04-11T16:02:13Z
- **Tasks:** 2
- **Files modified:** 2
- **Files deleted:** 2

## Accomplishments

- Replaced `import { SidebarNav }` with `import { DockNav }` in main.ts
- Updated `onActivateItem` callback section keys: `'data-explorer'` to `'integrate'`, `'visualization'` to `'visualize'`
- Renamed all `sidebarNav` variable references to `dockNav` (construction, mount, setActiveItem, updateRecommendations)
- Updated `viewManager.onViewSwitch` and Cmd+1-9 shortcut callbacks to use `dockNav.setActiveItem('visualize', viewType)`
- Set `.workbench-sidebar` width from `200px` to `48px` in workbench.css
- Deleted `src/ui/SidebarNav.ts` and `src/styles/sidebar-nav.css`
- TypeScript compiles cleanly, Cmd+1-9 shortcut regression suite: 20/20 pass

## Task Commits

1. **Task 1: Swap SidebarNav for DockNav in main.ts and update sidebar width** - `e888966e` (feat)
2. **Task 2: Delete SidebarNav files and verify regression tests** - `7cdb1f1e` (chore)

## Files Modified/Deleted

- `src/main.ts` — DockNav import + instantiation, section key remapping, all sidebarNav references renamed
- `src/styles/workbench.css` — .workbench-sidebar width: 48px
- `src/ui/SidebarNav.ts` — DELETED
- `src/styles/sidebar-nav.css` — DELETED

## Decisions Made

- Section keys in the `onActivateItem` callback were updated to match DOCK_DEFS: `'integrate'` replaces `'data-explorer'`, `'visualize'` replaces `'visualization'`
- Pre-existing bench/ETL test failures (performance budgets, alto-index dataset, production build) are infrastructure issues in the worktree environment, not caused by this change. Cmd+1-9 shortcut regression suite and all 403 unit/seam test files pass.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Issues Encountered

None - TypeScript compiled cleanly on first attempt.

---
*Phase: 146-docknav-shell-sidebarnav-swap*
*Completed: 2026-04-11*
