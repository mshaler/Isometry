# Phase 110: View Continuum Foundation - Research

**Researched:** 2026-02-16
**Domain:** React view renderers with TanStack Virtual, SQL data integration, PAFV axis allocation
**Confidence:** HIGH

---

## Summary

Phase 110 builds the Gallery and List view renderers - the first two entries in the Grid Continuum (0-axis gallery, 1-axis list). The codebase already has comprehensive infrastructure: `useSQLiteQuery` is operational at `src/hooks/database/useSQLiteQuery.ts`, `@tanstack/react-virtual` v3.13.18 is installed with multiple wrapper hooks, `SelectionContext` provides selection APIs, `FilterContext` provides LATCH filter state, and `compileFilters()` compiles LATCH state to SQL WHERE clauses.

**Key discovery:** The existing `VirtualizedGrid` and `VirtualizedList` components in `src/components/` are feature-rich but complex (500+ lines each) with live query support. For Phase 110, simpler purpose-built wrappers using the core `useVirtualizedList`/`useVirtualizedGrid` hooks directly will be cleaner. The existing `GalleryCard.tsx` provides the card renderer pattern, and `primitives-gallery.css` / `primitives-list.css` provide CSS tokens.

The existing `ListViewRenderer.tsx` is a deprecated class-based stub. The `useListData` hook at `src/hooks/data/useListData.ts` provides the grouping pattern (reads PAFV Y-axis mapping for sort/group). The `TreeView.tsx` is D3-based and not suitable for React tree expand/collapse state.

**Primary recommendation:** Build `GalleryView.tsx` and `ListView.tsx` as focused functional components that compose `useFilteredNodes` + `useVirtualizedList` + `useSelection`, using the CSS primitives for styling.

---

## Standard Stack

### Core (already installed - no new npm installs needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tanstack/react-virtual` | 3.13.18 | Virtual scrolling for 500+ items | Installed, multiple hooks available |
| `useSQLiteQuery` | internal | SQL -> Node[] data fetching | Operational at `src/hooks/database/useSQLiteQuery.ts` |
| `useFilteredNodes` | internal | Filtered node fetching with FilterContext | Operational at `src/hooks/data/useFilteredNodes.ts` |
| `SelectionContext` | internal | Selection API with scrollToNode registration | Operational at `src/state/SelectionContext.tsx` |
| `FilterContext` | internal | LATCH filter state | Operational at `src/state/FilterContext.tsx` |
| `compileFilters()` | internal | FilterState -> SQL WHERE | Operational at `src/filters/compiler.ts` |
| `primitives-gallery.css` | internal | Gallery layout CSS tokens | Exists at `src/styles/primitives-gallery.css` |
| `primitives-list.css` | internal | List layout CSS tokens | Exists at `src/styles/primitives-list.css` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useVirtualizedList` | internal | TanStack Virtual wrapper for linear lists | ListView scroll container |
| `useVirtualizedGrid` | internal | TanStack Virtual wrapper for 2D grid | GalleryView (if 2D virtualization needed) |
| `useListData` | internal | PAFV-aware grouping for list views | ListView grouping logic |
| `GalleryCard` | internal | Card component for gallery | GalleryView card renderer |
| `lucide-react` | installed | Icon library (ChevronRight, ChevronDown) | ListView expand/collapse toggles |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useVirtualizedList` (existing) | Raw `useVirtualizer` from TanStack | Existing hook already tuned; use it |
| CSS Grid auto-fit (gallery) | TanStack 2D grid virtualization | CSS Grid handles responsive columns naturally; single-axis virtualization (rows) is sufficient |
| Recursive React tree (list) | D3 hierarchy | React is correct: tree expand/collapse state = application state |

**Installation:** No new packages needed. All dependencies are in `package.json`.

---

## Architecture Patterns

### Recommended File Structure

```
src/
├── components/
│   └── views/
│       ├── GalleryView.tsx        # NEW: Phase 110-01 deliverable
│       ├── ListView.tsx           # NEW: Phase 110-02 deliverable
│       ├── ListRow.tsx            # NEW: extracted row component
│       ├── GalleryCard.tsx        # EXISTS: card renderer (reuse)
│       ├── ListViewRenderer.tsx   # EXISTS: @deprecated class stub
│       └── GridViewRenderer.tsx   # EXISTS: @deprecated class stub
└── styles/
    ├── primitives-gallery.css     # EXISTS: CSS tokens for gallery
    └── primitives-list.css        # EXISTS: CSS tokens for list
```

### Pattern 1: Filter-Aware Data Fetching (VERIFIED)

Both views use `useFilteredNodes` which integrates `FilterContext` + `useSQLiteQuery`:

```typescript
// Source: src/hooks/data/useFilteredNodes.ts
import { useFilteredNodes } from '@/hooks/data/useFilteredNodes';
import { useSelection } from '@/state/SelectionContext';

function GalleryView() {
  const { data: nodes, loading, error } = useFilteredNodes();
  const { select, isSelected } = useSelection();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="gallery-container">
      {nodes?.map(node => (
        <GalleryCard
          key={node.id}
          card={node}
          selected={isSelected(node.id)}
          onClick={() => select(node.id)}
        />
      ))}
    </div>
  );
}
```

**Key insight:** `useFilteredNodes` already integrates with `FilterContext` and handles the SQL compilation. No need to call `compileFilters` directly in view components.

### Pattern 2: Selection Context API (VERIFIED)

```typescript
// Source: src/state/SelectionContext.tsx
import { useSelection } from '@/state/SelectionContext';

const {
  select,           // Single select (replaces selection, sets anchor)
  toggle,           // Cmd+click toggle
  selectRange,      // Shift+click range select
  selectMultiple,   // Multi-select (header click, lasso)
  isSelected,       // Check if ID is selected
  registerScrollToNode,    // Register view's scroll function
  unregisterScrollToNode,  // Cleanup on unmount
} = useSelection();

// Register scroll-to-node on mount
useEffect(() => {
  const scrollFn = (id: string) => {
    const index = nodes.findIndex(n => n.id === id);
    if (index >= 0) {
      virtualizer.scrollToIndex(index, { align: 'center' });
    }
  };
  registerScrollToNode(scrollFn);
  return () => unregisterScrollToNode();
}, [nodes, virtualizer, registerScrollToNode, unregisterScrollToNode]);
```

### Pattern 3: TanStack Virtual Row-Only Virtualization (VERIFIED)

For Gallery, use single-axis (row) virtualization + CSS Grid for columns:

```typescript
// Source: src/hooks/performance/useVirtualizedList.ts
import { useVirtualizedList } from '@/hooks/performance/useVirtualizedList';

const {
  containerRef,
  virtualItems,
  totalSize,
  scrollToIndex,
  isScrolling,
} = useVirtualizedList(rowCount, {
  containerHeight: height,
  estimateSize: rowHeight,
  overscan: 5,
});

// Render only visible rows
{virtualItems.map(virtualRow => (
  <div
    key={virtualRow.key}
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: virtualRow.size,
      transform: `translateY(${virtualRow.start}px)`,
    }}
  >
    {/* Row content - CSS Grid handles columns */}
    <div className="gallery-row">
      {getRowItems(virtualRow.index).map(node => (
        <GalleryCard key={node.id} card={node} />
      ))}
    </div>
  </div>
))}
```

### Pattern 4: useListData for PAFV-Aware Grouping (VERIFIED)

```typescript
// Source: src/hooks/data/useListData.ts
import { useListData } from '@/hooks/data/useListData';

function ListView() {
  const {
    groups,       // Grouped nodes (if grouping enabled)
    flatNodes,    // All nodes sorted
    sortAxis,     // PAFV Y-axis mapping
    sortFacet,    // Current sort facet
    isGrouped,    // Whether grouping is active
    loading,
    error,
  } = useListData(true); // true = enable grouping

  // groups is ListGroup[] = { key: string, label: string, nodes: Node[] }[]
}
```

### Pattern 5: CSS Grid for Gallery Layout (VERIFIED)

```css
/* Source: src/styles/primitives-gallery.css */
.gallery-container {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(var(--iso-gallery-card-w, 220px), 1fr)
  );
  gap: var(--iso-gallery-gap, 12px);
  padding: var(--iso-gallery-pad, 24px);
}
```

### Pattern 6: ListView ARIA Tree Structure

```tsx
// WAI-ARIA tree pattern
<div
  role="tree"
  aria-label="List view"
  onKeyDown={handleKeyDown}
>
  {groups.map((group, groupIndex) => (
    <div key={group.key} role="none">
      <div
        role="treeitem"
        aria-expanded={expandedGroups.has(group.key)}
        aria-level={1}
        aria-setsize={groups.length}
        aria-posinset={groupIndex + 1}
        tabIndex={focusedId === group.key ? 0 : -1}
        onClick={() => toggleGroup(group.key)}
      >
        <ChevronRight className={expandedGroups.has(group.key) ? 'rotate-90' : ''} />
        {group.label} ({group.nodes.length})
      </div>
      {expandedGroups.has(group.key) && (
        <div role="group">
          {group.nodes.map((node, itemIndex) => (
            <div
              key={node.id}
              role="treeitem"
              aria-level={2}
              aria-setsize={group.nodes.length}
              aria-posinset={itemIndex + 1}
              aria-selected={isSelected(node.id)}
              tabIndex={focusedId === node.id ? 0 : -1}
              onClick={() => select(node.id)}
            >
              <ListRow node={node} />
            </div>
          ))}
        </div>
      )}
    </div>
  ))}
</div>
```

### Anti-Patterns to Avoid

- **Don't use the complex `VirtualizedGrid`/`VirtualizedList` components** - they include live query support and are 500+ lines. Use the simpler `useVirtualizedList` hook directly.
- **Don't use the legacy class-based renderers** (`ListViewRenderer`, `GridViewRenderer`) - they are deprecated stubs.
- **Don't put tree expand/collapse state in a context** - it's ephemeral UI state, belongs in `useState`.
- **Don't use D3 for the list tree** - tree expand/collapse is application state (React owns it).
- **Don't forget to register/unregister `scrollToNode`** - both views must register a scroll function on mount.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom windowing | `useVirtualizedList` hook | Already built, handles edge cases |
| Filtered node fetching | Manual SQL + filter compilation | `useFilteredNodes()` | Integrates FilterContext automatically |
| Selection state | Local selectedId state | `useSelection()` from SelectionContext | Cross-canvas sync, range select built in |
| Node type transformation | Custom row mapping | `rowToNode()` from `src/types/node.ts` | Maps raw sql.js rows to typed Node |
| PAFV-aware grouping | Manual group by facet | `useListData()` | Reads PAFV Y-axis, sorts and groups |
| Gallery card rendering | New card component | `GalleryCard` from `src/components/views/` | Already exists with CSS token integration |

**Key insight:** Phase 110's job is composition, not construction. The infrastructure is ready.

---

## Common Pitfalls

### Pitfall 1: Column Count vs CSS Grid auto-fit Conflict

**What goes wrong:** Providing explicit `columnCount` to TanStack Virtual while CSS Grid uses `auto-fit`, causing layout conflicts.

**How to avoid:** Use CSS Grid `auto-fit` for columns (responsive). Use TanStack Virtual only for row virtualization (single-axis). Calculate rows as `Math.ceil(nodes.length / columnsPerRow)` where columnsPerRow is derived from container width.

**Warning signs:** Gallery shows wrong number of columns, or items overflow.

### Pitfall 2: Stale Virtual Items on Filter Change

**What goes wrong:** Virtual list renders stale items briefly after filter change because virtualizer hasn't recalculated.

**How to avoid:** Key the virtualizer on `nodes.length` or use `scrollToIndex(0)` when nodes change significantly.

**Warning signs:** Brief flash of wrong items when filter changes.

### Pitfall 3: Missing ScrollToNode Registration

**What goes wrong:** External `scrollToNode` calls (from cross-canvas sync) have no effect.

**How to avoid:** Both views must call `registerScrollToNode(scrollFn)` on mount and `unregisterScrollToNode()` on unmount.

**Warning signs:** Selecting a card from Capture canvas doesn't scroll Preview to it.

### Pitfall 4: ARIA Tree Keyboard Navigation with Virtualization

**What goes wrong:** Arrow keys try to focus DOM elements that aren't rendered.

**How to avoid:** Use index-based focus state (`focusedIndex`), not DOM traversal. On arrow key, update index and call `scrollToIndex()` to ensure item is rendered.

**Warning signs:** Arrow keys don't work or focus invisible items.

### Pitfall 5: ListView Groups from Wrong PAFV Axis

**What goes wrong:** List groups by `folder` when PAFV has different hierarchy axis.

**How to avoid:** `useListData` reads PAFV Y-axis mapping automatically. Trust its `sortAxis`/`sortFacet` values.

**Warning signs:** List grouping doesn't change when PAFV axis changes.

---

## Code Examples

### GalleryView Structure

```typescript
// src/components/views/GalleryView.tsx
import { useRef, useEffect, useMemo, useCallback } from 'react';
import { useFilteredNodes } from '@/hooks/data/useFilteredNodes';
import { useSelection } from '@/state/SelectionContext';
import { useVirtualizedList } from '@/hooks/performance/useVirtualizedList';
import { GalleryCard } from './GalleryCard';
import '@/styles/primitives-gallery.css';

const CARD_WIDTH = 220; // --iso-gallery-card-w
const CARD_HEIGHT = 160; // --iso-gallery-card-h
const GAP = 12; // --iso-gallery-gap

export function GalleryView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: nodes, loading, error } = useFilteredNodes();
  const { select, isSelected, registerScrollToNode, unregisterScrollToNode } = useSelection();

  // Calculate columns from container width
  const [columns, setColumns] = useState(4);
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setColumns(Math.max(1, Math.floor(width / (CARD_WIDTH + GAP))));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Group nodes into rows
  const rows = useMemo(() => {
    if (!nodes) return [];
    const result: Node[][] = [];
    for (let i = 0; i < nodes.length; i += columns) {
      result.push(nodes.slice(i, i + columns));
    }
    return result;
  }, [nodes, columns]);

  // Virtualize rows
  const { containerRef: scrollRef, virtualItems, totalSize, scrollToIndex } = useVirtualizedList(
    rows.length,
    { containerHeight: 600, estimateSize: CARD_HEIGHT + GAP, overscan: 3 }
  );

  // Register scroll-to-node
  useEffect(() => {
    const scrollFn = (id: string) => {
      const nodeIndex = nodes?.findIndex(n => n.id === id) ?? -1;
      if (nodeIndex >= 0) {
        const rowIndex = Math.floor(nodeIndex / columns);
        scrollToIndex(rowIndex, { align: 'center' });
      }
    };
    registerScrollToNode(scrollFn);
    return () => unregisterScrollToNode();
  }, [nodes, columns, scrollToIndex, registerScrollToNode, unregisterScrollToNode]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div ref={containerRef} className="h-full w-full overflow-hidden">
      <div ref={scrollRef} className="h-full overflow-auto">
        <div style={{ height: totalSize, position: 'relative' }}>
          {virtualItems.map(virtualRow => (
            <div
              key={virtualRow.key}
              className="gallery-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: GAP,
                padding: `0 var(--iso-gallery-pad, 24px)`,
              }}
            >
              {rows[virtualRow.index]?.map(node => (
                <GalleryCard
                  key={node.id}
                  card={node}
                  selected={isSelected(node.id)}
                  onClick={() => select(node.id)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

### ListView Structure

```typescript
// src/components/views/ListView.tsx
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useListData } from '@/hooks/data/useListData';
import { useSelection } from '@/state/SelectionContext';
import { useVirtualizedList } from '@/hooks/performance/useVirtualizedList';
import { ChevronRight } from 'lucide-react';
import '@/styles/primitives-list.css';

const ROW_HEIGHT = 44; // --iso-list-row-h
const GROUP_HEIGHT = 36; // --iso-list-group-h

export function ListView() {
  const { groups, flatNodes, loading, error } = useListData(true);
  const { select, isSelected, registerScrollToNode, unregisterScrollToNode } = useSelection();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Flatten for virtualization
  const flatItems = useMemo(() => {
    if (!groups) return [];
    const result: Array<{ type: 'group'; key: string; label: string; count: number } | { type: 'item'; node: Node }> = [];
    groups.forEach(group => {
      result.push({ type: 'group', key: group.key, label: group.label, count: group.nodes.length });
      if (expandedGroups.has(group.key)) {
        group.nodes.forEach(node => result.push({ type: 'item', node }));
      }
    });
    return result;
  }, [groups, expandedGroups]);

  // Virtualize
  const { containerRef, virtualItems, totalSize, scrollToIndex } = useVirtualizedList(
    flatItems.length,
    {
      containerHeight: 600,
      estimateSize: (index) => flatItems[index]?.type === 'group' ? GROUP_HEIGHT : ROW_HEIGHT,
      overscan: 10,
    }
  );

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // Register scroll-to-node
  useEffect(() => {
    const scrollFn = (id: string) => {
      const index = flatItems.findIndex(item =>
        item.type === 'item' && item.node.id === id
      );
      if (index >= 0) scrollToIndex(index, { align: 'center' });
    };
    registerScrollToNode(scrollFn);
    return () => unregisterScrollToNode();
  }, [flatItems, scrollToIndex, registerScrollToNode, unregisterScrollToNode]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // ... roving tabindex implementation
  }, [flatItems, focusedId, expandedGroups]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div
      ref={containerRef}
      role="tree"
      aria-label="List view"
      onKeyDown={handleKeyDown}
      className="h-full overflow-auto"
    >
      <div style={{ height: totalSize, position: 'relative' }}>
        {virtualItems.map(virtualItem => {
          const item = flatItems[virtualItem.index];
          if (!item) return null;

          if (item.type === 'group') {
            return (
              <div
                key={item.key}
                role="treeitem"
                aria-expanded={expandedGroups.has(item.key)}
                aria-level={1}
                tabIndex={focusedId === item.key ? 0 : -1}
                className="list-group-header"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: virtualItem.size,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                onClick={() => toggleGroup(item.key)}
              >
                <ChevronRight className={expandedGroups.has(item.key) ? 'rotate-90' : ''} />
                <span>{item.label}</span>
                <span className="list-group-count">{item.count}</span>
              </div>
            );
          }

          return (
            <div
              key={item.node.id}
              role="treeitem"
              aria-level={2}
              aria-selected={isSelected(item.node.id)}
              tabIndex={focusedId === item.node.id ? 0 : -1}
              className="list-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
                paddingLeft: 'var(--iso-list-indent, 24px)',
              }}
              onClick={() => select(item.node.id)}
            >
              {item.node.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## What Exists vs. What to Build

### Already Built

| Asset | Location | Status |
|-------|----------|--------|
| `primitives-gallery.css` | `src/styles/primitives-gallery.css` | Complete (59 lines) |
| `primitives-list.css` | `src/styles/primitives-list.css` | Complete (63 lines) |
| `useSQLiteQuery` | `src/hooks/database/useSQLiteQuery.ts` | Complete (240 lines) |
| `useFilteredNodes` | `src/hooks/data/useFilteredNodes.ts` | Complete (100 lines) |
| `useListData` | `src/hooks/data/useListData.ts` | Complete (200 lines) |
| `useVirtualizedList` | `src/hooks/performance/useVirtualizedList.ts` | Complete (226 lines) |
| `SelectionContext` | `src/state/SelectionContext.tsx` | Complete (186 lines) |
| `FilterContext` | `src/state/FilterContext.tsx` | Complete (412 lines) |
| `compileFilters` | `src/filters/compiler.ts` | Complete (351 lines) |
| `GalleryCard` | `src/components/views/GalleryCard.tsx` | Complete (82 lines) |
| `GridContinuumSwitcher` | `src/components/supergrid/GridContinuumSwitcher.tsx` | Complete (141 lines) |

### Must Build in Phase 110

| Asset | Location | Notes |
|-------|----------|-------|
| `GalleryView.tsx` | `src/components/views/GalleryView.tsx` | New: row-virtualized grid using CSS auto-fit |
| `ListView.tsx` | `src/components/views/ListView.tsx` | New: PAFV-aware tree with ARIA roles |
| `ListRow.tsx` | `src/components/views/ListRow.tsx` | New: extracted row component for list items |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Class-based `ListViewRenderer` | Functional `ListView.tsx` | Phase 110 | Deprecated stubs replaced |
| D3-based tree rendering | React tree with useState | Phase 110 | Tree expand state is application state |
| Manual filter compilation in views | `useFilteredNodes` hook | Pre-Phase 110 | Views don't touch SQL directly |
| Complex `VirtualizedGrid` component | Simple `useVirtualizedList` hook | Phase 110 | Purpose-built views, not generic components |

**Deprecated/outdated:**
- `src/components/views/ListViewRenderer.tsx`: @deprecated class stub
- `src/components/views/GridViewRenderer.tsx`: @deprecated class stub
- `src/components/views/TreeView.tsx`: D3-based tree (not suitable for React state)
- `src/components/VirtualizedGrid/index.tsx`: 599 lines, too complex for Phase 110 needs
- `src/components/VirtualizedList/index.tsx`: 509 lines, too complex for Phase 110 needs

---

## Open Questions

1. **Gallery: How many columns at different breakpoints?**
   - What we know: CSS `auto-fit` with `minmax(220px, 1fr)` is responsive.
   - What's unclear: Should we enforce specific breakpoints (mobile: 1col, tablet: 2-3col, desktop: 4+col)?
   - Recommendation: Let CSS `auto-fit` handle it naturally. The 220px min-width creates natural responsive behavior.

2. **ListView: Expand all groups by default?**
   - What we know: `expandedGroups` is `useState<Set<string>>()` starting empty.
   - What's unclear: Should all groups start expanded, or all collapsed?
   - Recommendation: Start expanded. Users expect to see data. Collapsing is a declutter action.

3. **Performance target verification**
   - What we know: REQ-A-01 requires 60 FPS at 500+ items.
   - What's unclear: How to measure FPS in Vitest?
   - Recommendation: Use `useFPSMonitor` hook for dev mode. For tests, verify that virtualization threshold kicks in (VIRTUALIZATION_THRESHOLD = 100 in `useVirtualizedGrid`).

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/hooks/database/useSQLiteQuery.ts` - verified implementation
- Codebase: `src/hooks/data/useFilteredNodes.ts` - verified integration
- Codebase: `src/hooks/data/useListData.ts` - verified PAFV grouping
- Codebase: `src/hooks/performance/useVirtualizedList.ts` - verified TanStack Virtual v3 wrapper
- Codebase: `src/state/SelectionContext.tsx` - verified API (select, toggle, registerScrollToNode)
- Codebase: `src/state/FilterContext.tsx` - verified LATCH filter state
- Codebase: `src/filters/compiler.ts` - verified LATCH to SQL compiler
- Codebase: `src/styles/primitives-gallery.css` - verified CSS tokens
- Codebase: `src/styles/primitives-list.css` - verified CSS tokens
- Codebase: `src/components/views/GalleryCard.tsx` - verified card component
- Codebase: `package.json` - `@tanstack/react-virtual: ^3.13.18` confirmed

### Secondary (MEDIUM confidence)

- WAI-ARIA Authoring Practices 1.2 - Tree View pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/)
- TanStack Virtual v3 docs - `useVirtualizer` hook API

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all dependencies confirmed in package.json and src/
- Architecture: HIGH - patterns derived from existing working code
- Pitfalls: HIGH - derived from direct code analysis
- What exists vs. what to build: HIGH - read all relevant files

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days - stable stack)
