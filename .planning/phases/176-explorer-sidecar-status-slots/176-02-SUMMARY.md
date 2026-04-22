---
phase: 176-explorer-sidecar-status-slots
plan: "02"
subsystem: superwidget
tags: [status-bar, sync-indicator, per-canvas-status, css-animation]
dependency_graph:
  requires: [176-01-sidecar-grid-column]
  provides: [sync-indicator, per-canvas-status-bars, status-clearing]
  affects:
    - src/superwidget/SuperWidget.ts
    - src/superwidget/ViewCanvas.ts
    - src/superwidget/ExplorerCanvas.ts
    - src/styles/superwidget.css
    - src/main.ts
tech_stack:
  added: []
  patterns:
    - status-slot-clearing-on-canvas-switch
    - sync-indicator-always-visible
    - idempotent-status-dom-setup
    - filter-subscribe-for-reactive-status
key_files:
  created: []
  modified:
    - src/superwidget/SuperWidget.ts
    - src/superwidget/ViewCanvas.ts
    - src/superwidget/ExplorerCanvas.ts
    - src/styles/superwidget.css
    - src/main.ts
    - tests/superwidget/ViewCanvas.test.ts
    - tests/superwidget/SuperWidget.test.ts
decisions:
  - "ViewCanvasFilterLike extends FilterProviderLike with subscribe/getFilters — avoids widening the ViewManager-owned FilterProviderLike interface"
  - "ExplorerCanvas receives optional bridge as 3rd constructor param — avoids polluting DataExplorerPanelConfig"
  - "Filter count uses getFilters().length (FilterProvider API) not getActiveFilters() (does not exist)"
  - "renderStatusSlot/updateStatusSlot left as dead code in statusSlot.ts — future cleanup task"
metrics:
  duration: 460s
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 7
requirements:
  - STAT-01
  - STAT-02
  - STAT-03
  - STAT-04
  - STAT-05
  - STAT-06
  - STAT-07
---

# Phase 176 Plan 02: Per-Canvas Status Bars + Sync Indicator Summary

**One-liner:** Status slot clears on canvas switch and re-mounts sync indicator; each canvas type renders its own contextual status bar (view name + counts, card title, dataset info).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | SuperWidget status clearing + sync indicator + CSS | 5b968cbc | SuperWidget.ts, superwidget.css, main.ts |
| 2 | Per-canvas status rendering (ViewCanvas filters/selection, ExplorerCanvas dataset info) | 281dcd6c | ViewCanvas.ts, ExplorerCanvas.ts, main.ts, *.test.ts |

## What Was Built

### Task 1 — SuperWidget.ts + superwidget.css + main.ts

- Added `_renderSyncIndicator()` private method: creates `.sw-sync-indicator` wrapper with a `__dot` (6px circle) and `__label` span, appended to `_statusEl`
- Added `setSyncState(state: 'idle' | 'syncing' | 'error')` public method: sets `data-sync-state` on dot, updates label text (`Syncing…` / `Sync error` / empty)
- In `commitProjection()` Step 3.5: clears `_statusEl.innerHTML = ''` and re-appends sync indicator when canvas type/id/binding changes, preserving current sync state
- In constructor: calls `_renderSyncIndicator()` for initial sync dot
- CSS: `[data-slot="status"]` updated to `display: flex; align-items: center; padding`
- CSS: `.sw-sync-indicator` with border-right separator, dot, label
- CSS: `[data-sync-state="syncing"]` pulse animation (`@keyframes sw-sync-pulse 800ms`)
- CSS: `[data-sync-state="error"]` uses `var(--danger)`
- CSS: `.sw-view-status-bar`, `.sw-editor-status-bar`, `.sw-explorer-status-bar` base styles
- Removed global `renderStatusSlot(superWidget.statusEl)` call from main.ts (line 1624)
- Removed `updateStatusSlot(superWidget.statusEl, stats)` call from `refreshDataExplorer()` in main.ts

### Task 2 — ViewCanvas.ts + ExplorerCanvas.ts + main.ts

**ViewCanvas — filter + selection counts (STAT-01, STAT-05, STAT-07):**
- Added `ViewCanvasFilterLike` interface extending `FilterProviderLike` with `subscribe()` and `getFilters()`
- Added optional `selection` field to `ViewCanvasConfig`
- Added `_filterUnsub` and `_selectionUnsub` private fields
- In `mount()`: subscribes to `filter.subscribe()` and `selection.subscribe()` for reactive `_updateStatus()` calls
- `_updateStatus()` now creates filter-sep + filter-count + selection-sep + selection-count spans after card-count
- Filter/selection separators hidden via `style.display = 'none'` when count is 0
- `destroy()` calls both unsub functions before viewManager.destroy()
- Wired `selection` into main.ts ViewCanvas config

**EditorCanvas — no changes (STAT-02):**
- Existing `_updateStatus()` with `[data-stat="card-title"]` satisfies STAT-02 unchanged

**ExplorerCanvas — dataset status bar (STAT-03):**
- Added optional `bridge` as 3rd constructor param
- Added `_statusEl: HTMLElement | null = null` private field
- In `mount()`: DOM traversal finds `[data-slot="status"]`, sets `_statusEl`, calls `_updateStatus()`
- `_updateStatus()`: idempotent `.sw-explorer-status-bar` setup with `dataset-name` and `last-import` spans
- Queries `bridge.send('datasets:stats', {})` when bridge available; falls back to `'Data Explorer'` static label
- Uses `formatRelativeTime()` imported from `./statusSlot`
- In `destroy()`: sets `_statusEl = null`
- Wired `bridge` as 3rd arg to `new ExplorerCanvas(...)` in main.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ViewCanvas test mock missing subscribe/getFilters**
- **Found during:** Task 2 verification (vitest)
- **Issue:** `filter: {} as ViewCanvasConfig['filter']` in makeConfig() broke after ViewCanvasFilterLike required subscribe + getFilters
- **Fix:** Updated mock to `{ resetToDefaults: vi.fn(), subscribe: () => () => {}, getFilters: () => [] }`
- **Files modified:** tests/superwidget/ViewCanvas.test.ts
- **Commit:** 281dcd6c

**2. [Rule 1 - Bug] SuperWidget test SLAT-03 expected 0 children in status slot**
- **Found during:** Task 2 verification (vitest)
- **Issue:** Phase 176 always renders sync indicator in constructor, breaking the "no children when empty" assertion
- **Fix:** Updated test to verify sync indicator presence and 1 child count
- **Files modified:** tests/superwidget/SuperWidget.test.ts
- **Commit:** 281dcd6c

**3. [Rule 1 - Adaptation] getActiveFilters() → getFilters()**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan specified `filter.getActiveFilters()` but FilterProvider only has `getFilters()` (no `getActiveFilters` method exists)
- **Fix:** Used `getFilters().length` instead
- **Files modified:** src/superwidget/ViewCanvas.ts
- **Commit:** 281dcd6c

**4. [Rule 3 - Adaptation] ExplorerCanvas bridge as 3rd constructor param**
- **Found during:** Task 2 — DataExplorerPanelConfig has no bridge field
- **Issue:** Plan said to use `this._config.bridge.send(...)` but `DataExplorerPanelConfig` has no bridge
- **Fix:** Added optional `bridge` as 3rd constructor param to ExplorerCanvas; falls back to static label when absent
- **Files modified:** src/superwidget/ExplorerCanvas.ts, src/main.ts
- **Commit:** 281dcd6c

## Known Stubs

- `renderStatusSlot()` and `updateStatusSlot()` in `src/superwidget/statusSlot.ts` are now dead code (no longer called). `formatRelativeTime()` is still used by ExplorerCanvas. These dead exports are tracked for future cleanup — they do NOT block any plan goal.

## Verification

- `tsc --noEmit`: passes (only pre-existing EditorCanvas.ts + test errors, unrelated to this plan)
- `npx vitest run tests/superwidget/`: 330/330 tests pass
- `grep -n "renderStatusSlot\|updateStatusSlot" src/main.ts`: returns comment only (not a call)
- `grep "sw-sync-indicator" src/superwidget/SuperWidget.ts`: 6 matches (method + usage)
- `grep "filter-count" src/superwidget/ViewCanvas.ts`: 2 matches
- `grep "sw-explorer-status-bar" src/superwidget/ExplorerCanvas.ts`: 2 matches
- `grep "innerHTML" src/superwidget/SuperWidget.ts`: 1 match (status clearing in commitProjection)

## Self-Check: PASSED

Files:
- src/superwidget/SuperWidget.ts: FOUND
- src/superwidget/ViewCanvas.ts: FOUND
- src/superwidget/ExplorerCanvas.ts: FOUND
- src/styles/superwidget.css: FOUND
- src/main.ts: FOUND

Commits:
- 5b968cbc: FOUND
- 281dcd6c: FOUND
