# Phase 21: Advanced Query and Caching - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize performance for large datasets with intelligent caching and virtual scrolling. This phase makes React components responsive regardless of dataset size through smart caching infrastructure and adaptive sync behavior. Advanced search algorithms or new visualization features belong in other phases.

</domain>

<decisions>
## Implementation Decisions

### Cache Strategy
- Hybrid approach: Show cached data instantly with visual updating indicators
- Display cached data immediately (meets <50ms performance target)
- Fetch fresh data in parallel using Phase 19 real-time infrastructure
- Clear visual states: Cached ✓ → Updating ↻ → Fresh ✓
- Smooth transitions when fresh data arrives (no jarring jumps)

### Claude's Discretion
- Virtual scrolling implementation details (TanStack Virtual configuration)
- Background sync frequency and bandwidth adaptation algorithms
- Memory management patterns and cleanup strategies
- Cache TTL values and invalidation triggers
- Performance monitoring thresholds and alerting
- Loading skeleton designs for cache miss scenarios

</decisions>

<specifics>
## Specific Ideas

- "Honest UX" - users should know when they're seeing cached vs live data
- Leverage existing real-time change notifications from Phase 19 for background refresh
- Cache can be aggressive (longer TTL) since always checking for updates in parallel

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 21-advanced-query-and-caching*
*Context gathered: 2026-01-31*