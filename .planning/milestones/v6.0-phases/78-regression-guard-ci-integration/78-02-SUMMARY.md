---
phase: 78
plan: 02
subsystem: documentation
tags: [performance, ci, documentation, contracts]
dependency_graph:
  requires: []
  provides: [performance-contracts-docs]
  affects: [PROJECT.md]
tech_stack:
  added: []
  patterns: []
key_files:
  created: []
  modified:
    - .planning/PROJECT.md
decisions:
  - "Performance Contracts section in PROJECT.md documents all 4 budget categories with locked table format"
  - "Memory/launch baselines explicitly noted as device-only, not CI-enforced"
  - "Promotion procedure: 3 consecutive green runs on main -> flip continue-on-error to false in ci.yml"
metrics:
  duration: "56 seconds"
  completed_date: "2026-03-13"
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
---

# Phase 78 Plan 02: Performance Contracts Documentation Summary

Performance contracts documentation added to PROJECT.md: all 4 budget categories with measured baselines, CI budgets, Chrome estimates, and exact PerfBudget.ts constant names, plus promotion procedure from soft gate to blocking gate.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Performance Contracts section to PROJECT.md | 99eccf94 | .planning/PROJECT.md |

## What Was Built

Added `## Performance Contracts` section to `.planning/PROJECT.md` immediately after the `## Key Decisions` section. The section covers:

1. **Header paragraph**: CI enforcement via `npm run bench:budgets`, canonical source `src/profiling/PerfBudget.ts`, jsdom overhead factor explanation, cross-reference to `.github/workflows/ci.yml`

2. **Promotion procedure**: Soft gate starts with `continue-on-error: true`; after 3 consecutive green runs on `main`, flip to `false`. No override mechanism — regressions must be fixed or budgets updated with justification.

3. **Render Budgets table** (2 rows): single axis 20K cards and dual axis 2500-cell worst case, with measured jsdom baselines, CI budgets, Chrome estimates, and `BUDGET_RENDER_JSDOM_MS` / `BUDGET_RENDER_DUAL_JSDOM_MS` constants.

4. **SQL Query Budgets table** (4 rows): GROUP BY folder+card_type, GROUP BY strftime month, GROUP BY status, FTS 3-word search — all with 20K card p99 baselines and `BUDGET_QUERY_*` constants.

5. **ETL Import Throughput table** (1 row): shared 1000ms budget across all sources, `BUDGET_ETL_20K_MS` constant.

6. **Memory / Launch Baselines table** (2 rows): cold start and heap steady-state — explicitly noted as **device-only metrics, not CI-enforced**, with `BUDGET_LAUNCH_COLD_MS` and `BUDGET_HEAP_STEADY_MB` constants.

All values were verified against `src/profiling/PerfBudget.ts` before writing. All constant names match exports exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `## Performance Contracts` section exists in PROJECT.md after `## Key Decisions`
- [x] All 4 categories documented: render, SQL query, ETL import, memory/launch
- [x] Table columns match locked format: Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant
- [x] All constant names match `src/profiling/PerfBudget.ts` exports exactly
- [x] Promotion procedure documented (3 green runs on main -> flip continue-on-error)
- [x] Memory/launch baselines noted as device-only, not CI-enforced
- [x] Commit 99eccf94 exists

## Self-Check: PASSED
