---
gsd_state_version: 1.0
milestone: v5.2
milestone_name: SuperCalc + Workbench Phase B
status: unknown
last_updated: "2026-03-10T15:44:06.929Z"
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 13
  completed_plans: 13
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** SuperGrid renders imported data through PAFV spatial projection with zero serialization -- sql.js queries directly feed D3.js data joins.
**Current focus:** Phase 68 complete — all 4 Tier 3 E2E flows covered. v5.2 milestone shipped.

## Current Position

Milestone: v5.2 SuperCalc + Workbench Phase B
Phase: 68 (E2E Critical-Path Tests Tier 3) — COMPLETE
Plan: 2 of 2 in current phase
Status: All 11 E2E specs passing. 4 Tier 3 flows covered. sql.js bind param bug fixed.
Last activity: 2026-03-10 — Plan 68-02 complete

Progress: [============] 100% of v5.2 (13/13 plans across 7 phases)

## Performance Metrics

**Velocity:**
- v5.1 milestone: 7 plans in 1 day (7 plans/day) -- Phases 58-61 complete
- v5.0 milestone: 11 plans in 1 day (11 plans/day) -- Phases 54-57 complete
- v4.4 milestone: 10 plans in 1 day (10 plans/day) -- Phases 49-52 complete
- v4.3 milestone: 2 plans in 1 day (2 plans/day)
- v4.2 milestone: 15 plans in 1 day (15 plans/day)
- v4.1 milestone: 12 plans in 1 day (12 plans/day)

*Updated after each plan completion*

## Accumulated Context

### Decisions

All TypeScript architectural decisions locked (D-001..D-010). Full logs in PROJECT.md.

v5.2-specific decisions:
- SQL DSL replaces HyperFormula permanently -- GROUP BY aggregation via supergrid:calc Worker query
- ui_state table for notebook persistence -- avoids schema migration and CloudKit merge complexity
- Two-pass DOMPurify + D3 mount for chart blocks -- never add SVG to sanitizer allowlist
- setRangeFilter() atomic replacement -- prevents compounding range filters on same field
- CalcExplorer uses direct bridge.send('ui:set') for calc:config persistence -- independent of StateManager PersistableProvider system
- NUMERIC_FIELDS = {priority, sort_order} -- date fields classified as text (COUNT+OFF only); text column safety net downgrades invalid agg modes to COUNT
- Grand total footer (one row at bottom) -- per-group inline footers deferred to future polish pass
- calcQuery() typed method on SuperGridBridgeLike (not generic send()) -- narrow interface principle
- CalcExplorer wired via setCalcExplorer() setter -- SuperGrid created by factory before CalcExplorer exists
- execCommand('insertText') with contentEditable trick for undo-safe textarea formatting (GitHub markdown-toolbar-element pattern)
- Explicit _content sync after every formatting operation (execCommand may not fire input event in all WebKit versions)
- Direct bridge.send('ui:set') for notebook persistence (not StateManager) -- per-card keys don't fit one-key-per-provider model
- NotebookExplorer subscribes to SelectionProvider directly via config injection -- follows CalcExplorer pattern
- _scheduleSave called from _undoSafeInsert -- ensures formatting toolbar actions persist (execCommand may skip input event)
- Simple key:value parser for chart config (no YAML library) -- flat pairs with no nesting
- Discriminated union response { type: 'labeled' } | { type: 'xy' } for chart:query handler
- y defaults to 'count' for bar/line when omitted -- most common chart use case
- ChartRenderer query generation counter discards stale results from concurrent filter changes
- Tooltip as absolute-positioned div on container (not SVG) -- avoids clipping, enables CSS transitions
- Chart stub (.notebook-chart-preview) replaced by inline chart cards via marked renderer extension
- [Phase 66]: Range filters use Map<string, RangeFilter> for O(1) atomic replacement, compile after axis filters before FTS
- [Phase 66]: validateFilterField() for histogram field validation -- includes date columns (due_at, created_at) not all in axis allowlist
- [Phase 66]: CASE WHEN bin index with parameterized MIN/MAX/width -- single SQL round-trip for numeric histograms
- [Phase 68]: SQL ground truth for all E2E card count assertions -- never count DOM cells for data integrity checks
- [Phase 68]: db.prepare() for ALL parameterized SQL in Worker context -- db.exec()/db.run() silently ignore bind params
- [Phase 68]: Use data-level attribute counting for multi-level header assertion (not total header count)
- [Phase 67]: ChipDatum {value, count} with GROUP BY COUNT query for single round-trip chip data fetch
- [Phase 67]: D3 button.latch-chip join for chip rendering with enter/update/exit lifecycle

### Roadmap Evolution

- Phase 68 added: E2E Critical-Path Tests Tier 3

### Pending Todos

None.

### Blockers/Concerns

- CSS content-visibility: auto requires Safari 18+ (iOS 18+) -- iOS 17 users get JS windowing only
- FeatureGate bypassed in DEBUG builds -- test tier gates before release

### UAT Issues (Phase 68 resolution)

1. ~~Column resize hides card title text~~ — FIXED (min-width: 0 on .sg-cell)
2. ~~Counts wrong — both column footers show 85~~ — FIXED (per-column GROUP BY in calc query)
3. ~~Chart values ≠ SuperGrid values~~ — FIXED (same root cause as #2)
4. ~~Grid view spacing is strange~~ — FIXED (12px CELL_GAP between GridView SVG tiles)
5. Kanban shows as flat list — EXPECTED BEHAVIOR (Apple Notes data has no status field)
6. ~~Bar chart disappears on Network node click~~ — FIXED (exclusive select instead of toggle)

## Session Continuity

Last session: 2026-03-10
Stopped at: Created 67-01-SUMMARY.md (retroactive documentation for category chips plan)
Resume: v5.2 milestone complete. Plan next milestone or polish pass.
