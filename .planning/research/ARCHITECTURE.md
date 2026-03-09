# Architecture Patterns: v5.2 SuperCalc + Workbench Phase B

**Domain:** SQL aggregate footers, notebook formatting/charts/persistence, LATCH histogram/chips -- all integrating into existing Isometry v5 web runtime
**Researched:** 2026-03-09
**Confidence:** HIGH -- all five integration questions resolved by reading existing source code; no new external dependencies needed, architecture follows established patterns

---

## Executive Summary

v5.2 introduces five new capabilities that all plug into the existing architecture at well-defined integration points. The core insight is that every new feature maps cleanly onto existing patterns:

1. **SuperCalc footer rows** extend the existing `supergrid:query` pipeline with a parallel aggregate query, rendered as pinned footer rows in the CSS Grid below the data cells.
2. **Notebook formatting toolbar** extends the existing `NotebookExplorer` textarea with toolbar buttons that call the existing `_wrapSelection()` mechanism and new block-level insertion methods.
3. **D3 chart blocks** embed mini-visualizations in the notebook preview by extending the `marked` renderer to recognize fenced code blocks with a `chart` language tag, rendered via D3 into the sanitized preview DOM.
4. **Notebook persistence** adds a `notebooks` table to the schema (or reuses `ui_state` with a key convention), writes through the existing `WorkerBridge.send('ui:set')` path, and syncs via the existing CloudKit checkpoint.
5. **LATCH histogram/chips** extend the existing `LatchExplorers` Category and Time sections with new sub-components that wire into `FilterProvider` using the same patterns as the checkbox lists.

No new Worker message types are needed (existing `supergrid:query`, `db:query`, `ui:set`/`ui:get` cover all cases). No schema migration is needed beyond adding a `notebooks` table or key convention. No new providers are needed -- all state flows through existing `PAFVProvider`, `FilterProvider`, and `StateCoordinator`.

---

## Recommended Architecture

### System-Level Data Flow

```
User Action
    |
    v
[Workbench Panel UI]  -- SuperCalcPanel / NotebookExplorer / LatchExplorers
    |
    v
[Provider Layer]       -- PAFVProvider / FilterProvider / StateCoordinator
    |
    v
[WorkerBridge.send()]  -- correlation ID + typed payload
    |
    v
[Worker Handler]       -- supergrid.handler / ui-state.handler / db:query
    |
    v
[sql.js Database]      -- GROUP BY aggregates / notebook CRUD / distinct values
    |
    v
[WorkerResponse]       -- CellDatum[] / { value } / { rows }
    |
    v
[SuperGrid / Notebook / LatchExplorers]  -- D3 data join / marked render / D3 checkbox join
```

---

## Component Integration: SuperCalc Footer Rows

### Question: How do SQL aggregate footer rows integrate with existing SuperGrid query pipeline and D3 data join?

### Architecture Decision: Parallel Aggregate Query + Footer Row Layer

**Why parallel, not inline:** The existing `supergrid:query` handler returns `CellDatum[]` with `card_ids` and `card_names` per group intersection. Footer aggregates (SUM/AVG/COUNT/MIN/MAX per column) operate on a different GROUP BY granularity -- they aggregate across all rows within a column group, not per cell. Injecting this into the existing query would break the cell-level data join. A second, simpler query returns column-level aggregates.

### Integration Points

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `SuperGridQuery.ts` | **NEW FUNCTION** | `buildSuperCalcQuery(config)` -- builds GROUP BY on colAxes only with aggregate functions |
| `supergrid.handler.ts` | **MODIFY** | Add `handleSuperCalcQuery()` alongside existing `handleSuperGridQuery()` |
| `protocol.ts` | **MODIFY** | Add `supergrid:calc` request/response types to `WorkerPayloads` / `WorkerResponses` |
| `worker.ts` (router) | **MODIFY** | Add case for `'supergrid:calc'` routing |
| `SuperGrid.ts` | **MODIFY** | Add `_renderFooterRow()` method called after `_renderCells()` |
| `PAFVProvider.ts` | **MODIFY** | Add `calcConfig` state: `{ enabled: boolean, functions: CalcFunction[], field: AxisField }` |
| `WorkbenchShell.ts` | **MODIFY** | New `SuperCalcPanel` wired into a new CollapsibleSection (or within Projection explorer) |

### Data Flow

```
1. PAFVProvider.setCalcConfig({ enabled: true, functions: ['sum','avg'], field: 'priority' })
    |
2. StateCoordinator fires -> SuperGrid._fetchAndRender()
    |
3. SuperGrid calls bridge.send('supergrid:query', ...) AND bridge.send('supergrid:calc', ...)
    |
4. supergrid:calc handler executes:
    SELECT col_axis_1, col_axis_2, SUM(priority), AVG(priority), COUNT(*)
    FROM cards WHERE deleted_at IS NULL [AND filters]
    GROUP BY col_axis_1, col_axis_2
    |
5. Returns CalcDatum[] = [{ col_axis_values..., sum: N, avg: N, count: N }]
    |
6. SuperGrid._renderFooterRow() places aggregate cells below data cells
    - CSS: position: sticky; bottom: 0; z-index: 3 (below headers, above cells)
    - D3 data join keyed on column dimension key
    - Each footer cell shows formatted aggregate values
```

### New Protocol Types

```typescript
// In protocol.ts
export interface CalcDatum {
    [key: string]: unknown;  // Column axis values
    aggregates: Record<string, number>;  // { sum: N, avg: N, count: N, ... }
}

// Add to WorkerPayloads:
'supergrid:calc': {
    colAxes: AxisMapping[];
    functions: Array<'sum' | 'avg' | 'count' | 'min' | 'max'>;
    field: AxisField;  // The numeric field to aggregate
    where: string;
    params: unknown[];
    granularity?: TimeGranularity | null;
    searchTerm?: string;
};

// Add to WorkerResponses:
'supergrid:calc': { cells: CalcDatum[] };
```

### CSS Grid Footer Layout

Footer rows occupy the last gridRow in the CSS Grid. They use `position: sticky; bottom: 0` to remain visible when scrolling, matching the sticky header pattern from SuperZoom. The footer row gets `z-index: 3` (headers are z-index 4, corner cell is z-index 5).

The `gutterOffset` pattern (0 or 1 based on spreadsheet viewMode) applies to footer cells just as it does to data cells and headers -- the same `gridColumn` calculation ensures alignment.

### Collapse Interaction

When a column header is collapsed in aggregate mode, the footer cell for that group shows the aggregate of the collapsed group (derived from the same calc query). When collapsed in hide mode, the footer cell is omitted (zero footprint, matching data cells).

---

## Component Integration: Notebook Formatting Toolbar

### Question: How does the formatting toolbar integrate with the existing marked + DOMPurify pipeline?

### Architecture Decision: Toolbar Above Textarea, Markdown Insertion

**Why toolbar, not contenteditable:** The existing NotebookExplorer uses a plain `<textarea>` with `_wrapSelection()` for Cmd+B/I/K. A contenteditable div would require reimplementing selection handling, undo history, and sanitization. The toolbar simply provides clickable buttons that call the same `_wrapSelection()` and new `_insertBlock()` methods.

### Integration Points

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `NotebookExplorer.ts` | **MODIFY** | Add `_createToolbar()`, `_insertBlock()`, extend `_wrapSelection()` |
| `notebook-explorer.css` | **MODIFY** | Toolbar layout styles (flexbox row above textarea) |

### Toolbar Buttons and Actions

| Button | Action | Markdown Inserted |
|--------|--------|-------------------|
| Bold | `_wrapSelection('**', '**')` | `**text**` |
| Italic | `_wrapSelection('_', '_')` | `_text_` |
| Heading | `_insertBlock('## ')` | `## ` at line start |
| Bullet List | `_insertBlock('- ')` | `- ` at line start |
| Ordered List | `_insertBlock('1. ')` | `1. ` at line start |
| Link | `_wrapSelection('[', '](url)')` | `[text](url)` |
| Code | `_wrapSelection('`', '`')` | `` `text` `` |
| Chart | `_insertBlock('\n```chart\ntype: bar\nfield: priority\n```\n')` | Chart code block |

### New Method: `_insertBlock(prefix)`

```typescript
private _insertBlock(prefix: string): void {
    const textarea = this._textareaEl!;
    const start = textarea.selectionStart;
    const text = textarea.value;

    // Find start of current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;

    // Insert prefix at line start
    textarea.value = text.substring(0, lineStart) + prefix + text.substring(lineStart);
    textarea.selectionStart = textarea.selectionEnd = lineStart + prefix.length;
    textarea.focus();
    this._content = textarea.value;
}
```

### Impact on Preview Pipeline

Zero impact. The toolbar inserts standard Markdown into the textarea. The existing `marked.parse() -> DOMPurify.sanitize() -> innerHTML` pipeline handles all standard Markdown already. Chart blocks require a custom marked renderer extension (see next section).

---

## Component Integration: D3 Chart Blocks

### Question: How do D3 chart blocks integrate with current grid data flow?

### Architecture Decision: Custom marked Renderer + Post-Render D3 Mount

**Why custom renderer, not raw HTML:** Injecting raw `<svg>` into marked output would be stripped by DOMPurify's strict allowlist (SVG tags are not in `ALLOWED_TAGS`). Instead, the custom renderer produces a `<div class="notebook-chart" data-chart-config="...">` placeholder, which DOMPurify allows (div is in ALLOWED_TAGS, data-* attrs need `ALLOW_DATA_ATTR: true` for chart config only). After innerHTML assignment, a post-render pass finds all `.notebook-chart` divs and mounts D3 mini-charts into them.

**Alternative considered:** Adding SVG-related tags to DOMPurify's allowlist. Rejected because SVG can carry `onload`, `<foreignObject>`, and other XSS vectors. Keeping SVG out of the sanitizer and creating it programmatically via D3 is the secure approach.

### Integration Points

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `NotebookExplorer.ts` | **MODIFY** | Add custom `marked` renderer extension, add `_mountChartBlocks()` post-render |
| `NotebookExplorer.ts` | **MODIFY** | Inject current grid data dependency (bridge or cached cell data) |
| `notebook-explorer.css` | **MODIFY** | Chart container sizing styles |
| DOMPurify config | **MODIFY** | Add `data-chart-type` and `data-chart-field` to ALLOWED_ATTR |

### Chart Block Syntax (in Markdown)

````markdown
```chart
type: bar
field: priority
```
````

### Rendering Pipeline

```
1. User writes ```chart block in textarea
    |
2. Switch to Preview tab -> _renderPreview()
    |
3. Custom marked renderer intercepts ```chart code blocks:
    - Parses YAML-like config (type, field)
    - Outputs: <div class="notebook-chart" data-chart-type="bar" data-chart-field="priority"></div>
    |
4. DOMPurify.sanitize() passes the div through (div + data-* attrs allowed)
    |
5. innerHTML assignment places placeholder divs in preview DOM
    |
6. _mountChartBlocks() iterates .notebook-chart divs:
    - Reads data-chart-type and data-chart-field
    - Calls bridge.send('db:query', { sql: aggregate query }) to get chart data
    - Creates D3 SVG chart inside each div
```

### Chart Types (Phase 1)

| Type | D3 Pattern | SQL | Visual |
|------|-----------|-----|--------|
| `bar` | d3.scaleBand + rect | `SELECT field, COUNT(*) FROM cards WHERE deleted_at IS NULL GROUP BY field` | Horizontal bars |
| `pie` | d3.arc + d3.pie | Same as bar | Pie slices |
| `histogram` | d3.bin + rect | `SELECT field FROM cards WHERE deleted_at IS NULL AND field IS NOT NULL` | Frequency distribution |

### Data Source

Chart blocks use the existing `db:query` Worker message type. They do NOT subscribe to StateCoordinator -- charts reflect the full dataset (not the current filter state). This avoids re-rendering charts on every filter change. If filtered data is desired in future, a `filtered: true` flag in the chart config can switch to using the current FilterProvider.compile() output.

### Security Model

D3 creates SVG elements programmatically via `d3.select(container).append('svg')`. No innerHTML is used for SVG content. The DOMPurify allowlist changes are minimal: only `data-chart-type` and `data-chart-field` attributes are added (both are read-only metadata, not executable).

---

## Component Integration: Notebook Persistence

### Question: How does notebook persistence integrate with IsometryDatabase schema and CloudKit sync?

### Architecture Decision: ui_state Key Convention (Not New Table)

**Why ui_state, not a new table:** The existing `ui_state` table (key-value with TEXT primary key) already handles Tier 2 persistence for FilterProvider, PAFVProvider, DensityProvider, and ThemeProvider state. Notebook content is per-session Tier 2 state -- it survives reload but is device-local. Using `ui_state` with a `notebook:content` key avoids schema migration, uses the existing `ui:set`/`ui:get` Worker handlers, and automatically participates in checkpoint persistence to Application Support.

**CloudKit sync consideration:** The `ui_state` table is NOT synced via CloudKit (Tier 2 = device-local by design, per D-005). If notebook content should sync across devices, it needs to be stored in the `cards` table as a special card (e.g., `card_type = 'note'` with `source = 'notebook'`). This is a product decision, not a technical constraint. The architecture supports both paths.

**Recommendation:** Start with `ui_state` key convention for v5.2 (simplest, no schema change, no sync complexity). Add card-based persistence in a future milestone if cross-device notebook sync is desired.

### Integration Points

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `NotebookExplorer.ts` | **MODIFY** | Add `_persistContent()` debounced save, `_loadContent()` on mount |
| `NotebookExplorer.ts` | **MODIFY** | Accept `bridge: WorkerBridgeLike` dependency in constructor |
| `WorkbenchShell.ts` or `index.ts` | **MODIFY** | Pass bridge reference when creating NotebookExplorer |

### Persistence Flow

```
SAVE (debounced, 1s after last keystroke):
1. _textareaEl 'input' event fires
2. this._content = textarea.value (existing)
3. this._schedulePersist() -- 1s debounce timer
4. Timer fires: bridge.send('ui:set', { key: 'notebook:content', value: this._content })
5. Worker handler: INSERT OR REPLACE INTO ui_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
6. Checkpoint timer (30s) writes database to disk -> CloudKit sync (if ui_state is promoted to Tier 1)

LOAD (on mount):
1. mount(container) calls _loadContent()
2. bridge.send('ui:get', { key: 'notebook:content' })
3. Response: { key, value, updated_at }
4. If value !== null: this._content = value; textarea.value = value
```

### Existing Handler Compatibility

The `ui:set` and `ui:get` handlers in `ui-state.handler.ts` already handle arbitrary key-value pairs. The `notebook:content` key fits the existing pattern -- no handler modifications needed.

### Database Checkpoint Flow

The existing checkpoint flow (`BridgeManager` 30s timer -> `requestCheckpoint()` -> Worker `db:export` -> Swift `DatabaseManager.saveCheckpoint()`) already persists all ui_state rows. Notebook content is automatically included in checkpoints with zero additional work.

---

## Component Integration: LATCH Histogram + Category Chips

### Question: How do histogram scrubbers and category chips integrate with FilterProvider?

### Architecture Decision: New Sub-Components Inside Existing LatchExplorers Sections

**Why sub-components, not new sections:** The existing `LatchExplorers` already has 5 sections (L, A, T, C, H) with per-section body population (`_populateLocation`, `_populateAlphabet`, etc.). Histograms belong in the Time (T) section alongside existing presets, and category chips belong in the Category (C) section alongside existing checkboxes. Adding new sections would break the LATCH mnemonic.

### Integration Points

| Component | Change Type | Description |
|-----------|-------------|-------------|
| `LatchExplorers.ts` | **MODIFY** | Add `_renderHistogram()` in Time section, `_renderChips()` in Category section |
| `latch-explorers.css` | **MODIFY** | Histogram bar styles, chip pill styles |
| `FilterProvider.ts` | **NO CHANGE** | Uses existing `addFilter(gte/lte)` for range, `setAxisFilter()` for chips |

### Histogram Architecture

```
Time Section Body (existing):
  [Field Label: Created At]
  [Today] [This Week] [This Month] [This Year]  <-- existing presets
  [=========|XXXX|=========]                      <-- NEW: histogram scrubber
  [Field Label: Modified At]
  ...

Data Flow:
1. mount() -> bridge.send('db:query', {
    sql: "SELECT strftime('%Y-%m', created_at) AS bucket, COUNT(*) AS cnt
          FROM cards WHERE deleted_at IS NULL AND created_at IS NOT NULL
          GROUP BY bucket ORDER BY bucket",
    params: []
   })
2. Response: [{ bucket: '2025-01', cnt: 42 }, { bucket: '2025-02', cnt: 67 }, ...]
3. D3 renders horizontal bar chart with brush overlay
4. d3.brushX() drag -> reads [startBucket, endBucket]
5. filter.addFilter({ field: 'created_at', operator: 'gte', value: startDate })
   filter.addFilter({ field: 'created_at', operator: 'lte', value: endDate })
```

### Histogram Component

```typescript
// Inline within LatchExplorers (not a separate file -- follows existing pattern)
private _renderHistogram(container: HTMLElement, field: string, data: BucketDatum[]): void {
    const svg = d3.select(container).append('svg')
        .attr('class', 'latch-histogram')
        .attr('width', '100%')
        .attr('height', 40);

    const x = d3.scaleBand()
        .domain(data.map(d => d.bucket))
        .range([0, containerWidth])
        .padding(0.1);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.cnt)!])
        .range([40, 0]);

    // Bars via D3 data join (key function mandatory)
    svg.selectAll('rect')
        .data(data, d => d.bucket)
        .join('rect')
        .attr('x', d => x(d.bucket)!)
        .attr('y', d => y(d.cnt))
        .attr('width', x.bandwidth())
        .attr('height', d => 40 - y(d.cnt))
        .attr('class', 'latch-histogram-bar');

    // d3.brushX overlay for range selection
    const brush = d3.brushX()
        .extent([[0, 0], [containerWidth, 40]])
        .on('end', (event) => {
            if (!event.selection) return;
            const [x0, x1] = event.selection;
            // Map pixel range back to date range
            // Apply via FilterProvider.addFilter(gte/lte)
        });

    svg.append('g').call(brush);
}
```

### Category Chips Architecture

```
Category Section Body (existing):
  [Field Label: Folder]
  [ ] Work  [ ] Personal  [ ] Archive   <-- existing checkboxes
  [Work] [Personal] [Archive]             <-- NEW: clickable chip pills (alternative view)

Category Section Body (with chips):
  [Field Label: Status]
  [active] [done] [archived]              <-- chip pills with count badges
```

**Chips vs checkboxes:** Chips are a visual alternative to checkboxes for fields with low cardinality (< 20 values). They show a pill with the value text and optional count badge. Clicking a chip toggles it, calling the same `FilterProvider.setAxisFilter()` method used by checkboxes. Both views can coexist (chips for status/card_type, checkboxes for folder which may have many values).

### Chip Component

```typescript
private _renderChips(container: HTMLElement, field: string, values: string[]): void {
    const chipContainer = d3.select(container).append('div')
        .attr('class', 'latch-chip-list');

    chipContainer.selectAll('.latch-chip')
        .data(values, d => d)
        .join('button')
        .attr('class', d => {
            const active = this._config.filter.getAxisFilter(field);
            return `latch-chip ${active.includes(d) ? 'latch-chip--active' : ''}`;
        })
        .attr('type', 'button')
        .text(d => d)
        .on('click', (event, d) => {
            const active = this._config.filter.getAxisFilter(field);
            if (active.includes(d)) {
                this._config.filter.setAxisFilter(field, active.filter(v => v !== d));
            } else {
                this._config.filter.setAxisFilter(field, [...active, d]);
            }
        });
}
```

---

## Suggested Build Order

### Rationale for Ordering

The build order is driven by dependency analysis:

1. **SuperCalc** depends only on existing SuperGrid + PAFVProvider (no other v5.2 features depend on it, and it doesn't depend on them).
2. **Notebook toolbar** depends on nothing new -- it extends existing NotebookExplorer.
3. **Notebook persistence** depends on toolbar existing (so content is worth saving).
4. **D3 chart blocks** depend on persistence (charts reference data, and notebook content must survive reload for charts to be useful) and on the toolbar (chart insertion button).
5. **LATCH histogram/chips** depend on nothing new -- they extend existing LatchExplorers.

### Recommended Phase Structure

```
Phase 62: SuperCalc Footer Rows
  - NEW: buildSuperCalcQuery() in SuperGridQuery.ts
  - NEW: supergrid:calc protocol type + handler
  - MODIFY: PAFVProvider calcConfig state
  - MODIFY: SuperGrid._renderFooterRow()
  - NEW: SuperCalcPanel (Workbench panel or ProjectionExplorer extension)
  Dependencies: None (standalone feature)
  Risk: LOW -- follows existing supergrid:query pattern exactly

Phase 63: Notebook Formatting Toolbar
  - MODIFY: NotebookExplorer -- toolbar buttons, _insertBlock()
  - MODIFY: notebook-explorer.css -- toolbar layout
  Dependencies: None
  Risk: LOW -- pure UI, no data flow changes

Phase 64: Notebook Persistence
  - MODIFY: NotebookExplorer -- bridge dependency, debounced save, load on mount
  - Uses existing ui:set/ui:get handlers
  Dependencies: Phase 63 (toolbar makes content worth persisting)
  Risk: LOW -- uses existing ui_state infrastructure

Phase 65: D3 Chart Blocks
  - MODIFY: NotebookExplorer -- custom marked renderer, _mountChartBlocks()
  - MODIFY: DOMPurify config (add data-chart-* attrs)
  - Uses existing db:query handler for chart data
  Dependencies: Phase 63 (toolbar chart button), Phase 64 (persistence)
  Risk: MEDIUM -- custom marked renderer + post-render D3 mount is new pattern

Phase 66: LATCH Histogram Scrubbers
  - MODIFY: LatchExplorers -- _renderHistogram() in Time section
  - MODIFY: latch-explorers.css -- histogram styles
  - Uses existing db:query for bucket aggregation
  - Uses existing FilterProvider.addFilter(gte/lte) for range
  Dependencies: None
  Risk: MEDIUM -- d3.brushX interaction + date range mapping

Phase 67: Category Chips
  - MODIFY: LatchExplorers -- _renderChips() in Category section
  - MODIFY: latch-explorers.css -- chip styles
  - Uses existing FilterProvider.setAxisFilter()
  Dependencies: None
  Risk: LOW -- simpler than checkboxes, same provider API
```

### Parallelization Opportunities

Phases 62, 63, and 66/67 are fully independent and could be developed in parallel. Phase 64 depends on 63, and Phase 65 depends on both 63 and 64.

```
      62 (SuperCalc)      63 (Toolbar) -----> 64 (Persist) -----> 65 (Charts)
      66 (Histogram)      67 (Chips)
```

---

## Patterns to Follow

### Pattern 1: Parallel Worker Queries (SuperCalc)

**What:** Issue two Worker requests in parallel and await both.
**When:** Footer aggregates need a separate GROUP BY from cell data.
**Example:**

```typescript
// In SuperGrid._fetchAndRender()
const [cellResult, calcResult] = await Promise.all([
    this._bridge.send('supergrid:query', queryConfig),
    calcEnabled ? this._bridge.send('supergrid:calc', calcConfig) : Promise.resolve(null),
]);
this._renderCells(cellResult.cells);
if (calcResult) this._renderFooterRow(calcResult.cells);
```

### Pattern 2: Post-Render DOM Mounting (Chart Blocks)

**What:** Use innerHTML for sanitized Markdown, then D3-mount into placeholder divs.
**When:** Rich visualizations need to live inside Markdown output.
**Example:**

```typescript
// In NotebookExplorer._renderPreview()
const rawHtml = marked.parse(this._content) as string;
const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
this._previewEl!.innerHTML = cleanHtml;
this._mountChartBlocks();  // D3 creates SVG inside .notebook-chart divs
```

### Pattern 3: Debounced Persistence (Notebook Save)

**What:** Debounce save calls to avoid excessive Worker roundtrips.
**When:** Content changes rapidly (typing).
**Example:**

```typescript
private _persistTimer: ReturnType<typeof setTimeout> | null = null;

private _schedulePersist(): void {
    if (this._persistTimer !== null) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(() => {
        this._bridge.send('ui:set', {
            key: 'notebook:content',
            value: this._content,
        });
        this._persistTimer = null;
    }, 1000);
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Modifying Existing supergrid:query for Footer Aggregates

**What:** Adding footer aggregate columns to the existing `buildSuperGridQuery()` output.
**Why bad:** The existing query groups by both colAxes AND rowAxes, returning one row per cell. Footer aggregates group by colAxes only. Mixing them produces incorrect results (either missing row granularity for cells or missing column-level aggregation for footers).
**Instead:** Use a parallel query (`supergrid:calc`) that groups by colAxes only.

### Anti-Pattern 2: Using contenteditable for Notebook Editor

**What:** Replacing the textarea with a contenteditable div for "rich" editing.
**Why bad:** contenteditable brings a huge surface area of browser inconsistencies, requires reimplementing undo/redo, and makes sanitization vastly more complex. The existing textarea + Markdown preview is simple, tested, and XSS-safe.
**Instead:** Keep textarea for editing, toolbar for formatting shortcuts, preview for rendered output.

### Anti-Pattern 3: SVG in DOMPurify Allowlist

**What:** Adding SVG tags to the sanitizer allowlist so charts render in innerHTML.
**Why bad:** SVG supports `<script>`, `onload`, `<foreignObject>`, and other XSS vectors. Allowing SVG in the sanitizer opens attack surface in the WKWebView context.
**Instead:** Use placeholder divs in sanitized HTML, then D3 creates SVG programmatically after sanitization.

### Anti-Pattern 4: New Database Table for Notebook Content

**What:** Creating a `notebooks` table with its own schema.
**Why bad:** Adds schema migration complexity, requires new Worker handlers, and complicates CloudKit sync (new CKRecord type). For a single text blob, this is massive over-engineering.
**Instead:** Use `ui_state` with `key = 'notebook:content'`. Existing handlers, existing checkpoint, zero migration.

### Anti-Pattern 5: Chart Blocks Subscribing to StateCoordinator

**What:** Re-rendering chart blocks on every filter/axis change.
**Why bad:** Charts are in the notebook preview, which is a separate panel from SuperGrid. Re-rendering on every coordinator notification would cause flickering and performance issues. Notebook previews are user-triggered (tab switch), not reactive.
**Instead:** Chart blocks fetch data when the preview tab is activated. If the user wants filtered data, they re-open the preview.

---

## New vs Modified Components Summary

| File | Status | Reason |
|------|--------|--------|
| `src/views/supergrid/SuperGridQuery.ts` | MODIFY + NEW fn | Add `buildSuperCalcQuery()` |
| `src/worker/handlers/supergrid.handler.ts` | MODIFY | Add `handleSuperCalcQuery()` |
| `src/worker/protocol.ts` | MODIFY | Add `supergrid:calc` types |
| `src/worker/worker.ts` | MODIFY | Route `supergrid:calc` |
| `src/views/SuperGrid.ts` | MODIFY | Add `_renderFooterRow()`, parallel query |
| `src/providers/PAFVProvider.ts` | MODIFY | Add calcConfig state |
| `src/ui/NotebookExplorer.ts` | MODIFY (major) | Toolbar, persistence, chart blocks |
| `src/styles/notebook-explorer.css` | MODIFY | Toolbar + chart styles |
| `src/ui/LatchExplorers.ts` | MODIFY | Histogram + chips sub-components |
| `src/styles/latch-explorers.css` | MODIFY | Histogram + chip styles |
| `src/ui/WorkbenchShell.ts` | MODIFY (minor) | SuperCalcPanel section or config |

**No new files needed.** All features integrate into existing components. This follows the project's pattern of extending rather than proliferating files.

---

## Scalability Considerations

| Concern | At 100 cards | At 10K cards | At 100K+ cards |
|---------|-------------|--------------|----------------|
| SuperCalc query | <5ms (trivial) | <50ms (GROUP BY on indexes) | Needs SuperGridVirtualizer integration -- footer row pinned outside virtual window |
| Chart block data | <10ms | <100ms | Use LIMIT + sampling in aggregate query |
| Histogram buckets | <10ms | <50ms | Natural ceiling (~100 monthly buckets over 10 years) |
| Notebook persistence | <1ms (small text) | N/A (text size independent of card count) | N/A |

---

## Sources

- All findings derived from reading existing Isometry v5 source code (HIGH confidence)
- `src/views/supergrid/SuperGridQuery.ts` -- existing query builder pattern
- `src/worker/handlers/supergrid.handler.ts` -- existing handler pattern
- `src/worker/protocol.ts` -- existing typed protocol pattern
- `src/ui/NotebookExplorer.ts` -- existing notebook architecture
- `src/ui/LatchExplorers.ts` -- existing LATCH filter architecture
- `src/providers/PAFVProvider.ts` -- existing provider state management
- `src/providers/FilterProvider.ts` -- existing filter compilation
- `src/database/schema.sql` -- existing schema (ui_state table)
- `CLAUDE-v5.md` -- architectural decisions D-001 through D-010
