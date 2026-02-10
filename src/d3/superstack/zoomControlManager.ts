/**
 * Zoom Control Management for SuperStack Progressive Disclosure
 *
 * Handles hierarchical zoom navigation (3D camera effect)
 */

import type { HeaderHierarchy } from '../../types/grid';
import type { ZoomControlState, SuperStackProgressiveConfig } from './types';
import { superGridLogger } from '../../utils/dev-logger';

export class ZoomControlManager {
  private zoomLevel: number = 0;
  private config: SuperStackProgressiveConfig;

  constructor(config: SuperStackProgressiveConfig) {
    this.config = config;
  }

  /**
   * Step down one level in the hierarchy (3D camera effect)
   */
  public stepDown(
    visibleLevels: number[],
    hierarchy: HeaderHierarchy,
    onLevelsChange: (levels: number[]) => void
  ): boolean {
    const maxLevel = hierarchy.maxDepth;
    const currentMax = Math.max(...visibleLevels);

    // Check if we can step down
    if (currentMax >= maxLevel) return false;

    // Calculate new levels by shifting down one
    const newLevels = visibleLevels.map(level => level + 1);
    onLevelsChange(newLevels);

    superGridLogger.state('Stepped down hierarchy', {
      from: visibleLevels,
      to: newLevels
    });

    return true;
  }

  /**
   * Step up one level in the hierarchy (3D camera effect)
   */
  public stepUp(
    visibleLevels: number[],
    onLevelsChange: (levels: number[]) => void
  ): boolean {
    const currentMin = Math.min(...visibleLevels);

    // Check if we can step up
    if (currentMin <= 0) return false;

    // Calculate new levels by shifting up one
    const newLevels = visibleLevels.map(level => level - 1);
    onLevelsChange(newLevels);

    superGridLogger.state('Stepped up hierarchy', {
      from: visibleLevels,
      to: newLevels
    });

    return true;
  }

  /**
   * Get zoom control state for UI rendering
   */
  public getZoomControlState(hierarchy: HeaderHierarchy | null): ZoomControlState {
    if (!hierarchy) {
      return {
        canZoomIn: false,
        canZoomOut: false,
        currentLevel: 0,
        maxLevel: 0,
        levelLabels: []
      };
    }

    const maxLevel = Math.max(0, Math.ceil(hierarchy.maxDepth / this.config.maxVisibleLevels) - 1);

    return {
      canZoomIn: this.zoomLevel > 0,
      canZoomOut: this.zoomLevel < maxLevel,
      currentLevel: this.zoomLevel,
      maxLevel,
      levelLabels: this.generateZoomLevelLabels(maxLevel + 1)
    };
  }

  /**
   * Set the current zoom level
   */
  public setZoomLevel(level: number): void {
    this.zoomLevel = level;
  }

  /**
   * Get the current zoom level
   */
  public getZoomLevel(): number {
    return this.zoomLevel;
  }

  /**
   * Check if zoom in is possible
   */
  public canZoomIn(): boolean {
    return this.zoomLevel > 0;
  }

  /**
   * Check if zoom out is possible
   */
  public canZoomOut(hierarchy: HeaderHierarchy | null): boolean {
    if (!hierarchy) return false;
    const maxLevel = Math.max(0, Math.ceil(hierarchy.maxDepth / this.config.maxVisibleLevels) - 1);
    return this.zoomLevel < maxLevel;
  }

  /**
   * Generate human-readable labels for zoom levels
   */
  private generateZoomLevelLabels(count: number): string[] {
    const labels = [];
    for (let i = 0; i < count; i++) {
      if (i === 0) labels.push('Detail');
      else if (i === count - 1) labels.push('Overview');
      else labels.push(`Level ${i}`);
    }
    return labels;
  }
}