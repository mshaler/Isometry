# Phase 26: SuperTime - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Smart time hierarchy auto-detection and non-contiguous period selection for SuperGrid date axes. Users can assign a date field as a grid axis, have it auto-parse mixed formats and auto-select an appropriate time level, manually override the level, and Cmd+click time period headers to select non-contiguous periods. Creating new date fields, editing date values, and calendar view enhancements are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Date Parsing Behavior
- Sequential fallback chain: try ISO 8601 (YYYY-MM-DD) first, then US (MM/DD/YYYY), then EU (DD/MM/YYYY) — first successful parse wins
- Standard formats only — no natural language parsing (no 'yesterday', 'next Monday', etc.)
- Unparseable dates (e.g., 'TBD', 'ASAP', garbage text) get their own 'No Date' group at the end of the time axis — consistent with how 'None' works for other axis fields
- Date-only precision — strip time components entirely ('2025-03-05T14:30:00' becomes '2025-03-05')

### Auto-Hierarchy Level Selection
- Favor overview: auto-detect picks a coarser level that keeps columns manageable (~10-20 columns), not maximum detail
- Based on date range (min/max) only, not data density/clustering — SuperDensityProvider.hideEmpty handles sparse columns
- Re-runs on data change (e.g., new import expands date range) — adaptive, not locked after first detection
- All date fields treated identically (created_at, modified_at, due_at) — same logic, no field-specific hints

### Manual Override UX
- Inline segmented pills in the time axis header row: A | D | W | M | Q | Y
- 'A' pill = Auto (reverts to auto-detection) — explicit escape hatch
- D/W/M/Q/Y = Day/Week/Month/Quarter/Year manual override
- Active level is highlighted; control appears only when a date field is used as an axis
- Override persists across sessions via SuperDensityProvider.toJSON() (Tier 2 persistence)

### Non-Contiguous Period Selection
- Cmd+click on time period headers to toggle selection (same metaKey/ctrlKey pattern as existing SuperGrid interactions)
- Selected headers get highlighted accent background color — simple, familiar visual cue
- Grid collapses to selected periods only — non-selected period columns are removed entirely, grid reshuffles
- Escape key OR a 'Show All' button clears all period selections and restores full grid
- Cmd+click toggle deselects individual headers; when all deselected, full grid returns
- Works at all hierarchy levels (day, week, month, quarter, year) — not restricted to coarse levels
- Selection compiles to FilterProvider._axisFilters with IN (?) operator (existing mechanism)

### Claude's Discretion
- Exact date format strings for d3-time-format sequential fallback parser
- Auto-hierarchy threshold breakpoints (exact day/week/month/quarter/year cutoff ranges)
- Segmented pill visual styling details (colors, spacing, typography)
- Animation/transition behavior when grid collapses to selected periods
- 'Show All' button placement and styling
- Error handling for edge cases (empty datasets, single-date datasets)

</decisions>

<specifics>
## Specific Ideas

- Auto pill (A) in the granularity picker is important — users should always be able to revert to auto-detection after manual override
- The 'No Date' group at the end of the time axis should feel like a natural part of the grid, not an error state
- Collapse behavior for non-contiguous selection should be snappy — the grid reshuffles to show only selected periods side-by-side

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridQuery.compileAxisExpr()` + `STRFTIME_PATTERNS`: Already compiles time-field GROUP BY with strftime() for all 5 granularities
- `SuperDensityProvider`: Manages `axisGranularity` state with Tier 2 persistence, subscriber pattern, and `hideEmpty` for sparse columns
- `DensityProvider.STRFTIME_PATTERNS`: Mirror patterns in both DensityProvider and SuperGridQuery (kept local to avoid cross-module coupling)
- `FilterProvider._axisFilters` + `setAxisFilter()`: Ready-to-wire Map<string, string[]> with IN (?) SQL compilation — exactly the mechanism for non-contiguous period filtering
- `SuperStackHeader.buildHeaderCells()`: Run-length spanning algorithm with parentPath — already supports hierarchical header rendering
- `SuperGrid` Cmd+click pattern: `metaKey || ctrlKey` already used for row/col header selection (SLCT-05), sort cycling, and axis filter "only this value" (FILT-03)
- `ALLOWED_TIME_FIELDS`: Set of ['created_at', 'modified_at', 'due_at'] in both SuperGridQuery and DensityProvider

### Established Patterns
- Provider subscriber pattern: `subscribe()` returns unsubscribe function, notifications batched via `queueMicrotask`
- Granularity changes trigger Worker re-query (SQL GROUP BY expression changes); hideEmpty/viewMode changes are client-side re-render only
- StateCoordinator batch: SuperDensityProvider IS registered — granularity changes flow through coordinator and trigger `_fetchAndRender()`
- Axis field validation: `validateAxisField()` allowlist MUST be called before `compileAxisExpr()` — strftime expressions are NOT in the allowlist
- MAX_LEAF_COLUMNS = 50 cardinality guard in SuperStackHeader — excess values collapse into 'Other'

### Integration Points
- `SuperGrid._fetchAndRender()`: Entry point for re-rendering after granularity change — receives cells from Worker
- `SuperGridQuery.build()`: Builds parameterized SQL with granularity-aware GROUP BY — will need smartHierarchy() to set initial granularity
- `FilterProvider.compile()`: Generates WHERE clause from _axisFilters — period selection compiles here
- `SuperGrid` header rendering: Column headers created in render pipeline — pills control and Cmd+click handlers wire here
- `SuperDensityProvider.toJSON()/setState()`: Persistence entry point for manual override state

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 26-supertime*
*Context gathered: 2026-03-05*
