# Phase 175: Shell Replacement - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

SuperWidget is promoted to the top-level `#app` container. DockNav and CommandBar are re-parented into SuperWidget slots. WorkbenchShell is fully deleted with no remaining references. All ~17 `shell.*` wiring points in main.ts are re-routed to SuperWidget equivalents. 6 requirements: SHEL-01 through SHEL-06.

</domain>

<decisions>
## Implementation Decisions

### Slot Mapping Strategy
- **D-01:** SuperWidget gains a 5th grid slot — **sidebar** — where DockNav mounts. This makes SuperWidget the true top-level container (SHEL-01, SHEL-02). CSS grid layout becomes: sidebar | [header / tabs / canvas / status].
- **D-02:** SuperWidget exposes **temporary passthrough** `getTopSlotEl()` / `getBottomSlotEl()` accessors returning simple container divs inside the canvas area. Explorers mount exactly as they do today. Phase 176 replaces these with the real sidecar grid.
- **D-03:** CommandBar is mounted in the SuperWidget **header slot** (SHEL-03). SuperWidget receives CommandBar as a constructor parameter — it does not create CommandBar internally. `superWidget.getCommandBar()` replaces `shell.getCommandBar()`.
- **D-04:** `getSectionStates()` / `restoreSectionStates()` are **dropped entirely** — they're no-op stubs (dead code). LayoutPresetManager wiring removed. If real section state is needed later, it wires to the actual source.

### Migration Sequencing
- **D-05:** **Big-bang swap** — delete WorkbenchShell, promote SuperWidget to `#app` root, rewire all 17 call sites in one plan. WorkbenchShell is thin (131 LOC, no business logic) and all call sites are in main.ts — blast radius is contained. One Vitest smoke test verifies all wiring.

### CommandBar Ownership
- **D-06:** CommandBar is **created in main.ts** before SuperWidget (like DockNav pattern) and **passed to SuperWidget constructor**. SuperWidget mounts it in the header slot but has no knowledge of CommandBar internals. This keeps SuperWidget as a pure container.

### ViewManager Integration
- **D-07:** **ViewCanvas wraps ViewManager** — ViewCanvas (already exists in SuperWidget) becomes the bridge. ViewManager mounts into ViewCanvas's container element. The 8 `getViewContentEl()` calls become a SuperWidget or ViewCanvas accessor. ViewManager continues to own view switching; ViewCanvas just provides the DOM target.

### StateCoordinator Drain (SHEL-05)
- **D-08:** **Ordering guarantee** — ensure SuperWidget is fully wired before any providers fire notifications. Since it's a big-bang swap (no teardown of a live WorkbenchShell), there's no mid-flight batch to drain. A Vitest test verifies no callbacks fire into void.

### Claude's Discretion
- Exact CSS grid template for the 5-slot layout (sidebar + header/tabs/canvas/status)
- Whether SuperWidget constructor signature changes to `(canvasFactory, commandBar, shortcuts?)` or uses an options object
- Naming of the temporary passthrough accessors (getTopSlotEl/getBottomSlotEl or something more descriptive)
- Internal DOM structure of the temporary explorer containers
- Whether the Vitest smoke test imports SuperWidget directly or tests through main.ts bootstrap

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### WorkbenchShell (source of truth for what's being replaced)
- `src/ui/WorkbenchShell.ts` — 131 LOC, 6 accessors to re-route. Constructor creates DOM layout + CommandBar.
- `src/styles/workbench.css` — CSS for `.workbench-shell`, `.workbench-body`, `.workbench-sidebar`, `.workbench-main`, `.workbench-slot-top`, `.workbench-slot-bottom`

### SuperWidget (target of the migration)
- `src/superwidget/SuperWidget.ts` — Current 4-slot grid (header, tabs, canvas, status), commitProjection lifecycle, TabBar integration
- `src/superwidget/projection.ts` — Projection type, switchTab(), validateProjection()
- `src/superwidget/registry.ts` — Canvas registry (CANV-06 plug-in seam)
- `src/superwidget/ViewCanvas.ts` — ViewCanvas component that will wrap ViewManager
- `src/superwidget/statusSlot.ts` — Status slot rendering
- `src/styles/superwidget.css` — Current CSS grid layout, `--sw-*` design tokens

### Main wiring file (all 17 shell.* call sites)
- `src/main.ts` — Lines 557 (shell creation), 416/458/572/600/604/881/933 (getViewContentEl), 646 (getTopSlotEl), 670 (getBottomSlotEl), 981 (getSidebarEl), 707/741/1055 (getCommandBar), 1240-1251 (getSectionStates/restoreSectionStates)

### Related components
- `src/ui/CommandBar.ts` — Will become a constructor parameter to SuperWidget
- `src/ui/DockNav.ts` — Will mount into new sidebar slot
- `src/ui/panels/PanelRegistry.ts` — Currently passed to WorkbenchShell config; may need re-wiring

### Phase 174 context (predecessor decisions)
- `.planning/phases/174-tab-management/174-CONTEXT.md` — TabSlot type, CANV-06 preservation, Pointer Events DnD pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SuperWidget` class: Already has 4-slot CSS grid, mount/destroy lifecycle, commitProjection — needs 5th sidebar slot and explorer passthrough divs
- `ViewCanvas`: Already registered as a canvas component — will become the ViewManager mount target bridge
- `CommandBar`: Standalone class with mount/destroy — ready to be passed as constructor parameter
- `DockNav`: Standalone class with mount(el) pattern — ready to mount into new sidebar slot

### Established Patterns
- Data-attribute selectors (`data-component`, `data-slot`) — no class-based selectors in SuperWidget CSS
- CSS custom property tokens with `--sw-*` namespace
- Constructor parameter injection (SuperWidget already takes `canvasFactory` and `shortcuts`)
- `mount(parentEl)` / `destroy()` lifecycle on all UI components

### Integration Points
- `main.ts` line 557: WorkbenchShell constructor → becomes SuperWidget promotion to `#app`
- `main.ts` line 1641: SuperWidget currently mounted into `dataExplorerChildEl` → must move to `container` (#app)
- 8 files import WorkbenchShell (main.ts + 7 others) — all must be cleaned up
- `CalcExplorer`, `PropertiesExplorer`, `AlgorithmExplorer`, `ViewTabBar` import WorkbenchShell for type references

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraints are consistency with existing SuperWidget patterns and ensuring Phase 176 (Explorer Sidecar) has clean integration points via the temporary passthrough slots.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 175-shell-replacement*
*Context gathered: 2026-04-22*
