/**
 * usePropertyClassification Hook Tests
 *
 * Tests the React hook that provides property classification data.
 * This is Task 0.2 from the Navigators GSD Plan.
 *
 * Test requirements from the plan:
 * - Returns classification after db initialization
 * - Caches results across re-renders
 *
 * Phase 50 FOUND-03: React-friendly access with caching and refresh
 * - dataVersion-based cache invalidation
 * - refresh() function clears cache and reloads
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import type { PropertyClassification } from '../../../services/property-classifier';

// Mock db.exec on the database object (classifyProperties calls db.exec() directly)
const mockDbExec = vi.fn();
const mockDb = {
  exec: mockDbExec,
};

// Mutable state for testing - allows changing dataVersion and loading between renders
const mockState = {
  dataVersion: 1,
  loading: false,
  error: null as Error | null,
};

// Mock the SQLite context with getters for mutable state
const mockSQLiteContext = {
  get db() { return mockDb; },
  get loading() { return mockState.loading; },
  set loading(v: boolean) { mockState.loading = v; },
  get error() { return mockState.error; },
  execute: vi.fn(),
  run: vi.fn(),
  save: vi.fn(),
  reset: vi.fn(),
  loadFromFile: vi.fn(),
  capabilities: { fts5: true, json1: true, recursiveCte: true },
  telemetry: [],
  get dataVersion() { return mockState.dataVersion; },
  storageQuota: null,
  testFTS5Performance: vi.fn(),
};

// Mock the useSQLite hook
vi.mock('../../../db/SQLiteProvider', () => ({
  useSQLite: () => mockSQLiteContext,
}));

// Import after mocking
import { usePropertyClassification } from '../usePropertyClassification';

describe('usePropertyClassification Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mutable state for each test
    mockState.loading = false;
    mockState.dataVersion = 1;
    mockState.error = null;

    // Default mock response: simulate facets table query via db.exec()
    // The classifyProperties service calls db.exec() directly, not execute()
    mockDbExec.mockReturnValue([
      {
        columns: ['id', 'name', 'facet_type', 'axis', 'source_column', 'enabled', 'sort_order'],
        values: [
          ['folder', 'Folder', 'select', 'C', 'folder', 1, 0],
          ['tags', 'Tags', 'multi_select', 'C', 'tags', 1, 1],
          ['status', 'Status', 'select', 'C', 'status', 1, 2],
          ['priority', 'Priority', 'number', 'H', 'priority', 1, 0],
          ['created', 'Created', 'date', 'T', 'created_at', 1, 0],
          ['modified', 'Modified', 'date', 'T', 'modified_at', 1, 1],
          ['due', 'Due Date', 'date', 'T', 'due_at', 1, 2],
          ['name', 'Name', 'text', 'A', 'name', 1, 0],
          ['location', 'Location', 'location', 'L', 'location_name', 1, 0],
        ],
      },
    ]);
  });

  test('returns classification after db initialization', async () => {
    const { result } = renderHook(() => usePropertyClassification());

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should have classification data
    expect(result.current.classification).not.toBeNull();
    expect(result.current.error).toBeNull();

    // Verify LATCH buckets
    const classification = result.current.classification!;
    expect(classification.L).toHaveLength(1);
    expect(classification.A).toHaveLength(1);
    expect(classification.T).toHaveLength(3);
    expect(classification.C).toHaveLength(3);
    expect(classification.H).toHaveLength(1);

    // Verify GRAPH bucket (4 edge types + 2 metrics)
    expect(classification.GRAPH).toHaveLength(6);
  });

  test('caches results across re-renders', async () => {
    const { result, rerender } = renderHook(() => usePropertyClassification());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const firstClassification = result.current.classification;

    // Re-render the hook
    rerender();

    // Should return the same cached object (referential equality)
    expect(result.current.classification).toBe(firstClassification);

    // Execute should not be called again
    expect(mockDbExec).toHaveBeenCalledTimes(1);
  });

  test('provides refresh function that reloads data', async () => {
    const { result } = renderHook(() => usePropertyClassification());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockDbExec).toHaveBeenCalledTimes(1);

    // Call refresh
    act(() => {
      result.current.refresh();
    });

    // Should call execute again
    await waitFor(() => {
      expect(mockDbExec).toHaveBeenCalledTimes(2);
    });
  });

  test('handles loading state correctly', () => {
    // Set loading state
    mockState.loading = true;

    const { result } = renderHook(() => usePropertyClassification());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.classification).toBeNull();
  });

  test('handles error state correctly', async () => {
    // Make execute throw an error
    mockDbExec.mockImplementation(() => {
      throw new Error('Database query failed');
    });

    const { result } = renderHook(() => usePropertyClassification());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Database query failed');
    expect(result.current.classification).toBeNull();
  });

  describe('cache invalidation with dataVersion', () => {
    test('[FOUND-03] uses cached result when dataVersion unchanged', async () => {
      const { result, rerender } = renderHook(() => usePropertyClassification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const firstResult = result.current.classification;
      const callCountBefore = mockDbExec.mock.calls.length;

      // Rerender without changing dataVersion
      rerender();

      // Should use cache, not call exec again
      expect(mockDbExec.mock.calls.length).toBe(callCountBefore);
      expect(result.current.classification).toBe(firstResult);
    });

    test('[FOUND-03] reloads when dataVersion changes', async () => {
      const { result, rerender } = renderHook(() => usePropertyClassification());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callCountBefore = mockDbExec.mock.calls.length;

      // Simulate dataVersion change (database mutation)
      mockState.dataVersion = 2;
      rerender();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have called exec again due to version change
      expect(mockDbExec.mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('Phase 50 Requirements Traceability', () => {
    test('[FOUND-03] provides cached, refreshable access to classification', async () => {
      const { result, rerender } = renderHook(() => usePropertyClassification());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify classification is returned
      expect(result.current.classification).not.toBeNull();

      // Verify refresh function exists
      expect(typeof result.current.refresh).toBe('function');

      // Verify caching works (rerender returns same object)
      const firstClassification = result.current.classification;
      rerender();
      expect(result.current.classification).toBe(firstClassification);

      // Verify refresh invalidates cache
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Classification should be fresh (may or may not be same reference depending on data)
      expect(result.current.classification).not.toBeNull();
    });
  });
});
