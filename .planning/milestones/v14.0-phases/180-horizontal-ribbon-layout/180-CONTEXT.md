# Phase 180: Horizontal Ribbon Layout - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorient DockNav from a vertical sidebar column to a horizontal ribbon bar spanning the full viewport width. Update SuperWidget CSS grid to remove the sidebar column so the canvas reclaims that space. Keyboard navigation switches from ArrowUp/Down to ArrowLeft/Right.

</domain>

<decisions>
## Implementation Decisions

### Section Dividers & Labels
- **D-01:** Verb-noun sections are separated by wider gaps between groups (not vertical pipe dividers).
- **D-02:** Each section has a small uppercase label (INTEGRATE, VISUALIZE, etc.) positioned **above** its group of items — Office-ribbon style with labels on top row, icons+text below.
- **D-03:** Existing `dock-nav__section-header` pattern is preserved conceptually, re-oriented from vertical stacking to horizontal flow.

### Collapse/Thumbnail Removal
- **D-04:** The `icon-only` ↔ `icon-thumbnail` collapse toggle is **removed entirely**. The ribbon always shows icon + text label — no collapse states.
- **D-05:** Minimap thumbnail rendering is **removed** from DockNav. Drop `_thumbnailDataSource`, `MinimapRenderer` integration, loupe interaction, `requestThumbnailUpdate()`, and the `CollapseState` type.
- **D-06:** The toggle button (`.dock-nav__toggle`) is removed from the ribbon DOM.

### Ribbon Density & Overflow
- **D-07:** Ribbon is always a single horizontal row — items never wrap to a second row.
- **D-08:** If items overflow the viewport width, the ribbon scrolls horizontally with subtle indicators (fade edges or chevrons). Canvas height is never reduced by wrapping.

### Active State (carried from Phase 179)
- **D-09:** Same `dock-nav__item--active` accent background for active items (Phase 179 D-03). No visual change to active state styling.

### Claude's Discretion
- Whether to use `overflow-x: auto` with CSS fade masks or JS-driven chevron buttons for scroll indicators
- Exact ribbon height (should be compact — roughly toolbar-height scale, not a tall Office ribbon)
- How to handle the SuperWidget grid transition: whether to introduce a new `ribbon` grid area row or repurpose the existing `sidebar` area
- Whether `dock-nav.css` is refactored in-place or replaced with a new file

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Navigation & Dock
- `src/ui/DockNav.ts` — Current vertical DockNav class; rewrite target for horizontal orientation
- `src/ui/section-defs.ts` — `DOCK_DEFS` array with 5 sections, 12 items total — structure unchanged
- `src/styles/dock-nav.css` — Current vertical dock styling; major refactor target

### Layout Grid
- `src/styles/superwidget.css` lines 5-48 — CSS Grid layout with `sidebar | canvas | sidecar` columns and 4 rows; sidebar must be removed from grid, ribbon row added
- `src/superwidget/SuperWidget.ts` line 59 — Creates `[data-slot="sidebar"]` element; needs ribbon slot instead

### Wiring (Phase 179 context)
- `src/main.ts` lines ~642+ — DockNav mount point (`sidebar slot`); must change to ribbon slot
- `.planning/phases/179-dock-wiring-repair/179-CONTEXT.md` — Prior phase decisions on click wiring and active state

### Thumbnail Code (removal targets)
- `src/ui/MinimapRenderer.ts` — `renderMinimap()` and `attachLoupeInteraction()` — no longer called from DockNav after D-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DOCK_DEFS` array in `section-defs.ts` — unchanged, drives ribbon item generation
- Event delegation pattern (single click handler on nav) — works the same in horizontal layout
- `setActiveItem()` / `setItemPressed()` public API — unchanged interface
- `iconSvg()` from `icons.ts` — same icon rendering

### Established Patterns
- SuperWidget CSS Grid with named areas (`sidebar`, `header`, `tabs`, `canvas`, `status`, `sidecar`)
- Design token usage: `--size-sidebar-icon`, `--bg-surface`, `--border-subtle`, `--accent`, `--text-muted`
- `data-slot` attribute pattern for SuperWidget slot elements
- Roving tabindex for keyboard navigation (reused, but direction changes to horizontal)

### Integration Points
- `SuperWidget.ts` — replace sidebar slot creation with ribbon slot
- `superwidget.css` — remove sidebar column from grid-template, add ribbon row between tabs and canvas
- `main.ts` — change DockNav mount target from sidebar slot to ribbon slot
- `DockNav.ts` — remove all collapse/thumbnail code, change `aria-orientation` to `horizontal`, swap ArrowUp/Down for ArrowLeft/Right

### Code to Remove
- `CollapseState` type and all collapse-related private fields (`_collapseState`, `_toggleEl`, `_contentEl`, `_sidebarEl`)
- `_applyCollapseState()`, `_renderAllThumbnails()`, `requestThumbnailUpdate()`, `setThumbnailDataSource()`, `setNavigateCallback()`
- `_thumbnailDataSource`, `_idleCallbackIds`, `_reRenderTimer`, `_loupeCleanups`, `_onNavigate`
- All `.dock-nav--icon-only` and `.dock-nav--icon-thumbnail` CSS rules
- Toggle button DOM creation and click handler branch
- Bridge calls for `dock:collapse-state` persistence
- `workbench-sidebar--*` classes in DockNav (sidebar container no longer exists)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward reorientation from vertical to horizontal with section labels above and horizontal scroll overflow.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 180-horizontal-ribbon-layout*
*Context gathered: 2026-04-22*
