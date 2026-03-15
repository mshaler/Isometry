# SuperGrid UI/UX Recommendations for Spreadsheet-Like Experience

Date: 2026-03-08

## Scope Reviewed
- Spec intent: `v5/Modules/SuperGrid.md`, `docs/D3-UI-IMPLEMENTATION-SPEC-v2.md`
- Implementation: `src/views/SuperGrid.ts`, `src/views/supergrid/SuperStackHeader.ts`, `src/styles/supergrid.css`

## Executive Summary
SuperGrid already has strong spreadsheet primitives (sticky headers, virtualization, resizing, selection, sort/filter). The largest gaps are visual model consistency and interaction familiarity. The current "spreadsheet" mode still reads as a card board embedded in a grid rather than a true sheet.

The highest-leverage changes are:
1. Define a true spreadsheet visual baseline (gridlines, neutral cells, compact typography, predictable header chrome).
2. Introduce familiar sheet scaffolding (row index gutter, column lettering/identity, active-cell affordances, frozen-pane cues).
3. Reduce control noise in-cell and in-header (move advanced controls out of primary reading path).
4. Move stable styles from inline TS to semantic CSS classes/tokens for consistent, theme-safe polish.

## Key Findings From Current Implementation
1. Styling is mostly inline and distributed across render paths, which makes visual consistency hard to enforce.
- Evidence: heavy inline styling in `src/views/SuperGrid.ts:510-750`, `src/views/SuperGrid.ts:1919-2024`, `src/views/SuperGrid.ts:3443-3683`
- Supporting file is minimal (`src/styles/supergrid.css:1-18`).

2. Spreadsheet mode still prioritizes card affordances over cell affordances.
- Evidence: in spreadsheet mode, each non-empty cell prepends dashed italic `supergrid-card` count chips and card pills (`src/views/SuperGrid.ts:1927-1985`).
- This is visually distinct from spreadsheet conventions where the primary object is the cell value, not a card token.

3. Header chrome is overloaded for dense analytical use but not optimized for spreadsheet familiarity.
- Evidence: grip + chevron + sort + filter icons rendered directly in headers (`src/views/SuperGrid.ts:3489-3560`, `src/views/SuperGrid.ts:3639-3749`).
- Toolbar also mixes many controls in a single strip (`src/views/SuperGrid.ts:564-750`).

4. Row header structure is hierarchical and fixed-width, but lacks spreadsheet index cues.
- Evidence: fixed 80px row-header level width (`src/views/SuperGrid.ts:118`, `src/views/SuperGrid.ts:3469`; also described in `SuperStackHeader.ts`).
- No explicit row-number gutter pattern is present.

## Recommendations (Prioritized)

### P0: Establish a Spreadsheet-First Visual Mode
1. Add a dedicated `spreadsheet-classic` visual preset (separate from current card-centric spreadsheet mode).
2. Replace dashed italic SuperCard marker in this preset with plain value rendering and lightweight numeric badges only where needed.
3. Normalize gridlines to subtle 1px separators for both empty and populated cells, with reduced background tinting.
4. Keep card pills behind an "expanded cell" or "detail" affordance rather than always visible.

Why: this immediately shifts perceived identity from "card matrix" to "sheet" while preserving existing data model.

### P0: Improve Structural Familiarity
1. Add a dedicated row index gutter (1..N) independent of row hierarchy labels.
2. Add optional column identity labels (A, B, C...) as a secondary line above/beside semantic headers.
3. Strengthen frozen-pane cues with subtle divider shadows for sticky top/left regions.
4. Keep the corner cell as a recognizable sheet control area (select-all, transpose, quick actions).

Why: users orient faster when classic sheet landmarks are present.

### P1: Rebalance Header Density
1. Default to low-noise headers: show label first, reveal sort/filter/grip on hover/focus.
2. Move collapse chevrons and drag grips into a compact "header tools" slot with consistent spacing.
3. Reduce header font weight and border contrast in dense datasets to match spreadsheet scanning behavior.
4. Preserve advanced controls via context menu, but simplify always-visible chrome.

Why: reduces cognitive load without removing capability.

### P1: Cell Interaction Fidelity
1. Add true active-cell state (focus ring, name box/readout, keyboard navigation visibility).
2. Add fill-handle affordance for selection edges (even if initially visual-only).
3. Differentiate selected range vs active cell vs hovered cell with distinct states.
4. Add subtle row/column highlight crosshair on active cell to aid large-grid scanning.

Why: spreadsheet UX quality is judged heavily by selection/focus behavior.

### P1: Toolbar Information Architecture
1. Split toolbar into "Sheet controls" (zoom, view, freeze, density) and "Data controls" (sort/filter/search).
2. Promote search and filter status to persistent chips/tokens (instead of mixed inline controls and hidden state).
3. De-emphasize secondary actions (`Clear sorts`, `Clear filters`, `Show All`) until state is active, but keep layout stable.
4. Add presets: `Sheet`, `Analysis`, `Presentation` to quickly reconfigure density + chrome verbosity.

Why: a single crowded bar currently competes with the grid for attention.

### P2: Visual System Hardening
1. Migrate repeat inline styles to semantic classes (`sg-cell`, `sg-cell--empty`, `sg-header--sticky`, etc.).
2. Expand `src/styles/supergrid.css` into mode-based sections (`[data-view-mode="spreadsheet"]`, etc.).
3. Standardize spacing, radius, and border tokens across headers/cells/menus.
4. Add visual regression snapshots for key states (empty, dense, selected, collapsed, filtered).

Why: consistency and maintainability are prerequisites for high-end spreadsheet polish.

## Suggested Implementation Plan
1. **Phase A (Visual Baseline):** create spreadsheet-classic mode + gridline/header cleanup.
2. **Phase B (Structure):** row index gutter, column identity labels, frozen-pane cues.
3. **Phase C (Interaction):** active-cell model, range affordances, keyboard/focus polish.
4. **Phase D (Refactor):** class/token migration from inline styles + regression snapshots.

## Acceptance Criteria for "Feels Like a Spreadsheet"
1. New users can identify active cell, selected range, and frozen headers in <3 seconds.
2. Dense tables remain legible at 100% zoom without header/tool noise dominating content.
3. Spreadsheet mode no longer depends on card-styled visual primitives for primary data display.
4. Advanced controls remain discoverable but do not clutter default reading/scanning flow.
5. SuperGrid performance characteristics (virtualization, render speed) remain unchanged.
