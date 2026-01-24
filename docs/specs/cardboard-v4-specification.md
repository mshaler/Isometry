# Isometry v4: Architecture Specification

*The Polymorphic Data Visualization Platform*

**Version:** 4.0.0-draft
**Date:** January 2026
**Authors:** Michael + Claude

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Architecture](#2-core-architecture)
3. [Data Layer: SQLite + CloudKit](#3-data-layer)
4. [Control Plane: React Chrome](#4-control-plane-react-chrome)
5. [Data Plane: D3 Visualization](#5-data-plane)
6. [Notebook: Capture, Shell, Preview](#6-notebook)
7. [App Builder: Designer Workbench](#7-app-builder)
8. [File Formats & Interchange](#8-file-formats)
9. [Platform Strategy](#9-platform-strategy)
10. [Implementation Roadmap](#10-roadmap)

---

## 1. Executive Summary

### 1.1 What is Isometry?

Isometry is a **polymorphic data visualization platform** that enables users to view, manipulate, and build applications from the same underlying data through multiple lenses—grids, graphs, timelines, kanban boards—without translation layers or data duplication.

### 1.2 Core Philosophy

**The Boring Stack Wins.** Isometry achieves power through elegant combination of proven technologies, not through complex frameworks:

| Layer | Technology | Rationale |
| --- | --- | --- |
| Persistence | SQLite | Universal, powerful, zero-config |
| Sync | CloudKit | Native Apple ecosystem integration |
| Visualization | D3.js | Industry standard, full control |
| Controls | React | Ecosystem, accessibility, composition |
| Styling | CSS Variables + Tailwind | Design tokens, utility-first |

### 1.3 The Z-Axis Architecture

Isometry's UI separates into distinct z-axis layers:

```
z: 1000+  │ Modals, Dialogs, Command Palette (React)
──────────┼──────────────────────────────────────────
z: 100+   │ Control Chrome: Filters, Axis Config, Time Slider (React)
──────────┼──────────────────────────────────────────
z: 0-99   │ Data Visualization: Grids, Graphs, Timelines (D3)
──────────┼──────────────────────────────────────────
Data      │ SQLite + State Store (Zustand)
```

**React owns controls. D3 owns visualization. They communicate through a typed interface contract.**

### 1.4 Key Concepts

| Concept | Definition |
| --- | --- |
| **Card** | Atomic data unit—a node or edge in the LPG model |
| **Canvas** | Container for cards with layout rules |
| **PAFV** | Planes → Axes → Facets → Values (spatial projection) |
| **LATCH** | Location, Alphabet, Time, Category, Hierarchy (separation) |
| **GRAPH** | Link, Nest, Sequence, Affinity (connection) |
| **View** | A PAFV configuration rendering cards on a canvas |
| **App** | A saved composition of views and controls |

---

## 2. Core Architecture

### 2.1 The PAFV Model

PAFV resolves semantic confusion between "dimensions" and "categories" through clear hierarchical layers:

```
PLANES          AXES           FACETS              VALUES
────────────────────────────────────────────────────────────
              ┌─ Location ──┬─ latitude           │
              │             ├─ longitude          │
              │             └─ location_name      │
              │                                   │
              ├─ Alphabet ──┬─ name               │
              │             └─ title              │
x-plane ──────┤                                   │
              ├─ Time ──────┬─ created_at         ├── Cards
y-plane ──────┤             ├─ modified_at        │   (Nodes
              │             ├─ due_at             │    and
z-plane ──────┤             └─ event_start        │   Edges)
              │                                   │
              ├─ Category ──┬─ folder             │
              │             ├─ status             │
              │             └─ tags               │
              │                                   │
              └─ Hierarchy ─┬─ priority           │
                            ├─ importance         │
                            └─ sort_order         │
```

**Key Insight:** Any axis can map to any plane. View transitions are axis→plane remappings, not data rebuilds.

### 2.2 LATCH vs GRAPH Duality (or Continuity?)

This is the fundamental architectural insight: **LATCH separates, GRAPH joins.**

|  | LATCH | GRAPH |
| --- | --- | --- |
| **Operation** | Separation | Connection |
| **SQL analog** | `WHERE`, `GROUP BY`, `ORDER BY` | `JOIN`, recursive CTE |
| **Set theory** | Partition | Union/Intersection |
| **Question** | "How do I organize these?" | "How are these related?" |
| **D3 pattern** | Scales, axes, grouping | Force simulation, links |

### 2.3 View Type Taxonomy

| View Type | Primary Operation | Axis Mapping |
| --- | --- | --- |
| **SuperGrid** | LATCH separation | Nested Categories × Nested Categories |
| **Network** | GRAPH connection | Force-directed layout |
| **Timeline** | LATCH separation | Time → x-plane |
| **Kanban** | LATCH separation | Category → x-plane |
| **Calendar** | LATCH separation | Time → x,y grid |
| **Tree** | GRAPH connection | Hierarchy → y-plane |
| **Table** | LATCH separation | Rows × Columns |

### 2.4 The Card/Canvas Duality

Everything in Isometry is either a **Card** or a **Canvas**:

```typescript
// Card: Atomic renderable unit (node or edge)
interface Card {
  id: string;
  type: 'node' | 'edge';
  // ... properties
}

// Canvas: Container with layout rules
interface Canvas {
  id: string;
  cards: Card[];
  layout: LayoutConfig;
  children?: Canvas[];  // Nested canvases
}
```

Both are URL-addressable:

- `isometry://card/{id}`
- `isometry://canvas/{id}`
- `isometry://canvas/{id}/card/{cardId}`

---

## 3. Data Layer

### 3.1 SQLite Schema (DDL v4)

```sql
-- ============================================================================
-- Isometry SQLite Schema v4
-- ============================================================================
-- Features: FTS5 full-text search, LPG graph model, CloudKit sync
-- Deployment: iOS 15+, macOS 12+, WebKit (sql.js)
-- ============================================================================

-- ============================================================================
-- PRAGMA CONFIGURATION (set at connection time)
-- ============================================================================
-- PRAGMA journal_mode = WAL;
-- PRAGMA foreign_keys = ON;
-- PRAGMA synchronous = NORMAL;
-- PRAGMA cache_size = -64000;  -- 64MB

-- ============================================================================
-- NODES TABLE
-- ============================================================================
-- Core entity table implementing LPG node semantics

CREATE TABLE IF NOT EXISTS nodes (
    -- ════════════════════════════════════════════════════════════════════
    -- IDENTITY
    -- ════════════════════════════════════════════════════════════════════
    id TEXT PRIMARY KEY NOT NULL,
    node_type TEXT NOT NULL DEFAULT 'note'
        CHECK (node_type IN ('note', 'task', 'contact', 'event', 'project', 'resource', 'custom')),
  
    -- ════════════════════════════════════════════════════════════════════
    -- CONTENT
    -- ════════════════════════════════════════════════════════════════════
    name TEXT NOT NULL,
    content TEXT,                    -- Markdown content
    summary TEXT,                    -- AI-generated or manual summary
    content_type TEXT DEFAULT 'markdown'
        CHECK (content_type IN ('markdown', 'plain', 'html', 'json')),
  
    -- ════════════════════════════════════════════════════════════════════
    -- LATCH: LOCATION
    -- ════════════════════════════════════════════════════════════════════
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    location_address TEXT,
    location_place_id TEXT,          -- Google Places ID for deduplication
  
    -- ════════════════════════════════════════════════════════════════════
    -- LATCH: TIME
    -- ════════════════════════════════════════════════════════════════════
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    due_at TEXT,
    completed_at TEXT,
    event_start TEXT,
    event_end TEXT,
    event_all_day INTEGER DEFAULT 0,
  
    -- ════════════════════════════════════════════════════════════════════
    -- LATCH: CATEGORY
    -- ════════════════════════════════════════════════════════════════════
    folder TEXT,                     -- Primary categorization
    tags TEXT,                       -- JSON array: ["tag1", "tag2"]
    status TEXT,                     -- Workflow status
    color TEXT,                      -- User-assigned color
    icon TEXT,                       -- User-assigned icon (emoji or icon name)
  
    -- ════════════════════════════════════════════════════════════════════
    -- LATCH: HIERARCHY
    -- ════════════════════════════════════════════════════════════════════
    priority INTEGER NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 5),
    importance INTEGER NOT NULL DEFAULT 0 CHECK (importance BETWEEN 0 AND 5),
    sort_order INTEGER NOT NULL DEFAULT 0,
  
    -- ════════════════════════════════════════════════════════════════════
    -- SOURCE TRACKING (ETL deduplication)
    -- ════════════════════════════════════════════════════════════════════
    source TEXT,                     -- 'apple_notes', 'reminders', 'manual', etc.
    source_id TEXT,                  -- Original ID in source system
    source_url TEXT,                 -- Deep link back to source
    source_hash TEXT,                -- Content hash for change detection
  
    -- ════════════════════════════════════════════════════════════════════
    -- LIFECYCLE
    -- ════════════════════════════════════════════════════════════════════
    deleted_at TEXT,                 -- Soft delete timestamp
    archived_at TEXT,                -- Archive timestamp
    version INTEGER NOT NULL DEFAULT 1,
  
    -- ════════════════════════════════════════════════════════════════════
    -- SYNC (CloudKit)
    -- ════════════════════════════════════════════════════════════════════
    sync_version INTEGER NOT NULL DEFAULT 0,
    last_synced_at TEXT,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
    sync_error TEXT,                 -- Last sync error message
    ck_record_name TEXT,             -- CloudKit record identifier
    ck_record_change_tag TEXT        -- CloudKit change tag for conflict detection
);

-- ============================================================================
-- NODES INDEXES
-- ============================================================================

-- LATCH: Primary access patterns
CREATE INDEX IF NOT EXISTS idx_nodes_folder ON nodes(folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status) WHERE deleted_at IS NULL AND status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(node_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_priority ON nodes(priority DESC) WHERE deleted_at IS NULL;

-- LATCH: Time-based queries
CREATE INDEX IF NOT EXISTS idx_nodes_created ON nodes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON nodes(modified_at DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_due ON nodes(due_at) WHERE due_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_events ON nodes(event_start, event_end) 
    WHERE event_start IS NOT NULL AND deleted_at IS NULL;

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nodes_folder_modified ON nodes(folder, modified_at DESC) 
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_type_status ON nodes(node_type, status) 
    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_nodes_type_folder ON nodes(node_type, folder) 
    WHERE deleted_at IS NULL;

-- Sync indexes
CREATE INDEX IF NOT EXISTS idx_nodes_sync_pending ON nodes(modified_at) 
    WHERE sync_status = 'pending' OR sync_status = 'error';
CREATE INDEX IF NOT EXISTS idx_nodes_sync_conflict ON nodes(id) 
    WHERE sync_status = 'conflict';

-- Source deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_source ON nodes(source, source_id) 
    WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- Active nodes (covering index for common queries)
CREATE INDEX IF NOT EXISTS idx_nodes_active ON nodes(id, name, folder, modified_at) 
    WHERE deleted_at IS NULL;

-- ============================================================================
-- EDGES TABLE
-- ============================================================================
-- Implements LPG edge semantics—edges are first-class entities with properties

CREATE TABLE IF NOT EXISTS edges (
    -- ════════════════════════════════════════════════════════════════════
    -- IDENTITY
    -- ════════════════════════════════════════════════════════════════════
    id TEXT PRIMARY KEY NOT NULL,
    edge_type TEXT NOT NULL
        CHECK (edge_type IN ('LINK', 'NEST', 'SEQUENCE', 'AFFINITY')),
  
    -- ════════════════════════════════════════════════════════════════════
    -- ENDPOINTS
    -- ════════════════════════════════════════════════════════════════════
    source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
    -- ════════════════════════════════════════════════════════════════════
    -- EDGE PROPERTIES
    -- ════════════════════════════════════════════════════════════════════
    label TEXT,                      -- Human-readable label
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    directed INTEGER NOT NULL DEFAULT 1,  -- 1 = directed, 0 = undirected
  
    -- ════════════════════════════════════════════════════════════════════
    -- SEQUENCE PROPERTIES
    -- ════════════════════════════════════════════════════════════════════
    sequence_order INTEGER,          -- For SEQUENCE edges
  
    -- ════════════════════════════════════════════════════════════════════
    -- COMMUNICATION PROPERTIES (for message/interaction edges)
    -- ════════════════════════════════════════════════════════════════════
    channel TEXT,                    -- 'email', 'slack', 'sms', etc.
    timestamp TEXT,                  -- When the interaction occurred
    subject TEXT,                    -- Message subject
    sentiment REAL,                  -- -1.0 to 1.0 sentiment score
  
    -- ════════════════════════════════════════════════════════════════════
    -- METADATA
    -- ════════════════════════════════════════════════════════════════════
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    properties TEXT,                 -- JSON object for arbitrary properties
  
    -- ════════════════════════════════════════════════════════════════════
    -- SYNC
    -- ════════════════════════════════════════════════════════════════════
    sync_version INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'conflict', 'error')),
  
    -- Prevent duplicate edges of same type between same nodes
    UNIQUE(source_id, target_id, edge_type)
);

-- ============================================================================
-- EDGES INDEXES
-- ============================================================================

-- Graph traversal (both directions)
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id, edge_type);
CREATE INDEX IF NOT EXISTS idx_edges_both ON edges(source_id, target_id);

-- By type
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(edge_type);

-- Weighted edges
CREATE INDEX IF NOT EXISTS idx_edges_weight ON edges(target_id, weight DESC);

-- Sequence ordering
CREATE INDEX IF NOT EXISTS idx_edges_sequence ON edges(source_id, sequence_order) 
    WHERE edge_type = 'SEQUENCE';

-- Communication timeline
CREATE INDEX IF NOT EXISTS idx_edges_channel_time ON edges(channel, timestamp DESC)
    WHERE channel IS NOT NULL;

-- ============================================================================
-- FTS5 FULL-TEXT SEARCH
-- ============================================================================

CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name,
    content,
    summary,
    tags,
    folder,
    content='nodes',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- FTS5 sync triggers
CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_insert AFTER INSERT ON nodes BEGIN
    INSERT INTO nodes_fts(rowid, name, content, summary, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.summary, NEW.tags, NEW.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_delete AFTER DELETE ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, summary, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.summary, OLD.tags, OLD.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_nodes_fts_update 
AFTER UPDATE OF name, content, summary, tags, folder ON nodes BEGIN
    INSERT INTO nodes_fts(nodes_fts, rowid, name, content, summary, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.summary, OLD.tags, OLD.folder);
    INSERT INTO nodes_fts(rowid, name, content, summary, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.summary, NEW.tags, NEW.folder);
END;

-- ============================================================================
-- CANVASES TABLE
-- ============================================================================
-- Container definitions for card layouts

CREATE TABLE IF NOT EXISTS canvases (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    canvas_type TEXT NOT NULL DEFAULT 'view'
        CHECK (canvas_type IN ('view', 'app', 'notebook', 'dashboard')),
  
    -- Parent canvas for nesting
    parent_id TEXT REFERENCES canvases(id) ON DELETE CASCADE,
  
    -- Layout configuration (JSON)
    layout_config TEXT NOT NULL DEFAULT '{}',
  
    -- View state (JSON) - PAFV + LATCH configuration
    view_state TEXT NOT NULL DEFAULT '{}',
  
    -- Visual properties
    background_color TEXT,
    thumbnail TEXT,                  -- Base64 or URL
  
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  
    -- Sync
    sync_version INTEGER NOT NULL DEFAULT 0,
    sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_canvases_parent ON canvases(parent_id);
CREATE INDEX IF NOT EXISTS idx_canvases_type ON canvases(canvas_type);

-- ============================================================================
-- CANVAS_CARDS TABLE
-- ============================================================================
-- Many-to-many relationship between canvases and cards with position

CREATE TABLE IF NOT EXISTS canvas_cards (
    id TEXT PRIMARY KEY NOT NULL,
    canvas_id TEXT NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
    -- Position on canvas
    x REAL,
    y REAL,
    z INTEGER DEFAULT 0,             -- Stacking order
    width REAL,
    height REAL,
  
    -- Visual overrides
    collapsed INTEGER DEFAULT 0,
    pinned INTEGER DEFAULT 0,
    style_overrides TEXT,            -- JSON
  
    UNIQUE(canvas_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_canvas_cards_canvas ON canvas_cards(canvas_id);
CREATE INDEX IF NOT EXISTS idx_canvas_cards_node ON canvas_cards(node_id);

-- ============================================================================
-- FACETS TABLE
-- ============================================================================
-- PAFV facet definitions

CREATE TABLE IF NOT EXISTS facets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    facet_type TEXT NOT NULL
        CHECK (facet_type IN ('text', 'number', 'date', 'datetime', 'select', 
                              'multi_select', 'location', 'boolean', 'url', 'email')),
    axis TEXT NOT NULL CHECK (axis IN ('L', 'A', 'T', 'C', 'H')),
    source_column TEXT NOT NULL,     -- SQLite column name
  
    -- For select/multi_select types
    options TEXT,                    -- JSON array: [{value, label, color}, ...]
  
    -- Display
    icon TEXT,
    color TEXT,
    format TEXT,                     -- Display format string
  
    -- Behavior
    enabled INTEGER NOT NULL DEFAULT 1,
    editable INTEGER NOT NULL DEFAULT 1,
    required INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
  
    -- Validation
    min_value REAL,
    max_value REAL,
    pattern TEXT                     -- Regex for text validation
);

-- Default facets
INSERT OR IGNORE INTO facets (id, name, facet_type, axis, source_column, sort_order) VALUES
    ('folder', 'Folder', 'select', 'C', 'folder', 1),
    ('tags', 'Tags', 'multi_select', 'C', 'tags', 2),
    ('status', 'Status', 'select', 'C', 'status', 3),
    ('priority', 'Priority', 'number', 'H', 'priority', 4),
    ('importance', 'Importance', 'number', 'H', 'importance', 5),
    ('created', 'Created', 'datetime', 'T', 'created_at', 6),
    ('modified', 'Modified', 'datetime', 'T', 'modified_at', 7),
    ('due', 'Due Date', 'datetime', 'T', 'due_at', 8),
    ('name', 'Name', 'text', 'A', 'name', 9),
    ('location', 'Location', 'location', 'L', 'location_name', 10);

-- ============================================================================
-- VIEWS TABLE
-- ============================================================================
-- Saved view configurations

CREATE TABLE IF NOT EXISTS views (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    view_type TEXT NOT NULL
        CHECK (view_type IN ('supergrid', 'network', 'timeline', 'kanban', 
                             'calendar', 'tree', 'table', 'list')),
  
    -- Canvas this view belongs to (optional)
    canvas_id TEXT REFERENCES canvases(id) ON DELETE SET NULL,
  
    -- PAFV configuration (JSON)
    pafv_config TEXT NOT NULL DEFAULT '{}',
  
    -- LATCH configuration (JSON)
    latch_config TEXT NOT NULL DEFAULT '{}',
  
    -- View-specific options (JSON)
    view_options TEXT NOT NULL DEFAULT '{}',
  
    -- Display
    icon TEXT,
    color TEXT,
    is_default INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
  
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_views_canvas ON views(canvas_id);
CREATE INDEX IF NOT EXISTS idx_views_type ON views(view_type);

-- ============================================================================
-- APPS TABLE
-- ============================================================================
-- User-created applications (Designer Workbench output)

CREATE TABLE IF NOT EXISTS apps (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
  
    -- App definition (JSON) - Component tree
    component_spec TEXT NOT NULL DEFAULT '{}',
  
    -- Data bindings (JSON)
    data_bindings TEXT NOT NULL DEFAULT '{}',
  
    -- Theme overrides (JSON)
    theme_overrides TEXT,
  
    -- Entry point canvas
    root_canvas_id TEXT REFERENCES canvases(id),
  
    -- Publishing
    published INTEGER DEFAULT 0,
    published_at TEXT,
    version TEXT DEFAULT '1.0.0',
  
    -- Metadata
    icon TEXT,
    thumbnail TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ============================================================================
-- SYNC STATE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sync_state (
    id TEXT PRIMARY KEY DEFAULT 'default',
  
    -- CloudKit tokens
    change_token BLOB,               -- Serialized CKServerChangeToken
    subscription_id TEXT,
  
    -- Timestamps
    last_sync_at TEXT,
    last_push_at TEXT,
    last_pull_at TEXT,
  
    -- Counters
    pending_push_count INTEGER NOT NULL DEFAULT 0,
    pending_pull_count INTEGER NOT NULL DEFAULT 0,
  
    -- Error tracking
    last_error TEXT,
    last_error_at TEXT,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
  
    -- Backoff state
    next_retry_at TEXT,
    backoff_seconds INTEGER DEFAULT 1
);

INSERT OR IGNORE INTO sync_state (id) VALUES ('default');

-- ============================================================================
-- SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT,
    value_type TEXT DEFAULT 'string' 
        CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Default settings
INSERT OR IGNORE INTO settings (key, value, value_type) VALUES
    ('theme', 'nextstep', 'string'),
    ('sidebar_collapsed', 'false', 'boolean'),
    ('last_app', 'notes', 'string'),
    ('last_view', 'grid', 'string'),
    ('last_canvas_id', NULL, 'string'),
    ('sync_enabled', 'true', 'boolean'),
    ('sync_wifi_only', 'false', 'boolean'),
    ('default_node_type', 'note', 'string'),
    ('date_format', 'relative', 'string'),
    ('time_format', '12h', 'string');

-- ============================================================================
-- SCHEMA MIGRATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    description TEXT,
    checksum TEXT                    -- SHA256 of migration SQL
);

-- ============================================================================
-- AUDIT LOG TABLE (optional, for debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT,                 -- JSON
    new_values TEXT,                 -- JSON
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_record ON audit_log(table_name, record_id);

-- ============================================================================
-- GRAPH QUERY VIEWS
-- ============================================================================

-- Neighbors view (direct connections)
CREATE VIEW IF NOT EXISTS v_neighbors AS
SELECT 
    e.source_id AS from_id,
    e.target_id AS to_id,
    e.edge_type,
    e.weight,
    e.label,
    'outgoing' AS direction
FROM edges e
UNION ALL
SELECT 
    e.target_id AS from_id,
    e.source_id AS to_id,
    e.edge_type,
    e.weight,
    e.label,
    CASE WHEN e.directed = 0 THEN 'undirected' ELSE 'incoming' END AS direction
FROM edges e
WHERE e.directed = 0 OR 1=1;  -- Include all for incoming queries

-- Node degree view
CREATE VIEW IF NOT EXISTS v_node_degree AS
SELECT 
    n.id,
    n.name,
    COUNT(DISTINCT CASE WHEN e.source_id = n.id THEN e.id END) AS out_degree,
    COUNT(DISTINCT CASE WHEN e.target_id = n.id THEN e.id END) AS in_degree,
    COUNT(DISTINCT e.id) AS total_degree,
    COALESCE(SUM(CASE WHEN e.target_id = n.id THEN e.weight END), 0) AS weighted_importance
FROM nodes n
LEFT JOIN edges e ON e.source_id = n.id OR e.target_id = n.id
WHERE n.deleted_at IS NULL
GROUP BY n.id;
```

### 3.2 Graph Query Library

```sql
-- ============================================================================
-- CONNECTED NODES (BFS Traversal)
-- ============================================================================
-- Parameters: $startId, $maxDepth

WITH RECURSIVE connected(id, depth, path) AS (
    SELECT $startId, 0, $startId
    UNION ALL
    SELECT
        CASE 
            WHEN e.source_id = c.id THEN e.target_id 
            WHEN e.directed = 0 THEN e.source_id
            ELSE NULL
        END AS next_id,
        c.depth + 1,
        c.path || '→' || CASE 
            WHEN e.source_id = c.id THEN e.target_id 
            ELSE e.source_id 
        END
    FROM connected c
    JOIN edges e ON (
        e.source_id = c.id 
        OR (e.directed = 0 AND e.target_id = c.id)
    )
    WHERE c.depth < $maxDepth
    AND c.path NOT LIKE '%' || CASE 
        WHEN e.source_id = c.id THEN e.target_id 
        ELSE e.source_id 
    END || '%'
    AND CASE 
        WHEN e.source_id = c.id THEN e.target_id 
        WHEN e.directed = 0 THEN e.source_id
        ELSE NULL
    END IS NOT NULL
)
SELECT DISTINCT n.*, c.depth, c.path
FROM connected c
JOIN nodes n ON n.id = c.id
WHERE n.deleted_at IS NULL
ORDER BY c.depth ASC, n.modified_at DESC;

-- ============================================================================
-- SHORTEST PATH
-- ============================================================================
-- Parameters: $sourceId, $targetId, $maxDepth

WITH RECURSIVE paths(current_id, depth, path, found) AS (
    SELECT $sourceId, 0, $sourceId, ($sourceId = $targetId)
    UNION ALL
    SELECT
        CASE WHEN e.source_id = p.current_id THEN e.target_id ELSE e.source_id END,
        p.depth + 1,
        p.path || '→' || CASE WHEN e.source_id = p.current_id THEN e.target_id ELSE e.source_id END,
        CASE WHEN e.source_id = p.current_id THEN e.target_id ELSE e.source_id END = $targetId
    FROM paths p
    JOIN edges e ON (
        e.source_id = p.current_id 
        OR (e.directed = 0 AND e.target_id = p.current_id)
    )
    WHERE p.found = 0 
    AND p.depth < COALESCE($maxDepth, 10)
    AND p.path NOT LIKE '%' || CASE WHEN e.source_id = p.current_id THEN e.target_id ELSE e.source_id END || '%'
)
SELECT path, depth FROM paths WHERE found = 1 ORDER BY depth LIMIT 1;

-- ============================================================================
-- SUBGRAPH EXTRACTION (for D3)
-- ============================================================================
-- Parameters: $startId, $maxDepth
-- Returns nodes and edges as separate record types for D3 consumption

WITH RECURSIVE component(id, depth) AS (
    SELECT $startId, 0
    UNION ALL
    SELECT
        CASE WHEN e.source_id = c.id THEN e.target_id ELSE e.source_id END,
        c.depth + 1
    FROM component c
    JOIN edges e ON e.source_id = c.id OR e.target_id = c.id
    WHERE c.depth < $maxDepth
)
SELECT 
    'node' AS record_type,
    n.id,
    n.name,
    n.node_type,
    n.folder,
    n.status,
    n.priority,
    NULL AS source_id,
    NULL AS target_id,
    NULL AS edge_type,
    NULL AS weight
FROM nodes n
WHERE n.id IN (SELECT DISTINCT id FROM component)
AND n.deleted_at IS NULL

UNION ALL

SELECT 
    'edge' AS record_type,
    e.id,
    e.label AS name,
    NULL AS node_type,
    NULL AS folder,
    NULL AS status,
    NULL AS priority,
    e.source_id,
    e.target_id,
    e.edge_type,
    e.weight
FROM edges e
WHERE e.source_id IN (SELECT DISTINCT id FROM component)
AND e.target_id IN (SELECT DISTINCT id FROM component);
```

### 3.3 CloudKit Sync Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CloudKit Sync Flow                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   LOCAL (SQLite)                          REMOTE (CloudKit)         │
│   ─────────────                          ──────────────────         │
│                                                                     │
│   ┌─────────────┐    Push Changes    ┌─────────────────────┐       │
│   │   nodes     │ ─────────────────▶ │   Node (RecordType) │       │
│   │   edges     │                    │   Edge (RecordType) │       │
│   │   canvases  │ ◀───────────────── │   Canvas            │       │
│   └─────────────┘    Pull Changes    └─────────────────────┘       │
│         │                                      │                    │
│         │                                      │                    │
│         ▼                                      ▼                    │
│   ┌─────────────┐                    ┌─────────────────────┐       │
│   │ sync_status │                    │  CKServerChangeToken │       │
│   │ = 'pending' │                    │  (incremental sync)  │       │
│   └─────────────┘                    └─────────────────────┘       │
│                                                                     │
│   Conflict Resolution Strategy:                                     │
│   1. Field-level merge where possible                              │
│   2. Last-write-wins with 5-minute threshold                       │
│   3. User prompt for genuine conflicts                             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**CloudKit Zone:** `IsometryZone` (private database, custom zone)

**Record Types:**

- `Node` — maps to `nodes` table
- `Edge` — maps to `edges` table
- `Canvas` — maps to `canvases` table
- `View` — maps to `views` table
- `App` — maps to `apps` table

---

## 4. Control Plane: React Chrome

### 4.1 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      React Control Plane                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   State Management: Zustand                                         │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  useViewStore: ViewState + actions                           │  │
│   │  useSelectionStore: Selection state                          │  │
│   │  useDataStore: SQLite query cache                            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   ┌──────────────────────────────────────────────────────────────┐ │
│   │                     Component Tree                            │ │
│   │                                                               │ │
│   │   <IsometryProvider>                                         │ │
│   │     <CommandPalette />           z: 1000                      │ │
│   │     <ContextMenuProvider />      z: 1001                      │ │
│   │     <ToastProvider />            z: 1002                      │ │
│   │                                                               │ │
│   │     <WorkspaceLayout>                                         │ │
│   │       <Sidebar />                z: 100                       │ │
│   │       <TopBar>                   z: 100                       │ │
│   │         <ViewSwitcher />                                      │ │
│   │         <AxisConfigurator />                                  │ │
│   │         <FilterBar />                                         │ │
│   │       </TopBar>                                               │ │
│   │                                                               │ │
│   │       <MainCanvas>               z: 0                         │ │
│   │         <D3ViewWrapper />        (Data Plane)                 │ │
│   │       </MainCanvas>                                           │ │
│   │                                                               │ │
│   │       <BottomBar>                z: 100                       │ │
│   │         <TimeSlider />                                        │ │
│   │         <StatusBar />                                         │ │
│   │       </BottomBar>                                            │ │
│   │                                                               │ │
│   │       <DetailPanel />            z: 100 (conditional)         │ │
│   │     </WorkspaceLayout>                                        │ │
│   │   </IsometryProvider>                                        │ │
│   │                                                               │ │
│   └──────────────────────────────────────────────────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 View State Interface

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// VIEW STATE: The contract between React controls and D3 visualization
// ═══════════════════════════════════════════════════════════════════════════

interface ViewState {
  // ─────────────────────────────────────────────────────────────────────────
  // PAFV Configuration
  // ─────────────────────────────────────────────────────────────────────────
  pafv: {
    xAxis: FacetBinding | null;        // What maps to horizontal
    yAxis: FacetBinding | null;        // What maps to vertical
    zAxis: FacetBinding | null;        // What maps to depth/layering
    colorAxis: FacetBinding | null;    // What maps to color
    sizeAxis: FacetBinding | null;     // What maps to size
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // LATCH Operations
  // ─────────────────────────────────────────────────────────────────────────
  latch: {
    filters: LATCHFilter[];            // Active filters
    groupBy: FacetId | null;           // Grouping facet
    sortBy: SortSpec[];                // Sort order
    search: string;                    // FTS5 search query
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // Time Window
  // ─────────────────────────────────────────────────────────────────────────
  timeWindow: {
    start: Date | null;
    end: Date | null;
    granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    playing: boolean;                  // Animation state
    playbackSpeed: number;             // 1x, 2x, etc.
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // View Type
  // ─────────────────────────────────────────────────────────────────────────
  viewType: ViewType;
  viewOptions: ViewTypeOptions;        // View-specific settings
  
  // ─────────────────────────────────────────────────────────────────────────
  // Selection State
  // ─────────────────────────────────────────────────────────────────────────
  selection: {
    nodeIds: Set<string>;
    edgeIds: Set<string>;
    mode: 'single' | 'multi' | 'range';
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // Viewport
  // ─────────────────────────────────────────────────────────────────────────
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  
  // ─────────────────────────────────────────────────────────────────────────
  // UI State
  // ─────────────────────────────────────────────────────────────────────────
  ui: {
    sidebarCollapsed: boolean;
    detailPanelOpen: boolean;
    focusedNodeId: string | null;
    hoveredNodeId: string | null;
  };
}

type ViewType = 
  | 'supergrid' 
  | 'network' 
  | 'timeline' 
  | 'kanban' 
  | 'calendar' 
  | 'tree' 
  | 'table' 
  | 'list';

interface FacetBinding {
  facetId: string;
  transform?: 'linear' | 'log' | 'sqrt' | 'time';
  invert?: boolean;
}

interface LATCHFilter {
  id: string;
  facetId: string;
  operator: FilterOperator;
  value: FilterValue;
  enabled: boolean;
}

type FilterOperator = 
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'greater_than' | 'less_than'
  | 'between' | 'not_between'
  | 'in' | 'not_in'
  | 'is_empty' | 'is_not_empty';

interface SortSpec {
  facetId: string;
  direction: 'asc' | 'desc';
}
```

### 4.3 View Actions

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// VIEW ACTIONS: All state mutations go through these
// ═══════════════════════════════════════════════════════════════════════════

type ViewAction =
  // PAFV
  | { type: 'SET_AXIS'; plane: 'x' | 'y' | 'z' | 'color' | 'size'; binding: FacetBinding | null }
  | { type: 'SWAP_AXES'; plane1: string; plane2: string }
  | { type: 'CLEAR_AXES' }
  
  // LATCH
  | { type: 'ADD_FILTER'; filter: LATCHFilter }
  | { type: 'UPDATE_FILTER'; filterId: string; updates: Partial<LATCHFilter> }
  | { type: 'REMOVE_FILTER'; filterId: string }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_GROUP_BY'; facetId: string | null }
  | { type: 'SET_SORT'; sortSpecs: SortSpec[] }
  | { type: 'SET_SEARCH'; query: string }
  
  // Time
  | { type: 'SET_TIME_WINDOW'; start: Date | null; end: Date | null }
  | { type: 'SET_GRANULARITY'; granularity: ViewState['timeWindow']['granularity'] }
  | { type: 'PLAY_TIME' }
  | { type: 'PAUSE_TIME' }
  | { type: 'STEP_TIME'; direction: 'forward' | 'backward' }
  
  // View
  | { type: 'SET_VIEW_TYPE'; viewType: ViewType }
  | { type: 'SET_VIEW_OPTIONS'; options: Partial<ViewTypeOptions> }
  
  // Selection
  | { type: 'SELECT_NODES'; nodeIds: string[]; mode?: 'replace' | 'add' | 'remove' }
  | { type: 'SELECT_EDGES'; edgeIds: string[]; mode?: 'replace' | 'add' | 'remove' }
  | { type: 'SELECT_ALL' }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'INVERT_SELECTION' }
  
  // Viewport
  | { type: 'SET_VIEWPORT'; viewport: Partial<ViewState['viewport']> }
  | { type: 'ZOOM_TO_FIT' }
  | { type: 'ZOOM_TO_SELECTION' }
  
  // UI
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'TOGGLE_DETAIL_PANEL' }
  | { type: 'FOCUS_NODE'; nodeId: string | null }
  | { type: 'HOVER_NODE'; nodeId: string | null };
```

### 4.4 Core Control Components

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// FILTER NAVIGATOR
// ═══════════════════════════════════════════════════════════════════════════

interface FilterNavigatorProps {
  facets: Facet[];
  filters: LATCHFilter[];
  onChange: (filters: LATCHFilter[]) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// AXIS CONFIGURATOR
// ═══════════════════════════════════════════════════════════════════════════

interface AxisConfiguratorProps {
  planes: Array<'x' | 'y' | 'z' | 'color' | 'size'>;
  mapping: ViewState['pafv'];
  availableFacets: Facet[];
  onAxisChange: (plane: string, binding: FacetBinding | null) => void;
  onSwapAxes: (plane1: string, plane2: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW SWITCHER
// ═══════════════════════════════════════════════════════════════════════════

interface ViewSwitcherProps {
  current: ViewType;
  available: ViewType[];
  onChange: (viewType: ViewType) => void;
  savedViews?: SavedView[];
  onSaveView?: (name: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// TIME SLIDER
// ═══════════════════════════════════════════════════════════════════════════

interface TimeSliderProps {
  dataRange: { min: Date; max: Date };      // Full data extent
  value: { start: Date; end: Date };         // Current window
  granularity: ViewState['timeWindow']['granularity'];
  playing: boolean;
  onChange: (start: Date, end: Date) => void;
  onGranularityChange: (g: ViewState['timeWindow']['granularity']) => void;
  onPlayPause: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// SELECTION TOOLBAR
// ═══════════════════════════════════════════════════════════════════════════

interface SelectionToolbarProps {
  selection: ViewState['selection'];
  onBulkEdit: (changes: Partial<Node>) => void;
  onBulkDelete: () => void;
  onCreateEdge: (edgeType: EdgeType) => void;
  onGroup: () => void;
  onExport: (format: 'json' | 'csv' | 'markdown') => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════

interface NodeDetailPanelProps {
  nodeId: string;
  node: Node;
  edges: Edge[];
  onUpdate: (changes: Partial<Node>) => void;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}
```

### 4.5 Component Library Structure

```
src/
├── components/
│   ├── controls/                    # LATCH + PAFV controls
│   │   ├── FilterNavigator/
│   │   │   ├── FilterNavigator.tsx
│   │   │   ├── FilterPill.tsx
│   │   │   ├── FilterEditor.tsx
│   │   │   └── index.ts
│   │   ├── AxisConfigurator/
│   │   ├── ViewSwitcher/
│   │   ├── TimeSlider/
│   │   ├── SearchBar/
│   │   └── index.ts
│   │
│   ├── layout/                      # Structural components
│   │   ├── WorkspaceLayout.tsx
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   ├── BottomBar.tsx
│   │   ├── DetailPanel.tsx
│   │   └── index.ts
│   │
│   ├── cards/                       # Card rendering
│   │   ├── CardRenderer.tsx
│   │   ├── CardCompact.tsx
│   │   ├── CardExpanded.tsx
│   │   ├── CardEditor.tsx
│   │   └── index.ts
│   │
│   ├── primitives/                  # Base UI primitives
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Popover.tsx
│   │   ├── Dialog.tsx
│   │   ├── Menu.tsx
│   │   ├── Tooltip.tsx
│   │   ├── Badge.tsx
│   │   ├── Avatar.tsx
│   │   ├── Icon.tsx
│   │   └── index.ts
│   │
│   ├── notebook/                    # Notebook sidecar
│   │   ├── Notebook.tsx
│   │   ├── CaptureCanvas.tsx
│   │   ├── ShellCanvas.tsx
│   │   ├── PreviewCanvas.tsx
│   │   └── index.ts
│   │
│   └── d3/                          # D3 React wrappers
│       ├── D3ViewWrapper.tsx
│       ├── D3ViewContext.tsx
│       └── index.ts
│
├── stores/                          # Zustand stores
│   ├── viewStore.ts
│   ├── selectionStore.ts
│   ├── dataStore.ts
│   └── index.ts
│
├── hooks/                           # Custom hooks
│   ├── useViewState.ts
│   ├── useDataQuery.ts
│   ├── useSelection.ts
│   ├── useKeyboardShortcuts.ts
│   └── index.ts
│
└── types/                           # TypeScript definitions
    ├── view.ts
    ├── data.ts
    ├── components.ts
    └── index.ts
```

---

*Add this to Section 4 (Control Plane) after the component architecture, or as a new Section 4.5*

---

## 4.X Design Philosophy: The NeXTSTEP Lineage

Isometry's architecture draws from two revolutionary NeXTSTEP-era applications that anticipated modern computing by decades:

### Lotus Improv → PAFV Architecture

Improv (1991) recognized that **spreadsheets fatally conflate data with presentation**. Its solution—separating the data cube from its projections—directly informs Isometry's PAFV model:

| Improv Concept | Isometry Equivalent |
| --- | --- |
| Data cube (multidimensional) | SQLite LPG (nodes + edges) |
| Categories (named dimensions) | LATCH axes |
| Views (projections of the cube) | Polymorphic views (Grid, Kanban, Network, Timeline) |
| Formulas on names, not cell addresses | HyperFormula on semantic references |

Improv failed commercially because users couldn't see "the cell"—the atomic unit was invisible. Isometry solves this: **Cards are visible, tangible, draggable atoms** that exist independent of any particular view projection.

### Interface Builder → Designer Workbench

Interface Builder (1988) pioneered **direct manipulation of live objects**—not drawing pictures of interfaces, but instantiating real objects and wiring them visually. The Designer Workbench inherits this philosophy:

| Interface Builder | Designer Workbench |
| --- | --- |
| Objects are live, not mockups | Cards and Canvases are persisted entities |
| Visual arrangement is the specification | Layout is data, stored in SQLite |
| Property inspector for configuration | LATCH facet editor |
| Outlets/Actions for wiring | Edge connections between Cards |
| NIB files as serialization | Canvas bundles as JSON + SQLite |

The meta-level insight: **Isometry builds Isometry**. The Designer Workbench is itself a Isometry app, creating Isometry apps.

### Kanban as State-Space Navigation

Kanban boards add what neither Improv nor Interface Builder possessed: **state as spatial position**. Dragging a card from "Backlog" to "In Progress" is simultaneously:

- A data mutation (status field update in SQLite)
- A visual transformation (column membership change)
- A workflow event (state machine transition)
- An edge creation (sequence relationship to prior card)

This unification—where manipulation IS specification IS data—is the core Isometry insight.

---

## 4.Y Component Library: shadcn/ui

### Why shadcn/ui

The Control Plane requires **Interface Builder-quality primitives** to build a tool that builds tools. After evaluating React component libraries, shadcn/ui emerges as the clear choice:

| Criterion | shadcn/ui Approach |
| --- | --- |
| **Ownership** | Copy-paste, not npm dependency—code is yours |
| **Foundation** | Radix primitives (accessibility) + Tailwind (styling) |
| **Customization** | Full control for NeXTSTEP aesthetic |
| **D3 compatibility** | No global styles, no conflicts with SVG layer |
| **Iteration speed** | CLI to add components, modify freely |

### The Key Insight

shadcn/ui isn't a component library you *install*—it's a collection of well-crafted components you *copy into your project*. This means:

- No breaking changes from upstream versions
- Modify anything without forking
- Natural tree-shaking (only what you use)
- Components become *your* code

### Component Adoption Strategy

```bash
# Initialize shadcn/ui in Isometry
npx shadcn@latest init

# Core control plane components
npx shadcn@latest add button dialog command tabs dropdown-menu context-menu

# Data display
npx shadcn@latest add table card badge avatar

# Forms (for Card editor, LATCH configuration)
npx shadcn@latest add input select checkbox radio-group slider

# Feedback
npx shadcn@latest add toast alert progress skeleton
```

### NeXTSTEP Theming

Override `globals.css` to achieve the classic NeXT aesthetic:

```css
:root {
  /* NeXTSTEP grayscale palette */
  --background: 0 0% 85%;           /* Light gray background */
  --foreground: 0 0% 10%;           /* Near-black text */
  --card: 0 0% 90%;                 /* Slightly lighter cards */
  --card-foreground: 0 0% 10%;
  --primary: 0 0% 20%;              /* Dark gray for primary actions */
  --primary-foreground: 0 0% 95%;
  --secondary: 0 0% 75%;            /* Mid-gray for secondary */
  --muted: 0 0% 70%;
  --border: 0 0% 60%;               /* Visible borders */
  
  /* NeXT-style bevels */
  --shadow-raised: inset -1px -1px 0 rgba(0,0,0,0.3), 
                   inset 1px 1px 0 rgba(255,255,255,0.5);
  --shadow-sunken: inset 1px 1px 0 rgba(0,0,0,0.3), 
                   inset -1px -1px 0 rgba(255,255,255,0.3);
  
  /* System font stack */
  --font-sans: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif;
  --font-mono: "SF Mono", Monaco, "Courier New", monospace;
  
  /* Tighter radius for NeXT look */
  --radius: 2px;
}
```

### Component-to-Feature Mapping

| Isometry Feature | shadcn/ui Components |
| --- | --- |
| Command Palette (⌘K) | `Command`, `Dialog` |
| View Switcher | `Tabs`, `DropdownMenu` |
| LATCH Axis Configurator | `Select`, `ContextMenu`, `Popover` |
| Card Editor | `Dialog`, `Input`, `Textarea`, `Select` |
| Filter Pills | `Badge`, `Button` |
| Notebook Shell | `Card`, `Input`, `ScrollArea` |
| Designer Palette | `Accordion`, `Card`, `Badge` |
| Toast Notifications | `Toast`, `Sonner` |

---

## 4.Z Integration: React Control Plane + D3 Data Plane

shadcn/ui components live in the **z: 100+** React layer. They never touch D3's **z: 0-99** visualization floor. The interface contract:

```typescript
// React controls dispatch state changes
const handleAxisChange = (plane: 'x' | 'y', binding: FacetBinding) => {
  // Update ViewState (React state / Zustand / context)
  setViewState(prev => ({
    ...prev,
    pafv: { ...prev.pafv, [`${plane}Axis`]: binding }
  }));
};

// D3 floor receives state as props, renders visualization
<D3SuperGrid 
  nodes={nodes}
  edges={edges}
  pafv={viewState.pafv}
  onNodeClick={handleNodeClick}
  onSelectionChange={handleSelectionChange}
/>

// shadcn/ui controls float above, manipulate state
<AxisConfigurator 
  axis={viewState.pafv.xAxis}
  onChange={(binding) => handleAxisChange('x', binding)}
/>
```

**D3 shows the truth. React lets you change it.**

---

## 5. Data Plane: D3 Visualization

### 5.1 D3 View Interface

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// D3 VIEW CONTRACT: What React passes to D3
// ═══════════════════════════════════════════════════════════════════════════

interface D3ViewProps {
  // ─────────────────────────────────────────────────────────────────────────
  // Data (from SQLite query, filtered by LATCH)
  // ─────────────────────────────────────────────────────────────────────────
  nodes: Node[];
  edges: Edge[];
  
  // ─────────────────────────────────────────────────────────────────────────
  // Configuration (from React ViewState)
  // ─────────────────────────────────────────────────────────────────────────
  viewType: ViewType;
  pafv: ViewState['pafv'];
  viewOptions: ViewTypeOptions;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Selection State
  // ─────────────────────────────────────────────────────────────────────────
  selectedNodeIds: Set<string>;
  selectedEdgeIds: Set<string>;
  hoveredNodeId: string | null;
  focusedNodeId: string | null;
  
  // ─────────────────────────────────────────────────────────────────────────
  // Viewport
  // ─────────────────────────────────────────────────────────────────────────
  viewport: ViewState['viewport'];
  
  // ─────────────────────────────────────────────────────────────────────────
  // Callbacks (bubble events to React)
  // ─────────────────────────────────────────────────────────────────────────
  onNodeClick: (nodeId: string, event: MouseEvent) => void;
  onNodeDoubleClick: (nodeId: string, event: MouseEvent) => void;
  onNodeContextMenu: (nodeId: string, event: MouseEvent) => void;
  onNodeHover: (nodeId: string | null) => void;
  onNodeDragStart: (nodeId: string) => void;
  onNodeDragEnd: (nodeId: string, position: { x: number; y: number }) => void;
  
  onEdgeClick: (edgeId: string, event: MouseEvent) => void;
  onEdgeHover: (edgeId: string | null) => void;
  
  onSelectionChange: (nodeIds: string[], edgeIds: string[]) => void;
  onViewportChange: (viewport: ViewState['viewport']) => void;
  
  onCreateEdge: (sourceId: string, targetId: string) => void;
  onBackgroundClick: () => void;
  onBackgroundContextMenu: (event: MouseEvent, position: { x: number; y: number }) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// D3 VIEW CLASS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface D3ViewComponent {
  /**
   * Mount the view into a container element
   */
  mount(container: HTMLElement): void;
  
  /**
   * Update the view with new props (React state changed)
   * Should use D3 enter/update/exit pattern internally
   */
  update(props: D3ViewProps): void;
  
  /**
   * Cleanup: remove event listeners, stop simulations, etc.
   */
  destroy(): void;
  
  /**
   * Programmatic viewport control
   */
  zoomTo(nodeId: string, duration?: number): void;
  zoomToFit(padding?: number, duration?: number): void;
  resetZoom(duration?: number): void;
  
  /**
   * Export current view
   */
  exportSVG(): string;
  exportPNG(): Promise<Blob>;
}
```

### 5.2 View Type Implementations

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// VIEW REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

const viewRegistry: Record<ViewType, new () => D3ViewComponent> = {
  supergrid: SuperGridView,
  network: NetworkView,
  timeline: TimelineView,
  kanban: KanbanView,
  calendar: CalendarView,
  tree: TreeView,
  table: TableView,
  list: ListView,
};

// ═══════════════════════════════════════════════════════════════════════════
// SUPERGRID VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface SuperGridOptions {
  cellWidth: number;
  cellHeight: number;
  cellPadding: number;
  showHeaders: boolean;
  showCounts: boolean;
  collapsedGroups: Set<string>;
}

// ═══════════════════════════════════════════════════════════════════════════
// NETWORK VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface NetworkOptions {
  layout: 'force' | 'radial' | 'hierarchical';
  linkDistance: number;
  chargeStrength: number;
  collisionRadius: number;
  showLabels: boolean;
  showEdgeLabels: boolean;
  edgeCurvature: number;
  nodeSizeRange: [number, number];
}

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface TimelineOptions {
  orientation: 'horizontal' | 'vertical';
  swimlanes: boolean;
  swimlaneField: string;
  showMilestones: boolean;
  showConnections: boolean;
  clusterOverlapping: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// KANBAN VIEW
// ═══════════════════════════════════════════════════════════════════════════

interface KanbanOptions {
  columnField: string;              // Facet to group by
  columnOrder: string[];            // Fixed column order
  showWipLimits: boolean;
  wipLimits: Record<string, number>;
  showColumnCounts: boolean;
  cardTemplate: 'compact' | 'detailed';
}
```

### 5.3 D3 View Structure

```
src/
├── d3/
│   ├── views/
│   │   ├── BaseView.ts              # Shared functionality
│   │   ├── SuperGridView.ts
│   │   ├── NetworkView.ts
│   │   ├── TimelineView.ts
│   │   ├── KanbanView.ts
│   │   ├── CalendarView.ts
│   │   ├── TreeView.ts
│   │   ├── TableView.ts
│   │   ├── ListView.ts
│   │   └── index.ts
│   │
│   ├── scales/
│   │   ├── latchScales.ts           # LATCH → visual mapping
│   │   ├── colorScales.ts
│   │   ├── sizeScales.ts
│   │   └── index.ts
│   │
│   ├── behaviors/
│   │   ├── zoom.ts
│   │   ├── drag.ts
│   │   ├── brush.ts
│   │   ├── tooltip.ts
│   │   └── index.ts
│   │
│   ├── renderers/
│   │   ├── nodeRenderer.ts
│   │   ├── edgeRenderer.ts
│   │   ├── labelRenderer.ts
│   │   └── index.ts
│   │
│   └── utils/
│       ├── layout.ts
│       ├── animation.ts
│       ├── export.ts
│       └── index.ts
```

---

## 6. Notebook: Capture, Shell, Preview

### 6.1 Overview

The Notebook is Isometry's sidecar workspace for planning, AI interaction, and preview. It consists of three integrated canvases:

```
┌─────────────────────────────────────────────────────────────────────┐
│                           NOTEBOOK                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                    CAPTURE CANVAS                          │    │
│   │                                                            │    │
│   │    Rich text writing surface for notes, plans, ideas      │    │
│   │    Markdown with live preview                              │    │
│   │    Drag content to/from main workspace                     │    │
│   │                                                            │    │
│   └───────────────────────────────────────────────────────────┘    │
│                              ↕                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                     SHELL CANVAS                           │    │
│   │                                                            │    │
│   │    Claude AI conversation interface                        │    │
│   │    Context-aware: sees current selection, view state       │    │
│   │    Can execute Isometry commands                          │    │
│   │    Persistent conversation history                         │    │
│   │                                                            │    │
│   └───────────────────────────────────────────────────────────┘    │
│                              ↕                                      │
│   ┌───────────────────────────────────────────────────────────┐    │
│   │                    PREVIEW CANVAS                          │    │
│   │                                                            │    │
│   │    Live preview of generated content                       │    │
│   │    App preview (Designer Workbench)                        │    │
│   │    Export preview (before committing)                      │    │
│   │                                                            │    │
│   └───────────────────────────────────────────────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Capture Canvas

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CAPTURE CANVAS: Rich text writing surface
// ═══════════════════════════════════════════════════════════════════════════

interface CaptureCanvasProps {
  initialContent?: string;
  onContentChange: (content: string) => void;
  onCreateCard: (content: string, selection?: TextSelection) => void;
  onLinkCard: (cardId: string) => void;
}

interface CaptureCanvasFeatures {
  // Editing
  markdown: true;                    // Full markdown support
  livePreview: true;                 // Side-by-side or inline preview
  syntaxHighlight: true;             // Code blocks
  
  // Card integration
  cardMentions: true;                // @mention cards with autocomplete
  cardEmbeds: true;                  // Embed card previews
  dragToCreate: true;                // Select text → drag to workspace → creates card
  
  // AI assistance
  aiCompletion: true;                // Tab to complete
  aiSummarize: true;                 // Summarize selection
  aiExpand: true;                    // Expand selection
  
  // Export
  exportMarkdown: true;
  exportHTML: true;
  exportCards: true;                 // Convert to linked cards
}
```

### 6.3 Shell Canvas (Claude Interface)

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// SHELL CANVAS: Claude AI conversation
// ═══════════════════════════════════════════════════════════════════════════

interface ShellCanvasProps {
  // Context injection
  currentView: ViewState;
  selectedCards: Card[];
  captureContent: string;
  
  // Conversation
  conversationId: string;
  messages: Message[];
  
  // Callbacks
  onSendMessage: (content: string) => void;
  onExecuteCommand: (command: IsometryCommand) => void;
  onInsertToCapture: (content: string) => void;
  onCreateCards: (cards: Partial<Node>[]) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  
  // Isometry-specific
  attachedCards?: string[];          // Card IDs referenced
  generatedCards?: string[];         // Cards created by this message
  executedCommands?: IsometryCommand[];
}

// Commands Claude can execute
type IsometryCommand =
  | { type: 'CREATE_CARD'; data: Partial<Node> }
  | { type: 'UPDATE_CARD'; cardId: string; changes: Partial<Node> }
  | { type: 'CREATE_EDGE'; sourceId: string; targetId: string; edgeType: EdgeType }
  | { type: 'SET_FILTER'; filter: LATCHFilter }
  | { type: 'SET_VIEW'; viewType: ViewType }
  | { type: 'NAVIGATE'; canvasId: string }
  | { type: 'SEARCH'; query: string }
  | { type: 'EXPORT'; format: string; scope: string };
```

### 6.4 Preview Canvas

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// PREVIEW CANVAS: Live preview of generated content
// ═══════════════════════════════════════════════════════════════════════════

interface PreviewCanvasProps {
  mode: 'markdown' | 'app' | 'export' | 'diff';
  
  // Markdown preview
  markdownContent?: string;
  
  // App preview (Designer Workbench)
  appSpec?: ComponentSpec;
  appData?: any;
  
  // Export preview
  exportFormat?: 'json' | 'csv' | 'markdown' | 'html';
  exportContent?: string;
  
  // Diff preview
  diffBefore?: string;
  diffAfter?: string;
  
  // Actions
  onApply: () => void;
  onDiscard: () => void;
  onEdit: () => void;
}
```

### 6.5 Notebook Layout

```tsx
// ═══════════════════════════════════════════════════════════════════════════
// NOTEBOOK COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

function Notebook() {
  const [activePanel, setActivePanel] = useState<'capture' | 'shell' | 'preview'>('capture');
  const [panelSizes, setPanelSizes] = useState([40, 35, 25]); // Percentages
  
  const viewState = useViewStore();
  const selection = useSelectionStore();
  
  return (
    <div className="notebook">
      <PanelGroup direction="vertical" onLayout={setPanelSizes}>
        {/* Capture Canvas */}
        <Panel defaultSize={40} minSize={20}>
          <PanelHeader 
            title="Capture" 
            icon={<PenIcon />}
            actions={<CaptureActions />}
          />
          <CaptureCanvas
            onContentChange={handleContentChange}
            onCreateCard={handleCreateCard}
          />
        </Panel>
      
        <PanelResizeHandle />
      
        {/* Shell Canvas */}
        <Panel defaultSize={35} minSize={20}>
          <PanelHeader 
            title="Claude" 
            icon={<SparklesIcon />}
            actions={<ShellActions />}
          />
          <ShellCanvas
            currentView={viewState}
            selectedCards={selection.selectedNodes}
            onExecuteCommand={handleCommand}
          />
        </Panel>
      
        <PanelResizeHandle />
      
        {/* Preview Canvas */}
        <Panel defaultSize={25} minSize={15}>
          <PanelHeader 
            title="Preview" 
            icon={<EyeIcon />}
            actions={<PreviewActions />}
          />
          <PreviewCanvas
            mode={previewMode}
            content={previewContent}
            onApply={handleApply}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
```

---

## 7. App Builder: Designer Workbench

### 7.1 Overview

The Designer Workbench enables visual construction of Isometry applications through component composition, data binding, and live preview.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      DESIGNER WORKBENCH                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌─────────────┐  ┌────────────────────────────┐  ┌────────────┐  │
│   │  COMPONENT  │  │       DESIGN CANVAS        │  │  PROPERTY  │  │
│   │   PALETTE   │  │                            │  │   PANEL    │  │
│   │             │  │   ┌──────────────────┐     │  │            │  │
│   │  [Layout]   │  │   │   Board Header   │     │  │  Selected: │  │
│   │   Stack     │  │   ├───────┬──────────┤     │  │   Lane     │  │
│   │   Grid      │  │   │ Lane  │  Lane    │     │  │            │  │
│   │   Box       │  │   │ ───── │  ─────   │     │  │  Title:    │  │
│   │             │  │   │ Card  │  Card    │     │  │  [To Do  ] │  │
│   │  [Data]     │  │   │ Card  │  Card    │     │  │            │  │
│   │   DataGrid  │  │   │       │  Card    │     │  │  Filter:   │  │
│   │   List      │  │   └───────┴──────────┘     │  │  status =  │  │
│   │   Chart     │  │                            │  │  [todo   ] │  │
│   │             │  │   ──── Drop Zone ────      │  │            │  │
│   │  [Input]    │  │                            │  │  Bindings: │  │
│   │   TextField │  └────────────────────────────┘  │  items →   │  │
│   │   Select    │                                  │  query.    │  │
│   │   DatePick  │  ┌────────────────────────────┐  │  results   │  │
│   │             │  │       LIVE PREVIEW         │  │            │  │
│   │  [Display]  │  │                            │  └────────────┘  │
│   │   Text      │  │   (Actual running app)     │                  │
│   │   Badge     │  │                            │                  │
│   │   Avatar    │  └────────────────────────────┘                  │
│   └─────────────┘                                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Component Specification

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT SPEC: The declarative app definition
// ═══════════════════════════════════════════════════════════════════════════

interface ComponentSpec {
  id: string;
  type: ComponentType;
  props: Record<string, any>;        // Static props
  bindings: Record<string, Binding>; // Dynamic data bindings
  children?: ComponentSpec[];
  style?: StyleSpec;
  conditions?: ConditionalSpec[];    // Conditional rendering
}

type ComponentType =
  // Layout
  | 'Stack' | 'Grid' | 'Box' | 'Divider' | 'Spacer'
  | 'Board' | 'Lane' | 'Panel' | 'Tabs' | 'TabPanel'
  
  // Data Display
  | 'Text' | 'Number' | 'Date' | 'Avatar' | 'Badge' | 'Icon'
  | 'Image' | 'Link' | 'ProgressBar'
  
  // Data Collections
  | 'List' | 'DataGrid' | 'Table' | 'CardList'
  
  // Input
  | 'TextField' | 'TextArea' | 'Select' | 'MultiSelect'
  | 'DatePicker' | 'TimePicker' | 'Toggle' | 'Checkbox'
  | 'Slider' | 'ColorPicker'
  
  // Feedback
  | 'Alert' | 'Toast' | 'Modal' | 'Popover' | 'Tooltip'
  
  // Navigation
  | 'Menu' | 'Breadcrumb' | 'Pagination'
  
  // Isometry-specific
  | 'Card' | 'CardCompact' | 'CardExpanded'
  | 'FilterBar' | 'ViewSwitcher' | 'TimeSlider'
  | 'D3View';

interface Binding {
  source: 'facet' | 'context' | 'computed' | 'static' | 'query';
  path: string;
  transform?: TransformSpec;
  fallback?: any;
}

interface StyleSpec {
  className?: string;
  style?: React.CSSProperties;
  variants?: Record<string, boolean>;  // Tailwind-style variants
}

interface ConditionalSpec {
  condition: Binding;
  operator: 'equals' | 'not_equals' | 'truthy' | 'falsy' | 'gt' | 'lt';
  value?: any;
  then: 'show' | 'hide' | ComponentSpec;
  else?: 'show' | 'hide' | ComponentSpec;
}
```

### 7.3 Data Bindings

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// DATA BINDING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

interface AppDataContext {
  // Query results
  queries: Record<string, {
    data: any[];
    loading: boolean;
    error?: string;
  }>;
  
  // Current item (in iterations)
  item?: any;
  index?: number;
  
  // Selection state
  selection: {
    nodeIds: string[];
    edgeIds: string[];
  };
  
  // View state
  view: ViewState;
  
  // User context
  user?: {
    id: string;
    name: string;
  };
  
  // App state (user-defined)
  state: Record<string, any>;
}

// Binding resolution
function resolveBinding(binding: Binding, context: AppDataContext): any {
  switch (binding.source) {
    case 'facet':
      return context.item?.[binding.path];
  
    case 'context':
      return get(context, binding.path);
  
    case 'query':
      const [queryName, ...pathParts] = binding.path.split('.');
      const queryResult = context.queries[queryName];
      return pathParts.length > 0 
        ? get(queryResult?.data, pathParts.join('.'))
        : queryResult?.data;
  
    case 'computed':
      return evaluateExpression(binding.path, context);
  
    case 'static':
      return binding.path;
  
    default:
      return binding.fallback;
  }
}
```

### 7.4 Kanban App Example

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE: Project Management Kanban Board
// ═══════════════════════════════════════════════════════════════════════════

const kanbanAppSpec: ComponentSpec = {
  id: 'kanban-app',
  type: 'Stack',
  props: { direction: 'column', spacing: 0, height: '100vh' },
  children: [
    // Header
    {
      id: 'header',
      type: 'Box',
      props: { padding: 16, borderBottom: true },
      children: [
        {
          id: 'title',
          type: 'Text',
          props: { variant: 'h1' },
          bindings: { content: { source: 'context', path: 'view.title' } },
        },
        {
          id: 'filter-bar',
          type: 'FilterBar',
          props: {},
          bindings: { 
            filters: { source: 'context', path: 'view.latch.filters' }
          },
        },
      ],
    },
  
    // Board
    {
      id: 'board',
      type: 'Board',
      props: { 
        orientation: 'horizontal',
        gap: 16,
        padding: 16,
      },
      bindings: {
        columns: { 
          source: 'static', 
          path: JSON.stringify([
            { id: 'backlog', title: 'Backlog' },
            { id: 'todo', title: 'To Do' },
            { id: 'in_progress', title: 'In Progress' },
            { id: 'review', title: 'Review' },
            { id: 'done', title: 'Done' },
          ])
        },
      },
      children: [
        // Lane template (repeated for each column)
        {
          id: 'lane-template',
          type: 'Lane',
          props: { minWidth: 280, maxWidth: 320 },
          bindings: {
            title: { source: 'facet', path: 'title' },
            items: { 
              source: 'query', 
              path: 'tasks',
              transform: {
                type: 'filter',
                field: 'status',
                operator: 'equals',
                value: { source: 'facet', path: 'id' },
              },
            },
          },
          children: [
            // Card template
            {
              id: 'task-card',
              type: 'Card',
              props: { draggable: true, variant: 'compact' },
              children: [
                {
                  id: 'task-id',
                  type: 'Text',
                  props: { variant: 'caption', color: 'muted' },
                  bindings: { content: { source: 'facet', path: 'source_id' } },
                },
                {
                  id: 'task-name',
                  type: 'Text',
                  props: { variant: 'body', fontWeight: 'medium' },
                  bindings: { content: { source: 'facet', path: 'name' } },
                },
                {
                  id: 'task-meta',
                  type: 'Stack',
                  props: { direction: 'row', justify: 'space-between', align: 'center' },
                  children: [
                    {
                      id: 'priority',
                      type: 'Badge',
                      props: { size: 'sm' },
                      bindings: { 
                        content: { source: 'facet', path: 'priority' },
                        color: { 
                          source: 'computed', 
                          path: 'item.priority > 3 ? "red" : item.priority > 1 ? "yellow" : "gray"' 
                        },
                      },
                    },
                    {
                      id: 'assignee',
                      type: 'Avatar',
                      props: { size: 'sm' },
                      bindings: { 
                        user: { source: 'query', path: 'assignedUser' }
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

// Data queries for the app
const kanbanAppQueries = {
  tasks: {
    sql: `
      SELECT * FROM nodes 
      WHERE node_type = 'task' 
      AND folder = $projectFolder
      AND deleted_at IS NULL
      ORDER BY priority DESC, modified_at DESC
    `,
    params: { projectFolder: { source: 'context', path: 'app.projectFolder' } },
  },
  
  assignedUser: {
    sql: `
      SELECT n.* FROM nodes n
      JOIN edges e ON e.target_id = n.id
      WHERE e.source_id = $taskId
      AND e.edge_type = 'LINK'
      AND e.label = 'assigned_to'
      AND n.node_type = 'contact'
    `,
    params: { taskId: { source: 'facet', path: 'id' } },
  },
};
```

### 7.5 Component Registry

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT REGISTRY: Maps spec types to React components
// ═══════════════════════════════════════════════════════════════════════════

import { 
  Stack, Grid, Box, Divider, Spacer,
  Text, Badge, Avatar, Icon,
  TextField, Select, DatePicker, Toggle,
  Card, CardCompact, Lane, Board,
  FilterBar, ViewSwitcher, TimeSlider,
  D3View,
} from '@isometry/components';

const componentRegistry: Record<ComponentType, React.ComponentType<any>> = {
  // Layout
  Stack,
  Grid,
  Box,
  Divider,
  Spacer,
  Board,
  Lane,
  Panel,
  Tabs,
  TabPanel,
  
  // Data Display
  Text,
  Number: NumberDisplay,
  Date: DateDisplay,
  Avatar,
  Badge,
  Icon,
  Image,
  Link,
  ProgressBar,
  
  // Data Collections
  List,
  DataGrid,
  Table,
  CardList,
  
  // Input
  TextField,
  TextArea,
  Select,
  MultiSelect,
  DatePicker,
  TimePicker,
  Toggle,
  Checkbox,
  Slider,
  ColorPicker,
  
  // Feedback
  Alert,
  Toast,
  Modal,
  Popover,
  Tooltip,
  
  // Navigation
  Menu,
  Breadcrumb,
  Pagination,
  
  // Isometry-specific
  Card,
  CardCompact,
  CardExpanded,
  FilterBar,
  ViewSwitcher,
  TimeSlider,
  D3View,
};
```

---

## 8. File Formats & Interchange

### 8.1 Card JSON Format

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CARD JSON: Import/Export format for individual cards
// ═══════════════════════════════════════════════════════════════════════════

interface CardJSON {
  // Format metadata
  $schema: 'https://isometry.app/schemas/card/v4.json';
  version: '4.0';
  exportedAt: string;  // ISO 8601
  
  // Identity
  id: string;
  type: 'node' | 'edge';
  
  // For nodes
  node?: {
    nodeType: string;
    name: string;
    content?: string;
    summary?: string;
  
    // LATCH properties
    location?: {
      latitude?: number;
      longitude?: number;
      name?: string;
      address?: string;
    };
    time?: {
      created: string;
      modified: string;
      due?: string;
      completed?: string;
      eventStart?: string;
      eventEnd?: string;
    };
    category?: {
      folder?: string;
      tags?: string[];
      status?: string;
      color?: string;
      icon?: string;
    };
    hierarchy?: {
      priority?: number;
      importance?: number;
      sortOrder?: number;
    };
  
    // Source
    source?: {
      system?: string;
      id?: string;
      url?: string;
    };
  };
  
  // For edges
  edge?: {
    edgeType: 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';
    sourceId: string;
    targetId: string;
    label?: string;
    weight?: number;
    directed?: boolean;
    properties?: Record<string, any>;
  };
}
```

### 8.2 View JSON Format

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// VIEW JSON: Saved view configuration
// ═══════════════════════════════════════════════════════════════════════════

interface ViewJSON {
  $schema: 'https://isometry.app/schemas/view/v4.json';
  version: '4.0';
  exportedAt: string;
  
  // Identity
  id: string;
  name: string;
  viewType: ViewType;
  
  // PAFV configuration
  pafv: {
    xAxis?: { facetId: string; transform?: string; invert?: boolean };
    yAxis?: { facetId: string; transform?: string; invert?: boolean };
    zAxis?: { facetId: string; transform?: string; invert?: boolean };
    colorAxis?: { facetId: string; transform?: string; invert?: boolean };
    sizeAxis?: { facetId: string; transform?: string; invert?: boolean };
  };
  
  // LATCH configuration
  latch: {
    filters: Array<{
      facetId: string;
      operator: string;
      value: any;
    }>;
    groupBy?: string;
    sortBy: Array<{ facetId: string; direction: 'asc' | 'desc' }>;
  };
  
  // Time window
  timeWindow?: {
    start?: string;
    end?: string;
    granularity?: string;
  };
  
  // View-specific options
  options: Record<string, any>;
}
```

### 8.3 App JSON Format

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// APP JSON: Complete app definition
// ═══════════════════════════════════════════════════════════════════════════

interface AppJSON {
  $schema: 'https://isometry.app/schemas/app/v4.json';
  version: '4.0';
  exportedAt: string;
  
  // Identity
  id: string;
  name: string;
  description?: string;
  icon?: string;
  
  // Component tree
  components: ComponentSpec;
  
  // Data queries
  queries: Record<string, {
    sql: string;
    params?: Record<string, Binding>;
  }>;
  
  // Initial state
  initialState?: Record<string, any>;
  
  // Theme overrides
  theme?: {
    colors?: Record<string, string>;
    fonts?: Record<string, string>;
    spacing?: Record<string, number>;
  };
  
  // Metadata
  metadata: {
    createdAt: string;
    modifiedAt: string;
    version: string;
    author?: string;
    tags?: string[];
  };
}
```

### 8.4 Canvas Bundle Format

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// CANVAS BUNDLE: Export format for a complete canvas with cards
// ═══════════════════════════════════════════════════════════════════════════

interface CanvasBundleJSON {
  $schema: 'https://isometry.app/schemas/bundle/v4.json';
  version: '4.0';
  exportedAt: string;
  
  // Canvas definition
  canvas: {
    id: string;
    name: string;
    type: string;
    layoutConfig: any;
    viewState: any;
  };
  
  // All nodes in the canvas
  nodes: CardJSON[];
  
  // All edges between nodes
  edges: CardJSON[];
  
  // Positions on canvas
  positions: Array<{
    nodeId: string;
    x: number;
    y: number;
    z?: number;
    width?: number;
    height?: number;
  }>;
  
  // Saved views
  views: ViewJSON[];
  
  // Nested canvases (recursive)
  children?: CanvasBundleJSON[];
}
```

### 8.5 Export/Import Functions

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function exportCards(nodeIds: string[], format: 'json' | 'csv' | 'markdown'): Promise<string> {
  const nodes = await db.query('SELECT * FROM nodes WHERE id IN (?)', [nodeIds]);
  const edges = await db.query(`
    SELECT * FROM edges 
    WHERE source_id IN (?) OR target_id IN (?)
  `, [nodeIds, nodeIds]);
  
  switch (format) {
    case 'json':
      return JSON.stringify({
        $schema: 'https://isometry.app/schemas/bundle/v4.json',
        version: '4.0',
        exportedAt: new Date().toISOString(),
        nodes: nodes.map(nodeToCardJSON),
        edges: edges.map(edgeToCardJSON),
      }, null, 2);
  
    case 'csv':
      return nodesToCSV(nodes);
  
    case 'markdown':
      return nodesToMarkdown(nodes, edges);
  }
}

async function exportView(viewId: string): Promise<ViewJSON> {
  const view = await db.query('SELECT * FROM views WHERE id = ?', [viewId]);
  return viewToJSON(view[0]);
}

async function exportApp(appId: string): Promise<AppJSON> {
  const app = await db.query('SELECT * FROM apps WHERE id = ?', [appId]);
  return appToJSON(app[0]);
}

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function importBundle(bundle: CanvasBundleJSON, options: ImportOptions): Promise<ImportResult> {
  const result: ImportResult = {
    imported: { nodes: 0, edges: 0 },
    skipped: { nodes: 0, edges: 0 },
    errors: [],
  };
  
  await db.transaction(async () => {
    // Import nodes
    for (const cardJson of bundle.nodes) {
      try {
        const node = cardJSONToNode(cardJson);
      
        if (options.deduplicateBySource && node.source && node.sourceId) {
          const existing = await db.query(
            'SELECT id FROM nodes WHERE source = ? AND source_id = ?',
            [node.source, node.sourceId]
          );
          if (existing.length > 0) {
            result.skipped.nodes++;
            continue;
          }
        }
      
        await db.saveNode(node);
        result.imported.nodes++;
      } catch (error) {
        result.errors.push({ type: 'node', id: cardJson.id, error: error.message });
      }
    }
  
    // Import edges
    for (const cardJson of bundle.edges) {
      try {
        const edge = cardJSONToEdge(cardJson);
        await db.saveEdge(edge);
        result.imported.edges++;
      } catch (error) {
        result.errors.push({ type: 'edge', id: cardJson.id, error: error.message });
      }
    }
  });
  
  return result;
}

interface ImportOptions {
  deduplicateBySource?: boolean;
  updateExisting?: boolean;
  preserveIds?: boolean;
}

interface ImportResult {
  imported: { nodes: number; edges: number };
  skipped: { nodes: number; edges: number };
  errors: Array<{ type: string; id: string; error: string }>;
}
```

---

## 9. Platform Strategy

### 9.1 Target Platforms

| Platform | Technology | Priority | Status |
| --- | --- | --- | --- |
| **macOS** | Swift/SwiftUI + WebKit | P0 | In Development |
| **iOS/iPadOS** | Swift/SwiftUI + WebKit | P0 | In Development |
| **Web** | React + D3 (standalone) | P1 | Planned |
| **Windows** | Electron + WebKit | P2 | Future |
| **Linux** | Electron + WebKit | P3 | Future |

### 9.2 Native Architecture (macOS/iOS)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Native App (Swift/SwiftUI)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   SwiftUI Shell                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Native Menu Bar, Window Management, Preferences            │  │
│   │  Native Sharing, Files, Shortcuts                            │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   WebKit WKWebView                                                  │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  React Control Plane + D3 Data Plane                         │  │
│   │  (Full Isometry web interface)                              │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   Native Bridge (WKScriptMessageHandler)                            │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  JS → Swift: Database queries, CloudKit sync, file access   │  │
│   │  Swift → JS: Push notifications, deep links, shortcuts      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   Native Data Layer                                                 │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  SQLite (native)    │    CloudKit Sync    │    Keychain     │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.3 Web Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Web App (Standalone)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   React Control Plane + D3 Data Plane                               │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  Same codebase as native WebKit content                      │  │
│   │  Progressive Web App (PWA) capabilities                      │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   Browser Data Layer                                                │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  sql.js (WASM)  │  OPFS Storage  │  IndexedDB (fallback)   │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│                              ▼                                      │
│   Optional Sync                                                     │
│   ┌─────────────────────────────────────────────────────────────┐  │
│   │  REST API (future) or P2P sync (future)                     │  │
│   └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 9.4 Shared Code Strategy

```
packages/
├── @isometry/core                  # Shared TypeScript types & utilities
│   ├── types/                       # All type definitions
│   ├── utils/                       # Pure utility functions
│   └── constants/                   # Shared constants
│
├── @isometry/components            # React component library
│   ├── controls/                    # LATCH, PAFV controls
│   ├── primitives/                  # Base UI components
│   ├── cards/                       # Card renderers
│   └── notebook/                    # Capture, Shell, Preview
│
├── @isometry/d3                    # D3 visualization layer
│   ├── views/                       # View implementations
│   ├── scales/                      # LATCH → visual mapping
│   └── behaviors/                   # Zoom, drag, brush
│
├── @isometry/data                  # Data access layer
│   ├── sqlite/                      # SQLite operations
│   ├── queries/                     # Query builders
│   └── sync/                        # Sync abstractions
│
└── @isometry/app                   # App shell (platform-specific)
    ├── web/                         # Web PWA entry point
    └── native/                      # Native bridge utilities
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Working SuperGrid with React controls and D3 rendering

- [ ] SQLite schema v4 implementation
- [ ] Zustand state management setup
- [ ] D3 SuperGrid view implementation
- [ ] React control components: FilterNavigator, AxisConfigurator, ViewSwitcher
- [ ] Basic Card CRUD operations
- [ ] FTS5 search integration

**Deliverable:** Functional grid view with filtering and axis mapping

### Phase 2: Notebook (Weeks 5-8)

**Goal:** Complete Capture, Shell, Preview sidecar

- [ ] Capture Canvas with Markdown editing
- [ ] Shell Canvas with Claude integration
- [ ] Preview Canvas with live preview
- [ ] Panel resizing and layout persistence
- [ ] Card creation from Capture content

**Deliverable:** Working Notebook sidecar alongside main workspace

### Phase 3: Views (Weeks 9-12)

**Goal:** All core view types implemented

- [ ] Network view with force simulation
- [ ] Timeline view
- [ ] Kanban view with drag-and-drop
- [ ] Calendar view
- [ ] View switching with state preservation
- [ ] Time slider integration

**Deliverable:** Polymorphic views demonstrating PAFV power

### Phase 4: CloudKit Sync (Weeks 13-16)

**Goal:** Cross-device sync working

- [ ] CloudKitSyncManager actor implementation
- [ ] Push/pull sync cycles
- [ ] Conflict resolution UI
- [ ] Offline queue management
- [ ] Background sync
- [ ] Sync status UI

**Deliverable:** Data syncing across iPhone, iPad, Mac

### Phase 5: App Builder (Weeks 17-20)

**Goal:** Designer Workbench MVP

- [ ] Component palette
- [ ] Design canvas with drag-and-drop
- [ ] Property panel
- [ ] Data binding system
- [ ] Live preview
- [ ] App save/load

**Deliverable:** Users can build simple apps visually

### Phase 6: Polish (Weeks 21-24)

**Goal:** Production ready

- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Error handling and edge cases
- [ ] Documentation
- [ ] App Store preparation
- [ ] Beta testing

**Deliverable:** App Store submission

---

## Appendix A: Design Tokens

```css
/* ═══════════════════════════════════════════════════════════════════════════
   CARDBOARD DESIGN TOKENS
   ═══════════════════════════════════════════════════════════════════════════ */

:root {
  /* NeXTSTEP-inspired color palette */
  --cb-bg-primary: #2d2d2d;
  --cb-bg-secondary: #3d3d3d;
  --cb-bg-tertiary: #4d4d4d;
  --cb-bg-elevated: #5d5d5d;
  
  --cb-fg-primary: #ffffff;
  --cb-fg-secondary: #b0b0b0;
  --cb-fg-muted: #808080;
  
  --cb-accent-primary: #5a8dee;
  --cb-accent-secondary: #34c759;
  --cb-accent-warning: #ff9500;
  --cb-accent-danger: #ff3b30;
  
  /* Spacing scale */
  --cb-space-1: 4px;
  --cb-space-2: 8px;
  --cb-space-3: 12px;
  --cb-space-4: 16px;
  --cb-space-5: 24px;
  --cb-space-6: 32px;
  --cb-space-8: 48px;
  
  /* Typography */
  --cb-font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  --cb-font-mono: 'SF Mono', Monaco, 'Courier New', monospace;
  
  --cb-font-size-xs: 11px;
  --cb-font-size-sm: 13px;
  --cb-font-size-md: 15px;
  --cb-font-size-lg: 17px;
  --cb-font-size-xl: 20px;
  --cb-font-size-2xl: 24px;
  
  /* Borders */
  --cb-border-radius-sm: 4px;
  --cb-border-radius-md: 8px;
  --cb-border-radius-lg: 12px;
  --cb-border-radius-full: 9999px;
  
  --cb-border-color: rgba(255, 255, 255, 0.1);
  --cb-border-color-strong: rgba(255, 255, 255, 0.2);
  
  /* Shadows */
  --cb-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --cb-shadow-md: 0 4px 8px rgba(0, 0, 0, 0.3);
  --cb-shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.4);
  
  /* Z-index scale */
  --cb-z-base: 0;
  --cb-z-dropdown: 100;
  --cb-z-sticky: 200;
  --cb-z-overlay: 300;
  --cb-z-modal: 400;
  --cb-z-popover: 500;
  --cb-z-tooltip: 600;
  --cb-z-toast: 700;
  
  /* Transitions */
  --cb-transition-fast: 100ms ease-out;
  --cb-transition-normal: 200ms ease-out;
  --cb-transition-slow: 300ms ease-out;
}
```

---

## Appendix B: Keyboard Shortcuts

| Category | Shortcut | Action |
| --- | --- | --- |
| **Navigation** | `⌘1-9` | Switch to view 1-9 |
|  | `⌘[` / `⌘]` | Navigate back/forward |
|  | `⌘/` | Open command palette |
|  | `⌘K` | Quick search |
| **Selection** | `⌘A` | Select all |
|  | `⌘⇧A` | Deselect all |
|  | `⎋` | Clear selection |
| **Editing** | `⌘N` | New card |
|  | `⌘⌫` | Delete selected |
|  | `⌘D` | Duplicate selected |
|  | `⌘E` | Edit selected card |
| **View** | `⌘+` / `⌘-` | Zoom in/out |
|  | `⌘0` | Reset zoom |
|  | `⌘⇧F` | Toggle fullscreen |
|  | `⌘B` | Toggle sidebar |
| **Notebook** | `⌘⇧C` | Focus Capture |
|  | `⌘⇧S` | Focus Shell |
|  | `⌘⇧P` | Focus Preview |

---

*End of Isometry v4 Architecture Specification*
