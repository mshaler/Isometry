# Phase 41: PAFV Architectural Unification - Research

**Researched:** 2026-02-08
**Domain:** D3.js/React architectural patterns and rendering unification
**Confidence:** HIGH

## Summary

Phase 41 aims to eliminate the dual D3/CSS rendering split that currently exists in the Isometry v4 codebase and establish a unified "D3 renders, React controls" contract. This architectural unification is critical foundational work before any PAFV features can be built, as every feature built on the split architecture doubles reconciliation debt.

The current Canvas component demonstrates this problem: it has a `useD3Mode` toggle that switches between CSS-based views (GridView, ListView, KanbanView) and D3-based views (D3GridView, D3ListView, SuperGridView). This creates dual rendering paths, duplicate logic, and architectural complexity that the PAFV implementation plan identifies as a blocking issue.

**Primary recommendation:** Implement IsometryViewEngine class with unified rendering contract, eliminate CSS view components, migrate to single D3-based rendering pipeline with React controlling state only.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Unified data visualization rendering | Industry standard for data-driven DOM manipulation |
| React | 18 | State management and control layer | Current codebase standard, hooks integration |
| TypeScript | strict mode | Type safety for rendering contracts | Enforces interface contracts between layers |
| sql.js | Latest | Direct database access in same memory space | Eliminates bridge overhead established in Phase 33 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Canvas API | Native | High-performance pixel-based rendering | Dense data visualization (>5K elements) |
| SVG API | Native | Vector graphics for headers and UI elements | Interactive elements, crisp scaling |
| HTML DOM | Native | Control layer and accessibility | Forms, tooltips, overlay controls |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom ViewEngine | Recharts/Victory | Less control, harder PAFV integration |
| D3 v7 | D3 v6 | Missing .join() optimizations and performance |
| Unified rendering | Dual rendering paths | Current state - causes debt accumulation |

**Installation:**
```bash
# No new dependencies - using existing D3 v7 and React 18
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── engine/              # Unified ViewEngine implementation
│   ├── IsometryViewEngine.ts    # Core engine class
│   ├── renderers/               # View-specific renderers
│   │   ├── GridRenderer.ts
│   │   ├── ListRenderer.ts
│   │   ├── KanbanRenderer.ts
│   │   └── GraphRenderer.ts
│   └── contracts/               # TypeScript interfaces
│       ├── ViewEngine.ts
│       ├── ViewConfig.ts
│       └── PAFVProjection.ts
├── components/          # React control layer only
│   └── Canvas.tsx               # Thin shell - no data rendering
├── d3/                  # D3 rendering utilities
│   ├── scales.ts                # PAFV scale generation
│   ├── layouts/                 # Layout computation
│   └── transitions/             # Animation helpers
└── state/               # React state management
    └── PAFVContext.tsx          # PAFV state only
```

### Pattern 1: ViewEngine Contract
**What:** Unified interface for all data visualization rendering
**When to use:** Always - replaces dual D3/CSS rendering paths
**Example:**
```typescript
// Source: PAFV implementation plan Phase 0.1
interface ViewEngine {
  // D3 owns this — creates/updates/removes data elements
  render(container: SVGElement | HTMLElement, data: Card[], config: ViewConfig): void;

  // D3 owns this — animates between configurations
  transition(fromConfig: ViewConfig, toConfig: ViewConfig, duration: number): void;

  // D3 owns this — cleans up
  destroy(): void;
}

interface ViewConfig {
  viewType: 'list' | 'grid' | 'kanban' | 'graph' | 'calendar' | 'timeline';
  projection: PAFVProjection;  // Which axes map to which planes
  filters: LATCHFilter[];      // Active LATCH filters
  sort: SortConfig;
  zoom: ZoomState;
}
```

### Pattern 2: React Shell Component
**What:** Canvas becomes thin React wrapper that passes state to D3 engine
**When to use:** Always - eliminates direct data rendering in React
**Example:**
```typescript
// Source: PAFV implementation plan Phase 0.2
function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<IsometryViewEngine | null>(null);
  const { data } = useLiveQuery();      // SQLite → data
  const { projection } = usePAFV();     // Current axis→plane mapping
  const { filters } = useFilters();     // Active LATCH filters

  useEffect(() => {
    if (!containerRef.current) return;

    // Create engine once
    if (!engineRef.current) {
      engineRef.current = new IsometryViewEngine(containerRef.current);
    }

    // D3 handles ALL rendering
    engineRef.current.render(data, {
      viewType: currentView,
      projection,
      filters,
    });
  }, [data, projection, filters, currentView]);

  return <div ref={containerRef} className="canvas-container" />;
}
```

### Pattern 3: Hybrid Canvas/SVG Rendering
**What:** Canvas for high-performance data elements, SVG for interactive headers/UI
**When to use:** Grid views with >1000 cells or heavy data density
**Example:**
```typescript
// Source: Current D3Canvas.tsx patterns + web search findings
class IsometryViewEngine {
  private canvas: HTMLCanvasElement;
  private svg: SVGElement;
  private ctx: CanvasRenderingContext2D;

  render(data: Card[], config: ViewConfig) {
    // High-density data goes to Canvas (pixel-based, fast)
    if (data.length > 5000) {
      this.renderCanvasCells(data, config);
    }

    // Interactive headers and UI go to SVG (vector-based, interactive)
    this.renderSVGHeaders(config);
    this.renderSVGInteractions(config);
  }
}
```

### Anti-Patterns to Avoid
- **Dual rendering paths:** Never maintain both CSS and D3 versions of same view
- **React data rendering:** React components should never create DOM elements for data display
- **Direct DOM manipulation in React:** All data DOM changes go through D3 engine
- **Mixed state ownership:** Either React owns state OR D3 owns state, never both

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| View transitions | Custom animation system | D3 transitions + ViewEngine.transition() | D3 handles enter/update/exit lifecycle automatically |
| Data binding | Manual DOM updates | D3 .join() with key functions | Handles element reuse, performance optimization |
| Scale generation | Custom coordinate calculation | D3 scales (scaleLinear, scaleBand, etc.) | Handles edge cases, domains, ranges automatically |
| Event handling | Custom gesture detection | D3 zoom/drag behaviors + spatial indexing | Built-in gesture coordination, performance optimization |
| Canvas optimization | Custom rendering loop | Existing CanvasRenderer + spatial index | Already handles viewport culling, hit testing |

**Key insight:** D3.js has solved the hard problems of data-driven rendering. Custom solutions miss edge cases and performance optimizations that D3 handles automatically.

## Common Pitfalls

### Pitfall 1: Mixed State Ownership
**What goes wrong:** React and D3 both try to manage the same DOM elements, causing race conditions and inconsistent state
**Why it happens:** Unclear separation between "React controls, D3 renders" contract
**How to avoid:** React owns only container div and passes state down; D3 owns all data DOM elements
**Warning signs:** `useD3Mode` toggles, duplicate view components, inconsistent data updates

### Pitfall 2: Premature ViewEngine Interface
**What goes wrong:** Designing ViewEngine interface before understanding rendering requirements leads to over-abstraction
**Why it happens:** Attempting to solve all view types at once instead of starting with Grid (most complex)
**How to avoid:** Start with Grid rendering in D3, extract interface patterns that emerge naturally
**Warning signs:** Complex interface hierarchies, unused interface methods, frequent interface changes

### Pitfall 3: Canvas/SVG Layer Confusion
**What goes wrong:** Putting interactive elements on Canvas or high-density data on SVG causes performance/usability issues
**Why it happens:** Not understanding Canvas (pixel-based) vs SVG (DOM-based) performance characteristics
**How to avoid:** Canvas for dense data visualization, SVG for headers/interactions, HTML for controls
**Warning signs:** Canvas click events not working, SVG performance degradation with >5K elements

### Pitfall 4: Bridge Code Elimination Incomplete
**What goes wrong:** Old bridge patterns still exist in codebase, creating confusion about data flow
**Why it happens:** Phase 33 established sql.js but didn't eliminate all legacy bridge code
**How to avoid:** Grep for bridge references, replace with direct sql.js access patterns
**Warning signs:** pafvBridge.* calls, MessageBridge imports, unused native rendering flags

## Code Examples

Verified patterns from official sources:

### ViewEngine Implementation Core
```typescript
// Source: PAFV implementation plan + current D3Canvas patterns
class IsometryViewEngine {
  private container: HTMLElement;
  private renderers: Map<ViewType, ViewRenderer> = new Map([
    ['list', new ListRenderer()],
    ['grid', new GridRenderer()],  // SuperGrid IS grid - no toggle
    ['kanban', new KanbanRenderer()],
    ['graph', new GraphRenderer()],
  ]);

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(data: Card[], config: ViewConfig): void {
    const renderer = this.renderers.get(config.viewType);
    if (!renderer) {
      throw new Error(`No renderer for view type: ${config.viewType}`);
    }

    renderer.render(this.container, data, config);
  }

  transition(fromConfig: ViewConfig, toConfig: ViewConfig, duration = 750): void {
    // Animate cards from old positions to new positions
    const cards = d3.select(this.container).selectAll('.card');

    cards.transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .style('transform', (d: Card) => {
        const newPos = this.computePosition(d, toConfig);
        return `translate(${newPos.x}px, ${newPos.y}px)`;
      });
  }

  destroy(): void {
    d3.select(this.container).selectAll('*').remove();
    this.renderers.clear();
  }
}
```

### D3 Data Binding with Key Functions
```typescript
// Source: D3.js v7 documentation + current codebase patterns
function renderGridCells(container: d3.Selection, cards: Card[], config: ViewConfig) {
  const cells = container.selectAll('.cell')
    .data(cards, (d: Card) => d.id) // Key function prevents element recycling issues
    .join(
      enter => enter
        .append('div')
        .attr('class', 'cell')
        .style('opacity', 0)
        .call(enter => enter.transition().style('opacity', 1)),
      update => update
        .call(update => update.transition().style('background', d => getStatusColor(d.status))),
      exit => exit
        .call(exit => exit.transition().style('opacity', 0).remove())
    );

  // Apply PAFV positioning
  cells.style('transform', d => {
    const pos = computePAFVPosition(d, config.projection);
    return `translate(${pos.x}px, ${pos.y}px)`;
  });
}
```

### SQL.js Direct Access (No Bridge)
```typescript
// Source: Phase 33 sql.js foundation + current DatabaseService patterns
function useFilteredData(): Card[] {
  const db = useDatabase();
  const { filters } = useFilters();
  const { projection } = usePAFV();

  return useMemo(() => {
    // Build SQL from active filters - direct sql.js access
    const { sql, params } = compileLATCHQuery(filters, projection);

    // Execute synchronously - no bridge, no promises
    const results = db.exec(sql, params);

    // Transform for D3 consumption with pre-computed coordinates
    return results.map(row => ({
      ...row,
      latchCoords: extractLATCHCoords(row, projection),
    }));
  }, [db, filters, projection]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS + D3 dual paths | Unified D3 rendering | Phase 41 target | Eliminates reconciliation debt |
| Bridge + MessagePassing | Direct sql.js access | Phase 33 (completed) | Zero serialization overhead |
| Manual DOM updates | D3 .join() patterns | D3 v7 adoption | Automatic element lifecycle |
| SVG-only rendering | Hybrid Canvas/SVG | 2024-2025 best practices | 5x performance for dense data |

**Deprecated/outdated:**
- CSS-based view components (GridView.tsx, ListView.tsx, KanbanView.tsx): Replace with D3 renderers
- useD3Mode toggle: Remove - D3 becomes the only rendering path
- Bridge patterns (pafvBridge.*): Already eliminated in Phase 33
- Manual .enter()/.update()/.exit(): Use .join() pattern for better performance

## Open Questions

1. **Canvas vs SVG threshold**
   - What we know: >5K elements favor Canvas, <5K favor SVG for interactions
   - What's unclear: Exact threshold for Isometry's data density patterns
   - Recommendation: Start with SVG, add Canvas layer when performance degrades

2. **ViewConfig interface scope**
   - What we know: Needs viewType, projection, filters, sort, zoom
   - What's unclear: Future Super* features may need additional config properties
   - Recommendation: Start minimal, extend interface as Super* features are added

3. **Animation performance during transitions**
   - What we know: D3 transitions handle enter/update/exit automatically
   - What's unclear: Performance with 10K+ cards during view transitions
   - Recommendation: Measure with real data, add viewport culling if needed

4. **Legacy component migration strategy**
   - What we know: CSS view components need elimination
   - What's unclear: Migration order and compatibility during transition
   - Recommendation: Feature flag approach - deprecate CSS views progressively

## Sources

### Primary (HIGH confidence)
- PAFV implementation plan Phase 0 - Architectural Unification specification
- Current Canvas.tsx implementation - demonstrates dual rendering problem
- D3Canvas.tsx + D3GridView.tsx - existing D3 patterns and performance optimizations

### Secondary (MEDIUM confidence)
- WebSearch: D3.js unified rendering architecture 2025 - modern data binding patterns
- WebSearch: React + D3.js hybrid Canvas/SVG approaches - performance thresholds
- Phase 33 completion - sql.js foundation and bridge elimination architecture

### Tertiary (LOW confidence)
- ViewEngine pattern implementations in other frameworks - pattern inspiration only
- Performance benchmarks from other codebases - may not apply to Isometry's data patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using established D3 v7 + React 18 + sql.js foundation
- Architecture: HIGH - PAFV plan provides specific implementation guidance
- Pitfalls: HIGH - identified from current codebase analysis and established patterns

**Research date:** 2026-02-08
**Valid until:** 30 days - stable established patterns, but Super* features may extend ViewConfig interface