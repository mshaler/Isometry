# Stack Research

**Domain:** Local-first polymorphic data projection platform (TypeScript/D3.js, WKWebView shell)
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH (all versions verified via official sources; WKWebView WASM gotchas verified via issue trackers; FTS5 gap is a HIGH-confidence finding with significant implementation impact)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| TypeScript | 5.8.x | Type-safe application language | Latest stable (released Feb 28, 2025). The go-based TS7 rewrite is in preview only — stick with 5.8 for stability. Strict mode + additional flags catch runtime bugs at compile time. | HIGH |
| sql.js (custom FTS5 build) | 1.14.0 + custom WASM | In-browser SQLite for local-first data layer | The stack decision is locked (sql.js). However: v1.14 ships with FTS3 only, not FTS5. A custom build is REQUIRED. See FTS5 section below. | HIGH |
| D3.js | 7.9.0 | Data visualization and DOM data joins | v7.9.0 is current (no v8 as of Feb 2026). D3's `.data().join()` pattern eliminates parallel state — aligns perfectly with the no-Redux architecture. | HIGH |
| Vite | 7.3.1 | Build tooling, dev server, WASM bundling | Latest stable. ESM-only distribution, excellent WASM support via `?init` query or `vite-plugin-wasm`. Node 20.19+ required. Vite 8 (Rolldown) is beta only — avoid. | HIGH |
| Vitest | 4.0.x (4.0.17+) | Unit and integration testing | Same config as Vite, near-zero config for TypeScript projects. Pool rewrite in v4 removes external dependencies. Browser mode now stable but not needed here — use `pool: 'forks'` for isolation. | HIGH |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `@types/d3` | 7.4.3 | TypeScript type definitions for D3 | Always. Note: last updated ~2 years ago. Sub-module `@types/d3-*` packages are more current — prefer sub-module imports to avoid stale umbrella types. | MEDIUM |
| `vite-plugin-wasm` | 3.x | Enable WASM ESM integration in Vite | Required for WebAssembly imports via ESM (wasm-pack style). Not needed if using `?init` query approach with locateFile pattern for sql.js. | MEDIUM |
| `vite-plugin-top-level-await` | 1.x | Enable top-level await in bundled code | Pair with `vite-plugin-wasm` if needed. Required for WASM modules that use async initialization at module level. | MEDIUM |
| `vite-plugin-static-copy` | 1.x | Copy WASM assets to dist | Use to ensure `sql-wasm.wasm` is copied to `dist/` at the correct path so `locateFile` can resolve it in production. | MEDIUM |
| `typescript-eslint` | 8.x | TypeScript-aware linting | Use `strict-type-checked` config for maximum correctness. Flat config (ESLint v9 style) is now standard. | MEDIUM |
| `@vitest/coverage-v8` | 4.x | Code coverage | Use v8 coverage (ships with Node). Significantly faster than Istanbul for WASM-heavy test suites. | MEDIUM |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| ESLint 9.x | Code linting | Use flat config format (`eslint.config.ts`). `tseslint.configs.strictTypeChecked` catches category of bugs that strict tsconfig misses. | MEDIUM |
| Prettier | Code formatting | Pin version. Avoids style debates. Configure in `eslint.config.ts` via `eslint-config-prettier` to disable conflicting ESLint rules. | MEDIUM |
| Emscripten (build-time only) | Compile custom sql.js WASM with FTS5 | Required ONLY for the custom sql.js FTS5 build. Use Docker image `emscripten/emsdk` to avoid local toolchain issues. Build once, commit the WASM artifact. | HIGH |

---

## CRITICAL: sql.js and FTS5

### The Problem

**sql.js v1.14.0 ships with FTS3, not FTS5.** This is confirmed via the Makefile:

```
CFLAGS=-Oz -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_DISABLE_LFS
       -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS
```

The PR to enable FTS5 by default (#594, opened Sep 2024) is blocked by the maintainer: "I'd rather not increase the default asset size for all existing users." It will not ship in v1.14 or likely v1.15.

The architectural decision (D-004) requires FTS5 with `porter unicode61 remove_diacritics` tokenizer. **This is not available in the default sql.js build.**

### Options

**Option A: Custom Build (RECOMMENDED)**

Modify the sql.js Makefile to add `-DSQLITE_ENABLE_FTS5` and rebuild with Emscripten. Commit the resulting `sql-wasm.wasm` and `sql-wasm.js` to the repo as a versioned artifact.

```makefile
# In sql.js/Makefile, change:
CFLAGS=-Oz -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_DISABLE_LFS \
       -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS

# To:
CFLAGS=-Oz -DSQLITE_OMIT_LOAD_EXTENSION -DSQLITE_DISABLE_LFS \
       -DSQLITE_ENABLE_FTS3 -DSQLITE_ENABLE_FTS3_PARENTHESIS \
       -DSQLITE_ENABLE_FTS5
```

Build via Docker:
```bash
docker run --rm -v $(pwd):/src emscripten/emsdk make
```

The resulting WASM is ~106KB larger (638K → 744K) — acceptable for a local-first desktop app.

**Option B: `sql.js-fts5` npm fork**

The `sql.js-fts5` package (last published ~5 years ago, v1.4.0) is effectively abandoned. Do NOT use this approach.

**Rationale for Option A:** The project already accepts sql.js as a locked decision. A custom build preserves the full sql.js API contract (sql.js TypeScript types, initialization pattern, worker protocol). The custom WASM is a one-time build artifact that can be version-pinned.

---

## WKWebView WASM Configuration

### The Problem

WKWebView has a known bug: when fetching `.wasm` files from the local filesystem (or custom URL scheme) using the `fetch()` API, it returns:

```
Unexpected response MIME type. Expected 'application/wasm'
```

`XMLHttpRequest` succeeds where `fetch()` fails. This breaks `WebAssembly.instantiateStreaming()`.

### The Workaround

The Swift shell must implement a `WKURLSchemeHandler` to serve the application via a custom `app://` scheme (not `file://`), ensuring proper MIME type headers. Additionally, sql.js must be initialized with a custom `locateFile` that avoids `fetch()`-based WASM loading.

**Swift side — serve app via custom scheme:**

```swift
// Register custom scheme in WKWebViewConfiguration
let config = WKWebViewConfiguration()
config.setURLSchemeHandler(AppSchemeHandler(), forURLScheme: "app")
```

**JavaScript side — initialize sql.js with explicit WASM URL:**

```typescript
import sqlWasmUrl from './sql-wasm.wasm?url'; // Vite ?url import

const SQL = await initSqlJs({
    locateFile: () => sqlWasmUrl
});
```

**Why this works:** Vite's `?url` import returns the asset URL as a string (resolving to the correct path in both dev and prod). The custom scheme handler in Swift can serve the WASM with `Content-Type: application/wasm`, bypassing the MIME type issue.

### OPFS / SharedArrayBuffer: Do NOT Use

The official SQLite WASM build and wa-sqlite (alternatives to sql.js) both rely on OPFS (Origin Private File System) for persistence. **OPFS is NOT reliably supported in WKWebView on iOS/macOS.** SharedArrayBuffer requires `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` headers that cannot be set in WKWebView's local file context.

sql.js's in-memory model is actually the correct architecture here: the database is exported/imported as a binary blob via the WorkerBridge when the native shell triggers CloudKit sync (D-010). No OPFS needed.

---

## TypeScript Strict Mode Configuration

### Recommended `tsconfig.json`

TypeScript 5.8 is current (released Feb 28, 2025). Use strict mode plus the additional flags that TypeScript's `--init` now recommends for new projects:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": false,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "outDir": "dist",
    "rootDir": "src",
    "sourceMap": true,
    "declaration": true
  },
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**What `strict: true` enables** (verified via TypeScript docs):
- `noImplicitAny`
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitThis`
- `alwaysStrict`
- `strictBuiltinIteratorReturn`
- `useUnknownInCatchVariables`

**Additional flags rationale:**
- `noUncheckedIndexedAccess`: Forces handling of `arr[i]` being potentially `undefined`. Catches FTS result array access bugs.
- `exactOptionalPropertyTypes`: Prevents setting optional properties to `undefined` explicitly — catches D3 datum type bugs.
- `verbatimModuleSyntax`: Required for proper type-only import handling with Vite's ESM bundling.
- `moduleResolution: "bundler"`: Correct setting for Vite-based projects (not `node` or `node16`).

---

## D3.js v7 Module Imports

### Tree-Shakeable Import Pattern

D3 v7.9.0 is fully ESM with sub-package structure. Import from sub-modules, not the umbrella `d3` package, for optimal tree-shaking:

```typescript
// CORRECT: Sub-module imports (tree-shakeable)
import { select, selectAll, Selection } from 'd3-selection';
import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force';
import { scaleLinear, scaleBand, scaleOrdinal } from 'd3-scale';
import { axisBottom, axisLeft } from 'd3-axis';
import { hierarchy, tree, cluster } from 'd3-hierarchy';
import { zoom, ZoomBehavior } from 'd3-zoom';
import { drag } from 'd3-drag';
import { transition } from 'd3-transition';
import { timeFormat, timeParse } from 'd3-time-format';
import { extent, max, min, group, rollup } from 'd3-array';

// AVOID: Umbrella import (pulls entire D3 bundle, ~570KB minified)
import * as d3 from 'd3';
```

### TypeScript Types Quality Assessment

`@types/d3` v7.4.3 is the umbrella type package — **last published ~2 years ago**. Key findings:

- Sub-module `@types/d3-*` packages are updated independently and more current
- The umbrella `@types/d3` re-exports sub-module types, but may lag behind sub-module updates
- Known issue: `@types/d3-dsv` disagrees with `d3-dsv` exports — use explicit sub-module types
- Recommendation: Install `@types/d3` for convenience but `skipLibCheck: false` will surface any type mismatches early

**Mitigation:** Since this project does not use `d3-dsv`, the known conflict does not apply. The sub-modules used (selection, force, scale, hierarchy, zoom) have stable, accurate types.

### D3 Data Join Pattern (Required)

Per the architectural constraints, D3's data join IS state management. Always use key functions:

```typescript
// The canonical pattern for all views
const cards = svg.selectAll<SVGGElement, Card>('.card')
    .data(data, (d: Card) => d.id)  // Key function required
    .join(
        enter => enter.append('g').attr('class', 'card').call(initCard),
        update => update.call(updateCard),
        exit => exit.transition().duration(200).style('opacity', 0).remove()
    );
```

---

## Vite Configuration for WASM + Web Worker

### Complete `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
    // Copy sql.js WASM to dist/assets so locateFile can resolve it
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: 'node_modules/sql.js/dist/sql-wasm.wasm',
                    dest: 'assets'
                }
            ]
        })
    ],

    // Worker bundle configuration
    worker: {
        format: 'es',  // ES module workers (supported by WKWebView)
        rollupOptions: {
            // Note: renamed from rollupOptions in Vite 7
        }
    },

    // Optimize dependencies - exclude sql.js from pre-bundling
    optimizeDeps: {
        exclude: ['sql.js']
    },

    build: {
        target: 'es2022',  // Aligns with TypeScript target
        // WASM files larger than this threshold are kept as separate assets
        assetsInlineLimit: 0  // Never inline WASM (size + WKWebView compat)
    },

    server: {
        headers: {
            // Required for SharedArrayBuffer (NOT needed for sql.js in-memory model)
            // Only set if you later adopt OPFS-based storage
            // 'Cross-Origin-Opener-Policy': 'same-origin',
            // 'Cross-Origin-Embedder-Policy': 'require-corp',
        }
    }
});
```

### Worker Import Pattern

Per the architectural spec (D-002), all database operations run in a Web Worker. Use Vite's standard constructor pattern:

```typescript
// WorkerBridge.ts — main thread
const worker = new Worker(
    new URL('./worker/worker.ts', import.meta.url),
    { type: 'module' }
);
```

```typescript
// worker/worker.ts — inside the worker
import initSqlJs from 'sql.js';

// WASM locateFile: resolve relative to worker script location
const SQL = await initSqlJs({
    locateFile: (filename: string) => `/assets/${filename}`
});
```

**Note:** In development, Vite serves assets from the root. In production (WKWebView), the custom scheme handler serves them from the app bundle. The `locateFile` path must be consistent with wherever the WASM file is served.

---

## Vitest Configuration

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Use Node environment (no DOM needed for database/provider tests)
        environment: 'node',

        // Worker isolation — forks are slower but fully isolated (required for sql.js WASM)
        pool: 'forks',

        // Each test file gets its own process (sql.js WASM state isolation)
        isolate: true,

        // TypeScript paths (if using path aliases)
        alias: {
            '@': '/src'
        },

        // Coverage with v8 (faster than Istanbul)
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/types/**']
        },

        // Performance: individual tests must be fast
        testTimeout: 5000,

        // Globals for ergonomic test writing
        globals: true,
    }
});
```

**Why `pool: 'forks'` instead of `threads`:** sql.js initializes WASM at module load time. With `threads` pool, WASM state can leak between test files in the same worker. With `forks`, each file gets a fresh process. This is slower but required for reliable database test isolation.

**Vitest 4 migration note:** `poolOptions.threads` config is gone — options are now top-level. `singleThread` is now `maxWorkers: 1`. The `coverage.all` option was removed.

---

## Installation

```bash
# Core runtime dependencies
npm install d3-selection d3-force d3-scale d3-axis d3-hierarchy \
            d3-zoom d3-drag d3-transition d3-time-format d3-array \
            d3-shape d3-color d3-interpolate d3-path d3-brush d3-chord

# sql.js — NOTE: use custom FTS5 build WASM, not default dist
npm install sql.js

# Dev dependencies
npm install -D typescript vite vitest \
            @types/d3-selection @types/d3-force @types/d3-scale \
            @types/d3-axis @types/d3-hierarchy @types/d3-zoom \
            @types/d3-drag @types/d3-transition @types/d3-time-format \
            @types/d3-array @types/d3-shape @types/d3-color \
            @types/d3-interpolate @types/d3-path @types/d3-brush \
            @types/sql.js \
            vite-plugin-static-copy \
            @vitest/coverage-v8 \
            eslint typescript-eslint \
            eslint-config-prettier prettier
```

**After installing sql.js:** Replace `node_modules/sql.js/dist/sql-wasm.wasm` with the custom FTS5-enabled build (see custom build section above). Or maintain the custom WASM in `src/assets/sql-wasm-fts5.wasm` and reference it directly.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| sql.js (custom FTS5 build) | `@sqlite.org/sqlite-wasm` (official SQLite WASM) | Requires OPFS or SharedArrayBuffer for persistence — both unsupported in WKWebView's local file context. Architecture is incompatible. |
| sql.js (custom FTS5 build) | `wa-sqlite` | Same OPFS requirement as above. Also: less documented, fewer TypeScript types, smaller community. |
| sql.js (custom FTS5 build) | `sql.js-fts5` npm fork | Abandoned (5 years old, v1.4.0). Based on very old sql.js. Do not use. |
| D3.js v7 sub-module imports | Umbrella `import * as d3 from 'd3'` | ~570KB bundle penalty. No technical reason to import everything when only 6-8 sub-modules are needed. |
| Vite 7.x | Vite 8 (beta) | Vite 8 uses Rolldown (beta). The breaking changes are extensive and the ecosystem hasn't caught up. Use Vite 7.x until Vite 8 is stable. |
| TypeScript 5.8 | TypeScript 6.0 (beta) | TS6 beta released Feb 2026 as transition release before Go-based TS7. Not production-ready. |
| Vitest 4 | Jest | Vitest shares Vite config, eliminates separate babel/jest-transform setup, ~10x faster on WASM-heavy test suites. No reason to use Jest in a Vite project. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Default sql.js WASM (from npm) | Ships with FTS3 only. FTS5 is required for `porter unicode61 remove_diacritics` tokenizer (D-004). | Custom sql.js build with `-DSQLITE_ENABLE_FTS5` flag |
| `sql.js-fts5` npm package | Abandoned 5 years ago. Based on ancient sql.js, no TypeScript types, security risk. | Custom build of current sql.js with FTS5 |
| `@sqlite.org/sqlite-wasm` | Requires OPFS (SharedArrayBuffer + COOP/COEP headers). WKWebView cannot set these headers. | sql.js (in-memory model matches architecture) |
| `fetch()` for WASM in WKWebView | WKWebView misreports MIME type, breaks `WebAssembly.instantiateStreaming()`. | `locateFile` pattern with Vite `?url` import; Swift serves assets via custom URL scheme |
| `import * as d3 from 'd3'` | Imports entire D3 library (~570KB). Tree-shaking does not work reliably on the umbrella package. | Direct sub-module imports: `import { select } from 'd3-selection'` |
| `@types/d3` umbrella for type checking | Last updated ~2 years ago. May lag behind sub-module type updates. | Individual `@types/d3-*` sub-module type packages |
| Zustand / MobX / Redux for card state | Architecture explicitly forbids parallel state (D-001 rationale). D3 data join IS state management. | Query sql.js directly; bind results to D3 data joins |
| React / Vue / Svelte | Stack is locked: vanilla TypeScript + D3.js. Framework adds abstraction layer that fights D3's DOM ownership. | Vanilla D3 with typed class-based view components |
| Vite 8 beta / Rolldown | Beta-quality. Breaking changes for worker and rollup config names. | Vite 7.x (stable) |
| TypeScript 6.0 beta | Pre-release. TS6 is a transition release before Go rewrite. | TypeScript 5.8.x |
| `pool: 'threads'` in Vitest | WASM state leaks between tests in same worker thread. sql.js WASM init is not safely re-entrant. | `pool: 'forks'` with `isolate: true` |

---

## Stack Patterns by Context

**For database tests (sql.js operations):**
- Environment: `node`
- Pool: `forks`
- Isolation: `true`
- Each test creates its own `Database` instance, calls `db.close()` in `afterEach`

**For provider tests (FilterProvider, AxisProvider, etc.):**
- Same node environment
- Providers take a `Database` instance — pass in a fresh in-memory db
- Test SQL output strings, not execution results, where possible

**For D3 view tests:**
- Use `jsdom` environment (only for view rendering tests)
- Mock `WorkerBridge` — D3 tests should not hit sql.js

**For WKWebView WASM initialization:**
- Swift shell uses `WKURLSchemeHandler` for `app://` scheme
- JavaScript calls `initSqlJs({ locateFile: () => 'app://host/assets/sql-wasm.wasm' })`
- WASM file served by Swift scheme handler with `Content-Type: application/wasm`
- Avoids `fetch()` MIME type bug entirely

---

## Version Compatibility Matrix

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `sql.js@1.14.0` | `@types/sql.js@1.7.x` | Types are reasonably current |
| `vite@7.3.x` | `vitest@4.0.x` | Same VoidZero release train; use matching major versions |
| `typescript@5.8.x` | `vite@7.3.x` | `moduleResolution: "bundler"` required for Vite compat |
| `d3-*@7.x` | `@types/d3-*@7.x` | Match major versions strictly |
| `vitest@4.x` | `@vitest/coverage-v8@4.x` | Coverage package must match Vitest major version |
| `eslint@9.x` | `typescript-eslint@8.x` | Flat config only; legacy `.eslintrc` no longer supported |
| Node.js | `vite@7.x` | Requires Node 20.19+ or 22.12+ (Vite 7 requirement) |

---

## Sources

- sql.js GitHub releases — version 1.14.0 confirmed Feb 12, 2025: https://github.com/sql-js/sql.js/releases
- sql.js Makefile — FTS3 only, FTS5 not included by default: https://github.com/sql-js/sql.js/blob/master/Makefile
- sql.js PR #594 — FTS5 default PR blocked by maintainer: https://github.com/sql-js/sql.js/pull/594
- WKWebView WASM MIME type bug — fetch vs XMLHttpRequest: https://gist.github.com/otmb/2eefc9249d347103469741542f135f5c
- D3.js getting started — v7.9.0 current, no v8: https://d3js.org/getting-started
- Vite 7 announcement — v7.3.1 stable, ESM-only: https://vite.dev/blog/announcing-vite7
- Vitest 4.0 announcement — browser mode stable, pool rewrite: https://vitest.dev/blog/vitest-4
- TypeScript 5.8 announcement — released Feb 28, 2025: https://devblogs.microsoft.com/typescript/announcing-typescript-5-8/
- PowerSync SQLite web state — OPFS recommendations, WKWebView gap: https://www.powersync.com/blog/sqlite-persistence-on-the-web
- SQLite web state blog — wa-sqlite OPFSCoopSyncVFS recommended for persistence: https://www.powersync.com/blog/sqlite-persistence-on-the-web
- TypeScript strict tsconfig options: https://www.typescriptlang.org/tsconfig/strict.html
- Vite worker options: https://vite.dev/config/worker-options
- WebAssembly Safari support — fully supported, Tail Calls + GC added Safari 2024: https://webkit.org/blog/16301/webkit-features-in-safari-18-2/

---

*Stack research for: Isometry v5 — local-first polymorphic data projection platform*
*Researched: 2026-02-27*
