# Phase 142 Context: SuperCalc Footer + SuperDensity

## Problem Statement

Two visual bugs in the PivotGrid harness plugin system:

### CALC-FIX-01: Footer renders above data instead of below

The SuperCalcFooter plugin's `afterRender` creates the `.pv-calc-footer` element as a sibling of `root` (the scroll container) inside `gridWrapper` (pv-grid-root). This places it outside the scroll container, so `position: sticky; bottom: 0` has no scrolling ancestor to stick to.

**Root cause**: `gridWrapper.appendChild(footer)` appends to pv-grid-root (the overlay-clipping wrapper), not inside the scroll container where the table lives.

**Fix**: Append footer inside `root` (which is `_scrollContainer` since Phase 141) — after the `<table>`. This gives sticky positioning a proper scroll ancestor.

### DENS-FIX-01: Density mode switch produces no visible cell changes

The SuperDensityModeSwitch plugin looks for `.pv-grid-wrapper` in `root` to apply density CSS classes (`pv-density--compact`, etc.). But `root` in afterRender is `_scrollContainer` (class `pv-scroll-container`), not `.pv-grid-wrapper`.

**Root cause**: `root.querySelector('.pv-grid-wrapper')` returns null because `.pv-grid-wrapper` is a production SuperGrid class, not present in the PivotGrid harness DOM. The density classes never get applied.

**Fix**: Apply density classes directly to `root` (the scroll container). The CSS selectors `.pv-density--compact .pv-data-cell` etc. will cascade correctly since data cells are descendants of the scroll container.

## Decisions

- D-FOT-01: Footer appended to `root` (scroll container) not `gridWrapper` — LOCKED
- D-DNS-01: Density classes applied to `root` (scroll container) directly — LOCKED
- D-DNS-02: No new density levels — keep existing compact/normal/comfortable/spacious — LOCKED

## Scope

Two surgical fixes. No new features, no new files. Existing test files updated.
