# Pitfalls Research

**Domain:** Performance optimization for TypeScript/D3.js/sql.js WASM/SwiftUI app (v6.0 Performance milestone)
**Researched:** 2026-03-11
**Confidence:** HIGH — architecture is deeply known from 17 shipped milestones (73 phases); pitfalls derived from codebase decisions + verified community sources

---

## Critical Pitfalls

Mistakes that cause regressions, rewrites, or ship-blocking bugs during a performance optimization milestone.

---

### Pitfall 1: Optimizing Without Profiling Data (Amdahl's Law Violation)

**What goes wrong:**
A developer sees a perceived bottleneck — "SuperGrid renders slowly at 20K cards" — and jumps to optimize it without measurement. Three phases of work are spent on render-path improvements. The profiler, run afterward, shows the actual bottleneck was WASM checkpoint deserialization on cold start (90ms of a 100ms flow). The render improvement was 2ms. Net user experience improvement: near zero.

Amdahl's Law is mathematically unforgiving: the maximum speedup is bounded by the fraction of the system being parallelized. Optimizing a 10% subsystem to zero yields only 10% total improvement.

**Why it happens:**
The rAF coalescer, the virtualizer, the Worker bridge, and the SuperGrid render path are all architecturally interesting and invite tinkering. They feel performance-critical. But intuition about bottlenecks is wrong more often than right in multi-layer systems with WASM boundaries, IPC, and native bridges.

**How to avoid:**
The profiling phase must precede all optimization phases and must produce a ranked bottleneck list from numeric evidence. Required instruments before touching any code:
- Chrome DevTools Performance timeline on the 4 critical-path flows: cold start, import 500 cards, SuperGrid scroll at 20K cards, filter+render cycle
- `timing` field in `WorkerResponse` already exists — aggregate `timing.executed` per handler type to surface slow SQL queries
- Swift Instruments Time Profiler on the WKWebView bridge: `waitForLaunchPayload` → WASM init → first render
- `performance.mark()`/`performance.measure()` around known boundaries: `wasm-init`, `db-hydrate`, `first-query`, `first-render`

The profiling phase output is a single document: "ranked top 5 bottlenecks by total ms on the 20K-card critical path." Every subsequent optimization phase must cite a bottleneck from that list as its justification.

**Warning signs:**
- Optimization phase plan that does not reference a profiling measurement
- "This feels slow" as sole justification
- Improvements that pass unit tests but show no change in Chrome DevTools Performance timeline
- Phase plan that jumps from "profiling" to "render optimization" without a profiling results document gating entry

**Phase to address:**
Profiling phase — must be Phase 1 of v6.0. Its output gates all other phases.

---

### Pitfall 2: Breaking D3 Data Join Ownership in Render-Path Refactors

**What goes wrong:**
A developer adds a render cache: when data "looks the same," skip the D3 `.data(keyFn).join()` call to avoid diffing overhead. Or a selection is cached between render cycles to save the `selectAll` cost. The D3 data join becomes inconsistent with the DOM. Cell elements retain stale event listeners with captured closures over old data. The crosshair highlight, active cell focus ring, collapse state, and density mode all use `datum()` lookups — they now return wrong values silently.

This is the single highest-risk optimization for Isometry. The architecture is explicitly documented: **D3 data join IS state management** (D-001 through D-010, PROJECT.md). Any optimization that undermines join ownership of DOM state invalidates the entire state model.

**Why it happens:**
D3's `.data().join()` does real work even when data appears unchanged — it reconciles the key-function-keyed datum map with the live DOM. Compound SuperGrid keys (`\x1f`/`\x1e` separators in keys.ts), density modes, collapse state, and the gutterOffset pattern (0 or 1 applied to all gridColumn calculations) all depend on the join running cleanly every render cycle.

The `selectAll` scope problem compounds this: `selectAll` selects descendants, not just direct children. A cached selection may include elements from wrong scopes after collapse inserts aggregate cells into the DOM.

**How to avoid:**
- Never skip the `.data(keyFn).join()` call. Optimization happens in what you query and when you query — not whether you join.
- If render throughput is the bottleneck: reduce the number of cells entering the join (the virtualizer already does this). Do not skip the join.
- If transition overhead is the bottleneck: disable `.transition()` during scroll (already the established pattern). Do not cache selections.
- After any render-path change: run the full SuperGrid test suite covering lasso bounding box cache, active cell crosshair, density mode switching, collapse/expand, and gutterOffset.

**Warning signs:**
- Any `let cachedSelection` or `let cachedCells` variable that survives across render calls in SuperGrid
- `.data(d => d)` with no key function (index-based join silently reuses wrong elements)
- `selection.attr()` called outside a `.join()` callback on a cached selection
- "Click a cell → change density → click same cell" manual test shows wrong highlight

**Phase to address:**
Every render-path optimization phase. Establish a correctness baseline (screenshot + state diff) before and after every change.

---

### Pitfall 3: Over-Caching Worker Query Results Causing Stale State

**What goes wrong:**
A query result cache is added to the Worker (`Map<string, QueryResult>`) to avoid re-running expensive `GROUP BY` queries. A mutation happens — card update, filter change, import — the cache key is not invalidated, and stale results flow to the grid. SuperCalc footer rows show old aggregate values. LATCH histogram scrubbers show wrong bin distributions. The failure is completely silent: no error, just wrong numbers.

A related failure: caching a `Statement` object (`db.prepare()`) across message boundaries and calling it after a checkpoint restore or schema migration. The pointer is valid but the underlying table state has changed.

**Why it happens:**
The invalidation logic is the trap. The Worker receives messages from multiple paths: `db:query`, `db:mutate`, `db:exec`, `etl:import-native`, and CloudKit sync merges via `SyncMerger`. A cache keyed on SQL string will not be invalidated if the invalidation logic only hooks `db:mutate` but misses `etl:import-native` and sync merge. Import batches and CloudKit merges bypass MutationManager entirely.

**How to avoid:**
- Do not add a cross-request query result cache without wiring invalidation to ALL write paths: `db:mutate`, `db:exec`, `etl:import-native`, and the SyncMerger path.
- Prefer query optimization (covering indexes, prepared statement reuse within a single request) over cross-request caching.
- If caching is unavoidable, use a generation counter incremented on every write. Invalidate all cache entries when generation changes.
- Never cache a `Statement` object across Worker message boundaries. Prepare, execute, finalize within one handler invocation.

**Warning signs:**
- Module-level `Map` or `WeakMap` in any Worker handler storing query results
- Cache invalidation that only hooks `db:mutate` but not `etl:import-native`
- SuperCalc footer row value that does not update after an in-grid cell edit
- Histogram scrubbers not reflecting imported data after a batch import completes

**Phase to address:**
Any Worker-layer optimization phase. Every cache addition requires a mutation-then-query correctness test.

---

### Pitfall 4: postMessage Payload Growth Causing Frame Budget Violations

**What goes wrong:**
An optimization consolidates multiple Worker round-trips into one richer response (cell data + header data + aggregate data in one payload). The combined payload grows beyond 10KB — the safe boundary for staying within the 16ms RAIL animation budget per empirical measurement. Structured clone blocks both the Worker thread (serialization) and the main thread (deserialization), causing visible frame drops during scroll and user interaction.

The inverse failure also exists: adding result streaming from the Worker (posting partial results as they arrive) creates multiple rAF coalescing violations by triggering multiple D3 re-renders within one frame.

**Why it happens:**
The existing rAF coalescer prevents 4 provider callbacks from generating 4 Worker requests per frame (FOUN-11). But it cannot prevent a single large response from consuming the frame budget during deserialization. Response shape changes bypass the coalescer's protection.

**How to avoid:**
- Measure actual payload sizes: `JSON.stringify(response).length` in development builds before shipping any Worker handler shape change.
- Keep individual Worker responses under 10KB for latency-sensitive paths (scroll, filter, zoom). Aggregate-only responses (SuperCalc footer, histogram bin data) can be larger because they are not on the scroll critical path.
- Never introduce streaming partial responses from the Worker. The single-response-per-correlation-ID model is load-bearing for the rAF coalescer.
- Use transferable `ArrayBuffer` only for binary database content (checkpoints). For structured query results, structured clone is the correct and safe choice.

**Warning signs:**
- Chrome DevTools showing "Parse Message" or "Deserialize Message" taking >2ms on Worker message events during scroll
- SuperGrid scroll FPS dropping after a Worker response shape change with no DOM changes
- Any Worker handler calling `postMessage` twice for a single correlation ID

**Phase to address:**
Worker optimization phases. Every handler shape change requires a payload size measurement in the phase plan.

---

### Pitfall 5: WKWebView WebContent Process Termination Without Recovery

**What goes wrong:**
At large dataset scale (20K cards, large checkpoint blob), iOS terminates the WKWebView WebContent process under memory pressure. The `webViewWebContentProcessDidTerminate` delegate fires but the handler is not wired to checkpoint save + WebView reload. The app shows a blank screen. If the 30-second autosave has not fired recently, the user's last state is lost.

**Why it happens:**
WASM execution carries high memory overhead relative to native code. sql.js holds the entire database in the WASM linear memory heap. A 20K-card database with content fields, FTS5 indexes, and ui_state can grow to 50-100MB in WASM heap. On iOS, the WebContent process has a tighter memory budget than the main process and can be terminated independently.

The existing 200-card chunked import dispatch (v4.0) guards against OOM during large imports. But memory pressure from accumulated database growth over a session is a different failure mode — the autosave interval does not protect against mid-session termination.

**How to avoid:**
- Wire `webViewWebContentProcessDidTerminate` to trigger: (1) log the event, (2) reload the WebView using the last persisted checkpoint from disk, (3) restore Tier 2 state from ui_state.
- Add a memory pressure observer (`UIApplication.didReceiveMemoryWarningNotification` on iOS, `NSProcessInfo.thermalStateDidChange` on macOS) that triggers an early checkpoint write before the process terminates.
- Test this path on physical device under load: load 20K cards, use Memory Graph Debugger to simulate pressure, verify the blank-screen recovery path works and no data is lost.

**Warning signs:**
- No test coverage for `webViewWebContentProcessDidTerminate`
- Blank white screen reported on low-memory devices after extended use
- Autosave interval increased as "optimization" without adding memory-warning early-save
- `performance.memory.usedJSHeapSize` growing unboundedly in a long session (measure in WebKit via `window.performance.memory`)

**Phase to address:**
Memory pressure phase (native-side optimization). Must include explicit physical device testing.

---

### Pitfall 6: Benchmark Flakiness Rendering CI Performance Gates Meaningless

**What goes wrong:**
Performance benchmarks added to Vitest/tinybench in GitHub Actions CI produce results that vary 40-200% between runs due to CPU throttling, shared runner resources, and cold JIT state. A "performance regression gate" with absolute ms thresholds fires on green code and passes on regressed code depending on runner load. Teams stop trusting the gate and disable it. Regression protection disappears.

The project already documents this: "PLSH-01 adapted from 50x50 grid to 10x10 in jsdom (100x slower DOM ops)" — jsdom benchmarks are not representative of real browser rendering performance.

**Why it happens:**
GitHub Actions `ubuntu-latest` runners are 2-vCPU VMs competing with other jobs. JIT compilation state is cold on every run. tinybench requires hundreds of iterations for statistical confidence — incompatible with fast CI. The tinybench docs explicitly warn: "Concurrent benchmark tests would be very flaky; they should be executed in isolation from each other."

**How to avoid:**
- Separate benchmark tests from correctness tests. Correctness tests run in CI. Raw benchmarks run on developer machines only.
- Use **relative regression detection** instead of absolute thresholds: compare against a rolling baseline stored in the repo. Flag when median increases >20% compared to the last N runs (CodSpeed pattern).
- For CI performance gates, use **algorithmic complexity tests** (verify O(n) shape, not wall-clock ms): render 100 cells, render 1000 cells, assert the ratio is between 8x and 12x — not that it takes less than 50ms.
- Do not run D3/DOM rendering benchmarks in jsdom. jsdom DOM ops are ~100x slower than real browser execution and produce false baselines.
- The `timing` field in `WorkerResponse` can drive Worker-layer benchmarks without DOM involvement — these are more stable in CI than render benchmarks.

**Warning signs:**
- Benchmark test with hardcoded ms threshold (e.g., `expect(result.mean).toBeLessThan(50)`)
- CI benchmark job that fails intermittently without code changes
- D3/DOM rendering benchmarks running in jsdom
- No documented baseline for what "passing" means in benchmark terms

**Phase to address:**
Regression guard phase (final phase of v6.0). Must design relative baselines before writing benchmark assertions. Absolute thresholds are banned in CI.

---

### Pitfall 7: WASM Heap Fragmentation After Repeated Database Reconstructions

**What goes wrong:**
After a long session with repeated import-then-delete cycles, the WASM heap becomes fragmented. A large allocation — `new SQL.Database(checkpointData)` during hot reload, crash recovery, or sync restore — fails with "memory access out of bounds" even though total heap capacity appears sufficient. The failure is non-deterministic: it depends on allocation history, not current heap size.

This is a documented sql.js failure mode. From the AppSoftware engineering blog: a `resetCache()` injection into the sql.js bundle is required to fully discard and reload the WASM module when heap fragmentation is detected in long-running extension contexts.

**Why it happens:**
WASM linear memory is a flat array. `malloc`/`free` within WASM operate on this flat array without a compacting garbage collector. Repeated construction of the main `Database` object fragments the heap over time. The existing `DatabaseManager` actor's destroy-and-recreate pattern during crash recovery exacerbates this because it calls `db.close()` then `new SQL.Database(data)` within the same WASM module lifetime.

**How to avoid:**
- Do not destroy and recreate the WASM `Database` object within an existing Worker lifetime unless absolutely required. The current architecture (one `Database` instance per Worker lifetime) is correct and must be preserved.
- If an optimization requires re-initializing state (e.g., schema changes), perform a full Worker termination and relaunch — do not call `db.close()` + `new SQL.Database()` in-place.
- Add a session-length guard: if the Worker has been alive for more than 2 hours or has processed more than 1,000 mutations, trigger a full Worker restart at the next natural lifecycle event (app background).
- Test with 5+ consecutive import-then-delete cycles on 1K-card batches before shipping any import pipeline optimization.

**Warning signs:**
- "memory access out of bounds" errors in the Worker console that are non-deterministic
- Worker crashes after long sessions that do not reproduce on fresh launch
- Any optimization that creates ephemeral `new SQL.Database()` instances for staging or diffing
- Import pipeline rewrite that opens temporary in-memory databases

**Phase to address:**
Memory pressure phase and import optimization phase. The import pipeline must not create ephemeral `Database` instances.

---

### Pitfall 8: rAF Coalescer Bypass from New Render Trigger Paths

**What goes wrong:**
A performance optimization adds a "fast path": instead of routing through the full provider notification chain, a new code path calls `viewManager.render()` directly after a targeted state change (e.g., "only column widths changed, skip the Worker query"). The rAF coalescer — specifically built to prevent 4 simultaneous StateCoordinator callbacks from generating 4 Worker requests per frame (FOUN-11) — is bypassed. The optimization works for the targeted case but introduces multiple-renders-per-frame for compound state changes (axis reorder + density change happening simultaneously), causing visible stutter at exactly the moments users care about most.

**Why it happens:**
The rAF coalescer evolved from a specific fix for FOUN-11 and is not prominently labeled as a "do not bypass" contract in the codebase. The `_noNotifySet*` accessor pattern (used for `collapseState` and `colWidths`) is the correct approach for layout-only state, but new optimization work can introduce direct `render()` calls without recognizing the coalescer dependency.

**How to avoid:**
- All render triggers must go through the existing `StateCoordinator` → `_scheduleNotify` → rAF coalescer path.
- For layout-only state changes (no Worker re-query needed): use the established `_noNotifySet*` accessor pattern that updates state without calling `_scheduleNotify`.
- Never call `viewManager.render()` or `superGrid.render()` directly from provider setters.
- Add a development-mode assertion: increment a counter at the top of `render()`, assert at the end of the rAF callback that the counter is 1 — surfaces double-render from coalescer bypass during testing.

**Warning signs:**
- Direct `render()` calls outside the `_scheduleNotify` path in any provider or explorer
- Chrome DevTools Performance showing two render calls within the same 16ms frame for compound state changes
- New provider setter that updates DOM state directly without going through `_scheduleNotify`

**Phase to address:**
Every render-path optimization phase. The rAF coalescer is the load-bearing anti-jank mechanism — treat any change to the render dispatch path as high risk.

---

### Pitfall 9: Virtualizer Window Computation Separating from Render Entry

**What goes wrong:**
A "faster" virtualizer pre-computes the visible row window on data change (eagerly, ahead of the next render) instead of computing it synchronously at render entry. When a large import runs while the user is actively scrolling, the pre-computed window is stale by the time the D3 join consumes it. Rows that should be visible are missing. Rows that should be scrolled past render at wrong CSS Grid positions. The sentinel spacer height is wrong, causing the scrollbar to jump unpredictably.

**Why it happens:**
The existing pattern: compute the visible window from live `scrollTop` at the start of the render function. This correctly handles concurrent scroll events and data changes because it reads the actual scroll position at render time. Pre-computing the window creates a TOCTOU (time-of-check-time-of-use) race between data change and render entry.

The project decision is explicit: `Data windowing (not DOM virtualization) — Virtualizer filters rows before D3 join, preserving data join ownership` (v4.1 decision in PROJECT.md). The window computation is part of the join, not a separate pre-pass.

**How to avoid:**
- Window computation must happen synchronously at the start of the render function, reading `scrollTop` at that instant.
- Never separate window computation from render entry with async boundaries (no `onDataChange` pre-compute path).
- The sentinel spacer height must be computed from the full un-windowed data array length at render time, not from a cached window.
- Test: import 1K cards while the user actively scrolls. Verify no scroll position resets and no missing rows.

**Warning signs:**
- Any `_cachedVisibleWindow` or `_lastComputedWindow` variable set on data change and consumed at render time
- Sentinel spacer height that diverges from `totalRows * rowHeight`
- Scroll position resetting to top after import completion

**Phase to address:**
Render optimization phase. Any virtualizer change requires a concurrent scroll + import stress test.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip profiling, optimize "obvious" bottleneck | Faster to start | Phase wasted on non-bottleneck; user metrics don't improve | Never — profile first always |
| Absolute ms thresholds in CI benchmarks | Easy to write | Flaky CI, eroded trust, disabled gates | Never in CI; only on dedicated hardware with relative baselines |
| Cache Worker query results without full invalidation | Fewer SQL round-trips | Stale aggregate rows, wrong histograms — silent corruption | Never — use generation counter or avoid entirely |
| Direct `render()` call bypassing rAF coalescer | Targeted redraws for specific state | Double renders on compound state changes | Only for layout-only changes using established `_noNotifySet*` pattern |
| Destroy + recreate `Database` in Worker for "fresh state" | Appears clean | Heap fragmentation leading to OOM on next large allocation | Never in-session; Worker restart is the correct recovery |
| jsdom benchmarks for render performance | Easy to run in CI | 100x slower than real browser; false baselines | Never for render paths; use Playwright or algorithmic complexity tests |
| Optimize import speed without measuring checkpoint size | Faster import | Larger checkpoint → longer cold start; WKWebView memory pressure | Only if checkpoint size is measured and budgeted before shipping |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Worker `timing` field | Ignoring `timing` in `WorkerResponse` | Aggregate `timing.executed` per handler type to identify slow SQL before profiling in Chrome |
| WKWebView process termination | No handler for `webViewWebContentProcessDidTerminate` | Wire to immediate reload with last saved checkpoint; test on physical device |
| CloudKit sync merge + query cache | Cache not invalidated when SyncMerger inserts records | Any Worker-side cache must increment generation counter on ALL write paths including sync merge |
| SuperCalc parallel query | `supergrid:calc` firing simultaneously with `supergrid:query` | Both use correlation IDs and independent handlers; do not add shared Worker-side state between them |
| FTS5 trigger disable during bulk import | Re-enabling triggers on import completion path that can throw | Wrap `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` in try/catch with error toast |
| rAF coalescer + new provider | Adding a provider that emits `_scheduleNotify` | Verify it routes through `StateCoordinator` batching, not directly to `render()` |
| Checkpoint base64 transport | Making checkpoint transport async without flow control | Base64 blob must arrive before WASM init — `waitForLaunchPayload` gate is load-bearing; do not remove it |
| SchemaProvider after v5.3 | Treating dynamic field lists as performance invariant | Schema can change between sessions; any cached field list must re-validate on boot |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `getBoundingClientRect()` in scroll handler | Layout thrash, scroll jank, FPS drop | Bounding box cache (already in lasso selection — apply same pattern if scroll handler needs bounds) | Any scale if called per-scroll-event |
| `querySelectorAll` inside D3 `.join()` callback | O(N) DOM scan per cell per render | Use D3 selection scoping; never query the full document inside a join callback | 1K+ cells |
| FTS5 query on every keystroke | Worker queue backup, input lag | 300ms debounce already in SuperSearch — do not remove it in the name of "responsiveness" | 10K+ cards |
| Histogram bin query on every filter change | Worker queue saturation | Single `supergrid:latch-histogram` message per render cycle, not one per visible field | 5+ visible histogram fields |
| CSS `content-visibility: auto` used as only virtualization | First-scroll lag on iOS 17 | Keep the JS windowing fallback; do not rely on `content-visibility` alone (iOS 17 compatibility) | iOS 17 users (fallback only) |
| Checkpoint save on main thread | UI freeze during autosave | `DatabaseManager` actor already runs off main thread — do not move checkpoint save back to main | Any dataset size |
| D3 transitions during rapid state changes | Animation queue buildup, stacking visual artifacts | Call `selection.interrupt()` before starting new transitions during axis reorder or scroll | On rapid axis reorder |
| Large structured clone payload on scroll | Frame drops, "Deserialize Message" in DevTools | Keep scroll-critical Worker responses under 10KB; measure `JSON.stringify(response).length` | Payloads >10KB on 60fps paths |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Loading spinner on every Worker query | Flickering spinner on every filter click | Only show spinner when query takes >150ms (use a timeout-based reveal, not an immediate spinner) |
| Removing the virtualizer to "simplify" the render path | App freezes at 5K+ cards | Never remove the virtualizer; optimize the window computation algorithm if it is slow |
| Aggressive prefetch triggering unnecessary Worker queries | Battery drain, background jank | Only prefetch on idle via `requestIdleCallback`; never on every state change |
| Import progress bar resetting to 0 on each 200-card batch | Confusing progress jumps during large imports | Accumulate progress across chunks; never reset to 0 mid-import |
| Hiding performance improvements behind a settings toggle | Only power users benefit | Ship performance improvements unconditionally unless they change the interaction model |

---

## "Looks Done But Isn't" Checklist

- [ ] **Profiling phase output:** Has a ranked bottleneck list with `performance.measure()` data — not just "it feels faster now"
- [ ] **Worker query cache:** If added, invalidation fires on ALL write paths — `db:mutate`, `db:exec`, `etl:import-native`, CloudKit sync merge
- [ ] **Render path change:** D3 data join still called on every render with key function — no selection caching across render cycles
- [ ] **Benchmark CI gate:** Uses relative baseline, not absolute ms threshold; D3/DOM benchmarks not running in jsdom
- [ ] **WKWebView termination handler:** `webViewWebContentProcessDidTerminate` wired and tested on physical device under memory pressure
- [ ] **WASM heap:** No new `new SQL.Database()` calls within an existing Worker lifetime — Worker restart is the recovery pattern
- [ ] **rAF coalescer:** All new render triggers go through `_scheduleNotify`; no direct `render()` calls from provider setters
- [ ] **Virtualizer window:** Computed synchronously at render entry from live `scrollTop` — not cached across async boundaries
- [ ] **SuperCalc footer:** Aggregate values update correctly after an in-grid mutation (not served from stale cache)
- [ ] **Checkpoint size:** Measured before and after any import pipeline optimization that changes data volume

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Optimized the wrong thing (no profiling) | HIGH | Re-profile with instrumentation, discard optimization, re-plan with measured data |
| Broke D3 data join | HIGH | Revert render path change, restore key function, re-run full SuperGrid test suite + manual correctness baseline |
| Stale Worker query cache | MEDIUM | Add generation counter + invalidation to all write paths; add mutation-then-query correctness tests |
| Flaky CI benchmarks | LOW | Remove absolute thresholds; switch to relative baseline or remove from CI; add algorithmic complexity tests |
| WKWebView process termination (no handler) | HIGH | Implement `webViewWebContentProcessDidTerminate` + memory warning observer before next TestFlight build |
| rAF coalescer bypass | MEDIUM | Find direct `render()` call, route through `_scheduleNotify`, verify with DevTools Performance trace |
| WASM heap fragmentation | HIGH | Add Worker restart-on-long-session logic; audit all in-session `db.close()` + `new Database()` patterns |
| Virtualizer window race | MEDIUM | Move window computation back into render entry; add concurrent scroll + import stress test |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Optimizing the wrong thing | **Profiling phase (Phase 1)** | Ranked bottleneck list with measurement data required; gates all subsequent phases |
| Breaking D3 data join | **Every render-path optimization phase** | Full SuperGrid test suite + manual correctness baseline before and after each change |
| Stale Worker query cache | **Worker optimization phase** | Mutation-then-query correctness test for every cache added |
| postMessage payload growth | **Worker optimization phase** | `JSON.stringify(response).length` checked in dev build before merge |
| WKWebView process termination | **Memory pressure phase (native)** | Physical device test, not simulator |
| Benchmark flakiness | **Regression guard phase (final)** | Relative baseline design; no absolute ms thresholds in CI |
| WASM heap fragmentation | **Import + memory pressure phases** | 5x import-delete cycle test before merge |
| rAF coalescer bypass | **Any render-path phase** | DevTools Performance trace showing single render per compound state change |
| Virtualizer window race | **Render optimization phase** | Concurrent scroll + import stress test passes before merge |

---

## Sources

- [Is postMessage slow? — surma.dev](https://surma.dev/things/is-postmessage-slow/) — 10KB payload boundary, structured clone vs transferable performance data
- [D3 selection.data key function — d3/d3-selection GitHub Issue #108](https://github.com/d3/d3-selection/issues/108) — key function binding pitfalls, wrong exit group behavior
- [Benchmarking Support — vitest-dev/vitest Discussion #7850](https://github.com/vitest-dev/vitest/discussions/7850) — concurrent benchmark flakiness warning
- [Using Vitest bench to track performance regressions in CI — CodSpeed](https://codspeed.io/blog/vitest-bench-performance-regressions) — relative baseline approach for CI benchmarks
- [Debugging a SQLite WASM Heap Fragmentation Bug — AppSoftware](https://www.appsoftware.com/blog/debugging-a-sqlite-wasm-heap-fragmentation-bug-in-a-vs-code-extension) — WASM heap fragmentation failure mode + resetCache() recovery pattern
- [WKWebView memory issue causes crash — Apple Developer Forums](https://developer.apple.com/forums/thread/119550) — WebContent process termination behavior and memory budget constraints
- [Handling blank WKWebViews — nevermeant.dev](https://nevermeant.dev/handling-blank-wkwebviews/) — `webViewWebContentProcessDidTerminate` recovery pattern
- [Premature Optimization in TypeScript — softwarepatternslexicon.com](https://softwarepatternslexicon.com/patterns-ts/12/2/5/) — profile-before-optimize doctrine, measurement-first approach
- [Performance issue of massive transferable objects — joji.me](https://joji.me/en-us/blog/performance-issue-of-using-massive-transferable-objects-in-web-worker/) — structured clone vs transferable edge cases at scale
- Isometry PROJECT.md codebase — architectural decisions D-001..D-010, v4.1 data windowing decision, v3.0 rAF coalescer FOUN-11 fix, v4.0 200-card chunk limit, v4.1 virtualizer design

---
*Pitfalls research for: v6.0 Performance — adding optimization to existing TypeScript/D3.js/sql.js WASM/SwiftUI app*
*Researched: 2026-03-11*
