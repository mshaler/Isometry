# Technology Stack

**Project:** Isometry v4.1 SuperGrid Foundation
**Researched:** 2026-02-05

## Recommended Stack

### Core Framework Extensions
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @dnd-kit/core | ^6.3.1 | Axis reordering drag-drop | Replace deprecated react-dnd (v16.0.1). Modern hooks-based, zero-dep, 10kb. Better performance + accessibility than existing useDragDrop |
| @dnd-kit/sortable | ^8.0.0 | PAFV chip reordering | Sortable lists for axis picker wells |
| @dnd-kit/utilities | ^3.2.2 | Animation utilities | Smooth transitions for dynamic axis assignment |

### D3.js Enhancements
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| d3 | ^7.8.5 | KEEP CURRENT | Already optimal - v7.9.0 is latest but stable on 7.8.5 |
| d3-selection-multi | ^3.0.0 | Bulk attribute setting | Optimize nested header rendering with `.attrs()` method |
| d3-annotation | ^2.5.1 | SuperCalc formula overlay | Annotation lines for multidimensional formula scope |

### Grid Rendering Architecture
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| react-window | ^1.8.10 | KEEP CURRENT | Virtual scrolling for SuperGrid performance at scale |
| react-virtualized-auto-sizer | ^1.0.24 | Dynamic sizing | Auto-resize grid based on container dimensions |
| use-resize-observer | ^9.1.0 | Responsive updates | Replace custom useResizeObserver with battle-tested solution |

### State Management Extensions
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| immer | ^10.1.1 | Immutable PAFV updates | Complex axis assignment operations without mutation |
| usehooks-ts | ^3.1.0 | Utility hooks | useLocalStorage for PAFV axis persistence |

## Major Architecture Decision: dnd-kit over react-dnd

| Category | Current (react-dnd 16.0.1) | Recommended (@dnd-kit 6.3.1) | Why Switch |
|----------|-------------|-------------|---------|
| **Maintenance** | Last updated 4 years ago | Active development | react-dnd is effectively deprecated |
| **Bundle Size** | ~15KB + backend | ~10KB zero-dep | 33% smaller |
| **API** | Class-based, complex | Hook-based, intuitive | Matches existing codebase patterns |
| **Performance** | Good | Excellent (60fps) | Critical for smooth axis transitions |
| **Accessibility** | Manual implementation | Built-in ARIA + keyboard | Table stakes for data tools |

### Migration Path
1. Keep existing `useDragDrop.ts` temporarily
2. Add @dnd-kit for new SuperGrid axis picker
3. Gradually migrate existing drag-drop to dnd-kit
4. Remove react-dnd dependency in v4.2

## Integration Points with Existing Architecture

### sql.js Direct Binding (NO CHANGE)
```typescript
// CONTINUE: Direct synchronous queries to D3
const cells = db.exec(`
  SELECT x, y, value, col_header_path, row_header_path
  FROM grid_cells
  WHERE view_id = ?
`, [viewId]);

// D3 binds directly - zero serialization
d3.selectAll('.cell').data(cells, d => `${d.x},${d.y}`).join('rect');
```

### PAFV Context Enhancement
```typescript
// EXTEND existing PAFVContext with axis assignment state
interface PAFVAxisState {
  x: ChipId[];     // Multiple chips can stack on X axis
  y: ChipId[];     // Multiple chips can stack on Y axis
  z: ChipId[];     // Z-axis chips for filtering/coloring
  available: ChipId[];
}
```

### D3 SuperGrid Renderer Stack
```typescript
// NEW: Extend existing SuperGrid.ts with nested headers
class SuperGridRenderer {
  renderColumnHeaders(axes: ChipId[]): void {
    // Multiple nested levels from axes array
    // Use d3-selection-multi for bulk .attrs()
  }

  renderRowHeaders(axes: ChipId[]): void {
    // Hierarchical spanning logic from IsometryKB
  }

  renderDataCells(): void {
    // KEEP: Existing grid cell logic works
  }
}
```

## What NOT to Add

| Library | Why Avoid | What to Do Instead |
|---------|-----------|-------------------|
| **react-beautiful-dnd** | Deprecated, no touch support | Use @dnd-kit |
| **d3-scale-chromatic** | Adds 50KB for colors | Use existing tailwind color system |
| **lodash** | 70KB for utility functions | Use native JS or write utilities |
| **@tanstack/react-table** | Different paradigm than SuperGrid | Build on existing D3 grid foundation |
| **konva.js** | Canvas-based, conflicts with D3 SVG | Stick with D3 SVG for consistency |

## IsometryKB Insights Applied

### Janus Density Model
From `supergrid-architecture-v4.md`: **"D3.js is the Sparsity Layer; React is the Density Layer"**

**Stack Impact**:
- D3 renders individual cells (sparsity)
- React provides spanning headers + density controls
- NO additional state management library needed - this pattern IS the state management

### Z-Axis Layer Architecture
```
z=2: OVERLAY (React Cards) - react-window virtualization
z=1: DENSITY (React Controls) - @dnd-kit drag zones
z=0: SPARSITY (D3 Data) - direct sql.js binding
```

**Stack Impact**: Clear responsibility boundaries prevent library conflicts

### PAFV Axis Assignment
From IsometryKB decision records: Use D3 zoom behavior over custom implementation.

**Stack Impact**: Leverage D3's built-in patterns where they exist, add minimal new dependencies

## Installation Commands

```bash
# Remove deprecated drag-drop
npm uninstall react-dnd react-dnd-html5-backend

# Add modern drag-drop system
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Add D3 enhancements
npm install d3-selection-multi d3-annotation

# Add grid performance utilities
npm install react-virtualized-auto-sizer use-resize-observer

# Add state management utilities
npm install immer usehooks-ts
```

## Performance Validation

| Component | Library | Expected Performance |
|-----------|---------|---------------------|
| **Axis picker drag** | @dnd-kit | 60 FPS smooth reordering |
| **Grid cell rendering** | D3 + react-window | 1000+ cells without lag |
| **Header spanning** | d3-selection-multi | Bulk updates in single frame |
| **Resize handling** | use-resize-observer | Debounced, no layout thrash |
| **PAFV state updates** | immer | Immutable updates, predictable renders |

## Sources

- [IsometryKB SuperGrid Architecture](file:///Users/mshaler/Developer/Projects/IsometryKB/notes/supergrid-architecture-v4.md) - **HIGH confidence** - Z-axis architecture, Janus model
- [IsometryKB D3 Zoom Decision](file:///Users/mshaler/Developer/Projects/IsometryKB/decisions/2026-01-23-d3-zoom-vs-custom.md) - **HIGH confidence** - D3 built-in patterns preferred
- [@dnd-kit/core npm](https://www.npmjs.com/package/@dnd-kit/core) - **MEDIUM confidence** - v6.3.1 current, performance claims
- [D3.js Releases](https://github.com/d3/d3/releases) - **MEDIUM confidence** - v7.9.0 latest, but v7.8.5 stable in codebase
- [react-dnd Status](https://www.npmjs.com/package/react-dnd) - **HIGH confidence** - Last updated 4 years ago, effectively deprecated
- [Existing Isometry codebase analysis](file:///Users/mshaler/Developer/Projects/Isometry/package.json) - **HIGH confidence** - Current dependencies and patterns