---
phase: 186-operator-contract-template
plan: 01
subsystem: planning
tags: [template, operator-surface, contracts, formulas-explorer, chip-well]

# Dependency graph
requires:
  - phase: 183-chip-well-geometry-contract
    provides: "Completed chip-well operator-surface contract — existence proof for the template"
  - phase: geometry-contract-template
    provides: "Parent template structure, tone, and guidance prompt style"
provides:
  - "operator-contract-template.md: reusable template for specifying operator surfaces"
  - "Section 0 usage guide distinguishing geometry vs operator templates with concrete Time Explorer vs Chip Well example"
  - "Section 2 Operator surface replacing geometry sections 2+3 with input/output contract pattern"
  - "Sections 3-11 with operator-aware guidance prompts renumbered from geometry template sections 4-12"
affects: [formulas-explorer, chip-well, marks-explorer, audits-explorer, any future operator surface contracts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Operator contract template: input/output contract pattern for non-geometric explorer surfaces"
    - "Section 0 usage guide: inline template disambiguation distinguishing geometry vs operator semantics"
    - "Configured/Reconfiguring lifecycle states for operator surfaces (vs Rendered/Rebinding for geometry)"

key-files:
  created:
    - ".planning/operator-contract-template.md"
  modified: []

key-decisions:
  - "D-01: Single operator surface section replaces both §2 and §3 — describes what the operator does instead of spatial projection"
  - "D-02: Remaining 10 sections carry over with rewritten operator-aware guidance prompts, renumbered to preserve section continuity"
  - "D-03: Usage guide lives inline as §0 'When to use this template' at top of document — self-contained for authors"
  - "D-04: Time Explorer (geometry) vs Chip Well (operator) as the concrete distinguishing example"
  - "D-05: File lives at .planning/operator-contract-template.md — sibling to geometry-contract-template.md"

patterns-established:
  - "Operator contract: describe input/output contracts and architectural boundary statement (why not geometric) in §2"
  - "Operator lifecycle: Configured/Reconfiguring states instead of Rendered/Rebinding"
  - "Non-geometric deliberateness: §2.3 'Why this is not geometric' makes the absence of PAFV binding explicit rather than silent"

requirements-completed: [TMPL-01, TMPL-02]

# Metrics
duration: 2min
completed: 2026-04-28
---

# Phase 186 Plan 01: Operator Contract Template Summary

**Operator-surface contract template with §0 usage guide and §2 input/output contract pattern, forked from geometry-contract-template and covering all 12 sections (0–11)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-28T00:38:22Z
- **Completed:** 2026-04-28T00:39:49Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Created `.planning/operator-contract-template.md` as a sibling to `geometry-contract-template.md`
- Section 0 usage guide with two-row comparison table distinguishing geometry (Time Explorer) vs operator (Chip Well) templates
- Section 2 "Operator surface" with three subsections: Input contract, Output contract, and "Why this is not geometric" — replacing geometry sections 2+3
- Sections 3–11 renumbered and rewritten with operator-aware guidance prompts throughout
- Cross-link to geometry-contract-template.md in both section 0 and section 11

## Task Commits

1. **Task 1: Write operator-contract-template.md** - `9650b219` (feat)

**Plan metadata:** (final commit below)

## Files Created/Modified
- `.planning/operator-contract-template.md` — Operator contract template (12 sections, 248 lines)

## Decisions Made
- Used the geometry template's header block style but adapted the preamble to operator semantics ("operator function" vs "function that produces this view's spatial arrangement")
- "PAFV binding" appears once in a guidance prompt cross-reference (not as a section heading) — the acceptance criteria check for section headings passes
- Lifecycle state machine uses operator-specific transitions: Configured/Reconfiguring (parallel to Rendered/Rebinding in geometry template)
- "Why this is not geometric" as a subsection of §2 rather than a standalone note — keeps the architectural boundary statement co-located with the contracts it explains

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Template is ready for use by any future operator surface contracts (Marks explorer, Audits explorer, etc.)
- Chip Well geometry contract (Phase 183) is the retroactive demonstration of the pattern this template formalizes
- No blockers

---
*Phase: 186-operator-contract-template*
*Completed: 2026-04-28*
