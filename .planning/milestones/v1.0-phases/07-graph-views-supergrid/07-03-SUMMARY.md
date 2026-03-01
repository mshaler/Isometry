---
phase: 07-graph-views-supergrid
plan: "03"
subsystem: ui
tags: [d3-hierarchy, d3-stratify, d3-tree, tree-view, expand-collapse, selection, views]

# Dependency graph
requires:
  - phase: 07-01
    provides: "ViewType union with 'tree' and Worker protocol infrastructure"
provides:
  - "TreeView class implementing IView (mount/render/destroy) with d3-hierarchy layout"
  - "Expand/collapse via _children stash without re-stratifying"
  - "Multi-root forest support via synthetic __forest_root__ node"
  - "Orphan card list in div.orphan-list below SVG tree"
  - "Click-to-select via SelectionProvider; shift-click for multi-select"
  - "TreeView exported from src/views/index.ts"
affects:
  - src/views/TreeView.ts
  - src/views/index.ts
  - tests/views/TreeView.test.ts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "d3.stratify() + d3.tree() top-down vertical layout for IView hierarchy rendering"
    - "_children stash pattern for expand/collapse without re-stratifying (preserves root object)"
    - "Synthetic '__forest_root__' node for multi-root forest rendering (invisible in DOM)"
    - "SVGGElement click via dispatchEvent(MouseEvent) in jsdom tests (SVG elements lack .click())"
    - "SelectionProviderLike interface for testable injection without full SelectionProvider import"

key-files:
  created:
    - src/views/TreeView.ts
    - tests/views/TreeView.test.ts
  modified:
    - src/views/index.ts

key-decisions:
  - "Top-down vertical layout (root at top, children below) — chosen because 'contains' hierarchy reads naturally top-to-bottom"
  - "Re-stratify guard: compares current card ID set to existing root descendants — only re-stratifies on set change, not every render"
  - "SVG click events in jsdom dispatched via dispatchEvent(MouseEvent) because SVGGElement has no .click() method"
  - "SelectionProviderLike as minimal injectable interface — avoids coupling TreeView to concrete SelectionProvider"

patterns-established:
  - "Collapse _children stash: node.children → node._children on collapse; restore on expand. Never re-stratify."
  - "Orphan classification: cards not in any source/target of treeLabel connections → div.orphan-list"
  - "Forest root injection: multiple roots detected → inject __forest_root__ with parentId=null, roots become its children"
  - "D3 data join key function d => d.data.id (for HierarchyNodes) mandatory per VIEW-09"

requirements-completed: [REND-01, REND-05]

# Metrics
duration: 7min
completed: 2026-02-28
---

# Phase 7 Plan 03: TreeView Summary

**Collapsible tree hierarchy view using d3.stratify()+d3.tree() top-down layout, _children expand/collapse without re-stratifying, orphan card list, and SelectionProvider integration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-02-28T20:02:07Z
- **Completed:** 2026-02-28T20:08:47Z
- **Tasks:** 2 (merged as TDD RED+GREEN)
- **Files modified:** 3

## Accomplishments

- TreeView implements IView with full mount/render/destroy lifecycle
- d3.stratify() builds hierarchy from connections filtered by treeLabel; d3.tree() computes top-down vertical layout with 120px horizontal and 80px vertical node spacing
- Expand/collapse via _children stash — clicking a parent toggles children visibility without re-stratifying or re-querying the bridge
- Multi-root forests rendered via synthetic invisible `__forest_root__` node; only real card nodes appear in DOM
- Orphan cards (no connections of selected label) rendered in a separate HTML `div.orphan-list` below the SVG
- Click selects via SelectionProvider.toggle; shift-click calls addToSelection without collapsing
- D3 key function `d => d.data.id` on every `.data()` call (VIEW-09 compliant)
- 28 new tests, all passing; 896 total tests in suite, zero regressions

## Task Commits

1. **TDD RED: Failing test suite** - `3d658a6` (test)
2. **TDD GREEN: TreeView implementation + index export** - `bc6e02c` (feat)

## Files Created/Modified

- `src/views/TreeView.ts` — Full TreeView implementation: IView lifecycle, d3-hierarchy layout, expand/collapse, orphan list, selection integration
- `tests/views/TreeView.test.ts` — 28 tests: mount structure, empty render, hierarchical rendering, multi-root, key function, destroy, expand/collapse, selection, index export
- `src/views/index.ts` — Added `export { TreeView } from './TreeView'`

## Decisions Made

- **Top-down vertical layout**: nodeSize([120, 80]) with root at top — best fit for 'contains' hierarchy which reads naturally top-to-bottom
- **Re-stratify guard**: compare current card ID set to root descendants — re-stratify only when the set of tree nodes changes, not on every render call; preserves collapse state across data refreshes
- **jsdom SVG click**: `dispatchEvent(new MouseEvent('click', {bubbles: true}))` instead of `.click()` because `SVGGElement` in jsdom has no `.click()` method
- **SelectionProviderLike**: minimal injectable interface (toggle, addToSelection, getSelected, subscribe) defined in TreeView.ts — decouples TreeView from concrete SelectionProvider for testability

## Deviations from Plan

None — plan executed exactly as written. Tests were split across describe blocks per feature area rather than one flat list, which improved readability without changing coverage.

The plan specified Tasks 1 and 2 separately; both were implemented in a single RED-GREEN TDD cycle since expand/collapse, selection, and the basic layout are tightly coupled in the same file.

## Issues Encountered

- `SVGGElement.click is not a function` in jsdom: SVG elements don't have a `.click()` method. Fixed by using `dispatchEvent(new MouseEvent('click', {bubbles: true}))` in all click-interaction tests. Documented as established pattern for future graph view tests.
- `exactOptionalPropertyTypes: true` TS error on `node._children = undefined`: Fixed by using `delete node._children` for expand (clears the optional property) and `(node as any).children = undefined` for collapse (sets the non-optional children to undefined).

## Next Phase Readiness

- TreeView is complete and registered in views/index.ts
- Phase 7 Plan 04 (SuperGrid) can proceed — it depends only on 07-01 and 07-02
- Phase 7 Plan 02 (NetworkView) is not yet executed — it depends on 07-01

## Self-Check: PASSED

- FOUND: src/views/TreeView.ts
- FOUND: tests/views/TreeView.test.ts
- FOUND: 07-03-SUMMARY.md
- FOUND: commit 3d658a6 (test: failing TreeView tests)
- FOUND: commit bc6e02c (feat: TreeView implementation)

---
*Phase: 07-graph-views-supergrid*
*Completed: 2026-02-28*
