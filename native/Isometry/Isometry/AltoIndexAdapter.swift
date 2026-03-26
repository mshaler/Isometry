import Foundation
import os

// ---------------------------------------------------------------------------
// AltoIndexAdapter — alto-index Directory Import
// ---------------------------------------------------------------------------
// Reads ALL .md files from the alto-index symlinked directory, parses YAML
// frontmatter in Swift, and yields CanonicalCard[] batches. Each subdirectory
// maps to the appropriate card_type:
//
//   notes/            → note     (apple_notes frontmatter: title, id, folder, attachments)
//   contacts/         → person   (title, contact_id, organization)
//   calendar/         → event    (title, event_id, start_date, end_date, attendees)
//   messages/         → note     (chat conversations)
//   books/            → resource (title, author, genre, progress)
//   calls/            → note     (call history per contact)
//   safari-history/   → resource (daily browsing logs)
//   kindle/           → resource (title, author, asin)
//   reminders/        → task     (title, list, priority, due_date)
//   safari-bookmarks/ → resource (bookmark folders)
//   voice-memos/      → resource (index + recordings)
//
// The adapter yields batches of 500 cards at a time to keep memory reasonable.
// NativeImportCoordinator slices these into 200-card bridge chunks.

private let logger = Logger(subsystem: "works.isometry.app", category: "AltoIndexAdapter")

struct AltoIndexAdapter: NativeImportAdapter, Sendable {
    let sourceType = "alto_index"

    // MARK: - Configuration

    /// Subdirectory definitions with card_type mapping
    private static let subdirectories: [(dir: String, cardType: String)] = [
        ("notes",            "note"),
        ("contacts",         "person"),
        ("calendar",         "event"),
        ("messages",         "note"),
        ("books",            "resource"),
        ("calls",            "note"),
        ("safari-history",   "resource"),
        ("kindle",           "resource"),
        ("reminders",        "task"),
        ("safari-bookmarks", "resource"),
        ("voice-memos",      "resource"),
    ]

    /// Batch size for yielding cards (coordinator slices into 200-card chunks)
    private static let batchSize = 500

    /// alto-index directory path (symlinked into the project)
    private static let altoIndexDir: String = {
        // Look for alto-index in the well-known alto.index app location
        let containers = NSHomeDirectory()
            .replacingOccurrences(of: "/Library/Containers/works.isometry.app/Data", with: "")
        let altoDir = "\(containers)/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index"
        if FileManager.default.fileExists(atPath: altoDir) {
            return altoDir
        }
        // Fallback: check Documents directory
        let documentsDir = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
        return documentsDir.appendingPathComponent("alto-index").path
    }()

    // Shared ISO 8601 formatter
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")!
        return formatter
    }()

    // MARK: - Directory Discovery (DISC-01, DISC-02)

    /// Discover which known alto-index subdirectories exist within the given root.
    /// Returns an array of (name, cardType, fullPath) for each found subdirectory.
    static func discoverSubdirectories(in rootURL: URL) -> [(name: String, cardType: String, path: String)] {
        let fm = FileManager.default
        var found: [(name: String, cardType: String, path: String)] = []
        for subdir in subdirectories {
            let dirURL = rootURL.appendingPathComponent(subdir.dir)
            var isDir: ObjCBool = false
            if fm.fileExists(atPath: dirURL.path, isDirectory: &isDir), isDir.boolValue {
                found.append((name: subdir.dir, cardType: subdir.cardType, path: dirURL.path))
            }
        }
        return found
    }

    // MARK: - Permission

    func checkPermission() -> PermissionStatus {
        let fm = FileManager.default
        if fm.isReadableFile(atPath: Self.altoIndexDir) {
            return .granted
        }
        if fm.fileExists(atPath: Self.altoIndexDir) {
            return .denied
        }
        return .notDetermined
    }

    func requestPermission() async -> PermissionStatus {
        // No system permission needed — just filesystem access
        return checkPermission()
    }

    // MARK: - Fetch Cards

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            let baseDir = Self.altoIndexDir
            let fm = FileManager.default

            guard fm.isReadableFile(atPath: baseDir) else {
                logger.error("alto-index directory not accessible: \(baseDir)")
                continuation.finish()
                return
            }

            var totalFiles = 0
            var totalCards = 0

            for subdir in Self.subdirectories {
                let dirPath = (baseDir as NSString).appendingPathComponent(subdir.dir)
                guard fm.fileExists(atPath: dirPath) else { continue }

                logger.info("Scanning \(subdir.dir)/...")

                let mdFiles = Self.collectMarkdownFiles(in: dirPath)
                totalFiles += mdFiles.count
                logger.info("  Found \(mdFiles.count) .md files in \(subdir.dir)/")

                // Process in batches
                var batch: [CanonicalCard] = []
                for (index, filePath) in mdFiles.enumerated() {
                    if let card = Self.parseFile(
                        path: filePath,
                        cardType: subdir.cardType,
                        subdirectory: subdir.dir,
                        index: index
                    ) {
                        batch.append(card)
                    }

                    if batch.count >= Self.batchSize {
                        totalCards += batch.count
                        continuation.yield(batch)
                        batch = []
                    }
                }

                // Yield remaining cards in this subdirectory
                if !batch.isEmpty {
                    totalCards += batch.count
                    continuation.yield(batch)
                    batch = []
                }
            }

            logger.info("alto-index scan complete: \(totalFiles) files → \(totalCards) cards")
            continuation.finish()
        }
    }

    // MARK: - File Collection

    /// Recursively collect all .md files from a directory, skipping CLAUDE.md
    private static func collectMarkdownFiles(in directory: String) -> [String] {
        var files: [String] = []
        let fm = FileManager.default

        guard let enumerator = fm.enumerator(
            at: URL(fileURLWithPath: directory),
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else { return files }

        for case let fileURL as URL in enumerator {
            let filename = fileURL.lastPathComponent
            if filename.hasSuffix(".md") && filename != "CLAUDE.md" {
                files.append(fileURL.path)
            }
        }

        return files
    }

    // MARK: - File Parsing

    /// Parse a single .md file with YAML frontmatter into a CanonicalCard
    private static func parseFile(
        path: String,
        cardType: String,
        subdirectory: String,
        index: Int
    ) -> CanonicalCard? {
        guard let data = FileManager.default.contents(atPath: path),
              let content = String(data: data, encoding: .utf8) else {
            return nil
        }

        // Parse YAML frontmatter
        let (frontmatter, body) = parseFrontmatter(content)

        // Extract title (frontmatter > first heading > filename)
        let title: String
        if let fmTitle = frontmatter["title"] as? String, !fmTitle.isEmpty {
            title = fmTitle
        } else if let contactName = frontmatter["contact"] as? String, !contactName.isEmpty {
            title = contactName
        } else {
            // Try first heading
            let headingPattern = try? NSRegularExpression(pattern: "^#\\s+(.+)$", options: .anchorsMatchLines)
            let bodyNS = body as NSString
            if let match = headingPattern?.firstMatch(in: body, range: NSRange(location: 0, length: bodyNS.length)),
               match.numberOfRanges > 1 {
                title = bodyNS.substring(with: match.range(at: 1)).trimmingCharacters(in: .whitespaces)
            } else {
                // Fallback to filename
                title = URL(fileURLWithPath: path).deletingPathExtension().lastPathComponent
            }
        }

        // Use file path as source_id — guaranteed unique across all subdirectories.
        // Recurring calendar events share event_id across date folders, so frontmatter
        // IDs are NOT unique. File path is the only reliable dedup key.
        let sourceId = path

        // Extract timestamps
        let now = isoFormatter.string(from: Date())
        let createdAt = extractTimestamp(frontmatter, keys: ["created", "created_date", "purchased"]) ?? now
        let modifiedAt = extractTimestamp(frontmatter, keys: ["modified", "modified_date", "last_modified", "last_opened", "last_accessed"]) ?? now

        // Extract dates specific to type
        let dueAt = extractTimestamp(frontmatter, keys: ["due_date", "due_at"])
        let eventStart = extractTimestamp(frontmatter, keys: ["start_date", "event_start"])
        let eventEnd = extractTimestamp(frontmatter, keys: ["end_date", "event_end"])

        // Extract folder (frontmatter > subdirectory path)
        let folder: String?
        if let fmFolder = frontmatter["folder"] as? String, !fmFolder.isEmpty {
            folder = fmFolder
        } else if let calendarName = frontmatter["calendar"] as? String {
            folder = "\(subdirectory)/\(calendarName)"
        } else if let listName = frontmatter["list"] as? String {
            folder = "\(subdirectory)/\(listName)"
        } else {
            // Derive folder from file path relative to subdirectory
            let relPath = extractRelativeFolder(path: path, subdirectory: subdirectory)
            folder = relPath.isEmpty ? subdirectory : "\(subdirectory)/\(relPath)"
        }

        // Extract tags
        var tags: [String] = []
        if let fmTags = frontmatter["tags"] as? [String] {
            tags = fmTags
        } else if let genre = frontmatter["genre"] as? String, !genre.isEmpty {
            tags.append(genre)
        }
        // Add subdirectory as a tag for easy filtering
        tags.append("alto:\(subdirectory)")

        // Extract priority
        let priority: Int
        if let fmPriority = frontmatter["priority"] as? String {
            switch fmPriority.lowercased() {
            case "high": priority = 3
            case "medium": priority = 2
            case "low": priority = 1
            default: priority = 0
            }
        } else if let fmPriority = frontmatter["rating"] as? Int {
            priority = fmPriority
        } else {
            priority = 0
        }

        // Extract URL
        let url: String?
        if let source = frontmatter["source"] as? String {
            url = source
        } else if let link = frontmatter["link"] as? String {
            url = link
        } else if let amazon = frontmatter["amazon"] as? String {
            url = amazon
        } else {
            url = nil
        }

        // Extract status
        let status: String?
        if let fmStatus = frontmatter["status"] as? String {
            status = fmStatus
        } else if let flagged = frontmatter["flagged"] as? Bool, flagged {
            status = "flagged"
        } else if let finished = frontmatter["finished"] as? Bool {
            status = finished ? "complete" : "incomplete"
        } else {
            status = nil
        }

        // Extract location
        let locationName = frontmatter["location"] as? String

        // Extract summary (for books: author, for contacts: organization)
        let summary: String?
        if let author = frontmatter["author"] as? String, !author.isEmpty {
            summary = "by \(author)"
        } else if let org = frontmatter["organization"] as? String, !org.isEmpty {
            summary = org
        } else {
            summary = body.isEmpty ? nil : String(body.prefix(200))
        }

        return CanonicalCard(
            id: UUID().uuidString,
            card_type: cardType,
            name: title,
            content: body.isEmpty ? nil : body,
            summary: summary,
            latitude: nil,
            longitude: nil,
            location_name: locationName,
            created_at: createdAt,
            modified_at: modifiedAt,
            due_at: dueAt,
            completed_at: nil,
            event_start: eventStart,
            event_end: eventEnd,
            folder: folder,
            tags: tags,
            status: status,
            priority: priority,
            sort_order: index,
            url: url,
            mime_type: "text/markdown",
            is_collective: false,
            source: "alto_index",
            source_id: sourceId,
            source_url: nil,
            deleted_at: nil
        )
    }

    // MARK: - YAML Frontmatter Parser

    /// Simple YAML frontmatter parser — extracts key-value pairs between --- delimiters
    private static func parseFrontmatter(_ content: String) -> (frontmatter: [String: Any], body: String) {
        let lines = content.components(separatedBy: "\n")
        guard lines.first?.trimmingCharacters(in: .whitespaces) == "---" else {
            return ([:], content)
        }

        var frontmatterLines: [String] = []
        var bodyStartIndex = 1
        var foundEnd = false

        for i in 1..<lines.count {
            if lines[i].trimmingCharacters(in: .whitespaces) == "---" {
                bodyStartIndex = i + 1
                foundEnd = true
                break
            }
            frontmatterLines.append(lines[i])
        }

        guard foundEnd else {
            return ([:], content)
        }

        // Parse YAML key-value pairs (simple flat parsing — no nested objects)
        var fm: [String: Any] = [:]
        var currentKey: String?
        var arrayValues: [String] = []

        for line in frontmatterLines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty { continue }

            // Array item (indented with -)
            if trimmed.hasPrefix("- ") && currentKey != nil {
                let value = String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces)
                // Skip complex nested objects (e.g., attachments with sub-fields)
                if !value.contains(":") || value.hasPrefix("\"") || value.hasPrefix("'") {
                    arrayValues.append(unquote(value))
                }
                continue
            }

            // Flush previous array
            if let key = currentKey, !arrayValues.isEmpty {
                fm[key] = arrayValues
                arrayValues = []
                currentKey = nil
            }

            // Key-value pair
            if let colonIndex = trimmed.firstIndex(of: ":") {
                let key = String(trimmed[trimmed.startIndex..<colonIndex]).trimmingCharacters(in: .whitespaces)
                let rawValue = String(trimmed[trimmed.index(after: colonIndex)...]).trimmingCharacters(in: .whitespaces)

                if rawValue.isEmpty {
                    // Possible array or nested object follows
                    currentKey = key
                } else if rawValue == "true" || rawValue == "false" {
                    fm[key] = rawValue == "true"
                    currentKey = nil
                } else if let intVal = Int(rawValue) {
                    fm[key] = intVal
                    currentKey = nil
                } else if let dblVal = Double(rawValue), rawValue.contains(".") {
                    fm[key] = dblVal
                    currentKey = nil
                } else {
                    fm[key] = unquote(rawValue)
                    currentKey = nil
                }
            }
        }

        // Flush final array
        if let key = currentKey, !arrayValues.isEmpty {
            fm[key] = arrayValues
        }

        // Body is everything after the second ---
        let body = lines[bodyStartIndex...].joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)

        return (fm, body)
    }

    /// Remove surrounding quotes from a string value
    private static func unquote(_ value: String) -> String {
        if (value.hasPrefix("\"") && value.hasSuffix("\"")) ||
           (value.hasPrefix("'") && value.hasSuffix("'")) {
            return String(value.dropFirst().dropLast())
        }
        return value
    }

    // MARK: - Helpers

    /// Extract an ISO 8601 timestamp from frontmatter, trying multiple key names
    private static func extractTimestamp(_ fm: [String: Any], keys: [String]) -> String? {
        for key in keys {
            if let value = fm[key] {
                if let str = value as? String, !str.isEmpty {
                    // Already ISO 8601 — return as-is
                    return str
                }
            }
        }
        return nil
    }

    /// Extract the relative folder path from an absolute file path
    private static func extractRelativeFolder(path: String, subdirectory: String) -> String {
        // Find the subdirectory in the path and take everything between it and the filename
        guard let range = path.range(of: "/\(subdirectory)/") else {
            return ""
        }
        let afterSubdir = String(path[range.upperBound...])
        // Remove the filename
        guard let lastSlash = afterSubdir.lastIndex(of: "/") else {
            return ""
        }
        return String(afterSubdir[afterSubdir.startIndex..<lastSlash])
    }
}
