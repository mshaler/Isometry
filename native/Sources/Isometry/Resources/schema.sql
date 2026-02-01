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

-- Notebook Cards for capture-shell-preview workflow
CREATE TABLE IF NOT EXISTS notebook_cards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    markdown_content TEXT,
    properties TEXT DEFAULT '{}',  -- JSON object
    template_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    folder TEXT,
    tags TEXT DEFAULT '[]',  -- JSON array matching nodes table pattern

    -- Integration with existing nodes (optional relationship)
    linked_node_id TEXT REFERENCES nodes(id),

    -- CloudKit sync fields (matching existing pattern)
    sync_version INTEGER DEFAULT 0,
    last_synced_at TEXT,
    conflict_resolved_at TEXT,
    deleted_at TEXT,

    FOREIGN KEY (linked_node_id) REFERENCES nodes(id) ON DELETE SET NULL
);

-- Indexes for performance (match existing pattern)
CREATE INDEX IF NOT EXISTS idx_notebook_cards_created_at ON notebook_cards(created_at);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_modified_at ON notebook_cards(modified_at);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_folder ON notebook_cards(folder);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_template_id ON notebook_cards(template_id);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_sync ON notebook_cards(sync_version, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_active ON notebook_cards(deleted_at) WHERE deleted_at IS NULL;

-- Full-text search (matching existing FTS pattern)
CREATE VIRTUAL TABLE IF NOT EXISTS notebook_cards_fts USING fts5(
    title,
    markdown_content,
    content='notebook_cards',
    content_rowid='rowid'
);

-- FTS triggers to maintain search index (matching existing pattern)
CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_insert AFTER INSERT ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(rowid, title, markdown_content)
    VALUES (NEW.rowid, NEW.title, NEW.markdown_content);
END;

CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_delete AFTER DELETE ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(notebook_cards_fts, rowid, title, markdown_content)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.markdown_content);
END;

CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_update AFTER UPDATE ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(notebook_cards_fts, rowid, title, markdown_content)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.markdown_content);
    INSERT INTO notebook_cards_fts(rowid, title, markdown_content)
    VALUES (NEW.rowid, NEW.title, NEW.markdown_content);
END;

-- ============================================================================
-- Command History Tables
-- ============================================================================

-- Command history: Persistent storage for all executed commands
CREATE TABLE IF NOT EXISTS command_history (
    id TEXT PRIMARY KEY,
    command_text TEXT NOT NULL,
    command_type TEXT NOT NULL DEFAULT 'system', -- 'system' or 'claude'
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    duration REAL,
    success INTEGER, -- 0 for false, 1 for true, NULL for unknown
    output_preview TEXT, -- First 500 chars of output
    error_message TEXT,
    working_directory TEXT,
    session_id TEXT NOT NULL,

    -- CloudKit integration fields
    ck_record_id TEXT UNIQUE,
    ck_modified_date TEXT,
    sync_version INTEGER DEFAULT 0,
    last_synced_at TEXT,
    deleted_at TEXT,

    -- Performance fields
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Notebook context: Links commands to notebook cards
CREATE TABLE IF NOT EXISTS notebook_context (
    id TEXT PRIMARY KEY,
    command_id TEXT NOT NULL,
    card_id TEXT,
    card_title TEXT,
    context_type TEXT DEFAULT 'execution', -- 'execution', 'suggestion', etc.

    FOREIGN KEY (command_id) REFERENCES command_history(id) ON DELETE CASCADE,
    FOREIGN KEY (card_id) REFERENCES notebook_cards(id) ON DELETE SET NULL
);

-- Indexes for command history performance
CREATE INDEX IF NOT EXISTS idx_command_history_timestamp ON command_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_command_history_type ON command_history(command_type);
CREATE INDEX IF NOT EXISTS idx_command_history_session ON command_history(session_id);
CREATE INDEX IF NOT EXISTS idx_command_history_success ON command_history(success);
CREATE INDEX IF NOT EXISTS idx_command_history_sync ON command_history(sync_version, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_command_history_active ON command_history(deleted_at) WHERE deleted_at IS NULL;

-- Indexes for notebook context
CREATE INDEX IF NOT EXISTS idx_notebook_context_command ON notebook_context(command_id);
CREATE INDEX IF NOT EXISTS idx_notebook_context_card ON notebook_context(card_id);

-- Full-text search for command history
CREATE VIRTUAL TABLE IF NOT EXISTS command_history_fts USING fts5(
    command_text,
    output_preview,
    content='command_history',
    content_rowid='rowid'
);

-- FTS triggers for command history
CREATE TRIGGER IF NOT EXISTS command_history_fts_insert AFTER INSERT ON command_history BEGIN
    INSERT INTO command_history_fts(rowid, command_text, output_preview)
    VALUES (NEW.rowid, NEW.command_text, NEW.output_preview);
END;

CREATE TRIGGER IF NOT EXISTS command_history_fts_delete AFTER DELETE ON command_history BEGIN
    INSERT INTO command_history_fts(command_history_fts, rowid, command_text, output_preview)
    VALUES ('delete', OLD.rowid, OLD.command_text, OLD.output_preview);
END;

CREATE TRIGGER IF NOT EXISTS command_history_fts_update AFTER UPDATE ON command_history BEGIN
    INSERT INTO command_history_fts(command_history_fts, rowid, command_text, output_preview)
    VALUES ('delete', OLD.rowid, OLD.command_text, OLD.output_preview);
    INSERT INTO command_history_fts(rowid, command_text, output_preview)
    VALUES (NEW.rowid, NEW.command_text, NEW.output_preview);
END;

-- ============================================================================
-- CRDT Conflict Resolution Tables (Phase 20-02)
-- ============================================================================

-- CRDT metadata for distributed conflict resolution
CREATE TABLE IF NOT EXISTS crdt_metadata (
    node_id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
    site_id TEXT NOT NULL,  -- Device identifier for tiebreaker resolution
    column_version INTEGER NOT NULL DEFAULT 1,  -- Per-column CRDT version
    db_version INTEGER NOT NULL DEFAULT 1,  -- Global logical clock
    last_write_wins TEXT NOT NULL DEFAULT (datetime('now')),  -- LWW timestamp
    content_hash TEXT NOT NULL DEFAULT '',  -- For efficient conflict detection
    modified_fields TEXT DEFAULT '[]',  -- JSON array of changed field names
    last_synced_at TEXT,
    conflict_resolved_at TEXT
);

-- CRDT sync metadata for tracking device versions
CREATE TABLE IF NOT EXISTS crdt_sync_metadata (
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_version INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (node_id, device_id)
);

-- Conflict resolution history for audit and debugging
CREATE TABLE IF NOT EXISTS conflict_history (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    strategy TEXT NOT NULL,  -- 'auto_lww', 'manual', 'field_merge'
    winner_site_id TEXT NOT NULL,
    local_version INTEGER NOT NULL,
    server_version INTEGER NOT NULL,
    resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
    resolution_details TEXT  -- JSON with additional resolution info
);

-- Unresolved conflicts queue for manual resolution
CREATE TABLE IF NOT EXISTS pending_conflicts (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    conflict_type TEXT NOT NULL,  -- 'content', 'field_level', 'version_mismatch'
    local_data TEXT NOT NULL,  -- JSON serialized local node
    server_data TEXT NOT NULL,  -- JSON serialized server node
    detected_at TEXT NOT NULL DEFAULT (datetime('now')),
    conflicted_fields TEXT DEFAULT '[]'  -- JSON array of field names in conflict
);

-- Indexes for CRDT performance
CREATE INDEX IF NOT EXISTS idx_crdt_metadata_site ON crdt_metadata(site_id);
CREATE INDEX IF NOT EXISTS idx_crdt_metadata_version ON crdt_metadata(db_version, column_version);
CREATE INDEX IF NOT EXISTS idx_crdt_metadata_hash ON crdt_metadata(content_hash);
CREATE INDEX IF NOT EXISTS idx_crdt_sync_device ON crdt_sync_metadata(device_id);
CREATE INDEX IF NOT EXISTS idx_conflict_history_node ON conflict_history(node_id, resolved_at);
CREATE INDEX IF NOT EXISTS idx_pending_conflicts_node ON pending_conflicts(node_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_pending_conflicts_type ON pending_conflicts(conflict_type);

-- Extend nodes table with CRDT columns (migration approach)
-- These will be populated by triggers from crdt_metadata table
ALTER TABLE nodes ADD COLUMN site_id TEXT DEFAULT NULL;
ALTER TABLE nodes ADD COLUMN column_version INTEGER DEFAULT 1;
ALTER TABLE nodes ADD COLUMN db_version INTEGER DEFAULT 1;

-- Triggers to maintain CRDT metadata consistency
CREATE TRIGGER IF NOT EXISTS nodes_crdt_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO crdt_metadata (
        node_id, site_id, column_version, db_version,
        content_hash, modified_fields
    ) VALUES (
        NEW.id,
        COALESCE(NEW.site_id, 'device_default'),
        COALESCE(NEW.column_version, 1),
        COALESCE(NEW.db_version, 1),
        '',  -- Will be updated by application logic
        '[]'  -- Will be updated by application logic
    );
END;

CREATE TRIGGER IF NOT EXISTS nodes_crdt_update AFTER UPDATE ON nodes BEGIN
    UPDATE crdt_metadata SET
        column_version = COALESCE(NEW.column_version, column_version + 1),
        db_version = COALESCE(NEW.db_version, db_version),
        last_write_wins = datetime('now'),
        content_hash = '',  -- Will be updated by application logic
        modified_fields = '[]'  -- Will be updated by application logic
    WHERE node_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS nodes_crdt_delete AFTER DELETE ON nodes BEGIN
    DELETE FROM crdt_metadata WHERE node_id = OLD.id;
    DELETE FROM crdt_sync_metadata WHERE node_id = OLD.id;
    DELETE FROM conflict_history WHERE node_id = OLD.id;
    DELETE FROM pending_conflicts WHERE node_id = OLD.id;
END;

-- Record schema migrations
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (1, 'Initial schema with sync support');
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (2, 'Added notebook_cards table with FTS support');
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (3, 'Added command_history and notebook_context tables with FTS support');
INSERT OR IGNORE INTO schema_migrations (version, description) VALUES (4, 'Added CRDT metadata and conflict resolution tables');
