# Phase 187: Golden-Test Corpus Plan - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the fixture dataset, test case corpus (~30 cases), test runner architecture, and anti-patching policy for DSL/SQL correctness testing of the Formulas/Marks/Audits compilation pipeline. Deliverable is `04-golden-test-plan.md` — a spec document, no code. All outputs land in `.planning/milestones/v15.0-formulas-explorer/`.

</domain>

<decisions>
## Implementation Decisions

### Fixture Dataset Design
- **D-01:** Hand-curated fixture — each of the ~50 nodes is deliberately chosen to serve specific test cases. Named with test-readable IDs (e.g., `calc-dep-a`, `filter-null-source`). Every row has a documented purpose.
- **D-02:** Fixture delivered as a standalone `.sql` file (CREATE TABLE + INSERTs) that runs cleanly in `sqlite3 :memory:`. SQL is source of truth — matches the handoff success criterion.
- **D-03:** Cards only — no connections in the fixture. The Formulas/Marks/Audits pipeline operates on the cards table (SELECT/WHERE/ORDER BY on card columns). Connections aren't referenced by any compilation example.

### Corpus Coverage Strategy
- **D-04:** Phase 184's 10 worked compilation examples form the backbone of the corpus (expected SQL already hand-written). The remaining ~20 cases fill combination and edge-case gaps. No redundant re-derivation.
- **D-05:** Even distribution for the ~20 additional cases: ~6 Formulas-focused (isolation + combos), ~6 Marks-focused (class assignment, multi-mark, conditional), ~4 Audits-focused (validation, anomaly), ~4 cross-category (all three interacting, error cases).
- **D-06:** Full pipeline testing — Marks and Audits cases include expected annotation results (`Map<rowId, string[]>`) alongside expected SQL. Tests the complete compile → execute → annotate path.

### Test File Organization
- **D-07:** New `tests/golden/` top-level directory alongside `tests/harness/` and `tests/seams/`. Golden corpus is its own testing tier, not a subcategory of seams or unit tests.
- **D-08:** Fixture SQL lives in `tests/golden/fixtures/`.
- **D-09:** Single parameterized suite — one test file (e.g., `corpus.test.ts`) with a test case array. Each case is a data object `{ name, chipArrangement, expectedSql, expectedResult }`. Vitest `test.each()` iterates. Adding a case = adding an object.

### Expected-Result Format
- **D-10:** Normalized string match for SQL comparison — collapse whitespace runs, trim, then exact string compare. Deterministic and catches any SQL change.
- **D-11:** Exact row match for result sets — expected result is a full array of row objects. Assertion sorts both arrays by a stable key then deep-equals. Order-insensitive by default; order-sensitive when the test case includes ORDER BY.
- **D-12:** No Vitest snapshots — `toMatchSnapshot()` is opaque, easy to update blindly, and conflicts with the anti-patching rule.

### Anti-Patching Policy (Carried Forward)
- Consistent with v6.1: if a test fails, fix the spec or the implementation — never weaken the test assertion.
- Every bug fix adds a corpus case (regression guard).
- CC (Claude Code) must never weaken a corpus assertion to make a test pass.

### Claude's Discretion
- Exact selection and naming of the ~50 fixture nodes (within the constraint of hand-curation and test-readable IDs)
- Specific edge cases chosen for the ~20 additional corpus cases (within the even-spread allocation)
- Internal document structure of `04-golden-test-plan.md` (heading order, section breaks)
- Helper function design for loading the fixture SQL into `realDb()` in the test runner

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture Source (primary)
- `.planning/formulas-explorer-handoff-v2.md` §WA-4 (lines 228-246) — Defines the golden-test corpus deliverable, pre-conditions, and success criteria. This is the authoritative source for what Phase 187 produces.

### Compilation Pipeline Spec (test targets)
- `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` — Contains the 10 worked compilation examples that form the corpus backbone. Expected SQL is already hand-written here. Also defines Marks/Audits annotation algorithms that corpus cases must exercise.

### Three-Explorer Boundary Spec (category definitions)
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — Defines which chip types belong to which explorer. Corpus cases must respect these boundaries (FE-RG guards).

### Formula Card Schema (promotion/versioning)
- `.planning/milestones/v15.0-formulas-explorer/03-formula-card-schema.md` — Schema definition for formula_cards table. Fixture SQL must be compatible. Type-signature validation cases reference this schema.

### Chip-Well Geometry Contract (input contract)
- `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — Defines ChipWellOutputContract, the seam interface consumed by the compilation pipeline. Test case `chipArrangement` objects must conform to this contract.

### Existing Test Infrastructure
- `tests/harness/realDb.ts` — In-memory sql.js database factory. Golden corpus extends this pattern.
- `tests/harness/seedCards.ts` — Card seeding helper (reference for schema columns and patterns, though golden corpus uses raw SQL).
- `.planning/codebase/TESTING.md` — Documents current test framework, conventions, and file structure.

### Requirements
- `.planning/REQUIREMENTS.md` — Requirements TEST-01 through TEST-04 define acceptance criteria for this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/harness/realDb.ts` — Creates in-memory sql.js database with real schema. Golden corpus loads fixture SQL via `db.run()` on top of this.
- `tests/harness/seedCards.ts` — Shows the card schema columns and INSERT patterns. Fixture SQL follows the same schema.
- `tests/harness/makeProviders.ts` — Wires full provider stack with PRAGMA-derived SchemaProvider. Corpus tests may need provider wiring for annotation testing.

### Established Patterns
- Vitest `test.each()` pattern used in existing parameterized tests
- `// @vitest-environment jsdom` annotation for DOM-needing tests (corpus tests should NOT need this — pure SQL/data)
- `tests/seams/` convention: cross-component integration tests named `{domain}/{concern}.test.ts`
- Pool: `forks` with `isolate: true` — each test file gets its own process (WASM isolation)

### Integration Points
- Golden corpus tests will import the future `FormulasProvider.compile()` (not yet implemented — this phase designs tests that will drive TDD of that implementation)
- Fixture SQL must produce a database compatible with `realDb()` schema (same CREATE TABLE statements)
- `ChipWellOutputContract` from Phase 183 defines the shape of `chipArrangement` test inputs

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches within the decisions above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 187-golden-test-corpus-plan*
*Context gathered: 2026-04-27*
