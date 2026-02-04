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
            throw ImportError.directoryNotFound(directoryURL.path)
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
                result.errors.append(ImportError.fileFailed(fileURL.lastPathComponent, error))
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

// MARK: - Import Result

public struct ImportResult: Sendable {
    public var imported: Int = 0
    public var failed: Int = 0
    public var nodes: [Node] = []
    public var errors: [ImportError] = []

    public var total: Int { imported + failed }
}

// MARK: - Import Error

public enum ImportError: Error, Sendable {
    case directoryNotFound(String)
    case fileFailed(String, Error)
    case invalidFormat(String)
}

extension ImportError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .directoryNotFound(let path):
            return "Directory not found: \(path)"
        case .fileFailed(let filename, let error):
            return "Failed to import \(filename): \(error.localizedDescription)"
        case .invalidFormat(let details):
            return "Invalid format: \(details)"
        }
    }
}

// MARK: - Testing Protocol Conformance

import Testing

extension AltoIndexImporter: ExportableImporterProtocol {

    public func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Create temporary file for content-based import
        let tempDirectory = FileManager.default.temporaryDirectory
        let tempFile = tempDirectory.appendingPathComponent(filename)

        try content.write(to: tempFile)
        defer {
            try? FileManager.default.removeItem(at: tempFile)
        }

        let node = try await importNote(from: tempFile, relativeTo: tempDirectory)

        var result = ImportResult()
        result.imported = 1
        result.nodes.append(node)

        return result
    }

    public func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let node = try await importNote(from: url, relativeTo: url.deletingLastPathComponent())

        var result = ImportResult()
        result.imported = 1
        result.nodes.append(node)

        return result
    }

    nonisolated public var supportedExtensions: [String] {
        return ["md", "markdown"]
    }

    nonisolated public var importerName: String {
        return "AltoIndexImporter"
    }

    /// Export nodes back to alto-index markdown format
    public func exportNodes(_ nodes: [Node], to url: URL) async throws -> Data {
        var exportedContent = ""

        for node in nodes {
            let markdown = try exportNodeToMarkdown(node)
            exportedContent += markdown + "\n\n---\n\n"
        }

        let data = exportedContent.data(using: .utf8) ?? Data()
        try data.write(to: url)

        return data
    }

    /// Validate round-trip data preservation
    public func validateRoundTripData(original: Data, exported: Data) async throws -> RoundTripValidationResult {
        guard let originalString = String(data: original, encoding: .utf8),
              let exportedString = String(data: exported, encoding: .utf8) else {
            throw ImportError.invalidFormat("Unable to decode UTF-8 content")
        }

        // Parse both original and exported content
        let originalNotes = try parseMultipleMarkdownNotes(originalString)
        let exportedNotes = try parseMultipleMarkdownNotes(exportedString)

        // Calculate preservation metrics
        let preservationAccuracy = calculateDataPreservation(original: originalNotes, exported: exportedNotes)
        let latchAccuracy = calculateLATCHMappingAccuracy(original: originalNotes, exported: exportedNotes)
        let contentIntegrity = calculateContentIntegrity(original: originalNotes, exported: exportedNotes)
        let schemaConformance = calculateSchemaConformance(notes: exportedNotes)

        // Identify acceptable vs unexpected differences
        let (acceptable, unexpected) = identifyDifferences(original: originalNotes, exported: exportedNotes)

        let report = generateDetailedReport(
            original: originalNotes,
            exported: exportedNotes,
            preservationAccuracy: preservationAccuracy,
            latchAccuracy: latchAccuracy,
            acceptable: acceptable,
            unexpected: unexpected
        )

        return RoundTripValidationResult(
            preservationAccuracy: preservationAccuracy,
            latchMappingAccuracy: latchAccuracy,
            contentIntegrityScore: contentIntegrity,
            schemaConformanceScore: schemaConformance,
            acceptableLosses: acceptable,
            unexpectedDifferences: unexpected,
            detailedReport: report
        )
    }

    // MARK: - Export Implementation

    private func exportNodeToMarkdown(_ node: Node) throws -> String {
        var frontmatter = "---\n"
        frontmatter += "title: \"\(node.name.replacingOccurrences(of: "\"", with: "\\\""))\"\n"
        frontmatter += "id: \"\(node.sourceId ?? node.id)\"\n"

        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime]

        frontmatter += "created: \"\(isoFormatter.string(from: node.createdAt))\"\n"
        frontmatter += "modified: \"\(isoFormatter.string(from: node.modifiedAt))\"\n"

        if let folder = node.folder {
            frontmatter += "folder: \"\(folder.replacingOccurrences(of: "\"", with: "\\\""))\"\n"
        }

        if let sourceUrl = node.sourceUrl {
            frontmatter += "source: \"\(sourceUrl.replacingOccurrences(of: "\"", with: "\\\""))\"\n"
        }

        // Export tags as attachments array (matching alto-index format)
        if !node.tags.isEmpty {
            frontmatter += "attachments:\n"
            for tag in node.tags {
                frontmatter += "  - type: com.apple.notes.inlinetextattachment.hashtag\n"
                frontmatter += "    content: \"<a class=\\\"tag link\\\" href=\\\"/tags/\(tag)\\\">#\(tag)</a>\"\n"
            }
        }

        frontmatter += "---\n"

        let content = node.content ?? ""
        return frontmatter + content
    }

    // MARK: - Round-Trip Validation Implementation

    private func parseMultipleMarkdownNotes(_ content: String) throws -> [ParsedNote] {
        // Split content by document separators if multiple notes
        let documents = content.components(separatedBy: "\n---\n")
        var notes: [ParsedNote] = []

        for (index, doc) in documents.enumerated() {
            if !doc.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let filename = "note-\(index).md"
                let note = try parseMarkdown(doc, filename: filename, fallbackSourceId: filename)
                notes.append(note)
            }
        }

        return notes
    }

    private func calculateDataPreservation(original: [ParsedNote], exported: [ParsedNote]) -> Double {
        guard !original.isEmpty else { return 1.0 }

        var preservedFields = 0
        var totalFields = 0

        let minCount = min(original.count, exported.count)

        for i in 0..<minCount {
            let orig = original[i]
            let exp = exported[i]

            // Check each field
            totalFields += 7 // title, sourceId, created, modified, folder, tags, body

            if orig.title == exp.title { preservedFields += 1 }
            if orig.sourceId == exp.sourceId { preservedFields += 1 }
            if compareDates(orig.created, exp.created) { preservedFields += 1 }
            if compareDates(orig.modified, exp.modified) { preservedFields += 1 }
            if orig.folder == exp.folder { preservedFields += 1 }
            if Set(orig.tags) == Set(exp.tags) { preservedFields += 1 }
            if orig.body.trimmingCharacters(in: .whitespacesAndNewlines) == exp.body.trimmingCharacters(in: .whitespacesAndNewlines) {
                preservedFields += 1
            }
        }

        // Account for missing notes
        if original.count != exported.count {
            let missingNotes = abs(original.count - exported.count)
            totalFields += missingNotes * 7
        }

        return totalFields > 0 ? Double(preservedFields) / Double(totalFields) : 0.0
    }

    private func calculateLATCHMappingAccuracy(original: [ParsedNote], exported: [ParsedNote]) -> Double {
        guard !original.isEmpty else { return 1.0 }

        var correctMappings = 0
        var totalMappings = 0

        for i in 0..<min(original.count, exported.count) {
            let orig = original[i]
            let exp = exported[i]

            // L - Location (not typically in alto-index)
            totalMappings += 1
            correctMappings += 1 // No location data expected

            // A - Alphabet (title/name)
            totalMappings += 1
            if orig.title == exp.title { correctMappings += 1 }

            // T - Time (created/modified dates)
            totalMappings += 2
            if compareDates(orig.created, exp.created) { correctMappings += 1 }
            if compareDates(orig.modified, exp.modified) { correctMappings += 1 }

            // C - Category (folder)
            totalMappings += 1
            if orig.folder == exp.folder { correctMappings += 1 }

            // H - Hierarchy (tags as hierarchy markers)
            totalMappings += 1
            if Set(orig.tags) == Set(exp.tags) { correctMappings += 1 }
        }

        return totalMappings > 0 ? Double(correctMappings) / Double(totalMappings) : 0.0
    }

    private func calculateContentIntegrity(original: [ParsedNote], exported: [ParsedNote]) -> Double {
        guard !original.isEmpty else { return 1.0 }

        var totalContentScore = 0.0
        let noteCount = min(original.count, exported.count)

        for i in 0..<noteCount {
            let orig = original[i].body.trimmingCharacters(in: .whitespacesAndNewlines)
            let exp = exported[i].body.trimmingCharacters(in: .whitespacesAndNewlines)

            if orig == exp {
                totalContentScore += 1.0
            } else if orig.isEmpty && exp.isEmpty {
                totalContentScore += 1.0
            } else {
                // Calculate similarity score for partial credit
                let similarity = stringSimilarity(orig, exp)
                totalContentScore += similarity
            }
        }

        return noteCount > 0 ? totalContentScore / Double(noteCount) : 0.0
    }

    private func calculateSchemaConformance(notes: [ParsedNote]) -> Double {
        guard !notes.isEmpty else { return 1.0 }

        var conformantNotes = 0

        for note in notes {
            var isConformant = true

            // Check required fields
            if note.title.isEmpty { isConformant = false }
            if note.sourceId.isEmpty { isConformant = false }

            // Check date validity
            if let created = note.created, let modified = note.modified {
                if created > modified { isConformant = false }
            }

            if isConformant { conformantNotes += 1 }
        }

        return Double(conformantNotes) / Double(notes.count)
    }

    private func identifyDifferences(original: [ParsedNote], exported: [ParsedNote]) -> (acceptable: [String], unexpected: [String]) {
        var acceptable: [String] = []
        var unexpected: [String] = []

        // Note count differences
        if original.count != exported.count {
            unexpected.append("Note count mismatch: \(original.count) → \(exported.count)")
        }

        let minCount = min(original.count, exported.count)

        for i in 0..<minCount {
            let orig = original[i]
            let exp = exported[i]

            // Timestamp precision differences are acceptable
            if let origCreated = orig.created, let expCreated = exp.created {
                let timeDiff = abs(origCreated.timeIntervalSince(expCreated))
                if timeDiff > 1.0 { // More than 1 second difference
                    if timeDiff < 60.0 { // Less than 1 minute - acceptable precision loss
                        acceptable.append("Timestamp precision loss: \(timeDiff)s")
                    } else {
                        unexpected.append("Significant timestamp difference: \(timeDiff)s")
                    }
                }
            }

            // Content formatting differences
            if orig.body != exp.body {
                let origTrimmed = orig.body.trimmingCharacters(in: .whitespacesAndNewlines)
                let expTrimmed = exp.body.trimmingCharacters(in: .whitespacesAndNewlines)

                if origTrimmed == expTrimmed {
                    acceptable.append("Whitespace normalization")
                } else {
                    unexpected.append("Content mismatch in note '\(orig.title)'")
                }
            }

            // Metadata differences
            if orig.title != exp.title {
                unexpected.append("Title mismatch: '\(orig.title)' → '\(exp.title)'")
            }

            if orig.folder != exp.folder {
                unexpected.append("Folder mismatch: '\(orig.folder ?? "nil")' → '\(exp.folder ?? "nil")'")
            }

            if Set(orig.tags) != Set(exp.tags) {
                unexpected.append("Tags mismatch: \(orig.tags) → \(exp.tags)")
            }
        }

        return (acceptable: acceptable, unexpected: unexpected)
    }

    private func generateDetailedReport(
        original: [ParsedNote],
        exported: [ParsedNote],
        preservationAccuracy: Double,
        latchAccuracy: Double,
        acceptable: [String],
        unexpected: [String]
    ) -> String {
        var report = "Round-Trip Validation Report\n"
        report += "============================\n\n"

        report += "Summary:\n"
        report += "- Original notes: \(original.count)\n"
        report += "- Exported notes: \(exported.count)\n"
        report += "- Data preservation: \(String(format: "%.1f", preservationAccuracy * 100))%\n"
        report += "- LATCH mapping: \(String(format: "%.1f", latchAccuracy * 100))%\n\n"

        if !acceptable.isEmpty {
            report += "Acceptable Differences:\n"
            for diff in acceptable {
                report += "- \(diff)\n"
            }
            report += "\n"
        }

        if !unexpected.isEmpty {
            report += "Unexpected Differences:\n"
            for diff in unexpected {
                report += "- \(diff)\n"
            }
            report += "\n"
        }

        report += "Overall Assessment: "
        if preservationAccuracy >= 0.999 && latchAccuracy >= 0.95 && unexpected.isEmpty {
            report += "✅ PASS - Round-trip validation successful"
        } else {
            report += "❌ FAIL - Issues detected in round-trip validation"
        }

        return report
    }

    // MARK: - Utility Methods

    private func compareDates(_ date1: Date?, _ date2: Date?) -> Bool {
        guard let d1 = date1, let d2 = date2 else {
            return date1 == nil && date2 == nil
        }

        // Allow for small timestamp differences (1 second precision)
        return abs(d1.timeIntervalSince(d2)) < 1.0
    }

    private func stringSimilarity(_ str1: String, _ str2: String) -> Double {
        let longer = str1.count > str2.count ? str1 : str2
        let shorter = str1.count > str2.count ? str2 : str1

        if longer.isEmpty { return 1.0 }

        let editDistance = levenshteinDistance(str1, str2)
        return (Double(longer.count) - Double(editDistance)) / Double(longer.count)
    }

    private func levenshteinDistance(_ str1: String, _ str2: String) -> Int {
        let s1 = Array(str1)
        let s2 = Array(str2)
        let m = s1.count
        let n = s2.count

        var dp = Array(repeating: Array(repeating: 0, count: n + 1), count: m + 1)

        for i in 0...m {
            dp[i][0] = i
        }

        for j in 0...n {
            dp[0][j] = j
        }

        for i in 1...m {
            for j in 1...n {
                if s1[i - 1] == s2[j - 1] {
                    dp[i][j] = dp[i - 1][j - 1]
                } else {
                    dp[i][j] = min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1
                }
            }
        }

        return dp[m][n]
    }
}
