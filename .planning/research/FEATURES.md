# Feature Landscape: v6.0 Performance

**Domain:** Performance profiling, optimization, and regression testing for TypeScript/D3/WASM/SwiftUI app
**Researched:** 2026-03-11
**Confidence:** HIGH — patterns verified against Vitest bench docs, Chrome DevTools WASM profiling docs, Apple WWDC 2025 SwiftUI Instruments session, and project's established infrastructure

**Existing infrastructure this milestone builds on:**
- SuperGrid virtual scrolling: SuperGridVirtualizer data windowing at 60fps (10K+ rows, v4.1)
- rAF coalescing: 4 simultaneous StateCoordinator callbacks → 1 Worker request (v3.0)
- Worker Bridge: typed message protocol with correlation IDs, all SQL off main thread (v1.0)
- FTS trigger disable/rebuild: bulk import optimization for >500 cards (v1.1)
- 100-card transaction batches: WASM OOM prevention (v1.1)
- CSS content-visibility: auto: progressive enhancement on Safari 18+ (v4.1)
- Two-phase native launch: LaunchPayload blocks before WorkerBridge so DB arrives before WASM init (v2.0)
- sql.js 1.14 custom FTS5 WASM build: 756KB (v0.1)

---

## Table Stakes

Features users expect for a "ship-ready performance" milestone. Missing these = the milestone is incomplete.

### 1. Instrumented Performance Baselines

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Baseline measurements across all 4 domains before any optimization | Can't optimize what you haven't measured. Industry standard: profile first, fix second. "Ship-ready at 20K cards" requires knowing current numbers at 20K | **Low** | Vitest bench (already in stack), Chrome DevTools, Instruments | 4 domains: Render (SuperGrid frame time), Import (ETL throughput), Launch (cold start FMP), Memory (heap growth curve). Measure at 1K / 5K / 10K / 20K card thresholds |
| p99 latency as primary metric (not average) | Averages hide tail-latency spikes that users notice. Existing precedent in codebase: `p99 as p95 proxy` (Decision table, v0.1) | **Trivial** | tinybench (already used) | Vitest `bench()` API exposes p99 via tinybench. Use `ops/sec` and `p99` columns. Existing pattern preserved |
| Documented target thresholds before coding begins | Prevents "optimization theater" where work happens but no one knows if targets were hit | **Trivial** | None | Targets established in PROJECT.md: 20K cards, 60fps interactions. This document defines what 60fps means in each domain |

**Implementation insight:** Vitest `bench()` uses tinybench under the hood. The codebase already has performance threshold tests (v0.1 validated: insert <10ms, bulk insert <1s, FTS <100ms, graph <500ms). New bench tests follow the same pattern. CodSpeed can detect regressions in CI but is optional — threshold assertions in `bench()` tests are sufficient without the external service.

### 2. Render Performance at 20K Cards

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| SuperGrid renders at 60fps during scroll with 20K cards | SuperGridVirtualizer already achieves 60fps at 10K+. Users expect the target to be raised to 20K | **Medium** | SuperGridVirtualizer (v4.1), CSS content-visibility | 10K→20K doubles the row count. Data windowing may need tighter window bounds. `getVisibleRange()` complexity stays O(1) — no algorithmic change needed, only threshold tuning |
| View transitions remain smooth at 20K cards | List/grid/timeline SVG morph and crossfade transitions (v0.5) were designed for small datasets. Must verify they degrade gracefully at scale | **Medium** | ViewManager transition logic, D3 selection.join | Key insight: views other than SuperGrid (list, grid, timeline) do NOT have virtualization. At 20K cards they will be slow. These may need explicit "too many cards" guards that skip transitions above a threshold |
| D3 data joins execute without layout thrash | `getBoundingClientRect()` in hot paths causes forced synchronous layout. SuperSelect bounding box cache (v3.0) addresses lasso. Other views may have hidden thrash | **Low** | Chrome DevTools Performance panel frame timeline | Use DevTools to identify any forced-layout reads interleaved with writes during D3 update selections |
| rAF coalescing handles 20K-row state changes | Current rAF coalescing merges 4 simultaneous callbacks → 1 Worker request. At 20K rows with filter changes, the Worker query round-trip time must stay under 200ms | **Low** | WorkerBridge, rAF coalescing in ViewManager | Profile: Worker supergrid:query at 20K rows with GROUP BY stacked axes. If >200ms, index optimization needed |

**What 60fps means in practice:** The browser renders at 16.67ms per frame. "60fps interactions" means each user action (scroll, filter change, axis swap, sort click) produces its visual result within one frame budget. At 20K cards, the bottleneck shifts from DOM operations to SQL query time in the Worker — the main thread stays free but the user sees stale data until the query resolves. Target: Worker query round-trip <100ms at 20K cards.

### 3. Import Performance Optimization

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| ETL import benchmarked at 5K / 10K / 20K cards | Import pipeline was designed and tested at 5K cards (v1.1). 20K-card imports from CSV, Excel, JSON need measured throughput | **Medium** | ImportOrchestrator, SQLiteWriter 100-card batches | 100-card transaction batches were chosen to prevent WASM OOM. At 20K cards = 200 transactions. Measure total time and peak heap |
| FTS trigger optimization verified at 20K cards | FTS trigger disable/rebuild pattern (v1.1) was validated at 5K. At 20K, the FTS rebuild after INSERT is the dominant cost. Measure rebuild time | **Low** | SQLiteWriter FTS optimization (v1.1) | Pattern: disable trigger → batch INSERT → `INSERT INTO cards_fts(cards_fts) VALUES ('rebuild')`. Rebuild time scales with row count. At 20K, expect 200-500ms rebuild — measure and document |
| Native import (Apple Notes, Reminders, Calendar) benchmarked | 200-card chunked bridge dispatch (v4.0) prevents WKWebView termination. At 20K records from Apple Notes, measure: Swift extraction time, chunked bridge transfer time, Worker handler time | **Medium** | NativeImportAdapter AsyncStream, WorkerBridge chunked dispatch | Calendar and Reminders are bounded (rarely >1K events). Apple Notes can have thousands. Focus benchmarks on Notes at 5K / 10K / 20K note scale |

**Implementation insight:** The 100-card batch size was chosen conservatively for WASM OOM safety. Profiling at 20K cards may reveal the batch size can be increased (200 or 500 cards) to reduce transaction overhead without hitting memory limits. Measure peak WASM heap during a 20K import before changing batch size.

### 4. Launch Time Optimization

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Cold start: First Meaningful Paint within 2 seconds | Apple recommends <400ms first frame, but that is for native apps. WKWebView + WASM initialization has additional overhead. Target: FMP ≤ 2s on device (not simulator) | **High** | Two-phase native launch (v2.0), WASM init, DB hydration | Cold start pipeline: Process start → App init → WKWebView create + warm → WASM load (756KB) → `wasm-init` message → DB hydration from base64 → `LaunchPayload` → first query → first render. Instrument each stage |
| DB hydration time at 20K cards profiled | `LaunchPayload` carries the full sql.js DB as base64. At 20K cards, the DB file is larger. Measure: base64 encode time in Swift, WKWebView message transfer time, base64 decode + sql.js FS.writeFile in JS | **Medium** | DatabaseManager actor, base64 transport (v2.0) | At 20K cards with full content: estimated DB size 5-15MB. Base64 inflates ~33%. WKScriptMessageHandler receives this as a string — measure actual transfer time at scale |
| WKWebView warm-up reduces perceived latency | WKWebView initialization is slow on first call. Warm-up by creating a WKWebView early in app lifecycle (before it is shown) reduces perceived cold start | **Low** | AppDelegate / App init, WKWebView lifecycle | WWDC pattern: create WKWebView in `applicationDidFinishLaunching` before it is needed. WebViewWarmUper pattern is established. For Isometry: WKWebView could be created during NavigationSplitView initialization |
| WASM load measured and profiled | 756KB WASM file served via WKURLSchemeHandler. Measure: HTTP handler response time, WASM parse/compile time, sql.js initialization. WKWebView has WASM JIT — measure JIT compilation time | **Low** | WKURLSchemeHandler, WASM serving | In WKWebView, WASM JIT tiers compile asynchronously. The first query after init may be slower than subsequent queries. Measure: time from `wasm-init` send to first `db:query` response |

**What "cold start at 20K cards" means in practice:** The two-phase launch (v2.0) already blocks `WorkerBridge` until `LaunchPayload` arrives. The optimization target is reducing the time from app launch to the user seeing their first data. At 20K cards, the DB hydration step becomes the dominant cost. If base64 transport exceeds 500ms, switching to a binary Blob transfer or native-side gzip should be investigated.

### 5. Memory Pressure Bounds

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Peak WASM heap measured at 20K cards | sql.js loads the entire database into WASM memory. At 20K cards with full content, the WASM heap grows proportionally. Measure: initial WASM heap, peak during large import, stable working set after import | **Medium** | sql.js WASM heap, Chrome DevTools Memory Inspector | sql.js allocates a fixed initial WASM memory (default: depends on config). If the DB exceeds initial heap, it reallocates. Each reallocation can be O(n). Profile with Memory Inspector |
| JS heap stable after repeated view switches | Switching between 9 views should not accumulate detached DOM nodes. D3's `.join()` enter/update/exit pattern prevents accumulation when used correctly. Verify no leaks after 50 view switches | **Medium** | Chrome DevTools Heap Snapshots, D3 data join lifecycle | Common D3 leak: event listeners added in `enter` but not removed on `exit`. Use `.on('click', null)` in exit selection or rely on D3's selection removal. GalleryView (pure HTML, no D3 join) is highest leak risk |
| Native Swift memory stable at 20K cards | WKWebView process memory under iOS/macOS. At 20K cards, WKWebView content process holds both the WASM heap and JS heap. iOS terminates processes exceeding ~120MB (varies by device) | **Medium** | Xcode Instruments (Allocations, Leaks), iOS memory pressure | Profile with Instruments on a real device (not simulator). Check: WKWebView content process size, Swift main process size, total RAM footprint |
| Checkpoint write size measured at 20K cards | The 30s autosave writes the full sql.js DB as base64 to Application Support. At 20K cards, measure checkpoint file size and write time | **Low** | DatabaseManager autosave, atomic write pattern (v2.0) | DatabaseManager already uses atomic .tmp/.bak/.db rotation. Write time at 20K cards may exceed the 30s autosave interval if the DB is very large. Measure to confirm |

**Implementation insight:** WASM memory does not return to the OS when freed — it can only grow, never shrink within a session. This means a 20K-card import leaves the WASM heap permanently larger for that session. The only mitigation is preventing unnecessary large allocations during import. The 100-card batch write pattern already addresses this for INSERTs. Profile with Chrome DevTools Memory Inspector (Wasm tab) to visualize the WASM linear memory.

### 6. Regression Guard: Automated Performance Budgets

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| Vitest bench tests for critical paths | Performance work without regression guards is wasted — the next feature PR will regress everything. Vitest bench is already in the stack (tinybench, Vitest 4.0) | **Medium** | Vitest bench API, CI (GitHub Actions, v4.2) | Write bench tests for: SQL query at 1K/5K/20K cards, D3 join at 1K/5K rows, import throughput at 5K cards, FTS search at 20K cards. Assert p99 < threshold |
| CI performance budget gates | Performance bench tests run in CI and fail the build if thresholds are exceeded. GitHub Actions already has 3 parallel jobs (typecheck + lint + test). Add a 4th job: bench | **Low** | GitHub Actions CI (v4.2), Vitest bench | Add `vitest bench` to CI. Use `--reporter=verbose` for threshold output. Bench results are non-deterministic on shared CI runners — use generous thresholds (2x expected time) to avoid false positives |
| Benchmark comparison across commits | Vitest bench can save results to a JSON file and compare across runs. This surfaces regressions even when individual bench runs have high variance | **Low** | Vitest `--benchmark.compare` option | Store benchmark baseline JSON in repo. CI compares new results against baseline. Flag >20% regression for review (not hard failure — shared CI runners have variance) |

**Implementation insight:** Benchmark tests on shared CI runners (GitHub Actions 2-core runners) have ±30% variance between runs. Threshold assertions should be set at 3-5x the expected time to avoid flaky failures. The primary value is catching catastrophic regressions (10x slowdown), not micro-optimizations. CodSpeed provides more reliable variance control but requires external service integration — not necessary for v6.0 which can use Vitest's built-in comparison mode.

---

## Differentiators

Features that elevate v6.0 beyond "we ran some profiles and fixed some things."

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **Profile-first methodology documented in phases** | Most performance milestones jump straight to optimization. A documented profile-first approach (measure → identify hotspot → fix → verify) produces durable results and a paper trail for future regressions | **Low** | None — process, not code | Write phase plans that separate "profile" phases from "optimize" phases. Prevents premature optimization of non-bottlenecks |
| **Worker query index optimization** | sql.js SQLite runs in-memory, but index coverage still matters for large tables. At 20K cards with WHERE + ORDER BY + GROUP BY chains (SuperGrid), missing indexes cause full table scans. Adding indexes on `folder`, `card_type`, `status`, `created_at` can be 5-50x faster for filtered SuperGrid queries | **Medium** | sql.js, schema.sql | Measure `EXPLAIN QUERY PLAN` output for typical SuperGrid queries at 20K cards. `ANALYZE` after bulk import to update statistics. Add `CREATE INDEX IF NOT EXISTS` for high-cardinality filter fields |
| **WKWebView content process isolation** | Explicitly profiling WKWebView content process separately from the Swift main process reveals the true memory footprint users experience. This is non-obvious (most iOS devs profile total RAM, not per-process) | **Low** | Xcode Instruments, Leaks template | Use Instruments "VM Tracker" instrument scoped to WKWebView content process. Provides accurate picture of what iOS sees when making memory-pressure decisions |
| **Checkpoint size optimization** | The base64 binary transport for DB checkpoints inflates size by 33%. At 20K cards, if the DB exceeds 8MB, base64 checkpoint writes exceed 10MB. Measuring this and documenting the threshold for future gzip optimization is a meaningful deliverable even if gzip is deferred | **Low** | DatabaseManager checkpoint, existing base64 transport | Measure: 1K, 5K, 10K, 20K card DB sizes and corresponding checkpoint file sizes. If >8MB threshold is reached, note as technical debt for binary transport upgrade |
| **Synthetic 20K card seed dataset** | Performance tests require consistent, reproducible 20K-card datasets. A seeded SQL INSERT script (like the existing `meryl-streep-seed.sql`) at 20K scale enables repeatable benchmarks across machines and CI | **Low** | sql.js, SampleDataManager pattern | Generate via script: 20K cards with varied `card_type`, `folder`, `status`, `priority`, `tags` distribution that stresses GROUP BY. Store as SQL seed file in `src/sample/`. Used by bench tests and manual profiling |

---

## Anti-Features

Features that seem useful for a performance milestone but should be explicitly excluded.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Canvas/WebGL rendering for SuperGrid** | Suggested in D3 performance articles as the "go to" for large datasets. But SuperGrid uses CSS Grid for layout (not SVG) — this is an architectural advantage, not a limitation. Switching to Canvas would destroy the CSS Grid spanning model, column resize, sticky headers, and focus ring UX (v5.1). Massive rewrite risk | Data windowing (already shipped) is the correct pattern for CSS Grid at scale. Optimize the window bounds and SQL query speed, not the rendering technology |
| **DuckDB swap for sql.js** | DuckDB-WASM has better analytical query performance, especially for GROUP BY at large scale. But it is listed as "future optimization" in PROJECT.md Out of Scope. The risk: DuckDB has a different SQL dialect, different WASM init pattern, and no FTS5 — a complete ETL and query layer rewrite | Profile sql.js first. Add missing indexes. sql.js with proper indexes handles 20K rows easily for OLTP-style GROUP BY queries. Only revisit DuckDB if sql.js cannot hit targets with optimization |
| **100K+ row virtualization** | PROJECT.md explicitly out-of-scope: "Virtual scrolling for 100K+ rows — grid renders group intersections (max 2,500 cells)." The SuperGrid renders GROUP BY intersections, not raw rows. 20K cards → max ~100 unique values per axis → max 100×25 = 2,500 cells | Optimize the SQL GROUP BY query time and the D3 join for 2,500 cells. The cell count is bounded by axis cardinality, not raw row count. This is already an architectural constraint |
| **Streaming imports / incremental WASM writes** | Streaming XLSX is architecturally impossible (ZIP central directory at EOF — already in Out of Scope). Streaming CSV/JSON is theoretically possible but adds complexity to the Worker handler without addressing the actual bottleneck (FTS rebuild, not INSERT rate) | Keep 100-card batches. If 20K import takes 30s and is unacceptable, increase batch size to 500 cards (measure first) |
| **Multithreaded WASM (SharedArrayBuffer)** | SharedArrayBuffer requires COOP/COEP headers. WKWebView has inconsistent support. sql.js does not use WASM threads. Custom Emscripten threading for sql.js is a 6-month research project | Use Web Workers for query parallelism (already done). The Worker runs sql.js in its own thread already — the architecture is correct. Multiple concurrent db.prepare() calls in a single Worker do not benefit from threads |
| **Per-commit performance alerts via Slack/email** | CodSpeed and similar services provide this. Adds external service dependency, cost, and operational overhead. For a single-developer project (Isometry), in-repo bench comparison is sufficient | Store bench baseline JSON in repo. CI comparison on PR is sufficient. If regressions are caught in PR review, alerts are redundant |
| **Profiler UI within the app** | An in-app performance overlay showing FPS, query times, memory. Sounds useful but adds permanent maintenance overhead (the overlay itself must be performance-neutral) and duplicates Chrome DevTools / Instruments capabilities | Use browser DevTools for web profiling, Xcode Instruments for native. Add `performance.mark()` / `performance.measure()` instrumentation to existing code paths so DevTools shows meaningful labels |

---

## Feature Dependencies

```
Phase A: Baseline Measurement (no prerequisites)
  Synthetic 20K seed dataset [new]
      └──enables──> All benchmark phases

  Vitest bench skeleton [new]
      └──enables──> CI regression guard

Phase B: Render Profiling (depends on Phase A seed data)
  20K card seed dataset [Phase A]
      └──enables──> SuperGrid render profiling
      └──enables──> Worker query time measurement
      └──enables──> D3 join profiling across all views

  Worker SQL index analysis [new]
      └──enables──> Index optimization (Phase C)

Phase C: Render Optimization (depends on Phase B profiles)
  SuperGrid render profiling [Phase B] ──reveals──> virtual scroll window bounds
  Worker query profiles [Phase B] ──reveals──> missing index targets
  Index optimization [new] ──requires──> EXPLAIN QUERY PLAN results from Phase B

Phase D: Import Profiling + Optimization (parallel with Phase B/C)
  Import benchmarks at 20K cards [new]
      └──reveals──> batch size optimization opportunity
      └──reveals──> FTS rebuild time at scale
  FTS rebuild time measurement ──enables──> rebuild optimization if needed

Phase E: Launch Profiling + Optimization (parallel with Phase B-D)
  LaunchPayload size at 20K cards [new] ──reveals──> base64 transport bottleneck
  WKWebView warm-up [new] ──reduces──> perceived cold start

Phase F: Memory Profiling (parallel with Phase B-D)
  WASM heap profiling [new] ──reveals──> peak allocation patterns
  JS heap snapshot diff [new] ──reveals──> D3 data join leaks
  Native Instruments profiling [new] ──reveals──> WKWebView process size

Phase G: Regression Guard (depends on Phase C-F targets established)
  Vitest bench tests with assertions [new]
      └──requires──> targets from Phase C-F profiling
  CI bench job [new]
      └──requires──> bench tests from Phase G
  Baseline JSON committed [new]
      └──enables──> future regression comparison
```

**Critical dependency chain:**
1. **20K seed data is the prerequisite for all profiling** — without consistent test data, benchmarks are meaningless
2. **Profile phases must complete before optimization phases** — the profile-first methodology is load-bearing
3. **Render, import, launch, and memory can be profiled in parallel** — they are independent domains with separate tooling
4. **Regression guard (Phase G) requires targets from all optimization phases** — cannot write threshold assertions until measured values exist

---

## MVP Recommendation

### Ship with v6.0 (core deliverables)

These are the features that make "ship-ready performance at 20K cards" a real claim:

- [ ] Synthetic 20K card seed dataset — enables all benchmarks
- [ ] Vitest bench tests for Worker SQL queries at 1K / 5K / 20K cards — establishes baseline
- [ ] SuperGrid render profiling and window bounds tuning — 60fps at 20K rows
- [ ] SQL index analysis and optimization — EXPLAIN QUERY PLAN for typical SuperGrid queries
- [ ] Import benchmark at 20K cards: total time, peak WASM heap — documents the cost
- [ ] Launch time measurement at 20K cards DB: FMP measured on device — documents the gap
- [ ] WASM heap and JS heap profiling: leak detection, peak measurement — documents memory contract
- [ ] CI bench job with threshold assertions — regression guard
- [ ] Benchmark baseline JSON committed — enables future comparison

### After validation (v6.x)

Features to add if v6.0 reveals specific bottlenecks that cannot be fixed within the milestone:

- [ ] Batch size increase (100 → 250 or 500 cards) if import profiling reveals transaction overhead is dominant
- [ ] WKWebView warm-up if cold start profiling reveals WKWebView init is >500ms bottleneck
- [ ] Base64 → binary transport if checkpoint size exceeds 10MB at 20K cards
- [ ] View-specific "too many cards" guards for non-virtualized views (List, Grid, Gallery) if they are shown to be unusable at 20K

### Future (v7+)

- [ ] DuckDB swap if sql.js cannot hit targets even with indexing (currently not expected)
- [ ] CKSyncEngine performance profiling for 20K-card cloud sync (separate concern from local performance)
- [ ] 100K+ card support (architectural change to SuperGrid's GROUP BY model required first)

---

## Performance Target Definitions

"Ship-ready performance at 20K cards" is defined as:

| Domain | Metric | Target | Measurement Method |
|--------|--------|--------|--------------------|
| **Render** | SuperGrid scroll frame time | <16.7ms p99 (60fps) | Chrome DevTools Performance panel, rAF timing |
| **Render** | Filter change → grid repaint | <200ms p99 (Worker round-trip) | performance.measure() from filter event to D3 update |
| **Render** | Axis reorder → grid repaint | <300ms p99 (includes transition) | performance.measure() from DnD drop to transition end |
| **Import** | 5K card CSV import | <10s total | performance.now() in ImportOrchestrator |
| **Import** | 20K card CSV import | <30s total | performance.now() in ImportOrchestrator |
| **Import** | FTS rebuild time | <500ms at 20K cards | performance.measure() around FTS INSERT trigger rebuild |
| **Launch** | Cold start FMP (20K card DB) | <2s on device | Xcode Instruments Time Profiler, manual stopwatch |
| **Launch** | WASM init → first query response | <500ms | performance.measure() from wasm-init to first db:query response |
| **Memory** | Peak WASM heap during 20K import | <100MB | Chrome DevTools Memory Inspector |
| **Memory** | JS heap after 50 view switches | stable (no growth) | Chrome DevTools Heap Snapshot comparison |
| **Memory** | WKWebView content process | <150MB at 20K cards | Xcode Instruments VM Tracker |

---

## Complexity Assessment by Category

| Category | Feature | Complexity | Infrastructure Dependency | Risk |
|----------|---------|------------|--------------------------|------|
| Measurement | 20K seed dataset | **Low** | SampleDataManager pattern | Low — SQL INSERT script |
| Measurement | Vitest bench skeleton | **Low** | Vitest bench (already in stack) | Low — API is known |
| Measurement | Chrome DevTools profiling | **Trivial** | None — external tooling | Low — process, not code |
| Measurement | Xcode Instruments profiling | **Low** | None — external tooling | Low — requires real device |
| Render | Virtual scroll bounds tuning | **Low** | SuperGridVirtualizer (v4.1) | Low — parameter tuning |
| Render | SQL index optimization | **Medium** | sql.js, schema.sql | Medium — must not break existing queries |
| Render | D3 join leak audit | **Medium** | D3 data join pattern | Medium — requires heap snapshot analysis |
| Render | Non-virtualized view guards | **Low** | ViewManager | Low — conditional rendering |
| Import | Batch size experiment | **Low** | SQLiteWriter (v1.1) | Low — single constant change |
| Import | FTS rebuild optimization | **Low** | FTS trigger pattern (v1.1) | Low — already optimized, measure first |
| Launch | WKWebView warm-up | **Low** | App init lifecycle | Low — established pattern |
| Launch | LaunchPayload size profiling | **Trivial** | DatabaseManager (v2.0) | Trivial — log file size |
| Memory | WASM heap profiling | **Low** | Chrome DevTools, Memory Inspector | Low — tooling only |
| Memory | Checkpoint size measurement | **Trivial** | DatabaseManager (v2.0) | Trivial — stat() the file |
| Regression | CI bench job | **Low** | GitHub Actions CI (v4.2) | Low — add 4th parallel job |
| Regression | Threshold assertions | **Medium** | Vitest bench, profiling results | Medium — thresholds must be calibrated |

**Total estimated new code:** ~500-900 TS (bench tests + instrumentation + index DDL + seed script)
**Total estimated modified code:** ~100-200 TS (SQLiteWriter batch size, ViewManager guards, schema.sql indexes)

**Highest risk:** SQL index optimization. Adding an index to `cards` in schema.sql affects every query path. Use `CREATE INDEX IF NOT EXISTS` to make it safe. Run full test suite (3,158+ tests) after index additions.

**Lowest risk / highest leverage:** 20K seed dataset + Vitest bench skeleton. This unlocks all measurement work and costs ~50-100 lines of code.

---

## Sources

### Vitest Bench / Performance Regression
- [Using Vitest bench to track performance regressions in your CI — CodSpeed](https://codspeed.io/blog/vitest-bench-performance-regressions) — Vitest bench API, CI integration, threshold patterns (MEDIUM confidence)
- [Vitest Features: bench API](https://vitest.dev/guide/features.html) — tinybench integration, p99 metrics (HIGH confidence)
- [Snapshot Benchmarking with Vitest](https://www.thecandidstartup.org/2025/08/25/snapshot-benchmarking.html) — baseline comparison pattern (MEDIUM confidence)

### Chrome DevTools / WASM Profiling
- [Debug C/C++ WebAssembly — Chrome DevTools](https://developer.chrome.com/docs/devtools/wasm) — WASM debugging, performance panel at full speed (HIGH confidence)
- [Memory Inspector: ArrayBuffer, TypedArray, Wasm Memory — Chrome DevTools](https://developer.chrome.com/docs/devtools/memory-inspector) — WASM linear memory inspection (HIGH confidence)

### D3 Render Optimization
- [Optimizing D3 Chart Performance for Large Data Sets — Reintech](https://reintech.io/blog/optimizing-d3-chart-performance-large-data) — data windowing, virtualization, Web Workers for calculations (MEDIUM confidence)
- [Rendering Optimization Techniques for Faster D3.js Graphics — MoldStud](https://moldstud.com/articles/p-top-d3js-rendering-optimization-techniques-for-faster-graphics) — rAF throttling, layout thrash prevention (MEDIUM confidence)

### SwiftUI / WKWebView Launch Optimization
- [WWDC 2025 — Optimize SwiftUI performance with Instruments](https://developer.apple.com/videos/play/wwdc2025/306/) — Instruments 26 for SwiftUI profiling (HIGH confidence, Apple official)
- [SwiftUI App Startup Time Optimization — DEV Community](https://dev.to/sebastienlato/swiftui-app-startup-time-optimization-cold-launch-warm-launch-perceived-speed-47ao) — cold launch pipeline, lazy init pattern (MEDIUM confidence)
- [WKWebView Warm-up — WebViewWarmUper](https://github.com/bernikovich/WebViewWarmUper) — WKWebView pre-init pattern (MEDIUM confidence)
- [App Launch Time: 7 tips — SwiftLee](https://www.avanderlee.com/optimization/launch-time-performance-optimization/) — launch time targets, Apple 400ms recommendation (MEDIUM confidence)

### JavaScript Memory Leak Detection
- [Detached window memory leaks — web.dev](https://web.dev/articles/detached-window-memory-leaks) — heap snapshot analysis, detached node detection (HIGH confidence)
- [How to Debug Memory Leaks in JavaScript — DebugBear](https://www.debugbear.com/blog/debugging-javascript-memory-leaks) — Chrome DevTools heap snapshot workflow (MEDIUM confidence)

### Performance Budgets
- [Performance budgets — MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/Performance/Guides/Performance_budgets) — threshold definition, CI integration pattern (HIGH confidence)

---
*Feature research for: v6.0 Performance — TypeScript/D3/WASM/SwiftUI performance profiling, optimization, and regression testing*
*Researched: 2026-03-11*
