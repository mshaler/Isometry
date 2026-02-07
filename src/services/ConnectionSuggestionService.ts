import { ConnectionSuggestion, SuggestionType, SuggestionOptions } from './GraphAnalyticsAdapter';
import { graphAnalytics, GraphMetrics } from './GraphAnalyticsAdapter';

// Re-export interfaces for external use
export type { ConnectionSuggestion, SuggestionType, SuggestionOptions } from './GraphAnalyticsAdapter';

// Performance tracking interface
export interface SuggestionPerformanceMetrics {
  cacheHitRate: number;
  avgComputeTime: number;
  suggestionAccuracy: number; // User acceptance rate
  requestsPerSecond: number;
  memoryUsageBytes: number;
  lastUpdated: number;
}

// Cache entry with TTL support
export interface SuggestionCacheEntry {
  suggestions: ConnectionSuggestion[];
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  type: SuggestionType[];
  confidence: number;
}

// Advanced cache implementation
export class SuggestionCache {
  private cache = new Map<string, SuggestionCacheEntry>();
  private maxEntries = 1000;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private memoryPressureThreshold = 50 * 1024 * 1024; // 50MB

  // Type-specific TTL configurations
  private readonly TTL_CONFIG: Record<SuggestionType, number> = {
    'shared_tags': 10 * 60 * 1000,      // 10 min (stable)
    'temporal_proximity': 2 * 60 * 1000, // 2 min (time-sensitive)
    'similar_content': 5 * 60 * 1000,    // 5 min (moderate)
    'same_community': 8 * 60 * 1000,     // 8 min (fairly stable)
    'mutual_connections': 15 * 60 * 1000, // 15 min (very stable)
    'semantic_similarity': 7 * 60 * 1000  // 7 min (content-based)
  };

  set(key: string, suggestions: ConnectionSuggestion[], options: SuggestionOptions = {}): void {
    // Calculate appropriate TTL based on suggestion types
    const ttl = this.calculateTTL(suggestions, options);

    // Memory pressure check
    if (this.cache.size >= this.maxEntries || this.getEstimatedMemoryUsage() > this.memoryPressureThreshold) {
      this.evictLRUEntries(0.2); // Evict 20% of entries
    }

    const entry: SuggestionCacheEntry = {
      suggestions,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccessed: Date.now(),
      type: suggestions.map(s => s.type),
      confidence: this.calculateAverageConfidence(suggestions)
    };

    this.cache.set(key, entry);
  }

  get(key: string): ConnectionSuggestion[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL expiration
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    return entry.suggestions;
  }

  invalidate(pattern?: RegExp | string): number {
    let deletedCount = 0;

    if (!pattern) {
      deletedCount = this.cache.size;
      this.cache.clear();
      return deletedCount;
    }

    const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);

    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  // Invalidate entries containing specific node
  invalidateNode(nodeId: string): number {
    return this.invalidate(new RegExp(`(^|_)${nodeId}(_|$)`));
  }

  // Warm cache for frequently accessed nodes
  async warmCache(nodeIds: string[], options: SuggestionOptions = {}): Promise<void> {
    const warmupPromises = nodeIds.map(async (nodeId) => {
      const key = this.createCacheKey(nodeId, options);
      if (!this.cache.has(key)) {
        try {
          const suggestions = await graphAnalytics.suggestConnections(nodeId, options);
          this.set(key, suggestions, options);
        } catch (error) {
          console.warn(`Failed to warm cache for node ${nodeId}:`, error);
        }
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  createCacheKey(nodeId: string, options: SuggestionOptions): string {
    const types = (options.includeTypes || []).sort().join(',') || 'all';
    const maxSuggestions = options.maxSuggestions || 10;
    const minConfidence = options.minConfidence || 0.3;
    const excludeExisting = options.excludeExistingConnections !== false;

    return `${nodeId}_${types}_${maxSuggestions}_${minConfidence}_${excludeExisting}`;
  }

  getStats(): {
    entries: number;
    hitRate: number;
    memoryUsageBytes: number;
    avgAccessCount: number;
    oldestEntry: number;
  } {
    let totalAccess = 0;
    let oldestTimestamp = Date.now();

    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
      oldestTimestamp = Math.min(oldestTimestamp, entry.timestamp);
    }

    const avgAccessCount = this.cache.size > 0 ? totalAccess / this.cache.size : 0;
    const oldestEntry = Date.now() - oldestTimestamp;

    return {
      entries: this.cache.size,
      hitRate: this.calculateHitRate(),
      memoryUsageBytes: this.getEstimatedMemoryUsage(),
      avgAccessCount,
      oldestEntry
    };
  }

  private calculateTTL(suggestions: ConnectionSuggestion[], options: SuggestionOptions): number {
    if (suggestions.length === 0) return this.defaultTTL;

    // Use the most conservative (shortest) TTL from suggestion types
    const types = options.includeTypes || suggestions.map(s => s.type);
    const minTTL = Math.min(...types.map(type => this.TTL_CONFIG[type] || this.defaultTTL));

    // Adjust based on suggestion confidence
    const avgConfidence = this.calculateAverageConfidence(suggestions);
    const confidenceMultiplier = Math.max(0.5, Math.min(2.0, avgConfidence * 2));

    return minTTL * confidenceMultiplier;
  }

  private calculateAverageConfidence(suggestions: ConnectionSuggestion[]): number {
    if (suggestions.length === 0) return 0;
    const total = suggestions.reduce((sum, s) => sum + s.confidence, 0);
    return total / suggestions.length;
  }

  private evictLRUEntries(percentage: number): void {
    const entriesToEvict = Math.floor(this.cache.size * percentage);
    if (entriesToEvict === 0) return;

    // Sort by last accessed time (LRU)
    const sortedEntries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);

    for (let i = 0; i < entriesToEvict; i++) {
      const [key] = sortedEntries[i];
      this.cache.delete(key);
    }
  }

  private getEstimatedMemoryUsage(): number {
    let totalBytes = 0;

    for (const [key, entry] of this.cache) {
      // Estimate memory usage
      totalBytes += key.length * 2; // UTF-16 strings
      totalBytes += entry.suggestions.length * 200; // Estimated suggestion object size
      totalBytes += 100; // Entry metadata overhead
    }

    return totalBytes;
  }

  private hitCount = 0;
  private missCount = 0;

  private calculateHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? this.hitCount / total : 0;
  }

  recordHit(): void {
    this.hitCount++;
  }

  recordMiss(): void {
    this.missCount++;
  }
}

/**
 * High-level connection suggestion management service with intelligent caching,
 * performance optimization, and batch processing capabilities.
 */
export class ConnectionSuggestionService {
  private static instance: ConnectionSuggestionService | null = null;
  private cache: SuggestionCache;
  private metrics: SuggestionPerformanceMetrics;
  private pendingRequests = new Map<string, Promise<ConnectionSuggestion[]>>();
  private performanceHistory: number[] = [];
  private acceptanceTracking = new Map<string, { shown: number; accepted: number }>();

  // Observer pattern for real-time updates
  private observers = new Set<(suggestions: ConnectionSuggestion[], nodeId: string) => void>();

  private constructor() {
    this.cache = new SuggestionCache();
    this.metrics = {
      cacheHitRate: 0,
      avgComputeTime: 0,
      suggestionAccuracy: 0,
      requestsPerSecond: 0,
      memoryUsageBytes: 0,
      lastUpdated: Date.now()
    };

    // Setup periodic metrics update
    this.startMetricsCollection();

    // Setup graph change listener for cache invalidation
    this.setupGraphChangeListener();
  }

  static getInstance(): ConnectionSuggestionService {
    if (!ConnectionSuggestionService.instance) {
      ConnectionSuggestionService.instance = new ConnectionSuggestionService();
    }
    return ConnectionSuggestionService.instance;
  }

  /**
   * Get connection suggestions with intelligent caching and optimization
   */
  async suggestConnections(
    nodeId: string,
    options: SuggestionOptions = {}
  ): Promise<ConnectionSuggestion[]> {
    const startTime = performance.now();
    const cacheKey = this.cache.createCacheKey(nodeId, options);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.cache.recordHit();
      this.recordPerformance(performance.now() - startTime);
      this.notifyObservers(cached, nodeId);
      return this.applyConfidenceFiltering(cached, options);
    }

    this.cache.recordMiss();

    // Check for pending request to avoid duplicate computation
    const existingRequest = this.pendingRequests.get(cacheKey);
    if (existingRequest) {
      const result = await existingRequest;
      this.recordPerformance(performance.now() - startTime);
      return this.applyConfidenceFiltering(result, options);
    }

    // Create new request
    const requestPromise = this.fetchSuggestions(nodeId, options);
    this.pendingRequests.set(cacheKey, requestPromise);

    try {
      const suggestions = await requestPromise;

      // Cache the results
      this.cache.set(cacheKey, suggestions, options);

      // Track acceptance for accuracy metrics
      this.trackSuggestionShown(nodeId, suggestions);

      this.recordPerformance(performance.now() - startTime);
      this.notifyObservers(suggestions, nodeId);

      return this.applyConfidenceFiltering(suggestions, options);

    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * Batch optimize multiple node suggestions with request deduplication
   */
  async batchOptimization(
    nodeIds: string[],
    options: SuggestionOptions = {}
  ): Promise<Record<string, ConnectionSuggestion[]>> {
    if (nodeIds.length === 0) return {};

    // Group by cache key to deduplicate identical requests
    const keyGroups = new Map<string, string[]>();
    const results: Record<string, ConnectionSuggestion[]> = {};

    for (const nodeId of nodeIds) {
      const cacheKey = this.cache.createCacheKey(nodeId, options);

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.cache.recordHit();
        results[nodeId] = this.applyConfidenceFiltering(cached, options);
        continue;
      }

      // Group uncached requests
      if (!keyGroups.has(cacheKey)) {
        keyGroups.set(cacheKey, []);
      }
      keyGroups.get(cacheKey)!.push(nodeId);
    }

    // Batch request uncached suggestions
    if (keyGroups.size > 0) {
      const uncachedNodeIds = Array.from(keyGroups.values()).flat();

      try {
        const batchResults = await graphAnalytics.batchSuggestConnections(uncachedNodeIds, options);

        // Cache and organize results
        for (const [nodeId, suggestions] of Object.entries(batchResults)) {
          const cacheKey = this.cache.createCacheKey(nodeId, options);
          this.cache.set(cacheKey, suggestions, options);
          this.trackSuggestionShown(nodeId, suggestions);
          results[nodeId] = this.applyConfidenceFiltering(suggestions, options);
        }

      } catch (error) {
        console.warn('Batch suggestion request failed, falling back to individual requests:', error);

        // Fallback to individual requests
        for (const nodeId of uncachedNodeIds) {
          try {
            results[nodeId] = await this.suggestConnections(nodeId, options);
          } catch (nodeError) {
            console.warn(`Failed to get suggestions for node ${nodeId}:`, nodeError);
            results[nodeId] = [];
          }
        }
      }
    }

    return results;
  }

  /**
   * Progressive loading: high-confidence suggestions first
   */
  async progressiveLoad(
    nodeId: string,
    options: SuggestionOptions = {}
  ): Promise<{
    highConfidence: ConnectionSuggestion[];
    loadRemaining: () => Promise<ConnectionSuggestion[]>;
  }> {
    // First, get high-confidence suggestions
    const highConfidenceOptions = {
      ...options,
      minConfidence: Math.max(options.minConfidence || 0.3, 0.7),
      maxSuggestions: Math.min(options.maxSuggestions || 10, 5)
    };

    const highConfidence = await this.suggestConnections(nodeId, highConfidenceOptions);

    // Return high confidence immediately with lazy loader for the rest
    return {
      highConfidence,
      loadRemaining: async () => {
        const allSuggestions = await this.suggestConnections(nodeId, options);
        // Return suggestions not already in high confidence
        const highConfidenceIds = new Set(highConfidence.map(s => s.id));
        return allSuggestions.filter(s => !highConfidenceIds.has(s.id));
      }
    };
  }

  /**
   * Track suggestion acceptance for accuracy measurement
   */
  trackSuggestionAccepted(nodeId: string, _suggestionId: string): void {
    const tracking = this.acceptanceTracking.get(nodeId);
    if (tracking) {
      tracking.accepted++;
      this.updateAccuracyMetrics();
    }
  }

  /**
   * Subscribe to real-time suggestion updates
   */
  subscribe(observer: (suggestions: ConnectionSuggestion[], nodeId: string) => void): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /**
   * Invalidate cache when graph structure changes
   */
  onGraphChange(changeType: 'node-added' | 'node-removed' | 'edge-added' | 'edge-removed', nodeId: string): void {
    switch (changeType) {
      case 'edge-added':
      case 'edge-removed':
        // Edge changes affect suggestions for connected nodes
        this.cache.invalidateNode(nodeId);
        break;
      case 'node-added':
        // New nodes might affect community and similarity calculations
        this.cache.invalidate(/^(shared_tags|same_community|semantic_similarity)_/);
        break;
      case 'node-removed':
        // Remove all suggestions for deleted node
        this.cache.invalidateNode(nodeId);
        this.acceptanceTracking.delete(nodeId);
        break;
    }
  }

  /**
   * Pre-compute suggestions for recently viewed nodes
   */
  async precomputeForNodes(nodeIds: string[], options: SuggestionOptions = {}): Promise<void> {
    // Background suggestion pre-computation
    const precomputePromises = nodeIds.map(async (nodeId) => {
      try {
        await this.suggestConnections(nodeId, options);
      } catch (error) {
        console.debug(`Precomputation failed for node ${nodeId}:`, error);
      }
    });

    await Promise.allSettled(precomputePromises);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): SuggestionPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    memoryUsage: number;
    oldestEntry: number;
  } {
    const stats = this.cache.getStats();
    return {
      size: stats.entries,
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsageBytes,
      oldestEntry: stats.oldestEntry
    };
  }

  // MARK: - Private Methods

  private async fetchSuggestions(nodeId: string, options: SuggestionOptions): Promise<ConnectionSuggestion[]> {
    try {
      return await graphAnalytics.suggestConnections(nodeId, options);
    } catch (error) {
      console.warn(`Failed to fetch suggestions for node ${nodeId}:`, error);
      return [];
    }
  }

  private applyConfidenceFiltering(
    suggestions: ConnectionSuggestion[],
    options: SuggestionOptions
  ): ConnectionSuggestion[] {
    const minConfidence = options.minConfidence || 0.3;
    const maxSuggestions = options.maxSuggestions || 10;

    return suggestions
      .filter(s => s.confidence >= minConfidence)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxSuggestions);
  }

  private trackSuggestionShown(nodeId: string, suggestions: ConnectionSuggestion[]): void {
    if (!this.acceptanceTracking.has(nodeId)) {
      this.acceptanceTracking.set(nodeId, { shown: 0, accepted: 0 });
    }

    const tracking = this.acceptanceTracking.get(nodeId)!;
    tracking.shown += suggestions.length;
  }

  private updateAccuracyMetrics(): void {
    let totalShown = 0;
    let totalAccepted = 0;

    for (const tracking of this.acceptanceTracking.values()) {
      totalShown += tracking.shown;
      totalAccepted += tracking.accepted;
    }

    this.metrics.suggestionAccuracy = totalShown > 0 ? totalAccepted / totalShown : 0;
    this.metrics.lastUpdated = Date.now();
  }

  private recordPerformance(duration: number): void {
    this.performanceHistory.push(duration);

    // Keep only recent history (last 100 requests)
    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    // Update metrics
    this.metrics.avgComputeTime = this.performanceHistory.reduce((sum, time) => sum + time, 0)
      / this.performanceHistory.length;
    this.metrics.lastUpdated = Date.now();
  }

  private notifyObservers(suggestions: ConnectionSuggestion[], nodeId: string): void {
    for (const observer of this.observers) {
      try {
        observer(suggestions, nodeId);
      } catch (error) {
        console.warn('Observer notification failed:', error);
      }
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      const cacheStats = this.cache.getStats();
      this.metrics.cacheHitRate = cacheStats.hitRate;
      this.metrics.memoryUsageBytes = cacheStats.memoryUsageBytes;

      // Calculate requests per second
      const now = Date.now();
      const timeWindow = 60000; // 1 minute
      const recentRequests = this.performanceHistory.filter(
        (_, index, array) => (array.length - index) <= 60 // Last 60 requests as proxy
      ).length;

      this.metrics.requestsPerSecond = recentRequests / (timeWindow / 1000);
      this.metrics.lastUpdated = now;
    }, 10000); // Update every 10 seconds
  }

  private setupGraphChangeListener(): void {
    // In a real implementation, this would listen to graph mutation events
    // For now, we'll set up automatic cache warming based on graph metrics
    setInterval(async () => {
      try {
        const metrics: GraphMetrics = await graphAnalytics.getGraphMetrics();

        // If graph has grown significantly, warm cache for high-degree nodes
        if (metrics.totalNodes > 1000) {
          // Implement cache warming for popular nodes
          console.debug('Graph size grown, considering cache warming');
        }
      } catch (error) {
        console.debug('Failed to check graph metrics for cache warming:', error);
      }
    }, 60000); // Check every minute
  }
}

// Export singleton instance
export const connectionSuggestionService = ConnectionSuggestionService.getInstance();