---
phase: 119-swift-critical-path-tests
plan: 02
subsystem: testing
tags: [swift, xctest, syncmanager, notes-adapter, sqlite3, protobuf, gzip, cloudkit]

requires:
  - phase: 119-01
    provides: ProtobufToMarkdownTests + GzipDecompressorTests establishing Swift Testing patterns

provides:
  - SyncManager actor persistence tests (offline queue + file I/O round-trip, 12 tests)
  - NotesAdapter fixture DB tests (Apple NoteStore schema queries + ZDATA extraction, 13 tests)

affects:
  - any future SyncManager changes (offline queue persistence contract verified)
  - any future NotesAdapter changes (NoteStore schema queries verified)

tech-stack:
  added: []
  patterns:
    - "Fixture SQLite pattern: create temp DB with Apple NoteStore schema using sqlite3_open + DDL, run production queries against it"
    - "SQLITE_TRANSIENT binding: sqlite3_bind_text must use SQLITE_TRANSIENT (not nil/SQLITE_STATIC) for Swift String arguments"
    - "attributeRun requirement: ProtobufToMarkdown.convertToMarkdown only emits text via attributeRun loop; test fixtures need at least one run"
    - "Actor isolation testing: SyncManager tests use `await` for all actor calls; initialize() skipped to avoid CloudKit entitlements"
    - "gzip compression: deflateInit2_ with MAX_WBITS+16 produces gzip; GzipDecompressor's MAX_WBITS+32 accepts both gzip and zlib formats"

key-files:
  created:
    - native/Isometry/IsometryTests/SyncManagerTests.swift
    - native/Isometry/IsometryTests/NotesAdapterTests.swift
  modified: []

key-decisions:
  - "Skip initialize() in SyncManager tests: creates real CKSyncEngine requiring CloudKit entitlements; test file-based persistence layer directly instead"
  - "Fixture DB approach for NotesAdapter: NotesAdapter.fetchCards() uses hardcoded noteStorePath so tests replicate internal SQL queries against temp SQLite DB"
  - "SQLITE_TRANSIENT for all bind_text: Swift String literals are value types -- using nil (SQLITE_STATIC) causes dangling pointer on step() execution"
  - "attributeRun required in ZDATA fixture: convertToMarkdown returns empty body when attributeRun array is empty even if noteText is set"

requirements-completed: [SWFT-01, SWFT-03]

duration: 13min
completed: 2026-03-22
---

# Phase 119 Plan 02: SyncManager + NotesAdapter Tests Summary

**SyncManager actor persistence tests (offline queue file I/O, corruption resilience) and NotesAdapter fixture SQLite DB tests (Apple NoteStore schema detection, folder hierarchy, ZDATA extraction) — 25 new Swift tests covering two of the three highest-risk untested paths**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-22T16:34:41Z
- **Completed:** 2026-03-22T16:47:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- 12 SyncManager tests: empty init, consumeReuploadFlag without initialize(), addPendingChange file persistence, multiple changes accumulation, filesystem round-trip (Manager A writes, Manager B reads), delete operation, corruption resilience (garbage queue file recovers), sync-state.data and record-metadata.json absent on init, mixed save+delete, timestamp preservation
- 13 NotesAdapter tests: PRAGMA table_info schema detection (ZTITLE1, ZCREATIONDATE3, ZISPASSWORDPROTECTED, ZNOTEDATA), folder hierarchy resolution (2-level and 3-level parent chains), note query filtering (encrypted and deleted excluded), ZDATA protobuf+gzip round-trip through ProtobufToMarkdown.extract(), attachment LEFT JOIN query, checkPermission returns .denied or .notDetermined in test environment
- All 25 tests pass via xcodebuild on macOS

## Task Commits

1. **Task 1: SyncManager state persistence and offline queue tests** - `57275903` (feat)
2. **Task 2: NotesAdapter fixture database tests** - `752a794d` (feat)

## Files Created/Modified

- `native/Isometry/IsometryTests/SyncManagerTests.swift` - 12 async actor tests for SyncManager offline queue persistence and file I/O
- `native/Isometry/IsometryTests/NotesAdapterTests.swift` - 13 tests using fixture SQLite DB with Apple NoteStore schema

## Decisions Made

- Skipped `initialize()` in SyncManager tests to avoid CloudKit entitlements requirement; tested file-based persistence layer directly — all observable effects (sync-queue.json writes) happen without CKSyncEngine
- Used fixture SQLite database approach for NotesAdapter instead of calling `fetchCards()` directly; replicated internal SQL queries from NotesAdapter's private methods against a temp DB
- SQLITE_TRANSIENT required for all `sqlite3_bind_text` Swift String arguments — Swift value types may be freed before the statement executes if SQLITE_STATIC is used
- Added `attributeRun` to ZDATA fixture: `ProtobufToMarkdown.convertToMarkdown` only emits text through the attributeRun loop, not from `noteText` directly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sqlite3_bind_text with SQLITE_TRANSIENT**
- **Found during:** Task 2 (NotesAdapter fixture database tests)
- **Issue:** `sqlite3_bind_text(stmt, N, swiftString, -1, nil)` passes SQLITE_STATIC — the Swift String value may be freed before sqlite3_step executes, causing empty column values
- **Fix:** Changed all `sqlite3_bind_text` calls to use `SQLITE_TRANSIENT` (via `unsafeBitCast(-1, to: sqlite3_destructor_type.self)`)
- **Files modified:** `native/Isometry/IsometryTests/NotesAdapterTests.swift`
- **Verification:** folderHierarchyResolution, noteQueryReturnsNonDeletedNonEncrypted, encryptedNoteDetection all pass after fix
- **Committed in:** `752a794d` (Task 2 commit)

**2. [Rule 1 - Bug] Added attributeRun to ZDATA fixture**
- **Found during:** Task 2 (zdataBlobExtraction test)
- **Issue:** `ProtobufToMarkdown.convertToMarkdown` returns empty body when `attributeRun` array is empty, even if `noteText` is set — the function only emits text through the attributeRun loop. Plan did not mention this requirement.
- **Fix:** Added `NoteAttributeRun` with `length = text.unicodeScalars.count` covering the entire fixture text
- **Files modified:** `native/Isometry/IsometryTests/NotesAdapterTests.swift`
- **Verification:** zdataBlobExtraction and zdataBlobRoundTripThroughSQLite pass after fix
- **Committed in:** `752a794d` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes necessary for test correctness. No scope creep.

## Issues Encountered

- Initial gzip compression implementation (using nested `withUnsafeBytes`/`withUnsafeMutableBytes` closures) had potential Swift exclusive access issues; rewrote using `[UInt8]` copy pattern with separate buffer pointer closures. Final implementation uses `deflateBound` + single-call `Z_FINISH` approach.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SyncManager and NotesAdapter are now tested; SWFT-01 and SWFT-03 requirements complete
- Plan 119-01 covers ProtobufToMarkdown tests (SWFT-02)
- Phase 119 provides the foundation for v8.5 Swift test coverage milestone

## Self-Check: PASSED

- FOUND: native/Isometry/IsometryTests/SyncManagerTests.swift
- FOUND: native/Isometry/IsometryTests/NotesAdapterTests.swift
- FOUND: .planning/phases/119-swift-critical-path-tests/119-02-SUMMARY.md
- FOUND commit: 57275903 (SyncManagerTests)
- FOUND commit: 752a794d (NotesAdapterTests)

---
*Phase: 119-swift-critical-path-tests*
*Completed: 2026-03-22*
