# Architecture Research

**Domain:** Live Database Integration via WebView Bridge
**Researched:** 2026-01-30
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     React Components                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │ useSQLQuery │  │ useLiveData │  │ Context APIs│        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                 │                │                │
├─────────┴─────────────────┴────────────────┴────────────────┤
│                    Bridge Communication Layer               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WKWebView Bridge Protocol              │    │
│  │  - Request/Response Correlation                     │    │
│  │  - Message Queue + Circuit Breaker                 │    │
│  │  - Live Update Notifications                       │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                     Native Database Layer                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ IsometryDB   │  │ CloudKit     │  │ Query Cache  │      │
│  │ (GRDB Actor) │  │ Sync Manager │  │ & Observers  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| useSQLiteQuery | Query execution with fallback | Hook with database context + local sql.js fallback |
| useLiveData | Real-time subscriptions | WebSocket-style updates via bridge notifications |
| WebView Bridge | Secure message transport | WKMessageHandler with UUID correlation + error handling |
| IsometryDatabase | Thread-safe DB operations | Swift Actor with GRDB for SQLite + FTS5 |
| Query Cache | Performance optimization | In-memory results cache + invalidation patterns |
| CloudKit Sync | Data synchronization | Background actor for remote state management |

## Recommended Project Structure

```
src/
├── hooks/                 # Database integration hooks
│   ├── useSQLiteQuery.ts  # Main query hook with bridge integration
│   ├── useLiveData.tsx    # Real-time subscription management
│   └── useBridgeDatabase.ts # Bridge communication abstraction
├── utils/                 # Bridge infrastructure
│   ├── webview-bridge.ts  # Core bridge communication
│   ├── bridge-performance.ts # Monitoring & circuit breaker
│   └── bridge-waiter.ts   # Connection management
├── types/                 # Type definitions
│   ├── bridge.d.ts        # Bridge message types
│   └── database.d.ts      # Database result types
└── context/               # Shared state
    ├── DatabaseContext.tsx # Database provider + environment detection
    └── LiveDataContext.tsx # Real-time update coordination

native/Sources/Isometry/
├── Database/              # Core database layer
│   ├── IsometryDatabase.swift # Main actor with CRUD + graph operations
│   └── DatabaseMigrator.swift # Schema versioning
├── Bridge/                # WebView communication
│   ├── BridgeMessageHandler.swift # WKMessageHandler implementation
│   ├── DatabaseBridgeAPI.swift   # Query execution endpoint
│   └── LiveUpdateNotifier.swift  # Push updates to React
└── Sync/                  # Data synchronization
    └── CloudKitSyncManager.swift # Background sync coordination
```

### Structure Rationale

- **hooks/:** Abstracts bridge complexity from React components, provides consistent API regardless of environment
- **Bridge layer:** Handles environment detection, fallback strategies, and maintains connection reliability
- **Native Database/:** Actor-based concurrency for thread safety, leverages SQLite native features (FTS5, CTEs)

## Architectural Patterns

### Pattern 1: Query Hook with Bridge Fallback

**What:** React hook that transparently switches between native bridge and browser sql.js based on environment
**When to use:** When same React components need to work in both browser dev and native production
**Trade-offs:** Complexity of dual execution paths vs. unified development experience

**Example:**
```typescript
export function useSQLiteQuery<T>(sql: string, params: unknown[] = []) {
  const { execute } = useDatabase(); // Environment-aware database context

  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (Environment.isWebView()) {
      // Use bridge for native environment
      const rows = await webViewBridge.database.execute(sql, params);
      setData(transformRows<T>(rows));
    } else {
      // Use sql.js for browser environment
      const rows = execute(sql, params);
      setData(rows as T[]);
    }
  }, [sql, params, execute]);

  return { data, loading, refetch: fetchData };
}
```

### Pattern 2: Live Data Subscription with Change Notifications

**What:** Real-time updates pushed from native database to React via custom events
**When to use:** When React components need to react to data changes from other sources (sync, background operations)
**Trade-offs:** Event-driven complexity vs. stale data from manual polling

**Example:**
```typescript
export function useLiveData<T>(query: string, params?: unknown[]) {
  const [subscription, setSubscription] = useState<LiveDataSubscription<T>>();

  useEffect(() => {
    const handleDataChange = (event: CustomEvent) => {
      const { table, operation } = event.detail;

      // Invalidate cache and refresh query if relevant table changed
      if (queryAffectedByTable(query, table)) {
        executeQueryThrottled(true); // Force refresh
      }
    };

    // Listen for native change notifications
    window.addEventListener('isometry-data-change', handleDataChange);

    return () => window.removeEventListener('isometry-data-change', handleDataChange);
  }, [query]);

  return subscription;
}
```

### Pattern 3: Bridge Circuit Breaker with Message Queue

**What:** Reliability pattern that queues requests when bridge is down and prevents cascade failures
**When to use:** When bridge communication is critical but network/native issues can cause downtime
**Trade-offs:** Added complexity vs. graceful degradation and better user experience

**Example:**
```typescript
class WebViewBridge {
  private messageQueue: WebViewMessage[] = [];
  private circuitBreakerOpen = false;
  private failureCount = 0;

  async postMessage<T>(handler: string, method: string, params: Record<string, unknown>): Promise<T> {
    // Check circuit breaker
    if (this.circuitBreakerOpen) {
      if (Date.now() - this.lastConnectionTest > this.CIRCUIT_BREAKER_RESET_TIME) {
        this.circuitBreakerOpen = false;
        this.failureCount = 0;
      } else {
        throw new Error('Bridge circuit breaker open - service temporarily unavailable');
      }
    }

    // Queue message if not connected
    if (!this.isConnected) {
      this.queueMessage(message);
      return;
    }

    return this.sendMessageImmediate(message);
  }
}
```

## Data Flow

### Request Flow

```
[React Component]
    ↓ useSQLiteQuery(sql, params)
[Hook] → [Environment Detection] → [Bridge or sql.js]
    ↓          ↓                        ↓
[Loading State] → [WKMessageHandler] → [IsometryDatabase Actor]
    ↓              ↓                        ↓
[Result] ← [Transform] ← [Response Correlation] ← [SQLite + FTS5]
```

### Live Update Flow

```
[Database Mutation] → [IsometryDatabase] → [LiveUpdateNotifier]
        ↓                    ↓                    ↓
[CloudKit Sync] → [Change Detection] → [Bridge Notification]
        ↓                    ↓                    ↓
[Background Updates] → [Cache Invalidation] → [React Re-render]
```

### Key Data Flows

1. **Query Execution:** React hook → Environment detection → Bridge message → Native database → Response correlation → Result transformation
2. **Live Updates:** Database change → Change detection → Bridge notification → Event listener → Cache invalidation → Component refresh
3. **Sync Integration:** CloudKit change → Database update → Live update notification → React state update

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 nodes | Simple bridge, direct SQL queries, minimal caching |
| 100-10k nodes | Query optimization, result caching, connection pooling |
| 10k+ nodes | Query batching, lazy loading, pagination, background processing |

### Scaling Priorities

1. **First bottleneck:** Bridge message volume - implement query batching and result caching at bridge level
2. **Second bottleneck:** UI responsiveness - add virtual scrolling and progressive data loading
3. **Third bottleneck:** Memory usage - implement LRU cache for query results and lazy node loading

## Anti-Patterns

### Anti-Pattern 1: Direct Bridge Access from Components

**What people do:** Call webViewBridge.database.execute() directly from React components
**Why it's wrong:** Breaks abstraction, makes testing harder, couples components to bridge implementation
**Do this instead:** Always use hooks like useSQLiteQuery that handle environment detection and fallbacks

### Anti-Pattern 2: Synchronous Bridge Expectations

**What people do:** Assume bridge messages are instantaneous like sql.js calls
**Why it's wrong:** Bridge is async with potential failures, timeouts, and queuing
**Do this instead:** Design UI with loading states, error boundaries, and graceful degradation

### Anti-Pattern 3: Ignoring Change Notifications

**What people do:** Manually refresh queries on a timer or user action only
**Why it's wrong:** Results in stale data when background sync or other sources modify database
**Do this instead:** Subscribe to data change events and invalidate relevant queries automatically

### Anti-Pattern 4: Oversized Query Results

**What people do:** Fetch large result sets through bridge without pagination
**Why it's wrong:** Bridge has message size limits, causes memory issues, poor performance
**Do this instead:** Implement server-side pagination with limit/offset, stream large results

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| CloudKit | Background Actor Sync | Handles conflicts, retry logic, maps to local schema |
| sql.js | Direct execution | Browser fallback, same SQL interface as native |
| Apple Notes | Import Actor | Background processing, maps alto-index format to nodes |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| React ↔ Bridge | Async message passing | Request/response correlation, timeout handling |
| Bridge ↔ Database | Swift Actor calls | Thread-safe, leverages async/await concurrency |
| Database ↔ CloudKit | Change observation | GRDB observers trigger sync operations |
| Components ↔ Hooks | State management | Context providers for database access, live data |

### Bridge Message Protocols

**Database Operations:**
```typescript
// Query execution
{
  handler: 'database',
  method: 'execute',
  params: { sql: string, params: unknown[] }
} → { success: boolean, data: Row[], error?: string }

// Live data subscription
{
  handler: 'database',
  method: 'subscribe',
  params: { query: string, params: unknown[], throttleMs: number }
} → { subscriptionId: string }
```

**Update Notifications:**
```typescript
// Pushed from native to React
window.dispatchEvent(new CustomEvent('isometry-data-change', {
  detail: {
    table: 'nodes',
    operation: 'update',
    affectedIds: ['node1', 'node2'],
    subscriptionIds: ['sub1', 'sub2']
  }
}));
```

### Performance Considerations

**Message Batching:** Group multiple queries into single bridge message to reduce overhead
**Result Caching:** Cache query results with TTL and table-based invalidation
**Connection Management:** Circuit breaker pattern prevents cascade failures
**Background Processing:** Use native actors for heavy operations (sync, graph analysis)

## Sources

- [Shopify Mobile Bridge Architecture (2025)](https://shopify.engineering/mobilebridge-native-webviews)
- [Apple WKScriptMessageHandler Documentation](https://developer.apple.com/documentation/webkit/wkscriptmessagehandler)
- [gronxb/webview-bridge - Type-Safe WebView Communication](https://github.com/gronxb/webview-bridge)
- [Firebase Real-Time Database iOS Integration Patterns](https://firebase.google.com/docs/database/ios/read-and-write)
- Existing Isometry codebase: WebView bridge implementation + Swift database actor patterns

---
*Architecture research for: Live Database Integration via WebView Bridge*
*Researched: 2026-01-30*