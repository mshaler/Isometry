# Phase 167: ExplorerCanvas Core - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace ExplorerCanvasStub with a real ExplorerCanvas that implements CanvasComponent and mounts the existing DataExplorerPanel inside SuperWidget's canvas slot. The sidebar inline DataExplorerPanel is removed — SuperWidget becomes the sole host. No new DataExplorerPanel features; no tab switching (Phase 168); no status slot (Phase 169).

</domain>

<decisions>
## Implementation Decisions

### Section Re-use Strategy
- **D-01:** Mount the entire DataExplorerPanel instance inside the canvas slot container. All 4 sections (Import/Export, Catalog, Apps, DB Utilities) appear as-is. No refactoring of private `_build*Section()` methods. Phase 168 later hides/shows sections for tab switching.

### Callback Wiring
- **D-02:** Closure capture at registration time. When registering ExplorerCanvas in the canvas registry, the `create` closure captures the 7 DataExplorerPanelConfig callbacks from the surrounding scope in main.ts (where bridge, worker, and UI context are available). The `CanvasRegistryEntry.create()` factory signature remains unchanged — no new parameters or abstractions.

### Sidebar Coexistence
- **D-03:** Replace — remove the sidebar DataExplorerPanel entirely. SuperWidget's canvas slot becomes the only place DataExplorerPanel lives. The Integrate dock section no longer toggles an inline DataExplorerPanel. This means SuperWidget must be visible/mounted for users to access import/export/catalog.

### Claude's Discretion
- ExplorerCanvas internal class structure (private fields, method names) — follow existing stub/panel conventions
- How to clean up the sidebar DataExplorerPanel wiring in main.ts (removal of `dataExplorerChildEl`, toggle logic, etc.)
- Whether `registerAllStubs()` is replaced or supplemented with a new `registerExplorerCanvas()` call

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Substrate (v13.0)
- `src/superwidget/projection.ts` — CanvasComponent interface (mount/destroy contract), Projection type, CanvasType/CanvasBinding literals
- `src/superwidget/registry.ts` — Canvas registry (register/getRegistryEntry/getCanvasFactory), current stub registrations
- `src/superwidget/SuperWidget.ts` — SuperWidget class with 4-slot grid layout, canvasFactory injection, commitProjection flow
- `src/superwidget/ExplorerCanvasStub.ts` — Current stub being replaced (implements CanvasComponent)

### DataExplorerPanel
- `src/ui/DataExplorerPanel.ts` — Full DataExplorerPanel class with 4 CollapsibleSection builders, DataExplorerPanelConfig interface (7 callbacks), mount/destroy lifecycle
- `src/ui/CollapsibleSection.ts` — CollapsibleSection used by DataExplorerPanel sections

### Integration Point
- `src/main.ts` — Current DataExplorerPanel instantiation (~line 1536), callback wiring, sidebar toggle logic, `dataExplorerChildEl` setup (~line 642), `refreshDataExplorer()` stats/recent-cards updates (~line 688)

### Contracts
- `.planning/STATE.md` §Accumulated Context — CANV-06 contract (zero import references from SuperWidget.ts), commitProjection tab switching, slot-scoped status updates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DataExplorerPanel` class: complete 4-section panel with mount/destroy lifecycle — mount as-is into canvas slot
- `CollapsibleSection`: generic collapsible UI primitive used by all DataExplorerPanel sections
- `CanvasComponent` interface: just `mount(container)` + `destroy()` — ExplorerCanvas implements this
- Canvas registry (`register()`, `getCanvasFactory()`): plug-in seam already wired

### Established Patterns
- Stub → real replacement: ExplorerCanvasStub follows same pattern as ViewCanvasStub/EditorCanvasStub — replace registration, keep interface
- Closure capture in registry: `registerAllStubs()` already creates instances inside closures — same pattern for callback capture
- mount/destroy lifecycle: all panels (DataExplorerPanel, PropertiesExplorer, etc.) follow this convention

### Integration Points
- `main.ts` registers canvas factories and creates SuperWidget — ExplorerCanvas registration happens here
- `refreshDataExplorer()` in main.ts calls `updateStats()` and `updateRecentCards()` on the DataExplorerPanel instance — must still reach the instance after it moves into SuperWidget
- Catalog SuperGrid mounting via `getCatalogBodyEl()` — must still work after DataExplorerPanel moves into canvas slot

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following existing codebase patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 167-explorercanvas-core*
*Context gathered: 2026-04-21*
