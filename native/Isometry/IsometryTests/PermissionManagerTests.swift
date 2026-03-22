import Testing
import Foundation
@testable import Isometry

// ---------------------------------------------------------------------------
// PermissionManager Tests
// ---------------------------------------------------------------------------
// Tests for copy-then-read utility and bookmark key construction.
// Actor methods require async test context.
//
// Note: storeBookmark/resolveBookmark tests are limited because
// security-scoped bookmarks require real file system paths and sandbox context.
// We focus on copyDatabaseToTemp which is fully testable.

struct PermissionManagerTests {

    // MARK: - copyDatabaseToTemp

    @Test func copyDatabaseToTempCopiesMainFile() async throws {
        let manager = PermissionManager()

        // Create a temp source file
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        let sourceDB = tempDir.appendingPathComponent("test.db")
        let testData = "SQLite test data".data(using: .utf8)!
        try testData.write(to: sourceDB)

        // Copy
        let copiedDB = try await manager.copyDatabaseToTemp(from: sourceDB)

        // Verify copy exists and has correct content
        let copiedData = try Data(contentsOf: copiedDB)
        #expect(copiedData == testData)
        #expect(copiedDB.lastPathComponent == "test.db")

        // Cleanup
        try? FileManager.default.removeItem(at: tempDir)
        try? FileManager.default.removeItem(at: copiedDB.deletingLastPathComponent())
    }

    @Test func copyDatabaseToTempCopiesWalIfExists() async throws {
        let manager = PermissionManager()

        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let sourceDB = tempDir.appendingPathComponent("test.db")
        try "db data".data(using: .utf8)!.write(to: sourceDB)

        // Create WAL file alongside
        let walURL = sourceDB.appendingPathExtension("wal")
        try "wal data".data(using: .utf8)!.write(to: walURL)

        let copiedDB = try await manager.copyDatabaseToTemp(from: sourceDB)
        let copiedDir = copiedDB.deletingLastPathComponent()

        // Verify WAL was copied
        let copiedWAL = copiedDir.appendingPathComponent("test.db-wal")
        #expect(FileManager.default.fileExists(atPath: copiedWAL.path))
        let walData = try Data(contentsOf: copiedWAL)
        #expect(String(data: walData, encoding: .utf8) == "wal data")

        // Cleanup
        try? FileManager.default.removeItem(at: tempDir)
        try? FileManager.default.removeItem(at: copiedDir)
    }

    @Test func copyDatabaseToTempCopiesShmIfExists() async throws {
        let manager = PermissionManager()

        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let sourceDB = tempDir.appendingPathComponent("notes.db")
        try "db data".data(using: .utf8)!.write(to: sourceDB)

        let shmURL = sourceDB.appendingPathExtension("shm")
        try "shm data".data(using: .utf8)!.write(to: shmURL)

        let copiedDB = try await manager.copyDatabaseToTemp(from: sourceDB)
        let copiedDir = copiedDB.deletingLastPathComponent()

        let copiedSHM = copiedDir.appendingPathComponent("notes.db-shm")
        #expect(FileManager.default.fileExists(atPath: copiedSHM.path))

        // Cleanup
        try? FileManager.default.removeItem(at: tempDir)
        try? FileManager.default.removeItem(at: copiedDir)
    }

    @Test func copyDatabaseToTempSucceedsWithoutWalShm() async throws {
        let manager = PermissionManager()

        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let sourceDB = tempDir.appendingPathComponent("solo.db")
        try "just db".data(using: .utf8)!.write(to: sourceDB)

        // No WAL or SHM — should not throw
        let copiedDB = try await manager.copyDatabaseToTemp(from: sourceDB)
        #expect(FileManager.default.fileExists(atPath: copiedDB.path))

        // Cleanup
        try? FileManager.default.removeItem(at: tempDir)
        try? FileManager.default.removeItem(at: copiedDB.deletingLastPathComponent())
    }

    // MARK: - cleanupTempCopy

    @Test func cleanupTempCopyRemovesDirectory() async throws {
        let manager = PermissionManager()

        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        let testFile = tempDir.appendingPathComponent("test.txt")
        try "content".data(using: .utf8)!.write(to: testFile)

        // Cleanup should remove the whole directory
        await manager.cleanupTempCopy(at: tempDir)
        #expect(!FileManager.default.fileExists(atPath: tempDir.path))
    }

    @Test func cleanupTempCopyHandlesMissingDirectoryGracefully() async {
        let manager = PermissionManager()
        let nonExistent = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)

        // Should not throw — logs warning but doesn't crash
        await manager.cleanupTempCopy(at: nonExistent)
    }

    // MARK: - clearBookmark

    @Test func clearBookmarkRemovesUserDefault() async {
        let manager = PermissionManager()
        let key = "works.isometry.bookmark.test_source"

        // Set a fake bookmark
        UserDefaults.standard.set(Data([0x01, 0x02]), forKey: key)
        #expect(UserDefaults.standard.data(forKey: key) != nil)

        // Clear it
        await manager.clearBookmark(for: "test_source")
        #expect(UserDefaults.standard.data(forKey: key) == nil)
    }
}
