---
phase: 173-3-canvas-e2e-gate
plan: 01
subsystem: e2e-testing
tags: [playwright, webkit, canvas, superwidget, INTG-01, INTG-02, INTG-03, INTG-04]
dependency_graph:
  requires: [171-viewcanvas, 172-editorcanvas]
  provides: [INTG-01, INTG-02, INTG-03, INTG-04]
  affects: [CI pipeline (webkit job)]
tech_stack:
  added: []
  patterns: [page.evaluate commitProjection pattern, data-canvas-type selector assertions, readFileSync static source assertions]
key_files:
  created:
    - e2e/canvas-e2e-gate.spec.ts
    - e2e/fixtures/canvas-e2e-gate-harness.html
  modified:
    - tests/superwidget/registry.test.ts
    - playwright.config.ts
decisions:
  - "New dedicated canvas-e2e-gate-harness.html registers all 3 canvas IDs via stubs (not real implementations) — lifecycle testing is SuperWidget's responsibility, not the canvas implementation's"
  - "webkit project testMatch extended from single string to array to include canvas-e2e-gate.spec.ts alongside superwidget-smoke.spec.ts"
  - "9-view cycle test uses ViewCanvasStub which only has 1 child per mount — activeTabId used to drive cycle but stub does not re-mount, validating the single-child invariant holds at the canvas slot level"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-22"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 173 Plan 01: 3-Canvas E2E Gate Summary

**One-liner:** Playwright WebKit CI hard gate covering 6-direction canvas transitions, 9-view DOM leak detection, and rapid-burst stress test via SuperWidget stub harness.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create canvas-e2e-gate.spec.ts — 6-direction matrix, 9-view cycle, rapid switching | 6e481214 | e2e/canvas-e2e-gate.spec.ts, e2e/fixtures/canvas-e2e-gate-harness.html, playwright.config.ts |
| 2 | Extend registry.test.ts with CANV-06 real class name assertions | 6ffefd0f | tests/superwidget/registry.test.ts |

## Verification Results

1. `npx playwright test canvas-e2e-gate --project=webkit` — 3/3 passed (INTG-01, INTG-02, INTG-04)
2. `npx vitest run tests/superwidget/registry.test.ts` — 19/19 passed (5 CANV-06 assertions including 2 new INTG-03 checks)
3. Full vitest suite: pre-existing failures in unrelated files (other worktrees, production-build.test.ts, budget.test.ts) — no regressions from this plan

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated playwright.config.ts webkit testMatch to array**
- **Found during:** Task 1 — `npx playwright test canvas-e2e-gate --project=webkit` returned "No tests found"
- **Issue:** webkit project `testMatch` was a single string `'**/superwidget-smoke.spec.ts'` — excluded the new spec file
- **Fix:** Changed `testMatch` to an array: `['**/superwidget-smoke.spec.ts', '**/canvas-e2e-gate.spec.ts']`
- **Files modified:** playwright.config.ts
- **Commit:** 6e481214

**2. [Rule 2 - Missing] Created canvas-e2e-gate-harness.html**
- **Found during:** Task 1 design — existing `superwidget-harness.html` only registers `explorer-1` via `registerAllStubs()`, not `view-1` or `editor-1`
- **Issue:** The 6-direction matrix requires all 3 canvas IDs registered; `registerAllStubs()` intentionally omits view-1/editor-1 (they require production dependencies via main.ts per CANV-06)
- **Fix:** Created dedicated harness that registers all 3 canvas IDs using stub implementations (ExplorerCanvasStub, ViewCanvasStub, EditorCanvasStub) — tests SuperWidget lifecycle, not canvas implementation correctness
- **Files modified:** e2e/fixtures/canvas-e2e-gate-harness.html (new)
- **Commit:** 6e481214

## Key Implementation Notes

- `test.describe.configure({ retries: 0 })` at file scope — CI hard gate, no retry tolerance
- `commitAndAssert` helper validates both visibility of expected canvas type AND exactly-1-child invariant in canvas slot
- INTG-01 test executes 6 sequential transitions with before/after canvas type assertions per step
- INTG-02 uses `page.waitForTimeout(2000)` for 'network' view (matching view-switch.spec.ts pattern) and 500ms for all others
- INTG-04 fires synchronous burst via single `page.evaluate()` block, then `waitForFunction` for Editor to appear before asserting final state
- Console error collection in INTG-04 uses `page.on('console', ...)` listener attached before the burst

## Known Stubs

None — this plan only adds test files. No production stubs introduced.

## Self-Check: PASSED
