---
phase: 109-etl-test-infrastructure
plan: "03"
subsystem: testing
tags: [vitest, jsdom, wasm, boundary, ci, grep]

# Dependency graph
requires:
  - phase: 109-01
    provides: CI environment-boundary job skeleton
  - phase: 109-02
    provides: WASM/jsdom boundary documentation and initial enforcement
provides:
  - CI environment-boundary job passes cleanly on current codebase with zero violations
  - etl-progress split into Node data tests + jsdom UI tests
  - view-tab-bar and calc-explorer seam tests run in Node with programmatic JSDOM
  - Refined CI grep pattern filtering out import type false positives
affects: [future-seam-tests, ci-pipeline]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Programmatic JSDOM pattern: new JSDOM(...) + global.document + global.Event injection in Node environment tests that need both WASM and DOM"
    - "CI grep filter: grep -v '^import type' to exclude type-only imports from boundary violation check"
    - "Test file split pattern: data-layer test (Node, no annotation) + UI test (jsdom annotation) for tests that were incorrectly mixed"

key-files:
  created:
    - tests/integration/etl-progress-data.test.ts
    - tests/integration/etl-progress-ui.test.ts
  modified:
    - tests/seams/ui/view-tab-bar.test.ts
    - tests/seams/ui/calc-explorer.test.ts
    - .github/workflows/ci.yml
  deleted:
    - tests/integration/etl-progress.test.ts

key-decisions:
  - "Programmatic JSDOM requires both global.document AND global.Event injection; just setting global.document is insufficient when test code dispatches Events across the boundary"
  - "CI grep refined to two-stage check: realDb check (no filtering needed) + Database import check (filter import type lines)"

patterns-established:
  - "Node+JSDOM pattern: set global.document and global.Event from JSDOM window in beforeEach, delete in afterEach"
  - "False positive suppression: grep -v '^import type' before checking for value imports of WASM modules"

requirements-completed: [INFR-02]

# Metrics
duration: 12min
completed: 2026-03-22
---

# Phase 109 Plan 03: Boundary Violations Fix Summary

**Fixed 3 WASM/jsdom boundary violations and 1 false-positive grep match so the CI environment-boundary job passes on the current codebase with zero violations**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-22T09:13:54Z
- **Completed:** 2026-03-22T09:25:57Z
- **Tasks:** 1
- **Files modified:** 5 (+ 2 created, 1 deleted)

## Accomplishments

- Split `etl-progress.test.ts` into two files: data tests run in Node (WASM works), UI tests run in jsdom (DOM works)
- Removed `@vitest-environment jsdom` from `view-tab-bar.test.ts` and `calc-explorer.test.ts`; replaced with programmatic JSDOM via `global.document` + `global.Event` injection
- Refined CI `environment-boundary` grep to a two-stage loop that filters `import type` lines, eliminating the `source-view-matrix.test.ts` false positive
- All 5 affected test files pass vitest (4 new/modified pass 100%, source-view-matrix 90 tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix 3 real boundary violations and 1 false positive** - `0012ff01` (fix)

## Files Created/Modified

- `tests/integration/etl-progress-data.test.ts` - ETL progress data-layer tests in Node environment (3 tests)
- `tests/integration/etl-progress-ui.test.ts` - ImportToast UI tests in jsdom environment (4 tests)
- `tests/integration/etl-progress.test.ts` - Deleted (split into above two files)
- `tests/seams/ui/view-tab-bar.test.ts` - Removed jsdom annotation, added JSDOM programmatic setup
- `tests/seams/ui/calc-explorer.test.ts` - Removed jsdom annotation, added JSDOM programmatic setup with Event injection
- `.github/workflows/ci.yml` - Refined boundary check grep to filter import type lines

## Decisions Made

- **Programmatic JSDOM requires Event injection**: Setting `global.document` alone was insufficient. `dispatchEvent(new Event(...))` fails because `new Event` uses the Node global constructor while `dispatchEvent` on a JSDOM element expects a JSDOM Event instance. Fixed by also setting `(global as any).Event = dom.window.Event` in `beforeEach` and cleaning up in `afterEach`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] calc-explorer tests failed: global.Event not set alongside global.document**
- **Found during:** Task 1 (running calc-explorer.test.ts after applying the fix)
- **Issue:** `new Event('change', { bubbles: true })` in test body used the Node global Event constructor, incompatible with JSDOM's dispatchEvent. TypeError: "parameter 1 is not of type 'Event'"
- **Fix:** Added `(global as any).Event = dom.window.Event` in both describe block `beforeEach` hooks; added `delete (global as any).Event` in `afterEach`
- **Files modified:** tests/seams/ui/calc-explorer.test.ts
- **Verification:** All 8 calc-explorer tests pass after fix
- **Committed in:** 0012ff01 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** The fix was a direct consequence of implementing the plan's approach. No scope creep.

## Issues Encountered

The programmatic JSDOM approach is subtler than the plan indicated: it's not sufficient to only inject `global.document`. Any test code that creates DOM events using `new Event(...)` needs `global.Event` to also be set to the JSDOM window's Event constructor, or the two event types will be incompatible at the `dispatchEvent` call site.

## Next Phase Readiness

- CI `environment-boundary` job now passes cleanly on the full test suite
- INFR-02 fully satisfied: boundary is documented (ENVIRONMENT.md) AND enforced (CI job)
- No blockers for remaining Phase 109 plans

---
*Phase: 109-etl-test-infrastructure*
*Completed: 2026-03-22*
