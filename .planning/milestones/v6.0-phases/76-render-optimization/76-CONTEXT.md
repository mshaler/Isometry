# Phase 76: Render Optimization - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperGrid interactions at 20K cards run at 60fps with SQL query times reduced by covering indexes on all PAFV axis-eligible columns. Includes index creation, virtualizer validation/tuning, postMessage payload reduction, and budget test greening.

</domain>

<decisions>
## Implementation Decisions

### Index Strategy
- Indexes created via `CREATE INDEX IF NOT EXISTS` in Worker schema init (idempotent, no migration tracking)
- Only measured bottlenecks targeted: composite index `(folder, card_type, deleted_at)` + expression indexes on `created_at`
- Expression indexes for ALL five time granularities (day, week, month, quarter, year) on `created_at` — not just month
- EXPLAIN QUERY PLAN verification as vitest assertion — test asserts `USING INDEX` appears, catches regressions if query changes

### Virtualizer Tuning
- Keep virtualizer simple: row-only windowing, no header-aware calculation
- Re-evaluate OVERSCAN_ROWS — test values 3, 5, 10 at 20K cards, pick best flicker-vs-cost tradeoff
- Vitest benchmark for virtualizer: 20K card test confirms activation and render under budget
- Claude's Discretion: VIRTUALIZATION_THRESHOLD — Claude picks fixed vs dynamic based on measurement with PAFV projections at 20K

### Payload Reduction
- Truncate card_ids to 50 per cell in supergrid:query response — tooltip shows "50 of N" pattern
- Add `supergrid:cell-detail` Worker message for lazy-fetch of full card_ids on cell drill-down (natural companion to truncation)
- Vitest assertion on payload size: `JSON.stringify(response).length` < threshold at 20K cards — catches payload regression

### Budget Enforcement
- Phase 76 MUST GREEN all SQL budget tests from PerfBudget.ts (12ms GROUP BY, 10ms strftime, 5ms status, 5ms FTS)
- Phase 76 ALSO targets render budget (BUDGET_RENDER_JSDOM_MS = 128ms) — not deferred to Phase 77
- If a target is unachievable with indexes alone, add more optimization (query rewrite, materialized views, caching) — keep original targets unless truly impossible
- Budget tests run locally only — skipped or relaxed in CI due to unpredictable runner perf characteristics

</decisions>

<specifics>
## Specific Ideas

- Phase 74 BOTTLENECKS.md is the source of truth for baseline measurements and optimization priorities
- GROUP BY folder,card_type = 24.9ms p99 (target: 12ms) — composite index expected to solve
- strftime('%Y-%m', created_at) = 20.6ms p99 (target: 10ms) — expression indexes
- Dual-axis 5K cells = 506ms jsdom (~63ms Chrome est) — worst render case to target
- card_ids truncation limit of 50 matches typical tooltip/preview needs without separate config

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridVirtualizer` (src/views/supergrid/SuperGridVirtualizer.ts): Two-layer CSS + JS strategy, VIRTUALIZATION_THRESHOLD=100, OVERSCAN_ROWS=5
- `SuperGridQuery` (src/views/supergrid/SuperGridQuery.ts): buildSuperGridQuery() with parameterized SQL, compileAxisExpr() for time granularities
- `supergrid.handler.ts` (src/worker/handlers/): handleSuperGridQuery() returns CellDatum[] with GROUP_CONCAT card_ids
- `PerfBudget.ts` (src/profiling/): Aspirational targets from Phase 75 — BUDGET_QUERY_GROUP_BY_20K_MS=12, BUDGET_RENDER_JSDOM_MS=128
- `allowlist.ts` (src/providers/): validateAxisField() for SQL safety — any new index DDL fields must be in allowlist

### Established Patterns
- Worker schema init: CREATE TABLE IF NOT EXISTS pattern in Worker startup — indexes should follow same pattern
- prepare+all pattern: supergrid handler uses db.prepare().all() not db.exec() — consistent with other handlers
- Performance measurement: performance.now() in vitest, jsdom /8 heuristic for Chrome estimates (Phase 74 convention)

### Integration Points
- Worker schema init (src/worker/worker.ts or database init) — where CREATE INDEX DDL goes
- supergrid.handler.ts — where card_ids truncation + new cell-detail handler live
- WorkerBridge.ts + protocol.ts — where new supergrid:cell-detail message type is defined
- SuperGridVirtualizer.ts — threshold/overscan tuning
- PerfBudget.ts — budget constants may need adjustment if measurements prove them wrong

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 76-render-optimization*
*Context gathered: 2026-03-12*
