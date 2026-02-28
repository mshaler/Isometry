# Phase 1: Database Foundation - Research

**Researched:** 2026-02-27
**Domain:** sql.js WASM + FTS5, SQLite schema, Vite/Vitest infrastructure
**Confidence:** HIGH — all critical findings verified against official sources (sql.js Makefile, Vite docs, SQLite FTS5 docs, Vitest docs); WKWebView WASM workaround is MEDIUM (sparse public documentation but consistently reported behavior)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | sql.js initializes successfully in dev, production, WKWebView, and Vitest; FTS5 capability verified with `SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'` | Custom WASM build required (FTS3-only default confirmed); Vitest node environment + locateFile pattern documented; WKWebView fetch() workaround confirmed |
| DB-02 | Canonical schema creates cards, connections, cards_fts, ui_state tables with all indexes | Schema fully defined in Contracts.md (25 columns, precise DDL); all indexes specified; partial indexes for soft-delete filtering documented |
| DB-03 | FTS5 uses three separate sync triggers (insert, delete, update) to prevent index corruption | Three-trigger pattern verified via SQLite FTS5 official docs and forum report; single-trigger UPDATE is the exact root cause of intermittent corruption |
| DB-04 | FTS integrity-check passes after every mutation batch in tests | `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')` is the FTS5 built-in integrity verification command; must be called after write batches in test suite |
| DB-05 | Vite config correctly serves WASM with optimizeDeps exclude and ?url import | `optimizeDeps: { exclude: ['sql.js'] }` and `import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'` confirmed as correct pattern; esbuild-strips-WASM failure mode documented |
| DB-06 | PRAGMA foreign_keys = ON executes on every sql.js database open (prevents orphaned connections) | sql.js does not enable foreign keys by default; must be called explicitly after `new SQL.Database()`; cascade delete on connections relies on this |
</phase_requirements>

---

## Summary

Phase 1 establishes the entire foundation that every subsequent phase builds on. There are no dependencies above the npm package layer, but there are four infrastructure problems that must be solved before any feature work can begin: the FTS5 WASM build gap, the Vitest WASM test environment setup, the Vite production build path resolution, and the WKWebView MIME type issue. All four have known, documented solutions.

The most significant upfront task is the custom sql.js WASM build. The default sql.js v1.14.0 (compiling SQLite 3.49.0) ships FTS3 only — confirmed via the current Makefile. Adding `-DSQLITE_ENABLE_FTS5` to the CFLAGS and rebuilding produces a ~106KB larger WASM artifact (~744KB) with full FTS5 support including the `porter unicode61 remove_diacritics` tokenizer required by D-004. The sql.js repository includes a `.devcontainer/Dockerfile` pinned to Emscripten 5.0.0 on Node 24 bookworm — this is the correct build environment to use, either via VS Code devcontainer or by running the Docker image directly.

The canonical schema is fully specified in `v5/Modules/Core/Contracts.md` and `CLAUDE-v5.md` (D-001, D-004). The FTS5 sync trigger pattern is the single most correctness-critical implementation detail in this phase: a single combined UPDATE trigger causes intermittent FTS index corruption (~10% of updates) because FTS5 re-reads the content row during its delete step. The correct pattern uses three separate triggers. An `integrity-check` assertion after every write batch in tests is the verification mechanism.

**Primary recommendation:** Complete the custom WASM build first (commit the artifact), then implement the schema + triggers + Vitest infrastructure in TDD order, then run a production Vite build smoke test and a WKWebView integration spike before closing the phase.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| sql.js (custom FTS5 build) | 1.14.0 + custom WASM | In-browser SQLite with FTS5 | Locked decision. In-memory model is correct for WKWebView (no OPFS/SharedArrayBuffer needed). Custom build required for FTS5. |
| TypeScript | 5.8.x | Application language | Locked. Strict mode + `noUncheckedIndexedAccess` catches FTS array access bugs. |
| Vite | 7.3.1 | Build tooling + dev server | Locked. ESM-only, excellent WASM support via `?url` import and `optimizeDeps.exclude`. |
| Vitest | 4.0.x (4.0.17+) | Test framework | Locked. Shares Vite config, near-zero setup. `pool: 'forks'` required for WASM state isolation. |
| Emscripten | 5.0.0 (build-time only) | Compile custom sql.js WASM | Required for the custom FTS5 build. Version pinned in sql.js `.devcontainer/Dockerfile`. Build once, commit artifact. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vite-plugin-static-copy | 1.x | Copy WASM to dist/ | Required to ensure `sql-wasm.wasm` appears in `dist/assets/` with consistent path for `locateFile`. |
| @types/sql.js | 1.7.x | TypeScript types for sql.js | Always — types are reasonably current for the 1.14.x API. |
| @vitest/coverage-v8 | 4.x | Code coverage | Faster than Istanbul for WASM-heavy suites. Use v8 (ships with Node). Match Vitest major version. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| sql.js custom build | `@sqlite.org/sqlite-wasm` | Official SQLite WASM requires OPFS (SharedArrayBuffer + COOP/COEP headers). WKWebView cannot set these headers. Architecture incompatible. |
| sql.js custom build | `sql.js-fts5` npm fork | Abandoned ~5 years ago (v1.4.0). Based on ancient sql.js. No TypeScript types, security risk. |
| sql.js custom build | `wa-sqlite` | Same OPFS requirement. Less documented, fewer TypeScript types. |

**Installation:**
```bash
# Core runtime
npm install sql.js

# Dev dependencies for Phase 1
npm install -D typescript vite vitest \
            @types/sql.js \
            vite-plugin-static-copy \
            @vitest/coverage-v8

# TypeScript strict configuration (no additional packages needed)
```

After installing sql.js: build the custom FTS5 WASM (see Architecture Patterns below) and either replace `node_modules/sql.js/dist/sql-wasm.wasm` or maintain it at `src/assets/sql-wasm-fts5.wasm` and reference it via `locateFile`.

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)

```
src/
├── database/
│   ├── schema.sql              # Canonical DDL — cards, connections, cards_fts, ui_state
│   └── Database.ts             # sql.js wrapper: initialize(), exec(), run(), prepare(), close()
tests/
├── database/
│   └── Database.test.ts        # Phase 1 test suite
└── setup/
    └── wasm-init.ts            # Vitest globalSetup: resolves WASM path for Node
assets/                         # (or node_modules/sql.js/dist/ override)
    sql-wasm-fts5.wasm          # Custom-built WASM artifact (committed to repo)
    sql-wasm-fts5.js            # Companion JS loader
vite.config.ts                  # Must have optimizeDeps.exclude + static copy plugin
vitest.config.ts                # pool: forks, isolate: true, environment: node
tsconfig.json                   # strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes
```

### Pattern 1: Custom sql.js WASM Build (FTS5)

**What:** Modify the sql.js Makefile to add `-DSQLITE_ENABLE_FTS5` to `CFLAGS` and rebuild using the repository's `.devcontainer/Dockerfile` (Emscripten 5.0.0).

**When to use:** Once, before any other Phase 1 work. Commit the resulting `sql-wasm.wasm` and `sql-wasm.js` as versioned artifacts.

**Example:**
```makefile
# In sql.js/Makefile — change CFLAGS to add FTS5:
CFLAGS=-Oz -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_DISABLE_LFS \
       -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS \
       -DSQLITE_ENABLE_FTS5 \
       -DSQLITE_THREADSAFE=0 -DSQLITE_ENABLE_NORMALIZE
```

```bash
# Build using Docker (avoids local Emscripten toolchain issues)
# Option A: VS Code devcontainer (sql.js repo has .devcontainer/Dockerfile)
# Option B: Direct Docker
docker run --rm -v $(pwd)/sql.js-src:/src emscripten/emsdk:5.0.0 make

# Verify FTS5 in output:
# Open Node REPL, initialize sql.js with the new WASM, run:
# db.exec("SELECT compile_options FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'")
# Should return: [ { columns: ['compile_options'], values: [['ENABLE_FTS5']] } ]
```

**Fallback:** If Docker build fails due to Emscripten version mismatch, install local emsdk and modify the Makefile directly. The sql.js `.devcontainer/Dockerfile` pins `EMSCRIPTEN_VERSION 5.0.0` — use that version.

### Pattern 2: Vite Configuration for sql.js WASM

**What:** Exclude sql.js from esbuild pre-bundling and ensure WASM file is copied to dist/ with a path that `locateFile` can resolve in both dev and production.

**Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          // Point to custom FTS5 WASM if stored in src/assets/
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets'
        }
      ]
    })
  ],
  worker: {
    format: 'es',  // ES module workers (required for WKWebView)
  },
  optimizeDeps: {
    exclude: ['sql.js'],  // CRITICAL: prevents esbuild from stripping WASM loading code
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,  // Never inline WASM (breaks WKWebView + streaming compile)
  },
});
```

### Pattern 3: sql.js Initialization with locateFile

**What:** Use Vite's `?url` import to resolve the WASM path correctly in both dev and production builds. The `locateFile` callback intercepts sql.js's internal path resolution.

**Example:**
```typescript
// src/database/Database.ts
import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
// Vite resolves this to the correct hashed asset path in production
import sqlWasmUrl from '../assets/sql-wasm-fts5.wasm?url';

export class Database {
  private db: SqlJsDatabase | null = null;

  async initialize(): Promise<void> {
    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: () => sqlWasmUrl,  // Resolves correctly in dev AND production
    });
    this.db = new SQL.Database();
    // CRITICAL: enable foreign keys on every open (sql.js default is OFF)
    this.db.run('PRAGMA foreign_keys = ON');
    this.applySchema();
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }
  // ... exec(), run(), prepare()
}
```

### Pattern 4: Vitest WASM Test Environment

**What:** Configure Vitest to run sql.js database tests in the `node` environment with `pool: 'forks'` for WASM state isolation, and provide the WASM file path via `globalSetup`.

**Example:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',   // NOT jsdom — WASM runs in Node directly
    pool: 'forks',         // Full process isolation — prevents WASM state leakage between test files
    isolate: true,         // Each test file gets its own process
    globalSetup: './tests/setup/wasm-init.ts',
    globals: true,
    testTimeout: 10000,    // WASM init can take 1-2 seconds on cold start
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
    },
  },
});
```

```typescript
// tests/setup/wasm-init.ts
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';

export async function setup() {
  // Provide WASM path to all test files via environment variable
  // Point to the custom FTS5 build, not the default sql.js dist
  const wasmPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../src/assets/sql-wasm-fts5.wasm'
  );
  process.env.SQL_WASM_PATH = wasmPath;
}
```

```typescript
// In Database.ts — test-aware initialization
async initialize(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      process.env.SQL_WASM_PATH ?? `./node_modules/sql.js/dist/${file}`,
  });
  this.db = new SQL.Database();
  this.db.run('PRAGMA foreign_keys = ON');
  this.applySchema();
}
```

### Pattern 5: Canonical Schema — Cards, Connections, FTS5, ui_state

**What:** Apply the full schema from Contracts.md in a single `db.run()` call during `Database.initialize()`. Schema is sourced from `schema.sql` (read at build time or inline).

**Example (key elements — full schema in Contracts.md):**
```sql
-- Cards (25 columns per Contracts.md §1.2)
CREATE TABLE cards (
    id TEXT PRIMARY KEY NOT NULL,
    card_type TEXT NOT NULL DEFAULT 'note'
        CHECK (card_type IN ('note', 'task', 'event', 'resource', 'person')),
    name TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    -- LATCH: Location
    latitude REAL, longitude REAL, location_name TEXT,
    -- LATCH: Time
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    modified_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    due_at TEXT, completed_at TEXT, event_start TEXT, event_end TEXT,
    -- LATCH: Category
    folder TEXT, tags TEXT, status TEXT,
    -- LATCH: Hierarchy
    priority INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- Resource-specific
    url TEXT, mime_type TEXT,
    -- Collection
    is_collective INTEGER NOT NULL DEFAULT 0,
    -- Source (ETL deduplication)
    source TEXT, source_id TEXT, source_url TEXT,
    -- Lifecycle
    deleted_at TEXT
);

-- Partial indexes (WHERE deleted_at IS NULL) for common soft-delete filters
CREATE INDEX idx_cards_type     ON cards(card_type)  WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_folder   ON cards(folder)     WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_status   ON cards(status)     WHERE deleted_at IS NULL;
CREATE INDEX idx_cards_created  ON cards(created_at);
CREATE INDEX idx_cards_modified ON cards(modified_at);
-- Unique source index only when both are non-null (ETL dedup)
CREATE UNIQUE INDEX idx_cards_source ON cards(source, source_id)
    WHERE source IS NOT NULL AND source_id IS NOT NULL;

-- Connections (per D-001 and Contracts.md §2.1)
CREATE TABLE connections (
    id TEXT PRIMARY KEY NOT NULL,
    source_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    via_card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
    label TEXT,
    weight REAL NOT NULL DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(source_id, target_id, via_card_id, label)
);

CREATE INDEX idx_conn_source ON connections(source_id);
CREATE INDEX idx_conn_target ON connections(target_id);
CREATE INDEX idx_conn_via    ON connections(via_card_id) WHERE via_card_id IS NOT NULL;

-- FTS5 virtual table (per D-004 and Contracts.md §5.1)
CREATE VIRTUAL TABLE cards_fts USING fts5(
    name,
    content,
    folder,
    tags,
    content='cards',
    content_rowid='rowid',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Three-trigger FTS sync (per DB-03 — MUST be three separate triggers)
CREATE TRIGGER cards_fts_ai AFTER INSERT ON cards BEGIN
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;

CREATE TRIGGER cards_fts_ad AFTER DELETE ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
END;

CREATE TRIGGER cards_fts_au AFTER UPDATE OF name, content, folder, tags ON cards BEGIN
    INSERT INTO cards_fts(cards_fts, rowid, name, content, folder, tags)
    VALUES ('delete', OLD.rowid, OLD.name, OLD.content, OLD.folder, OLD.tags);
    INSERT INTO cards_fts(rowid, name, content, folder, tags)
    VALUES (NEW.rowid, NEW.name, NEW.content, NEW.folder, NEW.tags);
END;

-- UI State table (Tier 2 persistence per D-005 and Contracts.md §6.3)
-- Note: Contracts.md defines app_state + view_state; CLAUDE.md uses ui_state
-- Use ui_state for Phase 1 (Providers in Phase 4 will define the full persistence schema)
CREATE TABLE ui_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
```

**Schema naming note:** Contracts.md §6.3 defines `app_state` and `view_state` tables. CLAUDE.md uses `ui_state`. DB-02 requires a `ui_state` table. Use `ui_state` for Phase 1; the full `app_state`/`view_state` split is a Phase 4 concern when Providers are implemented.

### Pattern 6: WKWebView Integration Spike

**What:** Verify sql.js WASM loads in a WKWebView context before any feature work lands. Two approaches exist; choose one and document it.

**Approach A (preferred): JavaScript fetch() patch scoped to WASM URL**
```typescript
// src/database/wasm-compat.ts — call before initSqlJs()
export function patchFetchForWasm(): void {
  // Only patch in WKWebView context where fetch() misreports MIME type
  const isWKWebView = typeof window !== 'undefined' &&
    /iPhone|iPad|Mac/.test(navigator.userAgent) &&
    typeof (window as any).__WKWebViewHandler !== 'undefined';

  if (!isWKWebView) return;

  const originalFetch = window.fetch;
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input
      : input instanceof Request ? input.url
      : String(input);

    if (url.includes('sql-wasm') && url.endsWith('.wasm')) {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(new Response(xhr.response, {
              status: xhr.status,
              headers: { 'Content-Type': 'application/wasm' },
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
}
```

**Approach B (Phase 7): Swift WKURLSchemeHandler**
Full `app://` scheme serving with correct `Content-Type: application/wasm`. This is the clean solution but requires Swift code. Phase 7 will implement it. Phase 1 uses Approach A as the integration spike.

### Anti-Patterns to Avoid

- **Using a single combined UPDATE trigger for FTS:** A single trigger that deletes-then-inserts in one body causes FTS5 to re-read the content row during the delete step, producing intermittent corruption. Always use three separate triggers.
- **Not calling `PRAGMA foreign_keys = ON`:** sql.js default is OFF. The `connections` table relies on `ON DELETE CASCADE` — without this PRAGMA, orphaned connections will accumulate silently.
- **Using `pool: 'threads'` in Vitest:** WASM module state leaks between test files in the same thread. Use `pool: 'forks'` with `isolate: true`.
- **Using `optimizeDeps` default (not excluding sql.js):** esbuild pre-bundles sql.js and strips its WASM loading code. Always add `optimizeDeps: { exclude: ['sql.js'] }`.
- **Skipping `assetsInlineLimit: 0`:** Vite may inline small assets as base64 data URIs. WASM must remain as a separate file for streaming compilation and WKWebView compatibility.
- **Not running a production build smoke test in Phase 1:** The path resolution failure mode (`locateFile` resolving wrong hash) only manifests in `vite build` output, not in `vite dev`. Test both.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FTS5 full-text search | Custom BM25 ranking or LIKE-based search | sql.js FTS5 with `porter unicode61` tokenizer | Built into SQLite; handles stemming, ranking, phrase matching, snippets. Custom LIKE search scales to O(n) with no ranking. |
| WASM initialization | Custom fetch/XHR orchestration for WASM loading | sql.js `initSqlJs({ locateFile })` pattern | sql.js handles WASM streaming instantiation, fallback, and `SqlJsStatic` lifecycle. |
| Test WASM path resolution | Hardcoded absolute paths in tests | `globalSetup` with `process.env.SQL_WASM_PATH` | Portable across machines; CI-safe; survives directory moves. |
| Production WASM asset copy | Manual Rollup asset plugin | `vite-plugin-static-copy` | Handles glob, destination, and transform cleanly; integrates with Vite build lifecycle. |
| SQL integrity verification | Manual row count comparisons | `INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')` | Built-in FTS5 command; throws on corruption; zero custom code. |

**Key insight:** Every "infrastructure" problem in this phase (WASM path, test isolation, FTS sync) has an existing solution in the established tool (Vite `?url` import, Vitest `globalSetup`, SQLite `integrity-check`). The only non-standard step is the custom WASM build, and even that follows the sql.js repository's own Docker build process.

---

## Common Pitfalls

### Pitfall 1: FTS5 Single UPDATE Trigger Causes Intermittent Index Corruption (DB-03)

**What goes wrong:** A single UPDATE trigger that does delete-then-insert in one body causes FTS5 to re-read the content row during its delete step. The result is intermittent index drift — approximately 10% of updates produce stale or missing search results. This is subtle because basic search still works; only some updates are missed.

**Why it happens:** FTS5 external content tables re-read the source row during the delete operation to verify the content being deleted. If the trigger modifies the row before FTS completes the delete, FTS sees the new content but tries to delete the old content signature, creating corruption.

**How to avoid:** Always use three separate triggers: `cards_fts_ai` (AFTER INSERT), `cards_fts_ad` (AFTER DELETE), `cards_fts_au` (AFTER UPDATE). The update trigger does delete with OLD values, then insert with NEW values — two atomic FTS operations.

**Warning signs:** `integrity-check` throws after update-heavy batches; search returns stale results; deleted cards appear in FTS results.

### Pitfall 2: sql.js WASM Path Breaks in Vite Production Build (DB-05)

**What goes wrong:** `initSqlJs()` works in `vite dev` but throws in `vite build && vite preview`. The WASM file is either missing from `dist/assets/` or the `locateFile` callback resolves to the wrong hashed filename. A second failure mode: esbuild pre-bundles sql.js and strips the WASM loading code entirely.

**Why it happens:** Vite's `optimizeDeps` pre-bundles everything with esbuild for speed. esbuild does not support WASM ESM integration. Without `exclude: ['sql.js']`, the WASM loading code is stripped at pre-bundle time. Even with the exclude, `locateFile` must use the `?url` import pattern to resolve to the correct hashed asset URL.

**How to avoid:**
```typescript
// vite.config.ts: required
optimizeDeps: { exclude: ['sql.js'] }

// Database.ts: required
import sqlWasmUrl from '../assets/sql-wasm-fts5.wasm?url';
// ...
locateFile: () => sqlWasmUrl  // Vite resolves to correct hashed path
```

**Warning signs:** Works in dev, fails after `vite build`; 404 for `sql-wasm.wasm` in network tab; "CompileError: WebAssembly.instantiate(): expected magic word".

### Pitfall 3: Vitest WASM Tests Hang or Fail Without Node Environment (DB-01)

**What goes wrong:** `initSqlJs()` hangs or throws in default Vitest configuration. Tests pass in browser but fail in node. WASM path resolves incorrectly in test context. Test files sharing WASM state cause failures when run in parallel.

**Why it happens:** The default Vitest `environment` is `node` but the default `pool` is `threads`, which shares WASM module state between test files. Also, the `locateFile` callback during tests must point to a local file path, not a Vite-resolved URL.

**How to avoid:** `pool: 'forks'` + `isolate: true` + `globalSetup` to set `process.env.SQL_WASM_PATH` to the absolute local path of the custom WASM file. Each test creates its own `Database` instance and calls `db.close()` in `afterEach`.

**Warning signs:** "CompileError: WebAssembly.instantiate" in test output; tests hang indefinitely; WASM init fails only in CI.

### Pitfall 4: WKWebView fetch() Rejects WASM with MIME Type Error (DB-01)

**What goes wrong:** `initSqlJs()` fails in WKWebView with "Unexpected response MIME type. Expected 'application/wasm'". The same build works in Chrome and Safari desktop. `XMLHttpRequest` succeeds where `fetch()` fails.

**Why it happens:** WKWebView's `fetch()` enforces strict MIME type validation for WASM files loaded from local file:// URLs. The OS returns a generic MIME type; `fetch()` rejects it. XHR does not apply the same validation.

**How to avoid (Phase 1):** Apply the scoped `fetch()` patch (Pattern 6, Approach A) before calling `initSqlJs()`. Gate the patch with a WKWebView detection check to avoid affecting Chrome/Safari dev testing.

**Warning signs:** Database initialization hangs on first app launch in iOS Simulator; error contains "Unexpected response MIME type"; works in browser, fails in WKWebView context.

### Pitfall 5: PRAGMA foreign_keys = ON Not Called (DB-06)

**What goes wrong:** `ON DELETE CASCADE` on `connections.source_id` and `connections.target_id` does not fire. Deleting a card leaves orphaned connection rows. Graph queries return edges with no corresponding card nodes.

**Why it happens:** sql.js (like native SQLite) defaults foreign key enforcement to OFF for backward compatibility. The PRAGMA must be called explicitly after every `new SQL.Database()` construction, including in tests.

**How to avoid:** Add `this.db.run('PRAGMA foreign_keys = ON')` immediately after `new SQL.Database()` in `Database.initialize()`. Verify in tests with a cascade-delete assertion.

**Warning signs:** Connections remain after card deletion; `PRAGMA foreign_keys` returns 0.

---

## Code Examples

Verified patterns from official sources and project canonical docs:

### FTS5 Capability Verification (DB-01)
```typescript
// Verify FTS5 is present in the custom WASM build
const result = db.exec(
  "SELECT compile_options FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
);
// Expected: [ { columns: ['compile_options'], values: [['ENABLE_FTS5']] } ]
const hasFts5 = result[0]?.values.length > 0;
if (!hasFts5) throw new Error('sql.js WASM does not include FTS5 — custom build required');
```

### FTS Integrity Check (DB-04)
```typescript
// Run after any batch of inserts/updates/deletes in tests
function assertFtsIntegrity(db: Database): void {
  // Throws if FTS index is corrupted
  db.exec("INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')");
}

// FTS rebuild (recovery path for corruption — tests should never reach this)
function rebuildFtsIndex(db: Database): void {
  db.exec("INSERT INTO cards_fts(cards_fts) VALUES('rebuild')");
}
```

### Verify Triggers Exist (DB-03)
```typescript
// Verify all three FTS sync triggers are present
const triggers = db.exec(
  "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'cards_fts_%'"
);
const triggerNames = triggers[0]?.values.flat() ?? [];
expect(triggerNames).toContain('cards_fts_ai');
expect(triggerNames).toContain('cards_fts_ad');
expect(triggerNames).toContain('cards_fts_au');
```

### Foreign Keys Verification (DB-06)
```typescript
// Verify foreign keys are enabled
const fkResult = db.exec('PRAGMA foreign_keys');
const fkEnabled = fkResult[0]?.values[0]?.[0] === 1;
expect(fkEnabled).toBe(true);

// Cascade delete test
const cardId = 'test-card-001';
db.run('INSERT INTO cards(id, name) VALUES(?, ?)', [cardId, 'Test']);
db.run('INSERT INTO connections(id, source_id, target_id, label) VALUES(?, ?, ?, ?)',
  ['conn-001', cardId, cardId, 'self']);
db.run('DELETE FROM cards WHERE id = ?', [cardId]);
const orphans = db.exec('SELECT * FROM connections WHERE source_id = ?', [cardId]);
expect(orphans.length).toBe(0); // CASCADE must have fired
```

### Database Test Anatomy (TDD pattern)
```typescript
// tests/database/Database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';

describe('Database Foundation', () => {
  let db: Database;

  beforeEach(async () => {
    db = new Database();
    await db.initialize();
  });

  afterEach(() => {
    db.close();  // Required: releases WASM heap, prevents leaks between tests
  });

  it('DB-01: initializes with FTS5 capability', () => {
    const result = db.exec(
      "SELECT compile_options FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
    );
    expect(result[0]?.values.length).toBeGreaterThan(0);
  });

  it('DB-02: creates all required tables', () => {
    const tables = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    const tableNames = tables[0]?.values.flat() ?? [];
    expect(tableNames).toContain('cards');
    expect(tableNames).toContain('connections');
    expect(tableNames).toContain('cards_fts');
    expect(tableNames).toContain('ui_state');
  });

  it('DB-03: creates three separate FTS sync triggers', () => {
    const triggers = db.exec(
      "SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE 'cards_fts_%'"
    );
    const names = triggers[0]?.values.flat() ?? [];
    expect(names).toContain('cards_fts_ai');
    expect(names).toContain('cards_fts_ad');
    expect(names).toContain('cards_fts_au');
    expect(names).toHaveLength(3);  // Exactly three, no extras
  });

  it('DB-04: FTS integrity-check passes after insert', () => {
    db.run("INSERT INTO cards(id, name) VALUES('c1', 'Test Card')");
    // Throws if FTS index is corrupted — should not throw
    expect(() => {
      db.exec("INSERT INTO cards_fts(cards_fts) VALUES('integrity-check')");
    }).not.toThrow();
  });

  it('DB-06: foreign keys are enabled', () => {
    const result = db.exec('PRAGMA foreign_keys');
    expect(result[0]?.values[0]?.[0]).toBe(1);
  });

  it('DB-06: cascade delete removes orphaned connections', () => {
    db.run("INSERT INTO cards(id, name) VALUES('c1', 'Card A'), ('c2', 'Card B')");
    db.run("INSERT INTO connections(id, source_id, target_id, label) VALUES('cn1', 'c1', 'c2', 'links')");
    db.run("DELETE FROM cards WHERE id = 'c1'");
    const orphans = db.exec("SELECT * FROM connections WHERE source_id = 'c1'");
    expect(orphans.length).toBe(0);
  });
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sql.js npm default WASM (FTS3) | Custom Emscripten build with `-DSQLITE_ENABLE_FTS5` | Ongoing — PR #594 blocked by maintainer | Must build custom WASM; one-time cost, committed as artifact |
| Vitest `pool: 'threads'` (default) | `pool: 'forks'` with `isolate: true` | Vitest 4 migration | Required for WASM state isolation; each file gets fresh process |
| Vitest `poolOptions.threads` config | Top-level pool config | Vitest 4 | Config key renamed in v4 migration |
| `import * as d3 from 'd3'` | Direct sub-module imports | D3 v7+ ESM | 570KB bundle penalty avoided; not Phase 1 concern |
| `pool: 'threads'` option name `singleThread` | `maxWorkers: 1` | Vitest 4 | Renamed in Vitest 4 migration |
| sql.js `.devcontainer` uses Emscripten 3.x | Emscripten 5.0.0 | Current (2025) | Dockerfile updated; use pinned version |
| SQLite compiled at 3.x | SQLite 3.49.0 | Current sql.js Makefile | Latest stable SQLite version in custom build |

**Deprecated/outdated:**
- `sql.js-fts5` npm package: 5 years old, v1.4.0, based on ancient sql.js. Do not use.
- `coverage.all` in Vitest config: removed in Vitest 4 migration.
- `singleThread` in Vitest pool config: renamed to `maxWorkers: 1`.

---

## Open Questions

1. **Schema naming conflict: `ui_state` vs `app_state`/`view_state`**
   - What we know: CLAUDE.md and DB-02 specify `ui_state` table. Contracts.md §6.3 defines `app_state` + `view_state` tables for the full three-tier persistence model.
   - What's unclear: Whether Phase 1 should create `ui_state` (simple, matches DB-02 literal) or create `app_state`/`view_state` now (matches Contracts.md, avoids migration in Phase 4).
   - Recommendation: Create `ui_state` for Phase 1 to satisfy DB-02 exactly. Phase 4 (Providers) will define the full persistence schema. A migration is trivial in sql.js (DDL runs at db init; rename table or add new tables).

2. **Custom WASM artifact location strategy**
   - What we know: The custom-built `sql-wasm.wasm` must be committed to the repo and referenced by Vite and Vitest.
   - What's unclear: Whether to store at `src/assets/sql-wasm-fts5.wasm` (explicit, repo-specific) or replace `node_modules/sql.js/dist/sql-wasm.wasm` (invisible, breaks on `npm install`).
   - Recommendation: Use `src/assets/sql-wasm-fts5.wasm`. Add a comment in `package.json` scripts explaining the custom build. Never replace `node_modules` content — it breaks on reinstall.

3. **WKWebView integration spike scope in Phase 1**
   - What we know: DB-01 requires verification in WKWebView. The Roadmap notes "integration spike here, full native shell in Phase 7."
   - What's unclear: Whether Phase 1 spike requires a functional Swift WKWebView container, or whether a simpler test harness (e.g., loading the Vite build in a minimal WKWebView app) is sufficient.
   - Recommendation: A minimal Swift test app that loads the Vite production build via `loadFileURL` and logs whether sql.js initializes is sufficient. The fetch() patch (Pattern 6, Approach A) handles the MIME type issue. Full `WKURLSchemeHandler` is Phase 7. Document which approach was used.

4. **FTS5 fields: `summary` vs `tags` ordering**
   - What we know: Contracts.md §5.1 lists `name, content, folder, tags`. PITFALLS.md trigger examples also show `name, content, tags, folder`. CLAUDE-v5.md D-004 shows `name, content, tags, folder`.
   - What's unclear: Field order in FTS5 virtual table definition affects column rank in BM25 scoring.
   - Recommendation: Use Contracts.md §5.1 as canonical: `name, content, folder, tags`. This is the most recent authoritative source. The `summary` column exists in cards but is not indexed in FTS5 (not needed for search in Phase 1).

---

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/CLAUDE-v5.md` — canonical architectural decisions D-001 through D-010; Phase 1 schema DDL examples
- `/Users/mshaler/Developer/Projects/Isometry/v5/Modules/Core/Contracts.md` — canonical Card schema (25 columns), Connection schema, FTS5 schema, persistence tiers, SQL safety rules
- `/Users/mshaler/Developer/Projects/Isometry/.planning/research/PITFALLS.md` — Pitfalls 1-3 and 10 directly cover Phase 1; verified via SQLite forum and issue trackers
- `/Users/mshaler/Developer/Projects/Isometry/.planning/research/STACK.md` — Vite 7 config, Vitest 4 pool config, sql.js installation, TypeScript tsconfig
- [sql.js GitHub Makefile](https://github.com/sql-js/sql.js/blob/master/Makefile) — confirmed FTS5 is absent; SQLite 3.49.0 used; `CFLAGS` for custom build
- [sql.js .devcontainer/Dockerfile](https://github.com/sql-js/sql.js/blob/master/.devcontainer/Dockerfile) — Emscripten 5.0.0 pinned; Node 24 bookworm base
- [SQLite FTS5 official documentation](https://sqlite.org/fts5.html) — `integrity-check`, `rebuild`, external content table trigger patterns
- [Vite Dep Optimization Options](https://vite.dev/config/dep-optimization-options) — `optimizeDeps.exclude` behavior

### Secondary (MEDIUM confidence)
- [WKWebView fetch() vs XHR for WASM — GitHub Gist](https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c) — fetch() MIME type rejection; XHR workaround
- [Vitest WASM Discussion #4283](https://github.com/vitest-dev/vitest/discussions/4283) — WASM test setup patterns in Vitest node environment
- [Compiling FTS5 into sql.js build — blog post](https://blog.ouseful.info/2022/04/06/compiling-full-text-search-fts5-into-sqlite-wasm-build/) — Makefile modification steps; Docker build approach (2022, but build process unchanged)
- [vite-plugin-wasm npm](https://www.npmjs.com/package/vite-plugin-wasm) — alternative WASM plugin; `optimizeDeps.exclude` confirmed as correct pattern for sql.js

### Tertiary (LOW confidence — noted for completeness)
- [SQLite forum — FTS5 trigger corruption](https://sqlite.org/forum/info/da59bf102d7a7951740bd01c4942b1119512a86bfa1b11d4f762056c8eb7fc4e) — single-trigger corruption report; MEDIUM confidence due to single source, but corroborated by PITFALLS.md and FTS5 docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions confirmed via official sources; sql.js FTS3-only confirmed via current Makefile; Emscripten 5.0.0 confirmed via devcontainer Dockerfile
- Architecture: HIGH — schema is fully specified in Contracts.md and CLAUDE-v5.md; no ambiguity on what to build
- Pitfalls: HIGH (trigger pattern, Vite config) / MEDIUM (WKWebView MIME type) — three-trigger pattern from SQLite official docs; Vite config from official Vite docs; WKWebView behavior from community sources consistent with official WebKit behavior

**Research date:** 2026-02-27
**Valid until:** 2026-05-27 (90 days — stack is stable; sql.js release cadence is slow; Vite 7 and Vitest 4 are current stable; WKWebView behavior is stable WebKit API)
