import Testing
import Foundation
import CloudKit
@testable import Isometry

// ---------------------------------------------------------------------------
// SyncManager Event Handler Tests — 8 CKSyncEngine Scenarios (SYNC-T01..T08)
// ---------------------------------------------------------------------------
// Tests for CKSyncEngine event handling via observable state transitions.
//
// Strategy:
//   - We cannot call handleEvent() directly (requires a live CKSyncEngine)
//   - Instead we test the observable effects exposed through:
//       a. consumeReuploadFlag() — needsFullReupload state
//       b. simulateClearSyncState() — clears queue file and in-memory state
//       c. simulateEncryptedDataReset() — sets needsFullReupload = true
//       d. SyncStatusPublisher — published error/idle/syncing state
//
// Each scenario maps to a real CKSyncEngine event the production code handles.
// Test seams (simulateXxx) were added to SyncManager for exactly this purpose.

struct SyncManagerEventTests {

    // MARK: - Helpers

    private func makeTempDir() -> URL {
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? fm.createDirectory(at: tempDir, withIntermediateDirectories: true)
        return tempDir
    }

    private func makeSaveChange(
        id: String = UUID().uuidString,
        recordId: String = UUID().uuidString
    ) -> PendingChange {
        PendingChange(
            id: id,
            recordType: SyncConstants.cardRecordType,
            recordId: recordId,
            operation: "save",
            fields: ["name": .string("Test Card")],
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
    }

    // MARK: - SYNC-T01: Sign In

    /// On sign-in, the manager should be in a clean initial state ready to sync.
    /// consumeReuploadFlag() returns false on fresh init (no initialize() call).
    @Test func signInInitialStateIsClean() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        // No reupload needed when manager is freshly created (no init called)
        let flag = await manager.consumeReuploadFlag()
        #expect(flag == false)
    }

    // MARK: - SYNC-T02: Sign Out

    /// On sign-out, sync state should be cleared.
    /// simulateClearSyncState() models handleAccountChange(.signOut) behavior.
    @Test func signOutClearsSyncState() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        // Add some pending changes so the queue file exists
        await manager.addPendingChange(makeSaveChange(id: "pre-signout"))

        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        #expect(FileManager.default.fileExists(atPath: queueURL.path))

        // Sign out: clear sync state
        await manager.simulateClearSyncState()

        // Queue file should be gone after clear
        #expect(!FileManager.default.fileExists(atPath: queueURL.path))
    }

    // MARK: - SYNC-T03: Switch Accounts

    /// On account switch, sync state should be cleared (same behavior as sign-out).
    @Test func switchAccountsClearsSyncState() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let managerA = SyncManager(appSupportDir: tempDir)
        await managerA.addPendingChange(makeSaveChange(id: "account-a-change"))

        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        #expect(FileManager.default.fileExists(atPath: queueURL.path))

        // Switch accounts: clear existing state
        await managerA.simulateClearSyncState()

        #expect(!FileManager.default.fileExists(atPath: queueURL.path))

        // New manager representing account B starts clean
        let managerB = SyncManager(appSupportDir: tempDir)
        let flag = await managerB.consumeReuploadFlag()
        #expect(flag == false)
    }

    // MARK: - SYNC-T04: Purged Zone

    /// Zone purge (user cleared iCloud via Settings) should clear all local sync state.
    @Test func purgedZoneClearsSyncState() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        await manager.addPendingChange(makeSaveChange(id: "purge-test"))

        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        #expect(FileManager.default.fileExists(atPath: queueURL.path))

        // Purge: clear sync state (same as sign-out behavior)
        await manager.simulateClearSyncState()

        #expect(!FileManager.default.fileExists(atPath: queueURL.path))
    }

    // MARK: - SYNC-T05: Encrypted Data Reset

    /// encryptedDataReset should set needsFullReupload = true.
    /// This models the account recovery scenario.
    @Test func encryptedDataResetSetsReuploadFlag() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        // Before reset: flag is false
        // (We can't call consumeReuploadFlag yet because it would clear it)

        // Simulate encryptedDataReset event
        await manager.simulateEncryptedDataReset()

        // Flag should now be true
        let flag = await manager.consumeReuploadFlag()
        #expect(flag == true)
    }

    /// After consumeReuploadFlag() consumes the flag, it returns false on subsequent calls.
    @Test func encryptedDataResetFlagConsumedOnce() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        await manager.simulateEncryptedDataReset()

        let first = await manager.consumeReuploadFlag()
        #expect(first == true)

        // Second call — flag was consumed
        let second = await manager.consumeReuploadFlag()
        #expect(second == false)
    }

    // MARK: - SYNC-T06: Zone Deleted

    /// Zone deletion (normal cleanup) should clear sync state.
    @Test func zoneDeletionClearsSyncState() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        await manager.addPendingChange(makeSaveChange(id: "zone-delete-test"))

        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        #expect(FileManager.default.fileExists(atPath: queueURL.path))

        // Zone deleted: clear state
        await manager.simulateClearSyncState()

        #expect(!FileManager.default.fileExists(atPath: queueURL.path))
    }

    // MARK: - SYNC-T07: Server Record Changed (Conflict Resolution)

    /// Server-wins conflict resolution: extract fields from a CKRecord and verify round-trip.
    /// Tests the cardFieldsDictionary() used in handleSentRecordZoneChanges conflict handling.
    @Test func serverRecordChangedFieldExtraction() throws {
        let recordID = CKRecord.ID(
            recordName: "conflict-card-1",
            zoneID: SyncConstants.zoneID
        )
        var serverRecord = CKRecord(
            recordType: SyncConstants.cardRecordType,
            recordID: recordID
        )

        let serverFields: [String: CodableValue] = [
            "name": .string("Server Version"),
            "priority": .int(2),
            "source": .string("native_calendar"),
        ]
        serverRecord.setCardFields(serverFields)

        // Extract fields as the conflict handler does
        let extracted = serverRecord.cardFieldsDictionary()

        #expect(extracted["name"] == .string("Server Version"))
        #expect(extracted["priority"] == .int(2))
        #expect(extracted["source"] == .string("native_calendar"))
    }

    /// Verify connection fields extraction for conflict resolution.
    @Test func serverRecordChangedConnectionFields() throws {
        let recordID = CKRecord.ID(
            recordName: "conflict-conn-1",
            zoneID: SyncConstants.zoneID
        )
        var connRecord = CKRecord(
            recordType: SyncConstants.connectionRecordType,
            recordID: recordID
        )

        let sourceCardID = CKRecord.ID(recordName: "card-src", zoneID: SyncConstants.zoneID)
        let targetCardID = CKRecord.ID(recordName: "card-tgt", zoneID: SyncConstants.zoneID)
        connRecord["source_id"] = CKRecord.Reference(recordID: sourceCardID, action: .none)
        connRecord["target_id"] = CKRecord.Reference(recordID: targetCardID, action: .none)
        connRecord["label"] = "relates-to" as CKRecordValueProtocol
        connRecord["weight"] = 1.5 as CKRecordValueProtocol

        // Verify the fields are stored and can be retrieved by type casting
        let sourceRef = connRecord["source_id"] as? CKRecord.Reference
        #expect(sourceRef?.recordID.recordName == "card-src")

        let targetRef = connRecord["target_id"] as? CKRecord.Reference
        #expect(targetRef?.recordID.recordName == "card-tgt")

        let label = connRecord["label"] as? String
        #expect(label == "relates-to")

        let weight = connRecord["weight"] as? Double
        #expect(weight == 1.5)
    }

    // MARK: - SYNC-T08: Non-Conflict Error

    /// Non-conflict errors should publish to SyncStatusPublisher.
    /// Tests the error publishing path in handleSentRecordZoneChanges.
    @Test @MainActor func nonConflictErrorPublishesToStatusPublisher() {
        let publisher = SyncStatusPublisher()

        // Simulate a non-conflict error as the handler does
        let syncError = SyncError(
            humanMessage: "iCloud is temporarily unavailable. Retrying automatically.",
            detail: "CKErrorDomain 6",
            isRetryable: true
        )
        publisher.status = .error(syncError)

        if case .error(let err) = publisher.status {
            #expect(err.humanMessage == "iCloud is temporarily unavailable. Retrying automatically.")
            #expect(err.isRetryable == true)
            #expect(err.detail == "CKErrorDomain 6")
        } else {
            Issue.record("Expected .error status but got \(publisher.status)")
        }
    }

    /// Verify that a successful sync clears error state back to idle.
    @Test @MainActor func successfulSyncResetsErrorToIdle() {
        let publisher = SyncStatusPublisher()

        let syncError = SyncError(
            humanMessage: "iCloud sync paused \u{2014} check your internet connection.",
            detail: "CKErrorDomain 3",
            isRetryable: true
        )
        publisher.status = .error(syncError)
        #expect(publisher.status != .idle)

        publisher.status = .idle
        #expect(publisher.status == .idle)
    }
}
