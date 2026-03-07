# Phase 38: Virtual Scrolling - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperGrid renders smoothly at 10K+ card scale with frozen headers and correct scroll behavior. CSS content-visibility progressive enhancement and custom row virtualization for SuperGrid at scale. Column virtualization, server-side pagination, and lazy card_ids loading are out of scope (VSCR-F01/F02/F03).

</domain>

<decisions>
## Implementation Decisions

### Virtualization layers
- Two-layer approach: CSS `content-visibility: auto` on ALL data cells as progressive enhancement (browser-native, zero JS), PLUS custom row virtualization that only renders visible rows + overscan buffer
- Custom row virtualization activates at a threshold: >100 leaf rows triggers the virtualizer; below threshold, all rows render normally with just `content-visibility: auto`
- Virtualizer is a separate module: new `SuperGridVirtualizer` class in `src/views/supergrid/` — mirrors SuperGridSizer/SuperZoom lifecycle pattern (attach/detach). SuperGrid delegates visible-row computation to it. Testable in isolation
- `content-visibility: auto` uses zoom-aware CSS variable: `contain-intrinsic-size: auto var(--sg-row-height, 40px)` — tracks the existing `--sg-row-height` custom property that SuperZoom already sets

### Header freeze strategy
- Keep current CSS `position: sticky` approach for both column and row headers — no architectural change to header layout
- Column headers are always fully rendered (small count, sticky at top, unaffected by row virtualization)
- Row headers are virtualized alongside their data rows — they're sticky horizontally but scroll vertically, so offscreen row headers don't need DOM nodes
- Spacer rows (invisible elements) above and below visible rows maintain correct total grid height for scrollbar accuracy
- Sentinel spacer element with height = totalRows × rowHeight provides pixel-perfect scrollbar thumb size and position

### Feature compatibility
- Lasso selection: viewport-only — BBoxCache continues snapshotting whatever `.data-cell` elements exist in DOM (visible + overscan). Users drag lassos within their viewport, so this is natural behavior
- Sort/filter: reset scroll to (0,0) on change — matches existing documented behavior ("Filter change → reset scroll to (0,0)"). Virtualizer re-renders from row 0
- SuperGridSizer auto-fit (dblclick): measures only visible + overscan cells. Good enough for content width estimation, no special handling
- Density controls (hide-empty, view mode) and collapse (aggregate/hide): continue processing ALL cells for logic/computation. Only the rendering step is virtualized (which rows get DOM nodes). Clean separation of data vs. render

### Overscan & thresholds
- Fixed uniform row height — all rows assumed same height (var(--sg-row-height)). Simplifies virtualizer math: visible range = scrollTop / rowHeight. Content clips via CSS overflow
- 5 rows overscan above and below viewport (~10 extra rows total). Prevents flicker during normal scrolling with minimal DOM overhead
- Virtualization threshold: 100 leaf rows. Below this, all rows render with content-visibility: auto only
- Scrollbar: sentinel spacer element (single invisible div, height = totalRows × rowHeight) inside scroll container. CSS Grid content positioned above it

### Claude's Discretion
- Exact spacer element implementation (position: absolute vs. CSS Grid row placement)
- How _renderCells() refactors to call virtualizer for visible row range
- rAF scroll handler integration with virtualizer (debounce vs. immediate recalc)
- BBoxCache invalidation timing when rows enter/leave DOM
- Row recycling strategy (create/destroy vs. reuse DOM nodes)
- Performance benchmark thresholds and test methodology

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridSizer` (`src/views/supergrid/SuperGridSizer.ts`): Lifecycle pattern (attach/detach, private state, callback hooks) — virtualizer should mirror this
- `SuperZoom` (`src/views/supergrid/SuperZoom.ts`): Sets `--sg-row-height` CSS variable — virtualizer reads this for row height calculation
- `SuperGridBBoxCache` (`src/views/supergrid/SuperGridBBoxCache.ts`): Snapshots .data-cell DOMRects via scheduleSnapshot() — works as-is with virtualized rows (only visible cells get snapshotted)
- `SuperGridSelect` (`src/views/supergrid/SuperGridSelect.ts`): SVG lasso overlay — works as-is since lasso is viewport-only
- `SortState` (`src/views/supergrid/SortState.ts`): Sort triggers _renderCells() which resets scroll — compatible with virtualizer reset

### Established Patterns
- CSS Grid layout: `grid.style.display = 'grid'`, `gridTemplateColumns` built via `buildGridTemplateColumns()`, `gridTemplateRows` set to `Array(totalRows).fill('auto')`
- D3 data join: `.selectAll('.data-cell').data(cellPlacements, keyFn).join(enter, update, exit)` — needs to operate on visible rows only
- rAF-throttled scroll handler: already exists on root element (`passive: true`), saves position via `_positionProvider.savePosition()`
- Full DOM rebuild: `while (grid.firstChild) grid.removeChild(grid.firstChild)` in _renderCells() — headers rebuilt each time
- Sticky positioning: corner cells z-index:3, col headers z-index:2, row headers z-index:1

### Integration Points
- `_renderCells()` method (~line 1168): Main render pipeline — needs to be split into "compute all placements" + "render visible window"
- `_boundScrollHandler` (~line 241): rAF scroll handler — needs to trigger virtualizer recalculation on scroll
- `mount()` (~line 454): Creates root (overflow:auto) and grid elements — virtualizer attaches here
- `destroy()` (~line 960): Cleanup — virtualizer detaches here
- `_fetchAndRender()` (~line 1063): Data pipeline — resets scroll on filter/transpose changes

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 38-virtual-scrolling*
*Context gathered: 2026-03-06*
