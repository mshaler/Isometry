import { describe, it, expect, afterEach } from 'vitest';
import * as d3 from 'd3';
import { GridRenderingEngine, type RenderingConfig } from '../GridRenderingEngine';

describe('GridRenderingEngine stability', () => {
  afterEach(() => {
    d3.selectAll('*').interrupt();
    document.body.innerHTML = '';
  });

  it('keeps grid container layers when x/y projection changes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const selection = d3.select(svg) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;

    const config: RenderingConfig = {
      cardWidth: 200,
      cardHeight: 120,
      padding: 8,
      headerHeight: 40,
      rowHeaderWidth: 140,
      enableHeaders: true,
      enableAnimations: false,
      animationDuration: 0,
    };

    const engine = new GridRenderingEngine(selection, config, {});
    engine.setGridData({
      cards: [
        { id: '1', name: 'A', folder: 'Work', status: 'active', created_at: '2025-01-01' },
        { id: '2', name: 'B', folder: 'Personal', status: 'backlog', created_at: '2025-01-02' },
      ],
      xAxis: { axis: 'x', field: 'folder', values: [], isComputed: false },
      yAxis: { axis: 'y', field: 'status', values: [], isComputed: false },
      totalWidth: 1200,
      totalHeight: 900,
      lastUpdated: Date.now(),
    });

    engine.setProjection({
      xAxis: { axis: 'category', facet: 'folder' },
      yAxis: { axis: 'category', facet: 'status' },
    });
    engine.render();

    const headersLayerBefore = svg.querySelector('g.headers');
    const gridContentLayerBefore = svg.querySelector('g.grid-content');
    expect(headersLayerBefore).not.toBeNull();
    expect(gridContentLayerBefore).not.toBeNull();

    engine.setProjection({
      xAxis: { axis: 'category', facet: 'status' },
      yAxis: { axis: 'category', facet: 'folder' },
    });
    engine.render();

    const headersLayerAfter = svg.querySelector('g.headers');
    const gridContentLayerAfter = svg.querySelector('g.grid-content');
    expect(headersLayerAfter).toBe(headersLayerBefore);
    expect(gridContentLayerAfter).toBe(gridContentLayerBefore);
    expect(svg.querySelectorAll('g.headers')).toHaveLength(1);
    expect(svg.querySelectorAll('g.grid-content')).toHaveLength(1);
    engine.destroy();
  });
});
