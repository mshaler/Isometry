# Phase 20: Transaction and Sync Management - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Provide ACID transaction safety across the React-to-Native bridge with multi-device conflict resolution capabilities. This phase ensures data integrity when multiple operations span the bridge boundary and handles conflicts when users edit simultaneously on different devices.

</domain>

<decisions>
## Implementation Decisions

### Transaction coordination
- Hook-based API with Promise support: `useTransaction().execute(async () => { ... })`
- Flat transaction nesting: nested calls join existing transaction (no savepoints)
- Hybrid approach: explicit transactions + smart batching for common patterns
- Multi-factor batching relatedness: user interaction context + data relationships + time window

### Conflict detection granularity
- Adaptive granularity: smart detection based on content type and conflict patterns
- Combination approach: content type patterns as baseline, adjust based on actual conflict history
- Smart frequency with event-driven backup: higher monitoring for active editing, lower for stable areas
- Session-aware detection: real-time monitoring for active sessions, periodic checks for idle devices

### Multi-device resolution flow
- Smart hybrid conflict resolution: auto-resolve simple conflicts, manual review for complex ones
- Subtle notification for auto-resolved conflicts: brief toast indicating resolution occurred
- Side-by-side diff interface for manual conflicts with visual highlighting
- Show merged content while conflicts pending: auto-merged portions visible, conflicted sections highlighted

### Failure recovery patterns
- Toast notification for rollback communication: brief message explaining what was rolled back and why
- Smart preservation: save valid portions of failed transactions, discard problematic parts
- Draft state recovery: preserved work saved as draft for user review and resubmission
- Smart cleanup: drafts removed after successful resubmission, failed drafts retained longer

### Correlation and debugging
- Smart sampling: detailed logging for transaction operations and errors, lightweight for routine reads
- Operation type criteria: transaction starts/commits get full tracking, simple operations get lightweight
- Hierarchical correlation IDs: parent transaction with child operation sequences (tx_abc123.001)
- Configurable logging: runtime toggle between debug levels for production troubleshooting

</decisions>

<specifics>
## Specific Ideas

- Promise-based transaction API integrates naturally with React async patterns and event handlers
- Multi-factor batching prevents both over-batching (unrelated operations) and under-batching (split logical operations)
- Session-aware conflict detection focuses monitoring where actual editing is happening
- Side-by-side diff provides familiar pattern similar to git merge tools and code review interfaces
- Smart preservation minimizes user frustration by protecting valid work when unrelated operations fail
- Hierarchical correlation IDs enable tracing complex transaction flows: tx_abc123 → tx_abc123.001, tx_abc123.002

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 20-transaction-and-sync-management*
*Context gathered: 2026-01-30*