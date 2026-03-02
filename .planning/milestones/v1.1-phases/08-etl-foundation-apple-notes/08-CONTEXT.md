# Phase 8: ETL Foundation + Apple Notes Parser - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Import Apple Notes (via alto-index Markdown exports) into the database with full graph extraction, idempotent re-import, and source provenance. Notes become `note` cards, @mentions become `person` cards, attachments become `resource` cards (with files copied to managed storage), hashtags become tags, and internal links become `links_to` connections. External URLs in `links[]` create `resource` cards. Tables are converted to Markdown syntax. DedupEngine enables idempotent re-import. CatalogWriter tracks import runs for auditing.

</domain>

<decisions>
## Implementation Decisions

### Apple Notes Export Format
- Alto-index exports as **Markdown files with YAML frontmatter**, not JSON
- Parser reads all `.md` files from a folder (recursive traversal)
- Frontmatter fields: `title`, `id`, `created`, `modified`, `folder`, `attachments[]`, `links[]`, `source`
- Use alto-index numeric `id` as `source_id` — enables idempotent re-import matching
- Store `notes://showNote?identifier=...` URL in `source_url` column for linking back to Apple Notes
- For card `name`: use frontmatter `title` if present, fall back to first heading or first line of content

### Folder Mapping
- Preserve full folder path from alto-index (e.g., `Learning/ClaudeAI`) as card's `folder` value

### Hashtag Extraction
- Parse `com.apple.notes.inlinetextattachment.hashtag` attachments and extract tag names (e.g., `#ClaudeAI` → `ClaudeAI`)
- Add extracted tags to the card's `tags` array column
- Do not duplicate hashtag text in content body

### Graph Extraction — @Mentions
- Parse `@mentions` from note content via regex
- Match patterns: try `@FirstName LastName` (two words) first, fall back to `@SingleWord`
- Deduplicate person cards by name — single person card per unique name, all notes connect to it
- Connection label: `mentions`

### Graph Extraction — Internal Note Links
- Resolve `com.apple.notes.inlinetextattachment.link` attachments that link to other notes
- Create `links_to` connections between note cards when alto-index ID can be resolved

### Graph Extraction — External URLs
- Parse `links[]` array from frontmatter (contains URLs like mailto:, https://)
- Create `resource` cards for each URL
- Connection from note to resource: `links_to`

### Attachment Handling
- Copy binary files (images, videos, PDFs, etc.) to Isometry's managed `attachments/` directory in app support folder
- Create `resource` cards with full metadata: file path, mime_type, original filename, size, attachment UUID from alto-index
- Connection from note to attachment: `contains`
- Import all files regardless of type or size — no filtering

### Table Conversion
- Parse `com.apple.notes.table` attachments (stored as HTML)
- Convert to Markdown table syntax for storage in card content

### Thumbnail Generation
- Generate thumbnails for images (jpeg, png, webp) during import
- Use Browser Canvas API in Worker thread — no native dependencies
- Thumbnail size: 400px max dimension (preserve aspect ratio)
- Store thumbnail alongside original in managed storage

### Import Result Structure
- Return both summary counts AND optional detailed per-card log for debugging
- Counts: `inserted`, `updated`, `unchanged`, `skipped`, `errors`, `connections_created`
- Distinguish between `updated` (content changed) and `unchanged` (skipped because identical)
- Include `insertedIds: string[]` array so UI can navigate to imported content
- Continue on error — skip problematic files, log the error, continue importing others

### Import Runs Table (Provenance)
- Store full run metadata: source type, source path, timestamp, counts (inserted/updated/skipped/errors), errors_json array
- Import runs are queryable via Worker Bridge for auditing

### Claude's Discretion
- Exact regex patterns for @mention detection
- File organization structure within `attachments/` folder (by date, by source, flat, etc.)
- Thumbnail file naming convention
- Error message formatting in errors_json

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkerBridge` (src/worker/WorkerBridge.ts): Typed message passing — add `etl:import` and `etl:export` methods
- `protocol.ts` (src/worker/protocol.ts): `WorkerRequestType` union, `WorkerPayloads`, `WorkerResponses` — extend for ETL
- `worker.ts` router: Exhaustive switch pattern — add `etl:import` and `etl:export` cases
- `handlers/` pattern: One handler per domain (cards, connections, search, graph) — follow for `etl-import.handler.ts`
- `Card` type (src/database/queries/types.ts): Already has `source`, `source_id`, `source_url` columns
- `CardInput` interface: Already supports all needed fields including `tags`, `folder`, `source`

### Established Patterns
- Handlers return `WorkerResponses[T]` type — follow for ETL responses
- Database operations via `Database` class methods (`db.prepare()`, `db.run()`)
- Correlation IDs for async request/response matching
- 30-second default timeout — will need override for long imports (300s per roadmap)

### Integration Points
- Worker entry point: `src/worker/worker.ts` router switch statement
- Bridge singleton: `getWorkerBridge()` from `src/worker/WorkerBridge.ts`
- Schema: `src/database/schema.sql` — need to add `import_sources` and `import_runs` tables

</code_context>

<specifics>
## Specific Ideas

- Alto-index export folder is at: `/Users/mshaler/Library/Containers/com.altoindex.AltoIndex/Data/Documents/alto-index/notes`
- The export contains ~200 notes across folders like Learning/ClaudeAI, Growth, House, Family, etc.
- Attachment types seen: hashtags (6805), jpegs (6302), URLs (1683), pngs (1652), tables (802), webp (441), gifs (412), videos (145+), PDFs (61)
- Files include large HTML web clippings (some 3MB+) and videos (7MB+)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 08-etl-foundation-apple-notes*
*Context gathered: 2026-03-01*
