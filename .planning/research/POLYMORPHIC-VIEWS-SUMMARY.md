# Polymorphic Views Research Summary

**Project:** Isometry v6.9 — Polymorphic View Continuum
**Researched:** 2026-02-16
**Overall Confidence:** HIGH (architecture), MEDIUM (implementation details)

---

## What You Asked

1. **Gallery/List/Kanban — CSS Grid or D3?**
2. **Network/Timeline — How to wire SQL data hooks?**
3. **Three-Canvas — How to coordinate selection & data flow?**
4. **Mode switching — How to wire GridContinuumController?**

---

## What We Found

### 1. Gallery/List/Kanban Should Use React + CSS Grid

**Why:** SuperGrid already does this successfully. Consistency matters more than reusing D3.

| View | Tech | Rationale |
|------|------|-----------|
| Gallery | React + CSS Grid + Masonry | Simpler layout, faster DOM updates |
| List | React + CSS | Hierarchical tree rendering natural in JSX |
| Kanban | React + CSS Grid | Facet columns simple to build with CSS Grid |
| Network | D3.js | Force simulation requires SVG |
| Timeline | D3.js | ScaleTime + D3 spatial layouts |
| SuperGrid | React + CSS Grid | Already established (hybrid: CSS for grid, D3 for header animation) |

**Implementation pattern:** All views inherit from a single `<ViewDispatcher>` component that routes based on `activeView` state.

### 2. Network/Timeline Wire to SQL via Same Pattern as SuperGrid

**Current problem:** ForceGraphRenderer and TimelineRenderer are standalone. They don't talk to FilterContext.

**Solution:** Wrap them in React components that:
1. Query data with `useSQLiteQuery()` using FilterContext filters
2. Call D3 renderer in useEffect
3. Re-render on data change

```typescript
// Pattern used by all views
export function NetworkView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();

  // 1. Query using same pattern as SuperGrid
  const nodeData = useSQLiteQuery(db, `
    SELECT * FROM nodes WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
  `);

  // 2. D3 render in effect
  useEffect(() => {
    if (!nodeData) return;
    createForceGraph(container, nodeData, ...);
  }, [nodeData]);

  return <svg ref={container} />;
}
```

This is **not a new pattern.** It's what SuperGrid already does.

### 3. Three-Canvas Coordinates via Provider Composition

**Architecture:**

```
<App>
  ├─ DatabaseProvider (sql.js)
  ├─ FilterProvider (LATCH filters)
  ├─ PAFVProvider (axis mappings)
  ├─ SelectionProvider (selected IDs) ← KEY: Global, survives view switches
  ├─ AppStateProvider (activeView)
  └─ NotebookProvider (notebook state) ← NEW
      └─ NotebookLayout
          ├─ CapturePane (TipTap editor)
          ├─ ShellPane (Terminal)
          └─ PreviewPane
              └─ <ViewDispatcher> ← Routes to Gallery/List/Network/etc.
```

**Data flow:**
- **Capture → Preview:** Create card (INSERT) → all preview views re-query
- **Preview → Selection:** Click card in SuperGrid → SelectionContext updates → other views highlight it
- **Filter → All views:** Change filter → all active views re-query

**Key insight:** No special coordination needed. React contexts flow naturally. All views are subscribers to the same state.

### 4. GridContinuumController Validates Mode Switches

```typescript
export class GridContinuumController {
  switchMode(newMode: GridContinuumMode, pafvState: PAFVState): boolean {
    const required = { gallery: 0, list: 1, kanban: 1, grid: 2, supergrid: 3 }[newMode];
    const current = pafvState.mappings.length;

    if (current < required) {
      // Can't switch: not enough axes
      return false;
    }

    return true;
  }
}
```

**Called by:** GridContinuumSwitcher UI component before calling `setActiveView()`.

---

## The Unified Pattern

**All views use this pattern.** No exceptions:

```typescript
export function AnyView() {
  // 1. Get dependencies
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const { state: pafvState } = usePAFV();
  const { selectedIds } = useSelection();

  // 2. Query data once
  const data = useSQLiteQuery(db, `
    SELECT * FROM nodes
    WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
    ORDER BY ${compilePafvToOrderBy(pafvState)}
  `);

  // 3. React: render with selection state
  return (
    <div className="any-view">
      {data?.map(card => (
        <Card
          key={card.id}
          card={card}
          isSelected={selectedIds.has(card.id)}
          onClick={() => select(card.id)}
        />
      ))}
    </div>
  );
}
```

That's it. For D3 views, add a useEffect that renders D3 in the hook.

---

## What Exists & What Needs Building

### Exists (No Changes Needed)

- FilterContext → SQL WHERE compilation
- PAFVContext → axis mapping management
- SelectionContext → global selection sync
- AppStateContext → activeView tracking
- useSQLiteQuery hook → basic pattern
- SuperGrid → working reference implementation
- ForceGraphRenderer, TimelineRenderer → D3 engines

### Build (New Components)

| Component | Effort | Priority |
|-----------|--------|----------|
| **ViewDispatcher** | 1 hour | P0 (foundation) |
| **GalleryView** | 3 hours | P1 (simple) |
| **ListView** | 2 hours | P1 (simple) |
| **KanbanView** | 4 hours | P1 (groupBy logic) |
| **NetworkView** (wrapper) | 1 hour | P2 (minimal change) |
| **TimelineView** (wrapper) | 1 hour | P2 (minimal change) |
| **GridContinuumController** | 1 hour | P1 (validation) |

### Modify (Non-Breaking)

- AppStateContext: Unify ViewName/ViewType enums (type cleanup)
- PreviewPane: Mount ViewDispatcher instead of hardcoded SuperGrid
- IntegratedLayout: Adopt ViewDispatcher if not using three-canvas

---

## SQL Query Pattern Across All Views

Same template used everywhere:

```sql
SELECT * FROM nodes
WHERE deleted_at IS NULL
  AND folder LIKE ? OR category IN (?, ?, ?)  -- FROM compileLatchFilters()
ORDER BY status, name  -- FROM compilePafvToOrderBy()
```

**One query per render.** No view-specific optimization needed. sql.js is synchronous in browser; context changes trigger re-renders which trigger new queries.

---

## Selection Preservation (Critical)

**How it works:**

1. User selects card in SuperGrid → SelectionContext updates
2. User switches to Network view → ViewDispatcher unmounts SuperGrid, mounts NetworkView
3. NetworkView mounts, reads SelectionContext → still has old selectedIds
4. NetworkView renders with selected cards highlighted
5. User selects different card in Network → SelectionContext updates
6. Selection now tracks Network selection
7. Switch back to SuperGrid → still has Network selections

**Pattern:** SelectionContext is global. It doesn't belong to a specific view. All views read/write the same Set<id>.

**Detection test:** Select 3 cards in SuperGrid. Switch to Timeline. Verify those 3 are still selected.

---

## Three-Canvas Pane Coordination (Implicit)

**Question:** How do panes know about each other?

**Answer:** Through shared contexts. No explicit messages needed.

- **Capture creates card** → db.execute() → Notifies database
- **Preview pane re-queries** → useSQLiteQuery() re-runs → data changes
- **All views that use that data re-render** → new card appears everywhere

- **Shell command changes filter** → setFilter() → FilterContext updates
- **Preview pane re-queries** → same WHERE clause, different results
- **All views update**

**Key:** No "notification" system needed. React context subscriptions handle it.

---

## Known Gotchas (Avoid These)

1. **Building each view with its own SQL query** → Duplicate logic, harder to fix filters
2. **Making selection view-specific** → Lose state on view switch
3. **D3 renderers not watching PAFV state** → Axis changes don't update visualizations
4. **Not validating grid mode requirements** → "Grid requires 2 axes" crashes happen
5. **Three-Canvas panes not using same hooks** → Panes get stale data

---

## Confidence Levels

| Aspect | Confidence | Why |
|--------|------------|-----|
| Architecture pattern | HIGH | Reviewed code, verified patterns exist |
| React + CSS Grid for tabular views | HIGH | SuperGrid proof of concept works |
| D3 wrapper pattern | HIGH | Inferred from SuperGrid successfully |
| ViewDispatcher design | MEDIUM | Not yet built, but straightforward |
| Three-Canvas coordination | MEDIUM | Contexts exist, coordination implicit |
| Performance (10K+ items) | LOW | Need virtualization research per view |

---

## Next Steps (From Here)

**Phase 1 (Week 1): Foundation**
1. Unify ViewName/ViewType enums in AppStateContext
2. Build ViewDispatcher component (router)
3. Build GridContinuumController (validator)

**Phase 2 (Week 2): Simple Views**
1. Build GalleryView (masonry + React)
2. Build ListView (hierarchy + React)
3. Build KanbanView (columns + groupBy)

**Phase 3 (Week 3): Complex Views**
1. Refactor NetworkView to use useSQLiteQuery hook
2. Refactor TimelineView to use useSQLiteQuery hook
3. Add PAFV support where needed

**Phase 4 (Week 4): Three-Canvas**
1. Wire PreviewPane with ViewDispatcher
2. Test cross-pane selection sync
3. Test filter propagation

**Phase 5 (Week 5): Polish**
1. Keyboard shortcuts (← → to switch views)
2. Smooth transitions (D3 morphs where possible)
3. Performance audit (virtualization for List/Kanban)

---

## Full Documentation

See detailed architecture breakdown in `.planning/research/ARCHITECTURE.md`:

- **Data Flow Scenarios** — 4 detailed examples
- **Component Boundaries** — what to build, what to modify, what to keep
- **Pitfalls & Detection** — 5 specific gotchas with tests
- **Build Order Rationale** — why this sequence
- **Integration Points** — where new code touches existing code

---

*Research by Claude Code on 2026-02-16*
*Confidence: HIGH for architecture, MEDIUM for implementation details*
*Ready for phase planning*
