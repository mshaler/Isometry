# Phase 81 — Coordinator + Density Seams — CONTEXT

## Phase Goal
Filter and density changes propagate through a real StateCoordinator to trigger bridge re-queries with correct parameters.

## Requirements
- CORD-01: Filter change → coordinator → bridge re-query with updated params
- CORD-02: 3 rapid filter changes batch into exactly 1 bridge re-query
- CORD-03: After destroy(), no bridge re-queries fire
- DENS-01: hideEmpty and viewMode propagate through coordinator to bridge query params
- DENS-02: Density provider changes trigger re-query via coordinator (regression guard — GREEN on arrival)

---

## Decided: Bridge Query Verification Boundary

**Decision: Params object only — no full SQL string matching.**

Tests spy on `bridge.send()` (or equivalent message dispatch) and assert the payload's query params object contains the correct filter values and density flags. Tests do NOT match exact SQL strings — this avoids brittleness when SQL formatting or optimizer hints change.

**Spy target:** The coordinator callback triggers a bridge.send() call. The spy captures the message payload with query type and params. This is the natural interception point since it's the seam between the coordinator and the Worker.

**Rationale:** The existing `seam-coordinator-batch.test.ts` already validates coordinator batching mechanics. Phase 81 extends this by verifying *what* reaches the bridge, not just *that* it fires.

## Decided: Batching Count Strategy

**Decision: `vi.fn()` call count on the bridge spy, matching the existing coordinator test pattern.**

For CORD-02, the test:
1. Spies on bridge.send() with `vi.fn()`
2. Triggers 3 **different** filter values synchronously (e.g., `folder=['Film']`, then `['Film','Award']`, then `['Film','Award','Doc']`)
3. Flushes the coordinator cycle (microtasks + `vi.advanceTimersByTime(20)`)
4. Asserts `toHaveBeenCalledTimes(1)`
5. Inspects the single call's args to verify it contains the **final** filter state

**Change shape:** 3 distinct filter values — proves batching works even when state is actively changing between coalesced notifications.

## Decided: Destroy Teardown Scope

**Decision: No callbacks only — matches CORD-03 success criteria exactly.**

After `coordinator.destroy()`:
1. Trigger provider mutations (filter change, density change)
2. Flush all timers
3. Assert bridge spy NOT called

No need to verify timer counts or subscription set emptiness — the success criteria says "no bridge re-queries fire regardless of subsequent provider mutations." If callbacks don't fire, the requirement is met.

## Decided: Density Regression Guard Depth

**Decision: Smoke test — one test per density property.**

DENS-02 says "should be GREEN on arrival" meaning density→coordinator→bridge already works. The guard is:
- One test: `hideEmpty` change → coordinator fires → bridge params include `hideEmpty: true`
- One test: `viewMode` change → coordinator fires → bridge params include `viewMode: 'matrix'`

No exhaustive combos. These are regression guards, not feature tests.

---

## Code Context (from codebase scout)

### Existing Test Infrastructure (Phase 79)
- `tests/harness/realDb.ts` — real sql.js database factory
- `tests/harness/makeProviders.ts` — fully-wired ProviderStack (filter, pafv, density, selection, coordinator, schema)
- `tests/harness/seedCards.ts` — card data seeding
- `tests/integration/seam-coordinator-batch.test.ts` — existing coordinator batching tests (7 tests, pattern to follow)

### Key Provider Details
- `StateCoordinator` uses `setTimeout(16)` for batching (fires AFTER all microtasks drain)
- All providers use `queueMicrotask` for self-notify
- `flushCoordinatorCycle()` pattern: `await Promise.resolve() x2` + `vi.advanceTimersByTime(20)` + `await Promise.resolve()`
- `SuperDensityProvider` is registered with coordinator (unlike SuperPositionProvider)
- `FilterProvider.setAxisFilter()` sets per-axis filter values
- `SuperDensityProvider.setHideEmpty()`, `.setViewMode()`, `.setGranularity()` are the mutation methods

### Bridge Integration Point
- The coordinator `subscribe()` callback in production triggers `ViewManager._fetchAndRender()` which calls bridge.send()
- For seam tests, the spy replaces this callback — no need to instantiate ViewManager
- The spy should capture the provider state snapshot at callback time (call `filter.getActiveFilters()` and `density.getState()` inside the callback)

### File Placement
- New test file: `tests/seams/coordinator/coordinator-density.test.ts` (follows existing `tests/seams/` convention)

---

## Deferred Ideas
_(none captured)_
