// ============================================================================
// Isometry Database Initialization
// ============================================================================
// Initializes sql.js SQLite database with schema and seed data
// ============================================================================

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

// Re-export database type for convenience
export type Database = SqlJsDatabase;

// Singleton database instance
let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

// Schema SQL (embedded for bundling)
const SCHEMA = `
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
  name TEXT NOT NULL,
  content TEXT,
  location TEXT,
  latitude REAL,
  longitude REAL,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now')),
  due TEXT,
  category TEXT,
  status TEXT DEFAULT 'active',
  tags TEXT,
  priority INTEGER DEFAULT 3,
  parent_id TEXT REFERENCES cards(id),
  metadata TEXT
);

-- Edges table (relationships in LPG model)
CREATE TABLE IF NOT EXISTS edges (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),
  source_id TEXT NOT NULL REFERENCES cards(id),
  target_id TEXT NOT NULL REFERENCES cards(id),
  type TEXT NOT NULL DEFAULT 'link',
  weight REAL DEFAULT 1.0,
  label TEXT,
  metadata TEXT,
  created TEXT DEFAULT (datetime('now')),
  updated TEXT DEFAULT (datetime('now'))
);

-- Facets table (available facets per dataset for PAFV)
CREATE TABLE IF NOT EXISTS facets (
  id TEXT PRIMARY KEY,
  dataset_id TEXT REFERENCES datasets(id),
  name TEXT NOT NULL,
  field TEXT NOT NULL,
  axis TEXT NOT NULL,
  label TEXT,
  icon TEXT,
  color TEXT,
  options TEXT,
  created TEXT DEFAULT (datetime('now'))
);

-- Indexes
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
`;

// Seed data SQL
const SEED_DATA = `
-- Default apps
INSERT OR IGNORE INTO apps (id, name, description, icon) VALUES
  ('demo', 'Demo', 'Demo application for testing', 'layout-grid'),
  ('inbox', 'Inbox', 'Incoming items to process', 'inbox'),
  ('projects', 'Projects', 'Project management', 'folder'),
  ('linkedin', 'LinkedIn', 'LinkedIn contacts and posts', 'linkedin'),
  ('mtgs', 'MTGs', 'Meeting notes and scheduling', 'calendar'),
  ('readwatch', 'ReadWatch', 'Reading list and watchlist', 'book-open');

-- Default datasets
INSERT OR IGNORE INTO datasets (id, name, app_id, description) VALUES
  ('etl', 'ETL', 'demo', 'Extract, Transform, Load pipeline data'),
  ('cas', 'CAS', 'demo', 'Content Addressable Storage'),
  ('catalog', 'Catalog', 'demo', 'Asset catalog'),
  ('taxonomy', 'Taxonomy', 'demo', 'Classification taxonomy'),
  ('notes', 'Notes', 'inbox', 'Quick notes and captures'),
  ('projects', 'Projects', 'projects', 'Project items'),
  ('contacts', 'Contacts', 'linkedin', 'LinkedIn contacts'),
  ('messages', 'Messages', 'inbox', 'Messages and communications');

-- Sample cards for Demo/ETL
INSERT OR IGNORE INTO cards (id, dataset_id, name, content, category, status, priority, created) VALUES
  ('card-1', 'etl', 'Extract Customer Data', 'Pull customer records from CRM', 'extract', 'active', 2, datetime('now', '-7 days')),
  ('card-2', 'etl', 'Transform Address Format', 'Normalize addresses to standard format', 'transform', 'active', 3, datetime('now', '-5 days')),
  ('card-3', 'etl', 'Load to Data Warehouse', 'Insert transformed data into DW', 'load', 'pending', 4, datetime('now', '-3 days')),
  ('card-4', 'etl', 'Validate Data Quality', 'Run quality checks on pipeline', 'validate', 'completed', 1, datetime('now', '-1 day')),
  ('card-5', 'etl', 'Schedule Daily Run', 'Set up cron job for daily execution', 'config', 'active', 5, datetime('now'));

-- Sample edges
INSERT OR IGNORE INTO edges (id, dataset_id, source_id, target_id, type, label) VALUES
  ('edge-1', 'etl', 'card-1', 'card-2', 'flows-to', 'Customer data'),
  ('edge-2', 'etl', 'card-2', 'card-3', 'flows-to', 'Normalized data'),
  ('edge-3', 'etl', 'card-3', 'card-4', 'triggers', 'On completion');

-- Default facets for ETL
INSERT OR IGNORE INTO facets (id, dataset_id, name, field, axis, label) VALUES
  ('facet-1', 'etl', 'Category', 'category', 'category', 'Stage'),
  ('facet-2', 'etl', 'Status', 'status', 'category', 'Status'),
  ('facet-3', 'etl', 'Priority', 'priority', 'hierarchy', 'Priority'),
  ('facet-4', 'etl', 'Created', 'created', 'time', 'Created Date'),
  ('facet-5', 'etl', 'Name', 'name', 'alphabet', 'Name');
`;

/**
 * Initialize the database with schema and seed data
 * Returns the same instance on subsequent calls
 */
export async function initDatabase(): Promise<Database> {
  // Return existing instance if available
  if (db) return db;

  // Return in-progress initialization if available
  if (initPromise) return initPromise;

  // Start initialization
  initPromise = (async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();

    // Create schema
    db.run(SCHEMA);

    // Insert seed data
    db.run(SEED_DATA);

    return db;
  })();

  return initPromise;
}

/**
 * Get the current database instance (null if not initialized)
 */
export function getDatabase(): Database | null {
  return db;
}

/**
 * Close the database and clear the singleton
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
  initPromise = null;
}
