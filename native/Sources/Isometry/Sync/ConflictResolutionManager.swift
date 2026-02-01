import Foundation
import GRDB
import CloudKit

/// CRDT-based conflict resolution manager for multi-device coordination
/// Integrates with existing IsometryDatabase and provides database-level conflict resolution
/// without requiring central coordination or external dependencies
public actor ConflictResolutionManager {

    // MARK: - Dependencies

    private let database: IsometryDatabase
    private let deviceId: String
    private let conflictResolver: ConflictResolver

    // MARK: - Configuration

    /// Maximum time to wait for conflict resolution (30 seconds)
    private let resolutionTimeout: TimeInterval = 30.0

    /// Batch size for conflict processing
    private let conflictBatchSize = 10

    // MARK: - State

    private var isProcessing = false
    private var conflictQueue: [(local: Node, remote: Node, localCRDT: CRDTNode, remoteCRDT: CRDTNode)] = []

    // MARK: - Initialization

    public init(database: IsometryDatabase, deviceId: String) {
        self.database = database
        self.deviceId = deviceId
        self.conflictResolver = ConflictResolver(database: database, deviceId: deviceId)
    }

    // MARK: - Public API

    /// Detects conflicts by comparing CRDT metadata during sync operations
    /// Integrates with existing database transaction patterns
    public func detectConflicts() async throws -> [ConflictInfo] {
        return try await database.read { db in
            let sql = """
                SELECT
                    n.id,
                    n.name,
                    n.content,
                    n.summary,
                    n.folder,
                    n.tags,
                    n.status,
                    n.priority,
                    n.importance,
                    n.created_at,
                    n.modified_at,
                    n.sync_version,
                    n.last_synced_at,
                    c.site_id,
                    c.column_version,
                    c.db_version,
                    c.last_write_wins,
                    c.content_hash,
                    c.modified_fields,
                    c.conflict_resolved_at
                FROM nodes n
                INNER JOIN crdt_metadata c ON n.id = c.node_id
                WHERE n.last_synced_at IS NULL
                   OR n.modified_at > n.last_synced_at
                   OR EXISTS (
                       SELECT 1 FROM pending_conflicts pc
                       WHERE pc.node_id = n.id
                   )
                """

            let rows = try Row.fetchAll(db, sql: sql)
            var conflicts: [ConflictInfo] = []

            for row in rows {
                let nodeId: String = row["id"]
                let localCRDT = try parseCRDTFromRow(row)

                // Check if this node has conflicts with other devices
                let conflictSql = """
                    SELECT COUNT(*) as conflict_count
                    FROM crdt_sync_metadata sm
                    WHERE sm.node_id = ?
                      AND sm.device_version != ?
                      AND sm.last_seen_at > datetime('now', '-5 minutes')
                    """

                let conflictCount = try Int.fetchOne(db, sql: conflictSql, arguments: [nodeId, localCRDT.columnVersion]) ?? 0

                if conflictCount > 0 {
                    let localNode = try parseNodeFromRow(row)

                    // For CRDT conflicts, we need both versions - simulate remote for now
                    // In real sync, this would come from CloudKit or other sync source
                    let conflict = ConflictInfo(
                        nodeId: nodeId,
                        localRecord: try nodeToRecord(localNode),
                        serverRecord: try nodeToRecord(localNode), // Would be actual remote
                        conflictType: .fieldConflict,
                        detectedAt: Date(),
                        fields: localCRDT.modifiedFields
                    )
                    conflicts.append(conflict)
                }
            }

            return conflicts
        }
    }

    /// Resolves conflicts automatically for simple cases and queues complex ones
    /// Uses CRDT resolution rules without requiring external coordination
    public func resolveConflicts() async throws -> [ConflictResolution] {
        guard !isProcessing else {
            throw ConflictResolutionError.alreadyProcessing
        }

        isProcessing = true
        defer { isProcessing = false }

        var resolutions: [ConflictResolution] = []

        // Get pending conflicts from database
        let conflicts = try await getPendingConflictsFromDatabase()

        // Process in batches to avoid overwhelming the system
        for conflictBatch in conflicts.chunked(into: conflictBatchSize) {
            let batchResolutions = try await processBatch(conflictBatch)
            resolutions.append(contentsOf: batchResolutions)
        }

        return resolutions
    }

    /// Merges changes from multiple devices using CRDT algorithms
    /// Handles non-conflicting updates automatically and preserves user selections
    public func mergeChanges(nodeId: String, changes: [Node]) async throws -> Node? {
        guard !changes.isEmpty else { return nil }

        if changes.count == 1 {
            return changes.first
        }

        // Get CRDT metadata for all versions
        let crdtMetadata = try await getCRDTMetadata(for: nodeId)

        // Start with the most recent version as base
        let sortedChanges = changes.sorted { first, second in
            first.modifiedAt > second.modifiedAt
        }

        var merged = sortedChanges.first!

        // Apply changes from other versions using CRDT merge rules
        for change in sortedChanges.dropFirst() {
            merged = try await mergeNodes(base: merged, incoming: change, crdtData: crdtMetadata)
        }

        // Update CRDT metadata for merged result
        try await updateCRDTMetadata(for: merged, deviceId: deviceId)

        return merged
    }

    // MARK: - Database Integration

    /// Gets pending conflicts from database queue
    private func getPendingConflictsFromDatabase() async throws -> [(local: Node, remote: Node, localCRDT: CRDTNode, remoteCRDT: CRDTNode)] {
        return try await database.read { db in
            let sql = """
                SELECT
                    pc.id,
                    pc.local_data,
                    pc.server_data,
                    pc.conflicted_fields,
                    n.id as node_id
                FROM pending_conflicts pc
                INNER JOIN nodes n ON pc.node_id = n.id
                ORDER BY pc.detected_at ASC
                LIMIT ?
                """

            let rows = try Row.fetchAll(db, sql: sql, arguments: [conflictBatchSize])
            var conflicts: [(local: Node, remote: Node, localCRDT: CRDTNode, remoteCRDT: CRDTNode)] = []

            for row in rows {
                if let localData = row["local_data"] as? String,
                   let serverData = row["server_data"] as? String,
                   let localNode = try? decodeNodeFromJSON(localData),
                   let remoteNode = try? decodeNodeFromJSON(serverData) {

                    // Get CRDT metadata for both versions
                    let localCRDT = try getCRDTNode(for: localNode.id, siteId: "device_\(deviceId)")
                    let remoteCRDT = try getCRDTNode(for: remoteNode.id, siteId: "device_remote") // Would be actual remote device

                    conflicts.append((local: localNode, remote: remoteNode, localCRDT: localCRDT, remoteCRDT: remoteCRDT))
                }
            }

            return conflicts
        }
    }

    /// Processes a batch of conflicts using CRDT resolution
    private func processBatch(_ conflicts: [(local: Node, remote: Node, localCRDT: CRDTNode, remoteCRDT: CRDTNode)]) async throws -> [ConflictResolution] {
        var resolutions: [ConflictResolution] = []

        for conflict in conflicts {
            do {
                let resolution = try await conflictResolver.resolveConflict(
                    local: conflict.local,
                    remote: conflict.remote,
                    localCRDT: conflict.localCRDT,
                    remoteCRDT: conflict.remoteCRDT,
                    strategy: .lastWriteWins // Default strategy
                )

                if !resolution.needsManualResolution {
                    // Apply automatic resolution
                    try await applyResolution(resolution)
                }

                resolutions.append(resolution)

            } catch {
                print("ConflictResolutionManager: Failed to resolve conflict for \(conflict.local.id): \(error)")
            }
        }

        return resolutions
    }

    /// Applies a resolved conflict to the database
    private func applyResolution(_ resolution: ConflictResolution) async throws {
        guard let resolvedNode = resolution.resolvedNode else {
            throw ConflictResolutionError.noResolution
        }

        try await database.write { db in
            // Update the node
            try resolvedNode.save(db)

            // Update CRDT metadata
            try db.execute(sql: """
                UPDATE crdt_metadata SET
                    column_version = column_version + 1,
                    db_version = ?,
                    last_write_wins = datetime('now'),
                    content_hash = ?,
                    modified_fields = '[]',
                    conflict_resolved_at = datetime('now')
                WHERE node_id = ?
                """, arguments: [
                    resolution.resolvedNode?.syncVersion ?? 0,
                    computeContentHash(for: resolvedNode),
                    resolvedNode.id
                ])

            // Remove from pending conflicts
            try db.execute(sql: """
                DELETE FROM pending_conflicts WHERE node_id = ?
                """, arguments: [resolvedNode.id])

            // Record resolution history
            try db.execute(sql: """
                INSERT INTO conflict_history (
                    id, node_id, strategy, winner_site_id,
                    local_version, server_version, resolved_at,
                    resolution_details
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
                """, arguments: [
                    UUID().uuidString,
                    resolvedNode.id,
                    resolution.strategy.rawValue,
                    resolution.winnerSiteId,
                    resolvedNode.version,
                    resolvedNode.syncVersion,
                    try encodeToJSON(resolution.resolutionMetadata)
                ])
        }
    }

    // MARK: - CRDT Operations

    /// Gets CRDT metadata for a node
    private func getCRDTMetadata(for nodeId: String) async throws -> [String: CRDTNode] {
        return try await database.read { db in
            let sql = """
                SELECT * FROM crdt_metadata WHERE node_id = ?
                """

            let rows = try Row.fetchAll(db, sql: sql, arguments: [nodeId])
            var metadata: [String: CRDTNode] = [:]

            for row in rows {
                let crdt = try parseCRDTFromRow(row)
                metadata[crdt.siteId] = crdt
            }

            return metadata
        }
    }

    /// Gets CRDT node for specific site
    private func getCRDTNode(for nodeId: String, siteId: String) throws -> CRDTNode {
        // Create default CRDT node - in real implementation would fetch from metadata
        return CRDTNode(
            id: nodeId,
            siteId: siteId,
            columnVersion: 1,
            dbVersion: 1,
            lastWriteWins: Date(),
            contentHash: "",
            modifiedFields: []
        )
    }

    /// Updates CRDT metadata after merge
    private func updateCRDTMetadata(for node: Node, deviceId: String) async throws {
        try await database.write { db in
            try db.execute(sql: """
                UPDATE crdt_metadata SET
                    column_version = column_version + 1,
                    db_version = db_version + 1,
                    last_write_wins = datetime('now'),
                    content_hash = ?,
                    modified_fields = '[]'
                WHERE node_id = ? AND site_id = ?
                """, arguments: [
                    computeContentHash(for: node),
                    node.id,
                    "device_\(deviceId)"
                ])
        }
    }

    /// Merges two nodes using CRDT rules
    private func mergeNodes(base: Node, incoming: Node, crdtData: [String: CRDTNode]) async throws -> Node {
        var merged = base

        // Apply field-level merges based on CRDT timestamps
        if let baseCRDT = crdtData.values.first(where: { $0.siteId.contains(deviceId) }),
           let incomingCRDT = crdtData.values.first(where: { !$0.siteId.contains(deviceId) }) {

            // Merge non-conflicting fields
            if incoming.name != base.name {
                merged.name = baseCRDT.lastWriteWins > incomingCRDT.lastWriteWins ? base.name : incoming.name
            }

            if incoming.content != base.content {
                merged.content = baseCRDT.lastWriteWins > incomingCRDT.lastWriteWins ? base.content : incoming.content
            }

            // Merge tags using union (CRDT set semantics)
            let mergedTags = Set(base.tags).union(Set(incoming.tags))
            merged.tags = Array(mergedTags).sorted()

            // Use latest for other fields
            merged.priority = baseCRDT.lastWriteWins > incomingCRDT.lastWriteWins ? base.priority : incoming.priority
            merged.importance = baseCRDT.lastWriteWins > incomingCRDT.lastWriteWins ? base.importance : incoming.importance
            merged.status = baseCRDT.lastWriteWins > incomingCRDT.lastWriteWins ? base.status : incoming.status
        }

        // Update sync metadata
        merged.syncVersion = max(base.syncVersion, incoming.syncVersion) + 1
        merged.conflictResolvedAt = Date()

        return merged
    }

    // MARK: - Utility Functions

    /// Parses CRDT metadata from database row
    private func parseCRDTFromRow(_ row: Row) throws -> CRDTNode {
        let modifiedFieldsData = (row["modified_fields"] as? String) ?? "[]"
        let modifiedFields = try JSONDecoder().decode([String].self, from: modifiedFieldsData.data(using: .utf8)!)

        return CRDTNode(
            id: row["id"] ?? row["node_id"],
            siteId: row["site_id"],
            columnVersion: UInt64(row["column_version"]),
            dbVersion: UInt64(row["db_version"]),
            lastWriteWins: Date(timeIntervalSince1970: row["last_write_wins"]),
            contentHash: row["content_hash"],
            modifiedFields: modifiedFields
        )
    }

    /// Parses node from database row
    private func parseNodeFromRow(_ row: Row) throws -> Node {
        let tagsData = (row["tags"] as? String) ?? "[]"
        let tags = try JSONDecoder().decode([String].self, from: tagsData.data(using: .utf8)!)

        return Node(
            id: row["id"],
            nodeType: "note",
            name: row["name"],
            content: row["content"],
            summary: row["summary"],
            createdAt: Date(timeIntervalSince1970: row["created_at"]),
            modifiedAt: Date(timeIntervalSince1970: row["modified_at"]),
            folder: row["folder"],
            tags: tags,
            status: row["status"],
            priority: row["priority"] ?? 0,
            importance: row["importance"] ?? 0,
            version: 1,
            syncVersion: row["sync_version"] ?? 0,
            lastSyncedAt: row["last_synced_at"].map { Date(timeIntervalSince1970: $0) }
        )
    }

    /// Converts node to CloudKit record for compatibility
    private func nodeToRecord(_ node: Node) throws -> CKRecord {
        let recordID = CKRecord.ID(recordName: node.id)
        let record = CKRecord(recordType: "Node", recordID: recordID)

        record["name"] = node.name
        record["content"] = node.content
        record["summary"] = node.summary
        record["folder"] = node.folder
        record["status"] = node.status
        record["priority"] = node.priority
        record["importance"] = node.importance
        record["syncVersion"] = node.syncVersion
        record["modifiedAt"] = node.modifiedAt
        record["tags"] = node.tags

        return record
    }

    /// Computes content hash for CRDT comparison
    private func computeContentHash(for node: Node) -> String {
        let contentString = "\(node.name)|\(node.content ?? "")|\(node.summary ?? "")|\(node.folder ?? "")"
        return String(contentString.hash)
    }

    /// Decodes node from JSON string
    private func decodeNodeFromJSON(_ json: String) throws -> Node {
        let data = json.data(using: .utf8)!
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Node.self, from: data)
    }

    /// Encodes object to JSON string
    private func encodeToJSON<T: Codable>(_ object: T) throws -> String {
        let encoder = JSONEncoder()
        let data = try encoder.encode(object)
        return String(data: data, encoding: .utf8) ?? "{}"
    }
}

// MARK: - Error Types

public enum ConflictResolutionError: LocalizedError {
    case alreadyProcessing
    case noResolution
    case invalidCRDTData

    public var errorDescription: String? {
        switch self {
        case .alreadyProcessing:
            return "Conflict resolution already in progress"
        case .noResolution:
            return "No resolution provided for conflict"
        case .invalidCRDTData:
            return "Invalid CRDT metadata"
        }
    }
}

// MARK: - Collection Extension

extension Collection {
    func chunked(into size: Int) -> [[Element]] {
        return stride(from: 0, to: count, by: size).map {
            Array(self[index(startIndex, offsetBy: $0)..<index(startIndex, offsetBy: min($0 + size, count))])
        }
    }
}