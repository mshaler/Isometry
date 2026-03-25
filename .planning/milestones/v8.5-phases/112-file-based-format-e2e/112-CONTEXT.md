# Phase 112: File-Based Format E2E - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end testing of all 6 file-based parsers (JSON, XLSX, CSV, Markdown, HTML, Apple Notes JSON) through ImportOrchestrator to sql.js. Covers happy path import, malformed input recovery, export round-trip fidelity, and cross-format dedup collision detection. Test-only phase — no production code changes.

</domain>

<decisions>
## Implementation Decisions

### Spec organization
- Single spec file: `e2e/file-formats.spec.ts` with 6 describe blocks (one per parser)
- Matches Phase 110 alto-index.spec.ts single-spec pattern
- Shared setup/teardown across describe blocks
- Additional describe blocks for malformed input, round-trip, and cross-format dedup

### Malformed input strategy
- Dedicated malformed fixture files per format, committed alongside good fixtures:
  - Truncated JSON (premature EOF)
  - Corrupt XLSX header (invalid zip/magic bytes)
  - CSV with unmatched quotes
  - Markdown with no frontmatter
  - HTML with broken tags
  - Apple Notes JSON with invalid schema
- Playwright asserts ImportToast error state visible (not a crash)
- Zero cards written for each malformed input

### Export round-trip fidelity
- All non-null fields must match after import -> export -> re-import cycle
- Tested for Markdown, JSON, and CSV formats (per success criteria)
- Field-by-field comparison: every non-null field in original card must equal re-imported card
- Catches silent data loss — strict, matches success criteria wording

### Cross-format dedup collision
- Playwright E2E test through full ImportOrchestrator path
- Import JSON fixture first, then CSV fixture with overlapping card title (same name, different source)
- Assert 2 distinct rows with different `source` values via `queryAll()`
- Tests real dedup through ImportOrchestrator routing (not isolated DedupEngine)

### Claude's Discretion
- Exact fixture content for each parser's happy path test
- Specific malformed input byte patterns for each format
- ExportOrchestrator invocation pattern in Playwright (may need bridge helper)
- Test timeout values per describe block

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — FILE-01 through FILE-09 success criteria (v8.5 ETL E2E requirements)

### Phase 109 context (upstream decisions)
- `.planning/phases/109-etl-test-infrastructure/109-CONTEXT.md` — Bridge query API, fixture design pattern, E2E helper architecture

### Parser implementations
- `src/etl/ImportOrchestrator.ts` — Parser routing (apple_notes, markdown, csv, json, html, excel), ImportOptions interface
- `src/etl/parsers/JSONParser.ts` — JSON parser
- `src/etl/parsers/ExcelParser.ts` — XLSX parser
- `src/etl/parsers/CSVParser.ts` — CSV parser
- `src/etl/parsers/MarkdownParser.ts` — Markdown parser
- `src/etl/parsers/HTMLParser.ts` — HTML parser
- `src/etl/parsers/AppleNotesParser.ts` — Apple Notes JSON parser

### Export implementation
- `src/etl/ExportOrchestrator.ts` — Export routing for round-trip tests
- `src/etl/exporters/MarkdownExporter.ts` — Markdown export (designed for round-trip with MarkdownParser)

### E2E infrastructure
- `e2e/helpers/etl.ts` — `importNativeCards`, `assertCatalogRow`, `resetDatabase` helpers
- `e2e/helpers/isometry.ts` — Core E2E helpers (`waitForAppReady`, `getCardCount`)
- `e2e/alto-index.spec.ts` — Reference for single-spec-with-describe-blocks pattern

### Existing test fixtures
- `tests/etl-validation/fixtures/` — 9 existing snapshot fixtures (reference for fixture format)
- `tests/fixtures/alto-index/` — Alto-index JSON fixtures (reference for committed fixture pattern)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `importNativeCards(page, cards, sourceType)`: E2E bridge injection — may need a file-import equivalent helper
- `assertCatalogRow(page, sourceType, expectedMinCards)`: Verifies import provenance
- `resetDatabase(page)`: Test isolation between describe blocks
- `waitForAppReady(page)`: App readiness gate

### Established Patterns
- Sequential E2E execution: `fullyParallel: false, workers: 1`
- `page.evaluate()` for all database queries via `__isometry.queryAll()`
- Committed JSON fixtures as deterministic test data source
- ImportToast for user-visible import status/error feedback

### Integration Points
- `e2e/` directory — New `file-formats.spec.ts` joins existing specs
- `tests/fixtures/` — New `file-formats/` subdirectory for per-parser fixtures + malformed variants
- File import may need a new E2E helper (file-based parsers take File objects, not CanonicalCard[])

</code_context>

<specifics>
## Specific Ideas

- The 6 parsers and their ImportOrchestrator format keys: apple_notes, markdown, csv, json, html, excel
- Export round-trip only for Markdown, JSON, CSV (per success criteria — HTML and XLSX export may not exist)
- Cross-format dedup tests the DedupEngine's source-aware dedup: same title + different source = distinct rows

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 112-file-based-format-e2e*
*Context gathered: 2026-03-23*
