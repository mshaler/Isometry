/**
 * PAFV Axis Service - Manages axis assignments and persistence
 *
 * Handles the coordination between SuperDynamic drag-drop operations,
 * PAFV state management, and sql.js persistence. Core service for
 * "any axis maps to any plane" functionality.
 *
 * Architecture: Bridge elimination - direct sql.js operations without native bridge
 * Performance: Axis assignments cached in memory, debounced persistence
 *
 * @module services/PAFVAxisService
 */

import type { ViewAxisMapping } from '../types/views';
import type { LATCHAxis, LATCHAxisAbbr } from '../types/pafv';
import type { AxisChangeEvent, SuperDynamicMetrics } from '../types/supergrid';


/**
 * Convert LATCH full name to abbreviation
 */
function fullToAbbr(full: LATCHAxis): LATCHAxisAbbr {
  switch (full) {
    case 'location': return 'L';
    case 'alphabet': return 'A';
    case 'time': return 'T';
    case 'category': return 'C';
    case 'hierarchy': return 'H';
  }
}

export interface PAFVAxisServiceConfig {
  /** Database instance for persistence */
  database: any; // sql.js database instance

  /** Debounce delay for persistence operations (ms) */
  persistenceDelay: number;

  /** Enable performance tracking */
  enableMetrics: boolean;

  /** Canvas/dataset ID for scoped persistence */
  canvasId: string;
}

export interface AvailableAxis {
  id: string;
  facet: string;
  latchDimension: LATCHAxis;
  label: string;
  description: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  uniqueValues?: string[];
  isEnabled: boolean;
}

export class PAFVAxisService {
  private config: PAFVAxisServiceConfig;
  private currentMapping: ViewAxisMapping = {};
  private availableAxes: AvailableAxis[] = [];
  private persistenceTimeout: number | null = null;
  private metrics: SuperDynamicMetrics;
  private changeListeners: ((mapping: ViewAxisMapping) => void)[] = [];

  constructor(config: PAFVAxisServiceConfig) {
    this.config = config;
    this.metrics = this.initializeMetrics();
    this.loadAvailableAxes();
    this.loadPersistedMapping();
  }

  private initializeMetrics(): SuperDynamicMetrics {
    return {
      averageReflowTime: 0,
      peakReflowTime: 0,
      lastFrameDrops: 0,
      totalRepositions: 0,
      interactionPatterns: {
        mostUsedAxisSwaps: [],
        averageSessionSwaps: 0,
        cancelRate: 0
      }
    };
  }

  /**
   * Load available axes from the database facets table
   */
  private async loadAvailableAxes(): Promise<void> {
    if (!this.config.database) return;

    try {
      // Query facets from sql.js database
      const results = this.config.database.exec(`
        SELECT
          f.id,
          f.name as facet,
          f.axis as latch_dimension,
          f.source_column,
          f.facet_type,
          f.enabled,
          f.sort_order,
          COUNT(DISTINCT n.id) as node_count
        FROM facets f
        LEFT JOIN nodes n ON 1=1  -- Get overall node count for uniqueness estimation
        WHERE f.enabled = 1
        GROUP BY f.id, f.name, f.axis, f.source_column, f.facet_type, f.enabled, f.sort_order
        ORDER BY f.sort_order ASC
      `);

      if (results.length === 0) {
        this.initializeDefaultAxes();
        return;
      }

      const rows = results[0];
      this.availableAxes = rows.values.map((row: any) => {
        const [id, facet, latchDimension, , facetType, enabled, , nodeCount] = row;

        return {
          id: String(id),
          facet: String(facet),
          latchDimension: String(latchDimension) as LATCHAxis,
          label: this.generateAxisLabel(String(facet), String(latchDimension)),
          description: this.generateAxisDescription(String(facet), String(latchDimension), Number(nodeCount)),
          dataType: this.mapFacetTypeToDataType(String(facetType)),
          isEnabled: Boolean(enabled)
        };
      });

      console.log(`PAFVAxisService: Loaded ${this.availableAxes.length} available axes`);

    } catch (error) {
      console.error('PAFVAxisService: Failed to load available axes', error);
      this.initializeDefaultAxes();
    }
  }

  /**
   * Initialize default axes when database query fails
   */
  private initializeDefaultAxes(): void {
    this.availableAxes = [
      {
        id: 'folder',
        facet: 'folder',
        latchDimension: 'category',
        label: 'Category → Folder',
        description: 'Organize by project folder grouping',
        dataType: 'string',
        isEnabled: true
      },
      {
        id: 'status',
        facet: 'status',
        latchDimension: 'category',
        label: 'Category → Status',
        description: 'Group by completion status',
        dataType: 'string',
        isEnabled: true
      },
      {
        id: 'created_at',
        facet: 'created_at',
        latchDimension: 'time',
        label: 'Time → Created',
        description: 'Chronological by creation date',
        dataType: 'date',
        isEnabled: true
      },
      {
        id: 'modified_at',
        facet: 'modified_at',
        latchDimension: 'time',
        label: 'Time → Modified',
        description: 'Chronological by last modification',
        dataType: 'date',
        isEnabled: true
      },
      {
        id: 'name',
        facet: 'name',
        latchDimension: 'alphabet',
        label: 'Alphabet → Name',
        description: 'Alphabetical by card name',
        dataType: 'string',
        isEnabled: true
      },
      {
        id: 'priority',
        facet: 'priority',
        latchDimension: 'hierarchy',
        label: 'Hierarchy → Priority',
        description: 'By importance/priority level',
        dataType: 'number',
        isEnabled: true
      }
    ];

    console.log('PAFVAxisService: Using default axes (database unavailable)');
  }

  private generateAxisLabel(facet: string, latchDimension: string): string {
    const latchLabels = {
      'L': 'Location',
      'A': 'Alphabet',
      'T': 'Time',
      'C': 'Category',
      'H': 'Hierarchy'
    };

    const latchLabel = latchLabels[latchDimension as keyof typeof latchLabels] || 'Unknown';
    const facetLabel = facet.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    return `${latchLabel} → ${facetLabel}`;
  }

  private generateAxisDescription(facet: string, latchDimension: string, nodeCount: number): string {
    const facetLabel = facet.replace(/_/g, ' ');

    const templates = {
      'L': `Spatial organization by ${facetLabel}`,
      'A': `Alphabetical ordering by ${facetLabel}`,
      'T': `Chronological sequence by ${facetLabel}`,
      'C': `Categorical grouping by ${facetLabel}`,
      'H': `Hierarchical levels by ${facetLabel}`
    };

    const baseDescription = templates[latchDimension as keyof typeof templates] || `Organization by ${facetLabel}`;

    if (nodeCount > 0) {
      return `${baseDescription} (${nodeCount} items)`;
    }

    return baseDescription;
  }

  private mapFacetTypeToDataType(facetType: string): 'string' | 'number' | 'date' | 'boolean' {
    switch (facetType.toLowerCase()) {
      case 'number':
      case 'integer':
      case 'float':
        return 'number';
      case 'date':
      case 'datetime':
      case 'timestamp':
        return 'date';
      case 'boolean':
      case 'bool':
        return 'boolean';
      default:
        return 'string';
    }
  }

  /**
   * Load persisted axis mapping from database
   */
  private async loadPersistedMapping(): Promise<void> {
    if (!this.config.database || !this.config.canvasId) return;

    try {
      const results = this.config.database.exec(`
        SELECT axis_mapping
        FROM view_state
        WHERE canvas_id = ? AND current_view = 'supergrid'
        ORDER BY last_modified DESC
        LIMIT 1
      `, [this.config.canvasId]);

      if (results.length > 0 && results[0].values.length > 0) {
        const mappingJson = results[0].values[0][0];
        this.currentMapping = JSON.parse(String(mappingJson));
        console.log('PAFVAxisService: Loaded persisted axis mapping');
      }

    } catch (error) {
      console.warn('PAFVAxisService: Failed to load persisted mapping, using defaults', error);
      this.setDefaultMapping();
    }
  }

  private setDefaultMapping(): void {
    // Set up default mapping based on available axes
    const categoryAxis = this.availableAxes.find(a => a.latchDimension === 'category');
    const timeAxis = this.availableAxes.find(a => a.latchDimension === 'time');
    const hierarchyAxis = this.availableAxes.find(a => a.latchDimension === 'hierarchy');

    this.currentMapping = {};

    if (categoryAxis) {
      this.currentMapping.xAxis = {
        latchDimension: fullToAbbr(categoryAxis.latchDimension),
        facet: categoryAxis.facet,
        label: categoryAxis.label
      };
    }

    if (timeAxis) {
      this.currentMapping.yAxis = {
        latchDimension: fullToAbbr(timeAxis.latchDimension),
        facet: timeAxis.facet,
        label: timeAxis.label
      };
    }

    if (hierarchyAxis) {
      this.currentMapping.zAxis = {
        latchDimension: fullToAbbr(hierarchyAxis.latchDimension),
        facet: hierarchyAxis.facet,
        label: hierarchyAxis.label,
        depth: 3
      };
    }
  }

  /**
   * Get current axis mapping
   */
  getCurrentMapping(): ViewAxisMapping {
    return { ...this.currentMapping };
  }

  /**
   * Get list of available axes for assignment
   */
  getAvailableAxes(): AvailableAxis[] {
    return [...this.availableAxes];
  }

  /**
   * Get axes not currently in use
   */
  getUnassignedAxes(): AvailableAxis[] {
    const assignedFacets = new Set([
      this.currentMapping.xAxis?.facet,
      this.currentMapping.yAxis?.facet,
      this.currentMapping.zAxis?.facet
    ].filter(Boolean));

    return this.availableAxes.filter(axis =>
      axis.isEnabled && !assignedFacets.has(axis.facet)
    );
  }

  /**
   * Assign axis to a specific plane
   */
  async assignAxis(plane: 'x' | 'y' | 'z', axisId: string): Promise<boolean> {
    const axis = this.availableAxes.find(a => a.id === axisId);
    if (!axis) {
      console.error(`PAFVAxisService: Axis not found: ${axisId}`);
      return false;
    }

    const oldMapping = { ...this.currentMapping };

    // Create new axis assignment
    const axisProperty = `${plane}Axis` as keyof ViewAxisMapping;
    if (plane === 'z') {
      this.currentMapping[axisProperty] = {
        latchDimension: fullToAbbr(axis.latchDimension),
        facet: axis.facet,
        label: axis.label,
        depth: 3
      } as any;
    } else {
      this.currentMapping[axisProperty] = {
        latchDimension: fullToAbbr(axis.latchDimension),
        facet: axis.facet,
        label: axis.label
      } as any;
    }

    // Track metrics
    this.updateMetrics('programmatic', oldMapping, this.currentMapping);

    // Notify listeners
    this.notifyChange();

    // Persist change
    await this.persistMapping();

    console.log(`PAFVAxisService: Assigned ${axis.label} to ${plane.toUpperCase()}-axis`);
    return true;
  }

  /**
   * Clear axis assignment from a plane
   */
  async clearAxis(plane: 'x' | 'y' | 'z'): Promise<void> {
    const oldMapping = { ...this.currentMapping };

    const axisProperty = `${plane}Axis` as keyof ViewAxisMapping;
    delete this.currentMapping[axisProperty];

    // Track metrics
    this.updateMetrics('programmatic', oldMapping, this.currentMapping);

    // Notify listeners
    this.notifyChange();

    // Persist change
    await this.persistMapping();

    console.log(`PAFVAxisService: Cleared ${plane.toUpperCase()}-axis`);
  }

  /**
   * Swap two axes (for drag-drop operations)
   */
  async swapAxes(
    fromPlane: 'x' | 'y' | 'z',
    toPlane: 'x' | 'y' | 'z'
  ): Promise<boolean> {
    if (fromPlane === toPlane) return false;

    const oldMapping = { ...this.currentMapping };

    const fromProperty = `${fromPlane}Axis` as keyof ViewAxisMapping;
    const toProperty = `${toPlane}Axis` as keyof ViewAxisMapping;

    const fromAxis = this.currentMapping[fromProperty];
    const toAxis = this.currentMapping[toProperty];

    // Perform the swap
    if (fromAxis) {
      this.currentMapping[toProperty] = fromAxis as any;
    } else {
      delete this.currentMapping[toProperty];
    }

    if (toAxis) {
      this.currentMapping[fromProperty] = toAxis as any;
    } else {
      delete this.currentMapping[fromProperty];
    }

    // Track metrics
    this.updateMetrics('drag', oldMapping, this.currentMapping);

    // Notify listeners
    this.notifyChange();

    // Persist change
    await this.persistMapping();

    console.log(`PAFVAxisService: Swapped ${fromPlane} ↔ ${toPlane} axes`);
    return true;
  }

  /**
   * Handle axis change from SuperDynamic drag-drop
   */
  async handleAxisChange(event: AxisChangeEvent): Promise<void> {
    const { oldMapping, newMapping, changedAxis, trigger } = event;

    // Update internal mapping
    this.currentMapping = this.convertToViewAxisMapping(newMapping);

    // Update metrics
    this.updateMetrics(trigger, oldMapping, newMapping);

    // Notify listeners
    this.notifyChange();

    // Persist change
    await this.persistMapping();

    console.log(`PAFVAxisService: Handled ${trigger} axis change on ${changedAxis}-axis`);
  }

  private convertToViewAxisMapping(
    axisMapping: Record<'x' | 'y' | 'z', string | null>
  ): ViewAxisMapping {
    const result: ViewAxisMapping = {};

    Object.entries(axisMapping).forEach(([plane, axisId]) => {
      if (axisId) {
        const axis = this.availableAxes.find(a => a.id === axisId);
        if (axis) {
          const property = `${plane}Axis` as keyof ViewAxisMapping;
          if (plane === 'z') {
            result[property] = {
              latchDimension: fullToAbbr(axis.latchDimension),
              facet: axis.facet,
              label: axis.label,
              depth: 3
            } as any;
          } else {
            result[property] = {
              latchDimension: fullToAbbr(axis.latchDimension),
              facet: axis.facet,
              label: axis.label
            } as any;
          }
        }
      }
    });

    return result;
  }

  private updateMetrics(
    trigger: 'drag' | 'programmatic',
    oldMapping: any,
    newMapping: any
  ): void {
    if (!this.config.enableMetrics) return;

    this.metrics.totalRepositions++;

    if (trigger === 'drag') {
      // Track axis swap patterns for drag operations
      const swapInfo = this.detectAxisSwap(oldMapping, newMapping);
      if (swapInfo) {
        const existingPattern = this.metrics.interactionPatterns.mostUsedAxisSwaps
          .find(p => p.from === swapInfo.from && p.to === swapInfo.to);

        if (existingPattern) {
          existingPattern.count++;
        } else {
          this.metrics.interactionPatterns.mostUsedAxisSwaps.push({
            from: swapInfo.from,
            to: swapInfo.to,
            count: 1
          });
        }
      }
    }

    // Update running averages
    const sessionSwaps = this.metrics.interactionPatterns.mostUsedAxisSwaps
      .reduce((sum, pattern) => sum + pattern.count, 0);
    this.metrics.interactionPatterns.averageSessionSwaps = sessionSwaps;
  }

  private detectAxisSwap(oldMapping: any, newMapping: any): { from: string; to: string } | null {
    // Detect axis movement patterns for analytics
    // This is a simplified implementation
    const oldAxes = Object.keys(oldMapping).filter(k => oldMapping[k]);
    const newAxes = Object.keys(newMapping).filter(k => newMapping[k]);

    if (oldAxes.length > 0 && newAxes.length > 0) {
      return { from: oldAxes[0], to: newAxes[0] };
    }

    return null;
  }

  /**
   * Persist current mapping to database
   */
  private async persistMapping(): Promise<void> {
    if (!this.config.database || !this.config.canvasId) return;

    // Debounce persistence to avoid excessive writes
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
    }

    this.persistenceTimeout = window.setTimeout(async () => {
      try {
        const mappingJson = JSON.stringify(this.currentMapping);
        const now = Date.now();

        // Upsert view state
        this.config.database.run(`
          INSERT OR REPLACE INTO view_state (
            canvas_id,
            current_view,
            axis_mapping,
            last_modified,
            version
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          this.config.canvasId,
          'supergrid',
          mappingJson,
          now,
          '1.0.0'
        ]);

        console.log('PAFVAxisService: Persisted axis mapping');

      } catch (error) {
        console.error('PAFVAxisService: Failed to persist mapping', error);
      }
    }, this.config.persistenceDelay);
  }

  /**
   * Add change listener
   */
  addChangeListener(listener: (mapping: ViewAxisMapping) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * Remove change listener
   */
  removeChangeListener(listener: (mapping: ViewAxisMapping) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index >= 0) {
      this.changeListeners.splice(index, 1);
    }
  }

  private notifyChange(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener(this.getCurrentMapping());
      } catch (error) {
        console.error('PAFVAxisService: Change listener error', error);
      }
    });
  }

  /**
   * Get performance metrics
   */
  getMetrics(): SuperDynamicMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = this.initializeMetrics();
  }

  /**
   * Validate current axis mapping for consistency
   */
  validateMapping(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate axis assignments
    const assignedFacets = new Set<string>();

    [this.currentMapping.xAxis, this.currentMapping.yAxis, this.currentMapping.zAxis]
      .filter(Boolean)
      .forEach(axis => {
        if (assignedFacets.has(axis!.facet)) {
          errors.push(`Duplicate axis assignment: ${axis!.facet}`);
        }
        assignedFacets.add(axis!.facet);
      });

    // Check if assigned axes exist in available list
    Object.values(this.currentMapping).forEach(axis => {
      if (axis && !this.availableAxes.find(a => a.facet === axis.facet)) {
        errors.push(`Axis not available: ${axis.facet}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.persistenceTimeout) {
      clearTimeout(this.persistenceTimeout);
      this.persistenceTimeout = null;
    }

    this.changeListeners = [];
  }
}

/**
 * Factory function to create PAFVAxisService instance
 */
export function createPAFVAxisService(
  database: any,
  canvasId: string,
  options: Partial<PAFVAxisServiceConfig> = {}
): PAFVAxisService {
  const config: PAFVAxisServiceConfig = {
    database,
    canvasId,
    persistenceDelay: 500,
    enableMetrics: true,
    ...options
  };

  return new PAFVAxisService(config);
}