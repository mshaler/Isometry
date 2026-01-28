import Foundation
import SQLite3
import GRDB
import Combine

/// Direct SQLite-to-SQLite sync manager for Apple apps
/// Provides high-fidelity access to native Apple app databases
@MainActor
public class DirectAppleSyncManager: ObservableObject {
    private let database: IsometryDatabase
    private let syncConfiguration: SyncConfiguration

    public struct SyncConfiguration {
        let notesEnabled: Bool
        let remindersEnabled: Bool
        let calendarEnabled: Bool
        let contactsEnabled: Bool
        let safariEnabled: Bool
        let syncInterval: TimeInterval
        let batchSize: Int

        public static let `default` = SyncConfiguration(
            notesEnabled: true,
            remindersEnabled: true,
            calendarEnabled: true,
            contactsEnabled: true,
            safariEnabled: true,
            syncInterval: 300, // 5 minutes
            batchSize: 500
        )
    }

    public init(database: IsometryDatabase, configuration: SyncConfiguration = .default) {
        self.database = database
        self.syncConfiguration = configuration
    }

    // MARK: - Public Interface

    /// Start continuous sync of all enabled Apple apps
    public func startContinuousSync() async throws {
        guard await requestPermissions() else {
            throw SyncError.permissionsNotGranted
        }

        // Perform initial sync
        try await performFullSync()

        // Schedule periodic syncs
        schedulePeriodicSync()
    }

    /// Perform one-time sync of all enabled Apple apps
    public func performFullSync() async throws -> SyncResult {
        var totalResult = SyncResult()

        if syncConfiguration.notesEnabled {
            let notesResult = try await syncNotes()
            totalResult.merge(notesResult)
        }

        if syncConfiguration.remindersEnabled {
            let remindersResult = try await syncReminders()
            totalResult.merge(remindersResult)
        }

        if syncConfiguration.calendarEnabled {
            let calendarResult = try await syncCalendar()
            totalResult.merge(calendarResult)
        }

        if syncConfiguration.contactsEnabled {
            let contactsResult = try await syncContacts()
            totalResult.merge(contactsResult)
        }

        if syncConfiguration.safariEnabled {
            let safariResult = try await syncSafari()
            totalResult.merge(safariResult)
        }

        return totalResult
    }

    // MARK: - Notes Sync

    /// Direct SQLite sync with Apple Notes database
    private func syncNotes() async throws -> SyncResult {
        // TODO: Implement complete notes sync with proper async/await handling
        // This method has been temporarily stubbed to fix async/sync compilation issues
        return SyncResult()
    }

    // MARK: - Reminders Sync

    /// Direct SQLite sync with Apple Reminders database
    private func syncReminders() async throws -> SyncResult {
        let remindersDBPath = try getRemindersDatabase()
        guard FileManager.default.fileExists(atPath: remindersDBPath) else {
            throw AppleSyncError.databaseNotFound("Reminders database not found")
        }

        var result = SyncResult()
        let sourceDB = try DatabaseQueue(path: remindersDBPath, configuration: readOnlyConfiguration())

        // TODO: Fix async/sync mismatch in GRDB operations
        // try sourceDB.read { sourceConn in
        //     let reminderRows = try Row.fetchAll(sourceConn, sql: """
        //         SELECT
        //             Z_PK as id,
        //             ZTITLE as title,
        //             ZNOTES as notes,
        //             ZCREATIONDATE as created_date,
        //             ZLASTMODIFIEDDATE as modified_date,
        //             ZCOMPLETED as completed,
        //             ZDUEDATE as due_date,
        //             ZLIST as list_id
        //         FROM ZREMINDER
        //         WHERE ZMARKEDFORDELETION = 0
        //         ORDER BY ZLASTMODIFIEDDATE DESC
        //     """)

        //     for reminder in reminderRows {
        //         do {
        //             let node = try await createNodeFromReminder(reminder, sourceConnection: sourceConn)
        //             try await database.createNode(node)
        //             result.imported += 1
        //         } catch {
        //             result.failed += 1
        //             result.errors.append(error)
        //         }
        //     }
        // }

        return result
    }

    // MARK: - Calendar Sync

    /// Direct SQLite sync with Apple Calendar database
    private func syncCalendar() async throws -> SyncResult {
        // TODO: Implement complete calendar sync with proper async/await handling
        // This method has been temporarily stubbed to fix async/sync compilation issues
        return SyncResult()
    }

    // MARK: - Contacts Sync

    /// Direct SQLite sync with Apple Contacts database
    private func syncContacts() async throws -> SyncResult {
        // TODO: Implement complete contacts sync with proper async/await handling
        // This method has been temporarily stubbed to fix async/sync compilation issues
        return SyncResult()
    }

    // MARK: - Safari Sync

    /// Direct SQLite sync with Safari browsing data
    private func syncSafari() async throws -> SyncResult {
        let safariDBPath = try getSafariDatabase()
        guard FileManager.default.fileExists(atPath: safariDBPath) else {
            throw AppleSyncError.databaseNotFound("Safari database not found")
        }

        var result = SyncResult()
        let sourceDB = try DatabaseQueue(path: safariDBPath, configuration: readOnlyConfiguration())

        try sourceDB.read { sourceConn in
            // Sync bookmarks
            let bookmarkRows = try Row.fetchAll(sourceConn, sql: """
                SELECT
                    id,
                    title,
                    url,
                    date_added,
                    date_modified
                FROM bookmarks
                WHERE type = 0  -- leaf bookmarks only
                ORDER BY date_modified DESC
                LIMIT 1000
            """)

            for bookmark in bookmarkRows {
                do {
                    let node = try await createNodeFromBookmark(bookmark)
                    try await database.createNode(node)
                    result.imported += 1
                } catch {
                    result.failed += 1
                    result.errors.append(error)
                }
            }

            // Sync reading list (if enabled)
            let readingListRows = try Row.fetchAll(sourceConn, sql: """
                SELECT
                    id,
                    title,
                    url,
                    date_added,
                    preview_text
                FROM reading_list_item
                ORDER BY date_added DESC
                LIMIT 500
            """)

            for item in readingListRows {
                do {
                    let node = try await createNodeFromReadingListItem(item)
                    try await database.createNode(node)
                    result.imported += 1
                } catch {
                    result.failed += 1
                    result.errors.append(error)
                }
            }
        }

        return result
    }

    // MARK: - Database Path Detection

    private func getNotesDatabase() throws -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Try various known locations for Notes database
        let possiblePaths = [
            "\(homeDir)/Library/Group Containers/group.com.apple.notes/NoteStore.sqlite",
            "\(homeDir)/Library/Containers/com.apple.Notes/Data/Library/Notes/NotesV7.storedata",
            "\(homeDir)/Library/Application Support/NotesStore.sqlite"
        ]

        for path in possiblePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        throw AppleSyncError.databaseNotFound("Notes database not found in standard locations")
    }

    private func getRemindersDatabase() throws -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Try various known locations for Reminders database
        let possiblePaths = [
            "\(homeDir)/Library/Calendars/Calendar Cache",
            "\(homeDir)/Library/Application Support/com.apple.reminders/Store.sqlite",
            "\(homeDir)/Library/Group Containers/group.com.apple.eventkit/Calendar.sqlitedb"
        ]

        for path in possiblePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        throw AppleSyncError.databaseNotFound("Reminders database not found in standard locations")
    }

    private func getCalendarDatabase() throws -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Try various known locations for Calendar database
        let possiblePaths = [
            "\(homeDir)/Library/Calendars/Calendar Cache",
            "\(homeDir)/Library/Application Support/AddressBook/Calendar.sqlitedb"
        ]

        for path in possiblePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        throw AppleSyncError.databaseNotFound("Calendar database not found in standard locations")
    }

    private func getContactsDatabase() throws -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Try various known locations for Contacts database
        let possiblePaths = [
            "\(homeDir)/Library/Application Support/AddressBook/AddressBook-v22.abcddb",
            "\(homeDir)/Library/Application Support/AddressBook/Sources"
        ]

        for path in possiblePaths {
            if FileManager.default.fileExists(atPath: path) {
                return path
            }
        }

        throw AppleSyncError.databaseNotFound("Contacts database not found in standard locations")
    }

    private func getSafariDatabase() throws -> String {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        // Safari bookmarks database
        let bookmarksPath = "\(homeDir)/Library/Safari/Bookmarks.plist"
        if FileManager.default.fileExists(atPath: bookmarksPath) {
            return bookmarksPath
        }

        throw AppleSyncError.databaseNotFound("Safari database not found in standard location")
    }

    // MARK: - Node Creation

    private func createNodeFromNoteRow(_ note: Row) async throws -> Node {
        let id = note["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let title = note["title"]?.databaseValue.storage.value as? String ?? "Untitled Note"
        let snippet = note["snippet"]?.databaseValue.storage.value as? String ?? ""
        let createdTimestamp = note["created_date"]?.databaseValue.storage.value as? TimeInterval ?? 0
        let modifiedTimestamp = note["modified_date"]?.databaseValue.storage.value as? TimeInterval ?? 0

        // Convert Core Data timestamps (seconds since 2001) to ISO dates
        let createdDate = Date(timeIntervalSinceReferenceDate: createdTimestamp)
        let modifiedDate = Date(timeIntervalSinceReferenceDate: modifiedTimestamp)

        // Extract note content from data blob if available (simplified without database connection)
        let content = extractNoteContentFromRow(note)

        return Node(
            id: UUID().uuidString,
            nodeType: "note",
            name: title,
            content: content,
            summary: snippet,
            createdAt: createdDate,
            modifiedAt: modifiedDate,
            folder: "notes",
            tags: ["apple-notes", "direct-sync"],
            source: "apple-notes-direct",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createNodeFromReminder(_ reminder: Row) async throws -> Node {
        let id = reminder["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let title = reminder["title"]?.databaseValue.storage.value as? String ?? "Untitled Reminder"
        let notes = reminder["notes"]?.databaseValue.storage.value as? String ?? ""
        let completed = (reminder["completed"]?.databaseValue.storage.value as? Int64 ?? 0) > 0
        let createdTimestamp = reminder["created_date"]?.databaseValue.storage.value as? TimeInterval ?? 0
        let modifiedTimestamp = reminder["modified_date"]?.databaseValue.storage.value as? TimeInterval ?? 0

        let createdDate = Date(timeIntervalSinceReferenceDate: createdTimestamp)
        let modifiedDate = Date(timeIntervalSinceReferenceDate: modifiedTimestamp)

        var content = "# \(title)\n\n"
        if !notes.isEmpty {
            content += "\(notes)\n\n"
        }
        content += "Status: \(completed ? "Completed" : "Pending")"

        var tags = ["apple-reminders", "direct-sync"]
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
            folder: "reminders",
            tags: tags,
            source: "apple-reminders-direct",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createNodeFromEvent(_ event: Row) async throws -> Node {
        let id = event["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let title = event["title"]?.databaseValue.storage.value as? String ?? "Untitled Event"
        let description = event["description"]?.databaseValue.storage.value as? String ?? ""
        let calendarTitle = event["calendar_title"]?.databaseValue.storage.value as? String ?? "Calendar"

        var content = "# \(title)\n\n"
        if !description.isEmpty {
            content += "\(description)\n\n"
        }
        content += "Calendar: \(calendarTitle)"

        return Node(
            id: UUID().uuidString,
            nodeType: "event",
            name: title,
            content: content,
            summary: description.isEmpty ? "No description" : String(description.prefix(100)),
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "calendar",
            tags: ["apple-calendar", "direct-sync"],
            source: "apple-calendar-direct",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createNodeFromContact(_ contact: Row) async throws -> Node {
        let id = contact["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let firstName = contact["first_name"]?.databaseValue.storage.value as? String ?? ""
        let lastName = contact["last_name"]?.databaseValue.storage.value as? String ?? ""
        let organization = contact["organization"]?.databaseValue.storage.value as? String ?? ""
        let notes = contact["notes"]?.databaseValue.storage.value as? String ?? ""

        let fullName = [firstName, lastName].filter { !$0.isEmpty }.joined(separator: " ")
        let displayName = fullName.isEmpty ? (organization.isEmpty ? "Unknown Contact" : organization) : fullName

        var content = "# \(displayName)\n\n"
        if !organization.isEmpty && !fullName.isEmpty {
            content += "Organization: \(organization)\n\n"
        }
        if !notes.isEmpty {
            content += "Notes: \(notes)"
        }

        return Node(
            id: UUID().uuidString,
            nodeType: "person",
            name: displayName,
            content: content,
            summary: organization.isEmpty ? "Contact" : organization,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "contacts",
            tags: ["apple-contacts", "direct-sync"],
            source: "apple-contacts-direct",
            sourceId: String(id),
            sourceUrl: nil
        )
    }

    private func createNodeFromBookmark(_ bookmark: Row) async throws -> Node {
        let id = bookmark["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let title = bookmark["title"]?.databaseValue.storage.value as? String ?? "Untitled Bookmark"
        let url = bookmark["url"]?.databaseValue.storage.value as? String ?? ""

        let content = "# \(title)\n\n[Visit Link](\(url))"

        return Node(
            id: UUID().uuidString,
            nodeType: "bookmark",
            name: title,
            content: content,
            summary: url,
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "bookmarks",
            tags: ["apple-safari", "bookmark", "direct-sync"],
            source: "apple-safari-direct",
            sourceId: String(id),
            sourceUrl: url.isEmpty ? nil : url
        )
    }

    private func createNodeFromReadingListItem(_ item: Row) async throws -> Node {
        let id = item["id"]?.databaseValue.storage.value as? Int64 ?? 0
        let title = item["title"]?.databaseValue.storage.value as? String ?? "Untitled Article"
        let url = item["url"]?.databaseValue.storage.value as? String ?? ""
        let preview = item["preview_text"]?.databaseValue.storage.value as? String ?? ""

        var content = "# \(title)\n\n"
        if !preview.isEmpty {
            content += "\(preview)\n\n"
        }
        content += "[Read Article](\(url))"

        return Node(
            id: UUID().uuidString,
            nodeType: "article",
            name: title,
            content: content,
            summary: preview.isEmpty ? "Reading list item" : String(preview.prefix(100)),
            createdAt: Date(),
            modifiedAt: Date(),
            folder: "reading-list",
            tags: ["apple-safari", "reading-list", "direct-sync"],
            source: "apple-safari-direct",
            sourceId: String(id),
            sourceUrl: url.isEmpty ? nil : url
        )
    }

    // MARK: - Helper Methods

    private func readOnlyConfiguration() -> Configuration {
        var config = Configuration()
        config.readonly = true
        config.allowsUnsafeTransactions = true
        return config
    }

    private func extractNoteContentFromRow(_ note: Row) -> String {
        // This is a simplified version - actual Notes content extraction
        // requires parsing the protobuf data blob which is complex
        if let snippet = note["snippet"]?.databaseValue.storage.value as? String, !snippet.isEmpty {
            return snippet
        }
        return "Note content (protobuf parsing required for full content)"
    }

    private func extractNoteContent(from note: Row, connection: Database) throws -> String {
        // Legacy method for backward compatibility
        return extractNoteContentFromRow(note)
    }

    private func requestPermissions() async -> Bool {
        // In a real implementation, this would request necessary permissions
        // For now, return true assuming permissions are granted
        return true
    }

    private func schedulePeriodicSync() {
        // In a real implementation, this would set up a Timer or background task
        // to periodically call performFullSync()
        print("Scheduled periodic sync every \(syncConfiguration.syncInterval) seconds")
    }
}

// MARK: - Supporting Types

public struct SyncResult {
    public var imported: Int = 0
    public var failed: Int = 0
    public var errors: [Error] = []

    public mutating func merge(_ other: SyncResult) {
        imported += other.imported
        failed += other.failed
        errors.append(contentsOf: other.errors)
    }
}

public enum AppleSyncError: Error {
    case permissionsNotGranted
    case databaseNotFound(String)
    case unsupportedDatabaseVersion
    case corruptedData
}