/**
 * Level Picker Management for SuperStack Progressive Disclosure
 *
 * Handles tab-based navigation through hierarchy levels
 */

import type { HeaderHierarchy } from '../../types/grid';
import type { LevelPickerTab, LevelGroup, SuperStackProgressiveConfig } from './types';
import { superGridLogger } from '../../utils/dev-logger';

export class LevelPickerManager {
  private tabs: LevelPickerTab[] = [];
  private currentTab: number = 0;

  /**
   * Create level picker tabs from level groups or default chunking
   */
  public createTabs(
    hierarchy: HeaderHierarchy,
    levelGroups: LevelGroup[],
    config: SuperStackProgressiveConfig,
    currentTabIndex: number = 0
  ): void {
    this.currentTab = currentTabIndex;

    // Create tabs from level groups or default chunking
    if (levelGroups.length > 0) {
      // Use level groups to create tabs
      this.tabs = levelGroups.map((group, index) => ({
        id: group.id,
        label: group.name,
        levels: group.levels,
        isActive: index === this.currentTab,
        nodeCount: group.nodeCount
      }));
    } else {
      // Default chunking by maxVisibleLevels
      this.tabs = this.createDefaultTabs(hierarchy, config);
    }

    // Update current tab state
    if (this.currentTab >= this.tabs.length) {
      this.currentTab = 0;
    }

    this.updateActiveStates();
  }

  /**
   * Select a specific tab
   */
  public selectTab(tabIndex: number): LevelPickerTab | null {
    if (tabIndex < 0 || tabIndex >= this.tabs.length) return null;

    this.currentTab = tabIndex;
    const tab = this.tabs[tabIndex];

    // Update tab states
    this.updateActiveStates();

    superGridLogger.state('Level tab selected', {
      tabIndex,
      tabLabel: tab.label,
      levels: tab.levels
    });

    return tab;
  }

  /**
   * Get current tab state
   */
  public getState(): { tabs: LevelPickerTab[]; currentTab: number } {
    return {
      tabs: [...this.tabs],
      currentTab: this.currentTab
    };
  }

  /**
   * Update active tab based on visible levels
   */
  public updateActiveTab(visibleLevels: number[]): void {
    // Update which tab should be active based on current visible levels
    this.tabs.forEach((tab, index) => {
      const hasOverlap = tab.levels.some(level => visibleLevels.includes(level));
      if (hasOverlap && index !== this.currentTab) {
        this.currentTab = index;
      }
    });

    this.updateActiveStates();
  }

  /**
   * Get the currently active tab
   */
  public getCurrentTab(): LevelPickerTab | null {
    return this.tabs[this.currentTab] || null;
  }

  /**
   * Get all tabs
   */
  public getAllTabs(): LevelPickerTab[] {
    return [...this.tabs];
  }

  /**
   * Create default tabs when no level groups are available
   */
  private createDefaultTabs(hierarchy: HeaderHierarchy, config: SuperStackProgressiveConfig): LevelPickerTab[] {
    const allLevels = Array.from({ length: hierarchy.maxDepth + 1 }, (_, i) => i);
    const chunks = this.chunkArray(allLevels, config.maxVisibleLevels);

    return chunks.map((levels, index) => {
      const nodeCount = levels.reduce((sum, level) => {
        return sum + hierarchy.allNodes.filter(n => n.level === level).length;
      }, 0);

      return {
        id: `tab-${index}`,
        label: `Levels ${levels[0]}-${levels[levels.length - 1]}`,
        levels,
        isActive: index === this.currentTab,
        nodeCount
      };
    });
  }

  /**
   * Update active states for all tabs
   */
  private updateActiveStates(): void {
    this.tabs.forEach((tab, index) => {
      tab.isActive = index === this.currentTab;
    });
  }

  /**
   * Utility method to chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}