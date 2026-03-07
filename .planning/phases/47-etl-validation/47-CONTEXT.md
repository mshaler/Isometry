# Phase 47: ETL Validation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Validate every import source produces correct data that renders correctly in every view — no silent data loss, no rendering failures, no dedup regressions. When validation finds bugs, fix them. Phase is done when all 81 source×view combinations pass and all 5 requirements are green.

</domain>

<decisions>
## Implementation Decisions

### Test Fixture Strategy
- Use BOTH real-world snapshot data (100+ cards per source) AND synthetic edge cases
- Snapshot fixtures saved as JSON/file fixtures in tests/fixtures/ for CI portability
- Native sources (Reminders, Calendar, Notes) use pre-captured CanonicalCard[] arrays as snapshot fixtures
- Optional live tests that hit actual device data — skipped in CI, available for local runs
- Per-source error fixtures: each source gets a deliberately broken/malformed fixture (malformed JSON, CSV with wrong columns, corrupt XLSX, HTML with no structure, etc.)

### View Coverage Matrix
- ALL 81 combinations tested: 9 sources × 9 views (Calendar, Gallery, Grid, Kanban, List, Network, SuperGrid, Timeline, Tree)
- Tests run in Vitest + JSDOM — D3 data joins execute, DOM elements asserted
- Validation checks: view mounts without error, expected number of DOM elements matches card count, no console errors, no empty containers
- Field-dependent feature validation: Calendar source cards appear on correct dates in CalendarView, Notes with links show edges in NetworkView, hierarchical data has tree nodes in TreeView, etc.

### Error Message Specificity
- Source-specific error messages: "Apple Notes: 3 notes had missing titles", "CSV: Column 'name' not found in row 7"
- Each parser provides its own error detail string, not just the generic ErrorBanner category
- Partial imports: success toast + error count + expandable detail (ImportToast already supports this pattern)
- Native macOS errors pass through NativeBridge — web layer wraps in source-specific messages: "Reminders: Access denied — grant permission in Settings"
- Tests assert error category + source type mention, NOT exact message text (avoids brittle tests)

### Fix vs Report Scope
- TDD-style validation: write tests first, fix underlying bugs when tests fail
- Fix wherever the bug is — parser, view, database query, StateCoordinator, anywhere
- If fixing changes parser output, update ALL affected unit tests — keep full suite green
- Exit criterion: all 81 source×view combos pass + all 5 ETLV requirements green

### Claude's Discretion
- Exact test organization (one file per source, one file per view, or matrix structure)
- JSDOM setup and D3 rendering mocks
- Order of validation (sources first vs views first)
- How to handle views that genuinely can't render certain data shapes (e.g., TreeView with flat CSV data)

</decisions>

<specifics>
## Specific Ideas

- 100+ cards per source in snapshot fixtures — stress-test rendering and dedup at scale
- Field-dependent validation means Calendar imports must show on correct dates, Network view must show connection edges from Notes links, etc.
- Per-source error fixtures should cover the most common real-world failure mode for each source type
- Dedup re-import validation: import 100+ cards, re-import same data, assert zero duplicates and correct insert/update/skip classification across all 9 sources

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ImportOrchestrator` (src/etl/ImportOrchestrator.ts): Wires parse → dedup → write → catalog pipeline for all 6 file sources
- `DedupEngine` (src/etl/DedupEngine.ts): Classifies cards as insert/update/skip by source_id + modified_at comparison
- `ImportToast` (src/ui/ImportToast.ts): Already supports success + error count + expandable error detail
- `ErrorBanner` (src/ui/ErrorBanner.ts): Categorizes errors into import/parse/database/network with recovery actions
- `etl-import-native.handler.ts`: Handles pre-parsed CanonicalCard[] from Swift native adapters (Reminders, Calendar, Notes)
- Existing parser tests in tests/etl/parsers/ for all 6 file parsers + DedupEngine
- Integration tests: etl-all-parsers.test.ts, etl-roundtrip.test.ts, etl-export-roundtrip.test.ts

### Established Patterns
- CanonicalCard/CanonicalConnection types are the integration seam — all parsers output these
- 9 source types: apple_notes, markdown, excel, csv, json, html, native_reminders, native_calendar, native_notes
- 9 views: CalendarView, GalleryView, GridView, KanbanView, ListView, NetworkView, SuperGrid, TimelineView, TreeView
- ViewManager handles mount/destroy lifecycle with loading/error/empty states (Phase 5+43)
- D3 data join is the rendering primitive — views use .data() with key functions

### Integration Points
- ViewManager.switchTo() mounts views with card data from worker queries
- Worker handlers (etl-import.handler.ts, etl-import-native.handler.ts) execute import pipeline
- StateCoordinator dispatches state changes that trigger view re-renders
- NativeBridge passes native adapter errors as string messages to web layer

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-etl-validation*
*Context gathered: 2026-03-07*
