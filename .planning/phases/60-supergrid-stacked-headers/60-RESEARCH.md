# Phase 60: SuperGrid Stacked/Nested Headers - Research

**Researched:** 2026-02-11
**Domain:** D3.js hierarchical header rendering with visual spanning
**Confidence:** MEDIUM

## Summary

Phase 60 implements spreadsheet-style hierarchical headers with visual spanning for multi-axis PAFV projections. The existing codebase already has substantial infrastructure through `HeaderLayoutService` (using d3-hierarchy's `stratify`), `SuperGridHeaders` orchestrator, and `SuperStackProgressive` for deep hierarchies. The primary work is integrating PAFV axis mappings to drive multi-level header generation and implementing Excel-style parent header spanning (where Year 2024 spans across Q1, Q2, Q3, Q4).

**Current state:** Single-level headers working (Phase 56-03 complete). Hierarchical header *infrastructure* exists but not yet driven by PAFV stacked axes.

**Primary recommendation:** Extend existing `HeaderLayoutService.generateHeaderHierarchy()` to accept multiple stacked facets (not just single facet), compute parent-child relationships via d3-hierarchy's stratify, and wire to `SuperGridHeaders.renderHeaders()` which already handles multi-level rendering with span calculation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-hierarchy | 3.x (via d3 v7) | Tree structure from flat data | Industry standard for hierarchical layouts, used by Isometry codebase |
| d3-selection | 3.x (via d3 v7) | DOM manipulation with data binding | Core D3 pattern for enter/update/exit |
| TypeScript | 5.x | Type safety | Project requirement, strict mode enforced |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-transition | 3.x (via d3 v7) | Animated header transitions | When axis mappings change (SuperDynamic) |
| React | 18.x | Control chrome only | UI controls for header interaction, not rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| d3-hierarchy | Custom tree builder | d3-hierarchy handles edge cases (cycles, missing parents) and provides traversal methods |
| d3-selection | React rendering | Would break D3's data binding model, lose enter/update/exit patterns |

**Installation:**
```bash
# Already installed in Isometry project
npm install d3@^7.0.0
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── d3/
│   ├── SuperGridHeaders.ts          # Main orchestrator (exists)
│   ├── header-layout/
│   │   └── HeaderLayoutCalculator.ts # Width/span calculation (exists)
│   ├── header-rendering/
│   │   └── HeaderProgressiveRenderer.ts # Visual rendering (exists)
│   └── SuperStackProgressive.ts     # Deep hierarchy disclosure (exists)
├── services/supergrid/
│   └── HeaderLayoutService.ts       # Hierarchy generation (exists, needs extension)
├── types/
│   └── grid.ts                      # HeaderNode, HeaderHierarchy types (exists)
```

### Pattern 1: Multi-Facet Hierarchy Generation

**What:** Generate hierarchical headers from multiple stacked facets (e.g., Year → Quarter → Month)

**When to use:** When PAFV axis has multiple facets assigned to same plane (stacked axes)

**Example:**
```typescript
// Source: Adapted from existing HeaderLayoutService pattern
interface StackedAxisConfig {
  axis: LATCHAxis;
  facets: string[]; // ['year', 'quarter', 'month'] for time hierarchy
}

// Generate hierarchy from multiple facets
function generateStackedHierarchy(
  cards: unknown[],
  stackedAxis: StackedAxisConfig
): HeaderHierarchy {
  // Build flat header nodes with parent relationships
  const flatNodes: HeaderNode[] = [];

  // Root node
  flatNodes.push({
    id: `${stackedAxis.axis}-root`,
    label: stackedAxis.axis.toUpperCase(),
    parentId: undefined,
    level: 0,
    // ... other HeaderNode properties
  });

  // For each facet level, create nodes with parent references
  stackedAxis.facets.forEach((facet, level) => {
    const uniqueValues = getUniqueValues(cards, facet);

    uniqueValues.forEach(value => {
      const parentValue = level > 0
        ? getParentValue(cards, stackedAxis.facets[level - 1], value)
        : null;

      flatNodes.push({
        id: `${stackedAxis.axis}-${facet}-${value}`,
        label: value,
        parentId: parentValue
          ? `${stackedAxis.axis}-${stackedAxis.facets[level-1]}-${parentValue}`
          : `${stackedAxis.axis}-root`,
        level: level + 1,
        facet, // Store facet for semantic grouping
        // ... other properties
      });
    });
  });

  // Use d3.stratify to build hierarchy
  const stratifyFn = d3.stratify<HeaderNode>()
    .id(d => d.id)
    .parentId(d => d.parentId);

  const root = stratifyFn(flatNodes);

  // Calculate spans (parent width = sum of children widths)
  calculateSpans(root);

  return {
    rootNodes: root.children?.map(c => c.data) || [],
    allNodes: flatNodes,
    maxDepth: root.height,
    // ... other HeaderHierarchy properties
  };
}
```

### Pattern 2: Parent-Child Span Calculation

**What:** Calculate how many leaf columns/rows each parent header spans

**When to use:** After hierarchy is generated, before rendering

**Example:**
```typescript
// Source: Existing pattern in HeaderLayoutService
function calculateSpans(root: HierarchyNode<HeaderNode>): void {
  // Bottom-up traversal
  root.eachAfter(node => {
    if (node.children) {
      // Parent span = sum of child spans
      const totalSpan = node.children.reduce(
        (sum, child) => sum + child.data.span,
        0
      );
      node.data.span = totalSpan;

      // Parent width = sum of child widths
      const totalWidth = node.children.reduce(
        (sum, child) => sum + child.data.width,
        0
      );
      node.data.width = totalWidth;
    } else {
      // Leaf nodes have span of 1
      node.data.span = 1;
    }
  });
}
```

### Pattern 3: Multi-Level SVG Rendering

**What:** Render stacked header levels with proper alignment and spanning

**When to use:** In GridRenderingEngine after hierarchy calculation

**Example:**
```typescript
// Source: Existing SuperGridHeaders rendering pattern
function renderStackedHeaders(
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  hierarchy: HeaderHierarchy
): void {
  // Create group for each level
  const levels = d3.range(0, hierarchy.maxDepth + 1);

  const levelGroups = container
    .selectAll('g.header-level')
    .data(levels, d => d)
    .join('g')
      .attr('class', 'header-level')
      .attr('transform', d => `translate(0, ${d * HEADER_HEIGHT})`);

  // Render nodes within each level
  levels.forEach(level => {
    const nodesAtLevel = hierarchy.allNodes.filter(n => n.level === level);

    levelGroups
      .filter((_, i) => i === level)
      .selectAll('g.header-node')
      .data(nodesAtLevel, d => d.id)
      .join(
        enter => enter.append('g')
          .attr('class', 'header-node')
          .call(g => {
            // Background rect spanning width
            g.append('rect')
              .attr('width', d => d.width)
              .attr('height', HEADER_HEIGHT)
              .attr('fill', '#f1f5f9')
              .attr('stroke', '#cbd5e1');

            // Label text
            g.append('text')
              .attr('x', d => d.width / 2)
              .attr('y', HEADER_HEIGHT / 2)
              .attr('text-anchor', 'middle')
              .attr('dominant-baseline', 'middle')
              .text(d => d.label);
          }),
        update => update,
        exit => exit.remove()
      )
      .attr('transform', d => `translate(${d.x}, 0)`);
  });
}
```

### Pattern 4: PAFV Integration

**What:** Wire PAFV axis mappings to drive header hierarchy generation

**When to use:** When PAFVContext mappings change

**Example:**
```typescript
// Source: Based on existing mappingsToProjection pattern (src/types/grid.ts)
interface PAFVProjection {
  xAxis: AxisProjection | null;
  yAxis: AxisProjection | null;
}

interface AxisProjection {
  axis: LATCHAxis;
  facet: string; // Single facet for Phase 56-59
  facets?: string[]; // Multiple facets for Phase 60 (stacked)
}

// In GridRenderingEngine
function updateHeadersFromProjection(
  projection: PAFVProjection,
  cards: unknown[]
): void {
  if (projection.xAxis?.facets) {
    // Stacked axis (Phase 60)
    const columnHierarchy = generateStackedHierarchy(cards, {
      axis: projection.xAxis.axis,
      facets: projection.xAxis.facets
    });

    this.superGridHeaders.renderHeaders(
      cards,
      'x',
      columnHierarchy
    );
  } else if (projection.xAxis?.facet) {
    // Single facet (Phase 56-59)
    this.superGridHeaders.renderHeaders(
      cards,
      'x',
      projection.xAxis.facet
    );
  }

  // Similar for yAxis
}
```

### Anti-Patterns to Avoid

- **Building custom tree structures instead of d3-hierarchy**: Reinvents the wheel, misses edge cases like cycles and orphaned nodes
- **Rendering headers with React components**: Breaks D3's data binding, loses efficient enter/update/exit, causes re-render thrashing
- **Calculating spans top-down**: Must traverse bottom-up (leaf → parent) to correctly sum child spans
- **Hard-coding header height**: Use configuration constant, respect progressive disclosure state

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree from flat data | Manual parent-child linking | `d3.stratify()` | Handles missing parents, cycles, provides traversal methods (eachBefore, eachAfter, descendants) |
| Header span calculation | Manual width summing loops | d3-hierarchy traversal methods | `.eachAfter()` guarantees bottom-up processing order |
| DOM updates on data change | Manual element creation/removal | D3's `.join()` with key function | Preserves object constancy, enables smooth transitions |
| Multi-level positioning | Manual coordinate calculation | d3-hierarchy's built-in depth/height | Automatically tracks node depth and subtree height |

**Key insight:** d3-hierarchy exists precisely because hierarchical layout is deceptively complex. Manual approaches fail on edge cases: disconnected nodes, circular references, dynamic depth changes. The existing `HeaderLayoutService` already uses d3-hierarchy correctly—extend it, don't replace it.

## Common Pitfalls

### Pitfall 1: Assuming Single-Parent Hierarchies

**What goes wrong:** Data has multiple grouping paths (e.g., a Month can belong to both Q1 and "Winter")

**Why it happens:** Naïve grouping creates multiple parent references, d3.stratify() errors on ambiguous parentId

**How to avoid:**
1. Define canonical hierarchy order in PAFV axis configuration
2. Use facet-level parent relationships, not value-level (Month always children of Quarter, not of specific quarter values)
3. If multi-parent needed, use separate hierarchies or denormalize data

**Warning signs:** "Error: ambiguous: ..." from d3.stratify(), duplicate node IDs in flat data

### Pitfall 2: Rendering Before Span Calculation

**What goes wrong:** Parent headers render with wrong width, don't visually span children

**Why it happens:** Width/span properties must be calculated bottom-up before rendering

**How to avoid:**
1. Always call `calculateSpans()` after `d3.stratify()` and before rendering
2. Use d3-hierarchy's `.eachAfter()` to guarantee bottom-up traversal
3. Store spans in HeaderNode.span and HeaderNode.width properties

**Warning signs:** Parent headers narrower than their children, misaligned column boundaries

### Pitfall 3: Missing Header Sorting Logic

**What goes wrong:** Clicking column headers doesn't sort data, or sorts wrong level

**Why it happens:** Must determine which hierarchy level was clicked and which facet to sort by

**How to avoid:**
1. Store facet identifier in HeaderNode.data.facet
2. Pass level and facet to sort handler
3. Sort affects all cards in that subtree, not just immediate children

**Warning signs:** Clicking Year 2024 sorts by month instead of year, or no sorting happens

**Example:**
```typescript
// Correct: Store facet and propagate to handler
node.data = {
  facet: 'quarter', // Q1, Q2, Q3, Q4 belong to 'quarter' facet
  value: 'Q1'
};

onHeaderClick(node => {
  // Sort by the facet this header represents
  sortCardsByFacet(node.data.facet, node.data.value);
});
```

### Pitfall 4: Progressive Disclosure Not Considering Depth

**What goes wrong:** Deep hierarchies (6+ levels) cause performance issues or visual clutter

**Why it happens:** Rendering all levels simultaneously without considering hierarchy depth

**How to avoid:**
1. Check `hierarchy.maxDepth` threshold (e.g., > 4 levels)
2. Use existing `SuperStackProgressive` for deep hierarchies
3. Enable level grouping and zoom controls for depths > threshold

**Warning signs:** Slow rendering with > 100 header nodes, headers too narrow to read

**Existing solution:** `SuperStackProgressive` already implements this—wire it in when `maxDepth > config.progressiveDisclosure.autoGroupThreshold` (currently 20 nodes)

## Code Examples

Verified patterns from official sources:

### Stratify from Flat Data (Official D3)
```typescript
// Source: https://d3js.org/d3-hierarchy
const data = [
  { id: "year-2024", parent: null },
  { id: "q1-2024", parent: "year-2024" },
  { id: "jan-2024", parent: "q1-2024" },
  { id: "feb-2024", parent: "q1-2024" }
];

const root = d3.stratify()
  .id(d => d.id)
  .parentId(d => d.parent)(data);

// root is now a hierarchy with .children populated
```

### Bottom-Up Span Calculation (Existing Codebase)
```typescript
// Source: src/services/supergrid/HeaderLayoutService.ts:601-633
private calculateLayout(root: HierarchyNode<HeaderNode>): void {
  let currentX = 0;

  root.eachBefore((node: HierarchyNode<HeaderNode>) => {
    const data = node.data;

    if (node.depth === 0) {
      data.x = 0;
      data.y = 0;
    } else {
      data.x = currentX;
      data.y = node.depth * 40; // 40px height per level
      currentX += data.width || 100;
    }
  });
}
```

### D3 Join with Key Function (Project Pattern)
```typescript
// Source: CLAUDE.md:285-292, src/d3/SuperGridHeaders.ts pattern
selection
  .selectAll('.header-node')
  .data(nodes, d => d.id) // Key function preserves object constancy
  .join(
    enter => enter.append('g').attr('class', 'header-node'),
    update => update.attr('class', 'header-node'),
    exit => exit.transition().attr('opacity', 0).remove()
  );
```

### Extracting Unique Facet Values (Pattern for Plan 60-01)
```typescript
// Pattern adapted from GridRenderingEngine.ts:176-194
function extractUniqueFacetValues(
  cards: unknown[],
  facet: string
): string[] {
  return [
    ...new Set(
      cards
        .map(c => (c as Record<string, unknown>)[facet])
        .filter(v => v != null)
        .map(v => String(v))
    )
  ].sort();
}

// For hierarchical facets, also track parent value
function extractWithParent(
  cards: unknown[],
  childFacet: string,
  parentFacet: string
): Map<string, string> {
  const parentMap = new Map<string, string>();

  cards.forEach(card => {
    const child = String((card as Record<string, unknown>)[childFacet]);
    const parent = String((card as Record<string, unknown>)[parentFacet]);

    if (!parentMap.has(child)) {
      parentMap.set(child, parent);
    }
  });

  return parentMap;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual tree building | d3-hierarchy's stratify | d3 v4 (2016) | Standardized hierarchical layouts |
| Manual enter/update/exit | `.join()` method | d3 v5 (2019) | Simplified data binding |
| Nested selections | Flat data binding with computed positions | d3 v6 (2020) | Better performance |
| Excel pivot table UI | Web-native SuperGrid with D3 | Isometry v4 (2025) | Direct sql.js access, no bridge |

**Deprecated/outdated:**
- Manual `selection.enter().append()` + `selection.exit().remove()`: Use `.join()` instead
- `d3.layout.tree()`: Renamed to `d3.tree()` in v4
- Nested selections for tables: Use flat data binding with computed coordinates

## Open Questions

1. **Multi-facet axis representation in PAFVProjection**
   - What we know: Current `AxisProjection` has single `facet: string`
   - What's unclear: Should stacked axes be `facets: string[]` or separate mappings?
   - Recommendation: Add optional `facets?: string[]` to `AxisProjection`, use when present. This preserves backward compatibility with single-facet (Phase 56-59).

2. **Parent-child relationships for time hierarchies**
   - What we know: SQL cards have `created_at` timestamp, need Year/Quarter/Month derivation
   - What's unclear: Derive in SQL query or in D3 rendering layer?
   - Recommendation: Add SQL view with derived columns (year, quarter, month) or compute in HeaderLayoutService. SQL derivation is cleaner but requires schema change.

3. **Header sorting with multi-level hierarchy**
   - What we know: Clicking header should sort grid
   - What's unclear: Does sorting Year 2024 sort all children by year, or preserve child order?
   - Recommendation: Sort applies to clicked level's facet, preserves child ordering within each group. Example: Sort by Year → 2024, 2023, 2022; within each year, quarters maintain Q1, Q2, Q3, Q4 order.

## Sources

### Primary (HIGH confidence)
- D3 official documentation: https://d3js.org/d3-hierarchy
- Isometry codebase: `src/services/supergrid/HeaderLayoutService.ts` (verified stratify usage)
- Isometry codebase: `src/d3/SuperGridHeaders.ts` (verified rendering patterns)
- Isometry codebase: `src/types/grid.ts` (verified type definitions)

### Secondary (MEDIUM confidence)
- [D3 Hierarchies Tutorial](https://www.d3indepth.com/hierarchies/) - General hierarchy patterns
- [Let's Make a Grid with D3.js](https://gist.github.com/cagrimmett/07f8c8daea00946b9e704e3efcbd5739) - Nested grid structures
- [D3 Nested Selections](https://bost.ocks.org/mike/nest/) - Historical pattern (now prefer flat data binding)

### Tertiary (LOW confidence)
- [Pivot Table Visualization with D3](https://gist.github.com/kkoci/678e0c5b36115452a5d688800f1d71ca) - Community example
- [Excel Pivot Table Nesting](https://www.tutorialspoint.com/excel_pivot_tables/excel_pivot_tables_nesting.htm) - UI reference only

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Existing codebase uses d3-hierarchy correctly with stratify
- Architecture: MEDIUM - Patterns established but need extension for multi-facet case
- Pitfalls: MEDIUM - Based on codebase analysis + D3 community patterns, not production-tested

**Research date:** 2026-02-11
**Valid until:** 2026-03-11 (30 days - D3 stable, Isometry codebase active)

**Key findings:**
1. Infrastructure already exists: `HeaderLayoutService` uses d3.stratify, `SuperGridHeaders` orchestrates rendering
2. Main gap: Single-facet only, need multi-facet hierarchy generation
3. Existing span calculation algorithm is correct (bottom-up traversal)
4. `SuperStackProgressive` already handles deep hierarchies, wire when depth > threshold
5. Need to extend `PAFVProjection` to support stacked facets (`facets?: string[]`)

**Ready for planning:** Yes. Core patterns verified, implementation path clear.
