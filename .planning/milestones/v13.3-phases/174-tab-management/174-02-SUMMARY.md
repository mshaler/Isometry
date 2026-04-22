---
phase: 174-tab-management
plan: "02"
subsystem: superwidget
tags: [tab-management, tabbar, css, tdd, overflow]
dependency_graph:
  requires: [TabSlot type from 174-01]
  provides: [TabBar class, SuperWidget tab wiring, chevron overflow CSS]
  affects:
    - src/superwidget/TabBar.ts
    - src/superwidget/SuperWidget.ts
    - src/styles/superwidget.css
    - tests/superwidget/TabBar.test.ts
    - tests/superwidget/SuperWidget.test.ts
tech_stack:
  added: []
  patterns: [TDD red-green-refactor, event delegation, ResizeObserver, D3-free DOM construction]
key_files:
  created:
    - src/superwidget/TabBar.ts
    - tests/superwidget/TabBar.test.ts
  modified:
    - src/superwidget/SuperWidget.ts
    - src/styles/superwidget.css
    - tests/superwidget/SuperWidget.test.ts
    - tests/superwidget/canvasWiring.test.ts
    - tests/superwidget/commitProjection.test.ts
    - tests/superwidget/integration.test.ts
    - tests/superwidget/explorer-canvas-integration.test.ts
decisions:
  - TabBar uses display:contents root so its children (chevrons, strip, add) participate in tabs slot flex layout directly
  - ResizeObserver stub added to all jsdom test files that import SuperWidget (not a vitest setup — surgical per-file)
  - event delegation on strip (single click listener) prevents per-tab closure allocation
metrics:
  duration: "~5 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 9
---

# Phase 174 Plan 02: TabBar Class and SuperWidget Wiring Summary

TabBar class with create/close/switch/overflow, wired into SuperWidget replacing placeholder tabs. CSS updated to chevron-based overflow.

## What Was Built

**Task 1: TabBar class with TDD**

Created `src/superwidget/TabBar.ts` with:
- `TabBarConfig` interface exported alongside `TabBar` class
- Constructor builds DOM: left chevron + `.sw-tab-strip` + right chevron + `.sw-tab-strip__add`
- `.sw-tab-strip` has `role="tablist"` and `aria-label="Workspace tabs"`
- Event delegation on strip: single click listener distinguishes `.sw-tab__close` (onClose + stopPropagation) from `[data-tab-role="tab"]` (onSwitch)
- Active tab: `data-tab-active="true"`, `aria-selected="true"`, `tabindex="0"`
- Inactive tabs: `aria-selected="false"`, `tabindex="-1"`
- Sole-tab guard: close button `style.display = "none"` when `tabs.length <= 1`
- ResizeObserver drives chevron show/hide via `_updateChevrons()`
- `update(tabs, activeTabId)` re-renders the tab list
- `scrollToTab(tabId)` and `focusTab(tabId)` public API for scroll-into-view
- `destroy()` disconnects ResizeObserver, removes scroll listener, removes root

12 tests in `tests/superwidget/TabBar.test.ts`, all passing (TDD green).

**Task 2: SuperWidget wiring and CSS update**

Updated `src/superwidget/SuperWidget.ts`:
- Imports `TabBar`, `makeTabSlot`, `removeTab` from their respective modules
- Private fields: `_tabBar: TabBar`, `_tabs: TabSlot[]`, `_activeTabSlotId: string`
- Constructor replaces placeholder button loop and gear button with `makeTabSlot()` + `new TabBar({...})`
- `_switchToTab(tabId)`: reference-equality guard, updates TabBar, calls `commitProjection`
- `_createTab()`: appends new tab, activates it, calls `commitProjection`, scrolls into view
- `_closeTab(tabId)`: guards last-tab, applies D-04 adjacent-tab selection, calls `commitProjection`
- `destroy()` now calls `this._tabBar.destroy()` before root removal
- Public getters: `tabs` and `activeTabSlotId` for Plan 03 and Phase 177

Updated `src/styles/superwidget.css`:
- `[data-slot="tabs"]` rule: removed `overflow-x: auto`, `scrollbar-width: none`, `gap`, `mask-image`; now `overflow: hidden` (tabs slot is the clip boundary)
- Added `.sw-tab-strip` (inner scrollable flex row, `scrollbar-width: none`)
- Added `.sw-tab-strip__chevron` (28px, `display: none` by default)
- Added `.sw-tab-strip__add` (28px add button)
- Added `.sw-tab__close` (16px inline close button with danger hover)
- Added `.sw-tab__label` (truncating with `max-width: 120px`)
- Added `.sw-tab__badge` (muted text badge)
- Added `--sw-tab-max-width`, `--sw-tab-close-size`, `--sw-chevron-size`, `--sw-tab-drag-opacity`, `--sw-insertion-line-color` tokens
- Removed `[data-tab-role="config"]` and its hover rule

Updated 5 test files:
- `SuperWidget.test.ts`: SLAT-02 tests updated for TabBar (checks `.sw-tab-strip`, `.sw-tab-strip__add`, absence of config gear); SLAT-04 tests updated for chevron overflow (checks `.sw-tab-strip__chevron`, absence of `mask-image` in tabs slot rule)
- `canvasWiring.test.ts`, `commitProjection.test.ts`, `integration.test.ts`, `explorer-canvas-integration.test.ts`: ResizeObserver stub added (Rule 1 fix — these files import SuperWidget which now constructs a TabBar that uses ResizeObserver)

## Verification

- `npx vitest run tests/superwidget/TabBar.test.ts` — 12 tests pass
- `npx vitest run tests/superwidget/` — 289 tests pass (full superwidget suite)
- `npx tsc --noEmit` — zero new errors in files modified by this plan (pre-existing errors in EditorCanvas.ts test mocks are unrelated, unchanged from Plan 01)

## Deviations from Plan

**1. [Rule 1 - Bug] ResizeObserver not defined in jsdom environment**
- **Found during:** Task 1 test run
- **Issue:** jsdom does not implement ResizeObserver. TabBar constructor instantiates one, causing `ReferenceError: ResizeObserver is not defined` in all jsdom test files that import SuperWidget.
- **Fix:** Added a minimal ResizeObserver stub (`observe/unobserve/disconnect` no-ops) to all affected test files via `if (typeof ResizeObserver === 'undefined')` guard. Follows the existing jsdom+WASM coexistence pattern from v6.1 (per-file annotation rather than global setup).
- **Files modified:** `tests/superwidget/TabBar.test.ts`, `tests/superwidget/SuperWidget.test.ts`, `tests/superwidget/canvasWiring.test.ts`, `tests/superwidget/commitProjection.test.ts`, `tests/superwidget/integration.test.ts`, `tests/superwidget/explorer-canvas-integration.test.ts`
- **Commits:** `c6c51874`, `0fd5f85c`

**2. [Rule 1 - Bug] TabBar root element layout: display:contents**
- **Found during:** Task 2 (CSS integration review)
- **Issue:** The plan appends `_tabBar.el` to the tabs slot. The tabs slot is `display: flex`. The TabBar has 4 child elements (left chevron, strip, right chevron, add button) that need to be direct flex children of the tabs slot. Using a wrapper div would break the flex layout.
- **Fix:** Used `display: contents` on `sw-tab-bar-root` div, making its children participate in the parent flex layout directly. This is consistent with the CSS spec for flex participation.
- **Files modified:** `src/superwidget/TabBar.ts`

## Known Stubs

None — all exported values are fully implemented. The chevron show/hide logic uses `scrollLeft === 0` and `scrollLeft + clientWidth >= scrollWidth - 1` guards, which correctly return hidden in jsdom (where scroll geometry is 0).

## Self-Check: PASSED
