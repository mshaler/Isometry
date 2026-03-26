---
phase: 126-wire-directory-path-reimport-refresh
plan: "01"
subsystem: native-import
tags: [swift, typescript, alto-index, native-import, dataset-lifecycle]

# Dependency graph
requires:
  - phase: 125-dataset-lifecycle-management
    provides: datasets table with directory_path column, two-phase reimport protocol, etl-import-native.handler already reads directoryPath
provides:
  - directoryPath field threaded from Swift NativeImportCoordinator.sendChunk through NativeBridge chunk accumulation to WorkerBridge.importNative
  - datasets.directory_path populated after every alto_index discovery import
  - DataExplorer stats panel refreshes immediately after re-import commit
affects: [dataset re-import flow, alto-import pipeline, DataExplorer refresh]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - directoryPath optional parameter pattern: sendChunk passes nil-safe optional, NativeBridge captures on chunk 0 and resets with other state, WorkerBridge spreads into payload only when defined
    - void refreshDataExplorer() pattern: consistent with every other import/delete path in main.ts

key-files:
  created: []
  modified:
    - native/Isometry/Isometry/NativeImportCoordinator.swift
    - src/native/NativeBridge.ts
    - src/worker/WorkerBridge.ts
    - src/main.ts

key-decisions:
  - "directoryPath flows only when present (spread conditional) — WorkerBridge does not include key if value is undefined, matching etl:import-native protocol.ts optional field"
  - "activeDirectoryPath reset alongside activeSourceType and chunkAccumulator before async importNative call to prevent state leak if import throws"

patterns-established:
  - "Module-level accumulator pattern in NativeBridge: reset on chunk 0, capture all per-import state there, reset all before async call on final chunk"

requirements-completed: [DSET-03, DSET-04]

# Metrics
duration: 10min
completed: 2026-03-26
---

# Phase 126 Plan 01: Wire Directory Path + Reimport Refresh Summary

**directoryPath threaded from Swift sendChunk through NativeBridge chunk accumulator to WorkerBridge.importNative, closing DSET-03 (directory_path persisted) and DSET-04 (DataExplorer refreshes after reimport)**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-26T20:10:00Z
- **Completed:** 2026-03-26T20:21:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- NativeImportCoordinator.swift: `sendChunk` accepts optional `directoryPath` parameter; `runAltoImport` passes `dir.path`; JS payload gets `directoryPathField` alongside existing `sourceTypeField`
- NativeBridge.ts: `activeDirectoryPath` module-level variable captures on chunk 0, resets with other state before async call, passes to `bridge.importNative` as optional
- WorkerBridge.ts: `importNative` accepts optional `directoryPath`, conditionally spreads into `etl:import-native` payload (handler already reads and stores it via `CatalogWriter.upsertDataset`)
- src/main.ts: `void refreshDataExplorer()` added after `datasets:commit-reimport` in `alto-reimport-result` handler

## Task Commits

1. **Task 1: Thread directoryPath through chunk pipeline** - `7e6f2702` (feat)
2. **Task 2: Add refreshDataExplorer after re-import commit** - `201de42a` (feat)

## Files Created/Modified

- `native/Isometry/Isometry/NativeImportCoordinator.swift` - sendChunk gains directoryPath param; runAltoImport passes dir.path
- `src/native/NativeBridge.ts` - activeDirectoryPath module var; payload type extended; capture + reset + forward on final chunk
- `src/worker/WorkerBridge.ts` - importNative signature extended with optional directoryPath
- `src/main.ts` - void refreshDataExplorer() after datasets:commit-reimport commit block

## Decisions Made

- directoryPath spread into payload only when not undefined (not when null) — WorkerBridge uses `...(directoryPath !== undefined ? { directoryPath } : {})` so the key is absent from the payload when not provided, matching the `directoryPath?: string` optional in protocol.ts
- activeDirectoryPath reset before the async `bridge.importNative()` call, same timing as activeSourceType and chunkAccumulator, preventing stale path if a subsequent import starts before the async call resolves

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- DSET-03 and DSET-04 gaps are closed
- Alto Index discovery import now stores directory_path in datasets table, enabling path-based re-import without re-opening the file picker
- DataExplorer stats panel reflects updated card counts immediately after re-import commit
- No blockers for downstream phases

## Self-Check: PASSED

All modified files exist. Both task commits (7e6f2702, 201de42a) confirmed in git history.

---
*Phase: 126-wire-directory-path-reimport-refresh*
*Completed: 2026-03-26*
