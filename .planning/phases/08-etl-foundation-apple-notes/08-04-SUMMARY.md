---
phase: 08-etl-foundation-apple-notes
plan: 04
subsystem: etl
tags: [parser, catalog, apple-notes, provenance]
dependency_graph:
  requires: [ETL-01]
  provides: [ETL-04, ETL-13]
  affects: []
tech_stack:
  added: [gray-matter@4.0.3]
  patterns: [TDD, YAML frontmatter parsing, attachment parsing, HTML table conversion, @mention regex, import provenance tracking]
key_files:
  created:
    - src/etl/parsers/attachments.ts
    - src/etl/parsers/AppleNotesParser.ts
    - src/etl/CatalogWriter.ts
    - tests/etl/parsers/attachments.test.ts
    - tests/etl/parsers/AppleNotesParser.test.ts
    - tests/etl/CatalogWriter.test.ts
    - tests/etl/fixtures/apple-notes-sample.md
  modified:
    - src/etl/index.ts
    - package.json
    - package-lock.json
decisions:
  - gray-matter chosen for YAML frontmatter parsing (de facto standard with built-in TypeScript definitions)
  - Two-pass regex approach for @mentions (capitalized two-word names first, then single-word fallback)
  - CatalogWriter upserts sources by (source_type, name) to enable multiple sources per type
  - Person cards deduplicated within parse session via Map to avoid duplicate person cards
metrics:
  duration: 451
  tasks: 5
  files: 15
  tests: 35
  completed: 2026-03-01T21:39:24Z
---

# Phase 8 Plan 04: AppleNotesParser + CatalogWriter Summary

**Alto-index Markdown parser with attachment extraction and import provenance tracking.**

## Objective

Implemented AppleNotesParser for transforming alto-index Markdown exports into CanonicalCard and CanonicalConnection arrays, extracting hashtags, @mentions, internal note links, and external URLs. Implemented CatalogWriter for recording import provenance in Data Catalog tables.

## Completed Tasks

### Task 1: Install gray-matter dependency
- Installed gray-matter@4.0.3 for YAML frontmatter parsing
- Package includes native TypeScript definitions (no @types needed)
- Commit: `e53d6d1`

### Task 2: Implement attachment parsing helpers (TDD)
- RED: Created failing tests for extractHashtags, extractNoteLinks, parseTableToMarkdown, extractMentions
- GREEN: Implemented all helpers with regex-based parsing
- Two-pass @mention extraction: capitalized two-word names first, then single-word fallback
- All 17 tests passing
- Commits: `564ca3d` (RED), `e216304` (GREEN)

### Task 3: Implement AppleNotesParser (TDD)
- RED: Created test fixture (apple-notes-sample.md) and 13 comprehensive tests
- GREEN: Implemented full parser with:
  - YAML frontmatter parsing via gray-matter
  - Note card creation with all 26 CanonicalCard fields
  - Hashtag extraction from attachments
  - Person card creation for @mentions with 'mentions' connections
  - Resource card creation for external URLs with 'links_to' connections
  - Internal note link connections (IDs resolved by DedupEngine)
  - Table attachment conversion (HTML to Markdown)
  - Error handling per-file without aborting batch
  - Person card deduplication within parse session
  - Title extraction fallback chain: frontmatter > heading > first line > "Untitled Note"
- All 13 tests passing
- Commits: `bd337ee` (RED), `f1fbd83` (GREEN)

### Task 4: Implement CatalogWriter (TDD)
- RED: Created failing tests for source upsert, run recording, run queries
- GREEN: Implemented CatalogWriter with:
  - Source upsert by (source_type, name) combination
  - Import run recording with all counts and timestamps
  - Error detail serialization as JSON
  - Run queries by source type (sorted by completion date DESC)
- All 5 tests passing
- Commits: `25c9290` (RED), `5ad087f` (GREEN)

### Task 5: Export parser and catalog from ETL module
- Updated src/etl/index.ts to export AppleNotesParser, CatalogWriter, and their types
- All 35 tests passing across all modules
- Commit: `300a8af`

## Deviations from Plan

None. Plan executed exactly as written.

## Technical Highlights

### Attachment Parsing
- **Hashtags:** Regex extraction from HTML anchor tags (`#tagname`)
- **Note Links:** Numeric ID extraction from link attachment IDs
- **Tables:** HTML table to Markdown conversion via regex (row/cell extraction)
- **Mentions:** Two-pass regex (capitalized two-word names, then single-word fallback)

### AppleNotesParser Architecture
- **Person Map:** Deduplicates person cards within parse session (name → UUID)
- **Error Handling:** Continue on per-file errors without aborting batch
- **Title Fallback:** Frontmatter > heading > first line > "Untitled Note"
- **Resource Cards:** External URLs create resource cards with MIME type guessing

### CatalogWriter Pattern
- **Upsert Logic:** SELECT first, INSERT if not found (no UPSERT/ON CONFLICT)
- **JSON Serialization:** errors_detail stored as JSON array in errors_json column
- **Query Pattern:** JOIN import_runs with import_sources for source_type filtering

## Integration Points

- **DedupEngine:** Resolves internal note link IDs (source_id/target_id) to UUIDs
- **SQLiteWriter:** Consumes CanonicalCard/CanonicalConnection arrays
- **ImportOrchestrator:** Will orchestrate parser → dedup → writer pipeline (Plan 08-05)

## Test Coverage

- **attachments.test.ts:** 17 tests (hashtags, links, tables, mentions)
- **AppleNotesParser.test.ts:** 13 tests (parsing, extraction, error handling, deduplication)
- **CatalogWriter.test.ts:** 5 tests (upsert, recording, queries)

Total: 35 tests, all passing

## Performance Notes

- gray-matter parsing: negligible overhead for typical note sizes (<1ms per note)
- Person deduplication: O(1) Map lookup per mention
- Table conversion: Regex-based (no HTML parser dependency)

## Next Steps

Plan 08-05 will implement ImportOrchestrator to orchestrate the full import pipeline:
- AppleNotesParser → DedupEngine → SQLiteWriter → CatalogWriter
- Worker request handler for ETL operations
- UI feedback integration

## Self-Check: PASSED

### Files Created
- [x] src/etl/parsers/attachments.ts exists
- [x] src/etl/parsers/AppleNotesParser.ts exists
- [x] src/etl/CatalogWriter.ts exists
- [x] tests/etl/parsers/attachments.test.ts exists
- [x] tests/etl/parsers/AppleNotesParser.test.ts exists
- [x] tests/etl/CatalogWriter.test.ts exists
- [x] tests/etl/fixtures/apple-notes-sample.md exists

### Files Modified
- [x] src/etl/index.ts updated with exports
- [x] package.json updated with gray-matter

### Commits Exist
- [x] e53d6d1: chore(08-04): install gray-matter
- [x] 564ca3d: test(08-04): add failing tests for attachment helpers
- [x] e216304: feat(08-04): implement attachment parsing helpers
- [x] bd337ee: test(08-04): add failing tests for AppleNotesParser
- [x] f1fbd83: feat(08-04): implement AppleNotesParser
- [x] 25c9290: test(08-04): add failing tests for CatalogWriter
- [x] 5ad087f: feat(08-04): implement CatalogWriter
- [x] 300a8af: feat(08-04): export from ETL module

### Tests Pass
```bash
npx vitest run tests/etl/parsers/attachments.test.ts tests/etl/parsers/AppleNotesParser.test.ts tests/etl/CatalogWriter.test.ts
# ✓ 35 tests passed
```
