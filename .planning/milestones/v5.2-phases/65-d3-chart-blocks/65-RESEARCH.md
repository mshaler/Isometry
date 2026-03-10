# Phase 65: D3 Chart Blocks - Research

**Researched:** 2026-03-09
**Domain:** Custom marked renderer extensions, D3.js chart rendering, Worker-side SQL aggregation, DOMPurify two-pass sanitization
**Confidence:** HIGH

## Summary

Phase 65 embeds live D3 mini-visualizations inside notebook preview panels. The implementation requires four interconnected capabilities: (1) a custom `marked` renderer extension that intercepts fenced code blocks with `lang === 'chart'` and emits placeholder `<div>` elements, (2) a YAML-style config parser that extracts chart type, axis fields, and options from the code block text, (3) a new `chart:query` Worker message type that builds SQL GROUP BY aggregation queries scoped to the current filter state, and (4) a D3 chart rendering pipeline that mounts SVG into DOMPurify-sanitized placeholder divs.

The project already has all the building blocks in place: marked v17.0.4 with the `renderer.code()` override API, DOMPurify v3.3.2 with a strict allowlist, D3 v7.9 with extensive chart patterns across LatchExplorers/TimelineView, FilterProvider.subscribe() for reactive updates, and the `supergrid:calc` handler as a reference for Worker-side SQL aggregation. The two-pass sanitization pattern (DOMPurify first, then programmatic D3 mount) is already established for GFM task list checkboxes.

**Primary recommendation:** Override `marked`'s `renderer.code()` method to emit `<div data-chart-id="..." data-chart-config="...">` placeholders, then post-DOMPurify walk the preview DOM to mount D3 SVG charts into each placeholder. Use a new `chart:query` Worker message type following the `supergrid:calc` pattern for SQL aggregation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- YAML-style config inside fenced `chart` code blocks (````chart`)
- Keys: `type` (required), `x`, `y` (required for bar/line/scatter), `value` (required for pie)
- Optional config keys: `color`, `title`, `legend`, `limit`
- Custom `marked` renderer extension detects the `chart` language tag on fenced code blocks
- Standard code block rendering for other languages must be unaffected
- 4 chart types in scope: bar, pie/donut, line, scatter
- Bar: vertical bars for category counts (d3 bar patterns from LatchExplorers)
- Pie/donut: proportional breakdown via d3.pie() + d3.arc()
- Line: trend over time for date fields (d3 line patterns from TimelineView)
- Scatter: two numeric fields as dots for correlation
- Explicit `x:` and `y:` keys in YAML config (not positional)
- `count` is a magic keyword for y-axis meaning "count rows per x-value"
- AliasProvider resolves display names to qualified column names
- Each chart block sends its own query via WorkerBridge (new `chart:query` message type)
- Query uses FilterProvider.compile() for the WHERE clause
- Aggregation via SQL GROUP BY on the Worker side (not client-side d3.rollup)
- Independent of SuperGrid's cell data query -- clean separation
- Unknown field -> inline styled error message in the chart placeholder
- Invalid YAML -> inline error with parse details
- Other charts and markdown still render -- non-destructive
- Charts only render when user is on the Preview tab
- While on Preview tab, filter changes trigger debounced re-query (~300ms) and in-place chart update
- Subtle D3 transitions (~300ms) on data change
- Filter subscription via FilterProvider.subscribe()
- Aspect-ratio-based sizing -- chart SVG scales with panel width, height derived from ratio
- No hard limit on number of chart blocks per notebook
- Bordered card container with rounded corners and light background
- Hover tooltips on bars/slices/points showing label + value
- Two-pass rendering: DOMPurify sanitizes placeholder divs first, then D3 mounts SVG programmatically
- No XSS vectors from user-authored chart YAML -- SVG is D3-generated, not user HTML
- SANITIZE_CONFIG needs `div` with `data-chart-*` attributes for placeholders

### Claude's Discretion
- Exact aspect ratio choice (e.g., 16:9 vs 4:3 vs 3:2)
- Tooltip styling and positioning
- D3 color scale for multi-value charts (d3.schemeCategory10 or similar)
- Exact debounce timing for filter change re-query
- YAML parsing library choice (simple key:value parser vs full YAML)
- Chart axis label formatting and tick count

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTE-06 | D3 chart blocks embedded in notebook preview using custom marked extension with fenced syntax | marked v17.0.4 `renderer.code()` override intercepts `lang === 'chart'`, emits placeholder divs; post-sanitization D3 mount pipeline |
| NOTE-07 | Chart blocks render current filtered SuperGrid data (live dashboard reflecting active filters/search) | New `chart:query` Worker message type with FilterProvider.compile() WHERE clause; FilterProvider.subscribe() for reactive updates |
| NOTE-08 | Chart block SVG rendered via two-pass approach -- DOMPurify sanitizes first, D3 mounts into placeholders after | SANITIZE_CONFIG already allows `div`; add `data-chart-*` to ALLOWED_ATTR or use ALLOW_DATA_ATTR selectively; D3 programmatic SVG mount post-sanitization |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| marked | 17.0.4 | Markdown-to-HTML rendering with extensible renderer | Already imported in NotebookExplorer; `renderer.code()` override is the documented extension point for custom fenced blocks |
| DOMPurify | 3.3.2 | HTML sanitization with strict allowlist | Already imported in NotebookExplorer; two-pass pattern established for GFM task lists |
| D3.js | 7.9 | SVG chart rendering (d3.pie, d3.arc, d3.scaleLinear, d3.scaleBand, d3.line, d3.axisBottom, d3.axisLeft) | Already used extensively across all views; chart patterns exist in LatchExplorers and TimelineView |
| sql.js | 1.14 | Worker-side SQL aggregation via GROUP BY | Already the system of record; `supergrid:calc` handler is the reference for chart query pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none -- simple key:value parser) | N/A | Parse YAML-style chart config | Simple line-by-line `key: value` parser is sufficient -- chart configs use flat key-value pairs with no nesting |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple key:value parser | js-yaml (~50KB) | Full YAML library is overkill for flat key-value configs; adds bundle size for no benefit |
| `marked.use({ renderer: { code() } })` | Custom tokenizer extension | Renderer override is simpler and the standard approach for intercepting specific code block languages |
| `data-chart-*` attributes on placeholder divs | Class-based identification | data attributes are more semantic and allow encoding chart config as JSON for post-sanitization parsing |

**Installation:**
```bash
# No new dependencies required -- all libraries already installed
```

## Architecture Patterns

### Recommended Module Structure
```
src/
├── ui/
│   ├── NotebookExplorer.ts    # Modified: renderer extension, chart lifecycle, filter subscription
│   └── charts/
│       ├── ChartParser.ts     # YAML config parser + validation
│       ├── ChartRenderer.ts   # D3 chart mount/update/destroy lifecycle
│       ├── BarChart.ts        # d3.scaleBand + d3.scaleLinear bar chart
│       ├── PieChart.ts        # d3.pie + d3.arc donut chart
│       ├── LineChart.ts       # d3.line + d3.scaleTime line chart
│       └── ScatterChart.ts    # d3.scaleLinear x/y scatter plot
├── worker/
│   ├── protocol.ts            # Modified: add chart:query type + payloads
│   ├── worker.ts              # Modified: add chart:query route
│   └── handlers/
│       └── chart.handler.ts   # SQL GROUP BY query builder for chart data
├── providers/
│   └── AliasProvider.ts       # Used as-is: resolve display names to column names
└── styles/
    └── notebook-explorer.css  # Modified: add .notebook-chart-card styles
```

### Pattern 1: marked Renderer Override for Chart Blocks
**What:** Override `renderer.code()` to intercept fenced code blocks with `lang === 'chart'` and emit placeholder divs instead of `<pre><code>`.
**When to use:** When the marked parse pipeline runs in `_renderPreview()`.
**Confidence:** HIGH -- `renderer.code()` is the standard marked API for this. The method receives `{ text, lang, escaped }` (Tokens.Code interface confirmed in marked v17.0.4 types).

```typescript
// marked.use() called once during NotebookExplorer construction or module init
import { marked } from 'marked';

marked.use({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      if (lang === 'chart') {
        const chartId = `chart-${crypto.randomUUID()}`;
        // Encode config as base64 or JSON in data attribute to survive DOMPurify
        const encodedConfig = btoa(text);
        return `<div class="notebook-chart-card" data-chart-id="${chartId}" data-chart-config="${encodedConfig}"></div>`;
      }
      // Return false to fall through to default code block rendering
      return false;
    },
  },
});
```

**Critical detail:** In marked v17.0.4, returning `false` from a renderer override tells marked to use the default renderer for that token. This is how standard code blocks remain unaffected.

### Pattern 2: Two-Pass Sanitization with Data Attributes
**What:** DOMPurify sanitizes the HTML output from marked (pass 1), then JavaScript walks the sanitized DOM to find chart placeholders and mounts D3 SVG (pass 2).
**When to use:** In `_renderPreview()` after `DOMPurify.sanitize()` and `innerHTML` assignment.
**Confidence:** HIGH -- this exact pattern is already used for GFM task list checkboxes.

```typescript
private _renderPreview(): void {
  const rawHtml = marked.parse(this._content) as string;
  const cleanHtml = DOMPurify.sanitize(rawHtml, SANITIZE_CONFIG);
  this._previewEl!.innerHTML = cleanHtml;

  // Pass 2: Mount D3 charts into sanitized placeholder divs
  const chartDivs = this._previewEl!.querySelectorAll<HTMLDivElement>('.notebook-chart-card');
  for (const div of chartDivs) {
    const configEncoded = div.getAttribute('data-chart-config');
    if (!configEncoded) continue;
    const configText = atob(configEncoded);
    this._mountChart(div, configText);
  }
}
```

**SANITIZE_CONFIG change required:** Add `data-chart-id` and `data-chart-config` to ALLOWED_ATTR array. Currently `ALLOW_DATA_ATTR: false` -- we should either flip this to `true` (allows ALL data-* attributes) or add specific data attributes to the ALLOWED_ATTR list. Recommendation: add specific attributes to ALLOWED_ATTR to maintain the strict allowlist philosophy:

```typescript
ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'type', 'checked', 'disabled',
               'data-chart-id', 'data-chart-config'],
```

### Pattern 3: Worker-Side SQL Aggregation for Chart Data
**What:** New `chart:query` message type that builds SQL GROUP BY queries based on chart config, using FilterProvider.compile() output for the WHERE clause.
**When to use:** When a chart block needs data. Each chart sends its own independent query.
**Confidence:** HIGH -- directly follows the `supergrid:calc` handler pattern.

```typescript
// protocol.ts addition
'chart:query': {
  chartType: 'bar' | 'pie' | 'line' | 'scatter';
  xField: string;        // Validated column name (post-AliasProvider resolution)
  yField: string | null;  // null when yField is 'count' (magic keyword)
  where: string;          // From FilterProvider.compile()
  params: unknown[];      // From FilterProvider.compile()
  limit?: number;         // Optional LIMIT clause
};

// Response type
'chart:query': {
  rows: Array<{ label: string; value: number }>;
};
```

The handler builds SQL like:
- **Bar (y=count):** `SELECT xField AS label, COUNT(*) AS value FROM cards WHERE ... GROUP BY xField ORDER BY value DESC LIMIT ?`
- **Bar (y=numeric):** `SELECT xField AS label, SUM(yField) AS value FROM cards WHERE ... GROUP BY xField ORDER BY xField ASC`
- **Pie:** `SELECT xField AS label, COUNT(*) AS value FROM cards WHERE ... GROUP BY xField ORDER BY value DESC LIMIT ?`
- **Line:** `SELECT xField AS label, COUNT(*) AS value FROM cards WHERE ... GROUP BY xField ORDER BY xField ASC`
- **Scatter:** `SELECT xField AS x, yField AS y FROM cards WHERE ... AND xField IS NOT NULL AND yField IS NOT NULL`

### Pattern 4: Reactive Filter Subscription
**What:** NotebookExplorer subscribes to FilterProvider changes and re-queries/re-renders chart blocks when filters change.
**When to use:** When user is on Preview tab and filter state changes.
**Confidence:** HIGH -- follows exact same pattern as view subscriptions throughout the codebase.

```typescript
// In NotebookExplorer constructor or mount():
// Need FilterProvider injected via config
this._unsubscribeFilter = this._filter.subscribe(() => {
  if (this._activeTab === 'preview') {
    this._scheduleChartUpdate(); // Debounced ~300ms
  }
});
```

### Pattern 5: D3 Chart Rendering with Transitions
**What:** Each chart type renders SVG programmatically into its placeholder div. On data change, uses D3 transitions for smooth updates.
**When to use:** In the chart mount and update functions.
**Confidence:** HIGH -- D3 patterns are extensively validated across the codebase (transitions.ts, LatchExplorers, TimelineView).

```typescript
// Bar chart example
function renderBarChart(container: HTMLDivElement, data: { label: string; value: number }[], config: ChartConfig): void {
  const width = container.clientWidth;
  const height = width * 0.6; // 5:3 aspect ratio
  const margin = { top: 20, right: 20, bottom: 40, left: 50 };

  let svg = d3.select(container).select<SVGSVGElement>('svg');
  if (svg.empty()) {
    svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`);
  }

  const x = d3.scaleBand()
    .domain(data.map(d => d.label))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.value) ?? 0])
    .nice()
    .range([height - margin.bottom, margin.top]);

  // D3 data join with key function (mandatory per CLAUDE-v5.md)
  const bars = svg.selectAll<SVGRectElement, typeof data[0]>('rect.bar')
    .data(data, d => d.label);

  bars.join(
    enter => enter.append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.label)!)
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('fill', d3.schemeCategory10[0])
      .call(sel => sel.transition().duration(300)
        .attr('y', d => y(d.value))
        .attr('height', d => y(0) - y(d.value))),
    update => update.call(sel => sel.transition().duration(300)
      .attr('x', d => x(d.label)!)
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => y(0) - y(d.value))),
    exit => exit.transition().duration(200).attr('height', 0).attr('y', y(0)).remove(),
  );
}
```

### Anti-Patterns to Avoid
- **Injecting SVG HTML into DOMPurify sanitization:** Never. SVG is D3-generated programmatically AFTER sanitization. DOMPurify must only see placeholder `<div>` elements.
- **Using `marked.use()` with a full tokenizer extension:** Overkill. Fenced code blocks are already tokenized by marked's default tokenizer. Only the renderer needs overriding.
- **Client-side d3.rollup() aggregation:** Locked decision -- aggregation happens via SQL GROUP BY on the Worker side. D3 receives pre-aggregated data.
- **Mutating marked globally without scoping:** `marked.use()` mutates the global marked instance. Call it once at module load, ensure `return false` for non-chart code blocks to preserve default rendering.
- **Sending raw user text as SQL:** All field names must be validated against the axis field allowlist (validateAxisField) before interpolation into SQL. Values are always parameterized.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown fenced code block parsing | Custom regex for ````chart` blocks | marked's built-in `Tokens.Code` with `renderer.code()` override | marked already parses fenced blocks; regex is fragile with edge cases (nested, indented) |
| SVG sanitization | Custom SVG element allowlist in DOMPurify config | Two-pass: DOMPurify for HTML, D3 programmatic mount for SVG | DOMPurify SVG allowlisting is complex and error-prone; programmatic mount eliminates XSS surface |
| SQL aggregation | Client-side d3.rollup/d3.group | Worker-side SQL GROUP BY | SQL engine handles large datasets; D3 receives pre-aggregated rows |
| Chart axis label formatting | Custom date/number formatters | D3 built-in tickFormat, d3.timeFormat, d3.format | D3's locale-aware formatters handle edge cases (large numbers, date ranges, tick density) |
| Tooltip positioning | Manual coordinate math | D3 event coordinates + CSS absolute positioning | Event.offsetX/Y or d3.pointer() + CSS transform handles container scrolling and positioning |

**Key insight:** The entire chart pipeline is a composition of existing subsystems (marked renderer, DOMPurify sanitization, D3 SVG rendering, Worker SQL aggregation, FilterProvider subscription). No fundamentally new capabilities are needed.

## Common Pitfalls

### Pitfall 1: DOMPurify Stripping Data Attributes
**What goes wrong:** DOMPurify strips `data-chart-*` attributes from placeholder divs because `ALLOW_DATA_ATTR: false` in SANITIZE_CONFIG.
**Why it happens:** The current config explicitly disables all data attributes for security.
**How to avoid:** Add specific data attribute names (`data-chart-id`, `data-chart-config`) to the ALLOWED_ATTR array. Do NOT flip ALLOW_DATA_ATTR to true globally -- that would weaken the security posture.
**Warning signs:** Chart placeholders appear in the DOM but have no config data; D3 mount silently skips them.

### Pitfall 2: marked.use() Renderer Return Value
**What goes wrong:** Returning `undefined` or empty string from `renderer.code()` for non-chart languages breaks all code blocks.
**Why it happens:** In marked v17, returning `false` means "use default renderer." Returning `undefined` or `''` means "emit nothing."
**How to avoid:** Always `return false` for non-chart `lang` values. Only return HTML string for `lang === 'chart'`.
**Warning signs:** All code blocks disappear from preview except chart blocks.

### Pitfall 3: AliasProvider Reverse Resolution
**What goes wrong:** User writes display name (e.g., "Type") in chart YAML but the SQL query needs the actual column name (`card_type`).
**Why it happens:** AliasProvider maps `field -> alias` (forward), but chart configs need `alias -> field` (reverse).
**How to avoid:** Build a reverse lookup from AliasProvider's state: iterate all AxisFields, check `getAlias(field)`, build a `Map<displayName, field>`. Fall through to using the raw value if no alias matches (user may use column names directly).
**Warning signs:** "Unknown field" errors when users use display names they set in PropertiesExplorer.

### Pitfall 4: SQL Field Validation for Chart Queries
**What goes wrong:** Chart YAML references a field that passes AliasProvider resolution but fails validateAxisField().
**Why it happens:** The axis field allowlist has a fixed set of 9 fields. Some card columns (e.g., `content`, `tags`, `source_id`) are in the filter allowlist but NOT in the axis allowlist.
**How to avoid:** Chart x/y fields should be validated against the AXIS field allowlist (same as SuperGrid columns). If a field isn't in the allowlist, render an inline error in the chart placeholder. Use `isValidAxisField()` (boolean guard) rather than `validateAxisField()` (throws) for graceful error display.
**Warning signs:** Unhandled exceptions from validateAxisField crash the entire preview render.

### Pitfall 5: Chart Rendering on Write Tab
**What goes wrong:** Charts attempt to query and render while user is typing on the Write tab, wasting Worker queries.
**Why it happens:** Filter subscription fires regardless of active tab.
**How to avoid:** Guard chart rendering and filter re-query behind `this._activeTab === 'preview'` check. Only subscribe to FilterProvider when entering preview; unsubscribe when leaving.
**Warning signs:** Unnecessary Worker traffic visible in debug logs while typing markdown.

### Pitfall 6: Race Conditions on Rapid Filter Changes
**What goes wrong:** Multiple concurrent chart queries from rapid filter changes produce stale results displayed after current results.
**Why it happens:** Async Worker queries resolve in non-deterministic order.
**How to avoid:** Use a generation counter or abort pattern. Increment a counter before each query; on response, compare to current counter. Discard stale responses. The 300ms debounce reduces but doesn't eliminate this.
**Warning signs:** Chart briefly shows wrong data then corrects, or flickers between states.

### Pitfall 7: Empty or NULL Data in SQL Results
**What goes wrong:** Bar/pie charts show "null" as a category label, or line charts fail on NULL x-values.
**Why it happens:** SQL GROUP BY includes NULL values as a distinct group. Date fields may have NULL values.
**How to avoid:** Add `AND xField IS NOT NULL` to the WHERE clause in the chart query handler. For scatter plots, also filter `AND yField IS NOT NULL`. Display a "(no value)" label if nulls are intentionally included.
**Warning signs:** Chart bars labeled "null" or empty strings; line chart paths with gaps.

### Pitfall 8: Vitest Node Environment and DOM APIs
**What goes wrong:** Unit tests for chart rendering fail because vitest runs in Node environment (no DOM).
**Why it happens:** vitest.config.ts uses `environment: 'node'` for WASM compatibility.
**How to avoid:** Test the chart parser (YAML parsing, validation) and chart query builder (SQL generation) in pure unit tests. Test the D3 rendering integration separately with jsdom or as manual/e2e tests. The query handler tests follow the supergrid.handler.test.ts pattern (pure SQL, no DOM).
**Warning signs:** `document is not defined` errors in test runs.

## Code Examples

### Example 1: Chart Config YAML Parsing
```typescript
// Simple line-by-line key:value parser -- no YAML library needed
interface ChartConfig {
  type: 'bar' | 'pie' | 'line' | 'scatter';
  x?: string;
  y?: string;
  value?: string;
  color?: string;
  title?: string;
  legend?: boolean;
  limit?: number;
}

function parseChartConfig(text: string): ChartConfig | { error: string } {
  const config: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    config[key] = value;
  }

  if (!config['type']) {
    return { error: 'Missing required key: type' };
  }

  const chartType = config['type'];
  if (!['bar', 'pie', 'line', 'scatter'].includes(chartType)) {
    return { error: `Unknown chart type: ${chartType}` };
  }

  return {
    type: chartType as ChartConfig['type'],
    x: config['x'],
    y: config['y'],
    value: config['value'],
    color: config['color'],
    title: config['title'],
    legend: config['legend'] === 'true',
    limit: config['limit'] ? parseInt(config['limit'], 10) : undefined,
  };
}
```

### Example 2: Chart Query Handler (Worker-side)
```typescript
// Following supergrid.handler.ts pattern
import { validateAxisField, isValidAxisField } from '../../providers/allowlist';

export function handleChartQuery(
  db: Database,
  payload: WorkerPayloads['chart:query'],
): WorkerResponses['chart:query'] {
  // Validate field against axis allowlist
  validateAxisField(payload.xField);
  if (payload.yField) validateAxisField(payload.yField);

  const { where, params } = { where: payload.where, params: [...payload.params] };
  const baseWhere = where || 'deleted_at IS NULL';
  const limitClause = payload.limit ? `LIMIT ?` : '';
  if (payload.limit) params.push(payload.limit);

  let sql: string;
  if (payload.chartType === 'scatter') {
    sql = `SELECT ${payload.xField} AS x, ${payload.yField} AS y FROM cards WHERE ${baseWhere} AND ${payload.xField} IS NOT NULL AND ${payload.yField} IS NOT NULL`;
  } else if (!payload.yField) {
    // y = count (magic keyword)
    sql = `SELECT ${payload.xField} AS label, COUNT(*) AS value FROM cards WHERE ${baseWhere} AND ${payload.xField} IS NOT NULL GROUP BY ${payload.xField} ORDER BY value DESC ${limitClause}`;
  } else {
    sql = `SELECT ${payload.xField} AS label, SUM(${payload.yField}) AS value FROM cards WHERE ${baseWhere} AND ${payload.xField} IS NOT NULL GROUP BY ${payload.xField} ORDER BY ${payload.xField} ASC ${limitClause}`;
  }

  const stmt = db.prepare(sql);
  const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
  stmt.free();
  return { rows: rows as any[] };
}
```

### Example 3: Inline Error Rendering
```typescript
function renderChartError(container: HTMLDivElement, message: string): void {
  container.innerHTML = '';
  const errorEl = document.createElement('div');
  errorEl.className = 'notebook-chart-error';
  errorEl.textContent = message;
  container.appendChild(errorEl);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| marked v12 `renderer` object | marked v17 `marked.use({ renderer: { code() } })` | marked v4+ | Cleaner extension API; `return false` for default fallback |
| DOMPurify ALLOW_DATA_ATTR: true | Specific data-* attributes in ALLOWED_ATTR | Security best practice | Minimizes attribute surface area |
| Client-side d3.rollup() for aggregation | Worker-side SQL GROUP BY | Project decision (CONTEXT.md locked) | Better performance for large datasets; consistent with supergrid:calc pattern |

**Deprecated/outdated:**
- marked v12 `new marked.Renderer()` + `markedInstance.setOptions({ renderer })` pattern: Replaced by `marked.use()` in v4+. The project currently calls `marked.parse()` directly without any `use()` calls, so the first `marked.use()` call will be for chart blocks.

## Discretion Recommendations

### Aspect Ratio
**Recommendation:** 5:3 (width:height). This provides a good balance between visibility and vertical space in the narrow workbench panel. Applied as `height = containerWidth * 0.6`.

### Tooltip Styling and Positioning
**Recommendation:** CSS-positioned tooltip `<div>` with absolute positioning relative to the chart container. Show on mouseover via D3 event handlers. Style: dark background (`var(--bg-surface)`), white text, small font (`var(--text-xs)`), rounded corners (`var(--radius-sm)`), padding. Position using `d3.pointer(event, container)` to get coordinates relative to the chart div.

### D3 Color Scale
**Recommendation:** `d3.schemeTableau10` -- it provides better perceptual distinction than `d3.schemeCategory10` and is designed for data visualization. If the user specifies a `color` key in config, use it as a single fill color for bar/line; for pie/scatter multi-value, use the scheme.

### Debounce Timing
**Recommendation:** 300ms debounce on filter change re-query (matches the existing transition duration and the user-specified ~300ms). Use a shared debounce timer across all chart blocks in the current preview to batch filter-change re-queries.

### YAML Parsing
**Recommendation:** Simple line-by-line `key: value` parser (no library). Chart configs are flat key-value pairs -- no arrays, no nesting, no multi-line strings. A 20-line parser is more maintainable than a YAML dependency. Handle `#` comment lines for user convenience.

### Axis Label Formatting
**Recommendation:** Use D3's built-in tick formatting. For numeric axes, `d3.format('~s')` (SI-prefix: 1K, 2M). For date axes, `d3.timeFormat('%b %Y')` (month-year). Limit to 5-7 ticks via `.ticks(5)` to prevent label overlap in the narrow panel.

## Open Questions

1. **AliasProvider injection path**
   - What we know: NotebookExplorer currently receives `bridge` and `selection` via `NotebookExplorerConfig`. Chart blocks need AliasProvider for field name resolution.
   - What's unclear: Whether to inject AliasProvider directly into NotebookExplorerConfig or access it through a different path.
   - Recommendation: Add `alias: AliasProvider` and `filter: FilterProvider` to `NotebookExplorerConfig`. Follows the pattern of CalcExplorer receiving providers via config injection.

2. **marked.use() global scope**
   - What we know: `marked.use()` modifies the global marked instance. The project currently has no `marked.use()` calls.
   - What's unclear: Whether multiple NotebookExplorer instances (unlikely but possible) could cause double-registration.
   - Recommendation: Call `marked.use()` once at module level (outside the class) with an idempotency guard. Since marked.use() is additive, double-registration would cause duplicate rendering. Use a module-level boolean flag.

3. **Scatter plot data shape differs from bar/pie/line**
   - What we know: Bar/pie/line return `{ label, value }[]`. Scatter returns `{ x, y }[]`.
   - What's unclear: Whether to unify the response shape or use a discriminated union.
   - Recommendation: Use a discriminated union in the response type: `{ type: 'labeled'; rows: { label: string; value: number }[] } | { type: 'xy'; rows: { x: number; y: number }[] }`. This keeps the Worker handler clean and avoids type confusion on the client.

## Sources

### Primary (HIGH confidence)
- `/Users/mshaler/Developer/Projects/Isometry/node_modules/marked/lib/marked.d.ts` -- marked v17.0.4 type definitions confirming `Tokens.Code { type, raw, lang?, text, escaped? }`, `renderer.code()` signature, and `marked.use()` extension API
- `/Users/mshaler/Developer/Projects/Isometry/src/ui/NotebookExplorer.ts` -- existing `_renderPreview()` pipeline, SANITIZE_CONFIG, DOMPurify integration
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/handlers/supergrid.handler.ts` -- reference implementation for SQL GROUP BY aggregation on Worker side
- `/Users/mshaler/Developer/Projects/Isometry/src/worker/protocol.ts` -- canonical Worker message protocol (WorkerPayloads, WorkerResponses, WorkerRequestType)
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/FilterProvider.ts` -- compile() method, subscribe() pattern
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/AliasProvider.ts` -- getAlias() for display name resolution
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/allowlist.ts` -- validateAxisField(), isValidAxisField() for SQL safety

### Secondary (MEDIUM confidence)
- marked documentation (training data, verified against installed v17.0.4 types): `return false` from renderer extension falls through to default renderer
- D3.js v7.9 API (training data, confirmed by usage patterns across codebase): d3.pie(), d3.arc(), d3.scaleBand(), d3.scaleLinear(), d3.line(), d3.axisBottom(), d3.schemeTableau10

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used extensively in the project; marked extension API verified from type definitions
- Architecture: HIGH -- all patterns (two-pass sanitization, Worker message routing, FilterProvider subscription, D3 chart rendering) have established precedents in the codebase
- Pitfalls: HIGH -- identified from direct codebase analysis (SANITIZE_CONFIG restrictions, vitest node environment, allowlist validation behavior)

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable -- no fast-moving dependencies)
