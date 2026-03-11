# Architecture Research

**Domain:** Performance optimization for local-first TypeScript/D3/sql.js/WebWorker app
**Researched:** 2026-03-11
**Confidence:** HIGH (all integration points verified from direct source analysis)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Main Thread (UI)                              │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ D3 Views     │  │  Providers   │  │  WorkbenchShell/      │  │
│  │ (9 views)    │  │  Filter/PAFV │  │  Explorers            │  │
│  │              │  │  Density/    │  │                       │  │
│  │ SuperGrid    │  │  Schema etc  │  │  MutationManager      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬────────────┘  │
│         │                │                      │               │
│  ┌──────▼───────────────▼──────────────────────▼────────────┐  │
│  │              StateCoordinator                              │  │
│  │  (setTimeout 16ms two-tier batching)                       │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │                  WorkerBridge                               │  │
│  │  send() → rAF coalescing (superGridQuery) → postMessage     │  │
│  │  pending Map<correlationId, Promise> → response routing     │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
├─────────────────────────────│────────────────────────────────────┤
│         postMessage / onmessage boundary                         │
├─────────────────────────────│────────────────────────────────────┤
│                    Web Worker Thread                             │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │         routeRequest() -> typed handler switch              │  │
│  │                                                             │  │
│  │  supergrid:query   supergrid:calc   etl:import              │  │
│  │  card:*            search:cards     graph:simulate           │  │
│  │  histogram:query   chart:query      db:distinct-values       │  │
│  └──────────────────────────┬─────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼─────────────────────────────────┐  │
│  │                   sql.js Database                           │  │
│  │   WASM SQLite: cards, connections, FTS5, ui_state           │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Swift Native Shell (separate process via WKWebView)
┌────────────────────────────────────────────────┐
│  DatabaseManager actor (checkpoint persistence) │
│  BridgeManager (6 message types)               │
│  WKURLSchemeHandler (WASM serving)              │
└────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Performance Relevance |
|-----------|---------------|----------------------|
| WorkerBridge | Typed RPC, correlation IDs, rAF coalescing, pending Map | Coalescing is the primary query dedup mechanism. `sentAt` already tracked. |
| StateCoordinator | Batches provider changes via setTimeout(16) into single view update | Prevents N queries per multi-provider change. Timing hook goes here. |
| SuperGridVirtualizer | Data windowing before D3 join (startRow/endRow slice from VIRTUALIZATION_THRESHOLD=100) | Only integration point for row-level render reduction |
| SuperGridQuery | Builds SQL from PAFVProvider axes, WHERE, ORDER BY | Query complexity scales with axis depth. SQL optimization target. |
| MutationManager | rAF-batched notifications, command log, dirty flag | rAF dedup prevents re-render storms on rapid undo/redo |
| D3 data join | Key-function stable DOM update | Key function mandatory. Missing it causes full DOM thrash. |
| ETL (SQLiteWriter) | 100-card batched writes, FTS trigger disable/rebuild | Batch size is the primary ETL optimization lever |
| initialize() in worker.ts | WASM load + PRAGMA introspection + queue drain | Cold start decomposition target |

---

## Recommended Project Structure

The v6.0 performance milestone adds new files in these locations:

```
src/
├── perf/                               # NEW: all performance infrastructure
│   ├── PerfMonitor.ts                  # Metric collector: record(), sample(), getStats()
│   ├── PerfBudget.ts                   # Budget constants and violation detection
│   ├── PerfReporter.ts                 # Aggregates + exports (console.table, JSON)
│   └── marks.ts                        # Named performance.mark() / measure() constants
├── worker/
│   ├── WorkerBridge.ts                 # MODIFY: add timing hook to handleResponse()
│   ├── worker.ts                       # MODIFY: add performance.mark() to initialize()
│   └── handlers/
│       └── supergrid.handler.ts        # MODIFY: Worker-side SQL execution timing
├── views/
│   ├── ViewManager.ts                  # MODIFY: mark at _fetchAndRender() entry/exit
│   ├── SuperGrid.ts                    # MODIFY: render budget guard post-join
│   └── supergrid/
│       └── SuperGridVirtualizer.ts     # INSPECT: verify threshold at 20K scale
└── providers/
    └── StateCoordinator.ts             # MODIFY: update-frequency metric

tests/
├── perf/                               # NEW: benchmark harness
│   ├── benchmark.supergrid.test.ts     # supergrid:query at 1K/5K/10K/20K cards
│   ├── benchmark.etl.test.ts           # ETL import at 1K/5K/20K cards
│   ├── benchmark.launch.test.ts        # WASM init + DB hydration timing
│   └── regression.budgets.test.ts      # CI gate: assert p99 < budget thresholds
```

### Structure Rationale

- **src/perf/:** All profiling and budget infrastructure lives here, isolated from business logic. Import direction is one-way: views and workers import from perf/, never the reverse. Zero coupling to providers or views.
- **tests/perf/:** Benchmark tests are separate from unit tests because they require larger datasets and Vitest's tinybench integration. SQL benchmarks run directly against sql.js WASM (no Worker — Worker not available in jsdom test context).

---

## Architectural Patterns

### Pattern 1: Non-Invasive Timing via handleResponse()

**What:** WorkerBridge already tracks `sentAt` per pending request in the `pending` Map. WorkerResponse already has an optional `timing?: { queued, executed, returned }` field in the protocol schema (D-002). Adding one line to `handleResponse()` captures end-to-end latency without modifying any handler.

**When to use:** Profiling all Worker round-trip latency by request type. Zero Handler-side changes needed for main-thread measurement.

**Trade-offs:** Measures postMessage round-trip including serialization. Does not decompose SQL execution time from IPC overhead. A second pass adding Worker-side `performance.now()` around `db.exec()` is needed for SQL isolation.

**Example:**
```typescript
// WorkerBridge.handleResponse() — add after clearTimeout():
if (this.perfMonitor?.isEnabled()) {
  const latency = Date.now() - pending.sentAt;
  this.perfMonitor.record(pending.type, latency);
}
```

### Pattern 2: rAF-Loop Frame Budget Guard

**What:** Attach a `requestAnimationFrame` loop that measures frame duration via `performance.now()`. When consecutive frames exceed 16.67ms, emit a budget violation event. The SuperGrid scroll handler is the primary target; the Virtualizer already handles data windowing.

**When to use:** Detecting jank during SuperGrid scroll at 10K-20K row scale. This complements the Virtualizer — Virtualizer limits data, the frame guard detects when CSS paint still exceeds budget.

**Trade-offs:** The rAF loop itself adds approximately 0.1ms overhead per frame. Must be feature-flag gated (debug only). Cannot isolate JS from paint time in the browser — reports frame budget violations, not specific causes.

**Example:**
```typescript
// PerfMonitor.startFrameSampler():
let last = performance.now();
const tick = () => {
  const now = performance.now();
  const delta = now - last;
  last = now;
  if (delta > 16.67) this._emit('frame-budget-violation', { delta });
  this._rafId = requestAnimationFrame(tick);
};
this._rafId = requestAnimationFrame(tick);
```

### Pattern 3: Benchmark Harness as Vitest Tests with tinybench

**What:** Use Vitest + tinybench (already a Vitest transitive dependency) to write automated benchmarks that assert against p99 thresholds. Tests run in CI and fail builds when regressions occur. This mirrors the existing v0.1 pattern in PROJECT.md ("Performance thresholds: insert <10ms, bulk insert <1s, FTS <100ms").

**When to use:** Regression guard for SuperGrid SQL query, ETL import, FTS search, and cold start. The pattern is already established — v0.1 used `p99 as p95 proxy` (documented in PROJECT.md key decisions).

**Trade-offs:** Vitest benchmarks run in jsdom, not a real browser. SQL benchmarks (Worker-less) are accurate because they use real sql.js WASM. D3 render benchmarks in jsdom are unreliable — jsdom has no layout engine. Benchmark only SQL and data-join key comparisons, not DOM paint.

**Example:**
```typescript
// tests/perf/benchmark.supergrid.test.ts
import { bench, describe } from 'vitest';

describe('supergrid:query at 20K cards', () => {
  bench('5-axis GROUP BY', async () => {
    db.exec(buildSuperGridSQL({ colAxes: ['folder', 'status'], rowAxes: ['priority', 'card_type', 'source'] }));
  }, { iterations: 50 });
});
```

### Pattern 4: performance.mark() at Cold Start Boundaries

**What:** Add `performance.mark()` / `performance.measure()` calls at each stage of `worker.ts initialize()`. The function already has natural phase boundaries: `db.initialize()` (WASM load + schema apply), `PRAGMA table_info()` introspection, `processPendingQueue()`. Marks at each boundary decompose the cold start timeline.

**When to use:** Cold start optimization. WASM binary is 756KB. Decomposing "fetch + parse + instantiate + schema init + queue drain + ready signal" identifies which phase exceeds budget.

**Trade-offs:** `performance.mark()` is available in Web Workers in Safari 16.4+ (iOS 16.4+). iOS 17 target is safe. Must check if `performance` global exists before calling in older WKWebView contexts.

**Example:**
```typescript
// worker.ts initialize():
performance?.mark('wasm-start');
await db.initialize(wasmBinary, dbData);
performance?.mark('wasm-done');

performance?.mark('pragma-start');
const rawCards = db.exec('PRAGMA table_info(cards)');
performance?.mark('pragma-done');

performance?.measure('wasm-init', 'wasm-start', 'wasm-done');
performance?.measure('pragma-init', 'pragma-start', 'pragma-done');
```

---

## Data Flow

### Performance Profiling Data Flow

```
[User interaction / scroll / provider change]
    |
    v
[ViewManager._fetchAndRender()]
    |--- performance.mark('render-start')   [NEW]
    v
[superGridQuery() in WorkerBridge]
    |--- sentAt = Date.now()               [ALREADY TRACKED]
    |--- rAF coalesces multiple calls
    |--- postMessage(request)
    v
[Worker: routeRequest -> handleSuperGridQuery]
    |--- performance.now() SQL start/end   [NEW Worker-side]
    |--- timing: { queued, executed, returned } in WorkerResponse
    v
[WorkerBridge.handleResponse()]
    |--- latency = Date.now() - sentAt     [NEW: one line]
    |--- PerfMonitor.record(type, latency) [NEW]
    v
[D3 data join / _renderCells()]
    |--- performance.mark('render-done')   [NEW]
    v
[PerfMonitor aggregates: mean, p99 per request type]
    |
    v
[PerfReporter: console.table / JSON export / budget violation events]
```

### Budget Enforcement Flow (CI)

```
[Vitest benchmark test: tests/perf/benchmark.supergrid.test.ts]
    |
    v
[Direct sql.js db.exec() — no Worker, no jsdom DOM]
    |
    v
[tinybench result: mean, p99 per iteration]
    |
    v
[PerfBudget.assert(result.p99 < SUPERGRID_QUERY_BUDGET)]
    |--- PASS: green CI
    |--- FAIL: red CI, blocks merge
```

### Key Data Flows

1. **SuperGrid scroll render:** scroll event -> Virtualizer.getVisibleRange() (computes startRow/endRow) -> slice rows array -> D3 .data() key-function join -> DOM update. Performance hook sits between the scroll event and the D3 join. The Virtualizer already bounds the data; the hook measures whether the join itself fits in the frame budget.

2. **Multi-provider change:** Provider fires queueMicrotask self-notify -> StateCoordinator.scheduleUpdate() queues setTimeout(16) -> single callback fires -> ViewManager._fetchAndRender() -> superGridQuery() rAF coalesces -> one Worker request. End-to-end measurement wraps _fetchAndRender(). The two-tier batching (microtask + setTimeout) is load-bearing — do not alter it.

3. **ETL import:** file input -> WorkerBridge.importFile() (300s timeout) -> Worker ETLImport handler -> DedupEngine -> SQLiteWriter 100-card batches with FTS trigger disable/rebuild -> postNotification progress -> ImportToast. Timing hooks on batch write boundaries. The batch size (100 cards) and the FTS disable/rebuild pattern are both performance decisions already validated at 5K cards; re-validate at 20K.

4. **Cold start:** Swift LaunchPayload -> WorkerBridge constructor -> Worker wasm-init -> initialize() [WASM load + schema apply + PRAGMA + queue drain] -> ready signal -> isReady resolves -> ViewManager first view -> first supergrid:query. performance.mark() at each phase boundary. The two-phase native launch pattern (waitForLaunchPayload blocks before WorkerBridge init so dbData arrives before WASM init) is load-bearing — do not alter.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1K cards | No changes needed — current architecture handles comfortably |
| 10K cards | SuperGridVirtualizer active (>100 row threshold); CSS content-visibility: auto handles cell-level (Safari 18+) |
| 20K cards (v6.0 target) | Virtualizer threshold may need tuning; SQL GROUP BY on 20K rows is the primary bottleneck |
| 100K+ cards | sql.js in-memory becomes the hard limit; out of v6.0 scope (PROJECT.md explicitly defers "Virtual scrolling for 100K+") |

### Scaling Priorities

1. **First bottleneck at 20K:** SQL query time inside the Worker. The `supergrid:query` handler executes GROUP BY over 20K rows with N-level PAFV axes. Each additional axis adds a GROUP BY column. Adding indexes on the axis-eligible columns (status, folder, priority, card_type, created_at, modified_at) is the primary lever.

2. **Second bottleneck at 20K:** postMessage structured-clone serialization. CellDatum[] returned from Worker to main thread is serialized. At 20K cards with 5 axes, the result can be thousands of CellDatum objects. The correct fix is more aggressive SQL-side filtering, not a main-thread cache (which would violate the no-parallel-state architectural constraint).

3. **Third bottleneck (D3 join):** At 2,500+ cells, the DOM update pass during scroll is limited by cell-count-per-viewport, not total cards. The Virtualizer already caps this by data-windowing rows before the D3 join. The correct diagnostic is confirming the Virtualizer's VIRTUALIZATION_THRESHOLD (100 rows) activates appropriately for PAFV projections where leaf row count != raw card count.

---

## Anti-Patterns

### Anti-Pattern 1: Profiling Inside the StateCoordinator Timer

**What people do:** Add `console.time()` or `performance.mark()` inside the `setTimeout` callback in StateCoordinator to measure "how long a render takes."

**Why it's wrong:** StateCoordinator fires the notification, but the actual render — ViewManager._fetchAndRender() plus the entire Worker round-trip — is asynchronous and happens after. The timer measures only the synchronous notification dispatch, not the expensive part. This produces false "fast" measurements.

**Do this instead:** Place marks at ViewManager._fetchAndRender() entry and at D3 join completion (after _renderCells() returns). Worker round-trip is measured separately via WorkerBridge.handleResponse().

### Anti-Pattern 2: Benchmarking D3 Render in jsdom

**What people do:** Write Vitest benchmarks that call `view.render(cards)` in jsdom and measure elapsed time.

**Why it's wrong:** jsdom has no layout engine. CSS Grid, sticky positioning, getBoundingClientRect(), scrollTop all return 0 or stubs. A render that takes 2ms in jsdom may take 50ms in a real browser at 20K scale. This is documented in PROJECT.md: "PLSH-01 adapted from 50x50 grid to 10x10 in jsdom (100x slower DOM ops) — algorithmic guard preserved."

**Do this instead:** Benchmark SQL query time (accurate in Vitest — real WASM, no DOM) and D3 key-function comparison (pure JS, accurate). Use Playwright E2E for real-browser render timing.

### Anti-Pattern 3: Adding a Parallel State Cache for Performance

**What people do:** Cache the last CellDatum[] result in main-thread memory so repeated renders can skip the Worker round-trip.

**Why it's wrong:** This directly violates D-001 through D-011: "D3 data join IS state management — no parallel state store." A CellDatum cache duplicates sql.js data into main-thread memory. Every mutation (MutationManager.execute) must then invalidate the cache — exactly the problem StateCoordinator's batching already solves. This creates two sources of truth.

**Do this instead:** Optimize the Worker SQL query itself (indexes, query plan). The rAF coalescing in superGridQuery() already prevents redundant requests within a frame. If query latency is the bottleneck, that is a SQL optimization problem.

### Anti-Pattern 4: Calling performance.mark() on Every Render Frame

**What people do:** Call `performance.mark()` and `performance.measure()` on every rAF tick and every D3 join for "complete" profiling coverage.

**Why it's wrong:** `performance.mark()` is not free. At 60fps with 10+ marks per frame, the overhead distorts measurements. The PerformanceObserver entries buffer fills, increasing GC pressure.

**Do this instead:** Sample at low frequency (every 10th frame or on-demand via debug flag). Reserve `performance.mark()` for named milestone boundaries (init, first render, first import complete). Use `performance.now()` deltas inline only for hot paths.

---

## Integration Points

### New Components

| Component | Location | Integrates With | Notes |
|-----------|----------|-----------------|-------|
| PerfMonitor | `src/perf/PerfMonitor.ts` | WorkerBridge.handleResponse(), ViewManager._fetchAndRender() | Singleton, feature-flag gated; injected as optional dependency |
| PerfBudget | `src/perf/PerfBudget.ts` | PerfMonitor (consumer), Vitest benchmark tests | Constants informed by Phase 1 baseline data |
| PerfReporter | `src/perf/PerfReporter.ts` | PerfMonitor (consumer), CommandBar (UI hook) | Debug builds only; console.table + JSON export |
| BenchmarkHarness | `tests/perf/benchmark.*.test.ts` | Direct sql.js WASM (no Worker), Vitest + tinybench | CI gate via PerfBudget.assert() |

### Modified Components

| Component | What Changes | How (Load-Bearing Constraints) |
|-----------|-------------|-------------------------------|
| `WorkerBridge.handleResponse()` | Add `latency = Date.now() - sentAt` recorded to PerfMonitor | `sentAt` already tracked — one line addition. Do not alter correlation ID logic. |
| `worker.ts initialize()` | Add `performance?.mark()` at WASM and PRAGMA boundaries | Optional chaining required — performance global may be absent in older WKWebView. |
| `worker.ts handleRequest()` | Add Worker-side `performance.now()` start/end for SQL execution | Populate WorkerResponse.timing fields (already in protocol schema). |
| `ViewManager._fetchAndRender()` | Add mark at entry and at resolved D3 join | Async — mark "done" goes in the `.then()` after `_render()` completes. |
| `SuperGrid._renderCells()` | Add post-join frame budget check | One synchronous check after the D3 join loop. |
| `StateCoordinator.scheduleUpdate()` | Add update-frequency counter | Detect provider over-notification — count calls per 16ms window. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| PerfMonitor <-> WorkerBridge | Direct method call (`this.perfMonitor?.record(...)`) | PerfMonitor injected as optional dep in WorkerBridge constructor config |
| PerfMonitor <-> ViewManager | Direct method call | Same injection pattern as WorkerBridge |
| Worker-side timing <-> Main thread | WorkerResponse `timing` field (already defined in protocol.ts as optional) | `timing?: { queued: number; executed: number; returned: number }` — populate it in handleRequest() |
| BenchmarkHarness <-> sql.js | Direct `import { Database }` — no Worker bridge in test context | Matches existing v0.1 benchmark pattern (tinybench, p99 proxy for p95) |
| PerfBudget <-> CI | Standard Vitest `expect(result.p99).toBeLessThan(BUDGET)` | Test failure = CI failure. No special setup required. |

---

## Build Order: Profile -> Budget -> Optimize -> Guard

The four-phase order is mandatory. Each phase depends on data from the previous one. Optimizing before profiling is guessing; setting budgets before profiling produces arbitrary thresholds.

### Phase 1: Profile (Instrument All 4 Performance Domains)

**Goal:** Gather baseline measurements before changing anything. No optimizations in this phase.

**What to build:**
1. `src/perf/PerfMonitor.ts` — metric collector with `record(type, value)`, `getStats()`, feature flag
2. `src/perf/marks.ts` — named constants for all mark/measure points (prevents string typos)
3. Wire PerfMonitor into `WorkerBridge.handleResponse()` — latency per request type
4. Add Worker-side timing to `handleRequest()` — populate WorkerResponse.timing
5. Add `performance?.mark()` to `worker.ts initialize()` — decompose cold start
6. Add entry/exit marks to `ViewManager._fetchAndRender()`

**Dependency:** None. PerfMonitor is a passive observer with zero effect on behavior.

**Output:** Baseline numbers: Worker round-trip latency by type, SQL execution time, init sequence breakdown, render cycle duration. These numbers set the Phase 2 budgets.

### Phase 2: Budget (Define and Automate Thresholds)

**Goal:** Turn Phase 1 baseline data into enforceable constraints. Budgets are set from measured reality, not guesses.

**What to build:**
1. `src/perf/PerfBudget.ts` — threshold constants derived from Phase 1 measurements
2. `tests/perf/benchmark.supergrid.test.ts` — SQL query benchmarks at 1K/5K/10K/20K
3. `tests/perf/benchmark.etl.test.ts` — ETL import benchmarks at 1K/5K/20K
4. `tests/perf/regression.budgets.test.ts` — budget assertion tests (CI gate)
5. Wire budget violation events into PerfMonitor

**Dependency:** Phase 1 must be complete so budgets come from real data.

**Output:** Failing tests where the codebase already violates target budgets. This is the "red" step of TDD applied to performance.

### Phase 3: Optimize (Fix What Phase 2 Identifies)

**Goal:** Make the Phase 2 failing tests pass. Fix in order of measured impact.

**Expected optimization targets (based on architectural analysis):**

1. **SQL indexes:** Add indexes on PAFV axis columns (status, folder, priority, card_type, created_at). The `supergrid:query` GROUP BY is the most likely bottleneck at 20K cards. Apply to `schema.sql` and re-run benchmark.
2. **ETL batch tuning:** 100-card SQLiteWriter batches validated at 5K. Re-validate at 20K. The FTS trigger disable/rebuild pattern (P24 in PROJECT.md) may need threshold adjustment.
3. **WASM preloading:** If cold start exceeds budget, investigate `<link rel="preload">` for the WASM binary. The two-phase native launch (waitForLaunchPayload) is load-bearing — do not alter the sequencing.
4. **Virtualizer threshold:** `VIRTUALIZATION_THRESHOLD = 100` rows. At 20K cards with wide PAFV axis configurations, leaf row count can be far lower than raw card count. Verify the threshold activates for the actual projection surface, not just a 1:1 card count.
5. **postMessage payload:** If CellDatum[] serialization dominates, push more filtering into SQL before sending.

**Dependency:** Phase 2 benchmark tests identify which of the above to actually implement. Skip items that are already within budget.

### Phase 4: Guard (Regression Prevention)

**Goal:** Lock in Phase 3 gains. Prevent future regressions.

**What to build:**
1. `src/perf/PerfReporter.ts` — debug-mode reporter with `console.table` output
2. Hook PerfReporter to CommandBar for on-demand perf snapshot (debug builds only)
3. Finalize `regression.budgets.test.ts` with post-optimization thresholds
4. Add budget tests as a 4th parallel job in GitHub Actions CI (alongside typecheck/lint/test)
5. Document new performance contracts in PROJECT.md requirements (matching existing v0.1 format: "Performance thresholds: supergrid:query 20K cards <Xms")

**Dependency:** Phase 3 must complete so guards reflect achievable thresholds, not aspirational ones.

---

## Sources

- Direct source analysis: `src/worker/WorkerBridge.ts` — rAF coalescing implementation, `sentAt` tracking in pending Map, `handleResponse()` structure, existing `timing?` field in protocol
- Direct source analysis: `src/worker/worker.ts` — `routeRequest()`, `handleRequest()`, `initialize()` phase sequence, `pendingQueue` drain order
- Direct source analysis: `src/providers/StateCoordinator.ts` — `setTimeout(16)` two-tier batching, `scheduleUpdate()` dedup logic
- Direct source analysis: `src/views/supergrid/SuperGridVirtualizer.ts` — `VIRTUALIZATION_THRESHOLD = 100`, `OVERSCAN_ROWS = 5`, `getVisibleRange()` data windowing implementation
- Direct source analysis: `src/mutations/MutationManager.ts` — rAF notification batching for mutations
- Direct source analysis: `.planning/PROJECT.md` — v0.1 performance thresholds (insert <10ms, FTS <100ms), v6.0 goals (60fps at 20K, cold start optimization, memory bounds), p99-as-p95-proxy decision, PLSH-01 jsdom 10x10 constraint, rAF coalescing decision, data windowing decision, SuperPositionProvider exclusion from StateCoordinator decision

---

*Architecture research for: Isometry v6.0 Performance*
*Researched: 2026-03-11*
