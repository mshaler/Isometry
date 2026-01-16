import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PAFVProvider, usePAFV } from './PAFVContext';

const createWrapper = (initialEntries: string[] = ['/']) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <PAFVProvider>{children}</PAFVProvider>
    </MemoryRouter>
  );
};

describe('PAFVContext', () => {
  describe('initial state', () => {
    it('initializes with default well configuration', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.wells.available).toBeDefined();
      expect(result.current.wells.xRows).toBeDefined();
      expect(result.current.wells.yColumns).toBeDefined();
      expect(result.current.wells.zLayers).toBeDefined();
    });

    it('has default chips in xRows', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.wells.xRows).toHaveLength(3);
      expect(result.current.wells.xRows[0].id).toBe('folder');
    });

    it('has default chips in yColumns', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.wells.yColumns).toHaveLength(2);
      expect(result.current.wells.yColumns[0].id).toBe('year');
    });

    it('has audit view chip in zLayers with checkbox', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.wells.zLayers).toHaveLength(1);
      expect(result.current.wells.zLayers[0].hasCheckbox).toBe(true);
      expect(result.current.wells.zLayers[0].checked).toBe(false);
    });
  });

  describe('moveChip', () => {
    it('moves chip from one well to another', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      const initialXCount = result.current.wells.xRows.length;
      const initialYCount = result.current.wells.yColumns.length;

      act(() => {
        result.current.moveChip('xRows', 0, 'yColumns', 0);
      });

      expect(result.current.wells.xRows).toHaveLength(initialXCount - 1);
      expect(result.current.wells.yColumns).toHaveLength(initialYCount + 1);
    });

    it('moves chip to available well', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      act(() => {
        result.current.moveChip('xRows', 0, 'available', 0);
      });

      expect(result.current.wells.available).toHaveLength(1);
      expect(result.current.wells.available[0].id).toBe('folder');
    });
  });

  describe('toggleCheckbox', () => {
    it('toggles chip checkbox state', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      expect(result.current.wells.zLayers[0].checked).toBe(false);

      act(() => {
        result.current.toggleCheckbox('zLayers', 'auditview');
      });

      expect(result.current.wells.zLayers[0].checked).toBe(true);
    });

    it('toggles checkbox back to false', () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => usePAFV(), { wrapper });

      act(() => {
        result.current.toggleCheckbox('zLayers', 'auditview');
        result.current.toggleCheckbox('zLayers', 'auditview');
      });

      expect(result.current.wells.zLayers[0].checked).toBe(false);
    });
  });

  describe('error handling', () => {
    it('throws when used outside provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter>{children}</MemoryRouter>
      );

      expect(() => {
        renderHook(() => usePAFV(), { wrapper });
      }).toThrow('usePAFV must be used within a PAFVProvider');
    });
  });
});
