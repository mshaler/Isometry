# Phase 16: SuperGridQuery Worker Wiring - Research

**Researched:** 2026-03-04
**Domain:** Worker protocol extension, Worker handler, WorkerBridge typed method, rAF coalescing
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Response contract**
- card_ids returned as **parsed string[]** — Worker splits GROUP_CONCAT result before responding, not raw comma string
- Response shape is **cells only**: `{ cells: [...] }` — main thread derives header values (unique rowKeys, colKeys) from the cells array
- Cell properties use **individual SQL column names** as properties (e.g., `{ card_type: 'note', folder: 'Inbox', count: 5, card_ids: ['id1', 'id2'] }`) — not composite rowKey/colKey strings
- Request payload uses **full SuperGridQueryConfig interface**: `{ colAxes: AxisMapping[], rowAxes: AxisMapping[], where: string, params: unknown[] }` — maintains parity with existing buildSuperGridQuery() signature

**Frame deduplication**
- Single-query-per-frame guarantee lives **inside WorkerBridge.superGridQuery()** — callers don't need to think about dedup
- When a newer request arrives while one is in-flight, **stale response is silently discarded** (latest-wins via correlation ID comparison) — no cancellation, no error
- Coalescing uses **requestAnimationFrame** to batch within the visual frame boundary (aligned with 16ms budget)
- API is **Promise-based** — `superGridQuery()` returns `Promise<CellDatum[]>`, consistent with all other WorkerBridge methods

**Distinct values (db:distinct-values)**
- **Single column per request**: payload is `{ column: string, where?: string, params?: unknown[] }`, response is `{ values: string[] }`
- **Respects current WHERE filters** — returns values scoped to the current view, not the full table
- Column validated against **axis allowlist** (validateAxisField) — same 9-field set as supergrid:query
- Values returned **sorted alphabetically ASC** (ORDER BY column ASC)

**Error handling**
- Axis validation errors use existing **INVALID_REQUEST** WorkerErrorCode — no new error codes
- Handler **relies on buildSuperGridQuery()'s internal validateAxisField()** call — no duplicate pre-validation (DRY)
- Main thread **console.warn + reject** on INVALID_REQUEST — visible during development, propagated for caller handling
- **Empty axis arrays** (no colAxes AND no rowAxes) are NOT an error — return single cell with total count and all card_ids (graceful fallback)

### Claude's Discretion
- Exact handler file naming and internal structure (e.g., `supergrid.handler.ts` vs inline in router)
- Whether rAF coalescing uses a dedicated `_pendingSuperGridConfig` field or a more generic pattern
- Whether to add a 'VALIDATION_ERROR' classification path in classifyError() for future use
- Test fixture design and mocking strategy for Worker handler tests

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUN-05 | Worker handles `supergrid:query` message type executing `buildSuperGridQuery()` and returning `{ cells: [{rowKey, colKey, count, card_ids}] }` | Protocol extension pattern established (add to WorkerRequestType union + WorkerPayloads + WorkerResponses). buildSuperGridQuery() already validated — only needs GROUP_CONCAT split + structuring into CellDatum[] on the handler side. |
| FOUN-06 | Worker handles `db:distinct-values` message type for column distinct value queries | Same protocol extension pattern. Handler executes simple SELECT DISTINCT query. Column validation reuses validateAxisField() from allowlist.ts. |
| FOUN-07 | WorkerBridge exposes typed `superGridQuery()` method with correlation ID tracking | WorkerBridge.send() already provides full correlation ID tracking via the pending Map. superGridQuery() wraps send() like all other bridge methods, adding rAF coalescing + latest-wins discard on top. |
</phase_requirements>

---

## Summary

Phase 16 wires the existing dead-code `buildSuperGridQuery()` function to the Worker via two new typed message types: `supergrid:query` and `db:distinct-values`. The codebase already has every building block — the extension pattern is well-established and requires no new infrastructure.

The implementation follows the established four-step protocol extension process: add types to `WorkerRequestType` union → add payload shapes to `WorkerPayloads` → add response shapes to `WorkerResponses` → add cases to `routeRequest()` exhaustive switch. The Worker router's `never` exhaustive check enforces that no new type can be added to the union without a corresponding case.

The primary novel concern in this phase is the rAF coalescing contract on `WorkerBridge.superGridQuery()`. The `requestAnimationFrame`-based latest-wins pattern is already used by `MutationManager.scheduleNotify()` and the design is well-understood. The key constraint is that stale responses must be silently discarded (not rejected), implemented via correlation ID comparison rather than request cancellation.

**Primary recommendation:** Follow the established protocol extension pattern exactly. Handler goes in `src/worker/handlers/supergrid.handler.ts`. rAF coalescing belongs entirely in `WorkerBridge.superGridQuery()` — the Worker itself is stateless per-request.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript (strict) | 5.9 | Type system, compile-time protocol safety | Project standard D-001 |
| Vitest | 4.0 | Test framework | Project standard, already configured |
| sql.js (Worker-side) | 1.14 custom | Executes the GROUP BY SQL query | Already in Worker — no new dep |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitest/web-worker | configured | Integration test infrastructure | Already used in integration.test.ts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| rAF coalescing | setTimeout(0) coalescing | rAF aligns with visual frame budget; setTimeout(0) fires before render; rAF is correct for this use case |
| rAF coalescing | AbortController cancellation | Cancellation adds complexity; latest-wins discard is simpler and sufficient for this use case (decided in CONTEXT.md) |
| INVALID_REQUEST error code | New VALIDATION_ERROR code | CONTEXT.md decision: reuse INVALID_REQUEST; VALIDATION_ERROR classification path left as Claude's discretion for future |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── worker/
│   ├── protocol.ts          # Add supergrid:query + db:distinct-values types here
│   ├── worker.ts            # Add cases to routeRequest() switch
│   ├── WorkerBridge.ts      # Add superGridQuery() + distinctValues() methods
│   └── handlers/
│       └── supergrid.handler.ts   # NEW: handleSuperGridQuery + handleDistinctValues
tests/
├── worker/
│   ├── protocol.test.ts          # Add type coverage for new message types
│   └── supergrid.handler.test.ts # NEW: handler unit tests (no Worker dependency)
└── providers/
    └── WorkerBridge-supergrid.test.ts  # NEW: rAF coalescing + stale discard tests
```

### Pattern 1: Protocol Extension (Four-Step)

**What:** Every new Worker message type requires four coordinated changes in protocol.ts and worker.ts.
**When to use:** Any time a new `WorkerRequestType` is added.

```typescript
// Step 1: Add to WorkerRequestType union (protocol.ts)
export type WorkerRequestType =
  // ... existing types ...
  | 'supergrid:query'
  | 'db:distinct-values';

// Step 2: Add payload shape to WorkerPayloads (protocol.ts)
export interface WorkerPayloads {
  // ... existing ...
  'supergrid:query': SuperGridQueryConfig;    // reuses existing type from SuperGridQuery.ts
  'db:distinct-values': {
    column: string;
    where?: string;
    params?: unknown[];
  };
}

// Step 3: Add response shape to WorkerResponses (protocol.ts)
export interface WorkerResponses {
  // ... existing ...
  'supergrid:query': { cells: CellDatum[] };
  'db:distinct-values': { values: string[] };
}

// Step 4: Add cases to routeRequest() switch (worker.ts)
case 'supergrid:query': {
  const p = payload as WorkerPayloads['supergrid:query'];
  return handleSuperGridQuery(db, p);
}
case 'db:distinct-values': {
  const p = payload as WorkerPayloads['db:distinct-values'];
  return handleDistinctValues(db, p);
}
```

### Pattern 2: Handler File Structure

**What:** Domain handlers are thin delegation files in `src/worker/handlers/`.
**When to use:** Any new Worker message type with non-trivial logic.
**Example:** `simulate.handler.ts` is the canonical reference (pure function, no side effects, no Worker API dependency — testable in Node directly).

```typescript
// src/worker/handlers/supergrid.handler.ts
import { buildSuperGridQuery } from '../../views/supergrid/SuperGridQuery';
import { validateAxisField } from '../../providers/allowlist';
import type { Database } from '../../database/Database';
import type { WorkerPayloads, WorkerResponses } from '../protocol';

export interface CellDatum {
  // Individual SQL column names as properties (not composite strings)
  // e.g. for colAxes=[card_type], rowAxes=[folder]:
  card_type?: string;  // dynamic based on config
  folder?: string;     // dynamic based on config
  count: number;
  card_ids: string[];  // split from GROUP_CONCAT result
}

export function handleSuperGridQuery(
  db: Database,
  payload: WorkerPayloads['supergrid:query']
): WorkerResponses['supergrid:query'] {
  // buildSuperGridQuery() validates axes internally via validateAxisField()
  // Empty axes → returns single cell with total count (not an error)
  const { sql, params } = buildSuperGridQuery(payload);
  const rows = db.query(sql, params);

  const cells: CellDatum[] = rows.map(row => ({
    ...row,
    count: row['count'] as number,
    // Split GROUP_CONCAT string into string[] (decision from CONTEXT.md)
    card_ids: typeof row['card_ids'] === 'string'
      ? (row['card_ids'] as string).split(',').filter(Boolean)
      : [],
  }));

  return { cells };
}

export function handleDistinctValues(
  db: Database,
  payload: WorkerPayloads['db:distinct-values']
): WorkerResponses['db:distinct-values'] {
  // validateAxisField throws "SQL safety violation: ..." on invalid columns
  validateAxisField(payload.column);

  const baseWhere = 'deleted_at IS NULL';
  const filterWhere = payload.where ? ` AND ${payload.where}` : '';
  const sql = `SELECT DISTINCT ${payload.column} FROM cards WHERE ${baseWhere}${filterWhere} ORDER BY ${payload.column} ASC`;
  const params = payload.params ?? [];

  const rows = db.query(sql, params);
  const values = rows
    .map(row => row[payload.column])
    .filter((v): v is string => typeof v === 'string');

  return { values };
}
```

### Pattern 3: WorkerBridge Convenience Method with rAF Coalescing

**What:** Each domain gets a typed method on WorkerBridge wrapping `this.send()`. For SuperGrid, an rAF coalescing layer is added on top.
**When to use:** `superGridQuery()` specifically — other methods don't need coalescing.

```typescript
// Inside WorkerBridge class

/** Pending rAF config — latest-wins, replaces any queued but not-yet-sent config */
private _pendingSuperGridResolve: ((cells: CellDatum[]) => void) | null = null;
private _pendingSuperGridReject: ((e: Error) => void) | null = null;
private _pendingSuperGridConfig: SuperGridQueryConfig | null = null;
private _superGridRafId: ReturnType<typeof requestAnimationFrame> | null = null;
/** Last sent correlation ID — used to discard stale in-flight responses */
private _lastSuperGridCorrelationId: string | null = null;

/**
 * Send a supergrid:query request with rAF coalescing.
 * Multiple calls within one frame collapse to a single Worker request.
 * Stale responses (from requests superseded by newer ones) are silently discarded.
 *
 * Returns Promise<CellDatum[]>, consistent with all other WorkerBridge methods.
 */
async superGridQuery(config: SuperGridQueryConfig): Promise<CellDatum[]> {
  // Latest-wins: replace any pending config
  this._pendingSuperGridConfig = config;

  return new Promise<CellDatum[]>((resolve, reject) => {
    // Overwrite resolve/reject — only the latest caller's promise is fulfilled
    this._pendingSuperGridResolve = resolve;
    this._pendingSuperGridReject = reject;

    if (this._superGridRafId !== null) return; // rAF already scheduled

    this._superGridRafId = requestAnimationFrame(async () => {
      this._superGridRafId = null;
      const latestConfig = this._pendingSuperGridConfig!;
      const latestResolve = this._pendingSuperGridResolve!;
      const latestReject = this._pendingSuperGridReject!;
      this._pendingSuperGridConfig = null;
      this._pendingSuperGridResolve = null;
      this._pendingSuperGridReject = null;

      try {
        // send() generates the correlation ID internally
        // We track it to discard stale responses if needed
        const result = await this.send('supergrid:query', latestConfig);
        latestResolve(result.cells);
      } catch (e) {
        latestReject(e as Error);
      }
    });
  });
}
```

**Note on stale discard:** The "stale response silently discarded" contract applies to the rAF coalescing layer: a caller whose promise was replaced by a newer call within the same rAF window simply has their promise abandoned (their resolve/reject references are overwritten). Responses for in-flight requests that have already been sent to the Worker are handled by the existing `pending` Map in `WorkerBridge` — if the `pending` entry is deleted (as in terminate()), the response is ignored gracefully (see `handleResponse()` which does an early return when `pending.get()` returns undefined).

### Anti-Patterns to Avoid

- **Duplicate validateAxisField call in handler:** `buildSuperGridQuery()` already calls it internally. The CONTEXT.md decision is DRY — handler must NOT pre-validate before calling buildSuperGridQuery().
- **Composite rowKey/colKey strings:** Cell properties use individual SQL column names (e.g., `card_type`, `folder`), not pre-joined strings like `"note|Inbox"`. The main thread derives headers from cells.
- **Rejecting empty axis arrays:** Empty colAxes + empty rowAxes is valid (returns total count). Not an error.
- **rAF coalescing in the Worker:** The Worker is stateless per-request. Coalescing lives in WorkerBridge only.
- **New error codes:** No `VALIDATION_ERROR` code. Use existing `INVALID_REQUEST` (CONTEXT.md decision).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SQL safety validation | Custom field-check logic | `validateAxisField()` from `allowlist.ts` | Already handles 9-field allowlist; error message format "SQL safety violation:" is project-standard and grep-able |
| GROUP BY query building | Custom SQL string concat | `buildSuperGridQuery()` from `SuperGridQuery.ts` | Already exists, already tested, validates internally |
| Worker correlation tracking | Custom ID-to-promise map | `this.send()` in WorkerBridge | Already provides correlation IDs, timeout handling, debug logging |
| rAF dedup | Custom timer/semaphore | Pattern from `MutationManager.scheduleNotify()` | Established pattern — `pendingNotify` flag + `requestAnimationFrame` callback |

**Key insight:** Every piece of logic this phase needs already exists in the codebase. The work is wiring, not building.

---

## Common Pitfalls

### Pitfall 1: GROUP_CONCAT Returns Comma-String, Not Array

**What goes wrong:** The sql.js row result for `GROUP_CONCAT(id)` is a single comma-separated string like `"id1,id2,id3"`, not a `string[]`. If the handler returns the raw row without splitting, the `card_ids` field will be a string, breaking the contract.
**Why it happens:** SQLite's GROUP_CONCAT function always returns a string — the array split must happen on the handler side before the response crosses the Worker boundary.
**How to avoid:** In `handleSuperGridQuery`, always split: `(row['card_ids'] as string).split(',').filter(Boolean)`. The `.filter(Boolean)` guards against the empty-table case where GROUP_CONCAT returns an empty string.
**Warning signs:** TypeScript type check passes but runtime `CellDatum.card_ids` is a string instead of string[].

### Pitfall 2: Exhaustive Switch TypeScript Error

**What goes wrong:** After adding `'supergrid:query'` and `'db:distinct-values'` to `WorkerRequestType` union in `protocol.ts`, TypeScript immediately errors at the `default: never` branch in `routeRequest()` in `worker.ts` — the switch is no longer exhaustive.
**Why it happens:** The `_exhaustive: never = type` pattern in the default branch is intentional — it forces immediate attention to all switch sites when the union grows.
**How to avoid:** Add the new cases to `routeRequest()` in the SAME commit as the `WorkerRequestType` union change. Never let the union grow without updating the switch.
**Warning signs:** TypeScript build error: `Type '"supergrid:query"' is not assignable to type 'never'`.

### Pitfall 3: rAF coalescing abandons caller promises silently

**What goes wrong:** If four providers call `superGridQuery()` within the same rAF window, only the last caller's promise is fulfilled. The other three promises are abandoned — they never resolve or reject.
**Why it happens:** The latest-wins design intentionally overwrites `_pendingSuperGridResolve`/`_pendingSuperGridReject`. The abandoned callers' promises are garbage-collected when their reference count drops to zero.
**How to avoid:** This is intentional behavior per CONTEXT.md. The SuperGrid view should subscribe to the result of a single `superGridQuery()` call, not hold multiple concurrent calls. The test for FOUN-11 verifies "four providers firing simultaneously produce exactly one superGridQuery() call" — meaning callers must be designed so only one is the authoritative caller per coordinator batch.
**Warning signs:** If callers await `superGridQuery()` independently and expect all to receive results, that's an incorrect usage pattern.

### Pitfall 4: db:distinct-values SQL injection via column name

**What goes wrong:** `payload.column` is interpolated directly into SQL: `SELECT DISTINCT ${payload.column}`. If `validateAxisField()` is not called first, any string could be injected.
**Why it happens:** Unlike parameterized values (`?` placeholders), column names cannot be bound as parameters in SQLite — they must be interpolated into the query string.
**How to avoid:** `validateAxisField(payload.column)` MUST be the first statement in `handleDistinctValues`. It throws `"SQL safety violation: ..."` if the column is not in the 9-field allowlist. The throw propagates through `handleRequest()` → `createWorkerError()` → `postErrorResponse()` with `INVALID_REQUEST` code.
**Warning signs:** Any test that passes an arbitrary string as `column` without triggering `INVALID_REQUEST`.

### Pitfall 5: requestAnimationFrame not available in Worker test environment

**What goes wrong:** Tests for `WorkerBridge.superGridQuery()` run in Vitest's Node environment, where `requestAnimationFrame` is not defined.
**Why it happens:** `requestAnimationFrame` is a browser API, not available in Node.js. The vitest.config.ts sets `environment: 'node'`.
**How to avoid:** Tests for the rAF coalescing behavior must either (a) mock `requestAnimationFrame` via `vi.stubGlobal('requestAnimationFrame', ...)` or (b) run in the `@vitest/web-worker` integration test environment. The `MutationManager` tests already face this issue — check how they handle it.
**Warning signs:** `ReferenceError: requestAnimationFrame is not defined` in test output.

---

## Code Examples

Verified patterns from existing codebase:

### Protocol Extension — WorkerPayloads/WorkerResponses Addition

```typescript
// Source: src/worker/protocol.ts (existing pattern — replicated for new types)

// In WorkerPayloads:
'supergrid:query': SuperGridQueryConfig;
'db:distinct-values': {
  column: string;
  where?: string;
  params?: unknown[];
};

// In WorkerResponses:
'supergrid:query': { cells: CellDatum[] };
'db:distinct-values': { values: string[] };
```

### Handler Delegation in routeRequest() Switch

```typescript
// Source: src/worker/worker.ts (existing pattern)

case 'supergrid:query': {
  const p = payload as WorkerPayloads['supergrid:query'];
  return handleSuperGridQuery(db, p);
}

case 'db:distinct-values': {
  const p = payload as WorkerPayloads['db:distinct-values'];
  return handleDistinctValues(db, p);
}
```

### WorkerBridge Convenience Method (Simple Wrap Pattern)

```typescript
// Source: src/worker/WorkerBridge.ts (existing pattern — createConnection, searchCards, etc.)

async distinctValues(column: string, where?: string, params?: unknown[]): Promise<string[]> {
  const payload: WorkerPayloads['db:distinct-values'] = { column };
  if (where !== undefined) payload.where = where;
  if (params !== undefined) payload.params = params;
  const result = await this.send('db:distinct-values', payload);
  return result.values;
}
```

### rAF Deduplication Pattern (from MutationManager)

```typescript
// Source: src/mutations/MutationManager.ts lines 216-225

private scheduleNotify(): void {
  if (this.pendingNotify) {
    return;
  }
  this.pendingNotify = true;
  requestAnimationFrame(() => {
    this.pendingNotify = false;
    this.subscribers.forEach(cb => cb());
  });
}
```

### Handler Unit Test Pattern (from simulate.handler.test.ts)

```typescript
// Source: tests/worker/simulate.handler.test.ts (direct handler import, no Worker)

import { handleSuperGridQuery } from '../../src/worker/handlers/supergrid.handler';

describe('handleSuperGridQuery', () => {
  it('returns cells array with parsed card_ids', () => {
    // Mock db.query() to return a row with GROUP_CONCAT string
    const mockDb = {
      query: vi.fn().mockReturnValue([{
        card_type: 'note',
        folder: 'Inbox',
        count: 2,
        card_ids: 'id1,id2',
      }]),
    };
    const result = handleSuperGridQuery(mockDb as any, {
      colAxes: [{ field: 'card_type', direction: 'asc' }],
      rowAxes: [{ field: 'folder', direction: 'asc' }],
      where: '',
      params: [],
    });
    expect(result.cells[0]!.card_ids).toEqual(['id1', 'id2']);
  });
});
```

### StateCoordinator 16ms Batching (two-layer dedup context)

```typescript
// Source: src/providers/StateCoordinator.ts lines 109-117

private scheduleUpdate(): void {
  if (this.pendingUpdate !== null) return;
  this.pendingUpdate = setTimeout(() => {
    this.pendingUpdate = null;
    for (const cb of this.subscribers) {
      cb();
    }
  }, 16);
}
// Layer 1: providers settle → coordinator fires once (setTimeout 16ms)
// Layer 2: WorkerBridge rAF coalesces coordinator callbacks → one Worker request
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SuperGrid filters cards in-memory on main thread (SuperGrid.ts current impl) | SuperGrid queries Worker via supergrid:query (this phase) | Phase 16 | Grouping moved off-thread; main thread never blocks on GROUP BY |
| SuperGridQuery.ts exists as dead code (no caller) | buildSuperGridQuery() called from Worker handler | Phase 16 | Dead code becomes the execution path |

**Deprecated/outdated:**
- SuperGrid.ts in-memory card filtering for group membership: replaced by Worker-side GROUP BY in Phase 17 (Phase 16 delivers the bridge method; Phase 17 wires SuperGrid.ts to call it).

---

## Open Questions

1. **CellDatum type location**
   - What we know: `CellDatum` interface needs to be defined somewhere accessible to both `protocol.ts` (for WorkerResponses) and `SuperGrid.ts` (Phase 17 consumer).
   - What's unclear: Should it live in `protocol.ts` (alongside WorkerPayloads/WorkerResponses), in `supergrid.handler.ts`, or in a new `src/views/supergrid/types.ts`?
   - Recommendation: Define in `protocol.ts` alongside `WorkerResponses['supergrid:query']` — keeps the response contract co-located with the protocol definition. Export for Phase 17 consumers.

2. **requestAnimationFrame availability in test environment**
   - What we know: Vitest uses `environment: 'node'`; rAF is not defined. The `@vitest/web-worker` package is installed for integration tests.
   - What's unclear: Does the MutationManager test suite mock rAF, or is that behavior untested?
   - Recommendation: Check `tests/mutations/MutationManager.test.ts` at plan time. If it mocks rAF via `vi.stubGlobal`, replicate that pattern. If not, the rAF coalescing path needs a vi.stubGlobal in the WorkerBridge tests.

3. **Database.query() return type for GROUP_CONCAT rows**
   - What we know: `db.query()` returns `Record<string, unknown>[]`. The `card_ids` column will be a comma-string.
   - What's unclear: Does sql.js return `null` for GROUP_CONCAT when the group is empty, or an empty string?
   - Recommendation: Guard both: `typeof row['card_ids'] === 'string' ? row['card_ids'].split(',').filter(Boolean) : []`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0 |
| Config file | `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` |
| Quick run command | `npx vitest run tests/worker/supergrid.handler.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUN-05 | Worker executes `supergrid:query`, returns `{ cells: CellDatum[] }` with parsed card_ids | unit | `npx vitest run tests/worker/supergrid.handler.test.ts` | ❌ Wave 0 |
| FOUN-05 | Empty axes returns single total-count cell, not error | unit | `npx vitest run tests/worker/supergrid.handler.test.ts` | ❌ Wave 0 |
| FOUN-05 | Invalid axis field returns INVALID_REQUEST error | unit | `npx vitest run tests/worker/supergrid.handler.test.ts` | ❌ Wave 0 |
| FOUN-06 | `db:distinct-values` returns sorted distinct values for valid column | unit | `npx vitest run tests/worker/supergrid.handler.test.ts` | ❌ Wave 0 |
| FOUN-06 | `db:distinct-values` with invalid column returns INVALID_REQUEST | unit | `npx vitest run tests/worker/supergrid.handler.test.ts` | ❌ Wave 0 |
| FOUN-07 | `WorkerBridge.superGridQuery()` returns `Promise<CellDatum[]>` | unit | `npx vitest run tests/worker/WorkerBridge-supergrid.test.ts` | ❌ Wave 0 |
| FOUN-07 | rAF coalescing: 4 calls within one frame produce 1 Worker request | unit | `npx vitest run tests/worker/WorkerBridge-supergrid.test.ts` | ❌ Wave 0 |
| FOUN-07 | Stale response silently discarded (latest-wins) | unit | `npx vitest run tests/worker/WorkerBridge-supergrid.test.ts` | ❌ Wave 0 |
| FOUN-05+06+07 | Protocol types compile without error (TypeScript check) | compile | `npx tsc --noEmit` | ✅ existing infra |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/worker/supergrid.handler.test.ts tests/worker/WorkerBridge-supergrid.test.ts tests/worker/protocol.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/worker/supergrid.handler.test.ts` — covers FOUN-05, FOUN-06 (handler unit tests, no Worker dependency)
- [ ] `tests/worker/WorkerBridge-supergrid.test.ts` — covers FOUN-07 (rAF coalescing, correlation tracking)

*(No new test infrastructure required — Vitest + @vitest/web-worker already installed and configured.)*

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/worker/protocol.ts` — full WorkerRequestType union, WorkerPayloads, WorkerResponses, PendingRequest shape. Directly read.
- Codebase: `src/worker/worker.ts` — routeRequest() exhaustive switch, createWorkerError(), postErrorResponse() patterns. Directly read.
- Codebase: `src/worker/WorkerBridge.ts` — send() method, pending Map, handleResponse() stale-ID handling. Directly read.
- Codebase: `src/worker/handlers/simulate.handler.ts` — handler file pattern (pure function, direct import, testable in Node). Directly read.
- Codebase: `src/views/supergrid/SuperGridQuery.ts` — buildSuperGridQuery(), GROUP_CONCAT output, validateAxisField() call. Directly read.
- Codebase: `src/providers/allowlist.ts` — validateAxisField(), ALLOWED_AXIS_FIELDS (9 fields). Directly read.
- Codebase: `src/mutations/MutationManager.ts` — requestAnimationFrame dedup pattern (scheduleNotify). Directly read.
- Codebase: `src/providers/StateCoordinator.ts` — setTimeout(16) two-layer dedup context. Directly read.
- Codebase: `vitest.config.ts` — environment: 'node', pool: 'forks'. Directly read.
- Codebase: `tests/worker/simulate.handler.test.ts` — handler test pattern (direct import, mock db). Directly read.

### Secondary (MEDIUM confidence)

- Codebase: `tests/worker/WorkerBridge.test.ts` — MockWorker pattern for isolating WorkerBridge logic. Directly read (first 80 lines).
- Codebase: `tests/worker/integration.test.ts` — @vitest/web-worker integration test setup. Directly read.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns sourced directly from codebase
- Architecture: HIGH — protocol extension, handler structure, and rAF coalescing all have direct codebase precedents
- Pitfalls: HIGH for GROUP_CONCAT split, exhaustive switch error, and SQL injection (all sourced from code). MEDIUM for rAF/Node test environment issue (MutationManager test approach not fully verified)

**Research date:** 2026-03-04
**Valid until:** 2026-04-03 (stable codebase, no fast-moving external dependencies)
