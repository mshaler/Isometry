#!/bin/bash

# ============================================================================
# Complete Isometry Claude Code Handoff
# ============================================================================
# Adds all missing files needed for Claude Code to start MVP implementation
# Run after: setup-isometry.sh, add-figma-components.sh, add-dsl-specs.sh
# ============================================================================

set -e

PROJECT_DIR="${1:-$HOME/Developer/Projects/Isometry}"

echo "============================================================================"
echo "  Isometry Claude Code Handoff"
echo "============================================================================"
echo ""
echo "Project directory: $PROJECT_DIR"
echo ""

cd "$PROJECT_DIR"

# ============================================================================
# 1. SQLite Schema
# ============================================================================

echo "Creating SQLite schema..."

mkdir -p src/db

cat > src/db/schema.sql << 'SCHEMA_EOF'
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

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS nodes_fts USING fts5(
    name, content, tags, folder,
    content='nodes',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- FTS sync triggers
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
SCHEMA_EOF

# ============================================================================
# 2. Core Type Definitions
# ============================================================================

echo "Creating type definitions..."

mkdir -p src/types

cat > src/types/index.ts << 'TYPES_INDEX_EOF'
// Type definitions barrel export
export * from './node';
export * from './filter';
export * from './view';
export * from './pafv';
TYPES_INDEX_EOF

cat > src/types/node.ts << 'TYPES_NODE_EOF'
// Node (Card) types

export type NodeType = 'note' | 'task' | 'contact' | 'event' | 'project' | 'resource';
export type TaskStatus = 'active' | 'pending' | 'completed' | 'archived';
export type EdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

export interface Node {
  id: string;
  nodeType: NodeType;
  name: string;
  content: string | null;
  summary: string | null;
  
  // LATCH: Location
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
  
  // LATCH: Time
  createdAt: string;
  modifiedAt: string;
  dueAt: string | null;
  completedAt: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  
  // LATCH: Category
  folder: string | null;
  tags: string[];
  status: TaskStatus | null;
  
  // LATCH: Hierarchy
  priority: number;
  importance: number;
  sortOrder: number;
  
  // Metadata
  source: string | null;
  sourceId: string | null;
  sourceUrl: string | null;
  deletedAt: string | null;
  version: number;
}

export interface Edge {
  id: string;
  edgeType: EdgeType;
  sourceId: string;
  targetId: string;
  label: string | null;
  weight: number;
  directed: boolean;
  sequenceOrder: number | null;
  channel: string | null;
  timestamp: string | null;
  subject: string | null;
  createdAt: string;
}

// Database row converters
export function rowToNode(row: Record<string, unknown>): Node {
  return {
    id: row.id as string,
    nodeType: row.node_type as NodeType,
    name: row.name as string,
    content: row.content as string | null,
    summary: row.summary as string | null,
    latitude: row.latitude as number | null,
    longitude: row.longitude as number | null,
    locationName: row.location_name as string | null,
    locationAddress: row.location_address as string | null,
    createdAt: row.created_at as string,
    modifiedAt: row.modified_at as string,
    dueAt: row.due_at as string | null,
    completedAt: row.completed_at as string | null,
    eventStart: row.event_start as string | null,
    eventEnd: row.event_end as string | null,
    folder: row.folder as string | null,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    status: row.status as TaskStatus | null,
    priority: (row.priority as number) ?? 0,
    importance: (row.importance as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    source: row.source as string | null,
    sourceId: row.source_id as string | null,
    sourceUrl: row.source_url as string | null,
    deletedAt: row.deleted_at as string | null,
    version: (row.version as number) ?? 1,
  };
}
TYPES_NODE_EOF

cat > src/types/filter.ts << 'TYPES_FILTER_EOF'
// Filter types for LATCH

export interface LocationFilter {
  type: 'point' | 'box' | 'radius';
  latitude?: number;
  longitude?: number;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  centerLat?: number;
  centerLon?: number;
  radiusKm?: number;
}

export interface AlphabetFilter {
  type: 'startsWith' | 'range' | 'search';
  value: string;
}

export type TimePreset = 
  | 'today' | 'yesterday' | 'this-week' | 'last-week'
  | 'this-month' | 'last-month' | 'this-year'
  | 'last-7-days' | 'last-30-days' | 'last-90-days'
  | 'next-week' | 'overdue';

export interface TimeFilter {
  type: 'preset' | 'range' | 'relative';
  preset?: TimePreset;
  start?: string;
  end?: string;
  amount?: number;
  unit?: 'day' | 'week' | 'month' | 'year';
  direction?: 'past' | 'future';
  field: 'created' | 'modified' | 'due';
}

export interface CategoryFilter {
  type: 'include' | 'exclude';
  folders?: string[];
  tags?: string[];
  statuses?: string[];
  nodeTypes?: string[];
}

export interface HierarchyFilter {
  type: 'priority' | 'top-n' | 'range';
  minPriority?: number;
  maxPriority?: number;
  limit?: number;
  sortBy?: 'priority' | 'importance' | 'sortOrder';
}

export interface FilterState {
  location: LocationFilter | null;
  alphabet: AlphabetFilter | null;
  time: TimeFilter | null;
  category: CategoryFilter | null;
  hierarchy: HierarchyFilter | null;
  dsl: string | null;
}

export interface CompiledQuery {
  sql: string;
  params: (string | number | boolean | null)[];
}

export const EMPTY_FILTERS: FilterState = {
  location: null,
  alphabet: null,
  time: null,
  category: null,
  hierarchy: null,
  dsl: null,
};
TYPES_FILTER_EOF

cat > src/types/view.ts << 'TYPES_VIEW_EOF'
// View types

import type { Node } from './node';

export type ViewType = 'grid' | 'list' | 'kanban' | 'timeline' | 'calendar' | 'network' | 'tree';

export interface Dimensions {
  width: number;
  height: number;
}

export interface ViewState {
  app: string;
  view: ViewType;
  dataset: string;
}

export interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  anchorId: string | null;
}

// D3 selection type (simplified for interface definition)
export type D3Container = d3.Selection<SVGGElement, unknown, null, undefined>;

export interface ViewRenderer {
  readonly type: ViewType;
  readonly name: string;
  
  setXAxis(facetId: string | null): void;
  setYAxis(facetId: string | null): void;
  
  render(
    container: D3Container,
    nodes: Node[],
    dimensions: Dimensions
  ): void;
  
  destroy(): void;
  
  onCardClick?(node: Node, event: MouseEvent): void;
  onCardHover?(node: Node | null): void;
}
TYPES_VIEW_EOF

cat > src/types/pafv.ts << 'TYPES_PAFV_EOF'
// PAFV types

export type LATCHAxis = 'L' | 'A' | 'T' | 'C' | 'H';
export type FacetType = 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'location';

export interface Facet {
  id: string;
  name: string;
  facetType: FacetType;
  axis: LATCHAxis;
  sourceColumn: string;
  options: string[] | null;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  sortOrder: number;
}

export interface PAFVState {
  xAxis: string | null;
  yAxis: string | null;
  zAxis: string | null;
  available: string[];
}

export const DEFAULT_PAFV: PAFVState = {
  xAxis: 'folder',
  yAxis: 'modified',
  zAxis: null,
  available: ['tags', 'priority', 'created', 'name', 'location'],
};
TYPES_PAFV_EOF

# ============================================================================
# 3. Database Initialization
# ============================================================================

echo "Creating database initialization..."

cat > src/db/init.ts << 'DB_INIT_EOF'
import initSqlJs, { Database } from 'sql.js';
import SCHEMA_SQL from './schema.sql?raw';
import { SAMPLE_DATA_SQL } from './sample-data';

let db: Database | null = null;
let initPromise: Promise<Database> | null = null;

export async function initDatabase(loadSampleData = true): Promise<Database> {
  // Return existing promise if initialization in progress
  if (initPromise) return initPromise;
  
  // Return existing database if already initialized
  if (db) return db;
  
  initPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
    });
    
    // Try to load from IndexedDB first
    const savedData = await loadFromIndexedDB();
    
    if (savedData) {
      db = new SQL.Database(savedData);
      console.log('Database loaded from IndexedDB');
    } else {
      db = new SQL.Database();
      
      // Execute schema
      db.run(SCHEMA_SQL);
      console.log('Schema initialized');
      
      // Load sample data if requested
      if (loadSampleData) {
        db.run(SAMPLE_DATA_SQL);
        console.log('Sample data loaded');
      }
      
      // Save initial state
      await saveToIndexedDB(db);
    }
    
    return db;
  })();
  
  return initPromise;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

export async function saveDatabase(): Promise<void> {
  if (!db) return;
  await saveToIndexedDB(db);
}

export async function resetDatabase(): Promise<Database> {
  await clearIndexedDB();
  db = null;
  initPromise = null;
  return initDatabase(true);
}

// IndexedDB helpers
const DB_NAME = 'isometry';
const STORE_NAME = 'sqlite';
const KEY = 'database';

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => resolve(null);
    
    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(KEY);
      
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
  });
}

async function saveToIndexedDB(database: Database): Promise<void> {
  const data = database.export();
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
    
    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const tx = idb.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(data, KEY);
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function clearIndexedDB(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}
DB_INIT_EOF

cat > src/db/DatabaseContext.tsx << 'DB_CONTEXT_EOF'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Database } from 'sql.js';
import { initDatabase, saveDatabase, resetDatabase } from './init';

interface DatabaseContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => T[];
  save: () => Promise<void>;
  reset: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);
  
  const execute = useCallback(<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): T[] => {
    if (!db) throw new Error('Database not initialized');
    
    try {
      const result = db.exec(sql, params);
      if (result.length === 0) return [];
      
      const { columns, values } = result[0];
      return values.map((row) => {
        const obj: Record<string, unknown> = {};
        columns.forEach((col, i) => {
          obj[col] = row[i];
        });
        return obj as T;
      });
    } catch (err) {
      console.error('SQL Error:', sql, params, err);
      throw err;
    }
  }, [db]);
  
  const save = useCallback(async () => {
    await saveDatabase();
  }, []);
  
  const reset = useCallback(async () => {
    setLoading(true);
    try {
      const newDb = await resetDatabase();
      setDb(newDb);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  return (
    <DatabaseContext.Provider value={{ db, loading, error, execute, save, reset }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}
DB_CONTEXT_EOF

# ============================================================================
# 4. Sample Data
# ============================================================================

echo "Creating sample data..."

cat > src/db/sample-data.ts << 'SAMPLE_DATA_EOF'
// Sample data for development and testing

interface SampleNote {
  id: string;
  name: string;
  content: string;
  folder: string;
  tags: string[];
  priority: number;
  createdDaysAgo: number;
}

const SAMPLE_NOTES: SampleNote[] = [
  // Work
  { id: 'n001', name: 'Q1 Planning Meeting Notes', content: 'Discussed roadmap priorities...', folder: 'Work', tags: ['meetings', 'planning'], priority: 4, createdDaysAgo: 5 },
  { id: 'n002', name: 'Product Roadmap Draft', content: '## Product Vision\n\nBuild the best polymorphic data visualization tool.', folder: 'Work', tags: ['planning', 'draft'], priority: 5, createdDaysAgo: 12 },
  { id: 'n003', name: 'Team Standup Notes', content: 'Quick sync with the team...', folder: 'Work', tags: ['meetings'], priority: 2, createdDaysAgo: 1 },
  { id: 'n004', name: 'Performance Review Prep', content: 'Notes for upcoming review...', folder: 'Work', tags: ['important'], priority: 4, createdDaysAgo: 8 },
  { id: 'n005', name: 'Client Call - Acme Corp', content: 'Call with Acme Corp stakeholders...', folder: 'Work', tags: ['meetings', 'urgent'], priority: 5, createdDaysAgo: 2 },
  
  // Projects  
  { id: 'n006', name: 'Isometry Architecture', content: '## Core Concepts\n\nPAFV, LATCH, GRAPH...', folder: 'Projects', tags: ['reference', 'important'], priority: 5, createdDaysAgo: 20 },
  { id: 'n007', name: 'D3.js Best Practices', content: 'Key patterns for D3...', folder: 'Projects', tags: ['reference'], priority: 3, createdDaysAgo: 15 },
  { id: 'n008', name: 'SQLite Schema Design', content: 'Optimizing for LATCH...', folder: 'Projects', tags: ['reference'], priority: 4, createdDaysAgo: 10 },
  { id: 'n009', name: 'MVP Feature List', content: 'Core features for launch...', folder: 'Projects', tags: ['planning'], priority: 5, createdDaysAgo: 7 },
  { id: 'n010', name: 'Bug Fixes Needed', content: 'List of known issues...', folder: 'Projects', tags: ['bugs'], priority: 3, createdDaysAgo: 3 },
  
  // Personal
  { id: 'n011', name: 'Book List 2026', content: '## To Read\n- The Pragmatic Programmer...', folder: 'Personal', tags: ['reference'], priority: 2, createdDaysAgo: 30 },
  { id: 'n012', name: 'Morning Routine', content: '6:00 - Wake up...', folder: 'Personal', tags: ['template'], priority: 3, createdDaysAgo: 45 },
  { id: 'n013', name: 'Gift Ideas', content: 'For Mom: spa day...', folder: 'Personal', tags: ['reference'], priority: 1, createdDaysAgo: 60 },
  { id: 'n014', name: 'Workout Log', content: 'Mon: Upper body...', folder: 'Personal', tags: ['health'], priority: 2, createdDaysAgo: 4 },
  { id: 'n015', name: 'Recipe: Pasta', content: 'Ingredients: ...', folder: 'Personal', tags: ['recipes'], priority: 1, createdDaysAgo: 25 },
  
  // Ideas
  { id: 'n016', name: 'App Ideas', content: '1. AI-powered recipe finder...', folder: 'Ideas', tags: ['draft'], priority: 2, createdDaysAgo: 14 },
  { id: 'n017', name: 'Blog Post Draft', content: 'Why SQLite is Underrated...', folder: 'Ideas', tags: ['draft', 'writing'], priority: 3, createdDaysAgo: 9 },
  { id: 'n018', name: 'Side Project Concepts', content: 'Things to build someday...', folder: 'Ideas', tags: ['draft'], priority: 1, createdDaysAgo: 40 },
  
  // Research
  { id: 'n019', name: 'Competitive Analysis', content: '## Competitors\n\nNotion, Obsidian, Roam...', folder: 'Research', tags: ['reference', 'important'], priority: 4, createdDaysAgo: 22 },
  { id: 'n020', name: 'User Interview Notes', content: 'Key quotes from users...', folder: 'Research', tags: ['reference'], priority: 3, createdDaysAgo: 18 },
  
  // Meetings
  { id: 'n021', name: '1:1 with Sarah', content: 'Topics discussed...', folder: 'Meetings', tags: ['meetings'], priority: 3, createdDaysAgo: 6 },
  { id: 'n022', name: 'Board Meeting Prep', content: 'Agenda for board...', folder: 'Meetings', tags: ['meetings', 'important'], priority: 5, createdDaysAgo: 11 },
  { id: 'n023', name: 'Design Review', content: 'Feedback on mockups...', folder: 'Meetings', tags: ['meetings'], priority: 3, createdDaysAgo: 4 },
  
  // Archive
  { id: 'n024', name: 'Old Project Notes', content: 'From 2024 project...', folder: 'Archive', tags: ['archive'], priority: 0, createdDaysAgo: 90 },
  { id: 'n025', name: 'Completed Tasks', content: 'Done items from Q4...', folder: 'Archive', tags: ['archive'], priority: 0, createdDaysAgo: 75 },
];

function generateDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

// Generate more notes by varying the templates
function generateAllNotes(): SampleNote[] {
  const allNotes = [...SAMPLE_NOTES];
  
  // Add 75 more notes with variations
  for (let i = 26; i <= 100; i++) {
    const template = SAMPLE_NOTES[(i - 1) % SAMPLE_NOTES.length];
    allNotes.push({
      id: `n${String(i).padStart(3, '0')}`,
      name: `${template.name} (${Math.ceil((i - 25) / 25)})`,
      content: template.content,
      folder: template.folder,
      tags: template.tags,
      priority: Math.floor(Math.random() * 5),
      createdDaysAgo: Math.floor(Math.random() * 90) + 1,
    });
  }
  
  return allNotes;
}

const ALL_NOTES = generateAllNotes();

export const SAMPLE_DATA_SQL = ALL_NOTES.map(note => `
INSERT INTO nodes (id, node_type, name, content, folder, tags, priority, created_at, modified_at)
VALUES (
  '${note.id}',
  'note',
  '${escapeSql(note.name)}',
  '${escapeSql(note.content)}',
  '${note.folder}',
  '${JSON.stringify(note.tags)}',
  ${note.priority},
  '${generateDate(note.createdDaysAgo)}',
  '${generateDate(Math.max(0, note.createdDaysAgo - Math.floor(Math.random() * 3)))}'
);`).join('\n');

export { ALL_NOTES as SAMPLE_NOTES };
SAMPLE_DATA_EOF

# ============================================================================
# 5. View Stubs
# ============================================================================

echo "Creating view stubs..."

mkdir -p src/views

cat > src/views/types.ts << 'VIEW_TYPES_EOF'
import type { Node } from '../types/node';

export type ViewType = 'grid' | 'list' | 'kanban' | 'timeline' | 'calendar' | 'network' | 'tree';

export interface Dimensions {
  width: number;
  height: number;
}

export type D3Container = d3.Selection<SVGGElement, unknown, null, undefined>;

export interface ViewRenderer {
  readonly type: ViewType;
  readonly name: string;
  
  setXAxis(facetId: string | null): void;
  setYAxis(facetId: string | null): void;
  
  render(container: D3Container, nodes: Node[], dimensions: Dimensions): void;
  destroy(): void;
  
  onCardClick?(node: Node, event: MouseEvent): void;
  onCardHover?(node: Node | null): void;
}

export interface ViewConfig {
  xAxis: string | null;
  yAxis: string | null;
  cardSize: 'small' | 'medium' | 'large';
  showPreview: boolean;
}
VIEW_TYPES_EOF

cat > src/views/BaseView.ts << 'BASE_VIEW_EOF'
import * as d3 from 'd3';
import type { Node } from '../types/node';
import type { ViewRenderer, ViewType, Dimensions, D3Container } from './types';

export abstract class BaseView implements ViewRenderer {
  abstract readonly type: ViewType;
  abstract readonly name: string;
  
  protected xFacetId: string | null = null;
  protected yFacetId: string | null = null;
  protected container: D3Container | null = null;
  
  setXAxis(facetId: string | null): void {
    this.xFacetId = facetId;
  }
  
  setYAxis(facetId: string | null): void {
    this.yFacetId = facetId;
  }
  
  abstract render(container: D3Container, nodes: Node[], dimensions: Dimensions): void;
  
  destroy(): void {
    if (this.container) {
      this.container.selectAll('*').remove();
    }
  }
  
  protected getNodeValue(node: Node, facetId: string | null): unknown {
    if (!facetId) return null;
    
    const facetToColumn: Record<string, keyof Node> = {
      folder: 'folder',
      tags: 'tags',
      status: 'status',
      priority: 'priority',
      created: 'createdAt',
      modified: 'modifiedAt',
      due: 'dueAt',
      name: 'name',
      location: 'locationName',
    };
    
    const column = facetToColumn[facetId];
    return column ? node[column] : null;
  }
  
  protected getUniqueValues(nodes: Node[], facetId: string | null): string[] {
    if (!facetId) return [];
    
    const values = new Set<string>();
    for (const node of nodes) {
      const value = this.getNodeValue(node, facetId);
      if (value != null) {
        values.add(String(value));
      }
    }
    return Array.from(values).sort();
  }
}
BASE_VIEW_EOF

cat > src/views/GridView.ts << 'GRID_VIEW_EOF'
import * as d3 from 'd3';
import type { Node } from '../types/node';
import type { ViewType, Dimensions, D3Container } from './types';
import { BaseView } from './BaseView';

export class GridView extends BaseView {
  readonly type: ViewType = 'grid';
  readonly name = 'Grid';
  
  private xScale: d3.ScaleBand<string> | null = null;
  private yScale: d3.ScaleBand<string> | null = null;
  
  render(container: D3Container, nodes: Node[], dimensions: Dimensions): void {
    this.container = container;
    const { width, height } = dimensions;
    const padding = 20;
    const cardWidth = 150;
    const cardHeight = 100;
    
    // Get unique values for axes
    const xValues = this.getUniqueValues(nodes, this.xFacetId);
    const yValues = this.getUniqueValues(nodes, this.yFacetId);
    
    // Create scales
    this.xScale = d3.scaleBand<string>()
      .domain(xValues.length ? xValues : ['default'])
      .range([padding, width - padding])
      .padding(0.1);
    
    this.yScale = d3.scaleBand<string>()
      .domain(yValues.length ? yValues : ['default'])
      .range([padding, height - padding])
      .padding(0.1);
    
    // Bind data
    const cards = container
      .selectAll<SVGGElement, Node>('.card')
      .data(nodes, (d) => d.id);
    
    // Enter
    const cardsEnter = cards.enter()
      .append('g')
      .attr('class', 'card')
      .attr('transform', (d) => {
        const x = this.getCardX(d);
        const y = this.getCardY(d);
        return `translate(${x}, ${y})`;
      });
    
    cardsEnter.append('rect')
      .attr('width', cardWidth)
      .attr('height', cardHeight)
      .attr('rx', 4)
      .attr('fill', 'var(--card-bg, white)')
      .attr('stroke', 'var(--card-border, #ccc)')
      .attr('stroke-width', 1);
    
    cardsEnter.append('text')
      .attr('x', 8)
      .attr('y', 20)
      .attr('class', 'card-title')
      .text((d) => d.name)
      .attr('font-size', '12px')
      .attr('fill', 'var(--text-primary, black)');
    
    // Update
    cards.merge(cardsEnter)
      .transition()
      .duration(300)
      .attr('transform', (d) => {
        const x = this.getCardX(d);
        const y = this.getCardY(d);
        return `translate(${x}, ${y})`;
      });
    
    // Exit
    cards.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();
  }
  
  private getCardX(node: Node): number {
    if (!this.xScale) return 0;
    const value = String(this.getNodeValue(node, this.xFacetId) ?? 'default');
    return this.xScale(value) ?? 0;
  }
  
  private getCardY(node: Node): number {
    if (!this.yScale) return 0;
    const value = String(this.getNodeValue(node, this.yFacetId) ?? 'default');
    return this.yScale(value) ?? 0;
  }
}
GRID_VIEW_EOF

cat > src/views/ListView.ts << 'LIST_VIEW_EOF'
import * as d3 from 'd3';
import type { Node } from '../types/node';
import type { ViewType, Dimensions, D3Container } from './types';
import { BaseView } from './BaseView';

export class ListView extends BaseView {
  readonly type: ViewType = 'list';
  readonly name = 'List';
  
  render(container: D3Container, nodes: Node[], dimensions: Dimensions): void {
    this.container = container;
    const { width } = dimensions;
    const padding = 20;
    const rowHeight = 48;
    
    // Sort by Y axis if set
    const sortedNodes = [...nodes];
    if (this.yFacetId) {
      sortedNodes.sort((a, b) => {
        const aVal = String(this.getNodeValue(a, this.yFacetId) ?? '');
        const bVal = String(this.getNodeValue(b, this.yFacetId) ?? '');
        return aVal.localeCompare(bVal);
      });
    }
    
    // Bind data
    const rows = container
      .selectAll<SVGGElement, Node>('.list-row')
      .data(sortedNodes, (d) => d.id);
    
    // Enter
    const rowsEnter = rows.enter()
      .append('g')
      .attr('class', 'list-row')
      .attr('transform', (_, i) => `translate(${padding}, ${padding + i * rowHeight})`);
    
    rowsEnter.append('rect')
      .attr('width', width - padding * 2)
      .attr('height', rowHeight - 4)
      .attr('rx', 4)
      .attr('fill', 'var(--card-bg, white)')
      .attr('stroke', 'var(--card-border, #ccc)')
      .attr('stroke-width', 1);
    
    rowsEnter.append('text')
      .attr('x', 12)
      .attr('y', 28)
      .attr('class', 'row-title')
      .text((d) => d.name)
      .attr('font-size', '14px')
      .attr('fill', 'var(--text-primary, black)');
    
    rowsEnter.append('text')
      .attr('x', width - padding * 2 - 12)
      .attr('y', 28)
      .attr('text-anchor', 'end')
      .attr('class', 'row-meta')
      .text((d) => d.folder ?? '')
      .attr('font-size', '12px')
      .attr('fill', 'var(--text-secondary, #666)');
    
    // Update positions
    rows.merge(rowsEnter)
      .transition()
      .duration(300)
      .attr('transform', (_, i) => `translate(${padding}, ${padding + i * rowHeight})`);
    
    // Exit
    rows.exit()
      .transition()
      .duration(200)
      .style('opacity', 0)
      .remove();
  }
}
LIST_VIEW_EOF

cat > src/views/index.ts << 'VIEWS_INDEX_EOF'
import type { ViewRenderer, ViewType } from './types';
import { GridView } from './GridView';
import { ListView } from './ListView';

export * from './types';
export { BaseView } from './BaseView';
export { GridView } from './GridView';
export { ListView } from './ListView';

const viewRegistry: Record<ViewType, () => ViewRenderer> = {
  grid: () => new GridView(),
  list: () => new ListView(),
  kanban: () => new GridView(),    // TODO: Implement
  timeline: () => new ListView(),  // TODO: Implement
  calendar: () => new GridView(),  // TODO: Implement
  network: () => new GridView(),   // TODO: Implement
  tree: () => new ListView(),      // TODO: Implement
};

export function createView(type: ViewType): ViewRenderer {
  const factory = viewRegistry[type];
  if (!factory) {
    console.warn(`Unknown view type: ${type}, falling back to grid`);
    return new GridView();
  }
  return factory();
}
VIEWS_INDEX_EOF

# ============================================================================
# 6. Filter System
# ============================================================================

echo "Creating filter system..."

mkdir -p src/filters

cat > src/filters/compiler.ts << 'FILTER_COMPILER_EOF'
import type { FilterState, CompiledQuery, TimeFilter, CategoryFilter, HierarchyFilter, TimePreset } from '../types/filter';

export function compileFilters(filters: FilterState): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | boolean | null)[] = [];
  
  // Always exclude deleted
  conditions.push('deleted_at IS NULL');
  
  // Category filter
  if (filters.category) {
    const categorySQL = compileCategoryFilter(filters.category);
    if (categorySQL.sql) {
      conditions.push(categorySQL.sql);
      params.push(...categorySQL.params);
    }
  }
  
  // Time filter
  if (filters.time) {
    const timeSQL = compileTimeFilter(filters.time);
    if (timeSQL.sql) {
      conditions.push(timeSQL.sql);
      params.push(...timeSQL.params);
    }
  }
  
  // Hierarchy filter
  if (filters.hierarchy) {
    const hierarchySQL = compileHierarchyFilter(filters.hierarchy);
    if (hierarchySQL.sql) {
      conditions.push(hierarchySQL.sql);
      params.push(...hierarchySQL.params);
    }
  }
  
  return {
    sql: conditions.join(' AND '),
    params,
  };
}

function compileCategoryFilter(filter: CategoryFilter): CompiledQuery {
  const conditions: string[] = [];
  const params: (string | number | null)[] = [];
  
  if (filter.folders?.length) {
    const placeholders = filter.folders.map(() => '?').join(', ');
    const op = filter.type === 'include' ? 'IN' : 'NOT IN';
    conditions.push(`folder ${op} (${placeholders})`);
    params.push(...filter.folders);
  }
  
  if (filter.nodeTypes?.length) {
    const placeholders = filter.nodeTypes.map(() => '?').join(', ');
    conditions.push(`node_type IN (${placeholders})`);
    params.push(...filter.nodeTypes);
  }
  
  return {
    sql: conditions.join(' AND '),
    params,
  };
}

function compileTimeFilter(filter: TimeFilter): CompiledQuery {
  const column = filter.field === 'created' ? 'created_at'
    : filter.field === 'modified' ? 'modified_at'
    : 'due_at';
  
  if (filter.type === 'preset' && filter.preset) {
    const sql = getPresetSQL(filter.preset, column);
    return { sql, params: [] };
  }
  
  if (filter.type === 'range') {
    const conditions: string[] = [];
    const params: string[] = [];
    
    if (filter.start) {
      conditions.push(`${column} >= ?`);
      params.push(filter.start);
    }
    if (filter.end) {
      conditions.push(`${column} <= ?`);
      params.push(filter.end);
    }
    
    return { sql: conditions.join(' AND '), params };
  }
  
  return { sql: '', params: [] };
}

function getPresetSQL(preset: TimePreset, column: string): string {
  switch (preset) {
    case 'today':
      return `date(${column}) = date('now')`;
    case 'yesterday':
      return `date(${column}) = date('now', '-1 day')`;
    case 'this-week':
      return `${column} >= date('now', 'weekday 0', '-7 days')`;
    case 'last-week':
      return `${column} >= date('now', 'weekday 0', '-14 days') AND ${column} < date('now', 'weekday 0', '-7 days')`;
    case 'last-7-days':
      return `${column} >= datetime('now', '-7 days')`;
    case 'last-30-days':
      return `${column} >= datetime('now', '-30 days')`;
    case 'last-90-days':
      return `${column} >= datetime('now', '-90 days')`;
    case 'this-month':
      return `strftime('%Y-%m', ${column}) = strftime('%Y-%m', 'now')`;
    case 'last-month':
      return `strftime('%Y-%m', ${column}) = strftime('%Y-%m', 'now', '-1 month')`;
    case 'this-year':
      return `strftime('%Y', ${column}) = strftime('%Y', 'now')`;
    case 'overdue':
      return `${column} < datetime('now') AND completed_at IS NULL`;
    default:
      return '1=1';
  }
}

function compileHierarchyFilter(filter: HierarchyFilter): CompiledQuery {
  if (filter.type === 'priority' || filter.type === 'range') {
    const conditions: string[] = [];
    const params: number[] = [];
    
    if (filter.minPriority != null) {
      conditions.push('priority >= ?');
      params.push(filter.minPriority);
    }
    if (filter.maxPriority != null) {
      conditions.push('priority <= ?');
      params.push(filter.maxPriority);
    }
    
    return { sql: conditions.join(' AND '), params };
  }
  
  return { sql: '', params: [] };
}
FILTER_COMPILER_EOF

cat > src/filters/index.ts << 'FILTERS_INDEX_EOF'
export * from './compiler';
export * from '../types/filter';
FILTERS_INDEX_EOF

# ============================================================================
# 7. Hooks
# ============================================================================

echo "Creating hooks..."

cat > src/hooks/useSQLiteQuery.ts << 'USE_SQLITE_QUERY_EOF'
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDatabase } from '../db/DatabaseContext';
import { rowToNode, Node } from '../types/node';

interface QueryState<T> {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

interface QueryOptions<T> {
  enabled?: boolean;
  transform?: (rows: Record<string, unknown>[]) => T[];
}

export function useSQLiteQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  options: QueryOptions<T> = {}
): QueryState<T> {
  const { execute, loading: dbLoading, error: dbError } = useDatabase();
  const { enabled = true, transform } = options;
  
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track params for comparison
  const paramsRef = useRef(params);
  const sqlRef = useRef(sql);
  
  const fetchData = useCallback(() => {
    if (!enabled || dbLoading) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const rows = execute<Record<string, unknown>>(sql, params);
      const result = transform ? transform(rows) : (rows as unknown as T[]);
      setData(result);
    } catch (err) {
      setError(err as Error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [execute, sql, JSON.stringify(params), enabled, dbLoading, transform]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    data,
    loading: loading || dbLoading,
    error: error || dbError,
    refetch: fetchData,
  };
}

// Convenience hook for node queries
export function useNodes(
  whereClause: string = '1=1',
  params: unknown[] = [],
  options: Omit<QueryOptions<Node>, 'transform'> = {}
): QueryState<Node> {
  const sql = `
    SELECT * FROM nodes 
    WHERE ${whereClause} AND deleted_at IS NULL
    ORDER BY modified_at DESC
  `;
  
  return useSQLiteQuery<Node>(sql, params, {
    ...options,
    transform: (rows) => rows.map(rowToNode),
  });
}
USE_SQLITE_QUERY_EOF

cat > src/hooks/useD3.ts << 'USE_D3_EOF'
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';

type D3Selection<T extends SVGElement> = d3.Selection<T, unknown, null, undefined>;

export function useD3<T extends SVGElement = SVGSVGElement>(
  renderFn: (selection: D3Selection<T>) => void | (() => void),
  deps: unknown[] = []
): React.RefObject<T> {
  const ref = useRef<T>(null);
  
  useEffect(() => {
    if (!ref.current) return;
    
    const selection = d3.select(ref.current);
    const cleanup = renderFn(selection as D3Selection<T>);
    
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, deps);
  
  return ref;
}

// Hook for managing resize observations
export function useResizeObserver(
  ref: React.RefObject<Element>,
  callback: (entry: ResizeObserverEntry) => void
): void {
  useEffect(() => {
    if (!ref.current) return;
    
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        callback(entries[0]);
      }
    });
    
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, callback]);
}
USE_D3_EOF

cat > src/hooks/index.ts << 'HOOKS_INDEX_EOF'
export { useSQLiteQuery, useNodes } from './useSQLiteQuery';
export { useD3, useResizeObserver } from './useD3';
HOOKS_INDEX_EOF

# ============================================================================
# 8. State Contexts
# ============================================================================

echo "Creating state contexts..."

mkdir -p src/state

cat > src/state/FilterContext.tsx << 'FILTER_CONTEXT_EOF'
import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { 
  FilterState, 
  LocationFilter, 
  AlphabetFilter, 
  TimeFilter, 
  CategoryFilter, 
  HierarchyFilter 
} from '../types/filter';
import { EMPTY_FILTERS } from '../types/filter';

type FilterAction =
  | { type: 'SET_LOCATION'; payload: LocationFilter | null }
  | { type: 'SET_ALPHABET'; payload: AlphabetFilter | null }
  | { type: 'SET_TIME'; payload: TimeFilter | null }
  | { type: 'SET_CATEGORY'; payload: CategoryFilter | null }
  | { type: 'SET_HIERARCHY'; payload: HierarchyFilter | null }
  | { type: 'SET_DSL'; payload: string | null }
  | { type: 'CLEAR_ALL' };

function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'SET_LOCATION':
      return { ...state, location: action.payload, dsl: null };
    case 'SET_ALPHABET':
      return { ...state, alphabet: action.payload, dsl: null };
    case 'SET_TIME':
      return { ...state, time: action.payload, dsl: null };
    case 'SET_CATEGORY':
      return { ...state, category: action.payload, dsl: null };
    case 'SET_HIERARCHY':
      return { ...state, hierarchy: action.payload, dsl: null };
    case 'SET_DSL':
      return { ...EMPTY_FILTERS, dsl: action.payload };
    case 'CLEAR_ALL':
      return EMPTY_FILTERS;
    default:
      return state;
  }
}

interface FilterContextValue {
  filters: FilterState;
  setLocation: (filter: LocationFilter | null) => void;
  setAlphabet: (filter: AlphabetFilter | null) => void;
  setTime: (filter: TimeFilter | null) => void;
  setCategory: (filter: CategoryFilter | null) => void;
  setHierarchy: (filter: HierarchyFilter | null) => void;
  setDSL: (dsl: string | null) => void;
  clearAll: () => void;
  activeCount: number;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [filters, dispatch] = useReducer(filterReducer, EMPTY_FILTERS);
  
  const setLocation = useCallback((filter: LocationFilter | null) => {
    dispatch({ type: 'SET_LOCATION', payload: filter });
  }, []);
  
  const setAlphabet = useCallback((filter: AlphabetFilter | null) => {
    dispatch({ type: 'SET_ALPHABET', payload: filter });
  }, []);
  
  const setTime = useCallback((filter: TimeFilter | null) => {
    dispatch({ type: 'SET_TIME', payload: filter });
  }, []);
  
  const setCategory = useCallback((filter: CategoryFilter | null) => {
    dispatch({ type: 'SET_CATEGORY', payload: filter });
  }, []);
  
  const setHierarchy = useCallback((filter: HierarchyFilter | null) => {
    dispatch({ type: 'SET_HIERARCHY', payload: filter });
  }, []);
  
  const setDSL = useCallback((dsl: string | null) => {
    dispatch({ type: 'SET_DSL', payload: dsl });
  }, []);
  
  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);
  
  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.location) count++;
    if (filters.alphabet) count++;
    if (filters.time) count++;
    if (filters.category) count++;
    if (filters.hierarchy) count++;
    if (filters.dsl) count++;
    return count;
  }, [filters]);
  
  return (
    <FilterContext.Provider value={{
      filters,
      setLocation,
      setAlphabet,
      setTime,
      setCategory,
      setHierarchy,
      setDSL,
      clearAll,
      activeCount,
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters(): FilterContextValue {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
}
FILTER_CONTEXT_EOF

cat > src/state/PAFVContext.tsx << 'PAFV_CONTEXT_EOF'
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { PAFVState, Facet } from '../types/pafv';
import { DEFAULT_PAFV } from '../types/pafv';

type PAFVAction =
  | { type: 'SET_X_AXIS'; payload: string | null }
  | { type: 'SET_Y_AXIS'; payload: string | null }
  | { type: 'SET_Z_AXIS'; payload: string | null }
  | { type: 'MOVE_TO_AVAILABLE'; payload: string }
  | { type: 'RESET' };

function pafvReducer(state: PAFVState, action: PAFVAction): PAFVState {
  switch (action.type) {
    case 'SET_X_AXIS': {
      const oldX = state.xAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldX) newAvailable.push(oldX);
      return { ...state, xAxis: action.payload, available: newAvailable };
    }
    case 'SET_Y_AXIS': {
      const oldY = state.yAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldY) newAvailable.push(oldY);
      return { ...state, yAxis: action.payload, available: newAvailable };
    }
    case 'SET_Z_AXIS': {
      const oldZ = state.zAxis;
      const newAvailable = state.available.filter(id => id !== action.payload);
      if (oldZ) newAvailable.push(oldZ);
      return { ...state, zAxis: action.payload, available: newAvailable };
    }
    case 'MOVE_TO_AVAILABLE': {
      const facetId = action.payload;
      return {
        ...state,
        xAxis: state.xAxis === facetId ? null : state.xAxis,
        yAxis: state.yAxis === facetId ? null : state.yAxis,
        zAxis: state.zAxis === facetId ? null : state.zAxis,
        available: state.available.includes(facetId) 
          ? state.available 
          : [...state.available, facetId],
      };
    }
    case 'RESET':
      return DEFAULT_PAFV;
    default:
      return state;
  }
}

interface PAFVContextValue {
  pafv: PAFVState;
  setXAxis: (facetId: string | null) => void;
  setYAxis: (facetId: string | null) => void;
  setZAxis: (facetId: string | null) => void;
  moveToAvailable: (facetId: string) => void;
  reset: () => void;
}

const PAFVContext = createContext<PAFVContextValue | null>(null);

export function PAFVProvider({ children }: { children: React.ReactNode }) {
  const [pafv, dispatch] = useReducer(pafvReducer, DEFAULT_PAFV);
  
  const setXAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_X_AXIS', payload: facetId });
  }, []);
  
  const setYAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_Y_AXIS', payload: facetId });
  }, []);
  
  const setZAxis = useCallback((facetId: string | null) => {
    dispatch({ type: 'SET_Z_AXIS', payload: facetId });
  }, []);
  
  const moveToAvailable = useCallback((facetId: string) => {
    dispatch({ type: 'MOVE_TO_AVAILABLE', payload: facetId });
  }, []);
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);
  
  return (
    <PAFVContext.Provider value={{ pafv, setXAxis, setYAxis, setZAxis, moveToAvailable, reset }}>
      {children}
    </PAFVContext.Provider>
  );
}

export function usePAFV(): PAFVContextValue {
  const context = useContext(PAFVContext);
  if (!context) {
    throw new Error('usePAFV must be used within PAFVProvider');
  }
  return context;
}
PAFV_CONTEXT_EOF

cat > src/state/SelectionContext.tsx << 'SELECTION_CONTEXT_EOF'
import React, { createContext, useContext, useState, useCallback } from 'react';

interface SelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
}

interface SelectionContextValue {
  selection: SelectionState;
  select: (id: string) => void;
  deselect: (id: string) => void;
  toggle: (id: string) => void;
  selectMultiple: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>({
    selectedIds: new Set(),
    lastSelectedId: null,
  });
  
  const select = useCallback((id: string) => {
    setSelection(prev => ({
      selectedIds: new Set([id]),
      lastSelectedId: id,
    }));
  }, []);
  
  const deselect = useCallback((id: string) => {
    setSelection(prev => {
      const newIds = new Set(prev.selectedIds);
      newIds.delete(id);
      return { ...prev, selectedIds: newIds };
    });
  }, []);
  
  const toggle = useCallback((id: string) => {
    setSelection(prev => {
      const newIds = new Set(prev.selectedIds);
      if (newIds.has(id)) {
        newIds.delete(id);
      } else {
        newIds.add(id);
      }
      return { selectedIds: newIds, lastSelectedId: id };
    });
  }, []);
  
  const selectMultiple = useCallback((ids: string[]) => {
    setSelection({
      selectedIds: new Set(ids),
      lastSelectedId: ids[ids.length - 1] ?? null,
    });
  }, []);
  
  const clear = useCallback(() => {
    setSelection({ selectedIds: new Set(), lastSelectedId: null });
  }, []);
  
  const isSelected = useCallback((id: string) => {
    return selection.selectedIds.has(id);
  }, [selection.selectedIds]);
  
  return (
    <SelectionContext.Provider value={{
      selection,
      select,
      deselect,
      toggle,
      selectMultiple,
      clear,
      isSelected,
    }}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection(): SelectionContextValue {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within SelectionProvider');
  }
  return context;
}
SELECTION_CONTEXT_EOF

cat > src/state/index.ts << 'STATE_INDEX_EOF'
export { FilterProvider, useFilters } from './FilterContext';
export { PAFVProvider, usePAFV } from './PAFVContext';
export { SelectionProvider, useSelection } from './SelectionContext';
STATE_INDEX_EOF

# ============================================================================
# 9. Update App.tsx with providers
# ============================================================================

echo "Updating App.tsx with providers..."

cat > src/App.tsx << 'APP_EOF'
import { useTheme, ThemeProvider } from './contexts/ThemeContext';
import { DatabaseProvider } from './db/DatabaseContext';
import { FilterProvider } from './state/FilterContext';
import { PAFVProvider } from './state/PAFVContext';
import { SelectionProvider } from './state/SelectionContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// Import Figma components (when ready)
// import { Toolbar } from './components/Toolbar';
// import { Navigator } from './components/Navigator';
// import { Sidebar } from './components/Sidebar';
// import { Canvas } from './components/Canvas';

function AppContent() {
  const { theme } = useTheme();
  
  return (
    <div className={`app ${theme === 'NeXTSTEP' ? 'theme-nextstep' : 'theme-modern'}`}>
      <header className="app-header">
        {/* <Toolbar /> */}
        <h1 className="text-xl font-bold p-4">Isometry</h1>
      </header>
      
      <main className="app-main">
        {/* <Navigator /> */}
        {/* <Sidebar /> */}
        {/* <Canvas /> */}
        <div className="p-8 text-center">
          <p className="text-lg mb-4">🎉 Isometry is ready for development!</p>
          <p className="text-sm text-gray-600">
            Database, types, views, filters, and state management are all set up.
          </p>
          <p className="text-sm text-gray-600 mt-2">
            Start Claude Code and run: <code className="bg-gray-100 px-2 py-1 rounded">npm run dev</code>
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DatabaseProvider>
          <FilterProvider>
            <PAFVProvider>
              <SelectionProvider>
                <AppContent />
              </SelectionProvider>
            </PAFVProvider>
          </FilterProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
APP_EOF

# ============================================================================
# 10. Add Integration Contract
# ============================================================================

echo "Adding integration contract..."

cat > docs/INTEGRATION-CONTRACT.md << 'CONTRACT_EOF'
# Isometry Integration Contract

*How the pieces fit together*

## Provider Hierarchy

```tsx
<ThemeProvider>              {/* UI theme */}
  <DatabaseProvider>         {/* sql.js instance */}
    <FilterProvider>         {/* LATCH filter state */}
      <PAFVProvider>         {/* Axis assignments */}
        <SelectionProvider>  {/* Card selection */}
          <Layout />
        </SelectionProvider>
      </PAFVProvider>
    </FilterProvider>
  </DatabaseProvider>
</ThemeProvider>
```

## Data Flow

1. User changes filter → FilterContext updates
2. Components using useFilters() re-render
3. compileFilters() generates SQL WHERE clause
4. useSQLiteQuery() executes query
5. D3 view renders new data

## Key Hooks

- `useDatabase()` - Raw SQL execution
- `useSQLiteQuery(sql, params)` - Query with caching
- `useNodes(where, params)` - Convenience for node queries
- `useFilters()` - Filter state and setters
- `usePAFV()` - PAFV axis assignments
- `useSelection()` - Card selection state
- `useD3(renderFn, deps)` - D3 container management

## File Locations

- Types: `src/types/`
- Database: `src/db/`
- Hooks: `src/hooks/`
- State: `src/state/`
- Views: `src/views/`
- Filters: `src/filters/`
- Components: `src/components/`
CONTRACT_EOF

# ============================================================================
# 11. Update package.json with sql.js
# ============================================================================

echo "Updating package.json..."

cat > package.json << 'PACKAGE_EOF'
{
  "name": "isometry",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "d3": "^7.8.5",
    "lucide-react": "^0.294.0",
    "react": "^18.2.0",
    "react-dnd": "^16.0.1",
    "react-dnd-html5-backend": "^16.0.1",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "sql.js": "^1.9.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.3",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.2.2",
    "vite": "^5.0.0"
  }
}
PACKAGE_EOF

# ============================================================================
# 12. Update vite config for raw SQL imports
# ============================================================================

echo "Updating vite config..."

cat > vite.config.ts << 'VITE_EOF'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  assetsInclude: ['**/*.sql'],
});
VITE_EOF

# ============================================================================
# 13. Update CLAUDE.md
# ============================================================================

echo "Updating CLAUDE.md..."

cat > CLAUDE.md << 'CLAUDE_EOF'
# Isometry - Claude Code Context

## Quick Start
```bash
npm install
npm run dev
```

## Architecture
- **PAFV**: Planes → Axes → Facets → Values (spatial projection)
- **LATCH**: Location, Alphabet, Time, Category, Hierarchy (filtering)
- **GRAPH**: Links, Nesting, Sequence (connections)

## Tech Stack
- React 18 + TypeScript
- D3.js for visualization
- sql.js (SQLite in browser)
- Tailwind CSS
- Vite

## Key Files
- `src/types/` - All TypeScript interfaces
- `src/db/` - SQLite schema, init, context
- `src/hooks/` - useSQLiteQuery, useD3, etc.
- `src/state/` - FilterContext, PAFVContext, SelectionContext
- `src/views/` - GridView, ListView, ViewRenderer interface
- `src/filters/` - Filter compiler (LATCH → SQL)
- `docs/` - Architecture docs, gap analysis

## Current Phase
Phase 1: Data Pipeline (MVP)
- [x] SQLite schema
- [x] Type definitions
- [x] Database initialization
- [x] Sample data
- [x] Provider hierarchy
- [ ] Canvas D3 rendering
- [ ] View switching

## Important Docs
1. `docs/cardboard-architecture-truth.md` - Core concepts
2. `docs/ISOMETRY-MVP-GAP-ANALYSIS.md` - Full roadmap
3. `docs/INTEGRATION-CONTRACT.md` - How pieces connect
4. `design/isometry-ui-handoff/FIGMA-HANDOFF.md` - UI integration

## Coding Patterns
- Use `useSQLiteQuery` for data fetching
- Use `useD3` for D3 container management
- Use contexts for shared state
- Views implement `ViewRenderer` interface
- Filter changes trigger query recompilation

## Theme System
Two themes: NeXTSTEP (retro) and Modern (glass)
Toggle via ThemeContext, CSS variables in index.css
CLAUDE_EOF

# ============================================================================
# Done!
# ============================================================================

echo ""
echo "============================================================================"
echo "  Claude Code Handoff Complete!"
echo "============================================================================"
echo ""
echo "Created/Updated:"
echo "  ✅ src/db/schema.sql        - SQLite schema"
echo "  ✅ src/db/init.ts           - Database initialization"
echo "  ✅ src/db/DatabaseContext   - React context"
echo "  ✅ src/db/sample-data.ts    - 100 sample notes"
echo "  ✅ src/types/               - All TypeScript types"
echo "  ✅ src/views/               - View renderer stubs"
echo "  ✅ src/filters/             - Filter compiler"
echo "  ✅ src/hooks/               - Query and D3 hooks"
echo "  ✅ src/state/               - Filter, PAFV, Selection contexts"
echo "  ✅ src/App.tsx              - Updated with providers"
echo "  ✅ docs/INTEGRATION-CONTRACT.md"
echo "  ✅ CLAUDE.md                - Updated context"
echo "  ✅ package.json             - Added sql.js"
echo "  ✅ vite.config.ts           - SQL import support"
echo ""
echo "Next steps:"
echo "  1. cd $PROJECT_DIR"
echo "  2. npm install"
echo "  3. npm run dev"
echo "  4. Start Claude Code: claude"
echo ""
echo "First Claude Code prompt:"
echo '  "Read CLAUDE.md. Wire up Canvas.tsx to render nodes from'
echo '   useSQLiteQuery using GridView. Show sample data."'
echo ""
