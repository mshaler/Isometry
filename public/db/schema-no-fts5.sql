-- ============================================================================
-- Isometry SQLite Schema (No FTS5 - for basic sql.js testing)
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

-- Edges: Graph relationships (first-class entities)
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    edge_type TEXT NOT NULL CHECK (edge_type IN ('LINK', 'NEST', 'SEQUENCE', 'AFFINITY')),
    source_id TEXT NOT NULL REFERENCES nodes(id),
    target_id TEXT NOT NULL REFERENCES nodes(id),
    label TEXT,
    weight REAL DEFAULT 1.0,
    directed BOOLEAN DEFAULT 1,

    -- Timestamps
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now')),
    deleted_at TEXT,

    -- Unique constraint
    UNIQUE(source_id, target_id, edge_type)
);

-- Facets: PAFV axis configuration
CREATE TABLE IF NOT EXISTS facets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    axis TEXT NOT NULL CHECK (axis IN ('Location', 'Alphabet', 'Time', 'Category', 'Hierarchy')),
    source_column TEXT NOT NULL,
    facet_type TEXT NOT NULL DEFAULT 'string',
    enabled BOOLEAN DEFAULT 1,
    sort_order INTEGER DEFAULT 0,

    -- Configuration
    config_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    modified_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);
CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority);
CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_nodes_modified_at ON nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_deleted_at ON nodes(deleted_at);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);

-- Triggers for timestamp updates
CREATE TRIGGER IF NOT EXISTS nodes_update_modified AFTER UPDATE ON nodes BEGIN
    UPDATE nodes SET modified_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS edges_update_modified AFTER UPDATE ON edges BEGIN
    UPDATE edges SET modified_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- Sample Data for Development and Testing
-- ============================================================================

-- Sample facets for PAFV mapping
INSERT OR IGNORE INTO facets (id, name, axis, source_column, facet_type, sort_order) VALUES
    ('facet-folder', 'Folder', 'Category', 'folder', 'string', 1),
    ('facet-status', 'Status', 'Category', 'status', 'string', 2),
    ('facet-priority', 'Priority', 'Hierarchy', 'priority', 'integer', 3),
    ('facet-created', 'Created', 'Time', 'created_at', 'datetime', 4),
    ('facet-modified', 'Modified', 'Time', 'modified_at', 'datetime', 5);

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