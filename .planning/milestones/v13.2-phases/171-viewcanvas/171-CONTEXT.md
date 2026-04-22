# Phase 171: ViewCanvas - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace ViewCanvasStub with a real ViewCanvas that mounts all 9 D3 views inside the SuperWidget canvas slot, wired to Projection state for view switching, status slot updates, Explorer sidecar visibility, and clean teardown. This phase does NOT add new views, new explorers, or new status metrics — it wires existing ViewManager and registry infrastructure into the SuperWidget canvas lifecycle.

</domain>

<decisions>
## Implementation Decisions

### Status Slot Content (VCNV-03)
- **D-01:** Each canvas type owns its status slot content entirely. ViewCanvas renders its own content (view name + card count); ExplorerCanvas keeps its existing cards/connections/last-import layout. No shared status bar between canvas types.
- **D-02:** View name uses human-readable labels (e.g. "SuperGrid", "Calendar", "Network Graph"), not ViewType literals. A display-name lookup table or constant map provides the mapping.
- **D-03:** Card count updates after each ViewManager render callback — not on a timer, not on provider change directly.

### Sidecar Lifecycle (VCNV-04)
- **D-04:** ViewCanvas signals sidecar show/hide via a callback injected through the constructor or registry (e.g. `onSidecarChange(explorerId: string | null)`). SuperWidget or the parent wiring layer handles routing to ExplorerCanvas.
- **D-05:** The callback value comes from the registry's `defaultExplorerId` field for the current view. Views without a `defaultExplorerId` pass `null` to hide the sidecar.
- **D-06:** Sidecar visibility is driven by registry `defaultExplorerId`, not hardcoded ViewType checks (per success criterion 4).

### Tab-to-ViewType Mapping (VCNV-02)
- **D-07:** Convention: tab IDs for View canvas ARE ViewType string literals (`'list'`, `'grid'`, `'supergrid'`, etc.). ViewCanvas casts `activeTabId` directly to `ViewType`. No lookup table needed.
- **D-08:** Registry entries for view tabs use ViewType as their tab ID. Invalid/unknown tab IDs are a validation error, not a silent fallback.

### Prior Decisions (carry forward)
- **D-09:** SuperWidget.ts has zero import references to any canvas — registry plug-in seam only (CANV-06).
- **D-10:** ViewManager's container is an inner wrapper div, never `_canvasEl` directly — `container.innerHTML = ''` must not corrupt the canvas slot (STATE.md constraint).
- **D-11:** destroy-before-mount ordering holds under rapid switching (3+ transitions < 500ms).

### Claude's Discretion
- Exact shape of the display-name map (inline constant vs. exported from types.ts)
- Whether ViewCanvas constructor takes a full options bag or positional params
- Internal structure of the render callback wiring (direct subscription vs. ViewManager event)
- Test file organization (single test file vs. split by requirement)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Architecture
- `src/superwidget/projection.ts` — Projection type, CanvasComponent interface, transition functions (switchTab, setCanvas, setBinding)
- `src/superwidget/SuperWidget.ts` — SuperWidget DOM skeleton, CanvasFactory type, slot layout
- `src/superwidget/registry.ts` — CanvasRegistryEntry (canvasType, create, defaultExplorerId), register/getRegistryEntry/getCanvasFactory
- `src/superwidget/ViewCanvasStub.ts` — Current stub to be replaced
- `src/superwidget/statusSlot.ts` — ExplorerCanvas status bar (renderStatusSlot, updateStatusSlot) — reference for status slot pattern

### ViewManager
- `src/views/ViewManager.ts` — switchTo(), destroy(), loading/empty states, coordinator subscription, render callback. Lines 223+ for switchTo signature.
- `src/views/types.ts` — IView interface, ViewType union, CardDatum

### Provider Layer
- `src/providers/StateCoordinator.ts` — batched cross-provider change notifications
- `src/providers/types.ts` — ViewType literal union definition

### Test Patterns
- `tests/superwidget/ViewCanvasStub.test.ts` — Existing stub tests (replace with real ViewCanvas tests)
- `tests/superwidget/canvasWiring.test.ts` — Canvas mount/destroy lifecycle tests
- `tests/superwidget/registry.test.ts` — Registry pattern tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **ViewManager** (`src/views/ViewManager.ts`): Full view lifecycle with switchTo(), destroy(), loading/empty states, coordinator subscription. ViewCanvas wraps this — no need to reimplement view switching logic.
- **statusSlot.ts**: Pattern for status slot rendering (DOM setup + update function). ViewCanvas can follow the same idempotent render + update pattern.
- **Registry** (`src/superwidget/registry.ts`): Already has `defaultExplorerId` field on entries. ViewCanvas reads this to drive sidecar callback.
- **CanvasComponent interface**: `mount(container)`, `destroy()`, `onProjectionChange?(proj)` — ViewCanvas implements this.

### Established Patterns
- Canvas plug-in via registry — SuperWidget never imports concrete canvas classes
- Projection state machine drives all canvas transitions (switchTab, setCanvas)
- Provider subscribe/unsubscribe pattern with leak prevention on destroy
- Wrapper-div isolation for D3 views (container.innerHTML = '' safe inside inner div)

### Integration Points
- `registry.ts` `registerAllStubs()` — must be updated to register real ViewCanvas instead of ViewCanvasStub
- `SuperWidget.commitProjection()` — calls `onProjectionChange()` on mounted canvas
- `main.ts` — wiring layer where providers are created and passed to ViewManager; ViewCanvas needs access to same providers
- `src/superwidget/ExplorerCanvas.ts` — sibling canvas, reference for mount/destroy/status patterns

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following established patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 171-viewcanvas*
*Context gathered: 2026-04-21*
