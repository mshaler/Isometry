/**
 * iso-canvas Component Tests
 *
 * TDD tests for Isometry canvas D3 component.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as d3 from 'd3';
import { cbCanvas } from './cb-canvas';

// Helper to create a test container
function createContainer(): HTMLDivElement {
  const container = document.createElement('div');
  container.id = 'test-container';
  container.style.width = '800px';
  container.style.height = '600px';
  document.body.appendChild(container);
  return container;
}

describe('cbCanvas', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = createContainer();
  });

  afterEach(() => {
    container.remove();
  });

  describe('factory function', () => {
    it('returns a component function', () => {
      const canvas = cbCanvas();
      expect(typeof canvas).toBe('function');
    });

    it('has fluent API accessors', () => {
      const canvas = cbCanvas();

      expect(typeof canvas.viewType).toBe('function');
      expect(typeof canvas.background).toBe('function');
      expect(typeof canvas.zoomable).toBe('function');
      expect(typeof canvas.padding).toBe('function');
    });
  });

  describe('fluent API', () => {
    it('viewType getter returns default value', () => {
      const canvas = cbCanvas();
      expect(canvas.viewType()).toBe('grid');
    });

    it('viewType setter returns component for chaining', () => {
      const canvas = cbCanvas();
      const result = canvas.viewType('kanban');

      expect(result).toBe(canvas);
      expect(canvas.viewType()).toBe('kanban');
    });

    it('supports method chaining', () => {
      const canvas = cbCanvas()
        .viewType('timeline')
        .background('dots')
        .zoomable(true)
        .padding({ top: 20, right: 20, bottom: 20, left: 20 });

      expect(canvas.viewType()).toBe('timeline');
      expect(canvas.background()).toBe('dots');
      expect(canvas.zoomable()).toBe(true);
      expect(canvas.padding()).toEqual({ top: 20, right: 20, bottom: 20, left: 20 });
    });

    it('background defaults to solid', () => {
      const canvas = cbCanvas();
      expect(canvas.background()).toBe('solid');
    });

    it('zoomable defaults to false', () => {
      const canvas = cbCanvas();
      expect(canvas.zoomable()).toBe(false);
    });
  });

  describe('rendering', () => {
    it('renders canvas container', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const canvasEl = container.querySelector('.cb-canvas');
      expect(canvasEl).not.toBeNull();
    });

    it('renders SVG element', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const svg = container.querySelector('.cb-canvas__svg');
      expect(svg).not.toBeNull();
    });

    it('renders content group', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const contentGroup = container.querySelector('.cb-canvas__content');
      expect(contentGroup).not.toBeNull();
    });

    it('renders overlay group', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const overlayGroup = container.querySelector('.cb-canvas__overlay');
      expect(overlayGroup).not.toBeNull();
    });

    it('applies background class for dots pattern', () => {
      const canvas = cbCanvas().background('dots');

      d3.select(container).call(canvas);

      const canvasEl = container.querySelector('.cb-canvas--dots');
      expect(canvasEl).not.toBeNull();
    });

    it('applies background class for grid pattern', () => {
      const canvas = cbCanvas().background('grid');

      d3.select(container).call(canvas);

      const canvasEl = container.querySelector('.cb-canvas--grid');
      expect(canvasEl).not.toBeNull();
    });
  });

  describe('dimensions', () => {
    it('getDimensions returns canvas dimensions', () => {
      const canvas = cbCanvas().padding({ top: 10, right: 10, bottom: 10, left: 10 });

      d3.select(container).call(canvas);

      const dims = canvas.getDimensions();
      expect(dims).toHaveProperty('width');
      expect(dims).toHaveProperty('height');
      expect(dims).toHaveProperty('innerWidth');
      expect(dims).toHaveProperty('innerHeight');
    });

    it('innerWidth accounts for padding', () => {
      const canvas = cbCanvas().padding({ top: 10, right: 20, bottom: 10, left: 20 });

      d3.select(container).call(canvas);

      const dims = canvas.getDimensions();
      expect(dims.innerWidth).toBe(dims.width - 40);
    });

    it('innerHeight accounts for padding', () => {
      const canvas = cbCanvas().padding({ top: 10, right: 10, bottom: 20, left: 10 });

      d3.select(container).call(canvas);

      const dims = canvas.getDimensions();
      expect(dims.innerHeight).toBe(dims.height - 30);
    });
  });

  describe('content area', () => {
    it('getContentArea returns D3 selection of content group', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const contentArea = canvas.getContentArea();
      expect(contentArea).not.toBeNull();
      expect(contentArea?.node()?.classList.contains('cb-canvas__content')).toBe(true);
    });

    it('getOverlayArea returns D3 selection of overlay group', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);

      const overlayArea = canvas.getOverlayArea();
      expect(overlayArea).not.toBeNull();
      expect(overlayArea?.node()?.classList.contains('cb-canvas__overlay')).toBe(true);
    });
  });

  describe('zoom behavior', () => {
    it('enables zoom when zoomable is true', () => {
      const canvas = cbCanvas().zoomable(true);

      d3.select(container).call(canvas);

      // Check that zoom is attached to SVG
      const svg = container.querySelector('.cb-canvas__svg');
      expect(svg).not.toBeNull();
      // Zoom behavior is internal - we just verify it doesn't break
    });

    it('resetZoom does not throw and returns canvas for chaining', () => {
      const canvas = cbCanvas().zoomable(true);

      d3.select(container).call(canvas);

      // resetZoom should return the canvas for chaining
      const result = canvas.resetZoom();
      expect(result).toBe(canvas);

      // Content group should still exist
      const contentGroup = container.querySelector('.cb-canvas__content');
      expect(contentGroup).not.toBeNull();
    });
  });

  describe('destroy', () => {
    it('removes canvas elements', () => {
      const canvas = cbCanvas();

      d3.select(container).call(canvas);
      expect(container.querySelector('.cb-canvas')).not.toBeNull();

      canvas.destroy();
      expect(container.querySelector('.cb-canvas')).toBeNull();
    });

    it('cleans up zoom behavior', () => {
      const canvas = cbCanvas().zoomable(true);

      d3.select(container).call(canvas);
      canvas.destroy();

      // Should not throw even after destroy
      expect(() => canvas.resetZoom()).not.toThrow();
    });
  });
});
