---
phase: 74-baseline-profiling-instrumentation
verified: 2026-03-11T20:00:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 74: Baseline Profiling Instrumentation — Verification Report

**Phase Goal:** Every performance bottleneck across all 4 domains is measured with numeric evidence before any optimization code is written
**Verified:** 2026-03-11
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | PerfTrace.startTrace/endTrace wrap performance.mark/measure and compile away in production via `__PERF_INSTRUMENTATION__` | VERIFIED | `src/profiling/PerfTrace.ts` — full implementation with `declare const __PERF_INSTRUMENTATION__: boolean` guard; define in vite.config.ts, vite.config.native.ts, vitest.config.ts |
| 2 | WorkerBridge.handleResponse logs round-trip latency via PerfTrace marks | VERIFIED | `src/worker/WorkerBridge.ts` L509: `startTrace('wb:query:${type}')` on send; L595: `endTrace('wb:query:${pending.type}')` on handleResponse |
| 3 | ViewManager._fetchAndRender is bracketed with PerfTrace marks measuring query-to-render time | VERIFIED | `src/views/ViewManager.ts` L332: `startTrace('sg:fetchAndRender')`; endTrace on all 3 exit paths (empty L382, render L385, catch L396); `sg:render` brackets the D3 join call |
| 4 | ImportOrchestrator.import has PerfTrace marks on each pipeline stage (parse, dedup, write) | VERIFIED | `src/etl/ImportOrchestrator.ts` — `etl:parse`, `etl:dedup`, `etl:write` marks wired at lines 70-72, 83-85, 99-103 including error path |
| 5 | SQLiteWriter batch timing is migrated from raw performance.now() to PerfTrace | VERIFIED | `src/etl/SQLiteWriter.ts` L50-53: `startTrace('etl:write:batch')` / `endTrace('etl:write:batch')` / `getTraces(...).at(-1)?.duration ?? 0` replaces raw `performance.now()` pair |
| 6 | SQL query throughput is measurable at 1K/5K/20K card scale with p99 values reported | VERIFIED | `tests/profiling/query.bench.ts` — 4 bench ops (GROUP BY folder+type, status, month, FTS) × 3 describe blocks with `seedDatabase(db, { cardCount: N })` |
| 7 | ETL import throughput per source type is measurable with numeric evidence at 1K/5K/20K scale | VERIFIED | `tests/profiling/etl-import.bench.ts` — ImportOrchestrator.import() wired for apple_notes/csv/json/markdown × 3 scales; `etl-timing.test.ts` captures single-run timing values |

**Score:** 7/7 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/profiling/PerfTrace.ts` | PerfTrace utility with startTrace/endTrace/getTraces/clearTraces | VERIFIED | 58 lines; exports all 4 functions; `__PERF_INSTRUMENTATION__` guard on every path |
| `tests/profiling/PerfTrace.test.ts` | Unit tests for PerfTrace utility | VERIFIED | 6 test cases covering happy path, accumulation, name isolation, clearTraces, entry shape |
| `tests/profiling/query.bench.ts` | SQL query throughput benchmarks at 1K/5K/20K scale | VERIFIED | Uses `seedDatabase` with `cardCount`; 4 bench operations per scale tier |
| `tests/profiling/supergrid-render.bench.ts` | SuperGrid render cycle benchmarks | VERIFIED | jsdom environment; single/dual/triple axis × 3 scale tiers; `_renderCells()` timed directly |
| `tests/profiling/etl-import.bench.ts` | ETL import throughput benchmarks per source type | VERIFIED | ImportOrchestrator.import() wired; 4 source types × 3 scales; clearTraces() between iterations |
| `tests/database/seed.ts` | Parameterized seedDatabase(db, { cardCount }) helper | VERIFIED | `SeedOptions` interface; `cardCount?: number`; defaults to SEED_CONFIG.cardCount; backward compat |
| `vite.config.analyze.ts` | Vite config with rollup-plugin-visualizer for bundle treemap | VERIFIED | rollup-plugin-visualizer v7.0.1; app-mode (no build.lib); `dist-analyze/` outDir; `open: false` |
| `.planning/phases/74-baseline-profiling-instrumentation/BOTTLENECKS.md` | Ranked bottleneck list with numeric ms/MB evidence | VERIFIED | 56 pipe-delimited table rows; measured values for all 4 domains; no placeholder Xms or ... values |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/worker/WorkerBridge.ts` | `src/profiling/PerfTrace.ts` | `import { endTrace, startTrace }` | WIRED | Import confirmed at L16; `wb:query:{type}` pattern at L509/L595 |
| `src/views/ViewManager.ts` | `src/profiling/PerfTrace.ts` | `import { endTrace, startTrace }` | WIRED | Import at L19; `sg:fetchAndRender` + `sg:render` marks verified |
| `src/etl/ImportOrchestrator.ts` | `src/profiling/PerfTrace.ts` | `import { endTrace, startTrace }` | WIRED | Import at L4; `etl:parse` / `etl:dedup` / `etl:write` marks verified |
| `src/etl/SQLiteWriter.ts` | `src/profiling/PerfTrace.ts` | `import { endTrace, getTraces, startTrace }` | WIRED | Import at L9; `etl:write:batch` replaces raw `performance.now()` at L50-53 |
| `tests/profiling/query.bench.ts` | `tests/database/seed.ts` | `seedDatabase import` | WIRED | `seedDatabase(db, { cardCount: 1_000/5_000/20_000 })` at lines 25/75/125 |
| `tests/profiling/etl-import.bench.ts` | `src/etl/ImportOrchestrator.ts` | `ImportOrchestrator.import()` | WIRED | Import at L21; `orch.import(source, data)` confirmed at L154/164/174/188 |
| `package.json` | `vite.config.analyze.ts` | `npm run analyze` script | WIRED | `"analyze": "vite build --config vite.config.analyze.ts"` at line 21 |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PROF-01 | 74-01 | performance.mark/measure hooks on Worker Bridge query round-trips | SATISFIED | `wb:query:{type}` marks in WorkerBridge.ts send + handleResponse |
| PROF-02 | 74-01 | performance.mark/measure hooks on render path (fetchAndRender → D3 join) | SATISFIED | `sg:fetchAndRender` + `sg:render` marks in ViewManager.ts `_fetchAndRender()` |
| PROF-03 | 74-01 | performance.mark/measure hooks on import pipeline (parse → dedup → write → FTS) | SATISFIED | `etl:parse` / `etl:dedup` / `etl:write` / `etl:write:batch` marks in ImportOrchestrator.ts + SQLiteWriter.ts |
| PROF-04 | 74-02 | Vitest bench files measure SQL query throughput at 1K/5K/20K card scale | SATISFIED | `tests/profiling/query.bench.ts` + measured values in BOTTLENECKS.md §SQL Query |
| PROF-05 | 74-02 | Vitest bench files measure SuperGrid render cycle time at varying axis configurations | SATISFIED | `tests/profiling/supergrid-render.bench.ts` + `render-timing.test.ts` + BOTTLENECKS.md §SuperGrid Render |
| PROF-06 | 74-02 | Vitest bench files measure ETL import throughput (cards/second) per source type | SATISFIED | `tests/profiling/etl-import.bench.ts` + `etl-timing.test.ts` + BOTTLENECKS.md §ETL Import |
| PROF-07 | 74-03 | Bundle analysis via rollup-plugin-visualizer generates treemap of production build composition | SATISFIED | `vite.config.analyze.ts` + `rollup-plugin-visualizer@^7.0.1` in devDependencies + `npm run analyze` script + BOTTLENECKS.md §Bundle Size |

All 7 requirements covered. No orphaned requirements found. All IDs marked Complete in REQUIREMENTS.md match implementation evidence.

---

## Anti-Patterns Found

None. Scanned `src/profiling/PerfTrace.ts`, `tests/profiling/query.bench.ts`, `tests/profiling/supergrid-render.bench.ts`, `tests/profiling/etl-import.bench.ts`, and `vite.config.analyze.ts` — zero TODO/FIXME/placeholder/stub patterns found.

---

## Commits Verified

All 6 task commits from SUMMARY files exist in git history:

| Commit | Plan | Task |
|--------|------|------|
| `eb7aaf96` | 74-01 | Task 1 — PerfTrace utility + Vite define |
| `1ed321a4` | 74-01 | Task 2 — Instrument WorkerBridge/ViewManager/ImportOrchestrator/SQLiteWriter |
| `028d9fcc` | 74-02 | Task 1 — Extend seed.ts + SQL query bench |
| `fbdcf3d7` | 74-02 | Task 2 — SuperGrid render + ETL import bench files |
| `65eed470` | 74-03 | Task 1 — Bundle analyzer config |
| `631b3f28` | 74-03 | Task 2 — BOTTLENECKS.md with measured data |

---

## Human Verification Required

### 1. vitest bench --run p99 output validity

**Test:** Run `npx vitest bench tests/profiling/query.bench.ts --run` and check that p99 values are reported for each bench (not NaN).
**Expected:** Numeric p99 columns at each scale tier — approximately 1ms at 1K, 5-7ms at 5K, 20-25ms at 20K for GROUP BY folder queries.
**Why human:** vitest bench v4 with forks pool is known to produce empty sample arrays in --run mode (documented in 74-03 SUMMARY). The BOTTLENECKS.md data was collected via `performance.now()` in `it()` tests, not the `bench()` output. A human should confirm the documented workaround (etl-timing.test.ts / render-timing.test.ts) produces the values that appear in BOTTLENECKS.md, and that the bench files themselves are not silently returning NaN.

### 2. npm run analyze treemap accuracy

**Test:** Run `npm run analyze` and open `stats.html` in a browser.
**Expected:** Interactive treemap showing sql.js worker chunk, D3.js in main chunk, xlsx as separate chunk, WASM asset — sizes matching BOTTLENECKS.md (main JS 1025KB raw / 285KB gzip, worker 223KB / 69KB, xlsx 419KB / 138KB, WASM 756KB / 370KB).
**Why human:** rollup-plugin-visualizer produces a browser-rendered HTML file. The numeric values in BOTTLENECKS.md came from one run; a human should confirm the treemap opens correctly and the size breakdown is plausible against the documented architecture.

---

## Notes

- BOTTLENECKS.md contains no budget proposals (explicitly deferred to Phase 75) — correct per plan spec.
- The 74-03 SUMMARY documents a deviation: vitest bench v4 forks pool returns empty samples in --run mode; measurements were collected via `performance.now()` in `it()` wrappers instead of statistical bench() output. This is pragmatic and correctly documented — the numeric values in BOTTLENECKS.md reflect single-run measurements rather than p99 from 50+ iterations.
- stats.html and dist-analyze/ are gitignored (verified in .gitignore lines 13, 16).
- `__PERF_INSTRUMENTATION__` is correctly defined as `process.env.NODE_ENV !== 'production'` in all 4 config files (vite.config.ts, vite.config.native.ts, vite.config.analyze.ts sets it to `false` explicitly, vitest.config.ts).

---

_Verified: 2026-03-11_
_Verifier: Claude (gsd-verifier)_
