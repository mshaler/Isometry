/**
 * useNodeDeepLink tests
 *
 * Tests for the URL deep linking hook that allows focusing on specific nodes
 * via ?nodeId= parameter.
 *
 * @see Phase 78-01: URL Deep Linking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useNodeDeepLink } from '../useNodeDeepLink';
import { SelectionProvider, useSelection } from '../../../state/SelectionContext';
import type { Database } from 'sql.js';

// Mock useSQLite hook
const mockDb = {
  exec: vi.fn()
} as unknown as Database;

const mockUseSQLite = vi.fn(() => ({
  db: mockDb,
  loading: false
}));

vi.mock('../../../db/SQLiteProvider', () => ({
  useSQLite: () => mockUseSQLite()
}));

// Mock devLogger
vi.mock('../../../utils/logging', () => ({
  devLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

// Helper to set URL params
function setUrlParam(key: string, value: string | null): void {
  const url = new URL(window.location.href);
  if (value === null) {
    url.searchParams.delete(key);
  } else {
    url.searchParams.set(key, value);
  }
  window.history.replaceState({}, '', url.toString());
}

// Wrapper that provides SelectionProvider
function createWrapper() {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <SelectionProvider>{children}</SelectionProvider>;
  };
}

describe('useNodeDeepLink', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    // Clear URL params
    setUrlParam('nodeId', null);
    // Reset mock db to return node exists
    mockDb.exec = vi.fn().mockReturnValue([{ values: [['test-node-id']] }]);
    // Reset useSQLite mock
    mockUseSQLite.mockReturnValue({ db: mockDb, loading: false });
  });

  afterEach(() => {
    // Clean up URL params
    setUrlParam('nodeId', null);
  });

  describe('valid nodeId', () => {
    it('selects node when valid nodeId is in URL', async () => {
      setUrlParam('nodeId', 'test-node-id');

      // Use a combined hook that returns selection state
      const { result } = renderHook(
        () => {
          useNodeDeepLink();
          return useSelection();
        },
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const selectedIds = Array.from(result.current.selection.selectedIds);
        expect(selectedIds).toContain('test-node-id');
      });
    });

    it('verifies node exists in database before selecting', async () => {
      setUrlParam('nodeId', 'verified-node');

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(mockDb.exec).toHaveBeenCalledWith(
          'SELECT id FROM nodes WHERE id = ? AND deleted_at IS NULL',
          ['verified-node']
        );
      });
    });

    it('keeps URL param for shareability', async () => {
      setUrlParam('nodeId', 'shareable-node');

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      await waitFor(() => {
        // URL param should still be present
        const params = new URLSearchParams(window.location.search);
        expect(params.get('nodeId')).toBe('shareable-node');
      });
    });
  });

  describe('invalid nodeId', () => {
    it('logs warning for non-existent node', async () => {
      const { devLogger } = await import('../../../utils/logging');
      setUrlParam('nodeId', 'non-existent');
      // Mock db to return empty result
      mockDb.exec = vi.fn().mockReturnValue([]);

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(devLogger.warn).toHaveBeenCalledWith(
          'Deep link node not found',
          { nodeId: 'non-existent' }
        );
      });
    });

    it('does not crash on invalid nodeId', async () => {
      setUrlParam('nodeId', 'invalid-node');
      mockDb.exec = vi.fn().mockReturnValue([]);

      // Should not throw
      expect(() => {
        renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });
      }).not.toThrow();
    });

    it('handles empty result values array', async () => {
      setUrlParam('nodeId', 'empty-result');
      mockDb.exec = vi.fn().mockReturnValue([{ values: [] }]);

      const { devLogger } = await import('../../../utils/logging');

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      await waitFor(() => {
        expect(devLogger.warn).toHaveBeenCalledWith(
          'Deep link node not found',
          { nodeId: 'empty-result' }
        );
      });
    });
  });

  describe('no nodeId', () => {
    it('does nothing when no nodeId param', async () => {
      // No nodeId set

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      // db.exec should not be called
      await waitFor(() => {
        expect(mockDb.exec).not.toHaveBeenCalled();
      });
    });

    it('does not select any node', async () => {
      const { result } = renderHook(
        () => {
          useNodeDeepLink();
          return useSelection();
        },
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        expect(result.current.selection.selectedIds.size).toBe(0);
      });
    });
  });

  describe('loading state', () => {
    it('waits for database to be ready', async () => {
      setUrlParam('nodeId', 'wait-for-db');
      mockUseSQLite.mockReturnValue({ db: mockDb, loading: true });

      renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });

      // Should not query while loading
      expect(mockDb.exec).not.toHaveBeenCalled();
    });

    it('processes deep link after database loads', async () => {
      setUrlParam('nodeId', 'after-load');

      // Start with loading=true
      mockUseSQLite.mockReturnValue({ db: mockDb, loading: true });

      const { rerender } = renderHook(() => useNodeDeepLink(), {
        wrapper: createWrapper()
      });

      // Should not query yet
      expect(mockDb.exec).not.toHaveBeenCalled();

      // Now database is ready
      mockUseSQLite.mockReturnValue({ db: mockDb, loading: false });
      rerender();

      await waitFor(() => {
        expect(mockDb.exec).toHaveBeenCalled();
      });
    });
  });

  describe('duplicate processing', () => {
    it('processes same nodeId only once', async () => {
      setUrlParam('nodeId', 'only-once');

      const { rerender } = renderHook(() => useNodeDeepLink(), {
        wrapper: createWrapper()
      });

      await waitFor(() => {
        expect(mockDb.exec).toHaveBeenCalledTimes(1);
      });

      // Trigger re-render
      rerender();

      // Should still only be called once
      expect(mockDb.exec).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling', () => {
    it('handles database errors gracefully', async () => {
      const { devLogger } = await import('../../../utils/logging');
      setUrlParam('nodeId', 'error-node');
      mockDb.exec = vi.fn().mockImplementation(() => {
        throw new Error('Database error');
      });

      // Should not throw
      expect(() => {
        renderHook(() => useNodeDeepLink(), { wrapper: createWrapper() });
      }).not.toThrow();

      await waitFor(() => {
        expect(devLogger.error).toHaveBeenCalledWith(
          'Deep link error',
          expect.objectContaining({
            nodeId: 'error-node',
            error: 'Database error'
          })
        );
      });
    });
  });
});
