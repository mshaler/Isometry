import Foundation
import CoreServices

/// Real-time file system monitoring for Apple Notes changes using FSEvents
/// Provides efficient change detection with proper resource management and error handling
public actor AppleNotesWatcher {

    // MARK: - Properties

    private let accessManager: NotesAccessManager
    private let debounceInterval: TimeInterval
    private let backgroundQueue = DispatchQueue(label: "com.isometry.notes.watcher", qos: .background)

    // FSEvents monitoring
    private var eventStream: FSEventStreamRef?
    private var isWatching = false
    private var watchedPaths: [String] = []

    // Change detection
    private var lastEventTimestamp: Date = .distantPast
    private var pendingChanges: [NotesChangeEvent] = []
    private var changeHandlers: [(NotesChangeEvent) -> Void] = []

    // Performance monitoring
    private var metrics = WatcherMetrics()

    public init(accessManager: NotesAccessManager, debounceInterval: TimeInterval = 0.1) {
        self.accessManager = accessManager
        self.debounceInterval = debounceInterval
    }

    // MARK: - Change Event Types

    /// Represents a detected change in Notes-related files
    public struct NotesChangeEvent: Sendable {
        public let fileURL: URL
        public let eventType: ChangeEventType
        public let timestamp: Date
        public let metadata: [String: String]
        public let sourceType: ChangeSource

        public init(fileURL: URL, eventType: ChangeEventType, timestamp: Date = Date(), metadata: [String: String] = [:], sourceType: ChangeSource = .unknown) {
            self.fileURL = fileURL
            self.eventType = eventType
            self.timestamp = timestamp
            self.metadata = metadata
            self.sourceType = sourceType
        }
    }

    public enum ChangeEventType: String, Sendable, CaseIterable {
        case created = "created"
        case modified = "modified"
        case deleted = "deleted"
        case moved = "moved"
        case permissionsChanged = "permissions_changed"

        public var isStructuralChange: Bool {
            switch self {
            case .created, .deleted, .moved:
                return true
            case .modified, .permissionsChanged:
                return false
            }
        }
    }

    public enum ChangeSource: String, Sendable, CaseIterable {
        case notesApp = "notes_app"
        case altoIndex = "alto_index"
        case external = "external"
        case unknown = "unknown"

        public var priority: Int {
            switch self {
            case .notesApp: return 3
            case .altoIndex: return 2
            case .external: return 1
            case .unknown: return 0
            }
        }
    }

    // MARK: - Performance Metrics

    public struct WatcherMetrics {
        var totalEventsProcessed: Int = 0
        var eventsPerSecond: Double = 0
        var lastEventTime: Date = .distantPast
        var averageProcessingTime: TimeInterval = 0
        var memoryUsageMB: Double = 0

        mutating func recordEvent(processingTime: TimeInterval) {
            totalEventsProcessed += 1
            lastEventTime = Date()

            if averageProcessingTime == 0 {
                averageProcessingTime = processingTime
            } else {
                averageProcessingTime = (averageProcessingTime * 0.9) + (processingTime * 0.1)
            }

            // Calculate events per second (rough estimate)
            let now = Date()
            if now.timeIntervalSince(lastEventTime) > 0 {
                eventsPerSecond = 1.0 / now.timeIntervalSince(lastEventTime)
            }
        }

        mutating func updateMemoryUsage() {
            var memoryInfo = mach_task_basic_info()
            var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4

            let result = withUnsafeMutablePointer(to: &memoryInfo) {
                $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
                    task_info(mach_task_self_, task_t(MACH_TASK_BASIC_INFO), $0, &count)
                }
            }

            if result == KERN_SUCCESS {
                memoryUsageMB = Double(memoryInfo.resident_size) / 1024.0 / 1024.0
            }
        }
    }

    // MARK: - Watching Control

    /// Start watching for Notes file system changes
    public func startWatching() async throws {
        guard !isWatching else {
            print("AppleNotesWatcher: Already watching")
            return
        }

        // Get monitored paths based on access level
        watchedPaths = await getNotesWatchPaths()

        guard !watchedPaths.isEmpty else {
            throw WatcherError.noPathsToWatch
        }

        print("AppleNotesWatcher: Starting to watch \(watchedPaths.count) paths")
        for path in watchedPaths {
            print("  - \(path)")
        }

        // Create FSEventStream
        try await createEventStream()

        isWatching = true
        print("AppleNotesWatcher: Started successfully")
    }

    /// Stop watching for file system changes
    public func stopWatching() async {
        guard isWatching else {
            print("AppleNotesWatcher: Not currently watching")
            return
        }

        isWatching = false

        // Stop and cleanup FSEventStream
        if let stream = eventStream {
            FSEventStreamStop(stream)
            FSEventStreamInvalidate(stream)
            FSEventStreamRelease(stream)
            eventStream = nil
        }

        // Clear pending changes and handlers
        pendingChanges.removeAll()
        changeHandlers.removeAll()

        print("AppleNotesWatcher: Stopped successfully. Total events processed: \(metrics.totalEventsProcessed)")
    }

    // MARK: - Change Handler Management

    /// Add a handler for change events
    public func addChangeHandler(_ handler: @escaping (NotesChangeEvent) -> Void) {
        changeHandlers.append(handler)
    }

    /// Remove all change handlers
    public func clearChangeHandlers() {
        changeHandlers.removeAll()
    }

    // MARK: - Public Status Interface

    /// Check if currently watching for changes
    public var isCurrentlyWatching: Bool {
        return isWatching
    }

    /// Get current performance metrics
    public var currentMetrics: WatcherMetrics {
        return metrics
    }

    /// Get currently watched paths
    public var currentWatchedPaths: [String] {
        return watchedPaths
    }

    // MARK: - Internal Implementation

    /// Determine paths to watch based on access level and available data
    private func getNotesWatchPaths() async -> [String] {
        var paths: [String] = []

        let accessLevel = await accessManager.getAvailableAccessLevel()

        switch accessLevel {
        case .fullAccess:
            // Watch Notes database paths
            paths.append(contentsOf: getNotesSystemPaths())

        case .readOnly:
            // Watch alto-index export directories
            paths.append(contentsOf: getAltoIndexPaths())

        case .none:
            // No paths to watch
            break
        }

        // Filter to existing, accessible paths
        return paths.filter { path in
            let url = URL(fileURLWithPath: path)
            return FileManager.default.fileExists(atPath: path) && url.hasDirectoryPath
        }
    }

    /// Get system Notes database paths for full access monitoring
    private func getNotesSystemPaths() -> [String] {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        return [
            "\(homeDir)/Library/Group Containers/group.com.apple.notes",
            "\(homeDir)/Library/Containers/com.apple.Notes/Data/Library/Notes",
            "\(homeDir)/Library/Application Support",
        ]
    }

    /// Get alto-index export paths for read-only monitoring
    private func getAltoIndexPaths() -> [String] {
        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path

        return [
            "\(homeDir)/Documents/alto-index",
            "\(homeDir)/Desktop/alto-index",
            "\(homeDir)/Downloads/alto-index",
        ]
    }

    /// Create and start FSEventStream
    private func createEventStream() async throws {
        let pathsToWatch = watchedPaths as CFArray
        let latency: CFTimeInterval = 0.1 // 100ms latency
        let flags: FSEventStreamCreateFlags = UInt32(kFSEventStreamCreateFlagUseCFTypes | kFSEventStreamCreateFlagFileEvents)

        // Create callback context
        var context = FSEventStreamContext()
        context.info = UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque())

        // Create the stream
        eventStream = FSEventStreamCreate(
            nil,
            fseventsCallback,
            &context,
            pathsToWatch,
            FSEventStreamEventId(kFSEventStreamEventIdSinceNow),
            latency,
            flags
        )

        guard let stream = eventStream else {
            throw WatcherError.failedToCreateStream
        }

        // Schedule on background queue
        FSEventStreamSetDispatchQueue(stream, backgroundQueue)

        // Start the stream
        if !FSEventStreamStart(stream) {
            FSEventStreamRelease(stream)
            eventStream = nil
            throw WatcherError.failedToStartStream
        }
    }

    /// Process incoming FSEvents
    internal func handleFSEvent(path: String, flags: FSEventStreamEventFlags) async {
        let startTime = Date()

        // Filter for Notes-related files
        guard isNotesRelatedFile(path: path) else {
            return
        }

        // Convert flags to our event types
        let eventType = convertFSEventFlags(flags)
        let sourceType = determineChangeSource(path: path)

        let changeEvent = NotesChangeEvent(
            fileURL: URL(fileURLWithPath: path),
            eventType: eventType,
            timestamp: Date(),
            metadata: [
                "fsflags": String(flags),
                "raw_path": path
            ],
            sourceType: sourceType
        )

        // Apply debouncing
        let now = Date()
        if now.timeIntervalSince(lastEventTimestamp) < debounceInterval {
            pendingChanges.append(changeEvent)
            return
        }

        // Process the change
        await processChangeEvent(changeEvent)

        // Update metrics
        let processingTime = Date().timeIntervalSince(startTime)
        metrics.recordEvent(processingTime: processingTime)
        metrics.updateMemoryUsage()

        lastEventTimestamp = now
    }

    /// Check if a file path is Notes-related
    private func isNotesRelatedFile(path: String) -> Bool {
        let filename = URL(fileURLWithPath: path).lastPathComponent.lowercased()

        // Notes database files
        if filename.contains("notes") && (filename.hasSuffix(".sqlite") || filename.hasSuffix(".sqlite-wal") || filename.hasSuffix(".sqlite-shm")) {
            return true
        }

        // Alto-index export files
        if filename.hasSuffix(".md") || filename.hasSuffix(".markdown") {
            return true
        }

        // Notes app data files
        if filename.contains("notestore") || filename.contains("notesv7") {
            return true
        }

        return false
    }

    /// Convert FSEvent flags to our event types
    private func convertFSEventFlags(_ flags: FSEventStreamEventFlags) -> ChangeEventType {
        if flags & UInt32(kFSEventStreamEventFlagItemCreated) != 0 {
            return .created
        } else if flags & UInt32(kFSEventStreamEventFlagItemRemoved) != 0 {
            return .deleted
        } else if flags & UInt32(kFSEventStreamEventFlagItemRenamed) != 0 {
            return .moved
        } else if flags & UInt32(kFSEventStreamEventFlagItemChangeOwner) != 0 {
            return .permissionsChanged
        } else {
            return .modified
        }
    }

    /// Determine the source of a change based on file path
    private func determineChangeSource(path: String) -> ChangeSource {
        let pathStr = path.lowercased()

        if pathStr.contains("alto-index") {
            return .altoIndex
        } else if pathStr.contains("notes") && (pathStr.contains("library") || pathStr.contains("group containers")) {
            return .notesApp
        } else {
            return .external
        }
    }

    /// Process a detected change event
    private func processChangeEvent(_ event: NotesChangeEvent) async {
        print("AppleNotesWatcher: Detected change - \(event.eventType.rawValue) at \(event.fileURL.lastPathComponent) from \(event.sourceType.rawValue)")

        // Notify all registered handlers
        for handler in changeHandlers {
            handler(event)
        }

        // Handle coalescing of multiple pending changes
        if !pendingChanges.isEmpty {
            let coalescedEvents = coalesceEvents(pendingChanges + [event])
            pendingChanges.removeAll()

            for coalescedEvent in coalescedEvents {
                for handler in changeHandlers {
                    handler(coalescedEvent)
                }
            }
        }
    }

    /// Coalesce related events to reduce noise
    private func coalesceEvents(_ events: [NotesChangeEvent]) -> [NotesChangeEvent] {
        var eventsByFile: [URL: [NotesChangeEvent]] = [:]

        // Group events by file
        for event in events {
            eventsByFile[event.fileURL, default: []].append(event)
        }

        // Coalesce events for each file
        var coalescedEvents: [NotesChangeEvent] = []

        for (fileURL, fileEvents) in eventsByFile {
            if let finalEvent = coalesceFileEvents(fileURL: fileURL, events: fileEvents) {
                coalescedEvents.append(finalEvent)
            }
        }

        return coalescedEvents.sorted { $0.timestamp < $1.timestamp }
    }

    /// Coalesce multiple events for a single file
    private func coalesceFileEvents(fileURL: URL, events: [NotesChangeEvent]) -> NotesChangeEvent? {
        guard !events.isEmpty else { return nil }

        let sortedEvents = events.sorted { $0.timestamp < $1.timestamp }
        let latestEvent = sortedEvents.last!

        // If there's a deletion, that's the final state
        if sortedEvents.contains(where: { $0.eventType == .deleted }) {
            return NotesChangeEvent(
                fileURL: fileURL,
                eventType: .deleted,
                timestamp: latestEvent.timestamp,
                metadata: latestEvent.metadata,
                sourceType: latestEvent.sourceType
            )
        }

        // If there's a creation followed by modifications, treat as creation
        if sortedEvents.contains(where: { $0.eventType == .created }) {
            return NotesChangeEvent(
                fileURL: fileURL,
                eventType: .created,
                timestamp: latestEvent.timestamp,
                metadata: latestEvent.metadata,
                sourceType: latestEvent.sourceType
            )
        }

        // Otherwise, use the latest event type
        return latestEvent
    }
}

// MARK: - FSEvents Callback

/// Global callback function for FSEvents (required C function pointer)
private func fseventsCallback(
    streamRef: ConstFSEventStreamRef,
    clientCallBackInfo: UnsafeMutableRawPointer?,
    numEvents: Int,
    eventPaths: UnsafeMutableRawPointer,
    eventFlags: UnsafePointer<FSEventStreamEventFlags>,
    eventIds: UnsafePointer<FSEventStreamEventId>
) {
    guard let callbackInfo = clientCallBackInfo else { return }

    let watcher = Unmanaged<AppleNotesWatcher>.fromOpaque(callbackInfo).takeUnretainedValue()

    let paths = unsafeBitCast(eventPaths, to: NSArray.self) as! [String]

    for i in 0..<numEvents {
        let path = paths[i]
        let flags = eventFlags[i]

        Task {
            await watcher.handleFSEvent(path: path, flags: flags)
        }
    }
}

// MARK: - Error Types

public enum WatcherError: Error, LocalizedError {
    case noPathsToWatch
    case failedToCreateStream
    case failedToStartStream
    case permissionDenied
    case systemResourcesUnavailable

    public var errorDescription: String? {
        switch self {
        case .noPathsToWatch:
            return "No accessible paths found to watch for Notes changes"
        case .failedToCreateStream:
            return "Failed to create FSEventStream for file monitoring"
        case .failedToStartStream:
            return "Failed to start FSEventStream"
        case .permissionDenied:
            return "Permission denied for file system monitoring"
        case .systemResourcesUnavailable:
            return "System resources unavailable for file monitoring"
        }
    }
}