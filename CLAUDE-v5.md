# CLAUDE.md — Isometry v5 Implementation Guide

*Canonical reference for Claude Code. When in doubt, this document wins.*

---

## Mission

Build Isometry v5: a **local-first, polymorphic data projection platform** where:
- **LATCH separates** (filter, sort, group)
- **GRAPH joins** (traverse, aggregate, cluster)
- **Any axis maps to any plane** (PAFV projection)
- **SQLite is the system of record** (sql.js in browser, native SQLite + CloudKit on device)

---

## Resolved Architectural Decisions

These decisions are **final**. Do not revisit them during implementation.

### D-001: Graph Model — Lightweight Relations ✓

**Decision:** Connections are lightweight relations, not first-class cards.

```sql
CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label TEXT NOT NULL,           -- Freeform: 'mentions', 'contains', 'sent', etc.
    via_card_id TEXT REFERENCES cards(id),  -- Optional: rich context through bridge card
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_id, target_id, label)
);
```

**Rationale:** Lower schema complexity for v5. Rich relationships use the `via_card_id` pattern — the connection points to a card that carries the context (e.g., an email card that IS the relationship between sender and receiver).

**What this means for implementation:**
- Connections have properties (label, weight, via_card_id) but are NOT in the cards table
- Graph queries use `connections` table with JOINs to `cards`
- ETL maps source relationships to connection rows, not card rows
- LATCH filtering applies to cards; connection filtering is separate

### D-002: WorkerBridge — Single Canonical Spec ✓

**Decision:** `/Modules/Core/WorkerBridge.md` is canonical. `/Modules/WorkerBridge.md` is a redirect stub only.

**Message Envelope (canonical):**
```typescript
interface WorkerMessage {
    id: string;              // UUID for request/response correlation
    type: WorkerMessageType; // 'query' | 'mutate' | 'graph' | 'fts' | 'export'
    payload: unknown;        // Type-specific payload
    timestamp: number;       // For debugging/logging
}

interface WorkerResponse {
    id: string;              // Matches request id
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string };
    timing?: { queued: number; executed: number; returned: number };
}
```

**What this means for implementation:**
- All Worker communication uses this envelope
- Providers compile state to `WorkerMessage` payloads
- Worker returns `WorkerResponse` with correlation ID
- No raw SQL strings cross the bridge — use typed message payloads

### D-003: SQL Safety — Allowlist + Parameters ✓

**Decision:** Dynamic filters use allowlisted columns and parameterized values only. No raw SQL from UI/provider state.

**Field Registry (canonical):**
```typescript
const ALLOWED_FILTER_FIELDS = [
    'name', 'content', 'folder', 'status', 'priority',
    'created_at', 'modified_at', 'due_at', 'completed_at',
    'card_type', 'source', 'source_id'
] as const;

const ALLOWED_OPERATORS = [
    '=', '!=', '<', '>', '<=', '>=',
    'LIKE', 'NOT LIKE', 'IN', 'NOT IN',
    'IS NULL', 'IS NOT NULL',
    'BETWEEN'
] as const;

type FilterField = typeof ALLOWED_FILTER_FIELDS[number];
type FilterOperator = typeof ALLOWED_OPERATORS[number];
```

**What this means for implementation:**
- `FilterProvider` validates fields against allowlist before compilation
- Values are always parameterized (`?` placeholders)
- SQL compiler throws on unrecognized fields/operators
- Tests include injection attempts (see Quality Gates)

### D-004: FTS Contract — rowid Joins ✓

**Decision:** FTS5 uses `rowid` joins with canonical fields.

**Schema (canonical):**
```sql
CREATE VIRTUAL TABLE cards_fts USING fts5(
    name,
    content,
    tags,
    folder,
    content='cards',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Sync triggers (abbreviated)
CREATE TRIGGER cards_fts_insert AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;
```

**Search Query Pattern (canonical):**
```sql
SELECT c.*, bm25(cards_fts) AS rank
FROM cards_fts
JOIN cards c ON cards_fts.rowid = c.rowid
WHERE cards_fts MATCH ?
  AND c.deleted_at IS NULL
ORDER BY rank
LIMIT ?;
```

**What this means for implementation:**
- Always join on `rowid`, never on `id`
- FTS fields match cards table columns exactly
- Search results include rank for relevance sorting
- All modules reference this single pattern

### D-005: State Persistence Tiers ✓

**Decision:** Three tiers with explicit persistence rules.

| Tier | Persistence | Examples | Storage |
|------|-------------|----------|---------|
| **1: Durable** | Survives app restart + sync | Cards, Connections, Folders | SQLite `cards`, `connections` |
| **2: Session** | Survives navigation, cleared on restart | Filter state, View config, Axis mappings | SQLite `ui_state` table |
| **3: Ephemeral** | Cleared on navigation | Selection, Hover, Drag state | In-memory only |

**SelectionProvider is Tier 3 (ephemeral).** Selection does not persist across restarts.

**What this means for implementation:**
- Tier 1: Write to cards/connections tables, sync via CloudKit
- Tier 2: Write to `ui_state` table, restore on app launch, do not sync
- Tier 3: Hold in Provider memory only, no persistence

### D-006: View Enum ✓

**Decision:** Nine canonical views with tier availability.

```typescript
type ViewType = 
    | 'list'      // LATCH: single axis
    | 'grid'      // LATCH: two axes (SuperGrid)
    | 'kanban'    // LATCH: category axis (status)
    | 'calendar'  // LATCH: time axis (month view)
    | 'timeline'  // LATCH: time axis (linear)
    | 'gallery'   // LATCH: visual cards
    | 'network'   // GRAPH: force-directed
    | 'tree'      // GRAPH: hierarchy
    | 'table'     // Raw data view
;
```

| View | Free | Pro | Workbench |
|------|------|-----|-----------|
| list | ✓ | ✓ | ✓ |
| grid | ✓ | ✓ | ✓ |
| kanban | – | ✓ | ✓ |
| calendar | – | ✓ | ✓ |
| timeline | – | ✓ | ✓ |
| gallery | – | ✓ | ✓ |
| network | – | ✓ | ✓ |
| tree | – | ✓ | ✓ |
| table | – | – | ✓ |

### D-007: Credential Storage — Keychain Only ✓

**Decision:** OAuth tokens and secrets are Keychain-only. SQLite stores non-sensitive metadata only.

**Allowed in SQLite:**
- ETL source name, last sync timestamp
- User preferences (theme, density defaults)
- Folder structure, card metadata

**Keychain only:**
- OAuth access tokens, refresh tokens
- API keys
- Any secret that grants access

**What this means for implementation:**
- `NativeShell` provides Keychain read/write via `WorkerBridge` action
- ETL modules request credentials through bridge, never store locally
- SQLite `etl_sources` table stores metadata only

### D-008: Schema-on-Read Extras — Deferred ✓

**Decision:** Defer to Phase 2. For v5, use fixed schema only.

Cards have canonical columns. Extra source-specific fields are:
1. Dropped during ETL (v5 approach), OR
2. Stored in `card_properties` EAV table (Phase 2)

**What this means for implementation:**
- ETL maps source fields to canonical card columns
- Unmapped fields are logged and dropped
- No `metadata_json` column in v5

### D-009: Undo/Redo — Command Log ✓

**Decision:** Command log with inverse operations for v5.

```typescript
interface Command {
    id: string;
    type: 'insert' | 'update' | 'delete' | 'batch';
    table: 'cards' | 'connections';
    forward: { sql: string; params: unknown[] };
    inverse: { sql: string; params: unknown[] };
    timestamp: number;
}
```

**What this means for implementation:**
- `MutationManager` generates inverse SQL for every mutation
- Command stack held in memory (Tier 3)
- Undo replays inverse; Redo replays forward
- Stack cleared on sync conflict (user must resolve manually)

### D-010: CloudKit Sync Triggers ✓

**Decision:** Dirty flag + debounce + lifecycle triggers.

| Trigger | Debounce | Action |
|---------|----------|--------|
| Card mutation | 2 seconds | Mark dirty |
| Connection mutation | 2 seconds | Mark dirty |
| App backgrounding | None | Checkpoint + push if dirty |
| Explicit save (⌘S) | None | Checkpoint + push immediately |
| Periodic (foreground) | 5 minutes | Push if dirty |

**What this means for implementation:**
- `MutationManager` sets dirty flag on any write
- Debounce timer resets on each mutation
- `NativeShell` observes app lifecycle, triggers sync
- Worker exports database to native shell for CloudKit upload

---

## Development Philosophy: GSD + TDD

### Get Stuff Done (GSD)

1. **Ship working code, not perfect code.** Start simple, iterate.
2. **One thing at a time.** Complete each task before starting the next.
3. **Fail fast, fix fast.** Run tests continuously, fix breaks immediately.
4. **When stuck, simplify.** Remove complexity, don't add it.

### Test-Driven Development (TDD)

**The Red-Green-Refactor cycle is non-negotiable:**

```
1. RED    → Write a failing test that defines desired behavior
2. GREEN  → Write minimum code to make it pass
3. REFACTOR → Clean up while keeping tests green
```

**TDD Rules:**
- No production code without a failing test first
- Tests must be fast (<100ms each)
- Tests must be independent (no shared state)
- Test behavior, not implementation

---

## Project Structure

```
Isometry/
├── CLAUDE.md                          ← You are here
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── index.ts                       ← Entry point
│   ├── database/
│   │   ├── schema.sql                 ← Canonical schema
│   │   ├── Database.ts                ← sql.js wrapper
│   │   ├── queries/                   ← Named query modules
│   │   │   ├── cards.ts
│   │   │   ├── connections.ts
│   │   │   ├── search.ts
│   │   │   └── graph.ts
│   │   └── migrations/                ← Schema migrations
│   ├── providers/
│   │   ├── FilterProvider.ts
│   │   ├── AxisProvider.ts
│   │   ├── SelectionProvider.ts
│   │   ├── DensityProvider.ts
│   │   └── ViewProvider.ts
│   ├── worker/
│   │   ├── worker.ts                  ← Web Worker entry
│   │   ├── handlers/                  ← Message type handlers
│   │   └── WorkerBridge.ts            ← Main thread bridge
│   ├── views/
│   │   ├── ViewManager.ts
│   │   ├── SuperGrid.ts
│   │   ├── NetworkView.ts
│   │   ├── KanbanView.ts
│   │   └── ...
│   ├── components/
│   │   ├── Card.ts                    ← D3 card rendering
│   │   ├── Header.ts                  ← Dimensional headers
│   │   └── Explorer.ts                ← LATCH filter UI
│   └── etl/
│       ├── AppleNotes.ts
│       ├── AppleReminders.ts
│       └── Slack.ts
├── tests/
│   ├── database/
│   ├── providers/
│   ├── views/
│   └── integration/
├── native/                            ← Swift/SwiftUI shell (separate repo or subdir)
│   ├── IsometryApp.swift
│   ├── WebViewContainer.swift
│   ├── CloudKitSync.swift
│   └── KeychainManager.swift
└── docs/
    ├── decision-log.md
    └── Modules/                       ← Spec modules (reference only)
```

---

## Implementation Order

Follow this sequence. Do not skip ahead.

### Phase 1: Database Foundation

**1.1 Create schema.sql**
```sql
-- Cards table with LATCH attributes
CREATE TABLE cards (
    id TEXT PRIMARY KEY,
    card_type TEXT NOT NULL DEFAULT 'note',
    name TEXT NOT NULL,
    content TEXT,
    folder TEXT,
    tags TEXT,  -- JSON array
    status TEXT,
    priority INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    modified_at TEXT DEFAULT (datetime('now')),
    due_at TEXT,
    completed_at TEXT,
    source TEXT,
    source_id TEXT,
    deleted_at TEXT,
    UNIQUE(source, source_id)
);

-- Connections (lightweight relations)
CREATE TABLE connections (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    via_card_id TEXT REFERENCES cards(id),
    weight REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_id, target_id, label)
);

-- FTS5 (see D-004 for full schema)
-- UI State (Tier 2 persistence)
-- Sync State
```

**1.2 Write First Failing Test**
```typescript
// tests/database/Database.test.ts
import { describe, it, expect } from 'vitest';
import { Database } from '../../src/database/Database';

describe('Database', () => {
    it('initializes with schema', async () => {
        const db = new Database();
        await db.initialize();
        
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        expect(tables[0].values.flat()).toContain('cards');
        expect(tables[0].values.flat()).toContain('connections');
    });
});
```

**1.3 Implement Database.ts**
- Load sql.js WASM
- Apply schema
- Expose `exec()`, `run()`, `prepare()` methods

### Phase 2: CRUD + Queries

**For each query type, TDD:**
1. Write failing test
2. Implement query function
3. Refactor

**Queries to implement:**
```typescript
// cards.ts
export function createCard(db: Database, card: CardInput): Card;
export function getCard(db: Database, id: string): Card | null;
export function updateCard(db: Database, id: string, updates: Partial<CardInput>): Card;
export function deleteCard(db: Database, id: string, hard?: boolean): void;
export function listCards(db: Database, options?: ListOptions): Card[];

// connections.ts
export function createConnection(db: Database, conn: ConnectionInput): Connection;
export function getConnections(db: Database, cardId: string, direction?: 'in' | 'out' | 'both'): Connection[];
export function deleteConnection(db: Database, id: string): void;

// search.ts
export function search(db: Database, query: string, limit?: number): SearchResult[];

// graph.ts
export function connectedCards(db: Database, startId: string, maxDepth: number): CardWithDepth[];
export function shortestPath(db: Database, fromId: string, toId: string): string[] | null;
```

### Phase 3: Providers

**Implement each provider with tests:**

```typescript
// FilterProvider.ts
interface FilterState {
    field: FilterField;
    operator: FilterOperator;
    value: unknown;
}

class FilterProvider {
    private filters: FilterState[] = [];
    
    addFilter(filter: FilterState): void;
    removeFilter(index: number): void;
    clear(): void;
    
    // Compile to SQL WHERE clause (parameterized)
    toSQL(): { where: string; params: unknown[] };
}
```

**Key providers:**
- `FilterProvider` — LATCH filtering (Tier 2)
- `AxisProvider` — PAFV axis→plane mapping (Tier 2)
- `SelectionProvider` — Selected card IDs (Tier 3)
- `DensityProvider` — Row/column density settings (Tier 2)
- `ViewProvider` — Current view type (Tier 2)

### Phase 4: Worker Bridge

**Implement canonical message protocol:**

```typescript
// WorkerBridge.ts (main thread)
class WorkerBridge {
    private worker: Worker;
    private pending: Map<string, { resolve: Function; reject: Function }>;
    
    async query(sql: string, params?: unknown[]): Promise<QueryResult>;
    async mutate(mutations: Mutation[]): Promise<MutationResult>;
    async search(query: string): Promise<SearchResult[]>;
    async graphTraverse(startId: string, depth: number): Promise<Card[]>;
}

// worker.ts (worker thread)
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { id, type, payload } = e.data;
    try {
        const result = await handlers[type](payload);
        self.postMessage({ id, success: true, data: result });
    } catch (error) {
        self.postMessage({ id, success: false, error: { code: 'ERROR', message: error.message } });
    }
};
```

### Phase 5: Views

**Implement D3 views with data join pattern:**

```typescript
// SuperGrid.ts
class SuperGrid {
    private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    
    render(cards: Card[], xAxis: Facet, yAxis: Facet): void {
        // D3 data join
        const cells = this.svg.selectAll('.cell')
            .data(cards, d => d.id)
            .join(
                enter => enter.append('g').attr('class', 'cell'),
                update => update,
                exit => exit.remove()
            );
        
        // Position based on axis values
        cells.attr('transform', d => `translate(${xScale(d[xAxis])}, ${yScale(d[yAxis])})`);
    }
}
```

### Phase 6: ETL

**Implement importers with test data:**

```typescript
// AppleNotes.ts
interface AppleNotesETL {
    import(notesPath: string): Promise<Card[]>;
    mapToCard(note: RawNote): CardInput;
}
```

### Phase 7: Native Shell (Separate Repo/Subdir)

**Swift implementation:**
- `WebViewContainer` — WKWebView with message handlers
- `CloudKitSync` — Database export/import
- `KeychainManager` — Credential storage

---

## Quality Gates

### Before Every Commit

```bash
# TypeScript must compile with no errors
npm run typecheck

# All tests must pass
npm run test

# Lint must pass
npm run lint
```

### SQL Safety Tests (Required)

```typescript
describe('SQL Safety', () => {
    it('rejects unknown fields', () => {
        expect(() => filterProvider.addFilter({
            field: 'malicious_field' as any,
            operator: '=',
            value: 'test'
        })).toThrow('Unknown field');
    });
    
    it('rejects SQL injection in values', () => {
        const { where, params } = filterProvider.toSQL();
        expect(where).not.toContain("'; DROP TABLE");
        expect(params).toContain("'; DROP TABLE cards; --");  // Value is parameterized
    });
    
    it('rejects unknown operators', () => {
        expect(() => filterProvider.addFilter({
            field: 'name',
            operator: 'EXECUTE' as any,
            value: 'test'
        })).toThrow('Unknown operator');
    });
});
```

### Performance Thresholds

| Operation | Threshold | Test Data |
|-----------|-----------|-----------|
| Card insert | <10ms | Single card |
| Bulk insert | <1s | 1000 cards |
| FTS search | <100ms | 10K cards |
| Graph traversal (depth 3) | <500ms | 10K cards, 50K connections |
| View render | <16ms | 100 visible cards |

---

## Common Patterns

### D3 Data Join (Always Use)

```typescript
// CORRECT: Key function ensures stable identity
selection.selectAll('.item')
    .data(items, d => d.id)  // ← Key function required
    .join('g')
    .attr('class', 'item');

// WRONG: No key function causes DOM thrashing
selection.selectAll('.item')
    .data(items)  // ← Missing key function
    .join('g');
```

### Provider → SQL Compilation

```typescript
// Providers compile state to SQL fragments
const filter = filterProvider.toSQL();      // { where: "status = ?", params: ["active"] }
const order = axisProvider.toOrderBy();     // "ORDER BY priority DESC, name ASC"
const limit = densityProvider.toLimit();    // "LIMIT 50 OFFSET 0"

// Worker assembles final query
const sql = `
    SELECT * FROM cards
    WHERE deleted_at IS NULL ${filter.where ? `AND ${filter.where}` : ''}
    ${order}
    ${limit}
`;
```

### Error Handling

```typescript
// Worker responses always have success flag
const response = await bridge.query(sql);
if (!response.success) {
    console.error(`Query failed: ${response.error.code} - ${response.error.message}`);
    // Handle gracefully, don't crash
    return [];
}
return response.data;
```

---

## What NOT to Do

### ❌ Don't Duplicate Entity State

```typescript
// WRONG: Parallel store duplicates SQLite data
const cardStore = create<CardState>((set) => ({
    cards: [],
    setCards: (cards) => set({ cards }),
}));

// CORRECT: Query sql.js directly, no duplication
const cards = db.exec("SELECT * FROM cards WHERE deleted_at IS NULL");
```

### ❌ Don't Use Raw SQL from UI

```typescript
// WRONG: User input in SQL
const sql = `SELECT * FROM cards WHERE name LIKE '%${userInput}%'`;

// CORRECT: Parameterized query
const sql = `SELECT * FROM cards WHERE name LIKE ?`;
const params = [`%${userInput}%`];
```

### ❌ Don't Mix Connection Models

```typescript
// WRONG: Treating connections as cards
const edge = await createCard({ type: 'edge', source: a, target: b });

// CORRECT: Connections are separate
const conn = await createConnection({ source_id: a, target_id: b, label: 'mentions' });
```

### ❌ Don't Persist Selection

```typescript
// WRONG: Saving selection to database
await db.run("INSERT INTO ui_state (key, value) VALUES ('selection', ?)", [JSON.stringify(selectedIds)]);

// CORRECT: Selection is Tier 3 (ephemeral)
selectionProvider.setSelected(selectedIds);  // In-memory only
```

---

## Debugging Checklist

### Database Issues
- [ ] Is sql.js initialized? Check WASM loaded
- [ ] Schema applied? `SELECT name FROM sqlite_master WHERE type='table'`
- [ ] FTS in sync? Check trigger execution
- [ ] Foreign keys enabled? `PRAGMA foreign_keys`

### Provider Issues
- [ ] Filter compiling correctly? Log `toSQL()` output
- [ ] Params correctly ordered? Match `?` placeholders to array
- [ ] Tier correct? Check persistence behavior

### View Issues
- [ ] D3 key function present? Check `.data(items, d => d.id)`
- [ ] Scale domains set? Check axis ranges
- [ ] Transitions completing? Check duration/delay

### Worker Issues
- [ ] Message ID correlating? Check request/response pairing
- [ ] Error propagating? Check `success` flag handling
- [ ] Worker alive? Check `onerror` handler

---

## Reference Documents

Read these in order:
1. `/Isometry v5 SPEC.md` — Product vision and architecture
2. `/Modules/Core/Contracts.md` — Schema and type definitions
3. `/Modules/Core/WorkerBridge.md` — Canonical message protocol
4. `/Modules/Core/Providers.md` — State management patterns
5. `/Modules/SuperGrid.md` — Primary view implementation

**Do not reference:**
- `/Modules/WorkerBridge.md` (deprecated, use Core version)
- Any document that contradicts decisions in this CLAUDE.md

---

## Go/No-Go Checklist

Before marking implementation complete:

- [ ] All tests pass (`npm run test`)
- [ ] TypeScript compiles with no errors (`npm run typecheck`)
- [ ] SQL safety tests pass (injection attempts rejected)
- [ ] FTS search works with rowid joins
- [ ] Connections use lightweight model (not cards)
- [ ] Selection is ephemeral (Tier 3)
- [ ] Credentials are Keychain-only (no tokens in SQLite)
- [ ] CloudKit sync triggers on dirty + lifecycle events
- [ ] All nine views render correctly
- [ ] Performance thresholds met

---

*This is the source of truth. Build something excellent.*
