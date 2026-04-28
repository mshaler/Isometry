# Phase 187: Golden-Test Corpus Plan - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 187-golden-test-corpus-plan
**Areas discussed:** Fixture dataset design, Corpus coverage strategy, Test file organization, Expected-result format

---

## Fixture Dataset Design

### Q1: How should the fixture dataset be structured?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated by hand | Each of ~50 nodes hand-picked to serve specific test cases. Named with test-readable IDs. | ✓ |
| Generated from rules | Generator script produces nodes from distribution rules. Easier to scale but harder to trace. | |
| Hybrid: curated core + generated filler | ~30 hand-curated + ~20 generated filler. | |

**User's choice:** Curated by hand
**Notes:** Maximum control, every row has a purpose.

### Q2: Should the fixture be delivered as raw SQL or TypeScript array?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL file | Standalone .sql file with CREATE TABLE + INSERTs. Runs in sqlite3 directly. | ✓ |
| TypeScript array + seedCards() | Fixture as TS constant array fed to seedCards(). | |
| Both: SQL source of truth, TS re-exports | SQL canonical, thin TS wrapper reads/re-exports. | |

**User's choice:** SQL file
**Notes:** Matches handoff success criterion: "fixture dataset SQL is provided and runs cleanly."

### Q3: Should the fixture include connections?

| Option | Description | Selected |
|--------|-------------|----------|
| Cards only | Pipeline operates on cards table. Connections not referenced by compilation examples. | ✓ |
| Cards + a few connections | Include 5-10 connections for edge cases. | |

**User's choice:** Cards only
**Notes:** Focused on what the compilation pipeline actually touches.

---

## Corpus Coverage Strategy

### Q4: Should Phase 184's 10 worked examples be the backbone?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — 10 + ~20 | 10 from Phase 184 become first 10 corpus cases. ~20 additional fill gaps. | ✓ |
| Fresh corpus, independent of 184 | Design all ~30 from scratch. | |
| 184 as subset, target 40+ total | Start with 10, add 30+ for ~40 total. | |

**User's choice:** Yes — 10 + ~20
**Notes:** No redundant work. Expected SQL already hand-written in Phase 184.

### Q5: How should the ~20 additional cases be distributed?

| Option | Description | Selected |
|--------|-------------|----------|
| Even spread | ~6 Formulas, ~6 Marks, ~4 Audits, ~4 cross-category. | ✓ |
| Edge-case heavy | Focus the ~20 on edge cases (cycles, type mismatches, NULLs, etc.). | |
| You decide | Claude determines optimal distribution. | |

**User's choice:** Even spread
**Notes:** Balanced coverage across all three explorer categories.

### Q6: Should test cases include Marks/Audits annotation results?

| Option | Description | Selected |
|--------|-------------|----------|
| SQL + annotation results | Marks and Audits cases include expected annotation maps. Full pipeline testing. | ✓ |
| SQL only, annotations deferred | All ~30 cases verify expected SQL only. Annotation testing separate. | |

**User's choice:** SQL + annotation results
**Notes:** Tests the full compile → execute → annotate path.

---

## Test File Organization

### Q7: Where should golden-test corpus files live?

| Option | Description | Selected |
|--------|-------------|----------|
| tests/golden/ | New top-level directory alongside tests/harness/ and tests/seams/. | ✓ |
| tests/seams/formulas/ | Under existing seams/ directory. | |
| tests/formulas/golden/ | Feature-scoped directory. | |

**User's choice:** tests/golden/
**Notes:** Clear separation — golden corpus is its own testing tier.

### Q8: How should ~30 test cases be organized within tests/golden/?

| Option | Description | Selected |
|--------|-------------|----------|
| Single parameterized suite | One test file with test case array. Vitest test.each() iterates. | ✓ |
| One file per category | Three test files (formulas, marks, audits) + cross-category. | |
| One file per case | Each test case its own file. 30+ files. | |

**User's choice:** Single parameterized suite
**Notes:** Adding a case = adding an object. Clean and extensible.

---

## Expected-Result Format

### Q9: How should expected SQL be compared?

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized string match | Collapse whitespace, trim, exact string compare. | ✓ |
| Structural/AST comparison | Parse SQL into AST, compare structurally. Requires parser dep. | |
| Substring + pattern match | Assert key clauses present without exact match. | |

**User's choice:** Normalized string match
**Notes:** Deterministic, catches any SQL change.

### Q10: How should expected result sets be compared?

| Option | Description | Selected |
|--------|-------------|----------|
| Exact row match, order-insensitive | Full array of row objects, sorted by stable key, deep-equals. Order-sensitive when ORDER BY present. | ✓ |
| Row count + spot checks | Assert count, check 2-3 specific rows. | |
| Vitest snapshots | toMatchSnapshot(). Opaque, easy to update blindly. | |

**User's choice:** Exact row match, order-insensitive
**Notes:** Strong assertions aligned with anti-patching philosophy. No snapshots.

---

## Claude's Discretion

- Exact selection and naming of ~50 fixture nodes
- Specific edge cases for the ~20 additional corpus cases (within even-spread allocation)
- Internal document structure of 04-golden-test-plan.md
- Helper function design for loading fixture SQL into realDb()

## Deferred Ideas

None — discussion stayed within phase scope.
