# Quick Task: Import Enrichment Pipeline

## Goal

Add an enrichment pipeline between Parse and Dedup in the ETL import flow that transforms CanonicalCard[] with derived fields. First plugin: split `folder` paths into `folder_l1..folder_l4` materialized columns so SuperGrid can project folder hierarchy as multi-axis PAFV dimensions.

## Motivation

Apple Notes folder paths like `Work/BairesDev/MSFT` are stored as a single opaque `folder` TEXT column. SuperGrid treats this as one Category axis value. The user has 3 axes of information compressed into 1. By splitting at import time into materialized columns, SchemaProvider auto-discovers them and SuperGrid can GROUP BY each level independently.

## Tasks

1. **Enrichment framework** (types.ts, registry.ts, index.ts)
   - Enricher interface: id, description, appliesTo, enrich()
   - Registry: registerEnricher(), runEnrichmentPipeline()
   - Auto-registration on import

2. **FolderHierarchyEnricher** — first plugin
   - splitFolderPath() pure function: folder → [l1, l2, l3, l4]
   - Depth > 4 joins remaining into l4
   - Null folder → all nulls
   - Idempotent (safe to re-run)

3. **Schema migration** — folder_l1..l4 TEXT columns
   - ALTER TABLE ADD COLUMN in worker.ts initialize() (existing DBs)
   - Added to schema.sql (fresh DBs)
   - schema-classifier.ts: folder_l* → Category

4. **Wire into both import paths**
   - ImportOrchestrator: Parse → **Enrich** → Dedup → Write
   - etl-import-native handler: same insertion point

5. **SQLiteWriter extension** — enriched column writes
   - ENRICHED_FIELD_NAMES drives INSERT/UPDATE column lists
   - Dynamic placeholders from types.ts constant

6. **Retroactive backfill handler** (enrich:backfill)
   - Worker message type in protocol.ts
   - Reads cards with folder but null folder_l1, applies splitFolderPath
   - Auto-runs on first boot after migration

7. **Worker-side allowlist fix**
   - setValidColumnNames() added to allowlist.ts
   - Worker wires PRAGMA-derived column names after init
   - Fixes pre-existing gap: dynamic columns now pass validateAxisField() in Worker handlers

8. **Tests**
   - splitFolderPath: 10 cases (null, empty, 1-4 levels, depth >4, leading/trailing/consecutive slashes)
   - Registry: 9 cases (register, dedup, unregister, pipeline execution, source filtering, ordering)
   - Integration: 7 cases (end-to-end import, GROUP BY, backfill, re-import with folder change)

## Verification

- [x] 2,085 existing tests pass (zero regressions)
- [x] 31 new enrichment tests pass
- [x] Zero TypeScript errors from changes (10 pre-existing in pivot/)
- [x] Live browser test: imported 15 notes → SuperGrid folder_l1 × folder_l2 renders correctly
