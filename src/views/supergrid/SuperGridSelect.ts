// Isometry v5 — Phase 21 SuperSelect
// SuperGridSelect: SVG lasso overlay with pointer event handling and z-axis click zone discriminator.
//
// Design:
//   - classifyClickZone() is a pure function that walks the DOM tree upward to classify click targets
//   - SuperGridSelect.attach() creates an SVG overlay, wires pointer events for lasso dragging
//   - hitTest() is delegated to BBoxCache (reads from Map, never from DOM during drag)
//   - Cmd+lasso adds to existing selection; plain lasso replaces
//   - Drag threshold of 4px prevents accidental lasso on clicks
//
// Requirements: SLCT-04, SLCT-06

import type { SuperGridBBoxCache } from './SuperGridBBoxCache';
import type { SuperGridSelectionLike } from '../types';

// ---------------------------------------------------------------------------
// ClickZone type
// ---------------------------------------------------------------------------

export type ClickZone = 'header' | 'data-cell' | 'supergrid-card' | 'grid';

// ---------------------------------------------------------------------------
// classifyClickZone — pure function
// ---------------------------------------------------------------------------

/**
 * Classify the z-axis click zone for an event target by walking the DOM upward.
 *
 * Priority order (first match wins):
 *   1. header  — inside .col-header or .row-header
 *   2. supergrid-card — inside .supergrid-card (Phase 27 placeholder)
 *   3. data-cell — inside .data-cell
 *   4. grid — anything else (including null target)
 *
 * Pure function: no side effects, no state.
 */
export function classifyClickZone(target: EventTarget | null): ClickZone {
  const el = target instanceof Element ? target : null;
  if (!el) return 'grid';

  if (el.closest('.col-header') || el.closest('.row-header')) return 'header';
  if (el.closest('.supergrid-card')) return 'supergrid-card';
  if (el.closest('.data-cell')) return 'data-cell';

  return 'grid';
}

// ---------------------------------------------------------------------------
// SuperGridSelect class
// ---------------------------------------------------------------------------

/**
 * SVG lasso overlay for rubber-band selection in SuperGrid.
 *
 * Usage:
 *   1. const sel = new SuperGridSelect()
 *   2. sel.attach(rootEl, gridEl, bboxCache, selection, getCellCardIds) — call in SuperGrid.mount()
 *   3. sel.detach() — call in SuperGrid.destroy()
 *
 * The lasso only activates on 'data-cell' or 'grid' zones (not on headers or resize handles).
 * Drag threshold of 4px prevents accidental lasso activation on clicks.
 */
export class SuperGridSelect {
  // SVG elements
  private _svg: SVGSVGElement | null = null;
  private _rect: SVGRectElement | null = null;

  // DOM references
  private _rootEl: HTMLElement | null = null;

  // Dependencies
  private _bboxCache: SuperGridBBoxCache | null = null;
  private _selection: SuperGridSelectionLike | null = null;
  private _getCellCardIds: ((cellKey: string) => string[]) | null = null;

  // Drag state
  private _anchorX = 0;
  private _anchorY = 0;
  private _isDragging = false;
  private _hasAnchor = false;

  // Bound event handlers (stored for removeEventListener)
  private _onPointerDown: ((e: PointerEvent) => void) | null = null;
  private _onPointerMove: ((e: PointerEvent) => void) | null = null;
  private _onPointerUp: ((e: PointerEvent) => void) | null = null;
  private _onPointerCancel: ((e: PointerEvent) => void) | null = null;

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Attach the lasso overlay to the given root element.
   *
   * @param rootEl         The SuperGrid scroll container (captures pointer events)
   * @param gridEl         The inner grid element (unused directly; reserved for future use)
   * @param bboxCache      Hit-test cache from Plan 21-01
   * @param selection      Selection adapter from Plan 21-03
   * @param getCellCardIds Callback: cellKey → card IDs (from SuperGrid._lastCells)
   */
  attach(
    rootEl: HTMLElement,
    _gridEl: HTMLElement,
    bboxCache: SuperGridBBoxCache,
    selection: SuperGridSelectionLike,
    getCellCardIds: (cellKey: string) => string[]
  ): void {
    this._rootEl = rootEl;
    this._bboxCache = bboxCache;
    this._selection = selection;
    this._getCellCardIds = getCellCardIds;

    // Create SVG overlay
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';
    svg.style.zIndex = '5';
    this._svg = svg;

    // Create lasso rect (initially hidden)
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('fill', 'rgba(26, 86, 240, 0.08)');
    rect.setAttribute('stroke', '#1a56f0');
    rect.setAttribute('stroke-dasharray', '4 3');
    rect.setAttribute('stroke-width', '1.5');
    rect.style.display = 'none';
    this._rect = rect;

    svg.appendChild(rect);
    rootEl.appendChild(svg);

    // Wire pointer events
    this._onPointerDown = this._handlePointerDown.bind(this);
    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerUp = this._handlePointerUp.bind(this);
    this._onPointerCancel = this._handlePointerCancel.bind(this);

    rootEl.addEventListener('pointerdown', this._onPointerDown);
    rootEl.addEventListener('pointermove', this._onPointerMove);
    rootEl.addEventListener('pointerup', this._onPointerUp);
    rootEl.addEventListener('pointercancel', this._onPointerCancel);
  }

  /**
   * Remove the lasso overlay and all event listeners.
   * Called in SuperGrid.destroy().
   */
  detach(): void {
    if (this._rootEl) {
      if (this._onPointerDown) this._rootEl.removeEventListener('pointerdown', this._onPointerDown);
      if (this._onPointerMove) this._rootEl.removeEventListener('pointermove', this._onPointerMove);
      if (this._onPointerUp) this._rootEl.removeEventListener('pointerup', this._onPointerUp);
      if (this._onPointerCancel) this._rootEl.removeEventListener('pointercancel', this._onPointerCancel);
    }

    if (this._svg && this._svg.parentNode) {
      this._svg.parentNode.removeChild(this._svg);
    }

    this._svg = null;
    this._rect = null;
    this._rootEl = null;
    this._bboxCache = null;
    this._selection = null;
    this._getCellCardIds = null;
    this._onPointerDown = null;
    this._onPointerMove = null;
    this._onPointerUp = null;
    this._onPointerCancel = null;

    this._resetDragState();
  }

  // ---------------------------------------------------------------------------
  // Private: pointer event handlers
  // ---------------------------------------------------------------------------

  private _handlePointerDown(e: PointerEvent): void {
    const zone = classifyClickZone(e.target);

    // Only start lasso on data-cell or grid background
    if (zone === 'header' || zone === 'supergrid-card') return;

    e.preventDefault();

    if (this._rootEl) {
      this._rootEl.setPointerCapture(e.pointerId);
    }

    this._anchorX = e.clientX;
    this._anchorY = e.clientY;
    this._hasAnchor = true;
    this._isDragging = false;
  }

  private _handlePointerMove(e: PointerEvent): void {
    if (!this._hasAnchor || !this._rootEl || !this._bboxCache || !this._rect || !this._svg) return;

    const dx = e.clientX - this._anchorX;
    const dy = e.clientY - this._anchorY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Enforce 4px threshold before activating lasso
    if (distance < 4) return;

    if (!this._isDragging) {
      this._isDragging = true;
      this._svg.style.pointerEvents = 'all';
      this._rect.style.display = '';
    }

    // Compute lasso rect in client coordinates
    const x1 = Math.min(this._anchorX, e.clientX);
    const y1 = Math.min(this._anchorY, e.clientY);
    const x2 = Math.max(this._anchorX, e.clientX);
    const y2 = Math.max(this._anchorY, e.clientY);
    const lassoW = x2 - x1;
    const lassoH = y2 - y1;

    // Compute SVG-relative coordinates (relative to rootEl)
    const rootBounds = this._rootEl.getBoundingClientRect();
    const svgX = x1 - rootBounds.left;
    const svgY = y1 - rootBounds.top;

    // Update SVG rect attributes using SVG-relative coordinates
    this._rect.setAttribute('x', String(svgX));
    this._rect.setAttribute('y', String(svgY));
    this._rect.setAttribute('width', String(lassoW));
    this._rect.setAttribute('height', String(lassoH));

    // Hit-test uses client coordinates (BBoxCache stores client coords from getBoundingClientRect)
    this._bboxCache.hitTest({ x: x1, y: y1, w: lassoW, h: lassoH });
  }

  private _handlePointerUp(e: PointerEvent): void {
    if (!this._rootEl) return;

    this._rootEl.releasePointerCapture(e.pointerId);

    if (this._svg) {
      this._svg.style.pointerEvents = 'none';
    }

    if (this._rect) {
      this._rect.style.display = 'none';
    }

    if (this._isDragging && this._bboxCache && this._selection && this._getCellCardIds) {
      // Compute final lasso rect for selection
      const x1 = Math.min(this._anchorX, e.clientX);
      const y1 = Math.min(this._anchorY, e.clientY);
      const x2 = Math.max(this._anchorX, e.clientX);
      const y2 = Math.max(this._anchorY, e.clientY);

      const hitCellKeys = this._bboxCache.hitTest({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

      // Collect card IDs from all hit cells
      const allCardIds: string[] = [];
      for (const cellKey of hitCellKeys) {
        allCardIds.push(...this._getCellCardIds(cellKey));
      }

      if (e.metaKey || e.ctrlKey) {
        this._selection.addToSelection(allCardIds);
      } else {
        this._selection.select(allCardIds);
      }
    }

    this._resetDragState();
  }

  private _handlePointerCancel(_e: PointerEvent): void {
    if (this._svg) {
      this._svg.style.pointerEvents = 'none';
    }

    if (this._rect) {
      this._rect.style.display = 'none';
    }

    // No selection call on cancel
    this._resetDragState();
  }

  // ---------------------------------------------------------------------------
  // Private: helpers
  // ---------------------------------------------------------------------------

  private _resetDragState(): void {
    this._anchorX = 0;
    this._anchorY = 0;
    this._isDragging = false;
    this._hasAnchor = false;
  }
}
