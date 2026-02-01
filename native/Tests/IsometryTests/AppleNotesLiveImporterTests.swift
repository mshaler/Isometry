import Testing
import Foundation
@testable import Isometry

/// Unit tests for AppleNotesLiveImporter integration
/// Verifies foundation functionality and compatibility with existing infrastructure
@Suite("AppleNotesLiveImporter Foundation Tests")
struct AppleNotesLiveImporterTests {

    // MARK: - Test Setup

    private func createTestDatabase() async throws -> IsometryDatabase {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("test-\(UUID().uuidString).sqlite")

        let database = try await IsometryDatabase(url: tempURL)
        return database
    }

    private func createTestMarkdownFile(content: String, filename: String = "test.md") -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let fileURL = tempDir.appendingPathComponent(filename)

        try? content.write(to: fileURL, atomically: true, encoding: .utf8)

        return fileURL
    }

    // MARK: - Initialization Tests

    @Test("Enhanced importer initializes properly")
    func testInitialization() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Verify initial state
        let status = await importer.currentSyncStatus
        #expect(status.isActive == false)

        let config = await importer.currentConfiguration
        #expect(config.isEnabled == false)

        let isActive = await importer.isLiveSyncActive
        #expect(isActive == false)
    }

    // MARK: - AltoIndexImporter Integration Tests

    @Test("Maintains AltoIndexImporter import functionality")
    func testAltoIndexImportIntegration() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Create test markdown file with YAML frontmatter
        let markdownContent = """
        ---
        title: "Test Note"
        id: "test-123"
        created: "2024-01-15T10:30:00Z"
        modified: "2024-01-15T11:45:00Z"
        folder: "Test Folder"
        attachments:
          - type: com.apple.notes.inlinetextattachment.hashtag
            content: "<a class=\"tag link\" href=\"/tags/test\">#test</a>"
        ---

        This is a test note with content.

        It has multiple lines and should be imported correctly.
        """

        let fileURL = createTestMarkdownFile(content: markdownContent, filename: "test-note.md")
        defer {
            try? FileManager.default.removeItem(at: fileURL)
        }

        // Test single note import
        let node = try await importer.importNote(from: fileURL)

        // Verify node properties
        #expect(node.name == "Test Note")
        #expect(node.sourceId == "test-123")
        #expect(node.folder == "Test Folder")
        #expect(node.tags.contains("test"))
        #expect(node.source == "apple-notes")
        #expect(node.content?.contains("This is a test note") == true)
    }

    @Test("Handles directory import via AltoIndexImporter")
    func testDirectoryImport() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Create test directory with multiple markdown files
        let tempDir = FileManager.default.temporaryDirectory.appendingPathComponent("test-notes")
        try FileManager.default.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer {
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Create test files
        let file1Content = """
        ---
        title: "Note 1"
        id: "note-1"
        ---
        Content of note 1
        """

        let file2Content = """
        ---
        title: "Note 2"
        id: "note-2"
        ---
        Content of note 2
        """

        try file1Content.write(to: tempDir.appendingPathComponent("note1.md"), atomically: true, encoding: .utf8)
        try file2Content.write(to: tempDir.appendingPathComponent("note2.md"), atomically: true, encoding: .utf8)

        // Test directory import
        let result = try await importer.importNotes(from: tempDir)

        #expect(result.imported == 2)
        #expect(result.failed == 0)
        #expect(result.nodes.count == 2)

        // Verify individual notes
        let note1 = result.nodes.first { $0.name == "Note 1" }
        let note2 = result.nodes.first { $0.name == "Note 2" }

        #expect(note1 != nil)
        #expect(note2 != nil)
        #expect(note1?.sourceId == "note-1")
        #expect(note2?.sourceId == "note-2")
    }

    // MARK: - Permission Manager Tests

    @Test("NotesAccessManager initializes properly")
    func testNotesAccessManagerInitialization() async throws {
        let accessManager = NotesAccessManager()

        // Test initial status check
        let status = await accessManager.checkCurrentPermissionStatus()
        #expect(status != nil) // Should return some status

        // Test access level determination
        let accessLevel = await accessManager.getAvailableAccessLevel()
        #expect(accessLevel != nil) // Should return some access level

        // Test permission messages
        let message = await accessManager.getPermissionStatusMessage()
        #expect(!message.isEmpty)

        let instructions = await accessManager.getPermissionInstructions()
        #expect(!instructions.isEmpty)
    }

    @Test("Permission manager provides privacy information")
    func testPrivacyInformation() async throws {
        let accessManager = NotesAccessManager()

        let privacyInfo = await accessManager.getPrivacyInformation()

        #expect(!privacyInfo.dataTypes.isEmpty)
        #expect(!privacyInfo.usageDescription.isEmpty)
        #expect(!privacyInfo.retentionPolicy.isEmpty)

        // Verify key privacy aspects are covered
        #expect(privacyInfo.usageDescription.contains("locally"))
        #expect(privacyInfo.retentionPolicy.contains("delete"))
    }

    // MARK: - Live Sync Configuration Tests

    @Test("Live sync configuration options work properly")
    func testLiveSyncConfiguration() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Test default configuration
        let defaultConfig = await importer.currentConfiguration
        #expect(defaultConfig.isEnabled == false)
        #expect(defaultConfig.syncInterval == 30.0)
        #expect(defaultConfig.batchSize == 100)

        // Test that we can't start live sync without proper configuration
        do {
            try await importer.startLiveSync(configuration: .default)
            #expect(Bool(false), "Should have thrown permission error")
        } catch {
            // Expected to fail due to permissions
            #expect(error is LiveSyncError)
        }
    }

    // MARK: - Performance Metrics Tests

    @Test("Performance metrics track operations properly")
    func testPerformanceMetrics() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        let initialMetrics = await importer.currentPerformanceMetrics
        #expect(initialMetrics.totalSyncCount == 0)
        #expect(initialMetrics.errorCount == 0)
        #expect(initialMetrics.incrementalSyncCount == 0)
        #expect(initialMetrics.fullSyncCount == 0)

        // Metrics should remain at zero since we haven't done any sync operations
        #expect(initialMetrics.lastSyncDuration == 0)
        #expect(initialMetrics.averageSyncDuration == 0)
        #expect(initialMetrics.notesProcessedPerSecond == 0)
    }

    // MARK: - ExportableImporterProtocol Conformance Tests

    @Test("Conforms to ExportableImporterProtocol properly")
    func testProtocolConformance() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Test protocol properties
        let extensions = await importer.supportedExtensions
        #expect(extensions.contains("md"))
        #expect(extensions.contains("markdown"))

        let name = await importer.importerName
        #expect(name == "AppleNotesLiveImporter")

        // Test data import functionality
        let testContent = """
        ---
        title: "Protocol Test"
        id: "protocol-test"
        ---
        Testing protocol conformance
        """

        let testData = testContent.data(using: .utf8)!
        let result = try await importer.importData(testData, filename: "protocol-test.md", folder: "test")

        #expect(result.imported == 1)
        #expect(result.failed == 0)
        #expect(result.nodes.count == 1)
        #expect(result.nodes.first?.name == "Protocol Test")
    }

    // MARK: - Integration with Database Tests

    @Test("Integrates properly with IsometryDatabase")
    func testDatabaseIntegration() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Import a test note
        let content = """
        ---
        title: "Database Integration Test"
        id: "db-test-123"
        created: "2024-01-15T10:00:00Z"
        ---
        Testing database integration
        """

        let fileURL = createTestMarkdownFile(content: content, filename: "db-test.md")
        defer {
            try? FileManager.default.removeItem(at: fileURL)
        }

        let node = try await importer.importNote(from: fileURL)

        // Verify node was created in database
        let retrievedNode = try await database.getNode(byId: node.id)
        #expect(retrievedNode != nil)
        #expect(retrievedNode?.name == "Database Integration Test")
        #expect(retrievedNode?.sourceId == "db-test-123")

        // Test that reimporting the same note updates instead of duplicating
        let updatedContent = """
        ---
        title: "Database Integration Test Updated"
        id: "db-test-123"
        created: "2024-01-15T10:00:00Z"
        modified: "2024-01-15T11:00:00Z"
        ---
        Testing database integration with updates
        """

        try updatedContent.write(to: fileURL, atomically: true, encoding: .utf8)
        let updatedNode = try await importer.importNote(from: fileURL)

        #expect(updatedNode.id == node.id) // Should be same node, updated
        #expect(updatedNode.name == "Database Integration Test Updated")
        #expect(updatedNode.content?.contains("with updates") == true)
    }

    // MARK: - Error Handling Tests

    @Test("Handles errors gracefully")
    func testErrorHandling() async throws {
        let database = try await createTestDatabase()
        let importer = AppleNotesLiveImporter(database: database)

        // Test importing non-existent file
        let nonExistentURL = URL(fileURLWithPath: "/tmp/non-existent-file.md")

        do {
            _ = try await importer.importNote(from: nonExistentURL)
            #expect(Bool(false), "Should have thrown an error for non-existent file")
        } catch {
            // Expected to fail
            #expect(error != nil)
        }

        // Test importing invalid content
        let invalidContent = Data([0xFF, 0xFE, 0x00, 0x00]) // Invalid UTF-8

        do {
            _ = try await importer.importData(invalidContent, filename: "invalid.md", folder: nil)
            #expect(Bool(false), "Should have thrown an error for invalid content")
        } catch {
            // Expected to fail
            #expect(error != nil)
        }
    }
}

/// Helper tests for NotesAccessManager specifically
@Suite("NotesAccessManager Tests")
struct NotesAccessManagerTests {

    @Test("Access level determination works correctly")
    func testAccessLevelDetermination() async throws {
        let manager = NotesAccessManager()

        // Test fallback method recommendation
        let fallback = await manager.getRecommendedFallbackMethod()
        #expect(!fallback.method.isEmpty)
        #expect(!fallback.instructions.isEmpty)

        // Instructions should mention alto-index as fallback
        let instructionText = fallback.instructions.joined(separator: " ")
        #expect(instructionText.lowercased().contains("alto"))
    }

    @Test("Permission callbacks can be managed")
    func testPermissionCallbacks() async throws {
        let manager = NotesAccessManager()

        // Test adding and clearing callbacks
        var callbackTriggered = false
        await manager.addPermissionChangeCallback { status in
            callbackTriggered = true
        }

        await manager.clearPermissionChangeCallbacks()

        // Verify callback management doesn't crash
        let status = await manager.checkCurrentPermissionStatus()
        #expect(status != nil)
    }
}

/// Helper tests for LiveSyncError enum
@Suite("LiveSyncError Tests")
struct LiveSyncErrorTests {

    @Test("LiveSyncError provides proper error descriptions")
    func testErrorDescriptions() {
        let errors: [LiveSyncError] = [
            .insufficientPermissions,
            .noAccessAvailable,
            .syncAlreadyRunning,
            .syncNotRunning
        ]

        for error in errors {
            #expect(!error.localizedDescription.isEmpty)
            #expect(error.errorDescription?.isEmpty == false)
        }
    }
}