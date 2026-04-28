---
phase: 182-three-explorer-boundary-spec
plan: "01"
subsystem: formulas-explorer-architecture
tags:
  - specification
  - architecture
  - formulas-explorer
  - marks-explorer
  - audits-explorer
  - regression-guards
dependency_graph:
  requires: []
  provides:
    - three-explorer-boundary-spec
    - dsl-example-lexicon
    - regression-guards-appendix
  affects:
    - 182-02 (WA-2 compilation pipeline — uses this boundary spec as foundation)
    - 183 (WA-6 chip-well geometry — references FE-RG-13/14 from this spec)
    - 184 (WA-2 — cross-category reference algorithm builds on D-04 acknowledgment here)
    - 185 (WA-3 — Formula Card no-intrinsic-category rule from FE-RG-06)
    - 186 (WA-7 — operator contract template references this spec)
    - 187 (WA-4 — golden test corpus uses DSL lexicon from Appendix A)
    - 188 (WA-5 — UX spec layers on top of explorer boundaries defined here)
tech_stack:
  added: []
  patterns:
    - Specification document with grep-able regression guards (D-02)
    - DSL example lexicon as single canonical reference (FE-RG-15)
    - Anti-feature documentation with one-sentence rationale + guard cross-ref (D-03)
    - Cross-category reference: name pattern, defer mechanics to WA-2 (D-04)
key_files:
  created:
    - .planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md
  modified: []
decisions:
  - "Formulas/Marks/Audits decompose the original single-explorer hypothesis along operation kind: data-layer / view-layer / semantic-flag"
  - "Formulas Explorer never owns GROUP BY — same Calculation chip produces different SQL per view context (FE-RG-01)"
  - "Marks produce post-query CSS class Map<rowId, string[]>; never alter result set membership (FE-RG-07)"
  - "Audits produce post-query flag annotations; never exclude rows (FE-RG-08)"
  - "DSL example lexicon (Appendix A) is single canonical reference; downstream WAs must cross-reference verbatim (FE-RG-15)"
  - "Cross-category references (e.g., Filtered Totals) acknowledged; resolution algorithm deferred to WA-2 (D-04)"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 182 Plan 01: Three-Explorer Boundary Spec Summary

## One-Liner

Complete three-explorer boundary specification (Formulas/Marks/Audits) with type signatures, composition rules, 21-example DSL lexicon, 8 anti-features, 14-row discussion placement table, and all 15 FE-RG regression guards with grep-able verification checks.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write three-explorer spec — core sections (SPEC-01..06) | e4965435 | `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` (created, 418 lines) |
| 2 | Add regression guards appendix (GARD-01, GARD-02) | e4965435 | Same file — Appendix B written as part of atomic Task 1 write; no separate commit needed |

Note: Both tasks were written as a single atomic document creation. The regression guards (Appendix B) were included in the initial write to avoid a partial-document intermediate state. Both task acceptance criteria are fully satisfied.

## What Was Built

`01-three-explorer-spec.md` is the foundational WA-1 artifact for the v15.0 Formulas Explorer Architecture milestone. It establishes:

**Explorer boundaries (SPEC-01 through SPEC-03):**
- Formulas Explorer (data-layer): Calculations, Filters, Sorts — each with one-sentence type signatures and compilation targets (SELECT, WHERE, ORDER BY). Out-of-scope: GROUP BY, post-query annotation.
- Marks Explorer (view-layer): Conditional encoding — produces `Map<rowId, string[]>` of CSS classes via post-query annotation. Out-of-scope: altering row membership, theme palette.
- Audits Explorer (semantic-flag layer): Anomaly rules + Validation rules — produces flag annotations per row via post-query annotation. Out-of-scope: excluding rows, derived calculations.

**DSL Example Lexicon (SPEC-04, Appendix A):** 21 canonical examples across all chip sub-types (7 Calculations, 5 Filters, 2 Sorts, 2 Marks, 4 Audits). Labeled "illustrative, not normative" per D-01 to avoid constraining WA-4's grammar design.

**Anti-Features (SPEC-05):** 8 prohibited behaviors with one-sentence rationales and FE-RG cross-references. Covers OR-composition across filters, Marks filtering, GROUP BY in Formulas, inline cell editing, automatic chip promotion, theme in Marks, and LATCH-letter framing.

**Discussion.md Example Placement (SPEC-06):** 14-row table placing every item from the original hypothesis (wireframe table rows, key questions, Appendix A worked examples) into exactly one explorer/category with rationale. Pitfall 2 (misplacing "Calculated values" into Audits) explicitly avoided.

**Regression Guards (GARD-01, GARD-02, Appendix B):** All 14 FE-RG guards from the handoff plus FE-RG-15 (defined fresh). Each guard has: guard statement, rationale, grep-able verification check. FE-RG-15 targets downstream WA files with `0[2-6]-*.md` pattern per GARD-02 enforcement requirement.

## Verification Results

All plan verification checks passed:

```
1. File exists: PASS
2. All three explorer headings: 9 matches (headings + references)
3. GROUP BY — every match in prohibition/view-explorer-ownership context: PASS
4. FE-RG-15 present: 3 matches
5. DSL lexicon examples (AS profit, SUM, RANK, MSFT): 15 matches
6. Anti-features section: 2 matches
7. All 15 guard IDs (FE-RG-01..FE-RG-15): all present (1–5 matches each)
8. Grep commands in doc: 11 (exceeds minimum 5 per D-02)
```

## Deviations from Plan

None — plan executed exactly as written.

Tasks 1 and 2 were combined into a single atomic write. The plan allowed this: Appendix B content was fully specified in the plan and ready to write without any intermediate Task-1-only state being needed for review. Both acceptance criteria sets are satisfied in the single artifact.

## Self-Check: PASSED

Files created:
- `.planning/milestones/v15.0-formulas-explorer/01-three-explorer-spec.md` — FOUND

Commits:
- `e4965435` — FOUND (verified via `git log --oneline`)
