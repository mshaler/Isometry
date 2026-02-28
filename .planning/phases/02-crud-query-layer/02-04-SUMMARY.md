---
phase: 02-crud-query-layer
plan: 04
subsystem: database
tags: [sql.js, sqlite, recursive-cte, graph-traversal, typescript, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-crud-query-layer
    plan: 01
    provides: Database class, CardWithDepth type, rowToCard helper, createCard/deleteCard
  - phase: 02-crud-query-layer
    plan: 02
    provides: createConnection for building test graph topology

provides:
  - "connectedCards: depth-limited bidirectional graph traversal via recursive CTE"
  - "shortestPath: BFS path-string CTE returning card ID chain between two nodes"
  - "Cycle-safe traversal using UNION dedup + min_depth subquery"

affects: [Phase 5 network/tree views, Phase 3 performance optimization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Recursive CTE with UNION for cycle prevention (deduplicates card_id+depth pairs)"
    - "min_depth subquery collapses multi-depth duplicates to minimum depth per card_id"
    - "Bidirectional edge follow: CASE WHEN source_id=card_id THEN target_id ELSE source_id END"
    - "Path string accumulation in shortestPath: comma-separated IDs with LIKE-based cycle guard"

key-files:
  created:
    - src/database/queries/graph.ts
    - tests/database/graph.test.ts
  modified: []

key-decisions:
  - "min_depth subquery required: UNION deduplicates (card_id, depth) pairs not just card_id — same card reachable at multiple depths generates duplicates without GROUP BY MIN(depth)"
  - "shortestPath path string accumulation: LIKE check guards against revisiting nodes (cannot rely on UNION dedup since UNION collapses paths sharing a node)"
  - "shortestPath hard-limited to depth 10 to prevent unbounded recursion on large graphs"
  - "Pre-existing TypeScript errors in search.test.ts (from plan 02-03) are out-of-scope — graph.ts introduces zero new TS errors"

patterns-established:
  - "Graph CTE pattern: RECURSIVE traversal CTE + min_depth CTE + final JOIN to cards with deleted_at IS NULL"

requirements-completed: [PERF-04]

# Metrics
duration: 2min
completed: 2026-02-28
---

# Phase 2 Plan 04: Graph Traversal Summary

**Recursive CTE graph traversal with cycle-safe depth-limited BFS (connectedCards) and shortest-path string-accumulation (shortestPath), running entirely in SQLite/WASM**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-28T11:04:38Z
- **Completed:** 2026-02-28T11:06:50Z
- **Tasks:** 2 (RED + GREEN TDD phases)
- **Files modified:** 2

## Accomplishments

- Implemented connectedCards with recursive CTE, bidirectional traversal, and automatic cycle prevention
- Implemented shortestPath returning ordered card ID arrays for the shortest BFS route
- 19 new tests covering depth limits, bidirectionality, cycles, and null/empty path cases
- 131/131 total tests passing across all Phase 1 and Phase 2 modules

## Task Commits

Each task was committed atomically:

1. **Task 1: RED — Failing tests for graph traversal** - `7733cb5` (test)
2. **Task 2: GREEN — graph.ts implementation** - `590239e` (feat)

_TDD execution: RED (failing tests committed) then GREEN (implementation committed, includes auto-fix)_

## Files Created/Modified

- `src/database/queries/graph.ts` - connectedCards (recursive CTE, bidirectional, depth-limited) and shortestPath (BFS path accumulation)
- `tests/database/graph.test.ts` - 19 TDD tests covering PERF-04 functional requirements

## Decisions Made

- **min_depth subquery required:** UNION in the recursive CTE deduplicates `(card_id, depth)` pairs, not just `card_id`. In a bidirectional graph, the same card is reachable at multiple depth levels via different paths, producing duplicates in the outer `SELECT DISTINCT`. A `min_depth` CTE using `GROUP BY card_id, MIN(depth)` collapses this correctly.
- **shortestPath path accumulation:** Path string stored as comma-separated IDs. A `LIKE` check prevents revisiting nodes. UNION-based dedup is insufficient for shortestPath since collapsing paths sharing a node would eliminate valid BFS branches.
- **Hard depth limit 10 for shortestPath:** Prevents unbounded recursion on large graphs. Meaningful shortest paths in practice are well under 10 hops.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate results in connectedCards due to multi-depth card reachability**
- **Found during:** Task 2 (GREEN — graph.ts implementation)
- **Issue:** Plan's `SELECT DISTINCT cards.*, traversal.depth` failed because UNION deduplicates (card_id, depth) pairs — a card reachable at depths 1, 2, and 3 via different paths produced 3 rows for the same card. Tests expecting 5 results received 7.
- **Fix:** Added `min_depth AS (SELECT card_id, MIN(depth) FROM traversal WHERE card_id != ? GROUP BY card_id)` subquery between the CTE and the final JOIN. This collapses all depth variants to the minimum (BFS-correct) depth per card before joining to `cards`.
- **Files modified:** `src/database/queries/graph.ts`
- **Verification:** 19/19 graph tests passing, including all depth-count tests and cycle prevention tests
- **Committed in:** `590239e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in CTE deduplication strategy)
**Impact on plan:** Required fix for correctness — multi-depth duplicates produced wrong result counts. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Graph traversal fully operational with cycle-safe UNION-based BFS
- connectedCards and shortestPath ready for Phase 5 network/tree view consumption
- All Phase 2 query modules complete (cards, connections, search, graph)
- src/index.ts exports all Phase 2 modules (pre-declared in Plan 02-01)
- Phase 2 complete — ready for Plan 02-05 (performance benchmarks)

## Self-Check: PASSED

- FOUND: src/database/queries/graph.ts
- FOUND: tests/database/graph.test.ts
- FOUND: .planning/phases/02-crud-query-layer/02-04-SUMMARY.md
- FOUND: commit 7733cb5 (RED phase)
- FOUND: commit 590239e (GREEN phase)
- All 131 tests passing

---
*Phase: 02-crud-query-layer*
*Completed: 2026-02-28*
