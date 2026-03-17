# Phase 79: Test Infrastructure — Context

**Created:** 2026-03-15
**Phase Goal:** Every subsequent phase can create a real sql.js database and a fully-wired provider stack in one line each

## 1. Factory API Shape

### Decisions
- **`realDb()`** returns an in-memory sql.js `Database` with production schema, no seed data
- **`makeProviders(db)`** requires a `realDb()` instance — no stub/optional mode
- **Return shape:** Named object `{ filter, pafv, density, selection, coordinator, schema }` — tests destructure what they need
- **No overrides:** Factory always returns clean defaults; tests mutate providers after creation
- **Location:** `tests/harness/` directory (separate from existing `tests/setup/` which handles WASM init)

### Critical Guard: Session 0 Reading List
CC **must read** these files before writing any factory code — constructor signatures and setter injection from v5.3 are the #1 source of silent failures:

1. `src/providers/FilterProvider.ts` — constructor args, `setSchemaProvider()`, `compile()` path
2. `src/providers/PAFVProvider.ts` — constructor args, `setSchemaProvider()`, `getAggregation()` presence
3. `src/providers/SuperDensityProvider.ts` — constructor args, `setHideEmpty()`/`setViewMode()`
4. `src/providers/StateCoordinator.ts` — `registerProvider()` signature, `scheduleUpdate()`, `destroy()`
5. `src/providers/SchemaProvider.ts` — constructor, `classify()`, LATCH heuristic setup
6. `tests/integration/seam-coordinator-batch.test.ts` (if exists) — the flush pattern in use

### Critical Guard: v5.3 Setter Injection
`makeProviders()` **must call `setSchemaProvider()`** on every provider that has a setter (FilterProvider, PAFVProvider, and any others discovered during Session 0). Without this, dynamic field tests in Phases 80-83 will silently fail — the allowlist won't include dynamic columns.

## 2. Seed Data Approach

### Decisions
- **`realDb()` returns bare schema** (no rows) — matches INFR-01 spec
- **`seedCards(db, cards[])`** — separate helper, accepts minimal partial objects with sensible defaults (auto-generates `id`, `created_at`, `updated_at`, `deleted_at=null`)
- **`seedConnections(db, connections[])`** — separate helper for connections; most seam tests won't need it
- **FTS5 always populated** — `seedCards()` inserts into both `cards` and `cards_fts` automatically, matching production behavior
- Tests only specify fields that matter for the assertion; everything else gets defaults

## 3. Script Organization

### Decisions
- **`tests/seams/`** — new dedicated directory for all seam tests (Phases 80-83), with subdirectories by domain (`seams/filter/`, `seams/coordinator/`, etc.)
- **`tests/harness/`** — factory code (`realDb.ts`, `makeProviders.ts`, `seedCards.ts`, `seedConnections.ts`) and smoke tests
- **`npm run test:harness`** — runs `tests/harness/*.test.ts` only (smoke tests for infrastructure)
- **`npm run test:seams`** — runs `tests/seams/**/*.test.ts` only (all seam tests from Phases 80-83)
- **`npm run test`** — continues to run everything (existing + harness + seams)
- **Add to CI** — `test:harness` and `test:seams` as CI jobs alongside existing typecheck/lint/test
- **TypeScript-only npm scripts** — no `swift test` in npm. Native tests stay in `Makefile` (`make test-native` or `xcodebuild`). No cross-toolchain coupling.

## 4. Smoke Test Scope

### realDb() Smoke Tests
1. **INSERT/SELECT round-trip** — insert a card, SELECT it back, verify row matches
2. **FTS5 round-trip** — insert into cards + cards_fts, search via FTS MATCH, verify result
3. **All tables exist** — query sqlite_master for cards, connections, cards_fts, ui_state
4. **Performance indexes exist** — verify the 6 covering/expression indexes from v6.0 are created

### makeProviders() Smoke Tests
1. **Filter → coordinator notify** — set a filter on FilterProvider, verify StateCoordinator fires notification
2. **SchemaProvider injection** — verify providers that need SchemaProvider have it set (v5.3 setter injection)
3. **All providers present** — verify returned object has all expected keys (filter, pafv, density, selection, coordinator, schema)
4. **Destroy cleanup** — call `coordinator.destroy()`, mutate a provider, verify no notification fires

## 5. Implementation Guards (from review)

### "flush" Pattern
- The coordinator uses `setTimeout(16)` for batching
- In tests, "flush" = `await vi.advanceTimersByTimeAsync(16)`
- CC must check existing tests for the exact pattern and use it consistently
- Inconsistency causes "coordinator isn't notifying but production works" failures

### Deferred to Later Phases (captured, not acted on)
- **WA-02 hideEmpty cross-product behavior** — CC must read `supergrid.handler.ts` before writing Phase 80 assertions (CELL-03)
- **d3.brushX jsdom simulation** — spy on internal handler, don't simulate pointer events (Phase 82, HIST-01/02)
- **CalcExplorer subscription path** — verify direct PAFVProvider subscription vs callback (Phase 83, CALC-01/02)
- **LATCH→GRAPH round-trip axis clearing** — confirm whether viewType changes clear axes (Phase 82, VTAB-02)

## Code Context

### Existing Assets
- `src/database/Database.ts` — wraps sql.js with `initialize()` / `exec()` / `run()` / `close()`
- `tests/setup/wasm-init.ts` — WASM path resolution (custom FTS5 build or node_modules fallback)
- `src/providers/index.ts` — re-exports all provider types and classes
- Provider stack: FilterProvider, PAFVProvider, SchemaProvider, DensityProvider, SelectionProvider, StateCoordinator, StateManager, ThemeProvider
- Existing tests use `new Database()` + `await db.initialize()` directly (no shared factory)
- Current CI: 3 parallel jobs (typecheck via tsc, lint via biomejs, test via vitest) + branch protection

### Patterns to Follow
- `beforeEach` / `afterEach` lifecycle with `db.close()` for WASM heap cleanup
- v5.3 setter injection: `provider.setSchemaProvider(schema)` after construction
- D-011: `__agg__` prefix convention for calc query aggregate aliases
- vitest `--run` mode (no watch) for CI scripts

---
*Context created: 2026-03-15*
