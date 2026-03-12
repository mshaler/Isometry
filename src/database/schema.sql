-- Isometry v5 Canonical Schema
-- Source of truth: v5/Modules/Core/Contracts.md + .planning/phases/01-database-foundation/01-RESEARCH.md Pattern 5
-- DB-02, DB-03, DB-04, DB-06

-- ============================================================
-- Cards (25 columns per Contracts.md §1.2)
-- ============================================================
CREATE TABLE cards (
    -- Identity
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note'
        CHECK (card_type IN ('note', 'task', 'event', 'resource', 'person')),

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
    tags TEXT,          -- JSON array: ["tag1", "tag2"]
    status TEXT,

    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,

    -- Resource-specific
    url TEXT,
    mime_type TEXT,

    -- Collection flag
    is_collective INTEGER NOT NULL DEFAULT 0,

    -- Source tracking (ETL deduplication)
    source TEXT,
    source_id TEXT,
    source_url TEXT,

    -- Lifecycle
    deleted_at TEXT
);

-- Partial indexes (WHERE deleted_at IS NULL) for common soft-delete filters
CREATE INDEX idx_cards_type     ON cards(card_type)  WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_folder   ON cards(folder)     WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_status   ON cards(status)     WHERE deleted_at IS NULL;
-- Regular temporal indexes (scan all rows including deleted)
CREATE INDEX idx_cards_created  ON cards(created_at);
CREATE INDEX idx_cards_modified ON cards(modified_at);
-- Unique source index: only when both source and source_id are non-null (ETL dedup)
CREATE UNIQUE INDEX idx_cards_source ON cards(source, source_id)
    WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- Phase 76: Covering indexes for SuperGrid GROUP BY bottlenecks
-- Composite covering index for folder+card_type GROUP BY (24.9ms -> target 12ms)
CREATE INDEX IF NOT EXISTS idx_cards_sg_folder_type
    ON cards(folder, card_type, deleted_at);

-- Expression indexes for strftime() time granularities on created_at
-- CRITICAL: Expressions must EXACTLY match SuperGridQuery.ts STRFTIME_PATTERNS
-- evaluated with field = 'created_at' (byte-identical — even whitespace matters)
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_day
    ON cards(strftime('%Y-%m-%d', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_week
    ON cards(strftime('%Y-W%W', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_month
    ON cards(strftime('%Y-%m', created_at));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_quarter
    ON cards(strftime('%Y', created_at) || '-Q' || ((CAST(strftime('%m', created_at) AS INT) - 1) / 3 + 1));
CREATE INDEX IF NOT EXISTS idx_cards_sg_created_year
    ON cards(strftime('%Y', created_at));

-- ============================================================
-- Connections (per D-001 and Contracts.md §2.1)
-- ============================================================
CREATE TABLE connections (
    id TEXT PRIMARY KEY NOT NULL,

    -- Endpoints
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,

    -- Via card (optional): the card that mediates this connection
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,

    -- Properties
    label TEXT,
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),

    -- Metadata
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    -- Prevent exact duplicates (Contracts.md §2.1 — includes via_card_id)
    UNIQUE(source_id, target_id, via_card_id, label)
);

-- Indexes for graph traversal
CREATE INDEX idx_conn_source ON connections(source_id);
CREATE INDEX idx_conn_target ON connections(target_id);
CREATE INDEX idx_conn_via    ON connections(via_card_id) WHERE via_card_id IS NOT NULL;

-- ============================================================
-- FTS5 virtual table (per D-004 and Contracts.md §5.1)
-- Field order: name, content, folder, tags (canonical per Contracts.md §5.1)
-- ============================================================
CREATE VIRTUAL TABLE cards_fts USING fts5(
    name,
    content,
    folder,
    tags,
    content='cards',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- ============================================================
-- Three-trigger FTS sync (per DB-03)
-- MUST be three separate triggers — a single combined trigger causes FTS5 corruption
-- See: .planning/phases/01-database-foundation/01-RESEARCH.md Pitfall 1
-- ============================================================
CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;

CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
END;

-- UPDATE trigger: scoped to FTS-indexed columns only (name, content, folder, tags)
-- Uses delete-then-insert with OLD/NEW values to avoid FTS5 re-read corruption
CREATE TRIGGER cards_fts_au AFTER UPDATE OF name, content, folder, tags ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;

-- ============================================================
-- UI State (Tier 2 persistence per D-005 and Contracts.md §6.3)
-- Using ui_state for Phase 1; full app_state/view_state split in Phase 4 (Providers)
-- ============================================================
CREATE TABLE ui_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ============================================================
-- Import Sources (ETL-02)
-- Tracks registered import sources for provenance
-- ============================================================
CREATE TABLE import_sources (
    id TEXT PRIMARY KEY NOT NULL,  -- UUID
    name TEXT NOT NULL,             -- User-friendly name (e.g., "Apple Notes Export")
    source_type TEXT NOT NULL,      -- 'apple_notes', 'markdown', etc.
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Unique constraint: one source per (source_type, name) combination
CREATE UNIQUE INDEX idx_import_sources_type_name ON import_sources(source_type, name);

-- ============================================================
-- Import Runs (ETL-02)
-- Records each import execution for auditing
-- ============================================================
CREATE TABLE import_runs (
    id TEXT PRIMARY KEY NOT NULL,  -- UUID
    source_id TEXT NOT NULL REFERENCES import_sources(id) ON DELETE CASCADE,
    filename TEXT,                  -- Original filename/path
    started_at TEXT NOT NULL,
    completed_at TEXT,
    cards_inserted INTEGER NOT NULL DEFAULT 0,
    cards_updated INTEGER NOT NULL DEFAULT 0,
    cards_unchanged INTEGER NOT NULL DEFAULT 0,
    cards_skipped INTEGER NOT NULL DEFAULT 0,
    connections_created INTEGER NOT NULL DEFAULT 0,
    errors_json TEXT                -- JSON array of ParseError objects
);

CREATE INDEX idx_import_runs_source ON import_runs(source_id);
CREATE INDEX idx_import_runs_completed ON import_runs(completed_at);
