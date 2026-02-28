---
phase: 05-core-d3-views-transitions
plan: 03
subsystem: ui
tags: [d3, kanban, drag-drop, mutations, html5, jsdom]

# Dependency graph
requires:
  - phase: 05-01
    provides: IView contract, CardRenderer (renderHtmlCard), ViewManager, CardDatum type
  - phase: 04-providers-mutationmanager
    provides: MutationManager, updateCardMutation, MutationBridge interface
provides:
  - KanbanView HTML-based D3 kanban board with column grouping and drag-drop
  - updateCardMutation integration for undoable column changes (Cmd+Z)
  - jsdom DragEvent polyfill pattern for testing HTML5 drag events
affects: [05-04, 05-05, phase-6, phase-7]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - HTML div-based kanban board (not SVG) for HTML5 drag-drop compatibility
    - D3 data join with key function d => d.id on both column and card joins
    - columnDomain pre-computation for empty column rendering from static domain
    - onMutation callback injection for testable drag-drop without real SQL
    - dragSetup/dropSetup dataset guard flags to prevent duplicate event listeners on re-render
    - jsdom DragEvent polyfill class extending MouseEvent for test environment

key-files:
  created:
    - src/views/KanbanView.ts
    - tests/views/KanbanView.test.ts
  modified: []

key-decisions:
  - "KanbanView uses HTML divs (not SVG) — HTML5 drag-drop API requires draggable HTML elements; SVG elements do not participate in HTML5 DnD"
  - "d3.drag intentionally excluded — d3.drag intercepts dragstart and corrupts dataTransfer; use native addEventListener for HTML5 DnD"
  - "onMutation callback injected via constructor options — allows test injection without real SQL while default impl uses updateCardMutation for undo support"
  - "jsdom DragEvent polyfill extends MouseEvent — jsdom does not implement DragEvent natively; polyfill registered once at test module scope"
  - "dragSetup/dropSetup dataset guards prevent duplicate event listeners on re-render — D3 .each() re-runs on every render() call"
  - "Null status cards mapped to 'none' column via (d[groupByField] ?? 'none') — consistent column key for null values"

patterns-established:
  - "KanbanView pattern: HTML-based D3 view with column data join (string key) + card data join (d => d.id key)"
  - "Drag-drop mutation pattern: onMutation(cardId, newValue) → updateCardMutation → mutationManager.execute() for undo support"
  - "Test DragEvent pattern: polyfill DragEvent as MouseEvent subclass + Object.defineProperty for dataTransfer mock"

requirements-completed: [VIEW-03, VIEW-12]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 5 Plan 03: KanbanView Summary

**HTML-based D3 kanban board with column grouping, drag-drop between columns, and undoable mutations via updateCardMutation + MutationManager**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T21:23:53Z
- **Completed:** 2026-02-28T21:27:51Z
- **Tasks:** 2 (Task 1: column grouping + rendering, Task 2: drag-drop + MutationManager integration)
- **Files created:** 2

## Accomplishments
- KanbanView renders cards grouped alphabetically by status (or configurable field) as HTML div columns
- D3 data join with key function `d => d.id` used on both column-level and card-level joins (VIEW-09)
- Empty columns from pre-defined `columnDomain` still render with header + "No cards" empty state
- HTML5 drag-drop: cards draggable, columns accept drops, same-column drops are no-ops
- Drop fires `updateCardMutation` via `MutationManager.execute()` — fully undoable via Cmd+Z (MUT-03)
- jsdom DragEvent polyfill established for testing HTML5 drag events in Vitest

## Task Commits

Each task was committed atomically:

1. **Task 1+2 RED: KanbanView tests** - `b26f725` (test)
2. **Task 1+2 GREEN: KanbanView implementation** - `140a069` (feat)

_Note: TDD RED for both tasks committed together (tests for grouping + drag-drop), then GREEN implementation covering both._

## Files Created/Modified
- `src/views/KanbanView.ts` — HTML-based kanban view with D3 column grouping, drag-drop, MutationManager integration
- `tests/views/KanbanView.test.ts` — 20 tests covering grouping, empty columns, drag-drop, mutation shape, same-column no-op

## Decisions Made
- **HTML divs over SVG:** HTML5 drag-drop API requires draggable HTML elements; SVG elements do not participate in HTML5 DnD — confirmed by RESEARCH
- **No d3.drag:** d3.drag intercepts `dragstart` and corrupts `dataTransfer` — RESEARCH anti-pattern, use native `addEventListener` instead
- **onMutation injection:** Constructor accepts optional `onMutation` callback for test injection without real SQL; default implementation calls `updateCardMutation` + `mutationManager.execute()`
- **jsdom DragEvent polyfill:** jsdom does not implement `DragEvent` natively; polyfill registered via `globalThis.DragEvent` extending `MouseEvent` at test module scope — enables `dispatchEvent` with drag semantics

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed D3 enter append not passing datum to renderHtmlCard**
- **Found during:** Task 1 (GREEN phase implementation)
- **Issue:** Initial `enter.append(() => { const card = renderHtmlCard(enter.datum()!) })` — `enter.datum()` does not exist on selections; all cards rendered with first card's data
- **Fix:** Changed to `enter.append(function(d) { return renderHtmlCard(d); })` — D3 passes datum `d` correctly to the node factory function
- **Files modified:** `src/views/KanbanView.ts`
- **Verification:** "each card element has correct data binding" test passes (previously showed all cards with same name)
- **Committed in:** `140a069` (Task 1+2 feat commit)

**2. [Rule 2 - Missing Critical] Added jsdom DragEvent polyfill to test file**
- **Found during:** Task 2 (drag-drop tests)
- **Issue:** jsdom environment does not define `DragEvent` — 9 drag-drop tests failed with `ReferenceError: DragEvent is not defined`
- **Fix:** Added `DragEventPolyfill extends MouseEvent` at top of test file registered to `globalThis.DragEvent`; added `afterEach` to vitest imports
- **Files modified:** `tests/views/KanbanView.test.ts`
- **Verification:** All 20 drag-drop tests pass after polyfill
- **Committed in:** `b26f725` (test commit — polyfill added with test file)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical for test environment)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- D3 `enter.append()` node factory function receives datum as argument — must use `function(d)` form, not `() =>` with `selection.datum()` which doesn't work on multi-element selections
- jsdom DragEvent gap is a known limitation; polyfill pattern now established for all future drag-drop tests in Phase 5+

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- KanbanView complete: grouping, empty columns, drag-drop, MutationManager integration
- Phase 5 Plan 03 of N complete: ListView (05-01), KanbanView (05-03) done
- GridView (05-02), transitions (05-04, 05-05) remain per Phase 5 roadmap
- DragEvent polyfill pattern available for reuse in future drag-drop test files

## Self-Check: PASSED

- FOUND: `src/views/KanbanView.ts`
- FOUND: `tests/views/KanbanView.test.ts`
- FOUND: commit `b26f725` (test: add failing KanbanView tests)
- FOUND: commit `140a069` (feat: implement KanbanView with column grouping and drag-drop)

---
*Phase: 05-core-d3-views-transitions*
*Completed: 2026-02-28*
