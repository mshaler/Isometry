import Foundation

/// Imports notes from alto-index Notes export format
public actor AltoIndexImporter {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Import

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
            throw ImportError.appleNotesDirectoryNotFound(directoryURL.path)
        }

        // Collect all markdown file URLs first to avoid async iteration issues
        let markdownFiles: [URL] = enumerator.compactMap { element in
            guard let fileURL = element as? URL,
                  fileURL.pathExtension == "md" else { return nil }
            return fileURL
        }

        // Now process them asynchronously
        for fileURL in markdownFiles {
            do {
                let node = try await importNote(from: fileURL, relativeTo: directoryURL)
                result.imported += 1
                result.nodes.append(node)
            } catch {
                result.failed += 1
                result.errors.append(ImportError.appleNotesFileFailed(fileURL.lastPathComponent, error))
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

        let parsed = try parseMarkdown(content, filename: fileURL.lastPathComponent, fallbackSourceId: relativeId)

        // Check if already imported (by sourceId)
        if let existingNode = try await database.getNode(bySourceId: parsed.sourceId, source: "apple-notes") {
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
            source: "apple-notes",
            sourceId: parsed.sourceId,
            sourceUrl: parsed.sourceUrl
        )

        try await database.createNode(node)
        return node
    }

    // MARK: - Parsing

    private struct ParsedNote {
        let title: String
        let sourceId: String
        let created: Date?
        let modified: Date?
        let folder: String?
        let tags: [String]
        let sourceUrl: String?
        let body: String
    }

    /// Parses alto-index markdown with YAML frontmatter
    /// Follows the same parsing logic as the TypeScript alto-parser.ts
    private func parseMarkdown(_ content: String, filename: String, fallbackSourceId: String) throws -> ParsedNote {
        // Split on "---" to separate frontmatter from body
        let parts = content.components(separatedBy: "---")

        guard parts.count >= 3 else {
            // No frontmatter, use filename as title and relative path as sourceId
            return ParsedNote(
                title: filename.replacingOccurrences(of: ".md", with: ""),
                sourceId: fallbackSourceId,  // Use full relative path to avoid duplicates
                created: nil,
                modified: nil,
                folder: nil,
                tags: [],
                sourceUrl: nil,
                body: content
            )
        }

        let frontmatter = parts[1]
        let body = parts.dropFirst(2).joined(separator: "---").trimmingCharacters(in: .whitespacesAndNewlines)

        // Parse YAML frontmatter (matching TypeScript parseFrontmatter)
        var title = filename.replacingOccurrences(of: ".md", with: "")
        var sourceId = filename
        var created: Date?
        var modified: Date?
        var folder: String?
        var tags: [String] = []
        var sourceUrl: String?

        // Track array parsing state (matching TS parser)
        var currentKey = ""
        var inArray = false
        var arrayItems: [[String: String]] = []

        let lines = frontmatter.components(separatedBy: .newlines)
        for line in lines {
            // Array item: "  - id: ..." or "  - value"
            if line.hasPrefix("  - ") {
                if inArray {
                    let value = String(line.dropFirst(4)).trimmingCharacters(in: .whitespaces)
                    if value.contains(": ") {
                        // Start of object in array
                        let colonIdx = value.firstIndex(of: ":")!
                        let key = String(value[..<colonIdx]).trimmingCharacters(in: .whitespaces)
                        let val = String(value[value.index(after: colonIdx)...])
                            .trimmingCharacters(in: .whitespaces)
                            .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                        arrayItems.append([key: val])
                    }
                }
                continue
            }

            // Object property within array item: "    type: ..."
            if line.hasPrefix("    ") && inArray && !arrayItems.isEmpty {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                if let colonIdx = trimmed.firstIndex(of: ":") {
                    let key = String(trimmed[..<colonIdx]).trimmingCharacters(in: .whitespaces)
                    let val = String(trimmed[trimmed.index(after: colonIdx)...])
                        .trimmingCharacters(in: .whitespaces)
                        .trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                    arrayItems[arrayItems.count - 1][key] = val
                }
                continue
            }

            // End of array (non-indented, non-empty line)
            if inArray && !line.hasPrefix("  ") && !line.trimmingCharacters(in: .whitespaces).isEmpty {
                processArrayItems(key: currentKey, items: arrayItems, tags: &tags)
                inArray = false
                arrayItems = []
            }

            // Top-level key-value pair
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if let colonIdx = trimmed.firstIndex(of: ":"), !trimmed.hasPrefix("-") {
                let key = String(trimmed[..<colonIdx])
                let value = String(trimmed[trimmed.index(after: colonIdx)...]).trimmingCharacters(in: .whitespaces)

                if value.isEmpty || value == "[]" {
                    // Start of array or empty array
                    currentKey = key
                    inArray = value.isEmpty
                    arrayItems = []
                } else {
                    // Simple value - remove surrounding quotes
                    let cleanValue = value.trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
                    switch key {
                    case "title":
                        title = cleanValue
                    case "id":
                        sourceId = cleanValue
                    case "created":
                        created = parseDate(cleanValue)
                    case "modified":
                        modified = parseDate(cleanValue)
                    case "folder":
                        folder = cleanValue
                    case "source":
                        sourceUrl = cleanValue
                    default:
                        break
                    }
                }
            }
        }

        // Handle trailing array
        if inArray {
            processArrayItems(key: currentKey, items: arrayItems, tags: &tags)
        }

        return ParsedNote(
            title: title,
            sourceId: sourceId,
            created: created,
            modified: modified,
            folder: folder,
            tags: tags,
            sourceUrl: sourceUrl,
            body: body
        )
    }

    /// Process array items from frontmatter, extracting tags from hashtag attachments
    /// Matches TypeScript extractTags() function
    private func processArrayItems(key: String, items: [[String: String]], tags: inout [String]) {
        guard key == "attachments" else { return }

        for item in items {
            // Check for hashtag attachment type (matching TS extractTags)
            if item["type"] == "com.apple.notes.inlinetextattachment.hashtag",
               let content = item["content"] {
                // Extract tag from: <a class="tag link" href="/tags/CardBoard">#CardBoard</a>
                if let hashRange = content.range(of: "#"),
                   let endRange = content.range(of: "<", range: hashRange.upperBound..<content.endIndex) {
                    let tag = String(content[hashRange.upperBound..<endRange.lowerBound])
                    if !tag.isEmpty {
                        tags.append(tag)
                    }
                }
            }
        }
    }

    private func extractValue(from line: String, key: String) -> String {
        let value = line.dropFirst(key.count + 1).trimmingCharacters(in: .whitespaces)
        // Remove surrounding quotes if present
        if value.hasPrefix("\"") && value.hasSuffix("\"") {
            return String(value.dropFirst().dropLast())
        }
        return value
    }

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

