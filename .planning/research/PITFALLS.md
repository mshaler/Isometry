# Domain Pitfalls: React-to-Native SQLite Bridge Integration

**Domain:** React WebView to native SQLite (GRDB) bridge integration
**Researched:** 2026-01-30
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Bridge Message Serialization Bottleneck

**What goes wrong:**
JSON serialization becomes a performance bottleneck when transferring large query results between React and native layers. Teams unknowingly serialize entire result sets through postMessage, causing UI freezes and memory spikes. With 1000+ records, serialization can take 100-500ms, blocking the main thread.

**Why it happens:**
Developers treat WebView bridge like a simple function call, not realizing the JSON serialization overhead. Large objects with nested properties (common in graph databases) create exponentially expensive serialization cycles. The bridge appears to work fine with small datasets during development.

**How to avoid:**
- Implement pagination at the bridge level, never transfer more than 50 records per message
- Use streaming JSON parsers for large result sets
- Compress repeated data structures before serialization
- Implement result caching with incremental updates instead of full refreshes
- Monitor serialization time and set hard limits (>50ms should trigger warnings)

**Warning signs:**
- Bridge calls taking >100ms in performance profiling
- Memory usage spikes during data loading
- UI becoming unresponsive during query execution
- Users reporting "app freezing" when viewing large datasets

**Phase to address:**
Live Database Integration Phase - Implement bridge optimization layer before connecting to real data

---

### Pitfall 2: Real-time Update Race Conditions

**What goes wrong:**
Multiple concurrent database updates from different React components create race conditions in the bridge layer. Updates arrive out of order, causing stale data to overwrite fresh data. State synchronization between native SQLite and React hooks becomes inconsistent, leading to phantom data updates and user confusion.

**Why it happens:**
React's concurrent features and WebView bridge's asynchronous nature don't provide ordering guarantees. Teams assume database updates are atomic at the UI level, but bridge latency introduces timing gaps. Query invalidation happens before updates complete, triggering stale data fetches.

**How to avoid:**
- Implement operation sequencing with correlation IDs for all bridge messages
- Use optimistic updates with rollback capabilities for immediate UI feedback
- Batch multiple updates into single bridge transactions
- Implement proper query invalidation timing (wait for update confirmation)
- Add version timestamps to all data to detect stale updates

**Warning signs:**
- Data appearing to "flicker" between old and new values
- Users reporting their changes "disappeared"
- Database queries returning inconsistent results across components
- React DevTools showing components re-rendering with old data

**Phase to address:**
Real-time Synchronization Phase - Implement transaction coordination and conflict resolution

---

### Pitfall 3: Query Translation Complexity Explosion

**What goes wrong:**
Translating complex React query patterns (filters, sorts, pagination) into native GRDB queries becomes unmaintainable. Teams build increasingly complex translation layers that don't properly handle edge cases, leading to SQL injection vulnerabilities or query generation failures. The abstraction leaks when advanced features are needed.

**Why it happens:**
Developers try to create a universal query translation layer that handles all possible React query patterns. They underestimate the complexity of maintaining SQL generation logic and proper parameterization. Type safety is lost at the translation boundary.

**How to avoid:**
- Use predefined query templates with parameter substitution instead of dynamic SQL generation
- Implement a finite set of supported query patterns rather than universal translation
- Validate all query parameters at the bridge boundary with strict type checking
- Use GRDB's prepared statement caching for common query patterns
- Create a query builder DSL that maps directly to safe GRDB operations

**Warning signs:**
- Bridge layer having hundreds of lines of SQL generation code
- Query failures that only happen with certain data combinations
- Developers avoiding complex queries because the bridge doesn't support them
- Security scanner flagging potential SQL injection vulnerabilities

**Phase to address:**
Query Optimization Phase - Design constrained but safe query translation layer

---

### Pitfall 4: Memory Management Across Bridge Boundaries

**What goes wrong:**
Swift objects referenced from React contexts don't get properly released, causing memory leaks that grow over app usage. Database connections accumulate without proper cleanup. React components hold references to Swift objects that survive longer than the native objects themselves, causing crashes on access.

**Why it happens:**
React's garbage collection and Swift's ARC operate independently across the bridge. Developers create two-way references without understanding the lifecycle implications. Bridge invalidation doesn't properly clean up cross-references, leaving dangling pointers.

**How to avoid:**
- Use weak references for all cross-bridge object relationships
- Implement explicit cleanup protocols for Swift objects exposed to React
- Set up automatic bridge reference cleanup on app backgrounding/foregrounding
- Monitor memory usage trends during development with automatic leak detection
- Design value-based APIs instead of reference-based APIs across the bridge

**Warning signs:**
- Memory usage increasing monotonically during app usage
- Crashes with "deallocated object" messages when accessing bridge objects
- Database connection count growing without bound
- App performance degrading after extended usage periods

**Phase to address:**
Memory Management Phase - Audit all cross-bridge references and implement proper cleanup

---

### Pitfall 5: Transaction Boundary Violations

**What goes wrong:**
React components assume database operations are atomic, but bridge communications don't respect SQLite transaction boundaries. Multiple components make interdependent database updates that should be atomic, but bridge latency causes partial updates to be visible. Transaction rollbacks in native code don't properly notify React components.

**Why it happens:**
Web developers aren't familiar with database transaction concepts and assume ACID properties apply automatically. The asynchronous bridge makes it unclear when transactions begin/end. React hooks don't provide transaction boundary abstractions.

**How to avoid:**
- Expose transaction control explicitly to React layer with begin/commit/rollback bridge commands
- Implement higher-level "operation" abstractions that guarantee atomicity
- Use database-level constraints to prevent invalid partial state
- Design React hooks that respect transaction boundaries (`useTransactionalUpdate`)
- Provide transaction status feedback to UI layer

**Warning signs:**
- Users seeing partially updated data states
- Data validation errors about inconsistent relationships
- Race conditions between dependent updates
- Undo operations not working correctly

**Phase to address:**
Transaction Management Phase - Implement proper ACID guarantees across bridge

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Direct JSON serialization of query results | Simple implementation | Performance bottlenecks at scale | Only for <10 record result sets |
| Global bridge instance shared across components | Easy component access | Memory leaks and state conflicts | Never - use proper DI patterns |
| Skipping bridge message validation | Faster development iteration | Runtime crashes from type mismatches | Never - validation prevents crashes |
| Optimistic updates without rollback | Immediate UI feedback | Data corruption on failure | Only for non-critical operations |
| Using setTimeout for bridge synchronization | Quick fix for timing issues | Unreliable timing-dependent behavior | Never - use proper event coordination |

## Integration Gotchas

Common mistakes when connecting React frontends to native database backends.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Bridge Message Validation | Trusting message data types from JavaScript | Always validate and coerce types at Swift boundary |
| Query Result Caching | Caching at React level only | Implement caching at bridge level for better performance |
| Error Propagation | Swallowing database errors in bridge layer | Always propagate errors with context to React error boundaries |
| State Synchronization | Polling for changes from React | Use push-based notifications from native to React |
| Transaction Coordination | Each component managing its own updates | Coordinate updates through bridge transaction manager |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Large result set serialization | UI freezes during data loading | Implement pagination at bridge level | >50 records per query |
| Frequent bridge polling | Battery drain and performance loss | Use event-driven updates with push notifications | >10 polls/second |
| Unbatched database operations | Poor transaction performance | Batch related operations into single transactions | >100 operations/minute |
| Cache invalidation storms | Excessive re-queries after updates | Implement granular cache invalidation by data type | >1000 cached queries |
| Synchronous bridge blocking | Main thread freezes | Use async bridge with promise-based APIs | Any synchronous database operation |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| SQL injection in query parameters | Database compromise | Always use parameterized queries with GRDB prepared statements |
| Exposing raw SQL to React layer | Information disclosure | Provide high-level operations only, hide SQL implementation |
| Unvalidated bridge input | Code injection via bridge | Validate all message types and parameters at Swift boundary |
| Database credentials in JavaScript | Credential exposure | Keep all database access confined to native layer |
| Error message information leakage | Data structure exposure | Sanitize error messages before sending to React layer |

## UX Pitfalls

Common user experience mistakes in database integration.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading states during bridge operations | App appears frozen | Show skeleton loading for all async database operations |
| Optimistic updates without error handling | User data appears to save but is lost | Implement rollback with user notification on failure |
| Inconsistent data between views | User confusion about "which data is real" | Ensure cache invalidation propagates to all affected components |
| No offline capability feedback | Users don't know if data will save | Clearly indicate online/offline status and sync state |
| Bridge timeout without feedback | Silent failures confuse users | Show clear error messages for bridge communication failures |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bridge Communication:** Often missing error boundaries — verify React error boundaries catch bridge failures
- [ ] **Query Performance:** Often missing pagination — verify large result sets don't block UI
- [ ] **Memory Management:** Often missing cleanup — verify Swift objects don't leak across bridge references
- [ ] **Transaction Safety:** Often missing rollback — verify failed operations don't leave partial state
- [ ] **Cache Invalidation:** Often missing granular updates — verify changes propagate to all affected queries
- [ ] **Bridge Security:** Often missing input validation — verify all React data is validated in Swift
- [ ] **Error Propagation:** Often missing context — verify bridge errors include sufficient debugging information

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Bridge serialization bottleneck | MEDIUM | 1. Profile all bridge messages 2. Implement pagination layer 3. Add performance monitoring |
| Real-time update race conditions | HIGH | 1. Add operation sequencing 2. Implement conflict resolution 3. Design proper state machine |
| Query translation complexity | HIGH | 1. Simplify to predefined patterns 2. Remove dynamic SQL generation 3. Add query validation layer |
| Memory leaks across bridge | MEDIUM | 1. Audit all cross-bridge references 2. Add weak reference patterns 3. Implement cleanup protocols |
| Transaction boundary violations | HIGH | 1. Design transaction-aware hooks 2. Add transaction status tracking 3. Implement rollback mechanisms |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Bridge message serialization | Bridge Optimization Phase | All bridge calls <50ms, pagination implemented |
| Real-time update race conditions | Synchronization Phase | Zero data inconsistency in testing, proper operation ordering |
| Query translation complexity | Query Layer Phase | <100 lines SQL generation code, predefined patterns only |
| Memory management violations | Memory Cleanup Phase | No memory growth over 8-hour usage, proper reference cleanup |
| Transaction boundary violations | Transaction Control Phase | All multi-step operations atomic, proper rollback handling |
| Bridge security vulnerabilities | Security Audit Phase | All inputs validated, no dynamic SQL generation |

## Sources

- [WebView Bridge Performance 2025](https://medium.com/soluto-engineering/webview-bridge-communication-is-it-really-that-smooth-81dba4bf339e) - HIGH confidence
- [React Native SQLite Memory Leaks](https://github.com/drizzle-team/drizzle-orm/issues/4068) - MEDIUM confidence
- [GRDB Memory Management](https://github.com/groue/GRDB.swift/issues/107) - HIGH confidence
- [WebView Security Pitfalls 2025](https://www.zellic.io/blog/webview-security/) - HIGH confidence
- [React Query Cache Invalidation](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation) - HIGH confidence
- [SQLite Transaction Isolation](https://sqlite.org/forum/info/b4796ea1061493d7dc5c2dea922047aac2cb6b708f274f0a32e000b3ba5ddaf5) - MEDIUM confidence

---
*Pitfalls research for: React WebView to native SQLite bridge integration*
*Researched: 2026-01-30*