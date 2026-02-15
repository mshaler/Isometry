import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePAFV } from '@/hooks/usePAFV';

describe('View Transition State Machine', () => {
  describe('Tier 2: LATCH Family State', () => {
    it('preserves axis assignments across Grid → List → Grid', () => {
      const { result } = renderHook(() => usePAFV());

      // Set custom axis assignment
      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
        result.current.setMapping('y', 'category', 'status');
      });

      // Verify initial state
      const xMapping = result.current.getMappingForPlane('x');
      expect(xMapping).toEqual({
        dimension: 'time',
        field: 'created_at',
        plane: 'x'
      });

      // Simulate view transition to List (within LATCH family)
      act(() => {
        result.current.setActiveView('list');
      });

      expect(result.current.activeView).toBe('list');

      // Simulate view transition back to Grid
      act(() => {
        result.current.setActiveView('grid');
      });

      // Verify axis assignments preserved
      expect(result.current.getMappingForPlane('x')).toEqual({
        dimension: 'time',
        field: 'created_at',
        plane: 'x'
      });
      expect(result.current.getMappingForPlane('y')).toEqual({
        dimension: 'category',
        field: 'status',
        plane: 'y'
      });
    });

    it('preserves density setting across view changes', () => {
      const { result } = renderHook(() => usePAFV());

      // Set custom density
      act(() => {
        result.current.setDensity(0.75);
      });

      expect(result.current.density).toBe(0.75);

      // Change view
      act(() => {
        result.current.setActiveView('kanban');
      });

      // Change back
      act(() => {
        result.current.setActiveView('grid');
      });

      // Density should persist
      expect(result.current.density).toBe(0.75);
    });

    it('preserves zoom level across view changes', () => {
      const { result } = renderHook(() => usePAFV());

      // Set custom zoom
      act(() => {
        result.current.setZoomLevel(2.5);
      });

      expect(result.current.zoomLevel).toBe(2.5);

      // Change view and back
      act(() => {
        result.current.setActiveView('timeline');
        result.current.setActiveView('grid');
      });

      // Zoom should persist
      expect(result.current.zoomLevel).toBe(2.5);
    });

    it('clamps zoom level to valid range', () => {
      const { result } = renderHook(() => usePAFV());

      // Try to set zoom above max (10)
      act(() => {
        result.current.setZoomLevel(100);
      });

      expect(result.current.zoomLevel).toBeLessThanOrEqual(10);

      // Try to set zoom below min (0.1)
      act(() => {
        result.current.setZoomLevel(0.01);
      });

      expect(result.current.zoomLevel).toBeGreaterThanOrEqual(0.1);
    });

    it('resets state on explicit reset call', () => {
      const { result } = renderHook(() => usePAFV());

      // Customize state
      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
        result.current.setDensity(0.8);
        result.current.setZoomLevel(3);
        result.current.setActiveView('kanban');
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Verify defaults restored
      expect(result.current.activeView).toBe('grid');
      expect(result.current.zoomLevel).toBe(1);
      expect(result.current.density).toBe(0.5);
    });
  });

  describe('Axis Mapping Operations', () => {
    it('removes mapping when removeMapping called', () => {
      const { result } = renderHook(() => usePAFV());

      // Set mapping
      act(() => {
        result.current.setMapping('z', 'hierarchy', 'priority');
      });

      expect(result.current.getMappingForPlane('z')).not.toBeNull();

      // Remove it
      act(() => {
        result.current.removeMapping('z');
      });

      expect(result.current.getMappingForPlane('z')).toBeNull();
    });

    it('getPlaneForDimension returns correct plane', () => {
      const { result } = renderHook(() => usePAFV());

      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
        result.current.setMapping('y', 'category', 'status');
      });

      expect(result.current.getPlaneForDimension('time')).toBe('x');
      expect(result.current.getPlaneForDimension('category')).toBe('y');
      expect(result.current.getPlaneForDimension('location')).toBeNull();
    });

    it('overwrites existing mapping for same plane', () => {
      const { result } = renderHook(() => usePAFV());

      // Set initial mapping
      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
      });

      // Overwrite with new mapping
      act(() => {
        result.current.setMapping('x', 'category', 'status');
      });

      const mapping = result.current.getMappingForPlane('x');
      expect(mapping?.dimension).toBe('category');
      expect(mapping?.field).toBe('status');
    });

    it('maintains multiple axis mappings independently', () => {
      const { result } = renderHook(() => usePAFV());

      // Set all three axes
      act(() => {
        result.current.setMapping('x', 'time', 'created_at');
        result.current.setMapping('y', 'category', 'status');
        result.current.setMapping('z', 'hierarchy', 'priority');
      });

      // Verify all three exist
      expect(result.current.getMappingForPlane('x')).not.toBeNull();
      expect(result.current.getMappingForPlane('y')).not.toBeNull();
      expect(result.current.getMappingForPlane('z')).not.toBeNull();

      // Remove one, others should remain
      act(() => {
        result.current.removeMapping('y');
      });

      expect(result.current.getMappingForPlane('x')).not.toBeNull();
      expect(result.current.getMappingForPlane('y')).toBeNull();
      expect(result.current.getMappingForPlane('z')).not.toBeNull();
    });

    it('clamps density to valid range 0-1', () => {
      const { result } = renderHook(() => usePAFV());

      // Try to set density above 1
      act(() => {
        result.current.setDensity(1.5);
      });

      expect(result.current.density).toBeLessThanOrEqual(1);

      // Try to set density below 0
      act(() => {
        result.current.setDensity(-0.5);
      });

      expect(result.current.density).toBeGreaterThanOrEqual(0);
    });
  });
});
