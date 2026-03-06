---
phase: 33-native-etl-foundation
plan: 02
subsystem: etl
tags: [native-bridge, worker-protocol, chunked-import, dedup, canonical-card]

# Dependency graph
requires:
  - phase: 08-etl-pipeline
    provides: ImportOrchestrator, DedupEngine, SQLiteWriter, CatalogWriter, CanonicalCard types
  - phase: 12-bridge-persistence
    provides: NativeBridge with receive handler, WorkerBridge, mutation hook
provides:
  - Extended SourceType union with native_reminders, native_calendar, native_notes
  - etl:import-native worker handler using DedupEngine + SQLiteWriter directly
  - WorkerBridge.importNative() method for pre-parsed card imports
  - NativeBridge native:import-chunk handler with chunk accumulation and ack
  - MUTATING_TYPES includes etl:import-native for checkpoint trigger
affects: [33-native-etl-foundation, 34-native-reminders, 35-native-notes, 36-native-calendar]

# Tech tracking
tech-stack:
  added: []
  patterns: [chunked-bridge-accumulation, pre-parsed-card-import, bypass-parse-pipeline]

key-files:
  created:
    - src/worker/handlers/etl-import-native.handler.ts
  modified:
    - src/etl/types.ts
    - src/worker/protocol.ts
    - src/worker/WorkerBridge.ts
    - src/worker/worker.ts
    - src/worker/handlers/index.ts
    - src/native/NativeBridge.ts
    - src/etl/ImportOrchestrator.ts

key-decisions:
  - "Native handler bypasses ImportOrchestrator.parse() and uses DedupEngine + SQLiteWriter directly"
  - "ImportOrchestrator rejects native source types with descriptive error to prevent misroute"
  - "Chunk ack sent BEFORE ImportOrchestrator call to prevent Swift timeout"
  - "Accumulator state reset before async importNative call to prevent stale references"

patterns-established:
  - "Chunked bridge accumulation: module-level state accumulates chunks, single import on final chunk"
  - "Pre-parsed import: etl:import-native bypasses parsing, feeds DedupEngine directly"
  - "Ack-before-process: acknowledge chunk receipt before expensive database operations"

requirements-completed: [FNDX-05]

# Metrics
duration: 5m 32s
completed: 2026-03-05
---

# Phase 33 Plan 02: TypeScript Bridge Infrastructure Summary

**TypeScript-side native import infrastructure: chunk accumulation in NativeBridge, etl:import-native worker handler with DedupEngine bypass, WorkerBridge.importNative(), and 3 native source types**

## Performance

- **Duration:** 5m 32s
- **Started:** 2026-03-06T03:58:57Z
- **Completed:** 2026-03-06T04:04:29Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Extended SourceType union with native_reminders, native_calendar, native_notes for Phase 33+ adapter source tracking
- Created etl-import-native.handler.ts that bypasses parsing and uses DedupEngine + SQLiteWriter + CatalogWriter directly for pre-parsed CanonicalCard arrays
- Added native:import-chunk handler in NativeBridge with base64 decode, chunk accumulation, and Swift ack protocol
- Wired full round-trip: Swift chunks -> NativeBridge accumulation -> WorkerBridge.importNative() -> Worker handler -> DedupEngine -> SQLiteWriter -> checkpoint trigger

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend SourceType and Worker protocol for native imports** - `4a675261` (feat)
2. **Task 2: NativeBridge.ts chunk handler with accumulation and ack** - `bb2e11ae` (feat)

## Files Created/Modified
- `src/etl/types.ts` - Extended SourceType union with 3 native adapter types
- `src/worker/protocol.ts` - Added etl:import-native to WorkerRequestType, WorkerPayloads, WorkerResponses
- `src/worker/handlers/etl-import-native.handler.ts` - New handler using DedupEngine + SQLiteWriter directly (no parsing)
- `src/worker/handlers/index.ts` - Added export for handleETLImportNative
- `src/worker/worker.ts` - Added etl:import-native case in router switch
- `src/worker/WorkerBridge.ts` - Added importNative() method with ETL_TIMEOUT
- `src/native/NativeBridge.ts` - Added chunk accumulator, native:import-chunk handler, ack protocol, etl:import-native in MUTATING_TYPES
- `src/etl/ImportOrchestrator.ts` - Added native source types to parse switch (rejects with error) and getSourceName Record

## Decisions Made
- Native handler uses DedupEngine + SQLiteWriter directly rather than trying to fit pre-parsed cards through ImportOrchestrator.import() which expects raw string data for parsing. This avoids unnecessary abstraction and matches the research recommendation.
- ImportOrchestrator.parse() throws a descriptive error for native source types to prevent accidental misrouting through the file-based import path.
- Chunk ack is sent to Swift before calling ImportOrchestrator to prevent Swift-side timeout during database writes.
- Accumulator state (chunkAccumulator, activeSourceType) is captured into local variables and reset before the async importNative call to prevent stale references if a new import starts during the async operation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ImportOrchestrator exhaustive switch on SourceType**
- **Found during:** Task 1
- **Issue:** Adding 3 new values to SourceType union caused TypeScript exhaustive check failure in ImportOrchestrator.parse() default case and incomplete Record<SourceType, string> in getSourceName
- **Fix:** Added native source type cases to parse() switch (throws descriptive error) and added entries to getSourceName Record
- **Files modified:** src/etl/ImportOrchestrator.ts
- **Verification:** TypeScript compiles with zero errors in all modified files
- **Committed in:** 4a675261 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary for TypeScript compilation. ImportOrchestrator correctly rejects native source types to prevent misrouting. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TypeScript infrastructure is ready for Plan 01 (Swift-side NativeImportAdapter protocol, PermissionManager, NativeImportCoordinator)
- Plan 03 (MockAdapter E2E test) can now validate the full pipeline: Swift adapter -> bridge -> Worker -> DedupEngine -> SQLiteWriter
- All 3 native source types are registered and will be recognized by the dedup and catalog systems
- Pre-existing SuperGridSizer test failures (4 tests) are unrelated to this plan and were present before execution

---
*Phase: 33-native-etl-foundation*
*Completed: 2026-03-05*
