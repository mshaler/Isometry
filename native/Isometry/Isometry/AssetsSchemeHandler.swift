import Foundation
import UniformTypeIdentifiers
import WebKit

final class AssetsSchemeHandler: NSObject, WKURLSchemeHandler {

    /// Resolved bundle directory URL. Files are only served from within this directory.
    private let bundleDir: URL

    /// Tracks active tasks to prevent calling didFinish/didFailWithError on cancelled tasks.
    private var activeTasks: Set<ObjectIdentifier> = []

    /// Initialize with the resolved WebBundle directory URL.
    ///
    /// - Parameter bundleDir: Absolute URL to the WebBundle folder inside the app bundle.
    ///   Must be a file URL. The handler only serves files contained within this directory.
    init(bundleDir: URL) {
        self.bundleDir = bundleDir.standardizedFileURL
        super.init()
    }

    /// Convenience initializer that resolves WebBundle from the main app bundle.
    /// Falls back to a temporary empty directory if WebBundle hasn't been synced yet.
    convenience override init() {
        let dir = Bundle.main.url(forResource: "WebBundle", withExtension: nil)
            ?? URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("EmptyWebBundle")
        self.init(bundleDir: dir)
    }

    // MARK: - WKURLSchemeHandler

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        activeTasks.insert(ObjectIdentifier(task))

        guard let url = task.request.url else {
            failTask(task, with: URLError(.badURL))
            return
        }

        // SECURITY: Split path and reject traversal components
        let pathComponents = url.path
            .split(separator: "/")
            .map(String.init)
            .filter { !$0.isEmpty }

        if pathComponents.contains("..") || pathComponents.contains(".") {
            #if DEBUG
            print("[SchemeHandler] Blocked path traversal: \(url.path)")
            #endif
            failTask(task, with: URLError(.noPermissionsToReadFile))
            return
        }

        // Determine resource path (default to index.html for root)
        let resourcePath = pathComponents.isEmpty ? "index.html" : pathComponents.joined(separator: "/")
        let fileURL = bundleDir.appendingPathComponent(resourcePath).standardizedFileURL

        // SECURITY: Verify resolved path is contained within bundle directory
        guard fileURL.path.hasPrefix(bundleDir.path + "/") else {
            #if DEBUG
            print("[SchemeHandler] Path escaped bundle: \(fileURL.path)")
            #endif
            failTask(task, with: URLError(.noPermissionsToReadFile))
            return
        }

        // Verify file exists
        guard FileManager.default.fileExists(atPath: fileURL.path) else {
            #if DEBUG
            print("[SchemeHandler] Not found: \(resourcePath)")
            #endif
            failTask(task, with: URLError(.fileDoesNotExist))
            return
        }

        // Read and serve file
        do {
            let data = try Data(contentsOf: fileURL)
            let mimeType = Self.mimeType(for: fileURL.pathExtension)

            // SAFETY: Guard response construction instead of force unwrap
            guard let response = HTTPURLResponse(
                url: url,
                statusCode: 200,
                httpVersion: "HTTP/1.1",
                headerFields: [
                    "Content-Type": mimeType,
                    "Content-Length": "\(data.count)",
                    "Cache-Control": "no-cache",
                ]
            ) else {
                failTask(task, with: URLError(.cannotParseResponse))
                return
            }

            // Check task wasn't cancelled during file read
            guard activeTasks.contains(ObjectIdentifier(task)) else { return }

            task.didReceive(response)
            task.didReceive(data)
            task.didFinish()
            activeTasks.remove(ObjectIdentifier(task))

        } catch {
            failTask(task, with: error)
        }
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        activeTasks.remove(ObjectIdentifier(task))
    }

    // MARK: - Private Helpers

    private func failTask(_ task: WKURLSchemeTask, with error: Error) {
        guard activeTasks.contains(ObjectIdentifier(task)) else { return }
        activeTasks.remove(ObjectIdentifier(task))
        task.didFailWithError(error)
    }

    // MARK: - MIME Type Resolution

    /// Resolve MIME type for a file extension.
    /// Uses an explicit map for web assets (more reliable than UTType inference),
    /// with UTType fallback for anything not in the map.
    ///
    /// Internal access for testability.
    static func mimeType(for pathExtension: String) -> String {
        let ext = pathExtension.lowercased()

        if let mimeType = mimeTypes[ext] {
            return mimeType
        }

        // Fallback via UTType
        if let utType = UTType(filenameExtension: ext),
           let mimeType = utType.preferredMIMEType {
            return mimeType
        }

        return "application/octet-stream"
    }

    /// Explicit MIME type mappings for web assets.
    /// WASM must return "application/wasm" — UTType returns application/octet-stream.
    /// JS uses "text/javascript" per RFC 9239 (current IANA standard).
    private static let mimeTypes: [String: String] = [
        // Core web
        "html": "text/html; charset=utf-8",
        "htm":  "text/html; charset=utf-8",
        "css":  "text/css; charset=utf-8",
        "js":   "text/javascript; charset=utf-8",
        "mjs":  "text/javascript; charset=utf-8",
        "json": "application/json; charset=utf-8",

        // WebAssembly
        "wasm": "application/wasm",

        // Images
        "png":  "image/png",
        "jpg":  "image/jpeg",
        "jpeg": "image/jpeg",
        "gif":  "image/gif",
        "svg":  "image/svg+xml",
        "webp": "image/webp",
        "ico":  "image/x-icon",

        // Fonts
        "woff":  "font/woff",
        "woff2": "font/woff2",
        "ttf":   "font/ttf",
        "otf":   "font/otf",

        // Other
        "txt":  "text/plain; charset=utf-8",
        "xml":  "application/xml",
        "map":  "application/json",
    ]
}
