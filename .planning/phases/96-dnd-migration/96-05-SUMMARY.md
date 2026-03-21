---
phase: 96-dnd-migration
plan: "05"
subsystem: views-css, native-bridge
tags: [kanban, css-layout, bridge, file-import, gap-closure]
dependency_graph:
  requires: []
  provides: [kanban-board-horizontal-layout, native-file-import-bridge]
  affects: [src/styles/views.css, native/Isometry/Isometry/BridgeManager.swift]
tech_stack:
  added: []
  patterns: [css-flex-layout, notification-center-bridge, design-token-fallbacks]
key_files:
  created: []
  modified:
    - src/styles/views.css
    - native/Isometry/Isometry/BridgeManager.swift
decisions:
  - "Gap closure plan: CSS rules for .kanban-board and .kanban-column were never added in Phase 5 — added now with design token fallbacks"
  - "native:request-file-import is not a new bridge message type — it was designed as part of Phase 96 but Swift handler was missing; added as bug fix"
metrics:
  duration_seconds: 100
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 2
requirements: [DND-03, DND-04]
---

# Phase 96 Plan 05: Kanban Layout CSS + Native File Import Bridge Summary

**One-liner:** Kanban horizontal flex layout CSS added to views.css; BridgeManager.swift now handles native:request-file-import by posting .importFile notification to open native file picker.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Kanban board and column CSS layout rules | 37e9d20b | src/styles/views.css |
| 2 | Add native:request-file-import handler to BridgeManager.swift | d4e7aad8 | native/Isometry/Isometry/BridgeManager.swift |

## What Was Built

### Task 1: Kanban Column Layout CSS
Added five new CSS rule blocks to `src/styles/views.css` placed after the existing Phase 96 ghost card styles:

- `.kanban-board` — `display: flex`, `overflow-x: auto`, `height: 100%`, `align-items: flex-start` for horizontal column scroll
- `.kanban-column` — `min-width: 220px`, `max-width: 320px`, `flex: 1 0 220px`, `background: var(--surface-secondary)` for per-column layout
- `.kanban-column-header` — `justify-content: space-between` flex row for title + count badge
- `.kanban-column-count` — reduced opacity badge styling
- `.kanban-column-body` — `flex: 1`, `overflow-y: auto`, flex column with gap for card stacking

All properties use `var(--token, hardcoded-fallback)` pattern so layout works even if design-tokens.css fails to load.

### Task 2: Bridge Handler for native:request-file-import
Added one new `case "native:request-file-import":` branch to the `switch type` block in `BridgeManager.didReceive()`:

```swift
case "native:request-file-import":
    logger.info("native:request-file-import — opening native file picker")
    NotificationCenter.default.post(name: .importFile, object: nil)
```

This wires the JS-initiated import request (from `DataExplorerPanel`'s "Import File" button via `importFileHandler` in `main.ts`) to the existing `ContentView.onReceive(.importFile)` handler at line 270, which calls `showOpenPanel()` (macOS) or `.fileImporter` (iOS).

## Verification

- `grep -c 'kanban-board\|kanban-column' src/styles/views.css` → 6 (selector + sub-selectors)
- `.kanban-board { display: flex }` present at line 368-376
- `grep -c 'native:request-file-import' native/Isometry/Isometry/BridgeManager.swift` → 2 (case label + comment)
- `NotificationCenter.default.post(name: .importFile, object: nil)` wires to ContentView handler
- `.importFile` notification name confirmed at ContentView.swift line 18

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/styles/views.css` exists and contains `.kanban-board { display: flex }`
- `native/Isometry/Isometry/BridgeManager.swift` exists and contains `native:request-file-import` handler
- Commits `37e9d20b` and `d4e7aad8` exist in git log
