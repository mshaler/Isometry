# Phase 109: CSS Chrome Primitives — Research

## Source Documents

- `CSS-CHROME-PRIMITIVES-GSD.md` — GSD milestone specification
- `ISOMETRY-PRIMITIVES-CC-HANDOFF v2.md` — Unified spec with Super* ownership matrix
- `isometry-primitives-v2.jsx` — Interactive artifact (4 views, stacked headers)

## Super* Component Ownership Matrix

Each Super* component has a **primary owner** that determines implementation approach.

### Ownership Table

| Component | Primary Owner | React Role | Rationale |
|-----------|--------------|------------|-----------|
| **SuperStack** | CSS + D3 | None | Headers are layout (CSS Grid spanning) + data binding (D3 enter/update/exit). No form inputs, no drag state, no mutations. Visual projection of `GROUP BY`. |
| **SuperDynamic** | React | Full | Dragging a column header to become a row header mutates the PAFV axis→plane mapping, triggers a new SQL query, rebuilds the grid. react-dnd/dnd-kit owns drag intent, drop zones, commit/revert. |
| **SuperDensity** | CSS | Thin (slider only) | Density slider updates `--iso-grid-cell-min-w` and `--iso-grid-cell-min-h` at runtime via `setProperty()`. CSS Grid recalculates layout automatically. React renders one `<input type="range">`, CSS does the rest. |
| **SuperFilter** | React | Full | Filter state is application state — active facets, selected values, query generation. Drives SQL `WHERE`/`GROUP BY` clauses. Needs React for multi-select, date pickers, form state. |
| **SuperCell** | CSS + D3 | None | Cells are presentation (mini-card layout, density switching, hover, selection outline — all CSS). D3 manages enter/update/exit as data changes. React doesn't know about individual cells. |

### Architecture Boundary

```
React owns:                          CSS + D3 owns:
┌──────────────────────┐             ┌──────────────────────────────────┐
│ SuperFilter          │             │ SuperStack (headers)             │
│ SuperDynamic         │ ← border → │ SuperCell (data cells)           │
│ SuperDensity slider  │             │ SuperDensity effect (CSS vars)   │
│ Sidebar chrome       │             │ Selection highlighting           │
│ Sync status          │             │ Sticky behavior                  │
│ Undo/redo stack      │             │ Scroll shadows                   │
└──────────────────────┘             └──────────────────────────────────┘
```

**Key insight:** 3 of 5 Super* components are NOT React components. SuperStack, SuperDensity (effect), and SuperCell should be implemented as D3 renderers that read CSS custom properties.

## Litmus Test for State Ownership

> "If this state were lost on page reload, would the user lose work?"
> - If NO → CSS owns it
> - If YES → React owns it

### Examples

| State | Lost on Reload? | Owner |
|-------|-----------------|-------|
| Sidebar collapsed | No (can reopen) | CSS |
| Accordion panel open | No | CSS |
| Tooltip visible | No | CSS |
| Selected facet | Yes (affects data query) | React |
| Axis→plane mapping | Yes (affects data query) | React |
| Undo stack | Yes (work lost) | React |

## CSS Patterns to Use

### 1. Data Attributes for Boolean State

```css
.iso-sidebar[data-collapsed="true"] {
  width: var(--iso-sidebar-collapsed-w);
}
```

One-line JS: `element.dataset.collapsed = "true"`

### 2. Native HTML Elements

- `<details>` for accordions
- `<dialog>` for modals
- `position: sticky` for sticky headers

### 3. CSS Custom Properties for Dynamic Values

```css
:root {
  --iso-grid-cell-min-w: 120px;
}
```

Runtime update: `document.documentElement.style.setProperty('--iso-grid-cell-min-w', '80px')`

### 4. Background-Attachment for Scroll Effects

```css
.iso-scroll-container {
  background-attachment: local, scroll;
}
```

## Prior Art

### Current React State in Codebase

The following React state patterns are candidates for CSS migration:

1. `useState<boolean>(sidebarOpen)` in layout components
2. `useState<Record<string, boolean>>` for accordion panels
3. `useState<string | null>(tooltipId)` for tooltip visibility
4. Scroll event listeners for sticky class toggling

### CSS Grid Already Handles

Phase 106 (v6.7) proved that CSS Grid handles complex layout without React:

- Multi-level header spanning via `gridRow`/`gridColumn`
- Dynamic column widths via `minmax()`
- No manual coordinate calculation

This phase extends that pattern to chrome components.

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| tokens.css | Complete | Tier 1 design tokens exist |
| tokens-light.css | Complete | Light theme tokens exist |
| primitives-supergrid.css | Complete | Tier 2 layout primitives exist |
| D3 renderers | Complete | SuperGridCSS rendering headers/cells |
| CSS reader utility | Complete | `css-primitives.ts` for runtime reads |

## Risks

1. **Browser support for `<dialog>`**: Safari 15.4+, Chrome 37+, Firefox 98+ — acceptable for target audience
2. **Sticky header z-index conflicts**: Need careful layering (corner > col headers > row headers > cells)
3. **Transition performance**: CSS transitions should use `transform` and `opacity` for GPU acceleration

## References

- [CSS-only scroll shadows](https://lea.verou.me/2012/04/background-attachment-local/)
- [Native `<dialog>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog)
- [CSS `position: sticky` stacking](https://css-tricks.com/position-sticky-2/)
