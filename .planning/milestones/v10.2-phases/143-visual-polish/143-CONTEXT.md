---
phase: 143-visual-polish
type: context
created: "2026-04-07"
---

# Phase 143: Visual Polish — Context

## Phase Goal

Independent CSS/behavior polish items that improve SuperGrid UX. Three requirements:

1. **VPOL-01**: Collapse chevrons invisible by default, visible on hover, persistent once collapse state changes
2. **VPOL-02**: Header span labels center within the visible portion when the span exceeds the viewport
3. **VPOL-03**: Row header column widths are resizable via drag (new feature)

## Decisions

- VPOL-01 is CSS-only: opacity transition on `.pv-span-chevron`, always-visible once `--collapsed` or `--collapsible` state has been toggled
- VPOL-02 requires JS in scroll handler: compute visible intersection of each span and offset text to center within visible portion
- VPOL-03 requires new `rowHeaderWidths: Map<number, number>` on GridLayout, a new `SuperSizeRowHeaderResize` plugin, and PivotGrid layout reading updates

## Key Files

- `src/styles/pivot.css` — chevron visibility CSS
- `src/views/pivot/plugins/SuperStackSpans.ts` — spanning plugin (renders chevrons)
- `src/views/pivot/plugins/SuperStackCollapse.ts` — collapse plugin (manages chevron state)
- `src/views/pivot/PivotGrid.ts` — scroll handler (label centering) + layout consumption
- `src/views/pivot/plugins/PluginTypes.ts` — GridLayout interface
- `src/views/pivot/plugins/FeatureCatalog.ts` — plugin registration
- `src/views/pivot/plugins/SuperSizeColResize.ts` — reference implementation for col resize (model for row header resize)
