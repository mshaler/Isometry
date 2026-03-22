---
status: diagnosed
trigger: "SuperGrid axis grip DnD not working in WKWebView - axes do not reorder after drop"
created: 2026-03-19T15:00:00Z
updated: 2026-03-19T15:30:00Z
---

## Current Focus

hypothesis: Two independent bugs prevent axis grip DnD from working: (1) setPointerCapture causes pointermove/pointerup to fire on the grip even when pointer is outside drop zones, but drop zones are only 6px strips so hit-test always fails for same-dimension reorder; (2) _calcReorderTargetIndex can return headerCells.length-1 which may equal axes.length-1, but guard rejects targetIndex >= axes.length — this is actually fine. The REAL issue is that same-dimension reorder requires the pointer to be over a drop zone at pointerup, but the drop zones are 6px edge strips designed for CROSS-dimension transpose only.
test: confirmed via code reading
expecting: n/a
next_action: return diagnosis

## Symptoms

expected: Dragging a row/column axis header grip reorders axes. Ghost chip follows cursor. Insertion line appears. On drop, axes reorder.
actual: Drop zone highlighting works but drops do not persist. Can't drag axes at all. Axes do not reorder to new position.
errors: None reported
reproduction: Tests 1, 2, 3, 6 in UAT
started: Discovered during UAT of Phase 96 DnD Migration

## Eliminated

- hypothesis: "_pointerHitTestDropZones queries wrong parent element"
  evidence: "Code correctly queries _rootEl (not _gridEl) — was already fixed during Phase 96-01 auto-fix #1"
  timestamp: 2026-03-19T15:10:00Z

- hypothesis: "reorderRowAxes/reorderColAxes not called"
  evidence: "They ARE called at lines 4904/4906 — but execution never reaches them because the drop zone hit-test fails"
  timestamp: 2026-03-19T15:15:00Z

## Evidence

- timestamp: 2026-03-19T15:05:00Z
  checked: Drop zone creation (lines 644-671)
  found: Col drop zone is 6px tall strip at top edge. Row drop zone is 6px wide strip at left edge. Both use position:absolute with z-index:10.
  implication: These are EDGE strips for cross-dimension transpose, not full-area zones for same-dimension reorder.

- timestamp: 2026-03-19T15:08:00Z
  checked: _handlePointerDrop hit-test logic (lines 4836-4868)
  found: targetDimension is determined SOLELY by which drop zone the pointer is over at pointerup time. If pointer is not over ANY drop zone, targetDimension stays null and the function returns at line 4871 (no-op).
  implication: For same-dimension reorder (e.g., reordering row axes), the user drags within the row header area — but the row drop zone is a 6px strip on the LEFT EDGE. The pointer is almost never over it during a same-dimension drag.

- timestamp: 2026-03-19T15:10:00Z
  checked: setPointerCapture usage (lines 4263, 4491)
  found: setPointerCapture is called on pointerdown. This means ALL pointermove and pointerup events fire on the grip element regardless of pointer position. This is correct for ghost movement but means the pointerup handler always fires on grip, never on a drop zone.
  implication: The hit-test in _handlePointerDrop using getBoundingClientRect is the ONLY way to detect drops. This works but only if the pointer is physically over a 6px drop zone strip.

- timestamp: 2026-03-19T15:12:00Z
  checked: Same-dimension reorder path (lines 4879-4911)
  found: The same-dimension reorder uses _lastReorderTargetIndex (set during pointermove midpoint calculations at lines 4299/4527). This index IS correctly calculated. But the code NEVER REACHES this path because targetDimension is null when pointer is not over a 6px drop zone.
  implication: The insertion line shows correctly during drag (pointermove works), but the drop never commits because pointerup can't find a targetDimension.

- timestamp: 2026-03-19T15:15:00Z
  checked: Original HTML5 DnD flow vs new pointer flow
  found: In the OLD HTML5 DnD flow, drop zones had dragover/drop listeners that set targetDimension directly. The drop zone just needed to EXIST as a valid drop target. In the NEW pointer flow, the drop zone must be PHYSICALLY HIT by getBoundingClientRect — a fundamentally different interaction model.
  implication: The migration preserved the business logic but broke the interaction model. HTML5 DnD used event-based targeting (dragleave/dragover fire on the element being dragged over); pointer events use geometric hit-testing which fails when drop zones are tiny edge strips.

- timestamp: 2026-03-19T15:20:00Z
  checked: Why test 6 partially passes ("Drop Zone highlighting works")
  found: _pointerHitTestDropZones is called during pointermove (lines 4292/4520) and correctly adds drag-over class when pointer passes over a 6px drop zone. This can happen transiently during drag movement. But at pointerup time, the pointer is unlikely to be exactly over the 6px strip.
  implication: The highlighting is transient/accidental (pointer passes over the strip briefly), confirming the drop zone geometry is the root problem.

## Resolution

root_cause: |
  The pointer DnD migration has a fundamental interaction model mismatch. There are TWO bugs:

  **Bug 1 (Critical): Same-dimension reorder cannot reach its code path.**
  _handlePointerDrop (line 4812) requires `targetDimension` to be non-null, which requires the pointer to be geometrically inside a drop zone at pointerup time. But the drop zones are 6px edge strips (col=top edge, row=left edge) designed for CROSS-dimension transpose. During a same-dimension reorder (e.g., dragging one row axis to another row position), the user's pointer is in the row header area — nowhere near the 6px left-edge strip. So targetDimension is always null, and the function returns at line 4871 as a no-op. The _lastReorderTargetIndex is correctly calculated during pointermove, but never consumed.

  **Bug 2 (Moderate): Cross-dimension transpose drop zones are too small to reliably hit.**
  Even for cross-dimension transpose, the user must release the pointer while it's within a 6px strip. This is extremely difficult without visual affordance showing where the strip is. The highlighting works transiently during pointermove but is unreliable at the moment of pointerup.

  The old HTML5 DnD model didn't have this problem because dragover/drop events were TARGET-based (the browser handled hit-testing and delivered events to the element being dragged over). The pointer event model relies on GEOMETRIC hit-testing at a single point in time (pointerup), which fails with tiny drop zones.

fix: ""
verification: ""
files_changed: []
