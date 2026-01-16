# Isometry Integration Contract

*How the pieces fit together*

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE                                  │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Toolbar   │  │  Navigator  │  │   Sidebar   │  │ RightSidebar│        │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘  └─────────────┘        │
│                          │                │                                  │
│                          ▼                ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                     PAFVNavigator                              │         │
│  │  [Available] ──drag──> [X Rows] [Y Cols] [Z Layers]           │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                          │                │                                  │
│                          ▼                ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                        Canvas                                  │         │
│  │                   (D3.js Rendering)                           │         │
│  │                                                               │         │
│  │    ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐                    │         │
│  │    │ Card │  │ Card │  │ Card │  │ Card │  ...               │         │
│  │    └──────┘  └──────┘  └──────┘  └──────┘                    │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │                    NavigatorFooter                             │         │
│  │  [Location Map] ──────────────────── [Time Slider]            │         │
│  └───────────────────────────────────────────────────────────────┘         │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────┐         │
│  │ CommandBar:  [⌘] │ status:active AND priority:>3         │    │         │
│  └───────────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STATE LAYER                                       │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │  FilterContext  │  │   PAFVContext   │  │ SelectionContext│             │
│  │                 │  │                 │  │                 │             │
│  │ location: null  │  │ xAxis: 'folder' │  │ selectedIds: [] │             │
│  │ time: 'last-wk' │  │ yAxis: 'created'│  │ lastSelected:   │             │
│  │ category: [...] │  │ zAxis: null     │  │   null          │             │
│  │ hierarchy: null │  │ available: [...] │  │                 │             │
│  │ dsl: null       │  │                 │  │                 │             │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘             │
│           │                    │                                            │
│           └────────────────────┼────────────────────────────────┐          │
│                                │                                │          │
│  ┌─────────────────────────────┴─────────────────────────────┐  │          │
│  │                      URL State                             │  │          │
│  │  ?app=notes&view=grid&folder=Work,Projects&time=last-week  │  │          │
│  └────────────────────────────────────────────────────────────┘  │          │
└──────────────────────────────────────────────────────────────────┼──────────┘
                                                                   │
                                                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            QUERY LAYER                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    compileFilters()                              │       │
│  │                                                                  │       │
│  │  FilterState ────────────────────────────────> CompiledQuery    │       │
│  │                                                                  │       │
│  │  { category: ['Work'] }  ───>  "folder IN ('Work')"             │       │
│  │  { time: 'last-week' }   ───>  "modified_at >= date('-7 days')" │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    useSQLiteQuery()                              │       │
│  │                                                                  │       │
│  │  CompiledQuery ─────────────────────────────────> Node[]        │       │
│  │                                                                  │       │
│  │  { sql: "SELECT...", params: ['Work'] }  ───>  [Node, Node,...] │       │
│  └──────────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            DATA LAYER                                        │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                         sql.js                                    │      │
│  │                    (SQLite in WebAssembly)                        │      │
│  │                                                                   │      │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │      │
│  │  │  nodes   │  │  edges   │  │  facets  │  │ settings │         │      │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘         │      │
│  │                                                                   │      │
│  │  ┌──────────────────────┐                                        │      │
│  │  │      nodes_fts       │  (Full-text search)                    │      │
│  │  └──────────────────────┘                                        │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                       IndexedDB                                   │      │
│  │                    (Persistence layer)                            │      │
│  └──────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Contracts

### 1. Filter Change Flow

```typescript
// User clicks folder checkbox in Sidebar
onFolderToggle('Work');

// ↓ Sidebar.tsx
const { setCategory } = useFilters();
setCategory({ folders: ['Work'] });

// ↓ FilterContext.tsx
dispatch({ type: 'SET_CATEGORY', payload: { folders: ['Work'] } });
// Also sync to URL:
setSearchParams({ ...params, folder: 'Work' });

// ↓ Any component using useFilters()
const { filters } = useFilters();
// filters.category = { folders: ['Work'] }

// ↓ Data-fetching component (Canvas or parent)
const query = compileFilters(filters);
// query = { sql: "...WHERE folder IN (?)", params: ['Work'] }

const { data: nodes } = useSQLiteQuery<Node>(
  `SELECT * FROM nodes WHERE ${query.sql} AND deleted_at IS NULL`,
  query.params
);

// ↓ D3 renders new data
svg.selectAll('.card')
  .data(nodes, d => d.id)
  .join(...);
```

### 2. PAFV Change Flow

```typescript
// User drags "Tags" chip to X Rows well
onDrop({ facetId: 'tags', targetWell: 'xRows' });

// ↓ PAFVNavigator.tsx
const { setXAxis, removeFromAvailable } = usePAFV();
setXAxis('tags');
removeFromAvailable('tags');

// ↓ PAFVContext.tsx
dispatch({ type: 'SET_X_AXIS', payload: 'tags' });
// Also sync to URL:
setSearchParams({ ...params, xAxis: 'tags' });

// ↓ Canvas.tsx
const { pafv } = usePAFV();
const view = getViewRenderer(activeViewType);
view.setXAxis(pafv.xAxis);  // 'tags'
view.setYAxis(pafv.yAxis);

// ↓ GridView.ts
setXAxis(facetId: string) {
  this.xFacet = getFacetById(facetId);
  this.xScale = d3.scaleBand()
    .domain(this.getUniqueValues(nodes, this.xFacet.sourceColumn))
    .range([0, width]);
}

// ↓ Re-render
view.render(container, nodes, dimensions);
```

### 3. DSL Query Flow

```typescript
// User types in CommandBar and presses Enter
onSubmit('status:active AND priority:>3');

// ↓ CommandBar.tsx
const { setDSL } = useFilters();
try {
  const ast = parse(dslString);
  const errors = validate(ast, schema);
  if (errors.length === 0) {
    setDSL(dslString);
  } else {
    showErrors(errors);
  }
} catch (parseError) {
  showParseError(parseError);
}

// ↓ FilterContext.tsx
dispatch({ type: 'SET_DSL', payload: dslString });
// When DSL is set, it overrides other filters
// Also sync to URL:
setSearchParams({ dsl: dslString });

// ↓ compileFilters()
if (filters.dsl) {
  const ast = parse(filters.dsl);
  return compileDSL(ast);  // Returns CompiledQuery
}

// ↓ useSQLiteQuery executes compiled SQL
```

### 4. View Switch Flow

```typescript
// User selects "Kanban" from Views dropdown
onViewSelect('kanban');

// ↓ Navigator.tsx
const navigate = useNavigate();
navigate(`?${new URLSearchParams({ ...params, view: 'kanban' })}`);

// ↓ Canvas.tsx (reads from URL)
const [searchParams] = useSearchParams();
const viewType = searchParams.get('view') || 'grid';

const view = useMemo(() => {
  switch (viewType) {
    case 'grid': return new GridView();
    case 'list': return new ListView();
    case 'kanban': return new KanbanView();
    default: return new GridView();
  }
}, [viewType]);

// Configure axes
view.setXAxis(pafv.xAxis);
view.setYAxis(pafv.yAxis);

// Render
useEffect(() => {
  view.render(containerRef.current, nodes, dimensions);
  return () => view.destroy();
}, [view, nodes, dimensions]);
```

---

## Context Providers

### Provider Hierarchy

```tsx
// App.tsx
<ThemeProvider>              {/* UI theme */}
  <DatabaseProvider>         {/* sql.js instance */}
    <FilterProvider>         {/* LATCH filter state */}
      <PAFVProvider>         {/* Axis assignments */}
        <SelectionProvider>  {/* Card selection */}
          <RouterProvider>   {/* URL state */}
            <Layout />
          </RouterProvider>
        </SelectionProvider>
      </PAFVProvider>
    </FilterProvider>
  </DatabaseProvider>
</ThemeProvider>
```

### Context Interfaces

```typescript
// DatabaseContext
interface DatabaseContextValue {
  db: Database | null;
  loading: boolean;
  error: Error | null;
  execute: (sql: string, params?: any[]) => any[];
}

// FilterContext
interface FilterContextValue {
  filters: FilterState;
  setLocation: (filter: LocationFilter | null) => void;
  setAlphabet: (filter: AlphabetFilter | null) => void;
  setTime: (filter: TimeFilter | null) => void;
  setCategory: (filter: CategoryFilter | null) => void;
  setHierarchy: (filter: HierarchyFilter | null) => void;
  setDSL: (dsl: string | null) => void;
  clearAll: () => void;
  activeCount: number;  // Number of active filters
}

// PAFVContext
interface PAFVContextValue {
  pafv: PAFVState;
  setXAxis: (facetId: string | null) => void;
  setYAxis: (facetId: string | null) => void;
  setZAxis: (facetId: string | null) => void;
  moveToAvailable: (facetId: string) => void;
  facets: Facet[];  // All available facets
}

// SelectionContext
interface SelectionContextValue {
  selection: SelectionState;
  select: (nodeId: string) => void;
  deselect: (nodeId: string) => void;
  toggle: (nodeId: string) => void;
  selectRange: (fromId: string, toId: string, allIds: string[]) => void;
  clear: () => void;
  isSelected: (nodeId: string) => boolean;
}
```

---

## Hook Contracts

### useSQLiteQuery

```typescript
function useSQLiteQuery<T>(
  sql: string,
  params?: any[],
  options?: {
    enabled?: boolean;       // Skip query if false
    transform?: (rows: any[]) => T[];  // Custom row transformation
  }
): {
  data: T[] | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
};

// Usage
const { data: nodes, loading } = useSQLiteQuery<Node>(
  `SELECT * FROM nodes WHERE folder = ? AND deleted_at IS NULL`,
  [selectedFolder],
  { transform: rows => rows.map(rowToNode) }
);
```

### useD3

```typescript
function useD3<T extends SVGElement>(
  renderFn: (selection: d3.Selection<T, unknown, null, undefined>) => void,
  deps: any[]
): React.RefObject<T>;

// Usage
const svgRef = useD3<SVGSVGElement>((svg) => {
  svg.selectAll('.card')
    .data(nodes, d => d.id)
    .join('rect')
    .attr('class', 'card')
    .attr('x', d => xScale(d.folder))
    .attr('y', d => yScale(d.createdAt));
}, [nodes, xScale, yScale]);

return <svg ref={svgRef} />;
```

### useFilters

```typescript
function useFilters(): FilterContextValue;

// Usage
const { filters, setCategory, setTime, clearAll, activeCount } = useFilters();

// Check active filters
if (activeCount > 0) {
  showClearButton();
}

// Set category filter
setCategory({ folders: ['Work', 'Projects'] });

// Set time filter
setTime({ type: 'preset', preset: 'last-week', field: 'modified' });
```

### usePAFV

```typescript
function usePAFV(): PAFVContextValue;

// Usage
const { pafv, setXAxis, facets } = usePAFV();

// Get current axis assignments
const xFacet = facets.find(f => f.id === pafv.xAxis);

// Update axis
setXAxis('tags');
```

---

## Component Responsibilities

| Component | Owns | Reads | Writes |
|-----------|------|-------|--------|
| **Toolbar** | Menu state | Theme | Theme |
| **Navigator** | Dropdown state | URL (app, view) | URL (app, view) |
| **PAFVNavigator** | Drag state | PAFVContext | PAFVContext |
| **Sidebar** | Tab state | FilterContext | FilterContext |
| **RightSidebar** | Tab state | Theme, Settings | Settings |
| **Canvas** | D3 instance | Filters, PAFV, Data | Selection |
| **Card** | Hover state | Node data | Selection |
| **NavigatorFooter** | Tab state | Filters (L, T) | Filters (L, T) |
| **CommandBar** | Input state | - | FilterContext (DSL) |

---

## File Organization

```
src/
├── components/
│   ├── Toolbar.tsx
│   ├── Navigator.tsx
│   ├── PAFVNavigator.tsx
│   ├── Sidebar.tsx
│   ├── RightSidebar.tsx
│   ├── Canvas.tsx           # Main D3 rendering
│   ├── Card.tsx
│   ├── NavigatorFooter.tsx
│   ├── CommandBar.tsx
│   └── ui/
│       ├── Skeleton.tsx
│       ├── EmptyState.tsx
│       └── ErrorBoundary.tsx
│
├── contexts/
│   ├── ThemeContext.tsx
│   ├── DatabaseContext.tsx
│   ├── FilterContext.tsx
│   ├── PAFVContext.tsx
│   └── SelectionContext.tsx
│
├── hooks/
│   ├── useSQLiteQuery.ts
│   ├── useD3.ts
│   ├── useFilters.ts       # Convenience wrapper
│   ├── usePAFV.ts          # Convenience wrapper
│   └── useURLState.ts
│
├── views/
│   ├── types.ts            # ViewRenderer interface
│   ├── GridView.ts
│   ├── ListView.ts
│   └── index.ts            # View registry
│
├── filters/
│   ├── compiler.ts         # FilterState → SQL
│   ├── CategoryFilter.tsx
│   ├── TimeFilter.tsx
│   └── HierarchyFilter.tsx
│
├── dsl/
│   ├── grammar/
│   │   └── IsometryDSL.pegjs
│   ├── parser.ts
│   ├── compiler.ts
│   ├── autocomplete.ts
│   └── types.ts
│
├── db/
│   ├── schema.sql
│   ├── init.ts             # sql.js initialization
│   ├── queries.ts          # Query constants
│   └── sample-data.ts
│
├── types/
│   └── index.ts            # All TypeScript interfaces
│
└── App.tsx                 # Provider hierarchy + layout
```

---

## Testing Strategy

### Unit Tests

```typescript
// Filter compiler
describe('compileFilters', () => {
  it('compiles category filter', () => {
    const filters = { category: { folders: ['Work'] } };
    const query = compileFilters(filters);
    expect(query.sql).toContain('folder IN (?)');
    expect(query.params).toEqual(['Work']);
  });
});

// DSL parser
describe('parse', () => {
  it('parses simple filter', () => {
    const ast = parse('status:active');
    expect(ast.type).toBe('filter');
    expect(ast.field).toBe('status');
  });
});

// View renderer
describe('GridView', () => {
  it('positions cards by axes', () => {
    const view = new GridView();
    view.setXAxis('folder');
    view.setYAxis('created');
    // ... test positioning
  });
});
```

### Integration Tests

```typescript
// Filter → Query → Render
describe('Filter Integration', () => {
  it('filters data and re-renders', async () => {
    render(<App />);
    
    // Initially shows all cards
    expect(screen.getAllByRole('card')).toHaveLength(100);
    
    // Apply filter
    await userEvent.click(screen.getByText('Work'));
    
    // Shows filtered cards
    await waitFor(() => {
      expect(screen.getAllByRole('card')).toHaveLength(20);
    });
  });
});
```

---

## Error Handling

### Database Errors

```typescript
// DatabaseContext.tsx
try {
  const result = db.exec(sql, params);
  return result;
} catch (error) {
  if (error.message.includes('SQLITE_ERROR')) {
    // SQL syntax error - log and report
    console.error('SQL Error:', sql, params, error);
    throw new DatabaseError('Query failed', { sql, params, cause: error });
  }
  throw error;
}
```

### Parse Errors

```typescript
// CommandBar.tsx
try {
  const ast = parse(input);
  setDSL(input);
  setError(null);
} catch (error) {
  setError({
    message: error.message,
    position: error.location?.start?.offset ?? 0,
    expected: error.expected ?? [],
  });
  // Don't update filter state
}
```

### Render Errors

```typescript
// Canvas.tsx
<ErrorBoundary
  fallback={<CanvasError onRetry={refetch} />}
  onError={(error) => console.error('Canvas render error:', error)}
>
  <CanvasContent nodes={nodes} />
</ErrorBoundary>
```

---

*This contract defines how components communicate. Follow these patterns for consistent integration.*
