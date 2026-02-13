/**
 * ETLBridgeError - Error types for Swift-to-JS ETL bridge operations
 *
 * These errors represent failure modes when Swift delegates file processing
 * to the JavaScript ETL pipeline via WKWebView.
 */

import Foundation

/// Errors that can occur during ETL bridge operations.
/// Each case provides a descriptive error for debugging and user feedback.
public enum ETLBridgeError: Error, LocalizedError, Sendable {
    /// WKWebView reference is nil (deallocated or not set)
    case webViewNotAvailable

    /// ETL bridge not initialized in JavaScript (window.isometryETL undefined)
    case notInitialized

    /// JavaScript returned unexpected format (JSON decode failed)
    case invalidResponse

    /// JavaScript-side import error with message
    case importFailed(String)

    /// Cannot read file (permission denied or file not found)
    case fileAccessDenied

    /// File encoding error (cannot convert to base64)
    case encodingError(String)

    public var errorDescription: String? {
        switch self {
        case .webViewNotAvailable:
            return "WebView is not available. The web view may have been deallocated."
        case .notInitialized:
            return "ETL bridge not initialized. Ensure initializeETLBridge() was called in JavaScript."
        case .invalidResponse:
            return "Invalid response format from JavaScript ETL pipeline."
        case .importFailed(let message):
            return "Import failed: \(message)"
        case .fileAccessDenied:
            return "Cannot access file. Check file permissions."
        case .encodingError(let details):
            return "File encoding error: \(details)"
        }
    }

    /// Identifier for programmatic error handling
    public var code: String {
        switch self {
        case .webViewNotAvailable:
            return "WEBVIEW_NOT_AVAILABLE"
        case .notInitialized:
            return "NOT_INITIALIZED"
        case .invalidResponse:
            return "INVALID_RESPONSE"
        case .importFailed:
            return "IMPORT_FAILED"
        case .fileAccessDenied:
            return "FILE_ACCESS_DENIED"
        case .encodingError:
            return "ENCODING_ERROR"
        }
    }
}
