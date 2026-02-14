# Pipeline, SuperGrid, and Filter Improvements (2026-02-13)

## Summary
Implemented end-to-end fixes and enhancements for alto-index ETL into sql.js/SQLite, dynamic property schema-on-read, integrated filtering, and SuperGrid header/render resilience.

## Implemented
- Browser-safe YAML/frontmatter parsing path (removes Buffer runtime issue), including malformed YAML fallback.
- Integrated view reliability:
  - dataset refresh/requery wiring
  - import recovery actions/state
  - projection-sync query refresh
- SuperGrid rendering fixes:
  - header visibility fallback
  - header/cell alignment stabilization by preserving facet-derived header ordering
- Unified filter compiler contract:
  - added typed filter AST compiler used by LATCHFilterService and slider-driven filters
- Slider coverage expansion:
  - L/A/C/G + existing T/H
  - derived metrics (length, tag count, graph degree)
- Schema-on-read improvements:
  - typed node_properties columns (`value_string`, `value_number`, `value_boolean`, `value_json`)
  - backward-compatible legacy `value` retained
- ETL import metadata:
  - `etl_import_runs` and `etl_import_run_types`
  - run reconciliation summary persisted
- Deterministic source identity hardening:
  - robust fallback identity in deterministic source-id generation
- Tests:
  - regression coverage for malformed multi-line frontmatter
  - new Notes pipeline E2E test covering import/properties/projection/filter impact

## Key Files
- `src/etl/parsers/frontmatter.ts`
- `src/etl/alto-importer.ts`
- `src/etl/id-generation/deterministic.ts`
- `src/etl/storage/property-storage.ts`
- `src/etl/database/insertion.ts`
- `src/components/IntegratedLayout.tsx`
- `src/components/navigator/LatchGraphSliders.tsx`
- `src/d3/grid-rendering/GridRenderingEngine.ts`
- `src/services/query/filterAst.ts`
- `src/services/query/LATCHFilterService.ts`
- `src/db/schema.sql`
- `src/test/db-utils.ts`
- `src/etl/__tests__/alto-importer.test.ts`
- `src/etl/__tests__/alto-notes-pipeline.e2e.test.ts`

## Validation
- `npx vitest run src/etl/__tests__/alto-importer.test.ts src/etl/__tests__/alto-notes-pipeline.e2e.test.ts` passed.
