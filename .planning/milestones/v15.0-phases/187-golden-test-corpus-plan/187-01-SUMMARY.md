---
phase: 187-golden-test-corpus-plan
plan: 01
subsystem: testing
tags: [golden-tests, sql, vitest, formulas-explorer, marks, audits, tdd]

# Dependency graph
requires:
  - phase: 182-three-explorer-boundary-spec
    provides: Formulas/Marks/Audits boundary definitions and DSL chip categories
  - phase: 184-compilation-pipeline
    provides: 10 worked examples with expected SQL forming corpus backbone
  - phase: 185-formula-card-schema
    provides: formula_cards schema and card_type values
  - phase: 183-chip-well-geometry-contract
    provides: ChipWellOutputContract shape for chipArrangement test inputs

provides:
  - 04-golden-test-plan.md: Golden-test corpus specification with 50-row fixture SQL and 32 test cases
  - Fixture dataset: 50 hand-curated cards rows spanning all 5 card_type values with test-readable IDs
  - Test corpus: 32 named test cases covering Formulas, Marks, Audits in isolation and combination
  - Test runner architecture: tests/golden/ directory, test.each(), realDb() integration pattern
  - Anti-patching policy: v6.1-consistent rules with explicit CC prohibition

affects:
  - 188-chip-well-output-contract-spec
  - future FormulasProvider implementation milestones
  - TDD-driven implementation of FormulasProvider.compile(), annotateMarks(), annotateAudits()

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Golden corpus: single parameterized test.each() file with GoldenTestCase[] array"
    - "Fixture SQL loaded via loadGoldenFixture() on top of realDb() schema"
    - "SQL comparison: collapse whitespace → trim → exact string ==="
    - "Annotation comparison: convert Map to sorted [rowId, value] entries → deep-equal"
    - "Anti-patching: corpus assertions immutable; fix implementation or escalate (never weaken)"

key-files:
  created:
    - .planning/milestones/v15.0-formulas-explorer/04-golden-test-plan.md
  modified: []

key-decisions:
  - "50-row fixture uses INSERT INTO only (no CREATE TABLE) — realDb() provides schema, fixture adds data on top"
  - "test.each() single parameterized file pattern — adding test case = adding object to CORPUS array"
  - "Marks/Audits cases include expected annotation Map entries keyed by specific fixture row IDs"
  - "orderSensitive: boolean — determines whether result rows are sorted before deep-equal comparison"
  - "NULL predicate column behavior explicitly tested: NULL → chip skipped, row still in Map with []"

patterns-established:
  - "Anti-patching pattern: assertions are ground truth; failing implementation must be fixed, never the assertion"
  - "Annotation invariant pattern: Map.size === rows.length always asserted for Marks (FE-RG-07) and Audits (FE-RG-08)"
  - "Fixture naming pattern: {scenario-family}-{role} kebab-case IDs document row purpose inline"

requirements-completed: [TEST-01, TEST-02, TEST-03, TEST-04]

# Metrics
duration: 25min
completed: 2026-04-27
---

# Phase 187 Plan 01: Golden-Test Corpus Plan Summary

**50-row SQL fixture + 32 corpus cases spec for Formulas/Marks/Audits TDD — covering full compile → execute → annotate pipeline including NULL handling, cycle detection, and annotation invariants**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-27T00:37:45Z
- **Completed:** 2026-04-27T01:02:00Z
- **Tasks:** 1
- **Files modified:** 1 (created)

## Accomplishments

- Created `04-golden-test-plan.md` in `.planning/milestones/v15.0-formulas-explorer/` — authoritative spec for the golden-test corpus
- Wrote 50 hand-curated fixture rows as standalone SQL (`golden-corpus.sql` content) spanning all 5 `card_type` values (`note`, `task`, `event`, `resource`, `person`) with test-readable IDs in 9 scenario families
- Defined 32 named test cases: 10 backbone cases from `02-compilation-pipeline.md` examples + 22 additional covering Formulas (calculations/filters/sorts combos), Marks (class assignment, multi-mark, NULL handling, empty results), Audits (anomaly + validation rules), and cross-category scenarios
- Specified test runner architecture: `tests/golden/fixtures/golden-corpus.sql`, single `corpus.test.ts` using Vitest `test.each()`, `loadGoldenFixture()` on top of `realDb()`, assertion strategies (whitespace-normalized SQL comparison, sorted deep-equal for rows, Map → sorted entries for annotations)
- Documented anti-patching policy with 5 explicit rules including CC-specific prohibition

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the golden-test corpus plan specification** - `8fcc705a` (feat)

## Files Created/Modified

- `.planning/milestones/v15.0-formulas-explorer/04-golden-test-plan.md` - Complete golden-test corpus specification: fixture SQL, 32 test cases, test runner architecture, anti-patching policy

## Decisions Made

- Used `card_type` (not `node_type`) in all fixture and test case SQL — fixture schema is authoritative per D-02; `node_type` was the legacy column name referenced in compilation pipeline examples but `SeedCard` interface uses `card_type`
- 50 fixture rows organized into 9 scenario families (calc, filter, sort, mark, audit, cross, edge, bulk, window) so the purpose of each row is immediately clear from its ID prefix
- `beforeAll` (not `beforeEach`) for fixture loading — the golden corpus fixture is read-only; test mutation scenarios use separate `realDb()` instances
- `orderSensitive: boolean` field per test case — true for cases with ORDER BY where row order is the assertion, false for unordered result sets where ID-sort normalization is applied before deep-equal
- `chipErrors?: []` field on `GoldenTestCase` for chip-scoped error cases (Case 22) to distinguish from overall pipeline errors (`errorExpected`)

## Deviations from Plan

None — plan executed exactly as written. All sections (Fixture Dataset, Test Corpus, Test Runner Architecture, Anti-Patching Policy) completed per specification. All acceptance criteria pass:

- `grep -c "INSERT INTO"` = 50 (requirement: 40+)
- `grep -c "expectedSql"` = 38 (requirement: 25+)
- `grep -c "anti-patching"` = 5 (requirement: 1+)
- `grep -c "never weaken"` = 6 (requirement: 1+)
- All other grep checks pass: test.each, realDb, ChipWellOutputContract, Map<rowId, CycleError, tests/golden/, card_type

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This phase is specification only; no code ships.

## Next Phase Readiness

- `04-golden-test-plan.md` is authoritative — Phase 188 (WA-5) chip-well output contract spec can proceed
- Future implementation milestones can start TDD immediately using this corpus as the test target
- `FormulasProvider.compile()`, `annotateMarks()`, `annotateAudits()` implementations should be TDD-driven against the 32 corpus cases
- Implementation must extract `tests/golden/fixtures/golden-corpus.sql` from §1 and create `tests/golden/corpus.test.ts` per §3 architecture

## Self-Check: PASSED

- `.planning/milestones/v15.0-formulas-explorer/04-golden-test-plan.md` — FOUND
- Commit `8fcc705a` — FOUND

---
*Phase: 187-golden-test-corpus-plan*
*Completed: 2026-04-27*
