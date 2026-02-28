# Isometry v5 Worker Bridge Specification

> **Canonical Reference:** This spec implements the WorkerBridge protocol defined in [Contracts.md](./Contracts.md#4-workerbridge-protocol).

## Overview

The Worker Bridge is the communication layer between the main thread (D3.js rendering, user interaction) and the Web Worker (sql.js query execution, heavy computation). It eliminates Swift MessageBridge overhead by keeping everything in JavaScript.

**Design Principle:** The bridge is thin and typed. All complexity lives in sql.js (queries) or D3.js (rendering), not in the communication layer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Main Thread                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  D3.js       │  │  Providers   │  │  Event       │  │  WorkerBridge    │ │
│  │  Renderers   │  │  (state)     │  │  Handlers    │  │  (proxy)         │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┬─────────┘ │
│                                                                  │          │
│                                                                  ▼          │
│                    ┌───────────────────────────────────────────────┐        │
│                    │         postMessage / onmessage               │        │
│                    │         (structured clone transfer)           │        │
│                    └───────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
┌──────────────────────────────────────────────────────────────────┼──────────┐
│                              Web Worker                          │          │
│                                                                  ▼          │
│                    ┌───────────────────────────────────────────────┐        │
│                    │              Message Router                   │        │
│                    └───────────────────────────────────────────────┘        │
│                          │              │              │                    │
│                          ▼              ▼              ▼                    │
│                   ┌──────────┐   ┌──────────┐   ┌──────────┐               │
│                   │  sql.js  │   │  Graph   │   │   ETL    │               │
│                   │ Database │   │  Algos   │   │ Pipeline │               │
│                   └──────────┘   └──────────┘   └──────────┘               │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Message Protocol

All messages follow a typed envelope structure:

```typescript
// Main → Worker
interface WorkerRequest {
  id: string;              // UUID for request/response correlation
  type: MessageType;
  payload: unknown;
  timestamp: number;
}

// Worker → Main
interface WorkerResponse {
  id: string;              // Matches request.id
  status: 'success' | 'error';
  payload: unknown;
  duration: number;        // Execution time in ms
  timestamp: number;
}

// Supported message types
type MessageType =
  // Database
  | 'db:init'
  | 'db:exec'
  | 'db:query'
  | 'db:transaction'
  | 'db:export'
  | 'db:import'
  // Graph
  | 'graph:shortestPath'
  | 'graph:pageRank'
  | 'graph:louvain'
  | 'graph:centrality'
  // ETL
  | 'etl:import'
  | 'etl:export';
```

---

## Main Thread: WorkerBridge Class

```typescript
// src/bridge/WorkerBridge.ts

export class WorkerBridge {
  private worker: Worker;
  private pending: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    startTime: number;
  }>;
  private messageId = 0;
  
  constructor() {
    this.worker = new Worker(
      new URL('../worker/main.worker.ts', import.meta.url),
      { type: 'module' }
    );
    this.pending = new Map();
    
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handleResponse(event.data);
    };
    
    this.worker.onerror = (error) => {
      console.error('Worker error:', error);
      this.pending.forEach(({ reject }) => reject(new Error('Worker crashed')));
      this.pending.clear();
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // DATABASE API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Initialize database. Call once on app start.
   * @param data - Optional ArrayBuffer of existing database file
   */
  async init(data?: ArrayBuffer): Promise<void> {
    return this.send('db:init', { data });
  }
  
  /**
   * Execute SQL that modifies data (INSERT, UPDATE, DELETE).
   * Returns number of rows affected.
   */
  async exec(sql: string, params?: unknown[]): Promise<{ changes: number }> {
    return this.send('db:exec', { sql, params });
  }
  
  /**
   * Execute SELECT query and return typed results.
   */
  async query<T = Record<string, unknown>>(
    sql: string, 
    params?: unknown[]
  ): Promise<T[]> {
    return this.send('db:query', { sql, params });
  }
  
  /**
   * Execute multiple statements atomically.
   * Rolls back all on any failure.
   */
  async transaction(
    operations: Array<{ sql: string; params?: unknown[] }>
  ): Promise<{ success: boolean; operations: number }> {
    return this.send('db:transaction', { operations });
  }
  
  /**
   * Export database as ArrayBuffer for file save or CloudKit sync.
   */
  async exportDatabase(): Promise<ArrayBuffer> {
    return this.send('db:export', {});
  }
  
  /**
   * Import database from ArrayBuffer, replacing current.
   */
  async importDatabase(data: ArrayBuffer): Promise<void> {
    return this.send('db:import', { data });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GRAPH API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Find shortest path between two cards using BFS.
   */
  async shortestPath(
    sourceId: string, 
    targetId: string, 
    maxDepth?: number
  ): Promise<string[] | null> {
    return this.send('graph:shortestPath', { sourceId, targetId, maxDepth });
  }
  
  /**
   * Compute PageRank for all cards.
   * Returns map of cardId → rank score.
   */
  async pageRank(options?: { 
    damping?: number; 
    iterations?: number 
  }): Promise<Record<string, number>> {
    return this.send('graph:pageRank', options ?? {});
  }
  
  /**
   * Detect communities using Louvain algorithm.
   * Returns map of cardId → communityId.
   */
  async louvainCommunities(): Promise<Record<string, string>> {
    return this.send('graph:louvain', {});
  }
  
  /**
   * Compute centrality scores.
   */
  async centrality(
    type: 'degree' | 'betweenness' | 'closeness'
  ): Promise<Record<string, number>> {
    return this.send('graph:centrality', { type });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // ETL API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Import file into database.
   */
  async importFile(
    data: ArrayBuffer | string,
    source: 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json',
    options?: Record<string, unknown>
  ): Promise<{
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
  }> {
    return this.send('etl:import', { data, source, options });
  }
  
  /**
   * Export cards to file format.
   */
  async exportFile(
    format: 'markdown' | 'json' | 'csv',
    cardIds?: string[]
  ): Promise<ArrayBuffer | string> {
    return this.send('etl:export', { format, cardIds });
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // INTERNAL
  // ═══════════════════════════════════════════════════════════════════════
  
  private send<T>(type: MessageType, payload: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `${++this.messageId}-${Date.now()}`;
      
      this.pending.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        startTime: performance.now()
      });
      
      this.worker.postMessage({ id, type, payload, timestamp: Date.now() });
    });
  }
  
  private handleResponse(response: WorkerResponse): void {
    const handler = this.pending.get(response.id);
    if (!handler) {
      console.warn('Response for unknown request:', response.id);
      return;
    }
    
    this.pending.delete(response.id);
    
    // Log slow queries
    const roundTrip = performance.now() - handler.startTime;
    if (roundTrip > 100) {
      console.debug(`Slow worker response: ${roundTrip.toFixed(1)}ms`);
    }
    
    if (response.status === 'success') {
      handler.resolve(response.payload);
    } else {
      handler.reject(new Error(String(response.payload)));
    }
  }
  
  /**
   * Terminate worker. Call on app shutdown.
   */
  terminate(): void {
    this.worker.terminate();
    this.pending.forEach(({ reject }) => reject(new Error('Worker terminated')));
    this.pending.clear();
  }
}

// Singleton export
export const workerBridge = new WorkerBridge();
```

---

## Web Worker: Message Router

```typescript
// src/worker/main.worker.ts

import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;

const sqlPromise = initSqlJs({
  locateFile: (file) => `https://sql.js.org/dist/${file}`
});

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;
  const startTime = performance.now();
  
  try {
    if (type !== 'db:init' && !db) {
      throw new Error('Database not initialized');
    }
    
    let result: unknown;
    
    switch (type) {
      // Database operations
      case 'db:init':
        result = await handleInit(payload);
        break;
      case 'db:exec':
        result = handleExec(payload);
        break;
      case 'db:query':
        result = handleQuery(payload);
        break;
      case 'db:transaction':
        result = handleTransaction(payload);
        break;
      case 'db:export':
        result = handleExport();
        break;
      case 'db:import':
        result = await handleImport(payload);
        break;
        
      // Graph operations
      case 'graph:shortestPath':
        result = handleShortestPath(payload);
        break;
      case 'graph:pageRank':
        result = handlePageRank(payload);
        break;
      case 'graph:louvain':
        result = handleLouvain();
        break;
      case 'graph:centrality':
        result = handleCentrality(payload);
        break;
        
      // ETL operations
      case 'etl:import':
        result = await handleETLImport(payload);
        break;
      case 'etl:export':
        result = handleETLExport(payload);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    respond(id, 'success', result, startTime);
    
  } catch (error) {
    respond(id, 'error', error instanceof Error ? error.message : String(error), startTime);
  }
};

function respond(id: string, status: 'success' | 'error', payload: unknown, startTime: number) {
  self.postMessage({
    id,
    status,
    payload,
    duration: performance.now() - startTime,
    timestamp: Date.now()
  });
}
```

---

## Database Handlers

```typescript
// Database initialization
async function handleInit(payload: { data?: ArrayBuffer }): Promise<void> {
  const SQL = await sqlPromise;
  
  if (payload.data) {
    db = new SQL.Database(new Uint8Array(payload.data));
  } else {
    db = new SQL.Database();
    initializeSchema();
  }
}

// Execute mutation (INSERT, UPDATE, DELETE)
function handleExec(payload: { sql: string; params?: unknown[] }): { changes: number } {
  db!.run(payload.sql, payload.params);
  return { changes: db!.getRowsModified() };
}

// Execute query (SELECT)
function handleQuery(payload: { sql: string; params?: unknown[] }): unknown[] {
  const stmt = db!.prepare(payload.sql);
  if (payload.params) stmt.bind(payload.params);
  
  const results: unknown[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  return results;
}

// Execute transaction
function handleTransaction(payload: { 
  operations: Array<{ sql: string; params?: unknown[] }> 
}): { success: boolean; operations: number } {
  db!.run('BEGIN TRANSACTION');
  
  try {
    for (const op of payload.operations) {
      db!.run(op.sql, op.params);
    }
    db!.run('COMMIT');
    return { success: true, operations: payload.operations.length };
  } catch (error) {
    db!.run('ROLLBACK');
    throw error;
  }
}

// Export database
function handleExport(): ArrayBuffer {
  const data = db!.export();
  return data.buffer;
}

// Import database
async function handleImport(payload: { data: ArrayBuffer }): Promise<void> {
  const SQL = await sqlPromise;
  if (db) db.close();
  db = new SQL.Database(new Uint8Array(payload.data));
}

// Schema initialization
function initializeSchema(): void {
  db!.run(`
    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY NOT NULL,
      card_type TEXT NOT NULL DEFAULT 'note',
      name TEXT NOT NULL,
      content TEXT,
      summary TEXT,
      latitude REAL,
      longitude REAL,
      location_name TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      due_at TEXT,
      completed_at TEXT,
      event_start TEXT,
      event_end TEXT,
      folder TEXT,
      tags TEXT,
      status TEXT,
      priority INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      url TEXT,
      mime_type TEXT,
      is_collective INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      source_id TEXT,
      deleted_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT DEFAULT 'pending'
    )
  `);
  
  db!.run(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
      label TEXT,
      weight REAL NOT NULL DEFAULT 1.0,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
      UNIQUE(source_id, target_id, via_card_id)
    )
  `);
  
  db!.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      name, content, tags, folder,
      content='cards',
      content_rowid='rowid',
      tokenize='porter unicode61'
    )
  `);
  
  // Indexes
  db!.run(`CREATE INDEX IF NOT EXISTS idx_cards_folder ON cards(folder) WHERE deleted_at IS NULL`);
  db!.run(`CREATE INDEX IF NOT EXISTS idx_cards_type ON cards(card_type) WHERE deleted_at IS NULL`);
  db!.run(`CREATE INDEX IF NOT EXISTS idx_cards_modified ON cards(modified_at)`);
  db!.run(`CREATE INDEX IF NOT EXISTS idx_conn_source ON connections(source_id)`);
  db!.run(`CREATE INDEX IF NOT EXISTS idx_conn_target ON connections(target_id)`);
  
  // FTS triggers
  db!.run(`
    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_insert AFTER INSERT ON cards BEGIN
      INSERT INTO cards_fts(rowid, name, content, tags, folder)
      VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
    END
  `);
  
  db!.run(`
    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_delete AFTER DELETE ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
      VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    END
  `);
  
  db!.run(`
    CREATE TRIGGER IF NOT EXISTS trg_cards_fts_update 
    AFTER UPDATE OF name, content, tags, folder ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
      VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
      INSERT INTO cards_fts(rowid, name, content, tags, folder)
      VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
    END
  `);
  
  // App state table
  db!.run(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);
}
```

---

## Graph Algorithm Handlers

```typescript
// Shortest path using recursive CTE
function handleShortestPath(payload: { 
  sourceId: string; 
  targetId: string; 
  maxDepth?: number 
}): string[] | null {
  const { sourceId, targetId, maxDepth = 10 } = payload;
  
  const sql = `
    WITH RECURSIVE paths(current_id, depth, path, found) AS (
      SELECT ?, 0, ?, (? = ?)
      UNION ALL
      SELECT
        CASE WHEN c.source_id = p.current_id THEN c.target_id ELSE c.source_id END,
        p.depth + 1,
        p.path || ',' || CASE WHEN c.source_id = p.current_id THEN c.target_id ELSE c.source_id END,
        CASE WHEN c.source_id = p.current_id THEN c.target_id ELSE c.source_id END = ?
      FROM paths p
      JOIN connections c ON (c.source_id = p.current_id OR c.target_id = p.current_id)
      WHERE p.found = 0 AND p.depth < ?
        AND p.path NOT LIKE '%' || CASE WHEN c.source_id = p.current_id THEN c.target_id ELSE c.source_id END || '%'
    )
    SELECT path FROM paths WHERE found = 1 ORDER BY depth LIMIT 1
  `;
  
  const stmt = db!.prepare(sql);
  stmt.bind([sourceId, sourceId, sourceId, targetId, targetId, maxDepth]);
  
  if (stmt.step()) {
    const path = stmt.getAsObject().path as string;
    stmt.free();
    return path.split(',');
  }
  
  stmt.free();
  return null;
}

// PageRank algorithm
function handlePageRank(payload: { 
  damping?: number; 
  iterations?: number 
}): Record<string, number> {
  const { damping = 0.85, iterations = 20 } = payload;
  
  // Get all nodes
  const nodes: string[] = [];
  const nodesStmt = db!.prepare('SELECT id FROM cards WHERE deleted_at IS NULL');
  while (nodesStmt.step()) {
    nodes.push(nodesStmt.getAsObject().id as string);
  }
  nodesStmt.free();
  
  // Build adjacency
  const outEdges = new Map<string, string[]>();
  const inEdges = new Map<string, string[]>();
  nodes.forEach(id => {
    outEdges.set(id, []);
    inEdges.set(id, []);
  });
  
  const edgesStmt = db!.prepare('SELECT source_id, target_id FROM connections');
  while (edgesStmt.step()) {
    const { source_id, target_id } = edgesStmt.getAsObject() as { source_id: string; target_id: string };
    outEdges.get(source_id)?.push(target_id);
    inEdges.get(target_id)?.push(source_id);
  }
  edgesStmt.free();
  
  // Initialize ranks
  const N = nodes.length;
  let rank = new Map<string, number>(nodes.map(n => [n, 1 / N]));
  
  // Iterate
  for (let i = 0; i < iterations; i++) {
    const newRank = new Map<string, number>();
    
    for (const node of nodes) {
      let sum = 0;
      for (const source of inEdges.get(node) || []) {
        const sourceOutDegree = outEdges.get(source)?.length || 1;
        sum += (rank.get(source) || 0) / sourceOutDegree;
      }
      newRank.set(node, (1 - damping) / N + damping * sum);
    }
    
    rank = newRank;
  }
  
  return Object.fromEntries(rank);
}

// Louvain community detection (simplified)
function handleLouvain(): Record<string, string> {
  const nodes: string[] = [];
  const stmt = db!.prepare('SELECT id FROM cards WHERE deleted_at IS NULL');
  while (stmt.step()) {
    nodes.push(stmt.getAsObject().id as string);
  }
  stmt.free();
  
  // Initialize: each node in own community
  const communities = new Map<string, string>(nodes.map(n => [n, n]));
  
  // Get neighbor weights
  const neighbors = new Map<string, Map<string, number>>();
  nodes.forEach(n => neighbors.set(n, new Map()));
  
  const edgesStmt = db!.prepare('SELECT source_id, target_id, weight FROM connections');
  while (edgesStmt.step()) {
    const { source_id, target_id, weight } = edgesStmt.getAsObject() as any;
    neighbors.get(source_id)?.set(target_id, weight);
    neighbors.get(target_id)?.set(source_id, weight);
  }
  edgesStmt.free();
  
  // Iterate until stable
  let changed = true;
  let iterations = 0;
  
  while (changed && iterations < 10) {
    changed = false;
    iterations++;
    
    for (const node of nodes) {
      const nodeNeighbors = neighbors.get(node) || new Map();
      const communityWeights = new Map<string, number>();
      
      for (const [neighbor, weight] of nodeNeighbors) {
        const comm = communities.get(neighbor)!;
        communityWeights.set(comm, (communityWeights.get(comm) || 0) + weight);
      }
      
      let bestCommunity = communities.get(node)!;
      let bestWeight = 0;
      
      for (const [comm, weight] of communityWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestCommunity = comm;
        }
      }
      
      if (bestCommunity !== communities.get(node)) {
        communities.set(node, bestCommunity);
        changed = true;
      }
    }
  }
  
  return Object.fromEntries(communities);
}

// Degree centrality
function handleCentrality(payload: { type: string }): Record<string, number> {
  if (payload.type === 'degree') {
    const result: Record<string, number> = {};
    
    const stmt = db!.prepare(`
      SELECT c.id,
        COALESCE(o.out_count, 0) + COALESCE(i.in_count, 0) as degree
      FROM cards c
      LEFT JOIN (SELECT source_id, COUNT(*) as out_count FROM connections GROUP BY source_id) o 
        ON o.source_id = c.id
      LEFT JOIN (SELECT target_id, COUNT(*) as in_count FROM connections GROUP BY target_id) i 
        ON i.target_id = c.id
      WHERE c.deleted_at IS NULL
    `);
    
    while (stmt.step()) {
      const row = stmt.getAsObject() as { id: string; degree: number };
      result[row.id] = row.degree;
    }
    stmt.free();
    
    return result;
  }
  
  // Betweenness/closeness would require all-pairs shortest path
  console.warn(`${payload.type} centrality not yet implemented`);
  return {};
}
```

---

## Usage Examples

### Basic Queries

```typescript
import { workerBridge } from '@/bridge/WorkerBridge';

// Initialize on app start
await workerBridge.init();

// Query cards
const cards = await workerBridge.query<Card>(`
  SELECT * FROM cards 
  WHERE deleted_at IS NULL 
  ORDER BY modified_at DESC 
  LIMIT 100
`);

// Insert a card
await workerBridge.exec(`
  INSERT INTO cards (id, name, card_type, folder)
  VALUES (?, ?, ?, ?)
`, [crypto.randomUUID(), 'New Card', 'note', 'Inbox']);

// Transaction
await workerBridge.transaction([
  { sql: 'UPDATE cards SET status = ? WHERE id = ?', params: ['done', cardId] },
  { sql: 'UPDATE cards SET modified_at = datetime("now") WHERE id = ?', params: [cardId] }
]);
```

### With Providers

```typescript
// FilterProvider compiles SQL, WorkerBridge executes it
class FilterProvider {
  async getFilteredCards(): Promise<Card[]> {
    const { where, params } = this.compileFilters();
    return workerBridge.query<Card>(`
      SELECT * FROM cards WHERE ${where} ORDER BY modified_at DESC
    `, params);
  }
}
```

### Graph Operations

```typescript
// Find connection path
const path = await workerBridge.shortestPath(cardA.id, cardB.id);

// Size nodes by importance
const pageRank = await workerBridge.pageRank();
svg.selectAll('circle')
  .attr('r', d => Math.sqrt(pageRank[d.id] || 0) * 100);

// Color by community
const communities = await workerBridge.louvainCommunities();
const colorScale = d3.scaleOrdinal(d3.schemeCategory10);
svg.selectAll('circle')
  .attr('fill', d => colorScale(communities[d.id]));
```

---

## Performance Considerations

### Batch Operations

```typescript
// ❌ Slow: many round trips
for (const card of cards) {
  await workerBridge.exec('INSERT INTO cards ...', [card.id, ...]);
}

// ✅ Fast: single transaction
await workerBridge.transaction(
  cards.map(card => ({
    sql: 'INSERT INTO cards (id, name) VALUES (?, ?)',
    params: [card.id, card.name]
  }))
);
```

### Large Results

```typescript
// Paginate large result sets
async function* paginatedQuery<T>(sql: string, pageSize = 1000) {
  let offset = 0;
  while (true) {
    const page = await workerBridge.query<T>(`${sql} LIMIT ${pageSize} OFFSET ${offset}`);
    if (page.length === 0) break;
    yield page;
    offset += pageSize;
  }
}
```

### Transferable Objects

For large ArrayBuffers (database export), use transferable ownership:

```typescript
// In worker - transfer instead of copy
const data = db.export();
self.postMessage(
  { id, status: 'success', payload: data.buffer },
  [data.buffer]  // Transfer list
);
```

---

## Error Handling

```typescript
try {
  await workerBridge.query('SELECT * FROM nonexistent');
} catch (error) {
  if (error.message.includes('no such table')) {
    // Schema error - run migrations
  } else {
    console.error('Query failed:', error);
  }
}
```

---

## Testing

```typescript
describe('WorkerBridge', () => {
  beforeEach(async () => {
    await workerBridge.init();
  });
  
  it('executes queries', async () => {
    await workerBridge.exec(
      'INSERT INTO cards (id, name, card_type) VALUES (?, ?, ?)',
      ['test-1', 'Test', 'note']
    );
    
    const results = await workerBridge.query<Card>(
      'SELECT * FROM cards WHERE id = ?',
      ['test-1']
    );
    
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Test');
  });
  
  it('rolls back failed transactions', async () => {
    await expect(workerBridge.transaction([
      { sql: 'INSERT INTO cards (id, name) VALUES (?, ?)', params: ['t1', 'Card 1'] },
      { sql: 'INSERT INTO nonexistent VALUES (?)' },
    ])).rejects.toThrow();
    
    const results = await workerBridge.query('SELECT * FROM cards WHERE id = ?', ['t1']);
    expect(results).toHaveLength(0);  // Rolled back
  });
  
  it('finds shortest path', async () => {
    // Setup: a → b → c
    await workerBridge.transaction([
      { sql: 'INSERT INTO cards (id, name) VALUES (?, ?)', params: ['a', 'A'] },
      { sql: 'INSERT INTO cards (id, name) VALUES (?, ?)', params: ['b', 'B'] },
      { sql: 'INSERT INTO cards (id, name) VALUES (?, ?)', params: ['c', 'C'] },
      { sql: 'INSERT INTO connections (id, source_id, target_id) VALUES (?, ?, ?)', params: ['e1', 'a', 'b'] },
      { sql: 'INSERT INTO connections (id, source_id, target_id) VALUES (?, ?, ?)', params: ['e2', 'b', 'c'] },
    ]);
    
    const path = await workerBridge.shortestPath('a', 'c');
    expect(path).toEqual(['a', 'b', 'c']);
  });
});
```

---

## Key Principles

1. **One Worker** — Single worker handles DB, graph, ETL
2. **Typed Protocol** — All messages have TypeScript types
3. **Promise-Based** — Main thread never blocks
4. **Thin Bridge** — Logic lives in handlers, not communication
5. **Transfer Large Data** — Use transferable objects for ArrayBuffers
