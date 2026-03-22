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

