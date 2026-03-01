# Project Research Summary

**Project:** Isometry v1.1 — ETL Importers
**Domain:** ETL import/export pipeline for local-first TypeScript/sql.js personal knowledge base
**Researched:** 2026-03-01
**Confidence:** MEDIUM-HIGH

## Executive Summary

Isometry v1.1 adds a six-parser ETL pipeline to a fully operational web runtime (897 tests, 24,298 LOC). The v1.0 foundation is locked: TypeScript 5.9, sql.js 1.14 (custom FTS5 WASM), Vite 7.3, Vitest 4.0, D3.js v7.9, and the Worker Bridge typed RPC layer. The v1.1 work is additive — new files in `src/etl/`, minimal modifications to `protocol.ts`, `worker.ts`, `WorkerBridge.ts`, and `schema.sql`. All parsing, deduplication, and writes execute entirely inside the Web Worker; the main thread receives only a compact `ImportResult` summary. Four new runtime packages are required: `gray-matter` (Markdown frontmatter), `xlsx` from the SheetJS CDN (not npm registry), `papaparse` (CSV), and `node-html-parser` (HTML text extraction).

The recommended architecture is a clean pipeline: parser → DedupEngine → SQLiteWriter → CatalogWriter, orchestrated by `ImportOrchestrator`. Parsers are pure functions with zero DB or Worker dependency — they receive raw data and return `CanonicalCard[]` / `CanonicalConnection[]`. The DedupEngine and SQLiteWriter receive the `Database` object directly (not through the bridge), following the same pattern as all existing handler files. FTS5 sync is automatic via existing triggers — the ETL layer does not touch `cards_fts` directly. The `CanonicalCard` / `CanonicalConnection` interface contract is the critical integration seam: all six parsers and all three write components depend on it, so it must be defined first.

The primary risks are memory-related. sql.js holds the entire database in WASM heap; a 5,000-note Apple Notes import with FTS indexing can push memory past WKWebView limits. Mitigations are known and must be built in from day one: 100-card transaction batches in `SQLiteWriter`, FTS trigger disable/rebuild for bulk imports, dynamic import of the 1MB SheetJS library. A secondary risk cluster involves SQL safety: the `DedupEngine` spec shows string-interpolated source keys in an IN clause — this must be replaced with a JSON-based parameterized query before any external file data is processed. A third risk is browser/Worker compatibility of `gray-matter`, which has a Node.js `fs` dependency that can silently break Vite Worker builds.

---

## Key Findings

### Recommended Stack

The v1.0 stack requires no changes. Four targeted additions cover all six parsers. Six of the ten ETL components use only existing infrastructure (JSON.parse, sql.js, existing Worker Bridge patterns).

**New runtime packages:**
- `gray-matter@4.0.3`: Markdown frontmatter parsing — battle-tested (Gatsby, Astro, VitePress). Requires browser-compat alias in `vite.config.ts` (`gray-matter` → `gray-matter-browser`) or an inline fallback parser due to Node.js `fs` dependency. See Pitfall 26.
- `xlsx@0.20.3` from SheetJS CDN: Excel parsing — the only viable browser/Worker Excel parser. Must be installed via `npm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`, NOT from the npm registry (0.18.5 is outdated and has ReDoS CVE-2024-22363). Use dynamic `import('xlsx')` to defer the ~1MB bundle until first use.
- `papaparse@5.5.3`: CSV parsing — the only browser/Worker-native CSV parser with RFC 4180 compliance. Install `@types/papaparse` separately from DefinitelyTyped. Do NOT use `worker: true` option inside the existing Worker (creates nested Workers); call PapaParse synchronously inside ImportWorker.
- `node-html-parser@7.0.2`: HTML text extraction — zero DOM dependencies, runs in Worker context, 10x faster than DOMParser for bulk batch processing.

**No new packages needed for:** Apple Notes parsing (JSON.parse), JSON import (JSON.parse), export CSV serialization (PapaParse `unparse()` reuse), dedup, SQLite writes, FTS sync, or data catalog schema.

**Critical installation note:** `npm install xlsx` installs 0.18.5 from the npm registry — obsolete and vulnerable. Always use the CDN tarball.

### Expected Features

**Must have (table stakes) — all required for v1.1:**
- Idempotent re-import — `DedupEngine` keyed on `source + source_id`; re-import inserts new, updates changed, skips unchanged
- Import result summary — `{inserted, updated, skipped, connections, errors}` returned over Worker Bridge
- Per-record error isolation — one malformed row must not abort a 500-row import; errors accumulate in `ImportResult.errors[]`
- Progress reporting — Worker Bridge `import_progress` broadcast events every 100 cards; existing `WorkerMessage` protocol, no new infrastructure
- Source provenance on every card — `source`, `source_id`, `source_url` fields already exist in `cards` schema
- Markdown export preserves frontmatter — valid YAML parseable by `gray-matter` on re-import; tags as YAML list
- JSON export as complete backup — all columns, soft-delete filter (`deleted_at IS NULL`)
- CSV export RFC 4180 — PapaParse `unparse()` reuses already-installed library
- Folder structure preservation — all six parsers map to `CanonicalCard.folder`
- Tag extraction — frontmatter tags, body `#hashtag` scan, configurable column for tabular formats
- Timestamp preservation — `created_at` and `modified_at` from source, not import time
- FTS5 stays in sync — SQLiteWriter uses the standard `INSERT INTO cards` path; existing triggers fire automatically

**Should have (competitive differentiators) — also in v1.1 scope:**
- Connection extraction from Apple Notes — checklist items → `event` cards, @mentions → `person` cards + `mentions` connections, note links → `links_to` connections; this is what makes the Apple Notes parser exceptional vs. any generic importer
- Data Catalog with full provenance — `import_history` table records every run; no PKM tool (Obsidian, Bear, Notion) tracks this
- Selective export by card IDs — integrates with existing `SelectionProvider` ephemeral selection
- Checklist → task card hierarchy — tasks appear immediately in Kanban and Calendar views post-import
- Column auto-detection for Excel/CSV — case-insensitive header matching against candidate lists covers 80% of real-world exports

**Defer to v1.1.x or later:**
- Column mapping UI for Excel/CSV — auto-detection covers the common case; UI is significant frontend effort
- Markdown wikilink extraction — architecture supports it; defer until Obsidian user validation confirms demand
- Cross-source entity resolution (fuzzy dedup) — false positives destroy data trust; exact `source:source_id` dedup only in v1.1
- Real-time folder watch — requires native Swift FSEvents; the web runtime processes bytes, it does not watch files
- Undo for individual import operations — "undo last import" via `import_history` DELETE is the right model; not MutationManager command log

**Anti-features to avoid:**
- Streaming XLSX reads — architecturally impossible (ZIP central directory at end of file); Worker offload is the correct solution
- `SELECT *` in DedupEngine — project minimally (`id, source_id, modified_at` only)
- String interpolation of source keys in DedupEngine SQL — SQL injection vector; use `json_each(?)` pattern
- Base64 attachment storage in sql.js — fatal memory pressure; store metadata only (`mime_type`, `filename`)
- Fuzzy cross-source dedup — silent data corruption risk; defer behind explicit user confirmation UI

### Architecture Approach

The ETL subsystem is a new `src/etl/` top-level directory mirroring the existing `src/providers/`, `src/mutations/`, `src/views/` pattern. All six parsers are pure functions testable with file fixtures in standard Vitest node environment with no Worker or sql.js dependency. The infrastructure layer (DedupEngine, SQLiteWriter, CatalogWriter) receives `db: Database` directly — not through the WorkerBridge, which is a main-thread concept. Two new message types (`etl:import`, `etl:export`) are added to the `WorkerRequestType` union in `protocol.ts`. Four existing files are minimally modified; sixteen new files are created.

**Major components:**
1. `src/etl/types.ts` — `CanonicalCard`, `CanonicalConnection`, `ImportResult`; foundation all other components depend on
2. `src/etl/ImportOrchestrator.ts` — coordinates parse → dedup → write → catalog pipeline
3. `src/etl/DedupEngine.ts` — loads all existing `source_id` values for the source type in one query, classifies insert/update/skip in memory (avoids IN clause injection risk)
4. `src/etl/SQLiteWriter.ts` — batched INSERT with `db.prepare()` + 100-card transactions; FTS triggers fire automatically
5. `src/etl/parsers/` (6 files) — pure transform functions, independently testable with fixtures
6. `src/etl/ExportOrchestrator.ts` — queries cards, formats as Markdown/JSON/CSV
7. `src/etl/CatalogWriter.ts` — writes to `import_history` and `sources` after each run
8. Schema addition — `import_history` and `sources` tables appended to `schema.sql`

**Build order (dependency DAG):**
- Foundation first: `types.ts` → schema migration → `protocol.ts` additions
- Infrastructure next: `SQLiteWriter` → `DedupEngine` → `CatalogWriter` (testable with hand-crafted cards, no parsers needed)
- Parsers in parallel: all six are independent (AppleNotes → Markdown → CSV → JSON → Excel → HTML, complexity order)
- Pipeline assembly last: `ImportOrchestrator` → `ExportOrchestrator` → handlers → worker router → WorkerBridge methods

### Critical Pitfalls

Pitfalls are drawn from the full PITFALLS.md catalog. ETL-specific pitfalls are Pitfalls 22-29. Pre-existing pitfalls most relevant to ETL integration are 4, 11, and 12.

1. **sql.js WASM Heap OOM on large imports (P22, CRITICAL)** — 5,000 Apple Notes with FTS indexing can exceed 150MB WKWebView limit. Use 100-card transaction chunks; yield to event loop between chunks. After bulk insert, run `INSERT INTO cards_fts(cards_fts) VALUES('optimize')` to merge FTS segments. Strip Base64 attachment data before writing.

2. **DedupEngine SQL injection from source_id values (P25, CRITICAL)** — The spec shows string-interpolated source keys; Markdown file paths are user-supplied and can contain SQL metacharacters. Replace with JSON `json_each(?)` pattern: `WHERE (source || ':' || source_id) IN (SELECT value FROM json_each(?))`. Must be fixed before the first ETL test runs.

3. **sql.js buffer overflow on large SQL strings (P23, CRITICAL)** — Never pass a concatenated multi-row VALUES INSERT to `db.run()`; observed failures at ~3,700 rows (~1.5MB string). SQLiteWriter's 100-card prepared statement loop is the only correct write path. Never bypass it for "optimization."

4. **FTS5 trigger overhead makes bulk imports unusably slow (P24, HIGH)** — 10K cards via per-row triggers can take 30-60s instead of ~2s. For initial imports: disable FTS triggers, bulk-insert, rebuild via `INSERT INTO cards_fts SELECT ... FROM cards`, optimize, restore triggers. For incremental re-imports, triggers are correct and fast.

5. **gray-matter `fs` dependency breaks in browser/Worker (P26, HIGH)** — gray-matter imports Node.js `fs`, causing `vite build` failure or silent frontmatter loss in the browser. Use `gray-matter-browser` npm alias in `vite.config.ts` or implement a minimal inline frontmatter parser (handles 95% of real-world Obsidian/Bear YAML frontmatter without a dependency).

6. **SheetJS ~1MB bundle inflates initial load (P27, MODERATE)** — Use dynamic `import('xlsx')` in ExcelParser so SheetJS loads only on first Excel import, not on app start. Use `xlsx.mini.min.js` Vite alias to exclude legacy format codepages (~600KB savings).

7. **CSV UTF-8 BOM corrupts first column header (P28, MODERATE)** — Excel CSV exports frequently include BOM; `findColumn()` fails to match `"﻿name"` against `"name"`. Strip with `new TextDecoder('utf-8', { ignoreBOM: true })`. First CSVParser test must use a BOM-prefixed fixture.

8. **HTML script tag execution risk (P29, HIGH)** — Parse HTML only in Worker context (no DOM, no script execution). Use Worker-safe regex stripping for `<script>` and `<style>` tags before extracting text content.

---

## Implications for Roadmap

Based on research, the ETL pipeline maps cleanly to three phases with a bottom-up dependency structure. The architecture is fully specified; phase boundaries are determined by technical prerequisites.

### Phase 8: ETL Foundation + Apple Notes Parser

**Rationale:** The foundation types (`CanonicalCard`, schema migration, protocol additions) must exist before any parser can be built. Apple Notes is the primary data source and most complex parser — it drives the `CanonicalConnection` design that all other components depend on. Building the foundation and primary parser together validates the full pipeline end-to-end before adding simpler parsers. All critical pitfall mitigations (OOM chunking, SQL injection fix, FTS optimization) must be established in this phase.

**Delivers:** Full ETL pipeline from file bytes to searchable cards. Apple Notes notes, tasks (checklist → event cards), attachments (resource cards), mentions (person cards), and note links (connections) are all imported. Data Catalog records every run. FTS5 stays in sync. Worker Bridge round-trip tested end-to-end.

**Addresses:** Idempotent re-import (DedupEngine), source provenance, connection extraction, data catalog, progress reporting, FTS sync.

**Avoids:** P22 (chunk writes from day one), P23 (prepared statements only), P24 (trigger disable/rebuild for initial imports), P25 (JSON `json_each` in DedupEngine from day one).

**Build sub-order (within phase):**
1. `src/etl/types.ts` — CanonicalCard, CanonicalConnection, ImportResult
2. Schema migration — `import_history`, `sources` tables added to `schema.sql`
3. `protocol.ts` — `etl:import`, `etl:export` types in WorkerRequestType union
4. `SQLiteWriter.ts` — 100-card batches, `db.prepare()`, transaction wrapping
5. `DedupEngine.ts` — load-all-existing-by-source-type pattern, `json_each` query
6. `CatalogWriter.ts` — writes `import_history` row after each run
7. `AppleNotesParser.ts` — notes + checklist + attachments + mentions + links → canonical types
8. `ImportOrchestrator.ts` — parser → dedup → writer → catalog pipeline
9. Worker handler, router case, WorkerBridge `importFile()` method
10. Integration tests: round-trip, dedup idempotency, FTS sync, catalog verification, 5K card OOM test

**Research flag:** No additional research needed. Architecture fully specified in `DataExplorer.md` and `WorkerBridge.md`. Pitfall mitigations are documented with code examples in PITFALLS.md.

### Phase 9: Remaining Parsers + Export Orchestrator

**Rationale:** Markdown, Excel, CSV, JSON parsers are simpler than Apple Notes (no connections, column auto-detection rather than structured graph parsing). They can be built rapidly once the pipeline infrastructure is proven. HTMLParser is the most fragile — built last. ExportOrchestrator is a read-only query path with zero new infrastructure requirements.

**Delivers:** All six parsers complete. Export in Markdown (valid YAML frontmatter), JSON (complete backup), and CSV (RFC 4180). Worker handler integration for export. Selective export by `cardIds` integrates with existing `SelectionProvider`.

**Addresses:** Full format coverage (Apple Notes, Markdown, Excel, CSV, JSON, HTML), Obsidian/Bear migration, spreadsheet hand-off, complete backup capability.

**Avoids:** P26 (gray-matter `fs` dependency — verify Worker compat before MarkdownParser tests), P27 (SheetJS bundle — dynamic import in ExcelParser), P28 (CSV BOM — `TextDecoder ignoreBOM` in CSVParser), P29 (HTML script execution — Worker context + regex strip).

**Build sub-order (within phase):**
1. `MarkdownParser.ts` — gray-matter browser alias or inline parser; frontmatter tags, timestamps, folder from path
2. `CSVParser.ts` — PapaParse sync (no nested Worker), BOM strip, column auto-detection
3. `JSONParser.ts` — JSON.parse, configurable field mapping, array/object normalization
4. `ExcelParser.ts` — SheetJS dynamic import, ArrayBuffer via postMessage (Transferable), `cellDates: true`
5. `HTMLParser.ts` — Worker-safe HTML stripping, script/style tag removal, text extraction
6. `ExportOrchestrator.ts` — Markdown with YAML frontmatter, JSON, CSV via PapaParse unparse
7. `etl-export.handler.ts` — thin delegation to ExportOrchestrator
8. WorkerBridge `exportFile()` method
9. Parser tests with real-world fixture files (BOM-prefixed CSV, Excel with dates, Obsidian vaults)

**Research flag:** HTMLParser may need additional research on `linkedom` vs `@mozilla/readability` for Worker context compatibility. FEATURES.md notes `@mozilla/readability` requires a DOM environment — verify `linkedom` as a lightweight DOM shim in Worker before implementation. If `linkedom` adds too much complexity, a regex-based approach handles 80% of web clipping use cases.

### Phase 10: ETL Polish + Progress Reporting

**Rationale:** Progress reporting, import history audit hooks, and integration hardening are second-order features — valuable but not blocking for functional pipeline completeness. Deferring them keeps Phases 8-9 focused on correctness.

**Delivers:** `import_progress` broadcast events over Worker Bridge (add to `WorkerMessage` union). Extended timeout on `importFile()` (300s vs 30s default) for large imports. FTS `optimize` post-bulk-import. Import history accessible for audit trail.

**Addresses:** P22 follow-on (FTS optimize, progress events for stall detection), import UX transparency.

**Avoids:** Silent hang during large imports — extended configurable timeout on the `etl:import` message type.

**Research flag:** No additional research needed. Progress notification pattern is documented in ARCHITECTURE.md as an additive `WorkerNotification` message type. The `WorkerBridgeConfig.timeout` override pattern is specified.

### Phase Ordering Rationale

- Foundation types must exist before any parser or infrastructure component can compile — hard dependency, not style preference.
- SQLiteWriter and DedupEngine are built before parsers so parsers can be integration-tested end-to-end immediately when they are ready.
- Apple Notes parser is built before simpler parsers because it drives the `CanonicalConnection` design. The other five parsers produce no connections in v1.1, so they do not need to see the final connection model before they are written.
- ExportOrchestrator is deferred to Phase 9 because it has zero infrastructure dependencies and reuses already-proven components (sql.js queries, PapaParse, string templates).
- Progress reporting is deferred to Phase 10 because the existing `importFile()` extended timeout is a sufficient v1.1 UX — a spinner with no progress bar is acceptable for the initial release at realistic Apple Notes vault sizes (100-5,000 notes).

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 9 (HTMLParser):** `@mozilla/readability` requires a DOM environment. Verify `linkedom` vs `jsdom` Worker compatibility before implementation. `linkedom` is the leaner choice (no Node.js built-in dependencies) but may have API gaps vs Readability's expected DOM interface. If incompatible, a regex-based fallback handles the 80% case.

**Phases with standard patterns (skip research-phase):**
- **Phase 8:** Architecture fully specified in `DataExplorer.md` and `WorkerBridge.md`. Pitfall mitigations are explicit with code examples. No unknowns.
- **Phase 9 (parsers except HTML):** gray-matter, SheetJS, PapaParse, JSON.parse — all well-documented with specific version requirements and workarounds in STACK.md and PITFALLS.md.
- **Phase 10:** Progress reporting is a documented WorkerMessage extension. No new infrastructure.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | npm versions verified; SheetJS CDN tarball confirmed at 0.20.3; gray-matter `fs` issue confirmed via GitHub issues. Bundle size estimates from Bundlephobia are approximations (inaccessible during research). |
| Features | HIGH | Spec fully defined in `DataExplorer.md`. Parser behaviors verified via official library docs and WebSearch. PKM competitive patterns drawn from Obsidian, Bear, Notion, Airtable. |
| Architecture | HIGH | Derived directly from canonical specs (`DataExplorer.md`, `WorkerBridge.md`) and confirmed against actual v1.0 source files (`protocol.ts`, `schema.sql`, handler pattern). |
| Pitfalls | MEDIUM-HIGH | ETL pitfalls verified via sql.js GitHub issues, SheetJS docs, and first principles. gray-matter `fs` issue confirmed via GitHub issues #49/#50. Severity ratings involve judgment about WKWebView memory limits in constrained device environments. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Apple Notes `alto-index` format specifics (LOW confidence):** No public schema found. Format confirmed as Markdown output (not JSON), but frontmatter fields are not formally specified. Plan for format auto-detection by file extension + structure inspection. First import of a real alto-index export will reveal actual field names — build the parser defensively.

- **apple-notes-liberator JSON schema (MEDIUM confidence):** Documented in GitHub README but not a formal spec. Field names (`title`, `folder`, `text`, `embeddedObjects`, `links`) are from README examples. Validate against an actual export before finalizing `AppleNotesParser`.

- **HTMLParser DOM library selection:** `@mozilla/readability` requires a DOM environment. `linkedom` claims Worker compatibility but `linkedom` + `readability` in a Worker is an uncommon combination. Add a Worker compatibility test before writing HTMLParser. Fallback: regex-based text extraction (handles 80% of web clippings without a DOM shim).

- **`json_each()` function availability in custom sql.js WASM:** The recommended SQL injection mitigation uses SQLite's JSON1 `json_each()` function. Verify this function is available in the custom FTS5 WASM build used by this project (sql.js 1.14 with custom build). If not available, use the alternative: load all `source_id` values for the source type into a JavaScript `Map` and filter in memory — same O(n) complexity, no function dependency.

- **gray-matter browser fork availability:** Research recommends `gray-matter-browser` as a browser-compatible fork via Vite alias. Verify this package is on npm and actively maintained before adopting it. If not maintained, the inline frontmatter parser is the primary approach — YAML frontmatter is simple enough to implement in ~30 lines.

---

## Sources

### Primary (HIGH confidence)
- `v5/Modules/DataExplorer.md` — canonical ETL interface definitions, all parser implementations
- `v5/Modules/Core/WorkerBridge.md` — WorkerBridge protocol spec
- `src/worker/protocol.ts` — actual v1.0 WorkerRequestType union pattern
- `src/database/schema.sql` — actual v1.0 schema; confirms `source`, `source_id`, `source_url` columns and `idx_cards_source` UNIQUE index already present
- `src/worker/handlers/export.handler.ts` — handler pattern reference

### Secondary (MEDIUM confidence)
- SheetJS official docs — https://docs.sheetjs.com — Worker support, Vite integration, CDN installation
- SheetJS CDN — https://cdn.sheetjs.com — version 0.20.3
- SheetJS CVE-2024-22363 — ReDoS in npm registry version; CDN version unaffected
- gray-matter npm — https://www.npmjs.com/package/gray-matter — v4.0.3
- gray-matter GitHub issues #49/#50 — `fs` dependency in browser builds (unresolved)
- PapaParse docs — https://www.papaparse.com — BOM handling, streaming, RFC 4180
- PapaParse GitHub issue #840 — UTF-8 BOM first-column header bug
- node-html-parser npm — https://www.npmjs.com/package/node-html-parser — v7.0.2
- sql.js GitHub issues — WASM heap limits, buffer overflow behavior
- JS CSV parser benchmarks — https://leanylabs.com/blog/js-csv-parsers-benchmarks

### Tertiary (LOW confidence)
- alto-index website — https://altoindex.com — confirms Markdown output format (no public schema)
- apple-notes-liberator GitHub — https://github.com/HamburgChimps/apple-notes-liberator — JSON schema from README

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
