# Phase 62: SuperCalc Footer Rows - Research

**Researched:** 2026-03-09
**Domain:** SQL aggregation + CSS Grid footer rendering + Workbench panel UI
**Confidence:** HIGH

## Summary

Phase 62 adds live aggregate footer rows (SUM/AVG/COUNT/MIN/MAX) to each row group in SuperGrid. The implementation spans four domains: (1) a new `supergrid:calc` Worker message type executing SQL GROUP BY aggregation queries, (2) footer row rendering appended after data rows in the CSS Grid, (3) a new "Calc" CollapsibleSection in the WorkbenchShell panel rail for per-column aggregate function configuration, and (4) persistence of calc config via the existing `ui:set`/`ui:get` pattern.

All building blocks exist in the codebase. The `buildSuperGridQuery()` function already supports `AggregationMode` (count/sum/avg/min/max). The `WorkerBridge.send()` + `protocol.ts` pattern for adding new message types is well-established. The `CollapsibleSection` primitive handles mount/destroy lifecycle with localStorage persistence. The 9 `AxisField` values are fixed and known, making column type classification (numeric vs text) a static mapping.

**Primary recommendation:** Build the `supergrid:calc` handler as a separate query that reuses `buildSuperGridQuery()` with per-column GROUP BY + aggregate functions, fire it in parallel with the existing `supergrid:query` in `_fetchAndRender()`, and render footer rows as non-virtualized DOM elements with a dedicated `sg-footer` CSS class.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Footer rows render inline at group bottom, scrolling with data
- Footer rows bypass the virtualizer (always rendered in DOM)
- Always show footer even with a single group (grand total row)
- When a SuperStack group is collapsed, footer row remains visible (header + footer, data hidden)
- New 5th CollapsibleSection in WorkbenchShell panel rail (after LATCH) with icon and "Calc" title
- Per-column `<select>` dropdown for SUM/AVG/COUNT/MIN/MAX/OFF
- Only columns currently assigned to row/col axes appear in the Calc panel
- Each column includes OFF option (shows blank/dash)
- Calc config persisted via `ui:set` with key `calc:config`
- Subtle background tint + bold text using `--sg-header-bg` at 50% opacity
- Footer cells show label prefix: "SUM: 42", "AVG: 3.7", "COUNT: 5"
- Row index gutter shows sigma symbol instead of number
- Numeric values formatted with `Intl.NumberFormat` (locale-aware)
- Numeric columns default to SUM, text columns default to COUNT
- Column type detected via hardcoded field mapping (9 AxisField values known at build time)
- Text columns locked to COUNT + OFF only

### Claude's Discretion
- Exact CSS class names and token values for footer row styling
- `supergrid:calc` Worker message payload/response shape
- Calc section mount/update/destroy lifecycle implementation details
- Edge cases: empty groups, NULL values in aggregation
- Loading/transition behavior during recalculation
- Dark mode token derivation for footer tint

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CALC-01 | SuperGrid displays aggregate footer row at bottom of each row group with SUM/AVG/COUNT/MIN/MAX results | Worker handler builds per-group SQL; footer cells rendered after data rows in CSS Grid |
| CALC-02 | Aggregate function per column is configurable via Workbench panel section | New CalcExplorer with `<select>` dropdowns follows CollapsibleSection pattern |
| CALC-03 | Aggregate functions auto-detect column type (COUNT for text, SUM for numbers) as defaults | Static `NUMERIC_FIELDS` / `TEXT_FIELDS` sets derived from AxisField type |
| CALC-04 | Aggregation computed via separate `supergrid:calc` Worker query using SQL GROUP BY | New protocol entry + handler reusing `buildSuperGridQuery()` with per-column aggregates |
| CALC-05 | Footer rows visually distinct (different background, bold text) and work with virtual scrolling | `sg-footer` CSS class + excluded from SuperGridVirtualizer windowing range |
| CALC-06 | Footer rows update live when filters, density, or axis assignments change | Parallel `supergrid:calc` query fires alongside `supergrid:query` in `_fetchAndRender()` |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 (strict) | Implementation language | Project standard |
| sql.js | 1.14 | SQL GROUP BY aggregation in Worker | System of record (D-003) |
| D3.js | v7.9 | DOM join for footer cells | Project standard for all view rendering |
| Vitest | 4.0 | Unit/integration tests | Project test framework |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.NumberFormat | Browser built-in | Locale-aware number formatting | Footer cell value display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQL GROUP BY in Worker | Client-side JS aggregation | SQL is faster for large datasets, matches existing pattern, validates via allowlist |
| Intl.NumberFormat | toFixed()/toLocaleString() | Intl.NumberFormat handles locale, grouping separators, decimal places correctly |
| Separate D3 join for footer | Append to existing join | Separate join avoids key collision with data cells, simplifies virtualizer exclusion |

**Installation:**
No new dependencies needed. All required APIs are built-in browser features or existing project libraries.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── worker/
│   ├── protocol.ts            # Add 'supergrid:calc' type + payload/response
│   ├── worker.ts              # Add routing case for 'supergrid:calc'
│   └── handlers/
│       └── supergrid.handler.ts  # Add handleSuperGridCalc() function
├── views/
│   ├── SuperGrid.ts           # Footer rendering in _renderCells(), parallel query in _fetchAndRender()
│   └── supergrid/
│       └── SuperGridQuery.ts  # buildSuperGridCalcQuery() or extend buildSuperGridQuery()
├── ui/
│   ├── CalcExplorer.ts        # New — per-column aggregate config panel
│   └── WorkbenchShell.ts      # Add 5th SECTION_CONFIGS entry
├── styles/
│   └── supergrid.css          # Add .sg-footer class rules
└── main.ts                    # Wire CalcExplorer into shell + SuperGrid
```

### Pattern 1: Parallel Worker Query (supergrid:calc alongside supergrid:query)
**What:** Fire the aggregation query in parallel with the cell data query in `_fetchAndRender()`.
**When to use:** Every `_fetchAndRender()` invocation.
**Why:** Aggregation results are independent of cell data — parallel execution avoids sequential latency.

```typescript
// In SuperGrid._fetchAndRender():
const [cells, calcResult] = await Promise.all([
  this._bridge.superGridQuery(queryConfig),
  this._bridge.send('supergrid:calc', calcPayload),
]);
// Then pass calcResult to _renderCells() for footer rendering
```

**Key constraint:** The calc query must use the SAME WHERE clause, params, granularity, and searchTerm as the cell query — otherwise footer values won't match displayed data.

### Pattern 2: Per-Group SQL Aggregation
**What:** SQL query that groups by row axes and computes per-column aggregates.
**When to use:** For the `supergrid:calc` handler.

```sql
-- Example: SUM on sort_order, COUNT on folder, AVG on priority
-- Row axes: [folder], Col axes: [card_type]
SELECT folder,
       SUM(sort_order) AS sort_order_agg,
       COUNT(*) AS folder_agg,
       AVG(priority) AS priority_agg
FROM cards
WHERE deleted_at IS NULL
  AND <filter_where>
GROUP BY folder
ORDER BY folder ASC
```

**Key insight:** The GROUP BY clause uses only the ROW axes (not col axes) because footer rows appear at the bottom of each row group. Each row group gets one footer row. When there's a single group (no row axis), the query produces a grand total.

### Pattern 3: AxisField Numeric/Text Classification
**What:** Static mapping of the 9 AxisField values into numeric vs text categories.
**When to use:** Default aggregate function selection and dropdown option filtering.

```typescript
const NUMERIC_FIELDS: ReadonlySet<AxisField> = new Set(['priority', 'sort_order']);
const TEXT_FIELDS: ReadonlySet<AxisField> = new Set([
  'created_at', 'modified_at', 'due_at', // timestamps are text in SQLite
  'folder', 'status', 'card_type', 'name',
]);
```

**Decision point:** `created_at`, `modified_at`, `due_at` are stored as ISO text strings in SQLite. MIN/MAX are meaningful on date strings (alphabetical sort = chronological sort for ISO 8601). SUM/AVG are NOT meaningful on date strings. So date fields should be classified as text (COUNT + OFF only) OR have a special "date" category allowing COUNT/MIN/MAX/OFF.

**Recommendation (Claude's discretion):** Classify date fields with text (COUNT + OFF only). MIN/MAX on dates is a niche use case that can be added in SuperCalc Extended (CALC-F02). Keeping it simple prevents confusion — users seeing "MIN: 2025-01-15" in a footer cell is not intuitive for most users.

### Pattern 4: CollapsibleSection for Calc Panel
**What:** Add 5th entry to `SECTION_CONFIGS` array in WorkbenchShell.
**When to use:** At shell initialization.

```typescript
// In WorkbenchShell.ts SECTION_CONFIGS:
{ title: 'Calc', icon: '\u03A3', storageKey: 'calc', defaultCollapsed: true },
// \u03A3 = Greek capital letter Sigma (Σ)
```

The CalcExplorer mounts into this section's body element, following the same pattern as LatchExplorers, NotebookExplorer, PropertiesExplorer, and ProjectionExplorer.

### Pattern 5: Config Persistence via ui:set
**What:** Persist calc config to `ui_state` table via existing Worker message.
**When to use:** On every config change (dropdown selection), with debounce.

```typescript
// Config shape persisted as JSON string:
interface CalcConfig {
  columns: Record<AxisField, AggregationMode | 'off'>;
}

// Persist:
bridge.send('ui:set', { key: 'calc:config', value: JSON.stringify(config) });

// Restore:
const result = await bridge.send('ui:get', { key: 'calc:config' });
if (result.value) calcConfig = JSON.parse(result.value);
```

### Pattern 6: Footer Row Grid Placement
**What:** Footer cells placed after data rows in the CSS Grid, outside virtualizer range.
**When to use:** In `_renderCells()` after the data cell D3 join.

```
CSS Grid row layout:
  Row 1..N:      Column headers (sticky top)
  Row N+1..M:    Data rows (windowed by virtualizer)
  Row M+1:       Footer row (always rendered, not windowed)
```

The footer row needs an extra row in `gridTemplateRows`. Each footer cell gets `gridRow: lastDataRow + 1` and the same `gridColumn` as corresponding data cells.

### Anti-Patterns to Avoid
- **Client-side aggregation:** Do NOT sum/average in JavaScript from CellDatum arrays. The data is already grouped by the `supergrid:query` — you'd be summing counts-of-counts, not raw values. The SQL query must operate on raw card rows.
- **Shared D3 join key space:** Footer cells MUST use a distinct key prefix (e.g., `footer:`) to prevent collision with data cells in the D3 join. The existing `summary:` prefix for collapsed aggregates shows this pattern.
- **Footer inside virtualizer:** Footer rows must NOT participate in the `SuperGridVirtualizer.setTotalRows()` count. They are always rendered regardless of scroll position.
- **Re-querying on config change only:** Footer values must update on filter/density/axis changes too (CALC-06). The calc query must fire in the SAME `_fetchAndRender()` cycle as the cell query.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Number formatting | Manual comma insertion / decimal truncation | `Intl.NumberFormat` | Handles locale, grouping, decimal places, edge cases (NaN, Infinity) |
| SQL aggregation | Client-side reduce over CellDatum[] | SQL GROUP BY in Worker | Operates on raw rows (not pre-grouped counts); validated via allowlist |
| Panel collapse/expand | Custom accordion component | `CollapsibleSection` primitive | ARIA disclosure, localStorage persistence, keyboard a11y already built |
| Config persistence | localStorage directly | `ui:set`/`ui:get` via Worker | Survives across sessions, syncs via CloudKit checkpoint flow |

**Key insight:** The existing `buildSuperGridQuery()` function already handles axis validation, WHERE clause composition, granularity wrapping, search term injection, and GROUP BY generation. The calc query should reuse as much of this infrastructure as possible rather than building a parallel SQL builder.

## Common Pitfalls

### Pitfall 1: Aggregating Pre-Grouped Data
**What goes wrong:** Attempting to compute SUM/AVG from `CellDatum.count` values (which are already GROUP BY counts) instead of raw card column values.
**Why it happens:** `supergrid:query` returns pre-grouped cells with `COUNT(*)`. Summing those counts gives "sum of group sizes" not "sum of column values."
**How to avoid:** The `supergrid:calc` query must SELECT raw column values from the `cards` table with its own GROUP BY (by row group), not operate on the result of `supergrid:query`.
**Warning signs:** SUM values that seem implausibly large (they're sums of counts, not sums of actual data).

### Pitfall 2: Footer Row Grid Placement Off-by-One
**What goes wrong:** Footer row placed at wrong `gridRow` index, overlapping data rows or leaving a gap.
**Why it happens:** The CSS Grid row index must account for: column header levels + leaf data rows + virtualizer offset.
**How to avoid:** Compute `footerGridRow = colHeaderLevels + visibleLeafRowCells.length + 1`. Also add one extra entry to `gridTemplateRows`.
**Warning signs:** Footer visually overlaps last data row or appears detached.

### Pitfall 3: Calc Query/Cell Query Parameter Mismatch
**What goes wrong:** Footer aggregates don't match displayed data because the calc query uses stale or different filter/search parameters.
**Why it happens:** The calc query is built from the same provider state as the cell query, but if built at a different time (e.g., in a separate callback), state may have changed.
**How to avoid:** Build BOTH query configs in the SAME `_fetchAndRender()` invocation, reading provider state ONCE and passing identical WHERE/params/granularity/searchTerm to both.
**Warning signs:** Footer shows "SUM: 42" but manual addition of visible cells gives a different number.

### Pitfall 4: NULL Handling in SQL Aggregates
**What goes wrong:** SUM/AVG return unexpected results when columns contain NULL values.
**Why it happens:** SQL SUM ignores NULLs (correct), but AVG only counts non-NULL rows in the denominator. COUNT(*) counts all rows while COUNT(column) skips NULLs.
**How to avoid:** Use `COUNT(*)` for COUNT mode (count all rows in group), `SUM(COALESCE(field, 0))` if zero-is-null semantics desired, or document that NULLs are excluded from SUM/AVG/MIN/MAX.
**Warning signs:** AVG seems wrong because denominator excludes NULLs silently.

### Pitfall 5: Text Column Aggregate Functions
**What goes wrong:** User selects SUM or AVG on a text column, getting nonsensical results or SQL errors.
**Why it happens:** SQLite is loosely typed — `SUM('hello')` returns 0.0 without error, but `AVG('hello')` returns 0.0 too. No SQL error, just meaningless results.
**How to avoid:** Lock text column dropdowns to COUNT + OFF only (per CONTEXT.md decision). Enforce in CalcExplorer UI AND in the query builder as a safety net.
**Warning signs:** Footer shows "SUM: 0" for a text column with data.

### Pitfall 6: SuperStack Collapsed Group Footer Visibility
**What goes wrong:** Footer row disappears or duplicates when a SuperStack group is collapsed.
**Why it happens:** Collapsed groups in "hide" mode remove data rows from DOM; the footer row must survive this removal.
**How to avoid:** Footer rows are rendered OUTSIDE the data cell D3 join, keyed by group identity, not by data row position. When group is collapsed (header + footer visible, data hidden), footer remains because it's independently rendered.
**Warning signs:** Collapsing a group hides its footer, or expanding shows duplicate footers.

### Pitfall 7: WorkbenchShell Section Index Assumptions
**What goes wrong:** Adding 5th section breaks existing code that indexes `SECTION_CONFIGS` by position.
**Why it happens:** `getSectionBody()` uses `findIndex()` by storageKey (safe), but `getSectionStates()`/`restoreSectionStates()` iterate by index (fragile if order changes).
**How to avoid:** Append the new Calc section at the END of `SECTION_CONFIGS` (position 4, index 4). Existing sections at indices 0-3 remain unchanged.
**Warning signs:** Existing section collapse states break after adding Calc section.

## Code Examples

### Worker Protocol Extension
```typescript
// In protocol.ts — WorkerRequestType:
| 'supergrid:calc'

// In WorkerPayloads:
'supergrid:calc': {
  rowAxes: AxisMapping[];
  colAxes: AxisMapping[];  // Needed to know which columns to aggregate
  where: string;
  params: unknown[];
  granularity?: TimeGranularity | null;
  searchTerm?: string;
  // Per-column aggregate config:
  aggregates: Record<string, AggregationMode | 'off'>;
};

// In WorkerResponses:
'supergrid:calc': {
  // One entry per row group. Key = row group compound key.
  // Values = per-column aggregate results.
  rows: Array<{
    groupKey: Record<string, unknown>;  // Row axis values identifying the group
    values: Record<string, number | null>;  // column_field -> aggregate value
  }>;
};
```

### SQL Aggregation Query
```sql
-- For row axes [folder], aggregates: { sort_order: 'sum', priority: 'avg', name: 'count' }
SELECT folder,
       SUM(sort_order) AS "sort_order",
       AVG(priority) AS "priority",
       COUNT(name) AS "name"
FROM cards
WHERE deleted_at IS NULL
GROUP BY folder
ORDER BY folder ASC
```

### Footer Cell Rendering (in _renderCells)
```typescript
// After data cell D3 join, append footer rows:
const footerGridRow = colHeaderLevels + visibleLeafRowCells.length + 1;

for (const colCell of visibleLeafColCells) {
  const footerEl = document.createElement('div');
  footerEl.className = 'data-cell sg-cell sg-footer';
  footerEl.style.gridRow = `${footerGridRow}`;
  footerEl.style.gridColumn = `${colStart + rowHeaderDepth + gutterOffset}`;

  const aggValue = calcResult.get(colCell.field);
  if (aggValue !== null && aggValue !== undefined) {
    const label = document.createElement('span');
    label.className = 'sg-footer-label';
    label.textContent = `${aggMode.toUpperCase()}: `;

    const value = document.createElement('span');
    value.className = 'sg-footer-value';
    value.textContent = formatAggValue(aggValue, aggMode);

    footerEl.appendChild(label);
    footerEl.appendChild(value);
  }
  grid.appendChild(footerEl);
}
```

### Intl.NumberFormat for Footer Values
```typescript
function formatAggValue(value: number, mode: AggregationMode): string {
  if (mode === 'count' || mode === 'sum') {
    // Integer display — no decimal places
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 0,
    }).format(value);
  }
  // AVG/MIN/MAX — up to 2 decimal places
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}
```

### CalcExplorer Dropdown
```typescript
// Per-column select element:
const select = document.createElement('select');
select.className = 'calc-select';
select.setAttribute('aria-label', `Aggregate function for ${fieldDisplayName}`);

const options = isNumericField(field)
  ? ['SUM', 'AVG', 'COUNT', 'MIN', 'MAX', 'OFF']
  : ['COUNT', 'OFF'];

for (const opt of options) {
  const option = document.createElement('option');
  option.value = opt.toLowerCase();
  option.textContent = opt;
  select.appendChild(option);
}
```

### CSS Footer Styling
```css
/* Footer row — aggregate summary at group bottom */
.sg-footer {
  background-color: color-mix(in srgb, var(--sg-header-bg) 50%, transparent);
  font-weight: bold;
  border-top: 2px solid var(--border-muted);
  border-bottom: 1px solid var(--sg-gridline);
  border-right: 1px solid var(--sg-gridline);
}

.sg-footer-label {
  font-size: calc(var(--sg-cell-font-size) * var(--sg-zoom, 1) * 0.75);
  color: var(--text-muted);
  text-transform: uppercase;
  margin-right: 2px;
}

.sg-footer-value {
  font-size: calc(var(--sg-cell-font-size) * var(--sg-zoom, 1));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HyperFormula for calculations | SQL DSL via GROUP BY | v5.2 decision | Eliminates ~500KB dependency, leverages existing sql.js |
| Client-side aggregation | Worker-side SQL aggregation | v5.2 decision | Correct results from raw data, not pre-grouped counts |

**Deprecated/outdated:**
- HyperFormula: Permanently replaced by SQL DSL approach. ~500KB bundle + unsolved PAFV formula syntax.

## Open Questions

1. **Multi-group footer rows with stacked row axes**
   - What we know: With multiple stacked row axes (e.g., folder + status), there are nested groups. Each group at each level could have its own footer.
   - What's unclear: Should footer rows appear only at the leaf group level, or at every nesting level?
   - Recommendation: Start with leaf-level-only footers (one footer per innermost row group). This matches the CONTEXT.md language "bottom of each row group" and avoids combinatorial complexity. Intermediate-level subtotals can be a future enhancement (CALC-F01 is already deferred).

2. **rAF coalescing for supergrid:calc**
   - What we know: `supergrid:query` uses rAF coalescing (latest-wins) to prevent duplicate Worker requests when multiple provider changes fire in the same frame.
   - What's unclear: Should `supergrid:calc` share the same rAF frame or have its own coalescing?
   - Recommendation: Fire calc query INSIDE the existing rAF-coalesced `_fetchAndRender()` method, alongside the cell query via `Promise.all`. This naturally inherits the rAF coalescing without needing a separate mechanism.

3. **Footer row interaction with SuperStack collapse**
   - What we know: CONTEXT.md states "collapsed groups show header + footer, data rows hidden."
   - What's unclear: In "hide" mode collapse (zero footprint), should the footer also be hidden? In "aggregate" mode, should the footer show aggregates of the collapsed group?
   - Recommendation: In "hide" mode, footer is hidden too (consistent with zero footprint). In "aggregate" mode, footer remains visible with aggregates for the group. This aligns with pivot table behavior.

4. **color-mix() browser support**
   - What we know: `color-mix(in srgb, ...)` is needed for the 50% opacity tint on `--sg-header-bg`.
   - What's unclear: Safari 17.0 support status (project targets iOS 17+ / macOS 14+).
   - Recommendation: `color-mix()` is supported in Safari 16.4+ (March 2023), well within the iOS 17+ / macOS 14+ target. Safe to use. HIGH confidence — verified from MDN compatibility data.

## Sources

### Primary (HIGH confidence)
- Project codebase: `src/worker/protocol.ts` — typed Worker message protocol (exhaustive switch pattern)
- Project codebase: `src/views/supergrid/SuperGridQuery.ts` — existing `AggregationMode` + `buildSuperGridQuery()` with axis validation
- Project codebase: `src/worker/handlers/supergrid.handler.ts` — handler pattern with `_columnarToRows()` and prepare/all SQL execution
- Project codebase: `src/ui/WorkbenchShell.ts` — `SECTION_CONFIGS` array and `CollapsibleSection` mounting pattern
- Project codebase: `src/ui/CollapsibleSection.ts` — mount/destroy lifecycle, localStorage persistence, ARIA disclosure
- Project codebase: `src/views/SuperGrid.ts` — `_fetchAndRender()` / `_renderCells()` pipeline, virtualizer integration, gutter/header rendering
- Project codebase: `src/worker/WorkerBridge.ts` — `superGridQuery()` rAF coalescing, `send()` typed API
- Project codebase: `src/providers/types.ts` — `AxisField` type (9 values), `AggregationMode` type
- Project codebase: `src/providers/allowlist.ts` — `ALLOWED_AXIS_FIELDS` set, `validateAxisField()` assertion

### Secondary (MEDIUM confidence)
- MDN Web Docs: `Intl.NumberFormat` — locale-aware number formatting API (stable, all modern browsers)
- MDN Web Docs: `color-mix()` CSS function — supported Safari 16.4+, Chrome 111+, Firefox 113+

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in project, no new dependencies
- Architecture: HIGH — all patterns derived from existing codebase (protocol extension, handler, CSS Grid, CollapsibleSection)
- Pitfalls: HIGH — derived from direct code inspection of SuperGrid rendering pipeline and SQL query patterns

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable — no external dependencies or fast-moving libraries)
