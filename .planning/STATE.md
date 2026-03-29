---
gsd_state_version: 1.0
milestone: v10.1
milestone_name: Time Hierarchies
status: roadmap-ready
stopped_at: null
last_updated: "2026-03-29"
last_activity: 2026-03-29
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-29)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v10.1 Time Hierarchies — Phase 136 next

## Current Position

Phase: 136 (SQL Time Bucketing) — Not started
Plan: —
Status: Roadmap defined, ready for planning
Last activity: 2026-03-29 — v10.1 roadmap created (4 phases, 13 requirements)

Progress: [░░░░░░░░░░] 0%

## Milestone History

- ✅ v9.0 Graph Algorithms: Phases 114-119 complete (6 phases, 13 plans, 23 reqs)
- ✅ v9.1 Ship Prep: Phases 120-122 complete (3 phases, 8 plans, TestFlight-ready)
- ✅ v9.2 Alto Index Import: Phases 123-126 complete (4 phases, 7 plans, 13 reqs)
- ✅ v9.3 View Wiring Fixes: Phases 127-129 complete (3 phases, 6 plans, 18 reqs)
- 🚧 v10.0 Smart Defaults + Layout Presets: Phases 130-135 (5/6 phases, 12/13 plans, 27 reqs — Phase 135 UAT in progress)
- 📋 v10.1 Time Hierarchies: Phases 136-139 (0/4 phases, 0 plans, 13 reqs — roadmap defined)

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

Key v10.1 architectural constraints:

- **SQL bucketing**: `COALESCE(strftime('%Y-%m', field), '__NO_DATE__') AS field` pattern in SELECT and GROUP BY — sentinel replaced with "No Date" in rendering layer, never in SQL
- **Time field detection**: SchemaProvider.getFieldsByFamily('Time') builds the timeFields set passed to compileAxisExpr() — non-time axes never wrapped in strftime()
- **Auto-default granularity**: SuperDensityProvider axisGranularity null + time axis present → default to 'month' automatically
- **NULL sort ordering**: "No Date" bucket sorts last regardless of direction — use CASE WHEN sentinel trick in ORDER BY
- **D3 formatting**: d3.utcFormat (not d3.timeFormat) for consistent UTC-based label generation; `import * as d3 from 'd3'` — no named sub-package imports
- **Timeline time field**: configurable via existing axis state — not hardcoded to due_at
- **FilterProvider range filter**: existing setRangeFilter(field, min, max) already handles ISO string comparison — TFLT-01 is largely a test/confirmation requirement
- **No facets table**: use SchemaProvider LATCH family classification (latchFamily: 'Time') — no new SQL tables or migration files
- **No expression indexes**: only add if profiling shows need; existing indexes on created_at strftime patterns already present

Key v10.0 architectural constraints (carried forward):

- Per-dataset ui_state namespacing (Phase 130) is load-bearing prerequisite for all other phases
- ViewDefaultsRegistry is a static Map — no database, no migrations, compile-time constants
- Preset serialization: Record<storageKey, boolean> keyed dict (not array) for forward compat
- driver.js (MIT) for tour; @floating-ui/dom for preset picker positioning
- All axis defaults routed through SchemaProvider.isValidColumn() before apply
- Tour uses data-tour-target selector anchoring — never holds live DOM references
- Preset keys namespace: `preset:name:{presetName}` — StateManager.registerProvider() rejects `preset:` prefix
- First-import defaults flag-gated by `view:defaults:applied:{datasetId}`
- [Phase 130]: Guard on coordinator.subscribe callback (not _fetchAndRender) so direct internal calls still work while blocking externally-triggered re-renders during switchTo()
- [Phase 130-foundation]: Scoped keys use {providerKey}:{datasetId} format in ui_state table; initActiveDataset() is synchronous boot-time setter; setActiveDataset() handles full persist-reset-restore lifecycle
- [Phase 131-supergrid-defaults]: applySourceDefaults lives on PAFVProvider (not standalone) to centralize axis-setting with existing setColAxes/setRowAxes
- [Phase 131-supergrid-defaults]: resolveDefaults validates every axis candidate through SchemaProvider.isValidColumn (SGDF-02 invariant)
- [Phase 131]: getSourceType optional on ProjectionExplorerConfig — footer not rendered when absent for backward compat
- [Phase 131]: First-import flag view:defaults:applied:{datasetId} uses bridge.send ui:get/ui:set directly (not StateManager)
- [Phase 132-01]: viewConfig must apply in .then() after switchTo() because setViewType resets axes to VIEW_DEFAULTS
- [Phase 132-01]: 500ms delay on auto-switch toast ensures import-success toast displays first (sequential not stacked)
- [Phase 132-02]: Badge appended to button element, title on button not badge span — follows project tooltip pattern and UI-SPEC accessibility
- [Phase 133]: LayoutPresetManager accepts injected getSectionStates/restoreSectionStates callbacks (not WorkbenchShell) to decouple preset layer from DOM
- [Phase 133]: promptForInput method on CommandPalette reuses existing input for preset naming — no browser dialog
- [Phase 133]: refreshCommands() internal closure unregisters preset:* prefix and re-registers from listAll() after save/delete
- [Phase 133]: CallbackMutation union type enables undo/redo for UI-only operations without SQL or dirty flag
- [Phase 133]: PresetSuggestionToast forward-declared with let null in main.ts before handleDatasetSwitch, per established main.ts pattern
- [Phase 134]: driver.js Driver.refresh() for reposition; moveTo(i) to advance past missing targets in handleViewSwitch
- [Phase 134]: data-tour-target anchors added as surgical setAttribute on existing elements: pv-root, pv-density-toolbar, nav, CollapsibleSection roots, CommandBar app-icon
- [Phase 134]: TourPromptToast CSS class names use __action--start/__action--dismiss (matching tour.css from Plan 01), not __start/__dismiss as in plan spec
- [Phase 134]: Restart Tour registered in Help category (new CommandRegistry union member), tour:prompted written immediately before setTimeout delay per D-10
- [Phase 135-uat]: Fixed double-apply bug in presetCommands.ts: use captureCurrentState for prev state, route single apply through mutationManager forward callback

### Blockers/Concerns

None. v10.1 requirements fully specified. All implementation targets (SuperGridQuery.ts, SuperDensityProvider, FilterProvider, TimelineView) identified.

## Session Continuity

Last session: 2026-03-29
Stopped at: v10.1 roadmap creation
Resume: `/gsd:plan-phase 136`
