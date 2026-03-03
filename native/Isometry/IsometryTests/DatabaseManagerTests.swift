import XCTest
@testable import Isometry

final class DatabaseManagerTests: XCTestCase {
    var sut: DatabaseManager!
    var testDir: URL!

    override func setUp() async throws {
        // Use a unique temp directory for each test — isolation
        testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("IsometryTests-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDir, withIntermediateDirectories: true)
        sut = try DatabaseManager(baseDirectory: testDir)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: testDir)
    }

    // DATA-02: First launch — no file
    func testLoadDatabase_noFile_returnsNil() async {
        let data = await sut.loadDatabase()
        XCTAssertNil(data)
    }

    // DATA-01: Load existing file
    func testLoadDatabase_existingFile_returnsData() async throws {
        let testData = Data("test-database-bytes".utf8)
        let dbURL = testDir.appendingPathComponent("isometry.db")
        try testData.write(to: dbURL)

        let loaded = await sut.loadDatabase()
        XCTAssertEqual(loaded, testData)
    }

    // Corruption cascade: .db missing, .bak exists
    func testLoadDatabase_dbMissing_bakExists_returnsBak() async throws {
        let bakData = Data("backup-bytes".utf8)
        let bakURL = testDir.appendingPathComponent("isometry.db.bak")
        try bakData.write(to: bakURL)

        let loaded = await sut.loadDatabase()
        XCTAssertEqual(loaded, bakData)
    }

    // DATA-03: Atomic write
    func testSaveCheckpoint_createsDbFile() async throws {
        let checkpointData = Data("checkpoint-bytes".utf8)
        try await sut.saveCheckpoint(checkpointData)

        let dbURL = testDir.appendingPathComponent("isometry.db")
        XCTAssertTrue(FileManager.default.fileExists(atPath: dbURL.path))

        let saved = try Data(contentsOf: dbURL)
        XCTAssertEqual(saved, checkpointData)
    }

    // DATA-03: Backup rotation
    func testSaveCheckpoint_rotatesExistingToBackup() async throws {
        let originalData = Data("original".utf8)
        let dbURL = testDir.appendingPathComponent("isometry.db")
        try originalData.write(to: dbURL)

        let newData = Data("updated".utf8)
        try await sut.saveCheckpoint(newData)

        let bakURL = testDir.appendingPathComponent("isometry.db.bak")
        XCTAssertTrue(FileManager.default.fileExists(atPath: bakURL.path))
        let bakContents = try Data(contentsOf: bakURL)
        XCTAssertEqual(bakContents, originalData)
    }

    // DATA-03: .tmp is cleaned up
    func testSaveCheckpoint_tmpFileRemovedAfterWrite() async throws {
        let data = Data("data".utf8)
        try await sut.saveCheckpoint(data)

        let tmpURL = testDir.appendingPathComponent("isometry.db.tmp")
        XCTAssertFalse(FileManager.default.fileExists(atPath: tmpURL.path))
    }

    // isDirty management
    func testIsDirty_defaultFalse() async {
        let dirty = await sut.isDirty
        XCTAssertFalse(dirty)
    }

    func testMarkDirty_setsTrue() async {
        await sut.markDirty()
        let dirty = await sut.isDirty
        XCTAssertTrue(dirty)
    }

    func testSaveCheckpoint_clearsDirtyFlag() async throws {
        await sut.markDirty()
        try await sut.saveCheckpoint(Data("data".utf8))
        let dirty = await sut.isDirty
        XCTAssertFalse(dirty)
    }

    // Multiple checkpoints — .bak always has previous version
    func testMultipleCheckpoints_bakHasPreviousVersion() async throws {
        try await sut.saveCheckpoint(Data("v1".utf8))
        try await sut.saveCheckpoint(Data("v2".utf8))

        let bakURL = testDir.appendingPathComponent("isometry.db.bak")
        let bakData = try Data(contentsOf: bakURL)
        XCTAssertEqual(bakData, Data("v1".utf8))

        let dbURL = testDir.appendingPathComponent("isometry.db")
        let dbData = try Data(contentsOf: dbURL)
        XCTAssertEqual(dbData, Data("v2".utf8))
    }
}
