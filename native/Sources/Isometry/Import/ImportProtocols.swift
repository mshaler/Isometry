import Foundation

// MARK: - Core Import Protocols

/// Common interface that all importers implement
public protocol ImporterProtocol: Sendable {
    /// Import data from provided content
    func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult

    /// Import data from file URL
    func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult

    /// Get supported file extensions
    var supportedExtensions: [String] { get }

    /// Get importer name for reporting
    var importerName: String { get }
}

/// Enhanced protocol for importers that support export (round-trip testing)
public protocol ExportableImporterProtocol: ImporterProtocol {
    /// Export nodes to the original format for round-trip validation
    func exportNodes(_ nodes: [Node], to url: URL) async throws -> Data

    /// Verify data integrity after round-trip (format-specific validation)
    func validateRoundTripData(original: Data, exported: Data) async throws -> RoundTripValidationResult
}

/// Result of round-trip validation with detailed metrics
public struct RoundTripValidationResult {
    public let preservationAccuracy: Double // 0.0 to 1.0
    public let latchMappingAccuracy: Double // 0.0 to 1.0
    public let contentIntegrityScore: Double // 0.0 to 1.0
    public let schemaConformanceScore: Double // 0.0 to 1.0
    public let acceptableLosses: [String] // Expected data losses (e.g., "timestamp precision")
    public let unexpectedDifferences: [String] // Unexpected differences
    public let detailedReport: String

    public var overallScore: Double {
        (preservationAccuracy + latchMappingAccuracy + contentIntegrityScore + schemaConformanceScore) / 4.0
    }

    public var isAcceptable: Bool {
        preservationAccuracy >= 0.999 && latchMappingAccuracy >= 0.95 && unexpectedDifferences.isEmpty
    }

    public init(
        preservationAccuracy: Double,
        latchMappingAccuracy: Double,
        contentIntegrityScore: Double,
        schemaConformanceScore: Double,
        acceptableLosses: [String] = [],
        unexpectedDifferences: [String] = [],
        detailedReport: String
    ) {
        self.preservationAccuracy = preservationAccuracy
        self.latchMappingAccuracy = latchMappingAccuracy
        self.contentIntegrityScore = contentIntegrityScore
        self.schemaConformanceScore = schemaConformanceScore
        self.acceptableLosses = acceptableLosses
        self.unexpectedDifferences = unexpectedDifferences
        self.detailedReport = detailedReport
    }
}