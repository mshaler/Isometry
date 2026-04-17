---
gsd_state_version: 1.0
milestone: v11.1
milestone_name: Dock/Explorer Inline Embedding
status: executing
stopped_at: Phase 154 context gathered
last_updated: "2026-04-17T17:47:56.564Z"
last_activity: 2026-04-17
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 13
  completed_plans: 13
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-16)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 154 — regression-guard-hardening

## Current Position

Phase: 154
Plan: Not started
Status: Executing Phase 154
Last activity: 2026-04-17

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

*Updated after each plan completion*
| Phase 151-paneldrawer-removal-inline-container-scaffolding P01 | 10m | 2 tasks | 8 files |
| Phase 152-integrate-visualize-inline-embedding P01 | 15 | 2 tasks | 3 files |
| Phase 153-analyze-section-inline-embedding P01 | 6 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

Key v11.0 constraints carried forward:

- `"sectionKey:itemKey"` composite string convention is load-bearing — must not change
- WASM warm-up must remain unconditional in IsometryApp.task{} regardless of any UI state
- MinimapRenderer must be lazy-on-hover only — never subscribed to StateCoordinator
- View Transitions API is off-limits (requires Safari 18+, app targets iOS 17)
- html2canvas and html-to-image must not be used on WKWebView
- [Phase 145]: SECTION_DEFS, viewOrder, DOCK_DEFS centralized in src/ui/section-defs.ts as single source of truth
- [Phase 146]: Event delegation on nav element (single listener) per v6.0 performance pattern for DockNav
- [Phase 146]: Section keys: 'integrate' replaces 'data-explorer', 'visualize' replaces 'visualization' in main.ts onActivateItem callback
- [Phase 147]: Toggle button uses existing nav event delegation (closest check) rather than separate listener
- [Phase 148]: PafvAxes interface defined in MinimapRenderer.ts to avoid circular dependency
- [Phase 148]: setThumbnailDataSource callback pattern prevents DockNav subscribing to StateCoordinator directly
- [Phase 149-01]: PanelDrawer relocated into .workbench-main__content flex-row wrapper; icon strip hidden via display:none; dockToPanelMap routes dock items to PanelRegistry toggles
- [Phase 149-02]: globe icon added to icons.ts for MapsPanelStub (was missing from Lucide set)
- [Phase 149-02]: synthesize section re-added to DOCK_DEFS for maps stub dock entry

Key v11.1 constraints (to be validated during planning):

- PanelDrawer removal must not disturb existing explorer functionality — explorers move to inline slots, not disappear
- Top-slot container hosts Data Explorer, Properties Explorer, and Projections Explorer (with conditional logic for Projections)
- Bottom-slot container hosts LATCH Filters and Formulas Explorer
- LATCH Filters cross-view persistence is a state concern — FilterProvider must survive view switches (it already does; test that toggle state also survives)
- Formulas Explorer is a stub in v11.1 — real formula engine is deferred per Out of Scope
- [Phase 151]: top/bottom slot display:none set inline in JS (not CSS), matching prior data-explorer pattern
- [Phase 151]: main.ts panel toggle replaced with direct panelRegistry.enable/disable — no scrollToPanel (PanelDrawer presentation concern)
- [Phase 152]: setItemPressed separate from _setActive — navigation items use aria-selected, toggle items use aria-pressed
- [Phase 152]: Projections auto-visibility triggered in visualize branch, not via dock item — no manual toggle
- [Phase 153]: dockNav.setItemPressed calls placed in onActivateItem handler (not in show/hide functions) — matches Phase 152 integrate:catalog pattern
- [Phase 153]: analyze:filter and analyze:formula removed from dockToPanelMap — routed via inline bottom-slot show/hide, not PanelRegistry toggle

### Pending Todos

- Plan Phase 151: PanelDrawer Removal + Inline Container Scaffolding

### Blockers/Concerns

- Phase 150 (iOS Stories Splash): Deferred — Stories platform split (full-bleed view on iOS vs panel on macOS) is a product decision that must be resolved before Phase 150 scope is written.

## Session Continuity

Last session: 2026-04-17T16:21:28.874Z
Stopped at: Phase 154 context gathered
Resume file: .planning/phases/154-regression-guard-hardening/154-CONTEXT.md
