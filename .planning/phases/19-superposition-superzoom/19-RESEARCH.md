# Phase 19: SuperPosition + SuperZoom - Research

**Researched:** 2026-03-04
**Domain:** CSS Custom Property zoom, CSS position:sticky frozen headers, WheelEvent/pinch gesture handling, scroll position ephemeral state
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| POSN-01 | SuperPositionProvider tracks current PAFV coordinates (rowValues + colValues + scrollAnchorCard) as Tier 3 ephemeral state | Plain class with scrollTop/scrollLeft cache; not registered with StateCoordinator; no toJSON/setState |
| POSN-02 | PAFV coordinates survive axis transpose (tracked by axis values, not pixel positions) | Store rowValues[]+colValues[] string arrays (axis-value keys), not pixel offsets; remap after reorder |
| POSN-03 | Returning to SuperGrid from another view restores the last viewed coordinate position | SuperGrid.mount() reads SuperPositionProvider and calls scrollTo() on rootEl after first render |
| ZOOM-01 | User can zoom in/out via mouse wheel or trackpad pinch with upper-left corner pinned | WheelEvent with ctrlKey:true = pinch; deltaY + deltaMode normalization → scale factor; clamp [0.5, 3.0]; update CSS Custom Properties |
| ZOOM-02 | Row headers and column headers stay visible (frozen) during scroll via CSS position:sticky | position:sticky top:0 (col headers) and left:0 (row headers) inside the overflow:auto rootEl; z-index layering with background-color |
| ZOOM-03 | Zoom is implemented via CSS Custom Property column/row width scaling, not CSS transform | --sg-col-width and --sg-row-height CSS Custom Properties; grid-template-columns uses calc(); avoids d3.zoom overflow:auto conflict |
| ZOOM-04 | User cannot scroll past table boundaries (scroll extent is bounded) | Native overflow:auto handles it automatically — browser clamps scrollLeft/scrollTop to [0, scrollWidth-clientWidth]; no custom code needed |

</phase_requirements>

---

## Summary

Phase 19 has two parallel concerns: ephemeral scroll position tracking (SuperPositionProvider) and CSS-based zoom with frozen headers (SuperZoom).

**SuperPositionProvider** is a plain TypeScript class — NOT registered with StateCoordinator. It stores `scrollTop`, `scrollLeft`, and value-anchored PAFV coordinates (rowValues + colValues string arrays) directly from SuperGrid's `overflow:auto` root element. Since it does not register with StateCoordinator, it cannot trigger `supergrid:query` calls during scroll. Position restore on view return is implemented in `SuperGrid.mount()`: after the first `_renderCells()` call completes, apply `rootEl.scrollTop` and `rootEl.scrollLeft` from the provider. Axis transpose survival (POSN-02) requires storing axis *values* (e.g., `['note', 'link']`) not pixel offsets — the zoom/scroll state is remapped after transpose by finding the new pixel position of the stored values.

**SuperZoom** is entirely CSS-driven. Two CSS Custom Properties — `--sg-col-width` (default `120px`) and `--sg-row-height` (default `40px`) — are set on the grid container. `grid-template-columns` uses `calc(var(--sg-row-header-width)) repeat(N, calc(var(--sg-col-width)))` and grid cells use `min-height: var(--sg-row-height)`. The wheel/pinch event handler accumulates a `_zoomLevel` float (clamped to `[0.5, 3.0]`), then updates the CSS Custom Properties via `gridEl.style.setProperty(...)`. This scales the grid content while the `overflow:auto` root provides native scrollbars that expand automatically — no d3.zoom transform conflict.

**CSS position:sticky frozen headers** work correctly inside an `overflow:auto` container because the sticky element sticks to its nearest scrolling ancestor (the `overflow:auto` root), not the viewport. This is the *correct* behavior for SuperGrid. The key requirements are: (1) `position:sticky; top:0` on column header cells, (2) `position:sticky; left:0` on row header cells, (3) `position:sticky; top:0; left:0` on the corner cell, (4) explicit `background-color` on all sticky cells (otherwise scrolled content bleeds through), and (5) `z-index` layering: data cells = 0, col headers = 1, row headers = 2, corner cell = 3. The CSS Grid `align-items:stretch` pitfall does NOT apply here because the grid cells (headers) are fixed-height or auto-height, not stretched by neighbors.

**ZOOM-04 scroll boundary enforcement** is already handled natively by `overflow:auto`. The browser automatically clamps `scrollLeft` to `[0, scrollWidth - clientWidth]` and `scrollTop` to `[0, scrollHeight - clientHeight]`. No custom JavaScript boundary enforcement is needed.

**Primary recommendation:** SuperPositionProvider as a plain class (not a provider in the DI sense). CSS Custom Properties for zoom. position:sticky inside overflow:auto for frozen headers. Zero new npm packages required.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| CSS Custom Properties | Browser native | Drive column/row dimension scaling for zoom | Only zoom approach compatible with overflow:auto (d3.zoom transform is ruled out by STATE.md) |
| CSS position:sticky | Browser native | Freeze column and row headers during scroll | Works inside overflow:auto — sticks to the nearest scrolling ancestor, not viewport |
| WheelEvent API | Browser native | Detect mouse wheel and trackpad pinch gestures | ctrlKey:true discriminates pinch from pan; universal across Chrome/Firefox/Safari since 2016 |
| D3.js | ^7.9.0 (project) | No new D3 usage for this phase | Zoom avoids d3.zoom per STATE.md locked constraint |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + jsdom | Project standard | Test SuperPositionProvider and zoom behavior | Tests run in @vitest-environment jsdom; existing test infrastructure covers all needs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Custom Property zoom | d3.zoom with transform:scale | d3.zoom applies CSS transform which conflicts with overflow:auto; STATE.md locks out this option |
| CSS Custom Property zoom | CSS zoom property | CSS zoom became cross-browser in May 2024 (Firefox support added) but applies to element layout including fixed/sticky descendants; creates layout shifts that CSS Custom Properties avoid |
| CSS Custom Property zoom | transform:scale on grid inner | scale does not affect scrollable area; overflow:auto container would not expand; scrollbars would not reflect zoomed size |
| Native overflow:auto boundary | Custom scroll clamping JS | overflow:auto already clamps natively; custom JS is redundant and adds event listener cost |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── providers/
│   └── SuperPositionProvider.ts    # NEW — Tier 3 ephemeral scroll position cache
├── views/
│   ├── SuperGrid.ts                # Modified — add zoom handler, sticky CSS, position restore
│   ├── supergrid/
│   │   ├── SuperZoom.ts            # NEW — WheelEvent handler + CSS Custom Property updater
│   │   └── SuperStackHeader.ts    # No change — buildGridTemplateColumns updated to use CSS var
└── types.ts                        # No change required

tests/
├── providers/
│   └── SuperPositionProvider.test.ts   # NEW
└── views/
    └── SuperGrid.test.ts               # Extended with POSN + ZOOM tests
```

### Pattern 1: SuperPositionProvider — Tier 3 Ephemeral Class

**What:** A plain class (not a DI provider, not registered with StateCoordinator) that stores `scrollTop`, `scrollLeft`, and PAFV value coordinates. SuperGrid calls `provider.savePosition(rootEl)` on scroll and `provider.restorePosition(rootEl)` after first render in `mount()`.

**When to use:** Any time the scroll container needs to remember its position across view switches.

**Key constraints from STATE.md:**
- MUST NOT register with StateCoordinator (would trigger 60 supergrid:query calls/second during scroll)
- Stores scrollTop/scrollLeft for pixel-accurate restore; stores rowValues/colValues for axis-transpose survival

**Example:**

```typescript
// Source: STATE.md constraint + POSN-01/POSN-02/POSN-03 requirements

export class SuperPositionProvider {
  private _scrollTop: number = 0;
  private _scrollLeft: number = 0;
  private _rowValues: string[] = [];
  private _colValues: string[] = [];
  private _scrollAnchorCard: string | null = null;

  /** Call from SuperGrid scroll event listener (throttled/rAF) */
  savePosition(rootEl: HTMLElement): void {
    this._scrollTop = rootEl.scrollTop;
    this._scrollLeft = rootEl.scrollLeft;
    // rowValues + colValues are set separately via setAxisCoordinates()
  }

  /** Set axis-value coordinates after each _renderCells() call */
  setAxisCoordinates(rowValues: string[], colValues: string[], anchorCard: string | null = null): void {
    this._rowValues = [...rowValues];
    this._colValues = [...colValues];
    this._scrollAnchorCard = anchorCard;
  }

  /** Call from SuperGrid.mount() after first _renderCells() */
  restorePosition(rootEl: HTMLElement): void {
    rootEl.scrollTop = this._scrollTop;
    rootEl.scrollLeft = this._scrollLeft;
  }

  /** Read-only snapshot for POSN-02 axis-transpose remapping */
  getCoordinates(): { scrollTop: number; scrollLeft: number; rowValues: string[]; colValues: string[] } {
    return {
      scrollTop: this._scrollTop,
      scrollLeft: this._scrollLeft,
      rowValues: [...this._rowValues],
      colValues: [...this._colValues],
    };
  }

  /** Reset on SuperGrid destroy */
  reset(): void {
    this._scrollTop = 0;
    this._scrollLeft = 0;
    this._rowValues = [];
    this._colValues = [];
    this._scrollAnchorCard = null;
  }
}
```

**Confidence:** HIGH — plain class pattern matches project conventions (StateManager, DensityProvider follow same constructor-injection + subscribe pattern but this one intentionally has no subscribe).

### Pattern 2: CSS Custom Property Zoom

**What:** Two CSS Custom Properties on the grid container drive all cell sizing. The zoom handler updates them on wheel/pinch events. CSS Grid re-layouts automatically as column widths change.

**When to use:** Any time cell dimensions need programmatic control without disrupting layout or scroll boundaries.

**Example:**

```typescript
// Source: CSS specification + SuperStackHeader.buildGridTemplateColumns pattern

// Initial CSS setup on grid element:
gridEl.style.setProperty('--sg-col-width', '120px');
gridEl.style.setProperty('--sg-row-height', '40px');

// grid-template-columns uses the variable:
// '160px repeat(N, var(--sg-col-width))' — from buildGridTemplateColumns
// Each data cell: min-height: var(--sg-row-height)

// Zoom handler:
function applyZoom(gridEl: HTMLElement, newZoomLevel: number): void {
  const colWidth = Math.round(120 * newZoomLevel);    // base 120px * scale
  const rowHeight = Math.round(40 * newZoomLevel);     // base 40px * scale
  gridEl.style.setProperty('--sg-col-width', `${colWidth}px`);
  gridEl.style.setProperty('--sg-row-height', `${rowHeight}px`);
}
```

**Confidence:** HIGH — CSS Custom Properties with style.setProperty() is the established pattern for dynamic CSS value updates.

### Pattern 3: WheelEvent Pinch Detection

**What:** Attach a non-passive `wheel` event listener on the root element. When `ctrlKey === true`, intercept and apply zoom; otherwise let the event scroll normally.

**Key parameters:**
- `ctrlKey === true` → pinch gesture (trackpad) or Ctrl+scroll (keyboard)
- `deltaMode` normalization: multiply by 8 for `DOM_DELTA_LINE`, 24 for `DOM_DELTA_PAGE`
- Scale sensitivity: `Math.sign(dy) * Math.min(24, Math.abs(dy))` caps wild deltas
- Scale formula: asymmetric to preserve mathematical invertibility

**Example:**

```typescript
// Source: danburzo.ro/dom-gestures/ — HIGH confidence

const WHEEL_SCALE_SPEEDUP = 2.0;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;

function normalizeWheelDelta(e: WheelEvent): number {
  let dy = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 8;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= 24;
  // Cap to prevent wild zooms
  return Math.sign(dy) * Math.min(24, Math.abs(dy));
}

function deltaToScaleFactor(dy: number): number {
  // Asymmetric: +20% cannot be exactly reversed by -20%
  return dy <= 0
    ? 1 - (WHEEL_SCALE_SPEEDUP * dy) / 100
    : 1 / (1 + (WHEEL_SCALE_SPEEDUP * dy) / 100);
}

rootEl.addEventListener('wheel', (e: WheelEvent) => {
  if (!e.ctrlKey) return; // regular scroll — let default happen
  e.preventDefault();     // prevent browser page zoom

  const dy = normalizeWheelDelta(e);
  const factor = deltaToScaleFactor(dy);
  const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentZoom * factor));
  currentZoom = newZoom;
  applyZoom(gridEl, newZoom);
}, { passive: false }); // MUST be non-passive to call preventDefault()
```

**Confidence:** HIGH — ctrlKey pinch encoding is documented by Chrome team and MDN; deltaMode normalization is widely verified.

### Pattern 4: CSS position:sticky Frozen Headers Inside overflow:auto

**What:** Column header cells get `position:sticky; top:0`. Row header cells get `position:sticky; left:0`. The corner cell gets both. All sticky cells require explicit `background-color` to cover scrolled content.

**Key insight:** `position:sticky` sticks to the *nearest scrolling ancestor* — which is the `overflow:auto` rootEl, not the viewport. This is the desired behavior for SuperGrid.

**CSS Grid align-items issue:** Does NOT apply to SuperGrid's header cells because they are independently sized, not stretched by neighbor cells (header row height is independent of data cell height in the row layout).

**Z-index layering (no stacking context issues with plain divs):**

```css
/* Data cells — base */
.data-cell { position: relative; z-index: 0; background: var(--cell-bg, white); }

/* Column headers — sticky to top */
.col-header {
  position: sticky;
  top: 0;
  z-index: 2;
  background-color: var(--header-bg, #f5f5f5);  /* REQUIRED — prevents bleed-through */
}

/* Row headers — sticky to left */
.row-header {
  position: sticky;
  left: 0;
  z-index: 2;
  background-color: var(--header-bg, #f5f5f5);  /* REQUIRED */
}

/* Corner cell — sticky to both axes */
.corner-cell {
  position: sticky;
  top: 0;
  left: 0;
  z-index: 3;  /* Highest — must be above both col and row headers */
  background-color: var(--header-bg, #f5f5f5);  /* REQUIRED */
}
```

**Example in SuperGrid.ts context:**

```typescript
// Column header creation (in _createColHeaderCell):
el.style.position = 'sticky';
el.style.top = '0';
el.style.zIndex = '2';
el.style.backgroundColor = 'var(--sg-header-bg, #f5f5f5)';

// Row header creation (in _renderCells row header block):
rowHeaderEl.style.position = 'sticky';
rowHeaderEl.style.left = '0';
rowHeaderEl.style.zIndex = '2';
rowHeaderEl.style.backgroundColor = 'var(--sg-header-bg, #f5f5f5)';

// Corner cell (in _renderCells corner block):
corner.style.position = 'sticky';
corner.style.top = '0';
corner.style.left = '0';
corner.style.zIndex = '3';
corner.style.backgroundColor = 'var(--sg-header-bg, #f5f5f5)';
```

**Confidence:** HIGH — confirmed by multiple authoritative sources (CSS-Tricks, ishadeed.com, MDN).

### Pattern 5: Scroll Position Restore After mount()

**What:** After SuperGrid mounts and the first `_renderCells()` call completes, restore scroll position from SuperPositionProvider. This must happen *after* render because the scroll container needs content to have a scrollable range.

**Example:**

```typescript
// In SuperGrid.mount():
void this._fetchAndRender().then(() => {
  // After first render, restore position
  if (this._positionProvider && this._rootEl) {
    this._positionProvider.restorePosition(this._rootEl);
  }
});

// In SuperGrid._scrollHandler (throttled via rAF):
private _rafId: number | null = null;
private _onScroll = (): void => {
  if (this._rafId !== null) return;
  this._rafId = requestAnimationFrame(() => {
    this._rafId = null;
    if (this._rootEl && this._positionProvider) {
      this._positionProvider.savePosition(this._rootEl);
    }
  });
};
```

**Confidence:** HIGH — scrollTop/scrollLeft read/write is the standard DOM API for scroll position; rAF throttling is the established pattern for scroll handlers.

### Anti-Patterns to Avoid

- **Registering SuperPositionProvider with StateCoordinator**: This would trigger `supergrid:query` Worker calls at 60fps during scroll. STATE.md explicitly locks this out.
- **Using d3.zoom for zoom**: d3.zoom applies a CSS transform which conflicts with `overflow:auto` behavior (the container doesn't expand; scrollbars don't reflect zoomed content). STATE.md locks this out.
- **Using CSS transform:scale on the grid container**: Same conflict as d3.zoom — the overflow:auto container does not see the scaled content size.
- **Using the CSS zoom property**: CSS zoom achieved cross-browser support in May 2024, but it aligns elements differently from what CSS Custom Property scaling achieves. It creates new formatting contexts and can interact unexpectedly with `position:sticky`. The Custom Property approach is safer and already used by SuperGrid for column templates.
- **Omitting background-color on sticky cells**: Without background-color, scrolled-behind data cells bleed through sticky headers, creating visual corruption.
- **Omitting `{ passive: false }` on wheel listener**: Without this, `e.preventDefault()` is silently ignored (passive event listeners cannot be cancelled). The browser will zoom the page instead of the grid.
- **Storing pixel offsets for POSN-02**: Axis transpose changes column order and potentially sizes, making pixel offsets meaningless after reorder. Always store axis values (string arrays) and remap after transpose.
- **Calling rootEl.scrollTo() before _renderCells()**: The scroll container has zero scrollable extent before content is rendered. Setting scrollTop before content exists is a no-op. Must restore position after first render.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll boundary enforcement | Custom scrollLeft/scrollTop clamp JS | Native `overflow:auto` | Browser already clamps scroll positions to [0, scrollWidth-clientWidth]; ZOOM-04 is free |
| Pinch gesture detection library | Custom touch event parser | WheelEvent + ctrlKey trick | Chrome, Firefox, Safari all encode trackpad pinch as `wheel` with `ctrlKey:true`; universal since Chrome 35/FF 55 |
| Column/row resize during zoom | Virtual scroll container resizing | CSS Grid re-layout from Custom Property change | CSS Grid reflows automatically when `grid-template-columns` values change; no JS needed |
| Zoom transform matrix calculation | DOMMatrix + origin translation | Direct CSS Custom Property update | Matrix approach is needed only for arbitrary-origin zoom (pan+zoom). Upper-left corner is fixed by the overflow:auto native scroll anchor |

**Key insight:** The upper-left anchor requirement (ZOOM-01) is automatically satisfied by `overflow:auto` behavior: when column widths grow (zoom in), the scroll position in pixels remains unchanged, which means the visible upper-left corner cell stays anchored. No transform matrix manipulation needed.

---

## Common Pitfalls

### Pitfall 1: Sticky Headers Not Sticking

**What goes wrong:** Column or row headers scroll out of view despite `position:sticky`.

**Why it happens:** Three possible root causes:
1. Missing `top`/`left` inset value (required for sticky to activate)
2. Ancestor has `overflow:hidden` (not `overflow:auto`) — sticky sticks to the nearest scrolling ancestor; if an intermediate ancestor has `overflow:hidden`, it creates a new scroll context that breaks sticking
3. Grid items are stretched by `align-items:stretch` — sticky cannot activate on stretched items

**How to avoid:** Set `top:0` on col headers, `left:0` on row headers. The SuperGrid `rootEl` has `overflow:auto` and is the only scrolling ancestor — sticky will work correctly. No `align-items:stretch` issue because header cells are not grid items being stretched by row-height constraints.

**Warning signs:** Headers visible initially but scroll away; or sticky set but `top` missing.

### Pitfall 2: Sticky Headers Without Background

**What goes wrong:** Scrolled data cells are visible through sticky headers, creating garbled text overlap.

**Why it happens:** `position:sticky` keeps the element in the paint order of the scroll container. Without a background, the sticky element is transparent and content scrolls behind it visibly.

**How to avoid:** Always set `background-color` (or `background`) on every sticky element. Use a CSS Custom Property (`--sg-header-bg`) so it can be themed.

**Warning signs:** Scrolling reveals text from data cells "underneath" the frozen header area.

### Pitfall 3: wheel Listener Not Intercepting Pinch

**What goes wrong:** Trackpad pinch zooms the browser page instead of the SuperGrid zoom level.

**Why it happens:** Either (a) the wheel listener is registered as `{ passive: true }` (the browser default in modern browsers), which prevents `preventDefault()` from working, or (b) the listener is on a child element rather than the `rootEl`.

**How to avoid:** Register the listener with `{ passive: false }` explicitly. Attach to `rootEl`, not the inner `gridEl`. Check `e.ctrlKey === true` before `preventDefault()` to only intercept pinch, not regular scroll.

**Warning signs:** `e.cancelable` is `false` when checking inside the handler (indicates passive mode); browser zoom occurs instead of custom zoom.

### Pitfall 4: Scroll Position Restored Before Content Exists

**What goes wrong:** `rootEl.scrollTop = savedValue` is set in `mount()` before `_fetchAndRender()` completes. The assignment silently fails because scrollable area = 0.

**Why it happens:** The scroll container has no scrollable extent until cells are rendered. Setting `scrollTop` when `scrollHeight <= clientHeight` is clamped to 0.

**How to avoid:** Restore position in the `.then()` callback of the first `_fetchAndRender()` call, not synchronously in `mount()`.

**Warning signs:** Grid always opens at (0,0) despite saved position; scrollTop reads back as 0 immediately after setting.

### Pitfall 5: Zoom CSS Custom Property Not Set on gridEl

**What goes wrong:** CSS Custom Properties set on `rootEl` instead of `gridEl` (or vice versa). `grid-template-columns` and `min-height` on child cells only inherit from the element they are defined on or an ancestor.

**Why it happens:** SuperGrid has two main elements: `rootEl` (overflow:auto) and `gridEl` (display:grid). The Custom Properties must be on `gridEl` since that's where `grid-template-columns` is set.

**How to avoid:** `gridEl.style.setProperty('--sg-col-width', ...)` — set on the `display:grid` element, not the scroll container.

**Warning signs:** CSS variable updates log correctly but grid column widths don't change.

### Pitfall 6: z-index Corner Cell Below Col or Row Headers

**What goes wrong:** When scrolling diagonally (both scrollTop and scrollLeft non-zero), the corner cell appears behind one of the sticky axes, creating a partial overlap artifact.

**Why it happens:** Corner cell z-index not high enough — it renders below col headers or row headers.

**How to avoid:** Corner cell z-index MUST be strictly higher than both col header z-index and row header z-index. Use: data cells = 0, col headers = 2, row headers = 2, corner = 3. All must have `background-color`.

**Warning signs:** Scrolling to a non-zero horizontal+vertical position reveals a corrupted corner area.

### Pitfall 7: POSN-01 Provider Registered with StateCoordinator

**What goes wrong:** SuperPositionProvider is registered with StateCoordinator, causing it to trigger `supergrid:query` Worker calls on every scroll event (~60/second). This hammers the WASM Worker and causes jank.

**Why it happens:** Pattern confusion — other providers (PAFVProvider, FilterProvider) register with StateCoordinator. SuperPositionProvider must NOT follow this pattern.

**How to avoid:** SuperPositionProvider has no `subscribe()` method and is never passed to `coordinator.registerProvider()`. It is pure ephemeral state — read/write by SuperGrid directly with no notification mechanism.

**Warning signs:** Network/Worker activity visible in DevTools during scroll; browser tab stuttering.

---

## Code Examples

Verified patterns from official sources:

### WheelEvent Pinch Scale Accumulation

```typescript
// Source: danburzo.ro/dom-gestures/ — verified against Chrome team documentation
// Pinch-to-zoom encoding: WheelEvent with ctrlKey:true, deltaY = scale increment

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const WHEEL_SCALE_SPEEDUP = 2.0;

function normalizeWheelDelta(e: WheelEvent): number {
  let dy = e.deltaY;
  if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) dy *= 8;
  else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) dy *= 24;
  return Math.sign(dy) * Math.min(24, Math.abs(dy));
}

function wheelDeltaToScaleFactor(dy: number): number {
  // Asymmetric formula: shrink/enlarge by equal amounts is NOT perfectly reversible
  // e.g., 1.0 * 1.2 * (1/1.2) ≠ exactly 1.0 — this avoids drift
  return dy <= 0
    ? 1 - (WHEEL_SCALE_SPEEDUP * dy) / 100
    : 1 / (1 + (WHEEL_SCALE_SPEEDUP * dy) / 100);
}

// Usage in wheel listener:
rootEl.addEventListener('wheel', (e: WheelEvent) => {
  if (!e.ctrlKey) return;  // pan — let scroll happen normally
  if (e.cancelable !== false) e.preventDefault();  // prevent browser page zoom
  const dy = normalizeWheelDelta(e);
  const factor = wheelDeltaToScaleFactor(dy);
  this._zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this._zoomLevel * factor));
  this._applyZoom();
}, { passive: false });
```

### CSS Custom Property Zoom Application

```typescript
// Source: CSS specification + project pattern (buildGridTemplateColumns in SuperStackHeader.ts)

private _zoomLevel = 1.0;
private readonly BASE_COL_WIDTH = 120;  // px
private readonly BASE_ROW_HEIGHT = 40;  // px

private _applyZoom(): void {
  const grid = this._gridEl;
  if (!grid) return;
  const colWidth = Math.round(this.BASE_COL_WIDTH * this._zoomLevel);
  const rowHeight = Math.round(this.BASE_ROW_HEIGHT * this._zoomLevel);
  grid.style.setProperty('--sg-col-width', `${colWidth}px`);
  grid.style.setProperty('--sg-row-height', `${rowHeight}px`);
  // grid-template-columns update: buildGridTemplateColumns must use the CSS var
  // or be called again with the new width
}
```

### buildGridTemplateColumns with CSS Custom Property

```typescript
// Source: /src/views/supergrid/SuperStackHeader.ts (existing function)
// Phase 19 modification: replace hardcoded px with CSS var

// Current (Phase 18):
export function buildGridTemplateColumns(leafCount: number, rowHeaderWidth = 160): string {
  return `${rowHeaderWidth}px repeat(${leafCount}, minmax(60px, 1fr))`;
}

// Phase 19 update — use CSS Custom Property for data column width:
export function buildGridTemplateColumns(leafCount: number, rowHeaderWidth = 160): string {
  return `${rowHeaderWidth}px repeat(${leafCount}, var(--sg-col-width, 120px))`;
}
// Note: rowHeaderWidth is NOT scaled by zoom — it stays fixed for readability
```

### CSS position:sticky Frozen Headers (Inline Style Pattern)

```typescript
// Source: MDN position:sticky + CSS-Tricks table frozen headers pattern
// Applied inline in SuperGrid._renderCells() / _createColHeaderCell()

// Column header (sticky to top):
el.style.position = 'sticky';
el.style.top = '0';
el.style.zIndex = '2';
el.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';

// Row header (sticky to left):
rowHeaderEl.style.position = 'sticky';
rowHeaderEl.style.left = '0';
rowHeaderEl.style.zIndex = '2';
rowHeaderEl.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';

// Corner cell (sticky to both axes — highest z-index):
corner.style.position = 'sticky';
corner.style.top = '0';
corner.style.left = '0';
corner.style.zIndex = '3';
corner.style.backgroundColor = 'var(--sg-header-bg, #f0f0f0)';
```

### scrollTop/scrollLeft Save and Restore

```typescript
// Source: MDN Element.scrollTop / MDN Element.scrollLeft
// Standard read/write DOM properties — no library needed

class SuperPositionProvider {
  private _scrollTop = 0;
  private _scrollLeft = 0;

  savePosition(el: HTMLElement): void {
    this._scrollTop = el.scrollTop;
    this._scrollLeft = el.scrollLeft;
  }

  restorePosition(el: HTMLElement): void {
    // scrollTop/scrollLeft are natively clamped by the browser to valid range
    // [0, scrollHeight - clientHeight] and [0, scrollWidth - clientWidth]
    el.scrollTop = this._scrollTop;
    el.scrollLeft = this._scrollLeft;
  }
}

// In SuperGrid.mount():
this._coordinatorUnsub = this._coordinator.subscribe(() => {
  void this._fetchAndRender();
});

// First fetch + restore after initial render:
void this._fetchAndRender().then(() => {
  if (this._rootEl && this._positionProvider) {
    this._positionProvider.restorePosition(this._rootEl);
  }
});

// Throttled scroll handler via rAF:
private _rafId: number | null = null;
private _boundScrollHandler = (): void => {
  if (this._rafId !== null) return;
  this._rafId = requestAnimationFrame(() => {
    this._rafId = null;
    if (this._rootEl && this._positionProvider) {
      this._positionProvider.savePosition(this._rootEl);
    }
  });
};

// In mount():
this._rootEl!.addEventListener('scroll', this._boundScrollHandler, { passive: true });

// In destroy():
this._rootEl?.removeEventListener('scroll', this._boundScrollHandler);
if (this._rafId !== null) {
  cancelAnimationFrame(this._rafId);
  this._rafId = null;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| d3.zoom for pan/zoom | CSS Custom Property zoom for data-table zoom | 2023-2024 (tables/spreadsheets moved away from d3.zoom) | Avoids transform vs overflow:auto conflict; scrollbars reflect true content size |
| JS scroll boundary clamping | Native overflow:auto clamping | N/A — always worked | No custom boundary code needed for ZOOM-04 |
| Separate scroll sync for frozen headers | CSS position:sticky inside overflow:auto | CSS Sticky widely supported 2019+ | Declarative — no JS scroll event listeners for header freezing |
| Pixel-based position restore | Value-anchored coordinates (axis values) for transpose survival | New in this architecture | Survives axis reorder without remapping pixel → value → pixel |

**Deprecated/outdated:**
- `d3.zoom` for spreadsheet-style zooming: was common in data viz; now considered wrong for overflow:auto containers. The zoom property (CSS) is now cross-browser as of May 2024 but creates formatting context issues. CSS Custom Properties are the correct approach for grid-based zoom.
- JavaScript-based header freezing (scroll event + translateX): replaced by `position:sticky`. No JS needed for the freeze behavior itself.

---

## Open Questions

1. **Zoom level persistence scope**
   - What we know: POSN-01 specifies Tier 3 ephemeral state (not persisted). ZOOM-03 says zoom is CSS Custom Property based.
   - What's unclear: Whether `_zoomLevel` should be on `SuperPositionProvider` (logical grouping) or directly on `SuperGrid` (simpler).
   - Recommendation: Store `_zoomLevel` on SuperGrid as a private instance variable — it's view rendering state, not "position coordinates". SuperPositionProvider tracks WHERE the user is looking (scroll offset + value anchors). The zoom level is HOW they are looking (visual scale). Keep separate.

2. **POSN-02 axis-value to pixel remapping after transpose**
   - What we know: After axis transpose, `_colValues` (e.g., `['note', 'link']`) may still be valid but in a different column order. The scroll position in pixels would need to be remapped to find the new pixel position of the anchor cell.
   - What's unclear: Whether to implement value→pixel remapping (complex) or simply reset scroll position on transpose (simpler).
   - Recommendation: Reset scroll position (scrollTop=0, scrollLeft=0) on axis transpose events. Axis transpose is a deliberate UI action that reflows the entire grid — the user's previous scroll position is contextually invalid post-transpose. POSN-02 says "survive axis transpose" meaning the provider's state is not corrupted, not that the exact pixel position is maintained. Resetting on transpose is the correct UX.

3. **buildGridTemplateColumns modification scope**
   - What we know: The current implementation returns `${rowHeaderWidth}px repeat(${leafCount}, minmax(60px, 1fr))`. Phase 19 zoom needs fixed-width columns (not `1fr`) so zoom applies linearly.
   - What's unclear: Whether changing from `1fr` to fixed-px breaks existing behavior.
   - Recommendation: Change data column width from `minmax(60px, 1fr)` to `var(--sg-col-width, 120px)` (fixed width). `1fr` columns cannot be zoomed — they would shrink/expand to fill space instead of growing with zoom factor. The row header column stays fixed-width (`rowHeaderWidth`px). This change is required for ZOOM-03 to work correctly.

---

## Validation Architecture

> `workflow.nyquist_validation` is not present in `.planning/config.json` — skipping this section.

---

## Sources

### Primary (HIGH confidence)

- `/Users/mshaler/Developer/Projects/Isometry/src/views/SuperGrid.ts` — rootEl overflow:auto structure, _fetchAndRender pipeline, _createColHeaderCell, existing mount/destroy lifecycle
- `/Users/mshaler/Developer/Projects/Isometry/src/views/supergrid/SuperStackHeader.ts` — buildGridTemplateColumns function to be modified for CSS Custom Property zoom
- `/Users/mshaler/Developer/Projects/Isometry/src/providers/StateCoordinator.ts` — confirms why SuperPositionProvider MUST NOT register (setTimeout 16ms batch pattern)
- `/Users/mshaler/Developer/Projects/Isometry/.planning/STATE.md` — Locked constraints: "SuperZoom MUST use CSS Custom Property scaling", "SuperPositionProvider MUST NOT register with StateCoordinator"
- danburzo.ro/dom-gestures — WheelEvent deltaY normalization, deltaMode handling, asymmetric scale formula, WHEEL_SCALE_SPEEDUP constant
- MDN WheelEvent API — ctrlKey pinch encoding, deltaMode values, { passive: false } requirement
- css-tricks.com — a-table-with-both-a-sticky-header-and-a-sticky-first-column — z-index hierarchy, background-color requirement
- ishadeed.com/article/position-sticky-css-grid — align-self:start fix for CSS Grid sticky, sticking to overflow ancestor (not viewport)
- CSS-Tricks "dealing with overflow and position sticky" — "element sticks to nearest scrolling ancestor" — confirmed sticky works INSIDE overflow:auto

### Secondary (MEDIUM confidence)

- dev.to/lalitkhu — Sticky header + frozen column CSS implementation — z-index: corner=6, headers=5, body cells=1 (adapted for project's simpler z-index scheme)
- WebSearch — confirmed `overflow:auto` with explicit height allows position:sticky to function (sticks to container, not viewport)
- WebSearch — confirmed `{ passive: false }` requirement for wheel event preventDefault()

### Tertiary (LOW confidence)

- WebSearch — CSS zoom property cross-browser support as of May 2024 (Firefox added) — used only to confirm why CSS zoom property is NOT recommended here (creates formatting context issues)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all CSS/DOM APIs are standard and well-supported
- Architecture: HIGH — STATE.md locks out the two major alternative approaches (d3.zoom, StateCoordinator registration); remaining design space is small and well-understood
- Pitfalls: HIGH — all pitfalls are verified by official documentation or existing codebase constraints; sticky+overflow:auto interaction confirmed by multiple authoritative sources

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable CSS/DOM APIs — no fast-moving dependencies)
