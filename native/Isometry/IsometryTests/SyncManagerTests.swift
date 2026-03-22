import Testing
import Foundation
import CloudKit
@testable import Isometry

// ---------------------------------------------------------------------------
// SyncManager Tests
// ---------------------------------------------------------------------------
// Tests for SyncManager state persistence and offline queue behavior.
//
// Strategy: SyncManager is an actor. initialize() creates a real CKSyncEngine
// which requires CloudKit entitlements -- do NOT call it in tests.
// Instead, test the file-based persistence layer:
//   - init(appSupportDir:) loads offline queue and system fields from disk
//   - addPendingChange() appends to in-memory queue and persists to sync-queue.json
//   - consumeReuploadFlag() returns the needsFullReupload flag (false without initialize())
//
// Each test uses its own temp directory to avoid interference.

struct SyncManagerTests {

    // MARK: - Helpers

    private func makeTempDir() -> URL {
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? fm.createDirectory(at: tempDir, withIntermediateDirectories: true)
        return tempDir
    }

    private func makeSaveChange(id: String = UUID().uuidString, recordId: String = UUID().uuidString) -> PendingChange {
        PendingChange(
            id: id,
            recordType: SyncConstants.cardRecordType,
            recordId: recordId,
            operation: "save",
            fields: [
                "name": .string("Test Card"),
                "priority": .int(3),
                "weight": .double(1.5),
            ],
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
    }

    private func makeDeleteChange(id: String = UUID().uuidString, recordId: String = UUID().uuidString) -> PendingChange {
        PendingChange(
            id: id,
            recordType: SyncConstants.cardRecordType,
            recordId: recordId,
            operation: "delete",
            fields: nil,
            timestamp: Date(timeIntervalSince1970: 1_700_000_000)
        )
    }

    private func readQueueFile(at dir: URL) throws -> [PendingChange] {
        let queueURL = dir.appendingPathComponent("sync-queue.json")
        let data = try Data(contentsOf: queueURL)
        return try JSONDecoder().decode([PendingChange].self, from: data)
    }

    // MARK: - Init behavior

    @Test func initWithEmptyDirHasEmptyQueue() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        // consumeReuploadFlag returns false without calling initialize()
        let flag = await manager.consumeReuploadFlag()
        #expect(flag == false)
    }

    @Test func consumeReuploadFlagReturnsFalseWithoutInitialize() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        // First call
        let first = await manager.consumeReuploadFlag()
        #expect(first == false)

        // Second call -- still false, was never set true without initialize()
        let second = await manager.consumeReuploadFlag()
        #expect(second == false)
    }

    // MARK: - addPendingChange file persistence

    @Test func addPendingChangePersistsToQueueFile() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        let change = makeSaveChange(id: "uuid-1", recordId: "card-abc")

        await manager.addPendingChange(change)

        // By the time await returns, the file write is complete (synchronous within actor)
        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 1)
        #expect(decoded[0].id == "uuid-1")
        #expect(decoded[0].recordId == "card-abc")
        #expect(decoded[0].operation == "save")
        #expect(decoded[0].fields?["name"] == .string("Test Card"))
    }

    @Test func addMultiplePendingChangesAccumulates() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        await manager.addPendingChange(makeSaveChange(id: "a"))
        await manager.addPendingChange(makeSaveChange(id: "b"))
        await manager.addPendingChange(makeSaveChange(id: "c"))

        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 3)
        #expect(decoded.map(\.id).sorted() == ["a", "b", "c"])
    }

    @Test func pendingChangesRoundTripThroughFileSystem() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        // SyncManager A writes 2 changes
        let managerA = SyncManager(appSupportDir: tempDir)
        await managerA.addPendingChange(makeSaveChange(id: "x1", recordId: "card-1"))
        await managerA.addPendingChange(makeSaveChange(id: "x2", recordId: "card-2"))

        // SyncManager B reads the same dir on init (loads queue from disk)
        let managerB = SyncManager(appSupportDir: tempDir)
        // Add a 3rd change through B -- should accumulate on top of the 2 loaded from disk
        await managerB.addPendingChange(makeSaveChange(id: "x3", recordId: "card-3"))

        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 3)
        let ids = decoded.map(\.id).sorted()
        #expect(ids == ["x1", "x2", "x3"])
    }

    @Test func addPendingChangeDeleteOperation() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        let change = makeDeleteChange(id: "del-1", recordId: "card-xyz")

        await manager.addPendingChange(change)

        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 1)
        #expect(decoded[0].operation == "delete")
        #expect(decoded[0].fields == nil)
        #expect(decoded[0].recordId == "card-xyz")
    }

    @Test func queueFileCorruptionReturnsEmptyArray() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        // Write garbage bytes to sync-queue.json before init
        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        let garbage = Data([0xDE, 0xAD, 0xBE, 0xEF, 0xFF])
        try garbage.write(to: queueURL)

        // SyncManager should not crash on corrupt queue -- loadQueueFromDisk returns []
        let manager = SyncManager(appSupportDir: tempDir)

        // Should still work normally after corrupt load
        let change = makeSaveChange(id: "after-corrupt")
        await manager.addPendingChange(change)

        let decoded = try readQueueFile(at: tempDir)
        // Loaded [] from corrupt file, appended 1 new change
        #expect(decoded.count == 1)
        #expect(decoded[0].id == "after-corrupt")
    }

    // MARK: - State files

    @Test func systemFieldsFileDoesNotExistOnInit() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let _ = SyncManager(appSupportDir: tempDir)

        // System fields file is only written after sync events (not by init alone)
        let systemFieldsURL = tempDir.appendingPathComponent("record-metadata.json")
        #expect(!FileManager.default.fileExists(atPath: systemFieldsURL.path))
    }

    @Test func stateFileDoesNotExistOnInit() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let _ = SyncManager(appSupportDir: tempDir)

        // sync-state.data is only written after stateUpdate events from CKSyncEngine
        let stateURL = tempDir.appendingPathComponent("sync-state.data")
        #expect(!FileManager.default.fileExists(atPath: stateURL.path))
    }

    @Test func queueFileDoesNotExistWithoutChanges() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let _ = SyncManager(appSupportDir: tempDir)

        // Queue file only written when addPendingChange is called
        let queueURL = tempDir.appendingPathComponent("sync-queue.json")
        #expect(!FileManager.default.fileExists(atPath: queueURL.path))
    }

    // MARK: - Mixed save and delete operations

    @Test func mixedSaveAndDeleteOperationsAccumulate() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)

        await manager.addPendingChange(makeSaveChange(id: "save-1", recordId: "card-1"))
        await manager.addPendingChange(makeDeleteChange(id: "del-1", recordId: "card-2"))
        await manager.addPendingChange(makeSaveChange(id: "save-2", recordId: "card-3"))

        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 3)

        let operations = decoded.map(\.operation)
        #expect(operations.contains("save"))
        #expect(operations.contains("delete"))

        let saves = decoded.filter { $0.operation == "save" }
        let deletes = decoded.filter { $0.operation == "delete" }
        #expect(saves.count == 2)
        #expect(deletes.count == 1)
        #expect(deletes[0].fields == nil)
    }

    // MARK: - CKRecord field encoding

    private func makeTestRecord(id: String = "test-record") -> CKRecord {
        let recordID = CKRecord.ID(recordName: id, zoneID: SyncConstants.zoneID)
        return CKRecord(recordType: SyncConstants.cardRecordType, recordID: recordID)
    }

    @Test func ckRecordSetCardFieldsAndRoundTrip() {
        var record = makeTestRecord()
        let fields: [String: CodableValue] = [
            "name": .string("Hello"),
            "priority": .int(5),
            "weight": .double(3.14),
        ]
        record.setCardFields(fields)

        let result = record.cardFieldsDictionary()

        #expect(result["name"] == .string("Hello"))
        #expect(result["priority"] == .int(5))
        #expect(result["weight"] == .double(3.14))
    }

    @Test func ckRecordCardFieldsDictionaryOmitsUnsetFields() {
        var record = makeTestRecord()
        record.setCardFields(["name": .string("X")])

        let result = record.cardFieldsDictionary()

        #expect(result.count == 1)
        #expect(result["name"] == .string("X"))
        #expect(result["priority"] == nil)
    }

    @Test func ckRecordSetCardFieldsNullClearsValue() {
        var record = makeTestRecord()
        record.setCardFields(["name": .string("First")])
        record.setCardFields(["name": .null])

        let result = record.cardFieldsDictionary()

        #expect(result["name"] == nil)
    }

    @Test func ckRecordAllFieldTypesRoundTrip() {
        var record = makeTestRecord()
        let fields: [String: CodableValue] = [
            "source": .string("apple-notes"),
            "sort_order": .int(42),
            "latitude": .double(-33.8688),
        ]
        record.setCardFields(fields)

        let result = record.cardFieldsDictionary()

        #expect(result["source"] == .string("apple-notes"))
        #expect(result["sort_order"] == .int(42))
        #expect(result["latitude"] == .double(-33.8688))
    }

    // MARK: - Timestamp preservation

    @Test func timestampPreservedThroughRoundTrip() async throws {
        let tempDir = makeTempDir()
        defer { try? FileManager.default.removeItem(at: tempDir) }

        let manager = SyncManager(appSupportDir: tempDir)
        let fixedDate = Date(timeIntervalSince1970: 1_700_000_000)
        let change = PendingChange(
            id: "ts-test",
            recordType: SyncConstants.cardRecordType,
            recordId: "card-ts",
            operation: "save",
            fields: ["name": .string("Timestamp Test")],
            timestamp: fixedDate
        )

        await manager.addPendingChange(change)

        let decoded = try readQueueFile(at: tempDir)
        #expect(decoded.count == 1)
        // Timestamp should survive JSON round-trip within ~1 second tolerance
        #expect(abs(decoded[0].timestamp.timeIntervalSince(fixedDate)) < 1.0)
    }
}
