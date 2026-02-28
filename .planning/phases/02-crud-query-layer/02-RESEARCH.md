# Phase 2: CRUD + Query Layer - Research

**Researched:** 2026-02-27
**Domain:** sql.js CRUD patterns, FTS5 search queries, recursive graph CTE, performance benchmarking with tinybench/Vitest
**Confidence:** HIGH — all critical API details verified against official sql.js docs, SQLite FTS5 docs, and tinybench source; one critical deviation from requirements discovered (p95 not in tinybench output)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CARD-01 | User can create a card with name and optional fields | `db.run()` with INSERT + UUID generation; `db.getRowsModified()` for confirmation |
| CARD-02 | User can retrieve a card by ID | `db.exec()` SELECT + row-to-object mapping helper; soft-delete filter (`WHERE deleted_at IS NULL`) in all non-admin queries |
| CARD-03 | User can update card fields (modified_at auto-updates) | UPDATE with `modified_at = strftime(...)` in SQL; UPDATE trigger pattern documented |
| CARD-04 | User can soft delete a card (deleted_at set, excluded from queries) | SET `deleted_at = strftime(...)` via UPDATE; partial indexes already in schema exclude deleted rows |
| CARD-05 | User can list cards with filters (folder, status, card_type, source) | Static WHERE clause per filter; no dynamic SQL needed for Phase 2; ALLOWED_FILTER_FIELDS from D-003 |
| CARD-06 | User can undelete a soft-deleted card | UPDATE SET `deleted_at = NULL`; requires querying without the `deleted_at IS NULL` guard |
| CONN-01 | User can create a connection between two cards with a label | INSERT into connections; FK constraint prevents invalid source_id/target_id |
| CONN-02 | User can retrieve outgoing, incoming, or bidirectional connections for a card | Three SQL variants per direction; idx_conn_source and idx_conn_target indexes already exist |
| CONN-03 | User can create a connection with via_card_id for rich relationship context | via_card_id is nullable in schema; same INSERT path with optional parameter |
| CONN-04 | User can delete a connection | DELETE by id; no soft-delete for connections (Phase 2 uses hard delete) |
| CONN-05 | Connections cascade-delete when referenced cards are hard-deleted | Already implemented by schema ON DELETE CASCADE; verified in Phase 1 DB-06 tests |
| SRCH-01 | User can search cards by text query with BM25-ranked results | FTS5 MATCH + ORDER BY rank (faster than ORDER BY bm25()); rowid join to cards |
| SRCH-02 | Search uses rowid joins (never id joins) per D-004 | Architectural decision — join on `c.rowid = fts.rowid`, never `c.id = fts.rowid` |
| SRCH-03 | Search returns snippets with highlighted match context | `snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32)` with column -1 for auto-select |
| SRCH-04 | Search completes in <100ms for 10K cards (3-word query) | FTS5 with existing indexes is capable; test with seeded 10K card dataset; LIMIT essential |
| PERF-01 | Card insert p95 <10ms (single card, existing db) | No transaction overhead; single `db.run()` INSERT; p95 measured via p99 from tinybench (see Open Questions) |
| PERF-02 | Bulk insert p95 <1s (1000 cards, single transaction) | `BEGIN`/`COMMIT` wrapping is essential; without transaction, 1000 inserts take 10-100x longer in sql.js |
| PERF-03 | FTS search p95 <100ms (10K cards, 3-word query) | FTS5 with ORDER BY rank + LIMIT; porter tokenizer handles stemming; test empirically |
| PERF-04 | Graph traversal p95 <500ms (10K cards, 50K connections, depth 3) | Recursive CTE with `UNION` (not `UNION ALL`) for cycle prevention; idx_conn_source/target already indexed |
</phase_requirements>

---

## Summary

Phase 2 builds directly on the Database.ts and schema.sql from Phase 1. The infrastructure (WASM, FTS5, triggers, indexes) is complete and verified at 38 passing tests. Phase 2's job is to write the query modules (`cards.ts`, `connections.ts`, `search.ts`, `graph.ts`) using TDD, then verify they meet performance thresholds on a 10K-card dataset.

The most important technical decision is the **prepared statement wrapper pattern**. The requirements explicitly mandate `stmt.free()` with a wrapper pattern for all query modules. sql.js statements that are not freed accumulate in the WASM heap and eventually lock tables. This pattern must be established in the first query module (cards.ts) so all subsequent modules copy it.

The second critical finding is the **tinybench p95 gap**: Vitest's bench API (via tinybench) exposes p75 and p99 but NOT p95. The requirements specify p95 thresholds. The planner must decide whether to use p99 as a conservative proxy (stricter than p95, so passing p99 implies passing p95), use `bench.tasks[0].result.samples` to compute p95 manually, or write a custom percentile test using `performance.now()` timing loops outside of tinybench. See Open Questions.

The third key finding is the **BM25 `rank` vs `bm25()` function distinction**. For FTS5 search queries with LIMIT clauses, `ORDER BY rank` is faster than `ORDER BY bm25(cards_fts)` because `rank` is pre-computed and avoids recalculation on every row during the sort. The canonical query pattern must use `ORDER BY rank`, not `ORDER BY bm25(cards_fts)`.

**Primary recommendation:** Establish the prepared statement try/finally wrapper in `cards.ts` first, wire up all card CRUD functions, then connections, then search (FTS5 + snippet), then graph traversal (recursive CTE), then the performance benchmark suite against a seeded 10K dataset.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js (existing, Phase 1) | 1.14.0 + custom FTS5 WASM | In-browser SQLite; all CRUD and FTS5 queries run through `Database.ts` | Locked decision. WASM is committed at `src/assets/sql-wasm-fts5.wasm`. No new dependencies needed for Phase 2 query modules. |
| TypeScript (existing) | 5.9.3 | Type-safe query modules with strict null checks | Locked. The `BindParams` type from sql.js covers all parameterized query patterns. |
| Vitest (existing) | 4.0.18 | TDD test runner + bench() for performance tests | Locked. `bench()` API available; p95 gap resolved in Open Questions. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tinybench | (vitest peer dep) | Powers Vitest bench() — provides p75/p99/p995 percentile stats | Used implicitly via Vitest bench(). p99 used as conservative p95 proxy. |

### No New Dependencies Needed

Phase 2 adds zero new npm packages. All CRUD, FTS5 search, and graph traversal operate on the `Database` class from Phase 1. UUID generation uses `crypto.randomUUID()` (available in Node 19+ and modern browsers).

**Installation:** None required. Phase 1 installed all dependencies.

---

## Architecture Patterns

### Recommended Project Structure (Phase 2 scope)

```
src/
├── database/
│   ├── schema.sql              # Already exists (Phase 1)
│   ├── Database.ts             # Already exists (Phase 1)
│   └── queries/                # NEW in Phase 2
│       ├── cards.ts            # CARD-01..06 (Wave 1)
│       ├── connections.ts      # CONN-01..05 (Wave 1)
│       ├── search.ts           # SRCH-01..04 (Wave 2)
│       └── graph.ts            # PERF-04, graph traversal (Wave 2)
tests/
├── database/
│   ├── Database.test.ts        # Phase 1 (unchanged)
│   ├── cards.test.ts           # NEW Wave 1
│   ├── connections.test.ts     # NEW Wave 1
│   ├── search.test.ts          # NEW Wave 2
│   ├── graph.test.ts           # NEW Wave 2
│   └── performance.bench.ts   # NEW Wave 3 (Vitest bench file)
```

### Pattern 1: Prepared Statement Wrapper (Mandatory — All Query Modules)

**What:** Every `db.prepare()` call must be freed after use. The pattern uses a try/finally block to guarantee `stmt.free()` runs even when errors occur. This prevents WASM heap growth and table locking.

**When to use:** Every time a query uses `db.prepare()`. For one-shot queries, prefer `db.exec()` or `db.run()` — they do not require manual free. Only use `db.prepare()` for performance-critical hot paths where repeated execution benefits from plan reuse.

**Source:** sql.js official documentation — Statement.free() ("Free the memory used by the statement")

```typescript
// Source: sql.js docs — Statement.free() pattern
import type { Database } from '../Database';

// Generic wrapper: prepare, execute, free
function withStatement<T>(
  db: Database,
  sql: string,
  fn: (stmt: ReturnType<typeof db.prepare>) => T
): T {
  const stmt = db.prepare(sql);
  try {
    return fn(stmt);
  } finally {
    stmt.free(); // Non-negotiable — always runs, even if fn throws
  }
}

// Usage example (read single card)
export function getCard(db: Database, id: string): Card | null {
  return withStatement(
    db,
    'SELECT * FROM cards WHERE id = ? AND deleted_at IS NULL',
    (stmt) => {
      stmt.bind([id]);
      if (!stmt.step()) return null;
      return rowToCard(stmt.getAsObject());
    }
  );
}
```

**Alternative for one-shot queries:** Use `db.exec()` for SELECT returning all rows at once, or `db.run()` for mutating statements. Neither requires manual free.

```typescript
// One-shot SELECT — no prepare/free needed
export function listCards(db: Database, options: ListOptions): Card[] {
  const result = db.exec(
    'SELECT * FROM cards WHERE deleted_at IS NULL ORDER BY modified_at DESC LIMIT ?',
    [options.limit ?? 50]
  );
  return (result[0]?.values ?? []).map(rowToCard);
}
```

### Pattern 2: Row-to-Object Mapping

**What:** `db.exec()` returns `{ columns: string[], values: unknown[][] }[]`. `stmt.getAsObject()` returns `Record<string, SqlValue>`. Neither is a typed Card. A mapping function converts to the TypeScript interface.

**Source:** sql.js docs — exec return format; Contracts.md §1.3

```typescript
// Source: sql.js API docs — exec format + Contracts.md §1.3
import type { SqlValue } from 'sql.js';

function rowToCard(row: Record<string, SqlValue> | unknown[]): Card {
  // stmt.getAsObject() returns Record<string, SqlValue>
  // db.exec() returns unknown[] — zip with columns separately
  const r = row as Record<string, SqlValue>;
  return {
    id: r['id'] as string,
    card_type: r['card_type'] as CardType,
    name: r['name'] as string,
    content: (r['content'] as string | null) ?? null,
    summary: (r['summary'] as string | null) ?? null,
    // ... all 25 columns; tags is JSON-parsed
    tags: r['tags'] ? JSON.parse(r['tags'] as string) as string[] : [],
    is_collective: r['is_collective'] === 1,
    deleted_at: (r['deleted_at'] as string | null) ?? null,
    // ... other fields
  };
}

// For db.exec() output, zip columns with values:
function execRowsToCards(result: { columns: string[]; values: unknown[][] }[]): Card[] {
  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return rowToCard(obj as Record<string, SqlValue>);
  });
}
```

### Pattern 3: Card CRUD Functions

**What:** The four fundamental card operations. All use parameterized queries.

**Source:** CLAUDE-v5.md Phase 2 implementation guidance; Contracts.md §1.2; sql.js API docs

```typescript
// Source: CLAUDE-v5.md + Contracts.md §1.2 + sql.js API docs

// CARD-01: Create
export function createCard(db: Database, input: CardInput): Card {
  const id = crypto.randomUUID();
  const now = new Date().toISOString().replace('.000', ''); // Remove ms for SQLite TEXT
  db.run(
    `INSERT INTO cards (id, card_type, name, content, folder, tags, status, priority,
       source, source_id, created_at, modified_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.card_type ?? 'note',
      input.name,
      input.content ?? null,
      input.folder ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
      input.status ?? null,
      input.priority ?? 0,
      input.source ?? null,
      input.source_id ?? null,
      now,
      now,
    ]
  );
  // Retrieve the inserted card (ensures created_at/modified_at are exactly as stored)
  const card = getCard(db, id);
  if (!card) throw new Error(`Card insert failed: ${id}`);
  return card;
}

// CARD-03: Update (modified_at auto-updates)
export function updateCard(db: Database, id: string, updates: Partial<CardInput>): Card {
  const now = new Date().toISOString().replace('.000', '');
  // Build SET clause dynamically from allowed update fields
  // All column names are hardcoded (safe) — only values are parameterized
  const setClauses: string[] = ['modified_at = ?'];
  const params: unknown[] = [now];

  if (updates.name !== undefined) { setClauses.push('name = ?'); params.push(updates.name); }
  if (updates.content !== undefined) { setClauses.push('content = ?'); params.push(updates.content); }
  if (updates.folder !== undefined) { setClauses.push('folder = ?'); params.push(updates.folder); }
  if (updates.status !== undefined) { setClauses.push('status = ?'); params.push(updates.status); }
  if (updates.tags !== undefined) { setClauses.push('tags = ?'); params.push(JSON.stringify(updates.tags)); }
  // ... other updatable fields

  params.push(id); // WHERE clause param
  db.run(
    `UPDATE cards SET ${setClauses.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
    params as BindParams
  );
  const card = getCard(db, id);
  if (!card) throw new Error(`Card not found after update: ${id}`);
  return card;
}

// CARD-04: Soft delete
export function deleteCard(db: Database, id: string): void {
  const now = new Date().toISOString().replace('.000', '');
  db.run(`UPDATE cards SET deleted_at = ? WHERE id = ?`, [now, id]);
}

// CARD-06: Undelete
export function undeleteCard(db: Database, id: string): Card {
  db.run(`UPDATE cards SET deleted_at = NULL, modified_at = ? WHERE id = ?`,
    [new Date().toISOString().replace('.000', ''), id]);
  // Must query WITHOUT the deleted_at IS NULL guard:
  const result = db.exec(`SELECT * FROM cards WHERE id = ?`, [id]);
  if (!result[0]?.values[0]) throw new Error(`Card not found: ${id}`);
  return execRowsToCards(result)[0]!;
}
```

**Note on modified_at:** SQLite's DEFAULT only fires at INSERT time. For UPDATE, the column must be explicitly set in the UPDATE statement. Do NOT rely on a trigger for this — triggers add complexity and the explicit SET approach is clearer.

### Pattern 4: Connection Queries by Direction

**What:** CONN-02 requires outgoing, incoming, and bidirectional connection queries.

**Source:** Contracts.md §2.1; D-001 graph model; CLAUDE-v5.md Phase 2 guidance

```typescript
// Source: Contracts.md §2.1

export type ConnectionDirection = 'outgoing' | 'incoming' | 'bidirectional';

export function getConnections(
  db: Database,
  cardId: string,
  direction: ConnectionDirection = 'bidirectional'
): Connection[] {
  let sql: string;
  let params: unknown[];

  switch (direction) {
    case 'outgoing':
      sql = 'SELECT * FROM connections WHERE source_id = ? ORDER BY created_at DESC';
      params = [cardId];
      break;
    case 'incoming':
      sql = 'SELECT * FROM connections WHERE target_id = ? ORDER BY created_at DESC';
      params = [cardId];
      break;
    case 'bidirectional':
      sql = 'SELECT * FROM connections WHERE source_id = ? OR target_id = ? ORDER BY created_at DESC';
      params = [cardId, cardId];
      break;
  }

  const result = db.exec(sql, params);
  return execRowsToConnections(result);
}
```

### Pattern 5: FTS5 Search with BM25 Ranking and Snippets

**What:** SRCH-01, SRCH-02, SRCH-03 — full-text search with rowid join, ORDER BY rank (not bm25()), and snippet() for highlighted results.

**Source:** SQLite FTS5 official docs; D-004 (rowid join); Contracts.md §5.1

```typescript
// Source: SQLite FTS5 docs (https://sqlite.org/fts5.html) + D-004

export interface SearchResult {
  card: Card;
  rank: number;      // BM25 score (lower = better match in FTS5 convention)
  snippet: string;   // Highlighted excerpt
}

export function searchCards(
  db: Database,
  query: string,
  limit: number = 20
): SearchResult[] {
  if (!query.trim()) return [];

  // CRITICAL (SRCH-02): Join on rowid, never on id
  // CRITICAL (SRCH-01): ORDER BY rank, not ORDER BY bm25() — faster with LIMIT
  // snippet() params: table, column_index (-1=auto), open_mark, close_mark, ellipsis, max_tokens
  const result = db.exec(
    `SELECT c.*,
            rank,
            snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet_text
     FROM cards_fts
     JOIN cards c ON c.rowid = cards_fts.rowid
     WHERE cards_fts MATCH ?
       AND c.deleted_at IS NULL
     ORDER BY rank
     LIMIT ?`,
    [query, limit]
  );

  if (!result[0]) return [];

  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return {
      card: rowToCard(obj as Record<string, SqlValue>),
      rank: obj['rank'] as number,
      snippet: obj['snippet_text'] as string,
    };
  });
}
```

**BM25 score note:** FTS5 multiplies the BM25 score by -1, so lower (more negative) values indicate better matches. `ORDER BY rank` sorts best first (ascending = most negative first). This is intentional and consistent with SQLite's FTS5 design.

**snippet() note:** Column index `-1` tells SQLite to auto-select the column with the best match context. For Phase 2, this is the correct choice since we want the most relevant excerpt regardless of whether it came from `name`, `content`, `folder`, or `tags`.

### Pattern 6: Recursive CTE for Graph Traversal

**What:** PERF-04 — graph traversal to depth 3. Uses `WITH RECURSIVE` + `UNION` (not `UNION ALL`) for automatic cycle prevention.

**Source:** SQLite official docs — https://sqlite.org/lang_with.html; Recursive Common Table Expressions

```typescript
// Source: SQLite lang_with.html — recursive CTE graph traversal

export interface CardWithDepth {
  card: Card;
  depth: number;
}

export function connectedCards(
  db: Database,
  startId: string,
  maxDepth: number = 3
): CardWithDepth[] {
  // UNION (not UNION ALL) prevents revisiting the same node (cycle prevention)
  // Depth counter prevents infinite traversal on undirected cycles
  const result = db.exec(
    `WITH RECURSIVE traversal(card_id, depth) AS (
       -- Base case: start from the given card
       SELECT ?, 0
       UNION
       -- Recursive case: follow outgoing connections to unvisited nodes
       SELECT
         CASE
           WHEN c.source_id = t.card_id THEN c.target_id
           ELSE c.source_id
         END AS next_id,
         t.depth + 1
       FROM traversal t
       JOIN connections c ON c.source_id = t.card_id OR c.target_id = t.card_id
       WHERE t.depth < ?
     )
     SELECT DISTINCT cards.*, traversal.depth
     FROM traversal
     JOIN cards ON cards.id = traversal.card_id
     WHERE traversal.card_id != ?    -- Exclude the start card itself
       AND cards.deleted_at IS NULL
     ORDER BY traversal.depth, cards.name`,
    [startId, maxDepth, startId]
  );

  if (!result[0]) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    const depth = obj['depth'] as number;
    return { card: rowToCard(obj as Record<string, SqlValue>), depth };
  });
}
```

**Performance note:** At 10K cards and 50K connections, depth-3 traversal can touch a large subgraph. The `DISTINCT` and `WHERE traversal.card_id != ?` reduce result size. `idx_conn_source` and `idx_conn_target` (already created in Phase 1 schema) are used by the JOIN. The PERF-04 threshold of <500ms should be achievable with this indexed approach, but must be verified empirically.

### Pattern 7: Performance Benchmarks with Vitest bench()

**What:** PERF-01 through PERF-04 — p95 latency thresholds on a 10K-card dataset.

**Source:** Vitest bench API docs; tinybench percentile keys (`p75`, `p99`, `p995` — no `p95`)

```typescript
// Source: Vitest API Reference — bench() + tinybench result structure
// File: tests/database/performance.bench.ts

import { bench, describe } from 'vitest';
import { Database } from '../../src/database/Database';
import { createCard, getCard } from '../../src/database/queries/cards';
import { searchCards } from '../../src/database/queries/search';
import { connectedCards } from '../../src/database/queries/graph';

describe('Performance Benchmarks', () => {
  let db: Database;

  // Note: bench() does not have beforeEach — use module-level setup
  // Seed once before all benchmarks in the describe block

  // PERF-01: Single card insert p95 < 10ms
  // Note: tinybench provides p99, not p95. Threshold: p99 < 10ms (conservative proxy)
  bench('PERF-01: single card insert', () => {
    createCard(db, { name: `Card ${Math.random()}`, card_type: 'note' });
  }, { iterations: 100 });

  // PERF-02: Bulk 1000-card insert p95 < 1s
  bench('PERF-02: bulk 1000-card insert', () => {
    db.run('BEGIN');
    for (let i = 0; i < 1000; i++) {
      db.run(`INSERT INTO cards(id, name) VALUES(?, ?)`,
        [crypto.randomUUID(), `Bulk Card ${i}`]);
    }
    db.run('COMMIT');
  }, { iterations: 10 });

  // PERF-03: FTS search p95 < 100ms on 10K cards
  bench('PERF-03: FTS search 10K cards', () => {
    searchCards(db, 'knowledge management system', 20);
  }, { iterations: 100 });

  // PERF-04: Graph traversal depth 3 p95 < 500ms
  bench('PERF-04: graph traversal depth 3', () => {
    connectedCards(db, seedCardId, 3);
  }, { iterations: 20 });
});
```

**Manual p95 calculation** (alternative if tinybench p99 is too conservative):
```typescript
// Manual p95 from tinybench samples array
function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[idx] ?? 0;
}

// After bench.run(), access: bench.tasks[0].result.samples
```

### Anti-Patterns to Avoid

- **Joining FTS results on `id` instead of `rowid`:** `cards.id` is TEXT; `cards_fts.rowid` is INTEGER. The join `ON c.id = fts.rowid` produces a type mismatch — SQLite silently casts and produces wrong results. Always use `ON c.rowid = fts.rowid`.

- **Using `ORDER BY bm25(cards_fts)` with LIMIT:** SQLite FTS5 docs explicitly state that `ORDER BY rank` is faster than `ORDER BY bm25()` when LIMIT is applied or results are abandoned early. Use `rank` (the virtual column).

- **Un-freed prepared statements:** Every `db.prepare()` call that does not call `stmt.free()` leaks WASM heap memory and can cause table locks. The try/finally wrapper pattern is non-negotiable.

- **Soft-delete queries without `deleted_at IS NULL`:** FTS5 does not know about soft deletes. The `cards_fts_ad` trigger only fires for hard DELETE. A soft-deleted card remains in the FTS index. Always add `AND c.deleted_at IS NULL` to the JOIN condition in search queries.

- **Updating `modified_at` with a trigger:** SQLite UPDATE triggers add complexity. The explicit `SET modified_at = ?` in every UPDATE statement is cleaner, auditable, and testable.

- **Generating timestamps in JavaScript vs SQLite:** Using `new Date().toISOString()` in JavaScript produces milliseconds (`2026-02-27T10:00:00.000Z`). SQLite's `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` omits milliseconds. Be consistent — use JavaScript for explicit update timestamps to ensure test predictability; use SQLite DEFAULT for insert timestamps.

- **`UNION ALL` in recursive CTE:** Using `UNION ALL` instead of `UNION` allows the same node to appear multiple times in the traversal (cycles cause infinite recursion). Use `UNION` to deduplicate and naturally prevent cycles.

- **Bulk inserts without transactions:** In sql.js (in-memory SQLite), each `db.run()` call that is not in an explicit transaction auto-commits. 1000 separate auto-committed inserts can be 100x slower than 1000 inserts in a single `BEGIN`/`COMMIT` block.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Free-text search | LIKE '%query%' scan | FTS5 MATCH with `ORDER BY rank` | LIKE is O(n) with no ranking. FTS5 has BM25 ranking, stemming, snippets built in. LIKE won't meet the 100ms p95 threshold at 10K cards. |
| Prepared statement lifecycle | Custom ref-counting or LRU cache | `db.prepare()` + try/finally `stmt.free()` | sql.js is single-threaded WASM; there's no global statement cache. The try/finally pattern is the idiomatic sql.js solution. |
| Graph traversal | Custom BFS/DFS in JavaScript | `WITH RECURSIVE` CTE | JavaScript BFS would pull all connection rows to memory, then traverse. SQLite recursive CTE does graph traversal in the WASM process with index access, far faster for large graphs. |
| UUID generation | Custom random string | `crypto.randomUUID()` | Built into Node 19+ and all modern browsers. Collision-free RFC 4122 UUIDs. No package needed. |
| p95 from benchmark | Custom statistics library | `bench.tasks[0].result.samples` + sort | tinybench already collects all timing samples. p95 is one sort + index lookup. |
| Soft-delete filtering | Separate table for deleted items | `deleted_at IS NULL` WHERE clause + partial indexes | Partial indexes already exist in schema. Single-table approach with soft delete column is the established SQLite pattern. |

**Key insight:** Every "infrastructure" problem in Phase 2 has an existing solution in sql.js or SQLite. The query modules are thin wrappers that express SQL in TypeScript — not custom algorithm implementations.

---

## Common Pitfalls

### Pitfall 1: Soft-Deleted Cards Appearing in FTS5 Search

**What goes wrong:** A soft-deleted card (where `deleted_at` is set) still appears in FTS5 search results. The `cards_fts_ad` trigger only fires for hard DELETEs — soft deletes are UPDATE operations. The UPDATE trigger (`cards_fts_au`) only fires for changes to `name, content, folder, tags` — updating `deleted_at` does not trigger FTS sync.

**Why it happens:** The FTS5 external content table tracks rowid presence in the content table. A soft-deleted card still has a row in `cards` — the FTS index still returns it for matching queries.

**How to avoid:** Add `AND c.deleted_at IS NULL` to every FTS search JOIN, not to the FTS MATCH clause (which cannot filter by join conditions):
```sql
-- CORRECT: Filter on the JOIN target, not on FTS MATCH
SELECT c.*, rank, snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32)
FROM cards_fts
JOIN cards c ON c.rowid = cards_fts.rowid
WHERE cards_fts MATCH ?
  AND c.deleted_at IS NULL  -- This filters soft-deleted cards from results
ORDER BY rank
LIMIT ?;
```

**Warning signs:** Search returns cards that have been soft-deleted; `getCard()` returns null for a card that appears in search results.

### Pitfall 2: Prepared Statement Memory Leak

**What goes wrong:** Calling `db.prepare()` without `stmt.free()` leaks memory in the WASM heap. Over a long session with many queries, the heap grows until the tab crashes. Additionally, un-freed statements can cause "database table is locked" errors.

**Why it happens:** sql.js prepared statements are allocated in the WASM heap, not managed by JavaScript's GC. They must be explicitly freed.

**How to avoid:** The `withStatement()` wrapper from Pattern 1 guarantees free in try/finally. Alternative: prefer `db.exec()` and `db.run()` for one-shot queries — they do not require manual free.

**Warning signs:** Worker memory growing over long sessions; "database table is locked" errors; WASM heap memory growing in DevTools heap snapshots.

### Pitfall 3: `modified_at` Not Updating on Card Update

**What goes wrong:** `updateCard()` updates card fields but `modified_at` stays at the original insert time. Tests for CARD-03 fail because `modified_at` is not auto-updating.

**Why it happens:** SQLite `DEFAULT (strftime(...))` only runs at INSERT time. There is no automatic trigger for UPDATE. Unlike PostgreSQL, SQLite does not support column-level update defaults.

**How to avoid:** Explicitly include `modified_at = ?` with the current timestamp in every UPDATE statement:
```sql
UPDATE cards SET name = ?, modified_at = ? WHERE id = ? AND deleted_at IS NULL
```
Pass `new Date().toISOString().replace('.000', '')` as the timestamp value.

**Warning signs:** CARD-03 test `modified_at auto-updates` fails; cards show stale modification timestamps.

### Pitfall 4: UNIQUE Constraint on Connections with NULL via_card_id

**What goes wrong:** The connections UNIQUE constraint is `(source_id, target_id, via_card_id, label)`. SQLite treats NULL as distinct in UNIQUE constraints (SQL standard). Two connections between the same cards with the same label but both with `via_card_id = NULL` are treated as DISTINCT — the UNIQUE constraint does not fire.

**Why it happens:** This is correct SQL standard behavior documented in Phase 1: `[01-03]: UNIQUE constraint test uses non-NULL via_card_id -- SQLite treats NULL as distinct in UNIQUE constraints`. The UNIQUE constraint only prevents exact duplicates with non-NULL values.

**How to avoid:** This is expected behavior — document it, do not fight it. Connection deduplication for NULL via_card_id connections must be handled at the application layer if needed.

**Warning signs:** Duplicate connections with NULL via_card_id are allowed; tests expecting rejection of NULL-via_card_id duplicates will fail unless they use non-NULL values.

### Pitfall 5: Graph Traversal Cycles with UNION ALL

**What goes wrong:** Using `UNION ALL` instead of `UNION` in the recursive CTE allows the traversal to revisit the same node in each recursive step. In a graph with cycles (A → B → A), the traversal runs indefinitely (until `maxDepth` cuts it off but produces exponentially growing intermediate results).

**Why it happens:** `UNION ALL` does not deduplicate rows. Each recursive step can re-add previously visited nodes. `UNION` automatically deduplicates, preventing revisitation.

**How to avoid:** Always use `UNION` (not `UNION ALL`) in the recursive CTE for graph traversal. The deduplication is the cycle-prevention mechanism.

**Warning signs:** Graph traversal on cyclic data takes much longer than expected; result set contains duplicate card IDs; traversal appears to "hang" on a moderately connected graph.

### Pitfall 6: Performance Tests Without Dataset Seeding

**What goes wrong:** Performance benchmarks run against an empty or near-empty database. A 10ms insert test passes trivially on an empty db but may fail on a warmed 10K-card database where SQLite's B-tree pages are populated.

**Why it happens:** SQLite performance characteristics change at scale — B-tree splits, FTS index size, and connection table scan costs all increase with dataset size.

**How to avoid:** Seed the benchmark database with the required dataset BEFORE running any benchmark:
- PERF-01, PERF-02: Seed 10K existing cards before measuring insert latency
- PERF-03: Seed 10K cards with realistic content (500 char average) before FTS benchmarks
- PERF-04: Seed 10K cards + 50K connections before graph traversal benchmarks

Seeding should use a single `BEGIN`/`COMMIT` transaction for speed (not counted in benchmark time).

**Warning signs:** Benchmarks pass in isolation but fail in a CI environment with a larger dataset; performance thresholds seem easy to meet in development.

---

## Code Examples

Verified patterns from official sources:

### Card Type Interface (CardInput for creation)

```typescript
// Source: Contracts.md §1.2, §1.3 + CLAUDE-v5.md Phase 2
export interface CardInput {
  card_type?: CardType;
  name: string;
  content?: string | null;
  summary?: string | null;
  folder?: string | null;
  tags?: string[];
  status?: string | null;
  priority?: number;
  sort_order?: number;
  url?: string | null;
  mime_type?: string | null;
  is_collective?: boolean;
  source?: string | null;
  source_id?: string | null;
  source_url?: string | null;
  due_at?: string | null;
  completed_at?: string | null;
  event_start?: string | null;
  event_end?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
}
```

### FTS5 BM25 Search Query (Canonical)

```sql
-- Source: SQLite FTS5 docs + D-004 + SRCH-01, SRCH-02, SRCH-03
-- ORDER BY rank (not bm25()) — faster with LIMIT per official FTS5 docs
-- snippet() column -1 = auto-select best column
-- rowid join (SRCH-02: never id join)
SELECT c.*,
       rank,
       snippet(cards_fts, -1, '<mark>', '</mark>', '...', 32) AS snippet_text
FROM cards_fts
JOIN cards c ON c.rowid = cards_fts.rowid
WHERE cards_fts MATCH ?
  AND c.deleted_at IS NULL
ORDER BY rank
LIMIT ?;
```

### Bulk Insert with Transaction (PERF-02)

```typescript
// Source: SQLite transaction docs + sql.js README
export function bulkInsertCards(db: Database, inputs: CardInput[]): void {
  db.run('BEGIN');
  try {
    for (const input of inputs) {
      db.run(
        `INSERT INTO cards(id, card_type, name, content, folder, tags, status, priority,
           source, source_id, created_at, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          input.card_type ?? 'note',
          input.name,
          input.content ?? null,
          input.folder ?? null,
          input.tags ? JSON.stringify(input.tags) : null,
          input.status ?? null,
          input.priority ?? 0,
          input.source ?? null,
          input.source_id ?? null,
          new Date().toISOString().replace('.000', ''),
          new Date().toISOString().replace('.000', ''),
        ]
      );
    }
    db.run('COMMIT');
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}
```

### Connection Interface

```typescript
// Source: Contracts.md §2.2
export interface ConnectionInput {
  source_id: string;
  target_id: string;
  via_card_id?: string | null;
  label?: string | null;
  weight?: number;
}

// CONN-01: Create connection
export function createConnection(db: Database, input: ConnectionInput): Connection {
  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO connections(id, source_id, target_id, via_card_id, label, weight)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.source_id,
      input.target_id,
      input.via_card_id ?? null,
      input.label ?? null,
      input.weight ?? 1.0,
    ]
  );
  const result = db.exec(`SELECT * FROM connections WHERE id = ?`, [id]);
  return execRowsToConnections(result)[0]!;
}
```

### FTS Integrity Check After Mutations (from Phase 1, reuse in Phase 2 tests)

```typescript
// Source: SQLite FTS5 docs — integrity-check command
// Use in afterEach() or after mutation-heavy test batches in search.test.ts
function assertFtsIntegrity(db: Database): void {
  expect(() => {
    db.exec("INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')");
  }).not.toThrow();
}
```

### Performance Threshold Assertions Using p99

```typescript
// Source: tinybench result structure (verified via Node.js introspection)
// tinybench exposes: p75, p99, p995, p999 — NOT p95
// Using p99 as conservative proxy for p95 threshold

import { bench, afterAll } from 'vitest';

// After bench run, access result via task.result
// bench() in Vitest automatically reports p99 in the table output
// For custom assertion: bench.tasks[n].result.p99

// Alternative: manual p95 from samples array
function manualP95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, idx)] ?? 0;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FTS5 join on `id` | FTS5 join on `rowid` | D-004 decision (Phase 1 research) | rowid is INTEGER, id is TEXT — type-safe join required |
| `ORDER BY bm25(table)` for ranked FTS | `ORDER BY rank` virtual column | FTS5 v3.8.11 (SQLite) | rank is pre-computed; faster when LIMIT applied |
| `UNION ALL` in recursive CTE | `UNION` for graph traversal | SQLite recursive CTE best practices | UNION prevents cycles; UNION ALL causes exponential blowup on cyclic graphs |
| Auto-commit each INSERT | BEGIN/COMMIT transaction for bulk | Known sql.js performance pattern | 100x+ speedup for 1000+ row inserts |
| tinybench p95 (assumed) | tinybench p99 (actual) | Verified 2026-02-27 via Node.js introspection | tinybench does not expose p95 — use p99 or compute manually from samples |

**Deprecated/outdated:**
- `stmt.reset()` before `stmt.free()`: reset is optional if you're about to free; calling both is harmless but redundant.
- Using `db.exec()` for parameterized mutations: `db.exec()` does support a params argument in sql.js 1.x but `db.run()` is the idiomatic choice for mutations.

---

## Open Questions

1. **p95 threshold vs tinybench p99**
   - What we know: PERF-01..04 specify p95 thresholds. Tinybench (Vitest's bench engine) exposes `p75`, `p99`, `p995`, `p999` — but NOT `p95`. This was verified by introspecting `bench.tasks[0].result` in Node.js.
   - What's unclear: Whether to (A) use `p99` as a conservative proxy (if p99 < threshold, p95 definitely passes), (B) compute p95 manually from `bench.tasks[0].result.samples`, or (C) use a raw `performance.now()` timing loop outside of bench().
   - Recommendation: Use approach (A) — p99 as conservative proxy. If p99 < threshold, p95 necessarily passes. If p99 narrowly exceeds threshold, fall back to (B). The planner should document this substitution in the performance plan (02-05-PLAN.md).

2. **Dataset seeding strategy for performance benchmarks**
   - What we know: PERF-01..04 all require a pre-seeded 10K-card / 50K-connection dataset. This dataset must be created before the benchmarks run, not counted in benchmark time.
   - What's unclear: Whether seeding happens in a `beforeAll()` in the bench file, or whether a pre-built database dump is used. `beforeAll` is not available in `bench()` describe blocks in Vitest (bench uses its own lifecycle).
   - Recommendation: Use a module-level async IIFE to initialize the database and seed it before the bench describe block. The seed operation itself (in a single transaction) should complete in well under 10 seconds for 10K cards.

3. **`modified_at` update trigger vs explicit SET**
   - What we know: CARD-03 requires modified_at to auto-update. There are two approaches: (A) SQLite UPDATE trigger that fires on `cards` and updates `modified_at`, (B) explicit `SET modified_at = ?` in every UPDATE SQL.
   - What's unclear: Whether a trigger approach would be cleaner for the FTS sync behavior (since the FTS update trigger already handles the paired delete/insert).
   - Recommendation: Use explicit SET (approach B). It is visible in the query, testable, and avoids trigger ordering complexity. The FTS triggers fire for `AFTER UPDATE OF name, content, folder, tags` — they are already separate from `modified_at` handling.

4. **CONN-05 cascade-delete verification scope**
   - What we know: CONN-05 (cascade delete) was already verified as passing in Phase 1 DB-06 tests. The schema `ON DELETE CASCADE` is in place.
   - What's unclear: Whether Phase 2 needs additional CONN-05 tests or can simply reference the Phase 1 verification.
   - Recommendation: Phase 2 should add integration-level tests that verify cascade behavior as part of the connection module — the Phase 1 tests were schema-level; Phase 2 tests should call `createCard()` and `deleteCard()` (from Phase 2 modules) and verify connection removal.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npm run test` (runs all .test.ts files) |
| Full suite command | `npm run test` (same — no separate bench run needed for TDD) |
| Bench run command | `npx vitest bench` (runs .bench.ts files) |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CARD-01 | Create card with name + optional fields, returns Card | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CARD-02 | Retrieve card by ID; returns null for missing; excludes soft-deleted | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CARD-03 | Update fields; modified_at changes; other fields unchanged | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CARD-04 | Soft delete sets deleted_at; card excluded from listCards | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CARD-05 | List with folder filter; status filter; card_type filter | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CARD-06 | Undelete clears deleted_at; card appears in subsequent listCards | unit | `npm run test -- cards.test.ts` | No — Wave 1 |
| CONN-01 | Create connection; verify it appears in getConnections | unit | `npm run test -- connections.test.ts` | No — Wave 1 |
| CONN-02 | Outgoing/incoming/bidirectional queries return correct sets | unit | `npm run test -- connections.test.ts` | No — Wave 1 |
| CONN-03 | Create connection with via_card_id; verify via_card_id in result | unit | `npm run test -- connections.test.ts` | No — Wave 1 |
| CONN-04 | Delete connection by id; verify gone from getConnections | unit | `npm run test -- connections.test.ts` | No — Wave 1 |
| CONN-05 | Hard-delete source card; cascade removes connection | integration | `npm run test -- connections.test.ts` | No — Wave 1 |
| SRCH-01 | Search returns BM25-ranked results; better matches come first | unit | `npm run test -- search.test.ts` | No — Wave 2 |
| SRCH-02 | Search query SQL uses rowid join (not id join) | unit | `npm run test -- search.test.ts` | No — Wave 2 |
| SRCH-03 | Search results include snippet with `<mark>` highlighting | unit | `npm run test -- search.test.ts` | No — Wave 2 |
| SRCH-04 | FTS search completes in <100ms on 10K cards | bench | `npx vitest bench` | No — Wave 3 |
| PERF-01 | Single card insert p95 <10ms on warmed 10K db | bench | `npx vitest bench` | No — Wave 3 |
| PERF-02 | Bulk 1000-card insert p95 <1s | bench | `npx vitest bench` | No — Wave 3 |
| PERF-03 | FTS search p95 <100ms (same as SRCH-04) | bench | `npx vitest bench` | No — Wave 3 |
| PERF-04 | Graph traversal depth 3 p95 <500ms on 10K/50K | bench | `npx vitest bench` | No — Wave 3 |

### Sampling Rate

- **Per task commit:** `npm run test` — runs all test files (excludes bench); should complete in <30 seconds
- **Per wave merge:** `npm run test && npx vitest bench` — includes performance validation
- **Phase gate:** Full suite green (`npm run test`) + bench thresholds pass before `/gsd:verify-work`

### Wave 0 Gaps

All test files are new — none exist yet. The test infrastructure (vitest.config.ts, globalSetup, pool: forks) is already in place from Phase 1. No new framework configuration is needed.

- [ ] `tests/database/cards.test.ts` — covers CARD-01..06 (Wave 1)
- [ ] `tests/database/connections.test.ts` — covers CONN-01..05 (Wave 1)
- [ ] `tests/database/search.test.ts` — covers SRCH-01..03 (Wave 2)
- [ ] `tests/database/graph.test.ts` — covers graph traversal (Wave 2)
- [ ] `tests/database/performance.bench.ts` — covers SRCH-04, PERF-01..04 (Wave 3)

*(No framework install needed — Vitest bench is part of existing vitest 4.0.18 installation)*

---

## Sources

### Primary (HIGH confidence)

- `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md` — D-001 through D-010, Phase 2 function signatures, anti-patterns
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md` — Card schema (25 columns), Connection schema, FTS5 schema, SQL safety rules
- `/Users/mshaler/Developer/Projects/Isometry/.planning/REQUIREMENTS.md` — CARD-01..06, CONN-01..05, SRCH-01..04, PERF-01..04 exact requirement text
- [sql.js Statement class docs](https://sql.js.org/documentation/Statement.html) — bind, step, getAsObject, free, reset method signatures
- [sql.js API docs](https://sql.js.org/documentation/api.js.html) — Database.run(), Database.exec() return format, Database.getRowsModified()
- [SQLite FTS5 Extension docs](https://sqlite.org/fts5.html) — bm25() sign convention, rank vs bm25() performance, snippet() signature (5 params, -1 for auto-select), highlight(), MATCH syntax
- [SQLite Recursive CTE docs](https://sqlite.org/lang_with.html) — WITH RECURSIVE pattern, UNION vs UNION ALL for cycle prevention, depth-limiting
- `/Users/mshaler/Developer/Projects/Isometry/.planning/research/PITFALLS.md` — Pitfall 5 (prepared statement leaks), relevant to CRUD query module design
- tinybench result structure — verified via Node.js `require('tinybench')` introspection in project environment; `p75`, `p99`, `p995`, `p999` confirmed; `p95` confirmed absent

### Secondary (MEDIUM confidence)

- [Vitest bench() API docs](https://vitest.dev/api/) — bench() function signature, options (iterations, time, warmupIterations), statistics list including p75, p99
- [SQLite FTS5 BM25 sign convention](https://sqlite.org/fts5.html) — lower (more negative) scores = better matches; confirmed consistent across multiple sources

### Tertiary (LOW confidence — flagged)

- Performance threshold estimates (PERF-01..04): Based on known SQLite in-browser performance characteristics and the p99 proxy approach. Must be empirically validated against the actual 10K/50K dataset in the benchmark suite. LOW confidence because actual performance is hardware- and browser-dependent.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Phase 1 stack is confirmed; no new packages needed; all APIs verified via official docs
- Architecture: HIGH — CRUD patterns, FTS5 query, recursive CTE all verified against official SQLite and sql.js docs
- Pitfalls: HIGH (prepared statements, soft-delete FTS, UNION vs UNION ALL) — all verified from official docs or Phase 1 project experience
- Performance: MEDIUM — thresholds are plausible based on SQLite characteristics but require empirical validation; tinybench p95 gap is confirmed and documented

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (90 days — sql.js 1.14.0 and Vitest 4.x are stable; SQLite FTS5 API is stable; performance characteristics may vary by hardware)
