/**
 * ETLBridge - Swift-to-JavaScript ETL pipeline delegation
 *
 * This actor bridges Swift file operations to the TypeScript ETL infrastructure
 * via WKWebView's callAsyncJavaScript. It enables Swift to leverage the 6+ file
 * importers (markdown, JSON, CSV, HTML, Word, Excel) without duplicating parsing logic.
 *
 * Usage:
 * ```swift
 * let bridge = ETLBridge(webView: webView)
 * let result = try await bridge.importFile(fileURL)
 * print("Imported \(result.nodeCount) nodes")
 * ```
 *
 * Thread Safety:
 * - Actor isolation ensures all state access is serialized
 * - MainActor used for WKWebView calls (WKWebView is @MainActor)
 * - Safe to call from any async context
 *
 * Implementation Notes (from 71-RESEARCH.md):
 * 1. Use callAsyncJavaScript (not evaluateJavaScript) for async JS functions
 * 2. Base64-encode file content before passing to JS (binary safety)
 * 3. Dispatch to MainActor for WKWebView calls
 * 4. Use .page content world to access window.isometryETL
 * 5. Always return value from JS (callAsyncJavaScript crashes on nil return)
 */

import WebKit
import Foundation

// MARK: - ETLImportResult

/// Result from window.isometryETL.importFile()
/// Matches the JavaScript return type for decoding.
public struct ETLImportResult: Codable, Sendable {
    /// Whether the import succeeded (no errors)
    public let success: Bool

    /// Number of nodes successfully imported
    public let nodeCount: Int

    /// Error messages (if any)
    public let errors: [String]?

    public init(success: Bool, nodeCount: Int, errors: [String]? = nil) {
        self.success = success
        self.nodeCount = nodeCount
        self.errors = errors
    }
}

// MARK: - ETLBridge Actor

/// Actor-based bridge to JavaScript ETL pipeline via WKWebView.
/// Provides thread-safe file import delegation to TypeScript infrastructure.
public actor ETLBridge {
    /// Weak reference to avoid retain cycles with WebView
    private weak var webView: WKWebView?

    /// JSON decoder for parsing JS responses
    private let decoder = JSONDecoder()

    // MARK: - Initialization

    /// Create an ETL bridge with the given WebView.
    /// - Parameter webView: The WKWebView hosting the Isometry web app.
    ///                      Must have window.isometryETL initialized.
    public init(webView: WKWebView) {
        self.webView = webView
    }

    // MARK: - Import Methods

    /// Import a file via the JavaScript ETL pipeline.
    ///
    /// Reads the file at the given URL, base64-encodes the content,
    /// and delegates to window.isometryETL.importFile() for parsing
    /// and database insertion.
    ///
    /// - Parameter url: URL to the file to import (must be readable)
    /// - Returns: ETLImportResult with success status and node count
    /// - Throws: ETLBridgeError for various failure modes
    public func importFile(_ url: URL) async throws -> ETLImportResult {
        // Read file content
        let data: Data
        do {
            data = try Data(contentsOf: url)
        } catch {
            throw ETLBridgeError.fileAccessDenied
        }

        let filename = url.lastPathComponent
        return try await importContent(filename: filename, content: data)
    }

    /// Import raw content with a filename.
    ///
    /// Use this when you have file content in memory rather than on disk.
    /// The content is base64-encoded before passing to JavaScript.
    ///
    /// - Parameters:
    ///   - filename: Name of the file (used for format detection)
    ///   - content: Raw file content as Data
    /// - Returns: ETLImportResult with success status and node count
    /// - Throws: ETLBridgeError for various failure modes
    public func importContent(filename: String, content: Data) async throws -> ETLImportResult {
        guard let webView = webView else {
            throw ETLBridgeError.webViewNotAvailable
        }

        // Base64-encode content for safe JS transport
        let base64Content = content.base64EncodedString()

        // JavaScript code to execute
        // Note: atob() decodes base64 in browser
        // We return JSON.stringify to ensure we get a string result (avoid nil crash)
        let jsCode = """
            (async function() {
                if (!window.isometryETL) {
                    return JSON.stringify({
                        success: false,
                        nodeCount: 0,
                        errors: ['ETL not initialized - call initializeETLBridge() first']
                    });
                }
                try {
                    const content = atob(base64Content);
                    const result = await window.isometryETL.importFile(filename, content);
                    return JSON.stringify(result);
                } catch (error) {
                    return JSON.stringify({
                        success: false,
                        nodeCount: 0,
                        errors: [error.message || String(error)]
                    });
                }
            })()
            """

        // Call JavaScript via helper that handles MainActor dispatch
        let result = try await executeJavaScript(
            webView: webView,
            code: jsCode,
            arguments: [
                "filename": filename,
                "base64Content": base64Content
            ]
        )

        // Parse JSON response
        guard let jsonString = result as? String,
              let jsonData = jsonString.data(using: String.Encoding.utf8) else {
            throw ETLBridgeError.invalidResponse
        }

        let importResult: ETLImportResult
        do {
            importResult = try decoder.decode(ETLImportResult.self, from: jsonData)
        } catch {
            throw ETLBridgeError.invalidResponse
        }

        // Check for JS-side errors
        if !importResult.success, let errors = importResult.errors, !errors.isEmpty {
            throw ETLBridgeError.importFailed(errors.joined(separator: "; "))
        }

        return importResult
    }

    // MARK: - Utility Methods

    /// Check if the ETL bridge is initialized in JavaScript.
    /// - Returns: true if window.isometryETL is defined
    public func isInitialized() async throws -> Bool {
        guard let webView = webView else {
            return false
        }

        let jsCode = """
            (function() {
                return window.isometryETL !== undefined;
            })()
            """

        let result = try await executeJavaScript(
            webView: webView,
            code: jsCode,
            arguments: [:]
        )

        return result as? Bool ?? false
    }

    /// Get supported file extensions from the ETL coordinator.
    /// - Returns: Array of supported extensions (e.g., [".md", ".json", ".csv"])
    public func getSupportedExtensions() async throws -> [String] {
        guard let webView = webView else {
            throw ETLBridgeError.webViewNotAvailable
        }

        let jsCode = """
            (function() {
                if (!window.isometryETL) {
                    return JSON.stringify([]);
                }
                // This would need to be implemented in window-export.ts
                // For now, return common supported formats
                return JSON.stringify(['.md', '.markdown', '.json', '.csv', '.html', '.docx', '.xlsx']);
            })()
            """

        let result = try await executeJavaScript(
            webView: webView,
            code: jsCode,
            arguments: [:]
        )

        guard let jsonString = result as? String,
              let jsonData = jsonString.data(using: String.Encoding.utf8),
              let extensions = try? decoder.decode([String].self, from: jsonData) else {
            return []
        }

        return extensions
    }

    // MARK: - Private Helpers

    /// Execute JavaScript on the main actor.
    /// WKWebView.callAsyncJavaScript must be called from MainActor.
    @MainActor
    private func executeJavaScript(
        webView: WKWebView,
        code: String,
        arguments: [String: Any]
    ) async throws -> Any? {
        try await webView.callAsyncJavaScript(
            code,
            arguments: arguments,
            in: nil,
            contentWorld: .page
        )
    }
}
