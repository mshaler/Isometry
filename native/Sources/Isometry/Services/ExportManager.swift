import Foundation
import PDFKit
import WebKit
import os.log

#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// Actor-based export manager for multi-format notebook content export
/// Provides thread-safe export operations for PDF, HTML, Markdown, and JSON formats
public actor ExportManager {

    // MARK: - Properties

    private let database: IsometryDatabase
    private let logger = Logger(subsystem: "com.isometry.app", category: "ExportManager")
    private let fileManager = FileManager.default

    // Template storage
    private var htmlTemplate: String?
    private var cssStyles: String?

    // Export state tracking
    private var activeExports: Set<UUID> = []
    private let maxConcurrentExports = 3

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
    }

    /// Initialize export manager and load templates
    public func initialize() async throws {
        try await loadTemplates()
        logger.debug("ExportManager initialized successfully")
    }

    // MARK: - Export Operations

    /// Export a single notebook card in the specified format
    /// - Parameters:
    ///   - cardId: ID of the card to export
    ///   - format: Export format (PDF, HTML, Markdown, JSON)
    ///   - options: Export options for customization
    /// - Returns: ExportResult with file URL or error
    public func exportCard(
        cardId: String,
        format: ExportFormat,
        options: ExportOptions = .default
    ) async throws -> ExportResult {

        // Check concurrent export limit
        guard activeExports.count < maxConcurrentExports else {
            throw ExportError.tooManyActiveExports
        }

        let exportId = UUID()
        activeExports.insert(exportId)
        defer { activeExports.remove(exportId) }

        logger.debug("Starting export for card \(cardId) in format \(format.rawValue)")

        do {
            // Fetch card data
            guard let card = try await database.getNotebookCard(id: cardId) else {
                throw ExportError.cardNotFound(cardId)
            }

            let exportRequest = ExportRequest(
                cards: [card],
                format: format,
                options: options,
                exportId: exportId
            )

            return try await performExport(request: exportRequest)

        } catch {
            logger.error("Export failed for card \(cardId): \(error.localizedDescription)")
            throw error
        }
    }

    /// Export multiple notebook cards in a batch operation
    /// - Parameters:
    ///   - cardIds: Array of card IDs to export
    ///   - format: Export format (PDF, HTML, Markdown, JSON)
    ///   - options: Export options for customization
    /// - Returns: ExportResult with batch file URL or error
    public func exportCards(
        cardIds: [String],
        format: ExportFormat,
        options: ExportOptions = .default
    ) async throws -> ExportResult {

        guard activeExports.count < maxConcurrentExports else {
            throw ExportError.tooManyActiveExports
        }

        let exportId = UUID()
        activeExports.insert(exportId)
        defer { activeExports.remove(exportId) }

        logger.debug("Starting batch export for \(cardIds.count) cards in format \(format.rawValue)")

        do {
            // Fetch all cards
            var cards: [NotebookCard] = []
            for cardId in cardIds {
                guard let card = try await database.getNotebookCard(id: cardId) else {
                    logger.warning("Card \(cardId) not found, skipping")
                    continue
                }
                cards.append(card)
            }

            guard !cards.isEmpty else {
                throw ExportError.noValidCards
            }

            let exportRequest = ExportRequest(
                cards: cards,
                format: format,
                options: options,
                exportId: exportId
            )

            return try await performExport(request: exportRequest)

        } catch {
            logger.error("Batch export failed: \(error.localizedDescription)")
            throw error
        }
    }

    /// Export all cards in a folder
    /// - Parameters:
    ///   - folder: Folder name to export (nil for root)
    ///   - format: Export format
    ///   - options: Export options
    /// - Returns: ExportResult with folder export
    public func exportFolder(
        folder: String?,
        format: ExportFormat,
        options: ExportOptions = .default
    ) async throws -> ExportResult {

        logger.debug("Starting folder export for folder: \(folder ?? "root")")

        // Fetch cards in folder
        let cards = try await database.getNotebookCards(inFolder: folder)
        guard !cards.isEmpty else {
            throw ExportError.emptyFolder(folder ?? "root")
        }

        let cardIds = cards.map { $0.id }
        return try await exportCards(cardIds: cardIds, format: format, options: options)
    }

    // MARK: - Core Export Implementation

    private func performExport(request: ExportRequest) async throws -> ExportResult {
        let startTime = Date()

        do {
            let result: ExportResult

            switch request.format {
            case .pdf:
                result = try await exportToPDF(request: request)
            case .html:
                result = try await exportToHTML(request: request)
            case .markdown:
                result = try await exportToMarkdown(request: request)
            case .json:
                result = try await exportToJSON(request: request)
            }

            let duration = Date().timeIntervalSince(startTime)
            logger.debug("Export completed in \(String(format: "%.2f", duration))s for \(request.cards.count) cards")

            return result

        } catch {
            let duration = Date().timeIntervalSince(startTime)
            logger.error("Export failed after \(String(format: "%.2f", duration))s: \(error.localizedDescription)")
            throw error
        }
    }

    // MARK: - PDF Export

    private func exportToPDF(request: ExportRequest) async throws -> ExportResult {
        let document = PDFDocument()
        let fileName = generateFileName(for: request, extension: "pdf")

        // Generate HTML content for PDF rendering
        let htmlContent = try await generateHTMLContent(for: request)

        // Create temporary HTML file
        let tempHTMLURL = try createTemporaryFile(content: htmlContent, extension: "html")
        defer { try? fileManager.removeItem(at: tempHTMLURL) }

        #if canImport(UIKit)
        // iOS PDF generation using WKWebView
        return try await generatePDFFromWebView(
            htmlURL: tempHTMLURL,
            fileName: fileName,
            options: request.options
        )
        #elseif canImport(AppKit)
        // macOS PDF generation using WebView
        return try await generatePDFFromWebView(
            htmlURL: tempHTMLURL,
            fileName: fileName,
            options: request.options
        )
        #endif
    }

    #if canImport(UIKit) || canImport(AppKit)
    private func generatePDFFromWebView(
        htmlURL: URL,
        fileName: String,
        options: ExportOptions
    ) async throws -> ExportResult {

        // Create a WebView for rendering
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: options.pageWidth, height: options.pageHeight))

        // Load HTML content
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())

        // Wait for load completion
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            let observer = webView.observe(\.isLoading) { webView, _ in
                if !webView.isLoading {
                    continuation.resume()
                }
            }

            // Set a timeout
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) {
                observer.invalidate()
                continuation.resume(throwing: ExportError.renderTimeout)
            }
        }

        // Generate PDF
        #if canImport(UIKit)
        let pdfData = try await webView.pdf(configuration: WKPDFConfiguration())
        #elseif canImport(AppKit)
        let pdfData = try await webView.pdf()
        #endif

        // Save to file
        let outputURL = try saveExportData(pdfData, fileName: fileName)

        return ExportResult(
            fileURL: outputURL,
            format: .pdf,
            fileSize: Int64(pdfData.count),
            cardCount: 1
        )
    }
    #endif

    // MARK: - HTML Export

    private func exportToHTML(request: ExportRequest) async throws -> ExportResult {
        let fileName = generateFileName(for: request, extension: "html")

        let htmlContent = try await generateHTMLContent(for: request)
        let htmlData = htmlContent.data(using: .utf8) ?? Data()

        let outputURL = try saveExportData(htmlData, fileName: fileName)

        return ExportResult(
            fileURL: outputURL,
            format: .html,
            fileSize: Int64(htmlData.count),
            cardCount: request.cards.count
        )
    }

    private func generateHTMLContent(for request: ExportRequest) async throws -> String {
        let template = try await getHTMLTemplate()
        let styles = try await getCSSStyles()

        let cardsHTML = try await generateCardsHTML(cards: request.cards, options: request.options)

        let title = request.cards.count == 1
            ? request.cards[0].title
            : "Notebook Export - \(request.cards.count) cards"

        let htmlContent = template
            .replacingOccurrences(of: "{{TITLE}}", with: title)
            .replacingOccurrences(of: "{{STYLES}}", with: styles)
            .replacingOccurrences(of: "{{CONTENT}}", with: cardsHTML)
            .replacingOccurrences(of: "{{EXPORT_DATE}}", with: formatExportDate())

        return htmlContent
    }

    private func generateCardsHTML(cards: [NotebookCard], options: ExportOptions) async throws -> String {
        var html = ""

        for (index, card) in cards.enumerated() {
            if index > 0 && options.includePageBreaks {
                html += "<div class='page-break'></div>\n"
            }

            html += try await generateCardHTML(card: card, options: options)
        }

        return html
    }

    private func generateCardHTML(card: NotebookCard, options: ExportOptions) async throws -> String {
        var cardHTML = "<article class='notebook-card'>\n"

        // Title
        if options.includeTitle {
            cardHTML += "  <h1 class='card-title'>\(escapeHTML(card.title))</h1>\n"
        }

        // Metadata
        if options.includeMetadata {
            cardHTML += "  <div class='card-metadata'>\n"
            cardHTML += "    <div class='metadata-item'><strong>Created:</strong> \(formatDate(card.createdAt))</div>\n"
            cardHTML += "    <div class='metadata-item'><strong>Modified:</strong> \(formatDate(card.modifiedAt))</div>\n"

            if let folder = card.folder {
                cardHTML += "    <div class='metadata-item'><strong>Folder:</strong> \(escapeHTML(folder))</div>\n"
            }

            if !card.tags.isEmpty {
                let tagsHTML = card.tags.map { "<span class='tag'>\(escapeHTML($0))</span>" }.joined(separator: " ")
                cardHTML += "    <div class='metadata-item'><strong>Tags:</strong> \(tagsHTML)</div>\n"
            }

            cardHTML += "  </div>\n"
        }

        // Content (markdown rendered to HTML)
        if options.includeContent {
            let renderedContent = try await renderMarkdownToHTML(card.markdownContent ?? "")
            cardHTML += "  <div class='card-content'>\n\(renderedContent)\n  </div>\n"
        }

        // Properties
        if options.includeProperties && !card.properties.isEmpty {
            cardHTML += "  <div class='card-properties'>\n"
            cardHTML += "    <h3>Properties</h3>\n"
            cardHTML += "    <dl class='properties-list'>\n"

            for (key, value) in card.properties {
                cardHTML += "      <dt>\(escapeHTML(key))</dt>\n"
                cardHTML += "      <dd>\(escapeHTML(value))</dd>\n"
            }

            cardHTML += "    </dl>\n"
            cardHTML += "  </div>\n"
        }

        cardHTML += "</article>\n"

        return cardHTML
    }

    // MARK: - Markdown Export

    private func exportToMarkdown(request: ExportRequest) async throws -> ExportResult {
        let fileName = generateFileName(for: request, extension: "md")

        var markdownContent = ""

        // Add front matter for batch exports
        if request.cards.count > 1 {
            markdownContent += "---\n"
            markdownContent += "title: Notebook Export\n"
            markdownContent += "cards: \(request.cards.count)\n"
            markdownContent += "export_date: \(formatExportDate())\n"
            markdownContent += "---\n\n"
        }

        // Add table of contents for multiple cards
        if request.cards.count > 1 && request.options.includeTableOfContents {
            markdownContent += "# Table of Contents\n\n"
            for (index, card) in request.cards.enumerated() {
                markdownContent += "\(index + 1). [\(card.title)](#\(slugify(card.title)))\n"
            }
            markdownContent += "\n"
        }

        // Add cards
        for (index, card) in request.cards.enumerated() {
            if index > 0 {
                markdownContent += "\n---\n\n"
            }

            markdownContent += try await generateCardMarkdown(card: card, options: request.options)
        }

        let markdownData = markdownContent.data(using: .utf8) ?? Data()
        let outputURL = try saveExportData(markdownData, fileName: fileName)

        return ExportResult(
            fileURL: outputURL,
            format: .markdown,
            fileSize: Int64(markdownData.count),
            cardCount: request.cards.count
        )
    }

    private func generateCardMarkdown(card: NotebookCard, options: ExportOptions) async throws -> String {
        var markdown = ""

        // Title
        if options.includeTitle {
            markdown += "# \(card.title)\n\n"
        }

        // Metadata as front matter or comment block
        if options.includeMetadata {
            markdown += "<!-- Metadata\n"
            markdown += "Created: \(formatDate(card.createdAt))\n"
            markdown += "Modified: \(formatDate(card.modifiedAt))\n"

            if let folder = card.folder {
                markdown += "Folder: \(folder)\n"
            }

            if !card.tags.isEmpty {
                markdown += "Tags: \(card.tags.joined(separator: ", "))\n"
            }

            markdown += "-->\n\n"
        }

        // Content
        if options.includeContent {
            let content = card.markdownContent ?? ""
            markdown += content
            if !content.hasSuffix("\n") {
                markdown += "\n"
            }
        }

        // Properties
        if options.includeProperties && !card.properties.isEmpty {
            markdown += "\n## Properties\n\n"
            for (key, value) in card.properties {
                markdown += "- **\(key):** \(value)\n"
            }
        }

        return markdown
    }

    // MARK: - JSON Export

    private func exportToJSON(request: ExportRequest) async throws -> ExportResult {
        let fileName = generateFileName(for: request, extension: "json")

        let exportData = ExportData(
            metadata: ExportMetadata(
                exportDate: Date(),
                format: .json,
                cardCount: request.cards.count,
                version: "1.0"
            ),
            cards: request.cards.map { card in
                ExportedCard(
                    id: card.id,
                    title: card.title,
                    content: card.markdownContent ?? "",
                    properties: card.properties,
                    tags: card.tags,
                    folder: card.folder,
                    createdAt: card.createdAt,
                    modifiedAt: card.modifiedAt
                )
            }
        )

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        let jsonData = try encoder.encode(exportData)
        let outputURL = try saveExportData(jsonData, fileName: fileName)

        return ExportResult(
            fileURL: outputURL,
            format: .json,
            fileSize: Int64(jsonData.count),
            cardCount: request.cards.count
        )
    }

    // MARK: - Template Management

    private func loadTemplates() async throws {
        // Load HTML template
        if let templateURL = Bundle.module.url(forResource: "export_template", withExtension: "html") {
            htmlTemplate = try String(contentsOf: templateURL)
        } else {
            htmlTemplate = defaultHTMLTemplate
        }

        // Load CSS styles
        if let stylesURL = Bundle.module.url(forResource: "export_styles", withExtension: "css") {
            cssStyles = try String(contentsOf: stylesURL)
        } else {
            cssStyles = defaultCSSStyles
        }
    }

    private func getHTMLTemplate() async throws -> String {
        guard let template = htmlTemplate else {
            throw ExportError.templateLoadFailed("HTML template not loaded")
        }
        return template
    }

    private func getCSSStyles() async throws -> String {
        guard let styles = cssStyles else {
            throw ExportError.templateLoadFailed("CSS styles not loaded")
        }
        return styles
    }

    // MARK: - Helper Methods

    private func generateFileName(for request: ExportRequest, extension ext: String) -> String {
        let timestamp = DateFormatter.fileNameFormatter.string(from: Date())

        if request.cards.count == 1 {
            let sanitized = sanitizeFileName(request.cards[0].title)
            return "\(sanitized)_\(timestamp).\(ext)"
        } else {
            return "notebook_export_\(request.cards.count)_cards_\(timestamp).\(ext)"
        }
    }

    private func sanitizeFileName(_ name: String) -> String {
        let invalidChars = CharacterSet(charactersIn: "/\\:*?\"<>|")
        return name.components(separatedBy: invalidChars).joined(separator: "_")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .prefix(50).description // Limit length
    }

    private func saveExportData(_ data: Data, fileName: String) throws -> URL {
        let documentsURL = try getDocumentsDirectory()
        let exportsURL = documentsURL.appendingPathComponent("Exports", isDirectory: true)

        // Ensure exports directory exists
        if !fileManager.fileExists(atPath: exportsURL.path) {
            try fileManager.createDirectory(at: exportsURL, withIntermediateDirectories: true)
        }

        let fileURL = exportsURL.appendingPathComponent(fileName)
        try data.write(to: fileURL)

        return fileURL
    }

    private func createTemporaryFile(content: String, extension ext: String) throws -> URL {
        let tempDir = URL(fileURLWithPath: NSTemporaryDirectory())
        let fileName = "\(UUID().uuidString).\(ext)"
        let tempURL = tempDir.appendingPathComponent(fileName)

        let data = content.data(using: .utf8) ?? Data()
        try data.write(to: tempURL)

        return tempURL
    }

    private func getDocumentsDirectory() throws -> URL {
        guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            throw ExportError.fileSystemError("Documents directory not found")
        }
        return documentsURL
    }

    private func renderMarkdownToHTML(_ markdown: String) async -> String {
        // Basic markdown to HTML conversion
        // In a production app, you'd use a proper markdown processor
        var html = markdown

        // Headers
        html = html.replacingOccurrences(of: #"^### (.+)$"#, with: "<h3>$1</h3>", options: .regularExpression)
        html = html.replacingOccurrences(of: #"^## (.+)$"#, with: "<h2>$1</h2>", options: .regularExpression)
        html = html.replacingOccurrences(of: #"^# (.+)$"#, with: "<h1>$1</h1>", options: .regularExpression)

        // Bold and italic
        html = html.replacingOccurrences(of: #"\*\*(.+?)\*\*"#, with: "<strong>$1</strong>", options: .regularExpression)
        html = html.replacingOccurrences(of: #"\*(.+?)\*"#, with: "<em>$1</em>", options: .regularExpression)

        // Line breaks
        html = html.replacingOccurrences(of: "\n\n", with: "</p><p>")
        html = "<p>" + html + "</p>"

        // Lists (basic)
        html = html.replacingOccurrences(of: #"^- (.+)$"#, with: "<li>$1</li>", options: .regularExpression)
        html = html.replacingOccurrences(of: "</p><li>", with: "</p><ul><li>")
        html = html.replacingOccurrences(of: "</li><p>", with: "</li></ul><p>")

        return html
    }

    private func formatDate(_ date: Date) -> String {
        return DateFormatter.displayFormatter.string(from: date)
    }

    private func formatExportDate() -> String {
        return ISO8601DateFormatter().string(from: Date())
    }

    private func escapeHTML(_ text: String) -> String {
        return text
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
            .replacingOccurrences(of: "'", with: "&#39;")
    }

    private func slugify(_ text: String) -> String {
        return text.lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")
    }

    /// Clean up temporary files and resources
    public func cleanup() async {
        activeExports.removeAll()
        logger.debug("ExportManager cleaned up")
    }
}

// MARK: - Supporting Types

/// Export format enumeration
public enum ExportFormat: String, CaseIterable, Codable {
    case pdf = "PDF"
    case html = "HTML"
    case markdown = "Markdown"
    case json = "JSON"

    var fileExtension: String {
        switch self {
        case .pdf: return "pdf"
        case .html: return "html"
        case .markdown: return "md"
        case .json: return "json"
        }
    }

    var mimeType: String {
        switch self {
        case .pdf: return "application/pdf"
        case .html: return "text/html"
        case .markdown: return "text/markdown"
        case .json: return "application/json"
        }
    }
}

/// Export options for customization
public struct ExportOptions: Codable {
    var includeTitle: Bool
    var includeContent: Bool
    var includeMetadata: Bool
    var includeProperties: Bool
    var includeTableOfContents: Bool
    var includePageBreaks: Bool
    let pageWidth: CGFloat
    let pageHeight: CGFloat

    public init(
        includeTitle: Bool = true,
        includeContent: Bool = true,
        includeMetadata: Bool = true,
        includeProperties: Bool = true,
        includeTableOfContents: Bool = true,
        includePageBreaks: Bool = true,
        pageWidth: CGFloat = 612, // US Letter width
        pageHeight: CGFloat = 792 // US Letter height
    ) {
        self.includeTitle = includeTitle
        self.includeContent = includeContent
        self.includeMetadata = includeMetadata
        self.includeProperties = includeProperties
        self.includeTableOfContents = includeTableOfContents
        self.includePageBreaks = includePageBreaks
        self.pageWidth = pageWidth
        self.pageHeight = pageHeight
    }

    public static let `default` = ExportOptions()

    public static let minimal = ExportOptions(
        includeTitle: true,
        includeContent: true,
        includeMetadata: false,
        includeProperties: false,
        includeTableOfContents: false,
        includePageBreaks: false
    )
}

/// Export request containing cards and configuration
public struct ExportRequest: Sendable {
    let cards: [NotebookCard]
    let format: ExportFormat
    let options: ExportOptions
    let exportId: UUID
}

/// Export result with file information
public struct ExportResult: Sendable {
    public let fileURL: URL
    public let format: ExportFormat
    public let fileSize: Int64
    public let cardCount: Int
    public let exportDate: Date

    public init(
        fileURL: URL,
        format: ExportFormat,
        fileSize: Int64,
        cardCount: Int,
        exportDate: Date = Date()
    ) {
        self.fileURL = fileURL
        self.format = format
        self.fileSize = fileSize
        self.cardCount = cardCount
        self.exportDate = exportDate
    }

    public var fileSizeFormatted: String {
        return ByteCountFormatter().string(fromByteCount: fileSize)
    }
}

/// Export metadata structure for JSON exports
public struct ExportMetadata: Codable {
    let exportDate: Date
    let format: ExportFormat
    let cardCount: Int
    let version: String
}

/// Exported card structure for JSON exports
public struct ExportedCard: Codable {
    let id: String
    let title: String
    let content: String
    let properties: [String: String]
    let tags: [String]
    let folder: String?
    let createdAt: Date
    let modifiedAt: Date
}

/// Complete export data structure for JSON exports
public struct ExportData: Codable {
    let metadata: ExportMetadata
    let cards: [ExportedCard]
}

/// Export-specific errors
public enum ExportError: Error, LocalizedError {
    case cardNotFound(String)
    case noValidCards
    case emptyFolder(String)
    case tooManyActiveExports
    case templateLoadFailed(String)
    case renderTimeout
    case fileSystemError(String)
    case encodingError(String)

    public var errorDescription: String? {
        switch self {
        case .cardNotFound(let id):
            return "Card with ID '\(id)' not found"
        case .noValidCards:
            return "No valid cards found for export"
        case .emptyFolder(let folder):
            return "Folder '\(folder)' contains no cards"
        case .tooManyActiveExports:
            return "Too many active exports. Please wait for current exports to complete."
        case .templateLoadFailed(let template):
            return "Failed to load export template: \(template)"
        case .renderTimeout:
            return "Export rendering timed out"
        case .fileSystemError(let message):
            return "File system error: \(message)"
        case .encodingError(let message):
            return "Content encoding error: \(message)"
        }
    }
}

// MARK: - Default Templates

private let defaultHTMLTemplate = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{TITLE}}</title>
    <style>{{STYLES}}</style>
</head>
<body>
    <header class="export-header">
        <h1>{{TITLE}}</h1>
        <div class="export-date">Exported on {{EXPORT_DATE}}</div>
    </header>
    <main class="export-content">
        {{CONTENT}}
    </main>
</body>
</html>
"""

private let defaultCSSStyles = """
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    line-height: 1.6;
    color: #333;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background: #fff;
}

.export-header {
    border-bottom: 2px solid #e1e5e9;
    padding-bottom: 20px;
    margin-bottom: 30px;
}

.export-header h1 {
    margin: 0;
    color: #1a1a1a;
}

.export-date {
    color: #666;
    font-size: 14px;
    margin-top: 5px;
}

.notebook-card {
    margin-bottom: 40px;
    border: 1px solid #e1e5e9;
    border-radius: 8px;
    padding: 20px;
    background: #fafbfc;
}

.card-title {
    margin-top: 0;
    color: #0366d6;
    border-bottom: 1px solid #e1e5e9;
    padding-bottom: 10px;
}

.card-metadata {
    margin-bottom: 20px;
    font-size: 14px;
    color: #586069;
    border-left: 3px solid #e1e5e9;
    padding-left: 15px;
}

.metadata-item {
    margin-bottom: 5px;
}

.tag {
    background: #f1f8ff;
    border: 1px solid #c8e1ff;
    border-radius: 12px;
    padding: 2px 8px;
    margin-right: 5px;
    font-size: 12px;
    color: #0366d6;
}

.card-content {
    margin-bottom: 20px;
}

.card-content h1, .card-content h2, .card-content h3 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
}

.card-content p {
    margin-bottom: 1em;
}

.card-content ul, .card-content ol {
    padding-left: 20px;
}

.card-properties {
    border-top: 1px solid #e1e5e9;
    padding-top: 15px;
    margin-top: 20px;
}

.properties-list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px 20px;
    margin: 0;
}

.properties-list dt {
    font-weight: bold;
    color: #666;
}

.properties-list dd {
    margin: 0;
}

.page-break {
    page-break-before: always;
    break-before: page;
}

@media print {
    body {
        margin: 0;
        padding: 15px;
    }

    .export-header {
        border-bottom: 1px solid #000;
    }

    .notebook-card {
        break-inside: avoid;
        border: 1px solid #000;
        margin-bottom: 20px;
    }
}
"""

// MARK: - DateFormatter Extensions

extension DateFormatter {
    static let fileNameFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
        return formatter
    }()

    static let displayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()
}