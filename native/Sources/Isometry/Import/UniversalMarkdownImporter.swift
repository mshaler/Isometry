import Foundation
import Markdown
import TOMLKit
import IsometryCore

/// Universal markdown importer supporting multiple dialects and frontmatter formats
/// Extends AltoIndexImporter patterns for consistent API design
public actor UniversalMarkdownImporter {
    private let database: IsometryDatabase
    private let relationshipExtractor: RelationshipExtractor
    private let tableProcessor: TableProcessor
    private let attachmentProcessor: AttachmentProcessor

    public init(database: IsometryDatabase) {
        self.database = database
        self.relationshipExtractor = RelationshipExtractor(database: database)
        self.tableProcessor = TableProcessor(database: database)
        self.attachmentProcessor = AttachmentProcessor(database: database)
    }

    // MARK: - Public API (matching AltoIndexImporter)

    /// Imports all markdown notes from a directory
    public func importNotes(from directoryURL: URL) async throws -> ImportResult {
        let fileManager = FileManager.default
        var result = ImportResult()

        // Find all markdown files recursively
        guard let enumerator = fileManager.enumerator(
            at: directoryURL,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            throw UniversalImportError.directoryNotFound(directoryURL.path)
        }

        // Collect all markdown file URLs first to avoid async iteration issues
        let markdownFiles: [URL] = enumerator.compactMap { element in
            guard let fileURL = element as? URL,
                  fileURL.pathExtension == "md" else { return nil }
            return fileURL
        }

        // Process them asynchronously with progress reporting
        for (index, fileURL) in markdownFiles.enumerated() {
            do {
                let node = try await importNote(from: fileURL, relativeTo: directoryURL)
                result.imported += 1
                result.nodes.append(node)

                // Report progress every 10 files or on completion
                if (index + 1) % 10 == 0 || index == markdownFiles.count - 1 {
                    reportProgress(index + 1, total: markdownFiles.count, filename: fileURL.lastPathComponent)
                }
            } catch {
                result.failed += 1
                if let universalError = error as? UniversalImportError {
                    result.errors.append(universalError)
                } else {
                    result.errors.append(UniversalImportError.fileFailed(fileURL.lastPathComponent, error))
                }
                print("Import failed for \(fileURL.path): \(error)")
            }
        }

        return result
    }

    /// Imports a single markdown note with comprehensive validation and error handling
    public func importNote(from fileURL: URL, relativeTo baseURL: URL? = nil) async throws -> Node {
        let basePath = baseURL ?? fileURL.deletingLastPathComponent()
        do {
            let content = try String(contentsOf: fileURL, encoding: .utf8)

            // Use relative path for sourceId to handle duplicate filenames in different folders
            let relativeId: String
            if let base = baseURL {
                relativeId = fileURL.path.replacingOccurrences(of: base.path + "/", with: "")
            } else {
                relativeId = fileURL.lastPathComponent
            }

            // Validate content before processing
            try validateMarkdownContent(content, filename: fileURL.lastPathComponent)

            let parsed = try parseUniversalMarkdown(content, filename: fileURL.lastPathComponent, fallbackSourceId: relativeId)

            // Additional validation of parsed data
            try validateParsedData(parsed)

            // Check if already imported (by sourceId)
            if let existingNode = try await database.getNode(bySourceId: parsed.sourceId, source: parsed.detectedSource) {
                // Update existing node if modified
                var updated = existingNode
                updated.name = parsed.title
                updated.content = parsed.sanitizedBody
                updated.folder = parsed.folder
                updated.modifiedAt = parsed.modified ?? Date()
                updated.sourceUrl = parsed.sourceUrl

                do {
                    try await database.updateNode(updated)

                    // Extract and update relationships
                    let relationships = try await relationshipExtractor.extractRelationships(
                        from: parsed.body,
                        sourceNode: updated,
                        dialect: parsed.detectedDialect
                    )

                    // Process tables and update structured data nodes
                    let tables = try await tableProcessor.processTables(in: parsed.body, sourceNode: updated)

                    // Process attachments and images
                    let attachments = try await attachmentProcessor.processAttachments(
                        in: parsed.body,
                        sourceNode: updated,
                        basePath: basePath
                    )

                    print("Updated \(relationships.count) relationships, \(tables.count) tables, and \(attachments.count) attachments for node: \(updated.name)")
                    return updated
                } catch {
                    throw UniversalImportError.databaseOperationFailed("update node: \(error.localizedDescription)")
                }
            }

            // Create new node
            let node = Node(
                id: UUID().uuidString,
                nodeType: "note",
                name: parsed.title,
                content: parsed.sanitizedBody,
                summary: extractSummary(from: parsed.sanitizedBody),
                createdAt: parsed.created ?? Date(),
                modifiedAt: parsed.modified ?? Date(),
                folder: parsed.folder,
                tags: parsed.tags,
                source: parsed.detectedSource,
                sourceId: parsed.sourceId,
                sourceUrl: parsed.sourceUrl
            )

            do {
                try await database.createNode(node)

                // Extract and create relationships
                let relationships = try await relationshipExtractor.extractRelationships(
                    from: parsed.body,
                    sourceNode: node,
                    dialect: parsed.detectedDialect
                )

                // Process tables and create structured data nodes
                let tables = try await tableProcessor.processTables(in: parsed.body, sourceNode: node)

                // Process attachments and images
                let attachments = try await attachmentProcessor.processAttachments(
                    in: parsed.body,
                    sourceNode: node,
                    basePath: basePath
                )

                print("Created \(relationships.count) relationships, \(tables.count) tables, and \(attachments.count) attachments for node: \(node.name)")
                return node
            } catch {
                throw UniversalImportError.databaseOperationFailed("create node: \(error.localizedDescription)")
            }

        } catch let error as UniversalImportError {
            throw error
        } catch {
            if error.localizedDescription.contains("encoding") {
                throw UniversalImportError.encodingError("Failed to read file \(fileURL.lastPathComponent): \(error.localizedDescription)")
            } else {
                throw UniversalImportError.fileFailed(fileURL.lastPathComponent, error)
            }
        }
    }

    // MARK: - Parsing Implementation

    private struct ParsedUniversalMarkdown {
        let title: String
        let sourceId: String
        let created: Date?
        let modified: Date?
        let folder: String?
        let tags: [String]
        let sourceUrl: String?
        let body: String
        let sanitizedBody: String
        let detectedDialect: MarkdownDialect
        let detectedFrontmatter: FrontmatterFormat
        let detectedSource: String
    }

    public enum MarkdownDialect {
        case commonMark
        case githubFlavored
        case obsidian

        var sourcePrefix: String {
            switch self {
            case .commonMark: return "markdown"
            case .githubFlavored: return "github-markdown"
            case .obsidian: return "obsidian"
            }
        }
    }

    private enum FrontmatterFormat {
        case none
        case yaml
        case toml
        case json
    }

    /// Parse universal markdown with dialect detection and multi-format frontmatter support
    private func parseUniversalMarkdown(_ content: String, filename: String, fallbackSourceId: String) throws -> ParsedUniversalMarkdown {
        // Step 1: Detect markdown dialect based on content analysis
        let detectedDialect = detectMarkdownDialect(content)

        // Step 2: Detect and parse frontmatter format
        let (frontmatterFormat, frontmatterData, bodyContent) = try parseFrontmatterSection(content)

        // Step 3: Extract metadata from frontmatter
        let metadata = try extractMetadata(from: frontmatterData, format: frontmatterFormat, filename: filename, fallbackSourceId: fallbackSourceId)

        // Step 4: Process body content based on dialect
        let processedBody = processBodyForDialect(bodyContent, dialect: detectedDialect)

        // Step 5: Sanitize content for security
        let sanitizedBody = sanitizeContent(processedBody)

        return ParsedUniversalMarkdown(
            title: metadata.title,
            sourceId: metadata.sourceId,
            created: metadata.created,
            modified: metadata.modified,
            folder: metadata.folder,
            tags: metadata.tags,
            sourceUrl: metadata.sourceUrl,
            body: processedBody,
            sanitizedBody: sanitizedBody,
            detectedDialect: detectedDialect,
            detectedFrontmatter: frontmatterFormat,
            detectedSource: detectedDialect.sourcePrefix
        )
    }

    /// Detect markdown dialect based on content features with scoring system
    private func detectMarkdownDialect(_ content: String) -> MarkdownDialect {
        var scores: [MarkdownDialect: Int] = [
            .commonMark: 1, // Base score for all markdown
            .githubFlavored: 0,
            .obsidian: 0
        ]

        let lines = content.components(separatedBy: .newlines)

        // Obsidian-style features (high confidence indicators)
        if content.contains("[[") && content.contains("]]") {
            scores[.obsidian, default: 0] += 10
        }

        // Check for Obsidian tags (#tag format in content)
        let obsidianTagPattern = "(?:^|\\s)#[a-zA-Z][a-zA-Z0-9-_]*(?:\\s|$)"
        if content.range(of: obsidianTagPattern, options: .regularExpression) != nil {
            scores[.obsidian, default: 0] += 5
        }

        // Check for Obsidian callouts (> [!note], > [!warning], etc.)
        let calloutPattern = ">\\s*\\[![a-zA-Z]+\\]"
        if content.range(of: calloutPattern, options: .regularExpression) != nil {
            scores[.obsidian, default: 0] += 8
        }

        // GitHub Flavored Markdown features

        // Tables (high confidence indicator)
        var hasTable = false
        for i in 0..<lines.count-1 {
            let line = lines[i].trimmingCharacters(in: .whitespaces)
            let nextLine = lines[i+1].trimmingCharacters(in: .whitespaces)

            // Check for table header pattern: | Header | Header |
            // Followed by separator: |--------|--------|
            if line.hasPrefix("|") && line.hasSuffix("|") && line.filter({ $0 == "|" }).count > 2 {
                if nextLine.hasPrefix("|") && nextLine.contains("-") && nextLine.hasSuffix("|") {
                    hasTable = true
                    break
                }
            }
        }
        if hasTable {
            scores[.githubFlavored, default: 0] += 10
        }

        // Task lists
        let taskListPattern = "^\\s*[-*+]\\s+\\[[x ]\\]\\s+"
        let taskListMatches = lines.filter { line in
            line.range(of: taskListPattern, options: .regularExpression) != nil
        }
        if !taskListMatches.isEmpty {
            scores[.githubFlavored, default: 0] += 5 + taskListMatches.count
        }

        // Strikethrough
        let strikethroughPattern = "~~[^~]+~~"
        if content.range(of: strikethroughPattern, options: .regularExpression) != nil {
            scores[.githubFlavored, default: 0] += 3
        }

        // Fenced code blocks with language (GitHub feature)
        let fencedCodePattern = "```[a-zA-Z][a-zA-Z0-9-+]*"
        let fencedCodeMatches = content.components(separatedBy: .newlines).filter { line in
            line.range(of: fencedCodePattern, options: .regularExpression) != nil
        }
        if !fencedCodeMatches.isEmpty {
            scores[.githubFlavored, default: 0] += 2 + fencedCodeMatches.count
        }

        // Autolinks (GitHub enhancement)
        let autolinkPattern = "https?://[^\\s)]+"
        let autolinkMatches = content.components(separatedBy: .whitespaces).filter { word in
            word.range(of: autolinkPattern, options: .regularExpression) != nil
        }
        if autolinkMatches.count > 2 {
            scores[.githubFlavored, default: 0] += 2
        }

        // Return dialect with highest score
        let maxScore = scores.values.max() ?? 1
        return scores.first { $0.value == maxScore }?.key ?? .commonMark
    }

    /// Parse frontmatter section and detect format
    private func parseFrontmatterSection(_ content: String) throws -> (FrontmatterFormat, String, String) {
        // Check for YAML frontmatter (most common)
        if content.hasPrefix("---\n") {
            let parts = content.components(separatedBy: "---")
            if parts.count >= 3 {
                let frontmatter = parts[1]
                let body = parts.dropFirst(2).joined(separator: "---").trimmingCharacters(in: .whitespacesAndNewlines)
                return (.yaml, frontmatter, body)
            }
        }

        // Check for TOML frontmatter
        if content.hasPrefix("+++\n") {
            let parts = content.components(separatedBy: "+++")
            if parts.count >= 3 {
                let frontmatter = parts[1]
                let body = parts.dropFirst(2).joined(separator: "+++").trimmingCharacters(in: .whitespacesAndNewlines)
                return (.toml, frontmatter, body)
            }
        }

        // Check for JSON frontmatter
        if content.hasPrefix("{\n") {
            // Look for end of JSON object
            var braceCount = 0
            var endIndex: String.Index?

            for (index, char) in content.enumerated() {
                if char == "{" {
                    braceCount += 1
                } else if char == "}" {
                    braceCount -= 1
                    if braceCount == 0 {
                        endIndex = content.index(content.startIndex, offsetBy: index + 1)
                        break
                    }
                }
            }

            if let endIndex = endIndex {
                let frontmatter = String(content[content.startIndex..<endIndex])
                let body = String(content[endIndex...]).trimmingCharacters(in: .whitespacesAndNewlines)
                return (.json, frontmatter, body)
            }
        }

        // No frontmatter detected
        return (.none, "", content)
    }

    /// Extract metadata from frontmatter based on format with intelligent field mapping
    private func extractMetadata(from frontmatterData: String, format: FrontmatterFormat, filename: String, fallbackSourceId: String) throws -> (title: String, sourceId: String, created: Date?, modified: Date?, folder: String?, tags: [String], sourceUrl: String?) {

        var title = filename.replacingOccurrences(of: ".md", with: "")
        var sourceId = fallbackSourceId
        var created: Date?
        var modified: Date?
        var folder: String?
        var tags: [String] = []
        var sourceUrl: String?

        guard !frontmatterData.isEmpty else {
            return (title, sourceId, created, modified, folder, tags, sourceUrl)
        }

        let metadata: [String: Any]
        switch format {
        case .none:
            return (title, sourceId, created, modified, folder, tags, sourceUrl)
        case .yaml:
            metadata = try parseYAMLMetadata(frontmatterData)
        case .toml:
            metadata = try parseTOMLMetadata(frontmatterData)
        case .json:
            metadata = try parseJSONMetadata(frontmatterData)
        }

        // Validate frontmatter fields for security
        try validateFrontmatterFields(metadata)

        // Apply intelligent field mapping
        let mappedFields = applyFieldMapping(metadata)

        // Extract values using mapped field names
        if let value = mappedFields.title { title = value }
        if let value = mappedFields.sourceId { sourceId = value }
        if let value = mappedFields.created { created = parseDate(value) }
        if let value = mappedFields.modified { modified = parseDate(value) }
        if let value = mappedFields.folder { folder = value }
        if let value = mappedFields.sourceUrl { sourceUrl = value }
        tags = mappedFields.tags

        return (title, sourceId, created, modified, folder, tags, sourceUrl)
    }

    /// Validate parsed data for consistency and security
    private func validateParsedData(_ parsed: ParsedUniversalMarkdown) throws {
        // Validate required fields
        if parsed.title.isEmpty {
            throw UniversalImportError.fieldValidationFailed("title", "Title cannot be empty")
        }

        if parsed.sourceId.isEmpty {
            throw UniversalImportError.fieldValidationFailed("sourceId", "Source ID cannot be empty")
        }

        // Validate dates
        if let created = parsed.created, let modified = parsed.modified {
            if created > modified {
                throw UniversalImportError.fieldValidationFailed("dates", "Created date cannot be after modified date")
            }
        }

        // Validate URL format
        if let sourceUrl = parsed.sourceUrl, !sourceUrl.isEmpty {
            if !isValidURL(sourceUrl) {
                throw UniversalImportError.fieldValidationFailed("sourceUrl", "Invalid URL format")
            }
        }

        // Validate dialect detection
        if !validateDialectDetection(parsed.body, detectedDialect: parsed.detectedDialect) {
            print("Warning: Dialect detection may be inaccurate for \(parsed.sourceId)")
        }
    }

    /// Check if URL format is valid
    private func isValidURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else { return false }
        return url.scheme != nil && url.host != nil
    }

    /// Parse YAML frontmatter with enhanced array and object support
    private func parseYAMLMetadata(_ yaml: String) throws -> [String: Any] {
        var metadata: [String: Any] = [:]
        var currentKey = ""
        var inArray = false
        var arrayItems: [String] = []

        let lines = yaml.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)

            // Handle array items
            if trimmed.hasPrefix("- ") {
                if inArray {
                    let value = String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces)
                    arrayItems.append(value.trimmingCharacters(in: CharacterSet(charactersIn: "\"'")))
                }
                continue
            }

            // Handle key-value pairs
            if let colonIdx = trimmed.firstIndex(of: ":"), !trimmed.hasPrefix("-") {
                // Save previous array if we were building one
                if inArray && !currentKey.isEmpty {
                    metadata[currentKey] = arrayItems
                    inArray = false
                    arrayItems = []
                }

                let key = String(trimmed[..<colonIdx]).trimmingCharacters(in: .whitespaces)
                let value = String(trimmed[trimmed.index(after: colonIdx)...])
                    .trimmingCharacters(in: .whitespaces)

                if value.isEmpty || value == "[]" {
                    // Start of array or empty array
                    currentKey = key
                    inArray = value.isEmpty
                    arrayItems = []
                    if value == "[]" {
                        metadata[key] = []
                    }
                } else {
                    // Simple value
                    let cleanValue = value.trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                    metadata[key] = cleanValue
                }
            }
        }

        // Handle trailing array
        if inArray && !currentKey.isEmpty {
            metadata[currentKey] = arrayItems
        }

        return metadata
    }

    /// Parse TOML frontmatter
    private func parseTOMLMetadata(_ toml: String) throws -> [String: Any] {
        do {
            let parsed = try TOMLTable(string: toml)
            return Dictionary(parsed)
        } catch {
            throw UniversalImportError.invalidFrontmatter("TOML", error.localizedDescription)
        }
    }

    /// Parse JSON frontmatter
    private func parseJSONMetadata(_ json: String) throws -> [String: Any] {
        do {
            guard let data = json.data(using: .utf8),
                  let parsed = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                throw UniversalImportError.invalidFrontmatter("JSON", "Invalid JSON structure")
            }
            return parsed
        } catch {
            throw UniversalImportError.invalidFrontmatter("JSON", error.localizedDescription)
        }
    }

    // MARK: - Intelligent Field Mapping

    private struct MappedFields {
        let title: String?
        let sourceId: String?
        let created: String?
        let modified: String?
        let folder: String?
        let sourceUrl: String?
        let tags: [String]
    }

    /// Apply intelligent field mapping to handle common property name variations
    private func applyFieldMapping(_ metadata: [String: Any]) -> MappedFields {
        // Common field name variations for each property
        let titleVariations = ["title", "name", "headline", "subject", "header"]
        let idVariations = ["id", "identifier", "uuid", "slug", "permalink"]
        let createdVariations = ["created", "created_at", "date", "published", "published_at"]
        let modifiedVariations = ["modified", "modified_at", "updated", "updated_at", "edited"]
        let folderVariations = ["folder", "category", "section", "path", "group"]
        let sourceVariations = ["source", "url", "link", "href", "origin"]
        let tagsVariations = ["tags", "keywords", "labels", "categories"]

        let title = extractFirstMatchingValue(from: metadata, variations: titleVariations) as? String
        let sourceId = extractFirstMatchingValue(from: metadata, variations: idVariations) as? String
        let created = extractFirstMatchingValue(from: metadata, variations: createdVariations) as? String
        let modified = extractFirstMatchingValue(from: metadata, variations: modifiedVariations) as? String
        let folder = extractFirstMatchingValue(from: metadata, variations: folderVariations) as? String
        let sourceUrl = extractFirstMatchingValue(from: metadata, variations: sourceVariations) as? String

        // Handle tags as either string array or comma-separated string
        let tags = extractTags(from: metadata, variations: tagsVariations)

        return MappedFields(
            title: title,
            sourceId: sourceId,
            created: created,
            modified: modified,
            folder: folder,
            sourceUrl: sourceUrl,
            tags: tags
        )
    }

    /// Extract the first matching value for any of the given field name variations
    private func extractFirstMatchingValue(from metadata: [String: Any], variations: [String]) -> Any? {
        for variation in variations {
            if let value = metadata[variation] {
                return value
            }
            // Also try case-insensitive matching
            if let key = metadata.keys.first(where: { $0.lowercased() == variation.lowercased() }) {
                return metadata[key]
            }
        }
        return nil
    }

    /// Extract tags from various field formats (array, comma-separated string, etc.)
    private func extractTags(from metadata: [String: Any], variations: [String]) -> [String] {
        for variation in variations {
            if let value = metadata[variation] {
                return convertToTagArray(value)
            }
            // Also try case-insensitive matching
            if let key = metadata.keys.first(where: { $0.lowercased() == variation.lowercased() }),
               let value = metadata[key] {
                return convertToTagArray(value)
            }
        }
        return []
    }

    /// Convert various tag formats to string array
    private func convertToTagArray(_ value: Any) -> [String] {
        if let stringArray = value as? [String] {
            return stringArray.map { $0.trimmingCharacters(in: .whitespaces) }
        } else if let string = value as? String {
            // Handle comma-separated, space-separated, or other delimiters
            let separators = [",", ";", "|", " "]
            for separator in separators {
                if string.contains(separator) {
                    return string.components(separatedBy: separator)
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty }
                }
            }
            // Single tag
            return [string.trimmingCharacters(in: .whitespaces)]
        } else if let anyArray = value as? [Any] {
            return anyArray.compactMap { "\($0)".trimmingCharacters(in: .whitespaces) }
        }
        return []
    }

    /// Process body content based on detected dialect with feature preservation
    private func processBodyForDialect(_ body: String, dialect: MarkdownDialect) -> String {
        switch dialect {
        case .commonMark:
            return processCommonMarkContent(body)
        case .githubFlavored:
            return processGitHubFlavoredContent(body)
        case .obsidian:
            return processObsidianContent(body)
        }
    }

    /// Process CommonMark content with standard formatting
    private func processCommonMarkContent(_ content: String) -> String {
        // For CommonMark, just ensure proper line ending normalization
        return content.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
    }

    /// Process GitHub Flavored Markdown content preserving tables and task lists
    private func processGitHubFlavoredContent(_ content: String) -> String {
        var processed = processCommonMarkContent(content)

        // Ensure task lists are properly formatted
        let taskListPattern = "(^\\s*[-*+]\\s+)\\[([ x])\\](\\s*)"
        processed = processed.replacingOccurrences(
            of: taskListPattern,
            with: "$1[$2]$3",
            options: [.regularExpression, .anchorsMatchLines]
        )

        // Preserve table formatting by ensuring proper spacing
        let lines = processed.components(separatedBy: .newlines)
        var processedLines: [String] = []

        for line in lines {
            if line.contains("|") && (line.hasPrefix("|") || line.hasSuffix("|")) {
                // This looks like a table row, preserve it carefully
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                processedLines.append(trimmed)
            } else {
                processedLines.append(line)
            }
        }

        return processedLines.joined(separator: "\n")
    }

    /// Process Obsidian content preserving wiki-links and special features
    private func processObsidianContent(_ content: String) -> String {
        var processed = processCommonMarkContent(content)

        // Normalize wiki-links but preserve their structure
        // Pattern: [[link]] or [[display text|actual link]]
        let wikiLinkPattern = "\\[\\[([^\\]|]+)(\\|([^\\]]+))?\\]\\]"
        processed = processed.replacingOccurrences(
            of: wikiLinkPattern,
            with: { match in
                let nsString = match as NSString
                let fullMatch = nsString.substring(with: NSRange(location: 0, length: nsString.length))
                // For now, preserve the original format - could enhance later
                return fullMatch
            },
            options: .regularExpression
        )

        // Preserve Obsidian callouts formatting
        let calloutPattern = "(^>\\s*\\[![a-zA-Z]+\\].*$)"
        processed = processed.replacingOccurrences(
            of: calloutPattern,
            with: "$1",
            options: [.regularExpression, .anchorsMatchLines]
        )

        return processed
    }

    // MARK: - Validation and Security

    /// Comprehensive validation of markdown content before processing
    private func validateMarkdownContent(_ content: String, filename: String) throws {
        var validationIssues: [String] = []

        // Check file size limits (10MB max for security)
        let maxSize = 10 * 1024 * 1024 // 10MB
        let contentSize = content.utf8.count
        if contentSize > maxSize {
            throw UniversalImportError.resourceLimitExceeded("File size", maxSize, contentSize)
        }

        // Check for malicious patterns
        let suspiciousPatterns = [
            "<script[^>]*>": "Embedded JavaScript",
            "<iframe[^>]*>": "Embedded iframe",
            "javascript:": "JavaScript protocol",
            "data:text/html": "Data URI HTML",
            "vbscript:": "VBScript protocol"
        ]

        for (pattern, description) in suspiciousPatterns {
            if content.range(of: pattern, options: .regularExpression) != nil {
                validationIssues.append(description)
            }
        }

        // Check content structure
        if content.isEmpty {
            validationIssues.append("Empty content")
        }

        // Check for excessive nesting (potential DoS)
        let maxNesting = 10
        let nestingLevel = calculateMaxNestingLevel(content)
        if nestingLevel > maxNesting {
            validationIssues.append("Excessive nesting level: \(nestingLevel)")
        }

        if !validationIssues.isEmpty {
            throw UniversalImportError.contentValidationFailed(filename, validationIssues)
        }
    }

    /// Validate frontmatter fields for security and data integrity
    private func validateFrontmatterFields(_ metadata: [String: Any]) throws {
        for (key, value) in metadata {
            // Validate field names (prevent injection)
            if !isValidFieldName(key) {
                throw UniversalImportError.fieldValidationFailed(key, "Invalid characters in field name")
            }

            // Validate value content
            if let stringValue = value as? String {
                try validateStringValue(stringValue, fieldName: key)
            } else if let arrayValue = value as? [Any] {
                for item in arrayValue {
                    if let stringItem = item as? String {
                        try validateStringValue(stringItem, fieldName: key)
                    }
                }
            }
        }
    }

    /// Sanitize content to prevent XSS and other security issues
    private func sanitizeContent(_ content: String) -> String {
        var sanitized = content

        // Remove potentially dangerous HTML elements
        let dangerousElements = [
            "<script[^>]*>.*?</script>",
            "<iframe[^>]*>.*?</iframe>",
            "<object[^>]*>.*?</object>",
            "<embed[^>]*>.*?</embed>",
            "<link[^>]*>",
            "<meta[^>]*>"
        ]

        for pattern in dangerousElements {
            sanitized = sanitized.replacingOccurrences(
                of: pattern,
                with: "",
                options: .regularExpression
            )
        }

        // Sanitize dangerous protocols
        sanitized = sanitized.replacingOccurrences(
            of: "javascript:",
            with: "",
            options: .caseInsensitive
        )
        sanitized = sanitized.replacingOccurrences(
            of: "vbscript:",
            with: "",
            options: .caseInsensitive
        )

        return sanitized
    }

    // MARK: - Helper Validation Functions

    /// Check if field name contains only safe characters
    private func isValidFieldName(_ name: String) -> Bool {
        let validPattern = "^[a-zA-Z][a-zA-Z0-9_-]*$"
        return name.range(of: validPattern, options: .regularExpression) != nil
    }

    /// Validate string values for length and content
    private func validateStringValue(_ value: String, fieldName: String) throws {
        // Check maximum length
        let maxLength = fieldName == "content" ? 1_000_000 : 1000
        if value.count > maxLength {
            throw UniversalImportError.resourceLimitExceeded(
                "Field '\(fieldName)' length",
                maxLength,
                value.count
            )
        }

        // Check for suspicious content in URL fields
        if fieldName.lowercased().contains("url") || fieldName.lowercased().contains("link") {
            let suspiciousSchemes = ["javascript:", "vbscript:", "data:text/html"]
            for scheme in suspiciousSchemes {
                if value.lowercased().hasPrefix(scheme) {
                    throw UniversalImportError.securityValidationFailed(fieldName, "Suspicious URL scheme")
                }
            }
        }
    }

    /// Calculate maximum nesting level in markdown content
    private func calculateMaxNestingLevel(_ content: String) -> Int {
        let lines = content.components(separatedBy: .newlines)
        var maxLevel = 0

        for line in lines {
            // Check blockquote nesting (> > > ...)
            let blockquoteLevel = line.prefix(while: { $0 == ">" || $0 == " " }).filter { $0 == ">" }.count

            // Check list nesting (indentation)
            let leadingSpaces = line.prefix(while: { $0 == " " }).count
            let listLevel = leadingSpaces / 2 // Assuming 2 spaces per level

            maxLevel = max(maxLevel, blockquoteLevel, listLevel)
        }

        return maxLevel
    }

    /// Progress reporting for batch operations
    private func reportProgress(_ processed: Int, total: Int, filename: String? = nil) {
        let percentage = Double(processed) / Double(total) * 100
        let message = filename.map { "Processing \($0) (\(processed)/\(total), \(Int(percentage))%)" }
                     ?? "Progress: \(processed)/\(total) (\(Int(percentage))%)"
        print(message)
    }

    // MARK: - Validation and Testing

    /// Validate dialect detection results for accuracy
    private func validateDialectDetection(_ content: String, detectedDialect: MarkdownDialect) -> Bool {
        switch detectedDialect {
        case .commonMark:
            // CommonMark should not have advanced features
            return !content.contains("[[") && !content.contains("- [x]") && !hasMarkdownTable(content)
        case .githubFlavored:
            // GitHub should have at least one GFM feature
            return content.contains("- [x]") || content.contains("- [ ]") ||
                   content.contains("~~") || hasMarkdownTable(content) ||
                   content.contains("```")
        case .obsidian:
            // Obsidian should have wiki-links or other Obsidian features
            return content.contains("[[") && content.contains("]]")
        }
    }

    /// Check if content contains markdown table
    private func hasMarkdownTable(_ content: String) -> Bool {
        let lines = content.components(separatedBy: .newlines)
        for i in 0..<lines.count-1 {
            let line = lines[i].trimmingCharacters(in: .whitespaces)
            let nextLine = lines[i+1].trimmingCharacters(in: .whitespaces)

            if line.hasPrefix("|") && line.hasSuffix("|") && line.filter({ $0 == "|" }).count > 2 {
                if nextLine.hasPrefix("|") && nextLine.contains("-") && nextLine.hasSuffix("|") {
                    return true
                }
            }
        }
        return false
    }

    /// Parse date string using multiple formats (reusing AltoIndexImporter logic)
    private func parseDate(_ dateString: String) -> Date? {
        let formatters: [ISO8601DateFormatter] = {
            let full = ISO8601DateFormatter()
            full.formatOptions = [.withInternetDateTime]

            let withFractional = ISO8601DateFormatter()
            withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

            return [full, withFractional]
        }()

        for formatter in formatters {
            if let date = formatter.date(from: dateString) {
                return date
            }
        }
        return nil
    }

    /// Extract summary from body content (reusing AltoIndexImporter logic)
    private func extractSummary(from body: String?) -> String? {
        guard let body, !body.isEmpty else { return nil }

        // Get first non-empty line, limited to 200 chars
        let lines = body.components(separatedBy: .newlines)
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if !trimmed.isEmpty && !trimmed.hasPrefix("#") && !trimmed.hasPrefix("[") {
                if trimmed.count > 200 {
                    return String(trimmed.prefix(197)) + "..."
                }
                return trimmed
            }
        }
        return nil
    }
}

// MARK: - Error Types

public enum UniversalImportError: Error, Sendable {
    case directoryNotFound(String)
    case fileFailed(String, Error)
    case invalidFormat(String)
    case invalidFrontmatter(String, String)
    case dialectDetectionFailed(String)
    case contentValidationFailed(String, [String])
    case fieldValidationFailed(String, String)
    case securityValidationFailed(String, String)
    case databaseOperationFailed(String)
    case encodingError(String)
    case parseError(String, String)
    case resourceLimitExceeded(String, Int, Int)
}

extension UniversalImportError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .directoryNotFound(let path):
            return "Directory not found: \(path)"
        case .fileFailed(let filename, let error):
            return "Failed to import \(filename): \(error.localizedDescription)"
        case .invalidFormat(let details):
            return "Invalid format: \(details)"
        case .invalidFrontmatter(let format, let details):
            return "Invalid \(format) frontmatter: \(details)"
        case .dialectDetectionFailed(let details):
            return "Failed to detect markdown dialect: \(details)"
        case .contentValidationFailed(let filename, let issues):
            return "Content validation failed for \(filename): \(issues.joined(separator: ", "))"
        case .fieldValidationFailed(let field, let reason):
            return "Field validation failed for '\(field)': \(reason)"
        case .securityValidationFailed(let type, let reason):
            return "Security validation failed for \(type): \(reason)"
        case .databaseOperationFailed(let operation):
            return "Database operation failed: \(operation)"
        case .encodingError(let details):
            return "Text encoding error: \(details)"
        case .parseError(let type, let details):
            return "Parse error in \(type): \(details)"
        case .resourceLimitExceeded(let resource, let limit, let actual):
            return "\(resource) limit exceeded: \(actual) > \(limit)"
        }
    }
}

// MARK: - Import Result (reusing AltoIndexImporter structure)

public struct ImportResult: Sendable {
    public var imported: Int = 0
    public var failed: Int = 0
    public var nodes: [Node] = []
    public var errors: [UniversalImportError] = []

    public var total: Int { imported + failed }
}