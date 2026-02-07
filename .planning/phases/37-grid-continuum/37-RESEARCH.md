# Phase 37: Grid Continuum - Research

**Researched:** 2026-02-07
**Domain:** Data visualization view transitions with context preservation
**Confidence:** HIGH

## Summary

Researched implementation requirements for seamless view transitions between list, kanban, and SuperGrid projections with preserved user context. The core architectural insight is that view transitions are PAFV axis-to-plane remappings, not data changes - the same LATCH-filtered dataset renders through different spatial projections.

Key findings establish D3.js transition patterns, FLIP animation techniques, React keyboard shortcut implementation, and localStorage state persistence patterns already established in the codebase. The existing SuperGrid class provides a strong foundation with established data binding, selection management, and zoom/pan state handling.

**Primary recommendation:** Implement a ViewContinuum orchestrator that owns the SVG container and delegates to view-specific renderers (ListView, KanbanView, SuperGrid), using D3 transitions with FLIP animation for smooth morphing between projections.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Transition animation
- Morph/FLIP animation style using D3 transitions (consistent with Phase 36 morphing boundaries)
- 300ms duration with `d3.easeCubicOut` easing ("quiet app" aesthetic)
- Animations are interruptible — if user triggers another view switch mid-transition, `selection.interrupt()` and redirect
- No user-configurable duration (defer to settings phase)

#### Context preservation across view switches
- **Selection state**: Persists as a set of card IDs (view-independent). Cards that aren't visible in the new view remain in the selection set but aren't rendered with highlight. If they reappear (filter change), they're still selected.
- **LATCH filters**: Persist exactly across all view transitions. Filters are data operations, not view operations.
- **View-specific axis assignments**: Each view type stores its own PAFV axis-to-plane mapping. Kanban's "group by status" = Category axis → x-plane. Switching views loads that view's last-used mapping (or its default mapping on first use).
- **Focus/scroll position**: Track focused card by ID (semantic position), not pixel coordinates. After transition, auto-scroll with animation to keep focused card visible (roughly center-viewport). If focused card is filtered out in new view, fall back to top-left with a brief toast notification.

#### View switching interface
- Toolbar with view type icons (standard Finder/Numbers pattern)
- Keyboard shortcuts: `Cmd+1` = List, `Cmd+2` = Kanban, `Cmd+3` = SuperGrid (not bare numbers — those should type into search/rename fields)
- View choice persists per-canvas (different datasets have different natural views), stored as canvas metadata
- Pinch-to-zoom gesture between view densities: **deferred**

#### List view (1-axis projection)
- Default axis: Hierarchy (H) — folder/nesting structure
- Supports nested hierarchies via NEST edges (flat list = hierarchy with depth 1)
- Respects current LATCH sort; default sort: `modified_at DESC`

#### Kanban view (1-facet columns)
- Default column facet: `status` (universal UX convention)
- User can change column facet to any Category (C) axis facet
- Columns only — no swimlanes (swimlanes = SuperGrid territory, already exists)
- Cards within columns sorted by current LATCH sort

#### SuperGrid (full PAFV 2D projection)
- This is the existing `SuperGrid` class — no new class needed
- Default axis assignment: Category × Time (folder × modified_at)
- Empty cells render as blank with subtle dashed border (informative whitespace)
- Zoom/pan state persists independently per-canvas; restored when returning to SuperGrid view

#### Data layer
- **One query, multiple projections**: The base SQL query (WHERE clause from LATCH filters) stays the same across all views. Only the D3 layout function changes. This guarantees card consistency — no phantom additions/removals.
- **No pre-caching**: Query once, cache the result set in memory, re-project on view switch. Re-query only when LATCH filters change.
- **Large datasets**: Virtual scrolling (Phase 26) applies to all views. View transitions only animate visible cards, not the full dataset.

#### Missing data handling
- If switching to a view that requires data the cards don't have (e.g., kanban needs status but cards have no status field), show the view with available data and display a non-blocking message: "Some cards lack [field] and appear in 'Unassigned' column"
- Insufficient LATCH dimensions for 2D grid: gracefully degrade to 1D (one populated axis becomes the primary, the other collapses to a single group)

#### State architecture
- New `ViewState` type tracks: current view type, per-view axis mappings, per-view scroll/zoom state, focused card ID
- `ViewState` stored per-canvas in `localStorage` (consistent with Phase 36 Janus state persistence pattern), database persistence deferred
- View switch triggers: save current view state → load target view state → re-project data → animate transition

### Claude's Discretion
None specified - all implementation details have been decided.

### Deferred Ideas (OUT OF SCOPE)
- Gallery/icon view (0-axis projection)
- Timeline view (time-axis-specific rendering with time scale)
- Network/graph view (force simulation, fundamentally different from grid-based views)
- Pinch-to-zoom gesture to fluidly transition between view densities
- View preview thumbnails (show what a view will look like before committing)
- Custom per-user view type definitions
- Combined zoom/pan widget (Phase 36 noted this for later exploration)
- Database-backed ViewState persistence (start with localStorage, migrate later)
- Animated transition path customization
</user_constraints>

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Data visualization and transitions | Industry standard for complex DOM manipulation and smooth animations |
| React | v18 | UI framework and component lifecycle | State management and component orchestration |
| TypeScript | strict mode | Type safety | Enforces architectural contracts between view classes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-transition | included in D3.js | Animation and interpolation | FLIP animations between view states |
| d3-ease | included in D3.js | Easing functions | `d3.easeCubicOut` for "quiet app" aesthetic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D3.js transitions | CSS animations | D3 provides better state management and complex interpolation |
| React state | External state library | D3's data join already provides state management |

**Installation:**
```bash
# Already available in existing codebase
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── d3/
│   ├── ListView.ts           # 1-axis list projection
│   ├── KanbanView.ts         # 1-facet column projection
│   ├── ViewContinuum.ts      # Orchestrator for view switching
│   └── SuperGrid.ts          # Existing 2D grid (modified)
├── types/
│   └── views.ts              # ViewType enum, ViewState interface
└── components/
    └── ViewSwitcher.tsx      # React toolbar for view selection
```

### Pattern 1: ViewContinuum Orchestrator
**What:** Central class that owns SVG container and delegates to view-specific renderers
**When to use:** Managing complex view transitions with shared context
**Example:**
```typescript
// Source: Phase 37 user decisions + D3.js transition docs
class ViewContinuum {
  private container: d3.Selection<SVGElement>;
  private activeView: ListView | KanbanView | SuperGrid;
  private cachedData: Node[];
  private viewState: ViewState;

  switchView(targetView: ViewType): void {
    // FLIP animation flow
    const currentPositions = this.activeView.getCardPositions();
    this.setActiveView(targetView);
    const targetPositions = this.activeView.getCardPositions();
    this.animateTransition(currentPositions, targetPositions, 300);
  }
}
```

### Pattern 2: Common View Interface
**What:** Shared interface that all view classes must implement
**When to use:** Ensuring consistent API across different view types
**Example:**
```typescript
// Source: Architectural pattern analysis
interface IView {
  render(cards: Node[], axisMapping: ViewAxisMapping): void;
  getCardPositions(): Map<string, CardPosition>;
  scrollToCard(cardId: string): void;
  destroy(): void;
}
```

### Pattern 3: FLIP Animation with D3 Transitions
**What:** First-Last-Invert-Play technique for smooth morphing between layouts
**When to use:** View transitions that maintain object constancy
**Example:**
```typescript
// Source: D3.js transition documentation
private animateTransition(fromPositions: Map<string, CardPosition>,
                         toPositions: Map<string, CardPosition>): void {
  this.container.selectAll('.card-group')
    .data(this.cachedData, d => d.id)
    .each(function(d) {
      const from = fromPositions.get(d.id);
      const to = toPositions.get(d.id);
      if (from && to) {
        // Invert: set to final position, then animate from start
        d3.select(this)
          .attr('transform', `translate(${to.x}, ${to.y})`)
          .attr('transform', `translate(${from.x}, ${from.y})`) // Start
          .transition()
          .duration(300)
          .ease(d3.easeCubicOut)
          .attr('transform', `translate(${to.x}, ${to.y})`); // End
      }
    });
}
```

### Anti-Patterns to Avoid
- **Separate data queries per view:** Use single query with different projections instead
- **Pixel-based scroll restoration:** Use semantic card ID-based position tracking
- **Non-interruptible animations:** Always support `.interrupt()` for responsive UX

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard shortcut management | Custom event handlers | React useEffect with document.addEventListener | Proper cleanup and event delegation |
| State persistence | Custom storage wrapper | Existing localStorage patterns in codebase | Consistent with SuperGrid Janus state |
| View transition animations | CSS-only animations | D3 transitions with interpolation | Better control over complex object movement |
| Card position tracking | Pixel coordinate caching | D3 data join with key functions | Automatic object constancy |

**Key insight:** The codebase already has established patterns for all major concerns - leverage existing SuperGrid architecture rather than building parallel systems.

## Common Pitfalls

### Pitfall 1: Data Consistency Issues
**What goes wrong:** Different views showing different card counts or states
**Why it happens:** Each view running separate queries instead of sharing cached data
**How to avoid:** Single query in ViewContinuum, pass results to all view renderers
**Warning signs:** Card appearing/disappearing during view switches, selection state loss

### Pitfall 2: Animation Performance
**What goes wrong:** Laggy or choppy view transitions
**Why it happens:** Animating too many elements or complex DOM operations during transition
**How to avoid:** Only animate visible cards, use transform instead of position changes, implement virtual scrolling
**Warning signs:** Frame rate drops below 30fps during transitions, browser lag

### Pitfall 3: State Persistence Edge Cases
**What goes wrong:** Lost selections or scroll position after view switches
**Why it happens:** Not accounting for cards that exist in dataset but aren't visible in current view
**How to avoid:** Use semantic IDs for all state, not array indices or DOM positions
**Warning signs:** Selection cleared unexpectedly, focus jumps to wrong card

### Pitfall 4: Keyboard Shortcut Conflicts
**What goes wrong:** Browser shortcuts interfering with app shortcuts
**Why it happens:** Not preventing default behavior for intercepted key combinations
**How to avoid:** Always call `event.preventDefault()` for handled shortcuts
**Warning signs:** Browser tabs switching instead of view switching, form fields not working

## Code Examples

Verified patterns from official sources:

### React Keyboard Shortcut Registration
```typescript
// Source: React best practices + codebase localStorage patterns
useEffect(() => {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey) {
      switch (event.key) {
        case '1':
          event.preventDefault();
          onViewChange('list');
          break;
        case '2':
          event.preventDefault();
          onViewChange('kanban');
          break;
        case '3':
          event.preventDefault();
          onViewChange('supergrid');
          break;
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onViewChange]);
```

### D3 Transition with Interruption Support
```typescript
// Source: D3.js transition documentation
switchView(newViewType: ViewType): void {
  // Stop any ongoing transitions
  this.container.selectAll('.card-group').interrupt();

  const transition = this.container
    .transition()
    .duration(300)
    .ease(d3.easeCubicOut)
    .on('end', () => {
      this.scrollToFocusedCard();
    });

  // Apply new view layout with transition
  this.renderNewView(newViewType, transition);
}
```

### localStorage State Persistence
```typescript
// Source: Existing SuperGrid Janus state pattern
private persistViewState(): void {
  try {
    const stateKey = `viewcontinuum-state-${this.canvasId}`;
    localStorage.setItem(stateKey, JSON.stringify({
      currentView: this.currentViewType,
      axisMapping: this.currentAxisMapping,
      focusedCardId: this.focusedCardId,
      scrollPosition: this.getScrollPosition()
    }));
  } catch (error) {
    console.warn('Failed to persist view state:', error);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS-only view transitions | D3 transition with FLIP | D3.js v7 | Smoother object constancy, better complex animations |
| Separate data per view | Single query, multiple projections | Modern data visualization | Eliminates data consistency issues |
| Global keyboard listeners | Component-scoped useEffect | React 18 | Better cleanup and lifecycle management |
| Manual position tracking | D3 data join with key functions | D3.js v4+ | Automatic object constancy and state management |

**Deprecated/outdated:**
- Manual DOM manipulation for view switching: D3 data join provides better state management
- Index-based card tracking: Use stable IDs for persistence across view changes

## Open Questions

Things that couldn't be fully resolved:

1. **Virtual scrolling integration with FLIP animations**
   - What we know: Phase 26 virtual scrolling exists, large datasets need optimization
   - What's unclear: How to handle FLIP animations when source/target cards may not be in DOM
   - Recommendation: Start with simple approach (animate visible cards only), optimize later

2. **Toast notification system for focus fallbacks**
   - What we know: Need non-blocking notification when focused card is filtered out
   - What's unclear: Whether existing notification system exists in codebase
   - Recommendation: Implement simple toast, integrate with existing system in later phase

## Sources

### Primary (HIGH confidence)
- Existing SuperGrid.ts implementation - multi-select, keyboard navigation, state persistence patterns
- D3.js v7 transition documentation - animation capabilities and FLIP technique support
- Existing localStorage usage patterns in codebase - consistent state persistence approach

### Secondary (MEDIUM confidence)
- React keyboard shortcut best practices - useEffect cleanup and event delegation patterns
- D3 data join documentation - object constancy and key function usage

### Tertiary (LOW confidence)
- Generic view switching patterns - need validation against specific D3/React integration requirements

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - D3.js and React patterns well-established in codebase
- Architecture: HIGH - ViewContinuum pattern matches existing SuperGrid orchestration approach
- Pitfalls: MEDIUM - Based on common D3/React issues, need validation through implementation

**Research date:** 2026-02-07
**Valid until:** 30 days (stable domain, well-established patterns)