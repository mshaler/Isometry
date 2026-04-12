// Isometry v5 — Phase 148 Plan 01
// MinimapRenderer: draws simplified SVG thumbnails into dock item placeholder divs.
//
// Requirements: MMAP-01, MMAP-02, MMAP-04
//
// Design:
//   - renderMinimap(thumbEl, viewKey, cards, pafvAxes) — creates/reuses a 96x48 SVG
//   - clearMinimap(thumbEl) — removes the SVG from the container
//   - Only the 4 'visualize' section items produce output: supergrid, timeline, network, tree
//   - PAFV caption bar at bottom 14px shows axis glyph + field name pairs
//   - Card type hue mapping: note=210, bookmark=30, task=120, contact=280, event=60

import type { CardDatum } from '../views/types';
import type { AxisMapping } from '../providers/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PafvAxes {
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SVG_W = 96;
const SVG_H = 48;
const SKETCH_H = 34; // top area for sketch content, leaving bottom 14px for caption
const CAPTION_Y = 34;
const CAPTION_H = 14;
const MINIMAP_CLASS = 'minimap-svg';
const NS = 'http://www.w3.org/2000/svg';

/** Only these 4 view keys (from DOCK_DEFS 'visualize' section) produce minimap output. */
const VIZ_KEYS = new Set(['supergrid', 'timeline', 'network', 'tree']);

/** Card type hue values for fill colors. */
const TYPE_HUES: Record<string, number> = {
  note: 210,
  bookmark: 30,
  task: 120,
  contact: 280,
  event: 60,
};

function cardHue(card: CardDatum): number {
  return TYPE_HUES[card.card_type] ?? 210;
}

function hsl(hue: number, s = 60, l = 50): string {
  return `hsl(${hue}, ${s}%, ${l}%)`;
}

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function svgEl(tag: string): SVGElement {
  return document.createElementNS(NS, tag) as SVGElement;
}

function rect(x: number, y: number, w: number, h: number, fill: string): SVGRectElement {
  const r = svgEl('rect') as SVGRectElement;
  r.setAttribute('x', String(x));
  r.setAttribute('y', String(y));
  r.setAttribute('width', String(w));
  r.setAttribute('height', String(h));
  r.setAttribute('fill', fill);
  return r;
}

// ---------------------------------------------------------------------------
// Sketch functions — one per visualization view key
// ---------------------------------------------------------------------------

function _sketchGrid(svg: SVGSVGElement, cards: CardDatum[]): void {
  const COLS = 6;
  const ROWS = 3;
  const cellW = 14;
  const cellH = 9;
  const gap = 1;
  const startX = 2;
  const startY = 2;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const card = cards[(row * COLS + col) % Math.max(cards.length, 1)];
      const hue = card ? cardHue(card) : 210;
      const r = rect(
        startX + col * (cellW + gap),
        startY + row * (cellH + gap),
        cellW,
        cellH,
        hsl(hue, 55, 45)
      );
      svg.appendChild(r);
    }
  }
}

function _sketchTimeline(svg: SVGSVGElement, cards: CardDatum[]): void {
  const maxBars = 8;
  const barH = 3;
  const gap = 1;
  const startY = 3;
  const slice = cards.slice(0, maxBars);
  slice.forEach((card, i) => {
    // Width varies deterministically by card index: 20-80px range
    const w = 20 + ((i * 7 + 30) % 61);
    const r = rect(4, startY + i * (barH + gap), w, barH, hsl(cardHue(card), 60, 48));
    svg.appendChild(r);
  });
  // Fill remaining rows with neutral bars if fewer cards than maxBars
  for (let i = slice.length; i < maxBars; i++) {
    const w = 20 + ((i * 7 + 30) % 61);
    const r = rect(4, startY + i * (barH + gap), w, barH, 'var(--border-subtle)');
    svg.appendChild(r);
  }
}

/** Simple deterministic hash from a string to a number in [0, max). */
function _strHash(s: string, max: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h % max;
}

function _sketchNetwork(svg: SVGSVGElement, cards: CardDatum[]): void {
  const maxNodes = 20;
  const slice = cards.slice(0, maxNodes);
  // Positions for circles
  const positions: Array<{ x: number; y: number }> = slice.map(card => ({
    x: 4 + _strHash(card.id, SVG_W - 8),
    y: 4 + _strHash(card.id + '1', SKETCH_H - 8),
  }));

  // Draw a few connecting lines between adjacent positions
  for (let i = 0; i + 1 < positions.length && i < 8; i++) {
    const line = svgEl('line') as SVGLineElement;
    line.setAttribute('x1', String(positions[i]!.x));
    line.setAttribute('y1', String(positions[i]!.y));
    line.setAttribute('x2', String(positions[i + 1]!.x));
    line.setAttribute('y2', String(positions[i + 1]!.y));
    line.setAttribute('stroke', 'var(--border-subtle)');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
  }

  // Draw circles on top
  slice.forEach((card, i) => {
    const pos = positions[i]!;
    const circle = svgEl('circle') as SVGCircleElement;
    circle.setAttribute('cx', String(pos.x));
    circle.setAttribute('cy', String(pos.y));
    circle.setAttribute('r', '3');
    circle.setAttribute('fill', hsl(cardHue(card), 60, 50));
    svg.appendChild(circle);
  });
}

function _sketchTree(svg: SVGSVGElement, cards: CardDatum[]): void {
  // Root node at (10, 8), fan out to 3-4 children at y=22
  const rootX = 10;
  const rootY = 8;
  const childY = 22;
  const childXs = [20, 38, 56, 74];
  const numChildren = Math.min(4, Math.max(1, cards.length));

  // Draw lines root -> children
  for (let i = 0; i < numChildren; i++) {
    const line = svgEl('line') as SVGLineElement;
    line.setAttribute('x1', String(rootX));
    line.setAttribute('y1', String(rootY));
    line.setAttribute('x2', String(childXs[i]));
    line.setAttribute('y2', String(childY));
    line.setAttribute('stroke', 'var(--border-subtle)');
    line.setAttribute('stroke-width', '0.5');
    svg.appendChild(line);
  }

  // Root circle
  const rootHue = cards[0] ? cardHue(cards[0]) : 210;
  const rootCircle = svgEl('circle') as SVGCircleElement;
  rootCircle.setAttribute('cx', String(rootX));
  rootCircle.setAttribute('cy', String(rootY));
  rootCircle.setAttribute('r', '3');
  rootCircle.setAttribute('fill', hsl(rootHue, 65, 52));
  svg.appendChild(rootCircle);

  // Child circles
  for (let i = 0; i < numChildren; i++) {
    const card = cards[i + 1] ?? cards[0];
    const hue = card ? cardHue(card) : 210;
    const c = svgEl('circle') as SVGCircleElement;
    c.setAttribute('cx', String(childXs[i]));
    c.setAttribute('cy', String(childY));
    c.setAttribute('r', '3');
    c.setAttribute('fill', hsl(hue, 60, 48));
    svg.appendChild(c);
  }
}

// ---------------------------------------------------------------------------
// Caption bar
// ---------------------------------------------------------------------------

function _renderCaptionBar(svg: SVGSVGElement, viewKey: string, axes: PafvAxes): void {
  const g = svgEl('g') as SVGGElement;
  g.setAttribute('class', 'minimap-caption');

  // Background rect
  const bg = rect(0, CAPTION_Y, SVG_W, CAPTION_H, 'var(--bg-surface)');
  bg.setAttribute('opacity', '0.85');
  g.appendChild(bg);

  // Determine which 2 axis pairs to show (fit in 96px, ~24px per pair, max 2 pairs)
  // For supergrid: rowAxes[0] as P, colAxes[0] as A
  // For others: xAxis as P, yAxis as A
  let pAxis: AxisMapping | null;
  let aAxis: AxisMapping | null;

  if (viewKey === 'supergrid') {
    pAxis = axes.rowAxes[0] ?? null;
    aAxis = axes.colAxes[0] ?? null;
  } else {
    pAxis = axes.xAxis;
    aAxis = axes.yAxis;
  }

  const pairs: Array<{ glyph: string; axis: AxisMapping | null }> = [
    { glyph: 'P', axis: pAxis },
    { glyph: 'A', axis: aAxis },
  ];

  const pairW = 48; // 96px / 2 pairs
  const textY = CAPTION_Y + 10; // vertical center of 14px caption

  pairs.forEach(({ glyph, axis }, i) => {
    const xBase = i * pairW + 2;
    const fieldName = axis?.field ?? '\u2014';

    // Glyph
    const glyphEl = svgEl('text') as SVGTextElement;
    glyphEl.setAttribute('x', String(xBase));
    glyphEl.setAttribute('y', String(textY));
    glyphEl.setAttribute('font-size', '8');
    glyphEl.setAttribute('font-weight', '600');
    glyphEl.setAttribute('fill', 'var(--accent)');
    glyphEl.textContent = glyph;
    g.appendChild(glyphEl);

    // Field name — truncated via textLength
    const fieldEl = svgEl('text') as SVGTextElement;
    fieldEl.setAttribute('x', String(xBase + 9));
    fieldEl.setAttribute('y', String(textY));
    fieldEl.setAttribute('font-size', '8');
    fieldEl.setAttribute('fill', 'var(--text-muted)');
    fieldEl.setAttribute('textLength', '36');
    fieldEl.setAttribute('lengthAdjust', 'spacing');
    fieldEl.textContent = fieldName;
    g.appendChild(fieldEl);
  });

  svg.appendChild(g);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a 96x48 minimap SVG thumbnail into thumbEl for the given viewKey.
 * Bails out early for non-visualization view keys.
 * Reuses existing .minimap-svg element if present (no duplicates).
 */
export function renderMinimap(
  thumbEl: HTMLElement,
  viewKey: string,
  cards: CardDatum[],
  pafvAxes: PafvAxes
): void {
  if (!VIZ_KEYS.has(viewKey)) return;

  // Reuse or create SVG element
  let svg = thumbEl.querySelector<SVGSVGElement>(`.${MINIMAP_CLASS}`);
  if (!svg) {
    svg = document.createElementNS(NS, 'svg') as SVGSVGElement;
    svg.setAttribute('class', MINIMAP_CLASS);
    svg.setAttribute('width', String(SVG_W));
    svg.setAttribute('height', String(SVG_H));
    svg.setAttribute('aria-hidden', 'true');
    thumbEl.appendChild(svg);
  }

  // Clear existing children for re-render
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  // Background rect
  svg.appendChild(rect(0, 0, SVG_W, SVG_H, 'var(--bg-primary)'));

  // Dispatch to per-view sketch function
  switch (viewKey) {
    case 'supergrid':
      _sketchGrid(svg, cards);
      break;
    case 'timeline':
      _sketchTimeline(svg, cards);
      break;
    case 'network':
      _sketchNetwork(svg, cards);
      break;
    case 'tree':
      _sketchTree(svg, cards);
      break;
  }

  // PAFV caption bar at bottom
  _renderCaptionBar(svg, viewKey, pafvAxes);
}

/**
 * Remove the .minimap-svg element from thumbEl if present.
 */
export function clearMinimap(thumbEl: HTMLElement): void {
  const svg = thumbEl.querySelector(`.${MINIMAP_CLASS}`);
  if (svg) thumbEl.removeChild(svg);
}

// ---------------------------------------------------------------------------
// Loupe overlay
// ---------------------------------------------------------------------------

/**
 * Render an inverted dimming loupe overlay on the minimap SVG inside thumbEl.
 * viewportRect values are 0-1 normalized coordinates (0,0 = top-left, 1,1 = bottom-right).
 * Removes any existing .minimap-loupe group before creating a new one.
 */
export function renderLoupe(
  thumbEl: HTMLElement,
  viewportRect: { x: number; y: number; w: number; h: number }
): void {
  const svg = thumbEl.querySelector<SVGSVGElement>(`.${MINIMAP_CLASS}`);
  if (!svg) return;

  // Remove existing loupe group
  const existing = svg.querySelector('.minimap-loupe');
  if (existing) svg.removeChild(existing);

  // Convert normalized 0-1 coords to SVG pixels (clamped to SVG bounds)
  const px = Math.max(0, Math.min(viewportRect.x * SVG_W, SVG_W));
  const py = Math.max(0, Math.min(viewportRect.y * SVG_H, SVG_H));
  const pw = Math.max(0, Math.min(viewportRect.w * SVG_W, SVG_W - px));
  const ph = Math.max(0, Math.min(viewportRect.h * SVG_H, SVG_H - py));

  const g = svgEl('g') as SVGGElement;
  g.setAttribute('class', 'minimap-loupe');

  // 4 dimming rects (inverted dimming — dark outside viewport area)
  // Top
  g.appendChild(rect(0, 0, SVG_W, py, 'var(--overlay-bg)'));
  // Bottom
  g.appendChild(rect(0, py + ph, SVG_W, SVG_H - (py + ph), 'var(--overlay-bg)'));
  // Left
  g.appendChild(rect(0, py, px, ph, 'var(--overlay-bg)'));
  // Right
  g.appendChild(rect(px + pw, py, SVG_W - (px + pw), ph, 'var(--overlay-bg)'));

  // Viewport outline rect
  const outline = svgEl('rect') as SVGRectElement;
  outline.setAttribute('x', String(px));
  outline.setAttribute('y', String(py));
  outline.setAttribute('width', String(pw));
  outline.setAttribute('height', String(ph));
  outline.setAttribute('fill', 'none');
  outline.setAttribute('stroke', 'var(--accent)');
  outline.setAttribute('stroke-width', '2');
  outline.setAttribute('rx', '1');
  g.appendChild(outline);

  svg.appendChild(g);
  (svg as SVGSVGElement & { style: CSSStyleDeclaration }).style.cursor = 'crosshair';
}

/**
 * Attach pointer interaction (click-to-jump, drag-to-pan) to the minimap SVG inside thumbEl.
 * onNavigate is called with normalized (0-1) x/y coordinates on click or drag.
 * Returns a cleanup function that removes all event listeners.
 */
export function attachLoupeInteraction(
  thumbEl: HTMLElement,
  onNavigate: (normX: number, normY: number) => void
): () => void {
  const svg = thumbEl.querySelector<SVGSVGElement>(`.${MINIMAP_CLASS}`);
  if (!svg) return () => undefined;

  let dragging = false;
  let dragMoved = false;
  let startX = 0;
  let startY = 0;

  const onPointerDown = (e: PointerEvent) => {
    svg.setPointerCapture(e.pointerId);
    (svg as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'grabbing';
    dragging = true;
    dragMoved = false;
    startX = e.offsetX;
    startY = e.offsetY;
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.offsetX - startX;
    const dy = e.offsetY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    const normX = Math.max(0, Math.min(e.offsetX / SVG_W, 1));
    const normY = Math.max(0, Math.min(e.offsetY / SVG_H, 1));
    onNavigate(normX, normY);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!dragging) return;
    svg.releasePointerCapture(e.pointerId);
    (svg as SVGElement & { style: CSSStyleDeclaration }).style.cursor = 'crosshair';
    dragging = false;
  };

  const onClick = (e: MouseEvent) => {
    if (dragMoved) return;
    const normX = Math.max(0, Math.min(e.offsetX / SVG_W, 1));
    const normY = Math.max(0, Math.min(e.offsetY / SVG_H, 1));
    onNavigate(normX, normY);
  };

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('click', onClick);

  return () => {
    svg.removeEventListener('pointerdown', onPointerDown);
    svg.removeEventListener('pointermove', onPointerMove);
    svg.removeEventListener('pointerup', onPointerUp);
    svg.removeEventListener('click', onClick);
  };
}
