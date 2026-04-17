# Phase 148: MinimapRenderer + Loupe - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Fill the 96x48 thumbnail placeholder boxes (wired in Phase 147) with live minimap thumbnails per dock item. Each thumbnail is a simplified D3 sketch reflecting the current view state with real data colors. A loupe overlay with inverted dimming shows the visible viewport and supports click-to-jump and drag-to-pan. PAFV axis labels overlay the thumbnail as a caption bar. Rendering is lazy (triggered on dock expansion) and off-main-thread via requestIdleCallback staggering.

</domain>

<decisions>
## Implementation Decisions

### Thumbnail Rendering
- **D-01:** Each view type gets a purpose-built mini-renderer (sketch function) that draws a schematic approximation into the 96x48 space. Simplified shapes: colored rectangles for grid cells, dots for network nodes, bars for timelines, etc.
- **D-02:** Sketches use actual data colors (category hues, density colors from the real view) — not monochrome silhouettes. The thumbnail should visually connect to the full-size view.
- **D-03:** Thumbnail renders into an inline `<svg>` element inside the existing `div.dock-nav__item-thumb` container. Stays in the D3/SVG world consistent with the rest of the codebase. No `<canvas>` elements.

### Loupe Overlay
- **D-04:** Loupe is fully interactive: click anywhere on the thumbnail to jump the main view to that area, drag to scrub/pan the viewport continuously. Needs pointer capture for drag.
- **D-05:** Inverted dimming style: the area outside the current viewport is covered with a semi-transparent dark overlay. The viewport area itself is clear (no fill, no tint). Common in image editors — strongest visual clarity at small sizes.

### PAFV Axis Labels (DOCK-05)
- **D-06:** Axis labels render as icon + field name pairs stacked vertically (tiny P/A/F/V glyph followed by the mapped field name).
- **D-07:** Labels are overlaid on the thumbnail as a semi-transparent caption bar at the bottom of the minimap — similar to video subtitle bars. No extra vertical space consumed outside the 96x48 area.

### Trigger & Lifecycle
- **D-08:** Thumbnails render lazily on dock expansion to Icon+Thumbnail state. All visible dock items get thumbnails, staggered via requestIdleCallback to avoid blocking the main thread (MMAP-04).
- **D-09:** No rendering occurs while dock is in Hidden or Icon-only state — thumbnails are not live-subscribed to state changes when invisible.
- **D-10:** While dock IS in Icon+Thumbnail state, state changes (filter changes, PAFV changes, data imports, view switches) trigger a debounced re-render of affected thumbnails. Fresh while visible, stale while collapsed.

### Claude's Discretion
- Mini-renderer function signatures and where they live (per-view-file vs centralized MinimapRenderer module)
- requestIdleCallback stagger strategy (batch size, priority hints)
- Debounce interval for state-change re-renders
- Pointer capture implementation details for drag-to-pan
- How the dimming overlay SVG is structured (clip-path vs multiple rects)
- Caption bar opacity level and text styling for PAFV labels
- How to obtain scroll/viewport position from each view type for loupe positioning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### DockNav Component (Phase 146-147 output)
- `src/ui/DockNav.ts` — DockNav class with `CollapseState` type, `_applyCollapseState()`, `dock-nav__item-thumb` placeholder div creation (line 125-128), `_itemEls` Map for composite key lookup
- `src/styles/dock-nav.css` — `.dock-nav__item-thumb` placeholder (96x48, dashed border), `.dock-nav--icon-thumbnail` state styles (160px width)

### View System (render targets for mini-renderers)
- `src/views/types.ts` — `ViewLike` interface with `render(cards: CardDatum[]): void`, `CardDatum` type definition
- `src/views/ViewManager.ts` — View lifecycle, announcer interface, active view tracking
- `src/views/GridView.ts` — DOM-based grid rendering
- `src/views/NetworkView.ts` — D3 force simulation SVG rendering
- `src/views/TimelineView.ts` — D3 SVG timeline rendering
- `src/views/TreeView.ts` — D3 SVG tree rendering
- `src/views/CardRenderer.ts` — Shared card rendering utilities
- `src/views/pivot/` — SuperGrid / PivotGrid rendering

### Navigation Data Model
- `src/ui/section-defs.ts` — DOCK_DEFS array, DockSectionDef interface, viewOrder array

### State & Providers
- `src/providers/StateManager.ts` — ui_state persistence API, PAFV state access
- `src/worker/handlers/ui-state.handler.ts` — Worker-side ui_state handlers

### Theme Tokens
- `src/styles/design-tokens.css` — `--accent`, `--text-muted`, `--bg-primary`, `--border-subtle` tokens used across all 5 themes

### Requirements
- `.planning/REQUIREMENTS.md` — MMAP-01 (96x48 thumbnail), MMAP-02 (lazy render), MMAP-03 (loupe overlay), MMAP-04 (off main thread), DOCK-05 (PAFV axis labels)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `dock-nav__item-thumb` div: Already created per dock item in DockNav.ts (line 125-128), styled at 96x48 with dashed border placeholder in dock-nav.css. Phase 148 replaces the placeholder content with live SVG.
- `src/ui/icons.ts` — `iconSvg()` helper for Lucide SVGs. Could be extended or paralleled for PAFV axis glyphs.
- D3 color scales and category hue assignments exist across views — mini-renderers should read from the same source.

### Established Patterns
- All views implement `ViewLike.render(cards)` with D3 data joins — mini-renderers can follow a similar pattern but targeting the thumbnail SVG
- Event delegation pattern in DockNav (single click handler on `_navEl`) — loupe pointer events should follow this pattern
- requestIdleCallback is not used anywhere yet — this will be the first usage

### Integration Points
- `DockNav._applyCollapseState()` — Thumbnail render trigger when transitioning to `icon-thumbnail` state
- `ViewManager` state change events — Source for re-render triggers (filter changes, PAFV changes, view switches)
- Each view's internal data/state — Mini-renderers need access to the current cards and visual configuration to produce accurate sketches

</code_context>

<specifics>
## Specific Ideas

No specific external references — decisions above fully capture the vision.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 148-minimaprenderer-loupe*
*Context gathered: 2026-04-11*
