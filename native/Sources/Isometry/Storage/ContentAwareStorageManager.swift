import Foundation
import CryptoKit
import UniformTypeIdentifiers

/// GSD-based Content Aware Storage for attachments and blobs
/// Provides deduplication, compression, and intelligent content management
public actor ContentAwareStorageManager {
    private let database: IsometryDatabase
    private let storageConfiguration: StorageConfiguration
    private let fileManager = FileManager.default

    public init(database: IsometryDatabase, configuration: StorageConfiguration = .default) {
        self.database = database
        self.storageConfiguration = configuration
    }

    // MARK: - Content Storage (GSD Pattern)

    /// Stores content with automatic deduplication and analysis
    public func store(
        content: Data,
        filename: String? = nil,
        mimeType: String? = nil,
        metadata: [String: Any] = [:]
    ) async throws -> StoredContent {

        // Phase 1: Content Analysis
        let analysis = try await analyzeContent(content, filename: filename, mimeType: mimeType)

        // Phase 2: Deduplication Check
        if let existingContent = try await findExistingContent(hash: analysis.contentHash) {
            // Content already exists, create new reference
            let reference = try await createContentReference(
                to: existingContent.id,
                filename: filename,
                metadata: metadata
            )
            return existingContent.withNewReference(reference)
        }

        // Phase 3: Content Processing
        let processedContent = try await processContent(content, analysis: analysis)

        // Phase 4: Physical Storage
        let storagePath = try await storePhysicalContent(
            processedContent,
            analysis: analysis
        )

        // Phase 5: Database Registration
        let storedContent = StoredContent(
            id: UUID(),
            contentHash: analysis.contentHash,
            originalFilename: filename,
            mimeType: analysis.detectedMimeType,
            fileSize: content.count,
            compressedSize: processedContent.count,
            storagePath: storagePath,
            contentType: analysis.contentType,
            extractedMetadata: [:], // TODO: Fix metadata merging with proper types
            createdAt: Date(),
            accessedAt: Date(),
            accessCount: 0,
            compressionRatio: Double(processedContent.count) / Double(content.count),
            isCompressed: processedContent.count < content.count
        )

        // TODO: Implement database stored content insertion method
        // try await database.insert(storedContent: storedContent)

        // Phase 6: Background Tasks
        Task {
            await performBackgroundTasks(for: storedContent, originalContent: content)
        }

        return storedContent
    }

    /// Retrieves content by ID with access tracking
    public func retrieve(contentId: UUID) async throws -> (Data, StoredContent) {
        // TODO: Implement database methods for content storage
        throw ContentStorageError.contentNotFound(contentId)
    }

    /// Retrieves content by hash (for deduplication)
    public func retrieve(contentHash: String) async throws -> (Data, StoredContent)? {
        guard let storedContent = try await database.getStoredContent(hash: contentHash) else {
            return nil
        }

        let (data, content) = try await retrieve(contentId: storedContent.id)
        return (data, content)
    }

    // MARK: - Content Analysis

    private func analyzeContent(
        _ content: Data,
        filename: String?,
        mimeType: String?
    ) async throws -> ContentAnalysis {

        // Generate content hash for deduplication
        let hash = SHA256.hash(data: content)
        let contentHash = hash.compactMap { String(format: "%02x", $0) }.joined()

        // Detect MIME type
        let detectedMimeType = mimeType ?? detectMimeType(data: content, filename: filename)

        // Determine content type category
        let contentType = ContentType.from(mimeType: detectedMimeType)

        // Extract metadata based on content type
        let extractedMetadata = try await extractMetadata(
            from: content,
            contentType: contentType,
            filename: filename
        )

        return ContentAnalysis(
            contentHash: contentHash,
            detectedMimeType: detectedMimeType,
            contentType: contentType,
            extractedMetadata: extractedMetadata
        )
    }

    private func detectMimeType(data: Data, filename: String?) -> String {
        // Use filename extension first
        if let filename = filename,
           let utType = UTType(filenameExtension: URL(fileURLWithPath: filename).pathExtension) {
            if let mimeType = utType.preferredMIMEType {
                return mimeType
            }
        }

        // Fallback to magic number detection
        if data.count >= 4 {
            let bytes = data.prefix(4)

            // PDF
            if bytes.starts(with: Data([0x25, 0x50, 0x44, 0x46])) {
                return "application/pdf"
            }

            // PNG
            if bytes.starts(with: Data([0x89, 0x50, 0x4E, 0x47])) {
                return "image/png"
            }

            // JPEG
            if bytes.starts(with: Data([0xFF, 0xD8, 0xFF])) {
                return "image/jpeg"
            }

            // ZIP
            if bytes.starts(with: Data([0x50, 0x4B, 0x03, 0x04])) {
                return "application/zip"
            }
        }

        return "application/octet-stream"
    }

    private func extractMetadata(
        from content: Data,
        contentType: ContentType,
        filename: String?
    ) async throws -> [String: Any] {
        var metadata: [String: Any] = [:]

        metadata["contentLength"] = content.count
        if let filename = filename {
            metadata["originalFilename"] = filename
            metadata["fileExtension"] = URL(fileURLWithPath: filename).pathExtension
        }

        switch contentType {
        case .image:
            metadata.merge(try await extractImageMetadata(from: content)) { _, new in new }
        case .document:
            metadata.merge(try await extractDocumentMetadata(from: content)) { _, new in new }
        case .text:
            metadata.merge(try await extractTextMetadata(from: content)) { _, new in new }
        case .audio:
            metadata.merge(try await extractAudioMetadata(from: content)) { _, new in new }
        case .video:
            metadata.merge(try await extractVideoMetadata(from: content)) { _, new in new }
        case .archive:
            metadata.merge(try await extractArchiveMetadata(from: content)) { _, new in new }
        case .other:
            break
        }

        return metadata
    }

    // MARK: - Content Processing

    private func processContent(
        _ content: Data,
        analysis: ContentAnalysis
    ) async throws -> Data {

        // Apply compression if beneficial
        if shouldCompress(contentType: analysis.contentType, size: content.count) {
            return try compress(content)
        }

        return content
    }

    private func shouldCompress(contentType: ContentType, size: Int) -> Bool {
        // Don't compress already compressed formats
        switch contentType {
        case .image, .audio, .video, .archive:
            return false
        case .text, .document:
            return size > storageConfiguration.compressionThreshold
        case .other:
            return size > storageConfiguration.compressionThreshold
        }
    }

    private func compress(_ data: Data) throws -> Data {
        return try (data as NSData).compressed(using: .lzfse) as Data
    }

    private func decompress(_ data: Data) throws -> Data {
        return try (data as NSData).decompressed(using: .lzfse) as Data
    }

    // MARK: - Physical Storage

    private func storePhysicalContent(
        _ content: Data,
        analysis: ContentAnalysis
    ) async throws -> String {

        let storageDirectory = try getStorageDirectory(for: analysis.contentType)
        let filename = generateStorageFilename(hash: analysis.contentHash, contentType: analysis.contentType)
        let fullPath = storageDirectory.appendingPathComponent(filename)

        try content.write(to: fullPath)

        return fullPath.path
    }

    private func loadPhysicalContent(at path: String) async throws -> Data {
        let url = URL(fileURLWithPath: path)

        guard fileManager.fileExists(atPath: path) else {
            throw ContentStorageError.physicalFileNotFound(path)
        }

        return try Data(contentsOf: url)
    }

    private func getStorageDirectory(for contentType: ContentType) throws -> URL {
        let documentsDirectory = fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let contentDirectory = documentsDirectory
            .appendingPathComponent("Isometry")
            .appendingPathComponent("ContentStorage")
            .appendingPathComponent(contentType.directoryName)

        try fileManager.createDirectory(at: contentDirectory, withIntermediateDirectories: true)

        return contentDirectory
    }

    private func generateStorageFilename(hash: String, contentType: ContentType) -> String {
        let prefix = String(hash.prefix(2))
        let suffix = String(hash.suffix(hash.count - 2))
        return "\(prefix)/\(suffix).\(contentType.fileExtension)"
    }

    // MARK: - Background Tasks

    private func performBackgroundTasks(
        for content: StoredContent,
        originalContent: Data
    ) async {

        // Generate thumbnails for images
        if content.contentType == .image {
            await generateThumbnails(for: content, originalContent: originalContent)
        }

        // Extract full-text for documents
        if content.contentType == .document || content.contentType == .text {
            await extractFullText(for: content, originalContent: originalContent)
        }

        // Update search index
        await updateSearchIndex(for: content)
    }

    // MARK: - Content Management

    /// Lists all stored content with filtering options
    public func listContent(
        contentType: ContentType? = nil,
        minSize: Int? = nil,
        maxSize: Int? = nil,
        since: Date? = nil,
        limit: Int = 100
    ) async throws -> [StoredContent] {
        return try await database.listStoredContent(
            contentType: contentType,
            minSize: minSize,
            maxSize: maxSize,
            since: since,
            limit: limit
        )
    }

    /// Gets storage statistics
    public func getStorageStats() async throws -> StorageStats {
        return try await database.getStorageStats()
    }

    /// Performs cleanup of unused content
    public func performCleanup(
        olderThan: Date? = nil,
        unusedOnly: Bool = true
    ) async throws -> CleanupResult {

        let candidates = try await database.getCleanupCandidates(
            olderThan: olderThan,
            unusedOnly: unusedOnly
        )

        var deletedCount = 0
        var freedSpace = 0

        for content in candidates {
            do {
                try await deleteContent(content)
                deletedCount += 1
                freedSpace += content.fileSize
            } catch {
                // Log error but continue
                print("Failed to delete content \(content.id): \(error)")
            }
        }

        return CleanupResult(
            deletedFiles: deletedCount,
            freedSpace: freedSpace
        )
    }

    private func deleteContent(_ content: StoredContent) async throws {
        // Remove physical file
        try fileManager.removeItem(atPath: content.storagePath)

        // Remove database record
        try await database.deleteStoredContent(id: content.id)
    }

    // MARK: - Deduplication Support

    private func findExistingContent(hash: String) async throws -> StoredContent? {
        return try await database.getStoredContent(hash: hash)
    }

    private func createContentReference(
        to contentId: UUID,
        filename: String?,
        metadata: [String: Any]
    ) async throws -> ContentReference {

        let reference = ContentReference(
            id: UUID(),
            contentId: contentId,
            referenceName: filename,
            metadata: metadata,
            createdAt: Date()
        )

        // TODO: Implement database content reference insertion method
        // try await database.insert(contentReference: reference)

        return reference
    }

    // MARK: - Metadata Extraction Helpers

    private func extractImageMetadata(from content: Data) async throws -> [String: Any] {
        // Placeholder for image metadata extraction
        // Would use ImageIO or similar framework
        return [:]
    }

    private func extractDocumentMetadata(from content: Data) async throws -> [String: Any] {
        // Placeholder for document metadata extraction
        // Would use PDFKit or similar framework
        return [:]
    }

    private func extractTextMetadata(from content: Data) async throws -> [String: Any] {
        var metadata: [String: Any] = [:]

        if let text = String(data: content, encoding: .utf8) {
            metadata["characterCount"] = text.count
            metadata["wordCount"] = text.components(separatedBy: .whitespacesAndNewlines).count
            metadata["lineCount"] = text.components(separatedBy: .newlines).count
        }

        return metadata
    }

    private func extractAudioMetadata(from content: Data) async throws -> [String: Any] {
        // Placeholder for audio metadata extraction
        // Would use AVFoundation
        return [:]
    }

    private func extractVideoMetadata(from content: Data) async throws -> [String: Any] {
        // Placeholder for video metadata extraction
        // Would use AVFoundation
        return [:]
    }

    private func extractArchiveMetadata(from content: Data) async throws -> [String: Any] {
        // Placeholder for archive metadata extraction
        return [:]
    }

    private func generateThumbnails(for content: StoredContent, originalContent: Data) async {
        // Generate thumbnails for images
    }

    private func extractFullText(for content: StoredContent, originalContent: Data) async {
        // Extract text content for search indexing
    }

    private func updateSearchIndex(for content: StoredContent) async {
        // Update search index with content metadata
    }
}

// MARK: - Supporting Types

public struct StorageConfiguration {
    public let compressionThreshold: Int
    public let maxFileSize: Int
    public let thumbnailSizes: [Int]
    public let enableDeduplication: Bool
    public let enableCompression: Bool

    public static let `default` = StorageConfiguration(
        compressionThreshold: 1024, // 1KB
        maxFileSize: 100 * 1024 * 1024, // 100MB
        thumbnailSizes: [64, 128, 256, 512],
        enableDeduplication: true,
        enableCompression: true
    )
}

public struct ContentAnalysis {
    public let contentHash: String
    public let detectedMimeType: String
    public let contentType: ContentType
    public let extractedMetadata: [String: AnyCodable]
}

public enum ContentType: String, Codable, CaseIterable, Sendable {
    case image = "image"
    case document = "document"
    case text = "text"
    case audio = "audio"
    case video = "video"
    case archive = "archive"
    case other = "other"

    public static func from(mimeType: String) -> ContentType {
        switch mimeType {
        case let type where type.starts(with: "image/"):
            return .image
        case let type where type.starts(with: "audio/"):
            return .audio
        case let type where type.starts(with: "video/"):
            return .video
        case let type where type.starts(with: "text/"):
            return .text
        case "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return .document
        case "application/zip", "application/x-tar", "application/gzip":
            return .archive
        default:
            return .other
        }
    }

    public var directoryName: String {
        return rawValue
    }

    public var fileExtension: String {
        switch self {
        case .image: return "img"
        case .document: return "doc"
        case .text: return "txt"
        case .audio: return "aud"
        case .video: return "vid"
        case .archive: return "arc"
        case .other: return "bin"
        }
    }
}

public struct StoredContent: Codable, Sendable, Identifiable {
    public let id: UUID
    public let contentHash: String
    public let originalFilename: String?
    public let mimeType: String
    public let fileSize: Int
    public let compressedSize: Int
    public let storagePath: String
    public let contentType: ContentType
    public let extractedMetadata: [String: AnyCodable]
    public let createdAt: Date
    public let accessedAt: Date
    public let accessCount: Int
    public let compressionRatio: Double
    public let isCompressed: Bool

    public func withNewReference(_ reference: ContentReference) -> StoredContent {
        // Return updated content with new reference
        return self
    }
}

public struct ContentReference: Codable, Sendable, Identifiable {
    public let id: UUID
    public let contentId: UUID
    public let referenceName: String?
    public let metadata: [String: AnyCodable]
    public let createdAt: Date
}

public struct StorageStats: Sendable {
    public let totalFiles: Int
    public let totalSize: Int
    public let compressedSize: Int
    public let deduplicationSavings: Int
    public let compressionSavings: Int
    public let contentTypeBreakdown: [ContentType: Int]
}

public struct CleanupResult: Sendable {
    public let deletedFiles: Int
    public let freedSpace: Int
}

public enum ContentStorageError: LocalizedError {
    case contentNotFound(UUID)
    case physicalFileNotFound(String)
    case compressionFailed
    case decompressionFailed
    case invalidContentType
    case storageLimitExceeded

    public var errorDescription: String? {
        switch self {
        case .contentNotFound(let id):
            return "Content not found: \(id)"
        case .physicalFileNotFound(let path):
            return "Physical file not found: \(path)"
        case .compressionFailed:
            return "Failed to compress content"
        case .decompressionFailed:
            return "Failed to decompress content"
        case .invalidContentType:
            return "Invalid content type"
        case .storageLimitExceeded:
            return "Storage limit exceeded"
        }
    }
}