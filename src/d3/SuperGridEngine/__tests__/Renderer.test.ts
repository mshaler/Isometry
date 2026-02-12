/**
 * Renderer Tests - SuperZoom Upper-Left Anchor
 *
 * TDD: These tests define the expected behavior for pinned zoom.
 * - Zoom anchors to (0,0) instead of cursor position
 * - Pan constrained to grid boundaries
 * - Grid expands/contracts from upper-left corner
 *
 * Plan 73-03: SuperZoom Upper-Left Anchor
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePinnedZoomTransform,
  constrainToBounds,
  type ZoomTransformInput,
  type GridBounds
} from '../Renderer';

describe('SuperGridRenderer - Pinned Zoom', () => {
  describe('calculatePinnedZoomTransform', () => {
    it('should keep (0,0) at (0,0) when zooming in', () => {
      // Starting at identity transform
      const current: ZoomTransformInput = { x: 0, y: 0, k: 1 };
      // Zoom in by factor of 1.5
      const newScale = 1.5;

      const result = calculatePinnedZoomTransform(current, newScale);

      // Origin should remain at (0,0)
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.k).toBe(1.5);
    });

    it('should keep (0,0) at (0,0) when zooming out', () => {
      const current: ZoomTransformInput = { x: 0, y: 0, k: 1 };
      const newScale = 0.5;

      const result = calculatePinnedZoomTransform(current, newScale);

      // Origin should remain at (0,0) after zoom out
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.k).toBe(0.5);
    });

    it('should preserve pan offset when zooming from non-zero translation', () => {
      // User has panned to (-100, -50)
      const current: ZoomTransformInput = { x: -100, y: -50, k: 1 };
      const newScale = 2;

      const result = calculatePinnedZoomTransform(current, newScale);

      // Scale doubles, so translation doubles to keep upper-left anchored
      expect(result.k).toBe(2);
      // Translation scaled proportionally
      expect(result.x).toBe(-200);
      expect(result.y).toBe(-100);
    });

    it('should contract toward upper-left when zooming out from panned position', () => {
      const current: ZoomTransformInput = { x: -200, y: -100, k: 2 };
      const newScale = 1;

      const result = calculatePinnedZoomTransform(current, newScale);

      // Scale halves, translation halves
      expect(result.k).toBe(1);
      expect(result.x).toBe(-100);
      expect(result.y).toBe(-50);
    });
  });

  describe('constrainToBounds', () => {
    const viewportSize = { width: 800, height: 600 };
    const gridBounds: GridBounds = { width: 1600, height: 1200 };

    it('should stop pan at left edge (x <= 0)', () => {
      // Trying to pan right (positive x would show past left edge)
      const transform: ZoomTransformInput = { x: 50, y: 0, k: 1 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      // x clamped to 0 (can't show past left edge)
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should stop pan at top edge (y <= 0)', () => {
      // Trying to pan down (positive y would show past top edge)
      const transform: ZoomTransformInput = { x: 0, y: 100, k: 1 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      // y clamped to 0
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should stop pan at right edge', () => {
      // At scale 1: gridWidth = 1600, viewportWidth = 800
      // Max negative x = -(1600 - 800) = -800
      const transform: ZoomTransformInput = { x: -900, y: 0, k: 1 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      // x clamped to -800 (can't pan past right edge)
      expect(result.x).toBe(-800);
    });

    it('should stop pan at bottom edge', () => {
      // At scale 1: gridHeight = 1200, viewportHeight = 600
      // Max negative y = -(1200 - 600) = -600
      const transform: ZoomTransformInput = { x: 0, y: -700, k: 1 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      // y clamped to -600
      expect(result.y).toBe(-600);
    });

    it('should adjust bounds based on scale factor', () => {
      // At scale 2: scaledWidth = 3200, scaledHeight = 2400
      // Max negative x = -(3200 - 800) = -2400
      // Max negative y = -(2400 - 600) = -1800
      const transform: ZoomTransformInput = { x: -3000, y: -2000, k: 2 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      expect(result.x).toBe(-2400);
      expect(result.y).toBe(-1800);
    });

    it('should allow full range when grid smaller than viewport', () => {
      const smallGrid: GridBounds = { width: 400, height: 300 };
      const transform: ZoomTransformInput = { x: -50, y: -50, k: 1 };

      const result = constrainToBounds(transform, smallGrid, viewportSize);

      // Grid fits in viewport, no panning needed
      // x range: 0 to 0, y range: 0 to 0
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('should preserve valid transforms within bounds', () => {
      const transform: ZoomTransformInput = { x: -400, y: -300, k: 1 };

      const result = constrainToBounds(transform, gridBounds, viewportSize);

      // Transform is within valid range, should be unchanged
      expect(result.x).toBe(-400);
      expect(result.y).toBe(-300);
      expect(result.k).toBe(1);
    });
  });

  describe('Combined Zoom and Constraint Behavior', () => {
    const viewportSize = { width: 800, height: 600 };
    const gridBounds: GridBounds = { width: 1600, height: 1200 };

    it('should zoom and then constrain in sequence', () => {
      // Start at max pan position
      const current: ZoomTransformInput = { x: -800, y: -600, k: 1 };
      // Zoom out to 0.5
      const newScale = 0.5;

      // Step 1: Calculate pinned zoom
      const zoomed = calculatePinnedZoomTransform(current, newScale);
      // Translation scales: -400, -300
      expect(zoomed.x).toBe(-400);
      expect(zoomed.y).toBe(-300);

      // Step 2: Apply constraints
      // At scale 0.5: scaledWidth = 800, scaledHeight = 600
      // These match viewport, so max x/y = 0
      const constrained = constrainToBounds(zoomed, gridBounds, viewportSize);
      expect(constrained.x).toBe(0);
      expect(constrained.y).toBe(0);
    });

    it('should handle zoom in at boundary', () => {
      // At right/bottom edge
      const current: ZoomTransformInput = { x: -800, y: -600, k: 1 };
      // Zoom in to 2
      const newScale = 2;

      const zoomed = calculatePinnedZoomTransform(current, newScale);
      // Translation doubles: -1600, -1200
      expect(zoomed.x).toBe(-1600);
      expect(zoomed.y).toBe(-1200);

      // At scale 2: max x = -2400, max y = -1800
      // Our values are within bounds
      const constrained = constrainToBounds(zoomed, gridBounds, viewportSize);
      expect(constrained.x).toBe(-1600);
      expect(constrained.y).toBe(-1200);
    });
  });
});
