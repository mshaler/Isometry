/**
 * LATCH Filter Service
 *
 * Purpose: Comprehensive filter management service for LATCH framework
 * LATCH = Location, Alphabet, Time, Category, Hierarchy
 *
 * Provides:
 * - Filter state management with add/remove/clear operations
 * - SQL WHERE clause compilation from active filters
 * - Parameter binding for secure queries
 * - Multiple filter combination with AND/OR logic
 *
 * Architecture: Bridge elimination compatible - generates SQL that works
 * directly with sql.js DatabaseService with zero serialization overhead
 */
import { compileFilterPredicates, type FilterPredicate } from './filterAst';

export interface LATCHFilter {
  id: string;
  axis: 'L' | 'A' | 'T' | 'C' | 'H'; // LATCH axes
  facet: string; // Specific attribute (e.g., 'folder', 'status', 'created_at')
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'in_list' | 'range' | 'before' | 'after';
  value: unknown; // Filter value(s)
  label?: string; // Human-readable display label
  timestamp: number; // When filter was created
}

export interface FilterCompilationResult {
  whereClause: string;
  parameters: unknown[];
  activeFilters: LATCHFilter[];
  isEmpty: boolean;
}

/**
 * LATCH Filter Service - manages filter state and SQL compilation
 *
 * Core principle: LATCH separates data into groups, GRAPH joins data across groups
 * This service handles the LATCH separation part via SQL WHERE clauses
 */
export class LATCHFilterService {
  private filters: Map<string, LATCHFilter> = new Map();
  private filterChangeListeners: Array<(filters: LATCHFilter[]) => void> = [];

  constructor() {
    // Initialize empty filter state
  }

  /**
   * Add a new filter or update existing filter with same ID
   */
  addFilter(axis: LATCHFilter['axis'], facet: string, operator: LATCHFilter['operator'], value: unknown, label?: string): string {
    // Generate unique filter ID based on axis, facet, and operator
    const filterId = `${axis}-${facet}-${operator}-${this.hashValue(value)}`;

    const filter: LATCHFilter = {
      id: filterId,
      axis,
      facet,
      operator,
      value,
      label: label || this.generateDisplayLabel(axis, facet, operator, value),
      timestamp: Date.now()
    };

    this.filters.set(filterId, filter);
    this.notifyListeners();

    return filterId;
  }

  /**
   * Remove a specific filter by ID
   */
  removeFilter(filterId: string): boolean {
    const removed = this.filters.delete(filterId);
    if (removed) {
      this.notifyListeners();
    }
    return removed;
  }

  /**
   * Clear all filters or filters for specific axis
   */
  clearFilters(axis?: LATCHFilter['axis']): number {
    let removedCount = 0;

    if (axis) {
      // Remove only filters for specified axis
      for (const [id, filter] of this.filters.entries()) {
        if (filter.axis === axis) {
          this.filters.delete(id);
          removedCount++;
        }
      }
    } else {
      // Clear all filters
      removedCount = this.filters.size;
      this.filters.clear();
    }

    if (removedCount > 0) {
      this.notifyListeners();
    }

    return removedCount;
  }

  /**
   * Get all active filters
   */
  getActiveFilters(): LATCHFilter[] {
    return Array.from(this.filters.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get filters for specific axis
   */
  getFiltersForAxis(axis: LATCHFilter['axis']): LATCHFilter[] {
    return this.getActiveFilters().filter(filter => filter.axis === axis);
  }

  /**
   * Check if any filters are active
   */
  hasActiveFilters(): boolean {
    return this.filters.size > 0;
  }

  /**
   * Get count of active filters
   */
  getFilterCount(): number {
    return this.filters.size;
  }

  /**
   * Compile active filters to SQL WHERE clause with parameters
   *
   * Core method: Converts LATCH filter state to SQL for sql.js execution
   */
  compileToSQL(): FilterCompilationResult {
    const activeFilters = this.getActiveFilters();

    if (activeFilters.length === 0) {
      return {
        whereClause: 'deleted_at IS NULL',
        parameters: [],
        activeFilters: [],
        isEmpty: true
      };
    }

    const predicates: FilterPredicate[] = activeFilters.map((filter) => ({
      field: filter.facet,
      operator: filter.operator,
      value: filter.value,
    }));
    const compiled = compileFilterPredicates(predicates);

    return {
      whereClause: compiled.whereClause,
      parameters: compiled.parameters,
      activeFilters,
      isEmpty: false
    };
  }

  /**
   * Subscribe to filter changes
   */
  onFilterChange(listener: (filters: LATCHFilter[]) => void): () => void {
    this.filterChangeListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.filterChangeListeners.indexOf(listener);
      if (index > -1) {
        this.filterChangeListeners.splice(index, 1);
      }
    };
  }

  // NOTE: Axis-specific filter compilation methods were removed as part of cleanup.
  // Current implementation uses compileFilterPredicates() from filterAst.ts which
  // provides a more flexible AST-based approach. If axis-specific compilation is
  // needed in the future, reference git history for the original implementations:
  // - compileFacetCondition: Generic facet-to-SQL with operator handling
  // - _groupFiltersByAxis: Group filters by LATCH axis
  // - _compileLocationFilters: Handle lat/lng range filtering
  // - _compileAlphabetFilters: Handle name/content/summary filtering
  // - _compileTimeFilters: Handle date range filtering
  // - _compileCategoryFilters: Handle folder/status/tags filtering
  // - _compileHierarchyFilters: Handle priority/importance filtering

  /**
   * Generate human-readable display label
   */
  private generateDisplayLabel(axis: LATCHFilter['axis'], facet: string, operator: LATCHFilter['operator'], value: unknown): string {
    const axisNames = { L: 'Location', A: 'Alphabet', T: 'Time', C: 'Category', H: 'Hierarchy' };
    const axisName = axisNames[axis];

    // For simple equality filters (most common for headers), just show facet: value
    if (operator === 'equals') {
      return `${this.formatFacetName(facet)}: ${value}`;
    }

    return `${axisName} ${this.formatFacetName(facet)} ${operator.replace('_', ' ')} ${value}`;
  }

  /**
   * Format facet name for display
   */
  private formatFacetName(facet: string): string {
    return facet
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  /**
   * Generate hash for filter value (for unique ID generation)
   */
  private hashValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (Array.isArray(value)) {
      return value.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
    }
    return String(value).replace(/[^a-z0-9]/g, '');
  }

  /**
   * Notify all change listeners
   */
  private notifyListeners(): void {
    const filters = this.getActiveFilters();
    for (const listener of this.filterChangeListeners) {
      try {
        listener(filters);
      } catch (error) {
        console.error('Filter change listener error:', error);
      }
    }
  }
}
