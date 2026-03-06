# Phase 31: Drag Reorder - Research

**Researched:** 2026-03-06
**Domain:** HTML5 Drag & Drop UX, FLIP animation, CSS Grid, Tier 2 persistence
**Confidence:** HIGH

## Summary

Phase 31 adds the visual UX layer to existing backend reorder/transpose logic. The DYNM-03 same-dimension reorder already works (5 tests pass) using a test-only `dataset['reorderTargetIndex']` on the drop zone. Cross-dimension transpose (DYNM-01/DYNM-02) also works but always appends to end. This phase replaces the test-only target-index mechanism with production midpoint calculation during dragover, adds insertion line visual feedback, dims the source header, animates headers and data cells via FLIP after drop, and validates Tier 2 persistence round-trips for reordered axis order and collapse state.

A critical discovery: **`setColAxes()` and `setRowAxes()` in PAFVProvider currently reset `collapseState`, `colWidths`, and `sortOverrides` to empty on every call.** The CONTEXT.md decision requires collapse state to be preserved and remapped during reorder. This means new reorder-specific methods (or internal variants) are needed in PAFVProvider that atomically reorder axes + remap collapse keys without the destructive resets.

**Primary recommendation:** Add `reorderColAxes(fromIndex, toIndex)` and `reorderRowAxes(fromIndex, toIndex)` methods to PAFVProvider that splice the axes array, remap collapse keys atomically, and preserve colWidths/sortOverrides. Wire the SuperGrid drop handler to call these instead of the existing `setColAxes`/`setRowAxes` for same-dimension reorder. Keep the existing `setColAxes`/`setRowAxes` with reset behavior for cross-dimension transpose (where collapse keys become genuinely stale). Use FLIP with Web Animations API for cell position transitions (200ms), and CSS transitions for header position changes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Insertion line indicator (vertical for col reorder, horizontal for row reorder) at target position between headers
- Insertion line uses the existing SuperGrid accent color
- Insertion line spans header area only (not full grid height)
- Browser default drag ghost (no custom setDragImage)
- Midpoint threshold calculation: during dragover, compare pointer X/Y to header cell midpoints to determine target index
- Source header dims to opacity 0.3 during drag (stays in place, does not hide)
- Escape to cancel drag (ensure HTML5 DnD default cancel behavior works; add explicit cleanup if needed)
- Keep existing `.drag-over` drop zone background highlight AND add the new insertion line (layered feedback)
- Cross-dimension transpose always appends to end of target dimension (current behavior preserved)
- Min 1 axis per dimension enforced (current DYNM-01/DYNM-02 guard preserved)
- Collapse state preserved across axis moves (same-dimension reorder and cross-dimension transpose)
- Collapse keys remapped on reorder: when an axis moves from level N to level M, all collapse keys referencing that axis have their level indices updated to reflect new positions
- CSS transitions on header cells, 200ms duration, for position changes after reorder/transpose
- FLIP technique for data cells: snapshot old cell positions before drop, re-query + re-render at new positions, animate each cell from old to new position using CSS transform
- Both headers and data cells animate (not headers-only)
- Unit tests: toJSON()/fromJSON() round-trip for axis order AND collapse state after reorder
- Integration test: reorder -> serialize -> new provider instance -> verify state matches
- Backward-compatibility tests: pre-Phase-31 serialized state (no reorder metadata) deserializes correctly
- Dedicated collapse key remap test: reorder axes -> verify keys remapped -> serialize -> deserialize -> verify remapped keys survive
- Rapid-sequence edge case tests: reorder A->B, then B->C, serialize -> verify correct final state and idempotent collapse key remapping

### Claude's Discretion
- Exact CSS transition easing function (ease-out, ease-in-out, etc.)
- FLIP animation implementation details (requestAnimationFrame scheduling, transform vs top/left)
- How to handle FLIP when cells are added/removed during re-query (new groups appearing, empty groups disappearing)
- Insertion line thickness and exact positioning (e.g., 2px absolute-positioned pseudo-element vs dedicated DOM element)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Type-safe implementation | Project standard |
| Vitest | 4.0 | Test framework | Project standard |
| D3.js | 7.9 | Data joins, transitions | Project standard (but NOT used for FLIP -- native WAAPI preferred) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Animations API | native | FLIP cell animations | Built into all modern browsers; cleaner than rAF+CSS transitions for multi-element FLIP |
| CSS Transitions | native | Header position animation (200ms) | For the simpler header cell position changes post-reorder |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WAAPI for FLIP | D3 transitions | D3 transitions work on SVG selections; SuperGrid uses DOM elements with CSS Grid -- WAAPI maps better |
| WAAPI for FLIP | animate-css-grid | 3rd party dep; project philosophy is "boring stack wins, no unnecessary deps" |
| WAAPI for FLIP | GSAP Flip plugin | Heavy 3rd party dep; not justified for this scope |

**No new installations required.** All techniques use native browser APIs.

## Architecture Patterns

### Critical: PAFVProvider Collapse State Reset Problem

**Current behavior (lines 188-217 of PAFVProvider.ts):**
```typescript
setColAxes(axes: AxisMapping[]): void {
    this._validateStackedAxes(axes);
    this._state.colAxes = [...axes];
    this._state.colWidths = {};          // RESET
    this._state.sortOverrides = [];      // RESET
    this._state.collapseState = [];      // RESET <-- PROBLEM FOR REORDER
    this._scheduleNotify();
}
```

The CONTEXT.md locks the decision: "Collapse state preserved across axis moves." But calling `setColAxes`/`setRowAxes` (which is what `_wireDropZone` does today) wipes collapse state. The `_fetchAndRender` restore path (`if (this._collapsedSet.size === 0)`) then finds nothing to restore.

**Solution: New reorder-specific methods in PAFVProvider.**

### Recommended Architecture

```
PAFVProvider
├── setColAxes(axes)         // Existing — resets collapse/widths/sorts (for transpose, axis add/remove)
├── setRowAxes(axes)         // Existing — resets collapse/widths/sorts (for transpose, axis add/remove)
├── reorderColAxes(from, to) // NEW — splice + remap collapse keys + preserve widths/sorts
├── reorderRowAxes(from, to) // NEW — splice + remap collapse keys + preserve widths/sorts
└── setCollapseState(state)  // Existing — stores remapped state

SuperGrid._wireDropZone()
├── Same-dimension drop → calls reorderColAxes/reorderRowAxes (NEW)
└── Cross-dimension drop → calls setColAxes/setRowAxes (EXISTING — reset is correct here)

SuperGrid._fetchAndRender()  // FLIP wrapping
├── BEFORE: snapshot all .col-header, .row-header, .data-cell getBoundingClientRect()
├── DURING: re-query + _renderCells() (DOM is rebuilt)
├── AFTER: snapshot new positions, compute deltas, animate with WAAPI
```

### Pattern 1: Midpoint Threshold for Target Index Calculation

**What:** During dragover, calculate which gap between header cells the pointer is closest to.
**When to use:** Every dragover event on the drop zone (throttled or not -- events fire rapidly).

```typescript
// Source: SortableJS wiki + project-specific adaptation for CSS Grid headers
private _calcReorderTargetIndex(
  e: DragEvent,
  dimension: 'col' | 'row',
  headerCells: HTMLElement[]
): number {
  const pointerPos = dimension === 'col' ? e.clientX : e.clientY;

  for (let i = 0; i < headerCells.length; i++) {
    const rect = headerCells[i].getBoundingClientRect();
    const midpoint = dimension === 'col'
      ? rect.left + rect.width / 2
      : rect.top + rect.height / 2;

    if (pointerPos < midpoint) return i;
  }
  return headerCells.length - 1; // past last element
}
```

### Pattern 2: Collapse Key Remapping

**What:** When axes at indices [A, B, C] become [B, C, A] (A moves from 0 to 2), all collapse keys with `level=0` become `level=2`, `level=1` becomes `level=0`, `level=2` becomes `level=1`.
**When to use:** Atomically during reorderColAxes/reorderRowAxes.

Collapse key format: `level\x1fparentPath\x1fvalue`

The level index in the key directly corresponds to the axis level position. When axes are reordered, the mapping from level index to axis field changes, so all existing collapse keys must have their level indices updated.

```typescript
// Conceptual algorithm for collapse key remapping
function remapCollapseKeys(
  oldState: Array<{ key: string; mode: 'aggregate' | 'hide' }>,
  fromIndex: number,
  toIndex: number,
  axisCount: number
): Array<{ key: string; mode: 'aggregate' | 'hide' }> {
  // Build index mapping: old level -> new level
  const indexMap = new Map<number, number>();
  // After splice(fromIndex, 1) + splice(toIndex, 0, moved):
  const indices = Array.from({ length: axisCount }, (_, i) => i);
  const [moved] = indices.splice(fromIndex, 1);
  indices.splice(toIndex, 0, moved!);
  // indices now has the new order: indices[newIdx] = oldIdx
  // We need: oldIdx -> newIdx
  for (let newIdx = 0; newIdx < indices.length; newIdx++) {
    indexMap.set(indices[newIdx]!, newIdx);
  }

  return oldState.map(({ key, mode }) => {
    const sep = '\x1f';
    const parts = key.split(sep);
    const oldLevel = parseInt(parts[0]!, 10);
    const newLevel = indexMap.get(oldLevel);
    if (newLevel !== undefined && newLevel !== oldLevel) {
      parts[0] = String(newLevel);
      // parentPath also needs updating since it encodes ancestor values
      // at levels 0..(level-1) — those ancestors may have shifted too
      // This requires rebuilding the parentPath from the new axis order
    }
    return { key: parts.join(sep), mode };
  });
}
```

**Complexity note:** The parentPath component of collapse keys encodes ancestor values joined by `\x1f`. When axis levels shift, the parentPath semantics change because different axes now occupy different levels. A full remap must:
1. Parse the level from the key
2. Map old level to new level
3. Rebuild parentPath from the axis values at the new ancestor levels

For within-dimension reorder of 2-3 axes, the most pragmatic approach is to **clear and rebuild** the collapse keys from the known collapsed header values rather than attempting a surgical remap of the encoded paths. This is simpler and more correct.

### Pattern 3: FLIP Animation for Data Cells

**What:** Snapshot cell positions before reorder, let DOM rebuild, animate cells from old to new position.
**When to use:** After every same-dimension reorder drop and cross-dimension transpose drop.

```typescript
// Source: Paul Lewis's FLIP technique + CSS-Tricks article
// Using Web Animations API (WAAPI) for multi-element animation

// FIRST: Snapshot all data cells before DOM change
const oldPositions = new Map<string, DOMRect>();
grid.querySelectorAll('.data-cell').forEach(cell => {
  const key = (cell as HTMLElement).dataset['cellKey'] ?? '';
  oldPositions.set(key, cell.getBoundingClientRect());
});

// LAST: After _renderCells() rebuilds DOM with new axes
// (StateCoordinator fires _fetchAndRender which calls _renderCells)

// INVERT + PLAY: For each new cell, find old position and animate
grid.querySelectorAll('.data-cell').forEach(cell => {
  const key = (cell as HTMLElement).dataset['cellKey'] ?? '';
  const oldRect = oldPositions.get(key);
  if (!oldRect) return; // new cell, no animation (fade in instead)

  const newRect = cell.getBoundingClientRect();
  const deltaX = oldRect.left - newRect.left;
  const deltaY = oldRect.top - newRect.top;

  if (deltaX === 0 && deltaY === 0) return; // no movement

  cell.animate([
    { transform: `translate(${deltaX}px, ${deltaY}px)` },
    { transform: 'none' }
  ], {
    duration: 200,
    easing: 'ease-out',
    fill: 'both'
  });
});
```

### Pattern 4: Source Header Dimming

**What:** When a grip starts dragging, dim the source header to opacity 0.3.
**When to use:** On dragstart, restore on dragend.

```typescript
grip.addEventListener('dragstart', (e: DragEvent) => {
  _dragPayload = { field, sourceDimension, sourceIndex };
  e.dataTransfer?.setData('text/x-supergrid-axis', '1');
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';

  // Dim the source header (the parent header cell, not the grip)
  const headerCell = grip.closest('.col-header, .row-header') as HTMLElement;
  if (headerCell) headerCell.style.opacity = '0.3';

  e.stopPropagation();
});

// dragend fires on the grip element regardless of drop success/cancel
grip.addEventListener('dragend', () => {
  const headerCell = grip.closest('.col-header, .row-header') as HTMLElement;
  if (headerCell) headerCell.style.opacity = '';
  // Also clean up insertion line
  removeInsertionLine();
});
```

### Anti-Patterns to Avoid

- **Reusing setColAxes/setRowAxes for reorder:** These reset collapse state, colWidths, and sortOverrides. Same-dimension reorder must preserve all three.
- **Surgical collapse key path remapping:** The parentPath encoding makes surgical string manipulation error-prone. Prefer a clear-and-rebuild approach using the known collapsed values.
- **Using D3 transitions for FLIP:** SuperGrid data cells are plain DOM elements in CSS Grid, not SVG. WAAPI is the correct tool here.
- **Throttling dragover for insertion line:** Insertion line position must update on every dragover event for smooth feedback. The midpoint calculation is O(n) on header count (max ~50 per cardinality guard) and runs in microseconds.
- **Calling _fetchAndRender inside the drop handler:** The StateCoordinator subscription already does this automatically when provider state changes. Do not double-fire.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-element animation | Manual rAF loop with CSS transforms | Web Animations API (`element.animate()`) | WAAPI handles timing, cancellation, fill modes natively |
| Drag ghost image | Custom drag preview canvas | Browser default drag ghost | CONTEXT.md locked decision: "Browser default drag ghost" |
| Sortable list library | Full sortable framework | Midpoint calculation in dragover handler | Only 2-3 headers to reorder; full library is overkill |

**Key insight:** This phase adds visual polish to already-working backend logic. The complexity is in the visual feedback (insertion line, dimming, FLIP animation) and the collapse key preservation -- not in the reorder algorithm itself.

## Common Pitfalls

### Pitfall 1: setColAxes/setRowAxes Resets Collapse State
**What goes wrong:** Calling `setColAxes(newAxes)` after a same-dimension reorder wipes `collapseState`, `colWidths`, and `sortOverrides` to empty. The user's collapsed headers and custom column widths vanish.
**Why it happens:** setColAxes was designed for axis *changes* (add/remove axes), where old state is genuinely stale. Reorder keeps the same axes in a different order.
**How to avoid:** Create `reorderColAxes(from, to)` and `reorderRowAxes(from, to)` that splice without resetting. Wire drop handler to use these for same-dimension drops.
**Warning signs:** Tests pass for reorder but collapse state is lost; user reports headers unexpanding after drag.

### Pitfall 2: FLIP Snapshot Timing with Async _fetchAndRender
**What goes wrong:** The FLIP "First" snapshot must happen *before* DOM changes. But `_fetchAndRender` is async (awaits bridge.superGridQuery). If you snapshot before the provider mutation and the async query takes time, scroll position may change, invalidating the snapshot.
**Why it happens:** `_fetchAndRender` is triggered asynchronously by StateCoordinator subscription after provider mutation.
**How to avoid:** Snapshot positions synchronously in the drop handler *before* calling reorderColAxes/reorderRowAxes. Store the snapshot in a transient instance variable. In `_renderCells`, after DOM rebuild, read the snapshot and animate.
**Warning signs:** Cells animate from wrong positions; FLIP looks "jumpy" on slow queries.

### Pitfall 3: Insertion Line Position in Scrollable Grid
**What goes wrong:** The insertion line position is calculated from `getBoundingClientRect()` (viewport-relative) but the grid container scrolls. If the user has scrolled, the line appears at the wrong position.
**Why it happens:** Insertion line is absolutely positioned within the grid. Viewport coordinates must be converted to container-relative coordinates.
**How to avoid:** Use `container.getBoundingClientRect()` to compute the offset, then subtract container's viewport position from the pointer position. Or use a CSS pseudo-element approach anchored to the header cell's grid position.
**Warning signs:** Insertion line appears offset when scrolled horizontally or vertically.

### Pitfall 4: dragend vs drop Event Ordering
**What goes wrong:** Cleanup code (removing insertion line, restoring opacity) runs in dragend. But dragend fires *after* drop. If drop triggers a re-render that destroys the DOM, dragend's `closest('.col-header')` returns null.
**Why it happens:** HTML5 DnD event order is: drop fires on target, then dragend fires on source.
**How to avoid:** In the dragend handler, don't rely on DOM structure. Use the module-level `_dragPayload` (or a separate flag) to track the source element reference captured at dragstart. Also handle cleanup in the re-render path (insertion line removed when grid is cleared).
**Warning signs:** Stale insertion line visible after drop; header stays dimmed at 0.3 opacity.

### Pitfall 5: Collapse Key Level Index Encoding
**What goes wrong:** Collapse keys encode the axis *level index* (e.g., `0\x1fparentPath\x1fvalue`). After reorder, level indices change but keys still reference old indices.
**Why it happens:** The key format `level\x1fparentPath\x1fvalue` uses positional level indices, not field names.
**How to avoid:** Remap or rebuild keys atomically with the axis reorder. The `reorderColAxes` method must update collapse keys before notifying subscribers.
**Warning signs:** Collapse toggles affect wrong axis level after reorder; collapse state survives reorder but collapses/expands the wrong groups.

### Pitfall 6: Cells Appearing/Disappearing During FLIP
**What goes wrong:** After reorder, the re-query may return different cell groups (e.g., a collapsed group's aggregate cell disappears if the collapse key was stale). New cells have no "old" position for FLIP.
**Why it happens:** Reorder changes the GROUP BY semantics. Different axis orders can produce different cell intersections.
**How to avoid:** For cells with no old position (newly appearing), skip FLIP and just show them immediately (or fade in). For cells that disappeared, don't animate -- they're already gone from the DOM.
**Warning signs:** Cells appear at position (0,0) and animate from there; error accessing missing keys in the position snapshot map.

## Code Examples

### Example 1: Insertion Line DOM Element

```typescript
// Recommendation: Dedicated DOM element (not pseudo-element) for programmatic positioning
private _insertionLine: HTMLElement | null = null;

private _showInsertionLine(
  container: HTMLElement,
  position: number, // CSS pixel position (left for col, top for row)
  dimension: 'col' | 'row'
): void {
  if (!this._insertionLine) {
    this._insertionLine = document.createElement('div');
    this._insertionLine.className = 'reorder-insertion-line';
    this._insertionLine.style.position = 'absolute';
    this._insertionLine.style.zIndex = '15'; // above headers (z:2-3) and drop zones (z:10)
    this._insertionLine.style.pointerEvents = 'none';
    this._insertionLine.style.backgroundColor = 'var(--accent, #4a9eff)';
    container.appendChild(this._insertionLine);
  }

  if (dimension === 'col') {
    // Vertical line spanning header area
    const headerHeight = this._getHeaderAreaHeight();
    this._insertionLine.style.width = '2px';
    this._insertionLine.style.height = `${headerHeight}px`;
    this._insertionLine.style.left = `${position}px`;
    this._insertionLine.style.top = '0';
  } else {
    // Horizontal line spanning row header area
    const headerWidth = this._getRowHeaderAreaWidth();
    this._insertionLine.style.height = '2px';
    this._insertionLine.style.width = `${headerWidth}px`;
    this._insertionLine.style.top = `${position}px`;
    this._insertionLine.style.left = '0';
  }
}
```

### Example 2: PAFVProvider.reorderColAxes

```typescript
// New method — preserves colWidths, sortOverrides, and remaps collapseState
reorderColAxes(fromIndex: number, toIndex: number): void {
  const axes = [...this._state.colAxes];
  if (fromIndex === toIndex) return;
  if (fromIndex < 0 || fromIndex >= axes.length) return;
  if (toIndex < 0 || toIndex >= axes.length) return;

  const [moved] = axes.splice(fromIndex, 1);
  if (!moved) return;
  axes.splice(toIndex, 0, moved);

  this._state.colAxes = axes;
  // colWidths: preserve — same columns, just reordered
  // sortOverrides: preserve — field-based, not index-based
  // collapseState: REMAP level indices
  this._state.collapseState = this._remapCollapseKeys(
    this._state.collapseState ?? [],
    fromIndex,
    toIndex,
    this._state.colAxes.length
  );
  this._scheduleNotify();
}
```

### Example 3: FLIP Snapshot Integration Point

```typescript
// In SuperGrid — stored as instance variable for async pipeline
private _flipSnapshot: Map<string, DOMRect> | null = null;

// In drop handler (synchronous, before provider mutation):
private _captureFlipSnapshot(): void {
  const grid = this._gridEl;
  if (!grid) return;
  this._flipSnapshot = new Map();
  grid.querySelectorAll('.data-cell, .col-header, .row-header').forEach(el => {
    const key = this._getElementFlipKey(el as HTMLElement);
    if (key) this._flipSnapshot!.set(key, el.getBoundingClientRect());
  });
}

// In _renderCells (after DOM rebuild):
private _playFlipAnimation(): void {
  if (!this._flipSnapshot || !this._gridEl) return;
  const snapshot = this._flipSnapshot;
  this._flipSnapshot = null; // consume once

  this._gridEl.querySelectorAll('.data-cell, .col-header, .row-header').forEach(el => {
    const key = this._getElementFlipKey(el as HTMLElement);
    const oldRect = key ? snapshot.get(key) : undefined;
    if (!oldRect) return;

    const newRect = el.getBoundingClientRect();
    const dx = oldRect.left - newRect.left;
    const dy = oldRect.top - newRect.top;
    if (dx === 0 && dy === 0) return;

    (el as HTMLElement).animate([
      { transform: `translate(${dx}px, ${dy}px)` },
      { transform: 'none' }
    ], { duration: 200, easing: 'ease-out' });
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `dataset['reorderTargetIndex']` (test-only) | Midpoint calculation in dragover | Phase 31 (this phase) | Production drag reorder works visually |
| `setColAxes`/`setRowAxes` for all axis changes | Separate `reorderColAxes`/`reorderRowAxes` | Phase 31 (this phase) | Collapse state preserved during reorder |
| D3 opacity crossfade only (DYNM-04) | FLIP position animation + opacity crossfade | Phase 31 (this phase) | Smoother visual feedback on axis reorder |

**Deprecated/outdated:**
- `dropZoneEl.dataset['reorderTargetIndex']`: Test-only mechanism replaced by production midpoint calculation. Tests should be updated to use the new midpoint-based path OR continue using dataset for unit testing (testing the splice logic), with integration tests validating the full dragover flow.

## Open Questions

1. **Collapse key remapping depth for 3+ level axes**
   - What we know: Collapse keys encode `level\x1fparentPath\x1fvalue`. parentPath is a join of ancestor values. When level 0 becomes level 2, the parentPath for level-2 keys changes because ancestors shifted.
   - What's unclear: For 3 stacked axes where you reorder the first to last, do keys at all levels need their parentPaths rebuilt from scratch?
   - Recommendation: For pragmatic implementation, clear all collapse state on reorder of 3+ level axis stacks. Document as a known simplification. Most users will have 2 axes where remapping is simpler (level swap only, no parentPath issue for 2-level stacks).

2. **FLIP animation with hide-mode collapsed cells**
   - What we know: Phase 30 hide-mode hides cells entirely from the grid (filtered out of visibleLeafColCells/visibleLeafRowCells).
   - What's unclear: Should hidden cells participate in FLIP? They have no visible position.
   - Recommendation: Only snapshot visible cells. Hidden cells don't animate.

3. **Cross-dimension transpose collapse preservation**
   - What we know: CONTEXT.md says "collapse state preserved across axis moves" for both same-dimension reorder AND cross-dimension transpose.
   - What's unclear: When an axis moves from col to row dimension, its collapse keys reference col levels. After transpose it's at a row level. The key format is dimension-agnostic (level index only), but the collapse set is shared across both dimensions.
   - Recommendation: For cross-dimension transpose, attempt to preserve collapse keys by remapping the moved axis's level. If the axis goes from col level 1 to row level (appended as last), update keys with `level=1` for that field to `level=rowAxes.length-1`. Use `setColAxes`/`setRowAxes` (with reset) for the dimension that loses an axis, but manually inject remapped keys into the other dimension's new state.

## Sources

### Primary (HIGH confidence)
- PAFVProvider.ts (lines 188-217) — setColAxes/setRowAxes reset behavior verified by direct code inspection
- SuperGrid.ts (lines 3312-3413) — _wireDropZone implementation, drop handler logic, reorderTargetIndex mechanism
- SuperStackHeader.ts (lines 86-259) — buildHeaderCells with collapse key format and parentPath encoding
- SuperGrid.ts (lines 1041-1133) — _fetchAndRender async pipeline, DYNM-04 opacity crossfade
- SuperGrid.ts (lines 1143-1425) — _renderCells DOM rebuild, header rendering, cell placement
- SuperGrid.test.ts (lines 1740-1949) — existing DYNM-03 tests with fireSameDimDrop helper

### Secondary (MEDIUM confidence)
- [CSS-Tricks FLIP technique article](https://css-tricks.com/animating-layouts-with-the-flip-technique/) — canonical FLIP implementation with WAAPI
- [Paul Lewis (Aerotwist) FLIP article](https://aerotwist.com/blog/flip-your-animations/) — original FLIP technique description
- [SortableJS midpoint algorithm](https://github.com/SortableJS/Sortable/wiki/Sorting-with-the-help-of-HTML5-Drag'n'Drop-API/) — midpoint threshold calculation for drop position

### Tertiary (LOW confidence)
- None — all findings verified against source code or authoritative documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries; all native browser APIs verified
- Architecture: HIGH - direct code inspection of PAFVProvider, SuperGrid, SuperStackHeader reveals exact integration points and the critical collapse reset problem
- Pitfalls: HIGH - identified from code analysis (setColAxes reset, async FLIP timing, key encoding format)
- FLIP technique: MEDIUM - well-documented pattern but project-specific integration with async _fetchAndRender pipeline needs careful implementation
- Collapse key remapping: MEDIUM - 2-level remap is straightforward; 3+ levels have parentPath complexity (open question)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain; no external dependencies to version-drift)
