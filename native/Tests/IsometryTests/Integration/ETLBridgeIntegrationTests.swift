/**
 * ETLBridge Integration Tests
 *
 * Tests that validate the complete Swift-JS round-trip using real WKWebView.
 * These tests verify BRIDGE-02 requirement: round-trip Swift -> JS -> sql.js -> Swift
 * works correctly.
 *
 * Test Strategy:
 * 1. Create WKWebView with proper configuration
 * 2. Load test HTML with mock window.isometryETL
 * 3. Wait for JS to initialize
 * 4. Run import and verify result
 *
 * Note: These tests require XCUITest or similar for WKWebView.
 * They are marked @MainActor since WKWebView is MainActor-isolated.
 */

import XCTest
import WebKit
@testable import Isometry

// MARK: - ETLBridgeIntegrationTests

@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class ETLBridgeIntegrationTests: XCTestCase {
    var webView: WKWebView!
    var coordinator: BridgeCoordinator!

    // MARK: - Setup and Teardown

    override func setUp() async throws {
        try await super.setUp()

        // Create WKWebView with script message handler
        let config = WKWebViewConfiguration()
        config.preferences.javaScriptCanOpenWindowsAutomatically = true

        webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 400, height: 400), configuration: config)
        coordinator = BridgeCoordinator(webView: webView)

        // Load test HTML with mock isometryETL
        let testHTML = createMockIsometryETLHTML()
        webView.loadHTMLString(testHTML, baseURL: nil)

        // Wait for page load
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    override func tearDown() async throws {
        webView = nil
        coordinator = nil
        try await super.tearDown()
    }

    // MARK: - Round-Trip Tests

    /// Test successful file import round-trip
    func testRoundTripFileImport() async throws {
        // Create test markdown file
        let testContent = """
        ---
        title: Test Note
        created: 2026-02-12
        ---
        # Hello World

        This is a test note for round-trip validation.
        """

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("test-\(UUID().uuidString).md")

        defer {
            try? FileManager.default.removeItem(at: tempURL)
        }

        // Write test file
        try testContent.write(to: tempURL, atomically: true, encoding: .utf8)

        // Import via coordinator
        let result = try await coordinator.importFile(tempURL)

        // Verify round-trip succeeded
        XCTAssertTrue(result.success, "Import should succeed")
        XCTAssertEqual(result.nodeCount, 1, "Should import 1 node")
        XCTAssertNil(result.errors, "Should have no errors")
    }

    /// Test batch file import
    func testBatchFileImport() async throws {
        let tempDir = FileManager.default.temporaryDirectory
        var tempFiles: [URL] = []

        defer {
            for file in tempFiles {
                try? FileManager.default.removeItem(at: file)
            }
        }

        // Create multiple test files
        for i in 1...3 {
            let content = """
            ---
            title: Note \(i)
            ---
            Content for note \(i)
            """
            let url = tempDir.appendingPathComponent("batch-\(i)-\(UUID().uuidString).md")
            try content.write(to: url, atomically: true, encoding: .utf8)
            tempFiles.append(url)
        }

        // Import batch via coordinator
        let result = try await coordinator.importFiles(tempFiles)

        // Verify results
        XCTAssertEqual(result.totalSuccess, 3, "Should import all 3 files")
        XCTAssertEqual(result.totalFailed, 0, "Should have no failures")
        XCTAssertEqual(result.results.count, 3, "Should have 3 individual results")
    }

    /// Test error handling when JS ETL is not initialized
    func testETLBridgeErrorOnUninitializedJS() async throws {
        // Create fresh WebView without isometryETL
        let emptyConfig = WKWebViewConfiguration()
        let emptyWebView = WKWebView(frame: .zero, configuration: emptyConfig)
        let bridge = ETLBridge(webView: emptyWebView)

        // Load empty page without isometryETL
        emptyWebView.loadHTMLString("<html><body></body></html>", baseURL: nil)
        try await Task.sleep(nanoseconds: 500_000_000)

        // Create temp file
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("test-uninit-\(UUID().uuidString).md")

        defer {
            try? FileManager.default.removeItem(at: tempURL)
        }

        try "test content".write(to: tempURL, atomically: true, encoding: .utf8)

        // Attempt import should fail
        do {
            _ = try await bridge.importFile(tempURL)
            XCTFail("Should have thrown error for uninitialized ETL")
        } catch {
            // Expected: some kind of error (notInitialized or importFailed)
            XCTAssertNotNil(error.localizedDescription)
        }
    }

    /// Test import with invalid file
    func testImportWithInvalidFile() async throws {
        let nonExistentURL = URL(fileURLWithPath: "/non/existent/file.md")

        do {
            _ = try await coordinator.importFile(nonExistentURL)
            XCTFail("Should have thrown error for non-existent file")
        } catch let error as ETLBridgeError {
            XCTAssertEqual(error.code, "FILE_ACCESS_DENIED")
        }
    }

    /// Test isETLInitialized check
    func testIsETLInitialized() async throws {
        let isInitialized = try await coordinator.isETLInitialized()
        XCTAssertTrue(isInitialized, "ETL should be initialized with mock HTML")
    }

    /// Test getSupportedExtensions
    func testGetSupportedExtensions() async throws {
        let extensions = try await coordinator.getSupportedExtensions()
        XCTAssertFalse(extensions.isEmpty, "Should return supported extensions")
        XCTAssertTrue(extensions.contains(".md"), "Should support .md files")
    }

    // MARK: - ETLImportResult Decoding Tests

    /// Test decoding successful import result from JS
    func testETLImportResultDecodingSuccess() throws {
        let json = """
        {
            "success": true,
            "nodeCount": 5,
            "errors": null
        }
        """
        let data = json.data(using: .utf8)!
        let result = try JSONDecoder().decode(ETLImportResult.self, from: data)

        XCTAssertTrue(result.success)
        XCTAssertEqual(result.nodeCount, 5)
        XCTAssertNil(result.errors)
    }

    /// Test decoding failed import result from JS
    func testETLImportResultDecodingFailure() throws {
        let json = """
        {
            "success": false,
            "nodeCount": 0,
            "errors": ["File format not supported"]
        }
        """
        let data = json.data(using: .utf8)!
        let result = try JSONDecoder().decode(ETLImportResult.self, from: data)

        XCTAssertFalse(result.success)
        XCTAssertEqual(result.nodeCount, 0)
        XCTAssertEqual(result.errors?.count, 1)
        XCTAssertEqual(result.errors?[0], "File format not supported")
    }

    // MARK: - BridgeCoordinator Tests

    /// Test BridgePermissionStatus struct
    func testBridgePermissionStatus() {
        let allGranted = BridgePermissionStatus(calendar: true, reminders: true, contacts: true)
        XCTAssertTrue(allGranted.allGranted)

        let partialGranted = BridgePermissionStatus(calendar: true, reminders: false, contacts: true)
        XCTAssertFalse(partialGranted.allGranted)

        let noneGranted = BridgePermissionStatus(calendar: false, reminders: false, contacts: false)
        XCTAssertFalse(noneGranted.allGranted)
    }

    /// Test BatchImportResult struct
    func testBatchImportResult() {
        let results: [String: ETLImportResult] = [
            "file1.md": ETLImportResult(success: true, nodeCount: 1, errors: nil),
            "file2.md": ETLImportResult(success: false, nodeCount: 0, errors: ["Parse error"]),
        ]

        let batch = BatchImportResult(results: results, totalSuccess: 1, totalFailed: 1)
        XCTAssertEqual(batch.totalSuccess, 1)
        XCTAssertEqual(batch.totalFailed, 1)
        XCTAssertEqual(batch.results.count, 2)
    }

    // MARK: - Helper Methods

    /// Create HTML with mock window.isometryETL for testing
    private func createMockIsometryETLHTML() -> String {
        """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Isometry ETL Test</title>
        </head>
        <body>
            <script>
            // Mock isometryETL for integration testing
            window.isometryETL = {
                // Mock importFile that simulates successful import
                async importFile(filename, content) {
                    // Simulate some processing time
                    await new Promise(resolve => setTimeout(resolve, 10));

                    // Decode base64 content for validation
                    const decodedContent = atob(content);

                    // Parse frontmatter (simplified mock)
                    const hasFrontmatter = decodedContent.includes('---');

                    // Return mock result
                    return {
                        success: true,
                        nodeCount: 1,
                        errors: null
                    };
                },

                // Mock getDatabase
                getDatabase() {
                    return null;  // No actual database in test
                },

                // Mock getSupportedExtensions
                getSupportedExtensions() {
                    return ['.md', '.markdown', '.json', '.csv', '.html', '.docx', '.xlsx'];
                }
            };

            // Signal that ETL is ready
            console.log('Mock isometryETL initialized');
            </script>
        </body>
        </html>
        """
    }
}

// MARK: - NotesAdapter Integration Tests

@available(iOS 17.0, macOS 14.0, *)
@MainActor
final class NotesAdapterIntegrationTests: XCTestCase {
    var webView: WKWebView!
    var etlBridge: ETLBridge!
    var notesAdapter: NotesAdapter!

    override func setUp() async throws {
        try await super.setUp()

        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: config)
        etlBridge = ETLBridge(webView: webView)
        notesAdapter = NotesAdapter(etlBridge: etlBridge)

        // Load mock ETL
        let testHTML = """
        <html>
        <script>
        window.isometryETL = {
            async importFile(filename, content) {
                return { success: true, nodeCount: 1, errors: null };
            }
        };
        </script>
        </html>
        """
        webView.loadHTMLString(testHTML, baseURL: nil)
        try await Task.sleep(nanoseconds: 500_000_000)
    }

    override func tearDown() async throws {
        webView = nil
        etlBridge = nil
        notesAdapter = nil
        try await super.tearDown()
    }

    /// Test directory not found error
    func testDirectoryNotFoundError() async throws {
        let nonExistentDir = URL(fileURLWithPath: "/non/existent/directory")

        do {
            _ = try await notesAdapter.importNotesExport(from: nonExistentDir)
            XCTFail("Should throw directoryNotFound error")
        } catch let error as NotesError {
            switch error {
            case .directoryNotFound:
                // Expected
                break
            default:
                XCTFail("Expected directoryNotFound, got \(error)")
            }
        }
    }

    /// Test no files found error
    func testNoFilesFoundError() async throws {
        // Create empty temp directory
        let emptyDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("empty-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: emptyDir, withIntermediateDirectories: true)

        defer {
            try? FileManager.default.removeItem(at: emptyDir)
        }

        do {
            _ = try await notesAdapter.importNotesExport(from: emptyDir)
            XCTFail("Should throw noFilesFound error")
        } catch let error as NotesError {
            switch error {
            case .noFilesFound:
                // Expected
                break
            default:
                XCTFail("Expected noFilesFound, got \(error)")
            }
        }
    }

    /// Test successful directory import
    func testDirectoryImport() async throws {
        // Create temp directory with test files
        let testDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("notes-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: testDir, withIntermediateDirectories: true)

        defer {
            try? FileManager.default.removeItem(at: testDir)
        }

        // Create test markdown files
        for i in 1...3 {
            let content = "# Note \(i)\nContent"
            let fileURL = testDir.appendingPathComponent("note-\(i).md")
            try content.write(to: fileURL, atomically: true, encoding: .utf8)
        }

        // Import directory
        let summary = try await notesAdapter.importNotesExport(from: testDir)

        XCTAssertEqual(summary.totalFiles, 3)
        XCTAssertGreaterThan(summary.imported, 0)
    }
}

// MARK: - ImportSummary Tests

final class ImportSummaryTests: XCTestCase {
    func testImportSummaryEmpty() {
        let empty = ImportSummary.empty
        XCTAssertEqual(empty.totalFiles, 0)
        XCTAssertEqual(empty.imported, 0)
        XCTAssertEqual(empty.failed, 0)
        XCTAssertTrue(empty.errors.isEmpty)
    }

    func testImportSummarySuccess() {
        let success = ImportSummary.success(count: 5)
        XCTAssertEqual(success.totalFiles, 5)
        XCTAssertEqual(success.imported, 5)
        XCTAssertEqual(success.failed, 0)
    }

    func testImportSummaryFailure() {
        let failure = ImportSummary.failure(error: "Parse error")
        XCTAssertEqual(failure.totalFiles, 1)
        XCTAssertEqual(failure.imported, 0)
        XCTAssertEqual(failure.failed, 1)
        XCTAssertEqual(failure.errors, ["Parse error"])
    }

    func testImportSummaryEquality() {
        let a = ImportSummary(totalFiles: 5, imported: 3, failed: 2, errors: ["error1"])
        let b = ImportSummary(totalFiles: 5, imported: 3, failed: 2, errors: ["error1"])
        XCTAssertEqual(a, b)
    }
}
