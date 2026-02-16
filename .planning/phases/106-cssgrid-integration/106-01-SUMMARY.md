---
phase: 106-cssgrid-integration
plan: 01
subsystem: supergrid-adapters
tags: [adapter, type-bridge, integration]
dependency_graph:
  requires:
    - superstack/types/superstack (HeaderTree, HeaderNode, FacetConfig)
    - components/supergrid/types (AxisConfig, AxisNode, LATCHAxisType)
  provides:
    - headerTreeToAxisConfig adapter function
    - convertHeaderNode helper function
  affects:
    - Phase 106-02 (useGridDataCells hook will use this adapter)
    - Phase 106-03 (IntegratedLayout component will use this adapter)
tech_stack:
  added: []
  patterns:
    - Pure transformation functions (no side effects)
    - Recursive tree conversion
    - Type-safe mapping with explicit error handling
key_files:
  created:
    - src/components/supergrid/adapters/headerTreeAdapter.ts
    - src/components/supergrid/adapters/__tests__/headerTreeAdapter.test.ts
  modified: []
decisions:
  - id: ADAPT-01
    summary: "Root AxisNode wrapper required for SuperGridCSS tree structure"
    rationale: "SuperGridCSS expects tree.children to be the roots, HeaderTree stores roots directly"
  - id: ADAPT-02
    summary: "Collapsed state inverted: HeaderNode.collapsed → AxisNode.expanded"
    rationale: "SuperGridCSS uses expanded flag (default true), HeaderTree uses collapsed flag"
  - id: ADAPT-03
    summary: "Leaf nodes have undefined children, not empty array"
    rationale: "Distinguishes leaf nodes from parent nodes with no children yet"
metrics:
  duration_seconds: 161
  completed_date: 2026-02-16T01:20:35Z
  tasks_completed: 2
  tests_added: 13
  files_created: 2
  commits: 2
---

# Phase 106 Plan 01: HeaderTree to AxisConfig Adapter Summary

**One-liner:** Pure transformation adapter bridging HeaderDiscoveryService output (HeaderTree) to SuperGridCSS input (AxisConfig) with recursive node conversion and field mapping.

## Objective

Create the HeaderTree to AxisConfig adapter function that bridges HeaderDiscoveryService output to SuperGridCSS input. This adapter is the core type bridge for Phase 106, enabling the two systems to communicate.

## Completed Tasks

### Task 1: Create adapter function with type mappings

**Status:** ✅ Complete
**Commit:** `2aee38ef`
**Files:** `src/components/supergrid/adapters/headerTreeAdapter.ts`

Created two exported functions:

1. **`headerTreeToAxisConfig(headerTree: HeaderTree): AxisConfig`**
   - Extracts primary facet (first in facets array)
   - Maps facet.axis to LATCHAxisType (both use 'L' | 'A' | 'T' | 'C' | 'H')
   - Creates root AxisNode wrapping converted roots
   - Returns AxisConfig with type, facet sourceColumn, and tree

2. **`convertHeaderNode(node: HeaderNode): AxisNode`**
   - Maps label, id (direct copy)
   - Maps span → leafCount
   - Maps collapsed → expandable (!collapsed && hasChildren)
   - Maps collapsed → expanded (!collapsed)
   - Recursively converts children
   - Returns undefined children for leaf nodes (not empty array)

**Error handling:**
- Throws TypeError if headerTree is null/undefined
- Throws Error if facets array is empty (can't determine axis type)
- Handles empty roots array gracefully (returns tree with empty children)

**Documentation:** JSDoc comments document all field mappings.

### Task 2: Create unit tests for adapter

**Status:** ✅ Complete
**Commit:** `5b719727`
**Files:** `src/components/supergrid/adapters/__tests__/headerTreeAdapter.test.ts`

Created 13 unit tests covering:

**headerTreeToAxisConfig suite (9 tests):**
1. Converts single-level tree correctly
2. Maps HeaderNode.span to AxisNode.leafCount
3. Recursively converts nested children
4. Handles empty roots array
5. Throws on empty facets array
6. Throws on null/undefined headerTree
7. Maps collapsed=true to expandable=false
8. Preserves id and label through conversion
9. Returns undefined children for leaf nodes

**convertHeaderNode suite (4 tests):**
1. Converts leaf node correctly
2. Converts parent node with children
3. Handles collapsed parent correctly
4. Maps LATCH axis types correctly (all 5 types)

**Test results:** All 13 tests pass in 4ms.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

✅ `npx tsc --noEmit` passes with no errors
✅ `npm run test -- headerTreeAdapter` passes all 13 tests
✅ Adapter exports visible in IDE autocomplete

## Success Criteria

✅ INT-01 requirement satisfied: HeaderTree to AxisConfig adapter function exists
✅ Adapter handles normal, nested, empty, and collapsed HeaderTree inputs
✅ All unit tests pass
✅ No TypeScript compilation errors

## Key Technical Decisions

### ADAPT-01: Root AxisNode Wrapper

**Decision:** Create a root AxisNode with id='root', label='Root', wrapping all converted roots in children array.

**Rationale:** SuperGridCSS expects `tree: AxisNode` with `tree.children` as the roots. HeaderTree stores roots directly in `roots: HeaderNode[]`. The adapter creates the wrapper node to match SuperGridCSS expectations.

**Impact:** All SuperGridCSS consumers will see a root node wrapping the actual data hierarchy.

### ADAPT-02: Collapsed State Inversion

**Decision:** Map `HeaderNode.collapsed` to both `AxisNode.expandable` and `AxisNode.expanded` with inversion logic:
- `expandable = hasChildren && !collapsed`
- `expanded = !collapsed`

**Rationale:** HeaderTree uses `collapsed: boolean` (default false = visible). SuperGridCSS uses `expanded: boolean` (default true = visible). The adapter inverts the flag semantics.

**Impact:** Collapsed headers in HeaderTree will render as non-expandable/non-expanded in SuperGridCSS.

### ADAPT-03: Undefined vs Empty Array for Children

**Decision:** Leaf nodes return `undefined` for children, not `[]`.

**Rationale:** Distinguishes leaf nodes (never had children) from parent nodes that currently have no children. Enables better type narrowing in consumers.

**Impact:** Consumers must check `if (node.children)` not `if (node.children.length)`.

## Performance Notes

- **Adapter execution:** Pure function, no I/O, runs in <1ms for typical trees
- **Test execution:** 13 tests complete in 4ms total
- **Memory:** Recursive conversion creates new objects, no mutation of input

## Next Steps

**Immediate (Phase 106-02):** Create `useGridDataCells` hook that uses this adapter to populate SuperGridCSS with live data.

**Blocked by this plan:**
- Phase 106-02: useGridDataCells hook (needs adapter output)
- Phase 106-03: IntegratedLayout integration (needs adapter in render path)

## Files Created

### src/components/supergrid/adapters/headerTreeAdapter.ts (89 lines)

Exports:
- `headerTreeToAxisConfig(headerTree: HeaderTree): AxisConfig`
- `convertHeaderNode(node: HeaderNode): AxisNode`

Imports:
- `HeaderTree`, `HeaderNode`, `FacetConfig` from `@/superstack/types/superstack`
- `AxisConfig`, `AxisNode`, `LATCHAxisType` from `../types`

### src/components/supergrid/adapters/__tests__/headerTreeAdapter.test.ts (306 lines)

Test fixtures:
- `mockFacet`: FacetConfig with axis='C', sourceColumn='folder'
- `mockLeafNode`: Single-level HeaderNode
- `mockParentNode`: Two-level HeaderNode with 2 children
- `mockCollapsedNode`: Collapsed parent with hidden children
- `mockHeaderTree`: Complete HeaderTree with nested structure

Test coverage:
- 9 tests for `headerTreeToAxisConfig`
- 4 tests for `convertHeaderNode`
- All edge cases (null, empty, collapsed, nested)

## Self-Check

**Files exist:**

```bash
[FOUND] src/components/supergrid/adapters/headerTreeAdapter.ts
[FOUND] src/components/supergrid/adapters/__tests__/headerTreeAdapter.test.ts
```

**Commits exist:**

```bash
[FOUND] 2aee38ef - feat(106-01): create HeaderTree to AxisConfig adapter
[FOUND] 5b719727 - test(106-01): add unit tests for HeaderTree adapter
```

**Self-Check: PASSED** ✅

All claimed files and commits verified on disk and in git history.
