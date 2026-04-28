---
phase: 183-chip-well-geometry-contract
plan: 01
subsystem: planning-specs
tags: [geometry-contract, chip-well, drag-and-drop, accessibility, formulas-explorer]
dependency_graph:
  requires: [182-three-explorer-boundary-spec]
  provides: [chip-well-geometry-contract]
  affects: [184-compilation-pipeline, 185-formula-card-library, 188-ux-interaction]
tech_stack:
  added: []
  patterns: [geometry-contract-template, operator-surface-pattern, drag-grab-mode-keyboard]
key_files:
  created:
    - .planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md
  modified: []
decisions:
  - "Chip well is operator surface, not PAFV-bound — §3 explicitly marked N/A with rationale per FE-RG-13"
  - "ChipWellOutputContract (Phase 184) and FormulaCardDragSourceContract (Phase 185) named as load-bearing seam interfaces"
  - "All 6 drag states specified: default, drag-source-active, drag-target-valid, drag-target-invalid, drop-rejected, promotion-prompt"
  - "aria-grabbed retained despite ARIA 1.1 deprecation for WKWebView/VoiceOver compatibility"
  - "Keyboard grab mode pattern (Enter/Space to grab, arrows to reorder, Enter to drop, Escape to cancel) per ARIA Practices"
metrics:
  duration_minutes: 8
  completed_date: "2026-04-27"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
---

# Phase 183 Plan 01: Chip-Well Geometry Contract Summary

**One-liner:** Complete chip-well geometry contract with 12 sections — coordinate system, 6 drag states, pointer/touch/keyboard/ARIA interaction contracts, and 2 named composition seams (ChipWellOutputContract → Phase 184, FormulaCardDragSourceContract ← Phase 185).

## What Was Built

Created `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — a standalone, Formulas-agnostic geometry contract for the chip-well control surface primitive. The contract fills all 12 sections of the geometry contract template and satisfies all 6 GEOM requirements.

### Key content by section

- **§1 Intent:** Two-paragraph distinction between what chip wells ARE (layout primitive for typed configuration) and what they are NOT (data view, PAFV-bound surface).
- **§2 Coordinate system:** Full spatial specification — well container as authority, chip token dimensions (`chip-v-pad` 2px structural value, `--size-card-mini` 24px height, variable width), all 5 spacing tokens, typography tokens, horizontal flow with wrap on inline axis, vertical stacking on block axis.
- **§3 PAFV binding:** Explicit "N/A — operator surface" with rationale per FE-RG-13. Deliberately marked rather than silently empty.
- **§4 Data binding:** Input (ordered chip list per well, type signature + DSL fragment), output (same shape via `ChipWellOutputContract`), cardinality tiers (Empty/Sparse/Typical/Dense), no virtualization needed.
- **§5 Invariants:** 6 invariants including user-controlled chip order, no silent category changes, deterministic hit testing, copy-by-default cross-well drag.
- **§6 Degenerate cases:** 8 cases — empty well, single chip, overflow, type-incompatible drop, drag abort, cross-explorer drag, touch abort, long chip labels.
- **§7 States:** All 6 drag states with semantic token-based visual descriptions, Mermaid state machine diagram, reflow rules, empty state specification with exact copy.
- **§8 Interaction contracts:** Four sub-tables — pointer-event mouse drag (5 rows), touch/iPad drag (4 rows, long-press 500ms), keyboard contract (9 keys including grab mode), ARIA contract (6 elements including `aria-grabbed` deprecation note).
- **§9 Composition:** Two named seams with interface names, publish/consume responsibilities, owner phases, direction. Load-bearing statement per D-08.
- **§10 Out of scope:** 9 explicit exclusions including visual styling, DSL grammar, compiled SQL, per-explorer type rules, animation timing.
- **§11 Open questions:** 3 tracked questions (cross-explorer drag validation owner, multi-select gestures, max chip label width).
- **§12 Reference:** Visual calibration placeholder, related contracts, changelog.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write chip-well geometry contract sections 1-8 (+ 9-12) | cf81230a | `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` |
| 2 | Validate complete document (verification battery) | — (validation only, no new files) | — |

## Verification Results

All 6 GEOM requirements verified:

| Requirement | Check | Result |
|-------------|-------|--------|
| GEOM-01 | 12 section headings; N/A in §3 | PASS (12 sections) |
| GEOM-02 | Horizontal flow, wrap, vertical stacking, fixed-height variable-width | PASS |
| GEOM-03 | All 6 drag states named | PASS (27 matches) |
| GEOM-04 | role=listbox, role=option, aria-grabbed, grab mode, Enter or Space | PASS (7 matches) |
| GEOM-05 | ChipWellOutputContract (2), FormulaCardDragSourceContract (1), no TS signatures | PASS |
| GEOM-06 | Zero Formulas-specific category names | PASS (0 matches) |

FE-RG-13: operator surface text in §3 — PASS
FE-RG-14: no per-explorer specifics in geometry contract — PASS

Document line count: 304 (>300 minimum)

## Deviations from Plan

None — plan executed exactly as written. Task 1 and Task 2 were executed sequentially. Since the geometry contract template has a single document structure, all 12 sections were written in one pass (Task 1) and validated in full (Task 2). No content was deferred.

## Known Stubs

None. The document is complete. Open questions in §11 are explicitly tracked planning questions, not stubs — they document unresolved architectural decisions (cross-explorer drag validation ownership, multi-select gestures, max chip label width) that require user decision before chip-well UI implementation.

## Self-Check: PASSED

- File exists: `.planning/milestones/v15.0-formulas-explorer/06-chip-well-geometry.md` — FOUND
- Commit cf81230a — present in git log
