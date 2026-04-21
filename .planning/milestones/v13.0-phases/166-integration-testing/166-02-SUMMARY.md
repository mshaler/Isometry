---
phase: 166-integration-testing
plan: 02
subsystem: testing
tags: [playwright, webkit, e2e, superwidget, integration-tests]

# Dependency graph
requires:
  - phase: 166-01
    provides: CanvasFactory binding-aware, registerAllStubs/getCanvasFactory, 10 integration tests green

provides:
  - Playwright WebKit smoke test exercising Explorer->View/Bound->Editor transition matrix
  - Standalone HTML harness (e2e/fixtures/superwidget-harness.html) with window.__sw API
  - WebKit project in playwright.config.ts scoped to superwidget-smoke.spec.ts
  - CI hard gate: webkit browser install + run in e2e job

affects:
  - CI e2e job (now installs and runs webkit in addition to chromium)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone HTML harness pattern: e2e/fixtures/*.html loads app modules via Vite native ESM, exposes window API for Playwright evaluate() calls"
    - "WebKit project scoped via testMatch glob to a single spec — all other specs run only in chromium"
    - "page.evaluate() serializes plain projection objects across the browser boundary — no class import needed in spec"

key-files:
  created:
    - e2e/superwidget-smoke.spec.ts
    - e2e/fixtures/superwidget-harness.html
  modified:
    - playwright.config.ts
    - .github/workflows/ci.yml

key-decisions:
  - "Option B harness: standalone e2e/fixtures/superwidget-harness.html — main app does not expose __sw, and a minimal harness is more reliable than navigating the full app boot sequence"
  - "Projection objects passed as plain JS objects via page.evaluate() — no TypeScript type import needed in spec, avoids tsconfig include scope issues"
  - "WebKit testMatch set to '**/superwidget-smoke.spec.ts' — keeps all existing chromium-only specs unaffected"

patterns-established:
  - "HTML harness + window API pattern: reusable for future isolated component E2E testing without full app boot"

requirements-completed: [INTG-07]

# Metrics
duration: 5min
completed: 2026-04-21
---

# Phase 166 Plan 02: Playwright WebKit Smoke Test Summary

**Playwright WebKit smoke test exercises the Explorer->View/Bound->Editor transition matrix via a standalone HTML harness, wired into CI as a hard gate (INTG-07)**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-21T15:39:06Z
- **Completed:** 2026-04-21T15:44:00Z
- **Tasks:** 1
- **Files modified:** 4

## Accomplishments
- Created `e2e/fixtures/superwidget-harness.html` — standalone Vite-served page mounting SuperWidget with `window.__sw.commitProjection()` API
- Created `e2e/superwidget-smoke.spec.ts` — 1 test, 3-step transition matrix: Explorer (no sidecar, "Primary") -> View/Bound (sidecar appears, "Secondary") -> Editor (sidecar gone, "Tertiary")
- Added `webkit` project to `playwright.config.ts` with `testMatch` scoped to `superwidget-smoke.spec.ts`
- Updated `.github/workflows/ci.yml` cache key and install commands to include `webkit` browser (hard gate, no `continue-on-error`)
- All acceptance criteria met: WebKit smoke passes (`1 passed`), TypeScript clean, existing chromium failures confirmed pre-existing

## Task Commits

1. **Task 1: Playwright WebKit smoke spec + config + CI** - `ac053a72` (feat)

## Files Created/Modified
- `e2e/superwidget-smoke.spec.ts` - New: WebKit smoke test, 3-step transition matrix, sidecar + zone label assertions
- `e2e/fixtures/superwidget-harness.html` - New: standalone harness with window.__sw API for programmatic projection commits
- `playwright.config.ts` - Added webkit project with testMatch scoped to smoke spec
- `.github/workflows/ci.yml` - Cache key + browser install commands updated to include webkit

## Decisions Made
- Standalone HTML harness (Option B) preferred over navigating the full Isometry app — main app boot requires sample data load, sampleManager, viewManager etc. A minimal harness is more reliable and faster for a component-level smoke test.
- Projection objects serialized as plain JS objects via `page.evaluate()` — TypeScript `import type` removed from spec to avoid tsconfig include scope issues (e2e/ is excluded from tsconfig.json).
- WebKit `testMatch: '**/superwidget-smoke.spec.ts'` scopes the webkit project cleanly without touching any existing spec files.

## Deviations from Plan
None — plan executed exactly as written. The harness approach matched Option B described in the plan action.

## Known Stubs
None — all assertions target real DOM attributes set by the stub implementations (data-canvas-type, data-sidecar, data-slot). The stubs themselves are explicitly labeled as v13.1 replacements, but the smoke test infrastructure is production-ready.

---
*Phase: 166-integration-testing*
*Completed: 2026-04-21*
