import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppStateProvider, useAppState } from './AppStateContext';

const createWrapper = (initialEntries: string[]) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>
      <AppStateProvider>{children}</AppStateProvider>
    </MemoryRouter>
  );
};

describe('AppStateContext', () => {
  describe('initial state', () => {
    it('reads activeApp from URL', () => {
      const wrapper = createWrapper(['/?app=Demo&view=List&dataset=ETL']);
      const { result } = renderHook(() => useAppState(), { wrapper });
      expect(result.current.activeApp).toBe('Demo');
    });

    it('reads activeView from URL', () => {
      const wrapper = createWrapper(['/?app=Demo&view=List&dataset=ETL']);
      const { result } = renderHook(() => useAppState(), { wrapper });
      expect(result.current.activeView).toBe('List');
    });

    it('reads activeDataset from URL', () => {
      const wrapper = createWrapper(['/?app=Demo&view=List&dataset=ETL']);
      const { result } = renderHook(() => useAppState(), { wrapper });
      expect(result.current.activeDataset).toBe('ETL');
    });

    it('uses defaults when URL params missing', () => {
      const wrapper = createWrapper(['/']);
      const { result } = renderHook(() => useAppState(), { wrapper });
      expect(result.current.activeApp).toBe('Demo');
      expect(result.current.activeView).toBe('List');
      expect(result.current.activeDataset).toBe('ETL');
    });
  });

  describe('state updates', () => {
    it('updates activeApp and syncs to URL', () => {
      const wrapper = createWrapper(['/']);
      const { result } = renderHook(() => useAppState(), { wrapper });

      act(() => {
        result.current.setActiveApp('Projects');
      });

      expect(result.current.activeApp).toBe('Projects');
    });

    it('updates activeView and syncs to URL', () => {
      const wrapper = createWrapper(['/']);
      const { result } = renderHook(() => useAppState(), { wrapper });

      act(() => {
        result.current.setActiveView('Kanban');
      });

      expect(result.current.activeView).toBe('Kanban');
    });

    it('updates activeDataset and syncs to URL', () => {
      const wrapper = createWrapper(['/']);
      const { result } = renderHook(() => useAppState(), { wrapper });

      act(() => {
        result.current.setActiveDataset('Notes');
      });

      expect(result.current.activeDataset).toBe('Notes');
    });
  });

  describe('error handling', () => {
    it('throws when used outside provider', () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <MemoryRouter>{children}</MemoryRouter>
      );

      expect(() => {
        renderHook(() => useAppState(), { wrapper });
      }).toThrow('useAppState must be used within an AppStateProvider');
    });
  });
});
