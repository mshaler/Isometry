# Phase 102: New Plugin Wave -- SuperDensity, SuperSearch, SuperSelect, SuperAudit - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement all 10 remaining new-feature plugins across 4 independent categories (SuperDensity: 3, SuperSearch: 2, SuperSelect: 3, SuperAudit: 2), registered via registerCatalog() with real factories and passing behavioral tests. After this phase, FeatureCatalogCompleteness.test.ts stub count is 0 and getStubIds() returns an empty array.

</domain>

<decisions>
## Implementation Decisions

### Shared State Pattern (all 4 categories)
- Each category creates its own lightweight shared state object inside registerCatalog() -- consistent with SuperStack/Zoom/Calc pattern from Phase 101
- No coupling to main app providers (SuperDensityProvider, SelectionProvider, AuditState) -- pivot harness stays self-contained
- State objects: DensityState, SearchState, SelectionState, AuditPluginState
- Export state constructor functions for test isolation (createDensityState(), etc.)

### SuperDensity Plugins (3 plugins)
- **superdensity.mode-switch**: Segmented button bar rendered via afterRender() into toolbar area above grid (same area as SuperZoomSlider). Toggles between compact/normal/comfortable/spacious levels via shared DensityState
- **superdensity.mini-cards**: afterRender re-styles cells with CSS classes at high density -- applies compact icon+title layout. Does NOT use transformData; purely visual via DOM manipulation
- **superdensity.count-badge**: Count number only (e.g., "12") in each cell at lowest density. Clean pivot table aesthetic. No sparklines or icons

### SuperSearch Plugins (2 plugins)
- **supersearch.input**: Client-side filtering in transformData -- filters CellPlacement[] by matching cell values against search term. No Worker Bridge FTS5 dependency. Search input rendered via afterRender() into toolbar area above grid. Debounced input (300ms)
- **supersearch.highlight**: CSS class (.search-match) applied to matching cell elements via afterRender. No inline <mark> tags -- simple class-based highlighting. Text substring highlighting deferred

### SuperSelect Plugins (3 plugins)
- **superselect.click**: Handles click and Cmd+click (additive) via onPointerEvent. Manages shared SelectionState { selectedKeys: Set<string> }. Selected cells get .selected CSS class with colored outline (data-attribute-over-has pattern from v6.1)
- **superselect.lasso**: CSS div overlay for rectangular drag selection (no SVG). onPointerEvent tracks drag bounds, resizes positioned div, computes intersecting cells. Updates shared SelectionState
- **superselect.keyboard**: Handles Shift+arrow range extension via onPointerEvent (keydown). Reads current selection anchor from shared SelectionState, extends range in arrow direction. Separate from click plugin per catalog taxonomy

### SuperAudit Plugins (2 plugins)
- **superaudit.overlay**: Fresh lightweight AuditPluginState { inserted: Set, updated: Set, deleted: Set }. afterRender applies CSS classes (.audit-new / .audit-modified / .audit-deleted) with color tinting via CSS custom properties. No separate legend panel -- FeaturePanel toggle controls on/off
- **superaudit.source**: Colored 3px left border stripe on cells, colored by import source provenance. Uses CSS custom properties matching audit-colors.ts palette. Reads source info from shared AuditPluginState { sources: Map<key, source> }

### Visual Composability
- All 4 categories use CSS classes on cell elements -- no separate overlay layers
- Classes compose naturally: a cell can be .selected + .audit-new + .search-match simultaneously
- Density changes cell size/content but doesn't affect class-based overlays from other plugins

### Claude's Discretion
- Exact CSS custom property names and color values for audit/selection/search
- Toolbar area layout (how density buttons, search input, and zoom slider coexist)
- Debounce implementation details for search
- DensityState level names and exact cell height values per level
- AuditPluginState population mechanism (how harness feeds change data to state)
- Keyboard event handling details (which key events, preventDefault strategy)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Plugin Architecture
- `src/views/pivot/plugins/PluginRegistry.ts` -- Registry API: register(), setFactory(), enable/disable, pipeline execution, notifyChange()
- `src/views/pivot/plugins/FeatureCatalog.ts` -- Full 27-feature taxonomy, NOOP_FACTORY sentinel, registerCatalog() function (PRIMARY modification target -- add 10 setFactory calls)
- `src/views/pivot/plugins/PluginTypes.ts` -- PluginHook interface (transformData/transformLayout/afterRender/onPointerEvent/onScroll/destroy), PluginFactory, RenderContext, CellPlacement, GridLayout

### Existing Plugin References (pattern to follow)
- `src/views/pivot/plugins/SuperZoomSlider.ts` -- Reference for toolbar UI plugin (afterRender mounts controls)
- `src/views/pivot/plugins/SuperZoomWheel.ts` -- Reference for shared state + transformLayout pattern
- `src/views/pivot/plugins/SuperStackCollapse.ts` -- Reference for onPointerEvent handling with shared state + rerender callback
- `src/views/pivot/plugins/SuperSortHeaderClick.ts` -- Reference for onPointerEvent click handling

### Existing App Code (NOT to import, but to reference for behavior)
- `src/providers/SuperDensityProvider.ts` -- Existing 4-level density model (reference for level names/behavior, not imported)
- `src/providers/SelectionProvider.ts` -- Existing selection state (reference for selectedIds pattern, not imported)
- `src/audit/AuditState.ts` -- Existing change tracking (reference for insert/update/delete set pattern, not imported)
- `src/audit/audit-colors.ts` -- Source provenance color palette (reference for color values)

### Testing
- `tests/views/pivot/FeatureCatalogCompleteness.test.ts` -- Completeness guard: stub count target 10 -> 0, 10 new IDs in implemented list
- `tests/views/pivot/SuperSize.test.ts` -- Reference pattern for plugin unit tests with mock RenderContext
- `tests/views/pivot/SuperStackCatalog.test.ts` -- Reference for shared-state plugin behavioral tests

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PluginRegistry.notifyChange()` -- Triggers re-render for any plugin that modifies shared state
- `NOOP_FACTORY` sentinel with `__isNoopStub` brand -- getStubIds() detection (must reach 0)
- `registerCatalog()` function -- already has 17 real factories; 10 more setFactory() calls needed
- `FeaturePanel` reads `registry.getByCategory()` -- new plugins automatically appear in toggle UI
- `audit-colors.ts` -- Source provenance color palette (can reference values without importing class)

### Established Patterns
- Factory naming: `create{PluginName}Plugin` (e.g., createSuperDensityModeSwitchPlugin)
- One file per plugin in `src/views/pivot/plugins/`
- Shared state: plain objects/Maps created in registerCatalog(), passed to factory closures
- afterRender for DOM injection (toolbar UI, overlays, CSS class application)
- onPointerEvent returns boolean (true = consumed, stop propagation)
- TDD: behavioral test per plugin before registering factory (D-020)

### Integration Points
- `registerCatalog()` is the single wiring point -- all 10 new factories registered here
- PivotTable subscribes to `registry.onChange()` for re-renders triggered by density/selection changes
- Toolbar area above grid shared by: SuperZoomSlider, density mode-switch, search input
- CellPlacement.key used for selection Set membership and audit state lookups

</code_context>

<specifics>
## Specific Ideas

- All 4 categories follow the same self-contained pattern: own lightweight state, CSS classes on cells, no main app provider coupling
- Toolbar coexistence: density segmented buttons + search input + zoom slider all mount into the same toolbar area via afterRender
- CSS composability is key: .selected + .audit-new + .search-match must all work on the same cell simultaneously
- Lasso uses a CSS div overlay (not SVG) -- simpler for rectangular selection

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 102-new-plugin-wave*
*Context gathered: 2026-03-21*
