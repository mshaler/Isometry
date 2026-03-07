# Phase 38: Virtual Scrolling - Research

**Researched:** 2026-03-06
**Domain:** CSS Grid virtual scrolling, content-visibility progressive enhancement, custom row windowing
**Confidence:** HIGH

## Summary

Phase 38 adds two-layer virtual scrolling to SuperGrid: CSS `content-visibility: auto` as a progressive enhancement for browsers that support it (Safari 18+, Chrome 85+), plus a custom `SuperGridVirtualizer` module that performs row-level windowing for datasets exceeding 100 leaf rows. The virtualizer computes the visible row range from `scrollTop / rowHeight`, renders only those rows plus 5-row overscan above and below, and uses a sentinel spacer element to maintain pixel-accurate total scroll height.

The key architectural constraint is that SuperGrid currently does a full DOM teardown + rebuild on every `_renderCells()` call (line 1299: `while (grid.firstChild) grid.removeChild(grid.firstChild)`). The virtualizer must work within this pattern, not against it. Rather than trying to incrementally update the DOM, the virtualizer intercepts the data flow: `_renderCells()` continues to receive ALL `cellPlacements`, but only the visible subset gets D3-joined and rendered. Headers (column and row) are handled separately -- column headers always render fully, and row headers are virtualized alongside their data rows since they scroll vertically.

A critical browser-support finding: `content-visibility: auto` requires **Safari 18.0+** (September 2024). The project targets iOS 17+ / macOS 14+, which ship with Safari 17.x. This means `content-visibility: auto` is a **progressive enhancement only** -- it will benefit iOS 18+ / macOS 15+ users but cannot be the sole virtualization strategy. The custom `SuperGridVirtualizer` is the required baseline that works on all supported platforms.

**Primary recommendation:** Build `SuperGridVirtualizer` as a self-contained class with attach/detach lifecycle (mirroring `SuperGridSizer` and `SuperZoom`). Add `content-visibility: auto` CSS rules as a zero-cost progressive enhancement. The virtualizer is the load-bearing implementation; `content-visibility` is a bonus for modern browsers.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two-layer approach: CSS `content-visibility: auto` on ALL data cells as progressive enhancement (browser-native, zero JS), PLUS custom row virtualization that only renders visible rows + overscan buffer
- Custom row virtualization activates at a threshold: >100 leaf rows triggers the virtualizer; below threshold, all rows render normally with just `content-visibility: auto`
- Virtualizer is a separate module: new `SuperGridVirtualizer` class in `src/views/supergrid/` -- mirrors SuperGridSizer/SuperZoom lifecycle pattern (attach/detach). SuperGrid delegates visible-row computation to it. Testable in isolation
- `content-visibility: auto` uses zoom-aware CSS variable: `contain-intrinsic-size: auto var(--sg-row-height, 40px)` -- tracks the existing `--sg-row-height` custom property that SuperZoom already sets
- Keep current CSS `position: sticky` approach for both column and row headers -- no architectural change to header layout
- Column headers are always fully rendered (small count, sticky at top, unaffected by row virtualization)
- Row headers are virtualized alongside their data rows -- they're sticky horizontally but scroll vertically, so offscreen row headers don't need DOM nodes
- Spacer rows (invisible elements) above and below visible rows maintain correct total grid height for scrollbar accuracy
- Sentinel spacer element with height = totalRows x rowHeight provides pixel-perfect scrollbar thumb size and position
- Lasso selection: viewport-only -- BBoxCache continues snapshotting whatever `.data-cell` elements exist in DOM (visible + overscan). Users drag lassos within their viewport, so this is natural behavior
- Sort/filter: reset scroll to (0,0) on change -- matches existing documented behavior. Virtualizer re-renders from row 0
- SuperGridSizer auto-fit (dblclick): measures only visible + overscan cells. Good enough for content width estimation, no special handling
- Density controls (hide-empty, view mode) and collapse (aggregate/hide): continue processing ALL cells for logic/computation. Only the rendering step is virtualized (which rows get DOM nodes). Clean separation of data vs. render
- Fixed uniform row height -- all rows assumed same height (var(--sg-row-height)). Simplifies virtualizer math: visible range = scrollTop / rowHeight. Content clips via CSS overflow
- 5 rows overscan above and below viewport (~10 extra rows total). Prevents flicker during normal scrolling with minimal DOM overhead
- Virtualization threshold: 100 leaf rows. Below this, all rows render with content-visibility: auto only
- Scrollbar: sentinel spacer element (single invisible div, height = totalRows x rowHeight) inside scroll container. CSS Grid content positioned above it

### Claude's Discretion
- Exact spacer element implementation (position: absolute vs. CSS Grid row placement)
- How _renderCells() refactors to call virtualizer for visible row range
- rAF scroll handler integration with virtualizer (debounce vs. immediate recalc)
- BBoxCache invalidation timing when rows enter/leave DOM
- Row recycling strategy (create/destroy vs. reuse DOM nodes)
- Performance benchmark thresholds and test methodology

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VSCR-01 | SuperGrid data cells use CSS content-visibility: auto for browser-native rendering optimization | content-visibility CSS rules on .data-cell elements with contain-intrinsic-size tracking --sg-row-height. Progressive enhancement: Safari 18+, Chrome 85+, Firefox 125+. No-op on Safari 17. |
| VSCR-02 | SuperGrid uses custom row virtualization, rendering only visible rows plus overscan buffer | SuperGridVirtualizer class computes visibleStartRow/visibleEndRow from scrollTop/rowHeight, filters cellPlacements to visible range + 5-row overscan. D3 data join operates on windowed subset only. |
| VSCR-03 | Column and row headers remain frozen/sticky during virtual scrolling | Column headers always fully rendered (not virtualized). Row headers virtualized alongside data rows. Sticky positioning preserved via existing z-index strategy. Spacer element does not interfere with sticky context. |
| VSCR-04 | Scroll container maintains correct total height as if all rows were rendered | Sentinel spacer div with height = totalLeafRows x rowHeight (zoom-aware) inside scroll container. Spacer positioned after grid content via CSS. |
| VSCR-05 | SuperGrid renders at 60fps during scroll with 10K+ card datasets | rAF-throttled scroll handler triggers virtualizer recalc. Only visible + overscan rows rendered (~30-50 DOM nodes vs 10K+). Benchmark validates <16ms per frame. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9 | Type-safe virtualizer implementation | Project standard |
| D3.js | 7.9 | Data join for visible cell rendering | Project standard, D3 key function mandatory |
| Vitest | 4.0 | Unit + benchmark tests | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS content-visibility | N/A (browser feature) | Progressive rendering enhancement | All data cells, automatically applied |
| requestAnimationFrame | N/A (browser API) | Scroll handler throttling | Scroll event -> virtualizer recalc |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom virtualizer | Third-party library (e.g. Clusterize.js) | Incompatible with D3 data join DOM ownership (D-001 territory). Custom required per REQUIREMENTS.md out-of-scope section. |
| Row-level windowing | Column + row windowing | Column virtualization deferred (VSCR-F01). Column count bounded by MAX_LEAF_COLUMNS=50, manageable without virtualization. |
| Sentinel spacer div | CSS Grid phantom rows | Phantom rows would bloat gridTemplateRows string for 10K rows. Single div is simpler and zoom-aware. |

**Installation:**
No new dependencies. All implementation uses existing project stack + browser APIs.

## Architecture Patterns

### Recommended Module Structure
```
src/views/supergrid/
  SuperGridVirtualizer.ts     # NEW — row windowing logic
  SuperGridSizer.ts           # existing — column resize (attach/detach pattern to mirror)
  SuperZoom.ts                # existing — reads --sg-row-height (virtualizer also reads this)
  SuperGridBBoxCache.ts       # existing — no changes needed (snapshots visible cells only)
  SuperGridSelect.ts          # existing — no changes needed (viewport-only lasso)
```

### Pattern 1: SuperGridVirtualizer Lifecycle (attach/detach)
**What:** Self-contained class following the established SuperGridSizer/SuperZoom lifecycle pattern.
**When to use:** Always instantiated by SuperGrid. Activated only when leafRowCount > 100.

```typescript
// Source: Pattern mirrors SuperGridSizer.ts from this codebase
export class SuperGridVirtualizer {
  private _rootEl: HTMLElement | null = null;
  private _totalLeafRows = 0;
  private _getRowHeight: () => number;       // reads --sg-row-height from zoom
  private _getColHeaderLevels: () => number; // offset for grid-row computation

  constructor(getRowHeight: () => number, getColHeaderLevels: () => number) {
    this._getRowHeight = getRowHeight;
    this._getColHeaderLevels = getColHeaderLevels;
  }

  attach(rootEl: HTMLElement): void {
    this._rootEl = rootEl;
  }

  detach(): void {
    this._rootEl = null;
    this._totalLeafRows = 0;
  }

  /** Set total row count from _renderCells (changes on data/filter/collapse). */
  setTotalRows(count: number): void {
    this._totalLeafRows = count;
  }

  /** Returns true if virtualization is active (>100 leaf rows). */
  isActive(): boolean {
    return this._totalLeafRows > 100;
  }

  /** Compute visible row range from current scroll position. */
  getVisibleRange(): { startRow: number; endRow: number } {
    if (!this._rootEl || !this.isActive()) {
      return { startRow: 0, endRow: this._totalLeafRows };
    }
    const scrollTop = this._rootEl.scrollTop;
    const viewportHeight = this._rootEl.clientHeight;
    const rowHeight = this._getRowHeight();
    const colHeaderOffset = this._getColHeaderLevels() * rowHeight;

    // Subtract header height from scrollTop for row calculation
    const adjustedScrollTop = Math.max(0, scrollTop - colHeaderOffset);

    const firstVisible = Math.floor(adjustedScrollTop / rowHeight);
    const lastVisible = Math.ceil((adjustedScrollTop + viewportHeight) / rowHeight);

    const OVERSCAN = 5;
    const startRow = Math.max(0, firstVisible - OVERSCAN);
    const endRow = Math.min(this._totalLeafRows, lastVisible + OVERSCAN);

    return { startRow, endRow };
  }

  /** Total virtual height for sentinel spacer (zoom-aware). */
  getTotalHeight(): number {
    return this._totalLeafRows * this._getRowHeight();
  }
}
```

### Pattern 2: Data Windowing in _renderCells
**What:** Filter cellPlacements to visible rows before D3 data join. Preserve full data for collapse/density logic.
**When to use:** When virtualizer.isActive() returns true.

```typescript
// Inside _renderCells(), AFTER all cellPlacements are computed
// but BEFORE the D3 data join:

const { startRow, endRow } = this._virtualizer.getVisibleRange();

// visibleLeafRowCells is already computed at this point
// Filter to only the visible window
const windowedRowCells = this._virtualizer.isActive()
  ? visibleLeafRowCells.slice(startRow, endRow)
  : visibleLeafRowCells;

// Build visible row key set for fast filtering
const visibleRowKeys = new Set(windowedRowCells.map(c =>
  c.parentPath ? `${c.parentPath}\x1f${c.value}` : c.value
));

// Filter cellPlacements to visible rows only
const windowedPlacements = this._virtualizer.isActive()
  ? cellPlacements.filter(cp => visibleRowKeys.has(cp.rowKey))
  : cellPlacements;

// D3 data join operates on windowed subset
gridSelection
  .selectAll<HTMLDivElement, CellPlacement>('.data-cell')
  .data(windowedPlacements, d => `${d.isSummary ? 'summary:' : ''}${d.rowKey}${RECORD_SEP}${d.colKey}`)
  .join(/* ... */);
```

### Pattern 3: Sentinel Spacer for Scroll Height
**What:** Single invisible div that provides correct total scroll height.
**When to use:** When virtualizer is active. Placed inside _rootEl (not _gridEl).

```typescript
// Recommendation: position: absolute spacer inside rootEl
// rootEl already has position: relative and overflow: auto

// Create in mount(), update in _renderCells()
const spacer = document.createElement('div');
spacer.className = 'virtual-scroll-spacer';
spacer.style.position = 'absolute';
spacer.style.top = '0';
spacer.style.left = '0';
spacer.style.width = '1px';     // minimal width, does not affect layout
spacer.style.height = '0px';    // updated dynamically
spacer.style.pointerEvents = 'none';
spacer.style.visibility = 'hidden';
rootEl.appendChild(spacer);

// In _renderCells() when virtualizer is active:
if (this._virtualizer.isActive() && this._spacerEl) {
  // Total height = header rows height + data rows height
  const colHeaderHeight = colHeaderLevels * rowHeight;
  const dataHeight = this._virtualizer.getTotalHeight();
  this._spacerEl.style.height = `${colHeaderHeight + dataHeight}px`;
}
```

### Pattern 4: Grid Row Offset for Virtualized Rows
**What:** When only a subset of rows is rendered, grid-row assignments must be offset to place cells at their correct scroll position.
**When to use:** When virtualizer is active -- grid-row must account for the startRow offset.

```typescript
// Inside the .each(function(d)) of the D3 data join:
// The current code computes gridRow as:
//   const rowIdx = visibleLeafRowCells.findIndex(...);
//   const gridRow = colHeaderLevels + rowIdx + 1;
//
// With virtualization, rowIdx is relative to windowedRowCells, not all rows.
// But we need the ABSOLUTE grid-row position for correct visual placement.
//
// Solution: use the absolute row index in the full visibleLeafRowCells array:
const absRowIdx = visibleLeafRowCells.findIndex(c => {
  const fullKey = c.parentPath ? `${c.parentPath}\x1f${c.value}` : c.value;
  return fullKey === d.rowKey;
});
const gridRow = colHeaderLevels + absRowIdx + 1;
```

### Pattern 5: CSS content-visibility Progressive Enhancement
**What:** Apply content-visibility: auto to data cells via CSS. Zero JS cost.
**When to use:** Always applied; browsers that don't support it simply ignore the property.

```css
/* Progressive enhancement: browsers that support content-visibility
   skip paint/layout for off-screen cells. Safari 18+, Chrome 85+, Firefox 125+.
   Safari 17 and below simply ignore this property -- no harm. */
.data-cell {
  content-visibility: auto;
  contain-intrinsic-size: auto var(--sg-row-height, 40px);
}

/* Headers must NOT use content-visibility -- they must remain
   rendered for sticky positioning to work correctly */
.col-header, .row-header, .corner-cell {
  content-visibility: visible;
}
```

### Anti-Patterns to Avoid

- **Fighting D3 for DOM ownership:** Do NOT try to keep DOM nodes alive across _renderCells() calls. The existing pattern is full teardown + rebuild. The virtualizer should filter DATA, not manipulate DOM lifecycle.
- **Variable row heights:** Do NOT attempt to measure actual row heights and accumulate offsets. The CONTEXT.md locks uniform row height. Variable heights would require a height cache and offset accumulator -- massive complexity for zero user benefit in a matrix/grid view.
- **Virtualizing columns:** Column count is bounded by MAX_LEAF_COLUMNS=50. Column virtualization (VSCR-F01) is explicitly out of scope and not needed for the 10K+ card target.
- **Modifying gridTemplateRows for 10K rows:** Do NOT generate `Array(10000).fill('auto').join(' ')` -- this is a performance hazard. When virtualizer is active, gridTemplateRows should only include rendered rows. The sentinel spacer handles total scroll height separately.
- **IntersectionObserver for virtualization:** IO adds complexity and is unnecessary when row heights are uniform. Simple `scrollTop / rowHeight` math is faster and deterministic.
- **Debouncing scroll handler:** Do NOT debounce (setTimeout). Use rAF throttling ONLY (already established pattern in SuperGrid). Debouncing introduces 100-200ms delay that destroys 60fps scroll feel. rAF gives you the next paint frame (~16ms).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll throttling | Custom setTimeout debounce | rAF throttling (existing pattern) | Already proven in codebase; setTimeout kills scroll smoothness |
| Total scroll height | CSS Grid phantom rows | Single sentinel spacer div | Phantom rows bloat gridTemplateRows string; spacer is O(1) |
| Browser paint optimization | JS-based visibility detection | CSS content-visibility: auto | Browser-native, zero JS, progressive enhancement |
| Row height calculation | Manual DOM measurement | `var(--sg-row-height)` from SuperZoom | Single source of truth, zoom-aware, already set |

**Key insight:** The virtualizer's ONLY job is computing `{ startRow, endRow }` from scroll position. Everything else (D3 rendering, header spanning, collapse logic, density controls) stays exactly as-is. The virtualizer is a thin computation layer, not a rendering engine.

## Common Pitfalls

### Pitfall 1: gridTemplateRows Explosion at Scale
**What goes wrong:** Generating `Array(10000).fill('auto').join(' ')` for gridTemplateRows creates a ~50KB string that the CSS parser must process on every _renderCells() call. At 10K+ rows this becomes a measurable bottleneck.
**Why it happens:** Current code (line 1293) does exactly this for ALL rows. It works for 50-200 rows but fails at 10K scale.
**How to avoid:** When virtualizer is active, gridTemplateRows should only describe the RENDERED rows (visible + overscan, ~30-50 rows). The sentinel spacer handles total height independently.
**Warning signs:** Profiler shows long "Recalculate Style" times correlated with row count.

### Pitfall 2: Scroll Position Jump on Re-render
**What goes wrong:** When `_renderCells()` does a full DOM teardown (`while (grid.firstChild)...`), the browser briefly has no content. If the scroll container's content height drops to 0, the scrollbar resets to top. When content is rebuilt, the scroll position is lost.
**Why it happens:** The sentinel spacer must be OUTSIDE the grid element (in rootEl) so it is NOT removed during grid teardown. If spacer is inside gridEl, it gets removed with everything else.
**How to avoid:** Place spacer as a child of rootEl (the scroll container), not gridEl (the CSS Grid container). rootEl has `overflow: auto` and `position: relative`, making it the correct parent for an absolute-positioned spacer.
**Warning signs:** Scroll jumps to top on every re-render when scrolled to middle of large dataset.

### Pitfall 3: Sticky Headers Breaking with Spacer
**What goes wrong:** If the spacer element is placed before the grid in the DOM and has a large height, it pushes the grid down, making sticky headers appear at an offset rather than at the top of the scroll container.
**Why it happens:** Sticky positioning is relative to the scroll container's overflow viewport. Content above the grid shifts the grid's "top" reference point.
**How to avoid:** Position spacer with `position: absolute` so it doesn't participate in normal flow. Or ensure grid is always the first flow child and spacer is positioned after it. The existing `position: relative` on rootEl makes absolute positioning natural.
**Warning signs:** Column headers don't stick at top during scroll; they appear offset by spacer height.

### Pitfall 4: BBoxCache Stale After Scroll
**What goes wrong:** After scroll triggers virtualizer to render new rows, BBoxCache still holds DOMRects from the previous set of visible rows. Lasso selection hits stale entries pointing to removed DOM nodes.
**Why it happens:** `scheduleSnapshot()` is only called at the end of `_renderCells()`. But scroll-triggered re-renders might use a lighter path that skips the full _renderCells.
**How to avoid:** Always call `_bboxCache.scheduleSnapshot()` after any DOM change that adds/removes data-cell elements. If the virtualizer triggers a re-render (via scroll), ensure the snapshot is scheduled. The existing pattern already calls it at the end of _renderCells, so as long as scroll-triggered updates go through _renderCells, this is handled.
**Warning signs:** Lasso selection selects wrong cells after scrolling.

### Pitfall 5: content-visibility Breaking Find-in-Page (Safari)
**What goes wrong:** Safari (as of 18.x) has a known bug where `content-visibility: auto` causes skipped content to be invisible to the browser's find-in-page feature (Cmd+F). Elements with skipped content are not searchable.
**Why it happens:** WebKit Bug 283846 -- skipped subtrees are excluded from text search.
**How to avoid:** This is acceptable for SuperGrid because: (a) data cells show counts/pills, not searchable text, (b) SuperGrid has its own FTS5 search (SRCH phases), and (c) content-visibility is progressive enhancement, not functional requirement.
**Warning signs:** Users report Cmd+F doesn't find text in off-screen cells.

### Pitfall 6: Zoom Change Invalidates Virtualizer Calculations
**What goes wrong:** When user zooms (Ctrl+wheel), `--sg-row-height` changes, which changes the viewport-to-row mapping. If the virtualizer's cached rowHeight is stale, visible range is wrong.
**Why it happens:** SuperZoom updates CSS custom properties but doesn't notify the virtualizer.
**How to avoid:** The virtualizer should read `--sg-row-height` dynamically (via `getRowHeight()` callback) on every `getVisibleRange()` call, not cache it. This is already recommended in the constructor pattern above. Additionally, zoom triggers a full re-render via `_onZoomChange` callback, which calls `_renderCells()`, which re-queries the virtualizer.
**Warning signs:** After zooming, some rows are missing or extra rows render.

## Code Examples

### Example 1: Scroll Handler Integration
```typescript
// In SuperGrid mount(), modify the existing _boundScrollHandler:
private _boundScrollHandler = (): void => {
  if (this._scrollRafId !== null) return;
  this._scrollRafId = requestAnimationFrame(() => {
    this._scrollRafId = null;
    if (this._rootEl) {
      this._positionProvider.savePosition(this._rootEl);

      // Virtualizer: check if visible range changed
      if (this._virtualizer.isActive()) {
        const newRange = this._virtualizer.getVisibleRange();
        if (newRange.startRow !== this._lastRenderedRange.startRow ||
            newRange.endRow !== this._lastRenderedRange.endRow) {
          // Re-render with new visible window (from cached data)
          this._renderCells(this._lastCells, this._lastColAxes, this._lastRowAxes);
          this._lastRenderedRange = newRange;
        }
      }
    }
  });
};
```

### Example 2: Row Header Virtualization
```typescript
// Row headers are virtualized alongside data rows.
// In the row header rendering loop, only render headers for visible rows.

for (let levelIdx = 0; levelIdx < rowHeaders.length; levelIdx++) {
  const levelCells = rowHeaders[levelIdx] ?? [];
  const levelAxisField = rowAxes[levelIdx]?.field ?? rowField;

  for (const cell of levelCells) {
    // Skip non-visible row headers when virtualizer is active
    if (this._virtualizer.isActive()) {
      const fullKey = cell.parentPath
        ? `${cell.parentPath}\x1f${cell.value}`
        : cell.value;
      if (!visibleRowKeys.has(fullKey)) continue;
    }

    const el = this._createRowHeaderCell(
      cell, levelAxisField, levelIdx, colHeaderLevels, rowHeaderDepth, rowAxes, rowField
    );
    grid.appendChild(el);
  }
}
```

### Example 3: gridTemplateRows for Virtualized Mode
```typescript
// When virtualizer is active, only describe rendered rows
if (this._virtualizer.isActive()) {
  const { startRow, endRow } = this._virtualizer.getVisibleRange();
  const renderedRowCount = endRow - startRow;

  // Grid template: header levels + rendered data rows
  // Each data row uses the zoom-aware row height
  const headerRowDefs = Array(colHeaderLevels).fill('auto');
  const dataRowDefs = Array(renderedRowCount).fill('var(--sg-row-height, 40px)');
  grid.style.gridTemplateRows = [...headerRowDefs, ...dataRowDefs].join(' ');
} else {
  // Original behavior for non-virtualized mode
  grid.style.gridTemplateRows = Array(totalRows).fill('auto').join(' ');
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DOM virtualization (hide/show nodes) | Data windowing (render subset of data) | 2023-2024 ecosystem shift | D3 data join stays clean; virtualizer is pure computation |
| IntersectionObserver for visibility | content-visibility: auto CSS property | Safari 18.0 (Sep 2024) | Zero-JS browser-native paint skipping; progressive enhancement |
| Custom scroll position calculation | scrollTop / fixedRowHeight | Always (for uniform heights) | Simplest, fastest, most reliable approach |
| Third-party virtual scroll libraries | Custom thin virtualizer | Project-specific | D3 + CSS Grid + PAFV axes = unique combination; no library fits |

**Deprecated/outdated:**
- `content-visibility: hidden` (different from `auto` -- fully hides content, not useful here)
- IntersectionObserver-based virtualization (over-engineered for uniform row heights)
- Scroll anchor adjustment (`overflow-anchor: auto`) -- only relevant for variable-height rows

## Open Questions

1. **Spacer Element: position absolute vs. CSS Grid row placement**
   - What we know: rootEl has `position: relative` and `overflow: auto`. An absolute-positioned spacer inside rootEl would provide total height without affecting grid layout.
   - What's unclear: Whether the absolute spacer correctly influences scrollbar calculations in all browsers (Safari in particular). Absolute-positioned children DO contribute to scroll height when inside an `overflow: auto` container.
   - Recommendation: Use `position: absolute` spacer in rootEl (NOT gridEl). Verify scrollbar thumb accuracy in Safari 17 and Safari 18 during testing.

2. **Row Recycling vs. Create/Destroy**
   - What we know: Current _renderCells does full teardown + rebuild. D3 data join handles enter/update/exit.
   - What's unclear: Whether keeping the full teardown pattern (and letting D3 join handle enter/exit on each scroll-triggered re-render) is fast enough at 60fps, or whether explicit DOM node recycling is needed.
   - Recommendation: Start with the simpler approach (D3 join on each scroll re-render). The windowed data set is small (~30-50 rows x leaf columns = ~150-500 cells), so D3 join overhead should be negligible. Only add recycling if benchmarks show >16ms per re-render.

3. **Scroll-Triggered Re-render: Full _renderCells or Lightweight Path?**
   - What we know: _renderCells() does a LOT -- density toolbar update, hide-empty filter, collapse injection, heat scale computation, aggregate injection, etc. Most of this is unnecessary during scroll because the data hasn't changed.
   - What's unclear: Whether calling full _renderCells on every scroll-triggered re-render is fast enough.
   - Recommendation: First attempt with full _renderCells (simplest, safest). If profiling shows bottleneck, extract a `_rerenderVisibleWindow()` method that skips data-processing steps and only does the D3 join + header render with the cached cellPlacements. This is a performance optimization to defer.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `src/views/SuperGrid.ts` (3800+ lines, full _renderCells pipeline)
- Codebase analysis: `src/views/supergrid/SuperGridSizer.ts` (lifecycle pattern reference)
- Codebase analysis: `src/views/supergrid/SuperZoom.ts` (--sg-row-height, --sg-col-width)
- Codebase analysis: `src/views/supergrid/SuperGridBBoxCache.ts` (scheduleSnapshot pattern)
- [Can I Use: CSS content-visibility](https://caniuse.com/css-content-visibility) -- Safari 18.0+ first version

### Secondary (MEDIUM confidence)
- [MDN: contain-intrinsic-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/contain-intrinsic-size) -- CSS Grid behavior notes
- [web.dev: content-visibility](https://web.dev/articles/content-visibility) -- Performance optimization patterns
- [DebugBear: content-visibility](https://www.debugbear.com/blog/content-visibility-api) -- Scrollbar behavior with content-visibility
- [GoMakeThings: rAF debouncing](https://gomakethings.com/debouncing-events-with-requestanimationframe-for-better-performance/) -- rAF vs setTimeout for scroll events
- Project pre-phase research: `.planning/research/ARCHITECTURE.md` section 3 (Virtual Scrolling Architecture)
- Project pre-phase research: `.planning/research/PITFALLS.md` Pitfall 3 (D3 data join conflict)

### Tertiary (LOW confidence)
- [cekrem.github.io](https://cekrem.github.io/posts/content-visibility-auto-performance/) -- Real-world content-visibility measurements (blog, single source)
- WebKit Bug 283846 -- Safari find-in-page with content-visibility (unverified fix timeline)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, all browser APIs and existing codebase patterns
- Architecture: HIGH -- virtualizer design follows established SuperGridSizer/SuperZoom patterns; data windowing approach validated by pre-phase research and CONTEXT.md decisions
- Pitfalls: HIGH -- comprehensive analysis of DOM teardown, sticky positioning, scrollbar accuracy, and zoom interaction based on direct codebase reading
- content-visibility browser support: HIGH -- verified via Can I Use (Safari 18.0+), confirmed progressive enhancement approach is correct for iOS 17+ target

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable domain -- CSS Grid and D3 patterns are mature)
