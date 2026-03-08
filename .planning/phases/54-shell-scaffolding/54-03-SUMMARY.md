---
phase: 54-shell-scaffolding
plan: 03
subsystem: ui
tags: [workbench-shell, dom-orchestrator, re-root, view-tab-bar, focus-mode, overlay-migration]

# Dependency graph
requires:
  - phase: 54-shell-scaffolding plan 01
    provides: CollapsibleSection reusable primitive and workbench.css foundation
  - phase: 54-shell-scaffolding plan 02
    provides: CommandBar component with callback-based config and settings dropdown
provides:
  - WorkbenchShell DOM orchestrator creating vertical stack layout under #app
  - ViewManager re-rooted from #app to .workbench-view-content sub-element
  - ViewTabBar mountTarget option for explicit slot mounting (backward compatible)
  - Overlays (HelpOverlay, CommandPalette) mounted to document.body
  - Toasts (ImportToast, ActionToast) mounted to document.body
  - Collapse-all focus mode toggle (Cmd+backslash) with state save/restore
  - Full main.ts wiring of WorkbenchShell with all providers and overlays
affects: [55, 56, 57, future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [WorkbenchShell thin DOM orchestrator, mountTarget option for explicit slot mounting, overlay migration to document.body]

key-files:
  created:
    - src/ui/WorkbenchShell.ts
    - tests/ui/WorkbenchShell.test.ts
  modified:
    - src/ui/ViewTabBar.ts
    - src/main.ts

key-decisions:
  - "DensityProvider granularity cycling (day/week/month/quarter/year) for CommandBar density item -- DensityMode type does not exist in codebase"
  - "AuditOverlay stays on #app container (not document.body) -- fixed-position button and .audit-mode class toggle both work correctly on container"
  - "Forward-declared viewManager and toast variables with let -- closures in shortcuts/commands capture variable reference, assigned after WorkbenchShell creation"

patterns-established:
  - "WorkbenchShell as thin DOM orchestrator: creates layout, instantiates children, exposes mount points -- zero business logic"
  - "mountTarget option: backward-compatible explicit mount target for components that previously used insertBefore DOM positioning"
  - "Overlay body migration: overlays and toasts mount to document.body for z-index stacking above the shell flex layout"

requirements-completed: [SHEL-01, SHEL-04, SHEL-05, INTG-02, INTG-05]

# Metrics
duration: 6min
completed: 2026-03-08
---

# Phase 54 Plan 03: WorkbenchShell Integration Summary

**WorkbenchShell orchestrator creating CommandBar-ViewTabBar-PanelRail-ViewContent DOM hierarchy with ViewManager re-rooting, overlay migration to document.body, and collapse-all focus mode toggle**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-08T05:09:18Z
- **Completed:** 2026-03-08T05:15:21Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- WorkbenchShell orchestrator creates .workbench-shell flex-column layout with 4 zones: CommandBar, tab-bar-slot, panel-rail (4 CollapsibleSections), view-content
- ViewManager re-rooted from #app to shell.getViewContentEl() -- all 2654 tests pass (364 SuperGrid tests unchanged)
- Overlays (HelpOverlay, CommandPalette) and toasts (ImportToast, ActionToast) migrated to document.body for z-index stacking above shell
- Collapse-all focus mode toggle (Cmd+\) saves section states before collapsing, restores on toggle back
- ViewTabBar accepts mountTarget option for explicit slot mounting into WorkbenchShell layout

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkbenchShell orchestrator with tests (TDD)** - `6e053fb2` (feat)
2. **Task 2: ViewTabBar mount target + main.ts re-wiring** - `f56cb8fa` (feat)

_Task 1 followed TDD: RED (import fails, no source file) -> GREEN (all 12 tests pass)_

## Files Created/Modified
- `src/ui/WorkbenchShell.ts` - Thin DOM orchestrator creating vertical stack layout, 4 CollapsibleSection instances, expose getViewContentEl/getTabBarSlot, collapseAll/restore for focus mode
- `tests/ui/WorkbenchShell.test.ts` - 12 unit tests with jsdom environment covering hierarchy, accessors, collapse round-trip, and destroy
- `src/ui/ViewTabBar.ts` - Added optional mountTarget property for explicit slot mounting (backward compatible)
- `src/main.ts` - Full re-wiring: WorkbenchShell creation, ViewManager re-rooting, overlay/toast body migration, collapse-all shortcut, focus mode command

## Decisions Made
- DensityProvider granularity cycling (day/week/month/quarter/year) for CommandBar density setting -- plan referenced non-existent DensityMode type, adapted to actual codebase API
- AuditOverlay stays on #app container (not migrated to document.body) -- the fixed-position toggle button and .audit-mode class toggle both work correctly when mounted on the original container element
- Forward-declared viewManager and toast with `let` -- closures in shortcuts and commands capture the variable reference (not value), so assignment after WorkbenchShell creation works correctly
- main.ts reordered: ShortcutRegistry, HelpOverlay, CommandRegistry, CommandPalette all created before WorkbenchShell so commandBarConfig callbacks can reference them

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Adapted density cycling to actual DensityProvider API**
- **Found during:** Task 2 (main.ts re-wiring)
- **Issue:** Plan referenced `DensityMode` type and `density.mode` property which do not exist in the codebase. DensityProvider manages time granularity, not compact/comfortable/spacious modes.
- **Fix:** Implemented density cycling over DensityProvider.getState().granularity (day/week/month/quarter/year) instead of the non-existent DensityMode. getDensityLabel() returns capitalized granularity name.
- **Files modified:** src/main.ts
- **Verification:** TypeScript compilation succeeds, no runtime errors
- **Committed in:** f56cb8fa (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Adapted to actual codebase API. No scope creep.

## Issues Encountered
None beyond the density API adaptation.

## User Setup Required
None -- no external service configuration required.

## Next Phase Readiness
- WorkbenchShell is fully wired with all 4 stub sections ready for Phase 55-57 explorer content
- ViewTabBar positioned in dedicated slot between CommandBar and panel rail
- ViewManager re-rooted to .workbench-view-content -- all views render correctly in new mount point
- Overlays and toasts on document.body -- ready for future overlay additions
- Focus mode (Cmd+\) ready for use -- saves/restores section collapse states
- Phase 54 (Shell Scaffolding) is complete -- all 3 plans executed

## Self-Check: PASSED

- FOUND: src/ui/WorkbenchShell.ts
- FOUND: tests/ui/WorkbenchShell.test.ts
- FOUND: src/ui/ViewTabBar.ts
- FOUND: src/main.ts
- FOUND: commit 6e053fb2
- FOUND: commit f56cb8fa

---
*Phase: 54-shell-scaffolding*
*Completed: 2026-03-08*
