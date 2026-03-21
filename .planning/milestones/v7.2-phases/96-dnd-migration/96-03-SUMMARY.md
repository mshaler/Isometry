---
phase: 96-dnd-migration
plan: "03"
subsystem: testing
tags: [dnd, pointer-events, kanban, jsdom, test-escape-hatch]
dependency_graph:
  requires: [96-02]
  provides: [DND-03-test-coverage]
  affects: [tests/views/KanbanView.test.ts, src/views/KanbanView.ts]
tech_stack:
  added: []
  patterns:
    - data-kanban-drop-target jsdom escape hatch (matching data-sg-drop-target in SuperGrid.ts)
    - optional chaining on setPointerCapture/releasePointerCapture for jsdom compat
    - firePointerEvent/fireCardToDrop test helpers matching SuperGrid.test.ts pattern
    - afterEach cleanup for ghost elements appended to document.body
key_files:
  created: []
  modified:
    - src/views/KanbanView.ts
    - tests/views/KanbanView.test.ts
decisions:
  - optional chaining on pointer capture API calls enables jsdom test execution without brittle jsdom polyfills
  - afterEach ghost cleanup required because module-level _kanbanGhostEl persists across tests (not scoped to class instance)
  - two-pass hit-test: escape hatch first, getBoundingClientRect second -- zero production cost
metrics:
  duration_minutes: 15
  completed_date: "2026-03-19T12:20:00Z"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 96 Plan 03: KanbanView DnD Test Migration Summary

**One-liner:** Rewrote 9 KanbanView DnD tests from HTML5 DnD (DragEvent/dataTransfer) to pointer events (pointerdown/pointermove/pointerup) with jsdom escape hatch via data-kanban-drop-target dataset attribute.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add jsdom test escape hatch to KanbanView.ts pointerup handler | 295b5500 | src/views/KanbanView.ts |
| 2 | Rewrite KanbanView DnD tests for pointer events | dfefb20e | tests/views/KanbanView.test.ts, src/views/KanbanView.ts |

## Verification Results

- `grep -c 'DragEvent\|dataTransfer\|dragstart\|dragover\|dragleave' tests/views/KanbanView.test.ts` → **0** (no HTML5 DnD artifacts)
- `grep -c 'kanbanDropTarget' src/views/KanbanView.ts` → **2** (check + delete)
- `grep -c 'firePointerEvent\|fireCardToDrop' tests/views/KanbanView.test.ts` → **15**
- All 9 DnD tests: **PASS** (KanbanView pointer-event drag-drop describe block)
- 2 pre-existing Phase 94 rendering failures remain (out of scope)

## Decisions Made

1. **Optional chaining on pointer capture:** `setPointerCapture?.()` and `releasePointerCapture?.()` — jsdom does not implement these methods on HTMLElement. SuperGrid.ts already used this pattern; KanbanView.ts used direct calls which threw in tests.

2. **afterEach ghost cleanup:** Module-level `_kanbanGhostEl` (line 26 of KanbanView.ts) is shared across tests because it is a module global, not instance state. Tests that fire `pointerdown` without a matching `pointerup` leave orphaned ghost elements in `document.body`. Added explicit cleanup in `afterEach`.

3. **Two-pass hit-test pattern:** Escape hatch first pass checks `data-kanban-drop-target`, second pass uses `getBoundingClientRect`. This is identical to the `data-sg-drop-target` pattern in SuperGrid.ts. Zero production cost — no column body has this attribute unless test code sets it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Optional chaining on pointer capture API for jsdom compat**
- **Found during:** Task 2 (first test run)
- **Issue:** `cardEl.releasePointerCapture(e.pointerId)` and `cardEl.setPointerCapture(e.pointerId)` threw `TypeError: not a function` in jsdom — these methods are not implemented in jsdom's HTMLElement
- **Fix:** Changed both to optional chaining (`?.()`) matching the SuperGrid.ts pattern already in production at lines 4263, 4314, 4491, 4542
- **Files modified:** src/views/KanbanView.ts (lines 361, 404)
- **Commit:** dfefb20e

**2. [Rule 3 - Blocking] afterEach ghost cleanup for module-level shared state**
- **Found during:** Task 2 (second test run — `pointerup removes ghost` and `pointercancel` failures)
- **Issue:** Module-level `_kanbanGhostEl` variable persists between test cases. Tests that fire `pointerdown` without cleanup leave orphaned `.kanban-card--ghost` elements in `document.body`. The next test that checked for ghost absence found the orphan instead of null.
- **Fix:** Added `document.body.querySelectorAll('.kanban-card--ghost').forEach((el) => el.remove())` to `afterEach` in the DnD describe block
- **Files modified:** tests/views/KanbanView.test.ts
- **Commit:** dfefb20e

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| DND-03 | SATISFIED (implementation + tests) | KanbanView pointer DnD implemented (96-02); 9 DnD tests now validate pointer events end-to-end |
| DND-05 | SATISFIED | Ghost element, cursor feedback, drag-over class all verified in passing tests |

## Self-Check: PASSED

- tests/views/KanbanView.test.ts: FOUND
- src/views/KanbanView.ts: FOUND
- .planning/phases/96-dnd-migration/96-03-SUMMARY.md: FOUND
- Commit 295b5500: FOUND
- Commit dfefb20e: FOUND
