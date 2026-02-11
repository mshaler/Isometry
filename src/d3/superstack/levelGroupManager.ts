/**
 * Level Group Management for SuperStack Progressive Disclosure
 *
 * Handles semantic and density-based grouping of hierarchy levels
 */

import type { HeaderHierarchy } from '../../types/grid';
import type { LevelGroup, SuperStackProgressiveConfig } from './types';
import { superGridLogger } from '../../utils/dev-logger';

// Semantic grouping patterns
const SEMANTIC_PATTERNS = {
  time: {
    facets: ['year', 'quarter', 'month', 'week', 'day'],
    groupName: 'Time',
    maxLevelsPerGroup: 3
  },
  location: {
    facets: ['country', 'region', 'state', 'city', 'neighborhood'],
    groupName: 'Location',
    maxLevelsPerGroup: 3
  },
  hierarchy: {
    facets: ['department', 'team', 'role', 'person'],
    groupName: 'Organization',
    maxLevelsPerGroup: 2
  },
  category: {
    facets: ['category', 'subcategory', 'type', 'subtype'],
    groupName: 'Categories',
    maxLevelsPerGroup: 2
  }
};

export class LevelGroupManager {
  private levelGroups: LevelGroup[] = [];

  /**
   * Build level groups for the given hierarchy
   */
  public buildLevelGroups(
    hierarchy: HeaderHierarchy,
    config: SuperStackProgressiveConfig
  ): void {
    this.levelGroups = [];

    if (config.semanticGrouping) {
      this.buildSemanticGroups(hierarchy);
    }

    // Always build data density groups as fallback
    this.buildDataDensityGroups(hierarchy, config);

    superGridLogger.metrics('Level groups built', {
      semanticGroups: this.getSemanticGroups().length,
      densityGroups: this.getDataDensityGroups().length
    });
  }

  /**
   * Get all semantic groups
   */
  public getSemanticGroups(): LevelGroup[] {
    return this.levelGroups.filter(group => group.type === 'semantic');
  }

  /**
   * Get all data density groups
   */
  public getDataDensityGroups(): LevelGroup[] {
    return this.levelGroups.filter(group => group.type === 'density');
  }

  /**
   * Get all level groups
   */
  public getAllGroups(): LevelGroup[] {
    return [...this.levelGroups];
  }

  /**
   * Check if auto-grouping should be applied
   */
  public hasAutoGrouping(hierarchy: HeaderHierarchy, config: SuperStackProgressiveConfig): boolean {
    return hierarchy.maxDepth >= config.autoGroupThreshold;
  }

  /**
   * Build semantic groups based on facet patterns
   */
  private buildSemanticGroups(hierarchy: HeaderHierarchy): void {
    // Group levels by facet patterns
    const facetsByLevel = hierarchy.allNodes.reduce((acc, node) => {
      if (!acc[node.level]) acc[node.level] = new Set();
      if (node.facet) acc[node.level].add(node.facet);
      return acc;
    }, {} as Record<number, Set<string>>);

    // Find semantic patterns
    for (const [patternKey, pattern] of Object.entries(SEMANTIC_PATTERNS)) {
      const matchingLevels: number[] = [];

      for (let level = 0; level <= hierarchy.maxDepth; level++) {
        const facetsAtLevel = facetsByLevel[level];
        if (facetsAtLevel) {
          const hasPatternFacet = pattern.facets.some(facet => facetsAtLevel.has(facet));
          if (hasPatternFacet) {
            matchingLevels.push(level);
          }
        }
      }

      // Create groups if we found matching levels
      if (matchingLevels.length >= 2) {
        // Split into chunks of maxLevelsPerGroup
        const chunks = this.chunkArray(matchingLevels, pattern.maxLevelsPerGroup);

        chunks.forEach((levels, index) => {
          const groupName = chunks.length > 1
            ? `${pattern.groupName} ${index + 1}`
            : pattern.groupName;

          const nodeCount = levels.reduce((sum, level) => {
            return sum + hierarchy.allNodes.filter(n => n.level === level).length;
          }, 0);

          this.levelGroups.push({
            id: `${patternKey}-${index}`,
            name: groupName,
            levels,
            type: 'semantic',
            expanded: false,
            nodeCount
          });
        });
      }
    }
  }

  /**
   * Build data density groups based on node counts
   */
  private buildDataDensityGroups(hierarchy: HeaderHierarchy, config: SuperStackProgressiveConfig): void {
    // Group levels by node density
    const nodeCountsByLevel = hierarchy.allNodes.reduce((acc, node) => {
      acc[node.level] = (acc[node.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const levels = Object.keys(nodeCountsByLevel).map(Number).sort((a, b) => a - b);

    // Create density groups
    const densityGroups = this.chunkArray(levels, config.maxVisibleLevels);

    densityGroups.forEach((groupLevels, index) => {
      const nodeCount = groupLevels.reduce((sum, level) => {
        return sum + (nodeCountsByLevel[level] || 0);
      }, 0);

      const avgDensity = Math.round(nodeCount / groupLevels.length);
      const densityLabel = avgDensity < 5 ? 'Light' : avgDensity < 15 ? 'Medium' : 'Dense';

      this.levelGroups.push({
        id: `density-${index}`,
        name: `${densityLabel} Detail`,
        levels: groupLevels,
        type: 'density',
        expanded: index === 0, // First group expanded by default
        nodeCount
      });
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