# Phase 36: Notes Content Extraction - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the full body text from Apple Notes' gzip-compressed protobuf ZDATA blobs, surface attachment metadata, create connections for internal note-to-note links, and make all content FTS5-searchable. Replaces the 100-char ZSNIPPET preview from Phase 35 with complete note content. No changes to the NativeImportAdapter protocol, bridge pipeline, or TypeScript ETL handler structure.

</domain>

<decisions>
## Implementation Decisions

### Body Text Formatting
- Best-effort Markdown with high fidelity — formatting loss should be minimized
- Map Apple Notes paragraph styles to Markdown heading levels: Title -> #, Heading -> ##
- Preserve all inline styles: bold -> **bold**, italic -> *italic*, strikethrough -> ~~text~~
- Render checklists as Markdown checkboxes: - [ ] unchecked, - [x] checked
- Render ordered lists as 1. 2. 3. numbered items; unordered as - bullet lists
- Render tables as | col1 | col2 | Markdown tables (same approach as AppleNotesParser.ts)
- Render code-styled text as ``` fenced code blocks
- Render quote-styled paragraphs as > Markdown blockquotes
- Preserve embedded URLs as [text](url) Markdown links
- Insert inline media placeholders where attachments appeared: [Image: sunset.jpg], [Drawing], etc.
- Auto-generate ~200-char summary from the full body text (same pattern as AppleNotesParser.ts generateSummary)
- Re-extract hashtags from the full body text (not just ZSNIPPET) — catches tags deeper in the note

### Attachment Metadata
- Tags for filterability: bare type names as tags (image, pdf, drawing, audio, video, scan, etc.)
- Append ## Attachments section at end of body content with bullet list of [Type] filename entries
- Cross-reference filenames between inline placeholders in body and Attachments section entries
- Show filename only (no system file paths — not portable across devices)
- Show human-friendly type category only (Image, PDF, Audio — not MIME types like image/jpeg)
- No attachment count in summary field — the Attachments section is sufficient

### Note-to-Note Links
- Use source_url convention: note-link:{targetZIDENTIFIER} (same pattern as CalendarAdapter's attendee-of:)
- Connection label: links_to with weight 0.5 for forward links (consistent with AppleNotesParser)
- Bidirectional connections: also create linked_from backlink with weight 0.3 (lower than forward)
- Inline references in body text where note links appeared: [Linked Note: Meeting Agenda]
- Unresolved targets (encrypted/deleted notes) get a placeholder card with card_type "collection" and content "[Not imported — encrypted or deleted]"
- Unidirectional links_to still created to placeholder cards; placeholder gets linked_from back

### Fallback Behavior
- Add snippet-only tag to cards that fell back to ZSNIPPET content
- Import summary reports breakdown: "842 notes (812 full body, 27 snippet fallback, 3 encrypted skipped)"
- NULL ZDATA -> use ZSNIPPET + snippet-only tag (never skip a note)
- Maximize extraction on partial failure: if decompression succeeds but Markdown reconstruction fails, extract plain text + hashtags; only fall back fully to ZSNIPPET if decompression itself fails

### Claude's Discretion
- Protobuf parsing approach (manual binary parsing vs. SwiftProtobuf generated code)
- Gzip decompression implementation details
- How to detect/distinguish attachment types from protobuf fields
- Internal protobuf field mapping to Markdown elements
- Error handling granularity within the protobuf parser
- FTS5 optimization strategy for full body content indexing

</decisions>

<specifics>
## Specific Ideas

- Fidelity matters — the Markdown reconstruction should closely mirror the original Apple Note's visual structure
- Inline placeholders should cross-reference the Attachments section: [Image: sunset.jpg] in the body matches "- [Image] sunset.jpg" in the Attachments section
- Bidirectional links are important for graph richness — if Note A links to Note B, both A->B (links_to, 0.5) and B->A (linked_from, 0.3) connections should exist
- Placeholder collection cards for unresolved link targets preserve the note's link structure even when the target wasn't imported
- The existing CalendarAdapter source_url convention (attendee-of:) is the proven pattern — note-link:{ZIDENTIFIER} follows the same approach

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- NotesAdapter.swift: Phase 35 adapter already reads NoteStore.sqlite, has schema detection, folder hierarchy, hashtag extraction, encrypted note filtering — this phase extends it with ZDATA blob reading
- CalendarAdapter.swift: source_url convention pattern (attendee-of:{eventSourceId}) for auto-connection creation — reuse for note-link:{ZIDENTIFIER}
- etl-import-native.handler.ts: Already has auto-connection creation logic for source_url prefixes (lines 68-92) — needs extension for note-link: prefix
- AppleNotesParser.ts: Shows links_to connection pattern with weight 0.5, person card dedup, and note link handling
- CoreDataTimestampConverter: Shared date conversion utility already used by NotesAdapter
- CanonicalCard struct: Has content, summary, tags, source_url fields needed for all Phase 36 features

### Established Patterns
- Copy-then-read for safe database access (NotesAdapter.readNotesFromDatabase)
- Schema detection via PRAGMA table_info (NoteStoreSchema struct)
- AsyncStream batched yielding with 500-card internal batches, 200-card bridge chunks
- source_url convention for auto-connection creation on TS side
- DedupEngine.sourceIdMap for resolving source_ids to UUIDs across cards
- Bare type tags (not has- prefix) for attachment type categorization

### Integration Points
- NotesAdapter.fetchNotes() needs ZDATA column added to main query and protobuf extraction called per row
- etl-import-native.handler.ts needs note-link: prefix handling alongside existing attendee-of: handling
- Hashtag extraction moves from ZSNIPPET-only to full body text
- FTS5 indexing happens automatically via SQLiteWriter — full body content in content field gets indexed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-notes-content-extraction*
*Context gathered: 2026-03-06*
