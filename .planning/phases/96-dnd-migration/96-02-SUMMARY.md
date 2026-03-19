---
phase: 96-dnd-migration
plan: 02
subsystem: views/ui
tags: [dnd, pointer-events, kanban, wkwebview, file-import]
dependency_graph:
  requires: [96-01]
  provides: [DND-03, DND-04, DND-05]
  affects: [KanbanView, DataExplorerPanel]
tech_stack:
  added: []
  patterns:
    - pointer-event DnD with ghost card and getBoundingClientRect hit-testing
    - hidden file input as WKWebView-compatible file import fallback
key_files:
  created: []
  modified:
    - src/views/KanbanView.ts
    - src/styles/views.css
    - src/ui/DataExplorerPanel.ts
decisions:
  - KanbanView HTML5 DnD fully replaced with pointer events (no hybrid) — pointerup hit-tests column bodies directly so no column-level listeners needed
  - DataExplorerPanel keeps existing HTML5 drop zone unchanged (desktop browser) and adds Browse Files button as additive WKWebView fallback
  - Ghost card appended to document.body with fixed positioning and pointer-events:none (same pattern as ProjectionExplorer chips)
  - Module-level drag state (_kanbanGhostEl/_kanbanDragCardId/_kanbanDragSourceEl) matches ProjectionExplorer pattern
metrics:
  duration_minutes: 15
  completed_date: "2026-03-19"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 96 Plan 02: KanbanView Pointer Events + DataExplorerPanel File Browse Summary

**One-liner:** Replaced KanbanView HTML5 DnD with pointer-event ghost-card drag (WKWebView-compatible) and added Browse Files... click-to-browse button to DataExplorerPanel.

## Tasks Completed

| Task | Description | Commit | Files |
| ---- | ----------- | ------ | ----- |
| 1 | Migrate KanbanView card drag to pointer events | 0c6e39ab | KanbanView.ts, views.css |
| 2 | Add click-to-browse file input to DataExplorerPanel | 5da748da | DataExplorerPanel.ts |

## What Was Built

### Task 1 — KanbanView Pointer Events

- Replaced `setupCardDragListeners` (HTML5 DnD) with pointer event listeners: `pointerdown`, `pointermove`, `pointerup`, `pointercancel`
- Removed `setupColumnDropListeners` entirely — `pointerup` now hit-tests column bodies directly using `getBoundingClientRect()`
- Ghost card: cloneNode of dragged card appended to `document.body` with `.kanban-card--ghost` CSS class (fixed, pointer-events:none, z-index 9999, opacity 0.8, scale 1.05)
- Source card dimmed with existing `.dragging` class during drag
- Column bodies highlighted with existing `.drag-over` class on `pointermove` hit-test
- `pointercancel` handler for system interruption cleanup
- Module-level drag state: `_kanbanGhostEl`, `_kanbanDragCardId`, `_kanbanDragSourceEl`
- Removed `draggable="true"` attribute — pointer events do not need it
- `data-drag-setup` guard preserved to prevent duplicate listeners on D3 re-renders

### Task 2 — DataExplorerPanel Browse Files Button

- Added hidden `<input type="file">` with accept list: `.csv,.json,.md,.txt,.yaml,.yml,.xlsx,.xls`
- Added visible "Browse Files..." button with `dexp-import-btn` class that triggers `fileInput.click()`
- `fileInput.value = ''` reset after selection allows re-selecting the same file
- Both paths route to `this._config.onFileDrop(file)` — no new callback required
- Existing HTML5 drag-drop zone (dragenter/dragover/dragleave/drop) preserved unchanged
- Drop zone hint text updated: "Drop a file here to import" → "Drop files here to import"

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- TypeScript compiles with zero errors in modified files (KanbanView.ts, DataExplorerPanel.ts)
- Pre-existing failures in CommandBar.test.ts, NotebookExplorer.test.ts, ProjectionExplorer.test.ts, source-view-matrix.test.ts, dataset-eviction.test.ts are unrelated to this plan
- KanbanView has zero HTML5 DnD references in code (dragstart/dragover/dataTransfer appear only in comments)
- Ghost card CSS `.kanban-card--ghost` present in views.css
- DataExplorerPanel has both drop zone (HTML5) and file input button

## Self-Check: PASSED

- src/views/KanbanView.ts: modified (pointer events)
- src/styles/views.css: modified (.kanban-card--ghost added)
- src/ui/DataExplorerPanel.ts: modified (Browse Files button)
- Commit 0c6e39ab: FOUND
- Commit 5da748da: FOUND
