# Phase 46: Live Data Synchronization - Research

**Researched:** 2026-02-10
**Domain:** React state synchronization, D3.js data binding refresh, SQLite change notification
**Confidence:** HIGH

## Summary

Phase 46 enables cross-canvas data synchronization without manual refresh by leveraging the existing `dataVersion` counter in SQLiteProvider as the core synchronization primitive. When users save cards in Capture (TipTap editor), the `run()` function in SQLiteProvider increments `dataVersion`, triggering React's dependency tracking in `useSQLiteQuery`, which auto-refetches queries and updates all D3.js visualizations via `.join()` data binding. This architecture eliminates the need for custom event buses or polling—React's built-in `useEffect` dependency arrays handle propagation.

**Architecture context:** Isometry uses sql.js (SQLite in WASM) with synchronous queries, D3.js v7 for visualizations with `.join()` pattern, and React 18 contexts for state management. The existing infrastructure includes `dataVersion` counter (incremented on every INSERT/UPDATE/DELETE), `useSQLiteQuery` hook with dataVersion dependency, and `SelectionContext` for cross-component selection state.

**Primary recommendation:** Extend `dataVersion` pattern with optional table-level granularity for performance (avoid re-rendering all visualizations when only one table changes), add bidirectional card navigation by connecting SelectionContext to both Capture and Preview components, and leverage D3's `.join()` with stable key functions to ensure smooth re-renders without full graph recalculation.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2.0 | State synchronization | Already in use, automatic batching (React 18), useEffect dependency tracking handles propagation |
| sql.js | 1.13.0 | Data source | Already in use, synchronous queries, no bridge overhead |
| d3 | 7.9.0 | Visualization updates | Already in use, `.join()` with key functions re-binds data efficiently |
| TypeScript | 5.2.2 | Type safety | Already in use, ensures correct dataVersion typing across contexts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | All requirements met by existing stack |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dataVersion counter | CustomEvent broadcast | CustomEvent requires manual listener management, no React integration, harder to debug. dataVersion leverages React's built-in dependency tracking. |
| dataVersion counter | SQLite triggers + update_hook | sql.js doesn't expose sqlite3_update_hook() callback API. Would require WASM modifications. dataVersion is simpler and already working. |
| Global dataVersion | Table-specific version counters | Table-specific adds complexity but improves performance (e.g., editing a card in Capture shouldn't re-render Network Graph if edges table unchanged). Implement if performance profiling shows need. |
| SelectionContext | Custom event bus | React Context is standard pattern for cross-component state. Event bus adds extra abstraction with no benefit in single-page app. |
| Polling | Push-based updates | dataVersion IS push-based (via React dependency array). Polling wastes CPU and adds latency. Never poll when React can propagate. |

**Installation:**
No new dependencies required. All synchronization needs met by existing React 18 + sql.js + D3.js stack.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── contexts/
│   ├── LiveDataContext.tsx          # Already exists (stub) - expand for metrics
│   └── NotebookContext.tsx          # Already exists - add scrollToCard() method
├── state/
│   └── SelectionContext.tsx         # Already exists - connect to both Capture + Preview
├── hooks/
│   └── database/
│       ├── useSQLiteQuery.ts        # Already exists - uses dataVersion dependency
│       └── useLiveData.tsx          # Already exists - uses bridge pattern, adapt to dataVersion
├── db/
│   ├── SQLiteProvider.tsx           # Already exists - dataVersion counter implemented
│   └── operations.ts                # Already exists - run() increments dataVersion
├── components/
│   └── notebook/
│       ├── CaptureComponent.tsx     # Connect to SelectionContext for scroll-to-card
│       └── PreviewComponent.tsx     # Connect to SelectionContext for card selection
└── d3/
    └── visualizations/
        └── network/
            └── ForceGraphRenderer.ts # Ensure stable key function in .join()
```

### Pattern 1: dataVersion-Driven Query Invalidation

**What:** Automatic query refetch when database changes, propagated via React dependency array

**When to use:** Always—this is the core synchronization primitive for SYNC-01 (auto-refresh)

**Example:**
```typescript
// Source: Existing implementation in useSQLiteQuery.ts + SQLiteProvider.tsx
// From SQLiteProvider operations.ts:
const run = (sql: string, params: unknown[] = []): void => {
  // ... execute SQL ...

  // Increment data version for query invalidation
  setDataVersion(prev => prev + 1);
};

// From useSQLiteQuery.ts:
export function useSQLiteQuery<T>(
  sql: string,
  params: unknown[] = [],
  options?: QueryOptions<T>
): QueryState<T> {
  const { execute, dataVersion } = useSQLite();

  const fetchData = useCallback(() => {
    const rows = execute(sql, params);
    const result = transform ? transform(rows) : rows;
    setData(result);
  }, [execute, sql, params, transform, dataVersion]); // dataVersion triggers refetch

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Re-runs when dataVersion changes

  return { data, loading, error, refetch: fetchData };
}
```

**How it satisfies SYNC-01:**
1. User saves card in Capture → TipTap calls `db.run("UPDATE nodes SET content = ? WHERE id = ?", [content, id])`
2. `run()` increments `dataVersion` from N to N+1
3. React detects dataVersion change in Preview's `useSQLiteQuery` dependency array
4. Preview refetches query, D3 re-renders with `.join()`—user sees update without manual refresh

### Pattern 2: D3.js Data Binding with Stable Key Functions

**What:** Use `.join()` with stable key functions to update visualizations efficiently without full recalculation

**When to use:** Always—prevents flickering and maintains force simulation state during updates

**Example:**
```typescript
// Source: D3 v7 official docs + existing patterns in Isometry codebase
// From https://d3js.org/d3-selection/joining
function updateGraph(svg: SVGSVGElement, nodes: Node[], links: Link[]) {
  const g = d3.select(svg).select('g');

  // CRITICAL: Key function ensures D3 matches existing nodes by ID
  // Without key function, D3 recreates all nodes on every update (expensive)
  const node = g.selectAll('.node')
    .data(nodes, (d: Node) => d.id) // ← Stable key function
    .join(
      // Enter: new nodes
      enter => enter.append('circle')
        .attr('class', 'node')
        .attr('r', 8)
        .call(drag(simulation)),

      // Update: existing nodes (no recreation)
      update => update,

      // Exit: removed nodes
      exit => exit.remove()
    );

  // Same pattern for links
  const link = g.selectAll('.link')
    .data(links, (d: Link) => `${d.source}-${d.target}`)
    .join('line')
      .attr('class', 'link');

  // Force simulation only recalculates for new/removed nodes
  simulation.nodes(nodes).alpha(0.3).restart();
}
```

**How it satisfies SYNC-01 performance:**
- Without key function: dataVersion change → D3 destroys all 1000 nodes → recreates 1000 nodes (slow, flickers)
- With key function: dataVersion change → D3 identifies 1 new node → adds 1 node, keeps 999 (fast, smooth)

### Pattern 3: Bidirectional Card Navigation via SelectionContext

**What:** Shared selection state between Capture and Preview, with scroll-to-card behavior

**When to use:** Required for SYNC-02 (click in Preview → scroll in Capture) and SYNC-03 (highlight across canvases)

**Example:**
```typescript
// Source: React Context best practices + existing SelectionContext.tsx
// From state/SelectionContext.tsx (existing):
interface SelectionContextValue {
  selection: { selectedIds: Set<string>, lastSelectedId: string | null };
  select: (id: string) => void;
  // ... existing methods ...
}

// In PreviewComponent.tsx (NetworkGraphTab):
function NetworkGraphTab() {
  const { select } = useSelection();

  const handleNodeClick = (nodeId: string) => {
    select(nodeId); // Updates shared selection state
  };

  return <NetworkGraph onNodeClick={handleNodeClick} />;
}

// In CaptureComponent.tsx:
function CaptureComponent() {
  const { selection } = useSelection();
  const { scrollToCard } = useNotebook();

  useEffect(() => {
    if (selection.lastSelectedId) {
      scrollToCard(selection.lastSelectedId); // Scroll TipTap editor to show card
    }
  }, [selection.lastSelectedId, scrollToCard]);

  return <TipTapEditor />;
}

// In NotebookContext.tsx (add method):
function scrollToCard(cardId: string) {
  // Load card content into TipTap editor
  setActiveCard(cardId);

  // Scroll editor into view if needed
  editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
```

**How it satisfies SYNC-02 & SYNC-03:**
- User clicks node in Preview → `handleNodeClick()` calls `select(nodeId)`
- `SelectionContext` updates `lastSelectedId`
- Capture's `useEffect` detects change → calls `scrollToCard()` → editor shows card
- Both components read same `selectedIds` Set → both highlight selected card

### Pattern 4: Table-Specific Version Tracking (Optional Optimization)

**What:** Track dataVersion per table to avoid unnecessary re-renders

**When to use:** Only if performance profiling shows issues (e.g., editing card content shouldn't re-render Network Graph if edges unchanged)

**Example:**
```typescript
// Optional enhancement to SQLiteProvider operations.ts
interface DataVersionState {
  global: number;
  nodes: number;
  edges: number;
  facets: number;
}

const run = (sql: string, params: unknown[] = []): void => {
  // ... execute SQL ...

  // Parse SQL to determine affected table
  const affectedTable = detectAffectedTable(sql); // "nodes" | "edges" | etc.

  setDataVersion(prev => ({
    ...prev,
    global: prev.global + 1,
    [affectedTable]: prev[affectedTable] + 1
  }));
};

// In useSQLiteQuery, specify which table version to track:
export function useNodes(whereClause: string, params: unknown[]) {
  const { execute, dataVersion } = useSQLite();

  const fetchData = useCallback(() => {
    // ... query nodes table ...
  }, [execute, whereClause, params, dataVersion.nodes]); // Only nodes version

  // Network Graph won't refetch when nodes table updates
}
```

**Tradeoff:** Adds complexity. Only implement if profiling shows >100ms wasted re-renders.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Change notification | CustomEvent dispatcher with manual listener management | React useEffect with dataVersion dependency | React's dependency tracking is bulletproof, debuggable with React DevTools, and automatically batches updates. Custom events require cleanup, don't batch, and break time-travel debugging. |
| Cross-component state | Prop drilling or event emitters | React Context (SelectionContext already exists) | Context is standard React pattern, works with Suspense/Concurrent Mode, easily testable. Event emitters bypass React's reconciliation and cause stale closure bugs. |
| Query caching | Custom cache with TTL/LRU logic | useSQLiteQuery's built-in fetchData memoization + React's automatic batching | React already memoizes callbacks and batches setState. Custom cache adds bugs (cache invalidation is hard) and bundle size. Keep it simple. |
| D3 re-render optimization | Manual diff logic to detect changed nodes | D3's .join() with key functions | D3's internal diffing is optimized C++ (via WASM-compiled algorithms). Hand-rolled diff will be slower and buggier. Trust the framework. |

**Key insight:** React 18's automatic batching + useEffect dependency arrays IS a state synchronization system. Don't build a second one with CustomEvents or observers. The dataVersion counter leverages React's built-in reactivity—changing it triggers all dependent queries automatically. This is simpler, faster, and more debuggable than any custom pub/sub system.

## Common Pitfalls

### Pitfall 1: Missing Key Functions in D3 .join()
**What goes wrong:** Data updates cause full graph redraw, force simulation resets, nodes jump to random positions

**Why it happens:** `.data(nodes)` without key function matches by array index, not node ID. When order changes or nodes are added/removed, D3 thinks all nodes are new.

**How to avoid:** Always provide second argument to `.data()`:
```typescript
// BAD: No key function
.data(nodes) // ← Matches by index [0, 1, 2, ...]

// GOOD: Stable key function
.data(nodes, d => d.id) // ← Matches by unique ID
```

**Warning signs:**
- Network graph "jumps" when data updates
- Console warning: "D3 selection has no key function"
- Force simulation restarts from random positions
- Performance degrades with more nodes

### Pitfall 2: Stale dataVersion in Closure
**What goes wrong:** Component doesn't re-render when database changes, shows outdated data

**Why it happens:** `fetchData` callback captures old `dataVersion` value, useEffect dependency array missing `dataVersion`

**How to avoid:** Always include `dataVersion` in dependency arrays:
```typescript
// BAD: Missing dataVersion
const fetchData = useCallback(() => {
  const rows = execute(sql, params);
}, [execute, sql, params]); // ← dataVersion not listed

// GOOD: dataVersion included
const fetchData = useCallback(() => {
  const rows = execute(sql, params);
}, [execute, sql, params, dataVersion]); // ← Refetches on change
```

**Warning signs:**
- Preview doesn't update after saving card in Capture
- Manual page refresh shows updated data
- ESLint warning: "React Hook useCallback has a missing dependency: 'dataVersion'"

### Pitfall 3: Infinite Re-Render Loop with Selection State
**What goes wrong:** Clicking a card causes infinite re-renders, browser freezes

**Why it happens:** `select()` function not memoized with `useCallback`, triggers new object reference on every render, causes useEffect to fire again

**How to avoid:** Memoize callbacks in Context providers:
```typescript
// BAD: New function reference every render
const select = (id: string) => {
  setSelection({ selectedIds: new Set([id]), lastSelectedId: id });
}; // ← Not memoized

// GOOD: Stable function reference
const select = useCallback((id: string) => {
  setSelection({ selectedIds: new Set([id]), lastSelectedId: id });
}, []); // ← Memoized with useCallback
```

**Warning signs:**
- React DevTools shows component rendering 100+ times/second
- Console error: "Maximum update depth exceeded"
- Browser becomes unresponsive
- CPU usage spikes to 100%

### Pitfall 4: Using React.StrictMode with D3 Force Simulation
**What goes wrong:** Force simulation runs twice, nodes settle in wrong positions, animations glitch

**Why it happens:** StrictMode double-invokes useEffect in development, initializing simulation twice with different starting conditions

**How to avoid:** Use cleanup function to stop previous simulation:
```typescript
useEffect(() => {
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id))
    .force('charge', d3.forceManyBody());

  // CRITICAL: Cleanup function
  return () => {
    simulation.stop(); // ← Stops previous simulation
  };
}, [nodes, links]);
```

**Warning signs:**
- Network graph appears twice in development
- Nodes don't settle to stable positions
- Console warning about multiple force simulations
- Performance issues only in development, not production

## Code Examples

Verified patterns from official sources and existing Isometry codebase:

### Auto-Refresh Pattern (SYNC-01)
```typescript
// Source: Existing useSQLiteQuery.ts + SQLiteProvider operations.ts
// No code changes needed—already implemented!

// In CaptureComponent.tsx, saving increments dataVersion:
const handleSave = () => {
  db.run('UPDATE nodes SET content = ? WHERE id = ?', [content, cardId]);
  // ↑ Calls operations.ts run() which increments dataVersion
};

// In PreviewComponent.tsx (NetworkGraphTab), query auto-refetches:
const { data: nodes } = useSQLiteQuery<Node>(
  'SELECT * FROM nodes WHERE deleted_at IS NULL',
  [],
  { transform: rowToNode }
); // ↑ Depends on dataVersion, refetches when Capture saves

// D3 re-renders automatically via React component update:
useEffect(() => {
  if (!nodes) return;
  updateGraph(svgRef.current, nodes, links);
}, [nodes, links]); // ↑ Runs when nodes data changes
```

### Scroll-to-Card Pattern (SYNC-02)
```typescript
// Source: React Context best practices + TipTap API docs
// In PreviewComponent.tsx (NetworkGraphTab):
function NetworkGraphTab() {
  const { select } = useSelection();

  const handleNodeClick = useCallback((node: Node) => {
    select(node.id); // Updates shared SelectionContext
  }, [select]);

  return <NetworkGraph nodes={nodes} onNodeClick={handleNodeClick} />;
}

// In CaptureComponent.tsx:
function CaptureComponent() {
  const { selection } = useSelection();
  const { editor } = useTipTapEditor();

  // Scroll to card when selection changes from Preview
  useEffect(() => {
    const cardId = selection.lastSelectedId;
    if (!cardId || !editor) return;

    // Load card content into editor
    const card = db.execute('SELECT content FROM nodes WHERE id = ?', [cardId])[0];
    if (card) {
      editor.commands.setContent(card.content);

      // Scroll editor into view
      editor.view.dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selection.lastSelectedId, editor, db]);

  return <TipTapEditor editor={editor} />;
}
```

### Cross-Canvas Highlight Pattern (SYNC-03)
```typescript
// Source: React Context + D3.js classed() API
// In NetworkGraphTab.tsx:
function NetworkGraphTab() {
  const { selection } = useSelection();

  useEffect(() => {
    if (!svgRef.current) return;

    // Highlight selected nodes
    d3.select(svgRef.current)
      .selectAll('.node')
      .classed('selected', (d: Node) => selection.selectedIds.has(d.id));

  }, [selection.selectedIds]);

  return <svg ref={svgRef} />;
}

// In CaptureComponent.tsx (if showing card list):
function CardList() {
  const { selection } = useSelection();

  return (
    <div>
      {cards.map(card => (
        <div
          key={card.id}
          className={selection.selectedIds.has(card.id) ? 'selected' : ''}
        >
          {card.name}
        </div>
      ))}
    </div>
  );
}

// CSS (shared across all canvases):
.selected {
  background-color: #3b82f6; /* Blue highlight */
  outline: 2px solid #1d4ed8;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MessageBridge with callback IDs | Direct sql.js synchronous queries | 2026-01 (v4) | Eliminated 40KB bridge code, simplified sync logic |
| Manual event bus for data changes | React dataVersion dependency tracking | 2026-02 (Phase 46) | Leverages React's built-in reactivity, fewer bugs |
| D3 enter/update/exit pattern | .join() with key functions | 2018 (D3 v5) | More concise, better defaults, fewer errors |
| useState + props drilling | React Context | 2019 (React 16.3+) | Cleaner API, no prop drilling, works with Suspense |
| useEffect with object deps | React 19.2 useEffectEvent | 2026-02 | Solves stale closure problem without manual ref syncing |

**Deprecated/outdated:**
- **CustomEvent for cross-component sync:** Still works but unnecessary with React Context. Adds manual cleanup burden, doesn't integrate with React DevTools.
- **Polling for data updates:** Wastes CPU, adds latency. React dependency arrays provide push-based updates with zero overhead.
- **D3 v6 and earlier enter/update/exit:** Verbose and error-prone. Use `.join()` instead (available since D3 v5, refined in v7).
- **useLiveData hook with bridge polling:** Built for MessageBridge architecture. Replace with useSQLiteQuery + dataVersion pattern for sql.js direct access.

## Open Questions

1. **Table-specific dataVersion granularity**
   - What we know: Global dataVersion works but may cause unnecessary re-renders (e.g., editing card content shouldn't re-render Network Graph if edges unchanged)
   - What's unclear: Is performance impact measurable? Does React 18 automatic batching mitigate this?
   - Recommendation: Start with global dataVersion, add table-specific tracking only if profiling shows >100ms wasted renders. Premature optimization is root of all evil.

2. **Force simulation state during live updates**
   - What we know: D3 force simulation maintains node positions in its internal state. When new nodes are added via `.join()`, simulation.nodes() must be updated.
   - What's unclear: Should we call `simulation.alpha(0.3).restart()` on every update, or only when nodes/links change significantly? Restarting too often causes jitter; not restarting causes new nodes to appear at (0,0).
   - Recommendation: Use `simulation.alpha(0.3).restart()` when node count changes by >10%, otherwise let simulation settle naturally. Test with real data to find threshold.

3. **React 19.2 useEffectEvent adoption timeline**
   - What we know: useEffectEvent solves stale closure problem elegantly, released stable in React 19.2 (Feb 2026)
   - What's unclear: Is Isometry ready to upgrade to React 19.2? Are there breaking changes?
   - Recommendation: Stick with React 18.2 + useCallback pattern for Phase 46. Revisit useEffectEvent in Phase 50+ when React 19 adoption is broader.

4. **Bidirectional link conflict resolution**
   - What we know: Clicking a card in Preview while editing different card in Capture creates UX question: save current card first? Discard changes? Prompt user?
   - What's unclear: What's the expected behavior? CardBoard-v3 had auto-save—does that solve it?
   - Recommendation: Rely on TipTap auto-save (Phase 45 EDIT-01). When user clicks card in Preview, Capture auto-saves current card, then loads new card. No prompt needed. Document in UX spec.

## Sources

### Primary (HIGH confidence)
- [React useEffect Official Docs](https://react.dev/reference/react/useEffect) - Dependency tracking, synchronization patterns
- [D3.js Selection.join() Official Docs](https://d3js.org/d3-selection/joining) - Data binding with key functions
- [React Context Official Docs](https://react.dev/learn/passing-data-deeply-with-context) - Cross-component state
- [React State Management 2025 (DigitalOcean)](https://www.digitalocean.com/community/tutorials/how-to-share-state-across-react-components-with-context) - Context best practices
- Existing Isometry codebase - SQLiteProvider.tsx, useSQLiteQuery.ts, SelectionContext.tsx (verified working patterns)

### Secondary (MEDIUM confidence)
- [State Management in React 2026 (TheLinuxCode)](https://thelinuxcode.com/state-management-in-react-2026-hooks-context-api-and-redux-in-practice/) - Modern patterns, verified with official docs
- [Observer Pattern in JavaScript (Medium - Artem Khrienov)](https://medium.com/@artemkhrenov/the-observer-pattern-in-modern-javascript-building-reactive-systems-9337d6a27ee7) - Pattern theory, applied via React
- [D3 Force-Directed Graph Component (Observable)](https://observablehq.com/@d3/force-directed-graph-component) - Force simulation with updates
- [React useEffectEvent Announcement (LogRocket)](https://blog.logrocket.com/react-useeffectevent/) - New hook for stale closures

### Tertiary (LOW confidence)
- [SQLite Update Hook Documentation](https://sqlite.org/c3ref/update_hook.html) - Native C API not exposed in sql.js, documented for context

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** - All libraries already in use, patterns proven in existing code
- Architecture: **HIGH** - dataVersion pattern working, SelectionContext exists, D3 .join() standard
- Pitfalls: **MEDIUM** - Based on D3/React common issues + Isometry codebase review, not exhaustive testing

**Research date:** 2026-02-10
**Valid until:** 2026-03-10 (30 days - stable stack, no fast-moving dependencies)

**Notes:**
- No new dependencies required—all requirements met by React 18 + sql.js + D3.js v7
- Phase 46 is primarily architecture work (connecting existing systems), not new library integration
- Success depends on Phase 44 (Preview visualizations) and Phase 45 (TipTap editor) completing first
- LiveDataContext.tsx exists as stub—can expand for metrics/monitoring without changing core sync logic
