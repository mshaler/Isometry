---
phase: 131-supergrid-defaults
plan: 02
subsystem: ui
tags: [pafv, supergrid, defaults, reset, flag-gate, projection-explorer]

# Dependency graph
requires:
  - phase: 131-01
    provides: ViewDefaultsRegistry, resolveDefaults, PAFVProvider.applySourceDefaults

provides:
  - StateManager.getActiveDatasetId(): public getter for active dataset ID
  - First-import flag gate: view:defaults:applied:{datasetId} in ui_state prevents re-apply on re-import
  - ProjectionExplorer._updateResetButtonVisibility(): compare-against-registry override detection (D-05)
  - ProjectionExplorer._handleResetDefaults(): AppDialog confirmation + PAFVProvider axis restore
  - Reset button DOM (projection-explorer__reset-btn) in ProjectionExplorer footer
  - CSS: .projection-explorer__footer + .projection-explorer__reset-btn

affects: [131-03, supergrid-defaults]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Flag gate pattern: ui:get check before apply, ui:set after — idempotent first-import guard"
    - "Compare-against-registry override detection: JSON.stringify comparison, no dirty flag, no extra state (D-05)"
    - "Optional getSourceType on config interface — no-op if not provided (backward compat)"

key-files:
  created: []
  modified:
    - src/providers/StateManager.ts
    - src/main.ts
    - src/ui/ProjectionExplorer.ts
    - src/styles/projection-explorer.css
    - tests/providers/ViewDefaultsRegistry.test.ts

key-decisions:
  - "getSourceType is optional on ProjectionExplorerConfig — footer only rendered when provided (backward compat with existing callers)"
  - "activeSourceType tracked in main.ts closure — set from import wrappers and handleDatasetSwitch query"
  - "Flag gate uses bridge.send('ui:get') directly (not StateManager) — ui_state is not a provider-scoped key"

patterns-established:
  - "First-import flag: view:defaults:applied:{datasetId} — set once after applySourceDefaults, blocks all subsequent re-imports for that dataset"

requirements-completed: [SGDF-04, SGDF-05, SGDF-06]

# Metrics
duration: 15min
completed: 2026-03-27
---

# Phase 131 Plan 02: SuperGrid Defaults Summary

**First-import flag gate (SGDF-06) + override detection + Reset to Defaults button in ProjectionExplorer footer (SGDF-05)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-27T17:59:00Z
- **Completed:** 2026-03-27T18:13:26Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- StateManager.getActiveDatasetId() exposed as public getter
- First-import flag gate wraps both importFile and importNative: checks `view:defaults:applied:{datasetId}` before applying defaults, sets it after
- ProjectionExplorer: added optional `getSourceType` to config interface
- Footer with Reset button appended to mount() when `getSourceType` provided
- `_updateResetButtonVisibility()` called after every `_renderChips()` — compare-against-registry approach (D-05), no dirty flag
- `_handleResetDefaults()` — AppDialog.show confirm dialog with exact UI-SPEC copy, then setColAxes/setRowAxes from resolveDefaults
- CSS: `.projection-explorer__footer` and `.projection-explorer__reset-btn` matching properties-explorer pattern
- `activeSourceType` variable in main.ts closure, set from import wrappers and handleDatasetSwitch db query
- 2 new test cases for SGDF-06 flag key convention (15 total in ViewDefaultsRegistry.test.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: First-import flag gate in main.ts** - `e9042858` (feat)
2. **Task 2: Reset-to-defaults button in ProjectionExplorer** - `02e172e0` (feat)

## Files Created/Modified

- `src/providers/StateManager.ts` — Added `getActiveDatasetId()` public getter
- `src/main.ts` — Flag gate in both import wrappers; activeSourceType tracking; getSourceType wired to ProjectionExplorer
- `src/ui/ProjectionExplorer.ts` — getSourceType config field, footer+button in mount(), _updateResetButtonVisibility(), _handleResetDefaults(), imports for AppDialog+resolveDefaults
- `src/styles/projection-explorer.css` — Footer and reset button CSS
- `tests/providers/ViewDefaultsRegistry.test.ts` — 2 new SGDF-06 flag key convention tests

## Decisions Made

- `getSourceType` is optional on `ProjectionExplorerConfig` — footer not rendered when absent (backward compatibility with any existing tests or callers that don't provide it)
- `activeSourceType` tracked as closure variable in main.ts — updated in handleDatasetSwitch via db query and in import wrappers from source/sourceType param
- Flag gate uses `bridge.send('ui:get')` directly (not StateManager) — `view:defaults:applied:*` is not a registered provider key, it's a raw ui_state entry

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all functionality is wired end-to-end.

---

## Self-Check

**Files exist:**
- `src/providers/StateManager.ts` — FOUND (modified)
- `src/main.ts` — FOUND (modified)
- `src/ui/ProjectionExplorer.ts` — FOUND (modified)
- `src/styles/projection-explorer.css` — FOUND (modified)

**Commits exist:**
- `e9042858` — FOUND
- `02e172e0` — FOUND

**TypeScript:** Zero errors (npx tsc --noEmit exits 0)
**Unit tests:** 1809 pass (providers + seams)

## Self-Check: PASSED

---
*Phase: 131-supergrid-defaults*
*Completed: 2026-03-27*
