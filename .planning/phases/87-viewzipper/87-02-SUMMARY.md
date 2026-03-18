---
phase: 87-viewzipper
plan: 02
subsystem: ui
tags: [viewzipper, tabs, view-switching, crossfade, sidebar-sync, keyboard-shortcuts, auto-cycle]

# Dependency graph
requires:
  - phase: 87-viewzipper plan 01
    provides: ViewZipper CSS and TypeScript component (ViewZipperConfig, ViewZipper class with full lifecycle)
  - phase: 86-shell-restructure-menubar-sidebar
    provides: SidebarNav with setActiveItem(), WorkbenchShell with getViewContentEl()
provides:
  - src/main.ts — ViewZipper wired into shell, ViewTabBar import removed, crossfade (.vzip-transition-frame) applied to view content element
affects: [phase 88+, ShortcutRegistry Cmd+1..9, SidebarNav Visualization section sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - opacity 0→switchTo→opacity 1 crossfade pattern via .vzip-transition-frame on view content element
    - viewZipper.stopCycle() called first in manual-tab and sidebar-nav handlers to prevent double-switch
    - viewManager.onViewSwitch as the single callback that drives viewZipper.setActive + sidebarNav.setActiveItem in lockstep

key-files:
  created: []
  modified:
    - src/main.ts — ViewZipper wired, ViewTabBar removed, crossfade class and opacity transitions applied, sidebar handler updated, window.__isometry extended

key-decisions:
  - "Crossfade implemented as opacity 0 -> await switchTo -> opacity 1 in onSwitch callback — keeps transition logic co-located with view switching rather than inside ViewZipper internals"
  - "viewZipper.stopCycle() called in sidebar onActivateItem before switchTo — ensures manual sidebar clicks halt cycling before switching, matching tab-click behavior"
  - ".vzip-transition-frame class applied to getViewContentEl() at mount time (not inside ViewZipper) — ViewZipper owns tabs, shell main.ts owns the view content frame"

patterns-established:
  - "Single onViewSwitch callback drives both viewZipper.setActive and sidebarNav.setActiveItem — all view-change sources (tab, sidebar, Cmd+1..9, cycle) converge here"
  - "Crossfade gate pattern: opacity=0 before async switchTo, opacity=1 after resolution — works for both manual clicks and auto-cycle steps"

requirements-completed: [VZIP-03, VZIP-04, VZIP-05]

# Metrics
duration: ~5min (including human verification)
completed: 2026-03-18
---

# Phase 87 Plan 02: ViewZipper Integration Summary

**ViewZipper wired into main.ts replacing ViewTabBar — tab clicks and auto-cycle steps crossfade via .vzip-transition-frame opacity transitions, sidebar Visualization section syncs on every view change source**

## Performance

- **Duration:** ~5 min (including human verification checkpoint)
- **Started:** 2026-03-18T13:35:00Z
- **Completed:** 2026-03-18T~13:40:00Z
- **Tasks:** 2 (1 auto + 1 human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Removed `ViewTabBar` import from `src/main.ts` and replaced with `ViewZipper` — no ViewTabBar instantiation remains
- Applied `.vzip-transition-frame` class to `shell.getViewContentEl()` at mount time so the CSS `transition: opacity 300ms ease` is active on every view switch
- Wired `onSwitch` callback with opacity 0 → `viewManager.switchTo` → opacity 1 pattern, covering both tab clicks and auto-cycle steps
- Updated `viewManager.onViewSwitch` to call `viewZipper.setActive()` first, then `sidebarNav.setActiveItem()` and `visualExplorer.setZoomRailVisible()` — single callback drives all sync
- Updated sidebar `onActivateItem` handler to call `viewZipper.stopCycle()` before switching, matching manual-tab-click behavior
- Added `viewZipper` to `window.__isometry` DevTools object
- Human verification confirmed all 12 behaviors: tab rendering, tab click + crossfade, sidebar sync, keyboard nav (ArrowLeft/Right, Home/End), Play/Stop auto-cycle at 2s intervals, Cmd+1..9 shortcuts, no old ViewTabBar visible

## Task Commits

1. **Task 1: Wire ViewZipper into main.ts, remove ViewTabBar** - `a9c85d05` (feat)
2. **Task 2: Verify ViewZipper end-to-end** - human-verify checkpoint — approved by user

## Files Created/Modified

- `src/main.ts` — ViewZipper import added, ViewTabBar import removed, ViewZipper instantiated with crossfade onSwitch, .vzip-transition-frame applied, onViewSwitch updated, sidebar handler updated, window.__isometry extended

## Decisions Made

- Crossfade implemented as opacity 0 → await switchTo → opacity 1 in `onSwitch` callback co-located in main.ts — keeps transition logic visible at the integration point rather than buried inside ViewZipper internals.
- `.vzip-transition-frame` applied to `getViewContentEl()` at mount time, not inside ViewZipper — ViewZipper owns the tab strip DOM, shell owns the view content frame.
- `viewZipper.stopCycle()` called in sidebar `onActivateItem` before `switchTo` — ensures sidebar nav clicks halt auto-cycling before switching, consistent with direct tab click behavior.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ViewZipper integration complete and human-verified across all 12 behaviors
- Phase 87 (ViewZipper) is fully complete: Plan 01 built the component, Plan 02 wired it into the shell
- VZIP-01..07 requirements all satisfied across the two plans
- ViewTabBar.ts and view-tab-bar.css files remain on disk per plan spec (deferred deprecation) — future phase may remove them

---
*Phase: 87-viewzipper*
*Completed: 2026-03-18*
