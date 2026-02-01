import Foundation
import WebKit
import Network

/// WebClipper Actor for extracting clean content from web pages
/// Follows existing import patterns using ImportResult and ImportError
@MainActor
public actor WebClipperActor {
    private let database: IsometryDatabase
    private let readabilityEngine: ReadabilityEngine
    private let metadataExtractor: MetadataExtractor
    private let monitor: NWPathMonitor
    private var isNetworkConnected = false

    public init(database: IsometryDatabase) {
        self.database = database
        self.readabilityEngine = ReadabilityEngine()
        self.metadataExtractor = MetadataExtractor()
        self.monitor = NWPathMonitor()

        // Monitor network connectivity
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                self?.isNetworkConnected = path.status == .satisfied
            }
        }
        monitor.start(queue: DispatchQueue.global())
    }

    deinit {
        monitor.cancel()
    }

    // MARK: - Public Interface

    /// Clips content from a web URL and stores it as a Node
    public func clipWebContent(from url: URL) async throws -> ImportResult {
        guard isNetworkConnected else {
            var result = ImportResult()
            result.failed = 1
            result.errors.append(ImportError.webClipperNetworkUnavailable)
            return result
        }

        var result = ImportResult()

        do {
            // Check for existing clipped content
            if let existingNode = try await database.getNode(bySourceId: url.absoluteString, source: "web-clipper") {
                // Return existing node without re-clipping
                result.imported += 1
                result.nodes.append(existingNode)
                return result
            }

            // Extract content and metadata
            let extractedData = try await extractContent(from: url)

            // Create web clip node
            let node = try await createWebClipNode(from: extractedData)

            // Store in database
            try await database.createNode(node)

            result.imported += 1
            result.nodes.append(node)

            return result

        } catch {
            result.failed += 1
            result.errors.append(ImportError.webClipperExtractionFailed(url.absoluteString, error))
            return result
        }
    }

    /// Clips content from multiple URLs in batch
    public func clipWebContents(from urls: [URL]) async throws -> ImportResult {
        var combinedResult = ImportResult()

        for url in urls {
            let result = try await clipWebContent(from: url)
            combinedResult.imported += result.imported
            combinedResult.failed += result.failed
            combinedResult.nodes.append(contentsOf: result.nodes)
            combinedResult.errors.append(contentsOf: result.errors)
        }

        return combinedResult
    }

    // MARK: - Content Extraction

    private struct ExtractedWebContent {
        let url: URL
        let title: String
        let content: String
        let summary: String?
        let metadata: WebPageMetadata
    }

    private func extractContent(from url: URL) async throws -> ExtractedWebContent {
        // Create ephemeral web view configuration for privacy
        let config = WKWebViewConfiguration()
        let dataStore = WKWebsiteDataStore.nonPersistent()
        config.websiteDataStore = dataStore

        // Disable JavaScript for security and privacy
        config.preferences.javaScriptEnabled = false

        let webView = WKWebView(frame: .zero, configuration: config)

        // Load the URL
        let request = URLRequest(url: url, timeoutInterval: 30.0)

        return try await withCheckedThrowingContinuation { continuation in
            webView.navigationDelegate = WebClipperNavigationDelegate { result in
                switch result {
                case .success(let html):
                    Task {
                        do {
                            // Extract clean content using Readability
                            let cleanContent = await self.readabilityEngine.extractContent(from: html, url: url)

                            // Extract metadata
                            let metadata = await self.metadataExtractor.extractMetadata(from: html, url: url)

                            // Generate summary
                            let summary = self.generateSummary(from: cleanContent)

                            let extractedData = ExtractedWebContent(
                                url: url,
                                title: metadata.title ?? url.host ?? "Web Page",
                                content: cleanContent,
                                summary: summary,
                                metadata: metadata
                            )

                            continuation.resume(returning: extractedData)
                        } catch {
                            continuation.resume(throwing: error)
                        }
                    }
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            webView.load(request)
        }
    }

    private func createWebClipNode(from extractedData: ExtractedWebContent) async throws -> Node {
        let node = Node(
            id: UUID().uuidString,
            nodeType: "web-clip",
            name: extractedData.title,
            content: extractedData.content,
            summary: extractedData.summary,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "Web Clips",
            tags: extractedData.metadata.tags,
            source: "web-clipper",
            sourceId: extractedData.url.absoluteString,
            sourceUrl: extractedData.url.absoluteString
        )

        return node
    }

    private func generateSummary(from content: String) -> String? {
        guard !content.isEmpty else { return nil }

        // Extract first meaningful paragraph
        let lines = content.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.count > 50 && !trimmed.hasPrefix("<") && !trimmed.hasPrefix("#") {
                if trimmed.count > 200 {
                    return String(trimmed.prefix(197)) + "..."
                }
                return trimmed
            }
        }

        // Fallback to first 200 characters
        if content.count > 200 {
            return String(content.prefix(197)) + "..."
        }

        return content
    }
}

// MARK: - Navigation Delegate

private class WebClipperNavigationDelegate: NSObject, WKNavigationDelegate {
    private let completion: (Result<String, Error>) -> Void

    init(completion: @escaping (Result<String, Error>) -> Void) {
        self.completion = completion
        super.init()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("document.documentElement.outerHTML") { result, error in
            if let error = error {
                self.completion(.failure(error))
            } else if let html = result as? String {
                self.completion(.success(html))
            } else {
                self.completion(.failure(WebClipperError.contentExtractionFailed))
            }
        }
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        completion(.failure(error))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        completion(.failure(error))
    }
}

// MARK: - Web Clipper Specific Errors

public enum WebClipperError: Error, Sendable {
    case networkUnavailable
    case invalidURL(String)
    case extractionFailed(String, Error)
    case contentExtractionFailed
    case metadataExtractionFailed
    case robotsBlocked(String)
}

extension WebClipperError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .networkUnavailable:
            return "Network connection unavailable"
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .extractionFailed(let url, let error):
            return "Failed to extract content from \(url): \(error.localizedDescription)"
        case .contentExtractionFailed:
            return "Failed to extract page content"
        case .metadataExtractionFailed:
            return "Failed to extract page metadata"
        case .robotsBlocked(let url):
            return "Content extraction blocked by robots.txt for \(url)"
        }
    }
}