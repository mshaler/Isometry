---
phase: 176-explorer-sidecar-status-slots
plan: "01"
subsystem: superwidget
tags: [sidecar, css-grid, layout, explorer-panels]
dependency_graph:
  requires: [phase-175-shell-replacement]
  provides: [sidecar-slot, setSidecarVisible, sidecar-sub-slots]
  affects: [src/main.ts, src/superwidget/SuperWidget.ts, src/styles/superwidget.css]
tech_stack:
  added: []
  patterns: [css-grid-transition, data-attribute-toggle, grid-template-columns-animation]
key_files:
  created: []
  modified:
    - src/superwidget/SuperWidget.ts
    - src/styles/superwidget.css
    - src/main.ts
    - tests/superwidget/SuperWidget.test.ts
    - tests/superwidget/shellReplacement.test.ts
decisions:
  - "Sidecar is a 3rd CSS grid column (0 -> 280px) — not a flex child or overlay"
  - "setSidecarVisible() toggles data-sidecar-visible on root for pure CSS transition"
  - "syncTopSlotVisibility/syncBottomSlotVisibility removed; sidecar visibility is atomic"
metrics:
  duration: 493s
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 5
requirements:
  - SIDE-01
  - SIDE-02
  - SIDE-03
  - SIDE-04
  - SIDE-05
---

# Phase 176 Plan 01: Sidecar Grid Column + Explorer Mount Summary

**One-liner:** 3-column CSS grid sidecar (auto 1fr 0 → 280px) with data-attribute toggle replacing passthrough slot mounting for all explorer panels.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SuperWidget sidecar slot + CSS 3-column grid | 65bea790 | SuperWidget.ts, superwidget.css |
| 2 | Wire explorer mounting to sidecar + onSidecarChange | c117861c | main.ts, *.test.ts |

## What Was Built

### Task 1 — SuperWidget.ts + superwidget.css

- Replaced `_topPassthroughEl` / `_bottomPassthroughEl` fields with `_sidecarEl: HTMLElement` (an `<aside>`), `_sidecarTopEl: HTMLElement`, `_sidecarBottomEl: HTMLElement`
- Added `setSidecarVisible(visible: boolean): void` — toggles `data-sidecar-visible` on root, no canvas re-renders
- Added `get sidecarTopEl()`, `get sidecarBottomEl()`, `get sidecarEl()` getters; removed old `getTopSlotEl()` / `getBottomSlotEl()`
- Sidecar `<aside>` has `data-slot="sidecar"`, sub-slots have `data-sidecar-slot="top-slot"` / `"bottom-slot"`
- Appended sidecar after statusEl in root DOM
- Added `--sw-sidecar-width: 280px` token
- Updated root grid from 2-column to 3-column: `grid-template-columns: auto 1fr 0` with `grid-template-areas` including `sidecar`
- Added `transition: grid-template-columns var(--transition-normal) ease`
- Added `[data-sidecar-visible="true"]` rule expanding sidecar to `var(--sw-sidecar-width)`
- Added `[data-slot="sidecar"]` styling (flex column, background, border-left) and sub-slot styles
- Removed deprecated `.sw-explorer-slot-top` and `.sw-explorer-slot-bottom` rules

### Task 2 — main.ts

- Replaced `superWidget.getTopSlotEl()` / `getBottomSlotEl()` with `superWidget.sidecarTopEl` / `sidecarBottomEl`
- Removed `canvasEl.prepend(topSlotEl)` and `canvasEl.appendChild(bottomSlotEl)` — sidecar is now a sibling grid column, not a canvas child
- Removed `syncTopSlotVisibility()` and `syncBottomSlotVisibility()` functions
- `syncSlots` callback in PanelManager config is now a no-op (sidecar visibility is column-level)
- Wired `onSidecarChange` to `superWidget.setSidecarVisible(explorerId !== null)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed tests using removed passthrough accessor API**
- **Found during:** Task 2 verification
- **Issue:** `tests/superwidget/SuperWidget.test.ts` and `tests/superwidget/shellReplacement.test.ts` referenced `getTopSlotEl()` / `getBottomSlotEl()` and expected old `sw-explorer-slot-top` / `sw-explorer-slot-bottom` class names and 5-slot DOM shape
- **Fix:** Updated both test files to use `sidecarTopEl` / `sidecarBottomEl` getters, updated slot count from 5 to 6, updated slot order to include `sidecar`, rewrote SHEL-02 describe block with new sidecar assertions including `setSidecarVisible()` tests
- **Files modified:** tests/superwidget/SuperWidget.test.ts, tests/superwidget/shellReplacement.test.ts
- **Commit:** c117861c

## Known Stubs

None — sidecar column is wired to `onSidecarChange` via `setSidecarVisible()`. Explorer panels mount in the correct sub-slots.

## Verification

- `tsc --noEmit`: passes (0 errors in src/ and main.ts; pre-existing test errors in presets/seams unaffected)
- `npx vitest run tests/superwidget/`: 330/330 tests pass
- `grep -r "getTopSlotEl|getBottomSlotEl|sw-explorer-slot" src/`: no matches
- `grep "data-sidecar-visible" src/styles/superwidget.css`: returns rule
- `grep "setSidecarVisible" src/superwidget/SuperWidget.ts`: returns method

## Self-Check: PASSED

Files:
- src/superwidget/SuperWidget.ts: FOUND
- src/styles/superwidget.css: FOUND
- src/main.ts: FOUND

Commits:
- 65bea790: FOUND
- c117861c: FOUND
