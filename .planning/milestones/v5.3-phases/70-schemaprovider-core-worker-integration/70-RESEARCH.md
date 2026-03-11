# Phase 70: SchemaProvider Core + Worker Integration - Research

**Researched:** 2026-03-11
**Domain:** Runtime schema introspection, provider architecture, worker protocol extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**LATCH classification rules:**
- Hardcoded pattern-matching heuristics (not config-driven): `*_at` → Time, `name` → Alphabet, `folder/status/card_type/source` → Category, `priority/sort_order` → Hierarchy, `latitude/longitude/location_name` → Location
- Unmatched columns fall back to **Alphabet** family (most generic, always safe)
- Numeric detection uses **SQLite type affinity** from PRAGMA (INTEGER/REAL → numeric) — no separate hardcoded numeric list
- Introspect **both cards and connections** tables (all user-facing tables)

**Allowlist migration:**
- SchemaProvider **replaces** the frozen Set instances in `allowlist.ts` as the single runtime validation source
- Compile-time union types (`FilterField`, `AxisField`) **stay** in `types.ts` for compile-time safety — belt-and-suspenders
- Allowlist validation functions (`isValidFilterField`, `validateAxisField`, etc.) **delegate to SchemaProvider** instead of frozen sets
- Worker side gets a **raw `Set<string>`** of valid column names from PRAGMA — lightweight, no full SchemaProvider class in Worker context

**Validation strictness:**
- Column names failing `[a-zA-Z0-9_]` regex: **skip + console.warn** — one bad column doesn't prevent startup
- SQLite system columns (`rowid`, `_rowid_`, `oid`, underscore-prefixed): **excluded** from exposed schema
- `deleted_at`: **excluded** — internal plumbing, always in WHERE clause implicitly
- `id` (UUID primary key): **excluded** — FK plumbing, never user-facing for filter/sort/group

**Ready message shape:**
- Worker runs PRAGMA on both tables, **pre-classifies** into ColumnInfo objects with LATCH family — main thread trusts Worker classification
- **Extend WorkerReadyMessage**: `{ type: 'ready', timestamp, schema: { cards: ColumnInfo[], connections: ColumnInfo[] } }`
- WorkerBridge receives ready message, extracts schema, **passes to SchemaProvider.initialize(columns)** — SchemaProvider is single owner, WorkerBridge doesn't store it

### Claude's Discretion
- ColumnInfo interface shape (exact fields beyond name/type/nullability/latchFamily)
- SchemaProvider subscribe/notify implementation details (follows existing queueMicrotask pattern)
- How allowlist.ts validation functions are re-routed (import path changes)
- Worker-side raw Set<string> implementation details
- Test structure and fixture design

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SCHM-01 | SchemaProvider exposes typed column metadata (name, type, nullability, LATCH family) from PRAGMA table_info(cards) | Database.exec() can run PRAGMA; ColumnInfo interface to be designed; pure classify() function |
| SCHM-02 | Schema metadata arrives in the Worker ready message — available before StateManager.restore() runs | WorkerReadyMessage at protocol.ts:482 — add `schema` field; worker.ts:99 builds readyMessage |
| SCHM-03 | SchemaProvider classifies columns into LATCH families via name pattern and type affinity heuristics | Hardcoded pattern rules locked; SQLite type affinity (INTEGER/REAL) from PRAGMA `type` column |
| SCHM-04 | Worker-side and main-thread validation sets independently populated from same PRAGMA source | Worker: raw Set<string>; main: SchemaProvider.initialize(); both from readyMessage.schema |
| SCHM-05 | Column names with chars outside [a-zA-Z0-9_] rejected at introspection time (SQL injection prevention) | Skip + console.warn pattern; regex test before pushing to ColumnInfo array |
| SCHM-06 | SchemaProvider replaces frozen Set instances in allowlist.ts as single runtime validation source | 11 call sites importing from allowlist identified; delegation pattern needed |
| SCHM-07 | WorkerBridge receives ready message, extracts schema, passes to SchemaProvider.initialize() | WorkerBridge.handleMessage() at WorkerBridge.ts:515; isReadyMessage guard at protocol.ts:510 |
</phase_requirements>

---

## Summary

Phase 70 replaces the hardcoded frozen-Set allowlists in `src/providers/allowlist.ts` with runtime schema introspection. The Worker already has all the plumbing needed: `Database.exec()` can run PRAGMA queries, `initialize()` in worker.ts is where the ready message is built, and the `WorkerReadyMessage` interface in protocol.ts is a clean single-field extension point.

The existing provider pattern (subscribe/notify via queueMicrotask, StateCoordinator registration) is extremely consistent across FilterProvider, PAFVProvider, AliasProvider, and SuperDensityProvider — SchemaProvider follows this pattern identically except it is NOT persistable (schema is derived from PRAGMA, not user state). The key architectural insight: SchemaProvider is initialized exactly once from the ready message and never re-initialized. Subscribers are notified once after initialize() completes.

The allowlist delegation refactor touches 11 import sites across 9 files. The critical constraint is that validation functions must remain callable in both Worker context (where SchemaProvider is not present — only the raw Set<string> from the ready message) and main-thread context (where SchemaProvider is the authority). This means the Worker handlers that currently call `validateAxisField` / `validateFilterField` need their own validation path using the raw Set passed in the ready message.

**Primary recommendation:** Build in two waves — (1) Worker PRAGMA introspection + extended ready message, (2) SchemaProvider class + allowlist delegation — keeping each wave independently testable.

---

## Standard Stack

### Core (all pre-existing — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js | 1.14 (custom FTS5 WASM) | PRAGMA table_info source | System of record |
| TypeScript 5.9 (strict) | 5.9 | ColumnInfo interface, asserts narrowing | Project standard |

No new npm packages required. This phase is pure TypeScript + existing sql.js API.

---

## Architecture Patterns

### Recommended Project Structure

New files:
```
src/providers/
├── SchemaProvider.ts        # New: subscribe/notify, initialize(), isValidColumn()
src/worker/
├── schema-classifier.ts     # New: pure classify() function (testable in isolation)
```

Modified files:
```
src/worker/
├── protocol.ts              # Extend WorkerReadyMessage + add ColumnInfo interface
├── worker.ts                # PRAGMA introspection in initialize(); extend readyMessage
├── WorkerBridge.ts          # Extract schema from ready message; call SchemaProvider.initialize()
src/providers/
├── allowlist.ts             # Delegate isValid*() to SchemaProvider; keep frozen sets as fallback
├── index.ts                 # Export SchemaProvider
src/main.ts                  # Instantiate SchemaProvider; register with StateCoordinator
```

### Pattern 1: Worker PRAGMA Introspection

**What:** Run `PRAGMA table_info(cards)` and `PRAGMA table_info(connections)` in `initialize()` after `db.initialize()`, classify columns, include in ready message.

**When to use:** Exactly once, inside the Worker's `initialize()` function, after the Database is ready.

**Example:**
```typescript
// In worker.ts initialize() — after db.initialize() succeeds, before postMessage
const rawCards = db.exec('PRAGMA table_info(cards)');
const rawConns = db.exec('PRAGMA table_info(connections)');
// db.exec() returns [{ columns: string[], values: unknown[][] }]
// PRAGMA table_info columns: [cid, name, type, notnull, dflt_value, pk]

const readyMessage: WorkerReadyMessage = {
  type: 'ready',
  timestamp: Date.now(),
  schema: {
    cards: classifyColumns(rawCards),
    connections: classifyColumns(rawConns),
  },
};
self.postMessage(readyMessage);
```

### Pattern 2: ColumnInfo Interface (in protocol.ts)

**What:** Plain object — must be structuredClone-safe (no class instances).

**When to use:** In the Worker (built from PRAGMA), in the ready message, in SchemaProvider after transfer.

```typescript
// In protocol.ts
export type LatchFamily = 'Location' | 'Alphabet' | 'Time' | 'Category' | 'Hierarchy';

export interface ColumnInfo {
  name: string;          // Column name (already validated [a-zA-Z0-9_])
  type: string;          // SQLite declared type (TEXT, INTEGER, REAL, etc.)
  notnull: boolean;      // PRAGMA notnull = 1
  latchFamily: LatchFamily;
  isNumeric: boolean;    // true if INTEGER or REAL affinity
}
```

### Pattern 3: Pure Classifier Function (in schema-classifier.ts)

**What:** A pure function, callable in Worker context with no imports from provider layer.

**Why isolated:** Worker imports cannot pull in main-thread provider code without bundle bloat. Pure function is trivially unit-testable with plain objects.

```typescript
// In src/worker/schema-classifier.ts
const EXCLUDED_COLUMNS = new Set(['id', 'deleted_at', 'rowid', '_rowid_', 'oid']);
const COLUMN_NAME_RE = /^[a-zA-Z0-9_]+$/;

export function classifyColumns(pragmaResult: { columns: string[]; values: unknown[][] }[]): ColumnInfo[] {
  if (!pragmaResult.length) return [];
  const { columns, values } = pragmaResult[0];
  const nameIdx = columns.indexOf('name');
  const typeIdx = columns.indexOf('type');
  const notnullIdx = columns.indexOf('notnull');

  const result: ColumnInfo[] = [];
  for (const row of values) {
    const name = String(row[nameIdx]);
    // Skip excluded and system columns
    if (EXCLUDED_COLUMNS.has(name) || name.startsWith('_')) continue;
    // SQL injection prevention at introspection time
    if (!COLUMN_NAME_RE.test(name)) {
      console.warn(`[SchemaProvider] Skipping column with invalid name: "${name}"`);
      continue;
    }
    const type = String(row[typeIdx] ?? '').toUpperCase();
    const notnull = Number(row[notnullIdx]) === 1;
    result.push({
      name,
      type,
      notnull,
      latchFamily: classifyLatch(name, type),
      isNumeric: type === 'INTEGER' || type === 'REAL',
    });
  }
  return result;
}

function classifyLatch(name: string, _type: string): LatchFamily {
  if (name.endsWith('_at')) return 'Time';
  if (name === 'name') return 'Alphabet';
  if (['folder', 'status', 'card_type', 'source'].includes(name)) return 'Category';
  if (['priority', 'sort_order'].includes(name)) return 'Hierarchy';
  if (['latitude', 'longitude', 'location_name'].includes(name)) return 'Location';
  return 'Alphabet'; // Safe fallback
}
```

### Pattern 4: WorkerReadyMessage Extension

The current interface (protocol.ts:482):
```typescript
export interface WorkerReadyMessage {
  type: 'ready';
  timestamp: number;
}
```

Extended interface:
```typescript
export interface WorkerReadyMessage {
  type: 'ready';
  timestamp: number;
  schema: {
    cards: ColumnInfo[];
    connections: ColumnInfo[];
  };
}
```

The `isReadyMessage` type guard at protocol.ts:510 checks only `type === 'ready'` — it will continue to work after extension without modification.

### Pattern 5: SchemaProvider Class

**What:** Non-persistable provider. Single initialize() call. subscribe/notify via queueMicrotask (identical to FilterProvider and AliasProvider).

**When to use:** Instantiated in main.ts before `bridge.isReady`. Initialized inside the `bridge.isReady` resolution callback.

```typescript
// src/providers/SchemaProvider.ts
export class SchemaProvider {
  private _cards: ColumnInfo[] = [];
  private _connections: ColumnInfo[] = [];
  private _validCardColumns: Set<string> = new Set();
  private _validConnectionColumns: Set<string> = new Set();
  private _initialized = false;
  private _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  initialize(schema: { cards: ColumnInfo[]; connections: ColumnInfo[] }): void {
    this._cards = schema.cards;
    this._connections = schema.connections;
    this._validCardColumns = new Set(schema.cards.map(c => c.name));
    this._validConnectionColumns = new Set(schema.connections.map(c => c.name));
    this._initialized = true;
    this._scheduleNotify();
  }

  getColumns(table: 'cards' | 'connections'): readonly ColumnInfo[] {
    return table === 'cards' ? this._cards : this._connections;
  }

  isValidColumn(name: string, table: 'cards' | 'connections' = 'cards'): boolean {
    return table === 'cards'
      ? this._validCardColumns.has(name)
      : this._validConnectionColumns.has(name);
  }

  subscribe(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  private _scheduleNotify(): void {
    if (this._pendingNotify) return;
    this._pendingNotify = true;
    queueMicrotask(() => {
      this._pendingNotify = false;
      this._subscribers.forEach(cb => cb());
    });
  }
}
```

### Pattern 6: Allowlist Delegation

The existing frozen sets in allowlist.ts act as compile-time helpers — they remain for TypeScript narrowing (type guards `field is FilterField` etc.) but delegate to SchemaProvider for the actual boolean check at runtime.

```typescript
// allowlist.ts after delegation
import type { SchemaProvider } from './SchemaProvider';

let _schemaProvider: SchemaProvider | null = null;

export function setSchemaProvider(sp: SchemaProvider): void {
  _schemaProvider = sp;
}

export function isValidFilterField(field: string): field is FilterField {
  if (_schemaProvider) return _schemaProvider.isValidColumn(field, 'cards');
  // Fallback: frozen set (for tests that don't wire SchemaProvider)
  return (ALLOWED_FILTER_FIELDS as Set<string>).has(field);
}

export function isValidAxisField(field: string): field is AxisField {
  if (_schemaProvider) return _schemaProvider.isValidColumn(field, 'cards');
  return (ALLOWED_AXIS_FIELDS as Set<string>).has(field);
}
```

**Note:** Worker-context callers (chart.handler.ts, supergrid.handler.ts, histogram.handler.ts) currently import `validateAxisField` / `validateFilterField` from allowlist.ts. After Phase 70, these Worker-side handlers need a Worker-local validation mechanism — either a raw `Set<string>` built from the ready message passed in during initialize(), or an updated signature that receives the valid column set. This is the most significant refactor risk.

### Pattern 7: main.ts Integration

**Insert at step 2 (after `bridge.isReady`):**
```typescript
// 2b. Create SchemaProvider — populated from ready message schema
const schemaProvider = new SchemaProvider();
// SchemaProvider.initialize() is called inside WorkerBridge's ready handler
// and is synchronous — by the time bridge.isReady resolves, schema is populated.

// Wire allowlist delegation
setSchemaProvider(schemaProvider);

// Register with coordinator
coordinator.registerProvider('schema', schemaProvider);
```

**Critical ordering:** `setSchemaProvider()` must be called before any validation functions are used. Since `bridge.isReady` resolves after schema arrives, this is guaranteed.

### Pattern 8: WorkerBridge Ready Message Handling

Current handler (WorkerBridge.ts:519-527):
```typescript
if (isReadyMessage(message)) {
  this.ready = true;
  this.resolveReady();
  // ...
  return;
}
```

Extended handler:
```typescript
if (isReadyMessage(message)) {
  this.ready = true;
  // Extract schema BEFORE resolving isReady — callers get schema synchronously
  if (this._onSchema && message.schema) {
    this._onSchema(message.schema);
  }
  this.resolveReady();
  return;
}
```

**Alternative:** Pass a callback `onSchema` to WorkerBridge constructor, or expose the schema on the bridge object. Given that "WorkerBridge doesn't store it" is a locked decision, the callback pattern is cleaner.

### Anti-Patterns to Avoid

- **Re-classifying on main thread:** Main thread trusts Worker's ColumnInfo classification — don't re-run LATCH heuristics on arrival.
- **Importing SchemaProvider in Worker context:** The Worker only works with raw `Set<string>` and the pure `classifyColumns()` function. Never import the SchemaProvider class into worker.ts.
- **Awaiting schema asynchronously after bridge.isReady:** The schema is embedded in the ready message — it arrives synchronously as part of `isReady` resolution. No separate message or second await is needed.
- **Mutating allowlist frozen sets:** The frozen sets in allowlist.ts remain read-only — delegation bypasses them at runtime but doesn't remove them (compile-time narrowing still uses them for `is FilterField` type guards).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PRAGMA row parsing | Custom SQL parser | `db.exec('PRAGMA table_info(...)')` returns `{ columns, values }` | Already wired in Database.exec() |
| structuredClone safety | Serialization wrapper | Plain ColumnInfo objects (no class instances, no methods) | postMessage automatically structuredClones |
| Column name validation | Custom tokenizer | Single `/^[a-zA-Z0-9_]+$/` regex test | Sufficient for SQL identifier safety |

---

## Common Pitfalls

### Pitfall 1: Worker Handlers Cannot Use Main-Thread SchemaProvider

**What goes wrong:** chart.handler.ts, supergrid.handler.ts, histogram.handler.ts all call `validateAxisField` / `validateFilterField` from allowlist.ts. After delegation, allowlist.ts checks SchemaProvider — but `_schemaProvider` is null in Worker context, causing fallback to frozen sets.

**Why it happens:** Workers are separate JS contexts. SchemaProvider instance lives on the main thread only. The Worker's allowlist.ts module is a separate instance with `_schemaProvider = null`.

**How to avoid:** Worker-side validation must use the raw `Set<string>` built from the ready message schema. Two approaches:
  - Pass the valid column set to each Worker handler that needs validation (cleanest for testing)
  - Store the column set as Worker-module-level state, populated during `initialize()` before `processPendingQueue()`

**Warning signs:** Worker handler tests fail with "not an allowed axis field" errors after delegation refactor.

### Pitfall 2: isReadyMessage Type Guard Must Include Schema Field

**What goes wrong:** The `isReadyMessage` type guard checks `type === 'ready'`. After adding `schema` to `WorkerReadyMessage`, any code that narrows on `isReadyMessage` needs schema to be non-optional — or the type guard needs updating.

**How to avoid:** Make `schema` required (not optional) in `WorkerReadyMessage`. This forces the Worker to always include it, and prevents TypeScript from treating it as potentially absent.

### Pitfall 3: StateCoordinator Registration Order

**What goes wrong:** StateCoordinator's `scheduleUpdate()` fires ~16ms after any provider changes. If SchemaProvider notifies before views are mounted, views receive an update while still null.

**Why it happens:** SchemaProvider notifies once during `initialize()`. If registered before views exist, StateCoordinator fires its batch update before views are set up.

**How to avoid:** Register SchemaProvider with StateCoordinator after all views are wired (step 10-12 in main.ts), or ensure the first SchemaProvider notification is safe to receive before views are mounted. Alternative: `scheduleUpdate()` is a no-op if no StateCoordinator subscribers have been added yet — registration order matters for the coordinator's subscriber set.

### Pitfall 4: PRAGMA exec() Returns Empty Array for Non-Existent Tables

**What goes wrong:** `db.exec('PRAGMA table_info(nonexistent)')` returns `[]` (empty array), not an error. If the table doesn't exist yet (e.g., during tests with partial schema), `classifyColumns([])` returns `[]` silently.

**How to avoid:** After running PRAGMA, validate that the result has at least one row. If `cards` returns empty, throw — it indicates schema initialization failure.

### Pitfall 5: Worker-Side PRAGMA Runs After db.initialize(), Not Before

**What goes wrong:** Running PRAGMA before `db.initialize()` completes results in an empty or non-existent schema being introspected.

**How to avoid:** PRAGMA introspection in worker.ts `initialize()` must be placed after `await db.initialize(wasmBinary, dbData)` and before `self.postMessage(readyMessage)`. Current ordering at worker.ts:94-103 makes this natural.

---

## Code Examples

### PRAGMA table_info() Result Shape

```typescript
// db.exec('PRAGMA table_info(cards)') returns:
[{
  columns: ['cid', 'name', 'type', 'notnull', 'dflt_value', 'pk'],
  values: [
    [0, 'id', 'TEXT', 1, null, 1],
    [1, 'card_type', 'TEXT', 1, "'note'", 0],
    [2, 'name', 'TEXT', 1, null, 0],
    [3, 'content', 'TEXT', 0, null, 0],
    // ... etc
  ]
}]
```

Column index mapping (by column name, not positional — always use indexOf):
- `cid`: 0-based column index
- `name`: column name string
- `type`: declared type string ("TEXT", "INTEGER", "REAL", etc.)
- `notnull`: 1 if NOT NULL constraint present, else 0
- `dflt_value`: default value or null
- `pk`: 1 if part of PRIMARY KEY, else 0

### Current WorkerReadyMessage Definition

**File:** `src/worker/protocol.ts`, line 482

```typescript
export interface WorkerReadyMessage {
  type: 'ready';
  /** Timestamp when worker became ready (for latency tracking) */
  timestamp: number;
}
```

**Type guard** at line 510:
```typescript
export function isReadyMessage(msg: unknown): msg is WorkerReadyMessage {
  return typeof msg === 'object' && msg !== null && 'type' in msg && (msg as WorkerReadyMessage).type === 'ready';
}
```

The type guard checks only `type === 'ready'` — adding `schema` to the interface does not break this guard. However, once `schema` is required in the interface, TypeScript will enforce that any code constructing a `WorkerReadyMessage` must include it.

### Current WorkerBridge Ready Handler

**File:** `src/worker/WorkerBridge.ts`, lines 515-527

```typescript
private handleMessage(event: MessageEvent<WorkerMessage>): void {
  const message = event.data;

  if (isReadyMessage(message)) {
    this.ready = true;
    this.resolveReady();
    if (this.config.debug) {
      console.log('[WorkerBridge] Worker ready');
    }
    return;
  }
  // ...
}
```

This is the single integration point for schema extraction in WorkerBridge.

### Current worker.ts ready message construction

**File:** `src/worker/worker.ts`, lines 92-115

```typescript
async function initialize(wasmBinary?: ArrayBuffer, dbData?: ArrayBuffer): Promise<void> {
  try {
    db = new Database();
    await db.initialize(wasmBinary, dbData);
    isInitialized = true;

    // Signal ready to main thread
    const readyMessage: WorkerReadyMessage = {
      type: 'ready',
      timestamp: Date.now(),
    };
    self.postMessage(readyMessage);

    // Process any queued messages
    await processPendingQueue();
  } catch (error) {
    // ...
  }
}
```

**Integration point:** PRAGMA introspection and `classifyColumns()` call go between lines 95 (`await db.initialize(...)`) and 99 (`const readyMessage = ...`).

### Current allowlist.ts Exports and All Consumers

**File:** `src/providers/allowlist.ts`

Exports:
- `ALLOWED_FILTER_FIELDS: ReadonlySet<FilterField>` — frozen Set (16 fields)
- `ALLOWED_AXIS_FIELDS: ReadonlySet<AxisField>` — frozen Set (9 fields)
- `ALLOWED_OPERATORS: ReadonlySet<FilterOperator>` — frozen Set (11 operators)
- `isValidFilterField(field: string): field is FilterField`
- `isValidOperator(op: string): op is FilterOperator`
- `isValidAxisField(field: string): field is AxisField`
- `validateFilterField(field: string): asserts field is FilterField`
- `validateOperator(op: string): asserts op is FilterOperator`
- `validateAxisField(field: string): asserts field is AxisField`

Consumer breakdown by context:

**Main-thread consumers (will delegate to SchemaProvider):**
| File | What it imports |
|------|----------------|
| `src/providers/FilterProvider.ts` | `validateFilterField`, `validateOperator` |
| `src/providers/PAFVProvider.ts` | `validateAxisField` |
| `src/providers/AliasProvider.ts` | `isValidAxisField` |
| `src/providers/SuperDensityProvider.ts` | `ALLOWED_AXIS_FIELDS` (iteration only) |
| `src/ui/PropertiesExplorer.ts` | `ALLOWED_AXIS_FIELDS` (iteration only) |
| `src/ui/ProjectionExplorer.ts` | `ALLOWED_AXIS_FIELDS` (iteration only) |
| `src/ui/charts/ChartRenderer.ts` | `ALLOWED_AXIS_FIELDS` (iteration only) |

**Worker-context consumers (need Worker-local validation):**
| File | What it imports |
|------|----------------|
| `src/worker/handlers/chart.handler.ts` | `validateAxisField` |
| `src/worker/handlers/supergrid.handler.ts` | `validateAxisField` |
| `src/worker/handlers/histogram.handler.ts` | `validateFilterField` |
| `src/views/supergrid/SuperGridQuery.ts` | `validateAxisField` (called from Worker handler) |

**Public API consumers (re-exported through index.ts and src/index.ts):**
| File | Re-exports |
|------|-----------|
| `src/providers/index.ts` | All allowlist exports |
| `src/index.ts` | `isValidAxisField`, `isValidFilterField`, `validateAxisField`, `validateFilterField` |

**Note on `ALLOWED_AXIS_FIELDS` iteration consumers:** SuperDensityProvider, PropertiesExplorer, ProjectionExplorer, and ChartRenderer iterate the `ALLOWED_AXIS_FIELDS` set to populate UI lists. After Phase 70, these should call `schemaProvider.getColumns('cards')` instead. This is a secondary refactor — the locked decisions only mandate delegation for validation functions, but iteration consumers should also migrate for correctness.

### Provider Pattern Template (subscribe/notify)

Based on AliasProvider (simplest recent provider — added in Phase 55):

```typescript
export class SchemaProvider {
  // State
  private _cards: ColumnInfo[] = [];
  private _connections: ColumnInfo[] = [];
  private _validCardColumns: Set<string> = new Set();
  private _validConnectionColumns: Set<string> = new Set();
  private _initialized = false;

  // Subscribe/notify
  private _subscribers = new Set<() => void>();
  private _pendingNotify = false;

  subscribe(callback: () => void): () => void {
    this._subscribers.add(callback);
    return () => this._subscribers.delete(callback);
  }

  private _scheduleNotify(): void {
    if (this._pendingNotify) return;
    this._pendingNotify = true;
    queueMicrotask(() => {
      this._pendingNotify = false;
      this._subscribers.forEach(cb => cb());
    });
  }
}
```

StateCoordinator registration (from main.ts pattern — requires a `subscribe()` method):
```typescript
coordinator.registerProvider('schema', schemaProvider);
```

### Database Schema — Cards Table Columns

From `src/database/schema.sql`:

| Column | Type | NOT NULL | Notes |
|--------|------|----------|-------|
| `id` | TEXT | YES | PK — excluded from SchemaProvider |
| `card_type` | TEXT | YES | Category family |
| `name` | TEXT | YES | Alphabet family |
| `content` | TEXT | NO | Alphabet fallback |
| `summary` | TEXT | NO | Alphabet fallback |
| `latitude` | REAL | NO | Location family |
| `longitude` | REAL | NO | Location family |
| `location_name` | TEXT | NO | Location family |
| `created_at` | TEXT | YES | Time family (`_at` suffix) |
| `modified_at` | TEXT | YES | Time family (`_at` suffix) |
| `due_at` | TEXT | NO | Time family (`_at` suffix) |
| `completed_at` | TEXT | NO | Time family (`_at` suffix) |
| `event_start` | TEXT | NO | Alphabet fallback (no `_at`) |
| `event_end` | TEXT | NO | Alphabet fallback (no `_at`) |
| `folder` | TEXT | NO | Category family |
| `tags` | TEXT | NO | Alphabet fallback (JSON array) |
| `status` | TEXT | NO | Category family |
| `priority` | INTEGER | YES | Hierarchy family |
| `sort_order` | INTEGER | YES | Hierarchy family |
| `url` | TEXT | NO | Alphabet fallback |
| `mime_type` | TEXT | NO | Alphabet fallback |
| `is_collective` | INTEGER | YES | Alphabet fallback |
| `source` | TEXT | NO | Category family |
| `source_id` | TEXT | NO | Alphabet fallback |
| `source_url` | TEXT | NO | Alphabet fallback |
| `deleted_at` | TEXT | NO | **excluded** — internal plumbing |

### Database Schema — Connections Table Columns

| Column | Type | NOT NULL | Notes |
|--------|------|----------|-------|
| `id` | TEXT | YES | PK — excluded from SchemaProvider |
| `source_id` | TEXT | YES | Alphabet fallback |
| `target_id` | TEXT | YES | Alphabet fallback |
| `via_card_id` | TEXT | NO | Alphabet fallback |
| `label` | TEXT | NO | Alphabet fallback |
| `weight` | REAL | YES | Alphabet fallback (numeric) |
| `created_at` | TEXT | YES | Time family (`_at` suffix) |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded frozen sets in allowlist.ts | Runtime PRAGMA introspection via SchemaProvider | Phase 70 | New columns automatically available without code changes |
| Static `WorkerReadyMessage { type, timestamp }` | Extended with `schema: { cards, connections }` | Phase 70 | Schema arrives atomically with ready signal |

**Existing state that STAYS unchanged:**
- Compile-time union types `FilterField`, `AxisField` in `src/providers/types.ts` — remain for TypeScript narrowing
- `ALLOWED_OPERATORS` frozen set — operators are not schema-derived, stays frozen
- `validateOperator` / `isValidOperator` — operators are not database columns, no delegation needed

---

## Open Questions

1. **Worker-side validation refactor strategy for handlers**
   - What we know: chart.handler.ts, supergrid.handler.ts, histogram.handler.ts import and call `validateAxisField`/`validateFilterField` from allowlist.ts. In Worker context, `_schemaProvider` will be null — fallback to frozen sets activates.
   - What's unclear: Whether the frozen-set fallback is sufficient (it matches current ALLOWED_AXIS_FIELDS), or if handlers need to receive the valid column Set explicitly.
   - Recommendation: The frozen-set fallback in Worker context is safe for Phase 70 — the PRAGMA-derived set should match the frozen set for the current schema. Explicit Worker-side Set injection is a Phase 71+ hardening step. Document the fallback behavior clearly.

2. **ALLOWED_AXIS_FIELDS iteration sites migration timing**
   - What we know: 4 files iterate `ALLOWED_AXIS_FIELDS` for UI population (not validation). These should migrate to `schemaProvider.getColumns('cards')` for correctness.
   - What's unclear: Whether Phase 70 scope includes UI migration or just validation delegation.
   - Recommendation: Phase 70 can leave iteration sites on the frozen set with a TODO. The locked decision only specifies validation delegation. Iteration migration can be a separate task within this phase or deferred.

3. **WorkerBridge onSchema callback vs constructor parameter**
   - What we know: WorkerBridge doesn't store the schema (locked). SchemaProvider.initialize() must be called before `isReady` resolves.
   - Recommendation: Add `onSchema?: (schema: { cards: ColumnInfo[]; connections: ColumnInfo[] }) => void` to `WorkerBridgeConfig`. Called inside `handleMessage` before `resolveReady()`. main.ts passes `onSchema: (schema) => schemaProvider.initialize(schema)`.

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `src/worker/worker.ts`, `src/worker/WorkerBridge.ts`, `src/worker/protocol.ts` — exact line numbers verified
- Direct file reads: `src/providers/allowlist.ts`, `src/providers/FilterProvider.ts`, `src/providers/AliasProvider.ts`, `src/providers/StateCoordinator.ts`, `src/providers/StateManager.ts` — pattern templates verified
- Direct file read: `src/database/schema.sql` — all 25 cards columns + 7 connections columns documented
- Direct file read: `src/main.ts` — full initialization sequence mapped

### Secondary (MEDIUM confidence)
- grep across codebase: 11 allowlist import sites identified — complete list
- grep: `validateAxisField` / `validateFilterField` call sites mapped — complete list

---

## Metadata

**Confidence breakdown:**
- Worker initialization flow: HIGH — read worker.ts lines 92-115 directly
- WorkerBridge ready handler: HIGH — read WorkerBridge.ts lines 515-527 directly
- allowlist.ts exports and consumers: HIGH — grepped all 11 import sites
- Provider pattern: HIGH — read FilterProvider, AliasProvider, StateCoordinator directly
- Database schema: HIGH — read schema.sql directly
- StateManager.restore() wiring: HIGH — confirmed NOT called in main.ts (tests only)
- Worker-context validation risk: MEDIUM — behavior depends on implementation choice

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (stable codebase, no external dependencies changing)
