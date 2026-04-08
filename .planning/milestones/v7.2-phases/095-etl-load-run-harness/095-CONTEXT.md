# Phase 95: ETL Load/Run Test Harness - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Build an automated ETL load/run test harness that serially imports ALL alto-index datasets (alto-100 Apple Notes + 9 fixture sources) through ImportOrchestrator into a single real sql.js DB, then verifies SuperGrid correctness — total card counts, GROUP BY axis decomposition, CellDatum validity, aggregate footer computation, FTS coverage, and dedup idempotency.

</domain>

<decisions>
## Implementation Decisions

### Import Strategy
- Serial import of all sources into ONE shared DB instance (not per-source DBs)
- Import order: alto-100 first (primary dataset), then 6 web fixtures, then 3 native fixtures
- alto-100.json loaded as Apple Notes source via ImportOrchestrator.import('apple_notes', ...)
- Each import result captured for downstream count assertions
- Single beforeAll() setup, not per-test reimport (expensive WASM init)

### SuperGrid Verification
- Use real handleSuperGridQuery() and handleSuperGridCalc() — no mocks
- Verify against multiple axis configurations (card_type, folder, source, card_type×folder)
- CellDatum.card_ids validated as real UUIDs that exist in the cards table
- Sum of all CellDatum.count values must equal total card count for any axis config
- Aggregate footer rows (COUNT, SUM(priority)) verified mathematically

### Dedup Verification
- Re-import one source (apple_notes) after initial load
- Verify inserted=0, unchanged=N (idempotent)
- Total card count unchanged after re-import

### FTS Verification
- After all imports, FTS5 search for known terms returns results across multiple sources
- Verify FTS rowid join produces valid card IDs

### Test Architecture
- Single test file: tests/etl-validation/etl-load-run.test.ts
- Extends existing helpers.ts (createTestDb, importFileSource, importNativeSource, etc.)
- Uses real sql.js via Database class (not realDb() — that's for seam tests with makeProviders)
- describe.sequential() blocks for import order dependencies

### Claude's Discretion
- Exact assertion thresholds for "expected" card counts per source
- Whether to add timing instrumentation for import performance
- Test grouping within the file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ETL Infrastructure
- `src/etl/ImportOrchestrator.ts` — Pipeline orchestration (parse → dedup → write → catalog)
- `src/etl/types.ts` — CanonicalCard, ImportResult, SourceType definitions
- `src/etl/DedupEngine.ts` — Source-scoped dedup by source:source_id

### SuperGrid Verification
- `src/worker/handlers/supergrid.handler.ts` — handleSuperGridQuery, handleSuperGridCalc
- `src/worker/protocol.ts` — CellDatum, SuperGridQuery types
- `CLAUDE-v5.md` — D-011 __agg__ prefix convention (load-bearing)

### Test Infrastructure
- `tests/etl-validation/helpers.ts` — createTestDb, importFileSource, importNativeSource, loadFixture
- `tests/seams/filter/pafv-celldatum.test.ts` — SuperGrid correctness assertion patterns
- `tests/etl-validation/source-import.test.ts` — Per-source import validation patterns

### Datasets
- `public/alto-100.json` — 100 Apple Notes (path+content format, YAML frontmatter)
- `tests/etl-validation/fixtures/` — 9 source fixtures (apple-notes, markdown, csv, json, excel, html, native-notes, native-calendar, native-reminders)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/etl-validation/helpers.ts`: createTestDb(), importFileSource(), importNativeSource(), loadFixture(), loadFixtureJSON(), generateExcelBuffer(), queryCardsForSource(), queryCardCount(), queryConnectionCount()
- `handleSuperGridQuery()` and `handleSuperGridCalc()` can be called directly without Worker thread
- `source-view-matrix.test.ts`: Pattern for shared DB across multiple test blocks via beforeAll()

### Established Patterns
- Database cleanup in afterAll() (not afterEach — shared DB)
- jsdom environment annotation for DOM-dependent tests (not needed for pure DB tests)
- Fixture loading via readFileSync from __dirname-relative fixtures dir
- alto-100.json: array of {path, content} objects — content is raw markdown with YAML frontmatter

### Integration Points
- ImportOrchestrator.import(source, data) — main entry point for web sources
- DedupEngine + SQLiteWriter — direct path for native sources
- handleSuperGridQuery(db, query) — direct SQL execution against Database instance
- handleSuperGridCalc(db, query) — aggregate footer computation

</code_context>

<specifics>
## Specific Ideas

- "Confirm correctness and completeness of data displayed in SuperGrid" — this means mathematical proof that every imported card appears in SuperGrid cells, not just "no errors"
- Serial import order matters for dedup verification — must demonstrate idempotency
- The alto-100 dataset is the primary "real world" test — fixture snapshots are synthetic

</specifics>

<deferred>
## Deferred Ideas

- SQL seed dataset import (northwind, meryl-streep) — these use INSERT INTO nodes, not cards schema; would need adapter
- Performance benchmarking of serial import (import rate cards/sec)
- Visual SuperGrid rendering verification (requires jsdom + D3)

</deferred>

---

*Phase: 095-etl-load-run-harness*
*Context gathered: 2026-03-18*
