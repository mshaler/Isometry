import { BridgeMessage, BridgeResponse } from '../types/browser-bridge';

// Type definitions matching native Swift ConnectionSuggestion
export interface ConnectionSuggestion {
  id: string;
  nodeId: string;
  reason: string;
  confidence: number;
  type: SuggestionType;
}

export type SuggestionType =
  | 'similar_content'
  | 'same_community'
  | 'shared_tags'
  | 'mutual_connections'
  | 'temporal_proximity'
  | 'semantic_similarity';

export interface SuggestionOptions {
  maxSuggestions?: number;
  minConfidence?: number;
  includeTypes?: SuggestionType[];
  excludeExistingConnections?: boolean;
}

export interface GraphMetrics {
  totalNodes: number;
  totalEdges: number;
  averageTagsPerNode: number;
  graphDensity: number;
}

export interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  hitRate: number;
  estimatedMemoryMB: number;
}

export interface QueryResult {
  queryType: string;
  result: any;
  computeTime: number;
  cached: boolean;
}

// Import type for module augmentation (used in declare module below)
// import type { WebKitMessageHandlers } from '../utils/webview-bridge';

// Bridge communication interface
interface GraphBridge {
  postMessage(message: any): void;
}

// Module augmentation to extend the existing WebKit interface
declare module '../utils/webview-bridge' {
  interface WebKitMessageHandlers {
    graphAnalytics: GraphBridge;
  }
}

declare global {
  interface Window {
    _isometryGraphBridge?: {
      handleResponse: (response: BridgeResponse) => void;
    };
  }
}

/**
 * React service adapter for native graph analytics integration
 * Provides connection suggestions, graph metrics, and query execution via WebView bridge
 */
export class GraphAnalyticsAdapter {
  private static instance: GraphAnalyticsAdapter | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  // Local caching with TTL
  private suggestionCache = new Map<string, {
    suggestions: ConnectionSuggestion[];
    timestamp: number;
    ttl: number;
  }>();

  private metricsCache: {
    metrics: GraphMetrics | null;
    timestamp: number;
    ttl: number;
  } = { metrics: null, timestamp: 0, ttl: 5 * 60 * 1000 }; // 5 minutes

  private readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly REQUEST_THROTTLE_MS = 100; // 100ms throttling

  private throttleMap = new Map<string, number>();

  private constructor() {
    this.setupBridgeHandler();
  }

  public static getInstance(): GraphAnalyticsAdapter {
    if (!GraphAnalyticsAdapter.instance) {
      GraphAnalyticsAdapter.instance = new GraphAnalyticsAdapter();
    }
    return GraphAnalyticsAdapter.instance;
  }

  /**
   * Setup bridge response handler
   */
  private setupBridgeHandler(): void {
    if (typeof window !== 'undefined') {
      window._isometryGraphBridge = {
        handleResponse: (response: BridgeResponse) => {
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);

            if (response.success) {
              pending.resolve(response.result);
            } else {
              const errorMessage = typeof response.error === 'string'
                ? response.error
                : response.error?.message || 'Unknown bridge error';
              pending.reject(new Error(errorMessage));
            }
          }
        }
      };
    }
  }

  /**
   * Check if native bridge is available
   */
  private isBridgeAvailable(): boolean {
    return typeof window !== 'undefined' &&
           window.webkit?.messageHandlers?.graphAnalytics != null;
  }

  /**
   * Send message to native bridge with promise-based response handling
   */
  private async sendBridgeMessage<T>(method: string, params: any = {}): Promise<T> {
    if (!this.isBridgeAvailable()) {
      throw new Error('Graph analytics bridge not available');
    }

    // Request throttling
    const throttleKey = `${method}_${JSON.stringify(params)}`;
    const now = Date.now();
    const lastRequest = this.throttleMap.get(throttleKey);

    if (lastRequest && (now - lastRequest) < this.REQUEST_THROTTLE_MS) {
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_THROTTLE_MS));
    }
    this.throttleMap.set(throttleKey, now);

    const requestId = `graph_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return new Promise<T>((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Graph analytics request timeout: ${method}`));
      }, this.DEFAULT_TIMEOUT);

      // Store pending request
      this.pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send message
      const message: BridgeMessage = {
        id: requestId,
        method,
        params: {
          ...params,
          sequenceId: Date.now()
        },
        timestamp: Date.now()
      };

      try {
        window.webkit!.messageHandlers.graphAnalytics.postMessage(message);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send bridge message: ${error}`));
      }
    });
  }

  /**
   * Get connection suggestions for a specific node
   */
  async suggestConnections(
    nodeId: string,
    options: SuggestionOptions = {}
  ): Promise<ConnectionSuggestion[]> {
    // Check local cache first
    const cacheKey = this.createSuggestionCacheKey(nodeId, options);
    const cached = this.suggestionCache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < cached.ttl) {
      return cached.suggestions;
    }

    try {
      // Request from native bridge
      const response = await this.sendBridgeMessage<{
        suggestions: ConnectionSuggestion[];
        cached: boolean;
        computeTime: number;
      }>('suggestConnections', {
        nodeId,
        options: this.normalizeOptions(options)
      });

      // Cache the results
      if (response.suggestions) {
        this.suggestionCache.set(cacheKey, {
          suggestions: response.suggestions,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        });
      }

      return response.suggestions || [];

    } catch (error) {
      console.warn('Failed to get connection suggestions from native bridge, using fallback:', error);
      return this.fallbackConnectionSuggestions(nodeId, options);
    }
  }

  /**
   * Get batch connection suggestions for multiple nodes
   */
  async batchSuggestConnections(
    nodeIds: string[],
    options: SuggestionOptions = {}
  ): Promise<Record<string, ConnectionSuggestion[]>> {
    if (nodeIds.length === 0) {
      return {};
    }

    try {
      const response = await this.sendBridgeMessage<{
        batchResults: Record<string, ConnectionSuggestion[]>;
        nodeCount: number;
        computeTime: number;
      }>('batchSuggestConnections', {
        nodeIds,
        options: this.normalizeOptions(options)
      });

      // Cache individual results
      const normalizedOptions = this.normalizeOptions(options);
      Object.entries(response.batchResults || {}).forEach(([nodeId, suggestions]) => {
        const cacheKey = this.createSuggestionCacheKey(nodeId, normalizedOptions);
        this.suggestionCache.set(cacheKey, {
          suggestions,
          timestamp: Date.now(),
          ttl: this.CACHE_TTL
        });
      });

      return response.batchResults || {};

    } catch (error) {
      console.warn('Failed to get batch suggestions from native bridge, using fallback:', error);

      // Fallback to individual requests
      const results: Record<string, ConnectionSuggestion[]> = {};
      for (const nodeId of nodeIds) {
        try {
          results[nodeId] = await this.suggestConnections(nodeId, options);
        } catch (nodeError) {
          console.warn(`Failed to get suggestions for node ${nodeId}:`, nodeError);
          results[nodeId] = [];
        }
      }
      return results;
    }
  }

  /**
   * Get graph-wide metrics
   */
  async getGraphMetrics(): Promise<GraphMetrics> {
    // Check cache first
    if (this.metricsCache.metrics &&
        (Date.now() - this.metricsCache.timestamp) < this.metricsCache.ttl) {
      return this.metricsCache.metrics;
    }

    try {
      const metrics = await this.sendBridgeMessage<GraphMetrics>('getGraphMetrics');

      // Cache metrics
      this.metricsCache = {
        metrics,
        timestamp: Date.now(),
        ttl: this.metricsCache.ttl
      };

      return metrics;

    } catch (error) {
      console.warn('Failed to get graph metrics from native bridge, using fallback:', error);
      return this.fallbackGraphMetrics();
    }
  }

  /**
   * Get query cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      return await this.sendBridgeMessage<CacheStats>('getCacheStats');
    } catch (error) {
      console.warn('Failed to get cache stats from native bridge:', error);
      return {
        totalEntries: 0,
        validEntries: 0,
        expiredEntries: 0,
        hitRate: 0,
        estimatedMemoryMB: 0
      };
    }
  }

  /**
   * Run a graph query with caching
   */
  async runGraphQuery(queryType: string, parameters: Record<string, any> = {}): Promise<QueryResult> {
    try {
      return await this.sendBridgeMessage<QueryResult>('runGraphQuery', {
        queryType,
        parameters
      });
    } catch (error) {
      console.warn(`Failed to run graph query ${queryType} from native bridge:`, error);
      throw error; // Re-throw for graph queries as fallbacks are query-specific
    }
  }

  /**
   * Clear local caches
   */
  clearCache(): void {
    this.suggestionCache.clear();
    this.metricsCache = { metrics: null, timestamp: 0, ttl: this.metricsCache.ttl };
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    pendingRequests: number;
    cacheSize: number;
    throttleMapSize: number;
  } {
    return {
      pendingRequests: this.pendingRequests.size,
      cacheSize: this.suggestionCache.size,
      throttleMapSize: this.throttleMap.size
    };
  }

  // MARK: - Private Helper Methods

  private normalizeOptions(options: SuggestionOptions): SuggestionOptions {
    return {
      maxSuggestions: Math.max(1, Math.min(options.maxSuggestions || 10, 50)),
      minConfidence: Math.max(0, Math.min(options.minConfidence || 0.3, 1)),
      includeTypes: options.includeTypes || [
        'similar_content',
        'same_community',
        'shared_tags',
        'mutual_connections',
        'temporal_proximity',
        'semantic_similarity'
      ],
      excludeExistingConnections: options.excludeExistingConnections !== false
    };
  }

  private createSuggestionCacheKey(nodeId: string, options: SuggestionOptions): string {
    const normalized = this.normalizeOptions(options);
    const typesStr = normalized.includeTypes!.sort().join(',');
    return `${nodeId}_${normalized.maxSuggestions}_${normalized.minConfidence}_${typesStr}_${normalized.excludeExistingConnections}`;
  }

  private fallbackConnectionSuggestions(
    _nodeId: string,
    _options: SuggestionOptions
  ): ConnectionSuggestion[] {
    // Basic fallback implementation using local graph analysis
    // This would implement simple heuristics when native bridge is unavailable
    console.info('Using fallback connection suggestion algorithm');

    return [
      {
        id: `fallback_${Date.now()}`,
        nodeId: 'fallback_node',
        reason: 'Fallback suggestion (native bridge unavailable)',
        confidence: 0.1,
        type: 'similar_content'
      }
    ];
  }

  private fallbackGraphMetrics(): GraphMetrics {
    // Basic fallback metrics when native bridge is unavailable
    return {
      totalNodes: 0,
      totalEdges: 0,
      averageTagsPerNode: 0,
      graphDensity: 0
    };
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();

    // Clean suggestion cache
    for (const [key, cached] of this.suggestionCache.entries()) {
      if ((now - cached.timestamp) >= cached.ttl) {
        this.suggestionCache.delete(key);
      }
    }

    // Clean throttle map (keep entries for 1 minute)
    for (const [key, timestamp] of this.throttleMap.entries()) {
      if ((now - timestamp) >= 60000) {
        this.throttleMap.delete(key);
      }
    }
  }

  /**
   * Periodic maintenance
   */
  public startPeriodicCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 60000); // Every minute
  }
}

// Export singleton instance for convenience
export const graphAnalytics = GraphAnalyticsAdapter.getInstance();

// Auto-start cleanup when module loads
if (typeof window !== 'undefined') {
  graphAnalytics.startPeriodicCleanup();
}