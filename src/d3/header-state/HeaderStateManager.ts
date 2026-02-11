/**
 * HeaderStateManager - Handles persistence and restoration of header state
 *
 * Extracted from SuperGridHeaders.old.ts to manage state persistence,
 * column widths, and expanded node tracking.
 */

import type { HeaderHierarchy, HeaderNode } from '../../types/grid';
import type { useDatabaseService } from '../../hooks/database/useDatabaseService';
import { superGridLogger } from '../../utils/dev-logger';

export interface HeaderStateConfig {
  debounceMs: number;
  enableStatePersistence: boolean;
  enableColumnWidthPersistence: boolean;
}

export interface HeaderState {
  expandedNodes: Set<string>;
  columnWidths: Record<string, number>;
  totalWidth: number;
  lastModified: number;
}

export class HeaderStateManager {
  private database: ReturnType<typeof useDatabaseService> | null = null;
  private config: HeaderStateConfig;
  private currentDatasetId: string = 'default';
  private currentAppContext: string = 'supergrid';

  // Debounce timers
  private saveStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private saveColumnWidthsDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: HeaderStateConfig) {
    this.config = config;
  }

  /**
   * Set the database service for state persistence
   */
  public setDatabase(database: ReturnType<typeof useDatabaseService>): void {
    this.database = database;
  }

  /**
   * Set the context for state storage
   */
  public setStateContext(datasetId: string, appContext: string): void {
    this.currentDatasetId = datasetId;
    this.currentAppContext = appContext;

    if (this.database) {
      this.restoreHeaderState();
    }
  }

  /**
   * Save current header state with debouncing
   */
  public saveHeaderState(hierarchy: HeaderHierarchy): void {
    if (!this.database || !hierarchy || !this.config.enableStatePersistence) return;

    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }

    this.saveStateDebounceTimer = setTimeout(() => {
      this.performStateSave(hierarchy);
    }, this.config.debounceMs);
  }

  /**
   * Save column widths with debouncing
   */
  public saveColumnWidthState(hierarchy: HeaderHierarchy): void {
    if (!this.database || !hierarchy || !this.config.enableColumnWidthPersistence) return;

    if (this.saveColumnWidthsDebounceTimer) {
      clearTimeout(this.saveColumnWidthsDebounceTimer);
    }

    this.saveColumnWidthsDebounceTimer = setTimeout(() => {
      this.performColumnWidthSave(hierarchy);
    }, this.config.debounceMs);
  }

  /**
   * Restore header state from database
   */
  public async restoreHeaderState(): Promise<HeaderState | null> {
    const db = this.database?.getRawDatabase();
    if (!db) return null;

    try {
      const result = db.exec(`
        SELECT state_data
        FROM header_states
        WHERE dataset_id = ? AND app_context = ?
        ORDER BY created_at DESC
        LIMIT 1
      `, [this.currentDatasetId, this.currentAppContext]);

      if (!result?.[0]?.values?.[0]?.[0]) {
        superGridLogger.info('No saved header state found');
        return null;
      }

      const savedState = JSON.parse(result[0].values[0][0] as string);

      return {
        expandedNodes: new Set(savedState.expandedNodes || []),
        columnWidths: savedState.columnWidths || {},
        totalWidth: savedState.totalWidth || 0,
        lastModified: savedState.lastModified || Date.now()
      };

    } catch (error) {
      superGridLogger.error('Failed to restore header state:', error);
      return null;
    }
  }

  /**
   * Apply restored state to hierarchy
   */
  public applyStateToHierarchy(hierarchy: HeaderHierarchy, state: HeaderState): void {
    // Restore expanded states
    state.expandedNodes.forEach(nodeId => {
      const node = hierarchy.allNodes.find(n => n.id === nodeId);
      if (node && !node.isLeaf) {
        if (hierarchy.expandedNodeIds) {
          hierarchy.expandedNodeIds.add(nodeId);
        }
        node.isExpanded = true;
      }
    });

    // Restore column widths
    Object.entries(state.columnWidths).forEach(([nodeId, width]) => {
      const node = hierarchy.allNodes.find(n => n.id === nodeId);
      if (node) {
        node.width = width;
      }
    });

    // Restore total width
    if (state.totalWidth > 0) {
      hierarchy.totalWidth = state.totalWidth;
    }

    superGridLogger.debug('Header state applied', {
      expandedCount: state.expandedNodes.size,
      widthsCount: Object.keys(state.columnWidths).length,
      totalWidth: state.totalWidth
    });
  }

  /**
   * Create a state snapshot from current hierarchy
   */
  public createStateSnapshot(hierarchy: HeaderHierarchy): HeaderState {
    const columnWidths: Record<string, number> = {};

    // Collect all node widths
    hierarchy.allNodes.forEach((node: HeaderNode) => {
      if (node.width !== undefined) {
        columnWidths[node.id] = node.width;
      }
    });

    return {
      expandedNodes: new Set(hierarchy.expandedNodeIds ?? []),
      columnWidths,
      totalWidth: hierarchy.totalWidth,
      lastModified: Date.now()
    };
  }

  /**
   * Clear all debounce timers
   */
  public cleanup(): void {
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
      this.saveStateDebounceTimer = null;
    }
    if (this.saveColumnWidthsDebounceTimer) {
      clearTimeout(this.saveColumnWidthsDebounceTimer);
      this.saveColumnWidthsDebounceTimer = null;
    }
  }

  /**
   * Perform the actual state save operation
   */
  private async performStateSave(hierarchy: HeaderHierarchy): Promise<void> {
    if (!this.database || !hierarchy) return;

    try {
      const stateSnapshot = this.createStateSnapshot(hierarchy);
      const stateData = JSON.stringify({
        expandedNodes: Array.from(stateSnapshot.expandedNodes),
        columnWidths: stateSnapshot.columnWidths,
        totalWidth: stateSnapshot.totalWidth,
        lastModified: stateSnapshot.lastModified
      });

      const db = this.database.getRawDatabase();
      if (!db) return;
      db.run(`
        INSERT OR REPLACE INTO header_states
        (dataset_id, app_context, state_data, created_at)
        VALUES (?, ?, ?, ?)
      `, [
        this.currentDatasetId,
        this.currentAppContext,
        stateData,
        Date.now()
      ]);

      const changes = db.getRowsModified();
      if (changes > 0) {
        superGridLogger.debug('Header state saved successfully', {
          datasetId: this.currentDatasetId,
          appContext: this.currentAppContext,
          expandedCount: stateSnapshot.expandedNodes.size
        });
      }

    } catch (error) {
      superGridLogger.error('Failed to save header state:', error);
    }
  }

  /**
   * Perform the actual column width save operation
   */
  private async performColumnWidthSave(hierarchy: HeaderHierarchy): Promise<void> {
    const db = this.database?.getRawDatabase();
    if (!db || !hierarchy) return;

    try {
      const columnWidths: Record<string, number> = {};
      hierarchy.allNodes.forEach((node: HeaderNode) => {
        if (node.width !== undefined) {
          columnWidths[node.id] = node.width;
        }
      });

      const widthData = JSON.stringify(columnWidths);

      db.run(`
        INSERT OR REPLACE INTO column_widths
        (dataset_id, app_context, width_data, created_at)
        VALUES (?, ?, ?, ?)
      `, [
        this.currentDatasetId,
        this.currentAppContext,
        widthData,
        Date.now()
      ]);

      const changes = db.getRowsModified();
      if (changes > 0) {
        superGridLogger.debug('Column widths saved successfully', {
          datasetId: this.currentDatasetId,
          appContext: this.currentAppContext,
          widthCount: Object.keys(columnWidths).length
        });
      }

    } catch (error) {
      superGridLogger.error('Failed to save column widths:', error);
    }
  }
}