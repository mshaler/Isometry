---
phase: 50-accessibility
plan: 03
subsystem: accessibility
tags: [keyboard-navigation, composite-widget, focus-management, aria-combobox, spatial-navigation, treeview-apg]

# Dependency graph
requires:
  - phase: 50-accessibility/01
    provides: "accessibility.css with sr-only utility, MotionProvider, design token contrast"
  - phase: 50-accessibility/02
    provides: "Announcer, ARIA landmarks, role=img on SVG views, role=navigation on sort-toolbar"
provides:
  - "Composite widget keyboard navigation in all 9 views (arrow keys within, Tab to container, Escape out)"
  - "NetworkView spatial nearest-neighbor arrow key navigation (Euclidean distance)"
  - "TreeView WAI-ARIA TreeView APG pattern (ArrowRight/Left expand/collapse, Home/End)"
  - "ViewManager focus management after view switch (tabindex=-1, RAF focus)"
  - "ListView toolbar roving tabindex pattern"
  - "WAI-ARIA combobox contract (COMBOBOX_ATTRS) for Phase 51 command palette"
  - "Focus indicator CSS for composite widgets (.card--focused, .gallery-tile--focused, etc.)"
affects: [51-command-palette, accessibility]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite widget pattern: tabindex=0 on container, arrow keys navigate within, Escape exits"
    - "Spatial nearest-neighbor: Euclidean distance in arrow direction half-plane for NetworkView"
    - "WAI-ARIA TreeView APG: ArrowRight expand/first-child, ArrowLeft collapse/parent"
    - "Roving tabindex: only active button has tabindex=0, others -1, arrow keys rove focus"
    - "CSS .card--focused class for composite widget focus ring (not :focus-visible)"
    - "COMBOBOX_ATTRS as const contract for Phase 51 command palette ARIA pattern"

key-files:
  created:
    - src/accessibility/combobox-contract.ts
    - tests/accessibility/keyboard.test.ts
  modified:
    - src/accessibility/index.ts
    - src/views/ViewManager.ts
    - src/views/ListView.ts
    - src/views/GridView.ts
    - src/views/TimelineView.ts
    - src/views/NetworkView.ts
    - src/views/TreeView.ts
    - src/views/GalleryView.ts
    - src/views/CalendarView.ts
    - src/views/KanbanView.ts
    - src/styles/views.css

key-decisions:
  - "Composite widget pattern: single tabindex=0 on container SVG/div, JS class toggle for focused card (not individual tabindex per card)"
  - "NetworkView spatial navigation uses Euclidean distance filtered by arrow direction half-plane (dx>0 for ArrowRight, etc.)"
  - "TreeView expand/collapse via ArrowRight/Left per WAI-ARIA TreeView APG (not Enter toggle)"
  - "ViewManager focus: requestAnimationFrame before focus() to ensure DOM is settled after view switch"
  - "CSS outline on SVG g elements for focus ring (modern browsers Safari 16+, Chrome, Firefox support this)"

patterns-established:
  - "Composite widget pattern: container keydown handler manages _focusedIndex, .card--focused CSS class"
  - "Spatial nearest-neighbor: filter candidates by directional half-plane, pick minimum Euclidean distance"
  - "WAI-ARIA TreeView APG: ArrowRight expand/first-child, ArrowLeft collapse/parent, Enter/Space activate"
  - "Roving tabindex on toolbar: arrow keys move tabindex=0 between interactive children"
  - "COMBOBOX_ATTRS contract: as const object defining ARIA attributes Phase 51 must apply"

requirements-completed: [A11Y-08, A11Y-09, A11Y-11]

# Metrics
duration: 9min
completed: 2026-03-08
---

# Phase 50 Plan 03: Keyboard Navigation + Focus Management Summary

**Composite widget arrow-key navigation in all 9 views with spatial nearest-neighbor for NetworkView, WAI-ARIA TreeView APG expand/collapse, ViewManager focus management, roving tabindex toolbar, and COMBOBOX_ATTRS contract for Phase 51**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-08T01:43:33Z
- **Completed:** 2026-03-08T01:52:40Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- All 9 views implement composite widget keyboard navigation (Tab to container, arrow keys within, Escape to toolbar)
- NetworkView uses spatial nearest-neighbor logic: Euclidean distance filtered by arrow direction half-plane
- TreeView follows WAI-ARIA TreeView APG: ArrowRight expands or moves to first child, ArrowLeft collapses or moves to parent, Home/End for first/last visible node
- ViewManager moves focus to view container after switchTo() via requestAnimationFrame
- ListView toolbar uses roving tabindex (ArrowLeft/Right between select and direction button)
- CSS focus indicators: .card--focused, .gallery-tile--focused, .calendar-day--focused, .kanban-column--focused, [tabindex="0"]:focus-visible
- WAI-ARIA combobox contract (COMBOBOX_ATTRS) exported for Phase 51 command palette
- Full test suite: 2533 tests, 0 failures (93 test files)

## Task Commits

Each task was committed atomically:

1. **Task 1: Composite widget keyboard navigation in all views + focus management** - `deca89db` (feat)
2. **Task 2: WAI-ARIA combobox contract + keyboard navigation tests** - `ba2ba476` (feat)

## Files Created/Modified

- `src/accessibility/combobox-contract.ts` - WAI-ARIA combobox attribute constants for Phase 51 command palette
- `src/accessibility/index.ts` - Added COMBOBOX_ATTRS to barrel export
- `tests/accessibility/keyboard.test.ts` - 18 tests for combobox contract and ARIA 1.2 compliance
- `src/views/ViewManager.ts` - tabindex=-1 on container, _focusContainer() with RAF after switchTo()
- `src/views/ListView.ts` - ArrowUp/Down navigation, toolbar roving tabindex, _focusedIndex tracking
- `src/views/GridView.ts` - ArrowUp/Down/Left/Right grid navigation with column-aware movement
- `src/views/TimelineView.ts` - ArrowUp/Down linear navigation through timeline cards
- `src/views/NetworkView.ts` - Spatial nearest-neighbor arrow key navigation, _findSpatialNearest()
- `src/views/TreeView.ts` - WAI-ARIA TreeView APG: expand/collapse/parent/first-child navigation
- `src/views/GalleryView.ts` - ArrowUp/Down/Left/Right grid navigation with column-aware movement
- `src/views/CalendarView.ts` - ArrowLeft/Right between days, ArrowUp/Down between weeks (7-day jump)
- `src/views/KanbanView.ts` - ArrowLeft/Right between columns, ArrowUp/Down within column
- `src/styles/views.css` - .card--focused, .gallery-tile--focused, .calendar-day--focused, .kanban-column--focused CSS focus rings

## Decisions Made

- **Composite widget pattern:** Single tabindex="0" on the container (SVG or wrapper div), arrow keys navigate within via JS, .card--focused CSS class applied to visually indicate the focused card. Individual cards do NOT get tabindex (composite widget pattern).
- **Spatial nearest-neighbor:** NetworkView filters candidate nodes by the arrow direction half-plane (e.g., dx > 0 for ArrowRight), then picks the candidate with minimum Euclidean distance. If no node exists in that direction, focus stays on current.
- **TreeView APG:** ArrowRight/Left for expand/collapse (macOS convention from research). Enter/Space activates (selects) the node but does NOT toggle expand. Home/End jump to first/last visible node.
- **RAF before focus:** ViewManager._focusContainer() uses requestAnimationFrame before calling focus() to ensure DOM is settled after view mount and render.
- **CSS outline on SVG elements:** Modern browsers (Safari 16+, Chrome, Firefox) support CSS outline on SVG `<g>` elements. This is the simplest approach for SVG focus rings without foreignObject or filter workarounds.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 9 views are keyboard-navigable with visible focus indicators
- ViewManager properly manages focus across view switches
- COMBOBOX_ATTRS contract ready for Phase 51 command palette to import and apply
- Manual VoiceOver testing recommended per STATE.md blocker note (WKWebView VoiceOver differs from Safari)
- Phase 50 (Accessibility) is now complete (all 3 plans executed)

## Self-Check: PASSED

- [x] src/accessibility/combobox-contract.ts exists
- [x] tests/accessibility/keyboard.test.ts exists
- [x] Commit deca89db exists (Task 1)
- [x] Commit ba2ba476 exists (Task 2)
- [x] COMBOBOX_ATTRS exported from combobox-contract.ts
- [x] ViewManager._focusContainer() implemented
- [x] All 2533 tests pass (93 test files)

---
*Phase: 50-accessibility*
*Completed: 2026-03-08*
