import Foundation
import os

#if os(macOS)
import AppKit
#else
import UIKit
#endif

// ---------------------------------------------------------------------------
// PermissionManager — Security-Scoped Bookmark Caching & System Settings
// ---------------------------------------------------------------------------
// Handles security-scoped bookmark storage and resolution for re-import
// without re-auth. Provides System Settings deep links for TCC permission
// management and copy-then-read utility for safe system DB access.
//
// Requirements addressed:
//   - FNDX-02: Permission management with System Settings deep links
//   - FNDX-04: Copy-then-read for safe system database access
//   - FNDX-06: Dynamic path discovery (bookmark resolution)
//   - FNDX-07: Re-import without re-granting file access

private nonisolated let logger = Logger(subsystem: "works.isometry.app", category: "Permission")

actor PermissionManager {

    // MARK: - Constants

    /// UserDefaults key prefix for security-scoped bookmark data.
    private static let bookmarkKeyPrefix = "works.isometry.bookmark."

    // MARK: - Bookmark Storage (FNDX-07)

    /// Create and store a security-scoped bookmark for the given URL.
    /// Used after NSOpenPanel grants access to a system database path.
    func storeBookmark(for sourceType: String, url: URL) throws {
        #if os(macOS)
        let bookmarkData = try url.bookmarkData(
            options: .withSecurityScope,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        #else
        let bookmarkData = try url.bookmarkData(
            options: .minimalBookmark,
            includingResourceValuesForKeys: nil,
            relativeTo: nil
        )
        #endif

        let key = Self.bookmarkKeyPrefix + sourceType
        UserDefaults.standard.set(bookmarkData, forKey: key)
        logger.info("Stored bookmark for \(sourceType)")
    }

    /// Resolve a previously stored security-scoped bookmark.
    /// Returns nil if no bookmark exists, bookmark is stale, or access fails.
    /// Automatically clears stale bookmarks.
    func resolveBookmark(for sourceType: String) throws -> URL? {
        let key = Self.bookmarkKeyPrefix + sourceType
        guard let bookmarkData = UserDefaults.standard.data(forKey: key) else {
            return nil
        }

        var isStale = false
        #if os(macOS)
        let url = try URL(
            resolvingBookmarkData: bookmarkData,
            options: .withSecurityScope,
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        )
        #else
        let url = try URL(
            resolvingBookmarkData: bookmarkData,
            options: [],
            relativeTo: nil,
            bookmarkDataIsStale: &isStale
        )
        #endif

        if isStale {
            logger.warning("Bookmark for \(sourceType) is stale — clearing")
            UserDefaults.standard.removeObject(forKey: key)
            return nil
        }

        #if os(macOS)
        guard url.startAccessingSecurityScopedResource() else {
            logger.warning("Failed to start accessing security-scoped resource for \(sourceType)")
            return nil
        }
        #endif

        logger.info("Resolved bookmark for \(sourceType): \(url.path)")
        return url
    }

    /// Remove a stored bookmark for the given source type.
    func clearBookmark(for sourceType: String) {
        let key = Self.bookmarkKeyPrefix + sourceType
        UserDefaults.standard.removeObject(forKey: key)
        logger.info("Cleared bookmark for \(sourceType)")
    }

    // MARK: - System Settings Deep Links (FNDX-02)

    /// Open the appropriate System Settings pane for the given source type.
    /// On macOS: opens specific Privacy & Security pane.
    /// On iOS: opens the app's Settings page.
    @MainActor
    func openSystemSettings(for sourceType: String) {
        #if os(macOS)
        let urlString: String
        switch sourceType {
        case "native_notes":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles"
        case "native_reminders":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders"
        case "native_calendar":
            urlString = "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars"
        default:
            urlString = "x-apple.systempreferences:com.apple.preference.security"
        }

        if let url = URL(string: urlString) {
            NSWorkspace.shared.open(url)
            logger.info("Opened System Settings for \(sourceType)")
        } else {
            logger.error("Failed to create System Settings URL for \(sourceType)")
        }
        #else
        if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
            logger.info("Opened Settings for \(sourceType)")
        }
        #endif
    }

    // MARK: - Copy-Then-Read (FNDX-04)

    /// Copy a system database and its WAL/SHM files to a temp directory.
    /// Returns the URL of the copied .db file. Only .db is required;
    /// .wal and .shm are copied if they exist.
    func copyDatabaseToTemp(from sourceURL: URL) throws -> URL {
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try fm.createDirectory(at: tempDir, withIntermediateDirectories: true)

        let dbFilename = sourceURL.lastPathComponent
        let destDB = tempDir.appendingPathComponent(dbFilename)

        // Copy the primary .db file
        try fm.copyItem(at: sourceURL, to: destDB)

        // Copy .wal and .shm if they exist (WAL-mode support)
        let walURL = sourceURL.appendingPathExtension("wal")
        if fm.fileExists(atPath: walURL.path) {
            let destWAL = tempDir.appendingPathComponent(dbFilename + "-wal")
            try fm.copyItem(at: walURL, to: destWAL)
        }

        let shmURL = sourceURL.appendingPathExtension("shm")
        if fm.fileExists(atPath: shmURL.path) {
            let destSHM = tempDir.appendingPathComponent(dbFilename + "-shm")
            try fm.copyItem(at: shmURL, to: destSHM)
        }

        logger.info("Copied database to temp: \(tempDir.path)")
        return destDB
    }

    /// Remove a temp directory created by copyDatabaseToTemp.
    func cleanupTempCopy(at tempDir: URL) {
        do {
            try FileManager.default.removeItem(at: tempDir)
            logger.info("Cleaned up temp copy: \(tempDir.path)")
        } catch {
            logger.warning("Failed to clean up temp copy: \(error.localizedDescription)")
        }
    }
}
