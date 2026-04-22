---
gsd_state_version: 1.0
milestone: v14.0
milestone_name: Horizontal Ribbon Navigation
status: Roadmap ready
stopped_at: Phase 179 UI-SPEC approved
last_updated: "2026-04-22T22:41:07.036Z"
last_activity: 2026-04-22 — Roadmap created for v14.0
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-22)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v14.0 Horizontal Ribbon Navigation — Phase 179 next

## Current Position

Phase: 179 (Dock Wiring Repair) — not started
Plan: —
Status: Roadmap ready
Last activity: 2026-04-22 — Roadmap created for v14.0

```
Progress: [░░░░░░░░░░░░░░░░░░░░] 0% (0/3 phases)
```

## Performance Metrics

- Phases shipped across all milestones: 178
- Current milestone phases: 3 (179-181)
- Requirements this milestone: 19 (WIRE-01..06, HRIB-01..07, STOR-01..03, DSET-01..03)

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

**v13.0-v13.3 key constraints (carry forward):**

- CANV-06: SuperWidget.ts must have zero import references to any canvas -- registry plug-in seam only
- Tab switching goes through commitProjection / activeTabId on Projection -- no direct canvas method calls from SuperWidget
- Status slot updates are slot-scoped -- no canvas re-render triggered by count changes
- Wrapper-div isolation: ViewManager's container must be an inner div, never _canvasEl directly
- destroy-before-mount ordering must hold under rapid switching

**v14.0 key constraints:**

- Fix wiring before restructuring layout -- Phase 179 must pass before Phase 180 touches CSS
- PanelManager/sidecar wiring must survive the CSS grid change in Phase 180
- DockNav.ts (440 lines), section-defs.ts, dock-nav.css, superwidget.css, and main.ts onActivateItem handler are the files in scope
- SuperWidget CSS grid: remove sidebar column, add ribbon row(s) between tabs and canvas
- Keyboard nav direction flips: ArrowUp/Down (vertical) → ArrowLeft/Right (horizontal) for ARIA tablist
- Stub ribbon rows (STOR, DSET) are purely presentational -- no wiring, no state, no click handlers

### Blockers/Concerns

- Phase 150 (iOS Stories Splash): Deferred -- Stories platform split is a product decision that must be resolved before scope is written.

### TODOs

- [ ] Audit DockNav.ts onActivateItem to identify exactly which click paths are broken before Phase 179 planning

## Session Continuity

Last session: 2026-04-22T22:41:07.032Z
Stopped at: Phase 179 UI-SPEC approved
Resume with: `/gsd:plan-phase 179`
