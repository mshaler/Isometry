import { graphAnalytics } from '../analytics/GraphAnalyticsAdapter';
import { devLogger } from '@/utils/logging/dev-logger';

// Cache entry interface with comprehensive metadata
export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  version: number;
  accessCount: number;
  lastAccessed: number;
  size: number; // Estimated size in bytes
  namespace: string;
  tags: string[];
  isValid: boolean;
  timeToExpiry: number;
  computeTime?: number;
  hitCount: number;
}

// Cache strategy configurations
export enum CacheStrategy {
  AGGRESSIVE = 'aggressive',
  BALANCED = 'balanced',
  CONSERVATIVE = 'conservative'
}

interface CacheStrategyConfig {
  defaultTTL: number;
  maxMemoryMB: number;
  evictionThreshold: number;
  prefetchEnabled: boolean;
  compressionEnabled: boolean;
}

// Cache statistics interface
export interface CacheEffectiveness {
  hitRate: number;
  missRate: number;
  averageResponseTime: number;
  memoryUsageMB: number;
  totalRequests: number;
  totalHits: number;
  totalMisses: number;
  keyspaceUtilization: number;
}

/**
 * React interface to native QueryCache with intelligent invalidation,
 * React Suspense integration, and comprehensive cache management
 */
export class QueryCacheService {
  private static instance: QueryCacheService | null = null;
  private cache = new Map<string, CacheEntry>();
  private strategy: CacheStrategy = CacheStrategy.BALANCED;
  private operationQueue = new Map<string, Promise<unknown>>();
  private suspensePromises = new Map<string, Promise<unknown>>();

  // Performance tracking
  private stats = {
    hits: 0,
    misses: 0,
    requests: 0,
    totalResponseTime: 0,
    lastUpdate: Date.now()
  };

  // Strategy configurations
  private readonly STRATEGY_CONFIG: Record<CacheStrategy, CacheStrategyConfig> = {
    [CacheStrategy.AGGRESSIVE]: {
      defaultTTL: 15 * 60 * 1000,  // 15 minutes
      maxMemoryMB: 100,
      evictionThreshold: 0.1,      // Evict when 90% full
      prefetchEnabled: true,
      compressionEnabled: false
    },
    [CacheStrategy.BALANCED]: {
      defaultTTL: 5 * 60 * 1000,   // 5 minutes
      maxMemoryMB: 50,
      evictionThreshold: 0.2,      // Evict when 80% full
      prefetchEnabled: true,
      compressionEnabled: true
    },
    [CacheStrategy.CONSERVATIVE]: {
      defaultTTL: 2 * 60 * 1000,   // 2 minutes
      maxMemoryMB: 25,
      evictionThreshold: 0.3,      // Evict when 70% full
      prefetchEnabled: false,
      compressionEnabled: true
    }
  };

  // Cache namespaces for hierarchical invalidation
  private readonly NAMESPACES = {
    connections: 'connections',
    metrics: 'metrics',
    queries: 'queries',
    suggestions: 'suggestions',
    analytics: 'analytics'
  } as const;

  private constructor() {
    this.startMaintenanceLoop();
    this.setupSuspenseSupport();
  }

  static getInstance(): QueryCacheService {
    if (!QueryCacheService.instance) {
      QueryCacheService.instance = new QueryCacheService();
    }
    return QueryCacheService.instance;
  }

  /**
   * Configure cache strategy
   */
  setStrategy(strategy: CacheStrategy): void {
    this.strategy = strategy;
    this.adjustCacheToStrategy();
  }

  /**
   * Get cached value with type safety
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.requests++;
    const now = Date.now();

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check validity
    if (!this.isValidEntry(entry, now)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    entry.hitCount++;
    entry.timeToExpiry = Math.max(0, (entry.timestamp + entry.ttl) - now);

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set cache value with TTL and metadata
   */
  async set<T>(key: string, value: T, ttl?: number, options: {
    namespace?: string;
    tags?: string[];
    computeTime?: number;
  } = {}): Promise<void> {
    const now = Date.now();
    const config = this.getConfig();
    const actualTTL = ttl || config.defaultTTL;

    // Memory pressure check
    await this.ensureMemoryAvailable();

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: now,
      ttl: actualTTL,
      key,
      version: 1,
      accessCount: 1,
      lastAccessed: now,
      size: this.estimateSize(value),
      namespace: options.namespace || this.NAMESPACES.queries,
      tags: options.tags || [],
      isValid: true,
      timeToExpiry: actualTTL,
      computeTime: options.computeTime,
      hitCount: 0
    };

    this.cache.set(key, entry);
  }

  /**
   * Get or compute with React Suspense support
   */
  async getOrCompute<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number,
    options: {
      namespace?: string;
      tags?: string[];
      suspense?: boolean;
    } = {}
  ): Promise<T> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check for in-flight operation to prevent duplicate work
    const existingOperation = this.operationQueue.get(key);
    if (existingOperation) {
      return existingOperation as Promise<T>;
    }

    // Create new operation
    const startTime = performance.now();
    const operation = (async (): Promise<T> => {
      try {
        // Support React Suspense pattern
        if (options.suspense) {
          const suspensePromise = this.suspensePromises.get(key);
          if (suspensePromise) {
            throw suspensePromise;
          }
        }

        const result = await computeFn();
        const computeTime = performance.now() - startTime;

        // Cache the result
        await this.set(key, result, ttl, {
          namespace: options.namespace,
          tags: options.tags,
          computeTime
        });

        // Update response time stats
        this.stats.totalResponseTime += computeTime;

        return result;

      } catch (error) {
        if (options.suspense && error instanceof Promise) {
          this.suspensePromises.set(key, error);
          error.finally(() => {
            this.suspensePromises.delete(key);
          });
        }
        throw error;
      } finally {
        this.operationQueue.delete(key);
      }
    })();

    this.operationQueue.set(key, operation);
    return operation;
  }

  /**
   * Invalidate cache entries with pattern support
   */
  async invalidate(pattern: string | RegExp): Promise<number> {
    let deletedCount = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const [key] of this.cache) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    // Also invalidate native cache
    try {
      await this.invalidateNativeCache(pattern);
    } catch (error) {
      console.warn('Failed to invalidate native cache:', error);
    }

    return deletedCount;
  }

  /**
   * Namespace-aware invalidation
   */
  async invalidateNamespace(namespace: string): Promise<number> {
    return this.invalidate(new RegExp(`^${namespace}:`));
  }

  /**
   * Tag-based invalidation
   */
  async invalidateByTag(tag: string): Promise<number> {
    let deletedCount = 0;

    for (const [key, entry] of this.cache) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * Hierarchical invalidation for node-level changes
   */
  async invalidateNodeRelated(nodeId: string): Promise<number> {
    const patterns = [
      new RegExp(`connections:.*${nodeId}`),
      new RegExp(`suggestions:.*${nodeId}`),
      new RegExp(`analytics:.*${nodeId}`)
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      totalDeleted += await this.invalidate(pattern);
    }

    return totalDeleted;
  }

  /**
   * Cache warming for frequently accessed queries
   */
  async warmCache<T>(
    keys: string[],
    computeFn: (key: string) => Promise<T>,
    options: {
      ttl?: number;
      namespace?: string;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const warmupPromises = keys.map(async (key) => {
      const existing = await this.get(key);
      if (!existing) {
        try {
          const result = await computeFn(key);
          await this.set(key, result, options.ttl, {
            namespace: options.namespace,
            tags: options.tags
          });
        } catch (error) {
          console.warn(`Cache warming failed for key ${key}:`, error);
        }
      }
    });

    await Promise.allSettled(warmupPromises);
  }

  /**
   * Query deduplication for React components
   */
  async deduplicatedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: {
      ttl?: number;
      suspense?: boolean;
    } = {}
  ): Promise<T> {
    return this.getOrCompute(key, queryFn, options.ttl, {
      namespace: this.NAMESPACES.queries,
      suspense: options.suspense
    });
  }

  /**
   * Cache versioning for schema changes
   */
  bumpVersion(keyPattern: string | RegExp): number {
    let updatedCount = 0;
    const regex = typeof keyPattern === 'string' ? new RegExp(keyPattern) : keyPattern;

    for (const [key, entry] of this.cache) {
      if (regex.test(key)) {
        entry.version++;
        entry.isValid = false; // Mark for recomputation
        updatedCount++;
      }
    }

    return updatedCount;
  }

  /**
   * Get comprehensive cache effectiveness metrics
   */
  getCacheEffectiveness(): CacheEffectiveness {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const missRate = 1 - hitRate;
    const avgResponseTime = this.stats.requests > 0 ? this.stats.totalResponseTime / this.stats.requests : 0;

    return {
      hitRate,
      missRate,
      averageResponseTime: avgResponseTime,
      memoryUsageMB: this.getMemoryUsageMB(),
      totalRequests: this.stats.requests,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      keyspaceUtilization: this.cache.size / 10000 // Assuming 10k max keys
    };
  }

  /**
   * Memory usage tracking and cleanup recommendations
   */
  getMemoryAnalysis(): {
    currentUsageMB: number;
    maxAllowedMB: number;
    recommendedCleanup: boolean;
    largestEntries: Array<{ key: string; sizeMB: number; namespace: string }>;
    oldestEntries: Array<{ key: string; age: number; namespace: string }>;
  } {
    const currentUsage = this.getMemoryUsageMB();
    const config = this.getConfig();
    const recommendedCleanup = currentUsage > config.maxMemoryMB * 0.8;

    // Find largest entries
    const entries = Array.from(this.cache.entries());
    const largestEntries = entries
      .sort(([, a], [, b]) => b.size - a.size)
      .slice(0, 5)
      .map(([key, entry]) => ({
        key,
        sizeMB: entry.size / (1024 * 1024),
        namespace: entry.namespace
      }));

    // Find oldest entries
    const now = Date.now();
    const oldestEntries = entries
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, 5)
      .map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        namespace: entry.namespace
      }));

    return {
      currentUsageMB: currentUsage,
      maxAllowedMB: config.maxMemoryMB,
      recommendedCleanup,
      largestEntries,
      oldestEntries
    };
  }

  /**
   * Query execution time analysis with optimization suggestions
   */
  getQueryAnalysis(): {
    slowQueries: Array<{ key: string; avgTime: number; namespace: string }>;
    frequentQueries: Array<{ key: string; hitCount: number; namespace: string }>;
    optimizationSuggestions: string[];
  } {
    const entries = Array.from(this.cache.entries());

    const slowQueries = entries
      .filter(([, entry]) => entry.computeTime && entry.computeTime > 100) // > 100ms
      .sort(([, a], [, b]) => (b.computeTime || 0) - (a.computeTime || 0))
      .slice(0, 5)
      .map(([key, entry]) => ({
        key,
        avgTime: entry.computeTime || 0,
        namespace: entry.namespace
      }));

    const frequentQueries = entries
      .sort(([, a], [, b]) => b.hitCount - a.hitCount)
      .slice(0, 10)
      .map(([key, entry]) => ({
        key,
        hitCount: entry.hitCount,
        namespace: entry.namespace
      }));

    const optimizationSuggestions: string[] = [];

    if (slowQueries.length > 0) {
      optimizationSuggestions.push('Consider precomputing slow queries during idle time');
    }

    const effectiveness = this.getCacheEffectiveness();
    if (effectiveness.hitRate < 0.7) {
      optimizationSuggestions.push('Increase TTL for frequently accessed data');
    }

    if (effectiveness.memoryUsageMB > this.getConfig().maxMemoryMB * 0.9) {
      optimizationSuggestions.push('Enable compression or reduce cache size');
    }

    return {
      slowQueries,
      frequentQueries,
      optimizationSuggestions
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.operationQueue.clear();
    this.suspensePromises.clear();
    this.resetStats();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entries: number;
    memoryUsageMB: number;
    hitRate: number;
    averageResponseTime: number;
    operationsInFlight: number;
  } {
    const effectiveness = this.getCacheEffectiveness();

    return {
      entries: this.cache.size,
      memoryUsageMB: effectiveness.memoryUsageMB,
      hitRate: effectiveness.hitRate,
      averageResponseTime: effectiveness.averageResponseTime,
      operationsInFlight: this.operationQueue.size
    };
  }

  // MARK: - Private Methods

  private getConfig(): CacheStrategyConfig {
    return this.STRATEGY_CONFIG[this.strategy];
  }

  private isValidEntry(entry: CacheEntry, now: number = Date.now()): boolean {
    return entry.isValid &&
           (entry.timestamp + entry.ttl) > now &&
           entry.version >= 1;
  }

  private estimateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2; // Rough estimate (UTF-16)
    } catch {
      return 1024; // Fallback estimate
    }
  }

  private getMemoryUsageMB(): number {
    let totalBytes = 0;

    for (const [key, entry] of this.cache) {
      totalBytes += key.length * 2; // UTF-16
      totalBytes += entry.size;
      totalBytes += 200; // Entry metadata overhead
    }

    return totalBytes / (1024 * 1024);
  }

  private async ensureMemoryAvailable(): Promise<void> {
    const config = this.getConfig();
    const currentUsage = this.getMemoryUsageMB();

    if (currentUsage > config.maxMemoryMB * (1 - config.evictionThreshold)) {
      await this.evictLRUEntries(config.evictionThreshold);
    }
  }

  private async evictLRUEntries(percentage: number): Promise<number> {
    const entriesToEvict = Math.floor(this.cache.size * percentage);
    if (entriesToEvict === 0) return 0;

    const entries = Array.from(this.cache.entries());

    // Sort by access time and hit count (LRU with popularity consideration)
    entries.sort(([, a], [, b]) => {
      const scoreA = a.lastAccessed + (a.hitCount * 10000); // Weight hits heavily
      const scoreB = b.lastAccessed + (b.hitCount * 10000);
      return scoreA - scoreB;
    });

    let evictedCount = 0;
    for (let i = 0; i < entriesToEvict && i < entries.length; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      evictedCount++;
    }

    return evictedCount;
  }

  private adjustCacheToStrategy(): void {
    const config = this.getConfig();
    const currentUsage = this.getMemoryUsageMB();

    if (currentUsage > config.maxMemoryMB) {
      this.evictLRUEntries(0.3); // Evict 30% to get under limit
    }
  }

  private async invalidateNativeCache(pattern: string | RegExp): Promise<void> {
    try {
      // Convert pattern to string for native bridge
      const patternStr = pattern instanceof RegExp ? pattern.source : pattern;
      await graphAnalytics.runGraphQuery('invalidateCache', { pattern: patternStr });
    } catch (error) {
      devLogger.debug('Native cache invalidation failed (non-critical):', { error });
    }
  }

  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      requests: 0,
      totalResponseTime: 0,
      lastUpdate: Date.now()
    };
  }

  private setupSuspenseSupport(): void {
    // Setup global error boundary recovery for Suspense failures
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        // Clean up failed suspense promises
        for (const [key, promise] of this.suspensePromises) {
          if (promise === event.promise) {
            this.suspensePromises.delete(key);
          }
        }
      });
    }
  }

  private startMaintenanceLoop(): void {
    setInterval(() => {
      const now = Date.now();

      // Clean up expired entries
      for (const [key, entry] of this.cache) {
        if (!this.isValidEntry(entry, now)) {
          this.cache.delete(key);
        }
      }

      // Clean up stale operation promises
      const staleThreshold = 5 * 60 * 1000; // 5 minutes
      for (const [key] of this.operationQueue) {
        // This is a simplified check - in practice you'd track operation start times
        const lastActivity = now - staleThreshold;
        if (lastActivity < 0) {
          this.operationQueue.delete(key);
        }
      }

    }, 60000); // Every minute
  }
}

// Export singleton instance
export const queryCacheService = QueryCacheService.getInstance();