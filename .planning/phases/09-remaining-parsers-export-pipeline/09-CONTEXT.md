# Phase 9: Remaining Parsers + Export Pipeline - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Five new parsers (Markdown, Excel, CSV, JSON, HTML) plus a tri-format export pipeline (Markdown/JSON/CSV). Users can import from all six supported sources and export their data — covering every major PKM migration and backup scenario.

Import parsers follow the established Phase 8 pattern: parse input into CanonicalCard[] + CanonicalConnection[] + ParseError[], then pass through DedupEngine and SQLiteWriter via ImportOrchestrator. Export is a new pipeline: query cards from DB, serialize to chosen format, return string via WorkerBridge.

</domain>

<decisions>
## Implementation Decisions

### Column Auto-Detection
- Shared ColumnMapper utility used by CSV, Excel, and JSON parsers — same candidate lists, same case-insensitive matching across all three
- Claude's discretion on unmapped columns (likely: ignore with count in ImportResult)
- JSON parser accepts both arrays of objects AND single objects (auto-wrap), plus common wrapper keys like `{"cards": [...]}` or `{"data": [...]}`
- Any row with at least one mapped field becomes a card — title auto-generates from content snippet or "Untitled" if not mapped
- Shared mapper defines canonical candidate lists: title/name, content/body, date/created, tags/labels (per roadmap)

### Export Format Details
- Configurable export scope: default to user-facing fields (name, content, tags, folder, timestamps, url), optional flag to include system fields (id, source, source_id, deleted_at, sort_order, priority)
- Markdown export: YAML frontmatter array for tags `tags: [tag1, tag2, tag3]` — standard Obsidian/Bear format, round-trips with gray-matter
- CSV export: semicolon-delimited tags in cells (per roadmap spec)
- Cards only in exports (no connections) — connections are structural metadata, not user content
- JSON export: all non-deleted card columns with tags as parsed array (per roadmap success criteria)

### HTML Parser Strategy
- Use node-html-parser (zero DOM dependencies, Worker-safe) — not linkedom or regex fallback
- Convert HTML structure to Markdown: `<h1>` to `# heading`, `<a>` to `[text](url)`, `<ul>`/`<li>` to bullet lists
- Strip embedded images/media completely — parser focuses on text content
- One card per HTML input string — no multi-article splitting
- Extract title from `<title>` or first `<h1>`, `created_at` from `<meta property="article:published_time">`, `source_url` from `<link rel="canonical">` (per roadmap)
- Strip `<script>` and `<style>` blocks before any text extraction (per P29)

### Error & Edge Cases
- All five parsers follow AppleNotesParser's per-item error collection pattern: fail individually, continue parsing
- Fail-fast for structural errors: corrupt JSON syntax, unreadable XLSX → reject whole import immediately; per-item errors for data issues within a valid file
- Excel 50MB size limit only (per P27) — text formats don't need size guards
- MarkdownParser: YAML frontmatter only (standard `---` delimited). Obsidian/Hugo/Jekyll compatible. No Bear/Logseq special formats.
- Claude's discretion on duplicate column headers (likely first-occurrence wins)

### Claude's Discretion
- Exact ColumnMapper candidate list expansion beyond roadmap minimums
- Unmapped column handling strategy (ignore vs. append to content)
- Duplicate column header handling
- Size limits for text formats (if technically warranted)
- Internal ExportOrchestrator architecture

</decisions>

<specifics>
## Specific Ideas

- JSON parser should be forgiving: accept `[{...}]`, `{...}`, and `{"cards": [...]}` / `{"data": [...]}` wrapper patterns
- Markdown export must round-trip: exported YAML frontmatter should be parseable by gray-matter (the same library used for import)
- HTML-to-Markdown conversion gives richer card content than plain text stripping
- Per-item errors for data issues, fail-fast for structural corruption — two-tier error model

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppleNotesParser` (src/etl/parsers/AppleNotesParser.ts): Established parse() → {cards, connections, errors} pattern. All new parsers follow this interface.
- `ImportOrchestrator` (src/etl/ImportOrchestrator.ts): Orchestrates parser → DedupEngine → SQLiteWriter pipeline. New parsers plug in via SourceType dispatch.
- `DedupEngine` (src/etl/DedupEngine.ts): Content-hash deduplication. Used by all parsers via ImportOrchestrator.
- `SQLiteWriter` (src/etl/SQLiteWriter.ts): Batched card/connection writing with FTS optimization.
- `CatalogWriter` (src/etl/CatalogWriter.ts): Import run tracking for catalog history.
- `etl-import.handler.ts`: Worker handler pattern — new parsers auto-activate via SourceType.
- `etl-export.handler.ts`: Stub exists, ready for Phase 9 implementation.
- `gray-matter`: Already imported in AppleNotesParser. Reuse for MarkdownParser and Markdown export.

### Established Patterns
- Parser returns `{cards: CanonicalCard[], connections: CanonicalConnection[], errors: ParseError[]}` — all new parsers must match
- SourceType union already includes all six types ('apple_notes' | 'markdown' | 'excel' | 'csv' | 'json' | 'html')
- Worker handler thin delegation: handler function delegates to orchestrator/domain logic
- WorkerBridge protocol already has `etl:export` message type (stubbed)

### Integration Points
- `src/etl/index.ts`: Export new parsers and ExportOrchestrator
- `src/worker/handlers/etl-import.handler.ts`: ImportOrchestrator already dispatches by SourceType — new parsers register automatically
- `src/worker/handlers/etl-export.handler.ts`: Replace stub with real delegation to ExportOrchestrator
- `src/worker/protocol.ts`: `etl:export` payload/response types need real definitions
- `src/bridge/WorkerBridge.ts`: `exportFile()` method needs implementation

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-remaining-parsers-export-pipeline*
*Context gathered: 2026-03-01*
