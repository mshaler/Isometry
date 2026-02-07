# Phase 36: SuperGrid Headers - Research

**Researched:** 2026-02-07
**Domain:** Nested PAFV headers with hierarchical spanning and density controls
**Confidence:** HIGH

## Summary

Researched implementation patterns for nested PAFV headers with hierarchical spanning across multiple dimension levels. The current SuperGrid implementation provides basic header support with single-level status grouping. Phase 36 will transform this into a multi-level hierarchical structure with visual spanning, morphing animations, and orthogonal density controls (Janus model).

Key findings show D3.js provides robust hierarchical layout patterns through d3-hierarchy, excellent transition capabilities for morphing animations, and zoom/pan controls for cartographic navigation. TanStack Virtual offers proven virtualization for performance at scale. The existing SuperGrid foundation is well-architected for extension with its PAFV spatial projection system and bridge elimination architecture.

**Primary recommendation:** Build on existing SuperGrid foundation using D3.js hierarchical layouts, SVG-based spanning with CSS Grid fallbacks, and TanStack Virtual for performance.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Header hierarchy structure:** Dynamic/unlimited nesting depth — data complexity determines depth, not arbitrary limits
- **Automatic grouping + progressive disclosure:** For complexity management (applies to SuperTime and other LATCH controls)
- **Semantic grouping:** Data density as grouping strategy, with user-configurable settings
- **Level picker tabs + zoom controls:** For navigation (headers form primary breadcrumb device - 3D camera stairstepping)
- **Context menu:** For multi-level expand/collapse operations (starting point; Shift+click and double-click to explore later)
- **Per-dataset, per-app state persistence:** Required
- **Morphing boundary animation style:** Using D3 transitions
- **Progressive rendering:** With lazy rendering fallback when performance budgets exceeded
- **Separate controls initially:** For zoom/pan (combined widget and other approaches to experiment with later)
- **Smooth animation transitions:** "quiet app" aesthetic
- **User toggle:** For sparse/dense display via SparsityDensity slider
- **Fixed corner anchor:** For zoom operations (selection-based and user-definable to explore later)
- **Hybrid span calculation:** Data-proportional primary sizing + content-based minimums + equal distribution fallback (mirrors Numbers/Excel)
- **Content-aware alignment:** Center for short spans, left-align for long spans, numeric right-align, dates left-align (serves scannability over uniformity)
- **Dynamic reflow:** With horizontal scroll fallback for layout conflict resolution
- **Breakpoint adaptation:** With semantic grouping for responsive behavior (reduce header depth on smaller screens)
- **Geometric click zones:** With "innermost wins + parent label exclusion" rule
- **Parent label zone:** (~32px) for structural operations (expand/collapse)
- **Child header body:** For data group selection
- **Data cell body:** For individual card selection
- **Cursor feedback:** Eliminates guesswork about click targets
- **Zone-specific cursor changes:** On hover boundaries

### Claude's Discretion
- Exact hover highlight transition timing and easing curves
- Performance monitoring thresholds for lazy rendering fallback
- Minimum header cell dimensions for readability
- Specific breakpoint values for responsive adaptation

### Deferred Ideas (OUT OF SCOPE)
- GitHub issue needed for user application settings stored in SQLite (referenced in semantic grouping strategy)
- Shift+click and double-click behavior for multi-level header operations (start with context menu)
- Combined widget approach for zoom/pan controls (start with separate controls)
- Selection-based and user-definable anchor points for zoom (start with fixed corner)
- Hover expansion for progressive disclosure (adds latency and complexity)
- Canvas rendering for data plane optimization (start with SVG/DOM)

## Standard Stack

The established libraries/tools for nested hierarchical headers with spanning:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Hierarchical layouts, transitions, zoom/pan | Industry standard for complex data visualization with excellent hierarchy support |
| TanStack Virtual | latest | Table virtualization | Chosen in Phase 34-02 for 10k+ cell performance vs custom virtualization |
| CSS Grid | Native | Layout spanning calculations | Modern standard for complex grid layouts with native spanning support |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-hierarchy | v7 (part of D3) | Tree, partition, stratify methods | For converting flat LATCH data to nested structures |
| d3-transition | v7 (part of D3) | Morphing boundary animations | For smooth header expansion/collapse transitions |
| d3-zoom | v7 (part of D3) | Cartographic navigation | For zoom/pan controls with fixed corner anchor |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid | Flexbox | Less spanning control, more complex calculations |
| SVG headers | HTML/DOM | Better performance but less animation flexibility |
| D3 zoom | Custom scroll | More work, less battle-tested |

**Installation:**
```bash
# Already installed in current Isometry stack
npm install d3 @tanstack/react-virtual
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── d3/
│   ├── SuperGrid.ts              # Main grid renderer (existing)
│   ├── SuperGridHeaders.ts       # NEW: Nested header system
│   ├── SuperGridZoom.ts          # NEW: Janus zoom/pan controls
│   └── __tests__/
│       ├── SuperGrid.test.ts     # Existing foundation tests
│       ├── SuperGridHeaders.test.ts  # NEW: Header hierarchy tests
│       └── SuperGridZoom.test.ts     # NEW: Zoom/pan control tests
├── types/
│   └── grid.ts                   # Extend with HeaderHierarchy types
└── services/
    └── HeaderLayoutService.ts    # NEW: Span calculations and layout
```

### Pattern 1: Hierarchical Data Structure
**What:** Convert flat LATCH data to nested header hierarchy
**When to use:** When PAFV axes have multiple levels (e.g., Year > Quarter > Month)
**Example:**
```typescript
// Source: D3.js official docs + current SuperGrid patterns
import { stratify, hierarchy } from 'd3-hierarchy';

interface HeaderNode {
  id: string;
  label: string;
  parentId?: string;
  facet: string;
  value: any;
  count: number;
  level: number;
  span?: number; // Calculated span width
}

// Convert flat headers to hierarchy
const headerHierarchy = stratify<HeaderNode>()
  .id(d => d.id)
  .parentId(d => d.parentId)
  (flatHeaders);
```

### Pattern 2: SVG-Based Spanning Layout
**What:** Calculate and render hierarchical spans using SVG groups
**When to use:** For complex nested header layouts with visual boundaries
**Example:**
```typescript
// Source: Current SuperGrid.ts patterns + D3 hierarchy docs
class SuperGridHeaders {
  private renderHeaderLevel(level: number, nodes: HeaderNode[]): void {
    const levelGroup = this.container.select(`g.header-level-${level}`);

    const headers = levelGroup.selectAll('.header-span')
      .data(nodes, d => d.id);

    const entering = headers.enter()
      .append('g')
      .attr('class', 'header-span');

    // Span background with calculated width
    entering.append('rect')
      .attr('width', d => this.calculateSpanWidth(d))
      .attr('height', this.headerHeight)
      .attr('x', d => this.calculateSpanX(d));
  }
}
```

### Pattern 3: Janus Density Controls
**What:** Orthogonal zoom (value) and pan (extent) controls
**When to use:** For managing data density in large header hierarchies
**Example:**
```typescript
// Source: D3.js zoom documentation + user decisions
interface JanusControls {
  zoomLevel: 'leaf' | 'collapsed' | 'auto';  // Value density
  panLevel: 'sparse' | 'dense' | 'populated'; // Extent density
}

class SuperGridZoom {
  private setupZoomBehavior(): void {
    this.zoomBehavior = d3.zoom<SVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .translateExtent([[0, 0], [this.width, this.height]])
      .on('zoom', (event) => this.handleZoom(event));
  }
}
```

### Anti-Patterns to Avoid
- **Manual DOM manipulation:** Use D3's .join() pattern, not direct appendChild
- **Blocking animations:** Keep transitions under 300ms for "quiet app" aesthetic
- **Fixed nesting limits:** User decision requires unlimited depth based on data complexity
- **Uniform alignment:** User decision requires content-aware alignment (center/left/right based on span length)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Header virtualization | Custom viewport clipping | TanStack Virtual | Already chosen in Phase 34-02, handles 10k+ cells |
| Span width calculation | Manual column math | CSS Grid `grid-column: span X` | Native browser optimization, automatic reflow |
| Zoom/pan controls | Custom mouse/touch handlers | d3-zoom | Battle-tested, handles browser quirks, multi-input support |
| Tree hierarchy traversal | Custom nested loops | d3-hierarchy stratify/partition | Handles edge cases, performance optimized |
| Animation easing | Custom interpolation | d3-transition with easing | Proven smooth curves, interruption handling |
| Layout conflict resolution | Custom overflow logic | CSS Grid auto-fit with scroll fallback | Browser handles complex layout math |

**Key insight:** D3.js and CSS Grid have solved the complex layout math. Focus on business logic, not reimplementing browser primitives.

## Common Pitfalls

### Pitfall 1: Transition Stacking
**What goes wrong:** Multiple overlapping D3 transitions cause visual glitches and state inconsistency
**Why it happens:** Users can trigger expand/collapse faster than animations complete
**How to avoid:** Always interrupt existing transitions before starting new ones
**Warning signs:** Headers jumping between states, incomplete animations
```typescript
// Always interrupt existing transitions
selection.interrupt().transition().duration(300)...
```

### Pitfall 2: Span Calculation Edge Cases
**What goes wrong:** Headers overlap or have gaps during dynamic reflow
**Why it happens:** Floating-point precision errors in width calculations, especially with nested percentages
**How to avoid:** Use integer-based calculations with explicit rounding, test with various content lengths
**Warning signs:** 1-pixel gaps between headers, overlapping text on resize

### Pitfall 3: Performance Cliff with Deep Hierarchies
**What goes wrong:** Rendering becomes sluggish with >5 header levels or >100 header nodes per level
**Why it happens:** DOM node count grows exponentially, layout recalculation becomes expensive
**How to avoid:** Implement progressive disclosure (user decision), lazy rendering fallback when thresholds exceeded
**Warning signs:** >16ms render times, janky scroll performance

### Pitfall 4: Click Zone Ambiguity
**What goes wrong:** Users can't tell which part of nested headers will trigger which action
**Why it happens:** Overlapping click zones, inconsistent cursor feedback
**How to avoid:** Implement user-decided geometric zones (parent label ~32px, child body, data cells)
**Warning signs:** Users reporting "clicking doesn't work" or wrong actions triggered

## Code Examples

Verified patterns from official sources:

### Hierarchical Header Data Binding
```typescript
// Source: Current SuperGrid.ts + D3.js hierarchy documentation
class SuperGridHeaders {
  private renderNestedHeaders(hierarchyRoot: d3.HierarchyNode<HeaderNode>): void {
    // Process each level separately for clean spanning
    hierarchyRoot.each((node) => {
      if (node.depth === 0) return; // Skip root

      const levelGroup = this.ensureLevelGroup(node.depth);
      this.renderHeaderSpan(levelGroup, node);
    });
  }

  private ensureLevelGroup(level: number): d3.Selection<SVGGElement, unknown, null, undefined> {
    let group = this.container.select(`g.header-level-${level}`);
    if (group.empty()) {
      group = this.container.append('g')
        .attr('class', `header-level-${level}`)
        .attr('transform', `translate(0, ${level * this.headerHeight})`);
    }
    return group;
  }
}
```

### Morphing Boundary Animations
```typescript
// Source: D3.js transition documentation + user decision on morphing boundaries
private animateHeaderExpansion(headerNode: HeaderNode, newSpan: number): void {
  const headerGroup = this.container.select(`[data-header-id="${headerNode.id}"]`);

  headerGroup.select('.header-background')
    .transition()
    .duration(300) // User decision: smooth transitions
    .ease(d3.easeQuadOut) // Claude's discretion: easing curve
    .attr('width', this.calculateSpanWidth({ ...headerNode, span: newSpan }));

  // Update child header positions
  headerGroup.selectAll('.child-header')
    .transition()
    .duration(300)
    .attr('transform', (d, i) => `translate(${this.calculateChildX(d, i)}, 0)`);
}
```

### Geometric Click Zones
```typescript
// Source: User decisions on click behavior
private setupHeaderClickZones(headerGroup: d3.Selection<SVGGElement, HeaderNode, any, any>): void {
  // Parent label zone (~32px) for expand/collapse
  headerGroup.append('rect')
    .attr('class', 'parent-zone')
    .attr('width', 32) // User decision: ~32px
    .attr('height', this.headerHeight)
    .style('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('click', (event, d) => this.handleExpandCollapse(d));

  // Child header body for data group selection
  headerGroup.append('rect')
    .attr('class', 'child-zone')
    .attr('x', 32)
    .attr('width', d => this.calculateSpanWidth(d) - 32)
    .attr('height', this.headerHeight)
    .style('fill', 'transparent')
    .style('cursor', 'default')
    .on('click', (event, d) => this.handleGroupSelection(d));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HTML table colspan | CSS Grid spanning | 2021-2022 | Better responsive behavior, native browser optimization |
| Manual virtualization | TanStack Virtual | Phase 34-02 (2026) | Proven 10k+ cell performance vs custom solutions |
| Single-level headers | Hierarchical PAFV | Phase 36 (current) | Enables n-dimensional data projection |
| Fixed density levels | Janus orthogonal controls | User decision | Pan and zoom become independent operations |

**Deprecated/outdated:**
- Manual table cell spanning: CSS Grid handles this natively with better performance
- Single zoom control: Janus model separates value density (zoom) from extent density (pan)

## Open Questions

Things that couldn't be fully resolved:

1. **Performance Thresholds for Lazy Rendering**
   - What we know: Progressive rendering preferred, lazy fallback when budgets exceeded
   - What's unclear: Specific millisecond thresholds for different device classes
   - Recommendation: Start with 16ms budget (60fps), measure in practice

2. **Minimum Header Cell Dimensions**
   - What we know: Content-based minimums prevent illegibility
   - What's unclear: Exact pixel values for different content types
   - Recommendation: Test with actual LATCH data, start with 80px minimum

3. **Breakpoint Values for Responsive Adaptation**
   - What we know: Reduce header depth on smaller screens using semantic grouping
   - What's unclear: Specific breakpoint pixel values
   - Recommendation: Follow standard responsive breakpoints (768px tablet, 480px mobile)

## Sources

### Primary (HIGH confidence)
- [D3.js Hierarchy Documentation](https://d3js.org/d3-hierarchy) - Official D3.js hierarchical layout methods
- [D3.js Transitions Documentation](https://d3js.org/d3-transition) - Official transition and animation patterns
- Current SuperGrid.ts implementation - Existing foundation code with PAFV spatial projection
- Phase 36 CONTEXT.md - User decisions and locked implementation choices

### Secondary (MEDIUM confidence)
- [TanStack Virtual Performance Analysis](https://dev.to/ainayeem/building-an-efficient-virtualized-table-with-tanstack-virtual-and-react-query-with-shadcn-2hhl) - Verified with current Phase 34-02 decisions
- [CSS Grid Spanning Patterns](https://css-tricks.com/css-grid-layout-guide/) - Verified spanning techniques for complex layouts

### Tertiary (LOW confidence)
- WebSearch results on progressive rendering - General patterns, need validation against specific performance budgets

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Current tools already chosen and proven in existing SuperGrid
- Architecture: HIGH - D3.js patterns well-documented, user decisions provide clear constraints
- Pitfalls: MEDIUM - Based on D3.js best practices and common table layout issues

**Research date:** 2026-02-07
**Valid until:** 30 days (stable D3.js patterns, user decisions locked)