-- ============================================================================
-- Isometry Database Schema
-- ============================================================================
-- SQLite schema for cards, edges, facets, apps, and datasets
-- Based on PAFV + LATCH + GRAPH architecture
-- ============================================================================

-- Apps table (Demo, Inbox, Projects, etc.)
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);

-- Datasets table (ETL, CAS, Catalog, etc.)
CREATE TABLE IF NOT EXISTS datasets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  app_id TEXT REFERENCES apps(id),
  description TEXT,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);

-- Cards table (nodes in LPG model)
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),

  -- Core fields
  name TEXT NOT NULL,
  content TEXT,

  -- LATCH: Location
  location TEXT,
  latitude REAL,
  longitude REAL,

  -- LATCH: Alphabet (name is used for sorting)

  -- LATCH: Time
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now')),
  due TEXT,

  -- LATCH: Category
  category TEXT,
  status TEXT DEFAULT 'active',
  tags TEXT, -- JSON array

  -- LATCH: Hierarchy
  priority INTEGER DEFAULT 3,
  parent_id TEXT REFERENCES cards(id),

  -- Additional metadata
  metadata TEXT -- JSON object
);

-- Edges table (relationships in LPG model)
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),

  source_id TEXT NOT NULL REFERENCES cards(id),
  target_id TEXT NOT NULL REFERENCES cards(id),

  -- Edge type/label
  type TEXT NOT NULL DEFAULT 'link',

  -- Edge properties
  weight REAL DEFAULT 1.0,
  label TEXT,
  metadata TEXT, -- JSON object

  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);

-- Facets table (available facets per dataset for PAFV)
CREATE TABLE IF NOT EXISTS facets (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),

  name TEXT NOT NULL,
  field TEXT NOT NULL, -- maps to cards column or metadata key
  axis TEXT NOT NULL, -- LATCH axis: location, alphabet, time, category, hierarchy

  -- Display config
  label TEXT,
  icon TEXT,
  color TEXT,

  -- Facet options for category axis
  options TEXT, -- JSON array of valid values

  created TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_cards_dataset ON cards(dataset_id);
CREATE INDEX IF NOT EXISTS idx_cards_category ON cards(category);
CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_priority ON cards(priority);
CREATE INDEX IF NOT EXISTS idx_cards_created ON cards(created);
CREATE INDEX IF NOT EXISTS idx_cards_parent ON cards(parent_id);

CREATE INDEX IF NOT EXISTS idx_edges_dataset ON edges(dataset_id);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);

CREATE INDEX IF NOT EXISTS idx_facets_dataset ON facets(dataset_id);
CREATE INDEX IF NOT EXISTS idx_facets_axis ON facets(axis);
