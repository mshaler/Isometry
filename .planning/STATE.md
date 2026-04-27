---
gsd_state_version: 1.0
milestone: v15.0
milestone_name: Formulas Explorer Architecture
status: defining-requirements
last_updated: "2026-04-27"
last_activity: 2026-04-27
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-27)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Defining requirements for v15.0 Formulas Explorer Architecture

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-04-27 — Milestone v15.0 started

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

### Blockers/Concerns

(None)

### TODOs

(None)

## Session Continuity

Last session: 2026-04-27
Stopped at: Milestone v15.0 started, defining requirements
Resume with: Continue requirements definition
