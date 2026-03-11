# Project Research Summary

**Project:** Isometry v6.0 Performance
**Domain:** Performance profiling, optimization, and regression testing for a local-first TypeScript/D3.js/sql.js WASM/SwiftUI app
**Researched:** 2026-03-11
**Confidence:** HIGH

## Executive Summary

Isometry v6.0 is a performance milestone for a deeply built local-first app now targeting 20K-card scale. The research is unusually high-confidence because the existing codebase has 17 shipped milestones and 73 phases of context: every integration point, load-bearing constraint, and architectural boundary is known. The recommended approach is a strict profile-first methodology — measure all 4 performance domains (render, import, launch, memory) at 20K-card scale before touching any code, then optimize only what the data identifies as a bottleneck, then lock in budgets with automated regression guards. The primary tooling is zero-install: Vitest bench mode (already in the stack via tinybench), `performance.mark()`/`performance.measure()` (W3C User Timing API, works in Web Workers), and Xcode Instruments. The only new dependency is `rollup-plugin-visualizer` for bundle analysis.

The dominant expected bottleneck is SQL query time inside the Worker at 20K rows — specifically the `supergrid:query` GROUP BY across PAFV axis columns. Adding covering indexes on `status`, `folder`, `priority`, `card_type`, `created_at`, and `modified_at` is the highest-leverage single optimization. All other domains (import throughput, cold start, memory) have well-characterized failure modes and known mitigations. The base64 checkpoint transport for DB hydration becomes a risk above 8MB (approximately 10-15K cards with content); this threshold must be measured before any launch-time work begins.

The critical risk for this milestone is not technical complexity — it is process risk: the temptation to optimize familiar-feeling code paths (the rAF coalescer, the virtualizer, the Worker bridge) before profiling data identifies them as actual bottlenecks. Every optimization phase must cite a ranked bottleneck from Phase 1 profiling output as its justification. Additionally, four architectural constraints are load-bearing and must not be violated by optimization work: the D3 data join owns all state (no caching of CellDatum[] on the main thread), the two-tier StateCoordinator batching must not be bypassed by direct `render()` calls, the virtualizer window must be computed synchronously at render entry, and the Worker must maintain a single `Database` instance per lifetime (no destroy-and-recreate cycles).

## Key Findings

### Recommended Stack

The v6.0 stack adds only one new npm dependency (`rollup-plugin-visualizer@^7.0.1`) on top of the existing locked stack. All other profiling tools are zero-install: Vitest 4.0's built-in bench mode (via tinybench), `performance.mark()`/`performance.measure()` (available in Web Workers, WKWebView on iOS 17+, and jsdom), and Xcode Instruments (Time Profiler, Allocations, VM Tracker). GitHub Actions CI gets a 4th parallel bench job alongside the existing typecheck/lint/test jobs.

**Core technologies:**
- **Vitest bench mode (built-in)**: Algorithmic benchmarks for sql.js queries and ETL pipeline — already installed, zero config; `--compare` flag enables branch-to-branch regression detection
- **`performance.mark`/`performance.measure` (W3C API)**: Instrument all Worker bridge round-trips, WASM init, and D3 render cycles — zero-dependency, works everywhere the app runs including Web Workers
- **`rollup-plugin-visualizer@^7.0.1`**: Interactive bundle treemap with gzip/brotli sizes — hooks directly into Vite's `plugins[]`, dev-only, Node >=22 required (already met)
- **Chrome DevTools Performance + Memory Inspector**: Manual WASM profiling, D3 join leak detection via heap snapshot diffing; Chrome 134+ overhauled Performance panel
- **Xcode Instruments (Time Profiler, Allocations, VM Tracker)**: Native WKWebView process profiling; WWDC 2025 added Processor Trace for hardware-assisted profiling on Apple silicon

**What NOT to add:** DuckDB-WASM (explicitly deferred in PROJECT.md), `web-vitals` (for public web apps, not WKWebView), Lighthouse CI (no external URL to fetch), CodSpeed (unnecessary overhead for single-developer project), Canvas/WebGL rendering (would destroy the CSS Grid spanning model that SuperGrid is built on).

### Expected Features

The milestone has a clear profile-first dependency chain. 20K-card seed data is the universal prerequisite — without it, no benchmark means anything repeatable.

**Must have (table stakes):**
- Synthetic 20K-card seed dataset with varied distribution — enables all benchmarks and CI repeatability
- Instrumented baselines across all 4 domains (render, import, launch, memory) before any optimization
- SuperGrid 60fps at 20K cards — <16.7ms p99 frame time, <200ms p99 filter-to-repaint Worker round-trip
- SQL index optimization on PAFV axis-eligible columns — primary lever for `supergrid:query` GROUP BY at 20K rows
- Import benchmarked at 5K/10K/20K cards — documents actual ETL throughput and peak WASM heap
- Cold start FMP measured at 20K-card DB — <2s on physical device (not simulator); Xcode Instruments required
- WASM heap and JS heap profiling — leak detection via Chrome DevTools heap snapshot diff and WASM linear memory inspector
- CI bench job (4th GitHub Actions job) with threshold assertions using relative baselines, not absolute ms values
- Benchmark baseline JSON committed to `.benchmarks/` for future regression comparison

**Should have (differentiators):**
- `src/perf/` module (PerfMonitor, PerfBudget, PerfReporter, marks.ts) — isolated, feature-flag gated, injected as optional dependency
- Worker-side `timing` field populated in WorkerResponse — already defined in protocol schema (`timing?: { queued, executed, returned }`)
- WKWebView warm-up pattern if cold start profiling reveals WKWebView init as dominant bottleneck (>500ms)
- Checkpoint size measured at 1K/5K/10K/20K — documents binary transport threshold for future optimization
- `webViewWebContentProcessDidTerminate` handler wired for blank-screen recovery under memory pressure

**Defer (v6.x after profiling reveals specific need):**
- ETL batch size increase (100 → 250 or 500 cards) — only if profiling shows transaction overhead dominates
- Base64 → binary transport for DB checkpoints — only if checkpoint exceeds 10MB at target dataset size
- Non-virtualized view guards (List, Grid, Gallery) for 20K cards — only if profiling shows these views are used at scale
- 100K+ card support — architectural change to GROUP BY model required first; explicitly out of v6.0 scope
- DuckDB swap — explicitly deferred in PROJECT.md; sql.js with proper indexes handles 20K rows

### Architecture Approach

The v6.0 performance infrastructure is purely additive: a new `src/perf/` module (PerfMonitor, PerfBudget, PerfReporter, marks.ts) that acts as a passive observer injected as an optional dependency into WorkerBridge and ViewManager. Existing components receive minimal instrumentation: one-line `latency = Date.now() - sentAt` in `WorkerBridge.handleResponse()` (sentAt is already tracked), `performance?.mark()` calls at natural phase boundaries in `worker.ts initialize()`, and marks at `ViewManager._fetchAndRender()` entry/exit. No existing behavioral logic changes in Phase 1. The benchmark harness (`tests/perf/*.bench.ts`) runs sql.js directly without a Worker (Worker is unavailable in jsdom) — this accurately measures SQL performance and follows the v0.1 precedent. D3/DOM render benchmarks are explicitly excluded from Vitest and routed to Playwright E2E instead.

**Major components:**
1. **PerfMonitor** (`src/perf/PerfMonitor.ts`) — metric collector: `record(type, value)`, `getStats()`, frame sampler via rAF; injected via constructor config, feature-flag gated; zero effect on behavior when disabled
2. **PerfBudget** (`src/perf/PerfBudget.ts`) — threshold constants derived from Phase 1 measured data (not guesses); consumed by benchmark tests for CI gate assertions
3. **BenchmarkHarness** (`tests/perf/benchmark.*.bench.ts`) — Vitest bench tests against real sql.js WASM; assert p99 < PerfBudget constants; output to `.benchmarks/main.json` for `--compare` regression detection
4. **CI bench job** (GitHub Actions 4th job) — runs `vitest bench --run`; non-blocking until budgets are calibrated from measured data, then enforced; uses relative baselines to avoid shared-runner variance flakiness

**Key modified components (all minimal, non-behavioral changes):**
- `WorkerBridge.handleResponse()` — one line: record latency from existing `sentAt` to PerfMonitor
- `worker.ts initialize()` — `performance?.mark()` at WASM and PRAGMA phase boundaries (optional chaining for safety)
- `ViewManager._fetchAndRender()` — marks at entry and resolved D3 join (async: mark "done" in `.then()`)

### Critical Pitfalls

1. **Optimizing without profiling data (Amdahl's Law violation)** — Every optimization phase must cite a bottleneck from the Phase 1 ranked list with numeric evidence. "It feels slow" is not a valid justification. Profile all 4 domains before writing optimization code; if the profiling phase has no ranked bottleneck document as output, it is not complete.

2. **Breaking D3 data join ownership** — Never skip the `.data(keyFn).join()` call, cache a D3 selection across render cycles, or add a CellDatum[] cache on the main thread. The D3 data join IS state management (D-001). Run full SuperGrid test suite plus manual correctness baseline after every render-path change.

3. **Stale Worker query cache** — If a query cache is added, invalidation must fire on ALL write paths: `db:mutate`, `db:exec`, `etl:import-native`, and CloudKit SyncMerger. Cache invalidation on only `db:mutate` produces silent data corruption (wrong histogram bins, stale aggregate footer rows). Use a generation counter or avoid cross-request caching entirely.

4. **Benchmark CI flakiness eroding trust** — GitHub Actions shared runners have ±30-40% variance. Never use absolute ms thresholds in CI. Use relative baselines (flag >20% regression vs rolling baseline) or algorithmic complexity tests (assert N/10N ratio is 8x-12x, not that N < 50ms). D3/DOM benchmarks in jsdom are 100x slower than real browsers and produce false baselines — never run them in CI.

5. **WASM heap fragmentation from in-session destroy-and-recreate** — Never call `db.close()` + `new SQL.Database()` within an existing Worker lifetime. WASM linear memory cannot compact — repeated in-session reconstruction fragments the heap, leading to non-deterministic OOM on the next large allocation. Worker restart (full termination + relaunch) is the only correct recovery pattern.

6. **rAF coalescer bypass from "fast path" optimizations** — All render triggers must route through `StateCoordinator` → `_scheduleNotify`. Direct `viewManager.render()` calls from provider setters bypass the coalescer, causing multiple renders per frame on compound state changes — exactly the jank the coalescer exists to prevent.

## Implications for Roadmap

Based on combined research, the roadmap has a mandatory sequential dependency structure for the first two phases (profile must precede budget-setting), followed by parallel execution across independent optimization domains, and a final convergence phase for regression guards.

### Phase 1: Baseline Profiling + Instrumentation

**Rationale:** Profile-first is non-negotiable. The temptation to skip to optimization is the top-ranked pitfall and the most common way performance milestones produce effort without user-visible improvement. This phase gates all subsequent phases — no optimization work begins until a ranked bottleneck list with numeric evidence exists.
**Delivers:** Synthetic 20K-card seed dataset; `src/perf/` module (PerfMonitor, marks.ts); instrumentation wired into WorkerBridge, `worker.ts initialize()`, and ViewManager; Chrome DevTools profiling sessions documented; Xcode Instruments sessions on real device; ranked bottleneck list for all 4 domains with actual ms values.
**Addresses:** Baseline measurements (table stakes), p99 latency as primary metric, WASM init timing decomposition, DB hydration size at 20K cards.
**Avoids:** Pitfall 1 (optimizing without data), Pitfall 6 (flaky benchmarks — budgets come from measured data, not guesses).
**Research flag:** Standard patterns — instrumentation APIs are well-documented and partially already in use (WorkerBridge sentAt, WorkerResponse timing field). No deep research needed.

### Phase 2: Performance Budgets + Benchmark Skeleton

**Rationale:** Budgets must be derived from Phase 1 measured data, not set in advance. This is the "red" step of TDD applied to performance — write failing tests where the codebase violates target budgets. These failing tests define precisely what Phase 3 must fix, preventing wasted effort.
**Delivers:** `src/perf/PerfBudget.ts` with constants derived from Phase 1 data; `tests/perf/benchmark.supergrid.bench.ts`, `benchmark.etl.bench.ts`, `benchmark.launch.bench.ts`; `regression.budgets.test.ts` with CI-safe relative baselines; 4th GitHub Actions bench job (non-blocking initially, promoted to enforced in Phase 4).
**Uses:** Vitest bench mode, tinybench p99 metrics, `benchmark.outputJson`, GitHub Actions CI (existing 3-job pattern).
**Avoids:** Pitfall 6 (flaky CI — relative baselines only, algorithmic complexity tests for any DOM-adjacent paths).
**Research flag:** Standard patterns — Vitest bench API is fully documented with known working configuration examples. No research needed.

### Phase 3A: Render Optimization (SQL Indexes + Virtualizer)

**Rationale:** Expected to be the dominant bottleneck at 20K cards based on architectural analysis. SQL GROUP BY over 20K rows without indexes causes full table scans — the primary query path in `supergrid:query`. This phase runs in parallel with 3B and 3C because it uses a different tooling context (Chrome DevTools + SQL EXPLAIN QUERY PLAN).
**Delivers:** `CREATE INDEX IF NOT EXISTS` on PAFV axis columns in schema.sql (validated by EXPLAIN QUERY PLAN output); `ANALYZE` after bulk import to update statistics; SuperGridVirtualizer threshold verification for PAFV projections (leaf row count != raw card count); D3 join leak audit via heap snapshot diffing; non-virtualized view guards if profiling shows these views are used at 20K scale.
**Uses:** sql.js `EXPLAIN QUERY PLAN`, Chrome DevTools Memory panel (heap snapshot diff), WASM linear memory inspector.
**Avoids:** Pitfall 2 (D3 data join ownership — no render caching), Pitfall 3 (no cross-request query result cache), Pitfall 9 (virtualizer window computed synchronously at render entry, not pre-computed on data change).
**Research flag:** SQL index optimization requires EXPLAIN QUERY PLAN analysis specific to SuperGrid's multi-axis GROUP BY patterns. Index candidates must be validated against actual query output, not assumed. Recommend a focused research step during planning to avoid over-indexing or incorrect index types.

### Phase 3B: Import + Memory Optimization

**Rationale:** Import pipeline was validated at 5K cards (v1.1) and must be re-validated at 20K. WASM heap memory pressure from database growth over a session is a distinct failure mode from render performance. Runs in parallel with 3A because it uses different tooling (Vitest bench ETL harness + Chrome DevTools Memory Inspector + Xcode Instruments Allocations).
**Delivers:** ETL throughput benchmarks at 1K/5K/20K cards; peak WASM heap measured during 20K import; batch size tuning if Phase 1 reveals transaction overhead dominates (100 → 250 or 500 cards); FTS rebuild time documented at 20K; checkpoint file size measured at all dataset scales; `webViewWebContentProcessDidTerminate` handler wired with memory-warning early-save observer.
**Uses:** Chrome DevTools Memory Inspector (Wasm tab), Xcode Instruments Allocations, Vitest bench ETL harness.
**Avoids:** Pitfall 5 (WKWebView process termination — must include physical device testing under memory pressure), Pitfall 7 (WASM heap fragmentation — no ephemeral Database instances during import pipeline).
**Research flag:** Physical device testing is required. Simulator does not accurately represent WKWebView content process memory budget, which varies by device generation.

### Phase 3C: Launch Time Optimization

**Rationale:** Cold start involves the Swift layer, WKWebView initialization, WASM binary loading, and base64 DB hydration — a multi-layer pipeline that spans native and JS contexts. Requires Xcode Instruments on a physical device, which is a separate tooling context from Phases 3A/3B, enabling parallel execution.
**Delivers:** Cold start pipeline decomposed via Xcode Time Profiler (process start → WKWebView warm → WASM load → `wasm-init` → DB hydration → LaunchPayload → first query → first render); FMP measured on physical device; WKWebView warm-up implementation if init time exceeds 500ms; base64 checkpoint size measured and threshold documented for future binary transport decision; memory warning observer for early checkpoint save before process termination.
**Uses:** Xcode Instruments Time Profiler, `performance.mark()` at `worker.ts initialize()` boundaries (instrumented in Phase 1).
**Avoids:** Pitfall 4 (postMessage payload growth — base64 checkpoint size measured before any changes to checkpoint transport), Pitfall 5 (WKWebView termination — memory pressure observer added here).
**Research flag:** WKWebView warm-up is an established pattern with reference implementations (WebViewWarmUper). Standard implementation — no deep research needed.

### Phase 4: Regression Guard + CI Integration

**Rationale:** Performance work without regression guards is wasted — the next feature PR regresses everything and no one notices until users complain. This phase finalizes budgets from Phase 3 actual measured values, converts the non-blocking CI bench job to an enforced gate, and documents all new performance contracts for future phases.
**Delivers:** `regression.budgets.test.ts` finalized with post-optimization measured thresholds; `.benchmarks/main.json` baseline committed to repo; 4th CI job promoted from non-blocking to enforced for critical paths; `src/perf/PerfReporter.ts` with debug-mode `console.table` output; CommandBar hook for on-demand perf snapshot (debug builds only); performance contracts documented in PROJECT.md matching v0.1 format ("Performance thresholds: supergrid:query 20K cards <Xms").
**Avoids:** Pitfall 6 (flaky benchmarks — final gate design uses relative baselines and algorithmic complexity tests; absolute ms thresholds banned from CI).
**Research flag:** Standard patterns — CI integration follows the existing GitHub Actions 3-job pattern (add a 4th parallel job). No research needed.

### Phase Ordering Rationale

- **Phase 1 is a hard gate.** No optimization code ships until the ranked bottleneck list exists. This is the architectural constraint that prevents Pitfall 1 (Amdahl's Law violation). All optimization phases cite from this list as their justification.
- **Phase 2 before optimization phases.** Budget tests must be failing ("red") before optimization makes them pass ("green"). This is TDD applied to performance — the failing tests define the work scope precisely and prevent optimization theater where effort is spent but no user-measurable improvement results.
- **Phases 3A/3B/3C in parallel.** The 3 optimization domains have separate tooling contexts and independent code paths. They can proceed simultaneously once Phase 2 establishes the failing tests. Render work does not block import work; import work does not block launch work.
- **Phase 4 last.** Regression guards require post-optimization actual measurements. Budgets set before optimization are arbitrary; budgets set from measured post-optimization numbers are achievable and meaningful. The CI gate is non-blocking until this phase explicitly promotes it.
- **Minimal code footprint:** Approximately 500-900 new TS LOC (bench tests + instrumentation + index DDL + seed script) and 100-200 modified TS LOC (SQLiteWriter batch size, ViewManager guards, schema.sql indexes). This is a profiling and targeted-fix milestone, not a feature rewrite milestone.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3A (SQL indexes):** EXPLAIN QUERY PLAN output for actual SuperGrid multi-axis GROUP BY queries at 20K cards is not yet known. Index candidates must be validated against actual query patterns. Worth a focused research step to avoid over-indexing or choosing incorrect index column ordering.
- **Phase 3B (memory — physical device):** WKWebView content process memory termination threshold varies by device generation. Must test on the oldest device in the target matrix, not just developer hardware.

Phases with standard patterns (skip research-phase):
- **Phase 1:** All instrumentation APIs (performance.mark, Vitest bench, Xcode Instruments) are well-documented. WorkerBridge sentAt and WorkerResponse timing field are already in the codebase.
- **Phase 2:** Vitest bench configuration (outputJson, compare, reporters) is fully documented with working examples. GitHub Actions 4th job follows existing pattern exactly.
- **Phase 3C:** WKWebView warm-up is an established pattern with reference implementations. Standard integration.
- **Phase 4:** CI enforcement and PerfReporter follow standard patterns with no novel integrations.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tooling verified against official docs. Only one new npm dependency. Vitest bench, performance.mark, and Xcode Instruments are production-ready. Version compatibility confirmed (Vitest 4.0, Vite 7.3, Node >=22). |
| Features | HIGH | Feature landscape derived from existing codebase architecture and established patterns across 17 milestones. Performance targets (60fps, <2s FMP, <100MB WASM heap) are grounded in device constraints, architecture analysis, and existing project decisions. |
| Architecture | HIGH | All integration points verified via direct source analysis of WorkerBridge.ts, worker.ts, StateCoordinator.ts, SuperGridVirtualizer.ts, and MutationManager.ts. The `sentAt` tracking and `timing?` field in WorkerResponse are already present — confirmed in source. |
| Pitfalls | HIGH | 9 critical pitfalls identified with load-bearing constraints drawn from 17 shipped milestones and verified community sources. Every pitfall has a specific prevention strategy and detection signal. |

**Overall confidence:** HIGH

### Gaps to Address

- **SQL index optimization scope:** EXPLAIN QUERY PLAN output for actual SuperGrid GROUP BY queries at 20K cards is not yet known. Phase 3A must run the analysis before writing DDL. Index candidates are hypothesized from architectural analysis (status, folder, priority, card_type, created_at) but must be confirmed by measured query plans — do not pre-determine indexes before profiling.
- **Actual 20K-card DB size and checkpoint size:** The base64 checkpoint size at 20K cards is estimated (5-15MB) but not measured. Phase 1 must measure this before Phase 3C launch work begins. If the checkpoint exceeds 8MB, binary transport investigation may need to be accelerated from v6.x to v6.0.
- **WKWebView content process memory budget on target devices:** The memory termination threshold varies by device generation (typically ~120MB on older iOS devices). Phase 3B must measure on the oldest supported device in the test matrix to know the real constraint.
- **Benchmark variance calibration:** The appropriate relative baseline threshold (20%? 30%?) for CI bench comparison depends on actual variance measured on the GitHub Actions runner environment. Phase 2 should run the bench suite 3-5 times without code changes to calibrate before setting the regression flag threshold.

## Sources

### Primary (HIGH confidence)
- [Vitest benchmark config docs](https://vitest.dev/config/benchmark) — outputJson, compare, reporters; outputFile deprecation confirmed
- [Vitest bench features](https://vitest.dev/guide/features) — bench mode overview, p99 metrics via tinybench
- [Vitest profiling test performance](https://vitest.dev/guide/profiling-test-performance) — execArgv heap/CPU profiling configuration
- [MDN Performance.mark()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/mark) — Web Worker support confirmed; W3C CR Draft Feb 2025
- [Chrome DevTools Memory Inspector](https://developer.chrome.com/docs/devtools/memory-inspector) — WASM linear memory inspection (Wasm tab)
- [Apple WWDC 2025 — Optimize SwiftUI performance with Instruments](https://developer.apple.com/videos/play/wwdc2025/306/) — Instruments 26, Processor Trace, CPU Counters
- [Detached window memory leaks — web.dev](https://web.dev/articles/detached-window-memory-leaks) — heap snapshot analysis, detached node detection
- [Performance budgets — MDN](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Performance_budgets) — threshold definition, CI integration
- Direct source analysis: WorkerBridge.ts, worker.ts, StateCoordinator.ts, SuperGridVirtualizer.ts, MutationManager.ts, PROJECT.md

### Secondary (MEDIUM confidence)
- [Debugging a SQLite WASM Heap Fragmentation Bug — AppSoftware](https://www.appsoftware.com/blog/debugging-a-sqlite-wasm-heap-fragmentation-bug-in-a-vs-code-extension) — WASM heap fragmentation failure mode and resetCache() recovery pattern
- [Is postMessage slow? — surma.dev](https://surma.dev/things/is-postmessage-slow/) — 10KB payload boundary for 60fps paths, structured clone vs transferable
- [WKWebView warm-up — WebViewWarmUper](https://github.com/bernikovich/WebViewWarmUper) — WKWebView pre-init pattern
- [Using Vitest bench for CI regressions — CodSpeed](https://codspeed.io/blog/vitest-bench-performance-regressions) — relative baseline approach, --compare workflow
- [Handling blank WKWebViews — nevermeant.dev](https://nevermeant.dev/handling-blank-wkwebviews/) — webViewWebContentProcessDidTerminate recovery pattern
- [Benchmarking Support — vitest-dev/vitest Discussion #7850](https://github.com/vitest-dev/vitest/discussions/7850) — concurrent benchmark flakiness warning from tinybench docs
- [rollup-plugin-visualizer npm](https://www.npmjs.com/package/rollup-plugin-visualizer) — v7.0.1, Node >=22 requirement, gzip/brotli reporting
- [Snapshot Benchmarking with Vitest](https://www.thecandidstartup.org/2025/08/25/snapshot-benchmarking.html) — baseline comparison pattern

### Tertiary (MEDIUM-LOW confidence)
- [Optimizing D3 Chart Performance for Large Data Sets — Reintech](https://reintech.io/blog/optimizing-d3-chart-performance-large-data) — data windowing and Web Workers patterns
- [SwiftUI App Startup Time Optimization — DEV Community](https://dev.to/sebastienlato/swiftui-app-startup-time-optimization-cold-launch-warm-launch-perceived-speed-47ao) — cold launch pipeline, lazy init patterns
- [WKWebView memory issue causes crash — Apple Developer Forums](https://developer.apple.com/forums/thread/119550) — WebContent process memory budget and termination behavior
- [D3 selection.data key function — d3/d3-selection GitHub Issue #108](https://github.com/d3/d3-selection/issues/108) — key function binding pitfalls and wrong exit group behavior

---
*Research completed: 2026-03-11*
*Ready for roadmap: yes*
