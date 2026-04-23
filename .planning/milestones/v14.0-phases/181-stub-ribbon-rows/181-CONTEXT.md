# Phase 181: Stub Ribbon Rows - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Two additional ribbon rows (Stories and Datasets) appear below the navigation ribbon as visible-but-disabled placeholders, communicating future capability without allowing interaction. Purely presentational — no wiring, no state, no click handlers.

</domain>

<decisions>
## Implementation Decisions

### Row Placement
- **D-01:** Separate CSS grid rows — add `stories` and `datasets` named grid areas to `superwidget.css` grid-template, with dedicated slot elements created in `SuperWidget.ts` (e.g., `_storiesRibbonEl`, `_datasetsRibbonEl`).
- **D-02:** Grid row order: header → tabs → ribbon → stories → datasets → canvas → status (sidecar spans all).

### Disabled Visual Treatment
- **D-03:** Muted color + reduced opacity + `cursor: not-allowed` on all stub items. No tooltips, no "Coming Soon" badges, no extra UI elements.
- **D-04:** No click handlers attached — `pointer-events: none` or simply no event delegation on stub rows.

### Placeholder Labels
- **D-05:** Exact item labels are Claude's discretion. Labels should differentiate from existing nav ribbon items (avoid duplicating "Data", "Filters", etc.). Requirements give examples ("New Story", "Play", "Share" / "Import", "Export", "Browse") as guidance, not prescriptive.

### Row Density
- **D-06:** Stub rows match nav ribbon height at 56px each. All three ribbon rows are visual peers with consistent height.

### Claude's Discretion
- Exact placeholder item labels and Lucide icon choices for Stories and Datasets rows
- Whether stub rows reuse `dock-nav.css` classes or get a separate `stub-ribbon.css`
- Whether stub row DOM is generated from a data definition array (like `DOCK_DEFS`) or hardcoded
- Section header label treatment (whether stubs show "STORIES" / "DATASETS" headers above items like the nav ribbon does)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Layout Grid
- `src/styles/superwidget.css` lines 1-68 — CSS Grid layout with current `ribbon` area; must add `stories` and `datasets` rows to grid-template
- `src/superwidget/SuperWidget.ts` — Creates slot elements; must add `_storiesRibbonEl` and `_datasetsRibbonEl` with `data-slot` attributes

### Navigation Ribbon (pattern reference)
- `src/ui/DockNav.ts` — Horizontal ribbon bar implementation; pattern for DOM structure, class naming, icon rendering
- `src/ui/section-defs.ts` — `DOCK_DEFS` array driving nav ribbon items; potential pattern for stub item definitions
- `src/styles/dock-nav.css` — Ribbon styling; reference for consistent visual treatment
- `src/ui/icons.ts` — `iconSvg()` for Lucide icon rendering

### Prior Phase Context
- `.planning/phases/180-horizontal-ribbon-layout/180-CONTEXT.md` — Phase 180 decisions on ribbon layout, section headers, scroll overflow, active state

### Requirements
- `.planning/REQUIREMENTS.md` lines 29-39 — STOR-01..03, DSET-01..03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `iconSvg()` from `icons.ts` — same Lucide icon rendering used in nav ribbon
- `DOCK_DEFS` pattern in `section-defs.ts` — data-driven item definitions; stub rows could follow the same pattern
- `dock-nav.css` class naming convention — `.dock-nav__item`, `.dock-nav__item-icon`, `.dock-nav__item-label`

### Established Patterns
- SuperWidget CSS Grid with named areas and `data-slot` attributes
- DockNav event delegation (single click handler on nav element)
- Section header labels above item groups (Phase 180 D-02)
- Design tokens: `--bg-surface`, `--border-subtle`, `--text-muted`, `--space-*`, `--text-sm`, `--text-xs`

### Integration Points
- `superwidget.css` grid-template — add two new rows between `ribbon` and `canvas`
- `SuperWidget.ts` — create and expose two new slot elements
- No mount point wiring needed in `main.ts` — stub rows are self-contained (no DockNav instance, no callbacks)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard disabled ribbon rows following the existing DockNav visual pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 181-stub-ribbon-rows*
*Context gathered: 2026-04-22*
