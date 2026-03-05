---
phase: 26-supertime
plan: 02
subsystem: ui
tags: [supergrid, time-axis, auto-detection, segmented-pills, tdd, d3]

# Dependency graph
requires:
  - phase: 26-supertime
    plan: 01
    provides: "parseDateString() and smartHierarchy() pure utilities in SuperTimeUtils.ts"
provides:
  - "_isAutoGranularity field: tracks auto vs manual granularity mode in SuperGrid"
  - "Segmented pills (A|D|W|M|Q|Y) in density toolbar replacing granularity <select>"
  - "_computeSmartHierarchy() method: integrates SuperTimeUtils into the render pipeline"
  - "Auto-detection loop guard: smartLevel !== currentLevel prevents infinite re-query cycle"
  - "_syncPillActiveState() helper: keeps active pill visually in sync with mode"
affects:
  - "26-supertime Plan 03+ (TIME-04/TIME-05 period selection builds on auto-detection flow)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "_isAutoGranularity boolean pattern: default true (auto mode), false on D/W/M/Q/Y pill click, reset to true on A pill click"
    - "Loop guard pattern: check smartLevel !== currentLevel before calling setGranularity() to prevent density subscriber infinite loop"
    - "Strftime-formatted value guard: parseDateString returns null for bucketed values (e.g., '2026-01') — auto-detection correctly skips setGranularity when granularity already set"

key-files:
  created: []
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "_isAutoGranularity=true always re-evaluates on mount: matches CONTEXT.md adaptive requirement ('re-runs on data change, not locked after first detection'). On session restore with persisted 'month' granularity, first _fetchAndRender computes smart level — if same as persisted, no setGranularity call, no re-query."
  - "Pills replace <select> entirely: no backward-compat wrapper needed. 3 existing DENS tests updated to use pill API instead of .granularity-picker selector."
  - "_syncPillActiveState() called both in mount() (initial state) and _updateDensityToolbar() (every render): ensures active pill always reflects current mode without separate event subscription."
  - "Loop guard: return early after setGranularity() call (let subscriber re-trigger) — this avoids rendering stale data at wrong granularity. Second call sees same level, no setGranularity, proceeds to render."

patterns-established:
  - "Pattern: segmented pill container with dataset[granValue] encoding for active-state lookup without hard-coded DOM queries"
  - "Pattern: auto-detection short-circuit — _computeSmartHierarchy returns null for non-time axes and strftime-bucketed values; null means 'skip detection' (no change to granularity)"

requirements-completed:
  - TIME-01
  - TIME-02
  - TIME-03

# Metrics
duration: 7min
completed: 2026-03-05
---

# Phase 26 Plan 02: SuperGrid Segmented Pills and Smart Hierarchy Auto-Detection

**Segmented pills (A|D|W|M|Q|Y) replace the granularity `<select>` in SuperGrid's density toolbar, with `_isAutoGranularity` tracking auto vs manual mode and `_computeSmartHierarchy()` wiring smartHierarchy() into `_fetchAndRender()` with an infinite-loop guard.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-05T16:45:24Z
- **Completed:** 2026-03-05T16:52:00Z
- **Tasks:** 1 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- `_isAutoGranularity: boolean = true` field added to SuperGrid — tracks auto vs manual granularity mode (Tier 3 ephemeral, not persisted)
- Segmented pills (`A|D|W|M|Q|Y`) replace the granularity `<select>` in `mount()` toolbar: 'A' pill triggers auto re-detection, D/W/M/Q/Y set manual override via `setGranularity()`
- `_computeSmartHierarchy(cells, colAxes, rowAxes)` private method extracts raw date values from cells, calls `parseDateString()` + `smartHierarchy()` from SuperTimeUtils
- Auto-detection block in `_fetchAndRender()` with loop guard: `smartLevel !== currentLevel` check prevents subscriber-triggered infinite re-query cycle
- `_syncPillActiveState()` helper syncs `active` CSS class on pills based on `_isAutoGranularity` and current `axisGranularity`
- 13 new tests GREEN (7 TIME-03 pills tests + 5 TIME-01/02 auto-detection tests + 1 existing DENS test updated), 1829 total passing

## Task Commits

Each task was committed atomically (TDD):

1. **RED — Failing tests** - `94731867` (test): 9 failing tests for pills and auto-detection
2. **GREEN — Implementation** - `ede15e22` (feat): segmented pills + auto-detection with 1829 tests passing

_Note: TDD task has two commits (test → feat). No REFACTOR needed — implementation was clean from the start._

## Files Created/Modified

- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — Added _isAutoGranularity field, segmented pills DOM, auto-detection in _fetchAndRender, _computeSmartHierarchy, _syncPillActiveState, import from SuperTimeUtils
- `/Users/mshaler/Developer/Projects/Isometry/tests/views/SuperGrid.test.ts` — 13 new tests (TIME-03 pills, TIME-01/02 auto-detection); 3 existing DENS tests updated from .granularity-picker to pills API

## Decisions Made

**_isAutoGranularity defaults to true on mount (not false):** Matches CONTEXT.md requirement "adaptive, not locked after first detection." On session restore with persisted 'month' granularity, first fetch computes smart level — if unchanged, loop guard skips setGranularity. If data range expanded (new import), smart level differs and granularity updates.

**Strftime-formatted values correctly skip auto-detection:** `parseDateString('2026-01')` returns null (no day component), so after granularity is set, `_computeSmartHierarchy` returns null, and `setGranularity` is never called on re-renders — correct because level is already set.

**Updated 3 existing DENS tests:** The `.granularity-picker` tests directly test the plan-removed `<select>` element. Per plan requirements, the `<select>` is replaced — these tests were correctly updated to use the pills API rather than being left as false-failures.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 3 existing DENS tests from .granularity-picker to pills API**

- **Found during:** GREEN phase (implementation → existing tests failed because .granularity-picker <select> no longer exists)
- **Issue:** 3 DENS tests (lines ~3414, ~3468, ~3498) tested the old `<select>` granularity picker which was explicitly replaced by the plan. The tests were querying `.granularity-picker` which no longer exists.
- **Fix:** Updated tests to use the new pills API: one test now verifies `.granularity-pills` container exists; two tests now click the M/A pill directly instead of changing a `<select>` value.
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 243 SuperGrid tests pass including the 3 updated DENS tests
- **Committed in:** ede15e22 (GREEN phase commit)

**2. [Rule 1 - Bug] Updated active pill test to simulate click before checking active class**

- **Found during:** GREEN phase (test failed because _isAutoGranularity=true makes A pill active regardless of axisGranularity='month')
- **Issue:** Test assumed injecting `axisGranularity: 'month'` would make M pill active. But _isAutoGranularity defaults to true, making A pill active — correct behavior per plan ("if _isAutoGranularity is true, 'A' is active").
- **Fix:** Updated test to click M pill first (which sets _isAutoGranularity=false), then verify M pill is active after density subscriber fires.
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** Test passes — clicking M pill → _isAutoGranularity=false → M pill gets 'active' class on next _syncPillActiveState call
- **Committed in:** ede15e22 (GREEN phase commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 - Bug, both in test updates)
**Impact on plan:** Both auto-fixes were necessary to correctly test the replaced `<select>` behavior with the new pills API. No scope creep.

## Issues Encountered

None - auto-detection, loop guard, and pill rendering all worked correctly on first implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TIME-01, TIME-02, TIME-03 complete
- SuperGrid now auto-selects time granularity on first mount with a time axis
- Segmented pills provide manual override (D/W/M/Q/Y) and auto reset ('A')
- Plan 03 (TIME-04/TIME-05): period selection via Cmd+click on time period headers, routing to FilterProvider.setAxisFilter()

---
*Phase: 26-supertime*
*Completed: 2026-03-05*
