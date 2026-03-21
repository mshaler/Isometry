---
status: diagnosed
phase: 96-dnd-migration
source: [96-01-SUMMARY.md, 96-02-SUMMARY.md, 96-03-SUMMARY.md]
started: 2026-03-19T14:00:00Z
updated: 2026-03-19T14:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SuperGrid Row Axis Grip Reorder
expected: In SuperGrid view, drag a row axis header grip up or down. A ghost chip with LATCH-colored border follows your cursor. An insertion line appears at the midpoint between axes. On drop, axes reorder to the new position.
result: issue
reported: "Axes do not reorder to new position?"
severity: major

### 2. SuperGrid Column Axis Grip Reorder
expected: In SuperGrid view, drag a column axis header grip left or right. Ghost chip follows cursor with LATCH color border. Insertion line appears at midpoint. On drop, columns reorder correctly.
result: issue
reported: "Same issue as rows. Can't move stacked/nested headers, and there are alignment issues as well."
severity: major

### 3. SuperGrid Cross-Dimension Transpose
expected: Drag a row axis grip into the column drop zone (or vice versa). The drop zone highlights with a drag-over class during hover. On drop, the axis moves from rows to columns (or columns to rows).
result: issue
reported: "same issue, can't drag axes at all"
severity: major

### 4. KanbanView Card Drag Between Columns
expected: In Kanban view, drag a card from one column to another. A ghost card (slightly scaled up, semi-transparent) follows your cursor. The destination column highlights during hover. On drop, the card moves to the new column and its axis value updates.
result: issue
reported: "Kanban only behaves as a list (no columns, even when I try to drag a chip from available into either X- or Y-plane) and no ordering persists (because no columns)"
severity: major

### 5. DataExplorerPanel Browse Files Button
expected: In the Data Explorer panel, a "Browse Files..." button is visible alongside the drag-drop zone. Clicking it opens the system file picker. Selecting a file triggers import (same behavior as drag-and-drop import).
result: issue
reported: "Neither Import File nor Browse Files... does anything"
severity: major

### 6. SuperGrid Drop Zone Highlighting
expected: While dragging an axis grip, the drop zones highlight with a visual indicator (drag-over class) as the ghost chip hovers over them. Highlight clears when moving away from the drop zone.
result: issue
reported: "Drop Zone highlighting works, drops do not persist"
severity: minor

## Summary

total: 6
passed: 0
issues: 6
pending: 0
skipped: 0

## Gaps

- truth: "Axes reorder to the new position after dropping a row axis grip"
  status: failed
  reason: "User reported: Axes do not reorder to new position?"
  severity: major
  test: 1
  root_cause: "_handlePointerDrop requires targetDimension from drop zone hit-test, but same-dimension reorder never hits a drop zone (6px edge strips are for cross-dimension transpose only). _lastReorderTargetIndex is correctly calculated during pointermove but never consumed — the same-dimension reorder code path is unreachable."
  artifacts:
    - path: "src/views/SuperGrid.ts"
      issue: "_handlePointerDrop line ~4812: same-dimension reorder path unreachable because targetDimension is always null when dragging within same dimension"
  missing:
    - "Bypass drop zone hit-test for same-dimension reorder — if _lastReorderTargetIndex >= 0 and source dimension matches header area, commit reorder directly"
  debug_session: ".planning/debug/supergrid-axis-grip-dnd-drop.md"
- truth: "Column axes reorder correctly and stacked/nested headers can be moved"
  status: failed
  reason: "User reported: Same issue as rows. Can't move stacked/nested headers, and there are alignment issues as well."
  severity: major
  test: 2
  root_cause: "Same root cause as test 1 — _handlePointerDrop same-dimension reorder path unreachable. Additionally, stacked/nested headers may have grip elements that don't receive pointer events due to z-index or overlap."
  artifacts:
    - path: "src/views/SuperGrid.ts"
      issue: "_handlePointerDrop same-dimension reorder unreachable; nested header grips may have pointer event occlusion"
  missing:
    - "Fix same-dimension reorder path"
    - "Verify grip pointer events work on stacked/nested headers"
  debug_session: ".planning/debug/supergrid-axis-grip-dnd-drop.md"
- truth: "Cross-dimension transpose works — dragging axis grip to opposite drop zone moves the axis"
  status: failed
  reason: "User reported: same issue, can't drag axes at all"
  severity: major
  test: 3
  root_cause: "Drop zones are 6px edge strips — nearly impossible to hit reliably. Even for cross-dimension transpose, user must release pointer within a 6px strip with no large visual affordance."
  artifacts:
    - path: "src/views/SuperGrid.ts"
      issue: "Drop zones created at lines 644-671 with height:6px (col) and width:6px (row) — too small for reliable hit-testing"
  missing:
    - "Enlarge drop zones during active drag or use header region detection instead of tiny edge strips"
  debug_session: ".planning/debug/supergrid-axis-grip-dnd-drop.md"
- truth: "Kanban renders columns based on axis assignment and cards can be dragged between columns"
  status: failed
  reason: "User reported: Kanban only behaves as a list (no columns, even when I try to drag a chip from available into either X- or Y-plane) and no ordering persists (because no columns)"
  severity: major
  test: 4
  root_cause: "Missing CSS layout rules for .kanban-board and .kanban-column. KanbanView.ts correctly creates DOM structure (board > columns > cards) and groups by status via d3.group(), but zero CSS rules define horizontal column layout. All column divs render as default block elements stacked vertically. Pre-existing gap from Phase 5, not a Phase 96 regression."
  artifacts:
    - path: "src/styles/views.css"
      issue: "Missing .kanban-board (needs display:flex, gap, overflow-x:auto) and .kanban-column (needs min-width, flex-shrink:0) CSS rules"
  missing:
    - "Add .kanban-board { display: flex; gap; overflow-x: auto } CSS"
    - "Add .kanban-column { min-width; flex-shrink: 0 } CSS"
  debug_session: ".planning/debug/kanban-flat-list-no-columns.md"
- truth: "Browse Files button opens file picker and Import File triggers file import"
  status: failed
  reason: "User reported: Neither Import File nor Browse Files... does anything"
  severity: major
  test: 5
  root_cause: "BridgeManager.swift does not handle the 'native:request-file-import' message type. The message hits the default case in didReceive() and is silently dropped. Swift already has a working file import flow (Notification.Name.importFile → showOpenPanel) used by toolbar button and Cmd+I, but the JS-initiated path was never wired. The 'Browse Files...' button tries fileInput.click() on a web <input type='file'> which may also fail in WKWebView."
  artifacts:
    - path: "native/Isometry/Isometry/BridgeManager.swift"
      issue: "Missing case 'native:request-file-import' in didReceive() switch — message silently dropped"
    - path: "src/main.ts"
      issue: "importFileHandler sends native:request-file-import (line 824) which is unhandled"
    - path: "src/ui/DataExplorerPanel.ts"
      issue: "JS-side wiring is correct but native bridge doesn't handle the message"
  missing:
    - "Add case 'native:request-file-import' to BridgeManager.didReceive() that posts Notification.Name.importFile"
    - "Route Browse Files button through importFileHandler instead of fileInput.click() in native mode"
  debug_session: ".planning/debug/dataexplorer-import-buttons.md"
- truth: "Drop zone highlights during drag and drops persist after release"
  status: failed
  reason: "User reported: Drop Zone highlighting works, drops do not persist"
  severity: minor
  test: 6
  root_cause: "Same root cause as test 1 — highlighting works because _pointerHitTestDropZones fires correctly during pointermove, but _handlePointerDrop fails to commit the reorder/transpose because the drop zone hit-test at pointerup time returns null (same-dimension) or misses (6px target for cross-dimension)."
  artifacts:
    - path: "src/views/SuperGrid.ts"
      issue: "_handlePointerDrop drop zone hit-test fails at pointerup — reorder/transpose silently discarded"
  missing:
    - "Fix _handlePointerDrop to use _lastReorderTargetIndex for same-dimension reorder without requiring drop zone hit"
  debug_session: ".planning/debug/supergrid-axis-grip-dnd-drop.md"
