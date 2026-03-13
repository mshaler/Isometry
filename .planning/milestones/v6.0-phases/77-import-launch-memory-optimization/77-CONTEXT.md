# Phase 77: Import + Launch + Memory Optimization - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

ETL imports are throughput-validated at 20K cards, cold start is decomposed and bounded, and WASM heap growth is characterized with WKWebView termination handled gracefully. This is a measurement-and-optimize phase — profile first, fix what the data reveals.

</domain>

<decisions>
## Implementation Decisions

### ETL batch tuning
- Test batch sizes 100 vs 500 vs 1000 at 20K cards — pick the fastest based on benchmark data
- Keep single FTS rebuild after all inserts (current trigger-disable → bulk insert → rebuild pattern is already optimized)
- Benchmark all parser throughputs (json, markdown, csv, apple_notes) at 20K and document as baseline — no hard pass/fail throughput floor
- Keep current progress reporting granularity (fires every batch boundary regardless of batch size)

### Cold start decomposition
- Use PerfTrace markers (performance.now()) at each phase boundary: WASM download/compile → DB hydration → first meaningful paint
- Preload WKWebView + WASM compile in background during app launch animation to hide init behind native splash
- Document cold-start baseline only — no hard time budget; Phase 78 CI guards can reference the data
- Measure in vitest + PerfTrace (JS decomposition, CI-friendly) — no physical device Instruments requirement

### Memory profiling
- Use process.memoryUsage() in vitest before and after loading 20K cards (RSS, heapUsed, heapTotal)
- Test 3 import-delete-reimport cycles at 20K cards, compare heap at each steady state
- If heap growth >20% across 3 cycles, investigate and fix the leak within Phase 77
- No hard memory ceiling — document steady-state and peak numbers as baseline

### Crash recovery verification
- Write integration test simulating WKWebView termination → verify checkpoint data survives recovery cycle
- Keep 10-second safety timeout on recovery overlay (already generous, no need to adjust)
- Measure checkpoint save cost at 20K cards — if >50ms, consider debouncing
- Silent crash detection (checkForSilentCrash) already handled with isJSReady + nil webView guard — include in integration test coverage

### Claude's Discretion
- Optimal batch size selection (100/500/1000) based on benchmark winner
- Whether checkpoint save needs debouncing based on measured cost
- Any additional ETL optimizations if bottlenecks surface during measurement

</decisions>

<specifics>
## Specific Ideas

- Phase 74 BOTTLENECKS.md is the source of truth for baseline measurements: json 11.3K cards/s, markdown 18.9K/s, csv 26K/s, apple_notes 110K/s at 20K
- All 20K imports currently complete in under 2 seconds — optimization should focus on transaction overhead, not parser rewrites
- WKWebView warm-up during launch animation follows the pattern of hiding expensive init behind native UI transitions

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SQLiteWriter` (src/etl/SQLiteWriter.ts): BATCH_SIZE=100, BULK_THRESHOLD=500, FTS trigger disable/rebuild, progress callback with EMA rate
- `PerfTrace` (src/profiling/PerfTrace.ts): startTrace/endTrace/getTraces for performance measurement — reuse for cold-start decomposition
- `BridgeManager` (native/.../BridgeManager.swift): webViewWebContentProcessDidTerminate already wired with showRecoveryOverlay + reload + isJSReady flag
- `checkForSilentCrash()` (BridgeManager.swift): Guards on isJSReady + nil webView weak reference — already fixed 2026-03-07
- `Database.initialize()` (src/database/Database.ts): WASM init path with locateFile and schema SQL loading
- `PerfBudget.ts` (src/profiling/): Budget constants from Phase 75 — may need import/launch budgets added

### Established Patterns
- Transaction batching with setTimeout(0) yield between batches to prevent Worker starvation
- FTS trigger disable → bulk insert → single rebuild → trigger restore (P24 mitigation)
- PerfTrace markers with performance.now() for instrumented timing (Phase 74 convention)
- process.memoryUsage() available in vitest Node environment for heap snapshots

### Integration Points
- `SQLiteWriter.BATCH_SIZE` — the constant to parameterize for batch size testing
- `Database.initialize()` — where PerfTrace markers for WASM init go
- `BridgeManager.swift` — where WKWebView preload/warm-up logic goes
- Benchmark files (tests/profiling/*.bench.ts) — where new ETL/launch/memory benchmarks live

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 77-import-launch-memory-optimization*
*Context gathered: 2026-03-12*
