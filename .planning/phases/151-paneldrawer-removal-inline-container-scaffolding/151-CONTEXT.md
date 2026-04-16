# Phase 151: PanelDrawer Removal + Inline Container Scaffolding - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove the PanelDrawer side drawer system entirely (icon strip, drawer container, resize handle, CSS) and replace the layout with a clean vertical stack containing top-slot and bottom-slot inline embedding containers. The existing `.workbench-data-explorer` special-case merges into the new top-slot. PanelRegistry and CollapsibleSection survive as the state model for Phase 152+ explorer management. Dead PanelDrawer tests are removed; new slot tests deferred to Phase 154.

</domain>

<decisions>
## Implementation Decisions

### PanelDrawer Deletion Scope
- **D-01:** Delete `PanelDrawer.ts` and `panel-drawer.css` entirely. These are the presentation layer — no longer needed.
- **D-02:** Keep `PanelRegistry.ts`, `CollapsibleSection.ts`, and `PanelTypes.ts` (`PanelMeta`, `PanelHook`, `PanelFactory`). PanelRegistry becomes the state model for inline slot management in Phases 152-153. Registry's enable/disable/dependency lifecycle is reused; only the drawer rendering is removed.

### Inline Container Structure
- **D-03:** Merge `.workbench-data-explorer` into a new generic `.workbench-slot-top` container. DataExplorer becomes one of several things that can mount in the top slot (Phase 152 wires this).
- **D-04:** Add `.workbench-slot-bottom` below view content. Layout becomes a clean vertical stack: `[top-slot] [view-content] [bottom-slot]` inside `.workbench-main`.
- **D-05:** `.workbench-main__content` flex-row (which held PanelDrawer + view-content side-by-side) is replaced by a flex-column vertical stack. No side-by-side layout remains.

### Test Cleanup
- **D-06:** Delete all PanelDrawer-specific test assertions (~8 references across `tests/ui/WorkbenchShell.test.ts` and `tests/seams/ui/workbench-shell.test.ts`). Do not write replacement slot tests this phase — Phase 154 (Regression Guard) handles new integration tests for the inline embedding flow.

### Claude's Discretion
- Whether `WorkbenchShell` exposes `getTopSlotEl()` / `getBottomSlotEl()` accessors or a single `getSlotEl(position)` method
- Whether to remove `getPanelDrawer()` accessor entirely or replace with a `getPanelRegistry()` accessor
- How `getDataExplorerEl()` accessor evolves — remove it (callers use top-slot instead) or keep as alias during transition
- Whether top-slot and bottom-slot start with `display:none` or are always-visible empty containers
- CSS cleanup scope — how much of `workbench.css` layout rules need updating vs replacing

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Files Being Deleted
- `src/ui/panels/PanelDrawer.ts` — Icon strip + drawer + resize handle. Entire file deleted.
- `src/styles/panel-drawer.css` — Drawer width, scroll, resize handle styles. Entire file deleted.

### Files Being Modified
- `src/ui/WorkbenchShell.ts` — Layout orchestrator. PanelDrawer import/instantiation removed, `.workbench-data-explorer` replaced with `.workbench-slot-top`, `.workbench-main__content` flex-row becomes vertical stack with `[top-slot] [view-content] [bottom-slot]`.
- `src/styles/workbench.css` — Layout CSS for `.workbench-body`, `.workbench-main`, `.workbench-main__content`. Must update to vertical stack layout.

### Files Being Preserved (for Phase 152+ reuse)
- `src/ui/panels/PanelRegistry.ts` — Panel lifecycle: register/enable/disable, dependency enforcement, order management
- `src/ui/panels/PanelTypes.ts` — `PanelMeta`, `PanelHook`, `PanelFactory` interfaces
- `src/ui/CollapsibleSection.ts` — Collapse/expand wrapper per panel

### Tests Being Cleaned
- `tests/ui/WorkbenchShell.test.ts` — ~5 PanelDrawer-specific tests to delete (lines 96-164 area)
- `tests/seams/ui/workbench-shell.test.ts` — 1 PanelDrawer assertion to delete (line 78 area)

### Wiring (references to PanelDrawer from main.ts)
- `src/main.ts` — PanelDrawer usage via `shell.getPanelDrawer()`. Must be updated to remove drawer references while preserving PanelRegistry usage.

### Requirements
- `.planning/REQUIREMENTS.md` — RMV-01 (no side panel column), RMV-02 (no icon strip/resize handle/drawer container)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PanelRegistry`: enable/disable/broadcastUpdate lifecycle — becomes the state model for which explorers are visible in inline slots
- `CollapsibleSection`: collapse/expand toggle wrapper — reusable inside inline slot containers
- `PanelTypes.ts` interfaces: `PanelMeta`, `PanelHook`, `PanelFactory` — all explorer factories already implement these

### Established Patterns
- `mount(container)/destroy()` lifecycle for all explorers and shell components
- `WorkbenchShell` creates DOM in constructor, exposes element accessors
- `ui_state` persistence via bridge for layout preferences (panel order, drawer width — width persistence can be removed with drawer)

### Integration Points
- `WorkbenchShell` constructor (lines 44-89): DOM creation — primary modification target
- `main.ts` `shell.getPanelDrawer()` calls: must be removed or redirected
- `main.ts` DataExplorer toggle wiring: currently uses `shell.getDataExplorerEl()` — needs to use new top-slot accessor

</code_context>

<specifics>
## Specific Ideas

- Phase 149 context noted "iteration flexibility" as a principle — but Phase 151 is now committing to inline embedding, so PanelDrawer deletion is final (no need to preserve for rollback).
- The vertical stack `[top-slot] [view-content] [bottom-slot]` is the target layout for the entire v11.1 milestone. Phases 152-153 populate the slots; this phase just creates the empty containers.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 151-paneldrawer-removal-inline-container-scaffolding*
*Context gathered: 2026-04-16*
