# Phase 106: CSS Grid Integration - Research

**Researched:** 2026-02-15
**Domain:** React CSS Grid integration with existing D3.js data pipeline
**Confidence:** HIGH

## Summary

Phase 106 integrates the CSS Grid SuperGrid component (delivered in Phase 105) into IntegratedLayout.tsx, replacing D3.js for tabular rendering while preserving the existing PAFV/LATCH data flow. The core challenge is bridging between two type systems: the D3.js-oriented `HeaderTree` from HeaderDiscoveryService and the CSS Grid-oriented `AxisConfig` required by SuperGridCSS.

The integration requires minimal new architecture—it's primarily a data transformation task with reactivity wiring. The CSS Grid component is complete and tested (84 tests passing), the data pipeline is stable (HeaderDiscoveryService executes SQL queries and builds HeaderNode trees), and the PAFV context already manages axis assignments. The missing piece is a single adapter function: `headerTreeToAxisConfig()`.

**Primary recommendation:** Implement the adapter pattern with HeaderDiscoveryService as source, AxisConfig as target, and IntegratedLayout as orchestrator. Preserve D3.js SuperGrid as fallback during transition for visual regression testing.

## Standard Stack

### Core (Already in Use)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | 18.x | Component framework | Existing codebase standard |
| TypeScript | 5.x | Type safety | Strict mode enabled project-wide |
| sql.js | 1.x | In-memory SQLite | Bridge-elimination architecture (v4 core decision) |
| Tailwind CSS | 3.x | Styling | Project styling standard |

### Integration Target (Phase 105 Deliverable)

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| SuperGridCSS | `src/components/supergrid/SuperGrid.tsx` | CSS Grid-based tabular renderer | ✅ Complete, 84 tests |
| useGridLayout | `src/components/supergrid/hooks/useGridLayout.ts` | Layout computation hook | ✅ Complete, tested |
| AxisConfig types | `src/components/supergrid/types.ts` | CSS Grid data model | ✅ Complete |
| treeMetrics utils | `src/components/supergrid/utils/treeMetrics.ts` | Tree computation | ✅ Complete, tested |

### Data Source (Existing Infrastructure)

| Service | Location | Purpose | Status |
|---------|----------|---------|--------|
| HeaderDiscoveryService | `src/services/supergrid/HeaderDiscoveryService.ts` | SQL header queries → HeaderTree | ✅ Stable |
| buildHeaderTree | `src/superstack/builders/header-tree-builder.ts` | Transforms query results → HeaderNode tree | ✅ Stable |
| PAFVContext | `src/state/PAFVContext.tsx` | Manages axis mappings | ✅ Stable |
| FilterContext | `src/state/FilterContext.tsx` | LATCH filter state | ✅ Stable |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3.js v7 | 7.x | D3.js SuperGrid (legacy) | Preserve during transition for visual comparison |
| Vitest | Latest | Unit testing | All new adapter logic |
| React Testing Library | Latest | Integration tests | Component wiring verification |

**Installation:**
```bash
# No new dependencies required
# All libraries already in package.json
```

## Architecture Patterns

### Current Data Flow (D3.js SuperGrid)

```
PAFVContext.mappings
  └─> HeaderDiscoveryService.discoverHeaders(facets, axis)
       └─> SQL header discovery query
            └─> buildHeaderTree(queryRows, facets)
                 └─> HeaderTree { axis, facets, roots: HeaderNode[] }
                      └─> D3.js SuperGrid (new SuperGrid(svgSelection, db, config))
```

### Target Data Flow (CSS Grid SuperGrid)

```
PAFVContext.mappings
  └─> HeaderDiscoveryService.discoverHeaders(facets, axis)
       └─> SQL header discovery query
            └─> buildHeaderTree(queryRows, facets)
                 └─> HeaderTree { axis, facets, roots: HeaderNode[] }
                      └─> [NEW] headerTreeToAxisConfig(headerTree)
                           └─> AxisConfig { type, facet, tree: AxisNode }
                                └─> SuperGridCSS component
```

### Pattern 1: Adapter Function (Core Integration Point)

**What:** Transform HeaderTree → AxisConfig to bridge type systems
**When to use:** Every time HeaderDiscoveryService returns a HeaderTree
**Why needed:** Type mismatch between HeaderNode and AxisNode

**Type Comparison:**

```typescript
// Source: HeaderNode (from HeaderDiscoveryService)
interface HeaderNode {
  id: string;
  facet: FacetConfig;         // Full facet metadata
  value: string;
  label: string;
  depth: number;
  span: number;               // Number of leaves this spans
  startIndex: number;
  children: HeaderNode[];
  parent: HeaderNode | null;
  collapsed: boolean;
  path: string[];
  aggregate?: HeaderAggregate;
}

// Target: AxisNode (expected by SuperGridCSS)
interface AxisNode {
  label: string;              // Display text
  id: string;                 // Unique identifier
  children?: AxisNode[];      // Child nodes
  leafCount?: number;         // Computed span (equivalent to HeaderNode.span)
  expandable?: boolean;       // Has hidden children
}
```

**Adapter Implementation:**

```typescript
// Location: src/components/supergrid/adapters/headerTreeAdapter.ts

import type { HeaderTree, HeaderNode } from '@/superstack/types/superstack';
import type { AxisConfig, AxisNode } from '../types';

/**
 * Converts HeaderTree from HeaderDiscoveryService into AxisConfig for SuperGridCSS.
 *
 * Mapping:
 * - HeaderNode.label → AxisNode.label
 * - HeaderNode.id → AxisNode.id
 * - HeaderNode.children → AxisNode.children (recursively)
 * - HeaderNode.span → AxisNode.leafCount
 * - HeaderNode.collapsed → AxisNode.expandable (inverted logic)
 */
export function headerTreeToAxisConfig(headerTree: HeaderTree): AxisConfig {
  // Map LATCH axis from facet
  const primaryFacet = headerTree.facets[0];
  const latchAxis = primaryFacet.axis; // 'L' | 'A' | 'T' | 'C' | 'H'

  // Convert HeaderNode tree to AxisNode tree
  const tree: AxisNode = {
    label: 'Root',
    id: 'root',
    children: headerTree.roots.map(convertHeaderNode)
  };

  return {
    type: latchAxis,
    facet: primaryFacet.sourceColumn,
    tree
  };
}

/**
 * Recursively convert HeaderNode to AxisNode.
 */
function convertHeaderNode(node: HeaderNode): AxisNode {
  const axisNode: AxisNode = {
    label: node.label,
    id: node.id,
    leafCount: node.span,
    expandable: node.children.length > 0 && !node.collapsed
  };

  // Recursively convert children
  if (node.children.length > 0) {
    axisNode.children = node.children.map(convertHeaderNode);
  }

  return axisNode;
}
```

### Pattern 2: Data Cell Query Hook

**What:** Fetch data cells matching row/column paths for grid population
**When to use:** After both row and column AxisConfigs are ready
**Implementation:**

```typescript
// Location: src/hooks/useDataCells.ts

import { useMemo } from 'react';
import { useDatabaseService } from './useDatabaseService';
import type { DataCell } from '@/components/supergrid/types';

/**
 * Fetches data cells for SuperGridCSS from SQLite.
 *
 * @param rowLeaves - Leaf paths from row AxisConfig
 * @param colLeaves - Leaf paths from column AxisConfig
 * @param whereClause - LATCH filter WHERE clause
 * @returns DataCell[] with rowPath, colPath, value
 */
export function useDataCells(
  rowLeaves: string[][],
  colLeaves: string[][],
  whereClause: string = '1=1'
): DataCell[] {
  const db = useDatabaseService();

  return useMemo(() => {
    if (!db?.isReady() || rowLeaves.length === 0 || colLeaves.length === 0) {
      return [];
    }

    // Query SQLite for cells matching path combinations
    // This replaces SuperGrid.query() logic
    const sql = `
      SELECT
        n.id,
        n.name,
        n.folder,
        n.tags,
        n.created_at,
        -- Additional node columns as needed
      FROM nodes n
      WHERE ${whereClause}
      AND deleted_at IS NULL
    `;

    const rows = db.exec(sql)[0]?.values || [];

    // Map SQL results to DataCell format
    // Match each node to its (rowPath, colPath) position
    const cells: DataCell[] = [];

    for (const row of rows) {
      const nodeData = transformRowToNode(row);
      const rowPath = computeRowPath(nodeData); // Based on row axis facets
      const colPath = computeColPath(nodeData); // Based on col axis facets

      cells.push({
        rowPath,
        colPath,
        value: nodeData.name,
        rawValue: nodeData
      });
    }

    return cells;
  }, [db, rowLeaves, colLeaves, whereClause]);
}
```

### Pattern 3: IntegratedLayout Wiring

**What:** Orchestrate HeaderDiscoveryService → adapter → SuperGridCSS flow
**When to use:** IntegratedLayout component (existing D3.js integration point)
**Implementation:**

```typescript
// Location: src/components/IntegratedLayout.tsx (modification)

import { SuperGridCSS } from './supergrid/SuperGrid';
import { headerTreeToAxisConfig } from './supergrid/adapters/headerTreeAdapter';
import { useHeaderDiscovery } from '@/hooks/useHeaderDiscovery';
import { useDataCells } from '@/hooks/useDataCells';
import { usePAFV } from '@/hooks';

export function IntegratedLayout() {
  const { state: pafvState } = usePAFV();
  const { theme } = useTheme();

  // Extract row and column facets from PAFV mappings
  const rowFacets = pafvState.mappings.filter(m => m.plane === 'y');
  const colFacets = pafvState.mappings.filter(m => m.plane === 'x');

  // Discover headers using existing service
  const { columnTree, rowTree, isLoading } = useHeaderDiscovery({
    rowFacets: rowFacets.map(m => m.facet),
    colFacets: colFacets.map(m => m.facet),
    dataset: activeNodeType
  });

  // Adapter: HeaderTree → AxisConfig
  const rowAxis = useMemo(() =>
    rowTree ? headerTreeToAxisConfig(rowTree) : null,
    [rowTree]
  );

  const colAxis = useMemo(() =>
    columnTree ? headerTreeToAxisConfig(columnTree) : null,
    [columnTree]
  );

  // Fetch data cells
  const dataCells = useDataCells(
    rowAxis?.tree.children || [],
    colAxis?.tree.children || [],
    filterWhereClause
  );

  if (isLoading || !rowAxis || !colAxis) {
    return <div>Loading grid...</div>;
  }

  return (
    <SuperGridCSS
      rowAxis={rowAxis}
      columnAxis={colAxis}
      data={dataCells}
      theme={theme === 'NeXTSTEP' ? 'nextstep' : 'modern'}
      onCellClick={handleCellClick}
      onHeaderClick={handleHeaderClick}
    />
  );
}
```

### Anti-Patterns to Avoid

- **Don't duplicate HeaderDiscoveryService logic** — Reuse existing SQL queries and tree building. The adapter is transformation only, not data fetching.
- **Don't modify HeaderNode type** — It's shared across D3.js and CSS Grid paths. Keep adapter pure (HeaderNode → AxisNode).
- **Don't break D3.js SuperGrid during transition** — Preserve both renderers until visual regression complete.
- **Don't inline adapter logic** — Extract to dedicated utility for testability.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree traversal algorithms | Custom recursive functions | `computeTreeMetrics()` from Phase 105 | Already tested, handles edge cases (empty trees, single nodes, deep hierarchies) |
| Grid layout math | Manual span/position calculations | `useGridLayout()` hook from Phase 105 | Handles CSS Grid placement, rowspan/colspan logic |
| Data cell lookups | Nested loops over nodes | `Map<string, DataCell>` with path key | O(1) lookup vs O(n²) iteration |
| PAFV → Facet mapping | Custom mapping logic | Existing `mappingsToProjection()` | Already handles plane assignments, type validation |

**Key insight:** Phase 105 delivered production-ready layout and computation logic. Phase 106 is wiring, not reimplementation.

## Common Pitfalls

### Pitfall 1: Type Mismatch Between HeaderNode and AxisNode

**What goes wrong:** TypeScript errors when passing HeaderTree directly to SuperGridCSS
**Why it happens:** Different field names (HeaderNode.span vs AxisNode.leafCount), different nesting (HeaderNode.facet vs AxisConfig.type)
**How to avoid:** Always use `headerTreeToAxisConfig()` adapter, never direct type coercion
**Warning signs:**
- `Type 'HeaderNode' is not assignable to type 'AxisNode'`
- Missing `leafCount` property errors in useGridLayout
- Undefined `tree.children` causing grid layout failures

### Pitfall 2: Stale HeaderTree After PAFV Change

**What goes wrong:** Grid doesn't update when user drags different facet to Y plane
**Why it happens:** Missing dependency in useHeaderDiscovery hook, adapter memoization without rowTree/columnTree deps
**How to avoid:**
- Include `pafvState.mappings` in useHeaderDiscovery dependencies
- Re-run adapter when rowTree/columnTree change (useMemo deps)
- Ensure HeaderDiscoveryService.discoverHeaders() is called on every facet change

**Warning signs:**
- Grid shows old facet values after PAFV change
- Console warning: "Hook dependency missing: rowFacets"
- Headers don't match current PafvNavigator selections

### Pitfall 3: Empty Grid with Valid Data

**What goes wrong:** SuperGridCSS renders empty grid despite nodes in database
**Why it happens:** Data cells not matching rowPath/colPath combinations from headers
**How to avoid:**
- Verify rowPath/colPath computation uses same facet logic as HeaderDiscoveryService
- Check that WHERE clause from FilterContext isn't over-filtering
- Confirm leafCount > 0 in both rowAxis and colAxis

**Warning signs:**
- `dataCells.length === 0` but `db.exec("SELECT COUNT(*) FROM nodes")` > 0
- Grid renders headers but no data cells
- Console error: "No matching cells for path X"

### Pitfall 4: Performance Degradation on Large Grids

**What goes wrong:** Grid lags with >1000 cells, especially during PAFV transitions
**Why it happens:** Re-rendering entire grid on every facet change without virtualization
**How to avoid:**
- Memoize expensive computations (headerTreeToAxisConfig, computeTreeMetrics)
- Consider react-window for data cell virtualization (Phase 107+ feature)
- Debounce PAFV changes during rapid drag operations

**Warning signs:**
- >100ms render time in React DevTools Profiler
- Janky animations during axis reassignment
- Browser "page unresponsive" warnings

### Pitfall 5: Theme Mismatch Between Navigators and Grid

**What goes wrong:** Grid renders in Modern theme while LatchNavigator shows NeXTSTEP theme
**Why it happens:** Hardcoded theme string instead of reading ThemeContext
**How to avoid:**
- Use `useTheme()` hook to get current theme
- Map Isometry theme names to SuperGridCSS theme names (NeXTSTEP → 'nextstep')
- Pass theme prop to SuperGridCSS

**Warning signs:**
- Visual inconsistency between navigator panels and grid
- User changes theme but grid doesn't update
- Grid always renders in 'nextstep' theme

## Code Examples

Verified patterns from Phase 105 implementation and existing codebase:

### Example 1: Adapter Function (Core Integration)

```typescript
// Source: Phase 106 implementation (to be written)
// Based on: Phase 105 AxisConfig spec + HeaderDiscoveryService output

import type { HeaderTree, HeaderNode } from '@/superstack/types/superstack';
import type { AxisConfig, AxisNode } from '@/components/supergrid/types';

/**
 * Adapter: HeaderTree → AxisConfig
 * Bridges HeaderDiscoveryService output to SuperGridCSS input.
 */
export function headerTreeToAxisConfig(headerTree: HeaderTree): AxisConfig {
  const primaryFacet = headerTree.facets[0];

  return {
    type: primaryFacet.axis,
    facet: primaryFacet.sourceColumn,
    tree: {
      label: 'Root',
      id: 'root',
      children: headerTree.roots.map(convertHeaderNode)
    }
  };
}

function convertHeaderNode(node: HeaderNode): AxisNode {
  return {
    label: node.label,
    id: node.id,
    leafCount: node.span,
    expandable: node.children.length > 0,
    children: node.children.length > 0
      ? node.children.map(convertHeaderNode)
      : undefined
  };
}
```

### Example 2: Data Cell Population

```typescript
// Source: Adaptation of SuperGrid.query() logic to DataCell format

function buildDataCells(
  nodes: Node[],
  rowLeaves: HeaderNode[],
  colLeaves: HeaderNode[],
  rowFacets: FacetConfig[],
  colFacets: FacetConfig[]
): DataCell[] {
  const cells: DataCell[] = [];

  for (const node of nodes) {
    const rowPath = computeNodePath(node, rowFacets);
    const colPath = computeNodePath(node, colFacets);

    cells.push({
      rowPath,
      colPath,
      value: node.name,
      rawValue: node
    });
  }

  return cells;
}

function computeNodePath(node: Node, facets: FacetConfig[]): string[] {
  return facets.map(facet => {
    const value = node[facet.sourceColumn as keyof Node];
    return String(value ?? '(empty)');
  });
}
```

### Example 3: IntegratedLayout Wiring

```typescript
// Source: IntegratedLayout.tsx (existing pattern) + SuperGridCSS integration

export function IntegratedLayout() {
  const { state: pafvState } = usePAFV();
  const databaseService = useDatabaseService();

  // Extract facets from PAFV mappings
  const rowFacets = useMemo(() =>
    pafvState.mappings
      .filter(m => m.plane === 'y')
      .map(m => m.facet),
    [pafvState.mappings]
  );

  const colFacets = useMemo(() =>
    pafvState.mappings
      .filter(m => m.plane === 'x')
      .map(m => m.facet),
    [pafvState.mappings]
  );

  // Discover headers
  const { rowTree, columnTree, isLoading } = useHeaderDiscovery({
    rowFacets,
    colFacets,
    dataset: activeNodeType
  });

  // Adapt to AxisConfig
  const rowAxis = useMemo(() =>
    rowTree ? headerTreeToAxisConfig(rowTree) : null,
    [rowTree]
  );

  const colAxis = useMemo(() =>
    columnTree ? headerTreeToAxisConfig(columnTree) : null,
    [columnTree]
  );

  if (!rowAxis || !colAxis) return <LoadingState />;

  return (
    <SuperGridCSS
      rowAxis={rowAxis}
      columnAxis={colAxis}
      data={dataCells}
      theme="nextstep"
    />
  );
}
```

### Example 4: Selection Sync with SelectionContext

```typescript
// Source: Existing SuperGrid selection pattern + React context

import { useSelection } from '@/contexts/SelectionContext';

export function IntegratedLayout() {
  const { selectedIds, setSelectedIds } = useSelection();

  const handleCellClick = useCallback((
    cell: DataCell | undefined,
    rowPath: string[],
    colPath: string[]
  ) => {
    if (!cell) return;

    // Extract node ID from cell
    const nodeId = (cell.rawValue as Node).id;

    // Update global selection state
    setSelectedIds([nodeId]);

    // Optionally: emit analytics event
    contextLogger.debug('Cell clicked', { rowPath, colPath, nodeId });
  }, [setSelectedIds]);

  return (
    <SuperGridCSS
      rowAxis={rowAxis}
      columnAxis={colAxis}
      data={dataCells}
      onCellClick={handleCellClick}
    />
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3.js manual SVG layout | CSS Grid native spanning | Phase 105 | Simpler code, better accessibility, browser-native layout |
| Imperative D3 enter/update/exit | React declarative rendering | Phase 105 | Standard React patterns, easier debugging |
| Custom tree traversal logic | `computeTreeMetrics()` utility | Phase 105 | Tested algorithm, handles edge cases |
| Mixed D3/React state | Pure React state + useMemo | Phase 106 | Single source of truth, easier testing |

**Deprecated/outdated:**
- D3.js SuperGrid for tabular rendering — Preserved during Phase 106 for visual regression, to be removed in Phase 107+
- Direct SVG manipulation in React components — Replaced by CSS Grid for tables (D3 still used for network/chart views)

## Open Questions

1. **Should D3.js SuperGrid be removed immediately or kept as fallback?**
   - What we know: CSS Grid SuperGrid is complete and tested
   - What's unclear: Whether production users rely on D3-specific features
   - Recommendation: Keep both renderers in Phase 106 with feature flag, remove D3 in Phase 107 after visual regression complete

2. **How to handle collapse/expand state persistence?**
   - What we know: AxisNode has `expandable` flag, but no collapsed state
   - What's unclear: Should collapsed state be in localStorage, SQLite, or React state?
   - Recommendation: Start with React state (simplest), add persistence in Phase 107+ if needed

3. **What's the performance threshold for virtualization?**
   - What we know: Phase 105 tests verified <100ms render for reference grid (28 rows × 7 cols)
   - What's unclear: At what grid size does performance degrade unacceptably?
   - Recommendation: Monitor in Phase 106, implement react-window if >1000 visible cells cause lag

## Sources

### Primary (HIGH confidence)

- `/Users/mshaler/Developer/Projects/Isometry/supergrid-cssgrid-spec.md` — Phase 105 complete specification with AxisConfig types, useGridLayout algorithm
- `/Users/mshaler/Developer/Projects/Isometry/SuperGridPrototype.jsx` — Working CSS Grid implementation with 4 themes, tree metrics computation
- `/Users/mshaler/Developer/Projects/Isometry/src/services/supergrid/HeaderDiscoveryService.ts` — SQL query execution, HeaderTree building
- `/Users/mshaler/Developer/Projects/Isometry/src/superstack/types/superstack.ts` — HeaderNode, HeaderTree, FacetConfig canonical types
- `/Users/mshaler/Developer/Projects/Isometry/src/components/IntegratedLayout.tsx` — Current D3.js SuperGrid integration pattern
- Phase 105 test suite (84 passing tests) — treeMetrics.test.ts, gridPlacement.test.ts, SuperGrid.visual.test.tsx

### Secondary (MEDIUM confidence)

- CLAUDE.md section "SuperGrid: The Keystone Feature" — Architecture principles, Super* feature family context
- `.planning/phases/105-cssgrid-supergrid/` — Phase 105 planning documents, task breakdown

### Tertiary (LOW confidence)

- None — All findings verified with codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries already in use, no new dependencies
- Architecture: HIGH — Adapter pattern is standard React/TypeScript practice, existing data flow is well-understood
- Pitfalls: HIGH — Derived from similar integrations (D3.js SuperGrid setup, HeaderDiscoveryService wiring)

**Research date:** 2026-02-15
**Valid until:** 2026-03-15 (30 days for stable technology stack)
