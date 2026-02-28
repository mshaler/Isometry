---
phase: 05-core-d3-views-transitions
plan: 01
subsystem: ui
tags: [d3, views, typescript, jsdom, css, lifecycle]

# Dependency graph
requires:
  - phase: 04-providers-mutationmanager
    provides: StateCoordinator subscribe/unsubscribe pattern, QueryBuilder buildCardQuery(), PAFVProvider setViewType() with VIEW_DEFAULTS, WorkerBridgeLike pattern

provides:
  - IView interface contract (mount/render/destroy) — required by all Phase 5 view implementations
  - CardDatum type (9-field projection of Card for view rendering)
  - ViewConfig interface (dependency bundle for view construction)
  - WorkerBridgeLike + PAFVProviderLike minimal interfaces for testability
  - toCardDatum() row mapping helper
  - CardRenderer: renderSvgCard(), renderHtmlCard(), CARD_TYPE_ICONS, CARD_DIMENSIONS
  - ViewManager with full lifecycle: switchTo(), destroy(), loading/error/empty states
  - CSS design tokens (dark theme: bg, text, accent, spacing, radius, transitions)
  - CSS view styles (spinner, error banner, empty state, card styles, drag-drop)
  - d3@7.9.0 runtime dependency
  - jsdom dev dependency for browser environment tests

affects:
  - 05-02 (ListView — implements IView, uses CardRenderer.renderSvgCard, ViewManager.switchTo)
  - 05-03 (GridView — implements IView, uses CardRenderer.renderSvgCard)
  - 05-04 (KanbanView — implements IView, uses CardRenderer.renderHtmlCard + drag-drop CSS)
  - All subsequent Phase 5+ view plans

# Tech tracking
tech-stack:
  added:
    - d3@7.9.0 (runtime — D3 data joins, SVG manipulation)
    - @types/d3@7.4.3 (dev — TypeScript types for D3)
    - jsdom (dev — browser DOM environment for ViewManager tests)
    - @types/jsdom (dev — TypeScript types for jsdom)
  patterns:
    - IView lifecycle contract: mount() once, render() on each data update, destroy() before replacement
    - D3 key function mandatory: every .data() call MUST use `d => d.id` (VIEW-09)
    - WorkerBridgeLike interface pattern: extract minimal interface for testable injection
    - PAFVProviderLike interface pattern: extract minimal interface for testable injection
    - 200ms spinner debounce: loading state deferred 200ms to avoid flash for fast queries
    - ViewManager teardown ordering: unsubscribe coordinator → cancel timers → destroy view

key-files:
  created:
    - src/views/types.ts
    - src/views/CardRenderer.ts
    - src/views/ViewManager.ts
    - src/styles/design-tokens.css
    - src/styles/views.css
    - tests/views/ViewManager.test.ts
  modified:
    - package.json (added d3, @types/d3, jsdom, @types/jsdom)

key-decisions:
  - "jsdom installed as dev dependency — required for @vitest-environment jsdom in ViewManager tests (vitest default is node)"
  - "WorkerBridgeLike and PAFVProviderLike minimal interfaces extracted in types.ts — decouples ViewManager from concrete implementations for clean test mocking"
  - "ViewManager.switchTo() ordering: unsubscribe coordinator first, then cancel loading timer, then destroy view — prevents race condition where coordinator fires during teardown"
  - "Loading spinner uses DOM prepend with .view-loading.is-visible CSS class — toggled by ViewManager, not inline style, for CSS override flexibility"
  - "toCardDatum() applies numeric defaults (0) for priority/sort_order to prevent NaN in D3 scale computations"

patterns-established:
  - "IView contract: All view implementations must implement mount(HTMLElement), render(CardDatum[]), destroy() — no exceptions"
  - "D3 key function mandate: `d => d.id` on every .data() call — documented in JSDoc on IView.render()"
  - "ViewManager is the sole owner of coordinator subscriptions from views — views never subscribe to coordinator directly"
  - "Loading state: 200ms debounce via setTimeout, cleared on data arrival, cancelled on destroy()"

requirements-completed: [VIEW-09, VIEW-10, VIEW-11, REND-07, REND-08]

# Metrics
duration: 5min
completed: 2026-02-28
---

# Phase 05 Plan 01: D3 Foundation + ViewManager Summary

**IView contract, CardDatum type, shared CardRenderer (SVG+HTML), ViewManager with 200ms spinner/error/empty states, CSS design tokens — structural foundation for all Phase 5 view implementations**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-28T21:15:27Z
- **Completed:** 2026-02-28T21:20:50Z
- **Tasks:** 2 of 2
- **Files modified:** 8 (6 created, 2 modified)

## Accomplishments
- D3 7.9.0 installed and verified; IView interface, CardDatum type, ViewConfig and toCardDatum() helper established as canonical view contract
- CardRenderer provides both SVG (renderSvgCard with textLength truncation) and HTML (renderHtmlCard with CSS ellipsis) card rendering with identical visual structure for morph transitions
- ViewManager implements full lifecycle: destroy-before-mount (VIEW-10), pafv.setViewType() for VIEW_DEFAULTS (VIEW-11), 200ms loading spinner, error banner with retry button, empty state message
- 18 ViewManager tests prove: subscriber count unchanged after 10 mount/destroy cycles, spinner only after 200ms, retry button re-fetches, all cleanup paths exercised
- CSS design token system established (dark theme variables + view-specific styles)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install D3, define IView contract + CardDatum + CardRenderer** - `eba1e77` (feat)
2. **Task 2: Implement ViewManager with loading/error states and subscriber leak prevention** - `25ce9fb` (feat)

**Plan metadata:** (to be set in final commit)

_Note: TDD tasks had RED (test files fail on missing module) then GREEN (implementation passes all tests) phases._

## Files Created/Modified
- `src/views/types.ts` - IView interface, CardDatum, ViewConfig, WorkerBridgeLike, PAFVProviderLike, toCardDatum()
- `src/views/CardRenderer.ts` - renderSvgCard(), renderHtmlCard(), CARD_TYPE_ICONS, CARD_DIMENSIONS
- `src/views/ViewManager.ts` - ViewManager class with switchTo(), destroy(), _fetchAndRender(), loading/error/empty state helpers
- `src/styles/design-tokens.css` - Dark theme CSS variables: bg, text, accent, spacing, radius, transitions
- `src/styles/views.css` - Spinner, error banner, empty state, card base styles, drag-drop styles
- `tests/views/ViewManager.test.ts` - 18 tests: lifecycle, leak prevention, loading timing, error/retry, empty state, coordinator re-render
- `package.json` - Added d3@7.9.0, @types/d3@7.4.3, jsdom, @types/jsdom

## Decisions Made
- jsdom installed as dev dependency — vitest default is `node` environment; ViewManager tests require DOM APIs, needed `@vitest-environment jsdom` comment directive
- WorkerBridgeLike and PAFVProviderLike minimal interfaces extracted in types.ts — keeps ViewManager testable without importing full concrete classes (matching MutationBridge pattern from Phase 4)
- ViewManager.switchTo() teardown ordering: unsubscribe coordinator first, cancel loading timer, then destroy view — prevents coordinator firing into a half-torn-down view
- Loading spinner uses `.is-visible` CSS class toggle rather than inline `display` style — allows CSS layer to override if needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing jsdom dev dependency**
- **Found during:** Task 2 (ViewManager test RED phase)
- **Issue:** `// @vitest-environment jsdom` directive in test file requires jsdom package; vitest threw `Cannot find package 'jsdom'` preventing test runner from starting
- **Fix:** Ran `npm install --save-dev jsdom @types/jsdom`
- **Files modified:** package.json, package-lock.json
- **Verification:** Tests run successfully in jsdom environment
- **Committed in:** 25ce9fb (Task 2 commit)

**2. [Rule 1 - Bug] Fixed duplicate key in mock object causing TypeScript/Vite warning**
- **Found during:** Task 2 (ViewManager test compilation)
- **Issue:** `makeMockView()` had `destroyCalls: 0 as never` property AND a `get destroyCalls()` getter — duplicate key, Vite esbuild warning
- **Fix:** Simplified mock to use `vi.fn()` directly without duplicate property; track calls via vitest mock API
- **Files modified:** tests/views/ViewManager.test.ts
- **Verification:** No Vite warnings, TypeScript type check clean
- **Committed in:** 25ce9fb (Task 2 commit)

**3. [Rule 1 - Bug] Fixed TypeScript TS2532 error in test (possibly undefined array access)**
- **Found during:** Task 2 (tsc --noEmit verification)
- **Issue:** `mock.calls[0][0]` flagged as possibly undefined without non-null assertion
- **Fix:** Changed to `mock.calls[0]![0]` with non-null assertion on the inner access
- **Files modified:** tests/views/ViewManager.test.ts
- **Verification:** tsc --noEmit exits clean
- **Committed in:** 25ce9fb (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 missing dependency, 2 bugs)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- IView contract is stable and importable — Plan 05-02 (ListView) can implement it immediately
- ViewManager is ready for integration — switchTo() factory pattern works with any IView
- CSS design tokens established — all subsequent views can use the variable system
- No blockers for Phase 5 continuation
- jsdom is installed — future view tests can use `@vitest-environment jsdom` without additional setup

---
*Phase: 05-core-d3-views-transitions*
*Completed: 2026-02-28*
