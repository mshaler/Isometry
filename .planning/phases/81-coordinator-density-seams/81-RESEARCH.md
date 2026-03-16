# Phase 81: Coordinator + Density Seams - Research

**Researched:** 2026-03-16
**Domain:** Vitest seam tests — StateCoordinator + bridge spy pattern
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Bridge Query Verification Boundary:** Params object only — no full SQL string matching. Tests spy on `bridge.send()` (or equivalent message dispatch) and assert the payload's query params object contains the correct filter values and density flags. Tests do NOT match exact SQL strings.

**Spy target:** The coordinator callback triggers a bridge.send() call. The spy captures the message payload with query type and params. This is the natural interception point since it's the seam between the coordinator and the Worker.

**Batching Count Strategy:** `vi.fn()` call count on the bridge spy, matching the existing coordinator test pattern. For CORD-02: spy on bridge.send() with `vi.fn()`, trigger 3 different filter values synchronously, flush coordinator cycle (microtasks + `vi.advanceTimersByTime(20)`), assert `toHaveBeenCalledTimes(1)`, inspect the single call's args for the final filter state.

**Destroy Teardown Scope:** No callbacks only — matches CORD-03 success criteria exactly. After `coordinator.destroy()`: trigger provider mutations, flush all timers, assert bridge spy NOT called. No need to verify timer counts or subscription set emptiness.

**Density Regression Guard Depth:** Smoke test — one test per density property. DENS-02: one test for `hideEmpty`, one for `viewMode`.

### Claude's Discretion

_(none captured)_

### Deferred Ideas (OUT OF SCOPE)

_(none captured)_
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORD-01 | Filter change propagates through real StateCoordinator to trigger bridge re-query with updated params | Coordinator subscribe() pattern established in seam-coordinator-batch.test.ts; spy captures filter.compile() output at callback time |
| CORD-02 | Rapid filter changes batch into exactly one re-query | flushCoordinatorCycle() with vi.advanceTimersByTime(20); toHaveBeenCalledTimes(1) assertion pattern |
| CORD-03 | View destroy prevents stale re-queries after teardown | coordinator.destroy() then provider mutations + timer flush; bridge spy NOT called |
| DENS-01 | hideEmpty and viewMode changes propagate through coordinator to bridge query params | SuperDensityProvider registered with coordinator; setHideEmpty()/setViewMode() trigger _scheduleNotify() which triggers coordinator |
| DENS-02 | Density provider changes trigger re-query via coordinator (regression guard — GREEN on arrival) | Smoke test: one test each for hideEmpty and viewMode propagation |
</phase_requirements>

---

## Summary

Phase 81 adds seam tests for the Coordinator → Bridge pathway. The test pattern is already established by `tests/integration/seam-coordinator-batch.test.ts` (7 tests, Phase 17). Phase 81 extends that pattern by verifying *what* reaches the bridge (params content), not just *that* the coordinator fires.

The key insight is that for seam tests, the bridge is replaced by a `vi.fn()` spy wired directly into `coordinator.subscribe()`. The callback captures provider state snapshots at call time using `filter.compile()` and `density.getState()`, then records those as the "bridge params." This avoids instantiating ViewManager or SuperGrid entirely.

The entire test infrastructure (realDb, makeProviders, seedCards, flushCoordinatorCycle) is pre-built from Phases 79-80. Phase 81 adds a single new test file at `tests/seams/coordinator/coordinator-density.test.ts`.

**Primary recommendation:** Follow the seam-coordinator-batch.test.ts pattern exactly. Wire a `vi.fn()` spy into coordinator.subscribe(), call provider mutations, flush with flushCoordinatorCycle(), then assert spy call count and captured params.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | (project version) | Test runner, fake timers, vi.fn() spy | Already in use across all seam tests |
| vi.useFakeTimers() | vitest built-in | Control setTimeout(16) coordinator timer | Required for deterministic async test control |
| vi.fn() | vitest built-in | Spy on bridge.send() / coordinator callback | Zero-overhead mock, captures call args |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| realDb | tests/harness/realDb.ts | In-memory sql.js DB | Required for makeProviders(); every beforeEach |
| makeProviders | tests/harness/makeProviders.ts | Wired ProviderStack factory | Provides filter, density, coordinator — all needed |
| seedCards | tests/harness/seedCards.ts | Deterministic card data | Optional for coordinator seams — may not need real data |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Wiring spy into coordinator.subscribe() | Instantiating SuperGrid with mock bridge | Coordinator subscribe() is simpler, avoids DOM setup, no need for container element |
| Full bridge.send() spy | superGridQuery() method spy | send() is lower-level; CONTEXT.md calls for params object verification which is the same either way |

**Installation:** No new packages needed. All dependencies are already in the project.

---

## Architecture Patterns

### Recommended Project Structure

```
tests/seams/
├── coordinator/
│   └── coordinator-density.test.ts   ← Phase 81 (new file)
├── filter/
│   ├── filter-sql.test.ts            ← Phase 80 (complete)
│   └── pafv-celldatum.test.ts        ← Phase 80 (complete)
├── etl/                              ← Phase 83
└── ui/                               ← Phase 82
```

### Pattern 1: Bridge Spy via Coordinator Subscribe

**What:** Wire a `vi.fn()` spy directly into `coordinator.subscribe()`. Inside the callback, snapshot current provider state and record it as the "bridge params." This replaces ViewManager without any DOM setup.

**When to use:** All 5 Phase 81 requirements. The spy IS the bridge — it captures what a real bridge would receive.

**Example (from CONTEXT.md decisions + existing batch test pattern):**
```typescript
// Source: tests/integration/seam-coordinator-batch.test.ts (established pattern)
const bridgeSpy = vi.fn();
coordinator.subscribe(() => {
  const { where, params } = filter.compile();
  const densityState = density.getState();
  bridgeSpy({ where, params, densityState });
});

filter.setAxisFilter('folder', ['Film']);
await flushCoordinatorCycle();

expect(bridgeSpy).toHaveBeenCalledTimes(1);
const call = bridgeSpy.mock.calls[0][0];
expect(call.where).toContain('folder');
expect(call.densityState.hideEmpty).toBe(false);
```

### Pattern 2: flushCoordinatorCycle() — Canonical Async Flush

**What:** Three-step flush for the coordinator's setTimeout(16) batching window. Copy verbatim from seam-coordinator-batch.test.ts.

**When to use:** After every synchronous mutation batch, before asserting spy call counts.

**Example (copy verbatim — confirmed working in 7 existing tests):**
```typescript
async function flushCoordinatorCycle(): Promise<void> {
  // Flush microtasks (provider self-notify via queueMicrotask)
  await Promise.resolve();
  await Promise.resolve();

  // Advance timers past the coordinator's 16ms setTimeout
  vi.advanceTimersByTime(20);

  // Flush any remaining microtasks from the coordinator callback
  await Promise.resolve();
}
```

### Pattern 3: CORD-02 Batching Verification (3 distinct filter values)

**What:** 3 synchronous filter mutations with *different* values each time — proves batching works even while state is actively changing between coalesced notifications.

**When to use:** CORD-02 only.

**Example:**
```typescript
// CORD-02: 3 rapid mutations → exactly 1 bridge re-query
filter.setAxisFilter('folder', ['Film']);
filter.setAxisFilter('folder', ['Film', 'Award']);
filter.setAxisFilter('folder', ['Film', 'Award', 'Doc']);

await flushCoordinatorCycle();

expect(bridgeSpy).toHaveBeenCalledTimes(1);
// Verify final state captured (not intermediate states)
const finalCall = bridgeSpy.mock.calls[0][0];
expect(finalCall.where).toContain('Film');
expect(finalCall.where).toContain('Award');
expect(finalCall.where).toContain('Doc');
```

### Pattern 4: CORD-03 Destroy Guard

**What:** Call `coordinator.destroy()`, then trigger provider mutations, flush timers, assert spy was never called.

**When to use:** CORD-03 only.

**Example:**
```typescript
// CORD-03: destroy() prevents stale re-queries
coordinator.destroy();

filter.setAxisFilter('folder', ['Film']);
density.setHideEmpty(true);

// Flush all possible timer windows
vi.advanceTimersByTime(100);
await Promise.resolve();
await Promise.resolve();

expect(bridgeSpy).not.toHaveBeenCalled();
```

### Pattern 5: DENS-01/DENS-02 Density Propagation

**What:** Set density properties and verify coordinator fires, bridgeSpy captures the density state snapshot. Since SuperDensityProvider IS registered with coordinator (unlike SuperPositionProvider), mutations propagate.

**When to use:** DENS-01, DENS-02.

**Example:**
```typescript
// DENS-01/DENS-02: density change → coordinator → bridge params
density.setHideEmpty(true);
await flushCoordinatorCycle();

expect(bridgeSpy).toHaveBeenCalledTimes(1);
const call = bridgeSpy.mock.calls[0][0];
expect(call.densityState.hideEmpty).toBe(true);
```

### Anti-Patterns to Avoid

- **Instantiating SuperGrid or ViewManager:** Not needed. The coordinator subscribe() callback IS the seam boundary. DOM + bridge scaffolding adds complexity without test value.
- **Matching exact SQL strings:** Locked decision — assert params object content only, never raw SQL.
- **Using `requestAnimationFrame` in tests:** WorkerBridge.superGridQuery() uses rAF coalescing, but seam tests bypass it entirely by spying on the coordinator callback. No rAF handling needed.
- **Forgetting `vi.useFakeTimers()` in beforeEach:** The coordinator uses `setTimeout(16)`. Without fake timers, `vi.advanceTimersByTime(20)` has no effect and `flushCoordinatorCycle()` will not trigger the callback.
- **Skipping `coordinator.destroy()` in afterEach:** Leaves subscriptions alive, can cause cross-test bleed. The existing batch test always destroys in afterEach.
- **Calling `vi.clearAllMocks()` without resetting spy:** Between tests in the same describe block, use `bridgeSpy.mockClear()` if sharing the spy across tests, or create a fresh `vi.fn()` in beforeEach.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Async coordinator flush | Custom delay/sleep | `flushCoordinatorCycle()` (copy from batch test) | Exact 3-step pattern already verified across 7 tests; any deviation risks false positives |
| Provider stack setup | Manual provider creation | `makeProviders(db)` | Correct init order (SchemaProvider → allowlist singleton → coordinator registration) is non-trivial; mistakes cause silent allowlist failures |
| In-memory DB | SQLite file or mock | `realDb()` | makeProviders requires a real Database instance for SchemaProvider PRAGMA initialization |
| Call count assertion | Manual counter | `toHaveBeenCalledTimes(N)` | vi.fn() provides this natively with full call history |

**Key insight:** The flushCoordinatorCycle() helper is the most critical piece of shared infrastructure — it's load-bearing because the coordinator's setTimeout(16) timing is exact. Any deviation (e.g., using `vi.runAllTimers()` instead) could flush timers that shouldn't fire yet in multi-step tests.

---

## Common Pitfalls

### Pitfall 1: Missing `vi.useFakeTimers()` in beforeEach

**What goes wrong:** `vi.advanceTimersByTime(20)` is a no-op when real timers are in use. The coordinator's setTimeout(16) never fires. Spy is never called. Test appears to pass (if asserting `not.toHaveBeenCalled()`) or hangs (if waiting for spy).

**Why it happens:** The existing seam tests (filter-sql, pafv-celldatum) don't need fake timers because they call handlers directly. The coordinator tests are the first to need timer control.

**How to avoid:** Always include `vi.useFakeTimers()` in beforeEach and `vi.useRealTimers()` in afterEach. The seam-coordinator-batch.test.ts does this correctly.

**Warning signs:** Tests pass when they should fail, or async tests resolve immediately.

### Pitfall 2: Spy Captures State at Subscribe Time, Not Mutation Time

**What goes wrong:** Capturing provider state OUTSIDE the coordinator callback (e.g., `const state = filter.compile(); coordinator.subscribe(() => bridgeSpy(state))`) produces stale snapshots — the state captured at subscribe time, not at callback time.

**Why it happens:** Provider state is mutable. The closure over a pre-captured value reads initial state, not post-mutation state.

**How to avoid:** Always call `filter.compile()` and `density.getState()` INSIDE the coordinator callback, not outside it. This matches the production pattern (SuperGrid._fetchAndRender() reads state fresh on each call).

**Warning signs:** CORD-02 batching test shows the first filter value instead of the last one.

### Pitfall 3: `setAxisFilter` is not the same as `addFilter`

**What goes wrong:** Using `filter.addFilter({ field: 'folder', operator: 'eq', value: 'Film' })` for CORD-02 rapid changes creates accumulating filter array entries, not replacing the previous value. The WHERE clause grows unbounded.

**Why it happens:** `addFilter()` appends to `_filters` array; `setAxisFilter()` is idempotent (replaces existing per-axis value).

**How to avoid:** Use `filter.setAxisFilter(field, values[])` for axis filter mutations (matches CONTEXT.md examples). Use `addFilter()` only for non-axis filter types.

**Warning signs:** CORD-02 WHERE clause contains 3 copies of the folder condition instead of 1.

### Pitfall 4: Not Awaiting `flushCoordinatorCycle()` Before Asserting

**What goes wrong:** Asserting spy call count synchronously (before awaiting the flush) — the coordinator hasn't fired yet, so `toHaveBeenCalledTimes(0)` passes spuriously.

**Why it happens:** The coordinator fires asynchronously (setTimeout(16) + microtasks). There's no synchronous signal that the batch is done.

**How to avoid:** Always `await flushCoordinatorCycle()` before any spy assertion. The 3-step await is not optional.

### Pitfall 5: Density Registration Assumption for hideEmpty/viewMode

**What goes wrong:** Assuming `density.setHideEmpty()` does NOT trigger coordinator (since comments in SuperDensityProvider say it's "client-side re-render, no re-query"). DENS-01 requires it to propagate.

**Why it happens:** The comment about "no Worker re-query" describes production behavior (SuperGrid._fetchAndRender skips re-query for hideEmpty changes). But the coordinator DOES still fire — it's the coordinator callback that decides whether to re-query.

**How to avoid:** The coordinator fires for ALL registered provider mutations. The seam test only verifies that the callback fires and captures the correct densityState — not that a Worker query actually happens. This is still a valid seam test.

---

## Code Examples

Verified patterns from codebase analysis:

### Full Test File Structure
```typescript
// Source: tests/integration/seam-coordinator-batch.test.ts (established pattern)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeProviders, type ProviderStack } from '../../harness/makeProviders';
import { realDb } from '../../harness/realDb';
import type { Database } from '../../../src/database/Database';

async function flushCoordinatorCycle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  vi.advanceTimersByTime(20);
  await Promise.resolve();
}

let db: Database;
let providers: ProviderStack;

beforeEach(async () => {
  vi.useFakeTimers();
  db = await realDb();
  providers = makeProviders(db);
});

afterEach(() => {
  providers.coordinator.destroy();
  db.close();
  vi.useRealTimers();
});
```

### CORD-01: Filter → Coordinator → Bridge Params
```typescript
it('filter change propagates to bridge with correct params', async () => {
  const { coordinator, filter, density } = providers;
  const bridgeSpy = vi.fn();

  coordinator.subscribe(() => {
    const compiled = filter.compile();
    bridgeSpy({ ...compiled, densityState: density.getState() });
  });

  filter.setAxisFilter('folder', ['Work']);
  await flushCoordinatorCycle();

  expect(bridgeSpy).toHaveBeenCalledTimes(1);
  const call = bridgeSpy.mock.calls[0][0] as { where: string; params: unknown[] };
  expect(call.where).toContain('folder');
  expect(call.params).toContain('Work');
});
```

### makeProviders() Return Shape
```typescript
// Source: tests/harness/makeProviders.ts
interface ProviderStack {
  filter: FilterProvider;
  pafv: PAFVProvider;
  density: SuperDensityProvider;
  selection: SelectionProvider;
  coordinator: StateCoordinator;
  schema: SchemaProvider;
}
```

### SuperDensityProvider Mutation Methods (confirmed from source)
```typescript
// Source: src/providers/SuperDensityProvider.ts
density.setHideEmpty(true);     // boolean
density.setViewMode('matrix');  // 'spreadsheet' | 'matrix'
density.setGranularity('month'); // TimeGranularity | null

// Read state
const state = density.getState();
state.hideEmpty   // boolean
state.viewMode    // ViewMode
state.axisGranularity  // TimeGranularity | null
```

### FilterProvider Axis Filter Methods (confirmed from source)
```typescript
// Source: src/providers/FilterProvider.ts
filter.setAxisFilter('folder', ['Film']);
filter.setAxisFilter('folder', ['Film', 'Award']);

// Read state
const { where, params } = filter.compile();
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ViewManager instantiation for integration tests | Coordinator subscribe() spy replacing ViewManager | Phase 79 (test harness design) | No DOM, no bridge setup, pure provider tests |
| Per-timer awaiting with sleep() | flushCoordinatorCycle() helper (3-step microtask+timer flush) | Phase 17 (seam-coordinator-batch) | Deterministic, documented, reusable |
| Full SQL string matching | Params object assertion only | Phase 81 CONTEXT.md decision | Tests survive SQL formatting changes and optimizer hints |

**Deprecated/outdated:**
- `requestAnimationFrame` coalescing in WorkerBridge.superGridQuery(): relevant in production but completely bypassed in seam tests. Never mock rAF — the spy approach eliminates the need.

---

## Open Questions

1. **Does seedCards need to be called for coordinator seam tests?**
   - What we know: CORD-01/02/03 and DENS-01/02 tests spy on filter.compile() and density.getState() — they do not execute actual SQL queries against the DB.
   - What's unclear: Whether `realDb()` is needed at all, or if makeProviders() could work with a minimal DB (it requires PRAGMA table_info to initialize SchemaProvider).
   - Recommendation: Call `realDb()` and `makeProviders(db)` in beforeEach as usual (established pattern, SchemaProvider PRAGMA is required). Skip `seedCards()` — no card data needed for coordinator seam tests.

2. **Should bridgeSpy be declared in beforeEach or inside each test?**
   - What we know: The batch test creates `vi.fn()` inside each test (fresh spy per test). This avoids `.mockClear()` calls.
   - Recommendation: Declare `vi.fn()` inside each test for fresh call history. Matches the existing pattern.

---

## Sources

### Primary (HIGH confidence)
- `tests/integration/seam-coordinator-batch.test.ts` — 7 existing coordinator tests, established flushCoordinatorCycle() pattern
- `tests/harness/makeProviders.ts` — ProviderStack factory, exact init order, SuperDensityProvider registration confirmed
- `src/providers/SuperDensityProvider.ts` — setHideEmpty(), setViewMode(), setGranularity() confirmed as mutation methods; SuperDensityProvider IS registered with coordinator (line 62 comment + makeProviders.ts line 100)
- `src/providers/FilterProvider.ts` — setAxisFilter(), addFilter(), compile() API confirmed
- `src/views/SuperGrid.ts` lines 1334, 1337, 1378-1391 — production _fetchAndRender() shows exactly what bridge.superGridQuery() receives (filter.compile() output + density.getState())
- `.planning/phases/81-coordinator-density-seams/81-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- `src/worker/WorkerBridge.ts` lines 377-401 — superGridQuery() uses rAF coalescing; confirmed that seam tests bypass this entirely via coordinator subscribe() pattern

### Tertiary (LOW confidence)
- None — all findings verified against codebase source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all tools confirmed in use across existing seam tests
- Architecture: HIGH — spy pattern directly derived from seam-coordinator-batch.test.ts + CONTEXT.md locked decisions
- Pitfalls: HIGH — most pitfalls derived from actual codebase analysis (setAxisFilter vs addFilter, state capture timing, fake timers requirement)

**Research date:** 2026-03-16
**Valid until:** Stable — no external dependencies; all findings are from project source code
