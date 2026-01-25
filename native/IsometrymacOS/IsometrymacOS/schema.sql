-- ============================================================================
-- Isometry Native SQLite Schema
-- ============================================================================
-- Full SQLite features: FTS5, recursive CTEs, WAL mode
-- For iOS/macOS via GRDB.swift
-- ============================================================================

-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now')),
    description TEXT
);

-- Nodes: Primary data table (cards)
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

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    content,
    summary,
    tags,
    content='nodes',
    content_rowid='rowid'
);

-- FTS5 triggers to keep index in sync
CREATE TRIGGER IF NOT EXISTS nodes_fts_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(rowid, name, content, summary, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.summary, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_delete AFTER DELETE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.summary, OLD.tags);
END;

CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.summary, OLD.tags);
    INSERT INTO nodes_fts(rowid, name, content, summary, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.summary, NEW.tags);
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

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_sync ON edges(sync_version);

-- Facets: Available filtering dimensions
CREATE TABLE IF NOT EXISTS facets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    facet_type TEXT NOT NULL,
    axis TEXT NOT NULL,  -- L, A, T, C, H
    source_column TEXT NOT NULL,
    options TEXT,
    icon TEXT,
    color TEXT,
    enabled INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
    ('folder', 'Folder', 'select', 'C', 'folder'),
    ('tags', 'Tags', 'multi_select', 'C', 'tags'),
    ('status', 'Status', 'select', 'C', 'status'),
    ('priority', 'Priority', 'number', 'H', 'priority'),
    ('created', 'Created', 'date', 'T', 'created_at'),
    ('modified', 'Modified', 'date', 'T', 'modified_at'),
    ('due', 'Due Date', 'date', 'T', 'due_at'),
    ('name', 'Name', 'text', 'A', 'name'),
    ('location', 'Location', 'location', 'L', 'location_name');

-- Settings: User preferences
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', 'NeXTSTEP'),
    ('sidebar_collapsed', 'false'),
    ('right_sidebar_collapsed', 'false'),
    ('last_app', 'notes'),
    ('last_view', 'grid');

-- Sync state tracking
CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
    last_sync_token BLOB,
    last_sync_at TEXT,
    pending_changes INTEGER DEFAULT 0,
    conflict_count INTEGER DEFAULT 0,
    consecutive_failures INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TEXT
);

INSERT OR IGNORE INTO sync_state (id) VALUES ('default');

-- Record initial schema version
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (1, 'Initial schema with sync support');
