---
phase: 01-database-foundation
plan: 01
subsystem: infra
tags: [typescript, vite, vitest, sql.js, wasm, fts5, node]

# Dependency graph
requires: []
provides:
  - TypeScript 5.9 strict project scaffold (noUncheckedIndexedAccess, exactOptionalPropertyTypes)
  - Vite 7.3 config excluding sql.js from esbuild optimizeDeps with assetsInlineLimit 0
  - Vitest 4.0 config with pool:forks, node environment, and globalSetup for WASM path
  - WASM path resolver (tests/setup/wasm-init.ts) setting SQL_WASM_PATH env var
  - Directory structure: src/database/, src/assets/, tests/database/, tests/setup/
affects: [01-02, 01-03, 01-04, all-phases]

# Tech tracking
tech-stack:
  added:
    - sql.js 1.14.0 (runtime — will use custom FTS5 WASM in plan 01-02)
    - typescript 5.9.3 (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes)
    - vite 7.3.1 (build tooling + dev server)
    - vitest 4.0.18 (test framework, pool:forks)
    - vite-plugin-static-copy 3.2.0 (WASM asset copy to dist/)
    - "@vitest/coverage-v8" 4.0.18 (v8 coverage provider)
    - "@types/sql.js" 1.4.9 (TypeScript types)
  patterns:
    - "Vite WASM pattern: optimizeDeps.exclude + assetsInlineLimit:0 + viteStaticCopy"
    - "Vitest WASM isolation: pool:forks + isolate:true + globalSetup"
    - "WASM path resolution: SQL_WASM_PATH env var set in globalSetup, fallback to default sql.js dist"

key-files:
  created:
    - package.json
    - tsconfig.json
    - vite.config.ts
    - vitest.config.ts
    - tests/setup/wasm-init.ts
    - src/index.ts
    - src/database/.gitkeep
    - src/assets/.gitkeep
    - tests/database/.gitkeep
    - tests/setup/.gitkeep
  modified: []

key-decisions:
  - "Removed rootDir from tsconfig.json to allow tests/ in include path alongside src/ — tsc --noEmit handles both"
  - "wasm-init.ts uses fallback to node_modules/sql.js/dist/sql-wasm.wasm if custom FTS5 WASM not yet built"
  - "process.env access uses bracket notation (process.env['SQL_WASM_PATH']) to satisfy noPropertyAccessFromIndexSignature"

patterns-established:
  - "Pattern: SQL_WASM_PATH env var is the contract between globalSetup and Database.ts test initialization"
  - "Pattern: viteStaticCopy targets src/assets/sql-wasm-fts5.wasm -> dist/assets (custom WASM artifact location)"

requirements-completed: [DB-05]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 1 Plan 01: Project Scaffold Summary

**TypeScript 5.9 strict scaffold with Vite 7 optimizeDeps.exclude and Vitest 4 pool:forks configured for sql.js WASM isolation**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T05:58:16Z
- **Completed:** 2026-02-28T06:00:07Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Initialized npm project with `type: module`, all Phase 1 dependencies (sql.js, TypeScript 5.9, Vite 7.3, Vitest 4.0, vite-plugin-static-copy, @vitest/coverage-v8, @types/sql.js)
- Created tsconfig.json with full strict mode: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- Configured Vite 7 with critical WASM settings: `optimizeDeps.exclude: ['sql.js']` prevents esbuild stripping WASM loading code; `assetsInlineLimit: 0` prevents base64 inlining
- Configured Vitest 4 with `pool: 'forks'` and `isolate: true` for full WASM state isolation between test files
- Created `tests/setup/wasm-init.ts` globalSetup that resolves `SQL_WASM_PATH` — tries custom FTS5 WASM first, falls back to default sql.js WASM

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize project scaffold** - `1b72d64` (chore)
2. **Task 2: Configure Vite and Vitest for WASM** - `dfa74d5` (chore)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `package.json` - ESM project, all Phase 1 deps, npm scripts (dev/build/typecheck/test/test:watch/test:coverage)
- `tsconfig.json` - Full strict TypeScript config, includes src/**/* and tests/**/*
- `vite.config.ts` - sql.js WASM config: optimizeDeps exclude, assetsInlineLimit 0, viteStaticCopy, worker ES format
- `vitest.config.ts` - WASM test isolation: pool forks, node environment, globalSetup, 10s timeout
- `tests/setup/wasm-init.ts` - WASM path resolver with custom FTS5 fallback to default sql.js dist
- `src/index.ts` - Minimal entry point (`export {}`)
- `src/database/.gitkeep` - Placeholder for Plan 03 Database.ts
- `src/assets/.gitkeep` - Placeholder for Plan 02 custom WASM artifact
- `tests/database/.gitkeep` - Placeholder for Plan 03 test suite
- `tests/setup/.gitkeep` - Already populated by wasm-init.ts

## Decisions Made

- Removed `rootDir: "src"` from tsconfig.json: TypeScript rejects `rootDir` when `include` covers directories outside it (tests/ is not under src/). For type-checking only (`tsc --noEmit`), rootDir is unnecessary — TypeScript infers the root from included files.
- WASM path fallback strategy: `wasm-init.ts` first checks `src/assets/sql-wasm-fts5.wasm` (custom FTS5 build, committed in Plan 02), then falls back to `node_modules/sql.js/dist/sql-wasm.wasm` (no FTS5 but allows config validation tests to run before Plan 02 completes).
- `process.env['SQL_WASM_PATH']` bracket notation used instead of `process.env.SQL_WASM_PATH` to satisfy `noPropertyAccessFromIndexSignature` strict rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed rootDir conflict with tests/ in tsconfig include**
- **Found during:** Task 2 (after adding tests/setup/wasm-init.ts)
- **Issue:** Plan specified `rootDir: "src"` in tsconfig.json but also `"include": ["src/**/*", "tests/**/*"]`. TypeScript error TS6059: file not under rootDir. `npm run typecheck` failed.
- **Fix:** Removed `rootDir` from tsconfig.json. TypeScript infers root correctly from included files; `tsc --noEmit` passes; Vite handles actual compilation separately.
- **Files modified:** `tsconfig.json`
- **Verification:** `npm run typecheck` exits 0 with zero errors
- **Committed in:** `dfa74d5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's tsconfig spec)
**Impact on plan:** Necessary for correctness. Plan's tsconfig was internally inconsistent (rootDir + include path mismatch). Fix preserves all strict mode settings.

## Issues Encountered

None beyond the tsconfig rootDir fix documented above.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- Build scaffold is complete and verified: `npm run typecheck` passes, `npx vitest --run` runs without config errors
- Plan 02 (Custom WASM Build) can now proceed: `src/assets/` directory exists for the FTS5 WASM artifact
- Plan 03 (Database Schema) can begin after Plan 02: `tests/setup/wasm-init.ts` will resolve to custom WASM
- `SQL_WASM_PATH` env var contract established — all future test files should use `process.env['SQL_WASM_PATH']` in `locateFile` callback
- Blocker remains: custom FTS5 WASM not yet built (Plan 02 dependency)

## Self-Check: PASSED

All files present and commits verified:
- `package.json` — FOUND
- `tsconfig.json` — FOUND
- `vite.config.ts` — FOUND
- `vitest.config.ts` — FOUND
- `tests/setup/wasm-init.ts` — FOUND
- `src/index.ts` — FOUND
- Commit `1b72d64` (Task 1) — FOUND
- Commit `dfa74d5` (Task 2) — FOUND

---
*Phase: 01-database-foundation*
*Completed: 2026-02-28*
