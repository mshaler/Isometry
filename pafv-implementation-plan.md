# PAFV Proof-of-Concept: Implementation Plan

*Isometry v4 — "Any Axis Maps to Any Plane"*

---

## Mission Statement

Prove that PAFV works as an **interactive system**, not just a taxonomy document. When someone drags "Priority" onto the Y-axis and watches the grid reorganize in real-time via D3 transitions, the architecture validates itself.

**Success criteria**: A single dataset rendered through List → Grid → Kanban → Graph views, with drag-and-drop axis remapping and animated transitions between views — all driven by the same SQLite data through a unified D3 rendering pipeline.

---

## Phase 0: Architectural Unification (Foundation)

**Goal**: Eliminate the dual D3/CSS rendering split. Establish the "D3 renders, React controls" contract.

**Why first**: Every feature built on the split architecture doubles reconciliation debt. This is the Gemini feedback that matters most, and it aligns with the architecture truth doc: "SQLite stores → D3 renders → React controls."

### 0.1 — Define the Rendering Contract

```typescript
// THE CONTRACT: React never touches data DOM. D3 never owns state.

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

interface PAFVProjection {
  xAxis: FacetBinding | null;   // What's on columns
  yAxis: FacetBinding | null;   // What's on rows
  zAxis: FacetBinding | null;   // What's on depth/layers
  groupBy: FacetBinding | null; // What splits into sub-grids
}

interface FacetBinding {
  facetId: string;       // e.g., 'status', 'priority', 'created_at'
  axis: 'L'|'A'|'T'|'C'|'H';  // Which LATCH axis it belongs to
  facetType: 'text' | 'number' | 'date' | 'select' | 'multi_select';
}
```

### 0.2 — Refactor Canvas Component

**Current state**: Canvas has CSS-based views alongside D3 views, creating the dual rendering problem.

**Target state**: Canvas becomes a thin React shell that:
1. Owns a `<div ref={containerRef}>` that D3 renders into
2. Passes `ViewConfig` changes to the D3 engine
3. Receives user interaction events back from D3 (card click, drag, etc.)
4. Never creates data DOM elements itself

```typescript
// Canvas.tsx — THE REACT SHELL
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

### 0.3 — Deprecate CSS View Implementations

Identify every component that renders data elements via React/CSS and mark for replacement:

| Component | Current | Target |
|-----------|---------|--------|
| Grid cells | CSS Grid layout | D3 positioned `<div>` elements |
| Kanban columns | React flex containers | D3 grouped layout |
| List rows | React `<li>` mapping | D3 enter/update/exit |
| Card rendering | React JSX | D3 `.join()` with HTML template |
| Headers | React components | D3 sticky headers (SuperStack pattern) |

**Critical principle**: Don't rewrite everything at once. Create the D3 engine, wire it to Canvas, then migrate one view type at a time. Start with Grid (your most complex LATCH view) — if Grid works in pure D3, everything simpler inherits the pattern.

### Phase 0 Verification Gate

- [ ] `Canvas.tsx` contains zero data-rendering JSX (only the container div)
- [ ] `IsometryViewEngine` class exists with `render()` and `transition()` methods
- [ ] Grid view renders via D3 with enter/update/exit animations
- [ ] Card click events propagate from D3 back to React
- [ ] No visual regression from current UI

---

## Phase 1: Wire Navigator to Facets Table (Dynamic LATCH)

**Goal**: The Navigator's axes and facets come from the database, not hardcoded arrays.

**Why second**: This is the data pipeline that feeds everything. Hardcoded options mean PAFV is a lie — the axes aren't actually dynamic.

### 1.1 — Facets Query Hook

```typescript
// useFacets.ts — queries the facets table from SQLite schema
function useFacets() {
  const db = useDatabase();
  
  const facets = useMemo(() => {
    // Query from the facets table defined in schema-v1.sql
    const rows = db.exec(`
      SELECT id, name, facet_type, axis, source_column, options, icon, color
      FROM facets 
      WHERE enabled = 1 
      ORDER BY axis, sort_order
    `);
    return parseFacetRows(rows);
  }, [db]);

  // Group by LATCH axis
  const byAxis = useMemo(() => ({
    L: facets.filter(f => f.axis === 'L'),  // Location facets
    A: facets.filter(f => f.axis === 'A'),  // Alphabet facets  
    T: facets.filter(f => f.axis === 'T'),  // Time facets
    C: facets.filter(f => f.axis === 'C'),  // Category facets
    H: facets.filter(f => f.axis === 'H'),  // Hierarchy facets
  }), [facets]);

  return { facets, byAxis };
}
```

### 1.2 — PAFV State Manager

```typescript
// usePAFV.ts — manages which facets are bound to which planes
interface PAFVState {
  projection: PAFVProjection;
  availableFacets: Facet[];
  boundFacets: Map<string, 'x' | 'y' | 'z' | 'group'>;
}

function usePAFV() {
  const { facets, byAxis } = useFacets();
  const [projection, setProjection] = useState<PAFVProjection>({
    xAxis: null,
    yAxis: null, 
    zAxis: null,
    groupBy: null,
  });

  // Bind a facet to a plane
  const bindAxis = useCallback((facetId: string, plane: 'x' | 'y' | 'z' | 'group') => {
    const facet = facets.find(f => f.id === facetId);
    if (!facet) return;
    
    setProjection(prev => ({
      ...prev,
      [`${plane}Axis`]: { facetId, axis: facet.axis, facetType: facet.facetType },
    }));
  }, [facets]);

  // Unbind a plane
  const unbindAxis = useCallback((plane: 'x' | 'y' | 'z' | 'group') => {
    setProjection(prev => ({ ...prev, [`${plane}Axis`]: null }));
  }, []);

  // Swap two planes (e.g., drag x-axis facet to y-axis)
  const swapAxes = useCallback((planeA: string, planeB: string) => {
    setProjection(prev => ({
      ...prev,
      [`${planeA}Axis`]: prev[`${planeB}Axis`],
      [`${planeB}Axis`]: prev[`${planeA}Axis`],
    }));
  }, []);

  // Get unbound facets (available for assignment)
  const unboundFacets = useMemo(() => {
    const bound = new Set([
      projection.xAxis?.facetId,
      projection.yAxis?.facetId,
      projection.zAxis?.facetId,
      projection.groupBy?.facetId,
    ].filter(Boolean));
    return facets.filter(f => !bound.has(f.id));
  }, [facets, projection]);

  return { projection, bindAxis, unbindAxis, swapAxes, unboundFacets, byAxis };
}
```

### 1.3 — Navigator Renders from Database

Replace hardcoded Navigator options with facets from the database:

```typescript
// Navigator.tsx — now data-driven
function Navigator() {
  const { projection, bindAxis, unboundFacets, byAxis } = usePAFV();

  return (
    <div className="navigator">
      {/* Active projection display */}
      <ProjectionBadge projection={projection} />
      
      {/* Plane drop targets */}
      <PlaneSlot plane="x" binding={projection.xAxis} onDrop={bindAxis} />
      <PlaneSlot plane="y" binding={projection.yAxis} onDrop={bindAxis} />
      <PlaneSlot plane="z" binding={projection.zAxis} onDrop={bindAxis} />
      
      {/* Available facets (draggable chips) */}
      <FacetPalette facets={unboundFacets} byAxis={byAxis} />
    </div>
  );
}
```

### 1.4 — Filter Changes Trigger Re-Query

Complete the data flow loop: filter change → SQL re-query → D3 re-render.

```typescript
// useFilteredData.ts — the complete pipeline
function useFilteredData() {
  const db = useDatabase();
  const { filters } = useFilters();
  const { projection } = usePAFV();

  return useMemo(() => {
    // Build SQL from active filters (LATCH separation)
    const { sql, params } = compileLATCHQuery(filters, projection);
    
    // Execute against SQLite
    const rows = db.exec(sql, params);
    
    // Transform for D3 consumption
    return rows.map(row => ({
      ...row,
      // Pre-compute LATCH coordinates for D3 scales
      latchCoords: extractLATCHCoords(row, projection),
    }));
  }, [db, filters, projection]);
}

function compileLATCHQuery(
  filters: LATCHFilter[], 
  projection: PAFVProjection
): { sql: string; params: any[] } {
  let sql = 'SELECT * FROM nodes WHERE deleted_at IS NULL';
  const params: any[] = [];

  for (const filter of filters) {
    switch (filter.type) {
      case 'category':
        if (filter.folders?.length) {
          sql += ` AND folder IN (${filter.folders.map(() => '?').join(',')})`;
          params.push(...filter.folders);
        }
        break;
      case 'time':
        if (filter.after) {
          sql += ` AND ${filter.column} >= ?`;
          params.push(filter.after);
        }
        break;
      case 'hierarchy':
        if (filter.minPriority != null) {
          sql += ` AND priority >= ?`;
          params.push(filter.minPriority);
        }
        break;
    }
  }

  // Add ordering based on active projection
  if (projection.yAxis) {
    sql += ` ORDER BY ${projection.yAxis.facetId}`;
  }

  return { sql, params };
}
```

### Phase 1 Verification Gate

- [ ] Navigator shows facets from `facets` table, not hardcoded arrays
- [ ] Changing a filter in Sidebar triggers SQL re-query
- [ ] Re-query results flow to D3 engine and re-render
- [ ] Adding a new facet to the `facets` table automatically appears in Navigator
- [ ] PAFV badge correctly shows current axis→plane bindings

---

## Phase 2: SuperGrid as Default Grid (Progressive Disclosure)

**Goal**: SuperGrid features are the grid, not an optional toggle. Features appear progressively as users need them.

**Why third**: With unified rendering (Phase 0) and dynamic facets (Phase 1), SuperGrid becomes the natural expression of PAFV — not a separate mode.

### 2.1 — Merge SuperGrid into Grid View

The "Grid" view IS SuperGrid. There's no toggle.

```typescript
// IsometryViewEngine — Grid rendering is always SuperGrid
class IsometryViewEngine {
  private renderers: Map<ViewType, ViewRenderer> = new Map([
    ['list', new ListRenderer()],
    ['grid', new SuperGridRenderer()],  // NOT "BasicGridRenderer" — SuperGrid IS grid
    ['kanban', new KanbanRenderer()],
    ['graph', new GraphRenderer()],
  ]);

  render(data: Card[], config: ViewConfig) {
    const renderer = this.renderers.get(config.viewType);
    renderer?.render(this.container, data, config);
  }
}
```

### 2.2 — Progressive Feature Disclosure

SuperGrid features appear based on context, not toggles:

| Feature | Appears When | How |
|---------|-------------|-----|
| **SuperZoom** | Always | Mouse wheel / pinch → semantic zoom (cards ↔ cells ↔ dots) |
| **SuperDensity** | >50 cards visible | Automatic density adjustment, manual slider appears |
| **SuperStack** | Y-axis bound | Sticky headers for row groups |
| **SuperSort** | Column header hover | Sort affordance appears on hover |
| **SuperFilter** | Column header click | Inline filter dropdown |
| **SuperSelect** | Card click/drag | Multi-select with z-axis awareness |
| **SuperCalc** | Footer area | Aggregation row (count, sum, avg) |
| **SuperSize** | Column edge hover | Resize cursor on column/row boundaries |

### 2.3 — SuperZoom Implementation (Cartographic Navigation)

```typescript
// SuperZoom — semantic zoom levels within D3
class SuperZoomController {
  private zoomBehavior: d3.ZoomBehavior<Element, unknown>;
  
  constructor(container: d3.Selection<SVGElement, unknown, null, undefined>) {
    this.zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => this.handleZoom(event));
    
    container.call(this.zoomBehavior);
  }

  private handleZoom(event: d3.D3ZoomEvent<Element, unknown>) {
    const scale = event.transform.k;
    
    // Semantic zoom levels — not just magnification
    if (scale < 0.3) {
      this.renderDotMode(event.transform);      // Dots — see patterns
    } else if (scale < 0.7) {
      this.renderCellMode(event.transform);     // Cells — see groupings
    } else if (scale < 1.5) {
      this.renderCardMode(event.transform);     // Cards — see content
    } else {
      this.renderDetailMode(event.transform);   // Detail — full card view
    }
  }
}
```

### Phase 2 Verification Gate

- [ ] Grid view renders via SuperGridRenderer (no separate toggle)
- [ ] Mouse wheel zooms semantically (dots → cells → cards → detail)
- [ ] Sticky headers appear when Y-axis is bound to a categorical facet
- [ ] Column resize works via drag on column boundaries
- [ ] No "Enable SuperGrid" button exists anywhere in UI

---

## Phase 3: Drag-and-Drop Axis Assignment (The Demo Moment)

**Goal**: Drag a facet chip onto a plane slot and watch the view reorganize with animated D3 transitions.

**Why fourth**: This is the capstone — the visceral proof that "any axis maps to any plane." Phases 0-2 build the infrastructure; Phase 3 makes it interactive.

### 3.1 — Draggable Facet Chips

```typescript
// FacetChip — draggable D3 element
function renderFacetChips(
  container: d3.Selection<HTMLElement, unknown, null, undefined>,
  facets: Facet[],
  onDragStart: (facet: Facet) => void
) {
  const chips = container.selectAll('.facet-chip')
    .data(facets, (d: Facet) => d.id)
    .join('div')
      .attr('class', d => `facet-chip axis-${d.axis}`)
      .attr('draggable', 'true')
      .text(d => d.name);

  // D3 drag behavior
  const drag = d3.drag<HTMLDivElement, Facet>()
    .on('start', (event, d) => {
      d3.select(event.sourceEvent.target).classed('dragging', true);
      onDragStart(d);
    })
    .on('drag', (event, d) => {
      // Visual feedback: ghost chip follows cursor
    })
    .on('end', (event, d) => {
      d3.select(event.sourceEvent.target).classed('dragging', false);
    });

  chips.call(drag);
}
```

### 3.2 — Plane Drop Targets

```typescript
// PlaneSlot — drop target for facet assignment
function renderPlaneSlots(
  container: d3.Selection<HTMLElement, unknown, null, undefined>,
  projection: PAFVProjection,
  onDrop: (facetId: string, plane: string) => void
) {
  const planes = [
    { id: 'x', label: 'Columns (X)', binding: projection.xAxis },
    { id: 'y', label: 'Rows (Y)', binding: projection.yAxis },
    { id: 'z', label: 'Layers (Z)', binding: projection.zAxis },
  ];

  const slots = container.selectAll('.plane-slot')
    .data(planes, d => d.id)
    .join('div')
      .attr('class', d => `plane-slot ${d.binding ? 'bound' : 'empty'}`)
      .on('dragover', (event) => {
        event.preventDefault();
        d3.select(event.currentTarget).classed('drag-over', true);
      })
      .on('dragleave', (event) => {
        d3.select(event.currentTarget).classed('drag-over', false);
      })
      .on('drop', (event, d) => {
        event.preventDefault();
        const facetId = event.dataTransfer.getData('facetId');
        onDrop(facetId, d.id);
        d3.select(event.currentTarget).classed('drag-over', false);
      });

  // Show current binding or "Drop facet here"
  slots.html(d => d.binding 
    ? `<span class="binding">${d.binding.facetId}</span> → ${d.label}`
    : `<span class="empty-label">${d.label}</span>`
  );
}
```

### 3.3 — Animated View Transitions

The key animation: when axis assignment changes, cards animate from old positions to new positions.

```typescript
// IsometryViewEngine.transition()
class IsometryViewEngine {
  transition(fromConfig: ViewConfig, toConfig: ViewConfig, duration = 750) {
    const cards = this.container.selectAll('.card');
    
    // Calculate new positions based on new projection
    const newPositions = this.computeLayout(this.currentData, toConfig);
    
    // Animate cards to new positions
    cards.transition()
      .duration(duration)
      .ease(d3.easeCubicInOut)
      .style('transform', (d: Card) => {
        const pos = newPositions.get(d.id);
        return `translate(${pos.x}px, ${pos.y}px)`;
      })
      .style('width', (d: Card) => `${newPositions.get(d.id).width}px`)
      .style('height', (d: Card) => `${newPositions.get(d.id).height}px`);

    // Handle enter/exit for cards that appear/disappear due to filtering
    const entering = cards.enter()
      .append('div')
      .attr('class', 'card')
      .style('opacity', 0)
      .transition()
      .duration(duration)
      .style('opacity', 1);

    cards.exit()
      .transition()
      .duration(duration)
      .style('opacity', 0)
      .remove();
  }

  private computeLayout(data: Card[], config: ViewConfig): Map<string, Position> {
    switch (config.viewType) {
      case 'list':
        return this.computeListLayout(data, config);
      case 'grid':
        return this.computeGridLayout(data, config);  // Uses PAFV projection
      case 'kanban':
        return this.computeKanbanLayout(data, config);
      case 'graph':
        return this.computeForceLayout(data, config);
    }
  }
}
```

### 3.4 — The PAFV Badge (Live Projection Display)

Always visible, showing current state:

```
┌─────────────────────────┐
│  x: status (Category)   │
│  y: priority (Hierarchy) │
│  z: — (none)            │
│                         │
│  Cards: 40 │ View: Grid │
│  Dimensions: 2/5        │
└─────────────────────────┘
```

### Phase 3 Verification Gate

- [ ] Facet chips are draggable from the palette
- [ ] Dropping a facet on a plane slot triggers axis binding
- [ ] Axis binding change triggers animated card repositioning
- [ ] Swapping axes (drag x-bound facet to y-slot) works with animation
- [ ] Removing a facet from a plane (drag off) collapses that dimension
- [ ] PAFV badge updates in real-time as bindings change
- [ ] View type switch (grid → kanban) animates card positions

---

## Phase 4: Dimensional Progression Demo (Validation)

**Goal**: Automated animated showcase: List → Gallery → Tree → Kanban → Grid → SuperGrid → Charts → Graph, all on the same 40-card dataset.

This phase is the **proof** that Phases 0-3 work. If the progression demo runs smoothly, PAFV is validated as an interactive system.

### 4.1 — Demo Dataset

40 cards spanning all LATCH dimensions:

```sql
-- Sample data covering all LATCH axes
INSERT INTO nodes (id, node_type, name, folder, status, priority, created_at, due_at) VALUES
  -- 10 tasks across 4 projects, 3 statuses, 5 priority levels
  ('t01', 'task', 'Design landing page', 'Website', 'active', 5, '2026-01-01', '2026-02-15'),
  ('t02', 'task', 'Write API docs', 'Backend', 'pending', 3, '2026-01-05', '2026-02-20'),
  -- ... 38 more spanning the full LATCH space
```

### 4.2 — Progression Script

```typescript
// DimensionalProgression.ts
const PROGRESSION: ProgressionStep[] = [
  {
    view: 'list',
    projection: { yAxis: { facetId: 'created_at', axis: 'T' } },
    narration: '40 tasks. One dimension: time.',
    duration: 3000,
  },
  {
    view: 'grid',
    projection: { 
      xAxis: { facetId: 'status', axis: 'C' },
      yAxis: { facetId: 'priority', axis: 'H' },
    },
    narration: 'Priority meets status. Two axes, fully mapped.',
    duration: 4000,
  },
  {
    view: 'grid',
    projection: {
      xAxis: { facetId: 'status', axis: 'C' },
      yAxis: { facetId: 'priority', axis: 'H' },
      groupBy: { facetId: 'folder', axis: 'C' },
    },
    narration: 'Facet by project. Three grids. Same data, three lenses.',
    duration: 4000,
  },
  {
    view: 'graph',
    projection: {},  // Graph uses edges, not LATCH projection
    narration: 'Every dependency, every connection. The network was always there.',
    duration: 5000,
  },
];

async function runProgression(engine: IsometryViewEngine) {
  for (const step of PROGRESSION) {
    // Update narration text
    updateNarration(step.narration);
    
    // Animate transition
    engine.transition(currentConfig, {
      viewType: step.view,
      projection: step.projection,
    }, 750);
    
    // Wait for viewing
    await delay(step.duration);
  }
}
```

### Phase 4 Verification Gate

- [ ] Automated progression runs without errors
- [ ] Each transition animates smoothly (cards move, don't teleport)
- [ ] Same 40 cards visible across all 8 views
- [ ] PAFV badge updates at each step
- [ ] After progression, user can interact (drag axes, switch views)
- [ ] The demo is compelling enough to show someone unfamiliar with the project

---

## Execution Strategy

### Sprint Structure

| Sprint | Phase | Duration | Focus |
|--------|-------|----------|-------|
| **Sprint 1** | Phase 0 | 1 week | Rendering contract, Canvas refactor, Grid in D3 |
| **Sprint 2** | Phase 1 | 1 week | Facets hook, PAFV state, Navigator wiring |
| **Sprint 3** | Phase 2 | 1 week | SuperGrid as default, SuperZoom, progressive disclosure |
| **Sprint 4** | Phase 3 | 1 week | Drag-and-drop, transitions, PAFV badge |
| **Sprint 5** | Phase 4 | 3-4 days | Demo dataset, progression script, polish |

### GSD Verification Pattern

Each phase follows the established GSD pattern:

1. **Plan** — Define exactly what changes (this document)
2. **Execute** — Claude Code implements against the plan
3. **Verify** — Run the verification gate checklist
4. **Commit** — Git commit with phase tag
5. **Document** — Update CLAUDE.md with new patterns

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| D3 rendering breaks existing CSS layout | Keep CSS views behind feature flag until D3 equivalent proven |
| sql.js query performance for live filtering | Pre-compute common filter combinations, cache in memory |
| Drag-and-drop complexity | Use HTML5 drag API first, upgrade to D3 drag only if needed |
| Animation jank during transitions | Measure FPS, degrade gracefully (reduce card count at low zoom) |
| Scope creep into Super* features | Only implement features that serve the dimensional progression demo |

### What We're NOT Building (Yet)

To stay focused, these are explicitly deferred:

- ❌ SuperCalc (formula/aggregation row)
- ❌ SuperAudit (change tracking overlay)
- ❌ SuperTime (timeline view)
- ❌ SuperSearch (FTS-powered search within grid)
- ❌ Formula Bar
- ❌ Notebook / WYSIWYG editor
- ❌ CloudKit sync
- ❌ Native Swift bridge
- ❌ Multi-user collaboration

These are all valid features but they don't prove PAFV. The demo does.

---

## Architecture Alignment Check

| Principle | How This Plan Honors It |
|-----------|------------------------|
| **LATCH separates, GRAPH joins** | Navigator drives LATCH filters → SQL WHERE/GROUP BY; Graph view uses edges |
| **Edges are Cards** | Graph view renders edges with same Card component |
| **Any axis maps to any plane** | Drag-and-drop axis binding is the core interaction |
| **Scale-appropriate** | SQLite filters at data layer, D3 renders filtered subset |
| **Boring stack wins** | SQLite + D3.js + React shell. No new dependencies. |
| **D3 renders, React controls** | Phase 0 establishes this contract, all phases follow it |

---

## The Deliverable

At the end of Sprint 5, Isometry has:

1. **A working PAFV engine** that maps any LATCH axis to any spatial plane
2. **A drag-and-drop Navigator** that lets users configure their view by direct manipulation
3. **Animated view transitions** that prove the data doesn't change — only the projection
4. **A compelling demo** that shows the same 40 cards in 8 different views
5. **A unified rendering architecture** ready for further feature development

This is the proof of concept. Everything after this is scale and polish.

---

*Document Version: 1.0*
*Created: February 2026*
*For: Claude Code execution via GSD methodology*
