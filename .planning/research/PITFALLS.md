# Pitfalls Research

**Domain:** Local-first TypeScript/D3.js in-browser SQLite data projection platform (WKWebView)
**Researched:** 2026-02-27 (v0.1 pitfalls) · 2026-02-28 (v1.0 Web Runtime pitfalls added)
**Confidence:** MEDIUM-HIGH — most pitfalls verified via official docs, GitHub issues, and community discussions; undo/redo edge cases are HIGH confidence from first principles; view transition pitfalls are MEDIUM from D3 issue tracker evidence

---

## Critical Pitfalls

### Pitfall 1: WKWebView WASM Loading Fails Due to MIME/URL Handling

**What goes wrong:**
`initSqlJs()` internally calls `fetch()` to load `sql-wasm.wasm`. WKWebView's `fetch()` implementation enforces strict MIME type validation on local files, rejecting anything without `Content-Type: application/wasm`. The error appears as: `"Unexpected response MIME type. Expected 'application/wasm'"`. The app crashes silently or stalls at database initialization. `XMLHttpRequest` on the same file succeeds — only `fetch()` fails.

**Why it happens:**
WebKit's fetch() implementation validates MIME types more aggressively than XMLHttpRequest for local file:// URLs. When serving from a Vite-built bundle loaded into WKWebView via `loadFileURL`, there is no HTTP server to set `Content-Type` headers — the OS returns a generic MIME type for `.wasm` files.

**How to avoid:**
Prefer `WKURLSchemeHandler` (or equivalent native URL serving) that returns the WASM asset with correct MIME and stable URL resolution. Use a JS `fetch` fallback only if native serving is not feasible.

If a JS fallback is required, scope it narrowly:
- Intercept only the sql.js WASM URL, not every `.wasm` request
- Preserve status/error semantics
- Gate by platform/runtime (`WKWebView` only)
- Remove once native serving is in place

```typescript
// Scoped fallback only for sql.js WASM loading in WKWebView
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (url.includes('sql-wasm') && url.endsWith('.wasm')) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(new Response(xhr.response, {
            status: xhr.status,
            headers: { 'Content-Type': 'application/wasm' }
          }));
        } else {
          reject(new Error(`WASM load failed: ${xhr.status}`));
        }
      };
      xhr.onerror = reject;
      xhr.send();
    });
  }
  return originalFetch(input, init);
};
```

**Warning signs:**
- Database initialization hangs or throws on first app launch in iOS simulator or device
- Error contains "Unexpected response MIME type" or "application/wasm"
- The same build works in Chrome but fails in WKWebView
- WASM loading works in dev server (has HTTP headers) but fails in production bundle

**Phase to address:** Phase 1 (Database Foundation) — test WKWebView WASM loading in the very first integration spike before any other feature work. If WASM does not load, nothing else matters.

---

### Pitfall 2: FTS5 Index Drift from Trigger/Schema Mismatch

**What goes wrong:**
FTS5 results drift from `cards` when trigger definitions, `content=`/`content_rowid=`, and query joins are not aligned. Symptoms include stale matches, missing matches, deleted rows still appearing in search, and occasional integrity-check failures.

**Why it happens:**
The most common causes are:
- Trigger and FTS schema drift (wrong columns, missing `content_rowid`, trigger not updated when schema changes)
- Incorrect joins (`id` vs `rowid`)
- Missing delete+insert maintenance on updates

The broken pattern (wrong join key type):
```sql
-- WRONG: id is TEXT and fts rowid is INTEGER
SELECT c.*
FROM cards_fts fts
JOIN cards c ON c.id = fts.rowid;
```

**How to avoid:**
Use the exact external-content-table pattern from SQLite docs:
- `content='cards'` and `content_rowid='rowid'`
- `AFTER INSERT`, `AFTER DELETE`, and `AFTER UPDATE` triggers
- Update trigger performs `'delete'` with `OLD` plus insert with `NEW`
- Search joins use `cards.rowid = cards_fts.rowid`

Also add explicit verification:
- `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')`
- `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` as recovery path in maintenance tools/tests

```sql
-- CORRECT: Three separate triggers, each doing one atomic operation
CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;

CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
END;

CREATE TRIGGER cards_fts_au AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;
```

Run `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')` in tests after mutation-heavy test batches to catch desync early.

**Warning signs:**
- Search returns stale results for cards that were recently updated
- FTS returns results for deleted cards
- `integrity-check` virtual command reports errors
- Search stops finding cards that definitely exist in the cards table

**Phase to address:** Phase 1 (Database Foundation) — trigger definitions must be correct in `schema.sql` before any data is written. Add an integrity-check assertion to the test suite that runs after every write in Phase 2.

---

### Pitfall 3: sql.js WASM Path Breaks in Vite Production Build

**What goes wrong:**
sql.js initializes correctly in dev (`vite dev`) but throws on production bundle (`vite build`). The WASM file path resolved by `locateFile` in dev is `http://localhost:5173/sql-wasm.wasm`, but in production the hashed asset path is `/assets/sql-wasm.abc123.wasm`. The `initSqlJs()` call fails with a 404 or silent hang.

A second failure mode: Vite's dependency optimizer (esbuild pre-bundling) processes sql.js and strips the WASM loading code, because esbuild does not support WASM imports. The optimized bundle then cannot load the `.wasm` file at all.

**Why it happens:**
Vite's `optimizeDeps` pre-bundles everything in `node_modules` with esbuild for speed. esbuild does not support WebAssembly ESM integration. sql.js uses Emscripten's `locateFile` callback, which assumes a relative path from the JS file's location. In a bundled build, the JS is inlined into chunks and `locateFile` resolves against the wrong base URL.

**How to avoid:**
```typescript
// vite.config.ts — mandatory for sql.js
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    exclude: ['sql.js'],  // Prevent esbuild from breaking WASM loading
  },
  worker: {
    format: 'es',
    // If using sql.js inside a worker, plugins must mirror root config
    plugins: () => [
      // vite-plugin-wasm() if needed
    ],
  },
});
```

Resolve the WASM path explicitly in `initSqlJs`:
```typescript
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const SQL = await initSqlJs({
  locateFile: () => sqlWasmUrl,  // Vite resolves this to the correct hashed asset path
});
```

**Warning signs:**
- Works in `vite dev`, fails after `vite build && vite preview`
- Console shows 404 for a file like `sql-wasm.wasm` or `sql-wasm.abc123.wasm`
- Error: "CompileError: WebAssembly.instantiate(): expected magic word"
- The `.wasm` file is missing from `dist/assets/`

**Phase to address:** Phase 1 (Database Foundation) — run a production build smoke test alongside dev testing. Do not defer this to later phases.

---

### Pitfall 4: sql.js Is Entirely In-Memory — Data Is Lost on Worker Termination or Crash

**What goes wrong:**
sql.js creates an in-memory SQLite database. There is no automatic persistence. If the Web Worker is terminated, the iOS app is backgrounded and killed, or the WKWebView crashes, all uncommitted database state is lost. Unlike native SQLite on disk, there is no WAL file to recover from.

**Why it happens:**
sql.js runs SQLite compiled to WASM in a JavaScript heap. The database exists only in the Worker's memory. The spec's D-010 decision addresses this with dirty flag + CloudKit sync, but the gap between a mutation and the next sync is a data loss window. The Worker holds the only copy.

**How to avoid:**
- Implement D-010's dirty flag immediately on every mutation, not deferred.
- Export `db.export()` on every app backgrounding signal from the native shell — do not rely on the 2-second debounce alone for this trigger.
- Pass the exported `Uint8Array` to the Swift side through the WorkerBridge for persistence to the native file system on every background event.
- Test data recovery: kill the app mid-transaction, relaunch, verify last-good-state is restored.

Note: `db.export()` on a large database (10K+ cards) takes measurable time. Profile this before shipping — it may need to happen in chunks or via a VACUUM INTO equivalent.

**Warning signs:**
- Users report data disappearing after the app is force-quit
- No recovery path tested in test suite
- D-010 sync triggers are implemented but never tested with actual app lifecycle events

**Phase to address:** Phase 3 (Worker Bridge) — persistence export must be wired to native shell lifecycle events before any ETL import feature ships. Importing 10K Apple Notes without a save path is a guaranteed data-loss scenario.

---

### Pitfall 11: Worker Bridge Initialization Race Condition

**What goes wrong:**
The `WorkerBridge` singleton is instantiated at module load time, but the Worker's database is not yet initialized. Code that calls `workerBridge.query()` or `workerBridge.exec()` immediately after import — before `workerBridge.init()` resolves — receives "Database not initialized" errors. This is especially dangerous in tests, which may call bridge methods in `beforeEach` hooks that race with `init()`.

A subtler form: the Worker's `self.onmessage` handler is registered after `initSqlJs()` resolves. If the main thread posts a message during WASM initialization (which can take 200-500ms), that message is processed before the database is ready, producing an uncaught error that silently swallows the request.

**Why it happens:**
Module singletons run synchronously; async initialization cannot be awaited at the top level of an ES module (outside of top-level `await` with the right configuration). The `workerBridge.init()` call is async, but callers may not know they need to await it. The Worker's initialization order — `initSqlJs()` call happens at module evaluation time, `onmessage` is registered after — creates a window where messages are lost.

**How to avoid:**
In the Worker, register `onmessage` synchronously but queue incoming messages until the database is ready:

```typescript
// worker.ts
let db: Database | null = null;
const messageQueue: MessageEvent<WorkerRequest>[] = [];

// Register handler immediately — no messages lost
self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  if (!db) {
    messageQueue.push(event);
    return;
  }
  processMessage(event);
};

// Initialize DB, then drain queue
initSqlJs({ locateFile: () => sqlWasmUrl }).then((SQL) => {
  db = new SQL.Database();
  applySchema(db);
  messageQueue.forEach(processMessage);
  messageQueue.length = 0;
});
```

On the main thread, gate all bridge calls on `init()` completion. The singleton should expose an `isReady` promise:

```typescript
class WorkerBridge {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.init();  // Start immediately
  }

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    await this.ready;  // All callers implicitly wait for init
    return this.send('db:query', { sql, params });
  }
}
```

**Warning signs:**
- "Database not initialized" errors on first page load
- Bridge tests are flaky — pass in isolation, fail when run in sequence
- Worker `onerror` fires on startup with no useful message

**Phase to address:** Phase 3 (Worker Bridge) — implement queue-on-init pattern as the very first worker test. Write a test that calls `bridge.query()` without awaiting `init()` and asserts it resolves correctly.

---

### Pitfall 12: Pending Promise Map Grows Without Bound on Worker Error

**What goes wrong:**
The bridge stores in-flight requests in a `Map<string, { resolve, reject }>`. When the Worker crashes or is terminated, `onerror` rejects all pending promises and clears the map. But if a specific message handler in the Worker throws an unhandled exception (not caught by the outer `try/catch`), the Worker does not crash — it just never posts a response for that message ID. The calling promise hangs forever: no resolve, no reject, no timeout.

At scale, if a graph traversal query hits a SQLite error that bypasses the handler's try/catch, every subsequent query for that session also hangs — the pending map accumulates entries that are never resolved, and the Worker continues processing other messages normally.

**Why it happens:**
The Worker's message router catches errors in the main handler, but any synchronous error inside a handler that is re-thrown (or a Promise rejection inside an async handler that isn't awaited) can escape the catch block. Since the Worker does not crash, `onerror` is never triggered, and the pending entry is never cleaned up.

**How to avoid:**
Add a timeout to every pending promise, configurable per message type:

```typescript
private send<T>(type: MessageType, payload: unknown, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();

    const timeout = setTimeout(() => {
      if (this.pending.has(id)) {
        this.pending.delete(id);
        reject(new Error(`Worker timeout: ${type} after ${timeoutMs}ms (id: ${id})`));
      }
    }, timeoutMs);

    this.pending.set(id, {
      resolve: (value: unknown) => { clearTimeout(timeout); resolve(value as T); },
      reject: (err: Error) => { clearTimeout(timeout); reject(err); },
      startTime: performance.now(),
    });

    this.worker.postMessage({ id, type, payload, timestamp: Date.now() });
  });
}
```

Use longer timeouts for known-expensive operations: graph traversal `30_000`, PageRank `60_000`, database export `30_000`.

**Warning signs:**
- Certain UI interactions (e.g., network view load) hang indefinitely, no error
- `pending` map size grows during a session and never shrinks
- Worker appears healthy (processes subsequent messages) but one operation never resolves

**Phase to address:** Phase 3 (Worker Bridge) — add timeout from day one. Test with a mock handler that never responds and verify the caller gets a timeout rejection.

---

### Pitfall 13: Provider Subscriber Leak When Views Are Destroyed and Recreated

**What goes wrong:**
Providers use a `Set<callback>` subscriber model. Views subscribe on mount and must call the returned unsubscribe function on destroy. When a view is torn down and recreated (switching from list to kanban and back), if the unsubscribe is not called, the old callback remains in the provider's subscriber set. Each recreation adds another subscriber. After several view switches: five callbacks fire on every filter change, triggering five concurrent bridge queries and five D3 re-renders. The app becomes progressively slower and eventually deadlocks the bridge with concurrent queries.

**Why it happens:**
Vanilla TypeScript has no component lifecycle hooks. Developers write the subscribe call but forget the cleanup, especially when view rendering is split across functions. The subscriber `Set` does not deduplicate — if the same function reference is used, it does work as a set, but arrow functions created at call time produce unique references on each call.

**How to avoid:**
Every view module must expose a `destroy()` method that calls all stored unsubscribe functions:

```typescript
class ListView {
  private cleanup: Array<() => void> = [];

  mount(container: HTMLElement): void {
    this.cleanup.push(
      providers.filter.subscribe(() => this.render()),
      providers.pafv.subscribe(() => this.render()),
    );
    this.render();
  }

  destroy(): void {
    this.cleanup.forEach(fn => fn());
    this.cleanup = [];
    // Also call selection.clear() per D-005
    providers.selection.clear();
  }
}
```

The `ViewManager` is responsible for calling `destroy()` on the outgoing view before mounting the incoming view. Write a test that mounts and destroys the same view 10 times and asserts the provider subscriber count is 1 (not 10).

**Warning signs:**
- App gets slower after repeated view switches
- Bridge receives N concurrent queries for a single filter change, where N is the number of times the view was mounted
- Memory profiler shows growing number of listener callbacks in provider subscriber sets

**Phase to address:** Phase 4 (Providers) — establish the mount/destroy lifecycle contract in the Provider interface definition, before any view is built.

---

### Pitfall 14: Provider State Mutation Bypasses Subscribers

**What goes wrong:**
Providers expose `getState()` which returns the internal state object by reference. A caller modifies a property directly (`providers.filter.getState().filters.clear()`) and the change never notifies subscribers — no re-query fires, no D3 update runs. The UI is now out of sync with provider state and the database.

This is particularly dangerous for `SelectionProvider`, where the `selectedIds` Set is mutable. Code that calls `getSelectedArray()` and then modifies the array doesn't cause this problem, but code that grabs `getState().selectedIds` and calls `.add()` or `.delete()` on it directly silently bypasses all notifications.

**Why it happens:**
JavaScript's object/collection types are passed by reference. Without defensive copying or explicit encapsulation (private fields, readonly types), callers can mutate internal state directly. Providers in the spec expose `setState(partial)` but the spec's `getState()` returns the live object, not a copy.

**How to avoid:**
Return a shallow copy (or frozen object) from `getState()`:

```typescript
getState(): Readonly<FilterState> {
  return Object.freeze({ ...this.state, filters: new Map(this.state.filters) });
}
```

Or, mark `getState()` as for-read-only in documentation and enforce with TypeScript's `Readonly<T>` return type. Any attempt to call `.add()` or `.delete()` on a `ReadonlySet` will produce a compile error in strict mode.

For the Map/Set fields on `SelectionState` and `FilterState`, return read-only views:

```typescript
getSelectedIds(): ReadonlySet<string> {
  return this.state.selectedIds;  // ReadonlySet doesn't expose mutating methods
}
```

**Warning signs:**
- Filter state changes don't trigger re-queries in certain code paths
- Selection appears to update (count shows correctly) but cards don't highlight
- Provider unit tests pass but integration tests show stale view state

**Phase to address:** Phase 4 (Providers) — enforce `Readonly<T>` return types on all `getState()` methods when the providers are first written. Retrofitting is tedious.

---

### Pitfall 15: QueryCompiler Produces Invalid SQL When Providers Return Empty Fragments

**What goes wrong:**
`QueryCompiler.compileViewQuery()` assembles SQL by concatenating provider fragments. If `FilterProvider.toSQL()` returns an empty `where` string and the compiler does `WHERE ${filter.where}`, the result is `WHERE ` (bare WHERE clause with no condition), which is a SQL syntax error. Similarly, if `PAFVProvider.toSQL()` returns no `orderBy`, the compiler emits `ORDER BY ` with no column — another syntax error.

Both failures are runtime errors that occur only when the provider state is in its initial default state — exactly the condition on first launch before any user interaction.

**Why it happens:**
String concatenation of SQL fragments requires guarding every optional clause. The spec shows `WHERE ${where}` with a comment noting `1=1` as a fallback, but the actual implementation in the Providers spec returns an empty string for the `where` when there are no filters — not `1=1`.

Looking at `FilterProvider.toSQL()` in the spec: it always includes `conditions.push('deleted_at IS NULL')` so the WHERE clause is never empty. But `PAFVProvider.toSQL()` can return `orderBy: undefined`. The compiler must handle `undefined` gracefully.

**How to avoid:**
The `QueryCompiler` must treat every fragment as potentially absent:

```typescript
compileViewQuery(): { sql: string; params: unknown[] } {
  const filter = this.filterProvider.toSQL();
  const pafv = this.pafvProvider.toSQL();

  const select = pafv.select || '*';
  const where = filter.where || 'deleted_at IS NULL';  // Safe fallback
  const groupBy = pafv.groupBy ? `GROUP BY ${pafv.groupBy}` : '';
  const orderBy = pafv.orderBy ? `ORDER BY ${pafv.orderBy}` : 'ORDER BY modified_at DESC';

  const sql = `SELECT ${select} FROM cards WHERE ${where} ${groupBy} ${orderBy}`.trim();
  return { sql, params: filter.params || [] };
}
```

Write tests that call `compileViewQuery()` with every provider in its default state and assert the SQL is parseable.

**Warning signs:**
- SQL syntax errors on first app load before any filter interaction
- "near '': syntax error" in SQLite error messages from the Worker
- Tests pass with populated providers but fail on empty state

**Phase to address:** Phase 4 (Providers) — test the compiler with all providers at default state as the very first QueryCompiler test.

---

### Pitfall 16: Undo Stack Produces Invalid Inverse SQL for Batch Operations

**What goes wrong:**
`MutationManager` generates inverse SQL for every mutation. For single-row mutations, the pattern is reliable: `INSERT` inverse is `DELETE WHERE id = ?`, `DELETE` inverse is re-`INSERT`, `UPDATE` inverse is `UPDATE` with the old values. But for batch mutations — inserting 50 cards from an ETL import — the inverse must delete all 50 rows, in the correct order, without violating foreign key constraints.

Two failure modes occur:
1. The batch command stores a single inverse `DELETE WHERE id IN (?, ?, ...)` but the IDs array grows beyond SQLite's maximum parameter count (default 999 variables). The undo fails with "too many SQL variables."
2. A batch that creates connections after creating cards stores the inverse in the wrong order. Undoing executes `DELETE FROM cards` before `DELETE FROM connections`, which CASCADE-deletes the connections anyway — but then the second inverse `DELETE FROM connections` errors because the rows are already gone.

**Why it happens:**
Batch inverse operations require the inverse array to be reversed, and foreign-key ordering must be respected. These constraints are easy to verify for single-row commands but are invisible at batch construction time.

**How to avoid:**
Store inverse operations as an ordered array, not a single SQL string:

```typescript
interface BatchCommand {
  id: string;
  type: 'batch';
  operations: Command[];         // forward operations in order
  inverse: Command[];            // inverse operations in REVERSE order
  timestamp: number;
}
```

For large batches exceeding 999 rows, chunk the inverse DELETE:

```typescript
function buildInverseDelete(ids: string[]): Command[] {
  const chunks: Command[] = [];
  for (let i = 0; i < ids.length; i += 900) {
    const slice = ids.slice(i, i + 900);
    const placeholders = slice.map(() => '?').join(', ');
    chunks.push({
      sql: `DELETE FROM cards WHERE id IN (${placeholders})`,
      params: slice,
    });
  }
  return chunks.reverse();  // Execute largest-offset chunk first (no ordering dependency)
}
```

Connections must always be inverse-deleted before cards (even though CASCADE handles it), to make intent explicit and prevent double-delete errors:

```typescript
inverse = [
  ...connectionInverseDeletes,  // First: remove connections
  ...cardInverseDeletes,         // Second: remove cards
];
```

**Warning signs:**
- "too many SQL variables" error when undoing an ETL import
- Undo of a bulk operation partially succeeds (some rows deleted, some not)
- Foreign key constraint errors during undo execution despite correct schema

**Phase to address:** Phase 4 (Mutation Manager, inside Provider phase) — write undo/redo tests for batch operations of 1000+ rows before any ETL imports are enabled.

---

### Pitfall 17: D3 View Transition Interrupted by Concurrent Provider Update

**What goes wrong:**
A filter change fires while a view transition is mid-flight (e.g., cards are animating into position over 300ms). The new data arrives via bridge response, triggering a `.data(newCards, d => d.id).join(...)` call. D3 immediately interrupts the in-flight transition on each matched element and starts the new transition from the current (mid-animation) position. The interrupted elements snap from wherever they were to the new position — producing visual jank that scales with how fast the user changes filters.

A worse failure: the interrupted transition's `.on('end', ...)` callback fires after the element is removed by the new exit selection, referencing a detached DOM node. The callback throws, which in strict mode surfaces as an unhandled promise rejection.

**Why it happens:**
D3 transitions are named and elements can only run one transition of a given name at a time. Starting a new transition on an element interrupts the previous one. The `end` event fires with the "interrupted" reason, but `on('end', callback)` is typically written without checking the interrupt flag.

**How to avoid:**
Debounce re-renders during transitions:

```typescript
let renderScheduled = false;
let pendingCards: Card[] | null = null;

function scheduleRender(cards: Card[]): void {
  pendingCards = cards;
  if (!renderScheduled) {
    renderScheduled = true;
    // Wait for current transition frame to complete
    requestAnimationFrame(() => {
      renderScheduled = false;
      if (pendingCards) {
        renderView(pendingCards);
        pendingCards = null;
      }
    });
  }
}
```

For the `end` callback, always guard against removed nodes:

```typescript
transition.on('end', function() {
  if (!document.contains(this)) return;  // Node was removed during transition
  // Safe to access `this`
});
```

Use `selection.interrupt()` explicitly before starting a new transition in the same render cycle:

```typescript
function renderView(cards: Card[]): void {
  const cells = svg.selectAll<SVGGElement, Card>('.card')
    .data(cards, d => d.id);

  cells.interrupt();  // Cancel any in-flight transitions before join

  cells.join(
    enter => enter.append('g').attr('class', 'card').call(enterTransition),
    update => update.call(updateTransition),
    exit => exit.call(exitTransition).remove(),
  );
}
```

**Warning signs:**
- Cards appear to "snap" or jump when filters change quickly
- `requestAnimationFrame` callbacks taking >16ms on rapid filter changes
- "Unhandled promise rejection" errors in the console during animation

**Phase to address:** Phase 5 (Views) — establish the `interrupt()`-before-join pattern in the first view implementation. Test with rapid filter changes (5 changes in 200ms) and assert no console errors.

---

### Pitfall 18: SuperGrid Header Cell Count Explodes with High-Cardinality Axes

**What goes wrong:**
SuperGrid renders a grid where row headers represent one axis facet value and column headers represent another. If the user maps a high-cardinality field (e.g., `source_id` with 5,000 distinct values, or `created_at` at day granularity spanning years) to either axis, the grid attempts to render thousands of header cells and thousands of grid cells. The DOM node count explodes: 1,000 row values × 200 column values = 200,000 cells, each with card content. The browser freezes.

**Why it happens:**
The PAFV projection makes any field mappable to any axis. The DensityProvider controls the aggregation level (day → week → month) but only if the user has set it. Default density is `'leaf'` (most granular). If the user maps `created_at` to an axis without adjusting density, every distinct date becomes a column.

**How to avoid:**
Enforce hard limits in `SuperGrid.render()` regardless of provider state:

```typescript
const MAX_ROW_HEADERS = 50;
const MAX_COL_HEADERS = 100;

function render(state: SuperGridState): void {
  if (state.rowHeaders.length > MAX_ROW_HEADERS) {
    console.warn(`SuperGrid: row header count ${state.rowHeaders.length} exceeds max ${MAX_ROW_HEADERS}. Truncating.`);
    state = { ...state, rowHeaders: state.rowHeaders.slice(0, MAX_ROW_HEADERS) };
    // Show overflow indicator
  }
  // ... same for colHeaders
}
```

The `QueryCompiler` should also enforce a `LIMIT` on distinct axis values before the SuperGrid receives them:

```sql
SELECT DISTINCT ${axisField} FROM cards WHERE deleted_at IS NULL
ORDER BY ${axisField}
LIMIT 100
```

The DensityProvider's default for `time` axis should be `'parent'` (week level), not `'leaf'` (day level), to prevent the most common explosion case.

**Warning signs:**
- Browser freezes when user maps a date field to a grid axis at default density
- DevTools shows DOM node count in the tens of thousands after a SuperGrid render
- Frame rate drops to 0fps for several seconds after axis change

**Phase to address:** Phase 5 (SuperGrid) — enforce MAX_ROW_HEADERS and MAX_COL_HEADERS before writing the first cell render. These limits must exist in code, not just documentation.

---

### Pitfall 19: D3 Event Listeners Attached Inside Data Joins Accumulate Per-Render

**What goes wrong:**
Inside a D3 `.join()` block, `.on('click', handler)` is called on the `update` selection as well as the `enter` selection. Each time the view re-renders and the element stays in the DOM (update selection), another `click` listener is added. After 10 re-renders, a single card click fires the handler 10 times, producing 10 bridge queries or 10 state mutations.

This is invisible in tests (which render once) and in small apps (where re-renders are infrequent), but becomes critical in Isometry where providers can trigger re-renders on every keystroke.

**Why it happens:**
D3's `.on('event', handler)` replaces the handler if the exact same event type string is used. However, if the handler is defined as a new arrow function on each render, D3 treats it as a different handler and adds it alongside the previous one. Stack Overflow examples show `.on('click', ...)` in both `enter` and `update` selections — a pattern that multiplies listeners.

**How to avoid:**
Attach event listeners only in the `enter` selection. Never re-attach in the `update` selection. The `update` selection's element already has its listener from when it was entered:

```typescript
cells.join(
  enter => enter.append('g')
    .attr('class', 'card')
    .on('click', (event, d) => handleCardClick(d))  // Attach once on enter
    .call(applyEnterStyles),

  update => update  // Do NOT re-attach listeners here
    .call(applyUpdateStyles),

  exit => exit.remove()
);
```

If the handler closure needs to capture updated state, use a module-level stable handler reference that reads state at call time:

```typescript
// Stable reference — same function, reads current state on call
const handleClick = (event: MouseEvent, d: Card) => {
  const currentSelection = providers.selection.getState();
  // ...
};

enter.on('click', handleClick);  // Reference is stable across renders
```

**Warning signs:**
- Single card click triggers multiple re-renders or multiple mutations
- Click handler fires N times where N is the number of times the view has re-rendered
- Browser DevTools event listener panel shows multiple `click` listeners on one element

**Phase to address:** Phase 5 (Views) — establish the enter-only listener pattern in the first view. Code review checklist: reject any `.on()` call in the `update` argument of `.join()`.

---

## Moderate Pitfalls

### Pitfall 5: sql.js Prepared Statements Leak Memory and Lock Tables

**What goes wrong:**
Calling `db.prepare()` without `stmt.free()` after use creates a memory leak inside the WASM heap. Over time, the heap grows until the tab crashes with an out-of-memory error. Additionally, un-freed prepared statements hold locks on tables, causing subsequent `DROP TABLE` or certain mutation operations to fail with "database table is locked".

**How to avoid:**
Always use a try/finally pattern with prepared statements:
```typescript
const stmt = db.prepare('SELECT * FROM cards WHERE id = ?');
try {
  stmt.bind([id]);
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
} finally {
  stmt.free();  // Non-negotiable
}
```

Better: wrap `db.prepare()` in a utility that auto-frees, or prefer `db.exec()` / `db.run()` for one-shot queries. Only use `db.prepare()` for hot-path repeated queries where the execution plan reuse justifies the complexity.

**Warning signs:**
- Worker memory growing over long sessions
- "database table is locked" errors appearing during normal operation
- Memory profiler shows WASM heap growing unbounded

**Phase to address:** Phase 2 (CRUD + Queries) — establish the prepare/free wrapper pattern before any query module is written. All query functions in `cards.ts`, `search.ts`, etc. should use consistent patterns.

---

### Pitfall 6: D3 Data Join Without Key Function Causes DOM Thrashing

**What goes wrong:**
When D3's `.data(array)` is called without a key function, D3 matches elements to data by index position. On any reorder, filter, or sort, D3 re-assigns data to the wrong DOM elements. Transitions animate to incorrect positions, cards appear to jump to wrong cells, and exit/enter selections are larger than necessary — destroying and recreating DOM nodes that could have been reused.

The v5 contracts/spec docs already document this as a "WRONG" pattern. However, it's the default when developers copy D3 examples which frequently omit key functions.

**How to avoid:**
Every `.data()` call in this codebase must include the key function `d => d.id`:
```typescript
const cells = svg.selectAll('.card')
  .data(cards, d => d.id)  // Key function is mandatory
  .join(
    enter => enter.append('g').attr('class', 'card'),
    update => update,
    exit => exit.remove()
  );
```

Add a lint rule or code review checklist item: reject any `.data(array)` without a second argument.

**Warning signs:**
- Cards animate to wrong positions on view change
- Exit selection is always the full dataset even when only one item changed
- Visual glitches when filter changes reduce the visible set

**Phase to address:** Phase 5 (Views) — enforce key function as a code review requirement for every view implementation from the first view written.

---

### Pitfall 7: D3 SVG Performance Wall at High Visible Element Counts

**What goes wrong:**
Performance degrades as visible SVG node count and transition complexity increase. In many real-world UIs, frame times rise noticeably in the high hundreds to low thousands of actively animated elements. The exact breakpoint is device/browser dependent and must be measured in your target environment.

**How to avoid:**
- Implement density controls (DensityProvider) with strict upper bounds on visible elements. The spec's `LIMIT` pagination is the right mechanism — enforce it.
- Separate the force simulation tick loop from the DOM update loop for the network view: run simulation in the Worker, post final positions to the main thread only when stable, render once.
- Use CSS transforms (`translate(x,y)`) for positioning rather than SVG `x`/`y` attributes where possible — CSS transforms are composited by the GPU.
- Use `opacity` only on groups, not individual path elements (per-path opacity triggers expensive compositing).
- Do not transition all visible elements simultaneously at large counts — stagger or skip transitions above a measured threshold.

The spec's performance threshold of `<16ms render` for 100 visible cards is generally achievable. For network-like views with large node counts, run simulation off the main thread and push stable coordinates or low-frequency updates.

**Warning signs:**
- `requestAnimationFrame` callbacks taking >16ms as card count grows
- Chrome DevTools shows long paint times (>8ms) on layout changes
- Transition end events never fire because new transitions interrupt old ones

**Phase to address:** Phase 5 (Views) — performance budgets must be measured per-view during implementation, not as a post-build optimization pass.

---

### Pitfall 8: Web Worker postMessage Serialization Kills Throughput

**What goes wrong:**
Every `postMessage()` call runs the Structured Clone Algorithm on the payload. For query results with hundreds of card objects, this serialization adds significant latency. The naïve pattern of posting a full card array on every filter change turns the Worker bridge into a bottleneck, especially if providers trigger frequent re-queries.

A subtler failure: Transferable objects (`ArrayBuffer`) are zero-copy for single transfers but Chrome/Edge show exponential slowdown when transferring many small Transferable objects — making Transferables counterproductive for arrays of individual card buffers. Additionally, serialization blocks the sending realm; deserialization blocks the receiving realm — both main thread and worker thread are blocked during these operations.

**How to avoid:**
- Keep query result payloads as lean as possible. Return arrays of plain objects with only the fields the current view needs, not full card objects with all columns.
- For the D3 views, the rendering code needs `id`, `name`, and a handful of PAFV axis values — not the full `content` text field. Project in SQL: `SELECT id, name, status, priority FROM cards WHERE...`
- Never post large blobs (full card content) across the bridge for rendering purposes. Content is fetched on demand (detail view), not in list queries.
- Batch mutations before posting: the `MutationManager` should queue mutations and post once, not once per field change.

**Warning signs:**
- Bridge response times growing proportionally with dataset size even for simple filters
- Profiler shows significant time in structured clone serialization
- Memory spikes on filter changes (both sides of bridge hold the array in memory simultaneously)

**Phase to address:** Phase 3 (Worker Bridge) — establish the minimal projection pattern for query results before any view consumes bridge data. Retrofit is painful.

---

### Pitfall 9: TypeScript Strict Mode + D3 Type System Friction

**What goes wrong:**
D3's `Selection<GElement, Datum, PElement, PDatum>` has four generic type parameters. TypeScript strict mode with `noImplicitAny` and `strictNullChecks` rejects the common patterns found in most D3 tutorials and Stack Overflow answers. Common errors:

- `Argument of type 'Selection<BaseType, unknown, HTMLElement, any>' is not assignable to parameter of type...`
- `d3.zoom()` returning `ZoomBehavior<Element, unknown>` incompatible with typed selection `.call()`
- `d => d.id` rejected because datum type is `unknown` after a `.data()` without explicit typing

Developers respond by scattering `as any` casts throughout view code, which defeats strict mode entirely and hides real bugs.

**How to avoid:**
Establish typed selection factory functions. Every view should start with properly typed selections:
```typescript
// Correct: explicit type parameters from the start
const svg = d3.select<SVGSVGElement, unknown>(container)
  .append('svg') as d3.Selection<SVGSVGElement, unknown, HTMLElement, unknown>;

// Correct: typed data join preserves datum type
const cards = svg.selectAll<SVGGElement, Card>('.card')
  .data<Card>(data, (d: Card) => d.id)
  .join('g');
```

Do not use `as any` to escape type errors — trace the error to the generic parameter causing it. The fix is almost always adding explicit type parameters to `selectAll<ElementType, DatumType>()`.

For `.call()` with behaviors (zoom, drag), cast the selection to the expected element type:
```typescript
svg.call(d3.zoom<SVGSVGElement, unknown>().on('zoom', handler));
```

**Warning signs:**
- `as any` appearing in view files
- TypeScript errors in views worked around with `@ts-ignore` comments
- Type errors only noticed at runtime (null derefs on datum properties)

**Phase to address:** Phase 5 (Views) — establish typed selection patterns in the first view (list view). All subsequent views copy the pattern.

---

### Pitfall 10: Vitest Cannot Run sql.js WASM Tests Without Configuration

**What goes wrong:**
Running `vitest` in the default `node` environment for database tests causes `initSqlJs()` to fail. The WASM file is not found (locateFile resolves to the wrong path in a test context), or the WASM binary fails to compile because Node's WASM support has different constraints than the browser. The test hangs or throws a cryptic compile error.

A second failure mode: using `environment: 'jsdom'` often does not help for sql.js tests because WASM asset resolution and worker-like behavior differ from runtime expectations. Prefer `environment: 'node'` for sql.js unit/integration tests.

**How to avoid:**
Vitest database tests must run in the `node` environment (not jsdom/happy-dom) and initialize sql.js with an explicit WASM path pointing to the node_modules file:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: './tests/setup/wasm-init.ts',
  },
});

// tests/setup/wasm-init.ts
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

export async function setup() {
  // Make WASM path available to all tests via environment variable
  const wasmPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../node_modules/sql.js/dist/sql-wasm.wasm'
  );
  process.env.SQL_WASM_PATH = wasmPath;
}

// In Database.ts test initialization
const SQL = await initSqlJs({
  locateFile: (file) => process.env.SQL_WASM_PATH ?? `./node_modules/sql.js/dist/${file}`,
});
```

Database tests run directly in Node — no browser emulation needed since sql.js is just WASM + JavaScript. Worker tests require `@vitest/web-worker` package which simulates the Worker API in a single thread.

**Warning signs:**
- `initSqlJs()` hangs or throws in test environment
- Tests pass with `--environment browser` (real browser) but fail in node
- "CompileError: WebAssembly.instantiate" in test output

**Phase to address:** Phase 1 (Database Foundation) — test infrastructure must be solved before any TDD cycle can begin. First `npm run test` must work.

---

### Pitfall 20: Undo Across View Switch Replays Mutations Against Wrong Projection State

**What goes wrong:**
The command log stores forward and inverse SQL for mutations. When the user undoes an action, the inverse SQL executes against the live database. But the undo stack does not capture provider state (filter, PAFV axis, density) at the time of the mutation. If the user mutates a card in kanban view, switches to list view with a different filter active, then undoes — the mutation is correctly reversed in the database, but the D3 view re-renders with the current list view's query, which may not show the affected card. The user sees no visible change and believes undo failed.

This is not a data corruption issue — the undo is correct — but the UX is broken: undo appears to do nothing.

**Why it happens:**
The command log (D-009) is intentionally decoupled from view state. The spec says "inverse operations, in-memory stack" — it does not say anything about restoring view state on undo. This is correct for data integrity but produces confusing UX.

**How to avoid:**
Two acceptable approaches:
1. **Scoped undo**: Restrict undo to mutations made in the current view/filter context. If a card was mutated while in kanban view and the user is now in list view, disable undo (grey it out with a tooltip explaining context mismatch).
2. **View-jump undo**: After executing the inverse SQL, emit a "scroll-to-card" signal that makes the affected card visible, even if that requires changing the filter/view to show it.

For v1.0, approach 1 is simpler and safer. The command stack should store the `viewType` at mutation time:

```typescript
interface Command {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'batch';
  table: 'cards' | 'connections';
  forward: { sql: string; params: unknown[] };
  inverse: { sql: string; params: unknown[] };
  viewTypeAtMutation: ViewType;  // New field
  timestamp: number;
}
```

The undo button is disabled when `command.viewTypeAtMutation !== providers.pafv.getState().viewType`.

**Warning signs:**
- Users report "undo doesn't work" when switching views between mutation and undo
- Undo appears to succeed (no error) but no visual change occurs
- QA tests undo only within the same view, misses cross-view regression

**Phase to address:** Phase 4 (Mutation Manager) — define the undo scope policy before implementation. Resolving this after shipping is a UX regression.

---

### Pitfall 21: FilterProvider FTS Query and SQL Filter Combined Incorrectly

**What goes wrong:**
`FilterProvider.toSQL()` in the spec compiles FTS as a subquery: `id IN (SELECT rowid FROM cards_fts WHERE cards_fts MATCH ?)`. This is problematic for two reasons:

1. The FTS rowid is not the same as `cards.id`. The correct join is `cards.rowid = cards_fts.rowid`, not `cards.id IN (SELECT rowid ...)`. `cards.id` is TEXT; `cards_fts.rowid` is INTEGER. The subquery compares TEXT to INTEGER and silently matches nothing.

2. When FTS and non-FTS filters are combined with AND, the query planner cannot use the FTS index for the FTS portion because it is wrapped in a subquery correlated to the outer WHERE. Performance degrades to O(n) scans for large datasets.

**Why it happens:**
The spec's `FilterProvider` contains this pattern directly. It is a latent bug: the spec was written with `cards.id` equated to `cards_fts.rowid`, which is only correct if `id` is aliased to `rowid` — it is not in this schema.

**How to avoid:**
Use a proper JOIN pattern instead of the subquery:

```sql
-- CORRECT: FTS + non-FTS filter via JOIN
SELECT c.*, bm25(cards_fts) AS rank
FROM cards c
JOIN cards_fts ON cards_fts.rowid = c.rowid
WHERE cards_fts MATCH ?
  AND c.status = ?
  AND c.deleted_at IS NULL
ORDER BY rank
LIMIT 100
```

The `FilterProvider` should detect when an FTS filter is present and signal to the `QueryCompiler` to use the JOIN form:

```typescript
toSQL(): SQLFragment {
  const hasFTS = this.state.searchQuery !== null;
  // ...
  return {
    where: conditions.join(' AND '),
    params,
    requiresFTSJoin: hasFTS,  // Signal to compiler
  };
}
```

**Warning signs:**
- FTS search returns zero results when combined with any other filter
- FTS works in isolation but not when a folder/status filter is also active
- No test covers the combined FTS + non-FTS filter case

**Phase to address:** Phase 4 (Providers) — write a test that applies both FTS search and a non-FTS filter simultaneously and verifies results. This test will fail against the spec's implementation and expose the bug.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `as any` in D3 view code | Silences type errors quickly | Hides real bugs; defeats strict mode | Never — trace the generic parameter instead |
| `db.exec()` for all queries | Simple API | Returns arrays of raw arrays, not typed objects; no key binding | For schema setup only; use typed wrappers for CRUD |
| Skip `stmt.free()` | Less boilerplate | Memory leak + table locks accumulate | Never — always use try/finally |
| Post full card objects across Worker bridge | Simple bridge contract | Serialization overhead grows with dataset | Never — project minimal fields in SQL |
| Single combined UPDATE trigger for FTS | One trigger feels cleaner | Intermittent FTS index corruption | Never — use the three-trigger pattern |
| Inline WASM as base64 | Simpler deployment | 1.3MB base64 added to JS bundle; no streaming compile | Only acceptable if bundle size is not a constraint and WASM is <1MB |
| Skip D3 key function | Shorter code | DOM thrashing on every data update | Never in this codebase |
| Run force simulation on main thread | Simpler code | Blocks UI during layout convergence | Only for < 50 node graphs with fast cooling |
| No timeout on bridge pending promises | Less code | Silent hangs when Worker handler throws outside try/catch | Never — all bridge promises must timeout |
| Call subscribe() without storing unsubscribe | Less boilerplate | Provider subscriber leak after view destruction | Never — always store and call unsubscribe |
| Return live state from getState() | No copy overhead | Callers mutate internal state bypassing subscribers | Never — return Readonly or a copy |
| Build undo only for single-row mutations | Simpler implementation | ETL batch undos fail with "too many variables" | Never for v1.0 — batch undo is required |
| Skip MAX_ROW_HEADERS limit in SuperGrid | Render any axis mapping | Browser freeze on high-cardinality fields | Never — hard limit must exist in code |

---

## Integration Gotchas

Common mistakes when connecting project components.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| sql.js + Vite | Not excluding sql.js from `optimizeDeps` | Add `optimizeDeps: { exclude: ['sql.js'] }` to `vite.config.ts` |
| sql.js + WKWebView | Relying on `fetch()` for WASM load | Patch `fetch` to use XHR for `.wasm` URLs before `initSqlJs()` call |
| sql.js + Web Worker | Using the bundled worker (`worker.sql-wasm.js`) directly without Vite configuration | Import with `?worker` suffix and configure `locateFile` to use `?url`-resolved WASM path |
| FTS5 + soft delete | Querying FTS without filtering `deleted_at IS NULL` in the JOIN | The FTS index does not know about soft delete — always join to `cards` table and filter there |
| Provider → Worker bridge | Sending raw filter state objects instead of compiled SQL fragments | Providers must compile to `{ where, params }` before crossing the bridge — raw state is not serializable-safe |
| D3 + Worker | Running force simulation on main thread | Force simulation ticks in Worker; only post stable `{id, x, y}` positions to main thread |
| Vitest + sql.js | Running database tests with jsdom environment | Use `node` environment; jsdom has no WebAssembly support |
| FilterProvider + FTS | Using `id IN (SELECT rowid FROM cards_fts ...)` subquery | Use `JOIN cards_fts ON cards_fts.rowid = c.rowid` in the WHERE clause form |
| Provider subscribe + View destroy | Forgetting to call the returned unsubscribe function | Store all unsubscribe functions; call them in ViewManager's destroy step |
| MutationManager + large batch | Inverse DELETE with more than 999 IDs in a single statement | Chunk the inverse into slices of 900 parameters |
| QueryCompiler + empty providers | Concatenating SQL fragments without null guards | Every optional clause must use fallback strings; test with all providers at default state |
| SuperGrid + high-cardinality axis | Rendering all distinct values as headers | Enforce MAX_ROW_HEADERS=50, MAX_COL_HEADERS=100 before rendering |
| D3 transition + fast filter change | Starting new transition without interrupting in-flight | Always call `selection.interrupt()` before starting a new render cycle |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SELECT * in bridge queries | Works at 100 cards | Serialization overhead grows linearly | ~500 cards with content field |
| Re-querying on every provider state change | Responsive at low frequency | Bridge saturates with concurrent queries | High-frequency filter interactions |
| Rendering all cards in SVG without LIMIT | Smooth at < 200 elements | Frame rate drops, transitions stutter | ~500 SVG elements |
| Force simulation on main thread | Fast with 50 nodes | UI freezes during layout | ~200 nodes |
| FTS5 query without LIMIT | Fast at 1K cards | Returns thousands of ranked results, all serialized | 10K+ card datasets |
| D3 transitions on all elements simultaneously | Looks smooth in demos | GPU saturation, frame drops | ~300 concurrent transitions |
| db.export() on every mutation | Simple persistence | Export time grows with DB size | Database > ~5MB |
| SuperGrid with no header count limit | Renders any axis mapping | Browser freeze, OOM | ~200 × ~200 grid (40,000 cells) |
| Provider subscriber accumulation | Works on first mount | N concurrent bridge queries per filter change after N view remounts | After ~5 view switches without destroy() |
| Bridge pending map with no timeout | Simple code | Silent hangs, pending map grows unbounded | Any Worker handler that throws outside try/catch |
| Undo stack with no size limit | Simple code | Memory grows with session length for power users | Sessions with 10K+ mutations |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Passing raw field names from FilterProvider to SQL | SQL injection via field name substitution | Always validate field names against `ALLOWED_FILTER_FIELDS` allowlist before emitting SQL |
| Storing OAuth tokens in `ui_state` SQLite table | Tokens exported with `db.export()` → base64 in postMessage → visible in memory | Keychain only for secrets (D-007); `ui_state` stores non-sensitive preferences only |
| Building SQL in the main thread and posting the string to Worker | SQL construction bypasses Worker-side validation | Providers compile SQL fragments; Worker assembles and executes — never post raw SQL strings from main thread |
| `formula` filter type with user-supplied `compiledSQL` | Arbitrary SQL injection if `compiledSQL` is not sanitized | Defer formula filters to v2; in v1, do not expose `compiledSQL` to user input paths |
| Logging full SQL queries with params in production | Leaks card content in app logs | Log query type and timing only; never log param values containing user data |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state during WASM initialization | Blank screen for 200-500ms on first launch | Show a skeleton/loading state immediately; initialize db asynchronously |
| FTS search with no debounce | Query fires on every keystroke, each cancelling the previous | Debounce FTS queries 150-200ms; show previous results while new query is in-flight |
| Transitions between all 9 views using the same animation | Disorienting when switching between fundamentally different layouts | Different transition types per view pair (fade for incompatible layouts, morph for compatible ones) |
| Selection state surviving view changes | Users confused that selected items don't match visible context | D-005 mandates Selection is Tier 3 — clear on view change |
| No undo feedback | Users accidentally delete cards with no recovery indication | Command log (D-009) is correct — make the undo stack visually accessible |
| Force graph starting from random positions | Every load produces different layout; users build spatial memory | Persist stable graph positions to ui_state (Tier 2) after layout converges |
| Undo appears to do nothing when used after view switch | User distrusts the undo system | Scope undo to current view context (Pitfall 20); grey out cross-context undo with tooltip |
| SuperGrid freezes on high-cardinality axis | App appears broken; user loses work | Enforce hard cell limits; show "too many values to display — increase density" message |
| Filter change interrupts mid-animation | Jank/snap during rapid filter interaction | Debounce re-renders; use interrupt() before new join |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **FTS5 Search:** Passes basic search tests — verify `integrity-check` after UPDATE and DELETE operations; check that soft-deleted cards do not appear in results
- [ ] **Worker Bridge:** Messages round-trip correctly — verify that unmatched response IDs are handled gracefully (promise never resolves vs. error); verify Worker `onerror` propagates to bridge; verify timeout fires when handler never responds
- [ ] **Worker Bridge Init:** `init()` completes and queue is drained — verify messages sent before init resolves are queued and executed, not dropped
- [ ] **Vite Build:** Runs in dev — verify production build places `.wasm` asset correctly, `locateFile` resolves it, and WKWebView loads it
- [ ] **D3 Data Joins:** Renders correctly on first load — verify that filter changes do not destroy and recreate DOM nodes (watch exit selection size)
- [ ] **sql.js Persistence:** Database initializes — verify that backgrounding the app triggers `db.export()` and the exported bytes reach the Swift layer
- [ ] **FTS5 Triggers:** Schema applies — verify triggers exist with `SELECT name FROM sqlite_master WHERE type='trigger'` in tests
- [ ] **TypeScript:** Compiles — verify no `@ts-ignore` or `as any` in view code; `tsc --noEmit --strict` must pass
- [ ] **Provider SQL compilation:** Filters produce correct WHERE clauses — verify injection attempts in values are parameterized (value appears in params array, not in SQL string)
- [ ] **Memory:** Tests pass — run a long-session test (1000 queries) and verify Worker heap is not growing
- [ ] **Provider subscribers:** View mounts 10 times and destroys — verify provider subscriber count stays at 1, not 10
- [ ] **FilterProvider + FTS:** Combined FTS + non-FTS filter returns correct results — write test that applies both simultaneously
- [ ] **Undo batch:** Batch of 1001 mutations undoes successfully — verify 999-variable limit does not apply
- [ ] **SuperGrid axis:** High-cardinality axis (500 distinct values) mapped to grid — verify truncation occurs, no browser freeze
- [ ] **View transitions:** Rapid filter changes (5 in 200ms) — verify no console errors, no visual snap, no accumulated listeners
- [ ] **QueryCompiler empty state:** All providers at default — verify SQL is valid and parseable

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| WASM MIME type failure in WKWebView | LOW | Add fetch() patch to entry point; test once in simulator |
| FTS5 index corruption | HIGH | Rebuild FTS index with `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` after fixing triggers; data in cards table is safe |
| WASM path broken in production build | LOW | Add `?url` import for WASM path and explicit `locateFile` callback |
| Memory leak from un-freed statements | MEDIUM | Audit all `db.prepare()` calls; add try/finally; restart Worker to clear heap |
| Data loss from missing persistence | HIGH | Implement export-on-background immediately; any data already lost cannot be recovered from in-memory db |
| D3 key function missing | LOW | Add key function; reconcile any existing state mismatches |
| D3 SVG performance wall | MEDIUM | Add LIMIT enforcement to providers; implement staggered transitions; profile which view is the bottleneck |
| Worker init race condition | LOW | Add message queue in Worker; gate bridge calls on ready promise |
| Pending map timeout missing | LOW | Add timeout to `send()` method; existing callers auto-benefit |
| Provider subscriber leak | MEDIUM | Audit all view mount/destroy pairs; add subscribe count assertion to tests |
| getState() mutation bypass | MEDIUM | Add `Readonly<T>` return types; search for direct Map/Set mutation on state references |
| Batch undo 999-variable error | MEDIUM | Implement ID chunking in MutationManager; existing commands must be rebuilt |
| SuperGrid freeze | LOW | Add MAX_ROW_HEADERS check; existing renders auto-cap |
| FTS + SQL filter returns empty | LOW | Fix FilterProvider to use JOIN form; add combined filter test |
| Undo appears to do nothing | LOW | Scope undo to view context; add visual indicator |
| D3 listener accumulation | MEDIUM | Move `.on()` calls from update to enter selection; may require view rewrite |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WKWebView WASM MIME type (Pitfall 1) | Phase 1: Database Foundation | WKWebView integration test: `initSqlJs()` succeeds in iOS simulator |
| FTS5 trigger corruption (Pitfall 2) | Phase 1: Database Foundation | `integrity-check` test after 100 random CUD operations passes |
| Vite WASM path in production (Pitfall 3) | Phase 1: Database Foundation | `vite build` + smoke test with production bundle; WASM file present in `dist/assets/` |
| In-memory data loss (Pitfall 4) | Phase 3: Worker Bridge | Native shell lifecycle test: background app, verify export received by Swift |
| Prepared statement leaks (Pitfall 5) | Phase 2: CRUD + Queries | Long-session test: 1000 queries, Worker heap stable |
| D3 key function missing (Pitfall 6) | Phase 5: Views | Code review checklist; lint rule if feasible |
| SVG performance wall (Pitfall 7) | Phase 5: Views | Performance test: 500 cards render at ≥60fps; 100 cards with transitions |
| Worker bridge serialization (Pitfall 8) | Phase 3: Worker Bridge | Bridge latency test: filter query on 10K cards returns in <100ms |
| TypeScript D3 type friction (Pitfall 9) | Phase 5: Views | `tsc --noEmit --strict` passes with zero `as any` in view code |
| Vitest WASM test setup (Pitfall 10) | Phase 1: Database Foundation | `npm run test` succeeds on a clean clone with `node` environment |
| Worker init race condition (Pitfall 11) | Phase 3: Worker Bridge | Test: call bridge before init() resolves; assert response arrives correctly |
| Pending map grows unbounded (Pitfall 12) | Phase 3: Worker Bridge | Test: mock handler that never responds; verify timeout rejection after N ms |
| Provider subscriber leak (Pitfall 13) | Phase 4: Providers | Test: mount+destroy 10×; assert subscriber count stays at 1 |
| State mutation bypasses subscribers (Pitfall 14) | Phase 4: Providers | TypeScript: `Readonly<T>` return types on getState(); compile-time enforcement |
| QueryCompiler empty SQL (Pitfall 15) | Phase 4: Providers | Test: compileViewQuery() with all providers at default state; assert SQL parses |
| Undo batch 999-variable limit (Pitfall 16) | Phase 4: Mutation Manager | Test: batch of 1001 mutations, undo executes without SQL variable error |
| View transition interrupted (Pitfall 17) | Phase 5: Views | Test: 5 rapid filter changes in 200ms; assert no errors, no visual snap |
| SuperGrid header explosion (Pitfall 18) | Phase 5: SuperGrid | Test: 500-value axis field mapped to grid; assert truncation, no freeze |
| D3 listener accumulation (Pitfall 19) | Phase 5: Views | Test: render same view 10×; assert single click triggers handler exactly once |
| Undo across view switch (Pitfall 20) | Phase 4: Mutation Manager | Test: mutate in kanban, switch to list, undo; assert UX response is correct |
| FTS + SQL filter rowid bug (Pitfall 21) | Phase 4: Providers | Test: FTS + status filter simultaneously; assert non-zero results |

---

## Sources

- [sql.js GitHub README — initialization, locateFile, statement.free()](https://github.com/sql-js/sql.js/blob/master/README.md)
- [sql.js Issue #521 — WASM file not loading correctly in web workers](https://github.com/sql-js/sql.js/issues/521)
- [sql.js Issue #393 — WASM MIME type error](https://github.com/sql-js/sql.js/issues/393)
- [sql.js Issue #462 — Using Web Workers for CPU-intensive queries](https://github.com/sql-js/sql.js/issues/462)
- [WKWebView fetch() vs XHR for local WASM — GitHub Gist](https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c)
- [SQLite FTS5 official docs — external content tables and trigger patterns](https://sqlite.org/fts5.html)
- [SQLite forum — Corrupt FTS5 table after declaring triggers a certain way](https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e)
- [SQLite Undo/Redo — official canonical approach](https://www.sqlite.org/undoredo.html)
- [Vite Features — WASM, optimizeDeps, worker configuration](https://vite.dev/guide/features)
- [vite-plugin-wasm — npm](https://www.npmjs.com/package/vite-plugin-wasm)
- [Vitest Environment docs — node vs jsdom vs happy-dom](https://vitest.dev/guide/environment)
- [Vitest Discussion #4283 — Issues Loading and Testing WASM Modules](https://github.com/vitest-dev/vitest/discussions/4283)
- [D3 data joins — d3js.org](https://d3js.org/d3-selection/joining)
- [D3 transition control flow — d3js.org](https://d3js.org/d3-transition/control-flow)
- [D3 transition interrupt — GitHub d3/d3-transition](https://github.com/d3/d3-transition)
- [D3 transition memory leak — d3/d3 Issue #2776](https://github.com/d3/d3/issues/2776)
- [D3 event listener memory leak — d3/d3-selection Issue #186](https://github.com/d3/d3-selection/issues/186)
- [D3 TypeScript Issue #3459 — Selection type assignability](https://github.com/d3/d3/issues/3459)
- [DefinitelyTyped d3-selection index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/d3-selection/index.d.ts)
- [D3 SVG performance — Scott Logic: Rendering One Million Datapoints](https://blog.scottlogic.com/2020/05/01/rendering-one-million-points-with-d3.html)
- [Web Worker postMessage performance — Nolan Lawson](https://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/)
- [postMessage serialization blocking behavior — MDN Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [surma.dev — Is postMessage slow?](https://surma.dev/things/is-postmessage-slow/)
- [Web Worker initialization race — Dave's Cool Blog](http://davescoolblog.blogspot.com/2012/02/web-worker-initialization-race.html)
- [Singleton Promise pattern for async init — Jon Mellman](https://www.jonmellman.com/posts/singleton-promises/)
- [sql.js Wiki — Persisting a Modified Database](https://github.com/sql-js/sql.js/wiki/Persisting-a-Modified-Database)
- [Isometry v5 CLAUDE-v5.md — Architectural decisions D-001 through D-010](local)
- [Isometry v5 Modules/Core/WorkerBridge.md — Canonical bridge spec](local)
- [Isometry v5 Modules/Providers.md — FilterProvider, PAFVProvider, QueryCompiler spec](local)

---
*Pitfalls research for: local-first TypeScript/D3.js in-browser SQLite platform (WKWebView)*
*v0.1 Data Foundation pitfalls: Researched 2026-02-27*
*v1.0 Web Runtime pitfalls added: 2026-02-28*
