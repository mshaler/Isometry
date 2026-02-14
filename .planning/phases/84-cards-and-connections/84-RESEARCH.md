# Phase 84 Research: Cards & Connections Schema Migration

**Phase:** 84 (Cards & Connections)
**Status:** RESEARCH
**Source:** `CARDS-AND-CONNECTIONS.md`

## Overview

This phase implements a fundamental data model simplification: migrating from `nodes` + `edges` to `cards` + `connections`. The new model enforces four card types (Note, Person, Event, Resource) and uses a simpler connection model with `via_card_id` for rich relationships.

## Current Schema Analysis

### nodes table (Current)
```sql
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT NOT NULL DEFAULT 'note',  -- Unconstrained
    name TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    -- LATCH: Location
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    location_address TEXT,  -- Extra field not in new schema
    -- LATCH: Time
    created_at TEXT,
    modified_at TEXT,
    due_at TEXT,
    completed_at TEXT,
    event_start TEXT,
    event_end TEXT,
    -- LATCH: Category
    folder TEXT,
    tags TEXT,
    status TEXT,
    -- LATCH: Hierarchy
    priority INTEGER,
    importance INTEGER,  -- Extra field not in new schema
    sort_order INTEGER,
    -- Grid positioning
    grid_x REAL,         -- Extra field not in new schema
    grid_y REAL,         -- Extra field not in new schema
    -- Metadata
    source TEXT,
    source_id TEXT,
    source_url TEXT,     -- Extra field not in new schema
    deleted_at TEXT,
    version INTEGER
);
```

### edges table (Current)
```sql
CREATE TABLE IF NOT EXISTS edges (
    id TEXT PRIMARY KEY,
    edge_type TEXT NOT NULL,  -- LINK, NEST, SEQUENCE, AFFINITY (enum)
    source_id TEXT NOT NULL REFERENCES nodes(id),
    target_id TEXT NOT NULL REFERENCES nodes(id),
    label TEXT,
    weight REAL DEFAULT 1.0,
    directed INTEGER DEFAULT 1,
    sequence_order INTEGER,
    channel TEXT,
    timestamp TEXT,
    subject TEXT,
    created_at TEXT,
    UNIQUE(source_id, target_id, edge_type)
);
```

## Proposed Schema (from CARDS-AND-CONNECTIONS.md)

### cards table (New)
```sql
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note',  -- CONSTRAINED: note, person, event, resource
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
    tags TEXT,
    status TEXT,
    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- Resource-specific
    url TEXT,
    mime_type TEXT,
    -- Person-specific
    is_collective INTEGER NOT NULL DEFAULT 0,
    -- Source tracking
    source TEXT,
    source_id TEXT,
    -- Lifecycle
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    sync_status TEXT DEFAULT 'pending'
);
```

### connections table (New)
```sql
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,  -- NEW: Bridge card
    label TEXT,                                                 -- User-provided, not enum
    weight REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(source_id, target_id, via_card_id)
);
```

## Migration Mapping

### Columns Retained
| Current (nodes) | New (cards) | Notes |
|-----------------|-------------|-------|
| id | id | Same |
| node_type | card_type | Constrained to 4 values |
| name | name | Same |
| content | content | Same |
| summary | summary | Same |
| latitude, longitude, location_name | Same | Same |
| created_at, modified_at | Same | Format standardized to ISO 8601 |
| due_at, completed_at | Same | Same |
| event_start, event_end | Same | Same |
| folder, tags, status | Same | Same |
| priority | priority | Same |
| sort_order | sort_order | Same |
| source, source_id | Same | Same |
| deleted_at | deleted_at | Same |
| version | version | Same |

### Columns Removed
| Current (nodes) | Reason |
|-----------------|--------|
| location_address | Redundant with location_name |
| importance | Redundant with priority |
| grid_x, grid_y | View state, not data |
| source_url | Can be stored in url field for Resource cards |

### Columns Added
| New (cards) | Purpose |
|-------------|---------|
| url | Resource-specific (external reference) |
| mime_type | Resource-specific (file type) |
| is_collective | Person-specific (individual vs org) |
| sync_status | Sync state tracking |

### Edge → Connection Mapping
| Current (edges) | New (connections) | Notes |
|-----------------|-------------------|-------|
| id | id | Same |
| source_id | source_id | Same |
| target_id | target_id | Same |
| - | via_card_id | NEW: Bridge card for rich connections |
| edge_type | label | Lowercase string: "link", "nest", "sequence", "affinity" |
| label | label | Merged with edge_type (edge_type takes precedence if label was NULL) |
| weight | weight | Same |
| directed | - | REMOVED: Direction is a view concern |
| sequence_order | - | REMOVED: Use sort_order on cards |
| channel | - | REMOVED: Schema-on-read (use via_card) |
| timestamp | - | REMOVED: Use via_card's created_at |
| subject | - | REMOVED: Use via_card's name |

## Migration Strategy

### Phase 84-01: Schema Migration
1. Create new `cards` and `connections` tables
2. Rename `node_properties` → `card_properties` (update FK reference)
3. Copy data from `nodes` to `cards` with transformations
4. Copy data from `edges` to `connections` (edge_type → label as lowercase)
5. Update FTS5 tables and triggers (nodes_fts → cards_fts)
6. Update `notebook_cards` FK reference (node_id → card_id)
7. Keep old tables for rollback (nodes_backup, edges_backup)

### Phase 84-02: TypeScript Types
1. Create `Card` interface with discriminated union for card_type
2. Create `Connection` interface
3. Update existing Node/Edge references
4. Add type guards: `isNote()`, `isPerson()`, `isEvent()`, `isResource()`

### Phase 84-03: Query Updates
1. Update SQL queries to use `cards` instead of `nodes`
2. Update SQL queries to use `connections` instead of `edges`
3. Update `useLiveQuery` and other hooks
4. Update ETL importers

### Phase 84-04: Test & Cleanup
1. Run full test suite
2. Verify SuperGrid still works
3. Verify ETL importers still work
4. Drop backup tables after verification

## Impact Assessment

### Files to Update
- `src/db/schema.sql` - New schema
- `src/db/types.ts` - TypeScript types
- `src/types/node.ts` - Rename to card.ts
- `src/hooks/database/*.ts` - Query hooks
- `src/services/query/*.ts` - Query services
- `src/etl/*.ts` - ETL importers
- `src/d3/SuperGridEngine/*.ts` - Data binding
- `src/components/**/*.tsx` - Component props

### Risks
1. **Data loss**: Mitigated by keeping backup tables
2. **Breaking changes**: TypeScript will catch most issues
3. **Performance**: New schema is simpler, should be faster
4. **FTS5 sync**: Must update triggers for new table names

## Key Principles (from source document)

1. **A Card is a Card** — no node/edge distinction at data level
2. **Schema stores facts, views create meaning** — schema-on-read
3. **Anchors are lean, content is open** — Person/Event positional, Note/Resource freeform
4. **Connections are rich through what they bridge** — via_card_id pattern
5. **LATCH reveals, human recognizes, GRAPH records** — implicit → explicit
6. **Four types, two tables** — that's the whole data model

## Design Decisions (Resolved)

### 1. Directed Edges → Removed
All connections are bidirectional by default. Direction is a **view concern**, not a data concern. When projecting a connection onto a timeline, the earlier Card naturally reads as "source" — but that's the projection creating directionality, not the data. If a specific user label implies direction ("reports to", "depends on"), the label carries that meaning. No `directed` column needed.

### 2. Edge Type Migration → Labels as Strings
Don't map them to an enum. The four types (LINK, NEST, SEQUENCE, AFFINITY) were a schema-on-write ontological commitment that the new model deliberately avoids. During migration:
- `edge_type` → `label` as lowercase string: `"link"`, `"nest"`, `"sequence"`, `"affinity"`
- These are just user labels now, not an enum
- New connections can have any label or no label at all

### 3. node_properties → card_properties (Keep)
Rename to `card_properties`. This is the schema-on-read escape hatch — it's where arbitrary key-value pairs live without polluting the cards table with columns for every possible facet. The cards table has the common LATCH facets that every Card shares. `card_properties` holds everything else. That's the right split.

### 4. notebook_cards → Keep As-Is
Keep as-is, referencing `cards.id`. A notebook is a **view** over Cards — it's a specific ordered projection, like a playlist is to songs. It shouldn't be a card type; it should stay as its own coordination table. Same principle as canvases: they're containers that reference Cards, not Cards themselves.
