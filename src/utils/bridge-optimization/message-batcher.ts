/**
 * Message Batcher for WebView Bridge Optimization
 *
 * Implements 16ms batching intervals for 60fps UI responsiveness with queue management,
 * backpressure handling, and Promise-based async operations for seamless integration
 * with existing webview-bridge.ts infrastructure.
 */

export interface BatchMessage {
  id: string;
  handler: string;
  method: string;
  params: Record<string, unknown>;
  timestamp: number;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export interface BatchOptions {
  maxBatchSize?: number;
  maxQueueSize?: number;
  batchInterval?: number;
  enableBackpressure?: boolean;
}

export interface BatchMetrics {
  queueSize: number;
  batchesSent: number;
  messagesProcessed: number;
  averageBatchSize: number;
  lastBatchTime: number | null;
  isBackpressured: boolean;
  droppedMessages: number;
}

/**
 * MessageBatcher collects WebView bridge messages and sends them in batches
 * every 16ms to maintain 60fps UI responsiveness
 */
export class MessageBatcher {
  private queue: BatchMessage[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly maxBatchSize: number;
  private readonly maxQueueSize: number;
  private readonly batchInterval: number;
  private readonly enableBackpressure: boolean;

  // Metrics tracking
  private batchesSent = 0;
  private messagesProcessed = 0;
  private droppedMessages = 0;
  private lastBatchTime: number | null = null;

  // Backpressure state
  private isBackpressured = false;

  // Send function - injected to allow testing and integration
  private sendBatchFunction: (batch: BatchMessage[]) => Promise<void>;

  constructor(
    sendBatch: (batch: BatchMessage[]) => Promise<void>,
    options: BatchOptions = {}
  ) {
    this.sendBatchFunction = sendBatch;
    this.maxBatchSize = options.maxBatchSize ?? 100;
    this.maxQueueSize = options.maxQueueSize ?? 1000;
    this.batchInterval = options.batchInterval ?? 16; // 16ms for 60fps
    this.enableBackpressure = options.enableBackpressure ?? true;
  }

  /**
   * Queue a message for batched delivery
   * Returns a Promise that resolves when the message is processed
   */
  queueMessage(
    id: string,
    handler: string,
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      // Check for backpressure
      if (this.enableBackpressure && this.queue.length >= this.maxQueueSize) {
        this.handleQueueOverflow();
        reject(new Error(`Message queue overflow (${this.maxQueueSize} messages). Message dropped due to backpressure.`));
        return;
      }

      const message: BatchMessage = {
        id,
        handler,
        method,
        params,
        timestamp: performance.now(),
        resolve,
        reject
      };

      this.queue.push(message);

      // Start batch timer if not already running
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => this.flushBatch(), this.batchInterval);
      }

      // Immediate flush if batch is full
      if (this.queue.length >= this.maxBatchSize) {
        this.flushBatch();
      }
    });
  }

  /**
   * Immediately flush all queued messages
   */
  async flushBatch(): Promise<void> {
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Nothing to flush
    if (this.queue.length === 0) {
      return;
    }

    // Extract batch from queue
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.lastBatchTime = performance.now();

    try {
      // Send batch to bridge
      await this.sendBatchFunction(batch);

      // Update metrics
      this.batchesSent++;
      this.messagesProcessed += batch.length;
      this.isBackpressured = false;

      // Note: Individual message responses will be handled by the bridge response handler
      // The batch sending itself is successful, but individual message results
      // will be resolved via the normal bridge response mechanism

    } catch (error) {
      // Batch send failed - reject all messages in this batch
      const batchError = error instanceof Error ? error : new Error(`Batch send failed: ${error}`);

      batch.forEach(message => {
        message.reject(new Error(`Batch send failed for message ${message.id}: ${batchError.message}`));
      });

      throw batchError;
    }

    // If there are more messages queued, schedule next batch
    if (this.queue.length > 0) {
      this.batchTimer = setTimeout(() => this.flushBatch(), this.batchInterval);
    }
  }

  /**
   * Handle queue overflow with backpressure
   */
  private handleQueueOverflow(): void {
    // Drop oldest messages to make room
    const dropCount = Math.floor(this.maxQueueSize * 0.1); // Drop 10% of oldest messages
    const droppedMessages = this.queue.splice(0, dropCount);

    // Reject dropped messages
    droppedMessages.forEach(message => {
      message.reject(new Error(`Message ${message.id} dropped due to queue overflow`));
    });

    this.droppedMessages += dropCount;
    this.isBackpressured = true;

    if (process.env.NODE_ENV === 'development') {
      console.warn(`[MessageBatcher] Queue overflow: dropped ${dropCount} messages. Queue size: ${this.queue.length}`);
    }
  }

  /**
   * Get current batcher metrics
   */
  getMetrics(): BatchMetrics {
    const averageBatchSize = this.batchesSent > 0 ?
      Math.round(this.messagesProcessed / this.batchesSent) : 0;

    return {
      queueSize: this.queue.length,
      batchesSent: this.batchesSent,
      messagesProcessed: this.messagesProcessed,
      averageBatchSize,
      lastBatchTime: this.lastBatchTime,
      isBackpressured: this.isBackpressured,
      droppedMessages: this.droppedMessages
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.batchesSent = 0;
    this.messagesProcessed = 0;
    this.droppedMessages = 0;
    this.lastBatchTime = null;
    this.isBackpressured = false;
  }

  /**
   * Get current queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if batcher is currently processing
   */
  isActive(): boolean {
    return this.batchTimer !== null || this.queue.length > 0;
  }

  /**
   * Clear all pending messages (useful for cleanup)
   */
  clear(): void {
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    // Reject all pending messages
    this.queue.forEach(message => {
      message.reject(new Error(`Message ${message.id} cancelled during batcher cleanup`));
    });

    // Clear queue
    this.queue = [];
    this.isBackpressured = false;
  }

  /**
   * Graceful shutdown - flush remaining messages then clear
   */
  async shutdown(): Promise<void> {
    try {
      // Flush any remaining messages
      if (this.queue.length > 0) {
        await this.flushBatch();
      }
    } finally {
      this.clear();
    }
  }
}