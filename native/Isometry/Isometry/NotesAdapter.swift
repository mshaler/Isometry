import Foundation
import SQLite3
import os

// ---------------------------------------------------------------------------
// NotesAdapter — Direct SQLite3 Read of NoteStore.sqlite
// ---------------------------------------------------------------------------
// Reads Apple Notes metadata (title, folder, dates, ZSNIPPET preview) directly
// from NoteStore.sqlite using the system C SQLite3 API. No external dependencies.
//
// Schema version detection via PRAGMA table_info handles column name differences
// across macOS versions (ZTITLE1 vs ZTITLE2, ZCREATIONDATE3 vs ZCREATIONDATE).
//
// Password-protected notes are detected and skipped with a count report.
// Full body text extraction is deferred to Phase 36 (protobuf parsing).
//
// Requirements addressed:
//   - NOTE-01: Title, folder, dates, 100-char snippet preview
//   - NOTE-02: Folder hierarchy via self-join on ZICCLOUDSYNCINGOBJECT
//   - NOTE-03: Hashtag extraction from ZSNIPPET
//   - NOTE-04: Encrypted note detection, skip, and count
//   - NOTE-05: Dedup via ZIDENTIFIER as source_id
//   - NOTE-06: Runtime schema version detection

private let logger = Logger(subsystem: "works.isometry.app", category: "NotesAdapter")

struct NotesAdapter: NativeImportAdapter {
    let sourceType = "native_notes"

    // Shared ISO 8601 formatter
    private static let isoFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")!
        return formatter
    }()

    /// Well-known path to Apple Notes database on macOS.
    private static let noteStorePath: String = {
        let home = NSHomeDirectory()
        return "\(home)/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite"
    }()

    // MARK: - Permission

    func checkPermission() -> PermissionStatus {
        let fm = FileManager.default
        if fm.isReadableFile(atPath: Self.noteStorePath) {
            return .granted
        }
        // Check if the Group Containers directory exists but isn't readable
        let groupDir = (Self.noteStorePath as NSString).deletingLastPathComponent
        if fm.fileExists(atPath: groupDir) {
            return .denied  // Exists but no access → need Full Disk Access
        }
        return .notDetermined
    }

    func requestPermission() async -> PermissionStatus {
        // Notes requires Full Disk Access — can't request programmatically.
        // The UI layer opens System Settings. Return current status.
        return checkPermission()
    }

    // MARK: - Fetch Cards

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            do {
                let cards = try self.readNotesFromDatabase()
                if !cards.isEmpty {
                    // Yield in batches of 500
                    let batchSize = 500
                    for batchStart in stride(from: 0, to: cards.count, by: batchSize) {
                        let batchEnd = min(batchStart + batchSize, cards.count)
                        continuation.yield(Array(cards[batchStart..<batchEnd]))
                    }
                }
            } catch {
                logger.error("Failed to read NoteStore.sqlite: \(error.localizedDescription)")
            }
            continuation.finish()
        }
    }

    // MARK: - Database Reading

    private func readNotesFromDatabase() throws -> [CanonicalCard] {
        let sourceURL = URL(fileURLWithPath: Self.noteStorePath)

        // FNDX-04: Copy-then-read for safe database access
        let permissionManager = PermissionManager()
        let tempDB = try permissionManager.copyDatabaseToTemp(from: sourceURL)
        defer {
            permissionManager.cleanupTempCopy(at: tempDB.deletingLastPathComponent())
        }

        // Open the copy read-only
        var db: OpaquePointer?
        let openResult = sqlite3_open_v2(
            tempDB.path,
            &db,
            SQLITE_OPEN_READONLY,
            nil
        )

        guard openResult == SQLITE_OK, let database = db else {
            let errorMsg = db.flatMap { String(cString: sqlite3_errmsg($0)) } ?? "unknown error"
            sqlite3_close(db)
            throw NativeImportError.adapterError("Failed to open NoteStore.sqlite: \(errorMsg)")
        }

        defer { sqlite3_close(database) }

        // NOTE-06: Detect schema version
        let schema = detectSchema(database)
        logger.info("NoteStore schema: title=\(schema.titleColumn), creation=\(schema.creationDateColumn)")

        // Build folder lookup for NOTE-02
        let folderMap = buildFolderMap(database, schema: schema)

        // Fetch notes
        let cards = fetchNotes(database, schema: schema, folderMap: folderMap)
        return cards
    }

    // MARK: - Schema Detection (NOTE-06)

    private struct NoteStoreSchema {
        let titleColumn: String
        let creationDateColumn: String
        let modificationDateColumn: String
        let hasPasswordProtected: Bool      // ZISPASSWORDPROTECTED column exists
        let hasCryptoVector: Bool           // ZCRYPTOINITIALIZATIONVECTOR column exists
        let accountColumn: String?          // ZACCOUNT3 or ZACCOUNT4
        let folderColumn: String            // Column pointing to folder Z_PK
    }

    /// Detect NoteStore.sqlite schema version by checking which columns exist.
    private func detectSchema(_ db: OpaquePointer) -> NoteStoreSchema {
        var columns = Set<String>()
        var stmt: OpaquePointer?

        if sqlite3_prepare_v2(db, "PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)", -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                if let namePtr = sqlite3_column_text(stmt, 1) {
                    columns.insert(String(cString: namePtr))
                }
            }
        }
        sqlite3_finalize(stmt)

        logger.info("NoteStore columns detected: \(columns.count) total")

        return NoteStoreSchema(
            titleColumn: columns.contains("ZTITLE1") ? "ZTITLE1" : "ZTITLE2",
            creationDateColumn: columns.contains("ZCREATIONDATE3") ? "ZCREATIONDATE3" :
                                columns.contains("ZCREATIONDATE1") ? "ZCREATIONDATE1" : "ZCREATIONDATE",
            modificationDateColumn: columns.contains("ZMODIFICATIONDATE1") ? "ZMODIFICATIONDATE1" : "ZMODIFICATIONDATE",
            hasPasswordProtected: columns.contains("ZISPASSWORDPROTECTED"),
            hasCryptoVector: columns.contains("ZCRYPTOINITIALIZATIONVECTOR"),
            accountColumn: columns.contains("ZACCOUNT4") ? "ZACCOUNT4" :
                          columns.contains("ZACCOUNT3") ? "ZACCOUNT3" : nil,
            folderColumn: columns.contains("ZFOLDER") ? "ZFOLDER" : "ZFOLDER"
        )
    }

    // MARK: - Folder Hierarchy (NOTE-02)

    /// Build a map from Z_PK → folder path string (e.g., "Work/Projects/Active").
    /// Uses self-join on parent to build full hierarchy paths.
    private func buildFolderMap(_ db: OpaquePointer, schema: NoteStoreSchema) -> [Int64: String] {
        var folderMap: [Int64: String] = [:]
        var parentMap: [Int64: Int64] = [:]   // Z_PK → parent Z_PK
        var nameMap: [Int64: String] = [:]    // Z_PK → folder title

        // Query all folder-type rows
        // Folders have ZTITLE (same column as notes) and ZPARENT for hierarchy
        let sql = """
            SELECT Z_PK, \(schema.titleColumn), ZPARENT
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE \(schema.titleColumn) IS NOT NULL
              AND ZIDENTIFIER IS NOT NULL
              AND ZMARKEDFORDELETION != 1
        """

        var stmt: OpaquePointer?
        if sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK {
            while sqlite3_step(stmt) == SQLITE_ROW {
                let pk = sqlite3_column_int64(stmt, 0)
                let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
                let parent = sqlite3_column_int64(stmt, 2)

                nameMap[pk] = title
                if parent > 0 {
                    parentMap[pk] = parent
                }
            }
        }
        sqlite3_finalize(stmt)

        // Build full paths by walking the parent chain
        func buildPath(_ pk: Int64) -> String {
            if let cached = folderMap[pk] {
                return cached
            }
            let name = nameMap[pk] ?? "Unknown"
            if let parentPK = parentMap[pk], parentPK != pk {
                let parentPath = buildPath(parentPK)
                let path = parentPath.isEmpty ? name : "\(parentPath)/\(name)"
                folderMap[pk] = path
                return path
            }
            folderMap[pk] = name
            return name
        }

        // Resolve all paths
        for pk in nameMap.keys {
            _ = buildPath(pk)
        }

        return folderMap
    }

    // MARK: - Note Fetching

    private func fetchNotes(
        _ db: OpaquePointer,
        schema: NoteStoreSchema,
        folderMap: [Int64: String]
    ) -> [CanonicalCard] {
        var cards: [CanonicalCard] = []
        var encryptedCount = 0

        // Build encrypted note filter
        var encryptedFilter = ""
        if schema.hasCryptoVector {
            encryptedFilter = "ZCRYPTOINITIALIZATIONVECTOR"
        } else if schema.hasPasswordProtected {
            encryptedFilter = "ZISPASSWORDPROTECTED"
        }

        // Main query: all notes with identifier and title
        let sql = """
            SELECT
                ZIDENTIFIER,
                \(schema.titleColumn),
                ZSNIPPET,
                \(schema.creationDateColumn),
                \(schema.modificationDateColumn),
                \(schema.folderColumn),
                \(encryptedFilter.isEmpty ? "0 as IS_ENCRYPTED" :
                    (schema.hasCryptoVector ?
                        "CASE WHEN \(encryptedFilter) IS NOT NULL THEN 1 ELSE 0 END as IS_ENCRYPTED" :
                        "\(encryptedFilter) as IS_ENCRYPTED")),
                Z_PK
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE ZIDENTIFIER IS NOT NULL
              AND \(schema.titleColumn) IS NOT NULL
              AND ZMARKEDFORDELETION != 1
        """

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMsg = String(cString: sqlite3_errmsg(db))
            logger.error("Failed to prepare notes query: \(errorMsg)")
            return cards
        }
        defer { sqlite3_finalize(stmt) }

        while sqlite3_step(stmt) == SQLITE_ROW {
            // Column 0: ZIDENTIFIER
            guard let identifierPtr = sqlite3_column_text(stmt, 0) else { continue }
            let identifier = String(cString: identifierPtr)

            // Column 1: Title
            let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? "Untitled"

            // Column 6: Is encrypted
            let isEncrypted = sqlite3_column_int(stmt, 6) != 0

            // NOTE-04: Skip encrypted notes but count them
            if isEncrypted {
                encryptedCount += 1
                continue
            }

            // Column 2: ZSNIPPET (NOTE-01: 100-char preview)
            let snippet = sqlite3_column_text(stmt, 2).map { String(cString: $0) }

            // Column 3: Creation date (CoreData timestamp)
            let creationTimestamp = sqlite3_column_double(stmt, 3)
            let createdAt = CoreDataTimestampConverter.toISO8601(creationTimestamp)
                ?? Self.isoFormatter.string(from: Date())

            // Column 4: Modification date
            let modificationTimestamp = sqlite3_column_double(stmt, 4)
            let modifiedAt = CoreDataTimestampConverter.toISO8601(modificationTimestamp)
                ?? createdAt

            // Column 5: Folder FK
            let folderPK = sqlite3_column_int64(stmt, 5)
            let folder = folderMap[folderPK]  // NOTE-02: resolved hierarchy path

            // NOTE-03: Extract hashtags from snippet
            let tags = extractHashtags(from: snippet ?? "")

            let card = CanonicalCard(
                id: UUID().uuidString,
                card_type: "note",
                name: title,
                content: snippet,  // NOTE-01: ZSNIPPET preview
                summary: nil,
                latitude: nil,
                longitude: nil,
                location_name: nil,
                created_at: createdAt,
                modified_at: modifiedAt,
                due_at: nil,
                completed_at: nil,
                event_start: nil,
                event_end: nil,
                folder: folder,  // NOTE-02
                tags: tags,      // NOTE-03
                status: nil,
                priority: 0,
                sort_order: 0,
                url: nil,
                mime_type: nil,
                is_collective: false,
                source: "native_notes",
                source_id: identifier,  // NOTE-05 dedup key
                source_url: nil,
                deleted_at: nil
            )
            cards.append(card)
        }

        // NOTE-04: Report encrypted note count
        if encryptedCount > 0 {
            logger.info("Skipped \(encryptedCount) encrypted notes")
        }
        logger.info("Fetched \(cards.count) notes (\(encryptedCount) encrypted skipped)")

        return cards
    }

    // MARK: - Hashtag Extraction (NOTE-03)

    /// Extract #hashtag patterns from text.
    /// Matches # followed by word characters (letters, digits, underscore).
    private func extractHashtags(from text: String) -> [String] {
        guard !text.isEmpty else { return [] }

        let pattern = #"#(\w+)"#
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return [] }

        let range = NSRange(text.startIndex..., in: text)
        let matches = regex.matches(in: text, range: range)

        var tags: [String] = []
        for match in matches {
            if let tagRange = Range(match.range(at: 1), in: text) {
                tags.append(String(text[tagRange]))
            }
        }

        return tags
    }
}
