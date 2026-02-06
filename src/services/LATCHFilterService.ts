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

export interface LATCHFilter {
  id: string;
  axis: 'L' | 'A' | 'T' | 'C' | 'H'; // LATCH axes
  facet: string; // Specific attribute (e.g., 'folder', 'status', 'created_at')
  operator: 'equals' | 'not_equals' | 'contains' | 'starts_with' | 'in_list' | 'range' | 'before' | 'after';
  value: any; // Filter value(s)
  label?: string; // Human-readable display label
  timestamp: number; // When filter was created
}

export interface FilterCompilationResult {
  whereClause: string;
  parameters: any[];
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
  addFilter(axis: LATCHFilter['axis'], facet: string, operator: LATCHFilter['operator'], value: any, label?: string): string {
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

    const conditions: string[] = ['deleted_at IS NULL']; // Always exclude soft-deleted
    const parameters: any[] = [];

    // Group filters by axis for logical grouping
    const filtersByAxis = this.groupFiltersByAxis(activeFilters);

    // Location (L) filters
    if (filtersByAxis.L && filtersByAxis.L.length > 0) {
      const locationConditions = this.compileLocationFilters(filtersByAxis.L, parameters);
      if (locationConditions) {
        conditions.push(`(${locationConditions})`);
      }
    }

    // Alphabet (A) filters - text-based searching and sorting
    if (filtersByAxis.A && filtersByAxis.A.length > 0) {
      const alphabetConditions = this.compileAlphabetFilters(filtersByAxis.A, parameters);
      if (alphabetConditions) {
        conditions.push(`(${alphabetConditions})`);
      }
    }

    // Time (T) filters
    if (filtersByAxis.T && filtersByAxis.T.length > 0) {
      const timeConditions = this.compileTimeFilters(filtersByAxis.T, parameters);
      if (timeConditions) {
        conditions.push(`(${timeConditions})`);
      }
    }

    // Category (C) filters - folders, tags, status
    if (filtersByAxis.C && filtersByAxis.C.length > 0) {
      const categoryConditions = this.compileCategoryFilters(filtersByAxis.C, parameters);
      if (categoryConditions) {
        conditions.push(`(${categoryConditions})`);
      }
    }

    // Hierarchy (H) filters - priority, importance, sort order
    if (filtersByAxis.H && filtersByAxis.H.length > 0) {
      const hierarchyConditions = this.compileHierarchyFilters(filtersByAxis.H, parameters);
      if (hierarchyConditions) {
        conditions.push(`(${hierarchyConditions})`);
      }
    }

    return {
      whereClause: conditions.join(' AND '),
      parameters,
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

  /**
   * Helper: Group filters by LATCH axis
   */
  private groupFiltersByAxis(filters: LATCHFilter[]): Record<string, LATCHFilter[]> {
    const grouped: Record<string, LATCHFilter[]> = {};

    for (const filter of filters) {
      if (!grouped[filter.axis]) {
        grouped[filter.axis] = [];
      }
      grouped[filter.axis].push(filter);
    }

    return grouped;
  }

  /**
   * Compile Location (L) filters to SQL
   */
  private compileLocationFilters(filters: LATCHFilter[], parameters: any[]): string {
    const conditions: string[] = [];

    for (const filter of filters) {
      switch (filter.facet) {
        case 'location_name':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
        case 'location_address':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
        case 'coordinates':
          // Handle lat/lng range filtering
          if (filter.operator === 'range' && Array.isArray(filter.value) && filter.value.length === 4) {
            const [minLat, minLng, maxLat, maxLng] = filter.value;
            conditions.push(`(latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?)`);
            parameters.push(minLat, maxLat, minLng, maxLng);
          }
          break;
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Compile Alphabet (A) filters to SQL
   */
  private compileAlphabetFilters(filters: LATCHFilter[], parameters: any[]): string {
    const conditions: string[] = [];

    for (const filter of filters) {
      switch (filter.facet) {
        case 'name':
        case 'content':
        case 'summary':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Compile Time (T) filters to SQL
   */
  private compileTimeFilters(filters: LATCHFilter[], parameters: any[]): string {
    const conditions: string[] = [];

    for (const filter of filters) {
      switch (filter.facet) {
        case 'created_at':
        case 'modified_at':
        case 'due_at':
        case 'completed_at':
        case 'event_start':
        case 'event_end':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Compile Category (C) filters to SQL - most common for header clicks
   */
  private compileCategoryFilters(filters: LATCHFilter[], parameters: any[]): string {
    const conditions: string[] = [];

    for (const filter of filters) {
      switch (filter.facet) {
        case 'folder':
        case 'status':
        case 'tags':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Compile Hierarchy (H) filters to SQL
   */
  private compileHierarchyFilters(filters: LATCHFilter[], parameters: any[]): string {
    const conditions: string[] = [];

    for (const filter of filters) {
      switch (filter.facet) {
        case 'priority':
        case 'importance':
        case 'sort_order':
          conditions.push(this.compileFacetCondition(filter, parameters));
          break;
      }
    }

    return conditions.join(' AND ');
  }

  /**
   * Compile individual facet condition with proper operator handling
   */
  private compileFacetCondition(filter: LATCHFilter, parameters: any[]): string {
    const { facet, operator, value } = filter;

    switch (operator) {
      case 'equals':
        parameters.push(value);
        return `${facet} = ?`;

      case 'not_equals':
        parameters.push(value);
        return `${facet} != ? OR ${facet} IS NULL`;

      case 'contains':
        parameters.push(`%${value}%`);
        return `${facet} LIKE ?`;

      case 'starts_with':
        parameters.push(`${value}%`);
        return `${facet} LIKE ?`;

      case 'in_list':
        if (Array.isArray(value) && value.length > 0) {
          const placeholders = value.map(() => '?').join(', ');
          parameters.push(...value);
          return `${facet} IN (${placeholders})`;
        }
        return '1=1'; // No-op if empty list

      case 'range':
        if (Array.isArray(value) && value.length === 2) {
          parameters.push(value[0], value[1]);
          return `${facet} BETWEEN ? AND ?`;
        }
        return '1=1'; // No-op if invalid range

      case 'before':
        parameters.push(value);
        return `${facet} < ?`;

      case 'after':
        parameters.push(value);
        return `${facet} > ?`;

      default:
        console.warn(`Unknown filter operator: ${operator}`);
        return '1=1';
    }
  }

  /**
   * Generate human-readable display label
   */
  private generateDisplayLabel(axis: LATCHFilter['axis'], facet: string, operator: LATCHFilter['operator'], value: any): string {
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
  private hashValue(value: any): string {
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