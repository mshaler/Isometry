-- ============================================================================
-- Isometry SQLite Schema
-- ============================================================================
-- Optimized for LATCH filtering and GRAPH traversal
-- Compatible with sql.js (browser) and SQLite.swift (native)
-- ============================================================================

-- ============================================================================
-- CARDS & CONNECTIONS (Phase 84 - New Primary Data Model)
-- ============================================================================
-- Cards replace nodes with 4 distinct types: note, person, event, resource
-- Connections replace edges with via_card_id for intermediated relationships

-- Cards: Primary data table (4 types with constrained card_type)
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note' CHECK(card_type IN ('note', 'person', 'event', 'resource')),
    name TEXT NOT NULL,
    content TEXT,
    summary TEXT,

    -- LATCH: Location
    latitude REAL,
    longitude REAL,
    location_name TEXT,

    -- LATCH: Time
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    due_at TEXT,
    completed_at TEXT,
    event_start TEXT,
    event_end TEXT,

    -- LATCH: Category
    folder TEXT,
    tags TEXT,  -- JSON array
    status TEXT,

    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Resource-specific fields
    url TEXT,
    mime_type TEXT,

    -- Person-specific fields
    is_collective INTEGER NOT NULL DEFAULT 0,  -- 0 = individual, 1 = group/org

    -- Source tracking
    source TEXT,
    source_id TEXT,

    -- Lifecycle management
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT DEFAULT 'pending'  -- pending, synced, conflict
);

-- Indexes for cards table (LATCH filtering)
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_folder ON cards(folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_modified ON cards(modified_at);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_priority ON cards(priority DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at) WHERE due_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_event ON cards(event_start) WHERE event_start IS NOT NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_source ON cards(source, source_id) WHERE source IS NOT NULL AND source_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cards_active ON cards(deleted_at) WHERE deleted_at IS NULL;

-- Connections: Relationships between cards (replaces edges)
-- Key difference: via_card_id allows intermediated connections (e.g., "met at" an event)
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
    label TEXT,  -- User-provided relationship label (schema-on-read)
    weight REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(source_id, target_id, via_card_id)
);

-- Indexes for connections table
CREATE INDEX IF NOT EXISTS idx_conn_source ON connections(source_id);
CREATE INDEX IF NOT EXISTS idx_conn_target ON connections(target_id);
CREATE INDEX IF NOT EXISTS idx_conn_via ON connections(via_card_id) WHERE via_card_id IS NOT NULL;

-- FTS5 virtual table for cards full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    name,
    content,
    tags,
    folder,
    content='cards',
    content_rowid='rowid'
);

-- FTS5 triggers for cards
CREATE TRIGGER IF NOT EXISTS trg_cards_fts_insert AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_cards_fts_delete AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_cards_fts_update AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

-- Version increment trigger for cards
-- Automatically increments version on any UPDATE to cards table
-- Respects manually set versions (only increments if version wasn't changed)
CREATE TRIGGER IF NOT EXISTS increment_cards_version_on_update
AFTER UPDATE ON cards
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
    UPDATE cards SET version = OLD.version + 1 WHERE id = NEW.id;
END;

-- Card Properties: Dynamic key-value storage for arbitrary properties (renamed from node_properties)
-- Note: This table definition is for new installations. Migration script handles renaming.
CREATE TABLE IF NOT EXISTS card_properties (
    id TEXT PRIMARY KEY,
    card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,  -- Legacy JSON/text fallback
    value_type TEXT NOT NULL DEFAULT 'string',  -- string, number, boolean, array, object, null
    value_string TEXT,   -- Fast path for string predicates
    value_number REAL,   -- Fast path for numeric range predicates
    value_boolean INTEGER, -- 0/1 boolean predicates
    value_json TEXT,     -- JSON payload for arrays/objects
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(card_id, key)  -- One value per key per card
);

-- Indexes for card_properties
CREATE INDEX IF NOT EXISTS idx_card_properties_card_id ON card_properties(card_id);
CREATE INDEX IF NOT EXISTS idx_card_properties_key ON card_properties(key);
CREATE INDEX IF NOT EXISTS idx_card_properties_lookup ON card_properties(card_id, key);
CREATE INDEX IF NOT EXISTS idx_card_properties_value_number ON card_properties(key, value_number);
CREATE INDEX IF NOT EXISTS idx_card_properties_value_string ON card_properties(key, value_string);

-- ============================================================================
-- LEGACY TABLES (Nodes & Edges - kept for migration, will be dropped in Plan 04)
-- ============================================================================

-- Nodes: Primary data table (cards) [LEGACY - migrate to cards table]
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
    
    -- Grid positioning for SuperGrid
    grid_x REAL DEFAULT 0,
    grid_y REAL DEFAULT 0,

    -- Metadata
    source TEXT,
    source_id TEXT,
    source_url TEXT,
    deleted_at TEXT,
    version INTEGER DEFAULT 1
);

-- Indexes for LATCH filtering
CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder);
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(deleted_at) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source ON nodes(source, source_id) WHERE source IS NOT NULL;

-- Full-text search index on name/content
CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
CREATE INDEX IF NOT EXISTS idx_nodes_content ON nodes(content);

-- Node Properties: Dynamic key-value storage for arbitrary YAML frontmatter
CREATE TABLE IF NOT EXISTS node_properties (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value TEXT,  -- Legacy JSON/text fallback
    value_type TEXT NOT NULL DEFAULT 'string',  -- string, number, boolean, array, object, null
    value_string TEXT,   -- Fast path for string predicates
    value_number REAL,   -- Fast path for numeric range predicates
    value_boolean INTEGER, -- 0/1 boolean predicates
    value_json TEXT,     -- JSON payload for arrays/objects
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(node_id, key)  -- One value per key per node
);

-- Indexes for efficient property queries
CREATE INDEX IF NOT EXISTS idx_node_properties_node_id ON node_properties(node_id);
CREATE INDEX IF NOT EXISTS idx_node_properties_key ON node_properties(key);
CREATE INDEX IF NOT EXISTS idx_node_properties_lookup ON node_properties(node_id, key);
CREATE INDEX IF NOT EXISTS idx_node_properties_value_number ON node_properties(key, value_number);
CREATE INDEX IF NOT EXISTS idx_node_properties_value_string ON node_properties(key, value_string);

-- ETL import run metadata and reconciliation reporting
CREATE TABLE IF NOT EXISTS etl_import_runs (
    run_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running', -- running, completed, failed
    total_files INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    options_json TEXT,
    reconciliation_json TEXT
);

CREATE TABLE IF NOT EXISTS etl_import_run_types (
    run_id TEXT NOT NULL REFERENCES etl_import_runs(run_id) ON DELETE CASCADE,
    node_type TEXT NOT NULL,
    imported_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (run_id, node_type)
);

CREATE INDEX IF NOT EXISTS idx_etl_import_runs_started_at ON etl_import_runs(started_at DESC);

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

-- Version increment trigger
-- Automatically increments version on any UPDATE to nodes table
-- Respects manually set versions (only increments if version wasn't changed)
CREATE TRIGGER IF NOT EXISTS increment_version_on_update
AFTER UPDATE ON nodes
FOR EACH ROW
WHEN NEW.version = OLD.version
BEGIN
    UPDATE nodes SET version = OLD.version + 1 WHERE id = NEW.id;
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
    UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);

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

-- Seed only universal facets that exist in all data sources (Apple Notes, etc.)
-- App-specific facets (status, priority, due) are NOT seeded here - use schema-on-read discovery
INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column) VALUES
    ('folder', 'Folder', 'select', 'H', 'folder'),
    ('tags', 'Tags', 'multi_select', 'C', 'tags'),
    ('created', 'Created', 'date', 'T', 'created_at'),
    ('modified', 'Modified', 'date', 'T', 'modified_at'),
    ('name', 'Name', 'text', 'A', 'name');

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

-- ============================================================================
-- Notebook Cards: Extended functionality for notebook sidecar
-- ============================================================================

-- Notebook Cards: Links to nodes table for seamless integration
CREATE TABLE IF NOT EXISTS notebook_cards (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    markdown_content TEXT,
    rendered_content TEXT,
    properties TEXT,  -- JSON object for custom properties panel
    template_id TEXT,
    card_type TEXT NOT NULL DEFAULT 'capture' CHECK (card_type IN ('capture', 'shell', 'preview')),
    layout_position TEXT,  -- JSON object for component positioning
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(node_id)  -- One notebook card per node
);

-- Indexes for notebook cards performance
CREATE INDEX IF NOT EXISTS idx_notebook_cards_node_id ON notebook_cards(node_id);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_type ON notebook_cards(card_type);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_modified ON notebook_cards(modified_at);
CREATE INDEX IF NOT EXISTS idx_notebook_cards_template ON notebook_cards(template_id) WHERE template_id IS NOT NULL;

-- FTS5 virtual table for notebook cards
CREATE VIRTUAL TABLE IF NOT EXISTS notebook_cards_fts USING fts5(
    markdown_content,
    rendered_content,
    properties,
    content='notebook_cards',
    content_rowid='rowid'
);

-- FTS5 triggers for notebook cards
CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_insert AFTER INSERT ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(rowid, markdown_content, rendered_content, properties)
    VALUES (NEW.rowid, NEW.markdown_content, NEW.rendered_content, NEW.properties);
END;

CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_delete AFTER DELETE ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(notebook_cards_fts, rowid, markdown_content, rendered_content, properties)
    VALUES ('delete', OLD.rowid, OLD.markdown_content, OLD.rendered_content, OLD.properties);
END;

CREATE TRIGGER IF NOT EXISTS notebook_cards_fts_update AFTER UPDATE ON notebook_cards BEGIN
    INSERT INTO notebook_cards_fts(notebook_cards_fts, rowid, markdown_content, rendered_content, properties)
    VALUES ('delete', OLD.rowid, OLD.markdown_content, OLD.rendered_content, OLD.properties);
    INSERT INTO notebook_cards_fts(rowid, markdown_content, rendered_content, properties)
    VALUES (NEW.rowid, NEW.markdown_content, NEW.rendered_content, NEW.properties);
END;

-- Trigger to update modified_at timestamp on notebook cards
CREATE TRIGGER IF NOT EXISTS notebook_cards_update_modified AFTER UPDATE ON notebook_cards BEGIN
    UPDATE notebook_cards SET modified_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- Sample Data: MOVED TO TEST FIXTURES
-- ============================================================================
-- Sample nodes, edges, and notebook_cards have been removed from schema.sql
-- to prevent conflicts with real imported data (Apple Notes, etc.)
-- For development testing, see: src/db/__tests__/fixtures/sample-data.sql

-- ============================================================================
-- SuperGrid State Persistence (SuperSize feature)
-- ============================================================================

-- Header States: Persists expanded/collapsed state and column widths
CREATE TABLE IF NOT EXISTS header_states (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    app_context TEXT NOT NULL DEFAULT 'supergrid',
    state_data TEXT NOT NULL,  -- JSON: {expandedNodes, columnWidths, totalWidth, lastModified}
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(dataset_id, app_context)
);

CREATE INDEX IF NOT EXISTS idx_header_states_dataset ON header_states(dataset_id);
CREATE INDEX IF NOT EXISTS idx_header_states_context ON header_states(dataset_id, app_context);

-- Column Widths: Dedicated table for column width persistence (faster access)
CREATE TABLE IF NOT EXISTS column_widths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    app_context TEXT NOT NULL DEFAULT 'supergrid',
    width_data TEXT NOT NULL,  -- JSON: {headerId: width, ...}
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
    UNIQUE(dataset_id, app_context)
);

CREATE INDEX IF NOT EXISTS idx_column_widths_dataset ON column_widths(dataset_id);
CREATE INDEX IF NOT EXISTS idx_column_widths_context ON column_widths(dataset_id, app_context);

-- View State: Generic state persistence for SuperGrid features (SuperSize, SuperDynamic, etc.)
CREATE TABLE IF NOT EXISTS view_state (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    app_id TEXT NOT NULL DEFAULT 'isometry',
    family TEXT NOT NULL DEFAULT 'LATCH',  -- LATCH family for tier 2 state
    state_json TEXT NOT NULL,  -- JSON: feature-specific state
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_view_state_dataset ON view_state(dataset_id);
CREATE INDEX IF NOT EXISTS idx_view_state_family ON view_state(family);
CREATE INDEX IF NOT EXISTS idx_view_state_lookup ON view_state(id, family);

-- ============================================================================
-- Templates: Saved content templates for /template slash command
-- ============================================================================

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,  -- 'meeting', 'project', 'note', 'daily', 'custom'
    content TEXT NOT NULL,  -- Markdown content
    variables TEXT,  -- JSON array of variable placeholders
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    usage_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_templates_name ON templates(name);

-- FTS5 for template search
CREATE VIRTUAL TABLE IF NOT EXISTS templates_fts USING fts5(
    name,
    description,
    content,
    content='templates',
    content_rowid='rowid'
);

-- FTS5 triggers for templates
CREATE TRIGGER IF NOT EXISTS trg_templates_fts_insert AFTER INSERT ON templates BEGIN
    INSERT INTO templates_fts(rowid, name, description, content)
    VALUES (NEW.rowid, NEW.name, NEW.description, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_fts_delete AFTER DELETE ON templates BEGIN
    INSERT INTO templates_fts(templates_fts, rowid, name, description, content)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS trg_templates_fts_update AFTER UPDATE ON templates BEGIN
    INSERT INTO templates_fts(templates_fts, rowid, name, description, content)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.description, OLD.content);
    INSERT INTO templates_fts(rowid, name, description, content)
    VALUES (NEW.rowid, NEW.name, NEW.description, NEW.content);
END;
