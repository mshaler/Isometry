# Phase 5: Core D3 Views + Transitions - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement three D3 view types (ListView, GridView, KanbanView) with animated transitions between them, plus the ViewManager lifecycle that mounts/unmounts views cleanly. Establishes the canonical D3 data join pattern (`selectAll → data(key) → join`) that all subsequent views (Phase 6, 7) will follow.

Out of scope: Calendar, Timeline, Gallery (Phase 6), Graph/SuperGrid (Phase 7), Projection Explorer UI, LATCH Filters UI.

</domain>

<decisions>
## Implementation Decisions

### Card Rendering
- Minimal card template: name + subtitle line (folder or status, whichever is set)
- One shared CardRenderer function used by all three views — identical DOM structure enables smooth morph transitions
- Cards are `<g>` groups in SVG for List/Grid, HTML `<div>` for Kanban (drag-drop needs HTML)
- Truncate name with ellipsis if it exceeds card width
- Card type indicator via small icon or badge (note/task/event/resource/person)

### ListView
- Single-column vertical list with configurable sort (name, created_at, modified_at, priority)
- Sort controls in a small toolbar above the list (dropdown + asc/desc toggle)
- Each row: card content left-aligned, date/time right-aligned
- Fixed row height for clean alignment and predictable scroll

### GridView
- Fixed-size uniform tiles arranged in a responsive grid (columns adapt to container width)
- Cards wrap to fill available space — `Math.floor(width / cellWidth)` columns
- PAFV axis mappings determine sort order within the grid
- No masonry — uniform height for clean transitions

### KanbanView
- Column grouping field is configurable via PAFVProvider's groupBy (defaults to `status`, can be `folder` or `card_type`)
- Columns render in alphabetical order of the grouping field's values; empty columns still show with header + empty state text
- Drag-drop between columns fires a MutationManager mutation (undoable via Cmd+Z)
- HTML-based rendering (not SVG) since HTML5 drag-and-drop is required
- Vertical scroll within each column when cards overflow

### View Transitions
- LATCH family transitions (List↔Grid↔Kanban) morph card positions using d3-transition with 400ms duration and ease-out-cubic
- Cross-family transitions (LATCH↔GRAPH) use 300ms crossfade (opacity out → opacity in)
- Transitions triggered by ViewManager.switchTo(viewType) — UI trigger mechanism (toolbar, keyboard) is implementation detail
- Each card animates individually to its new position (staggered by index for visual flow)
- If a card enters during transition (new data), it fades in at destination; if it exits, it fades out from source

### ViewManager Lifecycle
- ViewManager holds a reference to the current active view
- On switchTo(): call currentView.destroy() first (removes subscriptions, clears DOM), then mount new view
- destroy() MUST unsubscribe from StateCoordinator — the "10 mount/destroy cycles = unchanged subscriber count" criterion
- ViewManager subscribes to StateCoordinator for data change notifications, forwards to current view's render()

### Loading & Error States
- Loading: show a centered spinner (CSS animation, not SVG) with "Loading..." text below — appears after 200ms delay (avoid flash for fast queries)
- Error: inline banner at top of view area with error message + "Retry" button — red-tinted background, not a modal/toast
- Empty state: centered message "No cards match current filters" when query returns zero results

### Claude's Discretion
- Exact card dimensions (width, height, padding) — follow design system spacing scale
- Sort control UI specifics (dropdown vs segmented control vs icon buttons)
- Stagger timing for individual card animations during transitions
- Spinner design and animation details
- Whether GridView cells show a subtle border or rely on spacing alone
- Kanban column width (fixed vs flexible)

</decisions>

<specifics>
## Specific Ideas

- The "data as projection" insight should be VISIBLE: switching from List to Grid to Kanban should feel like the same cards are flying to new positions, not like three separate screens loading
- D3 key function `d => d.id` is MANDATORY on every `.data()` call — this is a locked architectural decision (D-003 equivalent for views)
- Kanban drag-drop must feel like Trello/Linear — grab a card, see it lift, drop it in a column, it settles into place
- Dark theme from D3Components.md design system: `--bg-primary: #1a1a2e`, `--bg-card: #1e1e2e`, etc.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/providers/types.ts`: ViewType union (`list | grid | kanban | ...`), ViewFamily (`latch | graph`), AxisMapping, Filter types
- `src/providers/StateCoordinator.ts`: subscribe/unsubscribe pattern for batched view notifications — views will subscribe here
- `src/providers/PAFVProvider.ts`: axis mappings (sort field + direction) that views consume for ordering
- `src/providers/FilterProvider.ts`: compiled SQL WHERE clauses that views pass to Worker queries
- `src/mutations/MutationManager.ts`: push(mutation) for Kanban drag-drop undo/redo
- `src/mutations/inverses.ts`: inverse computation for UPDATE mutations (Kanban column change)
- `src/worker/WorkerBridge.ts`: bridge.send('db:query', ...) for async data fetching from Worker
- `src/providers/DensityProvider.ts`: time granularity (not used in Phase 5 but established pattern)

### Established Patterns
- Provider subscribe/notify pattern: `subscribe(cb) → () => void` used by all providers
- Compile-to-SQL pattern: providers compile state to SQL fragments, QueryBuilder assembles full query
- Worker RPC: `bridge.send(type, payload) → Promise<result>` with correlation IDs and timeouts
- Allowlist validation: all SQL fields/operators validated at runtime against allowlists

### Integration Points
- Views will consume StateCoordinator notifications to re-render when filters/axes/density change
- Views will use QueryBuilder (or compose SQL from provider compiled output) to fetch data from Worker
- KanbanView will use MutationManager.push() for drag-drop mutations
- ViewManager will be the new entry point that main app code calls to switch views
- CSS variables from D3Components.md design system should be defined in a stylesheet

</code_context>

<deferred>
## Deferred Ideas

- Table View — full data table with column sorting/filtering (could be Phase 5 extension or separate)
- Selection highlighting in views — SelectionProvider integration for multi-select (Tier 3, not persisted)
- Keyboard navigation within views (arrow keys to move between cards)
- Card detail panel / expand-on-click — separate interaction layer
- View-specific settings persistence (zoom level, column widths) — after basic views work

</deferred>

---

*Phase: 05-core-d3-views-transitions*
*Context gathered: 2026-02-28*
