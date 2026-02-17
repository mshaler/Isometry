/**
 * Three-Canvas Notebook Integration Tests
 *
 * Validates Phase 116 deliverables for state preservation and resize coordination.
 * Tests the 5x tab switch requirement and cross-pane state preservation.
 *
 * Phase 116-03: Polish & Integration Testing
 * REQ-D-03: Tab state preservation across 5 consecutive switches
 * REQ-D-04: Pane resize coordination with 500ms debounce
 * REQ-NF-01: Tab switch under 16ms (60 FPS target)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { usePreviewSettings, type PreviewTab } from '@/hooks/ui/usePreviewSettings';
import { PaneLayoutProvider, usePaneLayout } from '../../../context/PaneLayoutContext';
import type { ReactNode } from 'react';

describe('Three-Canvas Notebook Integration', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.useFakeTimers();
    // Reset window dimensions
    Object.defineProperty(window, 'innerWidth', { value: 1200, writable: true, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('State Preservation (REQ-D-03)', () => {
    it('preserves scroll position across 5 consecutive tab switches', () => {
      const { result } = renderHook(() => usePreviewSettings());

      const tabs: PreviewTab[] = ['supergrid', 'network', 'timeline', 'data-inspector', 'web-preview'];
      const scrollPositions = [
        { x: 0, y: 100 },
        { x: 50, y: 200 },
        { x: 100, y: 300 },
        { x: 150, y: 400 },
        { x: 200, y: 500 },
      ];

      // Set scroll positions for each tab
      act(() => {
        tabs.forEach((tab, i) => {
          result.current.setTabScrollPosition(tab, scrollPositions[i]);
        });
      });

      // Switch through all tabs twice to verify persistence
      for (let round = 0; round < 2; round++) {
        tabs.forEach((tab, i) => {
          act(() => {
            result.current.setActiveTab(tab);
          });
          expect(result.current.getTabConfig(tab).scrollPosition).toEqual(scrollPositions[i]);
        });
      }
    });

    it('preserves zoom level across tab switches', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabZoom('supergrid', 150);
        result.current.setTabZoom('network', 75);
      });

      // Switch away and back
      act(() => result.current.setActiveTab('network'));
      act(() => result.current.setActiveTab('supergrid'));

      expect(result.current.getTabConfig('supergrid').zoomLevel).toBe(150);
      expect(result.current.getTabConfig('network').zoomLevel).toBe(75);
    });

    it('maintains independent state per tab (no cross-contamination)', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('supergrid', { x: 100, y: 200 });
        result.current.setTabZoom('supergrid', 125);
        result.current.setTabScrollPosition('network', { x: 300, y: 400 });
        result.current.setTabZoom('network', 80);
      });

      // Verify isolation
      const supergridConfig = result.current.getTabConfig('supergrid');
      const networkConfig = result.current.getTabConfig('network');

      expect(supergridConfig.scrollPosition).toEqual({ x: 100, y: 200 });
      expect(supergridConfig.zoomLevel).toBe(125);
      expect(networkConfig.scrollPosition).toEqual({ x: 300, y: 400 });
      expect(networkConfig.zoomLevel).toBe(80);
    });

    it('restores state from sessionStorage on hook remount', () => {
      // First mount - set state
      const { result: first, unmount } = renderHook(() => usePreviewSettings());

      act(() => {
        first.current.setTabScrollPosition('timeline', { x: 500, y: 600 });
        first.current.setTabZoom('timeline', 200);
      });

      unmount();

      // Second mount - verify restoration
      const { result: second } = renderHook(() => usePreviewSettings());

      expect(second.current.getTabConfig('timeline').scrollPosition).toEqual({ x: 500, y: 600 });
      expect(second.current.getTabConfig('timeline').zoomLevel).toBe(200);
    });
  });

  describe('Pane Resize Coordination (REQ-D-04)', () => {
    it('debounces resize events with 500ms delay', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider>{children}</PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      // Rapid resizes
      for (let i = 0; i < 3; i++) {
        Object.defineProperty(window, 'innerWidth', { value: 1200 + (i * 100), writable: true, configurable: true });
        act(() => {
          window.dispatchEvent(new Event('resize'));
          vi.advanceTimersByTime(100);
        });
      }

      // Still showing old dimensions during debounce
      expect(result.current.isResizing).toBe(true);
      expect(result.current.containerWidth).toBe(1200);

      // After debounce completes
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current.isResizing).toBe(false);
      expect(result.current.containerWidth).toBe(1400); // 1200 + 200
    });

    it('calculates pane dimensions from panel percentages', () => {
      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider panelPercentages={{ capture: 40, shell: 30, preview: 30 }}>
          {children}
        </PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      expect(result.current.dimensions.capture.width).toBe(480);  // 40% of 1200
      expect(result.current.dimensions.shell.width).toBe(360);    // 30% of 1200
      expect(result.current.dimensions.preview.width).toBe(360);  // 30% of 1200
    });

    it('handles minimum pane widths without overflow', () => {
      Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <PaneLayoutProvider panelPercentages={{ capture: 15, shell: 15, preview: 70 }}>
          {children}
        </PaneLayoutProvider>
      );

      const { result } = renderHook(() => usePaneLayout(), { wrapper });

      // Even at narrow width, dimensions are calculated correctly
      expect(result.current.dimensions.capture.width).toBe(90);   // 15% of 600
      expect(result.current.dimensions.preview.width).toBe(420);  // 70% of 600
      expect(result.current.containerWidth).toBe(600);
    });
  });

  describe('Performance (REQ-NF-01)', () => {
    it('processes tab switch in under 16ms (60 FPS target)', () => {
      const { result } = renderHook(() => usePreviewSettings());

      const start = performance.now();

      act(() => {
        result.current.setActiveTab('network');
        result.current.setTabScrollPosition('network', { x: 100, y: 200 });
        result.current.setTabZoom('network', 125);
      });

      const duration = performance.now() - start;

      // Tab switch operations should be fast (under 16ms for 60 FPS)
      expect(duration).toBeLessThan(16);
    });

    it('handles state updates without blocking', () => {
      const { result } = renderHook(() => usePreviewSettings());

      const tabs: PreviewTab[] = ['supergrid', 'network', 'timeline', 'data-inspector'];

      const start = performance.now();

      // Simulate rapid tab switching
      act(() => {
        for (let i = 0; i < 20; i++) {
          const tab = tabs[i % tabs.length];
          result.current.setActiveTab(tab);
          result.current.setTabScrollPosition(tab, { x: i * 10, y: i * 20 });
        }
      });

      const duration = performance.now() - start;

      // 20 state updates should complete in reasonable time
      expect(duration).toBeLessThan(100);
    });
  });
});
