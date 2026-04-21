---
phase: 169-status-slot
plan: "01"
subsystem: superwidget
tags: [status-slot, worker-protocol, ingestion-counts, css]
dependency_graph:
  requires: [168-tab-system]
  provides: [status-slot-renderer, worker-stats-last-import]
  affects: [src/main.ts, src/superwidget/statusSlot.ts, src/worker/handlers/datasets.handler.ts, src/worker/protocol.ts, src/styles/superwidget.css]
tech_stack:
  added: []
  patterns: [slot-scoped-update, silent-failure-guard, idempotent-render]
key_files:
  created:
    - src/superwidget/statusSlot.ts
  modified:
    - src/worker/protocol.ts
    - src/worker/handlers/datasets.handler.ts
    - src/styles/superwidget.css
    - src/main.ts
decisions:
  - "Standalone statusSlot.ts module (not on ExplorerCanvas) preserves CANV-06 and slot-scoped updates"
  - "Idempotent renderStatusSlot via .querySelector guard — safe to call multiple times"
  - "Silent failure in updateStatusSlot when spans absent — no error thrown before first render"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-21T19:18:30Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 4
requirements: [STAT-01, STAT-02, STAT-03, STAT-04]
---

# Phase 169 Plan 01: Status Slot — Implementation Summary

Implemented the SuperWidget status slot showing live card count, connection count, and last import timestamp. Status slot DOM updates are slot-scoped and never increment `data-render-count` on the canvas or any other slot (STAT-04).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Status slot renderer + Worker stats extension + CSS | 8ac97561 | statusSlot.ts, protocol.ts, datasets.handler.ts, superwidget.css |
| 2 | Wire status slot into main.ts refresh pipeline | ae8fc82d | src/main.ts |

## What Was Built

**statusSlot.ts** — Standalone renderer module (no coupling to SuperWidget.ts or ExplorerCanvas.ts) exporting:
- `formatRelativeTime(isoString)` — pure relative time formatter (just now / N min ago / N hours ago / yesterday / Apr 19)
- `renderStatusSlot(statusEl)` — idempotent one-time DOM setup creating `div.sw-status-bar` with three `data-stat` spans and two separator spans
- `updateStatusSlot(statusEl, stats)` — silent-failure updater that sets textContent on each span; never touches `data-render-count`

**Worker stats extension** — `WorkerResponses['datasets:stats']` extended with `last_import_at: string | null`. Handler adds `SELECT MAX(completed_at) as last_import FROM import_runs` query and returns `last_import_at` in the response object.

**CSS** — Added `.sw-status-bar` (flex row, `--space-xs` gap, `--text-sm`, `--text-muted`) and `.sw-status-bar__sep` (`user-select: none`) rules to `superwidget.css` under `[data-component="superwidget"]` scope.

**main.ts wiring** — Import added, `renderStatusSlot(superWidget.statusEl)` called once after `commitProjection`, `updateStatusSlot(superWidget.statusEl, stats)` called inside `refreshDataExplorer()` after every stats fetch.

## Verification

- `npx vitest run tests/superwidget/` — 179 tests pass, 0 failures
- `grep -n 'data-render-count' src/superwidget/statusSlot.ts` — no code references (STAT-04 confirmed)
- `grep -n 'updateStatusSlot' src/main.ts` — line 695, inside refreshDataExplorer()
- `grep -n 'last_import_at' src/worker/protocol.ts` — line 476 present
- Pre-existing TypeScript error in `tests/superwidget/ExplorerCanvas.test.ts` (Mock type mismatch) — confirmed pre-existing, not introduced by this plan

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all three data fields (card_count, connection_count, last_import_at) are wired to real Worker queries.

## Self-Check: PASSED

- [x] src/superwidget/statusSlot.ts exists
- [x] Commit 8ac97561 exists
- [x] Commit ae8fc82d exists
- [x] 179 superwidget tests pass
