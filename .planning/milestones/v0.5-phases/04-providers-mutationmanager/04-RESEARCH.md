# Phase 4: Providers + MutationManager - Research

**Researched:** 2026-02-28
**Domain:** TypeScript state management, SQL compilation, command pattern (undo/redo), SQLite persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Provider Coordination**
- QueryBuilder is the SOLE query assembly point — views never touch SQL directly
- Reactive chain: provider change → subscriber fires → QueryBuilder recompiles → WorkerBridge query → view updates (auto re-execute, no manual triggers)
- QueryBuilder ONLY composes from provider compile() outputs — no raw SQL passthrough, no escape hatch. The safety model (SAFE-01..06) is airtight
- Providers are independently testable without WorkerBridge — pure unit tests for compilation, separate integration tests for full chain

**Undo/Redo Scope**
- One atomic undo step per user action — multi-field changes (e.g., Kanban drag-drop changing category + sort_order) group into a single Mutation with multiple forward/inverse SQL commands
- Undo history is session-only — lives in memory, cleared on page refresh. Data persists but undo history doesn't
- New mutation after undo clears the redo stack — standard behavior, same as every text editor and design tool
- History depth: Claude's discretion (bounded or unbounded)

**State Restoration**
- Stale filter values (e.g., referencing renamed folder) are applied silently — user sees empty results with their filter active and can remove it manually. No auto-cleanup, no surprises
- Corrupt/unparseable JSON for a provider key resets THAT provider to defaults — other providers unaffected. Log a warning, isolate failures
- Explicit `restore()` call — app startup controls timing, not auto-restore on init. Enables proper sequencing with view lifecycle
- Skip animation on restore — views snap to restored state instantly. App should feel like it was already there, not "catching up"

**Subscriber Notification Timing**
- Provider changes batched via queueMicrotask — changes within the same synchronous frame produce ONE notification to views, preventing redundant queries and partial-state renders
- Mutation subscriber notifications batched via requestAnimationFrame (per MUT-06) — visual updates aligned to frame boundaries
- Different batching mechanisms by design: providers trigger async queries (microtask is fine), mutations trigger visual refreshes (rAF aligns to frames)
- Manual unsubscribe — subscribe() returns an unsubscribe function, views must call it in destroy(). Explicit, testable, predictable (PROV-11)
- Separate StateCoordinator class (PROV-09) — owns cross-provider batching logic. Providers register with it. Single responsibility: providers don't know about each other

### Claude's Discretion

- Undo history depth (bounded vs unbounded)
- Debounce timing for Tier 2 persistence (spec suggests 500ms)
- Exact StateCoordinator batching implementation
- Error message formatting for SQL safety rejections
- Internal data structures for command log

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 4 implements the reactive state layer sitting between sql.js (data) and D3.js (views). The core insight from the specs is that **providers hold only UI state** (which filters, which axis, which view) — never entity data. SQLite is the single source of truth, and providers produce SQL fragments that QueryBuilder composes into complete queries sent over WorkerBridge.

The MutationManager implements the Command pattern: every write captures both forward SQL (the operation) and inverse SQL (how to undo it) at creation time, stores them in a command log, and replays them for undo/redo. This is session-only — the history array lives in memory and clears on refresh, but the underlying data mutations persist in SQLite.

The existing codebase is in excellent shape for this phase. Phase 3 delivered a fully-typed WorkerBridge, a clean handler pattern, and the `ui_state` table is already in schema.sql. The test infrastructure (Vitest 4.0, `pool: 'forks'`, `isolate: true`) supports purely synchronous unit tests for provider compilation and the command pattern without requiring a Worker at all — only the StateManager integration tests need WorkerBridge.

**Primary recommendation:** Build providers as pure TypeScript classes with synchronous `compile()` methods. Test them entirely without WorkerBridge. Wire StateCoordinator with `queueMicrotask` batching. Add the Worker `ui:*` protocol extensions last.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROV-01 | FilterProvider compiles filter state to `{where, params}` SQL fragments with allowlisted columns only | compileFilters() pattern fully specified in Providers.md; allowlist in Contracts.md §7 |
| PROV-02 | FilterProvider rejects unknown fields and operators, passing SQL injection tests | validateColumn() pattern from Contracts.md §7.2; runtime throws on unknown field/op |
| PROV-03 | PAFVProvider maps LATCH dimensions to screen planes and compiles to ORDER BY / GROUP BY fragments | PHASE-4-PROVIDERS.md Plan 4-03 (AxisProvider) has full compile() contract |
| PROV-04 | PAFVProvider suspends and restores view family state when switching between LATCH and GRAPH | setViewType() suspend/restore pattern fully specified in Providers.md §2 |
| PROV-05 | SelectionProvider manages selected card IDs as Tier 3 ephemeral state (never persisted) | No toJSON/fromJSON methods; Tier 3 confirmed in Contracts.md §6 |
| PROV-06 | SelectionProvider supports Cmd+click toggle, Shift+click range, and select-all | select() with toggle/extend options in Providers.md §3; range uses orderedIdsGetter |
| PROV-07 | DensityProvider compiles density levels to SQL strftime() expressions for time axes | getDensitySQL() pattern fully specified in Providers.md §4 |
| PROV-08 | DensityProvider supports all five time granularities (day, week, month, quarter, year) | All five strftime() patterns specified in PHASE-4-PROVIDERS.md Plan 4-05 |
| PROV-09 | StateCoordinator batches cross-provider updates within 16ms frames | scheduleUpdate() with setTimeout(16) per Providers.md §5; CONTEXT.md locks queueMicrotask for provider changes |
| PROV-10 | Tier 2 provider state (filter, axis, density, view) persists to SQLite ui_state and restores on launch | ui_state table already in schema.sql; StateManager (Plan 4-07) does persist/restore |
| PROV-11 | Providers expose subscribe/unsubscribe and return cleanup functions to prevent subscriber leaks | subscribe() returns `() => void` unsubscribe on every provider |
| MUT-01 | MutationManager is the sole write gate — all entity writes go through `exec()` | execute(mutation) is the only entry point for writes; no direct bridge.exec() from views |
| MUT-02 | Every mutation generates inverse SQL for undo and stores it in a Command object | Command Pattern: Mutation interface with forward/inverse arrays created at call time |
| MUT-03 | Undo replays inverse SQL; redo replays forward SQL | undo() pops history, executes inverse[]; redo() pops redoStack, executes forward[] |
| MUT-04 | Batch mutations produce a single undo step with correctly ordered inverse operations | Mutation.inverse[] is reverse-ordered relative to Mutation.forward[] |
| MUT-05 | MutationManager sets dirty flag on every write for CloudKit sync (D-010) | dirty boolean set in execute(), cleared by clearDirty() for sync handshake |
| MUT-06 | Subscriber notifications are batched per animation frame via requestAnimationFrame | scheduleNotify() with rAF and pendingNotify guard (confirmed in Providers.md §0) |
| MUT-07 | Cmd+Z triggers undo, Cmd+Shift+Z triggers redo (keyboard shortcut integration) | shortcuts.ts registers keydown listeners; cleans up on returned function call |
</phase_requirements>

---

## Standard Stack

### Core

No new dependencies are required for Phase 4. All needed primitives exist in the runtime.

| Primitive | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| TypeScript | 5.9.3 (already installed) | Compile-time field/operator union types | Enables `field: FilterField` literal checking without runtime cost |
| `queueMicrotask` | Browser/Node built-in | Provider change batching | Runs after current synchronous code completes, before next macrotask; free, no import |
| `requestAnimationFrame` | Browser built-in | Mutation subscriber batching | Aligns visual notifications to frame boundaries; prevents mid-frame flicker |
| `setTimeout(fn, 16)` | Built-in | StateCoordinator 16ms batching | Coalesces rapid cross-provider changes into one notification cycle |
| `Set<string>` | JS built-in | SelectionProvider selected IDs | O(1) has/add/delete; exactly what D3 `.classed()` needs |
| `crypto.randomUUID()` | Already used in Phase 3 | Mutation ID generation | Consistent with WorkerBridge correlation ID pattern |

### Supporting (already in package.json)

| Library | Version | Purpose |
|---------|---------|---------|
| Vitest | 4.0.18 | Test runner (providers are pure TS — no Worker needed) |
| TypeScript strict | 5.9.3 | Catches unsafe field/operator casts at compile time |

### No New Dependencies

The project already has the only dependencies it will ever need for this phase. No new `npm install` calls.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── providers/
│   ├── types.ts              # FilterField, FilterOperator, AxisField, TimeGranularity, ViewType unions
│   ├── allowlist.ts          # ALLOWED_FILTER_FIELDS, ALLOWED_OPERATORS, ALLOWED_AXIS_FIELDS sets
│   ├── FilterProvider.ts     # Filter state → {where, params}
│   ├── PAFVProvider.ts       # Axis state → ORDER BY/GROUP BY + view family suspension
│   ├── SelectionProvider.ts  # Selected IDs (Tier 3, no persistence)
│   ├── DensityProvider.ts    # Time granularity → strftime() SQL
│   ├── StateCoordinator.ts   # Batches cross-provider updates, notifies views
│   ├── StateManager.ts       # Tier 2 persistence: read/write ui_state via WorkerBridge
│   ├── QueryBuilder.ts       # Composes provider outputs into complete card queries
│   └── index.ts              # Public re-exports
├── mutations/
│   ├── types.ts              # MutationCommand, Mutation interfaces
│   ├── inverses.ts           # createCardMutation, updateCardMutation, deleteCardMutation, etc.
│   ├── MutationManager.ts    # Command log, undo/redo, dirty flag, rAF batching
│   ├── shortcuts.ts          # Cmd+Z / Cmd+Shift+Z keyboard listener setup
│   └── index.ts              # Public re-exports
├── worker/
│   ├── handlers/
│   │   └── ui-state.handler.ts   # NEW: ui_state CRUD (get, set, delete, getAll)
│   ├── protocol.ts           # EXTEND: add ui:get/set/delete/getAll to WorkerRequestType
│   └── ... (Phase 3, unchanged)
└── index.ts                  # Re-export providers + mutations
tests/
├── providers/
│   ├── allowlist.test.ts
│   ├── FilterProvider.test.ts
│   ├── PAFVProvider.test.ts
│   ├── SelectionProvider.test.ts
│   ├── DensityProvider.test.ts
│   ├── StateCoordinator.test.ts
│   ├── QueryBuilder.test.ts
│   ├── sql-injection.test.ts
│   └── persistence.test.ts   # Integration: StateManager round-trip
└── mutations/
    ├── types.test.ts
    ├── inverses.test.ts
    ├── MutationManager.test.ts
    ├── shortcuts.test.ts
    └── undo-redo.test.ts      # Integration: full undo/redo workflow
```

**Note on naming:** The PHASE-4-PROVIDERS.md spec splits "PAFVProvider" from Providers.md into `AxisProvider` + `ViewProvider`. The CONTEXT.md and REQUIREMENTS.md use the name `PAFVProvider`. Recommend using `PAFVProvider` as the single class (matching REQUIREMENTS.md) that owns both axis state and view family suspension, consistent with the canonical Providers.md spec. This avoids the coordination complexity of two separate providers managing overlapping state.

### Pattern 1: Provider Base Pattern (Pure Compile + Subscribe)

**What:** Providers are synchronous state machines with a `compile()` method and a subscriber set. No async, no Worker knowledge.

**When to use:** All four providers (FilterProvider, PAFVProvider, SelectionProvider, DensityProvider).

```typescript
// Source: Providers.md §1 + CONTEXT.md locked decisions
class FilterProvider {
  private state: FilterState = { filters: {}, searchQuery: null };
  private subscribers = new Set<(state: FilterState) => void>();
  private pendingNotify = false;

  setFilter(axis: LATCHAxis, filter: Filter | null): void {
    if (filter === null) {
      delete this.state.filters[axis];
    } else {
      this.state.filters[axis] = filter;
    }
    this.scheduleNotify();
  }

  // Pure function — no side effects, no async
  compile(): { where: string; params: unknown[] } {
    return compileFilters(this.state);
  }

  // Returns unsubscribe function (PROV-11)
  subscribe(callback: (state: FilterState) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // queueMicrotask batching per CONTEXT.md locked decision
  private scheduleNotify(): void {
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    queueMicrotask(() => {
      this.pendingNotify = false;
      this.subscribers.forEach(cb => cb(this.state));
    });
  }
}
```

### Pattern 2: SQL Safety — Compile-Time + Runtime Dual Validation

**What:** TypeScript union types prevent wrong literals at compile time. Runtime validation throws on dynamic input (e.g., state restored from JSON, user-supplied strings).

**When to use:** FilterProvider.compile(), PAFVProvider.compile(), anywhere column/operator appears as a variable.

```typescript
// Source: Contracts.md §7 + PHASE-4-PROVIDERS.md Plan 4-01
// types.ts
export type FilterField =
  | 'card_type' | 'name' | 'folder' | 'status' | 'source'
  | 'created_at' | 'modified_at' | 'due_at' | 'completed_at'
  | 'event_start' | 'event_end'
  | 'latitude' | 'longitude' | 'location_name'
  | 'priority' | 'sort_order';

export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'startsWith' | 'in' | 'isNull' | 'isNotNull';

// allowlist.ts
export const ALLOWED_FILTER_FIELDS: ReadonlySet<FilterField> = Object.freeze(
  new Set<FilterField>(['card_type', 'name', 'folder', /* ... */])
);

export function isValidFilterField(field: string): field is FilterField {
  return (ALLOWED_FILTER_FIELDS as Set<string>).has(field);
}

export function validateFilterField(field: string): asserts field is FilterField {
  if (!isValidFilterField(field)) {
    throw new Error(`SQL safety violation: "${field}" is not an allowed filter field`);
  }
}

// Usage in compile()
function compileFilter(filter: Filter): { clause: string; params: unknown[] } {
  // Runtime guard (handles JSON-deserialized values)
  validateFilterField(filter.field);
  validateFilterOperator(filter.operator);

  // Now field is safe to interpolate as column name (it's in the allowlist)
  // Value always goes through parameterization — never interpolated
  switch (filter.operator) {
    case 'eq': return { clause: `${filter.field} = ?`, params: [filter.value] };
    case 'in': {
      const values = filter.value as unknown[];
      const placeholders = values.map(() => '?').join(', ');
      return { clause: `${filter.field} IN (${placeholders})`, params: values };
    }
    case 'isNull': return { clause: `${filter.field} IS NULL`, params: [] };
    // ... etc
  }
}
```

### Pattern 3: Command Pattern for Undo/Redo

**What:** Capture both forward and inverse SQL at mutation creation time. Execute forward on `exec()`, execute inverse in reverse order on `undo()`.

**When to use:** All entity writes (card create/update/delete, connection create/delete).

```typescript
// Source: PHASE-4-PROVIDERS.md Plan 4-09 + Providers.md MutationManager example
// types.ts
export interface MutationCommand {
  sql: string;
  params: unknown[];
}

export interface Mutation {
  id: string;          // crypto.randomUUID()
  timestamp: number;   // Date.now()
  description: string; // Human-readable for potential history UI
  forward: MutationCommand[];  // Execute these in order
  inverse: MutationCommand[];  // Execute these in REVERSE order for undo
}

// inverses.ts
export function updateCardMutation(
  id: string,
  before: Card,
  after: Partial<CardInput>
): Mutation {
  const forwardSets = Object.entries(after)
    .map(([col]) => `${col} = ?`)
    .join(', ');
  const forwardParams = [...Object.values(after), id];

  // Inverse: restore ONLY the fields that changed
  const inverseSets = Object.keys(after)
    .map(col => `${col} = ?`)
    .join(', ');
  const inverseParams = Object.keys(after).map(col => (before as Record<string, unknown>)[col]);
  inverseParams.push(id);

  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    description: `Update card ${id}`,
    forward: [{ sql: `UPDATE cards SET ${forwardSets} WHERE id = ?`, params: forwardParams }],
    inverse: [{ sql: `UPDATE cards SET ${inverseSets} WHERE id = ?`, params: inverseParams }],
  };
}
```

### Pattern 4: PAFVProvider View Family Suspension

**What:** When switching between LATCH and GRAPH view families, suspend the current family's state and restore the other family's state (or use defaults if first visit).

**When to use:** PAFVProvider.setViewType() — only fires when the family boundary is crossed.

```typescript
// Source: Providers.md §2
setViewType(viewType: ViewType): void {
  const currentFamily = getViewFamily(this.state.viewType);
  const newFamily = getViewFamily(viewType);

  if (currentFamily !== newFamily) {
    // Deep-copy to prevent reference aliasing
    this.suspendedStates.set(currentFamily, structuredClone(this.state));

    const restored = this.suspendedStates.get(newFamily);
    this.state = restored
      ? { ...structuredClone(restored), viewType }
      : { ...VIEW_DEFAULTS[viewType], viewType };
  } else {
    this.state.viewType = viewType;
    // Apply view-specific defaults within same family (e.g., kanban needs groupBy)
    applyViewDefaults(this.state, viewType);
  }

  this.scheduleNotify();
}

function getViewFamily(viewType: ViewType): 'latch' | 'graph' {
  // Per Contracts.md §3.2
  return viewType === 'graph' ? 'graph' : 'latch';
}
```

### Pattern 5: StateManager Debounced Persistence

**What:** On every provider change, debounce writes to the `ui_state` table via WorkerBridge. On `restore()`, read all keys and call each provider's `setState()`.

**When to use:** StateManager.registerProvider() + enableAutoPersist(). Only Tier 1/2 providers register (FilterProvider, PAFVProvider, DensityProvider). SelectionProvider explicitly does NOT register.

```typescript
// Source: PHASE-4-PROVIDERS.md Plan 4-07
class StateManager {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private providers = new Map<string, PersistableProvider>();

  constructor(private bridge: WorkerBridge, private debounceMs = 500) {}

  registerProvider(key: string, provider: PersistableProvider): void {
    this.providers.set(key, provider);
  }

  // Called by provider subscribers
  markDirty(key: string): void {
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key);
      void this.persist(key);
    }, this.debounceMs);

    this.debounceTimers.set(key, timer);
  }

  async persist(key: string): Promise<void> {
    const provider = this.providers.get(key);
    if (!provider) return;
    const value = provider.toJSON();
    await this.bridge.send('ui:set', { key, value });
  }

  async restore(): Promise<void> {
    const rows = await this.bridge.send('ui:getAll', {});
    for (const { key, value } of rows) {
      const provider = this.providers.get(key);
      if (!provider) continue;
      try {
        provider.setState(JSON.parse(value));
      } catch (err) {
        // CONTEXT.md: corrupt JSON resets THAT provider to defaults, logs warning
        console.warn(`[StateManager] Failed to restore "${key}": ${err}`);
        provider.resetToDefaults();
      }
    }
  }
}
```

### Pattern 6: Worker Protocol Extension

**What:** Phase 4 adds `ui:get`, `ui:set`, `ui:delete`, `ui:getAll` to the existing WorkerRequestType union. This follows the exact same pattern as Phase 3's card/connection/search types.

**When to use:** Extend `protocol.ts` only — the router in `worker.ts` and handler pattern from `handlers/` carry forward unchanged.

```typescript
// Source: CONTEXT.md + existing protocol.ts pattern
// Extend WorkerRequestType union:
export type WorkerRequestType =
  | ... // existing Phase 3 types
  | 'ui:get'
  | 'ui:set'
  | 'ui:delete'
  | 'ui:getAll';

// Add to WorkerPayloads:
'ui:get': { key: string };
'ui:set': { key: string; value: string };
'ui:delete': { key: string };
'ui:getAll': Record<string, never>;

// Add to WorkerResponses:
'ui:get': { key: string; value: string | null; updated_at: string | null };
'ui:set': void;
'ui:delete': void;
'ui:getAll': Array<{ key: string; value: string; updated_at: string }>;
```

### Anti-Patterns to Avoid

- **Async providers:** `compile()` must be synchronous. Providers translate state to SQL — they do not execute queries. Only StateManager (persist/restore) is async.
- **Provider cross-awareness:** FilterProvider must not import PAFVProvider. StateCoordinator is the only class that knows about all providers.
- **Raw SQL passthrough in QueryBuilder:** No `rawSql` parameter. Every SQL fragment must come from a provider's `compile()` output.
- **Persisting SelectionProvider:** SelectionProvider has no `toJSON()`, no `setState()`, no `resetToDefaults()`. If you add one, it's a bug.
- **Computing inverse at undo time:** The `before` state must be captured when the mutation is created. Computing it later risks using changed state.
- **Single mega-trigger for FTS:** The schema.sql already has three separate triggers; mutations that update `name`, `content`, `folder`, or `tags` should update those fields individually, not via a combined patch.
- **Calling `rAF` in tests:** The MutationManager's `scheduleNotify` uses `requestAnimationFrame`. In Vitest (node environment), use `vi.stubGlobal('requestAnimationFrame', cb => { cb(0); return 0; })` or drain the rAF queue manually in tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL parameterization | Custom escaping/sanitization | Parameterized `?` placeholders (built into sql.js) | sql.js does parameterization natively — any custom escaping is an injection risk |
| Observable state | MobX, Zustand, Redux pattern | Plain `Set<callback>` subscriber pattern | Providers hold UI state only (100-200 bytes), no reactivity framework overhead needed |
| Undo stack | Immutable.js history | Simple `Mutation[]` array + redo `Mutation[]` array | The command log is flat arrays — no tree, no branching, no library needed |
| JSON serialization | Custom binary format | `JSON.stringify()` / `JSON.parse()` | Provider state is small (< 1KB each). JSON round-trip is fine |
| Event bus | RxJS, EventEmitter3 | Direct function callbacks in `Set<fn>` | Simpler, tree-shakable, no import overhead |
| Keyboard shortcut library | Hotkeys.js, Mousetrap | Direct `keydown` listener on `document` | Only 2 shortcuts needed; library adds unnecessary weight |

**Key insight:** The subscription and command patterns here are so small that any third-party library would add more code than it replaces. The test-from-first-principles approach (plain `Set`, plain arrays) is both faster and more understandable.

---

## Common Pitfalls

### Pitfall 1: queueMicrotask vs requestAnimationFrame Confusion
**What goes wrong:** Using `requestAnimationFrame` for provider change notification (instead of `queueMicrotask`) causes provider changes to be delayed a full frame (~16ms). The query executes one frame late, causing visible stutter on fast interactions.
**Why it happens:** Conflating "batching" with "frame alignment." Provider changes trigger async Worker queries — they don't need frame alignment, just coalescing.
**How to avoid:** Per CONTEXT.md locked decision: providers use `queueMicrotask`, MutationManager uses `requestAnimationFrame`. These are not interchangeable.
**Warning signs:** Tests that await `requestAnimationFrame` for provider subscriber assertions.

### Pitfall 2: requestAnimationFrame Not Available in Node/Vitest
**What goes wrong:** `MutationManager.scheduleNotify()` calls `requestAnimationFrame`, which does not exist in the Vitest `node` environment. Tests will error with "requestAnimationFrame is not defined."
**Why it happens:** Vitest is configured with `environment: 'node'` (not `jsdom`). rAF is a browser API.
**How to avoid:** Stub `requestAnimationFrame` globally in MutationManager tests:
```typescript
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  cb(performance.now());
  return 0;
});
```
Add a corresponding `cancelAnimationFrame` stub. Do this in a `beforeEach` and clean up in `afterEach`.
**Warning signs:** `ReferenceError: requestAnimationFrame is not defined` in test output.

### Pitfall 3: Inverse SQL for DELETE Requires Full Row Data
**What goes wrong:** A `deleteCardMutation` that only stores `{sql: 'DELETE FROM cards WHERE id = ?', params: [id]}` cannot produce a correct inverse INSERT because the full row values aren't stored.
**Why it happens:** The inverse of a DELETE is an INSERT with all column values. You must capture the complete Card object before deletion.
**How to avoid:** `deleteCardMutation(card: Card)` — pass the full Card object, not just the ID. The inverse captures all fields:
```typescript
export function deleteCardMutation(card: Card): Mutation {
  return {
    forward: [{ sql: 'DELETE FROM cards WHERE id = ?', params: [card.id] }],
    inverse: [{
      sql: `INSERT INTO cards (id, card_type, name, ...) VALUES (?, ?, ?, ...)`,
      params: [card.id, card.card_type, card.name, /* all fields */]
    }],
    // ...
  };
}
```
**Warning signs:** Undo after delete produces empty cards with missing fields.

### Pitfall 4: Batch Mutation Inverse Order Must Be Reversed
**What goes wrong:** A batch mutation with `forward: [A, B, C]` (e.g., Kanban drag: update category, update sort_order, update parent) has its undo applied as `inverse: [undoA, undoB, undoC]` — in the wrong order. The correct undo order is `[undoC, undoB, undoA]`.
**Why it happens:** Applying inverse operations in forward order can violate constraints or produce wrong state (e.g., updating sort_order before restoring category violates uniqueness constraints).
**How to avoid:** When building batch mutations: `inverse = singleInverses.reverse()`. Validate with a batch-specific test.
**Warning signs:** Undo of a multi-step operation leaves the record in an intermediate state.

### Pitfall 5: FilterProvider compileFilters() Always Includes `deleted_at IS NULL`
**What goes wrong:** Forgetting to include `deleted_at IS NULL` as the default base clause produces queries that return soft-deleted cards.
**Why it happens:** The FilterProvider compiles filter state to a WHERE clause fragment — it's tempting to only include user-specified filters.
**How to avoid:** Initialize `clauses: string[]` with `['deleted_at IS NULL']` as the first element. Every compiled query starts with this guard.
**Warning signs:** Tests showing deleted cards in filter results.

### Pitfall 6: StateCoordinator Timeout vs queueMicrotask Conflict
**What goes wrong:** The CONTEXT.md says providers use `queueMicrotask` for their own internal batching, but the StateCoordinator spec shows `setTimeout(16)`. Using `setTimeout` in StateCoordinator while providers use `queueMicrotask` means the coordinator fires AFTER the microtask queue drains — which is correct.
**Why it happens:** Mixing timing mechanisms can produce surprising ordering. The key rule: provider self-notification (to their own subscribers) uses `queueMicrotask`. StateCoordinator cross-provider batching uses `setTimeout(16)`.
**How to avoid:** Keep the two batching layers strictly separate. StateCoordinator subscribes to providers and debounces its own notifications independently.
**Warning signs:** StateCoordinator notifying views before all providers in a batch have fired.

### Pitfall 7: ui_state Table Key Collision
**What goes wrong:** Multiple providers writing to the same ui_state key overwrites each other's data silently.
**Why it happens:** The ui_state table is a flat key-value store. Keys must be unique per provider.
**How to avoid:** Use stable, namespaced keys: `filter`, `axis`, `density`, `view`. Document the key schema in `StateManager.ts`. The existing schema.sql confirms the table structure:
```sql
CREATE TABLE ui_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```
**Warning signs:** Filter state restoration overwriting axis state, or vice versa.

### Pitfall 8: PAFVProvider.orderedIdsGetter Injection for Shift+Click Range
**What goes wrong:** SelectionProvider cannot compute shift+click range selection without knowing the current display order of cards. This order depends on the current view's sorted output.
**Why it happens:** The provider layer has no access to the rendered card list. The ordered IDs are known only to the view renderer.
**How to avoid:** SelectionProvider accepts an injected `orderedIdsGetter: () => string[]` function (from Providers.md §3). The view calls `selectionProvider.setOrderedIdsGetter(() => this.currentCardOrder)` on render. Alternatively (simpler for Phase 4 since views come in Phase 5): `range(id, allIds)` accepts the ordered list as a parameter directly.
**Warning signs:** Shift+click range selection returns wrong cards or crashes with index -1.

---

## Code Examples

Verified patterns from the canonical spec documents:

### FilterProvider — compileFilters() base clause

```typescript
// Source: Providers.md §1 compileFilters()
function compileFilters(state: FilterState): { where: string; params: unknown[] } {
  const clauses: string[] = ['deleted_at IS NULL'];  // Always first
  const params: unknown[] = [];

  if (state.filters.category) {
    const { type, field, values } = state.filters.category;
    validateColumn(field);  // Runtime safety check
    if (field === 'tags') {
      const op = type === 'include' ? 'EXISTS' : 'NOT EXISTS';
      const placeholders = values.map(() => '?').join(', ');
      clauses.push(`${op} (SELECT 1 FROM json_each(tags) WHERE value IN (${placeholders}))`);
    } else {
      const op = type === 'include' ? 'IN' : 'NOT IN';
      const placeholders = values.map(() => '?').join(', ');
      clauses.push(`${field} ${op} (${placeholders})`);
    }
    params.push(...values);
  }

  // FTS join uses rowid, not id — critical per Contracts.md §5 and Pitfall P21
  if (state.searchQuery) {
    clauses.push('rowid IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)');
    const ftsQuery = state.searchQuery.split(/\s+/).map(t => `"${t}"*`).join(' ');
    params.push(ftsQuery);
  }

  return { where: clauses.join(' AND '), params };
}
```

### DensityProvider — all five strftime() patterns

```typescript
// Source: PHASE-4-PROVIDERS.md Plan 4-05
const STRFTIME_PATTERNS: Record<TimeGranularity, (field: string) => string> = {
  day:     field => `strftime('%Y-%m-%d', ${field})`,
  week:    field => `strftime('%Y-W%W', ${field})`,
  month:   field => `strftime('%Y-%m', ${field})`,
  quarter: field => `strftime('%Y', ${field}) || '-Q' || ((CAST(strftime('%m', ${field}) AS INT) - 1) / 3 + 1)`,
  year:    field => `strftime('%Y', ${field})`,
};

compile(): CompiledDensity {
  const { timeField, granularity } = this.state;
  const groupExpr = STRFTIME_PATTERNS[granularity](timeField);
  return { groupExpr };
}
```

### MutationManager — rAF batching with pendingNotify guard

```typescript
// Source: Providers.md MutationManager pattern
class MutationManager {
  private history: Mutation[] = [];
  private redoStack: Mutation[] = [];
  private dirty = false;
  private pendingNotify = false;
  private subscribers = new Set<() => void>();

  async execute(mutation: Mutation): Promise<void> {
    // Execute all forward commands in order
    for (const cmd of mutation.forward) {
      await this.bridge.send('card:update', /* ... */);
      // In practice: use a generic exec handler or extend protocol with 'db:exec'
    }

    this.history.push(mutation);
    this.redoStack.length = 0;  // Clear redo stack on new mutation
    this.dirty = true;
    this.scheduleNotify();
  }

  async undo(): Promise<boolean> {
    const mutation = this.history.pop();
    if (!mutation) return false;

    // Execute inverse in REVERSE order
    for (const cmd of [...mutation.inverse].reverse()) {
      await this.bridge.send(/* exec command */);
    }

    this.redoStack.push(mutation);
    this.dirty = true;
    this.scheduleNotify();
    return true;
  }

  private scheduleNotify(): void {
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    requestAnimationFrame(() => {
      this.pendingNotify = false;
      this.subscribers.forEach(cb => cb());
    });
  }
}
```

### ui-state.handler.ts — following Phase 3 handler pattern

```typescript
// Source: existing handlers/cards.handler.ts pattern
import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

export function handleUiGet(
  db: Database,
  payload: WorkerPayloads['ui:get']
): WorkerResponses['ui:get'] {
  const result = db.prepare('SELECT value, updated_at FROM ui_state WHERE key = ?')
    .getAsObject([payload.key]);
  return {
    key: payload.key,
    value: (result.value as string | null) ?? null,
    updated_at: (result.updated_at as string | null) ?? null,
  };
}

export function handleUiSet(
  db: Database,
  payload: WorkerPayloads['ui:set']
): WorkerResponses['ui:set'] {
  db.run(
    `INSERT OR REPLACE INTO ui_state (key, value, updated_at)
     VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
    [payload.key, payload.value]
  );
}

export function handleUiGetAll(
  db: Database,
  _payload: WorkerPayloads['ui:getAll']
): WorkerResponses['ui:getAll'] {
  return db.exec('SELECT key, value, updated_at FROM ui_state')[0]?.values?.map(
    ([key, value, updated_at]) => ({ key: key as string, value: value as string, updated_at: updated_at as string })
  ) ?? [];
}
```

### MutationManager — WorkerBridge exec pattern

**Open question:** The current WorkerBridge exposes only domain-specific methods (`createCard`, `updateCard`, etc.), not a generic `exec(sql, params)`. MutationManager needs to execute arbitrary SQL (the inverse commands).

Two options exist:

**Option A — Add `ui:exec` to protocol (recommended):** Extend the worker protocol with a generic `exec` message type that accepts `{sql: string, params: unknown[]}`. This follows the existing pattern cleanly.

**Option B — Use domain methods in inverses:** The `inverses.ts` functions produce domain-typed Mutation objects that call `bridge.updateCard()`, `bridge.deleteCard()`, etc. instead of raw SQL. This means `inverse` stores typed function calls, not SQL strings.

Option A is simpler and consistent with how StateManager already uses `ui:set`. Option B avoids adding a generic exec surface. The PHASE-4-PROVIDERS.md spec (Plan 4-09) uses the SQL string approach (Option A-style), which aligns with the locked decision that MutationManager is the "sole write gate" — raw SQL execution is acceptable here precisely because MutationManager is the gatekeeper.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Parallel entity stores (MobX/Redux/Zustand) | sql.js IS the store; providers hold UI state only | Architecture Decision D-001 (locked) | Zero data duplication, no sync problem |
| Mutable state with watchers | Subscriber callbacks in `Set<fn>` + queueMicrotask batching | Phase 4 design | Simpler than proxy-based reactivity, fully testable |
| Global key/value storage (localStorage) | `ui_state` SQLite table (already in schema.sql) | Phase 1 schema decision | Consistent with "sql.js as system of record" |
| Event sourcing history | Command log (session-only) | Phase 4 design | Simpler; history doesn't need to survive refresh |

**Deprecated/outdated:**
- `localStorage`: Explicitly out of scope. All persistence goes through sql.js via WorkerBridge.
- Framework state managers (MobX, Zustand, Redux): Violates D-003. See REQUIREMENTS.md "Out of Scope."

---

## Open Questions

1. **MutationManager generic exec surface**
   - What we know: WorkerBridge currently has only domain-specific methods. MutationManager's inverse SQL needs to execute arbitrary UPDATE/DELETE/INSERT.
   - What's unclear: Whether to add `db:exec` to the WorkerRequestType protocol, or restructure inverses to use domain methods.
   - Recommendation: Add `db:exec: { sql: string; params: unknown[] }` → `{ changes: number }` to the protocol. It is already conceptually documented in Contracts.md §4.2 as a `exec` message type. MutationManager is the only consumer, so the surface area is controlled.

2. **History depth (Claude's discretion)**
   - What we know: Session-only (cleared on refresh). No size constraint specified.
   - What's unclear: Whether to cap at N entries (e.g., 100) to prevent memory growth in long sessions.
   - Recommendation: Cap at 100 entries (pop oldest when full). This matches standard text editor behavior and prevents unbounded growth in long work sessions. Log a `console.warn` when the cap is hit.

3. **StateManager debounce timer cleanup on unmount**
   - What we know: StateManager registers providers and sets debounce timers.
   - What's unclear: Whether StateManager needs a `destroy()` method to clear pending timers on app shutdown.
   - Recommendation: Add `destroy(): void` that clears all pending debounce timers and calls `persistAll()` synchronously. Called by app before Worker termination.

4. **PAFVProvider naming — class vs split**
   - What we know: REQUIREMENTS.md uses `PAFVProvider` (one class). PHASE-4-PROVIDERS.md splits into `AxisProvider` + `ViewProvider`. Providers.md uses `PAFVProvider`.
   - What's unclear: Which naming the planner should use for file names and class names.
   - Recommendation: Use `PAFVProvider` as the class name (matches REQUIREMENTS.md and Providers.md canonical spec). Internally it can have `axisState` and `viewState` sub-objects. The planner should create one file `src/providers/PAFVProvider.ts`.

5. **SelectionProvider.range() API for Phase 4 (no views yet)**
   - What we know: Shift+click range requires knowing current display order (orderedIds). Views are not implemented until Phase 5.
   - What's unclear: Should Phase 4 implement range selection with an injected getter, or a simpler `range(id, allIds)` parameter API?
   - Recommendation: Implement `range(id: string, allIds: string[]): void` — the caller provides the ordered list. This keeps SelectionProvider stateless about view order and makes Phase 4 tests straightforward. Phase 5 views simply pass their current sorted card list.

---

## Existing Infrastructure (Phase 3 Delivered)

The following are confirmed delivered by Phase 3 and ready to use:

| Asset | File | Phase 4 Usage |
|-------|------|---------------|
| WorkerBridge singleton | `src/worker/WorkerBridge.ts` | `getWorkerBridge()` in StateManager and MutationManager |
| Typed protocol | `src/worker/protocol.ts` | EXTEND: add `ui:get/set/delete/getAll` and `db:exec` |
| Handler pattern | `src/worker/handlers/*.handler.ts` | FOLLOW: add `ui-state.handler.ts` with same signature |
| Handler index | `src/worker/handlers/index.ts` | ADD: `export * from './ui-state.handler'` |
| Worker router | `src/worker/worker.ts` | ADD: dispatch cases for `ui:*` and `db:exec` |
| `ui_state` table | `src/database/schema.sql` | READY: already `CREATE TABLE ui_state (key, value, updated_at)` |
| `Card` / `Connection` types | `src/database/queries/types.ts` | USE: `inverses.ts` references `Card`, `CardInput`, `Connection` |
| Test infrastructure | `vitest.config.ts` + `tests/setup/` | USE: same pool/isolate config, providers test without Worker |

**241 tests passing, 0 failures** — Phase 3 baseline is clean.

---

## Validation Architecture

> Skipped — `workflow.nyquist_validation` is not set in `.planning/config.json`.

---

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Providers.md` — Canonical provider specs, all API contracts, state shapes, SQL compilation patterns
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md` — SQL safety rules (§7), state persistence tiers (§6), schema definitions (§1-2)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/phases/PHASE-4-PROVIDERS.md` — 12-plan implementation spec with acceptance criteria for all PROV/MUT requirements
- `/Users/mshaler/Developer/Projects/Isometry/.planning/phases/04-providers-mutationmanager/04-CONTEXT.md` — User decisions (all locked decisions and Claude's discretion areas)
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts` — Phase 3 protocol (to extend)
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/WorkerBridge.ts` — Phase 3 bridge (to use)
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/handlers/cards.handler.ts` — Handler pattern to follow
- `/Users/mshaler/Developer/Projects/Isometry/src/database/schema.sql` — Confirmed `ui_state` table present

### Secondary (MEDIUM confidence)
- Vitest 4.0 `requestAnimationFrame` behavior in node environment — verified by existing test config (`environment: 'node'`) and known browser API absence in Node.js

### Tertiary (LOW confidence)
- None — all findings grounded in the project's own spec files and existing code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all primitives confirmed in codebase
- Architecture: HIGH — canonical Providers.md and PHASE-4-PROVIDERS.md give detailed contracts
- Pitfalls: HIGH — derived from explicit spec warnings (P11, P21 from memory), existing test patterns, and TypeScript/runtime interaction knowledge

**Research date:** 2026-02-28
**Valid until:** 2026-04-28 (stable specs, no fast-moving dependencies)
