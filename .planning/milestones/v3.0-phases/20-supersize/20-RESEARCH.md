# Phase 20: SuperSize - Research

**Researched:** 2026-03-04
**Domain:** Direct-manipulation column resize — Pointer Events API, CSS Custom Properties, PAFVProvider persistence
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Resize interaction feel**
- 8px drag handle hit zone on the right edge of leaf column headers (standard spreadsheet feel — matches Excel/Google Sheets)
- Live resize during drag — column width updates in real time as user drags (no ghost line)
- Only leaf-level column headers have resize handles — parent spanning headers do not
- Cursor changes to `col-resize` on hover over the 8px handle zone

**Zoom × resize interplay**
- Custom column widths scale proportionally with zoom (stored as base values, rendered as base × zoomLevel)
- Shift+drag normalizes ALL columns to equal width (the dragged width) — a "make all columns this size" gesture
- Shift+drag normalizes to the base width (÷ zoom), so the uniform result is zoom-aware

**Auto-fit behavior**
- Double-click auto-fit measures widest visible cell in the column AND the header text — fits to whichever is wider
- Only leaf columns support auto-fit (consistent with resize handles being leaf-only)

**Persistence scope**
- Column widths reset to defaults when axes change (different axes produce different columns — old widths are meaningless)
- Row header column stays fixed at 160px (ROW_HEADER_WIDTH) — not resizable in this phase
- Stale persisted width keys (columns that no longer exist in current data) are silently ignored on restore
- New columns (not in persisted state) get the default width (BASE_COL_WIDTH = 120px)

### Claude's Discretion

- Minimum column width (somewhere around 40-80px based on header readability)
- Maximum column width (or no cap — based on grid scrolling behavior)
- Auto-fit padding (breathing room beyond measured content)
- Auto-fit maximum cap (whether to prevent auto-fit from making unreasonably wide columns)
- Width storage formula when resizing while zoomed (divide by zoom to get base, or another approach)
- Reset gesture for clearing all custom widths back to defaults
- Storage location for column widths (PAFVState extension vs separate provider — follow existing patterns)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SIZE-01 | User can drag column header edge to resize column width | Pointer Events API: pointerdown/pointermove/pointerup + setPointerCapture on an 8px handle element; update CSS Custom Property `--col-width-{colKey}` per drag event; `buildGridTemplateColumns` must be refactored from `repeat(N, var(--sg-col-width))` to per-column values |
| SIZE-02 | User can double-click column header edge to auto-fit column width to content | `dblclick` on handle; measure all `.data-cell[data-col="{colKey}"]` via `getBoundingClientRect()` + header element width; add padding; set base width |
| SIZE-03 | User can Shift+drag to bulk-resize all columns proportionally | `e.shiftKey` in pointermove handler; compute dragged base width, apply to all column keys; same CSS var update loop as SIZE-01 |
| SIZE-04 | Column widths persist to Tier 2 state via PAFVProvider across sessions | Extend `PAFVState` interface with optional `colWidths?: Record<string, number>`; update `toJSON()`/`setState()`/`isPAFVState()` in PAFVProvider; reset widths when axes change in `setColAxes`/`setRowAxes`/`setViewType` |
</phase_requirements>

---

## Summary

Phase 20 implements direct-manipulation column resizing for SuperGrid using the Pointer Events API. This is a well-understood browser primitive — `pointerdown` + `setPointerCapture()` + `pointermove` + `pointerup` — that replaces older `mousedown`/`mousemove` patterns. No external library is needed.

The key architectural challenge is the transition from a **uniform column width model** (the current `repeat(N, var(--sg-col-width, 120px))`) to a **per-column width model**. Each leaf column needs its own CSS Custom Property (`--col-width-{colKey}`), and `buildGridTemplateColumns` must be updated to enumerate them. The `SuperZoom.applyZoom()` method currently sets a single `--sg-col-width` — that global var becomes unused for data columns once per-column widths are in place (or acts as a fallback for columns that have not been resized).

Width persistence extends `PAFVState` in `PAFVProvider` with an optional `colWidths?: Record<string, number>` map. This map stores **base pixel values** (pre-zoom). The render path multiplies by `zoomLevel` at display time. Widths reset on axis change (stale keys are meaningless for a different axis configuration).

**Primary recommendation:** Build `SuperGridSizer.ts` as a standalone class (like `SuperZoom`) that attaches/detaches pointer event listeners, owns the resize drag state, and exposes a `getColWidths()` / `setColWidths()` API. `SuperGrid` delegates to it — the same pattern used for `SuperZoom`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Pointer Events API | Browser native | Drag tracking with pointer capture | Cross-device (mouse/touch/pen), no library needed, `setPointerCapture` eliminates tracking outside element |
| CSS Custom Properties | Browser native | Per-column width storage and live update | Already used by the project (`--sg-col-width`, `--sg-zoom`); DOM-free state reads for zoom interplay |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| No additional libraries | — | — | All required browser APIs are native and already available |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pointer Events API | MouseEvent + mousemove on document | Pointer Events preferred: handles touch, auto-capture with setPointerCapture, no global listener teardown risk |
| Per-column CSS Custom Properties | Inline `width` / `style.width` on cells | CSS Custom Properties are consistent with the existing zoom pattern; changing one var updates all cells in that column without touching each cell's DOM |
| PAFVState extension | Separate `ui_state` key or in-memory-only | PAFVProvider already implements Tier 2 round-trip; extending its state is lowest friction and consistent with `colAxes`/`rowAxes` precedent |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
src/views/supergrid/
├── SuperStackHeader.ts    # Existing — buildGridTemplateColumns needs update
├── SuperZoom.ts           # Existing — applyZoom() interacts with per-col widths
├── SuperGridSizer.ts      # NEW — Pointer Events drag handler (Plan 20-01)
```

### Pattern 1: SuperGridSizer as a Lifecycle Object

**What:** A standalone class that mirrors `SuperZoom` — it `attach(gridEl)`/`detach()` and manages all pointer event listeners internally. `SuperGrid` constructs it in `mount()` and calls `detach()` in `destroy()`.

**When to use:** Any time interaction logic has its own lifecycle that must be attached to DOM elements. The SuperZoom precedent makes this the established pattern for this codebase.

**Example:**
```typescript
// SuperGridSizer.ts
export class SuperGridSizer {
  private _gridEl: HTMLElement | null = null;
  private _colWidths: Map<string, number> = new Map(); // colKey → base px
  private _onWidthsChange: ((widths: Map<string, number>) => void) | null = null;

  // Drag state
  private _dragging: { colKey: string; startX: number; startWidth: number } | null = null;
  private _boundPointerMove: (e: PointerEvent) => void;
  private _boundPointerUp: (e: PointerEvent) => void;

  constructor(onWidthsChange?: (widths: Map<string, number>) => void) {
    this._onWidthsChange = onWidthsChange ?? null;
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp = this._onPointerUp.bind(this);
  }

  attach(gridEl: HTMLElement): void {
    this._gridEl = gridEl;
    // Delegate: header cells wired in SuperGrid._createColHeaderCell via _addResizeHandle()
  }

  detach(): void {
    this._gridEl = null;
  }

  getColWidths(): Map<string, number> { return new Map(this._colWidths); }
  setColWidths(widths: Map<string, number>): void { this._colWidths = new Map(widths); }
  resetColWidths(): void { this._colWidths.clear(); }
}
```

### Pattern 2: setPointerCapture for Drag Tracking

**What:** Call `handle.setPointerCapture(e.pointerId)` on `pointerdown`. This routes all subsequent pointer events to the handle element even when the pointer moves outside it or the browser window. The drag terminates on `pointerup` or `pointercancel` automatically.

**When to use:** Any drag interaction. This is the standard replacement for `document.addEventListener('mousemove')` teardown patterns.

**Example:**
```typescript
// On the 8px resize handle element:
handle.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return; // left button only
  e.preventDefault(); // prevent text selection during drag
  handle.setPointerCapture(e.pointerId);
  this._dragging = { colKey, startX: e.clientX, startWidth: currentBaseWidth };
  handle.addEventListener('pointermove', this._boundPointerMove);
  handle.addEventListener('pointerup', this._boundPointerUp);
  handle.addEventListener('pointercancel', this._boundPointerUp);
});

private _onPointerMove(e: PointerEvent): void {
  if (!this._dragging) return;
  const dx = e.clientX - this._dragging.startX;
  const zoomLevel = this._getZoomLevel(); // read from positionProvider
  const newBaseWidth = Math.max(MIN_COL_WIDTH, this._dragging.startWidth + dx / zoomLevel);
  if (e.shiftKey) {
    // Bulk normalize all columns to newBaseWidth
    for (const key of this._colWidths.keys()) {
      this._colWidths.set(key, newBaseWidth);
    }
  } else {
    this._colWidths.set(this._dragging.colKey, newBaseWidth);
  }
  this._applyWidthsToDOM();
  if (this._onWidthsChange) this._onWidthsChange(new Map(this._colWidths));
}
```

### Pattern 3: Per-Column CSS Custom Properties

**What:** Replace `repeat(N, var(--sg-col-width, 120px))` with individual `--col-width-{colKey}` values in `grid-template-columns`. Each column's width is its own CSS variable; updating one var via `gridEl.style.setProperty()` reflows only that column.

**When to use:** Per-column widths. The `--sg-col-width` global var becomes a fallback for when no custom width is set for a column.

**Example:**
```typescript
// In buildGridTemplateColumns (updated signature):
export function buildGridTemplateColumns(
  leafColKeys: string[],
  colWidths: Map<string, number>,
  zoomLevel: number,
  rowHeaderWidth = 160
): string {
  if (leafColKeys.length === 0) return `${rowHeaderWidth}px`;
  const colDefs = leafColKeys.map(key => {
    const baseWidth = colWidths.get(key) ?? BASE_COL_WIDTH;
    const px = Math.round(baseWidth * zoomLevel);
    return `${px}px`;
  });
  return `${rowHeaderWidth}px ${colDefs.join(' ')}`;
}
```

Alternative approach using CSS Custom Properties per column (avoids recomputing grid-template-columns on every resize event):
```typescript
// Set individual CSS vars on gridEl:
gridEl.style.setProperty(`--col-width-${sanitizeKey(colKey)}`, `${Math.round(baseWidth * zoom)}px`);
// Then grid-template-columns uses: 160px var(--col-width-note) var(--col-width-task) ...
```

Both approaches work. The **inline CSS var per column** approach (setting vars on the grid element then referencing them in `grid-template-columns`) means the grid-template-columns string is static once built — only the CSS var values change during drag. This is slightly more efficient for live drag. The **direct px value** approach (rebuilding grid-template-columns with literal px values on each pointermove) is simpler to reason about and avoids CSS var naming/sanitization issues for colKey values that may contain special characters.

**Recommendation:** Use direct px values in grid-template-columns (simpler, avoids key sanitization). Rebuild the string on each pointermove event — CSS Grid reflow from changing `grid-template-columns` on a 50-column grid is well within the 16ms budget.

### Pattern 4: Auto-Fit Content Measurement

**What:** On `dblclick` of the resize handle, measure all cells in that column plus the header and fit to the widest.

**When to use:** SIZE-02 auto-fit.

**Example:**
```typescript
handle.addEventListener('dblclick', (e: MouseEvent) => {
  e.stopPropagation(); // don't trigger collapse click on parent header
  const zoomLevel = this._getZoomLevel();
  let maxContentWidth = 0;

  // Measure header text
  const headerLabel = headerEl.querySelector('.col-header-label');
  if (headerLabel) {
    maxContentWidth = Math.max(maxContentWidth, headerLabel.scrollWidth);
  }

  // Measure all data cells in this column
  const cells = this._gridEl?.querySelectorAll(`.data-cell[data-col-key="${CSS.escape(colKey)}"]`);
  if (cells) {
    for (const cell of cells) {
      maxContentWidth = Math.max(maxContentWidth, (cell as HTMLElement).scrollWidth);
    }
  }

  const AUTO_FIT_PADDING = 24; // breathing room
  const AUTO_FIT_MAX = 400;    // prevent runaway auto-fit
  const fittedWidth = Math.min(AUTO_FIT_MAX, Math.max(MIN_COL_WIDTH, maxContentWidth + AUTO_FIT_PADDING));
  const baseWidth = fittedWidth / zoomLevel;

  this._colWidths.set(colKey, baseWidth);
  this._applyWidthsToDOM();
  if (this._onWidthsChange) this._onWidthsChange(new Map(this._colWidths));
});
```

Note: `scrollWidth` reads the content width regardless of visible width. This is the correct property for measuring content overflow, not `getBoundingClientRect().width`.

### Pattern 5: PAFVState Extension for Persistence

**What:** Add `colWidths?: Record<string, number>` to the `PAFVState` interface and update the serialization/deserialization path.

**When to use:** SIZE-04.

**Example:**
```typescript
// PAFVProvider.ts — updated PAFVState interface
interface PAFVState {
  viewType: ViewType;
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
  colWidths?: Record<string, number>; // NEW — base pixel widths per colKey
}

// In setColAxes / setRowAxes / setViewType:
// Reset colWidths when axes change (different columns = old widths meaningless)
this._state.colWidths = {};

// In setState() restoration (backward compat):
this._state = {
  ...restored,
  colAxes: Array.isArray(restored.colAxes) ? [...restored.colAxes] : [],
  rowAxes: Array.isArray(restored.rowAxes) ? [...restored.rowAxes] : [],
  colWidths: (typeof restored.colWidths === 'object' && restored.colWidths !== null && !Array.isArray(restored.colWidths))
    ? { ...restored.colWidths as Record<string, number> }
    : {},
};

// New accessor for SuperGrid to read/write widths:
getColWidths(): Record<string, number> {
  return { ...(this._state.colWidths ?? {}) };
}
setColWidths(widths: Record<string, number>): void {
  this._state.colWidths = { ...widths };
  // Do NOT call _scheduleNotify — width changes don't require a re-query
}
```

### Anti-Patterns to Avoid

- **Anti-pattern: Listening to mousemove on document.** `setPointerCapture` makes this unnecessary and avoids forgotten `removeEventListener` teardown paths.
- **Anti-pattern: Reading `getBoundingClientRect()` on every pointermove.** Read the start position once on `pointerdown`; compute new width from `deltaX`. `getBoundingClientRect` on every event is layout thrash.
- **Anti-pattern: Triggering `_fetchAndRender()` or bridge.superGridQuery() on resize.** Column width changes are pure CSS — no data re-query needed. The CONTEXT.md constraint "resize should NOT trigger re-query, only re-render column widths" must be respected.
- **Anti-pattern: Storing zoom-scaled widths.** Store base px widths (at zoom=1). Multiply by zoomLevel at render time. This ensures resize during zoom produces correct restoration.
- **Anti-pattern: Adding resize handles to parent/spanning headers.** CONTEXT.md locks this: only leaf-level column headers get handles.
- **Anti-pattern: Conflict with collapse click handler.** The collapse click fires on the entire `col-header` element. The resize handle must `e.stopPropagation()` on both `pointerdown` and `dblclick` to prevent triggering collapse.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer capture for drag tracking | Custom document-level mousemove + teardown | `setPointerCapture()` on the handle | Browser-native, works for mouse/touch/pen, automatically released on pointerup |
| CSS-based text measurement | Canvas measureText or custom font metrics | `element.scrollWidth` | Measures rendered content size including CSS; no font metric calculations needed |
| Live CSS update batching | Custom RAF queue for style changes | Direct `gridEl.style.gridTemplateColumns = ...` | CSS recalc during drag is fast enough for 50 columns; pre-optimization adds complexity |

**Key insight:** The Pointer Events API is a complete solution. The complexity in this phase is architectural (integrating per-column widths into `buildGridTemplateColumns` and PAFVProvider persistence), not interaction-API complexity.

---

## Common Pitfalls

### Pitfall 1: Handle Hit-Zone vs. Header Click Conflict

**What goes wrong:** The 8px resize handle overlaps the right edge of the header cell. If the handle is a child of the header, `pointerdown` on the handle propagates to the header's `click` listener (collapse toggle), causing unintended collapse during resize.

**Why it happens:** DOM event propagation. `click` fires after `pointerup` if the pointer hasn't moved; even a small resize drag can trigger `click` if `e.preventDefault()` is not called.

**How to avoid:** Call `e.stopPropagation()` in the handle's `pointerdown` handler. Also call `e.stopPropagation()` in the handle's `dblclick` handler. Set `pointer-events: none` on the label span inside the header to prevent accidental text-drag interference.

**Warning signs:** Columns collapsing immediately when the user starts a resize drag.

### Pitfall 2: Resize Handle Conflicts with Axis DnD Grip

**What goes wrong:** The header cell already contains an `axis-grip` span that initiates HTML5 DnD. If the resize handle's pointerdown fires before the dragstart event processes, pointer capture may interfere.

**Why it happens:** HTML5 DnD dragstart and Pointer Events coexist but can interfere. `setPointerCapture` during a DnD drag suppresses the browser's DnD feedback.

**How to avoid:** The resize handle is positioned on the right edge of the header cell, while the axis-grip is on the left edge. By construction they don't overlap. Confirm the handle `z-index` and `pointer-events` are set so only the handle responds to pointer events in its zone — not the grip.

**Warning signs:** Axis drag-and-drop stops working after resize handles are added.

### Pitfall 3: colKey Stability Across Re-Renders

**What goes wrong:** The `colWidths` map keys on `colKey` (e.g., the leaf header value — "note", "task"). If the query returns a different sort order or new values, the key may persist but point to a different column.

**Why it happens:** The axis reset-on-change decision guards against this for axis changes, but not for data changes within the same axis.

**How to avoid:** The CONTEXT.md decision covers this: "Column widths reset to defaults when axes change." The `colKey` is the axis field's distinct value (e.g., "note", "task" for `card_type`) — these are stable data values, not computed indices. Stale keys are silently ignored on restore (no entry = default width).

**Warning signs:** A column that was resized starts getting the wrong width after re-query.

### Pitfall 4: Double-Click on Handle Fires Collapse on Header

**What goes wrong:** `dblclick` event fires on the handle, and if `stopPropagation` is not called, also fires on the parent header cell. The header cell's collapse handler uses `click`, and `dblclick` includes two `click` events — so collapse toggles twice (net: no change) but the auto-fit is still disrupted.

**Why it happens:** `dblclick` on a child propagates `click × 2` + `dblclick` to ancestors.

**How to avoid:** Call `e.stopPropagation()` on the `dblclick` handler. Additionally, the collapse click handler should check `e.target` — if the event originated from the resize handle, ignore it.

**Warning signs:** Auto-fit appears to work but the column collapses/uncollapses as a side effect.

### Pitfall 5: SuperZoom applyZoom() Overwriting Per-Column Widths

**What goes wrong:** `SuperZoom.applyZoom()` currently sets `--sg-col-width` on `gridEl`. After Phase 20, `buildGridTemplateColumns` will use per-column literal px values instead of `var(--sg-col-width)`. If `applyZoom()` still sets `--sg-col-width` and the grid-template-columns still references it, the zoom and resize systems fight.

**Why it happens:** The current `applyZoom()` sets a single global CSS var. Phase 20 moves to per-column values. If the grid-template-columns string stops referencing `--sg-col-width`, the var set by `applyZoom()` becomes a no-op for column width — but the grid-template-columns string must be REBUILT when zoom changes.

**How to avoid:** When zoom changes, `SuperZoom` must trigger `SuperGridSizer` to re-apply all column widths (multiply base values × new zoomLevel and update `grid-template-columns`). The callback pattern used by `SuperZoom` for the zoom toast can be extended: `onZoomChange` already fires in `SuperGrid` — SuperGrid can call `_sizer.applyWidths(zoomLevel)` there.

**Warning signs:** Resized columns reset to `--sg-col-width` width after any zoom event.

### Pitfall 6: Shift+Drag Base Width Calculation

**What goes wrong:** User resizes a column while at 2x zoom. Shift+drag should set all columns to the same base width. If the dragged `startWidth` is the already-zoomed pixel width (not the base), dividing by zoom to get base will double-divide.

**Why it happens:** Confusion between display width (base × zoom) and stored width (base).

**How to avoid:** The `colWidths` map always stores base widths. On `pointerdown`, read `startWidth` from `colWidths.get(colKey) ?? BASE_COL_WIDTH` — this is already the base value. On `pointermove`, `newBaseWidth = startWidth + dx / zoomLevel`. Apply to all columns as base values. Display as `newBaseWidth * zoomLevel` px.

**Warning signs:** Columns jump to unexpected widths after Shift+drag.

---

## Code Examples

### 8px Resize Handle Creation (appended to leaf header cell)

```typescript
// In SuperGridSizer.addHandleToLeafHeader() or in SuperGrid._createColHeaderCell():
function createResizeHandle(colKey: string): HTMLDivElement {
  const handle = document.createElement('div');
  handle.className = 'col-resize-handle';
  handle.dataset['colKey'] = colKey;
  // Positioned at right edge of the header cell
  handle.style.position = 'absolute';
  handle.style.top = '0';
  handle.style.right = '0';
  handle.style.width = '8px';
  handle.style.height = '100%';
  handle.style.cursor = 'col-resize';
  handle.style.zIndex = '4'; // above sticky header z-index 2
  handle.style.userSelect = 'none';
  // Only show col-resize cursor on hover; hide handle visually but keep hit zone
  handle.style.backgroundColor = 'transparent';
  return handle;
}

// Header cell must have position:relative for the absolute handle to work
headerEl.style.position = 'relative'; // Add this if not already set
```

Note: `SuperGrid._createColHeaderCell` already sets `position: sticky` — this is fine; `position: relative` on a sticky element is a known combination that works. The handle needs to be `position: absolute` within the sticky cell.

Actually — `position: sticky` on the header already establishes a containing block for absolute children. The handle's `position: absolute; right: 0` will be relative to the sticky header cell's layout position. This works correctly.

### Pointer Events Wiring

```typescript
handle.addEventListener('pointerdown', (e: PointerEvent) => {
  if (e.button !== 0) return;
  e.preventDefault();       // prevent text selection
  e.stopPropagation();      // prevent header collapse click
  handle.setPointerCapture(e.pointerId);

  const baseWidth = this._colWidths.get(colKey) ?? BASE_COL_WIDTH;
  this._dragging = { colKey, startX: e.clientX, startWidth: baseWidth };
});

handle.addEventListener('pointermove', (e: PointerEvent) => {
  if (!this._dragging) return;
  const zoomLevel = this._positionProvider.zoomLevel;
  const dx = e.clientX - this._dragging.startX;
  const newBase = Math.max(MIN_COL_WIDTH, this._dragging.startWidth + dx / zoomLevel);

  if (e.shiftKey) {
    // Normalize ALL columns to this width
    const allKeys = [...this._colWidths.keys()];
    for (const key of allKeys) {
      this._colWidths.set(key, newBase);
    }
  } else {
    this._colWidths.set(this._dragging.colKey, newBase);
  }

  this._rebuildGridTemplateColumns();
  // Do NOT call _fetchAndRender — width is CSS-only
});

handle.addEventListener('pointerup', (e: PointerEvent) => {
  if (!this._dragging) return;
  handle.releasePointerCapture(e.pointerId);
  this._dragging = null;
  // Persist: notify PAFVProvider of new widths (SIZE-04)
  if (this._onWidthsChange) {
    this._onWidthsChange(new Map(this._colWidths));
  }
});
```

### buildGridTemplateColumns Updated Signature

```typescript
// SuperStackHeader.ts — updated to accept per-column widths
export function buildGridTemplateColumns(
  leafColKeys: string[],        // ordered leaf column keys (colKey values)
  colWidths: Map<string, number>, // base widths per colKey
  zoomLevel: number,
  rowHeaderWidth = 160
): string {
  if (leafColKeys.length === 0) return `${rowHeaderWidth}px`;
  const colDefs = leafColKeys.map(key => {
    const baseWidth = colWidths.get(key) ?? BASE_COL_WIDTH;
    return `${Math.round(baseWidth * zoomLevel)}px`;
  });
  return `${rowHeaderWidth}px ${colDefs.join(' ')}`;
}
```

This requires callers to pass `leafColKeys` (ordered array of colKey values) + `colWidths` map + `zoomLevel`. SuperGrid already has all three.

The old `buildGridTemplateColumns(colLeafCount, rowHeaderWidth)` signature must be updated everywhere it is called. Check: `SuperGrid._renderCells()` is the only caller.

### PAFVProvider: New Accessors for Widths

```typescript
// Add to PAFVProvider (no subscriber notification — width changes don't trigger re-query)
getColWidths(): Record<string, number> {
  return { ...(this._state.colWidths ?? {}) };
}

setColWidths(widths: Record<string, number>): void {
  this._state.colWidths = { ...widths };
  // Width changes are persisted at next checkpoint — no notification needed
  // The persistence write is triggered by the caller (SuperGridSizer via SuperGrid)
}
```

The `setColWidths` method should NOT call `_scheduleNotify()`. Width updates are CSS-only and do not require a Worker re-query. This is consistent with `SuperPositionProvider` (which also does not notify StateCoordinator).

However, widths DO need to be persisted. The existing Tier 2 persistence path (StateManager calling `toJSON()` at checkpoint intervals) will naturally include `colWidths` because `toJSON()` serializes all of `_state`. No additional persistence wiring needed — the data rides the existing checkpoint.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MouseEvent + document mousemove | Pointer Events + setPointerCapture | ~2020 (wide browser support) | Cleaner drag teardown, works for touch and pen |
| `mouseenter`/`mouseleave` for cursor change | CSS `cursor: col-resize` on `:hover` via class | Standard CSS | No JS event listeners for hover cursor |

**Deprecated/outdated:**
- `document.addEventListener('mousemove')` for drag tracking: replaced by Pointer Events + setPointerCapture

---

## Implementation Notes for Planning

### New Files
- `src/views/supergrid/SuperGridSizer.ts` — Pointer Events drag handler; encapsulates resize logic

### Modified Files
- `src/views/supergrid/SuperStackHeader.ts` — Update `buildGridTemplateColumns` signature to accept `leafColKeys: string[]`, `colWidths: Map<string, number>`, `zoomLevel: number`
- `src/views/SuperGrid.ts` — Wire `SuperGridSizer`; update `_renderCells()` to pass leaf col keys + widths; update zoom change callback to reapply widths; extend constructor/destroy lifecycle
- `src/providers/PAFVProvider.ts` — Extend `PAFVState` with `colWidths?`, add `getColWidths()`/`setColWidths()`, reset widths on axis change, update `isPAFVState()` type guard
- `src/views/types.ts` — Extend `SuperGridProviderLike` with `getColWidths()`/`setColWidths()` methods

### Plan Structure Alignment
The proposed plans map well to the architecture:

- **Plan 20-01: SuperGridSizer.ts** — new file; Pointer Events pointerdown/pointermove/pointerup; `setPointerCapture`; 8px handle elements on leaf headers; live `grid-template-columns` update; requires `buildGridTemplateColumns` signature update
- **Plan 20-02: CSS Custom Property updates + auto-fit** — `dblclick` handler; `scrollWidth` measurement; auto-fit padding/cap decisions; integrate into `SuperGridSizer`
- **Plan 20-03: Shift+drag bulk resize + PAFVProvider persistence** — `e.shiftKey` in pointermove; `PAFVState` extension; `setColWidths`/`getColWidths`; axis-change width reset; `isPAFVState` guard update; backward-compat in `setState`

### Claude's Discretion Recommendations

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Minimum column width | 48px | Wide enough for 2-3 character labels at default zoom; consistent with common spreadsheet minimums |
| Maximum column width | No hard cap | Grid scrolls horizontally; a very wide column is a user choice, not an error |
| Auto-fit padding | 24px (12px each side) | Matches `padding: 4px 8px` × 1.5; provides visual breathing room |
| Auto-fit maximum cap | 400px base | Prevents runaway auto-fit on long text content that the user probably wants to truncate |
| Width storage formula | `base = displayPx / zoomLevel` on drag end; store base | Consistent with how zoom stores base values |
| Reset gesture | No gesture in this phase | Stale widths clear on axis change; explicit reset is deferred per scope |
| Storage location | Extend PAFVState in PAFVProvider | Follows established pattern; `colAxes`/`rowAxes` precedent; avoids new provider |

---

## Open Questions

1. **`buildGridTemplateColumns` signature change breaks existing tests**
   - What we know: `SuperStackHeader.test.ts` tests `buildGridTemplateColumns(leafCount, rowHeaderWidth)` with the current 2-arg signature.
   - What's unclear: How many test call sites need updating.
   - Recommendation: Update the function signature and fix all test callsites in Plan 20-01. Keep backward compatibility by providing default values (`colWidths = new Map()`, `zoomLevel = 1`) so old calls still work during transition.

2. **Shift+drag initial colWidths population**
   - What we know: On first resize, the `colWidths` map may be empty (all columns at default width). Shift+drag should normalize all visible columns.
   - What's unclear: Does "all columns" mean only the columns currently visible (in `leafColCells`), or any column that has ever been rendered?
   - Recommendation: Normalize only the **currently visible** leaf columns (from `_lastColAxes`). Populate missing keys from `BASE_COL_WIDTH` before applying the new uniform width.

3. **`pointercancel` handling**
   - What we know: `pointercancel` can fire when the browser takes over pointer handling (e.g., scroll gesture on touch).
   - What's unclear: Whether to persist width on cancel or revert to pre-drag width.
   - Recommendation: On `pointercancel`, revert to `startWidth` (don't persist a partial drag). Same cleanup as `pointerup` but without calling `_onWidthsChange`.

---

## Sources

### Primary (HIGH confidence)
- MDN Web Docs — Pointer Events API: `setPointerCapture`, `pointerdown`/`pointermove`/`pointerup`/`pointercancel` (https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture)
- Existing codebase: `SuperZoom.ts`, `SuperGrid.ts`, `SuperStackHeader.ts`, `PAFVProvider.ts`, `SuperPositionProvider.ts` — direct source inspection
- MDN Web Docs — `HTMLElement.scrollWidth` (https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth)

### Secondary (MEDIUM confidence)
- Phase 19 CONTEXT.md + STATE.md decisions — established CSS Custom Property zoom pattern and SuperZoom lifecycle precedent
- Phase 18 CONTEXT.md — established module-level singleton and drop zone lifecycle patterns

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Pointer Events API is native, fully supported, used in every major browser; no external library needed
- Architecture: HIGH — Based on direct codebase inspection of SuperZoom, SuperGrid, PAFVProvider; patterns are clearly established
- Pitfalls: HIGH — Derived from reading actual event handler code and CSS property usage in the existing codebase

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable browser APIs, stable codebase patterns)
