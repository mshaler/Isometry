# Cards & Connections: Isometry Data Model v3

*Claude Code Handoff — February 2026*

---

## The Insight

There is no Node/Edge distinction at the Card level. There are just **Cards**. Some Cards have connections to other Cards. Some don't yet.

A Card is a Card. All Cards live in LATCH space. Connections are how Cards relate in GRAPH space. The schema stores *facts*. The views create *meaning*.

---

## Card Types (Four, No More)

| Type | Role | Why It Exists |
|------|------|---------------|
| **Note** | Content carrier | Freeform. The default. Open-ended schema-on-read. |
| **Person** | Anchor point | Thin. Basically a name + ways to reach them. A point on the Alphabet/Category axes. |
| **Event** | Anchor point | Thin. Basically a time + place. A point on the Time axis. Scheduled = calendar event, unscheduled = task. |
| **Resource** | Content carrier | A reference to something external: URL, file, document, image. |

**Anchors** (Person, Event) are lean and positional — they exist to be connected to.  
**Content** (Note, Resource) are thick and open — they carry the stuff that flows between anchors.

Everything else is a facet value, not a type:
- A "Project" is any Card with NEST connections to children
- A "Place" is a Location facet on any Card
- A "Task" is an Event with `due_at` but no `event_start`
- A "Company" is a Person with a group/collective flag
- A "Message" is a Note with sender/recipient connections

---

## Schema: Two Tables

### cards

The single source of truth. Every Card gets the full LATCH facet set.

```sql
CREATE TABLE IF NOT EXISTS cards (
    -- Identity
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note',  -- note, person, event, resource
    
    -- Content
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
    tags TEXT,       -- JSON array: ["tag1", "tag2"]
    status TEXT,
    
    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    -- Resource-specific (NULL for non-resources)
    url TEXT,
    mime_type TEXT,
    
    -- Person-specific (NULL for non-persons)
    is_collective INTEGER NOT NULL DEFAULT 0,  -- 0 = individual, 1 = group/org
    
    -- Source tracking (ETL deduplication)
    source TEXT,
    source_id TEXT,
    
    -- Lifecycle
    deleted_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    
    -- Sync metadata
    sync_status TEXT DEFAULT 'pending'
);

-- LATCH indexes
CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_folder ON cards(folder) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created_at);
CREATE INDEX IF NOT EXISTS idx_cards_modified ON cards(modified_at);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_priority ON cards(priority DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(due_at) WHERE due_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cards_event ON cards(event_start) WHERE event_start IS NOT NULL AND deleted_at IS NULL;

-- Source deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_source ON cards(source, source_id) 
    WHERE source IS NOT NULL AND source_id IS NOT NULL;
```

### connections

Lightweight join. A connection records when a Card relates to another Card. The connection itself is not a Card — it's a *role* a Card plays.

```sql
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY NOT NULL,
    
    -- The two endpoints
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    
    -- Optional: a Card that serves as the bridge (e.g., a Note connecting two People)
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
    
    -- User-provided label (schema-on-read, not an enum)
    label TEXT,
    
    -- Weight for graph algorithms
    weight REAL NOT NULL DEFAULT 1.0,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    
    -- Prevent exact duplicates
    UNIQUE(source_id, target_id, via_card_id)
);

-- Graph traversal
CREATE INDEX IF NOT EXISTS idx_conn_source ON connections(source_id);
CREATE INDEX IF NOT EXISTS idx_conn_target ON connections(target_id);
CREATE INDEX IF NOT EXISTS idx_conn_via ON connections(via_card_id) WHERE via_card_id IS NOT NULL;
```

### FTS5 (Full-Text Search)

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
    name,
    content,
    tags,
    folder,
    content='cards',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Keep FTS in sync
CREATE TRIGGER IF NOT EXISTS trg_cards_fts_insert AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_cards_fts_delete AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
END;

CREATE TRIGGER IF NOT EXISTS trg_cards_fts_update AFTER UPDATE OF name, content, tags, folder ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;
```

---

## How It Works

### The Two Spaces

Every Card exists in both spaces simultaneously:

- **LATCH space**: When was it created? What folder? What priority? → Separation, filtering, sorting
- **GRAPH space**: What is it connected to? Through what? → Traversal, clustering, pathfinding

### Implicit → Explicit Workflow

```
LATCH reveals       →  Human recognizes  →  GRAPH records
(SuperGrid shows        (user sees two       (user drags a
 two Cards share         Cards adjacent,      connection,
 a Category axis)        notices pattern)     makes it explicit)
```

SuperGrid is where latent structure becomes visible. Implicit connections (LATCH coincidences) are discoverable through projection. Explicit connections are what the user promotes into the graph.

### The `via_card_id` Pattern

This is the key to rich connections without schema-on-write:

```
Person A  ←──connection──→  Person B
                │
            via_card_id: Note C

Note C contains the meeting notes, the email thread, 
the shared document. The connection's richness comes 
from the Card it passes through, not from columns 
on the connections table.
```

A connection between two People isn't characterized by relationship-type enums. It's characterized by the Notes, Events, and Resources that sit between them.

---

## What NOT to Do

❌ Don't pre-define edge types (LINK, NEST, SEQUENCE, AFFINITY) as an enum  
❌ Don't add `channel`, `subject`, `role` columns to connections  
❌ Don't create separate `nodes` and `edges` tables  
❌ Don't try to taxonomize relationship types upfront  
❌ Don't add card types beyond the four (Note, Person, Event, Resource)

✅ Store facts in cards, meaning in views  
✅ Keep connections minimal: source, target, optional via_card, optional label  
✅ Let LATCH projections reveal implicit structure  
✅ Let users promote implicit connections to explicit ones  
✅ Let card_type guide default rendering, not ontology

---

## Key Principles

1. **A Card is a Card** — no node/edge distinction at the data level
2. **Schema stores facts, views create meaning** — schema-on-read, not schema-on-write
3. **Anchors are lean, content is open** — Person/Event are positional, Note/Resource are freeform
4. **Connections are rich through what they bridge** — not through their own columns
5. **LATCH reveals, human recognizes, GRAPH records** — implicit → explicit promotion
6. **Four types, two tables** — that's the whole data model

---

## Implementation Notes for Claude Code

### Priority Order
1. Create `cards` table with indexes
2. Create `connections` table with indexes  
3. Create FTS5 virtual table and triggers
4. Basic CRUD operations (insert, update, soft-delete, query)
5. FTS5 search function
6. Connected-nodes query (recursive CTE on connections)
7. Sample data seeder with a few Cards of each type and some connections

### Test Strategy (TDD)
- Card CRUD: create, read, update, soft-delete for each card_type
- Connections: create connection, query neighbors, delete cascades
- FTS5: search by name, content, tags; prefix matching
- Graph: connected nodes at depth 1, 2, 3; cycle prevention
- Implicit connections: query Cards sharing a LATCH facet value (same folder, same tag, same date)

### What This Replaces
This supersedes the `nodes` + `edges` tables from `SQLITE-MIGRATION-PLAN-v2.md`. The `facets` table, `sync_state` table, `settings` table, and `schema_migrations` table from that plan are still valid and should be retained.
