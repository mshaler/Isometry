import { getWebViewBridge } from '../webview-bridge';
// Bridge elimination - Legacy correlation IDs disabled
// import { generateCorrelationId } from './correlation-ids';

/**
 * Result of rollback operation from native side
 */
export interface RollbackResult {
  transactionId: string;
  success: boolean;
  rollbackDuration: number; // milliseconds
  preservedDraftId?: string;
  operationsRolledBack: number;
  error?: string;
}

/**
 * Information about preserved draft data
 */
export interface DraftInfo {
  draftId: string;
  originalTransactionId: string;
  operationCount: number;
  createdAt: Date;
  expiresAt: Date;
  summary: string; // User-friendly description
}

/**
 * Recovery result after draft resubmission
 */
export interface RecoveryResult {
  success: boolean;
  newTransactionId?: string;
  operationsRecovered: number;
  error?: string;
}

/**
 * Configuration for rollback notification display
 */
export interface NotificationConfig {
  duration?: number; // milliseconds, default 5000
  type?: 'info' | 'warning' | 'error'; // default 'info'
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * React-side rollback coordination with state cleanup and user notifications
 *
 * Provides client rollback API that coordinates with native RollbackManager
 * for comprehensive transaction rollback with draft preservation and recovery.
 * Includes toast notification system and draft state management UI.
 */
export class RollbackManager {
  private static instance: RollbackManager | null = null;

  // Active rollback operations
  private rollbacksInProgress = new Set<string>();

  // Available drafts for recovery
  private availableDrafts = new Map<string, DraftInfo>();

  // Event listeners for UI updates
  private listeners = {
    rollbackComplete: new Set<(result: RollbackResult) => void>(),
    draftAvailable: new Set<(draft: DraftInfo) => void>(),
    recoveryComplete: new Set<(result: RecoveryResult) => void>(),
  };

  private constructor() {
    this.loadAvailableDrafts();
  }

  /**
   * Singleton instance for centralized rollback coordination
   */
  public static getInstance(): RollbackManager {
    if (!RollbackManager.instance) {
      RollbackManager.instance = new RollbackManager();
    }
    return RollbackManager.instance;
  }

  /**
   * Rolls back a transaction with optional draft preservation
   * Returns Promise that resolves with rollback result including timing metrics
   */
  public async rollbackTransaction(
    correlationId: string,
    preserveDrafts: boolean = true
  ): Promise<RollbackResult> {
    if (this.rollbacksInProgress.has(correlationId)) {
      throw new Error(`Rollback already in progress for ${correlationId}`);
    }

    this.rollbacksInProgress.add(correlationId);

    try {
      // Timing metrics - preserved for future performance analysis
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _startTime = Date.now();
      void _startTime; // Explicitly mark as preserved

      const bridge = getWebViewBridge();
      const result = await bridge.sendMessage('transaction', 'rollback', {
        transactionId: correlationId,
        preserveDrafts,
      }) as RollbackResult;

      // Convert duration from seconds to milliseconds for consistency
      const resultWithMs = {
        ...result,
        rollbackDuration: result.rollbackDuration * 1000,
      };

      // Update available drafts if new draft was created
      if (result.preservedDraftId) {
        await this.loadAvailableDrafts();
      }

      // Notify listeners
      this.listeners.rollbackComplete.forEach(listener => listener(resultWithMs));

      // Show user notification
      this.handleRollbackNotification(resultWithMs);

      return resultWithMs;

    } finally {
      this.rollbacksInProgress.delete(correlationId);
    }
  }

  /**
   * Shows appropriate user feedback for rollback events
   * Provides clear explanatory messages about what was rolled back and why
   */
  public handleRollbackNotification(result: RollbackResult): void {
    const config: NotificationConfig = {
      duration: 5000,
      type: result.success ? 'info' : 'error',
    };

    if (result.success) {
      const operationText = result.operationsRolledBack === 1
        ? 'operation'
        : 'operations';

      let message = `Rolled back ${result.operationsRolledBack} ${operationText}`;

      if (result.rollbackDuration > 50) {
        message += ` (took ${Math.round(result.rollbackDuration)}ms)`;
      }

      if (result.preservedDraftId) {
        message += '. Valid changes saved as draft.';
        config.action = {
          label: 'View Drafts',
          onClick: () => this.showDraftRecoveryUI(),
        };
      }

      this.showToast(message, config);
    } else {
      this.showToast(
        `Failed to rollback transaction: ${result.error || 'Unknown error'}`,
        config
      );
    }
  }

  /**
   * Recovers data from preserved drafts with user review workflow
   * Returns Promise with recovery result and new transaction ID
   */
  public async recoverFromDrafts(draftIds: string[]): Promise<RecoveryResult> {
    const drafts = draftIds
      .map(id => this.availableDrafts.get(id))
      .filter(draft => draft !== undefined);

    if (drafts.length === 0) {
      throw new Error('No valid drafts found for recovery');
    }

    // Operation count - preserved for future batch analysis
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _totalOperations = drafts.reduce((sum, draft) => sum + draft.operationCount, 0);
    void _totalOperations; // Explicitly mark as preserved

    try {
      const bridge = getWebViewBridge();
      const result = await bridge.sendMessage('transaction', 'recoverFromDrafts', {
        draftIds,
      }) as RecoveryResult;

      // Remove recovered drafts from local tracking
      if (result.success) {
        draftIds.forEach(id => this.availableDrafts.delete(id));
      }

      // Notify listeners
      this.listeners.recoveryComplete.forEach(listener => listener(result));

      // Show success/error notification
      if (result.success) {
        this.showToast(
          `Recovered ${result.operationsRecovered} operations from ${draftIds.length} draft(s)`,
          { type: 'info' }
        );
      } else {
        this.showToast(
          `Failed to recover drafts: ${result.error || 'Unknown error'}`,
          { type: 'error' }
        );
      }

      return result;

    } catch (error) {
      const errorResult: RecoveryResult = {
        success: false,
        operationsRecovered: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      this.listeners.recoveryComplete.forEach(listener => listener(errorResult));
      return errorResult;
    }
  }

  /**
   * Gets all available drafts for user review
   */
  public getAvailableDrafts(): DraftInfo[] {
    return Array.from(this.availableDrafts.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Gets specific draft by ID
   */
  public getDraft(draftId: string): DraftInfo | undefined {
    return this.availableDrafts.get(draftId);
  }

  /**
   * Removes draft after manual deletion or successful recovery
   */
  public async removeDraft(draftId: string): Promise<void> {
    try {
      const bridge = getWebViewBridge();
      await bridge.sendMessage('transaction', 'removeDraft', { draftId });

      this.availableDrafts.delete(draftId);
    } catch (error) {
      console.error('Failed to remove draft:', error);
      throw error;
    }
  }

  /**
   * Event listeners for UI updates
   */
  public onRollbackComplete(listener: (result: RollbackResult) => void): () => void {
    this.listeners.rollbackComplete.add(listener);
    return () => this.listeners.rollbackComplete.delete(listener);
  }

  public onDraftAvailable(listener: (draft: DraftInfo) => void): () => void {
    this.listeners.draftAvailable.add(listener);
    return () => this.listeners.draftAvailable.delete(listener);
  }

  public onRecoveryComplete(listener: (result: RecoveryResult) => void): () => void {
    this.listeners.recoveryComplete.add(listener);
    return () => this.listeners.recoveryComplete.delete(listener);
  }

  /**
   * Loads available drafts from native side
   */
  private async loadAvailableDrafts(): Promise<void> {
    try {
      const bridge = getWebViewBridge();
      const drafts = await bridge.sendMessage('transaction', 'getAvailableDrafts', {}) as DraftInfo[];

      // Update local cache
      this.availableDrafts.clear();
      drafts.forEach(draft => {
        // Convert date strings to Date objects
        const draftWithDates = {
          ...draft,
          createdAt: new Date(draft.createdAt),
          expiresAt: new Date(draft.expiresAt),
        };
        this.availableDrafts.set(draft.draftId, draftWithDates);

        // Notify about new drafts
        this.listeners.draftAvailable.forEach(listener => listener(draftWithDates));
      });

    } catch (error) {
      console.error('Failed to load available drafts:', error);
    }
  }

  /**
   * Shows toast notification with rollback information
   */
  private showToast(message: string, config: NotificationConfig = {}): void {
    // Integration point with existing toast notification system
    // This would typically use a React context or notification library

    const event = new CustomEvent('rollback-notification', {
      detail: {
        message,
        duration: config.duration || 5000,
        type: config.type || 'info',
        action: config.action,
      },
    });

    window.dispatchEvent(event);

    // Also log for development/debugging
    const logLevel = config.type === 'error' ? 'error' : 'info';
    console[logLevel]('RollbackManager:', message);
  }

  /**
   * Shows draft recovery UI (placeholder for actual implementation)
   */
  private showDraftRecoveryUI(): void {
    // This would open a modal or navigate to draft recovery interface
    const event = new CustomEvent('show-draft-recovery', {
      detail: { drafts: this.getAvailableDrafts() },
    });
    window.dispatchEvent(event);
  }

  /**
   * Gets rollback performance metrics for monitoring
   */
  public async getRollbackMetrics(): Promise<Record<string, number>> {
    try {
      const bridge = getWebViewBridge();
      return await bridge.sendMessage('transaction', 'getRollbackMetrics', {}) as Record<string, number>;
    } catch (error) {
      console.error('Failed to get rollback metrics:', error);
      return {};
    }
  }
}

/**
 * Default singleton instance for easy imports
 */
export const rollbackManager = RollbackManager.getInstance();

/**
 * Convenience function for direct rollback calls
 */
export const rollbackTransaction = (
  correlationId: string,
  preserveDrafts?: boolean
): Promise<RollbackResult> => {
  return rollbackManager.rollbackTransaction(correlationId, preserveDrafts);
};

/**
 * Convenience function for draft preservation
 */
export const preserveDrafts = rollbackManager.recoverFromDrafts.bind(rollbackManager);