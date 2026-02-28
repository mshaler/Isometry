# Phase 4: Providers + MutationManager - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

UI state compiles to safe parameterized SQL through an allowlisted Provider system. Every mutation is undoable. All Tier 1/2 state persists across launch. This phase delivers the Provider compilation layer, MutationManager with undo/redo, and Tier 2 state persistence — but NOT any views (Phase 5+).

</domain>

<decisions>
## Implementation Decisions

### Provider Coordination
- QueryBuilder is the SOLE query assembly point — views never touch SQL directly
- Reactive chain: provider change → subscriber fires → QueryBuilder recompiles → WorkerBridge query → view updates (auto re-execute, no manual triggers)
- QueryBuilder ONLY composes from provider compile() outputs — no raw SQL passthrough, no escape hatch. The safety model (SAFE-01..06) is airtight
- Providers are independently testable without WorkerBridge — pure unit tests for compilation, separate integration tests for full chain

### Undo/Redo Scope
- One atomic undo step per user action — multi-field changes (e.g., Kanban drag-drop changing category + sort_order) group into a single Mutation with multiple forward/inverse SQL commands
- Undo history is session-only — lives in memory, cleared on page refresh. Data persists but undo history doesn't
- New mutation after undo clears the redo stack — standard behavior, same as every text editor and design tool
- History depth: Claude's discretion (bounded or unbounded)

### State Restoration
- Stale filter values (e.g., referencing renamed folder) are applied silently — user sees empty results with their filter active and can remove it manually. No auto-cleanup, no surprises
- Corrupt/unparseable JSON for a provider key resets THAT provider to defaults — other providers unaffected. Log a warning, isolate failures
- Explicit `restore()` call — app startup controls timing, not auto-restore on init. Enables proper sequencing with view lifecycle
- Skip animation on restore — views snap to restored state instantly. App should feel like it was already there, not "catching up"

### Subscriber Notification Timing
- Provider changes batched via queueMicrotask — changes within the same synchronous frame produce ONE notification to views, preventing redundant queries and partial-state renders
- Mutation subscriber notifications batched via requestAnimationFrame (per MUT-06) — visual updates aligned to frame boundaries
- Different batching mechanisms by design: providers trigger async queries (microtask is fine), mutations trigger visual refreshes (rAF aligns to frames)
- Manual unsubscribe — subscribe() returns an unsubscribe function, views must call it in destroy(). Explicit, testable, predictable (PROV-11)
- Separate StateCoordinator class (PROV-09) — owns cross-provider batching logic. Providers register with it. Single responsibility: providers don't know about each other

### Claude's Discretion
- Undo history depth (bounded vs unbounded)
- Debounce timing for Tier 2 persistence (spec suggests 500ms)
- Exact StateCoordinator batching implementation
- Error message formatting for SQL safety rejections
- Internal data structures for command log

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. The PHASE-4-PROVIDERS.md spec already defines detailed contracts for every provider and MutationManager.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkerBridge` (src/worker/WorkerBridge.ts): Typed async RPC client — MutationManager and StateManager use `bridge.send()` for all SQL execution
- `protocol.ts` (src/worker/protocol.ts): Typed message protocol — Phase 4 extends with `ui:get/set/delete/getAll` request types
- `types.ts` (src/database/queries/types.ts): Card, Connection, CardInput types — MutationManager inverse generators reference these

### Established Patterns
- **Typed protocol pattern**: WorkerRequestType union + WorkerPayloads/WorkerResponses maps — Phase 4 extends this for ui_state operations
- **Handler pattern**: Each domain has a `.handler.ts` in src/worker/handlers/ — Phase 4 adds `ui-state.handler.ts`
- **Singleton pattern**: `getWorkerBridge()` provides shared instance — providers can import and use directly
- **UUID correlation IDs**: All Worker communication uses crypto.randomUUID() for request tracking

### Integration Points
- `src/worker/protocol.ts` — Add ui_state request/response types to WorkerRequestType, WorkerPayloads, WorkerResponses
- `src/worker/handlers/index.ts` — Register new ui-state handler
- `src/worker/worker.ts` — Router dispatches to ui-state handler
- `src/index.ts` — Re-export providers and mutations

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-providers-mutationmanager*
*Context gathered: 2026-02-28*
