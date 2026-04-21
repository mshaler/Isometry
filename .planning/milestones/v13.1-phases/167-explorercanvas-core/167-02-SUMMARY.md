---
phase: 167-explorercanvas-core
plan: 02
subsystem: ui
tags: [typescript, superwidget, canvas, DataExplorerPanel, main, registry]

# Dependency graph
requires:
  - phase: 167-01
    provides: ExplorerCanvas class implementing CanvasComponent
  - phase: 165-canvas-stubs-registry
    provides: registry.ts with register/registerAllStubs/getCanvasFactory
  - phase: 164-projection-rendering
    provides: SuperWidget.commitProjection() lifecycle
affects:
  - 168-tab-system
  - 170-integration-testing

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SuperWidget as sole DataExplorerPanel host: ExplorerCanvas registered via closure capture in main.ts"
    - "Post-commitProjection panel access: dataExplorer assigned after commitProjection() so getPanel() is non-null"
    - "registerAllStubs() + register() override pattern: stubs first, then real implementation overwrites explorer-1"

key-files:
  created: []
  modified:
    - src/main.ts

key-decisions:
  - "explorerCanvas captured as module-level let; cast required at getPanel() call site due to TypeScript control-flow narrowing in closures"
  - "syncTopSlotVisibility always returns display:block (SuperWidget always mounted — no PanelManager toggle needed)"
  - "data-explorer PanelRegistry entry completely removed; PanelManager groups array emptied (no more integrate group)"
  - "DataExplorerPanel import changed to type-only (runtime access via ExplorerCanvas.getPanel())"

requirements-completed: [EXCV-01, EXCV-04, EXCV-05]

# Metrics
duration: 8min
completed: 2026-04-21
---

# Phase 167 Plan 02: main.ts Registry Wiring Summary

**SuperWidget mounted in main.ts top slot with ExplorerCanvas registered as 'explorer-1'; sidebar DataExplorerPanel PanelRegistry entry removed; catalogGrid and refreshDataExplorer() work through ExplorerCanvas.getPanel()**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-21T13:54:00Z
- **Completed:** 2026-04-21T14:02:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `register('explorer-1', { canvasType: 'Explorer', create: () => new ExplorerCanvas({...}) })` wired in main.ts with all 7 callbacks from the old PanelRegistry factory
- `SuperWidget(getCanvasFactory())` mounted into `dataExplorerChildEl` (top slot)
- `superWidget.commitProjection(initialProjection)` commits initial Explorer projection on boot, triggering `ExplorerCanvas.mount()` → `DataExplorerPanel.mount()`
- `dataExplorer = explorerCanvas.getPanel()` assigned after commitProjection so getPanel() returns non-null panel
- `catalogGrid` mounted into `getCatalogBodyEl()` after commitProjection (body element valid post-mount)
- `void refreshDataExplorer()` called after catalogGrid mount — stats and recent cards populated on boot
- Old `panelRegistry.register({id: 'data-explorer', ...})` block (~175 lines) removed
- `PanelManager` slots: `data-explorer` entry removed; `groups` array emptied (integrate group removed)
- `syncTopSlotVisibility()` simplified to always show top slot (SuperWidget always visible)
- `DataExplorerPanel` import changed to `import type` (runtime access through ExplorerCanvas wrapper)
- CANV-06 preserved: `grep -c 'ExplorerCanvas' src/superwidget/SuperWidget.ts` returns 0
- TypeScript compiles clean: `npx tsc --noEmit` exits 0
- All 168 superwidget tests pass

## Task Commits

1. **Task 1: Register ExplorerCanvas and mount SuperWidget in main.ts** - `840b1399` (feat)

## Files Created/Modified
- `src/main.ts` - SuperWidget boot wiring, ExplorerCanvas registration, PanelRegistry data-explorer removal

## Decisions Made
- TypeScript control-flow narrows `explorerCanvas` to `never` after closure assignment — explicit cast `(explorerCanvas as ExplorerCanvas | null)?.getPanel()` required
- `syncTopSlotVisibility` always sets `display: 'block'` — SuperWidget is permanently mounted, no toggle needed
- `PanelManager` groups emptied rather than leaving a one-entry integrate group (no remaining panel pairs to group)
- `DataExplorerPanel` import is now type-only since the runtime value flows through ExplorerCanvas

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript control-flow narrowing of explorerCanvas**
- **Found during:** Task 1
- **Issue:** TypeScript narrows `explorerCanvas` to `never` at `explorerCanvas?.getPanel()` because the assignment happens inside a closure (`create()`) that TypeScript can't prove has been called
- **Fix:** Added explicit cast `(explorerCanvas as ExplorerCanvas | null)?.getPanel()` with a biome-ignore comment
- **Files modified:** src/main.ts
- **Commit:** 840b1399

## Known Stubs
None — all callbacks are wired with real implementations. dataExplorer is populated on boot via getPanel() after commitProjection.

## Self-Check: PASSED
- `src/main.ts` — modified (git diff confirms changes)
- Commit `840b1399` — exists in git log
- `npx tsc --noEmit` — exits 0
- `npx vitest run tests/superwidget/` — 168/168 pass
- `grep -c 'ExplorerCanvas' src/superwidget/SuperWidget.ts` — returns 0 (CANV-06)
- `grep "panelRegistry.register" src/main.ts | grep "data-explorer"` — empty (PanelRegistry entry removed)
- `grep "register('explorer-1'" src/main.ts` — shows new canvas registry entry

---
*Phase: 167-explorercanvas-core*
*Completed: 2026-04-21*
