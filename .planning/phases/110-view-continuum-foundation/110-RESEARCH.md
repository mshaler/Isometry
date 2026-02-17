# Phase 110: View Continuum Foundation — Research

**Researched:** 2026-02-16
**Domain:** React view renderers with TanStack Virtual, SQL data integration, PAFV axis allocation
**Confidence:** HIGH (codebase is the primary source; Context7 unavailable, verified against installed packages)

---

## Summary

Phase 110 builds the Gallery and List view renderers — the first two entries in the Grid Continuum (0-axis gallery, 1-axis list). The codebase already has all the infrastructure these views need: `useSQLiteQuery` is operational and fully typed, `@tanstack/react-virtual` v3.13.18 is installed and wrapped in working hooks (`useVirtualizedList`, `useVirtualizedGrid`), `SelectionContext` provides the `select()` API, `FilterContext` provides `activeFilters`, and `compileFilters()` turns LATCH state into SQL WHERE clauses.

The key discovery is that **most of the primitives are already built** — `VirtualizedGrid/index.tsx` and `VirtualizedList/index.tsx` are functional general-purpose virtualized containers. What Phase 110 must build are the **Isometry-specific view wrappers**: `GalleryView.tsx` (which applies `primitives-gallery.css` layout tokens) and `ListView.tsx` (which builds the PAFV-aware tree structure with proper ARIA roles). These are thin, purpose-built components that compose the existing infrastructure into semantically correct views.

The existing `HierarchyTreeView.tsx` is a filter panel widget, not a data view — it takes a pre-built `Tree` object and handles checkbox selection for filter state. The `ListView.tsx` for Phase 110 is different: it must fetch nodes from SQL, group them by the PAFV hierarchy axis allocation, and update `SelectionContext` on click.

**Primary recommendation:** Build `GalleryView.tsx` and `ListView.tsx` as thin wrappers over the existing `VirtualizedGrid`/`VirtualizedList` infrastructure, consuming `useSQLiteQuery` + `FilterContext` directly, and writing to `SelectionContext` on card click.

---

## Standard Stack

### Core (already installed — no new npm installs needed)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `@tanstack/react-virtual` | 3.13.18 | Virtual scrolling for 500+ items | Installed, wrapped in hooks |
| `useSQLiteQuery` | internal | SQL → Node[] data fetching | Operational at `src/hooks/database/useSQLiteQuery.ts` |
| `SelectionContext` | internal | Single card selection API | Operational at `src/state/SelectionContext.tsx` |
| `FilterContext` | internal | LATCH filter state | Operational at `src/state/FilterContext.tsx` |
| `compileFilters()` | internal | FilterState → SQL WHERE | Operational at `src/filters/compiler.ts` |
| `primitives-gallery.css` | Phase 109 | Gallery layout CSS tokens | Exists at `src/styles/primitives-gallery.css` |
| Tailwind CSS | 3.x | Component styling | Operational throughout codebase |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useVirtualizedList` | internal | TanStack Virtual wrapper for linear lists | ListView's scroll container |
| `useVirtualizedGrid` | internal | TanStack Virtual wrapper for 2D grid | GalleryView's scroll container |
| `GridContinuumController` | internal | Mode-to-SQL-projection mapping | When reading current view mode |
| `lucide-react` | installed | Icon library (ChevronRight, ChevronDown) | ListView expand/collapse toggles |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useVirtualizedList` (existing) | Raw `useVirtualizer` from TanStack | Existing hook is already tuned; use it |
| CSS Grid auto-fit (gallery) | Masonry via JS layout libs | CSS Grid auto-fit is the correct approach per `primitives-gallery.css` tokens |
| Recursive React tree (list) | D3 hierarchy | React is correct here: tree expand/collapse state = application state (survives reload for UX) |

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
│       ├── BaseViewRenderer.ts    # EXISTS: base class (not relevant — use functional components)
│       ├── GridViewRenderer.tsx   # EXISTS: legacy placeholder stub (@deprecated)
│       └── ListViewRenderer.tsx   # EXISTS: legacy placeholder stub (@deprecated)
└── styles/
    ├── primitives-gallery.css     # EXISTS: Phase 109 delivered — import this
    └── primitives-list.css        # NEW: create with --iso-list-* CSS tokens for list
```

### Pattern 1: Filter-Aware Data Fetching

Both views must react to `FilterContext` changes. The canonical pattern:

```typescript
// Source: src/hooks/database/useSQLiteQuery.ts + src/filters/compiler.ts
import { useFilters } from '@/state/FilterContext';
import { compileFilters } from '@/filters/compiler';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { useMemo } from 'react';
import { rowToNode, Node } from '@/types/node';

function GalleryView() {
  const { activeFilters } = useFilters();

  // Compile LATCH filters to SQL — stable reference
  const { sql, params } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      sql: `SELECT * FROM nodes WHERE ${compiled.sql} ORDER BY modified_at DESC`,
      params: compiled.params,
    };
  }, [activeFilters]);

  const { data: nodes, loading, error } = useSQLiteQuery<Node>(sql, params, {
    transform: (rows) => rows.map(rowToNode),
  });

  // ... render with nodes
}
```

**Key insight:** `useSQLiteQuery` re-runs automatically when `sql` or `params` change (via `useCallback` with `paramsKey`). No manual refetch needed when filters change.

### Pattern 2: Selection Integration

```typescript
// Source: src/state/SelectionContext.tsx
import { useSelection } from '@/state/SelectionContext';

// In card click handler:
const { select, isSelected } = useSelection();

const handleCardClick = useCallback((id: string) => {
  select(id); // Replaces selection, sets anchor
}, [select]);
```

### Pattern 3: TanStack Virtual Scroll Container (Gallery)

```typescript
// Source: src/hooks/performance/useVirtualizedList.ts (already wraps TanStack Virtual v3)
// For gallery (2D grid of cards), use useVirtualizedGrid or VirtualizedGrid component:
import { VirtualizedGrid } from '@/components/VirtualizedGrid';

// GalleryView applies CSS Grid for column layout, Virtual for row scroll:
<VirtualizedGrid
  items={nodes}
  columnCount={autoColumns}  // Derived from container width / card min-width
  estimateRowHeight={cardHeight}
  renderItem={(node, index) => (
    <GalleryCard
      node={node}
      selected={isSelected(node.id)}
      onClick={() => handleCardClick(node.id)}
    />
  )}
/>
```

**Important:** The `primitives-gallery.css` provides CSS custom properties (`--iso-gallery-card-w`, `--iso-gallery-card-h`, etc.) that should drive the `columnCount` and `estimateRowHeight` calculations. Use `getComputedStyle` or read via JS if needed, but simpler to derive from the known default values (220px wide, 160px tall, 12px gap).

### Pattern 4: PAFV-Aware Hierarchy for List View

The List view uses the PAFV `hierarchy` axis to build the tree structure. The PAFV axis `'hierarchy'` maps to the `folder` facet by default, giving a folder-based grouping. The SQL query for hierarchy:

```typescript
// Hierarchy grouping: group by folder, then list items under each folder
// Use PAFV axis allocation to determine the grouping column
const { activeFilters } = useFilters();
const compiled = compileFilters(activeFilters);

// Two-level query: fetch top-level groups, then items within
const groupSql = `
  SELECT DISTINCT folder as group_key
  FROM nodes
  WHERE ${compiled.sql}
  ORDER BY folder
`;

const itemSql = `
  SELECT * FROM nodes
  WHERE ${compiled.sql}
  ORDER BY folder, sort_order, name
`;
```

In practice for Phase 110 MVP, a simpler approach works: fetch all nodes, group in React by `folder` field, then use the tree component pattern.

### Pattern 5: ListView Tree Structure with ARIA

```typescript
// ARIA tree roles per WAI-ARIA spec
<ul role="tree" aria-label="List view">
  {groups.map(group => (
    <li key={group.key} role="none">
      <div role="treeitem" aria-expanded={expanded} aria-level={1}>
        {/* Group header with expand/collapse */}
      </div>
      {expanded && (
        <ul role="group">
          {group.items.map(node => (
            <li key={node.id} role="treeitem" aria-level={2}>
              {/* Card row */}
            </li>
          ))}
        </ul>
      )}
    </li>
  ))}
</ul>
```

**Keyboard navigation pattern:**
- ArrowDown/ArrowUp: move focus between visible treeitem elements
- ArrowRight: expand collapsed item or move to first child
- ArrowLeft: collapse expanded item or move to parent
- Enter/Space: select focused item
- Use `tabIndex={0}` on focused item, `tabIndex={-1}` on others (roving tabindex pattern)

### Anti-Patterns to Avoid

- **Don't use `useVirtualLiveQuery`** for Phase 110 — it's a more complex live query system with cache and polling. `useSQLiteQuery` is the correct choice here.
- **Don't use the legacy class-based renderers** (`ListViewRenderer`, `GridViewRenderer`) — they are deprecated stubs.
- **Don't put tree expand/collapse state in a context** — it's ephemeral UI state, belongs in `useState` within the component.
- **Don't use D3 for the list tree** — tree expand/collapse is application state (React owns it per the Phase 109 litmus test: "If lost on reload, does user lose work?" For a selection context: yes; for expand state: arguably yes for UX reasons, so React is correct).
- **Don't forget to register/unregister `scrollToNode`** in `SelectionContext` — both views should register a `scrollToNode` function on mount so cross-canvas scrolling works.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom windowing | `useVirtualizedList` / `useVirtualizedGrid` hooks | Already built, TanStack Virtual handles edge cases |
| LATCH filter SQL | Custom SQL builder | `compileFilters()` from `src/filters/compiler.ts` | Already handles all 5 LATCH axes |
| Selection state | Local selectedId state | `useSelection()` from `SelectionContext` | Cross-canvas sync, range select, scroll-to built in |
| Node type transformation | Custom row mapping | `rowToNode()` from `src/types/node.ts` | Maps raw sql.js rows to typed Node objects |
| Data fetching | Manual `db.exec()` | `useSQLiteQuery()` | Loading states, error handling, re-execution on change |

**Key insight:** Phase 110's job is wiring, not building. The infrastructure is ready. New code is the glue layer.

---

## Common Pitfalls

### Pitfall 1: Column Count Calculation for Gallery

**What goes wrong:** Using a fixed column count instead of deriving from container width, resulting in broken layouts at different screen sizes.

**Why it happens:** Gallery uses CSS Grid `auto-fit` with `--iso-gallery-card-w: 220px`. If the React component also provides a fixed `columnCount` prop to TanStack Virtual, they conflict.

**How to avoid:** Use a `ResizeObserver` (or `useCallback` with a ref) to measure the container width, then compute `columnCount = Math.floor(containerWidth / (cardWidth + gap))`. Alternatively, use only CSS Grid for column layout and only TanStack for row virtualization (single-axis approach).

**Warning signs:** Gallery shows only 1-3 columns regardless of window size, or items overflow horizontally.

### Pitfall 2: Stale SQL Params Reference

**What goes wrong:** Passing `params` as a new array literal on every render causes `useSQLiteQuery` to re-execute on every render.

**Why it happens:** `useSQLiteQuery` memoizes params via `JSON.stringify(params)`, so a new array with same values is fine. But if `params` includes objects or the SQL changes unnecessarily, it can trigger redundant queries.

**How to avoid:** Wrap SQL and params computation in `useMemo` with `activeFilters` as the only dependency (as shown in Pattern 1 above).

**Warning signs:** Console shows database queries firing continuously even without user interaction.

### Pitfall 3: ListView Hierarchy from Wrong Axis

**What goes wrong:** List view groups by `folder` when the PAFV context has a different hierarchy axis allocated (e.g., `tags` or `status`).

**Why it happens:** The List view is supposed to read the PAFV `hierarchy` axis allocation to determine how to group nodes, not always use `folder`.

**How to avoid:** Read the PAFV context to get the hierarchy axis mapping, then use the `facet.sourceColumn` as the grouping column. For Phase 110 MVP, it's acceptable to default to `folder` with a TODO comment, but the architecture should support dynamic grouping.

**Warning signs:** List view doesn't update its grouping when user changes PAFV hierarchy axis in SuperGrid.

### Pitfall 4: Missing ScrollToNode Registration

**What goes wrong:** External `scrollToNode` calls (from cross-canvas sync) have no effect.

**Why it happens:** `SelectionContext` stores a `scrollToNode` ref that must be registered by the active view. If views don't call `registerScrollToNode` on mount and `unregisterScrollToNode` on unmount, the function is null.

**How to avoid:** Both `GalleryView` and `ListView` must register a scroll function using `useEffect` on mount.

**Warning signs:** Selecting a card from the Capture canvas doesn't scroll the Preview to that card.

### Pitfall 5: ARIA Tree Keyboard Navigation Loop

**What goes wrong:** Arrow key navigation gets stuck or doesn't work as expected with virtualized list items.

**Why it happens:** Virtual lists don't render all DOM elements. Arrow key navigation that relies on DOM `nextSibling` breaks when items outside the viewport aren't in the DOM.

**How to avoid:** Implement keyboard navigation via index-based state (`focusedIndex`) rather than DOM traversal. On ArrowDown, increment `focusedIndex` and call `scrollToIndex(focusedIndex)` to bring item into view.

**Warning signs:** Arrow key press focuses a non-visible item without scrolling, or wraps unexpectedly.

---

## Code Examples

Verified patterns from codebase analysis:

### useSQLiteQuery with LATCH filters

```typescript
// Source: src/hooks/database/useSQLiteQuery.ts + src/filters/compiler.ts
import { useMemo } from 'react';
import { useFilters } from '@/state/FilterContext';
import { compileFilters } from '@/filters/compiler';
import { useSQLiteQuery } from '@/hooks/database/useSQLiteQuery';
import { rowToNode, Node } from '@/types/node';

const { activeFilters } = useFilters();

const { sql: whereClause, params } = useMemo(
  () => compileFilters(activeFilters),
  [activeFilters]
);

const { data: nodes, loading } = useSQLiteQuery<Node>(
  `SELECT * FROM nodes WHERE ${whereClause} ORDER BY modified_at DESC`,
  params,
  { transform: (rows) => rows.map(rowToNode) }
);
```

### Gallery CSS Grid Layout

```css
/* Source: src/styles/primitives-gallery.css — ALREADY EXISTS from Phase 109 */
/* Gallery component applies these token classes to its container: */
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

### ListView ARIA tree pattern

```tsx
// WAI-ARIA tree pattern for ListView
<div
  role="tree"
  aria-label="List view"
  onKeyDown={handleKeyDown}  // Roving tabindex keyboard nav
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
        {/* group header */}
      </div>
      {expandedGroups.has(group.key) && (
        <div role="group">
          {group.items.map((node, itemIndex) => (
            <div
              key={node.id}
              role="treeitem"
              aria-level={2}
              aria-setsize={group.items.length}
              aria-posinset={itemIndex + 1}
              tabIndex={focusedId === node.id ? 0 : -1}
              aria-selected={isSelected(node.id)}
              onClick={() => { select(node.id); }}
            >
              {/* card row */}
            </div>
          ))}
        </div>
      )}
    </div>
  ))}
</div>
```

### TanStack Virtual v3 — single-axis for ListView

```typescript
// Source: src/hooks/performance/useVirtualizedList.ts — ALREADY BUILT
// ListView uses single-axis virtualization (vertical scroll only)
// Flat list of visible items (expanded group headers + visible children)
const flatItems = useMemo(() => {
  const result: Array<{ type: 'group'; key: string } | { type: 'item'; node: Node }> = [];
  groups.forEach(group => {
    result.push({ type: 'group', key: group.key });
    if (expandedGroups.has(group.key)) {
      group.items.forEach(node => result.push({ type: 'item', node }));
    }
  });
  return result;
}, [groups, expandedGroups]);

// Pass flatItems.length to useVirtualizedList
const { containerRef, virtualItems, totalSize } = useVirtualizedList(
  flatItems.length,
  {
    containerHeight,
    estimateSize: 44,  // ~44px per row
    overscan: 10,
  }
);
```

---

## What Exists vs. What to Build

### Already Built (Phase 109 + prior work)

| Asset | Location | Status |
|-------|----------|--------|
| `primitives-gallery.css` | `src/styles/primitives-gallery.css` | Complete — CSS tokens for gallery layout |
| `useSQLiteQuery` | `src/hooks/database/useSQLiteQuery.ts` | Complete — SQL fetching hook |
| `useVirtualizedList` | `src/hooks/performance/useVirtualizedList.ts` | Complete — TanStack Virtual wrapper |
| `useVirtualizedGrid` | `src/hooks/performance/useVirtualizedGrid.ts` | Complete — 2D TanStack Virtual wrapper |
| `VirtualizedGrid` | `src/components/VirtualizedGrid/index.tsx` | Complete — generic grid component |
| `VirtualizedList` | `src/components/VirtualizedList/index.tsx` | Complete — generic list component |
| `SelectionContext` / `useSelection` | `src/state/SelectionContext.tsx` | Complete — selection API |
| `FilterContext` / `useFilters` | `src/state/FilterContext.tsx` | Complete — LATCH filter state |
| `compileFilters` | `src/filters/compiler.ts` | Complete — LATCH → SQL compiler |
| `GridContinuumController` | `src/components/supergrid/GridContinuumController.ts` | Complete — mode definitions |
| `GridContinuumSwitcher` | `src/components/supergrid/GridContinuumSwitcher.tsx` | Complete — mode switcher UI |
| `HierarchyTreeView` | `src/components/HierarchyTreeView.tsx` | Exists — but it's a filter widget, not a data view |

### Must Build in Phase 110

| Asset | Location | Notes |
|-------|----------|-------|
| `GalleryView.tsx` | `src/components/views/GalleryView.tsx` | New: wraps VirtualizedGrid, consumes primitives-gallery.css tokens |
| `ListView.tsx` | `src/components/views/ListView.tsx` | New: PAFV-aware tree, ARIA roles, keyboard nav |
| `primitives-list.css` | `src/styles/primitives-list.css` | New: CSS tokens for list row heights, indent levels |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Class-based `ListViewRenderer` | Functional `ListView.tsx` | Phase 110 | Deprecated class stubs replaced with functional components |
| D3-based tree rendering | React tree with useState | Phase 110 | Tree expand state is application state; React is correct owner |
| Manual grid column calculation | CSS Grid `auto-fit` | Phase 109 | `primitives-gallery.css` provides CSS token-driven layout |
| `useVirtualLiveQuery` (complex) | `useSQLiteQuery` (simple) | Ongoing | For static fetch-on-filter-change, simpler hook is sufficient |

**Deprecated/outdated:**
- `src/components/views/ListViewRenderer.tsx`: `@deprecated` — the class-based renderer is a placeholder stub, not the target for Phase 110
- `src/components/views/GridViewRenderer.tsx`: `@deprecated` — same situation
- `src/components/views/TreeView.tsx`: D3-based tree with hardcoded folder grouping; useful as reference but not the target

---

## Open Questions

1. **Gallery: CSS-only columns vs. computed columnCount for TanStack**
   - What we know: `primitives-gallery.css` uses `auto-fit` which is pure CSS. TanStack Virtual's 2D mode needs an explicit `columnCount`.
   - What's unclear: Should gallery use CSS-only column layout (no horizontal virtualization) + TanStack only for rows? Or should it use TanStack 2D with computed column count?
   - Recommendation: Use single-axis TanStack (rows only) + CSS Grid for columns. This avoids the column count computation problem and lets CSS handle responsive columns naturally. Only row-level virtualization is needed for 500+ items.

2. **ListView: Which PAFV axis drives grouping?**
   - What we know: `PAFVContext` has `viewMode: 'grid' | 'list'` and `mappings: AxisMapping[]`. The hierarchy axis mapping holds the facet.
   - What's unclear: For Phase 110 MVP, should ListView always group by `folder`, or should it read the active PAFV hierarchy mapping?
   - Recommendation: For Phase 110 MVP, default to `folder` as the grouping column. Add a `groupByFacet` prop so the switcher can pass the PAFV hierarchy mapping later. Document this as a Phase 111 enhancement.

3. **Component file size limit**
   - What we know: CLAUDE.md enforces 300-line warn / 500-line error limits.
   - What's unclear: `GalleryView.tsx` with card component inline might approach 300 lines.
   - Recommendation: Extract the card renderer into a `GalleryCard.tsx` sub-component from the start. `ListView.tsx` should extract `ListRow.tsx` for the individual row renderer. This keeps each file under 200 lines.

---

## Sources

### Primary (HIGH confidence)

- Codebase: `src/hooks/database/useSQLiteQuery.ts` — complete implementation verified
- Codebase: `src/hooks/performance/useVirtualizedList.ts` — complete implementation verified
- Codebase: `src/hooks/performance/useVirtualizedGrid.ts` — complete implementation verified
- Codebase: `src/state/SelectionContext.tsx` — selection API verified
- Codebase: `src/state/FilterContext.tsx` — filter state API verified
- Codebase: `src/filters/compiler.ts` — LATCH to SQL compiler verified
- Codebase: `src/styles/primitives-gallery.css` — Phase 109 deliverable verified
- Codebase: `src/components/supergrid/GridContinuumController.ts` — mode definitions verified
- Codebase: `package.json` — `@tanstack/react-virtual: ^3.13.18` confirmed installed

### Secondary (MEDIUM confidence)

- WAI-ARIA Authoring Practices 1.2 — Tree View pattern (https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) — standard pattern, well established
- TanStack Virtual v3 docs — single-axis virtualizer API (verified against installed version 3.13.18, which uses `useVirtualizer` hook)

### Tertiary (LOW confidence — flag for validation)

- CSS Grid `auto-fit` with TanStack row-only approach: reasonable inference from `primitives-gallery.css` design, but the actual implementation in `GalleryView.tsx` should verify column count derivation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies confirmed in package.json and src/
- Architecture: HIGH — patterns derived from existing working code in the codebase
- Pitfalls: MEDIUM-HIGH — derived from code analysis (stale refs, ARIA keyboard nav are well-known React/a11y patterns)
- What exists vs. what to build: HIGH — read all relevant files directly

**Research date:** 2026-02-16
**Valid until:** 2026-03-16 (30 days — stable stack, no fast-moving dependencies)
