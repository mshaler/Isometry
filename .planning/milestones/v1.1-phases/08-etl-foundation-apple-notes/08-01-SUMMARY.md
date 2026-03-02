---
phase: 08-etl-foundation-apple-notes
plan: 01
subsystem: etl
tags: [types, schema, integration-contract]
dependency_graph:
  requires: []
  provides: [CanonicalCard, CanonicalConnection, ImportResult, import_sources, import_runs]
  affects: [database-schema, worker-protocol]
tech_stack:
  added: []
  patterns: [canonical-types, provenance-tracking]
key_files:
  created:
    - src/etl/types.ts
    - src/etl/index.ts
    - tests/etl/types.test.ts
  modified:
    - src/database/schema.sql
    - src/index.ts
    - src/worker/worker.ts
decisions:
  - ETL types use string[] for tags, not JSON-stringified strings
  - Import catalog tables use TEXT PRIMARY KEY for UUIDs
  - Added stub handlers for ETL worker requests until Plan 08-02
metrics:
  duration: 276s
  completed: 2026-03-01T21:26:50Z
  tasks_completed: 3
  files_created: 3
  files_modified: 4
  commits: 3
---

# Phase 8 Plan 01: ETL Types + Schema Extension Summary

**One-liner:** Canonical ETL type contract with 26-field CanonicalCard, import provenance tables, and type validation tests

## Completion Status

All tasks completed successfully. All verification criteria met.

**Commits:**
- `59f7255` - Task 1: Create canonical ETL type definitions (TDD)
- `2052284` - Task 2: Add import catalog tables to schema
- `809bb70` - Task 3: Create ETL module barrel export

## What Was Built

### Task 1: Canonical ETL Type Definitions (TDD)

Created the critical integration seam between parsers and writers:

**Types created:**
- `CanonicalCard` - Maps 1:1 to cards table (26 fields, tags as string[])
- `CanonicalConnection` - Maps 1:1 to connections table (6 fields)
- `ImportResult` - Standardized import feedback with insertedIds and error details
- `ParseError` - Error tracking with index, source_id, message
- `SourceType` - Union of 6 supported source types
- `AltoNoteFrontmatter` - Alto-index YAML structure for Apple Notes
- `AltoAttachment` - Attachment metadata for hashtags and binary files

**Key design decisions:**
- Tags stored as `string[]` in CanonicalCard (SQLiteWriter handles JSON serialization)
- Source and source_id are required (non-null) for ETL deduplication
- ImportResult includes insertedIds array for UI navigation
- ParseError uses nullable source_id for parse failures before ID extraction

**Tests:** 8 tests validating type contracts, all passing

### Task 2: Import Catalog Tables

Extended database schema with provenance tracking:

**Tables added:**
- `import_sources` - Tracks registered import sources (id, name, source_type, created_at)
- `import_runs` - Records import execution history with full metrics

**Indexes:**
- `idx_import_sources_type_name` - Unique constraint on (source_type, name)
- `idx_import_runs_source` - Query by source_id
- `idx_import_runs_completed` - Query by completion time

**Verification:** Database.test.ts passes (34 tests) - schema loads successfully

### Task 3: ETL Module Barrel Export

Established public API surface:

**Files created:**
- `src/etl/index.ts` - Barrel export for all ETL types
- Main package export updated to include ETL module

**TypeScript compilation:** Passes with no errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added stub ETL request handlers in worker router**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** ETL request types ('etl:import', 'etl:export') existed in WorkerRequestType union but had no handler cases, causing exhaustive switch type error
- **Fix:** Added stub cases that throw "not yet implemented" error until Plan 08-02
- **Files modified:** src/worker/worker.ts
- **Commit:** 809bb70 (included in Task 3)

**2. [Rule 1 - Bug] Fixed optional array access in test**
- **Found during:** Task 3 TypeScript compilation
- **Issue:** Test accessed frontmatter.attachments[0] without checking array could be undefined
- **Fix:** Used optional chaining (frontmatter.attachments?.[0]?.type)
- **Files modified:** tests/etl/types.test.ts
- **Commit:** 809bb70 (included in Task 3)

## Success Criteria Verification

- [x] CanonicalCard interface has all 26 Card columns with tags as string[]
- [x] CanonicalConnection interface has all Connection columns
- [x] ImportResult includes insertedIds array per CONTEXT.md decision
- [x] import_sources table has id, name, source_type, created_at columns
- [x] import_runs table has full provenance columns including cards_unchanged
- [x] All types exported from src/etl/index.ts
- [x] No changes to existing cards/connections/cards_fts tables
- [x] All tests pass (8 ETL tests + 34 database tests)
- [x] TypeScript compiles without errors

## Integration Points

**Provides to downstream plans:**
- **Plan 08-03 (SQLiteWriter):** CanonicalCard and CanonicalConnection interfaces
- **Plan 08-04 (AppleNotesParser):** AltoNoteFrontmatter and AltoAttachment types
- **Plan 08-05 (ImportOrchestrator):** ImportResult and ParseError types
- **All parsers:** SourceType union and canonical output contract

**Dependencies satisfied:**
- ETL-01: Canonical ETL type contract established
- ETL-02: Import catalog tables and ImportResult type created

## Next Steps

Plan 08-02 will extend the worker protocol to add:
- Payload and response type mappings for 'etl:import' and 'etl:export'
- Actual handler implementations to replace stubs
- ImportRequest and ExportRequest types

## Self-Check

Verifying all claimed artifacts exist:

**Created files:**
- [x] src/etl/types.ts - FOUND (175 lines)
- [x] src/etl/index.ts - FOUND (11 lines)
- [x] tests/etl/types.test.ts - FOUND (192 lines)

**Modified files:**
- [x] src/database/schema.sql - import_sources and import_runs tables present
- [x] src/index.ts - ETL module export present
- [x] src/worker/worker.ts - ETL stub handlers present

**Commits:**
- [x] 59f7255 - FOUND
- [x] 2052284 - FOUND
- [x] 809bb70 - FOUND

**Self-Check: PASSED**
