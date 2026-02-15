# SuperGrid MVP Gap Analysis & Implementation Plan

**Created:** 2026-02-15  
**Status:** Ready for Implementation  
**Owner:** Michael Shaler  
**Context:** Post-Codex fixes assessment

---

## Executive Summary

SuperGrid is **~90% feature complete** for MVP. After Codex's quick fixes, the codebase has all major Super* features implemented. Only **two concrete gaps** remain before declaring MVP complete per the spec acceptance criteria:

1. **SuperDynamic**: Drag-and-drop axis repositioning exists as a component but isn't wired end-to-end to PAFVProvider
2. **SuperSize**: Cell resize exists but doesn't persist sizes to SQLite

Additionally, **Tier 2 view state persistence** needs verification testing.

---

## Current State Assessment

### ✅ Fully Implemented (13/14 MVP Features)

| Feature | Component | Status | Notes |
|---------|-----------|--------|-------|
| **SuperStack** | `SuperStack.tsx` | ✅ Complete | SQL-driven headers, collapse/expand, D3 animations |
| **SuperDensity** | `SuperDensity.tsx`, `DensityControls.tsx` | ✅ Complete | Value + Extent density sliders |
| **SuperZoom** | `SuperZoom.tsx` | ✅ Complete | Upper-left pinned zoom, pan controls |
| **SuperSelect** | Integrated in `SuperGrid.tsx` | ✅ Complete | Z-axis aware, Cmd+click, header group select |
| **SuperSearch** | `SuperSearch.tsx` | ✅ Complete | FTS5 integration, faceted search, in-grid highlighting |
| **SuperFilter** | Header interactions | ✅ Complete | Compiles to SQL WHERE via FilterProvider |
| **SuperSort** | Header click handlers | ✅ Complete | Ascending/descending toggle |
| **SuperCards** | `isSuperCardId()` utility | ✅ Complete | Generated cards filtered from search results |
| **SuperAudit** | `SuperAudit.tsx`, `AuditToggle.tsx` | ✅ Complete | Computed value highlighting |
| **SuperCalc** | `SuperCalc.tsx` | ✅ Partial | Basic integration; PAFV-aware formulas post-MVP |
| **Performance** | `SuperGridVirtualized.tsx` | ✅ Complete | TanStack Virtual, GPU animations, 60fps |
| **Accessibility** | `SuperGridAccessibility.tsx` | ✅ Complete | ARIA grid roles, keyboard navigation |
| **Header Click Zones** | `HeaderKeyboardController.ts` | ✅ Complete | Geometric disambiguation |

### 🟡 MVP Gaps (2 Items)

| Feature | Component | Gap | Effort |
|---------|-----------|-----|--------|
| **SuperDynamic** | `SuperDynamic.tsx` | Drag events not wired to PAFVProvider | ~45 min |
| **SuperSize** | `SuperSize.tsx` | Resize not persisted to SQLite | ~30 min |

### ⬜ Post-MVP (Deferred per Spec Section 8)

| Feature | Status | Notes |
|---------|--------|-------|
| SuperTime | Not started | Smart time parsing, non-contiguous selection |
| SuperReplay | Not started | Animation playback |
| SuperVersion | Not started | Collaboration features |
| SuperTemplates | Not started | Reusable configurations |

---

## MVP Acceptance Criteria Checklist

From spec Section 11:

| Criterion | Status |
|-----------|--------|
| ✅ 2D grid renders with correct PAFV axis mapping from sql.js data | Done |
| ✅ At least 2-level SuperStack headers render with correct visual spanning | Done |
| ✅ Density slider collapses/expands one axis level (Value Density level 1) | Done |
| ✅ Extent slider hides/shows empty intersections (Extent Density level 2) | Done |
| 🟡 Axis drag-and-drop transposes rows ↔ columns | **Gap #1** |
| ✅ Cell selection works with single-click and Cmd+click multi-select | Done |
| ✅ Header click zones follow the geometric rule (parent label vs. child vs. data) | Done |
| ✅ Cursor changes correctly across all zone boundaries | Done |
| 🟡 Column resize with drag handle persists | **Gap #2** |
| ✅ Zoom pins upper-left corner | Done |
| ✅ FTS5 search highlights matching cells in-grid | Done |
| ✅ View transitions preserve Tier 1 state (filters, selection, search, density) | Done |
| 🟡 View transitions within LATCH family preserve/restore Tier 2 state | **Needs verification** |
| ✅ All operations maintain 60fps with 1,000 cards | Done (Phase 93) |
| ✅ All operations complete within performance targets at 10,000 cards | Done (Phase 93) |

---

## Implementation Plan: Gap #1 - SuperDynamic End-to-End Wiring

### Current State

`SuperDynamic.tsx` exists with:
- ✅ Drag state management (`DragState` interface)
- ✅ Visual drag feedback with ghost elements
- ✅ Drop zone detection via `data-axis-drop-zone` attributes
- ✅ Axis swap logic (`performAxisSwap()`)
- ❌ **Not integrated with SuperGrid's PAFVProvider**

### Problem

The component calls `onAxisChange(axis, value)` but:
1. SuperGrid doesn't render SuperDynamic
2. No bridge connects SuperDynamic to `usePAFV()` hook
3. Grid doesn't reflow after axis change

### Solution Architecture

```
SuperDynamic                    SuperGrid                    usePAFV
     │                              │                           │
     │ onAxisChange(plane, facet)   │                           │
     ├─────────────────────────────►│                           │
     │                              │ setMapping(plane, axis,   │
     │                              │            facet)         │
     │                              ├──────────────────────────►│
     │                              │                           │
     │                              │ ◄── state.mappings ───────┤
     │                              │                           │
     │                              │ [D3 re-render triggered   │
     │                              │  via useMemo on mappings] │
```

### Implementation Tasks

#### Task 1: Add SuperDynamic to SuperGrid Layout (15 min)

**File:** `src/components/supergrid/SuperGrid.tsx`

```tsx
// Add import
import { SuperDynamic } from './SuperDynamic';

// In SuperGrid component, add props destructuring:
const { setMapping, removeMapping, getMappingForPlane } = usePAFV();

// Add axis change handler
const handleAxisChange = useCallback((
  plane: 'x' | 'y' | 'z',
  facetId: string
) => {
  if (!facetId) {
    removeMapping(plane);
  } else {
    // Infer LATCH dimension from facet name
    const dimension = inferDimensionFromFacet(facetId);
    setMapping(plane, dimension, facetId);
  }
}, [setMapping, removeMapping]);

// Add to render, in MiniNav corner area:
{enableDragDrop && (
  <div className="supergrid__minav">
    <SuperDynamic
      xAxis={gridLayout.columnFacet || ''}
      yAxis={gridLayout.rowFacet || ''}
      zAxis=""
      onAxisChange={handleAxisChange}
      availableAxes={availableFacets}
    />
  </div>
)}
```

#### Task 2: Create Dimension Inference Utility (10 min)

**File:** `src/utils/latch-inference.ts`

```typescript
import type { LATCHDimension } from '@/hooks/usePAFV';

/**
 * Infer LATCH dimension from facet name
 * Used when dragging axes in SuperDynamic
 */
export function inferDimensionFromFacet(facet: string): LATCHDimension {
  const lowerFacet = facet.toLowerCase();
  
  // Time-related facets
  if (['created_at', 'modified_at', 'date', 'year', 'month', 'quarter', 'week', 'day']
      .some(t => lowerFacet.includes(t))) {
    return 'time';
  }
  
  // Location-related facets
  if (['location', 'place', 'address', 'city', 'country', 'region']
      .some(l => lowerFacet.includes(l))) {
    return 'location';
  }
  
  // Hierarchy-related facets
  if (['folder', 'path', 'parent', 'priority', 'level']
      .some(h => lowerFacet.includes(h))) {
    return 'hierarchy';
  }
  
  // Alphabet-related facets
  if (['name', 'title', 'alphabetical']
      .some(a => lowerFacet.includes(a))) {
    return 'alphabet';
  }
  
  // Default to category (status, tags, type, etc.)
  return 'category';
}
```

#### Task 3: Add Available Facets Discovery (10 min)

**File:** `src/hooks/useAvailableFacets.ts`

```typescript
import { useMemo } from 'react';
import { useSQLiteQuery } from '@/hooks';

interface FacetOption {
  id: string;
  label: string;
  description: string;
}

/**
 * Discover available facets from node schema
 */
export function useAvailableFacets(): FacetOption[] {
  // Query PRAGMA to get column names
  const { data: columns } = useSQLiteQuery<{ name: string }>(
    "SELECT name FROM pragma_table_info('nodes') WHERE name NOT IN ('id', 'content', 'deleted_at')",
    []
  );
  
  return useMemo(() => {
    if (!columns) return [];
    
    return columns.map(col => ({
      id: col.name,
      label: formatFacetLabel(col.name),
      description: `Group by ${col.name}`
    }));
  }, [columns]);
}

function formatFacetLabel(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
```

#### Task 4: Add Grid Reflow Animation (10 min)

**File:** `src/components/supergrid/SuperGrid.tsx`

```tsx
// Add transition class when mappings change
const [isReflowing, setIsReflowing] = useState(false);
const prevMappingsRef = useRef(pafvState.mappings);

useEffect(() => {
  if (JSON.stringify(prevMappingsRef.current) !== JSON.stringify(pafvState.mappings)) {
    setIsReflowing(true);
    const timeout = setTimeout(() => setIsReflowing(false), 500);
    prevMappingsRef.current = pafvState.mappings;
    return () => clearTimeout(timeout);
  }
}, [pafvState.mappings]);

// Apply to grid container
<div 
  className={`supergrid__data-grid ${isReflowing ? 'supergrid__data-grid--reflowing' : ''}`}
  ...
>
```

**File:** `src/components/supergrid/SuperGrid.css`

```css
.supergrid__data-grid--reflowing {
  transition: all 500ms cubic-bezier(0.4, 0, 0.2, 1);
}

.supergrid__data-grid--reflowing .supergrid__cell {
  transition: transform 500ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Testing Criteria

| Test | Input | Expected | Pass Criteria |
|------|-------|----------|---------------|
| Transpose 2D grid | Drag x-axis chip to y-axis slot | Rows become columns | Data integrity maintained |
| Add axis | Drag facet from available list to empty slot | New grouping appears | Correct header generation |
| Remove axis | Drag axis chip to available list | Axis removed, grid collapses | No data loss |
| Cancel drag | Press Escape during drag | Original state restored | No state change |
| Reflow animation | Complete any axis drop | Grid animates smoothly | < 500ms, 60fps |

---

## Implementation Plan: Gap #2 - SuperSize Persistence

### Current State

`SuperSize.tsx` exists with:
- ✅ Cell expansion state management
- ✅ Global size factor slider
- ✅ Expand/collapse all functionality
- ✅ Animations with configurable duration
- ❌ **No SQLite persistence**

### Problem

When user navigates away and returns, all resize state is lost.

### Solution Architecture

```
SuperSize                    view_state SQLite              SuperGrid
     │                              │                           │
     │ onCellSizeChange(id, size)   │                           │
     ├─────────────────────────────►│                           │
     │                              │                           │
     │  [Debounced write to         │                           │
     │   view_state.state_json]     │                           │
     │                              │                           │
     │                              │ ◄── On mount, read ───────┤
     │                              │     saved sizes           │
     │ ◄── Initialize with          │                           │
     │     saved state              │                           │
```

### Implementation Tasks

#### Task 1: Create Size Persistence Hook (15 min)

**File:** `src/hooks/useCellSizePersistence.ts`

```typescript
import { useEffect, useRef, useCallback } from 'react';
import { useSQLite } from '@/db/SQLiteProvider';
import { debounce } from 'lodash-es';

interface CellSizeState {
  cellSizes: Record<string, { width: number; height: number }>;
  globalSizeFactor: number;
}

const VIEW_STATE_KEY = 'supergrid-cell-sizes';

/**
 * Persist and restore cell sizes to/from SQLite view_state table
 */
export function useCellSizePersistence(datasetId: string = 'default') {
  const { db } = useSQLite();
  const initialLoadRef = useRef(false);

  // Load saved sizes on mount
  const loadSizes = useCallback(async (): Promise<CellSizeState | null> => {
    if (!db) return null;
    
    try {
      const result = db.exec(`
        SELECT state_json FROM view_state 
        WHERE id = ? AND family = 'LATCH'
      `, [VIEW_STATE_KEY]);
      
      if (result[0]?.values?.[0]?.[0]) {
        const state = JSON.parse(result[0].values[0][0] as string);
        return state.cellSizes ? state : null;
      }
    } catch (e) {
      console.warn('[useCellSizePersistence] Failed to load sizes:', e);
    }
    return null;
  }, [db]);

  // Save sizes (debounced)
  const saveSizes = useCallback(
    debounce((state: CellSizeState) => {
      if (!db) return;
      
      try {
        db.run(`
          INSERT OR REPLACE INTO view_state (id, dataset_id, app_id, family, state_json, updated_at)
          VALUES (?, ?, 'isometry', 'LATCH', ?, datetime('now'))
        `, [VIEW_STATE_KEY, datasetId, JSON.stringify(state)]);
      } catch (e) {
        console.warn('[useCellSizePersistence] Failed to save sizes:', e);
      }
    }, 500),
    [db, datasetId]
  );

  return {
    loadSizes,
    saveSizes,
    initialLoadRef
  };
}
```

#### Task 2: Wire SuperSize to Persistence (10 min)

**File:** `src/components/supergrid/SuperSize.tsx`

Add to component:

```tsx
import { useCellSizePersistence } from '@/hooks/useCellSizePersistence';

// Inside SuperSize component:
const { loadSizes, saveSizes, initialLoadRef } = useCellSizePersistence();

// Load saved state on mount
useEffect(() => {
  if (initialLoadRef.current) return;
  initialLoadRef.current = true;
  
  loadSizes().then(savedState => {
    if (savedState) {
      setGlobalSizeFactor(savedState.globalSizeFactor || 1.0);
      setExpansionState(prev => ({
        ...prev,
        cellSizes: new Map(Object.entries(savedState.cellSizes || {}))
      }));
    }
  });
}, [loadSizes]);

// Persist on size changes
useEffect(() => {
  saveSizes({
    cellSizes: Object.fromEntries(expansionState.cellSizes),
    globalSizeFactor
  });
}, [expansionState.cellSizes, globalSizeFactor, saveSizes]);
```

#### Task 3: Ensure view_state Table Exists (5 min)

**File:** `src/db/schema.sql` (verify this exists)

```sql
-- Should already exist per spec Section 5
CREATE TABLE IF NOT EXISTS view_state (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    app_id TEXT NOT NULL,
    family TEXT NOT NULL,
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(dataset_id, app_id, family)
);
```

### Testing Criteria

| Test | Input | Expected | Pass Criteria |
|------|-------|----------|---------------|
| Size persists | Resize column, navigate away, return | Saved width restored | Exact pixel match |
| Global factor persists | Set factor to 1.5x, navigate away, return | 1.5x restored | Factor matches |
| Cross-session persistence | Resize, close browser, reopen | Sizes restored | SQLite read on mount |
| Debounce works | Drag resize quickly multiple times | Only 1 write per 500ms | No DB spam |

---

## Implementation Plan: Tier 2 State Verification

### Current State

Tier 1 state (filters, selection, search, density) persists ✅  
Tier 2 state (axis assignments, header collapse, viewport) needs verification.

### Verification Tests to Add

**File:** `src/test/integration/view-transitions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePAFV } from '@/hooks/usePAFV';

describe('View Transition State Machine', () => {
  describe('Tier 2: LATCH Family State', () => {
    it('preserves axis assignments across Grid → List → Grid', async () => {
      const { result } = renderHook(() => usePAFV());
      
      // Set custom axis assignment
      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
        result.current.setMapping('y', 'category', 'status');
      });
      
      // Simulate view transition to List
      act(() => {
        result.current.setActiveView('list');
      });
      
      // Simulate view transition back to Grid
      act(() => {
        result.current.setActiveView('grid');
      });
      
      // Verify axis assignments preserved
      expect(result.current.getMappingForPlane('x')).toEqual({
        dimension: 'time',
        field: 'created_at',
        plane: 'x'
      });
    });

    it('preserves header collapse state across transitions', async () => {
      // Test with useHeaderInteractions hook
      // Verify collapsedIds persists
    });

    it('restores lastActiveView on family return', async () => {
      // Test transition LATCH → GRAPH → LATCH
      // Verify returns to last LATCH view, not default
    });
  });
});
```

---

## Recommended Execution Order

### Phase A: Close MVP Gaps (~1.5 hours total)

1. **SuperDynamic wiring** (45 min)
   - Task 1: Add to SuperGrid layout
   - Task 2: Dimension inference utility
   - Task 3: Available facets discovery
   - Task 4: Reflow animation

2. **SuperSize persistence** (30 min)
   - Task 1: Persistence hook
   - Task 2: Wire to SuperSize
   - Task 3: Verify schema

### Phase B: Verification (~30 min)

3. **Tier 2 state tests** (30 min)
   - Add integration tests
   - Run and verify
   - Fix any issues found

### Phase C: Documentation (~15 min)

4. **Update spec status**
   - Change "Draft" to "v1.0 MVP"
   - Update CLAUDE.md
   - Create user guide outline

---

## Files Modified Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/components/supergrid/SuperGrid.tsx` | Modify | Wire SuperDynamic, add reflow |
| `src/components/supergrid/SuperSize.tsx` | Modify | Add persistence |
| `src/utils/latch-inference.ts` | Create | Dimension inference |
| `src/hooks/useAvailableFacets.ts` | Create | Facet discovery |
| `src/hooks/useCellSizePersistence.ts` | Create | Size persistence |
| `src/components/supergrid/SuperGrid.css` | Modify | Reflow animation |
| `src/test/integration/view-transitions.test.ts` | Create | Tier 2 verification |

---

## Success Criteria

MVP is complete when:

- [ ] Dragging axis chip from x-slot to y-slot transposes the grid
- [ ] Resizing a column, navigating away, and returning restores the width
- [ ] Integration tests for Tier 2 state pass
- [ ] All spec Section 11 acceptance criteria checked

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| usePAFV interface mismatch | Medium | High | Review hook implementation first |
| SQLite schema missing view_state | Low | Medium | Check during Task 3 |
| Animation performance regression | Low | Medium | Keep transitions < 500ms |

---

*Document created: 2026-02-15*  
*Ready for implementation by Claude Code or manual development*
