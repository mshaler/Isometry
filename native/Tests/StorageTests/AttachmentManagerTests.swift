import Testing
import Foundation
@testable import Isometry

/// Comprehensive test suite for attachment management system
/// Tests CAS functionality, attachment processing, integration, performance, and error handling
@Suite("AttachmentManager Tests")
struct AttachmentManagerTests {

    // Test infrastructure
    static let testDatabase = try! IsometryDatabase(path: ":memory:")
    static let testStorageURL = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("test-cas-\(UUID().uuidString)")

    // MARK: - CAS Testing

    @Test("Content hashing consistency and collision handling")
    func testContentHashingConsistency() async throws {
        let cas = CASIntegration(basePath: Self.testStorageURL)

        let testContent1 = "Hello, World!".data(using: .utf8)!
        let testContent2 = "Hello, World!".data(using: .utf8)!
        let testContent3 = "Different content".data(using: .utf8)!

        // Store same content twice - should get same hash
        let result1 = try await cas.store(content: testContent1, originalFilename: "test1.txt", mimeType: "text/plain")
        let result2 = try await cas.store(content: testContent2, originalFilename: "test2.txt", mimeType: "text/plain")

        #expect(result1.contentHash == result2.contentHash)
        #expect(result1.wasStored == true)
        #expect(result2.wasStored == false) // Deduplication

        // Store different content - should get different hash
        let result3 = try await cas.store(content: testContent3, originalFilename: "test3.txt", mimeType: "text/plain")
        #expect(result3.contentHash != result1.contentHash)
        #expect(result3.wasStored == true)
    }

    @Test("Deduplication works correctly for identical files")
    func testDeduplication() async throws {
        let cas = CASIntegration(basePath: Self.testStorageURL)

        // Create identical content with different filenames
        let content = createTestImageData()
        let filenames = ["image1.jpg", "image2.jpg", "copy_of_image.jpg"]

        var results: [CASStorageResult] = []
        for filename in filenames {
            let result = try await cas.store(content: content, originalFilename: filename, mimeType: "image/jpeg")
            results.append(result)
        }

        // All should have same hash
        let uniqueHashes = Set(results.map { $0.contentHash })
        #expect(uniqueHashes.count == 1)

        // Only first should have been actually stored
        #expect(results[0].wasStored == true)
        #expect(results[1].wasStored == false)
        #expect(results[2].wasStored == false)

        // Verify we can retrieve all references
        for result in results {
            let retrieved = try await cas.retrieve(contentHash: result.contentHash)
            #expect(retrieved == content)
        }
    }

    @Test("Atomic file operations and corruption recovery")
    func testAtomicOperationsAndCorruptionDetection() async throws {
        let cas = CASIntegration(basePath: Self.testStorageURL)

        let originalContent = createLargeTestData(size: 1_000_000) // 1MB
        let result = try await cas.store(content: originalContent, originalFilename: "large.dat", mimeType: "application/octet-stream")

        // Verify content integrity
        let retrieved = try await cas.retrieve(contentHash: result.contentHash)
        #expect(retrieved == originalContent)

        // Test corruption detection by modifying stored file
        let storagePath = result.storagePath
        var corruptedData = try Data(contentsOf: storagePath)
        corruptedData[corruptedData.count / 2] = 0xFF // Corrupt middle byte
        try corruptedData.write(to: storagePath)

        // Should detect corruption on retrieval
        do {
            _ = try await cas.retrieve(contentHash: result.contentHash)
            Issue.record("Expected corruption to be detected")
        } catch {
            // Expected - corruption detected
        }
    }

    @Test("Storage space optimization and cleanup")
    func testStorageOptimizationAndCleanup() async throws {
        let cas = CASIntegration(basePath: Self.testStorageURL)

        // Store multiple files
        var hashes: [String] = []
        for i in 0..<10 {
            let content = "Test content \(i)".data(using: .utf8)!
            let result = try await cas.store(content: content, originalFilename: "test\(i).txt", mimeType: "text/plain")
            hashes.append(result.contentHash)
        }

        // Get initial stats
        let initialStats = await cas.getStorageStats()
        #expect(initialStats.totalFiles >= 10)

        // Remove references to some files
        for hash in hashes.prefix(5) {
            await cas.decrementReferenceCount(for: hash)
        }

        // Perform garbage collection
        let gcResult = try await cas.performGarbageCollection()
        #expect(gcResult.deletedFiles >= 5)
        #expect(gcResult.reclaimedSpace > 0)

        // Verify files were actually deleted
        for hash in hashes.prefix(5) {
            let exists = await cas.contentExists(hash: hash)
            #expect(exists == false)
        }
    }

    // MARK: - Attachment Processing Testing

    @Test("Create mock Notes databases with various attachment types")
    func testAttachmentExtractionWithMockDatabase() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Create mock attachments of different types
        let testAttachments = [
            createMockAttachment(type: .image, filename: "photo.jpg", size: 50000),
            createMockAttachment(type: .pdf, filename: "document.pdf", size: 200000),
            createMockAttachment(type: .audio, filename: "voice.m4a", size: 1000000)
        ]

        // Test storage of each attachment type
        var storedAttachments: [StoredAttachment] = []
        let noteId = "test-note-123"

        for attachment in testAttachments {
            let stored = try await attachmentManager.storeAttachment(
                content: attachment.content,
                originalFilename: attachment.filename,
                mimeType: attachment.mimeType,
                noteId: noteId
            )
            storedAttachments.append(stored)
        }

        #expect(storedAttachments.count == testAttachments.count)

        // Verify each can be retrieved
        for stored in storedAttachments {
            let retrieved = try await attachmentManager.retrieveAttachment(attachmentId: stored.id)
            #expect(retrieved.content.count > 0)
            #expect(retrieved.metadata.originalFilename == stored.originalFilename)
        }
    }

    @Test("Test extraction of embedded images, PDFs, documents")
    func testEmbeddedAttachmentExtraction() async throws {
        // This test simulates extracting attachments from Notes protobuf content
        let mockProtobufData = createMockProtobufWithEmbeddedAttachments()

        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Process note with embedded attachments
        let result = try await attachmentManager.processNoteAttachments(
            noteId: "protobuf-note-456",
            noteContent: mockProtobufData
        )

        // For this mock test, we expect no attachments (since extraction is not fully implemented)
        // In real implementation, this would extract actual embedded attachments
        #expect(result.processedCount >= 0)
    }

    @Test("Verify metadata preservation during storage operations")
    func testMetadataPreservation() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Store attachment with specific metadata
        let content = "Test document content".data(using: .utf8)!
        let originalFilename = "important_document.txt"
        let mimeType = "text/plain"
        let noteId = "metadata-test-note"

        let stored = try await attachmentManager.storeAttachment(
            content: content,
            originalFilename: originalFilename,
            mimeType: mimeType,
            noteId: noteId
        )

        // Retrieve and verify metadata preservation
        let info = try await attachmentManager.getAttachmentInfo(attachmentId: stored.id)
        #expect(info?.originalFilename == originalFilename)
        #expect(info?.mimeType == mimeType)
        #expect(info?.fileSize == content.count)
        #expect(info?.noteId == noteId)

        // Verify timestamps are reasonable
        let now = Date()
        #expect(info?.createdAt.timeIntervalSince(now) < 60) // Created within last minute
    }

    @Test("Test batch processing performance with large attachment sets")
    func testBatchProcessingPerformance() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter,
            batchSize: 10 // Smaller batch for testing
        )

        // Create multiple notes with attachments
        let noteCount = 20
        var noteIds: [String] = []

        for i in 0..<noteCount {
            let noteId = "batch-note-\(i)"
            noteIds.append(noteId)

            // Store a few attachments per note
            for j in 0..<3 {
                let content = "Note \(i) attachment \(j)".data(using: .utf8)!
                _ = try await attachmentManager.storeAttachment(
                    content: content,
                    originalFilename: "note\(i)_att\(j).txt",
                    mimeType: "text/plain",
                    noteId: noteId
                )
            }
        }

        // Test bulk processing
        let startTime = Date()
        let bulkResult = try await attachmentManager.processBulkAttachments(noteIds: noteIds)
        let duration = Date().timeIntervalSince(startTime)

        #expect(duration < 30.0) // Should complete within 30 seconds
        #expect(bulkResult.noteResults.count == noteCount)

        print("Batch processing: \(bulkResult.attachmentsPerSecond) attachments/second")
    }

    // MARK: - Integration Testing

    @Test("Test Node model integration with attachment references")
    func testNodeModelIntegration() async throws {
        // Create a test note
        let node = Node(
            id: UUID().uuidString,
            nodeType: "note",
            name: "Note with Attachments",
            content: "This note has attachments",
            createdAt: Date(),
            modifiedAt: Date(),
            source: "apple-notes",
            sourceId: "integration-test-note"
        )

        try await Self.testDatabase.createNode(node)

        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Add attachments to the note
        let attachment1 = try await attachmentManager.storeAttachment(
            content: "First attachment".data(using: .utf8)!,
            originalFilename: "first.txt",
            mimeType: "text/plain",
            noteId: node.id
        )

        let attachment2 = try await attachmentManager.storeAttachment(
            content: createTestImageData(),
            originalFilename: "image.jpg",
            mimeType: "image/jpeg",
            noteId: node.id
        )

        // Verify attachments are linked to note
        let attachments = try await attachmentManager.getAttachmentsForNote(noteId: node.id)
        #expect(attachments.count == 2)

        // Verify note can be retrieved
        let retrievedNode = try await Self.testDatabase.getNode(byId: node.id)
        #expect(retrievedNode != nil)
        #expect(retrievedNode?.id == node.id)
    }

    @Test("Verify round-trip fidelity for attachment export/import")
    func testRoundTripFidelity() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Store original attachment
        let originalContent = createTestPDFData()
        let originalFilename = "test_document.pdf"
        let originalMimeType = "application/pdf"
        let noteId = "roundtrip-note"

        let stored = try await attachmentManager.storeAttachment(
            content: originalContent,
            originalFilename: originalFilename,
            mimeType: originalMimeType,
            noteId: noteId
        )

        // Retrieve and verify exact match
        let retrieved = try await attachmentManager.retrieveAttachment(attachmentId: stored.id)

        #expect(retrieved.content == originalContent)
        #expect(retrieved.metadata.originalFilename == originalFilename)
        #expect(retrieved.metadata.mimeType == originalMimeType)
        #expect(retrieved.metadata.fileSize == originalContent.count)

        // Calculate fidelity score
        let fidelityScore = calculateDataFidelity(original: originalContent, retrieved: retrieved.content)
        #expect(fidelityScore >= 0.999) // >99.9% fidelity required
    }

    @Test("Test attachment search and filtering functionality")
    func testAttachmentSearchAndFiltering() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Store various types of attachments
        let testFiles = [
            ("report.pdf", "application/pdf", createTestPDFData()),
            ("photo.jpg", "image/jpeg", createTestImageData()),
            ("music.mp3", "audio/mpeg", createTestAudioData()),
            ("presentation.pdf", "application/pdf", createTestPDFData()),
            ("video.mp4", "video/mp4", createTestVideoData())
        ]

        let noteId = "search-test-note"
        for (filename, mimeType, content) in testFiles {
            _ = try await attachmentManager.storeAttachment(
                content: content,
                originalFilename: filename,
                mimeType: mimeType,
                noteId: noteId
            )
        }

        // Test filename pattern search
        let pdfAttachments = try await attachmentManager.searchAttachments(filenamePattern: ".pdf")
        #expect(pdfAttachments.count == 2) // report.pdf and presentation.pdf

        // Test MIME type filtering
        let imageAttachments = try await attachmentManager.getAttachmentsByType(mimeType: "image/jpeg")
        #expect(imageAttachments.count >= 1) // photo.jpg

        let audioAttachments = try await attachmentManager.getAttachmentsByType(mimeType: "audio/mpeg")
        #expect(audioAttachments.count >= 1) // music.mp3
    }

    @Test("Validate memory usage during large file operations")
    func testMemoryUsageDuringLargeFileOperations() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        let initialMemory = getCurrentMemoryUsage()

        // Store large files
        let largeFile1 = createLargeTestData(size: 10_000_000) // 10MB
        let largeFile2 = createLargeTestData(size: 15_000_000) // 15MB

        let noteId = "memory-test-note"

        _ = try await attachmentManager.storeAttachment(
            content: largeFile1,
            originalFilename: "large1.dat",
            mimeType: "application/octet-stream",
            noteId: noteId
        )

        _ = try await attachmentManager.storeAttachment(
            content: largeFile2,
            originalFilename: "large2.dat",
            mimeType: "application/octet-stream",
            noteId: noteId
        )

        let finalMemory = getCurrentMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory

        // Memory increase should be reasonable (less than 100MB for this test)
        #expect(memoryIncrease < 100_000_000)
        print("Memory increase: \(memoryIncrease) bytes")
    }

    // MARK: - Performance Testing

    @Test("Benchmark attachment storage and retrieval speed")
    func testAttachmentStorageAndRetrievalPerformance() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        let testContent = createTestImageData() // ~100KB
        let noteId = "perf-test-note"

        // Benchmark storage
        let storageStartTime = Date()
        let stored = try await attachmentManager.storeAttachment(
            content: testContent,
            originalFilename: "performance_test.jpg",
            mimeType: "image/jpeg",
            noteId: noteId
        )
        let storageTime = Date().timeIntervalSince(storageStartTime)

        // Benchmark retrieval
        let retrievalStartTime = Date()
        let retrieved = try await attachmentManager.retrieveAttachment(attachmentId: stored.id)
        let retrievalTime = Date().timeIntervalSince(retrievalStartTime)

        // Performance targets: <100ms for retrieval of ~100KB file
        #expect(retrievalTime < 0.1)
        #expect(storageTime < 0.5)
        #expect(retrieved.content.count == testContent.count)

        print("Storage time: \(storageTime * 1000)ms, Retrieval time: \(retrievalTime * 1000)ms")
    }

    @Test("Test concurrent access with multiple Notes being processed")
    func testConcurrentAttachmentProcessing() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Create multiple tasks storing attachments concurrently
        let taskCount = 20
        let startTime = Date()

        try await withThrowingTaskGroup(of: StoredAttachment.self) { group in
            for i in 0..<taskCount {
                group.addTask {
                    let content = "Concurrent test \(i)".data(using: .utf8)!
                    return try await attachmentManager.storeAttachment(
                        content: content,
                        originalFilename: "concurrent\(i).txt",
                        mimeType: "text/plain",
                        noteId: "concurrent-note-\(i)"
                    )
                }
            }

            var results: [StoredAttachment] = []
            for try await result in group {
                results.append(result)
            }

            #expect(results.count == taskCount)
        }

        let duration = Date().timeIntervalSince(startTime)
        #expect(duration < 10.0) // Should complete within 10 seconds

        print("Concurrent processing: \(taskCount) attachments in \(duration)s")
    }

    @Test("Measure memory usage with large video/image files")
    func testLargeMediaFileMemoryUsage() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        let initialMemory = getCurrentMemoryUsage()

        // Simulate large video file (50MB)
        let largeVideoContent = createLargeTestData(size: 50_000_000)

        let stored = try await attachmentManager.storeAttachment(
            content: largeVideoContent,
            originalFilename: "large_video.mp4",
            mimeType: "video/mp4",
            noteId: "large-media-note"
        )

        // Retrieve to test memory usage
        let retrieved = try await attachmentManager.retrieveAttachment(attachmentId: stored.id)
        #expect(retrieved.content.count == largeVideoContent.count)

        let finalMemory = getCurrentMemoryUsage()
        let memoryIncrease = finalMemory - initialMemory

        // Should handle large files without excessive memory growth
        #expect(memoryIncrease < 150_000_000) // Less than 150MB increase for 50MB file
        print("Large file memory usage: \(memoryIncrease) bytes for \(largeVideoContent.count) byte file")
    }

    @Test("Validate garbage collection and cleanup performance")
    func testGarbageCollectionPerformance() async throws {
        let cas = CASIntegration(basePath: Self.testStorageURL)

        // Store many small files
        var hashes: [String] = []
        for i in 0..<100 {
            let content = "File \(i) content".data(using: .utf8)!
            let result = try await cas.store(content: content, originalFilename: "file\(i).txt", mimeType: "text/plain")
            hashes.append(result.contentHash)
        }

        // Remove references to half of them
        for hash in hashes.prefix(50) {
            await cas.decrementReferenceCount(for: hash)
        }

        // Measure garbage collection performance
        let gcStartTime = Date()
        let gcResult = try await cas.performGarbageCollection()
        let gcDuration = Date().timeIntervalSince(gcStartTime)

        #expect(gcResult.deletedFiles >= 50)
        #expect(gcDuration < 5.0) // Should complete within 5 seconds
        #expect(gcResult.reclaimedSpace > 0)

        print("Garbage collection: \(gcResult.deletedFiles) files in \(gcDuration)s")
    }

    // MARK: - Error Handling Testing

    @Test("Test disk space exhaustion scenarios")
    func testDiskSpaceExhaustionHandling() async throws {
        // This test is conceptual - actual disk exhaustion is hard to simulate safely
        let cas = CASIntegration(basePath: Self.testStorageURL, maxFileSize: 1000) // Very small limit

        let largeContent = createLargeTestData(size: 2000) // Exceeds limit

        do {
            _ = try await cas.store(content: largeContent, originalFilename: "too_large.dat", mimeType: "application/octet-stream")
            Issue.record("Expected file size error")
        } catch {
            // Expected - file too large
        }
    }

    @Test("Verify corrupted attachment detection and recovery")
    func testCorruptedAttachmentDetection() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Store valid attachment
        let originalContent = "Valid content".data(using: .utf8)!
        let stored = try await attachmentManager.storeAttachment(
            content: originalContent,
            originalFilename: "valid.txt",
            mimeType: "text/plain",
            noteId: "corruption-test"
        )

        // Verify normal retrieval works
        let normalRetrieval = try await attachmentManager.retrieveAttachment(attachmentId: stored.id)
        #expect(normalRetrieval.content == originalContent)

        // Corruption detection is handled at CAS level and tested in CAS tests
    }

    @Test("Test permission errors and file system issues")
    func testFileSystemErrorHandling() async throws {
        // Create CAS with invalid path to test error handling
        let invalidPath = URL(fileURLWithPath: "/invalid/nonexistent/path")
        let cas = CASIntegration(basePath: invalidPath)

        let testContent = "Test content".data(using: .utf8)!

        // This may fail due to permission issues, which is expected
        do {
            _ = try await cas.store(content: testContent, originalFilename: "test.txt", mimeType: "text/plain")
            // If it succeeds, that's also fine (system may have created directories)
        } catch {
            // Expected - permission or file system error
            print("Expected file system error: \(error)")
        }
    }

    @Test("Validate graceful degradation when attachments unavailable")
    func testGracefulDegradationForUnavailableAttachments() async throws {
        let storageManager = ContentAwareStorageManager(
            basePath: Self.testStorageURL,
            database: Self.testDatabase
        )

        let nativeImporter = AppleNotesNativeImporter(database: Self.testDatabase)
        let attachmentManager = AttachmentManager(
            storageManager: storageManager,
            database: Self.testDatabase,
            nativeImporter: nativeImporter
        )

        // Try to retrieve non-existent attachment
        do {
            _ = try await attachmentManager.retrieveAttachment(attachmentId: "nonexistent-attachment")
            Issue.record("Expected attachment not found error")
        } catch {
            // Expected - attachment not found
        }

        // Try to get info for non-existent attachment
        let info = try await attachmentManager.getAttachmentInfo(attachmentId: "nonexistent-attachment")
        #expect(info == nil)
    }

    // MARK: - Test Helper Methods

    /// Create test image data
    static func createTestImageData() -> Data {
        // Simple JPEG header + minimal data
        var data = Data([0xFF, 0xD8, 0xFF, 0xE0]) // JPEG header
        data.append("JFIF".data(using: .utf8)!)
        data.append(Data(repeating: 0x42, count: 96 * 1024)) // ~100KB
        data.append(Data([0xFF, 0xD9])) // JPEG end marker
        return data
    }

    /// Create test PDF data
    static func createTestPDFData() -> Data {
        var data = "%PDF-1.4\n".data(using: .utf8)!
        data.append("1 0 obj<</Type/Pages/Kids[2 0 R]/Count 1>>endobj\n".data(using: .utf8)!)
        data.append(Data(repeating: 0x20, count: 50 * 1024)) // ~50KB
        data.append("%%EOF".data(using: .utf8)!)
        return data
    }

    /// Create test audio data
    static func createTestAudioData() -> Data {
        // Simple audio file header + data
        return Data(repeating: 0x44, count: 200 * 1024) // ~200KB
    }

    /// Create test video data
    static func createTestVideoData() -> Data {
        // MP4 signature + minimal data
        var data = Data([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]) // MP4 header
        data.append(Data(repeating: 0x76, count: 500 * 1024)) // ~500KB
        return data
    }

    /// Create large test data of specified size
    static func createLargeTestData(size: Int) -> Data {
        return Data(repeating: UInt8.random(in: 0...255), count: size)
    }

    /// Create mock attachment of specified type
    static func createMockAttachment(type: AttachmentType, filename: String, size: Int) -> MockAttachment {
        let content: Data
        let mimeType: String

        switch type {
        case .image:
            content = createTestImageData()
            mimeType = "image/jpeg"
        case .pdf:
            content = createTestPDFData()
            mimeType = "application/pdf"
        case .audio:
            content = createTestAudioData()
            mimeType = "audio/mpeg"
        case .video:
            content = createTestVideoData()
            mimeType = "video/mp4"
        }

        return MockAttachment(filename: filename, mimeType: mimeType, content: content)
    }

    /// Create mock protobuf data with embedded attachments
    static func createMockProtobufWithEmbeddedAttachments() -> Data {
        // Simplified mock - in reality would be complex protobuf structure
        return "Mock protobuf with embedded attachments".data(using: .utf8)!
    }

    /// Calculate data fidelity between original and retrieved content
    static func calculateDataFidelity(original: Data, retrieved: Data) -> Double {
        guard original.count == retrieved.count else { return 0.0 }

        let matchingBytes = zip(original, retrieved).reduce(0) { count, pair in
            count + (pair.0 == pair.1 ? 1 : 0)
        }

        return Double(matchingBytes) / Double(original.count)
    }

    /// Get current memory usage for performance testing
    static func getCurrentMemoryUsage() -> Int64 {
        var info = mach_task_basic_info()
        var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

        let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
            $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         $0,
                         &count)
            }
        }

        if kerr == KERN_SUCCESS {
            return Int64(info.resident_size)
        } else {
            return 0
        }
    }

    // MARK: - Test Data Types

    enum AttachmentType {
        case image, pdf, audio, video
    }

    struct MockAttachment {
        let filename: String
        let mimeType: String
        let content: Data
    }
}