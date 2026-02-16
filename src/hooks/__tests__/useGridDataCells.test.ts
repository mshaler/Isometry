/**
 * Unit tests for useGridDataCells hook
 *
 * Phase 106-02: Data cell query hook testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridDataCells, computeNodePath } from '../useGridDataCells';
import type { FacetConfig } from '@/superstack/types/superstack';

// Mock the SQLite provider
vi.mock('@/db/SQLiteProvider', () => ({
  useSQLite: vi.fn()
}));

import { useSQLite } from '@/db/SQLiteProvider';

describe('computeNodePath', () => {
  const mockFolderFacet: FacetConfig = {
    id: 'folder',
    name: 'Folder',
    axis: 'C',
    sourceColumn: 'folder',
    dataType: 'text',
    sortOrder: 'asc'
  };

  const mockTimeFacet: FacetConfig = {
    id: 'created_year',
    name: 'Year',
    axis: 'T',
    sourceColumn: 'created_at',
    dataType: 'date',
    sortOrder: 'desc'
  };

  const mockTagsFacet: FacetConfig = {
    id: 'tags',
    name: 'Tags',
    axis: 'C',
    sourceColumn: 'tags',
    dataType: 'multi_select',
    sortOrder: 'asc'
  };

  it('extracts path values from node', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      folder: 'Work'
    };

    const path = computeNodePath(node, [mockFolderFacet]);

    expect(path).toEqual(['Work']);
  });

  it('handles null/undefined as (empty)', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      folder: null
    };

    const path = computeNodePath(node, [mockFolderFacet]);

    expect(path).toEqual(['(empty)']);
  });

  it('handles undefined fields as (empty)', () => {
    const node = {
      id: 1,
      name: 'Test Card'
      // folder not defined
    };

    const path = computeNodePath(node, [mockFolderFacet]);

    expect(path).toEqual(['(empty)']);
  });

  it('extracts multiple facet values', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      folder: 'Work',
      created_at: '2024-01-15'
    };

    const path = computeNodePath(node, [mockFolderFacet, mockTimeFacet]);

    expect(path).toEqual(['Work', '2024-01-15']);
  });

  it('handles multi_select dataType by extracting first value from JSON array', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      tags: '["important", "urgent"]'
    };

    const path = computeNodePath(node, [mockTagsFacet]);

    expect(path).toEqual(['important']);
  });

  it('falls back to string conversion for malformed multi_select JSON', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      tags: 'not-json'
    };

    const path = computeNodePath(node, [mockTagsFacet]);

    expect(path).toEqual(['not-json']);
  });

  it('handles empty multi_select array as empty string', () => {
    const node = {
      id: 1,
      name: 'Test Card',
      tags: '[]'
    };

    const path = computeNodePath(node, [mockTagsFacet]);

    expect(path).toEqual(['[]']); // Falls back to string since array is empty
  });

  it('converts numeric values to strings', () => {
    const priorityFacet: FacetConfig = {
      id: 'priority',
      name: 'Priority',
      axis: 'H',
      sourceColumn: 'priority',
      dataType: 'number',
      sortOrder: 'desc'
    };

    const node = {
      id: 1,
      name: 'Test Card',
      priority: 5
    };

    const path = computeNodePath(node, [priorityFacet]);

    expect(path).toEqual(['5']);
  });
});

describe('useGridDataCells', () => {
  const mockFolderFacet: FacetConfig = {
    id: 'folder',
    name: 'Folder',
    axis: 'C',
    sourceColumn: 'folder',
    dataType: 'text',
    sortOrder: 'asc'
  };

  const mockStatusFacet: FacetConfig = {
    id: 'status',
    name: 'Status',
    axis: 'C',
    sourceColumn: 'status',
    dataType: 'select',
    sortOrder: 'asc'
  };

  const mockNodes = [
    {
      id: 1,
      name: 'Card 1',
      folder: 'Work',
      status: 'In Progress',
      tags: null,
      priority: null,
      created_at: '2024-01-15',
      modified_at: '2024-01-16',
      node_type: 'card'
    },
    {
      id: 2,
      name: 'Card 2',
      folder: 'Personal',
      status: 'Done',
      tags: null,
      priority: null,
      created_at: '2024-01-17',
      modified_at: '2024-01-18',
      node_type: 'card'
    }
  ];

  let mockExecute: ReturnType<typeof vi.fn>;
  let mockDb: Record<string, unknown>;

  beforeEach(() => {
    mockExecute = vi.fn().mockReturnValue(mockNodes);
    mockDb = { isReady: () => true };

    vi.mocked(useSQLite).mockReturnValue({
      db: mockDb as any,
      execute: mockExecute,
      loading: false,
      error: null,
      run: vi.fn(),
      save: vi.fn(),
      reset: vi.fn(),
      loadFromFile: vi.fn(),
      capabilities: { fts5: true, json1: true, recursiveCte: true },
      telemetry: [],
      dataVersion: 0,
      storageQuota: null,
      testFTS5Performance: vi.fn()
    });
  });

  it('returns empty array when database not ready', () => {
    vi.mocked(useSQLite).mockReturnValue({
      db: null,
      execute: mockExecute,
      loading: true,
      error: null,
      run: vi.fn(),
      save: vi.fn(),
      reset: vi.fn(),
      loadFromFile: vi.fn(),
      capabilities: { fts5: false, json1: false, recursiveCte: false },
      telemetry: [],
      dataVersion: 0,
      storageQuota: null,
      testFTS5Performance: vi.fn()
    });

    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns empty array when no row facets provided', () => {
    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns empty array when no column facets provided', () => {
    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: []
      })
    );

    expect(result.current).toEqual([]);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  it('returns DataCell[] with correct rowPath and colPath', () => {
    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current).toHaveLength(2);

    // First card
    expect(result.current[0]).toMatchObject({
      rowPath: ['Work'],
      colPath: ['In Progress'],
      value: 'Card 1'
    });

    // Second card
    expect(result.current[1]).toMatchObject({
      rowPath: ['Personal'],
      colPath: ['Done'],
      value: 'Card 2'
    });
  });

  it('includes rawValue with full node object', () => {
    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current[0].rawValue).toMatchObject({
      id: 1,
      name: 'Card 1',
      folder: 'Work',
      status: 'In Progress'
    });
  });

  it('executes SQL query with correct WHERE clause', () => {
    renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(mockExecute).toHaveBeenCalledTimes(1);
    const [sql, params] = mockExecute.mock.calls[0];

    expect(sql).toContain('SELECT');
    expect(sql).toContain('FROM nodes n');
    expect(sql).toContain('WHERE n.deleted_at IS NULL');
    expect(params).toEqual([]);
  });

  it('applies optional whereClause and parameters', () => {
    renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet],
        whereClause: 'n.priority > ?',
        parameters: [3]
      })
    );

    const [sql, params] = mockExecute.mock.calls[0];

    expect(sql).toContain('n.deleted_at IS NULL');
    expect(sql).toContain('n.priority > ?');
    expect(params).toEqual([3]);
  });

  it('applies optional nodeType filter', () => {
    renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet],
        nodeType: 'task'
      })
    );

    const [sql, params] = mockExecute.mock.calls[0];

    expect(sql).toContain('n.node_type = ?');
    expect(params).toEqual(['task']);
  });

  it('re-computes when facets change', () => {
    const { rerender } = renderHook(
      ({ rowFacets, colFacets }) => useGridDataCells({ rowFacets, colFacets }),
      {
        initialProps: {
          rowFacets: [mockFolderFacet],
          colFacets: [mockStatusFacet]
        }
      }
    );

    expect(mockExecute).toHaveBeenCalledTimes(1);

    // Change facets
    const newRowFacet: FacetConfig = {
      id: 'status',
      name: 'Status',
      axis: 'C',
      sourceColumn: 'status',
      dataType: 'select',
      sortOrder: 'asc'
    };

    rerender({
      rowFacets: [newRowFacet],
      colFacets: [mockStatusFacet]
    });

    // Should re-execute query
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('handles query errors gracefully', () => {
    mockExecute.mockImplementation(() => {
      throw new Error('Query failed');
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[useGridDataCells]'),
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('handles empty result set', () => {
    mockExecute.mockReturnValue([]);

    const { result } = renderHook(() =>
      useGridDataCells({
        rowFacets: [mockFolderFacet],
        colFacets: [mockStatusFacet]
      })
    );

    expect(result.current).toEqual([]);
  });
});
