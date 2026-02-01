import Foundation
import SQLite3

/// Manages image deduplication using SHA-256 hashes and URL mappings
public actor ImageDeduplication {
    private let cacheDirectory: URL
    private let dbPath: String
    private var db: OpaquePointer?

    public init(cacheDirectory: URL) {
        self.cacheDirectory = cacheDirectory
        self.dbPath = cacheDirectory.appendingPathComponent("image_cache.db").path

        Task {
            await initializeDatabase()
        }
    }

    deinit {
        sqlite3_close(db)
    }

    // MARK: - Public Interface

    /// Registers a new image with its hash and path
    public func registerImage(hash: String, path: String, originalURL: URL) async throws {
        try await ensureInitialized()

        let insertImageSQL = """
            INSERT OR REPLACE INTO cached_images (hash, file_path, created_at, last_accessed)
            VALUES (?, ?, datetime('now'), datetime('now'))
        """

        let insertUrlSQL = """
            INSERT OR REPLACE INTO url_mappings (url, hash, created_at)
            VALUES (?, ?, datetime('now'))
        """

        try executeSQL(insertImageSQL, parameters: [hash, path])
        try executeSQL(insertUrlSQL, parameters: [originalURL.absoluteString, hash])
    }

    /// Gets existing image path for a hash
    public func getExistingImagePath(for hash: String) async throws -> String? {
        try await ensureInitialized()

        let sql = "SELECT file_path FROM cached_images WHERE hash = ? AND EXISTS(SELECT 1 FROM url_mappings WHERE hash = ?)"

        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare statement")
        }

        sqlite3_bind_text(statement, 1, hash, -1, nil)
        sqlite3_bind_text(statement, 2, hash, -1, nil)

        if sqlite3_step(statement) == SQLITE_ROW {
            let pathPtr = sqlite3_column_text(statement, 0)
            let path = String(cString: pathPtr!)

            // Update last accessed time
            try updateLastAccessed(hash: hash)

            // Verify file still exists
            if FileManager.default.fileExists(atPath: path) {
                return path
            } else {
                // Clean up database entry for missing file
                try await removeImageWithHash(hash)
                return nil
            }
        }

        return nil
    }

    /// Gets cached path for a specific URL
    public func getCachedPath(for url: URL) async throws -> String? {
        try await ensureInitialized()

        let sql = """
            SELECT ci.file_path FROM cached_images ci
            JOIN url_mappings um ON ci.hash = um.hash
            WHERE um.url = ?
        """

        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare statement")
        }

        sqlite3_bind_text(statement, 1, url.absoluteString, -1, nil)

        if sqlite3_step(statement) == SQLITE_ROW {
            let pathPtr = sqlite3_column_text(statement, 0)
            let path = String(cString: pathPtr!)

            // Verify file still exists
            if FileManager.default.fileExists(atPath: path) {
                return path
            } else {
                // Clean up database entry for missing file
                try await removeImageAtPath(path)
                return nil
            }
        }

        return nil
    }

    /// Adds URL mapping to existing cached image
    public func addURLMapping(url: URL, path: String) async throws {
        try await ensureInitialized()

        // Get hash for the path
        let getHashSQL = "SELECT hash FROM cached_images WHERE file_path = ?"

        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, getHashSQL, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare statement")
        }

        sqlite3_bind_text(statement, 1, path, -1, nil)

        if sqlite3_step(statement) == SQLITE_ROW {
            let hashPtr = sqlite3_column_text(statement, 0)
            let hash = String(cString: hashPtr!)

            // Insert URL mapping
            let insertSQL = """
                INSERT OR REPLACE INTO url_mappings (url, hash, created_at)
                VALUES (?, ?, datetime('now'))
            """
            try executeSQL(insertSQL, parameters: [url.absoluteString, hash])
        }
    }

    /// Removes image tracking by path
    public func removeImageAtPath(_ path: String) async {
        do {
            try await ensureInitialized()

            let deleteImageSQL = "DELETE FROM cached_images WHERE file_path = ?"
            try executeSQL(deleteImageSQL, parameters: [path])

            // Note: URL mappings are cleaned up by foreign key constraints
        } catch {
            print("Failed to remove image tracking for path \(path): \(error)")
        }
    }

    /// Removes image tracking by hash
    public func removeImageWithHash(_ hash: String) async throws {
        try await ensureInitialized()

        let deleteImageSQL = "DELETE FROM cached_images WHERE hash = ?"
        try executeSQL(deleteImageSQL, parameters: [hash])

        // Note: URL mappings are cleaned up by foreign key constraints
    }

    /// Gets count of cached images
    public func getCachedImageCount() async throws -> Int {
        try await ensureInitialized()

        let sql = "SELECT COUNT(*) FROM cached_images"

        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare statement")
        }

        if sqlite3_step(statement) == SQLITE_ROW {
            return Int(sqlite3_column_int(statement, 0))
        }

        return 0
    }

    /// Cleans up orphaned entries (images without files)
    public func cleanupOrphanedEntries() async throws {
        try await ensureInitialized()

        let sql = "SELECT hash, file_path FROM cached_images"

        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare statement")
        }

        var orphanedHashes: [String] = []

        while sqlite3_step(statement) == SQLITE_ROW {
            let hashPtr = sqlite3_column_text(statement, 0)
            let pathPtr = sqlite3_column_text(statement, 1)

            let hash = String(cString: hashPtr!)
            let path = String(cString: pathPtr!)

            if !FileManager.default.fileExists(atPath: path) {
                orphanedHashes.append(hash)
            }
        }

        // Remove orphaned entries
        for hash in orphanedHashes {
            try await removeImageWithHash(hash)
        }
    }

    // MARK: - Private Implementation

    private func initializeDatabase() async {
        do {
            guard sqlite3_open(dbPath, &db) == SQLITE_OK else {
                print("Failed to open cache database at \(dbPath)")
                return
            }

            try createTables()
        } catch {
            print("Failed to initialize image cache database: \(error)")
        }
    }

    private func ensureInitialized() async throws {
        if db == nil {
            await initializeDatabase()
        }

        guard db != nil else {
            throw ImageDeduplicationError.databaseError("Failed to initialize database")
        }
    }

    private func createTables() throws {
        let createImagesTable = """
            CREATE TABLE IF NOT EXISTS cached_images (
                hash TEXT PRIMARY KEY,
                file_path TEXT NOT NULL,
                created_at TEXT NOT NULL,
                last_accessed TEXT NOT NULL
            )
        """

        let createUrlMappingsTable = """
            CREATE TABLE IF NOT EXISTS url_mappings (
                url TEXT PRIMARY KEY,
                hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (hash) REFERENCES cached_images(hash) ON DELETE CASCADE
            )
        """

        let createLastAccessedIndex = """
            CREATE INDEX IF NOT EXISTS idx_cached_images_last_accessed
            ON cached_images(last_accessed)
        """

        try executeSQL(createImagesTable)
        try executeSQL(createUrlMappingsTable)
        try executeSQL(createLastAccessedIndex)
    }

    private func executeSQL(_ sql: String, parameters: [Any] = []) throws {
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }

        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw ImageDeduplicationError.databaseError("Failed to prepare SQL: \(sql)")
        }

        for (index, parameter) in parameters.enumerated() {
            let paramIndex = Int32(index + 1)

            if let stringParam = parameter as? String {
                sqlite3_bind_text(statement, paramIndex, stringParam, -1, nil)
            } else if let intParam = parameter as? Int {
                sqlite3_bind_int(statement, paramIndex, Int32(intParam))
            } else {
                sqlite3_bind_null(statement, paramIndex)
            }
        }

        guard sqlite3_step(statement) == SQLITE_DONE else {
            let errorMessage = String(cString: sqlite3_errmsg(db))
            throw ImageDeduplicationError.databaseError("SQL execution failed: \(errorMessage)")
        }
    }

    private func updateLastAccessed(hash: String) throws {
        let sql = "UPDATE cached_images SET last_accessed = datetime('now') WHERE hash = ?"
        try executeSQL(sql, parameters: [hash])
    }
}

// MARK: - Error Types

public enum ImageDeduplicationError: Error, LocalizedError {
    case databaseError(String)
    case fileSystemError(String)

    public var errorDescription: String? {
        switch self {
        case .databaseError(let message):
            return "Image deduplication database error: \(message)"
        case .fileSystemError(let message):
            return "Image deduplication file system error: \(message)"
        }
    }
}