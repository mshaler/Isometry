---
phase: 147-3-state-collapse-accessibility
plan: "02"
subsystem: dock-nav
tags: [accessibility, aria, keyboard-navigation, roving-tabindex]
dependency_graph:
  requires: [147-01 DockNav with 3-state collapse, toggle, persistence]
  provides: [ARIA tablist semantics, roving tabindex, arrow key navigation, hidden-state tab order management]
  affects: [src/ui/DockNav.ts]
tech_stack:
  added: []
  patterns: [roving tabindex, ARIA tablist/tab roles, event delegation keydown handler]
key_files:
  created: []
  modified:
    - src/ui/DockNav.ts
decisions:
  - "Keydown handler uses event delegation on nav element (same as click handler) — consistent with v6.0 performance pattern, single listener per event type"
  - "_orderedItems[] built during mount() loop — flat ordered array skipping section headers, drives all arrow navigation without DOM traversal at runtime"
  - "_focusIndex tracks roving tabindex position; _applyCollapseState restores roving state from _focusIndex when transitioning out of hidden"
metrics:
  duration: "3m 42s"
  completed: "2026-04-12"
  tasks_completed: 1
  files_modified: 1
requirements: [A11Y-01, A11Y-02, A11Y-04]
---

# Phase 147 Plan 02: DockNav ARIA + Keyboard Navigation

ARIA tablist semantics with roving tabindex and arrow key navigation for DockNav keyboard/screen-reader accessibility.

## What Was Built

### Task 1: ARIA roles, roving tabindex, arrow key navigation (DockNav.ts)

Added to `DockNav.ts`:

**ARIA roles:**
- `<ul>` dock list: `role="tablist"` + `aria-orientation="vertical"`
- Each dock item `<button>`: `role="tab"` (section headers already had `aria-hidden="true"` from Plan 01)

**Private fields:**
- `_keydownHandler: ((e: KeyboardEvent) => void) | null` — bound handler for cleanup in `destroy()`
- `_orderedItems: HTMLButtonElement[]` — flat ordered array of dock item buttons (section headers excluded), built during `mount()` loop, source of truth for arrow key navigation
- `_focusIndex: number` — tracks current roving tabindex position

**Roving tabindex initialization (end of `mount()`):**
- `_orderedItems.forEach((el, i) => el.setAttribute('tabindex', i === 0 ? '0' : '-1'))`
- First item starts as focusable entry point into the tablist

**Keydown handler (event delegation on nav element):**
- Guards on `target.classList.contains('dock-nav__item')` — only fires for dock items
- `ArrowDown`: `(focusIndex + 1) % len` — wraps at end
- `ArrowUp`: `(focusIndex - 1 + len) % len` — wraps at start
- `Home`: jumps to index 0
- `End`: jumps to `len - 1`
- Moves tabindex="0" to next item and calls `.focus()`

**`_applyCollapseState()` tabindex management:**
- `hidden` state: all items get `tabindex="-1"` (only toggle button remains in tab order)
- `icon-only` / `icon-thumbnail` states: roving tabindex restored — `_focusIndex` item gets `tabindex="0"`, rest get `tabindex="-1"`

**`destroy()` cleanup:**
- Removes keydown listener from nav element
- Nulls `_keydownHandler`, resets `_orderedItems = []`

## Verification

- `npx tsc --noEmit` — zero errors
- All grep checks passed: tablist(1), aria-selected(3), ArrowDown(1), _orderedItems(7), aria-hidden(3), role.*tab(2), aria-orientation(1), ArrowUp(1), Home(1), End(1)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None introduced by this plan.

## Self-Check

- [x] src/ui/DockNav.ts exists and modified
- [x] Commit a6c61138 exists (Task 1)
- [x] `npx tsc --noEmit` exits 0
- [x] All acceptance criteria verified via grep
