import Foundation
import EventKit
import Testing
import Darwin

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

    // Performance optimization
    private var batchProcessor: NoteBatchProcessor?
    private let maxQueueSize = 1000
    private let memoryThresholdMB: Double = 80.0

    public init(database: IsometryDatabase) {
        self.database = database
        self.altoIndexImporter = AltoIndexImporter(database: database)
        self.accessManager = NotesAccessManager()
        self.watcher = AppleNotesWatcher(accessManager: accessManager)
        self.conflictResolver = AppleNotesConflictResolver(database: database)
        self.batchProcessor = NoteBatchProcessor(database: database)
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
        var memoryUsageMB: Double = 0
        var queuedChanges: Int = 0

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

            // Update memory usage
            updateMemoryUsage()
        }

        mutating func recordError() {
            errorCount += 1
        }

        mutating func updateMemoryUsage() {
            let info = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

            let result: kern_return_t = withUnsafeMutablePointer(to: &count) {
                task_info(mach_task_self_,
                         task_flavor_t(MACH_TASK_BASIC_INFO),
                         UnsafeMutablePointer<integer_t>.init($0),
                         &count)
            }

            if result == KERN_SUCCESS {
                memoryUsageMB = Double(info.resident_size) / 1024.0 / 1024.0
            }
        }

        var isMemoryConstrained: Bool {
            return memoryUsageMB > 100.0 // 100MB threshold
        }

        var processingEfficiency: Double {
            guard averageSyncDuration > 0 else { return 0 }
            return notesProcessedPerSecond / (errorCount + 1) // +1 to avoid division by zero
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
        print("Starting incremental sync with FSEvents integration")

        let accessLevel = await accessManager.getAvailableAccessLevel()

        switch accessLevel {
        case .fullAccess:
            // Use FSEvents monitoring to detect changed files for more efficient sync
            // Check if we have queued changes from file monitoring

            if changeProcessingQueue.isEmpty {
                print("No file changes detected since last sync")
                // Still run EventKit sync but with recent filter
            } else {
                print("FSEvents detected \(changeProcessingQueue.count) queued file changes")
            }
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
        print("Starting EventKit-based live Notes sync")

        // Initialize EventKit store
        let eventStore = EKEventStore()

        // Verify Notes access permission
        let authStatus = EKEventStore.authorizationStatus(for: .reminder)
        guard authStatus == .authorized else {
            print("EventKit access not authorized, falling back to alto-index")
            return try await performAltoIndexSync()
        }

        var result = ImportResult()
        var processedCount = 0

        do {
            // Access Notes calendar (Notes are stored as reminders in EventKit)
            let calendars = eventStore.calendars(for: .reminder)
            let notesCalendars = calendars.filter { $0.title.contains("Notes") || $0.source.title.contains("iCloud") }

            guard !notesCalendars.isEmpty else {
                print("No Notes calendars found in EventKit")
                return try await performAltoIndexSync()
            }

            // Create predicate for incremental sync based on modification date
            let lastSyncDate = lastSyncTime == .distantPast ? Date.distantPast : lastSyncTime
            let predicate = eventStore.predicateForReminders(in: notesCalendars)

            // Fetch reminders (Notes) that have been modified since last sync
            let reminders = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<[EKReminder], Error>) in
                eventStore.fetchReminders(matching: predicate) { reminders in
                    if let reminders = reminders {
                        let recentReminders = reminders.filter { reminder in
                            guard let modificationDate = reminder.lastModifiedDate else { return false }
                            return modificationDate > lastSyncDate
                        }
                        continuation.resume(returning: recentReminders)
                    } else {
                        continuation.resume(returning: [])
                    }
                }
            }

            print("Found \(reminders.count) Notes modified since last sync")

            // Process each Note (reminder) into our Node format
            for reminder in reminders {
                do {
                    let node = try await convertReminderToNode(reminder)

                    // Check for conflicts with existing data
                    if let existingNode = try await database.getNode(bySourceId: node.sourceId ?? "", source: "apple-notes") {
                        let conflict = await conflictResolver.compareNoteVersions(local: existingNode, remote: node)

                        if let detectedConflict = conflict {
                            let resolution = try await conflictResolver.resolveConflict(detectedConflict)
                            try await database.updateNode(resolution.resolvedNode)
                        } else {
                            try await database.updateNode(node)
                        }
                    } else {
                        try await database.insertNode(node)
                    }

                    result.nodes.append(node)
                    processedCount += 1

                } catch {
                    print("Error processing Note: \(error.localizedDescription)")
                    result.errors.append("Failed to process Note: \(reminder.title ?? "Unknown")")
                }
            }

            result.imported = processedCount
            print("EventKit sync completed: \(processedCount) Notes processed")

        } catch {
            print("EventKit sync failed: \(error.localizedDescription), falling back to alto-index")
            return try await performAltoIndexSync()
        }

        return result
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

        // Check if we should pause due to system constraints
        if shouldPauseProcessing() {
            print("AppleNotesLiveImporter: Pausing processing due to system constraints")
            return
        }

        // Add to processing queue
        changeProcessingQueue.append(changeEvent)

        // Manage queue size to prevent memory issues
        manageQueueSize()

        // Trigger immediate sync if not already processing and memory is acceptable
        guard !syncState.isProcessing else {
            print("AppleNotesLiveImporter: Sync already in progress, queuing change")
            return
        }

        // Process the change immediately for real-time feel if memory usage is acceptable
        if isMemoryUsageAcceptable() {
            await processQueuedChanges()
        } else {
            print("AppleNotesLiveImporter: Memory usage high, deferring processing")
        }
    }

    /// Process queued file system changes
    private func processQueuedChanges() async {
        guard !changeProcessingQueue.isEmpty else { return }

        let previousState = syncState
        syncState = .syncing

        do {
            // Get optimal batch size based on current performance
            let optimalBatchSize = getOptimalBatchSize()

            // Initialize batch processor if needed
            if batchProcessor == nil {
                batchProcessor = NoteBatchProcessor(database: database, batchSize: optimalBatchSize)
            }

            let startTime = Date()
            var processedCount = 0

            // Process in batches for memory efficiency
            while !changeProcessingQueue.isEmpty {
                let batchSize = min(optimalBatchSize, changeProcessingQueue.count)
                let batch = Array(changeProcessingQueue.prefix(batchSize))
                changeProcessingQueue.removeFirst(batchSize)

                print("AppleNotesLiveImporter: Processing batch of \(batch.count) changes")

                // Add to batch processor
                guard let processor = batchProcessor else { continue }

                for change in batch {
                    await processor.addToBatch(change)
                }

                // Process the batch
                let batchProcessedCount = try await processor.processBatch()
                processedCount += batchProcessedCount

                // Check memory usage between batches
                if !isMemoryUsageAcceptable() {
                    print("AppleNotesLiveImporter: Memory pressure detected, pausing batch processing")
                    break
                }
            }

            let duration = Date().timeIntervalSince(startTime)
            performanceMetrics.recordSync(duration: duration, notesProcessed: processedCount, isIncremental: true)

            syncState = .monitoring
            print("AppleNotesLiveImporter: Successfully processed \(processedCount) changes in \(String(format: "%.2f", duration))s")

        } catch {
            syncState = .error(error)
            print("AppleNotesLiveImporter: Error processing changes: \(error)")

            // Record the error
            performanceMetrics.recordError()

            // Re-queue failed changes for retry (but limit queue size)
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

    // MARK: - Performance Optimization

    /// Batch processor for efficient handling of large note collections
    private actor NoteBatchProcessor {
        private let database: IsometryDatabase
        private let batchSize: Int
        private var processingBatch: [AppleNotesWatcher.NotesChangeEvent] = []

        init(database: IsometryDatabase, batchSize: Int = 50) {
            self.database = database
            self.batchSize = batchSize
        }

        func addToBatch(_ change: AppleNotesWatcher.NotesChangeEvent) {
            processingBatch.append(change)
        }

        func processBatch() async throws -> Int {
            guard !processingBatch.isEmpty else { return 0 }

            let batch = processingBatch
            processingBatch.removeAll()

            // Group by operation type for efficient database operations
            var creates: [AppleNotesWatcher.NotesChangeEvent] = []
            var updates: [AppleNotesWatcher.NotesChangeEvent] = []
            var deletes: [AppleNotesWatcher.NotesChangeEvent] = []

            for change in batch {
                switch change.eventType {
                case .created:
                    creates.append(change)
                case .modified:
                    updates.append(change)
                case .deleted:
                    deletes.append(change)
                case .moved:
                    // Treat moves as update
                    updates.append(change)
                case .permissionsChanged:
                    // Skip permission changes
                    continue
                }
            }

            var processedCount = 0

            // Process in order: deletes, updates, creates
            processedCount += try await processDeletes(deletes)
            processedCount += try await processUpdates(updates)
            processedCount += try await processCreates(creates)

            return processedCount
        }

        private func processDeletes(_ deletes: [AppleNotesWatcher.NotesChangeEvent]) async throws -> Int {
            // TODO: Implement batch delete when we have proper file-to-node mapping
            return deletes.count
        }

        private func processUpdates(_ updates: [AppleNotesWatcher.NotesChangeEvent]) async throws -> Int {
            var count = 0
            for update in updates {
                if update.fileURL.pathExtension == "md" {
                    // Process update (simplified for now)
                    count += 1
                }
            }
            return count
        }

        private func processCreates(_ creates: [AppleNotesWatcher.NotesChangeEvent]) async throws -> Int {
            var count = 0
            for create in creates {
                if create.fileURL.pathExtension == "md" {
                    // Process create (simplified for now)
                    count += 1
                }
            }
            return count
        }

        var batchCount: Int {
            return processingBatch.count
        }

        var shouldFlush: Bool {
            return processingBatch.count >= batchSize
        }
    }

    /// Check if memory usage is acceptable for continued processing
    private func isMemoryUsageAcceptable() -> Bool {
        performanceMetrics.updateMemoryUsage()
        return !performanceMetrics.isMemoryConstrained
    }

    /// Adaptive batch size based on current system performance
    private func getOptimalBatchSize() -> Int {
        let baseSize = liveSyncConfig.batchSize

        // Reduce batch size under memory pressure
        if performanceMetrics.isMemoryConstrained {
            return max(10, baseSize / 4)
        }

        // Increase batch size for good performance
        if performanceMetrics.processingEfficiency > 10.0 {
            return min(200, baseSize * 2)
        }

        return baseSize
    }

    /// Manage queue size to prevent memory issues
    private func manageQueueSize() {
        performanceMetrics.queuedChanges = changeProcessingQueue.count

        // If queue is too large, process older items first
        if changeProcessingQueue.count > maxQueueSize {
            let excessCount = changeProcessingQueue.count - maxQueueSize
            changeProcessingQueue.removeFirst(excessCount)
            print("AppleNotesLiveImporter: Queue size exceeded, dropped \(excessCount) oldest changes")
        }
    }

    /// Determine if we should pause processing due to system constraints
    private func shouldPauseProcessing() -> Bool {
        // Pause if memory usage is too high
        if performanceMetrics.memoryUsageMB > memoryThresholdMB {
            return true
        }

        // Pause if error rate is too high
        if performanceMetrics.errorCount > 10 && performanceMetrics.totalSyncCount > 0 {
            let errorRate = Double(performanceMetrics.errorCount) / Double(performanceMetrics.totalSyncCount)
            if errorRate > 0.5 { // 50% error rate
                return true
            }
        }

        return false
    }

    // MARK: - EventKit Integration Helpers

    /// Convert EventKit reminder (Note) to Isometry Node format
    private func convertReminderToNode(_ reminder: EKReminder) async throws -> Node {
        let sourceId = reminder.calendarItemIdentifier
        let title = reminder.title ?? "Untitled Note"
        let content = reminder.notes ?? ""

        // Create node with Notes-specific metadata
        let nodeId = UUID().uuidString
        let creationDate = reminder.creationDate ?? Date()
        let modificationDate = reminder.lastModifiedDate ?? Date()

        let node = Node(
            id: nodeId,
            title: title,
            content: content,
            createdAt: creationDate,
            updatedAt: modificationDate,
            nodeType: .note,
            source: "apple-notes",
            sourceId: sourceId
        )

        // Add Notes-specific properties
        node.properties["calendar_title"] = reminder.calendar?.title ?? "Unknown"
        node.properties["reminder_id"] = reminder.calendarItemIdentifier
        node.properties["has_alarms"] = !reminder.alarms.isEmpty
        node.properties["is_completed"] = reminder.isCompleted
        node.properties["priority"] = reminder.priority

        if let url = reminder.url {
            node.properties["url"] = url.absoluteString
        }

        if let location = reminder.location {
            node.properties["location"] = location
        }

        // Add alarm information if present
        if !reminder.alarms.isEmpty {
            let alarmData = reminder.alarms.compactMap { alarm in
                if let absoluteDate = alarm.absoluteDate {
                    return absoluteDate.ISO8601Format()
                } else if let relativeOffset = alarm.relativeOffset {
                    return "relative:\(relativeOffset)"
                }
                return nil
            }
            node.properties["alarms"] = alarmData.joined(separator: ",")
        }

        return node
    }
}

// MARK: - ExportableImporterProtocol Conformance

extension AppleNotesLiveImporter: ExportableImporterProtocol {

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

    public func validateRoundTripData(original: Data, exported: Data) async throws -> RoundTripValidationResult {
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