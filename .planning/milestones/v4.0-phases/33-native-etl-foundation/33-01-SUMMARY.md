---
phase: 33-native-etl-foundation
plan: 01
subsystem: native-etl
tags: [swift, protocol, codable, coredata, timestamp, asyncstream, wkwebview, base64, security-scoped-bookmark]

# Dependency graph
requires:
  - phase: 14-icloud-storekit
    provides: BridgeManager @MainActor evaluateJavaScript pattern, DatabaseManager actor pattern
provides:
  - NativeImportAdapter protocol with AsyncStream<[CanonicalCard]> batch yielding
  - CanonicalCard Codable struct mirroring TypeScript CanonicalCard field-for-field
  - PermissionStatus enum and NativeImportError enum
  - CoreDataTimestampConverter with 978,307,200 epoch offset (XCTest-verified)
  - PermissionManager actor with security-scoped bookmark caching and System Settings deep links
  - NativeImportCoordinator @MainActor with 200-card chunked base64 bridge dispatch
affects: [33-02-PLAN, 33-03-PLAN, 34-reminders-calendar, 35-notes-adapter]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NativeImportAdapter protocol: AsyncStream<[CanonicalCard]> for adapter batch yielding"
    - "CoreDataTimestampConverter: caseless enum namespace for epoch offset conversion"
    - "PermissionManager actor: security-scoped bookmark caching pattern"
    - "NativeImportCoordinator: CheckedContinuation-based JS ack for sequential chunk dispatch"
    - "Base64 encoding for evaluateJavaScript payload transport"

key-files:
  created:
    - native/Isometry/Isometry/NativeImportAdapter.swift
    - native/Isometry/Isometry/CoreDataTimestampConverter.swift
    - native/Isometry/Isometry/PermissionManager.swift
    - native/Isometry/Isometry/NativeImportCoordinator.swift
    - native/Isometry/IsometryTests/CoreDataTimestampConverterTests.swift
  modified: []

key-decisions:
  - "CanonicalCard uses snake_case field names to match TypeScript interface without custom CodingKeys"
  - "CoreDataTimestampConverter uses caseless enum as namespace (not struct or protocol extension)"
  - "PermissionManager is an actor (matching DatabaseManager pattern) for thread-safe bookmark access"
  - "NativeImportCoordinator is @MainActor class (matching BridgeManager pattern) for evaluateJavaScript"
  - "WAL/SHM file copy uses dash-suffix naming convention (db-wal, db-shm) matching SQLite defaults"

patterns-established:
  - "NativeImportAdapter protocol: all native adapters conform; coordinator handles chunking"
  - "CheckedContinuation ack pattern: store continuation, JS calls receiveChunkAck to resume"
  - "Copy-then-read: temp directory with UUID name, copy .db + .wal + .shm, open copy read-only"

requirements-completed: [FNDX-01, FNDX-02, FNDX-03, FNDX-04, FNDX-06, FNDX-07]

# Metrics
duration: 3m 37s
completed: 2026-03-05
---

# Phase 33 Plan 01: Native ETL Foundation Summary

**NativeImportAdapter protocol, CanonicalCard Codable struct, CoreDataTimestampConverter with XCTest-verified epoch offset, PermissionManager actor with bookmark caching, and NativeImportCoordinator with 200-card chunked base64 bridge dispatch**

## Performance

- **Duration:** 3m 37s
- **Started:** 2026-03-06T03:58:51Z
- **Completed:** 2026-03-06T04:02:28Z
- **Tasks:** 2
- **Files created:** 5

## Accomplishments
- NativeImportAdapter protocol defines the contract all native adapters (Reminders, Calendar, Notes) will conform to, with AsyncStream for backpressure-aware batch yielding
- CanonicalCard struct mirrors TypeScript CanonicalCard interface field-for-field as Codable, enabling type-safe JSON bridge transport
- CoreDataTimestampConverter eliminates the 31-year offset bug with 5 XCTests verifying epoch offset against known dates
- PermissionManager actor handles security-scoped bookmark storage/resolution, System Settings deep links for TCC panes, and copy-then-read database safety
- NativeImportCoordinator implements 200-card chunked dispatch with base64 encoding and continuation-based JS ack pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: NativeImportAdapter protocol, CanonicalCard struct, CoreDataTimestampConverter** - `c041c17b` (feat)
2. **Task 2: PermissionManager and NativeImportCoordinator** - `1d4a371b` (feat)

## Files Created/Modified
- `native/Isometry/Isometry/NativeImportAdapter.swift` - Protocol, CanonicalCard struct, PermissionStatus enum, NativeImportError enum
- `native/Isometry/Isometry/CoreDataTimestampConverter.swift` - Epoch offset converter (978,307,200) with ISO 8601 formatter
- `native/Isometry/Isometry/PermissionManager.swift` - Actor for bookmark caching, System Settings deep links, copy-then-read utility
- `native/Isometry/Isometry/NativeImportCoordinator.swift` - @MainActor coordinator for 200-card chunked base64 bridge dispatch
- `native/Isometry/IsometryTests/CoreDataTimestampConverterTests.swift` - 5 XCTests verifying epoch offset correctness

## Decisions Made
- CanonicalCard uses snake_case field names matching TypeScript interface so JSONEncoder produces correct keys without custom CodingKeys
- CoreDataTimestampConverter implemented as caseless enum (namespace pattern) rather than struct or protocol extension
- PermissionManager is an actor (matching existing DatabaseManager pattern) for thread-safe concurrent bookmark access
- NativeImportCoordinator is @MainActor class (matching existing BridgeManager pattern) since evaluateJavaScript requires main thread
- WAL/SHM file copy uses dash-suffix naming (db-wal, db-shm) matching SQLite default naming convention

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing Combine import to NativeImportCoordinator**
- **Found during:** Task 2 (PermissionManager and NativeImportCoordinator)
- **Issue:** @Published property wrapper requires Combine framework import
- **Fix:** Added `import Combine` to NativeImportCoordinator.swift
- **Files modified:** native/Isometry/Isometry/NativeImportCoordinator.swift
- **Verification:** Build succeeded after adding import
- **Committed in:** 1d4a371b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Trivial missing import. No scope creep.

## Issues Encountered
- Provisioning profile mismatch for iCloud entitlements prevents standard `xcodebuild test`; resolved by adding `CODE_SIGN_IDENTITY="-" CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=NO` flags. This is a pre-existing issue documented in project memory.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Swift-side foundation types are ready for Plan 02 (TypeScript-side bridge wiring)
- NativeImportCoordinator.receiveChunkAck() is ready to be called from BridgeManager when native:import-chunk-ack arrives
- CanonicalCard struct is ready for JSONEncoder serialization through the bridge
- Plan 03 will wire MockAdapter end-to-end through these foundation types

---
*Phase: 33-native-etl-foundation*
*Completed: 2026-03-05*
