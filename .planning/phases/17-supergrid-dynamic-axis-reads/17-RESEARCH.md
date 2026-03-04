# Phase 17: SuperGrid Dynamic Axis Reads - Research

**Researched:** 2026-03-04
**Domain:** TypeScript view wiring — PAFVProvider subscription, WorkerBridge.superGridQuery(), D3 data join
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Loading transition**
- Keep stale data during the async gap between axis change and Worker response — no spinner, no dim, no skeleton overlay
- No fallback indicator if Worker takes longer than expected — trust the Worker to be fast
- Only the final result renders when multiple rapid axis changes occur — leverage existing rAF coalescing in WorkerBridge.superGridQuery()
- No animation on axis change in this phase — Phase 18 (SuperDynamic) owns the 300ms D3 transition for drag-based axis transpose

**Cell rendering**
- Count badge only — same as current SuperGrid behavior. Phase 22 (SuperDensity) handles spreadsheet vs matrix display modes
- IView.render(cards) signature preserved for interface compliance, but SuperGrid internally calls bridge.superGridQuery() and ignores the cards parameter
- D3 data join key function matches Worker output dynamically — if colAxes = [card_type, priority], key includes all axis fields plus row keys. Forward-compatible with multi-level stacked axes
- If axes have empty arrays, fall back to VIEW_DEFAULTS for supergrid (card_type/folder) as safety net

**Error & empty states**
- Zero results: show empty grid skeleton — headers from PAFVProvider axes are visible, but no data cells. User retains axis context
- Worker errors (e.g., SQL safety violation): show error message inline in the grid area. Do not silently swallow errors
- Errors are auto-recoverable — any subsequent axis change triggers a new Worker query. If new axes are valid, the error clears itself. No manual retry button needed

**Initial mount & subscription**
- SuperGrid fires bridge.superGridQuery() immediately on mount() — reads PAFVProvider state and queries Worker without waiting for ViewManager render(cards) call. Fastest perceived load
- Constructor injection: `new SuperGrid(provider, bridge)` — explicit dependencies, testable. Constructor signature changes from zero-arg (SuperGrid is special among IView implementations)
- SuperGrid stores its StateCoordinator unsubscribe function and calls it in destroy() — owns its own subscription lifecycle
- Subscribe through StateCoordinator (not directly to PAFVProvider) — gets 16ms batch deduplication for free (FOUN-11)

### Claude's Discretion
- Card ID storage strategy — whether to store Worker-returned card_ids[] on DOM data attributes or in an internal Map<cellKey, string[]>
- Internal render method naming and flow (private method structure)
- Error message formatting and styling
- How to handle the render(cards) no-op gracefully (early return vs. trigger internal flow)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-08 | SuperGrid reads stacked axes from PAFVProvider dynamically instead of hardcoded DEFAULT_COL_FIELD/DEFAULT_ROW_FIELD | PAFVProvider.getStackedGroupBySQL() already exists and returns {colAxes, rowAxes} with validation. SuperGrid constructor receives the provider instance. |
| FOUN-09 | SuperGrid fetches grouped cell data via bridge.superGridQuery() instead of in-memory card filtering | WorkerBridge.superGridQuery(config) already exists with rAF coalescing. Config shape is SuperGridQueryConfig: {colAxes, rowAxes, where, params}. Worker returns CellDatum[]. |
| FOUN-10 | SuperGrid re-renders on PAFVProvider state changes via subscription | StateCoordinator.subscribe() returns unsub function. SuperGrid subscribes in mount(), unsubscribes in destroy(). Callback fires ~16ms after any registered provider changes. |
| FOUN-11 | Multiple provider changes within one StateCoordinator 16ms batch produce exactly one superGridQuery() call | StateCoordinator already deduplicates to one callback per setTimeout(16) window. WorkerBridge.superGridQuery() further deduplicates within one rAF frame. Two-layer dedup: coordinator (16ms) + rAF (one frame). |
</phase_requirements>

---

## Summary

Phase 17 replaces SuperGrid's in-memory card filtering with live PAFVProvider reads and Worker queries. All the infrastructure exists from Phases 15 and 16 — this phase is pure wiring. The SuperGrid constructor gains two required dependencies (PAFVProvider and WorkerBridge), and the render pipeline shifts from `cards.filter(...)` to `bridge.superGridQuery(config).then(cells => render(cells))`.

The biggest change is the subscription pattern. SuperGrid must subscribe to StateCoordinator in mount() and call the unsubscribe function in destroy(). The callback fires `bridge.superGridQuery()`, which already has rAF coalescing, so FOUN-11 is automatically satisfied by the existing WorkerBridge implementation. No additional deduplication logic is needed in SuperGrid itself.

The D3 data join key function is the only subtle point. Currently it's `d => d.rowKey + ':' + d.colKey`. For multi-level axes (e.g., colAxes = [card_type, priority]), CellDatum rows contain dynamic column names from the GROUP BY. The key function must include all axis values. The CONTEXT.md decision is forward-compatible: key includes all axis field values plus row keys, composed from the actual axes config at render time.

**Primary recommendation:** Wire constructor injection → mount subscription → render pipeline in that order. The test strategy follows the same pattern as WorkerBridge-supergrid.test.ts: mock PAFVProvider and WorkerBridge as plain objects, test subscription wiring with a mock StateCoordinator, and verify the D3 data join key function with DOM assertions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | Implementation language | Project standard (D-001) |
| D3.js | v7.9 | Data join for cell rendering | Project standard (D-009) |
| Vitest | 4.0 | Test runner | Project standard |
| jsdom | via Vitest | DOM simulation for view tests | Required for D3 DOM tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FilterProvider | internal | Supplies WHERE clause for supergrid:query | SuperGrid needs filter context for queries |
| PAFVProvider | internal | Supplies colAxes/rowAxes | Primary axis source for SuperGrid |
| StateCoordinator | internal | Batched subscription | Subscribe here, not directly to PAFVProvider |
| WorkerBridge | internal | superGridQuery() RPC | All database work happens off main thread |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| StateCoordinator subscription | Direct PAFVProvider.subscribe() | Loses 16ms batch dedup; multiple providers changing simultaneously would trigger multiple queries |
| WorkerBridge.superGridQuery() | bridge.send('supergrid:query', ...) directly | Loses rAF coalescing; would require hand-rolling FOUN-11 in SuperGrid |

**Installation:** No new packages needed.

---

## Architecture Patterns

### Recommended Project Structure
```
src/views/
├── SuperGrid.ts         ← Constructor injection, lifecycle, subscription
└── supergrid/
    ├── SuperGridQuery.ts    ← Already exists — buildSuperGridQuery()
    └── SuperStackHeader.ts  ← Already exists — buildHeaderCells()

tests/views/
└── SuperGrid.test.ts    ← Extend with Phase 17 tests (new describe blocks)
```

### Pattern 1: Constructor Injection

SuperGrid constructor changes from zero-arg to accepting provider + bridge. This is the only IView implementation with constructor arguments — all others are zero-arg per ViewManager.switchTo() factory pattern.

```typescript
// Source: CONTEXT.md locked decision + main.ts factory pattern
export class SuperGrid implements IView {
  private readonly provider: PAFVProviderLike;   // new interface — see below
  private readonly bridge: SuperGridBridgeLike;  // new interface — see below
  private coordinatorUnsub: (() => void) | null = null;

  constructor(provider: PAFVProviderLike, bridge: SuperGridBridgeLike) {
    this.provider = provider;
    this.bridge = bridge;
  }
}
```

**ViewManager wiring in main.ts must update:**
```typescript
// Current (Phase 16 and earlier)
supergrid: () => new SuperGrid(),

// Phase 17: pass provider + bridge
supergrid: () => new SuperGrid(pafv, bridge),
```

### Pattern 2: SuperGridBridgeLike Interface

WorkerBridgeLike in types.ts currently only has `send()`. SuperGrid needs `superGridQuery()`. Do NOT widen WorkerBridgeLike to include it globally — create a dedicated interface in SuperGrid.ts (or views/types.ts).

```typescript
// Narrow interface for testability — SuperGrid only needs superGridQuery
export interface SuperGridBridgeLike {
  superGridQuery(config: SuperGridQueryConfig): Promise<CellDatum[]>;
}

// WorkerBridge satisfies this interface (structural typing)
```

**Note:** Similarly, PAFVProviderLike must be extended or a new interface created for SuperGrid's needs:
```typescript
export interface SuperGridProviderLike {
  getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] };
  subscribe(cb: () => void): () => void;
  getState(): Readonly<{ viewType: string; colAxes: AxisMapping[]; rowAxes: AxisMapping[] }>;
}
```

However, the CONTEXT.md says SuperGrid subscribes through StateCoordinator, not directly to PAFVProvider. So the provider interface only needs `getStackedGroupBySQL()` (to read axes at query time). The subscription wire goes through StateCoordinator, which is passed separately or already registered.

**Resolution:** SuperGrid needs PAFVProvider for axis reads and StateCoordinator for subscription. The mount() signature is unchanged — StateCoordinator is already a registered dependency of ViewManager and SuperGrid subscribes to it in mount().

### Pattern 3: mount() Lifecycle — Subscribe + Immediate Query

```typescript
// Source: CONTEXT.md locked decisions
mount(container: HTMLElement): void {
  // Create DOM structure (existing behavior unchanged)
  const root = document.createElement('div');
  // ...
  this.rootEl = root;
  this.gridEl = grid;

  // Subscribe to StateCoordinator for axis change notifications
  // NOTE: SuperGrid must receive coordinator as constructor arg or
  // ViewManager must pass it via a different mechanism.
  // See "Integration Point" section below for wiring analysis.
  this.coordinatorUnsub = coordinator.subscribe(() => {
    void this._fetchAndRender();
  });

  // Immediate query on mount — don't wait for render(cards) call
  void this._fetchAndRender();
}
```

**CRITICAL INTEGRATION QUESTION:** How does SuperGrid get the StateCoordinator reference?

Options:
1. Add `coordinator` to the SuperGrid constructor: `new SuperGrid(provider, bridge, coordinator)`
2. Call `mount(container, coordinator)` with extended signature — breaks IView interface
3. Pass coordinator via constructor config object: `new SuperGrid({ provider, bridge, coordinator })`

The CONTEXT.md locks `new SuperGrid(provider, bridge)`. But the CONTEXT.md also says "SuperGrid subscribes through StateCoordinator". This means either coordinator is a third constructor arg, or SuperGrid subscribes directly to PAFVProvider (which also fires ~0ms batched via queueMicrotask) and relies on WorkerBridge rAF coalescing for FOUN-11.

**Research conclusion:** The most consistent interpretation of CONTEXT.md is that StateCoordinator is the third constructor arg, making the signature `new SuperGrid(provider, bridge, coordinator)`. This matches the "explicit dependencies, testable" principle stated in CONTEXT.md. The `ViewManager` already has all three as instance variables and can pass them in `main.ts`.

### Pattern 4: _fetchAndRender() — The Core Render Pipeline

```typescript
private async _fetchAndRender(): Promise<void> {
  // 1. Read current axes from PAFVProvider
  const { colAxes, rowAxes } = this.provider.getStackedGroupBySQL();

  // 2. Fall back to VIEW_DEFAULTS if axes are empty (safety net)
  const effectiveColAxes = colAxes.length > 0
    ? colAxes
    : [{ field: 'card_type' as const, direction: 'asc' as const }];
  const effectiveRowAxes = rowAxes.length > 0
    ? rowAxes
    : [{ field: 'folder' as const, direction: 'asc' as const }];

  // 3. Compile filter WHERE clause (from FilterProvider via QueryBuilder or direct)
  // NOTE: SuperGrid needs access to filter WHERE — see "Filter Integration" section
  const { where, params } = this.filter.compile();

  // 4. Query Worker — rAF coalescing already built in
  try {
    const cells = await this.bridge.superGridQuery({
      colAxes: effectiveColAxes,
      rowAxes: effectiveRowAxes,
      where,
      params,
    });
    this._renderCells(cells, effectiveColAxes, effectiveRowAxes);
  } catch (err) {
    this._showError(err instanceof Error ? err.message : String(err));
  }
}
```

**Filter Integration Question:** Does SuperGrid need FilterProvider access?

The `supergrid:query` payload requires `{ colAxes, rowAxes, where, params }`. The `where` and `params` come from FilterProvider.compile(). Without them, SuperGrid ignores active user filters — which would be incorrect.

Options:
1. Pass FilterProvider as 4th constructor arg
2. Pass a compiled `{ where, params }` snapshot from ViewManager on each render() call
3. Expose a `getCompiledFilter()` on FilterProvider through a new interface

The CONTEXT.md doesn't address this explicitly. However, looking at the current ViewManager._fetchAndRender(), it uses `queryBuilder.buildCardQuery()` which internally calls `filter.compile()`. For SuperGrid to respect filters, it needs FilterProvider.

**Research conclusion:** FilterProvider (or a FilterLike interface) should be the 4th constructor arg. The alternative of passing compiled filter via render(cards) would break the IView.render(cards) contract change (which CONTEXT.md wants to keep as no-op). The cleanest approach: `new SuperGrid(provider, filter, bridge, coordinator)`.

### Pattern 5: D3 Data Join Key Function with Dynamic Axes

The existing key function `d => d.rowKey + ':' + d.colKey` works for single-level axes. For multi-level axes where CellDatum has dynamic field keys (e.g., `{ card_type: 'note', folder: 'Inbox', count: 2, card_ids: [...] }`), the key must incorporate all axis values.

```typescript
// Dynamic key function — builds key from all axis field values
function makeCellKey(d: CellDatum, colAxes: AxisMapping[], rowAxes: AxisMapping[]): string {
  const colPart = colAxes.map(ax => String(d[ax.field] ?? '')).join('|');
  const rowPart = rowAxes.map(ax => String(d[ax.field] ?? '')).join('|');
  return `col:${colPart}::row:${rowPart}`;
}

// In D3 join:
gridSelection
  .selectAll<HTMLDivElement, CellDatum>('.data-cell')
  .data(cellData, d => makeCellKey(d, colAxes, rowAxes))
  .join(...)
```

**Forward compatibility:** When Phase 18 adds multi-level stacked axes (e.g., colAxes = [card_type, priority]), this key function correctly generates unique keys like `col:note|high::row:Inbox`.

### Pattern 6: Cell Positioning with Worker Results

The Worker returns CellDatum[] where each row has axis field values as dynamic keys:
```
{ card_type: 'note', folder: 'Inbox', count: 2, card_ids: ['a', 'b'] }
{ card_type: 'task', folder: 'Archive', count: 1, card_ids: ['c'] }
```

SuperGrid must derive the unique column values and row values from these results to construct the header axis tuples, then compute grid positions:

```typescript
// Derive col axis value tuples from cells
const colValueTuples = uniqueByKey(
  cells.map(cell => colAxes.map(ax => String(cell[ax.field] ?? ''))),
  tuple => tuple.join('|')
);
// → [['note'], ['task']] for single-level

// Derive row axis value tuples
const rowValueTuples = uniqueByKey(
  cells.map(cell => rowAxes.map(ax => String(cell[ax.field] ?? ''))),
  tuple => tuple.join('|')
);
// → [['Inbox'], ['Archive']]

// Feed into existing buildHeaderCells() — unchanged API
const { headers: colHeaders, leafCount: colLeafCount } = buildHeaderCells(colValueTuples, this.collapsedSet);
const { headers: rowHeaders, leafCount: rowLeafCount } = buildHeaderCells(rowValueTuples, this.collapsedSet);
```

**Important:** The Worker returns only cells with `count > 0`. Empty intersections (zero count) are NOT returned by the GROUP BY query. SuperGrid must generate empty cells for all axis value combinations that have no Worker result. This is the same dimensional integrity requirement as before, but now computed from query results rather than card arrays.

```typescript
// Generate full cell matrix from header values × Worker results
const cellMap = new Map<string, CellDatum>();
for (const cell of cells) {
  const key = makeCellKey(cell, colAxes, rowAxes);
  cellMap.set(key, cell);
}

// Build full cellData including empty intersections
const cellData: CellDatum[] = [];
for (const rowTuple of uniqueRowTuples) {
  for (const colTuple of uniqueColTuples) {
    const syntheticKey = `col:${colTuple.join('|')}::row:${rowTuple.join('|')}`;
    const existing = cellMap.get(syntheticKey);
    if (existing) {
      cellData.push(existing);
    } else {
      // Synthetic empty cell — count 0, card_ids []
      const emptyCell: CellDatum = { count: 0, card_ids: [] };
      for (let i = 0; i < colAxes.length; i++) {
        emptyCell[colAxes[i]!.field] = colTuple[i];
      }
      for (let i = 0; i < rowAxes.length; i++) {
        emptyCell[rowAxes[i]!.field] = rowTuple[i];
      }
      cellData.push(emptyCell);
    }
  }
}
```

### Pattern 7: Card ID Storage (Claude's Discretion)

Phase 21 (SuperSelect) will need `card_ids[]` per cell. Two options:

1. **DOM data attributes**: `el.dataset['cardIds'] = JSON.stringify(d.card_ids)` — serialization cost, max ~64KB URL-length limit on data attributes (impractical for 1000+ IDs)
2. **Internal Map<cellKey, string[]>**: `this._cellCardIds.set(key, d.card_ids)` — O(1) lookup, no serialization, survives re-renders via D3 update callback

**Recommendation:** Use `Map<string, string[]>` keyed by the same cell key used in the D3 join. This avoids DOM attribute limits and integrates cleanly with Phase 21's selection needs. The map is populated in the D3 join `.each()` callback and cleared in destroy().

### Anti-Patterns to Avoid

- **Direct PAFVProvider.subscribe()**: Always subscribe via StateCoordinator — direct subscription bypasses 16ms batch deduplication, causing N Worker queries when N providers change simultaneously
- **Rendering in render(cards)**: The `render(cards)` method must be a no-op (early return). Triggering internal `_fetchAndRender()` from render() would cause double-query on view switch (ViewManager calls render() after mount())
- **Re-querying on every collapsedSet toggle**: Header collapse is a local UI change, not an axis change. Toggle collapse should re-render from the last received CellDatum[], not re-query the Worker
- **Dynamic SQL in key function**: The D3 key function must use pure JS string concatenation — never construct SQL in the render path

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| rAF coalescing for FOUN-11 | Custom debounce/throttle in SuperGrid | WorkerBridge.superGridQuery() rAF coalescing | Already implemented, tested, and spec'd in Phase 16 |
| 16ms batch dedup for FOUN-11 | Custom setTimeout in SuperGrid | StateCoordinator.subscribe() | Already implemented, tested, and registered for all providers |
| SQL GROUP BY query building | Custom GROUP BY SQL in SuperGrid | buildSuperGridQuery() via WorkerBridge.superGridQuery() | Already implements allowlist validation, parameterization |
| Header cell spanning computation | Custom span algorithm | buildHeaderCells() from SuperStackHeader.ts | Already handles multi-level, collapse, cardinality guard |
| CSS Grid template computation | Custom template string builder | buildGridTemplateColumns() | Already works correctly |
| Axis field validation | Custom allowlist | validateAxisField() from allowlist.ts | Handles SQL safety violation error path |

---

## Common Pitfalls

### Pitfall 1: Double Query on View Switch

**What goes wrong:** ViewManager calls `mount()` then `render(cards)` in sequence. If render() triggers `_fetchAndRender()`, the Worker gets two queries on every view switch.

**Why it happens:** ViewManager treats render() as a data update. SuperGrid now self-manages its data, but ViewManager doesn't know this.

**How to avoid:** `render(cards)` must be an early-return no-op:
```typescript
render(_cards: CardDatum[]): void {
  // SuperGrid fetches its own data via bridge.superGridQuery() on mount and StateCoordinator changes.
  // The cards parameter is ignored — required by IView interface.
  return;
}
```

**Warning signs:** Tests see two Worker postMessages on mount() + render() combination.

### Pitfall 2: Subscription Leak on View Destroy

**What goes wrong:** SuperGrid subscribes to StateCoordinator in mount() but doesn't unsubscribe in destroy(). Stale callbacks fire after the view is destroyed, causing `Cannot read properties of null` errors on `this.gridEl`.

**Why it happens:** Forgetting to call `this.coordinatorUnsub?.()` in destroy().

**How to avoid:**
```typescript
destroy(): void {
  // Unsubscribe before clearing refs
  if (this.coordinatorUnsub !== null) {
    this.coordinatorUnsub();
    this.coordinatorUnsub = null;
  }
  // Clear card IDs map
  this._cellCardIds.clear();
  // Remove DOM
  if (this.rootEl && this.rootEl.parentElement) {
    this.rootEl.parentElement.removeChild(this.rootEl);
  }
  this.rootEl = null;
  this.gridEl = null;
  this.collapsedSet = new Set();
}
```

**Warning signs:** Tests see callbacks firing after destroy().

### Pitfall 3: Empty Grid on Zero Worker Results

**What goes wrong:** Worker returns `{ cells: [] }` when all axes are empty or no cards exist. SuperGrid renders nothing and clears the DOM, losing header context.

**Why it happens:** The GROUP BY query with empty axes returns a single total-count row (per Phase 16 decision). But if axes are provided and no cards match the filter, `cells` is genuinely empty.

**How to avoid:** When `cells.length === 0`, still render headers from PAFVProvider axes (zero-value headers with no data rows). The axis values come from PAFVProvider, not from the cells themselves in this case. Only fall back to VIEW_DEFAULTS if the axes arrays are empty too.

**Warning signs:** Empty filter leaves a blank grid with no headers.

### Pitfall 4: Stale CellDatum in Collapse Toggle

**What goes wrong:** User collapses a header. SuperGrid re-queries the Worker unnecessarily, causing a flicker.

**Why it happens:** `createColHeaderCell()` click handler calls `this.render(this.lastCards)` — but in Phase 17, `lastCards` is empty (render is a no-op). After refactor, the collapse toggle must call a re-render from cached cells, not re-query.

**How to avoid:** Store `this._lastCells: CellDatum[]` and the effective axes. The collapse click handler calls `this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes)` without re-querying.

**Warning signs:** DevTools Network tab shows a Worker postMessage on header click.

### Pitfall 5: CellDatum[any] Index Signature and TypeScript Strict Mode

**What goes wrong:** `CellDatum` has index signature `[key: string]: unknown`. Accessing `cell[ax.field]` compiles, but TypeScript strict mode may complain about the `AxisField` string not being a known key.

**Why it happens:** `AxisField` is a union of string literals. TypeScript knows the key is valid at compile time only if it comes from `AxisField`, not `string`.

**How to avoid:** Cast `ax.field as string` when indexing into CellDatum:
```typescript
const value = d[ax.field as string]; // `unknown` return type — safe
```
Or use a typed helper that narrows the access.

**Warning signs:** TypeScript compiler errors on `d[ax.field]` in strict mode.

---

## Code Examples

Verified patterns from existing codebase:

### PAFVProvider.getStackedGroupBySQL()
```typescript
// Source: src/providers/PAFVProvider.ts:303-311
getStackedGroupBySQL(): { colAxes: AxisMapping[]; rowAxes: AxisMapping[] } {
  for (const axis of [...this._state.colAxes, ...this._state.rowAxes]) {
    validateAxisField(axis.field as string);
  }
  return {
    colAxes: [...this._state.colAxes],
    rowAxes: [...this._state.rowAxes],
  };
}
```

### WorkerBridge.superGridQuery()
```typescript
// Source: src/worker/WorkerBridge.ts:368-392
async superGridQuery(config: SuperGridQueryConfig): Promise<CellDatum[]> {
  this._pendingSuperGridConfig = config;
  return new Promise<CellDatum[]>((resolve, reject) => {
    this._pendingSuperGridResolve = resolve;
    this._pendingSuperGridReject = reject;
    if (this._superGridRafId !== null) return; // rAF already scheduled
    this._superGridRafId = requestAnimationFrame(() => {
      // ... sends single Worker message, resolves latest caller's promise
    });
  });
}
```

### StateCoordinator.subscribe()
```typescript
// Source: src/providers/StateCoordinator.ts:75-79
subscribe(cb: () => void): () => void {
  this.subscribers.add(cb);
  return () => this.subscribers.delete(cb);
}
// Fires ~16ms after any registered provider changes via setTimeout(16)
```

### VIEW_DEFAULTS for supergrid fallback
```typescript
// Source: src/providers/PAFVProvider.ts:65-72
supergrid: {
  viewType: 'supergrid',
  xAxis: null, yAxis: null, groupBy: null,
  colAxes: [{ field: 'card_type', direction: 'asc' }],
  rowAxes: [{ field: 'folder', direction: 'asc' }],
},
```

### D3 data join key function (current pattern)
```typescript
// Source: src/views/SuperGrid.ts:244-245
gridSelection
  .selectAll<HTMLDivElement, CellDatum>('.data-cell')
  .data(cellData, d => `${d.rowKey}:${d.colKey}`)
  // Phase 17: key function becomes dynamic — `d => makeCellKey(d, colAxes, rowAxes)`
```

### FilterProvider.compile() return shape
```typescript
// Source: src/providers/types.ts:115-118
interface CompiledFilter {
  where: string;   // SQL WHERE fragment (with deleted_at IS NULL already included)
  params: unknown[];
}
// filterProvider.compile().where is always non-empty (min: 'deleted_at IS NULL')
```

### Test mock pattern (from WorkerBridge-supergrid.test.ts)
```typescript
// Source: tests/worker/WorkerBridge-supergrid.test.ts:43-75
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage(data: WorkerRequest): void { ... }
  simulateMessage(data: unknown): void { ... }
}
// SuperGrid tests should mock PAFVProvider + WorkerBridge + StateCoordinator similarly
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `DEFAULT_COL_FIELD = 'card_type'` constant | `provider.getStackedGroupBySQL().colAxes` | Phase 17 | Axes are live and user-configurable |
| `cards.filter(c => c[DEFAULT_COL_FIELD] === colVal)` | Worker GROUP BY + `bridge.superGridQuery()` | Phase 17 | Grouping moves off main thread; scales to 10K+ cards |
| `lastCards: CardDatum[]` stored for re-render | `lastCells: CellDatum[]` stored for collapse re-render | Phase 17 | Cells come from Worker, not ViewManager |
| `new SuperGrid()` zero-arg constructor | `new SuperGrid(provider, filter, bridge, coordinator)` | Phase 17 | Explicit dependencies; ViewManager must be updated |

**Deprecated/outdated:**
- `DEFAULT_COL_FIELD` and `DEFAULT_ROW_FIELD` constants: Removed entirely in Phase 17
- In-memory `cards.filter(...)` in SuperGrid.render(): Replaced by Worker query pipeline
- `lastCards: CardDatum[]`: Replaced by `lastCells: CellDatum[]`

---

## Open Questions

1. **Constructor Arity: 2 or 4 args?**
   - What we know: CONTEXT.md says `new SuperGrid(provider, bridge)`. But FOUN-11 requires StateCoordinator for 16ms batching, and the query requires a filter WHERE clause.
   - What's unclear: Does "subscribe through StateCoordinator" mean StateCoordinator is constructor-injected, or does SuperGrid mount() receive it via a different path?
   - Recommendation: Use 4-arg constructor: `new SuperGrid(provider, filter, bridge, coordinator)`. Update `main.ts` viewFactory accordingly. This is explicit, testable, and consistent with CONTEXT.md's "explicit dependencies, testable" rationale. The CONTEXT.md likely intended coordinator as an implied 3rd arg since it's architecturally required for FOUN-11.

2. **WHERE clause source for supergrid:query**
   - What we know: `supergrid:query` payload requires `{ where, params }`. These come from FilterProvider.compile().
   - What's unclear: Should SuperGrid hold a FilterProvider reference, or should ViewManager pass compiled filter via render()'s cards parameter (which is ignored)?
   - Recommendation: FilterProvider is constructor-injected (4th arg or included in a config object). The alternative (ignoring filters in SuperGrid) would break user filtering on the SuperGrid view.

3. **mount() timing: When does the immediate _fetchAndRender() fire vs StateCoordinator subscription?**
   - What we know: CONTEXT.md says "fires bridge.superGridQuery() immediately on mount()". StateCoordinator subscription fires ~16ms after any provider change.
   - What's unclear: On view switch, will ViewManager's `this._fetchAndRender()` (which calls `render(cards)` on the non-supergrid path) conflict with SuperGrid's own subscription?
   - Recommendation: ViewManager should NOT call render() on SuperGrid at all after the view switch. Since render() is a no-op, there's no correctness issue — but the ViewManager's coordinator subscription (which calls `_fetchAndRender()` → `render(cards)`) will harmlessly call SuperGrid.render([]) on every provider change. This is acceptable since render() is a no-op.
   - Better: ViewManager could check if `currentView instanceof SuperGrid` to skip the coordinator-triggered render. But this adds instanceof checks to ViewManager — a layer violation. Keep render() as a pure no-op; ViewManager's subscription still fires but does nothing.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `vitest.config.ts` (pool: forks, isolate: true) |
| Quick run command | `npx vitest run tests/views/SuperGrid.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-08 | Changing PAFVProvider colAxes causes SuperGrid to render different headers (not hardcoded card_type) | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts` | Partial — SuperGrid.test.ts exists but no Phase 17 tests yet |
| FOUN-09 | SuperGrid.mount() triggers bridge.superGridQuery() with axes from provider | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts` | Partial |
| FOUN-10 | StateCoordinator change callback triggers bridge.superGridQuery() | unit (jsdom) | `npx vitest run tests/views/SuperGrid.test.ts` | Partial |
| FOUN-11 | 4 rapid provider changes produce exactly 1 superGridQuery() call within one rAF frame | unit (jsdom + fake rAF) | `npx vitest run tests/views/SuperGrid.test.ts` | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/views/SuperGrid.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] FOUN-11 batch deduplication test in `tests/views/SuperGrid.test.ts` — covers 4 rapid StateCoordinator changes → 1 superGridQuery call
- [ ] FOUN-09 test: mock bridge.superGridQuery() call count on mount() — currently no test for bridge.superGridQuery() being called at all
- [ ] FOUN-10 test: mock coordinator subscription fires → _fetchAndRender() called
- [ ] FOUN-08 test: axes from provider (not DEFAULT_COL_FIELD) drive header rendering — needs mock PAFVProvider with custom axes

Existing tests in `tests/views/SuperGrid.test.ts` test the old behavior (zero-arg constructor, render(cards)). They will need to be updated to mock the injected dependencies.

---

## Sources

### Primary (HIGH confidence)
- `src/views/SuperGrid.ts` — Current SuperGrid implementation: constants, render pipeline, D3 join pattern
- `src/worker/WorkerBridge.ts` — superGridQuery() rAF coalescing implementation
- `src/providers/PAFVProvider.ts` — getStackedGroupBySQL(), VIEW_DEFAULTS, subscribe() pattern
- `src/providers/StateCoordinator.ts` — subscribe() returns unsub, setTimeout(16) batching
- `src/views/supergrid/SuperGridQuery.ts` — buildSuperGridQuery() signature, SuperGridQueryConfig type
- `src/views/supergrid/SuperStackHeader.ts` — buildHeaderCells() API, multi-level tuple input format
- `src/worker/protocol.ts` — CellDatum type (index signature + count + card_ids)
- `src/views/types.ts` — IView, WorkerBridgeLike, CardDatum interfaces
- `tests/views/SuperGrid.test.ts` — Existing test patterns to extend
- `tests/worker/WorkerBridge-supergrid.test.ts` — rAF mock + MockWorker pattern for Phase 17 tests
- `.planning/phases/17-supergrid-dynamic-axis-reads/17-CONTEXT.md` — All locked decisions
- `.planning/REQUIREMENTS.md` — FOUN-08..FOUN-11 definitions
- `.planning/STATE.md` — Phase 16 decisions (rAF coalescing, empty axes return single count row)

### Secondary (MEDIUM confidence)
- `src/main.ts` — viewFactory pattern shows how ViewManager creates SuperGrid; update path for constructor args

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries are already in use; no new dependencies
- Architecture: HIGH — All APIs (getStackedGroupBySQL, superGridQuery, buildHeaderCells) are implemented and tested from previous phases
- Pitfalls: HIGH — Directly derived from reading existing code paths and confirmed by CONTEXT.md decisions
- Open questions: MEDIUM — Constructor arity and filter source are design choices not fully resolved in CONTEXT.md; planner should decide

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (stable internal APIs; no external dependency churn)
