/**
 * Tests for Coordinate System Implementation
 *
 * Comprehensive test suite for bipolar and anchor coordinate systems
 */

import {
  createCoordinateSystem,
  calculateLogicalBounds,
  getBipolarQuadrant,
  calculateLogicalDistance,
  coordinateSystemPresets,
  transformCoordinates
} from '../coordinate-system';

describe('Coordinate System', () => {
  describe('createCoordinateSystem - Anchor Pattern', () => {
    const system = createCoordinateSystem('anchor', 100, 50);

    it('should set origin correctly for anchor pattern', () => {
      expect(system.originX).toBe(150); // Default header offset
      expect(system.originY).toBe(40);  // Default header offset
    });

    it('should convert logical to screen coordinates correctly', () => {
      const screen = system.logicalToScreen(0, 0);
      expect(screen.x).toBe(150); // originX + 0 * cellWidth
      expect(screen.y).toBe(40);  // originY + 0 * cellHeight

      const screen2 = system.logicalToScreen(2, 3);
      expect(screen2.x).toBe(350); // 150 + 2 * 100
      expect(screen2.y).toBe(190); // 40 + 3 * 50
    });

    it('should convert screen to logical coordinates correctly', () => {
      const logical = system.screenToLogical(150, 40);
      expect(logical.x).toBe(0);
      expect(logical.y).toBe(0);

      const logical2 = system.screenToLogical(350, 190);
      expect(logical2.x).toBe(2);
      expect(logical2.y).toBe(3);
    });
  });

  describe('createCoordinateSystem - Bipolar Pattern', () => {
    const system = createCoordinateSystem('bipolar', 100, 50, {
      viewportWidth: 800,
      viewportHeight: 600
    });

    it('should set origin at center for bipolar pattern', () => {
      expect(system.originX).toBe(400); // viewportWidth / 2
      expect(system.originY).toBe(300); // viewportHeight / 2
    });

    it('should handle negative coordinates in bipolar pattern', () => {
      // Center cell
      const centerScreen = system.logicalToScreen(0, 0);
      expect(centerScreen.x).toBe(400);
      expect(centerScreen.y).toBe(300);

      // Negative coordinates
      const negativeScreen = system.logicalToScreen(-2, -3);
      expect(negativeScreen.x).toBe(200); // 400 - 2 * 100
      expect(negativeScreen.y).toBe(150); // 300 - 3 * 50

      // Positive coordinates
      const positiveScreen = system.logicalToScreen(1, 2);
      expect(positiveScreen.x).toBe(500); // 400 + 1 * 100
      expect(positiveScreen.y).toBe(400); // 300 + 2 * 50
    });

    it('should convert screen to logical with negative results', () => {
      const logical = system.screenToLogical(200, 150);
      expect(logical.x).toBe(-2);
      expect(logical.y).toBe(-3);

      const logical2 = system.screenToLogical(500, 400);
      expect(logical2.x).toBe(1);
      expect(logical2.y).toBe(2);
    });
  });

  describe('calculateLogicalBounds', () => {
    const system = createCoordinateSystem('anchor', 100, 50);

    it('should calculate correct logical bounds', () => {
      const bounds = calculateLogicalBounds(system, {
        left: 150,
        top: 40,
        right: 550,
        bottom: 290
      });

      expect(bounds.minX).toBe(0);
      expect(bounds.maxX).toBe(4);
      expect(bounds.minY).toBe(0);
      expect(bounds.maxY).toBe(5);
    });

    it('should handle viewport bounds that don\'t align with grid', () => {
      const bounds = calculateLogicalBounds(system, {
        left: 175,  // Partial cell
        top: 65,    // Partial cell
        right: 525, // Partial cell
        bottom: 265 // Partial cell
      });

      expect(bounds.minX).toBe(0); // Floor of (175-150)/100 = 0.25
      expect(bounds.maxX).toBe(3); // Floor of (525-150)/100 = 3.75
      expect(bounds.minY).toBe(0); // Floor of (65-40)/50 = 0.5
      expect(bounds.maxY).toBe(4); // Floor of (265-40)/50 = 4.5
    });
  });

  describe('getBipolarQuadrant', () => {
    it('should identify quadrant 1 (positive X, positive Y)', () => {
      const q1 = getBipolarQuadrant(1, 1);
      expect(q1.quadrant).toBe(1);
      expect(q1.name).toBe('Q1');
      expect(q1.description).toContain('Positive X, Positive Y');
    });

    it('should identify quadrant 2 (negative X, positive Y)', () => {
      const q2 = getBipolarQuadrant(-1, 1);
      expect(q2.quadrant).toBe(2);
      expect(q2.name).toBe('Q2');
      expect(q2.description).toContain('Negative X, Positive Y');
    });

    it('should identify quadrant 3 (negative X, negative Y)', () => {
      const q3 = getBipolarQuadrant(-1, -1);
      expect(q3.quadrant).toBe(3);
      expect(q3.name).toBe('Q3');
      expect(q3.description).toContain('Negative X, Negative Y');
    });

    it('should identify quadrant 4 (positive X, negative Y)', () => {
      const q4 = getBipolarQuadrant(1, -1);
      expect(q4.quadrant).toBe(4);
      expect(q4.name).toBe('Q4');
      expect(q4.description).toContain('Positive X, Negative Y');
    });

    it('should handle origin point', () => {
      const origin = getBipolarQuadrant(0, 0);
      expect(origin.quadrant).toBe(1); // 0 is considered positive
    });
  });

  describe('calculateLogicalDistance', () => {
    it('should calculate euclidean distance correctly', () => {
      const distance = calculateLogicalDistance(
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        'euclidean'
      );
      expect(distance).toBe(5); // 3-4-5 triangle
    });

    it('should calculate manhattan distance correctly', () => {
      const distance = calculateLogicalDistance(
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        'manhattan'
      );
      expect(distance).toBe(7); // |3| + |4|
    });

    it('should handle negative coordinates', () => {
      const distance = calculateLogicalDistance(
        { x: -2, y: -1 },
        { x: 1, y: 3 },
        'euclidean'
      );
      expect(distance).toBe(5); // sqrt(9 + 16) = sqrt(25) = 5
    });

    it('should default to euclidean distance', () => {
      const distance = calculateLogicalDistance(
        { x: 0, y: 0 },
        { x: 3, y: 4 }
      );
      expect(distance).toBe(5);
    });
  });

  describe('coordinateSystemPresets', () => {
    it('should create spreadsheet preset correctly', () => {
      const system = coordinateSystemPresets.spreadsheet();
      expect(system.cellWidth).toBe(120);
      expect(system.cellHeight).toBe(60);
      expect(system.originX).toBe(150); // Anchor pattern
    });

    it('should create eisenhower matrix preset correctly', () => {
      const system = coordinateSystemPresets.eisenhowerMatrix();
      expect(system.cellWidth).toBe(160);
      expect(system.cellHeight).toBe(120);
      expect(system.originX).toBe(512); // Bipolar pattern (1024/2)
    });

    it('should allow custom cell sizes', () => {
      const system = coordinateSystemPresets.compact(60, 30);
      expect(system.cellWidth).toBe(60);
      expect(system.cellHeight).toBe(30);
    });
  });

  describe('transformCoordinates', () => {
    const anchorSystem = createCoordinateSystem('anchor', 100, 50);
    const bipolarSystem = createCoordinateSystem('bipolar', 100, 50, {
      viewportWidth: 800,
      viewportHeight: 600
    });

    it('should transform from anchor to bipolar', () => {
      const anchorPoint = { x: 2, y: 3 };
      const transformed = transformCoordinates(anchorPoint, anchorSystem, bipolarSystem);

      // Convert anchor to screen: (350, 190)
      // Convert screen to bipolar logical: ((350-400)/100, (190-300)/50) = (-0.5, -2.2)
      // Floor to: (-1, -3)
      expect(transformed.x).toBe(-1);
      expect(transformed.y).toBe(-3);
    });

    it('should transform from bipolar to anchor', () => {
      const bipolarPoint = { x: -1, y: 1 };
      const transformed = transformCoordinates(bipolarPoint, bipolarSystem, anchorSystem);

      // Convert bipolar to screen: (300, 350)
      // Convert screen to anchor logical: ((300-150)/100, (350-40)/50) = (1.5, 6.2)
      // Floor to: (1, 6)
      expect(transformed.x).toBe(1);
      expect(transformed.y).toBe(6);
    });

    it('should preserve coordinates when transforming to same system', () => {
      const point = { x: 5, y: 3 };
      const transformed = transformCoordinates(point, anchorSystem, anchorSystem);
      expect(transformed.x).toBe(5);
      expect(transformed.y).toBe(3);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle zero cell dimensions', () => {
      expect(() => {
        createCoordinateSystem('anchor', 0, 50);
      }).not.toThrow();
    });

    it('should handle very large coordinates', () => {
      const system = createCoordinateSystem('bipolar', 100, 50);
      const screen = system.logicalToScreen(1000000, -1000000);
      expect(typeof screen.x).toBe('number');
      expect(typeof screen.y).toBe('number');
      expect(isFinite(screen.x)).toBe(true);
      expect(isFinite(screen.y)).toBe(true);
    });

    it('should handle fractional screen coordinates', () => {
      const system = createCoordinateSystem('anchor', 100, 50);
      const logical = system.screenToLogical(175.7, 92.3);
      expect(logical.x).toBe(0); // Floor of 0.257
      expect(logical.y).toBe(1); // Floor of 1.046
    });
  });
});