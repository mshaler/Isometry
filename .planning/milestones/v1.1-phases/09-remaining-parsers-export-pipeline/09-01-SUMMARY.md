---
phase: 09-remaining-parsers-export-pipeline
plan: 01
subsystem: etl/parsers
tags: [tdd, parsers, markdown, csv, obsidian]
completed: 2026-03-02T01:05:26Z
duration_seconds: 389

dependencies:
  requires: [ETL-01, ETL-02]
  provides: [ETL-05, ETL-07]
  affects: [src/etl/parsers, tests/etl/parsers]

tech_stack:
  added:
    - papaparse@5.5.3 (CSV parsing with BOM handling)
    - "@types/papaparse@5.5.2"
  patterns:
    - TDD red-green-refactor cycle
    - gray-matter for YAML frontmatter parsing
    - PapaParse for robust CSV parsing

key_files:
  created:
    - src/etl/parsers/MarkdownParser.ts (291 lines)
    - src/etl/parsers/CSVParser.ts (246 lines)
    - tests/etl/parsers/MarkdownParser.test.ts (221 lines)
    - tests/etl/parsers/CSVParser.test.ts (205 lines)
    - tests/etl/fixtures/obsidian-vault/simple-note.md
    - tests/etl/fixtures/obsidian-vault/complex-frontmatter.md
    - tests/etl/fixtures/obsidian-vault/no-frontmatter.md
    - tests/etl/fixtures/obsidian-vault/nested/subfolder-note.md
    - tests/etl/fixtures/csv-with-bom.csv
    - tests/etl/fixtures/csv-ragged-rows.csv
  modified:
    - package.json (added papaparse)
    - package-lock.json (dependency tree)

decisions:
  - "gray-matter already installed from Phase 8 - reused for Markdown frontmatter"
  - "PapaParse used with worker:false (already in Worker context)"
  - "Title cascade for Markdown: frontmatter > first heading > filename"
  - "Tags support array, comma-string, and #hashtag fallback"
  - "CSV source_id format: {filepath}:{rowIndex} for uniqueness"
  - "Array.from(matchAll()) for TypeScript downlevel compatibility"

metrics:
  tests_added: 27
  tests_passing: 203
  files_created: 10
  commits: 6
---

# Phase 09 Plan 01: MarkdownParser + CSVParser Summary

Markdown/Obsidian parser with YAML frontmatter and CSV parser with BOM handling.

## What Was Built

### MarkdownParser
- Parses Markdown files with YAML frontmatter (Obsidian vault format)
- Title extraction cascade: frontmatter.title > first # heading > filename
- Tags from frontmatter array, comma-separated string, or #hashtags in content
- Folder derived from file path (all directories except filename)
- [[Wikilinks]] create connections with label='links_to'
- Handles gray-matter Date object parsing with ISO string normalization
- Per-file error isolation (malformed YAML doesn't abort batch)

### CSVParser
- Parses CSV files with PapaParse
- Strips UTF-8 BOM (0xFEFF) before parsing
- Column auto-detection via synonym matching (case-insensitive)
  - name: ['title', 'name', 'subject', 'heading']
  - content: ['content', 'body', 'description', 'text', 'notes']
  - tags: ['tags', 'labels', 'categories']
  - created_at: ['date', 'created', 'created_at', 'timestamp']
- Explicit column mapping override via options
- Ragged row handling (missing columns padded with nulls)
- Tags split on comma/semicolon
- TSV auto-detection via delimiter auto-detection

### Test Coverage
- MarkdownParser: 15 tests covering frontmatter, title cascade, tags, wikilinks, error handling
- CSVParser: 12 tests covering BOM, auto-detection, ragged rows, TSV, quoted fields
- All 203 ETL tests passing (no regressions)

## Implementation Details

### Task 1: Install papaparse
- Added papaparse@5.5.3 for CSV parsing
- Added @types/papaparse@5.5.2 for TypeScript types
- gray-matter already installed from Phase 8

**Commit:** 4a8b3b80

### Task 2: MarkdownParser (TDD)
**RED phase:**
- Created 4 test fixtures (simple, complex, no-frontmatter, nested)
- Wrote 15 failing tests covering all behaviors
- Commit: 1370f272

**GREEN phase:**
- Implemented MarkdownParser with gray-matter
- Title cascade logic with helper function
- Tags extraction with fallback to #hashtags
- Wikilinks regex: `/\[\[([^\]]+)\]\]/g`
- All 15 tests passing
- Commit: edf77564

**REFACTOR phase:**
- Fixed TypeScript compatibility (Array.from(matchAll()))
- Normalized ISO strings to remove .000 milliseconds
- Commit: dc2932fb

### Task 3: CSVParser (TDD)
**RED phase:**
- Created 2 test fixtures (with BOM, ragged rows)
- Wrote 12 failing tests covering all behaviors
- Commit: 6e927bfe

**GREEN phase:**
- Implemented CSVParser with PapaParse
- BOM stripping: `content.charCodeAt(0) === 0xFEFF`
- Column auto-detection with HEADER_SYNONYMS map
- Row-to-card conversion with null handling
- All 12 tests passing
- Commit: d15719e9

**REFACTOR phase:**
- Fixed PapaParse import (namespace import)
- Included in TypeScript compatibility commit: dc2932fb

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification criteria met:

1. **Parser tests:** 27 new tests, all passing
2. **TypeScript compilation:** New parsers compile cleanly (bundler handles imports)
3. **ETL test suite:** All 203 tests passing (no regressions)

### Test Results
```
Test Files  16 passed (16)
Tests       203 passed (203)
Duration    687ms
```

## Architecture Notes

### Parser Pattern Consistency
Both parsers follow the established pattern from AppleNotesParser:
- `parse(files: ParsedFile[], options?)` method
- Return `{ cards, connections, errors }` result
- Per-file error isolation (continue on failure)
- source_id for deduplication (DedupEngine resolves to UUIDs later)

### Title Extraction Cascade (Markdown)
```typescript
1. data.title (frontmatter)
2. /^#\s+(.+)$/m (first heading)
3. filename.replace(/\.md$/i, '')
```

### Column Auto-Detection (CSV)
Case-insensitive substring matching against HEADER_SYNONYMS map.
Explicit columnMapping option overrides auto-detection.

### Tag Parsing
- **Markdown:** Array > comma-string > #hashtags
- **CSV:** Split on `/[,;]/` regex

## Success Criteria

- [x] MarkdownParser parses YAML frontmatter with gray-matter
- [x] Title extraction cascade works: frontmatter > heading > filename
- [x] Tags extracted from array, comma-string, or #hashtags
- [x] Folder derived from file path
- [x] [[Wikilinks]] create connections with target as source_id
- [x] CSVParser strips UTF-8 BOM before parsing
- [x] Column auto-detection matches common header synonyms
- [x] Ragged rows handled gracefully (no crashes)
- [x] Both parsers return ParseResult matching established interface
- [x] 27 new tests passing (MarkdownParser: 15, CSVParser: 12)

## Self-Check: PASSED

### Created Files Verification
```bash
✓ src/etl/parsers/MarkdownParser.ts exists
✓ src/etl/parsers/CSVParser.ts exists
✓ tests/etl/parsers/MarkdownParser.test.ts exists
✓ tests/etl/parsers/CSVParser.test.ts exists
✓ All test fixtures exist
```

### Commits Verification
```bash
✓ 4a8b3b80: chore(09-01): install papaparse dependency
✓ 1370f272: test(09-01): add failing test for MarkdownParser
✓ edf77564: feat(09-01): implement MarkdownParser
✓ 6e927bfe: test(09-01): add failing test for CSVParser
✓ d15719e9: feat(09-01): implement CSVParser
✓ dc2932fb: refactor(09-01): fix TypeScript compatibility
```

All 6 commits present and verified.
