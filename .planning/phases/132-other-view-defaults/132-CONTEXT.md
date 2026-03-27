# Phase 132: Other View Defaults - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend ViewDefaultsRegistry for non-SuperGrid views. Five source types get a single recommended view (Timeline, Tree, or Network) with view-specific configuration. SidebarNav shows ✦ recommendation badges. First import auto-switches to the recommended view with an explanatory toast. Four requirements: OVDF-01 through OVDF-04.

</domain>

<decisions>
## Implementation Decisions

### View-to-Source Mappings
- **D-01:** Hand-curated, 1 recommended view per source type. Matches Phase 131 approach (D-01).
- **D-02:** Mapping table:
  - `native_calendar` → Timeline (date-centric events)
  - `native_reminders` → Timeline (date-centric tasks)
  - `apple_notes` → Tree (folder hierarchy)
  - `native_notes` → Tree (folder hierarchy)
  - `alto_index` → Network (cross-entity relationships)
  - `markdown`, `excel`, `csv`, `json`, `html` → no recommendation (SuperGrid is already best)
- **D-03:** Source types without a recommendation get no badge and no auto-switch. SuperGrid defaults from Phase 131 are sufficient.

### Badge Presentation
- **D-04:** Static ✦ glyph appended after the view label in SidebarNav (e.g., "Timeline ✦"). Appears/disappears dynamically when dataset changes.
- **D-05:** Brief tooltip via `title` attribute explaining the recommendation (e.g., "Recommended for calendar data").
- **D-06:** No animation, no first-time toast — simple and non-intrusive.

### Auto-Switch Behavior
- **D-07:** On first import, auto-switch to the recommended view if one exists. Explanatory toast: "Switched to Timeline — best view for calendar data."
- **D-08:** Same `view:defaults:applied:{datasetId}` flag gate as Phase 131. Both SuperGrid axis defaults and view auto-switch fire in the same first-import window. One flag, one gate.
- **D-09:** Auto-switch fires only once per dataset (OVDF-04). Manually switching away does not re-trigger.

### Non-SuperGrid Defaults Scope
- **D-10:** View-specific configuration per source type — extends beyond axes-only (Phase 131 D-03). Each recommended view gets whatever config makes it useful: Timeline gets date sort, Tree gets relevant hierarchy, Network gets connection focus.
- **D-11:** New `ViewRecommendation` interface separate from `DefaultMapping`. Includes: `recommendedView` (ViewType), `viewConfig` (view-specific sort/groupBy/filter), and retains `colAxes`/`rowAxes` for SuperGrid fallback. Clean separation — `DefaultMapping` stays SuperGrid-specific.

### Claude's Discretion
- Specific `viewConfig` fields per view type (what sort field for Timeline, what groupBy for Tree, etc.) — Claude determines based on each view's rendering needs
- How `ViewRecommendation` is stored — same Map, parallel Map, or combined registry
- Toast message wording and duration
- SidebarNav update mechanism (callback, event, or direct DOM mutation on dataset change)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture
- `CLAUDE-v5.md` — Canonical architectural decisions D-001 through D-010 (especially D-005: three-tier persistence)
- `.planning/PROJECT.md` — Project-level decisions and constraints

### Phase 131 Foundation (prerequisite)
- `.planning/phases/131-supergrid-defaults/131-CONTEXT.md` — SuperGrid defaults decisions (D-01..D-07), DefaultMapping interface, resolveDefaults() pattern
- `src/providers/ViewDefaultsRegistry.ts` — Existing registry with DefaultMapping, resolveDefaults(), VIEW_DEFAULTS_REGISTRY frozen Map

### Core Modules
- `src/providers/PAFVProvider.ts` — `applySourceDefaults()` (line 308), VIEW_DEFAULTS, setViewType()
- `src/providers/SchemaProvider.ts` — `isValidColumn()` for axis validation
- `src/views/ViewManager.ts` — `switchTo()` lifecycle, VIEW_EMPTY_MESSAGES, ViewManagerConfig

### SidebarNav
- `src/ui/SidebarNav.ts` — SECTION_DEFS with Visualization Explorer items (9 views), SidebarItemDef interface, SidebarNavConfig callbacks

### Import Flow
- `src/main.ts` — Lines 1437-1488: first-import flag gate wiring for both file and native import paths, `view:defaults:applied:{datasetId}` convention

### View Types
- `src/views/types.ts` — ViewType union, IView interface
- `src/providers/types.ts` — AxisMapping, ViewType definitions

### Requirements
- `.planning/REQUIREMENTS.md` — OVDF-01 through OVDF-04 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ViewDefaultsRegistry.resolveDefaults()` — Fallback resolution pattern with SchemaProvider validation; extend for view recommendations
- `PAFVProvider.applySourceDefaults()` — Already called in main.ts post-import; hook auto-switch adjacent to this call
- `SidebarNav.SECTION_DEFS` — Static section definitions; badge requires dynamic update mechanism (currently none exists)
- `ImportToast` — Existing toast pattern for import feedback; auto-switch toast follows same UX

### Established Patterns
- First-import flag gate: `view:defaults:applied:{datasetId}` key in ui_state via `ui:set`/`ui:get` bridge messages
- Static frozen Map registry: compile-time constants, no database overhead
- Provider subscription: `subscribe(callback) => unsubscribe` for reactive updates
- `title` attribute for tooltips throughout the codebase

### Integration Points
- `src/main.ts` (lines 1440-1488) — Post-import hook where auto-switch + toast fires alongside existing axis defaults
- `src/ui/SidebarNav.ts` — View items in Visualization Explorer section need dynamic badge injection
- `src/views/ViewManager.ts` — `switchTo()` is the view change entry point; auto-switch calls this
- `src/ui/WorkbenchShell.ts` — Orchestrates SidebarNav and ViewManager; may need to bridge dataset-change events to SidebarNav

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

*Phase: 132-other-view-defaults*
*Context gathered: 2026-03-27*
