# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## dataexplorer-import-buttons — DataExplorerPanel Import File and Browse Files buttons silently do nothing in WKWebView
- **Date:** 2026-03-21
- **Error patterns:** import button, file picker, browse files, WKWebView, native:request-file-import, silent failure, no error, DataExplorer, import file handler
- **Root cause:** BridgeManager.swift didReceive() switch had no case for "native:request-file-import" message type. JS in native mode (isNative=true) sends this message to open the file picker, but Swift silently dropped it with a default warning log. ContentView.onReceive(.importFile) and showOpenPanel() were fully implemented but never triggered.
- **Fix:** Added case "native:request-file-import" to BridgeManager.swift didReceive() that posts NotificationCenter.default.post(name: .importFile, object: nil), which triggers the existing native file picker flow in ContentView.
- **Files changed:** native/Isometry/Isometry/BridgeManager.swift, src/ui/DataExplorerPanel.ts
---

## kanban-flat-list-no-columns — KanbanView renders as flat list instead of columns
- **Date:** 2026-03-21
- **Error patterns:** kanban, flat list, no columns, column layout, kanban-board, kanban-column, display flex, stacked, block layout
- **Root cause:** Missing CSS layout rules for .kanban-board and .kanban-column. KanbanView.ts created the correct DOM structure (board > columns > cards) but no CSS defined horizontal flex layout, so columns stacked vertically as block-level divs — appearing as a flat list. Pre-existing gap from Phase 5, not a Phase 96 regression.
- **Fix:** Added CSS block in src/styles/views.css — .kanban-board gets display:flex + overflow-x:auto + height:100%, .kanban-column gets flex:1 0 220px + display:flex + flex-direction:column, with appropriate header/body rules.
- **Files changed:** src/styles/views.css
---

## supergrid-axis-grip-dnd-drop — SuperGrid axis grip DnD drop does not commit same-dimension reorder
- **Date:** 2026-03-21
- **Error patterns:** axis grip, DnD, drop, reorder, setPointerCapture, drop zone, 6px, pointer events, targetDimension, same-dimension, reorder axes, transpose, WKWebView
- **Root cause:** Two bugs in pointer DnD migration from HTML5. Bug 1 (critical): _handlePointerDrop required pointer to be geometrically over a 6px edge drop zone strip at pointerup time to set targetDimension — but same-dimension reorder happens inside the header area, never touching the 6px strip, so targetDimension stayed null and the function returned as a no-op despite _lastReorderTargetIndex being correctly calculated. Bug 2 (moderate): Drop zones with z-index:10 and pointer-events:auto occluded header grips during non-drag state.
- **Fix:** (1) Same-dimension fallback: when targetDimension is null but _lastReorderTargetIndex >= 0, set targetDimension = payload.sourceDimension. (2) Drop zones initialize with pointer-events:none. (3) On grip pointerdown, enlarge drop zones to 40px and enable pointer-events; restore on drop cleanup.
- **Files changed:** src/views/SuperGrid.ts
---

