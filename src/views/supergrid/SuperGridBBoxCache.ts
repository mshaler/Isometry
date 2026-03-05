// Isometry v5 — Phase 21 SuperSelect
// SuperGridBBoxCache: post-render bounding box cache for O(1) lasso hit-testing.
//
// Design:
//   - scheduleSnapshot() defers DOM measurement to next rAF (called after _renderCells())
//   - _snapshot() reads all .data-cell elements' DOMRect into an internal Map
//   - hitTest() reads only from the Map — never touches the DOM during mousemove
//   - rectsIntersect() is a pure function exported for unit testing
//
// Requirements: SLCT-08

/**
 * Pure rectangle intersection test — exported for testability.
 *
 * Uses `b.x + b.width` instead of `b.right` for safe jsdom DOMRect compatibility.
 *
 * @param a  Lasso rectangle: { x, y, w, h }
 * @param b  Cell DOMRect or plain { x, y, width, height }
 */
export function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.w > b.x &&
    a.y < b.y + b.height &&
    a.y + a.h > b.y
  );
}

/**
 * Post-render bounding box cache for SuperGrid cells.
 *
 * Usage:
 *   1. cache.attach(gridEl)  — call once in SuperGrid.mount()
 *   2. cache.scheduleSnapshot() — call at end of every _renderCells()
 *   3. cache.hitTest(lassoRect) — call in lasso mousemove handler (pure Map read)
 *   4. cache.detach() — call in SuperGrid.destroy()
 */
export class SuperGridBBoxCache {
  private _cache = new Map<string, DOMRect>();
  private _gridEl: HTMLElement | null = null;

  /**
   * Store reference to the SuperGrid root element.
   * Called once in SuperGrid.mount().
   */
  attach(gridEl: HTMLElement): void {
    this._gridEl = gridEl;
  }

  /**
   * Clear the cache and release the grid element reference.
   * Called in SuperGrid.destroy().
   */
  detach(): void {
    this._gridEl = null;
    this._cache.clear();
  }

  /**
   * Defer a full DOM measurement to the next animation frame.
   * Call this at the end of every _renderCells() to keep the cache fresh.
   * Safe to call multiple times — each rAF callback is independent.
   */
  scheduleSnapshot(): void {
    requestAnimationFrame(() => this._snapshot());
  }

  /**
   * Return the cached DOMRect for a given cellKey, or undefined if not found.
   * cellKey format: "rowKey:colKey" (matches el.dataset['key']).
   */
  getRect(cellKey: string): DOMRect | undefined {
    return this._cache.get(cellKey);
  }

  /**
   * Return all cell keys whose cached DOMRect intersects the given lasso rectangle.
   * Reads only from the Map — never calls getBoundingClientRect() during mousemove.
   *
   * @param lassoRect  Lasso rectangle in page coordinates: { x, y, w, h }
   * @returns          Array of matching cellKeys (may be empty)
   */
  hitTest(lassoRect: { x: number; y: number; w: number; h: number }): string[] {
    const hits: string[] = [];
    for (const [key, rect] of this._cache) {
      if (rectsIntersect(lassoRect, rect)) {
        hits.push(key);
      }
    }
    return hits;
  }

  /**
   * Snapshot all .data-cell elements in the grid, storing their current DOMRect.
   * Overwrites the entire cache — implicit invalidation on re-render.
   * No-op if detach() was called before rAF fires.
   */
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
}
