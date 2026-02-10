/**
 * Transaction boundary management and scope coordination
 *
 * Manages transaction state, correlation IDs, and bridge message coordination
 * with support for flat transaction nesting behavior. Provides error boundary
 * handling with automatic rollback on exceptions.
 */

import { generateCorrelationId, createChildId, extractParentId } from './correlation-ids';
import { devLogger } from '../logging/logger';

/**
 * Transaction execution context and state management
 *
 * Handles flat nesting where nested transaction calls join the existing
 * transaction instead of creating savepoints, following the research findings.
 */
export class TransactionScope {
  private correlationId: string;
  private transactionId: string | null = null;
  private isActive: boolean = false;
  private isNested: boolean = false;
  private operationCount: number = 0;
  private startTime: Date;

  // Stack-based nesting detection for flat nesting behavior
  private static activeScopes: TransactionScope[] = [];

  constructor(correlationId?: string) {
    this.correlationId = correlationId || generateCorrelationId();
    this.startTime = new Date();

    // Check for flat nesting: join existing transaction if one exists
    const parentScope = TransactionScope.getCurrentScope();
    if (parentScope && parentScope.isActive) {
      this.isNested = true;
      // Generate child correlation ID for tracking
      this.correlationId = createChildId(parentScope.correlationId, parentScope.operationCount + 1);
    }
  }

  /**
   * Get correlation ID for this transaction scope
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Get transaction ID (set after bridge communication)
   */
  getTransactionId(): string | null {
    return this.transactionId;
  }

  /**
   * Check if transaction is currently active
   */
  isTransactionActive(): boolean {
    return this.isActive;
  }

  /**
   * Check if this is a nested transaction scope
   */
  isNestedTransaction(): boolean {
    return this.isNested;
  }

  /**
   * Get number of operations executed in this scope
   */
  getOperationCount(): number {
    return this.operationCount;
  }

  /**
   * Get transaction duration
   */
  getDuration(): number {
    return Date.now() - this.startTime.getTime();
  }

  /**
   * Start transaction scope
   *
   * @param transactionId Transaction ID from bridge response
   */
  async start(transactionId: string): Promise<void> {
    if (this.isActive) {
      throw new Error(`Transaction scope already active: ${this.correlationId}`);
    }

    this.transactionId = transactionId;
    this.isActive = true;

    // Add to active scope stack
    TransactionScope.activeScopes.push(this);

    if (process.env.NODE_ENV === 'development') {
      devLogger.debug('Transaction scope started', {
        correlationId: this.correlationId,
        isNested: this.isNested
      });
    }
  }

  /**
   * Commit transaction scope
   */
  async commit(): Promise<void> {
    if (!this.isActive) {
      throw new Error(`Cannot commit inactive transaction scope: ${this.correlationId}`);
    }

    // For nested transactions in flat nesting mode, we don't actually commit here
    // The parent transaction will handle the actual commit
    if (this.isNested) {
      await this.finalize(true);
      return;
    }

    // Only root transaction performs actual commit
    try {
      await this.performBridgeCommit();
      await this.finalize(true);
    } catch (error) {
      // If commit fails, attempt rollback
      try {
        await this.performBridgeRollback();
      } catch (rollbackError) {
        devLogger.error('Failed to rollback after commit failure', {
          correlationId: this.correlationId,
          error: rollbackError
        });
      }
      await this.finalize(false);
      throw error;
    }
  }

  /**
   * Rollback transaction scope
   */
  async rollback(): Promise<void> {
    if (!this.isActive) {
      throw new Error(`Cannot rollback inactive transaction scope: ${this.correlationId}`);
    }

    // For nested transactions, mark as rolled back but let parent handle bridge
    if (this.isNested) {
      await this.finalize(false);
      // Propagate rollback to parent scope
      const parentScope = this.getParentScope();
      if (parentScope) {
        await parentScope.rollback();
      }
      return;
    }

    // Root transaction performs actual rollback
    try {
      await this.performBridgeRollback();
    } catch (error) {
      devLogger.error('Failed to rollback transaction', {
        correlationId: this.correlationId,
        error
      });
    } finally {
      await this.finalize(false);
    }
  }

  /**
   * Increment operation counter
   */
  incrementOperationCount(): void {
    this.operationCount++;

    // Also increment parent scope if nested
    if (this.isNested) {
      const parentScope = this.getParentScope();
      if (parentScope) {
        parentScope.incrementOperationCount();
      }
    }
  }

  /**
   * Get bridge message headers with correlation ID
   */
  getBridgeHeaders(): Record<string, string> {
    return {
      'correlation-id': this.correlationId,
      'transaction-id': this.transactionId || '',
      'operation-count': this.operationCount.toString(),
      'is-nested': this.isNested.toString()
    };
  }

  // Static methods for scope management

  /**
   * Get current active transaction scope (top of stack)
   */
  static getCurrentScope(): TransactionScope | null {
    return this.activeScopes.length > 0 ? this.activeScopes[this.activeScopes.length - 1] : null;
  }

  /**
   * Check if any transaction is currently active
   */
  static hasActiveTransaction(): boolean {
    return this.activeScopes.length > 0;
  }

  /**
   * Get transaction nesting depth
   */
  static getTransactionDepth(): number {
    return this.activeScopes.length;
  }

  /**
   * Create new transaction scope with flat nesting behavior
   */
  static create(correlationId?: string): TransactionScope {
    return new TransactionScope(correlationId);
  }

  // Private methods

  private getParentScope(): TransactionScope | null {
    if (!this.isNested) return null;

    // Find parent scope by correlation ID hierarchy
    const parentCorrelationId = extractParentId(this.correlationId);
    if (!parentCorrelationId) return null;

    return TransactionScope.activeScopes.find(scope =>
      scope.correlationId === parentCorrelationId
    ) || null;
  }

  private async finalize(committed: boolean): Promise<void> {
    this.isActive = false;

    // Remove from active scope stack
    const index = TransactionScope.activeScopes.indexOf(this);
    if (index >= 0) {
      TransactionScope.activeScopes.splice(index, 1);
    }

    const duration = this.getDuration();
    const status = committed ? 'committed' : 'rolled back';

    if (process.env.NODE_ENV === 'development') {
      devLogger.debug('Transaction scope finalized', {
        correlationId: this.correlationId,
        status,
        operationCount: this.operationCount,
        duration
      });
    }
  }

  private async performBridgeCommit(): Promise<void> {
    if (!this.transactionId) {
      throw new Error(`No transaction ID for commit: ${this.correlationId}`);
    }

    // Bridge communication will be handled by the useTransaction hook
    // This is a placeholder for the actual bridge integration
    const response = await this.sendTransactionMessage('commitTransaction', {
      transactionId: this.transactionId
    });

    if (!response.success) {
      throw new Error(`Transaction commit failed: ${response.error}`);
    }
  }

  private async performBridgeRollback(): Promise<void> {
    if (!this.transactionId) {
      // No transaction to rollback
      return;
    }

    // Bridge communication will be handled by the useTransaction hook
    const response = await this.sendTransactionMessage('rollbackTransaction', {
      transactionId: this.transactionId
    });

    if (!response.success) {
      devLogger.warn('Transaction rollback warning', {
        correlationId: this.correlationId,
        error: response.error
      });
    }
  }

  private async sendTransactionMessage(_method: string, _params: unknown): Promise<any> {
    // This will be integrated with the WebView bridge in Task 3
    // For now, return a mock successful response
    return { success: true };
  }
}

/**
 * Transaction scope factory for common patterns
 */
export const TransactionScopeFactory = {
  /**
   * Create scope for user-initiated transaction
   */
  forUserAction(actionName: string): TransactionScope {
    const correlationId = `tx_user_${actionName}_${Date.now()}`;
    return new TransactionScope(correlationId);
  },

  /**
   * Create scope for system-initiated transaction
   */
  forSystemAction(systemName: string): TransactionScope {
    const correlationId = `tx_system_${systemName}_${Date.now()}`;
    return new TransactionScope(correlationId);
  },

  /**
   * Create scope for batch operations
   */
  forBatch(batchName: string): TransactionScope {
    const correlationId = `tx_batch_${batchName}_${Date.now()}`;
    return new TransactionScope(correlationId);
  }
};

/**
 * Error types for transaction scope management
 */
export class TransactionScopeError extends Error {
  constructor(
    message: string,
    public correlationId: string,
    public transactionId?: string
  ) {
    super(message);
    this.name = 'TransactionScopeError';
  }
}

export class TransactionTimeoutError extends TransactionScopeError {
  constructor(correlationId: string, timeoutMs: number) {
    super(`Transaction timeout after ${timeoutMs}ms`, correlationId);
    this.name = 'TransactionTimeoutError';
  }
}

export class TransactionConflictError extends TransactionScopeError {
  constructor(correlationId: string, conflictReason: string) {
    super(`Transaction conflict: ${conflictReason}`, correlationId);
    this.name = 'TransactionConflictError';
  }
}