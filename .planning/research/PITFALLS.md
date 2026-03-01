# Pitfalls Research

**Domain:** Local-first TypeScript/D3.js in-browser SQLite data projection platform (WKWebView)
**Researched:** 2026-02-27 (v0.1 pitfalls) · 2026-02-28 (v1.0 Web Runtime pitfalls added) · 2026-03-01 (v1.1 ETL Importers pitfalls added)
**Confidence:** MEDIUM-HIGH — most pitfalls verified via official docs, GitHub issues, and community discussions; ETL pitfalls are MEDIUM confidence from sql.js GitHub issues, SheetJS docs, and community discussions; some ETL-specific pitfalls are HIGH confidence from first principles (SQL injection, dedup races, memory bounds)

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


---

## ETL Importer Pitfalls (v1.1)

---

### Pitfall 22: sql.js WASM Heap OOM on Large Imports (Memory Pressure)

**What goes wrong:**
Importing a large Apple Notes export (5,000+ notes with attachments) causes sql.js to consume more memory than the browser WASM heap allows, resulting in a tab crash or an `OOM: Cannot allocate Wasm memory` error. The failure mode is silent: the Worker dies, the bridge receives no response, and the main thread waits indefinitely until its timeout fires.

sql.js holds the entire database in WASM heap memory. A 5,000-note import can add 20-50MB to the heap from card content alone. When combined with the base WASM binary (~756KB), existing database state, FTS5 index segments, and the parsed JSON payload (which may be held in memory during parsing), total heap consumption can exceed 150MB — the practical limit for many WKWebView environments on constrained devices.

**Why it happens:**
- sql.js does not write to disk; everything lives in WASM heap
- The FTS5 index stores un-merged segments during bulk inserts — segment count grows until an automatic merge, temporarily doubling memory
- The parsed JSON payload for a large export may be held alongside the in-progress database state
- Content fields (full note text) can be large; `content TEXT` is stored in full in both the `cards` table and the FTS5 index segments

**How to avoid:**
Process imports in chunks of 500 cards per transaction:

```typescript
const CHUNK_SIZE = 500;

async function writeCardsInChunks(cards: CanonicalCard[]): Promise<void> {
  for (let i = 0; i < cards.length; i += CHUNK_SIZE) {
    const chunk = cards.slice(i, i + CHUNK_SIZE);
    await bridge.transaction(
      chunk.map(card => ({ sql: INSERT_SQL, params: cardToParams(card) }))
    );
    // Yield to event loop between chunks to allow GC
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  // Optimize FTS5 after all inserts to merge segments and reduce fragmentation
  await bridge.exec('INSERT INTO cards_fts(cards_fts) VALUES('optimize')');
}
```

Additionally, for Apple Notes imports, strip or truncate `attachment.data` (Base64-encoded attachment bytes) before inserting — these should not be stored in SQLite cards:

```typescript
private parseNote(note: AltoNote): CanonicalCard {
  // Don't embed Base64 attachment data in SQLite card content
  const content = this.normalizeContent(note.content);
  // summary is capped at 200 chars — enforce in parser, not SQL
  return { ..., content, summary: this.generateSummary(content) };
}
```

**Warning signs:**
- Worker goes silent (no response, no error) during large imports
- Tab memory usage visible in Activity Monitor grows past 200MB during import
- Import succeeds for 1,000 notes but crashes at 5,000
- `etl:import` bridge message times out

**Phase to address:** Phase 8 (ETL Import Pipeline) — add a memory-pressure test that imports 5,000 synthetic cards and verifies no OOM. Use chunk writes from day one.

**Severity:** CRITICAL — silent data loss, no recovery without undo/re-import

---

### Pitfall 23: sql.js Buffer Overflow on Large SQL String in Database.run()

**What goes wrong:**
Passing a large SQL string to `db.run()` or `db.exec()` — for example a multi-row VALUES INSERT with 3,000+ rows concatenated as a single string — causes a buffer overflow inside the WASM heap. The error manifests as "Memory access out of bounds" and corrupts subsequent database operations in the same Worker session. All queries after this point return garbage or fail silently.

This is distinct from the heap OOM in Pitfall 22. This is a **query string size limit** in the sql.js WASM binding layer, independent of available memory.

**Why it happens:**
sql.js copies the SQL string into the WASM heap before passing it to SQLite. There is an undocumented limit on this copy buffer size (observed failures at ~1.5MB query strings, around 3,700 concatenated rows). The limit is inconsistent across sql.js versions and WASM build configurations.

**How to avoid:**
Never use `db.exec()` or `db.run()` with a large concatenated SQL string. Always use the `transaction(operations[])` pattern from the WorkerBridge spec, where each operation is a single parameterized INSERT:

```typescript
// WRONG: Single huge string
db.run(`INSERT INTO cards VALUES ('id1', ...), ('id2', ...), ...`);  // 3000 rows → buffer overflow

// CORRECT: Parameterized, one row per operation
await bridge.transaction(cards.map(card => ({
  sql: 'INSERT INTO cards (id, name, ...) VALUES (?, ?, ...)',
  params: [card.id, card.name, ...]
})));
```

The existing `SQLiteWriter.writeCards()` in the spec already uses the correct pattern (batch of 100 per transaction). The pitfall occurs if a developer bypasses `SQLiteWriter` to "optimize" with a multi-row VALUES INSERT.

**Warning signs:**
- "Memory access out of bounds" in Worker console
- All subsequent `bridge.query()` calls return empty arrays after a bulk insert
- Import appears to succeed (no thrown error) but card count in database is wrong
- Problem only manifests above a certain batch size threshold

**Phase to address:** Phase 8 (ETL Import Pipeline) — SQLiteWriter's 100-row transaction batch must be enforced as the only write path. Add a test that verifies 1,000 cards are inserted correctly across 10 transactions.

**Severity:** CRITICAL — data corruption, silent failure

---

### Pitfall 24: FTS5 Trigger Overhead Makes Bulk Imports Prohibitively Slow

**What goes wrong:**
Each INSERT into `cards` fires three FTS5 triggers (insert, and potentially update/delete if content changes). For a bulk import of 10,000 cards, this is 10,000 trigger firings, each performing an FTS index segment merge. FTS5 merges segments automatically every 64 inserts, but the merge cost grows with segment count. A 10,000-card import that should take ~2s can take 30-60s because of FTS segment fragmentation during the import.

Additionally, the insert trigger as currently defined fires even when `content` and `name` are null, writing null values into FTS — producing phantom FTS entries that return no useful text but consume index space.

**Why it happens:**
FTS5 with an external content table processes each trigger independently without batching. The trigger-based approach is correct for OLTP (single-row inserts), but for bulk ETL ingestion it creates O(n) segment merges instead of a single `INSERT INTO cards_fts SELECT ... FROM cards` pass.

**How to avoid:**
For bulk imports, disable the triggers during import and rebuild FTS manually after:

```typescript
async function bulkImportWithFTSOptimization(
  cards: CanonicalCard[],
  db: Database
): Promise<void> {
  // Disable FTS triggers for bulk import
  db.run('DROP TRIGGER IF EXISTS trg_cards_fts_insert');
  
  try {
    // Write cards in chunks (see Pitfall 22)
    for (let i = 0; i < cards.length; i += 500) {
      const chunk = cards.slice(i, i + 500);
      // ... parameterized inserts
    }
    
    // Rebuild FTS from cards table in one fast pass
    db.run('INSERT INTO cards_fts(rowid, name, content, tags, folder) SELECT rowid, name, content, tags, folder FROM cards');
    
    // Optimize segments into a single merged segment
    db.run("INSERT INTO cards_fts(cards_fts) VALUES('optimize')");
    
  } finally {
    // Restore trigger
    db.run(`CREATE TRIGGER IF NOT EXISTS trg_cards_fts_insert AFTER INSERT ON cards BEGIN
      INSERT INTO cards_fts(rowid, name, content, tags, folder)
      VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
    END`);
  }
}
```

For incremental imports (re-importing after first import), the trigger-based approach is correct — only new/changed cards are affected.

**Warning signs:**
- Import of 1,000 cards takes >5s (expected: <500ms)
- Worker CPU usage stays at 100% for the entire import duration
- FTS5 `integrity-check` passes but segment count is very high (>100 segments visible via fts5vocab)
- Progress reporting stalls mid-import without Worker error

**Phase to address:** Phase 8 (ETL Import Pipeline) — benchmark FTS write performance with 10K cards on first implementation. If over 5s, add the trigger-disable/rebuild pattern.

**Severity:** HIGH — import unusably slow at realistic dataset sizes

---

### Pitfall 25: DedupEngine SQL Injection via String-Interpolated source_id Values

**What goes wrong:**
The `DedupEngine.process()` method in `DataExplorer.md` constructs an IN clause by string-interpolating source keys:

```typescript
// DANGER: source_id values from external files are interpolated directly into SQL
const sourceKeys = cards.map(c => `'${c.source}:${c.source_id}'`).join(',');
const existing = await this.bridge.query<...>(`
  SELECT id, source, source_id, modified_at FROM cards
  WHERE source || ':' || source_id IN (${sourceKeys})
`);
```

If a source_id from an imported file contains a single quote (e.g., `O'Brien's Note`), the string interpolation breaks the SQL. If it contains `'; DROP TABLE cards; --`, it executes arbitrary SQL. Apple Notes note IDs are opaque strings (generally safe), but Markdown file paths (`file.path`) are user-supplied and can contain any character.

**Why it happens:**
The DedupEngine was written before the SQL safety rules were applied. The allowlist pattern from `Contracts.md` applies to column names in WHERE clauses, but the DedupEngine constructs an IN clause from data values — a different injection vector that the allowlist does not cover.

**How to avoid:**
Use JSON-based parameter passing to avoid the IN clause limit and injection simultaneously:

```typescript
async process(cards: CanonicalCard[], connections: CanonicalConnection[]): Promise<DedupResult> {
  // Use JSON to pass an unlimited number of keys as a single parameter
  const sourceKeys = cards.map(c => `${c.source}:${c.source_id}`);
  const existing = await this.bridge.query<ExistingCard>(`
    SELECT id, source, source_id, modified_at FROM cards
    WHERE (source || ':' || source_id) IN (
      SELECT value FROM json_each(?)
    )
  `, [JSON.stringify(sourceKeys)]);
  // ...
}
```

This approach is both injection-safe (all values are in a single JSON parameter) and avoids the 999-variable limit (entire array is one `?` binding).

**Warning signs:**
- Import of a Markdown file with an apostrophe in the path fails with SQL syntax error
- `DedupEngine` produces incorrect dedup results for source IDs containing special characters
- No test covers source_id values with quotes, semicolons, or backslashes

**Phase to address:** Phase 8 (ETL Import Pipeline) — fix DedupEngine before the first ETL test. The SQL injection vector must be eliminated before any external data is processed.

**Severity:** CRITICAL — SQL injection from imported file contents; silent dedup failures

---

### Pitfall 26: gray-matter Has a Node.js fs Dependency That Breaks in Browser/Worker

**What goes wrong:**
`gray-matter` is specified as the Markdown frontmatter parser in `DataExplorer.md`. gray-matter has a direct dependency on Node.js's `fs` module. When bundled with Vite for browser/Worker execution, the build fails with:

```
[vite] error: Cannot resolve module 'fs'
```

Or, if Vite shims `fs` with an empty stub, gray-matter imports silently fail and `matter()` returns an empty `data` object — all frontmatter is lost without error.

**Why it happens:**
gray-matter uses `fs.readFileSync` in its file-reading code path. Even though `matter(string)` (parsing from a string) does not call `fs`, the bundler cannot tree-shake the conditional import statically. GitHub issues #49 and #50 in the gray-matter repo have requested this fix, but it remains unresolved as of 2025.

**How to avoid:**
Use the `gray-matter-browser` package (a maintained browser-compatible fork) or add an explicit Vite alias to strip the fs dependency:

```typescript
// vite.config.ts — Option 1: alias to browser-safe build
export default defineConfig({
  resolve: {
    alias: {
      'gray-matter': 'gray-matter-browser'
    }
  }
});
```

Alternatively, implement a minimal frontmatter parser inline for the MarkdownParser — YAML frontmatter is a simple format (delimited by `---`, key: value pairs):

```typescript
function parseFrontmatter(content: string): { data: Record<string, unknown>; content: string } {
  if (!content.startsWith('---')) return { data: {}, content };
  const end = content.indexOf('
---', 3);
  if (end === -1) return { data: {}, content };
  
  const yaml = content.slice(4, end).trim();
  const body = content.slice(end + 4).trim();
  
  const data: Record<string, unknown> = {};
  for (const line of yaml.split('
')) {
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '');
    data[key] = value;
  }
  return { data, body };
}
```

The inline parser handles 95% of real-world Obsidian/Bear frontmatter without a dependency.

**Warning signs:**
- `vite build` fails with "Cannot resolve 'fs'" when MarkdownParser is included
- Frontmatter values are all `undefined` after import even for valid `.md` files
- `npm run test` works (Node.js has `fs`) but browser import fails

**Phase to address:** Phase 8 (ETL Import Pipeline) — verify browser/Worker compatibility of gray-matter before writing MarkdownParser tests. Run the parser in a Worker test context, not Node.js.

**Severity:** HIGH — complete loss of frontmatter (dates, tags, status) for all Markdown imports

---

### Pitfall 27: SheetJS (xlsx) Bundle Size (~1MB) Inflates Initial Load

**What goes wrong:**
The `xlsx` npm package (SheetJS) adds approximately 1MB to the bundle in its full build, including codepage support for legacy Excel formats (XLS, XLSB, Lotus). This is significant for a WKWebView-hosted app where initial JS load time directly impacts startup time. Users experience a noticeable delay before the app is interactive, even if they never import an Excel file.

**Why it happens:**
SheetJS bundles codepage libraries and format parsers for every format it supports. The full build (`xlsx.full.min.js`) includes XLS (BIFF8), XLSB, SpreadsheetML 2003, Lotus 1-2-3, Numbers, and others. Most Isometry users only need XLSX.

**How to avoid:**
Use dynamic import to load the xlsx parser only when the user initiates an Excel import:

```typescript
// ExcelParser.ts — lazy-load SheetJS on first use
let XLSX: typeof import('xlsx') | null = null;

export class ExcelParser {
  async parse(data: ArrayBuffer, options: ParseOptions = {}): Promise<CanonicalCard[]> {
    if (!XLSX) {
      XLSX = await import('xlsx');
    }
    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
    // ...
  }
}
```

Additionally, use the slim build in `vite.config.ts` to exclude the codepage library:

```typescript
// vite.config.ts
resolve: {
  alias: {
    'xlsx': 'xlsx/dist/xlsx.mini.min.js'
  }
}
```

The `xlsx.mini.min.js` build is ~600KB smaller and supports XLSX, CSV, and JSON — sufficient for Isometry's use case.

**Warning signs:**
- Bundle analyzer shows `xlsx` as the largest dependency
- App startup time increases by 500ms+ in WKWebView on slower devices
- Lighthouse performance score drops due to large JS payload

**Phase to address:** Phase 8 (ETL Import Pipeline) — add dynamic import from the first ExcelParser implementation. Do not import xlsx statically at module load time.

**Severity:** MODERATE — startup performance impact; no data correctness issue

---

### Pitfall 28: CSV Encoding and UTF-8 BOM Silently Corrupts First Column

**What goes wrong:**
Excel-exported CSV files frequently include a UTF-8 BOM (byte order mark: `﻿` / EF BB BF) at the start of the file. When the BOM is not stripped before parsing, the first column header becomes `"﻿name"` instead of `"name"`. The `ExcelParser.findColumn()` method's candidate matching (`['title', 'name', 'subject']`) fails to find the column, and every row is assigned `"Row N"` as its title instead of the actual title field.

This failure is invisible in development if test CSV files are generated without a BOM, but affects nearly all CSV exports from Excel on Windows.

**Why it happens:**
The browser `FileReader.readAsText()` does not strip the BOM by default. When the user reads a file via the native shell and passes it to the Worker as a string, the BOM is preserved as the first character.

**How to avoid:**
Strip BOM before parsing in the CSVParser:

```typescript
export class CSVParser {
  parse(content: string, options: ParseOptions = {}): CanonicalCard[] {
    // Strip UTF-8 BOM if present
    const cleaned = content.charCodeAt(0) === 0xFEFF
      ? content.slice(1)
      : content;
    
    // Also handle Windows line endings
    const normalized = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return this.parseCSV(normalized, options);
  }
}
```

Also handle the case where `data` arrives as an `ArrayBuffer` — decode with BOM-awareness:

```typescript
const decoder = new TextDecoder('utf-8', { ignoreBOM: true });
const text = decoder.decode(arrayBuffer);
```

`TextDecoder` with `ignoreBOM: true` handles BOM stripping automatically.

**Warning signs:**
- First column of every imported CSV row has `﻿` prepended to its key
- Column auto-detection fails for all CSV files from Excel/Windows
- Column names like `"name"` are not found; cards all get default titles

**Phase to address:** Phase 8 (CSVParser implementation) — first CSVParser test must use a BOM-prefixed fixture. Do not test only with BOM-free strings.

**Severity:** MODERATE — systematic title loss for all Excel-exported CSV files; silent failure

---

### Pitfall 29: HTML Content Parsed with DOMParser Retains Script/Style Tags and May Execute Code

**What goes wrong:**
The `HTMLParser` (for web clippings) uses `document.createElement('div')` or `DOMParser.parseFromString()` to extract text from HTML. If the HTML contains `<script>` tags, those scripts execute immediately upon parsing in non-sandboxed contexts. If the HTML is later rendered into the DOM (e.g., in a card detail view), stored XSS payloads execute.

Additionally, `DOMParser` has a known mXSS (mutation XSS) vulnerability: the parser's output can differ from the browser's DOM parser for certain edge cases (namespace issues, `<noscript>` content), causing sanitizer bypasses.

**Why it happens:**
Web clippings frequently contain JavaScript (analytics, tracking, interactivity). `document.createElement('div').innerHTML = html` executes `<script>` tags synchronously. Even without script execution, certain HTML constructs can survive naive sanitization.

**How to avoid:**
Parse HTML for text extraction only in the Worker context — the Worker has no DOM access, so scripts cannot execute. Use a pure-JS HTML-to-text library like `@mozilla/readability` for content extraction, or strip tags with a regex-only approach for the simple case:

```typescript
// Worker-safe HTML text extraction (no DOM access)
function htmlToText(html: string): string {
  return html
    // Remove all script and style content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // Remove HTML comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Convert block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|br)>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

If the full HTML must be stored for rendering, store it as a raw string in `content` and render it only in a sandboxed `<iframe>` or via `DOMPurify` before display.

**Warning signs:**
- Importing HTML web clippings causes JavaScript execution in the Worker (impossible if Worker is correctly used)
- Card detail view shows unexpected behavior for notes imported from web clippings
- XSS payload stored in `content` field executes when card is displayed

**Phase to address:** Phase 8 (HTMLParser implementation) — the HTMLParser must run in the Worker, not on the main thread. Text extraction must strip scripts before the content field is populated. No stored HTML should be rendered without DOMPurify.

**Severity:** HIGH — XSS vector if HTML is rendered in UI; requires Worker-side text extraction

---

### Pitfall 30: Connection ID Resolution Fails for Cross-Note Links During Dedup Phase

**What goes wrong:**
`AppleNotesParser` creates `CanonicalConnection` records for internal note links (`link.type === 'note'`), using `link.target_note_id` as the connection's `target_id`. But `target_note_id` is the **source system's ID** (the Apple Notes note UUID), not the Isometry card ID.

The `DedupEngine.process()` method resolves IDs via `sourceIdMap`, mapping each source system ID to its Isometry card ID. However, if the target note was not included in the current import batch (e.g., it was imported in a previous run), it won't be in `sourceIdMap`, and the connection's `target_id` remains as the Apple Notes UUID — which does not exist in the `cards` table. The connection INSERT fails with a foreign key violation, or worse, `INSERT OR IGNORE` silently drops the connection.

**Why it happens:**
The `parseLinks` method in `AppleNotesParser` creates connections with `target_id: link.target_note_id!` before the dedup phase runs. The dedup phase resolves IDs for cards in the *current batch* but not for cards from *previous batches*. Cross-batch links are orphaned.

**How to avoid:**
Resolve cross-batch links in the dedup phase by querying the database for existing source IDs:

```typescript
async process(cards: CanonicalCard[], connections: CanonicalConnection[]): Promise<DedupResult> {
  // ... build sourceIdMap from current batch ...
  
  // For connection targets NOT in sourceIdMap, look them up in the database
  const unresolvedTargetSourceIds = connections
    .map(c => c.target_id)
    .filter(id => !sourceIdMap.has(id));
  
  if (unresolvedTargetSourceIds.length > 0) {
    const existingTargets = await this.bridge.query<{ id: string; source_id: string }>(
      `SELECT id, source_id FROM cards WHERE source_id IN (SELECT value FROM json_each(?))`,
      [JSON.stringify(unresolvedTargetSourceIds)]
    );
    
    for (const row of existingTargets) {
      sourceIdMap.set(row.source_id, row.id);
    }
  }
  
  // Now resolve connections — any remaining unresolved targets are truly missing
  const resolvedConnections = connections
    .map(conn => ({
      ...conn,
      target_id: sourceIdMap.get(conn.target_id) || conn.target_id
    }))
    .filter(conn => {
      const isResolved = sourceIdMap.has(conn.target_id) || conn.target_id.length === 36; // UUID format check
      if (!isResolved) {
        console.warn(`Connection target ${conn.target_id} not found in database`);
      }
      return isResolved;
    });
}
```

**Warning signs:**
- `connections` table has fewer rows than expected after import
- Foreign key constraint errors during connection INSERT (if FK enforcement is enabled)
- Graph view shows disconnected nodes for notes that were imported across multiple import runs
- Re-importing the same export produces different connection counts than the first import

**Phase to address:** Phase 8 (DedupEngine implementation) — write a test that imports a set of notes where some notes reference each other, then re-imports an expanded set. Verify connections between all notes exist after the second import.

**Severity:** HIGH — silent data loss for the graph relationship layer; connections between notes dropped without warning

---

### Pitfall 31: Re-Import Timestamp Comparison Uses String Comparison Instead of Date Semantics

**What goes wrong:**
The `DedupEngine` decides whether to update an existing card by comparing `card.modified_at > existing.modified_at`. Both values are ISO 8601 strings. String comparison works correctly for full ISO 8601 strings (e.g., `"2024-03-15T10:00:00Z"`) because the format is lexicographically ordered. However:

1. If the source system provides `modified_at` without a timezone (e.g., `"2024-03-15T10:00:00"`), string comparison is unreliable — the strings cannot be compared with the existing database values which use `Z` suffix
2. If a parser passes a date without normalizing to UTC ISO 8601 (e.g., `"15 March 2024"` or `"2024/03/15"`), the comparison may always favor update (treating any non-ISO string as "newer")
3. Obsidian/Bear Markdown frontmatter frequently uses `modified: 2024-03-15` (date only) — this compares incorrectly against the stored ISO 8601 timestamp

**Why it happens:**
`MarkdownParser.parseDate()` handles multiple date formats but does not always normalize to UTC. For example, `new Date("2024-03-15")` returns midnight UTC on some browsers but midnight local time on others (a known browser inconsistency). The resulting `.toISOString()` may be `"2024-03-14T23:00:00.000Z"` on a UTC+1 machine — one day off.

**How to avoid:**
Normalize all timestamps to UTC ISO 8601 with explicit Z suffix before storing:

```typescript
function normalizeTimestamp(value: unknown): string {
  const now = new Date().toISOString();
  if (!value) return now;
  
  // Handle Date objects
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? now : value.toISOString();
  }
  
  if (typeof value !== 'string') return now;
  
  // Already normalized
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return value;
  }
  
  // Date-only format: parse as UTC noon to avoid timezone edge
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value}T12:00:00.000Z`;
  }
  
  // Try general parse
  const d = new Date(value);
  return isNaN(d.getTime()) ? now : d.toISOString();
}
```

Use `normalizeTimestamp()` in every parser's date fields before returning the `CanonicalCard`.

**Warning signs:**
- Re-importing the same file repeatedly triggers unnecessary updates (every card is "newer")
- Markdown files with `date-only` frontmatter dates get updated on every re-import
- Cards imported on machines in different timezones have inconsistent timestamps
- DedupEngine `toUpdate` list is larger than expected on incremental imports

**Phase to address:** Phase 8 (Parser implementations) — add a timestamp normalization utility before implementing any parser. Test with date-only strings, timezone-offset strings, and ISO 8601 full strings.

**Severity:** MODERATE — unnecessary updates on re-import, incorrect ordering in time views; data is not corrupted but provenance is wrong

---

### Pitfall 32: postMessage of Large Import Data Copies Instead of Transferring

**What goes wrong:**
The `WorkerBridge.importFile(data: ArrayBuffer, source, options)` method passes an `ArrayBuffer` to the Worker via `postMessage`. Without specifying the `ArrayBuffer` in the transferable list, the Structured Clone Algorithm copies the buffer — doubling memory consumption temporarily. For a 50MB Apple Notes JSON export, this means 50MB on the main thread + 50MB copy in the Worker = 100MB peak, plus whatever sql.js needs for the import itself.

After a non-transfer `postMessage`, the original `ArrayBuffer` remains on the main thread, occupying memory until GC. The main thread holds the original, the Worker holds the copy, and sql.js holds the parsed in-memory representation — three copies of the data may coexist at peak.

**Why it happens:**
The WorkerBridge `send()` method uses `this.worker.postMessage({ id, type, payload })` without a transfer list. When `payload` contains an `ArrayBuffer`, it must be explicitly listed in the transfer array for zero-copy transfer.

**How to avoid:**
Modify the bridge to detect `ArrayBuffer` payloads and use transferable transfer:

```typescript
private send<T>(type: MessageType, payload: unknown, timeoutMs = 30_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = crypto.randomUUID();
    
    // Collect transferables from payload
    const transferables: Transferable[] = [];
    if (payload instanceof ArrayBuffer) {
      transferables.push(payload);
    } else if (payload && typeof payload === 'object') {
      for (const val of Object.values(payload as Record<string, unknown>)) {
        if (val instanceof ArrayBuffer) transferables.push(val);
      }
    }
    
    // ... timeout setup ...
    
    // Transfer instead of copy for ArrayBuffer payloads
    this.worker.postMessage(
      { id, type, payload, timestamp: Date.now() },
      transferables
    );
  });
}
```

After transfer, the main thread's `ArrayBuffer` is detached (`.byteLength === 0`). Document this behavior: callers must not use the `data` reference after `importFile()` is called.

**Warning signs:**
- Activity Monitor shows doubled memory during import (main thread + Worker both holding large buffer)
- GC pauses after large imports as main thread frees the original buffer
- Out-of-memory during import despite the file being smaller than available memory

**Phase to address:** Phase 8 (ETL Import Pipeline) — add transfer list to `importFile()` call from day one. Add a test that verifies the `ArrayBuffer.byteLength === 0` on the main thread after `importFile()` returns.

**Severity:** MODERATE — memory overhead; can cause OOM on constrained devices for large imports

---

### Pitfall 33: Export of Large Datasets Blocks the Worker Thread

**What goes wrong:**
`ExportOrchestrator.export()` queries all cards (`SELECT * FROM cards WHERE ...`) and then serializes them to Markdown, JSON, or CSV in the Worker thread. For a 10,000-card database, this single synchronous operation blocks the Worker for several seconds. During this time, all other bridge requests (queries from D3 views, user interactions) queue up and appear frozen to the user.

The JSON export is especially dangerous: `JSON.stringify(cards, null, 2)` for 10,000 cards with `content` fields can produce a 50MB+ string, which then must be serialized via `postMessage` back to the main thread as a second copy.

**Why it happens:**
The Worker is single-threaded. A single large synchronous operation monopolizes it. The bridge's pending map accumulates all queued requests during the export, and they all resolve immediately after — causing a thundering herd of simultaneous re-renders when the Worker is unblocked.

**How to avoid:**
Use pagination for large exports and stream results:

```typescript
// ExportOrchestrator — paginated export with progress events
async exportLarge(
  format: 'markdown' | 'json' | 'csv',
  onProgress: (pct: number) => void
): Promise<string> {
  const total = await this.bridge.query<{ count: number }>(
    'SELECT COUNT(*) as count FROM cards WHERE deleted_at IS NULL'
  );
  const cardCount = total[0].count;
  
  const PAGE_SIZE = 500;
  const pages = Math.ceil(cardCount / PAGE_SIZE);
  const parts: string[] = [];
  
  for (let page = 0; page < pages; page++) {
    const cards = await this.bridge.query<Card>(
      'SELECT * FROM cards WHERE deleted_at IS NULL LIMIT ? OFFSET ?',
      [PAGE_SIZE, page * PAGE_SIZE]
    );
    parts.push(this.encodePage(format, cards, page === 0));
    onProgress(Math.round(((page + 1) / pages) * 100));
    
    // Yield between pages to allow other Worker messages to process
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return parts.join(format === 'csv' ? '\n' : '\n\n---\n\n');
}
```

**Warning signs:**
- App appears frozen during large exports
- All pending UI interactions execute simultaneously after export completes
- Bridge timeout fires on concurrent queries during an export operation
- Memory spike when `JSON.stringify()` runs on full card array

**Phase to address:** Phase 9 (Export Pipeline) — implement paginated export from day one. Do not export all cards in a single query.

**Severity:** MODERATE — UI freezes during export; no data loss


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
| String-interpolate source_id into SQL IN clause | Simpler DedupEngine code | SQL injection via imported file contents; dedup fails for IDs with quotes | Never — use json_each(?) parameter |
| Import all cards in one db.exec() string | One call, looks simple | Buffer overflow above ~3,700 rows; silent corruption | Never — use parameterized transaction batches |
| Leave FTS triggers enabled during bulk import | Triggers "just work" | 30-60s import time for 10K cards due to segment merges | Never — disable triggers, bulk-INSERT, then optimize |
| Import gray-matter as a static dependency | Simple package.json | Breaks browser/Worker build due to fs module dependency | Never in browser — use gray-matter-browser or inline parser |
| Static import of xlsx at module load | Simple parser initialization | Adds ~1MB to initial bundle even for users who never import Excel | Never — dynamic import on first use only |
| postMessage ArrayBuffer without transfer list | Simpler bridge code | Doubles memory consumption during large file imports | Never for ETL data — always use transferables |
| Export all cards in a single query | Simpler ExportOrchestrator | Blocks Worker for seconds; OOM for large datasets | Never for datasets >1K cards — paginate |
| Use string comparison for modified_at dates | Fast comparison | Timezone-aware ISO 8601 required; date-only strings fail | Never — normalize all timestamps to UTC before storing |

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
| DedupEngine + Markdown file paths | String-interpolating source_id values into SQL IN clause | Use json_each(?) to pass all source keys as a single JSON parameter |
| gray-matter + Vite/Worker | Static import fails due to fs module dependency | Use gray-matter-browser alias or inline frontmatter parser |
| xlsx + initial bundle | Static import adds ~1MB to startup | Dynamic import on first ExcelParser use; alias to xlsx.mini.min.js |
| WorkerBridge + large ArrayBuffer import | postMessage copies instead of transfers | Pass ArrayBuffer in the transferable list: postMessage(msg, [data]) |
| CSVParser + Excel-exported files | UTF-8 BOM not stripped — first column header corrupted | new TextDecoder('utf-8', { ignoreBOM: true }) or check charCodeAt(0) === 0xFEFF |
| AppleNotesParser + cross-batch links | Internal note link target_id not resolved for notes from previous imports | DedupEngine must query DB for existing source_id → card ID mappings for unresolved targets |
| FTS5 + bulk ETL import | Three-trigger overhead makes 10K-card import take 30-60s | Disable insert trigger during import, bulk INSERT...SELECT into FTS, call OPTIMIZE, restore trigger |
| HTMLParser + Worker thread | Parsing HTML on main thread risks script execution | All HTML parsing must run in Worker; use regex-based text extraction only, never innerHTML |
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
| FTS triggers enabled during bulk import | Triggers auto-maintain FTS | Segment merge overhead: 10K import takes 30-60s instead of 2s | Any import >1K cards |
| Full JSON.stringify on export | Simple serialization | 50MB+ string for 10K-card export; blocks Worker for 5-10s | Datasets >2K cards with content fields |
| SELECT * in export query | Simple query | Full content field serialized for all cards; 100MB+ postMessage | Any export of dataset with long content fields |
| db.exec() with multi-row VALUES string | Appears fast | Buffer overflow above ~3,700 rows; entire Worker session corrupted | Any batch exceeding ~3,700 concatenated rows |
| postMessage ArrayBuffer without transfer | Less code | Peak memory = 2× file size; OOM on 50MB+ imports | Files larger than ~30MB on constrained devices |
| Large import without chunk writes | Simpler code | Single transaction holds entire import in memory; OOM | Imports >2K cards with large content fields |

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
| DedupEngine string-interpolating source_id into SQL | SQL injection from imported file names or note IDs | Use json_each(?) parameter binding — never interpolate external strings into SQL |
| HTMLParser running on main thread (not Worker) | XSS execution from malicious script tags in imported HTML | All parsing in Worker context; strip <script> and <style> before storing content |
| Storing attachment Base64 data in SQLite content field | Attachment bytes bloat DB; binary data in text field; accidental credential leaks in exports | Strip attachment.data from AltoExport before parsing; store only filename/mime_type |

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
| No progress reporting during large import | Import appears frozen; user force-quits | Report progress via Worker→main postMessage every 500 cards; show progress bar |
| Duplicate cards after re-import | Users see doubled data; no explanation | DedupEngine must show toUpdate/toSkip counts in ImportResult; UI shows "N updated, N skipped" |
| Silent failure on import error | User thinks import succeeded | Every parse error must surface in ImportResult.errors; UI must display error count |
| All notes in single flat list after Apple Notes import | Folder structure lost | Preserve folder from AltoNote.folder; map to card.folder; show folder tree in filters |
| CSV import assigns "Row N" as title for all cards | All imported cards look identical | Auto-detect title column; fall back to first non-empty column; never silently default to "Row N" |

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
- [ ] **ETL Memory:** Import 5,000 synthetic cards — verify Worker does not OOM; chunk writes at 500 per transaction
- [ ] **DedupEngine SQL safety:** Import a Markdown file with `O'Brien's Note.md` as path — verify no SQL syntax error; dedup works correctly
- [ ] **CSV BOM handling:** Parse a BOM-prefixed CSV (0xEF 0xBB 0xBF at start) — verify first column header has no invisible prefix
- [ ] **gray-matter in Worker:** Run MarkdownParser in Worker test context (not Node.js) — verify frontmatter parsed correctly
- [ ] **xlsx dynamic import:** Load ExcelParser for first time — verify no xlsx code in initial bundle; dynamic chunk loads on use
- [ ] **FTS after bulk import:** After 10K-card import, run FTS integrity-check — verify no FTS desync; run OPTIMIZE and confirm
- [ ] **Cross-batch connections:** Import batch A (notes with links to batch B notes), import batch B — verify all inter-batch connections exist
- [ ] **Re-import idempotency:** Import same file twice — verify card count unchanged (toInsert=0, toUpdate=0 or only modified-at changes)
- [ ] **HTML XSS sanitization:** Import HTML file with `<script>alert(1)</script>` in content — verify script not stored or executed
- [ ] **Export pagination:** Export 5K cards — verify Worker does not block; all cards present in output; no bridge timeouts during export
- [ ] **ArrayBuffer transfer:** Verify main thread ArrayBuffer.byteLength === 0 after importFile() returns (confirms transfer, not copy)

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
| WASM OOM during large import | MEDIUM | Reduce chunk size to 100 cards; strip large content fields (Base64 attachments); free unused prepared statements before import |
| sql.js buffer overflow / memory corruption | HIGH | Restart Worker (terminate + new Worker()); re-import using parameterized batches only; never use multi-row VALUES strings |
| FTS desync after bulk import | MEDIUM | `INSERT INTO cards_fts(cards_fts) VALUES('rebuild')` rebuilds FTS from cards table; safe to run at any time |
| SQL injection in DedupEngine | CRITICAL | Replace string interpolation with json_each() pattern; audit all IN clauses in ETL code for string interpolation |
| gray-matter fs build failure | LOW | Add vite alias to gray-matter-browser; no data loss — parser not yet in use |
| Cross-batch connections dropped | MEDIUM | Re-run DedupEngine with cross-batch lookup enabled; connections from previous batches can be re-inserted |
| Timestamp comparison errors on re-import | LOW | Normalize all timestamps to UTC ISO 8601 in parsers; re-import will correct modified_at for affected cards |
| Export blocks Worker | LOW | Implement paginated export with yield between pages; existing exports must be aborted and restarted |

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
| WASM heap OOM on large import (Pitfall 22) | Phase 8: ETL Import Pipeline | Test: import 5K synthetic cards; Worker survives; chunk writes enforced |
| sql.js buffer overflow on large SQL string (Pitfall 23) | Phase 8: ETL Import Pipeline | Test: 1K-card import via parameterized transactions; Worker memory stable after |
| FTS trigger overhead on bulk import (Pitfall 24) | Phase 8: ETL Import Pipeline | Benchmark: 10K-card import completes in <5s; FTS integrity-check passes after |
| DedupEngine SQL injection via source_id (Pitfall 25) | Phase 8: ETL Import Pipeline (DedupEngine) | Test: import with source_id containing single quotes, semicolons; no SQL error |
| gray-matter fs dependency breaks Worker (Pitfall 26) | Phase 8: ETL Import Pipeline (MarkdownParser) | Test: MarkdownParser in Worker context; frontmatter parsed; no fs error |
| xlsx bundle size (Pitfall 27) | Phase 8: ETL Import Pipeline (ExcelParser) | Bundle analysis: xlsx not in initial chunk; loads on first ExcelParser use |
| CSV BOM corruption (Pitfall 28) | Phase 8: ETL Import Pipeline (CSVParser) | Test: BOM-prefixed fixture; first column header matches expected |
| HTML script injection (Pitfall 29) | Phase 8: ETL Import Pipeline (HTMLParser) | Test: HTML with script tag; content field contains no executable code |
| Cross-batch connection resolution (Pitfall 30) | Phase 8: ETL Import Pipeline (DedupEngine) | Test: two-batch import with cross-batch links; all connections present after both batches |
| Timestamp comparison on re-import (Pitfall 31) | Phase 8: ETL Import Pipeline (Parsers) | Test: re-import same file; toUpdate count is 0 unless modified_at genuinely changed |
| ArrayBuffer copy instead of transfer (Pitfall 32) | Phase 8: ETL Import Pipeline (WorkerBridge) | Test: verify main thread ArrayBuffer.byteLength === 0 after importFile() |
| Export blocks Worker (Pitfall 33) | Phase 9: Export Pipeline | Test: export 5K cards; concurrent bridge query resolves within 100ms during export |

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
- [sql.js Issue #482 — Buffer overflow in Database.run() with large INSERT strings](https://github.com/sql-js/sql.js/issues/482)
- [sql.js Issue #571 — Memory access out of bounds with large query strings (~1.5MB)](https://github.com/sql-js/sql.js/issues/571)
- [sql.js Issue #574 — Out of memory on page reload with large databases](https://github.com/sql-js/sql.js/issues/574)
- [Hacker News: sql.js memory management discussion](https://news.ycombinator.com/item?id=28157686)
- [SQLite FTS5 bulk insert optimization — sqlite-users mailing list](https://sqlite-users.sqlite.narkive.com/FsHtboS0/sqlite-properly-bulk-inserting-into-fts5-index-with-external-content-table)
- [Optimizing FTS5 External Content Tables — sqlite.work](https://sqlite.work/optimizing-fts5-external-content-tables-and-vacuum-interactions/)
- [SQLite FTS5 official docs — OPTIMIZE command, segment merging](https://sqlite.org/fts5.html)
- [SQLite Implementation Limits — SQLITE_MAX_VARIABLE_NUMBER (999 default, 32766 after 3.32.0)](https://sqlite.org/limits.html)
- [SheetJS Web Worker documentation — XLSX.writeFile restrictions, ESM support](https://docs.sheetjs.com/docs/demos/bigdata/worker/)
- [SheetJS Large Datasets documentation — streaming, memory considerations](https://docs.sheetjs.com/docs/demos/bigdata/stream/)
- [gray-matter Issue #49 — Browser compatibility, fs module dependency](https://github.com/jonschlinkert/gray-matter/issues/49)
- [gray-matter Issue #50 — fs module removal request](https://github.com/jonschlinkert/gray-matter/issues/50)
- [gray-matter-browser npm package — browser-safe fork](https://www.npmjs.com/package/gray-matter-browser)
- [MDN Transferable Objects — zero-copy ArrayBuffer transfer](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects)
- [Chrome Dev Blog: Transferable Objects — performance analysis](https://developer.chrome.com/blog/transferable-objects-lightning-fast)
- [CSV encoding and UTF-8 BOM issues — comprehensive guide](https://www.elysiate.com/blog/csv-encoding-problems-utf8-bom-character-issues)
- [TextDecoder ignoreBOM option — MDN](https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder/TextDecoder)
- [DOMPurify — cure53/DOMPurify GitHub (recommended XSS sanitizer)](https://github.com/cure53/DOMPurify)
- [Mutation XSS and DOMParser pitfalls — research.securitum.com](https://research.securitum.com/dompurify-bypass-using-mxss/)
- [MDN Date.parse() — browser inconsistencies with ISO 8601](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse)
- [Idempotent ETL pipelines — deduplication best practices](https://airbyte.com/data-engineering-resources/the-best-way-to-handle-data-deduplication-in-etl)
- [Isometry v5 Modules/DataExplorer.md — ETL pipeline spec](local)

---
*Pitfalls research for: local-first TypeScript/D3.js in-browser SQLite platform (WKWebView)*
*v0.1 Data Foundation pitfalls: Researched 2026-02-27*
*v1.0 Web Runtime pitfalls added: 2026-02-28*
*v1.1 ETL Importers pitfalls added: 2026-03-01*
