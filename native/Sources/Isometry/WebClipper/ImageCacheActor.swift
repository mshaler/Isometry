import Foundation
import CryptoKit

/// Actor for managing image downloads and caching with SHA-256 deduplication
public actor ImageCacheActor {
    private let cacheDirectory: URL
    private let deduplicator: ImageDeduplication
    private let maxCacheSize: Int64 = 500 * 1024 * 1024 // 500MB
    private let urlSession: URLSession

    public init() throws {
        // Create cache directory in Documents
        let documentsPath = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        self.cacheDirectory = documentsPath.appendingPathComponent("WebClipImages")

        try FileManager.default.createDirectory(at: cacheDirectory, withIntermediateDirectories: true, attributes: nil)

        self.deduplicator = ImageDeduplication(cacheDirectory: cacheDirectory)

        // Configure URLSession with privacy settings
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieAcceptPolicy = .never
        config.httpCookieStorage = nil
        config.urlCredentialStorage = nil
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        self.urlSession = URLSession(configuration: config)
    }

    // MARK: - Public Interface

    /// Downloads and caches images from HTML content, returning updated HTML with local references
    public func cacheImagesInHTML(_ html: String, baseURL: URL) async throws -> String {
        let imageURLs = extractImageURLs(from: html, baseURL: baseURL)
        var updatedHTML = html

        for imageURL in imageURLs {
            do {
                let localPath = try await downloadAndCacheImage(imageURL)
                let localURL = "file://" + localPath

                // Update HTML to reference local cached image
                updatedHTML = updatedHTML.replacingOccurrences(
                    of: imageURL.absoluteString,
                    with: localURL
                )
            } catch {
                print("Failed to cache image \(imageURL): \(error)")
                // Continue processing other images even if one fails
            }
        }

        return updatedHTML
    }

    /// Downloads and caches a single image, returning the local file path
    public func downloadAndCacheImage(_ url: URL) async throws -> String {
        // Check if already cached by URL
        if let existingPath = try await getCachedImagePath(for: url) {
            return existingPath
        }

        // Download image data
        let (data, response) = try await urlSession.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse,
              httpResponse.statusCode == 200 else {
            throw ImageCacheError.downloadFailed(url.absoluteString)
        }

        // Validate image data
        guard isValidImageData(data) else {
            throw ImageCacheError.invalidImageFormat(url.absoluteString)
        }

        // Check for deduplication
        let hash = calculateSHA256(data: data)
        if let existingPath = try await deduplicator.getExistingImagePath(for: hash) {
            // Image already exists, create symlink and return path
            try await createSymlinkForURL(url, targetPath: existingPath)
            return existingPath
        }

        // Save new image
        let filename = generateFilename(for: url, hash: hash, data: data)
        let imagePath = cacheDirectory.appendingPathComponent(filename).path

        try data.write(to: URL(fileURLWithPath: imagePath))

        // Register in deduplication system
        try await deduplicator.registerImage(hash: hash, path: imagePath, originalURL: url)

        // Manage cache size
        await manageCacheSize()

        return imagePath
    }

    /// Gets cached image path if it exists
    public func getCachedImagePath(for url: URL) async throws -> String? {
        return try await deduplicator.getCachedPath(for: url)
    }

    /// Clears old cached images to maintain size limits
    public func cleanupCache() async throws {
        await manageCacheSize()
        try await deduplicator.cleanupOrphanedEntries()
    }

    /// Returns cache statistics
    public func getCacheStatistics() async throws -> ImageCacheStatistics {
        let cacheSize = try await calculateCacheSize()
        let imageCount = try await deduplicator.getCachedImageCount()

        return ImageCacheStatistics(
            totalSize: cacheSize,
            imageCount: imageCount,
            maxSize: maxCacheSize,
            directory: cacheDirectory.path
        )
    }

    // MARK: - Private Implementation

    private func extractImageURLs(from html: String, baseURL: URL) -> [URL] {
        var imageURLs: [URL] = []

        // Extract img src attributes
        let imgPattern = "<img[^>]*src=[\"']([^\"']+)[\"'][^>]*>"
        if let regex = try? NSRegularExpression(pattern: imgPattern, options: .caseInsensitive) {
            let matches = regex.matches(in: html, range: NSRange(html.startIndex..., in: html))

            for match in matches {
                guard match.numberOfRanges >= 2 else { continue }

                let srcRange = match.range(at: 1)
                let srcString = String(html[Range(srcRange, in: html)!])

                if let url = resolveImageURL(srcString, baseURL: baseURL) {
                    imageURLs.append(url)
                }
            }
        }

        return imageURLs
    }

    private func resolveImageURL(_ urlString: String, baseURL: URL) -> URL? {
        // Absolute URL
        if urlString.hasPrefix("http") {
            return URL(string: urlString)
        }

        // Protocol-relative URL
        if urlString.hasPrefix("//") {
            return URL(string: "\(baseURL.scheme ?? "https"):\(urlString)")
        }

        // Absolute path
        if urlString.hasPrefix("/") {
            var components = URLComponents()
            components.scheme = baseURL.scheme
            components.host = baseURL.host
            components.port = baseURL.port
            components.path = urlString
            return components.url
        }

        // Relative path
        return baseURL.appendingPathComponent(urlString)
    }

    private func isValidImageData(_ data: Data) -> Bool {
        guard data.count > 4 else { return false }

        let bytes = data.prefix(4)

        // Check common image file signatures
        let signatures: [Data] = [
            Data([0xFF, 0xD8, 0xFF]), // JPEG
            Data([0x89, 0x50, 0x4E, 0x47]), // PNG
            Data([0x47, 0x49, 0x46, 0x38]), // GIF
            Data([0x52, 0x49, 0x46, 0x46]), // WebP (RIFF)
            Data([0x3C, 0x73, 0x76, 0x67]), // SVG (<svg)
        ]

        return signatures.contains { signature in
            bytes.starts(with: signature)
        }
    }

    private func calculateSHA256(data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func generateFilename(for url: URL, hash: String, data: Data) -> String {
        let pathExtension = url.pathExtension.isEmpty ? detectFileExtension(from: data) : url.pathExtension
        return "\(hash).\(pathExtension)"
    }

    private func detectFileExtension(from data: Data) -> String {
        guard data.count > 4 else { return "bin" }

        let bytes = data.prefix(4)

        if bytes.starts(with: Data([0xFF, 0xD8, 0xFF])) {
            return "jpg"
        } else if bytes.starts(with: Data([0x89, 0x50, 0x4E, 0x47])) {
            return "png"
        } else if bytes.starts(with: Data([0x47, 0x49, 0x46, 0x38])) {
            return "gif"
        } else if bytes.starts(with: Data([0x52, 0x49, 0x46, 0x46])) {
            return "webp"
        } else if bytes.starts(with: Data([0x3C, 0x73, 0x76, 0x67])) {
            return "svg"
        }

        return "bin"
    }

    private func createSymlinkForURL(_ url: URL, targetPath: String) async throws {
        // Create URL-to-path mapping for future lookups
        try await deduplicator.addURLMapping(url: url, path: targetPath)
    }

    private func manageCacheSize() async {
        do {
            let currentSize = try await calculateCacheSize()

            if currentSize > maxCacheSize {
                // Remove oldest files until under limit
                try await removeOldestCachedImages(targetSize: maxCacheSize * 80 / 100) // 80% of max
            }
        } catch {
            print("Failed to manage cache size: \(error)")
        }
    }

    private func calculateCacheSize() async throws -> Int64 {
        let fileManager = FileManager.default
        let files = try fileManager.contentsOfDirectory(atPath: cacheDirectory.path)

        var totalSize: Int64 = 0
        for file in files {
            let filePath = cacheDirectory.appendingPathComponent(file)
            let attributes = try fileManager.attributesOfItem(atPath: filePath.path)
            if let fileSize = attributes[.size] as? Int64 {
                totalSize += fileSize
            }
        }

        return totalSize
    }

    private func removeOldestCachedImages(targetSize: Int64) async throws {
        let fileManager = FileManager.default
        let files = try fileManager.contentsOfDirectory(atPath: cacheDirectory.path)

        // Get files with modification dates
        var fileInfos: [(path: String, date: Date, size: Int64)] = []

        for file in files {
            let filePath = cacheDirectory.appendingPathComponent(file)
            let attributes = try fileManager.attributesOfItem(atPath: filePath.path)

            if let modificationDate = attributes[.modificationDate] as? Date,
               let size = attributes[.size] as? Int64 {
                fileInfos.append((path: filePath.path, date: modificationDate, size: size))
            }
        }

        // Sort by modification date (oldest first)
        fileInfos.sort { $0.date < $1.date }

        var currentSize = try await calculateCacheSize()

        for fileInfo in fileInfos {
            if currentSize <= targetSize { break }

            try fileManager.removeItem(atPath: fileInfo.path)
            currentSize -= fileInfo.size

            // Also remove from deduplication tracking
            await deduplicator.removeImageAtPath(fileInfo.path)
        }
    }
}

// MARK: - Supporting Types

public struct ImageCacheStatistics {
    public let totalSize: Int64
    public let imageCount: Int
    public let maxSize: Int64
    public let directory: String
}

public enum ImageCacheError: Error, LocalizedError {
    case downloadFailed(String)
    case invalidImageFormat(String)
    case cacheDirectoryError(String)
    case deduplicationError(String)

    public var errorDescription: String? {
        switch self {
        case .downloadFailed(let url):
            return "Failed to download image from: \(url)"
        case .invalidImageFormat(let url):
            return "Invalid image format for: \(url)"
        case .cacheDirectoryError(let details):
            return "Cache directory error: \(details)"
        case .deduplicationError(let details):
            return "Deduplication error: \(details)"
        }
    }
}