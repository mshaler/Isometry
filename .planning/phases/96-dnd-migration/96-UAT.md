---
status: complete
phase: 96-dnd-migration
source: [96-01-SUMMARY.md, 96-02-SUMMARY.md, 96-03-SUMMARY.md]
started: 2026-03-19T14:00:00Z
updated: 2026-03-19T14:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

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
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Cross-dimension transpose works — dragging axis grip to opposite drop zone moves the axis"
  status: failed
  reason: "User reported: same issue, can't drag axes at all"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Drop zone highlights during drag and drops persist after release"
  status: failed
  reason: "User reported: Drop Zone highlighting works, drops do not persist"
  severity: minor
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Browse Files button opens file picker and Import File triggers file import"
  status: failed
  reason: "User reported: Neither Import File nor Browse Files... does anything"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Kanban renders columns based on axis assignment and cards can be dragged between columns"
  status: failed
  reason: "User reported: Kanban only behaves as a list (no columns, even when I try to drag a chip from available into either X- or Y-plane) and no ordering persists (because no columns)"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
- truth: "Column axes reorder correctly and stacked/nested headers can be moved"
  status: failed
  reason: "User reported: Same issue as rows. Can't move stacked/nested headers, and there are alignment issues as well."
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
