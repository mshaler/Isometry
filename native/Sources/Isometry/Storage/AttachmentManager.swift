import Foundation
import SQLite3
import GRDB

/// Comprehensive attachment management system for Apple Notes integration
/// Handles extraction, storage, and retrieval of Notes attachments with CAS integration
public actor AttachmentManager {

    // Core dependencies
    private let storageManager: ContentAwareStorageManager
    private let database: IsometryDatabase
    private let nativeImporter: AppleNotesNativeImporter

    // Processing configuration
    private let maxConcurrentOperations: Int
    private let batchSize: Int
    private let progressReporting: Bool

    // Performance tracking
    private var processingMetrics = AttachmentProcessingMetrics()
    private var activeOperations: Set<String> = []

    public init(
        storageManager: ContentAwareStorageManager,
        database: IsometryDatabase,
        nativeImporter: AppleNotesNativeImporter,
        maxConcurrentOperations: Int = 10,
        batchSize: Int = 50,
        progressReporting: Bool = true
    ) {
        self.storageManager = storageManager
        self.database = database
        self.nativeImporter = nativeImporter
        self.maxConcurrentOperations = maxConcurrentOperations
        self.batchSize = batchSize
        self.progressReporting = progressReporting
    }

    // MARK: - Attachment Extraction from Notes

    /// Extract and process attachments from Apple Notes during import
    public func processNoteAttachments(noteId: String, noteContent: Data?) async throws -> AttachmentProcessingResult {
        let startTime = Date()
        let operationId = UUID().uuidString
        activeOperations.insert(operationId)
        defer { activeOperations.remove(operationId) }

        print("AttachmentManager: Processing attachments for note \(noteId)")

        var result = AttachmentProcessingResult(noteId: noteId)

        // Extract attachments from note content and database
        let attachments = try await extractAttachmentsFromNote(noteId: noteId, noteContent: noteContent)

        guard !attachments.isEmpty else {
            print("AttachmentManager: No attachments found for note \(noteId)")
            return result
        }

        print("AttachmentManager: Found \(attachments.count) attachments for note \(noteId)")

        // Process attachments in batches
        let batches = attachments.chunked(into: batchSize)

        for (batchIndex, batch) in batches.enumerated() {
            if progressReporting {
                print("AttachmentManager: Processing batch \(batchIndex + 1)/\(batches.count) for note \(noteId)")
            }

            let batchResults = try await processBatchAttachments(batch, noteId: noteId)

            // Accumulate results
            result.processedCount += batchResults.count
            result.successfulAttachments.append(contentsOf: batchResults.compactMap { $0.success })
            result.failures.append(contentsOf: batchResults.compactMap { $0.failure })
        }

        // Update processing metrics
        let duration = Date().timeIntervalSince(startTime)
        processingMetrics.recordProcessing(
            duration: duration,
            attachmentCount: attachments.count,
            successCount: result.successfulAttachments.count
        )

        print("AttachmentManager: Completed processing for note \(noteId): \(result.successfulAttachments.count) successful, \(result.failures.count) failed")

        return result
    }

    /// Extract attachments from multiple notes efficiently
    public func processBulkAttachments(noteIds: [String]) async throws -> BulkAttachmentProcessingResult {
        let startTime = Date()
        print("AttachmentManager: Starting bulk processing for \(noteIds.count) notes")

        var results: [AttachmentProcessingResult] = []
        var totalProcessed = 0
        var totalSuccessful = 0

        // Process notes in smaller batches to manage memory
        let noteBatches = noteIds.chunked(into: maxConcurrentOperations)

        for (batchIndex, noteBatch) in noteBatches.enumerated() {
            if progressReporting {
                print("AttachmentManager: Processing note batch \(batchIndex + 1)/\(noteBatches.count)")
            }

            // Process notes in this batch concurrently
            let batchResults = try await withThrowingTaskGroup(of: AttachmentProcessingResult.self) { group in
                for noteId in noteBatch {
                    group.addTask {
                        try await self.processNoteAttachments(noteId: noteId, noteContent: nil)
                    }
                }

                var batchResults: [AttachmentProcessingResult] = []
                for try await result in group {
                    batchResults.append(result)
                }
                return batchResults
            }

            results.append(contentsOf: batchResults)

            // Update totals
            for result in batchResults {
                totalProcessed += result.processedCount
                totalSuccessful += result.successfulAttachments.count
            }
        }

        let duration = Date().timeIntervalSince(startTime)
        print("AttachmentManager: Bulk processing complete: \(totalSuccessful)/\(totalProcessed) attachments processed successfully in \(String(format: "%.2f", duration))s")

        return BulkAttachmentProcessingResult(
            noteResults: results,
            totalProcessed: totalProcessed,
            totalSuccessful: totalSuccessful,
            duration: duration
        )
    }

    // MARK: - Attachment Storage Operations

    /// Store an individual attachment
    public func storeAttachment(
        content: Data,
        originalFilename: String,
        mimeType: String,
        noteId: String
    ) async throws -> StoredAttachment {
        // Generate attachment ID
        let attachmentId = generateAttachmentId(noteId: noteId, filename: originalFilename)

        // Detect MIME type if not provided or validate existing
        let detectedMimeType = await storageManager.detectMimeType(content: content, filename: originalFilename)
        let finalMimeType = mimeType.isEmpty ? detectedMimeType : mimeType

        // Store through storage manager
        let storageResult = try await storageManager.storeAttachment(
            content: content,
            originalFilename: originalFilename,
            mimeType: finalMimeType,
            noteId: noteId,
            attachmentId: attachmentId
        )

        // Update node model to include attachment reference
        try await addAttachmentReferenceToNode(noteId: noteId, attachmentId: attachmentId)

        return StoredAttachment(
            id: attachmentId,
            contentHash: storageResult.contentHash,
            originalFilename: originalFilename,
            mimeType: finalMimeType,
            fileSize: content.count,
            noteId: noteId,
            wasDeduplication: storageResult.wasDeduplication
        )
    }

    /// Retrieve attachment by ID
    public func retrieveAttachment(attachmentId: String) async throws -> RetrievedAttachment {
        let retrievalResult = try await storageManager.retrieveAttachment(attachmentId: attachmentId)

        return RetrievedAttachment(
            content: retrievalResult.content,
            metadata: retrievalResult.metadata
        )
    }

    /// Get attachment info without loading content
    public func getAttachmentInfo(attachmentId: String) async throws -> AttachmentInfo? {
        guard let metadata = try await storageManager.getAttachmentInfo(attachmentId: attachmentId) else {
            return nil
        }

        return AttachmentInfo(
            id: metadata.id,
            contentHash: metadata.contentHash,
            originalFilename: metadata.originalFilename,
            mimeType: metadata.mimeType,
            fileSize: metadata.fileSize,
            noteId: metadata.noteId,
            createdAt: metadata.createdAt,
            lastAccessedAt: metadata.lastAccessedAt
        )
    }

    /// Get all attachments for a note
    public func getAttachmentsForNote(noteId: String) async throws -> [AttachmentInfo] {
        let metadataList = try await database.read { db in
            try AttachmentMetadata.fetchAll(db, sql: """
                SELECT * FROM attachment_metadata
                WHERE note_id = ?
                ORDER BY created_at ASC
                """, arguments: [noteId])
        }

        return metadataList.map { metadata in
            AttachmentInfo(
                id: metadata.id,
                contentHash: metadata.contentHash,
                originalFilename: metadata.originalFilename,
                mimeType: metadata.mimeType,
                fileSize: metadata.fileSize,
                noteId: metadata.noteId,
                createdAt: metadata.createdAt,
                lastAccessedAt: metadata.lastAccessedAt
            )
        }
    }

    // MARK: - Search and Filtering

    /// Search attachments by filename pattern
    public func searchAttachments(filenamePattern: String, limit: Int = 100) async throws -> [AttachmentInfo] {
        let pattern = "%\(filenamePattern)%"

        let metadataList = try await database.read { db in
            try AttachmentMetadata.fetchAll(db, sql: """
                SELECT * FROM attachment_metadata
                WHERE original_filename LIKE ?
                ORDER BY last_accessed_at DESC
                LIMIT ?
                """, arguments: [pattern, limit])
        }

        return metadataList.map { metadata in
            AttachmentInfo(
                id: metadata.id,
                contentHash: metadata.contentHash,
                originalFilename: metadata.originalFilename,
                mimeType: metadata.mimeType,
                fileSize: metadata.fileSize,
                noteId: metadata.noteId,
                createdAt: metadata.createdAt,
                lastAccessedAt: metadata.lastAccessedAt
            )
        }
    }

    /// Filter attachments by MIME type
    public func getAttachmentsByType(mimeType: String, limit: Int = 100) async throws -> [AttachmentInfo] {
        let metadataList = try await database.read { db in
            try AttachmentMetadata.fetchAll(db, sql: """
                SELECT * FROM attachment_metadata
                WHERE mime_type = ?
                ORDER BY created_at DESC
                LIMIT ?
                """, arguments: [mimeType, limit])
        }

        return metadataList.map { metadata in
            AttachmentInfo(
                id: metadata.id,
                contentHash: metadata.contentHash,
                originalFilename: metadata.originalFilename,
                mimeType: metadata.mimeType,
                fileSize: metadata.fileSize,
                noteId: metadata.noteId,
                createdAt: metadata.createdAt,
                lastAccessedAt: metadata.lastAccessedAt
            )
        }
    }

    // MARK: - Performance and Statistics

    /// Get processing performance metrics
    public func getProcessingMetrics() async -> AttachmentProcessingMetrics {
        return processingMetrics
    }

    /// Get attachment statistics
    public func getAttachmentStatistics() async throws -> AttachmentStatistics {
        let stats = try await database.read { db in
            let totalCount = try Int.fetchOne(db, sql: "SELECT COUNT(*) FROM attachment_metadata") ?? 0
            let totalSize = try Int64.fetchOne(db, sql: "SELECT COALESCE(SUM(file_size), 0) FROM attachment_metadata") ?? 0

            let typeStats = try Row.fetchAll(db, sql: """
                SELECT mime_type, COUNT(*) as count, SUM(file_size) as total_size
                FROM attachment_metadata
                GROUP BY mime_type
                ORDER BY count DESC
                """)

            let largestFiles = try AttachmentMetadata.fetchAll(db, sql: """
                SELECT * FROM attachment_metadata
                ORDER BY file_size DESC
                LIMIT 10
                """)

            return (totalCount, totalSize, typeStats, largestFiles)
        }

        let (totalCount, totalSize, typeStats, largestFiles) = stats

        let typeBreakdown = typeStats.map { row in
            AttachmentTypeStats(
                mimeType: row["mime_type"],
                count: row["count"],
                totalSize: row["total_size"]
            )
        }

        let largestAttachments = largestFiles.map { metadata in
            AttachmentInfo(
                id: metadata.id,
                contentHash: metadata.contentHash,
                originalFilename: metadata.originalFilename,
                mimeType: metadata.mimeType,
                fileSize: metadata.fileSize,
                noteId: metadata.noteId,
                createdAt: metadata.createdAt,
                lastAccessedAt: metadata.lastAccessedAt
            )
        }

        return AttachmentStatistics(
            totalAttachments: totalCount,
            totalSize: totalSize,
            typeBreakdown: typeBreakdown,
            largestAttachments: largestAttachments,
            processingMetrics: processingMetrics
        )
    }

    // MARK: - Private Implementation

    /// Extract attachments from a note using Notes database queries
    private func extractAttachmentsFromNote(noteId: String, noteContent: Data?) async throws -> [ExtractedAttachment] {
        var attachments: [ExtractedAttachment] = []

        // Step 1: Query the Notes database for attachment records linked to this note
        let attachmentRecords = try await nativeImporter.getAttachmentRecordsForNote(noteId: noteId)

        for record in attachmentRecords {
            do {
                // Step 2: Extract attachment data from Notes storage
                let attachmentData = try await nativeImporter.extractAttachmentData(record: record)

                let extractedAttachment = ExtractedAttachment(
                    filename: record.filename ?? "attachment_\(record.id)",
                    mimeType: record.mimeType ?? detectMimeTypeFromUTI(record.uti),
                    content: attachmentData,
                    originalId: record.id
                )

                attachments.append(extractedAttachment)

                print("AttachmentManager: Extracted attachment \(record.filename ?? record.id) (\(attachmentData.count) bytes)")

            } catch {
                print("AttachmentManager: Failed to extract attachment \(record.id): \(error)")
                // Continue with other attachments rather than failing entirely
            }
        }

        // Step 3: Parse protobuf content for embedded attachments (if available)
        if let noteContent = noteContent {
            let embeddedAttachments = try await extractEmbeddedAttachments(from: noteContent)
            attachments.append(contentsOf: embeddedAttachments)
        }

        print("AttachmentManager: Extracted \(attachments.count) total attachments for note \(noteId)")
        return attachments
    }

    /// Extract embedded attachments from Notes protobuf content
    private func extractEmbeddedAttachments(from noteContent: Data) async throws -> [ExtractedAttachment] {
        var embeddedAttachments: [ExtractedAttachment] = []

        // Parse protobuf content to find embedded media
        // This is a simplified implementation that looks for common patterns

        // Look for embedded image data (JPEG, PNG signatures)
        let jpegMarkers = findDataPatterns(in: noteContent, pattern: Data([0xFF, 0xD8, 0xFF]))
        for (index, marker) in jpegMarkers.enumerated() {
            if let imageData = extractImageData(from: noteContent, startingAt: marker, format: .jpeg) {
                let attachment = ExtractedAttachment(
                    filename: "embedded_image_\(index).jpg",
                    mimeType: "image/jpeg",
                    content: imageData,
                    originalId: "embedded_\(marker)"
                )
                embeddedAttachments.append(attachment)
            }
        }

        let pngMarkers = findDataPatterns(in: noteContent, pattern: Data([0x89, 0x50, 0x4E, 0x47]))
        for (index, marker) in pngMarkers.enumerated() {
            if let imageData = extractImageData(from: noteContent, startingAt: marker, format: .png) {
                let attachment = ExtractedAttachment(
                    filename: "embedded_image_\(index).png",
                    mimeType: "image/png",
                    content: imageData,
                    originalId: "embedded_png_\(marker)"
                )
                embeddedAttachments.append(attachment)
            }
        }

        // Look for PDF signatures
        let pdfMarkers = findDataPatterns(in: noteContent, pattern: "%PDF".data(using: .utf8)!)
        for (index, marker) in pdfMarkers.enumerated() {
            if let pdfData = extractPDFData(from: noteContent, startingAt: marker) {
                let attachment = ExtractedAttachment(
                    filename: "embedded_document_\(index).pdf",
                    mimeType: "application/pdf",
                    content: pdfData,
                    originalId: "embedded_pdf_\(marker)"
                )
                embeddedAttachments.append(attachment)
            }
        }

        return embeddedAttachments
    }

    /// Find data patterns within larger data blob
    private func findDataPatterns(in data: Data, pattern: Data) -> [Int] {
        var positions: [Int] = []
        let patternLength = pattern.count

        guard patternLength > 0 && data.count >= patternLength else { return positions }

        for i in 0...(data.count - patternLength) {
            let range = i..<(i + patternLength)
            let subset = data.subdata(in: range)
            if subset == pattern {
                positions.append(i)
            }
        }

        return positions
    }

    /// Extract image data from protobuf content
    private func extractImageData(from data: Data, startingAt position: Int, format: ImageFormat) -> Data? {
        guard position < data.count else { return nil }

        switch format {
        case .jpeg:
            return extractJPEGData(from: data, startingAt: position)
        case .png:
            return extractPNGData(from: data, startingAt: position)
        }
    }

    /// Extract JPEG data by finding start and end markers
    private func extractJPEGData(from data: Data, startingAt position: Int) -> Data? {
        // Look for JPEG end marker (0xFF, 0xD9)
        let endMarker = Data([0xFF, 0xD9])

        for i in (position + 4)..<data.count {
            if i + 1 < data.count && data[i] == 0xFF && data[i + 1] == 0xD9 {
                let range = position..<(i + 2)
                return data.subdata(in: range)
            }
        }

        return nil
    }

    /// Extract PNG data by finding IEND chunk
    private func extractPNGData(from data: Data, startingAt position: Int) -> Data? {
        // Look for PNG IEND chunk signature
        let iendSignature = "IEND".data(using: .utf8)!

        for i in (position + 8)..<(data.count - 8) {
            let range = i..<(i + 4)
            if data.subdata(in: range) == iendSignature {
                // PNG ends 8 bytes after IEND signature (4 bytes CRC + 4 bytes chunk length)
                let endPos = i + 8
                let range = position..<endPos
                return data.subdata(in: range)
            }
        }

        return nil
    }

    /// Extract PDF data by finding EOF marker
    private func extractPDFData(from data: Data, startingAt position: Int) -> Data? {
        // Look for PDF EOF marker
        let eofMarker = "%%EOF".data(using: .utf8)!

        for i in (position + 5)..<(data.count - 5) {
            let range = i..<(i + 5)
            if data.subdata(in: range) == eofMarker {
                let endPos = i + 5
                let range = position..<endPos
                return data.subdata(in: range)
            }
        }

        return nil
    }

    /// Detect MIME type from UTI string
    private func detectMimeTypeFromUTI(_ uti: String?) -> String {
        guard let uti = uti else { return "application/octet-stream" }

        switch uti {
        case "public.jpeg", "public.jpeg-2000":
            return "image/jpeg"
        case "public.png":
            return "image/png"
        case "public.tiff":
            return "image/tiff"
        case "com.adobe.pdf":
            return "application/pdf"
        case "public.mp3":
            return "audio/mpeg"
        case "public.mpeg-4":
            return "video/mp4"
        case "com.apple.quicktime-movie":
            return "video/quicktime"
        case "public.plain-text":
            return "text/plain"
        case "public.html":
            return "text/html"
        case "public.rtf":
            return "application/rtf"
        case "org.openxmlformats.wordprocessingml.document":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        case "com.microsoft.word.doc":
            return "application/msword"
        case "org.openxmlformats.spreadsheetml.sheet":
            return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        case "com.microsoft.excel.xls":
            return "application/vnd.ms-excel"
        default:
            return "application/octet-stream"
        }
    }

    // Helper enum for image format detection
    private enum ImageFormat {
        case jpeg, png
    }

    /// Process a batch of attachments concurrently
    private func processBatchAttachments(
        _ attachments: [ExtractedAttachment],
        noteId: String
    ) async throws -> [Result<StoredAttachment, AttachmentError>] {
        return try await withThrowingTaskGroup(of: Result<StoredAttachment, AttachmentError>.self) { group in
            for attachment in attachments {
                group.addTask {
                    do {
                        let stored = try await self.storeAttachment(
                            content: attachment.content,
                            originalFilename: attachment.filename,
                            mimeType: attachment.mimeType,
                            noteId: noteId
                        )
                        return .success(stored)
                    } catch {
                        return .failure(AttachmentError.processingFailed(attachment.filename, error))
                    }
                }
            }

            var results: [Result<StoredAttachment, AttachmentError>] = []
            for try await result in group {
                results.append(result)
            }
            return results
        }
    }

    /// Generate unique attachment ID
    private func generateAttachmentId(noteId: String, filename: String) -> String {
        let base = "\(noteId)-\(filename)"
        let hash = base.data(using: .utf8)?.base64EncodedString() ?? UUID().uuidString
        return "att-\(hash.prefix(16))"
    }

    /// Add attachment reference to node model
    private func addAttachmentReferenceToNode(noteId: String, attachmentId: String) async throws {
        // Update Node model to include attachment references in metadata
        try await database.write { db in
            // Get current node
            guard let node = try Node.fetchOne(db, sql: "SELECT * FROM nodes WHERE id = ?", arguments: [noteId]) else {
                throw AttachmentError.processingFailed("Node not found", DatabaseError.nodeNotFound(id: noteId))
            }

            // Get current attachment references from node metadata
            var attachmentIds: [String] = []
            if let existingContent = node.content,
               let existingData = existingContent.data(using: .utf8),
               let existingMetadata = try? JSONSerialization.jsonObject(with: existingData) as? [String: Any],
               let existingAttachments = existingMetadata["attachments"] as? [String] {
                attachmentIds = existingAttachments
            }

            // Add new attachment ID if not already present
            if !attachmentIds.contains(attachmentId) {
                attachmentIds.append(attachmentId)
            }

            // Create updated metadata
            var updatedMetadata: [String: Any] = [:]
            if let existingContent = node.content,
               let existingData = existingContent.data(using: .utf8),
               let existingDict = try? JSONSerialization.jsonObject(with: existingData) as? [String: Any] {
                updatedMetadata = existingDict
            }
            updatedMetadata["attachments"] = attachmentIds
            updatedMetadata["attachment_count"] = attachmentIds.count

            // Serialize updated metadata
            let updatedData = try JSONSerialization.data(withJSONObject: updatedMetadata)
            let updatedContent = String(data: updatedData, encoding: .utf8)

            // Update node in database
            try db.execute(sql: """
                UPDATE nodes
                SET content = ?, modified_at = ?
                WHERE id = ?
                """, arguments: [updatedContent, Date(), noteId])
        }

        print("AttachmentManager: Added attachment reference \(attachmentId) to node \(noteId)")
    }

    /// Get attachment count and total size for a node
    public func getAttachmentSummaryForNode(noteId: String) async throws -> AttachmentSummary {
        let attachments = try await getAttachmentsForNote(noteId: noteId)

        let totalSize = attachments.reduce(0) { $0 + $1.fileSize }
        let typeBreakdown = Dictionary(grouping: attachments, by: { $0.mimeType })
            .mapValues { $0.count }

        return AttachmentSummary(
            attachmentCount: attachments.count,
            totalSize: Int64(totalSize),
            typeBreakdown: typeBreakdown,
            attachments: attachments
        )
    }

    /// Export attachment for round-trip testing
    public func exportAttachment(attachmentId: String, to destinationURL: URL) async throws {
        let retrieved = try await retrieveAttachment(attachmentId: attachmentId)

        // Ensure destination directory exists
        let destinationDirectory = destinationURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: destinationDirectory, withIntermediateDirectories: true)

        // Write attachment content to destination
        try retrieved.content.write(to: destinationURL)

        // Create metadata sidecar file
        let metadataURL = destinationURL.appendingPathExtension("meta")
        let metadata: [String: Any] = [
            "original_filename": retrieved.metadata.originalFilename,
            "mime_type": retrieved.metadata.mimeType,
            "file_size": retrieved.metadata.fileSize,
            "note_id": retrieved.metadata.noteId,
            "content_hash": retrieved.metadata.contentHash,
            "created_at": ISO8601DateFormatter().string(from: retrieved.metadata.createdAt),
            "last_accessed_at": ISO8601DateFormatter().string(from: retrieved.metadata.lastAccessedAt)
        ]

        let metadataData = try JSONSerialization.data(withJSONObject: metadata, options: .prettyPrinted)
        try metadataData.write(to: metadataURL)

        print("AttachmentManager: Exported attachment \(attachmentId) to \(destinationURL.path)")
    }

    /// Support attachment search with advanced filtering
    public func searchAttachmentsAdvanced(
        filenamePattern: String? = nil,
        mimeTypePattern: String? = nil,
        sizeRange: Range<Int>? = nil,
        dateRange: ClosedRange<Date>? = nil,
        limit: Int = 100
    ) async throws -> [AttachmentInfo] {
        return try await database.read { db in
            var sql = "SELECT * FROM attachment_metadata WHERE 1=1"
            var argumentsArray: [Any] = []

            if let pattern = filenamePattern {
                sql += " AND original_filename LIKE ?"
                argumentsArray.append("%\(pattern)%")
            }

            if let mimePattern = mimeTypePattern {
                sql += " AND mime_type LIKE ?"
                argumentsArray.append("%\(mimePattern)%")
            }

            if let sizeRange = sizeRange {
                sql += " AND file_size >= ? AND file_size < ?"
                argumentsArray.append(sizeRange.lowerBound)
                argumentsArray.append(sizeRange.upperBound)
            }

            if let dateRange = dateRange {
                sql += " AND created_at >= ? AND created_at <= ?"
                argumentsArray.append(dateRange.lowerBound.timeIntervalSince1970)
                argumentsArray.append(dateRange.upperBound.timeIntervalSince1970)
            }

            sql += " ORDER BY last_accessed_at DESC LIMIT ?"
            argumentsArray.append(limit)

            let arguments = StatementArguments(argumentsArray) ?? StatementArguments()

            let metadataList = try AttachmentMetadata.fetchAll(db, sql: sql, arguments: arguments)

            return metadataList.map { metadata in
                AttachmentInfo(
                    id: metadata.id,
                    contentHash: metadata.contentHash,
                    originalFilename: metadata.originalFilename,
                    mimeType: metadata.mimeType,
                    fileSize: metadata.fileSize,
                    noteId: metadata.noteId,
                    createdAt: metadata.createdAt,
                    lastAccessedAt: metadata.lastAccessedAt
                )
            }
        }
    }
}

// MARK: - Data Types

/// Extracted attachment from Notes database
public struct ExtractedAttachment {
    public let filename: String
    public let mimeType: String
    public let content: Data
    public let originalId: String?

    public init(filename: String, mimeType: String, content: Data, originalId: String? = nil) {
        self.filename = filename
        self.mimeType = mimeType
        self.content = content
        self.originalId = originalId
    }
}

/// Stored attachment result
public struct StoredAttachment {
    public let id: String
    public let contentHash: String
    public let originalFilename: String
    public let mimeType: String
    public let fileSize: Int
    public let noteId: String
    public let wasDeduplication: Bool
}

/// Retrieved attachment with content
public struct RetrievedAttachment {
    public let content: Data
    public let metadata: AttachmentMetadata
}

/// Attachment information without content
public struct AttachmentInfo {
    public let id: String
    public let contentHash: String
    public let originalFilename: String
    public let mimeType: String
    public let fileSize: Int
    public let noteId: String
    public let createdAt: Date
    public let lastAccessedAt: Date

    public var isImage: Bool {
        return mimeType.hasPrefix("image/")
    }

    public var isDocument: Bool {
        return mimeType.hasPrefix("application/") || mimeType.hasPrefix("text/")
    }

    public var isMedia: Bool {
        return mimeType.hasPrefix("audio/") || mimeType.hasPrefix("video/")
    }

    public var fileExtension: String {
        return URL(fileURLWithPath: originalFilename).pathExtension.lowercased()
    }
}

/// Processing result for a single note
public struct AttachmentProcessingResult {
    public let noteId: String
    public var processedCount: Int = 0
    public var successfulAttachments: [StoredAttachment] = []
    public var failures: [AttachmentError] = []

    public var successRate: Double {
        guard processedCount > 0 else { return 0.0 }
        return Double(successfulAttachments.count) / Double(processedCount)
    }
}

/// Bulk processing result
public struct BulkAttachmentProcessingResult {
    public let noteResults: [AttachmentProcessingResult]
    public let totalProcessed: Int
    public let totalSuccessful: Int
    public let duration: TimeInterval

    public var overallSuccessRate: Double {
        guard totalProcessed > 0 else { return 0.0 }
        return Double(totalSuccessful) / Double(totalProcessed)
    }

    public var attachmentsPerSecond: Double {
        guard duration > 0 else { return 0.0 }
        return Double(totalProcessed) / duration
    }
}

/// Attachment processing metrics
public struct AttachmentProcessingMetrics: Codable {
    public var totalNotes: Int = 0
    public var totalAttachments: Int = 0
    public var successfulAttachments: Int = 0
    public var totalProcessingTime: TimeInterval = 0
    public var averageProcessingTime: TimeInterval = 0

    public mutating func recordProcessing(duration: TimeInterval, attachmentCount: Int, successCount: Int) {
        totalNotes += 1
        totalAttachments += attachmentCount
        successfulAttachments += successCount
        totalProcessingTime += duration
        averageProcessingTime = totalProcessingTime / Double(totalNotes)
    }

    public var successRate: Double {
        guard totalAttachments > 0 else { return 0.0 }
        return Double(successfulAttachments) / Double(totalAttachments)
    }
}

/// Attachment type statistics
public struct AttachmentTypeStats {
    public let mimeType: String
    public let count: Int
    public let totalSize: Int64
}

/// Comprehensive attachment statistics
public struct AttachmentStatistics {
    public let totalAttachments: Int
    public let totalSize: Int64
    public let typeBreakdown: [AttachmentTypeStats]
    public let largestAttachments: [AttachmentInfo]
    public let processingMetrics: AttachmentProcessingMetrics

    public var averageFileSize: Int {
        guard totalAttachments > 0 else { return 0 }
        return Int(totalSize) / totalAttachments
    }
}

/// Attachment processing errors
public enum AttachmentError: Error, LocalizedError {
    case extractionFailed(String, Error)
    case processingFailed(String, Error)
    case unsupportedType(String)
    case corruptedData(String)

    public var errorDescription: String? {
        switch self {
        case .extractionFailed(let filename, let error):
            return "Failed to extract attachment '\(filename)': \(error.localizedDescription)"
        case .processingFailed(let filename, let error):
            return "Failed to process attachment '\(filename)': \(error.localizedDescription)"
        case .unsupportedType(let mimeType):
            return "Unsupported attachment type: \(mimeType)"
        case .corruptedData(let filename):
            return "Corrupted attachment data: \(filename)"
        }
    }
}

/// Attachment summary for a node
public struct AttachmentSummary {
    public let attachmentCount: Int
    public let totalSize: Int64
    public let typeBreakdown: [String: Int]
    public let attachments: [AttachmentInfo]
}

/// Attachment record from Notes database
public struct AttachmentRecord {
    public let id: String
    public let filename: String?
    public let mimeType: String?
    public let uti: String?
    public let size: Int64?
    public let noteId: String

    public init(id: String, filename: String? = nil, mimeType: String? = nil, uti: String? = nil, size: Int64? = nil, noteId: String) {
        self.id = id
        self.filename = filename
        self.mimeType = mimeType
        self.uti = uti
        self.size = size
        self.noteId = noteId
    }
}

// MARK: - Helper Extensions
// chunked extension already defined in DataVerificationPipeline.swift

extension Result {
    var success: Success? {
        switch self {
        case .success(let value):
            return value
        case .failure:
            return nil
        }
    }

    var failure: Failure? {
        switch self {
        case .success:
            return nil
        case .failure(let error):
            return error
        }
    }
}