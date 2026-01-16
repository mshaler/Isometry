import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useURLState } from './useURLState';

const createWrapper = (initialEntries: string[]) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
};

describe('useURLState', () => {
  it('reads initial value from URL params', () => {
    const wrapper = createWrapper(['/?app=Demo&view=List']);
    const { result } = renderHook(() => useURLState<string>('app', 'Default'), { wrapper });
    expect(result.current[0]).toBe('Demo');
  });

  it('returns default value when param not in URL', () => {
    const wrapper = createWrapper(['/']);
    const { result } = renderHook(() => useURLState<string>('missing', 'DefaultValue'), { wrapper });
    expect(result.current[0]).toBe('DefaultValue');
  });

  it('updates URL when value changes', () => {
    const wrapper = createWrapper(['/?app=Demo']);
    const { result } = renderHook(() => useURLState<string>('app', 'Default'), { wrapper });

    act(() => {
      result.current[1]('Projects');
    });

    expect(result.current[0]).toBe('Projects');
  });

  it('preserves other URL params when updating', () => {
    const wrapper = createWrapper(['/?app=Demo&view=List']);
    const { result: appResult } = renderHook(() => useURLState<string>('app', 'Default'), { wrapper });
    const { result: viewResult } = renderHook(() => useURLState<string>('view', 'Default'), { wrapper });

    act(() => {
      appResult.current[1]('Projects');
    });

    // View should still be List
    expect(viewResult.current[0]).toBe('List');
  });

  it('removes param when set to default value', () => {
    const wrapper = createWrapper(['/?app=Projects']);
    const { result } = renderHook(() => useURLState<string>('app', 'Demo'), { wrapper });

    act(() => {
      result.current[1]('Demo'); // Set to default
    });

    expect(result.current[0]).toBe('Demo');
  });
});
