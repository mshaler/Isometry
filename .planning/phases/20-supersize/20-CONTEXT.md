# Phase 20: SuperSize - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Direct manipulation column resize for SuperGrid using Pointer Events API. Users can drag column header edges to resize, double-click to auto-fit, Shift+drag to bulk-resize, and widths persist across sessions via PAFVProvider Tier 2 persistence.

Requirements: SIZE-01 (drag resize), SIZE-02 (auto-fit), SIZE-03 (Shift+drag bulk), SIZE-04 (Tier 2 persistence).

</domain>

<decisions>
## Implementation Decisions

### Resize interaction feel
- 8px drag handle hit zone on the right edge of leaf column headers (standard spreadsheet feel — matches Excel/Google Sheets)
- Live resize during drag — column width updates in real time as user drags (no ghost line)
- Only leaf-level column headers have resize handles — parent spanning headers do not
- Cursor changes to `col-resize` on hover over the 8px handle zone

### Zoom × resize interplay
- Custom column widths scale proportionally with zoom (stored as base values, rendered as base × zoomLevel)
- Shift+drag normalizes ALL columns to equal width (the dragged width) — a "make all columns this size" gesture
- Shift+drag normalizes to the base width (÷ zoom), so the uniform result is zoom-aware

### Auto-fit behavior
- Double-click auto-fit measures widest visible cell in the column AND the header text — fits to whichever is wider
- Only leaf columns support auto-fit (consistent with resize handles being leaf-only)

### Persistence scope
- Column widths reset to defaults when axes change (different axes produce different columns — old widths are meaningless)
- Row header column stays fixed at 160px (ROW_HEADER_WIDTH) — not resizable in this phase
- Stale persisted width keys (columns that no longer exist in current data) are silently ignored on restore
- New columns (not in persisted state) get the default width (BASE_COL_WIDTH = 120px)

### Claude's Discretion
- Minimum column width (somewhere around 40-80px based on header readability)
- Maximum column width (or no cap — based on grid scrolling behavior)
- Auto-fit padding (breathing room beyond measured content)
- Auto-fit maximum cap (whether to prevent auto-fit from making unreasonably wide columns)
- Width storage formula when resizing while zoomed (divide by zoom to get base, or another approach)
- Reset gesture for clearing all custom widths back to defaults
- Storage location for column widths (PAFVState extension vs separate provider — follow existing patterns)

</decisions>

<specifics>
## Specific Ideas

- Shift+drag should feel like a "normalize columns" gesture — all columns become the same width as the one being dragged
- Live resize should feel like Notion/Linear/Excel — immediate, no delay, no animation during drag
- The interaction should not conflict with existing header click actions (collapse) or axis drag-and-drop (HTML5 DnD)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperStackHeader.buildHeaderCells()`: Already computes HeaderCell[] with colStart, colSpan, level, isCollapsed — resize handles should attach to the right edge of level=leafLevel cells
- `SuperStackHeader.buildGridTemplateColumns()`: Currently produces `repeat(N, var(--sg-col-width, 120px))` — needs to change to per-column widths (e.g., individual column size values instead of uniform repeat)
- `SuperZoom`: Sets `--sg-col-width`, `--sg-row-height`, `--sg-zoom` CSS custom properties — per-column widths create a new pattern where each column has its own base width × zoom
- `PAFVProvider.toJSON()/setState()`: Tier 2 persistence already round-trips PAFVState — column widths can be added to this state shape
- `SuperPositionProvider`: Manages zoom level with clamped setter — zoom × resize scaling reads from here

### Established Patterns
- CSS Custom Properties for dynamic sizing: `--sg-col-width`, `--sg-row-height`, `--sg-zoom` (SuperZoom pattern)
- D3 data join for cell rendering in `_renderCells()` — resize should NOT trigger re-query, only re-render column widths
- `setPointerCapture()` not yet used in codebase but is the standard Pointer Events API approach for drag tracking
- PAFVState shape: `{ viewType, xAxis, yAxis, groupBy, colAxes, rowAxes }` — column widths map would extend this

### Integration Points
- `SuperGrid._renderCells()`: Currently calls `buildGridTemplateColumns(colLeafCount)` — must pass per-column widths
- `SuperGrid.mount()`: Wire Pointer Events on header cells (pointerdown/pointermove/pointerup) with setPointerCapture
- `PAFVProvider._state`: Extend PAFVState interface with optional colWidths map
- `SuperZoom.applyZoom()`: Currently sets uniform `--sg-col-width` — needs to work with per-column widths (or SuperGridSizer handles its own CSS var updates)
- Header cell click handlers (collapse) must not conflict with the 8px resize handle zone

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-supersize*
*Context gathered: 2026-03-04*
