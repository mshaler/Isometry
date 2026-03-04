// Isometry v5 — SuperPositionProvider
// Tier 3 ephemeral scroll/zoom position cache for SuperGrid.
//
// Design:
//   - Stores scrollTop, scrollLeft, and zoomLevel for position restoration
//   - NOT a StateProvider — no subscribe/notify, NOT registered with StateCoordinator
//     (registering would trigger 60fps worker calls during scroll)
//   - savePosition / restorePosition bridge HTMLElement scroll state
//   - zoomLevel clamped to [ZOOM_MIN=0.5, ZOOM_MAX=3.0]
//   - reset() clears scroll/axis state but PRESERVES zoomLevel
//     (zoom is a preference that outlives individual grid sessions)
//   - ZOOM_MIN, ZOOM_MAX, ZOOM_DEFAULT are exported for reuse by SuperZoom
//
// Requirements: POSN-01, POSN-02

// ---------------------------------------------------------------------------
// Exported constants — shared with SuperZoom
// ---------------------------------------------------------------------------

/** Minimum zoom level (0.5x) — 60px data columns at max zoom-out */
export const ZOOM_MIN = 0.5;

/** Maximum zoom level (3.0x) — 360px data columns at max zoom-in */
export const ZOOM_MAX = 3.0;

/** Default zoom level (1.0x) — 120px data columns at 1x */
export const ZOOM_DEFAULT = 1.0;

// ---------------------------------------------------------------------------
// SuperPositionProvider
// ---------------------------------------------------------------------------

/**
 * Tier 3 ephemeral position cache for SuperGrid.
 *
 * Holds scroll position (scrollTop/scrollLeft) and zoom level as in-memory
 * state. Not persisted, not synchronized, not registered with StateCoordinator.
 *
 * SuperGrid injects this as a 5th constructor dependency (Plan 02).
 */
export class SuperPositionProvider {
  private _scrollTop: number = 0;
  private _scrollLeft: number = 0;
  private _zoomLevel: number = ZOOM_DEFAULT;
  private _rowValues: string[] = [];
  private _colValues: string[] = [];
  private _scrollAnchorCard: string | null = null;

  // ---------------------------------------------------------------------------
  // Scroll position
  // ---------------------------------------------------------------------------

  /**
   * Save scroll position from an HTMLElement.
   * Reads scrollTop and scrollLeft from the element.
   */
  savePosition(rootEl: HTMLElement): void {
    this._scrollTop = rootEl.scrollTop;
    this._scrollLeft = rootEl.scrollLeft;
  }

  /**
   * Restore saved scroll position to an HTMLElement.
   * Writes saved scrollTop and scrollLeft to the element.
   */
  restorePosition(rootEl: HTMLElement): void {
    rootEl.scrollTop = this._scrollTop;
    rootEl.scrollLeft = this._scrollLeft;
  }

  // ---------------------------------------------------------------------------
  // Zoom level
  // ---------------------------------------------------------------------------

  /**
   * Current zoom level, clamped to [ZOOM_MIN, ZOOM_MAX].
   */
  get zoomLevel(): number {
    return this._zoomLevel;
  }

  /**
   * Set zoom level. Value is clamped to [ZOOM_MIN, ZOOM_MAX].
   */
  set zoomLevel(value: number) {
    this._zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, value));
  }

  // ---------------------------------------------------------------------------
  // Axis coordinates
  // ---------------------------------------------------------------------------

  /**
   * Store axis coordinates for cross-view scroll restoration.
   *
   * @param rowValues - Current row axis distinct values (string array)
   * @param colValues - Current column axis distinct values (string array)
   * @param anchorCard - Optional card ID to anchor scroll position to
   */
  setAxisCoordinates(
    rowValues: string[],
    colValues: string[],
    anchorCard?: string | null
  ): void {
    this._rowValues = [...rowValues];
    this._colValues = [...colValues];
    this._scrollAnchorCard = anchorCard ?? null;
  }

  /**
   * Get all coordinates as a snapshot object.
   * Returns defensive copies of array state to prevent mutation.
   */
  getCoordinates(): {
    scrollTop: number;
    scrollLeft: number;
    rowValues: string[];
    colValues: string[];
    scrollAnchorCard: string | null;
  } {
    return {
      scrollTop: this._scrollTop,
      scrollLeft: this._scrollLeft,
      rowValues: [...this._rowValues],
      colValues: [...this._colValues],
      scrollAnchorCard: this._scrollAnchorCard,
    };
  }

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  /**
   * Reset scroll position and axis coordinates to defaults.
   *
   * PRESERVES zoomLevel — zoom is a view preference that outlives individual
   * grid sessions (e.g., filter changes reset scroll but keep zoom level).
   */
  reset(): void {
    this._scrollTop = 0;
    this._scrollLeft = 0;
    this._rowValues = [];
    this._colValues = [];
    this._scrollAnchorCard = null;
    // Note: _zoomLevel is intentionally NOT reset here
  }
}
