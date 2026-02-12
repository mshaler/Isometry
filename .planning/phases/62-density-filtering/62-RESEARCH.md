# Phase 62: Density Filtering - Research

**Researched:** 2026-02-12
**Domain:** D3.js sparse/dense grid rendering, SQL WHERE clause filtering, Janus density model
**Confidence:** HIGH

## Summary

Phase 62 implements extent density filtering — the pan control in the Janus Pan × Zoom model. Users toggle between sparse mode (full Cartesian grid with empty cells visible) and dense mode (populated-only cells, empty intersections hidden). The infrastructure is largely complete: `JanusDensityControls` provides UI, `SuperDensityService` manages state and SQL generation, and types are well-defined. The missing piece is wiring the density state to `GridRenderingEngine.render()` to actually filter the displayed cells.

The Janus model separates two orthogonal concerns:
- **Zoom (value density)**: Leaf values (Jan, Feb, Mar) vs collapsed aggregates (Q1)
- **Pan (extent density)**: Sparse (show empty cells) vs dense (populated-only)

All four quadrants (sparse+leaf, sparse+collapsed, dense+leaf, dense+collapsed) are valid and useful. Phase 62 focuses solely on extent density (Level 2 of the 4-level hierarchy).

**Primary recommendation:** Wire `extentDensity` state from `PAFVContext` → `GridRenderingEngine` → cell filtering logic in `renderCards()`. Use D3's `.filter()` on the data-bound selection to conditionally render cells based on whether they're empty. Coordinate with `SuperDensityService.buildWhereClause()` for SQL-level filtering (more performant for large datasets).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Data binding and conditional rendering | Already in use; `.filter()` is canonical pattern for conditional display |
| sql.js | — | WHERE clause filtering | Already in use; `extentDensity === 'populated-only'` adds WHERE conditions |
| React Context | v18 | Density state propagation | PAFVContext already holds `densityLevel`, extends naturally |

**Note:** No new dependencies required. Phase 62 extends existing infrastructure.

### Existing Components
| Component | Location | Purpose | Integration Point |
|-----------|----------|---------|-------------------|
| JanusDensityControls | `src/components/JanusDensityControls.tsx` | User controls for 4-level density | Already wired to PAFVContext, triggers state changes |
| SuperDensityService | `src/services/supergrid/SuperDensityService.ts` | State management + SQL generation | `buildWhereClause()` already checks `extentDensity` at line 291 |
| GridRenderingEngine | `src/d3/grid-rendering/GridRenderingEngine.ts` | Card rendering | Needs density state passed in, filter logic in `renderCards()` |
| PAFVContext | `src/state/PAFVContext.tsx` | PAFV state including densityLevel | Holds density state, propagates to consumers |
| density-control.ts | `src/types/density-control.ts` | Type definitions | Complete and well-designed |

**Installation:**
```bash
# No new packages needed - all infrastructure exists
```

## Architecture Patterns

### Recommended Data Flow

```
User clicks "Dense (Populated Only)" button in JanusDensityControls
    ↓
JanusDensityControls.handleDensityChange('extent', 'populated-only')
    ↓
PAFVContext.setDensityLevel() updates state
    ↓
SuperGrid re-renders, passes densityState to GridRenderingEngine
    ↓
GridRenderingEngine.render() filters cards based on extentDensity
    ↓
Option A: D3 .filter() — Client-side filtering on bound data
Option B: SQL WHERE — Server-side filtering via SuperDensityService
    ↓
Only populated cells render, empty cells removed from DOM
```

### Pattern 1: Client-Side Filtering with D3 .filter()

**What:** Filter data-bound selection before join to conditionally render elements
**When to use:** Small-to-medium datasets (<10K cells), fast prototyping

**Example:**
```typescript
// Source: D3 selection.filter() documentation
// https://d3js.org/d3-selection/modifying#selection_filter

const { extentDensity } = this.densityState;

// Filter cards to only populated cells if dense mode
const filteredCards = extentDensity === 'populated-only'
  ? cards.filter(card => this.isPopulated(card))
  : cards;

cardContainer
  .selectAll(".card")
  .data(filteredCards, d => d.id)
  .join(
    enter => enter.append("g")
      .attr("class", "card")
      .attr("transform", d => `translate(${d.x}, ${d.y})`),
    update => update
      .transition()
      .duration(300)
      .attr("transform", d => `translate(${d.x}, ${d.y})`),
    exit => exit
      .transition()
      .duration(300)
      .attr("opacity", 0)
      .remove()
  );

/**
 * Check if a cell is populated (has data)
 */
private isPopulated(card: unknown): boolean {
  const c = card as Record<string, unknown>;
  // Cell is populated if it has a name or any LATCH property
  return !!(c.name || c.folder || c.status || c.priority);
}
```

**Why it works:** D3's data join automatically handles enter/exit when filtered data changes. Cards smoothly animate in/out as user toggles density.

### Pattern 2: SQL-Level Filtering via SuperDensityService

**What:** Add WHERE clause conditions based on extent density before query execution
**When to use:** Large datasets (>10K cards), when aggregation is also needed

**Example:**
```typescript
// Source: SuperDensityService.buildWhereClause() at line 277
// Already implemented in src/services/supergrid/SuperDensityService.ts

private buildWhereClause(baseFilters?: LATCHFilter[]): {
  whereParts: string[];
  parameters: unknown[]
} {
  const whereParts: string[] = ['deleted_at IS NULL'];
  const parameters: unknown[] = [];

  // Add base filters
  if (baseFilters?.length) {
    const filterResult = this.filterService.compileToSQL();
    if (!filterResult.isEmpty) {
      whereParts.push(filterResult.whereClause);
      parameters.push(...filterResult.parameters);
    }
  }

  // Apply extent density filtering
  if (this.currentState.extentDensity === 'populated-only') {
    // Exclude empty cells - cards must have a name or primary facet value
    whereParts.push('(name IS NOT NULL AND name != "")');
  }

  return { whereParts, parameters };
}
```

**Critical insight:** This already exists in SuperDensityService but isn't being used by GridRenderingEngine. The service generates the correct SQL, but GridRenderingEngine queries directly without density filtering.

### Pattern 3: Coordinated Header Filtering

**What:** When hiding empty rows/columns, also hide their headers
**When to use:** Dense mode — headers for empty dimensions should disappear

**Example:**
```typescript
// Compute which headers actually have data
const populatedColumns = new Set<string>();
const populatedRows = new Set<string>();

filteredCards.forEach(card => {
  const c = card as Record<string, unknown>;
  if (c._projectedCol != null) populatedColumns.add(String(c._projectedCol));
  if (c._projectedRow != null) populatedRows.add(String(c._projectedRow));
});

// Filter headers to only populated dimensions
const visibleColumnHeaders = columnHeaders.filter(h =>
  populatedColumns.has(h.value)
);
const visibleRowHeaders = rowHeaders.filter(h =>
  populatedRows.has(h.value)
);

// Render filtered headers
this.renderColumnHeaders(visibleColumnHeaders);
this.renderRowHeaders(visibleRowHeaders);
```

**Why it matters:** Sparse mode shows all possible intersections (full Cartesian product). Dense mode shows only actual intersections (populated cells). Headers must match to avoid visual confusion.

### Anti-Patterns to Avoid

- **Mixing SQL and D3 filtering inconsistently:** Choose one strategy per phase. SQL filtering is faster for large datasets; D3 filtering is simpler for small ones. Don't half-implement both.
- **Forgetting to filter headers:** If you filter cards to populated-only but keep all headers visible, users see empty rows/columns with "0 cards" — confusing UX.
- **Animating empty → populated transitions poorly:** When toggling density, cards should fade in/out smoothly. Use D3 transitions on opacity, not instant DOM removal.
- **Not preserving selection across density changes:** TRANS-03 (Phase 61) established selection persistence. Density changes must preserve `selectedIds` just like axis changes do.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting populated cells | Custom logic per facet type | Generic `isPopulated()` helper | Edge cases: null vs "", 0 vs null, arrays |
| WHERE clause generation | String concatenation | SuperDensityService.buildWhereClause() | Already handles parameterization, prevents SQL injection |
| Density state management | Local component state | PAFVContext + SuperDensityService | Global state coordination, already wired |
| Cell filtering animation | Manual show/hide | D3 .join() with transitions | Handles enter/exit/update automatically |

**Key insight:** SuperDensityService already builds the correct SQL WHERE clauses for density filtering (line 291). The problem isn't generating the filter — it's wiring it to the rendering pipeline.

## Common Pitfalls

### Pitfall 1: Performance Degradation on Large Datasets

**What goes wrong:** Client-side D3 filtering on 50K+ cards causes UI lag. User clicks "Dense" button, grid freezes for 2+ seconds.

**Why it happens:** D3 filters the full dataset in JavaScript, then rebinds. For large datasets, this is slower than SQL filtering at query time.

**How to avoid:** Use SQL-level filtering (SuperDensityService) for datasets >5K cards. Measure with `performance.mark()` and fall back to SQL if D3 filtering exceeds 100ms.

**Warning signs:**
- Density toggle takes >200ms to respond
- Browser becomes unresponsive during transition
- Profiler shows D3 `.filter()` consuming >50ms

### Pitfall 2: Empty Grid After Dense Filtering

**What goes wrong:** User sets density to "populated-only" and sees a completely empty grid (no cards, no headers).

**Why it happens:** WHERE clause is too restrictive — filtering out all cards including those with partial data. Example: `name != ""` excludes cards where name is null but other fields have data.

**How to avoid:** Use OR logic in WHERE clause: `(name IS NOT NULL AND name != "") OR (folder IS NOT NULL) OR (status IS NOT NULL)`. A cell is populated if ANY facet has a value.

**Warning signs:**
- Grid disappears entirely when switching to dense mode
- Card count drops to zero unexpectedly
- SQL query returns empty result set

### Pitfall 3: Inconsistent State Between UI and Grid

**What goes wrong:** JanusDensityControls shows "Dense (Populated Only)" selected, but grid still displays empty cells.

**Why it happens:** Density state updated in PAFVContext but not propagated to GridRenderingEngine. Missing data flow link.

**How to avoid:**
1. PAFVContext updates densityState
2. SuperGrid effect re-runs on densityState change
3. SuperGrid passes densityState to GridRenderingEngine.setDensityState()
4. GridRenderingEngine.render() applies filtering

**Warning signs:**
- UI controls show one state, grid shows another
- Console logs show `extentDensity: 'populated-only'` but all cells render
- No re-render triggered when density changes

### Pitfall 4: Selection Lost on Density Change

**What goes wrong:** User selects cards, changes density, selection disappears.

**Why it happens:** Not coordinating with Phase 61's selection persistence. Density change triggers re-render without preserving `selectedIds`.

**How to avoid:**
- Before filtering: capture `this.selectedIds`
- After filtering: restore selection styling on remaining cards
- Use same `.on('end')` callback pattern as Phase 61 (see line 1496-1503 in GridRenderingEngine.ts)

**Warning signs:**
- Selected cards lose blue border after density change
- SelectionContext shows IDs but grid doesn't highlight them
- Selection count in UI doesn't match visual state

## Code Examples

Verified patterns from existing codebase and D3 documentation:

### Extent Density Filtering in GridRenderingEngine

```typescript
// Source: Adapted from GridRenderingEngine.render() at line 491
// Integrates SuperDensityService filtering pattern

export class GridRenderingEngine {
  private densityState: JanusDensityState | null = null;

  /**
   * Set current density state (called from SuperGrid when PAFVContext changes)
   */
  public setDensityState(state: JanusDensityState): void {
    this.densityState = state;
    superGridLogger.debug('GridRenderingEngine: density state set', {
      extentDensity: state.extentDensity,
      valueDensity: state.valueDensity,
    });
  }

  /**
   * Filter cards based on extent density setting
   */
  private filterCardsByDensity(cards: unknown[]): unknown[] {
    if (!this.densityState || this.densityState.extentDensity === 'sparse') {
      // Sparse mode: show all cells including empty
      return cards;
    }

    // Dense mode: only populated cells
    return cards.filter(card => this.isPopulated(card));
  }

  /**
   * Check if a card/cell is populated (has meaningful data)
   */
  private isPopulated(card: unknown): boolean {
    const c = card as Record<string, unknown>;

    // Cell is populated if it has any LATCH property with a value
    return !!(
      (c.name && c.name !== '') ||
      c.folder ||
      c.status ||
      c.priority ||
      c.tags ||
      c.created_at
    );
  }

  /**
   * Render cards with density filtering
   */
  private renderCards(): void {
    if (!this.currentData?.cards) return;

    // Apply density filtering
    const visibleCards = this.filterCardsByDensity(this.currentData.cards);

    const cardContainer = this.container.select('.cards-layer');

    // Bind filtered data with key function for object constancy
    const cardSelection = cardContainer
      .selectAll('.card')
      .data(visibleCards, (d: any) => d.id);

    // Join pattern from Phase 61 (lines 1480-1520)
    cardSelection
      .join(
        // Enter: new cards fade in
        enter => enter.append('g')
          .attr('class', 'card')
          .attr('transform', d => `translate(${(d as any).x}, ${(d as any).y})`)
          .attr('opacity', 0)
          .call(enter => this.renderCardContent(enter))
          .transition()
            .duration(this.config.animationDuration)
            .attr('opacity', 1),

        // Update: existing cards move to new positions
        update => update
          .transition()
            .duration(this.config.animationDuration)
            .attr('transform', d => `translate(${(d as any).x}, ${(d as any).y})`)
            .on('end', function(this: SVGGElement) {
              // Restore selection styling (from Phase 61 pattern)
              const cardId = d3.select(this).datum() as any;
              if (this.selectedIds.has(cardId.id)) {
                d3.select(this).classed('selected', true);
              }
            }.bind(this)),

        // Exit: removed cards fade out
        exit => exit
          .transition()
            .duration(this.config.animationDuration)
            .attr('opacity', 0)
            .remove()
      );
  }
}
```

### SQL-Level Density Filtering

```typescript
// Source: SuperDensityService.buildWhereClause() at line 277
// Already implemented, needs to be USED by GridRenderingEngine

// In SuperGrid.ts - query with density filtering
const densityService = new SuperDensityService(database, filterService);
densityService.setDensity('extent', 'populated-only');

const aggregationResult = await densityService.generateAggregatedData();
// aggregationResult.data contains only populated cells
// aggregationResult.executedQuery shows the SQL with WHERE clauses

// Pass filtered data to GridRenderingEngine
this.renderingEngine.setGridData({
  cards: aggregationResult.data,
  columns: computedColumns,
  rows: computedRows,
});
```

### Coordinated Header Filtering

```typescript
// Compute populated dimensions
private computePopulatedDimensions(cards: unknown[]): {
  columns: Set<string>;
  rows: Set<string>;
} {
  const populatedColumns = new Set<string>();
  const populatedRows = new Set<string>();

  cards.forEach(card => {
    const c = card as Record<string, unknown>;
    if (c._projectedCol != null) {
      populatedColumns.add(String(c._projectedCol));
    }
    if (c._projectedRow != null) {
      populatedRows.add(String(c._projectedRow));
    }
  });

  return { columns: populatedColumns, rows: populatedRows };
}

// In renderProjectionHeaders()
private renderProjectionHeaders(): void {
  if (!this.currentHeaders || !this.densityState) return;

  let visibleColumnHeaders = this.currentHeaders.columns;
  let visibleRowHeaders = this.currentHeaders.rows;

  // Filter headers in dense mode
  if (this.densityState.extentDensity === 'populated-only') {
    const populated = this.computePopulatedDimensions(
      this.currentData?.cards || []
    );

    visibleColumnHeaders = visibleColumnHeaders.filter(h =>
      populated.columns.has(h.value)
    );
    visibleRowHeaders = visibleRowHeaders.filter(h =>
      populated.rows.has(h.value)
    );
  }

  // Render with D3 join pattern (existing code from Phase 61)
  this.renderColumnHeaders(visibleColumnHeaders);
  this.renderRowHeaders(visibleRowHeaders);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Show all cells always | Density toggle (sparse ↔ dense) | Phase 62 (this phase) | Users can focus on populated data vs see full context |
| Hardcoded SQL WHERE clauses | SuperDensityService state-driven queries | Already implemented | Declarative density control, cached queries |
| Manual visibility toggling | D3 .join() with filtered data | Phase 61 + 62 | Smooth transitions, automatic enter/exit |
| Grid-only density | 4-level Janus hierarchy | In progress | Value, Extent, View, Region all orthogonal |

**Deprecated/outdated:**
- Manual cell hiding with CSS `display: none` — Use D3 data filtering instead (automatic transitions)
- Global density setting for all axes — Use RegionDensityConfig for per-axis control (Level 4)

## Open Questions

1. **Performance threshold for SQL vs D3 filtering**
   - What we know: SuperDensityService generates correct SQL WHERE clauses
   - What's unclear: At what dataset size does SQL filtering become necessary?
   - Recommendation: Start with D3 filtering (simpler), measure performance, switch to SQL if >100ms

2. **Empty cell definition**
   - What we know: `isPopulated()` checks name, folder, status, priority, tags, created_at
   - What's unclear: Should cells with ONLY created_at (auto-generated) count as populated?
   - Recommendation: Discuss with user; default to "any non-null facet = populated" for Phase 62

3. **Header filtering granularity**
   - What we know: Dense mode should hide empty rows/columns
   - What's unclear: For nested headers, hide parent if ALL children empty, or hide individual empty children?
   - Recommendation: Hide individual empty children first (simpler), evaluate parent hiding in Phase 63

## Sources

### Primary (HIGH confidence)
- `src/types/density-control.ts` — Complete Janus density type definitions
- `src/services/supergrid/SuperDensityService.ts` — SQL WHERE clause generation at line 277-297
- `src/components/JanusDensityControls.tsx` — UI controls already wired
- `src/d3/grid-rendering/GridRenderingEngine.ts` — Rendering pipeline (needs density wiring)
- `specs/SuperGrid-Specification.md` — Section 2.5 SuperDensitySparsity specification
- Phase 61 Verification — Selection persistence pattern (lines 1496-1520)

### Secondary (MEDIUM confidence)
- D3.js official documentation — `.filter()` and `.join()` patterns
- `docs/notes/apple-notes/CardBoard/Density vs. Sparsity across Views.md` — Janus model philosophy

### Tertiary (LOW confidence)
- None — all research verified against codebase and official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All infrastructure exists, no new dependencies
- Architecture: HIGH — SuperDensityService already generates correct SQL, need only wire it
- Pitfalls: HIGH — Phase 61 established selection persistence pattern to follow

**Research date:** 2026-02-12
**Valid until:** 60 days (stable infrastructure, no fast-moving dependencies)

**Key finding:** The hard work is done. SuperDensityService correctly implements Janus Level 2 (extent density) including SQL WHERE clause generation. Phase 62 is primarily a wiring task: connect PAFVContext.densityState → GridRenderingEngine.setDensityState() → renderCards() filtering. Estimated complexity: LOW (infrastructure exists, straightforward integration).
