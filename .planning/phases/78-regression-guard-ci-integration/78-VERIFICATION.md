---
phase: 78-regression-guard-ci-integration
verified: 2026-03-13T00:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: null
gaps: []
human_verification: []
---

# Phase 78: Regression Guard CI Integration Verification Report

**Phase Goal:** Every critical performance path is protected by an automated CI gate that prevents future regressions from shipping undetected
**Verified:** 2026-03-13
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CI bench job exists and runs budget tests on every push | VERIFIED | `.github/workflows/ci.yml` has a `bench` job triggered on `push: branches: ['**']` running `npm run bench:budgets` |
| 2 | Bench job is a soft gate with documented promotion path | VERIFIED | `continue-on-error: true` at job level; YAML comment above it reads: "SOFT GATE: flip to `false` after 3 consecutive green runs on main. See PROJECT.md Performance Contracts for promotion procedure." |
| 3 | Budget tests are substantive (real assertions, not stubs) | VERIFIED | `budget.test.ts` (8 assertions: 4 SQL query + 4 ETL import) and `budget-render.test.ts` (3 assertions: single/dual/triple axis) — all use real DB operations and imported constants from `PerfBudget.ts` |
| 4 | All budget test constants in PerfBudget.ts are correct and complete | VERIFIED | 9 exported constants including newly added `BUDGET_RENDER_TRIPLE_JSDOM_MS=240` with Phase 78-01 measurement rationale |
| 5 | SQLiteWriter batchSize=1000 promoted to production default | VERIFIED | `SQLiteWriter.ts` line 15: `const BATCH_SIZE = 1000`; constructor `private batchSize = BATCH_SIZE`; test confirms default is 1000 (single batch for 1000 cards) |
| 6 | Performance Contracts documented in PROJECT.md | VERIFIED | `## Performance Contracts` section exists after `## Key Decisions` with all 4 categories, locked table format, promotion procedure, and device-only memory/launch note |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | 4-job CI (typecheck, lint, test, bench) | VERIFIED | Exactly 4 jobs; `bench` has `timeout-minutes: 5`, `continue-on-error: true`, runs `npm run bench:budgets`, no `needs:` dependency |
| `src/profiling/PerfBudget.ts` | Budget constants including new TRIPLE constant | VERIFIED | 9 constants exported; `BUDGET_RENDER_TRIPLE_JSDOM_MS = 16 * 15` (240ms) added with Phase 78-01 measurement block |
| `src/etl/SQLiteWriter.ts` | batchSize=1000 as production default | VERIFIED | `BATCH_SIZE = 1000` constant; constructor default uses the constant |
| `tests/profiling/budget.test.ts` | SQL + ETL budget assertions | VERIFIED | 8 real assertions using live DB with 20K cards seeded via `seedDatabase()` |
| `tests/profiling/budget-render.test.ts` | Render budget assertions including triple-axis | VERIFIED | 3 assertions; triple-axis test now imports and uses `BUDGET_RENDER_TRIPLE_JSDOM_MS` |
| `.planning/PROJECT.md` | Performance Contracts section | VERIFIED | Section present after `## Key Decisions`; all 4 categories with correct table format |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `bench` CI job | `npm run bench:budgets` | `run: npm run bench:budgets` step | WIRED | Step in ci.yml runs the exact npm script |
| `bench:budgets` script | `budget.test.ts` + `budget-render.test.ts` | `package.json` `bench:budgets` field | WIRED | Script runs `vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts` |
| `budget.test.ts` | `PerfBudget.ts` constants | named imports at top of file | WIRED | Imports `BUDGET_ETL_20K_MS`, `BUDGET_QUERY_FTS_20K_MS`, `BUDGET_QUERY_GROUP_BY_20K_MS`, `BUDGET_QUERY_STATUS_20K_MS`, `BUDGET_QUERY_STRFTIME_20K_MS` |
| `budget-render.test.ts` | `PerfBudget.ts` constants | named imports at top of file | WIRED | Imports `BUDGET_RENDER_DUAL_JSDOM_MS`, `BUDGET_RENDER_JSDOM_MS`, `BUDGET_RENDER_TRIPLE_JSDOM_MS` |
| `SQLiteWriter.ts` | `BATCH_SIZE=1000` constant | constructor default parameter | WIRED | `constructor(private db: Database, private batchSize = BATCH_SIZE)` |
| PROJECT.md | ci.yml bench job | cross-reference paragraph | WIRED | "The bench job is defined in `.github/workflows/ci.yml` under the `bench` job." |
| PROJECT.md | PerfBudget.ts | cross-reference paragraph | WIRED | "The canonical source of truth is `src/profiling/PerfBudget.ts`." |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| RGRD-02 | 78-01, 78-02 | CI benchmark job added to GitHub Actions with relative thresholds | SATISFIED | `bench` job in `ci.yml` runs budget tests with PerfBudget.ts constants as thresholds |
| RGRD-04 | 78-01, 78-02 | CI bench job starts as continue-on-error, promoted to blocking after calibration | SATISFIED | `continue-on-error: true` in ci.yml; promotion procedure documented in both the YAML comment and PROJECT.md Performance Contracts section |

**Orphaned requirements check:** REQUIREMENTS.md maps RGRD-01 to Phase 75 and RGRD-03 to Phase 75. Neither appears in Phase 78 plans — this is correct, no orphans for Phase 78.

### Anti-Patterns Found

No blockers or warnings found. Scanned all 5 modified files:

- `.github/workflows/ci.yml` — clean YAML, proper job structure
- `src/profiling/PerfBudget.ts` — new constant has full measurement rationale comment, no TODOs
- `src/etl/SQLiteWriter.ts` — `BATCH_SIZE` constant well-documented with Phase 77-01 rationale
- `tests/profiling/budget-render.test.ts` — triple-axis test uses real timing loop (not stub), real assertions
- `tests/etl/SQLiteWriter.test.ts` — default batchSize test is a real assertion verifying batch boundary counts

One minor observation (not a blocker): The comment block at the top of `budget.test.ts` still says "Some tests FAIL intentionally today" for GROUP BY and strftime queries — these were the Phase 75 TDD red-step comments. After Phase 76/77 optimizations those tests now pass. The comments are stale documentation but do not affect correctness.

### Human Verification Required

None — all automated checks passed. The soft gate promotion itself (flipping `continue-on-error` to `false` after 3 green CI runs on main) is an intentional deferred human action, not a gap.

### Gaps Summary

No gaps. All six must-haves are fully verified:

1. The `bench` CI job exists with correct configuration (timeout, soft gate, promotion comment, parallel execution).
2. `bench:budgets` npm script runs exactly the two budget test files.
3. Both budget test files contain real, substantive assertions (11 total) against live database operations and imported budget constants.
4. `PerfBudget.ts` contains all required constants including the Phase 78-added `BUDGET_RENDER_TRIPLE_JSDOM_MS`.
5. `SQLiteWriter.ts` production default is now `BATCH_SIZE=1000` with the constant wired into the constructor.
6. `PROJECT.md` Performance Contracts section is complete and cross-references both `ci.yml` and `PerfBudget.ts`.

Commits `2b1742e4`, `135b0d44`, and `99eccf94` all exist in git history and correspond to the documented changes.

---

_Verified: 2026-03-13_
_Verifier: Claude (gsd-verifier)_
