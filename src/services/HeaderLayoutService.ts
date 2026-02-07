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

import { stratify } from 'd3-hierarchy';
import type {
  HeaderNode,
  HeaderHierarchy,
  SpanCalculationConfig,
  HeaderStateManager
} from '../types/grid';
import { DEFAULT_SPAN_CONFIG, ContentAlignment } from '../types/grid';

export class HeaderLayoutService {
  private config: SpanCalculationConfig;
  private stateManager: HeaderStateManager | null = null;
  private calculationCache: Map<string, any> = new Map();

  constructor(config: SpanCalculationConfig = DEFAULT_SPAN_CONFIG) {
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
      return this.calculationCache.get(cacheKey);
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
    flatData: any[],
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
      console.error('Error generating header hierarchy:', error);
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

    // Date content always left-aligns with special treatment
    if (contentType === 'date') {
      return ContentAlignment.DATE_LEFT;
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
    if (this.stateManager) {
      this.stateManager.expandedNodes[hierarchy.axis] = hierarchy.expandedNodeIds;
      this.stateManager.saveState();
    }
  }

  /**
   * Load saved expansion state
   */
  public loadExpansionState(hierarchy: HeaderHierarchy): HeaderHierarchy {
    if (this.stateManager && this.stateManager.expandedNodes[hierarchy.axis]) {
      hierarchy.expandedNodeIds = this.stateManager.expandedNodes[hierarchy.axis];
      hierarchy.lastUpdated = Date.now();
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

  // Private helper methods

  private transformToHeaderNodes(
    flatData: any[],
    axis: string,
    facetField: string
  ): HeaderNode[] {
    // Group data by the specified facet
    const groups = flatData.reduce((acc: Record<string, any[]>, item) => {
      const value = item[facetField] || 'Unknown';
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
      facet: facetField,
      value: null,
      count: flatData.length,
      level: 0,
      span: Object.keys(groups).length,
      isExpanded: true,
      isLeaf: false,
      x: 0,
      y: 0,
      width: 0,
      height: 40,
      textAlign: ContentAlignment.CENTER,
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
        facet: facetField,
        value: value,
        count: items.length,
        level: 1,
        span: 1,
        isExpanded: false,
        isLeaf: true,
        x: 0,
        y: 40,
        width: 0,
        height: 40,
        textAlign: this.getContentAlignment(value, 1, 'text'),
        labelZone: { x: 0, y: 0, width: 32, height: 40 },
        bodyZone: { x: 32, y: 0, width: 0, height: 40 }
      });
    });

    return headerNodes;
  }

  private calculateLayout(root: any): void {
    // Traverse hierarchy and calculate positions
    let currentX = 0;

    root.eachBefore((node: any) => {
      const data = node.data as HeaderNode;

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

  private calculateMaxDepth(root: any): number {
    let maxDepth = 0;
    root.eachAfter((node: any) => {
      maxDepth = Math.max(maxDepth, node.depth);
    });
    return maxDepth;
  }

  private calculateTotalWidth(root: any): number {
    const leafNodes = root.leaves();
    return leafNodes.reduce((total: number, leaf: any) =>
      total + (leaf.data.width || 100), 0
    );
  }

  private calculateTotalHeight(root: any): number {
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
  flatData: any[],
  axis: string,
  facetField?: string,
  config?: SpanCalculationConfig
): HeaderHierarchy => {
  const service = new HeaderLayoutService(config);
  return service.generateHeaderHierarchy(flatData, axis, facetField);
};