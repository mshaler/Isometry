# SQLite Migration Plan: Native-First Architecture

*Isometry Data Layer: Pure SQLite + CloudKit*

---

## Executive Summary

This document defines Isometry's native data architecture: **SQLite for storage, CloudKit for sync**. No web technologies on native platforms—no sql.js, no IndexedDB, no WASM.

**Key Decisions:**

| Decision | Choice | Rationale |
|----------|--------|-----------|
| iOS Deployment | iOS 15+ | Manual CloudKit operations (CKSyncEngine requires iOS 17) |
| Thread Safety | Swift Actor model | Compile-time guarantees, cleaner than DispatchQueue |
| Conflict Resolution | Automatic + user override | Last-write-wins default, manual merge when needed |
| Web Support | Deferred to v4.0+ | Focus on native quality first |

**What This Enables:**

- Full offline capability (SQLite is always available)
- FTS5 full-text search
- Recursive CTEs for graph analytics
- Cross-device sync (iPhone ↔ iPad ↔ Mac)
- WAL mode for performance

---

## Architecture Overview

### Current State (Web Prototype)

```text
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

### Target Architecture (Native)

No web technologies needed. SQLite provides full offline capability; CloudKit handles sync.

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Native Apps (iOS 15+ / macOS 12+)                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                          SwiftUI Views                                │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │  │
│  │  │  CardGrid   │  │  ListView   │  │  NetworkView │                   │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                   │  │
│  └─────────┼────────────────┼────────────────┼───────────────────────────┘  │
│            │                │                │                              │
│            ▼                ▼                ▼                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                   IsometryDatabase (Actor)                           │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐ │   │
│  │  │   Nodes    │  │   Edges    │  │   FTS5     │  │  Graph CTEs    │ │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│  ┌───────────────────────────▼──────────────────────────────────────────┐   │
│  │                      SQLite (Native)                                 │   │
│  │  ┌────────────────┐                                                 │   │
│  │  │  isometry.db   │  ✅ FTS5 full-text search                       │   │
│  │  │  ├─ nodes      │  ✅ Recursive CTEs for graphs                   │   │
│  │  │  ├─ edges      │  ✅ Full offline capability                     │   │
│  │  │  ├─ facets     │  ✅ WAL mode for performance                    │   │
│  │  │  ├─ nodes_fts  │  ✅ iOS 15+ compatible                          │   │
│  │  │  └─ sync_state │                                                 │   │
│  │  └────────────────┘                                                 │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │               CloudKitSyncManager (Actor)                            │   │
│  │  ✅ Custom zone "IsometryZone"                                      │   │
│  │  ✅ Change tokens for incremental sync                              │   │
│  │  ✅ Automatic offline queue                                         │   │
│  │  ✅ Exponential backoff on failures                                 │   │
│  │  ✅ Cross-device sync (iPhone, iPad, Mac)                           │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Web App (Optional, Future)

If web support is needed later:

```text
Option A: SQLite WASM + OPFS (Full Offline)
┌─────────────────────────────────────────┐
│           Browser (React)               │
│  ┌─────────────┐    ┌───────────────┐  │
│  │ SQLite WASM │───▶│     OPFS      │  │
│  │ (official)  │    │ (persistence) │  │
│  └─────────────┘    └───────────────┘  │
│         │                               │
│  ✅ FTS5 support                        │
│  ✅ Full offline                        │
│  ⚠️ Requires sync server for iCloud    │
└─────────────────────────────────────────┘

Option B: Online-Only (Simpler)
┌─────────────────────────────────────────┐
│           Browser (React)               │
│  ┌─────────────┐                       │
│  │  REST API   │───▶ Sync Server       │
│  └─────────────┘                       │
│         │                               │
│  ✅ No local storage needed             │
│  ✅ Always in sync                      │
│  ❌ Requires internet connection        │
└─────────────────────────────────────────┘
```

---

## Phase 1: Schema Design

### 1.1 Complete Database Schema

```sql
-- schema.sql
-- ============================================================================
-- Isometry SQLite Schema
-- With FTS5 full-text search, graph support, and sync metadata
-- ============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================================
-- NODES: Primary data table
-- ============================================================================
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

-- Node indexes
CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder);
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source ON nodes(source, source_id) WHERE source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_sync ON nodes(sync_version, last_synced_at);

-- ============================================================================
-- EDGES: Relationships (GRAPH)
-- ============================================================================
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

-- Edge indexes
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON edges(weight DESC);

-- ============================================================================
-- FACETS: PAFV dimension definitions
-- ============================================================================
CREATE TABLE IF NOT EXISTS facets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    facet_type TEXT NOT NULL,  -- PLANE, AXIS, FACET, VALUE
    parent_id TEXT REFERENCES facets(id) ON DELETE SET NULL,
    sort_order INTEGER DEFAULT 0,
    metadata TEXT,  -- JSON
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_facets_type ON facets(facet_type);
CREATE INDEX IF NOT EXISTS idx_facets_parent ON facets(parent_id);

-- ============================================================================
-- FTS5: Full-Text Search
-- ============================================================================
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

-- ============================================================================
-- SYNC STATE: Track sync progress
-- ============================================================================
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_sync_token BLOB,  -- CKServerChangeToken archived data
    last_sync_at TEXT,
    pending_changes INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TEXT
);

INSERT OR IGNORE INTO sync_state (id) VALUES ('default');

-- ============================================================================
-- SETTINGS: User preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================================================
-- SCHEMA MIGRATIONS: Track applied migrations
-- ============================================================================
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    description TEXT
);
```

### 1.2 Graph Query Library

Reusable SQL patterns for graph traversal using recursive CTEs:

```sql
-- ============================================================================
-- GRAPH QUERY LIBRARY
-- ============================================================================

-- connected_nodes: Find all nodes reachable from a starting node (BFS)
-- Parameters: $start_id, $max_depth
-- ============================================================================
WITH RECURSIVE connected(id, depth, path) AS (
    SELECT $start_id, 0, $start_id

    UNION ALL

    SELECT
        CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END,
        c.depth + 1,
        c.path || ',' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END
    FROM connected c
    JOIN edges e ON (e.source_id = c.id OR (e.directed = 0 AND e.target_id = c.id))
    WHERE c.depth < $max_depth
    AND c.path NOT LIKE '%' || CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END || '%'
)
SELECT DISTINCT n.*, c.depth
FROM connected c
JOIN nodes n ON n.id = c.id
WHERE n.deleted_at IS NULL
ORDER BY c.depth, n.name;

-- shortest_path: Find shortest path between two nodes
-- Parameters: $from_id, $to_id
-- ============================================================================
WITH RECURSIVE paths(id, depth, path, found) AS (
    SELECT $from_id, 0, $from_id, 0

    UNION ALL

    SELECT
        CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
        p.depth + 1,
        p.path || ',' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END,
        CASE WHEN CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END = $to_id THEN 1 ELSE 0 END
    FROM paths p
    JOIN edges e ON (e.source_id = p.id OR (e.directed = 0 AND e.target_id = p.id))
    WHERE p.found = 0 AND p.depth < 10
    AND p.path NOT LIKE '%' || CASE WHEN e.source_id = p.id THEN e.target_id ELSE e.source_id END || '%'
)
SELECT path, depth FROM paths WHERE found = 1 ORDER BY depth LIMIT 1;

-- node_importance: Calculate node importance by inbound link weight
-- ============================================================================
SELECT
    n.id,
    n.name,
    COUNT(DISTINCT e.id) as inbound_links,
    COALESCE(SUM(e.weight), 0) as weighted_importance
FROM nodes n
LEFT JOIN edges e ON e.target_id = n.id
WHERE n.deleted_at IS NULL
GROUP BY n.id
ORDER BY weighted_importance DESC;

-- neighbors: Get immediate neighbors of a node
-- Parameters: $node_id
-- ============================================================================
SELECT DISTINCT n.*, e.edge_type, e.weight
FROM edges e
JOIN nodes n ON n.id = CASE
    WHEN e.source_id = $node_id THEN e.target_id
    ELSE e.source_id
END
WHERE (e.source_id = $node_id OR (e.directed = 0 AND e.target_id = $node_id))
AND n.deleted_at IS NULL
ORDER BY e.weight DESC, n.name;

-- subgraph: Extract a complete subgraph around a node
-- Parameters: $center_id, $radius
-- ============================================================================
WITH RECURSIVE subgraph_nodes(id, depth) AS (
    SELECT $center_id, 0

    UNION ALL

    SELECT
        CASE WHEN e.source_id = s.id THEN e.target_id ELSE e.source_id END,
        s.depth + 1
    FROM subgraph_nodes s
    JOIN edges e ON e.source_id = s.id OR e.target_id = s.id
    WHERE s.depth < $radius
)
SELECT DISTINCT
    n.*,
    e.id as edge_id,
    e.edge_type,
    e.source_id,
    e.target_id,
    e.weight
FROM subgraph_nodes s
JOIN nodes n ON n.id = s.id
LEFT JOIN edges e ON (e.source_id = s.id OR e.target_id = s.id)
    AND e.source_id IN (SELECT id FROM subgraph_nodes)
    AND e.target_id IN (SELECT id FROM subgraph_nodes)
WHERE n.deleted_at IS NULL;
```

---

## Phase 2: iOS/macOS Native Layer

### 2.1 Swift Database Manager (Actor Model)

Using Swift Actor for thread safety with compile-time guarantees:

```swift
// Sources/Database/IsometryDatabase.swift

import Foundation
import SQLite3
import os.log

/// Thread-safe SQLite database using Swift Actor model
public actor IsometryDatabase {

    public static let shared = IsometryDatabase()

    private var db: OpaquePointer?
    private let logger = Logger(subsystem: "com.isometry", category: "Database")

    private(set) var isReady = false

    // MARK: - Initialization

    public func initialize(at url: URL? = nil) async throws {
        let dbURL = url ?? Self.defaultDatabaseURL

        // Create directory if needed
        try FileManager.default.createDirectory(
            at: dbURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )

        // Open database
        var db: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX

        guard sqlite3_open_v2(dbURL.path, &db, flags, nil) == SQLITE_OK else {
            let message = db.map { String(cString: sqlite3_errmsg($0)) } ?? "Unknown error"
            throw DatabaseError.openFailed(message)
        }

        self.db = db

        // Configure database
        try execute("PRAGMA journal_mode = WAL")
        try execute("PRAGMA foreign_keys = ON")
        try execute("PRAGMA synchronous = NORMAL")

        // Run migrations
        try runMigrations()

        isReady = true
        logger.info("Database initialized at \(dbURL.path)")
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
        guard let db else { throw DatabaseError.notInitialized }

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            throw DatabaseError.prepareFailed(String(cString: sqlite3_errmsg(db)))
        }
        defer { sqlite3_finalize(statement) }

        try bindParameters(statement, parameters)

        let result = sqlite3_step(statement)
        guard result == SQLITE_DONE || result == SQLITE_ROW else {
            throw DatabaseError.executeFailed(String(cString: sqlite3_errmsg(db)))
        }
    }

    public func query<T: Decodable>(_ sql: String, parameters: [Any?] = []) throws -> [T] {
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

    // MARK: - FTS5 Search

    public func search(_ query: String, limit: Int = 50) throws -> [Node] {
        // Escape FTS5 special characters and add prefix matching
        let sanitized = query
            .replacingOccurrences(of: "\"", with: "\"\"")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !sanitized.isEmpty else { return [] }

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

    public func neighbors(of nodeId: String) throws -> [(node: Node, edgeType: String, weight: Double)] {
        let sql = """
            SELECT DISTINCT n.*, e.edge_type, e.weight
            FROM edges e
            JOIN nodes n ON n.id = CASE
                WHEN e.source_id = ? THEN e.target_id
                ELSE e.source_id
            END
            WHERE (e.source_id = ? OR (e.directed = 0 AND e.target_id = ?))
            AND n.deleted_at IS NULL
            ORDER BY e.weight DESC, n.name
            """

        let rows: [[String: Any]] = try query(sql, parameters: [nodeId, nodeId, nodeId])
        return rows.compactMap { row in
            guard let node = try? SQLiteRowDecoder().decode(Node.self, from: row),
                  let edgeType = row["edge_type"] as? String,
                  let weight = row["weight"] as? Double else { return nil }
            return (node, edgeType, weight)
        }
    }

    public func nodeImportance() throws -> [(nodeId: String, name: String, importance: Double)] {
        let sql = """
            SELECT
                n.id,
                n.name,
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
                  let name = row["name"] as? String,
                  let importance = row["importance"] as? Double else { return nil }
            return (id, name, importance)
        }
    }

    // MARK: - CRUD Operations

    public func createNode(_ node: Node) throws {
        let sql = """
            INSERT INTO nodes (id, node_type, name, content, summary, folder, tags, status, priority, importance, sort_order, created_at, modified_at, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

        let tagsJSON = try? JSONEncoder().encode(node.tags)
        let tagsString = tagsJSON.flatMap { String(data: $0, encoding: .utf8) }

        try execute(sql, parameters: [
            node.id,
            node.nodeType,
            node.name,
            node.content,
            node.summary,
            node.folder,
            tagsString,
            node.status,
            node.priority,
            node.importance,
            node.sortOrder,
            ISO8601DateFormatter().string(from: node.createdAt),
            ISO8601DateFormatter().string(from: node.modifiedAt),
            node.version
        ])
    }

    public func updateNode(_ node: Node) throws {
        let sql = """
            UPDATE nodes SET
                name = ?, content = ?, summary = ?, folder = ?, tags = ?, status = ?,
                priority = ?, importance = ?, sort_order = ?, modified_at = ?, version = version + 1
            WHERE id = ?
            """

        let tagsJSON = try? JSONEncoder().encode(node.tags)
        let tagsString = tagsJSON.flatMap { String(data: $0, encoding: .utf8) }

        try execute(sql, parameters: [
            node.name,
            node.content,
            node.summary,
            node.folder,
            tagsString,
            node.status,
            node.priority,
            node.importance,
            node.sortOrder,
            ISO8601DateFormatter().string(from: Date()),
            node.id
        ])
    }

    public func deleteNode(_ nodeId: String, hard: Bool = false) throws {
        if hard {
            try execute("DELETE FROM nodes WHERE id = ?", parameters: [nodeId])
        } else {
            try execute("UPDATE nodes SET deleted_at = datetime('now'), version = version + 1 WHERE id = ?", parameters: [nodeId])
        }
    }

    public func getNode(_ id: String) throws -> Node? {
        let results: [Node] = try query("SELECT * FROM nodes WHERE id = ? AND deleted_at IS NULL", parameters: [id])
        return results.first
    }

    public func getAllNodes(folder: String? = nil, limit: Int = 100) throws -> [Node] {
        var sql = "SELECT * FROM nodes WHERE deleted_at IS NULL"
        var params: [Any?] = []

        if let folder {
            sql += " AND folder = ?"
            params.append(folder)
        }

        sql += " ORDER BY modified_at DESC LIMIT ?"
        params.append(limit)

        return try query(sql, parameters: params)
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
            case let value as Int64:
                sqlite3_bind_int64(statement, sqlIndex, value)
            case let value as Double:
                sqlite3_bind_double(statement, sqlIndex, value)
            case let value as Data:
                value.withUnsafeBytes { ptr in
                    sqlite3_bind_blob(statement, sqlIndex, ptr.baseAddress, Int32(value.count), SQLITE_TRANSIENT)
                }
            case let value as Bool:
                sqlite3_bind_int(statement, sqlIndex, value ? 1 : 0)
            default:
                throw DatabaseError.unsupportedType(String(describing: type(of: param)))
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
                if let bytes {
                    row[name] = Data(bytes: bytes, count: Int(count))
                }
            default:
                row[name] = NSNull()
            }
        }

        return row
    }

    private func runMigrations() throws {
        // Ensure migrations table exists
        try execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT DEFAULT (datetime('now')),
                description TEXT
            )
            """)

        // Get current version
        let results: [[String: Any]] = try query("SELECT MAX(version) as version FROM schema_migrations")
        let currentVersion = (results.first?["version"] as? Int64) ?? 0

        // Apply migrations
        let migrations: [(version: Int, description: String, sql: String)] = [
            (1, "Initial schema", Self.schemaV1),
            // Future migrations go here
        ]

        for migration in migrations where migration.version > currentVersion {
            logger.info("Applying migration \(migration.version): \(migration.description)")
            try execute(migration.sql)
            try execute(
                "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
                parameters: [migration.version, migration.description]
            )
        }
    }

    private static let schemaV1 = """
        -- Schema v1: Core tables, FTS5, sync state
        -- (Full schema from section 1.1)
        """
}

// MARK: - Error Types

public enum DatabaseError: LocalizedError {
    case notInitialized
    case openFailed(String)
    case prepareFailed(String)
    case executeFailed(String)
    case unsupportedType(String)

    public var errorDescription: String? {
        switch self {
        case .notInitialized: return "Database not initialized"
        case .openFailed(let msg): return "Failed to open database: \(msg)"
        case .prepareFailed(let msg): return "Failed to prepare statement: \(msg)"
        case .executeFailed(let msg): return "Failed to execute statement: \(msg)"
        case .unsupportedType(let type): return "Unsupported parameter type: \(type)"
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

public struct Node: Codable, Identifiable, Hashable, Sendable {
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

public struct Edge: Codable, Identifiable, Hashable, Sendable {
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

    public enum EdgeType: String, Codable, CaseIterable, Sendable {
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

## Phase 3: CloudKit Sync

### 3.1 CloudKit Sync Manager (Actor Model)

```swift
// Sources/Sync/CloudKitSyncManager.swift

import CloudKit
import os.log

/// Manages bidirectional sync between local SQLite and CloudKit
public actor CloudKitSyncManager {

    public static let shared = CloudKitSyncManager()

    private let container = CKContainer(identifier: "iCloud.com.yourcompany.isometry")
    private let database: CKDatabase
    private let zoneID = CKRecordZone.ID(zoneName: "IsometryZone", ownerName: CKCurrentUserDefaultName)
    private let logger = Logger(subsystem: "com.isometry", category: "Sync")

    // Published state (for SwiftUI observation)
    @MainActor public private(set) var syncState: SyncState = .idle
    @MainActor public private(set) var lastSyncDate: Date?
    @MainActor public private(set) var pendingChanges: Int = 0
    @MainActor public private(set) var lastError: String?

    public enum SyncState: Equatable, Sendable {
        case idle
        case syncing
        case error(String)
        case offline
    }

    private var consecutiveFailures = 0
    private let maxRetries = 3

    private init() {
        database = container.privateCloudDatabase
    }

    // MARK: - Setup

    public func setup() async throws {
        // Create custom zone
        let zone = CKRecordZone(zoneID: zoneID)

        do {
            _ = try await database.modifyRecordZones(saving: [zone], deleting: [])
            logger.info("Created/verified IsometryZone")
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Zone already exists
            logger.debug("IsometryZone already exists")
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
            logger.info("Created/verified push subscription")
        } catch let error as CKError where error.code == .serverRecordChanged {
            // Subscription already exists
        }
    }

    // MARK: - Sync Operations

    public func sync() async {
        // Check current state
        let currentState = await MainActor.run { syncState }
        guard currentState != .syncing else {
            logger.debug("Sync already in progress, skipping")
            return
        }

        await MainActor.run { syncState = .syncing }

        do {
            // 1. Push local changes
            let pushed = try await pushLocalChanges()
            logger.info("Pushed \(pushed) local changes")

            // 2. Pull remote changes
            let pulled = try await pullRemoteChanges()
            logger.info("Pulled \(pulled) remote changes")

            // Success - reset failure counter
            consecutiveFailures = 0

            await MainActor.run {
                lastSyncDate = Date()
                syncState = .idle
                lastError = nil
            }

            // Update sync state in database
            try await IsometryDatabase.shared.execute("""
                UPDATE sync_state SET
                    last_sync_at = datetime('now'),
                    pending_changes = 0,
                    consecutive_failures = 0,
                    last_error = NULL
                WHERE id = 'default'
                """)

        } catch {
            consecutiveFailures += 1
            let errorMessage = error.localizedDescription

            await MainActor.run {
                syncState = .error(errorMessage)
                lastError = errorMessage
            }

            // Record error in database
            try? await IsometryDatabase.shared.execute("""
                UPDATE sync_state SET
                    consecutive_failures = ?,
                    last_error = ?,
                    last_error_at = datetime('now')
                WHERE id = 'default'
                """, parameters: [consecutiveFailures, errorMessage])

            logger.error("Sync failed: \(errorMessage)")

            // Retry with exponential backoff
            if consecutiveFailures < maxRetries {
                let delay = pow(2.0, Double(consecutiveFailures))
                logger.info("Retrying sync in \(delay) seconds")
                try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                await sync()
            }
        }
    }

    // MARK: - Push Changes

    private func pushLocalChanges() async throws -> Int {
        // Get nodes modified since last sync
        let modifiedNodes: [Node] = try await IsometryDatabase.shared.query("""
            SELECT * FROM nodes
            WHERE modified_at > COALESCE(last_synced_at, '1970-01-01')
            ORDER BY modified_at
            """)

        let modifiedEdges: [Edge] = try await IsometryDatabase.shared.query("""
            SELECT * FROM edges
            WHERE sync_version > (
                SELECT COALESCE(MAX(sync_version), 0) FROM sync_state
            )
            """)

        guard !modifiedNodes.isEmpty || !modifiedEdges.isEmpty else { return 0 }

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

        // Batch save with atomic operation
        let operation = CKModifyRecordsOperation(recordsToSave: recordsToSave)
        operation.savePolicy = .changedKeys
        operation.qualityOfService = .userInitiated
        operation.isAtomic = false  // Allow partial success

        return try await withCheckedThrowingContinuation { continuation in
            var savedCount = 0

            operation.perRecordSaveBlock = { _, result in
                if case .success = result {
                    savedCount += 1
                }
            }

            operation.modifyRecordsResultBlock = { result in
                switch result {
                case .success:
                    continuation.resume(returning: savedCount)
                case .failure(let error):
                    continuation.resume(throwing: error)
                }
            }

            database.add(operation)
        }
    }

    // MARK: - Pull Changes

    private func pullRemoteChanges() async throws -> Int {
        // Get server change token
        var changeToken: CKServerChangeToken?
        let tokenResults: [[String: Any]] = try await IsometryDatabase.shared.query(
            "SELECT last_sync_token FROM sync_state WHERE id = 'default'"
        )
        if let data = tokenResults.first?["last_sync_token"] as? Data {
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
            try await applyRemoteChange(record)
        }

        for recordID in deletedRecordIDs {
            try await applyRemoteDeletion(recordID)
        }

        // Save new token
        if let token = newToken,
           let tokenData = try? NSKeyedArchiver.archivedData(withRootObject: token, requiringSecureCoding: true) {
            try await IsometryDatabase.shared.execute(
                "UPDATE sync_state SET last_sync_token = ? WHERE id = 'default'",
                parameters: [tokenData]
            )
        }

        return changedRecords.count + deletedRecordIDs.count
    }

    private func applyRemoteChange(_ record: CKRecord) async throws {
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

            let tagsJSON: String? = (record["tags"] as? [String]).flatMap {
                try? String(data: JSONEncoder().encode($0), encoding: .utf8)
            }

            try await IsometryDatabase.shared.execute(sql, parameters: [
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

            try await IsometryDatabase.shared.execute(sql, parameters: [
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

    private func applyRemoteDeletion(_ recordID: CKRecord.ID) async throws {
        let id = recordID.recordName

        // Soft delete for nodes
        try await IsometryDatabase.shared.execute(
            "UPDATE nodes SET deleted_at = datetime('now') WHERE id = ?",
            parameters: [id]
        )

        // Hard delete for edges
        try await IsometryDatabase.shared.execute(
            "DELETE FROM edges WHERE id = ?",
            parameters: [id]
        )
    }

    // MARK: - Conflict Resolution

    public enum ConflictResolution: Sendable {
        case keepLocal
        case keepRemote
        case merge(Node)
    }

    public func resolveConflict(localNode: Node, remoteNode: Node, resolution: ConflictResolution) async throws {
        switch resolution {
        case .keepLocal:
            // Force push local version with incremented version
            var updated = localNode
            updated.version = max(localNode.version, remoteNode.version) + 1
            try await IsometryDatabase.shared.updateNode(updated)
            await sync()

        case .keepRemote:
            // Apply remote version locally
            try await IsometryDatabase.shared.updateNode(remoteNode)

        case .merge(let merged):
            // Apply merged version
            var updated = merged
            updated.version = max(localNode.version, remoteNode.version) + 1
            try await IsometryDatabase.shared.updateNode(updated)
            await sync()
        }

        logger.info("Resolved conflict for node \(localNode.id)")
    }
}
```

### 3.2 Sync Status SwiftUI View

```swift
// Sources/Views/SyncStatusView.swift

import SwiftUI

struct SyncStatusView: View {
    @ObservedObject private var syncManager = CloudKitSyncManager.shared

    var body: some View {
        HStack(spacing: 8) {
            // Status indicator
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            // Status text
            Text(statusText)
                .font(.caption)
                .foregroundColor(.secondary)

            // Last sync time
            if let lastSync = syncManager.lastSyncDate {
                Text("• \(lastSync, style: .relative)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Manual sync button
            Button(action: {
                Task { await syncManager.sync() }
            }) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .rotationEffect(.degrees(syncManager.syncState == .syncing ? 360 : 0))
                    .animation(
                        syncManager.syncState == .syncing
                            ? .linear(duration: 1).repeatForever(autoreverses: false)
                            : .default,
                        value: syncManager.syncState
                    )
            }
            .disabled(syncManager.syncState == .syncing)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.systemBackground).opacity(0.9))
    }

    private var statusColor: Color {
        switch syncManager.syncState {
        case .idle: return .green
        case .syncing: return .blue
        case .error: return .red
        case .offline: return .orange
        }
    }

    private var statusText: String {
        switch syncManager.syncState {
        case .idle: return "Synced"
        case .syncing: return "Syncing..."
        case .error(let message): return "Error: \(message)"
        case .offline: return "Offline"
        }
    }
}
```

---

## Phase 4: Web Support (Optional, Future)

> **Note**: This phase is deferred to v4.0+. Native iOS/macOS apps are fully functional with Phases 1-3.

### 4.1 Options for Web

When web support is needed, two approaches:

**Option A: SQLite WASM + OPFS (Full Offline)**

- Use official SQLite WASM build with Origin Private File System
- Full FTS5 and CTE support
- Requires sync server to bridge to CloudKit

**Option B: Online-Only (Simpler)**

- REST API to sync server
- No local storage complexity
- Requires internet connection

Recommendation: Start with online-only for simplicity, add OPFS later if offline is critical.

---

## Phase 5: Testing

### 5.1 Unit Tests

```swift
// Tests/DatabaseTests.swift

import XCTest
@testable import Isometry

final class IsometryDatabaseTests: XCTestCase {

    var db: IsometryDatabase!

    override func setUp() async throws {
        db = IsometryDatabase()
        let testURL = FileManager.default.temporaryDirectory.appendingPathComponent("test-\(UUID()).db")
        try await db.initialize(at: testURL)
    }

    // MARK: - CRUD Tests

    func testCreateAndRetrieveNode() async throws {
        let node = Node(name: "Test Node", content: "Test content")
        try await db.createNode(node)

        let retrieved = try await db.getNode(node.id)
        XCTAssertNotNil(retrieved)
        XCTAssertEqual(retrieved?.name, "Test Node")
        XCTAssertEqual(retrieved?.content, "Test content")
    }

    func testUpdateNode() async throws {
        var node = Node(name: "Original")
        try await db.createNode(node)

        node.name = "Updated"
        node.content = "New content"
        try await db.updateNode(node)

        let retrieved = try await db.getNode(node.id)
        XCTAssertEqual(retrieved?.name, "Updated")
        XCTAssertEqual(retrieved?.content, "New content")
    }

    func testSoftDelete() async throws {
        let node = Node(name: "To Delete")
        try await db.createNode(node)

        try await db.deleteNode(node.id, hard: false)

        let retrieved = try await db.getNode(node.id)
        XCTAssertNil(retrieved) // Soft-deleted nodes should not be returned
    }

    // MARK: - FTS5 Tests

    func testFullTextSearch() async throws {
        let node1 = Node(name: "Apple iPhone", content: "A smartphone made by Apple")
        let node2 = Node(name: "Android Phone", content: "A smartphone running Android")
        let node3 = Node(name: "Banana", content: "A yellow fruit")

        try await db.createNode(node1)
        try await db.createNode(node2)
        try await db.createNode(node3)

        let results = try await db.search("smartphone")
        XCTAssertEqual(results.count, 2)
        XCTAssertTrue(results.contains { $0.name == "Apple iPhone" })
        XCTAssertTrue(results.contains { $0.name == "Android Phone" })
    }

    func testFTSPrefixSearch() async throws {
        let node = Node(name: "Programming", content: "Writing code")
        try await db.createNode(node)

        let results = try await db.search("prog")
        XCTAssertEqual(results.count, 1)
        XCTAssertEqual(results.first?.name, "Programming")
    }

    // MARK: - Graph Tests

    func testConnectedNodes() async throws {
        // Create nodes
        let center = Node(name: "Center")
        let neighbor1 = Node(name: "Neighbor 1")
        let neighbor2 = Node(name: "Neighbor 2")
        let distant = Node(name: "Distant")

        try await db.createNode(center)
        try await db.createNode(neighbor1)
        try await db.createNode(neighbor2)
        try await db.createNode(distant)

        // Create edges: center -> neighbor1 -> distant, center -> neighbor2
        try await db.execute("""
            INSERT INTO edges (id, edge_type, source_id, target_id) VALUES
            (?, 'LINK', ?, ?),
            (?, 'LINK', ?, ?),
            (?, 'LINK', ?, ?)
            """, parameters: [
                UUID().uuidString, center.id, neighbor1.id,
                UUID().uuidString, center.id, neighbor2.id,
                UUID().uuidString, neighbor1.id, distant.id
            ])

        // Depth 1: should find neighbor1 and neighbor2
        let depth1 = try await db.connectedNodes(from: center.id, maxDepth: 1)
        XCTAssertEqual(depth1.count, 3) // center + 2 neighbors

        // Depth 2: should also find distant
        let depth2 = try await db.connectedNodes(from: center.id, maxDepth: 2)
        XCTAssertEqual(depth2.count, 4) // center + 2 neighbors + distant
    }

    func testShortestPath() async throws {
        let a = Node(name: "A")
        let b = Node(name: "B")
        let c = Node(name: "C")
        let d = Node(name: "D")

        try await db.createNode(a)
        try await db.createNode(b)
        try await db.createNode(c)
        try await db.createNode(d)

        // A -> B -> D (length 2)
        // A -> C -> D (length 2)
        try await db.execute("""
            INSERT INTO edges (id, edge_type, source_id, target_id, directed) VALUES
            (?, 'LINK', ?, ?, 0),
            (?, 'LINK', ?, ?, 0),
            (?, 'LINK', ?, ?, 0),
            (?, 'LINK', ?, ?, 0)
            """, parameters: [
                UUID().uuidString, a.id, b.id,
                UUID().uuidString, b.id, d.id,
                UUID().uuidString, a.id, c.id,
                UUID().uuidString, c.id, d.id
            ])

        let path = try await db.shortestPath(from: a.id, to: d.id)
        XCTAssertNotNil(path)
        XCTAssertEqual(path?.count, 3) // A -> B/C -> D
        XCTAssertEqual(path?.first, a.id)
        XCTAssertEqual(path?.last, d.id)
    }

    func testNodeImportance() async throws {
        let hub = Node(name: "Hub")
        let spoke1 = Node(name: "Spoke 1")
        let spoke2 = Node(name: "Spoke 2")
        let spoke3 = Node(name: "Spoke 3")

        try await db.createNode(hub)
        try await db.createNode(spoke1)
        try await db.createNode(spoke2)
        try await db.createNode(spoke3)

        // All spokes point to hub
        try await db.execute("""
            INSERT INTO edges (id, edge_type, source_id, target_id, weight) VALUES
            (?, 'LINK', ?, ?, 1.0),
            (?, 'LINK', ?, ?, 2.0),
            (?, 'LINK', ?, ?, 3.0)
            """, parameters: [
                UUID().uuidString, spoke1.id, hub.id,
                UUID().uuidString, spoke2.id, hub.id,
                UUID().uuidString, spoke3.id, hub.id
            ])

        let importance = try await db.nodeImportance()
        let hubImportance = importance.first { $0.nodeId == hub.id }

        XCTAssertNotNil(hubImportance)
        XCTAssertEqual(hubImportance?.importance, 6.0) // 1 + 2 + 3
    }
}
```

### 5.2 Integration Tests

```swift
// Tests/SyncIntegrationTests.swift

import XCTest
@testable import Isometry

final class SyncIntegrationTests: XCTestCase {

    func testSyncRoundTrip() async throws {
        // Create local node
        let node = Node(name: "Sync Test", content: "Testing sync")
        try await IsometryDatabase.shared.createNode(node)

        // Trigger sync
        await CloudKitSyncManager.shared.sync()

        // Verify sync completed
        let state = await CloudKitSyncManager.shared.syncState
        XCTAssertEqual(state, .idle)
    }

    func testOfflineQueue() async throws {
        // Simulate offline
        // Create changes while offline
        // Come back online
        // Verify changes synced
    }

    func testConflictResolution() async throws {
        // Create same node on two devices
        // Make different changes
        // Sync both
        // Verify conflict detected and resolved
    }
}
```

### 5.3 Performance Tests

```swift
// Tests/PerformanceTests.swift

import XCTest
@testable import Isometry

final class PerformanceTests: XCTestCase {

    func testBulkInsert10K() async throws {
        let db = IsometryDatabase()
        let testURL = FileManager.default.temporaryDirectory.appendingPathComponent("perf-\(UUID()).db")
        try await db.initialize(at: testURL)

        measure {
            let expectation = expectation(description: "Bulk insert")

            Task {
                for i in 0..<10_000 {
                    let node = Node(name: "Node \(i)", content: "Content \(i)")
                    try await db.createNode(node)
                }
                expectation.fulfill()
            }

            wait(for: [expectation], timeout: 60)
        }
    }

    func testFTS10KNodes() async throws {
        // Pre-populate 10K nodes
        // Measure search performance

        measure {
            let expectation = expectation(description: "FTS search")

            Task {
                _ = try await db.search("test query")
                expectation.fulfill()
            }

            wait(for: [expectation], timeout: 5)
        }
    }

    func testGraphTraversal100KEdges() async throws {
        // Pre-populate graph with 100K edges
        // Measure traversal performance

        measure {
            let expectation = expectation(description: "Graph traversal")

            Task {
                _ = try await db.connectedNodes(from: "center-node", maxDepth: 3)
                expectation.fulfill()
            }

            wait(for: [expectation], timeout: 10)
        }
    }
}
```

---

## Phase 6: Rollout

### 6.1 Pre-Release Checklist

**Apple Developer Setup:**

- [ ] Create App ID with iCloud capability
- [ ] Create CloudKit container `iCloud.com.yourcompany.isometry`
- [ ] Configure CloudKit schema in dashboard
- [ ] Enable push notifications for sync

**Code Quality:**

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Performance benchmarks meet targets
- [ ] No memory leaks in Instruments
- [ ] Thread sanitizer clean

**Data Safety:**

- [ ] Migration tested with production-like data
- [ ] Backup/restore verified
- [ ] Conflict resolution tested
- [ ] Offline mode tested (airplane mode)

### 6.2 TestFlight Beta

- [ ] Deploy to internal testers
- [ ] Monitor CloudKit dashboard for errors
- [ ] Collect sync success/failure metrics
- [ ] Document any issues found

### 6.3 Production Metrics

Monitor these after launch:

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Sync success rate | > 99% | < 95% |
| Sync latency (p95) | < 2s | > 5s |
| Conflict rate | < 1% | > 5% |
| Error rate | < 0.1% | > 1% |

---

## Phase Dependencies

| Phase | Description                      | Dependencies | Required |
|-------|----------------------------------|--------------|----------|
| 1     | Schema Design (FTS5 + Graph)     | None         | Yes      |
| 2     | iOS/macOS Native Layer (Swift)   | Phase 1      | Yes      |
| 3     | CloudKit Sync                    | Phase 2      | Yes      |
| 4     | Web Support                      | Phase 1      | No (v4.0+) |
| 5     | Testing                          | Phases 1-3   | Yes      |
| 6     | Rollout                          | Phase 5      | Yes      |

Native apps are fully functional after Phases 1-3. Web support is optional and deferred.

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| — | iOS 15+ deployment | Manual CloudKit ops work everywhere; CKSyncEngine requires iOS 17 |
| — | Swift Actor model | Compile-time thread safety, cleaner than DispatchQueue |
| — | Version-based conflict resolution | Simple, deterministic, works offline |
| — | Soft delete for nodes | Preserves history, enables undo, prevents data loss |
| — | Hard delete for edges | Edges are cheap to recreate, reduces sync complexity |
| — | Defer web support | Focus on native quality; web can use API later |

---

## Why Not sql.js for Native?

The web prototype used sql.js (WASM) for cross-platform consistency. For native, pure SQLite is better:

| Aspect | sql.js (WASM) | Native SQLite |
|--------|---------------|---------------|
| Performance | WASM overhead | Native speed |
| Binary size | +2MB | 0 (system library) |
| FTS5 | Not in CDN builds | Full support |
| Recursive CTEs | Slower in WASM | Native speed |
| Offline sync | Must implement | CloudKit provides |
| Thread safety | Manual | Actor model |

**Bottom line**: No benefit to web tech on native platforms. SQLite + CloudKit is the right architecture.
