---
phase: quick
plan: enr
subsystem: etl, worker, providers, database
tags: [enrichment-pipeline, folder-hierarchy, schema-migration, allowlist-fix]
dependency_graph:
  requires: [Phase 70 SchemaProvider, Phase 71 Dynamic Schema]
  provides: [enrichment-pipeline-framework, folder-hierarchy-split, worker-allowlist-wiring]
  affects: [ImportOrchestrator, SQLiteWriter, etl-import-native, Worker, allowlist, schema-classifier, schema.sql]
tech_stack:
  added: [enrichment-pipeline]
  patterns: [plugin-registry, pure-function-enricher, in-memory-mutation, auto-backfill-on-boot]
key_files:
  created:
    - src/etl/enrichment/types.ts
    - src/etl/enrichment/registry.ts
    - src/etl/enrichment/FolderHierarchyEnricher.ts
    - src/etl/enrichment/index.ts
    - src/worker/handlers/enrich-backfill.handler.ts
    - tests/etl/enrichment/FolderHierarchyEnricher.test.ts
    - tests/etl/enrichment/registry.test.ts
    - tests/etl/enrichment/integration.test.ts
  modified:
    - src/database/schema.sql
    - src/worker/worker.ts
    - src/worker/schema-classifier.ts
    - src/worker/protocol.ts
    - src/worker/handlers/index.ts
    - src/etl/ImportOrchestrator.ts
    - src/etl/SQLiteWriter.ts
    - src/worker/handlers/etl-import-native.handler.ts
    - src/providers/allowlist.ts
decisions:
  - "D-012: Enrichment runs in-memory on CanonicalCard[] between Parse and Dedup (not post-write SQL UPDATE)"
  - "D-013: folder_l1..l4 materialized columns (Option B) — max depth 4, excess joined into l4"
  - "D-014: Original folder column preserved intact — enriched columns are derived, not replacement"
  - "D-015: setValidColumnNames() in allowlist.ts bridges Worker-side validation gap for all dynamic columns"
metrics:
  completed: "2026-03-31T21:30:00Z"
  tasks_completed: 8
  tasks_total: 8
  tests_added: 31
  tests_total: 2085
  files_created: 8
  files_modified: 9
---

# Quick Task enr: Import Enrichment Pipeline Summary

Added a plugin-based enrichment pipeline to the ETL import flow. First plugin splits Apple Notes folder paths (`Work/BairesDev/MSFT`) into 4 materialized hierarchy columns (`folder_l1=Work`, `folder_l2=BairesDev`, `folder_l3=MSFT`), enabling SuperGrid multi-axis PAFV projection of folder structure.

## What Was Done

### 1. Enrichment Framework

Created `src/etl/enrichment/` with plugin architecture:
- **Enricher interface**: `id`, `description`, `appliesTo` (source filter or `'*'`), `enrich(cards)` pure function
- **Registry**: `registerEnricher()`, `runEnrichmentPipeline(cards, sourceType)` — runs matching enrichers in registration order
- **Auto-registration**: importing the barrel `index.ts` registers all built-in enrichers

### 2. FolderHierarchyEnricher

Pure function `splitFolderPath(folder)` → `[l1, l2, l3, l4]`:
- Splits on `/`, filters empty segments
- Levels 1-3: one segment each
- Level 4: joins remaining segments (handles depth > 4 gracefully)
- Null/empty folder → all nulls
- Idempotent: re-running overwrites with fresh splits

### 3. Schema Migration

- `schema.sql`: added `folder_l1 TEXT`, `folder_l2 TEXT`, `folder_l3 TEXT`, `folder_l4 TEXT` after `folder`
- `worker.ts initialize()`: `ALTER TABLE ADD COLUMN` with try/catch for existing DBs
- `schema-classifier.ts`: `name.startsWith('folder_l')` → Category classification

### 4. Pipeline Wiring

Both import paths now run enrichment:
- `ImportOrchestrator.import()`: Parse → **Enrich** → Dedup → Write (step 2 inserted)
- `handleETLImportNative()`: Enrich inserted before Dedup (step 1)

### 5. SQLiteWriter Extension

`ENRICHED_FIELD_NAMES` constant drives dynamic column inclusion:
- `insertBatch()`: enriched columns appended to INSERT column list with spread params
- `updateCards()`: enriched columns appended to SET clause with spread params
- Single source of truth: adding a field to `ENRICHED_FIELD_NAMES` auto-includes it in writes

### 6. Retroactive Backfill

`enrich:backfill` Worker message handler:
- Selects cards where `folder IS NOT NULL AND folder_l1 IS NULL`
- Applies `splitFolderPath()` in 1000-card batches
- Also cleans stale data: nulls folder_l* when folder itself is null
- Auto-runs during `initialize()` on first boot after migration

### 7. Worker-Side Allowlist Fix

Pre-existing bug: `validateAxisField()` in Worker handlers fell back to frozen sets (which don't include dynamic columns). The SchemaProvider delegation only worked on the main thread.

Fix: `setValidColumnNames(names)` added to `allowlist.ts` — the Worker now wires its PRAGMA-derived `validColumnNames` Set into the allowlist module after initialization. Priority chain: SchemaProvider > validColumnNames > frozen fallback sets.

This fix benefits **all** dynamic columns, not just enrichment fields.

### 8. Tests

31 new tests across 3 files:
- `FolderHierarchyEnricher.test.ts` (15 tests): splitFolderPath pure function + enricher integration
- `registry.test.ts` (9 tests): registration, dedup, source filtering, execution order
- `integration.test.ts` (7 tests): end-to-end import with real Database, GROUP BY verification, backfill, re-import

## Extension Points

To add a new enricher:
1. Create `src/etl/enrichment/MyEnricher.ts` implementing `Enricher`
2. If adding columns: append to `ENRICHED_FIELD_NAMES` + schema migration in `worker.ts`
3. Register in `index.ts`
4. Pipeline runs it automatically

Planned future enrichers:
- Time hierarchy (year/month/week from timestamp fields)
- Tag normalizer (case-fold, strip `#`, deduplicate)
- Content language detection
- Wikilink extraction
