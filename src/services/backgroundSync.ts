/**
 * Background Sync Queue with Exponential Backoff
 *
 * Handles failed database operations with intelligent retry logic and
 * priority-based queuing for optimal performance recovery.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Background sync operation interface
 */
interface SyncOperation {
  id: string;
  type: 'database' | 'bridge' | 'sync';
  operation: string;
  data: unknown;
  priority: 'low' | 'normal' | 'high' | 'critical';
  attempts: number;
  maxAttempts: number;
  nextRetryAt: number;
  createdAt: number;
  correlationId?: string;
  onSuccess?: (result: unknown) => void;
  onFailure?: (error: Error) => void;
}

/**
 * Exponential backoff configuration
 */
interface BackoffConfig {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  jitter: boolean;
}

const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelayMs: 1000, // Start with 1 second
  maxDelayMs: 300000,   // Max 5 minutes
  multiplier: 2,        // Double delay each time
  jitter: true          // Add randomness to prevent thundering herd
};

/**
 * Background sync manager with exponential backoff retry logic
 */
export class BackgroundSyncManager {
  private queue: Map<string, SyncOperation> = new Map();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private backoffConfig: BackoffConfig;
  private correlationMap = new Map<string, string[]>(); // Track related operations

  constructor(config: Partial<BackoffConfig> = {}) {
    this.backoffConfig = { ...DEFAULT_BACKOFF_CONFIG, ...config };
    this.startProcessing();
  }

  /**
   * Add operation to sync queue
   */
  enqueue(
    type: SyncOperation['type'],
    operation: string,
    data: unknown,
    options: {
      priority?: SyncOperation['priority'];
      maxAttempts?: number;
      correlationId?: string;
      onSuccess?: (result: unknown) => void;
      onFailure?: (error: Error) => void;
    } = {}
  ): string {
    const id = uuidv4();
    const now = Date.now();

    const syncOp: SyncOperation = {
      id,
      type,
      operation,
      data,
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || 5,
      nextRetryAt: now,
      createdAt: now,
      correlationId: options.correlationId,
      onSuccess: options.onSuccess,
      onFailure: options.onFailure
    };

    this.queue.set(id, syncOp);

    // Track correlation
    if (options.correlationId) {
      if (!this.correlationMap.has(options.correlationId)) {
        this.correlationMap.set(options.correlationId, []);
      }
      this.correlationMap.get(options.correlationId)!.push(id);
    }

    console.log('[BackgroundSync] Queued operation:', {
      id,
      type,
      operation,
      priority: syncOp.priority,
      correlationId: options.correlationId,
      queueSize: this.queue.size
    });

    return id;
  }

  /**
   * Remove operation from queue
   */
  dequeue(operationId: string): boolean {
    const operation = this.queue.get(operationId);
    if (!operation) return false;

    this.queue.delete(operationId);

    // Clean up correlation tracking
    if (operation.correlationId) {
      const correlatedIds = this.correlationMap.get(operation.correlationId);
      if (correlatedIds) {
        const index = correlatedIds.indexOf(operationId);
        if (index >= 0) {
          correlatedIds.splice(index, 1);
          if (correlatedIds.length === 0) {
            this.correlationMap.delete(operation.correlationId);
          }
        }
      }
    }

    return true;
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const now = Date.now();
    let pending = 0;
    let ready = 0;
    let failed = 0;

    for (const op of this.queue.values()) {
      if (op.attempts >= op.maxAttempts) {
        failed++;
      } else if (op.nextRetryAt <= now) {
        ready++;
      } else {
        pending++;
      }
    }

    return {
      total: this.queue.size,
      pending,
      ready,
      failed,
      correlations: this.correlationMap.size,
      isProcessing: this.isProcessing
    };
  }

  /**
   * Get operations by correlation ID
   */
  getCorrelatedOperations(correlationId: string): SyncOperation[] {
    const operationIds = this.correlationMap.get(correlationId) || [];
    return operationIds
      .map(id => this.queue.get(id))
      .filter((op): op is SyncOperation => op !== undefined);
  }

  /**
   * Calculate next retry delay with exponential backoff
   */
  private calculateBackoffDelay(attempts: number): number {
    const { initialDelayMs, maxDelayMs, multiplier, jitter } = this.backoffConfig;

    let delay = initialDelayMs * Math.pow(multiplier, attempts);
    delay = Math.min(delay, maxDelayMs);

    if (jitter) {
      // Add ±25% jitter to prevent thundering herd
      const jitterRange = delay * 0.25;
      const jitterAmount = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitterAmount;
    }

    return Math.max(delay, 0);
  }

  /**
   * Start background processing
   */
  private startProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    this.processingInterval = setInterval(() => {
      this.processQueue();
    }, 2000); // Check every 2 seconds
  }

  /**
   * Process pending operations in priority order
   */
  private async processQueue() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    const now = Date.now();

    try {
      // Get ready operations sorted by priority and creation time
      const readyOperations = Array.from(this.queue.values())
        .filter(op => op.nextRetryAt <= now && op.attempts < op.maxAttempts)
        .sort((a, b) => {
          // Priority order: critical > high > normal > low
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
          const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

          if (priorityDiff !== 0) return priorityDiff;

          // Secondary sort by creation time (older first)
          return a.createdAt - b.createdAt;
        });

      // Process up to 5 operations per cycle
      const toProcess = readyOperations.slice(0, 5);

      await Promise.allSettled(
        toProcess.map(operation => this.executeOperation(operation))
      );
    } catch (error) {
      console.error('[BackgroundSync] Processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Execute a single operation with retry logic
   */
  private async executeOperation(operation: SyncOperation): Promise<void> {
    operation.attempts++;

    console.log('[BackgroundSync] Executing operation:', {
      id: operation.id,
      type: operation.type,
      operation: operation.operation,
      attempt: operation.attempts,
      maxAttempts: operation.maxAttempts
    });

    try {
      let result: unknown;

      // Execute operation based on type
      switch (operation.type) {
        case 'database':
          result = await this.executeDatabaseOperation(operation);
          break;
        case 'bridge':
          result = await this.executeBridgeOperation(operation);
          break;
        case 'sync':
          result = await this.executeSyncOperation(operation);
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // Success - remove from queue and notify
      this.dequeue(operation.id);
      operation.onSuccess?.(result);

      console.log('[BackgroundSync] Operation succeeded:', {
        id: operation.id,
        type: operation.type,
        operation: operation.operation,
        attempts: operation.attempts
      });

    } catch (error) {
      console.warn('[BackgroundSync] Operation failed:', {
        id: operation.id,
        type: operation.type,
        operation: operation.operation,
        attempt: operation.attempts,
        maxAttempts: operation.maxAttempts,
        error: (error as Error).message
      });

      if (operation.attempts >= operation.maxAttempts) {
        // Max attempts reached - remove and notify failure
        this.dequeue(operation.id);
        operation.onFailure?.(error as Error);
      } else {
        // Schedule retry with exponential backoff
        const delay = this.calculateBackoffDelay(operation.attempts);
        operation.nextRetryAt = Date.now() + delay;

        console.log('[BackgroundSync] Scheduled retry:', {
          id: operation.id,
          nextRetry: new Date(operation.nextRetryAt).toISOString(),
          delay: `${delay}ms`
        });
      }
    }
  }

  /**
   * Execute database operation
   */
  private async executeDatabaseOperation(operation: SyncOperation): Promise<unknown> {
    // This would integrate with actual database service
    // For now, simulate database operation

    const { operation: op, data } = operation;

    // Simulate failure for testing
    if (Math.random() < 0.3) {
      throw new Error(`Database operation failed: ${op}`);
    }

    return { success: true, operation: op, data };
  }

  /**
   * Execute bridge operation
   */
  private async executeBridgeOperation(operation: SyncOperation): Promise<unknown> {
    // This would integrate with webview bridge
    // For now, simulate bridge operation

    const { operation: op, data } = operation;

    // Simulate network-dependent failure
    if (Math.random() < 0.2) {
      throw new Error(`Bridge operation failed: ${op}`);
    }

    return { success: true, operation: op, data };
  }

  /**
   * Execute sync operation
   */
  private async executeSyncOperation(operation: SyncOperation): Promise<unknown> {
    // This would integrate with sync service
    // For now, simulate sync operation

    const { operation: op, data } = operation;

    // Simulate sync failure
    if (Math.random() < 0.1) {
      throw new Error(`Sync operation failed: ${op}`);
    }

    return { success: true, operation: op, data };
  }

  /**
   * Clear all operations (for testing/cleanup)
   */
  clear() {
    this.queue.clear();
    this.correlationMap.clear();
  }

  /**
   * Stop background processing
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isProcessing = false;
  }

  /**
   * Get operation by ID
   */
  getOperation(operationId: string): SyncOperation | undefined {
    return this.queue.get(operationId);
  }
}

// Singleton instance
export const backgroundSync = new BackgroundSyncManager();

/**
 * Helper function to queue database operations
 */
export function queueDatabaseOperation(
  operation: string,
  data: unknown,
  options?: {
    priority?: SyncOperation['priority'];
    correlationId?: string;
    onSuccess?: (result: unknown) => void;
    onFailure?: (error: Error) => void;
  }
): string {
  return backgroundSync.enqueue('database', operation, data, options);
}

/**
 * Helper function to queue bridge operations
 */
export function queueBridgeOperation(
  operation: string,
  data: unknown,
  options?: {
    priority?: SyncOperation['priority'];
    correlationId?: string;
    onSuccess?: (result: unknown) => void;
    onFailure?: (error: Error) => void;
  }
): string {
  return backgroundSync.enqueue('bridge', operation, data, options);
}

/**
 * Helper function to queue sync operations
 */
export function queueSyncOperation(
  operation: string,
  data: unknown,
  options?: {
    priority?: SyncOperation['priority'];
    correlationId?: string;
    onSuccess?: (result: unknown) => void;
    onFailure?: (error: Error) => void;
  }
): string {
  return backgroundSync.enqueue('sync', operation, data, options);
}