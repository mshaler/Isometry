/**
 * NotesAdapter - Alto-index export file delegation to JavaScript ETL
 *
 * Actor-based adapter that delegates markdown file parsing to the JavaScript
 * ETL pipeline via ETLBridge. This avoids duplicating gray-matter and marked
 * parsing logic in Swift.
 *
 * Usage:
 * ```swift
 * let bridge = ETLBridge(webView: webView)
 * let adapter = NotesAdapter(etlBridge: bridge)
 * let summary = try await adapter.importNotesExport(from: exportDirectoryURL)
 * print("Imported \(summary.imported) notes")
 * ```
 *
 * Thread Safety:
 * - Actor isolation ensures all state access is serialized
 * - FileManager operations are thread-safe
 * - ETLBridge is an actor (thread-safe)
 *
 * Note: Does NOT access Apple Notes directly (AppleScript TCC issues)
 * Uses alto-index exported markdown files instead.
 */

import Foundation

// MARK: - NotesError

/// Errors specific to notes adapter operations
public enum NotesError: Error, LocalizedError, Sendable {
    /// Export directory doesn't exist
    case directoryNotFound(String)

    /// No .md files found in directory
    case noFilesFound

    /// Some files failed to import
    case partialImportFailure(ImportSummary)

    /// File read error
    case fileReadFailed(String)

    public var errorDescription: String? {
        switch self {
        case .directoryNotFound(let path):
            return "Export directory not found: \(path)"
        case .noFilesFound:
            return "No markdown files found in export directory."
        case .partialImportFailure(let summary):
            return "Partial import: \(summary.imported)/\(summary.totalFiles) succeeded. Errors: \(summary.errors.joined(separator: "; "))"
        case .fileReadFailed(let path):
            return "Failed to read file: \(path)"
        }
    }

    /// Identifier for programmatic error handling
    public var code: String {
        switch self {
        case .directoryNotFound:
            return "NOTES_DIRECTORY_NOT_FOUND"
        case .noFilesFound:
            return "NOTES_NO_FILES_FOUND"
        case .partialImportFailure:
            return "NOTES_PARTIAL_FAILURE"
        case .fileReadFailed:
            return "NOTES_FILE_READ_FAILED"
        }
    }
}

// MARK: - ImportSummary

/// Summary of a batch import operation
public struct ImportSummary: Sendable, Equatable {
    /// Total number of files attempted
    public let totalFiles: Int

    /// Number of files successfully imported
    public let imported: Int

    /// Number of files that failed
    public let failed: Int

    /// Error messages from failed imports
    public let errors: [String]

    public init(totalFiles: Int, imported: Int, failed: Int, errors: [String]) {
        self.totalFiles = totalFiles
        self.imported = imported
        self.failed = failed
        self.errors = errors
    }

    /// Create an empty summary (no files processed)
    public static var empty: ImportSummary {
        ImportSummary(totalFiles: 0, imported: 0, failed: 0, errors: [])
    }

    /// Create summary for a single successful import
    public static func success(count: Int = 1) -> ImportSummary {
        ImportSummary(totalFiles: count, imported: count, failed: 0, errors: [])
    }

    /// Create summary for a single failed import
    public static func failure(error: String) -> ImportSummary {
        ImportSummary(totalFiles: 1, imported: 0, failed: 1, errors: [error])
    }
}

// MARK: - NotesAdapter

/// Actor-based adapter that delegates markdown parsing to JavaScript ETL pipeline.
/// Handles directory enumeration and aggregation of results.
@available(iOS 17.0, macOS 14.0, *)
public actor NotesAdapter {
    private let etlBridge: ETLBridge
    private let fileManager: FileManager

    /// Supported file extensions for import
    private let supportedExtensions = Set(["md", "markdown"])

    public init(etlBridge: ETLBridge, fileManager: FileManager = .default) {
        self.etlBridge = etlBridge
        self.fileManager = fileManager
    }

    // MARK: - Import Methods

    /// Import all markdown files from an alto-index export directory.
    ///
    /// Recursively enumerates the directory for .md/.markdown files and
    /// delegates each to the JavaScript ETL pipeline for parsing.
    ///
    /// - Parameter directoryURL: URL to the export directory
    /// - Returns: ImportSummary with counts and any errors
    /// - Throws: NotesError.directoryNotFound if directory doesn't exist,
    ///           NotesError.noFilesFound if no markdown files found
    public func importNotesExport(from directoryURL: URL) async throws -> ImportSummary {
        // Verify directory exists
        var isDirectory: ObjCBool = false
        guard fileManager.fileExists(atPath: directoryURL.path, isDirectory: &isDirectory),
              isDirectory.boolValue else {
            throw NotesError.directoryNotFound(directoryURL.path)
        }

        // Enumerate markdown files recursively
        let markdownFiles = try enumerateMarkdownFiles(in: directoryURL)

        guard !markdownFiles.isEmpty else {
            throw NotesError.noFilesFound
        }

        // Import each file
        var totalImported = 0
        var totalFailed = 0
        var errors: [String] = []

        for fileURL in markdownFiles {
            do {
                let result = try await importFile(fileURL)
                totalImported += result.nodeCount
            } catch {
                totalFailed += 1
                errors.append("\(fileURL.lastPathComponent): \(error.localizedDescription)")
            }
        }

        let summary = ImportSummary(
            totalFiles: markdownFiles.count,
            imported: totalImported,
            failed: totalFailed,
            errors: errors
        )

        // Throw if some files failed
        if totalFailed > 0 && totalImported > 0 {
            throw NotesError.partialImportFailure(summary)
        }

        return summary
    }

    /// Import a single markdown file via ETLBridge.
    ///
    /// Reads the file and delegates to JavaScript for parsing.
    /// The JavaScript ETL pipeline handles frontmatter extraction,
    /// markdown rendering, and database insertion.
    ///
    /// - Parameter url: URL to the markdown file
    /// - Returns: ETLImportResult with success status and node count
    /// - Throws: ETLBridgeError for various failure modes
    public func importFile(_ url: URL) async throws -> ETLImportResult {
        try await etlBridge.importFile(url)
    }

    /// Import raw markdown content with a filename.
    ///
    /// Use this when you have markdown content in memory rather than on disk.
    ///
    /// - Parameters:
    ///   - filename: Name of the file (used for node naming)
    ///   - content: Raw markdown content as Data
    /// - Returns: ETLImportResult with success status and node count
    /// - Throws: ETLBridgeError for various failure modes
    public func importContent(filename: String, content: Data) async throws -> ETLImportResult {
        try await etlBridge.importContent(filename: filename, content: content)
    }

    // MARK: - Private Helpers

    /// Enumerate all markdown files in a directory recursively.
    private func enumerateMarkdownFiles(in directoryURL: URL) throws -> [URL] {
        var markdownFiles: [URL] = []

        // Use enumerator for recursive traversal
        guard let enumerator = fileManager.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            throw NotesError.directoryNotFound(directoryURL.path)
        }

        for case let fileURL as URL in enumerator {
            // Check if it's a file with supported extension
            let fileExtension = fileURL.pathExtension.lowercased()
            if supportedExtensions.contains(fileExtension) {
                // Verify it's a regular file (not directory)
                if let resourceValues = try? fileURL.resourceValues(forKeys: [.isRegularFileKey]),
                   resourceValues.isRegularFile == true {
                    markdownFiles.append(fileURL)
                }
            }
        }

        return markdownFiles
    }
}

// MARK: - Testing Support

/// Mock notes import data for testing
public struct MockNotesImportData: Sendable {
    public let files: [(filename: String, content: String)]
    public let expectedImported: Int
    public let expectedFailed: Int

    public init(
        files: [(filename: String, content: String)],
        expectedImported: Int? = nil,
        expectedFailed: Int = 0
    ) {
        self.files = files
        self.expectedImported = expectedImported ?? files.count
        self.expectedFailed = expectedFailed
    }
}

/// Extension for creating expected ImportSummary from mock data
public extension ImportSummary {
    /// Create expected summary from mock import data
    static func fromMockData(_ mock: MockNotesImportData) -> ImportSummary {
        ImportSummary(
            totalFiles: mock.files.count,
            imported: mock.expectedImported,
            failed: mock.expectedFailed,
            errors: []
        )
    }
}
