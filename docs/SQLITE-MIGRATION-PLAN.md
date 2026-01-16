# SQLite Migration Plan: FTS5, iCloud Sync, and Graph Analytics

## Overview

This document outlines the migration from sql.js (WASM + IndexedDB) to native SQLite with FTS5 full-text search, iCloud sync via CloudKit, and graph analytics using recursive CTEs.

## Current State

```
┌─────────────────────────────────────────┐
│           Browser (React)               │
│  ┌─────────────┐    ┌───────────────┐  │
│  │   sql.js    │───▶│   IndexedDB   │  │
│  │   (WASM)    │    │  (persistence)│  │
│  └─────────────┘    └───────────────┘  │
│         │                               │
│  ┌──────▼──────┐                       │
│  │ CDN sql.js  │ ❌ No FTS5            │
│  │ (limited)   │ ❌ No iCloud          │
│  └─────────────┘ ⚠️ Slow graph queries │
└─────────────────────────────────────────┘
```

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ React Web    │  │  iOS App     │  │  macOS App           │  │
│  │ (PWA)        │  │ (SwiftUI)    │  │  (SwiftUI/Catalyst)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │               │
│         ▼                 ▼                      ▼               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Unified Data Layer (Swift/TS)               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐  │   │
│  │  │ Nodes   │  │ Edges   │  │  FTS5   │  │ Graph CTEs │  │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                      Storage Layer                                │
│  ┌──────────────────────┐         ┌──────────────────────────┐   │
│  │   Local SQLite       │◀───────▶│      iCloud Sync         │   │
│  │   (iOS/macOS)        │         │   (CloudKit + CKSync)    │   │
│  │   ┌────────────────┐ │         │   ┌──────────────────┐   │   │
│  │   │ isometry.db    │ │         │   │  CKRecord zones  │   │   │
│  │   │ ├─ nodes       │ │         │   │  ├─ nodes        │   │   │
│  │   │ ├─ edges       │ │         │   │  ├─ edges        │   │   │
│  │   │ ├─ nodes_fts   │ │         │   │  └─ sync_state   │   │   │
│  │   │ └─ sync_state  │ │         │   └──────────────────┘   │   │
│  │   └────────────────┘ │         └──────────────────────────┘   │
│  └──────────────────────┘                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Schema Migration (FTS5 + Graph Support)

### 1.1 Updated Schema

```sql
-- schema-v2.sql
-- ============================================================================
-- Isometry SQLite Schema v2
-- With FTS5 full-text search and optimized graph queries
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Nodes: Primary data table
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL DEFAULT 'note',
    name TEXT NOT NULL,
    content TEXT,
    summary TEXT,

    -- LATCH: Location
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    location_address TEXT,

    -- LATCH: Time
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    due_at TEXT,
    completed_at TEXT,
    event_start TEXT,
    event_end TEXT,

    -- LATCH: Category
    folder TEXT,
    tags TEXT,  -- JSON array
    status TEXT,

    -- LATCH: Hierarchy
    priority INTEGER DEFAULT 0,
    importance INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,

    -- Metadata
    source TEXT,
    source_id TEXT,
    source_url TEXT,
    deleted_at TEXT,
    version INTEGER DEFAULT 1,

    -- Sync metadata
    sync_version INTEGER DEFAULT 0,
    last_synced_at TEXT,
    conflict_resolved_at TEXT
);

-- Indexes for LATCH filtering
CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder);
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source ON nodes(source, source_id) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_sync ON nodes(sync_version, last_synced_at);

-- FTS5 Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    content,
    tags,
    folder,
    content='nodes',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- FTS sync triggers
CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    INSERT INTO nodes_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

-- Edges: Relationships (GRAPH)
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    edge_type TEXT NOT NULL,  -- LINK, NEST, SEQUENCE, AFFINITY
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    label TEXT,
    weight REAL DEFAULT 1.0,
    directed INTEGER DEFAULT 1,
    sequence_order INTEGER,
    channel TEXT,
    timestamp TEXT,
    subject TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    -- Sync metadata
    sync_version INTEGER DEFAULT 0,

    UNIQUE(source_id, target_id, edge_type)
);

-- Graph query indexes
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON edges(weight DESC);

-- Sync state tracking
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_sync_token TEXT,
    last_sync_at TEXT,
    pending_changes INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO sync_state (id) VALUES ('default');
```

### 1.2 Graph Query Functions

```sql
-- graph-queries.sql
-- Reusable graph query patterns using recursive CTEs

-- Find all nodes connected to a source (BFS traversal)
-- Usage: Replace ? with source node ID and depth limit
WITH RECURSIVE connected(id, depth, path) AS (
    -- Base case: start node
    SELECT ?, 0, ?

    UNION ALL

    -- Recursive case: follow edges
    SELECT
        CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END,
        c.depth + 1,
        c.path || ',' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END
    FROM connected c
    JOIN edges e ON (e.source_id = c.id OR (e.directed = 0 AND e.target_id = c.id))
    WHERE c.depth < ?  -- max depth parameter
    AND c.path NOT LIKE '%' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END || '%'
)
SELECT DISTINCT n.*, c.depth
FROM connected c
JOIN nodes n ON n.id = c.id
WHERE n.deleted_at IS NULL
ORDER BY c.depth, n.name;

-- Find shortest path between two nodes
WITH RECURSIVE paths(id, depth, path, found) AS (
    SELECT ?, 0, ?, 0

    UNION ALL

    SELECT
        CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
        p.depth + 1,
        p.path || ',' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
        CASE WHEN CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END = ? THEN 1 ELSE 0 END
    FROM paths p
    JOIN edges e ON (e.source_id = p.id OR (e.directed = 0 AND e.target_id = p.id))
    WHERE p.found = 0 AND p.depth < 10
    AND p.path NOT LIKE '%' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END || '%'
)
SELECT path, depth FROM paths WHERE found = 1 ORDER BY depth LIMIT 1;

-- Calculate node importance (inbound link count)
SELECT
    n.id,
    n.name,
    COUNT(DISTINCT e.id) as inbound_links,
    SUM(e.weight) as weighted_importance
FROM nodes n
LEFT JOIN edges e ON e.target_id = n.id
WHERE n.deleted_at IS NULL
GROUP BY n.id
ORDER BY weighted_importance DESC;

-- Find clusters (nodes with shared connections)
WITH node_connections AS (
    SELECT
        source_id as node_id,
        GROUP_CONCAT(target_id) as connections
    FROM edges
    GROUP BY source_id
)
SELECT
    n1.id as node1,
    n2.id as node2,
    -- Jaccard similarity of connections
    (
        SELECT COUNT(*) FROM (
            SELECT target_id FROM edges WHERE source_id = n1.id
            INTERSECT
            SELECT target_id FROM edges WHERE source_id = n2.id
        )
    ) * 1.0 / (
        SELECT COUNT(*) FROM (
            SELECT target_id FROM edges WHERE source_id = n1.id
            UNION
            SELECT target_id FROM edges WHERE source_id = n2.id
        )
    ) as similarity
FROM nodes n1, nodes n2
WHERE n1.id < n2.id
AND n1.deleted_at IS NULL AND n2.deleted_at IS NULL
HAVING similarity > 0.3
ORDER BY similarity DESC;
```

---

## Phase 2: iOS/macOS Native Layer

### 2.1 Swift Database Manager

```swift
// Sources/Database/IsometryDatabase.swift

import Foundation
import SQLite3
import Combine

/// Thread-safe SQLite database manager with FTS5 and graph query support
@MainActor
public final class IsometryDatabase: ObservableObject {

    public static let shared = IsometryDatabase()

    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "com.isometry.database", qos: .userInitiated)

    @Published public private(set) var isReady = false
    @Published public private(set) var lastError: DatabaseError?

    // MARK: - Initialization

    private init() {}

    public func initialize(at url: URL? = nil) async throws {
        let dbURL = url ?? Self.defaultDatabaseURL

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            queue.async { [weak self] in
                guard let self else {
                    continuation.resume(throwing: DatabaseError.deallocated)
                    return
                }

                do {
                    // Create directory if needed
                    try FileManager.default.createDirectory(
                        at: dbURL.deletingLastPathComponent(),
                        withIntermediateDirectories: true
                    )

                    // Open database
                    var db: OpaquePointer?
                    let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX

                    guard sqlite3_open_v2(dbURL.path, &db, flags, nil) == SQLITE_OK else {
                        throw DatabaseError.openFailed(String(cString: sqlite3_errmsg(db)))
                    }

                    self.db = db

                    // Enable WAL mode and foreign keys
                    try self.execute("PRAGMA journal_mode = WAL")
                    try self.execute("PRAGMA foreign_keys = ON")

                    // Run migrations
                    try self.runMigrations()

                    Task { @MainActor in
                        self.isReady = true
                    }

                    continuation.resume()
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    // MARK: - Default Paths

    public static var defaultDatabaseURL: URL {
        let container = FileManager.default.url(
            forUbiquityContainerIdentifier: nil
        ) ?? FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!

        return container
            .appendingPathComponent("Documents", isDirectory: true)
            .appendingPathComponent("isometry.db")
    }

    // MARK: - Query Execution

    public func execute(_ sql: String, parameters: [Any?] = []) throws {
        try queue.sync {
            guard let db else { throw DatabaseError.notInitialized }

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(statement) }

            try bindParameters(statement, parameters)

            guard sqlite3_step(statement) == SQLITE_DONE else {
                throw DatabaseError.executeFailed(String(cString: sqlite3_errmsg(db)))
            }
        }
    }

    public func query<T: Decodable>(_ sql: String, parameters: [Any?] = []) throws -> [T] {
        try queue.sync {
            guard let db else { throw DatabaseError.notInitialized }

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
                throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
            }
            defer { sqlite3_finalize(statement) }

            try bindParameters(statement, parameters)

            var results: [T] = []
            let decoder = SQLiteRowDecoder()

            while sqlite3_step(statement) == SQLITE_ROW {
                let row = extractRow(statement)
                let item = try decoder.decode(T.self, from: row)
                results.append(item)
            }

            return results
        }
    }

    // MARK: - FTS5 Search

    public func search(_ query: String, limit: Int = 50) throws -> [Node] {
        // Escape FTS5 special characters and add prefix matching
        let sanitized = query
            .replacingOccurrences(of: "\"", with: "\"\"")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        let ftsQuery = sanitized
            .split(separator: " ")
            .map { "\"\($0)\"*" }
            .joined(separator: " ")

        let sql = """
            SELECT n.*,
                   bm25(nodes_fts, 1.0, 0.75, 0.5, 0.25) as rank
            FROM nodes_fts
            JOIN nodes n ON nodes_fts.rowid = n.rowid
            WHERE nodes_fts MATCH ?
            AND n.deleted_at IS NULL
            ORDER BY rank
            LIMIT ?
            """

        return try query(sql, parameters: [ftsQuery, limit])
    }

    // MARK: - Graph Queries

    public func connectedNodes(from nodeId: String, maxDepth: Int = 3) throws -> [NodeWithDepth] {
        let sql = """
            WITH RECURSIVE connected(id, depth, path) AS (
                SELECT ?, 0, ?
                UNION ALL
                SELECT
                    CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END,
                    c.depth + 1,
                    c.path || ',' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END
                FROM connected c
                JOIN edges e ON (e.source_id = c.id OR (e.directed = 0 AND e.target_id = c.id))
                WHERE c.depth < ?
                AND c.path NOT LIKE '%' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END || '%'
            )
            SELECT DISTINCT n.*, c.depth
            FROM connected c
            JOIN nodes n ON n.id = c.id
            WHERE n.deleted_at IS NULL
            ORDER BY c.depth, n.name
            """

        return try query(sql, parameters: [nodeId, nodeId, maxDepth])
    }

    public func shortestPath(from sourceId: String, to targetId: String) throws -> [String]? {
        let sql = """
            WITH RECURSIVE paths(id, depth, path, found) AS (
                SELECT ?, 0, ?, 0
                UNION ALL
                SELECT
                    CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
                    p.depth + 1,
                    p.path || ',' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
                    CASE WHEN CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END = ? THEN 1 ELSE 0 END
                FROM paths p
                JOIN edges e ON (e.source_id = p.id OR (e.directed = 0 AND e.target_id = p.id))
                WHERE p.found = 0 AND p.depth < 10
                AND p.path NOT LIKE '%' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END || '%'
            )
            SELECT path FROM paths WHERE found = 1 ORDER BY depth LIMIT 1
            """

        let results: [[String: Any]] = try query(sql, parameters: [sourceId, sourceId, targetId])
        guard let pathString = results.first?["path"] as? String else { return nil }
        return pathString.components(separatedBy: ",")
    }

    public func nodeImportance() throws -> [(nodeId: String, importance: Double)] {
        let sql = """
            SELECT
                n.id,
                COALESCE(SUM(e.weight), 0) as importance
            FROM nodes n
            LEFT JOIN edges e ON e.target_id = n.id
            WHERE n.deleted_at IS NULL
            GROUP BY n.id
            ORDER BY importance DESC
            """

        let results: [[String: Any]] = try query(sql)
        return results.compactMap { row in
            guard let id = row["id"] as? String,
                  let importance = row["importance"] as? Double else { return nil }
            return (id, importance)
        }
    }

    // MARK: - Private Helpers

    private func bindParameters(_ statement: OpaquePointer?, _ parameters: [Any?]) throws {
        for (index, param) in parameters.enumerated() {
            let sqlIndex = Int32(index + 1)

            switch param {
            case nil:
                sqlite3_bind_null(statement, sqlIndex)
            case let value as String:
                sqlite3_bind_text(statement, sqlIndex, value, -1, SQLITE_TRANSIENT)
            case let value as Int:
                sqlite3_bind_int64(statement, sqlIndex, Int64(value))
            case let value as Double:
                sqlite3_bind_double(statement, sqlIndex, value)
            case let value as Data:
                value.withUnsafeBytes { ptr in
                    sqlite3_bind_blob(statement, sqlIndex, ptr.baseAddress, Int32(value.count), SQLITE_TRANSIENT)
                }
            default:
                throw DatabaseError.unsupportedType
            }
        }
    }

    private func extractRow(_ statement: OpaquePointer?) -> [String: Any] {
        var row: [String: Any] = [:]
        let columnCount = sqlite3_column_count(statement)

        for i in 0..<columnCount {
            let name = String(cString: sqlite3_column_name(statement, i))

            switch sqlite3_column_type(statement, i) {
            case SQLITE_INTEGER:
                row[name] = sqlite3_column_int64(statement, i)
            case SQLITE_FLOAT:
                row[name] = sqlite3_column_double(statement, i)
            case SQLITE_TEXT:
                row[name] = String(cString: sqlite3_column_text(statement, i))
            case SQLITE_BLOB:
                let bytes = sqlite3_column_blob(statement, i)
                let count = sqlite3_column_bytes(statement, i)
                row[name] = Data(bytes: bytes!, count: Int(count))
            default:
                row[name] = NSNull()
            }
        }

        return row
    }

    private func runMigrations() throws {
        // Get current version
        var version: Int = 0
        if let results: [[String: Any]] = try? query("PRAGMA user_version"),
           let v = results.first?["user_version"] as? Int64 {
            version = Int(v)
        }

        // Run migrations
        if version < 1 {
            try execute(Self.schemaV1)
            try execute("PRAGMA user_version = 1")
        }

        if version < 2 {
            try execute(Self.migrationV2)
            try execute("PRAGMA user_version = 2")
        }
    }

    // Schema definitions loaded from embedded resources
    private static let schemaV1 = """
        -- Initial schema (loaded from schema-v2.sql)
        """

    private static let migrationV2 = """
        -- Future migrations
        """
}

// MARK: - Error Types

public enum DatabaseError: LocalizedError {
    case notInitialized
    case deallocated
    case openFailed(String)
    case prepareFailed(String)
    case executeFailed(String)
    case unsupportedType

    public var errorDescription: String? {
        switch self {
        case .notInitialized: return "Database not initialized"
        case .deallocated: return "Database was deallocated"
        case .openFailed(let msg): return "Failed to open database: \(msg)"
        case .prepareFailed(let msg): return "Failed to prepare statement: \(msg)"
        case .executeFailed(let msg): return "Failed to execute statement: \(msg)"
        case .unsupportedType: return "Unsupported parameter type"
        }
    }
}

// MARK: - Supporting Types

public struct NodeWithDepth: Codable {
    public let node: Node
    public let depth: Int
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
```

### 2.2 Swift Data Models

```swift
// Sources/Models/Node.swift

import Foundation

public struct Node: Codable, Identifiable, Hashable {
    public let id: String
    public var nodeType: String
    public var name: String
    public var content: String?
    public var summary: String?

    // LATCH: Location
    public var latitude: Double?
    public var longitude: Double?
    public var locationName: String?
    public var locationAddress: String?

    // LATCH: Time
    public var createdAt: Date
    public var modifiedAt: Date
    public var dueAt: Date?
    public var completedAt: Date?
    public var eventStart: Date?
    public var eventEnd: Date?

    // LATCH: Category
    public var folder: String?
    public var tags: [String]
    public var status: String?

    // LATCH: Hierarchy
    public var priority: Int
    public var importance: Int
    public var sortOrder: Int

    // Metadata
    public var source: String?
    public var sourceId: String?
    public var sourceURL: URL?
    public var deletedAt: Date?
    public var version: Int

    // Sync
    public var syncVersion: Int
    public var lastSyncedAt: Date?

    public init(
        id: String = UUID().uuidString,
        nodeType: String = "note",
        name: String,
        content: String? = nil
    ) {
        self.id = id
        self.nodeType = nodeType
        self.name = name
        self.content = content
        self.createdAt = Date()
        self.modifiedAt = Date()
        self.tags = []
        self.priority = 0
        self.importance = 0
        self.sortOrder = 0
        self.version = 1
        self.syncVersion = 0
    }
}

// Sources/Models/Edge.swift

public struct Edge: Codable, Identifiable, Hashable {
    public let id: String
    public var edgeType: EdgeType
    public var sourceId: String
    public var targetId: String
    public var label: String?
    public var weight: Double
    public var directed: Bool
    public var sequenceOrder: Int?
    public var channel: String?
    public var timestamp: Date?
    public var subject: String?
    public var createdAt: Date
    public var syncVersion: Int

    public enum EdgeType: String, Codable, CaseIterable {
        case link = "LINK"
        case nest = "NEST"
        case sequence = "SEQUENCE"
        case affinity = "AFFINITY"
    }

    public init(
        id: String = UUID().uuidString,
        type: EdgeType,
        sourceId: String,
        targetId: String,
        weight: Double = 1.0
    ) {
        self.id = id
        self.edgeType = type
        self.sourceId = sourceId
        self.targetId = targetId
        self.weight = weight
        self.directed = true
        self.createdAt = Date()
        self.syncVersion = 0
    }
}
```

---

## Phase 3: iCloud Sync with CloudKit

### 3.1 CloudKit Sync Manager

```swift
// Sources/Sync/CloudKitSyncManager.swift

import CloudKit
import Combine

/// Manages bidirectional sync between local SQLite and CloudKit
@MainActor
public final class CloudKitSyncManager: ObservableObject {

    public static let shared = CloudKitSyncManager()

    private let container = CKContainer(identifier: "iCloud.com.yourcompany.isometry")
    private let database: CKDatabase
    private let zoneID = CKRecordZone.ID(zoneName: "IsometryZone", ownerName: CKCurrentUserDefaultName)

    @Published public private(set) var syncState: SyncState = .idle
    @Published public private(set) var lastSyncDate: Date?
    @Published public private(set) var pendingChanges: Int = 0

    private var subscriptions: Set<AnyCancellable> = []

    public enum SyncState: Equatable {
        case idle
        case syncing
        case error(String)
    }

    private init() {
        database = container.privateCloudDatabase
    }

    // MARK: - Setup

    public func setup() async throws {
        // Create custom zone
        let zone = CKRecordZone(zoneID: zoneID)

        do {
            _ = try await database.modifyRecordZones(saving: [zone], deleting: [])
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Zone already exists, that's fine
        }

        // Subscribe to changes
        try await setupSubscription()
    }

    private func setupSubscription() async throws {
        let subscription = CKDatabaseSubscription(subscriptionID: "isometry-changes")

        let notificationInfo = CKSubscription.NotificationInfo()
        notificationInfo.shouldSendContentAvailable = true
        subscription.notificationInfo = notificationInfo

        do {
            _ = try await database.modifySubscriptions(saving: [subscription], deleting: [])
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Subscription already exists
        }
    }

    // MARK: - Sync Operations

    public func sync() async {
        guard syncState != .syncing else { return }

        syncState = .syncing

        do {
            // 1. Push local changes
            try await pushLocalChanges()

            // 2. Pull remote changes
            try await pullRemoteChanges()

            lastSyncDate = Date()
            syncState = .idle

            // Update sync state in database
            try IsometryDatabase.shared.execute("""
                UPDATE sync_state SET last_sync_at = ?, pending_changes = 0 WHERE id = 'default'
                """, parameters: [ISO8601DateFormatter().string(from: Date())])

        } catch {
            syncState = .error(error.localizedDescription)
        }
    }

    // MARK: - Push Changes

    private func pushLocalChanges() async throws {
        // Get nodes modified since last sync
        let modifiedNodes: [Node] = try IsometryDatabase.shared.query("""
            SELECT * FROM nodes
            WHERE modified_at > COALESCE(last_synced_at, '1970-01-01')
            ORDER BY modified_at
            """)

        let modifiedEdges: [Edge] = try IsometryDatabase.shared.query("""
            SELECT * FROM edges
            WHERE sync_version > (
                SELECT COALESCE(MAX(sync_version), 0) FROM sync_state
            )
            """)

        guard !modifiedNodes.isEmpty || !modifiedEdges.isEmpty else { return }

        // Convert to CKRecords
        var recordsToSave: [CKRecord] = []

        for node in modifiedNodes {
            let record = CKRecord(recordType: "Node", recordID: CKRecord.ID(recordName: node.id, zoneID: zoneID))
            record["name"] = node.name
            record["content"] = node.content
            record["folder"] = node.folder
            record["tags"] = node.tags as NSArray
            record["priority"] = node.priority
            record["status"] = node.status
            record["nodeType"] = node.nodeType
            record["createdAt"] = node.createdAt
            record["modifiedAt"] = node.modifiedAt
            record["version"] = node.version

            if let deletedAt = node.deletedAt {
                record["deletedAt"] = deletedAt
            }

            recordsToSave.append(record)
        }

        for edge in modifiedEdges {
            let record = CKRecord(recordType: "Edge", recordID: CKRecord.ID(recordName: edge.id, zoneID: zoneID))
            record["edgeType"] = edge.edgeType.rawValue
            record["sourceId"] = edge.sourceId
            record["targetId"] = edge.targetId
            record["weight"] = edge.weight
            record["directed"] = edge.directed
            record["label"] = edge.label
            recordsToSave.append(record)
        }

        // Batch save
        let operation = CKModifyRecordsOperation(recordsToSave: recordsToSave)
        operation.savePolicy = .changedKeys
        operation.qualityOfService = .userInitiated

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
            database.add(operation)
        }

        // Mark as synced
        let now = ISO8601DateFormatter().string(from: Date())
        for node in modifiedNodes {
            try IsometryDatabase.shared.execute(
                "UPDATE nodes SET last_synced_at = ? WHERE id = ?",
                parameters: [now, node.id]
            )
        }
    }

    // MARK: - Pull Changes

    private func pullRemoteChanges() async throws {
        // Get server change token
        var changeToken: CKServerChangeToken?
        if let tokenData: [[String: Any]] = try? IsometryDatabase.shared.query(
            "SELECT last_sync_token FROM sync_state WHERE id = 'default'"
        ), let data = tokenData.first?["last_sync_token"] as? Data {
            changeToken = try? NSKeyedUnarchiver.unarchivedObject(ofClass: CKServerChangeToken.self, from: data)
        }

        // Fetch changes
        let options = CKFetchRecordZoneChangesOperation.ZoneConfiguration()
        options.previousServerChangeToken = changeToken

        let operation = CKFetchRecordZoneChangesOperation(
            recordZoneIDs: [zoneID],
            configurationsByRecordZoneID: [zoneID: options]
        )

        var changedRecords: [CKRecord] = []
        var deletedRecordIDs: [CKRecord.ID] = []
        var newToken: CKServerChangeToken?

        operation.recordWasChangedBlock = { _, result in
            if case .success(let record) = result {
                changedRecords.append(record)
            }
        }

        operation.recordWithIDWasDeletedBlock = { recordID, _ in
            deletedRecordIDs.append(recordID)
        }

        operation.recordZoneChangeTokensUpdatedBlock = { _, token, _ in
            newToken = token
        }

        operation.recordZoneFetchResultBlock = { _, result in
            if case .success(let (token, _, _)) = result {
                newToken = token
            }
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            operation.fetchRecordZoneChangesResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume()
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }
            database.add(operation)
        }

        // Apply changes to local database
        for record in changedRecords {
            try applyRemoteChange(record)
        }

        for recordID in deletedRecordIDs {
            try applyRemoteDeletion(recordID)
        }

        // Save new token
        if let token = newToken,
           let tokenData = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) {
            try IsometryDatabase.shared.execute(
                "UPDATE sync_state SET last_sync_token = ? WHERE id = 'default'",
                parameters: [tokenData]
            )
        }
    }

    private func applyRemoteChange(_ record: CKRecord) throws {
        switch record.recordType {
        case "Node":
            let sql = """
                INSERT INTO nodes (id, name, content, folder, tags, priority, status, node_type, created_at, modified_at, version, deleted_at, last_synced_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    content = excluded.content,
                    folder = excluded.folder,
                    tags = excluded.tags,
                    priority = excluded.priority,
                    status = excluded.status,
                    modified_at = excluded.modified_at,
                    version = excluded.version,
                    deleted_at = excluded.deleted_at,
                    last_synced_at = datetime('now')
                WHERE excluded.version > nodes.version
                """

            let tagsJSON = (record["tags"] as? [String]).map { try? JSONEncoder().encode($0) }.flatMap { String(data: $0!, encoding: .utf8) }

            try IsometryDatabase.shared.execute(sql, parameters: [
                record.recordID.recordName,
                record["name"] as? String,
                record["content"] as? String,
                record["folder"] as? String,
                tagsJSON,
                record["priority"] as? Int ?? 0,
                record["status"] as? String,
                record["nodeType"] as? String ?? "note",
                (record["createdAt"] as? Date).map { ISO8601DateFormatter().string(from: $0) },
                (record["modifiedAt"] as? Date).map { ISO8601DateFormatter().string(from: $0) },
                record["version"] as? Int ?? 1,
                (record["deletedAt"] as? Date).map { ISO8601DateFormatter().string(from: $0) }
            ])

        case "Edge":
            let sql = """
                INSERT INTO edges (id, edge_type, source_id, target_id, weight, directed, label)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    edge_type = excluded.edge_type,
                    weight = excluded.weight,
                    label = excluded.label
                """

            try IsometryDatabase.shared.execute(sql, parameters: [
                record.recordID.recordName,
                record["edgeType"] as? String ?? "LINK",
                record["sourceId"] as? String,
                record["targetId"] as? String,
                record["weight"] as? Double ?? 1.0,
                (record["directed"] as? Bool ?? true) ? 1 : 0,
                record["label"] as? String
            ])

        default:
            break
        }
    }

    private func applyRemoteDeletion(_ recordID: CKRecord.ID) throws {
        let id = recordID.recordName

        // Soft delete for nodes
        try IsometryDatabase.shared.execute(
            "UPDATE nodes SET deleted_at = datetime('now') WHERE id = ?",
            parameters: [id]
        )

        // Hard delete for edges
        try IsometryDatabase.shared.execute(
            "DELETE FROM edges WHERE id = ?",
            parameters: [id]
        )
    }

    // MARK: - Conflict Resolution

    public func resolveConflict(localNode: Node, remoteNode: Node, resolution: ConflictResolution) async throws {
        switch resolution {
        case .keepLocal:
            // Force push local version with incremented version
            var updated = localNode
            updated.version = max(localNode.version, remoteNode.version) + 1
            try await pushNode(updated)

        case .keepRemote:
            // Apply remote version locally
            try applyNode(remoteNode)

        case .merge(let merged):
            // Apply merged version
            var updated = merged
            updated.version = max(localNode.version, remoteNode.version) + 1
            try applyNode(updated)
            try await pushNode(updated)
        }
    }

    public enum ConflictResolution {
        case keepLocal
        case keepRemote
        case merge(Node)
    }

    private func pushNode(_ node: Node) async throws {
        // Implementation...
    }

    private func applyNode(_ node: Node) throws {
        // Implementation...
    }
}
```

---

## Phase 4: React Web Migration

### 4.1 API Client for Web

For the web app, we'll add an API layer that talks to a sync server (or directly to CloudKit via their web services).

```typescript
// src/db/api-client.ts

interface APIConfig {
  baseURL: string;
  authToken?: string;
}

export class IsometryAPIClient {
  private config: APIConfig;

  constructor(config: APIConfig) {
    this.config = config;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.config.baseURL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.authToken && { Authorization: `Bearer ${this.config.authToken}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Nodes
  async getNodes(filter?: NodeFilter): Promise<Node[]> {
    const params = new URLSearchParams();
    if (filter?.folder) params.set('folder', filter.folder);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.limit) params.set('limit', String(filter.limit));

    return this.fetch(`/nodes?${params}`);
  }

  async getNode(id: string): Promise<Node> {
    return this.fetch(`/nodes/${id}`);
  }

  async createNode(node: Partial<Node>): Promise<Node> {
    return this.fetch('/nodes', {
      method: 'POST',
      body: JSON.stringify(node),
    });
  }

  async updateNode(id: string, updates: Partial<Node>): Promise<Node> {
    return this.fetch(`/nodes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteNode(id: string): Promise<void> {
    await this.fetch(`/nodes/${id}`, { method: 'DELETE' });
  }

  // Search
  async search(query: string, limit = 50): Promise<SearchResult[]> {
    return this.fetch(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }

  // Graph
  async getConnectedNodes(nodeId: string, maxDepth = 3): Promise<NodeWithDepth[]> {
    return this.fetch(`/graph/connected/${nodeId}?depth=${maxDepth}`);
  }

  async getShortestPath(fromId: string, toId: string): Promise<string[] | null> {
    return this.fetch(`/graph/path?from=${fromId}&to=${toId}`);
  }

  async getNodeImportance(): Promise<{ nodeId: string; importance: number }[]> {
    return this.fetch('/graph/importance');
  }

  // Sync
  async sync(changes: SyncPayload): Promise<SyncResult> {
    return this.fetch('/sync', {
      method: 'POST',
      body: JSON.stringify(changes),
    });
  }
}

// Types
interface NodeFilter {
  folder?: string;
  status?: string;
  limit?: number;
}

interface SearchResult {
  node: Node;
  rank: number;
  highlights: { field: string; snippet: string }[];
}

interface NodeWithDepth {
  node: Node;
  depth: number;
}

interface SyncPayload {
  clientVersion: number;
  changes: {
    nodes: { created: Node[]; updated: Node[]; deleted: string[] };
    edges: { created: Edge[]; updated: Edge[]; deleted: string[] };
  };
}

interface SyncResult {
  serverVersion: number;
  conflicts: { local: Node; remote: Node }[];
  applied: { nodes: number; edges: number };
}
```

### 4.2 Hybrid Provider (Local + API)

```typescript
// src/db/HybridDatabaseProvider.tsx

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { IsometryAPIClient } from './api-client';
import { initDatabase, getDatabase } from './init'; // Keep sql.js for offline

interface HybridDatabaseContextValue {
  // State
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;

  // Operations (use API when online, local when offline)
  nodes: {
    list: (filter?: NodeFilter) => Promise<Node[]>;
    get: (id: string) => Promise<Node | null>;
    create: (node: Partial<Node>) => Promise<Node>;
    update: (id: string, updates: Partial<Node>) => Promise<Node>;
    delete: (id: string) => Promise<void>;
  };

  search: (query: string) => Promise<SearchResult[]>;

  graph: {
    connected: (nodeId: string, depth?: number) => Promise<NodeWithDepth[]>;
    shortestPath: (from: string, to: string) => Promise<string[] | null>;
    importance: () => Promise<{ nodeId: string; importance: number }[]>;
  };

  sync: () => Promise<void>;
}

const HybridDatabaseContext = createContext<HybridDatabaseContextValue | null>(null);

export function HybridDatabaseProvider({
  children,
  apiBaseURL
}: {
  children: ReactNode;
  apiBaseURL: string;
}) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [localDb, setLocalDb] = useState<Database | null>(null);

  const api = new IsometryAPIClient({ baseURL: apiBaseURL });

  // Initialize local database for offline support
  useEffect(() => {
    initDatabase().then(setLocalDb);
  }, []);

  // Track online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && localDb) {
      sync();
    }
  }, [isOnline]);

  const sync = useCallback(async () => {
    if (!localDb || isSyncing) return;

    setIsSyncing(true);
    try {
      // Get local changes
      const pendingNodes = localDb.exec(`
        SELECT * FROM nodes WHERE modified_at > COALESCE(last_synced_at, '1970-01-01')
      `);

      // Push to server and get back changes
      const result = await api.sync({
        clientVersion: Date.now(),
        changes: {
          nodes: {
            created: [], // Extract from pendingNodes
            updated: [], // Extract from pendingNodes
            deleted: [],
          },
          edges: { created: [], updated: [], deleted: [] },
        },
      });

      // Apply server changes locally
      // Handle conflicts...

      setLastSyncAt(new Date());
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [localDb, isSyncing, api]);

  // Node operations with online/offline fallback
  const nodes = {
    list: async (filter?: NodeFilter) => {
      if (isOnline) {
        try {
          return await api.getNodes(filter);
        } catch {
          // Fall back to local
        }
      }
      // Query local database
      const sql = `SELECT * FROM nodes WHERE deleted_at IS NULL ORDER BY modified_at DESC`;
      return executeLocal<Node>(sql);
    },

    get: async (id: string) => {
      if (isOnline) {
        try {
          return await api.getNode(id);
        } catch {
          // Fall back to local
        }
      }
      const results = executeLocal<Node>(`SELECT * FROM nodes WHERE id = ?`, [id]);
      return results[0] || null;
    },

    create: async (node: Partial<Node>) => {
      const newNode = {
        id: crypto.randomUUID(),
        ...node,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        version: 1,
      } as Node;

      // Always save locally first
      executeLocal(`
        INSERT INTO nodes (id, name, content, folder, priority, created_at, modified_at, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [newNode.id, newNode.name, newNode.content, newNode.folder, newNode.priority, newNode.createdAt, newNode.modifiedAt, 1]);

      // Try to sync to server
      if (isOnline) {
        try {
          await api.createNode(newNode);
        } catch {
          // Will sync later
        }
      }

      return newNode;
    },

    update: async (id: string, updates: Partial<Node>) => {
      // Update locally
      const modifiedAt = new Date().toISOString();
      executeLocal(`
        UPDATE nodes SET name = COALESCE(?, name), content = COALESCE(?, content),
        folder = COALESCE(?, folder), modified_at = ? WHERE id = ?
      `, [updates.name, updates.content, updates.folder, modifiedAt, id]);

      // Try to sync
      if (isOnline) {
        try {
          return await api.updateNode(id, updates);
        } catch {
          // Will sync later
        }
      }

      return { ...updates, id, modifiedAt } as Node;
    },

    delete: async (id: string) => {
      // Soft delete locally
      executeLocal(`UPDATE nodes SET deleted_at = datetime('now') WHERE id = ?`, [id]);

      if (isOnline) {
        try {
          await api.deleteNode(id);
        } catch {
          // Will sync later
        }
      }
    },
  };

  // Search - requires server for FTS5
  const search = async (query: string) => {
    if (!isOnline) {
      // Fallback to LIKE queries locally
      const results = executeLocal<Node>(`
        SELECT * FROM nodes
        WHERE (name LIKE ? OR content LIKE ?) AND deleted_at IS NULL
        ORDER BY modified_at DESC LIMIT 50
      `, [`%${query}%`, `%${query}%`]);

      return results.map(node => ({ node, rank: 0, highlights: [] }));
    }

    return api.search(query);
  };

  // Graph queries - require server for complex CTEs
  const graph = {
    connected: async (nodeId: string, depth = 3) => {
      if (!isOnline) {
        // Simple local fallback - just direct connections
        const edges = executeLocal<Edge>(`
          SELECT * FROM edges WHERE source_id = ? OR target_id = ?
        `, [nodeId, nodeId]);

        const connectedIds = new Set(edges.flatMap(e => [e.sourceId, e.targetId]));
        connectedIds.delete(nodeId);

        const nodes = executeLocal<Node>(`
          SELECT * FROM nodes WHERE id IN (${[...connectedIds].map(() => '?').join(',')})
        `, [...connectedIds]);

        return nodes.map(node => ({ node, depth: 1 }));
      }

      return api.getConnectedNodes(nodeId, depth);
    },

    shortestPath: async (from: string, to: string) => {
      if (!isOnline) return null; // Too complex for local fallback
      return api.getShortestPath(from, to);
    },

    importance: async () => {
      if (!isOnline) return []; // Too complex for local fallback
      return api.getNodeImportance();
    },
  };

  // Helper for local queries
  function executeLocal<T>(sql: string, params: unknown[] = []): T[] {
    if (!localDb) return [];
    const result = localDb.exec(sql, params);
    if (result.length === 0) return [];

    const { columns, values } = result[0];
    return values.map(row => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj as T;
    });
  }

  return (
    <HybridDatabaseContext.Provider value={{
      isOnline,
      isSyncing,
      lastSyncAt,
      nodes,
      search,
      graph,
      sync,
    }}>
      {children}
    </HybridDatabaseContext.Provider>
  );
}

export function useHybridDatabase() {
  const context = useContext(HybridDatabaseContext);
  if (!context) {
    throw new Error('useHybridDatabase must be used within HybridDatabaseProvider');
  }
  return context;
}
```

---

## Phase 5: Migration Checklist

### Pre-Migration

- [ ] Backup existing IndexedDB data
- [ ] Document current API surface (`useSQLiteQuery`, `useNodes`, etc.)
- [ ] Set up CloudKit container in Apple Developer Portal
- [ ] Create sync server (if needed for web)

### Schema Migration

- [ ] Add sync metadata columns to schema
- [ ] Create FTS5 virtual table and triggers
- [ ] Test graph CTEs with sample data
- [ ] Write migration script for existing data

### iOS/macOS Implementation

- [ ] Create `IsometryDatabase.swift`
- [ ] Create Swift data models (`Node`, `Edge`)
- [ ] Implement `CloudKitSyncManager`
- [ ] Add conflict resolution UI
- [ ] Test offline/online transitions

### Web Implementation

- [ ] Create API client
- [ ] Create `HybridDatabaseProvider`
- [ ] Update hooks to use new provider
- [ ] Test offline fallback behavior
- [ ] Test sync recovery

### Testing

- [ ] Unit tests for graph queries
- [ ] Unit tests for FTS5 search
- [ ] Integration tests for sync
- [ ] Conflict resolution scenarios
- [ ] Performance benchmarks (10k, 100k nodes)

### Rollout

- [ ] Feature flag for gradual rollout
- [ ] Data migration for existing users
- [ ] Monitor sync success rates
- [ ] Monitor conflict rates

---

## Timeline Estimate

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| 1 | Schema Migration | None |
| 2 | iOS/macOS Native Layer | Phase 1 |
| 3 | iCloud Sync | Phase 2 |
| 4 | Web API Layer | Phase 1 |
| 5 | Testing & Rollout | All phases |

---

## Decision Points

### Server Architecture

**Option A: CloudKit Only**
- Pros: No server to maintain, Apple handles sync
- Cons: Web requires CloudKit web services (complex), Apple ecosystem lock-in

**Option B: Custom Sync Server**
- Pros: Full control, works everywhere
- Cons: Infrastructure to maintain

**Option C: Hybrid (CloudKit + API)**
- Pros: Best of both worlds
- Cons: More complex

**Recommendation**: Start with Option A (CloudKit only) for iOS/macOS. Add custom sync server later for web if needed.

### Offline Strategy

**Option A: Full Offline**
- Keep sql.js in web for complete offline support
- Complex sync logic

**Option B: Online-First**
- Remove sql.js, require connection
- Simpler, but limited offline

**Recommendation**: Option A (Full Offline) - essential for a notes app.
