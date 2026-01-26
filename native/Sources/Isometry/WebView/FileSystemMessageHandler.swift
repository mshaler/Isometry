/**
 * File System MessageHandler for WebView Bridge
 *
 * Provides secure file operations through WebView bridge within App Sandbox constraints.
 * Handles all file system operations with comprehensive validation, security checks, and error handling.
 */

import WebKit
import Foundation

/**
 * FileSystemMessageHandler for secure file operations from WebView
 * Integrates with SandboxValidator for comprehensive App Sandbox compliance
 */
public class FileSystemMessageHandler: NSObject, WKScriptMessageHandler {
    private let fileManager = FileManager.default
    private let sandboxValidator = SandboxValidator()
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public override init() {
        super.init()

        // Configure JSON encoding/decoding for consistency
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        encoder.outputFormatting = .sortedKeys
    }

    /**
     * Main entry point for WebView message handling
     * Validates message format and routes to appropriate file operation handler
     */
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        Task {
            await handleMessage(message)
        }
    }

    /**
     * Handle message parsing, validation, and routing with comprehensive error handling
     */
    private func handleMessage(_ message: WKScriptMessage) async {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Parse and validate message structure
        guard let messageBody = message.body as? [String: Any] else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid message format - expected JSON object",
                requestId: nil,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Extract required fields with validation
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            await sendErrorResponse(
                to: message.webView,
                error: "Missing required fields: method and id",
                requestId: messageBody["id"] as? String,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        // Security validation for method
        let allowedMethods = ["readFile", "writeFile", "deleteFile", "listFiles", "fileExists", "exportFile", "createDirectory"]
        guard allowedMethods.contains(method) else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid file system method: \(method)",
                requestId: requestId,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Route to file system handler
        await handleFileSystemMessage(
            method: method,
            params: params,
            requestId: requestId,
            webView: message.webView,
            startTime: startTime
        )
    }

    /**
     * Handle file system message routing with performance monitoring
     */
    private func handleFileSystemMessage(
        method: String,
        params: [String: Any],
        requestId: String,
        webView: WKWebView?,
        startTime: CFAbsoluteTime
    ) async {
        do {
            let result: Any

            // Route to specific file system operation handler
            switch method {
            case "readFile":
                result = try await handleReadFile(params: params)

            case "writeFile":
                result = try await handleWriteFile(params: params)

            case "deleteFile":
                result = try await handleDeleteFile(params: params)

            case "listFiles":
                result = try await handleListFiles(params: params)

            case "fileExists":
                result = try await handleFileExists(params: params)

            case "exportFile":
                result = try await handleExportFile(params: params)

            case "createDirectory":
                result = try await handleCreateDirectory(params: params)

            default:
                throw FileSystemError.invalidOperation("Unknown method: \(method)")
            }

            let duration = CFAbsoluteTimeGetCurrent() - startTime
            await sendSuccessResponse(
                to: webView,
                result: result,
                requestId: requestId,
                duration: duration
            )

        } catch {
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            let errorMessage = formatError(error)

            await sendErrorResponse(
                to: webView,
                error: errorMessage,
                requestId: requestId,
                duration: duration
            )
        }
    }

    // MARK: - File System Operation Handlers

    /**
     * Read file content with security validation
     * Supports both text and binary data with Base64 encoding for binary
     */
    private func handleReadFile(params: [String: Any]) async throws -> [String: Any] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let binary = params["binary"] as? Bool ?? false

        // Validate path through sandbox validator
        let validationResult = sandboxValidator.validatePath(path, for: .read)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: path, operation: .read)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        // Check if file exists
        guard fileManager.fileExists(atPath: safePath) else {
            throw FileSystemError.fileNotFound(safePath)
        }

        // Read file content
        var content: String
        let attributes = try fileManager.attributesOfItem(atPath: safePath)

        if binary {
            // Read as binary data and encode as Base64
            let data = try Data(contentsOf: URL(fileURLWithPath: safePath))
            content = data.base64EncodedString()
        } else {
            // Read as text
            content = try String(contentsOfFile: safePath, encoding: .utf8)
        }

        sandboxValidator.logFileAccess(safePath, operation: .read, success: true)

        return [
            "content": content,
            "size": attributes[.size] as? UInt64 ?? 0,
            "modified": (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0,
            "binary": binary
        ]
    }

    /**
     * Write file content with security validation and binary support
     */
    private func handleWriteFile(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String,
              let content = params["content"] as? String else {
            throw FileSystemError.invalidPath("Missing path or content")
        }

        let binary = params["binary"] as? Bool ?? false

        // Validate path and check write permissions
        let validationResult = sandboxValidator.validatePath(path, for: .write)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: path, operation: .write)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        // Prepare content data
        let contentData: Data
        if binary {
            // Decode Base64 content
            guard let data = Data(base64Encoded: content) else {
                throw FileSystemError.invalidOperation("Invalid Base64 content")
            }
            contentData = data
        } else {
            contentData = Data(content.utf8)
        }

        // Validate file size
        if let sizeError = sandboxValidator.validateFileSize(Int64(contentData.count)) {
            throw FileSystemError.invalidOperation("File too large: \(sizeError.description)")
        }

        // Ensure directory exists
        let directory = URL(fileURLWithPath: safePath).deletingLastPathComponent()
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true, attributes: nil)

        // Write file atomically
        try contentData.write(to: URL(fileURLWithPath: safePath), options: .atomic)

        sandboxValidator.logFileAccess(safePath, operation: .write, success: true)

        return ["success": true]
    }

    /**
     * Delete file with security validation
     */
    private func handleDeleteFile(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let validationResult = sandboxValidator.validatePath(path, for: .delete)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: path, operation: .delete)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        if fileManager.fileExists(atPath: safePath) {
            try fileManager.removeItem(atPath: safePath)
            sandboxValidator.logFileAccess(safePath, operation: .delete, success: true)
        }

        return ["success": true]
    }

    /**
     * List files in directory with security validation and metadata
     */
    private func handleListFiles(params: [String: Any]) async throws -> [[String: Any]] {
        let path = params["path"] as? String ?? ""
        let defaultPath = sandboxValidator.getContainerPath(for: .documents)?.path ?? ""
        let targetPath = path.isEmpty ? defaultPath : path

        let validationResult = sandboxValidator.validatePath(targetPath, for: .list)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: targetPath, operation: .list)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        guard fileManager.fileExists(atPath: safePath) else {
            throw FileSystemError.directoryNotFound(safePath)
        }

        let contents = try fileManager.contentsOfDirectory(atPath: safePath)
        var results: [[String: Any]] = []

        for item in contents {
            let itemPath = URL(fileURLWithPath: safePath).appendingPathComponent(item).path
            let attributes = try fileManager.attributesOfItem(atPath: itemPath)

            results.append([
                "name": item,
                "path": itemPath,
                "isDirectory": attributes[.type] as? FileAttributeType == .typeDirectory,
                "size": attributes[.size] as? UInt64 ?? 0,
                "modified": (attributes[.modificationDate] as? Date)?.timeIntervalSince1970 ?? 0
            ])
        }

        sandboxValidator.logFileAccess(safePath, operation: .list, success: true)

        return results.sorted { ($0["name"] as? String ?? "") < ($1["name"] as? String ?? "") }
    }

    /**
     * Check if file exists with security validation
     */
    private func handleFileExists(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing file path")
        }

        let validationResult = sandboxValidator.validatePath(path, for: .read)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            return ["exists": false] // Don't reveal path validation failures
        }

        let exists = fileManager.fileExists(atPath: safePath)
        return ["exists": exists]
    }

    /**
     * Export file with native sharing mechanisms
     * Supports multiple formats and native share sheet integration
     */
    private func handleExportFile(params: [String: Any]) async throws -> [String: Any] {
        guard let path = params["path"] as? String,
              let format = params["format"] as? String else {
            throw FileSystemError.invalidPath("Missing path or format")
        }

        let filename = params["filename"] as? String
        let includeMetadata = params["includeMetadata"] as? Bool ?? false

        // Validate source path
        let validationResult = sandboxValidator.validatePath(path, for: .export)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: path, operation: .export)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        guard fileManager.fileExists(atPath: safePath) else {
            throw FileSystemError.fileNotFound(safePath)
        }

        // Create export directory in documents
        guard let documentsURL = sandboxValidator.getContainerPath(for: .documents) else {
            throw FileSystemError.accessDenied("Documents directory not accessible")
        }

        let exportsURL = documentsURL.appendingPathComponent("Exports")
        try fileManager.createDirectory(at: exportsURL, withIntermediateDirectories: true, attributes: nil)

        // Generate export filename
        let sourceURL = URL(fileURLWithPath: safePath)
        let baseName = filename ?? sourceURL.deletingPathExtension().lastPathComponent
        let exportFilename = "\(baseName).\(format)"
        let exportURL = exportsURL.appendingPathComponent(exportFilename)

        // Handle different export formats
        switch format.lowercased() {
        case "pdf", "html", "json", "csv", "md", "txt":
            // For text-based formats, copy content and potentially add metadata
            var content = try String(contentsOf: sourceURL, encoding: .utf8)

            if includeMetadata && format.lowercased() != "pdf" {
                let attributes = try fileManager.attributesOfItem(atPath: safePath)
                let metadata = """
                    ---
                    exported_at: \(Date().iso8601)
                    source_path: \(path)
                    source_size: \(attributes[.size] as? UInt64 ?? 0)
                    source_modified: \((attributes[.modificationDate] as? Date)?.iso8601 ?? "unknown")
                    ---

                    \(content)
                    """
                content = metadata
            }

            try content.write(to: exportURL, atomically: true, encoding: .utf8)

        default:
            // For binary formats or unknown formats, copy as-is
            try fileManager.copyItem(at: sourceURL, to: exportURL)
        }

        sandboxValidator.logFileAccess(exportURL.path, operation: .export, success: true)

        return [
            "success": true,
            "exportPath": exportURL.path,
            "filename": exportFilename,
            "shareURL": exportURL.absoluteString
        ]
    }

    /**
     * Create directory with security validation
     */
    private func handleCreateDirectory(params: [String: Any]) async throws -> [String: Bool] {
        guard let path = params["path"] as? String else {
            throw FileSystemError.invalidPath("Missing directory path")
        }

        let validationResult = sandboxValidator.validatePath(path, for: .createDirectory)
        guard validationResult.isAllowed, let safePath = validationResult.canonicalPath else {
            if let error = validationResult.error {
                sandboxValidator.logSecurityViolation(error, path: path, operation: .createDirectory)
            }
            throw FileSystemError.accessDenied(validationResult.error?.description ?? "Path validation failed")
        }

        try fileManager.createDirectory(
            atPath: safePath,
            withIntermediateDirectories: true,
            attributes: nil
        )

        sandboxValidator.logFileAccess(safePath, operation: .createDirectory, success: true)

        return ["success": true]
    }

    // MARK: - Helper Methods

    /**
     * Format error for client response
     */
    private func formatError(_ error: Error) -> String {
        if let fsError = error as? FileSystemError {
            return fsError.localizedDescription
        } else if let validationError = error as? SandboxValidator.ValidationError {
            return validationError.description
        } else {
            return "File system operation failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Response Delivery

    /**
     * Send success response to WebView
     */
    private func sendSuccessResponse(
        to webView: WKWebView?,
        result: Any,
        requestId: String,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId,
            result: result,
            error: nil,
            duration: duration
        )
    }

    /**
     * Send error response to WebView
     */
    private func sendErrorResponse(
        to webView: WKWebView?,
        error: String,
        requestId: String?,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId ?? "unknown",
            result: nil,
            error: error,
            duration: duration
        )
    }

    /**
     * Send response to WebView through JavaScript callback
     */
    private func sendResponse(
        to webView: WKWebView?,
        id: String,
        result: Any?,
        error: String?,
        duration: CFAbsoluteTime
    ) async {
        guard let webView = webView else {
            print("[FileSystemMessageHandler] No WebView available for response")
            return
        }

        var response: [String: Any] = [
            "id": id,
            "success": error == nil,
            "timestamp": Date().timeIntervalSince1970,
            "duration": duration * 1000 // Convert to milliseconds
        ]

        if let result = result {
            response["result"] = result
        }

        if let error = error {
            response["error"] = error
        }

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response, options: .sortedKeys)
            guard let responseString = String(data: responseData, encoding: .utf8) else {
                throw FileSystemError.invalidOperation("Failed to encode response")
            }

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            await MainActor.run {
                webView.evaluateJavaScript(script) { _, error in
                    if let error = error {
                        print("[FileSystemMessageHandler] WebView response error: \(error)")
                    }
                }
            }

        } catch {
            print("[FileSystemMessageHandler] Failed to send response: \(error)")
            // Attempt fallback response
            let fallbackScript = "window._isometryBridge?.handleResponse({\"id\":\"\(id)\",\"success\":false,\"error\":\"Failed to serialize response\"})"
            await MainActor.run {
                webView.evaluateJavaScript(fallbackScript) { _, _ in }
            }
        }
    }
}

// MARK: - File System Error Types

public enum FileSystemError: LocalizedError {
    case invalidOperation(String)
    case invalidPath(String)
    case fileNotFound(String)
    case directoryNotFound(String)
    case accessDenied(String)

    public var errorDescription: String? {
        switch self {
        case .invalidOperation(let msg):
            return "Invalid file system operation: \(msg)"
        case .invalidPath(let msg):
            return "Invalid file path: \(msg)"
        case .fileNotFound(let path):
            return "File not found: \(path)"
        case .directoryNotFound(let path):
            return "Directory not found: \(path)"
        case .accessDenied(let msg):
            return "Access denied: \(msg)"
        }
    }
}

// MARK: - Date Extensions for Metadata

private extension Date {
    var iso8601: String {
        let formatter = ISO8601DateFormatter()
        return formatter.string(from: self)
    }
}