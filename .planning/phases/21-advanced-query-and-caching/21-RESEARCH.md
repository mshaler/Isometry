# Phase 21: Advanced Query and Caching - Research

**Researched:** 2026-01-30
**Domain:** Performance optimization, virtual scrolling, intelligent caching
**Confidence:** HIGH

## Summary

Phase 21 focuses on optimizing performance for large datasets through virtual scrolling, intelligent caching, memory leak prevention, background sync, and bandwidth-aware optimization. The research reveals mature, production-ready solutions for each performance requirement.

TanStack Virtual v3 provides headless virtualization at 60 FPS for massive datasets. TanStack Query v5 offers sophisticated caching with smart invalidation strategies. Modern React patterns prevent memory leaks through proper cleanup. Background sync queues with exponential backoff ensure reliability. Network Information API enables bandwidth-aware adaptation.

**Primary recommendation:** Implement TanStack Virtual + TanStack Query as the core performance stack, with proper cleanup patterns and intelligent sync strategies.

## Standard Stack

The established libraries/tools for performance optimization:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TanStack Virtual | v3 | Virtual scrolling for large lists | 60 FPS performance, 6.6k stars, headless design |
| TanStack Query | v5 | Intelligent caching and state management | Production-proven, smart invalidation, 41k stars |
| React | 18+ | UI framework with concurrent features | Built-in performance optimizations, Suspense |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| exponential-backoff | latest | Retry logic with jitter | Background sync failures |
| react-intersection-observer | latest | Viewport detection | Lazy loading optimization |
| @tanstack/react-table | v8 | Table virtualization | Complex data grids |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Virtual | react-window | Less flexible, no framework agnostic |
| TanStack Query | SWR | Less feature-complete caching |
| Custom retry | Built-in setTimeout | No jitter, thundering herd issues |

**Installation:**
```bash
npm install @tanstack/react-virtual @tanstack/react-query exponential-backoff
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── hooks/
│   ├── useVirtualizedList.ts    # Virtual scrolling hook
│   ├── useLiveQuery.ts          # Cached query with real-time updates
│   └── useBackgroundSync.ts     # Sync queue management
├── components/
│   ├── VirtualizedGrid/         # Virtual grid component
│   └── VirtualizedList/         # Virtual list component
├── services/
│   ├── queryClient.ts           # TanStack Query configuration
│   ├── syncQueue.ts             # Background sync implementation
│   └── networkMonitor.ts        # Connection quality detection
└── utils/
    ├── cacheInvalidation.ts     # Cache strategy utilities
    └── memoryManagement.ts      # Cleanup utilities
```

### Pattern 1: Virtual Scrolling with TanStack Virtual
**What:** Render only visible items in large datasets
**When to use:** Lists/grids with 1000+ items
**Example:**
```typescript
// Source: TanStack Virtual v3 docs
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualList({ items }) {
  const parentRef = useRef()

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
    overscan: 10 // Buffer items for smooth scrolling
  })

  return (
    <div ref={parentRef} style={{ height: '400px', overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualItem.size,
              transform: `translateY(${virtualItem.start}px)`
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Pattern 2: Intelligent Caching with TanStack Query
**What:** Smart cache with TTL and invalidation
**When to use:** Frequently accessed, expensive queries
**Example:**
```typescript
// Source: TanStack Query v5 docs
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error.status === 404) return false
        return failureCount < 3
      }
    }
  }
})

// Smart invalidation after mutations
const useUpdateNode = () => {
  return useMutation({
    mutationFn: updateNode,
    onSuccess: (data, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: ['nodes', variables.nodeId]
      })
      queryClient.invalidateQueries({
        queryKey: ['graph']
      })
    }
  })
}
```

### Pattern 3: Background Sync with Retry Logic
**What:** Queue-based sync with exponential backoff
**When to use:** Offline-capable applications
**Example:**
```typescript
// Source: exponential-backoff npm package
import { backOff } from 'exponential-backoff'

class SyncQueue {
  private queue: SyncOperation[] = []
  private processing = false

  async processSyncOperation(operation: SyncOperation) {
    return backOff(() => this.executeSyncOperation(operation), {
      numOfAttempts: 5,
      startingDelay: 300,
      timeMultiple: 2,
      maxDelay: 30000,
      jitter: 'full'
    })
  }

  private async executeSyncOperation(operation: SyncOperation) {
    const response = await fetch(operation.endpoint, {
      method: operation.method,
      body: JSON.stringify(operation.data)
    })

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.status}`)
    }

    return response.json()
  }
}
```

### Pattern 4: Memory Leak Prevention
**What:** Proper cleanup in useEffect hooks
**When to use:** All components with side effects
**Example:**
```typescript
// Source: React 2025 best practices
function useBackgroundSync() {
  useEffect(() => {
    const cleanups: (() => void)[] = []

    // WebSocket connection
    const ws = new WebSocket('wss://api.example.com/sync')
    cleanups.push(() => ws.close())

    // Interval timer
    const intervalId = setInterval(() => syncPendingChanges(), 30000)
    cleanups.push(() => clearInterval(intervalId))

    // Event listener
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncImmediately()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    cleanups.push(() =>
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    )

    return () => cleanups.forEach(cleanup => cleanup())
  }, [])
}
```

### Pattern 5: Bandwidth-Aware Loading
**What:** Adapt content quality based on network conditions
**When to use:** Mobile apps with large media
**Example:**
```typescript
// Source: Network Information API 2025
function useNetworkAwareLoading() {
  const [connectionQuality, setConnectionQuality] = useState<'high' | 'medium' | 'low'>('high')

  useEffect(() => {
    if ('connection' in navigator) {
      const updateConnectionInfo = () => {
        const connection = navigator.connection
        const effectiveType = connection.effectiveType

        if (effectiveType === '4g' && connection.downlink > 2) {
          setConnectionQuality('high')
        } else if (effectiveType === '3g' || connection.downlink > 0.5) {
          setConnectionQuality('medium')
        } else {
          setConnectionQuality('low')
        }
      }

      updateConnectionInfo()
      connection.addEventListener('change', updateConnectionInfo)

      return () => connection.removeEventListener('change', updateConnectionInfo)
    }
  }, [])

  return connectionQuality
}
```

### Anti-Patterns to Avoid
- **Manual scroll calculations:** Use TanStack Virtual instead of custom virtualization
- **Global state for cache:** Use TanStack Query's built-in cache management
- **Synchronous large operations:** Always use background processing for heavy work
- **Missing cleanup functions:** Every useEffect with side effects must have cleanup

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Virtual scrolling | Custom viewport calculations | TanStack Virtual | Handles edge cases, dynamic sizing, 60 FPS performance |
| Query caching | Manual cache with Maps/Objects | TanStack Query | Smart invalidation, garbage collection, stale-while-revalidate |
| Retry logic | setTimeout loops | exponential-backoff | Prevents thundering herd, proper jitter |
| Network detection | Custom bandwidth tests | Network Information API | Native browser implementation, real-time updates |
| Memory leak detection | Manual tracking | React DevTools + Profiler | Built-in leak detection, performance insights |

**Key insight:** Performance optimization requires handling numerous edge cases (window resizing, dynamic content, offline scenarios, memory pressure) that mature libraries have already solved and tested at scale.

## Common Pitfalls

### Pitfall 1: Virtual Scrolling Without Overscan
**What goes wrong:** Janky scrolling, white flashes during fast scroll
**Why it happens:** Not rendering buffer items outside viewport
**How to avoid:** Set overscan to 5-10 items in virtualizer config
**Warning signs:** Users report flickering or empty spaces while scrolling

### Pitfall 2: Cache Invalidation Race Conditions
**What goes wrong:** Stale data displayed after mutations, inconsistent UI state
**Why it happens:** Invalidation occurs before mutation completes or in wrong order
**How to avoid:** Use TanStack Query's onSuccess callbacks with proper query key patterns
**Warning signs:** UI showing old data after successful updates

### Pitfall 3: Memory Leaks in useEffect
**What goes wrong:** App becomes sluggish after 10-15 minutes, eventual crashes
**Why it happens:** Event listeners, timers, or subscriptions not cleaned up properly
**How to avoid:** Every useEffect with side effects must return cleanup function
**Warning signs:** Increasing memory usage in DevTools, "state update on unmounted component" warnings

### Pitfall 4: Thundering Herd in Retry Logic
**What goes wrong:** All clients retry simultaneously, overwhelming server
**Why it happens:** No jitter in retry delays, synchronized retry attempts
**How to avoid:** Use exponential backoff with full jitter
**Warning signs:** Server getting hammered with identical timestamps in logs

### Pitfall 5: Network Quality Detection Lag
**What goes wrong:** App doesn't adapt quickly to network changes
**Why it happens:** Only checking connection quality on initial load
**How to avoid:** Listen for 'change' events on navigator.connection
**Warning signs:** App still loading high-quality content on slow connections

### Pitfall 6: SQLite Query Performance Degradation
**What goes wrong:** Queries slow down as dataset grows
**Why it happens:** Missing indexes, suboptimal query structure
**How to avoid:** Use EXPLAIN QUERY PLAN, create composite indexes, run PRAGMA optimize
**Warning signs:** Query times increasing linearly with data size

## Code Examples

Verified patterns from official sources:

### Virtual Grid with Dynamic Sizing
```typescript
// Source: TanStack Virtual v3 docs
import { useVirtualizer } from '@tanstack/react-virtual'

function VirtualGrid({ data, columnCount = 3 }) {
  const parentRef = useRef()
  const rowCount = Math.ceil(data.length / columnCount)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Row height
    measureElement: (el) => el?.getBoundingClientRect().height,
    overscan: 2
  })

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: columnCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 300, // Column width
    measureElement: (el) => el?.getBoundingClientRect().width
  })

  return (
    <div ref={parentRef} className="h-96 w-full overflow-auto">
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: columnVirtualizer.getTotalSize(),
          position: 'relative'
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => (
          columnVirtualizer.getVirtualItems().map(virtualColumn => {
            const index = virtualRow.index * columnCount + virtualColumn.index
            const item = data[index]

            if (!item) return null

            return (
              <div
                key={`${virtualRow.index}-${virtualColumn.index}`}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: virtualColumn.size,
                  height: virtualRow.size,
                  transform: `translateX(${virtualColumn.start}px) translateY(${virtualRow.start}px)`
                }}
              >
                {item}
              </div>
            )
          })
        ))}
      </div>
    </div>
  )
}
```

### Advanced Query Caching with Optimistic Updates
```typescript
// Source: TanStack Query v5 docs
const useOptimisticNodeUpdate = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (nodeData: NodeUpdate) => {
      const response = await fetch(`/api/nodes/${nodeData.id}`, {
        method: 'PUT',
        body: JSON.stringify(nodeData)
      })
      if (!response.ok) throw new Error('Update failed')
      return response.json()
    },

    onMutate: async (nodeData) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ['nodes', nodeData.id] })

      // Snapshot current value
      const previousNode = queryClient.getQueryData(['nodes', nodeData.id])

      // Optimistically update
      queryClient.setQueryData(['nodes', nodeData.id], (old: Node) => ({
        ...old,
        ...nodeData,
        updatedAt: new Date().toISOString()
      }))

      return { previousNode }
    },

    onError: (err, nodeData, context) => {
      // Rollback on error
      queryClient.setQueryData(['nodes', nodeData.id], context.previousNode)
    },

    onSettled: (data, error, nodeData) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['nodes', nodeData.id] })
      queryClient.invalidateQueries({ queryKey: ['graph'] })
    }
  })
}
```

### SQLite Query Optimization
```sql
-- Source: SQLite optimization guides 2025
-- Create composite indexes for common query patterns
CREATE INDEX idx_nodes_type_updated ON nodes(type, updated_at);
CREATE INDEX idx_edges_source_target ON edges(source_id, target_id);

-- Use partial indexes for filtered queries
CREATE INDEX idx_active_nodes ON nodes(id) WHERE active = 1;

-- Query with proper index usage
EXPLAIN QUERY PLAN
SELECT n.*, COUNT(e.id) as edge_count
FROM nodes n
LEFT JOIN edges e ON n.id = e.source_id
WHERE n.type = 'document'
  AND n.updated_at > datetime('now', '-1 day')
  AND n.active = 1
GROUP BY n.id
ORDER BY n.updated_at DESC
LIMIT 50;

-- Optimize with covering index
CREATE INDEX idx_nodes_covering ON nodes(type, updated_at, id, title, content)
WHERE active = 1;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| react-window | TanStack Virtual | 2024 | Framework agnostic, better API |
| React Query v4 | TanStack Query v5 | 2023 | Improved TypeScript, new features |
| Custom retry logic | exponential-backoff | 2025 | Production-ready patterns |
| Manual network detection | Network Information API | 2023 | Native browser support |
| Memory leak hunting | React DevTools Profiler | 2024 | Built-in detection tools |

**Deprecated/outdated:**
- react-virtualized: Replaced by react-window, then TanStack Virtual
- Manual cache implementations: TanStack Query handles all edge cases
- Synchronous large operations: React 18 concurrent features enable background processing

## Open Questions

Things that couldn't be fully resolved:

1. **Cross-platform virtualization performance**
   - What we know: TanStack Virtual works on web, some React Native solutions exist
   - What's unclear: Performance parity between web and native implementations
   - Recommendation: Benchmark both platforms with representative data

2. **SQLite WAL mode in React Native**
   - What we know: WAL provides better performance on desktop SQLite
   - What's unclear: Support and benefits in react-native-sqlite-2 bridge
   - Recommendation: Test WAL mode compatibility with existing bridge implementation

3. **Network Information API browser support**
   - What we know: Chrome/Edge support, limited Firefox/Safari
   - What's unclear: Fallback strategies for unsupported browsers
   - Recommendation: Implement feature detection with graceful degradation

## Sources

### Primary (HIGH confidence)
- TanStack Virtual v3 - Official docs, API reference, performance characteristics
- TanStack Query v5 - Query invalidation guides, caching strategies
- SQLite optimization guides - PowerSync, performance tuning articles
- Network Information API - Sling Academy implementation guide

### Secondary (MEDIUM confidence)
- exponential-backoff npm package - Usage patterns, jitter strategies
- React memory management - Dev.to articles verified with official patterns
- WebSearch for ecosystem trends - Multiple sources cross-referenced

### Tertiary (LOW confidence)
- Performance benchmarks from Medium articles - Need validation in actual implementation
- Browser support claims - Should verify with Can I Use for production decisions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TanStack libraries are industry standard, well-documented
- Architecture: HIGH - Patterns verified from official documentation and production use
- Pitfalls: MEDIUM - Common issues documented in community, some from experience

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30 days for stable libraries, some fast-moving features)