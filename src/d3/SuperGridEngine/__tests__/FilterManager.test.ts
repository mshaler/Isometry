/**
 * FilterManager Tests - Header dropdown filter management
 *
 * TDD: These tests define the expected behavior for SuperFilter.
 * FilterManager tracks active filters per header, manages dropdown state,
 * and compiles header filters to LATCH WHERE clauses.
 *
 * Plan 75-01: SuperFilter - Header Dropdown Filters
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FilterManager,
  type HeaderFilter,
  type FilterManagerConfig,
  compileHeaderFiltersToSQL,
} from '../FilterManager';
import type { CellDescriptor, LATCHAxis } from '../types';

describe('FilterManager', () => {
  // Sample cells for testing unique value extraction
  const sampleCells: CellDescriptor[] = [
    { id: 'cell-0-0', gridX: 0, gridY: 0, xValue: 'Active', yValue: 'Q1', nodeIds: ['n1', 'n2'], nodeCount: 2 },
    { id: 'cell-1-0', gridX: 1, gridY: 0, xValue: 'Pending', yValue: 'Q1', nodeIds: ['n3'], nodeCount: 1 },
    { id: 'cell-0-1', gridX: 0, gridY: 1, xValue: 'Active', yValue: 'Q2', nodeIds: ['n4', 'n5'], nodeCount: 2 },
    { id: 'cell-1-1', gridX: 1, gridY: 1, xValue: 'Done', yValue: 'Q2', nodeIds: ['n6'], nodeCount: 1 },
    { id: 'cell-2-0', gridX: 2, gridY: 0, xValue: 'Blocked', yValue: 'Q1', nodeIds: ['n7'], nodeCount: 1 },
    { id: 'cell-2-1', gridX: 2, gridY: 1, xValue: 'Pending', yValue: 'Q2', nodeIds: ['n8'], nodeCount: 1 },
  ];

  const createFilterManager = (config?: Partial<FilterManagerConfig>) => {
    return new FilterManager({
      onFilterChange: vi.fn(),
      ...config,
    });
  };

  describe('getUniqueValues', () => {
    it('should extract distinct X values from cells with counts', () => {
      const fm = createFilterManager();

      const values = fm.getUniqueValues('x', sampleCells);

      expect(values).toHaveLength(4);
      expect(values.map(v => v.value)).toContain('Active');
      expect(values.map(v => v.value)).toContain('Pending');
      expect(values.map(v => v.value)).toContain('Done');
      expect(values.map(v => v.value)).toContain('Blocked');
    });

    it('should extract distinct Y values from cells with counts', () => {
      const fm = createFilterManager();

      const values = fm.getUniqueValues('y', sampleCells);

      expect(values).toHaveLength(2);
      expect(values.map(v => v.value)).toContain('Q1');
      expect(values.map(v => v.value)).toContain('Q2');
    });

    it('should return correct node counts for each value', () => {
      const fm = createFilterManager();

      const values = fm.getUniqueValues('x', sampleCells);
      const activeValue = values.find(v => v.value === 'Active');

      // Active appears in cell-0-0 (2 nodes) and cell-0-1 (2 nodes) = 4 total
      expect(activeValue?.count).toBe(4);
    });

    it('should sort values alphabetically', () => {
      const fm = createFilterManager();

      const values = fm.getUniqueValues('x', sampleCells);

      expect(values[0].value).toBe('Active');
      expect(values[1].value).toBe('Blocked');
      expect(values[2].value).toBe('Done');
      expect(values[3].value).toBe('Pending');
    });

    it('should handle empty cells array', () => {
      const fm = createFilterManager();

      const values = fm.getUniqueValues('x', []);

      expect(values).toHaveLength(0);
    });
  });

  describe('filter state management', () => {
    it('should initialize with no active filters', () => {
      const fm = createFilterManager();

      expect(fm.getActiveFilters()).toHaveLength(0);
      expect(fm.hasActiveFilter('header-1')).toBe(false);
    });

    it('should create filter when opening dropdown', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });

      expect(fm.getOpenDropdownId()).toBe('header-1');
      expect(fm.hasActiveFilter('header-1')).toBe(false); // Not active until values unselected
    });

    it('should close dropdown and clear if all values selected', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.closeDropdown();

      expect(fm.getOpenDropdownId()).toBeNull();
      expect(fm.hasActiveFilter('header-1')).toBe(false);
    });
  });

  describe('toggleValue', () => {
    it('should deselect a value when toggled off', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');

      const filter = fm.getFilter('header-1');
      expect(filter?.selectedValues.has('Active')).toBe(true);
      expect(filter?.selectedValues.has('Pending')).toBe(true);
      expect(filter?.selectedValues.has('Done')).toBe(false);
    });

    it('should select a value when toggled on', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done'); // Deselect
      fm.toggleValue('header-1', 'Done'); // Select again

      const filter = fm.getFilter('header-1');
      expect(filter?.selectedValues.has('Done')).toBe(true);
    });

    it('should mark filter as active when not all values selected', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');

      expect(fm.hasActiveFilter('header-1')).toBe(true);
    });
  });

  describe('selectAll', () => {
    it('should select all values when called', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done'); // Deselect one
      fm.selectAll('header-1');

      const filter = fm.getFilter('header-1');
      expect(filter?.selectedValues.size).toBe(3);
      expect(filter?.selectedValues.has('Active')).toBe(true);
      expect(filter?.selectedValues.has('Pending')).toBe(true);
      expect(filter?.selectedValues.has('Done')).toBe(true);
    });
  });

  describe('clearFilter', () => {
    it('should reset filter to all values selected', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.toggleValue('header-1', 'Active');
      fm.clearFilter('header-1');

      const filter = fm.getFilter('header-1');
      expect(filter?.selectedValues.size).toBe(3);
    });

    it('should mark filter as inactive after clearing', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');
      expect(fm.hasActiveFilter('header-1')).toBe(true);

      fm.clearFilter('header-1');
      fm.applyFilter('header-1');
      expect(fm.hasActiveFilter('header-1')).toBe(false);
    });

    it('should call onFilterChange callback after clearing', () => {
      const onFilterChange = vi.fn();
      const fm = createFilterManager({ onFilterChange });
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');
      fm.clearFilter('header-1');
      fm.applyFilter('header-1');

      expect(onFilterChange).toHaveBeenCalled();
    });
  });

  describe('applyFilter', () => {
    it('should call onFilterChange with active filters', () => {
      const onFilterChange = vi.fn();
      const fm = createFilterManager({ onFilterChange });
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');

      expect(onFilterChange).toHaveBeenCalledWith(expect.any(Array));
      const calledWith = onFilterChange.mock.calls[0][0] as HeaderFilter[];
      expect(calledWith).toHaveLength(1);
      expect(calledWith[0].headerId).toBe('header-1');
    });

    it('should close dropdown after applying', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');

      expect(fm.getOpenDropdownId()).toBeNull();
    });
  });

  describe('hasActiveFilter', () => {
    it('should return false when all values are selected', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.applyFilter('header-1');

      expect(fm.hasActiveFilter('header-1')).toBe(false);
    });

    it('should return true when some values are deselected', () => {
      const fm = createFilterManager();
      const allValues = ['Active', 'Pending', 'Done'];

      fm.openDropdown('header-1', 'Category', 'status', allValues, { x: 100, y: 50 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');

      expect(fm.hasActiveFilter('header-1')).toBe(true);
    });

    it('should return false for unknown header', () => {
      const fm = createFilterManager();

      expect(fm.hasActiveFilter('unknown-header')).toBe(false);
    });
  });

  describe('multiple filters', () => {
    it('should support multiple active filters on different headers', () => {
      const fm = createFilterManager();

      fm.openDropdown('header-1', 'Category', 'status', ['Active', 'Pending', 'Done'], { x: 0, y: 0 });
      fm.toggleValue('header-1', 'Done');
      fm.applyFilter('header-1');

      fm.openDropdown('header-2', 'Time', 'quarter', ['Q1', 'Q2', 'Q3', 'Q4'], { x: 0, y: 0 });
      fm.toggleValue('header-2', 'Q3');
      fm.toggleValue('header-2', 'Q4');
      fm.applyFilter('header-2');

      expect(fm.hasActiveFilter('header-1')).toBe(true);
      expect(fm.hasActiveFilter('header-2')).toBe(true);
      expect(fm.getActiveFilters()).toHaveLength(2);
    });
  });
});

describe('compileHeaderFiltersToSQL', () => {
  it('should compile single value filter to equals clause', () => {
    const filters: HeaderFilter[] = [{
      headerId: 'header-1',
      axis: 'Category' as LATCHAxis,
      facet: 'status',
      selectedValues: new Set(['Active']),
      allValues: ['Active', 'Pending', 'Done'],
    }];

    const sql = compileHeaderFiltersToSQL(filters);

    expect(sql).toBe("status = 'Active'");
  });

  it('should compile multiple values filter to IN clause', () => {
    const filters: HeaderFilter[] = [{
      headerId: 'header-1',
      axis: 'Category' as LATCHAxis,
      facet: 'status',
      selectedValues: new Set(['Active', 'Pending']),
      allValues: ['Active', 'Pending', 'Done'],
    }];

    const sql = compileHeaderFiltersToSQL(filters);

    expect(sql).toBe("status IN ('Active', 'Pending')");
  });

  it('should return empty string when all values selected', () => {
    const filters: HeaderFilter[] = [{
      headerId: 'header-1',
      axis: 'Category' as LATCHAxis,
      facet: 'status',
      selectedValues: new Set(['Active', 'Pending', 'Done']),
      allValues: ['Active', 'Pending', 'Done'],
    }];

    const sql = compileHeaderFiltersToSQL(filters);

    expect(sql).toBe('');
  });

  it('should join multiple filters with AND', () => {
    const filters: HeaderFilter[] = [
      {
        headerId: 'header-1',
        axis: 'Category' as LATCHAxis,
        facet: 'status',
        selectedValues: new Set(['Active', 'Pending']),
        allValues: ['Active', 'Pending', 'Done'],
      },
      {
        headerId: 'header-2',
        axis: 'Time' as LATCHAxis,
        facet: 'quarter',
        selectedValues: new Set(['Q1', 'Q2']),
        allValues: ['Q1', 'Q2', 'Q3', 'Q4'],
      },
    ];

    const sql = compileHeaderFiltersToSQL(filters);

    expect(sql).toContain("status IN ('Active', 'Pending')");
    expect(sql).toContain("quarter IN ('Q1', 'Q2')");
    expect(sql).toContain(' AND ');
  });

  it('should handle empty filters array', () => {
    const sql = compileHeaderFiltersToSQL([]);

    expect(sql).toBe('');
  });

  it('should escape single quotes in values', () => {
    const filters: HeaderFilter[] = [{
      headerId: 'header-1',
      axis: 'Alphabet' as LATCHAxis,
      facet: 'name',
      selectedValues: new Set(["O'Brien"]),
      allValues: ["O'Brien", "Smith"],
    }];

    const sql = compileHeaderFiltersToSQL(filters);

    expect(sql).toBe("name = 'O''Brien'");
  });
});
