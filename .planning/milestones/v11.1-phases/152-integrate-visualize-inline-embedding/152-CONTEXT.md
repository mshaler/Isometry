# Phase 152: Integrate + Visualize Inline Embedding - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can toggle Data Explorer + Properties Explorer above the active view from the Integrate dock section (single "Data" icon toggles both as a unit), and Projections Explorer appears above SuperGrid only — purely automatic based on view switch, hidden for all other views. All three explorers mount as stacked vertical children inside `.workbench-slot-top`.

</domain>

<decisions>
## Implementation Decisions

### Top-Slot Mounting Strategy
- **D-01:** All three explorers (Data Explorer, Properties Explorer, Projections Explorer) are stacked vertically as separate child divs inside `.workbench-slot-top`. Data on top, Properties below, Projections at the bottom.

### Data Icon Toggle Scope
- **D-02:** Single "Data" dock item (`integrate:catalog`) toggles both Data Explorer and Properties Explorer as a unit. No separate Properties dock entry. One click shows both, second click hides both.

### Projections Auto-Visibility
- **D-03:** Projections Explorer visibility is purely automatic — driven by view-switch logic. Shows when SuperGrid is the active view, hides for all other views. No manual toggle, no dock item for Projections. User cannot manually dismiss Projections while on SuperGrid.

### DataExplorer Special Case
- **D-04:** DataExplorer remains a special case in `main.ts` (`showDataExplorer()`/`hideDataExplorer()`). Not folded into PanelRegistry this phase. The "toggle both" logic calls `showDataExplorer()` alongside mounting Properties into its child div in the top slot. Properties stays PanelRegistry-managed.

### Claude's Discretion
- How Properties Explorer mounts into its child div — direct instantiation like DataExplorer, or via PanelRegistry factory invocation
- Whether `.workbench-slot-top` visibility is managed by showing/hiding the parent container or by showing/hiding individual child divs (parent `display:none` when all children hidden is likely simplest)
- Where the view-switch hook for Projections auto-show lives — in the existing `onActivateItem` visualize branch or a separate `viewManager` callback
- Whether Projections gets its own child div created eagerly (like top/bottom slots) or lazily on first SuperGrid activation

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Layout (Phase 151 output)
- `src/ui/WorkbenchShell.ts` — Top-slot (`getTopSlotEl()`) and bottom-slot (`getBottomSlotEl()`) accessors. Vertical stack layout: `[slot-top] [view-content] [slot-bottom]` inside `.workbench-main__content`.
- `src/styles/workbench.css` — Layout CSS for `.workbench-slot-top`, `.workbench-slot-bottom`, `.workbench-main__content` flex-column.

### DataExplorer Wiring
- `src/main.ts` lines 632-858 — `showDataExplorer()`/`hideDataExplorer()` special case, `dataExplorerEl = shell.getTopSlotEl()`, DataExplorerPanel instantiation with all callbacks.

### Dock Activation
- `src/main.ts` lines 970-1031 — `dockToPanelMap` and `onActivateItem` handler. `integrate:catalog` currently toggles DataExplorer only. `integrate:properties`/`integrate:projection` fall through to PanelRegistry toggle.
- `src/ui/section-defs.ts` lines 137-144 — `DOCK_DEFS` Integrate section has single item `{ key: 'catalog', label: 'Data', icon: 'database' }`.

### Explorer Factories (PanelRegistry)
- `src/main.ts` lines 1361-1431 — Properties Explorer and Projection Explorer panel registration with mount/update/destroy factories.
- `src/ui/panels/PanelRegistry.ts` — Panel lifecycle: register/enable/disable, dependency enforcement.

### View Switching
- `src/main.ts` lines 1008-1017 — `onActivateItem` visualize branch calls `viewManager.switchTo()` with opacity transition.

### Requirements
- `.planning/REQUIREMENTS.md` — INTG-01 (Data+Properties appear in top slot), INTG-02 (toggle hides both), VIZ-01 (Projections appears for SuperGrid), VIZ-02 (Projections hidden for non-SuperGrid), VIZ-03 (Projections reappears on return to SuperGrid).

### Prior Phase Context
- `.planning/phases/151-paneldrawer-removal-inline-container-scaffolding/151-CONTEXT.md` — PanelDrawer removal decisions, slot scaffolding.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkbenchShell.getTopSlotEl()` — Already returns the `.workbench-slot-top` container element
- `PanelRegistry` enable/disable lifecycle — Properties Explorer already registered with mount/destroy factory
- `showDataExplorer()`/`hideDataExplorer()` — Existing toggle logic for DataExplorer, needs extension to also toggle Properties
- `CollapsibleSection` — Available if individual explorer collapse is needed (not required by current decisions)

### Established Patterns
- `dataExplorerEl.style.display = 'block'/'none'` — Current visibility toggle pattern
- `mount(container)/destroy()` lifecycle for PanelRegistry-managed explorers
- `onActivateItem(sectionKey, itemKey)` callback with composite key routing
- View switch via `viewManager.switchTo()` with opacity transition

### Integration Points
- `main.ts` `onActivateItem` integrate branch (line 987) — Must be extended: `integrate:catalog` now toggles Data + Properties as a unit
- `main.ts` `onActivateItem` visualize branch (line 1009) — View switch hook where Projections auto-show/hide logic attaches
- `WorkbenchShell.getTopSlotEl()` — Parent container. Needs child divs created for each explorer.
- Properties Explorer factory (line 1370) — Currently PanelRegistry-managed, needs to mount into a specific child div of the top slot

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 152-integrate-visualize-inline-embedding*
*Context gathered: 2026-04-16*
