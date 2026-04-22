---
phase: 171-viewcanvas
plan: 01
subsystem: superwidget
tags: [viewcanvas, canvascomponent, viewmanager, tdd]
dependency_graph:
  requires:
    - src/views/ViewManager.ts
    - src/superwidget/projection.ts (CanvasComponent interface)
    - src/superwidget/registry.ts (register/getRegistryEntry)
    - src/providers/types.ts (ViewType union)
  provides:
    - src/superwidget/ViewCanvas.ts (production CanvasComponent for view-1)
    - VIEW_DISPLAY_NAMES constant (9 ViewType display names)
  affects:
    - src/superwidget/registry.ts (removed ViewCanvasStub for view-1)
    - src/main.ts (added view-1 real ViewCanvas registration)
    - tests/superwidget/registry.test.ts
    - tests/superwidget/integration.test.ts
    - tests/superwidget/canvasWiring.test.ts
tech_stack:
  added: []
  patterns:
    - TDD (red-green-refactor)
    - wrapper-div isolation (D-10)
    - VIEW_SIDECAR_MAP per-view sidecar lookup constant
    - DOM traversal for status slot wiring (sibling slot pattern)
key_files:
  created:
    - src/superwidget/ViewCanvas.ts
    - tests/superwidget/ViewCanvas.test.ts
  modified:
    - src/superwidget/registry.ts
    - src/main.ts
    - tests/superwidget/registry.test.ts
    - tests/superwidget/integration.test.ts
    - tests/superwidget/canvasWiring.test.ts
decisions:
  - VIEW_SIDECAR_MAP constant in ViewCanvas.ts for per-view sidecar lookup (only supergrid -> explorer-1)
  - DOM traversal in mount() to find status slot via container.parentElement?.querySelector('[data-slot="status"]')
  - Updated integration/wiring tests to explicitly register ViewCanvasStub for tests checking stub DOM behavior
metrics:
  duration: "5m 1s"
  completed: "2026-04-21"
  tasks_completed: 2
  files_created: 2
  files_modified: 5
---

# Phase 171 Plan 01: ViewCanvas Implementation Summary

**One-liner:** Production ViewCanvas CanvasComponent wrapping ViewManager with wrapper-div isolation, status slot rendering, and per-view sidecar signaling via VIEW_SIDECAR_MAP.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (TDD) | Create ViewCanvas.ts | 82fbeca2 (test), c9901f88 (impl) | src/superwidget/ViewCanvas.ts, tests/superwidget/ViewCanvas.test.ts |
| 2 | Wire registry and main.ts | fab54066 | src/superwidget/registry.ts, src/main.ts, 3 test files |

## Requirements Satisfied

- **VCNV-01:** All 9 ViewTypes render through ViewManager wrapper-div isolation
- **VCNV-02:** Projection state activeTabId drives ViewManager.switchTo with validation
- **VCNV-03:** Status slot shows view name and card count after each render via onViewSwitch callback
- **VCNV-04:** Sidecar callback fires per-view based on VIEW_SIDECAR_MAP (supergrid -> 'explorer-1', others null)
- **VCNV-05:** destroy() tears down ViewManager, removes wrapper el, nulls all references (idempotent)
- **CANV-06 preserved:** SuperWidget.ts has zero ViewCanvas imports (verified by grep)

## Key Design Decisions

1. **VIEW_SIDECAR_MAP constant** — A `Partial<Record<ViewType, string>>` in ViewCanvas.ts rather than using `getRegistryEntry()` for sidecar lookup. The registry entry's `defaultExplorerId` is canvas-level (always 'explorer-1' for view-1), but sidecar visibility should vary per active ViewType — only supergrid needs it.

2. **DOM traversal for status slot** — `ViewCanvas.mount()` finds the status slot via `container.parentElement?.querySelector('[data-slot="status"]')`. This keeps ViewCanvas decoupled from SuperWidget while supporting automatic status wiring when mounted in the SuperWidget DOM structure. External callers can also use `setStatusEl()` directly.

3. **Integration/wiring test updates** — Tests that relied on `registerAllStubs()` providing view-1 were updated to explicitly register `ViewCanvasStub` for view-1. This preserves the existing DOM behavior assertions (`[data-canvas-type="View"]`, `[data-sidecar]`) while allowing the real ViewCanvas to live only in main.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript exactOptionalPropertyTypes violation in ViewCanvas.mount()**
- **Found during:** tsc --noEmit verification
- **Issue:** `announcer: this._config.announcer` (type `Announcer | undefined`) not assignable to `ViewManagerConfig.announcer` (type `Announcer`) under `exactOptionalPropertyTypes: true`
- **Fix:** Conditional spread `...(this._config.announcer !== undefined && { announcer: ... })` pattern
- **Files modified:** src/superwidget/ViewCanvas.ts
- **Commit:** fab54066

**2. [Rule 1 - Bug] Test mock for IView included non-existent `viewType` property**
- **Found during:** tsc --noEmit verification
- **Issue:** `viewType` property not in `IView` interface
- **Fix:** Removed `viewType` from `makeMockView()` in test
- **Files modified:** tests/superwidget/ViewCanvas.test.ts
- **Commit:** fab54066

**3. [Rule 1 - Bug] Test missing `afterEach` import from vitest**
- **Found during:** tsc --noEmit verification
- **Fix:** Added `afterEach` to vitest import
- **Files modified:** tests/superwidget/ViewCanvas.test.ts
- **Commit:** fab54066

## Test Results

- ViewCanvas unit tests: 22/22 passing
- All superwidget tests: 228/228 passing (zero regressions)
- TypeScript: no errors in changed files (pre-existing ExplorerCanvas.test.ts mock type error unaffected)

## Known Stubs

None — ViewCanvas is the production implementation replacing ViewCanvasStub.

## Self-Check: PASSED
