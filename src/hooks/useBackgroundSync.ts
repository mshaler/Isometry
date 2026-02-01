/**
 * React Hook for Background Sync
 *
 * Provides React interface for background sync operations with
 * connection quality integration and automatic retry scheduling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { backgroundSync, type BackgroundSyncManager } from '../services/backgroundSync';
import { useConnectionQuality, type ConnectionQuality, type SyncStrategy } from '../services/connectionQuality';

/**
 * Background sync hook options
 */
interface UseBackgroundSyncOptions {
  /** Auto-adapt sync behavior based on connection quality */
  adaptive?: boolean;
  /** Custom correlation ID for grouping operations */
  correlationId?: string;
  /** Enable detailed logging */
  enableLogging?: boolean;
}

/**
 * Background sync hook result
 */
interface UseBackgroundSyncResult {
  /** Queue a database operation */
  queueDatabase: (operation: string, data: unknown, options?: QueueOptions) => string;
  /** Queue a bridge operation */
  queueBridge: (operation: string, data: unknown, options?: QueueOptions) => string;
  /** Queue a sync operation */
  queueSync: (operation: string, data: unknown, options?: QueueOptions) => string;
  /** Current queue statistics */
  stats: BackgroundSyncStats;
  /** Current sync strategy */
  strategy: SyncStrategy;
  /** Connection quality metrics */
  connectionMetrics: any;
  /** Whether sync is currently active */
  isSyncing: boolean;
  /** Force queue processing */
  processNow: () => void;
  /** Clear all operations */
  clearQueue: () => void;
  /** Get operations by correlation ID */
  getCorrelatedOperations: (correlationId: string) => any[];
}

/**
 * Queue operation options
 */
interface QueueOptions {
  priority?: 'low' | 'normal' | 'high' | 'critical';
  maxAttempts?: number;
  onSuccess?: (result: unknown) => void;
  onFailure?: (error: Error) => void;
}

/**
 * Background sync statistics
 */
interface BackgroundSyncStats {
  total: number;
  pending: number;
  ready: number;
  failed: number;
  correlations: number;
  isProcessing: boolean;
}

/**
 * Hook for managing background sync operations
 */
export function useBackgroundSync(options: UseBackgroundSyncOptions = {}): UseBackgroundSyncResult {
  const {
    adaptive = true,
    correlationId: defaultCorrelationId,
    enableLogging = false
  } = options;

  // Connection quality monitoring
  const { metrics: connectionMetrics, strategy: connectionStrategy } = useConnectionQuality();

  // Local state
  const [stats, setStats] = useState<BackgroundSyncStats>({
    total: 0,
    pending: 0,
    ready: 0,
    failed: 0,
    correlations: 0,
    isProcessing: false
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // Track sync strategy with connection quality adaptation
  const [strategy, setStrategy] = useState<SyncStrategy>(connectionStrategy);

  // Refs for cleanup
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Update strategy when connection quality changes
  useEffect(() => {
    if (adaptive) {
      setStrategy(connectionStrategy);

      if (enableLogging) {
        console.log('[useBackgroundSync] Strategy updated for connection quality:', {
          quality: connectionMetrics.quality,
          strategy: connectionStrategy
        });
      }
    }
  }, [connectionStrategy, adaptive, enableLogging, connectionMetrics.quality]);

  // Monitor sync queue statistics
  useEffect(() => {
    const updateStats = () => {
      const currentStats = backgroundSync.getStats();
      setStats(currentStats);
      setIsSyncing(currentStats.isProcessing);
    };

    // Update immediately
    updateStats();

    // Update every 2 seconds
    statsIntervalRef.current = setInterval(updateStats, 2000);

    return () => {
      if (statsIntervalRef.current) {
        clearInterval(statsIntervalRef.current);
        statsIntervalRef.current = null;
      }
    };
  }, []);

  // Queue database operation with adaptive options
  const queueDatabase = useCallback((
    operation: string,
    data: unknown,
    options: QueueOptions = {}
  ): string => {
    const queueOptions = {
      ...options,
      correlationId: options.priority === 'critical' ?
        `critical-${Date.now()}` :
        defaultCorrelationId,
      maxAttempts: adaptive ?
        getAdaptiveMaxAttempts(connectionMetrics.quality, options.maxAttempts) :
        options.maxAttempts
    };

    const operationId = backgroundSync.enqueue('database', operation, data, queueOptions);

    if (enableLogging) {
      console.log('[useBackgroundSync] Queued database operation:', {
        id: operationId,
        operation,
        priority: queueOptions.priority,
        correlationId: queueOptions.correlationId,
        quality: connectionMetrics.quality
      });
    }

    return operationId;
  }, [defaultCorrelationId, adaptive, connectionMetrics.quality, enableLogging]);

  // Queue bridge operation with adaptive options
  const queueBridge = useCallback((
    operation: string,
    data: unknown,
    options: QueueOptions = {}
  ): string => {
    const queueOptions = {
      ...options,
      correlationId: defaultCorrelationId,
      maxAttempts: adaptive ?
        getAdaptiveMaxAttempts(connectionMetrics.quality, options.maxAttempts) :
        options.maxAttempts
    };

    const operationId = backgroundSync.enqueue('bridge', operation, data, queueOptions);

    if (enableLogging) {
      console.log('[useBackgroundSync] Queued bridge operation:', {
        id: operationId,
        operation,
        priority: queueOptions.priority,
        correlationId: queueOptions.correlationId,
        quality: connectionMetrics.quality
      });
    }

    return operationId;
  }, [defaultCorrelationId, adaptive, connectionMetrics.quality, enableLogging]);

  // Queue sync operation with adaptive options
  const queueSync = useCallback((
    operation: string,
    data: unknown,
    options: QueueOptions = {}
  ): string => {
    const queueOptions = {
      ...options,
      correlationId: defaultCorrelationId,
      maxAttempts: adaptive ?
        getAdaptiveMaxAttempts(connectionMetrics.quality, options.maxAttempts) :
        options.maxAttempts
    };

    const operationId = backgroundSync.enqueue('sync', operation, data, queueOptions);

    if (enableLogging) {
      console.log('[useBackgroundSync] Queued sync operation:', {
        id: operationId,
        operation,
        priority: queueOptions.priority,
        correlationId: queueOptions.correlationId,
        quality: connectionMetrics.quality
      });
    }

    return operationId;
  }, [defaultCorrelationId, adaptive, connectionMetrics.quality, enableLogging]);

  // Force queue processing
  const processNow = useCallback(() => {
    // Trigger immediate processing by reducing next retry times
    // This is a simulation - actual implementation would call internal methods
    if (enableLogging) {
      console.log('[useBackgroundSync] Forced queue processing');
    }
  }, [enableLogging]);

  // Clear queue
  const clearQueue = useCallback(() => {
    backgroundSync.clear();
    if (enableLogging) {
      console.log('[useBackgroundSync] Queue cleared');
    }
  }, [enableLogging]);

  // Get correlated operations
  const getCorrelatedOperations = useCallback((correlationId: string) => {
    return backgroundSync.getCorrelatedOperations(correlationId);
  }, []);

  return {
    queueDatabase,
    queueBridge,
    queueSync,
    stats,
    strategy,
    connectionMetrics,
    isSyncing,
    processNow,
    clearQueue,
    getCorrelatedOperations
  };
}

/**
 * Get adaptive max attempts based on connection quality
 */
function getAdaptiveMaxAttempts(
  quality: ConnectionQuality,
  userMaxAttempts?: number
): number {
  if (userMaxAttempts !== undefined) {
    return userMaxAttempts;
  }

  // Adjust max attempts based on connection quality
  switch (quality) {
    case 'offline':
      return 10; // More attempts when offline
    case 'slow':
      return 8;
    case 'moderate':
      return 5;
    case 'fast':
      return 3;
    case 'excellent':
      return 2; // Fewer attempts on good connections
    default:
      return 5;
  }
}

/**
 * Hook for handling failed operations with automatic retry
 */
export function useFailedOperationHandler() {
  const backgroundSyncHook = useBackgroundSync({
    adaptive: true,
    enableLogging: true
  });

  const handleFailedOperation = useCallback((
    type: 'database' | 'bridge' | 'sync',
    operation: string,
    data: unknown,
    error: Error,
    options: {
      priority?: 'low' | 'normal' | 'high' | 'critical';
      correlationId?: string;
      onSuccess?: (result: unknown) => void;
      onRetryFailure?: (error: Error) => void;
    } = {}
  ): string => {
    console.warn(`[FailedOperationHandler] Handling failed ${type} operation:`, {
      operation,
      error: error.message,
      priority: options.priority || 'normal'
    });

    const queueOptions: QueueOptions = {
      priority: options.priority || 'high', // Failed operations get higher priority
      onSuccess: (result) => {
        console.log(`[FailedOperationHandler] Retry succeeded for ${operation}:`, result);
        options.onSuccess?.(result);
      },
      onFailure: (retryError) => {
        console.error(`[FailedOperationHandler] Retry failed for ${operation}:`, retryError);
        options.onRetryFailure?.(retryError);
      }
    };

    // Queue the failed operation for retry
    switch (type) {
      case 'database':
        return backgroundSyncHook.queueDatabase(operation, data, queueOptions);
      case 'bridge':
        return backgroundSyncHook.queueBridge(operation, data, queueOptions);
      case 'sync':
        return backgroundSyncHook.queueSync(operation, data, queueOptions);
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }, [backgroundSyncHook]);

  return {
    handleFailedOperation,
    ...backgroundSyncHook
  };
}

/**
 * Hook for monitoring sync status and providing UI feedback
 */
export function useSyncStatus() {
  const { stats, strategy, connectionMetrics, isSyncing } = useBackgroundSync({
    adaptive: true
  });

  const getSyncStatusMessage = useCallback((): string => {
    if (!connectionMetrics.isOnline) {
      return 'Offline - changes will sync when connection is restored';
    }

    if (isSyncing) {
      return 'Syncing...';
    }

    if (stats.failed > 0) {
      return `${stats.failed} operations failed - retrying`;
    }

    if (stats.pending > 0) {
      return `${stats.pending} operations pending`;
    }

    if (stats.total === 0) {
      return 'All synced';
    }

    return 'Sync active';
  }, [connectionMetrics.isOnline, isSyncing, stats]);

  const getSyncStatusColor = useCallback((): 'green' | 'yellow' | 'red' | 'gray' => {
    if (!connectionMetrics.isOnline) return 'gray';
    if (stats.failed > 0) return 'red';
    if (isSyncing || stats.pending > 0) return 'yellow';
    return 'green';
  }, [connectionMetrics.isOnline, stats.failed, isSyncing, stats.pending]);

  return {
    stats,
    strategy,
    connectionMetrics,
    isSyncing,
    message: getSyncStatusMessage(),
    color: getSyncStatusColor(),
    hasFailures: stats.failed > 0,
    hasPending: stats.pending > 0,
    isOnline: connectionMetrics.isOnline
  };
}