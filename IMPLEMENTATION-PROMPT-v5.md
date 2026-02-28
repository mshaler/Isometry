# Isometry v5 Implementation Kickoff

## Context

You are implementing Isometry v5, a local-first polymorphic data projection platform.

**Read these documents first, in order:**
1. `CLAUDE.md` — This is your canonical reference. Decisions here are final.
2. `Isometry v5 SPEC.md` — Product vision and architecture overview
3. `Modules/Core/Contracts.md` — Schema and type definitions
4. `Modules/Core/WorkerBridge.md` — Message protocol (canonical version)

**Do not read or reference:**
- `Modules/WorkerBridge.md` (deprecated stub)
- Any document that contradicts `CLAUDE.md`

## Blocking Issues — RESOLVED

The following issues from the implementation gate review are resolved in `CLAUDE.md`:

| Issue | Resolution |
|-------|------------|
| Graph model contradiction | **Lightweight relations** — connections table, not cards |
| WorkerBridge split | **Core/WorkerBridge.md is canonical** |
| SQL safety boundary | **Allowlisted fields + parameterized values** |
| FTS contract drift | **rowid joins, canonical fields** |
| State persistence tiers | **SelectionProvider is Tier 3 (ephemeral)** |
| View enum | **Nine views, explicit tier availability** |
| Credential storage | **Keychain only for tokens** |
| Schema-on-read extras | **Deferred to Phase 2** |
| Undo/redo | **Command log with inverse operations** |
| CloudKit sync triggers | **Dirty flag + debounce + lifecycle** |

These decisions are final. Do not revisit them.

## Your Mission

Build the TypeScript/D3.js web runtime that runs inside a WKWebView. The native Swift shell is a separate effort.

**Core deliverables:**
1. sql.js database with canonical schema
2. Provider system for UI state
3. WorkerBridge with message protocol
4. D3.js views (start with SuperGrid)
5. ETL importers (start with Apple Notes)

## Phase 1: Project Setup

### Step 1.1: Initialize Project

```bash
mkdir isometry-v5 && cd isometry-v5
npm init -y
npm install -D typescript vite vitest @types/d3
npm install d3 sql.js uuid
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

Create `vite.config.ts`:
```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
```

### Step 1.2: Create Directory Structure

```bash
mkdir -p src/{database,providers,worker,views,components,etl}
mkdir -p src/database/queries
mkdir -p tests/{database,providers,views,integration}
```

### Step 1.3: Write First Failing Test (TDD)

Create `tests/database/Database.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../../src/database/Database';

describe('Database', () => {
    let db: Database;
    
    beforeEach(async () => {
        db = new Database();
        await db.initialize();
    });
    
    it('creates cards table', () => {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='cards'");
        expect(tables[0]?.values.length).toBe(1);
    });
    
    it('creates connections table', () => {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='connections'");
        expect(tables[0]?.values.length).toBe(1);
    });
    
    it('creates FTS5 virtual table', () => {
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='cards_fts'");
        expect(tables[0]?.values.length).toBe(1);
    });
});
```

Run: `npm run test` — Tests should **FAIL** (RED).

### Step 1.4: Implement Database.ts

Create `src/database/Database.ts`:

```typescript
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';

export class Database {
    private db: SqlJsDatabase | null = null;
    
    async initialize(): Promise<void> {
        const SQL = await initSqlJs({
            locateFile: file => `https://sql.js.org/dist/${file}`
        });
        
        this.db = new SQL.Database();
        this.applySchema();
    }
    
    private applySchema(): void {
        if (!this.db) throw new Error('Database not initialized');
        
        // Schema from CLAUDE.md D-001, D-004
        this.db.run(`
            CREATE TABLE IF NOT EXISTS cards (
                id TEXT PRIMARY KEY,
                card_type TEXT NOT NULL DEFAULT 'note',
                name TEXT NOT NULL,
                content TEXT,
                folder TEXT,
                tags TEXT,
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
            
            CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
                target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
                label TEXT NOT NULL,
                via_card_id TEXT REFERENCES cards(id),
                weight REAL DEFAULT 1.0,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(source_id, target_id, label)
            );
            
            CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
                name,
                content,
                tags,
                folder,
                content='cards',
                content_rowid='rowid',
                tokenize='porter unicode61 remove_diacritics 1'
            );
            
            -- FTS sync triggers
            CREATE TRIGGER IF NOT EXISTS cards_fts_insert AFTER INSERT ON cards BEGIN
                INSERT INTO cards_fts(rowid, name, content, tags, folder)
                VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
            END;
            
            CREATE TRIGGER IF NOT EXISTS cards_fts_delete AFTER DELETE ON cards BEGIN
                INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
                VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
            END;
            
            CREATE TRIGGER IF NOT EXISTS cards_fts_update AFTER UPDATE ON cards BEGIN
                INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
                VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
                INSERT INTO cards_fts(rowid, name, content, tags, folder)
                VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
            END;
            
            -- UI State (Tier 2)
            CREATE TABLE IF NOT EXISTS ui_state (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at TEXT DEFAULT (datetime('now'))
            );
            
            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_cards_folder ON cards(folder) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_cards_status ON cards(status) WHERE deleted_at IS NULL;
            CREATE INDEX IF NOT EXISTS idx_cards_source ON cards(source, source_id);
            CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_id);
            CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_id);
        `);
    }
    
    exec(sql: string, params?: unknown[]): { columns: string[]; values: unknown[][] }[] {
        if (!this.db) throw new Error('Database not initialized');
        return this.db.exec(sql, params);
    }
    
    run(sql: string, params?: unknown[]): void {
        if (!this.db) throw new Error('Database not initialized');
        this.db.run(sql, params);
    }
}
```

Run: `npm run test` — Tests should **PASS** (GREEN).

## Phase 2: CRUD Queries

### Step 2.1: Card CRUD Tests

Create `tests/database/cards.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard, getCard, updateCard, deleteCard, listCards } from '../../src/database/queries/cards';

describe('Card CRUD', () => {
    let db: Database;
    
    beforeEach(async () => {
        db = new Database();
        await db.initialize();
    });
    
    it('creates a card', () => {
        const card = createCard(db, { name: 'Test Card' });
        expect(card.id).toBeDefined();
        expect(card.name).toBe('Test Card');
    });
    
    it('retrieves a card by id', () => {
        const created = createCard(db, { name: 'Test Card' });
        const retrieved = getCard(db, created.id);
        expect(retrieved?.name).toBe('Test Card');
    });
    
    it('updates a card', () => {
        const card = createCard(db, { name: 'Original' });
        const updated = updateCard(db, card.id, { name: 'Updated' });
        expect(updated.name).toBe('Updated');
    });
    
    it('soft deletes a card', () => {
        const card = createCard(db, { name: 'To Delete' });
        deleteCard(db, card.id);
        const retrieved = getCard(db, card.id);
        expect(retrieved).toBeNull();  // Soft deleted cards don't appear
    });
    
    it('lists cards with filters', () => {
        createCard(db, { name: 'Card A', folder: 'Work' });
        createCard(db, { name: 'Card B', folder: 'Personal' });
        createCard(db, { name: 'Card C', folder: 'Work' });
        
        const workCards = listCards(db, { folder: 'Work' });
        expect(workCards.length).toBe(2);
    });
});
```

### Step 2.2: Implement Card Queries

Create `src/database/queries/cards.ts` and implement to make tests pass.

### Step 2.3: Connection CRUD Tests

Create `tests/database/connections.test.ts`:

```typescript
describe('Connection CRUD', () => {
    it('creates a connection between cards', () => {
        const cardA = createCard(db, { name: 'Card A' });
        const cardB = createCard(db, { name: 'Card B' });
        
        const conn = createConnection(db, {
            source_id: cardA.id,
            target_id: cardB.id,
            label: 'mentions'
        });
        
        expect(conn.id).toBeDefined();
        expect(conn.label).toBe('mentions');
    });
    
    it('retrieves outgoing connections', () => {
        const cardA = createCard(db, { name: 'Card A' });
        const cardB = createCard(db, { name: 'Card B' });
        const cardC = createCard(db, { name: 'Card C' });
        
        createConnection(db, { source_id: cardA.id, target_id: cardB.id, label: 'mentions' });
        createConnection(db, { source_id: cardA.id, target_id: cardC.id, label: 'contains' });
        
        const outgoing = getConnections(db, cardA.id, 'out');
        expect(outgoing.length).toBe(2);
    });
    
    it('supports via_card_id for rich relationships', () => {
        const person = createCard(db, { name: 'Alice', card_type: 'person' });
        const project = createCard(db, { name: 'Project X', card_type: 'project' });
        const email = createCard(db, { name: 'Re: Project Update', card_type: 'email' });
        
        const conn = createConnection(db, {
            source_id: person.id,
            target_id: project.id,
            label: 'contributed',
            via_card_id: email.id  // The email IS the relationship context
        });
        
        expect(conn.via_card_id).toBe(email.id);
    });
});
```

## Phase 3: Search (FTS5)

### Step 3.1: Search Tests

```typescript
describe('FTS5 Search', () => {
    it('finds cards by name', () => {
        createCard(db, { name: 'Apple Pie Recipe', content: 'Delicious dessert' });
        createCard(db, { name: 'Banana Bread', content: 'Yellow fruit bread' });
        
        const results = search(db, 'apple');
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('Apple Pie Recipe');
    });
    
    it('finds cards by content', () => {
        createCard(db, { name: 'Recipe', content: 'Add some apple slices' });
        
        const results = search(db, 'apple');
        expect(results.length).toBe(1);
    });
    
    it('uses rowid join correctly', () => {
        // This test ensures we're using the canonical FTS contract
        createCard(db, { name: 'Test Card' });
        
        // Direct SQL to verify join pattern
        const results = db.exec(`
            SELECT c.id, c.name
            FROM cards_fts
            JOIN cards c ON cards_fts.rowid = c.rowid
            WHERE cards_fts MATCH 'test'
        `);
        
        expect(results[0]?.values.length).toBe(1);
    });
});
```

## Phase 4: Providers

### Step 4.1: FilterProvider Tests

```typescript
describe('FilterProvider', () => {
    it('compiles to parameterized SQL', () => {
        const provider = new FilterProvider();
        provider.addFilter({ field: 'status', operator: '=', value: 'active' });
        
        const { where, params } = provider.toSQL();
        expect(where).toBe('status = ?');
        expect(params).toEqual(['active']);
    });
    
    it('rejects unknown fields', () => {
        const provider = new FilterProvider();
        expect(() => provider.addFilter({
            field: 'malicious_field' as any,
            operator: '=',
            value: 'test'
        })).toThrow();
    });
    
    it('rejects SQL injection in values', () => {
        const provider = new FilterProvider();
        provider.addFilter({
            field: 'name',
            operator: 'LIKE',
            value: "'; DROP TABLE cards; --"
        });
        
        const { where, params } = provider.toSQL();
        // Value is parameterized, not interpolated
        expect(where).toBe('name LIKE ?');
        expect(params[0]).toBe("'; DROP TABLE cards; --");
    });
});
```

## Phase 5: Worker Bridge

### Step 5.1: WorkerBridge Tests

```typescript
describe('WorkerBridge', () => {
    it('correlates request and response by id', async () => {
        const bridge = new WorkerBridge();
        await bridge.initialize();
        
        const result = await bridge.query("SELECT 1 as test");
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
    });
    
    it('handles errors gracefully', async () => {
        const bridge = new WorkerBridge();
        await bridge.initialize();
        
        const result = await bridge.query("SELECT * FROM nonexistent_table");
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

## Success Criteria

### Phase 1 Complete When:
- [ ] `npm run test` passes for Database tests
- [ ] Schema includes cards, connections, cards_fts tables
- [ ] FTS5 triggers fire correctly

### Phase 2 Complete When:
- [ ] All CRUD tests pass
- [ ] Connections support via_card_id pattern
- [ ] Soft delete excludes from queries

### Phase 3 Complete When:
- [ ] FTS search returns ranked results
- [ ] rowid joins used (not id joins)
- [ ] Search performance <100ms for 10K cards

### Phase 4 Complete When:
- [ ] FilterProvider rejects unknown fields
- [ ] All values are parameterized
- [ ] SQL injection tests pass

### Phase 5 Complete When:
- [ ] Worker responds with correlation IDs
- [ ] Errors propagate correctly
- [ ] Query results serialize properly

## Final Checklist

Before declaring v5 implementation complete:

- [ ] All blocking issues from review are resolved per CLAUDE.md
- [ ] Connections are lightweight relations (not cards)
- [ ] FTS uses rowid joins
- [ ] SQL safety tests pass
- [ ] SelectionProvider is ephemeral (Tier 3)
- [ ] No credentials in SQLite
- [ ] All nine views render
- [ ] Performance thresholds met

---

**Remember: TDD is not optional. Every feature starts with a failing test.**

Go build something excellent.
