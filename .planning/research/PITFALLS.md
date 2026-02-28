# Pitfalls Research

**Domain:** Local-first TypeScript/D3.js in-browser SQLite data projection platform (WKWebView)
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH — most pitfalls verified via official docs, GitHub issues, and SQLite forum discussions; WKWebView-specific findings are MEDIUM due to sparse public documentation

---

## Critical Pitfalls

### Pitfall 1: WKWebView `fetch()` Rejects WASM with Wrong MIME Type

**What goes wrong:**
`initSqlJs()` internally calls `fetch()` to load `sql-wasm.wasm`. WKWebView's `fetch()` implementation enforces strict MIME type validation on local files, rejecting anything without `Content-Type: application/wasm`. The error appears as: `"Unexpected response MIME type. Expected 'application/wasm'"`. The app crashes silently or stalls at database initialization. `XMLHttpRequest` on the same file succeeds — only `fetch()` fails.

**Why it happens:**
WebKit's fetch() implementation validates MIME types more aggressively than XMLHttpRequest for local file:// URLs. When serving from a Vite-built bundle loaded into WKWebView via `loadFileURL`, there is no HTTP server to set `Content-Type` headers — the OS returns a generic MIME type for `.wasm` files.

**How to avoid:**
Patch `fetch()` before calling `initSqlJs()`. Override the global `fetch` with a wrapper that detects `.wasm` URL requests, falls back to `XMLHttpRequest` as an `arraybuffer`, wraps in a `Response`, and injects `Content-Type: application/wasm`. This must happen before any sql.js initialization. Alternatively, have the Swift WKWebView handler inject correct MIME types via `WKURLSchemeHandler`.

```typescript
// Patch fetch for WKWebView WASM loading — do this before initSqlJs()
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
  if (url.endsWith('.wasm')) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'arraybuffer';
      xhr.onload = () => resolve(new Response(xhr.response, {
        headers: { 'Content-Type': 'application/wasm' }
      }));
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

### Pitfall 2: FTS5 Update Trigger Causes Silent Index Corruption

**What goes wrong:**
FTS5 content table synchronization breaks when UPDATE triggers are ordered incorrectly. The FTS5 index becomes out-of-sync with the content table: search results disappear, duplicate tokens accumulate, or `PRAGMA integrity_check` reports corruption. The failure is intermittent — around 10% of updates corrupt the index depending on query timing.

**Why it happens:**
FTS5 processes an UPDATE by first fetching the *current* row from the content table to know which tokens to remove from the index. If the UPDATE trigger fires *after* the content row has already been written with new values, FTS5 fetches the *new* values instead of the old ones. It removes the wrong tokens, leaving old tokens in the index and creating ghost search results.

The broken pattern (AFTER UPDATE fetches already-changed row):
```sql
-- WRONG: FTS5 sees new.content when it should see old.content for the delete step
CREATE TRIGGER cards_fts_update AFTER UPDATE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, tags, folder)
    VALUES('delete', OLD.rowid, OLD.name, OLD.content, OLD.tags, OLD.folder);
    INSERT INTO cards_fts(rowid, name, content, tags, folder)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.tags, NEW.folder);
END;
```

The documented pattern that causes intermittent corruption: the FTS5 virtual table internally re-reads the content table row on the delete step, overriding the OLD.* values you provided — if the row has already changed, you get wrong tokens.

**How to avoid:**
Use the exact three-trigger pattern from SQLite official docs. The UPDATE trigger must issue two separate FTS5 operations: a `'delete'` with OLD values, then an insert with NEW values. Keep content synchronized with `content=` and `content_rowid=` directives. Additionally, use `rowid` not `id` for the FTS join — the spec's D-004 decision already mandates this.

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

Run `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')` in tests after every mutation to catch desync early.

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

**Phase to address:** Phase 4 (Worker Bridge) — persistence export must be wired to native shell lifecycle events before any ETL import feature ships. Importing 10K Apple Notes without a save path is a guaranteed data-loss scenario.

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

The CLAUDE-v5.md spec already documents this as a "WRONG" pattern. However, it's the default when developers copy D3 examples which frequently omit key functions.

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

### Pitfall 7: D3 SVG Performance Wall at ~500-1000 Visible Elements

**What goes wrong:**
SVG is not GPU-accelerated. At 500+ simultaneously rendered SVG elements with active transitions, frame rate drops below 60fps. At 1000+ elements, transitions become visually broken. The SuperGrid with density controls could easily reach this threshold when showing all cards at low density.

**How to avoid:**
- Implement density controls (DensityProvider) with strict upper bounds on visible elements. The spec's `LIMIT` pagination is the right mechanism — enforce it.
- Separate the force simulation tick loop from the DOM update loop for the network view: run simulation in the Worker, post final positions to the main thread only when stable, render once.
- Use CSS transforms (`translate(x,y)`) for positioning rather than SVG `x`/`y` attributes where possible — CSS transforms are composited by the GPU.
- Use `opacity` only on groups, not individual path elements (per-path opacity triggers expensive compositing).
- Do not transition all 1000 visible elements simultaneously — stagger or skip transitions above a threshold count.

The spec's performance threshold of `<16ms render` for 100 visible cards is achievable. For the network view with 1000 nodes, this requires the force simulation to run in the Worker and only push stable coordinates.

**Warning signs:**
- `requestAnimationFrame` callbacks taking >16ms as card count grows
- Chrome DevTools shows long paint times (>8ms) on layout changes
- Transition end events never fire because new transitions interrupt old ones

**Phase to address:** Phase 5 (Views) — performance budgets must be measured per-view during implementation, not as a post-build optimization pass.

---

### Pitfall 8: Web Worker postMessage Serialization Kills Throughput

**What goes wrong:**
Every `postMessage()` call runs the Structured Clone Algorithm on the payload. For query results with hundreds of card objects, this serialization adds significant latency. The naïve pattern of posting a full card array on every filter change turns the Worker bridge into a bottleneck, especially if providers trigger frequent re-queries.

A subtler failure: Transferable objects (`ArrayBuffer`) are zero-copy for single transfers but Chrome/Edge show exponential slowdown when transferring many small Transferable objects — making Transferables counterproductive for arrays of individual card buffers.

**How to avoid:**
- Keep query result payloads as lean as possible. Return arrays of plain objects with only the fields the current view needs, not full card objects with all columns.
- For the D3 views, the rendering code needs `id`, `name`, and a handful of PAFV axis values — not the full `content` text field. Project in SQL: `SELECT id, name, status, priority FROM cards WHERE...`
- Never post large blobs (full card content) across the bridge for rendering purposes. Content is fetched on demand (detail view), not in list queries.
- Batch mutations before posting: the `MutationManager` should queue mutations and post once, not once per field change.

**Warning signs:**
- Bridge response times growing proportionally with dataset size even for simple filters
- Profiler shows significant time in structured clone serialization
- Memory spikes on filter changes (both sides of bridge hold the array in memory simultaneously)

**Phase to address:** Phase 4 (Worker Bridge) — establish the minimal projection pattern for query results before any view consumes bridge data. Retrofit is painful.

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

A second failure mode: using `environment: 'jsdom'` to simulate a browser does not help — jsdom does not implement WebAssembly at all; it is a DOM-only emulator.

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

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **FTS5 Search:** Passes basic search tests — verify `integrity-check` after UPDATE and DELETE operations; check that soft-deleted cards do not appear in results
- [ ] **Worker Bridge:** Messages round-trip correctly — verify that unmatched response IDs are handled gracefully (promise never resolves vs. error); verify Worker `onerror` propagates to bridge
- [ ] **Vite Build:** Runs in dev — verify production build places `.wasm` asset correctly, `locateFile` resolves it, and WKWebView loads it
- [ ] **D3 Data Joins:** Renders correctly on first load — verify that filter changes do not destroy and recreate DOM nodes (watch exit selection size)
- [ ] **sql.js Persistence:** Database initializes — verify that backgrounding the app triggers `db.export()` and the exported bytes reach the Swift layer
- [ ] **FTS5 Triggers:** Schema applies — verify triggers exist with `SELECT name FROM sqlite_master WHERE type='trigger'` in tests
- [ ] **TypeScript:** Compiles — verify no `@ts-ignore` or `as any` in view code; `tsc --noEmit --strict` must pass
- [ ] **Provider SQL compilation:** Filters produce correct WHERE clauses — verify injection attempts in values are parameterized (value appears in params array, not in SQL string)
- [ ] **Memory:** Tests pass — run a long-session test (1000 queries) and verify Worker heap is not growing

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

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WKWebView WASM MIME type (Pitfall 1) | Phase 1: Database Foundation | WKWebView integration test: `initSqlJs()` succeeds in iOS simulator |
| FTS5 trigger corruption (Pitfall 2) | Phase 1: Database Foundation | `integrity-check` test after 100 random CUD operations passes |
| Vite WASM path in production (Pitfall 3) | Phase 1: Database Foundation | `vite build` + smoke test with production bundle; WASM file present in `dist/assets/` |
| In-memory data loss (Pitfall 4) | Phase 4: Worker Bridge | Native shell lifecycle test: background app, verify export received by Swift |
| Prepared statement leaks (Pitfall 5) | Phase 2: CRUD + Queries | Long-session test: 1000 queries, Worker heap stable |
| D3 key function missing (Pitfall 6) | Phase 5: Views | Code review checklist; lint rule if feasible |
| SVG performance wall (Pitfall 7) | Phase 5: Views | Performance test: 500 cards render at ≥60fps; 100 cards with transitions |
| Worker bridge serialization (Pitfall 8) | Phase 4: Worker Bridge | Bridge latency test: filter query on 10K cards returns in <100ms |
| TypeScript D3 type friction (Pitfall 9) | Phase 5: Views | `tsc --noEmit --strict` passes with zero `as any` in view code |
| Vitest WASM test setup (Pitfall 10) | Phase 1: Database Foundation | `npm run test` succeeds on a clean clone with `node` environment |

---

## Sources

- [sql.js GitHub README — initialization, locateFile, statement.free()](https://github.com/sql-js/sql.js/blob/master/README.md)
- [sql.js Issue #521 — WASM file not loading correctly in web workers](https://github.com/sql-js/sql.js/issues/521)
- [sql.js Issue #393 — WASM MIME type error](https://github.com/sql-js/sql.js/issues/393)
- [WKWebView fetch() vs XHR for local WASM — GitHub Gist](https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c)
- [SQLite FTS5 official docs — external content tables and trigger patterns](https://sqlite.org/fts5.html)
- [SQLite forum — Corrupt FTS5 table after declaring triggers a certain way](https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e)
- [Vite Features — WASM, optimizeDeps, worker configuration](https://vite.dev/guide/features)
- [vite-plugin-wasm — npm](https://www.npmjs.com/package/vite-plugin-wasm)
- [Vitest Environment docs — node vs jsdom vs happy-dom](https://vitest.dev/guide/environment)
- [Vitest Discussion #4283 — Issues Loading and Testing WASM Modules](https://github.com/vitest-dev/vitest/discussions/4283)
- [D3 data joins — d3js.org](https://d3js.org/d3-selection/joining)
- [D3 TypeScript Issue #3459 — Selection type assignability](https://github.com/d3/d3/issues/3459)
- [DefinitelyTyped d3-selection index.d.ts](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/d3-selection/index.d.ts)
- [D3 SVG performance — Scott Logic: Rendering One Million Datapoints](https://blog.scottlogic.com/2020/05/01/rendering-one-million-points-with-d3.html)
- [Web Worker postMessage performance — Nolan Lawson](https://nolanlawson.com/2016/02/29/high-performance-web-worker-messages/)
- [sql.js Wiki — Persisting a Modified Database](https://github.com/sql-js/sql.js/wiki/Persisting-a-Modified-Database)

---
*Pitfalls research for: local-first TypeScript/D3.js in-browser SQLite platform (WKWebView)*
*Researched: 2026-02-27*
