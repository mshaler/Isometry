# Testing

## Framework

- **Vitest** — primary test runner (unit, integration, benchmarks)
- **Playwright** — E2E browser tests (`e2e/` directory)
- **XCTest** — Swift native tests (`native/Isometry/IsometryTests/`)
- **XCUITest** — Swift UI tests (`native/Isometry/IsometryUITests/`)

## Configuration

**Vitest** (`vite.config.ts`):
- Environment: `node` (NOT jsdom — WASM runs in Node directly)
- Pool: `forks` — full process isolation prevents WASM state leakage
- `isolate: true` — each test file gets its own process
- Global setup: `tests/setup/wasm-init.ts`
- Timeout: 10,000ms (WASM init can take 1-2s on cold start)
- Coverage: v8 provider, includes `src/**/*.ts`
- `__PERF_INSTRUMENTATION__` Vite define gate for profiling code

**Excluded from default test run:**
- `e2e/**` — Playwright E2E (run separately)
- `tests/profiling/budget.test.ts` — intentional red tests for perf budgets
- `tests/profiling/budget-render.test.ts` — environment-dependent render budgets
- `tests/database/performance-assertions.test.ts` — environment-dependent perf assertions

**Playwright** (`playwright.config.ts`):
- 11 E2E specs covering critical-path flows

## Test File Count

- ~152 test files in `tests/`
- ~14 seam test files in `tests/seams/`
- 11 E2E specs in `e2e/`
- 5 XCTest files in `native/`

## Test Structure

Tests mirror source directory structure:

| Source | Tests |
|--------|-------|
| `src/providers/FilterProvider.ts` | `tests/providers/FilterProvider.test.ts` |
| `src/views/SuperGrid.ts` | `tests/views/SuperGrid.test.ts` |
| `src/etl/parsers/CSVParser.ts` | `tests/etl/parsers/CSVParser.test.ts` |
| `src/worker/handlers/supergrid.handler.ts` | `tests/worker/supergrid.handler.test.ts` |

Special test directories:
- `tests/harness/` — shared test factories
- `tests/seams/` — cross-component integration gap tests
- `tests/profiling/` — performance benchmarks and budget tests
- `tests/etl-validation/` — 100+ fixture source x view matrix tests

## Test Factories (Shared Harness)

Located in `tests/harness/`:

- **`realDb()`** — creates in-memory sql.js database with real schema, returns `{ db, run, all, get }`
- **`makeProviders()`** — wires full provider stack with real PRAGMA-derived SchemaProvider
- **`seedCards()`** — inserts test card data
- **`seedConnections()`** — inserts test connection data

These factories provide real database behavior (not mocks) for integration-level tests without requiring jsdom.

## WASM + jsdom Coexistence

- Default environment is `node` (for WASM compatibility)
- UI tests that need DOM use per-file annotation: `// @vitest-environment jsdom`
- This prevents WASM/jsdom conflicts while allowing DOM testing where needed

## Seam Tests (`tests/seams/`)

Cross-component integration tests covering gaps between units:

| Seam | File | What it tests |
|------|------|---------------|
| Filter → SQL | `seams/filter/filter-sql.test.ts` | FilterProvider → QueryBuilder → Worker SQL |
| PAFV → CellDatum | `seams/filter/pafv-celldatum.test.ts` | PAFVProvider → SuperGrid cell rendering |
| Coordinator → Density | `seams/coordinator/coordinator-density.test.ts` | StateCoordinator → DensityProvider batching |
| ETL → FTS | `seams/etl/etl-fts.test.ts` | Import → full-text search index |
| UI seams | `seams/ui/*.test.ts` | WorkbenchShell, ViewTabBar, CommandBar, CalcExplorer, HistogramScrubber lifecycle |

## Performance Testing

- **Benchmarks** (`*.bench.ts`): Vitest `bench()` API for throughput measurement
- **Budget tests** (`tests/profiling/budget*.test.ts`): Assert against `PerfBudget.ts` constants
- **CI bench job**: 4th GitHub Actions job with 11 budget assertions (soft gate)
- **Baselines**: `.benchmarks/main.json` for cross-commit regression comparison

## Anti-Patching Rule

**If a test fails, fix the app — never weaken the assertion.** This is a project-level policy enforced during development.

## CI Pipeline (`.github/workflows/`)

3 parallel jobs:
1. **typecheck** — `tsc --noEmit`
2. **lint** — Biome via `biomejs/setup-biome@v2`
3. **test** — `vitest run`

4th job (bench) runs performance budget assertions with `continue-on-error` soft gate.

## Mocking Strategy

- **Minimal mocking** — prefer real sql.js databases via `realDb()` factory
- Provider tests use real providers wired via `makeProviders()`
- Worker handler tests run actual SQL against in-memory databases
- DOM tests use jsdom environment annotation
- ETL tests use fixture files in `tests/etl/fixtures/` and `tests/etl-validation/fixtures/`
