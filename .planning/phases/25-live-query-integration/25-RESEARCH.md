# Phase 25: Live Query Integration (Gap Closure) - Research

**Researched:** 2026-01-31
**Domain:** Real-time React-Native database synchronization
**Confidence:** HIGH

## Summary

Research focused on connecting the existing useLiveQuery React hook to GRDB ValueObservation for real-time change notifications. The current codebase already has comprehensive infrastructure in place - useLiveQuery hook with TanStack Query integration, ChangeNotifier bridge system, and GRDB ValueObservation capabilities. The gap is connecting GRDB's native change detection to React's live query system through the WebView bridge.

Phase 25 represents the critical "last mile" integration - bridging Swift's GRDB ValueObservation with React's useLiveQuery hook through the existing WebView message infrastructure. All foundational components exist; they need coordination and optimization for real-time performance.

**Primary recommendation:** Implement GRDB ValueObservation → WebView Bridge → React Integration pipeline with sequence tracking and performance optimization

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| GRDB.swift | 7.9.0+ | Swift SQLite with ValueObservation | Industry standard for reactive Swift SQLite, mature ValueObservation API |
| TanStack Query | 5.x | React server state management | Dominant React data fetching library (30%+ adoption), built-in optimistic updates |
| React | 18+ | Frontend framework | Project requirement, mature concurrent features |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| swift-async-algorithms | latest | AsyncStream processing | GRDB ValueObservation → WebView bridge streaming |
| MessagePack | 1.x | Binary serialization | Large query result optimization (existing in codebase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GRDB ValueObservation | Manual SQLite triggers | GRDB provides efficient change detection and thread safety |
| TanStack Query | SWR | TanStack Query has better optimistic updates and caching strategies |
| WebView Bridge | HTTP API | Bridge provides lower latency and better security for real-time updates |

**Installation:**
```bash
# Already installed in current codebase
# GRDB.swift via Swift Package Manager
# TanStack Query via npm
```

## Architecture Patterns

### Recommended Data Flow
```
Swift GRDB Database
├── ValueObservation.tracking        # Native change detection
├── AsyncStream conversion           # Bridge GRDB to Swift concurrency
├── WebView Bridge messaging         # Serialize and send to React
├── ChangeNotifier routing          # React-side message handling
├── TanStack Query cache update     # Optimistic UI updates
└── React component re-render       # Automatic UI synchronization
```

### Pattern 1: GRDB ValueObservation Integration
**What:** Connect GRDB's native change detection to WebView bridge
**When to use:** For all live query operations requiring real-time updates
**Example:**
```swift
// Source: GRDB documentation + WebView bridge integration
func startLiveObservation(sql: String, params: [Any], observationId: String) async {
    let observation = ValueObservation.tracking { db in
        try Row.fetchAll(db, sql: sql, arguments: StatementArguments(params))
    }

    for try await results in observation.values(in: database.getDatabasePool()) {
        let message = LiveDataEvent(
            type: "liveData",
            event: "change",
            sequenceNumber: getNextSequenceNumber(),
            observationId: observationId,
            results: results.map { $0.dictionary }
        )
        await sendToWebView(message)
    }
}
```

### Pattern 2: Optimistic Update Coordination
**What:** Coordinate optimistic updates between React and native database
**When to use:** For user-initiated mutations that need immediate feedback
**Example:**
```typescript
// Source: TanStack Query optimistic updates + custom bridge integration
const mutation = useMutation({
  mutationFn: async (data) => {
    // 1. Apply optimistic update to cache
    queryClient.setQueryData(queryKey, optimisticData);

    // 2. Send mutation to native
    const result = await webViewBridge.database.updateNode(data);

    // 3. Native GRDB triggers ValueObservation
    // 4. Real data flows back through live query system
    return result;
  },
  onError: (error, variables, context) => {
    // Rollback optimistic update
    queryClient.setQueryData(queryKey, context.previousData);
  }
});
```

### Pattern 3: Sequence-Based Race Condition Prevention
**What:** Use sequence numbers to prevent out-of-order updates
**When to use:** For all real-time data synchronization
**Example:**
```typescript
// Source: Existing ChangeNotifier + GRDB sequence tracking
const handleLiveUpdate = useCallback((updateData: {
  sequenceNumber: number;
  results: T[];
  observationId: string;
}) => {
  // Sequence number validation for race condition prevention
  if (updateData.sequenceNumber <= lastSequenceNumber.current) {
    console.warn('Ignoring out-of-order update:', {
      received: updateData.sequenceNumber,
      last: lastSequenceNumber.current
    });
    return;
  }

  lastSequenceNumber.current = updateData.sequenceNumber;
  queryClient.setQueryData(finalCacheKey, updateData.results);
}, []);
```

### Anti-Patterns to Avoid
- **Polling for changes:** Use ValueObservation instead of manual polling
- **Direct database access from React:** Always go through WebView bridge
- **Ignoring sequence numbers:** Leads to race conditions in rapid updates
- **Blocking main thread:** Use AsyncStream for non-blocking observation

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database change detection | Custom SQLite triggers | GRDB ValueObservation | Handles threading, change coalescing, memory management |
| Optimistic UI updates | Manual state management | TanStack Query mutations | Built-in rollback, error handling, cache coordination |
| WebView message ordering | Simple message queue | Sequence tracking system | Prevents race conditions, handles out-of-order delivery |
| Cache invalidation | Manual cache clearing | TanStack Query invalidation strategies | Intelligent related query invalidation |
| Memory management | Manual observers | Swift AsyncStream + React Cleanup | Automatic lifecycle management, proper cleanup |

**Key insight:** Real-time database synchronization involves complex edge cases (race conditions, memory leaks, thread safety) that mature libraries handle better than custom implementations.

## Common Pitfalls

### Pitfall 1: Thread Safety Violations
**What goes wrong:** Accessing GRDB database from wrong queue or updating React state from background threads
**Why it happens:** ValueObservation callbacks run on database queue, React updates must be on main thread
**How to avoid:** Use GRDB's built-in threading model and proper WebView bridge message handling
**Warning signs:** Crashes with "Database is not reachable" or "React state updates from non-main thread"

### Pitfall 2: Memory Leaks in Observer Chains
**What goes wrong:** ValueObservation and React subscription cleanup not properly coordinated
**Why it happens:** Async observers outlive React components or Swift actors
**How to avoid:** Use cancellation tokens and proper cleanup in useEffect dependencies
**Warning signs:** Memory usage growing over time, observers continuing after component unmount

### Pitfall 3: Race Conditions in Rapid Updates
**What goes wrong:** Out-of-order updates cause inconsistent UI state
**Why it happens:** Network latency and async processing can reorder messages
**How to avoid:** Implement sequence tracking and message ordering (already exists in codebase)
**Warning signs:** UI flickering, temporary incorrect data, state inconsistencies

### Pitfall 4: Performance Degradation with Large Result Sets
**What goes wrong:** Large query results cause WebView bridge congestion and UI freezing
**Why it happens:** Serializing and sending large data sets blocks message queue
**How to avoid:** Use query pagination and result chunking (QueryPaginator already implemented)
**Warning signs:** Slow response times, UI blocking, high memory usage

### Pitfall 5: Cache Inconsistency Between Optimistic and Real Updates
**What goes wrong:** Optimistic updates don't match real data when mutation succeeds
**Why it happens:** Optimistic update logic doesn't perfectly mirror database logic
**How to avoid:** Keep optimistic updates simple, rely on live query to provide authoritative data
**Warning signs:** Data briefly showing incorrect values, UI "jumping" between states

## Code Examples

Verified patterns from official sources and existing codebase:

### GRDB ValueObservation Setup
```swift
// Source: GRDB documentation + IsometryDatabase integration
public func observeQuery(sql: String, arguments: StatementArguments = StatementArguments()) -> AsyncThrowingStream<[[String: Any]], Error> {
    return AsyncThrowingStream { continuation in
        let observation = ValueObservation.trackingConstantRegion { db in
            try Row.fetchAll(db, sql: sql, arguments: arguments)
        }
        .map { rows in
            // Convert Row objects to dictionaries for serialization
            return rows.map { row in
                var dict: [String: Any] = [:]
                for column in row.columnNames {
                    dict[column] = row[column]
                }
                return dict
            }
        }

        let cancellable = observation.start(
            in: dbPool,
            onError: { error in
                continuation.finish(throwing: error)
            },
            onChange: { results in
                continuation.yield(results)
            }
        )

        continuation.onTermination = { _ in
            cancellable.cancel()
        }
    }
}
```

### WebView Bridge Live Data Integration
```typescript
// Source: Existing webview-bridge.ts + change-notifier.ts
public liveData = {
  startObservation: async (observationId: string, sql: string, params: unknown[] = []): Promise<boolean> => {
    const result = await this.postMessage<{ success: boolean }>('liveData', 'startObservation', {
      observationId,
      sql,
      params
    });
    return result.success;
  },

  stopObservation: async (observationId: string): Promise<boolean> => {
    const result = await this.postMessage<{ success: boolean }>('liveData', 'stopObservation', {
      observationId
    });
    return result.success;
  }
};
```

### React useLiveQuery Integration
```typescript
// Source: Existing useLiveQuery.ts with TanStack Query integration
export function useLiveQuery<T = unknown>(
  sql: string,
  options: LiveQueryOptions = {}
): LiveQueryResult<T> {
  const queryClient = useQueryClient();

  // TanStack Query for intelligent caching
  const tanstackQuery = useQuery({
    queryKey: finalCacheKey,
    queryFn: queryFunction,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: enableCache && autoStart
  });

  // Handle live data updates with sequence tracking
  const handleLiveUpdate = useCallback((updateData: {
    sequenceNumber: number;
    results: T[];
    observationId: string;
  }) => {
    // Sequence number validation for race condition prevention
    if (updateData.sequenceNumber <= lastSequenceNumber.current) {
      console.warn('Ignoring out-of-order update');
      return;
    }

    lastSequenceNumber.current = updateData.sequenceNumber;

    // Update TanStack Query cache with live data
    if (enableCache) {
      queryClient.setQueryData(finalCacheKey, updateData.results);
    }
  }, []);

  // Start live observation
  const startLive = useCallback(async () => {
    if (isLive || !isConnected) return;

    const subscriptionId = subscribe(
      sql,
      params,
      handleLiveUpdate,
      handleLiveError
    );

    setObservationId(subscriptionId);
    setIsLive(true);
  }, []);

  return {
    data: tanstackQuery.data,
    loading: tanstackQuery.isLoading,
    error: tanstackQuery.error?.message || null,
    isLive,
    startLive,
    stopLive,
    refetch: tanstackQuery.refetch
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual polling | GRDB ValueObservation | GRDB 4.0+ (2020) | Efficient change detection, lower battery usage |
| Custom React state | TanStack Query | 2021-2023 | Better caching, optimistic updates, error handling |
| HTTP polling | WebView Bridge | Project architecture | Lower latency, better security |
| useState + useEffect | useLiveQuery hook | Phase 21 (2026) | Unified live data interface, automatic cache management |

**Deprecated/outdated:**
- Direct SQLite.swift without GRDB: Missing reactive capabilities
- React Query v3: Replaced by TanStack Query v5 with better TypeScript support
- Manual WebView message handling: Replaced by structured bridge architecture

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Batch Size for Live Updates**
   - What we know: MessageBatcher exists with 16ms intervals for 60fps
   - What's unclear: Best batch size for database change notifications vs UI updates
   - Recommendation: Start with 50 records per batch, monitor performance metrics

2. **Memory Management Under High Change Volume**
   - What we know: GRDB ValueObservation and React cleanup exist
   - What's unclear: Memory behavior with hundreds of active observations
   - Recommendation: Implement observation limit and LRU cleanup strategy

3. **Optimistic Update Rollback Strategy**
   - What we know: TanStack Query provides rollback mechanisms
   - What's unclear: How to handle complex rollback scenarios with relationships
   - Recommendation: Keep optimistic updates simple, rely on live queries for complex updates

## Sources

### Primary (HIGH confidence)
- GRDB.swift 7.9.0 official documentation - ValueObservation patterns and best practices
- TanStack Query documentation - Optimistic updates and real-time integration
- Existing codebase analysis - useLiveQuery.ts, WebViewBridge.ts, IsometryDatabase.swift

### Secondary (MEDIUM confidence)
- Shopify Mobile Bridge engineering blog (2025) - WebView optimization patterns
- TanStack Query WebSocket integration guide - Real-time data synchronization
- React 19 useOptimistic documentation - Modern optimistic update patterns

### Tertiary (LOW confidence)
- Various Medium articles on GRDB performance - Implementation tips
- React state management trend analysis - 2025 best practices
- WebView performance optimization guides - General optimization strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, well-documented
- Architecture: HIGH - GRDB ValueObservation and React patterns well-established
- Pitfalls: HIGH - Based on existing codebase analysis and known patterns

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (60 days - stable technologies with some emerging patterns)