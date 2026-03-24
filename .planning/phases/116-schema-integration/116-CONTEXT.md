# Phase 116: Schema Integration - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire graph metric columns into the PAFV system: SchemaProvider exposes them as dynamic axis fields, SuperGridQuery LEFT JOINs graph_metrics when metric columns are used, AlgorithmExplorer sidebar panel provides Run/parameter controls, and algorithms execute against the currently filtered card set. No NetworkView visual encoding (Phase 117), no stale indicator (Phase 118).

</domain>

<decisions>
## Implementation Decisions

### SchemaProvider injection
- Extend existing override layer (latchOverrides + disabledFields) to include graph_metrics columns
- After `graph:compute` completes, dynamically add community_id, pagerank, centrality, clustering_coeff, sp_depth, in_spanning_tree to SchemaProvider
- Uses the same `getAllAxisColumns()` path that PropertiesExplorer reads
- Consistent with v5.3 dynamic schema pattern — columns appear/disappear based on graph_metrics table state
- LATCH classification: all graph metric columns classified as numeric (except community_id which is categorical)

### SuperGridQuery LEFT JOIN
- `SuperGridQuery` accepts an optional `metricsColumns: Set<string>` parameter
- When non-empty: adds `LEFT JOIN graph_metrics ON cards.id = graph_metrics.card_id` and includes those columns in SELECT
- When empty/undefined: no JOIN added — zero overhead for non-algorithm SuperGrid renders
- Clean, explicit parameterization — per STATE.md research flag recommendation

### AlgorithmExplorer sidebar panel
- New `AlgorithmExplorer` file in `src/ui/` following WorkbenchShell explorer panel pattern
- Same architecture as CalcExplorer, PropertiesExplorer — own file, own sidebar section
- Contains:
  - Algorithm radio group (shortest path, centrality, community, clustering, MST, PageRank)
  - Run button dispatching `graph:compute` through WorkerBridge
  - Louvain resolution slider (default 1.0, range 0.1-10.0)
  - PageRank damping factor input (default 0.85, range 0.1-0.99)
  - Centrality sampling threshold control (default 2000)

### FilterProvider scope for compute
- Manual re-run only — Run button executes against current FilterProvider scope
- If filters change after computation, results go stale (Phase 118 adds stale indicator)
- User clicks Run again to recompute with new filter scope
- No auto-recomputation on filter changes — avoids expensive computation on every filter tweak
- `graph:compute` message includes current filtered card IDs from FilterProvider

### Claude's Discretion
- Exact SchemaProvider method signatures for adding/removing graph metric columns
- AlgorithmExplorer DOM structure and CSS styling
- How filtered card IDs are passed to graph:compute (inline vs separate query)
- Error handling for compute failures in AlgorithmExplorer UI
- Slider/input control implementations (range input, number input, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PAFV-01, PAFV-02, PAFV-03, CTRL-01, CTRL-02 acceptance criteria

### Phase 114+115 context (upstream decisions)
- `.planning/phases/114-storage-foundation/114-CONTEXT.md` — DDL schema, render token, graphology integration, handler file structure
- `.planning/phases/115-algorithm-engine/115-CONTEXT.md` — Algorithm implementations, batch model, response shapes, disconnected graph handling

### SchemaProvider (extend)
- `src/providers/SchemaProvider.ts` — Override layer (_latchOverrides, _disabledFields), getAllAxisColumns(), dynamic field support
- `src/providers/latch.ts` — LATCH family classification logic

### SuperGridQuery (modify)
- `src/views/supergrid/SuperGridQuery.ts` — SELECT/GROUP BY builder to add LEFT JOIN support
- `src/worker/handlers/supergrid.handler.ts` — SuperGrid query execution in Worker

### PAFV system
- `src/providers/PAFVProvider.ts` — Axis mapping, projection configuration
- `src/ui/ProjectionExplorer.ts` — Axis well droppers where metric columns must appear

### Graph metrics (read)
- `src/database/queries/graph-metrics.ts` — DDL, read/write/clear helpers
- `src/worker/handlers/graph-algorithms.handler.ts` — handleGraphCompute, response types
- `src/worker/WorkerBridge.ts` — graph:compute, graph:metrics-read, graph:metrics-clear bridge methods

### Explorer panel pattern
- `src/ui/CalcExplorer.ts` — Reference for sidebar panel architecture
- `src/ui/PropertiesExplorer.ts` — Reference for dynamic field display with LATCH chips

### Research
- `.planning/research/ARCHITECTURE.md` — System architecture, component responsibilities
- `.planning/research/PITFALLS.md` — Query builder pitfalls, dynamic column risks

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SchemaProvider._latchOverrides`: Map for overriding LATCH family per column — can add graph metric columns here
- `SchemaProvider.getAllAxisColumns()`: Returns all columns including disabled with overrides — graph metrics plug in here
- `CalcExplorer`: WorkbenchShell explorer panel pattern with per-column controls — architecture reference for AlgorithmExplorer
- `WorkerBridge.computeGraphAlgorithms()`: Already typed, dispatches graph:compute
- `FilterProvider.getFilteredCardIds()`: Returns current filter scope (if method exists, or equivalent query)

### Established Patterns
- Setter injection for late-binding providers (SchemaProvider, StateManager, PAFVProvider)
- `domain:action` naming for Worker messages
- WorkbenchShell explorer panels: own file in src/ui/, registered in shell layout
- INSERT OR REPLACE for idempotent writes
- Monotonically incrementing render token for stale response detection

### Integration Points
- `src/providers/SchemaProvider.ts` — Add graph metric column injection after compute
- `src/views/supergrid/SuperGridQuery.ts` — Add metricsColumns param + LEFT JOIN logic
- `src/ui/` — New AlgorithmExplorer.ts file
- WorkbenchShell layout — Register AlgorithmExplorer as sidebar section
- `src/worker/handlers/graph-algorithms.handler.ts` — May need filtered card IDs in compute payload

</code_context>

<specifics>
## Specific Ideas

- STATE.md research flag: "Verify current SuperGridQuery SELECT/GROUP BY builder before planning — may need a metricsColumns: Set<string> parameter" — confirmed, using metricsColumns param approach
- community_id is categorical (GROUP BY axis), while pagerank/centrality/clustering_coeff are numeric (continuous axes)
- sp_depth and in_spanning_tree are also numeric but binary/ordinal — may need special LATCH classification

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 116-schema-integration*
*Context gathered: 2026-03-23*
