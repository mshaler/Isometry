-- ============================================================================
-- Isometry SQLite Schema
-- ============================================================================
-- Optimized for LATCH filtering and GRAPH traversal
-- Compatible with sql.js (browser) and SQLite.swift (native)
-- ============================================================================

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

-- TEMPORARY: Search view using LIKE until FTS5 is available
-- TODO Phase 4: Replace with FTS5 virtual table when custom sql.js build ready
CREATE VIEW IF NOT EXISTS nodes_fts AS
SELECT
    rowid,
    name,
    content,
    summary,
    tags,
    (name || ' ' || COALESCE(content, '') || ' ' || COALESCE(summary, '') || ' ' || COALESCE(tags, '')) AS search_content
FROM nodes
WHERE deleted_at IS NULL;

-- TEMPORARY: No triggers needed for view-based search
-- TODO Phase 4: Add FTS5 triggers when virtual table is implemented

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

-- TEMPORARY: Notebook search view using LIKE until FTS5 is available
-- TODO Phase 4: Replace with FTS5 virtual table when custom sql.js build ready
CREATE VIEW IF NOT EXISTS notebook_cards_fts AS
SELECT
    rowid,
    markdown_content,
    rendered_content,
    properties,
    (COALESCE(markdown_content, '') || ' ' || COALESCE(rendered_content, '') || ' ' || COALESCE(properties, '')) AS search_content
FROM notebook_cards;

-- TEMPORARY: No triggers needed for view-based search
-- TODO Phase 4: Add FTS5 triggers when virtual table is implemented

-- Trigger to update modified_at timestamp on notebook cards
CREATE TRIGGER IF NOT EXISTS notebook_cards_update_modified AFTER UPDATE ON notebook_cards BEGIN
    UPDATE notebook_cards SET modified_at = datetime('now') WHERE id = NEW.id;
END;
