import Foundation
import SQLite3

/// Direct Apple Notes database access importer with TCC integration
/// Extends AltoIndexImporter foundation with native Notes.app database parsing
public actor AppleNotesNativeImporter {
    private let database: IsometryDatabase
    private let altoIndexImporter: AltoIndexImporter
    private let notesAccessManager: NotesAccessManager

    // Notes database connection
    private var notesDatabase: OpaquePointer?
    private var isNotesDBOpen = false

    // Performance tracking
    private var performanceMetrics = ImportPerformanceMetrics()
    private var lastIncrementalSyncTime: Date = .distantPast

    public init(database: IsometryDatabase) {
        self.database = database
        self.altoIndexImporter = AltoIndexImporter(database: database)
        self.notesAccessManager = NotesAccessManager()
    }

    deinit {
        // Note: Database cleanup handled by SQLite automatically
        // Actor isolation prevents calling closeNotesDatabase() from deinit
        if isNotesDBOpen {
            sqlite3_close(notesDatabase)
        }
    }

    // MARK: - Public Import Interface

    /// Import notes using native database access (with permission fallback)
    public func importNotes(from directoryURL: URL? = nil) async throws -> ImportResult {
        let startTime = Date()

        // Check permission status first
        let permissionStatus = await notesAccessManager.checkCurrentPermissionStatus()

        switch permissionStatus {
        case .authorized:
            // Use native database access
            let result = try await importFromNativeDatabase()

            let duration = Date().timeIntervalSince(startTime)
            performanceMetrics.recordImport(
                duration: duration,
                notesProcessed: result.imported,
                method: .nativeDatabase
            )

            return result

        case .denied, .restricted, .notDetermined:
            // Graceful fallback to AltoIndexImporter
            print("Native database access not available (\(permissionStatus.rawValue)), falling back to alto-index")

            if let directoryURL = directoryURL {
                let result = try await altoIndexImporter.importNotes(from: directoryURL)

                let duration = Date().timeIntervalSince(startTime)
                performanceMetrics.recordImport(
                    duration: duration,
                    notesProcessed: result.imported,
                    method: .altoIndexFallback
                )

                return result
            } else {
                // Try to find alto-index export
                if let altoIndexPath = findAltoIndexExport() {
                    return try await altoIndexImporter.importNotes(from: altoIndexPath)
                } else {
                    throw NativeImportError.noDataSourceAvailable
                }
            }
        }
    }

    /// Import single note from native database by identifier
    public func importNoteByIdentifier(_ identifier: String) async throws -> Node? {
        let permissionStatus = await notesAccessManager.checkCurrentPermissionStatus()
        guard permissionStatus.isAccessible else {
            throw NativeImportError.permissionDenied
        }

        try openNotesDatabase()

        let query = """
        SELECT
            ZICCLOUDSYNCINGOBJECT.Z_PK,
            ZICCLOUDSYNCINGOBJECT.ZTITLE,
            ZICCLOUDSYNCINGOBJECT.ZCREATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZDATA,
            ZFOLDER.ZTITLE as FOLDER_TITLE,
            ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER
        FROM ZICCLOUDSYNCINGOBJECT
        LEFT JOIN ZFOLDER ON ZICCLOUDSYNCINGOBJECT.ZFOLDER = ZFOLDER.Z_PK
        WHERE ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER = ?
            AND ZICCLOUDSYNCINGOBJECT.ZMARKEDFORDELETION = 0
            AND ZICCLOUDSYNCINGOBJECT.ZTITLE IS NOT NULL
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        sqlite3_bind_text(statement, 1, identifier, -1, nil)

        if sqlite3_step(statement) == SQLITE_ROW {
            return try parseNoteFromRow(statement!)
        }

        return nil
    }

    /// Perform incremental import based on modification dates
    public func performIncrementalImport(since date: Date = Date.distantPast) async throws -> ImportResult {
        let permissionStatus = await notesAccessManager.checkCurrentPermissionStatus()
        guard permissionStatus.isAccessible else {
            throw NativeImportError.permissionDenied
        }

        try openNotesDatabase()

        let timeInterval = date.timeIntervalSinceReferenceDate

        let query = """
        SELECT
            ZICCLOUDSYNCINGOBJECT.Z_PK,
            ZICCLOUDSYNCINGOBJECT.ZTITLE,
            ZICCLOUDSYNCINGOBJECT.ZCREATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZDATA,
            ZFOLDER.ZTITLE as FOLDER_TITLE,
            ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER
        FROM ZICCLOUDSYNCINGOBJECT
        LEFT JOIN ZFOLDER ON ZICCLOUDSYNCINGOBJECT.ZFOLDER = ZFOLDER.Z_PK
        WHERE ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE > ?
            AND ZICCLOUDSYNCINGOBJECT.ZMARKEDFORDELETION = 0
            AND ZICCLOUDSYNCINGOBJECT.ZTITLE IS NOT NULL
        ORDER BY ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE ASC
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        sqlite3_bind_double(statement, 1, timeInterval)

        var result = ImportResult()

        while sqlite3_step(statement) == SQLITE_ROW {
            do {
                let node = try parseNoteFromRow(statement!)

                // Check if already imported (by sourceId)
                if let existingNode = try await database.getNode(bySourceId: node.sourceId ?? "", source: "apple-notes") {
                    // Update existing node if modified
                    var updated = existingNode
                    updated.name = node.name
                    updated.content = node.content
                    updated.folder = node.folder
                    updated.modifiedAt = node.modifiedAt
                    updated.sourceUrl = node.sourceUrl
                    try await database.updateNode(updated)
                    result.imported += 1
                    result.nodes.append(updated)
                } else {
                    // Create new node
                    try await database.createNode(node)
                    result.imported += 1
                    result.nodes.append(node)
                }
            } catch {
                result.failed += 1
                result.errors.append(ImportError.fileFailed("note-\(result.failed)", error))
                print("Failed to import note: \(error)")
            }
        }

        lastIncrementalSyncTime = Date()
        return result
    }

    // MARK: - Native Database Access

    /// Import from native Notes database with full TCC compliance
    private func importFromNativeDatabase() async throws -> ImportResult {
        try openNotesDatabase()

        let query = """
        SELECT
            ZICCLOUDSYNCINGOBJECT.Z_PK,
            ZICCLOUDSYNCINGOBJECT.ZTITLE,
            ZICCLOUDSYNCINGOBJECT.ZCREATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE,
            ZICCLOUDSYNCINGOBJECT.ZDATA,
            ZFOLDER.ZTITLE as FOLDER_TITLE,
            ZICCLOUDSYNCINGOBJECT.ZIDENTIFIER
        FROM ZICCLOUDSYNCINGOBJECT
        LEFT JOIN ZFOLDER ON ZICCLOUDSYNCINGOBJECT.ZFOLDER = ZFOLDER.Z_PK
        WHERE ZICCLOUDSYNCINGOBJECT.ZMARKEDFORDELETION = 0
            AND ZICCLOUDSYNCINGOBJECT.ZTITLE IS NOT NULL
        ORDER BY ZICCLOUDSYNCINGOBJECT.ZMODIFICATIONDATE ASC
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        var result = ImportResult()
        var processedCount = 0

        while sqlite3_step(statement) == SQLITE_ROW {
            do {
                let node = try parseNoteFromRow(statement!)

                // Check if already imported (by sourceId)
                if let existingNode = try await database.getNode(bySourceId: node.sourceId ?? "", source: "apple-notes") {
                    // Update existing node if modified
                    var updated = existingNode
                    updated.name = node.name
                    updated.content = node.content
                    updated.folder = node.folder
                    updated.modifiedAt = node.modifiedAt
                    updated.sourceUrl = node.sourceUrl
                    try await database.updateNode(updated)
                    result.imported += 1
                    result.nodes.append(updated)
                } else {
                    // Create new node
                    try await database.createNode(node)
                    result.imported += 1
                    result.nodes.append(node)
                }

                processedCount += 1

                // Progress feedback for large imports
                if processedCount % 100 == 0 {
                    print("Imported \(processedCount) notes from native database...")
                }

            } catch {
                result.failed += 1
                result.errors.append(ImportError.fileFailed("note-\(result.failed)", error))
                print("Failed to import note: \(error)")
            }
        }

        print("Native database import completed: \(result.imported) imported, \(result.failed) failed")
        return result
    }

    /// Open connection to Notes database
    private func openNotesDatabase() throws {
        guard !isNotesDBOpen else { return }

        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
        let notesDBPath = homeDirectory
            .appendingPathComponent("Library")
            .appendingPathComponent("Group Containers")
            .appendingPathComponent("group.com.apple.notes")
            .appendingPathComponent("NoteStore.sqlite")

        guard FileManager.default.fileExists(atPath: notesDBPath.path) else {
            throw NativeImportError.noteDatabaseNotFound(notesDBPath.path)
        }

        let result = sqlite3_open_v2(
            notesDBPath.path,
            &notesDatabase,
            SQLITE_OPEN_READONLY,
            nil
        )

        guard result == SQLITE_OK else {
            let errorMessage = String(cString: sqlite3_errmsg(notesDatabase))
            sqlite3_close(notesDatabase)
            notesDatabase = nil
            throw NativeImportError.databaseConnectionFailed(errorMessage)
        }

        isNotesDBOpen = true
        print("Opened Notes database at: \(notesDBPath.path)")
    }

    /// Close Notes database connection
    private func closeNotesDatabase() {
        if let db = notesDatabase {
            sqlite3_close(db)
            notesDatabase = nil
            isNotesDBOpen = false
            print("Closed Notes database connection")
        }
    }

    /// Parse note data from SQLite row
    private func parseNoteFromRow(_ statement: OpaquePointer) throws -> Node {
        // Extract basic metadata
        let pk = sqlite3_column_int64(statement, 0)

        let titleCString = sqlite3_column_text(statement, 1)
        let title = titleCString != nil ? String(cString: titleCString!) : "Untitled Note"

        let createdTimestamp = sqlite3_column_double(statement, 2)
        let modifiedTimestamp = sqlite3_column_double(statement, 3)

        let folderCString = sqlite3_column_text(statement, 5)
        let folder = folderCString != nil ? String(cString: folderCString!) : nil

        let identifierCString = sqlite3_column_text(statement, 6)
        let identifier = identifierCString != nil ? String(cString: identifierCString!) : "note-\(pk)"

        // Parse content from ZDATA (gzipped protobuf)
        var content: String = ""
        if sqlite3_column_type(statement, 4) == SQLITE_BLOB {
            let dataSize = sqlite3_column_bytes(statement, 4)
            if let dataPointer = sqlite3_column_blob(statement, 4), dataSize > 0 {
                let compressedData = Data(bytes: dataPointer, count: Int(dataSize))
                content = parseNoteContent(from: compressedData)
            }
        }

        // Convert Core Data timestamps to Date objects
        let created = Date(timeIntervalSinceReferenceDate: createdTimestamp)
        let modified = Date(timeIntervalSinceReferenceDate: modifiedTimestamp)

        // Create Node compatible with existing system
        let node = Node(
            id: UUID().uuidString,
            nodeType: "note",
            name: title,
            content: content.isEmpty ? nil : content,
            summary: extractSummary(from: content),
            createdAt: created,
            modifiedAt: modified,
            folder: folder,
            tags: [], // TODO: Parse tags from attachments
            source: "apple-notes",
            sourceId: identifier,
            sourceUrl: "notes://note/\(identifier)"
        )

        return node
    }

    /// Parse note content from compressed protobuf data
    private func parseNoteContent(from compressedData: Data) -> String {
        // For now, treat data as potentially already decompressed
        // TODO: Implement proper protobuf decompression when needed
        return parseProtobufContent(compressedData)
    }

    /// Parse protobuf content to extract plain text
    private func parseProtobufContent(_ data: Data) -> String {
        // This is a simplified parser for Notes protobuf format
        // Notes uses a custom protobuf schema, so we extract what we can

        guard let string = String(data: data, encoding: .utf8) else {
            // Try UTF-16 as fallback
            return String(data: data, encoding: .utf16) ?? ""
        }

        // Clean up protobuf artifacts and extract readable text
        let lines = string.components(separatedBy: .newlines)
        var cleanedLines: [String] = []

        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)

            // Skip lines that look like protobuf metadata
            if trimmed.isEmpty ||
               trimmed.hasPrefix("\0") ||
               trimmed.hasPrefix("\u{08}") ||
               trimmed.hasPrefix("\u{12}") ||
               trimmed.contains("\0") {
                continue
            }

            // Extract readable text content
            let cleanedLine = trimmed
                .replacingOccurrences(of: "\0", with: "")
                .replacingOccurrences(of: "\u{08}", with: "")
                .replacingOccurrences(of: "\u{12}", with: "")
                .trimmingCharacters(in: .whitespacesAndNewlines)

            if !cleanedLine.isEmpty && cleanedLine.count > 3 {
                cleanedLines.append(cleanedLine)
            }
        }

        return cleanedLines.joined(separator: "\n")
    }

    /// Extract summary from note content (reuse AltoIndexImporter logic)
    private func extractSummary(from body: String?) -> String? {
        guard let body = body, !body.isEmpty else { return nil }

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

    // MARK: - Fallback and Utility

    /// Find alto-index export directory as fallback
    private func findAltoIndexExport() -> URL? {
        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
        let altoIndexPaths = [
            homeDirectory.appendingPathComponent("Documents/alto-index"),
            homeDirectory.appendingPathComponent("Desktop/alto-index"),
            homeDirectory.appendingPathComponent("Downloads/alto-index")
        ]

        for path in altoIndexPaths {
            if FileManager.default.fileExists(atPath: path.path) {
                print("Found alto-index export at: \(path.path)")
                return path
            }
        }

        return nil
    }

    // MARK: - Performance Metrics

    public struct ImportPerformanceMetrics {
        var totalImports: Int = 0
        var lastImportDuration: TimeInterval = 0
        var averageImportDuration: TimeInterval = 0
        var nativeDatabaseImports: Int = 0
        var altoIndexFallbacks: Int = 0
        var errorCount: Int = 0
        var notesPerSecond: Double = 0

        mutating func recordImport(duration: TimeInterval, notesProcessed: Int, method: ImportMethod) {
            totalImports += 1
            lastImportDuration = duration
            averageImportDuration = ((averageImportDuration * Double(totalImports - 1)) + duration) / Double(totalImports)

            switch method {
            case .nativeDatabase:
                nativeDatabaseImports += 1
            case .altoIndexFallback:
                altoIndexFallbacks += 1
            }

            if duration > 0 {
                notesPerSecond = Double(notesProcessed) / duration
            }
        }

        mutating func recordError() {
            errorCount += 1
        }

        public var summary: String {
            """
            Import Performance Metrics:
            - Total imports: \(totalImports)
            - Average duration: \(String(format: "%.2f", averageImportDuration))s
            - Notes per second: \(String(format: "%.1f", notesPerSecond))
            - Native DB imports: \(nativeDatabaseImports)
            - Alto-index fallbacks: \(altoIndexFallbacks)
            - Errors: \(errorCount)
            """
        }
    }

    public enum ImportMethod {
        case nativeDatabase
        case altoIndexFallback
    }

    /// Get current performance metrics
    public var currentPerformanceMetrics: ImportPerformanceMetrics {
        return performanceMetrics
    }
}

// MARK: - Permission Management Integration

extension AppleNotesNativeImporter {

    /// Request Notes access permission through integrated NotesAccessManager
    public func requestNotesAccess() async throws -> NotesAccessManager.PermissionStatus {
        return try await notesAccessManager.requestNotesAccess()
    }

    /// Check current permission status
    public func checkPermissionStatus() async -> NotesAccessManager.PermissionStatus {
        return await notesAccessManager.checkCurrentPermissionStatus()
    }

    /// Get available access level
    public func getAvailableAccessLevel() async -> NotesAccessManager.AccessLevel {
        return await notesAccessManager.getAvailableAccessLevel()
    }

    /// Get user-friendly permission status message
    public func getPermissionStatusMessage() async -> String {
        return await notesAccessManager.getPermissionStatusMessage()
    }

    /// Get permission instructions
    public func getPermissionInstructions() async -> [String] {
        return await notesAccessManager.getPermissionInstructions()
    }

    // MARK: - Attachment Support

    /// Get attachment records for a specific note
    public func getAttachmentRecordsForNote(noteId: String) async throws -> [AttachmentRecord] {
        guard isNotesDBOpen else {
            try openNotesDatabase()
        }

        let query = """
        SELECT
            ZICCLOUDSYNCINGOBJECT.Z_PK,
            ZICCLOUDSYNCINGOBJECT.ZTITLE,
            ZICCLOUDSYNCINGOBJECT.ZTYPEUTI,
            ZICCLOUDSYNCINGOBJECT.ZFILENAME,
            ZICCLOUDSYNCINGOBJECT.ZFILESIZE,
            ZICCLOUDSYNCINGOBJECT.ZNOTE
        FROM ZICCLOUDSYNCINGOBJECT
        WHERE ZICCLOUDSYNCINGOBJECT.ZNOTE = ?
            AND ZICCLOUDSYNCINGOBJECT.ZTYPEUTI IS NOT NULL
            AND ZICCLOUDSYNCINGOBJECT.ZMARKEDFORDELETION = 0
        ORDER BY ZICCLOUDSYNCINGOBJECT.ZCREATIONDATE ASC
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        // Convert noteId to Notes database primary key
        guard let notePK = try await getNotesPrimaryKey(for: noteId) else {
            return [] // Note not found in Notes database
        }

        sqlite3_bind_int64(statement, 1, notePK)

        var attachmentRecords: [AttachmentRecord] = []

        while sqlite3_step(statement) == SQLITE_ROW {
            let pkValue = sqlite3_column_int64(statement, 0)
            let id = String(pkValue)

            // Get attachment properties
            let title = sqlite3_column_text(statement, 1).flatMap { String(cString: $0) }
            let typeUTI = sqlite3_column_text(statement, 2).flatMap { String(cString: $0) }
            let filename = sqlite3_column_text(statement, 3).flatMap { String(cString: $0) }
            let filesize = sqlite3_column_type(statement, 4) != SQLITE_NULL ?
                sqlite3_column_int64(statement, 4) : nil

            let record = AttachmentRecord(
                id: id,
                filename: filename ?? title ?? "attachment_\(id)",
                mimeType: nil, // Will be derived from UTI
                uti: typeUTI,
                size: filesize,
                noteId: noteId
            )

            attachmentRecords.append(record)
        }

        print("Found \(attachmentRecords.count) attachment records for note \(noteId)")
        return attachmentRecords
    }

    /// Extract attachment data from Notes storage
    public func extractAttachmentData(record: AttachmentRecord) async throws -> Data {
        guard isNotesDBOpen else {
            try openNotesDatabase()
        }

        // Query for attachment data
        let query = """
        SELECT ZDATA
        FROM ZICCLOUDSYNCINGOBJECT
        WHERE Z_PK = ?
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        guard let recordPK = Int64(record.id) else {
            throw NativeImportError.contentParsingFailed("Invalid attachment ID: \(record.id)")
        }

        sqlite3_bind_int64(statement, 1, recordPK)

        guard sqlite3_step(statement) == SQLITE_ROW else {
            throw NativeImportError.contentParsingFailed("Attachment data not found for ID: \(record.id)")
        }

        // Get attachment data blob
        if sqlite3_column_type(statement, 0) == SQLITE_BLOB {
            let dataPtr = sqlite3_column_blob(statement, 0)
            let dataSize = sqlite3_column_bytes(statement, 0)

            guard let dataPtr = dataPtr else {
                throw NativeImportError.contentParsingFailed("Null attachment data for ID: \(record.id)")
            }

            let attachmentData = Data(bytes: dataPtr, count: Int(dataSize))

            // Try to decompress if it's gzipped (Notes often compresses attachment data)
            if let decompressedData = try? decompressAttachmentData(attachmentData) {
                return decompressedData
            } else {
                return attachmentData
            }

        } else {
            throw NativeImportError.contentParsingFailed("No attachment data found for ID: \(record.id)")
        }
    }

    /// Get Notes primary key for a given note ID
    private func getNotesPrimaryKey(for noteId: String) async throws -> Int64? {
        guard isNotesDBOpen else {
            try openNotesDatabase()
        }

        let query = """
        SELECT Z_PK
        FROM ZICCLOUDSYNCINGOBJECT
        WHERE ZIDENTIFIER = ? OR Z_PK = ?
        LIMIT 1
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(notesDatabase, query, -1, &statement, nil) == SQLITE_OK else {
            throw NativeImportError.queryPreparationFailed(String(cString: sqlite3_errmsg(notesDatabase)))
        }

        defer {
            sqlite3_finalize(statement)
        }

        sqlite3_bind_text(statement, 1, noteId, -1, nil)

        // Also try treating noteId as primary key directly
        if let pkValue = Int64(noteId) {
            sqlite3_bind_int64(statement, 2, pkValue)
        } else {
            sqlite3_bind_null(statement, 2)
        }

        if sqlite3_step(statement) == SQLITE_ROW {
            return sqlite3_column_int64(statement, 0)
        }

        return nil
    }

    /// Decompress attachment data if it's compressed
    private func decompressAttachmentData(_ data: Data) throws -> Data {
        // Check if data is gzip compressed (starts with 1F 8B)
        if data.count >= 2 && data[0] == 0x1F && data[1] == 0x8B {
            return try (data as NSData).decompressed(using: .zlib) as Data
        }

        // Check if it's zlib compressed (starts with 78 XX)
        if data.count >= 2 && data[0] == 0x78 {
            return try (data as NSData).decompressed(using: .zlib) as Data
        }

        // Not compressed, return as-is
        return data
    }
}

// MARK: - Error Types

public enum NativeImportError: Error, LocalizedError {
    case permissionDenied
    case noteDatabaseNotFound(String)
    case databaseConnectionFailed(String)
    case queryPreparationFailed(String)
    case noDataSourceAvailable
    case contentParsingFailed(String)

    public var errorDescription: String? {
        switch self {
        case .permissionDenied:
            return "Permission denied for Notes database access"
        case .noteDatabaseNotFound(let path):
            return "Notes database not found at: \(path)"
        case .databaseConnectionFailed(let error):
            return "Failed to connect to Notes database: \(error)"
        case .queryPreparationFailed(let error):
            return "Failed to prepare database query: \(error)"
        case .noDataSourceAvailable:
            return "No data source available (no permissions and no alto-index export found)"
        case .contentParsingFailed(let details):
            return "Failed to parse note content: \(details)"
        }
    }
}

