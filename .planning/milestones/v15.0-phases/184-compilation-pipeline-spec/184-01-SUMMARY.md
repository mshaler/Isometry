---
phase: 184-compilation-pipeline-spec
plan: "01"
subsystem: planning-spec
tags: [formulas-explorer, compilation-pipeline, sql, spec]
dependency_graph:
  requires:
    - 182-01 (01-three-explorer-spec.md — upstream boundary spec)
    - 183-01 (06-chip-well-geometry.md — ChipWellOutputContract input seam)
  provides:
    - 02-compilation-pipeline.md (compilation pipeline spec consumed by Phase 187 and Phase 188)
  affects:
    - Phase 187 (WA-4 golden test plan — exercises compiler via 30+ test cases)
    - Phase 188 (WA-5 UX interaction spec — explain panel UI)
tech_stack:
  added: []
  patterns:
    - Kahn's topological sort for Calculation DAG cycle detection
    - "(sql_text, [bind_values]) tuple pattern extended to SELECT + WHERE + ORDER BY"
    - CASE WHEN inline cross-category reference resolution
    - Post-query annotation passes (annotateMarks, annotateAudits) with row-membership invariant
key_files:
  created:
    - .planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md
  modified: []
decisions:
  - "CycleError.participants carries chip IDs (not column names) for chip-well UI highlighting"
  - "Cross-category Filtered Totals resolved via CASE WHEN inline (not FILTER WHERE) for sql.js compatibility"
  - "Explain panel shows raw (sql_text, [bind_values]) tuple with ? placeholders intact"
  - "Audits annotation type named AuditAnnotation with kind: anomaly | validation"
  - "Bind values in explain panel shown as flat ordered list matching sql.js positional consumption"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-27T21:43:09Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase 184 Plan 01: Compilation Pipeline Spec Summary

Wrote `02-compilation-pipeline.md` — the authoritative compilation pipeline spec formalizing chip-arrangement-to-SQL with Kahn's DAG algorithm, bind-value protocol, CASE WHEN cross-category resolution, Marks/Audits post-query annotation pseudocode, explain panel contract, and 10 worked examples using real Isometry schema columns.

## What Was Built

**File:** `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` (633 lines)

The spec covers all 10 requirements (COMP-01 through COMP-08, GARD-03, GARD-04):

| Section | Requirement | Content |
|---------|-------------|---------|
| §1 Fixed SQL Clause Order | COMP-01 | 9-row table; FormulasProvider never emits GROUP BY/HAVING/LIMIT invariant |
| §2 Dependency Graph | COMP-02 | Kahn's algorithm pseudocode; CycleError type with participants[] |
| §2.5 Cross-Category Resolution | — | CASE WHEN inline for Filtered Totals; bind value ordering by clause position |
| §3 Filters AND-Composition | — | FilterProvider.compile() structural precedent; commutativity/idempotence |
| §4 Sorts Lexicographic | — | Chip-position ordering; no bind values for structural elements |
| §5 Bind-Value Protocol | COMP-03 | ? placeholders; prohibited string concatenation with explicit NEVER label |
| §6 Calculation Allowlist | COMP-04 | SchemaProvider PRAGMA table_info() validation; compile-time not runtime |
| §7 Marks Annotation | COMP-05 | annotateMarks() pseudocode; NULL handling; markChipAsErrored(); row invariant |
| §8 Audits Annotation | COMP-06 | annotateAudits() pseudocode; AuditAnnotation type; same invariant structure |
| §9 Explain Panel | COMP-07 | Raw (sql_text, [bind_values]) tuple; ? intact; flat ordered list |
| §10 Worked Examples | COMP-08 | 10 examples: all D-02 scenarios with real columns, SQL verbatim, bind values |
| Appendix | GARD-03/04 | FE-RG-16 and FE-RG-17 with ID/statement/rationale/grep verification check |

## Decisions Made

1. **CycleError carries chip IDs** — `participants: string[]` contains chip IDs not column names, enabling chip-well UI to highlight the offending chips directly without additional lookup.

2. **CASE WHEN for cross-category references** — Resolved Filtered Totals via `SUM(CASE WHEN col = ? THEN val ELSE 0 END)` rather than `FILTER (WHERE ...)` syntax for broad sql.js compatibility. Bind value from the CASE WHEN predicate appears before the outer WHERE bind values because SELECT is assembled before WHERE.

3. **Explain panel shows raw tuple** — Per D-03: `(sql_text, [bind_values])` displayed as-is. No named placeholders, no value substitution in the SQL text, flat ordered bind array matching sql.js positional consumption.

4. **AuditAnnotation named type** — Named `AuditAnnotation` with `kind: 'anomaly' | 'validation'` (Claude's discretion per CONTEXT.md). `kind` field allows the UI to render anomaly vs. validation flags with distinct affordances without re-examining chip well origin.

5. **Bind values in explain panel as flat ordered list** — For multi-chip arrangements, shown as `['val1', 'val2', ...]` in positional order. Annotating which `?` corresponds to which value is a future UX concern.

## Deviations from Plan

None — plan executed exactly as written. The spec document contains all sections specified in the task definitions, with all pseudocode patterns from RESEARCH.md Pattern 2-7 applied directly.

## Requirement Verification

All grep checks pass:

```
grep "GROUP BY" 02-compilation-pipeline.md          ✓ (9 matches — table + invariant + examples)
grep "CycleError" 02-compilation-pipeline.md         ✓ (10 matches)
grep "compileDependencyGraph" 02-compilation-pipeline.md ✓
grep "bind.value" 02-compilation-pipeline.md         ✓ (18 matches)
grep "SchemaProvider.*table_info" 02-compilation-pipeline.md ✓
grep "Map<rowId" 02-compilation-pipeline.md          ✓ (4 matches)
grep "annotateMarks" 02-compilation-pipeline.md      ✓
grep "AuditAnnotation" 02-compilation-pipeline.md    ✓
grep "annotateAudits" 02-compilation-pipeline.md     ✓
grep "sql_text" 02-compilation-pipeline.md           ✓
grep -c "^### Example" 02-compilation-pipeline.md    ✓ = 10
grep "FE-RG-16" 02-compilation-pipeline.md           ✓
grep "FE-RG-17" 02-compilation-pipeline.md           ✓
grep "FilterProvider" 02-compilation-pipeline.md     ✓
grep "ChipWellOutputContract" 02-compilation-pipeline.md ✓
grep "NULL" 02-compilation-pipeline.md               ✓ (23 matches)
grep "markChipAsErrored" 02-compilation-pipeline.md  ✓
grep "NEVER" 02-compilation-pipeline.md              ✓
```

## Known Stubs

None — the spec is complete and self-contained. All 10 worked examples are fully specified with SQL verbatim and bind values. No placeholder content.

## Self-Check: PASSED

- File exists: `.planning/milestones/v15.0-formulas-explorer/02-compilation-pipeline.md` ✓
- Commit exists: `e36eab64` ✓
- All 10 requirement grep checks pass ✓
- 10 examples at `^### Example` ✓
