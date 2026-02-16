/**
 * Unit tests for useGridLayout hook
 *
 * Tests the complete grid layout computation from axis configurations.
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGridLayout, getCellKey, parseCellKey } from '../hooks/useGridLayout';
import type { AxisConfig } from '../types';

// Reference image row axis (simplified for testing)
const rowAxis: AxisConfig = {
  type: 'C',
  facet: 'category',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: 'FutureME',
        id: 'futureme',
        children: [
          {
            label: 'Learning',
            id: 'learning',
            children: [
              { label: 'Tools', id: 'tools' },
              { label: 'Progress', id: 'progress' },
            ],
          },
          {
            label: 'Growth',
            id: 'growth',
            children: [
              { label: 'Fitness', id: 'fitness' },
              { label: 'Health', id: 'health' },
            ],
          },
        ],
      },
    ],
  },
};

// Reference image column axis
const colAxis: AxisConfig = {
  type: 'T',
  facet: 'year_quarter',
  tree: {
    label: 'Root',
    id: 'root',
    children: [
      {
        label: '2022',
        id: '2022',
        children: [
          { label: 'Q1', id: '2022-q1' },
          { label: 'Q2', id: '2022-q2' },
        ],
      },
    ],
  },
};

describe('useGridLayout', () => {
  it('computes row metrics correctly', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    expect(result.current.rowMetrics.depth).toBe(3);
    expect(result.current.rowMetrics.leafCount).toBe(4);
  });

  it('computes column metrics correctly', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    expect(result.current.colMetrics.depth).toBe(2);
    expect(result.current.colMetrics.leafCount).toBe(2);
  });

  it('generates correct grid template dimensions', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    const { columns, rows } = result.current.gridTemplate;
    const colParts = columns.split(' ');
    const rowParts = rows.split(' ');

    // 3 row header columns + 2 data columns = 5
    expect(colParts).toHaveLength(5);

    // 2 col header rows + 4 data rows = 6
    expect(rowParts).toHaveLength(6);
  });

  it('generates correct number of corner cells', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    // 2 col header rows × 3 row header columns = 6 corners
    expect(result.current.cornerCells).toHaveLength(6);
  });

  it('generates correct number of row headers', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    // FutureME, Learning, Growth, Tools, Progress, Fitness, Health = 7
    expect(result.current.rowHeaders).toHaveLength(7);
  });

  it('generates correct number of column headers', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    // 2022, Q1, Q2 = 3
    expect(result.current.colHeaders).toHaveLength(3);
  });

  it('generates correct number of data cells', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    // 4 row leaves × 2 col leaves = 8
    expect(result.current.dataCells).toHaveLength(8);
  });

  it('computes rowHeaderDepth and colHeaderDepth', () => {
    const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));

    expect(result.current.rowHeaderDepth).toBe(3);
    expect(result.current.colHeaderDepth).toBe(2);
  });

  describe('row header placements', () => {
    it('FutureME spans all 4 rows', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const futureME = result.current.rowHeaders.find((h) => h.node.id === 'futureme');

      expect(futureME).toBeDefined();
      expect(futureME?.placement.gridColumnStart).toBe(1);
      expect(futureME?.placement.gridRowEnd - futureME!.placement.gridRowStart).toBe(4);
    });

    it('Learning spans 2 rows', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const learning = result.current.rowHeaders.find((h) => h.node.id === 'learning');

      expect(learning?.placement.gridColumnStart).toBe(2);
      expect(learning?.placement.gridRowEnd - learning!.placement.gridRowStart).toBe(2);
    });

    it('Tools is a leaf in column 3', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const tools = result.current.rowHeaders.find((h) => h.node.id === 'tools');

      expect(tools?.placement.gridColumnStart).toBe(3);
      expect(tools?.isLeaf).toBe(true);
      expect(tools?.placement.gridRowEnd - tools!.placement.gridRowStart).toBe(1);
    });
  });

  describe('column header placements', () => {
    it('2022 spans 2 columns', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const year2022 = result.current.colHeaders.find((h) => h.node.id === '2022');

      expect(year2022).toBeDefined();
      expect(year2022?.placement.gridRowStart).toBe(1);
      expect(year2022?.placement.gridColumnEnd - year2022!.placement.gridColumnStart).toBe(2);
    });

    it('Q1 is a leaf in row 2', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const q1 = result.current.colHeaders.find((h) => h.node.id === '2022-q1');

      expect(q1?.placement.gridRowStart).toBe(2);
      expect(q1?.isLeaf).toBe(true);
    });
  });

  describe('data cell placements', () => {
    it('first data cell is at correct position', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const firstCell = result.current.dataCells[0];

      // After 2 col header rows and 3 row header columns
      expect(firstCell.placement.gridRowStart).toBe(3);
      expect(firstCell.placement.gridColumnStart).toBe(4);
    });

    it('data cells reference correct leaf nodes', () => {
      const { result } = renderHook(() => useGridLayout(rowAxis, colAxis));
      const firstCell = result.current.dataCells[0];

      expect(firstCell.rowLeaf.node.id).toBe('tools');
      expect(firstCell.colLeaf.node.id).toBe('2022-q1');
    });
  });

  describe('memoization', () => {
    it('returns same object reference when axes unchanged', () => {
      const { result, rerender } = renderHook(() => useGridLayout(rowAxis, colAxis));

      const firstLayout = result.current;
      rerender();
      const secondLayout = result.current;

      expect(firstLayout).toBe(secondLayout);
    });
  });
});

describe('getCellKey', () => {
  it('creates key from row and column paths', () => {
    const key = getCellKey(['root', 'futureme', 'learning', 'tools'], ['root', '2022', '2022-q1']);

    expect(key).toBe('root/futureme/learning/tools::root/2022/2022-q1');
  });

  it('handles single-element paths', () => {
    const key = getCellKey(['item'], ['col']);

    expect(key).toBe('item::col');
  });
});

describe('parseCellKey', () => {
  it('parses key back into paths', () => {
    const key = 'root/futureme/learning/tools::root/2022/2022-q1';
    const result = parseCellKey(key);

    expect(result).toEqual({
      rowPath: ['root', 'futureme', 'learning', 'tools'],
      colPath: ['root', '2022', '2022-q1'],
    });
  });

  it('returns null for invalid key', () => {
    const result = parseCellKey('invalid-key-no-separator');

    expect(result).toBeNull();
  });

  it('returns null for key with wrong separator count', () => {
    const result = parseCellKey('a::b::c');

    expect(result).toBeNull();
  });
});
