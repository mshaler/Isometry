import Foundation
import SQLite3
import os

// ---------------------------------------------------------------------------
// NotesAdapter — Direct SQLite3 Read of NoteStore.sqlite
// ---------------------------------------------------------------------------
// Reads Apple Notes from NoteStore.sqlite using the system C SQLite3 API.
// Extracts full body text from gzip-compressed protobuf ZDATA blobs via
// ProtobufToMarkdown, with three-tier fallback to ZSNIPPET on failure.
//
// Schema version detection via PRAGMA table_info handles column name differences
// across macOS versions (ZTITLE1 vs ZTITLE2, ZCREATIONDATE3 vs ZCREATIONDATE).
//
// Password-protected notes are detected and skipped with a count report.
// Attachment metadata is queried from ZICCLOUDSYNCINGOBJECT and passed to
// the protobuf converter for inline placeholders and ## Attachments section.
// Note-to-note links emit link cards for bidirectional connection creation.
//
// Requirements addressed:
//   - NOTE-01..NOTE-06: Title, folder, dates, hashtags, encrypted skip, schema detection
//   - BODY-01: Full body text extraction from gzip+protobuf ZDATA blobs
//   - BODY-02: Graceful fallback to ZSNIPPET on unknown/malformed protobuf
//   - BODY-03: Attachment metadata (type, filename) preserved on cards
//   - BODY-04: Note-to-note links create connections between cards
//   - BODY-05: Body content indexed for FTS5 search (via content field)

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
            return .denied  // Exists but no access -> need Full Disk Access
        }
        return .notDetermined
    }

    func requestPermission() async -> PermissionStatus {
        // Notes requires Full Disk Access -- can't request programmatically.
        // The UI layer opens System Settings. Return current status.
        return checkPermission()
    }

    // MARK: - Fetch Cards

    func fetchCards() -> AsyncStream<[CanonicalCard]> {
        AsyncStream { continuation in
            Task {
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
    }

    // MARK: - Database Reading

    private func readNotesFromDatabase() throws -> [CanonicalCard] {
        let sourceURL = URL(fileURLWithPath: Self.noteStorePath)

        // FNDX-04: Copy-then-read for safe database access
        // Inline copy logic to avoid actor isolation (PermissionManager is an actor)
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fm.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let dbFilename = sourceURL.lastPathComponent
        let tempDB = tempDir.appendingPathComponent(dbFilename)
        try fm.copyItem(at: sourceURL, to: tempDB)

        // Copy WAL and SHM if they exist
        for ext in ["-wal", "-shm"] {
            let walSource = URL(fileURLWithPath: Self.noteStorePath + ext)
            if fm.fileExists(atPath: walSource.path) {
                try fm.copyItem(at: walSource, to: tempDir.appendingPathComponent(dbFilename + ext))
            }
        }

        defer {
            try? fm.removeItem(at: tempDir)
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
        logger.info("NoteStore schema: title=\(schema.titleColumn), creation=\(schema.creationDateColumn), hasNoteData=\(schema.hasNoteDataColumn)")

        // Build folder lookup for NOTE-02
        let folderMap = buildFolderMap(database, schema: schema)

        // BODY-03: Build attachment metadata lookup map (batch query, not per-note)
        let attachmentLookup = buildAttachmentLookup(database)

        // Fetch notes with protobuf extraction
        let cards = fetchNotes(database, schema: schema, folderMap: folderMap, attachmentLookup: attachmentLookup)
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
        let hasNoteDataColumn: Bool         // ZNOTEDATA column exists (JOIN key to ZICNOTEDATA)
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
            folderColumn: columns.contains("ZFOLDER") ? "ZFOLDER" : "ZFOLDER",
            hasNoteDataColumn: columns.contains("ZNOTEDATA")
        )
    }

    // MARK: - Attachment Metadata Lookup (BODY-03)

    /// Build a lookup map of attachment metadata: ZIDENTIFIER -> (filename, typeUti).
    /// Queries all attachment rows from ZICCLOUDSYNCINGOBJECT in a single batch.
    private func buildAttachmentLookup(_ db: OpaquePointer) -> [String: (filename: String?, typeUti: String?)] {
        var lookup: [String: (filename: String?, typeUti: String?)] = [:]

        let sql = """
            SELECT
                a.ZIDENTIFIER,
                a.ZTYPEUTI,
                m.ZFILENAME
            FROM ZICCLOUDSYNCINGOBJECT a
            LEFT JOIN ZICCLOUDSYNCINGOBJECT m ON a.ZMEDIA = m.Z_PK
            WHERE a.ZTYPEUTI IS NOT NULL
        """

        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else {
            let errorMsg = String(cString: sqlite3_errmsg(db))
            logger.warning("Failed to prepare attachment lookup query: \(errorMsg)")
            return lookup
        }
        defer { sqlite3_finalize(stmt) }

        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let identifierPtr = sqlite3_column_text(stmt, 0) else { continue }
            let identifier = String(cString: identifierPtr)
            let typeUti = sqlite3_column_text(stmt, 1).map { String(cString: $0) }
            let filename = sqlite3_column_text(stmt, 2).map { String(cString: $0) }

            lookup[identifier] = (filename: filename, typeUti: typeUti)
        }

        logger.info("Attachment lookup built: \(lookup.count) entries")
        return lookup
    }

    // MARK: - Folder Hierarchy (NOTE-02)

    /// Build a map from Z_PK -> folder path string (e.g., "Work/Projects/Active").
    /// Uses self-join on parent to build full hierarchy paths.
    private func buildFolderMap(_ db: OpaquePointer, schema: NoteStoreSchema) -> [Int64: String] {
        var folderMap: [Int64: String] = [:]
        var parentMap: [Int64: Int64] = [:]   // Z_PK -> parent Z_PK
        var nameMap: [Int64: String] = [:]    // Z_PK -> folder title

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

    // MARK: - Note Fetching (BODY-01..BODY-05)

    private func fetchNotes(
        _ db: OpaquePointer,
        schema: NoteStoreSchema,
        folderMap: [Int64: String],
        attachmentLookup: [String: (filename: String?, typeUti: String?)]
    ) -> [CanonicalCard] {
        var cards: [CanonicalCard] = []
        var encryptedCount = 0
        var fullBodyCount = 0
        var snippetFallbackCount = 0

        // Collect note-link targets for placeholder creation (BODY-04)
        var noteLinkTargets: [String] = []
        var importedNoteIdentifiers = Set<String>()

        // Build encrypted note filter
        var encryptedFilter = ""
        if schema.hasCryptoVector {
            encryptedFilter = "ZCRYPTOINITIALIZATIONVECTOR"
        } else if schema.hasPasswordProtected {
            encryptedFilter = "ZISPASSWORDPROTECTED"
        }

        // Main query: notes with ZDATA from ZICNOTEDATA (Pitfall 6: ZDATA lives in ZICNOTEDATA)
        // Column indices:
        //   0: ZIDENTIFIER
        //   1: title
        //   2: ZSNIPPET
        //   3: creation date
        //   4: modification date
        //   5: folder FK
        //   6: IS_ENCRYPTED
        //   7: Z_PK
        //   8: ZDATA (gzipped protobuf blob from ZICNOTEDATA)
        let zdataJoin = schema.hasNoteDataColumn
            ? "LEFT JOIN ZICNOTEDATA nd ON n.ZNOTEDATA = nd.Z_PK"
            : ""
        let zdataColumn = schema.hasNoteDataColumn ? "nd.ZDATA" : "NULL as ZDATA"

        let sql = """
            SELECT
                n.ZIDENTIFIER,
                n.\(schema.titleColumn),
                n.ZSNIPPET,
                n.\(schema.creationDateColumn),
                n.\(schema.modificationDateColumn),
                n.\(schema.folderColumn),
                \(encryptedFilter.isEmpty ? "0 as IS_ENCRYPTED" :
                    (schema.hasCryptoVector ?
                        "CASE WHEN n.\(encryptedFilter) IS NOT NULL THEN 1 ELSE 0 END as IS_ENCRYPTED" :
                        "n.\(encryptedFilter) as IS_ENCRYPTED")),
                n.Z_PK,
                \(zdataColumn)
            FROM ZICCLOUDSYNCINGOBJECT n
            \(zdataJoin)
            WHERE n.ZIDENTIFIER IS NOT NULL
              AND n.\(schema.titleColumn) IS NOT NULL
              AND n.ZMARKEDFORDELETION != 1
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

            // Track imported note identifiers for placeholder resolution
            importedNoteIdentifiers.insert(identifier)

            // Column 2: ZSNIPPET
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

            // Column 8: ZDATA (gzipped protobuf blob)
            var zdataBlob: Data? = nil
            let blobBytes = sqlite3_column_bytes(stmt, 8)
            if blobBytes > 0, let blobPtr = sqlite3_column_blob(stmt, 8) {
                zdataBlob = Data(bytes: blobPtr, count: Int(blobBytes))
            }

            // BODY-01/02: Extract body text via ProtobufToMarkdown three-tier fallback
            let result = ProtobufToMarkdown.extract(
                zdata: zdataBlob,
                snippet: snippet,
                attachmentLookup: attachmentLookup
            )

            // Track extraction statistics
            if result.isSnippetFallback {
                snippetFallbackCount += 1
            } else {
                fullBodyCount += 1
            }

            let card = CanonicalCard(
                id: UUID().uuidString,
                card_type: "note",
                name: title,
                content: result.body,           // BODY-01: Full body (or ZSNIPPET fallback)
                summary: result.summary,        // Auto-generated ~200-char summary
                latitude: nil,
                longitude: nil,
                location_name: nil,
                created_at: createdAt,
                modified_at: modifiedAt,
                due_at: nil,
                completed_at: nil,
                event_start: nil,
                event_end: nil,
                folder: folder,                 // NOTE-02
                tags: result.tags,              // BODY-01: Re-extracted from full body + type tags
                status: nil,
                priority: 0,
                sort_order: 0,
                url: nil,
                mime_type: nil,
                is_collective: false,
                source: "native_notes",
                source_id: identifier,          // NOTE-05 dedup key
                source_url: nil,
                deleted_at: nil
            )
            cards.append(card)

            // BODY-04: Emit note-link cards for connection creation
            for noteLink in result.noteLinks {
                noteLinkTargets.append(noteLink.targetIdentifier)

                let linkCard = CanonicalCard(
                    id: UUID().uuidString,
                    card_type: "note",
                    name: title,                // Source note's title
                    content: nil,
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
                    folder: nil,
                    tags: [],
                    status: nil,
                    priority: 0,
                    sort_order: 0,
                    url: nil,
                    mime_type: nil,
                    is_collective: false,
                    source: "native_notes",
                    // Colon-delimited: "notelink:{sourceZID}:{targetZID}"
                    // Safe because ZIDENTIFIERs are UUIDs (no colons)
                    source_id: "notelink:\(identifier):\(noteLink.targetIdentifier)",
                    source_url: "note-link:\(noteLink.targetIdentifier)",
                    deleted_at: nil
                )
                cards.append(linkCard)
            }
        }

        // BODY-04: Create placeholder cards for unresolved link targets
        let allLinkTargetSet = Set(noteLinkTargets)
        let unresolvedTargets = allLinkTargetSet.subtracting(importedNoteIdentifiers)

        for targetId in unresolvedTargets {
            let placeholderCard = CanonicalCard(
                id: UUID().uuidString,
                card_type: "collection",        // Per locked decision
                name: "Linked Note",
                content: "[Not imported -- encrypted or deleted]",  // Per locked decision
                summary: nil,
                latitude: nil,
                longitude: nil,
                location_name: nil,
                created_at: Self.isoFormatter.string(from: Date()),
                modified_at: Self.isoFormatter.string(from: Date()),
                due_at: nil,
                completed_at: nil,
                event_start: nil,
                event_end: nil,
                folder: nil,
                tags: [],
                status: nil,
                priority: 0,
                sort_order: 0,
                url: nil,
                mime_type: nil,
                is_collective: false,
                source: "native_notes",
                source_id: targetId,            // So note-link: resolves to this via sourceIdMap
                source_url: nil,
                deleted_at: nil
            )
            cards.append(placeholderCard)
        }

        // Report breakdown per locked decision
        let noteCount = fullBodyCount + snippetFallbackCount
        logger.info("\(noteCount) notes (\(fullBodyCount) full body, \(snippetFallbackCount) snippet fallback, \(encryptedCount) encrypted skipped)")
        if !unresolvedTargets.isEmpty {
            logger.info("Created \(unresolvedTargets.count) placeholder cards for unresolved note link targets")
        }

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
