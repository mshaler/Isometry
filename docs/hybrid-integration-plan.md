# Hybrid Integration Plan: CardBoard Components + Isometry

*January 2026*

Integrates CardBoard's D3 component patterns into Isometry while preserving React control chrome and react-dnd functionality.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Shell                              │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │  Navigator   │  │   Toolbar    │  │       Sidebar          │ │
│  │  (React)     │  │   (React)    │  │       (React)          │ │
│  │  react-dnd   │  │   Tailwind   │  │       Tailwind         │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                     Canvas.tsx (React Wrapper)               ││
│  │  ┌─────────────────────────────────────────────────────────┐││
│  │  │                   cb-canvas (D3)                        │││
│  │  │                                                         │││
│  │  │   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │││
│  │  │   │ cb-card │ │ cb-card │ │ cb-card │ │ cb-card │      │││
│  │  │   │  (D3)   │ │  (D3)   │ │  (D3)   │ │  (D3)   │      │││
│  │  │   └─────────┘ └─────────┘ └─────────┘ └─────────┘      │││
│  │  │                                                         │││
│  │  └─────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

**Boundary Rule**: React owns layout/chrome, D3 owns visualization rendering.

---

## Phase 1: Foundation Merge

### 1.1 Factory Utilities

**Goal**: Add CardBoard's component factory utilities to existing D3 hooks.

**File**: `src/d3/factory.ts` (NEW)

Copy and adapt from CardBoard:
- `createAccessor()` / `createAccessors()` - Fluent API pattern
- `generateInstanceId()` - Unique component IDs
- `cx()` - BEM class name builder
- `keyById()` - D3 data join key function
- `debounce()` / `throttle()` - Performance utilities
- Icon SVG utilities

**Changes to existing**:
- Update `src/d3/index.ts` to export factory utilities
- Merge transition utilities (CardBoard's are more comprehensive)

### 1.2 Type Alignment

**Goal**: Align Isometry's Node type with CardBoard's LPG model.

**File**: `src/types/lpg.ts` (NEW)

```typescript
// LATCH coordinates for spatial/temporal/categorical positioning
export interface LATCHCoordinates {
  location?: string | [number, number];
  alphabet?: string;
  time?: Date | string;
  category?: string | string[];
  hierarchy?: number;
}

// Graph edge types (GRAPH joins, LATCH separates)
export type GraphEdgeType = 'LINK' | 'NEST' | 'SEQUENCE' | 'AFFINITY';

// Node types
export type NodeType = 'Task' | 'Note' | 'Person' | 'Project' | 'Event' | 'Resource' | 'Custom';

// LPG Value types (both Nodes and Edges are "Values")
export interface NodeValue extends BaseValue {
  type: 'node';
  nodeType: NodeType;
  name: string;
  content?: string;
  latch: LATCHCoordinates;
  properties: Record<string, unknown>;
}

export interface EdgeValue extends BaseValue {
  type: 'edge';
  edgeType: GraphEdgeType;
  sourceId: string;
  targetId: string;
  label?: string;
  weight?: number;
  directed: boolean;
  latch: LATCHCoordinates;
  properties: Record<string, unknown>;
}

export type CardValue = NodeValue | EdgeValue;
```

**Migration**: Create adapter functions to convert existing `Node` to `NodeValue`.

### 1.3 CSS Variables Integration

**Goal**: Generate CSS custom properties from existing theme system.

**Option A - Generate CSS vars from themes.ts**:

**File**: `src/styles/variables.css` (NEW)

```css
:root {
  /* Generated from MODERN theme */
  --cb-bg-base: #f5f5f7;
  --cb-bg-raised: #ffffff;
  --cb-fg-primary: #1d1d1f;
  /* ... */
}

[data-theme="NeXTSTEP"] {
  /* Generated from NEXTSTEP theme */
  --cb-bg-base: #c0c0c0;
  --cb-bg-raised: #d4d4d4;
  --cb-fg-primary: #404040;
  /* ... */
}
```

**Option B - Consume CSS vars in themes.ts**:

Update `getTheme()` to return CSS variable references that CardBoard components can use.

**Recommendation**: Option A - keep systems separate but aligned.

---

## Phase 2: cb-card Integration

### 2.1 CardBoard Card Component

**Goal**: Add cb-card for D3-rendered cards in visualizations.

**File**: `src/d3/components/cb-card.ts` (NEW)

Adapt from CardBoard with Isometry-specific modifications:
- Support both NeXTSTEP and Modern themes via CSS vars
- Integrate with existing event patterns
- Support both Node and CardValue data shapes

### 2.2 Card Variants

| Variant | Use Case | Visual |
|---------|----------|--------|
| `default` | Standard card | Solid background |
| `glass` | Modern theme | Blur + transparency |
| `elevated` | Emphasis | Shadow lift |
| `outline` | Minimal | Border only |

### 2.3 Integration Points

**File**: `src/components/views/GridView.tsx`

```tsx
// Before: Manual D3 card rendering
g.selectAll('.card')
  .data(data)
  .join('g')
  .attr('class', 'card')
  // ... lots of manual DOM construction

// After: Use cb-card
const card = cbCard()
  .variant(theme === 'NeXTSTEP' ? 'default' : 'glass')
  .interactive(true)
  .on('click', (e) => onNodeClick?.(data.find(d => d.id === e.data.id)));

g.selectAll('.card-wrapper')
  .data(data, d => d.id)
  .join('g')
  .attr('class', 'card-wrapper')
  .call(card);
```

---

## Phase 3: cb-canvas Integration

### 3.1 Canvas Component

**Goal**: Replace manual SVG setup with cb-canvas.

**File**: `src/d3/components/cb-canvas.ts` (NEW)

Features to adopt:
- Auto-sizing with ResizeObserver
- Zoom/pan behavior
- Background patterns (dots, grid, solid)
- Content/overlay layers
- Dimension computation

### 3.2 View Wrapper Pattern

**File**: `src/components/views/D3ViewWrapper.tsx` (NEW)

React wrapper that bridges to cb-canvas:

```tsx
export function D3ViewWrapper<T>({
  data,
  viewType,
  projection,
  renderContent,
  onNodeClick,
}: D3ViewWrapperProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const canvasRef = useRef<CbCanvas | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize canvas once
    if (!canvasRef.current) {
      canvasRef.current = cbCanvas()
        .viewType(viewType)
        .projection(projection)
        .zoomable(true)
        .background('dots');
    }

    // Render canvas
    d3.select(containerRef.current)
      .datum(data)
      .call(canvasRef.current);

    // Render content into canvas
    const contentArea = canvasRef.current.getContentArea();
    if (contentArea) {
      renderContent(contentArea, data, canvasRef.current.getDimensions());
    }

    return () => canvasRef.current?.destroy();
  }, [data, viewType, projection]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

---

## Phase 4: LATCH Scale Integration

### 4.1 Scale Factories

**Goal**: Add PAFV-aware scale factories for axis projections.

**File**: `src/d3/scales.ts` (NEW)

```typescript
// Create scale for any LATCH axis
export function createLATCHScale(
  axis: LATCHAxis,
  data: CardValue[],
  range: [number, number],
  options?: ScaleOptions
): LATCHScale;

// Individual scale factories
export function createCategoryScale(data, range, padding);
export function createTimeScale(data, range, facet);
export function createHierarchyScale(data, range);
export function createAlphabetScale(data, range, padding);
export function createLocationScale(data, range);

// Get value from data for a given axis
export function getLATCHValue(card: CardValue, axis: LATCHAxis);
```

### 4.2 Integration with PAFV Navigator

Connect scale factories to the existing PAFVNavigator well assignments:

```typescript
// In view rendering
const { xAxis, yAxis } = usePAFV(); // From context

const xScale = createLATCHScale(xAxis, data, [0, innerWidth]);
const yScale = createLATCHScale(yAxis, data, [0, innerHeight]);

// Position cards
cards.attr('transform', d => {
  const x = xScale(getLATCHValue(d, xAxis));
  const y = yScale(getLATCHValue(d, yAxis));
  return `translate(${x}, ${y})`;
});
```

---

## Phase 5: View Migration

### 5.1 Migration Order

| Priority | View | Complexity | Notes |
|----------|------|------------|-------|
| 1 | GridView | Low | Good test case |
| 2 | KanbanView | Medium | Column grouping |
| 3 | ListView | Low | Already uses tableTheme |
| 4 | ChartsView | Medium | Multiple chart types |
| 5 | CalendarView | Medium | Time axis focus |
| 6 | TimelineView | Medium | Time axis focus |
| 7 | NetworkView | High | Force simulation |
| 8 | TreeView | High | Hierarchy layout |

### 5.2 Per-View Changes

Each view migration involves:

1. Replace manual SVG setup with cb-canvas
2. Replace card rendering with cb-card
3. Use LATCH scales for positioning
4. Update event handlers to use CardBoard event pattern
5. Remove inline theme ternaries (use CSS vars)

---

## File Structure After Integration

```
src/
├── d3/
│   ├── index.ts              # Barrel exports
│   ├── hooks.ts              # Existing D3 hooks (updated)
│   ├── factory.ts            # NEW: Component factory utilities
│   ├── scales.ts             # NEW: LATCH scale factories
│   ├── D3View.tsx            # Existing wrapper (kept)
│   └── components/
│       ├── index.ts          # Component exports
│       ├── cb-card.ts        # NEW: Card component
│       ├── cb-canvas.ts      # NEW: Canvas component
│       └── cb-badge.ts       # NEW: Badge component
├── types/
│   ├── node.ts               # Existing (kept for compat)
│   └── lpg.ts                # NEW: LPG types + adapters
├── styles/
│   ├── themes.ts             # Existing (updated to export CSS vars)
│   ├── variables.css         # NEW: CSS custom properties
│   └── cb-components.css     # NEW: CardBoard component styles
└── components/
    └── views/
        ├── D3ViewWrapper.tsx # NEW: React-D3 bridge
        ├── GridView.tsx      # Updated to use cb-card
        └── ...               # Other views updated
```

---

## Implementation Checklist

### Phase 1: Foundation (Day 1-2)
- [ ] Create `src/d3/factory.ts` with utilities from CardBoard
- [ ] Create `src/types/lpg.ts` with LPG types
- [ ] Create adapter: `nodeToCardValue(node: Node): NodeValue`
- [ ] Create `src/styles/variables.css` with CSS custom properties
- [ ] Update `src/d3/index.ts` exports
- [ ] Verify build succeeds

### Phase 2: cb-card (Day 3-4)
- [ ] Create `src/d3/components/cb-card.ts`
- [ ] Create `src/styles/cb-components.css` (card styles)
- [ ] Add cb-card tests
- [ ] Integrate into GridView as proof-of-concept
- [ ] Verify card rendering works with both themes

### Phase 3: cb-canvas (Day 5-6)
- [ ] Create `src/d3/components/cb-canvas.ts`
- [ ] Add canvas styles to cb-components.css
- [ ] Create `src/components/views/D3ViewWrapper.tsx`
- [ ] Update GridView to use D3ViewWrapper + cb-canvas
- [ ] Test zoom/pan functionality

### Phase 4: LATCH Scales (Day 7)
- [ ] Create `src/d3/scales.ts`
- [ ] Connect scales to PAFVContext
- [ ] Update GridView to use LATCH scales
- [ ] Test axis remapping via PAFV Navigator

### Phase 5: View Migration (Day 8-12)
- [ ] Migrate KanbanView
- [ ] Migrate ListView
- [ ] Migrate ChartsView
- [ ] Migrate CalendarView
- [ ] Migrate TimelineView
- [ ] Migrate NetworkView
- [ ] Migrate TreeView

### Final
- [ ] Remove deprecated code
- [ ] Update documentation
- [ ] Full test pass
- [ ] Commit and push

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Theme inconsistency | Test both themes after each change |
| Event handling breaks | Keep React event bridge for click callbacks |
| Performance regression | Profile before/after on large datasets |
| react-dnd conflict | Keep react-dnd for Navigator, use D3 drag only in canvas |
| Type mismatches | Use adapters during transition |

---

## Success Criteria

1. **Visual parity**: All views render identically before/after
2. **Theme support**: Both NeXTSTEP and Modern work correctly
3. **Interactions**: Click, hover, drag all function
4. **Performance**: No regression on 1000+ card datasets
5. **Code quality**: Reduced duplication, clearer separation
6. **Build**: No TypeScript errors, clean lint

---

## What We're NOT Doing

- ❌ Replacing React chrome (Navigator, Sidebar, Toolbar)
- ❌ Replacing react-dnd with D3 drag for well assignments
- ❌ Migrating to pure CardBoard package structure
- ❌ Removing Tailwind from control chrome
- ❌ Breaking existing functionality

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Foundation Merge
3. Iterate through phases with build verification after each
4. Commit after each completed phase
