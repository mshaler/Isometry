---
gsd_state_version: 1.0
milestone: v8.5
milestone_name: ETL E2E Test Suite
status: completed
stopped_at: Completed 118-02-PLAN.md
last_updated: "2026-03-25T03:15:00Z"
last_activity: 2026-03-24 -- Phase 117 NetworkView Enhancement complete (2 plans, 5 reqs)
progress:
  total_phases: 11
  completed_phases: 10
  total_plans: 25
  completed_plans: 24
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-22)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v9.0 Graph Algorithms

## Current Position

Phase: 118-polish-e2e (complete)
Plan: 02/02 complete
Status: Phase 118 complete
Last activity: 2026-03-25 -- Phase 118 Polish + E2E complete (2 plans, 4 reqs)

Progress: [█████████░] 90%

## Milestone History

- ✅ v8.0 SuperGrid Redesign: Phases 97-100 complete (4 phases, 7 plans, 14 plugins shipped)
- ✅ v8.1 Plugin Registry Complete: Phases 101-102 complete (2 phases, 6 plans, all 27 plugins wired)
- ✅ v8.2 SuperCalc v2: Phase 103 complete (1 phase, 2 plans, NullMode/CountMode/AggResult)
- ✅ v8.3 Plugin E2E Test Suite: Phases 104-107 complete (4 phases, 8 plans, 20 reqs, CI hard gate)
- ✅ v8.4 Consolidate View Navigation: Phase 108 complete (1 phase, 2 plans, ViewZipper removed)
- 🚧 v8.5 ETL E2E Test Suite: Phases 109-113 in progress (0/5 phases)

## v9.0 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 114 | Storage Foundation | GFND-01, GFND-02, GFND-03 | Not started |
| 115 | Algorithm Engine | ALGO-01, ALGO-02, ALGO-03, ALGO-04, ALGO-05, ALGO-06 | Not started |
| 116 | Schema Integration | PAFV-01, PAFV-02, PAFV-03, CTRL-01, CTRL-02 | Complete |
| 117 | NetworkView Enhancement | NETV-01, NETV-02, NETV-03, NETV-04, NETV-05 | Complete |
| 118 | Polish + E2E | GFND-04, PAFV-04, CTRL-03, CTRL-04 | Complete |

## Performance Metrics

**Velocity:**
- v8.4 milestone: 1 phase, 2 plans
- v8.3 milestone: 4 phases, 8 plans
- v8.2 milestone: 1 phase, 2 plans
- v8.1 milestone: 2 phases, 6 plans
- v8.0 milestone: 4 phases, 7 plans

*Updated after each plan completion*

## Accumulated Context

### Roadmap Evolution
- Phase 119 added: Swift Critical Path Tests — SyncManager, ProtobufToMarkdown Tier 1, NotesAdapter

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

**v9.0 design decisions (from research):**
- graphology 0.26.0 + graphology-shortest-path + graphology-metrics + graphology-communities-louvain for 5 of 6 algorithms; custom Kruskal's ~50 LOC for MST
- All algorithm computation runs inside the Worker; graphology Graph object never crosses postMessage
- graph_metrics sql.js table is the sole persistence and query layer for algorithm results (no JS-side Maps)
- Dual-circle overlay pattern for NetworkView: base circle retains source-provenance fill; .algorithm-overlay circle carries algorithm color
- Betweenness centrality uses √n-pivot sampling when nodes > 2000 (O(n*m) blocked at 10K+)
- Monotonically incrementing currentRenderToken stamps each algorithm request; stale responses discarded
- Louvain tests use seeded RNG ({ rng: () => 0.5 }); assert community membership invariants, never specific IDs
- [Phase 109-etl-test-infrastructure]: CanonicalCard interface duplicated in e2e/helpers/etl.ts rather than imported from src/ to keep E2E helpers self-contained
- [Phase 109-etl-test-infrastructure]: queryAll/exec exposed on window.__isometry with no debug flag gating - __isometry namespace is already dev/debug-only
- [Phase 109-etl-test-infrastructure]: mockPermission uses window.__mock_permission_{adapter} key convention; revoked deletes key
- [Phase 109]: Programmatic JSDOM requires global.document + global.Event injection; global.document alone is insufficient when tests dispatch Event objects
- [Phase 114-storage-foundation]: graph_metrics table uses INSERT OR REPLACE for idempotent upsert; sanitizeAlgorithmResult returns shallow copy to avoid mutation; computed_at optional on input, supplied by writeGraphMetrics
- [Phase 114]: Named { UndirectedGraph } import required from graphology — default export is Graph (mixed), not UndirectedGraph
- [Phase 119]: atParagraphStart flag replaces isFirstRun in convertToMarkdown to correctly apply paragraph prefix for all consecutive paragraph AttributeRuns
- [Phase 119-02]: Skip initialize() in SyncManager tests to avoid CloudKit entitlements; test file-based persistence directly
- [Phase 119-02]: SQLITE_TRANSIENT required for sqlite3_bind_text with Swift Strings; SQLITE_STATIC causes dangling pointer
- [Phase 119-02]: attributeRun required in ZDATA fixture: ProtobufToMarkdown.convertToMarkdown only emits text via attributeRun loop
- [Phase 119]: CKRecord can be constructed in-process without CloudKit entitlements; setCardFields/cardFieldsDictionary extension covers conflict resolution data path at SyncManager.swift line 374
- [Phase 119]: NoteAttributeRun.link assignment sets hasLink automatically in SwiftProtobuf generated code; no explicit hasLink = true required
- [Phase 110-alto-index-e2e]: edge-cases.json excluded from importAltoIndex — uses source='alto_edge_cases' test-only type, not a production subdirectory type
- [Phase 115-algorithm-engine]: graphology-metrics has no nodeSampling option — manual sqrt(n)-pivot Brandes BFS sampling implemented for n>2000 betweenness centrality
- [Phase 115-algorithm-engine]: Louvain subgraph approach: build UndirectedGraph without isolated nodes then assign null back — avoids singleton community flood
- [Phase 110-alto-index-e2e]: card_type CHECK constraint extended to reference/message/media; schema was too narrow for alto-index fixture card types
- [Phase 110-alto-index-e2e]: assertCatalogRow in etl.ts had wrong column name (card_count→cards_inserted) and wrong JOIN pattern for import_runs source_type filter
- [Phase 115-02]: Used it() with performance.now() for betweenness centrality benchmark: single-pass wall-clock sufficient to confirm sqrt(n) sampling; bench() iterations unnecessary
- [Phase 115-02]: Added **/*.bench.[jt]s to vitest include glob (Rule 3 auto-fix): required for npx vitest run to discover .bench.ts files
- [Phase 110-alto-index-e2e]: Two extra notes (250->252) cross FTS5 bulk rebuild threshold strictly (> 500 not >= 500)
- [Phase 113]: Use window.__mock_permission_{adapter} direct key manipulation instead of __harness API -- enables tests to run against main app (/) without harness mode dependency
- [Phase 111]: Dynamic import for handleETLImportNative after globalThis.self mock; boundary contract testing pattern for Swift/TS adapter seam
- [Phase 112]: SheetJS silently absorbs corrupt XLSX data (produces empty sheet, 0 rows) -- test asserts zero cards, not errors > 0
- [Phase 112]: MarkdownParser derives folder from file path, not frontmatter -- round-trip reimport needs directory paths to preserve folder
- [Phase 112]: HTML imported one string at a time through ImportOrchestrator (wraps single string as [data])
- [Phase 116]: community_id classified as Hierarchy+non-numeric (categorical); other 5 metrics as Hierarchy+numeric
- [Phase 116]: ALLOWED_METRIC_COLUMNS frozen set in SuperGridQuery for explicit LEFT JOIN validation (separate from SchemaProvider)
- [Phase 116]: Edge filtering via JS Set membership check after full connections query — simpler than parameterized IN clause on edges
- [Phase 116]: AlgorithmExplorer builds computePayload conditionally (no undefined) for exactOptionalPropertyTypes compliance
- [Phase 117]: BFS predecessor map added to computeShortestPath; resetEncoding uses direct attr set for opacity (no transition) to ensure jsdom testability; path-over-MST composition priority in _reapplyEncoding
- [Phase 117-networkview-enhancement]: Pick mode transition in _renderParams is silent (no onPickModeChange) to avoid spurious NetworkView state updates; only user-initiated events fire the callback
- [Phase 117-networkview-enhancement]: nv-source-badge/nv-target-badge class names (not picked-badge) on S/T SVG badge groups; aria-label='Source node'/'Target node' on <g> element
- [Phase 118]: Custom HTML div tooltip instead of d3-tip (zero new dependencies)
- [Phase 118]: _lastNumericAlgorithm tracks size encoding independently for cumulative composition

### Research Flags

- Phase 116 (SuperGridQuery LEFT JOIN): RESOLVED — metricsColumns?: string[] param with ALLOWED_METRIC_COLUMNS frozen set validation
- Phase 117 (NetworkView dual-circle): Verify D3 enter/update/exit key function approach with second .algorithm-overlay circle before finalizing requirements

### Blockers/Concerns

None. Awaiting v8.5 completion before beginning Phase 114.

## Session Continuity

Last session: 2026-03-25T03:15:00Z
Stopped at: Completed 118-02-PLAN.md
Resume: Phase 118 complete. All v9.0 phases done (114-118).
