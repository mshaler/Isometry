# Phase 74: Baseline Profiling + Instrumentation - Research

**Researched:** 2026-03-11
**Domain:** Performance instrumentation, Vitest bench, rollup-plugin-visualizer
**Confidence:** HIGH

## Summary

Phase 74 is an observe-and-measure phase: zero optimization code, purely instrumentation hooks and bench files that produce numeric evidence. Four domains are instrumented — WorkerBridge round-trip latency, SuperGrid render cycle, ETL import pipeline, and production bundle composition. The output is a ranked BOTTLENECKS.md document with ms/MB tables at 1K/5K/20K card scale that gates Phases 76 and 77.

The project already has two working bench files (`tests/database/performance.bench.ts`, `tests/views/SuperGrid.bench.ts`) and an existing data-generation pattern in `tests/database/seed.ts`. Vitest 4.0.18 with tinybench 2.9.0 is installed; `bench()` exposes p75/p99/p995/p999 on each `TaskResult`. rollup-plugin-visualizer 7.0.1 (latest) is not yet installed and needs to be added as a dev dependency.

The instrumentation design is locked: a `PerfTrace` utility module wrapping `performance.mark()`/`performance.measure()` behind a `__PERF_INSTRUMENTATION__` Vite define constant that tree-shakes to zero in production. The `SQLiteWriter.ts` `performance.now()` batch timing (lines 49-51) is migrated into PerfTrace. All other work flows from the four measurement domains.

**Primary recommendation:** Build PerfTrace first (Wave A), then instrument each domain as an independent Wave (B=WorkerBridge, C=SuperGrid, D=ETL), add bench files alongside instrumentation, add rollup-plugin-visualizer last (Wave E), and run real-data profiling to populate BOTTLENECKS.md (Wave F).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Instrumentation hooks
- Debug-only instrumentation — stripped from production builds via Vite define constant
- `__PERF_INSTRUMENTATION__` boolean define — tree-shaken in prod, zero runtime cost
- Thin PerfTrace wrapper utility (startTrace/endTrace) over performance.mark()/measure() with consistent naming conventions
- Single abstraction point for all instrumentation — easy to swap implementation later
- Migrate existing SQLiteWriter performance.now() batch timing to PerfTrace for unified instrumentation

#### Test dataset strategy
- Use real-world Apple Notes dataset (user's full native import, estimated 5K–20K cards)
- For scale tiers the real dataset doesn't cover, duplicate/clone existing cards with modified IDs to reach 20K
- Two loading strategies per domain:
  - Import-from-scratch for ETL profiling (measures full parse/dedup/write/FTS pipeline)
  - Pre-loaded SQLite snapshot for render/query profiling (isolates measurement from import overhead)

#### Bottleneck document
- Markdown report: BOTTLENECKS.md in the phase directory (.planning/phases/74-baseline-profiling-instrumentation/)
- Ranked by user-perceived severity: frequency x latency x user-facing impact (not raw ms)
- Measurements only — no proposed budgets (Phase 75 defines budgets from this data)
- Tables of ms/MB values per domain (render, query, import, bundle) at each scale tier
- This document gates Phase 76 and 77 optimization work

#### Bundle analysis setup
- rollup-plugin-visualizer with treemap HTML output
- Dedicated `npm run analyze` script — not on every build (keeps dev builds fast)
- stats.html gitignored — regenerated on demand; key numbers captured in BOTTLENECKS.md
- Both raw and gzip sizes reported (gzipSize: true)

### Claude's Discretion
- PerfTrace naming convention (e.g. `wb:query`, `sg:render`, `etl:parse`)
- Exact instrumentation sites within each domain
- SQLite snapshot creation mechanism for isolated render/query profiling
- Card duplication strategy for reaching 20K scale tier

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | performance.mark/measure hooks instrument Worker Bridge query round-trips (sent → response latency) | Instrumentation site: `WorkerBridge.send()` — mark at postMessage, measure in `handleResponse()` using `pending.sentAt`. Pattern: `performance.mark('wb:query:start:${id}')` / `performance.measure('wb:query:${type}', ...)`. |
| PROF-02 | performance.mark/measure hooks instrument render path (fetchAndRender → D3 join → paint) | Instrumentation site: `ViewManager._fetchAndRender()` entry + `currentView.render()` exit. SuperGrid's `_renderCells()` is the D3 join point. |
| PROF-03 | performance.mark/measure hooks instrument import pipeline (parse → dedup → write → FTS rebuild) | Instrumentation site: `ImportOrchestrator.import()` — wrap each of the 4 pipeline steps (parse, dedup, writeCards, rebuildFTS) with PerfTrace markers. |
| PROF-04 | Vitest bench files measure SQL query throughput at 1K/5K/20K card scale | New bench file: `tests/profiling/query.bench.ts`. Pattern mirrors `tests/database/performance.bench.ts` (Database setup, seed.ts helpers). Scale tiers need dedicated seed helpers at 1K/5K/20K. |
| PROF-05 | Vitest bench files measure SuperGrid render cycle time at varying axis configurations | New bench file: `tests/profiling/supergrid-render.bench.ts`. Pattern mirrors `tests/views/SuperGrid.bench.ts` (jsdom, mock bridge/provider, `_renderCells()` direct call). |
| PROF-06 | Vitest bench files measure ETL import throughput (cards/second) per source type | New bench file: `tests/profiling/etl-import.bench.ts`. Benchmarks `ImportOrchestrator.import()` per source type (apple_notes, markdown, csv, json) with synthetic data at 1K/5K/20K rows. |
| PROF-07 | Bundle analysis via rollup-plugin-visualizer generates treemap of production build composition | `rollup-plugin-visualizer` 7.0.1 added to devDependencies, `vite.config.analyze.ts` config, `npm run analyze` script. `.gitignore` entry for `stats.html`. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `performance.mark()` / `performance.measure()` | Web API (built-in) | High-resolution named timing marks | Standard Web Performance API; available in both Worker and main thread; DevTools integrates natively |
| `vitest bench()` / `tinybench` | vitest 4.0.18 / tinybench 2.9.0 | Statistical benchmark harness | Already installed; project has two working bench files; exposes p75/p99/p995/p999 on TaskResult |
| `rollup-plugin-visualizer` | 7.0.1 | Bundle treemap + gzip size analysis | De facto standard for Vite/Rollup bundle analysis; 7.0.1 is latest as of 2026-03-11 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vite `define` constant | (Vite 7.3.1, built-in) | `__PERF_INSTRUMENTATION__` tree-shaking | Wraps all PerfTrace call sites so production builds pay zero cost |
| `performance.now()` (existing in SQLiteWriter) | Web API | Per-batch timing — migrated to PerfTrace | Only used during migration; replaced by PerfTrace |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `performance.mark/measure` | Custom `Date.now()` timestamps | mark/measure integrates with DevTools Performance panel and the PerformanceObserver API; Date.now() is 1ms granularity vs sub-ms for mark |
| `rollup-plugin-visualizer` | `vite-bundle-visualizer` or `webpack-bundle-analyzer` | rollup-plugin-visualizer is the direct Rollup/Vite equivalent; others target webpack |

**Installation:**
```bash
npm install -D rollup-plugin-visualizer
```

## Architecture Patterns

### Recommended Project Structure
```
src/
└── profiling/
    └── PerfTrace.ts       # PerfTrace utility (startTrace/endTrace, __PERF_INSTRUMENTATION__ guard)

tests/
└── profiling/
    ├── query.bench.ts          # PROF-04: SQL query throughput at 1K/5K/20K
    ├── supergrid-render.bench.ts  # PROF-05: SuperGrid render cycle
    └── etl-import.bench.ts    # PROF-06: ETL import throughput per source type

vite.config.analyze.ts         # Separate analyze config (rollup-plugin-visualizer)

.planning/phases/74-baseline-profiling-instrumentation/
└── BOTTLENECKS.md             # Phase output: ranked bottleneck list with numeric evidence
```

### Pattern 1: PerfTrace Utility with `__PERF_INSTRUMENTATION__` Guard
**What:** Thin wrapper over `performance.mark()`/`performance.measure()` that compiles away in production builds via a Vite `define` constant.
**When to use:** Every instrumentation call site — never call `performance.mark()` directly from production code.

```typescript
// src/profiling/PerfTrace.ts
declare const __PERF_INSTRUMENTATION__: boolean;

export function startTrace(name: string): void {
  if (__PERF_INSTRUMENTATION__) {
    performance.mark(`${name}:start`);
  }
}

export function endTrace(name: string): void {
  if (__PERF_INSTRUMENTATION__) {
    performance.mark(`${name}:end`);
    performance.measure(name, `${name}:start`, `${name}:end`);
  }
}

export function getTraces(name: string): PerformanceEntry[] {
  if (__PERF_INSTRUMENTATION__) {
    return performance.getEntriesByName(name, 'measure');
  }
  return [];
}
```

**Vite define config** (add to `vite.config.native.ts` and `vite.config.ts`):
```typescript
// In defineConfig:
define: {
  __PERF_INSTRUMENTATION__: process.env.NODE_ENV !== 'production',
}
```

**TypeScript global declaration** (add to `src/vite-env.d.ts` or `src/globals.d.ts`):
```typescript
declare const __PERF_INSTRUMENTATION__: boolean;
```

### Pattern 2: Naming Convention for PerfTrace marks
**What:** Hierarchical colon-separated naming: `domain:operation[:id]`

| Domain | Trace name examples |
|--------|---------------------|
| WorkerBridge | `wb:query:${type}` (per message type), `wb:ready` (init) |
| SuperGrid render | `sg:render`, `sg:d3join`, `sg:fetchAndRender` |
| ETL import | `etl:parse`, `etl:dedup`, `etl:write`, `etl:fts-rebuild` |

### Pattern 3: WorkerBridge Round-Trip Instrumentation
**What:** Mark at `postMessage` send, measure in `handleResponse` using existing `pending.sentAt`.
**When to use:** PROF-01. The `pending.sentAt` (Date.now()) already exists in WorkerBridge — replace with `performance.now()` and add PerfTrace mark/measure pair.

```typescript
// In WorkerBridge.send() — after this.worker.postMessage(request):
startTrace(`wb:query:${type}`);

// In WorkerBridge.handleResponse() — before resolve/reject:
endTrace(`wb:query:${pending.type}`);
```

Note: Use the correlation `id` carefully — `startTrace` marks must use a unique key per in-flight request if concurrent queries are profiled. Option: use `wb:query:${id}` as the trace name (unique per request), then aggregate by type in BOTTLENECKS.md analysis.

### Pattern 4: ViewManager Render Cycle Instrumentation
**What:** Bracket `_fetchAndRender()` entry to `currentView.render()` completion.
**When to use:** PROF-02. `ViewManager._fetchAndRender()` is the entry point; `this.currentView.render(cards)` is the D3 join.

```typescript
// At top of _fetchAndRender():
startTrace('sg:fetchAndRender');

// Just before this.currentView?.render(cards):
endTrace('sg:fetchAndRender');
startTrace('sg:render');
// (end sg:render inside view.render() — or instrument SuperGrid._renderCells() directly)
```

### Pattern 5: ETL Pipeline Decomposition
**What:** Wrap each of the 4 stages in `ImportOrchestrator.import()` with PerfTrace marks.
**When to use:** PROF-03. The 4 stages are: `this.parse()`, `this.dedup.process()`, `this.writer.writeCards()`, `rebuildFTS()` (inside SQLiteWriter when `useFTSOptimization`).

```typescript
// In ImportOrchestrator.import():
startTrace('etl:parse');
const parsed = await this.parse(source, data, options);
endTrace('etl:parse');

startTrace('etl:dedup');
const dedupResult = this.dedup.process(cards, connections, source);
endTrace('etl:dedup');

startTrace('etl:write');
await this.writer.writeCards(dedupResult.toInsert, isBulkImport, progressCallback);
endTrace('etl:write');
// FTS timing measured via SQLiteWriter migration (rebuildFTS → PerfTrace)
```

### Pattern 6: Vitest bench() for Scale Tiers
**What:** Each bench file uses `beforeAll()` to seed the database at the target scale, then measures the operation. Three describe blocks per file (1K, 5K, 20K).
**When to use:** PROF-04, PROF-05, PROF-06.

```typescript
// tests/profiling/query.bench.ts (PROF-04 template)
import { afterAll, beforeAll, bench, describe } from 'vitest';
import { Database } from '../../src/database/Database';

describe('PROF-04: SQL query throughput — 1K cards', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
    seedDatabase(db, { cardCount: 1_000 }); // extend seed.ts helper
  }, 30_000);

  afterAll(() => db.close());

  bench('supergrid:query GROUP BY folder/card_type', () => {
    db.exec(`SELECT folder, card_type, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY folder, card_type`);
  }, { iterations: 200, time: 10_000 });
});

// Repeat for 5K and 20K in separate describe blocks
```

**TaskResult fields available for BOTTLENECKS.md:** `mean` (ms), `p75` (ms), `p99` (ms), `p995` (ms), `min` (ms), `max` (ms), `hz` (ops/sec). All in milliseconds.

### Pattern 7: rollup-plugin-visualizer `npm run analyze`
**What:** Separate Vite config that enables the plugin for treemap output without affecting dev or prod builds.

```typescript
// vite.config.analyze.ts
import { defineConfig } from 'vite';
import { visualizer } from 'rollup-plugin-visualizer';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    viteStaticCopy({ targets: [{ src: 'src/assets/sql-wasm-fts5.wasm', dest: 'assets' }] }),
    visualizer({
      filename: 'stats.html',
      template: 'treemap',  // treemap | sunburst | network
      gzipSize: true,       // show gzip-compressed sizes
      brotliSize: true,     // also show brotli
      open: true,           // auto-open in browser after build
    }),
  ],
  // ... same build config as vite.config.ts
});
```

```json
// package.json scripts addition:
"analyze": "vite build --config vite.config.analyze.ts"
```

```gitignore
# .gitignore addition:
stats.html
```

### Anti-Patterns to Avoid
- **Calling `performance.mark()` directly in production code:** Always wrap in `__PERF_INSTRUMENTATION__` guard via PerfTrace — marks accumulate in the PerformanceObserver buffer and are never collected, causing slow memory growth.
- **Modifying vitest.config.ts bench settings:** The existing `pool: 'forks'` and `isolate: true` settings are correct for WASM; bench files must live under `tests/` and respect the global setup for sql.js WASM init.
- **Using `Date.now()` instead of `performance.now()` in PerfTrace:** `Date.now()` is 1ms quantized; `performance.now()` provides sub-millisecond resolution needed for 16ms render targets.
- **Running bundle analysis on every build:** The visualizer plugin slows Rollup's build pass significantly — keep it in a dedicated config, not the main `vite.config.ts`.
- **Seeding data inside `bench()` function body:** Data generation in the bench fn body contaminates timing. Always seed in `beforeAll()` and measure only the target operation.
- **Mixing import-from-scratch and pre-loaded snapshot in one bench:** The two strategies measure different things. ETL bench uses import-from-scratch; render/query bench uses pre-loaded snapshot.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Statistical percentile analysis | Custom p99 calculator | tinybench (already in vitest) | Provides p75/p99/p995/p999 from actual sample distribution; handles warmup, iterations, and time caps automatically |
| Bundle size analysis | Custom rollup output walk | rollup-plugin-visualizer | Integrates into Rollup's bundle graph API; gives gzip/brotli accurate sizes and module relationships |
| Production-safe timing guards | If-blocks scattered through source | PerfTrace + Vite define | Vite's tree-shaker eliminates dead `if (false)` branches at build time — zero runtime overhead |
| Cross-Worker timing correlation | Custom message-ID → timestamp maps | `performance.mark()` with correlation ID in name | Browser's performance timeline is already correlated across Worker boundaries via `performance.mark()` |

**Key insight:** The existing bench infrastructure is already correct and battle-tested — PROF-04/05/06 are new files that clone the established pattern, not new patterns.

## Common Pitfalls

### Pitfall 1: `__PERF_INSTRUMENTATION__` not declared in TypeScript
**What goes wrong:** TypeScript compiler errors on `__PERF_INSTRUMENTATION__` usage — "Cannot find name '__PERF_INSTRUMENTATION__'".
**Why it happens:** Vite `define` replaces constants at build time but TypeScript has no knowledge of them without a declaration.
**How to avoid:** Add `declare const __PERF_INSTRUMENTATION__: boolean;` to `src/vite-env.d.ts` (the project's ambient declaration file) before adding any `PerfTrace` call sites.
**Warning signs:** TypeScript errors in `src/profiling/PerfTrace.ts` on the bare `__PERF_INSTRUMENTATION__` identifier.

### Pitfall 2: PerfTrace marks accumulating in Worker context
**What goes wrong:** `performance.mark()` in the Worker thread creates entries in the Worker's PerformanceObserver buffer, which is separate from the main thread's buffer.
**Why it happens:** Workers have isolated `performance` objects — marks made in the Worker are not visible in `performance.getEntriesByName()` on the main thread.
**How to avoid:** ETL instrumentation (PROF-03) lives in `ImportOrchestrator` which runs in the Worker; read marks in Worker test context or via Worker-side `performance.getEntriesByName()`. For bench files (PROF-06), the database runs in-process (not via WorkerBridge) — marks are directly accessible.
**Warning signs:** `performance.getEntriesByName('etl:parse')` returns empty array when called from main thread.

### Pitfall 3: Bench file WASM init requirement
**What goes wrong:** New bench files in `tests/profiling/` fail with "sql-wasm-fts5.wasm not found" or "Module not initialized".
**Why it happens:** `vitest.config.ts` has `globalSetup: './tests/setup/wasm-init.ts'` — bench files are covered by this global setup only if they run under the same vitest config.
**How to avoid:** Place all new bench files under `tests/` (not a separate directory). Confirm `tests/profiling/*.bench.ts` files are picked up by the existing vitest config without changes. The `globalSetup` applies to all test files matched by vitest.
**Warning signs:** Bench file works in isolation with `--config` override but fails with `npm test`.

### Pitfall 4: `performance.now()` vs `pending.sentAt` (Date.now()) in WorkerBridge
**What goes wrong:** The existing `pending.sentAt = Date.now()` stores milliseconds but `performance.now()` returns milliseconds from the time origin — the two are not directly subtractable.
**Why it happens:** `Date.now()` = Unix epoch milliseconds; `performance.now()` = milliseconds since page load. Both are ms but different origins.
**How to avoid:** When migrating `WorkerBridge` to PerfTrace for PROF-01, change `sentAt` to use `performance.now()` internally (keep the field for backward compat, just change what it stores), or use the `performance.mark()` approach that avoids manual subtraction entirely.
**Warning signs:** Negative or absurdly large latency values in WorkerBridge debug logging.

### Pitfall 5: Card duplication strategy ID conflicts
**What goes wrong:** Cloning existing Apple Notes cards by duplicating rows without modifying IDs causes `UNIQUE constraint failed: cards.id`.
**Why it happens:** SQLite enforces PK uniqueness — cloned cards must have new UUIDs.
**How to avoid:** The duplication script must regenerate IDs (`crypto.randomUUID()`) and update `source_id` to avoid dedup engine collision detection. Keep `folder`, `card_type`, `status`, etc. identical to preserve realistic distribution for query profiling.
**Warning signs:** Import throws "UNIQUE constraint" during the 20K card fill step.

### Pitfall 6: rollup-plugin-visualizer peer dep mismatch
**What goes wrong:** `visualizer()` plugin crashes at build time with Rollup API mismatch.
**Why it happens:** Vite 7.3.1 uses Rollup 4.x internally — rollup-plugin-visualizer 7.0.1 declares `peerDependencies: { rollup: "2.x || 3.x || 4.x" }`, so 4.x is supported. But older versions of the plugin did not support Rollup 4.
**How to avoid:** Pin `rollup-plugin-visualizer@^7.0.0` (7.0.1 is the latest as of 2026-03-11, which supports Rollup 2.x/3.x/4.x).
**Warning signs:** `TypeError: visualizer is not a function` or missing rollup output hook errors.

## Code Examples

Verified patterns from existing codebase + library docs:

### Existing bench() usage (verified from tests/database/performance.bench.ts)
```typescript
// Source: /tests/database/performance.bench.ts (project)
import { afterAll, beforeAll, bench, describe } from 'vitest';

describe('Benchmarks', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
    seedDatabase(db); // seed ONCE for all bench runs in this describe
  }, 60_000);

  afterAll(() => db.close());

  bench('operation name', () => {
    // measured operation — no async needed for synchronous SQL
    db.exec('SELECT ...');
  }, {
    iterations: 100,   // minimum iterations
    time: 5000,        // stop after 5s even if iterations not met
  });
});
```

### PerfTrace call site migration (SQLiteWriter existing → PerfTrace)
```typescript
// BEFORE (existing SQLiteWriter lines 49-51):
const batchStart = performance.now();
this.insertBatch(batch);
const batchElapsed = performance.now() - batchStart;

// AFTER (migrated to PerfTrace):
startTrace('etl:write:batch');
this.insertBatch(batch);
endTrace('etl:write:batch');
const batchElapsed = getTraces('etl:write:batch').at(-1)?.duration ?? 0;
```

### rollup-plugin-visualizer (from npm registry docs, version 7.0.1)
```typescript
// Source: npm show rollup-plugin-visualizer (verified 2026-03-11)
import { visualizer } from 'rollup-plugin-visualizer';

// In vite.config.analyze.ts plugins array:
visualizer({
  filename: 'stats.html',
  template: 'treemap',   // 'treemap' | 'sunburst' | 'network' | 'raw-data' | 'list'
  gzipSize: true,
  brotliSize: true,
  open: true,
})
```

### Vitest bench outputJson for BOTTLENECKS.md population
```bash
# Run bench and save JSON for analysis
npx vitest bench tests/profiling/ --run --outputJson bench-results.json

# JSON structure: { files: [{ filepath, groups: [{ fullName, benchmarks: [{ name, result: { mean, p75, p99, hz, min, max } }] }] }] }
```

### SuperGrid bench pattern (verified from tests/views/SuperGrid.bench.ts)
```typescript
// Source: /tests/views/SuperGrid.bench.ts (project) — jsdom environment required
// @vitest-environment jsdom

bench('_renderCells at 20K cells', () => {
  const cells = makeSyntheticCells(colAxes, rowAxes, 20_000, 42);
  (grid as any)._renderCells(cells, colAxes, rowAxes);
}, { time: 3000, iterations: 10 });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `Date.now()` for timing | `performance.mark()`/`performance.measure()` | ~2017 (widely adopted) | Sub-ms resolution; DevTools integration; PerformanceObserver support |
| Global bench tooling (benchmark.js) | tinybench embedded in vitest | Vitest 0.23+ | No separate install; same process as test runner; statistical percentiles out of the box |
| Bundle analysis via webpack-bundle-analyzer | rollup-plugin-visualizer for Vite/Rollup | Vite adoption ~2021 | Native Rollup output graph; accurate gzip; treemap/sunburst/network views |

**Deprecated/outdated:**
- `benchmark.js`: Superseded by tinybench for Vitest-based projects; heavier, separate process required.
- `Date.now()` for performance measurement: 1ms quantization makes it inadequate for sub-16ms render targets; `performance.now()` is always preferred.

## Open Questions

1. **SQLite snapshot format for isolated render/query profiling**
   - What we know: The Worker uses `db:export` (Uint8Array) and wasm-init accepts `dbData` for hydration. Bench files use `Database` directly (not WorkerBridge).
   - What's unclear: Whether the bench file strategy is (a) seed in `beforeAll()` using the existing seed helpers — no snapshot needed — or (b) export/re-import a binary snapshot file between describe blocks. Option (a) is simpler and aligns with the existing pattern.
   - Recommendation: Use option (a) — seed in `beforeAll()` with a parameterized `seedDatabase(db, { cardCount })` helper. Only create a snapshot file if seeding at 20K takes > 30 seconds per describe block.

2. **`__PERF_INSTRUMENTATION__` in Worker context**
   - What we know: The Worker is a separate Vite-bundled entry point (`src/worker/worker.ts`). Vite's `define` applies to all bundled files including workers.
   - What's unclear: Whether the Worker's bundle inherits the `define` from the main config or needs it declared separately in `worker` build options.
   - Recommendation: Verify by adding a test `console.log(__PERF_INSTRUMENTATION__)` in worker.ts during dev; if `undefined`, add `define` to `worker: { rollupOptions: { ... } }` block in vite.config.

3. **20K card duplication from real Apple Notes data**
   - What we know: The user's Apple Notes dataset is ~5K–20K cards. If it's already 20K, no duplication needed.
   - What's unclear: How many cards the actual dataset produces after import; the duplication script is only needed if < 20K.
   - Recommendation: Profile at actual scale first; if < 20K, the duplication helper creates cloned rows with new UUIDs preserving folder/card_type distribution.

## Sources

### Primary (HIGH confidence)
- `/tests/database/performance.bench.ts` — verified working bench pattern, correct vitest API usage
- `/tests/views/SuperGrid.bench.ts` — verified working bench pattern with jsdom environment
- `/tests/database/seed.ts` — verified seeding helper pattern
- `/node_modules/tinybench/README.md` — verified `TaskResult` shape: `{ mean, p75, p99, p995, p999, min, max, hz, samples }` (tinybench 2.9.0)
- `npm show rollup-plugin-visualizer@7.0.1` — verified version 7.0.1, peer deps `rollup: 2.x || 3.x || 4.x`
- `vitest bench --help` (vitest 4.0.18) — verified `--outputJson`, `--compare` CLI flags

### Secondary (MEDIUM confidence)
- Vite 7.3.1 docs (training knowledge) — `define` constant pattern for tree-shaking; confirmed by absence of existing `__DEV__` or `import.meta.env` usage in the project (no conflicts)
- rollup-plugin-visualizer plugin API (`visualizer({ template, gzipSize, filename, open })`) — confirmed via npm package description and version compatibility

### Tertiary (LOW confidence)
- Worker `define` inheritance from main Vite config — training knowledge only; marked as Open Question #2 for verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via installed node_modules and npm registry
- Architecture: HIGH — instrumentation patterns derived from existing working code in the project
- Pitfalls: MEDIUM — most derived from known API contracts and project-specific code analysis; Worker define inheritance is LOW

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable APIs; rollup-plugin-visualizer version current as of research date)
