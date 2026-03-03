---
phase: 13-native-chrome-file-import
plan: 02
subsystem: ui
tags: [swiftui, fileImporter, NSOpenPanel, UTType, bridge, etl, native-action]

# Dependency graph
requires:
  - phase: 13-native-chrome-file-import
    plan: 01
    provides: NavigationSplitView shell with toolbar import button posting .importFile notification
  - phase: 12-bridge-persistence
    provides: BridgeManager with evaluateJavaScript pattern, WeakScriptMessageHandler, and checkpoint protocol

provides:
  - Native file picker on iOS (fileImporter) and macOS (NSOpenPanel) supporting .json, .txt/.md, .csv, .xlsx
  - 50MB size cap enforcement with user-facing alert dialog (FILE-04)
  - BridgeManager.sendFileImport() using JSONSerialization for safe JS string embedding
  - NativeBridge.ts native:action handler routing importFile to WorkerBridge.importFile()
  - Full end-to-end pipeline: native file picker -> size check -> byte reading -> bridge -> ETL

affects:
  - 13-03 (any remaining native chrome tasks)
  - 14-icloud-sync (file import may interact with sync triggers)

# Tech tracking
tech-stack:
  added: [UniformTypeIdentifiers]
  patterns:
    - "UTType extension for xlsx: UTType(filenameExtension:) ?? UTType(importedAs:) fallback pattern"
    - "JSONSerialization for safe JS payload embedding — avoids string interpolation breakage with quotes/newlines"
    - "#if os(macOS) import AppKit for NSOpenPanel; #if os(iOS) fileImporter modifier"
    - "Security-scoped resource access with guard/defer pattern for iOS sandboxed files"
    - "native:action message type with kind discriminator for extensible action routing"

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/ContentView.swift
    - native/Isometry/Isometry/BridgeManager.swift
    - src/native/NativeBridge.ts

key-decisions:
  - "JSONSerialization over string interpolation for sendFileImport payload — handles quotes, newlines, special chars in file content safely"
  - "native:action uses kind discriminator (importFile) for extensible action routing — future actions (share, export) add cases without new message types"
  - "Text formats sent as UTF-8 text, xlsx sent as base64 — matches ETL parser expectations (Pitfall 5 from RESEARCH.md)"
  - "50MB cap checked before reading file bytes — avoids OOM on large files"
  - "SourceType import added as top-level import type — cleaner than inline import() syntax"

patterns-established:
  - "native:action extensible action pattern: Swift sends {type:'native:action', payload:{kind:'importFile',...}}, JS routes on kind"
  - "File import pipeline: Swift handles picker + byte reading, JS handles parsing — zero new Swift parsing code"
  - "processImportedFile(url:, needsSecurityScope:) shared between iOS fileImporter and macOS NSOpenPanel"

requirements-completed: [FILE-01, FILE-02, FILE-03, FILE-04]

# Metrics
duration: 3min
completed: 2026-03-03
---

# Phase 13 Plan 02: File Import Pipeline Summary

**End-to-end file import wired: native file picker (iOS fileImporter + macOS NSOpenPanel) -> 50MB size check -> byte reading -> BridgeManager.sendFileImport via JSONSerialization -> NativeBridge native:action -> WorkerBridge.importFile -> ETL pipeline**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-03T19:35:14Z
- **Completed:** 2026-03-03T19:37:59Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Wired complete file import pipeline from native file picker to existing ETL parsers with zero new parsing code
- Added iOS fileImporter modifier supporting .json, .plainText, .commaSeparatedText, .xlsx file types
- Added macOS NSOpenPanel with same allowed content types, triggered via NotificationCenter
- Implemented 50MB size cap enforcement with user-visible "File Too Large" alert
- Added BridgeManager.sendFileImport() using JSONSerialization for safe JavaScript payload embedding
- Added NativeBridge.ts native:action handler with importFile kind routing to WorkerBridge.importFile()
- Security-scoped resource access with guard/defer cleanup for iOS sandboxed file access

## Task Commits

Each task was committed atomically:

1. **Task 1: Add file import pipeline to ContentView and BridgeManager (Swift side)** - `88d58e7d` (feat)
2. **Task 2: Add native:action handler to NativeBridge.ts for file import routing** - `82ca7a7b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `native/Isometry/Isometry/ContentView.swift` - Added UTType.xlsx extension, fileImporter (iOS), NSOpenPanel (macOS), size check, file processing, etlSource mapping
- `native/Isometry/Isometry/BridgeManager.swift` - Added sendFileImport() method using JSONSerialization for native:action bridge message
- `src/native/NativeBridge.ts` - Added native:action case to receive handler, handleNativeFileImport() async function, SourceType import

## Decisions Made
- JSONSerialization chosen over string interpolation for sendFileImport — file content can contain quotes, newlines, and special characters that would break a JS template literal
- native:action message type uses a `kind` field discriminator — extensible for future native actions (share, export) without adding new message types
- Text formats (json, csv, markdown) sent as UTF-8 text strings; xlsx sent as base64 — matches ETL parser expectations
- SourceType added as top-level `import type` rather than inline `import()` — cleaner and the project already imports from etl/types elsewhere
- 50MB cap enforced before reading bytes into memory — prevents OOM on large files

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in ETL test files (SQLiteWriter.test.ts, etl-progress.test.ts) — unrelated to NativeBridge changes, out of scope
- Pre-existing build warnings (AppIcon asset catalog, IsometryApp onChange deprecation, evaluateJavaScript try?) — all out of scope

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- File import pipeline is complete end-to-end: import button -> file picker -> bridge -> ETL -> ImportToast
- The mutation hook (already installed by initNativeBridge) automatically posts 'mutated' after etl:import, triggering autosave
- Plan 13-03 can proceed with any remaining native chrome tasks (app icon, launch screen, etc.)
- Known limitation: xlsx files near 50MB may exceed evaluateJavaScript payload limits (~67MB base64) — chunked posting is the documented fallback

## Self-Check: PASSED

All files and commits verified:
- FOUND: `native/Isometry/Isometry/ContentView.swift` (contains fileImporter, showOpenPanel)
- FOUND: `native/Isometry/Isometry/BridgeManager.swift` (contains sendFileImport)
- FOUND: `src/native/NativeBridge.ts` (contains native:action, handleNativeFileImport)
- FOUND: `.planning/phases/13-native-chrome-file-import/13-02-SUMMARY.md`
- FOUND: commit `88d58e7d` (Task 1)
- FOUND: commit `82ca7a7b` (Task 2)

---
*Phase: 13-native-chrome-file-import*
*Completed: 2026-03-03*
