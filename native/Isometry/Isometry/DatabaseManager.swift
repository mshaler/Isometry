import Foundation
import os

actor DatabaseManager {
    private let dbURL: URL
    private let tmpURL: URL
    private let bakURL: URL
    private let logger = Logger(subsystem: "works.isometry.app", category: "Database")

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

    /// Test initializer — uses custom base directory.
    init(baseDirectory dir: URL) throws {
        try Self.ensureDirectory(dir)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
    }

    // MARK: - Async Factory

    /// Async factory that initializes DatabaseManager with Application Support
    /// and runs one-time migration from iCloud ubiquity container on a background thread.
    /// The migration check uses url(forUbiquityContainerIdentifier:) which blocks on IPC,
    /// so it MUST run via Task.detached (Pitfall 3).
    static func makeForProduction() async throws -> DatabaseManager {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let appSupportDir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
        try ensureDirectory(appSupportDir)

        // Run migration check on background thread — url(forUbiquityContainerIdentifier:) blocks on IPC
        await Task.detached(priority: .userInitiated) {
            migrateFromUbiquityIfNeeded(to: appSupportDir)
        }.value

        return try DatabaseManager()
    }

    // MARK: - Migration from Ubiquity Container

    /// One-time migration: copies database from iCloud ubiquity container to Application Support.
    /// Reverse of the old autoMigrateIfNeeded — now we pull FROM iCloud, not push TO it.
    /// Non-destructive: does NOT delete the iCloud copy.
    /// MUST run on a background thread — url(forUbiquityContainerIdentifier:) blocks on IPC.
    private static func migrateFromUbiquityIfNeeded(to appSupportDir: URL) {
        let logger = Logger(subsystem: "works.isometry.app", category: "Database")
        let fm = FileManager.default
        let appSupportDB = appSupportDir.appendingPathComponent("isometry.db")

        // Skip if Application Support database already exists (already migrated or never used iCloud)
        guard !fm.fileExists(atPath: appSupportDB.path) else {
            return
        }

        // Try to find iCloud ubiquity container
        guard let containerURL = fm.url(forUbiquityContainerIdentifier: nil) else {
            logger.info("No iCloud ubiquity container found — skipping migration")
            return
        }

        let icloudDB = containerURL
            .appendingPathComponent("Isometry", isDirectory: true)
            .appendingPathComponent("isometry.db")

        guard fm.fileExists(atPath: icloudDB.path) else {
            logger.info("No database in iCloud ubiquity container — skipping migration")
            return
        }

        // Copy iCloud -> Application Support (non-destructive: leave iCloud copy)
        do {
            try fm.copyItem(at: icloudDB, to: appSupportDB)
            logger.info("Migrated database from iCloud ubiquity container to Application Support: \(appSupportDB.path)")
        } catch {
            logger.error("Migration from iCloud ubiquity container failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Load (DATA-01, DATA-02)

    /// Load database bytes from disk. Returns nil if no database exists (first launch).
    /// Corruption cascade: try .db -> try .bak -> return nil.
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
    /// Flow: write to .tmp -> rotate .db to .bak -> rename .tmp to .db
    func saveCheckpoint(_ data: Data) throws {
        let fm = FileManager.default

        // 1. Write new data to temp file
        try data.write(to: tmpURL)

        // 2. Rotate existing .db to .bak (one-level backup)
        if fm.fileExists(atPath: dbURL.path) {
            if fm.fileExists(atPath: bakURL.path) {
                try fm.removeItem(at: bakURL)
            }
            try fm.moveItem(at: dbURL, to: bakURL)
        }

        // 3. Atomic rename .tmp -> .db (same APFS volume = atomic)
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
