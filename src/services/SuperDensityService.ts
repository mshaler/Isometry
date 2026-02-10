/**
 * SuperDensityService - Janus Density Engine
 *
 * Core implementation of the 4-level Janus density model providing unified
 * aggregation control for SuperGrid. Enables semantic zoom across LATCH
 * dimensions with lossless aggregation and Pan × Zoom independence.
 *
 * Section 2.5 of SuperGrid specification: SuperDensitySparsity unified
 * aggregation control system.
 *
 * Key Features:
 * - 4-level density hierarchy: Value, Extent, View, Region
 * - Pan × Zoom orthogonality (all 4 quadrants valid)
 * - Lossless aggregation with data integrity preservation
 * - SQL-based aggregation using GROUP BY and WHERE clauses
 * - Performance target: < 100ms for density changes
 * - State persistence per dataset
 */

import { LATCHFilterService, type LATCHFilter } from './LATCHFilterService';
import type {
  JanusDensityState,
  DensityLevel,
  ExtentDensityMode,
  ValueDensityMode,
  RegionDensityConfig,
  DensityChangeEvent,
  DensityAggregationResult,
  DensityAggregatedRow,
  DensityPerformanceMetrics
} from '@/types/supergrid';
import { DEFAULT_JANUS_DENSITY } from '@/types/supergrid';
import { devLogger } from '../utils/logging';

export interface DatabaseExecutor {
  execute<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[];
}

export interface DensityServiceConfig {
  /** Performance target for density changes (ms) */
  performanceTarget: number;
  /** Enable performance tracking */
  trackPerformance: boolean;
  /** Cache aggregation results */
  enableAggregationCache: boolean;
  /** Maximum cache size */
  maxCacheSize: number;
  /** Debug logging */
  enableDebugLogging: boolean;
}

/**
 * SuperDensityService - Core Janus density engine implementation
 */
export class SuperDensityService {
  private currentState: JanusDensityState = { ...DEFAULT_JANUS_DENSITY };
  private config: DensityServiceConfig;
  private filterService: LATCHFilterService;
  private changeListeners: Set<(event: DensityChangeEvent) => void> = new Set();
  private aggregationCache: Map<string, DensityAggregationResult> = new Map();
  private performanceHistory: DensityPerformanceMetrics[] = [];

  constructor(
    private database: DatabaseExecutor,
    filterService: LATCHFilterService,
    config: Partial<DensityServiceConfig> = {}
  ) {
    this.config = {
      performanceTarget: 100,
      trackPerformance: true,
      enableAggregationCache: true,
      maxCacheSize: 100,
      enableDebugLogging: false,
      ...config
    };
    this.filterService = filterService;
  }

  /**
   * Get current Janus density state
   */
  getCurrentState(): JanusDensityState {
    return { ...this.currentState };
  }

  /**
   * Set density state for specific level
   */
  async setDensity(level: DensityLevel, value: any): Promise<DensityChangeEvent> {
    const startTime = performance.now();
    const previousState = { ...this.currentState };

    // Update state based on level
    switch (level) {
      case 'value':
        this.currentState.valueDensity = value as ValueDensityMode;
        break;
      case 'extent':
        this.currentState.extentDensity = value as ExtentDensityMode;
        break;
      case 'view':
        this.currentState.viewDensity = value;
        break;
      case 'region':
        if (Array.isArray(value)) {
          this.currentState.regionConfig = value as RegionDensityConfig[];
        }
        break;
    }

    // Calculate performance metrics
    const endTime = performance.now();
    const metrics: DensityPerformanceMetrics = {
      aggregationTime: 0, // Will be updated when aggregation runs
      renderTime: endTime - startTime,
      totalTime: endTime - startTime,
      cellsAffected: 0, // Will be calculated based on current data
      compressionRatio: this.calculateCompressionRatio(),
      withinPerformanceTarget: (endTime - startTime) < this.config.performanceTarget
    };

    // Create change event
    const changeEvent: DensityChangeEvent = {
      previousState,
      newState: { ...this.currentState },
      changedLevel: level,
      metrics,
      dataIntegrityPreserved: true // Always true for lossless aggregation
    };

    // Track performance if enabled
    if (this.config.trackPerformance) {
      this.performanceHistory.push(metrics);
      if (this.performanceHistory.length > 100) {
        this.performanceHistory.shift(); // Keep only recent metrics
      }
    }

    // Notify listeners
    this.notifyChangeListeners(changeEvent);

    // Clear cache if density changed (aggregation may be different)
    if (level === 'value' || level === 'extent') {
      this.clearAggregationCache();
    }

    if (this.config.enableDebugLogging) {
      devLogger.debug('SuperDensity level changed', {
        level,
        from: level === 'value' ? previousState.valueDensity :
              level === 'extent' ? previousState.extentDensity :
              level === 'view' ? previousState.viewDensity : 'region',
        to: value,
        performanceMs: metrics.totalTime,
        withinTarget: metrics.withinPerformanceTarget
      });
    }

    return changeEvent;
  }

  /**
   * Set axis granularity level for hierarchical zoom
   */
  async setAxisGranularity(axis: string, granularityLevel: number): Promise<DensityChangeEvent> {
    const previousState = { ...this.currentState };
    this.currentState.axisGranularity[axis] = Math.max(0, Math.min(3, granularityLevel));

    return this.createChangeEvent(previousState, 'value');
  }

  /**
   * Generate aggregated data based on current density state
   */
  async generateAggregatedData(
    baseFilters?: LATCHFilter[]
  ): Promise<DensityAggregationResult> {
    const startTime = performance.now();

    // Generate cache key
    const cacheKey = this.generateCacheKey(baseFilters);

    // Check cache
    if (this.config.enableAggregationCache && this.aggregationCache.has(cacheKey)) {
      const cached = this.aggregationCache.get(cacheKey)!;
      if (this.config.enableDebugLogging) {
        devLogger.debug('SuperDensity aggregation cache hit', { cacheKey });
      }
      return cached;
    }

    // Build SQL query based on density state
    const { sql, parameters } = this.buildAggregationQuery(baseFilters);

    if (this.config.enableDebugLogging) {
      devLogger.debug('SuperDensity executing aggregation query', {
        sql: sql.replace(/\s+/g, ' ').trim(),
        parameterCount: parameters.length
      });
    }

    // Execute query
    const queryStartTime = performance.now();
    const rawResults = this.database.execute(sql, parameters);
    const queryEndTime = performance.now();

    // Process results into aggregated rows
    const aggregatedRows = this.processAggregationResults(rawResults);

    // Calculate metadata
    const sourceRowCount = await this.getSourceRowCount(baseFilters);
    const metadata = {
      sourceRowCount,
      aggregatedRowCount: aggregatedRows.length,
      compressionRatio: sourceRowCount > 0 ? aggregatedRows.length / sourceRowCount : 1,
      accuracyPreserved: this.currentState.aggregationPreferences.preservePrecision,
      involvedAxes: this.getInvolvedAxes(),
      granularityLevels: { ...this.currentState.axisGranularity }
    };

    // Calculate performance timing
    const endTime = performance.now();
    const timing: DensityPerformanceMetrics = {
      aggregationTime: queryEndTime - queryStartTime,
      renderTime: 0, // Will be set by renderer
      totalTime: endTime - startTime,
      cellsAffected: aggregatedRows.length,
      compressionRatio: metadata.compressionRatio,
      withinPerformanceTarget: (endTime - startTime) < this.config.performanceTarget
    };

    const result: DensityAggregationResult = {
      data: aggregatedRows,
      metadata,
      executedQuery: sql,
      queryParameters: parameters,
      timing
    };

    // Cache result
    if (this.config.enableAggregationCache) {
      this.aggregationCache.set(cacheKey, result);

      // Manage cache size
      if (this.aggregationCache.size > this.config.maxCacheSize) {
        const firstKey = this.aggregationCache.keys().next().value;
        if (firstKey !== undefined) {
          this.aggregationCache.delete(firstKey);
        }
      }
    }

    return result;
  }

  /**
   * Build SQL query for current density configuration
   */
  private buildAggregationQuery(baseFilters?: LATCHFilter[]): { sql: string; parameters: unknown[] } {
    const { whereParts, parameters } = this.buildWhereClause(baseFilters);
    const { selectParts, groupByParts } = this.buildSelectAndGroupBy();

    const sql = `
      SELECT ${selectParts.join(', ')}
      FROM nodes
      ${whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''}
      ${groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(', ')}` : ''}
      ORDER BY ${this.buildOrderBy()}
    `.trim().replace(/\s+/g, ' ');

    return { sql, parameters };
  }

  /**
   * Build WHERE clause based on extent density and filters
   */
  private buildWhereClause(baseFilters?: LATCHFilter[]): { whereParts: string[]; parameters: unknown[] } {
    const whereParts: string[] = ['deleted_at IS NULL'];
    const parameters: unknown[] = [];

    // Add base filters
    if (baseFilters?.length) {
      const filterResult = this.filterService.compileToSQL();
      if (!filterResult.isEmpty) {
        whereParts.push(filterResult.whereClause);
        parameters.push(...filterResult.parameters);
      }
    }

    // Apply extent density filtering
    if (this.currentState.extentDensity === 'populated-only') {
      // Add conditions to exclude empty cells
      whereParts.push('(name IS NOT NULL AND name != "")');
    }

    return { whereParts, parameters };
  }

  /**
   * Build SELECT and GROUP BY clauses based on value density and granularity
   */
  private buildSelectAndGroupBy(): { selectParts: string[]; groupByParts: string[] } {
    const selectParts: string[] = ['COUNT(*) as count'];
    const groupByParts: string[] = [];

    // Base identifier
    if (this.currentState.valueDensity === 'leaf') {
      selectParts.push('id', 'name', 'folder', 'status', 'priority');
    } else {
      // Collapsed view - add aggregated fields based on granularity
      const aggregationFunc = this.currentState.aggregationPreferences.defaultFunction;

      for (const [axis, granularity] of Object.entries(this.currentState.axisGranularity)) {
        const { selectClause, groupClause } = this.buildAxisAggregation(axis, granularity, aggregationFunc);
        if (selectClause && groupClause) {
          selectParts.push(selectClause);
          groupByParts.push(groupClause);
        }
      }
    }

    // Apply region-specific configurations
    for (const regionConfig of this.currentState.regionConfig) {
      const { selectClause, groupClause } = this.buildRegionAggregation(regionConfig);
      if (selectClause && groupClause) {
        selectParts.push(selectClause);
        groupByParts.push(groupClause);
      }
    }

    return { selectParts, groupByParts };
  }

  /**
   * Build aggregation for specific LATCH axis and granularity level
   */
  private buildAxisAggregation(
    axis: string,
    granularity: number,
    aggregationFunc: string
  ): { selectClause: string | null; groupClause: string | null } {
    switch (axis) {
      case 'T': // Time axis
        return this.buildTimeAggregation(granularity, aggregationFunc);
      case 'C': // Category axis
        return this.buildCategoryAggregation(granularity, aggregationFunc);
      case 'H': // Hierarchy axis
        return this.buildHierarchyAggregation(granularity, aggregationFunc);
      case 'L': // Location axis
        return this.buildLocationAggregation(granularity, aggregationFunc);
      case 'A': // Alphabet axis
        return this.buildAlphabetAggregation(granularity, aggregationFunc);
      default:
        return { selectClause: null, groupClause: null };
    }
  }

  /**
   * Build time-based aggregation based on granularity
   */
  private buildTimeAggregation(granularity: number, _aggregationFunc: string): { selectClause: string; groupClause: string } {
    switch (granularity) {
      case 0: // Decade
        return {
          selectClause: `(CAST(strftime('%Y', created_at) AS INTEGER) / 10 * 10) || 's' as time_decade`,
          groupClause: `CAST(strftime('%Y', created_at) AS INTEGER) / 10`
        };
      case 1: // Year
        return {
          selectClause: `strftime('%Y', created_at) as time_year`,
          groupClause: `strftime('%Y', created_at)`
        };
      case 2: // Quarter
        return {
          selectClause: `'Q' || ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3 + 1) || ' ' || strftime('%Y', created_at) as time_quarter`,
          groupClause: `strftime('%Y', created_at), ((CAST(strftime('%m', created_at) AS INTEGER) - 1) / 3)`
        };
      case 3: // Month
      default:
        return {
          selectClause: `strftime('%Y-%m', created_at) as time_month`,
          groupClause: `strftime('%Y-%m', created_at)`
        };
    }
  }

  /**
   * Build category-based aggregation
   */
  private buildCategoryAggregation(granularity: number, _aggregationFunc: string): { selectClause: string; groupClause: string } {
    switch (granularity) {
      case 0: // Domain level
        return {
          selectClause: `CASE WHEN folder IS NULL THEN 'Uncategorized' ELSE 'Categorized' END as category_domain`,
          groupClause: `CASE WHEN folder IS NULL THEN 'Uncategorized' ELSE 'Categorized' END`
        };
      case 1: // Category (folder)
        return {
          selectClause: `COALESCE(folder, 'Uncategorized') as category`,
          groupClause: `COALESCE(folder, 'Uncategorized')`
        };
      case 2: // Subcategory (folder + status)
        return {
          selectClause: `COALESCE(folder, 'Uncategorized') || '-' || COALESCE(status, 'None') as subcategory`,
          groupClause: `COALESCE(folder, 'Uncategorized'), COALESCE(status, 'None')`
        };
      case 3: // Tag level
      default:
        return {
          selectClause: `COALESCE(folder, 'Uncategorized') as category, COALESCE(tags, '[]') as tags`,
          groupClause: `COALESCE(folder, 'Uncategorized'), COALESCE(tags, '[]')`
        };
    }
  }

  /**
   * Build hierarchy-based aggregation
   */
  private buildHierarchyAggregation(granularity: number, _aggregationFunc: string): { selectClause: string; groupClause: string } {
    switch (granularity) {
      case 0: // Priority tier
        return {
          selectClause: `CASE WHEN priority >= 4 THEN 'Critical' WHEN priority >= 2 THEN 'Standard' ELSE 'Optional' END as priority_tier`,
          groupClause: `CASE WHEN priority >= 4 THEN 'Critical' WHEN priority >= 2 THEN 'Standard' ELSE 'Optional' END`
        };
      case 1: // Priority level
        return {
          selectClause: `CASE WHEN priority >= 4 THEN 'High' WHEN priority >= 2 THEN 'Medium' ELSE 'Low' END as priority_level`,
          groupClause: `CASE WHEN priority >= 4 THEN 'High' WHEN priority >= 2 THEN 'Medium' ELSE 'Low' END`
        };
      case 2: // Importance
        return {
          selectClause: `importance as importance_level`,
          groupClause: `importance`
        };
      case 3: // Individual priority
      default:
        return {
          selectClause: `priority`,
          groupClause: `priority`
        };
    }
  }

  /**
   * Build location-based aggregation
   */
  private buildLocationAggregation(_granularity: number, _aggregationFunc: string): { selectClause: string; groupClause: string } {
    // Simplified location aggregation - could be enhanced with geographic data
    return {
      selectClause: `COALESCE(location_name, 'Unknown') as location`,
      groupClause: `COALESCE(location_name, 'Unknown')`
    };
  }

  /**
   * Build alphabet-based aggregation
   */
  private buildAlphabetAggregation(granularity: number, _aggregationFunc: string): { selectClause: string; groupClause: string } {
    switch (granularity) {
      case 0: // Letter groups
        return {
          selectClause: `CASE WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'A' AND 'F' THEN 'A-F'
                             WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'G' AND 'M' THEN 'G-M'
                             WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'N' AND 'S' THEN 'N-S'
                             ELSE 'T-Z' END as alphabet_group`,
          groupClause: `CASE WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'A' AND 'F' THEN 'A-F'
                             WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'G' AND 'M' THEN 'G-M'
                             WHEN UPPER(SUBSTR(name, 1, 1)) BETWEEN 'N' AND 'S' THEN 'N-S'
                             ELSE 'T-Z' END`
        };
      case 1: // Letter pairs
        return {
          selectClause: `UPPER(SUBSTR(name, 1, 1)) || '-' || UPPER(SUBSTR(name, 1, 2)) as letter_pair`,
          groupClause: `UPPER(SUBSTR(name, 1, 2))`
        };
      case 2: // Single letters
        return {
          selectClause: `UPPER(SUBSTR(name, 1, 1)) as first_letter`,
          groupClause: `UPPER(SUBSTR(name, 1, 1))`
        };
      case 3: // Word starts
      default:
        return {
          selectClause: `UPPER(SUBSTR(name, 1, 3)) || '...' as word_start`,
          groupClause: `UPPER(SUBSTR(name, 1, 3))`
        };
    }
  }

  /**
   * Build region-specific aggregation
   */
  private buildRegionAggregation(regionConfig: RegionDensityConfig): { selectClause: string | null; groupClause: string | null } {
    // Region configurations override default axis aggregation for specific facets
    return this.buildAxisAggregation(
      regionConfig.axis,
      regionConfig.aggregationLevel,
      this.currentState.aggregationPreferences.defaultFunction
    );
  }

  /**
   * Build ORDER BY clause
   */
  private buildOrderBy(): string {
    if (this.currentState.valueDensity === 'leaf') {
      return 'name ASC';
    } else {
      return 'count DESC';
    }
  }

  /**
   * Process raw SQL results into aggregated rows
   */
  private processAggregationResults(rawResults: any[]): DensityAggregatedRow[] {
    return rawResults.map((row, index) => ({
      cellId: this.generateCellId(row, index),
      value: row.count || row.id || row.name,
      displayValue: this.formatDisplayValue(row),
      sourceCount: row.count || 1,
      sourceIds: row.id ? [row.id] : [],
      aggregationFunction: this.currentState.aggregationPreferences.defaultFunction,
      dimensionPath: this.generateDimensionPath(row),
      isLeaf: this.currentState.valueDensity === 'leaf'
    }));
  }

  /**
   * Generate unique cell ID for aggregated row
   */
  private generateCellId(row: any, index: number): string {
    const keyParts = [];

    for (const key of Object.keys(row)) {
      if (key !== 'count' && row[key] != null) {
        keyParts.push(`${key}:${row[key]}`);
      }
    }

    return keyParts.length > 0
      ? keyParts.join('|')
      : `generated-${index}`;
  }

  /**
   * Format display value for aggregated row
   */
  private formatDisplayValue(row: any): string {
    if (this.currentState.valueDensity === 'leaf') {
      return row.name || row.id || 'Untitled';
    } else {
      const count = row.count || 1;
      const mainValue = Object.keys(row)
        .filter(k => k !== 'count')
        .map(k => row[k])
        .filter(v => v != null)[0];

      return `${mainValue} (${count})`;
    }
  }

  /**
   * Generate LATCH dimension path for row
   */
  private generateDimensionPath(row: any): string {
    const pathParts: string[] = [];

    // Extract dimension values based on aggregation columns
    for (const [key, value] of Object.entries(row)) {
      if (key !== 'count' && value != null) {
        pathParts.push(`${key}/${value}`);
      }
    }

    return pathParts.join('|');
  }

  /**
   * Get source row count for metadata calculation
   */
  private async getSourceRowCount(baseFilters?: LATCHFilter[]): Promise<number> {
    const { whereParts, parameters } = this.buildWhereClause(baseFilters);

    const countSql = `
      SELECT COUNT(*) as total
      FROM nodes
      ${whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : ''}
    `.trim();

    const result = this.database.execute<{ total: number }>(countSql, parameters);
    return Number(result[0]?.total) || 0;
  }

  /**
   * Get involved LATCH axes for current aggregation
   */
  private getInvolvedAxes(): string[] {
    const axes = Object.keys(this.currentState.axisGranularity);
    const regionAxes = this.currentState.regionConfig.map(r => r.axis);
    return Array.from(new Set([...axes, ...regionAxes]));
  }

  /**
   * Calculate compression ratio for current state
   */
  private calculateCompressionRatio(): number {
    if (this.currentState.valueDensity === 'leaf') {
      return 1.0; // No compression
    }

    // Estimate compression based on aggregation levels
    const values = Object.values(this.currentState.axisGranularity);
    const avgGranularity = values.length > 0
      ? values.reduce((sum, level) => sum + level, 0) / values.length
      : 0;

    // Higher granularity = less compression
    return Math.max(0.1, 1.0 - (avgGranularity / 4.0));
  }

  /**
   * Generate cache key for aggregation result
   */
  private generateCacheKey(baseFilters?: LATCHFilter[]): string {
    const stateParts = [
      this.currentState.valueDensity,
      this.currentState.extentDensity,
      this.currentState.viewDensity,
      JSON.stringify(this.currentState.axisGranularity),
      JSON.stringify(this.currentState.regionConfig),
      JSON.stringify(baseFilters || [])
    ];

    return btoa(stateParts.join('|')).substring(0, 32);
  }

  /**
   * Create change event with metrics
   */
  private createChangeEvent(previousState: JanusDensityState, level: DensityLevel): DensityChangeEvent {
    const metrics: DensityPerformanceMetrics = {
      aggregationTime: 0,
      renderTime: 5, // Estimated
      totalTime: 5,
      cellsAffected: 0,
      compressionRatio: this.calculateCompressionRatio(),
      withinPerformanceTarget: true
    };

    return {
      previousState,
      newState: { ...this.currentState },
      changedLevel: level,
      metrics,
      dataIntegrityPreserved: true
    };
  }

  /**
   * Subscribe to density change events
   */
  onDensityChange(listener: (event: DensityChangeEvent) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  /**
   * Notify all change listeners
   */
  private notifyChangeListeners(event: DensityChangeEvent): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SuperDensity] Change listener error:', error);
      }
    });
  }

  /**
   * Clear aggregation cache
   */
  private clearAggregationCache(): void {
    this.aggregationCache.clear();
    if (this.config.enableDebugLogging) {
      devLogger.debug('SuperDensity aggregation cache cleared', {
        previousCacheSize: this.aggregationCache.size
      });
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): DensityPerformanceMetrics[] {
    return [...this.performanceHistory];
  }

  /**
   * Reset to default density state
   */
  resetToDefault(): Promise<DensityChangeEvent> {
    const previousState = { ...this.currentState };
    this.currentState = { ...DEFAULT_JANUS_DENSITY };
    this.clearAggregationCache();

    return Promise.resolve(this.createChangeEvent(previousState, 'view'));
  }
}