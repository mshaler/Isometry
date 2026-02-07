# Phase 37: Grid Continuum - Context

**Gathered:** 2026-02-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver seamless transitions between list, kanban, and SuperGrid projections of the same dataset with preserved user context (selection, filters, focus position). Gallery view is deferred.

### Terminology Precision

- **List**: 1-axis projection (single LATCH axis drives ordering/grouping)
- **Kanban**: 1-facet column projection (a Category facet drives columns)
- **SuperGrid**: Full PAFV 2D projection with hierarchical headers, zoom/pan density, the existing `SuperGrid` class

"Grid" is ambiguous and should not be used alone in code or documentation. The existing `SuperGrid` class IS the 2D grid — there is no separate "grid" view.

### Core Insight

View transitions are PAFV axis-to-plane remappings, not data changes. The same cards, same LATCH filters, same selection state — only the spatial projection changes. This is the "any axis can map to any plane" principle from the architecture truth document.

</domain>

<decisions>
## Implementation Decisions

### Transition animation
- Morph/FLIP animation style using D3 transitions (consistent with Phase 36 morphing boundaries)
- 300ms duration with `d3.easeCubicOut` easing ("quiet app" aesthetic)
- Animations are interruptible — if user triggers another view switch mid-transition, `selection.interrupt()` and redirect
- No user-configurable duration (defer to settings phase)

### Context preservation across view switches
- **Selection state**: Persists as a set of card IDs (view-independent). Cards that aren't visible in the new view remain in the selection set but aren't rendered with highlight. If they reappear (filter change), they're still selected.
- **LATCH filters**: Persist exactly across all view transitions. Filters are data operations, not view operations.
- **View-specific axis assignments**: Each view type stores its own PAFV axis-to-plane mapping. Kanban's "group by status" = Category axis → x-plane. Switching views loads that view's last-used mapping (or its default mapping on first use).
- **Focus/scroll position**: Track focused card by ID (semantic position), not pixel coordinates. After transition, auto-scroll with animation to keep focused card visible (roughly center-viewport). If focused card is filtered out in new view, fall back to top-left with a brief toast notification.

### View switching interface
- Toolbar with view type icons (standard Finder/Numbers pattern)
- Keyboard shortcuts: `Cmd+1` = List, `Cmd+2` = Kanban, `Cmd+3` = SuperGrid (not bare numbers — those should type into search/rename fields)
- View choice persists per-canvas (different datasets have different natural views), stored as canvas metadata
- Pinch-to-zoom gesture between view densities: **deferred**

### List view (1-axis projection)
- Default axis: Hierarchy (H) — folder/nesting structure
- Supports nested hierarchies via NEST edges (flat list = hierarchy with depth 1)
- Respects current LATCH sort; default sort: `modified_at DESC`

### Kanban view (1-facet columns)
- Default column facet: `status` (universal UX convention)
- User can change column facet to any Category (C) axis facet
- Columns only — no swimlanes (swimlanes = SuperGrid territory, already exists)
- Cards within columns sorted by current LATCH sort

### SuperGrid (full PAFV 2D projection)
- This is the existing `SuperGrid` class — no new class needed
- Default axis assignment: Category × Time (folder × modified_at)
- Empty cells render as blank with subtle dashed border (informative whitespace)
- Zoom/pan state persists independently per-canvas; restored when returning to SuperGrid view

### Data layer
- **One query, multiple projections**: The base SQL query (WHERE clause from LATCH filters) stays the same across all views. Only the D3 layout function changes. This guarantees card consistency — no phantom additions/removals.
- **No pre-caching**: Query once, cache the result set in memory, re-project on view switch. Re-query only when LATCH filters change.
- **Large datasets**: Virtual scrolling (Phase 26) applies to all views. View transitions only animate visible cards, not the full dataset.

### Missing data handling
- If switching to a view that requires data the cards don't have (e.g., kanban needs status but cards have no status field), show the view with available data and display a non-blocking message: "Some cards lack [field] and appear in 'Unassigned' column"
- Insufficient LATCH dimensions for 2D grid: gracefully degrade to 1D (one populated axis becomes the primary, the other collapses to a single group)

### State architecture
- New `ViewState` type tracks: current view type, per-view axis mappings, per-view scroll/zoom state, focused card ID
- `ViewState` stored per-canvas in `localStorage` (consistent with Phase 36 Janus state persistence pattern), database persistence deferred
- View switch triggers: save current view state → load target view state → re-project data → animate transition

### What this phase does NOT include
- Gallery/icon view (deferred)
- Timeline view (separate phase — requires time-axis-specific rendering)
- Network/graph view (separate phase — requires force simulation)
- View preview thumbnails before switching
- Custom per-user view definitions
- Pinch-to-zoom gesture between view densities

</decisions>

<specifics>
## Specific Implementation Notes

### New files expected
- `src/d3/ListView.ts` — 1-axis list projection using D3, same SVG container pattern as SuperGrid
- `src/d3/KanbanView.ts` — 1-facet column projection using D3
- `src/d3/ViewContinuum.ts` — orchestrator that manages view switching, state preservation, and transition animation between ListView, KanbanView, and SuperGrid
- `src/types/views.ts` — ViewType enum, ViewState interface, ViewAxisMapping interface
- `src/components/ViewSwitcher.tsx` — React toolbar component for view type selection with keyboard shortcut registration

### Files modified
- `src/components/SuperGridDemo.tsx` — integrate ViewContinuum and ViewSwitcher, replace direct SuperGrid instantiation with ViewContinuum orchestration
- `src/d3/SuperGrid.ts` — expose methods needed by ViewContinuum (current card positions for FLIP animation, accept pre-queried data instead of self-querying)

### Architecture pattern
The ViewContinuum orchestrator owns the SVG container and delegates rendering to the active view class:

```
ViewContinuum (orchestrator)
├── owns: SVG container element
├── owns: ViewState (current view, per-view states)
├── owns: cached query result (cards from last LATCH filter query)
├── delegates to: ListView | KanbanView | SuperGrid
└── manages: FLIP transition animation between views
```

Each view class (ListView, KanbanView, SuperGrid) must implement a common interface:
- `render(cards, axisMapping, activeFilters)` — project cards into view
- `getCardPositions(): Map<string, {x, y, width, height}>` — for FLIP animation source/target
- `scrollToCard(cardId)` — semantic scroll to focused card
- `destroy()` — cleanup

### FLIP animation flow
1. Capture current card positions from outgoing view: `outgoing.getCardPositions()`
2. Switch active view class
3. Render new view (cards appear at their target positions): `incoming.render(cards, mapping, filters)`
4. Capture target positions: `incoming.getCardPositions()`
5. Calculate FLIP delta for each card (First→Last, Invert, Play)
6. Apply inverted transforms, then animate to identity over 300ms
7. Scroll to focused card

### Keyboard shortcut registration
Register `Cmd+1/2/3` at the React component level (SuperGridDemo or App), not inside the D3 SVG. These are application-level shortcuts, not grid-navigation shortcuts. Use `useEffect` with `keydown` listener on `document`.

</specifics>

<deferred>
## Deferred Ideas

- Gallery/icon view (0-axis projection)
- Timeline view (time-axis-specific rendering with time scale)
- Network/graph view (force simulation, fundamentally different from grid-based views)
- Pinch-to-zoom gesture to fluidly transition between view densities
- View preview thumbnails (show what a view will look like before committing)
- Custom per-user view type definitions
- Combined zoom/pan widget (Phase 36 noted this for later exploration)
- Database-backed ViewState persistence (start with localStorage, migrate later)
- Animated transition path customization

</deferred>

---

*Phase: 37-grid-continuum*
*Context gathered: 2026-02-07*
