---
gsd_state_version: 1.0
milestone: v13.0
milestone_name: SuperWidget Substrate
status: planning
stopped_at: Phase 162 context gathered
last_updated: "2026-04-21T05:32:20.615Z"
last_activity: 2026-04-21 — Roadmap written for v13.0
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-21)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** v13.0 SuperWidget Substrate — Phase 162 (Substrate Layout) is next

## Current Position

Phase: 162 (Substrate Layout) — Not started
Plan: —
Status: Roadmap complete, ready to plan Phase 162
Last activity: 2026-04-21 — Roadmap written for v13.0

Progress: [░░░░░░░░░░] 0% (0/5 phases)

## v13.0 Phase Map

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 162 | Substrate Layout | SLAT-01..07 | Not started |
| 163 | Projection State Machine | PROJ-01..07 | Not started |
| 164 | Projection Rendering | RNDR-01..05 | Not started |
| 165 | Canvas Stubs + Registry | CANV-01..07 | Not started |
| 166 | Integration Testing | INTG-01..07 | Not started |

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-020). Full logs in PROJECT.md.

- [v13.0 Handoff]: SuperWidget follows TypeScript class with mount(container)/destroy() lifecycle pattern
- [v13.0 Handoff]: Four slots (header, canvas, status, tabs) — config is child of tabs with data-tab-role="config"
- [v13.0 Handoff]: Bound = View-only canvas split with Explorer sidecar; defaultExplorerId on Canvas registry
- [v13.0 Handoff]: Status slot always present, zero-height when empty; first tenant is Integrate ingestion counts (v13.1)
- [v13.0 Handoff]: All tests under tests/superwidget/ — no colocated tests in src/
- [v13.0 Handoff]: CSS Grid for substrate layout; horizontal scroll with edge fade for tab overflow
- [v13.0 Handoff]: Projection state machine as pure functions in projection.ts — no DOM coupling
- [v13.0 Roadmap]: --sw-* CSS custom property namespace for all SuperWidget tokens (mirrors --sg-* and --pv-* precedents)
- [v13.0 Roadmap]: Reference equality contract on no-op transitions is load-bearing for render bail-out logic
- [v13.0 Roadmap]: Canvas registry is the plug-in seam — SuperWidget.ts must contain zero concrete stub class references (CANV-06)
- [v13.0 Roadmap]: Stubs are explicitly labeled for replacement in v13.1+ to prevent accidental promotion
- [v13.0 Roadmap]: Phase 166 Playwright WebKit smoke test is a CI hard gate (INTG-07)

### Critical Pitfalls (from research context)

- CSS Grid height collapse in flex chain: root element needs flex: 1 1 auto; min-height: 0 (SLAT-07)
- No-op reference returns: switchTab/setBinding/toggleTabEnabled must return the same object reference, not a structurally equal copy — bail-out rendering depends on this
- Registry abstraction leak: SuperWidget.ts must import only the CanvasComponent interface, never concrete stub classes (CANV-06)
- Slot-scoped re-renders: only the canvas slot's data-render-count should increment on tab switch; other slots must remain stable (RNDR-03)

### Pending Todos

(None)

### Blockers/Concerns

- Phase 150 (iOS Stories Splash): Deferred — Stories platform split is a product decision that must be resolved before scope is written.

## Session Continuity

Last session: 2026-04-21T05:32:20.613Z
Stopped at: Phase 162 context gathered
Resume with: `/gsd:plan-phase 162`
