---
phase: 175-shell-replacement
plan: "01"
subsystem: superwidget
tags: [shell-replacement, css-grid, sidebar, command-bar, explorer-passthrough]
dependency_graph:
  requires: []
  provides: [superwidget-5-slot-layout, sidebar-slot, command-bar-injection, explorer-passthrough-accessors]
  affects: [src/superwidget/SuperWidget.ts, src/styles/superwidget.css]
tech_stack:
  added: []
  patterns: [constructor-parameter-injection, css-grid-areas, tdd-red-green]
key_files:
  created: []
  modified:
    - src/superwidget/SuperWidget.ts
    - src/styles/superwidget.css
    - tests/superwidget/SuperWidget.test.ts
decisions:
  - "sidebar slot inserted as first DOM child of root for accessibility, CSS grid-area handles visual positioning"
  - "commandBar optional 3rd constructor param (not options object) to minimize diff with existing call sites"
  - "SLAT-01 tests updated from 4-slot to 5-slot assertions (plan-directed change, not a bug)"
metrics:
  duration: 208s
  completed_date: "2026-04-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 175 Plan 01: SuperWidget 5-Slot Foundation Summary

SuperWidget extended to full app container with sidebar column, CommandBar constructor injection, and explorer passthrough accessors via CSS grid-template-areas and targeted TS additions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend SuperWidget with sidebar slot, CommandBar param, explorer passthrough | b5b61a36 | SuperWidget.ts, SuperWidget.test.ts |
| 2 | Update SuperWidget CSS grid to 5-slot layout with sidebar column | 83c391a9 | superwidget.css |

## What Was Built

**SuperWidget.ts changes:**
- Added `import type { CommandBar } from '../ui/CommandBar'`
- Added `_sidebarEl`, `_commandBar`, `_topPassthroughEl`, `_bottomPassthroughEl` private fields
- Constructor signature extended: `constructor(canvasFactory, shortcuts?, commandBar?)`
- Sidebar slot created with `dataset['slot'] = 'sidebar'`, inserted first in DOM
- CommandBar mounted into headerEl when provided; `headerEl.textContent = 'Zone'` only when no commandBar
- `commitProjection` guarded: zone label update skipped when `this._commandBar` is set
- `destroy()` calls `this._commandBar?.destroy()`
- New public API: `get sidebarEl()`, `getCommandBar()`, `getTopSlotEl()`, `getBottomSlotEl()`
- Passthrough divs created in constructor with `sw-explorer-slot-top/bottom` classes; NOT auto-appended (caller places them)

**superwidget.css changes:**
- Root rule: replaced `grid-template-columns: 1fr` with `grid-template-columns: auto 1fr` + `grid-template-areas` (sidebar spans all 4 rows)
- Added `[data-slot="sidebar"]` rule: `width: 48px`, `background: var(--bg-surface)`, `border-right`
- Added bimodal width classes: `.sw-sidebar--icon-only` (48px) and `.sw-sidebar--icon-thumbnail` (280px)
- Added `grid-area` assignments to all 5 slot rules
- Added `.sw-explorer-slot-top` (max-height: 50vh) and `.sw-explorer-slot-bottom` (max-height: 30vh)

## Test Results

- 55 tests pass in `tests/superwidget/SuperWidget.test.ts` (41 existing + 14 new)
- 321 tests pass across 16 files in `tests/superwidget/` — zero regressions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SLAT-01 tests hardcoded 4-slot count and order**
- **Found during:** Task 1 GREEN implementation
- **Issue:** Two SLAT-01 tests asserted exactly 4 slotted children and order `[header, tabs, canvas, status]`. Adding the sidebar slot caused these to fail.
- **Fix:** Updated assertions to 5 slots and order `[sidebar, header, tabs, canvas, status]`. This is a plan-directed structural change, not a regression.
- **Files modified:** tests/superwidget/SuperWidget.test.ts (lines ~118-129)
- **Commit:** b5b61a36

## Known Stubs

None — all accessors return real elements. `getTopSlotEl()` and `getBottomSlotEl()` return container divs that are intentionally not auto-appended; Plan 02 (main.ts rewiring) will place them as needed. This matches WorkbenchShell's accessor pattern and is by design (D-02).

## Self-Check: PASSED

Files exist:
- src/superwidget/SuperWidget.ts — FOUND
- src/styles/superwidget.css — FOUND
- tests/superwidget/SuperWidget.test.ts — FOUND

Commits:
- 0858f951 (RED tests) — FOUND
- b5b61a36 (GREEN implementation) — FOUND
- 83c391a9 (CSS 5-slot layout) — FOUND
