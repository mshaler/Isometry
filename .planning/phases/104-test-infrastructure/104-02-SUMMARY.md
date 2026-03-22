---
phase: 104-test-infrastructure
plan: 02
subsystem: testing
tags: [playwright, e2e, harness, window-api, dynamic-import]

# Dependency graph
requires:
  - phase: 104-test-infrastructure/104-01
    provides: HarnessShell component with PluginRegistry wired
provides:
  - "?harness=1 URL entry point in main.ts via dynamic import of HarnessShell"
  - "window.__harness programmatic API (enable/disable/isEnabled/getAll/getEnabled)"
  - "window.__harnessReady ready signal after HarnessShell.mount()"
  - "e2e/helpers/harness.ts Playwright helpers for programmatic plugin control"
affects: [107-playwright-e2e, any phase writing E2E tests against the harness]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Early return harness branch in main() using URLSearchParams before any bootstrap"
    - "Dynamic import for tree-shaking harness code from the production bundle"
    - "window.__harnessReady ready signal pattern (mirrors window.__isometry pattern)"
    - "Playwright page.evaluate() for programmatic API calls — no DOM coupling"

key-files:
  created:
    - e2e/helpers/harness.ts
  modified:
    - src/main.ts
    - src/views/pivot/harness/HarnessShell.ts
    - tests/views/pivot/helpers/makePluginHarness.ts

key-decisions:
  - "Early return pattern in main() — harness branch uses URLSearchParams check before any bootstrap work, then returns; keeps normal app code unchanged"
  - "Dynamic import for HarnessShell — tree-shaken from production bundle; harness code never loads in normal app"
  - "window.__harness cleanup in destroy() — both __harness and __harnessReady deleted on teardown to prevent cross-test pollution"

patterns-established:
  - "Harness entry: /?harness=1 — all E2E plugin tests use this URL, not /"
  - "Plugin control via window.__harness API — never DOM clicks — in E2E tests"
  - "waitForHarnessReady() before any plugin interaction — mirrors waitForAppReady() pattern"

requirements-completed: [INFR-04, INFR-05]

# Metrics
duration: 12min
completed: 2026-03-22
---

# Phase 104 Plan 02: HarnessShell E2E Entry Point Summary

**?harness=1 URL branch in main.ts with window.__harness programmatic API and Playwright helper library for plugin control in E2E tests**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-03-22T20:15:00Z
- **Completed:** 2026-03-22T20:27:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added early URLSearchParams harness branch to main.ts — dynamically imports HarnessShell when ?harness=1 is present, skips all normal bootstrap
- HarnessShell.mount() now exposes window.__harness (enable/disable/isEnabled/getAll/getEnabled) and sets window.__harnessReady = true after mount
- HarnessShell.destroy() cleans up both window properties to prevent test pollution
- Created e2e/helpers/harness.ts with 5 Playwright helper functions (waitForHarnessReady, togglePlugin, enablePlugin, disablePlugin, getEnabledPlugins)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ?harness=1 branch to main.ts and expose window.__harness API on HarnessShell** - `ef82c71c` (feat)
2. **Task 2: Create e2e/helpers/harness.ts Playwright helpers** - `080d315b` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/main.ts` — Added early harness branch with URLSearchParams check and dynamic import
- `src/views/pivot/harness/HarnessShell.ts` — Added window.__harness API and __harnessReady flag in mount(); cleanup in destroy()
- `e2e/helpers/harness.ts` — New file: waitForHarnessReady, togglePlugin, enablePlugin, disablePlugin, getEnabledPlugins
- `tests/views/pivot/helpers/makePluginHarness.ts` — Fixed pre-existing TS error: filter undefined values from visibleRows.map

## Decisions Made
- Used early return pattern (not else-branch wrapping) in main() to avoid deep nesting of the existing bootstrap code
- Dynamic import for HarnessShell ensures harness code is tree-shaken from the production bundle — no footprint in normal app builds
- window.__harness cleanup in destroy() prevents cross-test state contamination when harness is mounted/destroyed multiple times

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TypeScript error in makePluginHarness.ts**
- **Found during:** Task 1 verification (npx tsc --noEmit)
- **Issue:** `visibleRows.map((r) => r[0])` produces `(string | undefined)[]` but `HeaderDimension.values` requires `string[]`
- **Fix:** Added `.filter((v): v is string => v !== undefined)` type guard
- **Files modified:** tests/views/pivot/helpers/makePluginHarness.ts
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** ef82c71c (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Pre-existing TS error fix was necessary for tsc gate to pass. No scope creep.

## Issues Encountered
- Linter reverted HarnessShell.ts edit during initial tsc run — re-applied changes via Write tool and verified with stash/unstash that test failures are pre-existing (10 files, 78-79 tests failing before and after my changes)
- git stash during pre-existing check also reverted main.ts changes — re-applied manually

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 104 plan 02 complete: HarnessShell E2E entry point fully wired
- Phase 107 (Playwright E2E) can now import from e2e/helpers/harness.ts and use /?harness=1
- Phases 105/106 (lifecycle + interaction tests) can continue in parallel

## Self-Check: PASSED

- FOUND: src/main.ts (harness branch present)
- FOUND: src/views/pivot/harness/HarnessShell.ts (__harnessReady and __harness API present)
- FOUND: e2e/helpers/harness.ts (5 exported async functions)
- FOUND: .planning/phases/104-test-infrastructure/104-02-SUMMARY.md
- FOUND commit ef82c71c (Task 1)
- FOUND commit 080d315b (Task 2)

---
*Phase: 104-test-infrastructure*
*Completed: 2026-03-22*
