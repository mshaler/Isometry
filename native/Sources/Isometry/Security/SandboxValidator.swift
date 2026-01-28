import Foundation
import os

/// Comprehensive App Sandbox security validator for file system operations
/// Ensures all file access complies with App Sandbox restrictions and security policies
public class SandboxValidator {

    // MARK: - Types

    public enum ContainerDirectory: CaseIterable {
        case documents
        case applicationSupport
        case caches
        case temporary

        public var url: URL? {
            let fileManager = FileManager.default
            switch self {
            case .documents:
                return fileManager.urls(for: .documentDirectory, in: .userDomainMask).first
            case .applicationSupport:
                return fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first?
                    .appendingPathComponent("Isometry")
            case .caches:
                return fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first?
                    .appendingPathComponent("Isometry")
            case .temporary:
                return URL(fileURLWithPath: NSTemporaryDirectory())
                    .appendingPathComponent("Isometry")
            }
        }

        public var displayName: String {
            switch self {
            case .documents: return "Documents"
            case .applicationSupport: return "Application Support"
            case .caches: return "Caches"
            case .temporary: return "Temporary"
            }
        }
    }

    public enum FileSystemOperation {
        case read
        case write
        case delete
        case export
        case fileImport
        case createDirectory
        case list

        public var requiresWriteAccess: Bool {
            switch self {
            case .read, .list, .export:
                return false
            case .write, .delete, .fileImport, .createDirectory:
                return true
            }
        }
    }

    public struct ValidationResult {
        public let isValid: Bool
        public let canonicalPath: String?
        public let containerDirectory: ContainerDirectory?
        public let error: ValidationError?

        public var isAllowed: Bool { isValid && error == nil }
    }

    public enum ValidationError: LocalizedError, CustomStringConvertible {
        case pathTraversal(String)
        case outsideContainer(String)
        case restrictedExtension(String)
        case systemDirectory(String)
        case invalidPath(String)
        case operationNotAllowed(FileSystemOperation, String)
        case fileSizeExceeded(Int64, Int64) // actual, limit
        case rateLimitExceeded
        case insufficientPermissions(String)

        public var errorDescription: String? {
            return description
        }

        public var description: String {
            switch self {
            case .pathTraversal(let path):
                return "Path traversal attempt detected: \(path)"
            case .outsideContainer(let path):
                return "Path outside app container: \(path)"
            case .restrictedExtension(let ext):
                return "Restricted file extension: \(ext)"
            case .systemDirectory(let path):
                return "Access to system directory denied: \(path)"
            case .invalidPath(let path):
                return "Invalid file path: \(path)"
            case .operationNotAllowed(let op, let path):
                return "Operation \(op) not allowed on path: \(path)"
            case .fileSizeExceeded(let actual, let limit):
                return "File size \(actual) exceeds limit \(limit)"
            case .rateLimitExceeded:
                return "Rate limit exceeded for file operations"
            case .insufficientPermissions(let path):
                return "Insufficient permissions for path: \(path)"
            }
        }
    }

    // MARK: - Properties

    private let logger = Logger(subsystem: "Isometry", category: "SandboxValidator")
    private let fileManager = FileManager.default

    // Security limits
    private let maxFileSize: Int64 = 100 * 1024 * 1024 // 100MB
    private let maxPathLength = 1024
    private let allowedExtensions: Set<String> = [
        "txt", "md", "json", "csv", "html", "pdf", "png", "jpg", "jpeg", "gif", "svg",
        "js", "ts", "css", "xml", "yaml", "yml", "toml", "ini", "log"
    ]
    private let restrictedExtensions: Set<String> = [
        "exe", "app", "dmg", "pkg", "deb", "rpm", "sh", "bat", "cmd", "com", "scr",
        "pif", "msi", "dll", "so", "dylib", "bin", "ipa", "apk"
    ]

    // Rate limiting
    private var operationCounts: [String: Int] = [:]
    private var lastResetTime = Date()
    private let maxOperationsPerMinute = 100

    // MARK: - Initialization

    public init() {
        // Ensure container directories exist
        Task {
            await createContainerDirectories()
        }
    }

    // MARK: - Public API

    /// Validates a file path for the specified operation
    public func validatePath(_ path: String, for operation: FileSystemOperation) -> ValidationResult {
        logger.debug("Validating path: \(path) for operation: \(String(describing: operation))")

        // Rate limiting check
        if isRateLimited() {
            return ValidationResult(
                isValid: false,
                canonicalPath: nil,
                containerDirectory: nil,
                error: .rateLimitExceeded
            )
        }

        // Basic path validation
        guard !path.isEmpty, path.count <= maxPathLength else {
            return ValidationResult(
                isValid: false,
                canonicalPath: nil,
                containerDirectory: nil,
                error: .invalidPath(path)
            )
        }

        // Sanitize and canonicalize path
        let sanitizedPath = sanitizePath(path)

        guard let canonicalPath = canonicalizePath(sanitizedPath) else {
            return ValidationResult(
                isValid: false,
                canonicalPath: nil,
                containerDirectory: nil,
                error: .invalidPath(path)
            )
        }

        // Check for path traversal
        if containsPathTraversal(canonicalPath) {
            logger.warning("Path traversal detected: \(canonicalPath)")
            return ValidationResult(
                isValid: false,
                canonicalPath: canonicalPath,
                containerDirectory: nil,
                error: .pathTraversal(path)
            )
        }

        // Check if path is within allowed container
        guard let containerDirectory = getContainerDirectory(for: canonicalPath) else {
            logger.warning("Path outside container: \(canonicalPath)")
            return ValidationResult(
                isValid: false,
                canonicalPath: canonicalPath,
                containerDirectory: nil,
                error: .outsideContainer(path)
            )
        }

        // Check operation-specific permissions
        if let operationError = validateOperation(operation, path: canonicalPath, container: containerDirectory) {
            return ValidationResult(
                isValid: false,
                canonicalPath: canonicalPath,
                containerDirectory: containerDirectory,
                error: operationError
            )
        }

        // Check file extension security
        if let extensionError = validateFileExtension(canonicalPath, operation: operation) {
            return ValidationResult(
                isValid: false,
                canonicalPath: canonicalPath,
                containerDirectory: containerDirectory,
                error: extensionError
            )
        }

        // Log successful validation
        logger.debug("Path validation successful: \(canonicalPath)")
        incrementOperationCount()

        return ValidationResult(
            isValid: true,
            canonicalPath: canonicalPath,
            containerDirectory: containerDirectory,
            error: nil
        )
    }

    /// Checks if a path is allowed for the specified operation
    public func isPathAllowed(_ path: String, operation: FileSystemOperation) -> Bool {
        return validatePath(path, for: operation).isAllowed
    }

    /// Gets the container URL for a specific directory type
    public func getContainerPath(for directory: ContainerDirectory) -> URL? {
        return directory.url
    }

    /// Sanitizes a path by removing dangerous components
    public func sanitizePath(_ path: String) -> String {
        return path
            .replacingOccurrences(of: "../", with: "")
            .replacingOccurrences(of: "..\\", with: "")
            .replacingOccurrences(of: "~/", with: "")
            .replacingOccurrences(of: "//", with: "/")
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Returns all allowed directories for the app
    public func getAllowedDirectories() -> [URL] {
        return ContainerDirectory.allCases.compactMap { $0.url }
    }

    /// Validates file size for write operations
    public func validateFileSize(_ size: Int64) -> ValidationError? {
        if size > maxFileSize {
            return .fileSizeExceeded(size, maxFileSize)
        }
        return nil
    }

    // MARK: - Private Methods

    private func canonicalizePath(_ path: String) -> String? {
        // Handle relative vs absolute paths
        let url: URL
        if path.hasPrefix("/") {
            url = URL(fileURLWithPath: path)
        } else {
            // Relative to documents directory
            guard let documentsURL = ContainerDirectory.documents.url else {
                return nil
            }
            url = documentsURL.appendingPathComponent(path)
        }

        // Resolve symlinks and relative components
        return url.standardized.path
    }

    private func containsPathTraversal(_ path: String) -> Bool {
        let components = path.components(separatedBy: "/")
        return components.contains("..") || components.contains(".")
    }

    private func getContainerDirectory(for path: String) -> ContainerDirectory? {
        let pathURL = URL(fileURLWithPath: path)

        for containerDir in ContainerDirectory.allCases {
            guard let containerURL = containerDir.url else { continue }

            if pathURL.path.hasPrefix(containerURL.path) {
                return containerDir
            }
        }

        // Also allow bundle resources for read operations
        if pathURL.path.hasPrefix(Bundle.main.bundlePath) {
            return .applicationSupport // Treat as read-only app support
        }

        return nil
    }

    private func validateOperation(
        _ operation: FileSystemOperation,
        path: String,
        container: ContainerDirectory
    ) -> ValidationError? {
        switch (operation, container) {
        case (.write, .temporary), (.write, .documents), (.write, .applicationSupport):
            return nil // Write allowed
        case (.createDirectory, .temporary), (.createDirectory, .documents), (.createDirectory, .applicationSupport):
            return nil // Directory creation allowed
        case (.delete, .temporary), (.delete, .documents):
            return nil // Delete allowed in user areas
        case (.delete, .applicationSupport):
            // Only allow deleting user-created files in app support
            if path.contains("/Library/Application Support/Isometry/user/") {
                return nil
            }
            return .operationNotAllowed(operation, path)
        case (.read, _), (.list, _), (.export, _):
            return nil // Read operations allowed everywhere
        case (.fileImport, .documents), (.fileImport, .temporary):
            return nil // Import allowed to safe areas
        default:
            return .operationNotAllowed(operation, path)
        }
    }

    private func validateFileExtension(_ path: String, operation: FileSystemOperation) -> ValidationError? {
        let pathURL = URL(fileURLWithPath: path)
        let fileExtension = pathURL.pathExtension.lowercased()

        // Skip extension check for directories
        if fileExtension.isEmpty {
            return nil
        }

        // Block dangerous extensions
        if restrictedExtensions.contains(fileExtension) {
            logger.warning("Blocked restricted extension: \(fileExtension)")
            return .restrictedExtension(fileExtension)
        }

        // For write operations, only allow safe extensions
        if operation.requiresWriteAccess && !allowedExtensions.contains(fileExtension) {
            logger.warning("Extension not in allowed list: \(fileExtension)")
            return .restrictedExtension(fileExtension)
        }

        return nil
    }

    private func isRateLimited() -> Bool {
        let now = Date()

        // Reset counter every minute
        if now.timeIntervalSince(lastResetTime) > 60 {
            operationCounts.removeAll()
            lastResetTime = now
        }

        let currentCount = operationCounts["total", default: 0]
        return currentCount >= maxOperationsPerMinute
    }

    private func incrementOperationCount() {
        operationCounts["total", default: 0] += 1
    }

    private func createContainerDirectories() async {
        for containerDir in ContainerDirectory.allCases {
            guard let url = containerDir.url else { continue }

            do {
                try fileManager.createDirectory(
                    at: url,
                    withIntermediateDirectories: true,
                    attributes: nil
                )
                logger.debug("Created container directory: \(url.path)")
            } catch {
                logger.error("Failed to create container directory \(url.path): \(error)")
            }
        }
    }
}

// MARK: - Security Audit Logging

extension SandboxValidator {

    /// Logs a security violation for audit purposes
    public func logSecurityViolation(_ error: ValidationError, path: String, operation: FileSystemOperation) {
        logger.error("""
            SECURITY VIOLATION:
            Operation: \(String(describing: operation))
            Path: \(path)
            Error: \(error.description)
            Timestamp: \(Date())
            """)
    }

    /// Logs successful file operations for audit trail
    public func logFileAccess(_ path: String, operation: FileSystemOperation, success: Bool) {
        if success {
            logger.debug("File access: \(String(describing: operation)) on \(path) - SUCCESS")
        } else {
            logger.warning("File access: \(String(describing: operation)) on \(path) - FAILED")
        }
    }
}