/**
 * Optimistic Updates Hook with Rollback and Live Query Integration
 *
 * Provides instant UI responsiveness with optimistic state management while
 * maintaining proper rollback capabilities integrated with useLiveQuery for
 * conflict resolution and state reconciliation.
 *
 * Uses merge-first philosophy from Phase 19 context for collaborative real-time
 * experience with graceful degradation during failures.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useLiveQuery } from './useLiveQuery';
import { useConnection } from '../context/ConnectionContext';
import { webViewBridge } from '../utils/webview-bridge';

export interface OptimisticOperation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'batch';
  table: string;
  primaryKey?: string | number;
  optimisticData: any;
  actualOperation: () => Promise<any>;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  rollbackEvent?: (operation: OptimisticOperation) => void;
}

export interface OptimisticState<T = any> {
  actualData: T[] | null;
  optimisticData: T[] | null;
  pendingOperations: OptimisticOperation[];
  hasOptimisticChanges: boolean;
  rollbackInProgress: boolean;
  lastError: string | null;
}

export interface OptimisticUpdateOptions {
  /** Maximum number of retries for failed operations */
  maxRetries?: number;
  /** Timeout for operations in milliseconds */
  operationTimeout?: number;
  /** Enable debug logging for operation tracking */
  enableDebugLogging?: boolean;
  /** Custom error handler for failed operations */
  onOperationError?: (error: Error, operation: OptimisticOperation) => void;
  /** Custom rollback handler for state reconciliation */
  onRollback?: (operation: OptimisticOperation) => void;
}

export interface OptimisticUpdateResult<T = any> {
  /** Current display data (optimistic if available, actual otherwise) */
  data: T[] | null;
  /** Loading state for initial query or rollbacks */
  loading: boolean;
  /** Error state from operations or live query */
  error: string | null;
  /** Whether optimistic changes are pending */
  hasOptimisticChanges: boolean;
  /** Whether a rollback is in progress */
  rollbackInProgress: boolean;
  /** Apply optimistic update with actual operation */
  applyOptimisticUpdate: (operation: Omit<OptimisticOperation, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  /** Manually rollback specific operation */
  rollbackOperation: (operationId: string) => Promise<void>;
  /** Rollback all pending operations */
  rollbackAll: () => Promise<void>;
  /** Retry failed operations */
  retryFailedOperations: () => Promise<void>;
  /** Get current optimistic state details */
  getOptimisticState: () => OptimisticState<T>;
}

/**
 * Hook for optimistic updates with rollback capability and live query integration
 *
 * @param sql Base SQL query for live data monitoring
 * @param liveQueryParams Parameters for the base query
 * @param options Configuration options for optimistic updates
 * @returns Optimistic update result with control functions
 */
export function useOptimisticUpdates<T = any>(
  sql: string,
  liveQueryParams: any[] = [],
  options: OptimisticUpdateOptions = {}
): OptimisticUpdateResult<T> {
  const {
    maxRetries = 3,
    operationTimeout = 5000,
    enableDebugLogging = false,
    onOperationError,
    onRollback
  } = options;

  // Get live query data for actual state management
  const liveQuery = useLiveQuery<T>(sql, { params: liveQueryParams, autoStart: true });
  const { isConnected, status } = useConnection();

  // Optimistic state
  const [optimisticState, setOptimisticState] = useState<OptimisticState<T>>({
    actualData: null,
    optimisticData: null,
    pendingOperations: [],
    hasOptimisticChanges: false,
    rollbackInProgress: false,
    lastError: null
  });

  // Refs for tracking
  const operationIdCounter = useRef(0);
  const rollbackPromises = useRef<Map<string, Promise<void>>>(new Map());

  // Generate unique operation ID
  const generateOperationId = useCallback((): string => {
    return `opt_${Date.now()}_${++operationIdCounter.current}`;
  }, []);

  // Apply optimistic changes to data
  const applyOptimisticChanges = useCallback((
    baseData: T[] | null,
    operations: OptimisticOperation[]
  ): T[] | null => {
    if (!baseData || operations.length === 0) return baseData;

    let result = [...baseData];

    for (const op of operations) {
      switch (op.type) {
        case 'create':
          result.push(op.optimisticData);
          break;

        case 'update':
          if (op.primaryKey !== undefined) {
            const index = result.findIndex((item: any) =>
              item.id === op.primaryKey || item[op.table + '_id'] === op.primaryKey
            );
            if (index >= 0) {
              result[index] = { ...result[index], ...op.optimisticData };
            }
          }
          break;

        case 'delete':
          if (op.primaryKey !== undefined) {
            result = result.filter((item: any) =>
              item.id !== op.primaryKey && item[op.table + '_id'] !== op.primaryKey
            );
          }
          break;

        case 'batch':
          // Apply batch operations in sequence
          if (Array.isArray(op.optimisticData)) {
            // TODO: Implement batch operations
            // Each batch item should have type and data properties
            // Implementation depends on specific batch structure
          }
          break;
      }
    }

    return result;
  }, []);

  // Reconcile optimistic state with live query data
  const reconcileWithLiveData = useCallback((liveData: T[] | null) => {
    setOptimisticState(prev => {
      const newActualData = liveData;
      const optimisticData = applyOptimisticChanges(newActualData, prev.pendingOperations);

      return {
        ...prev,
        actualData: newActualData,
        optimisticData,
        rollbackInProgress: false
      };
    });
  }, [applyOptimisticChanges]);

  // Apply optimistic update with actual operation
  const applyOptimisticUpdate = useCallback(async (
    operationData: Omit<OptimisticOperation, 'id' | 'timestamp' | 'retryCount'>
  ): Promise<void> => {
    if (!isConnected && operationData.type !== 'create') {
      // For offline scenarios, only allow creates (local-first approach)
      throw new Error('Operation not available offline');
    }

    const operation: OptimisticOperation = {
      ...operationData,
      id: generateOperationId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries
    };

    // Apply optimistic change immediately
    setOptimisticState(prev => {
      const newPendingOps = [...prev.pendingOperations, operation];
      const optimisticData = applyOptimisticChanges(prev.actualData, newPendingOps);

      if (enableDebugLogging) {
        console.log('[useOptimisticUpdates] Applied optimistic update:', {
          operation: operation.type,
          table: operation.table,
          id: operation.id,
          timestamp: operation.timestamp
        });
      }

      return {
        ...prev,
        pendingOperations: newPendingOps,
        optimisticData,
        hasOptimisticChanges: true,
        lastError: null
      };
    });

    // Execute actual operation with timeout
    try {
      const operationPromise = Promise.race([
        operation.actualOperation(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), operationTimeout)
        )
      ]);

      await operationPromise;

      // Operation succeeded - remove from pending operations
      setOptimisticState(prev => {
        const newPendingOps = prev.pendingOperations.filter(op => op.id !== operation.id);

        if (enableDebugLogging) {
          console.log('[useOptimisticUpdates] Operation succeeded:', {
            operation: operation.type,
            id: operation.id,
            remainingPending: newPendingOps.length
          });
        }

        return {
          ...prev,
          pendingOperations: newPendingOps,
          hasOptimisticChanges: newPendingOps.length > 0
        };
      });

    } catch (error) {
      console.error('[useOptimisticUpdates] Operation failed:', error);

      // Handle operation failure with retry logic
      const shouldRetry = operation.retryCount < operation.maxRetries;

      if (shouldRetry && isConnected) {
        // Retry the operation
        const retryOperation = {
          ...operation,
          retryCount: operation.retryCount + 1
        };

        setOptimisticState(prev => {
          const newPendingOps = prev.pendingOperations.map(op =>
            op.id === operation.id ? retryOperation : op
          );

          return {
            ...prev,
            pendingOperations: newPendingOps
          };
        });

        // Schedule retry with exponential backoff
        const retryDelay = Math.min(1000 * Math.pow(2, operation.retryCount), 5000);
        setTimeout(() => {
          applyOptimisticUpdate({
            type: retryOperation.type,
            table: retryOperation.table,
            primaryKey: retryOperation.primaryKey,
            optimisticData: retryOperation.optimisticData,
            actualOperation: retryOperation.actualOperation,
            maxRetries: retryOperation.maxRetries
          });
        }, retryDelay);

      } else {
        // Rollback the operation
        await rollbackOperation(operation.id);

        // Call error handler
        onOperationError?.(error instanceof Error ? error : new Error(String(error)), operation);
      }
    }
  }, [
    isConnected,
    maxRetries,
    operationTimeout,
    enableDebugLogging,
    generateOperationId,
    applyOptimisticChanges,
    onOperationError
  ]);

  // Rollback specific operation
  const rollbackOperation = useCallback(async (operationId: string): Promise<void> => {
    // Prevent concurrent rollbacks of same operation
    const existingPromise = rollbackPromises.current.get(operationId);
    if (existingPromise) {
      return existingPromise;
    }

    const rollbackPromise = (async () => {
      setOptimisticState(prev => {
        const operationToRollback = prev.pendingOperations.find(op => op.id === operationId);
        if (!operationToRollback) return prev;

        if (enableDebugLogging) {
          console.log('[useOptimisticUpdates] Rolling back operation:', {
            operation: operationToRollback.type,
            id: operationId
          });
        }

        // Remove operation from pending
        const newPendingOps = prev.pendingOperations.filter(op => op.id !== operationId);

        // Reconcile with current live query data
        const optimisticData = applyOptimisticChanges(liveQuery.data, newPendingOps);

        // Call rollback event handler
        operationToRollback.rollbackEvent?.(operationToRollback);
        onRollback?.(operationToRollback);

        return {
          ...prev,
          pendingOperations: newPendingOps,
          optimisticData,
          hasOptimisticChanges: newPendingOps.length > 0,
          rollbackInProgress: true
        };
      });

      // Brief delay to ensure UI updates before clearing rollback state
      await new Promise(resolve => setTimeout(resolve, 100));

      setOptimisticState(prev => ({
        ...prev,
        rollbackInProgress: false
      }));
    })();

    rollbackPromises.current.set(operationId, rollbackPromise);
    await rollbackPromise;
    rollbackPromises.current.delete(operationId);
  }, [applyOptimisticChanges, liveQuery.data, enableDebugLogging, onRollback]);

  // Rollback all pending operations
  const rollbackAll = useCallback(async (): Promise<void> => {
    const currentOperations = optimisticState.pendingOperations.map(op => op.id);

    if (enableDebugLogging) {
      console.log('[useOptimisticUpdates] Rolling back all operations:', currentOperations.length);
    }

    await Promise.all(currentOperations.map(rollbackOperation));
  }, [optimisticState.pendingOperations, rollbackOperation, enableDebugLogging]);

  // Retry failed operations
  const retryFailedOperations = useCallback(async (): Promise<void> => {
    const failedOps = optimisticState.pendingOperations.filter(op => op.retryCount >= op.maxRetries);

    for (const failedOp of failedOps) {
      const retryOp = { ...failedOp, retryCount: 0 };
      await applyOptimisticUpdate({
        type: retryOp.type,
        table: retryOp.table,
        primaryKey: retryOp.primaryKey,
        optimisticData: retryOp.optimisticData,
        actualOperation: retryOp.actualOperation,
        maxRetries: retryOp.maxRetries
      });
    }
  }, [optimisticState.pendingOperations, applyOptimisticUpdate]);

  // Get current optimistic state
  const getOptimisticState = useCallback((): OptimisticState<T> => {
    return { ...optimisticState };
  }, [optimisticState]);

  // Effect to reconcile with live query data changes
  useEffect(() => {
    if (liveQuery.data !== null) {
      reconcileWithLiveData(liveQuery.data);
    }
  }, [liveQuery.data, reconcileWithLiveData]);

  // Effect to handle connection state changes
  useEffect(() => {
    if (!isConnected && optimisticState.pendingOperations.length > 0) {
      // Queue operations for retry when connection is restored
      if (enableDebugLogging) {
        console.log('[useOptimisticUpdates] Connection lost with pending operations:',
          optimisticState.pendingOperations.length);
      }
    } else if (isConnected && status === 'connected') {
      // Connection restored - retry any failed operations
      retryFailedOperations();
    }
  }, [isConnected, status, optimisticState.pendingOperations.length, retryFailedOperations, enableDebugLogging]);

  // Effect to handle live query errors
  useEffect(() => {
    if (liveQuery.error) {
      setOptimisticState(prev => ({
        ...prev,
        lastError: liveQuery.error
      }));
    }
  }, [liveQuery.error]);

  return {
    data: optimisticState.hasOptimisticChanges ? optimisticState.optimisticData : liveQuery.data,
    loading: liveQuery.loading || optimisticState.rollbackInProgress,
    error: optimisticState.lastError || liveQuery.error,
    hasOptimisticChanges: optimisticState.hasOptimisticChanges,
    rollbackInProgress: optimisticState.rollbackInProgress,
    applyOptimisticUpdate,
    rollbackOperation,
    rollbackAll,
    retryFailedOperations,
    getOptimisticState
  };
}

/**
 * Simplified optimistic updates for common CRUD operations
 */
export function useOptimisticCrud<T = any>(
  sql: string,
  tableName: string,
  options: OptimisticUpdateOptions = {}
) {
  const optimistic = useOptimisticUpdates<T>(sql, [], options);

  const createRecord = useCallback(async (data: Partial<T>) => {
    return optimistic.applyOptimisticUpdate({
      type: 'create',
      table: tableName,
      optimisticData: data,
      actualOperation: async () => {
        const columns = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);

        return webViewBridge.database.execute(
          `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
          values
        );
      },
      maxRetries: 3
    });
  }, [optimistic, tableName]);

  const updateRecord = useCallback(async (id: string | number, data: Partial<T>) => {
    return optimistic.applyOptimisticUpdate({
      type: 'update',
      table: tableName,
      primaryKey: id,
      optimisticData: data,
      actualOperation: async () => {
        const setPairs = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];

        return webViewBridge.database.execute(
          `UPDATE ${tableName} SET ${setPairs} WHERE id = ?`,
          values
        );
      },
      maxRetries: 3
    });
  }, [optimistic, tableName]);

  const deleteRecord = useCallback(async (id: string | number) => {
    return optimistic.applyOptimisticUpdate({
      type: 'delete',
      table: tableName,
      primaryKey: id,
      optimisticData: null,
      actualOperation: async () => {
        return webViewBridge.database.execute(
          `DELETE FROM ${tableName} WHERE id = ?`,
          [id]
        );
      },
      maxRetries: 3
    });
  }, [optimistic, tableName]);

  return {
    ...optimistic,
    createRecord,
    updateRecord,
    deleteRecord
  };
}