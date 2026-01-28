import Foundation
import WebKit
import GRDB

/// Coordinates real-time synchronization between native database and WebView
/// Handles change notifications and conflict resolution
public class SyncCoordinator {

    // MARK: - Types

    public struct DataChange: Codable {
        public let id: String
        public let table: String
        public let operation: String // 'create', 'update', 'delete'
        public let data: [String: AnyCodable]
        public let timestamp: TimeInterval
        public let version: Int
        public let userId: String?
        public let sessionId: String?

        public init(
            id: String,
            table: String,
            operation: String,
            data: [String: Any],
            timestamp: TimeInterval = Date().timeIntervalSince1970,
            version: Int,
            userId: String? = nil,
            sessionId: String? = nil
        ) {
            self.id = id
            self.table = table
            self.operation = operation
            self.data = data.mapValues { AnyCodable($0) }
            self.timestamp = timestamp
            self.version = version
            self.userId = userId
            self.sessionId = sessionId
        }
    }

    public struct SyncState: Codable {
        public let isActive: Bool
        public let lastSync: Date?
        public let pendingChanges: Int
        public let conflictCount: Int

        public init(isActive: Bool, lastSync: Date?, pendingChanges: Int, conflictCount: Int) {
            self.isActive = isActive
            self.lastSync = lastSync
            self.pendingChanges = pendingChanges
            self.conflictCount = conflictCount
        }
    }

    // MARK: - Properties

    private weak var webView: WKWebView?
    private let database: IsometryDatabase
    private var databaseObserver: DatabaseCancellable?
    private var isActive = false

    private var pendingChanges: [String: DataChange] = [:]
    private var conflictCount = 0
    private let syncQueue = DispatchQueue(label: "SyncCoordinator", qos: .background)

    // Configuration
    private let batchDelay: TimeInterval = 0.5 // Batch changes for 500ms
    private let maxBatchSize = 10

    private var batchTimer: Timer?
    private var batchedChanges: [DataChange] = []

    // MARK: - Initialization

    public init(database: IsometryDatabase) {
        self.database = database
    }

    // MARK: - Public API

    /// Start synchronization with WebView
    public func startSync(webView: WKWebView) {
        guard !isActive else { return }

        self.webView = webView
        isActive = true

        // Start observing database changes
        startDatabaseObservation()

        print("[SyncCoordinator] Sync started")
    }

    /// Stop synchronization
    public func stopSync() {
        guard isActive else { return }

        isActive = false
        databaseObserver?.cancel()
        databaseObserver = nil
        webView = nil

        batchTimer?.invalidate()
        batchTimer = nil
        batchedChanges.removeAll()

        print("[SyncCoordinator] Sync stopped")
    }

    /// Notify WebView of database changes
    public func notifyWebViewOfChanges(_ changes: [DataChange]) async {
        guard isActive, let webView = webView else { return }

        let changesData = changes.compactMap { change in
            try? JSONEncoder().encode(change)
        }

        let changesJSON = changesData.compactMap { data in
            String(data: data, encoding: .utf8)
        }

        if !changesJSON.isEmpty {
            let script = """
                if (window._isometryBridge && window._isometryBridge.handleSyncChanges) {
                    window._isometryBridge.handleSyncChanges(\(changesJSON));
                } else {
                    window.dispatchEvent(new CustomEvent('isometry-sync-changes', {
                        detail: \(changesJSON)
                    }));
                }
                """

            await MainActor.run {
                webView.evaluateJavaScript(script) { _, error in
                    if let error = error {
                        print("[SyncCoordinator] Failed to notify WebView: \(error)")
                    }
                }
            }
        }
    }

    /// Handle incoming change from WebView
    public func handleWebViewChange(_ change: DataChange) async {
        syncQueue.async { [weak self] in
            guard let self = self else { return }

            // Check for conflicts
            if let existingChange = self.pendingChanges[change.id] {
                self.handleConflict(local: existingChange, remote: change)
                return
            }

            // Apply change to database
            Task {
                await self.applyChange(change)
            }
        }
    }

    /// Get current sync state
    public func getSyncState() -> SyncState {
        return SyncState(
            isActive: isActive,
            lastSync: Date(), // Could track actual last sync
            pendingChanges: pendingChanges.count,
            conflictCount: conflictCount
        )
    }

    // MARK: - Database Observation

    private func startDatabaseObservation() {
        Task {
            let pool = await database.getDatabasePool()
            databaseObserver = DatabaseRegionObservation(tracking: .fullDatabase)
                .start(in: pool, onError: { error in
                    print("[SyncCoordinator] Database observation error: \(error)")
                }, onChange: { [weak self] _ in
                    // This is called on database changes
                    Task { [weak self] in
                        await self?.handleDatabaseChange()
                    }
                })
        }
    }

    private func handleDatabaseChange() async {
        // For now, we'll detect changes by comparing timestamps
        // In a production system, you'd want more sophisticated change tracking
        print("[SyncCoordinator] Database change detected")

        // Get recent changes (simplified - in production you'd have better change tracking)
        do {
            let recentNodes = try await database.getAllNodes() // Simplified approach

            let changes = recentNodes.map { node in
                DataChange(
                    id: node.id,
                    table: "nodes",
                    operation: "update",
                    data: [
                        "id": node.id,
                        "name": node.name,
                        "content": node.content,
                        "modified_at": node.modifiedAt.timeIntervalSince1970
                    ],
                    version: node.version
                )
            }

            if !changes.isEmpty {
                await batchChanges(changes)
            }

        } catch {
            print("[SyncCoordinator] Error fetching recent changes: \(error)")
        }
    }

    // MARK: - Change Batching

    private func batchChanges(_ changes: [DataChange]) async {
        await MainActor.run {
            batchedChanges.append(contentsOf: changes)

            // Reset timer
            batchTimer?.invalidate()
            batchTimer = Timer.scheduledTimer(withTimeInterval: batchDelay, repeats: false) { [weak self] _ in
                Task {
                    await self?.flushBatchedChanges()
                }
            }

            // Immediate flush if batch is large
            if batchedChanges.count >= maxBatchSize {
                batchTimer?.invalidate()
                Task {
                    await self.flushBatchedChanges()
                }
            }
        }
    }

    private func flushBatchedChanges() async {
        let changesToSend = await MainActor.run {
            let changes = batchedChanges
            batchedChanges.removeAll()
            return changes
        }

        if !changesToSend.isEmpty {
            await notifyWebViewOfChanges(changesToSend)
        }
    }

    // MARK: - Change Application

    private func applyChange(_ change: DataChange) async {
        do {
            switch (change.table, change.operation) {
            case ("nodes", "create"):
                let node = try parseNodeFromChange(change)
                try await database.createNode(node)

            case ("nodes", "update"):
                let node = try parseNodeFromChange(change)
                try await database.updateNode(node)

            case ("nodes", "delete"):
                try await database.deleteNode(id: change.id)

            case ("notebook_cards", "create"):
                let card = try parseNotebookCardFromChange(change)
                try await database.createNotebookCard(card)

            case ("notebook_cards", "update"):
                let card = try parseNotebookCardFromChange(change)
                try await database.updateNotebookCard(card)

            case ("notebook_cards", "delete"):
                try await database.deleteNotebookCard(id: change.id)

            default:
                print("[SyncCoordinator] Unsupported operation: \(change.table).\(change.operation)")
            }

            // Remove from pending
            pendingChanges.removeValue(forKey: change.id)

        } catch {
            print("[SyncCoordinator] Failed to apply change: \(error)")
        }
    }

    // MARK: - Conflict Resolution

    private func handleConflict(local: DataChange, remote: DataChange) {
        conflictCount += 1
        print("[SyncCoordinator] Conflict detected: \(local.id)")

        // Simple timestamp-based resolution (remote wins if newer)
        let winningChange = remote.timestamp > local.timestamp ? remote : local

        Task {
            await applyChange(winningChange)
        }
    }

    // MARK: - Parsing Helpers

    private func parseNodeFromChange(_ change: DataChange) throws -> Node {
        let data = change.data.mapValues { $0.value }

        guard let id = data["id"] as? String,
              let name = data["name"] as? String,
              let content = data["content"] as? String else {
            throw SyncCoordinationError.invalidChangeData("Missing required node fields")
        }

        let nodeType = data["nodeType"] as? String ?? "note"
        let source = data["source"] as? String ?? "sync"
        let sourceId = data["sourceId"] as? String
        let folder = data["folder"] as? String
        let tags = data["tags"] as? [String] ?? []
        let priority = data["priority"] as? Int ?? 0

        return Node(
            id: id,
            nodeType: nodeType,
            name: name,
            content: content,
            folder: folder,
            tags: tags,
            priority: priority,
            source: source,
            sourceId: sourceId
        )
    }

    private func parseNotebookCardFromChange(_ change: DataChange) throws -> NotebookCard {
        let data = change.data.mapValues { $0.value }

        guard let title = data["title"] as? String else {
            throw SyncCoordinationError.invalidChangeData("Missing required notebook card fields")
        }

        let properties = data["properties"] as? [String: String] ?? [:]
        let tags = data["tags"] as? [String] ?? []
        let markdownContent = data["markdownContent"] as? String ?? ""
        let folder = data["folder"] as? String

        return NotebookCard(
            title: title,
            markdownContent: markdownContent,
            properties: properties,
            folder: folder,
            tags: tags
        )
    }
}

// MARK: - Supporting Types

/// Codable wrapper for any value
public struct AnyCodable: Codable, Sendable {
    public let value: Any

    public init(_ value: Any) {
        self.value = value
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let intValue = try? container.decode(Int.self) {
            value = intValue
        } else if let doubleValue = try? container.decode(Double.self) {
            value = doubleValue
        } else if let stringValue = try? container.decode(String.self) {
            value = stringValue
        } else if let boolValue = try? container.decode(Bool.self) {
            value = boolValue
        } else if let arrayValue = try? container.decode([AnyCodable].self) {
            value = arrayValue.map { $0.value }
        } else if let dictValue = try? container.decode([String: AnyCodable].self) {
            value = dictValue.mapValues { $0.value }
        } else {
            throw DecodingError.typeMismatch(AnyCodable.self, DecodingError.Context(
                codingPath: decoder.codingPath,
                debugDescription: "Could not decode AnyCodable"
            ))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()

        switch value {
        case let intValue as Int:
            try container.encode(intValue)
        case let doubleValue as Double:
            try container.encode(doubleValue)
        case let stringValue as String:
            try container.encode(stringValue)
        case let boolValue as Bool:
            try container.encode(boolValue)
        case let arrayValue as [Any]:
            try container.encode(arrayValue.map { AnyCodable($0) })
        case let dictValue as [String: Any]:
            try container.encode(dictValue.mapValues { AnyCodable($0) })
        default:
            throw EncodingError.invalidValue(value, EncodingError.Context(
                codingPath: encoder.codingPath,
                debugDescription: "Could not encode AnyCodable"
            ))
        }
    }
}


public enum SyncCoordinationError: Error {
    case invalidChangeData(String)
    case conflictResolution(String)
    case databaseError(String)

    public var localizedDescription: String {
        switch self {
        case .invalidChangeData(let message):
            return "Invalid change data: \(message)"
        case .conflictResolution(let message):
            return "Conflict resolution failed: \(message)"
        case .databaseError(let message):
            return "Database error: \(message)"
        }
    }
}