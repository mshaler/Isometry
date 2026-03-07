---
phase: 47-etl-validation
plan: 01
subsystem: testing
tags: [etl, fixtures, vitest, import-validation, apple-notes, markdown, csv, json, excel, html, native-reminders, native-calendar, native-notes]

# Dependency graph
requires:
  - phase: 08-etl-pipeline
    provides: ImportOrchestrator, DedupEngine, SQLiteWriter, all 6 parsers
  - phase: 33-native-etl
    provides: Native source types (native_reminders, native_calendar, native_notes)
provides:
  - 100+ card snapshot fixtures for all 9 ETL sources
  - Shared helpers (createTestDb, importFileSource, importNativeSource, queryCardsForSource)
  - Source import validation tests (34 tests) covering ETLV-01 and ETLV-02
  - Excel fixture generation via SheetJS (generateExcelBuffer helper)
affects: [47-02, 47-03, etl-validation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ETL validation fixture pattern: pre-generated JSON fixtures with 110+ items per source"
    - "Native source test pattern: DedupEngine.process() + SQLiteWriter.writeCards() (not ImportOrchestrator)"
    - "HTML import via ImportOrchestrator.import() with array of strings cast as ParsedFile[]"
    - "Excel fixture generation at test time via SheetJS from JSON row definitions"

key-files:
  created:
    - tests/etl-validation/helpers.ts
    - tests/etl-validation/source-import.test.ts
    - tests/etl-validation/fixtures/apple-notes-snapshot.json
    - tests/etl-validation/fixtures/markdown-snapshot.json
    - tests/etl-validation/fixtures/csv-snapshot.json
    - tests/etl-validation/fixtures/json-snapshot.json
    - tests/etl-validation/fixtures/excel-rows.json
    - tests/etl-validation/fixtures/html-snapshot.json
    - tests/etl-validation/fixtures/native-reminders.json
    - tests/etl-validation/fixtures/native-calendar.json
    - tests/etl-validation/fixtures/native-notes.json
    - tests/etl-validation/fixtures/generate-fixtures.mjs
  modified: []

key-decisions:
  - "Apple Notes note links use attachment type com.apple.notes.inlinetextattachment.link (not frontmatter links field) -- frontmatter links field creates resource cards for external URLs"
  - "Apple Notes attachment IDs must be strings in YAML (id: link-1002 not id: 1002) because extractNoteLinks() calls att.id.match() which requires a string"
  - "Excel fixtures stored as JSON row definitions (excel-rows.json) with runtime SheetJS generation via generateExcelBuffer() -- avoids committing binary .xlsx files"
  - "HTML test passes array directly to ImportOrchestrator.import() via cast -- ImportOrchestrator maps string elements through unchanged"

patterns-established:
  - "ETL validation fixture pattern: 110 items per source with field diversity (5+ folders, mixed statuses, 15 tags, unicode edge cases, null/non-null dates)"
  - "Fixture generator script pattern: generate-fixtures.mjs produces all fixtures from a single source of truth"

requirements-completed: [ETLV-01, ETLV-02]

# Metrics
duration: 7min
completed: 2026-03-07
---

# Phase 47 Plan 01: Source Import Validation Summary

**110-card snapshot fixtures for all 9 ETL sources with 34 import validation tests through real ImportOrchestrator and DedupEngine pipelines**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-07T21:06:37Z
- **Completed:** 2026-03-07T21:13:57Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments
- Created 9 fixture files with 110 cards each covering all ETL source types with diverse field values
- Validated all 6 file-based sources import 100+ cards with correct source field and zero errors (ETLV-01)
- Validated all 3 native sources import 100+ cards with correct field output via DedupEngine path (ETLV-02)
- Apple Notes connections from note link attachments verified, calendar event dates preserved, CSV BOM handling confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create 100+ card snapshot fixtures + shared helpers** - `059e8d35` (feat)
2. **Task 2: Source import validation tests for all 9 sources** - `acdef134` (test)

## Files Created/Modified
- `tests/etl-validation/helpers.ts` - Shared fixture loading, database setup, importFileSource/importNativeSource helpers, generateExcelBuffer
- `tests/etl-validation/source-import.test.ts` - 34 import validation tests covering all 9 source types
- `tests/etl-validation/fixtures/apple-notes-snapshot.json` - 110 ParsedFile[] with frontmatter, hashtag attachments, note link attachments
- `tests/etl-validation/fixtures/markdown-snapshot.json` - 110 ParsedFile[] with YAML frontmatter, tags, statuses
- `tests/etl-validation/fixtures/csv-snapshot.json` - ParsedFile[] with 110-row BOM-prefixed CSV content
- `tests/etl-validation/fixtures/json-snapshot.json` - 110 JSON objects with varied field names (title/name/subject/heading)
- `tests/etl-validation/fixtures/excel-rows.json` - 110 row objects for SheetJS generation
- `tests/etl-validation/fixtures/html-snapshot.json` - 110 HTML page strings with varied elements
- `tests/etl-validation/fixtures/native-reminders.json` - 110 CanonicalCard[] tasks with due_at, status, priority
- `tests/etl-validation/fixtures/native-calendar.json` - 110 CanonicalCard[] (100 events + 10 attendees)
- `tests/etl-validation/fixtures/native-notes.json` - 110 CanonicalCard[] notes with note-link source_urls
- `tests/etl-validation/fixtures/generate-fixtures.mjs` - Fixture generator script for reproducibility

## Decisions Made
- Apple Notes note links use attachment type `com.apple.notes.inlinetextattachment.link` (not `links` frontmatter field which creates resource cards for external URLs)
- Attachment IDs in YAML must be string-typed (`link-1002`) because `extractNoteLinks()` calls `att.id.match()` -- numeric YAML values cause runtime errors
- Excel fixtures stored as JSON row definitions with runtime SheetJS generation to avoid binary files in fixtures
- HTML strings passed as array directly to `ImportOrchestrator.import()` via type cast -- orchestrator maps string elements through unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Apple Notes fixture YAML attachment IDs**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** YAML parsed numeric attachment IDs (`id: 1002`) as numbers, causing `att.id.match()` runtime error in `extractNoteLinks()` -- 15 notes with link attachments failed to parse
- **Fix:** Changed attachment IDs to string format (`id: link-1002`) so YAML preserves string type
- **Files modified:** tests/etl-validation/fixtures/generate-fixtures.mjs, tests/etl-validation/fixtures/apple-notes-snapshot.json
- **Verification:** All 110 Apple Notes import with zero errors, connections_created > 0
- **Committed in:** acdef134 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed Apple Notes fixture link format**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** Fixture used `links` frontmatter field for note-to-note links, but AppleNotesParser treats `fm.links` as external URLs creating resource cards with `source_id: url:{url}` -- duplicate source_ids across notes linking to same target caused UNIQUE constraint violation
- **Fix:** Removed `links` frontmatter, added `com.apple.notes.inlinetextattachment.link` attachments instead (matching real alto-index output format)
- **Files modified:** tests/etl-validation/fixtures/generate-fixtures.mjs, tests/etl-validation/fixtures/apple-notes-snapshot.json
- **Verification:** No UNIQUE constraint errors, connections created via DedupEngine resolution
- **Committed in:** acdef134 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in fixture format)
**Impact on plan:** Both fixes required to match actual parser behavior. No scope creep -- fixtures now accurately model real data formats.

## Issues Encountered
None beyond the fixture format issues documented as deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 9 source fixtures exist and import correctly -- ready for view rendering matrix (Plan 02)
- Shared helpers provide createTestDb, importFileSource, importNativeSource, queryCardsForSource for reuse
- generateExcelBuffer helper available for Excel fixture tests in subsequent plans
- Full test suite green at 2252 tests (including 34 new validation tests)

---
*Phase: 47-etl-validation*
*Completed: 2026-03-07*
