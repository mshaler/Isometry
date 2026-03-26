---
phase: 124-selective-import-partitioning
plan: "01"
subsystem: native-swift
tags: [swift, alto-index, import, binary-exclusion, bridge]
dependency_graph:
  requires: [123-02]
  provides: [IMPT-02, IMPT-03, IMPT-04, BEXL-01, BEXL-02]
  affects: [AltoIndexAdapter, NativeImportCoordinator, BridgeManager]
tech_stack:
  added: []
  patterns:
    - per-directory selective import with isImporting guard
    - sourceType field on sendChunk for JS-side partitioning
    - security-scoped resource access managed at bridge handler level
    - BEXL binary exclusion documented and auditable via logger.debug
key_files:
  created: []
  modified:
    - native/Isometry/Isometry/AltoIndexAdapter.swift
    - native/Isometry/Isometry/NativeImportCoordinator.swift
    - native/Isometry/Isometry/BridgeManager.swift
decisions:
  - "fetchCardsForDirectory returns [CanonicalCard] (not AsyncStream) — single directory is small enough for synchronous return"
  - "sourceType passed through sendChunk as optional String so existing runImport callers remain unaffected"
  - "Security-scoped access started/stopped in BridgeManager bridge handler, not inside runAltoImport, so the coordinator stays testable without file-system concerns"
metrics:
  duration_seconds: 112
  completed_date: "2026-03-25"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 3
---

# Phase 124 Plan 01: Selective Import + Partitioning (Swift Pipeline) Summary

**One-liner:** Per-directory alto-index import pipeline with BEXL binary exclusion, chunk-level sourceType partitioning, and native:alto-import-progress bridge events.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add fetchCardsForDirectory and binary exclusion guard | 92a6ef36 | AltoIndexAdapter.swift |
| 2 | Add runAltoImport + bridge wiring for selective import | 54434a88 | NativeImportCoordinator.swift, BridgeManager.swift |

## What Was Built

### Task 1 — AltoIndexAdapter.fetchCardsForDirectory (BEXL-01, BEXL-02)

Added `static func fetchCardsForDirectory(dirPath: String, cardType: String, subdirName: String) -> [CanonicalCard]` to `AltoIndexAdapter`. The method:

- Calls the existing `collectMarkdownFiles(in:)` (which already filters to `.md` only)
- Calls `parseFile(path:cardType:subdirectory:index:)` for each file
- Documents the BEXL binary exclusion contract in the method body comment
- Adds a `BINARY_EXTENSIONS: Set<String>` constant as an auditable record of excluded types
- Emits a `logger.debug` BEXL audit line after processing each directory

### Task 2 — NativeImportCoordinator.runAltoImport + BridgeManager wiring (IMPT-01..04)

Added `func runAltoImport(directories: [(name: String, cardType: String, path: String)]) async` to `NativeImportCoordinator`:

- Guards with `isImporting` flag to prevent concurrent imports
- Iterates directories individually, calling `fetchCardsForDirectory` per directory
- Slices each directory's cards into 200-card chunks via existing `sendChunk`
- Passes `sourceType: "alto_index_{dirName}"` to `sendChunk` so JS can associate chunks with their source directory
- Sends four progress event types to JS via `sendAltoImportProgress`: `started`, `complete`, `error`, `all-complete`

Extended `sendChunk` signature: `sourceType: String? = nil` (backward-compatible default). The `sourceTypeField` is appended to the JS payload string only when non-nil.

Added `case "native:request-alto-import"` to `BridgeManager.didReceive(_:)`:
- Parses `rootPath` + `directories` array from payload
- Calls `rootURL.startAccessingSecurityScopedResource()` for sandbox compliance
- Dispatches `importCoordinator?.runAltoImport(directories:)` in a `Task { @MainActor }`
- Stops security-scoped access after import completes

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `xcodebuild -scheme Isometry -destination 'platform=macOS' build` → **BUILD SUCCEEDED** (0 errors)
- `AltoIndexAdapter.swift` contains `static func fetchCardsForDirectory`
- `AltoIndexAdapter.swift` contains `BEXL-01/02: This method reads ONLY .md text files`
- `AltoIndexAdapter.swift` contains `BINARY_EXTENSIONS`
- `AltoIndexAdapter.swift` contains `skipped all binary content`
- `NativeImportCoordinator.swift` contains `func runAltoImport(directories:`
- `NativeImportCoordinator.swift` contains `sendAltoImportProgress`
- `NativeImportCoordinator.swift` contains `alto_index_`
- `BridgeManager.swift` contains `case "native:request-alto-import"`
- `BridgeManager.swift` contains `startAccessingSecurityScopedResource`

## Self-Check: PASSED
