# Domain Pitfalls: Grid Continuum & Polymorphic Views

**Domain:** Multi-view data projection systems (Gallery/List/Kanban/Grid/Network/Timeline)
**Researched:** 2026-02-16
**Severity levels:** Critical (causes rewrites), Major (architectural debt), Minor (polish/UX)

---

## Critical Pitfalls (Rewrite Risk)

### Pitfall 1: Data Desynchronization Between Views

**What goes wrong:**
Different views render different data (e.g., SuperGrid shows 150 cards, Timeline shows 75 events). User edits card in SuperGrid, Timeline doesn't update. Data appears corrupted.

**Why it happens:**
- Each view maintains its own local copy of data (in-memory JS object)
- View A queries `SELECT * FROM nodes WHERE status = 'done'`
- View B queries `SELECT * FROM nodes WHERE created > 2025-01-01`
- User updates a card via View A; View B cache is stale

**Consequences:**
- User trust destroyed ("the app is broken")
- Requires full reload to resync (bad UX)
- Impossible to debug (data looks correct in DB, but views disagree)
- Leads to data corruption if user saves stale copy

**Prevention:**
1. **Single source of truth:** All views query live sql.js database, not cached objects
2. **Reactive updates:** When any view modifies data (`db.run()`), automatically trigger re-query for ALL views
3. **Query-driven data:** Each view's data is derived from its SQL query, not a cache
4. **Subscription pattern:** Views subscribe to "data changed" event, re-execute their query

**Detection:**
- Two views showing different card counts for same filter = data desync
- Timeline shows 10 events, but Grid row for that date shows 5 cards
- User edits card, one view updates but another doesn't
- Browser DevTools shows SQLite has new value, but React component doesn't

**Mitigation in Isometry:**
✓ Already prevented by design: `useSQLiteQuery` hook re-executes query on data change (sql.js file operations trigger re-query)
- Maintain this pattern strictly: no local caches in renderers
- All data mutations go through `db.run()` → automatic re-fetch

**Risk Level:** CRITICAL — Data desync is a showstopper

---

### Pitfall 2: View State Lost on Mode Switch

**What goes wrong:**
User views SuperGrid with 200 rows visible, scrolled to row 100. Switches to Timeline. Switches back to SuperGrid — scrolled to top again. User loses navigation context.

**Why it happens:**
- View state (scroll position, zoom level, selection, pane sizes) is not saved
- Each renderer has `useEffect(() => {...}, [data])` that resets scroll to 0
- No localStorage or context to persist state

**Consequences:**
- Users frustrated: "I was looking at Q3 data, where did it go?"
- Workflow broken: switch views to cross-reference, come back, lost position
- Requires extra clicks to navigate back to original position
- Feels amateurish compared to browsers/IDEs that preserve pane state

**Prevention:**
1. **Save state before switching:** `getTransitionState()` before destroying renderer
2. **Restore state after rendering:** `loadState()` after new renderer mounts
3. **Persist to localStorage:** State survives app reload
4. **Identify saved state by view mode:** Save/restore per mode independently
5. **Include all navigation state:** scroll x/y, zoom level, selection, filters, pane sizes

**Detection:**
- User notices: "Every time I switch views, I'm back at the top"
- Check DevTools: localStorage is empty after mode switch
- Scroll position resets to 0 when returning to previously viewed mode

**Mitigation in Isometry:**
- Implement `ViewStateStore` context
- Each renderer calls `saveState()` in `useEffect` cleanup
- Each renderer calls `loadState()` in `useEffect` mount
- Store in localStorage with key like `view-state:supergrid`

**Risk Level:** CRITICAL — Navigation context loss breaks UX completely

---

### Pitfall 3: Drag-Drop Without Persistence

**What goes wrong:**
User drags card in Kanban from "To Do" to "In Progress". Card moves visually. User refreshes page — card is back in "To Do". User thinks it didn't save.

**Why it happens:**
- Drag-drop handler updates local React state immediately (optimistic UI)
- But never calls `db.run()` to persist to SQLite
- Or calls it but doesn't await, page refreshes before update completes

**Consequences:**
- Data looks saved but isn't (silent data loss)
- User loses trust in drag-drop (worse than no drag-drop)
- Duplicate work when user drags again because "it didn't work"
- Conflict if user drags simultaneously in two browser tabs

**Prevention:**
1. **Persist immediately after drag:** Call `db.run(UPDATE ...)` in `onDragEnd`
2. **Wait for persistence:** Await `db.run()`, show error if it fails
3. **Optimistic + rollback:** Show immediate visual feedback, then persist, rollback if fails
4. **Persist to both SQLite and IndexedDB:** Survive browser crash

**Example Pattern:**
```typescript
onDragEnd = async (event: DragEndEvent) => {
  // 1. Optimistic: update local state immediately
  const newCards = moveCard(cards, source, dest);
  setCards(newCards);

  // 2. Persist: save to SQLite
  try {
    db.run(
      "UPDATE nodes SET status = ? WHERE id = ?",
      [dest.status, cardId]
    );
    // 3. Verify: re-query to ensure consistency
    const verify = db.exec("SELECT * FROM nodes WHERE id = ?", [cardId]);
    if (verify[0].status !== dest.status) throw new Error("Persist failed");
  } catch (e) {
    // 4. Rollback if fail
    setCards(cards); // Restore old state
    showError("Failed to save drag-drop. Please try again.");
    return;
  }
};
```

**Detection:**
- User reports: "I drag card, it moves, then moves back after refresh"
- Check DevTools: React state updated, but SQLite unchanged
- Multi-tab test: Drag in tab A, refresh tab B, card not in new position

**Mitigation in Isometry:**
- All drag-drop handlers MUST call `db.run()` and await
- Show "Saving..." spinner during persist
- Show "Failed" toast with retry button if persist fails
- Never leave UI in state that doesn't match SQLite

**Risk Level:** CRITICAL — Silent data loss destroys trust

---

### Pitfall 4: PAFV Axis Allocation Confusion

**What goes wrong:**
GridContinuumController maps row_axis=category, col_axis=time. User switches to Kanban (which uses facets, not axes). Controller doesn't reset axis allocation. Kanban renders with wrong columns.

**Why it happens:**
- PAFV model has axes (x, y, z) for Grid/SuperGrid
- Kanban/Network have different dimension models (facets, topology)
- GridContinuumController has leftover axis allocation from previous view
- No validation that axis allocation matches view mode requirements

**Consequences:**
- Kanban shows wrong columns (e.g., "Time: 2025" instead of "Status: Done")
- Network shows wrong node grouping
- Requires understanding internal axis model to debug
- Hard to catch because "it renders something, just wrong data"

**Prevention:**
1. **Reset allocation on mode switch:** `controller.reset()` before `allocateAxes(mode)`
2. **View-specific allocation:** Each view has specific axis requirements, validate before render
3. **Type safety:** Use TypeScript enums to enforce allocation per mode
4. **Assertion:** Renderer asserts axis allocation matches its mode before rendering

**Example Pattern:**
```typescript
switch (mode) {
  case 'grid':
    // Grid requires 2 axes
    if (!allocation.x || !allocation.y) throw new Error("Grid needs x and y axes");
    break;
  case 'kanban':
    // Kanban uses facet column, no axes
    if (allocation.x || allocation.y) throw new Error("Kanban doesn't use axes");
    break;
  case 'network':
    // Network uses topology, no axes
    if (allocation.x || allocation.y) throw new Error("Network doesn't use axes");
    break;
}
```

**Detection:**
- Kanban columns labeled "2025-01-01" (time) instead of "Done" (status)
- Network shows nodes grouped by wrong dimension
- User says: "Gallery looked right, but Kanban is gibberish"

**Mitigation in Isometry:**
- GridContinuumController clears allocation on mode change
- Each renderer asserts its axis requirements on mount
- Throw error if allocation invalid; don't silently render wrong data

**Risk Level:** CRITICAL — Wrong data silently rendered is worse than no data

---

## Major Pitfalls (Architectural Debt)

### Pitfall 5: View-Specific SQL Instead of Generalized Query Builder

**What goes wrong:**
Each view has hardcoded SQL: Gallery has `SELECT *`, Grid has `SELECT ... GROUP BY`, Kanban has different `GROUP BY`, Timeline has `ORDER BY event_date`. Adding new view requires writing new SQL. Adding filter to one view requires updating N copies.

**Why it happens:**
- Tempting to optimize each view individually (faster to ship)
- Query patterns look different: Gallery is simple, Grid is complex
- Developer doesn't abstract common patterns (WHERE, filters, GROUP BY)

**Consequences:**
- Bug in filter logic requires fixing N versions of query
- New filter feature requires touching all N view query builders
- Hard to reason about: "Is SELECT A used in 2 views or 5?"
- Performance optimization (index) works for 1 view, breaks another
- Impossible to add new LATCH dimension without updating all views

**Prevention:**
1. **Single query builder:** `ViewQueryBuilder` generates SQL based on view mode + filters
2. **Layered SQL:** Base SELECT (filters, joins) → View-specific GROUP BY → sorting
3. **Pluggable clauses:** WHERE/ORDER BY/GROUP BY are swappable, not baked in
4. **Query testing:** Unit test each view's query generation independently

**Example Pattern:**
```typescript
class ViewQueryBuilder {
  buildQuery(mode: ViewMode, filters: LATCHFilters, axes: AxisAllocation): string {
    const select = this.buildSelect(mode, axes);
    const from = "FROM nodes LEFT JOIN edges ON ...";
    const where = this.buildWhere(filters);
    const groupBy = this.buildGroupBy(mode, axes);
    const orderBy = this.buildOrderBy(mode, axes);
    return `${select} ${from} ${where} ${groupBy} ${orderBy}`;
  }

  private buildSelect(mode: ViewMode, axes: AxisAllocation): string {
    switch (mode) {
      case 'grid': return "SELECT row_axis, col_axis, JSON_ARRAYAGG(id) as cards";
      case 'kanban': return "SELECT facet_value, JSON_ARRAYAGG(id) as cards";
      case 'gallery': return "SELECT *";
      // ...
    }
  }

  private buildGroupBy(mode: ViewMode, axes: AxisAllocation): string {
    switch (mode) {
      case 'grid': return `GROUP BY ${axes.x}, ${axes.y}`;
      case 'kanban': return `GROUP BY ${axes.facet}`;
      case 'gallery': return "";
      // ...
    }
  }
}
```

**Detection:**
- Grep for `SELECT * FROM nodes`: found in 5 different files
- Add filter to Kanban; Grid doesn't have it
- Developer says: "This bug only affects Timeline, other views are fine"

**Mitigation in Isometry:**
- ✓ Already designed: `ViewQueryBuilder.buildQuery()` centralizes logic
- Maintain this separation strictly
- Each view's query generated from builder, not hardcoded

**Risk Level:** MAJOR — Not a rewrite, but technical debt accumulates fast

---

### Pitfall 6: Selection State Sync Nightmare

**What goes wrong:**
User clicks card in SuperGrid (selected), switches to Timeline. Timeline doesn't show selected state. User thinks card is lost. Clicks again in Timeline — now SuperGrid is highlighted but Timeline isn't. Selection state is split between views.

**Why it happens:**
- Each renderer stores selection in local state (Redux, Context, or component state)
- No unified selection model across views
- Selection dispatch only updates source view, not subscribers
- React re-render order is wrong (view A updates before view B reads)

**Consequences:**
- Selection appears inconsistent across views
- User clicks same card in 2 views, both show selected independently
- Clicking in view A highlights it there, but clicking in view B unhighlights view A
- Users distrust the app: "It's randomly forgetting what I selected"

**Prevention:**
1. **Unified SelectionContext:** Single source of truth for selected node IDs
2. **View subscriptions:** All views listen to SelectionContext changes, re-render on update
3. **Dispatch pattern:** Any view can call `setSelectedIds()`, ALL views re-render
4. **Debouncing:** Batch selection updates to avoid cascading re-renders

**Example Pattern:**
```typescript
// SelectionContext.ts
export const SelectionContext = React.createContext<{
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}>({ selectedIds: new Set(), setSelectedIds: () => {} });

// In each renderer:
const { selectedIds, setSelectedIds } = useContext(SelectionContext);

// On card click:
onCardClick = (node) => setSelectedIds(new Set([node.id]));

// D3 binding:
d3.selectAll('circle')
  .style('opacity', d => selectedIds.has(d.id) ? 1 : 0.5);
```

**Detection:**
- User clicks card in SuperGrid, switches to Timeline, card not highlighted
- Open DevTools React Profiler: SelectionContext updated, but Timeline renderer didn't re-render
- Selection works in one view, not in another

**Mitigation in Isometry:**
- ✓ SelectionContext exists, already implemented
- Verify ALL renderers use it, not local state
- Test cross-view selection in integration tests

**Risk Level:** MAJOR — Makes multi-view system feel broken

---

### Pitfall 7: Performance Cliff at Scale

**What goes wrong:**
Gallery works fine with 100 items. Add 500 items — scroll freezes. Add 1000 items — impossible to use. Performance doesn't degrade gracefully.

**Why it happens:**
- Renderer renders all items in DOM (no virtual scrolling)
- Gallery renders 1000 `<div>` elements = 1000 DOM nodes = 50+ MB memory
- React reconciliation takes 500ms+ for single scroll event
- Browser can't hit 60 FPS, scroll feels laggy

**Consequences:**
- Product feels broken at any realistic data size
- Works great in demo with 50 items, fails in production
- Users blame app ("This is unusable")
- Only fixable with rewrite (adding virtual scrolling retroactively is hard)

**Prevention:**
1. **Virtual scrolling from day one:** Don't render all items, only visible + buffer
2. **Performance targets:** Define minimum performance (e.g., 60 FPS at 10K items)
3. **Canvas fallback:** SVG fine for <500 nodes; switch to Canvas for larger
4. **Test at scale:** Create test fixtures with 1K/10K/100K items, measure FPS
5. **Profile early:** Use React Profiler + Chrome DevTools, measure render time

**Example Metrics:**
```
Gallery with TanStack Virtual:
  - 100 items: 20ms render time, 60 FPS scroll
  - 1000 items: 25ms render time, 60 FPS scroll
  - 10000 items: 30ms render time, 60 FPS scroll

Gallery without virtual scrolling:
  - 100 items: 50ms render time, 60 FPS scroll
  - 1000 items: 500ms render time, 10 FPS scroll (UNUSABLE)
  - 10000 items: 3000ms render time, 1 FPS (BROKEN)
```

**Detection:**
- User says: "Works fine with 100 tasks, but my actual project has 2000"
- Chrome DevTools Performance tab shows 500ms+ render time per scroll
- React Profiler shows Gallery re-rendering all 1000 items on scroll

**Mitigation in Isometry:**
- ✓ TanStack Virtual already used in SuperGrid
- Apply to Gallery and List too
- Network/Timeline: virtual rendering by visible range (zoom culls offscreen nodes)
- Regular performance audits: test at 1K/10K/100K scale

**Risk Level:** MAJOR — Makes product unfit for real-world use

---

### Pitfall 8: D3 + React Integration Chaos

**What goes wrong:**
Network renderer uses D3 for force simulation. React component re-renders on state change. D3 simulation resets, nodes jitter. Or: D3 updates DOM directly while React is trying to manage it, both conflict, rendering breaks.

**Why it happens:**
- D3 is imperative ("run this simulation, update DOM")
- React is declarative ("given this state, render this JSX")
- Combining them requires careful boundary definition
- Easy to accidentally have both modifying same DOM elements

**Consequences:**
- Jittery node animation (simulation resets on re-render)
- React and D3 fight over DOM (some updates ignored, layout breaks)
- Hard to debug: "Why does selection not work?"
- Performance kills: D3 redraws entire graph on selection change

**Prevention:**
1. **Clear boundaries:** D3 owns one DOM subtree (SVG), React owns another (UI chrome)
2. **React ref-based mounting:** D3 renderer mounts to `ref`, owns entire subtree
3. **Avoid D3 in React render:** Use `useEffect` for D3 operations, not component body
4. **Data binding via context, not D3 selection:** Selection color comes from React Context, not D3 state

**Example Pattern:**
```typescript
// NetworkRenderer.tsx (React component)
const NetworkRenderer: React.FC<Props> = (props) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const { selectedIds } = useContext(SelectionContext);

  useEffect(() => {
    // 1. D3 owns this SVG element entirely
    const svg = d3.select(svgRef.current);

    // 2. Create/update simulation
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges))
      .on("tick", () => {
        d3.selectAll("circle")
          .attr("cx", d => d.x)
          .attr("cy", d => d.y)
          // 3. Bind selection state from React Context
          .style("opacity", d => selectedIds.has(d.id) ? 1 : 0.5);
      });

    return () => simulation.stop();
  }, [nodes, edges, selectedIds]); // Re-run if selection changes

  // 4. React only renders SVG container, D3 controls content
  return <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />;
};
```

**Detection:**
- User clicks node in Network, node color changes, but D3 position resets
- React DevTools shows re-render, DevTools element tree shows D3 SVG jittered
- Selection works in grid but not in Network

**Mitigation in Isometry:**
- NetworkRenderer and TimelineRenderer use D3 in `useEffect`, not component render
- SelectionContext drives D3 color/opacity via `useEffect` dependency
- Never let React and D3 both update same elements

**Risk Level:** MAJOR — Makes D3 views unreliable

---

## Minor Pitfalls (Polish/UX)

### Pitfall 9: Scroll Position Lost on Data Change

**What goes wrong:**
User scrolls Grid to row 50. Filter changes (via LATCH control). Grid re-queries, re-renders. User is back at row 0. User has to scroll back down.

**Why it happens:**
- Query result is new (different number of rows)
- React re-renders virtualized list from scratch
- Virtual scrolling index resets to 0
- No scroll position restoration logic

**Prevention:**
1. **Save scroll position before re-render:** `getScrollPosition()` before query changes
2. **Restore after re-render:** Map old scroll position to new result (might be invalid)
3. **Preserve index:** Remember "I was at row 50", restore to row 50 in new result

**Detection:**
- User scrolls to task, applies filter, task is off-screen
- Scroll position resets to top on every filter change

**Mitigation in Isometry:**
- Implement scroll restoration in GridRenderer and ListRenderer
- For virtual lists: `scrollToIndex(prevIndex)` or `scrollToItem(prevSelectedId)`

**Risk Level:** MINOR — UX friction, not a blocker

---

### Pitfall 10: Drag-Drop Without Touch Support

**What goes wrong:**
Kanban works fine with mouse drag-drop. User on iPad tries to drag card. Doesn't work. Or: works but feels unresponsive (0.5s latency).

**Why it happens:**
- HTML5 Drag & Drop API is mouse-only
- Touch events need different handling (Pointer Events)
- dnd-kit handles this, but only if configured correctly
- CSS `user-select: none` needed to prevent text selection during drag

**Prevention:**
1. **Use dnd-kit or react-beautiful-dnd:** Not HTML5 API directly
2. **Test on touch device:** iPad, phone, or touch-enabled laptop
3. **Pointer events, not mouse events:** dnd-kit handles this, just verify

**Detection:**
- Drag-drop works on desktop, doesn't on iPad
- Touch drag starts slow, then drops frames

**Mitigation in Isometry:**
- Use dnd-kit (already planned)
- Add `user-select: none` to draggable elements
- Test on iPad before shipping

**Risk Level:** MINOR — Affects mobile/tablet users, desktop works fine

---

### Pitfall 11: No Loading State During Slow Queries

**What goes wrong:**
User filters SuperGrid with 10K rows. Query takes 1 second. Grid appears frozen (no visual feedback). User thinks it's broken, clicks again.

**Why it happens:**
- Slow query executes, but no loading spinner shown
- React state hasn't updated yet
- Grid still renders old data
- User has no indication something is happening

**Prevention:**
1. **Show loading spinner immediately:** Set `isLoading = true` before query
2. **Disable interactions during load:** Disable buttons/drag to prevent duplicate actions
3. **Skeleton or placeholder:** Show shimmer/placeholder while loading
4. **Timeout warning:** If query >2 seconds, show "This is taking longer than usual..."

**Detection:**
- User reports: "Grid frozen for 2 seconds after clicking filter"
- No visual feedback of loading

**Mitigation in Isometry:**
- `useSQLiteQuery` hook should return `isLoading` state
- Each renderer shows spinner when `isLoading === true`
- Disable drag-drop/interactions during load

**Risk Level:** MINOR — Confusing UX, not data loss

---

### Pitfall 12: Animations Too Fast/Slow

**What goes wrong:**
Expand/collapse animation in List is 100ms. Too fast, feels instant, lacks polish. Change to 800ms. Too slow, feels sluggish, users get frustrated.

**Why it happens:**
- Transition duration is arbitrary guess
- Not tested with actual users
- 300-400ms is usually right for most animations

**Prevention:**
1. **Use 300-400ms for most animations:** Expand/collapse, panel resize, drag-drop
2. **Slow for important visual feedback:** 600-800ms for state changes users need to notice
3. **Fast for micro-interactions:** 100-150ms for hover effects
4. **Test with users:** Have actual users rate animation speed

**Detection:**
- Users say animation feels "too slow" or "too instant"
- Animation doesn't feel responsive but isn't fast enough to feel like instant

**Mitigation in Isometry:**
- Use consistent duration: 300ms for expand/collapse, drag feedback
- Make it configurable in settings (users with motion sensitivity)
- Test animation duration with real users

**Risk Level:** MINOR — Polish issue, doesn't affect functionality

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|-----------------|-----------|
| Track A | Gallery/List/Kanban MVP | Performance cliff at 1K+ items | Use virtual scrolling from day 1; test at 10K scale |
| Track A | Mode switching | View state lost between modes | Implement ViewStateStore (localStorage) before final polish |
| Track A | Drag-drop in Kanban | Persistence forgotten | Unit test: drag-drop MUST call `db.run()` |
| Track C | Network rendering | D3 + React chaos | Clear DOM boundary: D3 owns SVG, React owns chrome |
| Track C | Timeline zoom | Query-per-zoom kills performance | Cache zoomed ranges; query only visible time range |
| Track D | Three-Canvas layout | Selection not synced across panes | SelectionContext must wire all renderers |
| All | SQL generation | View-specific queries become unmaintainable | Centralize in ViewQueryBuilder, not per-view |
| All | Testing | Performance never tested at scale | Add 10K-item fixtures to performance tests |

---

## Risk Assessment

| Pitfall | Severity | Effort to Fix | Detection Difficulty |
|---------|----------|---------------|----------------------|
| Data desynchronization | CRITICAL | High (rewrite) | Easy (obvious to user) |
| View state lost | CRITICAL | Medium (add context + storage) | Easy (user notices immediately) |
| Drag-drop no persistence | CRITICAL | Low (add await) | Easy (user refreshes, sees change undone) |
| PAFV axis confusion | CRITICAL | Medium (add validation) | Hard (data looks right, just wrong grouping) |
| View-specific SQL | MAJOR | High (refactor queries) | Medium (accumulates over time) |
| Selection state split | MAJOR | Medium (implement context) | Easy (obvious in multi-view) |
| Performance cliff | MAJOR | Medium (add virtual scroll) | Hard (only visible at scale) |
| D3+React chaos | MAJOR | Medium (isolate D3) | Hard (jitter is subtle) |
| Scroll position lost | MINOR | Low (save/restore scroll) | Easy (user notices) |
| No touch support | MINOR | Low (dnd-kit already handles) | Easy (test on iPad) |
| No loading state | MINOR | Low (add spinner) | Easy (user sees frozen UI) |
| Animation timing | MINOR | Low (adjust duration) | Hard (subjective) |

---

## Mitigation Checklist

- [ ] **Data Sync:** All views query live sql.js, no local caches
- [ ] **View State:** Implement ViewStateStore, save/restore on mode switch
- [ ] **Drag-Drop:** All handlers await `db.run()`, show error on failure
- [ ] **PAFV Validation:** Renderer asserts axis allocation matches mode
- [ ] **Query Builder:** Single ViewQueryBuilder, not per-view SQL
- [ ] **Selection:** SelectionContext wires all renderers
- [ ] **Virtual Scrolling:** Gallery and List use TanStack Virtual
- [ ] **D3 Isolation:** D3 renderers use `useEffect`, not component render
- [ ] **Performance Testing:** Test at 1K/10K/100K scales, measure FPS
- [ ] **Touch Support:** Use dnd-kit, test on iPad
- [ ] **Loading States:** Show spinner during queries >500ms
- [ ] **Animation Timing:** Use 300ms for expand/collapse, 600ms for modals

---

## Sources

### Multi-View System Design
- [Figma's architecture: multiple views same data](https://www.figma.com/blog)
- [Observable: Reactive data visualization](https://observablehq.com)

### Virtual Scrolling
- [TanStack Virtual: Virtualizing large lists](https://tanstack.com/virtual/latest)
- [Performance cliff patterns](https://web.dev/virtualization/)

### D3 + React Integration
- [Modern D3 patterns in React (2026)](https://medium.com/nmc-techblog/using-react-with-d3-b34cc4cdf8a4)
- [Visx: D3 + React integration library](https://visx-demo.vercel.app/)

### Selection State Management
- [Redux Architecture: Normalized state](https://redux.js.org/usage/structuring-reducers)
- [React Context best practices](https://react.dev/reference/react/useContext)

### Drag-Drop UX
- [Dragging UI patterns (Eleken, 2026)](https://www.eleken.co/blog-posts/drag-and-drop-ui)
- [Touch-friendly drag-drop](https://www.w3c.org/TR/pointerevents/)

---

*Pitfall research for: Grid Continuum & Polymorphic Views (v6.9)*
*Researched: 2026-02-16*
*Risk Assessment: 4 CRITICAL, 4 MAJOR, 4 MINOR*
