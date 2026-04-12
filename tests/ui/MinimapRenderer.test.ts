// @vitest-environment jsdom
// Isometry v5 — Phase 148 Plan 01
// Tests for MinimapRenderer module

import { describe, it, expect, beforeEach } from 'vitest';
import { renderMinimap, clearMinimap, renderLoupe, attachLoupeInteraction } from '../../src/ui/MinimapRenderer';
import type { CardDatum } from '../../src/views/types';
import type { AxisMapping } from '../../src/providers/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeThumb(): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'dock-nav__item-thumb';
  document.body.appendChild(div);
  return div;
}

function makeCards(n = 5): CardDatum[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    name: `Card ${i}`,
    folder: null,
    status: null,
    card_type: 'note' as const,
    created_at: '2026-01-01T00:00:00Z',
    modified_at: '2026-01-01T00:00:00Z',
    priority: 0,
    sort_order: i,
    due_at: null,
    body_text: null,
    source: null,
  }));
}

function makeAxes(overrides: Partial<{
  xAxis: AxisMapping | null;
  yAxis: AxisMapping | null;
  groupBy: AxisMapping | null;
  colAxes: AxisMapping[];
  rowAxes: AxisMapping[];
}> = {}) {
  return {
    xAxis: null,
    yAxis: null,
    groupBy: null,
    colAxes: [],
    rowAxes: [],
    ...overrides,
  };
}

function makeAxis(field: string): AxisMapping {
  return { field, direction: 'asc' as const };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MinimapRenderer', () => {
  let thumb: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    thumb = makeThumb();
  });

  // Test 1: renderMinimap inserts an SVG element with correct dimensions
  it('inserts SVG with width=96 height=48 into thumb container', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    const svg = thumb.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('96');
    expect(svg!.getAttribute('height')).toBe('48');
  });

  // Test 2: SVG has aria-hidden="true"
  it('sets aria-hidden="true" on the SVG', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    const svg = thumb.querySelector('svg');
    expect(svg!.getAttribute('aria-hidden')).toBe('true');
  });

  // Test 3: Re-renders replace existing SVG content, not append duplicates
  it('replaces existing SVG on re-render without duplicates', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    const svgs = thumb.querySelectorAll('svg');
    expect(svgs.length).toBe(1);
  });

  // Test 4: clearMinimap removes the SVG from the container
  it('clearMinimap removes the SVG element', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    expect(thumb.querySelector('svg')).not.toBeNull();
    clearMinimap(thumb);
    expect(thumb.querySelector('svg')).toBeNull();
  });

  // Test 5: PAFV caption bar group exists at y >= 34
  it('renders PAFV caption bar at y >= 34', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    const svg = thumb.querySelector('svg')!;
    const caption = svg.querySelector('.minimap-caption');
    expect(caption).not.toBeNull();
    // The caption group or its background rect should be at y >= 34
    const rect = caption!.querySelector('rect');
    expect(rect).not.toBeNull();
    const y = parseFloat(rect!.getAttribute('y') ?? '0');
    expect(y).toBeGreaterThanOrEqual(34);
  });

  // Test 6: Non-visualization view keys produce no SVG output
  it.each(['catalog', 'filter', 'stories', 'notebook', 'settings', 'properties'])(
    'does not render SVG for non-visualization key "%s"',
    (viewKey) => {
      renderMinimap(thumb, viewKey, makeCards(), makeAxes());
      expect(thumb.querySelector('svg')).toBeNull();
    }
  );

  // Test 7: Unmapped (null) axis fields render em dash character
  it('renders em dash for unmapped axis fields', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes({ xAxis: null, yAxis: null }));
    const svg = thumb.querySelector('svg')!;
    expect(svg.textContent).toContain('\u2014');
  });

  // Additional: minimap-svg class is applied
  it('applies minimap-svg class to the SVG element', () => {
    renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
    const svg = thumb.querySelector('.minimap-svg');
    expect(svg).not.toBeNull();
  });

  // Additional: timeline view produces SVG
  it('renders SVG for "timeline" view key', () => {
    renderMinimap(thumb, 'timeline', makeCards(), makeAxes());
    expect(thumb.querySelector('svg')).not.toBeNull();
  });

  // Additional: network view produces SVG
  it('renders SVG for "network" view key', () => {
    renderMinimap(thumb, 'network', makeCards(), makeAxes());
    expect(thumb.querySelector('svg')).not.toBeNull();
  });

  // Additional: tree view produces SVG
  it('renders SVG for "tree" view key', () => {
    renderMinimap(thumb, 'tree', makeCards(), makeAxes());
    expect(thumb.querySelector('svg')).not.toBeNull();
  });

  // Additional: axis fields shown when provided
  it('shows axis field name in caption when axes are provided', () => {
    renderMinimap(thumb, 'timeline', makeCards(), makeAxes({
      xAxis: makeAxis('status'),
    }));
    const svg = thumb.querySelector('svg')!;
    expect(svg.textContent).toContain('status');
  });

  // ---------------------------------------------------------------------------
  // Loupe overlay tests
  // ---------------------------------------------------------------------------

  describe('renderLoupe', () => {
    it('creates 4 dimming rects + 1 viewport outline rect (5 total) in loupe group', () => {
      renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
      renderLoupe(thumb, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
      const svg = thumb.querySelector('svg')!;
      const loupe = svg.querySelector('.minimap-loupe');
      expect(loupe).not.toBeNull();
      const rects = loupe!.querySelectorAll('rect');
      expect(rects.length).toBe(5);
    });

    it('sets viewport outline stroke to var(--accent)', () => {
      renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
      renderLoupe(thumb, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
      const svg = thumb.querySelector('svg')!;
      const loupe = svg.querySelector('.minimap-loupe')!;
      const rects = loupe.querySelectorAll('rect');
      // Last rect is the viewport outline
      const outline = rects[rects.length - 1]!;
      expect(outline.getAttribute('stroke')).toBe('var(--accent)');
      expect(outline.getAttribute('fill')).toBe('none');
    });

    it('with full viewport (0,0,1,1) the dimming rects have zero area', () => {
      renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
      renderLoupe(thumb, { x: 0, y: 0, w: 1, h: 1 });
      const svg = thumb.querySelector('svg')!;
      const loupe = svg.querySelector('.minimap-loupe')!;
      const rects = [...loupe.querySelectorAll('rect')];
      // First 4 are dimming rects — each should have zero width or zero height
      const dimmingRects = rects.slice(0, 4);
      for (const r of dimmingRects) {
        const w = parseFloat(r.getAttribute('width') ?? '0');
        const h = parseFloat(r.getAttribute('height') ?? '0');
        expect(w * h).toBe(0);
      }
    });

    it('returns early without SVG (no-op)', () => {
      // thumbEl has no minimap-svg — renderLoupe should not throw
      const emptyThumb = document.createElement('div');
      expect(() => renderLoupe(emptyThumb, { x: 0, y: 0, w: 1, h: 1 })).not.toThrow();
    });
  });

  describe('attachLoupeInteraction', () => {
    it('returns a cleanup function', () => {
      renderMinimap(thumb, 'supergrid', makeCards(), makeAxes());
      const cleanup = attachLoupeInteraction(thumb, () => undefined);
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });

    it('returns a no-op cleanup when no minimap-svg exists', () => {
      const emptyThumb = document.createElement('div');
      const cleanup = attachLoupeInteraction(emptyThumb, () => undefined);
      expect(typeof cleanup).toBe('function');
      expect(() => cleanup()).not.toThrow();
    });
  });
});
