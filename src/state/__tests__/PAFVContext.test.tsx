import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { PAFVProvider, usePAFV } from '../PAFVContext';
import { DEFAULT_PAFV } from '../../types/pafv';
import type { AxisMapping } from '../../types/pafv';
import { serializePAFV, deserializePAFV } from '../../utils/pafv-serialization';

// Wrapper component for tests
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <PAFVProvider>{children}</PAFVProvider>
    </BrowserRouter>
  );
}

describe('PAFVContext', () => {
  describe('usePAFV hook', () => {
    it('should throw error when used outside PAFVProvider', () => {
      expect(() => {
        renderHook(() => usePAFV());
      }).toThrow('usePAFV must be used within PAFVProvider');
    });

    it('should provide default state when initialized', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.state).toEqual(DEFAULT_PAFV);
      expect(result.current.state.viewMode).toBe('grid');
      expect(result.current.state.mappings).toHaveLength(2);
    });
  });

  describe('setMapping', () => {
    it('should update axis mapping correctly', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const newMapping: AxisMapping = {
        plane: 'x',
        axis: 'location',
        facet: 'city',
      };

      act(() => {
        result.current.setMapping(newMapping);
      });

      const xMapping = result.current.state.mappings.find(m => m.plane === 'x');
      expect(xMapping).toEqual(newMapping);
    });

    it('should replace existing mapping for same plane', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const firstMapping: AxisMapping = {
        plane: 'color',
        axis: 'category',
        facet: 'tag',
      };

      const secondMapping: AxisMapping = {
        plane: 'color',
        axis: 'time',
        facet: 'month',
      };

      act(() => {
        result.current.setMapping(firstMapping);
      });

      expect(result.current.state.mappings.filter(m => m.plane === 'color')).toHaveLength(1);

      act(() => {
        result.current.setMapping(secondMapping);
      });

      const colorMappings = result.current.state.mappings.filter(m => m.plane === 'color');
      expect(colorMappings).toHaveLength(1);
      expect(colorMappings[0]).toEqual(secondMapping);
    });
  });

  describe('removeMapping', () => {
    it('should remove mapping for specified plane', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const initialMappingsCount = result.current.state.mappings.length;

      act(() => {
        result.current.removeMapping('x');
      });

      expect(result.current.state.mappings.length).toBe(initialMappingsCount - 1);
      expect(result.current.state.mappings.find(m => m.plane === 'x')).toBeUndefined();
    });
  });

  describe('setViewMode', () => {
    it('should update view mode', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.state.viewMode).toBe('grid');

      act(() => {
        result.current.setViewMode('list');
      });

      expect(result.current.state.viewMode).toBe('list');
    });

    it('should preserve mappings when switching to list', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const originalMappings = result.current.state.mappings;

      act(() => {
        result.current.setViewMode('list');
      });

      expect(result.current.state.mappings).toEqual(originalMappings);
    });

    it('should restore grid mappings when switching back to grid', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const originalGridMappings = result.current.state.mappings;

      // Switch to list
      act(() => {
        result.current.setViewMode('list');
      });

      // Modify mappings in list view
      act(() => {
        result.current.setMapping({
          plane: 'x',
          axis: 'alphabet',
          facet: 'name',
        });
      });

      // Switch back to grid
      act(() => {
        result.current.setViewMode('grid');
      });

      // Should restore original grid mappings
      expect(result.current.state.mappings).toEqual(originalGridMappings);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset state to defaults', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      // Modify state
      act(() => {
        result.current.setViewMode('list');
        result.current.setMapping({
          plane: 'color',
          axis: 'hierarchy',
          facet: 'level',
        });
      });

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.state).toEqual(DEFAULT_PAFV);
    });
  });

  describe('convenience methods', () => {
    it('should get axis for plane', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      // Default mappings: x=time, y=category
      expect(result.current.getAxisForPlane('x')).toBe('time');
      expect(result.current.getAxisForPlane('y')).toBe('category');
      expect(result.current.getAxisForPlane('color')).toBeNull();
    });

    it('should get plane for axis', () => {
      const { result } = renderHook(() => usePAFV(), { wrapper });

      // Default mappings: x=time, y=category
      expect(result.current.getPlaneForAxis('time')).toBe('x');
      expect(result.current.getPlaneForAxis('category')).toBe('y');
      expect(result.current.getPlaneForAxis('location')).toBeNull();
    });
  });
});

describe('PAFV Serialization', () => {
  it('should serialize and deserialize state correctly', () => {
    const state = DEFAULT_PAFV;
    const serialized = serializePAFV(state);

    expect(serialized).toBe('x=time.year&y=category.tag&view=grid');

    const deserialized = deserializePAFV(serialized);
    expect(deserialized).toEqual(state);
  });

  it('should handle invalid URL params gracefully', () => {
    const invalidUrl = 'x=invalid&y=broken.test';
    const result = deserializePAFV(invalidUrl);

    // Should fall back to defaults on invalid data
    expect(result).toEqual(DEFAULT_PAFV);
  });

  it('should round-trip serialize/deserialize', () => {
    const state = {
      mappings: [
        { plane: 'x' as const, axis: 'location' as const, facet: 'city' },
        { plane: 'y' as const, axis: 'time' as const, facet: 'month' },
        { plane: 'color' as const, axis: 'category' as const, facet: 'priority' },
      ],
      viewMode: 'list' as const,
    };

    const serialized = serializePAFV(state);
    const deserialized = deserializePAFV(serialized);

    expect(deserialized.viewMode).toBe(state.viewMode);
    expect(deserialized.mappings).toHaveLength(state.mappings.length);

    // Check each mapping exists (order may vary)
    for (const mapping of state.mappings) {
      const found = deserialized.mappings.find(
        m => m.plane === mapping.plane && m.axis === mapping.axis && m.facet === mapping.facet
      );
      expect(found).toBeDefined();
    }
  });
});
