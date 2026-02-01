import Foundation

// MARK: - Import Result

/// Result of an import operation containing success/failure counts and imported nodes
public struct ImportResult: Sendable {
    public var imported: Int = 0
    public var failed: Int = 0
    public var nodes: [Node] = []
    public var errors: [ImportError] = []

    public var total: Int { imported + failed }

    public init() {}

    public init(imported: Int = 0, failed: Int = 0, nodes: [Node] = [], errors: [ImportError] = []) {
        self.imported = imported
        self.failed = failed
        self.nodes = nodes
        self.errors = errors
    }

    /// Combines multiple ImportResults into one
    public static func combine(_ results: [ImportResult]) -> ImportResult {
        var combined = ImportResult()
        for result in results {
            combined.imported += result.imported
            combined.failed += result.failed
            combined.nodes.append(contentsOf: result.nodes)
            combined.errors.append(contentsOf: result.errors)
        }
        return combined
    }
}

// MARK: - Import Error

/// Errors that can occur during import operations
public enum ImportError: Error, Sendable {
    // General import errors
    case directoryNotFound(String)
    case fileFailed(String, Error)
    case invalidFormat(String)

    // Apple Notes import errors
    case appleNotesDirectoryNotFound(String)
    case appleNotesFileFailed(String, Error)
    case appleNotesInvalidFormat(String)

    // Web clipper errors
    case webClipperNetworkUnavailable
    case webClipperInvalidURL(String)
    case webClipperExtractionFailed(String, Error)
    case webClipperContentFailed
    case webClipperMetadataFailed
    case webClipperRobotsBlocked(String)

    // Office document import errors
    case officeDocumentUnsupportedFormat(String)
    case officeDocumentCorrupted(String)
    case officeDocumentPasswordProtected(String)

    // JSON import errors
    case jsonInvalidStructure(String)
    case jsonMissingRequiredField(String, String)

    // SQLite import errors
    case sqliteConnectionFailed(String)
    case sqliteInvalidSchema(String)
    case sqliteMigrationFailed(String)

    // Universal markdown import errors
    case markdownParsingFailed(String, Error)
    case markdownInvalidFrontmatter(String)
}

extension ImportError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        // General import errors
        case .directoryNotFound(let path):
            return "Directory not found: \(path)"
        case .fileFailed(let filename, let error):
            return "Failed to import \(filename): \(error.localizedDescription)"
        case .invalidFormat(let details):
            return "Invalid format: \(details)"

        // Apple Notes import errors
        case .appleNotesDirectoryNotFound(let path):
            return "Apple Notes directory not found: \(path)"
        case .appleNotesFileFailed(let filename, let error):
            return "Failed to import Apple Notes file \(filename): \(error.localizedDescription)"
        case .appleNotesInvalidFormat(let details):
            return "Invalid Apple Notes format: \(details)"

        // Web clipper errors
        case .webClipperNetworkUnavailable:
            return "Network connection unavailable for web clipping"
        case .webClipperInvalidURL(let url):
            return "Invalid URL for web clipping: \(url)"
        case .webClipperExtractionFailed(let url, let error):
            return "Failed to extract content from \(url): \(error.localizedDescription)"
        case .webClipperContentFailed:
            return "Failed to extract page content"
        case .webClipperMetadataFailed:
            return "Failed to extract page metadata"
        case .webClipperRobotsBlocked(let url):
            return "Content extraction blocked by robots.txt for \(url)"

        // Office document import errors
        case .officeDocumentUnsupportedFormat(let format):
            return "Unsupported office document format: \(format)"
        case .officeDocumentCorrupted(let filename):
            return "Office document appears corrupted: \(filename)"
        case .officeDocumentPasswordProtected(let filename):
            return "Office document is password protected: \(filename)"

        // JSON import errors
        case .jsonInvalidStructure(let details):
            return "Invalid JSON structure: \(details)"
        case .jsonMissingRequiredField(let field, let filename):
            return "Missing required field '\(field)' in JSON file: \(filename)"

        // SQLite import errors
        case .sqliteConnectionFailed(let path):
            return "Failed to connect to SQLite database: \(path)"
        case .sqliteInvalidSchema(let details):
            return "Invalid SQLite schema: \(details)"
        case .sqliteMigrationFailed(let details):
            return "SQLite migration failed: \(details)"

        // Universal markdown import errors
        case .markdownParsingFailed(let filename, let error):
            return "Failed to parse markdown file \(filename): \(error.localizedDescription)"
        case .markdownInvalidFrontmatter(let filename):
            return "Invalid frontmatter in markdown file: \(filename)"
        }
    }
}