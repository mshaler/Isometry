# Phase 21: SuperSelect - Research

**Researched:** 2026-03-04
**Domain:** DOM pointer events, bounding box caching, SVG lasso overlay, multi-mode selection state
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Selection Visuals**
- Selected cells get both a semi-transparent blue background tint AND a blue border ring — maximum clarity, especially during lasso drag
- Match existing blue accent (#1a56f0) already used in TreeView/NetworkView for consistency across all views
- Floating badge showing "N cards selected" in grid corner — disappears when selection clears

**Empty Cell Selectability**
- All cells are selectable, including empty cells (count: 0) — they contribute zero cards but participate in lasso rectangles and Shift+click ranges for consistent spatial behavior

**Lasso Interaction**
- Plain mousedown + drag on grid area starts lasso — no modifier required (like Figma/Finder)
- Rubber-band rendered as blue dashed rectangle with semi-transparent blue fill — classic macOS/Finder style
- Live highlight during drag — cells light up as the lasso crosses them (requires bounding box cache SLCT-08)
- Cmd+lasso adds to existing selection (without Cmd, lasso replaces) — matches Cmd+click pattern

**Header Click Zones**
- Cmd+click header = select all cards under that header (plain click = collapse, as existing)
- Both row and column headers support select-all — consistent axes
- Header select-all follows same modifier rules as cells: plain click replaces selection, Cmd+click adds
- Build a z-axis zone discriminator now (header / data cell / SuperCard zone) — SuperCard zone is a no-op placeholder until Phase 27

**Shift+Click 2D Range**
- Rectangular block selection (Excel-style): anchor cell × target cell defines a rectangle, all cells in the block are selected
- Empty cells included in the rectangle — consistent with "all cells selectable" decision
- Anchor stays fixed at the first click; each subsequent Shift+click extends/reshapes from the anchor (Excel behavior)
- Headers have their own select-all behavior — Shift only applies to data cells

### Claude's Discretion
- Bounding box cache implementation strategy (Map<string, DOMRect> vs alternative)
- Cache invalidation timing (post-render vs requestAnimationFrame vs ResizeObserver)
- SVG vs HTML overlay for lasso rubber-band rendering
- Exact selection highlight opacity/color values
- How SelectionProvider.range() is extended or superseded for 2D rectangular selection
- Keyboard accessibility for selection (beyond Escape to clear)
- Performance budget for lasso hit-testing

### Deferred Ideas (OUT OF SCOPE)
- SuperCard click behavior (tooltip/aggregation) — Phase 27
- Selection-based bulk actions (delete, move, tag) — future phase
- Selection persistence across view switches — D-005 says selection is Tier 3, never persisted
- Drag-to-reorder selected cards — separate interaction pattern
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SLCT-01 | User can click a data cell to select its card(s) | SelectionProvider.select() / selectAll() via CellDatum.card_ids; plug into D3 .each() click handler |
| SLCT-02 | User can Cmd+click to toggle-add cells to selection | SelectionProvider.toggle() / addToSelection() for each card_id in cell; metaKey check on MouseEvent |
| SLCT-03 | User can Shift+click to select a rectangular 2D range of cells | New 2D range: anchor (rowKey, colKey) × target defines rectangle; SelectionProvider.selectAll(flattenedCardIds) |
| SLCT-04 | User can lasso-drag to select cells within a rubber-band rectangle | SVG/HTML absolute overlay; pointermove hit-tests Map<cellKey, DOMRect> cache; SelectionProvider.selectAll(hits) |
| SLCT-05 | Clicking a header selects all cards under that header's data range | Cmd+click branch in _createColHeaderCell + row header; collect all card_ids from _lastCells matching that header value |
| SLCT-06 | Z-axis click zones discriminate header clicks from data cell clicks from SuperCard clicks | classifyClickZone(target) → 'header' | 'data-cell' | 'supergrid-card' | 'grid'; SuperCard zone is no-op placeholder |
| SLCT-07 | Escape key clears all selection | keydown listener on document/rootEl; Escape → SelectionProvider.clear() + badge update |
| SLCT-08 | Lasso uses post-render cell bounding box cache (no per-event DOM reads) | Map<cellKey, DOMRect> built once after _renderCells(); lasso pointermove reads from Map, never getBoundingClientRect |
</phase_requirements>

---

## Summary

Phase 21 adds interactive cell selection to SuperGrid. The core work splits into three concerns: (1) a bounding box cache that snapshots DOMRect positions after every render to enable O(N) lasso hit-testing without layout thrash; (2) a `SuperGridSelect` module that renders an SVG lasso overlay, handles pointer events, and applies results to SelectionProvider; and (3) wiring click, Cmd+click, Shift+click, header select-all, Escape, and z-axis discrimination into existing SuperGrid event handlers.

The `SelectionProvider` already exists and is battle-tested from TreeView/NetworkView. It handles `select()`, `toggle()`, `selectAll()`, and `clear()` with microtask-batched notifications. Phase 21 does **not** extend SelectionProvider — SuperGrid will compose it. The only new public API needed is a narrow `SuperGridSelectionLike` interface and a 2D rectangular range helper (since the existing `range(id, allIds)` is 1D/linear).

The critical performance constraint is SLCT-08: the lasso must NEVER call `getBoundingClientRect()` in a pointermove handler. A `Map<string, DOMRect>` built once after `_renderCells()` (and invalidated on each render) is the correct pattern — it eliminates the O(N×M) forced-reflow loop entirely. The bounding box snapshot must be taken in the next animation frame after render (not synchronously) so the grid has completed layout before cells are measured.

**Primary recommendation:** Build three focused files — `SuperGridBBoxCache.ts` (pure cache), `SuperGridSelect.ts` (SVG lasso + pointer event handling), and wire both into `SuperGrid.ts` — following the same `attach/detach` lifecycle pattern established by SuperZoom and SuperGridSizer.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pointer Events API | Browser native | Lasso drag tracking with setPointerCapture | Already used by SuperGridSizer; capture prevents events escaping outside overlay |
| SelectionProvider | Project internal | Ephemeral card selection state (Tier 3) | Already exists, battle-tested, microtask-batched, used by TreeView/NetworkView |
| D3.js v7.9 | Already installed | Apply selection class in .each() callback during D3 data join | Established pattern in all views |
| SVG (native DOM) | Browser native | Lasso rubber-band rectangle rendering | SVG rect attributes (x, y, width, height) are simpler than HTML positioning for a dragged rectangle |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| requestAnimationFrame | Browser native | Defer bounding box snapshot to after render | Must happen post-layout; use rAF after _renderCells() returns |
| ResizeObserver | Browser native | Optional cache invalidation on container resize | Secondary invalidation path; primary invalidation is already on each render cycle |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVG overlay for lasso | HTML div overlay | SVG rect is semantically cleaner; both work but SVG avoids z-index stacking of a div inside the grid scroll container |
| Map<string, DOMRect> | Map<string, {x,y,w,h}> plain object | DOMRect is native browser type from getBoundingClientRect; plain object is structurally identical but requires manual construction |
| rAF after render | MutationObserver | rAF is simpler and sufficient; MutationObserver is overkill for a batch-rendered CSS Grid |

**Installation:** No new npm packages needed — all functionality uses native browser APIs and existing project dependencies.

---

## Architecture Patterns

### Recommended Project Structure

```
src/views/supergrid/
├── SuperStackHeader.ts     # existing
├── SuperZoom.ts            # existing
├── SuperGridSizer.ts       # existing
├── SuperGridBBoxCache.ts   # NEW — Plan 21-01: post-render cell bounding box cache
└── SuperGridSelect.ts      # NEW — Plan 21-02: SVG lasso overlay + pointer event handling

tests/views/supergrid/
├── SuperGridSizer.test.ts  # existing
├── SuperZoom.test.ts       # existing
├── SuperGridBBoxCache.test.ts  # NEW — Plan 21-01 tests
└── SuperGridSelect.test.ts     # NEW — Plan 21-02 tests

tests/views/
└── SuperGrid.test.ts       # existing — Plans 21-01/02/03 add integration tests
```

### Pattern 1: attach/detach Lifecycle (mirrors SuperZoom and SuperGridSizer)

All SuperGrid submodules follow the same lifecycle. `SuperGridSelect` and `SuperGridBBoxCache` must match:

```typescript
// Source: SuperGridSizer.ts (established pattern)
export class SuperGridBBoxCache {
  attach(gridEl: HTMLElement): void { this._gridEl = gridEl; }
  detach(): void { this._gridEl = null; this._cache.clear(); }
  // Called by SuperGrid after _renderCells() returns:
  scheduleSnapshot(): void {
    requestAnimationFrame(() => this._snapshot());
  }
}

export class SuperGridSelect {
  attach(rootEl: HTMLElement, gridEl: HTMLElement): void { /* create SVG overlay, wire pointers */ }
  detach(): void { /* remove SVG, remove listeners */ }
}
```

### Pattern 2: Narrow Interface Injection (mirrors SuperGridBridgeLike, SuperGridProviderLike)

SuperGrid uses narrow interfaces for all injected dependencies. Add `SuperGridSelectionLike` to `src/views/types.ts`:

```typescript
// Source: types.ts pattern (Phase 17 established)
export interface SuperGridSelectionLike {
  select(cardIds: string[]): void;           // replaces selection
  addToSelection(cardIds: string[]): void;   // Cmd+click / Cmd+lasso
  clear(): void;                             // Escape
  isSelectedCell(cellKey: string): boolean;  // for .each() visual update
  getSelectedCount(): number;                // badge display
  subscribe(cb: () => void): () => void;     // visual update trigger
}
```

Note: `SuperGridSelectionLike` is a thin adapter over the real `SelectionProvider`. The adapter aggregates cell-level selections (a cell's card_ids) into flat card ID sets and tracks which cell keys are selected for the `isSelectedCell()` check in the D3 .each() callback.

### Pattern 3: Bounding Box Cache — post-render snapshot

The cache must NOT be populated synchronously inside `_renderCells()` because CSS Grid layout is not computed until after the call stack returns:

```typescript
// SuperGridBBoxCache.ts
export class SuperGridBBoxCache {
  private _cache = new Map<string, DOMRect>();
  private _gridEl: HTMLElement | null = null;

  attach(gridEl: HTMLElement): void {
    this._gridEl = gridEl;
  }

  detach(): void {
    this._gridEl = null;
    this._cache.clear();
  }

  // Call this after every _renderCells() — NOT inside it
  scheduleSnapshot(): void {
    requestAnimationFrame(() => this._snapshot());
  }

  // Cache invalidated implicitly: scheduleSnapshot() overwrites Map on each render
  private _snapshot(): void {
    if (!this._gridEl) return;
    this._cache.clear();
    const cells = this._gridEl.querySelectorAll<HTMLElement>('.data-cell');
    for (const cell of cells) {
      const key = cell.dataset['key'];
      if (key) {
        this._cache.set(key, cell.getBoundingClientRect());
      }
    }
  }

  /** Hit-test: returns cell keys whose DOMRect intersects the lasso rect */
  hitTest(lassoRect: { x: number; y: number; w: number; h: number }): string[] {
    const hits: string[] = [];
    for (const [key, rect] of this._cache) {
      if (rectsIntersect(lassoRect, rect)) hits.push(key);
    }
    return hits;
  }
}
```

### Pattern 4: Z-Axis Zone Discriminator

A forward-compatible click zone classifier (header / data-cell / supergrid-card / grid-background):

```typescript
// SuperGridSelect.ts — pure function, easily testable
type ClickZone = 'header' | 'data-cell' | 'supergrid-card' | 'grid';

function classifyClickZone(target: EventTarget | null): ClickZone {
  const el = target as HTMLElement | null;
  if (!el) return 'grid';
  if (el.closest('.col-header') || el.closest('.row-header')) return 'header';
  if (el.closest('.supergrid-card')) return 'supergrid-card';  // Phase 27 placeholder
  if (el.closest('.data-cell')) return 'data-cell';
  return 'grid';
}
```

### Pattern 5: 2D Rectangular Range Selection

The existing `SelectionProvider.range(id, allIds)` is a 1D linear range (Shift+click in a flat list). SuperGrid needs a 2D rectangular range. The correct implementation uses a `CellIndex` map:

```typescript
// In SuperGridSelect or wired into SuperGrid._handleDataCellClick
// Anchor is stored as {rowKey, colKey} on first plain click (not Shift)

function getRectangularRange(
  anchor: { rowKey: string; colKey: string },
  target: { rowKey: string; colKey: string },
  rowOrder: string[],        // ordered visible row keys
  colOrder: string[],        // ordered visible col keys
  cellDataMap: Map<string, string[]>  // cellKey → card_ids
): string[] {
  const r1 = Math.min(rowOrder.indexOf(anchor.rowKey), rowOrder.indexOf(target.rowKey));
  const r2 = Math.max(rowOrder.indexOf(anchor.rowKey), rowOrder.indexOf(target.rowKey));
  const c1 = Math.min(colOrder.indexOf(anchor.colKey), colOrder.indexOf(target.colKey));
  const c2 = Math.max(colOrder.indexOf(anchor.colKey), colOrder.indexOf(target.colKey));

  const cardIds: string[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const key = `${rowOrder[r]}:${colOrder[c]}`;
      const ids = cellDataMap.get(key) ?? [];
      cardIds.push(...ids);
    }
  }
  return [...new Set(cardIds)]; // deduplicate
}
```

### Pattern 6: SVG Lasso Overlay

The lasso is an absolutely-positioned SVG element inserted into `_rootEl` (not `_gridEl`). It sits above the grid content but below the zoom toast:

```typescript
// SuperGridSelect.ts
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svg.style.position = 'absolute';
svg.style.inset = '0';
svg.style.width = '100%';
svg.style.height = '100%';
svg.style.pointerEvents = 'none';  // pass-through when not dragging
svg.style.zIndex = '5';            // above grid (z:2/3), below toast (z:100)

const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
rect.setAttribute('fill', 'rgba(26, 86, 240, 0.08)');
rect.setAttribute('stroke', '#1a56f0');
rect.setAttribute('stroke-dasharray', '4 3');
rect.setAttribute('stroke-width', '1.5');
rect.style.display = 'none';
svg.appendChild(rect);
```

During lasso drag, `svg.style.pointerEvents = 'all'` to capture events; restored to `'none'` on pointerup.

### Pattern 7: Selection Visual Update in D3 .each()

Selection visuals plug into the existing D3 data join `.each()` callback, reading from the SelectionProvider adapter:

```typescript
// In _renderCells() .each() callback — after existing style setting:
.each(function(d) {
  const el = this as HTMLDivElement;
  const cellKey = `${d.rowKey}:${d.colKey}`;
  const isSelected = selectionAdapter.isSelectedCell(cellKey);

  el.style.backgroundColor = isSelected
    ? 'rgba(26, 86, 240, 0.12)'
    : (d.count === 0 ? 'rgba(255,255,255,0.02)' : '');
  el.style.outline = isSelected ? '2px solid #1a56f0' : '';
  el.style.outlineOffset = isSelected ? '-2px' : '';
  el.dataset['selected'] = isSelected ? 'true' : '';
})
```

### Pattern 8: Selection Badge

A floating badge in the corner of `_rootEl` (similar to the zoom toast — lazily created):

```typescript
// Created lazily in mount() or on first selection
const badge = document.createElement('div');
badge.className = 'supergrid-selection-badge';
badge.style.position = 'absolute';
badge.style.bottom = '8px';
badge.style.right = '8px';
badge.style.zIndex = '50';  // above grid, below toast
badge.style.padding = '4px 10px';
badge.style.borderRadius = '12px';
badge.style.backgroundColor = '#1a56f0';
badge.style.color = '#fff';
badge.style.fontSize = '12px';
badge.style.display = 'none';  // hidden until selection > 0
```

### Anti-Patterns to Avoid

- **Calling getBoundingClientRect() in pointermove:** Forces layout on every mouse move event → O(N×M) thrash on a 50×50 grid. ALWAYS read from the Map cache.
- **Calling _renderCells() in the SelectionProvider subscription callback:** Selection visuals are CSS/style changes; they should NOT trigger a full re-render. Use a dedicated `_updateSelectionVisuals()` method that iterates the existing `.data-cell` elements and applies classes without touching the D3 data join.
- **Wiring Escape keydown on the grid root element only:** If the grid does not have focus, Escape won't fire. Wire on `document` with a guard checking that `_rootEl` is mounted, and remove in `destroy()`.
- **Storing selection state in the SVG overlay module:** Selection state lives in SelectionProvider (already exists). SuperGridSelect is only responsible for pointer event geometry and translating screen coordinates → cell keys → card IDs.
- **Making lasso drag compete with the scroll handler:** The lasso starts on `_rootEl` (the scroll container). A mousedown on the grid area — but not on a resize handle — starts lasso. The lasso's `pointerdown` handler should call `e.stopPropagation()` during drag to prevent scroll from interfering. Since SuperGridSizer uses `setPointerCapture` on its own handle elements and `stopPropagation()`, lasso events on `.data-cell` won't conflict.
- **Re-using SelectionProvider.range() for 2D Shift+click:** `range(id, allIds)` is 1D. Use the 2D rectangular range helper instead. Do not modify SelectionProvider.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer capture | Manual mousemove on document | `element.setPointerCapture(pointerId)` | Captures all pointer events even when cursor leaves viewport; handles touch/stylus |
| Selection visual update | Full D3 data join re-run | Direct DOM iteration over `.querySelectorAll('.data-cell')` in `_updateSelectionVisuals()` | Data join is expensive; visuals are CSS-only; pattern from TreeView._updateSelectionVisuals() |
| Bounding rect reading | Live `getBoundingClientRect()` in handler | `Map<string, DOMRect>` snapshot post-render | Forces layout; O(N) per frame |
| SVG namespace | `document.createElement('svg')` | `document.createElementNS('http://www.w3.org/2000/svg', 'svg')` | createElement creates an HTML SVGElement, not an SVG namespace element; attributes won't work |

**Key insight:** TreeView already established the correct selection wiring pattern (subscribe → `_updateSelectionVisuals()`, click → provider mutation). Phase 21 follows this exact template but adapted for the 2D grid geometry.

---

## Common Pitfalls

### Pitfall 1: Snapshot Timing — Measuring Before Layout Completes

**What goes wrong:** Calling `getBoundingClientRect()` synchronously inside `_renderCells()` (or immediately after) returns stale/incorrect rects because CSS Grid has not yet completed layout — the grid's `gridTemplateColumns` was just set and the browser hasn't reflowed.

**Why it happens:** `_renderCells()` synchronously sets style properties. Layout is computed asynchronously by the browser engine before the next paint. Calling `getBoundingClientRect()` synchronously forces a mid-render reflow (expensive AND inaccurate while content is changing).

**How to avoid:** Always call `bboxCache.scheduleSnapshot()` at the end of `_renderCells()`, which defers the measurement to the next `requestAnimationFrame()`. The snapshot then fires after the browser has fully laid out the new grid.

**Warning signs:** All bounding rects report `{x: 0, y: 0, width: 0, height: 0}` in tests; lasso selects wrong cells even when cursor is clearly inside them.

### Pitfall 2: Lasso vs. Scroll Container Event Conflict

**What goes wrong:** `_rootEl` is both the scroll container AND the lasso target. A mousedown on the grid starts a lasso, but the same event can also initiate the browser's native scroll drag. These fight each other.

**Why it happens:** Scroll containers respond to pointer events on their surface. Without disambiguation, both scroll and lasso start simultaneously.

**How to avoid:** In the lasso `pointerdown` handler, call `e.preventDefault()` to suppress scroll initiation during drag. Restore normal scroll after `pointerup`. The lasso should only start when `pointerdown` lands on a `.data-cell` — not on headers, resize handles, or empty grid background. Use `classifyClickZone()` to check before starting drag.

**Warning signs:** Grid starts scrolling while user is trying to lasso-select; lasso rect jumps/shakes during drag.

### Pitfall 3: Lasso Coordinates — Client vs. Scroll-Adjusted

**What goes wrong:** The lasso rectangle is drawn in `clientX/Y` coordinates, but the bounding box cache entries (`getBoundingClientRect()`) are also in client coordinates. However, the SVG overlay is absolutely positioned inside `_rootEl`, which is a scroll container. SVG coordinates must account for the scroll offset of `_rootEl`.

**Why it happens:** `getBoundingClientRect()` returns viewport-relative coordinates (clientX/Y). SVG absolute positioning inside a scrolling container means SVG `x/y` values are relative to the container's scroll origin, not the viewport.

**How to avoid:** When computing the lasso rect for SVG rendering, subtract `_rootEl.scrollLeft` and `_rootEl.scrollTop` from clientX/Y. For hit-testing, compare cache DOMRects (already in client coordinates) directly against client-coordinates lasso bounds — no adjustment needed for the hit-test.

```typescript
// SVG rect (container-relative):
const svgX = e.clientX - rootEl.getBoundingClientRect().left;
const svgY = e.clientY - rootEl.getBoundingClientRect().top;

// Hit-test (both in client coords):
const lassoClientRect = { x: Math.min(startX, e.clientX), ... };
```

**Warning signs:** Lasso rect appears offset from where user drew it; hit-test selects wrong cells.

### Pitfall 4: Escape Key Only Works When Grid is Focused

**What goes wrong:** Wiring the `keydown` listener on `_rootEl` means Escape only fires if the grid has DOM focus. Most users won't tab into the grid, so Escape never works.

**How to avoid:** Wire `keydown` on `document` (not `_rootEl`), with a guard that the grid is currently mounted (`_rootEl !== null`). Remove the listener in `destroy()`.

```typescript
// In mount():
this._boundEscapeHandler = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && this._rootEl) {
    this._selection.clear();
  }
};
document.addEventListener('keydown', this._boundEscapeHandler);

// In destroy():
document.removeEventListener('keydown', this._boundEscapeHandler);
```

**Warning signs:** Escape clears selection only after clicking inside the grid.

### Pitfall 5: Forgetting card_ids on Empty Cells

**What goes wrong:** Empty cells (`count === 0`) have `card_ids: []` in the CellDatum. Clicking or lasso-selecting empty cells should still call the selection handler (with an empty array), not be silently ignored.

**Why it happens:** The temptation is to early-return on `if (cell.count === 0) return` in the click handler.

**How to avoid:** All cells are selectable (CONTEXT.md locked decision). Even empty cells participate in lasso and Shift+click rectangles. Empty cells just contribute zero card IDs to the selection. The visual still applies the selected highlight to the cell itself.

**Warning signs:** Shift+click through empty cells produces a non-rectangular selection; lasso skips empty cells.

### Pitfall 6: SVG createElement vs createElementNS

**What goes wrong:** Using `document.createElement('svg')` creates an HTML-namespaced element. Setting SVG attributes like `viewBox`, `fill`, `stroke` on it has no effect.

**Why it happens:** Easy mistake — works for div/span/etc but not SVG.

**How to avoid:** Always use:
```typescript
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
```

**Warning signs:** SVG element appears in DOM but is invisible; rect has no stroke or fill.

### Pitfall 7: Lasso Starting from Header or Resize Handle

**What goes wrong:** User intends to collapse a column header but accidentally starts a lasso; or user starts lasso from a resize handle edge, conflicting with SuperGridSizer's pointer capture.

**Why it happens:** All three interactions (collapse, resize, lasso) are wired on the same root container.

**How to avoid:** Use `classifyClickZone()` in the lasso `pointerdown` handler. Only start lasso when zone is `'data-cell'` or `'grid'` (empty grid background). If zone is `'header'`, let the existing collapse handler take over. If zone is on a `.col-resize-handle`, SuperGridSizer's `stopPropagation()` already prevents the event from reaching the lasso handler.

---

## Code Examples

### Bounding Box Cache Snapshot (post-render)

```typescript
// SuperGridBBoxCache.ts
// Source: Native browser API — getBoundingClientRect() documentation
scheduleSnapshot(): void {
  requestAnimationFrame(() => {
    if (!this._gridEl) return;
    this._cache.clear();
    const cells = this._gridEl.querySelectorAll<HTMLElement>('.data-cell');
    for (const cell of cells) {
      const key = cell.dataset['key'];
      if (key) this._cache.set(key, cell.getBoundingClientRect());
    }
  });
}
```

### Rectangle Intersection Test

```typescript
// Pure function — no DOM interaction — easily unit-testable
function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: DOMRect
): boolean {
  return (
    a.x < b.right &&
    a.x + a.w > b.left &&
    a.y < b.bottom &&
    a.y + a.h > b.top
  );
}
```

### Pointer Capture Pattern (from SuperGridSizer)

```typescript
// Source: SuperGridSizer.ts — established pattern in this project
handle.addEventListener('pointerdown', (e: PointerEvent) => {
  e.preventDefault();
  e.stopPropagation();
  handle.setPointerCapture(e.pointerId);
  // ... start drag state
});
handle.addEventListener('pointerup', (e: PointerEvent) => {
  handle.releasePointerCapture(e.pointerId);
  // ... finalize
});
```

### Z-Axis Zone Classification

```typescript
// Source: project pattern — pure function for testability
type ClickZone = 'header' | 'data-cell' | 'supergrid-card' | 'grid';

function classifyClickZone(target: EventTarget | null): ClickZone {
  const el = target instanceof Element ? target : null;
  if (!el) return 'grid';
  if (el.closest('.col-header') || el.closest('.row-header')) return 'header';
  if (el.closest('.supergrid-card')) return 'supergrid-card';
  if (el.closest('.data-cell')) return 'data-cell';
  return 'grid';
}
```

### SelectionProvider Integration (from TreeView pattern)

```typescript
// Source: TreeView.ts — established project pattern
// In mount():
this._selectionUnsub = selectionProvider.subscribe(() => {
  this._updateSelectionVisuals();
});

// In destroy():
if (this._selectionUnsub) {
  this._selectionUnsub();
  this._selectionUnsub = null;
}

// _updateSelectionVisuals() — direct DOM walk, not D3 data join re-run:
private _updateSelectionVisuals(): void {
  if (!this._gridEl) return;
  const cells = this._gridEl.querySelectorAll<HTMLElement>('.data-cell');
  for (const cell of cells) {
    const key = cell.dataset['key'] ?? '';
    const isSelected = this._selectionAdapter.isSelectedCell(key);
    cell.style.backgroundColor = isSelected ? 'rgba(26, 86, 240, 0.12)' : '';
    cell.style.outline = isSelected ? '2px solid #1a56f0' : '';
    cell.style.outlineOffset = isSelected ? '-2px' : '';
  }
  // Update badge
  const count = this._selectionAdapter.getSelectedCount();
  if (this._badgeEl) {
    this._badgeEl.style.display = count > 0 ? '' : 'none';
    this._badgeEl.textContent = `${count} cards selected`;
  }
}
```

### Header Select-All Pattern

```typescript
// In _createColHeaderCell() — Cmd+click branch alongside existing collapse handler
el.addEventListener('click', (e: MouseEvent) => {
  if (e.metaKey || e.ctrlKey) {
    // Cmd+click: select all cards under this column header
    const colVal = cell.value;
    const allCardIds: string[] = [];
    for (const cd of this._lastCells) {
      if (String(cd[colField] ?? 'unknown') === colVal) {
        allCardIds.push(...(cd.card_ids ?? []));
      }
    }
    if (e.shiftKey) {
      // Cmd+Shift: add to existing selection (future enhancement — out of scope per CONTEXT.md)
    } else {
      this._selectionAdapter.select(allCardIds);
    }
    return; // don't collapse
  }
  // Plain click: existing collapse behavior
  // ...
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| mousemove + getBoundingClientRect() per frame | Post-render snapshot Map + O(1) cache lookup | Modern: documented in 2019+ perf guides | Eliminates layout thrash on drag |
| document-level mouse capture | Pointer Events setPointerCapture() | Pointer Events became standard ~2017 | Works on touch/stylus; no global listener leak |
| CSS transform overlay for lasso | SVG element with rect attributes | N/A — SVG has always been the right tool | Cleaner, no box model edge cases |

**Not deprecated in this context:** The project uses D3 v7.9, which is current. `d3.select()` and `.data()` patterns used here are stable.

---

## Open Questions

1. **SelectionProvider API mismatch: `getSelected()` vs `getSelectedIds()`**
   - What we know: TreeView's `SelectionProviderLike` interface uses `getSelected(): ReadonlySet<string>`. The concrete `SelectionProvider` exposes `getSelectedIds(): string[]` and `isSelected(id: string): boolean`. These are structurally different.
   - What's unclear: Should SuperGridSelectionLike use the concrete SelectionProvider directly, or wrap via the TreeView-style narrow interface?
   - Recommendation: SuperGrid should inject the concrete `SelectionProvider` (since it needs `selectAll()` and `clear()` which are not in TreeView's narrow interface) or define its own `SuperGridSelectionLike` that matches SelectionProvider's actual API. Do NOT add `getSelected()` to SelectionProvider — that would be a naming inconsistency. The adapter layer in SuperGridSelect manages the cell-key → card-id mapping above the provider.

2. **Badge position during zoom**
   - What we know: The badge is `position:absolute` inside `_rootEl` (the scroll container). At high zoom levels, the badge should still appear in the visible viewport corner, not scroll offscreen.
   - What's unclear: Whether `position:sticky` or `position:fixed` is more appropriate.
   - Recommendation: Use `position:sticky` with `bottom: 8px; right: 8px` — this keeps the badge in the visible scroll viewport without fixed positioning (which would be relative to the window, not the grid container).

3. **Lasso behavior when grid is scrolled**
   - What we know: The bounding box cache stores `DOMRect` values in client coordinates at snapshot time. If the user scrolls after the snapshot but before lasso-testing, the cache is stale.
   - What's unclear: How frequently to re-snapshot; whether a scroll-triggered re-snapshot is needed.
   - Recommendation: The cache is invalidated on each render (axis change, filter change). Mid-session scroll does NOT invalidate the cache — cell positions in client coordinates change when scrolled, so the hit-test would be against the scroll-adjusted bounding rects. Consider adjusting lasso client coords by current scroll delta, OR re-snapshot on scroll end (debounced 200ms). The simpler fix: re-snapshot on scroll end using the existing `_boundScrollHandler` rAF callback. Flag for planner to decide.

---

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` — skipping per instructions.

---

## Plan Decomposition Notes for Planner

The phase has three plans as specified. Here is how they map to the research:

**Plan 21-01: Cell bounding box cache** (`SuperGridBBoxCache.ts`)
- Pure class with `attach/detach`, `scheduleSnapshot()`, `hitTest()`, `getRect(cellKey)`
- Standalone unit tests in `tests/views/supergrid/SuperGridBBoxCache.test.ts`
- Integration: call `this._bboxCache.scheduleSnapshot()` at end of `_renderCells()` in SuperGrid

**Plan 21-02: SVG lasso overlay** (`SuperGridSelect.ts`)
- Class with `attach(rootEl, gridEl, bboxCache, selectionAdapter)` / `detach()`
- Handles: pointerdown on data-cell/grid → start lasso; pointermove → update SVG rect + live highlight; pointerup → finalize selection; Cmd modifier detected from `e.metaKey`
- Standalone unit tests in `tests/views/supergrid/SuperGridSelect.test.ts`
- `classifyClickZone()` pure function — extracted and tested independently

**Plan 21-03: Click/Cmd+click/Shift+click wiring + header select-all + Escape**
- All wired in `SuperGrid.ts` via new `SuperGridSelectionLike` adapter + `SuperGridBBoxCache` + `SuperGridSelect`
- New constructor arg: `selectionProvider?: SelectionProvider` (optional with no-op default, like positionProvider)
- Integration tests added to existing `tests/views/SuperGrid.test.ts`
- Wire: data-cell click → z-axis classify → select/toggle/2D-range; header Cmd+click → select-all; document keydown Escape → clear; SelectionProvider subscription → `_updateSelectionVisuals()`

---

## Sources

### Primary (HIGH confidence)

- Project codebase: `src/providers/SelectionProvider.ts` — concrete API, microtask-batching behavior verified by direct read
- Project codebase: `src/views/TreeView.ts` — `SelectionProviderLike` narrow interface, `_updateSelectionVisuals()` pattern, subscribe/unsubscribe pattern
- Project codebase: `src/views/supergrid/SuperGridSizer.ts` — `attach/detach` lifecycle, Pointer Events `setPointerCapture` pattern, `stopPropagation` on resize handle
- Project codebase: `src/views/SuperGrid.ts` — `_renderCells()` D3 .each() callback, `_lastCells` cache, z-index layout (drop zones z:10, headers z:2-3, toast z:100)
- Project codebase: `src/views/types.ts` — `SuperGridProviderLike`, `SuperGridBridgeLike` narrow interface pattern
- MDN: `Element.getBoundingClientRect()` — returns client-coordinate DOMRect
- MDN: `Element.setPointerCapture()` — pointer capture API behavior during drag

### Secondary (MEDIUM confidence)

- STATE.md accumulated constraints: "Lasso MUST use bounding box cache (not live getBoundingClientRect() per mousemove — O(N×M) layout thrash)" — confirmed as project-level decision
- TreeView visual pattern: `stroke: '#1a56f0'` for selected nodes — confirmed as project blue accent token

### Tertiary (LOW confidence)

- SVG overlay z-index recommendation (z:5 between headers z:2-3 and toast z:100) — inferred from existing SuperGrid z-index values; not explicitly documented

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns exist in project codebase
- Architecture: HIGH — follows exact `attach/detach` lifecycle and narrow interface patterns already established in Phases 17-20
- Pitfalls: HIGH — snapshot timing, SVG namespace, and coordinate-space issues are well-understood DOM patterns; coordinate mismatch for scrolled containers is MEDIUM (implementation detail to verify)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable browser APIs; no fast-moving dependencies)
