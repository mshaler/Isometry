---
phase: 160-visual-polish-calcexplorer-feedback
plan: 02
subsystem: CalcExplorer / workbench.css
tags: [visual-polish, calcexplorer, css, design-tokens]
dependency_graph:
  requires: [160-01]
  provides: [EXPX-08, EXPX-09]
  affects: [CalcExplorer, workbench.css]
tech_stack:
  added: []
  patterns: [BEM modifier class toggle, glyph span prepend]
key_files:
  created: []
  modified:
    - src/ui/CalcExplorer.ts
    - src/styles/workbench.css
decisions:
  - Active aggregation rows use .calc-row--active BEM modifier toggled via classList.add()
  - Type glyph uses appendChild pattern (not innerHTML) to avoid clearing existing nodes
  - font-weight 400 on glyph ensures it stays normal-weight inside .calc-row--active label (which sets 600)
metrics:
  duration: 5m
  completed: 2026-04-18
  tasks_completed: 2
  files_modified: 2
---

# Phase 160 Plan 02: CalcExplorer Active Indicator + Type Glyphs Summary

**One-liner:** Active aggregation indicator (bold primary label) and type glyphs (# / Aa) added to CalcExplorer rows using BEM modifier class and design token CSS rules.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | CalcExplorer._render() — type glyph + active class | 4f308bd8 | src/ui/CalcExplorer.ts |
| 2 | CSS rules for .calc-row--active and .calc-row__type-glyph | 10fb3836 | src/styles/workbench.css |

## What Was Built

**Task 1 — CalcExplorer.ts changes:**
- Added `row.classList.add('calc-row--active')` guarded by `currentValue !== 'off'`
- Replaced `label.textContent = displayName` with `appendChild(glyph) + appendChild(createTextNode(displayName))`
- Glyph span (`calc-row__type-glyph`) shows `#` for numeric fields, `Aa` for text fields
- Removed `var(--text-sm, 13px)` fallback from empty state message (per Phase 155 D-03)

**Task 2 — workbench.css additions:**
- `.calc-row--active label`: `font-weight: 600; color: var(--text-primary)` — makes active aggregation rows visually distinct
- `.calc-row__type-glyph`: `color: var(--text-muted); margin-right: var(--space-xs); font-size: var(--text-xs); font-weight: 400` — muted glyph prefix that stays normal-weight even inside active rows

## Success Criteria Verification

1. CalcExplorer rows with active aggregations (not 'off') display label in --text-primary at font-weight 600 — YES (.calc-row--active label rule)
2. CalcExplorer rows with 'off' aggregation display label in --text-secondary at normal weight — YES (base .calc-row label rule unchanged)
3. Every CalcExplorer column label is prefixed with # (numeric) or Aa (text) in --text-muted color — YES (glyph span always appended)
4. Type glyph color does not change between active and inactive states — YES (glyph color set at .calc-row__type-glyph level, not overridden by --active rule)
5. Select dropdown stays visually neutral regardless of aggregation state — YES (no rules targeting .calc-select changed)
6. No hardcoded values in new CSS rules — YES (all use design tokens)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/ui/CalcExplorer.ts: modified with active class + glyph span
- src/styles/workbench.css: new CSS rules added before crossfade transition
- Commits 4f308bd8 and 10fb3836 exist
- Build: clean (dist/isometry.js built in 2.18s)
- Tests: all CalcExplorer unit and seam tests pass (8779/8788 pass; 9 failing are pre-existing E2E Playwright tests unrelated to this plan)
