# Phase 65: D3 Chart Blocks - Context

**Gathered:** 2026-03-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can embed live D3 mini-visualizations in notebook preview that reflect the current SuperGrid filtered data. Chart blocks use fenced code block syntax in markdown, render as D3 SVG in the preview panel, and update reactively when filters change. Creating new chart types or adding click-to-filter interactivity are separate concerns.

</domain>

<decisions>
## Implementation Decisions

### Chart syntax
- YAML-style config inside fenced `chart` code blocks (````chart`)
- Keys: `type` (required), `x`, `y` (required for bar/line/scatter), `value` (required for pie)
- Optional config keys: `color`, `title`, `legend`, `limit`
- Custom `marked` renderer extension detects the `chart` language tag on fenced code blocks
- Standard code block rendering for other languages must be unaffected

### Chart types
- 4 chart types in scope: bar, pie/donut, line, scatter
- Bar: vertical bars for category counts (d3 bar patterns from LatchExplorers)
- Pie/donut: proportional breakdown via d3.pie() + d3.arc()
- Line: trend over time for date fields (d3 line patterns from TimelineView)
- Scatter: two numeric fields as dots for correlation

### Field mapping
- Explicit `x:` and `y:` keys in YAML config (not positional)
- `count` is a magic keyword for y-axis meaning "count rows per x-value"
- AliasProvider resolves display names to qualified column names (consistent with PropertiesExplorer/ProjectionExplorer)

### Data binding
- Each chart block sends its own query via WorkerBridge (new `chart:query` message type)
- Query uses FilterProvider.compile() for the WHERE clause
- Aggregation via SQL GROUP BY on the Worker side (not client-side d3.rollup)
- Independent of SuperGrid's cell data query — clean separation

### Error handling
- Unknown field → inline styled error message in the chart placeholder ("Unknown field: rating")
- Invalid YAML → inline error with parse details
- Other charts and markdown still render — non-destructive

### Live update behavior
- Charts only render when user is on the Preview tab (no wasted queries on Write tab)
- While on Preview tab, filter changes trigger debounced re-query (~300ms) and in-place chart update
- Subtle D3 transitions (~300ms) on data change — bar heights, pie slices, line paths animate smoothly
- Filter subscription via FilterProvider.subscribe() (same pattern as views)

### Chart sizing & layout
- Aspect-ratio-based sizing — chart SVG scales with panel width, height derived from ratio
- No hard limit on number of chart blocks per notebook (natural performance feedback)
- Bordered card container with rounded corners and light background — visually distinct from markdown text
- Hover tooltips on bars/slices/points showing label + value

### Security (NOTE-08)
- Two-pass rendering: DOMPurify sanitizes placeholder divs first, then D3 mounts SVG programmatically into placeholders
- No XSS vectors from user-authored chart YAML — SVG is D3-generated, not user HTML
- SANITIZE_CONFIG needs `div` with `data-chart-*` attributes for placeholders (div already allowed)

### Claude's Discretion
- Exact aspect ratio choice (e.g., 16:9 vs 4:3 vs 3:2)
- Tooltip styling and positioning
- D3 color scale for multi-value charts (d3.schemeCategory10 or similar)
- Exact debounce timing for filter change re-query
- YAML parsing library choice (simple key:value parser vs full YAML)
- Chart axis label formatting and tick count

</decisions>

<specifics>
## Specific Ideas

- `count` as a magic y-axis keyword avoids requiring a real numeric column for the most common chart use case (category distribution)
- Chart containers should feel like the existing card-based design language — subtle border, rounded corners
- Transitions should be polished but not distracting — ~300ms, matching existing view transition patterns in transitions.ts
- AliasProvider integration means users write human-readable field names, not raw SQL column names

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `NotebookExplorer._chartStubEl` (.notebook-chart-preview): Reserved div stub with display:none — placeholder for chart rendering infrastructure
- `marked` + `DOMPurify` pipeline: Already imported and configured in NotebookExplorer._renderPreview()
- `FilterProvider.subscribe()`: Change notification mechanism for reactive chart updates
- `FilterProvider.compile()`: Returns `{ where, params }` for parameterized SQL queries
- `WorkerBridge.send()`: Async message passing to Worker for SQL queries
- `AliasProvider`: Display name → qualified column resolution (used by PropertiesExplorer, ProjectionExplorer)
- `transitions.ts`: D3 transition patterns used across all views
- D3 v7.9: Extensively used in SuperGrid, NetworkView, TreeView, TimelineView, LatchExplorers

### Established Patterns
- Two-pass sanitization: DOMPurify first, then programmatic DOM manipulation (used for GFM task lists)
- Worker message protocol: `supergrid:query`, `supergrid:calc` patterns — new `chart:query` follows same convention
- SQL GROUP BY aggregation: SuperCalc footer rows (Phase 62) use identical Worker-side aggregation pattern
- Debounced subscriber pattern: Used throughout provider system (queueMicrotask batching)

### Integration Points
- `NotebookExplorer._renderPreview()`: Where marked.parse() pipeline runs — custom renderer extension hooks here
- `NotebookExplorer._switchTab('preview')`: Where chart render/update lifecycle begins
- `SANITIZE_CONFIG.ALLOWED_ATTR`: Needs `data-chart-id` (or similar) for placeholder targeting
- `worker.ts` message router: New `chart:query` handler registration
- `supergrid.handler.ts`: Reference implementation for SQL aggregation query building

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 65-d3-chart-blocks*
*Context gathered: 2026-03-09*
