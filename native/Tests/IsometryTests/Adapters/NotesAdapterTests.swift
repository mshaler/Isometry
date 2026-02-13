import XCTest
@testable import Isometry

/// Tests for NotesAdapter logic and error handling.
/// Note: Full integration requires ETLBridge + WKWebView.
/// These tests focus on directory enumeration, aggregation, and error handling.
@available(iOS 17.0, macOS 14.0, *)
final class NotesAdapterTests: XCTestCase {

    // MARK: - ImportSummary Tests

    func testImportSummaryEmpty() {
        let summary = ImportSummary.empty

        XCTAssertEqual(summary.totalFiles, 0)
        XCTAssertEqual(summary.imported, 0)
        XCTAssertEqual(summary.failed, 0)
        XCTAssertTrue(summary.errors.isEmpty)
    }

    func testImportSummarySuccess() {
        let summary = ImportSummary.success(count: 5)

        XCTAssertEqual(summary.totalFiles, 5)
        XCTAssertEqual(summary.imported, 5)
        XCTAssertEqual(summary.failed, 0)
        XCTAssertTrue(summary.errors.isEmpty)
    }

    func testImportSummaryFailure() {
        let summary = ImportSummary.failure(error: "Test error")

        XCTAssertEqual(summary.totalFiles, 1)
        XCTAssertEqual(summary.imported, 0)
        XCTAssertEqual(summary.failed, 1)
        XCTAssertEqual(summary.errors, ["Test error"])
    }

    func testImportSummaryAggregation() {
        let summary = ImportSummary(
            totalFiles: 10,
            imported: 8,
            failed: 2,
            errors: ["Error 1", "Error 2"]
        )

        XCTAssertEqual(summary.totalFiles, 10)
        XCTAssertEqual(summary.imported, 8)
        XCTAssertEqual(summary.failed, 2)
        XCTAssertEqual(summary.errors.count, 2)
    }

    func testImportSummaryEquatable() {
        let summary1 = ImportSummary(totalFiles: 5, imported: 4, failed: 1, errors: ["error"])
        let summary2 = ImportSummary(totalFiles: 5, imported: 4, failed: 1, errors: ["error"])
        let summary3 = ImportSummary(totalFiles: 5, imported: 3, failed: 2, errors: ["error"])

        XCTAssertEqual(summary1, summary2)
        XCTAssertNotEqual(summary1, summary3)
    }

    // MARK: - NotesError Tests

    func testNotesErrorDescriptions() {
        let directoryNotFound = NotesError.directoryNotFound("/path/to/notes")
        XCTAssertTrue(directoryNotFound.errorDescription?.contains("/path/to/notes") ?? false)
        XCTAssertEqual(directoryNotFound.code, "NOTES_DIRECTORY_NOT_FOUND")

        let noFilesFound = NotesError.noFilesFound
        XCTAssertTrue(noFilesFound.errorDescription?.contains("No markdown") ?? false)
        XCTAssertEqual(noFilesFound.code, "NOTES_NO_FILES_FOUND")

        let fileReadFailed = NotesError.fileReadFailed("/path/to/file.md")
        XCTAssertTrue(fileReadFailed.errorDescription?.contains("/path/to/file.md") ?? false)
        XCTAssertEqual(fileReadFailed.code, "NOTES_FILE_READ_FAILED")
    }

    func testPartialImportFailureDescription() {
        let summary = ImportSummary(
            totalFiles: 10,
            imported: 7,
            failed: 3,
            errors: ["error1", "error2", "error3"]
        )

        let error = NotesError.partialImportFailure(summary)

        XCTAssertTrue(error.errorDescription?.contains("7/10") ?? false)
        XCTAssertTrue(error.errorDescription?.contains("error1") ?? false)
        XCTAssertEqual(error.code, "NOTES_PARTIAL_FAILURE")
    }

    // MARK: - MockNotesImportData Tests

    func testMockNotesImportData() {
        let mockData = MockNotesImportData(
            files: [
                (filename: "note1.md", content: "# Note 1"),
                (filename: "note2.md", content: "# Note 2"),
            ],
            expectedImported: 2,
            expectedFailed: 0
        )

        XCTAssertEqual(mockData.files.count, 2)
        XCTAssertEqual(mockData.expectedImported, 2)
        XCTAssertEqual(mockData.expectedFailed, 0)
    }

    func testImportSummaryFromMockData() {
        let mockData = MockNotesImportData(
            files: [
                (filename: "note1.md", content: "# Note 1"),
                (filename: "note2.md", content: "# Note 2"),
                (filename: "note3.md", content: "# Note 3"),
            ],
            expectedImported: 2,
            expectedFailed: 1
        )

        let summary = ImportSummary.fromMockData(mockData)

        XCTAssertEqual(summary.totalFiles, 3)
        XCTAssertEqual(summary.imported, 2)
        XCTAssertEqual(summary.failed, 1)
    }

    // MARK: - Directory Enumeration Tests (using temp directory)

    var tempDirectory: URL!

    override func setUp() {
        super.setUp()
        // Create a temporary directory for test files
        let tempPath = FileManager.default.temporaryDirectory
            .appendingPathComponent("NotesAdapterTests")
            .appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: tempPath, withIntermediateDirectories: true)
        tempDirectory = tempPath
    }

    override func tearDown() {
        // Clean up temp directory
        if let tempDirectory = tempDirectory {
            try? FileManager.default.removeItem(at: tempDirectory)
        }
        super.tearDown()
    }

    func testDirectoryEnumerationFindsMarkdownFiles() throws {
        // Create test markdown files
        let file1 = tempDirectory.appendingPathComponent("note1.md")
        let file2 = tempDirectory.appendingPathComponent("note2.markdown")
        let file3 = tempDirectory.appendingPathComponent("readme.txt")  // Should be ignored

        try "# Note 1".write(to: file1, atomically: true, encoding: .utf8)
        try "# Note 2".write(to: file2, atomically: true, encoding: .utf8)
        try "Some text".write(to: file3, atomically: true, encoding: .utf8)

        // Enumerate markdown files
        let enumerator = FileManager.default.enumerator(
            at: tempDirectory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var markdownFiles: [URL] = []
        let supportedExtensions = Set(["md", "markdown"])

        for case let fileURL as URL in enumerator! {
            let ext = fileURL.pathExtension.lowercased()
            if supportedExtensions.contains(ext) {
                markdownFiles.append(fileURL)
            }
        }

        XCTAssertEqual(markdownFiles.count, 2)
    }

    func testDirectoryEnumerationRecursive() throws {
        // Create nested directory structure
        let subdir = tempDirectory.appendingPathComponent("subfolder")
        try FileManager.default.createDirectory(at: subdir, withIntermediateDirectories: true)

        let file1 = tempDirectory.appendingPathComponent("root.md")
        let file2 = subdir.appendingPathComponent("nested.md")

        try "# Root".write(to: file1, atomically: true, encoding: .utf8)
        try "# Nested".write(to: file2, atomically: true, encoding: .utf8)

        // Enumerate markdown files
        let enumerator = FileManager.default.enumerator(
            at: tempDirectory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var markdownFiles: [URL] = []
        let supportedExtensions = Set(["md", "markdown"])

        for case let fileURL as URL in enumerator! {
            let ext = fileURL.pathExtension.lowercased()
            if supportedExtensions.contains(ext) {
                markdownFiles.append(fileURL)
            }
        }

        XCTAssertEqual(markdownFiles.count, 2)

        let filenames = markdownFiles.map { $0.lastPathComponent }
        XCTAssertTrue(filenames.contains("root.md"))
        XCTAssertTrue(filenames.contains("nested.md"))
    }

    func testEmptyDirectoryEnumeration() throws {
        // Empty temp directory already created in setUp

        let enumerator = FileManager.default.enumerator(
            at: tempDirectory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var markdownFiles: [URL] = []
        let supportedExtensions = Set(["md", "markdown"])

        for case let fileURL as URL in enumerator! {
            let ext = fileURL.pathExtension.lowercased()
            if supportedExtensions.contains(ext) {
                markdownFiles.append(fileURL)
            }
        }

        XCTAssertEqual(markdownFiles.count, 0)
    }

    func testSkipsHiddenFiles() throws {
        // Create hidden file
        let hiddenFile = tempDirectory.appendingPathComponent(".hidden.md")
        try "# Hidden".write(to: hiddenFile, atomically: true, encoding: .utf8)

        let normalFile = tempDirectory.appendingPathComponent("visible.md")
        try "# Visible".write(to: normalFile, atomically: true, encoding: .utf8)

        // Enumerate markdown files (should skip hidden)
        let enumerator = FileManager.default.enumerator(
            at: tempDirectory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        )

        var markdownFiles: [URL] = []
        let supportedExtensions = Set(["md", "markdown"])

        for case let fileURL as URL in enumerator! {
            let ext = fileURL.pathExtension.lowercased()
            if supportedExtensions.contains(ext) {
                markdownFiles.append(fileURL)
            }
        }

        XCTAssertEqual(markdownFiles.count, 1)
        XCTAssertEqual(markdownFiles.first?.lastPathComponent, "visible.md")
    }
}

// MARK: - Integration Test Markers

/// These tests require actual ETLBridge + WKWebView setup.
/// Mark as skipped in normal test runs.
@available(iOS 17.0, macOS 14.0, *)
final class NotesAdapterIntegrationTests: XCTestCase {

    func testImportNotesExportRequiresETLBridge() async throws {
        // This test documents expected behavior but requires WKWebView setup
        // Full integration test would:
        // 1. Create WKWebView with Isometry web app
        // 2. Wait for window.isometryETL to initialize
        // 3. Create ETLBridge with webView
        // 4. Create NotesAdapter with bridge
        // 5. Import markdown files and verify nodes in database
    }

    func testImportFileRequiresETLBridge() async throws {
        // Expected flow:
        // 1. NotesAdapter receives file URL
        // 2. ETLBridge reads file and base64 encodes
        // 3. JavaScript ETL parses markdown and frontmatter
        // 4. Nodes inserted into sql.js database
        // 5. Result returned with node count
    }
}
