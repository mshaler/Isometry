# Phase 179: Dock Wiring Repair - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all broken click handlers so DockNav items correctly toggle explorers and switch views. Every dock icon must respond to clicks, and the active/pressed state must be visually reflected — including on mount when panels are restored from persisted state.

</domain>

<decisions>
## Implementation Decisions

### Settings & Help Wiring
- **D-01:** Settings dock icon (`help:settings`) opens `CommandPalette` — reuses existing component, same as Cmd+K. No dedicated settings panel.
- **D-02:** Help dock icon (`help:help-page`) toggles `HelpOverlay` — reuses existing component, same as `?` key shortcut.

### Active State Visual
- **D-03:** Same `dock-nav__item--active` accent background for both view-selected items (mutual exclusion) and toggle-open items (independent on/off). No visual distinction between the two kinds.

### Mount-time State Sync
- **D-04:** After PanelManager initializes, dock icons must sync to pre-existing panel states. Read which panels are open and call `setItemPressed` for each toggle-type item (integrate:catalog, analyze:filter, analyze:formula) so the dock is accurate from first paint.

### Claude's Discretion
- Implementation details for how mount-time sync reads panel state (query PanelManager or PanelRegistry directly)
- Whether to add `help:settings` and `help:help-page` as special-case handlers in the `onActivateItem` callback or add them to `dockToPanelMap` with a different routing pattern

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Navigation & Dock
- `src/ui/DockNav.ts` — DockNav class with click handler, event delegation, setActiveItem/setItemPressed API
- `src/ui/section-defs.ts` — DOCK_DEFS array defining all sections and items (integrate/visualize/analyze/activate/help)
- `src/styles/dock-nav.css` — dock styling including active state (dock-nav__item--active)

### Wiring & Panel Management
- `src/main.ts` lines ~858-965 — `onActivateItem` callback with section routing logic, `dockToPanelMap`
- `src/main.ts` lines ~536-554 — CommandPalette creation and toggle logic
- `src/main.ts` lines ~1210-1211 — HelpOverlay and CommandPalette mount
- `src/ui/panels/PanelManager.ts` — panel show/hide/toggle orchestration
- `src/ui/panels/PanelRegistry.ts` — panel enable/disable registry

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CommandPalette` — already mounted, has `open()`, `close()`, `isVisible()` API
- `HelpOverlay` — already mounted, has `show()`, `hide()`, `isVisible()`, `toggle()` API
- `DockNav.setItemPressed(compositeKey, pressed)` — already exists for toggle-type active state
- `PanelManager.isVisible(panelId)` / `PanelManager.isGroupVisible(groupId)` — query panel state

### Established Patterns
- Event delegation: single click listener on `nav` element routes via `data-section-key` / `data-item-key` attributes
- Section-based routing in `onActivateItem`: `if (sectionKey === 'integrate')`, `if (sectionKey === 'visualize')`, etc.
- `dockToPanelMap` for panel toggle routing (fallthrough at end of handler)
- `setItemPressed` called after panel toggle operations for visual sync

### Integration Points
- `onActivateItem` callback in main.ts — add `help` section handler for settings/help-page
- PanelManager init (~line 1733) — add dock sync calls after instantiation
- `commandPalette` and `helpOverlay` variables are in scope at the `onActivateItem` closure

</code_context>

<specifics>
## Specific Ideas

No specific requirements — straightforward wiring of existing components to unhandled dock items, plus mount-time state sync.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 179-dock-wiring-repair*
*Context gathered: 2026-04-22*
