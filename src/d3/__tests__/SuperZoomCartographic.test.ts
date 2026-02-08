/**
 * Test suite for SuperZoomCartographic - cartographic navigation system
 *
 * Tests upper-left anchor zoom behavior, boundary constraints,
 * separate zoom/pan controls, and smooth animation performance.
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import * as d3 from 'd3';
import { SuperZoomCartographic } from '../SuperZoomCartographic';
import type {
  CartographicConfig,
  CartographicState,
  BoundaryConstraints,
  ZoomAnchorMode,
  CartographicCallbacks
} from '../../types/supergrid';

describe('SuperZoomCartographic', () => {
  let container: SVGElement;
  let superZoom: SuperZoomCartographic;
  let mockCallbacks: CartographicCallbacks;

  beforeEach(() => {
    // Create DOM container
    document.body.innerHTML = '<div id="test-container"></div>';
    const testContainer = document.getElementById('test-container')!;
    container = d3.select(testContainer).append('svg').node()!;

    // Mock callbacks
    mockCallbacks = {
      onZoomChange: vi.fn(),
      onPanChange: vi.fn(),
      onStateChange: vi.fn(),
      onBoundaryHit: vi.fn()
    };

    // Default config for testing
    const config: CartographicConfig = {
      zoomExtent: [0.1, 10],
      anchorMode: 'upper-left',
      enableBoundaryConstraints: true,
      animationDuration: 300,
      enableSmoothing: true,
      gridDimensions: { width: 1000, height: 800 },
      viewportDimensions: { width: 800, height: 600 }
    };

    superZoom = new SuperZoomCartographic(container, config, mockCallbacks);
  });

  afterEach(() => {
    superZoom?.destroy();
    document.body.innerHTML = '';
  });

  describe('Upper-left anchor zoom behavior', () => {
    test('should pin upper-left corner during zoom in', () => {
      const initialState = superZoom.getState();
      expect(initialState.anchorPoint).toEqual({ x: 0, y: 0 });

      // Zoom in to 2x
      superZoom.zoomTo(2.0);

      const finalState = superZoom.getState();
      expect(finalState.scale).toBe(2.0);
      // Upper-left should remain at origin
      expect(finalState.transform.x).toBe(0);
      expect(finalState.transform.y).toBe(0);
    });

    test('should pin upper-left corner during zoom out', () => {
      // Start with 2x zoom
      superZoom.zoomTo(2.0);

      // Zoom out to 0.5x
      superZoom.zoomTo(0.5);

      const state = superZoom.getState();
      expect(state.scale).toBe(0.5);
      // Upper-left should remain pinned
      expect(state.transform.x).toBe(0);
      expect(state.transform.y).toBe(0);
    });

    test('should maintain anchor point throughout zoom sequence', () => {
      const zoomLevels = [0.5, 1.0, 1.5, 2.0, 1.0, 0.25];

      zoomLevels.forEach(scale => {
        superZoom.zoomTo(scale);
        const state = superZoom.getState();

        expect(state.scale).toBe(scale);
        expect(state.transform.x).toBe(0);
        expect(state.transform.y).toBe(0);
      });
    });
  });

  describe('Boundary constraints', () => {
    test('should prevent panning past grid boundaries', () => {
      // Try to pan beyond right boundary
      superZoom.panTo(-500, 0); // Would show empty space on left

      const state = superZoom.getState();
      expect(state.transform.x).toBeGreaterThanOrEqual(-200); // Within grid bounds
      expect(mockCallbacks.onBoundaryHit).toHaveBeenCalled();
    });

    test('should prevent panning past viewport edge', () => {
      // Try to pan beyond bottom boundary
      superZoom.panTo(0, -300); // Would show empty space at top

      const state = superZoom.getState();
      expect(state.transform.y).toBeGreaterThanOrEqual(-200); // Within viewport bounds
    });

    test('should apply elastic bounce-back for boundary violations', () => {
      const initialState = superZoom.getState();

      // Force pan past boundary
      superZoom.panTo(-1000, -1000);

      // Should bounce back to valid position
      setTimeout(() => {
        const finalState = superZoom.getState();
        expect(finalState.transform.x).toBeGreaterThan(-1000);
        expect(finalState.transform.y).toBeGreaterThan(-1000);
      }, 350); // After animation completes
    });
  });

  describe('Separate zoom and pan controls', () => {
    test('should handle zoom operations independently', () => {
      const initialPan = { x: -100, y: -50 };
      superZoom.panTo(initialPan.x, initialPan.y);

      // Zoom should not affect pan position (upper-left anchor)
      superZoom.zoomTo(1.5);

      const state = superZoom.getState();
      expect(state.scale).toBe(1.5);
      expect(state.transform.x).toBe(0); // Upper-left anchored
      expect(state.transform.y).toBe(0);
    });

    test('should handle pan operations independently', () => {
      const initialZoom = 2.0;
      superZoom.zoomTo(initialZoom);

      // Pan should not affect zoom level
      superZoom.panTo(-100, -50);

      const state = superZoom.getState();
      expect(state.scale).toBe(initialZoom);
      expect(state.transform.x).toBeLessThan(0); // Panned right
      expect(state.transform.y).toBeLessThan(0); // Panned down
    });

    test('should trigger separate callbacks for zoom vs pan', () => {
      superZoom.zoomTo(1.5);
      expect(mockCallbacks.onZoomChange).toHaveBeenCalledWith(1.5, expect.any(Object));

      superZoom.panTo(-50, -25);
      expect(mockCallbacks.onPanChange).toHaveBeenCalledWith(-50, -25, expect.any(Object));
    });
  });

  describe('Smooth animation performance', () => {
    test('should complete animations within 300ms', () => {
      const startTime = performance.now();

      superZoom.zoomTo(2.0);

      setTimeout(() => {
        const endTime = performance.now();
        expect(endTime - startTime).toBeLessThan(350); // 300ms + small buffer
      }, 350);
    });

    test('should maintain 60fps during animations', () => {
      let frameCount = 0;
      const startTime = performance.now();

      const countFrames = () => {
        frameCount++;
        if (performance.now() - startTime < 300) {
          requestAnimationFrame(countFrames);
        } else {
          const fps = frameCount / 0.3; // Frames per second
          expect(fps).toBeGreaterThan(50); // Close to 60fps
        }
      };

      requestAnimationFrame(countFrames);
      superZoom.zoomTo(3.0);
    });

    test('should use smooth easing transitions', () => {
      const states: number[] = [];

      // Capture intermediate states during animation
      const captureState = () => {
        states.push(superZoom.getState().scale);
        if (states.length < 10) {
          requestAnimationFrame(captureState);
        }
      };

      requestAnimationFrame(captureState);
      superZoom.zoomTo(2.0);

      setTimeout(() => {
        expect(states.length).toBeGreaterThan(5); // Multiple intermediate frames
        // Should show smooth progression, not linear
        expect(states[1]).not.toBe(states[0] + (2.0 - 1.0) / 10);
      }, 350);
    });
  });

  describe('State persistence', () => {
    test('should save and restore zoom/pan state', () => {
      // Set specific state
      superZoom.zoomTo(1.75);
      superZoom.panTo(-150, -100);

      const savedState = superZoom.getState();

      // Create new instance and restore
      const newSuperZoom = new SuperZoomCartographic(
        container,
        superZoom.getConfig(),
        mockCallbacks
      );
      newSuperZoom.restoreState(savedState);

      const restoredState = newSuperZoom.getState();
      expect(restoredState.scale).toBe(1.75);
      expect(restoredState.transform.x).toBe(-150);
      expect(restoredState.transform.y).toBe(-100);

      newSuperZoom.destroy();
    });

    test('should persist state per dataset', () => {
      const config1 = { ...superZoom.getConfig(), datasetId: 'dataset1' };
      const config2 = { ...superZoom.getConfig(), datasetId: 'dataset2' };

      const superZoom1 = new SuperZoomCartographic(container, config1, mockCallbacks);
      const superZoom2 = new SuperZoomCartographic(container, config2, mockCallbacks);

      // Set different states
      superZoom1.zoomTo(2.0);
      superZoom2.zoomTo(0.5);

      expect(superZoom1.getState().scale).toBe(2.0);
      expect(superZoom2.getState().scale).toBe(0.5);

      superZoom1.destroy();
      superZoom2.destroy();
    });
  });

  describe('Integration with SuperDensity and SuperStack', () => {
    test('should coordinate with density controls', () => {
      // Mock SuperDensity integration
      const densityState = {
        valueDensity: 'leaf' as const,
        extentDensity: 'dense' as const
      };

      superZoom.updateDensityState(densityState);
      superZoom.zoomTo(1.5);

      const state = superZoom.getState();
      expect(state.densityIntegration?.valueDensity).toBe('leaf');
      expect(state.scale).toBe(1.5);
    });

    test('should work with hierarchical headers', () => {
      // Mock SuperStack header data
      const headerData = {
        levels: 3,
        totalHeight: 120,
        isExpanded: true
      };

      superZoom.updateHeaderState(headerData);

      const constraints = superZoom.getBoundaryConstraints();
      expect(constraints.topOffset).toBe(120); // Account for header height
    });
  });

  describe('Visual feedback and boundaries', () => {
    test('should provide visual feedback for boundary constraints', () => {
      superZoom.panTo(-2000, -2000); // Way beyond boundaries

      const feedbackState = superZoom.getVisualFeedback();
      expect(feedbackState.showBoundaryIndicators).toBe(true);
      expect(feedbackState.bounceDirection).toBeDefined();
    });

    test('should show elastic resistance near boundaries', () => {
      // Pan way past grid boundary to trigger elastic resistance
      superZoom.panTo(-1000, 0);

      const state = superZoom.getState();
      // Elastic resistance should be applied when panning past boundaries
      // Note: This might not always be set depending on configuration
      const hasElasticResistance = state.elasticResistance !== undefined;
      expect(hasElasticResistance).toBe(true);
    });
  });
});