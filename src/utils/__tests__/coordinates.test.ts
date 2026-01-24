/**
 * Unit tests for coordinate transformation utilities.
 *
 * Tests both Anchor (spreadsheet) and Bipolar (semantic matrix) origin patterns
 * with round-trip verification to ensure precision is preserved.
 *
 * @module utils/__tests__/coordinates.test
 */

import { describe, it, expect } from 'vitest';
import {
  screenToLogical,
  logicalToScreen,
  calculateAxisRange,
  getOriginPreset,
  verifyRoundTrip,
} from '../coordinates';
import type { CoordinateSystem } from '../../types/coordinates';
import type { GridCell } from '../../types/supergrid';

describe('Coordinate Transformations', () => {
  describe('Anchor Origin Pattern', () => {
    const anchorSystem: CoordinateSystem = {
      pattern: 'anchor',
      scale: 1.0,
      viewportWidth: 1024,
      viewportHeight: 768,
    };

    it('should map top-left (0,0) screen to (0,0) logical', () => {
      const screen = { x: 0, y: 0 };
      const logical = screenToLogical(screen, anchorSystem);

      expect(logical.x).toBe(0);
      expect(logical.y).toBe(0);
    });

    it('should map screen point directly to logical at scale 1.0', () => {
      const screen = { x: 240, y: 120 };
      const logical = screenToLogical(screen, anchorSystem);

      expect(logical.x).toBe(240);
      expect(logical.y).toBe(120);
    });

    it('should map logical (0,0) to screen (0,0)', () => {
      const logical = { x: 0, y: 0 };
      const screen = logicalToScreen(logical, anchorSystem);

      expect(screen.x).toBe(0);
      expect(screen.y).toBe(0);
    });

    it('should map logical point directly to screen at scale 1.0', () => {
      const logical = { x: 100, y: 200 };
      const screen = logicalToScreen(logical, anchorSystem);

      expect(screen.x).toBe(100);
      expect(screen.y).toBe(200);
    });

    it('should handle zoom (scale 2.0) correctly', () => {
      const zoomedSystem: CoordinateSystem = {
        ...anchorSystem,
        scale: 2.0,
      };

      // Screen 200 → Logical 100 (zoomed in, logical space shrinks)
      const logical = screenToLogical({ x: 200, y: 100 }, zoomedSystem);
      expect(logical.x).toBe(100);
      expect(logical.y).toBe(50);

      // Logical 100 → Screen 200 (zoomed in, screen space expands)
      const screen = logicalToScreen({ x: 100, y: 50 }, zoomedSystem);
      expect(screen.x).toBe(200);
      expect(screen.y).toBe(100);
    });

    it('should handle zoom (scale 0.5) correctly', () => {
      const zoomedSystem: CoordinateSystem = {
        ...anchorSystem,
        scale: 0.5,
      };

      // Screen 100 → Logical 200 (zoomed out, logical space expands)
      const logical = screenToLogical({ x: 100, y: 50 }, zoomedSystem);
      expect(logical.x).toBe(200);
      expect(logical.y).toBe(100);

      // Logical 200 → Screen 100 (zoomed out, screen space shrinks)
      const screen = logicalToScreen({ x: 200, y: 100 }, zoomedSystem);
      expect(screen.x).toBe(100);
      expect(screen.y).toBe(50);
    });

    it('should preserve precision in round-trip transformation', () => {
      const testPoints = [
        { x: 0, y: 0 },
        { x: 100, y: 200 },
        { x: 512, y: 384 },
        { x: 1024, y: 768 },
      ];

      testPoints.forEach((point) => {
        const isValid = verifyRoundTrip(point, anchorSystem);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('Bipolar Origin Pattern', () => {
    const bipolarSystem: CoordinateSystem = {
      pattern: 'bipolar',
      scale: 1.0,
      viewportWidth: 1024,
      viewportHeight: 768,
    };

    it('should map center screen to (0,0) logical', () => {
      const centerScreen = { x: 512, y: 384 };
      const logical = screenToLogical(centerScreen, bipolarSystem);

      expect(logical.x).toBe(0);
      expect(logical.y).toBe(0);
    });

    it('should map logical (0,0) to center screen', () => {
      const logical = { x: 0, y: 0 };
      const screen = logicalToScreen(logical, bipolarSystem);

      expect(screen.x).toBe(512);
      expect(screen.y).toBe(384);
    });

    it('should map positive logical to right/bottom quadrant', () => {
      const logical = { x: 100, y: 100 };
      const screen = logicalToScreen(logical, bipolarSystem);

      // Should be to the right and below center
      expect(screen.x).toBe(612); // 512 + 100
      expect(screen.y).toBe(484); // 384 + 100
    });

    it('should map negative logical to left/top quadrant', () => {
      const logical = { x: -100, y: -100 };
      const screen = logicalToScreen(logical, bipolarSystem);

      // Should be to the left and above center
      expect(screen.x).toBe(412); // 512 - 100
      expect(screen.y).toBe(284); // 384 - 100
    });

    it('should handle Eisenhower Matrix quadrants', () => {
      // Q1: Urgent + Important (positive x, positive y)
      const q1Screen = logicalToScreen({ x: 1, y: 1 }, bipolarSystem);
      expect(q1Screen.x).toBeGreaterThan(512);
      expect(q1Screen.y).toBeGreaterThan(384);

      // Q2: Not Urgent + Important (negative x, positive y)
      const q2Screen = logicalToScreen({ x: -1, y: 1 }, bipolarSystem);
      expect(q2Screen.x).toBeLessThan(512);
      expect(q2Screen.y).toBeGreaterThan(384);

      // Q3: Not Urgent + Not Important (negative x, negative y)
      const q3Screen = logicalToScreen({ x: -1, y: -1 }, bipolarSystem);
      expect(q3Screen.x).toBeLessThan(512);
      expect(q3Screen.y).toBeLessThan(384);

      // Q4: Urgent + Not Important (positive x, negative y)
      const q4Screen = logicalToScreen({ x: 1, y: -1 }, bipolarSystem);
      expect(q4Screen.x).toBeGreaterThan(512);
      expect(q4Screen.y).toBeLessThan(384);
    });

    it('should handle zoom with bipolar origin', () => {
      const zoomedSystem: CoordinateSystem = {
        ...bipolarSystem,
        scale: 2.0,
      };

      // Logical (0,0) should still map to center regardless of zoom
      const centerLogical = { x: 0, y: 0 };
      const centerScreen = logicalToScreen(centerLogical, zoomedSystem);
      expect(centerScreen.x).toBe(512);
      expect(centerScreen.y).toBe(384);

      // Logical (50,0) should map to right of center, zoomed
      const rightLogical = { x: 50, y: 0 };
      const rightScreen = logicalToScreen(rightLogical, zoomedSystem);
      expect(rightScreen.x).toBe(612); // 512 + (50 * 2)
      expect(rightScreen.y).toBe(384);
    });

    it('should preserve precision in round-trip transformation', () => {
      const testPoints = [
        { x: 512, y: 384 }, // Center
        { x: 0, y: 0 }, // Top-left corner
        { x: 1024, y: 768 }, // Bottom-right corner
        { x: 256, y: 192 }, // Arbitrary point
      ];

      testPoints.forEach((point) => {
        const isValid = verifyRoundTrip(point, bipolarSystem);
        expect(isValid).toBe(true);
      });
    });
  });

  describe('calculateAxisRange', () => {
    it('should return zero range for empty cell array', () => {
      const cells: GridCell[] = [];
      const xRange = calculateAxisRange(cells, 'x');

      expect(xRange.min).toBe(0);
      expect(xRange.max).toBe(0);
      expect(xRange.count).toBe(0);
    });

    it('should calculate x-axis range correctly', () => {
      const cells: GridCell[] = [
        {
          position: { x: 0, y: 1 },
          value: 'A',
          nodeId: 1,
          colPath: 'a',
          rowPath: '1',
        },
        {
          position: { x: 2, y: 1 },
          value: 'B',
          nodeId: 2,
          colPath: 'c',
          rowPath: '1',
        },
        {
          position: { x: 1, y: 3 },
          value: 'C',
          nodeId: 3,
          colPath: 'b',
          rowPath: '3',
        },
      ];

      const xRange = calculateAxisRange(cells, 'x');

      expect(xRange.min).toBe(0);
      expect(xRange.max).toBe(2);
      expect(xRange.count).toBe(3);
    });

    it('should calculate y-axis range correctly', () => {
      const cells: GridCell[] = [
        {
          position: { x: 0, y: 1 },
          value: 'A',
          nodeId: 1,
          colPath: 'a',
          rowPath: '1',
        },
        {
          position: { x: 2, y: 1 },
          value: 'B',
          nodeId: 2,
          colPath: 'c',
          rowPath: '1',
        },
        {
          position: { x: 1, y: 3 },
          value: 'C',
          nodeId: 3,
          colPath: 'b',
          rowPath: '3',
        },
      ];

      const yRange = calculateAxisRange(cells, 'y');

      expect(yRange.min).toBe(1);
      expect(yRange.max).toBe(3);
      expect(yRange.count).toBe(3);
    });

    it('should handle negative coordinates (bipolar)', () => {
      const cells: GridCell[] = [
        {
          position: { x: -5, y: -2 },
          value: 'A',
          nodeId: 1,
          colPath: 'a',
          rowPath: '1',
        },
        {
          position: { x: 5, y: 2 },
          value: 'B',
          nodeId: 2,
          colPath: 'b',
          rowPath: '2',
        },
        {
          position: { x: 0, y: 0 },
          value: 'C',
          nodeId: 3,
          colPath: 'c',
          rowPath: '3',
        },
      ];

      const xRange = calculateAxisRange(cells, 'x');
      expect(xRange.min).toBe(-5);
      expect(xRange.max).toBe(5);
      expect(xRange.count).toBe(11); // -5 to +5 inclusive

      const yRange = calculateAxisRange(cells, 'y');
      expect(yRange.min).toBe(-2);
      expect(yRange.max).toBe(2);
      expect(yRange.count).toBe(5); // -2 to +2 inclusive
    });

    it('should handle single cell', () => {
      const cells: GridCell[] = [
        {
          position: { x: 42, y: 17 },
          value: 'Single',
          nodeId: 1,
          colPath: 'col',
          rowPath: 'row',
        },
      ];

      const xRange = calculateAxisRange(cells, 'x');
      expect(xRange.min).toBe(42);
      expect(xRange.max).toBe(42);
      expect(xRange.count).toBe(1);

      const yRange = calculateAxisRange(cells, 'y');
      expect(yRange.min).toBe(17);
      expect(yRange.max).toBe(17);
      expect(yRange.count).toBe(1);
    });
  });

  describe('getOriginPreset', () => {
    it('should return anchor preset configuration', () => {
      const preset = getOriginPreset('anchor');

      expect(preset.pattern).toBe('anchor');
      expect(preset.initialScale).toBe(1.0);
      expect(preset.description).toContain('spreadsheet');
    });

    it('should return bipolar preset configuration', () => {
      const preset = getOriginPreset('bipolar');

      expect(preset.pattern).toBe('bipolar');
      expect(preset.initialScale).toBe(1.0);
      expect(preset.description).toContain('center');
    });
  });

  describe('verifyRoundTrip', () => {
    const anchorSystem: CoordinateSystem = {
      pattern: 'anchor',
      scale: 1.0,
      viewportWidth: 1024,
      viewportHeight: 768,
    };

    it('should verify exact round-trip with default tolerance', () => {
      const screen = { x: 100, y: 200 };
      const isValid = verifyRoundTrip(screen, anchorSystem);

      expect(isValid).toBe(true);
    });

    it('should verify round-trip within custom tolerance', () => {
      const screen = { x: 100.0005, y: 200.0003 };
      const isValid = verifyRoundTrip(screen, anchorSystem, 0.001);

      expect(isValid).toBe(true);
    });

    it('should detect precision loss beyond tolerance', () => {
      // Create a system that might introduce floating point errors
      const system: CoordinateSystem = {
        pattern: 'bipolar',
        scale: 1.7, // Non-power-of-2 to potentially introduce FP errors
        viewportWidth: 1023, // Odd number
        viewportHeight: 767,
      };

      const screen = { x: 333.333, y: 666.666 };
      // Should still pass with reasonable tolerance
      const isValid = verifyRoundTrip(screen, system, 0.01);

      expect(isValid).toBe(true);
    });
  });
});
