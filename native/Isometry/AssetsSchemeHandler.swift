import Foundation
import UniformTypeIdentifiers
import WebKit

final class AssetsSchemeHandler: NSObject, WKURLSchemeHandler {

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else {
            task.didFailWithError(URLError(.badURL))
            return
        }

        // Map app://localhost/path/to/file → WebBundle/path/to/file
        let path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let resourcePath = path.isEmpty ? "index.html" : path

        guard
            let bundleDir = Bundle.main.url(forResource: "WebBundle", withExtension: nil),
            let data = try? Data(contentsOf: bundleDir.appendingPathComponent(resourcePath))
        else {
            task.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let mimeType = Self.mimeType(for: url)
        let response = HTTPURLResponse(
            url: url,
            statusCode: 200,
            httpVersion: "HTTP/1.1",
            headerFields: [
                "Content-Type": mimeType,
                "Content-Length": "\(data.count)",
            ]
        )!

        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // Nothing to cancel for synchronous file reads
    }

    static func mimeType(for url: URL) -> String {
        // Explicit WASM override — UTType returns application/octet-stream for .wasm
        if url.pathExtension == "wasm" { return "application/wasm" }

        let mimeMap: [String: String] = [
            "html": "text/html; charset=utf-8",
            "js":   "application/javascript",
            "mjs":  "application/javascript",
            "css":  "text/css",
            "json": "application/json",
            "svg":  "image/svg+xml",
            "png":  "image/png",
        ]
        if let mime = mimeMap[url.pathExtension.lowercased()] { return mime }

        // Fallback via UTType
        if let type = UTType(filenameExtension: url.pathExtension),
           let mime = type.preferredMIMEType {
            return mime
        }
        return "application/octet-stream"
    }
}
