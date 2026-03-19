# Phase 94: Card Dimension Rendering - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Cards render at 4 discrete dimension levels (1x, 2x, 5x, 10x) controlled by CSS data attributes, with user-selectable switching via a Workbench panel and per-view persistence in ui_state. Dimension switching is CSS-driven — no SuperGrid re-query or D3 data join rebuild. Card-based views (List, Grid, Gallery, Kanban, SuperGrid) get dimension support; SVG-only views (Network, Tree, Timeline, Calendar) are excluded.

</domain>

<decisions>
## Implementation Decisions

### Dimension level visuals
- **1x (compact)**: Single-line row with card_type icon badge + truncated name only. Minimal — like a file browser compact view
- **2x (preview)**: Icon + full title + first 2 lines of content/summary truncated with ellipsis. Email inbox preview style
- **5x (full card)**: Full header + content + tags + collapsible properties section. Properties section CLOSED by default — user clicks to expand per card
- **10x (hero/detail page)**: Full card detail page that takes over the view area. Shows all fields, full content rendered as markdown, properties displayed below content. Like opening a Notion page. NOT a density level — triggered per card, not per view

### Where dimensions apply
- Card-based views ONLY: List, Grid, Gallery, Kanban, SuperGrid
- Excluded views: Network, Tree, Timeline, Calendar (these use SVG node/chip rendering that doesn't map to dimension levels)
- SuperGrid: YES — dimension levels change how cells render their card lists. At 1x cells show counts, at 2x show card names, at 5x show mini-cards with content previews
- 10x is single-card-only — triggered on a specific card (not a view-wide density setting). Other views' 1x/2x/5x is a view-wide density setting

### Switcher UI
- Location: Workbench sidebar panel (new DimensionExplorer or added to existing VisualExplorer)
- Control style: Segmented buttons showing `1x | 2x | 5x` as toggles. 10x is separate since it's a per-card action, not a view density
- 10x trigger: Double-click card OR press Enter on selected card. Both gestures open the detail page
- 10x exit: Click outside the detail content area OR press Escape to return to previous view at previous dimension level

### Rendering strategy
- Migrate List and Grid views from SVG card rendering to HTML card rendering (Gallery and Kanban already use HTML cards)
- All card-based views use a unified HTML card renderer with CSS dimension classes
- `data-dimension` attribute on the parent container (view root), NOT per card. CSS rules like `[data-dimension="1x"] .card { ... }` switch all cards at once
- Matches the existing `data-view-mode` pattern from SuperGrid (Phase 58)
- D3 data join still works — binds to `div.card` elements instead of `g.card`
- SVG-only views (Network, Tree, Timeline) keep their existing SVG rendering unchanged
- Dimension switching is INSTANT — no transition animation. Consistent with existing view switches

### Persistence
- Dimension level (1x/2x/5x) persisted per view in ui_state table via existing StateManager pattern
- Key convention: `dimension:{viewType}` (e.g., `dimension:list`, `dimension:supergrid`)
- Default dimension: 2x when no persisted value exists

### Claude's Discretion
- Exact CSS sizing values for each dimension level (card heights, widths, padding)
- How to handle the List→HTML and Grid→HTML migration (incremental or single pass)
- DimensionExplorer panel design details (whether it's a new explorer or a section in VisualExplorer)
- SuperGrid cell rendering details at each dimension level
- 10x detail page layout and markdown rendering approach

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Card rendering (migration target)
- `src/views/CardRenderer.ts` — Current `renderSvgCard` and `renderHtmlCard` functions, `CARD_DIMENSIONS` constants, `CARD_TYPE_ICONS`
- `src/views/ListView.ts` — SVG list view to migrate to HTML cards
- `src/views/GridView.ts` — SVG grid view to migrate to HTML cards
- `src/views/GalleryView.ts` — Existing HTML card view (reference pattern)
- `src/views/KanbanView.ts` — Existing HTML card view with D3 data join on divs

### SuperGrid (dimension integration)
- `src/views/SuperGrid.ts` — Cell rendering, `data-view-mode` attribute pattern (Phase 58)
- `src/styles/supergrid.css` — `[data-view-mode]` CSS selector pattern to replicate for `[data-dimension]`

### State persistence
- `src/providers/StateManager.ts` — ui_state read/write pattern
- `src/providers/SuperDensityProvider.ts` — Existing density provider (dimension system is INDEPENDENT of this, per DIMS-02)

### Architecture decisions
- `CLAUDE-v5.md` — D-001..D-011 locked architecture decisions

### Prior phase context
- `.planning/phases/93-property-editors/93-CONTEXT.md` — Property panel layout, collapsible sections pattern (reuse for 5x properties display)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderHtmlCard(d: CardDatum)`: Already creates HTML card elements for Kanban/Calendar. Will be the base for the unified dimension-aware card renderer
- `CARD_TYPE_ICONS`: Card type badge characters — reuse at all dimension levels
- `data-view-mode` attribute pattern: SuperGrid already sets `data-view-mode` on its container and uses CSS `[data-view-mode="spreadsheet"]` selectors. Replicate this pattern with `data-dimension`
- `CardPropertyFields` (Phase 93): Collapsible property sections — reuse or reference for 5x property display

### Established Patterns
- D3 HTML data join: KanbanView already does `selection.selectAll('div.card').data(cards).join(enter => enter.append(d => renderHtmlCard(d)))`. List/Grid migration follows this pattern
- `ui_state` persistence: CalcExplorer uses `bridge.send('ui:set', { key: 'calc:config' })` and `bridge.send('ui:get', { key: 'calc:config' })`. Dimension persistence follows identical pattern
- `[data-attribute]` CSS selectors: SuperGrid uses `[data-view-mode]` for mode-scoped CSS. Dimension uses `[data-dimension]` identically

### Integration Points
- `ViewManager`: Needs to read dimension from ui_state on view mount and set `data-dimension` on view container
- `WorkbenchShell`: New DimensionExplorer panel (or VisualExplorer section) with segmented button control
- `StateCoordinator`: Dimension change notification so views re-layout if needed (for card height changes)

</code_context>

<specifics>
## Specific Ideas

- 10x detail page should feel like opening a Notion page — full content, all metadata, clean layout
- The segmented `1x | 2x | 5x` buttons should match the existing Workbench panel control styling
- SuperGrid at 1x showing counts only is reminiscent of a pivot table — lean into that

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 94-card-dimension-rendering*
*Context gathered: 2026-03-19*
