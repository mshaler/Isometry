/**
 * Background Sync Queue with Exponential Backoff
 *
 * Provides reliable background synchronization with smart retry logic,
 * queue persistence, and integration with existing transaction infrastructure.
 * Enhanced with memory management integration for bridge callback cleanup.
 */

import { backOff } from 'exponential-backoff'
import { memoryManager } from '../utils/bridge-optimization/memory-manager'

/**
 * Types of sync operations
 */
export type SyncOperationType = 'node_create' | 'node_update' | 'node_delete' | 'edge_create' | 'edge_update' | 'edge_delete' | 'transaction' | 'batch'

/**
 * Priority levels for sync operations
 */
export type SyncPriority = 'immediate' | 'high' | 'normal' | 'low' | 'background'

/**
 * Operation representing a sync request
 */
export interface SyncOperation {
  id: string
  type: SyncOperationType
  priority: SyncPriority
  data: any
  correlationId?: string
  timestamp: number
  attempts: number
  lastAttempt?: number
  maxRetries?: number
  userInitiated: boolean
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  data?: any
  error?: string
  serverTimestamp?: number
  conflictData?: any
}

/**
 * Queue state and metrics
 */
export interface QueueState {
  pending: number
  processing: number
  failed: number
  completed: number
  totalProcessingTime: number
  averageRetryCount: number
  lastProcessedAt?: number
}

/**
 * Retry configuration following research best practices
 */
export interface RetryConfig {
  maxAttempts: number
  startingDelay: number
  timeMultiplier: number
  maxDelay: number
  jitter: 'full'
}

/**
 * Default retry configuration with optimized settings
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  startingDelay: 300, // 300ms
  timeMultiplier: 2,
  maxDelay: 30000, // 30s
  jitter: 'full'
}

/**
 * Background sync queue with exponential backoff and smart prioritization
 */
export class SyncQueue {
  private queue: SyncOperation[] = []
  private processing = false
  private processedOperations = new Map<string, SyncResult>()
  private retryConfig: RetryConfig
  private processor?: (operation: SyncOperation) => Promise<SyncResult>
  private listeners: Array<(state: QueueState) => void> = []
  private persistenceKey = 'isometry_sync_queue'
  private memoryPressureActive = false
  private maxQueueSizeUnderPressure = 50 // Limit queue size during memory pressure

  constructor(
    processor?: (operation: SyncOperation) => Promise<SyncResult>,
    retryConfig?: Partial<RetryConfig>
  ) {
    this.processor = processor
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig }
    this.loadPersistedQueue()

    // Set up memory pressure monitoring
    memoryManager.addMemoryPressureCallback((metrics, activeCallbacks) => {
      this.memoryPressureActive = metrics.pressureLevel === 'high'

      if (this.memoryPressureActive) {
        console.warn('[SyncQueue] Critical memory pressure detected:', {
          queueSize: this.queue.length,
          processing: this.processing,
          usage: `${metrics.usedJSHeapSize.toFixed(1)}MB`,
          activeCallbacks: Array.isArray(activeCallbacks) ? activeCallbacks.length : activeCallbacks
        })

        // Trigger queue cleanup during memory pressure
        this.cleanupQueueForMemoryPressure()
      }
    })

    // Start processing queue automatically
    if (this.processor) {
      this.startProcessing()
    }
  }

  /**
   * Add operation to sync queue with smart prioritization and memory-aware operation queuing
   */
  enqueue(operation: Omit<SyncOperation, 'id' | 'timestamp' | 'attempts'>): string {
    // Memory-aware operation queuing - respect memory pressure thresholds
    if (this.memoryPressureActive) {
      // During memory pressure, only allow immediate and high priority operations
      if (operation.priority !== 'immediate' && operation.priority !== 'high' && !operation.userInitiated) {
        console.warn('[SyncQueue] Rejecting low priority operation during memory pressure:', {
          type: operation.type,
          priority: operation.priority,
          queueSize: this.queue.length
        })

        // Return a placeholder ID but don't actually queue
        return 'rejected-memory-pressure'
      }

      // Limit queue size under memory pressure
      if (this.queue.length >= this.maxQueueSizeUnderPressure) {
        console.warn('[SyncQueue] Queue size limit reached under memory pressure, dropping oldest low-priority operation')
        this.dropOldestLowPriorityOperation()
      }
    }

    const syncOp: SyncOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      attempts: 0,
      ...operation
    }

    // Register operation with memory manager for bridge callback cleanup tracking
    if (operation.correlationId) {
      memoryManager.registerBridgeCallback({
        id: `sync_${syncOp.id}`,
        cleanup: () => {
          // Cleanup function - remove from queue if it's still pending
          const index = this.queue.findIndex(op => op.id === syncOp.id)
          if (index >= 0) {
            this.queue.splice(index, 1)
            this.persistQueue()
            this.notifyStateChange()
          }
        }
      })
    }

    // Insert based on priority (immediate and user-initiated operations first)
    if (operation.priority === 'immediate' || operation.userInitiated) {
      this.queue.unshift(syncOp)
    } else {
      // Find insertion point based on priority
      const insertIndex = this.findInsertionIndex(operation.priority)
      this.queue.splice(insertIndex, 0, syncOp)
    }

    this.persistQueue()
    this.notifyStateChange()

    // Start processing if not already running
    if (!this.processing && this.processor) {
      this.startProcessing()
    }

    return syncOp.id
  }

  /**
   * Find appropriate insertion index for priority-based queuing
   */
  private findInsertionIndex(priority: SyncPriority): number {
    const priorityOrder: Record<SyncPriority, number> = {
      immediate: 0,
      high: 1,
      normal: 2,
      low: 3,
      background: 4
    }

    const targetPriority = priorityOrder[priority]

    for (let i = 0; i < this.queue.length; i++) {
      const queuedPriority = priorityOrder[this.queue[i].priority]
      if (queuedPriority > targetPriority) {
        return i
      }
    }

    return this.queue.length
  }

  /**
   * Set the operation processor
   */
  setProcessor(processor: (operation: SyncOperation) => Promise<SyncResult>): void {
    this.processor = processor
    if (!this.processing && this.queue.length > 0) {
      this.startProcessing()
    }
  }

  /**
   * Start processing queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing || !this.processor) return

    this.processing = true

    while (this.queue.length > 0) {
      const operation = this.queue.shift()!

      try {
        const result = await this.processSyncOperation(operation)

        if (result.success) {
          this.processedOperations.set(operation.id, result)
        } else {
          // Re-queue for retry if not exceeded max attempts
          if (operation.attempts < (operation.maxRetries || this.retryConfig.maxAttempts)) {
            operation.attempts++
            operation.lastAttempt = Date.now()

            // Re-insert with lower priority to avoid blocking other operations
            const retryPriority = operation.priority === 'immediate' ? 'high' :
                                  operation.priority === 'high' ? 'normal' : 'low'
            operation.priority = retryPriority

            this.queue.push(operation)
          } else {
            // Max retries exceeded, move to failed
            this.processedOperations.set(operation.id, {
              success: false,
              error: `Max retries (${operation.attempts}) exceeded: ${result.error}`
            })
          }
        }
      } catch (error) {
        // Unexpected error during processing
        this.processedOperations.set(operation.id, {
          success: false,
          error: `Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }

      this.persistQueue()
      this.notifyStateChange()

      // Small delay between operations to prevent overwhelming
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    this.processing = false
  }

  /**
   * Process a single sync operation with exponential backoff
   */
  private async processSyncOperation(operation: SyncOperation): Promise<SyncResult> {
    if (!this.processor) {
      throw new Error('No processor configured for sync queue')
    }

    return backOff(
      async () => {
        const result = await this.processor!(operation)

        if (!result.success && result.error) {
          throw new Error(result.error)
        }

        return result
      },
      {
        numOfAttempts: 1, // We handle retries at queue level
        startingDelay: this.calculateDelay(operation.attempts),
        timeMultiple: this.retryConfig.timeMultiplier,
        maxDelay: this.retryConfig.maxDelay,
        jitter: this.retryConfig.jitter,
        retry: (error: any, _attemptNumber: number) => {
          // Don't retry for client errors (4xx)
          if (error?.status >= 400 && error?.status < 500) {
            return false
          }

          // Retry for network/server errors
          return true
        }
      }
    )
  }

  /**
   * Calculate delay for retry based on attempt count
   */
  private calculateDelay(attempts: number): number {
    const delay = this.retryConfig.startingDelay * Math.pow(this.retryConfig.timeMultiplier, attempts)
    return Math.min(delay, this.retryConfig.maxDelay)
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    const completed = Array.from(this.processedOperations.values()).filter(r => r.success).length
    const failed = Array.from(this.processedOperations.values()).filter(r => !r.success).length
    const totalRetries = this.queue.reduce((sum, op) => sum + op.attempts, 0)

    return {
      pending: this.queue.length,
      processing: this.processing ? 1 : 0,
      failed,
      completed,
      totalProcessingTime: 0, // TODO: Track actual processing times
      averageRetryCount: this.queue.length > 0 ? totalRetries / this.queue.length : 0,
      lastProcessedAt: this.queue.length === 0 && !this.processing ? Date.now() : undefined
    }
  }

  /**
   * Get result for a specific operation
   */
  getResult(operationId: string): SyncResult | undefined {
    return this.processedOperations.get(operationId)
  }

  /**
   * Clear completed operations to free memory
   */
  clearCompleted(): void {
    const failedOperations = new Map<string, SyncResult>()

    for (const [id, result] of this.processedOperations.entries()) {
      if (!result.success) {
        failedOperations.set(id, result)
      }
    }

    this.processedOperations = failedOperations
    this.persistQueue()
    this.notifyStateChange()
  }

  /**
   * Priority queue manipulation - promote operation priority
   */
  promoteOperation(operationId: string): boolean {
    const index = this.queue.findIndex(op => op.id === operationId)
    if (index === -1) return false

    const operation = this.queue[index]

    // Promote priority
    if (operation.priority === 'background') operation.priority = 'low'
    else if (operation.priority === 'low') operation.priority = 'normal'
    else if (operation.priority === 'normal') operation.priority = 'high'
    else if (operation.priority === 'high') operation.priority = 'immediate'

    // Re-sort queue
    this.queue.splice(index, 1)
    const newIndex = this.findInsertionIndex(operation.priority)
    this.queue.splice(newIndex, 0, operation)

    this.persistQueue()
    this.notifyStateChange()
    return true
  }

  /**
   * Listen for queue state changes
   */
  onStateChange(listener: (state: QueueState) => void): () => void {
    this.listeners.push(listener)

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index >= 0) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyStateChange(): void {
    const state = this.getState()
    this.listeners.forEach(listener => {
      try {
        listener(state)
      } catch (error) {
        console.error('Error in sync queue state listener:', error)
      }
    })
  }

  /**
   * Persist queue to localStorage for offline scenarios
   */
  private persistQueue(): void {
    try {
      const persistData = {
        queue: this.queue,
        processed: Array.from(this.processedOperations.entries())
      }
      localStorage.setItem(this.persistenceKey, JSON.stringify(persistData))
    } catch (error) {
      console.warn('Failed to persist sync queue:', error)
    }
  }

  /**
   * Load persisted queue from localStorage
   */
  private loadPersistedQueue(): void {
    try {
      const persistedData = localStorage.getItem(this.persistenceKey)
      if (persistedData) {
        const { queue, processed } = JSON.parse(persistedData)
        this.queue = queue || []
        this.processedOperations = new Map(processed || [])
      }
    } catch (error) {
      console.warn('Failed to load persisted sync queue:', error)
      this.queue = []
      this.processedOperations = new Map()
    }
  }

  /**
   * Clear all queue data
   */
  clear(): void {
    this.queue = []
    this.processedOperations.clear()
    this.persistQueue()
    this.notifyStateChange()
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.processing = false
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (!this.processing && this.processor && this.queue.length > 0) {
      this.startProcessing()
    }
  }

  /**
   * Get queue metrics for monitoring
   */
  getMetrics(): {
    queueLength: number
    processingTime: number
    successRate: number
    averageRetries: number
    priorityBreakdown: Record<SyncPriority, number>
  } {
    const priorityBreakdown: Record<SyncPriority, number> = {
      immediate: 0,
      high: 0,
      normal: 0,
      low: 0,
      background: 0
    }

    this.queue.forEach(op => {
      priorityBreakdown[op.priority]++
    })

    const results = Array.from(this.processedOperations.values())
    const successful = results.filter(r => r.success).length
    const successRate = results.length > 0 ? (successful / results.length) * 100 : 100

    const totalRetries = this.queue.reduce((sum, op) => sum + op.attempts, 0)
    const averageRetries = this.queue.length > 0 ? totalRetries / this.queue.length : 0

    return {
      queueLength: this.queue.length,
      processingTime: 0, // TODO: Implement actual processing time tracking
      successRate,
      averageRetries,
      priorityBreakdown
    }
  }

  /**
   * Cleanup queue for memory pressure scenarios
   * Removes low-priority and old operations to free memory
   */
  private cleanupQueueForMemoryPressure(): void {
    const originalSize = this.queue.length

    // Remove operations older than 5 minutes that aren't immediate or high priority
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    this.queue = this.queue.filter(op => {
      if (op.priority === 'immediate' || op.priority === 'high' || op.userInitiated) {
        return true // Keep high priority operations
      }
      return op.timestamp > fiveMinutesAgo
    })

    // If still too large, remove oldest low/normal priority operations
    if (this.queue.length > this.maxQueueSizeUnderPressure) {
      const lowPriorityOps = this.queue.filter(op =>
        op.priority === 'low' || op.priority === 'normal' || op.priority === 'background'
      ).sort((a, b) => a.timestamp - b.timestamp) // Oldest first

      const toRemove = Math.min(lowPriorityOps.length, this.queue.length - this.maxQueueSizeUnderPressure)

      for (let i = 0; i < toRemove; i++) {
        const opToRemove = lowPriorityOps[i]
        const index = this.queue.findIndex(op => op.id === opToRemove.id)
        if (index >= 0) {
          this.queue.splice(index, 1)
        }
      }
    }

    const cleanedCount = originalSize - this.queue.length
    if (cleanedCount > 0) {
      console.log(`[SyncQueue] Cleaned ${cleanedCount} operations during memory pressure (${originalSize} → ${this.queue.length})`)
      this.persistQueue()
      this.notifyStateChange()
    }
  }

  /**
   * Drop oldest low-priority operation to make room for new operations
   */
  private dropOldestLowPriorityOperation(): void {
    // Find oldest operation that is not immediate/high priority
    let oldestIndex = -1
    let oldestTimestamp = Date.now()

    for (let i = 0; i < this.queue.length; i++) {
      const op = this.queue[i]
      if (op.priority !== 'immediate' && op.priority !== 'high' && !op.userInitiated) {
        if (op.timestamp < oldestTimestamp) {
          oldestTimestamp = op.timestamp
          oldestIndex = i
        }
      }
    }

    if (oldestIndex >= 0) {
      const dropped = this.queue.splice(oldestIndex, 1)[0]
      console.log(`[SyncQueue] Dropped operation due to memory pressure: ${dropped.type} (${dropped.priority})`)
      this.persistQueue()
      this.notifyStateChange()
    }
  }

  /**
   * Queue cleanup methods for memory pressure scenarios
   * These methods are called during memory pressure to free up resources
   */
  cleanupForMemoryPressure(): number {
    const originalSize = this.queue.length
    this.cleanupQueueForMemoryPressure()

    // Also trigger bridge callback cleanup for any operations with correlation IDs
    memoryManager.cleanupBridgeCallbacks()

    return originalSize - this.queue.length
  }
}

/**
 * Singleton sync queue instance
 */
let globalSyncQueue: SyncQueue | null = null

/**
 * Get or create the global sync queue instance
 */
export function getSyncQueue(): SyncQueue {
  if (!globalSyncQueue) {
    globalSyncQueue = new SyncQueue()
  }
  return globalSyncQueue
}

/**
 * Initialize sync queue with processor
 */
export function initializeSyncQueue(
  processor: (operation: SyncOperation) => Promise<SyncResult>,
  retryConfig?: Partial<RetryConfig>
): SyncQueue {
  globalSyncQueue = new SyncQueue(processor, retryConfig)
  return globalSyncQueue
}