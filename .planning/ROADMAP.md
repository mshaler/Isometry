# Roadmap: Isometry v5

## Overview

Isometry v5 builds a local-first polymorphic data projection platform where sql.js (WASM with FTS5) serves as the single source of truth and D3.js data joins serve as state management — no framework, no parallel state store. The build is dependency-driven: database foundation first, then CRUD and query functions, then Worker Bridge, then Providers and Views. The web runtime ships as a complete unit.

## Milestones

- ✅ **v0.1 Data Foundation** — Phases 1-2 (shipped 2026-02-28)
- ✅ **v0.5 Providers + Views** — Phases 4-6 (shipped 2026-02-28)
- ✅ **v1.0 Web Runtime** — Phases 3, 7 (shipped 2026-03-01)
- 🚧 **v1.1 ETL Importers** — Phases 8-10 (active)

## Phases

<details>
<summary>✅ v0.1 Data Foundation (Phases 1-2) — SHIPPED 2026-02-28</summary>

- [x] Phase 1: Database Foundation (4/4 plans) — completed 2026-02-28
- [x] Phase 2: CRUD + Query Layer (6/6 plans) — completed 2026-02-28

See: `.planning/milestones/v0.1-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v0.5 Providers + Views (Phases 4-6) — SHIPPED 2026-02-28</summary>

- [x] Phase 4: Providers + MutationManager (7/7 plans) — completed 2026-02-28
- [x] Phase 5: Core D3 Views + Transitions (4/4 plans) — completed 2026-02-28
- [x] Phase 6: Time + Visual Views (3/3 plans) — completed 2026-02-28

See: `.planning/milestones/v0.5-ROADMAP.md` for full details.

</details>

<details>
<summary>✅ v1.0 Web Runtime (Phases 3, 7) — SHIPPED 2026-03-01</summary>

- [x] Phase 3: Worker Bridge (3/3 plans) — completed 2026-03-01
- [x] Phase 7: Graph Views + SuperGrid (4/4 plans) — completed 2026-03-01

See: `.planning/milestones/v1.0-ROADMAP.md` for full details.

</details>

### 🚧 v1.1 ETL Importers (Phases 8-10)

- [ ] **Phase 8: ETL Foundation + Apple Notes Parser** — Full pipeline, primary parser, all critical pitfall mitigations
- [ ] **Phase 9: Remaining Parsers + Export Pipeline** — Five remaining parsers and all three export formats
- [ ] **Phase 10: Progress Reporting + Polish** — Worker notifications, extended timeouts, FTS optimization

## Phase Details

### Phase 8: ETL Foundation + Apple Notes Parser

**Goal:** Users can import Apple Notes exports into the database with full graph extraction, idempotent re-import, and source provenance — with all critical safety mitigations active from the first commit.

**Depends on:** Phase 3 (Worker Bridge typed RPC, correlation IDs, handler pattern), Phase 1 (cards schema with source/source_id/source_url columns and FTS5 triggers)

**Requirements:** ETL-01, ETL-02, ETL-03, ETL-04, ETL-10, ETL-11, ETL-12, ETL-13, ETL-18

**Success Criteria** (what must be TRUE when this phase completes):

1. An Apple Notes alto-index/apple-notes-liberator JSON export is imported end-to-end: notes become `note` cards, checklist items become `event` cards with `contains` connections to their parent note, @mentions become deduplicated `person` cards with `mentions` connections, attachments become `resource` cards (metadata only, no Base64), and internal note links become `links_to` connections — all searchable via FTS immediately after import.
2. Re-importing the same file a second time produces zero new cards or connections: `ImportResult.inserted === 0`, all records reported as `skipped` or `updated` based on `modified_at` comparison — DedupEngine is idempotent.
3. Every imported card carries `source = 'apple_notes'` and `source_id` matching the original note's ID; the `import_runs` table contains a row recording `cards_inserted`, `cards_updated`, `cards_skipped`, `connections_created`, and any `errors_json` for the run.
4. A 5,000-card synthetic import completes without OOM crash: 100-card transaction batches are used throughout, `setTimeout(0)` yields between batches, Base64 attachment data is never stored in `content`, and FTS triggers are disabled during bulk insert with a full `INSERT INTO cards_fts SELECT ...` rebuild afterward.
5. `WorkerBridge.importFile()` and `WorkerBridge.exportFile()` are typed methods on the main-thread proxy; the exhaustive `WorkerRequestType` union in `protocol.ts` includes `'etl:import'` and `'etl:export'`; the Worker router has two new `case` branches that compile without TypeScript errors.

**Pitfall Mitigations:**

- **P22 (OOM on large imports, CRITICAL):** 100-card transaction batches in `SQLiteWriter`; `setTimeout(0)` yield between batches; `INSERT INTO cards_fts(cards_fts) VALUES('optimize')` post-import; no Base64 content storage.
- **P23 (buffer overflow on large SQL strings, CRITICAL):** `db.prepare()` with parameterized statements is the only write path in `SQLiteWriter`. Multi-row `VALUES` concatenation is prohibited.
- **P24 (FTS trigger overhead on bulk import, HIGH):** For initial imports (>500 cards): disable FTS triggers, bulk insert all cards, rebuild FTS with `INSERT INTO cards_fts SELECT ... FROM cards`, run `optimize`, restore triggers.
- **P25 (DedupEngine SQL injection via source_id, CRITICAL):** Load all existing `{id, source_id, modified_at}` for the source type in a single `WHERE source = ?` query; filter in memory via JavaScript `Map`. No string interpolation of source values into SQL. If `json_each()` pattern is used instead, verify the function exists in the custom FTS5 WASM build first.
- **P30 (cross-batch connection ID resolution):** `DedupEngine` resolves unresolved connection targets by querying the database for existing source IDs; connections with unresolvable targets are silently dropped via `INSERT OR IGNORE`.

**Research Flags:** None. Architecture is fully specified in `DataExplorer.md` and `WorkerBridge.md`. Pitfall mitigations are documented with code examples in `PITFALLS.md`.

**Build sub-order (within phase):**
1. `src/etl/types.ts` — CanonicalCard, CanonicalConnection, ImportResult, ParseError, SourceType
2. `src/database/schema.sql` — append `import_sources` and `import_runs` tables
3. `src/worker/protocol.ts` — add `etl:import`, `etl:export` to WorkerRequestType union, payloads, responses
4. `src/etl/SQLiteWriter.ts` — 100-card batches, `db.prepare()`, FTS trigger disable/rebuild for bulk
5. `src/etl/DedupEngine.ts` — load-all-by-source-type, in-memory Map classification, sourceIdMap
6. `src/etl/CatalogWriter.ts` — upserts `import_sources`, writes `import_runs` row after each run
7. `src/etl/parsers/AppleNotesParser.ts` — notes + checklist + attachments + mentions + links → canonical types
8. `src/etl/ImportOrchestrator.ts` — parser → dedup → writer → catalog pipeline
9. `src/worker/handlers/etl-import.handler.ts` + `worker.ts` router case + `WorkerBridge.importFile()`
10. Integration tests: round-trip, dedup idempotency, FTS sync, catalog verification, 5K card OOM test

**Plans:**

| Plan | Wave | Name | Reqs | Depends On |
|------|------|------|------|------------|
| 08-01 | 1 | ETL Types + Schema Extension | ETL-01, ETL-02 | — |
| 08-02 | 1 | Worker Protocol Extensions | ETL-03 | — |
| 08-03 | 2 | DedupEngine + SQLiteWriter | ETL-10, ETL-11 | 08-01 |
| 08-04 | 2 | AppleNotesParser + CatalogWriter | ETL-04, ETL-13 | 08-01 |
| 08-05 | 3 | ImportOrchestrator + Worker Handler | ETL-12, ETL-18 | 08-01, 08-02, 08-03, 08-04 |

---

### Phase 9: Remaining Parsers + Export Pipeline

**Goal:** Users can import from all six supported sources and export their data in Markdown, JSON, and CSV — covering every major PKM migration and backup scenario.

**Depends on:** Phase 8 (CanonicalCard/CanonicalConnection types, DedupEngine, SQLiteWriter, ImportOrchestrator, Worker handler pattern all proven)

**Requirements:** ETL-05, ETL-06, ETL-07, ETL-08, ETL-09, ETL-14, ETL-15, ETL-16, ETL-17

**Success Criteria** (what must be TRUE when this phase completes):

1. A folder of Obsidian `.md` files with YAML frontmatter is imported: titles come from frontmatter `title` or first `#` heading, tags from frontmatter `tags` array, timestamps from `created`/`modified` frontmatter fields, and folder from the file directory path — all without frontmatter data being silently lost due to the gray-matter `fs` dependency (P26 resolved).
2. An Excel `.xlsx` file with a header row is imported: SheetJS is loaded via dynamic `import('xlsx')` (not at app startup), column headers are auto-detected case-insensitively for `title/name`, `content/body`, `date/created`, and `tags/labels`, files >50MB are rejected with a clear error before parse attempt, and `cellDates: true` produces correct ISO date strings (P27 resolved).
3. A CSV exported from Excel (UTF-8 BOM prefix, RFC 4180 quoting) is imported without title corruption: BOM is stripped before parsing, PapaParse is called synchronously (no nested Worker), column auto-detection matches the same candidates as Excel, and ragged rows do not crash (P28 resolved).
4. An HTML web clipping string is parsed in Worker context: `<script>` and `<style>` content is stripped before any text extraction, title comes from `<title>` or first `<h1>`, `created_at` is extracted from `<meta property="article:published_time">` if present, `source_url` from `<link rel="canonical">` — with no DOM or `document` access (P29 resolved).
5. `WorkerBridge.exportFile('markdown' | 'json' | 'csv', optionalCardIds?)` returns a string that round-trips: exported Markdown contains valid YAML frontmatter parseable by gray-matter, exported JSON includes all non-deleted card columns with tags parsed from JSON string to array, exported CSV is RFC 4180 compliant with PapaParse `unparse()` and tags as semicolon-delimited strings.

**Pitfall Mitigations:**

- **P26 (gray-matter fs dependency, HIGH):** Verify Worker compatibility before writing MarkdownParser tests. Use `gray-matter-browser` npm alias in `vite.config.ts`, or implement inline frontmatter parser (~30 lines handles 95% of Obsidian/Bear YAML).
- **P27 (SheetJS bundle size, MODERATE):** Dynamic `import('xlsx')` in ExcelParser; use `xlsx/dist/xlsx.mini.min.js` Vite alias to exclude legacy codepage support (~600KB savings).
- **P28 (CSV UTF-8 BOM, MODERATE):** `content.charCodeAt(0) === 0xFEFF` check + `content.slice(1)`, or `new TextDecoder('utf-8', { ignoreBOM: true })`. First CSVParser test must use a BOM-prefixed fixture.
- **P29 (HTML script execution, HIGH):** Parse HTML only in Worker context. Strip `<script>` and `<style>` blocks via regex before text extraction. Use `node-html-parser` (zero DOM dependencies) for structured extraction.

**Research Flags:**

- **HTMLParser DOM library (resolve before implementation):** `@mozilla/readability` requires a DOM environment. Verify `linkedom` + readability Worker compatibility before writing `HTMLParser`. If `linkedom` adds too much complexity or has API gaps, a regex-based fallback (`htmlToText()` from PITFALLS.md P29) handles 80% of web clipping use cases and is the safer default.

**Build sub-order (within phase):**
1. `src/etl/parsers/MarkdownParser.ts` — gray-matter browser alias or inline parser; frontmatter tags, timestamps, folder from path
2. `src/etl/parsers/CSVParser.ts` — PapaParse sync, BOM strip, column auto-detection, `TextDecoder ignoreBOM`
3. `src/etl/parsers/JSONParser.ts` — JSON.parse, configurable field mapping, array/object normalization
4. `src/etl/parsers/ExcelParser.ts` — SheetJS dynamic import, ArrayBuffer via postMessage (Transferable), `cellDates: true`, 50MB limit
5. `src/etl/parsers/HTMLParser.ts` — Worker-safe HTML stripping, script/style removal, text extraction (resolve DOM library first)
6. `src/etl/ExportOrchestrator.ts` — Markdown with YAML frontmatter, JSON, CSV via PapaParse unparse; optional `cardIds` filter
7. `src/worker/handlers/etl-export.handler.ts` — thin delegation to ExportOrchestrator
8. `WorkerBridge.exportFile()` — typed method on main-thread proxy
9. Parser tests with real-world fixture files: BOM-prefixed CSV, Excel with dates, Obsidian vaults with complex frontmatter

**Plans:** TBD

---

### Phase 10: Progress Reporting + Polish

**Goal:** Users importing large datasets receive live progress feedback through the Worker Bridge, with extended timeouts that prevent silent hangs and FTS optimization that keeps search fast post-import.

**Depends on:** Phase 9 (ImportOrchestrator proven end-to-end with all parsers; all parsers integrated and tested)

**Requirements:** ETL-19

**Success Criteria** (what must be TRUE when this phase completes):

1. During an import of 500+ cards, the main thread receives `import_progress` notification events at every 100-card batch boundary without polling: each event carries `{processed: number, total: number, source: SourceType}` and is delivered as a `WorkerNotification` type (no correlation ID) that the main thread can subscribe to via an `onnotification` callback.
2. The `etl:import` message type uses a 300-second timeout (vs the 30-second default for all other bridge messages) — a 5,000-note Apple Notes import does not produce a timeout error on the bridge before the import completes.
3. After any bulk import (>500 cards), `INSERT INTO cards_fts(cards_fts) VALUES('optimize')` is called to merge FTS segments; a search query issued immediately after the import returns results from the newly imported cards with latency within the existing FTS SLA (<100ms for typical queries).

**Pitfall Mitigations:**

- **P22 follow-on (FTS optimize, MODERATE):** `INSERT INTO cards_fts(cards_fts) VALUES('optimize')` after bulk import merges fragmented FTS segments, reducing post-import query latency.

**Research Flags:** None. Progress notification pattern is an additive `WorkerNotification` message type in the existing protocol. `WorkerBridgeConfig.timeout` override pattern is already specified in `WorkerBridge.md`.

**Build sub-order (within phase):**
1. Add `import_progress` to `WorkerNotification` union in `protocol.ts`
2. Add `onnotification` callback registration to `WorkerBridge`
3. Emit `import_progress` in `ImportOrchestrator` at batch boundaries (every 100 cards)
4. Configure extended timeout (300s) for `etl:import` message type in `WorkerBridge.importFile()`
5. Add FTS `optimize` call in `SQLiteWriter` after bulk import completes
6. Integration tests: assert progress events received, assert no timeout at 5K cards, assert FTS search works immediately post-import

**Plans:** TBD

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Database Foundation | v0.1 | 4/4 | Complete | 2026-02-28 |
| 2. CRUD + Query Layer | v0.1 | 6/6 | Complete | 2026-02-28 |
| 3. Worker Bridge | v1.0 | 3/3 | Complete | 2026-03-01 |
| 4. Providers + MutationManager | v0.5 | 7/7 | Complete | 2026-02-28 |
| 5. Core D3 Views + Transitions | v0.5 | 4/4 | Complete | 2026-02-28 |
| 6. Time + Visual Views | v0.5 | 3/3 | Complete | 2026-02-28 |
| 7. Graph Views + SuperGrid | v1.0 | 4/4 | Complete | 2026-03-01 |
| 8. ETL Foundation + Apple Notes Parser | v1.1 | 0/? | Planned | - |
| 9. Remaining Parsers + Export Pipeline | v1.1 | 0/? | Planned | - |
| 10. Progress Reporting + Polish | v1.1 | 0/? | Planned | - |

---

## Requirement Coverage — v1.1 ETL Importers

| Requirement | Description | Phase |
|-------------|-------------|-------|
| ETL-01 | Canonical Type Contract (CanonicalCard, CanonicalConnection, ImportResult, ParseError, SourceType) | Phase 8 |
| ETL-02 | Data Catalog Schema (import_sources, import_runs tables) | Phase 8 |
| ETL-03 | Worker Protocol Extensions (etl:import, etl:export, import_progress types; importFile/exportFile methods) | Phase 8 |
| ETL-04 | Apple Notes Parser (AltoExport → cards + connections; notes, events, persons, resources) | Phase 8 |
| ETL-10 | Dedup Engine (source+source_id classification; insert/update/skip; sourceIdMap) | Phase 8 |
| ETL-11 | SQLite Writer (100-card batches; db.prepare(); FTS trigger disable/rebuild for bulk) | Phase 8 |
| ETL-12 | Import Orchestrator (parser → dedup → writer → catalog pipeline; progress emissions) | Phase 8 |
| ETL-13 | Catalog Writer (upsert import_sources; write import_runs row after each run) | Phase 8 |
| ETL-18 | Worker Handler Integration (etl-import.handler.ts, etl-export.handler.ts, router cases) | Phase 8 |
| ETL-05 | Markdown Parser (gray-matter frontmatter; title/tags/timestamps/folder extraction) | Phase 9 |
| ETL-06 | Excel Parser (SheetJS dynamic import; ArrayBuffer; cellDates; column auto-detection; 50MB limit) | Phase 9 |
| ETL-07 | CSV Parser (PapaParse sync; BOM strip; RFC 4180; column auto-detection) | Phase 9 |
| ETL-08 | JSON Parser (JSON.parse; configurable field mapping; array/object normalization) | Phase 9 |
| ETL-09 | HTML Parser (Worker-safe; script/style strip; node-html-parser; meta tag extraction) | Phase 9 |
| ETL-14 | Markdown Export (YAML frontmatter; round-trip parseable; soft-delete filter; optional cardIds) | Phase 9 |
| ETL-15 | JSON Export (all columns; tags parsed to array; soft-delete filter; optional cardIds) | Phase 9 |
| ETL-16 | CSV Export (RFC 4180 via PapaParse unparse; tags as semicolons; soft-delete filter; optional cardIds) | Phase 9 |
| ETL-17 | Export Orchestrator (format dispatch; timestamp filename; SelectionProvider integration) | Phase 9 |
| ETL-19 | Progress Reporting (import_progress WorkerNotification; 300s timeout; FTS optimize post-import) | Phase 10 |

**Coverage: 19/19 requirements mapped. No orphans.**

---
*Roadmap created: 2026-02-27*
*v0.1 Data Foundation shipped: 2026-02-28*
*v0.5 Providers + Views shipped: 2026-02-28*
*v1.0 Web Runtime shipped: 2026-03-01*
*v1.1 ETL Importers phases added: 2026-03-01*
