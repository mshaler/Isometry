---
phase: 41-cloudkit-connection-sync-polish
verified: 2026-03-07T07:30:00Z
status: passed
score: 3/3 must-haves verified (automated)
human_verification:
  - test: "Create a connection between two cards on Device A, wait for sync, verify connection appears on Device B"
    expected: "Connection is visible on Device B with correct source, target, and label"
    why_human: "Requires two physical devices with iCloud accounts to verify end-to-end CloudKit sync"
  - test: "Soft-delete a card on Device A, wait for sync, verify card shows as deleted on Device B"
    expected: "Card appears as deleted (filtered from normal views) on Device B, connections to it are hidden"
    why_human: "Requires two physical devices; visual verification that soft-deleted card is hidden but not orphaned"
  - test: "Full workflow: import cards, create connections, edit, soft-delete, sync -- verify consistency on both devices"
    expected: "All data consistent on both devices after sync completes"
    why_human: "Multi-step cross-device workflow cannot be verified programmatically"
---

# Phase 41: CloudKit Connection Sync + Polish Verification Report

**Phase Goal:** Connections sync between devices alongside cards, soft-deletes propagate correctly, and multi-device scenarios work end-to-end
**Verified:** 2026-03-07T07:30:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User creates a connection between two cards on Device A and the connection appears on Device B | VERIFIED (code) | extractChangeset handles connection:create with result.id and fields (line 519-526); SyncManager builds CKRecord with setConnectionFields (SyncManager.swift:513); handleNativeSync has buildConnectionMergeSQL for incoming connections (line 469-484); batch ordering ensures cards before connections (line 370-372) |
| 2 | User soft-deletes a card on Device A and it appears as deleted on Device B (not orphaned) | VERIFIED (code) | extractChangeset maps card:delete to operation:'update' with deleted_at ISO timestamp (line 513); deleted_at is in cardStringFields set (SyncTypes.swift:161) ensuring it syncs as a CKRecord field; incoming card records INSERT OR REPLACE including deleted_at column (line 460) |
| 3 | User performs a full workflow (import, edit, connect, delete, sync) across two devices and data is consistent on both | VERIFIED (code) | All mutation types produce correct changesets; exportAllCards sends both cards and connections (line 276-304); BridgeManager processes both in export-all-cards handler (line 227-275); batch ordering and FK failure handling in handleNativeSync ensure robust merge |

**Score:** 3/3 truths verified (automated code analysis)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/native/NativeBridge.ts` | Fixed extractChangeset, updated mutation hook, batch-ordered handleNativeSync | VERIFIED | Contains `operation: 'update'` for card:delete (line 513), `result?.id` for card:create (line 505), batch partitioning (lines 370-372), `SELECT * FROM connections` in exportAllCards (line 286), extractChangeset exported (line 495), handleNativeSync exported (line 349) |
| `tests/NativeBridge.test.ts` | TDD tests for extractChangeset fixes, batch ordering, FK failure handling | VERIFIED | 320 lines, 22 tests total: 9 extractChangeset tests, 2 batch ordering tests, 2 FK failure tests, 9 pre-existing tests. All 22 pass. |
| `native/Isometry/Isometry/BridgeManager.swift` | Connection processing in native:export-all-cards handler | VERIFIED | Lines 256-273: connection processing loop mirrors card loop, uses SyncConstants.connectionRecordType, backward-compatible with `?? []` default |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| NativeBridge.ts (installMutationHook) | NativeBridge.ts (extractChangeset) | passes result as third argument | WIRED | Line 727: `extractChangeset(type, payload, result)` -- result available from line 721 |
| NativeBridge.ts (handleNativeSync) | sql.js database | card records processed before connection records | WIRED | Lines 370-372: `cardRecords` filter, `connectionRecords` filter, `[...cardRecords, ...connectionRecords]` spread |
| NativeBridge.ts (exportAllCards) | BridgeManager.swift (native:export-all-cards) | nativeBridge.postMessage with cards + connections payload | WIRED | Line 293: `payload: { cards: rows, connections }` -- BridgeManager line 235: `let connections = payload["connections"] as? [[String: Any]] ?? []` |
| BridgeManager.swift (native:export-all-cards) | SyncManager.addPendingChange | PendingChange with connectionRecordType | WIRED | Line 266: `recordType: SyncConstants.connectionRecordType` -- SyncManager.addPendingChange confirmed at SyncManager.swift:556 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SYNC-02 | 41-01, 41-02 | Connections sync bidirectionally between devices alongside cards | SATISFIED | extractChangeset handles connection:create with result.id and fields; connection:delete produces CKRecord delete; exportAllCards includes connections; BridgeManager queues connection PendingChanges; SyncManager handles Connection records in handleFetchedRecordZoneChanges and nextRecordZoneChangeBatch |
| SYNC-07 | 41-01 | Soft-deleted cards on one device are marked deleted on other devices via sync | SATISFIED | extractChangeset maps card:delete to operation:'update' with deleted_at timestamp (not CKRecord deletion); card:undelete maps to operation:'update' with deleted_at:null; deleted_at is in cardStringFields (synced as CKRecord field); incoming records INSERT OR REPLACE with deleted_at column |

No orphaned requirements. REQUIREMENTS.md maps SYNC-02 and SYNC-07 to Phase 41, and both plan frontmatters claim them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | - | - | - | No TODO, FIXME, placeholder, or stub patterns found in modified files |

### Human Verification Required

All automated checks pass. The following items require physical multi-device testing:

### 1. Connection Sync Across Devices

**Test:** Create two cards on Device A, create a connection between them, wait for CloudKit sync, check Device B
**Expected:** Both cards and the connection appear on Device B. Connection has correct source_id, target_id, and label.
**Why human:** Requires two physical devices signed into the same iCloud account. CloudKit sync timing and network behavior cannot be verified programmatically.

### 2. Soft-Delete Propagation

**Test:** Soft-delete a card on Device A (that has connections). Wait for sync. Check Device B.
**Expected:** Card shows as deleted on Device B. Connections to the deleted card are hidden by existing WHERE deleted_at IS NULL join filters. Card CKRecord still exists in CloudKit (not hard-deleted).
**Why human:** Requires cross-device sync verification and visual confirmation that soft-deleted cards are filtered from views.

### 3. Full Multi-Device Workflow

**Test:** On Device A: import cards, create connections, edit card names, soft-delete one card. Wait for sync. On Device B: verify all data matches. Then on Device B: restore the soft-deleted card. Wait for sync. On Device A: verify the card is restored with connections reappearing.
**Expected:** Data is fully consistent on both devices after each sync cycle. Restore path works symmetrically.
**Why human:** Multi-step cross-device workflow with bidirectional sync and restore. Cannot be simulated in unit tests.

### Gaps Summary

No gaps found. All automated verification passes:

- **extractChangeset**: card:delete produces operation:'update' with deleted_at (not 'delete'). card:create and connection:create use result.id from Worker response. connection:create includes all fields (source_id, target_id, label, weight, via_card_id). All 9 extractChangeset tests pass.
- **installMutationHook**: Passes result as third argument to extractChangeset (line 727).
- **handleNativeSync**: Batch-orders cards before connections via partition (lines 370-372). FK failures caught and logged without crash. All 4 handleNativeSync tests pass.
- **exportAllCards**: Queries both cards and connections tables, sends both in payload (lines 276-304).
- **BridgeManager**: Processes connections from export-all-cards payload with connectionRecordType (lines 256-273). Backward-compatible with ?? [] default.
- **SyncManager**: Full bidirectional Connection record handling confirmed in handleFetchedRecordZoneChanges, nextRecordZoneChangeBatch, and setConnectionFields.
- **SYNC-02 and SYNC-07**: Both requirements fully satisfied at the code level.

The only remaining verification is physical multi-device testing of the end-to-end CloudKit sync flow.

**Note:** Multi-device CloudKit sync testing requires two physical devices signed into the same iCloud account. Simulators do not support CKSyncEngine. Accepted as passed based on automated verification (22 TDD tests + code-level must-have confirmation). Multi-device QA deferred to real hardware.

---

_Verified: 2026-03-07T07:30:00Z_
_Accepted: 2026-03-07 (automated-only, simulator limitation noted)_
_Verifier: Claude (gsd-verifier)_
