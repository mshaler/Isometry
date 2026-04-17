---
phase: 147-3-state-collapse-accessibility
plan: "01"
subsystem: dock-nav
tags: [css, animation, accessibility, persistence, ui-state]
dependency_graph:
  requires: [Phase 146 DockNav output]
  provides: [3-state dock collapse with toggle, CSS animation, ui_state persistence]
  affects: [src/ui/DockNav.ts, src/styles/dock-nav.css, src/styles/workbench.css, src/main.ts]
tech_stack:
  added: []
  patterns: [grid-template-rows animation, bridge.send ui:get/ui:set persistence, CSS class swap for instant width changes]
key_files:
  created: []
  modified:
    - src/ui/DockNav.ts
    - src/styles/dock-nav.css
    - src/styles/workbench.css
    - src/main.ts
decisions:
  - "Toggle button uses event delegation via the existing nav click handler — not a separate listener — consistent with Phase 146 pattern"
  - "Toggle button is a child of .dock-nav (not a sibling), simplifying single-listener delegation"
  - "Persisted state restored via fire-and-forget async on mount; default icon-only applied synchronously before restore completes"
metrics:
  duration: "9m 21s"
  completed: "2026-04-12"
  tasks_completed: 2
  files_modified: 4
requirements: [CLPS-01, CLPS-02, CLPS-03, CLPS-04]
---

# Phase 147 Plan 01: 3-State Dock Collapse — CSS + TypeScript

3-state dock collapse (Hidden/Icon-only/Icon+Thumbnail) with grid-template-rows animation, instant width swaps, toggle button, and ui_state persistence.

## What Was Built

### Task 1: CSS (dock-nav.css + workbench.css)

Added to `dock-nav.css`:
- `.dock-nav__toggle` — 48x48 touch target, transparent button, hover/focus-visible states
- `.dock-nav__content` — `display: grid; grid-template-rows: 1fr; transition: grid-template-rows 200ms ease` animation wrapper
- `.dock-nav__content > .dock-nav__list { min-height: 0; }` — required for grid collapse
- `.dock-nav--hidden .dock-nav__content { grid-template-rows: 0fr; }` — collapse trigger
- `.dock-nav--icon-thumbnail .dock-nav__item` — 160px width, flex-start, padding with space tokens
- `.dock-nav__item-thumb` — hidden by default; `display: block; width: 96px; height: 48px; border: 1px dashed var(--border-subtle); background: var(--bg-primary)` in thumbnail state

Added to `workbench.css`:
- `.workbench-sidebar--hidden { width: 0px; overflow: hidden; }`
- `.workbench-sidebar--icon-only { width: 48px; }`
- `.workbench-sidebar--icon-thumbnail { width: 160px; }`
- No `transition: width` on any sidebar rule (instant class swap per D-05)

### Task 2: DockNav.ts + main.ts

- Exported `CollapseState = 'hidden' | 'icon-only' | 'icon-thumbnail'` type
- Added `bridge` field to `DockNavConfig`
- Toggle button created as first child of nav: `dock-nav__toggle`, `aria-label="Toggle navigation"`, `aria-expanded` reflects state, `iconSvg('panel-left', 20)`
- Dock list wrapped in `dock-nav__content` div for grid animation
- Each item gets a `dock-nav__item-thumb` placeholder div (`aria-hidden="true"`)
- `_applyCollapseState(state)` removes/adds `dock-nav--*` on nav and `workbench-sidebar--*` on container, syncs `aria-expanded`
- Toggle click uses event delegation on nav element: `target.closest('.dock-nav__toggle')` check before item check
- Cycle: hidden→icon-only→icon-thumbnail→hidden
- Persistence: `bridge.send('ui:set', { key: 'dock:collapse-state', value: next })` on toggle click
- Restore: async `bridge.send('ui:get', { key: 'dock:collapse-state' })` on mount, fire-and-forget
- VoiceOver: `config.announcer?.announce("Hidden" | "Icon only" | "Icon and thumbnail")`
- Section headers get `aria-hidden="true"`; item buttons get `aria-selected` (false/true)
- `main.ts`: added `bridge` to DockNav constructor call

## Verification

- `npx tsc --noEmit` — zero errors
- Unit/integration tests: 8490+ passing, 0 regressions from this change
- E2E and bench failures are pre-existing (require running server or CI environment)

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**One minor implementation choice (Claude's Discretion from CONTEXT.md):** Toggle button is a direct child of `.dock-nav` nav element (not a sibling), using the existing event delegation click handler for the toggle. The plan specified using a separate `addEventListener` on the toggle button, but event delegation (checking `target.closest('.dock-nav__toggle')`) is cleaner, uses one listener, and is consistent with the Phase 146 performance pattern. This does not affect behavior.

## Known Stubs

- `dock-nav__item-thumb` placeholder boxes render visually but are empty — intentional. Phase 148 (MinimapRenderer) will populate them with actual minimap content.

## Self-Check

- [x] src/ui/DockNav.ts exists and modified
- [x] src/styles/dock-nav.css exists and modified
- [x] src/styles/workbench.css exists and modified
- [x] src/main.ts exists and modified
- [x] Commit 8070ce8e exists (Task 1)
- [x] Commit 9a32e287 exists (Task 2)
