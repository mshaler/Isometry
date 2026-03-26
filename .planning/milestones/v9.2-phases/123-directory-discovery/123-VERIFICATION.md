---
phase: 123-directory-discovery
verified: 2026-03-25T00:00:00Z
status: human_needed
score: 6/6 must-haves verified
human_verification:
  - test: "Run the Xcode macOS build and verify the end-to-end flow"
    expected: "Choose Alto-Index Folder button appears in Data Explorer Import/Export section, clicking it opens NSOpenPanel, selecting a directory opens the DirectoryDiscoverySheet modal with title, subtitle, subdirectory list, checkboxes, and type badges; empty state shown for unknown directories; Escape and Keep Folder dismiss cleanly; Import Selected disables when all checkboxes unchecked"
    why_human: "Visual rendering, NSOpenPanel invocation, and the full interactive flow require a running macOS build. The 123-02-SUMMARY.md documents human Task 3 (checkpoint:human-verify gate) as approved — this records that attestation in the verification artifact."
---

# Phase 123: Directory Discovery Verification Report

**Phase Goal:** User can pick an alto-index root directory and see a labeled list of all discovered subdirectories before committing to any import
**Verified:** 2026-03-25
**Status:** human_needed — all automated checks pass; end-to-end flow requires human attestation
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can open a native file picker (NSOpenPanel on macOS, fileImporter on iOS) and select an alto-index root directory | VERIFIED | `ContentView.swift:389` NSOpenPanel with `canChooseDirectories=true`; `ContentView.swift:401` `.fileImporter` for `.folder`; `showingAltoDirectoryPicker` state var at line 100; `alto_index` case in `runNativeImport` sets picker state at line 440 |
| 2 | After selecting a directory, the app enumerates all 11 known subdirectory types with type labels | VERIFIED | `AltoIndexAdapter.swift:34-46` defines all 11 subdirectory entries; `discoverSubdirectories(in:)` at line 77 iterates them via `FileManager.fileExists(atPath:isDirectory:)`; results sent via `sendAltoDiscoveryResult` at line 594 carrying `(name, cardType, path)` tuples |
| 3 | Unrecognized subdirectories are ignored; only known types appear in the preview list | VERIFIED | Swift-side filtering: `discoverSubdirectories` only checks the 11 static entries; no unknown dirs can reach JS. JS `DirectoryDiscoverySheet` renders whatever Swift sends, which is already filtered |
| 4 | The preview list is visible before any import begins — user can review and cancel | VERIFIED | `DirectoryDiscoverySheet.open()` is a `Promise<DiscoveredSubdirectory[] \| null>`; "Keep Folder" and Escape call `_finish(null)` without importing; `main.ts:764-775` only logs on `selected.length > 0` (Phase 124 import deferred per plan scope) |

**Score:** 6/6 must-haves verified (4 truths + all artifacts + all key links)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/AltoIndexAdapter.swift` | `discoverSubdirectories` static method | VERIFIED | Line 77: `static func discoverSubdirectories(in rootURL: URL) -> [(name: String, cardType: String, path: String)]`; iterates all 11 subdirectory entries with `FileManager.fileExists` + `isDir.boolValue` guard |
| `native/Isometry/Isometry/BridgeManager.swift` | `sendAltoDiscoveryResult` bridge message | VERIFIED | Line 594: method exists, line 608: sends `native:alto-discovery` JS eval string, line 290: handles incoming `native:request-alto-discovery` |
| `native/Isometry/Isometry/ContentView.swift` | NSOpenPanel picker + `showingAltoDirectoryPicker` state | VERIFIED | Line 100: `@State private var showingAltoDirectoryPicker = false`; line 22: `pickAltoDirectory` Notification.Name; line 389-396: NSOpenPanel block; line 401-408: `.fileImporter`; line 489: `discoverAltoIndex(at:)` |
| `src/ui/DirectoryDiscoverySheet.ts` | DirectoryDiscoverySheet class with open/close lifecycle | VERIFIED | Exports `DirectoryDiscoverySheet`, `AltoDiscoveryPayload`, `DiscoveredSubdirectory`; `dialog.showModal()` at line 239; "Keep Folder", "Import Selected", "No Sources Found" text all present |
| `src/styles/directory-discovery.css` | All `.disc-*` CSS classes from UI-SPEC | VERIFIED | `.disc-sheet` (max-width: 480px), `.disc-row`, `.disc-row__badge`, `.disc-sheet__empty` all present; all 11 `data-type` badge color rules (notes through voice-memos) present; uses `var(--)` tokens only |
| `src/ui/DataExplorerPanel.ts` | "Choose Alto-Index Folder" CTA button | VERIFIED | Line 29: `onPickAltoDirectory: () => void` in config interface; line 291: `textContent = 'Choose Alto-Index Folder'`; line 287: gated on `window.webkit?.messageHandlers?.nativeBridge`; line 127: `getAltoCTABtn()` getter |
| `src/native/NativeBridge.ts` | Handler for `native:alto-discovery` bridge message | VERIFIED | Line 267: `case 'native:alto-discovery'`; line 275: dispatches `new CustomEvent('alto-discovery', { detail: payload })` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ContentView.swift` | `AltoIndexAdapter.swift` | `AltoIndexAdapter.discoverSubdirectories(in:)` | WIRED | `ContentView.swift:493` calls `AltoIndexAdapter.discoverSubdirectories(in: url)` inside `discoverAltoIndex(at:)` |
| `ContentView.swift` | `BridgeManager.swift` | `bridgeManager.sendAltoDiscoveryResult` | WIRED | `ContentView.swift:495-499` calls `bridgeManager.sendAltoDiscoveryResult(rootPath:rootName:subdirectories:)` inside `Task { @MainActor in }` block |
| `src/native/NativeBridge.ts` | `src/ui/DirectoryDiscoverySheet.ts` | bridge message handler calls `discoverySheet.open()` | WIRED | NativeBridge dispatches `CustomEvent('alto-discovery')`; `main.ts:761-775` listens and calls `discoverySheet.open(payload, ctaBtn)` |
| `src/ui/DataExplorerPanel.ts` | `src/native/NativeBridge.ts` | CTA button posts `native:request-alto-discovery` | WIRED | DataExplorer CTA fires `onPickAltoDirectory()`; `main.ts:689-697` posts `{type: 'native:request-alto-discovery'}` to `window.webkit.messageHandlers.nativeBridge` |
| `src/ui/DirectoryDiscoverySheet.ts` | `src/styles/directory-discovery.css` | CSS import | WIRED | `DirectoryDiscoverySheet.ts:8` `import '../styles/directory-discovery.css'` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DISC-01 | 123-01, 123-02 | User can pick alto-index root directory via native file picker | SATISFIED | NSOpenPanel (macOS) + `.fileImporter` (iOS) wired in ContentView; CTA button in DataExplorerPanel posts `native:request-alto-discovery` |
| DISC-02 | 123-01 | System auto-discovers 11 known subdirectory types | SATISFIED | `AltoIndexAdapter.discoverSubdirectories` enumerates all 11 types; bridge sends results; verified all 11 entries in `subdirectories` static array |
| DISC-03 | 123-02 | User sees list of discovered subdirectories with type labels before importing | SATISFIED | `DirectoryDiscoverySheet` renders modal with checkboxes and colored type badges per `data-type`; "Keep Folder"/Escape dismiss without import; Phase 124 deferred per plan scope |

No orphaned requirements — DISC-01, DISC-02, DISC-03 are the only requirements mapped to Phase 123 in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/main.ts` | 766-773 | `console.log` stub for import action | Info | Intentional per plan scope — Phase 123 delivers discovery and preview; Phase 124 replaces this with actual import dispatch. Not a blocker. |

No other stubs, TODOs, or placeholder patterns found across the 7 modified/created files.

### Commit Verification

All 4 documented commits confirmed in git history:

| Commit | Description |
|--------|-------------|
| `1a798392` | feat(123-01): add discoverSubdirectories to AltoIndexAdapter |
| `f8f59ff4` | feat(123-01): add sendAltoDiscoveryResult bridge + native directory picker (DISC-01, DISC-02) |
| `be4bfa9a` | feat(123-02): create DirectoryDiscoverySheet component and CSS |
| `0583ffb3` | feat(123-02): wire CTA button and native:alto-discovery bridge handler |

### Human Verification Required

#### 1. End-to-End Directory Discovery Flow

**Test:** Build and run the Xcode macOS target. Open Data Explorer sidebar. Expand Import/Export section. Click "Choose Alto-Index Folder". Select a directory containing known subdirectory names (e.g., a real alto-index root, or a test directory with `notes/`, `contacts/`, `calendar/` subdirs).

**Expected:**
- NSOpenPanel directory picker opens with title "Choose Alto-Index Folder"
- After selection, DirectoryDiscoverySheet modal appears with:
  - Title: "Import Alto-Index Directory"
  - Subtitle: "{N} sources found in {folder-name}"
  - Scrollable list of discovered subdirectories with pre-checked checkboxes
  - Each row has a colored type badge matching the source provenance token for that directory name
- Unchecking all checkboxes disables "Import Selected" button
- Clicking "Keep Folder" or pressing Escape dismisses the modal cleanly with no import triggered
- Selecting a directory with no known subdirectories shows "No Sources Found" empty state

**Note:** 123-02-SUMMARY.md documents that Task 3 (checkpoint:human-verify gate) was completed and all 10 verification steps passed in the Xcode macOS build on 2026-03-26.

**Why human:** Visual rendering, NSOpenPanel invocation, focus management, and empty state require a running macOS Xcode build. Cannot be verified programmatically.

### Gaps Summary

None. All automated checks pass. The `console.log` stub in `main.ts` is intentional — Phase 123 scope is discovery and preview only; Phase 124 delivers the actual import dispatch. The phase goal is fully achieved: the user can pick an alto-index root directory, sees the labeled subdirectory list before committing to any import, and can review and cancel.

---

_Verified: 2026-03-25_
_Verifier: Claude (gsd-verifier)_
