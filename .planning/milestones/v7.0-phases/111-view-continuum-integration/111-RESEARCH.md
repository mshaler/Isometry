# Phase 111: View Continuum Integration - Research

**Researched:** 2026-02-17
**Domain:** View routing, Kanban drag-drop, PAFV axis allocation, cross-view selection
**Confidence:** HIGH

## Summary

Phase 111 builds on the Gallery and List views from Phase 110 to complete the Grid Continuum integration. The phase requires building a React-based KanbanView with dnd-kit drag-drop (not the existing D3 KanbanView), a ViewDispatcher for routing, an enhanced GridContinuumSwitcher with keyboard shortcuts, and proper PAFV axis allocation per view mode.

**Critical finding:** The codebase uses react-dnd (installed at v16.0.1) rather than dnd-kit. The ROADMAP mentions dnd-kit, but package.json shows react-dnd. The existing drag-drop infrastructure for PAFV navigator uses react-dnd with HTML5Backend. Recommend continuing with react-dnd for consistency rather than introducing a second DnD library.

**Primary recommendation:** Build React-based KanbanView using react-dnd (existing), ViewDispatcher routing component, enhanced GridContinuumSwitcher with Cmd+1-5 shortcuts, and extend SelectionContext for sessionStorage persistence.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-dnd | 16.0.1 | Drag-drop framework | Already installed, used for PAFV navigator |
| react-dnd-html5-backend | 16.0.1 | HTML5 drag backend | Paired with react-dnd |
| @tanstack/react-virtual | 3.13.18 | Virtual scrolling | Used by GalleryView, ListView already |
| sql.js | 1.13.0 | SQLite in browser | Core data layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useSQLiteQuery | internal | React hook for SQL | All view data fetching |
| usePAFV | internal | PAFV state access | Axis allocation |
| useSelection | internal | Selection state | Cross-view selection sync |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-dnd | @dnd-kit/core | dnd-kit is more modern, but react-dnd already installed and used |
| ViewDispatcher | React Router | Overkill for view switching within same page |
| sessionStorage | localStorage | sessionStorage clears on tab close (appropriate for selection) |

**Installation:**
No new dependencies required. All libraries already installed.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── components/
│   ├── views/
│   │   ├── GalleryView.tsx        # Phase 110 (shipped)
│   │   ├── ListView.tsx           # Phase 110 (shipped)
│   │   ├── KanbanView.tsx         # Phase 111-01 (new)
│   │   ├── KanbanColumn.tsx       # Phase 111-01 (new)
│   │   ├── KanbanCard.tsx         # Phase 111-01 (new)
│   │   ├── ViewDispatcher.tsx     # Phase 111-02 (new)
│   │   └── index.ts               # Barrel exports
│   └── supergrid/
│       ├── GridContinuumController.ts   # Existing (enhance)
│       ├── GridContinuumSwitcher.tsx    # Existing (enhance)
│       └── GridContinuumSwitcher.css    # Existing (enhance)
├── state/
│   ├── SelectionContext.tsx       # Existing (enhance for persistence)
│   └── PAFVContext.tsx            # Existing
└── hooks/
    └── ui/
        └── useDragDrop.ts         # Existing HTML5 DnD hook
```

### Pattern 1: ViewDispatcher Routing
**What:** Single component renders correct view based on activeView state
**When to use:** Grid Continuum mode switching
**Example:**
```typescript
// ViewDispatcher.tsx
import { GridContinuumMode } from '@/types/view';
import { GalleryView } from './GalleryView';
import { ListView } from './ListView';
import { KanbanView } from './KanbanView';
import { SuperGridCSS } from '../supergrid/SuperGridCSS';

interface ViewDispatcherProps {
  activeView: GridContinuumMode;
  // Props passed through to all views
}

export function ViewDispatcher({ activeView, ...viewProps }: ViewDispatcherProps) {
  switch (activeView) {
    case 'gallery':
      return <GalleryView {...viewProps} />;
    case 'list':
      return <ListView {...viewProps} />;
    case 'kanban':
      return <KanbanView {...viewProps} />;
    case 'grid':
    case 'supergrid':
      return <SuperGridCSS {...viewProps} />;
    default:
      return <GalleryView {...viewProps} />;
  }
}
```

### Pattern 2: react-dnd Kanban Card
**What:** Draggable card with useDrag hook
**When to use:** KanbanCard component
**Example:**
```typescript
// From existing useDragDrop pattern adapted for Kanban
import { useDrag } from 'react-dnd';

interface KanbanCardProps {
  card: Card;
  columnId: string;
}

export function KanbanCard({ card, columnId }: KanbanCardProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'KANBAN_CARD',
    item: { cardId: card.id, sourceColumnId: columnId },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div
      ref={drag}
      className={cn('kanban-card', isDragging && 'opacity-50')}
    >
      {card.name}
    </div>
  );
}
```

### Pattern 3: Keyboard Shortcut Registration
**What:** Global keyboard listener for Cmd+1-5
**When to use:** GridContinuumSwitcher enhancement
**Example:**
```typescript
// From existing ViewSwitcher.tsx pattern
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (!(event.metaKey || event.ctrlKey)) return;

  switch (event.key) {
    case '1':
      event.preventDefault();
      onModeChange('gallery');
      break;
    case '2':
      event.preventDefault();
      onModeChange('list');
      break;
    case '3':
      event.preventDefault();
      onModeChange('kanban');
      break;
    case '4':
      event.preventDefault();
      onModeChange('grid');
      break;
    case '5':
      event.preventDefault();
      onModeChange('supergrid');
      break;
  }
}, [onModeChange]);

useEffect(() => {
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [handleKeyDown]);
```

### Pattern 4: Selection Persistence
**What:** SelectionContext with sessionStorage backup
**When to use:** Selection survives page refresh within session
**Example:**
```typescript
// Enhance SelectionProvider
const STORAGE_KEY = 'isometry-selection-state';

function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selection, setSelection] = useState<SelectionState>(() => {
    // Restore from sessionStorage on mount
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          selectedIds: new Set(parsed.selectedIds || []),
          anchorId: parsed.anchorId || null,
          lastSelectedId: parsed.lastSelectedId || null,
        };
      }
    } catch { /* ignore */ }
    return { selectedIds: new Set(), anchorId: null, lastSelectedId: null };
  });

  // Persist to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedIds: Array.from(selection.selectedIds),
        anchorId: selection.anchorId,
        lastSelectedId: selection.lastSelectedId,
      }));
    } catch { /* ignore quota errors */ }
  }, [selection]);
  // ...
}
```

### Anti-Patterns to Avoid
- **Mixing DnD libraries:** Do NOT add @dnd-kit when react-dnd is already in use
- **View-specific selection state:** Selection MUST use SelectionContext, not local state
- **Inline SQL in views:** Use useSQLiteQuery hook, not direct db.exec() calls
- **Re-implementing GridContinuumController:** Extend existing class, don't replace

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-drop | Custom drag handlers | react-dnd useDrag/useDrop | Complex edge cases (touch, accessibility) |
| Virtual scrolling | Manual windowing | useVirtualizedList | Efficient, already integrated |
| PAFV state | Local axis tracking | usePAFV hook | Single source of truth |
| Selection | Component state | useSelection hook | Cross-view sync required |
| Mode persistence | Ad-hoc localStorage | useViewSwitcher hook | Already implements persistence |

**Key insight:** The codebase already has all the building blocks. Phase 111 is integration work, not new infrastructure.

## Common Pitfalls

### Pitfall 1: DnD Provider Nesting
**What goes wrong:** DndProvider wrapped multiple times causes "Cannot have two HTML5 backends"
**Why it happens:** IntegratedLayout already has DndProvider, adding another in KanbanView breaks
**How to avoid:** Use DndProvider only at root (IntegratedLayout.tsx line 790)
**Warning signs:** Console error "Cannot have two HTML5 backends at the same time"

### Pitfall 2: Selection Loss on View Switch
**What goes wrong:** Selection cleared when switching from List to Kanban
**Why it happens:** Views unmount and forget selection
**How to avoid:** Selection lives in SelectionContext (React context), not component state
**Warning signs:** Selected card deselects when mode changes

### Pitfall 3: SQL UPDATE Without Optimistic UI
**What goes wrong:** Drag-drop feels laggy (waits for DB round-trip)
**Why it happens:** UI waits for SQL UPDATE confirmation
**How to avoid:** Update UI immediately, rollback on SQL error
**Warning signs:** 200ms+ delay between drop and column change

### Pitfall 4: Keyboard Shortcut Conflicts
**What goes wrong:** Cmd+1 opens Safari bookmarks instead of Gallery
**Why it happens:** Browser handles shortcut before JavaScript
**How to avoid:** Call event.preventDefault() BEFORE any async work
**Warning signs:** Browser action triggers alongside view switch

### Pitfall 5: Stale Closure in Drag Callbacks
**What goes wrong:** Dropped card goes to wrong column (uses stale column data)
**Why it happens:** useDrag item callback captures stale state
**How to avoid:** Use function form of item: `item: () => ({ cardId, columnId })`
**Warning signs:** Cards randomly moving to wrong columns

## Code Examples

### KanbanColumn with useDrop
```typescript
// src/components/views/KanbanColumn.tsx
import { useDrop } from 'react-dnd';
import type { Card } from '@/types/card';
import { useSQLite } from '@/db/SQLiteProvider';

interface KanbanColumnProps {
  columnId: string;
  facetValue: string;
  cards: Card[];
  facetColumn: string; // e.g., 'status'
}

export function KanbanColumn({ columnId, facetValue, cards, facetColumn }: KanbanColumnProps) {
  const { db } = useSQLite();

  const [{ isOver }, drop] = useDrop({
    accept: 'KANBAN_CARD',
    drop: (item: { cardId: string; sourceColumnId: string }) => {
      if (item.sourceColumnId === columnId) return; // Same column, no-op

      // SQL UPDATE to persist facet change
      db?.run(
        `UPDATE nodes SET ${facetColumn} = ? WHERE id = ?`,
        [facetValue, item.cardId]
      );
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={drop}
      className={cn('kanban-column', isOver && 'bg-blue-50')}
    >
      <header className="kanban-column-header">
        {facetValue} ({cards.length})
      </header>
      {cards.map(card => (
        <KanbanCard key={card.id} card={card} columnId={columnId} />
      ))}
    </div>
  );
}
```

### GridContinuumController.allocateAxes Enhancement
```typescript
// Enhance existing GridContinuumController.ts
allocateAxes(mode: GridContinuumMode): AxisAllocation {
  switch (mode) {
    case 'gallery':
      return {
        axisCount: 0,
        x: null,
        y: null,
        description: 'Position only (masonry flow)',
      };
    case 'list':
      return {
        axisCount: 1,
        x: null,
        y: this.getDefaultHierarchyFacet(), // e.g., 'folder'
        description: 'Single hierarchy axis',
      };
    case 'kanban':
      return {
        axisCount: 1,
        x: this.getDefaultCategoryFacet(), // e.g., 'status'
        y: null,
        description: 'Single category facet for columns',
      };
    case 'grid':
      return {
        axisCount: 2,
        x: this.axisMappings.get('x') || this.getDefaultXAxis(),
        y: this.axisMappings.get('y') || this.getDefaultYAxis(),
        description: 'Two axes for matrix',
      };
    case 'supergrid':
      return {
        axisCount: this.axisMappings.size,
        x: this.axisMappings.get('x'),
        y: this.axisMappings.get('y'),
        z: this.axisMappings.get('z'),
        description: 'N axes with stacked headers',
      };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3 KanbanView (SVG) | React KanbanView (CSS Grid) | Phase 111 | Better integration with React state |
| Multiple view switchers | Single GridContinuumSwitcher | Phase 110 | Unified UI |
| Per-view selection | SelectionContext | v4.1 | Cross-view sync |

**Deprecated/outdated:**
- `src/d3/KanbanView.ts`: D3-based SVG renderer. Keep for reference but don't use for Phase 111.
- `src/components/ViewSwitcher.tsx`: Has keyboard shortcuts but uses different ViewType enum. Reference for patterns but use GridContinuumSwitcher.

## Current State Analysis

### What Exists

**GridContinuumController** (`src/components/supergrid/GridContinuumController.ts`):
- Full class with mode management and projection logic
- Has `getProjection()` method returning cells grouped by axis values
- Missing: `allocateAxes()` method that returns axis config per mode
- Lines: 394

**GridContinuumSwitcher** (`src/components/supergrid/GridContinuumSwitcher.tsx`):
- Button group UI for 5 modes with icons and labels
- Missing: Keyboard shortcuts (Cmd+1-5)
- Has: Transition feedback, aria-pressed states
- Lines: 141

**SelectionContext** (`src/state/SelectionContext.tsx`):
- Full selection API: select, deselect, toggle, selectRange, selectMultiple, clear
- Has: scrollToNode registration for cross-canvas sync
- Missing: sessionStorage persistence
- Lines: 186

**ViewSwitcher** (`src/components/ViewSwitcher.tsx`):
- Has keyboard shortcuts (Cmd+1-3 for List/Kanban/SuperGrid)
- Uses ViewType enum (different from GridContinuumMode)
- Has useViewSwitcher hook with localStorage persistence
- Can reference for patterns

**D3 KanbanView** (`src/d3/KanbanView.ts`):
- SVG-based renderer with D3
- Has grouping by facet, column headers, card positioning
- NOT suitable for Phase 111 (need React component)
- Use kanban/ subdirectory for data processing utilities

**react-dnd Infrastructure**:
- DndProvider in IntegratedLayout.tsx (line 790)
- useDragDrop hook at `src/hooks/ui/useDragDrop.ts`
- Used by: PlaneDropZone, DraggablePropertyChip, DraggableFacet, PafvNavigator, AxisNavigator

### What's Missing (Gaps)

1. **KanbanView React Component**: Need CSS Grid + react-dnd version (not D3)
2. **ViewDispatcher**: No routing component exists
3. **Keyboard shortcuts in GridContinuumSwitcher**: Missing Cmd+1-5
4. **allocateAxes() in GridContinuumController**: Method mentioned but not implemented
5. **Selection persistence**: SelectionContext doesn't persist to sessionStorage
6. **SQL UPDATE on drop**: Need to persist facet changes when cards dropped

## Approach per Requirement

### REQ-A-03: Kanban View Renderer

**Approach:**
1. Create KanbanView.tsx as React component (not D3)
2. Use useSQLiteQuery for data fetching
3. Group cards by x-axis facet (e.g., status)
4. Render columns with CSS Grid
5. Use react-dnd for drag-drop (already in DndProvider)
6. SQL UPDATE on drop to persist facet change

**Files to create:**
- `src/components/views/KanbanView.tsx`
- `src/components/views/KanbanColumn.tsx`
- `src/components/views/KanbanCard.tsx`

**Key dependencies:**
- react-dnd (existing)
- useSQLiteQuery (existing)
- useSelection (existing)
- useFilters (existing)

### REQ-A-04: Grid Continuum Mode Switcher

**Approach:**
1. Enhance GridContinuumSwitcher with Cmd+1-5 keyboard shortcuts
2. Create ViewDispatcher component for routing
3. Wire to PAFVContext for mode state

**Files to modify:**
- `src/components/supergrid/GridContinuumSwitcher.tsx` (add keyboard shortcuts)

**Files to create:**
- `src/components/views/ViewDispatcher.tsx`

### REQ-A-05: PAFV Axis Allocation per View Mode

**Approach:**
1. Add `allocateAxes(mode)` method to GridContinuumController
2. Return axis configuration per mode
3. Use in ViewDispatcher to configure view-specific behavior

**Files to modify:**
- `src/components/supergrid/GridContinuumController.ts` (add allocateAxes)

### REQ-A-06: Cross-View Selection Synchronization

**Approach:**
1. Enhance SelectionContext with sessionStorage persistence
2. Selection already shared via context - just need persistence
3. CSS `.selected` class already driven by isSelected() in existing views

**Files to modify:**
- `src/state/SelectionContext.tsx` (add sessionStorage persistence)

## File Structure for Phase 111

### Files to Create
| File | Purpose | Lines (est) |
|------|---------|-------------|
| `src/components/views/KanbanView.tsx` | Main Kanban view with SQL integration | 150 |
| `src/components/views/KanbanColumn.tsx` | Drop target column with header | 80 |
| `src/components/views/KanbanCard.tsx` | Draggable card | 60 |
| `src/components/views/ViewDispatcher.tsx` | View routing by mode | 50 |

### Files to Modify
| File | Changes | Lines added (est) |
|------|---------|-------------------|
| `src/components/supergrid/GridContinuumSwitcher.tsx` | Add Cmd+1-5 shortcuts | 30 |
| `src/components/supergrid/GridContinuumController.ts` | Add allocateAxes() | 40 |
| `src/state/SelectionContext.tsx` | Add sessionStorage | 25 |
| `src/components/views/index.ts` | Export new components | 5 |

## Dependencies (npm packages)

All required packages already installed:
- `react-dnd` ^16.0.1
- `react-dnd-html5-backend` ^16.0.1
- `@tanstack/react-virtual` ^3.13.18

No new package installations needed.

## Open Questions

1. **Column order for Kanban**
   - What we know: D3 KanbanView has statusOrder array ['backlog', 'todo', 'in-progress', 'review', 'done']
   - What's unclear: Should this be configurable? Where should order be stored?
   - Recommendation: Use discovery query ORDER BY, allow custom order in settings (deferred)

2. **Default Kanban facet**
   - What we know: ROADMAP says "status" is default column facet
   - What's unclear: What if dataset has no status column?
   - Recommendation: Fall back to first Category facet from classification

3. **Mode state location**
   - What we know: useViewSwitcher has localStorage persistence
   - What's unclear: Should GridContinuumSwitcher use same pattern?
   - Recommendation: Add activeView to PAFVContext (single source of truth)

## Sources

### Primary (HIGH confidence)
- package.json - Verified react-dnd ^16.0.1 installed
- `src/components/IntegratedLayout.tsx` - DndProvider already at root
- `src/hooks/ui/useDragDrop.ts` - Existing DnD patterns
- `src/components/supergrid/GridContinuumController.ts` - Full class source
- `src/state/SelectionContext.tsx` - Full selection implementation

### Secondary (MEDIUM confidence)
- `src/components/ViewSwitcher.tsx` - Keyboard shortcut pattern
- `src/d3/KanbanView.ts` - Data grouping logic (reference only)
- `src/d3/kanban/data-processor.ts` - groupCardsByFacet utility

### Tertiary (LOW confidence)
- ROADMAP mentions "dnd-kit" but package.json shows react-dnd. Confirmed react-dnd is correct.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified all packages installed and in use
- Architecture: HIGH - Based on existing codebase patterns
- Pitfalls: HIGH - Common DnD issues well-documented

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (stable patterns, no fast-moving dependencies)
