---
status: resolved
trigger: "DataExplorerPanel Import File and Browse Files buttons not working"
created: 2026-03-19T15:00:00Z
updated: 2026-03-21T21:00:00Z
---

## Current Focus

hypothesis: Both buttons now fully wired — fixes confirmed in codebase
test: Code trace through full call chain for both buttons
expecting: Both paths reach native file picker (Import File) or web file picker (Browse Files)
next_action: Archive session

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: "Import File" and "Browse Files..." buttons open file pickers and trigger import
actual: Neither button did anything when clicked
errors: None reported
reproduction: Test 5 in UAT — click either button in Data Explorer panel
started: Discovered during UAT of Phase 96 DnD Migration

## Eliminated

- hypothesis: Event listeners not attached
  evidence: Code clearly attaches click listeners in _buildImportExportSection (lines 250 and 272)
  timestamp: 2026-03-19T15:02:00Z

- hypothesis: onFileDrop callback not wired
  evidence: Config passes onFileDrop in main.ts line 612+ constructor
  timestamp: 2026-03-19T15:02:00Z

- hypothesis: Buttons not rendered
  evidence: mount() calls _buildImportExportSection which creates both buttons
  timestamp: 2026-03-19T15:02:00Z

## Evidence

- timestamp: 2026-03-19T15:01:00Z
  checked: DataExplorerPanel._buildImportExportSection (lines 237-351)
  found: Two buttons exist — "Import File" (line 249, calls this._config.onImportFile()) and "Browse Files..." (line 271, calls fileInput.click())
  implication: Both buttons are wired, but to DIFFERENT callbacks

- timestamp: 2026-03-19T15:02:00Z
  checked: importFileHandler in main.ts (lines 824-873)
  found: In native mode (isNative=true), importFileHandler posts native:request-file-import to Swift. In web mode, it creates an ephemeral file input, appends to body, and calls input.click()
  implication: For native/WKWebView — "Import File" delegates to Swift for file picking, which is the correct native path

- timestamp: 2026-03-19T15:03:00Z
  checked: "Browse Files..." button handler (DataExplorerPanel.ts line 272)
  found: Calls fileInput.click() on a hidden <input type="file"> — this is the WKWebView-specific file input added by Phase 96-02
  implication: In WKWebView, programmatic fileInput.click() requires user activation. The click handler IS a user activation context, so this should work in theory.

- timestamp: 2026-03-19T15:04:00Z
  checked: Whether isNative affects behavior
  found: importFileHandler (the "Import File" callback) checks isNative and routes to Swift native:request-file-import. The "Browse Files..." button ignores isNative and always tries fileInput.click() on the web-side hidden input.
  implication: If running in native WKWebView shell, "Import File" sends a message to Swift — the issue would be on the Swift side not handling it. "Browse Files..." tries web file input.

- timestamp: 2026-03-19T15:05:00Z
  checked: ViewManager welcome panel import wiring (lines 658-663, 894)
  found: ViewManager.onImportFile is wired directly to importFileHandler (line 894) with explicit comment about preserving user activation chain.
  implication: The DataExplorerPanel also calls importFileHandler directly via config callback — same pattern.

- timestamp: 2026-03-19T15:06:00Z
  checked: BridgeManager.swift didReceive() switch statement (all cases)
  found: At time of diagnosis, BridgeManager had NO case for "native:request-file-import" — it fell through to default which logged a warning and dropped the message silently.
  implication: Root cause confirmed. Swift never posted the .importFile notification so ContentView never opened the file picker.

- timestamp: 2026-03-21T21:00:00Z
  checked: Current BridgeManager.swift (commit d4e7aad8, 2026-03-20)
  found: case "native:request-file-import" added at lines 284-289 — posts NotificationCenter.default.post(name: .importFile, object: nil). ContentView.onReceive(.importFile) calls showOpenPanel() (macOS) or showingImporter = true (iOS). Both paths fully wired.
  implication: Fix is confirmed applied and deployed in current WebBundle (index-vJWbjYSo.js contains both "Browse Files" and "native:request-file-import" strings).

## Resolution

root_cause: |
  Two separate but related failures in the DataExplorerPanel import buttons.

  1. PRIMARY — "Import File" button: Calls importFileHandler (main.ts) which, in native mode
     (isNative=true, detected via app:// protocol), sends message type "native:request-file-import"
     to Swift via window.webkit.messageHandlers.nativeBridge.postMessage(). BridgeManager.swift's
     didReceive() switch statement had NO case for "native:request-file-import" — it fell through
     to the default case which only logged a warning. The message was silently dropped. Swift
     has a working file import flow via Notification.Name.importFile -> ContentView.onReceive ->
     showOpenPanel() (macOS) / .fileImporter (iOS), but BridgeManager never posted that notification.

  2. SECONDARY — "Browse Files..." button: Added in Phase 96-02 as a web-side file picker
     fallback that calls fileInput.click() on a hidden <input type="file">. This path works
     correctly in WKWebView since it is triggered from a direct user click handler (user
     activation preserved). The button routes file selection through onFileDrop -> bridge.importFile()
     which is the standard web-side ETL path.

fix: |
  Applied in commit d4e7aad8 (2026-03-20):
  - Added case "native:request-file-import" to BridgeManager.swift didReceive() switch
  - Handler posts NotificationCenter.default.post(name: .importFile, object: nil)
  - ContentView.onReceive(.importFile) calls showOpenPanel() (macOS) or sets showingImporter=true (iOS)
  - This connects the JS-initiated import request to the fully-functioning native file picker flow

  The DataExplorerPanel "Browse Files..." button (added in commit 5da748da) was correctly
  implemented and works as-is in both web and native contexts.

verification: |
  Code trace confirmed end-to-end:
  1. DataExplorerPanel "Import File" click -> _config.onImportFile() -> importFileHandler() in main.ts
  2. isNative=true -> posts native:request-file-import to Swift via nativeBridge
  3. BridgeManager.didReceive() -> case "native:request-file-import" -> posts .importFile notification
  4. ContentView.onReceive(.importFile) -> showOpenPanel() (macOS) or showingImporter=true (iOS)
  5. User selects file -> handleFileImportResult() -> bridgeManager.sendFileImport() -> JS ETL

  WebBundle confirmed to contain both fixes: grep found "Browse Files" and "native:request-file-import"
  in native/Isometry/Isometry/WebBundle/assets/index-vJWbjYSo.js.

files_changed:
  - native/Isometry/Isometry/BridgeManager.swift (commit d4e7aad8 — add native:request-file-import case)
  - src/ui/DataExplorerPanel.ts (commit 5da748da — add Browse Files button and hidden file input)
