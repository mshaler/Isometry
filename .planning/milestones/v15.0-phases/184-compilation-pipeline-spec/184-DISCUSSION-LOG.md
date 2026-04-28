# Phase 184: Compilation Pipeline Spec - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 184-compilation-pipeline-spec
**Areas discussed:** Worked Examples Selection, Explain Panel Display Format, Marks/Audits Annotation Depth, Relationship to Existing FilterProvider.compile()

---

## Worked Examples Selection

### Q1: Column naming convention

| Option | Description | Selected |
|--------|-------------|----------|
| Real schema columns | Uses name, node_type, source, created_at, folder_l1, etc. from actual cards table | ✓ |
| Abstract/generic columns | Uses revenue, cost, region, etc. like a textbook | |
| You decide | Claude picks whatever serves clarity best per example | |

**User's choice:** Real schema columns
**Notes:** Grounds examples in the actual data model and makes them immediately verifiable against the existing database.

### Q2: Scenario selection (10 examples)

| Option | Description | Selected |
|--------|-------------|----------|
| Enumerated 10-scenario set | Single calc, single filter, single sort, multi-filter, multi-sort, calc+filter combo, aggregation w/ GROUP BY from view, window function, cross-category (Filtered Totals), cycle error | ✓ |

**User's choice:** All 10 as enumerated — accepted without modification.
**Notes:** User confirmed the full set covers the range they care about.

---

## Explain Panel Display Format

| Option | Description | Selected |
|--------|-------------|----------|
| Raw SQL with `?` placeholders | Show the literal (sql_text, [bind_values]) tuple the compiler produces | ✓ |
| Formatted SQL with named placeholders + values sidebar | Show WHERE node_type = :filter_1 with bind-value table alongside | |
| You decide | Claude picks the format | |

**User's choice:** Raw SQL with `?` placeholders
**Notes:** Matches what the compiler actually produces. No additional naming convention needed.

---

## Marks/Audits Annotation Algorithm Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Pseudocode with explicit iteration | Loop over result set, evaluate predicates, accumulate Map. Includes null handling, error handling, filtering prohibition. | ✓ |
| Prose-level description | States the contract (input → output) with prohibition, leaves mechanics to implementer | |
| You decide | Claude picks the depth | |

**User's choice:** Pseudocode with explicit iteration
**Notes:** Makes the spec unambiguous for implementers. Includes null handling and error handling.

---

## Relationship to Existing FilterProvider.compile()

| Option | Description | Selected |
|--------|-------------|----------|
| Explicitly reference as structural precedent | Spec names FilterProvider.compile() and QueryBuilder, states FormulasProvider follows same (sql, params) tuple shape, notes extensions | ✓ |
| Define independently, note the parallel | Spec defines pipeline on its own terms with brief note about existing pattern | |
| You decide | Claude picks the approach | |

**User's choice:** Explicitly reference as structural precedent
**Notes:** Gives implementers a concrete anchor. Spec states where new pipeline extends the existing pattern (dependency graph, post-query annotation).

---

## Claude's Discretion

- Internal document structure (heading order, section breaks)
- Pseudocode style and notation
- Edge case enumeration depth beyond decided areas

## Deferred Ideas

None — discussion stayed within phase scope.
