---
phase: 174-tab-management
plan: "01"
subsystem: superwidget
tags: [tab-management, types, contracts, tdd]
dependency_graph:
  requires: []
  provides: [TabSlot type, makeTabSlot factory, removeTab helper, reorderTabs helper, TabMetadata interface, CanvasComponent.onTabMetadataChange]
  affects: [src/superwidget/TabSlot.ts, src/superwidget/projection.ts]
tech_stack:
  added: []
  patterns: [TDD red-green-refactor, readonly arrays, reference-equality bail-outs]
key_files:
  created:
    - src/superwidget/TabSlot.ts
    - tests/superwidget/TabSlot.test.ts
  modified:
    - src/superwidget/projection.ts
decisions:
  - TabSlot.tabId and projection.activeTabId are the same value — shell identity equals canvas active tab
  - makeTabSlot with explicit projection override uses it as-is without modification
  - removeTab D-06 guard: last-tab protection via reference equality return
  - reorderTabs uses splice()[0] cast (bounds already verified) to satisfy TypeScript strict mode
metrics:
  duration: "~3 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_changed: 3
---

# Phase 174 Plan 01: TabSlot Type Contracts Summary

TabSlot interface and factory with View Bound defaults, plus TabMetadata callback extension on CanvasComponent.

## What Was Built

**Task 1: TabSlot type, factory, and helpers (TDD)**

Created `src/superwidget/TabSlot.ts` with:
- `TabSlot` interface: `tabId`, `label`, `badge?`, `projection` — wraps Projection with shell-level metadata
- `makeTabSlot(overrides?)` factory: generates unique tabId, defaults to View/Bound/primary (D-01), ensures `tabId == projection.activeTabId`
- `removeTab(tabs, tabId)`: guards last-tab per D-06 and missing-tabId via reference equality
- `reorderTabs(tabs, fromIndex, toIndex)`: bounds-checked splice with same-index bail-out

**Task 2: projection.ts extension (additive)**

Added to `src/superwidget/projection.ts`:
- `TabMetadata` interface with optional `label?` and `badge?` fields
- `onTabMetadataChange?: ((meta: TabMetadata) => void) | undefined` on `CanvasComponent`

The addition is purely additive — all three existing stub implementations (EditorCanvasStub, ViewCanvasStub, ExplorerCanvasStub) satisfy the interface without modification because the new field is optional.

## Verification

- `npx vitest run tests/superwidget/TabSlot.test.ts` — 29 tests pass
- `npx vitest run tests/superwidget/` — 276 tests pass (full superwidget suite)
- `npx tsc --noEmit` — zero errors in files modified by this plan (pre-existing errors in EditorCanvas.ts test mocks are unrelated)

## Deviations from Plan

**1. [Rule 1 - Bug] TypeScript strict mode: splice destructuring produces `TabSlot | undefined`**
- **Found during:** Task 1 (tsc --noEmit check after Task 2)
- **Issue:** `const [moved] = result.splice(fromIndex, 1)` types `moved` as `TabSlot | undefined` under strict mode even though bounds were already verified.
- **Fix:** Changed to `result.splice(fromIndex, 1)[0] as TabSlot` with a comment noting the invariant.
- **Files modified:** `src/superwidget/TabSlot.ts`
- **Commit:** `3d3787db`

## Known Stubs

None — all exported values are fully implemented.

## Self-Check: PASSED
