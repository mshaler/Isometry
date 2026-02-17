# Architectural Decisions: Polymorphic Views

**Project:** Isometry v6.9
**Research Date:** 2026-02-16
**Decision Authority:** Architecture Review

---

## Decision 1: React + CSS Grid for Tabular Views (Gallery, List, Kanban)

### Decision
Use **React components with CSS Grid** for tabular/layout-based views, **not D3.js**.

### Options Considered

| Option | Tech Stack | Verdict |
|--------|-----------|---------|
| **A: React + CSS Grid** | React JSX, CSS Grid, optional Masonry lib | CHOSEN |
| **B: D3.js (all views)** | D3 SVG, force simulations, scales | Rejected |
| **C: Hybrid per view** | Mix of React and D3 depending on view | Rejected (too complex) |

### Rationale

**Performance:**
- CSS Grid: DOM-based, fast updates (O(n) re-renders)
- D3 SVG: SVG-based, slower for 10K+ items

**Consistency:**
- SuperGrid already uses React + CSS Grid
- Matching SuperGrid pattern reduces learning curve
- Single tech stack easier to maintain

**Features:**
- CSS Grid: Native virtualization, responsive, DnD compatible
- D3: Overkill for simple grid layouts

**Evidence:**
- SuperGrid (React + CSS Grid) is production-ready and fast
- No performance complaints with SuperGrid approach
- D3 best reserved for force simulations and spatial layouts

### Implementation
- Gallery: Masonry layout (React Grid Masonry or similar)
- List: CSS for hierarchy + React recursion
- Kanban: CSS Grid columns with React groupBy logic

### Consequence
- D3 only used for force graphs (Network) and time-series (Timeline)
- Simpler codebase (fewer D3 dependencies)
- Easier for new developers (React/CSS more familiar than D3)

---

## Decision 2: Unified useSQLiteQuery Hook for All Views

### Decision
**All views query the same filtered dataset** using `useSQLiteQuery()` with `compileLatchFilters()`. No view-specific SQL optimizations.

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Shared useSQLiteQuery** | One hook, all views use it | CHOSEN |
| **B: View-specific queries** | Each view implements its own SQL | Rejected |
| **C: GraphQL/query builder** | Abstract query layer | Rejected (overkill) |

### Rationale

**Data Consistency:**
- Single source of truth for filters
- All views always see same filtered rows
- No stale data scenarios

**Code Reuse:**
- No duplicate WHERE clause compilation
- Changes to FilterContext automatically propagate
- Easy to add/remove filters globally

**Simplicity:**
- SuperGrid already does this
- Pattern proven to work
- Lower cognitive load

**Performance:**
- sql.js queries are synchronous in browser
- No query optimization gain from view-specific queries
- Caching would happen at useSQLiteQuery level, not per-view

### Implementation
```typescript
// Template all views follow
const data = useSQLiteQuery(db, `
  SELECT * FROM nodes
  WHERE deleted_at IS NULL ${compileLatchFilters(filters)}
  ORDER BY ${orderByClause}
`);
```

### Consequence
- Filters always affect all visible views simultaneously
- No hidden/view-specific filtering (forces explicit UX)
- Database queries scale with data size, not view count

---

## Decision 3: ViewDispatcher as Route Component

### Decision
Create **ViewDispatcher** component that routes to correct view based on `activeView` state. Views are mounted/unmounted on mode change.

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: ViewDispatcher** | Router component, switch mounts/unmounts | CHOSEN |
| **B: Mega-component** | One component, conditional rendering | Rejected |
| **C: View context** | Context selects view renderer | Rejected |

### Rationale

**Component Boundaries:**
- Each view is isolated, testable
- Easy to add/remove views without touching other code
- Clear responsibility (dispatch logic vs rendering logic)

**State Management:**
- Old view's state cleaned up on unmount
- New view starts fresh with global contexts
- Selection state preserved via SelectionContext

**Scalability:**
- Adding view #8 doesn't touch existing views
- ViewDispatcher is dumb router, easy to understand
- Lazy loading possible (code splitting)

**Testing:**
- Each view testable independently
- ViewDispatcher tested as state→component mapper
- No tight coupling between views

### Implementation
```typescript
export function ViewDispatcher() {
  const { activeView } = useAppState();

  const views = {
    gallery: GalleryView,
    list: ListView,
    kanban: KanbanView,
    grid: GridView,
    supergrid: SuperGridView,
    network: NetworkView,
    timeline: TimelineView,
  };

  const ViewComponent = views[mapViewNameToMode(activeView)] || SuperGridView;
  return <ViewComponent />;
}
```

### Consequence
- View switching is unmount → mount (not state preservation)
- State must live in contexts, not component state
- Simpler code per view component (no conditional rendering)

---

## Decision 4: Global SelectionContext (Not View-Specific)

### Decision
**SelectionContext is global and survives view transitions.** No view owns its own selection.

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Global SelectionContext** | One Set<id> across all views | CHOSEN |
| **B: View-specific selection** | Each view tracks selectedIds separately | Rejected |
| **C: Hybrid (nested contexts)** | Per-view selection + global override | Rejected (too complex) |

### Rationale

**Cross-Canvas Sync:**
- Create card in Capture → select it in Preview → show it in Shell
- Without global selection, would need message passing between panes
- With global selection, it "just works" via context subscription

**User Expectation:**
- Select 3 items in SuperGrid
- Switch to Network
- Those 3 items are still selected (expected behavior)
- Switch back to SuperGrid
- Still selected (persistent)

**Operations:**
- Delete, archive, move, tag operations apply to selection
- "Currently selected" is a meaningful concept for the entire app
- Users think of selection as global property, not view property

**Implementation:**
- No changes needed to SelectionContext
- Each view's click handler calls `select()` / `toggle()` / `selectRange()`
- Each view reads `selectedIds` to apply highlights

### Consequence
- Selection state survives view transitions
- Creating new view doesn't require selection preservation logic
- Selection is orthogonal to view mode
- Users can select across different view types

---

## Decision 5: D3 Renderers Wrapped in React Components

### Decision
D3 force graphs (Network) and timelines (Timeline) are wrapped in React component containers that:
1. Query data via useSQLiteQuery
2. Call D3 renderer in useEffect
3. Re-render on data change

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Wrapped (React → D3)** | React component queries, useEffect calls D3 | CHOSEN |
| **B: Direct D3** | D3 renderer called directly, manages data | Rejected |
| **C: Custom hook** | useD3Graph hook abstracts D3 lifecycle | Rejected (premature) |

### Rationale

**Consistency:**
- Same pattern as SuperGrid (React queries, D3 renders)
- All views follow identical data flow
- Lower cognitive load

**Filter Integration:**
- React component reads FilterContext
- Passes compiled SQL to useSQLiteQuery
- D3 renderer always gets filtered data

**State Management:**
- React handles state (filters, selection, pafv)
- D3 handles visualization only
- Clear separation of concerns

**Testability:**
- React component testable separately (mocked D3)
- D3 renderer testable with mock data
- No tight coupling

### Implementation
```typescript
// All D3 views follow this pattern
export function NetworkView() {
  const { db } = useSQLite();
  const { filters } = useFilterContext();
  const containerRef = useRef<SVGGElement>(null);

  // React: query data
  const data = useSQLiteQuery(db, `SELECT ... WHERE ${compileLatchFilters(filters)}`);

  // React: D3 rendering in effect
  useEffect(() => {
    if (!containerRef.current || !data) return;
    createForceGraph(containerRef.current, data, ...);
  }, [data]);

  return <svg ref={containerRef} />;
}
```

### Consequence
- D3 renderers must be pure functions (data in, SVG out)
- No D3-managed state (filters, selection) — React owns state
- New D3 views follow same pattern

---

## Decision 6: Three-Canvas Coordination via Implicit Context Flow

### Decision
**No explicit message passing between Capture/Shell/Preview panes.** Coordination happens implicitly through shared contexts (FilterContext, SelectionContext, NotebookContext).

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Implicit (contexts)** | Panes subscribe to shared contexts | CHOSEN |
| **B: Event bus** | Panes emit events, others subscribe | Rejected |
| **C: Parent mediator** | NotebookLayout coordinates panes | Rejected |
| **D: Pane context** | Custom PaneContext for coordination | Rejected (redundant with other contexts) |

### Rationale

**Simplicity:**
- React contexts are built for this
- No additional abstraction needed
- Panes are dumb subscribers to state

**Loose Coupling:**
- Panes don't know about each other
- Add new pane without modifying others
- Easy to test each pane independently

**Explicit Data Flow:**
- Data flows through contexts, not hidden messages
- DevTools can trace context changes
- Easier to debug

**Evidence:**
- This is how SuperGrid + other features work currently
- Pattern proven in CardBoard-v3
- No special coordination logic needed for NotebookLayout

### Example: Capture Creates Card
```
1. CapturePane: /save-card command
   ↓
2. NotebookContext.createCard()
   ↓ (INSERT INTO nodes)
   ↓
3. Database mutated
   ↓
4. useSQLiteQuery() in PreviewPane detects change
   ↓
5. PreviewPane re-queries, all views update
   ↓
6. New card appears in SuperGrid, Network, etc.

   NO explicit "refresh" call. Implicit via context.
```

### Consequence
- Panes are fully decoupled
- Adding new pane is just another context subscriber
- No central coordinator (NotebookLayout stays dumb)
- Requires understanding React context subscription model

---

## Decision 7: Enumerate View Requirements (Grid Mode Validation)

### Decision
**Define axis requirements per view mode and validate before switching.**

Grid mode requirements:
- Gallery: 0 axes (position-only)
- List: 1 axis (y, hierarchical)
- Kanban: 1 axis (facet grouping)
- Grid: 2 axes (x, y)
- SuperGrid: 3+ axes (x, y, z+)

Network/Timeline ignore axis requirements (don't use PAFV).

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Validate before switch** | GridContinuumController validates | CHOSEN |
| **B: Auto-fix axes** | Switch mode, add missing axes | Rejected |
| **C: Allow invalid switch** | Let view handle missing axes | Rejected (crashes) |

### Rationale

**UX:**
- Prevents confusing errors ("Grid requires 2 axes")
- Shows helpful prompt ("Add Y-axis to use Grid mode")
- User knows why switch failed

**Consistency:**
- Same requirements every time
- Documented, testable
- Matches Grid Continuum definition

**Simplicity:**
- GridContinuumController is validation-only, not repair
- UI handles "can't switch" response
- No magic auto-fixing

### Implementation
```typescript
const controller = new GridContinuumController();
if (!controller.switchMode('grid', pafvState)) {
  showError("Grid requires 2 axes. Add one more dimension.");
  return; // Don't switch
}
setActiveView('Grid');
```

### Consequence
- Mode switches can fail (validated)
- UI must handle failure gracefully
- Users never see weird half-configured states

---

## Decision 8: Enum Unification (ViewName vs ViewType)

### Decision
**Unify AppStateContext.ViewName with types/view.ts.ViewType** using single enum.

Current state:
- AppStateContext: `ViewName = 'List' | 'Gallery' | 'Timeline' | ...` (capitalized)
- types/view.ts: `GridContinuumMode = 'gallery' | 'list' | ...` (lowercase)
- types/view.ts: `ViewType = GridContinuumMode | 'timeline' | ...` (mixed)

Target:
```typescript
export type ViewType = 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid' | 'network' | 'timeline';
// Use everywhere (AppStateContext, ViewDispatcher, GridContinuumMode)
```

### Options Considered

| Option | Pattern | Verdict |
|--------|---------|---------|
| **A: Unify to ViewType** | Single enum, lowercase, comprehensive | CHOSEN |
| **B: Unify to ViewName** | Single enum, capitalized | Rejected (awkward) |
| **C: Keep both** | Maintain two enums, mapping between | Rejected (source of bugs) |

### Rationale

**Single source of truth:**
- One enum, used everywhere
- Reduces type confusion
- No duplicate definitions

**Clarity:**
- All views use same type
- AppStateContext, GridContinuumController, ViewDispatcher all agree
- No "ViewName vs ViewType" ambiguity

**Consistency:**
- Lowercase matches modern TypeScript conventions
- Matches D3 module naming

### Implementation
```typescript
// src/types/view.ts
export type ViewType = 'gallery' | 'list' | 'kanban' | 'grid' | 'supergrid' | 'network' | 'timeline';

// src/contexts/AppStateContext.tsx
import type { ViewType } from '@/types/view';

interface AppStateContextType {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
}
```

### Consequence
- Breaking change to AppStateContext API
- Type checker will catch migration points
- Cleaner codebase after migration

---

## Summary of Decisions

| # | Decision | Chosen | Consequence |
|---|----------|--------|------------|
| 1 | Gallery/List/Kanban tech | React + CSS Grid | Simpler, faster, consistent with SuperGrid |
| 2 | SQL queries | Unified useSQLiteQuery | Single source of truth for filters |
| 3 | View routing | ViewDispatcher component | Isolated, testable views |
| 4 | Selection state | Global SelectionContext | Cross-pane sync, persistent selection |
| 5 | D3 wrappers | React component containers | Consistent data flow, filter integration |
| 6 | Pane coordination | Implicit via contexts | Loose coupling, no message passing |
| 7 | Grid mode validation | GridContinuumController | Prevent invalid states |
| 8 | Enum unification | Single ViewType | Single source of truth |

---

## Non-Decisions (Keep As-Is)

✓ FilterContext — keeps compiling LATCH → SQL
✓ PAFVContext — keeps managing axis mappings
✓ DatabaseProvider — sql.js instance
✓ SuperGrid implementation — working reference
✓ Existing D3 renderers (ForceGraph, Timeline) — wrapping, not replacing

---

## Risk Assessment

| Decision | Risk | Mitigation |
|----------|------|-----------|
| React + CSS Grid | Performance at 100K+ items | Research virtualization in Phase 5 |
| Unified queries | All filters affect all views | Explicit UX (filters in toolbar, visible to all) |
| ViewDispatcher | View unmount loses transient state | Important state lives in contexts |
| Global selection | Confusing if user expects view-scoped selection | Document expected behavior |
| D3 wrappers | React ↔ D3 boundary harder to debug | Keep D3 pure, React manages state |
| Implicit coordination | Hard to trace pane interactions | Add logging to contexts for debugging |
| Grid validation | Users blocked from "trying" modes | Show helpful errors guiding users |
| Enum unification | Migration work | Automated refactor possible |

---

## Next Decision Point

**Before Phase 1 begins:**
- [ ] Architecture approved by team
- [ ] ViewType enum created in src/types/view.ts
- [ ] Migration plan for AppStateContext documented
- [ ] Build order prioritization confirmed

---

*Decisions finalized 2026-02-16 by Claude Code*
*Ready for phase execution*
