/**
 * usePreviewSettings tests
 *
 * Tests for the Preview pane settings hook including per-tab zoom,
 * filter state, and scroll position persistence.
 *
 * @see Phase 116-01: Scroll Position Persistence
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreviewSettings } from './usePreviewSettings';

describe('usePreviewSettings', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  describe('initial state', () => {
    it('returns supergrid as the default active tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      expect(result.current.activeTab).toBe('supergrid');
    });

    it('returns default tab config with lastAccessed for all tabs', () => {
      const { result } = renderHook(() => usePreviewSettings());

      const config = result.current.getTabConfig('network');
      expect(config.lastAccessed).toBe(0);
      expect(config.scrollPosition).toBeUndefined();
    });
  });

  describe('setTabScrollPosition', () => {
    it('stores scroll position for a tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('supergrid', { x: 100, y: 200 });
      });

      expect(result.current.getTabConfig('supergrid').scrollPosition).toEqual({ x: 100, y: 200 });
    });

    it('persists scroll position to sessionStorage', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('network', { x: 50, y: 150 });
      });

      const stored = JSON.parse(sessionStorage.getItem('preview-settings') || '{}') as {
        tabConfigs?: { network?: { scrollPosition?: { x: number; y: number } } };
      };
      expect(stored.tabConfigs?.network?.scrollPosition).toEqual({ x: 50, y: 150 });
    });

    it('preserves scroll position across hook re-renders', () => {
      const { result, rerender } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('timeline', { x: 300, y: 400 });
      });

      rerender();

      expect(result.current.getTabConfig('timeline').scrollPosition).toEqual({ x: 300, y: 400 });
    });

    it('maintains independent scroll positions per tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('supergrid', { x: 10, y: 20 });
        result.current.setTabScrollPosition('network', { x: 30, y: 40 });
      });

      expect(result.current.getTabConfig('supergrid').scrollPosition).toEqual({ x: 10, y: 20 });
      expect(result.current.getTabConfig('network').scrollPosition).toEqual({ x: 30, y: 40 });
    });

    it('updates scroll position when called multiple times for same tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabScrollPosition('timeline', { x: 100, y: 200 });
      });

      act(() => {
        result.current.setTabScrollPosition('timeline', { x: 500, y: 600 });
      });

      expect(result.current.getTabConfig('timeline').scrollPosition).toEqual({ x: 500, y: 600 });
    });

    it('preserves other tab config fields when setting scroll position', () => {
      const { result } = renderHook(() => usePreviewSettings());

      // First set zoom level
      act(() => {
        result.current.setTabZoom('data-inspector', 150);
      });

      // Then set scroll position — zoom should remain
      act(() => {
        result.current.setTabScrollPosition('data-inspector', { x: 0, y: 250 });
      });

      const config = result.current.getTabConfig('data-inspector');
      expect(config.zoomLevel).toBe(150);
      expect(config.scrollPosition).toEqual({ x: 0, y: 250 });
    });
  });

  describe('sessionStorage persistence', () => {
    it('loads scroll position from sessionStorage on mount', () => {
      // Pre-populate sessionStorage
      sessionStorage.setItem('preview-settings', JSON.stringify({
        activeTab: 'network',
        tabConfigs: {
          supergrid: { lastAccessed: 0 },
          network: { lastAccessed: 1000, scrollPosition: { x: 75, y: 125 } },
          timeline: { lastAccessed: 0 },
          'data-inspector': { lastAccessed: 0 },
          'web-preview': { lastAccessed: 0 },
          'd3-visualization': { lastAccessed: 0 },
        },
      }));

      const { result } = renderHook(() => usePreviewSettings());

      expect(result.current.getTabConfig('network').scrollPosition).toEqual({ x: 75, y: 125 });
    });
  });
});
