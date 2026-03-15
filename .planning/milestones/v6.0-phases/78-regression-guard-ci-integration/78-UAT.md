---
status: testing
phase: 78-regression-guard-ci-integration
source: 78-01-SUMMARY.md, 78-02-SUMMARY.md
started: 2026-03-12T23:10:00Z
updated: 2026-03-12T23:10:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

number: 1
name: CI Bench Job Exists
expected: |
  `.github/workflows/ci.yml` contains a 4th job named `bench` that runs `npm run bench:budgets` with `continue-on-error: true` and `timeout-minutes: 5`. It runs in parallel (no `needs:` dependency on other jobs).
awaiting: user response

## Tests

### 1. CI Bench Job Exists
expected: `.github/workflows/ci.yml` contains a 4th job named `bench` that runs `npm run bench:budgets` with `continue-on-error: true` and `timeout-minutes: 5`, running in parallel with other jobs.
result: [pending]

### 2. Bench Budgets Pass Locally
expected: Running `npm run bench:budgets` completes with all 11 assertions passing (3 render + 8 SQL/ETL budget tests).
result: [pending]

### 3. SQLiteWriter batchSize=1000 Default
expected: `src/etl/SQLiteWriter.ts` uses `BATCH_SIZE = 1000` as the production default constant, and the constructor defaults to this constant.
result: [pending]

### 4. Triple-Axis Render Budget Constant
expected: `src/profiling/PerfBudget.ts` exports `BUDGET_RENDER_TRIPLE_JSDOM_MS = 240` with a measurement rationale comment.
result: [pending]

### 5. Performance Contracts in PROJECT.md
expected: `.planning/PROJECT.md` has a `## Performance Contracts` section with 4 budget category tables (Render, SQL Query, ETL Import, Memory/Launch), each with columns: Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant.
result: [pending]

### 6. Promotion Procedure Documented
expected: Both `ci.yml` (YAML comment) and `PROJECT.md` document the promotion procedure: flip `continue-on-error` to `false` after 3 consecutive green runs on main.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0

## Gaps

[none yet]
