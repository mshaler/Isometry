/**
 * Change Notifier for WebView Bridge Real-Time Updates
 *
 * Manages WebView message subscriptions for live database notifications
 * with sequence tracking, event ordering verification, and correlation ID debugging.
 * Integrates with Phase 18 optimization infrastructure (BinarySerializer, MessageBatcher).
 */

import { BinarySerializer } from './binary-serializer';

export interface ChangeNotifierOptions {
  /** Enable binary decompression for MessagePack payloads */
  enableBinaryDecompression?: boolean;
  /** Debug mode for correlation tracking */
  enableDebugLogging?: boolean;
  /** Maximum subscription count before cleanup */
  maxSubscriptions?: number;
}

export interface LiveDataEvent {
  type: 'liveData';
  event: 'change' | 'error';
  sequenceNumber: number;
  timestamp: string;
  observationId: string;
  sql?: string;
  results?: unknown[];
  error?: string;
}

export interface SubscriptionInfo {
  id: string;
  sql: string;
  params: unknown[];
  onChange: (data: { sequenceNumber: number; results: unknown[]; observationId: string }) => void;
  onError: (data: { error: string; observationId: string }) => void;
  createdAt: Date;
  lastSequence: number;
  eventCount: number;
}

/**
 * ChangeNotifier manages live data subscriptions and event routing
 * Provides sequence number tracking and correlation ID debugging
 */
export class ChangeNotifier {
  private subscriptions = new Map<string, SubscriptionInfo>();
  private binarySerializer?: BinarySerializer;
  private options: Required<ChangeNotifierOptions>;

  // Sequence tracking for event ordering verification
  private globalSequence = 0;
  private outOfOrderCount = 0;

  // Performance metrics
  private eventCount = 0;
  private errorCount = 0;
  private startTime = Date.now();

  constructor(options: ChangeNotifierOptions = {}) {
    this.options = {
      enableBinaryDecompression: options.enableBinaryDecompression ?? true,
      enableDebugLogging: options.enableDebugLogging ?? false,
      maxSubscriptions: options.maxSubscriptions ?? 100
    };

    // Initialize BinarySerializer if binary decompression is enabled
    if (this.options.enableBinaryDecompression) {
      this.binarySerializer = new BinarySerializer();
    }

    // Set up global live data event handler
    this.setupGlobalEventHandler();

    if (this.options.enableDebugLogging) {
      console.log('[ChangeNotifier] Initialized with options:', this.options);
    }
  }

  /**
   * Subscribe to live data changes for a SQL query
   */
  subscribe(
    sql: string,
    params: unknown[],
    onChange: (data: { sequenceNumber: number; results: unknown[]; observationId: string }) => void,
    onError: (data: { error: string; observationId: string }) => void
  ): string {
    // Check subscription limits
    if (this.subscriptions.size >= this.options.maxSubscriptions) {
      this.cleanup();
    }

    const subscriptionId = this.generateSubscriptionId();

    const subscription: SubscriptionInfo = {
      id: subscriptionId,
      sql,
      params,
      onChange,
      onError,
      createdAt: new Date(),
      lastSequence: 0,
      eventCount: 0
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Start observation via WebView bridge
    this.startNativeObservation(subscriptionId, sql, params);

    if (this.options.enableDebugLogging) {
      console.log('[ChangeNotifier] Subscription created:', {
        id: subscriptionId,
        sql: sql.slice(0, 50),
        totalSubscriptions: this.subscriptions.size
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from live data changes
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn('[ChangeNotifier] Unsubscribe called for unknown subscription:', subscriptionId);
      return;
    }

    // Stop native observation
    this.stopNativeObservation(subscriptionId);

    this.subscriptions.delete(subscriptionId);

    if (this.options.enableDebugLogging) {
      console.log('[ChangeNotifier] Subscription removed:', {
        id: subscriptionId,
        eventCount: subscription.eventCount,
        duration: Date.now() - subscription.createdAt.getTime()
      });
    }
  }

  /**
   * Get subscription statistics for debugging
   */
  getStatistics() {
    const now = Date.now();
    const uptime = now - this.startTime;

    return {
      subscriptions: {
        active: this.subscriptions.size,
        max: this.options.maxSubscriptions
      },
      events: {
        total: this.eventCount,
        errors: this.errorCount,
        outOfOrder: this.outOfOrderCount,
        rate: this.eventCount / (uptime / 1000) // events per second
      },
      sequence: {
        current: this.globalSequence,
        outOfOrderPercentage: this.eventCount > 0 ? (this.outOfOrderCount / this.eventCount) * 100 : 0
      },
      performance: {
        uptime,
        averageEventsPerSubscription: this.subscriptions.size > 0 ? this.eventCount / this.subscriptions.size : 0
      }
    };
  }

  /**
   * Cleanup old subscriptions (called automatically when limit reached)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let removedCount = 0;

    for (const [id, subscription] of this.subscriptions.entries()) {
      const age = now - subscription.createdAt.getTime();
      if (age > maxAge) {
        this.unsubscribe(id);
        removedCount++;
      }
    }

    if (this.options.enableDebugLogging && removedCount > 0) {
      console.log('[ChangeNotifier] Cleaned up old subscriptions:', removedCount);
    }
  }

  // MARK: - Private Methods

  private setupGlobalEventHandler(): void {
    if (typeof window !== 'undefined' && window._isometryBridge) {
      // Extend bridge with live data event handler
      window._isometryBridge.handleLiveDataEvent = (event: LiveDataEvent) => {
        this.handleLiveDataEvent(event);
      };

      if (this.options.enableDebugLogging) {
        console.log('[ChangeNotifier] Global event handler registered');
      }
    } else {
      console.warn('[ChangeNotifier] WebView bridge not available - live data will not work');
    }
  }

  private handleLiveDataEvent(event: LiveDataEvent): void {
    this.eventCount++;

    // Verify event ordering
    if (event.sequenceNumber <= this.globalSequence) {
      this.outOfOrderCount++;

      if (this.options.enableDebugLogging) {
        console.warn('[ChangeNotifier] Out-of-order event detected:', {
          received: event.sequenceNumber,
          expected: this.globalSequence + 1,
          observationId: event.observationId
        });
      }
    }

    this.globalSequence = Math.max(this.globalSequence, event.sequenceNumber);

    // Route to appropriate subscription
    const subscription = this.findSubscriptionByObservationId(event.observationId);
    if (!subscription) {
      if (this.options.enableDebugLogging) {
        console.warn('[ChangeNotifier] Received event for unknown observation:', event.observationId);
      }
      return;
    }

    // Update subscription statistics
    subscription.lastSequence = event.sequenceNumber;
    subscription.eventCount++;

    // Handle different event types
    switch (event.event) {
      case 'change':
        this.handleChangeEvent(subscription, event);
        break;

      case 'error':
        this.handleErrorEvent(subscription, event);
        break;

      default:
        console.warn('[ChangeNotifier] Unknown event type:', event.event);
    }
  }

  private handleChangeEvent(subscription: SubscriptionInfo, event: LiveDataEvent): void {
    if (!event.results) {
      console.warn('[ChangeNotifier] Change event missing results:', event);
      return;
    }

    // Decompress binary data if needed
    let results = event.results;
    if (this.binarySerializer && this.isBinaryData(results)) {
      try {
        const decompressed = this.binarySerializer.deserialize(results as Uint8Array);
        results = decompressed.data as unknown[];
      } catch (error) {
        console.error('[ChangeNotifier] Failed to decompress binary data:', error);
        this.handleErrorEvent(subscription, {
          ...event,
          event: 'error',
          error: `Decompression failed: ${error}`
        });
        return;
      }
    }

    // Call subscription handler
    try {
      subscription.onChange({
        sequenceNumber: event.sequenceNumber,
        results,
        observationId: event.observationId
      });
    } catch (error) {
      console.error('[ChangeNotifier] Error in change handler:', error);
      this.errorCount++;
    }
  }

  private handleErrorEvent(subscription: SubscriptionInfo, event: LiveDataEvent): void {
    this.errorCount++;

    try {
      subscription.onError({
        error: event.error || 'Unknown error',
        observationId: event.observationId
      });
    } catch (error) {
      console.error('[ChangeNotifier] Error in error handler:', error);
    }
  }

  private findSubscriptionByObservationId(observationId: string): SubscriptionInfo | undefined {
    // For now, we'll use the subscription ID as the observation ID
    // In a more sophisticated implementation, we'd maintain a mapping
    return this.subscriptions.get(observationId);
  }

  private startNativeObservation(subscriptionId: string, sql: string, params: unknown[]): void {
    if (typeof window !== 'undefined' && window._isometryBridge) {
      // Send message to native bridge to start observation
      window._isometryBridge.sendMessage('database', 'startObservation', {
        observationId: subscriptionId,
        sql,
        params
      }).catch(error => {
        console.error('[ChangeNotifier] Failed to start native observation:', error);
        const subscription = this.subscriptions.get(subscriptionId);
        if (subscription) {
          subscription.onError({
            error: `Failed to start observation: ${error}`,
            observationId: subscriptionId
          });
        }
      });
    }
  }

  private stopNativeObservation(subscriptionId: string): void {
    if (typeof window !== 'undefined' && window._isometryBridge) {
      window._isometryBridge.sendMessage('database', 'stopObservation', {
        observationId: subscriptionId
      }).catch(error => {
        console.error('[ChangeNotifier] Failed to stop native observation:', error);
      });
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isBinaryData(data: unknown): data is Uint8Array {
    return data instanceof Uint8Array || (
      typeof data === 'object' &&
      data !== null &&
      'constructor' in data &&
      data.constructor.name === 'Uint8Array'
    );
  }
}

// Singleton instance for global use
export const changeNotifier = new ChangeNotifier({
  enableBinaryDecompression: true,
  enableDebugLogging: process.env.NODE_ENV === 'development'
});

// Extend global window interface for TypeScript
declare global {
  interface Window {
    _isometryBridge?: {
      sendMessage: (handler: string, method: string, params: Record<string, unknown>) => Promise<unknown>;
      handleLiveDataEvent?: (event: LiveDataEvent) => void;
    };
  }
}