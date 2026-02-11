/**
 * Smart cache invalidation strategies for Isometry queries
 *
 * Provides intelligent query invalidation patterns that minimize unnecessary
 * re-fetching while maintaining data consistency across the application.
 */

import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '../services/query/queryClient';
import { devLogger } from './logging';

/**
 * Cache invalidation strategy types
 */
export type InvalidationStrategy =
  | 'selective'    // Invalidate only directly affected queries
  | 'related'      // Invalidate directly affected + related queries
  | 'graph-wide'   // Invalidate all graph-related queries
  | 'optimistic'; // Use optimistic updates with rollback

/**
 * Node operation types for cache invalidation
 */
export interface NodeOperation {
  type: 'create' | 'update' | 'delete' | 'bulk';
  nodeId?: string;
  nodeType?: string;
  folder?: string;
  tags?: string[];
  affectedFields?: string[];
}

/**
 * Edge operation types for cache invalidation
 */
export interface EdgeOperation {
  type: 'create' | 'delete' | 'bulk';
  edgeId?: string;
  sourceId?: string;
  targetId?: string;
  edgeType?: string;
}

/**
 * Cache invalidation pattern matching utility
 */
export class CacheInvalidationManager {
  private queryClient: QueryClient;
  private invalidationHistory: Array<{
    timestamp: number;
    operation: string;
    affectedQueries: number;
    strategy: InvalidationStrategy;
  }> = [];

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Invalidate queries based on node operations
   */
  async invalidateForNodeOperation(
    operation: NodeOperation,
    strategy: InvalidationStrategy = 'related'
  ): Promise<void> {
    const startTime = Date.now();
    let affectedQueries = 0;

    switch (strategy) {
      case 'selective':
        affectedQueries = await this.selectiveNodeInvalidation(operation);
        break;
      case 'related':
        affectedQueries = await this.relatedNodeInvalidation(operation);
        break;
      case 'graph-wide':
        affectedQueries = await this.graphWideInvalidation();
        break;
      case 'optimistic':
        // Optimistic updates are handled separately in mutation hooks
        return;
    }

    this.recordInvalidation('node', affectedQueries, strategy, startTime);
  }

  /**
   * Invalidate queries based on edge operations
   */
  async invalidateForEdgeOperation(
    operation: EdgeOperation,
    strategy: InvalidationStrategy = 'related'
  ): Promise<void> {
    const startTime = Date.now();
    let affectedQueries = 0;

    switch (strategy) {
      case 'selective':
        affectedQueries = await this.selectiveEdgeInvalidation(operation);
        break;
      case 'related':
        affectedQueries = await this.relatedEdgeInvalidation(operation);
        break;
      case 'graph-wide':
        affectedQueries = await this.graphWideInvalidation();
        break;
      case 'optimistic':
        // Optimistic updates are handled separately in mutation hooks
        return;
    }

    this.recordInvalidation('edge', affectedQueries, strategy, startTime);
  }

  /**
   * Selective node invalidation - only directly affected queries
   */
  private async selectiveNodeInvalidation(operation: NodeOperation): Promise<number> {
    let count = 0;

    if (operation.nodeId) {
      // Invalidate specific node query
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.node(operation.nodeId)
      });
      count++;
    }

    if (operation.type === 'delete' && operation.nodeId) {
      // Remove deleted node from cache
      this.queryClient.removeQueries({
        queryKey: queryKeys.node(operation.nodeId)
      });
    }

    return count;
  }

  /**
   * Related node invalidation - node + related queries
   */
  private async relatedNodeInvalidation(operation: NodeOperation): Promise<number> {
    let count = 0;

    // Start with selective invalidation
    count += await this.selectiveNodeInvalidation(operation);

    if (operation.nodeId) {
      // Invalidate edges involving this node
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edgesByNode(operation.nodeId)
      });
      count++;

      // Invalidate graph neighbors
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.graphNeighbors(operation.nodeId)
      });
      count++;
    }

    // Invalidate queries by type if node type changed
    if (operation.nodeType) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.nodesByType(operation.nodeType)
      });
      count++;
    }

    // Invalidate queries by folder if folder changed
    if (operation.folder) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.nodesByFolder(operation.folder)
      });
      count++;
    }

    // Invalidate queries by tags if tags changed
    if (operation.tags && operation.tags.length > 0) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.nodesWithTags(operation.tags)
      });
      count++;
    }

    // Invalidate all nodes list for create/delete operations
    if (operation.type === 'create' || operation.type === 'delete' || operation.type === 'bulk') {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.nodes
      });
      count++;
    }

    // Invalidate search queries if content/title fields affected
    if (operation.affectedFields?.some(field => ['title', 'content', 'summary'].includes(field))) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.search
      });
      count++;
    }

    return count;
  }

  /**
   * Selective edge invalidation - only directly affected queries
   */
  private async selectiveEdgeInvalidation(operation: EdgeOperation): Promise<number> {
    let count = 0;

    if (operation.edgeId) {
      // Invalidate specific edge query
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edge(operation.edgeId)
      });
      count++;
    }

    if (operation.type === 'delete' && operation.edgeId) {
      // Remove deleted edge from cache
      this.queryClient.removeQueries({
        queryKey: queryKeys.edge(operation.edgeId)
      });
    }

    return count;
  }

  /**
   * Related edge invalidation - edge + related queries
   */
  private async relatedEdgeInvalidation(operation: EdgeOperation): Promise<number> {
    let count = 0;

    // Start with selective invalidation
    count += await this.selectiveEdgeInvalidation(operation);

    // Invalidate source node relationships
    if (operation.sourceId) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edgesByNode(operation.sourceId)
      });
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.graphNeighbors(operation.sourceId)
      });
      count += 2;
    }

    // Invalidate target node relationships
    if (operation.targetId) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edgesByNode(operation.targetId)
      });
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.graphNeighbors(operation.targetId)
      });
      count += 2;
    }

    // Invalidate queries by edge type
    if (operation.edgeType) {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edgesByType(operation.edgeType)
      });
      count++;
    }

    // Invalidate all edges list for create/delete operations
    if (operation.type === 'create' || operation.type === 'delete' || operation.type === 'bulk') {
      await this.queryClient.invalidateQueries({
        queryKey: queryKeys.edges
      });
      count++;
    }

    // Invalidate graph structure queries
    await this.queryClient.invalidateQueries({
      queryKey: queryKeys.graph
    });
    count++;

    return count;
  }

  /**
   * Graph-wide invalidation - all graph-related queries
   */
  private async graphWideInvalidation(): Promise<number> {
    const promises = [
      this.queryClient.invalidateQueries({ queryKey: queryKeys.nodes }),
      this.queryClient.invalidateQueries({ queryKey: queryKeys.edges }),
      this.queryClient.invalidateQueries({ queryKey: queryKeys.graph }),
      this.queryClient.invalidateQueries({ queryKey: queryKeys.search })
    ];

    await Promise.all(promises);
    return promises.length;
  }

  /**
   * Invalidate queries matching SQL pattern
   */
  async invalidateLiveQueries(sqlPattern: string): Promise<number> {
    let count = 0;

    await this.queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] === 'live-query' && typeof key[1] === 'string') {
          if (key[1].includes(sqlPattern)) {
            count++;
            return true;
          }
        }
        return false;
      }
    });

    this.recordInvalidation('live-query', count, 'selective', Date.now());
    return count;
  }

  /**
   * Record invalidation for analytics
   */
  private recordInvalidation(
    operation: string,
    affectedQueries: number,
    strategy: InvalidationStrategy,
    startTime: number
  ): void {
    this.invalidationHistory.push({
      timestamp: Date.now(),
      operation,
      affectedQueries,
      strategy
    });

    // Keep only last 1000 invalidations for memory management
    if (this.invalidationHistory.length > 1000) {
      this.invalidationHistory.splice(0, this.invalidationHistory.length - 1000);
    }

    devLogger.debug('Cache invalidation executed', {
      operation,
      strategy,
      affectedQueries,
      duration: Date.now() - startTime
    });
  }

  /**
   * Get invalidation analytics
   */
  getInvalidationStats(): {
    totalInvalidations: number;
    averageAffectedQueries: number;
    strategyBreakdown: Record<InvalidationStrategy, number>;
    recentInvalidations: Array<{
      timestamp: number;
      operation: string;
      affectedQueries: number;
      strategy: InvalidationStrategy;
    }>;
  } {
    const total = this.invalidationHistory.length;
    const avgAffected = total > 0
      ? this.invalidationHistory.reduce((sum, inv) => sum + inv.affectedQueries, 0) / total
      : 0;

    const strategyBreakdown = this.invalidationHistory.reduce((acc, inv) => {
      acc[inv.strategy] = (acc[inv.strategy] || 0) + 1;
      return acc;
    }, {} as Record<InvalidationStrategy, number>);

    return {
      totalInvalidations: total,
      averageAffectedQueries: Math.round(avgAffected * 100) / 100,
      strategyBreakdown,
      recentInvalidations: this.invalidationHistory.slice(-10)
    };
  }

  /**
   * Clear invalidation history
   */
  clearHistory(): void {
    this.invalidationHistory = [];
  }
}

/**
 * Optimistic update utilities with rollback capability
 */
export class OptimisticUpdateManager {
  private queryClient: QueryClient;
  private rollbackData = new Map<string, unknown>();

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  /**
   * Optimistically update node data
   */
  updateNodeOptimistically<T>(
    nodeId: string,
    update: Partial<T>,
    rollbackKey?: string
  ): void {
    const key = queryKeys.node(nodeId);
    const rollback = rollbackKey || `node-${nodeId}-${Date.now()}`;

    // Store current data for potential rollback
    const currentData = this.queryClient.getQueryData(key);
    this.rollbackData.set(rollback, currentData);

    // Apply optimistic update
    this.queryClient.setQueryData(key, (old: T | undefined) => {
      if (!old) return old;
      return { ...old, ...update };
    });

    // Also update in nodes list if present
    this.queryClient.setQueryData(queryKeys.nodes, (old: T[] | undefined) => {
      if (!old) return old;
      return old.map((item) =>
        (item as Record<string, unknown>).id === nodeId ?
          { ...(item as Record<string, unknown>), ...update } as T : item
      );
    });
  }

  /**
   * Rollback optimistic update
   */
  rollbackOptimisticUpdate(rollbackKey: string): void {
    const originalData = this.rollbackData.get(rollbackKey);
    if (!originalData) {
      devLogger.warn('OptimisticUpdateManager: No rollback data found', {
        rollbackKey
      });
      return;
    }

    // Extract node ID from rollback key (assuming format: node-{id}-{timestamp})
    const match = rollbackKey.match(/node-([^-]+)-/);
    if (match) {
      const nodeId = match[1];
      const nodeKey = queryKeys.node(nodeId);

      // Restore original data
      this.queryClient.setQueryData(nodeKey, originalData);

      // Also restore in nodes list
      this.queryClient.setQueryData(queryKeys.nodes, (old: unknown[] | undefined) => {
        if (!old || !originalData) return old;
        return old.map((item) =>
          (item as Record<string, unknown>).id === nodeId ? originalData : item
        );
      });
    }

    // Clean up rollback data
    this.rollbackData.delete(rollbackKey);
  }

  /**
   * Clear all rollback data
   */
  clearRollbackData(): void {
    this.rollbackData.clear();
  }

  /**
   * Get rollback data for debugging
   */
  getRollbackData(): Map<string, unknown> {
    return new Map(this.rollbackData);
  }
}

/**
 * Create cache invalidation manager instance
 */
export function createCacheInvalidationManager(queryClient: QueryClient): CacheInvalidationManager {
  return new CacheInvalidationManager(queryClient);
}

/**
 * Create optimistic update manager instance
 */
export function createOptimisticUpdateManager(queryClient: QueryClient): OptimisticUpdateManager {
  return new OptimisticUpdateManager(queryClient);
}

/**
 * Common invalidation patterns for Isometry operations
 */
export const invalidationPatterns = {
  // Node operations
  nodeCreated: (nodeType?: string, folder?: string) => ({
    type: 'create' as const,
    nodeType,
    folder
  }),

  nodeUpdated: (nodeId: string, affectedFields: string[], nodeType?: string, folder?: string, tags?: string[]) => ({
    type: 'update' as const,
    nodeId,
    affectedFields,
    nodeType,
    folder,
    tags
  }),

  nodeDeleted: (nodeId: string, nodeType?: string) => ({
    type: 'delete' as const,
    nodeId,
    nodeType
  }),

  nodesBulkOperation: () => ({
    type: 'bulk' as const
  }),

  // Edge operations
  edgeCreated: (sourceId: string, targetId: string, edgeType?: string) => ({
    type: 'create' as const,
    sourceId,
    targetId,
    edgeType
  }),

  edgeDeleted: (edgeId: string, sourceId?: string, targetId?: string, edgeType?: string) => ({
    type: 'delete' as const,
    edgeId,
    sourceId,
    targetId,
    edgeType
  }),

  edgesBulkOperation: () => ({
    type: 'bulk' as const
  })
};