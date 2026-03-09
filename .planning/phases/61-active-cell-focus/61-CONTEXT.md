# Phase 61: Active Cell Focus - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Clicking a SuperGrid data cell activates it with a visible focus ring and crosshair highlights on its row and column, providing clear spatial orientation. The active cell is tracked independently of multi-cell lasso/Cmd+click selection. A fill handle affordance appears at the bottom-right corner (visual only, no drag interaction). Keyboard navigation and functional fill handle are deferred to Phase D.

</domain>

<decisions>
## Implementation Decisions

### Focus ring style
- Same blue as existing selection system (--selection-outline / #1a56f0) — unified color language
- 2px solid outline + inset box-shadow glow for emphasis (differentiates from sg-selected's plain 2px outline)
- Ring only, no background fill on the active cell itself
- Instant appearance on click — no CSS transition, zero perceived latency
- `sg-cell--active` class drives all visuals

### Crosshair appearance
- Subtle blue background tint on the entire active row and active column (same blue family, very light — use --selection-bg or lighter)
- Crosshair highlights both headers (column header + row gutter index) AND data cells — full spatial anchoring from header to active cell
- `sg-col--active-crosshair` on column headers and column data cells; `sg-row--active-crosshair` on row gutter and row data cells
- Crosshair tint overrides zebra striping (sg-row--alt) on the active row — clean, unambiguous highlight via CSS specificity

### Fill handle look
- 6×6px solid square — classic spreadsheet convention (Excel/Google Sheets)
- Same blue as focus ring (--selection-outline) — unified with ring system
- Positioned ON the focus ring outline, overlapping bottom-right corner — handle straddles the border, centered on corner
- `pointer-events: none` (ACEL-04: visual only, no drag interaction)
- Appears in both spreadsheet AND matrix modes — active cell is a spatial concept, applies everywhere
- `sg-fill-handle` class, absolutely positioned within the cell

### Active + selected overlap
- Active ring wins over sg-selected outline (CSS specificity: sg-cell--active overrides sg-selected outline)
- When a cell is both active AND selected, the blue selection tint (sg-selected background) is preserved — ring = active, tint = selected, both visible simultaneously
- Fill handle always appears on the active cell regardless of selection state
- Clicking empty grid background clears the active cell (removes ring, crosshairs, and fill handle) — consistent with how selection already clears on background click

### Claude's Discretion
- Exact inset box-shadow values for the focus ring glow effect
- New design token names/values for crosshair tint (e.g., --sg-active-crosshair-bg)
- CSS specificity strategy for sg-cell--active vs sg-selected vs sg-row--alt layering
- Fill handle z-index relative to the lasso SVG overlay
- Whether _activeCellKey is stored as a cellKey string or {rowKey, colKey} tuple

</decisions>

<specifics>
## Specific Ideas

- The focus ring should feel like Excel/Google Sheets — immediately recognizable as "this is the active cell"
- Crosshair is a spatial orientation aid, not a selection indicator — should be light enough to not compete with the blue selection tint
- Fill handle is a forward-looking affordance — visual only now, but sets up Phase D functional fill handle (range-fill on drag)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `classifyClickZone()` in SuperGridSelect.ts: Already discriminates 'data-cell' clicks — can gate active cell assignment
- `_updateSelectionVisuals()` in SuperGrid.ts: Pattern for DOM-walking cells and toggling CSS classes — same approach for active cell/crosshair classes
- `sg-selected` CSS class: Existing outline + background pattern to follow (and override with higher specificity)
- `--selection-outline`, `--selection-bg`, `--accent` design tokens: Color system already in place

### Established Patterns
- CSS class-driven visuals (Phase 58): All SuperGrid styling via semantic classes, no inline styles
- D3 data join with `.data-cell[data-key]`: Cell identification via dataset.key attribute
- `_lastCells` cache: Cell data available for mapping cellKey → row/col identity without re-query
- Lasso hit highlighting: `.lasso-hit` class toggle pattern in SuperGridSelect — same toggle approach for crosshair

### Integration Points
- `el.onclick` handler in SuperGrid._renderCells(): Where active cell assignment should hook in (alongside existing SLCT-01/02/03 selection logic)
- `_updateSelectionVisuals()`: May need to coordinate with active cell visuals (or a parallel `_updateActiveCellVisuals()`)
- `SuperGridSelect._handlePointerUp()`: Background clicks (zone === 'grid') should clear active cell
- `supergrid.css`: New classes (`sg-cell--active`, `sg-col--active-crosshair`, `sg-row--active-crosshair`, `sg-fill-handle`) added here
- `design-tokens.css`: New `--sg-active-*` tokens for ring shadow and crosshair tint

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 61-active-cell-focus*
*Context gathered: 2026-03-08*
