/**
 * Header Layout Service - Hybrid span calculation and hierarchy generation for SuperGrid headers
 *
 * Implements the user-decided hybrid approach:
 * - Data-proportional primary sizing (columns with more data get more space)
 * - Content-based minimums (header text must fit)
 * - Equal distribution as fallback when data counts are uniform
 *
 * This mirrors how Numbers and modern pivot tables handle column sizing.
 */

import { stratify, type HierarchyNode } from 'd3-hierarchy';
import type {
  HeaderNode,
  HeaderHierarchy,
  SpanCalculationConfig,
  HeaderStateManager
} from '../../types/grid';
import { ContentAlignment } from '../../types/grid';
import type { StackedAxisConfig } from '../../types/pafv';
import { devLogger } from '../../utils/dev-logger';

/**
 * Extended HeaderNode with optional facet and value fields used internally
 * by HeaderLayoutService for hierarchy generation from LATCH data.
 */
interface HeaderNodeWithFacet extends HeaderNode {
  facet: string;
  value: string | null;
  textAlign: ContentAlignment;
}

/** Default SpanCalculationConfig for HeaderLayoutService */
const DEFAULT_LAYOUT_CONFIG: SpanCalculationConfig = {
  enabled: true,
  maxSpan: 5,
  autoCollapse: true,
  minWidthPerCharacter: 8,
  absoluteMinWidth: 60,
  absoluteMaxWidth: 400,
  dataProportionalWeight: 0.7,
  useEqualFallback: true,
  uniformDataThreshold: 0.2,
  iconWidth: 24,
  enableCaching: true
};

export class HeaderLayoutService {
  private config: SpanCalculationConfig;
  private stateManager: HeaderStateManager | null = null;
  private calculationCache: Map<string, Map<string, number>> = new Map();

  constructor(config: SpanCalculationConfig = DEFAULT_LAYOUT_CONFIG) {
    this.config = config;
  }

  /**
   * Calculate span widths using hybrid approach
   *
   * Primary: data-proportional sizing
   * Fallback 1: content-based minimums
   * Fallback 2: equal distribution
   */
  public calculateSpanWidths(
    headerNodes: HeaderNode[],
    totalAvailableWidth: number
  ): Map<string, number> {
    const cacheKey = this.generateCacheKey(headerNodes, totalAvailableWidth);

    if (this.config.enableCaching && this.calculationCache.has(cacheKey)) {
      return this.calculationCache.get(cacheKey)!;
    }

    const widthMap = new Map<string, number>();

    // Step 1: Calculate data-proportional base widths
    const totalDataCount = headerNodes.reduce((sum, node) => sum + node.count, 0);
    const dataProportions = headerNodes.map(node =>
      totalDataCount > 0 ? node.count / totalDataCount : 1 / headerNodes.length
    );

    // Step 2: Calculate content-based minimums
    const contentMinimums = headerNodes.map(node =>
      Math.max(
        node.label.length * this.config.minWidthPerCharacter,
        this.config.absoluteMinWidth
      )
    );

    // Step 3: Check if data is uniform (coefficient of variation)
    const meanCount = totalDataCount / headerNodes.length;
    const variance = headerNodes.reduce((sum, node) =>
      sum + Math.pow(node.count - meanCount, 2), 0
    ) / headerNodes.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = meanCount > 0 ? standardDeviation / meanCount : 0;

    const useEqualFallback = this.config.useEqualFallback &&
                            coefficientOfVariation < this.config.uniformDataThreshold;

    // Step 4: Apply hybrid calculation
    const totalContentMinimum = contentMinimums.reduce((sum, min) => sum + min, 0);
    const availableForProportional = Math.max(0, totalAvailableWidth - totalContentMinimum);

    headerNodes.forEach((node, index) => {
      let width: number;

      if (useEqualFallback) {
        // Equal distribution fallback
        width = totalAvailableWidth / headerNodes.length;
      } else {
        // Data-proportional + content minimum
        const proportionalWidth = availableForProportional * dataProportions[index];
        const contentBasedWidth = contentMinimums[index];

        width = contentBasedWidth +
                (proportionalWidth * this.config.dataProportionalWeight);
      }

      // Apply absolute constraints
      width = Math.min(width, this.config.absoluteMaxWidth);
      width = Math.max(width, this.config.absoluteMinWidth);

      // Account for expand/collapse icon space
      if (!node.isLeaf) {
        width = Math.max(width, this.config.iconWidth + contentMinimums[index]);
      }

      widthMap.set(node.id, Math.floor(width));
    });

    // Cache the result
    if (this.config.enableCaching) {
      this.calculationCache.set(cacheKey, widthMap);
    }

    return widthMap;
  }

  /**
   * Generate header hierarchy from flat LATCH data using d3-hierarchy
   */
  public generateHeaderHierarchy(
    flatData: unknown[],
    axis: string,
    facetField: string = 'status'
  ): HeaderHierarchy {
    try {
      // Transform flat data to hierarchical nodes
      const headerData = this.transformToHeaderNodes(flatData, axis, facetField);

      // Use d3.stratify to create hierarchy
      const stratifyFn = stratify<HeaderNode>()
        .id((d: HeaderNode) => d.id)
        .parentId((d: HeaderNode) => d.parentId);

      const root = stratifyFn(headerData);

      // Calculate layout properties
      this.calculateLayout(root);

      // Build hierarchy structure
      const hierarchy: HeaderHierarchy = {
        axis,
        rootNodes: root.children?.map(child => child.data) || [],
        allNodes: headerData,
        maxDepth: this.calculateMaxDepth(root),
        totalWidth: this.calculateTotalWidth(root),
        totalHeight: this.calculateTotalHeight(root),
        expandedNodeIds: new Set(headerData.filter(node => node.isExpanded).map(node => node.id)),
        collapsedSubtrees: new Set(),
        config: this.config,
        lastUpdated: Date.now()
      };

      return hierarchy;

    } catch (error) {
      devLogger.error('Error generating header hierarchy', { error });
      throw new Error(`Failed to generate header hierarchy: ${error}`);
    }
  }

  /**
   * Get content alignment based on span length and content type
   */
  public getContentAlignment(
    text: string,
    _span: number,
    contentType: 'text' | 'numeric' | 'date' = 'text'
  ): ContentAlignment {
    // Numeric content always right-aligns regardless of span
    if (contentType === 'numeric') {
      return ContentAlignment.RIGHT;
    }

    // Date content always left-aligns
    if (contentType === 'date') {
      return ContentAlignment.LEFT;
    }

    // Text content: center for short spans, left for long spans
    const wordCount = text.trim().split(/\s+/).length;
    if (wordCount <= 3 && text.length <= 10) {
      return ContentAlignment.CENTER; // Short spans like 'Q1', 'Jan'
    }

    return ContentAlignment.LEFT; // Long spans like 'Engineering & Design'
  }

  /**
   * Set state manager for persistence
   */
  public setStateManager(stateManager: HeaderStateManager): void {
    this.stateManager = stateManager;
  }

  /**
   * Save current expansion state
   */
  public saveExpansionState(hierarchy: HeaderHierarchy): void {
    if (this.stateManager && hierarchy.expandedNodeIds) {
      // Sync expanded nodes from hierarchy into state manager
      const currentExpanded = this.stateManager.getExpandedNodeIds();
      // Reset all, then set the ones from hierarchy
      currentExpanded.forEach(id => this.stateManager!.setNodeExpanded(id, false));
      hierarchy.expandedNodeIds.forEach(id => this.stateManager!.setNodeExpanded(id, true));
    }
  }

  /**
   * Load saved expansion state
   */
  public loadExpansionState(hierarchy: HeaderHierarchy): HeaderHierarchy {
    if (this.stateManager) {
      const expandedIds = this.stateManager.getExpandedNodeIds();
      if (expandedIds.size > 0) {
        hierarchy.expandedNodeIds = expandedIds;
        hierarchy.lastUpdated = Date.now();
      }
    }
    return hierarchy;
  }

  /**
   * Calculate width for a single node based on content and data proportion
   */
  public calculateNodeWidth(node: HeaderNode, totalAvailableWidth: number): number {
    // Content-based minimum width
    const contentMinWidth = this.getContentMinWidth(node.label, node.level);

    // Data-proportional calculation (simplified for single node)
    const baseProportionalWidth = Math.max(
      contentMinWidth,
      totalAvailableWidth * 0.1 // Minimum 10% of available width
    );

    return Math.min(baseProportionalWidth, totalAvailableWidth * 0.5); // Max 50% of available
  }

  /**
   * Get content-based minimum width for a header label
   */
  private getContentMinWidth(label: string, _level: number): number {
    return Math.max(
      label.length * this.config.minWidthPerCharacter,
      this.config.absoluteMinWidth
    );
  }

  /**
   * Clear calculation cache
   */
  public clearCache(): void {
    this.calculationCache.clear();
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<SpanCalculationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCache(); // Clear cache when config changes
  }

  /**
   * Generate progressive hierarchy with level grouping for deep structures
   */
  public generateProgressiveHierarchy(
    flatData: unknown[],
    axis: string,
    facetField: string = 'status',
    maxVisibleLevels: number = 3
  ): HeaderHierarchy & { levelGroups: unknown[]; recommendedLevels: number[] } {
    const baseHierarchy = this.generateHeaderHierarchy(flatData, axis, facetField);

    // If hierarchy is shallow, return as-is
    if (baseHierarchy.maxDepth < maxVisibleLevels) {
      return {
        ...baseHierarchy,
        levelGroups: [],
        recommendedLevels: Array.from({ length: baseHierarchy.maxDepth + 1 }, (_, i) => i)
      };
    }

    // Analyze for progressive disclosure
    const levelGroups = this.analyzeLevelGroups(baseHierarchy, maxVisibleLevels);
    const recommendedLevels = this.getRecommendedStartLevels(baseHierarchy, maxVisibleLevels);

    return {
      ...baseHierarchy,
      levelGroups,
      recommendedLevels
    };
  }

  /**
   * Analyze hierarchy structure for level grouping opportunities
   */
  public analyzeLevelGroups(hierarchy: HeaderHierarchy, maxVisibleLevels: number): unknown[] {
    const groups = [];

    // Check for semantic patterns first
    const semanticGroups = this.findSemanticLevelGroups(hierarchy);
    groups.push(...semanticGroups);

    // Fallback to data density grouping
    if (groups.length === 0) {
      const densityGroups = this.createDataDensityGroups(hierarchy, maxVisibleLevels);
      groups.push(...densityGroups);
    }

    return groups;
  }

  /**
   * Find semantic grouping patterns in hierarchy levels
   */
  public findSemanticLevelGroups(hierarchy: HeaderHierarchy): unknown[] {
    const groups: unknown[] = [];
    const facetsByLevel = this.groupFacetsByLevel(hierarchy);

    // Common semantic patterns
    const patterns = {
      time: {
        facets: ['year', 'quarter', 'month', 'week', 'day', 'hour'],
        groupName: 'Time Periods',
        maxLevelsPerGroup: 3
      },
      location: {
        facets: ['country', 'region', 'state', 'city', 'address'],
        groupName: 'Geographic',
        maxLevelsPerGroup: 3
      },
      organization: {
        facets: ['company', 'department', 'team', 'person'],
        groupName: 'Organizational',
        maxLevelsPerGroup: 2
      },
      product: {
        facets: ['category', 'subcategory', 'product', 'variant'],
        groupName: 'Product Hierarchy',
        maxLevelsPerGroup: 2
      }
    };

    for (const [patternKey, pattern] of Object.entries(patterns)) {
      const matchingLevels = this.findPatternLevels(facetsByLevel, pattern.facets);

      if (matchingLevels.length >= 2) {
        // Split into chunks if too many levels
        const chunks = this.chunkLevels(matchingLevels, pattern.maxLevelsPerGroup);

        chunks.forEach((levels, index) => {
          const nodeCount = this.countNodesInLevels(hierarchy, levels);
          groups.push({
            id: `${patternKey}-${index}`,
            name: chunks.length > 1 ? `${pattern.groupName} ${index + 1}` : pattern.groupName,
            type: 'semantic',
            levels,
            nodeCount,
            pattern: patternKey
          });
        });
      }
    }

    return groups;
  }

  /**
   * Create data density-based groups as fallback
   */
  public createDataDensityGroups(hierarchy: HeaderHierarchy, maxVisibleLevels: number): unknown[] {
    const groups: unknown[] = [];
    const nodeCountsByLevel = this.getNodeCountsByLevel(hierarchy);
    const levels = Object.keys(nodeCountsByLevel).map(Number).sort((a, b) => a - b);

    // Create groups based on data density
    const levelChunks = this.chunkLevels(levels, maxVisibleLevels);

    levelChunks.forEach((chunk, index) => {
      const nodeCount = chunk.reduce((sum, level) => sum + nodeCountsByLevel[level], 0);
      const avgDensity = Math.round(nodeCount / chunk.length);

      let densityLabel = 'Light';
      if (avgDensity >= 15) densityLabel = 'Dense';
      else if (avgDensity >= 5) densityLabel = 'Medium';

      groups.push({
        id: `density-${index}`,
        name: `${densityLabel} Detail`,
        type: 'density',
        levels: chunk,
        nodeCount,
        avgDensity
      });
    });

    return groups;
  }

  /**
   * Get recommended starting levels for progressive disclosure
   */
  public getRecommendedStartLevels(hierarchy: HeaderHierarchy, maxVisibleLevels: number): number[] {
    // Start with top levels by default
    const topLevels = Array.from({ length: Math.min(maxVisibleLevels, hierarchy.maxDepth + 1) }, (_, i) => i);

    // Analyze data distribution to recommend better starting point
    const nodeCountsByLevel = this.getNodeCountsByLevel(hierarchy);
    const totalNodes = hierarchy.allNodes.length;

    // Find the level range with the most balanced distribution
    let bestScore = -1;
    let bestLevels = topLevels;

    for (let start = 0; start <= hierarchy.maxDepth - maxVisibleLevels + 1; start++) {
      const levels = Array.from({ length: maxVisibleLevels }, (_, i) => start + i);
      const validLevels = levels.filter(l => l <= hierarchy.maxDepth);

      if (validLevels.length < maxVisibleLevels) continue;

      // Calculate distribution score
      const nodesInRange = validLevels.reduce((sum, level) => sum + (nodeCountsByLevel[level] || 0), 0);
      const coverage = nodesInRange / totalNodes;
      const balance = this.calculateLevelBalance(validLevels, nodeCountsByLevel);

      const score = coverage * 0.6 + balance * 0.4; // Weight coverage more than balance

      if (score > bestScore) {
        bestScore = score;
        bestLevels = validLevels;
      }
    }

    return bestLevels;
  }

  /**
   * Calculate span widths for a specific level subset (progressive mode)
   */
  public calculateProgressiveSpanWidths(
    hierarchy: HeaderHierarchy,
    visibleLevels: number[],
    totalAvailableWidth: number
  ): Map<string, number> {
    // Filter nodes to only visible levels
    const visibleNodes = hierarchy.allNodes.filter(node => visibleLevels.includes(node.level));

    // Calculate widths for visible nodes only
    return this.calculateSpanWidths(visibleNodes, totalAvailableWidth);
  }

  // ============================================================================
  // Stacked Hierarchy Generation (Multi-facet support)
  // ============================================================================

  /**
   * Generate header hierarchy from multiple stacked facets
   * @param cards - Array of card records
   * @param stackedConfig - Axis with ordered facets (parent to child)
   * @returns HeaderHierarchy with computed spans and positions
   */
  public generateStackedHierarchy(
    cards: unknown[],
    stackedConfig: StackedAxisConfig
  ): HeaderHierarchy {
    devLogger.debug('[generateStackedHierarchy] START', {
      cardsCount: cards?.length ?? 0,
      axis: stackedConfig?.axis,
      facets: stackedConfig?.facets,
    });

    // Validate inputs
    if (!cards || cards.length === 0) {
      devLogger.warn('[generateStackedHierarchy] No cards provided, returning empty hierarchy');
      return this.createEmptyHierarchy(stackedConfig?.axis || 'unknown');
    }

    if (!stackedConfig?.facets || stackedConfig.facets.length === 0) {
      devLogger.warn('[generateStackedHierarchy] No facets in config, returning empty hierarchy');
      return this.createEmptyHierarchy(stackedConfig?.axis || 'unknown');
    }

    const flatNodes: HeaderNode[] = [];
    const { axis, facets } = stackedConfig;

    try {
      // Root node
      devLogger.debug('[generateStackedHierarchy] Creating root node');
      flatNodes.push(this.createHeaderNode({
        id: `${axis}-root`,
        label: axis.toUpperCase(),
        parentId: undefined,
        level: 0,
        facet: axis,
        span: 0, // Will be computed
      }));

      // Build nodes for each facet level
      devLogger.debug('[generateStackedHierarchy] Building nodes', { facetCount: facets.length });
      facets.forEach((facet, levelIndex) => {
        devLogger.debug('[generateStackedHierarchy] Processing facet', { facet, levelIndex });
        const uniqueValues = this.extractUniqueFacetValues(cards, facet);
        devLogger.debug('[generateStackedHierarchy] Found unique values', { facet, count: uniqueValues.length, sample: uniqueValues.slice(0, 5) });

        if (uniqueValues.length === 0) {
          devLogger.warn('[generateStackedHierarchy] No values found for facet', { facet, hint: 'facet might not exist in cards' });
          // Log sample card keys to help debug
          if (cards[0]) {
            devLogger.debug('[generateStackedHierarchy] Sample card keys', { keys: Object.keys(cards[0] as Record<string, unknown>) });
          }
        }

        uniqueValues.forEach(value => {
          const parentId = levelIndex > 0
            ? this.findParentNodeId(cards, facets, levelIndex, value, axis)
            : `${axis}-root`;

          flatNodes.push(this.createHeaderNode({
            id: `${axis}-${facet}-${value}`,
            label: this.formatLabel(value, facet),
            parentId,
            level: levelIndex + 1,
            facet,
            span: 1, // Leaf default
          }));
        });
      });

      devLogger.debug('[generateStackedHierarchy] Created flat nodes', { count: flatNodes.length });

      // Validate nodes before stratify
      const nodeIds = flatNodes.map(n => n.id);
      const duplicateIds = nodeIds.filter((id, idx) => nodeIds.indexOf(id) !== idx);
      if (duplicateIds.length > 0) {
        devLogger.error('[generateStackedHierarchy] Duplicate node IDs found', { duplicateIds });
      }

      const orphanNodes = flatNodes.filter(n => n.parentId && !nodeIds.includes(n.parentId));
      if (orphanNodes.length > 0) {
        devLogger.error('[generateStackedHierarchy] Orphan nodes (missing parent)', { orphans: orphanNodes.map(n => ({ id: n.id, parentId: n.parentId })) });
      }

      // Use d3.stratify to build hierarchy
      devLogger.debug('[generateStackedHierarchy] Running d3.stratify');
      const stratifyFn = stratify<HeaderNode>()
        .id(d => d.id)
        .parentId(d => d.parentId);

      const root = stratifyFn(flatNodes);
      devLogger.debug('[generateStackedHierarchy] Stratify complete', { rootHeight: root.height });

      // Calculate spans bottom-up
      devLogger.debug('[generateStackedHierarchy] Calculating spans');
      this.calculateStackedSpans(root);

      const result = this.buildHeaderHierarchyResult(root, axis, flatNodes);
      devLogger.debug('[generateStackedHierarchy] SUCCESS', {
        maxDepth: result.maxDepth,
        totalNodes: result.allNodes.length,
      });

      return result;
    } catch (error) {
      devLogger.error('[generateStackedHierarchy] FAILED', { error, flatNodesCount: flatNodes.length });
      // Return empty hierarchy to prevent crash
      return this.createEmptyHierarchy(axis);
    }
  }

  /**
   * Create an empty hierarchy for error cases
   */
  private createEmptyHierarchy(axis: string): HeaderHierarchy {
    return {
      axis,
      rootNodes: [],
      allNodes: [],
      maxDepth: 0,
      totalWidth: 0,
      totalHeight: 40,
      expandedNodeIds: new Set(),
      collapsedSubtrees: new Set(),
      config: this.config,
      lastUpdated: Date.now()
    };
  }

  /** Extract unique values for a facet from cards */
  private extractUniqueFacetValues(cards: unknown[], facet: string): string[] {
    const values = new Set<string>();

    if (!facet) {
      devLogger.warn('[extractUniqueFacetValues] No facet provided');
      return [];
    }

    cards.forEach((card, idx) => {
      if (!card) return;

      const record = card as Record<string, unknown>;
      const value = record[facet];

      // Log first card's structure for debugging
      if (idx === 0) {
        devLogger.debug('[extractUniqueFacetValues] First card', { keys: Object.keys(record).slice(0, 10), facet, value });
      }

      if (value != null && value !== '') {
        values.add(String(value));
      }
    });

    const result = Array.from(values).sort();
    devLogger.debug('[extractUniqueFacetValues] Found unique values', { facet, count: result.length });
    return result;
  }

  /** Find parent node ID for a child value at given level */
  private findParentNodeId(
    cards: unknown[],
    facets: string[],
    levelIndex: number,
    childValue: string,
    axis: string
  ): string {
    const parentFacet = facets[levelIndex - 1];
    const childFacet = facets[levelIndex];
    // Find a card with this child value and get its parent value
    const card = cards.find(c =>
      String((c as Record<string, unknown>)[childFacet]) === childValue
    );
    if (card) {
      const parentValue = (card as Record<string, unknown>)[parentFacet];
      return `${axis}-${parentFacet}-${parentValue}`;
    }
    return `${axis}-root`;
  }

  /** Calculate spans bottom-up using d3-hierarchy eachAfter */
  private calculateStackedSpans(root: HierarchyNode<HeaderNode>): void {
    root.eachAfter(node => {
      if (!node.children || node.children.length === 0) {
        node.data.span = 1; // Leaf nodes have span of 1
      } else {
        node.data.span = node.children.reduce((sum, child) => sum + child.data.span, 0);
      }
    });
  }

  /** Format value for display (date formatting, etc.) */
  private formatLabel(value: string, _facet: string): string {
    // Basic formatting - could be enhanced for dates
    return value;
  }

  /** Build final HeaderHierarchy result object */
  private buildHeaderHierarchyResult(
    root: HierarchyNode<HeaderNode>,
    axis: string,
    flatNodes: HeaderNode[]
  ): HeaderHierarchy {
    // CRITICAL: Populate children arrays from d3 hierarchy structure
    // The d3.stratify creates a tree but doesn't update the original flatNodes' children arrays
    this.populateChildrenFromHierarchy(root);

    // Update isLeaf status based on actual children
    flatNodes.forEach(node => {
      node.isLeaf = node.children.length === 0;
    });

    devLogger.debug('[buildHeaderHierarchyResult] Children populated', {
      nodesWithChildren: flatNodes.filter(n => n.children.length > 0).length,
      leafNodes: flatNodes.filter(n => n.isLeaf).length
    });

    return {
      axis,
      rootNodes: root.children?.map(c => c.data) || [],
      allNodes: flatNodes,
      maxDepth: root.height,
      totalWidth: this.calculateTotalWidth(root),
      totalHeight: (root.height + 1) * 40,
      expandedNodeIds: new Set(),
      collapsedSubtrees: new Set(),
      config: this.config,
      lastUpdated: Date.now()
    };
  }

  /**
   * Populate children arrays on HeaderNode data objects from d3 hierarchy
   * d3.stratify creates a tree structure but doesn't update the original node objects
   */
  private populateChildrenFromHierarchy(node: HierarchyNode<HeaderNode>): void {
    if (node.children && node.children.length > 0) {
      // Populate this node's data.children array with child node data objects
      node.data.children = node.children.map(child => child.data);

      // Recursively process children
      node.children.forEach(child => {
        // Set parent reference
        child.data.parent = node.data;
        this.populateChildrenFromHierarchy(child);
      });
    } else {
      // Leaf node - ensure empty array
      node.data.children = [];
    }
  }

  /** Create a HeaderNode with all required fields */
  private createHeaderNode(partial: {
    id: string;
    label: string;
    parentId: string | undefined;
    level: number;
    facet: string;
    span: number;
  }): HeaderNode {
    return {
      id: partial.id,
      label: partial.label,
      parentId: partial.parentId,
      level: partial.level,
      facet: partial.facet,
      span: partial.span,
      children: [],
      x: 0,
      y: partial.level * 40,
      width: 0,
      height: 40,
      isLeaf: true, // Will be updated based on children
      isExpanded: true,
      isVisible: true,
      count: 0,
    };
  }

  // Private helper methods for progressive features

  private groupFacetsByLevel(hierarchy: HeaderHierarchy): Record<number, Set<string>> {
    return hierarchy.allNodes.reduce((acc, node) => {
      if (!acc[node.level]) acc[node.level] = new Set();
      const facet = (node as HeaderNodeWithFacet).facet ?? node.label;
      acc[node.level].add(facet);
      return acc;
    }, {} as Record<number, Set<string>>);
  }

  private findPatternLevels(facetsByLevel: Record<number, Set<string>>, patternFacets: string[]): number[] {
    const matchingLevels: number[] = [];

    for (const [levelStr, facets] of Object.entries(facetsByLevel)) {
      const level = parseInt(levelStr, 10);
      const hasPatternFacet = patternFacets.some(facet => facets.has(facet));

      if (hasPatternFacet) {
        matchingLevels.push(level);
      }
    }

    return matchingLevels.sort((a, b) => a - b);
  }

  private chunkLevels(levels: number[], chunkSize: number): number[][] {
    const chunks: number[][] = [];
    for (let i = 0; i < levels.length; i += chunkSize) {
      chunks.push(levels.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private countNodesInLevels(hierarchy: HeaderHierarchy, levels: number[]): number {
    return hierarchy.allNodes.filter(node => levels.includes(node.level)).length;
  }

  private getNodeCountsByLevel(hierarchy: HeaderHierarchy): Record<number, number> {
    return hierarchy.allNodes.reduce((acc, node) => {
      acc[node.level] = (acc[node.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
  }

  private calculateLevelBalance(levels: number[], nodeCountsByLevel: Record<number, number>): number {
    const counts = levels.map(level => nodeCountsByLevel[level] || 0);
    const mean = counts.reduce((sum, count) => sum + count, 0) / counts.length;

    if (mean === 0) return 0;

    const variance = counts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    // Return balance score (0-1, where 1 is perfect balance)
    return Math.max(0, 1 - coefficientOfVariation);
  }

  // Private helper methods

  private transformToHeaderNodes(
    flatData: unknown[],
    axis: string,
    facetField: string
  ): HeaderNode[] {
    // Group data by the specified facet
    const groups = flatData.reduce((acc: Record<string, unknown[]>, item: unknown) => {
      const record = item as Record<string, unknown>;
      const value = String(record[facetField] ?? 'Unknown');
      if (!acc[value]) acc[value] = [];
      acc[value].push(item);
      return acc;
    }, {});

    // Create header nodes for each group
    const headerNodes: HeaderNode[] = [];

    // Add root node
    const rootId = `${axis}-root`;
    headerNodes.push({
      id: rootId,
      label: axis.toUpperCase(),
      parentId: undefined,
      children: [],
      count: flatData.length,
      level: 0,
      span: Object.keys(groups).length,
      isExpanded: true,
      isLeaf: false,
      isVisible: true,
      x: 0,
      y: 0,
      width: 0,
      height: 40,
      data: { facet: facetField, value: null, textAlign: ContentAlignment.CENTER },
      labelZone: { x: 0, y: 0, width: 32, height: 40 },
      bodyZone: { x: 32, y: 0, width: 0, height: 40 }
    });

    // Add child nodes for each group
    Object.entries(groups).forEach(([value, items]) => {
      const nodeId = `${axis}-${facetField}-${value}`;

      headerNodes.push({
        id: nodeId,
        label: value.charAt(0).toUpperCase() + value.slice(1),
        parentId: rootId,
        children: [],
        count: items.length,
        level: 1,
        span: 1,
        isExpanded: false,
        isLeaf: true,
        isVisible: true,
        x: 0,
        y: 40,
        width: 0,
        height: 40,
        data: { facet: facetField, value, textAlign: this.getContentAlignment(value, 1, 'text') },
        labelZone: { x: 0, y: 0, width: 32, height: 40 },
        bodyZone: { x: 32, y: 0, width: 0, height: 40 }
      });
    });

    return headerNodes;
  }

  private calculateLayout(root: HierarchyNode<HeaderNode>): void {
    // Traverse hierarchy and calculate positions
    let currentX = 0;

    root.eachBefore((node: HierarchyNode<HeaderNode>) => {
      const data = node.data;

      if (node.depth === 0) {
        // Root positioning
        data.x = 0;
        data.y = 0;
      } else {
        // Child positioning
        data.x = currentX;
        data.y = node.depth * 40; // 40px height per level
        currentX += data.width || 100; // Default width if not calculated
      }

      // Update click zones based on calculated positions
      data.labelZone = {
        x: data.x,
        y: data.y,
        width: this.config.iconWidth,
        height: data.height
      };

      data.bodyZone = {
        x: data.x + this.config.iconWidth,
        y: data.y,
        width: Math.max(0, data.width - this.config.iconWidth),
        height: data.height
      };
    });
  }

  private calculateMaxDepth(root: HierarchyNode<HeaderNode>): number {
    let maxDepth = 0;
    root.eachAfter((node: HierarchyNode<HeaderNode>) => {
      maxDepth = Math.max(maxDepth, node.depth);
    });
    return maxDepth;
  }

  private calculateTotalWidth(root: HierarchyNode<HeaderNode>): number {
    const leafNodes = root.leaves();
    return leafNodes.reduce((total: number, leaf: HierarchyNode<HeaderNode>) =>
      total + (leaf.data.width || 100), 0
    );
  }

  private calculateTotalHeight(root: HierarchyNode<HeaderNode>): number {
    return (this.calculateMaxDepth(root) + 1) * 40; // 40px per level
  }

  private generateCacheKey(headerNodes: HeaderNode[], totalWidth: number): string {
    const nodeKey = headerNodes.map(node =>
      `${node.id}:${node.count}:${node.label.length}`
    ).join('|');
    return `${nodeKey}:${totalWidth}:${JSON.stringify(this.config)}`;
  }
}

// Export utility functions for external use
export const calculateSpanWidths = (
  headerNodes: HeaderNode[],
  totalWidth: number,
  config?: SpanCalculationConfig
): Map<string, number> => {
  const service = new HeaderLayoutService(config);
  return service.calculateSpanWidths(headerNodes, totalWidth);
};

export const generateHeaderHierarchy = (
  flatData: unknown[],
  axis: string,
  facetField?: string,
  config?: SpanCalculationConfig
): HeaderHierarchy => {
  const service = new HeaderLayoutService(config);
  return service.generateHeaderHierarchy(flatData, axis, facetField);
};