---
phase: 88-data-explorer-catalog
plan: 01
subsystem: database
tags: [sql, catalogwriter, worker, datasets, etl, protocol]

# Dependency graph
requires:
  - phase: 08-etl-importers
    provides: CatalogWriter, import_sources/import_runs tables, ImportRunRecord
  - phase: 03-worker-bridge
    provides: WorkerRequestType union, WorkerPayloads, WorkerResponses pattern, worker routing
provides:
  - datasets table DDL in schema.sql with is_active single-active row pattern
  - CatalogWriter.upsertDataset() auto-called from recordImportRun (DEXP-02)
  - CatalogWriter.upsertSampleDataset() for sample data loads (source_type='sample')
  - CatalogWriter.getActiveDatasetId() convenience accessor
  - DatasetRow interface exported from CatalogWriter
  - Worker handlers: handleDatasetsQuery, handleDatasetsStats, handleDatasetsVacuum
  - Protocol types: datasets:query, datasets:stats, datasets:vacuum in all three maps
affects: [88-02-catalog-supergrid, 88-03-catalog-ui, SampleDataManager]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - INSERT ... ON CONFLICT(name, source_type) DO UPDATE for datasets upsert
    - Deactivate-all + activate-one pattern for is_active single-row constraint
    - Record<string, never> payload type for zero-argument Worker operations
    - pragma_page_count() * pragma_page_size() for DB file size in bytes

key-files:
  created:
    - src/worker/handlers/datasets.handler.ts
  modified:
    - src/database/schema.sql
    - src/etl/CatalogWriter.ts
    - src/worker/protocol.ts
    - src/worker/worker.ts

key-decisions:
  - "datasets table uses (name, source_type) UNIQUE index for upsert key — not filename — so re-importing same source updates rather than duplicates"
  - "is_active single-row invariant enforced by deactivate-all before INSERT — no DB-level check constraint needed"
  - "upsertDataset counts cards/connections live at time of call (COUNT(*)) rather than reading from ImportResult.inserted — gives accurate total including prior imports of same source"

patterns-established:
  - "Deactivate-all pattern: UPDATE datasets SET is_active = 0 WHERE is_active = 1 before activating new row"
  - "exactOptionalPropertyTypes workaround: use spread conditional { ...(x !== undefined ? { field: x } : {}) } for optional fields in strict mode"

requirements-completed: [DEXP-02, DEXP-03]

# Metrics
duration: 8min
completed: 2026-03-18
---

# Phase 88 Plan 01: Datasets Registry Summary

**datasets table DDL + CatalogWriter.upsertDataset() auto-wired to every import + Worker handlers for datasets:query, datasets:stats, datasets:vacuum**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-18T15:10:00Z
- **Completed:** 2026-03-18T15:18:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added datasets registry table to schema.sql with full column set (id, name, source_type, card_count, connection_count, file_size_bytes, filename, import_run_id, source_id, is_active, created_at, last_imported_at) and UNIQUE index on (name, source_type)
- Extended CatalogWriter with upsertDataset(), upsertSampleDataset(), getActiveDatasetId() — recordImportRun() now auto-upserts a dataset row on every import completion
- Created datasets.handler.ts with three Worker handlers, wired all three in worker.ts routeRequest switch with protocol types in all maps

## Task Commits

Each task was committed atomically:

1. **Task 1: Add datasets table DDL and extend CatalogWriter** - `511a697b` (feat)
2. **Task 2: Add datasets Worker protocol and handlers** - `f9a0f93a` (feat)

## Files Created/Modified

- `src/database/schema.sql` - Added datasets table DDL and two indexes after import_runs section
- `src/etl/CatalogWriter.ts` - Added DatasetRow interface + upsertDataset() + upsertSampleDataset() + getActiveDatasetId() + wired recordImportRun() to call upsertDataset()
- `src/worker/protocol.ts` - Added datasets:query, datasets:stats, datasets:vacuum to WorkerRequestType union, WorkerPayloads, WorkerResponses
- `src/worker/handlers/datasets.handler.ts` - New handler file: handleDatasetsQuery, handleDatasetsStats, handleDatasetsVacuum
- `src/worker/worker.ts` - Added import and three routing cases for datasets handlers

## Decisions Made

- datasets table uses (name, source_type) as upsert key so re-importing the same source updates existing row rather than creating a duplicate
- is_active single-row invariant enforced by deactivate-all before INSERT — simpler than a DB-level trigger or check constraint
- upsertDataset reads live COUNT(*) at call time rather than using ImportResult.inserted so card_count reflects cumulative total

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes filename assignment**
- **Found during:** Task 1 (CatalogWriter recordImportRun)
- **Issue:** `filename: record.filename` where `record.filename: string | undefined` failed strict `exactOptionalPropertyTypes` — `undefined` not assignable to optional `string` parameter
- **Fix:** Used conditional spread `...(record.filename !== undefined ? { filename: record.filename } : {})` to satisfy strict mode
- **Files modified:** src/etl/CatalogWriter.ts
- **Verification:** `npx tsc --noEmit` shows zero src/ errors
- **Committed in:** 511a697b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** TypeScript strictness fix, no behavior change.

## Issues Encountered

None beyond the exactOptionalPropertyTypes issue documented above.

## Next Phase Readiness

- Plan 02 (Catalog SuperGrid) can now query datasets table via datasets:query Worker handler
- Plan 03 (Catalog UI) can display dataset rows returned by handleDatasetsQuery
- SampleDataManager should call CatalogWriter.upsertSampleDataset() to register sample datasets
- Pre-existing test errors in tests/seams/etl/etl-fts.test.ts and tests/seams/ui/calc-explorer.test.ts are out of scope — not caused by this plan

---
*Phase: 88-data-explorer-catalog*
*Completed: 2026-03-18*
