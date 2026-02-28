---
phase: 06-time-visual-views
plan: "03"
subsystem: views
tags: [timeline, d3, scaleUtc, swimlanes, transitions, barrel-exports]
dependency_graph:
  requires:
    - "06-01"  # CalendarView + CardDatum expansion (due_at, body_text)
    - "06-02"  # GalleryView
  provides:
    - TimelineView (SVG d3.scaleUtc timeline with swimlanes)
    - transitions SVG_VIEWS += timeline
    - transitions HTML_VIEWS += calendar, gallery
    - CalendarView, TimelineView, GalleryView barrel exports
  affects:
    - src/views/transitions.ts
    - src/views/index.ts
    - src/index.ts
tech_stack:
  added: []
  patterns:
    - d3.scaleUtc() horizontal time axis
    - d3.axisBottom() tick rendering
    - d3.group() swimlane grouping
    - computeSubRows() greedy sub-row packing for overlap detection
    - g.card CSS class (morph-compatible) with key function d => d.id
key_files:
  created:
    - src/views/TimelineView.ts
    - tests/views/TimelineView.test.ts
  modified:
    - src/views/transitions.ts
    - tests/views/transitions.test.ts
    - src/views/index.ts
    - src/index.ts
decisions:
  - TimelineView uses fixed CARD_WIDTH=80px for point-in-time cards — multi-day bar spans deferred to future plan
  - computeSubRows() extracted as pure exported function for testability — greedy first-fit algorithm
  - d3 transform transitions skipped on g.card (only opacity animated) — avoids parseSvg jsdom crash per Phase 5 decision
  - g.card CSS class (not 'timeline-card') is mandatory for morphTransition compatibility with list/grid
  - SVG_VIEWS set now includes 'timeline' — enables shouldUseMorph for list<->timeline and grid<->timeline
  - HTML_VIEWS set now includes 'calendar' and 'gallery' — both render HTML, not SVG
metrics:
  duration: "4 minutes"
  completed: "2026-02-28"
  tasks: 2
  files: 6
---

# Phase 6 Plan 03: TimelineView + Transitions + Barrel Exports Summary

**One-liner:** SVG timeline view with d3.scaleUtc() horizontal axis, swimlane grouping, and sub-row stacking for overlapping cards; transitions updated for timeline/calendar/gallery; all three Phase 6 views wired into barrel exports.

## What Was Built

### Task 1: TimelineView (TDD)

`src/views/TimelineView.ts` implements `IView` with:

- `mount()` creates SVG with `g.timeline-axis` (at `translate(120, 40)`) and `g.swimlanes` groups
- `render()` filters null `due_at`, builds `d3.scaleUtc()` from date extent, calls `d3.axisBottom()` for ticks
- Cards grouped into swimlane rows via `d3.group()` by `groupByField` (default: `'status'`)
- `computeSubRows()` (pure, exported) uses greedy first-fit algorithm to pack overlapping cards into sub-rows
- Each `g.card` uses CSS class `'card'` (not `'timeline-card'`) + key function `d => d.id` for morph compatibility
- SVG height is dynamically set: `AXIS_HEIGHT + sum(numSubRows * SWIMLANE_HEIGHT)` per lane
- `destroy()` unsubscribes from `DensityProvider` if provided, removes SVG, nulls all references
- Constants: `LABEL_COL_WIDTH=120`, `AXIS_HEIGHT=40`, `SWIMLANE_HEIGHT=60`, `CARD_WIDTH=80`, `CARD_HEIGHT=48`

12 TDD tests: mount structure, card rendering, x-positioning, swimlane grouping, swimlane labels, null filtering, overlap stacking, axis ticks, height adjustment, morph class, destroy, density provider subscription.

### Task 2: Transitions + Barrel Exports (TDD)

**`src/views/transitions.ts` changes:**
- `SVG_VIEWS`: `['list', 'grid']` → `['list', 'grid', 'timeline']`
- `HTML_VIEWS`: `['kanban']` → `['kanban', 'calendar', 'gallery']`
- No logic changes needed — `shouldUseMorph()` already uses set membership

**9 new tests in `tests/views/transitions.test.ts`:**
- `list -> timeline`, `grid -> timeline`, `timeline -> list`, `timeline -> grid`: all return `true`
- `calendar -> list`, `gallery -> grid`, `calendar -> gallery`: all return `false`
- `timeline -> kanban` (SVG→HTML): `false`
- `calendar -> network` (LATCH→GRAPH): `false`

**Barrel exports added:**
- `src/views/index.ts`: `+ CalendarView, TimelineView, GalleryView`
- `src/index.ts`: `+ CalendarView, TimelineView, GalleryView` in Views section

## Verification Results

1. `npx tsc --noEmit` — PASS (0 errors)
2. `npx vitest --run tests/views/TimelineView.test.ts` — 12/12 PASS
3. `npx vitest --run tests/views/transitions.test.ts` — 21/21 PASS (all new cases green)
4. `npx vitest --run tests/views/` — 127/127 PASS
5. `npx vitest --run` — 774 PASS, 26 skipped (no regressions)
6. `g.card` class confirmed in tests (not `'timeline-card'`)
7. `import { CalendarView, TimelineView, GalleryView } from './views'` resolves correctly
8. `shouldUseMorph('list', 'timeline')` = `true`; `shouldUseMorph('calendar', 'list')` = `false`

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `3c48fa1` — feat(06-03): implement TimelineView with d3.scaleUtc() and swimlane grouping
- `fb4936b` — feat(06-03): update transitions + barrel exports for all Phase 6 views

## Self-Check: PASSED
