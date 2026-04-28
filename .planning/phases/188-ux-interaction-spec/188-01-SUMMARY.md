---
phase: 188-ux-interaction-spec
plan: "01"
subsystem: formulas-explorer
tags:
  - ux
  - interaction-spec
  - chip-well
  - formulas
  - marks
  - audits
dependency_graph:
  requires:
    - "182-three-explorer-boundary-spec (01-three-explorer-spec.md)"
    - "183-chip-well-geometry-contract (06-chip-well-geometry.md)"
    - "184-compilation-pipeline (02-compilation-pipeline.md)"
    - "185-formula-card-schema (03-formula-card-schema.md)"
  provides:
    - "05-ux-interaction-spec.md — complete UX interaction specification for chip-well explorers"
  affects:
    - "Future implementation phases for FormulasPanelStub.ts, chip-well drag, promotion dialog"
tech_stack:
  added: []
  patterns:
    - "Immediate re-compile on every chip event (no debounce) per Cryptex continuous-tactile principle"
    - "Per-well ArrangementSnapshot undo stack — separate from Formula Card versioning"
    - "data-error attribute pattern for inline chip-level error display"
    - "Pointer event protocol with setPointerCapture for WKWebView drag compliance"
    - "<dialog> element for all modal interactions (no alert/confirm/prompt)"
key_files:
  created:
    - ".planning/milestones/v15.0-formulas-explorer/05-ux-interaction-spec.md"
  modified: []
decisions:
  - "D-01 through D-19 from 188-CONTEXT.md all reflected in spec — no deviations"
  - "Undo scope is per-well (not global) to match chip-well-as-independent-surface model"
  - "promoteToCard is NOT undoable — explicit commit boundary per no-commit-until-commit principle"
  - "Partial results on error (not empty preview) to satisfy combination-reveals-insight principle"
  - "Formulas Explorer is NOT the A in LATCH — orthogonal operator surface (FE-RG-11 preserved)"
metrics:
  duration_seconds: 339
  completed_date: "2026-04-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 0
  lines_written: 642
requirements_satisfied:
  - UXIN-01
  - UXIN-02
  - UXIN-03
  - UXIN-04
  - UXIN-05
  - UXIN-06
---

# Phase 188 Plan 01: UX Interaction Spec Summary

**One-liner:** Complete chip-well interaction spec covering live preview (immediate re-compile, D3 keyed transitions, 200ms shimmer), per-well undo stack (ArrangementSnapshot, promoteToCard NOT undoable), three error wireframes (type-mismatch/cycle/compile with CycleError.participants, partial results), promotion dialog (`<dialog>`, validatePromotion pre-check, promoteToCard flow), navigation hierarchy (Analyze dock, Formulas/Marks/Audits sub-tabs), and WKWebView constraints (pointer events, no :has(), `<dialog>` only).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Write UX interaction spec sections 1-3 (Live Preview, Reversibility, Error States) | 2a47c431 | `.planning/milestones/v15.0-formulas-explorer/05-ux-interaction-spec.md` (created, 642 lines) |
| 2 | Write UX interaction spec sections 4-6 (Promotion UI, Explorer Placement, WKWebView Constraints) | 2a47c431 | Same file — sections 4-6 + Appendix A included in single atomic write |

## Output Artifact

`.planning/milestones/v15.0-formulas-explorer/05-ux-interaction-spec.md` — 642 lines, 6 sections + Appendix A.

### Section Coverage

| Section | Requirement | Key content |
|---------|------------|-------------|
| §1 Live Preview Behavior | UXIN-01 | Immediate trigger (chip:drop/reorder/remove), pipeline path (ChipWellOutputContract → FormulasProvider.compile() → supergrid:query → D3 transitions), 200ms shimmer overlay, sequencing diagram |
| §2 Reversibility Model | UXIN-02 | ArrangementSnapshot shape, per-well stacks for all 6 wells, Cmd+Z/Cmd+Shift+Z, undo fires re-preview, promoteToCard NOT undoable, boundary table |
| §3 Error State Presentation | UXIN-03 | Three wireframes (data-error attributes, red borders, icons), CycleError.participants highlighting, partial results indicator, automatic error clearing, well.undo() recovery |
| §4 Save-as-Formula Promotion UI | UXIN-04 | validatePromotion pre-check, `<dialog>` spec (Name/Description, hidden defaults), promoteToCard confirm flow, toast, post-save editing, error-in-dialog pattern |
| §5 Explorer Placement | UXIN-05 | Analyze dock, section-defs.ts line 162, Formulas/Marks/Audits sub-tabs, navigation tree diagram, orthogonality statement (NOT the A in LATCH) |
| §6 WKWebView Constraints | UXIN-06 | 3-row constraint checklist with violation detectors, pointer event protocol (pointerdown/setPointerCapture/elementFromPoint/pointerup), touch-action: none, cross-reference to geometry contract |
| Appendix A | — | Four Cryptex/Dream Orb principles mapped to spec sections |

## Deviations from Plan

None — plan executed exactly as written. All 19 locked decisions from 188-CONTEXT.md are reflected in the spec. Both tasks wrote to the same file in a single atomic write, resulting in a single commit rather than two separate commits; this is a mechanical artifact of the write, not a deviation from the content specification.

## Known Stubs

None. This is a specification document, not implementation code. There are no data-wiring stubs.

## Self-Check

File exists: `.planning/milestones/v15.0-formulas-explorer/05-ux-interaction-spec.md` — FOUND
Commit exists: `2a47c431` — FOUND
Line count: 642 (requirement: >= 250) — PASS
Section §1 contains "ChipWellOutputContract" and "FormulasProvider.compile()" and "supergrid:query" — PASS
Section §1 contains "opacity" and "translateY" and "200ms" — PASS
Section §2 contains "Per-well undo stack" — PASS
Section §2 contains "NOT undoable" and "permanent version row" — PASS
Section §3 contains "CycleError.participants" — PASS
Section §3 contains "partial results" — PASS
Section §3 contains "well.undo()" — PASS
Section §4 contains "validatePromotion" — PASS
Section §4 contains "`<dialog>`" and "Name" and "Description" — PASS
Section §4 contains "promoteToCard" and "toast" — PASS
Section §5 contains "section-defs.ts" and "Analyze" — PASS
Section §5 contains "Formulas" and "Marks" and "Audits" as sub-tabs — PASS
Section §6 contains "pointerdown" and "data-*" and "`<dialog>`" — PASS
Section §6 contains "setPointerCapture" and "elementFromPoint" and "touch-action: none" — PASS

## Self-Check: PASSED
