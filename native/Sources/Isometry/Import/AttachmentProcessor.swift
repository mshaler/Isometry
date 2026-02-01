import Foundation
import IsometryCore

/// Processes images and attachments referenced in markdown content
public actor AttachmentProcessor {
    private let database: IsometryDatabase
    private let fileManager = FileManager.default

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public API

    /// Process all attachments found in markdown content
    public func processAttachments(
        in content: String,
        sourceNode: Node,
        basePath: URL
    ) async throws -> [ProcessedAttachment] {
        var attachments: [ProcessedAttachment] = []

        // Extract image references
        let images = extractImageReferences(from: content)
        for image in images {
            do {
                let processed = try await processImageAttachment(image, sourceNode: sourceNode, basePath: basePath)
                attachments.append(processed)
            } catch {
                print("Failed to process image \(image.path): \(error)")
            }
        }

        // Extract file attachments
        let files = extractFileAttachments(from: content)
        for file in files {
            do {
                let processed = try await processFileAttachment(file, sourceNode: sourceNode, basePath: basePath)
                attachments.append(processed)
            } catch {
                print("Failed to process file \(file.path): \(error)")
            }
        }

        return attachments
    }

    // MARK: - Attachment Extraction

    /// Extract image references from markdown content
    private func extractImageReferences(from content: String) -> [AttachmentReference] {
        var references: [AttachmentReference] = []

        // Pattern for image references: ![alt](path)
        let imagePattern = "!\\[([^\\]]*)\\]\\(([^)]+)\\)"
        let regex = try? NSRegularExpression(pattern: imagePattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex?.matches(in: content, options: [], range: range) ?? []

        for match in matches {
            if let altRange = Range(match.range(at: 1), in: content),
               let pathRange = Range(match.range(at: 2), in: content) {

                let altText = String(content[altRange])
                let path = String(content[pathRange])

                let reference = AttachmentReference(
                    type: .image,
                    path: path,
                    altText: altText.isEmpty ? nil : altText,
                    fullMatch: String(content[Range(match.range, in: content)!])
                )

                references.append(reference)
            }
        }

        return references
    }

    /// Extract file attachment references from markdown content
    private func extractFileAttachments(from content: String) -> [AttachmentReference] {
        var references: [AttachmentReference] = []

        // Pattern for file attachments: [text](path.ext) where ext is not an image
        let filePattern = "\\[([^\\]]+)\\]\\(([^)]+\\.[a-zA-Z0-9]+)\\)"
        let regex = try? NSRegularExpression(pattern: filePattern, options: [])
        let range = NSRange(content.startIndex..<content.endIndex, in: content)

        let matches = regex?.matches(in: content, options: [], range: range) ?? []

        for match in matches {
            if let textRange = Range(match.range(at: 1), in: content),
               let pathRange = Range(match.range(at: 2), in: content) {

                let linkText = String(content[textRange])
                let path = String(content[pathRange])

                // Skip if it's an image (handled by image extraction)
                let fileExtension = URL(fileURLWithPath: path).pathExtension.lowercased()
                let imageExtensions = ["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"]

                if !imageExtensions.contains(fileExtension) {
                    let reference = AttachmentReference(
                        type: .file,
                        path: path,
                        altText: linkText,
                        fullMatch: String(content[Range(match.range, in: content)!])
                    )

                    references.append(reference)
                }
            }
        }

        return references
    }

    // MARK: - Attachment Processing

    /// Process an image attachment
    private func processImageAttachment(
        _ reference: AttachmentReference,
        sourceNode: Node,
        basePath: URL
    ) async throws -> ProcessedAttachment {
        let resolvedPath = try resolveAttachmentPath(reference.path, basePath: basePath)
        let metadata = try await extractImageMetadata(resolvedPath)
        let secureLocation = try await copyAttachmentSecurely(resolvedPath, type: .image)

        let node = try await createAttachmentNode(
            reference: reference,
            metadata: metadata,
            secureLocation: secureLocation,
            sourceNode: sourceNode
        )

        return ProcessedAttachment(
            reference: reference,
            resolvedPath: resolvedPath,
            secureLocation: secureLocation,
            metadata: metadata,
            nodeId: node.id
        )
    }

    /// Process a file attachment
    private func processFileAttachment(
        _ reference: AttachmentReference,
        sourceNode: Node,
        basePath: URL
    ) async throws -> ProcessedAttachment {
        let resolvedPath = try resolveAttachmentPath(reference.path, basePath: basePath)
        let metadata = try await extractFileMetadata(resolvedPath)
        let secureLocation = try await copyAttachmentSecurely(resolvedPath, type: .file)

        let node = try await createAttachmentNode(
            reference: reference,
            metadata: metadata,
            secureLocation: secureLocation,
            sourceNode: sourceNode
        )

        return ProcessedAttachment(
            reference: reference,
            resolvedPath: resolvedPath,
            secureLocation: secureLocation,
            metadata: metadata,
            nodeId: node.id
        )
    }

    // MARK: - Path Resolution and Security

    /// Resolve attachment path relative to base path with security validation
    private func resolveAttachmentPath(_ path: String, basePath: URL) throws -> URL {
        // Handle different path formats
        let cleanPath = path.trimmingCharacters(in: .whitespaces)

        // If it's already an absolute path and exists
        if cleanPath.hasPrefix("/") {
            let absoluteURL = URL(fileURLWithPath: cleanPath)
            if fileManager.fileExists(atPath: absoluteURL.path) {
                try validatePathSecurity(absoluteURL, basePath: basePath)
                return absoluteURL
            }
        }

        // Try relative to base path
        let relativeURL = basePath.appendingPathComponent(cleanPath)
        if fileManager.fileExists(atPath: relativeURL.path) {
            try validatePathSecurity(relativeURL, basePath: basePath)
            return relativeURL
        }

        // If not found, return the relative path anyway (for external URLs or missing files)
        return basePath.appendingPathComponent(cleanPath)
    }

    /// Validate path security to prevent directory traversal attacks
    private func validatePathSecurity(_ path: URL, basePath: URL) throws {
        let resolvedPath = path.resolvingSymlinksInPath()
        let resolvedBasePath = basePath.resolvingSymlinksInPath()

        // Ensure the resolved path is within the base path
        if !resolvedPath.path.hasPrefix(resolvedBasePath.path) {
            throw AttachmentError.pathTraversalAttempt(path.path)
        }

        // Additional security checks
        let filename = resolvedPath.lastPathComponent.lowercased()

        // Block potentially dangerous file types
        let dangerousExtensions = ["exe", "scr", "bat", "cmd", "com", "pif", "vbs", "js", "jar"]
        let fileExtension = resolvedPath.pathExtension.lowercased()

        if dangerousExtensions.contains(fileExtension) {
            throw AttachmentError.dangerousFileType(fileExtension)
        }

        // Block hidden system files
        if filename.hasPrefix(".") && filename.contains("system") {
            throw AttachmentError.systemFileAccess(filename)
        }
    }

    /// Copy attachment to secure location within app container
    private func copyAttachmentSecurely(_ sourcePath: URL, type: AttachmentType) async throws -> URL {
        // Create secure attachments directory
        let documentsPath = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first!
        let attachmentsDir = documentsPath.appendingPathComponent("attachments/\(type.rawValue)")

        try fileManager.createDirectory(at: attachmentsDir, withIntermediateDirectories: true)

        // Generate unique filename to avoid conflicts
        let originalName = sourcePath.lastPathComponent
        let fileExtension = sourcePath.pathExtension
        let baseName = originalName.replacingOccurrences(of: ".\(fileExtension)", with: "")
        let uniqueName = "\(baseName)_\(UUID().uuidString).\(fileExtension)"

        let destinationPath = attachmentsDir.appendingPathComponent(uniqueName)

        // Copy file
        try fileManager.copyItem(at: sourcePath, to: destinationPath)

        return destinationPath
    }

    // MARK: - Metadata Extraction

    /// Extract metadata from image files
    private func extractImageMetadata(_ path: URL) async throws -> AttachmentMetadata {
        var metadata = AttachmentMetadata(
            fileName: path.lastPathComponent,
            fileSize: 0,
            mimeType: mimeType(for: path),
            createdAt: Date(),
            modifiedAt: Date()
        )

        // Get file attributes
        if let attributes = try? fileManager.attributesOfItem(atPath: path.path) {
            metadata.fileSize = attributes[.size] as? Int64 ?? 0
            metadata.createdAt = attributes[.creationDate] as? Date ?? Date()
            metadata.modifiedAt = attributes[.modificationDate] as? Date ?? Date()
        }

        // For images, try to extract image-specific metadata
        if let imageData = try? Data(contentsOf: path) {
            // Basic image metadata - could be enhanced with CoreGraphics for more details
            metadata.imageWidth = nil  // Would need CoreGraphics to extract
            metadata.imageHeight = nil
        }

        return metadata
    }

    /// Extract metadata from general files
    private func extractFileMetadata(_ path: URL) async throws -> AttachmentMetadata {
        var metadata = AttachmentMetadata(
            fileName: path.lastPathComponent,
            fileSize: 0,
            mimeType: mimeType(for: path),
            createdAt: Date(),
            modifiedAt: Date()
        )

        // Get file attributes
        if let attributes = try? fileManager.attributesOfItem(atPath: path.path) {
            metadata.fileSize = attributes[.size] as? Int64 ?? 0
            metadata.createdAt = attributes[.creationDate] as? Date ?? Date()
            metadata.modifiedAt = attributes[.modificationDate] as? Date ?? Date()
        }

        return metadata
    }

    /// Determine MIME type for file
    private func mimeType(for url: URL) -> String {
        let fileExtension = url.pathExtension.lowercased()

        let mimeTypes: [String: String] = [
            // Images
            "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "gif": "image/gif", "bmp": "image/bmp", "svg": "image/svg+xml",
            "webp": "image/webp",

            // Documents
            "pdf": "application/pdf", "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt": "application/vnd.ms-powerpoint",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",

            // Text
            "txt": "text/plain", "md": "text/markdown", "html": "text/html",
            "css": "text/css", "js": "text/javascript", "json": "application/json",

            // Archives
            "zip": "application/zip", "rar": "application/x-rar-compressed",
            "7z": "application/x-7z-compressed", "tar": "application/x-tar",

            // Audio/Video
            "mp3": "audio/mpeg", "wav": "audio/wav", "mp4": "video/mp4",
            "avi": "video/x-msvideo", "mov": "video/quicktime"
        ]

        return mimeTypes[fileExtension] ?? "application/octet-stream"
    }

    /// Create a node for the attachment
    private func createAttachmentNode(
        reference: AttachmentReference,
        metadata: AttachmentMetadata,
        secureLocation: URL,
        sourceNode: Node
    ) async throws -> Node {
        let nodeType = reference.type == .image ? "image" : "attachment"
        let nodeName = reference.altText ?? metadata.fileName

        // Create content with metadata
        var contentParts: [String] = []
        contentParts.append("File: \(metadata.fileName)")
        contentParts.append("Type: \(metadata.mimeType)")
        contentParts.append("Size: \(formatFileSize(metadata.fileSize))")

        if let width = metadata.imageWidth, let height = metadata.imageHeight {
            contentParts.append("Dimensions: \(width)×\(height)")
        }

        let content = contentParts.joined(separator: "\n")

        let node = Node(
            nodeType: nodeType,
            name: nodeName,
            content: content,
            summary: "Attachment: \(metadata.fileName)",
            createdAt: metadata.createdAt,
            modifiedAt: metadata.modifiedAt,
            folder: sourceNode.folder,
            source: "attachment",
            sourceId: "attachment-\(secureLocation.lastPathComponent)",
            sourceUrl: secureLocation.path
        )

        try await database.createNode(node)

        // Create edge from source node to attachment
        let edge = Edge(
            edgeType: .link,
            sourceId: sourceNode.id,
            targetId: node.id,
            label: reference.type == .image ? "Contains image" : "Contains attachment",
            weight: 0.6
        )

        try await database.createEdge(edge)

        return node
    }

    /// Format file size in human-readable format
    private func formatFileSize(_ bytes: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: bytes)
    }
}

// MARK: - Supporting Types

public enum AttachmentType: String, Sendable {
    case image = "images"
    case file = "files"
}

public struct AttachmentReference: Sendable {
    public let type: AttachmentType
    public let path: String
    public let altText: String?
    public let fullMatch: String

    public init(type: AttachmentType, path: String, altText: String?, fullMatch: String) {
        self.type = type
        self.path = path
        self.altText = altText
        self.fullMatch = fullMatch
    }
}

public struct ProcessedAttachment: Sendable {
    public let reference: AttachmentReference
    public let resolvedPath: URL
    public let secureLocation: URL
    public let metadata: AttachmentMetadata
    public let nodeId: String

    public init(
        reference: AttachmentReference,
        resolvedPath: URL,
        secureLocation: URL,
        metadata: AttachmentMetadata,
        nodeId: String
    ) {
        self.reference = reference
        self.resolvedPath = resolvedPath
        self.secureLocation = secureLocation
        self.metadata = metadata
        self.nodeId = nodeId
    }
}

public struct AttachmentMetadata: Sendable {
    public var fileName: String
    public var fileSize: Int64
    public var mimeType: String
    public var createdAt: Date
    public var modifiedAt: Date
    public var imageWidth: Int?
    public var imageHeight: Int?

    public init(
        fileName: String,
        fileSize: Int64,
        mimeType: String,
        createdAt: Date,
        modifiedAt: Date,
        imageWidth: Int? = nil,
        imageHeight: Int? = nil
    ) {
        self.fileName = fileName
        self.fileSize = fileSize
        self.mimeType = mimeType
        self.createdAt = createdAt
        self.modifiedAt = modifiedAt
        self.imageWidth = imageWidth
        self.imageHeight = imageHeight
    }
}

public enum AttachmentError: Error, LocalizedError {
    case pathTraversalAttempt(String)
    case dangerousFileType(String)
    case systemFileAccess(String)
    case fileCopyFailed(String)

    public var errorDescription: String? {
        switch self {
        case .pathTraversalAttempt(let path):
            return "Path traversal attempt detected: \(path)"
        case .dangerousFileType(let ext):
            return "Dangerous file type not allowed: \(ext)"
        case .systemFileAccess(let filename):
            return "System file access not allowed: \(filename)"
        case .fileCopyFailed(let reason):
            return "Failed to copy file: \(reason)"
        }
    }
}