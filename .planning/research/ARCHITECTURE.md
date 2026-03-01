# Architecture Research

**Domain:** ETL Import/Export pipeline integrated with existing Worker Bridge architecture (Isometry v5 — v1.1 milestone)
**Researched:** 2026-03-01
**Confidence:** HIGH — derived directly from canonical specs (`DataExplorer.md`, `WorkerBridge.md`) and the actual v1.0 codebase (`protocol.ts`, `schema.sql`, handler pattern)

> **Note:** This document supersedes the v1.0 ARCHITECTURE.md for the v1.1 milestone. The v1.0 document (covering WorkerBridge, Providers, MutationManager, D3 Views) remains valid for context — those components are not modified by ETL work. This document covers only new components and the integration points with existing v1.0 architecture.

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Main Thread                                     │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  D3.js Views │  │  Providers   │  │  UI / Events │  │  WorkerBridge    │ │
│  │  (rendering) │  │  (SQL state) │  │  (file drop) │  │  (typed proxy)   │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────┬─────────┘ │
│                                                                  │          │
│               postMessage (structured clone / transferable)      │          │
│                                                                  ▼          │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
┌──────────────────────────────────────────────────────────────────┼──────────┐
│                              Web Worker                          │          │
│                                                                  ▼          │
│                    ┌───────────────────────────────────────────────┐        │
│                    │          Message Router (worker.ts)            │        │
│                    │   switch on WorkerRequestType — exhaustive     │        │
│                    └─────────────────┬─────────────────────────────┘        │
│          ┌──────────────────┬────────┘────────────────┐                     │
│          ▼                  ▼                          ▼                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────────────────┐  │
│  │  Existing CRUD   │  │  Graph Handlers  │  │   ETL Handlers (NEW)      │  │
│  │  (cards, conn,   │  │  (graph.handler, │  │  etl-import.handler.ts    │  │
│  │   search, ui-    │  │   simulate)      │  │  etl-export.handler.ts    │  │
│  │   state, export) │  └──────────────────┘  └─────────────┬─────────────┘  │
│  └──────────────────┘                                       │                │
│                                                             ▼                │
│                                              ┌───────────────────────────┐   │
│                                              │   src/etl/ (NEW)          │   │
│                                              │  ImportOrchestrator       │   │
│                                              │  ExportOrchestrator       │   │
│                                              │  DedupEngine              │   │
│                                              │  SQLiteWriter             │   │
│                                              │  CatalogWriter            │   │
│                                              │  parsers/ (6 parsers)     │   │
│                                              └─────────────┬─────────────┘   │
│                                                            │                 │
│          ┌─────────────────────────────────────────────────┘                 │
│          ▼                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      sql.js Database (WASM)                            │  │
│  │  cards (source/source_id already present)  connections                 │  │
│  │  cards_fts (FTS triggers handle ETL writes automatically)              │  │
│  │  ui_state   import_history (NEW)   sources (NEW)                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

**Key architectural fact:** The ETL pipeline runs **entirely inside the Web Worker**. Raw file data (ArrayBuffer or string) is sent from the main thread as a structured clone. All parsing, deduplication, batch inserts, and catalog updates execute within the single Worker process. The main thread receives only a compact `ImportResult` summary.

---

## Component Responsibilities

| Component | Location | Responsibility | Status |
|-----------|----------|----------------|--------|
| `WorkerBridge` | Main thread | `importFile()` and `exportFile()` typed methods | **Modified** |
| `protocol.ts` | Shared | `etl:import` and `etl:export` in `WorkerRequestType`, payloads, responses | **Modified** |
| `worker.ts` router | Worker | Two new `case` branches for ETL types | **Modified** |
| `schema.sql` | Worker init | Add `import_history` and `sources` tables | **Modified** |
| `etl-import.handler.ts` | Worker handlers | Thin delegation to `ImportOrchestrator` | **New** |
| `etl-export.handler.ts` | Worker handlers | Thin delegation to `ExportOrchestrator` | **New** |
| `src/etl/types.ts` | ETL subsystem | `CanonicalCard`, `CanonicalConnection`, `ImportResult`, source union | **New** |
| `ImportOrchestrator` | ETL subsystem | Coordinates parse → dedup → write → catalog pipeline | **New** |
| `ExportOrchestrator` | ETL subsystem | Queries cards, formats output, returns string | **New** |
| `DedupEngine` | ETL subsystem | Queries `source+source_id` pairs; classifies insert/update/skip | **New** |
| `SQLiteWriter` | ETL subsystem | Batched INSERT/UPDATE via prepared statements in transactions | **New** |
| `CatalogWriter` | ETL subsystem | Writes to `import_history` and `sources` after each run | **New** |
| `AppleNotesParser` | ETL parsers | `AltoExport` → `CanonicalCard[]` + `CanonicalConnection[]` | **New** |
| `MarkdownParser` | ETL parsers | `.md` + frontmatter → `CanonicalCard[]` | **New** |
| `ExcelParser` | ETL parsers | XLSX ArrayBuffer → `CanonicalCard[]` | **New** |
| `CSVParser` | ETL parsers | CSV string → `CanonicalCard[]` | **New** |
| `JSONParser` | ETL parsers | JSON object/array → `CanonicalCard[]` | **New** |
| `HTMLParser` | ETL parsers | HTML string → `CanonicalCard` | **New** |

**Unchanged components:** All existing handlers (`cards`, `connections`, `search`, `graph`, `simulate`, `ui-state`, `export`). All providers, MutationManager, D3 views.

---

## Recommended Project Structure

```
src/
├── worker/
│   ├── worker.ts               # Modified: add case 'etl:import', case 'etl:export'
│   ├── WorkerBridge.ts         # Modified: add importFile(), exportFile() public methods
│   ├── protocol.ts             # Modified: add ETL types to WorkerRequestType union
│   └── handlers/
│       ├── cards.handler.ts        # Existing — unchanged
│       ├── connections.handler.ts  # Existing — unchanged
│       ├── search.handler.ts       # Existing — unchanged
│       ├── graph.handler.ts        # Existing — unchanged
│       ├── simulate.handler.ts     # Existing — unchanged
│       ├── ui-state.handler.ts     # Existing — unchanged
│       ├── export.handler.ts       # Existing (db:export) — unchanged
│       ├── etl-import.handler.ts   # New: delegates to ImportOrchestrator
│       └── etl-export.handler.ts   # New: delegates to ExportOrchestrator
│
├── etl/                        # New top-level ETL subsystem
│   ├── types.ts                # CanonicalCard, CanonicalConnection, ImportResult
│   ├── ImportOrchestrator.ts   # Coordinates parse → dedup → write → catalog
│   ├── ExportOrchestrator.ts   # Queries + formats data for export
│   ├── DedupEngine.ts          # source+source_id lookup, insert/update/skip split
│   ├── SQLiteWriter.ts         # Batched writes using db.prepare() + transactions
│   ├── CatalogWriter.ts        # Writes import_history, sources rows
│   └── parsers/
│       ├── AppleNotesParser.ts # AltoExport → CanonicalCard[] + CanonicalConnection[]
│       ├── MarkdownParser.ts   # .md + gray-matter → CanonicalCard[]
│       ├── ExcelParser.ts      # XLSX ArrayBuffer → CanonicalCard[] (xlsx lib)
│       ├── CSVParser.ts        # CSV string → CanonicalCard[] (papaparse or manual)
│       ├── JSONParser.ts       # JSON object/array → CanonicalCard[]
│       └── HTMLParser.ts       # HTML string → CanonicalCard
│
└── database/
    └── schema.sql              # Modified: add import_history, sources tables
```

### Structure Rationale

- **`src/etl/` as a top-level directory** mirrors the existing `src/providers/`, `src/mutations/`, `src/views/` pattern — each major subsystem has its own directory. ETL is coherent enough to warrant this treatment.
- **`src/etl/parsers/`** isolates source-specific transformation logic. Each parser is independently testable with no Worker or sql.js dependency — they are pure functions that receive data and return `CanonicalCard[]`.
- **Handler files stay in `src/worker/handlers/`** — the ETL handlers follow the established handler pattern: `export function handleETLImport(db: Database, payload): Promise<WorkerResponses['etl:import']>`. They are thin delegation shells.
- **`src/etl/types.ts`** defines ETL types separately from `protocol.ts` worker types so parsers, dedup engine, and writer do not have to import worker-specific machinery.

---

## Architectural Patterns

### Pattern 1: ETL Entirely in Worker — Parsers Receive Data, Not File Handles

**What:** All parsing, deduplication, and writing happens inside the Web Worker. The main thread reads the file (as ArrayBuffer or string) and sends it as the `etl:import` message payload. Parsers never access the DOM or the file system — they operate on raw data.

**When to use:** Always — this is the locked architecture. Parsers that touch `document`, `window.fetch()`, or any browser API that does not exist in Worker scope will throw at runtime.

**Trade-offs:** Large file parsing (a 50MB Excel file) holds the Worker busy during the parse phase, blocking other pending bridge requests. This is acceptable in v1.1 because imports are user-initiated, infrequent operations. If import latency becomes a problem at scale, the parse stage can be moved to the main thread with only the DB write phase going through the bridge — but that is a v1.2 optimization, not a v1.1 concern.

**Example:**

```typescript
// Main thread — WorkerBridge.ts (modified)
async importFile(
  data: ArrayBuffer | string,
  source: 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html',
  options?: Record<string, unknown>
): Promise<ImportResult> {
  return this.send('etl:import', { data, source, options });
  // For ArrayBuffer: pass in transfer list for zero-copy:
  // this.worker.postMessage(msg, [data as ArrayBuffer]);
}

// Worker — etl-import.handler.ts (new)
export async function handleETLImport(
  db: Database,
  payload: WorkerPayloads['etl:import']
): Promise<WorkerResponses['etl:import']> {
  const orchestrator = new ImportOrchestrator(db);
  return orchestrator.import(payload.data, payload.source, payload.options);
}
```

### Pattern 2: ETL Components Receive Database Directly — Not Through the Bridge

**What:** Inside the Worker, `DedupEngine`, `SQLiteWriter`, `CatalogWriter`, and orchestrators receive the `Database` object directly from the handler. They call `db.prepare()` / `db.run()` / `stmt.step()` directly. They do **not** call `workerBridge.query()`.

**Why this matters:** The `DataExplorer.md` spec shows `DedupEngine(this.bridge)` and `this.bridge.query()` — this is an abstraction in the spec document. In the actual implementation, `bridge` is a main-thread concept. Code running inside the Worker uses the `Database` instance directly, exactly as all existing handler files do (see `cards.handler.ts`, `graph.handler.ts`).

**Example:**

```typescript
// src/etl/DedupEngine.ts
export class DedupEngine {
  constructor(private db: Database) {}

  process(cards: CanonicalCard[], connections: CanonicalConnection[]): DedupResult {
    // Direct db.prepare() — no bridge, no postMessage
    const stmt = this.db.prepare(`
      SELECT id, source, source_id, modified_at FROM cards
      WHERE source IS NOT NULL AND source_id IS NOT NULL
    `);
    const existing = new Map<string, { id: string; modified_at: string }>();
    while (stmt.step()) {
      const row = stmt.getAsObject() as { id: string; source: string; source_id: string; modified_at: string };
      existing.set(`${row.source}:${row.source_id}`, { id: row.id, modified_at: row.modified_at });
    }
    stmt.free();
    // ... classify toInsert / toUpdate / toSkip
  }
}
```

### Pattern 3: SQLiteWriter Uses Prepared Statements + Transactions — FTS Triggers Fire Automatically

**What:** `SQLiteWriter.writeCards()` prepares a single INSERT statement once, then runs it in batches of 100 cards wrapped in explicit `BEGIN`/`COMMIT` transactions. It does **not** manually update `cards_fts` — the three-trigger FTS sync (`cards_fts_ai`, `cards_fts_ad`, `cards_fts_au` in `schema.sql`) handles this automatically for every `INSERT INTO cards` statement, regardless of whether it comes from a CRUD handler or an ETL batch.

**Why prepared statements matter:** Calling `db.run(sql, params)` re-parses the SQL string on every invocation. Calling `stmt.run(params)` on a `db.prepare()`-ed statement skips parsing on every subsequent call. For 1,000+ card batches this makes a measurable difference.

**Example:**

```typescript
// src/etl/SQLiteWriter.ts
export class SQLiteWriter {
  constructor(private db: Database) {}

  writeCards(cards: CanonicalCard[]): void {
    if (!cards.length) return;
    const BATCH = 100;

    // Prepare once outside the loop — avoids re-parsing on every card
    const stmt = this.db.prepare(`
      INSERT INTO cards (
        id, card_type, name, content, summary,
        latitude, longitude, location_name,
        created_at, modified_at, due_at, completed_at, event_start, event_end,
        folder, tags, status, priority, sort_order,
        url, mime_type, is_collective, source, source_id, source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      for (let i = 0; i < cards.length; i += BATCH) {
        const batch = cards.slice(i, i + BATCH);
        this.db.run('BEGIN');
        try {
          for (const card of batch) {
            stmt.run([
              card.id, card.card_type, card.name, card.content, card.summary,
              card.latitude, card.longitude, card.location_name,
              card.created_at, card.modified_at, card.due_at, card.completed_at,
              card.event_start, card.event_end,
              card.folder, JSON.stringify(card.tags), card.status,
              card.priority, card.sort_order,
              card.url, card.mime_type, card.is_collective ? 1 : 0,
              card.source, card.source_id, card.source_url
            ]);
            // FTS triggers (cards_fts_ai) fire here automatically — no manual FTS write
          }
          this.db.run('COMMIT');
        } catch (e) {
          this.db.run('ROLLBACK');
          throw e;
        }
      }
    } finally {
      stmt.free(); // Mandatory — prevents WASM heap leak
    }
  }
}
```

### Pattern 4: Progress Reporting Within the Existing Request-Response Protocol

**What:** The current WorkerBridge protocol is strictly request-response — one correlation ID, one response. There is no streaming notification channel. For v1.1, use a simple approach: accept that the main thread receives no granular progress during an import. Show a spinner. The bridge's configurable timeout (`WorkerBridgeConfig.timeout`) can be extended for import operations.

**For v1.2+ if progress streaming is needed:** Add an unsolicited `WorkerNotification` message type to the `WorkerMessage` union in `protocol.ts`. The main thread registers an `onnotification` callback on the bridge. The Worker posts `{ type: 'etl:progress', data: { current: number, total: number } }` messages during the import loop. This is additive and non-breaking to the existing protocol — it does not affect the correlation ID system.

**v1.1 practical approach:**

```typescript
// WorkerBridge.ts — importFile with extended timeout
async importFile(
  data: ArrayBuffer | string,
  source: SourceType,
  options?: Record<string, unknown>
): Promise<ImportResult> {
  // Import operations get 5 minutes max — override the 30s default
  return this.send('etl:import', { data, source, options }, { timeout: 300_000 });
}
```

---

## Data Flow

### Import Path

```
User drops/selects file (main thread)
    │
    ▼
WorkerBridge.importFile(data, 'apple_notes')
    │
    │  postMessage({ id: uuid, type: 'etl:import', payload })
    │  ArrayBuffer transferred (zero-copy) not cloned
    ▼
worker.ts: case 'etl:import': handleETLImport(db, payload)
    │
    ▼
ImportOrchestrator.import(data, source, options)
    │
    ├── 1. Select parser by source key
    │       AppleNotesParser.parse(json) → { cards[], connections[] }
    │
    ├── 2. DedupEngine.process(cards, connections)
    │       db.prepare("SELECT id, source, source_id, modified_at FROM cards ...")
    │       Classify each card: toInsert / toUpdate / toSkip
    │       Build sourceIdMap (source_id → canonical card id) for connection resolution
    │       Resolve connection IDs using sourceIdMap
    │
    ├── 3. SQLiteWriter.writeCards(dedupResult.toInsert)
    │       BEGIN; stmt.run([...]) × BATCH; COMMIT
    │       FTS triggers (cards_fts_ai) fire for every INSERT automatically
    │
    ├── 4. SQLiteWriter.updateCards(dedupResult.toUpdate)
    │       BEGIN; UPDATE cards SET ... WHERE id = ?; COMMIT
    │       FTS triggers (cards_fts_au) fire for every UPDATE automatically
    │
    ├── 5. SQLiteWriter.writeConnections(dedupResult.connections)
    │       INSERT OR IGNORE INTO connections — UNIQUE constraint handles duplicates
    │
    └── 6. CatalogWriter.recordImport(source, filename, result)
            INSERT INTO import_history (id, source, filename, cards_inserted, ...)
            Result: ImportResult { inserted, updated, skipped, connections, errors }

postMessage({ id: uuid, success: true, data: ImportResult })
    │
    ▼
WorkerBridge resolves pending promise
Main thread receives ImportResult — triggers view refresh via existing provider cycle
```

### Export Path

```
User requests export (main thread)
    │
    ▼
WorkerBridge.exportFile('json', optionalCardIds)
    │
    │  postMessage({ id: uuid, type: 'etl:export', payload })
    ▼
worker.ts: case 'etl:export': handleETLExport(db, payload)
    │
    ▼
ExportOrchestrator.export(format, cardIds?)
    │
    ├── db.prepare("SELECT * FROM cards WHERE deleted_at IS NULL [AND id IN (?,...)]")
    │   while (stmt.step()) collect rows
    │   stmt.free()
    │
    └── switch format:
          'markdown' → toMarkdown(rows) → string with YAML frontmatter
          'json'     → JSON.stringify(rows, null, 2) → string
          'csv'      → header row + data rows → string

postMessage({ id: uuid, success: true, data: formattedString })
    │
    ▼
WorkerBridge resolves → caller receives formatted string for download/save
```

### FTS Sync During Import

```
SQLiteWriter.writeCards() → db.run('BEGIN')
    │
    ├── stmt.run([card fields...])  ← INSERT INTO cards
    │       │
    │       └── cards_fts_ai trigger fires automatically:
    │               INSERT INTO cards_fts(rowid, name, content, folder, tags)
    │               VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags)
    │
    ├── stmt.run([card fields...])  ← INSERT INTO cards (second card)
    │       └── cards_fts_ai trigger fires again
    │
    ... (repeat for all 100 cards in batch)
    │
    └── db.run('COMMIT')  ← triggers and inserts all committed atomically
```

FTS consistency is guaranteed by the existing trigger infrastructure. If the transaction rolls back, the trigger-inserted FTS rows also roll back. No manual FTS management is required or desired.

---

## Protocol Changes

### Changes to `src/worker/protocol.ts`

**Add to `WorkerRequestType` union:**

```typescript
export type WorkerRequestType =
  // ... existing types (card:*, connection:*, search:*, graph:*, db:*, ui:*) ...
  // ETL (v1.1)
  | 'etl:import'
  | 'etl:export';
```

**Add to `WorkerPayloads`:**

```typescript
// ETL (v1.1)
'etl:import': {
  data: ArrayBuffer | string;
  source: 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html';
  options?: Record<string, unknown>;
};
'etl:export': {
  format: 'markdown' | 'json' | 'csv';
  cardIds?: string[];
};
```

**Add to `WorkerResponses`:**

```typescript
// ETL (v1.1)
'etl:import': ImportResult;  // { inserted, updated, skipped, connections, errors[] }
'etl:export': string;        // Formatted output string (Markdown / JSON / CSV)
```

**Import `ImportResult` from `src/etl/types.ts`** at the top of `protocol.ts`.

### Changes to `src/worker/WorkerBridge.ts`

Add two public methods to the `WorkerBridge` class:

```typescript
// ETL — v1.1
async importFile(
  data: ArrayBuffer | string,
  source: WorkerPayloads['etl:import']['source'],
  options?: Record<string, unknown>
): Promise<ImportResult> {
  return this.send('etl:import', { data, source, options });
}

async exportFile(
  format: WorkerPayloads['etl:export']['format'],
  cardIds?: string[]
): Promise<string> {
  return this.send('etl:export', { format, cardIds });
}
```

---

## Schema Changes

### Changes to `src/database/schema.sql`

The existing `cards` table already includes `source TEXT`, `source_id TEXT`, `source_url TEXT` columns and `idx_cards_source UNIQUE INDEX` — **no changes needed to the cards table**.

Add at the end of `schema.sql`:

```sql
-- ============================================================
-- Data Catalog (ETL provenance — v1.1)
-- ============================================================

-- Import run history
CREATE TABLE import_history (
  id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  filename TEXT,
  imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  cards_inserted INTEGER NOT NULL DEFAULT 0,
  cards_updated INTEGER NOT NULL DEFAULT 0,
  cards_skipped INTEGER NOT NULL DEFAULT 0,
  connections_created INTEGER NOT NULL DEFAULT 0,
  errors TEXT  -- JSON array of error strings; NULL if clean run
);

-- Source registry (for future re-import scheduling)
CREATE TABLE sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,  -- 'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html'
  config TEXT,         -- JSON blob for source-specific options
  last_sync TEXT,
  enabled INTEGER NOT NULL DEFAULT 1
);
```

These tables do not interact with `cards_fts` and require no triggers. They are created in `initializeSchema()` alongside the existing tables.

---

## New vs. Modified Components Summary

| Component | File Path | Status | What Changes |
|-----------|-----------|--------|--------------|
| Worker protocol | `src/worker/protocol.ts` | **Modified** | Add `etl:import`, `etl:export` to union + payloads + responses |
| Worker router | `src/worker/worker.ts` | **Modified** | Add two `case` branches delegating to new handlers |
| WorkerBridge | `src/worker/WorkerBridge.ts` | **Modified** | Add `importFile()` and `exportFile()` public methods |
| Database schema | `src/database/schema.sql` | **Modified** | Add `import_history` and `sources` table definitions |
| ETL import handler | `src/worker/handlers/etl-import.handler.ts` | **New** | Thin: `new ImportOrchestrator(db).import(...)` |
| ETL export handler | `src/worker/handlers/etl-export.handler.ts` | **New** | Thin: `new ExportOrchestrator(db).export(...)` |
| ETL types | `src/etl/types.ts` | **New** | `CanonicalCard`, `CanonicalConnection`, `ImportResult`, source union |
| ImportOrchestrator | `src/etl/ImportOrchestrator.ts` | **New** | Coordinates full import pipeline |
| ExportOrchestrator | `src/etl/ExportOrchestrator.ts` | **New** | Query + format export pipeline |
| DedupEngine | `src/etl/DedupEngine.ts` | **New** | Source key lookup, insert/update/skip classification |
| SQLiteWriter | `src/etl/SQLiteWriter.ts` | **New** | Batched write with prepared statements + transactions |
| CatalogWriter | `src/etl/CatalogWriter.ts` | **New** | Write to `import_history` + `sources` |
| AppleNotesParser | `src/etl/parsers/AppleNotesParser.ts` | **New** | `AltoExport` → `CanonicalCard[]` + `CanonicalConnection[]` |
| MarkdownParser | `src/etl/parsers/MarkdownParser.ts` | **New** | `.md` + frontmatter → `CanonicalCard[]` |
| ExcelParser | `src/etl/parsers/ExcelParser.ts` | **New** | XLSX ArrayBuffer → `CanonicalCard[]` |
| CSVParser | `src/etl/parsers/CSVParser.ts` | **New** | CSV string → `CanonicalCard[]` |
| JSONParser | `src/etl/parsers/JSONParser.ts` | **New** | JSON → `CanonicalCard[]` |
| HTMLParser | `src/etl/parsers/HTMLParser.ts` | **New** | HTML → `CanonicalCard` |

---

## Suggested Build Order

The dependency DAG dictates a bottom-up sequence.

### Phase 8-A: Protocol + Schema (foundation — no business logic)

1. **`src/etl/types.ts`** — Define `CanonicalCard`, `CanonicalConnection`, `ImportResult`. No deps. All subsequent components import from here.
2. **`src/database/schema.sql`** — Add `import_history` and `sources` table definitions. Verify `initializeSchema()` in `worker.ts` creates them.
3. **`src/worker/protocol.ts`** — Add `etl:import` and `etl:export` to `WorkerRequestType`, `WorkerPayloads`, `WorkerResponses`. TypeScript validates all subsequent handler code against these types.

**Rationale:** All subsequent components depend on these type definitions. Making them compile-time verified first catches integration mismatches before any implementation exists.

### Phase 8-B: Infrastructure (Writer + Dedup — DB-touching, no parsers)

4. **`src/etl/SQLiteWriter.ts`** — Batched INSERT/UPDATE using `db.prepare()` + transaction pattern. Test with hand-crafted `CanonicalCard` objects — no parser needed.
5. **`src/etl/DedupEngine.ts`** — Queries `cards` table by `source + source_id`; classifies into insert/update/skip. Depends on `SQLiteWriter` interface but not its implementation.
6. **`src/etl/CatalogWriter.ts`** — Inserts into `import_history` + `sources`. Minimal complexity.

**Rationale:** These are independently testable with a seeded test database. No parser dependency — use hand-crafted `CanonicalCard` arrays. Establishing the write infrastructure first means parsers can be integration-tested end-to-end immediately when they are ready.

### Phase 8-C: Parsers (pure transforms — no DB, independently testable)

7. **`src/etl/parsers/AppleNotesParser.ts`** — Primary source; most complex (checklist → task cards, attachment → resource cards, mention → person cards, note links → connections). Build first because it has the most test cases and drives the `CanonicalConnection` design.
8. **`src/etl/parsers/MarkdownParser.ts`** — `gray-matter` frontmatter extraction. Simple, high-value parser.
9. **`src/etl/parsers/CSVParser.ts`** — Tabular → flat card array. Simplest parser. Good for validating the canonical mapping quickly.
10. **`src/etl/parsers/JSONParser.ts`** — Flexible schema detection with field name heuristics. Medium complexity.
11. **`src/etl/parsers/ExcelParser.ts`** — Wraps `xlsx` library; reads ArrayBuffer → rows → reuses column detection logic from CSVParser.
12. **`src/etl/parsers/HTMLParser.ts`** — Web clipping HTML → Markdown conversion. Most fragile; build last. Use pure-string regex conversion (no DOM APIs — Worker context).

**Rationale:** Parsers are pure functions. Each is testable with fixture files and zero DB interaction. All six can be developed concurrently by the same developer or in parallel sessions if time allows.

### Phase 8-D: Orchestrators + Handlers (pipeline assembly)

13. **`src/etl/ImportOrchestrator.ts`** — Assembles parser → dedup → writer → catalog pipeline. Depends on all Phase 8-B and 8-C components.
14. **`src/etl/ExportOrchestrator.ts`** — Assembles query → format pipeline. Only DB dependency.
15. **`src/worker/handlers/etl-import.handler.ts`** — Thin: `new ImportOrchestrator(db).import(payload.data, payload.source, payload.options)`.
16. **`src/worker/handlers/etl-export.handler.ts`** — Thin: `new ExportOrchestrator(db).export(payload.format, payload.cardIds)`.
17. **`src/worker/worker.ts`** — Add `case 'etl:import'` and `case 'etl:export'` to the existing router switch.
18. **`src/worker/WorkerBridge.ts`** — Add `importFile()` and `exportFile()` public methods.

### Phase 8-E: Integration Tests (end-to-end validation)

19. Worker bridge round-trip: `workerBridge.importFile(altoFixture, 'apple_notes')` → assert `inserted` count matches fixture note count.
20. FTS sync verification: post-import, `workerBridge.query("SELECT * FROM cards_fts WHERE cards_fts MATCH ?", ['query term'])` returns rows from the imported cards.
21. Dedup idempotency: import same file twice → second call returns `inserted: 0`, all rows as `skipped`.
22. Source tracking: imported cards have `source = 'apple_notes'` and `source_id` matching the original note id.
23. Export round-trip: import fixture → export as JSON → parse JSON → verify card count and field values.
24. Catalog verification: `import_history` row exists after import with correct counts.

---

## Anti-Patterns

### Anti-Pattern 1: Parsers That Use DOM or fetch()

**What people do:** Write `HTMLParser` using `document.createElement('div').innerHTML = html` or issue `fetch()` to resolve relative URLs inside a parser.

**Why it's wrong:** Parsers run in the Web Worker where `document` and `window` are not defined. This throws at runtime (not at compile time — the DOM TypeScript lib is in tsconfig but the runtime globals do not exist in a Worker).

**Do this instead:** Use pure-string HTML processing. The spec's `htmlToMarkdown()` method uses regex replacements — this works in a Worker. For production-quality HTML parsing, use a pure-JS library with zero DOM dependencies (e.g., `node-html-parser`) that compiles to ESM and runs in Worker context. Do not call `fetch()` inside parsers to resolve external resources.

### Anti-Pattern 2: Building ETL Components on Top of WorkerBridge

**What people do:** Write `DedupEngine` to accept a `WorkerBridge` and call `this.bridge.query()`, as shown in the simplified `DataExplorer.md` pseudocode.

**Why it's wrong:** `DedupEngine` runs inside the Worker. `WorkerBridge` is a main-thread class that wraps `postMessage`. Importing it into Worker code creates a circular dependency. Even if it somehow compiled, calling `workerBridge.query()` from inside the Worker would attempt to post a message to the Worker from within the Worker — which goes nowhere.

**Do this instead:** Pass `Database` directly. All ETL components (`DedupEngine`, `SQLiteWriter`, `CatalogWriter`, orchestrators) receive `db: Database` in their constructors. The `DataExplorer.md` spec's `this.bridge` is an abstraction for the document — in implementation it becomes `this.db`.

### Anti-Pattern 3: Manual FTS Updates During Bulk Import

**What people do:** Disable FTS triggers for batch insert performance, then run `INSERT INTO cards_fts ...` manually after all cards are written.

**Why it's wrong:** The three-trigger FTS sync in `schema.sql` is the canonical approach and has been tested across all v0.1 CRUD operations. Manual FTS management is fragile: it requires knowing exactly which fields to index, it duplicates logic from the triggers, and if the batch write throws mid-transaction and rolls back, manually written FTS entries in a separate transaction won't roll back with the cards. The triggers handle this correctly — a rolled-back transaction also rolls back trigger-side effects.

**Do this instead:** Let the triggers run. At 100-card batches with a transaction, FTS trigger overhead is measured in milliseconds per batch. The existing performance benchmarks validate this is within budget. If benchmarking shows trigger overhead is excessive at 10K+ cards, profile first — then decide.

### Anti-Pattern 4: Sending Imported Card Objects Back Through the Bridge

**What people do:** After an import, return the full `Card[]` array from the Worker as the `ImportResult` payload so the main thread can immediately update its D3 view without a separate query.

**Why it's wrong:** A large import (10K notes) serializes 10K card objects (each with `content` text) through structured clone — potentially 10–50MB of data crossing the bridge solely to update the view. The main thread already has a provider and view system that re-queries when state changes.

**Do this instead:** Return only `ImportResult` (5 numeric fields + an error array). After the import promise resolves, the main thread triggers a view refresh by invalidating the FilterProvider state or calling the view's existing `requery()` path. The existing D3 notification cycle handles this at no extra cost.

### Anti-Pattern 5: ETL Writes Through MutationManager or `db:exec` Message

**What people do:** Route import card writes through the existing `db:exec` message type or `MutationManager.exec()` to reuse the single-write-gate pattern.

**Why it's wrong:** `db:exec` is designed for single-card mutations with undo/redo support. Each call is a full bridge round-trip (postMessage + correlation ID). Importing 1,000 cards via `db:exec` sends 1,000 separate bridge messages — each with serialization and scheduling overhead, totaling 2–10 seconds before any sql.js execution. ETL imports are also not individually undoable — undo for an import means reverting the entire run via `import_history` record deletion, not individual command log entries.

**Do this instead:** Write directly via `db.prepare()` + transaction in `SQLiteWriter` inside the Worker. ETL writes are bulk operations, not interactive mutations. They bypass MutationManager intentionally.

### Anti-Pattern 6: Building DedupEngine Query With String Interpolation

**What people do:** Build the source key lookup query by interpolating source values into the SQL string: `` `WHERE source || ':' || source_id IN (${sourceKeys})` `` where `sourceKeys` is a joined string of values.

**Why it's wrong:** String interpolation into SQL is explicitly prohibited by the SQL safety rules (D-003). Even though these values come from parsed file data (not user input), the constraint is architectural — any string interpolation into SQL creates a class of vulnerability that must be detected and prevented categorically.

**Do this instead:** Use a single parameterized batch query with a fixed `?` for each expected source key, or query all source records for the given source type and filter in JavaScript. For large imports, the latter approach (load all existing `source+source_id` pairs for the source type once) is actually faster than a dynamic `IN (?, ?, ...)` with N parameters.

```typescript
// Load all existing source records for this source type once
const stmt = this.db.prepare(
  'SELECT id, source_id, modified_at FROM cards WHERE source = ?'
);
stmt.bind([sourceType]);
const existing = new Map<string, { id: string; modified_at: string }>();
while (stmt.step()) {
  const row = stmt.getAsObject() as { id: string; source_id: string; modified_at: string };
  existing.set(row.source_id, { id: row.id, modified_at: row.modified_at });
}
stmt.free();
```

---

## Integration Points with Existing v1.0 Architecture

### What ETL Touches (and How)

| Existing System | ETL Interaction | Mechanism |
|-----------------|-----------------|-----------|
| `cards` table | INSERT (new cards), UPDATE (changed cards) | SQLiteWriter via `db.prepare()` |
| `cards_fts` virtual table | Updated automatically by triggers on every INSERT/UPDATE to `cards` | ETL code never writes to `cards_fts` directly |
| `connections` table | INSERT OR IGNORE (new connections) | SQLiteWriter; UNIQUE constraint handles duplicates |
| `ui_state` table | Not touched | ETL does not affect provider or view state |
| `idx_cards_source` UNIQUE index | Enforces dedup at DB level — second safety net | DedupEngine pre-checks for meaningful counts; index catches anything missed |
| FTS5 triggers | Fire automatically on every `INSERT INTO cards` and `UPDATE ... cards` | ETL benefits from existing trigger infrastructure at zero additional cost |
| WorkerBridge timeout | Default 30s may be too short for large imports | Importfile() should use an extended per-call timeout |
| MutationManager | Not involved | ETL writes bypass undo/redo stack — bulk imports are not individually undoable |
| D3 views / Providers | Not directly touched | Existing notification cycle handles post-import refresh; view calls `requery()` after import resolves |

### What ETL Does NOT Touch

- No changes to `FilterProvider`, `PAFVProvider`, `SelectionProvider`, `DensityProvider`, `StateCoordinator`
- No changes to `MutationManager`
- No changes to any D3 view renderer
- No changes to `graph.handler.ts`, `simulate.handler.ts`, `search.handler.ts`
- No changes to the FTS trigger definitions (they work for ETL already)

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| < 1,000 cards | Blocking Worker import is acceptable; spinner UI sufficient |
| 1,000–10,000 cards | Batch size of 100 keeps transactions fast; prepared statement reuse critical |
| 10,000–50,000 cards | Worker blocked for 10–30s+; extended timeout required; evaluate progress notification protocol |
| 50,000+ cards | Streaming parser needed (avoids holding full dataset in Worker heap simultaneously); progress notification protocol required; consider chunked import with partial commits |

v1.1 targets Apple Notes imports (typically 100–5,000 notes) and Markdown vaults (typically 500–10,000 files). The blocking-import approach is correct for this scale.

---

## Sources

- `v5/Modules/DataExplorer.md` — ETL pipeline spec (HIGH confidence — canonical project spec)
- `v5/Modules/Core/WorkerBridge.md` — WorkerBridge protocol spec (HIGH confidence — canonical)
- `src/worker/protocol.ts` — Actual v1.0 protocol implementation (HIGH confidence — source code, confirmed `WorkerRequestType` union pattern)
- `src/database/schema.sql` — Actual v1.0 schema (HIGH confidence — source code, confirmed `source`, `source_id`, `source_url` already present with ETL dedup index)
- `src/worker/handlers/export.handler.ts` — Handler pattern reference (HIGH confidence — source code, shows `function handleDbExport(db: Database)` pattern)
- `.planning/PROJECT.md` — v1.1 milestone scope definition (HIGH confidence)
- `.planning/research/SUMMARY.md` — v1.0 architecture research context (HIGH confidence)

---

*Architecture research for: Isometry v5 ETL Importers/Exporters (v1.1 milestone)*
*Researched: 2026-03-01*
