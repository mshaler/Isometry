---
phase: 77-import-launch-memory-optimization
plan: 02
subsystem: profiling
tags: [cold-start, memory, checkpoint, PerfTrace, debounce]
dependency_graph:
  requires: []
  provides: [cold-start-decomposition, heap-cycle-baseline, checkpoint-cost-measurement]
  affects: [src/database/Database.ts, src/native/NativeBridge.ts, src/profiling/PerfBudget.ts]
tech_stack:
  added: []
  patterns: [PerfTrace markers, process.memoryUsage RSS snapshot, debounced checkpoint autosave]
key_files:
  created:
    - tests/profiling/cold-start.test.ts
    - tests/profiling/heap-cycle.test.ts
    - tests/profiling/checkpoint-save-cost.test.ts
  modified:
    - src/database/Database.ts
    - src/native/NativeBridge.ts
    - src/profiling/PerfBudget.ts
decisions:
  - "Cold-start vitest baseline: WASM init 4.7ms / DB create 5.1ms / Schema apply 16.4ms / Total 26.1ms"
  - "Heap RSS growth across 3 import-delete-reimport cycles: ~10% (well under 20% threshold)"
  - "Checkpoint save cost at 20K cards: ~714ms total (export=2ms, base64=712ms) — exceeds 50ms budget"
  - "Applied 100ms trailing debounce to mutation-triggered sendCheckpoint; explicit checkpoint-request calls remain un-debounced"
metrics:
  duration_seconds: 223
  completed_date: "2026-03-13"
  tasks_completed: 3
  files_changed: 6
---

# Phase 77 Plan 02: Cold-Start Decomposition + Heap Cycle + Checkpoint Cost Summary

**One-liner:** Cold-start decomposed into 3 PerfTrace stages (26ms vitest baseline), heap growth confirmed <20% across 3 cycles, checkpoint save cost measured at 714ms triggering 100ms debounce in NativeBridge.

## Objective

Decompose cold-start timing, characterize WASM heap behavior at 20K cards, and measure checkpoint save cost to determine if debouncing is needed.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add PerfTrace markers to Database.initialize() + cold-start test | 68eaf9f2 | src/database/Database.ts, tests/profiling/cold-start.test.ts |
| 2 | Heap cycle test + PerfBudget constants | cfca0565 | tests/profiling/heap-cycle.test.ts, src/profiling/PerfBudget.ts |
| 3 | Checkpoint save cost + debounce | 2e2e35f4 | tests/profiling/checkpoint-save-cost.test.ts, src/native/NativeBridge.ts |

## Measured Baselines

### Cold-Start Decomposition (vitest Node environment)
| Stage | Time |
|-------|------|
| db:wasm:init (WASM compile + instantiate) | 4.7ms |
| db:instance:create (SQL.Database constructor) | 5.1ms |
| db:schema:apply (PRAGMA + DDL) | 16.4ms |
| **Total** | **26.1ms** |

Note: Physical device (WKWebView) will differ due to WASM download + compile latency. The 3000ms `BUDGET_LAUNCH_COLD_MS` constant accounts for this gap.

### Heap Measurement at 20K Cards (RSS)
| Snapshot | RSS |
|----------|-----|
| Baseline | 108MB |
| Peak (after 20K import) | 366MB |
| Steady-state (after DELETE) | 363MB |
| Cycle 1 import RSS | ~430MB |
| Cycle 2 import RSS | ~450MB |
| Cycle 3 import RSS | ~470MB |
| **Growth across 3 cycles** | **~10% (< 20% threshold)** |

RSS dominates because sql.js WASM heap stays in RSS after database operations. V8 heapUsed returns to ~11MB after delete, confirming no JS-side object leaks.

### Checkpoint Save Cost at 20K Cards
| Operation | Cost |
|-----------|------|
| db.export() (sql.js serialization) | ~2ms |
| uint8ArrayToBase64() (17MB database) | ~712ms |
| **Total** | **~714ms** |

Base64 encoding a 17MB database string via `String.fromCharCode` loop dominates the cost. The 50ms budget is exceeded by 14x — debouncing is essential.

## Key Decisions Made

1. **Cold-start stages identified:** Schema apply (16ms) dominates over WASM init (5ms) and DB creation (5ms) in vitest. On device, WASM download will dominate.

2. **Heap growth pattern confirmed bounded:** 3-cycle RSS growth of ~10% is well within the 20% threshold. The pattern of steady ~20MB per-cycle increment represents WASM allocator fragmentation (expected, not a leak).

3. **Checkpoint save is the critical bottleneck:** base64 encoding a 17MB database takes ~712ms. With rapid mutations (ETL imports, multi-field edits), this would create a queue of expensive blocking operations.

4. **Debounce strategy:** 100ms trailing debounce on `window.__isometry.sendCheckpoint` (mutation-triggered autosave). The `native:checkpoint-request` handler (called by Swift before WKWebView termination) bypasses debounce to guarantee safety-critical checkpoint delivery.

## Deviations from Plan

### Auto-applied (Rule 2 — Critical functionality)

**1. [Rule 2 - Missing Critical Feature] Added makeDebouncedCheckpoint() to NativeBridge**
- **Found during:** Task 3 measurement
- **Issue:** Checkpoint save cost of 714ms massively exceeds 50ms budget. CONTEXT.md states "if >50ms, consider debouncing."
- **Fix:** Added `makeDebouncedCheckpoint(bridge, 100)` export, wired to `window.__isometry.sendCheckpoint`. Explicit `native:checkpoint-request` calls remain un-debounced for safety.
- **Files modified:** src/native/NativeBridge.ts
- **Commit:** 2e2e35f4

## Self-Check: PASSED

All created files exist. All task commits found in git log.

- FOUND: tests/profiling/cold-start.test.ts
- FOUND: tests/profiling/heap-cycle.test.ts
- FOUND: tests/profiling/checkpoint-save-cost.test.ts
- FOUND: .planning/phases/77-import-launch-memory-optimization/77-02-SUMMARY.md
- FOUND commit: 68eaf9f2 (Task 1)
- FOUND commit: cfca0565 (Task 2)
- FOUND commit: 2e2e35f4 (Task 3)
