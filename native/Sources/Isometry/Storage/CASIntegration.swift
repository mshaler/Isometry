import Foundation
import CryptoKit

/// Content-Addressable Storage implementation for efficient file storage and deduplication
/// Uses SHA-256 content hashing with hierarchical directory structure
public actor CASIntegration {

    // Storage configuration
    private let basePath: URL
    private let maxFileSize: Int64
    private let compressionThreshold: Int64

    // Reference counting for garbage collection
    private var referenceCount: [String: Int] = [:]
    private var storageStats = CASStorageStats()

    // File operations queue for atomic operations
    private let fileQueue = DispatchQueue(label: "cas.file.operations", qos: .utility)

    public init(basePath: URL, maxFileSize: Int64 = 100_000_000, compressionThreshold: Int64 = 1_000_000) {
        self.basePath = basePath
        self.maxFileSize = maxFileSize
        self.compressionThreshold = compressionThreshold

        Task {
            await initializeStorage()
            await loadReferenceCountsFromDisk()
        }
    }

    // MARK: - Storage Operations

    /// Store content in CAS and return content hash
    public func store(content: Data, originalFilename: String? = nil, mimeType: String? = nil) async throws -> CASStorageResult {
        // Validate file size
        guard content.count <= maxFileSize else {
            throw CASError.fileTooLarge(content.count, maxFileSize)
        }

        // Calculate content hash
        let hash = calculateHash(for: content)
        let hashString = hash.hexString

        // Check if content already exists
        if await contentExists(hash: hashString) {
            await incrementReferenceCount(for: hashString)
            storageStats.deduplicationSaves += 1
            return CASStorageResult(
                contentHash: hashString,
                storagePath: getStoragePath(for: hashString),
                wasStored: false,
                originalSize: content.count,
                storedSize: 0 // Not stored, already exists
            )
        }

        // Prepare storage content (with optional compression)
        let storageContent = shouldCompress(content) ? try compress(content) : content
        let storagePath = getStoragePath(for: hashString)

        // Ensure directory exists
        try createDirectoryIfNeeded(for: storagePath)

        // Store content atomically
        try await withCheckedThrowingContinuation { continuation in
            fileQueue.async {
                do {
                    try storageContent.write(to: storagePath, options: .atomic)
                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }

        // Verify content integrity
        try await verifyStoredContent(hash: hashString, originalContent: content)

        // Update reference counting and statistics
        await incrementReferenceCount(for: hashString)
        storageStats.totalFiles += 1
        storageStats.totalSize += Int64(storageContent.count)
        storageStats.originalSize += Int64(content.count)

        // Store metadata if provided
        if let filename = originalFilename, let mime = mimeType {
            await storeMetadata(
                for: hashString,
                filename: filename,
                mimeType: mime,
                originalSize: content.count,
                compressedSize: storageContent.count
            )
        }

        print("CAS: Stored content \(hashString) (original: \(content.count) bytes, stored: \(storageContent.count) bytes)")

        return CASStorageResult(
            contentHash: hashString,
            storagePath: storagePath,
            wasStored: true,
            originalSize: content.count,
            storedSize: storageContent.count
        )
    }

    /// Retrieve content by hash
    public func retrieve(contentHash: String) async throws -> Data {
        let storagePath = getStoragePath(for: contentHash)

        guard FileManager.default.fileExists(atPath: storagePath.path) else {
            throw CASError.contentNotFound(contentHash)
        }

        // Load stored content
        let storedContent = try await withCheckedThrowingContinuation { continuation in
            fileQueue.async {
                do {
                    let data = try Data(contentsOf: storagePath)
                    continuation.resume(returning: data)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }

        // Decompress if needed
        let originalContent = try isCompressed(storedContent) ? decompress(storedContent) : storedContent

        // Verify content integrity
        let calculatedHash = calculateHash(for: originalContent).hexString
        guard calculatedHash == contentHash else {
            throw CASError.contentCorrupted(contentHash, calculatedHash)
        }

        return originalContent
    }

    /// Check if content exists by hash
    public func contentExists(hash: String) async -> Bool {
        let storagePath = getStoragePath(for: hash)
        return FileManager.default.fileExists(atPath: storagePath.path)
    }

    /// Retrieve metadata for content
    public func getMetadata(for contentHash: String) async -> CASMetadata? {
        let metadataPath = getMetadataPath(for: contentHash)

        guard FileManager.default.fileExists(atPath: metadataPath.path) else {
            return nil
        }

        do {
            let data = try Data(contentsOf: metadataPath)
            return try JSONDecoder().decode(CASMetadata.self, from: data)
        } catch {
            print("CAS: Failed to load metadata for \(contentHash): \(error)")
            return nil
        }
    }

    // MARK: - Reference Counting and Garbage Collection

    /// Increment reference count for content
    public func incrementReferenceCount(for contentHash: String) async {
        referenceCount[contentHash] = (referenceCount[contentHash] ?? 0) + 1
        await saveReferenceCountsToDisk()
    }

    /// Decrement reference count for content
    public func decrementReferenceCount(for contentHash: String) async {
        guard let currentCount = referenceCount[contentHash], currentCount > 0 else {
            return
        }

        if currentCount == 1 {
            referenceCount.removeValue(forKey: contentHash)
            await markForGarbageCollection(contentHash: contentHash)
        } else {
            referenceCount[contentHash] = currentCount - 1
        }

        await saveReferenceCountsToDisk()
    }

    /// Perform garbage collection for unreferenced content
    public func performGarbageCollection() async throws -> CASGarbageCollectionResult {
        var deletedFiles = 0
        var reclaimedSpace: Int64 = 0

        // Find all stored content files
        let casDirectory = basePath.appendingPathComponent("cas")
        let fileManager = FileManager.default

        guard let enumerator = fileManager.enumerator(
            at: casDirectory,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else {
            throw CASError.storageAccessError("Failed to enumerate CAS directory")
        }

        for case let fileURL as URL in enumerator {
            let filename = fileURL.lastPathComponent

            // Skip metadata files and directories
            guard !filename.hasSuffix(".meta") && !filename.contains(".") else {
                continue
            }

            // Check if content has references
            if referenceCount[filename] == nil {
                // Content is unreferenced, mark for deletion
                do {
                    let fileSize = try fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    try fileManager.removeItem(at: fileURL)

                    // Also remove metadata file if it exists
                    let metadataURL = getMetadataPath(for: filename)
                    if fileManager.fileExists(atPath: metadataURL.path) {
                        try fileManager.removeItem(at: metadataURL)
                    }

                    deletedFiles += 1
                    reclaimedSpace += Int64(fileSize)

                    print("CAS: Garbage collected unreferenced content \(filename)")
                } catch {
                    print("CAS: Failed to delete unreferenced content \(filename): \(error)")
                }
            }
        }

        // Update storage statistics
        storageStats.totalFiles -= deletedFiles
        storageStats.totalSize -= reclaimedSpace

        return CASGarbageCollectionResult(
            deletedFiles: deletedFiles,
            reclaimedSpace: reclaimedSpace
        )
    }

    /// Get current storage statistics
    public func getStorageStats() async -> CASStorageStats {
        // Update real-time statistics
        await updateStorageStats()
        return storageStats
    }

    // MARK: - Private Implementation

    /// Initialize storage directory structure
    private func initializeStorage() async {
        let casDirectory = basePath.appendingPathComponent("cas")
        let metadataDirectory = basePath.appendingPathComponent("metadata")

        do {
            try FileManager.default.createDirectory(at: casDirectory, withIntermediateDirectories: true)
            try FileManager.default.createDirectory(at: metadataDirectory, withIntermediateDirectories: true)
            print("CAS: Initialized storage at \(basePath.path)")
        } catch {
            print("CAS: Failed to initialize storage: \(error)")
        }
    }

    /// Calculate SHA-256 hash for content
    private func calculateHash(for content: Data) -> SHA256Digest {
        return SHA256.hash(data: content)
    }

    /// Get storage path for content hash
    private func getStoragePath(for contentHash: String) -> URL {
        // Use hierarchical directory structure: /cas/[first-2-chars]/[hash]
        let prefix = String(contentHash.prefix(2))
        return basePath
            .appendingPathComponent("cas")
            .appendingPathComponent(prefix)
            .appendingPathComponent(contentHash)
    }

    /// Get metadata path for content hash
    private func getMetadataPath(for contentHash: String) -> URL {
        return basePath
            .appendingPathComponent("metadata")
            .appendingPathComponent("\(contentHash).meta")
    }

    /// Create directory if needed for storage path
    private func createDirectoryIfNeeded(for storagePath: URL) throws {
        let directory = storagePath.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    }

    /// Verify stored content integrity
    private func verifyStoredContent(hash: String, originalContent: Data) async throws {
        let retrievedContent = try await retrieve(contentHash: hash)
        let retrievedHash = calculateHash(for: retrievedContent).hexString

        guard hash == retrievedHash else {
            throw CASError.verificationFailed(hash, retrievedHash)
        }
    }

    /// Store metadata for content
    private func storeMetadata(for contentHash: String, filename: String, mimeType: String, originalSize: Int, compressedSize: Int) async {
        let metadata = CASMetadata(
            contentHash: contentHash,
            originalFilename: filename,
            mimeType: mimeType,
            originalSize: originalSize,
            compressedSize: compressedSize,
            createdAt: Date(),
            lastAccessedAt: Date()
        )

        do {
            let metadataData = try JSONEncoder().encode(metadata)
            let metadataPath = getMetadataPath(for: contentHash)
            try metadataData.write(to: metadataPath)
        } catch {
            print("CAS: Failed to store metadata for \(contentHash): \(error)")
        }
    }

    /// Check if content should be compressed
    private func shouldCompress(_ content: Data) -> Bool {
        return content.count >= compressionThreshold
    }

    /// Compress content using zlib
    private func compress(_ content: Data) throws -> Data {
        return try (content as NSData).compressed(using: .zlib) as Data
    }

    /// Decompress content
    private func decompress(_ content: Data) throws -> Data {
        return try (content as NSData).decompressed(using: .zlib) as Data
    }

    /// Check if content is compressed
    private func isCompressed(_ content: Data) -> Bool {
        // Check for zlib header
        return content.count >= 2 && content[0] == 0x78 && (content[1] == 0x01 || content[1] == 0x9C || content[1] == 0xDA)
    }

    /// Mark content for garbage collection
    private func markForGarbageCollection(contentHash: String) async {
        // For now, just log. In production, this could maintain a queue for deferred cleanup
        print("CAS: Marked content \(contentHash) for garbage collection")
    }

    /// Load reference counts from persistent storage
    private func loadReferenceCountsFromDisk() async {
        let referenceCountPath = basePath.appendingPathComponent("reference_counts.json")

        guard FileManager.default.fileExists(atPath: referenceCountPath.path) else {
            return
        }

        do {
            let data = try Data(contentsOf: referenceCountPath)
            referenceCount = try JSONDecoder().decode([String: Int].self, from: data)
            print("CAS: Loaded \(referenceCount.count) reference counts from disk")
        } catch {
            print("CAS: Failed to load reference counts: \(error)")
        }
    }

    /// Save reference counts to persistent storage
    private func saveReferenceCountsToDisk() async {
        let referenceCountPath = basePath.appendingPathComponent("reference_counts.json")

        do {
            let data = try JSONEncoder().encode(referenceCount)
            try data.write(to: referenceCountPath)
        } catch {
            print("CAS: Failed to save reference counts: \(error)")
        }
    }

    /// Update storage statistics from file system
    private func updateStorageStats() async {
        let casDirectory = basePath.appendingPathComponent("cas")
        let fileManager = FileManager.default

        var totalFiles = 0
        var totalSize: Int64 = 0

        guard let enumerator = fileManager.enumerator(
            at: casDirectory,
            includingPropertiesForKeys: [.fileSizeKey],
            options: [.skipsHiddenFiles]
        ) else {
            return
        }

        for case let fileURL as URL in enumerator {
            let filename = fileURL.lastPathComponent

            // Skip directories and metadata files
            guard !filename.contains(".") else {
                continue
            }

            do {
                let fileSize = try fileURL.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                totalFiles += 1
                totalSize += Int64(fileSize)
            } catch {
                print("CAS: Failed to get file size for \(filename): \(error)")
            }
        }

        storageStats.totalFiles = totalFiles
        storageStats.totalSize = totalSize
    }
}

// MARK: - Data Types

/// Content-Addressable Storage result
public struct CASStorageResult {
    public let contentHash: String
    public let storagePath: URL
    public let wasStored: Bool
    public let originalSize: Int
    public let storedSize: Int

    public var compressionRatio: Double {
        guard originalSize > 0 else { return 1.0 }
        return Double(storedSize) / Double(originalSize)
    }
}

/// CAS metadata structure
public struct CASMetadata: Codable {
    public let contentHash: String
    public let originalFilename: String
    public let mimeType: String
    public let originalSize: Int
    public let compressedSize: Int
    public let createdAt: Date
    public let lastAccessedAt: Date
}

/// Storage statistics
public struct CASStorageStats {
    public var totalFiles: Int = 0
    public var totalSize: Int64 = 0
    public var originalSize: Int64 = 0
    public var deduplicationSaves: Int = 0

    public var compressionRatio: Double {
        guard originalSize > 0 else { return 1.0 }
        return Double(totalSize) / Double(originalSize)
    }

    public var spaceSaved: Int64 {
        return originalSize - totalSize
    }
}

/// Garbage collection result
public struct CASGarbageCollectionResult {
    public let deletedFiles: Int
    public let reclaimedSpace: Int64
}

/// CAS error types
public enum CASError: Error, LocalizedError {
    case fileTooLarge(Int, Int64)
    case contentNotFound(String)
    case contentCorrupted(String, String)
    case verificationFailed(String, String)
    case storageAccessError(String)
    case compressionError(String)

    public var errorDescription: String? {
        switch self {
        case .fileTooLarge(let size, let maxSize):
            return "File size \(size) exceeds maximum allowed size \(maxSize)"
        case .contentNotFound(let hash):
            return "Content not found for hash: \(hash)"
        case .contentCorrupted(let expected, let actual):
            return "Content corrupted: expected \(expected), got \(actual)"
        case .verificationFailed(let expected, let actual):
            return "Content verification failed: expected \(expected), got \(actual)"
        case .storageAccessError(let details):
            return "Storage access error: \(details)"
        case .compressionError(let details):
            return "Compression error: \(details)"
        }
    }
}

// MARK: - Helper Extensions

extension SHA256Digest {
    var hexString: String {
        return map { String(format: "%02x", $0) }.joined()
    }
}