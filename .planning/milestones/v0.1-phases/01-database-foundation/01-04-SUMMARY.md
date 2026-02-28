---
phase: 01-database-foundation
plan: 04
subsystem: database
tags: [vite, wasm, sql.js, production-build, tdd, typescript, vite-plugin-static-copy]

# Dependency graph
requires:
  - 01-01 (TypeScript scaffold, Vite config, optimizeDeps.exclude, viteStaticCopy)
  - 01-02 (custom FTS5 WASM artifact at src/assets/sql-wasm-fts5.wasm)
  - 01-03 (Database.ts, wasm-compat.ts — the modules re-exported via src/index.ts)
provides:
  - "Production build smoke test: 4 Vitest tests verifying vite build + WASM in dist/assets/ (tests/database/production-build.test.ts)"
  - "Application entry point: src/index.ts re-exports Database + patchFetchForWasm"
  - "Vite lib mode build: produces dist/isometry.js + dist/assets/sql-wasm-fts5.wasm"
  - "vite-env.d.ts: Vite client types for ?raw and ?url imports"
affects:
  - all-phases (every subsequent phase consumes src/index.ts public API)
  - phase 2 (WorkerBridge imports Database from src/index.ts)
  - phase 7 (NativeShell WKWebView uses production dist/ output)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vite lib mode: entry src/index.ts, format es, external sql.js"
    - "Schema loading: dynamic import node:fs/url/path in test context (SQL_WASM_PATH set), ?raw import in Vite production context"
    - "WASM path in production: locateFile returns ./assets/sql-wasm-fts5.wasm (viteStaticCopy target)"
    - "Production build smoke test: execSync vite build inside Vitest, timeout 60s override via it() options"
    - "TDD: RED commit (failing tests, no dist/) then GREEN commit (vite build succeeds, all tests pass)"

key-files:
  created:
    - tests/database/production-build.test.ts
    - src/vite-env.d.ts
  modified:
    - src/index.ts
    - src/database/Database.ts
    - vite.config.ts

key-decisions:
  - "Vite lib mode (not app mode): no index.html needed; src/index.ts is the library entry; produces dist/isometry.js + dist/assets/sql-wasm-fts5.wasm"
  - "Schema loading strategy: conditional on SQL_WASM_PATH env var — Node/test context uses dynamic import of node:fs; Vite production context uses ?raw import (inline string)"
  - "Node built-ins (node:fs/url/path) in dynamic imports: Vite externalizes them safely since the code path is gated by SQL_WASM_PATH which is never set in production"
  - "sql.js externalized from bundle: rollupOptions.external sql.js — consumers must provide sql.js; avoids double-bundling"
  - "Production build test timeout: use it('...', { timeout: 60000 }) option (not test.setTimeout inside describe which is not a function in Vitest)"

requirements-completed: [DB-01, DB-05]

# Metrics
duration: 3min
completed: 2026-02-28
---

# Phase 1 Plan 04: Production Build Verification Summary

**Vite lib mode build producing dist/isometry.js + dist/assets/sql-wasm-fts5.wasm (756KB, FTS5, not base64-inlined), with 4-test smoke suite catching the WASM path failure mode that only manifests in vite build output**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-28T06:11:55Z
- **Completed:** 2026-02-28T06:15:21Z
- **Tasks:** 2 (TDD RED + GREEN combined with Task 2)
- **Files created:** 3 (production-build.test.ts, src/vite-env.d.ts, updated src/index.ts)
- **Files modified:** 2 (src/database/Database.ts, vite.config.ts)

## Accomplishments

- Created 4-test production build smoke suite catching Pitfall 2 (WASM path breaks in Vite production): vite build exits 0, WASM in dist/assets/, sized 500KB-2MB, not base64-inlined
- Configured Vite lib mode with `src/index.ts` as entry point, ES format output, sql.js externalized — produces `dist/isometry.js` that future phases import
- Added `src/vite-env.d.ts` with `/// <reference types="vite/client" />` enabling `?raw` and `?url` imports throughout the project
- Updated `Database.ts` to load schema.sql via dynamic `node:fs` import in test context (SQL_WASM_PATH set) and via Vite `?raw` inline in production — removes static Node built-in imports from top-level that blocked Vite bundling
- All 38 tests pass: 34 Database tests + 4 production build smoke tests; `npm run typecheck` exits 0

## Task Commits

Each task committed atomically:

1. **TDD RED — Failing production build smoke test** - `ac7e5b6` (test) — 4 failing tests (no dist/ yet)
2. **Task 2 + TDD GREEN — Entry point + production build fix** - `8badb00` (feat) — src/index.ts, vite-env.d.ts, Database.ts, vite.config.ts; all 38 pass

## Files Created/Modified

- `tests/database/production-build.test.ts` — 4-test smoke suite: vite build success, WASM in dist/assets/, 500KB-2MB size, no base64 inlining
- `src/vite-env.d.ts` — Vite client type reference (enables ?raw and ?url TypeScript support)
- `src/index.ts` — Application entry point: re-exports Database and patchFetchForWasm
- `src/database/Database.ts` — Schema loading now async (applySchema is async); dynamic node:fs import gated by SQL_WASM_PATH env var; removes static top-level Node built-in imports
- `vite.config.ts` — Added lib mode (entry: src/index.ts, format: es, fileName: isometry); added rollupOptions.external for sql.js; added resolve import for __dirname

## Decisions Made

- **Vite lib mode over app mode:** Project has no index.html. As a library (Database module consumed by WorkerBridge in Phase 2), lib mode is correct. Entry: `src/index.ts`, format: `es`, output: `dist/isometry.js`.

- **Schema loading via conditional dynamic import:** `applySchema()` is now async. In test context (SQL_WASM_PATH set by wasm-init.ts globalSetup), it uses `await import('node:fs')` to readFileSync schema.sql. In Vite production context, it uses `await import('./schema.sql?raw')` which Vite transforms to an inlined string. This avoids static top-level Node built-in imports that blocked Vite bundling.

- **Node built-ins externalized by Vite automatically:** Since `import('node:fs')` is in a branch gated by SQL_WASM_PATH (never set in production), Vite externalizes node:fs/url/path safely. The `__vite-browser-external` empty chunk is expected and harmless.

- **Production build test timeout via it() options:** `test.setTimeout(60000)` inside `describe()` is not a valid Vitest call (throws "not a function"). Correct pattern is `it('...', { timeout: 60000 }, () => { ... })` for per-test timeout override.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Vite lib mode to vite.config.ts**
- **Found during:** Task 1 TDD RED (vite build fails: "Could not resolve entry module index.html")
- **Issue:** `vite build` defaults to app mode and looks for `index.html`. Project has no index.html — it's a library. Without lib mode, the build fails immediately.
- **Fix:** Added `build.lib` config: `{ entry: resolve(__dirname, 'src/index.ts'), name: 'Isometry', formats: ['es'], fileName: 'isometry' }` and `rollupOptions.external: ['sql.js']`
- **Files modified:** `vite.config.ts`
- **Verification:** `npx vite build` exits 0; dist/isometry.js and dist/assets/sql-wasm-fts5.wasm produced
- **Committed in:** `8badb00` (Task 2 commit)

**2. [Rule 1 - Bug] Removed static Node built-in imports from Database.ts top-level**
- **Found during:** Task 1 TDD GREEN (vite build fails after lib mode added: "Module 'fs' has been externalized for browser compatibility")
- **Issue:** `Database.ts` had top-level `import { readFileSync } from 'fs'` etc. Even with lib mode, Vite rejects static Node built-in imports in browser-targeting bundles.
- **Fix:** Made `applySchema()` async, moved Node built-in imports to dynamic `import('node:fs')` gated by `SQL_WASM_PATH` env var; added `import('./schema.sql?raw')` for production path
- **Files modified:** `src/database/Database.ts`
- **Verification:** `npx vite build` exits 0; 38/38 tests pass (readFileSync path still works in Vitest via SQL_WASM_PATH branch)
- **Committed in:** `8badb00` (Task 2 commit)

**3. [Rule 3 - Blocking] test.setTimeout(60000) inside describe() not valid in Vitest**
- **Found during:** Task 1 TDD RED (test suite fails immediately: "test.setTimeout is not a function")
- **Issue:** The plan's example used `test.setTimeout(60000)` inside `describe()`. Vitest does not expose `test.setTimeout` as a callable function at that scope.
- **Fix:** Changed to per-test timeout option: `it('DB-05: vite build...', { timeout: LONG_TIMEOUT }, () => { ... })` where LONG_TIMEOUT = 60000
- **Files modified:** `tests/database/production-build.test.ts`
- **Verification:** Test suite runs without immediate failure; vite build test completes within 60s
- **Committed in:** `ac7e5b6` (TDD RED commit)

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** All auto-fixes necessary to complete the production build. No scope creep — all changes are directly required to make `vite build` succeed with the sql.js WASM artifact.

## Issues Encountered

None beyond the three auto-fixed deviations documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `src/index.ts` public API surface established: `Database` and `patchFetchForWasm` exported
- `dist/` production build verified: `dist/isometry.js` + `dist/assets/sql-wasm-fts5.wasm`
- Phase 1 complete: all 4 plans done, all 38 tests passing, TypeScript clean
- Phase 2 (WorkerBridge) can import `Database` from `src/index.ts` or `dist/isometry.js`
- WKWebView WASM MIME type fix: `patchFetchForWasm()` available in `src/index.ts`; full solution (Swift WKURLSchemeHandler) in Phase 7

## Self-Check: PASSED

Files present:
- `tests/database/production-build.test.ts` — FOUND
- `src/vite-env.d.ts` — FOUND
- `src/index.ts` — FOUND (re-exports Database + patchFetchForWasm)
- `src/database/Database.ts` — FOUND (async applySchema, conditional schema loading)
- `vite.config.ts` — FOUND (lib mode configured)
- `dist/assets/sql-wasm-fts5.wasm` — FOUND (773942 bytes, ~756KB)

Commits present:
- `ac7e5b6` (TDD RED — failing smoke tests) — FOUND
- `8badb00` (feat — entry point + production build fix) — FOUND

Test results: 38/38 passing (34 Database + 4 production build smoke)
TypeScript: 0 errors
Build: exits 0, WASM in dist/assets/, not base64-inlined

---
*Phase: 01-database-foundation*
*Completed: 2026-02-28*
