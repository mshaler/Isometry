import Foundation
import Markdown
import TOMLKit
import IsometryCore

/// Universal markdown importer supporting multiple dialects and frontmatter formats
/// Extends AltoIndexImporter patterns for consistent API design
public actor UniversalMarkdownImporter {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
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

        // Process them asynchronously
        for fileURL in markdownFiles {
            do {
                let node = try await importNote(from: fileURL, relativeTo: directoryURL)
                result.imported += 1
                result.nodes.append(node)
            } catch {
                result.failed += 1
                result.errors.append(UniversalImportError.fileFailed(fileURL.lastPathComponent, error))
                print("Import failed for \(fileURL.path): \(error)")
            }
        }

        return result
    }

    /// Imports a single markdown note
    public func importNote(from fileURL: URL, relativeTo baseURL: URL? = nil) async throws -> Node {
        let content = try String(contentsOf: fileURL, encoding: .utf8)

        // Use relative path for sourceId to handle duplicate filenames in different folders
        let relativeId: String
        if let base = baseURL {
            relativeId = fileURL.path.replacingOccurrences(of: base.path + "/", with: "")
        } else {
            relativeId = fileURL.lastPathComponent
        }

        let parsed = try parseUniversalMarkdown(content, filename: fileURL.lastPathComponent, fallbackSourceId: relativeId)

        // Check if already imported (by sourceId)
        if let existingNode = try await database.getNode(bySourceId: parsed.sourceId, source: parsed.detectedSource) {
            // Update existing node if modified
            var updated = existingNode
            updated.name = parsed.title
            updated.content = parsed.body
            updated.folder = parsed.folder
            updated.modifiedAt = parsed.modified ?? Date()
            updated.sourceUrl = parsed.sourceUrl
            try await database.updateNode(updated)
            return updated
        }

        // Create new node
        let node = Node(
            id: UUID().uuidString,
            nodeType: "note",
            name: parsed.title,
            content: parsed.body,
            summary: extractSummary(from: parsed.body),
            createdAt: parsed.created ?? Date(),
            modifiedAt: parsed.modified ?? Date(),
            folder: parsed.folder,
            tags: parsed.tags,
            source: parsed.detectedSource,
            sourceId: parsed.sourceId,
            sourceUrl: parsed.sourceUrl
        )

        try await database.createNode(node)
        return node
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
        let detectedDialect: MarkdownDialect
        let detectedFrontmatter: FrontmatterFormat
        let detectedSource: String
    }

    private enum MarkdownDialect {
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

        return ParsedUniversalMarkdown(
            title: metadata.title,
            sourceId: metadata.sourceId,
            created: metadata.created,
            modified: metadata.modified,
            folder: metadata.folder,
            tags: metadata.tags,
            sourceUrl: metadata.sourceUrl,
            body: processedBody,
            detectedDialect: detectedDialect,
            detectedFrontmatter: frontmatterFormat,
            detectedSource: detectedDialect.sourcePrefix
        )
    }

    /// Detect markdown dialect based on content features
    private func detectMarkdownDialect(_ content: String) -> MarkdownDialect {
        // Check for Obsidian-style features
        if content.contains("[[") && content.contains("]]") {
            return .obsidian
        }

        // Check for GitHub Flavored Markdown features
        if content.contains("|") && content.contains("---") && content.contains("\n") {
            // Look for table patterns
            let lines = content.components(separatedBy: .newlines)
            for i in 0..<lines.count-1 {
                if lines[i].contains("|") && lines[i+1].contains("---") {
                    return .githubFlavored
                }
            }
        }

        // Check for strikethrough
        if content.contains("~~") {
            return .githubFlavored
        }

        // Check for task lists
        if content.contains("- [ ]") || content.contains("- [x]") {
            return .githubFlavored
        }

        // Default to CommonMark
        return .commonMark
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

    /// Process body content based on detected dialect
    private func processBodyForDialect(_ body: String, dialect: MarkdownDialect) -> String {
        switch dialect {
        case .commonMark:
            return body
        case .githubFlavored:
            // Preserve GitHub-specific features
            return body
        case .obsidian:
            // Preserve Obsidian-specific features but could normalize wiki-links in future
            return body
        }
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