---
phase: 75-performance-budgets-benchmark-skeleton
type: research
created: 2026-03-11
requirements: [RGRD-01, RGRD-03]
depends_on: [Phase 74]
---

# Phase 75 Research: Performance Budgets + Benchmark Skeleton

## Objective

Answer: "What do I need to know to PLAN this phase well?"

Phase 75 is the TDD "red" step for performance. It derives budget thresholds from Phase 74 measured data, writes failing assertions against those thresholds, and commits a `.benchmarks/main.json` baseline for future regression comparison.

---

## Requirements Coverage

**RGRD-01:** Performance budgets defined — render <16ms, query <200ms, launch <3s, heap <150MB

The REQUIREMENTS.md lists these as the intended thresholds. However, the critical constraint from STATE.md decisions is: _"Phase 75 budgets must be derived from Phase 74 measured data, not preset guesses (TDD red step for perf)."_ This means the thresholds in `PerfBudget.ts` should be informed by the BOTTLENECKS.md numbers but set as _aspirational targets_ (i.e., tighter than current measurements) so the assertions fail until Phase 76/77 optimizations land.

**RGRD-03:** Baseline JSON committed for cross-commit comparison

The `.benchmarks/main.json` file must be committed to the repo so Phase 78's `--compare` flag can detect regressions. It is a one-time snapshot of current (Phase 74) measurements.

---

## Phase 74 Baseline Numbers (the ground truth)

All numbers from `BOTTLENECKS.md`:

### SQL Query (p99 at 20K cards, Node/arm64)
| Query | 20K p99 |
|-------|---------|
| GROUP BY folder, card_type | 24.93ms |
| GROUP BY status | 1.87ms |
| GROUP BY created_at (month) | 20.64ms |
| FTS 3-word search | 1.70ms |

### SuperGrid Render (jsdom p99; Chrome estimate = jsdom ÷ 8)
| Config | 1K p99 jsdom | 5K p99 jsdom | 20K p99 jsdom | 20K Chrome est. |
|--------|-------------|-------------|--------------|----------------|
| single (folder) | 85.3ms | 44.7ms | 37.8ms | ~5ms |
| dual (folder × card_type) | 194.3ms | 506.0ms | 434.2ms | ~54ms |
| triple (folder × card_type × status) | 99.8ms | 162.2ms | 259.4ms | ~32ms |

### ETL Import (20K cards total elapsed)
| Source | 20K total | cards/s |
|--------|----------|---------|
| apple_notes | 182ms | 110,000/s |
| csv | 767ms | 26,000/s |
| json | 1,771ms | 11,300/s |
| markdown | 1,059ms | 18,900/s |

### Bundle (gzip)
| Asset | Gzip |
|-------|------|
| JS Total | 361KB |
| WASM | 370KB |

---

## Budget Derivation Logic

The REQUIREMENTS.md spec lists: _render <16ms, query <200ms, launch <3s, heap <150MB_. These are user-facing targets. Phase 75 must map them to measurable test assertions:

**Query budget (<200ms):**
- Current worst-case at 20K: 24.93ms (GROUP BY folder, card_type). This is well under 200ms.
- The budget should be set at the **target after Phase 76 optimization**, i.e., a threshold that the current codebase fails. Setting the query budget at 10ms at 20K (or the current p99 minus a margin) makes the test red today and green after Phase 76 adds covering indexes.
- Practical approach: budget = `current_p99 * 0.5` (50% improvement target) — e.g., 12ms for GROUP BY folder+card_type at 20K.

**Render budget (<16ms):**
- jsdom is 5–10x slower than Chrome. The 16ms budget is a Chrome frame budget (60fps).
- jsdom equivalent: 16ms × 8 = 128ms. Current best jsdom p99 at 5K (single axis) = 44.7ms — passes even in jsdom. Dual-axis at 5K = 506ms — fails.
- Assertion strategy: test jsdom values against `budget * jsdom_factor` (e.g., 128ms). Tests must fail for dual-axis 5K today.

**ETL import budget:**
- REQUIREMENTS.md doesn't list a specific import budget number. Phase 75 should define one from the data. A reasonable target: <2s for 20K cards (any source type). Current worst: json at 1,771ms — nearly at that limit already. Budget at <1s would be red for json.

**Launch budget (<3s):**
- Launch timing requires physical device measurement (BOTTLENECKS.md defers to Phase 77). Phase 75 cannot run a meaningful launch timing assertion in Vitest. The launch budget constant should be defined in `PerfBudget.ts` but assertions should be **skipped or noted as pending** until Phase 77 Instruments data is available.

**Heap budget (<150MB):**
- Also deferred to Phase 77 physical device measurement. Define constant, no assertion in Phase 75.

---

## What PerfBudget.ts Should Contain

A new file `src/profiling/PerfBudget.ts` with typed constants:

```typescript
// Render budget: Chrome 60fps frame = 16ms; jsdom factor = 8x
export const BUDGET_RENDER_JSDOM_MS = 16 * 8; // 128ms

// SQL query budgets at 20K cards (post-Phase-76 targets, current baseline fails)
export const BUDGET_QUERY_GROUP_BY_20K_MS = 12; // baseline: 24.93ms → target: 12ms after index
export const BUDGET_QUERY_STRFTIME_20K_MS = 10; // baseline: 20.64ms → target: 10ms after index
export const BUDGET_QUERY_STATUS_20K_MS = 5;    // baseline: 1.87ms → already passes
export const BUDGET_QUERY_FTS_20K_MS = 5;       // baseline: 1.70ms → already passes

// ETL import budget at 20K cards
export const BUDGET_ETL_20K_MS = 1000; // 1s target (json at 1771ms fails today)

// Launch and heap budgets (Phase 77 physical device targets, not testable in vitest)
export const BUDGET_LAUNCH_COLD_MS = 3000;
export const BUDGET_HEAP_STEADY_MB = 150;
```

---

## Existing Bench Infrastructure (Phase 74 artifacts)

All bench files already exist and run:

| File | Purpose | Location |
|------|---------|----------|
| `tests/profiling/query.bench.ts` | SQL GROUP BY + FTS at 1K/5K/20K | vitest bench() format |
| `tests/profiling/supergrid-render.bench.ts` | `_renderCells()` at 3 axis configs × 3 scales | vitest bench(), jsdom env |
| `tests/profiling/etl-import.bench.ts` | ImportOrchestrator 4 source types × 3 scales | vitest bench() format |
| `tests/profiling/etl-smoke.bench.ts` | ETL timing via it() + console.log | vitest it() format |
| `tests/profiling/render-timing.test.ts` | Render timing via it() + p99() helper | vitest it(), jsdom env |
| `tests/profiling/etl-timing.test.ts` | ETL timing via it() (papaparse workaround) | vitest it() format |

**Critical known issue from 74-03:** vitest bench v4 with `forks` pool returns **empty sample arrays** in `--run` mode. This means `bench()` functions execute but timing data is lost — no p99 values are surfaced. The workaround used in Phase 74 was `it()` + direct `performance.now()`.

**Implication for Phase 75:** The _failing assertions_ must be in `it()` tests, not in `bench()` blocks, because `bench()` blocks do not support `expect()` assertions and also have the empty-samples bug. The bench files from Phase 74 remain as throughput documentation instruments, but the budget assertion tests should be new `it()`-based test files.

---

## The `.benchmarks/main.json` Baseline

**RGRD-03** requires committing a baseline JSON for future `--compare` regression detection.

Vitest's `--outputJson <path>` flag writes bench results to JSON. However, given the empty-samples bug with `bench()` in forks pool mode, the `main.json` must be generated from the `it()`-based timing tests, not the `bench()` files.

**Approach:** Create a dedicated bench runner script or npm script that:
1. Runs `npx vitest run tests/profiling/` with `--reporter=json --outputFile=.benchmarks/main.json`
2. Commits `.benchmarks/main.json` to the repo

The JSON structure from vitest's JSON reporter captures test results (pass/fail, duration) per test. This is sufficient for Phase 78's `--compare` regression detection (comparing test durations between commits).

**Alternative:** Hand-author the `.benchmarks/main.json` from Phase 74 BOTTLENECKS.md numbers in a simple schema:
```json
{
  "generated": "2026-03-11",
  "phase": "74",
  "measurements": {
    "sql_group_by_folder_card_type_20k_p99_ms": 24.93,
    "sql_strftime_month_20k_p99_ms": 20.64,
    "sql_group_by_status_20k_p99_ms": 1.87,
    "sql_fts_3word_20k_p99_ms": 1.70,
    "etl_apple_notes_20k_ms": 182,
    "etl_csv_20k_ms": 767,
    "etl_json_20k_ms": 1771,
    "etl_markdown_20k_ms": 1059,
    "render_single_20k_jsdom_p99_ms": 37.8,
    "render_dual_5k_jsdom_p99_ms": 506.0,
    "render_triple_20k_jsdom_p99_ms": 259.4
  }
}
```

The hand-authored approach is more reliable for Phase 75 because the vitest reporter JSON output format may not capture what Phase 78 needs. The custom schema can be exactly designed for regression comparison.

---

## Test Failure Strategy

For the assertions to be "red" today and "green" after Phase 76/77, the thresholds must be set **tighter than current baselines**:

| Assertion | Current | Budget | Status Today |
|-----------|---------|--------|-------------|
| GROUP BY folder+card_type 20K p99 | 24.93ms | 12ms | FAIL (red) |
| GROUP BY strftime 20K p99 | 20.64ms | 10ms | FAIL (red) |
| GROUP BY status 20K p99 | 1.87ms | 5ms | PASS (already green) |
| FTS search 20K p99 | 1.70ms | 5ms | PASS (already green) |
| ETL json 20K | 1,771ms | 1,000ms | FAIL (red) |
| ETL markdown 20K | 1,059ms | 1,000ms | FAIL (red) |
| ETL csv 20K | 767ms | 1,000ms | PASS (already green) |
| ETL apple_notes 20K | 182ms | 1,000ms | PASS (already green) |
| Render dual 5K jsdom | 506ms | 128ms | FAIL (red) |
| Render single 20K jsdom | 37.8ms | 128ms | PASS (already green) |
| Render triple 20K jsdom | 259.4ms | 128ms | FAIL (red) |

The tests that are already green (status query, FTS, csv, apple_notes, single render) confirm the harness works. The failing tests define Phase 76/77's acceptance criteria.

---

## File Structure to Create

```
src/profiling/PerfBudget.ts          (new — budget constants)
tests/profiling/budget.test.ts       (new — failing assertions, it() format, node env)
tests/profiling/budget-render.test.ts (new — render assertions, jsdom env)
.benchmarks/main.json                (new — committed baseline from Phase 74 data)
```

Plus a new npm script in `package.json`:
```json
"bench:budgets": "vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts"
```

---

## Key Constraints and Gotchas

1. **vitest bench() empty samples bug**: Do NOT put `expect()` inside `bench()` blocks. Use `it()` tests for assertions. `bench()` blocks remain as throughput documentation only.

2. **jsdom render factor**: The 16ms render budget applies to Chrome. jsdom timings are 5–10x higher. Use `BUDGET_RENDER_JSDOM_MS = 128` (= 16 × 8) for jsdom assertions. Document this factor clearly in test comments.

3. **Single shared DB for ETL benches**: From 74-02 decision — never instantiate multiple `new SQL.Database()` in the same worker process. ETL budget tests must use the single shared DB pattern from `etl-import.bench.ts`.

4. **Launch + heap budgets**: Define the constants in `PerfBudget.ts` but **do not write vitest assertions** for launch (<3s) or heap (<150MB). These require physical device + Xcode Instruments (Phase 77). Add `// TODO Phase 77` comments.

5. **`--compare` flag**: The vitest `--compare` flag works with the JSON output from `vitest bench --outputJson`. Since bench files have the empty-samples bug, Phase 78 will need to define its own comparison strategy. The `.benchmarks/main.json` committed in Phase 75 uses a hand-authored schema, not vitest's native bench JSON. Document this decision.

6. **The `.benchmarks/` directory**: Does not yet exist. Create it with a `.gitkeep` or by committing `main.json` directly. Add `dist-analyze/` exclusion already exists in `.gitignore` (from 74-03); verify `.benchmarks/` is NOT gitignored.

7. **Test isolation**: The SQL budget tests spin up their own `Database` instances (same as `query.bench.ts`). They do NOT share state with the render tests. Keep them in separate files to avoid the jsdom/node environment conflict (query tests = node env, render tests = jsdom env).

8. **Biome linting**: All new `.ts` files must pass `biome check`. No unused variables, no `any` without comment, consistent with existing profiling file style.

---

## Plan Outline (for planner to refine)

**Plan 75-01: PerfBudget.ts + SQL query budget assertions (node env)**
- Create `src/profiling/PerfBudget.ts` with all budget constants
- Create `tests/profiling/budget.test.ts` (node env) with SQL query timing assertions
- Run tests — confirm GROUP BY folder+card_type and strftime assertions fail, status/FTS pass
- Add `bench:budgets` npm script

**Plan 75-02: Render budget assertions (jsdom env) + baseline JSON**
- Create `tests/profiling/budget-render.test.ts` (jsdom env) with render timing assertions
- Run tests — confirm dual-axis and triple-axis assertions fail, single-axis passes
- Create `.benchmarks/main.json` from Phase 74 BOTTLENECKS.md data
- Commit `.benchmarks/main.json`

**Total estimate:** 2 plans, ~30–45 min combined.

---

## Files to Read at Plan Time

- `/Users/mshaler/Developer/Projects/Isometry/tests/profiling/query.bench.ts` — SQL bench pattern (copy for budget test setup)
- `/Users/mshaler/Developer/Projects/Isometry/tests/profiling/render-timing.test.ts` — render timing it() pattern (copy for budget-render test)
- `/Users/mshaler/Developer/Projects/Isometry/tests/profiling/etl-smoke.bench.ts` — ETL timing it() pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/profiling/PerfTrace.ts` — existing profiling module (sibling to new PerfBudget.ts)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/phases/74-baseline-profiling-instrumentation/BOTTLENECKS.md` — source of truth for all budget numbers
- `/Users/mshaler/Developer/Projects/Isometry/vitest.config.ts` — confirm pool/environment settings before writing new test files
- `/Users/mshaler/Developer/Projects/Isometry/package.json` — to add `bench:budgets` script

---

*Research completed: 2026-03-11*
*Researcher: gsd-phase-researcher*
