import Foundation
import os

actor DatabaseManager {
    private let dbURL: URL
    private let tmpURL: URL
    private let bakURL: URL
    private let logger = Logger(subsystem: "com.isometry.app", category: "Database")

    private(set) var isDirty: Bool = false

    /// Production initializer — uses Application Support/Isometry/
    init() throws {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let dir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
        try Self.ensureDirectory(dir)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
        logger.info("DatabaseManager initialized at \(dir.path)")
    }

    /// Test initializer — uses custom base directory for test isolation
    init(baseDirectory dir: URL) throws {
        try Self.ensureDirectory(dir)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
    }

    // MARK: - Load (DATA-01, DATA-02)

    /// Load database bytes from disk. Returns nil if no database exists (first launch).
    /// Corruption cascade: try .db → try .bak → return nil.
    func loadDatabase() -> Data? {
        let fm = FileManager.default

        // Try primary
        if fm.fileExists(atPath: dbURL.path),
           let data = fm.contents(atPath: dbURL.path), !data.isEmpty {
            logger.info("Loaded database (\(data.count) bytes)")
            return data
        }

        // Try backup (corruption cascade)
        if fm.fileExists(atPath: bakURL.path),
           let data = fm.contents(atPath: bakURL.path), !data.isEmpty {
            logger.warning("Primary database missing/empty, loaded from backup (\(data.count) bytes)")
            return data
        }

        // First launch or full corruption
        logger.info("No database found — first launch")
        return nil
    }

    // MARK: - Save (DATA-03)

    /// Atomically write database checkpoint.
    /// Flow: write to .tmp → rotate .db to .bak → rename .tmp to .db
    func saveCheckpoint(_ data: Data) throws {
        let fm = FileManager.default

        // 1. Write new data to temp file
        try data.write(to: tmpURL)

        // 2. Rotate existing .db to .bak (one-level backup)
        if fm.fileExists(atPath: dbURL.path) {
            // Remove old backup if exists
            if fm.fileExists(atPath: bakURL.path) {
                try fm.removeItem(at: bakURL)
            }
            try fm.moveItem(at: dbURL, to: bakURL)
        }

        // 3. Atomic rename .tmp → .db (same APFS volume = atomic)
        try fm.moveItem(at: tmpURL, to: dbURL)

        isDirty = false
        logger.info("Checkpoint saved (\(data.count) bytes)")
    }

    // MARK: - Dirty Flag

    func markDirty() {
        isDirty = true
    }

    func clearDirty() {
        isDirty = false
    }

    // MARK: - Private

    private static func ensureDirectory(_ dir: URL) throws {
        try FileManager.default.createDirectory(
            at: dir, withIntermediateDirectories: true, attributes: nil
        )
    }
}
