# Phase 168: Tab System - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can switch between Import/Export, Catalog, and DB Utilities tabs inside the SuperWidget canvas slot. ExplorerCanvas renders a self-contained tab bar and swaps visible content via CSS hide/show. No new DataExplorerPanel features; no status slot (Phase 169); no integration tests (Phase 170).

</domain>

<decisions>
## Implementation Decisions

### Apps Section Mapping
- **D-01:** Apps section (Notes, Reminders, Calendar importers) merges into the Import/Export tab — it's all import sources. DataExplorerPanel has 4 sections; Phase 168 maps them to 3 tabs.
- **D-02:** Apps content appears as a separate CollapsibleSection stacked below the original Import/Export CollapsibleSection within the Import/Export tab container. Not interleaved.

### Tab Switch Mechanism
- **D-03:** CSS hide/show — all 3 tab containers are pre-mounted at ExplorerCanvas.mount() time. Tab switching toggles display:none/block. Preserves scroll position and form state across switches, zero re-render cost.
- **D-04:** CanvasComponent interface gains an optional `onProjectionChange(proj: Projection)` method. SuperWidget calls it in `commitProjection` when `activeTabId` changes. ExplorerCanvas implements it to toggle the visible tab container.

### Tab Bar Ownership
- **D-05:** ExplorerCanvas renders its own tab bar inside the canvas slot container (not the SuperWidget `tabsEl` slot). Self-contained — other canvases don't see or manage it. CANV-06 preserved.
- **D-06:** Tab click flow: ExplorerCanvas receives a `commitProjection` callback at construction. Tab click calls `switchTab(proj, tabId)` then `commitProjection(newProj)`. SuperWidget sees the change and calls `onProjectionChange()` back on ExplorerCanvas, which toggles the CSS visibility.

### Claude's Discretion
- Tab bar styling and CSS class naming conventions — follow existing SuperWidget/DataExplorerPanel patterns
- Internal DOM structure of the 3 tab containers (wrapper elements, class names)
- Whether `onProjectionChange` is added as optional on CanvasComponent or as a separate interface
- Default activeTabId value when ExplorerCanvas first mounts (likely 'import-export')

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Substrate (v13.0)
- `src/superwidget/projection.ts` — Projection type, switchTab() pure function, activeTabId/enabledTabIds fields, CanvasComponent interface
- `src/superwidget/SuperWidget.ts` — commitProjection flow (line ~162: activeTabId change detection), tabsEl slot, canvasEl slot
- `src/superwidget/registry.ts` — Canvas registry, current stub registrations

### ExplorerCanvas (Phase 167)
- `src/superwidget/ExplorerCanvas.ts` — Current implementation: mounts full DataExplorerPanel into canvas slot, getPanel() accessor
- `.planning/phases/167-explorercanvas-core/167-CONTEXT.md` — Phase 167 decisions (D-01: all sections mounted as-is, D-03: sidebar removed)

### DataExplorerPanel
- `src/ui/DataExplorerPanel.ts` — 4 sections: _buildImportExportSection, _buildCatalogSection, _buildAppsSection, _buildDbUtilitiesSection. DataExplorerPanelConfig interface.
- `src/ui/CollapsibleSection.ts` — CollapsibleSection used by all DataExplorerPanel sections

### Integration Point
- `src/main.ts` — ExplorerCanvas registration (~line 1525), commitProjection callback wiring, refreshDataExplorer() stats updates

### Contracts
- `.planning/STATE.md` §Accumulated Context — CANV-06 contract, commitProjection tab switching, slot-scoped updates

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `switchTab(proj, tabId)` in projection.ts — pure function that returns new Projection with updated activeTabId (reference equality on no-op)
- `DataExplorerPanel._build*Section()` — 4 private section builders, each populates a CollapsibleSection. These are the tab content sources.
- SuperWidget `commitProjection` — already detects `prev.activeTabId !== proj.activeTabId` and increments renderCount. Needs extension to call `onProjectionChange()`.
- `validateProjection()` — already enforces `activeTabId` must be in `enabledTabIds`

### Established Patterns
- Closure capture at registration: ExplorerCanvas config callbacks captured in main.ts create closure (Phase 167 D-02)
- CSS hide/show: content-visibility pattern used elsewhere in codebase (virtual scrolling)
- mount/destroy lifecycle on CanvasComponent

### Integration Points
- SuperWidget.commitProjection: needs 1-2 lines added to call `onProjectionChange()` on the current canvas
- ExplorerCanvas constructor: needs commitProjection callback parameter added alongside DataExplorerPanelConfig
- main.ts registration closure: needs to pass commitProjection callback to ExplorerCanvas

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

*Phase: 168-tab-system*
*Context gathered: 2026-04-21*
