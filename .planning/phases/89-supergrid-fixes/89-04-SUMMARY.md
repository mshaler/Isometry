---
phase: 89-supergrid-fixes
plan: "04"
subsystem: SuperGrid
tags: [gap-closure, depth-wiring, setter-injection, tdd]
dependency_graph:
  requires: [89-02]
  provides: [SGFX-01]
  affects: [src/views/SuperGrid.ts, src/main.ts]
tech_stack:
  added: []
  patterns: [setter-injection]
key_files:
  created:
    - tests/seams/ui/supergrid-depth-wiring.test.ts
  modified:
    - src/views/SuperGrid.ts
    - src/main.ts
decisions:
  - "Use prelimColAxes rename approach so all existing colAxes references in _fetchAndRender automatically use the depth-limited value — zero additional edits required"
  - "depth=0 treated as All (no limit) matching PropertiesExplorer semantics where 0 = All"
metrics:
  duration_seconds: 120
  completed_date: "2026-03-18"
  tasks_completed: 1
  files_changed: 3
---

# Phase 89 Plan 04: SuperGrid Depth Wiring Summary

**One-liner:** Wired PropertiesExplorer.getDepth() into SuperGrid._fetchAndRender() via setDepthGetter() setter injection, closing the SGFX-01 gap where depth dropdown re-rendered with unchanged column set.

## Objective

Close SGFX-01 verification gap: depth dropdown UI fired subscribers but the depth value was never consumed by the SuperGrid render path. Changing depth re-rendered at the same column set.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire depth getter into SuperGrid and add integration test | 096101c2 | SuperGrid.ts, main.ts, supergrid-depth-wiring.test.ts |

## What Was Built

**SuperGrid.ts changes:**
- Added `private _depthGetter: (() => number) | null = null` field (same pattern as `_calcExplorer`, `_schema`)
- Added `setDepthGetter(getter: () => number): void` setter after `setSchemaProvider()`
- In `_fetchAndRender()`, renamed `colAxes` binding to `prelimColAxes`, then applied depth-based slicing: `depth > 0 && depth < prelimColAxes.length ? prelimColAxes.slice(0, depth) : prelimColAxes` — all existing `colAxes` references downstream automatically use the depth-limited value

**main.ts changes:**
- Added `sg.setDepthGetter(() => propertiesExplorer.getDepth())` in the SuperGrid factory after `setSchemaProvider()` — `propertiesExplorer` is forward-declared and assigned before the factory runs (factory executes lazily on first view switch)

**New test file:** `tests/seams/ui/supergrid-depth-wiring.test.ts`
- 4 tests using mock bridge that captures `colAxes` arg from `superGridQuery`
- SGFX-01g: depth=1 → 1 colAxis passed
- SGFX-01h: depth=0 → all 3 colAxes passed
- SGFX-01i: depth=2 → 2 colAxes passed
- SGFX-01j: no depthGetter → all 3 colAxes (backward compatible)

## Verification Results

```
✓ tests/seams/ui/supergrid-depth-wiring.test.ts (4 tests) — PASS
✓ tests/seams/ui/properties-explorer-depth.test.ts (6 tests) — PASS
✓ tests/seams/ui/ — 9/10 files pass; dataset-eviction.test.ts (4 failures) pre-existing, confirmed unrelated
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `src/views/SuperGrid.ts` — modified, contains `_depthGetter`, `setDepthGetter`, `prelimColAxes.slice`
- `src/main.ts` — modified, contains `setDepthGetter(() => propertiesExplorer.getDepth())`
- `tests/seams/ui/supergrid-depth-wiring.test.ts` — created, 4 tests
- Commit `096101c2` verified in git log
