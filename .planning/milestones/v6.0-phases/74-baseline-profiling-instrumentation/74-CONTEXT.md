# Phase 74: Baseline Profiling + Instrumentation - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Instrument all 4 performance domains (render, query, import, bundle) and produce a ranked bottleneck list with numeric ms/MB evidence. No optimization code is written in this phase — it is purely observe-and-measure. Budget targets are deferred to Phase 75.

</domain>

<decisions>
## Implementation Decisions

### Instrumentation hooks
- Debug-only instrumentation — stripped from production builds via Vite define constant
- `__PERF_INSTRUMENTATION__` boolean define — tree-shaken in prod, zero runtime cost
- Thin PerfTrace wrapper utility (startTrace/endTrace) over performance.mark()/measure() with consistent naming conventions
- Single abstraction point for all instrumentation — easy to swap implementation later
- Migrate existing SQLiteWriter performance.now() batch timing to PerfTrace for unified instrumentation

### Test dataset strategy
- Use real-world Apple Notes dataset (user's full native import, estimated 5K–20K cards)
- For scale tiers the real dataset doesn't cover, duplicate/clone existing cards with modified IDs to reach 20K
- Two loading strategies per domain:
  - Import-from-scratch for ETL profiling (measures full parse/dedup/write/FTS pipeline)
  - Pre-loaded SQLite snapshot for render/query profiling (isolates measurement from import overhead)

### Bottleneck document
- Markdown report: BOTTLENECKS.md in the phase directory (.planning/phases/74-baseline-profiling-instrumentation/)
- Ranked by user-perceived severity: frequency x latency x user-facing impact (not raw ms)
- Measurements only — no proposed budgets (Phase 75 defines budgets from this data)
- Tables of ms/MB values per domain (render, query, import, bundle) at each scale tier
- This document gates Phase 76 and 77 optimization work

### Bundle analysis setup
- rollup-plugin-visualizer with treemap HTML output
- Dedicated `npm run analyze` script — not on every build (keeps dev builds fast)
- stats.html gitignored — regenerated on demand; key numbers captured in BOTTLENECKS.md
- Both raw and gzip sizes reported (gzipSize: true)

### Claude's Discretion
- PerfTrace naming convention (e.g. `wb:query`, `sg:render`, `etl:parse`)
- Exact instrumentation sites within each domain
- SQLite snapshot creation mechanism for isolated render/query profiling
- Card duplication strategy for reaching 20K scale tier

</decisions>

<specifics>
## Specific Ideas

- Real-world data profiling — user wants to measure against their actual Apple Notes dataset, not synthetic data
- Import-from-scratch vs pre-loaded snapshot dual approach ensures each domain measurement is clean and isolated

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SQLiteWriter.ts`: Already has `performance.now()` batch timing (lines 49-51) — will be migrated to PerfTrace
- `SuperGridVirtualizer.test.ts`: Has manual performance.now() benchmarks — pattern reference for profiling tests
- `SampleDataManager`: Existing demo data generator — not used directly but shows data generation patterns

### Established Patterns
- WorkerBridge postMessage is the query round-trip path — instrumentation wraps bridge.send() calls
- ViewManager._fetchAndRender() is the render cycle entry point — primary render instrumentation site
- SQLiteWriter BATCH_SIZE=100 with BULK_THRESHOLD=500 — ETL pipeline decomposition points
- Worker protocol in src/worker/protocol.ts — message types define all measurable operations

### Integration Points
- vite.config.ts — rollup-plugin-visualizer plugin added here (or separate analyze config)
- src/main.ts — app initialization, cold start timing entry point
- src/worker/ — Worker thread, query execution timing
- src/etl/ — import pipeline decomposition (parse/dedup/write/FTS rebuild per source)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 74-baseline-profiling-instrumentation*
*Context gathered: 2026-03-11*
