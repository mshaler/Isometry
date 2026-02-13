/**
 * FilterManager - Header dropdown filter state management
 *
 * Manages active filters per header, dropdown state, and compiles
 * header filters to SQL WHERE clauses for the LATCH filter pipeline.
 *
 * Plan 75-01: SuperFilter - Header Dropdown Filters
 */

import type { CellDescriptor, LATCHAxis } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a single header filter state.
 */
export interface HeaderFilter {
  /** ID of the header this filter applies to */
  headerId: string;
  /** The LATCH axis this header represents */
  axis: LATCHAxis;
  /** The facet/column being filtered (e.g., 'status', 'quarter') */
  facet: string;
  /** Set of currently selected values */
  selectedValues: Set<string>;
  /** All possible values for this header */
  allValues: string[];
}

/**
 * Value with count for dropdown display.
 */
export interface ValueWithCount {
  value: string;
  count: number;
}

/**
 * Configuration for FilterManager.
 */
export interface FilterManagerConfig {
  /** Callback when active filters change */
  onFilterChange: (filters: HeaderFilter[]) => void;
}

/**
 * Internal filter state tracking.
 */
interface FilterState {
  filter: HeaderFilter;
  /** Whether filter has been applied (has unsaved changes) */
  isApplied: boolean;
}

// ============================================================================
// FilterManager Class
// ============================================================================

/**
 * Manages header dropdown filter state.
 *
 * Lifecycle:
 * 1. User clicks filter icon -> openDropdown()
 * 2. User toggles values -> toggleValue()
 * 3. User clicks Apply -> applyFilter() -> onFilterChange callback
 * 4. User clicks Clear -> clearFilter() -> resets to all selected
 */
export class FilterManager {
  private config: FilterManagerConfig;
  private filters: Map<string, FilterState> = new Map();
  private openDropdownId: string | null = null;
  private dropdownPosition: { x: number; y: number } | null = null;

  constructor(config: FilterManagerConfig) {
    this.config = config;
  }

  // ==========================================================================
  // Unique Value Extraction
  // ==========================================================================

  /**
   * Extract unique values from cells for a given axis with counts.
   *
   * @param axis - 'x' or 'y' to determine which cell value to extract
   * @param cells - Array of cell descriptors
   * @returns Array of unique values with their node counts, sorted alphabetically
   */
  getUniqueValues(axis: 'x' | 'y', cells: CellDescriptor[]): ValueWithCount[] {
    const valueCounts = new Map<string, number>();

    for (const cell of cells) {
      const value = axis === 'x' ? cell.xValue : cell.yValue;
      const currentCount = valueCounts.get(value) || 0;
      valueCounts.set(value, currentCount + cell.nodeCount);
    }

    const result: ValueWithCount[] = [];
    for (const [value, count] of valueCounts) {
      result.push({ value, count });
    }

    // Sort alphabetically
    result.sort((a, b) => a.value.localeCompare(b.value));

    return result;
  }

  // ==========================================================================
  // Dropdown State Management
  // ==========================================================================

  /**
   * Open a filter dropdown for a header.
   *
   * @param headerId - ID of the header
   * @param axis - LATCH axis for this header
   * @param facet - Facet/column being filtered
   * @param allValues - All possible values for this header
   * @param position - Screen position for the dropdown
   */
  openDropdown(
    headerId: string,
    axis: LATCHAxis,
    facet: string,
    allValues: string[],
    position: { x: number; y: number }
  ): void {
    // Close any existing dropdown
    this.closeDropdown();

    // Get existing filter or create new one with all values selected
    let filterState = this.filters.get(headerId);

    if (!filterState) {
      filterState = {
        filter: {
          headerId,
          axis,
          facet,
          selectedValues: new Set(allValues),
          allValues: [...allValues],
        },
        isApplied: false,
      };
      this.filters.set(headerId, filterState);
    } else {
      // Update allValues in case data changed
      filterState.filter.allValues = [...allValues];
    }

    this.openDropdownId = headerId;
    this.dropdownPosition = position;
  }

  /**
   * Close the currently open dropdown.
   */
  closeDropdown(): void {
    this.openDropdownId = null;
    this.dropdownPosition = null;
  }

  /**
   * Get the ID of the currently open dropdown.
   */
  getOpenDropdownId(): string | null {
    return this.openDropdownId;
  }

  /**
   * Get the position of the currently open dropdown.
   */
  getDropdownPosition(): { x: number; y: number } | null {
    return this.dropdownPosition;
  }

  // ==========================================================================
  // Value Selection
  // ==========================================================================

  /**
   * Toggle a value's selection state.
   *
   * @param headerId - ID of the header
   * @param value - Value to toggle
   */
  toggleValue(headerId: string, value: string): void {
    const filterState = this.filters.get(headerId);
    if (!filterState) return;

    if (filterState.filter.selectedValues.has(value)) {
      filterState.filter.selectedValues.delete(value);
    } else {
      filterState.filter.selectedValues.add(value);
    }
  }

  /**
   * Select all values for a header.
   *
   * @param headerId - ID of the header
   */
  selectAll(headerId: string): void {
    const filterState = this.filters.get(headerId);
    if (!filterState) return;

    filterState.filter.selectedValues = new Set(filterState.filter.allValues);
  }

  /**
   * Clear filter (reset to all values selected).
   *
   * @param headerId - ID of the header
   */
  clearFilter(headerId: string): void {
    this.selectAll(headerId);
  }

  // ==========================================================================
  // Filter Application
  // ==========================================================================

  /**
   * Apply the current filter state and notify listeners.
   *
   * @param headerId - ID of the header to apply
   */
  applyFilter(headerId: string): void {
    const filterState = this.filters.get(headerId);
    if (!filterState) return;

    filterState.isApplied = true;
    this.closeDropdown();

    // Notify listeners with all active filters
    this.config.onFilterChange(this.getActiveFilters());
  }

  /**
   * Check if a header has an active filter (not all values selected).
   *
   * @param headerId - ID of the header
   * @returns true if filter is active
   */
  hasActiveFilter(headerId: string): boolean {
    const filterState = this.filters.get(headerId);
    if (!filterState || !filterState.isApplied) return false;

    // Active if not all values are selected
    return filterState.filter.selectedValues.size < filterState.filter.allValues.length;
  }

  /**
   * Get the filter state for a header.
   *
   * @param headerId - ID of the header
   * @returns HeaderFilter or undefined
   */
  getFilter(headerId: string): HeaderFilter | undefined {
    return this.filters.get(headerId)?.filter;
  }

  /**
   * Get all active filters (filters with not all values selected).
   *
   * @returns Array of active HeaderFilter objects
   */
  getActiveFilters(): HeaderFilter[] {
    const active: HeaderFilter[] = [];

    for (const [headerId, state] of this.filters) {
      if (this.hasActiveFilter(headerId)) {
        active.push(state.filter);
      }
    }

    return active;
  }

  /**
   * Remove all filters and reset state.
   */
  clearAllFilters(): void {
    this.filters.clear();
    this.closeDropdown();
    this.config.onFilterChange([]);
  }
}

// ============================================================================
// SQL Compilation
// ============================================================================

/**
 * Escape a SQL string value (single quotes).
 */
function escapeSQLString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Compile header filters to a SQL WHERE clause fragment.
 *
 * @param filters - Array of HeaderFilter objects
 * @returns SQL WHERE clause fragment (without 'WHERE' keyword)
 */
export function compileHeaderFiltersToSQL(filters: HeaderFilter[]): string {
  const clauses: string[] = [];

  for (const filter of filters) {
    // Skip if all values are selected (no filtering needed)
    if (filter.selectedValues.size === filter.allValues.length) {
      continue;
    }

    // Skip if no values selected (would filter everything)
    if (filter.selectedValues.size === 0) {
      continue;
    }

    const values = Array.from(filter.selectedValues);

    if (values.length === 1) {
      // Single value: use equals
      clauses.push(`${filter.facet} = '${escapeSQLString(values[0])}'`);
    } else {
      // Multiple values: use IN
      const escapedValues = values.map(v => `'${escapeSQLString(v)}'`).join(', ');
      clauses.push(`${filter.facet} IN (${escapedValues})`);
    }
  }

  return clauses.join(' AND ');
}
