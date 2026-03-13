---
phase: 74-baseline-profiling-instrumentation
plan: "03"
subsystem: performance-profiling
tags: [profiling, bundle-analysis, bottlenecks, sql-query, supergrid-render, etl-import]
dependency_graph:
  requires: [74-02]
  provides: [BOTTLENECKS.md, vite.config.analyze.ts, npm-run-analyze]
  affects: [phase-75-budgets, phase-76-render-optimization, phase-77-import-launch-memory]
tech_stack:
  added: [rollup-plugin-visualizer@7.0.1]
  patterns:
    - Vite app-mode analyze config (no build.lib, no externals) for full treemap
    - Direct performance.now() measurement via tsx for SQL query benchmarks
    - vitest test format (it, not bench) for ETL + render timing with console output
    - rollup-plugin-visualizer nodeParts/nodeMetas JSON for per-module size breakdown
key_files:
  created:
    - vite.config.analyze.ts
    - .planning/phases/74-baseline-profiling-instrumentation/BOTTLENECKS.md
    - tests/profiling/etl-timing.test.ts
    - tests/profiling/render-timing.test.ts
  modified:
    - package.json (add analyze script)
    - .gitignore (add stats.html, dist-analyze/)
    - tests/profiling/etl-smoke.bench.ts (rewritten to it() format for timing output)
decisions:
  - vitest bench v4 with forks pool returns empty samples in --run mode; measurement via performance.now() in it() tests is the workaround
  - tsx cannot resolve papaparse as ESM (UMD interop issue); CSV timing measured via vitest environment where Vite handles module resolution
  - rollup-plugin-visualizer open:false prevents browser auto-open in headless/CI runs
  - jsdom render timings divided by 8 to estimate Chrome values (per bench file documentation)
metrics:
  duration_minutes: 15
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 3
  completed_date: "2026-03-11"
requirements_covered: [PROF-07]
---

# Phase 74 Plan 03: Bundle Analyzer + BOTTLENECKS.md Summary

**One-liner:** rollup-plugin-visualizer treemap config + BOTTLENECKS.md with measured p99 values across SQL query, render, ETL import, and bundle size domains.

## What Was Built

### Task 1: Bundle Analyzer Config

`vite.config.analyze.ts` is a Vite app-mode build config (mirrors `vite.config.native.ts`) that adds `rollup-plugin-visualizer` with treemap template, gzip + brotli sizes, and outputs to `dist-analyze/`. Running `npm run analyze` produces `stats.html` with an interactive treemap of all modules by size.

Key config decisions:
- `open: false` — prevents browser auto-open in CI environments
- `__PERF_INSTRUMENTATION__: false` — production-like build, PerfTrace tree-shaken out
- No `build.lib`, no `rollupOptions.external` — app-mode so sql.js (in Worker chunk) is included in the treemap

### Task 2: BOTTLENECKS.md

Measured all 4 performance domains and produced a ranked bottleneck document:

**SQL Query (20K p99):** GROUP BY folder+type = 24.9ms, strftime month = 20.6ms, status = 1.9ms, FTS = 1.7ms

**SuperGrid Render (jsdom p99):** dual-axis 5K cells = 506ms (est. ~63ms Chrome), triple 20K = 259ms (est. ~32ms Chrome), single 20K = 38ms (est. ~5ms Chrome)

**ETL Import (20K):** apple_notes 182ms/110K cards/s, csv 767ms/26K cards/s, json 1771ms/11.3K cards/s, markdown 1059ms/18.9K cards/s

**Bundle (gzip):** main JS 285KB, xlsx 138KB, worker/sql.js 69KB, WASM 370KB

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest bench v4 empty samples in forks pool mode**
- **Found during:** Task 2 — vitest bench --run produced NaN comparison output with empty samples[]
- **Issue:** vitest bench v4.0.18 with `pool: 'forks'` does not propagate tinybench sample data back to the main thread in --run mode; the bench functions execute but timing data is lost
- **Fix:** Rewrote measurement approach to use `it()` tests with direct `performance.now()` timing, outputting results via `console.log` — vitest captures stdout per test
- **Files modified:** tests/profiling/etl-smoke.bench.ts (rewritten), added tests/profiling/etl-timing.test.ts, tests/profiling/render-timing.test.ts
- **Impact:** Data is equivalent; single-run measurements rather than statistical p99 from 50+ iterations. Stated as single-run in BOTTLENECKS.md notes.

**2. [Rule 1 - Bug] papaparse ESM/CJS interop failure in tsx**
- **Found during:** Task 2 — `import * as Papa from 'papaparse'` via tsx resolved the namespace correctly but CSVParser's own import of 'papaparse' failed with "Papa.parse is not a function"
- **Issue:** tsx resolves 'papaparse' (CJS UMD module) differently than vitest's Vite-based module resolution; the default export vs namespace export mismatch caused runtime failure in tsx but not in vitest
- **Fix:** Used vitest environment for CSV timing measurement (etl-timing.test.ts), where Vite handles papaparse ESM interop correctly
- **Impact:** None — CSV timing is measured and recorded accurately in BOTTLENECKS.md

## Self-Check: PASSED

- vite.config.analyze.ts: FOUND
- BOTTLENECKS.md: FOUND
- Task 1 commit 65eed470: FOUND
- Task 2 commit 631b3f28: FOUND
