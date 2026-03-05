# Phase 17: SuperGrid Dynamic Axis Reads - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace hardcoded `DEFAULT_COL_FIELD`/`DEFAULT_ROW_FIELD` constants and in-memory card filtering with live PAFVProvider reads and Worker queries. SuperGrid dynamically renders from PAFVProvider state and fetches grouped cell data via `bridge.superGridQuery()`. Multiple rapid axis changes within one 16ms StateCoordinator batch produce exactly one Worker query call.

Requirements: FOUN-08, FOUN-09, FOUN-10, FOUN-11

</domain>

<decisions>
## Implementation Decisions

### Loading transition
- Keep stale data during the async gap between axis change and Worker response — no spinner, no dim, no skeleton overlay
- No fallback indicator if Worker takes longer than expected — trust the Worker to be fast
- Only the final result renders when multiple rapid axis changes occur — leverage existing rAF coalescing in WorkerBridge.superGridQuery()
- No animation on axis change in this phase — Phase 18 (SuperDynamic) owns the 300ms D3 transition for drag-based axis transpose

### Cell rendering
- Count badge only — same as current SuperGrid behavior. Phase 22 (SuperDensity) handles spreadsheet vs matrix display modes
- IView.render(cards) signature preserved for interface compliance, but SuperGrid internally calls bridge.superGridQuery() and ignores the cards parameter
- D3 data join key function matches Worker output dynamically — if colAxes = [card_type, priority], key includes all axis fields plus row keys. Forward-compatible with multi-level stacked axes
- If axes have empty arrays, fall back to VIEW_DEFAULTS for supergrid (card_type/folder) as safety net

### Error & empty states
- Zero results: show empty grid skeleton — headers from PAFVProvider axes are visible, but no data cells. User retains axis context
- Worker errors (e.g., SQL safety violation): show error message inline in the grid area. Do not silently swallow errors
- Errors are auto-recoverable — any subsequent axis change triggers a new Worker query. If new axes are valid, the error clears itself. No manual retry button needed

### Initial mount & subscription
- SuperGrid fires bridge.superGridQuery() immediately on mount() — reads PAFVProvider state and queries Worker without waiting for ViewManager render(cards) call. Fastest perceived load
- Constructor injection: `new SuperGrid(provider, bridge)` — explicit dependencies, testable. Constructor signature changes from zero-arg (SuperGrid is special among IView implementations)
- SuperGrid stores its StateCoordinator unsubscribe function and calls it in destroy() — owns its own subscription lifecycle
- Subscribe through StateCoordinator (not directly to PAFVProvider) — gets 16ms batch deduplication for free (FOUN-11)

### Claude's Discretion
- Card ID storage strategy — whether to store Worker-returned card_ids[] on DOM data attributes or in an internal Map<cellKey, string[]>
- Internal render method naming and flow (private method structure)
- Error message formatting and styling
- How to handle the render(cards) no-op gracefully (early return vs. trigger internal flow)

</decisions>

<specifics>
## Specific Ideas

- Phase 18 (SuperDynamic) will add drag-based axis transpose with 300ms D3 transition — Phase 17 should not add animation that Phase 18 would override
- Phase 22 (SuperDensity) will add spreadsheet vs matrix display modes — Phase 17 keeps count-only cells as the baseline
- Phase 21 (SuperSelect) will need card_ids per cell for selection — card ID storage decision should consider this future need

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PAFVProvider.getStackedGroupBySQL()`: Returns validated `{ colAxes, rowAxes }` — direct input for SuperGridQuery config
- `PAFVProvider.getState()`: Returns full state including viewType, colAxes, rowAxes with defensive copies
- `WorkerBridge.superGridQuery(config)`: Already has rAF coalescing built in — multiple calls within one frame coalesce to a single Worker message
- `StateCoordinator.subscribe()`: Returns unsub function, fires ~16ms after any registered provider changes
- `SuperGridQuery.buildSuperGridQuery()`: Compiles axes to parameterized GROUP BY SQL with allowlist validation
- `supergrid.handler.ts`: Worker-side handler fully operational (Phase 16) — handles `supergrid:query` and returns CellDatum[]
- `SuperStackHeader.buildHeaderCells()`: Builds nested header cells from axis value tuples — already supports multi-level

### Established Patterns
- Provider subscription: `provider.subscribe()` -> queueMicrotask -> StateCoordinator -> setTimeout(16) -> view callback
- Worker protocol: Typed via `protocol.ts` — `WorkerPayloads['supergrid:query']` and `WorkerResponses['supergrid:query']`
- D3 data join with key function mandatory on every `.data()` call (VIEW-09 / D-009)
- IView interface: `mount(container)`, `render(cards)`, `destroy()` — all views implement this

### Integration Points
- `ViewManager` creates SuperGrid and calls mount/render/destroy — constructor injection means ViewManager needs PAFVProvider + WorkerBridge references to pass
- `StateCoordinator` — SuperGrid subscribes here for batched change notifications
- `VIEW_DEFAULTS.supergrid` in PAFVProvider — default colAxes: [{card_type, asc}], rowAxes: [{folder, asc}]
- `main.ts` — wires ViewManager, PAFVProvider, StateCoordinator, and WorkerBridge together

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 17-supergrid-dynamic-axis-reads*
*Context gathered: 2026-03-04*
