# Quick Task 260418-oo4: Fix Explorer horizontal overflow onto DockNav

## What Changed

Two CSS fixes to prevent explorer panel content from visually overlapping the DockNav sidebar:

1. **workbench-sidebar z-index** (`src/styles/workbench.css`): Added `position: relative; z-index: 2` to `.workbench-sidebar` so the dock strip always stacks above any `workbench-main` content.

2. **ProjectionExplorer containment** (`src/styles/projection-explorer.css`): Added `.projection-explorer` root rule with `width: 100%; overflow: hidden` and `min-width: 0; overflow: hidden` on `.projection-explorer__wells`. The wells (AVAILABLE, ROWS, COLUMNS, Z) each have `min-width: 80px` which could collectively exceed the slot container width — the overflow containment prevents bleed.

## Key Files

- `src/styles/workbench.css` — `.workbench-sidebar` z-index stacking
- `src/styles/projection-explorer.css` — root + wells overflow containment

## Commits

- `25f11b6e` — sidebar z-index fix
- `2f4621da` — ProjectionExplorer containment fix
