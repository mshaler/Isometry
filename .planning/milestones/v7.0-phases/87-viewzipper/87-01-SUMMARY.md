---
phase: 87-viewzipper
plan: 01
subsystem: ui
tags: [viewzipper, tabs, keyboard-nav, accessibility, announcer, auto-cycle, css]

# Dependency graph
requires:
  - phase: 87-viewzipper
    provides: 87-UI-SPEC.md design contract and vzip-* selector specification
  - phase: 86-shell-restructure-menubar-sidebar
    provides: SidebarNav with Visualization Explorer section (visualization:list..tree keys)
provides:
  - src/styles/view-zipper.css — ViewZipper strip styling with vzip-* scoped selectors
  - src/ui/ViewZipper.ts — ViewZipper class with mount/setActive/startCycle/stopCycle/destroy lifecycle
affects: [87-viewzipper plan 02, WorkbenchShell integration, ShortcutRegistry wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vzip-* CSS prefix convention for ViewZipper-scoped selectors
    - Play/Stop button class-swap pattern (vzip-play-btn <-> vzip-stop-btn) via DOM className reassignment
    - Announcer.announce() called on every user-visible state change (view switch, cycle start, cycle stop)

key-files:
  created:
    - src/styles/view-zipper.css
    - src/ui/ViewZipper.ts
  modified: []

key-decisions:
  - "UAT label overrides for ViewZipper: calendar='Map', network='Charts', tree='Graphs' — matches UAT spec B3, not existing ViewTabBar labels"
  - "Play/Stop implemented as class swap on single button element rather than two separate DOM elements — simpler state management"
  - "Cycle starts at next tab from current (not reset to list) — preserves user context during cycling"

patterns-established:
  - "vzip-* CSS prefix: all ViewZipper selectors scoped to vzip-* to avoid collision with deprecated view-tab-bar.css"
  - "ViewZipperConfig interface: container + onSwitch + announcer — matches ViewTabBar config shape for easy replacement"
  - "Roving tabindex on tablist: first tab tabindex=0, rest tabindex=-1; updated on each setActive()/keyboard nav call"

requirements-completed: [VZIP-01, VZIP-02, VZIP-06, VZIP-07]

# Metrics
duration: 2min
completed: 2026-03-18
---

# Phase 87 Plan 01: ViewZipper Summary

**ViewZipper CSS strip and TypeScript component with 9 UAT-labeled tabs, roving tabindex keyboard nav, Play/Stop auto-cycle at 2000ms, and Announcer screen reader integration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-18T13:32:04Z
- **Completed:** 2026-03-18T13:33:58Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `src/styles/view-zipper.css` with 8 vzip-* selectors covering tab strip, tab states, play/stop buttons, focus-visible rings, and crossfade frame — all using pre-existing design tokens
- Created `src/ui/ViewZipper.ts` exporting ViewZipperConfig interface and ViewZipper class with full public API: constructor, setActive, startCycle, stopCycle, destroy, getActiveType, isCycling
- 9 tabs render with correct UAT labels (Map/Charts/Graphs override the Calendar/Network/Tree ViewTabBar labels per UAT spec B3)
- Keyboard navigation: ArrowLeft/Right with wrapping, Home/End; roving tabindex maintained on every activation
- Announcer.announce() called on 3 events: view switch ("Switched to X view"), cycle start ("Auto-cycle started"), cycle stop ("Auto-cycle stopped on X view")

## Task Commits

1. **Task 1: Create ViewZipper CSS** - `01bccc1b` (feat)
2. **Task 2: Create ViewZipper TypeScript component** - `b4918f56` (feat)

## Files Created/Modified

- `src/styles/view-zipper.css` — ViewZipper strip, tab, play/stop, focus-visible, and crossfade CSS using vzip-* prefix
- `src/ui/ViewZipper.ts` — ViewZipper class: constructor, setActive, startCycle, stopCycle, destroy, getActiveType, isCycling

## Decisions Made

- UAT label overrides: `calendar` type uses "Map", `network` uses "Charts", `tree` uses "Graphs" — matches UAT spec B3 not existing ViewTabBar labels. Load-bearing: Plan 02 must pass the ViewType string ('calendar', not 'map') to onSwitch.
- Play/Stop implemented as class-swap on single button element — simpler than two separate DOM nodes; CSS handles visual differentiation via vzip-play-btn vs vzip-stop-btn.
- Cycle advances from current position (not reset to index 0) — preserves user context when cycling is restarted.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `tests/seams/etl/etl-fts.test.ts`, `tests/seams/ui/calc-explorer.test.ts`, and `tests/views/GalleryView.test.ts` are out-of-scope pre-existing issues (not caused by this plan's changes).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ViewZipper CSS and TypeScript component complete and compiling cleanly
- Plan 02 can mount ViewZipper into the Visualization Explorer panel, wire onSwitch to the existing view switcher, and integrate SidebarNav.setActiveItem() sync
- ShortcutRegistry Cmd+1..9 integration: call `viewZipper.setActive(viewType)` instead of `viewTabBar.setActive()`
- ViewTabBar.destroy() should be called once ViewZipper is wired in (Plan 02 task)

---
*Phase: 87-viewzipper*
*Completed: 2026-03-18*
