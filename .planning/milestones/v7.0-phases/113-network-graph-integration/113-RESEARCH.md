# Phase 113: Network Graph Integration - Research

**Researched:** 2026-02-17
**Domain:** D3.js Force Simulation Lifecycle + SQL Data Integration
**Confidence:** HIGH

## Summary

Phase 113 requires building **ForceSimulationManager** for D3 force simulation lifecycle control and wiring **NetworkView** to `useSQLiteQuery` for live SQL data. The existing codebase has strong foundations: `ForceGraphRenderer.ts` already contains the D3 force simulation logic, `useForceGraph.ts` hook provides SQL data fetching, and `NetworkView.tsx` has a working implementation that needs refactoring.

The core work is extracting lifecycle management into a dedicated class that handles start/stop/reheat cleanly, preventing memory leaks during view switches, and ensuring the Network view integrates with the Grid Continuum architecture via ViewDispatcher.

**Primary recommendation:** Create `ForceSimulationManager.ts` class wrapping D3 simulation with explicit lifecycle methods, then create `useForceSimulation.ts` hook that manages React integration with proper cleanup in useEffect.

## Current State Analysis

### Existing D3 Force Code

| File | Status | Purpose |
|------|--------|---------|
| `src/d3/visualizations/network/ForceGraphRenderer.ts` | EXISTS | Core D3 force simulation creation + class wrapper |
| `src/d3/visualizations/network/types.ts` | EXISTS | GraphNode, GraphLink, ForceGraphConfig, ForceGraphInstance |
| `src/d3/visualizations/network/interactions.ts` | EXISTS | Drag, click, hover behaviors |
| `src/d3/visualizations/network/index.ts` | EXISTS | Barrel exports |

**Key findings from `ForceGraphRenderer.ts`:**
- `createForceGraph()` function creates simulation with forces (link, charge, center, collide)
- `ForceGraphRenderer` class wraps instance with render/stop/restart/destroy methods
- Already has `maxTicks` (300) and `maxTime` (3000ms) limits to auto-stop simulation
- Returns `ForceGraphInstance` with `simulation`, `stop()`, `restart()`, `updateNodePosition()`
- **Gap:** No `reheat()` method separate from `restart()`, no explicit lifecycle state tracking

### Existing Hooks

| File | Status | Purpose |
|------|--------|---------|
| `src/hooks/visualization/useForceGraph.ts` | EXISTS | SQL data fetching for nodes/edges |
| `src/hooks/database/useSQLiteQuery.ts` | EXISTS | Core SQL query hook with dataVersion reactivity |

**Key findings from `useForceGraph.ts`:**
- Already uses `useSQLiteQuery` for nodes and edges
- Transforms to `GraphNode[]` and `GraphLink[]` format
- Has `selectedNodeId` state and `refresh()` method
- **Gap:** Does not manage simulation lifecycle, only provides data

### Existing NetworkView Component

**Location:** `src/components/views/NetworkView.tsx` (537 lines)

**Current implementation issues:**
1. Creates D3 simulation directly in useEffect (not extracted)
2. Cleanup only calls `simulation.stop()` - missing DOM cleanup
3. Uses `useLiveData` instead of `useSQLiteQuery` for edges
4. Hardcoded node data prop instead of SQL query
5. Large monolithic useEffect with mixed concerns
6. No integration with ViewDispatcher/Grid Continuum

**What works:**
- Drag/drop behavior during simulation
- Selection state management
- Graph analytics overlay (connection suggestions, metrics)
- Zoom behavior via `setupZoom()`

### SQL Integration Pattern

From `GalleryView.tsx` and other views, the established pattern is:
1. Get filters from `useFilters()` context
2. Compile to SQL WHERE clause via `compileFilters()`
3. Execute via `useSQLiteQuery()` with transform function
4. Data automatically refreshes when `dataVersion` changes

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| d3-force | 3.x (via d3@7) | Force simulation | Part of D3 v7 bundle, already in use |
| d3-selection | 3.x (via d3@7) | DOM manipulation | Already used throughout |
| d3-zoom | 3.x (via d3@7) | Pan/zoom behavior | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useSQLiteQuery | internal | SQL data fetching | All database queries |
| useFilters | internal | LATCH filter state | Filter-aware views |
| useSelection | internal | Cross-view selection | Card selection sync |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D3 force | React-force-graph | Would require new dependency, less control over rendering |
| Custom simulation | Web Worker | Overkill for 500 nodes target, adds complexity |
| sql.js edges | Cached edges in state | Would break live data updates |

## Architecture Patterns

### Recommended Project Structure

```
src/
├── d3/visualizations/network/
│   ├── ForceSimulationManager.ts    # NEW: Lifecycle management
│   ├── ForceGraphRenderer.ts        # EXISTS: Rendering logic
│   ├── types.ts                     # EXISTS: Type definitions
│   ├── interactions.ts              # EXISTS: User interactions
│   └── index.ts                     # UPDATE: Export new manager
├── hooks/
│   └── visualization/
│       ├── useForceSimulation.ts    # NEW: React lifecycle hook
│       └── useForceGraph.ts         # EXISTS: Data fetching
└── components/views/
    └── NetworkView.tsx              # UPDATE: Use new patterns
```

### Pattern 1: ForceSimulationManager Class

**What:** Dedicated class managing D3 force simulation lifecycle with explicit state machine.

**When to use:** Always for force simulations that need start/stop/reheat during view switching.

**Example:**
```typescript
// Source: D3 official docs + existing ForceGraphRenderer pattern
export class ForceSimulationManager {
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  private state: 'stopped' | 'running' | 'cooling' = 'stopped';
  private container: SVGGElement | null = null;

  start(container: SVGGElement, nodes: GraphNode[], links: GraphLink[], config: ForceGraphConfig): void {
    this.stop(); // Ensure clean state
    this.container = container;
    this.simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links).id(d => d.id))
      .force('charge', d3.forceManyBody().strength(config.chargeStrength))
      .force('center', d3.forceCenter(config.width / 2, config.height / 2))
      .force('collide', d3.forceCollide().radius(config.collisionRadius));
    this.state = 'running';
    this.simulation.on('end', () => { this.state = 'stopped'; });
  }

  stop(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation.on('tick', null);
      this.simulation.on('end', null);
    }
    this.simulation = null;
    this.state = 'stopped';
  }

  reheat(alpha: number = 0.3): void {
    if (this.simulation && this.state !== 'stopped') {
      this.simulation.alpha(alpha).restart();
      this.state = 'running';
    }
  }

  destroy(): void {
    this.stop();
    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
    }
    this.container = null;
  }
}
```

### Pattern 2: useForceSimulation Hook

**What:** React hook managing ForceSimulationManager lifecycle with proper cleanup.

**When to use:** In NetworkView component to connect simulation to React lifecycle.

**Example:**
```typescript
// Source: React useEffect cleanup pattern + D3 integration
export function useForceSimulation(
  containerRef: React.RefObject<SVGGElement>,
  nodes: GraphNode[],
  links: GraphLink[],
  config: ForceGraphConfig,
  enabled: boolean = true
) {
  const managerRef = useRef<ForceSimulationManager | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current || nodes.length === 0) return;

    // Create manager on mount
    if (!managerRef.current) {
      managerRef.current = new ForceSimulationManager();
    }

    // Start simulation with current data
    managerRef.current.start(containerRef.current, nodes, links, config);

    // Cleanup on unmount or dependency change
    return () => {
      managerRef.current?.stop();
    };
  }, [containerRef, nodes, links, config, enabled]);

  // Cleanup manager entirely on unmount
  useEffect(() => {
    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  return {
    reheat: () => managerRef.current?.reheat(),
    stop: () => managerRef.current?.stop(),
  };
}
```

### Pattern 3: NetworkView SQL Integration

**What:** NetworkView using useSQLiteQuery for both nodes and edges.

**When to use:** Replace current useLiveData approach with consistent pattern.

**Example:**
```typescript
// Source: GalleryView.tsx pattern + useForceGraph.ts queries
export function NetworkView() {
  const { activeFilters } = useFilters();
  const { select, isSelected } = useSelection();

  // Compile LATCH filters
  const { sql: nodesSql, params: nodesParams } = useMemo(() => {
    const compiled = compileFilters(activeFilters);
    return {
      sql: `SELECT id, name, folder FROM nodes WHERE ${compiled.sql} LIMIT 500`,
      params: compiled.params,
    };
  }, [activeFilters]);

  const { data: nodeRows } = useSQLiteQuery(nodesSql, nodesParams);
  const { data: edgeRows } = useSQLiteQuery(EDGES_QUERY, []);

  // Transform to graph format
  const { nodes, links } = useMemo(() => transformToGraph(nodeRows, edgeRows), [nodeRows, edgeRows]);

  // Use simulation hook
  const containerRef = useRef<SVGGElement>(null);
  useForceSimulation(containerRef, nodes, links, config, enabled);

  // ... render SVG with containerRef
}
```

### Anti-Patterns to Avoid

- **Creating simulation in render:** Never call `d3.forceSimulation()` during render. Always in useEffect.
- **Missing cleanup:** Always return cleanup function from useEffect that calls `simulation.stop()`.
- **Storing simulation in state:** Use `useRef` for simulation, not `useState`. Simulation is mutable.
- **Direct DOM manipulation race conditions:** Don't mix React setState with D3 DOM updates on same elements.
- **Ignoring dataVersion:** Always include `useSQLiteQuery` data in dependency array for re-render on data changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Force simulation | Custom physics | `d3.forceSimulation()` | Well-tested, handles edge cases |
| Memory leak prevention | Manual timer tracking | `simulation.stop()` + cleanup | D3 handles internal timer cleanup |
| Graph data transform | Manual mapping | Existing `useForceGraph.ts` | Already handles edge filtering |
| Zoom behavior | Custom pan/zoom | `d3.zoom()` via `setupZoom()` | Already implemented in codebase |

**Key insight:** The existing `ForceGraphRenderer.ts` does most of the work. The phase is about extraction and lifecycle management, not reimplementing the simulation.

## Common Pitfalls

### Pitfall 1: Memory Leak on View Switch

**What goes wrong:** Simulation continues ticking in background after NetworkView unmounts.
**Why it happens:** D3 force simulation uses internal timer that persists until `.stop()` is called.
**How to avoid:** Always call `simulation.stop()` in useEffect cleanup, and nullify references.
**Warning signs:** Browser memory grows on repeated view switches, console shows tick logs after unmount.

### Pitfall 2: Stale Closure in Tick Handler

**What goes wrong:** Tick handler references old nodes/links after data update.
**Why it happens:** JavaScript closure captures variables at creation time.
**How to avoid:** Re-create simulation when data changes (via dependency array) or use refs for mutable data.
**Warning signs:** Nodes don't move to correct positions after data update.

### Pitfall 3: Double Render on Data + Filter Change

**What goes wrong:** Simulation restarts twice when both nodes and edges update.
**Why it happens:** Separate useSQLiteQuery calls for nodes and edges.
**How to avoid:** Combine node and edge queries or debounce simulation restart.
**Warning signs:** Visual "jump" when filters change.

### Pitfall 4: Missing Event Handler Cleanup

**What goes wrong:** Event handlers (click, drag, hover) accumulate on DOM nodes.
**Why it happens:** D3's `.on()` adds handlers without removing old ones on re-render.
**How to avoid:** Call `selection.selectAll('*').remove()` before re-rendering, or use D3's `.join()` pattern.
**Warning signs:** Multiple callbacks fire on single click.

## Code Examples

### Complete ForceSimulationManager

```typescript
// Source: D3 official docs + research from existing ForceGraphRenderer.ts
import * as d3 from 'd3';
import type { GraphNode, GraphLink, ForceGraphConfig } from './types';

export type SimulationState = 'stopped' | 'running' | 'cooling';

export interface ForceSimulationCallbacks {
  onTick?: (nodes: GraphNode[], links: GraphLink[]) => void;
  onEnd?: () => void;
}

export class ForceSimulationManager {
  private simulation: d3.Simulation<GraphNode, GraphLink> | null = null;
  private container: SVGGElement | null = null;
  private state: SimulationState = 'stopped';
  private tickCount = 0;
  private startTime = 0;

  getState(): SimulationState {
    return this.state;
  }

  start(
    container: SVGGElement,
    nodes: GraphNode[],
    links: GraphLink[],
    config: ForceGraphConfig,
    callbacks?: ForceSimulationCallbacks
  ): void {
    // Clean up any existing simulation
    this.destroy();

    this.container = container;
    this.tickCount = 0;
    this.startTime = Date.now();

    // Create new simulation
    this.simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(config.linkDistance)
      )
      .force('charge', d3.forceManyBody<GraphNode>()
        .strength(config.chargeStrength)
      )
      .force('center', d3.forceCenter(config.width / 2, config.height / 2))
      .force('collide', d3.forceCollide<GraphNode>()
        .radius(config.collisionRadius)
      );

    this.state = 'running';

    // Set up tick handler with auto-stop
    this.simulation.on('tick', () => {
      this.tickCount++;
      const elapsed = Date.now() - this.startTime;

      // Auto-stop after max ticks or time
      if (this.tickCount >= config.maxTicks || elapsed >= config.maxTime) {
        this.simulation?.stop();
        this.state = 'stopped';
        callbacks?.onEnd?.();
        return;
      }

      callbacks?.onTick?.(nodes, links);
    });

    this.simulation.on('end', () => {
      this.state = 'stopped';
      callbacks?.onEnd?.();
    });
  }

  stop(): void {
    if (!this.simulation) return;
    this.simulation.stop();
    this.state = 'stopped';
  }

  reheat(alpha: number = 0.3): void {
    if (!this.simulation) return;
    this.simulation.alpha(alpha).restart();
    this.state = 'running';
  }

  updateNodePosition(nodeId: string, x: number, y: number): void {
    if (!this.simulation) return;
    const node = this.simulation.nodes().find(n => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
      this.reheat();
    }
  }

  releaseNode(nodeId: string): void {
    if (!this.simulation) return;
    const node = this.simulation.nodes().find(n => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }

  destroy(): void {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation.on('tick', null);
      this.simulation.on('end', null);
      this.simulation = null;
    }
    if (this.container) {
      d3.select(this.container).selectAll('*').remove();
      this.container = null;
    }
    this.state = 'stopped';
  }
}
```

### useForceSimulation Hook

```typescript
// Source: React patterns + D3 lifecycle management
import { useRef, useEffect, useCallback } from 'react';
import { ForceSimulationManager } from '@/d3/visualizations/network/ForceSimulationManager';
import type { GraphNode, GraphLink, ForceGraphConfig } from '@/d3/visualizations/network/types';

export interface UseForceSimulationOptions {
  enabled?: boolean;
  onTick?: (nodes: GraphNode[], links: GraphLink[]) => void;
  onEnd?: () => void;
}

export function useForceSimulation(
  containerRef: React.RefObject<SVGGElement | null>,
  nodes: GraphNode[],
  links: GraphLink[],
  config: ForceGraphConfig,
  options: UseForceSimulationOptions = {}
) {
  const { enabled = true, onTick, onEnd } = options;
  const managerRef = useRef<ForceSimulationManager | null>(null);

  // Create manager once
  useEffect(() => {
    managerRef.current = new ForceSimulationManager();
    return () => {
      managerRef.current?.destroy();
      managerRef.current = null;
    };
  }, []);

  // Start/restart simulation when data changes
  useEffect(() => {
    if (!enabled || !containerRef.current || nodes.length === 0) {
      managerRef.current?.stop();
      return;
    }

    managerRef.current?.start(containerRef.current, nodes, links, config, {
      onTick,
      onEnd,
    });

    return () => {
      managerRef.current?.stop();
    };
  }, [containerRef, nodes, links, config, enabled, onTick, onEnd]);

  const reheat = useCallback((alpha?: number) => {
    managerRef.current?.reheat(alpha);
  }, []);

  const stop = useCallback(() => {
    managerRef.current?.stop();
  }, []);

  return { reheat, stop };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline simulation in useEffect | Extracted manager class | This phase | Cleaner separation, easier testing |
| useLiveData for edges | useSQLiteQuery | Already standard | Consistent data pattern |
| Manual DOM cleanup | D3 .join() pattern | D3 v6+ | Auto-cleanup via exit selection |

**Deprecated/outdated:**
- **useLiveData:** Being replaced by `useSQLiteQuery` for consistency
- **Direct simulation access:** Use manager class instead

## Open Questions

1. **Should simulation run in Web Worker?**
   - What we know: 500 nodes target is achievable on main thread
   - What's unclear: Future scaling requirements
   - Recommendation: Keep on main thread for now, document as future enhancement

2. **How to handle edge filtering vs node filtering?**
   - What we know: Current code fetches all edges, filters client-side
   - What's unclear: Performance at scale with many edges
   - Recommendation: Keep current approach, optimize if needed

## Sources

### Primary (HIGH confidence)
- [D3 Force Simulation Docs](https://d3js.org/d3-force/simulation) - Official lifecycle methods
- `src/d3/visualizations/network/ForceGraphRenderer.ts` - Existing implementation
- `src/hooks/visualization/useForceGraph.ts` - Existing data hook
- `src/hooks/database/useSQLiteQuery.ts` - SQL query pattern
- `src/components/views/GalleryView.tsx` - Reference view implementation

### Secondary (MEDIUM confidence)
- [D3 Timer Memory Leak Issue](https://github.com/d3/d3-timer/issues/24) - Known issue patterns
- [Building Network Graph with React and D3](https://www.antstack.com/blog/building-a-simple-network-graph-with-react-and-d3-2/) - Integration patterns

### Tertiary (LOW confidence)
- Web search results on D3 memory leaks - General guidance, verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing D3 patterns already in codebase
- Architecture: HIGH - Patterns derived from existing views (GalleryView, ForceGraphRenderer)
- Pitfalls: HIGH - Based on D3 official docs and existing code analysis

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days - D3 v7 is stable)
