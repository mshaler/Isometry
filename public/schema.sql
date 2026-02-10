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
-- Sample Data for Development and Testing
-- ============================================================================

-- Sample nodes for SuperGrid demonstration
INSERT OR IGNORE INTO nodes (id, name, content, summary, folder, status, priority, importance, grid_x, grid_y, created_at) VALUES
    ('card-1', 'Welcome to Isometry', 'This is a sample card to demonstrate the SuperGrid functionality.', 'Introduction to Isometry SuperGrid', 'personal', 'active', 5, 4, 100, 50, '2024-01-15 10:00:00'),
    ('card-2', 'Project Alpha', 'A high-priority project with multiple phases and deliverables.', 'Strategic project planning', 'work', 'in_progress', 5, 5, 250, 50, '2024-01-16 14:30:00'),
    ('card-3', 'Meeting Notes', 'Weekly team sync covering project status and next steps.', 'Team collaboration notes', 'work', 'completed', 3, 3, 400, 50, '2024-01-17 09:15:00'),
    ('card-4', 'Reading List', 'Books and articles to review for professional development.', 'Learning and development', 'personal', 'active', 2, 3, 100, 150, '2024-01-18 16:45:00'),
    ('card-5', 'Budget Review', 'Quarterly financial analysis and budget adjustments.', 'Financial planning', 'work', 'blocked', 4, 4, 250, 150, '2024-01-19 11:20:00'),
    ('card-6', 'Vacation Planning', 'Research and planning for upcoming vacation destinations.', 'Travel and leisure', 'personal', 'active', 1, 2, 400, 150, '2024-01-20 13:30:00'),
    ('card-7', 'Code Review', 'Review pull requests and provide feedback to team members.', 'Development workflow', 'work', 'active', 4, 4, 100, 250, '2024-01-21 08:45:00'),
    ('card-8', 'Gym Routine', 'Weekly workout schedule and fitness tracking.', 'Health and fitness', 'personal', 'active', 2, 3, 250, 250, '2024-01-22 07:00:00'),
    ('card-9', 'Client Presentation', 'Quarterly business review presentation for key client.', 'Client relationship management', 'work', 'in_progress', 5, 5, 400, 250, '2024-01-23 15:15:00'),
    ('card-10', 'Home Improvement', 'Kitchen renovation planning and contractor coordination.', 'Home and lifestyle', 'personal', 'active', 3, 2, 100, 350, '2024-01-24 12:00:00'),
    ('card-11', 'Team Training', 'Organize technical training sessions for development team.', 'Team development', 'work', 'active', 3, 4, 250, 350, '2024-01-25 10:30:00'),
    ('card-12', 'Research Paper', 'Academic research on machine learning applications.', 'Research and analysis', 'projects', 'in_progress', 4, 5, 400, 350, '2024-01-26 14:20:00');

-- Sample edges to demonstrate graph relationships
INSERT OR IGNORE INTO edges (id, edge_type, source_id, target_id, label, weight, directed) VALUES
    ('edge-1', 'LINK', 'card-2', 'card-9', 'related_to', 0.8, 1),
    ('edge-2', 'SEQUENCE', 'card-5', 'card-9', 'precedes', 1.0, 1),
    ('edge-3', 'LINK', 'card-7', 'card-11', 'supports', 0.6, 1),
    ('edge-4', 'NEST', 'card-2', 'card-7', 'contains', 1.0, 1),
    ('edge-5', 'AFFINITY', 'card-1', 'card-12', 'similar_theme', 0.4, 0);

-- Sample notebook cards for three-canvas integration
INSERT OR IGNORE INTO notebook_cards (id, node_id, card_type, markdown_content, properties) VALUES
    ('nb-1', 'card-1', 'capture', '# Welcome to Isometry\n\nThis demonstrates the three-canvas notebook integration.', '{"color": "blue", "pinned": true}'),
    ('nb-2', 'card-2', 'preview', '## Project Alpha Status\n\n- Phase 1: Complete\n- Phase 2: In Progress\n- Phase 3: Planning', '{"status_board": true}'),
    ('nb-3', 'card-12', 'shell', '```python\n# ML Research Code\nimport numpy as np\n```', '{"language": "python", "executable": true}');
