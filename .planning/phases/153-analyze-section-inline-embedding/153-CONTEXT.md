# Phase 153: Analyze Section Inline Embedding - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can toggle LATCH Filters and Formulas Explorer below the active view from the Analyze dock section, with filters persisting across view switches. Filters mount in bottom-slot child div with lazy instantiation. Formulas mounts as a stub below Filters. Both toggle independently via dock items.

</domain>

<decisions>
## Implementation Decisions

### Filter Toggle Wiring
- **D-01:** Special case `showLatchFilters()`/`hideLatchFilters()` functions in `main.ts` — bypasses PanelRegistry, matches Phase 152 DataExplorer pattern. Lazy mount on first show, then toggle `display` on subsequent shows.
- **D-02:** Dedicated `if (sectionKey === 'analyze')` branch in `onActivateItem` with `itemKey` routing for `'filter'` and `'formula'`. Remove `'analyze:filter'` and `'analyze:formula'` from `dockToPanelMap` since they no longer fall through to PanelRegistry toggle.

### Formulas Toggle Wiring
- **D-03:** Same special case pattern for Formulas: `showFormulasExplorer()`/`hideFormulasExplorer()` with lazy mount of `FormulasPanelStub` content into bottom-slot child div.

### Cross-View Filter Persistence
- **D-04:** Rely on DOM sibling survival — bottom slot is a sibling of `.workbench-main__view-content` in the flex-column layout, so view switches (which replace view-content internals) leave the bottom slot untouched. No explicit guard logic needed. Phase 154 integration test validates this.

### Stacking Order
- **D-05:** Fixed DOM order — Filters child div first, Formulas child div second inside `.workbench-slot-bottom`. Matches top-slot pattern where Data, Properties, Projections have fixed order.

### Formulas Stub Content
- **D-06:** Reuse existing `FormulasPanelStub` content (icon + heading + "coming soon" body) mounted into the bottom-slot child div. Same content as the old PanelDrawer version, new inline location.

### Bottom-Slot Visibility Sync
- **D-07:** `syncBottomSlotVisibility()` function matching `syncTopSlotVisibility()` — shows `.workbench-slot-bottom` when any child visible, hides when all hidden.

### Dock Item Pressed State
- **D-08:** `dockNav.setItemPressed('analyze:filter', bool)` and `dockNav.setItemPressed('analyze:formula', bool)` for aria-pressed toggle state, matching Phase 152 `integrate:catalog` pattern.

### Claude's Discretion
- Whether LatchExplorers instantiation reuses the existing PanelRegistry factory closure code or duplicates the constructor call inline (factory closure is cleaner but adds indirection)
- Whether `syncBottomSlotVisibility()` is a standalone function or combined with `syncTopSlotVisibility()` into a generic `syncSlotVisibility(slotEl, ...children)`
- CSS class naming for bottom-slot child divs (e.g., `slot-bottom__latch-filters`, `slot-bottom__formulas-explorer`)
- Whether the `analyze` branch should also hide DataExplorer on section switch (matching the `integrate` branch that hides on non-integrate section activation) — likely no, analyze items are independent of integrate items

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 152 Pattern (primary reference)
- `src/main.ts` lines 630-657 — Top-slot child div creation, `syncTopSlotVisibility()`. **This is the exact pattern to replicate for bottom slot.**
- `src/main.ts` lines 886-943 — `showPropertiesExplorer()`/`hidePropertiesExplorer()`/`showProjectionExplorer()`/`hideProjectionExplorer()` lazy mount pattern.
- `src/main.ts` lines 1065-1129 — `onActivateItem` handler with `integrate` and `visualize` branches.

### Bottom Slot Container
- `src/ui/WorkbenchShell.ts` line 110 — `getBottomSlotEl()` accessor for `.workbench-slot-bottom`.
- `src/styles/workbench.css` line 93 — `.workbench-slot-bottom` CSS rule.

### LatchExplorers
- `src/ui/LatchExplorers.ts` — Full LATCH filter UI with mount/update/destroy lifecycle, FilterProvider integration, SchemaProvider subscription for remount.
- `src/main.ts` lines 1533-1565 — LatchExplorers PanelRegistry registration with constructor args and SchemaProvider remount wiring.

### Formulas Stub
- `src/ui/panels/FormulasPanelStub.ts` — Existing stub panel meta and factory.

### Dock Definitions
- `src/ui/section-defs.ts` lines 157-163 — `analyze` section with `filter` and `formula` items.
- `src/main.ts` lines 1055-1059 — Current `dockToPanelMap` entries for analyze items (to be removed).

### Dock Pressed State
- `src/ui/DockNav.ts` — `setItemPressed(compositeKey, bool)` method for aria-pressed.

### Requirements
- `.planning/REQUIREMENTS.md` — ANLZ-01 through ANLZ-05.

### Prior Phase Context
- `.planning/phases/152-integrate-visualize-inline-embedding/152-CONTEXT.md` — Top-slot decisions D-01 through D-04.
- `.planning/phases/151-paneldrawer-removal-inline-container-scaffolding/151-CONTEXT.md` — Slot scaffolding decisions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkbenchShell.getBottomSlotEl()` — Already returns the `.workbench-slot-bottom` container element (Phase 151)
- `LatchExplorers` class — Full mount/destroy lifecycle, takes `{ filter, bridge, coordinator, schema }` config
- `FormulasPanelStub` — Existing stub with meta and factory, content ready to mount
- `syncTopSlotVisibility()` pattern — Direct template for `syncBottomSlotVisibility()`
- `dockNav.setItemPressed()` — Aria-pressed toggle already working for integrate:catalog

### Established Patterns
- Child div creation: `document.createElement('div')` with className, `style.display = 'none'`, appended to slot el
- Lazy mount: boolean flag (`propertiesExplorerMounted`), construct + mount on first show, toggle display on subsequent
- Slot visibility sync: check all children's display, set parent display accordingly
- Section branch routing: `if (sectionKey === 'analyze')` with itemKey switch

### Integration Points
- `main.ts` `onActivateItem` — Add `analyze` branch after `visualize` branch
- `main.ts` after line 648 — Create bottom-slot child divs (mirror top-slot pattern at lines 634-648)
- `main.ts` `dockToPanelMap` — Remove `'analyze:filter'` and `'analyze:formula'` entries
- SchemaProvider subscription — LatchExplorers needs remount on schema change (existing pattern at line 1552-1556)

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

*Phase: 153-analyze-section-inline-embedding*
*Context gathered: 2026-04-16*
