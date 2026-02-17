import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { PaneLayoutProvider, usePaneLayout, usePaneLayoutOptional } from './PaneLayoutContext';
import type { ReactNode } from 'react';

describe('PaneLayoutContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('usePaneLayout', () => {
    it('throws when used outside provider', () => {
      expect(() => {
        renderHook(() => usePaneLayout());
      }).toThrow('usePaneLayout must be used within PaneLayoutProvider');
    });

    it('provides initial dimensions from window size', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      expect(result.current.containerWidth).toBe(1200);
      expect(result.current.containerHeight).toBe(800);
      expect(result.current.isResizing).toBe(false);
    });

    it('calculates pane dimensions from percentages', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider panelPercentages={{ capture: 50, shell: 25, preview: 25 }}>
          {children}
        </PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      expect(result.current.dimensions.capture.width).toBe(600); // 50% of 1200
      expect(result.current.dimensions.shell.width).toBe(300);   // 25% of 1200
      expect(result.current.dimensions.preview.width).toBe(300); // 25% of 1200
    });
  });

  describe('resize handling', () => {
    it('sets isResizing true on window resize', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      expect(result.current.isResizing).toBe(false);

      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      expect(result.current.isResizing).toBe(true);
    });

    it('updates dimensions after 500ms debounce', () => {
      Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      // Simulate resize
      Object.defineProperty(window, 'innerWidth', { value: 1600, writable: true, configurable: true });
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // Before debounce completes
      expect(result.current.containerWidth).toBe(1200);
      expect(result.current.isResizing).toBe(true);

      // After 500ms debounce
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.containerWidth).toBe(1600);
      expect(result.current.isResizing).toBe(false);
    });

    it('debounces rapid resize events', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      // Multiple rapid resizes
      act(() => {
        for (let i = 0; i < 5; i++) {
          window.dispatchEvent(new Event('resize'));
          vi.advanceTimersByTime(100);
        }
      });

      // Still resizing because debounce keeps getting reset
      expect(result.current.isResizing).toBe(true);

      // Wait for debounce after last resize
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isResizing).toBe(false);
    });
  });

  describe('usePaneLayoutOptional', () => {
    it('returns null when used outside provider', () => {
      const { result } = renderHook(() => usePaneLayoutOptional());
      expect(result.current).toBeNull();
    });

    it('returns context when inside provider', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayoutOptional(), { wrapper });
      expect(result.current).not.toBeNull();
      expect(result.current?.containerWidth).toBe(1200);
    });
  });
});
