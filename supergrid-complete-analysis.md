# SuperGrid Architecture - Complete Analysis

## TLDR: The System IS Wired Correctly

After deep-diving through the codebase, I found that:

1. **`SuperGrid.ts`** DOES use `GridRenderingEngine.ts` (line 20)
2. **Projection IS passed** via `renderingEngine.setProjection()` (line ~317)
3. **Stacked headers ARE supported** in `GridRenderingEngine.ts` (lines 281, 333, 872)
4. **PAFV → SuperGrid sync IS working** via `IntegratedLayout.tsx` (line 319)

The architecture is **NOT broken** - there's a different issue.

---

## Complete Data Flow (Verified)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. User drags facet to X/Y plane in PafvNavigator                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. usePAFV hook updates pafvState.mappings                                  │
│    File: src/hooks/usePAFV.ts                                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. IntegratedLayout.tsx useEffect detects change (line 319)                 │
│    Calls: mappingsToProjection(pafvState.mappings)                          │
│    Then:  superGrid.setProjection(projection)                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SuperGrid.setProjection() (line ~305)                                    │
│    - Stores projection                                                      │
│    - Calls updateModulesWithData()                                          │
│    - Calls renderingEngine.setProjection(projection)                        │
│    - Calls render()                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. GridRenderingEngine.render() (line ~480)                                 │
│    - Checks if projection exists                                            │
│    - If yes: calls computeAllPositions() → renderProjectionHeaders()        │
│    - computeAllPositions checks for stacked axes                            │
│    - renderProjectionHeaders has full nested header support                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files and Their Roles

### 1. IntegratedLayout.tsx (React Integration)
- **Location**: `src/components/IntegratedLayout.tsx`
- **Role**: Bridges React state (PAFV, Database) with D3 (SuperGrid)
- **Key Lines**:
  - Line 319: `superGrid.setProjection(projection)` - syncs PAFV to grid
  - Line 280: SQL filtering by node_type
  - Line 293: Slider filter re-query

### 2. SuperGrid.ts (Coordinator)
- **Location**: `src/d3/SuperGrid.ts`
- **Role**: Orchestrates modules (Selection, DragDrop, Rendering, Zoom)
- **Key Methods**:
  - `setProjection()`: Stores projection, updates modules, triggers render
  - `updateModulesWithData()`: Passes data + projection to GridRenderingEngine
  - `render()`: Triggers GridRenderingEngine.render()

### 3. GridRenderingEngine.ts (The Real Renderer)
- **Location**: `src/d3/grid-rendering/GridRenderingEngine.ts`
- **Role**: All D3 rendering logic including stacked headers
- **Key Methods**:
  - `setProjection()`: Stores PAFVProjection
  - `computeAllPositions()`: Computes gridX/gridY for all cards
  - `computeStackedPositions()`: Handles multi-facet axes with composite keys
  - `renderProjectionHeaders()`: Decides single vs stacked header rendering
  - `renderStackedProjectionHeaders()`: Creates nested parent/child headers
  - `renderNestedAxisHeaders()`: Parses composite keys (e.g., "folder|status")

### 4. mappingsToProjection() (Type Converter)
- **Location**: `src/types/grid.ts` (bottom of file)
- **Role**: Converts array of AxisMappings to PAFVProjection structure
- **Handles Stacking**: If multiple mappings on same plane, creates `facets[]` array

---

## Stacked Header Code IS Working

In `GridRenderingEngine.ts`:

```typescript
// Line ~708: Check for stacked axes
private renderProjectionHeaders(): void {
  const xAxisStacked = (this.currentProjection.xAxis?.facets?.length ?? 0) > 1;
  const yAxisStacked = (this.currentProjection.yAxis?.facets?.length ?? 0) > 1;

  if (xAxisStacked || yAxisStacked) {
    this.renderStackedProjectionHeaders(xAxisStacked, yAxisStacked);
    return;
  }
  // ... single-level rendering
}

// Line ~310: Stacked position computation
private computeStackedPositions(cards, xFacets, yFacets): void {
  // Builds composite keys like "folder|status"
  const key = this.buildCompositeKey(card, facets);
  // Creates row/column indices from unique keys
}

// Line ~755: Nested header rendering
private renderNestedAxisHeaders(axis, compositeKeys): void {
  // Parses "Personal|Active" into { "Personal": ["Active"] }
  // Renders parent headers spanning children
  // Supports both row and column orientations
}
```

---

## Likely Actual Issue

Since the architecture is correct, the problem is probably one of:

### A. Data Issue
Cards don't have the properties being mapped (e.g., `folder` is null/undefined)

**Debug**: Add console.log in `computeAllPositions()`:
```typescript
superGridLogger.debug('Card properties:', {
  card: cards[0],
  xFacet: this.currentProjection.xAxis?.facet,
  yFacet: this.currentProjection.yAxis?.facet,
  xValue: (cards[0] as any)[this.currentProjection.xAxis?.facet],
  yValue: (cards[0] as any)[this.currentProjection.yAxis?.facet],
});
```

### B. Projection Not Reaching Renderer
PAFV state changes but projection is null when render happens

**Debug**: Add console.log at start of `render()`:
```typescript
superGridLogger.debug('[GridRenderingEngine.render]', {
  hasProjection: !!this.currentProjection,
  xAxis: this.currentProjection?.xAxis?.facet,
  yAxis: this.currentProjection?.yAxis?.facet,
  cardCount: this.currentData?.cards?.length,
});
```

### C. Timing Issue
Data loads before projection is set, or vice versa

**Debug**: Check order of logs - does projection arrive before data?

### D. SQL Column Mismatch
The SQL query returns columns with different names than expected

**Debug**: Log the actual columns in query result:
```typescript
// In SuperGrid.query(), line ~176:
superGridLogger.debug('SQL result columns:', result[0]?.columns);
```

---

## Recommended Debug Session

1. Open browser DevTools Console
2. Load app with `?test=integrated`
3. Import alto-index data
4. Look for these log messages (already in code):
   - `[GridRenderingEngine.render]` - Shows hasProjection, axes
   - `[GridRenderingEngine.updateGridLayout]` - Shows headers
   - `[computeAllPositions]` - Shows stacked axis detection
   - `[computeStackedPositions]` - Shows computed keys

5. If logs are missing, the issue is likely:
   - `render()` not being called
   - `currentProjection` is null when it shouldn't be
   - Container detached from DOM (React StrictMode)

---

## Files Summary

| File | Purpose | Status |
|------|---------|--------|
| IntegratedLayout.tsx | React ↔ D3 bridge | ✅ Correctly syncs PAFV |
| SuperGrid.ts | Module coordinator | ✅ Passes projection to renderer |
| GridRenderingEngine.ts | D3 rendering | ✅ Has full stacked header support |
| grid.ts (types) | mappingsToProjection | ✅ Handles stacked axes |
| SuperGridEngine/ | Alternative engine | ⚠️ NOT USED by IntegratedLayout |

**Note**: The `SuperGridEngine/` folder (DataManager, HeaderManager, Renderer) is a DIFFERENT, simpler system that's NOT used by the main IntegratedLayout. It may be used by other test routes.

---

## SuperGridEngine vs SuperGrid Confusion

There are TWO different grid systems in the codebase:

### SuperGrid.ts (ACTIVE - Used by IntegratedLayout)
- Location: `src/d3/SuperGrid.ts`
- Uses: `GridRenderingEngine.ts` for rendering
- Has: Full stacked header support, PAFV projection
- This is what runs when you use the integrated layout

### SuperGridEngine/ (ALTERNATIVE - Used by demos)
- Location: `src/d3/SuperGridEngine/`
- Has: Own DataManager.ts, HeaderManager.ts, Renderer.ts
- Simpler: No stacked headers, different data flow
- May be used by `?test=engine` or other test routes

The Codex review was analyzing SuperGridEngine/, but IntegratedLayout uses SuperGrid.ts!

---

## Next Steps for Claude Code

1. **Add the debug logs** listed above to GridRenderingEngine.ts
2. **Trace the actual values** flowing through the pipeline
3. **Identify where values become null/undefined**
4. **Fix the specific disconnect** (likely data property names or timing)

The rendering code itself is complete and correct - the issue is in data/timing, not architecture.
