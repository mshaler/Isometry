# Phase 8 Implementation Checklist: ETL Foundation + Apple Notes Parser

**Milestone:** v1.1 ETL Importers
**Phase:** 8 (ETL Foundation + Apple Notes Parser)
**Status:** Not started
**Goal:** Build the complete ETL import pipeline from raw data to searchable cards, validated end-to-end with Apple Notes as the primary source. All critical pitfall mitigations (OOM, SQL injection, buffer overflow, FTS overhead) active from day one.

**Requirements covered:** ETL-01, ETL-02, ETL-03, ETL-04, ETL-10, ETL-11, ETL-12, ETL-13, ETL-18

---

## 0. Preconditions

- [ ] Confirm v1.0 baseline is green:
  - `npm run typecheck`
  - `npm test`
- [ ] Confirm this phase stays scoped to ETL-01..04, ETL-10..13, ETL-18.
- [ ] Confirm `source`, `source_id`, `source_url` columns and `idx_cards_source` UNIQUE index already exist in `schema.sql`.

**Gate 0 (must pass before Task 1):**
- `npm run typecheck` exits 0
- `npm test` exits 0
- Schema columns verified present

---

## 1. Canonical Type Contract (ETL-01)

### Task 1.1: Define CanonicalCard and CanonicalConnection interfaces
- [ ] Create `src/etl/types.ts`.
- [ ] `CanonicalCard` maps 1:1 to `cards` table columns (id, card_type, name, content, summary, folder, tags, source, source_id, source_url, created_at, modified_at, plus all nullable columns: latitude, longitude, location_name, due_at, completed_at, event_start, event_end, status, priority, sort_order, url, mime_type, is_collective).
- [ ] `CanonicalConnection` maps 1:1 to `connections` table (id, source_id, target_id, label, via_card_id, weight).
- [ ] `ImportResult`: `{inserted: number, updated: number, skipped: number, connections: number, errors: ParseError[]}`.
- [ ] `ParseError`: `{index: number, source_id: string | null, message: string}`.
- [ ] `SourceType` union: `'apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html'`.
- [ ] `ParseOptions` type for parser configuration.
- [ ] `DedupResult`: `{toInsert: CanonicalCard[], toUpdate: CanonicalCard[], toSkip: string[], connections: CanonicalConnection[], sourceIdMap: Map<string, string>}`.

**Test gate:**
- [ ] Types compile in strict mode with no errors.
- [ ] Unit tests verify type structure (e.g., all required fields present on a valid CanonicalCard).

---

## 2. Data Catalog Schema (ETL-02)

### Task 2.1: Add import_history and sources tables to schema
- [ ] Append `import_history` and `sources` CREATE TABLE statements to `src/database/schema.sql`.
- [ ] `import_history`: id, source, filename, imported_at (default NOW), cards_inserted, cards_updated, cards_skipped, connections_created, errors (JSON TEXT).
- [ ] `sources`: id, name, type, config (JSON), last_sync, enabled (default 1).
- [ ] No changes to existing `cards`, `connections`, `cards_fts`, or `ui_state` tables.

**Test gate:**
- [ ] Database initialization creates both new tables without error.
- [ ] Existing schema tests remain green (no regression).
- [ ] Can INSERT and SELECT from both new tables.

---

## 3. Worker Protocol Extensions (ETL-03)

### Task 3.1: Add ETL types to protocol.ts
- [ ] Add `'etl:import'` and `'etl:export'` to `WorkerRequestType` union.
- [ ] Add `WorkerPayloads['etl:import']`: `{source: SourceType, data: string | ArrayBuffer, options?: ParseOptions}`.
- [ ] Add `WorkerPayloads['etl:export']`: `{format: 'markdown' | 'json' | 'csv', cardIds?: string[]}`.
- [ ] Add `WorkerResponses['etl:import']`: `ImportResult`.
- [ ] Add `WorkerResponses['etl:export']`: `{data: string, filename: string}`.
- [ ] Import `ImportResult`, `SourceType`, `ParseOptions` from `src/etl/types.ts`.

### Task 3.2: Add WorkerBridge public methods
- [ ] `importFile(data, source, options?)` → `Promise<ImportResult>` with 300s timeout.
- [ ] `exportFile(format, cardIds?)` → `Promise<{data: string, filename: string}>`.

**Test gate:**
- [ ] `npm run typecheck` passes with new protocol types.
- [ ] Exhaustive switch in `worker.ts` requires handling of new cases (compile error until handlers added — expected).

---

## 4. SQLite Writer (ETL-11)

### Task 4.1: Implement batched card inserts
- [ ] Create `src/etl/SQLiteWriter.ts` with constructor accepting `db: Database`.
- [ ] `writeCards(cards: CanonicalCard[])`: 100-card transaction batches using `db.prepare()` (P22, P23).
- [ ] Uses same `INSERT INTO cards (...)` column list as existing Card CRUD — FTS triggers fire automatically.
- [ ] `stmt.free()` in `finally` block — prevents WASM heap leak.

### Task 4.2: Implement card updates
- [ ] `updateCards(cards: CanonicalCard[])`: `UPDATE cards SET ... WHERE id = ?` in batches.
- [ ] FTS update trigger (`cards_fts_au`) fires automatically.

### Task 4.3: Implement connection inserts
- [ ] `writeConnections(connections: CanonicalConnection[])`: `INSERT OR IGNORE INTO connections (...)`.
- [ ] UNIQUE constraint handles duplicate connections silently.

### Task 4.4: Implement FTS bulk optimization (P24)
- [ ] For initial imports (>500 cards): disable FTS triggers → bulk insert → rebuild FTS via `INSERT INTO cards_fts SELECT ... FROM cards` → `OPTIMIZE` → restore triggers.
- [ ] For incremental re-imports: let triggers run normally (fast enough at <500 cards).

**Test gate:**
- [ ] Unit tests: insert 10 hand-crafted CanonicalCards, verify all in `cards` table.
- [ ] Unit tests: insert same 10 again via `updateCards`, verify modified fields changed.
- [ ] Unit tests: insert 5 connections, verify in `connections` table.
- [ ] Unit tests: FTS search returns inserted cards (triggers fired correctly).
- [ ] Unit tests: insert 600+ cards, verify FTS rebuild path executes without error.
- [ ] No concatenated VALUES strings — all writes via prepared statements (P23 verified by code review).

---

## 5. Dedup Engine (ETL-10)

### Task 5.1: Implement source-scoped existing card lookup
- [ ] Create `src/etl/DedupEngine.ts` with constructor accepting `db: Database`.
- [ ] Load all existing `{id, source_id, modified_at}` for the target source type via parameterized query: `SELECT id, source_id, modified_at FROM cards WHERE source = ?` (P25 — no string interpolation).
- [ ] Store in `Map<string, {id: string, modified_at: string}>` keyed by `source_id`.

### Task 5.2: Classify insert/update/skip
- [ ] `process(cards, connections)` → `DedupResult`.
- [ ] New `source_id` → toInsert (assign new UUID).
- [ ] Existing + newer `modified_at` → toUpdate (preserve existing UUID).
- [ ] Existing + same/older `modified_at` → toSkip.
- [ ] Build `sourceIdMap: Map<string, string>` (source_id → card UUID) for connection resolution.

### Task 5.3: Resolve connection references
- [ ] Connection `source_id` and `target_id` resolved via `sourceIdMap`.
- [ ] For unresolvable targets: check DB for existing cards with matching `source_id`; if not found, drop connection (not error).

**Test gate:**
- [ ] Unit tests: 5 new cards → all classified as `toInsert`.
- [ ] Unit tests: 5 existing cards with newer timestamps → all classified as `toUpdate`.
- [ ] Unit tests: 5 existing cards with same timestamps → all classified as `toSkip`.
- [ ] Unit tests: mixed batch (new + existing + stale) → correctly partitioned.
- [ ] Unit tests: connections with resolvable targets → kept; unresolvable → dropped.
- [ ] No SQL string interpolation anywhere in DedupEngine (P25 verified by code review).

---

## 6. Catalog Writer (ETL-13)

### Task 6.1: Implement source registration
- [ ] Create `src/etl/CatalogWriter.ts` with constructor accepting `db: Database`.
- [ ] `ensureSource(sourceType, name)`: upsert into `sources` table.

### Task 6.2: Implement import run recording
- [ ] `recordRun(source, filename, result: ImportResult)`: INSERT into `import_history` with all counts and `JSON.stringify(errors)`.
- [ ] Called after SQLiteWriter completes (not before).

**Test gate:**
- [ ] Unit tests: `ensureSource` creates new source; calling again with same type is idempotent.
- [ ] Unit tests: `recordRun` inserts row with correct counts; `errors_json` is valid JSON.

---

## 7. Apple Notes Parser (ETL-04)

### Task 7.1: Define alto-index input types
- [ ] Define `AltoExport`, `AltoNote`, `AltoAttachment`, `AltoChecklistItem`, `AltoMention`, `AltoLink` interfaces in parser file or `types.ts`.

### Task 7.2: Implement note → CanonicalCard mapping
- [ ] Each `AltoNote` → `CanonicalCard` with `card_type: 'note'`.
- [ ] `folder` via `normalizeFolder()` (strip `Notes/` prefix, preserve hierarchy).
- [ ] `tags` from `note.tags[]` + fallback `#hashtag` regex scan of content.
- [ ] `created_at` / `modified_at` from `note.created` / `note.modified`.
- [ ] Empty title fallback: first non-empty line of content (up to 100 chars).
- [ ] `source: 'apple_notes'`, `source_id: note.id`.

### Task 7.3: Implement checklist → event cards + connections
- [ ] Each checklist item → `CanonicalCard` with `card_type: 'event'`.
- [ ] `status: item.checked ? 'done' : 'todo'`.
- [ ] `CanonicalConnection` (label: `'contains'`) linking parent note → task.
- [ ] `sort_order` preserves checklist item index.

### Task 7.4: Implement @mentions → person cards + connections
- [ ] Each unique `AltoMention.name` → `CanonicalCard` with `card_type: 'person'`.
- [ ] Deduplicate by normalized name (case-insensitive) within the export.
- [ ] `CanonicalConnection` (label: `'mentions'`) linking note → person.

### Task 7.5: Implement note links → connections
- [ ] `AltoLink` with `type === 'note'` and valid `target_note_id` → `CanonicalConnection` (label: `'links_to'`).
- [ ] Null or missing `target_note_id` silently dropped.

### Task 7.6: Implement attachments → resource cards + connections
- [ ] Each `AltoAttachment` → `CanonicalCard` with `card_type: 'resource'`.
- [ ] `mime_type` preserved, `content: null` (no Base64 storage — P22 memory).
- [ ] `CanonicalConnection` (label: `'attachment'`) linking note → resource.

### Task 7.7: Implement per-record error isolation
- [ ] Each note parsed in try/catch; errors accumulated in `ParseError[]`.
- [ ] Malformed note does not abort entire parse.
- [ ] Empty `notes[]` array → `{cards: [], connections: []}` (not an error).

**Test gate:**
- [ ] Unit tests with fixture JSON: N notes → N note cards with correct fields.
- [ ] Unit tests: checklist items → event cards + contains connections.
- [ ] Unit tests: @mentions → deduplicated person cards + mentions connections.
- [ ] Unit tests: note links → links_to connections; null targets dropped.
- [ ] Unit tests: attachments → resource cards with mime_type, no Base64 content.
- [ ] Unit tests: empty title → first-line fallback.
- [ ] Unit tests: malformed note in middle of array → other notes still parsed; error in ParseError[].
- [ ] Unit tests: empty notes array → zero cards, zero connections, no error.
- [ ] Parser is a pure function — no DB, no Worker, no DOM dependency.

---

## 8. Import Orchestrator + Worker Handler (ETL-12, ETL-18)

### Task 8.1: Implement ImportOrchestrator pipeline
- [ ] Create `src/etl/ImportOrchestrator.ts` with constructor accepting `db: Database`.
- [ ] `import(data, source, options?)` → `ImportResult`.
- [ ] Dispatches to correct parser by `source` type.
- [ ] Calls `DedupEngine.process()` with parsed cards/connections.
- [ ] Calls `SQLiteWriter.writeCards()` / `updateCards()` / `writeConnections()`.
- [ ] Calls `CatalogWriter.recordRun()`.
- [ ] Per-record errors accumulated (not thrown); returned in `ImportResult.errors[]`.

### Task 8.2: Implement etl-import handler
- [ ] Create `src/worker/handlers/etl-import.handler.ts`.
- [ ] Thin delegation: `new ImportOrchestrator(db).import(payload.data, payload.source, payload.options)`.
- [ ] Follows existing handler pattern (receives `db: Database` directly).

### Task 8.3: Wire into Worker router
- [ ] Add `case 'etl:import'` to `worker.ts` switch — delegates to `handleETLImport`.
- [ ] Exhaustive switch maintained (typecheck enforced).

**Test gate:**
- [ ] Integration test: Apple Notes fixture → `importFile()` via WorkerBridge → verify `inserted` count matches fixture.
- [ ] Integration test: imported cards are FTS-searchable immediately after import.
- [ ] Integration test: `import_history` row exists with correct counts.
- [ ] Integration test: cards have `source = 'apple_notes'` and correct `source_id`.

---

## 9. End-to-End Verification

### Task 9.1: Dedup idempotency round-trip
- [ ] Import Apple Notes fixture → verify inserted count.
- [ ] Import same fixture again → verify `inserted === 0`, all as `skipped` or `updated`.

### Task 9.2: Connection integrity
- [ ] Import fixture with checklist items, @mentions, note links.
- [ ] Verify connections table has correct labels and valid source_id/target_id pairs.
- [ ] Verify no dangling connections (all targets exist in cards table).

### Task 9.3: Large import stress test (P22, P23, P24)
- [ ] Generate 1,000+ card fixture.
- [ ] Import completes without OOM or timeout.
- [ ] FTS search works on imported cards.
- [ ] Verify batched transaction pattern (not a single giant transaction).

### Task 9.4: Full test suite regression
- [ ] Full test suite green.
- [ ] Typecheck green.
- [ ] No existing v1.0 tests broken by ETL additions.

**Final gate (phase complete):**
- `npm run typecheck` exits 0
- `npm test` exits 0
- ETL-01, ETL-02, ETL-03, ETL-04, ETL-10, ETL-11, ETL-12, ETL-13, ETL-18 all verified
- No known P1 defects open for ETL import path
- Apple Notes import works end-to-end via WorkerBridge

---

## Deliverables Checklist

- [ ] `src/etl/types.ts`
- [ ] `src/etl/SQLiteWriter.ts`
- [ ] `src/etl/DedupEngine.ts`
- [ ] `src/etl/CatalogWriter.ts`
- [ ] `src/etl/ImportOrchestrator.ts`
- [ ] `src/etl/parsers/AppleNotesParser.ts`
- [ ] `src/worker/handlers/etl-import.handler.ts`
- [ ] `src/worker/protocol.ts` (modified — ETL types added)
- [ ] `src/worker/worker.ts` (modified — etl:import case added)
- [ ] `src/worker/WorkerBridge.ts` (modified — importFile() added)
- [ ] `src/database/schema.sql` (modified — catalog tables added)
- [ ] Test fixtures: Apple Notes JSON samples (small, large, edge cases)
- [ ] Unit tests for each new component
- [ ] Integration tests for end-to-end pipeline
- [ ] Updated docs in `.planning/` for traceability and verification

---

## Pitfall Mitigations Active in This Phase

| Pitfall | Mitigation | Verified By |
|---------|-----------|-------------|
| P22: WASM OOM on large imports | 100-card transaction batches in SQLiteWriter | Task 4.1 + Task 9.3 stress test |
| P23: Buffer overflow on large SQL | Prepared statements only, no concatenated VALUES | Task 4.1 code review + typecheck |
| P24: FTS trigger overhead | Trigger disable/rebuild for >500 card initial imports | Task 4.4 + Task 9.3 |
| P25: DedupEngine SQL injection | Parameterized `WHERE source = ?` query, in-memory Map | Task 5.1 code review |
| P30: Cross-batch connection resolution | DB lookup for unresolved targets, INSERT OR IGNORE | Task 5.3 + Task 9.2 |
