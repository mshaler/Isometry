# Phase 78: Regression Guard + CI Integration - Research

**Researched:** 2026-03-12
**Domain:** GitHub Actions CI configuration, Vitest budget test integration, performance contract documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**CI bench job design:**
- Run `bench:budgets` npm script (budget.test.ts + budget-render.test.ts) — budget tests only, not full profiling suite
- Trigger on every push to any branch (matches existing 3-job pattern)
- No CI artifact upload — pass/fail is sufficient; PerfBudget.ts constants are the historical record
- 5-minute timeout (budget tests are ~30s; generous headroom for CI variance)
- Standard vitest output for failures (expected/actual assertions) — no custom reporting

**Baseline comparison strategy:**
- PerfBudget.ts inline constants ARE the committed baselines — no separate baseline JSON needed
- RGRD-03 is satisfied by PerfBudget.ts constants with documented measured values in comments
- Thresholds are CI-relative: jsdom overhead factors are baked into the constants (e.g., 16ms Chrome × 8x = 128ms jsdom)
- Document the "relative to environment" design in PROJECT.md performance contracts section

**Gate enforcement policy:**
- Start with `continue-on-error: true` (soft gate)
- Promote to blocking after 3 consecutive green CI runs confirm variance is within budget headroom
- Promotion is a manual one-line change: flip `continue-on-error: true` to `false` in ci.yml
- No PR label or override mechanism — if benchmarks fail, fix the regression or update the budget
- Document the promotion step in PROJECT.md

**Performance contracts:**
- Document ALL 4 categories: render budgets, SQL query budgets, ETL import throughput, memory/launch baselines
- Format: markdown table with columns: Path | Measured Baseline | CI Budget | Chrome Est. | Source constant
- Include Chrome estimates alongside CI/jsdom numbers (jsdom/10x factor from PerfBudget.ts comments)
- Place as new top-level `## Performance Contracts` section in PROJECT.md, after Key Decisions
- Cross-reference PerfBudget.ts as canonical source of truth

**Claude's Discretion:**
- Exact job ordering in ci.yml (whether bench runs parallel to or after test)
- Whether to add `needs: [test]` dependency on the bench job
- Exact wording of the promotion documentation

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RGRD-02 | CI benchmark job added to GitHub Actions with relative thresholds | Budget tests already written and pass locally; `bench:budgets` npm script already defined; ci.yml 3-job pattern is the direct template |
| RGRD-04 | CI bench job starts as continue-on-error, promoted to blocking after calibration | GitHub Actions `continue-on-error: true` field is a single YAML boolean; promotion procedure needs explicit documentation in PROJECT.md |
</phase_requirements>

---

## Summary

Phase 78 is almost entirely configuration and documentation work, not new code. All the hard parts (budget constants in `PerfBudget.ts`, budget test files `budget.test.ts` and `budget-render.test.ts`, and the `bench:budgets` npm script) are already in place from Phases 75–77. The work is: (1) add a 4th `bench` job to `.github/workflows/ci.yml` using the exact same pattern as the existing 3 jobs, (2) add a `## Performance Contracts` section to `PROJECT.md` with a comprehensive table of all budgets across all 4 categories, and (3) document the `continue-on-error` promotion procedure so it is self-explaining to future phases.

The existing CI uses `actions/checkout@v5`, `actions/setup-node@v6` (Node 22), `npm ci`, and a single command per job — all running on `ubuntu-latest` with no cross-job dependencies. The bench job follows the same template: checkout → node setup → npm ci → `npm run bench:budgets`. The 5-minute job timeout is set via `timeout-minutes: 5` at the job level, not in the vitest command.

The `bench:budgets` script runs exactly: `vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts`. This is fast (budget tests seed 20K cards and run 50-iteration SQL measurements — approximately 30s total), and the assertions use the `PerfBudget.ts` constants which already encode jsdom overhead factors as the CI-relative thresholds. No comparison against a separate baseline JSON is needed; the constants ARE the baselines.

**Primary recommendation:** Add one 4-job ci.yml block (bench job with `continue-on-error: true`, `timeout-minutes: 5`, running `npm run bench:budgets`), then add the Performance Contracts table to PROJECT.md. No new code.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GitHub Actions | N/A | CI orchestration | Already in use — 3-job workflow exists at `.github/workflows/ci.yml` |
| Vitest | ^4.0.18 | Budget test runner | Already the project test runner; `bench:budgets` npm script already defined |
| actions/checkout | @v5 | Repo checkout | Already used in all 3 existing CI jobs |
| actions/setup-node | @v6 | Node.js setup with npm cache | Already used in `typecheck` and `test` jobs |

### No New Dependencies

This phase installs nothing. All required tools exist.

---

## Architecture Patterns

### Existing CI Job Pattern (Direct Template)

The 4th job must mirror the `test` job exactly, just running a different command:

```yaml
# Source: .github/workflows/ci.yml (existing test job pattern)
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - run: npx vitest --run
```

### Pattern 1: Bench Job (4th CI Job)

**What:** Add a `bench` job that runs budget tests with `continue-on-error: true` and `timeout-minutes: 5`.

**When to use:** Every push to any branch (same trigger as existing jobs — `on: push: branches: ['**']`).

**Example:**

```yaml
# Add after the test job in .github/workflows/ci.yml
bench:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  continue-on-error: true
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - run: npm run bench:budgets
```

**Notes:**
- `timeout-minutes` is a job-level field (not step-level) in GitHub Actions
- `continue-on-error: true` makes the bench job non-blocking — PR merge is not gated until this is flipped
- The job name `bench` is conventional; CI summary will show it alongside `typecheck`, `lint`, `test`
- Claude's discretion: whether to add `needs: [test]` — if added, bench only runs after test passes, saving CI minutes on already-failing PRs; if omitted, all 4 jobs run in parallel

### Pattern 2: Performance Contracts Table in PROJECT.md

**What:** A `## Performance Contracts` section documenting all 4 categories.

**When to use:** Placed after `## Key Decisions` in `PROJECT.md`.

**Format (per locked decisions):**

```markdown
## Performance Contracts

All budgets are enforced in CI via `npm run bench:budgets` (budget.test.ts + budget-render.test.ts).
Source of truth: `src/profiling/PerfBudget.ts`.

Thresholds are CI-relative (jsdom overhead baked in). Chrome estimates = CI budget / jsdom factor.
After 3 consecutive green CI runs, promote bench job to blocking: flip `continue-on-error: true`
to `false` in `.github/workflows/ci.yml`.

### Render Budgets

| Path | Measured Baseline (jsdom) | CI Budget | Chrome Est. | Source Constant |
|------|--------------------------|-----------|-------------|-----------------|
| single axis, 20K cards | 37.8ms p99 | 128ms | ~16ms | BUDGET_RENDER_JSDOM_MS |
| dual axis, 5K cells (50×50) | 506ms p99 → 183ms mean (post-opt) | 240ms | ~18ms | BUDGET_RENDER_DUAL_JSDOM_MS |
| triple axis, 20K cards | 259.4ms p99 | 128ms | ~16ms | BUDGET_RENDER_JSDOM_MS |

### SQL Query Budgets (20K cards, p99)

| Path | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|------|------------------|-----------|-------------|-----------------|
| GROUP BY folder, card_type | 24.93ms | 12ms | ~1.5ms | BUDGET_QUERY_GROUP_BY_20K_MS |
| GROUP BY strftime month | 20.64ms | 10ms | ~1ms | BUDGET_QUERY_STRFTIME_20K_MS |
| GROUP BY status | 1.87ms | 5ms | ~0.2ms | BUDGET_QUERY_STATUS_20K_MS |
| FTS 3-word search | 1.70ms | 5ms | ~0.2ms | BUDGET_QUERY_FTS_20K_MS |

### ETL Import Throughput (20K cards, total elapsed)

| Source | Measured Baseline | CI Budget | Chrome Est. | Source Constant |
|--------|-----------------|-----------|-------------|-----------------|
| apple_notes | 182ms | 1000ms | ~100ms | BUDGET_ETL_20K_MS |
| csv | 767ms | 1000ms | ~500ms | BUDGET_ETL_20K_MS |
| json | 1771ms → optimized | 1000ms | ~700ms | BUDGET_ETL_20K_MS |
| markdown | 1059ms → optimized | 1000ms | ~700ms | BUDGET_ETL_20K_MS |

### Memory / Launch Baselines

| Metric | Measured Baseline | Budget | Notes | Source Constant |
|--------|------------------|--------|-------|-----------------|
| Cold start (vitest) | ~26ms | 3000ms | Device target; vitest ≠ WKWebView | BUDGET_LAUNCH_COLD_MS |
| Heap steady-state | ~363MB RSS | 150MB | RSS dominated by WASM; device metric | BUDGET_HEAP_STEADY_MB |
```

### Anti-Patterns to Avoid

- **Setting `timeout` on the `run` step instead of the job:** The `timeout-minutes` field must be at the job level, not inside `steps`. Step-level `timeout-minutes` exists but is separate and less reliable for overall job capping.
- **Using `npx vitest run ...` directly instead of `npm run bench:budgets`:** The npm script is canonical. If the test files change, only the script needs updating, not ci.yml.
- **Hardcoding ms thresholds in ci.yml:** The CONTEXT.md decision explicitly bans this. The thresholds live only in `PerfBudget.ts` and are imported by the test files.
- **Uploading benchmark artifacts:** Decided against in CONTEXT.md. `PerfBudget.ts` constants ARE the historical record. Artifact upload adds complexity without benefit given how the baselines are encoded.
- **Adding `needs: [test]` without considering tradeoffs:** If bench needs test to pass first, a single flaky test blocks all benchmarks. Run in parallel to get maximum signal per CI run.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Budget threshold comparison | Custom comparison script | `PerfBudget.ts` constants imported in vitest `it()` assertions | Already done — the `expect(p99val).toBeLessThan(BUDGET_QUERY_GROUP_BY_20K_MS)` pattern is in place |
| Baseline JSON diff | A script comparing `.benchmarks/main.json` against current run | The `.benchmarks/main.json` file is documentation only (Phase 74 raw data); CI uses `PerfBudget.ts` constants, not JSON comparison | JSON diff approach has ±30-40% CI runner variance problem; constant-based approach already solves this |
| Custom CI reporter | A script that formats benchmark output | Vitest standard output — failures print expected/actual values from assertions | Standard vitest output is already human-readable; no custom reporting needed |

**Key insight:** The entire regression detection system is already built — it's just not wired to CI yet. The `bench:budgets` script already exists, the budget files already pass, the constants encode CI-relative thresholds. Phase 78 is a YAML edit plus a documentation section.

---

## Common Pitfalls

### Pitfall 1: `timeout-minutes` at Job Level vs Step Level

**What goes wrong:** Placing `timeout-minutes: 5` inside a `steps` entry instead of at the job level. The job keeps running indefinitely if a test hangs.

**Why it happens:** GitHub Actions allows `timeout-minutes` on both jobs AND individual steps. First instinct is to put it on the `run: npm run bench:budgets` step.

**How to avoid:** Place `timeout-minutes: 5` at the job level, as a sibling of `runs-on`.

**Warning signs:** ci.yml YAML that has `timeout-minutes` indented under `- name:` or `- run:`.

### Pitfall 2: `continue-on-error` Forgotten After Calibration

**What goes wrong:** The bench job stays as a soft gate indefinitely because there is no reminder or automated mechanism to promote it.

**Why it happens:** The promotion requires a manual YAML edit after 3 green runs, and that step is easy to forget.

**How to avoid:** Document the promotion procedure explicitly in the PROJECT.md `## Performance Contracts` section. Include a TODO comment in ci.yml that references the promotion procedure.

**Warning signs:** ci.yml bench job still has `continue-on-error: true` months after first green run.

### Pitfall 3: Budget Tests Running Too Slowly in CI

**What goes wrong:** The full vitest suite (3,158+ tests) runs alongside budget tests, causing CPU contention and flaky budget measurements.

**Why it happens:** If `bench:budgets` is run under the full vitest runner config without explicit file targeting, all test files may be discovered.

**How to avoid:** The `bench:budgets` script already runs exactly: `vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts` — two files only. The CI job runs `npm run bench:budgets`, which uses the pre-defined script. This is fine as-is.

**Warning signs:** CI bench job taking >3 minutes (budget tests should complete in ~30s).

### Pitfall 4: `budget-render.test.ts` Missing `@vitest-environment jsdom` in CI

**What goes wrong:** The render budget tests need jsdom. They have `// @vitest-environment jsdom` at the top. If this comment is absent or the vitest config overrides per-file environments, tests fail with JSDOM API errors.

**Why it happens:** `vitest.config.ts` sets `environment: 'node'` globally. The `// @vitest-environment jsdom` comment is the per-file override.

**How to avoid:** Do not touch the existing `@vitest-environment jsdom` directive in `budget-render.test.ts`. It works correctly today.

**Warning signs:** CI bench failures mentioning `document is not defined`.

### Pitfall 5: SQL Budget Tests Fail Due to CPU Contention in Full Suite

**What goes wrong:** STATE.md notes: "SQL budget tests fail in full-suite parallel runs due to CPU contention — pre-existing, not a Phase 76 regression."

**Why it happens:** When `npx vitest --run` runs all test files in parallel, the SQL timing tests contend for CPU with 3,158+ other tests.

**How to avoid:** The bench job runs ONLY `bench:budgets` (2 files in isolation), not `npx vitest --run`. Running in isolation prevents contention. The `test` job runs the full suite separately.

**Warning signs:** Budget test failures only in CI when running alongside full suite, but not when run via `npm run bench:budgets` directly.

---

## Code Examples

### Complete 4th Job Addition to ci.yml

```yaml
# Source: .github/workflows/ci.yml (add after test job)
bench:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  continue-on-error: true
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v6
      with:
        node-version: 22
        cache: 'npm'
    - run: npm ci
    - run: npm run bench:budgets
```

### Promotion Comment in ci.yml (Documentation)

```yaml
bench:
  runs-on: ubuntu-latest
  timeout-minutes: 5
  # SOFT GATE: flip to `false` after 3 consecutive green runs.
  # See PROJECT.md "## Performance Contracts" for promotion procedure.
  continue-on-error: true
```

### bench:budgets npm Script (Already Exists — Reference Only)

```json
"bench:budgets": "vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts"
```

### Vitest Config: Per-file jsdom Environment Override (Already in Place)

```typescript
// budget-render.test.ts — line 1
// @vitest-environment jsdom
```

This comment overrides the global `environment: 'node'` in `vitest.config.ts` for this file only.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Absolute ms thresholds (e.g., 16ms Chrome) | CI-relative constants (e.g., 128ms = 16ms × 8x jsdom) | Phase 75 | Eliminates ±30-40% CI runner variance causing false failures |
| `vitest bench()` for timing | `it()` + `performance.now()` | Phase 75 | Vitest bench v4 returns empty samples in --run mode via forks pool; `it()` pattern is stable |
| Separate baseline JSON diff | Constants in PerfBudget.ts | Phase 75 | Self-documenting; inline comments explain measured vs budget; no external tooling |
| 3-job CI (typecheck + lint + test) | 4-job CI (+ bench) | Phase 78 | Budget tests gated on every PR |

---

## Open Questions

1. **`needs: [test]` dependency on bench job**
   - What we know: Adding `needs: [test]` would make bench run sequentially after test passes, saving minutes on failing PRs; omitting it runs all 4 jobs in parallel
   - What's unclear: Which saves more total CI minutes given this project's typical PR failure patterns
   - Recommendation: Omit `needs: [test]` — run in parallel. This gives more signal per PR (bench failures visible even when other jobs fail) and matches the existing 3-job parallel pattern.

2. **Promotion timeline**
   - What we know: Promotion happens after 3 consecutive green CI runs
   - What's unclear: What counts as "consecutive" if the branch is quiet for weeks
   - Recommendation: Define "3 consecutive green runs on main" in the PROJECT.md documentation. 3 runs on main is the sensible bar — main is always stable.

---

## Validation Architecture

> Note: `workflow.nyquist_validation` is not present in `.planning/config.json`. Treating as disabled — this section documents the phase's own validation approach instead.

Phase 78 requires no new test files. The budget tests that ARE the regression guard are the validation:

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RGRD-02 | CI bench job runs on every push | Manual CI verification | Push to any branch, check Actions tab | ✅ After implementation |
| RGRD-02 | Budget tests pass with vitest assertions | Integration | `npm run bench:budgets` | ✅ `tests/profiling/budget.test.ts`, `tests/profiling/budget-render.test.ts` |
| RGRD-04 | `continue-on-error: true` is present | Code review | `grep continue-on-error .github/workflows/ci.yml` | ✅ After implementation |
| RGRD-04 | Performance Contracts section in PROJECT.md | Documentation review | Manual read | ✅ After implementation |

**Local validation:** `npm run bench:budgets` — all budget tests must pass green before CI wiring.

---

## Sources

### Primary (HIGH confidence)

- Direct file read: `.github/workflows/ci.yml` — existing 3-job pattern confirmed
- Direct file read: `src/profiling/PerfBudget.ts` — all constants with measured baselines and jsdom factors
- Direct file read: `tests/profiling/budget.test.ts` — SQL + ETL budget assertions
- Direct file read: `tests/profiling/budget-render.test.ts` — render budget assertions with `@vitest-environment jsdom`
- Direct file read: `package.json` — `bench:budgets` script confirmed at `vitest run tests/profiling/budget.test.ts tests/profiling/budget-render.test.ts`
- Direct file read: `.benchmarks/main.json` — Phase 74 measured baselines (documentation only, not used by CI)
- Direct file read: `.planning/STATE.md` — "SQL budget tests fail in full-suite parallel runs due to CPU contention" confirmed

### Secondary (MEDIUM confidence)

- GitHub Actions official docs pattern for `timeout-minutes` and `continue-on-error` — confirmed via existing working ci.yml patterns in project
- Vitest per-file environment override via `// @vitest-environment jsdom` — confirmed by existing `budget-render.test.ts` line 1

---

## Metadata

**Confidence breakdown:**
- CI job structure: HIGH — existing ci.yml is the direct template; `continue-on-error` and `timeout-minutes` are verified GitHub Actions fields
- Budget test behavior: HIGH — read the actual test files; `bench:budgets` script confirmed in package.json
- Architecture: HIGH — no new code, no new dependencies; pure configuration + documentation
- Pitfalls: HIGH — contention pitfall sourced directly from STATE.md; environment override sourced from budget-render.test.ts

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (GitHub Actions API is stable; Vitest 4.x API is stable)
