# Phase 78: Regression Guard + CI Integration - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a 4th GitHub Actions job that runs performance budget tests on every push, compares against committed PerfBudget.ts constants, and prevents future regressions from shipping. Document all performance contracts in PROJECT.md so future phases know what they must not regress.

</domain>

<decisions>
## Implementation Decisions

### CI bench job design
- Run `bench:budgets` npm script (budget.test.ts + budget-render.test.ts) — budget tests only, not full profiling suite
- Trigger on every push to any branch (matches existing 3-job pattern)
- No CI artifact upload — pass/fail is sufficient; PerfBudget.ts constants are the historical record
- 5-minute timeout (budget tests are ~30s; generous headroom for CI variance)
- Standard vitest output for failures (expected/actual assertions) — no custom reporting

### Baseline comparison strategy
- PerfBudget.ts inline constants ARE the committed baselines — no separate baseline JSON needed
- RGRD-03 is satisfied by PerfBudget.ts constants with documented measured values in comments
- Thresholds are CI-relative: jsdom overhead factors are baked into the constants (e.g., 16ms Chrome × 8x = 128ms jsdom)
- Document the "relative to environment" design in PROJECT.md performance contracts section

### Gate enforcement policy
- Start with `continue-on-error: true` (soft gate)
- Promote to blocking after 3 consecutive green CI runs confirm variance is within budget headroom
- Promotion is a manual one-line change: flip `continue-on-error: true` to `false` in ci.yml
- No PR label or override mechanism — if benchmarks fail, fix the regression or update the budget
- Document the promotion step in PROJECT.md

### Performance contracts
- Document ALL 4 categories: render budgets, SQL query budgets, ETL import throughput, memory/launch baselines
- Format: markdown table with columns: Path | Measured Baseline | CI Budget | Chrome Est. | Source constant
- Include Chrome estimates alongside CI/jsdom numbers (jsdom/10x factor from PerfBudget.ts comments)
- Place as new top-level `## Performance Contracts` section in PROJECT.md, after Key Decisions
- Cross-reference PerfBudget.ts as canonical source of truth

### Claude's Discretion
- Exact job ordering in ci.yml (whether bench runs parallel to or after test)
- Whether to add `needs: [test]` dependency on the bench job
- Exact wording of the promotion documentation

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PerfBudget.ts`: All budget constants already defined with overhead factors and baseline comments
- `budget.test.ts` + `budget-render.test.ts`: Assertion tests against PerfBudget constants — ready to run in CI as-is
- `bench:budgets` npm script: Already defined in package.json, runs both budget test files
- `.github/workflows/ci.yml`: 3-job CI (typecheck, lint, test) — pattern to follow for 4th job

### Established Patterns
- CI jobs: ubuntu-latest, Node 22, `npm ci`, then a single command
- Budget constants: exported from PerfBudget.ts with inline comments documenting Phase 74-77 measurements
- jsdom overhead: 8x for standard, 10-15x for DOM-heavy (documented in PerfBudget.ts comments)

### Integration Points
- `.github/workflows/ci.yml`: Add 4th `bench` job following existing job pattern
- `PROJECT.md`: Add `## Performance Contracts` section with table of all budgets
- `PerfBudget.ts`: Source of truth — contracts table references these constants

</code_context>

<specifics>
## Specific Ideas

- Promotion step should be explicitly documented: "After 3 green runs, change `continue-on-error: true` to `false` in ci.yml"
- The contracts table should show the gap between measured baseline and budget — helps future phases see where headroom exists
- RGRD-03 ("Baseline JSON committed") is satisfied by PerfBudget.ts with documented measurements — no separate .json file needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 78-regression-guard-ci-integration*
*Context gathered: 2026-03-12*
