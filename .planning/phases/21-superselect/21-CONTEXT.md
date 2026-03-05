# Phase 21: SuperSelect - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can select cells in SuperGrid via click, Cmd+click, Shift+click (2D rectangular range), lasso drag, and header select-all. Z-axis click zone discrimination distinguishes header clicks from data cell clicks from future SuperCard clicks. A post-render bounding box cache prevents layout thrash during lasso. Selection is purely visual + ephemeral (Tier 3 — never persisted).

</domain>

<decisions>
## Implementation Decisions

### Selection Visuals
- Selected cells get both a semi-transparent blue background tint AND a blue border ring — maximum clarity, especially during lasso drag
- Match existing blue accent (#1a56f0) already used in TreeView/NetworkView for consistency across all views
- Floating badge showing "N cards selected" in grid corner — disappears when selection clears

### Empty Cell Selectability
- All cells are selectable, including empty cells (count: 0) — they contribute zero cards but participate in lasso rectangles and Shift+click ranges for consistent spatial behavior

### Lasso Interaction
- Plain mousedown + drag on grid area starts lasso — no modifier required (like Figma/Finder)
- Rubber-band rendered as blue dashed rectangle with semi-transparent blue fill — classic macOS/Finder style
- Live highlight during drag — cells light up as the lasso crosses them (requires bounding box cache SLCT-08)
- Cmd+lasso adds to existing selection (without Cmd, lasso replaces) — matches Cmd+click pattern

### Header Click Zones
- Cmd+click header = select all cards under that header (plain click = collapse, as existing)
- Both row and column headers support select-all — consistent axes
- Header select-all follows same modifier rules as cells: plain click replaces selection, Cmd+click adds
- Build a z-axis zone discriminator now (header / data cell / SuperCard zone) — SuperCard zone is a no-op placeholder until Phase 27

### Shift+Click 2D Range
- Rectangular block selection (Excel-style): anchor cell × target cell defines a rectangle, all cells in the block are selected
- Empty cells included in the rectangle — consistent with "all cells selectable" decision
- Anchor stays fixed at the first click; each subsequent Shift+click extends/reshapes from the anchor (Excel behavior)
- Headers have their own select-all behavior — Shift only applies to data cells

### Claude's Discretion
- Bounding box cache implementation strategy (Map<string, DOMRect> vs alternative)
- Cache invalidation timing (post-render vs requestAnimationFrame vs ResizeObserver)
- SVG vs HTML overlay for lasso rubber-band rendering
- Exact selection highlight opacity/color values
- How SelectionProvider.range() is extended or superseded for 2D rectangular selection
- Keyboard accessibility for selection (beyond Escape to clear)
- Performance budget for lasso hit-testing

</decisions>

<specifics>
## Specific Ideas

- Selection should feel like macOS Finder — blue tint, dashed lasso, live highlighting
- Z-axis zone system should be forward-compatible with SuperCards (Phase 27) without needing a rewrite
- The existing SelectionProvider.range(id, allIds) works linearly — a new 2D range method or wrapper will be needed for rectangular block selection
- Bounding box cache is the critical performance gate — lasso must NOT trigger forced layout/reflow

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SelectionProvider` (src/providers/SelectionProvider.ts): Full selection state manager with `select()`, `toggle()`, `range()`, `selectAll()`, `clear()`, microtask-batched subscribers. Already used by TreeView/NetworkView.
- `SelectionProviderLike` interface (src/views/TreeView.ts): Narrow interface for view injection — `toggle()`, `addToSelection()`, `subscribe()`, `getSelected()`
- TreeView/NetworkView selection wiring: Click → `toggle()`, Shift+click → `addToSelection()`, subscription → visual update. Pattern to follow.

### Established Patterns
- **Dependency injection**: SuperGrid takes providers/bridge/coordinator in constructor — new SelectionProvider should follow same pattern
- **Narrow interfaces**: SuperGrid uses `SuperGridProviderLike`, `SuperGridFilterLike`, `SuperGridBridgeLike` — add `SuperGridSelectionLike`
- **D3 data join**: Data cells rendered via `gridSelection.selectAll('.data-cell').data(cellPlacements, d => ...)` — selection visuals plug into the `.each()` callback
- **Module-level singleton**: Axis DnD uses `_dragPayload` module-level var — lasso state may need similar pattern
- **Sticky positioning**: Headers use `position: sticky` with z-index 2-3 — lasso overlay must be layered correctly

### Integration Points
- `SuperGrid._renderCells()`: Add selection class/style in the `.each()` callback based on SelectionProvider state
- `SuperGrid.mount()`: Wire SelectionProvider subscription, attach lasso pointer handlers, wire Escape keydown
- `SuperGrid.destroy()`: Unsubscribe from SelectionProvider, remove lasso handlers, clear bounding box cache
- `SuperGrid._createColHeaderCell()`: Add Cmd+click branch for select-all alongside existing collapse handler
- Row header creation block: Add Cmd+click for row select-all
- `CellDatum.card_ids`: Already contains card IDs per cell — pipe these into SelectionProvider on click

</code_context>

<deferred>
## Deferred Ideas

- SuperCard click behavior (tooltip/aggregation) — Phase 27
- Selection-based bulk actions (delete, move, tag) — future phase
- Selection persistence across view switches — D-005 says selection is Tier 3, never persisted
- Drag-to-reorder selected cards — separate interaction pattern

</deferred>

---

*Phase: 21-superselect*
*Context gathered: 2026-03-04*
