---
gsd_state_version: 1.0
milestone: v15.0
milestone_name: Formulas Explorer Architecture
status: Roadmap defined, ready to begin Phase 182
stopped_at: Phase 182 context gathered
last_updated: "2026-04-27T17:50:53.644Z"
last_activity: 2026-04-27 — Roadmap created for v15.0
progress:
  total_phases: 7
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v15.0 Formulas Explorer Architecture — Phase 182 (Three-Explorer Boundary Spec)

## Current Position

Phase: 182 (not started)
Plan: —
Status: Roadmap defined, ready to begin Phase 182
Last activity: 2026-04-27 — Roadmap created for v15.0

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

### Blockers/Concerns

(None)

### TODOs

- Create `.planning/milestones/v15.0-formulas-explorer/` directory structure before Phase 182 execution

## Session Continuity

Last session: 2026-04-27T17:50:53.635Z
Stopped at: Phase 182 context gathered
Resume with: `/gsd:plan-phase 182`
