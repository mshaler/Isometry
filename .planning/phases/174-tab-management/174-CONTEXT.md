# Phase 174: Tab Management - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can create, close, switch, and reorder tabs in the SuperWidget tab bar with keyboard navigation and overflow handling. TabSlot type establishes the shell-level tab abstraction separate from canvas-internal concerns. 10 requirements: TABS-01 through TABS-10.

</domain>

<decisions>
## Implementation Decisions

### Tab Identity & New-Tab Defaults
- **D-01:** New tabs default to View (Bound) canvas type — the most common use case. No canvas chooser screen. User can switch canvas type later via existing mechanisms.
- **D-02:** All tabs share the same provider state (FilterProvider, PAFVProvider, DensityProvider). Switching tabs only changes the canvas — providers remain singletons. No per-tab state cloning.
- **D-03:** TabSlot wraps a Projection (which already has `activeTabId`, `enabledTabIds`, `canvasType`, `canvasBinding`, `canvasId`, `zoneRole`). TabSlot adds shell-level metadata (label, badge) without conflating with canvas-internal tabs.

### Close Behavior & Guarding
- **D-04:** When a tab is closed, the adjacent tab activates — the tab to the right, or if rightmost was closed, the tab to its left. Standard browser convention.
- **D-05:** No close confirmation dialogs. Editor auto-saves via 500ms debounce notebook persistence, so no unsaved-state risk. Close is always immediate.
- **D-06:** Last tab cannot be closed (TABS-02). The × button should be hidden or disabled on the sole remaining tab.

### Drag Reorder
- **D-07:** Insertion line visual feedback — vertical line appears between tabs at the drop target. Dragged tab dims at source position. Matches the existing SuperDynamic axis reorder pattern in the codebase.
- **D-08:** Pointer Events API for drag (not HTML5 Drag and Drop) — consistent with existing DnD patterns in SuperDynamic and Kanban.

### Overflow Navigation
- **D-09:** Replace the existing CSS `mask-image` edge fade with explicit chevron buttons. Left/right chevrons appear only when overflow exists in that direction. Clicking a chevron scrolls by one tab width.
- **D-10:** Remove `scrollbar-width: none` and `mask-image` from the tabs slot CSS. Chevrons become the sole overflow affordance.

### Claude's Discretion
- Exact TabSlot type shape (fields beyond what Projection provides) — whatever cleanly separates shell-level tab metadata from canvas internals per TABS-09
- Whether chevron scroll uses `scrollBy()` with smooth behavior or manual animation
- Internal data structure for tab ordering (array vs linked list)
- Whether Cmd+W close fires through ShortcutRegistry or a dedicated handler
- FLIP animation on reorder (if warranted given tab count is typically small)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### SuperWidget Architecture
- `src/superwidget/SuperWidget.ts` — Current SuperWidget with 4-slot grid layout, placeholder tab buttons, commitProjection lifecycle
- `src/superwidget/projection.ts` — Projection type (activeTabId, enabledTabIds), switchTab(), toggleTabEnabled(), setCanvas(), validateProjection()
- `src/superwidget/registry.ts` — Canvas registry (CANV-06 plug-in seam)
- `src/styles/superwidget.css` — Current tab slot CSS (mask-image fade, tab button styles, --sw-* tokens)

### Existing Tab/Keyboard Patterns
- `src/ui/ViewTabBar.ts` — Existing roving tabindex pattern with arrow key navigation, role="tablist" ARIA
- `src/ui/DockNav.ts` — Another roving tabindex implementation for reference

### Prior Decisions (v13.0–v13.2)
- CANV-06: SuperWidget must have zero import references to any canvas — registry plug-in seam only
- Tab switching goes through commitProjection / activeTabId on Projection — no direct canvas method calls
- Wrapper-div isolation: ViewManager's container must be an inner div, never _canvasEl directly
- destroy-before-mount ordering must hold under rapid switching

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `projection.ts` switchTab() / toggleTabEnabled(): Pure transition functions with reference-equality bail-out — direct building blocks for tab state management
- `ViewTabBar.ts`: Roving tabindex pattern with ArrowLeft/ArrowRight/Home/End keyboard nav — reusable pattern for TABS-07
- SuperWidget `_tabsEl` slot: Already wired with placeholder buttons and CSS — will be replaced with real TabSlot-driven rendering
- `superwidget.css` tab button styles: Existing `[data-tab-role="tab"]` and `[data-tab-active="true"]` selectors — adapt for real tab rendering

### Established Patterns
- Data-attribute selectors (`data-component`, `data-slot`, `data-tab-role`) — no class-based selectors in SuperWidget CSS
- CSS custom property tokens with `--sw-*` namespace — all new tab styles must use this namespace
- Pointer Events for DnD (SuperDynamic axis reorder, Kanban card drag) — not HTML5 DnD API
- D3 data join for DOM updates in view layer (but tab bar is likely plain DOM given small element count)

### Integration Points
- `SuperWidget.commitProjection()`: Tab creation/close must produce valid Projections that pass `validateProjection()`
- `main.ts`: Where SuperWidget is instantiated and wired — tab lifecycle hooks will connect here
- `ShortcutRegistry`: Cmd+W shortcut registration for TABS-08
- `onTabMetadataChange` callback: TABS-10 requires metadata to flow upward without breaking CANV-06

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint is consistency with existing SuperDynamic DnD visuals (insertion line + source dimming) and ViewTabBar keyboard nav pattern (roving tabindex).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 174-tab-management*
*Context gathered: 2026-04-21*
