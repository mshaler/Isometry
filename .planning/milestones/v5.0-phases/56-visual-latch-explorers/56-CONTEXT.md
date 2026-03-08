# Phase 56: Visual + LATCH Explorers - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a vertical zoom slider rail alongside SuperGrid within a Visual Explorer wrapper, and populate the existing LATCH collapsible section with per-axis filter controls wired to FilterProvider. No new filter operators, no new axes, no new views.

</domain>

<decisions>
## Implementation Decisions

### Zoom slider design
- Continuous slider (not stepped) -- smooth analog feel matching existing wheel zoom behavior
- Percentage label visible near the slider, updating in real time during drag (e.g., "150%")
- Clicking the percentage label resets zoom to 100% (mirrors existing Cmd+0 shortcut)
- Small min/max labels at rail ends: "50%" at bottom, "300%" at top
- Arrow keys nudge zoom when slider is focused (standard slider a11y pattern)
- Subtle tick mark on the rail at the 1.0x baseline position for orientation
- Narrow rail width (~24-32px including padding) to minimize SuperGrid space impact

### Visual Explorer layout
- Zoom rail sits **outside** the scrollable SuperGrid area, to its left -- always visible regardless of horizontal scroll
- Collapsing the Visual Explorer section hides both zoom rail and SuperGrid together
- Visual Explorer **replaces** the current `view-content` div as the flex:1 bottom container -- no extra nesting; contains horizontal flex row: [zoom rail | SuperGrid scroll area]
- Zoom rail **only visible when SuperGrid is the active view** -- hidden for Network, Tree, Timeline, and other views

### LATCH filter controls
- **Category** fields (folder, status, card_type): multi-select checkbox lists showing all distinct values -- maps to FilterProvider.setAxisFilter() IN clause
- **Time** fields (created_at, modified_at, due_at): preset range buttons (Today, This Week, This Month, This Year, Custom) -- maps to FilterProvider gte/lte operators
- **Alphabet** (name): text search input using FilterProvider 'contains' operator -- complements existing FTS in CommandBar
- **Hierarchy** (priority, sort_order): checkbox lists like Category
- **Location**: empty state placeholder ("No location properties available") since location fields are FilterField-only, not AxisFields

### LATCH section structure
- Each LATCH axis (L, A, T, C, H) is its own sub-collapsible section inside the LATCH panel -- reuses CollapsibleSection or lighter variant
- Active filter count badge per axis header (e.g., "Category (2)") -- uses FilterProvider.getAxisFilter() to compute; badge hidden when no filters active
- Collapse state persisted to localStorage with keys like `workbench:latch-L`, `workbench:latch-A`, etc. -- matches existing CollapsibleSection pattern
- Conditional "Clear all" link/button at top of LATCH panel -- only visible when at least one axis filter is active; calls FilterProvider.clearAllAxisFilters()

### Claude's Discretion
- Exact slider thumb styling and colors (respecting design tokens)
- How preset time ranges compute their date boundaries
- Whether text search input debounces or fires on each keystroke
- How checkbox list values are fetched (SQL DISTINCT query vs provider cache)
- Internal DOM structure details for the Visual Explorer flex row

</decisions>

<specifics>
## Specific Ideas

- Zoom slider should feel like a utility control, not a primary UI element -- narrow and unobtrusive
- The 1x baseline tick mark helps users orient quickly ("am I zoomed in or out?")
- Click-to-reset on the percentage label is a power-user affordance that complements the existing Cmd+0 shortcut

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperZoom` (src/views/supergrid/SuperZoom.ts): Already handles wheel zoom via CSS custom properties (--sg-col-width, --sg-row-height, --sg-zoom). The new slider needs to call the same SuperPositionProvider.zoomLevel setter and SuperZoom.applyZoom()
- `SuperPositionProvider` (src/providers/SuperPositionProvider.ts): Stores zoomLevel clamped to [ZOOM_MIN=0.5, ZOOM_MAX=3.0] with getter/setter. The slider reads/writes this provider
- `FilterProvider` (src/providers/FilterProvider.ts): Full axis filter API -- setAxisFilter(), clearAxis(), hasAxisFilter(), getAxisFilter(), clearAllAxisFilters(), subscribe(). LATCH controls wire directly to this
- `CollapsibleSection` (src/ui/CollapsibleSection.ts): Reusable collapsible panel with localStorage persistence, chevron, count badge, ARIA disclosure pattern. Can be reused or adapted for LATCH sub-sections
- `LATCH_FAMILIES`, `LATCH_ORDER`, `LATCH_LABELS`, `LATCH_COLORS` (src/providers/latch.ts): Constants mapping AxisFields to LATCH families with colors and labels

### Established Patterns
- Explorer lifecycle: mount() / update() / destroy() pattern (PropertiesExplorer, ProjectionExplorer)
- D3 selection.join for rendering lists (ProjectionExplorer chips, PropertiesExplorer rows)
- Provider subscription: subscribe() returns unsubscribe function, stored as `_unsubXxx` member
- CSS custom property design tokens from Phase 49 theme system
- localStorage keys prefixed with `workbench:` for panel state

### Integration Points
- `WorkbenchShell` already has a LATCH stub section (storageKey: 'latch') -- getSectionBody('latch') returns the container for LatchExplorers
- `WorkbenchShell._viewContentEl` needs to be replaced by the Visual Explorer wrapper
- `main.ts` wires WorkbenchShell.getViewContentEl() to ViewManager -- this wiring must be updated for the Visual Explorer
- SuperZoom.attach() accepts rootEl and gridEl -- the onZoomChange callback can update the slider position
- ViewTabBar or ViewManager active view state determines zoom rail visibility

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 56-visual-latch-explorers*
*Context gathered: 2026-03-07*
