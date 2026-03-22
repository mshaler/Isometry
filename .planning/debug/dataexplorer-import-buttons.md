---
status: diagnosed
trigger: "DataExplorerPanel Import File and Browse Files buttons not working"
created: 2026-03-19T15:00:00Z
updated: 2026-03-19T15:05:00Z
---

## Current Focus

hypothesis: Both buttons work at the code level but fail in WKWebView due to user activation chain issues
test: Trace the call chain for both buttons
expecting: Import File button calls importFileHandler which creates ephemeral file input; Browse Files calls fileInput.click() on hidden input — both require user activation
next_action: Return diagnosis

## Symptoms

expected: "Import File" and "Browse Files..." buttons open file pickers and trigger import
actual: Neither button does anything when clicked
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
  implication: In WKWebView, programmatic fileInput.click() requires user activation. The click handler IS a user activation context, so this should work in theory. But WKWebView has historically been stricter about this.

- timestamp: 2026-03-19T15:04:00Z
  checked: Whether isNative affects behavior
  found: importFileHandler (the "Import File" callback) checks isNative and routes to Swift native:request-file-import. The "Browse Files..." button ignores isNative and always tries fileInput.click() on the web-side hidden input.
  implication: If running in native WKWebView shell, "Import File" sends a message to Swift — the issue would be on the Swift side not handling it. "Browse Files..." tries web file input which may or may not work in WKWebView.

- timestamp: 2026-03-19T15:05:00Z
  checked: ViewManager welcome panel import wiring (lines 658-663, 894)
  found: ViewManager.onImportFile is wired directly to importFileHandler (line 894) with explicit comment about preserving user activation chain. The welcome panel "Import File" button works because it calls the handler DIRECTLY.
  implication: The DataExplorerPanel also calls importFileHandler directly via config callback — same pattern. The issue is likely that in native mode, the Swift side native:request-file-import handler is broken or missing, OR the user is in native mode and Browse Files tries web-side file input which WKWebView blocks.

## Resolution

root_cause: |
  CONFIRMED: Two separate but related failures, both rooted in missing Swift-side handling.

  1. "Import File" button: Calls importFileHandler (main.ts:824) which, in native mode (isNative=true, detected via app:// protocol), sends message type "native:request-file-import" to Swift via window.webkit.messageHandlers.nativeBridge.postMessage(). BridgeManager.swift's didReceive() switch statement (line 119) has NO case for "native:request-file-import" — it falls through to the default case which just logs a warning: "Unknown bridge message type: native:request-file-import". The message is silently dropped. Swift DOES have a working file import flow via Notification.Name.importFile -> ContentView.onReceive -> showOpenPanel() (macOS) / .fileImporter (iOS), but BridgeManager never posts that notification because it never handles the message type.

  2. "Browse Files..." button: Calls fileInput.click() on a hidden <input type="file"> element. In WKWebView, programmatic clicks on file inputs from user gesture handlers should work, but WKWebView has historically been stricter about this. Even if the file picker DID open, the selected file would route through onFileDrop which calls bridge.importFile() — a web-side import path. In native mode, this may also fail because the web-side import assumes direct file access.

  The primary root cause is: BridgeManager.swift does not handle "native:request-file-import" message type. The fix is to add a case in BridgeManager.didReceive() that posts Notification.Name.importFile, which triggers the existing native file picker flow (showOpenPanel on macOS, .fileImporter on iOS).
fix: ""
verification: ""
files_changed: []
