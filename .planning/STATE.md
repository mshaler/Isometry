---
gsd_state_version: 1.0
milestone: v15.0
milestone_name: Formulas Explorer Architecture
status: verifying
stopped_at: Completed 188-01-PLAN.md
last_updated: "2026-04-28T02:49:23.929Z"
last_activity: 2026-04-28
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 7
  completed_plans: 7
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 188 — ux-interaction-spec

## Current Position

Phase: 188
Plan: Not started
Status: Phase complete — ready for verification
Last activity: 2026-04-28

```
Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/7 phases)
```

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

**v15.0 milestone decisions (from questioning):**

- Navigation: single "Formulas" parent in Analyze ribbon section, three sub-explorers (Formulas/Marks/Audits)
- Marks v1: class assignment only (predicate → CSS class); full Tableau-marks model deferred
- Audit UI surface: annotation contract specified now; rendering surface deferred to implementation milestone
- Type signatures: extensible design accommodating richer types (arrays, JSON, geo shapes) from day one
- Versioning: retain all Formula Card versions; no coalescing/pruning policy at v1
- Card scope: dataset-scoped at v1; story-scoped and global as later additions
- Cross-well drag: copy by default, modifier key for move, never reject (type signatures match)
- Template fork: create operator-contract template as WA-7 in this milestone (not deferred)
- Formulas Explorer is NOT the A in LATCH — orthogonal operator surface (FE-RG-11)

**Phase ordering rationale:**

- Phase 182 (WA-1) must run first — all others depend on the three-explorer boundary
- Phases 183 (WA-6), 184 (WA-2), 185 (WA-3), 186 (WA-7) can proceed in parallel after 182
- Phase 187 (WA-4) requires 182 + 184 + 185 complete
- Phase 188 (WA-5) requires 182 + 183 + 184 + 185 complete (last spec phase)

**Deliverable type:** All outputs are .md specification files in `.planning/milestones/v15.0-formulas-explorer/`. No code ships.

- [Phase 182-three-explorer-boundary-spec]: Formulas/Marks/Audits decompose the original single-explorer hypothesis along operation kind: data-layer / view-layer / semantic-flag
- [Phase 182-three-explorer-boundary-spec]: DSL example lexicon (Appendix A of 01-three-explorer-spec.md) is single canonical reference; downstream WAs must cross-reference verbatim (FE-RG-15)
- [Phase 183-chip-well-geometry-contract]: Chip well is operator surface, not PAFV-bound — §3 explicitly marked N/A per FE-RG-13
- [Phase 183-chip-well-geometry-contract]: ChipWellOutputContract (Phase 184) and FormulaCardDragSourceContract (Phase 185) named as load-bearing seam interfaces
- [Phase 184]: CycleError.participants carries chip IDs for chip-well UI highlighting
- [Phase 184]: Cross-category Filtered Totals resolved via CASE WHEN inline for sql.js compatibility
- [Phase 184]: Explain panel shows raw (sql_text, [bind_values]) tuple with ? placeholders intact
- [Phase 185-formula-card-schema]: D-01..D-08 honored: JSON TEXT for structured fields, separate dsl/sql columns, keep-both sync, uniform strategy, promoteToCard/hydrateChips/validatePromotion promotion API, visibility enum with locked state
- [Phase 186-operator-contract-template]: TMPL-01/TMPL-02: operator-contract-template.md created with §0 usage guide, §2 operator surface (replacing geometry §2+3), 12 total sections with operator-aware guidance prompts
- [Phase 187-golden-test-corpus-plan]: 50-row fixture SQL (INSERT only) on top of realDb() schema; test.each() single parameterized file; orderSensitive boolean for result comparison; anti-patching corpus assertions are immutable
- [Phase 188]: Undo scope is per-well (not global); promoteToCard is NOT undoable — explicit commit boundary per no-commit-until-commit principle
- [Phase 188]: Partial results on error (not empty preview) to satisfy combination-reveals-insight principle; CycleError.participants drives chip highlight

### Blockers/Concerns

(None)

### TODOs

- Create `.planning/milestones/v15.0-formulas-explorer/` directory structure before Phase 182 execution

## Session Continuity

Last session: 2026-04-28T02:45:22.565Z
Stopped at: Completed 188-01-PLAN.md
Resume with: `/gsd:plan-phase 182`
