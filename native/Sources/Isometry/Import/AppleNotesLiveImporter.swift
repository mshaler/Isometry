import Foundation
import EventKit
import Testing

/// Enhanced Apple Notes importer with live sync capabilities
/// Extends AltoIndexImporter foundation with real-time monitoring
public actor AppleNotesLiveImporter {
    private let database: IsometryDatabase
    private let altoIndexImporter: AltoIndexImporter
    private let accessManager: NotesAccessManager

    // Wave 2 components - file monitoring and conflict resolution
    private let watcher: AppleNotesWatcher
    private let conflictResolver: AppleNotesConflictResolver

    // Live sync infrastructure
    private var liveSyncConfig: LiveSyncConfiguration = .default
    private var syncStatus: SyncStatus = .idle
    private var performanceMetrics = PerformanceMetrics()

    // Background processing
    private var syncTask: Task<Void, Error>?
    private var lastSyncTime: Date = .distantPast

    // Sync state management
    private var syncState: LiveSyncState = .idle
    private var changeProcessingQueue: [AppleNotesWatcher.NotesChangeEvent] = []

    public init(database: IsometryDatabase) {
        self.database = database
        self.altoIndexImporter = AltoIndexImporter(database: database)
        self.accessManager = NotesAccessManager()
        self.watcher = AppleNotesWatcher(accessManager: accessManager)
        self.conflictResolver = AppleNotesConflictResolver(database: database)
    }

    // MARK: - Configuration

    public struct LiveSyncConfiguration {
        let isEnabled: Bool
        let syncInterval: TimeInterval
        let batchSize: Int
        let maxRetryAttempts: Int
        let incrementalSyncThreshold: TimeInterval

        public static let `default` = LiveSyncConfiguration(
            isEnabled: false,
            syncInterval: 30.0, // 30 seconds
            batchSize: 100,
            maxRetryAttempts: 3,
            incrementalSyncThreshold: 60.0 // 1 minute for incremental vs full sync
        )

        public static let aggressive = LiveSyncConfiguration(
            isEnabled: true,
            syncInterval: 10.0, // 10 seconds
            batchSize: 50,
            maxRetryAttempts: 5,
            incrementalSyncThreshold: 30.0 // 30 seconds
        )
    }

    public enum SyncStatus {
        case idle
        case syncing
        case error(Error)
        case permissionDenied
        case noData

        public var isActive: Bool {
            switch self {
            case .syncing: return true
            default: return false
            }
        }
    }

    /// Enhanced sync state for Wave 2 functionality
    public enum LiveSyncState {
        case idle
        case monitoring
        case syncing
        case conflictResolution
        case error(Error)

        public var isProcessing: Bool {
            switch self {
            case .syncing, .conflictResolution: return true
            case .idle, .monitoring, .error: return false
            }
        }
    }

    public struct PerformanceMetrics {
        var totalSyncCount: Int = 0
        var lastSyncDuration: TimeInterval = 0
        var averageSyncDuration: TimeInterval = 0
        var incrementalSyncCount: Int = 0
        var fullSyncCount: Int = 0
        var errorCount: Int = 0
        var notesProcessedPerSecond: Double = 0

        mutating func recordSync(duration: TimeInterval, notesProcessed: Int, isIncremental: Bool) {
            totalSyncCount += 1
            lastSyncDuration = duration
            averageSyncDuration = ((averageSyncDuration * Double(totalSyncCount - 1)) + duration) / Double(totalSyncCount)

            if isIncremental {
                incrementalSyncCount += 1
            } else {
                fullSyncCount += 1
            }

            if duration > 0 {
                notesProcessedPerSecond = Double(notesProcessed) / duration
            }
        }

        mutating func recordError() {
            errorCount += 1
        }
    }

    // MARK: - Live Sync Control

    /// Start live sync with continuous monitoring
    public func startLiveSync(configuration: LiveSyncConfiguration = .default) async throws {
        guard !syncStatus.isActive else {
            print("Live sync already running")
            return
        }

        liveSyncConfig = configuration

        // Check permissions first
        let permissionStatus = await accessManager.checkCurrentPermissionStatus()
        guard permissionStatus == .authorized else {
            syncStatus = .permissionDenied
            throw LiveSyncError.insufficientPermissions
        }

        syncStatus = .syncing
        syncState = .monitoring
        print("Starting live sync with interval: \(configuration.syncInterval)s")

        // Wave 2: Start file system watcher
        try await startFileSystemMonitoring()

        // Start background sync task
        syncTask = Task { [weak self] in
            while !Task.isCancelled {
                do {
                    try await self?.performSyncCycle()
                    try await Task.sleep(for: .seconds(configuration.syncInterval))
                } catch {
                    await self?.handleSyncError(error)
                    // Wait longer on error before retrying
                    try await Task.sleep(for: .seconds(configuration.syncInterval * 3))
                }
            }
        }
    }

    /// Stop live sync gracefully
    public func stopLiveSync() async {
        syncTask?.cancel()
        syncTask = nil

        // Wave 2: Stop file system monitoring
        await stopFileSystemMonitoring()

        if case .syncing = syncStatus {
            syncStatus = .idle
        }
        syncState = .idle

        print("Live sync stopped. Total syncs: \(performanceMetrics.totalSyncCount)")
    }

    // MARK: - Core Import Functionality (AltoIndexImporter Integration)

    /// Import all notes using existing AltoIndexImporter patterns
    public func importNotes(from directoryURL: URL) async throws -> ImportResult {
        // Delegate to proven AltoIndexImporter
        return try await altoIndexImporter.importNotes(from: directoryURL)
    }

    /// Import single note using existing patterns
    public func importNote(from fileURL: URL, relativeTo baseURL: URL? = nil) async throws -> Node {
        return try await altoIndexImporter.importNote(from: fileURL, relativeTo: baseURL)
    }

    // MARK: - Live Sync Implementation

    /// Perform one sync cycle (incremental or full)
    private func performSyncCycle() async throws {
        let startTime = Date()
        let shouldDoIncrementalSync = Date().timeIntervalSince(lastSyncTime) < liveSyncConfig.incrementalSyncThreshold

        print("Starting \(shouldDoIncrementalSync ? "incremental" : "full") sync cycle")

        do {
            let result: ImportResult

            if shouldDoIncrementalSync {
                result = try await performIncrementalSync()
            } else {
                result = try await performFullSync()
            }

            let duration = Date().timeIntervalSince(startTime)
            performanceMetrics.recordSync(
                duration: duration,
                notesProcessed: result.imported,
                isIncremental: shouldDoIncrementalSync
            )

            lastSyncTime = Date()
            syncStatus = .idle

            if result.imported > 0 {
                print("Sync completed: \(result.imported) notes processed in \(String(format: "%.2f", duration))s")
            }

        } catch {
            performanceMetrics.recordError()
            throw error
        }
    }

    /// Perform incremental sync (only changed notes)
    private func performIncrementalSync() async throws -> ImportResult {
        // TODO: In Wave 2, this will use FSEvents to detect changed files
        // For now, perform a lightweight check using file modification times

        let accessLevel = await accessManager.getAvailableAccessLevel()

        switch accessLevel {
        case .fullAccess:
            return try await performLiveNotesSync()
        case .readOnly:
            return try await performAltoIndexSync()
        case .none:
            throw LiveSyncError.noAccessAvailable
        }
    }

    /// Perform full sync (all notes)
    private func performFullSync() async throws -> ImportResult {
        let accessLevel = await accessManager.getAvailableAccessLevel()

        switch accessLevel {
        case .fullAccess:
            return try await performLiveNotesSync()
        case .readOnly:
            return try await performAltoIndexSync()
        case .none:
            throw LiveSyncError.noAccessAvailable
        }
    }

    /// Sync using live Notes access (when permissions granted)
    private func performLiveNotesSync() async throws -> ImportResult {
        // TODO: In Wave 2, implement live EventKit-based sync
        // For now, fallback to alto-index
        print("Live Notes sync not yet implemented, using alto-index fallback")
        return try await performAltoIndexSync()
    }

    /// Sync using alto-index export (fallback method)
    private func performAltoIndexSync() async throws -> ImportResult {
        // Check for alto-index export directory
        let homeDirectory = FileManager.default.homeDirectoryForCurrentUser
        let altoIndexExportPath = homeDirectory
            .appendingPathComponent("Documents")
            .appendingPathComponent("alto-index")

        guard FileManager.default.fileExists(atPath: altoIndexExportPath.path) else {
            // No data available, but not an error
            return ImportResult()
        }

        // Use existing proven importer
        return try await altoIndexImporter.importNotes(from: altoIndexExportPath)
    }

    /// Handle sync errors with appropriate recovery strategies
    private func handleSyncError(_ error: Error) async {
        performanceMetrics.recordError()
        syncStatus = .error(error)

        print("Sync error: \(error.localizedDescription)")

        // Check if error is permission-related
        if error is LiveSyncError {
            switch error as! LiveSyncError {
            case .insufficientPermissions:
                syncStatus = .permissionDenied
                // Stop live sync on permission error
                await stopLiveSync()
            case .noAccessAvailable:
                syncStatus = .noData
            case .syncAlreadyRunning, .syncNotRunning:
                // These shouldn't occur during active sync, but handle gracefully
                break
            }
        }
    }

    // MARK: - Public Status Interface

    /// Get current sync status
    public var currentSyncStatus: SyncStatus {
        return syncStatus
    }

    /// Get performance metrics
    public var currentPerformanceMetrics: PerformanceMetrics {
        return performanceMetrics
    }

    /// Get live sync configuration
    public var currentConfiguration: LiveSyncConfiguration {
        return liveSyncConfig
    }

    /// Check if live sync is currently running
    public var isLiveSyncActive: Bool {
        return syncStatus.isActive
    }

    /// Get current sync state (Wave 2)
    public var currentSyncState: LiveSyncState {
        return syncState
    }

    // MARK: - Wave 2: File System Monitoring and Conflict Resolution

    /// Start file system monitoring for real-time change detection
    private func startFileSystemMonitoring() async throws {
        print("AppleNotesLiveImporter: Starting file system monitoring")

        // Set up change handler for watcher
        await watcher.addChangeHandler { [weak self] changeEvent in
            Task {
                await self?.handleFileSystemChange(changeEvent)
            }
        }

        // Start watching
        try await watcher.startWatching()
        print("AppleNotesLiveImporter: File system monitoring started successfully")
    }

    /// Stop file system monitoring
    private func stopFileSystemMonitoring() async {
        print("AppleNotesLiveImporter: Stopping file system monitoring")
        await watcher.stopWatching()
        await watcher.clearChangeHandlers()
        print("AppleNotesLiveImporter: File system monitoring stopped")
    }

    /// Handle detected file system changes
    private func handleFileSystemChange(_ changeEvent: AppleNotesWatcher.NotesChangeEvent) async {
        print("AppleNotesLiveImporter: File change detected - \(changeEvent.eventType.rawValue) at \(changeEvent.fileURL.lastPathComponent)")

        // Add to processing queue
        changeProcessingQueue.append(changeEvent)

        // Trigger immediate sync if not already processing
        guard !syncState.isProcessing else {
            print("AppleNotesLiveImporter: Sync already in progress, queuing change")
            return
        }

        // Process the change immediately for real-time feel
        await processQueuedChanges()
    }

    /// Process queued file system changes
    private func processQueuedChanges() async {
        guard !changeProcessingQueue.isEmpty else { return }

        let previousState = syncState
        syncState = .syncing

        do {
            let changes = changeProcessingQueue
            changeProcessingQueue.removeAll()

            print("AppleNotesLiveImporter: Processing \(changes.count) queued changes")

            for change in changes {
                try await processIndividualChange(change)
            }

            syncState = .monitoring
            print("AppleNotesLiveImporter: Successfully processed all queued changes")

        } catch {
            syncState = .error(error)
            print("AppleNotesLiveImporter: Error processing changes: \(error)")

            // Re-queue failed changes for retry
            await handleSyncError(error)

            // Restore previous state after error handling
            syncState = previousState
        }
    }

    /// Process an individual file change
    private func processIndividualChange(_ change: AppleNotesWatcher.NotesChangeEvent) async throws {
        switch change.eventType {
        case .created, .modified:
            try await handleNoteCreatedOrModified(change)

        case .deleted:
            try await handleNoteDeleted(change)

        case .moved:
            try await handleNoteMoved(change)

        case .permissionsChanged:
            // Permission changes typically don't require immediate action
            print("AppleNotesLiveImporter: Permission change detected, ignoring")
        }
    }

    /// Handle note creation or modification with conflict detection
    private func handleNoteCreatedOrModified(_ change: AppleNotesWatcher.NotesChangeEvent) async throws {
        guard change.fileURL.pathExtension == "md" else {
            // Only process markdown files for alto-index imports
            return
        }

        // Import the note
        let importedNode = try await importNote(from: change.fileURL)

        // Check for conflicts with existing data
        if let existingNode = try await database.getNode(bySourceId: importedNode.sourceId ?? "", source: "apple-notes") {
            let conflict = await conflictResolver.compareNoteVersions(local: existingNode, remote: importedNode)

            if let detectedConflict = conflict {
                await handleDetectedConflict(detectedConflict)
            }
        }
    }

    /// Handle note deletion
    private func handleNoteDeleted(_ change: AppleNotesWatcher.NotesChangeEvent) async throws {
        // For now, just log the deletion - in a production system, we'd need to
        // determine which note was deleted and mark it as deleted in our database
        print("AppleNotesLiveImporter: Note deletion detected: \(change.fileURL.lastPathComponent)")

        // TODO: Implement deletion handling based on file mapping
    }

    /// Handle note move/rename
    private func handleNoteMoved(_ change: AppleNotesWatcher.NotesChangeEvent) async throws {
        // For now, treat moves as a deletion + creation
        print("AppleNotesLiveImporter: Note move detected: \(change.fileURL.lastPathComponent)")

        // TODO: Implement move handling with proper tracking
    }

    /// Handle detected conflicts using the conflict resolver
    private func handleDetectedConflict(_ conflict: AppleNotesConflictResolver.NoteConflict) async {
        let previousState = syncState
        syncState = .conflictResolution

        print("AppleNotesLiveImporter: Conflict detected - \(conflict.conflictType.rawValue)")

        do {
            // Try automatic resolution first
            let resolution = try await conflictResolver.resolveConflict(conflict)

            // Apply the resolution to the database
            try await database.updateNode(resolution.resolvedNode)

            print("AppleNotesLiveImporter: Conflict resolved automatically using \(resolution.strategy.rawValue)")

        } catch ConflictResolutionError.requiresUserInput(_) {
            // This conflict requires user input - in Wave 3, we'd present UI
            print("AppleNotesLiveImporter: Conflict requires user input - deferring to UI")

            // For now, just use last-write-wins as fallback
            do {
                let fallbackResolution = try await conflictResolver.resolveConflict(conflict, strategy: .lastWriteWins)
                try await database.updateNode(fallbackResolution.resolvedNode)
                print("AppleNotesLiveImporter: Applied fallback resolution")
            } catch {
                print("AppleNotesLiveImporter: Failed to apply fallback resolution: \(error)")
            }

        } catch {
            print("AppleNotesLiveImporter: Error resolving conflict: \(error)")
        }

        syncState = previousState
    }
}

// MARK: - ExportableImporterProtocol Conformance

extension AppleNotesLiveImporter: ImportTestHarness.ExportableImporterProtocol {

    public func importData(_ content: Data, filename: String, folder: String?) async throws -> ImportResult {
        // Delegate to AltoIndexImporter for testing
        return try await altoIndexImporter.importData(content, filename: filename, folder: folder)
    }

    public func importFromFile(_ url: URL, folder: String?) async throws -> ImportResult {
        let node = try await altoIndexImporter.importNote(from: url, relativeTo: url.deletingLastPathComponent())

        var result = ImportResult()
        result.imported = 1
        result.nodes.append(node)
        return result
    }

    nonisolated public var supportedExtensions: [String] {
        return ["md", "markdown"] // Match AltoIndexImporter without actor isolation issues
    }

    nonisolated public var importerName: String {
        return "AppleNotesLiveImporter"
    }

    public func exportNodes(_ nodes: [Node], to url: URL) async throws -> Data {
        return try await altoIndexImporter.exportNodes(nodes, to: url)
    }

    public func validateRoundTripData(original: Data, exported: Data) async throws -> ImportTestHarness.RoundTripValidationResult {
        return try await altoIndexImporter.validateRoundTripData(original: original, exported: exported)
    }
}

// MARK: - Error Types

public enum LiveSyncError: Error, LocalizedError {
    case insufficientPermissions
    case noAccessAvailable
    case syncAlreadyRunning
    case syncNotRunning

    public var errorDescription: String? {
        switch self {
        case .insufficientPermissions:
            return "Insufficient permissions for live Notes access"
        case .noAccessAvailable:
            return "No access method available for Notes sync"
        case .syncAlreadyRunning:
            return "Live sync is already running"
        case .syncNotRunning:
            return "Live sync is not currently running"
        }
    }
}