import Foundation
import UniformTypeIdentifiers
import GRDB

/// Enhanced storage manager with Content-Addressable Storage and attachment support
/// Builds upon existing storage capabilities with CAS integration for efficient file management
public actor ContentAwareStorageManager {

    // Core storage components
    private let casIntegration: CASIntegration
    private let basePath: URL
    private let database: IsometryDatabase

    // Configuration
    private let maxCacheSize: Int64
    private let cleanupInterval: TimeInterval
    private var isCleanupEnabled: Bool = true

    // Performance tracking
    private var performanceMetrics = StoragePerformanceMetrics()
    private var cachingEnabled: Bool

    // Background cleanup
    private var cleanupTask: Task<Void, Error>?

    public init(
        basePath: URL,
        database: IsometryDatabase,
        maxCacheSize: Int64 = 500_000_000, // 500MB default
        cleanupInterval: TimeInterval = 3600, // 1 hour
        cachingEnabled: Bool = true
    ) {
        self.basePath = basePath
        self.database = database
        self.maxCacheSize = maxCacheSize
        self.cleanupInterval = cleanupInterval
        self.cachingEnabled = cachingEnabled

        // Initialize CAS with storage-specific configuration
        let casBasePath = basePath.appendingPathComponent("attachments")
        self.casIntegration = CASIntegration(
            basePath: casBasePath,
            maxFileSize: 200_000_000, // 200MB max file size
            compressionThreshold: 5_000_000 // Compress files > 5MB
        )

        Task {
            await initializeStorage()
            await startBackgroundCleanupIfEnabled()
        }
    }

    deinit {
        cleanupTask?.cancel()
    }

    // MARK: - Attachment Storage Operations

    /// Store attachment content with metadata
    public func storeAttachment(
        content: Data,
        originalFilename: String,
        mimeType: String,
        noteId: String,
        attachmentId: String
    ) async throws -> AttachmentStorageResult {
        let startTime = Date()

        // Validate file type and size
        try validateAttachment(content: content, mimeType: mimeType, filename: originalFilename)

        // Store in CAS
        let casResult = try await casIntegration.store(
            content: content,
            originalFilename: originalFilename,
            mimeType: mimeType
        )

        // Create attachment metadata
        let attachmentMetadata = AttachmentMetadata(
            id: attachmentId,
            contentHash: casResult.contentHash,
            originalFilename: originalFilename,
            mimeType: mimeType,
            fileSize: content.count,
            noteId: noteId,
            createdAt: Date(),
            lastAccessedAt: Date()
        )

        // Store metadata in database
        try await storeAttachmentMetadata(attachmentMetadata)

        // Update performance metrics
        let duration = Date().timeIntervalSince(startTime)
        performanceMetrics.recordStorage(
            duration: duration,
            fileSize: content.count,
            wasDeduplication: !casResult.wasStored
        )

        print("ContentAwareStorage: Stored attachment \(attachmentId) (\(originalFilename)) with hash \(casResult.contentHash)")

        return AttachmentStorageResult(
            attachmentId: attachmentId,
            contentHash: casResult.contentHash,
            storedSize: casResult.storedSize,
            originalSize: casResult.originalSize,
            wasDeduplication: !casResult.wasStored
        )
    }

    /// Store generic content with metadata
    public func store(
        content: Data,
        filename: String,
        mimeType: String,
        metadata: [String: String] = [:]
    ) async throws -> StoredContent {
        let startTime = Date()

        // Store in CAS
        let casResult = try await casIntegration.store(
            content: content,
            originalFilename: filename,
            mimeType: mimeType
        )

        // Update performance metrics
        let duration = Date().timeIntervalSince(startTime)
        await updatePerformanceMetrics(operation: "store", duration: duration, fileSize: content.count)

        print("ContentAwareStorage: Stored content \(filename) with hash \(casResult.contentHash)")

        return StoredContent(
            contentHash: casResult.contentHash,
            storedSize: casResult.storedSize,
            originalSize: casResult.originalSize,
            filename: filename,
            mimeType: mimeType,
            metadata: metadata,
            wasDeduplication: !casResult.wasStored
        )
    }

    /// Retrieve attachment content by ID
    public func retrieveAttachment(attachmentId: String) async throws -> AttachmentRetrievalResult {
        let startTime = Date()

        // Get attachment metadata
        guard let metadata = try await getAttachmentMetadata(attachmentId: attachmentId) else {
            throw StorageError.attachmentNotFound(attachmentId)
        }

        // Update last accessed time
        try await updateLastAccessed(attachmentId: attachmentId)

        // Retrieve content from CAS
        let content = try await casIntegration.retrieve(contentHash: metadata.contentHash)

        // Update performance metrics
        let duration = Date().timeIntervalSince(startTime)
        performanceMetrics.recordRetrieval(duration: duration, fileSize: content.count)

        return AttachmentRetrievalResult(
            content: content,
            metadata: metadata
        )
    }

    // MARK: - Private Implementation

    /// Initialize storage directories and database tables
    private func initializeStorage() async {
        do {
            // Ensure base directories exist
            try FileManager.default.createDirectory(at: basePath, withIntermediateDirectories: true)

            // Initialize database table for attachment metadata
            try await database.write { db in
                try db.execute(sql: """
                    CREATE TABLE IF NOT EXISTS attachment_metadata (
                        id TEXT PRIMARY KEY,
                        content_hash TEXT NOT NULL,
                        original_filename TEXT NOT NULL,
                        mime_type TEXT NOT NULL,
                        file_size INTEGER NOT NULL,
                        note_id TEXT NOT NULL,
                        created_at REAL NOT NULL,
                        last_accessed_at REAL NOT NULL,
                        FOREIGN KEY (note_id) REFERENCES nodes(id) ON DELETE CASCADE
                    );

                    CREATE INDEX IF NOT EXISTS idx_attachment_note_id ON attachment_metadata(note_id);
                    CREATE INDEX IF NOT EXISTS idx_attachment_hash ON attachment_metadata(content_hash);
                    """)
            }

            print("ContentAwareStorage: Initialized storage at \(basePath.path)")
        } catch {
            print("ContentAwareStorage: Failed to initialize storage: \(error)")
        }
    }

    /// Store attachment metadata in database
    private func storeAttachmentMetadata(_ metadata: AttachmentMetadata) async throws {
        try await database.write { db in
            try db.execute(sql: """
                INSERT OR REPLACE INTO attachment_metadata
                (id, content_hash, original_filename, mime_type, file_size, note_id, created_at, last_accessed_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, arguments: [
                metadata.id,
                metadata.contentHash,
                metadata.originalFilename,
                metadata.mimeType,
                metadata.fileSize,
                metadata.noteId,
                metadata.createdAt.timeIntervalSince1970,
                metadata.lastAccessedAt.timeIntervalSince1970
            ])
        }
    }

    /// Get attachment metadata from database
    private func getAttachmentMetadata(attachmentId: String) async throws -> AttachmentMetadata? {
        return try await database.read { db in
            try AttachmentMetadata.fetchOne(db, sql: """
                SELECT * FROM attachment_metadata WHERE id = ?
                """, arguments: [attachmentId])
        }
    }

    /// Get attachment info without loading content (public interface)
    public func getAttachmentInfo(attachmentId: String) async throws -> AttachmentMetadata? {
        return try await getAttachmentMetadata(attachmentId: attachmentId)
    }

    /// Detect MIME type from content and filename
    public func detectMimeType(content: Data, filename: String) async -> String {
        // First try by file extension
        let pathExtension = URL(fileURLWithPath: filename).pathExtension.lowercased()

        switch pathExtension {
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "gif": return "image/gif"
        case "pdf": return "application/pdf"
        case "txt": return "text/plain"
        case "md": return "text/markdown"
        case "json": return "application/json"
        case "zip": return "application/zip"
        case "mp3": return "audio/mpeg"
        case "mp4": return "video/mp4"
        case "mov": return "video/quicktime"
        case "wav": return "audio/wav"
        default: break
        }

        // Then try by content magic bytes
        if content.count >= 8 {
            let header = Array(content.prefix(8))

            // PNG signature
            if header.starts(with: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) {
                return "image/png"
            }

            // JPEG signature
            if header.starts(with: [0xFF, 0xD8, 0xFF]) {
                return "image/jpeg"
            }

            // PDF signature
            if content.prefix(4) == Data([0x25, 0x50, 0x44, 0x46]) { // %PDF
                return "application/pdf"
            }

            // ZIP signature
            if header.starts(with: [0x50, 0x4B, 0x03, 0x04]) || header.starts(with: [0x50, 0x4B, 0x05, 0x06]) {
                return "application/zip"
            }
        }

        // Check for text content
        if let _ = String(data: content.prefix(1024), encoding: .utf8) {
            return "text/plain"
        }

        return "application/octet-stream"
    }

    /// Update last accessed time for attachment
    private func updateLastAccessed(attachmentId: String) async throws {
        try await database.write { db in
            try db.execute(sql: """
                UPDATE attachment_metadata
                SET last_accessed_at = ?
                WHERE id = ?
                """, arguments: [Date().timeIntervalSince1970, attachmentId])
        }
    }

    /// Validate attachment content and metadata
    private func validateAttachment(content: Data, mimeType: String, filename: String) throws {
        // Check file size limits
        guard content.count <= 200_000_000 else { // 200MB
            throw StorageError.fileTooLarge(content.count, 200_000_000)
        }

        // Basic filename validation
        let invalidChars = CharacterSet(charactersIn: "<>:\"/\\|?*\0")
        guard filename.rangeOfCharacter(from: invalidChars) == nil else {
            throw StorageError.invalidFilename(filename)
        }
    }

    /// Start background cleanup if enabled
    private func startBackgroundCleanupIfEnabled() async {
        if isCleanupEnabled {
            await startBackgroundCleanup()
        }
    }

    /// Start background cleanup task
    private func startBackgroundCleanup() async {
        cleanupTask = Task { [weak self] in
            while !Task.isCancelled {
                try await Task.sleep(for: .seconds(cleanupInterval))

                do {
                    _ = try await self?.performMaintenanceTasks()
                } catch {
                    print("ContentAwareStorage: Background cleanup failed: \(error)")
                }
            }
        }
    }

    private func performMaintenanceTasks() async throws -> Int {
        // Simplified maintenance for now
        return 0
    }

    /// Update performance metrics for storage operations
    private func updatePerformanceMetrics(operation: String, duration: TimeInterval, fileSize: Int) async {
        // Update local storage performance metrics
        performanceMetrics.recordStorage(
            duration: duration,
            fileSize: fileSize,
            wasDeduplication: false // This will be set properly by callers if needed
        )

        // Optionally integrate with global PerformanceMonitor if available
        print("ContentAwareStorage: \(operation) completed in \(String(format: "%.3f", duration))s for \(fileSize) bytes")
    }
}

// MARK: - Data Types

/// Attachment metadata structure
public struct AttachmentMetadata: Codable {
    public let id: String
    public let contentHash: String
    public let originalFilename: String
    public let mimeType: String
    public let fileSize: Int
    public let noteId: String
    public let createdAt: Date
    public let lastAccessedAt: Date
}

// Conform to GRDB FetchableRecord for database queries
extension AttachmentMetadata: FetchableRecord {
    public init(row: Row) {
        id = row["id"]
        contentHash = row["content_hash"]
        originalFilename = row["original_filename"]
        mimeType = row["mime_type"]
        fileSize = row["file_size"]
        noteId = row["note_id"]
        createdAt = Date(timeIntervalSince1970: row["created_at"])
        lastAccessedAt = Date(timeIntervalSince1970: row["last_accessed_at"])
    }
}

/// Generic storage result for content
public struct StoredContent {
    public let contentHash: String
    public let storedSize: Int
    public let originalSize: Int
    public let filename: String
    public let mimeType: String
    public let metadata: [String: String]
    public let wasDeduplication: Bool
}

/// Attachment storage result
public struct AttachmentStorageResult {
    public let attachmentId: String
    public let contentHash: String
    public let storedSize: Int
    public let originalSize: Int
    public let wasDeduplication: Bool
}

/// Attachment retrieval result
public struct AttachmentRetrievalResult {
    public let content: Data
    public let metadata: AttachmentMetadata
}

/// Performance metrics for storage operations
public struct StoragePerformanceMetrics: Codable {
    public var totalOperations: Int = 0
    public var totalStorageTime: TimeInterval = 0
    public var totalRetrievalTime: TimeInterval = 0
    public var deduplicationHits: Int = 0

    mutating func recordStorage(duration: TimeInterval, fileSize: Int, wasDeduplication: Bool) {
        totalOperations += 1
        totalStorageTime += duration

        if wasDeduplication {
            deduplicationHits += 1
        }
    }

    mutating func recordRetrieval(duration: TimeInterval, fileSize: Int) {
        totalRetrievalTime += duration
    }
}

/// Storage error types
public enum StorageError: Error, LocalizedError {
    case attachmentNotFound(String)
    case fileTooLarge(Int, Int)
    case invalidFilename(String)

    public var errorDescription: String? {
        switch self {
        case .attachmentNotFound(let id):
            return "Attachment not found: \(id)"
        case .fileTooLarge(let size, let maxSize):
            return "File size \(size) exceeds maximum \(maxSize)"
        case .invalidFilename(let filename):
            return "Invalid filename: \(filename)"
        }
    }
}