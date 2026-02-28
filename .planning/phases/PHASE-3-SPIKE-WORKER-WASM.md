# Phase 3 Spike: Worker + WASM Validation

**Purpose:** Validate that sql.js WASM initializes correctly inside a Web Worker before committing to the full Phase 3 implementation.

**Duration:** 1-2 hours  
**Risk Mitigated:** WASM loading failure in Worker context would block all of Phase 3

---

## Success Criteria

1. [x] Vite bundles a Web Worker that imports sql.js
2. [x] Worker successfully loads the custom FTS5 WASM binary
3. [x] Worker can execute a simple SQL query and return results to main thread
4. [x] Dev server hot-reloads worker changes
5. [x] Production build (`npm run build`) produces working worker bundle

---

## Spike Implementation

### Step 1: Create Minimal Worker

Create `src/worker/spike-worker.ts`:

```typescript
// Minimal spike to validate WASM-in-worker
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

let db: SqlJsDatabase | null = null;

async function initialize(): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      // In worker context, resolve relative to worker bundle location
      return `./assets/${file.replace('sql-wasm.wasm', 'sql-wasm-fts5.wasm')}`;
    },
  });

  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON');
  
  // Verify FTS5 is available
  const ftsCheck = db.exec(
    "SELECT * FROM pragma_compile_options WHERE compile_options LIKE '%FTS5%'"
  );
  
  if (!ftsCheck[0]?.values?.length) {
    throw new Error('FTS5 not available in WASM build');
  }

  self.postMessage({ type: 'ready', fts5: true });
}

self.onmessage = async (event: MessageEvent) => {
  const { type, sql } = event.data;

  if (type === 'query' && db) {
    try {
      const result = db.exec(sql);
      self.postMessage({ type: 'result', data: result });
    } catch (error) {
      self.postMessage({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }
};

// Self-initialize on load
initialize().catch((error) => {
  self.postMessage({ 
    type: 'error', 
    message: error instanceof Error ? error.message : 'Initialization failed' 
  });
});
```

### Step 2: Create Spike Test Harness

Create `src/spike-test.ts` (temporary, for manual testing):

```typescript
// Temporary spike test - run via: npx vite dev, then open browser console
import SpikeWorker from './worker/spike-worker?worker';

export async function runSpike(): Promise<void> {
  console.log('[Spike] Creating worker...');
  const worker = new SpikeWorker();

  const ready = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Worker init timeout')), 10000);
    
    worker.onmessage = (event) => {
      console.log('[Spike] Worker message:', event.data);
      
      if (event.data.type === 'ready') {
        clearTimeout(timeout);
        resolve();
      } else if (event.data.type === 'error') {
        clearTimeout(timeout);
        reject(new Error(event.data.message));
      }
    };
  });

  await ready;
  console.log('[Spike] Worker ready, FTS5 confirmed');

  // Test a simple query
  worker.postMessage({ type: 'query', sql: 'SELECT 1 + 1 AS result' });
  
  // Test FTS5 syntax
  worker.postMessage({ 
    type: 'query', 
    sql: "SELECT highlight(t, 0, '<b>', '</b>') FROM (SELECT 'test' AS x) AS t" 
  });

  // Cleanup after 5 seconds
  setTimeout(() => {
    worker.terminate();
    console.log('[Spike] Worker terminated');
  }, 5000);
}

// Auto-run in browser
if (typeof window !== 'undefined') {
  (window as unknown as { runSpike: typeof runSpike }).runSpike = runSpike;
  console.log('[Spike] Run `runSpike()` in console to test');
}
```

### Step 3: Update Vite Config

Add to `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // ... existing config ...
  
  worker: {
    format: 'es',
    plugins: () => [],
  },
  
  optimizeDeps: {
    exclude: ['sql.js'], // Prevent esbuild from bundling sql.js
  },
  
  build: {
    rollupOptions: {
      // ... existing external config ...
    },
  },
  
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'src/assets/sql-wasm-fts5.wasm',
          dest: 'assets',
        },
      ],
    }),
    // ... existing plugins ...
  ],
});
```

### Step 4: Validate in Browser

```bash
npm run dev
# Open http://localhost:5173
# Open browser console
# Run: runSpike()
```

**Expected output:**
```
[Spike] Creating worker...
[Spike] Worker message: { type: 'ready', fts5: true }
[Spike] Worker ready, FTS5 confirmed
[Spike] Worker message: { type: 'result', data: [...] }
[Spike] Worker terminated
```

### Step 5: Validate Production Build

```bash
npm run build
npx vite preview
# Repeat browser test
```

---

## Troubleshooting

### WASM MIME Type Error

**Symptom:** `Uncaught (in promise) TypeError: Failed to execute 'compile' on 'WebAssembly'`

**Fix:** Ensure vite serves `.wasm` with correct MIME type. Add to `vite.config.ts`:

```typescript
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
},
```

### Worker Import Error

**Symptom:** `SyntaxError: Cannot use import statement outside a module`

**Fix:** Ensure `worker.format: 'es'` is set in Vite config.

### WASM Path Resolution

**Symptom:** 404 on WASM file in worker

**Fix:** The `locateFile` path is relative to the worker bundle, not the HTML. Adjust path or use absolute URL:

```typescript
locateFile: (file: string) => {
  return new URL(`./assets/${file.replace('sql-wasm.wasm', 'sql-wasm-fts5.wasm')}`, import.meta.url).href;
}
```

---

## Cleanup After Spike

Once validated, remove:
- [x] `src/spike-test.ts`
- [x] `src/worker/spike-worker.ts`
- [x] `spike.html`

Keep:
- [x] Vite config changes (needed for Phase 3)
- [x] Learnings documented below

---

## Spike Findings

*Completed: 2026-02-28*

| Question | Finding |
|----------|---------|
| Does WASM load in worker? | YES — FTS5 confirmed, `SELECT 1+1` returns `[[2]]` |
| Which `locateFile` pattern works? | `new URL('../assets/sql-wasm-fts5.wasm', import.meta.url).href` |
| Any CORS/COEP headers needed? | NO — not needed for Vite dev or production build |
| Hot reload works? | YES — Vite HMR picks up worker changes |
| Production build works? | YES — `vite build` succeeds, worker not in lib output (correct) |
| Any gotchas discovered? | **CRITICAL:** see below |

### Critical Gotcha: `optimizeDeps.exclude: ['sql.js']` breaks workers

**Problem:** sql.js is a CJS package. When excluded from Vite's optimizeDeps pre-bundling, Vite serves it raw to the worker module context. Workers use `type: 'module'` (ESM), and the raw CJS module yields an empty object — `import('sql.js')` returns `{ }` with no `default` export.

**Symptom:** `initSqlJs is not a function` — silent worker death with no error in console (top-level static import kills the module before any code runs).

**Fix:** Remove `optimizeDeps.exclude: ['sql.js']`. Vite's esbuild pre-bundling correctly converts CJS→ESM and preserves the `locateFile` callback. All 176 existing tests pass after removal.

**Impact on Phase 3:** The `locateFile` pattern for production workers should use `import.meta.url`-relative resolution (not relative path strings). The static import `import initSqlJs from 'sql.js'` works fine once pre-bundling is enabled.

---

*Spike plan created: 2026-02-28*
*Spike completed: 2026-02-28*
