# Phase 56: SuperGrid PAFV Projection - Research

**Researched:** 2026-02-10
**Domain:** D3.js grid layout with PAFV axis projection
**Confidence:** HIGH

## Summary

Phase 56 connects Navigator's PAFV axis mappings to SuperGrid's rendering engine. Currently, `usePAFV()` is called in SuperGridDemo but the result is ignored. Cards render in a flat layout regardless of X/Y axis configuration.

**Primary recommendation:** Wire PAFV state through SuperGridDemo → SuperGrid → GridRenderingEngine, computing 2D cell positions from axis facet values.

## Current State Analysis

### SuperGridDemo.tsx (line 53)
```typescript
usePAFV();  // Called but NOT USED!
```

### SuperGrid.ts
- `query(filterCompilationResult)` — No PAFV projection parameter
- `GridConfig` — No axis mapping configuration
- Cards fetched and passed to renderingEngine without position computation

### PAFV Context Interface
```typescript
interface PAFVContextValue {
  state: PAFVState;
  setMapping: (mapping: AxisMapping) => void;
  removeMapping: (plane: Plane) => void;
  // ...
}

interface PAFVState {
  mappings: AxisMapping[];
  viewMode: 'grid' | 'list';
}

interface AxisMapping {
  plane: Plane;      // 'x' | 'y' | 'color'
  axis: LATCHAxis;   // 'location' | 'alphabet' | 'time' | 'category' | 'hierarchy'
  facet: string;     // e.g., 'created_at', 'folder', 'status'
}
```

## Technical Approach

### Data Flow (Target)
```
Navigator drag-drop
    ↓
PAFVContext.setMapping({ plane: 'x', axis: 'time', facet: 'created_at' })
    ↓
SuperGridDemo reads usePAFV().state.mappings
    ↓
SuperGrid.setProjection(mappings)
    ↓
GridRenderingEngine computes positions:
    - X-axis: unique values of 'created_at' → columns
    - Y-axis: unique values of mapped facet → rows
    ↓
Cards render at (row, col) based on their facet values
```

### Position Computation Algorithm
```typescript
function computeCellPosition(card: Card, projection: PAFVProjection, headers: GridHeaders): CellPosition {
  // Get X-axis value
  const xFacet = projection.xAxis?.facet;
  const xValue = xFacet ? card[xFacet] : null;
  const col = xValue ? headers.columns.indexOf(xValue) : -1;  // -1 = unassigned

  // Get Y-axis value
  const yFacet = projection.yAxis?.facet;
  const yValue = yFacet ? card[yFacet] : null;
  const row = yValue ? headers.rows.indexOf(yValue) : -1;

  return { row, col, rowValue: yValue, colValue: xValue };
}
```

### Header Generation
```typescript
function generateHeaders(cards: Card[], projection: PAFVProjection): GridHeaders {
  // Extract unique values for X-axis
  const xFacet = projection.xAxis?.facet;
  const columns = xFacet
    ? [...new Set(cards.map(c => c[xFacet]).filter(Boolean))].sort()
    : [];

  // Extract unique values for Y-axis
  const yFacet = projection.yAxis?.facet;
  const rows = yFacet
    ? [...new Set(cards.map(c => c[yFacet]).filter(Boolean))].sort()
    : [];

  return { columns, rows };
}
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/SuperGridDemo.tsx` | Extract PAFV state, pass to SuperGrid |
| `src/d3/SuperGrid.ts` | Add `setProjection()` method |
| `src/d3/grid-rendering/GridRenderingEngine.ts` | Compute positions from projection |
| `src/types/grid.ts` | Add `PAFVProjection` and `CellPosition` types |

## Dependencies

- **usePAFV hook** — `src/hooks/data/usePAFV.ts` ✅ Working
- **PAFVContext** — `src/state/PAFVContext.tsx` ✅ Working
- **SuperGrid** — `src/d3/SuperGrid.ts` ✅ Exists, needs modification
- **GridRenderingEngine** — `src/d3/grid-rendering/GridRenderingEngine.ts` ✅ Exists

## Risks

1. **Type mismatches** — New code may create TS errors (user fixing in parallel)
2. **Facet column names** — Need to match SQLite column names exactly
3. **Null handling** — Cards missing facet values need "Unassigned" bucket
4. **Performance** — Header regeneration on every filter change

## Plan Breakdown

### 56-01: Wire PAFV State to SuperGrid
- Extract mappings from usePAFV in SuperGridDemo
- Add setProjection() to SuperGrid
- Pass projection to GridRenderingEngine

### 56-02: Position Computation
- Generate headers from unique facet values
- Compute (row, col) for each card
- Handle null/unassigned values

### 56-03: Rendering Integration
- Apply computed positions in GridRenderingEngine
- Render column and row headers
- Animate position changes

## Success Metrics

- Changing X-axis mapping reorganizes columns
- Changing Y-axis mapping reorganizes rows
- Cards with same X+Y values appear in same cell
- Animation on axis change

## Sources

- `src/components/SuperGridDemo.tsx` — Current integration point
- `src/d3/SuperGrid.ts` — Core grid implementation
- `src/hooks/data/usePAFV.ts` — PAFV hook interface
- `src/types/pafv.ts` — AxisMapping type definition
