---
phase: 170-integration-testing
plan: "02"
subsystem: e2e
tags: [playwright, webkit, smoke-test, explorer-canvas, eint-04]
dependency_graph:
  requires: [167-explorercanvas-core, 168-tab-system, 169-status-slot]
  provides: [EINT-04 WebKit smoke CI gate for ExplorerCanvas]
  affects: [e2e/superwidget-smoke.spec.ts, CI hard gate]
tech_stack:
  added: []
  patterns: [Playwright page.evaluate for projection commits, dedicated harness HTML per canvas type]
key_files:
  created:
    - e2e/fixtures/explorercanvas-harness.html
  modified:
    - e2e/superwidget-smoke.spec.ts
decisions:
  - Separate explorercanvas-harness.html from superwidget-harness.html preserves INTG-07 isolation (stub tab IDs vs real tab IDs)
  - register() called after registerAllStubs() to override stub with real ExplorerCanvas for explorer-1
metrics:
  duration_minutes: 5
  completed_date: "2026-04-21"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 170 Plan 02: ExplorerCanvas WebKit Smoke Test Summary

**One-liner:** Playwright WebKit CI hard gate verifying real ExplorerCanvas renders and switches across all 3 tabs (import-export, catalog, db-utilities) via a dedicated harness fixture.

## What Was Built

- `e2e/fixtures/explorercanvas-harness.html` — Dedicated Playwright harness that registers the real ExplorerCanvas (not the stub), commits an initial Explorer projection with real tab IDs, and exposes the `__sw` API for Playwright evaluation.
- EINT-04 describe block in `e2e/superwidget-smoke.spec.ts` — New `test.describe('ExplorerCanvas WebKit smoke — EINT-04', ...)` block that exercises tab switching across all 3 tabs and verifies the status slot bar renders.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create explorercanvas-harness.html fixture | 4af937b9 | e2e/fixtures/explorercanvas-harness.html |
| 2 | Add EINT-04 Playwright WebKit smoke test | cf74e813 | e2e/superwidget-smoke.spec.ts |

## Verification Results

```
Running 2 tests using 1 worker
  ✓  [webkit] SuperWidget WebKit smoke › transition matrix: Explorer -> View/Bound -> Editor (930ms)
  ✓  [webkit] ExplorerCanvas WebKit smoke — EINT-04 › ExplorerCanvas renders real content and switches tabs (373ms)
  2 passed (2.6s)
```

Both INTG-07 and EINT-04 pass. No regression.

## Key Design Decisions

1. **Separate harness files** — `explorercanvas-harness.html` is distinct from `superwidget-harness.html` to prevent INTG-07 regression. The v13.0 test uses stub tab IDs (`'tab-1'`); the new harness uses real tab IDs (`'import-export'`, `'catalog'`, `'db-utilities'`).

2. **Register override pattern** — `registerAllStubs()` is called first (registers stub for `explorer-1`), then `register('explorer-1', ...)` is called to replace with real `ExplorerCanvas`. The registry Map simply overwrites the key.

3. **No playwright.config.ts changes** — The webkit project `testMatch: '**/superwidget-smoke.spec.ts'` already covers the spec file.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The harness wires the real ExplorerCanvas with no-op config callbacks appropriate for a Playwright smoke test.

## Self-Check: PASSED

- `e2e/fixtures/explorercanvas-harness.html` exists: FOUND
- `e2e/superwidget-smoke.spec.ts` contains EINT-04 block: FOUND
- Commit `4af937b9` exists: FOUND
- Commit `cf74e813` exists: FOUND
- `e2e/fixtures/superwidget-harness.html` unmodified: CONFIRMED (git diff shows 0 changes)
- `playwright.config.ts` unmodified: CONFIRMED
- 2 Playwright tests pass: CONFIRMED
