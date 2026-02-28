---
phase: 06-time-visual-views
plan: 01
subsystem: ui
tags: [d3, calendar, density-provider, html-css-grid, time-axis]

# Dependency graph
requires:
  - phase: 05-core-d3-views-transitions
    provides: IView interface, CardDatum type, CardRenderer (renderHtmlCard), DensityProvider integration patterns
  - phase: 04-providers-mutationmanager
    provides: DensityProvider with getState()/subscribe(), TimeGranularity type

provides:
  - CalendarView class implementing IView (mount/render/destroy) with 5 granularity modes
  - CardDatum expanded with due_at and body_text fields (unblocks all three Phase 6 views)
  - toCardDatum() updated to map due_at and body_text from Worker response rows

affects:
  - 06-time-visual-views/06-02 (TimelineView needs due_at field already added)
  - 06-time-visual-views/06-03 (GalleryView needs body_text field already added)
  - All future views that construct CardDatum objects in tests (must include due_at/body_text)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - CalendarView uses _buildStructure() for DOM rebuild on granularity change, _bindCards() for data rebind only
    - Date matching uses string slicing (card.due_at.slice(0, 10)) not Date object local timezone methods
    - CalendarView tracks lastGranularity to detect structural change vs data-only rebind
    - Mini-month containers (div.mini-month) for quarter/year views — no card chips in mini views
    - test dates must match CalendarView's initialized month (use new Date() in tests, not hardcoded month)

key-files:
  created:
    - src/views/CalendarView.ts
    - tests/views/CalendarView.test.ts
  modified:
    - src/views/types.ts (due_at + body_text added to CardDatum + toCardDatum())
    - tests/views/GridView.test.ts (makeCards factory updated with null defaults)
    - tests/views/ListView.test.ts (inline CardDatum objects updated with null defaults)
    - tests/views/KanbanView.test.ts (makeCard factory updated with null defaults)
    - tests/views/transitions.test.ts (makeCard factory and inline objects updated)
    - tests/views/ViewManager.test.ts (makeCard factory updated with null defaults)

key-decisions:
  - "CalendarView initializes to current date via new Date() — tests use dynamic current-month dates, not hardcoded month strings, to ensure cell existence"
  - "CalendarView does NOT auto-navigate to card dates on render — user controls period via prev/next nav"
  - "Quarter/year mini-month views do not bind card chips — structural overview only; card chips are month/week/day granularity only"
  - "Due_at field expansion is additive (required field with null default) — all existing test CardDatum factories updated to include due_at: null, body_text: null"

patterns-established:
  - "Structural rebuild pattern: CalendarView._buildStructure(granularity) clears and rebuilds DOM; _bindCards() adds data to existing cells — separation of structure and data"
  - "Granularity change detection: compare granularity !== lastGranularity in render() to decide structure rebuild vs data-only update"

requirements-completed:
  - VIEW-04

# Metrics
duration: 6min
completed: 2026-02-28
---

# Phase 6 Plan 01: CalendarView + CardDatum Expansion Summary

**HTML/CSS Grid CalendarView with 5 granularity modes (month/week/day/quarter/year), DensityProvider integration, and CardDatum expanded with due_at and body_text fields**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-28T22:05:40Z
- **Completed:** 2026-02-28T22:11:56Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 8

## Accomplishments
- Expanded CardDatum with `due_at: string | null` and `body_text: string | null` (unblocks Calendar, Timeline, Gallery views)
- CalendarView implements IView (mount/render/destroy) with full DensityProvider integration
- Month granularity: 7-column CSS Grid, correct first-day offset via `new Date(year, month, 1).getDay()`, card chips via renderHtmlCard(), +N more overflow at MAX_CHIPS=2
- Week/day granularity: 7-cell single-week and single-day views
- Quarter/year granularity: 3 and 12 mini-month containers respectively
- Navigation prev/next controls update displayed period and rebuild grid
- Cards with null due_at filtered from calendar display
- Updated all 5 existing test files to include new CardDatum null defaults (no regressions: 743 tests passing)

## Task Commits

1. **Task 1: Expand CardDatum with due_at and body_text fields** - `fecb281` (feat)
2. **Task 2: Implement CalendarView with DensityProvider granularity integration** - `bd79536` (feat)

## Files Created/Modified
- `src/views/types.ts` - CardDatum expanded with due_at and body_text; toCardDatum() maps both fields
- `src/views/CalendarView.ts` - New: Full CalendarView implementation (342 lines)
- `tests/views/CalendarView.test.ts` - New: 16 tests covering all granularities, overflow, NULL filtering, navigation, destroy
- `tests/views/GridView.test.ts` - makeCards() factory updated with due_at/body_text null defaults
- `tests/views/ListView.test.ts` - Inline CardDatum objects updated with null defaults
- `tests/views/KanbanView.test.ts` - makeCard() factory updated with null defaults
- `tests/views/transitions.test.ts` - makeCard() factory and inline bridge mock updated
- `tests/views/ViewManager.test.ts` - makeCard() factory updated with null defaults

## Decisions Made

1. **CalendarView initializes to current date** - Tests must use `new Date()` to get current month dates, not hardcoded month strings like `2026-03-15`, because the view renders the current period and test cells only exist for the initialized month.

2. **CalendarView does not auto-navigate to card dates** - User controls period explicitly via prev/next navigation. This keeps the view predictable and avoids jumping on every render call.

3. **Mini-month views (quarter/year) show no card chips** - Structural overview only. Card chips are only rendered in month/week/day granularity cells. This avoids DOM explosion for quarter/year views with many cards.

4. **CardDatum expansion is additive (required, not optional)** - Both due_at and body_text are required fields (not optional) with null as the explicit value. This ensures TypeScript catches any missing field rather than silently defaulting. All existing test factories were updated to include the null defaults.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was making test dates dynamic (using `new Date()` to determine current month) rather than hardcoded March 2026 dates, since CalendarView correctly initializes to the current period.

## Issues Encountered
- Initial tests used hardcoded `2026-03-15` dates but CalendarView initializes to current date (Feb 2026). Fixed by using `new Date()` in tests to compute current-month dates. Not a deviation — the plan correctly specified that CalendarView should initialize to current date.

## Next Phase Readiness
- due_at and body_text fields are ready for TimelineView (06-02) and GalleryView (06-03)
- CalendarView is complete and tested
- DensityProvider integration pattern established for CalendarView — same pattern applies to TimelineView
- 743 tests passing, TypeScript clean

---
*Phase: 06-time-visual-views*
*Completed: 2026-02-28*
