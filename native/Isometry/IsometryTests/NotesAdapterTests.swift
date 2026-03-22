import Testing
import Foundation
import SQLite3
import SwiftProtobuf
import zlib
@testable import Isometry

// ---------------------------------------------------------------------------
// NotesAdapter Tests
// ---------------------------------------------------------------------------
// Tests for the core SQL query logic and schema detection that NotesAdapter
// uses when reading NoteStore.sqlite.
//
// Strategy: NotesAdapter.fetchCards() reads from a hardcoded path
// (Self.noteStorePath). Rather than calling it directly, we test the
// critical path by:
//
//   1. Creating a fixture SQLite database in a temp dir with Apple's
//      NoteStore schema (ZICCLOUDSYNCINGOBJECT + ZICNOTEDATA tables)
//   2. Running the same SQL queries that NotesAdapter uses internally
//   3. Testing ProtobufToMarkdown.extract() with a valid gzip+protobuf ZDATA blob
//
// This tests the critical paths:
//   - Schema detection via PRAGMA table_info (NOTE-06)
//   - Folder hierarchy resolution (NOTE-02)
//   - Note query filtering: excludes encrypted (NOTE-04) and deleted notes
//   - ZDATA blob extraction through ProtobufToMarkdown (BODY-01)
//   - Attachment lookup query (BODY-03)
//   - checkPermission() behavior in test environment

struct NotesAdapterTests {

    // MARK: - Fixture helpers

    /// Create a temporary directory with a fixture NoteStore SQLite database.
    /// Returns the temp dir URL and an open OpaquePointer to the database.
    /// Caller MUST call sqlite3_close(db) and remove the temp dir.
    private func makeFixtureDB() -> (tempDir: URL, db: OpaquePointer) {
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? fm.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let dbPath = tempDir.appendingPathComponent("NoteStore.sqlite").path

        var db: OpaquePointer?
        let result = sqlite3_open(dbPath, &db)
        precondition(result == SQLITE_OK, "Failed to open fixture database")
        precondition(db != nil, "Fixture database pointer is nil")

        // Create ZICCLOUDSYNCINGOBJECT table with Apple NoteStore schema
        let createTable = """
            CREATE TABLE ZICCLOUDSYNCINGOBJECT (
                Z_PK INTEGER PRIMARY KEY,
                ZIDENTIFIER TEXT,
                ZTITLE1 TEXT,
                ZSNIPPET TEXT,
                ZCREATIONDATE3 REAL,
                ZMODIFICATIONDATE1 REAL,
                ZFOLDER INTEGER DEFAULT 0,
                ZISPASSWORDPROTECTED INTEGER DEFAULT 0,
                ZMARKEDFORDELETION INTEGER DEFAULT 0,
                ZPARENT INTEGER DEFAULT 0,
                ZTYPEUTI TEXT,
                ZMEDIA INTEGER,
                ZFILENAME TEXT,
                ZNOTEDATA INTEGER,
                ZACCOUNT4 INTEGER,
                ZCRYPTOINITIALIZATIONVECTOR BLOB
            )
            """

        let createNoteData = """
            CREATE TABLE ZICNOTEDATA (
                Z_PK INTEGER PRIMARY KEY,
                ZDATA BLOB,
                ZSNIPPET TEXT
            )
            """

        sqlite3_exec(db, createTable, nil, nil, nil)
        sqlite3_exec(db, createNoteData, nil, nil, nil)

        return (tempDir, db!)
    }

    // SQLITE_TRANSIENT tells SQLite to copy the string immediately.
    // Using nil (SQLITE_STATIC) would require the Swift string to stay alive
    // until the statement is finalized -- not safe with value types.
    private let TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

    /// Insert a folder row. ZPARENT=0 means root folder.
    private func insertFolder(
        db: OpaquePointer,
        pk: Int, identifier: String, title: String, parent: Int = 0
    ) {
        let sql = """
            INSERT INTO ZICCLOUDSYNCINGOBJECT
                (Z_PK, ZIDENTIFIER, ZTITLE1, ZPARENT, ZMARKEDFORDELETION)
            VALUES (?, ?, ?, ?, 0)
            """
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        sqlite3_bind_int(stmt, 1, Int32(pk))
        sqlite3_bind_text(stmt, 2, identifier, -1, TRANSIENT)
        sqlite3_bind_text(stmt, 3, title, -1, TRANSIENT)
        sqlite3_bind_int(stmt, 4, Int32(parent))
        sqlite3_step(stmt)
        sqlite3_finalize(stmt)
    }

    /// Insert a ZICNOTEDATA row and return its Z_PK.
    private func insertNoteData(db: OpaquePointer, pk: Int, data: Data?) {
        let sql = "INSERT INTO ZICNOTEDATA (Z_PK, ZDATA) VALUES (?, ?)"
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        sqlite3_bind_int(stmt, 1, Int32(pk))
        if let data = data {
            _ = data.withUnsafeBytes { ptr in
                sqlite3_bind_blob(stmt, 2, ptr.baseAddress, Int32(data.count), nil)
            }
        } else {
            sqlite3_bind_null(stmt, 2)
        }
        sqlite3_step(stmt)
        sqlite3_finalize(stmt)
    }

    /// Insert a note row.
    private func insertNote(
        db: OpaquePointer,
        pk: Int, identifier: String, title: String,
        folder: Int = 0, noteDataPK: Int? = nil,
        isPasswordProtected: Int = 0, isDeleted: Int = 0,
        snippet: String? = nil
    ) {
        let sql = """
            INSERT INTO ZICCLOUDSYNCINGOBJECT
                (Z_PK, ZIDENTIFIER, ZTITLE1, ZFOLDER, ZNOTEDATA,
                 ZISPASSWORDPROTECTED, ZMARKEDFORDELETION,
                 ZCREATIONDATE3, ZMODIFICATIONDATE1, ZSNIPPET)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, 0.0, ?)
            """
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        sqlite3_bind_int(stmt, 1, Int32(pk))
        sqlite3_bind_text(stmt, 2, identifier, -1, TRANSIENT)
        sqlite3_bind_text(stmt, 3, title, -1, TRANSIENT)
        sqlite3_bind_int(stmt, 4, Int32(folder))
        if let ndPK = noteDataPK {
            sqlite3_bind_int(stmt, 5, Int32(ndPK))
        } else {
            sqlite3_bind_null(stmt, 5)
        }
        sqlite3_bind_int(stmt, 6, Int32(isPasswordProtected))
        sqlite3_bind_int(stmt, 7, Int32(isDeleted))
        if let s = snippet {
            sqlite3_bind_text(stmt, 8, s, -1, TRANSIENT)
        } else {
            sqlite3_bind_null(stmt, 8)
        }
        sqlite3_step(stmt)
        sqlite3_finalize(stmt)
    }

    /// Build gzip-compressed protobuf ZDATA with plain text content.
    /// Includes a single attribute run covering the entire text so that
    /// ProtobufToMarkdown.convertToMarkdown() processes the text and
    /// produces a non-empty body (the function only outputs text via the
    /// attributeRun loop -- no runs = empty markdown body).
    private func makeZData(text: String) throws -> Data {
        var note = NoteContent()
        note.noteText = text

        // Add a single attribute run covering the full text length.
        // No paragraph style or formatting -- just marks the text as a single plain run.
        // Length = Unicode scalar count (same unit as attributeRun.length).
        var run = NoteAttributeRun()
        run.length = Int32(text.unicodeScalars.count)
        note.attributeRun = [run]

        var doc = NoteDocument()
        doc.note = note

        var proto = NoteStoreProto()
        proto.document = doc

        let serialized = try proto.serializedData()
        return compressGzip(serialized)
    }

    /// Compress data into gzip format using zlib C API.
    /// GzipDecompressor uses inflateInit2_ with MAX_WBITS+32 (auto-detect),
    /// so both gzip (MAX_WBITS+16) and zlib (MAX_WBITS) formats work.
    /// We use gzip format (windowBits=MAX_WBITS+16=31) to match Apple NoteStore.
    private func compressGzip(_ data: Data) -> Data {
        guard !data.isEmpty else { return Data() }
        let inputCount = data.count

        // Allocate output buffer large enough for gzip overhead + input
        var outputBuffer = [UInt8](repeating: 0, count: inputCount + 512)

        var stream = z_stream()
        let initResult = deflateInit2_(
            &stream,
            Z_DEFAULT_COMPRESSION,
            Z_DEFLATED,
            MAX_WBITS + 16,  // gzip format (windowBits = 31)
            8,
            Z_DEFAULT_STRATEGY,
            ZLIB_VERSION,
            Int32(MemoryLayout<z_stream>.size)
        )
        guard initResult == Z_OK else { return Data() }

        // Set up input from data bytes
        var copyBytes = [UInt8](data)
        stream.avail_in = uInt(inputCount)
        stream.avail_out = uInt(outputBuffer.count)

        var deflateStatus: Int32 = Z_STREAM_ERROR
        copyBytes.withUnsafeMutableBufferPointer { inBuf in
            outputBuffer.withUnsafeMutableBufferPointer { outBuf in
                stream.next_in = inBuf.baseAddress
                stream.next_out = outBuf.baseAddress
                deflateStatus = deflate(&stream, Z_FINISH)
            }
        }

        deflateEnd(&stream)

        guard deflateStatus == Z_STREAM_END else { return Data() }
        let compressedCount = outputBuffer.count - Int(stream.avail_out)
        return Data(outputBuffer.prefix(compressedCount))
    }

    // MARK: - Schema detection tests (NOTE-06)

    @Test func schemaDetectionFindsTITLE1() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        var columns = Set<String>()
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, "PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)", -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let namePtr = sqlite3_column_text(stmt, 1) {
                columns.insert(String(cString: namePtr))
            }
        }
        sqlite3_finalize(stmt)

        #expect(columns.contains("ZTITLE1"))
        // The schema detection logic: if ZTITLE1 exists, use it; else ZTITLE2
        let titleColumn = columns.contains("ZTITLE1") ? "ZTITLE1" : "ZTITLE2"
        #expect(titleColumn == "ZTITLE1")
    }

    @Test func schemaDetectionFindsCREATIONDATE3() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        var columns = Set<String>()
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, "PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)", -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let namePtr = sqlite3_column_text(stmt, 1) {
                columns.insert(String(cString: namePtr))
            }
        }
        sqlite3_finalize(stmt)

        #expect(columns.contains("ZCREATIONDATE3"))
        let creationColumn = columns.contains("ZCREATIONDATE3") ? "ZCREATIONDATE3" :
                             columns.contains("ZCREATIONDATE1") ? "ZCREATIONDATE1" : "ZCREATIONDATE"
        #expect(creationColumn == "ZCREATIONDATE3")
    }

    @Test func schemaDetectionFindsPasswordProtected() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        var columns = Set<String>()
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, "PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)", -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let namePtr = sqlite3_column_text(stmt, 1) {
                columns.insert(String(cString: namePtr))
            }
        }
        sqlite3_finalize(stmt)

        #expect(columns.contains("ZISPASSWORDPROTECTED"))
    }

    @Test func schemaDetectionFindsNOTEDATA() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        var columns = Set<String>()
        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, "PRAGMA table_info(ZICCLOUDSYNCINGOBJECT)", -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            if let namePtr = sqlite3_column_text(stmt, 1) {
                columns.insert(String(cString: namePtr))
            }
        }
        sqlite3_finalize(stmt)

        #expect(columns.contains("ZNOTEDATA"))
    }

    // MARK: - Folder hierarchy resolution (NOTE-02)

    @Test func folderHierarchyResolution() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Insert folder hierarchy: Work (pk=1) -> Projects (pk=2)
        insertFolder(db: db, pk: 1, identifier: "folder-1", title: "Work", parent: 0)
        insertFolder(db: db, pk: 2, identifier: "folder-2", title: "Projects", parent: 1)

        // Replicate buildFolderMap logic from NotesAdapter
        var folderMap: [Int64: String] = [:]
        var parentMap: [Int64: Int64] = [:]
        var nameMap: [Int64: String] = [:]

        let sql = """
            SELECT Z_PK, ZTITLE1, ZPARENT
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE ZTITLE1 IS NOT NULL
              AND ZIDENTIFIER IS NOT NULL
              AND ZMARKEDFORDELETION != 1
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            let pk = sqlite3_column_int64(stmt, 0)
            let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            let parent = sqlite3_column_int64(stmt, 2)
            nameMap[pk] = title
            if parent > 0 {
                parentMap[pk] = parent
            }
        }
        sqlite3_finalize(stmt)

        // Build full paths via parent chain walk (same algorithm as NotesAdapter)
        func buildPath(_ pk: Int64) -> String {
            if let cached = folderMap[pk] { return cached }
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
        for pk in nameMap.keys { _ = buildPath(pk) }

        // folder-2 (pk=2) should resolve to "Work/Projects"
        #expect(folderMap[2] == "Work/Projects")
        // folder-1 (pk=1) should resolve to "Work"
        #expect(folderMap[1] == "Work")
    }

    // MARK: - Note query filtering

    @Test func noteQueryReturnsNonDeletedNonEncrypted() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Insert test notes
        insertNoteData(db: db, pk: 1, data: nil)
        insertNoteData(db: db, pk: 2, data: nil)
        insertNoteData(db: db, pk: 3, data: nil)
        insertNoteData(db: db, pk: 4, data: nil)

        insertNote(db: db, pk: 10, identifier: "note-1", title: "Meeting Notes",
                   folder: 1, noteDataPK: 1)
        insertNote(db: db, pk: 11, identifier: "note-2", title: "Secret",
                   folder: 1, noteDataPK: 2, isPasswordProtected: 1)
        insertNote(db: db, pk: 12, identifier: "note-3", title: "Tagged Note",
                   folder: 1, noteDataPK: 3)
        insertNote(db: db, pk: 13, identifier: "note-4", title: "Deleted",
                   folder: 1, noteDataPK: 4, isDeleted: 1)

        // Run main notes query (same as NotesAdapter.fetchNotes SQL)
        let sql = """
            SELECT
                n.ZIDENTIFIER,
                n.ZTITLE1,
                n.ZSNIPPET,
                n.ZCREATIONDATE3,
                n.ZMODIFICATIONDATE1,
                n.ZFOLDER,
                n.ZISPASSWORDPROTECTED as IS_ENCRYPTED,
                n.Z_PK,
                nd.ZDATA
            FROM ZICCLOUDSYNCINGOBJECT n
            LEFT JOIN ZICNOTEDATA nd ON n.ZNOTEDATA = nd.Z_PK
            WHERE n.ZIDENTIFIER IS NOT NULL
              AND n.ZTITLE1 IS NOT NULL
              AND n.ZMARKEDFORDELETION != 1
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        defer { sqlite3_finalize(stmt) }

        var identifiers: [String] = []
        var encryptedCount = 0

        while sqlite3_step(stmt) == SQLITE_ROW {
            let identifier = sqlite3_column_text(stmt, 0).map { String(cString: $0) } ?? ""
            let isEncrypted = sqlite3_column_int(stmt, 6) != 0
            if isEncrypted {
                encryptedCount += 1
            } else {
                identifiers.append(identifier)
            }
        }

        // Should include note-1 and note-3, exclude encrypted note-2 and deleted note-4
        #expect(identifiers.sorted() == ["note-1", "note-3"])
        #expect(encryptedCount == 1)
        #expect(!identifiers.contains("note-2")) // encrypted
        #expect(!identifiers.contains("note-4")) // deleted
    }

    @Test func encryptedNoteDetection() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        insertNoteData(db: db, pk: 1, data: nil)
        insertNote(db: db, pk: 20, identifier: "enc-note", title: "Encrypted",
                   noteDataPK: 1, isPasswordProtected: 1)

        let sql = """
            SELECT ZIDENTIFIER, ZISPASSWORDPROTECTED as IS_ENCRYPTED
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE ZIDENTIFIER = 'enc-note'
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        defer { sqlite3_finalize(stmt) }

        var foundEncrypted = false
        while sqlite3_step(stmt) == SQLITE_ROW {
            let isEncrypted = sqlite3_column_int(stmt, 1) != 0
            if isEncrypted { foundEncrypted = true }
        }

        #expect(foundEncrypted == true)
    }

    // MARK: - ZDATA blob extraction (BODY-01)

    @Test func zdataBlobExtraction() throws {
        let zdata = try makeZData(text: "Meeting content here")

        let result = ProtobufToMarkdown.extract(zdata: zdata, snippet: "fallback text")

        #expect(result.isSnippetFallback == false)
        #expect(result.body.contains("Meeting content here"))
    }

    @Test func zdataBlobRoundTripThroughSQLite() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        let zdata = try makeZData(text: "SQLite round-trip content")
        insertNoteData(db: db, pk: 1, data: zdata)
        insertNote(db: db, pk: 30, identifier: "zdata-note", title: "ZDATA Test",
                   noteDataPK: 1)

        // Read ZDATA back from SQLite
        let sql = """
            SELECT nd.ZDATA
            FROM ZICCLOUDSYNCINGOBJECT n
            LEFT JOIN ZICNOTEDATA nd ON n.ZNOTEDATA = nd.Z_PK
            WHERE n.ZIDENTIFIER = 'zdata-note'
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        defer { sqlite3_finalize(stmt) }

        var extractedBody: String? = nil
        var snippetFallback = true

        while sqlite3_step(stmt) == SQLITE_ROW {
            let blobBytes = sqlite3_column_bytes(stmt, 0)
            var zdataBlob: Data? = nil
            if blobBytes > 0, let blobPtr = sqlite3_column_blob(stmt, 0) {
                zdataBlob = Data(bytes: blobPtr, count: Int(blobBytes))
            }

            let result = ProtobufToMarkdown.extract(zdata: zdataBlob, snippet: "fallback")
            extractedBody = result.body
            snippetFallback = result.isSnippetFallback
        }

        #expect(snippetFallback == false)
        #expect(extractedBody?.contains("SQLite round-trip content") == true)
    }

    @Test func zdataWithNoteLinkProducesNoteLinks() throws {
        // Build ZDATA with noteText "See also linked note" where the last 11 chars
        // ("linked note") carry a NoteAttributeRun.link = "applenotes:note/TARGET-NOTE-ID".
        let fullText = "See also linked note"
        // "See also " = 9 scalars, "linked note" = 11 scalars
        let prefixLength = 9
        let linkLength = 11

        var note = NoteContent()
        note.noteText = fullText

        var prefixRun = NoteAttributeRun()
        prefixRun.length = Int32(prefixLength)

        var linkRun = NoteAttributeRun()
        linkRun.length = Int32(linkLength)
        linkRun.link = "applenotes:note/TARGET-NOTE-ID"

        note.attributeRun = [prefixRun, linkRun]

        var doc = NoteDocument()
        doc.note = note

        var proto = NoteStoreProto()
        proto.document = doc

        let serialized = try proto.serializedData()
        let zdata = compressGzip(serialized)

        let result = ProtobufToMarkdown.extract(zdata: zdata, snippet: "fallback")

        #expect(result.isSnippetFallback == false)
        #expect(result.noteLinks.count == 1)
        #expect(result.noteLinks[0].targetIdentifier == "TARGET-NOTE-ID")
        #expect(result.noteLinks[0].displayName == "linked note")
    }

    // MARK: - Attachment lookup query (BODY-03)

    @Test func attachmentLookupQuery() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Insert a media row (ZFILENAME)
        let insertMedia = """
            INSERT INTO ZICCLOUDSYNCINGOBJECT
                (Z_PK, ZIDENTIFIER, ZTITLE1, ZFILENAME, ZMARKEDFORDELETION)
            VALUES (100, 'media-1', 'photo', 'photo.jpg', 0)
            """
        sqlite3_exec(db, insertMedia, nil, nil, nil)

        // Insert an attachment row pointing to the media row
        let insertAttachment = """
            INSERT INTO ZICCLOUDSYNCINGOBJECT
                (Z_PK, ZIDENTIFIER, ZTITLE1, ZTYPEUTI, ZMEDIA, ZMARKEDFORDELETION)
            VALUES (101, 'att-1', 'attachment', 'public.jpeg', 100, 0)
            """
        sqlite3_exec(db, insertAttachment, nil, nil, nil)

        // Run the attachment lookup query (same as NotesAdapter.buildAttachmentLookup)
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
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        defer { sqlite3_finalize(stmt) }

        var lookup: [String: (filename: String?, typeUti: String?)] = [:]
        while sqlite3_step(stmt) == SQLITE_ROW {
            guard let identifierPtr = sqlite3_column_text(stmt, 0) else { continue }
            let identifier = String(cString: identifierPtr)
            let typeUti = sqlite3_column_text(stmt, 1).map { String(cString: $0) }
            let filename = sqlite3_column_text(stmt, 2).map { String(cString: $0) }
            lookup[identifier] = (filename: filename, typeUti: typeUti)
        }

        #expect(lookup["att-1"] != nil)
        #expect(lookup["att-1"]?.filename == "photo.jpg")
        #expect(lookup["att-1"]?.typeUti == "public.jpeg")
    }

    // MARK: - checkPermission in test environment

    @Test func checkPermissionReturnsDeniedOrNotDetermined() {
        let adapter = NotesAdapter()
        let status = adapter.checkPermission()

        // In test environment: NoteStore.sqlite is not accessible
        // Should return .denied (group container exists but no FDA) or .notDetermined (no container)
        let isExpected = status == .denied || status == .notDetermined
        #expect(isExpected)
        // Must NOT return .granted (we don't have Full Disk Access in test env)
        #expect(status != .granted)
    }

    // MARK: - Folder query returns correctly

    @Test func folderQueryExcludesDeletedFolders() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        insertFolder(db: db, pk: 1, identifier: "folder-active", title: "Active")
        // Insert a deleted folder manually
        let insertDeleted = """
            INSERT INTO ZICCLOUDSYNCINGOBJECT
                (Z_PK, ZIDENTIFIER, ZTITLE1, ZPARENT, ZMARKEDFORDELETION)
            VALUES (2, 'folder-deleted', 'Deleted Folder', 0, 1)
            """
        sqlite3_exec(db, insertDeleted, nil, nil, nil)

        let sql = """
            SELECT Z_PK, ZTITLE1
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE ZTITLE1 IS NOT NULL
              AND ZIDENTIFIER IS NOT NULL
              AND ZMARKEDFORDELETION != 1
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        defer { sqlite3_finalize(stmt) }

        var titles: [String] = []
        while sqlite3_step(stmt) == SQLITE_ROW {
            let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            titles.append(title)
        }

        #expect(titles.contains("Active"))
        #expect(!titles.contains("Deleted Folder"))
    }

    @Test func nestedFolderHierarchyResolvesThreeLevels() throws {
        let (tempDir, db) = makeFixtureDB()
        defer {
            sqlite3_close(db)
            try? FileManager.default.removeItem(at: tempDir)
        }

        // Work (1) -> Projects (2) -> Active (3)
        insertFolder(db: db, pk: 1, identifier: "f1", title: "Work", parent: 0)
        insertFolder(db: db, pk: 2, identifier: "f2", title: "Projects", parent: 1)
        insertFolder(db: db, pk: 3, identifier: "f3", title: "Active", parent: 2)

        var folderMap: [Int64: String] = [:]
        var parentMap: [Int64: Int64] = [:]
        var nameMap: [Int64: String] = [:]

        let sql = """
            SELECT Z_PK, ZTITLE1, ZPARENT
            FROM ZICCLOUDSYNCINGOBJECT
            WHERE ZTITLE1 IS NOT NULL
              AND ZIDENTIFIER IS NOT NULL
              AND ZMARKEDFORDELETION != 1
            """

        var stmt: OpaquePointer?
        sqlite3_prepare_v2(db, sql, -1, &stmt, nil)
        while sqlite3_step(stmt) == SQLITE_ROW {
            let pk = sqlite3_column_int64(stmt, 0)
            let title = sqlite3_column_text(stmt, 1).map { String(cString: $0) } ?? ""
            let parent = sqlite3_column_int64(stmt, 2)
            nameMap[pk] = title
            if parent > 0 { parentMap[pk] = parent }
        }
        sqlite3_finalize(stmt)

        func buildPath(_ pk: Int64) -> String {
            if let cached = folderMap[pk] { return cached }
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
        for pk in nameMap.keys { _ = buildPath(pk) }

        #expect(folderMap[3] == "Work/Projects/Active")
    }
}
