/**
 * Unit tests for gridPlacement.ts
 *
 * Tests CSS Grid placement calculations for headers and data cells.
 */

import { describe, it, expect } from 'vitest';
import {
  computeRowHeaderPlacement,
  computeColHeaderPlacement,
  computeDataCellPlacement,
  computeCornerCellPlacement,
  generateGridTemplate,
  placementToStyle,
} from '../utils/gridPlacement';
import type { FlatNode, AxisNode, TreeMetrics } from '../types';

// Reference image parameters:
// - 3 row header columns (depth 3: category → subcategory → item)
// - 2 column header rows (depth 2: year → quarter)
const ROW_HEADER_DEPTH = 3; // C: columns for row headers
const COL_HEADER_DEPTH = 2; // R: rows for column headers

describe('computeRowHeaderPlacement', () => {
  describe('FutureME (depth 0, spans rows 0-11)', () => {
    const futureME: FlatNode = {
      node: { label: 'FutureME', id: 'futureme' } as AxisNode,
      depth: 0,
      leafStart: 0,
      leafCount: 12,
      path: ['root', 'futureme'],
      isLeaf: false,
    };

    it('places FutureME in column 1', () => {
      const placement = computeRowHeaderPlacement(futureME, COL_HEADER_DEPTH);
      expect(placement.gridColumnStart).toBe(1);
      expect(placement.gridColumnEnd).toBe(2);
    });

    it('spans rows 3-15 (after 2 header rows, spanning 12 data rows)', () => {
      const placement = computeRowHeaderPlacement(futureME, COL_HEADER_DEPTH);
      // Row 3 = after 2 column header rows (R + 1 = 3)
      expect(placement.gridRowStart).toBe(3);
      // Row 15 = 3 + 12 leaves
      expect(placement.gridRowEnd).toBe(15);
    });
  });

  describe('Learning (depth 1, spans rows 0-3)', () => {
    const learning: FlatNode = {
      node: { label: 'Learning', id: 'learning' } as AxisNode,
      depth: 1,
      leafStart: 0,
      leafCount: 4,
      path: ['root', 'futureme', 'learning'],
      isLeaf: false,
    };

    it('places Learning in column 2', () => {
      const placement = computeRowHeaderPlacement(learning, COL_HEADER_DEPTH);
      expect(placement.gridColumnStart).toBe(2);
      expect(placement.gridColumnEnd).toBe(3);
    });

    it('spans rows 3-7 (4 rows)', () => {
      const placement = computeRowHeaderPlacement(learning, COL_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(7);
    });
  });

  describe('Growth (depth 1, spans rows 4-7)', () => {
    const growth: FlatNode = {
      node: { label: 'Growth', id: 'growth' } as AxisNode,
      depth: 1,
      leafStart: 4,
      leafCount: 4,
      path: ['root', 'futureme', 'growth'],
      isLeaf: false,
    };

    it('places Growth in column 2', () => {
      const placement = computeRowHeaderPlacement(growth, COL_HEADER_DEPTH);
      expect(placement.gridColumnStart).toBe(2);
      expect(placement.gridColumnEnd).toBe(3);
    });

    it('spans rows 7-11 (4 rows starting at leaf 4)', () => {
      const placement = computeRowHeaderPlacement(growth, COL_HEADER_DEPTH);
      // Row = 2 (header rows) + 1 + 4 (leafStart) = 7
      expect(placement.gridRowStart).toBe(7);
      expect(placement.gridRowEnd).toBe(11);
    });
  });

  describe('Tools (depth 2, leaf at row 0)', () => {
    const tools: FlatNode = {
      node: { label: 'Tools', id: 'tools' } as AxisNode,
      depth: 2,
      leafStart: 0,
      leafCount: 1,
      path: ['root', 'futureme', 'learning', 'tools'],
      isLeaf: true,
    };

    it('places Tools in column 3', () => {
      const placement = computeRowHeaderPlacement(tools, COL_HEADER_DEPTH);
      expect(placement.gridColumnStart).toBe(3);
      expect(placement.gridColumnEnd).toBe(4);
    });

    it('occupies single row 3', () => {
      const placement = computeRowHeaderPlacement(tools, COL_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(4);
    });
  });

  describe('Fitness (depth 2, leaf at row 4)', () => {
    const fitness: FlatNode = {
      node: { label: 'Fitness', id: 'fitness' } as AxisNode,
      depth: 2,
      leafStart: 4,
      leafCount: 1,
      path: ['root', 'futureme', 'growth', 'fitness'],
      isLeaf: true,
    };

    it('occupies single row 7', () => {
      const placement = computeRowHeaderPlacement(fitness, COL_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(7);
      expect(placement.gridRowEnd).toBe(8);
    });
  });
});

describe('computeColHeaderPlacement', () => {
  describe('2022 (depth 0, spans cols 0-3)', () => {
    const year2022: FlatNode = {
      node: { label: '2022', id: '2022' } as AxisNode,
      depth: 0,
      leafStart: 0,
      leafCount: 4,
      path: ['root', '2022'],
      isLeaf: false,
    };

    it('places 2022 in row 1', () => {
      const placement = computeColHeaderPlacement(year2022, ROW_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(1);
      expect(placement.gridRowEnd).toBe(2);
    });

    it('spans columns 4-8 (after 3 header cols, spanning 4 data cols)', () => {
      const placement = computeColHeaderPlacement(year2022, ROW_HEADER_DEPTH);
      // Column 4 = after 3 row header columns (C + 1 = 4)
      expect(placement.gridColumnStart).toBe(4);
      // Column 8 = 4 + 4 quarters
      expect(placement.gridColumnEnd).toBe(8);
    });
  });

  describe('Q1 (depth 1, leaf at col 0)', () => {
    const q1: FlatNode = {
      node: { label: 'Q1', id: '2022-q1' } as AxisNode,
      depth: 1,
      leafStart: 0,
      leafCount: 1,
      path: ['root', '2022', '2022-q1'],
      isLeaf: true,
    };

    it('places Q1 in row 2', () => {
      const placement = computeColHeaderPlacement(q1, ROW_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(2);
      expect(placement.gridRowEnd).toBe(3);
    });

    it('occupies single column 4', () => {
      const placement = computeColHeaderPlacement(q1, ROW_HEADER_DEPTH);
      expect(placement.gridColumnStart).toBe(4);
      expect(placement.gridColumnEnd).toBe(5);
    });
  });

  describe('Q3 (depth 1, leaf at col 2)', () => {
    const q3: FlatNode = {
      node: { label: 'Q3', id: '2022-q3' } as AxisNode,
      depth: 1,
      leafStart: 2,
      leafCount: 1,
      path: ['root', '2022', '2022-q3'],
      isLeaf: true,
    };

    it('occupies single column 6', () => {
      const placement = computeColHeaderPlacement(q3, ROW_HEADER_DEPTH);
      // Column = 3 (header cols) + 1 + 2 (leafStart) = 6
      expect(placement.gridColumnStart).toBe(6);
      expect(placement.gridColumnEnd).toBe(7);
    });
  });
});

describe('computeDataCellPlacement', () => {
  describe('first data cell (0, 0)', () => {
    it('places at row 3, column 4', () => {
      const placement = computeDataCellPlacement(0, 0, COL_HEADER_DEPTH, ROW_HEADER_DEPTH);
      expect(placement.gridRowStart).toBe(3);
      expect(placement.gridRowEnd).toBe(4);
      expect(placement.gridColumnStart).toBe(4);
      expect(placement.gridColumnEnd).toBe(5);
    });
  });

  describe('cell at (5, 2) - 6th row, 3rd column', () => {
    it('places at row 8, column 6', () => {
      const placement = computeDataCellPlacement(5, 2, COL_HEADER_DEPTH, ROW_HEADER_DEPTH);
      // Row = 2 (col headers) + 1 + 5 = 8
      expect(placement.gridRowStart).toBe(8);
      expect(placement.gridRowEnd).toBe(9);
      // Col = 3 (row headers) + 1 + 2 = 6
      expect(placement.gridColumnStart).toBe(6);
      expect(placement.gridColumnEnd).toBe(7);
    });
  });

  describe('last cell in reference image (25, 3)', () => {
    it('places at row 28, column 7', () => {
      const placement = computeDataCellPlacement(25, 3, COL_HEADER_DEPTH, ROW_HEADER_DEPTH);
      // Row = 2 + 1 + 25 = 28
      expect(placement.gridRowStart).toBe(28);
      expect(placement.gridRowEnd).toBe(29);
      // Col = 3 + 1 + 3 = 7
      expect(placement.gridColumnStart).toBe(7);
      expect(placement.gridColumnEnd).toBe(8);
    });
  });
});

describe('computeCornerCellPlacement', () => {
  it('places (0, 0) corner at grid position (1, 1)', () => {
    const placement = computeCornerCellPlacement(0, 0);
    expect(placement.gridRowStart).toBe(1);
    expect(placement.gridRowEnd).toBe(2);
    expect(placement.gridColumnStart).toBe(1);
    expect(placement.gridColumnEnd).toBe(2);
  });

  it('places (1, 2) corner at grid position (2, 3)', () => {
    const placement = computeCornerCellPlacement(1, 2);
    expect(placement.gridRowStart).toBe(2);
    expect(placement.gridRowEnd).toBe(3);
    expect(placement.gridColumnStart).toBe(3);
    expect(placement.gridColumnEnd).toBe(4);
  });
});

describe('generateGridTemplate', () => {
  const rowMetrics: TreeMetrics = {
    depth: 3,
    leafCount: 26,
    flatNodes: [],
  };

  const colMetrics: TreeMetrics = {
    depth: 2,
    leafCount: 4,
    flatNodes: [],
  };

  it('generates correct column template (3 headers + 4 data)', () => {
    const { columns } = generateGridTemplate(rowMetrics, colMetrics);
    const parts = columns.split(' ');

    // 3 header columns + 4 data columns = 7 total
    expect(parts).toHaveLength(7);
  });

  it('generates correct row template (2 headers + 26 data)', () => {
    const { rows } = generateGridTemplate(rowMetrics, colMetrics);
    const parts = rows.split(' ');

    // 2 header rows + 26 data rows = 28 total
    expect(parts).toHaveLength(28);
  });

  it('uses default sizes', () => {
    const { columns, rows } = generateGridTemplate(rowMetrics, colMetrics);

    // Default header width is 100px
    expect(columns.startsWith('100px 100px 100px')).toBe(true);
    // Default data width is 70px
    expect(columns.includes('70px')).toBe(true);
  });

  it('respects custom options', () => {
    const { columns, rows } = generateGridTemplate(rowMetrics, colMetrics, {
      headerColumnWidth: '150px',
      headerRowHeight: '40px',
      dataColumnWidth: '100px',
      dataRowHeight: '36px',
    });

    expect(columns.includes('150px')).toBe(true);
    expect(columns.includes('100px')).toBe(true);
    expect(rows.includes('40px')).toBe(true);
    expect(rows.includes('36px')).toBe(true);
  });
});

describe('placementToStyle', () => {
  it('converts placement to CSS style object', () => {
    const placement = {
      gridRowStart: 3,
      gridRowEnd: 7,
      gridColumnStart: 2,
      gridColumnEnd: 3,
    };

    const style = placementToStyle(placement);

    expect(style.gridRowStart).toBe(3);
    expect(style.gridRowEnd).toBe(7);
    expect(style.gridColumnStart).toBe(2);
    expect(style.gridColumnEnd).toBe(3);
  });
});

describe('integration: full reference image layout', () => {
  // Validates the complete grid matches reference image specs
  // 3 row header columns × 2 col header rows = 6 corner cells
  // 26 data rows × 4 data columns = 104 data cells
  // Total grid: 7 columns × 28 rows

  it('corner cells fill top-left rectangle', () => {
    const corners = [];
    for (let r = 0; r < COL_HEADER_DEPTH; r++) {
      for (let c = 0; c < ROW_HEADER_DEPTH; c++) {
        corners.push(computeCornerCellPlacement(r, c));
      }
    }

    expect(corners).toHaveLength(6);

    // Check they cover rows 1-2, cols 1-3
    const rows = new Set(corners.flatMap((p) => [p.gridRowStart, p.gridRowEnd]));
    const cols = new Set(corners.flatMap((p) => [p.gridColumnStart, p.gridColumnEnd]));

    expect(rows.has(1)).toBe(true);
    expect(rows.has(3)).toBe(true);
    expect(cols.has(1)).toBe(true);
    expect(cols.has(4)).toBe(true);
  });

  it('data cell (0,0) is adjacent to first row header and first col header', () => {
    const dataCell = computeDataCellPlacement(0, 0, COL_HEADER_DEPTH, ROW_HEADER_DEPTH);
    const rowHeader: FlatNode = {
      node: { label: 'Tools', id: 'tools' } as AxisNode,
      depth: 2,
      leafStart: 0,
      leafCount: 1,
      path: ['root', 'futureme', 'learning', 'tools'],
      isLeaf: true,
    };
    const colHeader: FlatNode = {
      node: { label: 'Q1', id: '2022-q1' } as AxisNode,
      depth: 1,
      leafStart: 0,
      leafCount: 1,
      path: ['root', '2022', '2022-q1'],
      isLeaf: true,
    };

    const rowHeaderPlacement = computeRowHeaderPlacement(rowHeader, COL_HEADER_DEPTH);
    const colHeaderPlacement = computeColHeaderPlacement(colHeader, ROW_HEADER_DEPTH);

    // Data cell row should match row header row
    expect(dataCell.gridRowStart).toBe(rowHeaderPlacement.gridRowStart);

    // Data cell column should match col header column
    expect(dataCell.gridColumnStart).toBe(colHeaderPlacement.gridColumnStart);
  });
});
