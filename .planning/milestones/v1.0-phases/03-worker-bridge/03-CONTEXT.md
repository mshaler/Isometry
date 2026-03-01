# Phase 3: Worker Bridge - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

All database operations execute in a Web Worker via a typed async protocol. The main thread is never blocked by SQL. Initialization race conditions and silent hangs are prevented.

**Note:** This phase's code is already substantially implemented. Phase 4 (Providers) and Phase 5 (Views) already depend on the Worker Bridge and are shipped. Planning should focus on verification and closing any remaining gaps against BRIDGE-01..07 requirements.

</domain>

<decisions>
## Implementation Decisions

### Verification scope
- Run all existing worker tests (111 pass, 26 skipped as of 2026-02-28)
- Map each BRIDGE requirement to specific code and test coverage
- Identify any gaps between the spec (WorkerBridge.md) and implementation
- Mark BRIDGE-01..07 as complete in REQUIREMENTS.md once verified
- Address any skipped integration tests that should pass

### Existing implementation (locked — already shipped)
- Protocol types in `src/worker/protocol.ts` — typed envelopes, payload/response maps, error codes
- WorkerBridge client in `src/worker/WorkerBridge.ts` — isReady promise, UUID correlation, 30s timeout, singleton
- Worker entry in `src/worker/worker.ts` — self-init, FIFO message queue, exhaustive router, error classification
- Handlers: cards, connections, search, graph, export, ui-state, db:exec
- Phase 4 extensions: ui:get/set/delete/getAll and db:exec already added to protocol

### Claude's Discretion
- Whether to add Transferable object support for db:export (spec mentions it, code doesn't implement it)
- Whether skipped integration tests need to be unskipped or are acceptable as-is
- Whether any additional edge-case tests are needed for queue replay behavior
- Level of coverage verification detail in the plan

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkerBridge` class (src/worker/WorkerBridge.ts): Full client with isReady, correlation IDs, timeout, singleton
- `protocol.ts` (src/worker/protocol.ts): Complete type system — WorkerRequest, WorkerResponse, WorkerPayloads, WorkerResponses
- Worker entry (src/worker/worker.ts): Self-initializing with queue, exhaustive switch router
- Handler modules: cards, connections, search, graph, export, ui-state

### Established Patterns
- Domain:action naming convention for message types (card:create, graph:shortestPath, db:export)
- Typed payload/response maps with exhaustive switch routing
- PendingRequest map with timeout cleanup
- Error classification (CONSTRAINT_VIOLATION, NOT_FOUND, NOT_INITIALIZED, TIMEOUT)
- getWorkerBridge() singleton with createWorkerBridge() factory for testing

### Integration Points
- Phase 4 Providers already use WorkerBridge.send() for ui:* and db:exec operations
- Phase 5 Views depend on bridge indirectly through providers
- Database class (src/database/Database.ts) is the underlying sql.js wrapper
- Query modules (src/database/queries/*) are reused without modification by the worker router

</code_context>

<specifics>
## Specific Ideas

- The spec in v5/Modules/Core/WorkerBridge.md mentions Transferable objects for ArrayBuffer but current code uses structured clone — this is acceptable for now but could be optimized later
- 26 skipped tests appear to be real-Worker integration tests — verify whether they're skipped due to environment constraints (no real Worker in Vitest) or actual gaps
- FTS+SQL combine bug (P21 from pitfalls) should be verified: id vs rowid type mismatch in search handler

</specifics>

<deferred>
## Deferred Ideas

- Per-operation-type timeout tuning (different timeouts for graph algos vs card:get) — optimize later if needed
- Queue size limits and backpressure — not needed at current scale
- Worker health checks / heartbeat monitoring — future operational concern
- Transferable object support for large payloads — performance optimization for later

</deferred>

---

*Phase: 03-worker-bridge*
*Context gathered: 2026-02-28*
