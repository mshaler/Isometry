---
phase: 107-playwright-e2e
plan: 02
subsystem: testing
tags: [playwright, e2e, combo-tests, ci-pipeline, screenshot-baselines, multi-plugin]

# Dependency graph
requires:
  - phase: 107-01
    provides: 10 per-category Playwright E2E specs, harness helpers, waitForHarnessReady/enablePlugin/disablePlugin API
  - phase: 106-cross-plugin-interactions
    provides: Multi-plugin DOM state for combo assertions
provides:
  - 5 multi-plugin combination E2E specs in harness-combos.spec.ts (E2E-02)
  - 7 screenshot baselines committed to e2e/screenshots/ (E2E-03)
  - CI pipeline e2e hard-gate job in .github/workflows/ci.yml (E2E-05)
affects: [ci-pipeline, screenshot-regression-baselines, all-future-e2e-suites]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - disableAllNonBase() reset pattern to ensure clean combo state between tests
    - page.evaluate() + PointerEvent dispatch for pv-grid-wrapper-intercepted overlay clicks
    - page.on('pageerror') + page.off() error collection pattern for no-crash assertions
    - NON_BASE_IDS constant array for deterministic plugin reset order
    - git add -f to force-commit baselines over e2e/.gitignore screenshots/ rule

key-files:
  created:
    - e2e/harness-combos.spec.ts
    - e2e/screenshots/harness-combo-sort-search-select.png
    - e2e/screenshots/harness-combo-sort-density-calc.png
    - e2e/screenshots/harness-combo-stack-zoom-size.png
    - e2e/screenshots/harness-combo-stack-collapsed.png
    - e2e/screenshots/harness-combo-search-scroll-density.png
    - e2e/screenshots/harness-combo-all-plugins.png
    - e2e/screenshots/harness-combo-calc-footer.png
  modified:
    - .github/workflows/ci.yml

key-decisions:
  - "Use disableAllNonBase() between each combo test to ensure fully clean state — avoids cross-combo state pollution"
  - "Combo-3 (Stack+Zoom+Size) collapsible click via page.evaluate() PointerEvent dispatch — pv-grid-wrapper intercepts all Playwright .click() calls on overlay children (consistent with Phase 107-01 decision)"
  - "Screenshot baselines force-committed with git add -f — e2e/.gitignore excludes screenshots/ directory as it was intended for regenerated test-run artifacts, but E2E-03 requires committed baselines"
  - "e2e CI job has no needs: key — runs in parallel with typecheck/lint/test/bench as 5th parallel job"
  - "Hard gate: no continue-on-error on e2e job (unlike bench which is a soft gate)"

requirements-completed: [E2E-02, E2E-03, E2E-04, E2E-05]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 107 Plan 02: Multi-Plugin Combo Specs, Screenshot Baselines, and CI Integration Summary

**5 multi-plugin combination E2E specs with 7 screenshot baselines and a hard-gate Playwright CI job covering additive DOM rendering (E2E-02), visual regression baselines (E2E-03), no-waitForTimeout discipline (E2E-04), and CI enforcement (E2E-05)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-03-22T04:13:26Z
- **Completed:** 2026-03-22T04:20:00Z
- **Tasks:** 2
- **Files modified:** 2 files created/modified (+ 7 screenshot PNGs)

## Accomplishments

- Created `e2e/harness-combos.spec.ts` with 5 multi-plugin combination specs:
  1. Sort + Search + Select — triple interaction combo
  2. Sort + Density + Calc — UI modifier + toolbar + footer combo
  3. Stack + Zoom + Size — visual layout modifier trio
  4. Search + Scroll + Density — data windowing with search
  5. All 24 non-base plugins enabled — full matrix stress test
- All 5 combo tests pass in Chromium; zero `waitForTimeout` usage; 18 `expect.poll()` calls
- 7 screenshot baselines committed to `e2e/screenshots/` covering all combo states
- Added `e2e` job to `.github/workflows/ci.yml` as 5th parallel job with hard gate (no `continue-on-error`), browser caching via `actions/cache@v4`, and failure artifact upload

## Task Commits

1. **Task 1: Create combo specs + screenshot baselines** - `d23fb465` (feat)
2. **Task 2: Wire Playwright into CI pipeline as hard gate** - `dcdad80d` (feat)

## Files Created/Modified

- `e2e/harness-combos.spec.ts` — 5 multi-plugin combo specs, E2E-04 compliant
- `e2e/screenshots/harness-combo-sort-search-select.png` — Combo 1 baseline
- `e2e/screenshots/harness-combo-sort-density-calc.png` — Combo 2 baseline
- `e2e/screenshots/harness-combo-calc-footer.png` — Combo 2 calc footer close-up
- `e2e/screenshots/harness-combo-stack-zoom-size.png` — Combo 3 baseline
- `e2e/screenshots/harness-combo-stack-collapsed.png` — Combo 3 collapsed state baseline
- `e2e/screenshots/harness-combo-search-scroll-density.png` — Combo 4 baseline
- `e2e/screenshots/harness-combo-all-plugins.png` — Combo 5 full-matrix baseline
- `.github/workflows/ci.yml` — Added e2e hard-gate job (5th parallel job)

## Decisions Made

- Used `disableAllNonBase()` at the start of each test for clean combo state — prevents cross-test state pollution from prior combo enables.
- Combo-3 (Stack+Zoom+Size) collapsible header collapse uses `page.evaluate()` with `PointerEvent` dispatch instead of Playwright `.click()`. The `pv-grid-wrapper` element intercepts all Playwright click events on overlay children, consistent with the Phase 107-01 established pattern.
- Screenshot baselines force-committed via `git add -f` to override the `e2e/.gitignore` rule. The `.gitignore` was written to exclude regenerated test-run artifacts (test-results/, report/) but the screenshots/ exclusion would have prevented E2E-03 compliance.
- CI e2e job runs in parallel with no `needs:` key (5th parallel job alongside typecheck, lint, test, bench).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Playwright .click() failing on .pv-col-span--collapsible element in combo-3**
- **Found during:** Task 1 (combo-3 Stack+Zoom+Size test first run)
- **Issue:** `firstCollapsible.click()` timed out — Playwright reported `<div class="pv-grid-wrapper">…</div> intercepts pointer events`. The overlay child elements cannot receive Playwright mouse events directly.
- **Fix:** Replaced `.click()` with `page.evaluate()` + `PointerEvent` dispatch on the overlay element — consistent with Phase 107-01 decision pattern
- **Files modified:** `e2e/harness-combos.spec.ts`
- **Committed in:** `d23fb465`

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 107 complete: all E2E requirements fulfilled (E2E-01 through E2E-05)
- CI pipeline now has 5 parallel jobs with Playwright as hard gate on every push
- Screenshot baselines established for visual regression tracking
- v8.3 Plugin E2E Test Suite milestone fully complete

## Self-Check: PASSED

- e2e/harness-combos.spec.ts: FOUND
- e2e/screenshots/harness-combo-all-plugins.png: FOUND
- e2e/screenshots/harness-combo-sort-search-select.png: FOUND
- .github/workflows/ci.yml e2e job: FOUND
- Commit d23fb465: FOUND
- Commit dcdad80d: FOUND

---
*Phase: 107-playwright-e2e*
*Completed: 2026-03-22*
