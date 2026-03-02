# Phase 9: Remaining Parsers + Export Pipeline - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Import from 5 additional sources (Markdown/Obsidian, CSV, JSON, Excel, HTML web clippings) and export to 3 formats (Markdown, JSON, CSV). Covers PKM migration and backup scenarios. Phase 8 established the pipeline (DedupEngine, SQLiteWriter, CatalogWriter, ImportOrchestrator) — this phase adds parsers and export.

</domain>

<decisions>
## Implementation Decisions

### Field Mapping Flexibility

- **Column header matching:** Fuzzy auto-detect (Title, title, NAME, heading all → name field)
- **Unmapped columns:** Merge into content field as `key: value` pairs
- **Markdown card name:** Cascade: frontmatter `title` → first `# heading` → filename
- **JSON schema:** Auto-detect common patterns (arrays, nested `items`/`data`/`records` keys, single object)
- **Tag parsing:** Source-aware (CSV: comma/semicolon, JSON: array or comma string, Markdown: frontmatter array)
- **Ambiguous dates:** Prefer ISO 8601, then locale-aware for ambiguous formats like `01/02/2024`
- **Markdown folders:** Preserve directory structure as `folder` field (file at `/vault/projects/work.md` → folder='projects')
- **Card type:** Default all imports to `card_type='note'` — user can reclassify later
- **Missing required fields:** Generate defaults (missing name → 'Untitled', missing dates → now())
- **Excel sheets:** Import first/active sheet only
- **Wikilinks:** Convert `[[Other Note]]` to `links_to` connections when target exists in import
- **HTML images:** Extract `src` URLs only, no binary storage
- **CSV encoding:** UTF-8 with BOM detection (auto-strip BOM if present)
- **Frontmatter format:** YAML (`---`) only, no TOML (`+++`) support
- **JSON nesting:** Shallow flatten (top-level nested objects become JSON strings in content)
- **Excel dates:** Convert to ISO 8601 strings
- **Source IDs:** Preserve original IDs in `source_id` field for re-import deduplication
- **Markdown without frontmatter:** Use file system timestamps for `created_at`/`modified_at`
- **HTML title extraction:** Cascade: `<title>` → first `<h1>` → first substantial text
- **Ragged CSV rows:** Pad short rows with nulls, continue import

### Export Format Contents

- **Markdown frontmatter:** Include ALL non-null card fields (comprehensive backup)
- **JSON formatting:** Pretty-printed with 2-space indentation
- **CSV tags:** Semicolon-separated (`tag1;tag2;tag3`) to avoid comma conflicts
- **Deleted cards:** Exclude from all exports (only active cards)
- **Markdown connections:** Append as Wikilinks (`[[Connected Card Name]]`) at bottom of each note
- **JSON connections:** Top-level `connections` array alongside `cards` array
- **Type filtering:** Support optional `cardTypes` filter parameter
- **CSV columns:** Include all card table columns

### HTML Parsing Approach

- **Parser strategy:** Regex-based stripping (simple, Worker-safe, handles 80% of cases)
- **Metadata extraction:** Extract common meta tags (og:title, article:published_time, canonical URL)
- **Content conversion:** Convert HTML to Markdown (not plain text)
- **Elements preserved:** Everything possible — bold, italic, links, headings, lists, code blocks, tables, blockquotes, images (as `![](url)`), horizontal rules
- **Malformed HTML:** Sanitize first, then parse (clean up before extraction)
- **Tables:** Convert `<table>` to GFM Markdown tables
- **Source URL:** Store in `source_url` field from canonical link or og:url
- **Code blocks:** Preserve language class (`<code class="language-js">` → ```js)
- **HTML comments:** Preserve as Markdown comments (`[//]: # (comment)`)
- **HTML entities:** Decode to Unicode (`&amp;` → `&`)
- **Author extraction:** Extract author from meta/byline, create person card with mentions connection
- **iframe embeds:** Extract src URL as resource card linked to main card

### Error Tolerance

- **Batch errors:** Continue import, collect all errors in `ImportResult.errors_detail`
- **File size limits:** No enforced limits (user accepts OOM risk for very large files)
- **Invalid cell data:** Coerce to string (date field with 'TBD' stores as string)
- **Error reporting:** Detailed report with row numbers, source_ids, and error messages

### Claude's Discretion

- Exact regex patterns for HTML stripping
- HTML sanitization library choice
- Markdown conversion edge cases
- Column header synonym lists for fuzzy matching
- JSON path detection heuristics

</decisions>

<specifics>
## Specific Ideas

- Wikilinks should create connections that survive re-import (using DedupEngine's sourceIdMap)
- HTML to Markdown conversion should handle real-world messy web pages gracefully
- Export round-trip: Markdown exported should be re-importable with same data

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppleNotesParser`: Established parser pattern returning `CanonicalCard[]` and `CanonicalConnection[]`
- `attachments.ts`: Helpers for hashtag extraction, link parsing, table conversion
- `DedupEngine`: Handles re-import classification (insert/update/skip)
- `SQLiteWriter`: Batched writes with FTS optimization
- `CatalogWriter`: Import provenance tracking
- `ImportOrchestrator`: Pipeline coordination (parser → dedup → writer → catalog)
- `gray-matter`: Already installed for YAML frontmatter parsing

### Established Patterns
- Parsers return `{ cards: CanonicalCard[], connections: CanonicalConnection[] }`
- All dates as ISO 8601 strings
- Tags as `string[]` (SQLiteWriter handles JSON serialization)
- Source tracking via `source` and `source_id` fields

### Integration Points
- `ImportOrchestrator.import()` dispatches to parsers by source type
- Worker handler `etl:import` / `etl:export` message types ready
- `WorkerBridge.importFile()` and `exportFile()` methods exist (export needs implementation)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-remaining-parsers-export-pipeline*
*Context gathered: 2026-03-01*
