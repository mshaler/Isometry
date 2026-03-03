import Foundation
import os

actor DatabaseManager {
    private let dbURL: URL
    private let tmpURL: URL
    private let bakURL: URL
    private let useCoordinator: Bool
    private let logger = Logger(subsystem: "com.isometry.app", category: "Database")

    private(set) var isDirty: Bool = false

    /// Production initializer — uses Application Support/Isometry/
    /// Sets useCoordinator = false (local Application Support path, not iCloud).
    init() throws {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let dir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
        try Self.ensureDirectory(dir)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
        useCoordinator = false
        logger.info("DatabaseManager initialized at \(dir.path)")
    }

    /// Test/iCloud initializer — uses custom base directory.
    /// Detects iCloud ubiquity container from path and sets useCoordinator accordingly.
    init(baseDirectory dir: URL) throws {
        try Self.ensureDirectory(dir)
        dbURL  = dir.appendingPathComponent("isometry.db")
        tmpURL = dir.appendingPathComponent("isometry.db.tmp")
        bakURL = dir.appendingPathComponent("isometry.db.bak")
        // Detect iCloud ubiquity container: iOS uses "Mobile Documents", macOS uses "CloudDocs"
        let path = dir.path
        useCoordinator = path.contains("Mobile Documents") || path.contains("CloudDocs")
    }

    // MARK: - Async Factory (TIER-01)

    /// Async factory that resolves the iCloud ubiquity container on a background thread.
    /// Falls back to Application Support/Isometry/ if iCloud is unavailable.
    /// MUST NOT be called from the main thread — dispatches internally via Task.detached.
    static func makeForProduction() async throws -> DatabaseManager {
        let dir = await Task.detached(priority: .userInitiated) {
            resolveStorageDirectory()
        }.value
        await autoMigrateIfNeeded(to: dir)
        return try DatabaseManager(baseDirectory: dir)
    }

    // MARK: - Storage Directory Resolution

    /// Resolves the storage directory: iCloud ubiquity container when available, local fallback.
    /// MUST be called from a background thread — url(forUbiquityContainerIdentifier:) blocks on IPC.
    static func resolveStorageDirectory() -> URL {
        // Attempt iCloud Documents container (Pitfall 1: blocks — background only)
        if let containerURL = FileManager.default.url(forUbiquityContainerIdentifier: nil) {
            // Per PLAN.md: file is hidden from iOS Files app — store in container root, NOT Documents/
            let dir = containerURL.appendingPathComponent("Isometry", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let logger = Logger(subsystem: "com.isometry.app", category: "Database")
            logger.info("iCloud container resolved: \(dir.path)")
            return dir
        }
        // Fallback: Application Support/Isometry/ (iCloud unavailable or not signed in)
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let dir = appSupport.appendingPathComponent("Isometry", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let logger = Logger(subsystem: "com.isometry.app", category: "Database")
        logger.info("iCloud unavailable — using local storage: \(dir.path)")
        return dir
    }

    // MARK: - Auto Migration (TIER-01)

    /// Migrates local Application Support database to iCloud container on first iCloud-enabled launch.
    /// Only runs when the destination is an iCloud ubiquity container.
    /// Does NOT delete the local file after migration (safety net).
    private static func autoMigrateIfNeeded(to icloudDir: URL) async {
        let path = icloudDir.path
        // Only migrate if destination is an iCloud ubiquity container
        guard path.contains("Mobile Documents") || path.contains("CloudDocs") else { return }

        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let localDB = appSupport
            .appendingPathComponent("Isometry", isDirectory: true)
            .appendingPathComponent("isometry.db")
        let icloudDB = icloudDir.appendingPathComponent("isometry.db")

        let fm = FileManager.default
        let logger = Logger(subsystem: "com.isometry.app", category: "Database")

        // Skip if local database doesn't exist
        guard fm.fileExists(atPath: localDB.path) else { return }
        // Skip if iCloud database already exists (migration already done)
        guard !fm.fileExists(atPath: icloudDB.path) else { return }

        // Copy local to iCloud via NSFileCoordinator for safety
        var coordinationError: NSError?
        var copyError: Error?
        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(writingItemAt: icloudDB, options: .forReplacing, error: &coordinationError) { coordURL in
            do {
                try fm.copyItem(at: localDB, to: coordURL)
                logger.info("Auto-migrated local database to iCloud: \(coordURL.path)")
            } catch {
                copyError = error
                logger.error("Auto-migration failed: \(error.localizedDescription)")
            }
        }
        if let error = coordinationError {
            logger.error("Auto-migration coordination error: \(error.localizedDescription)")
        }
        if let error = copyError {
            logger.error("Auto-migration copy error: \(error.localizedDescription)")
        }
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
    /// When in iCloud ubiquity container (useCoordinator = true):
    ///   Wraps entire atomic write sequence inside NSFileCoordinator to prevent
    ///   sync daemon observing inconsistent state (Pitfall 8 from RESEARCH.md).
    /// When using local storage (useCoordinator = false):
    ///   Direct write without coordinator overhead.
    func saveCheckpoint(_ data: Data) throws {
        if useCoordinator {
            try saveCheckpointCoordinated(data)
        } else {
            try saveCheckpointDirect(data)
        }
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

    // MARK: - Private Save Implementations

    /// Direct atomic write (local storage — no NSFileCoordinator overhead).
    /// Flow: write to .tmp → rotate .db to .bak → rename .tmp to .db
    private func saveCheckpointDirect(_ data: Data) throws {
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

        // 3. Atomic rename .tmp → .db (same APFS volume = atomic)
        try fm.moveItem(at: tmpURL, to: dbURL)
    }

    /// Coordinated atomic write (iCloud ubiquity container).
    /// Per Pitfall 8: all intermediate operations must run inside the same coordination block
    /// so the sync daemon never observes a partial state.
    /// NSFileCoordinator coordination blocks run synchronously on the calling thread —
    /// since DatabaseManager is an actor, this is safe (actor serializes access).
    private func saveCheckpointCoordinated(_ data: Data) throws {
        var coordinationError: NSError?
        var writeError: Error?

        let fm = FileManager.default
        let coordinator = NSFileCoordinator(filePresenter: nil)

        // Coordinate write access to the primary .db file.
        // The entire rotation sequence (write .tmp, rotate .db->.bak, rename .tmp->.db)
        // runs inside this block to prevent sync daemon observing incomplete state.
        coordinator.coordinate(writingItemAt: dbURL, options: .forReplacing, error: &coordinationError) { _ in
            do {
                // 1. Write new data to temp file (same directory, so APFS rename is atomic)
                try data.write(to: self.tmpURL)

                // 2. Rotate existing .db to .bak (one-level backup)
                if fm.fileExists(atPath: self.dbURL.path) {
                    if fm.fileExists(atPath: self.bakURL.path) {
                        try fm.removeItem(at: self.bakURL)
                    }
                    try fm.moveItem(at: self.dbURL, to: self.bakURL)
                }

                // 3. Atomic rename .tmp → .db (same APFS volume = atomic)
                try fm.moveItem(at: self.tmpURL, to: self.dbURL)
            } catch {
                writeError = error
            }
        }

        if let error = coordinationError { throw error }
        if let error = writeError { throw error }
    }

    // MARK: - Private

    private static func ensureDirectory(_ dir: URL) throws {
        try FileManager.default.createDirectory(
            at: dir, withIntermediateDirectories: true, attributes: nil
        )
    }
}
