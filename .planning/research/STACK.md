# Stack Research

**Domain:** Performance profiling, benchmarking, and regression testing for a local-first TypeScript/D3/sql.js/WKWebView app
**Researched:** 2026-03-11
**Confidence:** HIGH (core tooling), MEDIUM (WASM-specific profiling details)

---

## Context: What Already Exists (Do Not Re-Research)

The v6.0 milestone adds performance tooling on top of a locked stack. These are the existing validated capabilities that the new tooling must integrate with:

| Technology | Version | Role |
|------------|---------|------|
| TypeScript | 5.9 strict | All TS/JS source |
| sql.js (FTS5 WASM) | 1.14 | In-memory SQLite database |
| D3.js | v7.9 | Data joins + rendering |
| Vite | 7.3 | Dev server + build |
| Vitest | 4.0 | Test runner (3,158+ tests) |
| Biome | 2.4.6 | Lint + format |
| GitHub Actions | — | CI: 3 parallel jobs (typecheck, lint, test) |
| Swift / SwiftUI | iOS 17+ / macOS 14+ | Native shell |
| WKWebView + WKURLSchemeHandler | — | JS runtime host |

**v6.0 goal:** Profile-first methodology — instrument all 4 performance domains (render, import, launch, memory) before fixing, then lock in budgets with automated regression guards.

---

## Recommended Stack

### Core Technologies (New for v6.0)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Vitest bench mode (built-in) | 4.0 (existing) | Algorithmic benchmarks for sql.js queries, ETL pipeline, D3 data joins | Already installed, zero config overhead. `bench()` uses tinybench under the hood. `--compare` flag enables branch-to-branch regression detection. No new dependency. |
| `performance.mark` / `performance.measure` (built-in Web API) | Browser API | Instrument Worker Bridge round-trips, WASM init timing, rAF callback timing | Zero-dependency, works inside Web Workers (where sql.js runs). Available in both WKWebView and Vitest's jsdom environment. W3C CR Feb 2025 added cross-timestamp support. |
| `rollup-plugin-visualizer` | ^7.0.1 | Interactive bundle treemap — identify which modules contribute to initial load | Vite is Rollup-based; this plugin hooks directly into Vite's `plugins[]` array. No separate build step. Reports GZIP and Brotli sizes. Treemap, sunburst, flamegraph views. Requires Node >=22 (already met). |

### Supporting Libraries (New for v6.0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `tinybench` | ^2.9 (transitive via Vitest 4.0) | Benchmark task execution engine | Already present as Vitest's internal bench engine. Access options (`time`, `iterations`, `warmupIterations`) via third arg to `bench()`. Do not install directly — use via Vitest. |

### Development Tools (Configuration Changes Only)

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest `benchmark.outputJson` | Save bench results to JSON for `--compare` on next run | Set `benchmark.outputJson: '.benchmarks/main.json'` in `vitest.config.ts`. Use `vitest bench --compare .benchmarks/main.json` in CI to detect regressions. |
| Chrome DevTools Performance panel | Manual WASM + D3 profiling during development | Chrome 134+ overhauled Performance panel. WASM frames appear with source-level attribution when DWARF debug info is available (not available for sql.js's prebuilt WASM, but function boundaries are visible). |
| Xcode Instruments — Time Profiler | Native shell performance: WKWebView launch time, Swift actor overhead | WWDC 2025 added Processor Trace for hardware-assisted profiling on Apple silicon. Run against the Isometry.xcodeproj scheme. Focus on `DatabaseManager` actor and `BridgeManager`. |
| Xcode Instruments — Allocations | Memory growth in Swift layer: WKWebView process, CloudKit sync objects | Particularly useful for verifying 200-card chunked bridge dispatch doesn't cause memory spikes in the native process. |
| Node.js `--cpu-prof` + `--heap-prof` via Vitest `execArgv` | Identify slow transforms in Vitest test runs and bench mode | Configure in `vitest.config.ts` `test.execArgv`. Produces `.cpuprofile` / `.heapprofile` files. Analyze in Chrome DevTools Memory panel or VS Code Performance panel. |

---

## Installation

```bash
# Bundle analysis (dev-only)
npm install -D rollup-plugin-visualizer

# No other new runtime or test dependencies required.
# Vitest bench mode, performance.mark/measure, and Xcode Instruments
# are all zero-install additions.
```

## Configuration Additions

### vitest.config.ts — Bench Mode

```typescript
// vitest.config.ts additions for v6.0
export default defineConfig({
  test: {
    // existing test config unchanged
  },
  benchmark: {
    include: ['**/*.bench.ts'],
    outputJson: '.benchmarks/main.json',  // stored for --compare
    reporters: ['default'],
  },
})
```

**Bench file naming convention:** `*.bench.ts` (separate from `*.test.ts`). Vitest bench mode throws on `test()`/`it()` — keep bench files isolated.

### vite.config.ts — Bundle Visualizer

```typescript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      filename: '.bundle-report/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
      open: false,  // don't auto-open in CI
    }),
  ],
})
```

Run manually: `vite build` then open `.bundle-report/stats.html`.

### GitHub Actions — Bench Regression Job

Add a 4th CI job (runs after test job, not blocking merge by default until budgets are calibrated):

```yaml
bench:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm ci
    - run: npx vitest bench --run --reporter=json --outputJson=.benchmarks/ci.json
    - name: Compare against main baseline
      run: npx vitest bench --compare .benchmarks/main.json --run
      continue-on-error: true  # non-blocking until thresholds validated
```

**Baseline update workflow:** When intentional optimization ships, regenerate main.json on the main branch and commit to `.benchmarks/`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Vitest built-in bench mode | Benchmark.js standalone | Never — Vitest 4.0 bench mode is already present and integrates with existing test infrastructure. Benchmark.js would require a separate runner. |
| `rollup-plugin-visualizer` | `vite-bundle-analyzer` (vite-bundle-analyzer npm) | Either works. `rollup-plugin-visualizer` has higher adoption and is more mature. `vite-bundle-analyzer` is a newer alternative with Rolldown support (experimental). Use `rollup-plugin-visualizer` unless Rolldown migration happens. |
| `performance.mark/measure` (built-in) | `web-vitals` library (Google) | `web-vitals` is for Core Web Vitals (LCP, INP, CLS) in public-facing web apps. Isometry is a local native app inside WKWebView — Core Web Vitals don't apply. Use `performance.mark` directly for custom instrumentation points. |
| Chrome DevTools + Xcode Instruments (manual) | Automated Lighthouse CI / WebPageTest | These tools are for public websites. Isometry has no URL to fetch externally. Manual DevTools + Instruments is the correct approach for a WKWebView app. |
| Node `--cpu-prof` via `execArgv` | `clinic.js` / `0x` | clinic.js and 0x work well for Node HTTP servers. Vitest's `execArgv` mechanism is simpler for test-suite profiling and produces standard `.cpuprofile` files compatible with Chrome DevTools. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@vitest/coverage-v8` for performance correlation | Coverage instrumentation distorts timing measurements — adds 2-5x overhead to instrumented code paths | Run bench mode in a separate `vitest bench` pass without coverage enabled |
| CodSpeed (paid CI service) | External dependency for a local-first app; adds cost and CI complexity for marginal gain over `--compare` | Vitest's built-in `benchmark.outputJson` + `--compare` provides sufficient branch-to-branch regression detection |
| `jest-bench` / `benny` | Incompatible with Vitest test runner; would require separate toolchain | Vitest bench mode |
| `perf_hooks` (Node.js) for browser-side measurements | `perf_hooks` is Node.js only; sql.js and D3 run in the browser (WKWebView). `performance.mark` works in both browser and Worker contexts | `performance.mark` / `performance.measure` (W3C User Timing API) |
| DuckDB-WASM as sql.js replacement | Listed explicitly as out-of-scope ("DuckDB swap — future optimization") in PROJECT.md | sql.js 1.14 with query optimization and EXPLAIN QUERY PLAN analysis |
| `autocannon` / `k6` / Artillery load testing | These are HTTP load testing tools for servers. Isometry is local-first with no HTTP server to load-test | sql.js query profiling via `EXPLAIN QUERY PLAN` and bench mode |
| HyperFormula bundle analysis | Already permanently replaced by SQL DSL (D-011). No formula engine in scope | Confirm it was never bundled via `rollup-plugin-visualizer` treemap |

---

## Stack Patterns by Domain

**Render performance (D3 + DOM at 20K cards):**
- Use `performance.mark('sg:query:start')` / `performance.mark('sg:query:end')` around Worker Bridge round-trips in `SuperGridQuery.ts`
- Use `performance.mark('sg:render:start')` / `performance.mark('sg:render:end')` around D3 `.join()` calls in `SuperGrid.ts`
- SuperGridVirtualizer already does data windowing — benchmarks should measure window recalculation at 20K rows, not full DOM join

**Import performance (ETL pipeline):**
- Bench mode is ideal: `bench('csv-parse-5k', () => parseCSV(fixture5k))` in `*.bench.ts` files
- Measure `SQLiteWriter.writeCards()` batch time at 100-card, 1K-card, 5K-card, 20K-card inputs
- Instrument `DedupEngine` Map lookup at scale (currently O(n) per-card)

**Launch performance (WASM init + DB hydration):**
- `performance.mark('wasm:init:start')` in Worker `wasm-init` handler before WASM load
- `performance.mark('wasm:init:end')` after `initSqlJs()` resolves
- Measure base64 decode + `db.open(data)` separately — base64 decode is CPU-bound JS, db.open is WASM
- In Swift: Instruments Time Profiler on `waitForLaunchPayload` and `NativeBridge.sendLaunchPayload()`

**Memory pressure (bounded growth at 20K cards):**
- Chrome DevTools Memory panel: heap snapshot before/after loading 20K cards, then after running 10 different queries
- Vitest `execArgv: ['--heap-prof']` to catch test-suite memory leaks in Worker bridge mock
- Key risk: D3 selection objects accumulating if `.join()` exit callbacks don't remove event listeners — verify `SuperGrid._cleanup()`

---

## WASM Profiling Specifics

sql.js's prebuilt WASM is compiled without DWARF debug symbols, so Chrome DevTools will show WASM function boundaries but not source-level attribution. This is acceptable for v6.0's goals:

1. **Identify hot queries:** `EXPLAIN QUERY PLAN` in the Worker for all SuperGrid, calc, histogram, and chart queries. Any `SCAN TABLE` without index is a candidate for optimization.
2. **Measure JS↔WASM boundary cost:** `performance.mark` around `db.exec()` / `db.prepare()` / `stmt.step()` calls. If data marshalling exceeds 15-20% of total query time, consider batching or reducing round-trips.
3. **Memory growth:** sql.js WASM heap is a flat `ArrayBuffer`. Monitor `db.getRowsModified()` accumulation and verify `stmt.free()` is called after every prepared statement to prevent WASM heap leaks.

**Confidence: MEDIUM** — sql.js WASM memory profiling relies on Chrome DevTools Memory panel + manual `performance.mark` instrumentation. There is no dedicated sql.js profiling library. The existing codebase already uses `db.prepare()` for all parameterized SQL (D-011 fix from v5.2), which is the correct path for preventing WASM heap fragmentation.

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `rollup-plugin-visualizer@^7.0.1` | Vite 7.3, Rollup (Vite's internal bundler) | Requires Node >=22. Plugin hooks into Vite's `plugins[]`. Do not use in `test` config — build-only. |
| Vitest bench mode | Vitest 4.0 | bench mode marked "experimental" in docs but stable enough for CI use. `benchmark.outputFile` is deprecated; use `benchmark.outputJson`. |
| `performance.mark/measure` | All modern browsers, WKWebView (iOS 17+), Web Workers, Node.js 16+ | Available everywhere the app runs. W3C Candidate Recommendation Draft Feb 2025 updated spec. |

---

## Sources

- [Vitest benchmark config docs](https://vitest.dev/config/benchmark) — `outputJson`, `compare`, `reporters` options; `outputFile` deprecation confirmed
- [Vitest bench features](https://vitest.dev/guide/features) — bench mode overview, `vitest bench` command
- [Vitest profiling test performance](https://vitest.dev/guide/profiling-test-performance) — `execArgv` heap/CPU profiling configuration
- [rollup-plugin-visualizer npm](https://www.npmjs.com/package/rollup-plugin-visualizer) — v7.0.1 current version, Node >=22 requirement
- [MDN Performance.mark()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/mark) — Web Worker support confirmed
- [MDN Performance.measure()](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measure) — User Timing API
- [W3C User Timing CR Draft Feb 2025](https://www.w3.org/TR/user-timing/) — Cross-timestamp marks, metadata support
- [Chrome DevTools Performance reference](https://developer.chrome.com/docs/devtools/performance/reference) — WASM profiling, Chrome 134+ panel overhaul
- [Apple WWDC 2025 Instruments session](https://developer.apple.com/videos/play/wwdc2025/308/) — Processor Trace, CPU Counters, Apple silicon profiling
- [CodSpeed vitest bench CI guide](https://codspeed.io/blog/vitest-bench-performance-regressions) — `--compare` workflow, CI regression detection patterns
- [sql.js GitHub README](https://github.com/sql-js/sql.js/) — WASM heap model, stmt.free() requirements

---

*Stack research for: v6.0 Performance — profiling, benchmarking, and regression testing*
*Researched: 2026-03-11*
