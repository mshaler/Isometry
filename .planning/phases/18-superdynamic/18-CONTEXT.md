# Phase 18: SuperDynamic - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can drag axis headers between row and column dimensions to transpose the SuperGrid in real time. Also supports reordering axes within the same dimension. Grid reflows with animation after each transpose. Axis assignments persist across view switches via PAFVProvider + StateManager.

Requirements: DYNM-01 (row→col transpose), DYNM-02 (col→row transpose), DYNM-03 (same-dimension reorder), DYNM-04 (300ms D3 transition), DYNM-05 (persistence across view switches).

</domain>

<decisions>
## Implementation Decisions

### Drag handle interaction
- Grip handle icon on each axis header — only the grip area initiates drag
- Leaves header text/click free for Phase 23 SuperSort (sort cycle on header click)
- Both row and column axis headers are draggable — full bidirectional transpose (DYNM-01 + DYNM-02)

### Axis constraints
- Minimum 1 axis per dimension — user cannot empty a dimension completely by dragging out the last axis (drop is blocked or prevented)
- Block duplicate fields across dimensions — a field can only appear in one dimension at a time; dragging 'status' from rows to columns removes it from rows
- These constraints prevent degenerate grid states and confusing repeated grouping

### Claude's Discretion
- **Drag preview style** — ghost of header vs custom pill/chip (setDragImage)
- **Drop target feedback** — highlight zone vs insertion line
- **Drag affordance visibility** — always visible grip vs hover-reveal
- **Dimension visual cues** — color-coded row vs column headers, or position-only
- **Ghost slot placeholder** — dashed outline at drag origin, or no placeholder
- **DnD API choice** — HTML5 DnD for all operations, or HTML5 cross-dimension + d3.drag in-stack reorder (roadmap pre-plan suggests the split approach in plans 18-02 vs 18-03)
- **Animation style** — crossfade (existing pattern) vs slide-and-settle for 300ms reflow
- **Re-query vs cache** — re-query Worker after transpose (correct, adds latency) vs client-side reflow from _lastCells (instant, complex)
- **Animation cancelability** — cancel-and-restart on mid-animation drag vs queue until 300ms completes
- **Loading during reflow** — animation-only feedback vs skeleton cells during Worker query
- **Max axis stack depth** — cap at 3 per dimension (SuperStackHeader handles 3 levels) or no limit (cardinality guard at 50 handles overflow)
- **Undo support** — Cmd+Z via MutationManager (consistent with KanbanView) or no undo (axis config is metadata, not data mutation)

</decisions>

<specifics>
## Specific Ideas

- KanbanView explicitly warns: "Does NOT use d3.drag — it intercepts dragstart and breaks dataTransfer" — the DnD API choice should respect this finding
- Roadmap pre-plans suggest a module-level `dragPayload` singleton for HTML5 DnD cross-zone discrimination (plan 18-01), separate from d3.drag for in-stack reorder (plan 18-03)
- transitions.ts already has crossfade (300ms opacity) and morph (400ms position) patterns — reuse where appropriate
- SuperGrid._fetchAndRender() is the existing re-render pipeline (reads axes from provider, queries Worker) — transpose should flow through this path for correctness

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- **KanbanView DnD pattern**: HTML5 dragstart/dragover/drop with `text/x-kanban-card-id` MIME type — reusable pattern with custom MIME type for SuperDynamic (e.g., `text/x-supergrid-axis`)
- **PAFVProvider.setColAxes() / setRowAxes()**: Already exist with validation + subscriber notification via queueMicrotask batching — drag-drop just calls these on drop
- **SuperStackHeader.buildHeaderCells()**: Computes HeaderCell objects (value, level, colStart, colSpan) from axis values — needs extension for grip handle rendering
- **transitions.ts crossfadeTransition()**: 300ms opacity transition — potential reuse for DYNM-04
- **StateCoordinator subscription**: SuperGrid already subscribes — PAFVProvider changes auto-trigger _fetchAndRender()

### Established Patterns
- **HTML5 DnD over d3.drag for card moves**: KanbanView established this pattern; d3.drag intercepts dataTransfer
- **Dependency injection**: SuperGrid constructor takes (provider, filter, bridge, coordinator) — drag handlers will use provider.setColAxes/setRowAxes
- **CSS Grid rendering**: grid-template-columns set dynamically, headers as grid items with grid-column: span N
- **Collapsible headers**: Click toggles _collapsedSet, re-renders from cached _lastCells without re-query

### Integration Points
- **PAFVProvider** — drop handler calls setColAxes/setRowAxes to commit axis changes
- **StateCoordinator** — PAFVProvider change triggers coordinator notification → SuperGrid._fetchAndRender()
- **WorkerBridge.superGridQuery()** — re-queries with new axis configuration after transpose
- **SuperStackHeader** — needs to expose draggable grip handles on HeaderCell rendering
- **Tier 2 persistence** — PAFVProvider.toJSON()/setState() already handles colAxes/rowAxes serialization (DYNM-05 covered)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 18-superdynamic*
*Context gathered: 2026-03-04*
