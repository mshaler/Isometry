---
phase: 32-polish-and-performance
plan: 02
subsystem: ui
tags: [supergrid, aggregation, deepest-wins, selection, benchmarks, d3, vitest-bench, n-level]

# Dependency graph
requires:
  - phase: 30-collapse-system
    provides: _collapsedSet, _collapseModeMap, aggregate injection loops in _renderCells
  - phase: 31-drag-reorder
    provides: reorderColAxes/reorderRowAxes, FLIP animation, stacked axis rendering
  - phase: 32-01
    provides: persistence round-trip validation proving state survives cross-session
provides:
  - Deepest-wins aggregation suppression preventing double-counting in multi-level collapse
  - Aggregate proxy selection making summary cells behave as proxies for collapsed content
  - Auto-reconcile transferring selection highlights between summary and expanded cells
  - 4 N-level render performance benchmarks establishing timing baselines
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "suppressedCollapseKeys pre-computation: O(n^2) scan of _collapsedSet to find ancestor/descendant pairs before aggregate injection"
    - "Aggregate proxy lookup via prefix matching: _getCellCardIds collects card_ids from child cells using dimension key prefix comparison"
    - "Dimension disambiguation via colHeaderKeySet/rowHeaderKeySet: distinguishes col vs row collapse keys that share 0-based level numbering"
    - "mulberry32 PRNG for deterministic benchmark data generation"

key-files:
  created:
    - tests/views/SuperGrid.bench.ts (rewritten with 5 benchmarks)
  modified:
    - src/views/SuperGrid.ts
    - tests/views/SuperGrid.test.ts

key-decisions:
  - "Deepest-wins is render-time only: suppressedCollapseKeys computed fresh each render, _collapsedSet/_collapseModeMap never mutated"
  - "Aggregate injection iterates _collapsedSet directly instead of header cell arrays, enabling non-leaf collapse levels to produce summary cells"
  - "Dimension disambiguation uses two-stage approach: visible header key sets first, then data field value matching for hidden keys"
  - "Benchmark 4 (500+ cards) is informational only with no pass/fail assertion per locked decision"

patterns-established:
  - "suppressedCollapseKeys pattern: pre-compute suppression set before aggregate injection loops"
  - "Aggregate proxy lookup: parseCellKey + prefix matching on dimension keys to collect child card_ids"
  - "makeSyntheticCells + generateCombinations: deterministic multi-axis test data generation"

requirements-completed: [DWIN-AGGREGATION, ASEL-COMPOUND, BNCH-RENDER]

# Metrics
duration: 45min
completed: 2026-03-06
---

# Phase 32 Plan 02: Deepest-Wins Aggregation + Aggregate Selection + N-Level Benchmarks Summary

**Deepest-wins suppression prevents double-counting in multi-level collapse, aggregate proxy selection makes summary cells act as card proxies, and 4 N-level benchmarks establish render timing baselines**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-03-06T22:00:00Z
- **Completed:** 2026-03-06T22:45:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Deepest-wins aggregation suppression verified across all 7 combinatorial collapse combinations for a 3-axis stack
- Aggregate proxy selection: summary cells return all underlying card_ids via prefix-matching lookup in _getCellCardIds
- Auto-reconcile transfers selection highlights between summary and expanded cells on collapse/expand
- 4 new N-level benchmarks: 3+3 stacked axes, mixed collapse, post-reorder, 500+ card stress
- 360 SuperGrid tests passing (16 new), 2037/2041 full suite (4 pre-existing failures in SuperGridSizer)

## Task Commits

Each task was committed atomically:

1. **Task 1: Deepest-Wins Aggregation + Combinatorial Depth Tests** - `90415fa6` (test: failing) -> `38d4f8b3` (feat: implementation)
2. **Task 2: Aggregate Summary Cell Selection + Auto-Reconcile** - `9e416c7e` (feat: implementation + tests)
3. **Task 3: N-Level Render Performance Benchmarks** - `ccb90db4` (feat: benchmarks)

## Files Created/Modified
- `src/views/SuperGrid.ts` - Added suppressedCollapseKeys pre-computation, refactored aggregate injection to iterate _collapsedSet directly with dimension disambiguation, extended _getCellCardIds with aggregate proxy lookup via parseCellKey + prefix matching
- `tests/views/SuperGrid.test.ts` - 16 new tests: 9 deepest-wins combinatorial depth tests + 7 aggregate selection/auto-reconcile tests
- `tests/views/SuperGrid.bench.ts` - Complete rewrite: preserved existing 100-card benchmark, added 4 N-level benchmarks with mulberry32 PRNG, makeSyntheticCells, generateCombinations helpers

## Decisions Made
- Deepest-wins suppression is render-time only -- suppressedCollapseKeys computed fresh on every _renderCells call. The user model (_collapsedSet/_collapseModeMap) is never mutated, preserving correct toggle behavior.
- Aggregate injection was refactored from iterating visibleLeafColCells/visibleLeafRowCells to iterating _collapsedSet directly. This was necessary because buildHeaderCells skips deeper-level cells entirely when a parent is collapsed, making leaf-level iteration insufficient for non-leaf collapse.
- Dimension disambiguation (col vs row) uses colHeaderKeySet/rowHeaderKeySet for visible headers, plus data field value matching for hidden keys. Collapse keys share 0-based level numbering across dimensions.
- Benchmark 4 (500+ cards) is informational only with no assertion -- jsdom overhead makes absolute timing meaningless, but relative comparisons remain valid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Summary cell detection via D3 __data__ binding instead of data-key attribute**
- **Found during:** Task 1 (deepest-wins tests)
- **Issue:** Plan suggested checking `data-key` attribute for `summary:` prefix, but the `data-key` attribute uses the raw cell key without the summary prefix. The `summary:` prefix only appears in the D3 join key function.
- **Fix:** Used D3's `__data__` binding (`(cell as any).__data__?.isSummary`) to detect summary cells
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** All 9 combinatorial depth tests pass
- **Committed in:** 38d4f8b3 (Task 1 commit)

**2. [Rule 1 - Bug] Aggregate injection loop iterated only leaf-level header cells**
- **Found during:** Task 1 (deepest-wins implementation)
- **Issue:** Existing code iterated `visibleLeafColCells` which only contains deepest-level header cells. When a non-leaf level is collapsed, `buildHeaderCells` removes all deeper-level cells from output, so no representative exists at the leaf level for that collapsed group.
- **Fix:** Refactored aggregate injection to iterate `_collapsedSet` directly, validating each key against dimension-specific header key sets and data field values
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** All 7 combinatorial collapse tests produce correct summary cell counts
- **Committed in:** 38d4f8b3 (Task 1 commit)

**3. [Rule 1 - Bug] visibleColValueToStart missing entries for non-leaf collapsed headers**
- **Found during:** Task 1 (deepest-wins tests)
- **Issue:** Summary cells for non-leaf collapsed col headers needed grid column positions, but `visibleColValueToStart` only contained leaf-level entries
- **Fix:** Added position entries from the header cell's `colStart` property when injecting non-leaf collapse keys
- **Files modified:** src/views/SuperGrid.ts
- **Verification:** Non-leaf summary cells render at correct grid positions
- **Committed in:** 38d4f8b3 (Task 1 commit)

**4. [Rule 1 - Bug] Heat map test expected background color on cells with SuperCards**
- **Found during:** Task 1 (heat map consistency test)
- **Issue:** Test expected `d3.interpolateBlues` backgroundColor on summary cells, but in matrix mode cells with count > 0 get SuperCards which clear backgroundColor
- **Fix:** Changed test to verify consistent rendering (both levels produce SuperCards with count text) rather than checking specific color values
- **Files modified:** tests/views/SuperGrid.test.ts
- **Verification:** Heat map consistency test passes
- **Committed in:** 38d4f8b3 (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs -- 1 in test detection logic, 2 in implementation, 1 in test assertions)
**Impact on plan:** All auto-fixes necessary for correctness. The core aggregate injection refactoring (deviation 2) was the most significant -- it changed the iteration strategy from header-cell-based to _collapsedSet-based, which was required for multi-level stacking to work correctly. No scope creep.

## Issues Encountered
- Pre-existing 4 test failures in SuperGridSizer.test.ts are unrelated to Phase 32 changes. Logged to deferred-items.md per scope boundary rules.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 32 goals complete: persistence validation (Plan 01) + deepest-wins aggregation + aggregate selection + benchmarks (Plan 02)
- v3.1 SuperStack milestone fully complete across Phases 28-32
- All stacked axis features (rendering, collapse, drag reorder, deepest-wins, selection, persistence) tested and benchmarked

## Self-Check: PASSED

- FOUND: src/views/SuperGrid.ts
- FOUND: tests/views/SuperGrid.test.ts
- FOUND: tests/views/SuperGrid.bench.ts
- FOUND: 32-02-SUMMARY.md
- FOUND: commit 90415fa6 (TDD red)
- FOUND: commit 38d4f8b3 (Task 1)
- FOUND: commit 9e416c7e (Task 2)
- FOUND: commit ccb90db4 (Task 3)

---
*Phase: 32-polish-and-performance*
*Completed: 2026-03-06*
