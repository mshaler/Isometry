# Phase 91: Interactions - Research

**Researched:** 2026-02-14
**Domain:** D3.js event handling, keyboard navigation, SVG interaction patterns
**Confidence:** HIGH

## Summary

Phase 91 adds interactive capabilities to the SQL-driven SuperGrid headers implemented in Phase 90. The phase focuses on three interaction patterns: collapse/expand with span recalculation, click-to-filter navigation, and keyboard navigation. The existing codebase provides strong foundations—HeaderNode types with collapse state, SuperStackState management, and GridSelectionController for keyboard handling—requiring integration rather than greenfield implementation.

**Key findings:**
- D3.js v7 event handling uses `(event, data)` parameter order with `d3.pointer()` for coordinates
- Collapse/expand state should remain local (not Context API) to avoid unnecessary re-renders
- Span recalculation is already implemented in `header-tree-builder.ts` with collapsed nodes defaulting to span=1
- Keyboard navigation requires `tabindex="0"` on focusable SVG elements with ARIA attributes for accessibility
- Path-based filtering uses D3 hierarchy's `.path()` method to traverse from node to root

**Primary recommendation:** Build on existing GridSelectionController keyboard patterns and SuperStackState collapse tracking. Implement D3 event handlers in NestedHeaderRenderer to toggle collapse state and trigger span recalculation via HeaderLayoutService.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| D3.js | v7 | Event handling, transitions, hierarchy navigation | Industry standard for SVG manipulation and data visualization |
| React | 18 | State coordination between D3 and UI chrome | Already used for FilterContext integration |
| TypeScript | 5.x (strict) | Type-safe event handlers and state transitions | Project requirement |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| d3-hierarchy | v7 (part of D3) | `.path()` for traversing header trees | Click-to-filter path-based navigation |
| d3-transition | v7 (part of D3) | Smooth collapse/expand animations | Visual feedback for state changes |
| d3-ease | v7 (part of D3) | Easing functions (easeCubicOut) | Consistent with existing rendering |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local collapse state | Context API | Context causes re-renders across entire tree; local state faster |
| D3 keyboard handling | React event handlers | D3 owns the SVG DOM; mixing React events risks conflicts |
| Custom path traversal | D3 hierarchy `.path()` | Custom code error-prone; `.path()` battle-tested |

**Installation:**
```bash
# Already installed - no new dependencies required
# D3 v7 and React 18 provide all necessary capabilities
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── d3/
│   └── grid-rendering/
│       ├── NestedHeaderRenderer.ts        # Add event handlers here
│       └── GridRenderingEngine.ts         # Coordinate header interactions
├── services/
│   └── supergrid/
│       └── HeaderLayoutService.ts         # Span recalculation (exists)
├── types/
│   ├── supergrid.ts                       # SuperStackState (exists)
│   └── grid.ts                            # HeaderNode with collapse state
└── hooks/
    └── useHeaderInteractions.ts           # NEW: React hook for D3↔React bridge
```

### Pattern 1: D3 Event Handler with State Toggle

**What:** Attach D3 event listeners to SVG header elements, mutate collapse state, trigger re-render
**When to use:** All header click interactions (collapse/expand, filter selection)
**Example:**
```typescript
// Source: GridSelectionController.ts (existing pattern)
selection.on("click", (event, headerNode: HeaderNode) => {
  event.stopPropagation();

  // Toggle collapse state
  const newState = !headerNode.collapsed;

  // Update state (calls React setter)
  onHeaderToggle(headerNode.id, newState);

  // Trigger span recalculation
  headerLayoutService.recalculateSpans(headerTree);
});
```

### Pattern 2: Span Recalculation on Collapse

**What:** When a header collapses, set span=1; when expanding, recalculate as sum of children's spans
**When to use:** After any collapse/expand state change
**Example:**
```typescript
// Source: header-tree-builder.ts (existing implementation)
function calculateSpans(node: HeaderNode): number {
  if (node.children.length === 0 || node.collapsed) {
    // Leaf or collapsed node: span is 1
    node.span = 1;
    return 1;
  }

  // Parent node (not collapsed): span is sum of children's spans
  node.span = node.children.reduce((sum, child) =>
    sum + calculateSpans(child), 0
  );
  return node.span;
}
```

### Pattern 3: Path-Based Filtering

**What:** Collect path from clicked header to root, emit as filter constraint
**When to use:** Click-to-filter on any header
**Example:**
```typescript
// Source: D3 hierarchy documentation
import { hierarchy } from 'd3-hierarchy';

function getFilterPath(node: HeaderNode, root: HeaderNode): string[] {
  const h = hierarchy(root, d => d.children);
  const targetNode = h.descendants().find(n => n.data.id === node.id);
  const ancestorPath = targetNode.path(h); // Returns [root, ..., node]

  return ancestorPath.map(n => ({
    facet: n.data.facet,
    value: n.data.value
  }));
}

selection.on("click", (event, node: HeaderNode) => {
  const path = getFilterPath(node, headerTree.roots[0]);
  onHeaderFilter(path); // Emit to FilterContext
});
```

### Pattern 4: Keyboard Navigation with Arrow Keys

**What:** Focus management with Tab, arrow key navigation between headers, Enter to toggle
**When to use:** All keyboard interaction scenarios
**Example:**
```typescript
// Source: GridSelectionController.ts pattern + WCAG guidelines
svg.attr("tabindex", "0")
   .attr("role", "treegrid")
   .on("keydown", (event) => {
     if (event.key === "ArrowRight") {
       focusNextHeader("horizontal");
     } else if (event.key === "ArrowDown") {
       focusNextHeader("vertical");
     } else if (event.key === "Enter" || event.key === " ") {
       toggleCurrentHeader();
     }
   });

// Individual headers
headerGroup.attr("tabindex", "-1")
           .attr("role", "gridcell")
           .attr("aria-expanded", d => d.collapsed ? "false" : "true");
```

### Anti-Patterns to Avoid

- **Storing collapse state in Context API:** Causes re-render of entire tree on every toggle. Use local state in React hook, pass to D3 via props.
- **Manual DOM focus manipulation:** Use D3's built-in selection methods and `.node().focus()` instead of `document.getElementById()`.
- **Recalculating spans on every render:** Cache span calculations; only recompute when collapse state changes.
- **Missing ARIA attributes:** Screen readers need `aria-expanded`, `role="treegrid"`, and `tabindex` for accessibility.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Hierarchy path traversal | Custom tree walker | D3 hierarchy `.path()` | Handles edge cases (orphaned nodes, circular refs), battle-tested |
| Keyboard focus cycling | Manual focus index tracking | D3 selection `.nodes()` + array index | D3 selections maintain DOM order automatically |
| Span calculation | Recursive sum on every render | HeaderLayoutService cached spans | Already implemented with memoization |
| Click zone detection | Manual bounding box math | D3 `d3.pointer(event)` with SVG zones | Handles coordinate transforms, viewport scaling |
| Visual highlighting | CSS class toggling via `classList` | D3 `.classed()` method | Integrates with D3's data join lifecycle |

**Key insight:** D3 v7 provides robust primitives for SVG interaction that handle coordinate transforms, event delegation, and state-driven rendering. Custom solutions miss edge cases around zooming, panning, and dynamic header resizing.

## Common Pitfalls

### Pitfall 1: Context API Performance Degradation

**What goes wrong:** Using React Context for collapse/expand state causes every header component to re-render on every toggle, even headers in different subtrees.

**Why it happens:** Context notifies all consumers when its value changes. In a 100-node tree, toggling one node triggers 100 re-renders.

**How to avoid:** Keep collapse state local to a React hook (`useState` or `useReducer`), pass via props to D3 rendering function. Only lift to Context if filtering requires coordination across Navigator and SuperGrid.

**Warning signs:** Janky animations, slow collapse/expand interactions, React DevTools showing widespread re-renders.

### Pitfall 2: Forgetting to Recalculate Spans

**What goes wrong:** Collapsing a parent header leaves span unchanged, causing layout misalignment and overlapping headers.

**Why it happens:** Span is computed during tree building but not updated when collapse state changes.

**How to avoid:** Always call `calculateSpans(headerTree)` after toggling collapse state. Consider integrating into the state setter.

**Warning signs:** Headers overlapping, incorrect visual spanning, misaligned grid cells.

### Pitfall 3: Keyboard Traps in Nested Headers

**What goes wrong:** User tabs into header, cannot tab out or navigate to siblings with arrow keys.

**Why it happens:** Missing `tabindex="0"` on container, or nested headers all have `tabindex="0"` instead of `-1`.

**How to avoid:** Follow WCAG pattern: parent container has `tabindex="0"`, descendants have `tabindex="-1"`, arrow keys programmatically focus descendants.

**Warning signs:** Accessibility audit failures, user reports about keyboard navigation.

### Pitfall 4: Click Events Firing During Drag

**What goes wrong:** User drags a header to resize, releases mouse, and click handler fires, toggling collapse state unexpectedly.

**Why it happens:** D3 `on("click")` fires on mouseup if target hasn't changed, even after drag.

**How to avoid:** Check `event.target.isDragging` flag (existing pattern in GridSelectionController line 85) or track mousedown/mouseup distance.

**Warning signs:** Headers collapsing when user tries to resize, user complaints about "accidental clicks."

### Pitfall 5: Missing Visual Focus Indicators

**What goes wrong:** Keyboard users cannot see which header is focused.

**Why it happens:** No CSS styles for `:focus` state, or ARIA attributes missing.

**How to avoid:** Add visible focus ring with `stroke-width: 2` and high-contrast color (WCAG 2.4.7 requires 3:1 contrast). Use `aria-expanded` for screen readers.

**Warning signs:** Accessibility audit failures, keyboard users unable to navigate.

## Code Examples

Verified patterns from official sources and existing codebase:

### Collapse/Expand Event Handler (D3 v7)

```typescript
// Source: GridRenderingEngine.ts existing pattern + D3 documentation
const headerGroup = container.selectAll('.header-node')
  .data(headerNodes, d => d.id)
  .join('g')
    .attr('class', 'header-node')
    .attr('tabindex', '-1')
    .attr('role', 'gridcell')
    .attr('aria-expanded', d => d.collapsed ? 'false' : 'true')
    .on('click', (event, d: HeaderNode) => {
      // Prevent event bubbling
      event.stopPropagation();

      // Don't toggle during drag
      if ((event.target as any)?.isDragging) return;

      // Toggle collapse state
      const newState = !d.collapsed;

      // Update state in React (triggers re-render)
      onHeaderToggle(d.id, newState);

      // Recalculate spans
      headerLayoutService.calculateSpans(d);

      // Animate transition
      updateHeaderLayout(300); // Duration in ms
    });
```

### Keyboard Navigation (WCAG-compliant)

```typescript
// Source: WCAG 2.4.3, GridSelectionController existing patterns
svg.attr("tabindex", "0")
   .attr("role", "treegrid")
   .attr("aria-label", "SuperGrid headers")
   .on("keydown", (event) => {
     const focusedNode = getFocusedHeader();

     switch (event.key) {
       case "ArrowRight":
         event.preventDefault();
         focusAdjacentHeader(focusedNode, "next");
         break;
       case "ArrowLeft":
         event.preventDefault();
         focusAdjacentHeader(focusedNode, "prev");
         break;
       case "ArrowDown":
         event.preventDefault();
         focusChildHeader(focusedNode);
         break;
       case "ArrowUp":
         event.preventDefault();
         focusParentHeader(focusedNode);
         break;
       case "Enter":
       case " ":
         event.preventDefault();
         toggleHeaderCollapse(focusedNode);
         break;
     }
   });
```

### Path-Based Filtering

```typescript
// Source: D3 hierarchy documentation, SuperStackState types
import { hierarchy } from 'd3-hierarchy';

function buildFilterFromPath(node: HeaderNode, tree: HeaderTree): FilterConstraint[] {
  // Build hierarchy from tree roots
  const h = hierarchy(tree.roots[0], d => d.children);

  // Find clicked node
  const targetNode = h.descendants().find(n => n.data.id === node.id);
  if (!targetNode) return [];

  // Get path from root to node
  const ancestorPath = targetNode.path(h.root);

  // Convert to filter constraints
  return ancestorPath.map(n => ({
    facet: n.data.facet.sourceColumn,
    operator: 'equals',
    value: n.data.value
  }));
}
```

### Span Recalculation (Existing Implementation)

```typescript
// Source: header-tree-builder.ts lines 129-150 (existing code)
/**
 * Recursively calculate span for each node.
 * Collapsed nodes have span=1 regardless of children.
 */
function calculateSpans(node: HeaderNode): number {
  if (node.children.length === 0 || node.collapsed) {
    // Leaf or collapsed node: span is 1
    node.span = 1;
    return 1;
  }

  // Parent node (not collapsed): span is sum of children's spans
  node.span = node.children.reduce((sum, child) =>
    sum + calculateSpans(child), 0
  );

  return node.span;
}

/**
 * Update startIndex for all nodes after span changes
 */
function assignIndices(nodes: HeaderNode[], startIndex = 0): void {
  let currentIndex = startIndex;
  nodes.forEach(node => {
    node.startIndex = currentIndex;
    if (!node.collapsed && node.children.length > 0) {
      assignIndices(node.children, currentIndex);
    }
    currentIndex += node.span;
  });
}
```

### Visual Highlight for Selected Header

```typescript
// Source: GridRenderingEngine.ts card selection pattern
function updateHeaderHighlight(selectedId: string | null): void {
  container.selectAll('.header-node')
    .classed('selected', (d: HeaderNode) => d.id === selectedId)
    .select('rect')
      .attr('stroke', d => d.id === selectedId ? '#2563eb' : '#cbd5e1')
      .attr('stroke-width', d => d.id === selectedId ? 2 : 1)
      .attr('fill', d => d.id === selectedId ? '#dbeafe' : '#f1f5f9');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `d3.event` global | `(event, data)` parameters | D3 v6 (2020) | Must update all event handlers to new signature |
| `d3.mouse(this)` | `d3.pointer(event)` | D3 v6 (2020) | Coordinate extraction modernized |
| Context API for tree state | Local useState | React 18+ (2022) | Performance improvement, avoids re-render cascade |
| Manual ARIA attributes | Required by WCAG 2.2 | 2023 | Accessibility now non-negotiable |
| Single click handler | Separate click/drag detection | Current best practice | Prevents accidental collapse during resize |

**Deprecated/outdated:**
- `d3.event`: Removed in D3 v6; use event parameter instead
- `d3.mouse()`: Use `d3.pointer()` for both mouse and touch events
- `this` context in arrow functions: Use regular `function` syntax when you need DOM element reference

## Open Questions

1. **Should collapse state persist across view transitions?**
   - What we know: SuperStackState includes `collapsedIds: Set<string>`
   - What's unclear: Whether collapse state should survive axis changes
   - Recommendation: Persist by header ID, clear on facet reordering (different hierarchy)

2. **How to handle keyboard navigation in sparse vs dense mode?**
   - What we know: Sparse mode has empty cell placeholders, dense skips them
   - What's unclear: Should arrow keys skip empty cells in sparse mode?
   - Recommendation: Arrow keys navigate visible headers only, regardless of density

3. **Filter scope when clicking a collapsed header**
   - What we know: Collapsed headers have children that aren't visible
   - What's unclear: Does filter include hidden children or just the clicked level?
   - Recommendation: Filter by path to clicked header; children are implicit (more intuitive)

4. **Performance threshold for virtualization**
   - What we know: GridSelectionController exists, no current virtualization
   - What's unclear: At what header count does keyboard nav become laggy?
   - Recommendation: Start with full rendering, add virtualization if >1000 headers

## Sources

### Primary (HIGH confidence)
- [D3.js Official Event Handling Documentation](https://d3js.org/d3-selection/events) - Event binding syntax and parameter order
- [D3 Hierarchy API](https://d3js.org/d3-hierarchy/hierarchy) - `.path()` method for tree traversal
- [WCAG 2.4.3: Focus Order](https://wcag.dock.codes/documentation/wcag243/) - Keyboard navigation requirements
- [WCAG 2.4.7: Focus Visible](https://www.webability.io/glossary/focus-indicator) - Visual focus indicator standards
- [SVG Accessibility/Navigation - W3C](https://www.w3.org/wiki/SVG_Accessibility/Navigation) - Tabindex and ARIA in SVG
- Existing Codebase:
  - `src/superstack/builders/header-tree-builder.ts` - Span calculation implementation
  - `src/d3/grid-selection/GridSelectionController.ts` - Keyboard navigation patterns
  - `src/superstack/types/superstack.ts` - SuperStackState type definitions
  - `src/types/grid.ts` - HeaderNode with collapse state

### Secondary (MEDIUM confidence)
- [React State Management in 2025](https://www.developerway.com/posts/react-state-management-2025) - Context API vs local state performance
- [Creating Accessible SVG Charts](https://accessibility-test.org/blog/compliance/creating-accessible-svg-charts-and-infographics/) - SVG accessibility patterns
- [D3.js Mouse Events Tutorial](https://octoperf.com/blog/2018/04/17/d3-js-mouse-events-and-transitions-tutorial/) - Event handling patterns
- [React Flow Expand/Collapse Example](https://reactflow.dev/examples/layout/expand-collapse) - Tree interaction patterns
- [Keyboard-navigable JavaScript Widgets - MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets) - WCAG compliance guidance

### Tertiary (LOW confidence)
- [Filtering Children Based on Parent Status in D3.js](https://copyprogramming.com/howto/how-to-filter-children-based-on-whether-the-parent-is-filtered-in-d3) - Path-based filtering techniques (2026 article, approach verified against official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - D3 v7 and React 18 are well-documented, existing codebase uses them
- Architecture: HIGH - Existing patterns in GridSelectionController and header-tree-builder provide templates
- Pitfalls: MEDIUM-HIGH - Context API performance issue verified by multiple sources; keyboard trap warning from WCAG standards
- Code examples: HIGH - Derived from official D3 docs and existing codebase patterns
- State management: HIGH - Local state recommendation backed by multiple 2025-2026 sources and React best practices

**Research date:** 2026-02-14
**Valid until:** 60 days (stable domain - D3 v7 event API unlikely to change, WCAG standards finalized)

**Key uncertainties:**
- Filter scope for collapsed headers: Architectural decision, no canonical "right answer"
- Persistence of collapse state: Depends on user workflow, needs product decision
- Virtualization threshold: Performance profiling required with real data

**Next steps for planner:**
1. Review existing `header-tree-builder.ts` span calculation—no reimplementation needed
2. Extend `GridSelectionController` patterns for header-specific keyboard nav
3. Add D3 event handlers to `NestedHeaderRenderer.ts` for click interactions
4. Create `useHeaderInteractions` hook to bridge D3 event handlers with React state
5. Define filter emission API between SuperGrid and FilterContext
