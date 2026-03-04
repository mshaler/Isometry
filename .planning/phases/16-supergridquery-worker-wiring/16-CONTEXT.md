# Phase 16: SuperGridQuery Worker Wiring - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire the existing SuperGridQuery dead code (`buildSuperGridQuery()`) to the Worker via new typed message types (`supergrid:query`, `db:distinct-values`). SuperGrid will be able to query grouped cell data off-thread instead of filtering cards in-memory. This phase delivers the Worker protocol and bridge method only — SuperGrid rendering integration is Phase 17.

</domain>

<decisions>
## Implementation Decisions

### Response contract
- card_ids returned as **parsed string[]** — Worker splits GROUP_CONCAT result before responding, not raw comma string
- Response shape is **cells only**: `{ cells: [...] }` — main thread derives header values (unique rowKeys, colKeys) from the cells array
- Cell properties use **individual SQL column names** as properties (e.g., `{ card_type: 'note', folder: 'Inbox', count: 5, card_ids: ['id1', 'id2'] }`) — not composite rowKey/colKey strings
- Request payload uses **full SuperGridQueryConfig interface**: `{ colAxes: AxisMapping[], rowAxes: AxisMapping[], where: string, params: unknown[] }` — maintains parity with existing buildSuperGridQuery() signature

### Frame deduplication
- Single-query-per-frame guarantee lives **inside WorkerBridge.superGridQuery()** — callers don't need to think about dedup
- When a newer request arrives while one is in-flight, **stale response is silently discarded** (latest-wins via correlation ID comparison) — no cancellation, no error
- Coalescing uses **requestAnimationFrame** to batch within the visual frame boundary (aligned with 16ms budget)
- API is **Promise-based** — `superGridQuery()` returns `Promise<CellDatum[]>`, consistent with all other WorkerBridge methods

### Distinct values (db:distinct-values)
- **Single column per request**: payload is `{ column: string, where?: string, params?: unknown[] }`, response is `{ values: string[] }`
- **Respects current WHERE filters** — returns values scoped to the current view, not the full table
- Column validated against **axis allowlist** (validateAxisField) — same 9-field set as supergrid:query
- Values returned **sorted alphabetically ASC** (ORDER BY column ASC)

### Error handling
- Axis validation errors use existing **INVALID_REQUEST** WorkerErrorCode — no new error codes
- Handler **relies on buildSuperGridQuery()'s internal validateAxisField()** call — no duplicate pre-validation (DRY)
- Main thread **console.warn + reject** on INVALID_REQUEST — visible during development, propagated for caller handling
- **Empty axis arrays** (no colAxes AND no rowAxes) are NOT an error — return single cell with total count and all card_ids (graceful fallback)

### Claude's Discretion
- Exact handler file naming and internal structure (e.g., `supergrid.handler.ts` vs inline in router)
- Whether rAF coalescing uses a dedicated `_pendingSuperGridConfig` field or a more generic pattern
- Whether to add a 'VALIDATION_ERROR' classification path in classifyError() for future use
- Test fixture design and mocking strategy for Worker handler tests

</decisions>

<specifics>
## Specific Ideas

- The existing `buildSuperGridQuery()` in `src/views/supergrid/SuperGridQuery.ts` is the exact function to call from the Worker handler — no reimplementation needed
- The Worker router (`worker.ts`) uses an exhaustive switch with `never` check — new message types must be added to `WorkerRequestType` union and all type maps
- StateCoordinator's 16ms setTimeout batching + WorkerBridge's rAF coalescing form a two-layer dedup: providers settle → coordinator fires → bridge coalesces → one Worker request

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperGridQuery.ts` — `buildSuperGridQuery()` function ready to execute in Worker handler (imports `validateAxisField` from `providers/allowlist`)
- `protocol.ts` — `WorkerRequestType` union, `WorkerPayloads`/`WorkerResponses` type maps, all type guards and helpers
- `WorkerBridge.ts` — `send<T>()` typed method for building new convenience methods; existing `pending` Map for correlation tracking
- `worker.ts` — `routeRequest()` exhaustive switch and `createWorkerError()` for error classification
- `StateCoordinator.ts` — 16ms `setTimeout` batching pattern (dedup layer 1)
- `providers/allowlist.ts` — `validateAxisField()` for SQL safety validation

### Established Patterns
- **Handler files**: Domain handlers in `src/worker/handlers/*.handler.ts` (e.g., `simulate.handler.ts`, `etl-import.handler.ts`)
- **Protocol extension**: Add type to `WorkerRequestType` union → add payload to `WorkerPayloads` → add response to `WorkerResponses` → add case to `routeRequest` switch
- **Convenience methods**: Each domain gets a typed method on WorkerBridge (e.g., `searchCards()`, `importFile()`) that wraps `this.send()`
- **Error handling**: Handler throws → `createWorkerError()` classifies → `postErrorResponse()` sends INVALID_REQUEST/NOT_FOUND/etc.

### Integration Points
- `WorkerRequestType` union in `protocol.ts` — must add `'supergrid:query'` and `'db:distinct-values'`
- `routeRequest()` switch in `worker.ts` — must add cases (exhaustive check will catch missing ones)
- `WorkerBridge` class — must add `superGridQuery()` method with rAF coalescing + stale response discard
- `AxisMapping` type from `providers/types.ts` — used in payload interface

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 16-supergridquery-worker-wiring*
*Context gathered: 2026-03-03*
