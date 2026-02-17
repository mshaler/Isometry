# @isometry/primitives — CC Handoff Specification

*CSS Primitive System for Isometry's Polymorphic Views*
*Version: 0.2.0 | Date: February 2026*

---

## Summary

This document specifies `@isometry/primitives` — a three-tier CSS custom property system that provides composable building blocks for all Isometry views. It follows the shadcn-ui philosophy: **owned primitives, not a framework dependency.**

The interactive artifact (`isometry-primitives-v2.jsx`) demonstrates all four Tier 3 view compositions rendering the same dataset. Use it as the visual reference for implementation.

### Architecture Principle

```
SQL decides WHAT  →  LATCH separation (WHERE, GROUP BY, ORDER BY)
CSS decides WHERE →  PAFV spatial projection (grid templates, positioning)
D3  decides HOW   →  Data binding (enter/update/exit) + GRAPH topology
```

---

## Tier 1: Design Tokens

These are global CSS custom properties. Create as `src/styles/tokens.css`.

All visual properties (colors, spacing, typography, radii, shadows) are defined here. No component should use hardcoded values — always reference tokens.

### File: `src/styles/tokens.css`

```css
:root {
  /* ── Spacing (4px base unit) ── */
  --iso-space-xs: 2px;
  --iso-space-sm: 4px;
  --iso-space-md: 8px;
  --iso-space-lg: 12px;
  --iso-space-xl: 16px;
  --iso-space-xxl: 24px;

  /* ── Backgrounds ── */
  --iso-bg-base: #232328;
  --iso-bg-raised: #2e2e34;
  --iso-bg-sunken: #1a1a1e;
  --iso-bg-glass: rgba(46, 46, 52, 0.92);
  --iso-bg-hover: #34343a;

  /* ── Foreground ── */
  --iso-fg-primary: #e4e4ea;
  --iso-fg-secondary: #9e9eaa;
  --iso-fg-muted: #5e5e6a;
  --iso-fg-accent: #4da6ff;

  /* ── Borders ── */
  --iso-border-subtle: rgba(255, 255, 255, 0.05);
  --iso-border-cell: rgba(255, 255, 255, 0.08);
  --iso-border-default: rgba(255, 255, 255, 0.12);
  --iso-border-strong: rgba(255, 255, 255, 0.20);
  --iso-border-accent: #4da6ff;

  /* ── Headers (depth-tinted) ── */
  --iso-header-col0: #1a2744;
  --iso-header-col1: #1e2f52;
  --iso-header-row0: #2a1a3a;
  --iso-header-row1: #321e44;
  --iso-header-corner: #161620;

  /* ── Status colors ── */
  --iso-status-todo: #6e6e78;
  --iso-status-doing: #4da6ff;
  --iso-status-review: #ff9800;
  --iso-status-done: #4caf50;

  /* ── Priority colors ── */
  --iso-priority-high: #ef5350;
  --iso-priority-med: #ff9800;
  --iso-priority-low: #4da6ff;
  --iso-priority-none: #6e6e78;

  /* ── Radii ── */
  --iso-radius-xs: 2px;
  --iso-radius-sm: 3px;
  --iso-radius-md: 6px;
  --iso-radius-lg: 8px;
  --iso-radius-xl: 12px;

  /* ── Shadows ── */
  --iso-shadow-inset: inset 0 1px 2px rgba(0, 0, 0, 0.3);
  --iso-shadow-raised: 0 2px 8px rgba(0, 0, 0, 0.35);
  --iso-shadow-deep: 0 4px 16px rgba(0, 0, 0, 0.45);

  /* ── Typography ── */
  --iso-font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --iso-font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* ── Transitions ── */
  --iso-transition-fast: 100ms ease;
  --iso-transition-normal: 180ms ease;
  --iso-transition-slow: 300ms ease-out;
}
```

### Light Theme Override

Create `src/styles/tokens-light.css` when needed:

```css
[data-theme="light"] {
  --iso-bg-base: #f5f5f7;
  --iso-bg-raised: #ffffff;
  --iso-bg-sunken: #ebebed;
  /* ... etc */
}
```

---

## Tier 2: Layout Primitives

These are view-specific CSS custom properties that control spatial layout. Each view type has its own set. The interactive artifact lets you tune these visually, then export the values.

### File: `src/styles/primitives-supergrid.css`

```css
:root {
  /* ── SuperGrid: Stacked Header Dimensions ── */
  --iso-grid-row-hdr0-w: 100px;    /* Depth-0 row header width (e.g., Folder) */
  --iso-grid-row-hdr1-w: 100px;    /* Depth-1 row header width (e.g., Tag) */
  --iso-grid-col-hdr-h: 30px;      /* Column header height per level */
  --iso-grid-cell-min-w: 120px;    /* Minimum data cell width */
  --iso-grid-cell-min-h: 72px;     /* Minimum data cell height */
  --iso-grid-cell-pad: 6px;        /* Data cell inner padding */
  --iso-grid-cell-border: 1px;     /* Cell border width (spreadsheet grid lines) */
}
```

### File: `src/styles/primitives-kanban.css`

```css
:root {
  --iso-kanban-col-min-w: 260px;
  --iso-kanban-col-max-w: 320px;
  --iso-kanban-col-gap: 12px;
  --iso-kanban-col-hdr-h: 42px;
  --iso-kanban-card-gap: 6px;
  --iso-kanban-card-pad: 12px;
  --iso-kanban-col-pad: 8px;
}
```

### File: `src/styles/primitives-timeline.css`

```css
:root {
  --iso-timeline-row-h: 56px;
  --iso-timeline-hdr-h: 48px;
  --iso-timeline-day-w: 32px;
  --iso-timeline-label-w: 160px;
  --iso-timeline-bar-h: 24px;
  --iso-timeline-bar-r: 4px;
  --iso-timeline-bar-gap: 4px;
}
```

### File: `src/styles/primitives-gallery.css`

```css
:root {
  --iso-gallery-card-w: 220px;
  --iso-gallery-card-h: 160px;
  --iso-gallery-gap: 12px;
  --iso-gallery-pad: 16px;
}
```

---

## Tier 3: View Compositions

Each view composition is a D3 renderer that reads Tier 2 primitives from CSS custom properties and assembles the layout.

### SuperGrid Composition

**LATCH mapping**: 2-axis separation
- Row axis: Folder (depth 0) → Tag (depth 1)
- Column axis: Status Group (depth 0) → Status (depth 1)

**PAFV mapping**:
- y-plane ← Row headers (nested SuperStack)
- x-plane ← Column headers (nested SuperStack)

**Critical: Stacked/Nested Headers (SuperStack)**

SuperGrid MUST render multi-level headers that visually span their children:

```
COLUMN HEADERS (2 levels deep):
┌───────────────────────────────────┬───────────────────────────────────┐
│            Active                 │            Complete               │  ← Depth 0 (status group)
├─────────────┬─────────────────────├─────────────┬─────────────────────┤
│   To Do     │   In Progress       │   Review    │      Done           │  ← Depth 1 (individual status)
├─────────────┴─────────────────────┴─────────────┴─────────────────────┤

ROW HEADERS (2 levels deep):                                DATA CELLS:
┌──────────┬────────────┬───────────┬───────────┬───────────┬───────────┐
│          │   UI       │  card     │  card     │           │  card     │
│ Isometry ├────────────┼───────────┼───────────┼───────────┼───────────┤
│          │ Architect  │  card     │           │           │           │  ← Folder spans its tags
│          ├────────────┼───────────┼───────────┼───────────┼───────────┤
│          │ Backend    │           │           │  card     │  card     │
│          ├────────────┼───────────┼───────────┼───────────┼───────────┤
│          │ Testing    │  card     │           │           │           │
├──────────┼────────────┼───────────┼───────────┼───────────┼───────────┤
│          │   UI       │           │  card     │           │           │
│ Research ├────────────┼───────────┼───────────┼───────────┼───────────┤
│          │ Backend    │  card     │           │           │  card     │
│          ├────────────┼───────────┼───────────┼───────────┼───────────┤
│          │ Testing    │           │  card     │  card     │           │
└──────────┴────────────┴───────────┴───────────┴───────────┴───────────┘
```

**Implementation: CSS Grid with `gridRow` spanning**

The depth-0 row header ("Isometry") uses `gridRow: start / end` to span all its child rows. Same pattern for depth-0 column headers ("Active") spanning child columns. This is pure CSS Grid — no manual pixel calculation needed.

```typescript
// Pseudocode for D3 renderer reading CSS primitives
const rowHdr0Width = getComputedStyle(root).getPropertyValue('--iso-grid-row-hdr0-w');
const rowHdr1Width = getComputedStyle(root).getPropertyValue('--iso-grid-row-hdr1-w');
const colHdrHeight = getComputedStyle(root).getPropertyValue('--iso-grid-col-hdr-h');

// Grid template reads from primitives
container.style.gridTemplateColumns = 
  `${rowHdr0Width} ${rowHdr1Width} repeat(${colLeafCount}, minmax(var(--iso-grid-cell-min-w), 1fr))`;
```

**Cell borders**: Every data cell has `border-right` and `border-bottom` using `--iso-grid-cell-border` width and `--iso-border-cell` color, creating the spreadsheet grid-line effect.

**Header depth tinting**: Each header level uses a progressively lighter background (`--iso-header-col0`, `--iso-header-col1`, etc.) to visually communicate nesting depth.

### Kanban Composition

**LATCH mapping**: Single-axis separation by Status
**PAFV mapping**: x-plane ← Status columns

Simpler than SuperGrid — no nested headers. Columns are flex containers with cards stacked vertically.

### Timeline Composition

**LATCH mapping**: Time on x-plane, Category (Status) on y-plane
**PAFV mapping**: x-plane ← Days, y-plane ← Status rows

Key features:
- Day headers with weekend dimming
- Today marker line
- Gantt-style bars positioned by `created → due` date range
- Grid lines for visual reference

### Gallery Composition

**LATCH mapping**: Auto-fill grid, no explicit axis assignment
**PAFV mapping**: CSS Grid auto-fill wrapping

Cards displayed as larger tiles with more metadata visible. Uses `repeat(auto-fill, minmax(var(--iso-gallery-card-w), 1fr))`.

---

## D3 Renderer Integration Pattern

Each Tier 3 composition should follow this pattern:

```typescript
// src/renderers/SuperGridRenderer.ts

export class SuperGridRenderer {
  private container: HTMLElement;
  private root: HTMLElement;
  
  constructor(container: HTMLElement) {
    this.container = container;
    this.root = document.documentElement;
  }
  
  /** Read a Tier 2 primitive value */
  private primitive(name: string): string {
    return getComputedStyle(this.root).getPropertyValue(`--iso-grid-${name}`).trim();
  }
  
  /** Read a Tier 2 primitive as number (strips 'px') */
  private primitiveNum(name: string): number {
    return parseFloat(this.primitive(name));
  }
  
  /** Read a Tier 1 token */
  private token(name: string): string {
    return getComputedStyle(this.root).getPropertyValue(`--iso-${name}`).trim();
  }
  
  render(data: {
    rowTree: HeaderTree;
    colTree: HeaderTree;
    cells: Map<string, Card[]>;
  }) {
    const rowHdr0W = this.primitiveNum('row-hdr0-w');
    const rowHdr1W = this.primitiveNum('row-hdr1-w');
    const colHdrH = this.primitiveNum('col-hdr-h');
    const cellMinW = this.primitiveNum('cell-min-w');
    const cellMinH = this.primitiveNum('cell-min-h');
    
    // Build CSS Grid layout from primitives
    const gridCols = `${rowHdr0W}px ${rowHdr1W}px ` + 
      data.colTree.leaves.map(() => `minmax(${cellMinW}px, 1fr)`).join(' ');
    
    const headerRows = data.colTree.maxDepth;
    const dataRows = data.rowTree.leafCount;
    const gridRows = `repeat(${headerRows}, ${colHdrH}px) ` +
      `repeat(${dataRows}, minmax(${cellMinH}px, auto))`;
    
    // D3 renders into the CSS Grid
    const grid = d3.select(this.container)
      .style('display', 'grid')
      .style('grid-template-columns', gridCols)
      .style('grid-template-rows', gridRows)
      .style('border', `${this.primitive('cell-border')} solid ${this.token('border-strong')}`)
      .style('border-radius', this.token('radius-lg'));
    
    // ... enter/update/exit for headers and cells
  }
}
```

---

## File Structure

```
src/
  styles/
    tokens.css                    ← Tier 1: Design tokens
    tokens-light.css              ← Tier 1: Light theme override
    primitives-supergrid.css      ← Tier 2: SuperGrid layout values
    primitives-kanban.css         ← Tier 2: Kanban layout values
    primitives-timeline.css       ← Tier 2: Timeline layout values
    primitives-gallery.css        ← Tier 2: Gallery layout values
    index.css                     ← Import aggregator
  renderers/
    SuperGridRenderer.ts          ← Tier 3: SuperGrid composition
    KanbanRenderer.ts             ← Tier 3: Kanban composition
    TimelineRenderer.ts           ← Tier 3: Timeline composition
    GalleryRenderer.ts            ← Tier 3: Gallery composition
    shared/
      card-primitives.ts          ← MiniCard, KanbanCard, GalleryCard
      header-primitives.ts        ← StatusDot, PriorityDot, TagPill
      css-reader.ts               ← Utility to read CSS custom properties
```

---

## Testing Criteria

| Test | Input | Expected | Pass |
|------|-------|----------|------|
| Tokens load | Import tokens.css | All `--iso-*` vars accessible via getComputedStyle | Custom properties resolve |
| SuperGrid 2-level col headers | Status Group → Status | "Active" spans 2 columns, "Complete" spans 2 columns | gridColumn span correct |
| SuperGrid 2-level row headers | Folder → Tag | "Isometry" spans 4 rows (4 tags), "Research" spans 3 rows | gridRow span correct |
| Cell borders visible | Any SuperGrid render | 1px borders between all data cells | Spreadsheet grid-line appearance |
| Header depth tinting | 2-level headers | Depth 0 darker than depth 1 | Visual hierarchy |
| Kanban cards grouped | Group by status | 4 columns with correct card counts | Cards in right columns |
| Timeline bar positioning | Cards with created/due dates | Bars start at created, end at due | Pixel positions correct |
| Today marker | Timeline with showToday=true | Vertical accent line at current date | Visible and correctly positioned |
| Gallery auto-fill | 14 cards in container | Cards wrap to fill width | No overflow, responsive |
| Primitive override | Change `--iso-grid-cell-min-w` at runtime | Grid cells resize | Dynamic response |
| Polymorphic switch | Toggle between 4 views | Same data, different layout | No data loss on switch |

---

## Implementation Order

1. **Week 1**: Tier 1 tokens.css + Tier 2 primitives files + css-reader utility
2. **Week 2**: SuperGridRenderer with stacked headers + cell borders (most complex)
3. **Week 3**: KanbanRenderer + TimelineRenderer
4. **Week 4**: GalleryRenderer + integration tests + polymorphic view switching

---

## Key Constraints

- **No framework CSS**: All styling via CSS custom properties, not CSS-in-JS or Tailwind
- **D3 data binding**: All dynamic content uses `d3.selectAll().data().join()` pattern
- **CSS Grid for layout**: SuperGrid uses native CSS Grid with `gridRow`/`gridColumn` spanning
- **Read primitives at render time**: Don't cache CSS values — read them fresh so runtime theme/size changes work
- **Boring stack**: No additional dependencies. CSS custom properties + D3.js + TypeScript only
