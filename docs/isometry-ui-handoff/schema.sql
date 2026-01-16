-- ============================================================================
-- Isometry SQLite Schema
-- ============================================================================
-- Optimized for LATCH filtering and GRAPH traversal
-- Compatible with sql.js (browser) and SQLite.swift (native)
-- ============================================================================

-- ============================================================================
-- NODES TABLE
-- ============================================================================
-- The primary table for all card data (notes, tasks, contacts, etc.)
-- Uses LPG model: nodes have properties, edges connect nodes

CREATE TABLE IF NOT EXISTS nodes (
    -- Identity
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL DEFAULT 'note',  -- note, task, contact, event, etc.
    
    -- Content
    name TEXT NOT NULL,
    content TEXT,                             -- Rich text / markdown
    summary TEXT,                             -- AI-generated or manual summary
    
    -- LATCH: Location
    latitude REAL,
    longitude REAL,
    location_name TEXT,                       -- "Boulder, CO"
    location_address TEXT,                    -- Full address if available
    
    -- LATCH: Alphabet (handled by name column + collation)
    
    -- LATCH: Time
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    due_at TEXT,                              -- For tasks
    completed_at TEXT,                        -- For tasks
    event_start TEXT,                         -- For events
    event_end TEXT,                           -- For events
    
    -- LATCH: Category
    folder TEXT,                              -- Primary category / container
    tags TEXT,                                -- JSON array: ["tag1", "tag2"]
    status TEXT,                              -- For tasks: active, pending, completed, archived
    
    -- LATCH: Hierarchy
    priority INTEGER DEFAULT 0,               -- 0-5, higher = more important
    importance INTEGER DEFAULT 0,             -- Calculated or manual
    sort_order INTEGER DEFAULT 0,             -- Manual ordering within folder
    
    -- Metadata
    source TEXT,                              -- Where imported from: apple_notes, apple_reminders
    source_id TEXT,                           -- Original ID in source system
    source_url TEXT,                          -- Deep link back to source
    
    -- Soft delete
    deleted_at TEXT,
    
    -- Versioning (for future undo/history)
    version INTEGER DEFAULT 1
);

-- ============================================================================
-- NODES INDEXES
-- ============================================================================

-- LATCH: Location (for geospatial queries)
CREATE INDEX IF NOT EXISTS idx_nodes_location 
    ON nodes(latitude, longitude) 
    WHERE latitude IS NOT NULL;

-- LATCH: Alphabet (for sorted lists)
CREATE INDEX IF NOT EXISTS idx_nodes_name 
    ON nodes(name COLLATE NOCASE);

-- LATCH: Time (for date filtering)
CREATE INDEX IF NOT EXISTS idx_nodes_created 
    ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_modified 
    ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_due 
    ON nodes(due_at) 
    WHERE due_at IS NOT NULL;

-- LATCH: Category (for folder/status filtering)
CREATE INDEX IF NOT EXISTS idx_nodes_folder 
    ON nodes(folder);
CREATE INDEX IF NOT EXISTS idx_nodes_status 
    ON nodes(status) 
    WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_type 
    ON nodes(node_type);

-- LATCH: Hierarchy (for priority sorting)
CREATE INDEX IF NOT EXISTS idx_nodes_priority 
    ON nodes(priority DESC);

-- Soft delete filter
CREATE INDEX IF NOT EXISTS idx_nodes_active 
    ON nodes(deleted_at) 
    WHERE deleted_at IS NULL;

-- Source lookup (for ETL deduplication)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source 
    ON nodes(source, source_id) 
    WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- ============================================================================
-- FULL-TEXT SEARCH (FTS5)
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    content,
    tags,
    folder,
    content='nodes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS in sync
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
-- EDGES TABLE
-- ============================================================================
-- Relationships between nodes (LPG: edges are also first-class with properties)

CREATE TABLE IF NOT EXISTS edges (
    -- Identity
    id TEXT PRIMARY KEY,
    edge_type TEXT NOT NULL,                  -- LINK, NEST, SEQUENCE, AFFINITY
    
    -- Endpoints
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    
    -- Edge properties (edges are cards too!)
    label TEXT,                               -- Human-readable description
    weight REAL DEFAULT 1.0,                  -- Strength of relationship (0-1)
    directed INTEGER DEFAULT 1,               -- 1 = directed, 0 = undirected
    
    -- For SEQUENCE edges
    sequence_order INTEGER,
    
    -- For communication edges (messages, emails)
    channel TEXT,                             -- email, slack, text, linkedin
    timestamp TEXT,                           -- When the communication occurred
    subject TEXT,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    -- Prevent duplicate edges
    UNIQUE(source_id, target_id, edge_type)
);

-- ============================================================================
-- EDGES INDEXES
-- ============================================================================

-- Traversal from source
CREATE INDEX IF NOT EXISTS idx_edges_source 
    ON edges(source_id, edge_type);

-- Traversal from target (reverse)
CREATE INDEX IF NOT EXISTS idx_edges_target 
    ON edges(target_id, edge_type);

-- By type
CREATE INDEX IF NOT EXISTS idx_edges_type 
    ON edges(edge_type);

-- Sequence ordering
CREATE INDEX IF NOT EXISTS idx_edges_sequence 
    ON edges(source_id, sequence_order) 
    WHERE edge_type = 'SEQUENCE';

-- ============================================================================
-- FACETS TABLE
-- ============================================================================
-- Defines available facets for PAFV axis assignment

CREATE TABLE IF NOT EXISTS facets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,                       -- Display name
    facet_type TEXT NOT NULL,                 -- text, number, date, select, multi_select
    axis TEXT NOT NULL,                       -- L, A, T, C, H
    source_column TEXT NOT NULL,              -- Column in nodes table
    
    -- For select/multi_select types
    options TEXT,                             -- JSON array of allowed values
    
    -- Display
    icon TEXT,                                -- Lucide icon name
    color TEXT,                               -- Hex color
    
    -- State
    enabled INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

-- Default facets
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

-- ============================================================================
-- VIEWS TABLE
-- ============================================================================
-- Saved view configurations

CREATE TABLE IF NOT EXISTS views (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL,                  -- grid, list, kanban, timeline, network
    
    -- PAFV axis assignments (facet IDs)
    x_axis TEXT REFERENCES facets(id),
    y_axis TEXT REFERENCES facets(id),
    z_axis TEXT REFERENCES facets(id),
    
    -- Filter state (serialized DSL or JSON)
    filters TEXT,
    
    -- Sort
    sort_facet TEXT REFERENCES facets(id),
    sort_direction TEXT DEFAULT 'asc',        -- asc, desc
    
    -- Display options
    card_size TEXT DEFAULT 'medium',          -- small, medium, large
    show_preview INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_default INTEGER DEFAULT 0
);

-- ============================================================================
-- APPS TABLE
-- ============================================================================
-- App configurations (collections of views and filters)

CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    
    -- Default view
    default_view_id TEXT REFERENCES views(id),
    
    -- Base filter (always applied in this app)
    base_filter TEXT,
    
    -- Node types shown in this app
    node_types TEXT,                          -- JSON array: ["note", "task"]
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sort_order INTEGER DEFAULT 0,
    enabled INTEGER DEFAULT 1
);

-- Default apps
INSERT OR IGNORE INTO apps (id, name, icon, node_types) VALUES
    ('notes', 'Notes', 'sticky-note', '["note"]'),
    ('tasks', 'Tasks', 'check-square', '["task"]'),
    ('inbox', 'Inbox', 'inbox', '["note", "task"]');

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================
-- User preferences and app state

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('theme', 'NeXTSTEP'),
    ('sidebar_collapsed', 'false'),
    ('right_sidebar_collapsed', 'false'),
    ('footer_expanded', 'true'),
    ('last_app', 'notes'),
    ('last_view', 'grid');

-- ============================================================================
-- QUERY PATTERNS
-- ============================================================================
-- These are not executed, just documented for reference

/*
-- LATCH: Location filter (requires SpatiaLite for radius, basic box query without)
SELECT * FROM nodes 
WHERE latitude BETWEEN ? AND ? 
  AND longitude BETWEEN ? AND ?
  AND deleted_at IS NULL;

-- LATCH: Alphabet filter (A-M)
SELECT * FROM nodes 
WHERE SUBSTR(UPPER(name), 1, 1) BETWEEN 'A' AND 'M'
  AND deleted_at IS NULL
ORDER BY name COLLATE NOCASE;

-- LATCH: Time filter (last 7 days)
SELECT * FROM nodes 
WHERE modified_at >= datetime('now', '-7 days')
  AND deleted_at IS NULL
ORDER BY modified_at DESC;

-- LATCH: Category filter
SELECT * FROM nodes 
WHERE folder IN ('Work', 'Projects')
  AND deleted_at IS NULL;

-- LATCH: Hierarchy filter (top 10 by priority)
SELECT * FROM nodes 
WHERE deleted_at IS NULL
ORDER BY priority DESC
LIMIT 10;

-- Full-text search
SELECT n.* FROM nodes n
JOIN nodes_fts fts ON n.rowid = fts.rowid
WHERE nodes_fts MATCH 'search query'
  AND n.deleted_at IS NULL;

-- GRAPH: Direct links from a node
SELECT target.* FROM nodes target
JOIN edges e ON e.target_id = target.id
WHERE e.source_id = ?
  AND e.edge_type = 'LINK'
  AND target.deleted_at IS NULL;

-- GRAPH: 2-hop neighbors
WITH RECURSIVE neighbors AS (
    SELECT id, 0 as depth FROM nodes WHERE id = ?
    UNION
    SELECT 
        CASE WHEN e.source_id = n.id THEN e.target_id ELSE e.source_id END,
        n.depth + 1
    FROM neighbors n
    JOIN edges e ON e.source_id = n.id OR e.target_id = n.id
    WHERE n.depth < 2
)
SELECT DISTINCT nodes.* FROM nodes
JOIN neighbors ON nodes.id = neighbors.id
WHERE nodes.deleted_at IS NULL;

-- Aggregation: Count by folder
SELECT folder, COUNT(*) as count 
FROM nodes 
WHERE deleted_at IS NULL
GROUP BY folder 
ORDER BY count DESC;

-- Aggregation: Count by date (for timeline)
SELECT DATE(created_at) as date, COUNT(*) as count
FROM nodes
WHERE deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date;
*/
