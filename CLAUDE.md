# Isometry - Claude Code Project Guide

## Project Overview

Isometry (formerly CardBoard) is a polymorphic data visualization platform implementing the PAFV framework with LATCH filtering and GRAPH operations.

## Architecture Philosophy: The Boring Stack

**Use proven technologies in elegant combination, not complex frameworks.**

| Layer | Technology | Purpose |
|-------|------------|---------|
| Data | SQLite + sql.js | Persistence, queries, state |
| Visualization | D3.js | All rendering, data bindingd, interaction |
| Control Chrome | React + Tailwind | Panels, forms, dropdowns |
| Drag-Drop | react-dnd | PAFV Navigator wells |
| Maps | MapLibre GL JS | Location FilterNav (v3.1) |

## Core Concepts

### PAFV: Planes → Axes → Facets → Values
- **Planes**: x/y/z coordinate system for visual rendering
- **Axes**: LATCH organizing principles (Location, Alphabet, Time, Category, Hierarchy)
- **Facets**: Concrete attributes within axes (e.g., `created_date`, `due_date` under Time)
- **Values**: Cards (both Nodes and Edges in LPG model)

**Key insight**: Any axis can map to any plane. View transitions are remappings, not rebuilds.

### LATCH vs GRAPH Duality
- **LATCH separates** (SQL WHERE, GROUP BY) → Grid, List, Kanban, Calendar
- **GRAPH joins** (SQL JOIN) → Network, Tree, Sankey

### State Management
Do NOT add Zustand/Jotai. SQLite is the state manager.

| State Type | Location | Example |
|------------|----------|---------|
| Data | SQLite | Cards, edges, facets |
| View | URL params | activeApp, activeView |
| UI | React Context | theme, panelCollapsed |
| Filters | SQLite + URL | LATCH → SQL WHERE |

## Technology Guidelines

### D3.js Patterns
```javascript
// Data binding - the core pattern
svg.selectAll('.card')
  .data(cards, d => d.id)
  .join(
    enter => enter.append('g').attr('class', 'card'),
    update => update,
    exit => exit.transition().style('opacity', 0).remove()
  );

// Scales for LATCH axes
const xScale = d3.scaleBand()
  .domain(categories)
  .range([0, width]);

// Force simulation for GRAPH views
const simulation = d3.forceSimulation(nodes)
  .force('link', d3.forceLink(edges).id(d => d.id))
  .force('charge', d3.forceManyBody())
  .force('center', d3.forceCenter(width/2, height/2));
```

### React + D3 Hybrid Pattern
```tsx
// React owns the container, D3 owns the contents
const Visualization = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    // D3 bindings here
  }, [data]);
  
  return <svg ref={svgRef} className="w-full h-full" />;
};
```

### SQLite Query Pattern
```tsx
// Custom hook for queries
const { data, loading, error } = useSQLiteQuery<Card[]>(
  'SELECT * FROM cards WHERE status = ?',
  [activeStatus]
);
```

### Theme System
Two themes: NeXTSTEP (retro) and Modern (macOS 26)
```tsx
const { theme } = useTheme();
className={theme === 'NeXTSTEP' 
  ? 'bg-[#c0c0c0] border-2 border-[#808080]' 
  : 'bg-white/80 backdrop-blur-xl rounded-lg'}
```

## File Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   ├── Toolbar.tsx      # Menu bar + toolbar
│   ├── Navigator.tsx    # App/View/Dataset selectors
│   ├── PAFVNavigator.tsx # Drag-drop axis assignment
│   ├── Sidebar.tsx      # LATCH filters
│   ├── RightSidebar.tsx # Formats + Settings
│   ├── Canvas.tsx       # Main D3 visualization
│   ├── Card.tsx         # Card rendering
│   ├── CommandBar.tsx   # DSL input
│   └── NavigatorFooter.tsx # Map + Time slider
├── contexts/
│   └── ThemeContext.tsx
├── hooks/
│   └── useSQLiteQuery.ts
├── dsl/
│   ├── parser.ts
│   └── compiler.ts
└── db/
    └── schema.sql
```

## Key References

- Architecture: `/docs/cardboard-architecture-truth.md`
- Figma Handoff: `/design/isometry-ui-handoff/FIGMA-HANDOFF.md`
- D3 Patterns: `/docs/D3JS-SKILL.md`

## Do's and Don'ts

### Do
- Use D3's `.data().join()` pattern for all data-bound rendering
- Keep React for forms, panels, dropdowns (control chrome)
- Store filter state in URL params for shareability
- Use SQLite as the source of truth
- Support both themes in all components

### Don't
- Add state management libraries (Zustand, Jotai, Redux)
- Render data cards as React components (use D3)
- Use graph databases (SQLite + D3 covers it)
- Hardcode data in components (query SQLite)
- Forget loading/error states

## Common Tasks

### Add a new LATCH filter
1. Add filter type to `Sidebar.tsx` items
2. Create filter panel component
3. Implement DSL syntax in parser
4. Add SQL compilation in compiler
5. Connect to FilterNavContext

### Add a new view type
1. Add to views list in Navigator
2. Create D3 layout function in Canvas
3. Map PAFV axes to visual properties
4. Handle view transition animations
