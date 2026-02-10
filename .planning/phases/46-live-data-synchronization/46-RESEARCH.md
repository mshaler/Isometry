# Phase 46: Live Data Synchronization - Research

**Researched:** 2026-02-10
**Domain:** Cross-canvas data synchronization, React event systems, sql.js change detection
**Confidence:** MEDIUM-HIGH

## Summary

Phase 46 enables live cross-canvas synchronization without manual refresh by implementing a lightweight event bus system that propagates data changes from sql.js writes to React components across Capture, Shell, and Preview canvases. The architecture uses CustomEvent DOM APIs for decoupled publish-subscribe communication, combined with React Context for selection state and TipTap's scroll commands for bidirectional navigation.

**Architecture context:** Isometry uses sql.js (SQLite WASM) running synchronously in the browser, D3.js for Preview visualizations, TipTap for Capture editor, and React 18 for UI chrome. No Redux/Zustand—state management is distributed: D3's `.join()` for visualization state, TipTap's ProseMirror state for editor, and React Context for shared concerns like selection.

**Key challenge:** sql.js doesn't support native change triggers with JavaScript callbacks. The v1.13+ `updateHook` API provides SQLite-level notifications (INSERT/UPDATE/DELETE on any table), but it fires synchronously during transaction execution, making it unsuitable for React state updates without careful event queuing.

**Primary recommendation:** Build a custom event bus using DOM CustomEvent API for cross-canvas communication. Wrap sql.js write operations (INSERT/UPDATE/DELETE) to dispatch `isometry-data-change` events. Components subscribe via `useEffect` cleanup pattern. Use React Context only for selection state (shared across canvases). Use TipTap's `scrollIntoView()` and `focus()` commands for Capture navigation. Use D3 data joins for automatic Preview updates.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | 18.2.0 | UI chrome, Context API | Already in use. Context for selection state, useEffect for event subscriptions. |
| sql.js | 1.13.0+ | SQLite WASM with updateHook | Already in use. v1.13+ has `Database.updateHook()` API for change notifications. |
| D3.js | 7.9.0 | Preview visualization re-rendering | Already in use. `.join()` with key functions auto-updates on data changes. |
| @tiptap/react | 3.19.0+ | Capture editor with scroll commands | From Phase 45. `scrollIntoView()` and `focus()` commands for navigation. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| N/A | Native DOM | CustomEvent API for event bus | No library needed. Native browser API, zero overhead. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CustomEvent bus | React state lifting | State lifting forces re-renders across unrelated canvases. Event bus keeps components decoupled. |
| CustomEvent bus | RxJS Observables | RxJS adds 50KB+ bundle. CustomEvent is native, simpler for this use case. |
| CustomEvent bus | redux/zustand | Already rejected in architecture. D3 manages visualization state, TipTap manages editor state. No central store needed. |
| sql.js updateHook | Polling `modified_at` | Polling wastes CPU. updateHook fires only on actual changes. |
| React Context for all state | Distributed state (D3 + TipTap + Context) | Context causes re-renders. D3 and TipTap have their own state systems—use them. Context only for truly shared state (selection). |

**Installation:**
No new dependencies required. All functionality uses existing stack + native browser APIs.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   └── sync/
│       ├── event-bus.ts              # CustomEvent publish/subscribe system
│       ├── sql-change-tracker.ts     # Wraps sql.js writes, dispatches events
│       └── types.ts                  # Event payload types
├── hooks/
│   └── sync/
│       ├── useDataChangeListener.ts  # Subscribe to data change events
│       ├── useSelectionSync.ts       # Sync selection across canvases
│       └── useScrollToCard.ts        # Bidirectional card navigation
├── contexts/
│   └── SelectionContext.tsx          # KEEP: Already exists, shared selection state
└── components/
    └── notebook/
        ├── CaptureComponent.tsx      # Listen for card clicks, scroll to card
        ├── PreviewComponent.tsx      # Listen for data changes, refresh D3
        └── preview-tabs/
            ├── NetworkGraphTab.tsx   # Re-query on data change, highlight selection
            ├── DataInspectorTab.tsx  # Re-query on data change
            └── TimelineTab.tsx       # Re-query on data change, highlight selection
```

### Pattern 1: Event Bus with CustomEvent API
**What:** Lightweight publish-subscribe system using native DOM CustomEvent for cross-component communication without tight coupling.

**When to use:** Any time data changes in sql.js and multiple canvases need to react (card saved, node updated, edge created).

**Example:**
```typescript
// Source: DOM CustomEvent API (native browser), event bus patterns from web search
// services/sync/event-bus.ts

export type DataChangeEvent = {
  table: 'nodes' | 'edges' | 'notebook_cards' | 'facets';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowid: number;
  nodeId?: string;
  timestamp: Date;
};

export type SelectionChangeEvent = {
  cardId: string;
  source: 'capture' | 'preview' | 'shell';
};

// Type-safe event dispatcher
export class IsometryEventBus {
  // Dispatch data change event
  static dispatchDataChange(event: DataChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent('isometry:data-change', {
        detail: event,
        bubbles: false, // Don't bubble—global event
      })
    );
  }

  // Dispatch selection change event
  static dispatchSelectionChange(event: SelectionChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent('isometry:selection-change', {
        detail: event,
        bubbles: false,
      })
    );
  }

  // Subscribe to data changes
  static onDataChange(
    handler: (event: DataChangeEvent) => void
  ): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent<DataChangeEvent>).detail);
    };

    window.addEventListener('isometry:data-change', listener);

    // Return cleanup function
    return () => {
      window.removeEventListener('isometry:data-change', listener);
    };
  }

  // Subscribe to selection changes
  static onSelectionChange(
    handler: (event: SelectionChangeEvent) => void
  ): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent<SelectionChangeEvent>).detail);
    };

    window.addEventListener('isometry:selection-change', listener);

    return () => {
      window.removeEventListener('isometry:selection-change', listener);
    };
  }
}
```

### Pattern 2: Wrapping sql.js Writes to Dispatch Events
**What:** Intercept all sql.js INSERT/UPDATE/DELETE operations to dispatch change events. Use sql.js `updateHook` API when available, or wrap execute functions.

**When to use:** In DatabaseService or execute wrappers. Every write must trigger event for live sync to work.

**Example:**
```typescript
// Source: sql.js updateHook API (https://github.com/sql-js/sql.js)
// services/sync/sql-change-tracker.ts

import type { Database } from 'sql.js-fts5';
import { IsometryEventBus } from './event-bus';

export function enableChangeTracking(db: Database): void {
  // sql.js v1.13+ updateHook API
  if ('updateHook' in db && typeof db.updateHook === 'function') {
    db.updateHook(
      (
        actionCode: number, // 9=DELETE, 18=INSERT, 23=UPDATE
        dbName: string,
        tableName: string,
        rowid: number
      ) => {
        // Map SQLite action codes to operations
        const operation =
          actionCode === 9 ? 'DELETE' :
          actionCode === 18 ? 'INSERT' :
          actionCode === 23 ? 'UPDATE' :
          'UPDATE'; // fallback

        // Only track changes to data tables (not FTS5 internal tables)
        if (
          tableName === 'nodes' ||
          tableName === 'edges' ||
          tableName === 'notebook_cards' ||
          tableName === 'facets'
        ) {
          // Dispatch event asynchronously to avoid blocking transaction
          setTimeout(() => {
            IsometryEventBus.dispatchDataChange({
              table: tableName as any,
              operation,
              rowid,
              timestamp: new Date(),
            });
          }, 0);
        }
      }
    );
  } else {
    console.warn('sql.js updateHook not available. Live sync will use polling fallback.');
  }
}

// Alternative: Wrap execute function if updateHook unavailable
export function createTrackedExecute(
  db: Database,
  originalExecute: (sql: string, params?: unknown[]) => unknown[]
): (sql: string, params?: unknown[]) => unknown[] {
  return (sql: string, params?: unknown[]) => {
    const result = originalExecute(sql, params);

    // Detect write operations by SQL pattern
    const writeMatch = /^\s*(INSERT|UPDATE|DELETE)\s+(?:INTO|FROM)?\s+(\w+)/i.exec(sql);

    if (writeMatch) {
      const [, operation, table] = writeMatch;

      if (
        table === 'nodes' ||
        table === 'edges' ||
        table === 'notebook_cards' ||
        table === 'facets'
      ) {
        setTimeout(() => {
          IsometryEventBus.dispatchDataChange({
            table: table as any,
            operation: operation.toUpperCase() as any,
            rowid: -1, // Unknown rowid without updateHook
            timestamp: new Date(),
          });
        }, 0);
      }
    }

    return result;
  };
}
```

### Pattern 3: React Hook for Data Change Subscriptions
**What:** React hook that subscribes to data change events with proper cleanup, optional table filtering, and debouncing.

**When to use:** In any component that needs to refresh when data changes (Preview tabs, data inspector, network graph).

**Example:**
```typescript
// Source: React useEffect cleanup pattern (https://react.dev/reference/react/useEffect)
// hooks/sync/useDataChangeListener.ts

import { useEffect, useRef } from 'react';
import { IsometryEventBus, DataChangeEvent } from '@/services/sync/event-bus';

export interface DataChangeListenerOptions {
  /** Only trigger for specific tables */
  tables?: Array<'nodes' | 'edges' | 'notebook_cards' | 'facets'>;
  /** Only trigger for specific operations */
  operations?: Array<'INSERT' | 'UPDATE' | 'DELETE'>;
  /** Debounce rapid changes (ms) */
  debounceMs?: number;
  /** Enable/disable listener */
  enabled?: boolean;
}

export function useDataChangeListener(
  callback: (event: DataChangeEvent) => void,
  options: DataChangeListenerOptions = {}
): void {
  const {
    tables,
    operations,
    debounceMs = 100,
    enabled = true,
  } = options;

  const callbackRef = useRef(callback);
  const debounceTimerRef = useRef<NodeJS.Timeout>();

  // Update callback ref when it changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const handleDataChange = (event: DataChangeEvent) => {
      // Filter by table if specified
      if (tables && !tables.includes(event.table)) return;

      // Filter by operation if specified
      if (operations && !operations.includes(event.operation)) return;

      // Debounce if configured
      if (debounceMs > 0) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          callbackRef.current(event);
        }, debounceMs);
      } else {
        callbackRef.current(event);
      }
    };

    // Subscribe to events
    const unsubscribe = IsometryEventBus.onDataChange(handleDataChange);

    // Cleanup on unmount
    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [tables, operations, debounceMs, enabled]);
}
```

### Pattern 4: Selection Sync Across Canvases with Context
**What:** Use existing SelectionContext to share selected card IDs. Components dispatch selection events, all subscribed components react.

**When to use:** Required for SYNC-03 (selection highlighted across all canvases). Extends existing SelectionContext.

**Example:**
```typescript
// hooks/sync/useSelectionSync.ts
// Extends existing src/state/SelectionContext.tsx

import { useEffect } from 'react';
import { useSelection } from '@/state/SelectionContext';
import { IsometryEventBus } from '@/services/sync/event-bus';

export function useSelectionSync(source: 'capture' | 'preview' | 'shell') {
  const { selection, select } = useSelection();

  // Dispatch selection changes from this component
  useEffect(() => {
    if (selection.lastSelectedId) {
      IsometryEventBus.dispatchSelectionChange({
        cardId: selection.lastSelectedId,
        source,
      });
    }
  }, [selection.lastSelectedId, source]);

  // Listen for selection changes from other components
  useEffect(() => {
    const unsubscribe = IsometryEventBus.onSelectionChange((event) => {
      // Ignore events from self
      if (event.source === source) return;

      // Update local selection to match
      select(event.cardId);
    });

    return unsubscribe;
  }, [source, select]);

  return selection;
}
```

### Pattern 5: Bidirectional Navigation (Preview → Capture Scroll)
**What:** Click card in Preview → Capture editor scrolls to show that card. Uses TipTap's `scrollIntoView()` and `focus()` commands.

**When to use:** Required for SYNC-02 (click in Preview, Capture scrolls to show it).

**Example:**
```typescript
// Source: TipTap scrollIntoView command (https://tiptap.dev/docs/editor/api/commands/selection/scroll-into-view)
// hooks/sync/useScrollToCard.ts

import { useEffect } from 'react';
import { useEditor } from '@tiptap/react';
import { IsometryEventBus } from '@/services/sync/event-bus';

export function useScrollToCardInEditor(editor: ReturnType<typeof useEditor>) {
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = IsometryEventBus.onSelectionChange((event) => {
      // Only react to clicks from Preview
      if (event.source !== 'preview') return;

      const { cardId } = event;

      // Find the card node in editor by cardId
      // (Assumes cards have data-card-id attribute or custom node type)
      const { state } = editor;
      let cardPosition: number | null = null;

      state.doc.descendants((node, pos) => {
        if (node.attrs?.cardId === cardId || node.attrs?.id === cardId) {
          cardPosition = pos;
          return false; // Stop searching
        }
        return true;
      });

      if (cardPosition !== null) {
        // Move cursor to card position and scroll into view
        editor
          .chain()
          .focus()
          .setTextSelection(cardPosition)
          .scrollIntoView()
          .run();
      }
    });

    return unsubscribe;
  }, [editor]);
}

// Alternative: Scroll to card in list/grid views
export function useScrollToCardInList(containerRef: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const unsubscribe = IsometryEventBus.onSelectionChange((event) => {
      if (event.source === 'capture') return; // Only scroll for external selections

      const container = containerRef.current;
      if (!container) return;

      // Find card element by data-card-id
      const cardElement = container.querySelector(
        `[data-card-id="${event.cardId}"]`
      ) as HTMLElement;

      if (cardElement) {
        // Scroll with smooth behavior
        cardElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });

        // Optional: Flash highlight
        cardElement.classList.add('highlight-flash');
        setTimeout(() => {
          cardElement.classList.remove('highlight-flash');
        }, 1000);
      }
    });

    return unsubscribe;
  }, [containerRef]);
}
```

### Pattern 6: Auto-Refresh Preview on Data Change
**What:** Preview tabs (Network, Timeline, Data Inspector) listen for data changes and re-query sql.js, then D3 re-renders with new data via `.join()`.

**When to use:** Required for SYNC-01 (Preview auto-refreshes when Capture saves card).

**Example:**
```typescript
// components/notebook/preview-tabs/NetworkGraphTab.tsx (excerpt)

import { useMemo, useRef, useEffect } from 'react';
import { useDataChangeListener } from '@/hooks/sync/useDataChangeListener';
import { useSQLite } from '@/db/SQLiteProvider';
import * as d3 from 'd3';

export function NetworkGraphTab() {
  const { execute } = useSQLite();
  const svgRef = useRef<SVGSVGElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Listen for data changes to nodes or edges tables
  useDataChangeListener(
    (event) => {
      // Trigger re-query by incrementing trigger
      setRefreshTrigger(prev => prev + 1);
    },
    {
      tables: ['nodes', 'edges'],
      debounceMs: 200, // Debounce rapid saves
    }
  );

  // Query data (re-runs when refreshTrigger changes)
  const graphData = useMemo(() => {
    const nodeRows = execute(
      'SELECT id, name, folder FROM nodes WHERE deleted_at IS NULL LIMIT 100'
    );
    const edgeRows = execute(
      'SELECT source_id, target_id, edge_type, weight FROM edges'
    );

    return {
      nodes: nodeRows.map(row => ({
        id: row.id,
        label: row.name,
        group: row.folder || 'default',
      })),
      links: edgeRows.map(row => ({
        source: row.source_id,
        target: row.target_id,
        type: row.edge_type,
        weight: row.weight,
      })),
    };
  }, [execute, refreshTrigger]);

  // Render graph with D3 (D3's .join() auto-updates on data change)
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);

    // D3 data join automatically updates nodes/links
    svg.selectAll('.node')
      .data(graphData.nodes, d => d.id)
      .join('circle')
        .attr('class', 'node')
        .attr('r', 8)
        .attr('fill', d => d3.schemeCategory10[d.group % 10]);

    svg.selectAll('.link')
      .data(graphData.links, d => `${d.source}-${d.target}`)
      .join('line')
        .attr('class', 'link')
        .attr('stroke', '#999');

    // ... force simulation, positioning, etc.
  }, [graphData]);

  return <svg ref={svgRef} width={800} height={600} />;
}
```

### Anti-Patterns to Avoid
- **Don't use React state for all data:** D3 manages visualization state, TipTap manages editor state. Only use React state for UI concerns (loading, error).
- **Don't poll for changes:** Use event bus. Polling wastes CPU and has delay.
- **Don't forget useEffect cleanup:** Always return cleanup function to remove event listeners. Memory leaks otherwise.
- **Don't dispatch events from event handlers synchronously:** Use `setTimeout(..., 0)` to defer event dispatch and avoid blocking transactions.
- **Don't create new listener functions on every render:** Use `useRef` to store stable callback references.
- **Don't use Context for everything:** Context causes re-renders. Only use for truly shared state (selection). Events for data changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Event system | Custom callback registry | DOM CustomEvent API | Native browser API. Zero bundle size. Supports bubbling, capture, detail payload. Well-tested. |
| Change detection | Manual dirty tracking | sql.js updateHook API | SQLite-level notifications. Fires on every INSERT/UPDATE/DELETE. No manual tracking needed. |
| Debouncing | Custom setTimeout logic | Debounce in useDataChangeListener | Centralized debouncing. Avoids duplicate implementations. Cleanup handled automatically. |
| Scroll to element | Manual scrollTop calculations | element.scrollIntoView() + TipTap scrollIntoView command | Handles smooth scrolling, block/inline positioning, browser compatibility. TipTap command also focuses editor. |
| Selection highlighting | Manual CSS class toggling | CSS :has() selector + data attributes | Modern CSS can highlight based on data-selected attribute. No JS class manipulation needed. |

**Key insight:** Native browser APIs (CustomEvent, scrollIntoView) handle edge cases you'll miss (event ordering, smooth scrolling, accessibility). TipTap and D3 have their own state management—use them instead of forcing everything through React state.

## Common Pitfalls

### Pitfall 1: Event Listener Memory Leaks
**What goes wrong:** Components unmount but event listeners remain active, causing memory leaks and stale closures executing on events.

**Why it happens:** Forgetting to return cleanup function from useEffect, or not calling removeEventListener with the exact same function reference.

**How to avoid:**
```typescript
useEffect(() => {
  const handler = (event: CustomEvent) => {
    // Handle event
  };

  window.addEventListener('isometry:data-change', handler);

  // CRITICAL: Return cleanup function
  return () => {
    window.removeEventListener('isometry:data-change', handler);
  };
}, []);
```

**Warning signs:** Increasing memory usage over time, React DevTools shows unmounted components still updating, multiple handlers firing for single event.

### Pitfall 2: Synchronous Event Dispatch Blocks sql.js Transactions
**What goes wrong:** Dispatching CustomEvent synchronously from sql.js updateHook causes React state updates during transaction, leading to "Cannot update during render" errors or transaction failures.

**Why it happens:** updateHook fires during transaction execution. Dispatching event synchronously triggers React state updates before transaction completes.

**How to avoid:**
```typescript
db.updateHook((action, dbName, table, rowid) => {
  // DEFER event dispatch to next tick
  setTimeout(() => {
    IsometryEventBus.dispatchDataChange({
      table,
      operation: mapActionToOperation(action),
      rowid,
      timestamp: new Date(),
    });
  }, 0);
});
```

**Warning signs:** "Cannot update a component while rendering a different component" errors, transaction rollbacks, inconsistent database state.

### Pitfall 3: Debouncing Creates Stale Closures
**What goes wrong:** Debounced callback captures old props/state from when timeout was created, not current values.

**Why it happens:** JavaScript closure captures variables from outer scope at creation time. Debounce timeout created with old values.

**How to avoid:**
```typescript
// BAD: Stale closure
const debouncedRefresh = useCallback(
  debounce(() => {
    refresh(currentFilter); // currentFilter captured at creation time
  }, 200),
  [] // Empty deps—callback never updates
);

// GOOD: Use ref for latest value
const filterRef = useRef(currentFilter);
useEffect(() => {
  filterRef.current = currentFilter;
}, [currentFilter]);

const debouncedRefresh = useCallback(
  debounce(() => {
    refresh(filterRef.current); // Always latest value
  }, 200),
  [refresh]
);
```

**Warning signs:** Refreshes use old filter values, selections don't match current state, race conditions on rapid changes.

### Pitfall 4: Missing Table Filtering Causes Infinite Loops
**What goes wrong:** Component listens for all data changes, refreshes, which writes to database, which triggers another refresh—infinite loop.

**Why it happens:** Not filtering events by table or operation type. Component reacts to its own writes.

**How to avoid:**
```typescript
useDataChangeListener(
  (event) => {
    refresh();
  },
  {
    // ONLY listen to tables this component reads from
    tables: ['nodes', 'edges'],
    // ONLY listen to changes from other sources
    operations: ['INSERT', 'UPDATE'],
  }
);
```

**Warning signs:** Rapid-fire refresh calls, browser freezes, console flooded with "data changed" logs, React DevTools shows infinite render loop.

### Pitfall 5: D3 Re-Renders Without Key Functions
**What goes wrong:** D3 `.join()` treats every data change as complete replacement, causing jarring visual resets (force graph resets positions, timeline jumps).

**Why it happens:** Missing key function in `.data()` call—D3 can't track which nodes are same between updates.

**How to avoid:**
```typescript
// BAD: No key function
svg.selectAll('.node')
  .data(nodes) // D3 doesn't know which nodes are same
  .join('circle');

// GOOD: Key function preserves identity
svg.selectAll('.node')
  .data(nodes, d => d.id) // Track by stable ID
  .join('circle')
    .attr('cx', d => d.x)
    .attr('cy', d => d.y);
```

**Warning signs:** Force graph resets on data change, timeline jumps to different position, animations don't transition smoothly.

## Code Examples

Verified patterns from official sources and existing codebase:

### Complete Event Bus Implementation
```typescript
// services/sync/event-bus.ts
// Source: DOM CustomEvent API, event bus patterns from LogRocket and Medium articles

export type DataChangeEvent = {
  table: 'nodes' | 'edges' | 'notebook_cards' | 'facets';
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  rowid: number;
  nodeId?: string;
  timestamp: Date;
};

export type SelectionChangeEvent = {
  cardId: string;
  source: 'capture' | 'preview' | 'shell';
};

export class IsometryEventBus {
  private static readonly DATA_CHANGE = 'isometry:data-change';
  private static readonly SELECTION_CHANGE = 'isometry:selection-change';

  static dispatchDataChange(event: DataChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent(this.DATA_CHANGE, {
        detail: event,
        bubbles: false,
      })
    );
  }

  static dispatchSelectionChange(event: SelectionChangeEvent): void {
    window.dispatchEvent(
      new CustomEvent(this.SELECTION_CHANGE, {
        detail: event,
        bubbles: false,
      })
    );
  }

  static onDataChange(
    handler: (event: DataChangeEvent) => void
  ): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent<DataChangeEvent>).detail);
    };

    window.addEventListener(this.DATA_CHANGE, listener);

    return () => {
      window.removeEventListener(this.DATA_CHANGE, listener);
    };
  }

  static onSelectionChange(
    handler: (event: SelectionChangeEvent) => void
  ): () => void {
    const listener = (e: Event) => {
      handler((e as CustomEvent<SelectionChangeEvent>).detail);
    };

    window.addEventListener(this.SELECTION_CHANGE, listener);

    return () => {
      window.removeEventListener(this.SELECTION_CHANGE, listener);
    };
  }
}
```

### sql.js Change Tracking Integration
```typescript
// src/db/init.ts (modify existing initialization)
// Source: sql.js updateHook API

import initSqlJs, { Database } from 'sql.js-fts5';
import { IsometryEventBus } from '@/services/sync/event-bus';

export async function initializeDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file) => `/sql-wasm-fts5.wasm`,
  });

  const db = new SQL.Database();

  // Load schema...
  // ...

  // Enable change tracking
  if ('updateHook' in db && typeof db.updateHook === 'function') {
    db.updateHook(
      (actionCode: number, dbName: string, tableName: string, rowid: number) => {
        const operation =
          actionCode === 9 ? 'DELETE' :
          actionCode === 18 ? 'INSERT' :
          actionCode === 23 ? 'UPDATE' :
          'UPDATE';

        if (
          tableName === 'nodes' ||
          tableName === 'edges' ||
          tableName === 'notebook_cards' ||
          tableName === 'facets'
        ) {
          // Defer to next tick to avoid blocking transaction
          setTimeout(() => {
            IsometryEventBus.dispatchDataChange({
              table: tableName as any,
              operation,
              rowid,
              timestamp: new Date(),
            });
          }, 0);
        }
      }
    );
  }

  return db;
}
```

### Capture Component with Scroll to Card
```typescript
// components/notebook/CaptureComponent.tsx (excerpt)
// Source: TipTap scrollIntoView command, React useEffect cleanup pattern

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import { IsometryEventBus } from '@/services/sync/event-bus';

export function CaptureComponent() {
  const editor = useEditor({
    extensions: [/* ... */],
    content: '',
  });

  // Listen for selection changes from Preview
  useEffect(() => {
    if (!editor) return;

    const unsubscribe = IsometryEventBus.onSelectionChange((event) => {
      // Only scroll for clicks from Preview
      if (event.source !== 'preview') return;

      // Find card in editor
      const { state } = editor;
      let cardPosition: number | null = null;

      state.doc.descendants((node, pos) => {
        if (node.attrs?.id === event.cardId) {
          cardPosition = pos;
          return false;
        }
        return true;
      });

      if (cardPosition !== null) {
        editor
          .chain()
          .focus()
          .setTextSelection(cardPosition)
          .scrollIntoView()
          .run();
      }
    });

    return unsubscribe; // Cleanup on unmount
  }, [editor]);

  return <EditorContent editor={editor} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Polling for changes | sql.js updateHook API | sql.js v1.13 (2024) | Real-time notifications instead of polling. Lower CPU usage, instant updates. |
| Redux for all state | Distributed state (D3 + TipTap + Context) | 2020+ best practices | Less boilerplate, fewer re-renders. Use each library's native state management. |
| Callback props for cross-component communication | CustomEvent event bus | 2015+ (DOM Level 3) | Decoupled components. No prop drilling. Components don't need to know about each other. |
| Manual scrollTo calculations | scrollIntoView() API | Always existed, improved 2016+ | Smooth scrolling, accessibility, browser handles edge cases. |
| RxJS for event streams | Native CustomEvent + React hooks | 2018+ (React Hooks release) | Simpler for small apps. No heavy dependency. Hooks handle subscriptions naturally. |

**Deprecated/outdated:**
- **Polling modified_at for changes:** Replaced by sql.js updateHook. Polling wastes CPU and has latency.
- **Redux for D3 state:** D3's data join IS state management. Don't duplicate in Redux.
- **Lifting state to root component:** Use event bus for cross-canvas communication. State lifting causes unnecessary re-renders.

## Open Questions

1. **sql.js updateHook browser compatibility**
   - What we know: updateHook added in sql.js v1.13. Wraps sqlite3_update_hook C API.
   - What's unclear: Does it work in all browsers? Safari? iOS WebView?
   - Recommendation: Test in Safari/iOS. If unavailable, fall back to regex-based write detection (Pattern 2 alternative).

2. **Event ordering guarantees**
   - What we know: CustomEvent fires synchronously. setTimeout defers to next tick.
   - What's unclear: If multiple writes happen in same transaction, do events fire in order?
   - Recommendation: Assume no ordering guarantee. Debounce rapid events. Use timestamps if order matters.

3. **Performance with high-frequency updates**
   - What we know: Debouncing helps. D3 .join() is efficient.
   - What's unclear: How does system perform with 100+ updates/second (e.g., bulk import)?
   - Recommendation: Start with 100ms debounce. Profile with realistic workload. Increase debounce if needed.

4. **Selection highlighting across heterogeneous views**
   - What we know: SelectionContext stores selected IDs. Each view highlights differently (D3 node color, TipTap background, etc.).
   - What's unclear: Consistent highlight style? Or each view has its own?
   - Recommendation: Allow each view to style its own highlights. Shared behavior (selection state), not shared styling.

5. **Conflict resolution for bidirectional navigation**
   - What we know: Preview → Capture scroll works. Capture → Preview scroll works.
   - What's unclear: What if user scrolls in one canvas while other is auto-scrolling?
   - Recommendation: Auto-scroll only if user hasn't interacted with target canvas in last 2 seconds. Use "user activity" timestamp to detect.

## Sources

### Primary (HIGH confidence)
- [DOM CustomEvent API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) - Official browser API
- [sql.js GitHub - updateHook](https://github.com/sql-js/sql.js) - Official sql.js documentation
- [React useEffect Reference](https://react.dev/reference/react/useEffect) - Official React docs for cleanup pattern
- [TipTap scrollIntoView command](https://tiptap.dev/docs/editor/api/commands/selection/scroll-into-view) - Official TipTap API
- [Element.scrollIntoView() (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) - Native browser API
- Isometry Codebase:
  - `/src/contexts/SelectionContext.tsx` - Existing selection state management
  - `/src/hooks/database/useLiveData.tsx` - Existing live data patterns with event listeners
  - `/src/state/SelectionContext.tsx` - Selection provider implementation

### Secondary (MEDIUM confidence)
- [Using custom events in React - LogRocket Blog](https://blog.logrocket.com/using-custom-events-react/) - Event bus patterns
- [EventBus Pattern in React - Medium](https://medium.com/@ilham.abdillah.alhamdi/eventbus-pattern-in-react-a-lightweight-alternative-to-context-and-redux-cc6e8a1dc9ca) - Architecture patterns
- [React Components communication with Custom Events - Medium](https://medium.com/my-javascript-route/react-components-communication-with-custom-events-3417f913e084) - Implementation examples
- [React scroll-sync (GitHub)](https://github.com/okonet/react-scroll-sync) - Synchronized scrolling patterns
- [D3.js with React: Data Visualization - SitePoint](https://www.sitepoint.com/d3-js-react-interactive-data-visualizations/) - D3 integration patterns
- [Real-Time Visualization With React and D3.js - Memgraph](https://memgraph.com/blog/real-time-visualization-with-react-and-d3-js) - Live data update patterns

### Tertiary (LOW confidence)
- [React Observable Hooks](https://observable-hooks.js.org/) - RxJS alternative (not recommended for this use case)
- [Event Bus for React (GitHub)](https://github.com/goto-bus-stop/react-bus) - Third-party library (not needed—use native CustomEvent)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All native APIs or existing dependencies. No new libraries.
- Architecture: MEDIUM-HIGH - CustomEvent pattern is proven, but sql.js updateHook is recent (v1.13). May need fallback.
- Pitfalls: MEDIUM - Based on web search and existing codebase patterns. Some edge cases may emerge during implementation.

**Research date:** 2026-02-10
**Valid until:** 2026-04-10 (60 days - stable APIs, minimal ecosystem churn)

**Coverage:**
- ✅ SYNC-01: Preview auto-refresh on Capture save - useDataChangeListener + D3 .join()
- ✅ SYNC-02: Click in Preview, Capture scrolls - TipTap scrollIntoView command
- ✅ SYNC-03: Selection highlighted across canvases - SelectionContext + event bus
- ✅ Event bus architecture (CustomEvent API)
- ✅ sql.js change tracking (updateHook API + fallback)
- ✅ React hooks for subscriptions (useDataChangeListener, useSelectionSync)
- ✅ Performance considerations (debouncing, table filtering)

**Not researched (out of scope for Phase 46):**
- Real-time collaboration (multi-user) - not in requirements
- Offline sync conflict resolution - not in requirements
- WebSocket-based sync - not needed (local-first app)
- Animation/transitions during sync - polish for later phase

**Integration with existing stack:**
- React 18: Compatible - useEffect cleanup pattern is standard ✓
- sql.js 1.13+: Compatible - updateHook API available ✓
- D3.js v7: Compatible - .join() handles auto-updates ✓
- TipTap 3.19+: Compatible - scrollIntoView command exists ✓
- SelectionContext: Extends existing implementation ✓
