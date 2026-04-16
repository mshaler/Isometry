# Phase 149: Explorer Decoupling + Panel Stubs - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Move all 8 existing explorer panels (Properties, Projection, Visual, LATCH, Data, Notebook, Algorithm, Calc) from the hidden PanelDrawer tray into a visible side drawer in the main panel area. Wire DockNav item clicks to toggle individual explorer panels in the drawer. Register Maps, Formulas, and Stories as new PanelMeta stub entries with "Coming soon" placeholder content. The dock navbar contains no explorer content — only navigation affordances.

</domain>

<decisions>
## Implementation Decisions

### Panel Layout (D-01)
- **D-01:** Side drawer layout. PanelDrawer relocates from the hidden `.workbench-panel-tray` (display:none) into `.workbench-main` as a visible flex column alongside `.workbench-view-content`. VS Code-style side panel approach. This is the first iteration — layout may evolve in future phases based on UX experimentation.

### Activation Model (D-02)
- **D-02:** Dock click toggles individual explorer panel in the side drawer. Clicking a dock item mapped to an explorer (Properties, Projection, LATCH, etc.) calls `PanelRegistry.enable()/disable()` to toggle that panel. PanelDrawer opens when any panel is enabled, closes when all are disabled (existing `_togglePanel()` behavior). PanelDrawer's own icon strip is hidden since DockNav is now the activation surface. On open, scroll-to and expand the toggled section.

### Stub Entries (D-03)
- **D-03:** Maps, Formulas, and Stories registered as `PanelMeta` entries in `PanelRegistry` with simple placeholder factories. Each factory returns a `PanelHook` that mounts a "Coming soon" placeholder div. Future phases replace the factory with real content — clean extension point, no special-case rip-out needed.

### Claude's Discretion
- Whether to delete the PanelDrawer icon strip entirely or hide it via CSS (hiding preferred for iteration flexibility)
- How DataExplorer special-case (`.workbench-data-explorer` toggle) merges with the new drawer — keep as separate toggle or fold into PanelRegistry
- DOM ordering of PanelDrawer vs DataExplorer vs view-content inside `.workbench-main`
- CSS transition/animation for drawer open/close
- How `onActivateItem` routes explorer-mapped section keys (analyze, activate) to PanelRegistry toggle calls
- Whether scroll-to-section uses `scrollIntoView()` or manual scroll offset calculation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Panel Architecture
- `src/ui/panels/PanelTypes.ts` — `PanelMeta`, `PanelHook`, `PanelFactory` interfaces. All stubs and explorer panels implement these.
- `src/ui/panels/PanelRegistry.ts` — Panel lifecycle: register/enable/disable/broadcastUpdate, dependency enforcement, order management
- `src/ui/panels/PanelDrawer.ts` — Icon strip + collapsible drawer + resize handle. Currently mounts into hidden tray — must relocate into `.workbench-main`
- `src/ui/CollapsibleSection.ts` — Wraps each panel in the drawer with collapse/expand toggle

### Shell Layout
- `src/ui/WorkbenchShell.ts` — Two-column layout (sidebar + main). `.workbench-panel-tray` is the hidden container being replaced. `getDataExplorerEl()` accessor for the special-case DataExplorer toggle.
- `src/styles/workbench.css` — Layout CSS for `.workbench-body`, `.workbench-main`, `.workbench-panel-tray`
- `src/styles/panel-drawer.css` — PanelDrawer styles (drawer width, scroll, resize handle, icon strip)

### DockNav (activation surface)
- `src/ui/DockNav.ts` — `onActivateItem(sectionKey, itemKey)` callback, `setActiveItem()` API, composite key pattern
- `src/ui/section-defs.ts` — `DOCK_DEFS` array with verb-noun taxonomy sections. New stubs (Maps, Formulas, Stories) need entries here.

### Main Wiring
- `src/main.ts` lines 966-1010 — DockNav instantiation, `onActivateItem` handler (currently handles `integrate` and `visualize` only — explorer sections are no-ops), `onActivateSection` no-op

### Existing Explorer Panels (all 8 must work post-decoupling)
- `src/ui/PropertiesExplorer.ts` — LATCH-grouped toggles with inline rename
- `src/ui/ProjectionExplorer.ts` — 4-well DnD chip assignment
- `src/ui/VisualExplorer.ts` — Zoom rail slider
- `src/ui/LatchExplorers.ts` — Histogram scrubbers, category chips, filters
- `src/ui/DataExplorerPanel.ts` — Import/export, catalog, DB utilities
- `src/ui/NotebookExplorer.ts` — Per-card markdown editor
- `src/ui/AlgorithmExplorer.ts` — Algorithm configuration
- `src/ui/CalcExplorer.ts` — Aggregate footer row configuration

### Requirements
- `.planning/REQUIREMENTS.md` — DCPL-01 (explorers in main panel), DCPL-02 (dock = navigation only), DCPL-03 (no functionality regression), STUB-01/02/03 (Maps/Formulas/Stories placeholders)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PanelRegistry` + `PanelDrawer` + `CollapsibleSection`: Full panel lifecycle already built — register, enable/disable with dependencies, drag-to-reorder, resize handle, persisted order/width. Just needs relocation from hidden tray to visible main area.
- `PanelMeta` / `PanelHook` / `PanelFactory` interfaces: Stubs implement these directly — minimal code for "Coming soon" placeholders.
- `DOCK_DEFS` in `section-defs.ts`: Verb-noun taxonomy data model. New stub entries (Maps, Formulas, Stories) added here.

### Established Patterns
- mount(container)/destroy() lifecycle for all explorers
- `PanelDrawer._togglePanel()` already opens drawer on first enable, closes on last disable
- `onActivateItem(sectionKey, itemKey)` callback pattern in DockNav — currently handles `integrate` (DataExplorer toggle) and `visualize` (view switch)
- `ui_state` persistence for drawer width and panel order (already implemented)

### Integration Points
- `WorkbenchShell` constructor: `.workbench-panel-tray` creation (line 88-90) needs to become a visible container inside `.workbench-main`
- `main.ts` `onActivateItem` handler (line 968): needs new branches for explorer-mapped sections to call PanelRegistry toggle
- `main.ts` panel registration block (around line 1540+): explorer factories already registered — no change needed there
- `DockNav.setActiveItem()`: may need to reflect panel open/close state back to dock icon highlighting

</code_context>

<specifics>
## Specific Ideas

- User explicitly wants iteration flexibility — side drawer is the starting point, not the final form. Architecture should support easy layout changes in future phases.
- PanelDrawer icon strip hidden rather than deleted (easy to bring back during experimentation).
- VS Code side panel is the reference mental model for the drawer layout.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 149-explorer-decoupling-panel-stubs*
*Context gathered: 2026-04-16*
