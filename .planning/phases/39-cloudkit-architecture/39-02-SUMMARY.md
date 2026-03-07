---
phase: 39-cloudkit-architecture
plan: 02
subsystem: sync
tags: [cloudkit, cksyncengine, offline-queue, swift-actors, sendable]

# Dependency graph
requires:
  - phase: 39-cloudkit-architecture
    plan: 01
    provides: "Simplified DatabaseManager using Application Support only, CloudKit entitlements"
provides:
  - "SyncManager actor conforming to CKSyncEngineDelegate with state persistence and offline queue"
  - "SyncTypes with CKRecord field mapping, CodableValue enum, PendingChange Codable struct"
  - "App lifecycle wiring: SyncManager initialized after DatabaseManager in IsometryApp"
affects: [39-03, 40-card-sync, 41-connection-sync]

# Tech tracking
tech-stack:
  added: [CKSyncEngine, CKSyncEngine.State.Serialization]
  patterns: ["Actor-based CKSyncEngineDelegate", "JSONEncoder state serialization", "System fields archival for conflict resolution", "BatchSnapshot pattern for actor-isolated closure capture"]

key-files:
  created:
    - "native/Isometry/Isometry/SyncManager.swift"
    - "native/Isometry/Isometry/SyncTypes.swift"
  modified:
    - "native/Isometry/Isometry/IsometryApp.swift"
    - "native/Isometry/Isometry/BridgeManager.swift"

key-decisions:
  - "CKSyncEngine.State.Serialization persisted via JSONEncoder (not NSKeyedArchiver) -- Serialization conforms to Codable natively"
  - "SyncManager stored on BridgeManager (not IsometryApp struct) because actors cannot be @StateObject and App structs are immutable"
  - "BatchSnapshot pattern: capture actor-isolated state into a Sendable struct before passing to CKSyncEngine.RecordZoneChangeBatch synchronous closure"
  - "CKRecord extension methods marked nonisolated to avoid MainActor inference in Xcode 26 strict concurrency"

patterns-established:
  - "BatchSnapshot: snapshot actor-isolated data into Sendable struct for synchronous closure consumption"
  - "nonisolated CKRecord extensions: mark all CKRecord extension methods nonisolated to avoid MainActor inference"
  - "SyncConstants enum: zone ID and record type names as static let constants"

requirements-completed: [SYNC-03, SYNC-10]

# Metrics
duration: 12min
completed: 2026-03-07
---

# Phase 39 Plan 02: CKSyncEngine Infrastructure Summary

**CKSyncEngine delegate actor with change token persistence, offline queue as JSON, system fields archival, and app lifecycle wiring**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-07T03:31:28Z
- **Completed:** 2026-03-07T03:44:07Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created SyncManager actor conforming to CKSyncEngineDelegate with handleEvent dispatching all event types (stateUpdate, accountChange, fetchedRecordZoneChanges, sentRecordZoneChanges, fetchedDatabaseChanges, sentDatabaseChanges)
- Implemented state serialization persistence via JSONEncoder on every stateUpdate event (SYNC-03 change token persistence)
- Built offline queue with PendingChange Codable type persisted as sync-queue.json, loaded on init, re-added to CKSyncEngine state on launch (SYNC-10)
- System fields archival via NSKeyedArchiver + encodeSystemFields(with:) prevents Pitfall 2 conflict resolution errors
- CKRecord field mapping extensions cover all card schema columns (20 string, 3 int, 3 double) and connection references with .deleteSelf action
- SyncManager wired into app lifecycle via IsometryApp.initializeSyncManager() with BridgeManager cross-reference for Plan 39-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SyncTypes with record mapping and queue types** - `fec6465f` (feat)
2. **Task 2: Create SyncManager actor and wire into app lifecycle** - `0ab6f38d` (feat)

**Plan metadata:** (pending)

## Files Created/Modified
- `native/Isometry/Isometry/SyncTypes.swift` - SyncConstants, CodableValue enum, PendingChange struct, CKRecord card/connection field mapping extensions
- `native/Isometry/Isometry/SyncManager.swift` - CKSyncEngineDelegate actor with state persistence, offline queue, system fields archival
- `native/Isometry/Isometry/IsometryApp.swift` - SyncManager initialization in .onAppear after DatabaseManager
- `native/Isometry/Isometry/BridgeManager.swift` - Added syncManager property for outgoing mutation queuing

## Decisions Made
- Used JSONEncoder for CKSyncEngine.State.Serialization persistence (not NSKeyedArchiver as in RESEARCH.md) because State.Serialization conforms to Codable natively -- simpler and more reliable
- Stored SyncManager on BridgeManager instead of IsometryApp struct because actors cannot be @StateObject and Swift App structs are immutable (no mutating functions callable from body/onAppear)
- Created BatchSnapshot pattern to capture actor-isolated state (pendingChanges, archivedSystemFields) into a Sendable struct before passing to CKSyncEngine.RecordZoneChangeBatch's synchronous closure -- required by Swift 6 strict concurrency
- Marked all CKRecord extension methods `nonisolated` to prevent MainActor inference in Xcode 26 which would block access from the SyncManager actor

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Swift 6 strict concurrency: actor-isolated state in synchronous closure**
- **Found during:** Task 2 (SyncManager buildRecordZoneChangeBatch)
- **Issue:** CKSyncEngine.RecordZoneChangeBatch init takes a synchronous `(CKRecord.ID) -> CKRecord` closure, but pendingChanges and archivedSystemFields are actor-isolated properties. Swift 6 forbids accessing actor-isolated state from a synchronous closure.
- **Fix:** Created BatchSnapshot Sendable struct pattern -- capture actor state into local constants before the closure, pass to a static method that builds the batch without actor isolation.
- **Files modified:** native/Isometry/Isometry/SyncManager.swift
- **Verification:** Xcode build succeeds
- **Committed in:** 0ab6f38d (Task 2 commit)

**2. [Rule 3 - Blocking] CKRecord extensions inferred as @MainActor in Xcode 26**
- **Found during:** Task 2 (SyncManager buildRecordZoneChangeBatch)
- **Issue:** CKRecord extension methods (setCardFields, setConnectionFields) were inferred as @MainActor by Xcode 26's strict concurrency, making them inaccessible from the SyncManager actor.
- **Fix:** Marked all CKRecord extension methods with `nonisolated` keyword.
- **Files modified:** native/Isometry/Isometry/SyncTypes.swift
- **Verification:** Xcode build succeeds
- **Committed in:** 0ab6f38d (Task 2 commit)

**3. [Rule 3 - Blocking] Missing .sentDatabaseChanges event case**
- **Found during:** Task 2 (SyncManager handleEvent switch)
- **Issue:** CKSyncEngine.Event has a `.sentDatabaseChanges` case not listed in the plan that causes exhaustive switch warning.
- **Fix:** Added `.sentDatabaseChanges` case with no-op handler.
- **Files modified:** native/Isometry/Isometry/SyncManager.swift
- **Verification:** Xcode build succeeds
- **Committed in:** 0ab6f38d (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking)
**Impact on plan:** All auto-fixes necessary for Swift 6 strict concurrency compliance. No scope creep.

## Issues Encountered
- CKSyncEngine.RecordZoneChangeBatch init is async in Xcode 26 (requires `await`) -- not documented in Apple's sample code. Added `await` keyword.
- syncEngine.state.pendingRecordZoneChanges does not require `await` despite being on a CKSyncEngine.State instance -- compiler warning confirmed this.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SyncManager is ready to forward fetched records to BridgeManager (TODO comment at line 187 marks the Plan 39-03 integration point)
- BridgeManager.syncManager property is ready to receive outgoing mutations from enhanced `mutated` messages (Plan 39-03)
- Offline queue loads from disk on launch and re-adds pending changes to CKSyncEngine state
- System fields archival is active -- conflict resolution will work when Phase 40 implements card sync
- Note: Provisioning profile may need regeneration for CloudKit capability (pre-existing technical debt)

## Self-Check: PASSED

- SyncTypes.swift: FOUND
- SyncManager.swift: FOUND
- 39-02-SUMMARY.md: FOUND
- Commit fec6465f: FOUND
- Commit 0ab6f38d: FOUND

---
*Phase: 39-cloudkit-architecture*
*Completed: 2026-03-07*
