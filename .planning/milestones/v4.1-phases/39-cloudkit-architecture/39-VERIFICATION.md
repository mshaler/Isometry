---
phase: 39-cloudkit-architecture
verified: 2026-03-07T04:15:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 39: CloudKit Architecture Verification Report

**Phase Goal:** The sync infrastructure is in place: schema columns for sync state, bridge protocol handles sync messages, CKSyncEngine is initialized with change token persistence, and the database has migrated from iCloud Documents to Application Support with CloudKit as the sync layer
**Verified:** 2026-03-07T04:15:00Z
**Status:** PASSED
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | App launches with database in Application Support (not iCloud ubiquity container) | VERIFIED | `DatabaseManager.swift` lines 14-18: production init uses `applicationSupportDirectory`; `makeForProduction()` line 41 resolves same path; `resolveStorageDirectory()` removed; no `useCoordinator` property |
| 2 | CKSyncEngine initializes with a custom record zone and persists change tokens across app restarts | VERIFIED | `SyncManager.swift` line 21: actor conforms to `CKSyncEngineDelegate`; lines 58-64: creates `CKSyncEngine` with `stateSerialization` from disk; `SyncTypes.swift` line 22: `IsometryZone` constant; lines 401-408: `persistStateSerialization` writes to `sync-state.data` on every `stateUpdate` event (line 101) |
| 3 | Incoming sync records from CloudKit merge into sql.js database via the bridge without using ImportOrchestrator | VERIFIED | `NativeBridge.ts` lines 311-357: `handleNativeSync` function processes records array, calls `buildCardMergeSQL`/`buildConnectionMergeSQL`, executes via `bridge.send('db:exec', stmt)` individually; `SyncManager.swift` lines 183-264: `handleFetchedRecordZoneChanges` builds records payload, dispatches to JS via `bridgeManager.sendSyncNotification`; `BridgeManager.swift` lines 364-377: `sendSyncNotification` formats as `native:sync` JS message; No ImportOrchestrator reference in sync path |
| 4 | Edits made while offline are queued locally and the queue survives app restart | VERIFIED | `SyncManager.swift` lines 429-443: `addPendingChange` appends to in-memory array, calls `persistQueue()`, notifies CKSyncEngine; lines 446-453: `persistQueue` writes JSON to `sync-queue.json`; lines 457-467: `loadQueueFromDisk` loads from disk on init (line 47); lines 67-84: re-adds pending changes to CKSyncEngine state on initialize(); `BridgeManager.swift` lines 146-172: `mutated` handler extracts changeset and forwards to `SyncManager.addPendingChange` |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `native/Isometry/Isometry/DatabaseManager.swift` | Simplified DatabaseManager without iCloud ubiquity logic | VERIFIED | 162 lines; no NSFileCoordinator, no useCoordinator, no resolveStorageDirectory; Application Support only with reverse migration |
| `native/Isometry/Isometry/Isometry.entitlements` | CloudKit entitlement with aps-environment | VERIFIED (warning) | CloudKit present (line 13), aps-environment present (line 5), icloud-container-identifiers present (line 7); CloudDocuments retained (line 14) and ubiquity-container-identifiers retained (line 16) -- see warnings section |
| `native/Isometry/Isometry/SyncManager.swift` | CKSyncEngine delegate, state persistence, offline queue management | VERIFIED | 515 lines; actor conforming to CKSyncEngineDelegate; state persistence via JSONEncoder; offline queue as sync-queue.json; system fields archival; bridgeManager wiring for incoming records |
| `native/Isometry/Isometry/SyncTypes.swift` | CKRecord field mapping, PendingChange Codable type, record zone constants | VERIFIED | 274 lines; SyncConstants with IsometryZone; CodableValue enum (5 cases, Codable/Sendable); PendingChange Codable struct; CKRecord card/connection field mapping extensions (nonisolated); CodableValue.from factory |
| `native/Isometry/Isometry/IsometryApp.swift` | SyncManager initialization and lifecycle wiring | VERIFIED | `initializeSyncManager()` at line 120; creates SyncManager, wires bridgeManager, stores on bridgeManager.syncManager, calls initialize() in Task |
| `native/Isometry/Isometry/BridgeManager.swift` | Enhanced mutated handler with changeset extraction, SyncManager wiring | VERIFIED | `syncManager` property at line 51; mutated handler at lines 139-172 extracts changeset and forwards to SyncManager; sendSyncNotification at lines 364-377 sends native:sync to JS |
| `src/native/NativeBridge.ts` | SyncMerger: native:sync handler runs INSERT OR REPLACE directly | VERIFIED | handleNativeSync at lines 311-357; buildCardMergeSQL at lines 367-409 with all 26 card columns; buildConnectionMergeSQL at lines 414-430; extractChangeset at lines 440-466; enhanced installMutationHook at lines 639-670 with changes payload |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| DatabaseManager.swift | Application Support/Isometry/ | production init always uses Application Support | WIRED | Line 15: `applicationSupportDirectory`; line 41: `makeForProduction` resolves same path |
| SyncManager.swift | sync-state.data | JSONEncoder persistence on every stateUpdate | WIRED | Line 44: stateURL set; line 101: `persistStateSerialization` called on stateUpdate; lines 401-408: implementation writes atomically |
| SyncManager.swift | sync-queue.json | JSONEncoder persistence of PendingChange array | WIRED | Line 45: queueURL set; line 431: `persistQueue()` called in addPendingChange; lines 446-453: implementation writes atomically |
| IsometryApp.swift | SyncManager.swift | initialization after DatabaseManager | WIRED | Line 51: `initializeSyncManager()` called in onAppear; lines 120-138: creates SyncManager, wires bridgeManager, calls initialize() |
| SyncManager.swift | BridgeManager.swift | handleFetchedChanges calls sendSyncNotification | WIRED | Line 262: `self.bridgeManager?.sendSyncNotification(payload)` via `Task { @MainActor in }` |
| BridgeManager.swift | NativeBridge.ts | window.__isometry.receive({type:'native:sync'}) | WIRED | Line 372: evaluateJavaScript with native:sync type; NativeBridge line 211: case 'native:sync' handler |
| NativeBridge.ts | WorkerBridge db:exec | SyncMerger builds INSERT OR REPLACE, sends via db:exec | WIRED | Line 349: `await bridge.send('db:exec', stmt)` for each record |
| NativeBridge.ts | BridgeManager.swift | Enhanced mutated message with changes array | WIRED | Lines 656-661: postMessage with changes from extractChangeset; BridgeManager lines 146-172: extracts changes and forwards to SyncManager |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-03 | 39-02 | Sync uses change tokens for incremental-only fetches (no full re-sync) | SATISFIED | CKSyncEngine.State.Serialization persisted on every stateUpdate event (SyncManager line 101); loaded on initialization (line 54); CKSyncEngine manages change tokens internally via this state |
| SYNC-08 | 39-03 | Incoming sync records merge into sql.js database via bridge (not ImportOrchestrator) | SATISFIED | handleNativeSync in NativeBridge.ts runs INSERT OR REPLACE via db:exec; SyncManager.handleFetchedRecordZoneChanges forwards via BridgeManager.sendSyncNotification; no ImportOrchestrator in sync path |
| SYNC-10 | 39-01, 39-02 | Offline edits queue locally and sync automatically when connectivity resumes | SATISFIED | PendingChange persisted as JSON in sync-queue.json; loaded from disk on init; re-added to CKSyncEngine state on launch; CKSyncEngine handles automatic retry when connectivity resumes |

No orphaned requirements found -- REQUIREMENTS.md maps SYNC-03, SYNC-08, SYNC-10 to Phase 39, and all three are covered by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| Isometry.entitlements | 14 | CloudDocuments retained alongside CloudKit | Warning | Not harmful but inconsistent with plan intent. DatabaseManager no longer uses ubiquity container for active storage. The `url(forUbiquityContainerIdentifier:)` call in `migrateFromUbiquityIfNeeded` requires the ubiquity-container-identifiers entitlement (line 16), which in turn requires CloudDocuments. Removing CloudDocuments could be done after migration period. |
| SyncManager.swift | 459, 465 | `return []` in error recovery paths | Info | Expected behavior -- loadQueueFromDisk and loadSystemFieldsFromDisk return empty collections on corrupt/missing files (graceful degradation) |

### Human Verification Required

### 1. App Launch After Migration

**Test:** On a device that previously used iCloud ubiquity container storage, launch the updated app
**Expected:** Database loads successfully from Application Support; if iCloud copy exists and local copy does not, migration copies it non-destructively
**Why human:** Requires a real device with iCloud ubiquity container history; simulator may not have existing iCloud data

### 2. CKSyncEngine Initialization

**Test:** Launch the app with a valid iCloud account signed in
**Expected:** SyncManager initializes without crash; console shows "SyncManager initialized" log; no errors about CloudKit container
**Why human:** Requires real iCloud account and valid provisioning profile with CloudKit capability

### 3. Offline Queue Persistence

**Test:** Make edits while airplane mode is on, force-quit the app, relaunch
**Expected:** Queued changes survive restart and are re-added to CKSyncEngine state (console log: "Restored N pending changes from offline queue")
**Why human:** Requires observing runtime behavior across app restart with network conditions

### 4. Bidirectional Sync Flow End-to-End

**Test:** On two devices with the same iCloud account, create a card on Device A
**Expected:** Card appears on Device B via native:sync message and SyncMerger INSERT OR REPLACE
**Why human:** Requires two physical devices, real CloudKit backend, and observing cross-device data flow

### Gaps Summary

No blocking gaps found. All 4 observable truths are verified, all artifacts pass three-level checks (exists, substantive, wired), all key links are connected, and all 3 requirements are satisfied.

**Minor finding (non-blocking):** The entitlements file retains both `CloudDocuments` and `ubiquity-container-identifiers` alongside the new CloudKit entries. This is technically justified because `migrateFromUbiquityIfNeeded` still calls `url(forUbiquityContainerIdentifier:)` which requires these entitlements. The plan intended to remove them, but the implementation correctly kept them for migration compatibility. These can be removed in a future phase once migration support is no longer needed.

**All 6 commits verified in git history:**
- `d72d95d4` (39-01 Task 1), `fec6465f` (39-02 Task 1), `0ab6f38d` (39-02 Task 2)
- `3e9b4195` (39-03 Task 1), `89c7e41b` (39-03 Task 2), `8608ba9d` (39-03 metadata)

---

_Verified: 2026-03-07T04:15:00Z_
_Verifier: Claude (gsd-verifier)_
