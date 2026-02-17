# Feature Landscape: Grid Continuum & Polymorphic Views

**Domain:** Polymorphic data projection system (Gallery/List/Kanban/Grid/SuperGrid + Network/Timeline + Three-Canvas)
**Researched:** 2026-02-16
**Confidence:** HIGH
**Research Date:** 2026-02-16

---

## Executive Summary

This research covers the feature expectations for Isometry's Grid Continuum — a continuous spectrum of view modes that render the same data through different PAFV axis allocations. The continuum includes:

- **Gallery** (0-axis): Masonry card layout, visual browsing, minimal structure
- **List** (1-axis): Hierarchical tree with expand/collapse, organized navigation
- **Kanban** (1-facet): Column groups with drag-and-drop workflow, categorical grouping
- **Grid** (2-axis): Tabular layout with row and column headers, dense information
- **SuperGrid** (n-axis): Nested dimensional headers with orthogonal density controls (already built)

Beyond the continuum, three additional specialized views:

- **Network Graph** (topology): Force-directed node-edge visualization, relationship exploration
- **Timeline** (temporal): Horizontal or vertical scrollable axis with event positioning, time navigation
- **Three-Canvas Layout** (container): Resizable panels (Capture/Shell/Preview) integrating all views

All modes operate on the same underlying data (sql.js query results), switching between them via PAFV axis remapping — not data refetching.

---

## Table Stakes Features

Features users expect. Missing these = product feels incomplete or amateurish.

### Gallery View (0-Axis Masonry)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Responsive masonry layout** | Gallery/portfolio standard; images/cards of varying sizes need dense packing | LOW | CSS Masonry or CSS Grid with auto-flow; no JS library needed if using native CSS |
| **Automatic column count** | Users expect layout to adapt to screen width (1 col on mobile, 3-4 on desktop) | LOW | CSS media queries + CSS Grid `auto-fit` or native masonry API |
| **Hover card preview** | Users expect hover effects for visual feedback before click | LOW | CSS `:hover` with shadow/scale, optional tooltip |
| **Click to open detail** | Users expect click to navigate to card detail view or expand inline | LOW | Click handler dispatches selection context |
| **Scroll performance** | Large galleries (100+ items) must scroll smoothly without jank | MEDIUM | Virtual scrolling via TanStack Virtual (already used in SuperGrid) |
| **Image/thumbnail support** | Cards should show visual preview (icon, color, first image in media) | MEDIUM | Conditional rendering based on node properties; D3 can render thumbnail |
| **Card ordering/sorting** | Users expect to control sort order (by name, date, custom) | MEDIUM | LATCH axis or explicit sort control in UI |
| **No text clipping** | Cards should show enough text to understand content, not truncate | LOW | CSS with line clamping for titles, full text on hover |

**Why built correctly in web apps (2026):**
- CSS Masonry is now standard (native support in all modern browsers)
- CSS Grid with `auto-fit` or `auto-fill` + masonry-layout creates dense packing without JavaScript
- Virtual scrolling is essential for performance at 100+ items; TanStack Virtual is production-grade

### List View (1-Axis Hierarchy)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Expand/collapse tree nodes** | Tree view standard for hierarchical data; users expect `+`/`-` icons | LOW | Simple state toggle per node, CSS for `display: none` or D3 animation |
| **Indentation by depth** | Visual hierarchy via left padding; expected in all tree implementations | LOW | CSS margin-left or transform based on node depth |
| **Keyboard navigation** | Up/down arrows, Enter to expand, Escape to collapse (ARIA standard) | MEDIUM | Keyboard event handlers, focus management for accessibility |
| **Smooth expand/collapse animation** | Users expect visual feedback; instant expand feels broken | MEDIUM | CSS transitions or D3 transitions; optional but polish standard |
| **Selection state preservation** | Expanding/collapsing should not clear selection | LOW | State management via React context |
| **Count badges on collapsed nodes** | "Sales (12)" shows how many children, reduces surprise | LOW | SQL COUNT aggregation in query or D3 data preprocessing |
| **Search/filter within tree** | Users expect to filter tree, hiding non-matching branches | MEDIUM | FTS5 full-text search with branch visibility logic |
| **Lazy load children** | For massive trees, load children on expand, not all at once | HIGH | SQL pagination query with depth limits, React lazy loading |

**Why built correctly in web apps (2026):**
- Tree views without full keyboard support feel broken to users
- Expand/collapse animation is now standard expectation (Finder, VS Code, all modern UIs)
- Search filtering is no longer "nice to have"; it's table stakes for navigating 100+ item trees

### Kanban View (1-Facet Columns)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Drag-and-drop between columns** | Kanban fundamental; users expect to move cards without friction | MEDIUM | Use `dnd-kit` or `@hello-pangea/dnd`; both handle touch + mouse |
| **Column headers grouped by facet value** | Each column = one LATCH facet value (Status: "Todo"/"In Progress"/"Done") | LOW | D3.js groups data by facet, renders column headers |
| **Within-column reordering** | Users expect to reorder cards within same column (priority) | MEDIUM | dnd-kit supports drag within same droppable |
| **Visual feedback during drag** | Dragged card should show drag preview, drop zone should highlight | LOW | dnd-kit provides CSS variables for drag state |
| **Card counts per column** | "Todo (5)" shows work distribution, helps capacity planning | LOW | D3.js aggregation in data binding |
| **Column scrolling** | If cards overflow, column should scroll vertically without horizontal scroll | LOW | CSS overflow: auto on column container |
| **Smooth animations on drop** | Card animates to final position, layout reflows smoothly | MEDIUM | CSS transitions or D3 transitions on drop |
| **Persistence of changes** | Drag-and-drop updates the underlying data (SQL UPDATE) | MEDIUM | On drop, call `db.run(UPDATE node SET facet_value = ?)` and re-query |
| **Undo drag changes** | Users expect to undo accidental drags | HIGH | Transaction history or debounced save with rollback capability |

**Why built correctly in web apps (2026):**
- dnd-kit is now standard for Kanban (not react-beautiful-dnd, which is older)
- Touch support is non-negotiable (iPad, hybrid devices)
- Persistence is critical; drag-drop that doesn't save is worse than no drag-drop
- Smooth animations are expected; instant visual updates feel unresponsive

### Grid View (2-Axis)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Fixed headers (sticky rows/columns)** | Column headers and row headers stay visible while scrolling | MEDIUM | CSS `position: sticky` or D3 clip-path with fixed SVG groups |
| **Orthogonal axis allocation** | One axis (e.g., Category) maps to rows; another (e.g., Time) maps to columns | MEDIUM | PAFV axis controller selects facets, SQL GROUP BY generates grid |
| **Cell spanning for hierarchy** | Parent categories span multiple columns; visual grouping of related dimensions | MEDIUM | Nested SVG groups or React wrapper divs with `gridColumn: span N` |
| **Sparse grid handling** | Not all row×column intersections have data; empties are okay | LOW | D3 data join handles missing combinations naturally |
| **Density controls** | Users can zoom/pan (cartographic model) independently of axis grouping | MEDIUM | Separate scale control (extent) from axis depth control (zoom) |
| **Performance at scale** | 100+ rows × 50+ columns = 5000+ cells; must render smoothly | HIGH | Virtual scrolling or HTML Canvas fallback for dense grids |
| **Click cell to select multi-card cell** | Many cells contain multiple cards (same row×column intersection) | MEDIUM | Click expands or shows list; manages multi-selection state |

**Why built correctly in web apps (2026):**
- SuperGrid CSS Grid implementation with sticky headers is now standard (replaced old D3 SVG approach)
- Cartographic model (Pan vs Zoom orthogonal) is new but essential for large datasets
- Virtual scrolling at 5000+ cells is mandatory for 60 FPS performance

### SuperGrid View (n-Axis Nested Headers) ⭐ Already Built

Already implemented in v6.6 with CSS Grid + React. See v6.8 research for complete feature set.

---

## Network Graph View

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Force-directed layout** | Default for network viz; nodes naturally organize by repulsion/attraction forces | MEDIUM | D3.js `d3-force` module with velocity Verlet integration |
| **Node rendering** | Nodes as circles or custom shapes, sized/colored by PAFV properties | LOW | D3 `circle` with attributes bound to data properties |
| **Edge rendering** | Lines connecting nodes, optionally directed (arrows), weighted | LOW | D3 `line` elements with stroke styles; arrowheads via marker-def |
| **Interactive zoom/pan** | Users expect to zoom in/out and pan around (like Google Maps) | LOW | D3 `zoom` behavior, transforms entire SVG group |
| **Hover tooltips** | Hover node to see full name, properties, relationship count | LOW | SVG title elements or React tooltip overlay |
| **Click to select/highlight** | Click node to select and highlight related edges | MEDIUM | D3 selection update on click, fade non-related nodes/edges |
| **Collision detection** | Nodes should not overlap; collision forces prevent this | LOW | D3 collision force with node radius |
| **Connection stability** | Layout should stabilize (not jiggle forever) after ~2-3 seconds | LOW | Set `simulation.alphaTarget(0.3)` then decay to 0 |
| **Performance with 500+ nodes** | Large networks must maintain 60 FPS zoom/pan | HIGH | Culling invisible nodes, canvas rendering as fallback, spatial indexing |
| **Legend for node types** | Different node types (person, task, note) shown with color/icon legend | LOW | React legend panel with type filtering |

**Why built correctly in web apps (2026):**
- Force-directed is the gold standard for network exploration (Palantir, Figma, Obsidian use this)
- D3 force simulation is battle-tested and performant for 500-1000 nodes
- Canvas rendering is needed for 2000+ nodes to maintain 60 FPS
- Zoom/pan is non-negotiable for any network viz

### Network Interactions

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Double-click to expand node** | Shows children of a node in layout (expansion in place) | MEDIUM | Remapping SQL query to include direct children, D3 transitions |
| **Drag node to reposition** | Users expect to drag nodes around (even if temporary) | MEDIUM | D3 drag behavior, simulation restart on drag end |
| **Highlight paths between nodes** | Click node A, click node B → highlight shortest path | HIGH | Dijkstra or breadth-first search in D3, animate path |
| **Filter by edge type** | Toggle "LINK", "NEST", "SEQUENCE", "AFFINITY" edges on/off | MEDIUM | React checkbox controls, re-render filtered edges |
| **Export layout as image/SVG** | Users expect to save visualization | LOW | D3 `svgToPng` library or native `canvas.toBlob()` |

---

## Timeline View (Temporal)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Horizontal scrollable axis** | Time flows left-to-right, events positioned along axis | LOW | D3 scale for time mapping to pixel position |
| **Zoom levels for time granularity** | Zoom 1: Show full year; Zoom 5: Show weeks; Zoom 10: Show days/hours | MEDIUM | Separate zoom control from pan, dynamic tick labels |
| **Event positioning** | Events positioned by `event_date` or `created_at` on timeline | LOW | D3 scaleTime maps date to x-coordinate |
| **Overlapping event handling** | Multiple events on same date stacked vertically (event tracks) | MEDIUM | Collision detection layout, separate swimlanes per track |
| **Tick labels adapt to zoom** | At zoom 1: "2024", "2025"; at zoom 10: "Jan 15", "Jan 16" | MEDIUM | D3 time interval for tick generation, `.tickFormat()` changes with zoom |
| **Event card preview** | Hover event to see full details without clicking | LOW | SVG title or React tooltip |
| **Click event to select** | Click event to select in main grid and highlight across all views | MEDIUM | Dispatch selection context, cross-view highlight |
| **Smooth zoom/pan animation** | Zoom in/out animates smoothly (not instant) | LOW | D3 transitions on scale change |
| **Performance with 1000+ events** | Large timelines must pan/zoom smoothly | HIGH | Virtual rendering (only visible events rendered) or canvas |
| **Today marker** | Current date shown with visual indicator (line, badge) | LOW | Conditional rendering of static marker at today's date |

**Why built correctly in web apps (2026):**
- Timeline zoom with adaptive labels is standard in project management (Asana, Monday.com, Airtable)
- Overlap handling is critical; calendars show this with multiple "tracks"
- Virtual rendering is needed for 1000+ events to maintain smooth interactions
- Today marker is expected in any temporal view

### Timeline Interactions

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Drag event to new date** | Drag an event left/right to reschedule (updates `event_date`) | HIGH | D3 drag behavior on event, update time scale on drag |
| **Drag to create range** | Click-drag from date A to date B to create new event with date range | HIGH | D3 brush or custom range selection, create node with start/end dates |
| **Filter by date range** | Show only events within a range slider | MEDIUM | SQL `WHERE event_date BETWEEN ? AND ?`, re-query on slider change |
| **Group events by category** | Separate swimlanes per category (Status: "Done"/"In Progress") | MEDIUM | D3 group layout, arrange swimlanes vertically |
| **Export timeline as image** | Users expect to save temporal view | LOW | D3 canvas or SVG export |

---

## Three-Canvas Layout Container

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Three resizable panels** | Capture (left), Shell (bottom-left), Preview (right) with draggable dividers | MEDIUM | `react-resizable-panels` or native CSS Grid with `grid-template-columns: [size] 1fr` |
| **Focus mode toggle** | Fullscreen one pane (Capture or Preview), minimize others | LOW | React state toggle, CSS transitions to maximize |
| **Persist layout on reload** | User's preferred pane sizes saved to localStorage or IndexedDB | LOW | Store widths/heights on resize event, restore on mount |
| **Synchronized cross-canvas selection** | Click card in Preview SuperGrid → highlight matching block in Capture | MEDIUM | React Context for selection state, sync across all panes |
| **Minimize/hide pane** | Collapse unused panes to focus on one or two | MEDIUM | Toggle visibility and reclaim space for active panes |
| **Snap to edge on resize** | Dragging divider to edge snaps pane closed (UX standard) | LOW | Check threshold on mouse-up, snap with animation |
| **Keyboard shortcut for focus** | Cmd+1 = Capture focus, Cmd+2 = Shell focus, Cmd+3 = Preview focus | LOW | Global keyboard handler, focus management |
| **Multi-monitor aware** | Detect if Preview can span full secondary monitor | HIGH | Window API + Tauri integration, defer to v2 |

**Why built correctly in web apps (2026):**
- `react-resizable-panels` is the standard library (battle-tested, accessible)
- Focus mode is expected in modern tools (VS Code, Figma, Obsidian)
- Cross-canvas selection sync is what makes three-canvas valuable; without it, feels like three separate apps
- Keyboard focus shortcuts are expected in productivity tools

---

## Differentiators (Competitive Advantage)

Features that set Isometry apart from competitors (Notion, Obsidian, Airtable).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **View continuum (Gallery → SuperGrid)** | Unique: Same data, different PAFV projections, instant switching | MEDIUM | Already built; just need UI to switch modes. The differentiator. |
| **Network visualization with LATCH filtering** | Unique: Filter network by LATCH axes (show only Q1 2025 tasks), not just node properties | HIGH | SQL WHERE clause changes nodes included in network, re-simulation |
| **Timeline with sparse events** | Unique: Large time spans (2023-2026) with sparse events still readable, zoom adjusts readability | MEDIUM | D3 scaleTime handles sparse naturally; overlapping event layout is key |
| **Notebook cards in SuperGrid** | Unique: Notes ARE database rows, visualize note relationships spatially | MEDIUM | notebook_cards already in schema, expose via PAFV projection |
| **SuperStack with LATCH sync** | Unique: Nested headers automatically generated from database facets, not manual configuration | HIGH | HeaderDiscoveryService already discovers from SQL; just need UI integration |
| **Cross-view selection sync** | Unique: Select card in Network → highlight in Timeline, SuperGrid, Capture | MEDIUM | React Context + D3.js data binding with selection state |
| **Cartographic density model** | Unique: Pan (extent) vs Zoom (value) orthogonal controls, not coupled | HIGH | Separate scale controls in PAFV controller, independent SQL GROUP BY levels |
| **Direct SQL editing from preview** | Unique: See data in SuperGrid, edit SQL query live, watch viz update (like Airtable but actual SQL) | HIGH | Query editor with syntax highlighting, live preview on Save |

**Why these matter in 2026:**
- View continuum is the core differentiator; most competitors offer Gallery OR Grid, not both fluidly
- Network with LATCH filtering is powerful (most graph tools are property-based, not dimensional)
- Sparse timeline with smart zoom is missing from most tools
- Cross-view selection sync is what makes multi-view tools valuable vs just sidebar toggles

---

## Anti-Features (Avoid Building)

Features commonly requested but create problems if built.

| Anti-Feature | Why Requested | Why Problematic | Alternative |
|--------------|---------------|-----------------|-------------|
| **Freeform drag canvas layout (like Muse)** | "Visual freedom" | Conflicts with LATCH filtering (no spatial meaning), hard to navigate at scale | Use PAFV grid (spatial = dimensional meaning) |
| **Embedded D3 charts in Capture editor** | "Like Observable notebooks" | Live D3 in contentEditable breaks serialization, complex rendering, unclear UX | Put charts in Preview pane (decoupled from editing) |
| **Real-time collaborative Kanban** | "Like Figma multiplayer" | CRDT complexity, conflicts with local-first, hard to merge concurrent drags | Single-user focus; CloudKit sync with conflict UI later |
| **Custom column types in Kanban** | "Like Airtable" | Reinvents database schema management, unclear when to use Kanban vs Grid | Use PAFV axis allocation (Grid or Kanban both work, choose based on goal) |
| **Auto-layout network (spring force 24/7)** | "Dynamic like real networks" | Jittery, hard to read, users want to explore fixed layouts | Force-directed on data change only; let user drag to reposition |
| **Infinite canvas for network** | "Like Excalidraw" | Disorienting at scale, hard to return to starting point, conflicts with PAFV semantics | Use zoom/pan with minimap, LATCH filter to show subgraph |
| **Keyboard text input in Timeline** | "Edit dates inline" | Modal/form for date input is clearer, prevents typos | Drag event + date picker modal is more reliable |
| **Full terminal emulator in Shell pane** | "Like iTerm2" | Scope explosion, reinvents wheel, users have native terminal | xterm.js basics + shell integration (command output capture) is enough |

---

## Feature Dependencies

```
CONTINUUM BASELINE
─────────────────
PAFV Axis Controller (already exists)
    ├─→ Gallery View (0-axis)
    ├─→ List View (1-axis hierarchy)
    ├─→ Kanban View (1-facet columns)
    ├─→ Grid View (2-axis tabular)
    └─→ SuperGrid View (n-axis, already built)

SPECIALIZED VIEWS
─────────────────
Network Graph
    └─requires─→ D3.js force simulation
    └─requires─→ Edge rendering (GRAPH types)
    └─enhances─→ LATCH filtering (show subgraph)

Timeline
    └─requires─→ D3.js time scale
    └─requires─→ Event positioning by temporal facet
    └─enhances─→ Zoom with adaptive labels

THREE-CANVAS CONTAINER
──────────────────────
Three-Canvas Layout
    └─requires─→ Resizable panel library
    └─requires─→ Selection Context (cross-canvas sync)
    └─requires─→ All continuum views wired

Gallery View
    └─requires─→ CSS Masonry or CSS Grid auto-flow
    └─requires─→ Virtual scrolling (TanStack Virtual) for 100+ items
    └─requires─→ PAFV axis controller (0-axis mode)

List View
    └─requires─→ Tree expand/collapse state
    └─requires─→ Keyboard navigation (ARIA standard)
    └─requires─→ PAFV axis controller (1-axis mode)
    └─enhances─→ Search/filter within tree (FTS5 integration)

Kanban View
    └─requires─→ dnd-kit or similar drag-drop library
    └─requires─→ PAFV axis controller (1-facet mode)
    └─requires─→ Persistence on drop (SQL UPDATE)
    └─requires─→ Selection Context for multi-select

Smooth Animations (All Views)
    └─requires─→ CSS transitions or D3 transitions
    └─enhances─→ UX polish, signals state changes

Cross-View Selection Sync
    └─requires─→ React Context (SelectionContext)
    └─requires─→ D3 data binding with selection state
    └─requires─→ Highlight mechanism in each view

Zoom/Pan (Network, Timeline, Grid)
    └─requires─→ D3.js zoom behavior
    └─requires─→ Separate zoom vs pan controls
    └─requires─→ State persistence (localStorage)

```

### Key Dependency Notes

- **PAFV Controller is gateway:** All continuum views depend on it remapping axes. It already exists; views just need to call it.
- **dnd-kit is gateway for drag-drop:** Kanban, Timeline, and Network all benefit from unified drag infrastructure.
- **D3 data binding is state management:** Views declare selection state in D3 attributes; React Context syncs across views.
- **Virtual scrolling is scaling requirement:** Gallery and List at 100+ items need it; TanStack Virtual is already in use.
- **FTS5 is prerequisite for search:** List tree filtering depends on full-text search already working in sql.js.

---

## Complexity Tiers

### Tier 1: Low Complexity (< 2 days per feature)

- Gallery masonry layout (CSS)
- List expand/collapse (state + CSS)
- Hover tooltips (SVG title or React tooltip)
- Card click selection (dispatch to Context)
- Timeline tick label adaptation (D3 `.tickFormat()`)
- Three-canvas panel minimize (CSS toggle)
- Focus mode keyboard shortcuts (global handler)

**Why low:** Minimal state, CSS-heavy, existing D3/React patterns.

### Tier 2: Medium Complexity (2-5 days per feature)

- Kanban drag-and-drop (dnd-kit setup, SQL persistence)
- List keyboard navigation (focus management, ARIA)
- Network force-directed (D3 simulation setup, tuning)
- Timeline zoom with adaptive labels (D3 scale + interval)
- Overlapping event handling in timeline (collision detection)
- List search/filter (FTS5 query, visibility logic)
- Cross-view selection sync (Context setup, multiple views)
- Grid sticky headers (CSS sticky or D3 clip-path)

**Why medium:** Requires library integration, state coordination, or D3 tuning.

### Tier 3: High Complexity (> 5 days per feature)

- Gallery virtual scrolling (TanStack Virtual + D3 data binding)
- Network subgraph filtering (LATCH filter → edge removal, simulation restart)
- Timeline drag-to-reschedule (D3 drag + time scale update + SQL)
- Large network rendering (canvas fallback, spatial indexing, culling)
- Large timeline rendering (virtual rendering, only visible events)
- Custom zoom/pan with minimap (dual-view synchronization)
- Database-driven SuperStack headers (automatic facet discovery, all views)
- Cartographic density model (separate scale controls, independent aggregations)

**Why high:** Requires optimization, multiple system integration, or novel algorithm.

---

## MVP Scope for v6.9

Based on existing infrastructure (CSS primitives, PAFV controller, D3 renderer) and track parallelization:

### Track A: View Continuum Integration (MVP)

**Priority: COMPLETE BY PHASE END**

1. **Gallery View** (Tier 1-2)
   - CSS Masonry layout with auto-column count
   - Click to select, Cmd+click for multi-select
   - Virtual scrolling for 100+ items (reuse TanStack Virtual)
   - PAFV 0-axis mode (no grouping, position only)

2. **List View** (Tier 1-2)
   - Expand/collapse tree with animation
   - Count badges on collapsed nodes
   - Keyboard navigation (up/down, Enter/Escape)
   - FTS5 search filter (highlight matching nodes)
   - PAFV 1-axis mode (group by facet, hierarchy by depth)

3. **Kanban View** (Tier 2)
   - dnd-kit drag-and-drop within/between columns
   - Column headers by facet value
   - Card count per column
   - SQL UPDATE on drop (persist drag)
   - PAFV 1-facet mode (columns = facet values)

4. **Mode Switcher UI** (Tier 1)
   - React buttons to switch between 5 modes
   - Preserve scroll/selection/zoom on switch
   - Animate transition between modes

### Track C: Network/Timeline Polish (AFTER Track A)

**Priority: DEFERRED TO PHASE 2 IF TIME TIGHT**

1. **Network Graph** (Tier 2-3)
   - D3 force-directed with zoom/pan
   - Node/edge rendering with PAFV colors
   - Click to select and highlight related edges
   - LATCH filter integration (subgraph by LATCH facets)

2. **Timeline View** (Tier 2-3)
   - Horizontal scrollable axis with zoom levels
   - Event positioning by temporal facet
   - Overlapping event layout (swimlanes)
   - Adaptive tick labels (year/month/day based on zoom)

### Track D: Three-Canvas Notebook (AFTER Track C)

**Priority: DEFERRED TO PHASE 3**

1. **Three-Canvas Layout**
   - Resizable panels with `react-resizable-panels`
   - Preview pane runs one view at a time (switchable)
   - Capture pane (TipTap editor, already exists)
   - Shell pane (Terminal, already exists)

2. **Cross-Canvas Selection Sync**
   - SelectionContext wires selection across Capture/Shell/Preview
   - Click card in Preview SuperGrid → highlight block in Capture
   - Cmd+click in Preview → toggle multi-select in Capture

---

## Browser/Platform Considerations

| Feature | Browser Requirement | Notes |
|---------|-------------------|-------|
| CSS Masonry | Chrome 111+, Safari 16+, Firefox 109+ | Fallback to CSS Grid auto-flow for older browsers |
| CSS Grid | All modern browsers | Native spanning, no polyfill needed |
| D3.js | ES2015+ support | No special requirements; already used in codebase |
| dnd-kit | Touch + pointer events | Built-in, handles both mouse and touch drag-drop |
| svg.js or Canvas | All modern browsers | Canvas for 2000+ node networks, SVG for <500 nodes |
| requestAnimationFrame | All modern browsers | D3 transitions use this natively |
| Sticky positioning | All modern browsers except IE | Mobile Safari support is good (iOS 13+) |
| Flexbox + Grid | All modern browsers | No polyfill needed |
| Paste API (copy as image) | Chrome 90+, Edge 90+ | Nice to have, fallback to download |

**Desktop-first approach:** Responsive design for tablet, explicit deferral of mobile optimization to v2.

---

## Performance Targets

| View | Data Size | Target FPS | Target Memory | Notes |
|------|-----------|-----------|----------------|-------|
| Gallery | 500 items | 60 FPS on scroll | <50 MB | Virtual scrolling essential |
| List | 10,000 items (collapsed tree) | 60 FPS on expand | <100 MB | Lazy load children on expand |
| Kanban | 200 cards/5 columns | 60 FPS on drag | <50 MB | Re-layout on drop, smooth animation |
| Grid | 100×50 (5000 cells) | 60 FPS on scroll | <100 MB | Virtual rendering or canvas fallback |
| SuperGrid | 100×50 | 60 FPS on scroll | <100 MB | Already optimized in v6.6 |
| Network | 500 nodes | 60 FPS on zoom/pan | <150 MB | Canvas rendering for >1000 nodes |
| Timeline | 1000 events | 60 FPS on zoom/pan | <100 MB | Virtual rendering for >2000 events |
| Three-Canvas | All views combined | 60 FPS on resize | <300 MB | One view active at a time (Preview) |

---

## Sources

### Masonry & Gallery Layout
- [MDN: Masonry Layout](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Grid_layout/Masonry_layout)
- [CSS Grid Masonry with auto-flow](https://www.smashingmagazine.com/2019/02/css-grid-masonry-layout/)
- [Chrome DevRel: CSS Masonry Update (2026)](https://developer.chrome.com/blog/masonry-update)
- [CSS Grid-Lanes for simple masonry](https://pixicstudio.medium.com/css-grid-lanes-masonry-layouts-just-got-stupid-simple-52341b9e6279)

### Tree Views & Hierarchical Lists
- [W3C: ARIA TreeView Role](https://www.w3.org/wiki/TreeView)
- [Deque University: Navigation with Expand/Collapse](https://dequeuniversity.com/library/aria/navigation)
- [Shadcn: Tree View Component (2026)](https://github.com/MrLightful/shadcn-tree-view)
- [Tree View Accessibility Guide](https://www.a11y-101.com/design/tree-view)

### Kanban & Drag-Drop
- [dnd-kit Documentation](https://docs.dnd-kit.com/)
- [Building Kanban with Shadcn/ui](https://marmelab.com/blog/2026/01/15/building-a-kanban-board-with-shadcn.html)
- [MDN: HTML Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Kanban_board)
- [Eleken: Drag-Drop UX Best Practices (2026)](https://www.eleken.co/blog-posts/drag-and-drop-ui)

### Force-Directed Graphs
- [D3 Force Module Documentation](https://d3js.org/d3-force)
- [Observable: Force-Directed Graph Component](https://observablehq.com/@d3/force-directed-graph-component)
- [Creating Custom Force Graphs with D3.js](https://reintech.io/blog/creating-custom-force-directed-graphs-d3js)
- [D3 Force 3D for scalability](https://github.com/vasturiano/d3-force-3d)

### Timeline & Temporal Visualization
- [FullCalendar: Timeline View](https://fullcalendar.io/docs/timeline-view)
- [Teamup: Timeline View Overview](https://calendar.teamup.com/kb/the-timeline-view/)
- [Mobiscroll: Dynamic Timeline Zoom](https://demo.mobiscroll.com/timeline/calendar-zoom)
- [Aeon Timeline: Timeline View](https://help.timeline.app/article/144-timeline-view)

### Resizable Panels & Layouts
- [react-resizable-panels (GitHub)](https://github.com/bvaughn/react-resizable-panels)
- [LogRocket: React Panel Layouts (2026)](https://blog.logrocket.com/essential-tools-implementing-react-panel-layouts/)
- [Mantine: Split Pane Component](https://github.com/gfazioli/mantine-split-pane)
- [Android: Supporting Pane Layout](https://developer.android.com/develop/ui/compose/layouts/adaptive/build-a-supporting-pane-layout)

### Virtual Scrolling & Performance
- [TanStack Virtual Documentation](https://tanstack.com/virtual/latest)
- [React Window vs React Virtual (comparison)](https://www.npmjs.com/package/react-window)
- [Large List Performance Best Practices](https://web.dev/virtualization/)

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| **Table Stakes Features** | HIGH | Verified with official docs (MDN, D3, TanStack), current implementations (Figma, Airtable, Obsidian) |
| **Differentiators** | MEDIUM | Isometry-specific; no direct competitors with same PAFV model; confidence in approach based on research + v3 validation |
| **Gallery Implementation** | HIGH | CSS Masonry is standard; virtual scrolling is well-tested (TanStack Virtual is production) |
| **List Implementation** | HIGH | Tree views are well-documented (ARIA standard); keyboard nav is mature pattern |
| **Kanban Implementation** | HIGH | dnd-kit is current standard; drag-drop patterns are well-established |
| **Network Implementation** | HIGH | D3 force is battle-tested; force simulation is standard approach |
| **Timeline Implementation** | MEDIUM-HIGH | D3 time scales are reliable; sparse event handling is less common but solvable |
| **Three-Canvas Layout** | HIGH | react-resizable-panels is mature; cross-pane sync via Context is standard React pattern |
| **Performance Targets** | MEDIUM | Based on similar tools' performance; actual performance depends on implementation details (culling, batching) |

---

## Gaps & Open Questions

1. **Gallery masonry ordering:** Should gallery sort order be LATCH-driven (dynamic) or explicit (manual sort field)? Decision: Use LATCH axis when provided; add explicit sort-order facet if needed.

2. **Kanban column creation:** Can users create new column values (new facet value) on the fly, or only drag between pre-existing columns? Decision: Pre-existing only for MVP; dynamic column creation deferred.

3. **Timeline event drag:** Should dragging an event reschedule it (update `event_date`) or just reorder within the same date? Decision: Drag to reschedule (higher complexity but more powerful).

4. **Network subgraph filtering:** When LATCH filter hides nodes, should their edges be hidden too? Decision: Yes; re-run query, simulation includes only visible nodes.

5. **Three-Canvas Preview tab:** Can Preview show multiple views simultaneously (Grid + Network side-by-side) or one at a time? Decision: One at a time for MVP; multi-view split pane deferred to v2.

6. **Selection persistence on view switch:** If user selects 3 cards in SuperGrid, switch to Network, do those 3 cards remain selected (highlighted)? Decision: Yes; selection state is app-wide, not view-specific.

---

## Next Steps (for Roadmap Phase)

1. **Finalize API contracts** between PAFV controller and each view renderer
2. **Implement Gallery view** with CSS Masonry + virtual scrolling
3. **Implement List view** with expand/collapse + keyboard nav
4. **Implement Kanban view** with dnd-kit + SQL persistence
5. **Wire three-canvas layout** (if time permits; may defer)
6. **Verify performance targets** with large datasets
7. **Polish cross-view selection sync** (selection Context + D3 binding updates)

---

*Feature research for: Grid Continuum & Polymorphic Views (v6.9)*
*Researched: 2026-02-16*
*Confidence: HIGH (verified against official documentation, current web standards, and existing implementations)*
