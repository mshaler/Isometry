import Foundation
import GRDB

/// SQLite file importer for handling exported Apple app databases
public actor SQLiteFileImporter {
    private let database: IsometryDatabase

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public Interface

    /// Import SQLite database from file URL
    public func importDatabase(from fileURL: URL) async throws -> ImportResult {
        guard fileURL.startAccessingSecurityScopedResource() else {
            throw SQLiteImportError.fileAccessDenied
        }
        defer { fileURL.stopAccessingSecurityScopedResource() }

        let dbType = detectDatabaseType(at: fileURL)
        print("Detected database type: \(dbType) for file: \(fileURL.lastPathComponent)")

        switch dbType {
        case .notes:
            return try await importNotesDatabase(from: fileURL)
        case .reminders:
            return try await importRemindersDatabase(from: fileURL)
        case .calendar:
            return try await importCalendarDatabase(from: fileURL)
        case .contacts:
            return try await importContactsDatabase(from: fileURL)
        case .safari:
            return try await importSafariDatabase(from: fileURL)
        case .generic:
            return try await importGenericDatabase(from: fileURL)
        }
    }

    // MARK: - Database Type Detection

    private func detectDatabaseType(at fileURL: URL) -> DatabaseType {
        do {
            let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())

            return try sourceDB.read { db in
                let tables = try String.fetchAll(db, sql: "SELECT name FROM sqlite_master WHERE type='table'")
                let tableNames = tables.map { $0.lowercased() }

                // Notes database detection
                if tableNames.contains("ziccloudsyncingobject") || tableNames.contains("zicnotedata") {
                    return .notes
                }

                // Reminders database detection
                if tableNames.contains("zreminder") || tableNames.contains("zlist") {
                    return .reminders
                }

                // Calendar database detection
                if tableNames.contains("event") || tableNames.contains("calendar") {
                    return .calendar
                }

                // Contacts database detection
                if tableNames.contains("abperson") || tableNames.contains("abmultivalue") {
                    return .contacts
                }

                // Safari database detection
                if tableNames.contains("bookmarks") || tableNames.contains("reading_list_item") {
                    return .safari
                }

                return .generic
            }
        } catch {
            print("Failed to detect database type: \(error)")
            return .generic
        }
    }

    // MARK: - Specific App Importers

    private func importNotesDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        // First read all data synchronously
        let noteRowsData: [Row] = try await sourceDB.read { sourceConn in
            // Try modern Notes schema first
            let modernSQL = """
                SELECT
                    z_pk as id,
                    ztitle1 as title,
                    zsnippet as snippet,
                    zcreationdate1 as created_date,
                    zmodificationdate1 as modified_date,
                    zfolder as folder_id
                FROM ziccloudsyncingobject
                WHERE ztypeuti LIKE '%note%'
                AND zmarkedfordeletion = 0
                ORDER BY zmodificationdate1 DESC
                LIMIT 1000
            """

            do {
                return try Row.fetchAll(sourceConn, sql: modernSQL)
            } catch {
                // Try legacy schema
                let legacySQL = """
                    SELECT
                        Z_PK as id,
                        ZTITLE as title,
                        ZSUMMARY as snippet,
                        ZCREATIONDATE as created_date,
                        ZMODIFICATIONDATE as modified_date,
                        NULL as folder_id
                    FROM ZNOTE
                    WHERE ZMARKEDFORDELETION = 0
                    ORDER BY ZMODIFICATIONDATE DESC
                    LIMIT 1000
                """

                return try Row.fetchAll(sourceConn, sql: legacySQL)
            }
        }

        // Then process the data asynchronously
        for noteRow in noteRowsData {
            do {
                let node = try await createNoteNode(from: noteRow, sourceConnection: nil)
                try await database.createNode(node)
                result.imported += 1
            } catch {
                result.failed += 1
                result.errors.append(ImportError.fileFailed("node creation", error))
            }
        }

        return result
    }

    private func importRemindersDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        // First read all data synchronously
        let reminderRowsData: [Row] = try sourceDB.read { sourceConn in
            let sql = """
                SELECT
                    Z_PK as id,
                    ZTITLE as title,
                    ZNOTES as notes,
                    ZCREATIONDATE as created_date,
                    ZLASTMODIFIEDDATE as modified_date,
                    ZCOMPLETED as completed,
                    ZDUEDATE as due_date,
                    ZLIST as list_id
                FROM ZREMINDER
                WHERE ZMARKEDFORDELETION = 0
                ORDER BY ZLASTMODIFIEDDATE DESC
                LIMIT 1000
            """

            return try Row.fetchAll(sourceConn, sql: sql)
        }

        // Then process the data asynchronously
        for reminderRow in reminderRowsData {
            do {
                let node = try await sourceDB.read { sourceConn in
                    try await self.createReminderNode(from: reminderRow, sourceConnection: sourceConn)
                }
                try await database.createNode(node)
                result.imported += 1
            } catch {
                result.failed += 1
                result.errors.append(ImportError.fileFailed("node creation", error))
            }
        }

        return result
    }

    private func importCalendarDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        try sourceDB.read { sourceConn in
            let sql = """
                SELECT
                    e.ROWID as id,
                    e.summary as title,
                    e.description as description,
                    e.start_date,
                    e.end_date,
                    e.last_modified,
                    c.title as calendar_title
                FROM Event e
                LEFT JOIN Calendar c ON e.calendar_id = c.ROWID
                WHERE e.start_date > datetime('now', '-2 years')
                ORDER BY e.start_date DESC
                LIMIT 1000
            """

            let eventRows = try Row.fetchAll(sourceConn, sql: sql)
            for eventRow in eventRows {
                do {
                    let node = try createEventNode(from: eventRow)
                    try await database.insert(node: node)
                    result.imported += 1
                } catch {
                    result.failed += 1
                    result.errors.append(ImportError.fileFailed("node creation", error))
                }
            }
        }

        return result
    }

    private func importContactsDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        try sourceDB.read { sourceConn in
            let sql = """
                SELECT
                    ROWID as id,
                    First as first_name,
                    Last as last_name,
                    Organization as organization,
                    Note as notes,
                    CreationDate as created_date,
                    ModificationDate as modified_date
                FROM ABPerson
                ORDER BY ModificationDate DESC
                LIMIT 1000
            """

            let contactRows = try Row.fetchAll(sourceConn, sql: sql)
            for contactRow in contactRows {
                do {
                    let node = try createContactNode(from: contactRow)
                    try await database.insert(node: node)
                    result.imported += 1
                } catch {
                    result.failed += 1
                    result.errors.append(ImportError.fileFailed("node creation", error))
                }
            }
        }

        return result
    }

    private func importSafariDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        try sourceDB.read { sourceConn in
            // Import bookmarks
            do {
                let bookmarkSQL = """
                    SELECT
                        id,
                        title,
                        url,
                        date_added,
                        date_modified
                    FROM bookmarks
                    WHERE type = 0  -- leaf bookmarks only
                    ORDER BY date_modified DESC
                    LIMIT 500
                """

                let bookmarkRows = try Row.fetchAll(sourceConn, sql: bookmarkSQL)
                for bookmarkRow in bookmarkRows {
                    do {
                        let node = try createBookmarkNode(from: bookmarkRow)
                        try await database.createNode(node)
                        result.imported += 1
                    } catch {
                        result.failed += 1
                        result.errors.append(ImportError.fileFailed("node creation", error))
                    }
                }
            } catch {
                // Bookmarks table might not exist
                print("Bookmarks table not found or inaccessible: \(error)")
            }

            // Import reading list
            do {
                let readingListSQL = """
                    SELECT
                        id,
                        title,
                        url,
                        date_added,
                        preview_text
                    FROM reading_list_item
                    ORDER BY date_added DESC
                    LIMIT 200
                """

                let readingListRows = try Row.fetchAll(sourceConn, sql: readingListSQL)
                for readingListRow in readingListRows {
                    do {
                        let node = try createReadingListNode(from: readingListRow)
                        try await database.createNode(node)
                        result.imported += 1
                    } catch {
                        result.failed += 1
                        result.errors.append(ImportError.fileFailed("node creation", error))
                    }
                }
            } catch {
                // Reading list table might not exist
                print("Reading list table not found or inaccessible: \(error)")
            }
        }

        return result
    }

    private func importGenericDatabase(from fileURL: URL) async throws -> ImportResult {
        let sourceDB = try DatabaseQueue(path: fileURL.path, configuration: readOnlyConfiguration())
        var result = ImportResult()

        try sourceDB.read { sourceConn in
            // Get all tables
            let tableNames = try String.fetchAll(sourceConn, sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")

            for tableName in tableNames {
                do {
                    // Get table schema
                    let schemaRows = try Row.fetchAll(sourceConn, sql: "PRAGMA table_info(\(tableName))")
                    let columnNames = schemaRows.map { $0["name"] as? String ?? "unknown" }

                    // Get sample data
                    let dataRows = try Row.fetchAll(sourceConn, sql: "SELECT * FROM \(tableName) LIMIT 10")

                    let node = try createGenericTableNode(
                        tableName: tableName,
                        columns: columnNames,
                        sampleData: dataRows,
                        sourceFile: fileURL.lastPathComponent
                    )

                    try await database.insert(node: node)
                    result.imported += 1
                } catch {
                    result.failed += 1
                    result.errors.append(ImportError.fileFailed("node creation", error))
                    print("Failed to process table \(tableName): \(error)")
                }
            }
        }

        return result
    }

    // MARK: - Node Creation

    private func createNoteNode(from row: Row, sourceConnection: Database) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let title = row["title"] as? String ?? "Untitled Note"
        let snippet = row["snippet"] as? String ?? ""
        let createdTimestamp = row["created_date"] as? TimeInterval ?? 0
        let modifiedTimestamp = row["modified_date"] as? TimeInterval ?? 0

        // Convert Core Data timestamps (seconds since 2001) to ISO dates
        let createdDate = Date(timeIntervalSinceReferenceDate: createdTimestamp)
        let modifiedDate = Date(timeIntervalSinceReferenceDate: modifiedTimestamp)

        return Node(
            id: UUID().uuidString,
            nodeType: "note",
            name: title,
            content: snippet,
            summary: snippet.isEmpty ? "No content" : String(snippet.prefix(100)),
            createdAt: createdDate,
            modifiedAt: modifiedDate,
            folder: "notes-import",
            tags: ["apple-notes", "sqlite-file-import"],
            source: "apple-notes-file",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createReminderNode(from row: Row, sourceConnection: Database) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let title = row["title"] as? String ?? "Untitled Reminder"
        let notes = row["notes"] as? String ?? ""
        let completed = (row["completed"] as? Int64 ?? 0) > 0
        let createdTimestamp = row["created_date"] as? TimeInterval ?? 0
        let modifiedTimestamp = row["modified_date"] as? TimeInterval ?? 0

        let createdDate = Date(timeIntervalSinceReferenceDate: createdTimestamp)
        let modifiedDate = Date(timeIntervalSinceReferenceDate: modifiedTimestamp)

        var content = "# \(title)\n\n"
        if !notes.isEmpty {
            content += "\(notes)\n\n"
        }
        content += "Status: \(completed ? "✅ Completed" : "⏳ Pending")"

        var tags = ["apple-reminders", "sqlite-file-import"]
        if completed {
            tags.append("completed")
        } else {
            tags.append("pending")
        }

        return Node(
            id: UUID().uuidString,
            nodeType: "task",
            name: title,
            content: content,
            summary: notes.isEmpty ? "No description" : String(notes.prefix(100)),
            createdAt: createdDate,
            modifiedAt: modifiedDate,
            folder: "reminders-import",
            tags: tags,
            source: "apple-reminders-file",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createEventNode(from row: Row) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let title = row["title"] as? String ?? "Untitled Event"
        let description = row["description"] as? String ?? ""
        let calendarTitle = row["calendar_title"] as? String ?? "Calendar"

        var content = "# \(title)\n\n"
        if !description.isEmpty {
            content += "\(description)\n\n"
        }
        content += "📅 Calendar: \(calendarTitle)"

        return Node(
            id: UUID().uuidString,
            nodeType: "event",
            name: title,
            content: content,
            summary: description.isEmpty ? "No description" : String(description.prefix(100)),
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "calendar-import",
            tags: ["apple-calendar", "sqlite-file-import"],
            source: "apple-calendar-file",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createContactNode(from row: Row) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let firstName = row["first_name"] as? String ?? ""
        let lastName = row["last_name"] as? String ?? ""
        let organization = row["organization"] as? String ?? ""
        let notes = row["notes"] as? String ?? ""

        let fullName = [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
        let displayName = fullName.isEmpty ? (organization.isEmpty ? "Unknown Contact" : organization) : fullName

        var content = "# \(displayName)\n\n"
        if !organization.isEmpty && !fullName.isEmpty {
            content += "🏢 Organization: \(organization)\n\n"
        }
        if !notes.isEmpty {
            content += "📝 Notes: \(notes)"
        }

        return Node(
            id: UUID().uuidString,
            nodeType: "person",
            name: displayName,
            content: content,
            summary: organization.isEmpty ? "Contact" : organization,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "contacts-import",
            tags: ["apple-contacts", "sqlite-file-import"],
            source: "apple-contacts-file",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createBookmarkNode(from row: Row) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let title = row["title"] as? String ?? "Untitled Bookmark"
        let url = row["url"] as? String ?? ""

        let content = "# \(title)\n\n🔗 [Visit Link](\(url))"

        return Node(
            id: UUID().uuidString,
            nodeType: "bookmark",
            name: title,
            content: content,
            summary: url.isEmpty ? "No URL" : url,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "safari-import",
            tags: ["apple-safari", "bookmark", "sqlite-file-import"],
            source: "apple-safari-file",
            sourceId: String(id),
            sourceUrl: url.isEmpty ? nil : url
        )
    }

    private func createReadingListNode(from row: Row) throws -> Node {
        let id = row["id"] as? Int64 ?? 0
        let title = row["title"] as? String ?? "Untitled Article"
        let url = row["url"] as? String ?? ""
        let previewText = row["preview_text"] as? String ?? ""

        var content = "# \(title)\n\n"
        if !previewText.isEmpty {
            content += "\(previewText)\n\n"
        }
        content += "📖 [Read Article](\(url))"

        return Node(
            id: UUID().uuidString,
            nodeType: "article",
            name: title,
            content: content,
            summary: previewText.isEmpty ? "Reading list item" : String(previewText.prefix(100)),
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "reading-list-import",
            tags: ["apple-safari", "reading-list", "sqlite-file-import"],
            source: "apple-safari-file",
            sourceId: String(id),
            sourceUrl: url.isEmpty ? nil : url
        )
    }

    private func createGenericTableNode(tableName: String, columns: [String], sampleData: [Row], sourceFile: String) throws -> Node {
        var content = "# \(tableName) (from \(sourceFile))\n\n"
        content += "**Columns:** \(columns.joined(separator: ", "))\n\n"
        content += "**Sample Data** (\(sampleData.count) rows shown):\n\n"

        // Create markdown table
        if !sampleData.isEmpty {
            content += "| \(columns.joined(separator: " | ")) |\n"
            content += "| \(columns.map { _ in "---" }.joined(separator: " | ")) |\n"

            for row in sampleData.prefix(5) {
                let values = columns.map { column in
                    if let value = row[column] {
                        return String(describing: value).replacingOccurrences(of: "|", with: "\\|")
                    } else {
                        return ""
                    }
                }
                content += "| \(values.joined(separator: " | ")) |\n"
            }

            if sampleData.count > 5 {
                content += "\n... and \(sampleData.count - 5) more rows"
            }
        }

        return Node(
            id: UUID().uuidString,
            nodeType: "database-table",
            name: "\(tableName) (\(sourceFile))",
            content: content,
            summary: "Table with \(columns.count) columns and sample data",
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "sqlite-import",
            tags: ["sqlite-file-import", "generic-data"],
            source: "generic-sqlite-file",
            sourceId: tableName,
            sourceUrl: nil
        )
    }

    // MARK: - Helper Methods

    private func readOnlyConfiguration() -> Configuration {
        var config = Configuration()
        config.readonly = true
        config.allowsUnsafeTransactions = true
        return config
    }
}

// MARK: - Supporting Types

public enum DatabaseType {
    case notes
    case reminders
    case calendar
    case contacts
    case safari
    case generic
}

public enum SQLiteImportError: Error {
    case fileAccessDenied
    case nodeCreationFailed(Error)
}

extension SQLiteImportError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .fileAccessDenied:
            return "Access to the file was denied. Please check permissions."
        case .nodeCreationFailed(let error):
            return "Failed to create node: \(error.localizedDescription)"
        }
    }
}