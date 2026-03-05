// @vitest-environment jsdom
// tests/views/supergrid/SuperGridSelect.test.ts
// Unit tests for SuperGridSelect SVG lasso overlay and classifyClickZone pure function.
// Requirements: SLCT-04, SLCT-06

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SuperGridSelect, classifyClickZone } from '../../../src/views/supergrid/SuperGridSelect';
import type { SuperGridBBoxCache } from '../../../src/views/supergrid/SuperGridBBoxCache';
import type { SuperGridSelectionLike } from '../../../src/views/types';

// ---------------------------------------------------------------------------
// Helpers: mock bboxCache and mock selection
// ---------------------------------------------------------------------------

function makeMockBBoxCache(): SuperGridBBoxCache {
  return {
    hitTest: vi.fn().mockReturnValue([]),
    getRect: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    scheduleSnapshot: vi.fn(),
  } as unknown as SuperGridBBoxCache;
}

function makeMockSelection(): SuperGridSelectionLike {
  return {
    select: vi.fn(),
    addToSelection: vi.fn(),
    clear: vi.fn(),
    isSelectedCell: vi.fn().mockReturnValue(false),
    isCardSelected: vi.fn().mockReturnValue(false),
    getSelectedCount: vi.fn().mockReturnValue(0),
    subscribe: vi.fn().mockReturnValue(() => {}),
  };
}

// ---------------------------------------------------------------------------
// classifyClickZone — pure function tests
// ---------------------------------------------------------------------------

describe('classifyClickZone', () => {
  it('returns "grid" for null target', () => {
    expect(classifyClickZone(null)).toBe('grid');
  });

  it('returns "header" for element inside .col-header', () => {
    const colHeader = document.createElement('div');
    colHeader.className = 'col-header';
    const child = document.createElement('span');
    colHeader.appendChild(child);
    document.body.appendChild(colHeader);

    expect(classifyClickZone(child)).toBe('header');

    document.body.removeChild(colHeader);
  });

  it('returns "header" for element inside .row-header', () => {
    const rowHeader = document.createElement('div');
    rowHeader.className = 'row-header';
    const child = document.createElement('span');
    rowHeader.appendChild(child);
    document.body.appendChild(rowHeader);

    expect(classifyClickZone(child)).toBe('header');

    document.body.removeChild(rowHeader);
  });

  it('returns "header" for the .col-header element itself', () => {
    const colHeader = document.createElement('div');
    colHeader.className = 'col-header';
    document.body.appendChild(colHeader);

    expect(classifyClickZone(colHeader)).toBe('header');

    document.body.removeChild(colHeader);
  });

  it('returns "supergrid-card" for element inside .supergrid-card', () => {
    const card = document.createElement('div');
    card.className = 'supergrid-card';
    const inner = document.createElement('p');
    card.appendChild(inner);
    document.body.appendChild(card);

    expect(classifyClickZone(inner)).toBe('supergrid-card');

    document.body.removeChild(card);
  });

  it('returns "data-cell" for element inside .data-cell', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    const inner = document.createElement('span');
    cell.appendChild(inner);
    document.body.appendChild(cell);

    expect(classifyClickZone(inner)).toBe('data-cell');

    document.body.removeChild(cell);
  });

  it('returns "data-cell" for the .data-cell element itself', () => {
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    document.body.appendChild(cell);

    expect(classifyClickZone(cell)).toBe('data-cell');

    document.body.removeChild(cell);
  });

  it('returns "grid" for element not matching any zone', () => {
    const div = document.createElement('div');
    div.className = 'some-other-class';
    document.body.appendChild(div);

    expect(classifyClickZone(div)).toBe('grid');

    document.body.removeChild(div);
  });

  it('returns "supergrid-card" before "data-cell" when card is inside data-cell (card takes priority)', () => {
    // supergrid-card inside data-cell: closest('.supergrid-card') wins
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    const card = document.createElement('div');
    card.className = 'supergrid-card';
    const inner = document.createElement('span');
    card.appendChild(inner);
    cell.appendChild(card);
    document.body.appendChild(cell);

    expect(classifyClickZone(inner)).toBe('supergrid-card');

    document.body.removeChild(cell);
  });

  it('returns "header" before "data-cell" when data-cell is inside col-header', () => {
    const colHeader = document.createElement('div');
    colHeader.className = 'col-header';
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    colHeader.appendChild(cell);
    document.body.appendChild(colHeader);

    expect(classifyClickZone(cell)).toBe('header');

    document.body.removeChild(colHeader);
  });
});

// ---------------------------------------------------------------------------
// SuperGridSelect — lifecycle tests (attach/detach)
// ---------------------------------------------------------------------------

describe('SuperGridSelect lifecycle', () => {
  let rootEl: HTMLElement;
  let gridEl: HTMLElement;
  let bboxCache: SuperGridBBoxCache;
  let selection: SuperGridSelectionLike;
  let superGridSelect: SuperGridSelect;

  beforeEach(() => {
    rootEl = document.createElement('div');
    gridEl = document.createElement('div');
    document.body.appendChild(rootEl);
    document.body.appendChild(gridEl);
    bboxCache = makeMockBBoxCache();
    selection = makeMockSelection();
    superGridSelect = new SuperGridSelect();

    // jsdom doesn't implement setPointerCapture/releasePointerCapture — define them
    rootEl.setPointerCapture = vi.fn();
    rootEl.releasePointerCapture = vi.fn();

    // Mock getBoundingClientRect on rootEl
    vi.spyOn(rootEl, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 800, 600)
    );
  });

  afterEach(() => {
    superGridSelect.detach();
    if (rootEl.parentNode) document.body.removeChild(rootEl);
    if (gridEl.parentNode) document.body.removeChild(gridEl);
    vi.restoreAllMocks();
  });

  it('attach() creates an SVG element as a child of rootEl', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svgs = rootEl.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
  });

  it('attach() SVG has position absolute style', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    expect(svg.style.position).toBe('absolute');
  });

  it('attach() SVG has inset:0 style (via top/left/right/bottom or inset)', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    // Either inset:0 or top:0+left:0+right:0+bottom:0
    const hasInset =
      svg.style.inset === '0' ||
      svg.style.inset === '0px' ||
      (svg.style.top === '0px' && svg.style.left === '0px');
    expect(hasInset).toBe(true);
  });

  it('attach() SVG has pointer-events: none initially', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    expect(svg.style.pointerEvents).toBe('none');
  });

  it('attach() SVG has z-index 5', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    expect(svg.style.zIndex).toBe('5');
  });

  it('attach() SVG contains a rect child element', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    const rect = svg.querySelector('rect');
    expect(rect).not.toBeNull();
  });

  it('attach() rect is initially hidden (display:none)', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).toBe('none');
  });

  it('detach() removes SVG from rootEl', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    expect(rootEl.querySelector('svg')).not.toBeNull();

    superGridSelect.detach();
    expect(rootEl.querySelector('svg')).toBeNull();
  });

  it('after detach(), rootEl has no SVG children', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    superGridSelect.detach();

    const svgs = rootEl.querySelectorAll('svg');
    expect(svgs.length).toBe(0);
  });

  it('SVG is created with SVG namespace (createElementNS)', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
  });
});

// ---------------------------------------------------------------------------
// SuperGridSelect — lasso interaction tests
// ---------------------------------------------------------------------------

describe('SuperGridSelect lasso interactions', () => {
  let rootEl: HTMLElement;
  let gridEl: HTMLElement;
  let bboxCache: SuperGridBBoxCache;
  let selection: SuperGridSelectionLike;
  let superGridSelect: SuperGridSelect;
  let rootRect: DOMRect;

  beforeEach(() => {
    rootEl = document.createElement('div');
    rootEl.className = 'supergrid-root';
    gridEl = document.createElement('div');
    document.body.appendChild(rootEl);
    document.body.appendChild(gridEl);

    bboxCache = makeMockBBoxCache();
    selection = makeMockSelection();
    superGridSelect = new SuperGridSelect();

    rootRect = new DOMRect(100, 50, 800, 600);
    // jsdom doesn't implement setPointerCapture/releasePointerCapture — define them
    rootEl.setPointerCapture = vi.fn();
    rootEl.releasePointerCapture = vi.fn();
    vi.spyOn(rootEl, 'getBoundingClientRect').mockReturnValue(rootRect);

    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
  });

  afterEach(() => {
    superGridSelect.detach();
    if (rootEl.parentNode) document.body.removeChild(rootEl);
    if (gridEl.parentNode) document.body.removeChild(gridEl);
    vi.restoreAllMocks();
  });

  // Helper: fire a pointer event on a target inside rootEl
  function firePointerDown(target: Element, x: number, y: number, metaKey = false): void {
    const event = new PointerEvent('pointerdown', {
      clientX: x,
      clientY: y,
      pointerId: 1,
      metaKey,
      bubbles: true,
    });
    target.dispatchEvent(event);
  }

  function firePointerMove(x: number, y: number): void {
    const event = new PointerEvent('pointermove', {
      clientX: x,
      clientY: y,
      pointerId: 1,
      bubbles: true,
    });
    rootEl.dispatchEvent(event);
  }

  function firePointerUp(x: number, y: number, metaKey = false): void {
    const event = new PointerEvent('pointerup', {
      clientX: x,
      clientY: y,
      pointerId: 1,
      metaKey,
      bubbles: true,
    });
    rootEl.dispatchEvent(event);
  }

  function firePointerCancel(): void {
    const event = new PointerEvent('pointercancel', {
      pointerId: 1,
      bubbles: true,
    });
    rootEl.dispatchEvent(event);
  }

  it('pointerdown on data-cell zone starts drag state (anchor recorded)', () => {
    // Create a data-cell and fire pointerdown on it
    const cell = document.createElement('div');
    cell.className = 'data-cell';
    rootEl.appendChild(cell);

    firePointerDown(cell, 200, 150);

    // Move enough to trigger lasso
    firePointerMove(210, 160);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    // After 10px move, drag should have started (threshold = 4px)
    expect(rect.style.display).not.toBe('none');
  });

  it('pointerdown on grid zone (rootEl) starts drag state', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(210, 160);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).not.toBe('none');
  });

  it('pointerdown on header zone does NOT start drag (no SVG rect visible)', () => {
    const header = document.createElement('div');
    header.className = 'col-header';
    rootEl.appendChild(header);

    firePointerDown(header, 200, 150);

    // Move enough to normally trigger drag
    firePointerMove(220, 170);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).toBe('none');
  });

  it('drag below 4px threshold does NOT show lasso rect', () => {
    firePointerDown(rootEl, 200, 150);

    // Only 3px move — below threshold
    firePointerMove(202, 152);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).toBe('none');
  });

  it('drag above 4px threshold shows lasso rect', () => {
    firePointerDown(rootEl, 200, 150);

    // 10px move — above threshold
    firePointerMove(210, 160);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).not.toBe('none');
  });

  it('pointermove updates SVG rect attributes (x, y, width, height)', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(230, 180);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).not.toBe('none');
    // Rect should have some dimensions set
    const width = parseFloat(rect.getAttribute('width') ?? '0');
    const height = parseFloat(rect.getAttribute('height') ?? '0');
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
  });

  it('pointermove calls bboxCache.hitTest with the computed lasso rectangle', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);

    expect(bboxCache.hitTest).toHaveBeenCalled();
  });

  it('pointerup without metaKey calls selection.select(cardIds)', () => {
    const cellKeys = ['row1:col1', 'row1:col2'];
    (bboxCache.hitTest as ReturnType<typeof vi.fn>).mockReturnValue(cellKeys);
    const getCellCardIds = vi.fn().mockImplementation((key: string) =>
      key === 'row1:col1' ? ['card-a'] : ['card-b']
    );

    superGridSelect.detach();
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, getCellCardIds);

    firePointerDown(rootEl, 200, 150);
    firePointerMove(300, 250);
    firePointerUp(300, 250, false);

    expect(selection.select).toHaveBeenCalledWith(expect.arrayContaining(['card-a', 'card-b']));
    expect(selection.addToSelection).not.toHaveBeenCalled();
  });

  it('pointerup with metaKey calls selection.addToSelection(cardIds)', () => {
    const cellKeys = ['row1:col1'];
    (bboxCache.hitTest as ReturnType<typeof vi.fn>).mockReturnValue(cellKeys);
    const getCellCardIds = vi.fn().mockImplementation((_key: string) => ['card-a']);

    superGridSelect.detach();
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, getCellCardIds);

    firePointerDown(rootEl, 200, 150, true);
    firePointerMove(300, 250);
    firePointerUp(300, 250, true);

    expect(selection.addToSelection).toHaveBeenCalledWith(expect.arrayContaining(['card-a']));
    expect(selection.select).not.toHaveBeenCalled();
  });

  it('pointerup hides SVG rect (display:none) after drag', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).not.toBe('none');

    firePointerUp(250, 200);
    expect(rect.style.display).toBe('none');
  });

  it('pointerup sets SVG pointer-events back to none', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);
    firePointerUp(250, 200);

    const svg = rootEl.querySelector('svg') as SVGSVGElement;
    expect(svg.style.pointerEvents).toBe('none');
  });

  it('pointercancel hides SVG rect and resets drag state', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);

    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.style.display).not.toBe('none');

    firePointerCancel();
    expect(rect.style.display).toBe('none');
  });

  it('pointercancel does NOT call selection.select or addToSelection', () => {
    (bboxCache.hitTest as ReturnType<typeof vi.fn>).mockReturnValue(['row1:col1']);

    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);
    firePointerCancel();

    expect(selection.select).not.toHaveBeenCalled();
    expect(selection.addToSelection).not.toHaveBeenCalled();
  });

  it('drag < 4px distance is ignored — no selection call', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(202, 152); // < 4px
    firePointerUp(202, 152);

    expect(selection.select).not.toHaveBeenCalled();
    expect(selection.addToSelection).not.toHaveBeenCalled();
  });

  it('setPointerCapture is called on pointerdown', () => {
    firePointerDown(rootEl, 200, 150);
    expect(rootEl.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('releasePointerCapture is called on pointerup', () => {
    firePointerDown(rootEl, 200, 150);
    firePointerMove(250, 200);
    firePointerUp(250, 200);
    expect(rootEl.releasePointerCapture).toHaveBeenCalledWith(1);
  });

  it('SVG rect visual style: fill is rgba(26, 86, 240, 0.08)', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.getAttribute('fill')).toBe('rgba(26, 86, 240, 0.08)');
  });

  it('SVG rect visual style: stroke is #1a56f0', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.getAttribute('stroke')).toBe('#1a56f0');
  });

  it('SVG rect visual style: stroke-dasharray is "4 3"', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.getAttribute('stroke-dasharray')).toBe('4 3');
  });

  it('SVG rect visual style: stroke-width is "1.5"', () => {
    superGridSelect.attach(rootEl, gridEl, bboxCache, selection, () => []);
    const rect = rootEl.querySelector('svg rect') as SVGRectElement;
    expect(rect.getAttribute('stroke-width')).toBe('1.5');
  });
});
