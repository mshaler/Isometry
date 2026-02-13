/**
 * FilterDropdown Tests - D3-based dropdown UI component
 *
 * TDD: These tests define the expected behavior for the filter dropdown.
 * The dropdown renders at a given position with checkboxes for values.
 *
 * Plan 75-01: SuperFilter - Header Dropdown Filters
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import {
  FilterDropdown,
  type FilterDropdownConfig,
} from '../FilterDropdown';

describe('FilterDropdown', () => {
  let dom: JSDOM;
  let document: Document;
  let body: HTMLBodyElement;

  beforeEach(() => {
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    document = dom.window.document;
    body = document.body as HTMLBodyElement;
    // Set up d3 to use the JSDOM document
    (global as any).document = document;
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).document;
  });

  const createDropdown = (config?: Partial<FilterDropdownConfig>) => {
    return new FilterDropdown({
      onToggleValue: vi.fn(),
      onSelectAll: vi.fn(),
      onClearFilter: vi.fn(),
      onApply: vi.fn(),
      onClose: vi.fn(),
      ...config,
    });
  };

  const sampleValues = [
    { value: 'Active', count: 12, selected: true },
    { value: 'Pending', count: 8, selected: true },
    { value: 'Done', count: 25, selected: false },
    { value: 'Blocked', count: 3, selected: false },
  ];

  describe('render', () => {
    it('should create dropdown container at specified position', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 100, y: 50 }, 'Status', sampleValues);

      const container = body.querySelector('.supergrid-filter-dropdown') as HTMLElement;
      expect(container).toBeDefined();
      expect(container.style.left).toBe('100px');
      expect(container.style.top).toBe('50px');
    });

    it('should render header with facet name', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const header = body.querySelector('.filter-dropdown-header');
      expect(header?.textContent).toContain('Status');
    });

    it('should render checkbox for each value with count', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const items = body.querySelectorAll('.filter-dropdown-item');
      expect(items.length).toBe(4);

      const firstItem = items[0];
      expect(firstItem.textContent).toContain('Active');
      expect(firstItem.textContent).toContain('12');
    });

    it('should mark selected values as checked', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      // Get item checkboxes (not the Select All checkbox)
      const checkboxes = body.querySelectorAll('.filter-dropdown-item .filter-checkbox') as NodeListOf<HTMLInputElement>;
      expect(checkboxes[0].checked).toBe(true);  // Active - selected
      expect(checkboxes[1].checked).toBe(true);  // Pending - selected
      expect(checkboxes[2].checked).toBe(false); // Done - not selected
      expect(checkboxes[3].checked).toBe(false); // Blocked - not selected
    });

    it('should render Select All checkbox', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const selectAll = body.querySelector('.filter-select-all');
      expect(selectAll).toBeDefined();
      expect(selectAll?.textContent).toContain('Select All');
    });

    it('should render Clear and Apply buttons', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const clearBtn = body.querySelector('.filter-clear-btn');
      const applyBtn = body.querySelector('.filter-apply-btn');
      expect(clearBtn).toBeDefined();
      expect(applyBtn).toBeDefined();
    });
  });

  describe('checkbox interactions', () => {
    it('should call onToggleValue when checkbox clicked', () => {
      const onToggleValue = vi.fn();
      const dropdown = createDropdown({ onToggleValue });

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      // Get item checkboxes (not the Select All checkbox)
      const checkboxes = body.querySelectorAll('.filter-dropdown-item .filter-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes[2].click(); // Click "Done" checkbox

      expect(onToggleValue).toHaveBeenCalledWith('Done');
    });

    it('should call onSelectAll when Select All clicked', () => {
      const onSelectAll = vi.fn();
      const dropdown = createDropdown({ onSelectAll });

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const selectAll = body.querySelector('.filter-select-all input') as HTMLInputElement;
      selectAll.click();

      expect(onSelectAll).toHaveBeenCalled();
    });
  });

  describe('action buttons', () => {
    it('should call onClearFilter when Clear clicked', () => {
      const onClearFilter = vi.fn();
      const dropdown = createDropdown({ onClearFilter });

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const clearBtn = body.querySelector('.filter-clear-btn') as HTMLButtonElement;
      clearBtn.click();

      expect(onClearFilter).toHaveBeenCalled();
    });

    it('should call onApply when Apply clicked', () => {
      const onApply = vi.fn();
      const dropdown = createDropdown({ onApply });

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const applyBtn = body.querySelector('.filter-apply-btn') as HTMLButtonElement;
      applyBtn.click();

      expect(onApply).toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('should remove dropdown from DOM', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);
      expect(body.querySelector('.supergrid-filter-dropdown')).toBeDefined();

      dropdown.destroy();
      expect(body.querySelector('.supergrid-filter-dropdown')).toBeNull();
    });

    it('should call onClose when destroyed', () => {
      const onClose = vi.fn();
      const dropdown = createDropdown({ onClose });

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);
      dropdown.destroy();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update checkbox states without re-rendering', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      // Update with new selected states
      const updatedValues = sampleValues.map(v => ({
        ...v,
        selected: v.value === 'Done', // Only Done selected now
      }));

      dropdown.updateValues(updatedValues);

      // Get item checkboxes (not the Select All checkbox)
      const checkboxes = body.querySelectorAll('.filter-dropdown-item .filter-checkbox') as NodeListOf<HTMLInputElement>;
      expect(checkboxes[0].checked).toBe(false); // Active - no longer selected
      expect(checkboxes[2].checked).toBe(true);  // Done - now selected
    });
  });

  describe('Select All state', () => {
    it('should show Select All as checked when all values selected', () => {
      const dropdown = createDropdown();
      const allSelected = sampleValues.map(v => ({ ...v, selected: true }));

      dropdown.render(body, { x: 0, y: 0 }, 'Status', allSelected);

      const selectAllCheckbox = body.querySelector('.filter-select-all input') as HTMLInputElement;
      expect(selectAllCheckbox.checked).toBe(true);
    });

    it('should show Select All as unchecked when some values not selected', () => {
      const dropdown = createDropdown();

      dropdown.render(body, { x: 0, y: 0 }, 'Status', sampleValues);

      const selectAllCheckbox = body.querySelector('.filter-select-all input') as HTMLInputElement;
      expect(selectAllCheckbox.checked).toBe(false);
    });
  });
});
