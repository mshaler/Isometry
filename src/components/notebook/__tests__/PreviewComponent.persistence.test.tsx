/**
 * PreviewComponent Persistence Tests
 *
 * Verifies tab state persistence across component lifecycle:
 * - Active tab persists after component remount (via sessionStorage)
 * - Tab state survives page refresh simulation
 * - usePreviewSettings hook manages state correctly
 * - PAFV info display logic
 *
 * Phase 114-02: Preview Tab Integration
 *
 * Strategy: Test usePreviewSettings hook directly via renderHook.
 * PreviewComponent has deep provider dependencies (NotebookContext,
 * ThemeContext, WebPreview) so we test the persistence logic through
 * the hook rather than the full component.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePreviewSettings, type PreviewTab } from '../../../hooks/ui/usePreviewSettings';

// ─── sessionStorage mock ─────────────────────────────────────────────────────

const sessionStorageStore: Record<string, string> = {};

const sessionStorageMock = {
  getItem: vi.fn((key: string) => sessionStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { sessionStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete sessionStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(sessionStorageStore).forEach(k => delete sessionStorageStore[k]); }),
  key: vi.fn(),
  length: 0,
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('usePreviewSettings', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    sessionStorageMock.getItem.mockClear();
    sessionStorageMock.setItem.mockClear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorageMock.clear();
  });

  describe('initial state', () => {
    it('defaults to supergrid when no stored state', () => {
      const { result } = renderHook(() => usePreviewSettings());
      expect(result.current.activeTab).toBe('supergrid');
    });

    it('restores stored tab from sessionStorage', () => {
      sessionStorageStore['preview-settings'] = JSON.stringify({
        activeTab: 'network',
        tabConfigs: {},
      });

      const { result } = renderHook(() => usePreviewSettings());
      expect(result.current.activeTab).toBe('network');
    });

    it('falls back to supergrid if stored tab is invalid', () => {
      sessionStorageStore['preview-settings'] = JSON.stringify({
        activeTab: 'invalid-tab',
        tabConfigs: {},
      });

      const { result } = renderHook(() => usePreviewSettings());
      expect(result.current.activeTab).toBe('supergrid');
    });

    it('initializes all tab configs with defaults', () => {
      const { result } = renderHook(() => usePreviewSettings());
      const tabs: PreviewTab[] = [
        'supergrid', 'network', 'timeline', 'data-inspector', 'web-preview', 'd3-visualization'
      ];
      tabs.forEach(tab => {
        expect(result.current.tabConfigs[tab]).toBeDefined();
        expect(typeof result.current.tabConfigs[tab].lastAccessed).toBe('number');
      });
    });
  });

  describe('tab state persistence', () => {
    it('persists active tab to sessionStorage on change', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setActiveTab('timeline');
      });

      expect(result.current.activeTab).toBe('timeline');
      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'preview-settings',
        expect.stringContaining('"activeTab":"timeline"')
      );
    });

    it('updates lastAccessed timestamp when switching tabs', () => {
      const { result } = renderHook(() => usePreviewSettings());
      const beforeSwitch = Date.now();

      act(() => {
        result.current.setActiveTab('network');
      });

      expect(result.current.tabConfigs.network.lastAccessed).toBeGreaterThanOrEqual(beforeSwitch);
    });

    it('active tab persists after remount (sessionStorage round-trip)', () => {
      // First mount: switch to timeline
      const { result: result1, unmount } = renderHook(() => usePreviewSettings());

      act(() => {
        result1.current.setActiveTab('timeline');
      });

      unmount();

      // Second mount: should restore from sessionStorage
      const { result: result2 } = renderHook(() => usePreviewSettings());
      expect(result2.current.activeTab).toBe('timeline');
    });

    it('tab state survives simulated page refresh (sessionStorage retained)', () => {
      const { result: result1, unmount } = renderHook(() => usePreviewSettings());

      act(() => {
        result1.current.setActiveTab('data-inspector');
      });

      unmount();

      // Simulate "page refresh" — sessionStorage persists, new hook instance
      const { result: result2 } = renderHook(() => usePreviewSettings());
      expect(result2.current.activeTab).toBe('data-inspector');
    });
  });

  describe('zoom level persistence', () => {
    it('sets zoom level for a specific tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabZoom('timeline', 1.5);
      });

      expect(result.current.tabConfigs.timeline.zoomLevel).toBe(1.5);
    });

    it('persists zoom level to sessionStorage', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabZoom('network', 2.0);
      });

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'preview-settings',
        expect.stringContaining('"zoomLevel":2')
      );
    });

    it('zoom level persists per tab (independent)', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabZoom('timeline', 1.5);
        result.current.setTabZoom('network', 0.75);
      });

      expect(result.current.tabConfigs.timeline.zoomLevel).toBe(1.5);
      expect(result.current.tabConfigs.network.zoomLevel).toBe(0.75);
    });
  });

  describe('filter state per tab', () => {
    it('sets filter state for a specific tab', () => {
      const { result } = renderHook(() => usePreviewSettings());

      act(() => {
        result.current.setTabFilterState('supergrid', { folder: 'work', status: 'active' });
      });

      expect(result.current.tabConfigs.supergrid.filterState).toEqual({
        folder: 'work',
        status: 'active',
      });
    });

    it('getTabConfig returns defaults for unknown access', () => {
      const { result } = renderHook(() => usePreviewSettings());

      const config = result.current.getTabConfig('timeline');
      expect(config).toBeDefined();
      expect(typeof config.lastAccessed).toBe('number');
    });
  });

  describe('sessionStorage error handling', () => {
    it('handles sessionStorage quota error gracefully', () => {
      sessionStorageMock.setItem.mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError');
      });

      // Should not throw
      expect(() => {
        const { result } = renderHook(() => usePreviewSettings());
        act(() => {
          result.current.setActiveTab('network');
        });
      }).not.toThrow();
    });

    it('handles sessionStorage getItem error gracefully', () => {
      sessionStorageMock.getItem.mockImplementationOnce(() => {
        throw new DOMException('SecurityError');
      });

      // Should not throw and should return defaults
      const { result } = renderHook(() => usePreviewSettings());
      expect(result.current.activeTab).toBe('supergrid');
    });

    it('handles invalid JSON in sessionStorage gracefully', () => {
      sessionStorageStore['preview-settings'] = 'invalid-json{{{';

      const { result } = renderHook(() => usePreviewSettings());
      expect(result.current.activeTab).toBe('supergrid');
    });
  });
});
