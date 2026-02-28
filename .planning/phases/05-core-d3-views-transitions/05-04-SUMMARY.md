---
phase: 05-core-d3-views-transitions
plan: 04
subsystem: ui
tags: [d3, transitions, morph, crossfade, views, barrel-exports]

# Dependency graph
requires:
  - phase: 05-core-d3-views-transitions/05-02
    provides: ListView and GridView SVG-based views sharing g.card elements
  - phase: 05-core-d3-views-transitions/05-03
    provides: KanbanView HTML-based view requiring crossfade boundary handling

provides:
  - shouldUseMorph(fromType, toType) — detects when list↔grid SVG morph is appropriate
  - morphTransition(svg, cards, computePosition) — D3 g.card animation (400ms easeCubicOut, 15ms stagger)
  - crossfadeTransition(container, mountNewView, duration) — opacity in/out for SVG↔HTML and LATCH↔GRAPH switches
  - ViewManager.switchTo() integrates transition detection via currentViewType tracking
  - src/views/index.ts — barrel export for all views, ViewManager, CardRenderer, transitions
  - src/index.ts — re-exports all views from public API surface

affects:
  - 06-time-visual-views
  - 07-graph-supergrid

# Tech tracking
tech-stack:
  added: []
  patterns:
    - SVG_VIEWS/HTML_VIEWS sets classify ViewType for morph boundary detection
    - morphTransition uses D3 join (enter/update/exit) with key function d => d.id
    - crossfadeTransition wraps D3 opacity transitions in Promise for async/await
    - ViewManager stores currentViewType to enable transition detection on next switchTo()
    - Morph path preserves container DOM; crossfade path removes and re-creates .view-root

key-files:
  created:
    - src/views/transitions.ts
    - src/views/index.ts
    - tests/views/transitions.test.ts
  modified:
    - src/views/ViewManager.ts
    - src/index.ts

key-decisions:
  - "shouldUseMorph returns true only for list↔grid — only SVG_VIEWS members in same LATCH family qualify; network/tree are GRAPH and will not morph even if both become SVG-based in Phase 7"
  - "Morph path preserves container.innerHTML between switchTo() calls — SVG element survives, D3 data join handles card position animation internally"
  - "crossfadeTransition duration=0 for non-browser environments (test/jsdom) — avoids async timer issues while still testing DOM state changes"
  - "ViewManager stores currentViewType as class field — enables shouldUseMorph check on next switchTo() without external tracking"

patterns-established:
  - "Transition boundary detection: SVG_VIEWS set membership + getViewFamily() both required for morph eligibility"
  - "Async transition: crossfadeTransition returns Promise<void> — caller awaits before mounting new view"
  - "Barrel export pattern: src/views/index.ts consolidates all view exports; src/index.ts re-exports from './views'"

requirements-completed: [REND-03, REND-04]

# Metrics
duration: 4min
completed: 2026-02-28
---

# Phase 5 Plan 04: Transitions + Barrel Exports Summary

**D3 morph (400ms easeCubicOut, 15ms stagger) for list↔grid and crossfade (300ms opacity) for SVG↔HTML and LATCH↔GRAPH switches, with complete views barrel export wired into public API**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-28T21:31:53Z
- **Completed:** 2026-02-28T21:35:29Z
- **Tasks:** 2 (Task 1 TDD: 3 commits — red/green/barrel; Task 2: 1 commit)
- **Files modified:** 5

## Accomplishments

- shouldUseMorph correctly classifies all 7 ViewType pair cases (only list↔grid = true)
- morphTransition uses D3 join with key function, 400ms easeCubicOut, 15ms per-card stagger, enter/exit/update
- crossfadeTransition fades out old .view-root, mounts new, fades in — works with 0ms duration for test environments
- ViewManager.switchTo() stores currentViewType, selects morph vs crossfade path automatically
- src/views/index.ts barrel exports all views, ViewManager, CardRenderer, transitions
- src/index.ts re-exports all view public API — Phases 6/7 consume from single entry point
- Full test suite: 727 tests passing (12 new, zero regressions)

## Task Commits

Each task was committed atomically:

1. **RED: Failing transition tests** - `fb0ba6a` (test)
2. **GREEN: transitions.ts + ViewManager integration** - `6c187a0` (feat)
3. **Task 2: barrel exports + public API + fix afterEach import** - `f703cfe` (feat)

**Plan metadata:** (docs commit — see state update)

_Note: TDD tasks have separate RED and GREEN commits; Task 2 barrel export included auto-fix for missing afterEach import._

## Files Created/Modified

- `src/views/transitions.ts` — shouldUseMorph, morphTransition, crossfadeTransition
- `src/views/ViewManager.ts` — currentViewType tracking, morph/crossfade switchTo() paths
- `src/views/index.ts` — barrel export for all views module
- `src/index.ts` — re-exports views from public API
- `tests/views/transitions.test.ts` — 12 tests: shouldUseMorph (7), crossfadeTransition (3), ViewManager integration (2)

## Decisions Made

- shouldUseMorph returns true only for list↔grid — only SVG_VIEWS members in same LATCH family qualify; network/tree are GRAPH and will not morph even if both become SVG-based in Phase 7
- Morph path preserves container.innerHTML between switchTo() calls — SVG element survives; D3 data join handles card position animation internally (no separate DOM swap)
- crossfadeTransition accepts duration=0 for test environments (avoids async timer issues in jsdom while still testing DOM state)
- ViewManager stores currentViewType as class field — enables shouldUseMorph check on next switchTo() without external tracking

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing afterEach import in transitions.test.ts**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** transitions.test.ts used afterEach in ViewManager integration section without importing it from 'vitest'
- **Fix:** Added afterEach to the vitest import statement
- **Files modified:** tests/views/transitions.test.ts
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** f703cfe (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - missing import bug)
**Impact on plan:** Trivial fix, no scope change.

## Issues Encountered

None — plan executed as specified. The crossfadeTransition duration=0 strategy for test environments is noted in research (RESEARCH Pattern); no timer issues encountered.

## Next Phase Readiness

- Phase 5 complete: ListView, GridView, KanbanView, ViewManager, transitions, barrel exports all done
- Phase 6 (Time + Visual Views) can now start — imports from src/views/index.ts
- Phase 7 (Graph Views + SuperGrid) can run in parallel with Phase 6 after this plan

---
*Phase: 05-core-d3-views-transitions*
*Completed: 2026-02-28*
