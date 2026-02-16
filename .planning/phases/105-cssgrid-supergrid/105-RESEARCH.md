# Phase 105: CSS Grid SuperGrid - Research

**Researched:** 2026-02-15
**Domain:** CSS Grid layout, React rendering, D3.js architecture pivot
**Confidence:** HIGH (Prototype validated against reference image)

## Summary

Phase 105 replaces the D3.js-based SuperGrid tabular rendering with **pure React + CSS Grid**. This is a fundamental architecture change that eliminates coordinate calculation complexity by leveraging the browser's native grid layout engine for cell spanning.

**Key insight:** CSS Grid's `grid-row-start/end` and `grid-column-start/end` properties handle hierarchical header spanning natively, removing the need for manual coordinate math that D3.js required.

**D3.js remains for:** Charts, Network graph views, force simulations. This change affects only the tabular/pivot-table rendering mode.

## Decision: Why CSS Grid over D3.js for Tables

| Aspect | D3.js Approach | CSS Grid Approach |
|--------|---------------|-------------------|
| **Layout** | Manual SVG coordinate math | Browser-native grid layout |
| **Spanning** | Calculate rects, clip paths | `grid-row`, `grid-column` |
| **Rendering** | D3 enter/update/exit | React reconciliation |
| **Styling** | Inline SVG attributes | CSS classes, variables |
| **Accessibility** | Manual ARIA | Semantic HTML roles |
| **Debugging** | SVG inspector | DOM inspector |
| **Learning curve** | D3-specific patterns | Standard React patterns |
| **Bundle size** | D3.js included | No additional deps |

**Primary recommendation:** Use CSS Grid for all tabular/pivot rendering. D3's power is in data-driven transformations and SVG graphics—not table layout.

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2+ | Component rendering | Already in stack |
| CSS Grid | Browser native | Layout engine | Zero-dependency, perfect for spanning |
| TypeScript | 5.x | Type safety | Already in stack |

### Preserved for Other Views
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| D3.js | 7.x | Network graphs, charts | Non-tabular visualizations |
| d3-force | 7.x | Force simulations | Graph layout algorithms |

## Architecture Patterns

### Pattern 1: Tree Metrics Computation
**What:** Walk hierarchy tree, compute `leafStart` and `leafCount` for each node
**When to use:** Before rendering any hierarchical axis
**Key insight:** Leaf indices determine CSS Grid row/column positions

```typescript
// Input: AxisNode tree
// Output: FlatNode[] with depth, leafStart, leafCount
function computeTreeMetrics(root: AxisNode): TreeMetrics {
  const flatNodes: FlatNode[] = [];
  function traverse(node, depth, leafStart, path): number {
    // Leaf node returns 1
    // Internal node sums children's leaf counts
  }
  return { depth: maxDepth + 1, leafCount, flatNodes };
}
```

### Pattern 2: CSS Grid Placement
**What:** Convert tree metrics to CSS Grid coordinates
**When to use:** For every header and data cell
**Key insight:** 1-based grid lines, offset by header depth

```typescript
// Row header placement (vertical spanning)
function computeRowHeaderPlacement(node: FlatNode, colHeaderDepth: number): GridPlacement {
  return {
    gridColumnStart: node.depth + 1,
    gridColumnEnd: node.depth + 2,
    gridRowStart: colHeaderDepth + 1 + node.leafStart,
    gridRowEnd: colHeaderDepth + 1 + node.leafStart + node.leafCount,
  };
}
```

### Pattern 3: Zone-Based Grid Layout
**What:** Divide grid into four zones: Corner, ColHeaders, RowHeaders, Data
**When to use:** For all SuperGrid rendering

```
┌─────────────┬─────────────────────┐
│   CORNER    │    COL HEADERS      │
│  (MiniNav)  │  (horizontal span)  │
├─────────────┼─────────────────────┤
│    ROW      │                     │
│  HEADERS    │     DATA CELLS      │
│  (vertical  │                     │
│   span)     │                     │
└─────────────┴─────────────────────┘
```

## File Structure

```
src/components/supergrid/
├── types.ts                    # Core TypeScript interfaces
├── utils/
│   ├── treeMetrics.ts          # Tree traversal + metrics
│   └── gridPlacement.ts        # CSS Grid coordinates
├── hooks/
│   └── useGridLayout.ts        # Layout computation hook
├── components/
│   ├── GridContainer.tsx       # CSS Grid container
│   ├── CornerCell.tsx          # MiniNav cells
│   ├── RowHeader.tsx           # Row headers with spanning
│   ├── ColHeader.tsx           # Column headers with spanning
│   └── DataCell.tsx            # Data cells
├── styles/
│   └── SuperGrid.module.css    # Theme styles
├── SuperGridCSS.tsx            # Main component
├── SuperGridCSSContext.tsx     # Context for theme/callbacks
└── cssgrid/
    └── index.ts                # Barrel export
```

## Validation

### Prototype Validation
- Created `SuperGridPrototype.jsx` with reference image data
- Validated hierarchical spanning matches mockup
- Tested all 4 themes: reference, nextstep, modern, dark

### Reference Image Specifications
- **Row axis:** 3 levels (Category → Subcategory → Item), 26 data rows
- **Column axis:** 2 levels (Year → Quarter), 4 data columns
- **Corner zone:** 6 cells (2 rows × 3 columns)
- **Total data cells:** 104 (26 × 4)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Performance with large grids | Low | Medium | CSS Grid is optimized; add virtualization if needed |
| D3.js removal breaks other views | Low | High | D3.js preserved for charts/network |
| Theme parity issues | Low | Low | CSS variables match existing themes |

## Implementation Estimate

| Sub-phase | Effort | Status |
|-----------|--------|--------|
| 105-01: Types + Utils | 1 hour | COMPLETE |
| 105-02: Hook + Context | 1 hour | COMPLETE |
| 105-03: Cell Components | 1 hour | COMPLETE |
| 105-04: Main Component | 30 min | COMPLETE |
| 105-05: Unit Tests | 1 hour | COMPLETE |
| 105-06: Integration | 30 min | COMPLETE |

**Total:** ~5 hours (COMPLETE)
