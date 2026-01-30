# Phase 19: Real-Time Change Notifications - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver live query results that automatically update React components when database changes occur. Using the optimized bridge infrastructure from Phase 18, this phase connects database change notifications to UI updates with sub-100ms latency. Transaction safety and advanced caching are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Change Detection Strategy
- Query-specific monitoring using GRDB ValueObservation to track changes affecting current query results
- Automatic detection of all INSERT/UPDATE/DELETE operations on tables used in active queries
- Smart hybrid approach: incremental updates for simple single-table changes, full query re-execution for complex joins/aggregations
- Component-level tracking to minimize notifications and maintain 60fps performance targets

### UI Update Behavior
- Instant updates by default with intelligent batching as performance safety net for high-frequency changes
- Hybrid optimistic/pessimistic updates: optimistic for safe operations (text edits), pessimistic for critical ones (deletes, relationships)
- Intelligent merging philosophy: merge-first, conflict-only-when-necessary for collaborative real-time experience
- Subtle loading indicators on affected components only during update processing

### Connection Management
- Hidden connection status unless problems occur - clean UI that surfaces info only when needed
- Graceful degradation during connection loss: viewing and basic edits work offline, complex queries/real-time features disabled
- Background sync with status display when connection restores - automatic with transparency but no user management required
- Adaptive behavior that automatically reduces update frequency and batch size based on connection quality

### Update Ordering & Conflicts
- Dependency-aware ordering that analyzes change dependencies and applies in logical order regardless of timing
- Context-aware conflict resolution showing conflicts in context of full card/relationship, with fallback to diff-style interface
- Full conflict log maintained for debugging sync issues and understanding collaboration patterns
- Auto-defer complex conflicts: simple conflicts require immediate resolution, complex ones can be deferred with persistent reminders

### Claude's Discretion
- Exact batching algorithms and thresholds
- Specific dependency analysis implementation
- Loading indicator styling and animation
- Connection quality detection mechanisms

</decisions>

<specifics>
## Specific Ideas

- Merge-first philosophy should be highlighted throughout frontend development as core collaborative principle
- Leverage Phase 18's query pagination and performance monitoring infrastructure
- Build on GRDB ValueObservation as proven real-time notification technology

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-real-time-change-notifications*
*Context gathered: 2026-01-30*