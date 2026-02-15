import { describe, it, expect, vi } from 'vitest';
import * as d3 from 'd3';
import { SuperGrid } from '../SuperGrid';

describe('SuperGrid query/render cycle', () => {
  it('executes one DB query and one render call for a single query() invocation', () => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      configurable: true,
    });

    const execMock = vi.fn(() => [
      {
        columns: ['id', 'name', 'folder', 'status', 'created_at'],
        values: [['1', 'A', 'Work', 'active', '2025-01-01']],
      },
    ]);

    const databaseService = {
      getRawDatabase: () => ({ exec: execMock }),
      run: vi.fn(),
      transaction: vi.fn(),
    } as unknown as Parameters<typeof SuperGrid>[1];

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    document.body.appendChild(svg);
    const selection = d3.select(svg) as unknown as d3.Selection<SVGElement, unknown, null, undefined>;

    const superGrid = new SuperGrid(selection, databaseService, {
      enableHeaders: true,
      enableSelection: true,
      enableDragDrop: true,
      enableKeyboardNavigation: true,
    });

    const renderSpy = vi.spyOn(superGrid as unknown as { render: () => void }, 'render');

    superGrid.query({
      whereClause: 'deleted_at IS NULL',
      parameters: [],
      activeFilters: [],
      isEmpty: false,
    });

    expect(execMock).toHaveBeenCalledTimes(1);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    superGrid.destroy();
  });
});
