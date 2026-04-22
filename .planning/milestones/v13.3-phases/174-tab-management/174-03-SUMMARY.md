---
phase: 174-tab-management
plan: "03"
subsystem: superwidget
tags: [tab-management, drag-reorder, keyboard-nav, shortcuts, metadata-callback]
dependency_graph:
  requires: ["174-02"]
  provides: ["TABS-05", "TABS-07", "TABS-08", "TABS-10"]
  affects: ["src/superwidget/TabBar.ts", "src/superwidget/SuperWidget.ts", "src/styles/superwidget.css"]
tech_stack:
  added: []
  patterns:
    - "Pointer Events DnD with 4px threshold and setPointerCapture for drag reorder"
    - "Roving tabindex keyboard navigation on strip container (ArrowLeft/Right/Home/End)"
    - "ShortcutRegistry optional dependency injection for Cmd+W"
    - "onTabMetadataChange injected on canvas mount, no commitProjection for badge/label updates"
key_files:
  created: []
  modified:
    - src/superwidget/TabBar.ts
    - src/superwidget/SuperWidget.ts
    - src/styles/superwidget.css
    - tests/superwidget/TabBar.test.ts
    - tests/superwidget/SuperWidget.test.ts
decisions:
  - "Insertion line appended to document.body with fixed positioning for viewport-relative placement"
  - "onTabMetadataChange unconditionally set on canvas after mount; canvas interface makes it optional"
  - "exactOptionalPropertyTypes requires explicit conditional construction in _updateTabMetadata"
metrics:
  duration: "~8 minutes"
  completed: "2026-04-22T03:51:00Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase 174 Plan 03: Drag Reorder, Keyboard Nav, Cmd+W, Metadata Callback Summary

Pointer Events drag reorder with 4px threshold, ArrowLeft/Right/Home/End keyboard navigation, Cmd+W via ShortcutRegistry, and onTabMetadataChange callback injection completing all 10 TABS requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add drag reorder and keyboard navigation to TabBar | e6365af5 | TabBar.ts, superwidget.css, TabBar.test.ts |
| 2 | Wire Cmd+W shortcut and onTabMetadataChange in SuperWidget | e13c93dc | SuperWidget.ts, SuperWidget.test.ts |

## What Was Built

**Task 1 — TabBar drag reorder + keyboard navigation:**
- `TabBarConfig.onReorder` callback added (fromIndex, toIndex)
- Pointer Events DnD: `pointerdown` records drag state + calls `setPointerCapture`; `pointermove` activates after 4px threshold, sets `data-tab-dragging="true"` on source, creates `.sw-tab-insertion-line` in `document.body`; `pointerup` calculates toIndex from tab midpoints and fires `onReorder`
- Keyboard navigation on strip container (event delegation): ArrowRight/Left with wrap, Home, End; calls `onSwitch` and immediately focuses the new tab button
- CSS: `.sw-tab-insertion-line` (fixed, 2px wide, accent color with box-shadow) and `[data-tab-dragging="true"]` opacity rule

**Task 2 — SuperWidget Cmd+W + onTabMetadataChange:**
- Constructor accepts optional `ShortcutRegistry` parameter
- Registers `Cmd+W` with D-06 guard (no-op when `_tabs.length <= 1`)
- `_reorderTabs()` calls `reorderTabs()` helper with reference-equality bail-out
- Injects `canvas.onTabMetadataChange` after `canvas.mount()` — canvas can update badge/label without triggering `commitProjection`
- `_updateTabMetadata()` creates new `TabSlot` without spread to satisfy `exactOptionalPropertyTypes`
- `destroy()` calls `this._shortcuts?.unregister('Cmd+W')`

## Verification

- `npx vitest run tests/superwidget/` — 307 tests, 16 files, all pass
- `npx tsc --noEmit` — zero errors in `src/superwidget/SuperWidget.ts` and `src/superwidget/TabBar.ts` (pre-existing errors in EditorCanvas.ts and test fixtures are out of scope)

## All 10 TABS Requirements Satisfied

| Req | Description | Plan |
|-----|-------------|------|
| TABS-01 | + button creates new tab | 174-02 |
| TABS-02 | x closes tab; last tab guarded | 174-02 |
| TABS-03 | click switches active tab | 174-02 |
| TABS-04 | active indicator (data-tab-active) | 174-02 |
| TABS-05 | drag-to-reorder with insertion line | **174-03** |
| TABS-06 | overflow chevrons for horizontal scroll | 174-02 |
| TABS-07 | ArrowLeft/Right/Home/End keyboard navigation | **174-03** |
| TABS-08 | Cmd+W closes active tab via ShortcutRegistry | **174-03** |
| TABS-09 | TabSlot type with tabId == projection.activeTabId | 174-01 |
| TABS-10 | onTabMetadataChange callback for badge/label updates | **174-03** |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Self-Check: PASSED

- `src/superwidget/TabBar.ts` — exists, contains `setPointerCapture`, `pointermove`, `ArrowRight`, `ArrowLeft`, `Home`, `End`, `onReorder`, `sw-tab-insertion-line`
- `src/superwidget/SuperWidget.ts` — exists, contains `Cmd+W`, `onTabMetadataChange`, `_updateTabMetadata`, `_reorderTabs`, `reorderTabs` import, `unregister('Cmd+W')`, `shortcuts?` parameter
- `src/styles/superwidget.css` — exists, contains `.sw-tab-insertion-line`, `data-tab-dragging`
- Commits `e6365af5` and `e13c93dc` verified in git log
