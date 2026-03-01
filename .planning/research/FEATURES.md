# Feature Research

**Domain:** ETL Import/Export Pipeline for Personal Knowledge Base (v1.1 milestone)
**Researched:** 2026-03-01
**Confidence:** HIGH — spec is fully defined in `v5/Modules/DataExplorer.md`; library behaviors verified via official docs and WebSearch; PKM ecosystem patterns drawn from Obsidian, Bear, Logseq, Notion, Airtable

---

## Context: This Milestone's Scope

v1.0 shipped the full Web Runtime: 897 tests, 24,298 LOC, Worker Bridge, 9 D3 views, SuperGrid. The database is operational with manual card/connection CRUD. The runtime is stable.

v1.1 adds the ETL pipeline: 6 source parsers, deduplication engine, SQLite writer, import/export orchestrators, and a data catalog. All parsed records flow through `CanonicalCard` / `CanonicalConnection` interfaces before reaching the existing `cards` and `connections` tables. The existing schema does not change — only new catalog tables are added.

**Scope boundary:** Native Swift file-picker integration (reads the file, passes bytes to the Worker bridge) is out of scope. This milestone handles everything from raw bytes onward: parse → map → dedup → write.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any import pipeline. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Idempotent re-import | Re-running the same import should not duplicate data. All PKM tools that support import (Obsidian Importer, Bear, Notion) make this promise. Users routinely re-import updated exports. | MEDIUM | `DedupEngine` keyed on `source + source_id`. First import inserts; subsequent imports update if `modified_at` is newer, skip if unchanged. SQL: `WHERE source \|\| ':' \|\| source_id IN (...)`. |
| Import result summary | Users need to know what happened: N inserted, N updated, N skipped, N errors. Every import tool from Airtable CSV upload to Notion importer shows this. Absence feels like a black box. | LOW | `ImportResult` type already defined: `{inserted, updated, skipped, connections, errors}`. Display via progress reporting over Worker Bridge. |
| Error reporting per record | A single malformed row in a 500-row CSV must not abort the entire import. Users expect partial success with a list of what failed and why. | MEDIUM | Each parser wraps per-record processing in try/catch. Errors accumulate in `ImportResult.errors[]`. Failed records are skipped; the run continues. |
| Progress reporting for large imports | Importing 2,000 Apple Notes should show progress, not a frozen UI. Users abandoned tools (e.g., old Evernote importers) that had no progress indicator. | MEDIUM | Worker Bridge emits progress events via the existing `WorkerMessage` protocol. Orchestrator posts `{type: 'import_progress', payload: {processed, total}}` at batch boundaries. |
| Source provenance on every card | Users expect to know where a card came from so they can trace it back to the original. Notion shows "From CSV." Bear shows the original note. | LOW | `source` and `source_id` fields on `CanonicalCard` map directly to existing `cards` schema columns. `source_url` provides deep-link back to origin (e.g., `applenotes://note/{id}`). |
| Markdown export preserves frontmatter | Any PKM user will test "import then export" as their first action. If the exported `.md` files cannot be re-imported into Obsidian or Bear, the round-trip is broken. | MEDIUM | `ExportOrchestrator.toMarkdown()` emits YAML frontmatter with `title`, `created`, `folder`, `tags`. Format must be valid YAML parseable by `gray-matter`. Tags emitted as YAML list, not inline string. |
| JSON export is a complete backup | Users back up their data as JSON. The export must include all fields needed to reconstruct the database, not just display fields. | LOW | `ExportOrchestrator.toJSON()` runs `SELECT * FROM cards WHERE deleted_at IS NULL`. Includes all columns. Tags column is already stored as `JSON.stringify(array)` — parse before export. |
| CSV export for spreadsheet hand-off | Users pipe exported data into Excel, Numbers, or Google Sheets. CSV is the universal interchange format. | LOW | `ExportOrchestrator.toCSV()` must RFC 4180 quote fields containing commas or newlines. Tags stored as JSON array in SQLite — emit as semicolon-delimited string in CSV for human readability. |
| Folder structure preservation | Apple Notes users organize thousands of notes into folder hierarchies. Obsidian users mirror their filesystem in the vault structure. Importing without folder assignment is disorienting. | LOW | All parsers map to `CanonicalCard.folder`. Apple Notes: `normalizeFolder()` strips `Notes/` prefix, preserves hierarchy. Markdown: uses directory path from `file.path`. Excel: optional `folderColumn` config. |
| Tag extraction | Tags are the primary LATCH category axis. Every PKM user uses tags. Importing without tags breaks LATCH categorization and makes views like Kanban and SuperGrid useless. | LOW | Apple Notes: `note.tags[]` from export; fallback to `#hashtag` regex scan of content. Markdown: `fm.tags` frontmatter; fallback to `#hashtag` scan. Excel/CSV: configurable `tagsColumn`. |
| Timestamp preservation | `created_at` and `modified_at` on imported cards should reflect the original note's timestamps, not the import time. Users sort and filter by date — import-time timestamps break every time-based view. | LOW | All parsers map source timestamps. Apple Notes: `note.created`, `note.modified`. Markdown: `fm.date \|\| fm.created`, `fm.modified`. Excel: configurable `dateColumn`. JSON: field from source row. |
| Soft delete compatibility | The existing schema uses `deleted_at IS NULL` for active records. Import must not resurrect soft-deleted cards without user intent. | LOW | `DedupEngine` lookup query: `WHERE source \|\| ':' \|\| source_id IN (...)` — does not filter on `deleted_at`. If a previously deleted card is re-imported, it updates with `deleted_at = NULL` (restores it). This is correct: re-importing is an explicit user action. |
| FTS5 index stays in sync | The existing FTS5 `cards_fts` virtual table is populated via SQLite triggers on the `cards` table. Import must not bypass these triggers. | LOW | `SQLiteWriter` uses parameterized `INSERT INTO cards (...)` statements — identical to the Card CRUD path. Triggers fire normally. FTS sync is automatic. No special handling needed. |

---

### Differentiators (Competitive Advantage)

Features that set this ETL pipeline apart from generic import tools.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Connection extraction from Apple Notes | Apple Notes has internal note links, @mentions, and checklist items. Generic importers discard this graph structure. Isometry extracts it as `connections` rows, making the graph views immediately populated with real relationship data. | HIGH | `AppleNotesParser.parseLinks()` → `links_to` connections. `parseMentions()` → `person` cards + `mentions` connections. `parseChecklist()` → `event` cards + `contains` connections. This is the core value of the Apple Notes parser over a simple text import. |
| Cross-source deduplication with merge | Person cards from Apple Notes mentions and Markdown frontmatter `author:` fields may represent the same person. Source-keyed dedup prevents duplicates within a source; fuzzy name matching (future) enables cross-source merging. | HIGH | Current: exact `source:source_id` match. Near-term: within the same source, mentions deduplicate by normalized name (`Set<string>`). Cross-source merge deferred but the `DedupEngine.sourceIdMap` design supports it — map multiple source IDs to one canonical card ID. |
| Data Catalog with full provenance | Every import run is recorded: which file, when, how many inserted/updated/skipped, any errors. Users can see the full import history and audit what changed and when. No PKM tool tracks this. | MEDIUM | `import_history` table: `id, source, filename, imported_at, cards_inserted, cards_updated, cards_skipped, connections_created, errors`. `sources` table: registered source registry. `ImportOrchestrator` writes an `import_history` row after each run. |
| Selective export by card IDs | Export only the cards from a specific search result, selection set, or filtered view — not the entire database. This enables focused exports: "export just my meeting notes from Q1." | MEDIUM | `ExportOrchestrator.export(format, cardIds?)` — when `cardIds` is provided, uses `WHERE id IN (...)`. When omitted, exports all non-deleted cards. This integrates with the existing `SelectionProvider` ephemeral selection. |
| Checklist → task card hierarchy | Apple Notes checklist items become first-class `event` cards with `status: 'todo' \| 'done'` and a `contains` connection to the parent note. This means imported tasks immediately appear in Kanban view columns and Calendar view by due date. | MEDIUM | `parseChecklist()` in `AppleNotesParser`. Each item gets its own `card_type: 'event'`, `sort_order: index`, `completed_at: item.checked ? note.modified : null`. Connections preserve the note → task hierarchy for TreeView. |
| Attachment → resource card graph edges | Apple Notes attachments (images, PDFs, drawings) become `resource` cards linked to their parent note. The gallery view can then show all attachments from all notes as visual tiles. | MEDIUM | `parseAttachments()` in `AppleNotesParser`. Each attachment becomes `card_type: 'resource'` with `mime_type` preserved. Connection label `'attachment'`. Gallery view can filter by `card_type = 'resource'`. |
| Column auto-detection for Excel/CSV | Most import tools require the user to manually map columns. Isometry auto-detects common column names (`title/name/subject`, `content/body/description`, `date/created`, `tags/labels`) and falls back gracefully when not found. | LOW | `ExcelParser.findColumn()` scans headers case-insensitively for candidate names. `ParseOptions` allows explicit override. Manual mapping deferred to UI (v2); auto-detection covers 80% of real-world exports. |
| Worker Bridge progress events | Import progress is reported through the same typed Worker Bridge protocol used for queries and mutations — no new infrastructure. Progress events are first-class `WorkerMessage` types that the main thread can subscribe to. | LOW | Existing `WorkerMessage` envelope: `{id, type: 'import_progress', payload: {processed, total, source}}`. `ImportOrchestrator` posts these at batch boundaries (every 100 cards). Main thread renders a progress bar without polling. |
| Markdown wikilink extraction (future phase) | Obsidian and Logseq users have extensive `[[note-name]]` cross-links. Extracting these as `connections` would immediately populate the network graph with real knowledge structure. | HIGH | Not in this milestone — deferred. The `MarkdownParser` parses the content field but does not currently extract wikilinks. The `connections` output is empty for Markdown. Architecture supports adding this: regex scan content for `\[\[([^\]]+)\]\]`, resolve to `source_id`, create `links_to` connection. Research flag for Phase implementation. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this architecture or user experience.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Streaming/chunked parse for all formats | Seems necessary for large files. All modern ETL tools advertise streaming. | XLSX format stores the central directory at the end of the ZIP container — true streaming reads are impossible. The entire file must be buffered. SheetJS's streaming API is streaming *write* only. For reads, Web Worker offloads the parse without blocking UI. | Use Web Worker for CPU-bound parsing (already the architecture). Impose size limits: reject XLSX files >50MB with a clear error. Accept that XLSX is load-all; CSV and JSON can stream in future. |
| Fuzzy deduplication across sources | "Bob Smith" in Apple Notes and "Robert Smith" in a CSV might be the same person. Match them automatically. | Fuzzy matching produces false positives. Merging "Bob Smith" from sales notes with "Bob Smith" from a book club spreadsheet silently corrupts data with no undo. Trust is destroyed. | Exact `source:source_id` dedup only (current design). Within a single source, deduplicate mentions by normalized name. Cross-source merge requires explicit user confirmation — a UI concern, not a pipeline concern. |
| Auto-schema inference for arbitrary JSON | Accept any JSON and auto-map fields to `CanonicalCard`. Generic tools like Airbyte do this. | Arbitrary JSON has unbounded structure. Auto-mapping `customer_id` → `source_id` and `product_sku` → `name` silently misrepresents the data. Cards with wrong field mappings look correct until viewed. | Require a known JSON format (array of objects with configurable field mappings) or a typed schema like the alto-index export. Explicit `ParseOptions` for field-to-column mapping. |
| Real-time sync / watch mode | Watch a folder for `.md` file changes and auto-import. Obsidian's live sync is popular. | The web runtime has no filesystem access. WKWebView is sandboxed. Watch mode requires native Swift integration — a separate milestone. Building an incomplete watch mode in the web runtime misleads users about capabilities. | Expose a clean import API that the native Swift shell calls. Swift FSEvents → Swift reads file → Swift passes bytes to Worker Bridge → import pipeline runs. The web runtime's job is to process bytes, not watch files. |
| Undo for import operations | Users might want to undo an import with Cmd+Z like other mutations. | The existing `MutationManager` command log holds inverse SQL in-memory. An import of 2,000 cards would generate 2,000 inverse INSERT statements, consuming significant memory and making the undo stack's pre-import state unreachable. Undo is a session-scoped, per-mutation feature. | Provide a dedicated "undo last import" feature keyed on `import_history.id` — DELETE all cards WHERE source = X AND import_run_id = Y. This is a targeted DELETE operation, not a command log inverse. Deferred to UI layer. |
| Importing binary attachment data (Base64) | `AltoAttachment.data` contains Base64-encoded image/PDF data. Store it in SQLite so attachments work offline. | sql.js stores everything in memory (WASM heap). The entire database must fit in memory. A single 10MB image encoded as Base64 adds ~13MB to the database. 50 photos would add 650MB — exceeding typical browser memory limits. | Store `mime_type` and `filename` as metadata on the `resource` card. Leave `content` null. The native Swift shell manages file storage in the file system. `source_url` on the resource card provides a back-reference. |
| Per-cell column mapping UI in this milestone | A drag-and-drop column mapper for Excel import, like Google Sheets import wizard. | UI components for column mapping are a significant frontend effort (dropdowns, preview, validation). Adding them to this milestone delays the pipeline. The auto-detection covers real-world exports. | Auto-detect columns in `findColumn()`. Accept explicit `ParseOptions` overrides programmatically. Build the mapping UI as a separate v1.1.x feature once the pipeline is validated. |
| SELECT * in DedupEngine lookup | Simple to write. Returns all columns for existing cards. | `DedupEngine` only needs `id, source, source_id, modified_at` to decide insert/update/skip. SELECT * fetches `content` for every card — potentially megabytes of text transferred through the Structured Clone Algorithm for no reason. | Project minimally: `SELECT id, source, source_id, modified_at FROM cards WHERE...`. |
| String interpolation for source keys in dedup SQL | Building `WHERE source \|\| ':' \|\| source_id IN (${sourceKeys})` with string-joined values. | The `sourceKeys` value is constructed from import data, which may contain attacker-controlled strings. This is the injection surface. | The `DedupEngine` in the spec uses string interpolation for the IN clause — this is a known gap. The values come from parsed import data, not user input, so the risk is moderate. Mitigation: normalize `source_id` to alphanumeric-plus-hyphen before lookup, or use a temp table approach. Research flag for implementation phase. |

---

## Parser Edge Cases

### Apple Notes Parser (AppleNotesParser)

**Format:** alto-index JSON export. Sync, in-memory parse (JSON.parse). No streaming needed — the alto-index format is a single JSON file.

| Edge Case | Behavior |
|-----------|----------|
| `note.title` is empty string | `extractTitle(content)` — use first non-empty line of content, up to 100 chars. Strip leading `# `. |
| `note.content` starts with `<` (HTML) | `htmlToMarkdown()` — strip tags, replace `<br>` with `\n`, convert `<strong>/<em>/<h1-3>/<a>` to Markdown equivalents, decode HTML entities. |
| `note.content` is empty string | `name` is set from `extractTitle('')` → `'...'`. `content: ''`. `summary: null`. Do not crash. |
| `AltoMention.name` varies in casing | Normalize to lowercase for Set deduplication within a note. Canonical case from first occurrence. |
| `AltoLink.target_note_id` is null | `parseLinks()` filters `link.type === 'note' && link.target_note_id` — null target IDs are silently dropped. |
| `AltoLink.target_note_id` refers to a note not in the export | The `CanonicalConnection.target_id` will be a dangling reference. `DedupEngine` resolves connections after cards — if `source_id` is not in `sourceIdMap`, the original `target_id` (alto ID) is used as-is. `SQLiteWriter.writeConnections()` uses `INSERT OR IGNORE` — connection silently dropped if target does not exist in `cards`. |
| `AltoAttachment.data` is Base64 | Do not store. Set `content: null`, `mime_type: att.mime_type`, `name: att.filename`. |
| `AltoNote.folder` is empty string | `normalizeFolder('')` → `''`. Map to `folder: null` — empty string folder should be null for SQL consistency. |
| Very large note content (>100KB) | No special handling needed — `content` is a TEXT column in SQLite (no size limit). `summary` is truncated to 200 chars. FTS5 indexes the full content. |
| Duplicate `AltoNote.id` values in export | Not expected but possible from export bugs. `DedupEngine` will catch on second import (source_id match). On first import, both are inserted with different UUIDs. Source provenance is preserved. |
| `notes` array is empty | Returns `{cards: [], connections: []}`. Orchestrator gets `{inserted: 0, ...}`. Not an error. |

**Encoding:** alto-index exports are UTF-8 JSON. `JSON.parse()` handles this natively. No BOM issues with JSON.

**Size:** A heavy Apple Notes user might export 5,000+ notes. At ~2KB average, that is ~10MB of JSON. `JSON.parse()` of 10MB takes ~50ms in a Web Worker — acceptable.

**Dependencies on existing schema:** Writes to `cards` (all types: note, event, resource, person) and `connections`. Requires `source` and `source_id` columns on `cards` (already in canonical schema). FTS5 triggers fire automatically.

---

### Markdown Parser (MarkdownParser)

**Format:** Array of `{path: string, content: string}` objects, passed as JSON string. The native Swift shell reads `.md` files from a folder and serializes them for the Worker Bridge.

**Library:** `gray-matter` v4.0.3 — parses YAML/TOML/JSON frontmatter. Battle-tested (used by Gatsby, Astro, VitePress, Netlify). Last version was 1+ year ago but the library is stable and widely used. No active development concerns. (Source: npm registry, gray-matter GitHub)

| Edge Case | Behavior |
|-----------|----------|
| No frontmatter in file | `gray-matter` returns `{data: {}, content: fullText}`. Title falls back to first `#` heading or filename. All optional fields null. |
| Frontmatter `tags` as YAML list | `Array.isArray(fm.tags)` → use directly. |
| Frontmatter `tags` as comma-separated string | `typeof fm.tags === 'string'` → `[fm.tags]` single-element array. Should split on comma: `fm.tags.split(',').map(t => t.trim())`. |
| Frontmatter `date` is a JavaScript Date object | `gray-matter` parses YAML dates as JS `Date` — `parseDate(value instanceof Date)` → `.toISOString()`. |
| Frontmatter `date` is invalid string | `new Date(value)` → `isNaN(d.getTime())` → return `null` → fall back to `new Date().toISOString()`. |
| File with only frontmatter, no body | `content` from gray-matter is `''`. `summary: null`. Name from frontmatter `title` or filename. |
| Nested frontmatter TOML delimiter (`+++`) | `gray-matter` supports TOML with `{engines: {toml: ...}}` option. Default config does not — will throw. Fix: add `gray-matter` TOML engine or silently treat as content. Decision: skip TOML for now; YAML is overwhelmingly standard for Obsidian/Bear. |
| Fenced code block containing `---` | `gray-matter` handles this correctly — it does not use regex. Does not misparse code blocks as frontmatter. HIGH confidence (confirmed in gray-matter docs). |
| Non-UTF-8 encoding | Files read by Swift as `String` — Swift's `String(contentsOfFile:)` defaults to UTF-8. Non-UTF-8 files cause Swift read failure before reaching parser. Out of scope for parser. |
| `[[wikilink]]` in content | Kept verbatim in `content` string. No extraction in this milestone. Future: regex `\[\[([^\]]+)\]\]` scan → `links_to` connections. |
| Very large file (>1MB) | `gray-matter` parses synchronously. A 1MB Markdown file takes <10ms. Not a concern in Worker. |
| `file.path` with Windows-style backslash separators | Unlikely from Swift, but: `pathParts = file.path.split('/')` — backslash paths produce single-element array. Folder becomes `''` → null. Normalize: replace `\\` with `/` before splitting. |
| Duplicate paths in input array | Both are parsed independently. Both are inserted with different UUIDs. `source_id = file.path` — DedupEngine will deduplicate on second import of same path. On first import, both are inserted (bug: duplicate path input is likely caller error). |

**Encoding:** UTF-8 via Swift. No BOM expected.

**Size:** 1,000 Obsidian files at ~5KB each = 5MB JSON payload to Worker. JSON.parse + gray-matter parse: ~100ms in Worker. Acceptable.

**Dependencies on existing schema:** Only `cards`. No connections generated in this milestone. Requires `source`, `source_id`, `folder`, `tags` columns.

---

### Excel Parser (ExcelParser)

**Format:** `ArrayBuffer` of `.xlsx` or `.xls` binary data.

**Library:** SheetJS (xlsx) — the dominant XLSX library for JavaScript. Community Edition is free. Version on npm is currently 0.18.5 (CEd). (Source: npm, SheetJS docs)

**Critical SheetJS constraint:** XLSX format stores ZIP central directory at end of file. True streaming reads are impossible. The entire file must be buffered in memory before parsing. SheetJS's `XLSX.stream` API is streaming *write* only. (Source: SheetJS streaming docs, GitHub issues #61, #1136)

| Edge Case | Behavior |
|-----------|----------|
| No header row | `sheet_to_json()` treats first row as headers. If first row is data, column names become `A`, `B`, `C`. Auto-detection in `findColumn()` will fail to find `title`/`name`. Falls back to `Row N` as name. |
| Sheet name specified but not found | `throw new Error('Sheet not found: ${sheetName}')` — surfaces in `ImportResult.errors`. |
| Multiple sheets | Only one sheet processed per call. Default: first sheet. Use `ParseOptions.sheet` to target a specific sheet by name or index. Multi-sheet import = multiple `orchestrator.import()` calls. |
| Empty cells | `sheet_to_json()` omits empty cells — resulting row object has no key for that column. `row[titleCol]` is `undefined`. `String(undefined)` → `'undefined'` — must guard with `?? ''`. |
| Merged cells | SheetJS unmerges them during parse — only the top-left cell of a merged region retains the value. Other cells in the range get empty. Expected behavior. |
| Dates in Excel | `{cellDates: true}` option converts Excel serial dates to JS `Date` objects. Without this option, dates are serial numbers (e.g., 44927). Always use `cellDates: true`. |
| File >50MB | SheetJS buffers the entire file. 50MB XLSX in a Web Worker is borderline. Impose a pre-parse size check and reject with a clear error. Do not attempt to parse files above the limit. |
| `.xls` (legacy format) | SheetJS supports `.xls`. `XLSX.read(data, {type: 'array'})` auto-detects format from magic bytes. No special handling. |
| Row with no title column value | `title = 'Row ${index + 1}'` fallback. Produces `name: 'Row 1'`, `name: 'Row 2'` etc. |
| Tags column with mixed delimiters | `tagsValue.split(/[,;]/)` — handles both comma and semicolon as delimiters. |
| Encoding | XLSX is a ZIP container with UTF-8 XML internals. SheetJS handles encoding transparently. No BOM issues. |

**Dependencies on existing schema:** Only `cards`. No connections. Source tracking: `source: 'excel'`, `source_id: 'row:${index}'` — row index is fragile (if rows are reordered between imports, dedup fails). Better: use a stable unique column if available (e.g., an `id` column). Auto-detect `id` column in `findColumn()` as a priority candidate.

---

### CSV Parser (CSVParser)

**Format:** String or `ArrayBuffer` of `.csv` or `.tsv` data. Parsed as text (CSVs are text-based unlike XLSX).

**Library:** PapaParse is the de facto standard for browser CSV parsing. 12M+ weekly downloads. Handles streaming, BOM, malformed rows, dynamic typing. The spec's `ExcelParser` handles CSV via SheetJS's `sheet_to_csv` utility, but a dedicated CSVParser using PapaParse is recommended for robust encoding and streaming support.

**Important encoding note:** Excel exports CSVs with UTF-8-BOM. PapaParse has a known bug where UTF-8-BOM on the first column header is included in the key name (e.g., `"\ufeff title"` instead of `"title"`). Workaround: always enable `bom: true` option in PapaParse config, or strip the BOM manually before parsing: `content.replace(/^\uFEFF/, '')`. (Source: PapaParse GitHub issue #840)

| Edge Case | Behavior |
|-----------|----------|
| UTF-8-BOM (Excel CSV export) | Strip BOM from string before parsing: `content.replace(/^\uFEFF/, '')`. Required for `findColumn()` to detect headers correctly. |
| Tab-separated values (.tsv) | PapaParse `{delimiter: '\t'}` or auto-detect. |
| Quoted fields with embedded commas | PapaParse handles RFC 4180 quoting correctly. |
| Quoted fields with embedded newlines | PapaParse handles multi-line quoted fields. |
| Mismatched field count (ragged rows) | PapaParse `{skipEmptyLines: true}` — short rows get `undefined` for missing fields. `?? ''` guard in `rowToCard()`. |
| Very large CSV (100K rows) | PapaParse supports streaming via `chunk` callback — processes N rows at a time. Use streaming mode for files >10MB to avoid building a 100K-element array in memory before passing to dedup. |
| No header row | PapaParse `{header: false}` returns arrays instead of objects. Add config option; default assumes headers present. |
| Empty file | PapaParse returns empty data array. `ImportResult: {inserted: 0, ...}`. Not an error. |
| UTF-16 encoding | UTF-16 files will not parse correctly as UTF-8 strings. Swift's `String(contentsOfFile:encoding:.utf16)` must detect encoding before passing to Worker. Out of scope for parser. |

**Dependencies on existing schema:** Same as Excel parser. `source: 'csv'`, `source_id: 'row:${index}'`.

---

### JSON Parser (JSONParser)

**Format:** String of JSON. Expected shape: array of objects (one object per card). Fields are configurable via `ParseOptions`.

**Library:** Native `JSON.parse()`. No third-party library needed.

| Edge Case | Behavior |
|-----------|----------|
| Top-level object instead of array | Wrap: `if (!Array.isArray(data)) data = [data]`. Imports as a single card. |
| Nested JSON objects as field values | Flatten to `JSON.stringify(value)` for `content`. Deep nesting is not mappable to `CanonicalCard` without explicit column mapping. |
| Very large JSON file (50MB, 100K records) | `JSON.parse()` of 50MB takes ~500ms in a Web Worker. Acceptable. For >100MB, streaming parse (using `json-parse-even-better-errors` or a streaming JSON parser) would be needed — deferred. |
| `null` values in fields | `?? null` guards in mapper. Null maps to `null` in `CanonicalCard`. |
| ISO date strings | `parseDate(value)` — `new Date(value).toISOString()`. Handles `2024-01-15T10:30:00Z`, `2024-01-15`, `January 15, 2024`. |
| Non-standard date formats | `new Date(value)` fails → `isNaN` → `null` → fall back to import time. |
| Array field values (e.g., tags as JSON array) | Tags field: if value is `Array`, use directly. If string, split on comma/semicolon. |

**Dependencies on existing schema:** Same as CSV. No connections in generic JSON import.

---

### HTML Parser (HTMLParser)

**Format:** String of HTML. Use case: web clippings saved from Safari or a browser extension.

**Library:** `@mozilla/readability` — the same content extraction algorithm that powers Firefox Reader View. Strips navigation, ads, sidebars; extracts article content, title, byline. Requires a DOM environment. In a Web Worker, use `linkedom` or `jsdom` as a lightweight DOM implementation for the Worker context.

**Security note:** Readability operates on DOM. If the HTML comes from untrusted sources, XSS is a concern in non-Worker contexts. In a Web Worker, there is no live DOM execution. Still: strip `<script>` tags before parsing. (Source: Mozilla Readability GitHub security note)

| Edge Case | Behavior |
|-----------|----------|
| Email newsletter HTML (heavy boilerplate) | Readability strips sidebars/ads and extracts the main body text. Imperfect but functional. |
| Single-page-app shell HTML (no content) | Readability returns null content. Fall back to `document.body.textContent` stripped of script tags. |
| Missing `<title>` tag | Readability `.title` returns `''`. Fall back to first `<h1>` text, then first 50 chars of body. |
| Non-ASCII characters (CJK, Arabic, etc.) | HTML `charset` meta tag declares encoding. Swift reads the file as Data and passes it as ArrayBuffer. `TextDecoder` in Worker uses charset from meta tag or defaults to UTF-8. |
| Malformed HTML | `linkedom`/`jsdom` parsers are lenient — they produce a best-effort DOM. Readability operates on whatever DOM is produced. |
| Very large HTML (10MB) | `linkedom` parse of 10MB takes ~200ms in Worker. Acceptable. |
| `<img>` tags | Readability preserves `<img>` in extracted content. For Isometry, convert to Markdown `![]()` syntax or strip. Config option: `{preserveImages: boolean}`. |
| Internal links (`<a href="#section">`) | Strip or convert to plain text. Not useful as `source_url`. |
| `<meta property="article:published_time">` | Extract for `created_at`. Readability does not do this automatically — add a pre-parse extraction step for common OG/Twitter meta tags. |

**Dependencies on existing schema:** Only `cards` (`card_type: 'note'`). `source: 'html'`, `source_id: url || filename`. `url` field on CanonicalCard populated from `<link rel="canonical">` or the source URL.

---

## Feature Dependencies

```
[Existing Card CRUD + FTS5 triggers] (COMPLETED — v0.1/v1.0)
    └──required-by──> [SQLiteWriter] (INSERT INTO cards uses same path as Card CRUD)
                          └──triggers-automatically──> [FTS5 index sync]

[Worker Bridge typed RPC] (COMPLETED — v1.0)
    └──required-by──> [DedupEngine] (bridge.query for existing card lookup)
    └──required-by──> [SQLiteWriter] (bridge.transaction for batched inserts)
    └──required-by──> [ImportOrchestrator] (bridge.postMessage for progress events)
    └──required-by──> [ExportOrchestrator] (bridge.query for card selection)

[CanonicalCard / CanonicalConnection interfaces]
    └──required-by──> [All parsers] (parsers output these types)
    └──required-by──> [DedupEngine] (takes CanonicalCard[], returns partitioned arrays)
    └──required-by──> [SQLiteWriter] (maps CanonicalCard fields to SQL params)

[AppleNotesParser]
    └──outputs──> [CanonicalCard[] + CanonicalConnection[]]
    └──depends-on──> [gray-matter is NOT needed] (alto-index is JSON, not Markdown)
    └──depends-on──> [crypto.randomUUID()] (Web Crypto API — available in Web Worker)

[MarkdownParser]
    └──outputs──> [CanonicalCard[]] (no connections in v1.1)
    └──depends-on──> [gray-matter npm package] (frontmatter parsing)
    └──depends-on──> [crypto.randomUUID()]
    └──future-enhances-with──> [wikilink extraction → CanonicalConnection[]]

[ExcelParser]
    └──outputs──> [CanonicalCard[]]
    └──depends-on──> [SheetJS (xlsx) npm package] (XLSX/XLS binary parsing)
    └──depends-on──> [crypto.randomUUID()]

[CSVParser] (separate from ExcelParser, spec conflates them)
    └──outputs──> [CanonicalCard[]]
    └──depends-on──> [PapaParse npm package] (recommended) or SheetJS CSV mode
    └──depends-on──> [BOM stripping utility]

[JSONParser]
    └──outputs──> [CanonicalCard[]]
    └──depends-on──> [native JSON.parse()] (no third-party library)

[HTMLParser]
    └──outputs──> [CanonicalCard[]]
    └──depends-on──> [@mozilla/readability npm package] (content extraction)
    └──depends-on──> [linkedom or jsdom] (DOM environment for Worker context)

[DedupEngine]
    └──requires──> [All parsers] (receives their output)
    └──requires──> [Worker Bridge] (queries existing cards)
    └──requires──> [sourceIdMap] (resolves connection references)
    └──outputs──> [DedupResult: {toInsert, toUpdate, toSkip, connections, sourceIdMap}]

[SQLiteWriter]
    └──requires──> [DedupEngine output]
    └──requires──> [Worker Bridge] (transaction execution)
    └──writes-to──> [cards table] (triggers FTS5 automatically)
    └──writes-to──> [connections table]
    └──does-NOT-write-to──> [FTS5 table directly] (triggers handle it)

[ImportOrchestrator]
    └──requires──> [All parsers]
    └──requires──> [DedupEngine]
    └──requires──> [SQLiteWriter]
    └──requires──> [Worker Bridge progress events]
    └──writes-to──> [import_history table] (new catalog table)

[ExportOrchestrator]
    └──requires──> [Worker Bridge] (query cards)
    └──reads-from──> [cards table only] (connections not exported in v1.1)
    └──formats──> [Markdown | JSON | CSV]

[Data Catalog Schema]
    └──requires──> [new migration] (import_history, sources tables)
    └──integrated-by──> [ImportOrchestrator] (writes import_history rows)

[ExportOrchestrator] ──uses──> [SelectionProvider cardIds] (integration with existing UI)
```

### Dependency Notes

- **Card CRUD path is the write path.** `SQLiteWriter` must use the same `INSERT INTO cards` SQL as the existing Card CRUD — not a shortcut or bulk INSERT that bypasses triggers. FTS5 sync depends on triggers firing. If the INSERT path changes, FTS breaks silently.
- **gray-matter is required for MarkdownParser, nothing else.** The Apple Notes parser does not need it — alto-index is plain JSON. Do not add gray-matter to parsers that do not need it.
- **SheetJS for XLSX, PapaParse for CSV.** The spec's `ExcelParser` handles both, but SheetJS CSV mode is slower and less robust than PapaParse for large files. Separate the parsers.
- **DedupEngine requires cards to be inserted before connections can be resolved.** The `sourceIdMap` is built during card dedup. Connection `source_id`/`target_id` are resolved against this map. Order: (1) parse all cards, (2) dedup cards, (3) insert cards, (4) resolve connection references, (5) insert connections.
- **Data Catalog tables require a schema migration.** `import_history` and `sources` are new tables. They must be added to the SQLite schema initialization code. The existing schema versioning pattern must be followed.
- **Progress events use existing Worker Bridge protocol.** No new infrastructure. Add `import_progress` as a new `WorkerMessage.type` value in the typed message union.

---

## MVP Definition

### Launch With (v1.1 — ETL Pipeline)

Minimum viable: the pipeline is end-to-end, data flows from real sources into the existing views, and re-imports are safe.

- [ ] **CanonicalCard / CanonicalConnection interfaces** — The type contract all parsers and writers share. Must be defined first.
- [ ] **Data Catalog schema migration** — `import_history` and `sources` tables added to SQLite init.
- [ ] **AppleNotesParser** — Primary data source. Extracts notes, tasks (checklist items), attachments, mentions, internal links as cards and connections.
- [ ] **MarkdownParser (gray-matter)** — Obsidian/Bear compatibility. Frontmatter parsing. Tag extraction.
- [ ] **ExcelParser (SheetJS)** — Spreadsheet import with column auto-detection. `cellDates: true`.
- [ ] **CSVParser (PapaParse)** — CSV/TSV with BOM handling, large-file streaming.
- [ ] **JSONParser** — Generic JSON array import with configurable field mapping.
- [ ] **HTMLParser (@mozilla/readability + linkedom)** — Web clipping content extraction.
- [ ] **DedupEngine** — `source:source_id` exact match. Insert/update/skip partitioning. Connection reference resolution via `sourceIdMap`.
- [ ] **SQLiteWriter** — Batched INSERT with batch size 100. Uses existing `cards` INSERT path (FTS triggers fire). `INSERT OR IGNORE` for connections.
- [ ] **ImportOrchestrator** — Wires parsers → dedup → writer. Progress events over Worker Bridge. Writes `import_history` row.
- [ ] **ExportOrchestrator** — Markdown (with valid YAML frontmatter), JSON (complete backup), CSV (RFC 4180 with proper quoting). Optional `cardIds` filter.
- [ ] **Worker handler integration** — `handleETLImport` and `handleETLExport` in Worker message router.

### Add After Validation (v1.1.x)

- [ ] **Column mapping UI for Excel/CSV** — Trigger: user feedback that auto-detection fails on their specific exports.
- [ ] **Markdown wikilink extraction** — Trigger: Obsidian/Logseq users with heavily interlinked vaults want graph views populated.
- [ ] **Cross-source entity resolution** — Trigger: users report the same person appearing as multiple cards from different sources.
- [ ] **"Undo last import" via import_history** — Trigger: users accidentally import wrong file and need a clean rollback.
- [ ] **Multi-sheet Excel import** — Trigger: users have workbooks with multiple meaningful sheets.

### Future Consideration (v2+)

- [ ] **Real-time file watch (folder sync)** — Requires native Swift FSEvents integration; not a web runtime concern.
- [ ] **Streaming JSON parse for >100MB files** — Only relevant at scale that is unlikely for personal PKM use.
- [ ] **Notion/Evernote importers** — Opportunity after Apple Notes and Markdown parsers are validated.
- [ ] **Bi-directional sync (export then re-import without duplication)** — Requires stable round-trip `source_id` preservation in exported files.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| CanonicalCard/Connection interfaces | HIGH | LOW | P1 | Phase 8 (foundation) |
| Data Catalog schema migration | HIGH | LOW | P1 | Phase 8 |
| AppleNotesParser (primary source) | HIGH | MEDIUM | P1 | Phase 8 |
| DedupEngine (idempotent imports) | HIGH | MEDIUM | P1 | Phase 8 |
| SQLiteWriter (batched inserts) | HIGH | LOW | P1 | Phase 8 |
| ImportOrchestrator (pipeline wiring) | HIGH | LOW | P1 | Phase 8 |
| MarkdownParser + gray-matter | HIGH | LOW | P1 | Phase 9 |
| ExcelParser + SheetJS | MEDIUM | LOW | P1 | Phase 9 |
| CSVParser + PapaParse | MEDIUM | LOW | P1 | Phase 9 |
| ExportOrchestrator (Markdown/JSON/CSV) | HIGH | LOW | P1 | Phase 9 |
| Worker handler integration | HIGH | LOW | P1 | Phase 9 |
| JSONParser | MEDIUM | LOW | P2 | Phase 9 |
| HTMLParser + readability | MEDIUM | MEDIUM | P2 | Phase 10 |
| Progress reporting over Worker Bridge | MEDIUM | LOW | P2 | Phase 10 |
| import_history write per run | MEDIUM | LOW | P2 | Phase 10 |
| Markdown wikilink extraction | MEDIUM | MEDIUM | P3 | v1.1.x |
| Column mapping UI | LOW | HIGH | P3 | v1.1.x |
| Multi-sheet Excel import | LOW | LOW | P3 | v1.1.x |

**Priority key:**
- P1: Required for milestone completion
- P2: Part of milestone, does not block P1
- P3: Explicitly deferred — do not implement in this milestone

---

## Competitor Feature Analysis

Context: what users migrating from these tools expect the import to handle.

| Feature | Obsidian Importer | Bear | Notion | Isometry v1.1 Approach |
|---------|-------------------|------|--------|------------------------|
| Markdown frontmatter | Yes (YAML) | No (custom syntax) | No | Yes — gray-matter parses YAML. Bear exports use `#tags` in body, not frontmatter. |
| Folder hierarchy | Yes (file path) | Tags only | Database hierarchy | Yes — `file.path` directory parts → `folder` field. |
| Internal links | Wikilinks → broken after import | Note links → broken | Page links → broken | v1.1: preserved verbatim in `content`. v1.1.x: extracted as `connections`. |
| Tags | Yes | Yes (hashtag in body) | Yes | Yes — frontmatter `tags`, body `#hashtag`, or configurable column. |
| Timestamps | Yes (file modification time) | Yes | Yes | Yes — frontmatter `date`/`created`/`modified` or file metadata from Swift. |
| Attachments | External files | Inline (base64 in export) | File upload | Metadata only (filename, mime_type). Binary data not stored in sql.js. |
| Idempotent re-import | Yes (overwrites files) | N/A | No (creates duplicates) | Yes — DedupEngine source+source_id keying. |
| Export formats | Markdown, PDF | Markdown, PDF, DOCX | Markdown, CSV, PDF | Markdown, JSON, CSV. No PDF in v1.1. |
| Export with frontmatter | Yes | Partial | No | Yes — ExportOrchestrator emits valid YAML frontmatter parseable by gray-matter on re-import. |

---

## Sources

- Project spec: `v5/Modules/DataExplorer.md` — canonical interface definitions, all parser implementations
- Project context: `.planning/PROJECT.md` — milestone scope, locked architecture decisions
- gray-matter npm: [npmjs.com/package/gray-matter](https://www.npmjs.com/package/gray-matter) — v4.0.3, stable, YAML/TOML/JSON frontmatter
- gray-matter GitHub: [jonschlinkert/gray-matter](https://github.com/jonschlinkert/gray-matter) — fenced code block edge case handling confirmed
- SheetJS streaming docs: [sheetjs.com docs/demos/bigdata/stream](https://docs.sheetjs.com/docs/demos/bigdata/stream/) — streaming write only, not read
- SheetJS GitHub issue #61: [XLSX read streaming limitation confirmed](https://github.com/SheetJS/sheetjs/issues/61)
- PapaParse: [papaparse.com](https://www.papaparse.com/) — BOM handling, streaming, RFC 4180
- PapaParse BOM issue #840: [UTF-8-BOM first-column header bug](https://github.com/mholt/PapaParse/issues/840)
- Mozilla Readability: [philna.sh/blog/2025/01/09/html-content-retrieval-augmented-generation-readability-js/](https://philna.sh/blog/2025/01/09/html-content-retrieval-augmented-generation-readability-js/) — Readability.js for content extraction
- Obsidian Importer (Bear): [help.obsidian.md/import/bear](https://help.obsidian.md/import/bear) — import format expectations
- PKM portability pain points: [tandfonline.com — data export user study](https://www.tandfonline.com/doi/full/10.1080/07370024.2024.2325347)
- ETL dedup strategies: [airbyte.com deduplication](https://airbyte.com/data-engineering-resources/the-best-way-to-handle-data-deduplication-in-etl)
- JSON large file handling: [jsonutils.online/en/blog/parsing-large-json-files](https://jsonutils.online/en/blog/parsing-large-json-files)

---

*Feature research for: ETL Import/Export Pipeline — Personal Knowledge Base (Isometry v1.1 milestone)*
*Researched: 2026-03-01*
