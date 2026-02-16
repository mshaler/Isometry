# Phase 108: Tier 2 Layout Primitives — Plan

## Goal

Extract per-view layout dimensions from the @isometry/primitives artifact into production CSS files. These primitives are configurable per-view and can be adjusted via DevTools, user preferences, or theme switching.

## Guiding Principle

```
Tier 1: Design Tokens   →  Global (colors, spacing, typography)
Tier 2: Layout Primitives →  Per-view (grid dimensions, cell sizes, gaps)
Tier 3: View Compositions →  D3 renderers that read CSS at render time
```

**Key insight:** SuperGridCSS reads dimensions from CSS custom properties, not hardcoded TypeScript. This enables:
- Dimension adjustment via DevTools or user preferences
- Theme-aware layout proportions (not just colors)
- No React state for presentation concerns

## Requirements

| ID | Requirement | Source (Artifact) |
|----|-------------|-------------------|
| PRIM-01 | SuperGrid primitives | `LAYOUT_PRIMITIVES.supergrid` |
| PRIM-02 | Kanban primitives | `LAYOUT_PRIMITIVES.kanban` |
| PRIM-03 | Timeline primitives | `LAYOUT_PRIMITIVES.timeline` |
| PRIM-04 | Gallery primitives | `LAYOUT_PRIMITIVES.gallery` |
| PRIM-05 | CSS reader utility | New TypeScript helper |

## Tasks

### 108-01: SuperGrid + Kanban Primitives (~4m)

**Files:**
- Create `src/styles/primitives-supergrid.css`
- Create `src/styles/primitives-kanban.css`
- Update `src/index.css` imports

**SuperGrid primitives (from artifact):**
```css
--iso-grid-row-hdr0-w: 100px;   /* Depth-0 row header width */
--iso-grid-row-hdr1-w: 90px;    /* Depth-1 row header width */
--iso-grid-col-hdr-h: 36px;     /* Column header height per level */
--iso-grid-corner-w: 190px;     /* Corner cell width (sum of row headers) */
--iso-grid-corner-h: 72px;      /* Corner cell height (2 levels × 36px) */
--iso-grid-cell-min-w: 140px;   /* Minimum data cell width */
--iso-grid-cell-min-h: 90px;    /* Minimum data cell height */
--iso-grid-cell-pad: 8px;       /* Cell content padding */
--iso-grid-cell-gap: 1px;       /* Gap between cells */
--iso-grid-gutter: 1px;         /* Gutter width */
```

**Kanban primitives (from artifact):**
```css
--iso-kanban-col-min-w: 260px;
--iso-kanban-col-max-w: 340px;
--iso-kanban-col-gap: 12px;
--iso-kanban-col-hdr-h: 44px;
--iso-kanban-card-gap: 4px;
--iso-kanban-card-pad: 12px;
--iso-kanban-col-pad: 8px;
```

### 108-02: Timeline + Gallery Primitives (~3m)

**Files:**
- Create `src/styles/primitives-timeline.css`
- Create `src/styles/primitives-gallery.css`
- Update `src/index.css` imports

**Timeline primitives (from artifact):**
```css
--iso-timeline-row-h: 36px;
--iso-timeline-day-w: 28px;
--iso-timeline-week-w: 196px;   /* 7 × 28px */
--iso-timeline-month-w: 140px;  /* Collapsed view */
--iso-timeline-bar-h: 22px;
--iso-timeline-bar-gap: 4px;
--iso-timeline-hdr-h: 48px;
```

**Gallery primitives (from artifact):**
```css
--iso-gallery-card-w: 220px;
--iso-gallery-card-h: 160px;
--iso-gallery-gap: 16px;
--iso-gallery-pad: 24px;
--iso-gallery-thumb-h: 100px;
```

### 108-03: CSS Reader Utility (~3m)

**File:** Create `src/d3/shared/css-reader.ts`

**Purpose:** TypeScript helper to read CSS custom properties at render time.

```typescript
export function getCSSProperty(name: string, element?: Element): string;
export function getCSSPropertyNumber(name: string, element?: Element): number;
export function getGridPrimitives(element?: Element): GridPrimitives;
export function getKanbanPrimitives(element?: Element): KanbanPrimitives;
```

## Verification

1. GSD build passes
2. All primitives accessible via `getComputedStyle(document.documentElement).getPropertyValue('--iso-grid-cell-min-w')`
3. CSS reader utility returns correct values
4. SuperGridCSS can consume primitives (future integration)

## Decisions

- PRIM-NAMESPACE-01: Use `--iso-grid-*`, `--iso-kanban-*`, `--iso-timeline-*`, `--iso-gallery-*` prefixes
- PRIM-UNIT-01: Use `px` for all dimension values (consistent with Tier 1 tokens)
- PRIM-DEFAULT-01: Values extracted from artifact v0.2.0
