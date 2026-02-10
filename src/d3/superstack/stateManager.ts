/**
 * State Management for SuperStack Progressive Disclosure
 *
 * Handles persistence and restoration of progressive disclosure state
 */

import type { ProgressiveState, LevelGroup } from './types';
import type { useDatabaseService } from '../../hooks/database/useDatabaseService';
import { superGridLogger } from '../../utils/dev-logger';

// Extended state for internal use
interface InternalProgressiveState extends ProgressiveState {
  datasetId: string;
  appContext: string;
  groups: LevelGroup[];
  lastUpdated: string;
}

export class StateManager {
  private database: ReturnType<typeof useDatabaseService> | null = null;
  private currentDatasetId: string = 'default';
  private currentAppContext: string = 'supergrid';
  private saveStateDebounceTimer: NodeJS.Timeout | null = null;

  constructor(database: ReturnType<typeof useDatabaseService> | null = null) {
    this.database = database;
  }

  /**
   * Set the database service
   */
  public setDatabase(database: ReturnType<typeof useDatabaseService>): void {
    this.database = database;
  }

  /**
   * Set state context for persistence
   */
  public setStateContext(datasetId: string, appContext: string): void {
    this.currentDatasetId = datasetId;
    this.currentAppContext = appContext;
  }

  /**
   * Get current state context
   */
  public getStateContext(): { datasetId: string; appContext: string } {
    return {
      datasetId: this.currentDatasetId,
      appContext: this.currentAppContext
    };
  }

  /**
   * Restore progressive disclosure state from database
   */
  public restoreState(): ProgressiveState | null {
    const db = this.database;
    if (!db) return null;

    try {
      const savedState = db.loadProgressiveState?.(
        this.currentDatasetId,
        this.currentAppContext
      );

      if (savedState) {
        const state: ProgressiveState = {
          visibleLevels: savedState.visibleLevels || [0, 1, 2],
          currentTab: savedState.currentTab || 0,
          zoomLevel: (savedState as any).zoomLevel || 0,
          levelGroups: (savedState as any).groups || [],
          loadedLevels: (savedState as any).loadedLevels || []
        };

        // Also restore level visibility state for compatibility
        const levelVisibility = db.loadLevelVisibility?.(
          this.currentDatasetId,
          this.currentAppContext
        );

        if (levelVisibility?.visibleLevels) {
          state.visibleLevels = levelVisibility.visibleLevels;
        }

        superGridLogger.state('Progressive state restored', {
          datasetId: this.currentDatasetId,
          appContext: this.currentAppContext,
          state
        });

        return state;
      }
    } catch (error) {
      console.error('❌ Error restoring progressive state:', error);
    }

    return null;
  }

  /**
   * Save progressive disclosure state to database (debounced)
   */
  public saveState(
    visibleLevels: number[],
    currentTab: number,
    zoomLevel: number,
    levelGroups: LevelGroup[],
    loadedLevels: number[]
  ): void {
    const db = this.database;
    if (!db) return;

    // Clear existing debounce timer
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
    }

    // Debounce saves to prevent excessive database writes
    this.saveStateDebounceTimer = setTimeout(() => {
      const state: InternalProgressiveState = {
        datasetId: this.currentDatasetId,
        appContext: this.currentAppContext,
        visibleLevels,
        currentTab,
        zoomLevel,
        levelGroups,
        loadedLevels,
        groups: levelGroups,
        lastUpdated: new Date().toISOString()
      };

      try {
        // Save progressive state
        const result = db.saveProgressiveState?.(this.currentDatasetId, this.currentAppContext, state);

        // Also save level visibility for compatibility
        const levelResult = db.saveLevelVisibility?.(
          this.currentDatasetId,
          this.currentAppContext,
          visibleLevels
        );

        if (result || levelResult) {
          superGridLogger.state('Progressive state saved', {
            datasetId: this.currentDatasetId,
            appContext: this.currentAppContext,
            visibleLevels,
            currentTab,
            zoomLevel
          });
        } else {
          superGridLogger.state('Progressive state save failed', {
            datasetId: this.currentDatasetId,
            appContext: this.currentAppContext
          });
        }
      } catch (error) {
        console.error('❌ Error saving progressive state:', error);
      }
    }, 500); // 500ms debounce
  }

  /**
   * Clear any pending save operations
   */
  public clearPendingSaves(): void {
    if (this.saveStateDebounceTimer) {
      clearTimeout(this.saveStateDebounceTimer);
      this.saveStateDebounceTimer = null;
    }
  }

  /**
   * Force immediate save (bypass debounce)
   */
  public forceSave(
    visibleLevels: number[],
    currentTab: number,
    zoomLevel: number,
    levelGroups: LevelGroup[],
    loadedLevels: number[]
  ): void {
    this.clearPendingSaves();

    const db = this.database;
    if (!db) return;

    const state: InternalProgressiveState = {
      datasetId: this.currentDatasetId,
      appContext: this.currentAppContext,
      visibleLevels,
      currentTab,
      zoomLevel,
      levelGroups,
      loadedLevels,
      groups: levelGroups,
      lastUpdated: new Date().toISOString()
    };

    try {
      db.saveProgressiveState?.(this.currentDatasetId, this.currentAppContext, state);
      db.saveLevelVisibility?.(this.currentDatasetId, this.currentAppContext, visibleLevels);

      superGridLogger.state('Progressive state force saved', {
        datasetId: this.currentDatasetId,
        appContext: this.currentAppContext
      });
    } catch (error) {
      console.error('❌ Error force saving progressive state:', error);
    }
  }
}