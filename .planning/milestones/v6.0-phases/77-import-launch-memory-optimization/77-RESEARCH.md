# Phase 77: Import + Launch + Memory Optimization - Research

**Researched:** 2026-03-12
**Domain:** ETL batch tuning, cold-start decomposition, WASM heap profiling, WKWebView crash recovery
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Test batch sizes 100 vs 500 vs 1000 at 20K cards — pick the fastest based on benchmark data
- Keep single FTS rebuild after all inserts (current trigger-disable → bulk insert → rebuild pattern is already optimized)
- Benchmark all parser throughputs (json, markdown, csv, apple_notes) at 20K and document as baseline — no hard pass/fail throughput floor
- Keep current progress reporting granularity (fires every batch boundary regardless of batch size)
- Use PerfTrace markers (performance.now()) at each phase boundary: WASM download/compile → DB hydration → first meaningful paint
- Preload WKWebView + WASM compile in background during app launch animation to hide init behind native splash
- Document cold-start baseline only — no hard time budget; Phase 78 CI guards can reference the data
- Measure in vitest + PerfTrace (JS decomposition, CI-friendly) — no physical device Instruments requirement
- Use process.memoryUsage() in vitest before and after loading 20K cards (RSS, heapUsed, heapTotal)
- Test 3 import-delete-reimport cycles at 20K cards, compare heap at each steady state
- If heap growth >20% across 3 cycles, investigate and fix the leak within Phase 77
- No hard memory ceiling — document steady-state and peak numbers as baseline
- Write integration test simulating WKWebView termination → verify checkpoint data survives recovery cycle
- Keep 10-second safety timeout on recovery overlay (already generous, no need to adjust)
- Measure checkpoint save cost at 20K cards — if >50ms, consider debouncing
- Silent crash detection (checkForSilentCrash) already handled with isJSReady + nil webView guard — include in integration test coverage

### Claude's Discretion
- Optimal batch size selection (100/500/1000) based on benchmark winner
- Whether checkpoint save needs debouncing based on measured cost
- Any additional ETL optimizations if bottlenecks surface during measurement

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| IMPT-01 | ETL batch size re-validated at 20K cards (current 100-card batches vs larger) | SQLiteWriter.BATCH_SIZE=100 is parameterizable; benchmark harness pattern exists in etl-smoke.bench.ts and budget.test.ts |
| IMPT-02 | FTS trigger rebuild timing measured and optimized for 20K card bulk imports | rebuildFTS() + restoreFTSTriggers() already isolated in SQLiteWriter; PerfTrace markers can wrap each step |
| IMPT-03 | Parser throughput benchmarked per source type with bottleneck identification | etl-smoke.bench.ts provides the exact pattern; Phase 74 BOTTLENECKS.md provides baseline numbers to compare against |
| LNCH-01 | Cold start decomposed: WASM init → DB hydration → first meaningful paint with timing | Database.initialize() has the WASM init call (initSqlJs) and DB hydration (new SQL.Database) as distinct steps; PerfTrace can wrap each |
| LNCH-02 | WKWebView warm-up pattern implemented to reduce first-paint latency | ContentView.setupWebView() called in .onAppear — pre-creating WKWebView earlier in IsometryApp body is the correct location |
| MMRY-01 | WASM heap + JS heap measured at 20K cards with peak/steady-state identified | process.memoryUsage() available in vitest Node environment; measure before db.initialize(), after schema, after 20K import |
| MMRY-02 | Import-delete-reimport cycle tested for heap fragmentation/growth | Critical: never call db.close() + new SQL.Database() within existing worker lifetime (D-011 decision) — tests must reuse same DB instance |
| MMRY-03 | WKWebView webViewWebContentProcessDidTerminate wired to checkpoint restore path | Already implemented in BridgeManager.swift WKNavigationDelegate extension — integration test needed to verify the recovery path works end-to-end |
</phase_requirements>

---

## Summary

Phase 77 is a measurement-and-validate phase, not a build-from-scratch phase. All the machinery exists: `SQLiteWriter` has the batch/FTS infrastructure, `PerfTrace` has the timing utility, `Database.initialize()` has the WASM init path, and `BridgeManager.webViewWebContentProcessDidTerminate` already wires to the checkpoint restore path. The work is to (1) run structured benchmarks at the right scale, (2) add PerfTrace markers at the right granularity for cold-start decomposition, (3) surface heap metrics with `process.memoryUsage()`, and (4) write integration tests that verify crash recovery correctness.

The ETL batch size work is a controlled experiment: parameterize `BATCH_SIZE` (currently 100), run at 100/500/1000, pick the winner. Phase 74 baselines (json 11.3K/s, markdown 18.9K/s, csv 26K/s, apple_notes 110K/s at 20K) are the targets to beat or confirm. The FTS rebuild is already a single post-import operation — measuring it isolates whether it contributes meaningfully to total import time.

Cold-start decomposition adds PerfTrace spans inside `Database.initialize()` wrapping the three distinct stages (WASM fetch/compile, DB instantiation/hydration, schema application). WKWebView warm-up moves the `setupWebView()` call earlier in the app lifecycle — from `.onAppear` to `IsometryApp.body` where the `WindowGroup` is constructed — so WASM compilation begins during the launch animation. Memory profiling uses the Node.js `process.memoryUsage()` API available in vitest's `pool: 'forks'` environment; the import-delete-reimport cycle test must reuse a single `Database` instance (never `db.close()` + `new SQL.Database()` within a Worker lifetime per the D-011 lock).

**Primary recommendation:** Organize work into 4 plans mirroring the 4 locked areas: ETL batch + FTS benchmark, cold-start PerfTrace decomposition + WKWebView warm-up, heap measurement + cycle test, and crash recovery integration test. Each plan produces a documented measurement artifact plus any follow-on fixes if thresholds are exceeded.

---

## Standard Stack

### Core (all pre-existing — no new dependencies)

| Library / API | Version | Purpose | Status |
|--------------|---------|---------|--------|
| `SQLiteWriter` (`src/etl/SQLiteWriter.ts`) | — | Batch insert + FTS trigger management | Exists; parameterize `BATCH_SIZE` |
| `PerfTrace` (`src/profiling/PerfTrace.ts`) | — | performance.mark/measure wrapper | Exists; add new span names |
| `PerfBudget` (`src/profiling/PerfBudget.ts`) | — | Budget constants | Exists; `BUDGET_LAUNCH_COLD_MS` and `BUDGET_HEAP_STEADY_MB` are TODO stubs for Phase 77 |
| `Database.initialize()` (`src/database/Database.ts`) | — | WASM init + DB hydration | Exists; add PerfTrace markers inside |
| `process.memoryUsage()` | Node.js built-in | Heap snapshot in vitest | Available in `pool: 'forks'` Node environment |
| `BridgeManager` (`native/…/BridgeManager.swift`) | — | `webViewWebContentProcessDidTerminate` crash recovery | Exists; integration test needed |
| `WKWebView` + `WKWebViewConfiguration` | WebKit / iOS 17+ / macOS 14+ | WKWebView warm-up pre-creation | Exists; move setup earlier in lifecycle |

### No New Dependencies
This phase adds zero new packages. All measurement tools (PerfTrace, process.memoryUsage, vitest it() + performance.now()) and all subject code (SQLiteWriter, Database, BridgeManager) already exist.

---

## Architecture Patterns

### Pattern 1: Batch Size Controlled Experiment

The benchmark structure mirrors the existing `budget.test.ts` pattern: single shared `Database` instance, `beforeAll` seed, `it()` + `performance.now()` timing.

```typescript
// Source: existing pattern in tests/profiling/budget.test.ts
describe('ETL Batch Size Benchmark (IMPT-01)', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
  }, 120_000);

  afterAll(() => db.close());

  for (const batchSize of [100, 500, 1000]) {
    it(`json 20K cards @ batch=${batchSize}`, async () => {
      // Parameterize SQLiteWriter.BATCH_SIZE for this run
      const writer = new SQLiteWriter(db, batchSize);
      const t0 = performance.now();
      await writer.writeCards(cards, true);
      const elapsed = performance.now() - t0;
      console.log(`batch=${batchSize}: ${elapsed.toFixed(0)}ms`);
    }, 120_000);
  }
});
```

**Key constraint:** `SQLiteWriter` constructor must accept an optional `batchSize` parameter for the benchmark. The production `BATCH_SIZE` constant is NOT changed until after benchmarks prove a larger size is faster.

### Pattern 2: FTS Stage Isolation

Separate the three FTS stages using PerfTrace spans to attribute time accurately:

```typescript
// What to add inside SQLiteWriter.writeCards()
startTrace('etl:fts:disable');
this.disableFTSTriggers();
endTrace('etl:fts:disable');

// ... batch loop ...

startTrace('etl:fts:rebuild');
this.rebuildFTS();   // includes INSERT INTO cards_fts VALUES('rebuild') + ('optimize')
endTrace('etl:fts:rebuild');

startTrace('etl:fts:restore');
this.restoreFTSTriggers();
endTrace('etl:fts:restore');
```

Phase 74 BOTTLENECKS.md does NOT isolate FTS timing from total import time. This phase adds that granularity to determine whether the rebuild (not the batch inserts) dominates at 20K.

### Pattern 3: Cold-Start PerfTrace Decomposition

Add markers inside `Database.initialize()` at the three stage boundaries:

```typescript
// Source: src/database/Database.ts — proposed additions to initialize()
async initialize(wasmBinary?: ArrayBuffer, dbData?: ArrayBuffer): Promise<void> {
  startTrace('db:wasm:init');
  const SQL: SqlJsStatic = await initSqlJs(sqlOptions);
  endTrace('db:wasm:init');

  startTrace('db:instance:create');
  if (dbData) {
    this.db = new SQL.Database(new Uint8Array(dbData));
  } else {
    this.db = new SQL.Database();
  }
  endTrace('db:instance:create');

  startTrace('db:schema:apply');
  // PRAGMA + applySchema()
  this.db.run('PRAGMA foreign_keys = ON');
  if (!dbData) await this.applySchema();
  endTrace('db:schema:apply');
}
```

These traces surface in the vitest test environment because `__PERF_INSTRUMENTATION__` is `true` in non-production builds (per `vitest.config.ts` define block).

### Pattern 4: process.memoryUsage() Heap Snapshots

In the vitest Node environment (`pool: 'forks'`), `process.memoryUsage()` is available:

```typescript
// Source: Node.js docs — process.memoryUsage() available in forks pool
function heapSnapshot(label: string) {
  const m = process.memoryUsage();
  console.log(
    `[${label}] rss=${(m.rss / 1e6).toFixed(1)}MB ` +
    `heapUsed=${(m.heapUsed / 1e6).toFixed(1)}MB ` +
    `heapTotal=${(m.heapTotal / 1e6).toFixed(1)}MB`
  );
  return m;
}

// Usage: measure before/after 20K import
const before = heapSnapshot('before-import');
await importOrchestrator.import('json', genJSON(20_000));
const afterImport = heapSnapshot('after-import');
// ... delete all cards ...
const afterDelete = heapSnapshot('after-delete');
// ... reimport ...
const afterReimport = heapSnapshot('after-reimport-1');
// Repeat 3 cycles, assert growth < 20% across cycles
```

**Critical constraint (from D-011 decision log):** Never call `db.close()` + `new SQL.Database()` within an existing Worker lifetime — this causes WASM heap fragmentation. The import-delete-reimport cycle test must DELETE rows from the existing `Database` instance, not destroy and recreate it.

### Pattern 5: WKWebView Pre-Warm

Current flow: `IsometryApp.body` → `ContentView` renders → `.onAppear` → `setupWebView()` → WKWebView created, WASM begins loading.

Proposed flow: Create WKWebView during `IsometryApp.body` construction (before SwiftUI renders `ContentView`), pass it in. WASM begins compiling during native splash animation.

```swift
// In IsometryApp — wrap WKWebView creation at app-level
@StateObject private var bridgeManager = BridgeManager()

// Pre-create WKWebView during app body construction (before ContentView appears)
// This matches the "preload during launch animation" pattern from CONTEXT.md
private let webView: WKWebView = {
  let config = WKWebViewConfiguration()
  // Minimal config — ContentView.setupWebView() can add scripts before loadURL
  return WKWebView(frame: .zero, configuration: config)
}()
```

**Risk:** `setupWebView()` adds `WKUserScript` entries (theme injection, console forwarding). Pre-creating the WKWebView means scripts must be added before or during `setupWebView()`, not after `WKWebView` creation. The `WKWebViewConfiguration` is immutable after WebView creation for most properties — `userContentController.addUserScript()` can still be called post-creation. Verify this is safe.

**Alternative (lower-risk):** Keep WKWebView creation in `setupWebView()` but call it from `IsometryApp.body` via `.task {}` modifier before `ContentView` appears, rather than from ContentView's `.onAppear`. This preserves the existing setup logic.

### Pattern 6: WKWebView Termination Integration Test

The `webViewWebContentProcessDidTerminate` implementation exists and is correct (sets `isJSReady = false`, shows recovery overlay, calls `webView.reload()`). The integration test must verify the recovery path produces checkpoint-safe state:

```swift
// In BridgeManagerTests.swift
@Test func webContentTermination_resetsReadyFlag() async {
  let bridgeManager = BridgeManager()
  // Simulate JS ready state
  // (requires calling didReceive with native:ready message)
  // Then simulate termination
  let config = WKWebViewConfiguration()
  let webView = WKWebView(frame: .zero, configuration: config)
  bridgeManager.configure(webView: webView)
  bridgeManager.webViewWebContentProcessDidTerminate(webView)
  #expect(bridgeManager.isJSReady == false)
  #expect(bridgeManager.showingRecoveryOverlay == true)
}
```

Note: The `nonisolated func webViewWebContentProcessDidTerminate` wraps its body in `Task { @MainActor in ... }`. Tests must await a brief settling time or use `@MainActor` test context.

### Anti-Patterns to Avoid

- **Creating multiple `SQL.Database` instances in one Node worker:** Phase 74 decision — single shared DB in ETL bench to avoid WASM heap OOM. Batch size benchmarks must use the same `Database` instance with `DELETE FROM cards` between runs if needed, or use separate `describe` blocks with their own `beforeAll`/`afterAll`.
- **Using vitest `bench()` instead of `it()` + `performance.now()`:** Phase 74 confirmed that vitest bench v4 returns empty samples in `--run` mode with `forks` pool. All timing must use `it()` blocks with direct `performance.now()` measurement.
- **Modifying PerfBudget.ts constants for Phase 77:** The `BUDGET_LAUNCH_COLD_MS` and `BUDGET_HEAP_STEADY_MB` constants are marked `TODO Phase 77`. These should be UPDATED with actual measured values once benchmarks complete, but no vitest assertions should be added for launch/heap in this phase (physical device measurement required for assertions).
- **Calling `db.close()` mid-cycle in heap tests:** Destroys WASM heap, causes fragmentation on re-init. Use row deletion (`DELETE FROM cards WHERE 1=1`) not DB recreation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Timing measurement | Custom high-res timer | `performance.now()` + existing `PerfTrace` | Already instrumented; consistent naming convention across the codebase |
| Batch throughput comparison | Statistical framework | `it()` + `console.log()` output table | Phase 74 established this is sufficient; results go to console for doc |
| Memory profiling | WASM introspection | `process.memoryUsage()` | Available in Node/vitest forks pool; captures V8 heap + RSS that includes WASM |
| FTS rebuild measurement | SQL timer tables | PerfTrace `startTrace`/`endTrace` | Zero production overhead via `__PERF_INSTRUMENTATION__` guard |
| Swift test mocking | Full WKWebView mock | Direct `BridgeManager` unit tests | Existing `BridgeManagerTests.swift` pattern works without mock WKWebView for state assertions |

---

## Common Pitfalls

### Pitfall 1: BATCH_SIZE Constant vs Constructor Parameter
**What goes wrong:** Changing the module-level `const BATCH_SIZE = 100` affects all production code paths.
**Why it happens:** The constant is not currently configurable.
**How to avoid:** Add an optional constructor parameter to `SQLiteWriter`: `constructor(private db: Database, private batchSize = 100)`. The production `ImportOrchestrator` continues to use the default. The benchmark instantiates `SQLiteWriter` with explicit sizes.
**Warning signs:** If changing `BATCH_SIZE` breaks existing test imports, the constant is being read from module scope.

### Pitfall 2: Memory Delta Noise from GC Timing
**What goes wrong:** `process.memoryUsage().heapUsed` can spike then drop as V8 GC runs asynchronously. Comparing two snapshots taken milliseconds apart shows noise, not signal.
**Why it happens:** V8 GC is not synchronized to `process.memoryUsage()` calls.
**How to avoid:** Take snapshots after allowing GC to settle: use `await new Promise(r => setTimeout(r, 100))` between import completion and snapshot. Compare across 3 cycles, not just before/after single import.
**Warning signs:** >50% variance between adjacent snapshots of the same steady state.

### Pitfall 3: WKWebView Configuration Immutability
**What goes wrong:** Moving WKWebView creation earlier (for warm-up) then trying to call `config.userContentController.add()` on an already-loaded page.
**Why it happens:** Some `WKWebViewConfiguration` properties are locked after `loadURL`. However, `userContentController.addUserScript()` CAN be called after creation but scripts added after `loadURL` only apply to future navigations.
**How to avoid:** Pre-create the `WKWebViewConfiguration` and register bridge handler + scripts before calling `loadURL`. The `setupWebView()` flow already does this correctly — replicate the same order when moving setup earlier.
**Warning signs:** Bridge handler not receiving messages after pre-warm refactor.

### Pitfall 4: process.memoryUsage() Does Not Reflect WASM Heap
**What goes wrong:** `heapUsed` measures V8 heap only. sql.js WASM allocates from a separate `ArrayBuffer` that does NOT appear in `heapUsed`. It appears in `rss` (resident set size).
**Why it happens:** WebAssembly linear memory is allocated via `WebAssembly.Memory` as a raw `ArrayBuffer`, outside V8 managed heap.
**How to avoid:** Report `rss` (not just `heapUsed`) as the primary memory metric. RSS = V8 heap + WASM linear memory + native overhead. At 20K cards, expect rss to reflect both the sql.js WASM runtime (~756KB loaded) and the in-memory SQLite database.
**Warning signs:** Seeing `heapUsed` flat across import while `rss` grows — that's correct behavior, not a bug.

### Pitfall 5: Delete-Reimport Cycle Fragmentation Is Expected, Not a Bug
**What goes wrong:** sql.js WASM heap (the SQLite page cache) grows after each import even if rows are deleted. SQLite's page reuse means the underlying memory allocation does NOT shrink on DELETE.
**Why it happens:** SQLite uses a B-tree page allocator; freed pages go to the freelist, not the OS. WASM linear memory never shrinks.
**How to avoid:** The 20% growth threshold is across 3 cycles starting from the FIRST import steady state, not from the pre-import baseline. A one-time allocation pattern (flat across cycles 1→2→3) is acceptable. Only monotonically increasing growth (each cycle larger than the last) indicates a true leak.
**Warning signs:** Cycle 3 heap > cycle 1 heap × 1.2 AND cycle 2 heap > cycle 1 heap × 1.1 (consistent trend, not noise).

### Pitfall 6: vitest `bench()` Empty Samples Bug
**What goes wrong:** `bench()` in vitest 4 with `pool: 'forks'` returns empty `samples` arrays in `--run` mode.
**Why it happens:** Known vitest v4 issue with `forks` pool (from Phase 74 decision log).
**How to avoid:** Use `it()` + `performance.now()` for all timing. The existing etl-smoke.bench.ts, budget.test.ts, and render-timing.test.ts all use this pattern correctly.
**Warning signs:** Zero throughput numbers or empty benchmark output.

---

## Code Examples

### ETL Batch Size Benchmark Structure
```typescript
// File: tests/profiling/etl-batch-size.test.ts
// Source: Pattern derived from tests/profiling/budget.test.ts + etl-smoke.bench.ts
import { afterAll, beforeAll, describe, it } from 'vitest';
import { Database } from '../../src/database/Database';
import { SQLiteWriter } from '../../src/etl/SQLiteWriter';

const BATCH_SIZES = [100, 500, 1000];

describe('ETL Batch Size Comparison (IMPT-01)', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
  }, 120_000);

  afterAll(() => db.close());

  for (const batchSize of BATCH_SIZES) {
    it(`json 20K @ batchSize=${batchSize}`, async () => {
      // Clean slate for each run
      db.run('DELETE FROM cards WHERE 1=1');
      const cards = generateCards(20_000); // shared generator
      const writer = new SQLiteWriter(db, batchSize); // requires constructor param
      const t0 = performance.now();
      await writer.writeCards(cards, true /* isBulkImport */);
      const elapsed = performance.now() - t0;
      const throughput = Math.round((20_000 / elapsed) * 1000);
      console.log(`batchSize=${batchSize}: ${elapsed.toFixed(0)}ms (${throughput} cards/s)`);
    }, 120_000);
  }
});
```

### Cold-Start PerfTrace Test
```typescript
// File: tests/profiling/cold-start.test.ts (new)
import { afterEach, beforeEach, it, describe } from 'vitest';
import { Database } from '../../src/database/Database';
import { clearTraces, getTraces } from '../../src/profiling/PerfTrace';

describe('Cold Start Decomposition (LNCH-01)', () => {
  it('measures WASM init, DB create, and schema apply independently', async () => {
    clearTraces();
    const db = new Database();
    await db.initialize(); // PerfTrace markers added inside initialize()

    const wasmInit = getTraces('db:wasm:init').at(0)?.duration ?? 0;
    const dbCreate = getTraces('db:instance:create').at(0)?.duration ?? 0;
    const schemaApply = getTraces('db:schema:apply').at(0)?.duration ?? 0;
    const total = wasmInit + dbCreate + schemaApply;

    console.log([
      `WASM init: ${wasmInit.toFixed(1)}ms`,
      `DB create: ${dbCreate.toFixed(1)}ms`,
      `Schema apply: ${schemaApply.toFixed(1)}ms`,
      `Total: ${total.toFixed(1)}ms`,
    ].join(' | '));

    db.close();
  }, 30_000);
});
```

### Heap Measurement Cycle Test
```typescript
// File: tests/profiling/heap-cycle.test.ts (new)
import { afterAll, beforeAll, it, describe, expect } from 'vitest';
import { Database } from '../../src/database/Database';
import { ImportOrchestrator } from '../../src/etl/ImportOrchestrator';

function snapshot(label: string) {
  const m = process.memoryUsage();
  const rss = (m.rss / 1e6).toFixed(1);
  const heapUsed = (m.heapUsed / 1e6).toFixed(1);
  console.log(`[${label}] rss=${rss}MB heapUsed=${heapUsed}MB`);
  return m.rss; // Use RSS as primary metric (captures WASM heap)
}

describe('WASM Heap Cycle Test (MMRY-01, MMRY-02)', () => {
  let db: Database;

  beforeAll(async () => {
    db = new Database();
    await db.initialize();
  }, 120_000);

  afterAll(() => db.close());

  it('3 import-delete-reimport cycles show no unbounded growth', async () => {
    const orch = new ImportOrchestrator(db);
    const cycleRss: number[] = [];

    snapshot('baseline');

    for (let cycle = 1; cycle <= 3; cycle++) {
      // Import
      await orch.import('json', genJSON(20_000));
      await new Promise(r => setTimeout(r, 200)); // GC settle
      const importRss = snapshot(`cycle-${cycle}-after-import`);

      // Delete
      db.run('DELETE FROM cards WHERE 1=1');
      await new Promise(r => setTimeout(r, 200));
      snapshot(`cycle-${cycle}-after-delete`);

      cycleRss.push(importRss);
    }

    // Assert: cycle 3 RSS not >20% above cycle 1 RSS
    const growth = (cycleRss[2]! - cycleRss[0]!) / cycleRss[0]!;
    console.log(`RSS growth across 3 cycles: ${(growth * 100).toFixed(1)}%`);
    expect(growth).toBeLessThan(0.20);
  }, 300_000);
});
```

### Swift Termination Test
```swift
// Addition to native/Isometry/IsometryTests/BridgeManagerTests.swift
@Test func webContentTermination_resetsReadyStateAndShowsOverlay() async {
  let bridgeManager = BridgeManager()

  // Manually set isJSReady to true (simulates post-launch state)
  // Note: isJSReady is private(set) — call didReceive with native:ready message
  let config = WKWebViewConfiguration()
  let webView = WKWebView(frame: .zero, configuration: config)
  bridgeManager.configure(webView: webView)

  // Simulate termination (the nonisolated func dispatches to @MainActor)
  bridgeManager.webViewWebContentProcessDidTerminate(webView)

  // Allow Task { @MainActor in ... } to execute
  try? await Task.sleep(nanoseconds: 100_000_000) // 0.1s

  #expect(bridgeManager.isJSReady == false, "isJSReady must be false after termination")
  #expect(bridgeManager.showingRecoveryOverlay == true, "Recovery overlay must be visible")
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|-----------------|-------|
| Measure WASM heap via Chrome DevTools | `process.memoryUsage().rss` in Node vitest | CI-friendly; WASM heap visible in RSS even without browser |
| vitest `bench()` for throughput | `it()` + `performance.now()` | vitest bench v4 empty-samples bug in forks pool (Phase 74 established) |
| Fixed `BATCH_SIZE = 100` constant | Constructor-injectable `batchSize` parameter | Allows benchmark parameterization without touching production constant until winner is confirmed |
| `setupWebView()` called in `.onAppear` | Pre-create config in app body, load URL on appear | WKWebView warm-up: WASM streaming compile begins during native splash |

**Known baseline (Phase 74 BOTTLENECKS.md):**
- json: 1,771ms total / 11,300 cards/s at 20K
- markdown: 1,059ms total / 18,900 cards/s at 20K
- csv: 767ms total / 26,000 cards/s at 20K
- apple_notes: 182ms total / 110,000 cards/s at 20K
- All under 2 seconds — optimization target is transaction overhead, not parser rewrites

---

## Open Questions

1. **Does SQLiteWriter.insertBatch() share the prepared statement across calls?**
   - What we know: Each `insertBatch()` call creates a new `db.prepare()` statement inside the `transaction()` closure.
   - What's unclear: Whether pre-preparing the statement once (outside the batch loop) would save measurable overhead at 1000-card batch sizes.
   - Recommendation: Measure first. If 500 or 1000 card batches are faster, the prepare overhead is already amortized. If not, consider caching the prepared statement as an instance variable.

2. **WKWebView pre-warm: does `WKWebViewConfiguration` allow `userContentController.addUserScript()` after WebView creation?**
   - What we know: Apple docs say the configuration is "copied" at WKWebView init time, but `userContentController` methods can still be called post-creation.
   - What's unclear: Whether scripts added after initial load apply to the current page vs only future navigations.
   - Recommendation: Keep existing `setupWebView()` setup order (add scripts → configure → load URL). Pre-warm by calling `setupWebView()` earlier in the lifecycle (from `IsometryApp` before `ContentView` appears), not by separating WKWebView creation from configuration.

3. **Is the 20% heap growth threshold realistic for sql.js page cache behavior?**
   - What we know: SQLite never returns freed pages to OS; WASM linear memory never shrinks. Some steady-state growth is expected on first import.
   - What's unclear: Whether 3 cycles at 20K cards will show flat post-cycle-1 behavior (expected) or continuing growth (leak indicator).
   - Recommendation: Run the cycle test. If growth is monotonic across all 3 cycles, investigate `db.exec()` result set retention or PerfTrace `performance.mark` accumulation (marks are retained indefinitely and accumulate memory). Call `clearTraces()` between cycles.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 (TypeScript) + Swift Testing (Swift) |
| Config file | `vitest.config.ts` (TS) / Xcode scheme (Swift) |
| Quick run command | `npx vitest run tests/profiling/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMPT-01 | 100 vs 500 vs 1000 batch throughput at 20K | timing/benchmark | `npx vitest run tests/profiling/etl-batch-size.test.ts` | ❌ Wave 0 |
| IMPT-02 | FTS stage timing (disable/rebuild/restore) isolated | timing/benchmark | `npx vitest run tests/profiling/etl-fts-timing.test.ts` | ❌ Wave 0 |
| IMPT-03 | All 4 parser throughputs at 20K re-measured | timing/benchmark | `npx vitest run tests/profiling/etl-smoke.bench.ts` | ✅ exists |
| LNCH-01 | WASM init / DB create / schema apply PerfTrace output | timing | `npx vitest run tests/profiling/cold-start.test.ts` | ❌ Wave 0 |
| LNCH-02 | WKWebView warm-up wired (no vitest assertion — code change) | integration | Manual verification / Xcode build | N/A |
| MMRY-01 | RSS + heapUsed at baseline, post-20K import, steady-state | timing/heap | `npx vitest run tests/profiling/heap-cycle.test.ts` | ❌ Wave 0 |
| MMRY-02 | 3 import-delete-reimport cycles, growth < 20% | regression | `npx vitest run tests/profiling/heap-cycle.test.ts` | ❌ Wave 0 |
| MMRY-03 | `webViewWebContentProcessDidTerminate` → `isJSReady=false` + overlay shown | integration | `xcodebuild test -scheme Isometry` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/profiling/`
- **Per wave merge:** `npx vitest run` (full TS suite) + `xcodebuild test` (Swift)
- **Phase gate:** All new profiling tests console-log documented numbers before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/profiling/etl-batch-size.test.ts` — covers IMPT-01 (batch comparison)
- [ ] `tests/profiling/etl-fts-timing.test.ts` — covers IMPT-02 (FTS stage isolation)
- [ ] `tests/profiling/cold-start.test.ts` — covers LNCH-01 (PerfTrace decomposition)
- [ ] `tests/profiling/heap-cycle.test.ts` — covers MMRY-01 + MMRY-02 (heap measurement + cycle)
- [ ] `BridgeManagerTests.swift` addition — covers MMRY-03 (termination recovery test)
- [ ] `SQLiteWriter.ts` constructor update — add optional `batchSize` param (prerequisite for IMPT-01)
- [ ] `Database.ts` PerfTrace additions — add `db:wasm:init`, `db:instance:create`, `db:schema:apply` spans (prerequisite for LNCH-01)
- [ ] `BridgeManager.swift` or `IsometryApp.swift` — WKWebView warm-up (LNCH-02 code change)

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `src/etl/SQLiteWriter.ts` — batch loop, FTS trigger pattern, BATCH_SIZE=100, BULK_THRESHOLD=500
- Direct code inspection: `src/profiling/PerfTrace.ts` — startTrace/endTrace/getTraces/clearTraces API
- Direct code inspection: `src/profiling/PerfBudget.ts` — existing constants, TODO Phase 77 launch/heap stubs
- Direct code inspection: `src/database/Database.ts` — initialize() WASM init path, applySchema() structure
- Direct code inspection: `native/…/BridgeManager.swift` — `webViewWebContentProcessDidTerminate` implementation, `showRecoveryOverlay()`, `isJSReady` flag
- Direct code inspection: `native/…/ContentView.swift` — `setupWebView()` call site in `.onAppear`, WKWebViewConfiguration setup order
- `.planning/phases/74-baseline-profiling-instrumentation/BOTTLENECKS.md` — Phase 74 measured baselines (confirmed data, not estimates)
- Decision log entries in STATE.md: "Never call db.close() + new SQL.Database() within an existing Worker lifetime", "vitest bench v4 forks pool returns empty samples in --run mode"
- `vitest.config.ts` — `pool: 'forks'`, `environment: 'node'`, `__PERF_INSTRUMENTATION__` define confirmed

### Secondary (MEDIUM confidence)
- Node.js `process.memoryUsage()` availability in vitest forks pool: established behavior; RSS captures WASM ArrayBuffer allocation outside V8 heap
- WKWebView `userContentController.addUserScript()` post-creation behavior: Apple documentation confirms scripts can be added after WKWebView init, but timing relative to page load affects applicability

### Tertiary (LOW confidence)
- WKWebView pre-warm timing benefit estimate: "significant fraction of cold start" — would require physical device measurement to quantify; logged as documentation-only

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools exist in codebase, verified by direct code inspection
- Architecture: HIGH — batch parameterization, PerfTrace markers, heap snapshot patterns all verified against existing code
- Pitfalls: HIGH — WASM heap fragmentation and vitest bench bug documented from Phase 74 decision log; GC timing noise is well-known Node.js behavior
- WKWebView warm-up: MEDIUM — approach is architecturally sound but exact timing benefit requires device measurement

**Research date:** 2026-03-12
**Valid until:** 2026-04-11 (stable technology stack, 30-day window)
