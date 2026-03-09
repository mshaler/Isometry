# Phase 59: Value-First Rendering - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace pill element rendering in SuperGrid spreadsheet-mode cells with plain text card names and an inline +N overflow badge for multi-card cells. Matrix mode is untouched. No new capabilities — this is a rendering refactor within the existing _renderCells() pipeline.

</domain>

<decisions>
## Implementation Decisions

### +N Badge Format
- Inline suffix on the same line as the card name: "Card Name +3"
- Same font size as the card name, colored with --text-muted (no background, no chip styling)
- Text format is "+N" (not "+N more") — compact, spreadsheet-native
- Card name truncates with ellipsis when cell is narrow; +N badge always remains visible (requires two-element layout: flex name with overflow:hidden + fixed-width badge span)

### Tooltip Content & Behavior
- Tooltip triggers on mouseenter of the +N badge (.sg-cell-overflow-badge), not the cell body
- Tooltip lists ALL cards in the cell (including the first visible one), showing card names (not IDs)
- Header shows "{N} cards" count
- Clicking a card name in the tooltip adds it to the selection set (consistent with existing SuperCard tooltip behavior)
- Tooltip stays open for multi-select; dismissed on mouseleave (with small delay for moving cursor into tooltip)

### SuperCard in Classic Mode
- SuperCard count element is removed entirely from spreadsheet-classic mode
- The +N badge replaces the SuperCard's role as overflow indicator
- The +N badge tooltip replaces the SuperCard tooltip for card discovery
- Matrix mode SuperCard rendering remains completely untouched
- Clicking the cell body triggers normal cell selection (SLCT-01/02/03) — no special multi-card cell-body behavior

### Visual Distinction
- No visual difference between single-card and multi-card cells beyond the +N badge
- No special hover affordance on single-card cells — plain text, spreadsheet-clean
- Empty cells keep existing .sg-cell.empty-cell styling (Phase 58 baseline)
- Card name text scales with SuperZoom: calc(var(--sg-cell-font-size) * var(--sg-zoom, 1))
- Default cursor on +N badge (no pointer/help cursor) — tooltip appears naturally on hover

### Claude's Discretion
- Exact mouseleave delay timing for tooltip dismissal
- FTS5 <mark> highlighting adaptation from .card-pill selector to new plain-text elements
- Card name cache (VFST-02) implementation details (Map<id, name> structure, invalidation timing)
- Tooltip positioning logic (reuse/adapt existing SuperCard tooltip or build lightweight version)

</decisions>

<specifics>
## Specific Ideas

- "Spreadsheet-native feel" — cells should look like data in a spreadsheet, not UI widgets
- The +N badge should be subtle enough that single-card cells and multi-card cells look nearly identical at a glance — the badge is informational, not a call to action
- Card name truncation with guaranteed +N visibility mirrors how Excel handles cell overflow indicators

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `_openSuperCardTooltip()` (SuperGrid.ts ~L2220): Existing tooltip with card list, click-to-select, click-outside dismiss — can be adapted for +N badge hover tooltip
- `sg-cell` CSS class (supergrid.css): Already has overflow:hidden, text-overflow:ellipsis, flex layout — foundation for plain text rendering
- `cardNames[]` in CellPlacement data (SuperGrid.ts ~L1525): Card names already fetched and available in the D3 join data
- `.overflow-badge` class (SuperGrid.ts ~L1958): Existing class name for overflow indicator — can be renamed to `.sg-cell-overflow-badge` per VFST-03
- Design tokens `--sg-*` family (design-tokens.css): --sg-cell-font-size, --sg-zoom scaling established in Phase 58

### Established Patterns
- DOM construction (not innerHTML) for XSS safety — all cell content built via createElement/appendChild
- D3 data join in `_renderCells()` — cell content rebuilt on each render cycle
- `var(--sg-zoom, 1)` scaling applied to all font sizes via calc()
- rAF-deferred click-outside listener pattern for tooltips/dropdowns

### Integration Points
- `_renderCells()` spreadsheet branch (SuperGrid.ts ~L1933-1963): Direct replacement zone — pill rendering loop becomes plain text + badge
- FTS5 mark highlighting (SuperGrid.ts ~L2069): Currently walks `.card-pill` elements — must adapt to new text node structure
- SuperCard prepend block (SuperGrid.ts ~L1965-1987): Entire block removed for spreadsheet mode
- SuperCard tooltip method: Adapted or replaced for hover-triggered +N badge tooltip
- Search opacity/dimming logic (SuperGrid.ts ~L2039): hasSuperCard check needs updating since SuperCard is removed from classic mode

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 59-value-first-rendering*
*Context gathered: 2026-03-08*
