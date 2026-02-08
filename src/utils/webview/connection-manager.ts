/**
 * Connection Manager for WebView Bridge Connectivity
 *
 * Monitors bridge connectivity using heartbeat messages, handles online/offline
 * state transitions, implements reconnection logic with exponential backoff,
 * and integrates with Circuit Breaker from Phase 18 for reliability.
 *
 * Provides connection quality monitoring and adaptive behavior based on
 * network conditions and bridge performance metrics.
 */

// Bridge eliminated in v4 - sql.js direct access
// import { PerformanceMonitor } from './bridge-optimization/performance-monitor';
// import { webViewBridge } from './webview/webview-bridge';

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting' | 'syncing' | 'degraded' | 'error';

export interface ConnectionQuality {
  latency: number; // Average response time in ms
  packetLoss: number; // Packet loss percentage
  stability: number; // Stability score (0-100)
  throughput: number; // Messages per second
  reliability: number; // Success rate percentage
}

export interface ConnectionMetrics {
  state: ConnectionState;
  quality: ConnectionQuality;
  uptime: number; // Connection uptime in ms
  lastHeartbeat: number; // Last heartbeat timestamp
  reconnectionAttempts: number;
  totalFailures: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
}

export interface ConnectionManagerOptions {
  /** Heartbeat interval in milliseconds */
  heartbeatInterval?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Maximum reconnection attempts */
  maxReconnectionAttempts?: number;
  /** Initial reconnection delay in milliseconds */
  initialReconnectionDelay?: number;
  /** Maximum reconnection delay in milliseconds */
  maxReconnectionDelay?: number;
  /** Enable adaptive behavior based on connection quality */
  enableAdaptiveBehavior?: boolean;
  /** Quality thresholds for connection degradation detection */
  qualityThresholds?: {
    latency: { warning: number; critical: number };
    packetLoss: { warning: number; critical: number };
    stability: { warning: number; critical: number };
  };
}

export interface QueuedOperation {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

/**
 * Connection Manager for Bridge Connectivity and Offline Support
 */
export class ConnectionManager {
  private state: ConnectionState = 'disconnected';
  private metrics: ConnectionMetrics;
  private options: Required<ConnectionManagerOptions>;

  // Connection monitoring
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionStartTime: number = 0;
  private lastHeartbeatTime: number = 0;
  private reconnectionTimer: NodeJS.Timeout | null = null;
  private reconnectionAttempts: number = 0;

  // Quality tracking
  private latencyHistory: number[] = [];
  private responseTimeHistory: { timestamp: number; latency: number; success: boolean }[] = [];
  private maxHistorySize = 100;

  // Offline operation queue
  private operationQueue: QueuedOperation[] = [];
  private queueProcessor: NodeJS.Timeout | null = null;
  private maxQueueSize = 1000;

  // Listeners
  private stateChangeListeners: ((state: ConnectionState, metrics: ConnectionMetrics) => void)[] = [];
  private qualityChangeListeners: ((quality: ConnectionQuality) => void)[] = [];

  // Circuit breaker integration
  private circuitBreakerRegistry: any; // From Phase 18 infrastructure

  constructor(options: ConnectionManagerOptions = {}) {
    this.options = {
      heartbeatInterval: options.heartbeatInterval ?? 5000,
      connectionTimeout: options.connectionTimeout ?? 10000,
      maxReconnectionAttempts: options.maxReconnectionAttempts ?? 10,
      initialReconnectionDelay: options.initialReconnectionDelay ?? 2000,
      maxReconnectionDelay: options.maxReconnectionDelay ?? 30000,
      enableAdaptiveBehavior: options.enableAdaptiveBehavior ?? true,
      qualityThresholds: {
        latency: { warning: 500, critical: 2000 },
        packetLoss: { warning: 5, critical: 15 },
        stability: { warning: 85, critical: 70 },
        ...options.qualityThresholds
      }
    };

    this.metrics = this.createDefaultMetrics();
    this.initializeCircuitBreaker();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Start connection monitoring
   */
  public start(): void {
    console.log('[ConnectionManager] Starting connection monitoring');

    this.connectionStartTime = Date.now();
    this.testConnection()
      .then(() => this.startHeartbeat())
      .catch(() => this.attemptReconnection());
  }

  /**
   * Stop connection monitoring
   */
  public stop(): void {
    console.log('[ConnectionManager] Stopping connection monitoring');

    this.stopHeartbeat();
    this.stopReconnection();
    this.stopQueueProcessor();
    this.setState('disconnected');
  }

  /**
   * Test connection manually
   */
  public async testConnection(): Promise<boolean> {
    const startTime = performance.now();

    try {
      // Use circuit breaker for connection testing
      // Circuit breaker result - preserved for future error handling
       
      const _result = await this.executeWithCircuitBreaker(async () => {
        // Bridge eliminated - sql.js direct access means always connected
        // const health = webViewBridge.getHealthStatus();
        // if (!health.isConnected) {
        //   throw new Error('Bridge not connected');
        // }

        // Perform a simple database ping - sql.js direct access
        // await webViewBridge.database.execute('SELECT 1', []);
        return true;
      }, 'connection-test');
      void _result; // Explicitly mark as preserved

      const latency = performance.now() - startTime;
      this.recordConnectionAttempt(true, latency);

      if (this.state !== 'connected') {
        this.onConnectionRestored();
      }

      return true;

    } catch (error) {
      const latency = performance.now() - startTime;
      this.recordConnectionAttempt(false, latency);

      console.warn('[ConnectionManager] Connection test failed:', error);

      if (this.state === 'connected') {
        this.onConnectionLost();
      }

      return false;
    }
  }

  /**
   * Get current connection state
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get current connection metrics
   */
  public getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Get connection quality assessment
   */
  public getQuality(): ConnectionQuality {
    return { ...this.metrics.quality };
  }

  /**
   * Force reconnection
   */
  public async forceReconnection(): Promise<boolean> {
    console.log('[ConnectionManager] Forcing reconnection');

    this.stopHeartbeat();
    this.setState('reconnecting');
    this.reconnectionAttempts = 0;

    return this.attemptReconnection();
  }

  /**
   * Queue operation for offline execution
   */
  public queueOperation(operation: Omit<QueuedOperation, 'id' | 'timestamp' | 'retryCount'>): string {
    if (this.operationQueue.length >= this.maxQueueSize) {
      // Remove oldest low-priority operation to make space
      const lowPriorityIndex = this.operationQueue.findIndex(op => op.priority === 'low');
      if (lowPriorityIndex >= 0) {
        this.operationQueue.splice(lowPriorityIndex, 1);
      } else {
        throw new Error('Operation queue is full');
      }
    }

    const queuedOp: QueuedOperation = {
      ...operation,
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Insert based on priority
    const insertIndex = this.findInsertIndex(queuedOp.priority);
    this.operationQueue.splice(insertIndex, 0, queuedOp);

    console.log('[ConnectionManager] Queued operation:', {
      id: queuedOp.id,
      type: queuedOp.type,
      priority: queuedOp.priority,
      queueLength: this.operationQueue.length
    });

    // Start queue processor if connected
    if (this.state === 'connected' && !this.queueProcessor) {
      this.startQueueProcessor();
    }

    return queuedOp.id;
  }

  /**
   * Remove operation from queue
   */
  public removeFromQueue(operationId: string): boolean {
    const index = this.operationQueue.findIndex(op => op.id === operationId);
    if (index >= 0) {
      this.operationQueue.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get queue status
   */
  public getQueueStatus(): {
    count: number;
    byPriority: Record<QueuedOperation['priority'], number>;
    oldestTimestamp: number | null;
  } {
    const byPriority = {
      low: 0,
      normal: 0,
      high: 0,
      critical: 0
    };

    let oldestTimestamp: number | null = null;

    for (const op of this.operationQueue) {
      byPriority[op.priority]++;
      if (!oldestTimestamp || op.timestamp < oldestTimestamp) {
        oldestTimestamp = op.timestamp;
      }
    }

    return {
      count: this.operationQueue.length,
      byPriority,
      oldestTimestamp
    };
  }

  /**
   * Add state change listener
   */
  public onStateChange(listener: (state: ConnectionState, metrics: ConnectionMetrics) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Add quality change listener
   */
  public onQualityChange(listener: (quality: ConnectionQuality) => void): void {
    this.qualityChangeListeners.push(listener);
  }

  /**
   * Remove all listeners
   */
  public removeAllListeners(): void {
    this.stateChangeListeners = [];
    this.qualityChangeListeners = [];
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Integration with Phase 18 Circuit Breaker
    if (this.circuitBreakerRegistry) {
      const result = await this.circuitBreakerRegistry.execute(
        `bridge-${operationName}`,
        operation,
        {
          failureThreshold: 3,
          timeoutPeriod: this.options.connectionTimeout / 1000,
          halfOpenMaxCalls: 2
        }
      );

      if (!result.success) {
        throw result.error || new Error('Circuit breaker rejected operation');
      }

      return result.result!;
    }

    // Fallback without circuit breaker
    return operation();
  }

  private async initializeCircuitBreaker(): Promise<void> {
    // Bridge elimination - Circuit breaker removed with native bridge
    console.warn('[ConnectionManager] Circuit breaker not available in sql.js architecture');
    // try {
    //   // Dynamic import to avoid circular dependencies
    //   const { defaultCircuitBreakerRegistry } = await import(
    //     '../../native/Sources/Isometry/Bridge/Reliability/CircuitBreaker.swift'
    //   );
    //   this.circuitBreakerRegistry = defaultCircuitBreakerRegistry;
    // } catch (error) {
    //   console.warn('[ConnectionManager] Circuit breaker not available, continuing without protection');
    // }
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      const previousState = this.state;
      this.state = newState;

      this.updateMetrics();

      console.log('[ConnectionManager] State transition:', {
        from: previousState,
        to: newState,
        timestamp: new Date().toISOString()
      });

      // Notify listeners
      this.stateChangeListeners.forEach(listener => {
        listener(newState, this.metrics);
      });
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.performHeartbeat();
    }, this.options.heartbeatInterval);

    // Perform immediate heartbeat
    this.performHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async performHeartbeat(): Promise<void> {
    const success = await this.testConnection();

    if (success) {
      this.lastHeartbeatTime = Date.now();
      if (this.state !== 'connected') {
        this.setState('connected');
      }
    } else {
      if (this.state === 'connected') {
        this.onConnectionLost();
      }
    }
  }

  private async attemptReconnection(): Promise<boolean> {
    if (this.reconnectionAttempts >= this.options.maxReconnectionAttempts) {
      console.error('[ConnectionManager] Max reconnection attempts reached');
      this.setState('error');
      return false;
    }

    this.setState('reconnecting');
    this.reconnectionAttempts++;

    console.log('[ConnectionManager] Reconnection attempt', this.reconnectionAttempts);

    const success = await this.testConnection();

    if (success) {
      this.onConnectionRestored();
      return true;
    }

    // Schedule next attempt with exponential backoff
    const delay = Math.min(
      this.options.initialReconnectionDelay * Math.pow(2, this.reconnectionAttempts - 1),
      this.options.maxReconnectionDelay
    );

    this.reconnectionTimer = setTimeout(() => {
      this.attemptReconnection();
    }, delay);

    return false;
  }

  private stopReconnection(): void {
    if (this.reconnectionTimer) {
      clearTimeout(this.reconnectionTimer);
      this.reconnectionTimer = null;
    }
  }

  private onConnectionRestored(): void {
    console.log('[ConnectionManager] Connection restored');

    this.setState('connected');
    this.reconnectionAttempts = 0;
    this.connectionStartTime = Date.now();

    this.startHeartbeat();
    this.startQueueProcessor();
  }

  private onConnectionLost(): void {
    console.log('[ConnectionManager] Connection lost');

    this.setState('disconnected');
    this.stopHeartbeat();
    this.stopQueueProcessor();

    // Start reconnection attempts
    this.attemptReconnection();
  }

  private recordConnectionAttempt(success: boolean, latency: number): void {
    const now = Date.now();

    // Record response time
    this.responseTimeHistory.push({
      timestamp: now,
      latency,
      success
    });

    // Maintain history size
    if (this.responseTimeHistory.length > this.maxHistorySize) {
      this.responseTimeHistory.shift();
    }

    if (success) {
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.maxHistorySize) {
        this.latencyHistory.shift();
      }
    }

    this.updateMetrics();
    this.checkQualityThresholds();

    // Report to performance monitor (Bridge elimination - TODO: Remove)
    // if (performanceMonitor) {
    //   performanceMonitor.recordBridgeOperation({
    //     latency,
    //     success,
    //     operation: 'connection-test'
    //   });
    // }
  }

  private updateMetrics(): void {
    const now = Date.now();

    this.metrics = {
      state: this.state,
      quality: this.calculateConnectionQuality(),
      uptime: this.state === 'connected' ? now - this.connectionStartTime : 0,
      lastHeartbeat: this.lastHeartbeatTime,
      reconnectionAttempts: this.reconnectionAttempts,
      totalFailures: this.responseTimeHistory.filter(r => !r.success).length,
      circuitBreakerState: this.getCircuitBreakerState()
    };
  }

  private calculateConnectionQuality(): ConnectionQuality {
    if (this.responseTimeHistory.length === 0) {
      return {
        latency: 0,
        packetLoss: 0,
        stability: 100,
        throughput: 0,
        reliability: 100
      };
    }

    const recentHistory = this.responseTimeHistory.slice(-50); // Last 50 attempts
    const successfulAttempts = recentHistory.filter(r => r.success);
    const failedAttempts = recentHistory.filter(r => !r.success);

    const latency = successfulAttempts.length > 0 ?
      successfulAttempts.reduce((sum, r) => sum + r.latency, 0) / successfulAttempts.length : 0;

    const packetLoss = (failedAttempts.length / recentHistory.length) * 100;

    const reliability = (successfulAttempts.length / recentHistory.length) * 100;

    // Stability based on variance in response times
    const stability = this.calculateStability();

    // Throughput estimation based on successful operations
    const throughput = this.calculateThroughput();

    return {
      latency,
      packetLoss,
      stability,
      throughput,
      reliability
    };
  }

  private calculateStability(): number {
    if (this.latencyHistory.length < 10) return 100;

    const mean = this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;
    const variance = this.latencyHistory.reduce((sum, l) => sum + Math.pow(l - mean, 2), 0)
      / this.latencyHistory.length;
    const coefficient = Math.sqrt(variance) / mean;

    // Convert coefficient of variation to stability score (0-100)
    return Math.max(0, 100 - (coefficient * 100));
  }

  private calculateThroughput(): number {
    const recentWindow = 10000; // 10 seconds
    const now = Date.now();
    const recentAttempts = this.responseTimeHistory.filter(r =>
      r.success && (now - r.timestamp) <= recentWindow
    );

    return recentAttempts.length / (recentWindow / 1000); // Messages per second
  }

  private checkQualityThresholds(): void {
    const quality = this.metrics.quality;
    const thresholds = this.options.qualityThresholds;

    // Check if we should transition to degraded state
    const isDegraded = quality.latency > thresholds.latency.warning ||
                      quality.packetLoss > thresholds.packetLoss.warning ||
                      quality.stability < thresholds.stability.warning;

    if (isDegraded && this.state === 'connected') {
      this.setState('degraded');
    } else if (!isDegraded && this.state === 'degraded') {
      this.setState('connected');
    }

    // Notify quality listeners
    this.qualityChangeListeners.forEach(listener => {
      listener(quality);
    });
  }

  private getCircuitBreakerState(): 'closed' | 'open' | 'half-open' {
    // Would integrate with actual circuit breaker state
    return 'closed';
  }

  private startQueueProcessor(): void {
    if (this.queueProcessor || this.operationQueue.length === 0) {
      return;
    }

    this.setState('syncing');

    this.queueProcessor = setInterval(async () => {
      await this.processQueuedOperations();
    }, 100); // Process every 100ms
  }

  private stopQueueProcessor(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }
  }

  private async processQueuedOperations(): Promise<void> {
    if (this.operationQueue.length === 0) {
      this.stopQueueProcessor();
      if (this.state === 'syncing') {
        this.setState('connected');
      }
      return;
    }

    // Process highest priority operations first
    const operation = this.operationQueue[0];

    try {
      // Execute the operation (implementation depends on operation type)
      await this.executeQueuedOperation(operation);

      // Remove successful operation from queue
      this.operationQueue.shift();

      console.log('[ConnectionManager] Processed queued operation:', {
        id: operation.id,
        type: operation.type,
        remaining: this.operationQueue.length
      });

    } catch (error) {
      console.warn('[ConnectionManager] Queued operation failed:', error);

      operation.retryCount++;

      if (operation.retryCount >= operation.maxRetries) {
        // Remove failed operation after max retries
        this.operationQueue.shift();
        console.error('[ConnectionManager] Dropped operation after max retries:', operation.id);
      }
      // Otherwise, operation stays in queue for retry
    }
  }

  private async executeQueuedOperation(operation: QueuedOperation): Promise<void> {
    // Implementation would depend on specific operation types
    // This is a placeholder for the actual operation execution logic
    switch (operation.type) {
      case 'database-query':
        // Bridge eliminated - sql.js direct access
        // await webViewBridge.database.execute(operation.data.sql, operation.data.params);
        console.log('[ConnectionManager] Database operation queued for sql.js:', operation.data);
        return;
      case 'live-query-subscribe':
        // Handle live query subscription
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }
  }

  private findInsertIndex(priority: QueuedOperation['priority']): number {
    const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
    const targetPriority = priorityOrder[priority];

    for (let i = 0; i < this.operationQueue.length; i++) {
      const currentPriority = priorityOrder[this.operationQueue[i].priority];
      if (currentPriority > targetPriority) {
        return i;
      }
    }

    return this.operationQueue.length;
  }

  private createDefaultMetrics(): ConnectionMetrics {
    return {
      state: 'disconnected',
      quality: {
        latency: 0,
        packetLoss: 0,
        stability: 100,
        throughput: 0,
        reliability: 100
      },
      uptime: 0,
      lastHeartbeat: 0,
      reconnectionAttempts: 0,
      totalFailures: 0,
      circuitBreakerState: 'closed'
    };
  }
}

// ============================================================================
// Global Connection Manager Instance
// ============================================================================

let globalConnectionManager: ConnectionManager | null = null;

export function getConnectionManager(options?: ConnectionManagerOptions): ConnectionManager {
  if (!globalConnectionManager) {
    globalConnectionManager = new ConnectionManager(options);
  }
  return globalConnectionManager;
}

export function startConnectionMonitoring(options?: ConnectionManagerOptions): void {
  const manager = getConnectionManager(options);
  manager.start();
}

export function stopConnectionMonitoring(): void {
  if (globalConnectionManager) {
    globalConnectionManager.stop();
    globalConnectionManager = null;
  }
}