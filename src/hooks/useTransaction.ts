/**
 * Hook-based transaction API for React components
 *
 * Provides Promise-based transaction coordination across React-to-Native bridge
 * with automatic correlation ID generation, flat nesting behavior, and integration
 * with existing WebView bridge infrastructure.
 */

import { useCallback, useState, useRef, useEffect } from 'react';
import { TransactionScope, TransactionScopeError, TransactionTimeoutError } from '../utils/transaction/transaction-scope';
import { createChildId } from '../utils/transaction/correlation-ids';
import { webViewBridge } from '../utils/webview-bridge';

/**
 * Transaction execution context passed to operation functions
 */
export interface TransactionContext {
  correlationId: string;
  transactionId: string | null;
  operationCount: number;
  isNested: boolean;
}

/**
 * Transaction execution options
 */
export interface TransactionOptions {
  correlationId?: string;
  timeout?: number; // milliseconds, default 30000 (30s)
  retryOnConflict?: boolean; // default false
  maxRetries?: number; // default 3
}

/**
 * Transaction operation function type
 */
export type TransactionOperation<T> = (context: TransactionContext) => Promise<T>;

/**
 * useTransaction hook return type
 */
export interface UseTransactionResult {
  execute: <T>(operation: TransactionOperation<T>, options?: TransactionOptions) => Promise<T>;
  isActive: boolean;
  correlationId: string | null;
  operationCount: number;
  duration: number;
}

/**
 * Default transaction timeout (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default maximum retry attempts
 */
const DEFAULT_MAX_RETRIES = 3;

/**
 * Transaction hook providing Promise-based API for multi-step operations
 *
 * Features:
 * - Automatic correlation ID generation and tracking
 * - Flat transaction nesting (nested calls join existing transaction)
 * - Integration with WebView bridge for native coordination
 * - Promise-based API matching React async patterns
 * - Automatic rollback on exceptions
 * - Retry logic for transaction conflicts
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { execute, isActive } = useTransaction();
 *
 *   const handleSave = useCallback(async () => {
 *     await execute(async (tx) => {
 *       await updateNode(nodeData);
 *       await updateEdges(edgeData);
 *       // Automatic commit on success, rollback on error
 *     });
 *   }, []);
 *
 *   return (
 *     <button onClick={handleSave} disabled={isActive}>
 *       {isActive ? 'Saving...' : 'Save'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTransaction(): UseTransactionResult {
  // Transaction state
  const [isActive, setIsActive] = useState(false);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [operationCount, setOperationCount] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  // Refs for stable references
  const currentScopeRef = useRef<TransactionScope | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate duration
  const duration = startTime ? Date.now() - startTime.getTime() : 0;

  // Cleanup effect
  useEffect(() => {
    return () => {
      // Cleanup any active transaction on unmount
      if (currentScopeRef.current?.isTransactionActive()) {
        currentScopeRef.current.rollback().catch(console.error);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Execute operation within transaction scope
   */
  const execute = useCallback(async <T>(
    operation: TransactionOperation<T>,
    options: TransactionOptions = {}
  ): Promise<T> => {
    const {
      correlationId: providedCorrelationId,
      timeout = DEFAULT_TIMEOUT,
      retryOnConflict = false,
      maxRetries = DEFAULT_MAX_RETRIES
    } = options;

    // Check for flat nesting behavior
    const existingScope = TransactionScope.getCurrentScope();
    if (existingScope?.isTransactionActive()) {
      // Join existing transaction (flat nesting)
      return await executeInExistingTransaction(operation, existingScope);
    }

    // Create new transaction scope
    const scope = new TransactionScope(providedCorrelationId);
    currentScopeRef.current = scope;

    // Update hook state
    setIsActive(true);
    setCorrelationId(scope.getCorrelationId());
    setOperationCount(0);
    setStartTime(new Date());

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= maxRetries) {
      try {
        // Set up timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutRef.current = setTimeout(() => {
            reject(new TransactionTimeoutError(scope.getCorrelationId(), timeout));
          }, timeout);
        });

        // Begin transaction via bridge
        const transactionId = await sendTransactionMessage('beginTransaction', {
          correlationId: scope.getCorrelationId()
        });

        await scope.start(transactionId);

        // Execute operation with timeout
        const operationPromise = executeOperationWithContext(operation, scope);
        const result = await Promise.race([operationPromise, timeoutPromise]);

        // Clear timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Commit transaction
        await scope.commit();

        return result;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Clear timeout on error
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }

        // Attempt rollback
        try {
          await scope.rollback();
        } catch (rollbackError) {
          console.error('[useTransaction] Rollback failed:', rollbackError);
        }

        // Check if we should retry
        if (retryOnConflict && isRetryableError(lastError) && attempt < maxRetries) {
          attempt++;
          // Exponential backoff
          const backoffMs = 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, backoffMs));

          // Create new scope for retry
          const retryCorrelationId = createChildId(scope.getCorrelationId(), attempt);
          const retryScope = new TransactionScope(retryCorrelationId);
          currentScopeRef.current = retryScope;

          continue;
        }

        // No retry, propagate error
        throw lastError;

      } finally {
        // Reset hook state
        setIsActive(false);
        setCorrelationId(null);
        setOperationCount(0);
        setStartTime(null);
        currentScopeRef.current = null;
      }
    }

    // Should never reach here, but throw last error if we do
    throw lastError || new Error('Transaction failed with unknown error');
  }, []);

  return {
    execute,
    isActive,
    correlationId,
    operationCount,
    duration
  };
}

/**
 * Execute operation within existing transaction (flat nesting)
 */
async function executeInExistingTransaction<T>(
  operation: TransactionOperation<T>,
  existingScope: TransactionScope
): Promise<T> {
  // Generate child correlation ID for this operation
  const childCorrelationId = createChildId(
    existingScope.getCorrelationId(),
    existingScope.getOperationCount() + 1
  );

  // Create context for the operation
  const context: TransactionContext = {
    correlationId: childCorrelationId,
    transactionId: existingScope.getTransactionId(),
    operationCount: existingScope.getOperationCount(),
    isNested: true
  };

  // Execute operation and increment counter
  existingScope.incrementOperationCount();
  return await operation(context);
}

/**
 * Execute operation with proper transaction context
 */
async function executeOperationWithContext<T>(
  operation: TransactionOperation<T>,
  scope: TransactionScope
): Promise<T> {
  const context: TransactionContext = {
    correlationId: scope.getCorrelationId(),
    transactionId: scope.getTransactionId(),
    operationCount: scope.getOperationCount(),
    isNested: scope.isNestedTransaction()
  };

  const result = await operation(context);
  scope.incrementOperationCount();
  return result;
}

/**
 * Send transaction message via WebView bridge
 */
async function sendTransactionMessage(method: string, params: any): Promise<any> {
  try {
    const correlationId = params.correlationId;

    // Use the transaction-specific bridge methods
    switch (method) {
      case 'beginTransaction':
        return await webViewBridge.transaction.beginTransaction(correlationId);

      case 'commitTransaction':
        return await webViewBridge.transaction.commitTransaction(params.transactionId);

      case 'rollbackTransaction':
        return await webViewBridge.transaction.rollbackTransaction(params.transactionId);

      default:
        // Fallback to generic transaction message
        return await webViewBridge.sendTransactionMessage(method, params, correlationId);
    }

  } catch (error) {
    if (error instanceof TransactionScopeError) {
      throw error;
    }

    throw new TransactionScopeError(
      `Bridge communication failed: ${error}`,
      params.correlationId
    );
  }
}

/**
 * Check if error is retryable (transaction conflict, timeout, etc.)
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();

  // SQLite busy/locked errors
  if (message.includes('busy') || message.includes('locked')) {
    return true;
  }

  // Transaction conflict errors
  if (message.includes('conflict') || message.includes('deadlock')) {
    return true;
  }

  // Network/bridge temporary failures
  if (message.includes('timeout') || message.includes('network')) {
    return true;
  }

  return false;
}

/**
 * Helper hooks for common transaction patterns
 */

/**
 * Hook for simple CRUD operations with automatic transaction wrapping
 */
export function useTransactionMutation<TVariables = any, TData = any>(
  mutationFn: (variables: TVariables, context: TransactionContext) => Promise<TData>
) {
  const { execute, isActive } = useTransaction();

  const mutate = useCallback(async (
    variables: TVariables,
    options?: TransactionOptions
  ): Promise<TData> => {
    return execute(async (context) => {
      return mutationFn(variables, context);
    }, options);
  }, [execute, mutationFn]);

  return {
    mutate,
    isLoading: isActive
  };
}

/**
 * Hook for batch operations with single transaction
 */
export function useBatchTransaction() {
  const { execute } = useTransaction();

  const executeBatch = useCallback(async <T>(
    operations: TransactionOperation<T>[],
    options?: TransactionOptions
  ): Promise<T[]> => {
    return execute(async (context) => {
      const results: T[] = [];

      for (const operation of operations) {
        const result = await operation(context);
        results.push(result);
      }

      return results;
    }, options);
  }, [execute]);

  return { executeBatch };
}