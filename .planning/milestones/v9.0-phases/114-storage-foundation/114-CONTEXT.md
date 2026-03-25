# Phase 114: Storage Foundation - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

The graph_metrics persistence layer, Worker protocol types, WorkerBridge methods, and render token design are in place so every downstream phase (115-118) can build against stable interfaces. No algorithm implementations — just the plumbing and a stub handler that validates the full round-trip.

</domain>

<decisions>
## Implementation Decisions

### DDL & Schema Design
- `graph_metrics` table created at Worker init alongside cards/connections/FTS5 (CREATE TABLE IF NOT EXISTS in existing init sequence)
- Columns: card_id (INTEGER PRIMARY KEY), centrality (REAL), pagerank (REAL), community_id (INTEGER), clustering_coeff (REAL), sp_depth (INTEGER), in_spanning_tree (INTEGER), computed_at (TEXT)
- `computed_at` stores ISO 8601 text (new Date().toISOString()) — matches existing import_runs timestamp pattern
- FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE — auto-cleans stale metrics on card delete, matches connections FK pattern
- Three indexes upfront: community_id, centrality, pagerank — covers all Phase 116 PAFV axis/GROUP BY query patterns, eliminates future indexing phase

### Render Token Mechanism
- `_renderToken: number` as private property on WorkerBridge, incremented in the graph:compute method
- Token attached to graph:compute request payload; response carries it back
- WorkerBridge discards responses where token < currentRenderToken (silent discard — no toast, no console warn)
- Token gates graph:compute only — graph:metrics-read is a fast SELECT with no staleness risk, graph:metrics-clear is explicit user action

### graphology Integration
- Build UndirectedGraph — Isometry connections are semantic relationships, and Louvain/clustering/MST require undirected
- Rebuild Graph from connections table on every graph:compute call — no caching, no invalidation logic (construction ~50ms at 10K edges)
- Parallel edges between same card pair deduplicated silently using mergeEdge() — algorithms treat topology, not edge count
- All connections included (including via_card_id rich relationship edges)

### Handler File Structure
- New `graph-algorithms.handler.ts` in src/worker/handlers/ — dedicated file, does not extend existing graph.handler.ts
- New `graph-metrics.ts` in src/database/queries/ — follows one-file-per-table convention (alongside cards.ts, connections.ts, graph.ts). Exports DDL string + typed write/read/clear functions
- Phase 114 delivers a stub graph:compute handler that builds UndirectedGraph and returns node/edge counts — validates full round-trip (protocol > bridge > worker > graphology > response) without algorithm logic
- Phase 115 adds the 6 algorithm implementations into the handler

### Claude's Discretion
- Exact graph-metrics.ts function signatures (write batch size, clear scope)
- WorkerBridge method naming for the 3 new public methods
- sanitizeAlgorithmResult() implementation details (loop vs Object.entries)
- Test file organization for the new handler and query helpers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Design
- `.planning/research/ARCHITECTURE.md` — Full system architecture diagram, component responsibilities, recommended project structure, Worker-side compute pattern
- `.planning/research/STACK.md` — graphology 0.26.0 dependency, algorithm-to-library mapping, bundle size analysis
- `.planning/research/PITFALLS.md` — NaN/Infinity sanitization, disconnected graph handling, sampling thresholds, seeded RNG testing

### Requirements
- `.planning/REQUIREMENTS.md` — GFND-01 (graph_metrics DDL), GFND-02 (Worker graphology construction), GFND-03 (sanitizeAlgorithmResult utility)

### Existing Code (integration points)
- `src/worker/protocol.ts` — WorkerRequestType union to extend with 3 new types, WorkerPayloads/WorkerResponses to add typed shapes
- `src/worker/WorkerBridge.ts` — Singleton bridge to add 3 public methods + _renderToken property
- `src/worker/worker.ts` — Worker router switch to add 3 new cases
- `src/worker/handlers/index.ts` — Handler exports to include new graph-algorithms handler
- `src/database/queries/graph.ts` — Existing graph query helpers (connectedCards, shortestPath) for reference pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/worker/protocol.ts` — WorkerRequestType union, WorkerPayloads/WorkerResponses mapped types, WorkerRequest/WorkerResponse envelope. Add 3 new entries following `domain:action` naming convention.
- `src/worker/WorkerBridge.ts` — Singleton with `_send<T>()` private method for typed request/response. New public methods follow existing pattern (e.g., `simulateGraph()`, `querySupergrid()`).
- `src/worker/handlers/simulate.handler.ts` — Reference for heavy-compute handler pattern (reads data, processes in JS, returns structured result).
- `src/database/queries/cards.ts` — Reference for query helper pattern (typed functions accepting Database, parameterized SQL, exported DDL).

### Established Patterns
- `domain:action` naming for WorkerRequestType (e.g., `graph:compute`, not `computeGraph`)
- Handler files export a single `handle*` function per message type, called from Worker router switch
- Query helper files export DDL strings + typed CRUD functions accepting `Database` parameter (no module-level state)
- INSERT OR REPLACE for idempotent writes (used in ui_state, import catalog)

### Integration Points
- Worker init sequence in `src/worker/worker.ts` — add graph_metrics DDL after existing table creation
- Worker router switch — add 3 new cases routing to graph-algorithms handler
- `src/worker/handlers/index.ts` — export new handler functions
- `package.json` — add graphology + graphology-types as dependencies (Phase 114 needs UndirectedGraph for stub)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 114-storage-foundation*
*Context gathered: 2026-03-22*
