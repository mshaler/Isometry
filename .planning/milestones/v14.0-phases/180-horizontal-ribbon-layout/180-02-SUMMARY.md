---
phase: 180-horizontal-ribbon-layout
plan: 02
subsystem: dock-nav
tags: [ribbon, navigation, horizontal, keyboard-nav, css]
dependency_graph:
  requires: [180-01]
  provides: [HRIB-01, HRIB-02, HRIB-03, HRIB-06, HRIB-07]
  affects: [src/ui/DockNav.ts, src/styles/dock-nav.css, src/main.ts]
tech_stack:
  added: []
  patterns: [horizontal-ribbon, overflow-fade-mask, roving-tabindex, event-delegation]
key_files:
  modified:
    - src/ui/DockNav.ts
    - src/styles/dock-nav.css
    - src/main.ts
decisions:
  - Overflow uses CSS fade masks via JS modifier classes — no chevron buttons (Claude's Discretion from CONTEXT.md)
  - bridge removed from DockNavConfig — was only used for collapse state persistence which is no longer needed
metrics:
  duration: ~8 minutes
  completed: 2026-04-22T23:34:34Z
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 180 Plan 02: DockNav Horizontal Ribbon Summary

**One-liner:** Rewrote DockNav.ts from vertical sidebar to horizontal ribbon with ArrowLeft/Right nav, and refactored dock-nav.css to 56px flex-row layout with CSS overflow fade masks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Rewrite DockNav.ts for horizontal ribbon | 029eb848 | src/ui/DockNav.ts, src/main.ts |
| 2 | Refactor dock-nav.css for horizontal ribbon layout | 04e61bed | src/styles/dock-nav.css |

## What Was Built

**DockNav.ts (Task 1):**
- Removed CollapseState type, toggle button, thumbnail rendering, collapse persistence, loupe cleanup (220 lines removed)
- Removed bridge from DockNavConfig — was only used for `dock:collapse-state` persistence
- Changed `aria-orientation` from `'vertical'` to `'horizontal'`
- Swapped ArrowDown/ArrowUp to ArrowRight/ArrowLeft for horizontal keyboard nav
- Removed `dock-nav__content` wrapper — list appends directly to nav
- Added overflow scroll detection: `checkOverflow()` toggles `dock-nav--has-overflow`, `dock-nav--overflow-left`, `dock-nav--overflow-right` on scroll + initial RAF
- Removed `bridge` from DockNav constructor call in main.ts

**dock-nav.css (Task 2):**
- Container: `flex-direction: row`, `height: 56px`, `overflow-x: auto`, `scrollbar-width: none`
- Section: `flex-direction: column` (label above items row)
- Section header: `height: 16px`, `padding: 2px var(--space-md) 0`, `line-height: 1.0`
- Items: `height: 32px`, `white-space: nowrap`, inter-section `gap: var(--space-lg)`
- Removed all icon-only, icon-thumbnail, toggle, content, minimap, thumb rules (129 lines removed)
- Added CSS overflow fade masks via `.dock-nav--has-overflow` modifier classes

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — DockNav renders from static DOCK_DEFS and all wiring paths are preserved from prior phases.

## Self-Check: PASSED

- src/ui/DockNav.ts: FOUND
- src/styles/dock-nav.css: FOUND
- Commit 029eb848: FOUND
- Commit 04e61bed: FOUND
- No src/ TypeScript errors
- All dead code (CollapseState, thumbnails, toggle, icon-only/thumbnail, minimap) removed
