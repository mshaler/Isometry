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
    private let ethicalCrawler: EthicalCrawler
    private let privacyEngine: PrivacyEngine
    private let imageCacheActor: ImageCacheActor
    private let monitor: NWPathMonitor
    private var isNetworkConnected = false

    public init(database: IsometryDatabase) throws {
        self.database = database
        self.readabilityEngine = ReadabilityEngine()
        self.metadataExtractor = MetadataExtractor()
        self.ethicalCrawler = EthicalCrawler()
        self.privacyEngine = PrivacyEngine()
        self.imageCacheActor = try ImageCacheActor()
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
        // Clean URL of tracking parameters
        let cleanedURL = await privacyEngine.stripTrackingParameters(from: url)

        // Check if crawling is allowed and apply ethical delays
        let crawlPermission = try await ethicalCrawler.canCrawl(cleanedURL)
        guard crawlPermission.allowed else {
            throw WebClipperError.robotsBlocked(cleanedURL.absoluteString)
        }

        // Perform ethical request with rate limiting
        let (data, response) = try await ethicalCrawler.ethicalRequest(to: cleanedURL)

        guard let htmlString = String(data: data, encoding: .utf8) else {
            throw WebClipperError.contentExtractionFailed
        }

        // Strip tracking from HTML
        let privacyCleanedHTML = await privacyEngine.stripTrackingFromHTML(htmlString, baseURL: cleanedURL)

        // Cache images and update HTML references
        let htmlWithCachedImages = try await imageCacheActor.cacheImagesInHTML(privacyCleanedHTML, baseURL: cleanedURL)

        // Extract clean content using Readability
        let cleanContent = await readabilityEngine.extractContent(from: htmlWithCachedImages, url: cleanedURL)

        // Extract metadata
        let metadata = await metadataExtractor.extractMetadata(from: privacyCleanedHTML, url: cleanedURL)

        // Generate summary
        let summary = generateSummary(from: cleanContent)

        return ExtractedWebContent(
            url: cleanedURL,
            title: metadata.title ?? cleanedURL.host ?? "Web Page",
            content: cleanContent,
            summary: summary,
            metadata: metadata
        )
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

    // MARK: - Advanced Content Extraction (Task 4)

    /// Handles dynamic websites and JavaScript-rendered content when needed
    public func extractDynamicContent(from url: URL) async throws -> ExtractedWebContent {
        // First try standard extraction
        do {
            return try await extractContent(from: url)
        } catch {
            // If standard extraction fails, try with JavaScript enabled
            return try await extractWithJavaScript(from: url)
        }
    }

    private func extractWithJavaScript(from url: URL) async throws -> ExtractedWebContent {
        let cleanedURL = await privacyEngine.stripTrackingParameters(from: url)

        // Create privacy WebView with JavaScript enabled for dynamic content
        let webView = await privacyEngine.createPrivacyWebView()

        // Enable JavaScript for dynamic content extraction
        webView.configuration.preferences.javaScriptEnabled = true

        let request = await privacyEngine.createPrivacyRequest(for: cleanedURL, userAgent: "IsometryWebClipper/1.0")

        return try await withCheckedThrowingContinuation { continuation in
            let delegate = DynamicContentDelegate { result in
                switch result {
                case .success(let html):
                    Task {
                        do {
                            // Process the dynamic content
                            let privacyCleanedHTML = await self.privacyEngine.stripTrackingFromHTML(html, baseURL: cleanedURL)
                            let htmlWithCachedImages = try await self.imageCacheActor.cacheImagesInHTML(privacyCleanedHTML, baseURL: cleanedURL)
                            let cleanContent = await self.readabilityEngine.extractContent(from: htmlWithCachedImages, url: cleanedURL)
                            let metadata = await self.metadataExtractor.extractMetadata(from: privacyCleanedHTML, url: cleanedURL)
                            let summary = self.generateSummary(from: cleanContent)

                            let extractedData = ExtractedWebContent(
                                url: cleanedURL,
                                title: metadata.title ?? cleanedURL.host ?? "Web Page",
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

            webView.navigationDelegate = delegate
            webView.load(request)

            // Timeout after 30 seconds
            Task {
                try await Task.sleep(nanoseconds: 30_000_000_000)
                continuation.resume(throwing: WebClipperError.contentExtractionFailed)
            }
        }
    }
}

// MARK: - Dynamic Content Navigation Delegate

private class DynamicContentDelegate: NSObject, WKNavigationDelegate {
    private let completion: (Result<String, Error>) -> Void

    init(completion: @escaping (Result<String, Error>) -> Void) {
        self.completion = completion
        super.init()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // Wait for dynamic content to load
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
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