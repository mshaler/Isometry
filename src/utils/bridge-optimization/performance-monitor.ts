/**
 * Performance Monitor for Bridge Optimization
 *
 * Collects real-time metrics from all optimization components:
 * - MessageBatcher: latency, queue size, throughput
 * - BinarySerializer: compression ratios, payload efficiency
 * - QueryPaginator: page counts, response sizes
 * - CircuitBreaker: failure rates, state transitions
 *
 * Provides metrics aggregation with rolling windows, percentile calculations,
 * and alert thresholds for performance monitoring dashboard.
 */

export interface BridgeMetrics {
  // Message Batching Metrics
  batchLatency: {
    current: number; // Current batch latency (ms)
    average: number; // Rolling average (ms)
    p95: number;     // 95th percentile (ms)
    target: number;  // Target <16ms for 60fps
  };

  batchEfficiency: {
    queueSize: number;    // Current queue size
    messagesPerBatch: number; // Average messages per batch
    batchRate: number;    // Batches per second
    maxQueueSize: number; // Queue size limit
  };

  // Serialization Metrics
  serialization: {
    compressionRatio: number; // Compression vs JSON baseline (%)
    payloadSizeBefore: number; // Pre-compression size (bytes)
    payloadSizeAfter: number;  // Post-compression size (bytes)
    serializationTime: number; // Time to serialize (ms)
  };

  // Query Pagination Metrics
  pagination: {
    pageCount: number;      // Number of pages processed
    recordsPerPage: number; // Average records per page
    pageResponseTime: number; // Average page response time (ms)
    cursorCacheHitRate: number; // Cursor cache efficiency (%)
  };

  // Circuit Breaker Metrics
  reliability: {
    failureRate: number;    // Current failure rate (%)
    successRate: number;    // Current success rate (%)
    state: 'closed' | 'open' | 'half-open'; // Circuit breaker state
    stateTransitions: number; // Number of state changes
    lastFailureTime?: number; // Timestamp of last failure
  };

  // System Health Indicators
  health: {
    overallScore: number;   // 0-100 health score
    alerts: BridgeAlert[];  // Active performance alerts
    timestamp: number;      // Metrics collection timestamp
  };
}

export interface BridgeAlert {
  id: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  category: 'latency' | 'compression' | 'reliability' | 'capacity';
}

export interface MetricsCollectionOptions {
  rollingWindowSize?: number;  // Number of samples for rolling averages (default: 100)
  alertThresholds?: AlertThresholds;
  sampleInterval?: number;     // Metrics collection interval (ms, default: 1000)
  enablePersistence?: boolean; // Persist metrics to localStorage (default: true)
}

export interface AlertThresholds {
  latency: {
    warning: number;  // Latency warning threshold (ms, default: 12)
    critical: number; // Latency critical threshold (ms, default: 16)
  };
  compression: {
    warning: number;  // Compression ratio warning (%, default: 30)
    critical: number; // Compression ratio critical (%, default: 20)
  };
  failureRate: {
    warning: number;  // Failure rate warning (%, default: 5)
    critical: number; // Failure rate critical (%, default: 10)
  };
  queueSize: {
    warning: number;  // Queue size warning (% of max, default: 70)
    critical: number; // Queue size critical (% of max, default: 90)
  };
}

interface MetricsSample {
  timestamp: number;
  latency: number;
  compressionRatio: number;
  failureCount: number;
  successCount: number;
  queueSize: number;
  payloadSize: number;
  responseTime: number;
}

/**
 * Performance Monitor for Bridge Operations
 *
 * Collects comprehensive metrics from all optimization components and provides
 * real-time performance insights with alerting capabilities.
 */
export class PerformanceMonitor {
  private metrics: BridgeMetrics;
  private samples: MetricsSample[] = [];
  private alerts: Map<string, BridgeAlert> = new Map();
  private options: Required<MetricsCollectionOptions>;
  private isCollecting = false;
  private collectionInterval: NodeJS.Timeout | null = null;

  // Component references for metrics collection
  private messageBatcher?: any;
  private binarySerializer?: any;
  private queryPaginator?: any;
  private circuitBreaker?: any;

  constructor(options: MetricsCollectionOptions = {}) {
    // Default options
    this.options = {
      rollingWindowSize: options.rollingWindowSize ?? 100,
      sampleInterval: options.sampleInterval ?? 1000,
      enablePersistence: options.enablePersistence ?? true,
      alertThresholds: {
        latency: {
          warning: options.alertThresholds?.latency?.warning ?? 12,
          critical: options.alertThresholds?.latency?.critical ?? 16
        },
        compression: {
          warning: options.alertThresholds?.compression?.warning ?? 30,
          critical: options.alertThresholds?.compression?.critical ?? 20
        },
        failureRate: {
          warning: options.alertThresholds?.failureRate?.warning ?? 5,
          critical: options.alertThresholds?.failureRate?.critical ?? 10
        },
        queueSize: {
          warning: options.alertThresholds?.queueSize?.warning ?? 70,
          critical: options.alertThresholds?.queueSize?.critical ?? 90
        }
      }
    };

    // Initialize metrics with default values
    this.metrics = this.createDefaultMetrics();

    // Load persisted metrics if enabled
    if (this.options.enablePersistence) {
      this.loadPersistedMetrics();
    }
  }

  /**
   * Initialize metrics collection with component references
   */
  public init(components: {
    messageBatcher?: any;
    binarySerializer?: any;
    queryPaginator?: any;
    circuitBreaker?: any;
  }): void {
    this.messageBatcher = components.messageBatcher;
    this.binarySerializer = components.binarySerializer;
    this.queryPaginator = components.queryPaginator;
    this.circuitBreaker = components.circuitBreaker;

    console.log('[PerformanceMonitor] Initialized with components:', Object.keys(components));
  }

  /**
   * Start continuous metrics collection
   */
  public startCollection(): void {
    if (this.isCollecting) {
      console.warn('[PerformanceMonitor] Collection already started');
      return;
    }

    this.isCollecting = true;
    this.collectionInterval = setInterval(() => {
      this.collectSample();
    }, this.options.sampleInterval);

    console.log('[PerformanceMonitor] Started metrics collection');
  }

  /**
   * Stop metrics collection
   */
  public stopCollection(): void {
    if (!this.isCollecting) {
      return;
    }

    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
    }

    console.log('[PerformanceMonitor] Stopped metrics collection');
  }

  /**
   * Get current bridge metrics
   */
  public getMetrics(): BridgeMetrics {
    return { ...this.metrics }; // Return copy to prevent mutations
  }

  /**
   * Get active alerts
   */
  public getAlerts(): BridgeAlert[] {
    const alerts: BridgeAlert[] = [];
    this.alerts.forEach(alert => alerts.push(alert));
    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Clear acknowledged alerts
   */
  public clearAcknowledgedAlerts(): void {
    const toDelete: string[] = [];
    this.alerts.forEach((alert, id) => {
      if (alert.acknowledged) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.alerts.delete(id));
  }

  /**
   * Record bridge operation performance metrics
   */
  public recordBridgeOperation(metrics: {
    latency?: number;
    success?: boolean;
    payloadSize?: number;
    compressionRatio?: number;
    queueSize?: number;
    operation?: string;
  }): void {
    const now = performance.now();

    // Create sample from recorded metrics
    const sample: MetricsSample = {
      timestamp: now,
      latency: metrics.latency ?? 0,
      compressionRatio: metrics.compressionRatio ?? 0,
      failureCount: metrics.success === false ? 1 : 0,
      successCount: metrics.success === true ? 1 : 0,
      queueSize: metrics.queueSize ?? 0,
      payloadSize: metrics.payloadSize ?? 0,
      responseTime: metrics.latency ?? 0
    };

    this.addSample(sample);
    this.updateMetrics();
    this.checkAlerts();

    // Log significant performance events
    if (metrics.latency && metrics.latency > this.options.alertThresholds.latency.warning) {
      console.warn(`[PerformanceMonitor] High latency detected: ${metrics.latency}ms for ${metrics.operation || 'unknown operation'}`);
    }
  }

  /**
   * Get performance trends over time
   */
  public getTrends(timeRangeMs: number = 60000): {
    latencyTrend: number[];
    compressionTrend: number[];
    failureRateTrend: number[];
    timestamps: number[];
  } {
    const cutoff = performance.now() - timeRangeMs;
    const recentSamples = this.samples.filter(s => s.timestamp >= cutoff);

    return {
      latencyTrend: recentSamples.map(s => s.latency),
      compressionTrend: recentSamples.map(s => s.compressionRatio),
      failureRateTrend: recentSamples.map(s => {
        const total = s.successCount + s.failureCount;
        return total > 0 ? (s.failureCount / total) * 100 : 0;
      }),
      timestamps: recentSamples.map(s => s.timestamp)
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  public exportMetrics(): {
    current: BridgeMetrics;
    samples: MetricsSample[];
    alerts: BridgeAlert[];
    collectionInfo: {
      isCollecting: boolean;
      sampleCount: number;
      timeRange: string;
      configuration: MetricsCollectionOptions;
    };
  } {
    const oldestSample = this.samples.length > 0 ? this.samples[0].timestamp : 0;
    const newestSample = this.samples.length > 0 ? this.samples[this.samples.length - 1].timestamp : 0;
    const timeRangeMs = newestSample - oldestSample;

    return {
      current: this.getMetrics(),
      samples: [...this.samples],
      alerts: this.getAlerts(),
      collectionInfo: {
        isCollecting: this.isCollecting,
        sampleCount: this.samples.length,
        timeRange: `${(timeRangeMs / 1000).toFixed(1)}s`,
        configuration: this.options
      }
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Collect a metrics sample from all components
   */
  private collectSample(): void {
    const now = performance.now();
    const sample: MetricsSample = {
      timestamp: now,
      latency: this.collectLatencyMetric(),
      compressionRatio: this.collectCompressionMetric(),
      failureCount: this.collectFailureCount(),
      successCount: this.collectSuccessCount(),
      queueSize: this.collectQueueSize(),
      payloadSize: this.collectPayloadSize(),
      responseTime: this.collectResponseTime()
    };

    this.addSample(sample);
    this.updateMetrics();
    this.checkAlerts();

    // Persist if enabled
    if (this.options.enablePersistence) {
      this.persistMetrics();
    }
  }

  /**
   * Add sample and maintain rolling window
   */
  private addSample(sample: MetricsSample): void {
    this.samples.push(sample);

    // Maintain rolling window
    while (this.samples.length > this.options.rollingWindowSize) {
      this.samples.shift();
    }
  }

  /**
   * Update aggregate metrics from samples
   */
  private updateMetrics(): void {
    if (this.samples.length === 0) {
      return;
    }

    const recent = this.samples.slice(-10); // Last 10 samples
    const all = this.samples;

    // Update batch latency metrics
    const latencies = all.map(s => s.latency).filter(l => l > 0);
    this.metrics.batchLatency = {
      current: recent[recent.length - 1]?.latency ?? 0,
      average: this.calculateAverage(latencies),
      p95: this.calculatePercentile(latencies, 95),
      target: 16 // Target <16ms for 60fps
    };

    // Update compression metrics
    const compressionRatios = all.map(s => s.compressionRatio).filter(c => c > 0);
    const payloadSizes = all.map(s => s.payloadSize).filter(p => p > 0);
    this.metrics.serialization = {
      compressionRatio: this.calculateAverage(compressionRatios),
      payloadSizeBefore: this.calculateAverage(payloadSizes),
      payloadSizeAfter: this.calculateAverage(payloadSizes.map((size, i) =>
        size * (1 - (compressionRatios[i] || 0) / 100)
      )),
      serializationTime: this.collectSerializationTime()
    };

    // Update reliability metrics
    const recentFailures = recent.map(s => s.failureCount).reduce((a, b) => a + b, 0);
    const recentSuccesses = recent.map(s => s.successCount).reduce((a, b) => a + b, 0);
    const recentTotal = recentFailures + recentSuccesses;

    this.metrics.reliability = {
      failureRate: recentTotal > 0 ? (recentFailures / recentTotal) * 100 : 0,
      successRate: recentTotal > 0 ? (recentSuccesses / recentTotal) * 100 : 100,
      state: this.getCircuitBreakerState(),
      stateTransitions: this.getStateTransitions(),
      lastFailureTime: this.getLastFailureTime()
    };

    // Update batch efficiency metrics
    this.metrics.batchEfficiency = {
      queueSize: recent[recent.length - 1]?.queueSize ?? 0,
      messagesPerBatch: this.calculateMessagesPerBatch(),
      batchRate: this.calculateBatchRate(),
      maxQueueSize: this.getMaxQueueSize()
    };

    // Update pagination metrics
    this.metrics.pagination = {
      pageCount: this.getPageCount(),
      recordsPerPage: this.getRecordsPerPage(),
      pageResponseTime: this.calculateAverage(all.map(s => s.responseTime).filter(r => r > 0)),
      cursorCacheHitRate: this.getCursorCacheHitRate()
    };

    // Update health score and timestamp
    this.metrics.health = {
      overallScore: this.calculateHealthScore(),
      alerts: this.getAlerts(),
      timestamp: performance.now()
    };
  }

  /**
   * Check for alert conditions and create/update alerts
   */
  private checkAlerts(): void {
    const thresholds = this.options.alertThresholds;

    // Check latency alerts
    this.checkLatencyAlerts(thresholds.latency);

    // Check compression alerts
    this.checkCompressionAlerts(thresholds.compression);

    // Check failure rate alerts
    this.checkFailureRateAlerts(thresholds.failureRate);

    // Check queue size alerts
    this.checkQueueSizeAlerts(thresholds.queueSize);
  }

  private checkLatencyAlerts(thresholds: { warning: number; critical: number }): void {
    const current = this.metrics.batchLatency.current;
    const alertId = 'latency-threshold';

    if (current >= thresholds.critical) {
      this.addAlert({
        id: alertId,
        severity: 'critical',
        title: 'Critical Bridge Latency',
        message: `Bridge latency (${current.toFixed(1)}ms) exceeds critical threshold (${thresholds.critical}ms)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'latency'
      });
    } else if (current >= thresholds.warning) {
      this.addAlert({
        id: alertId,
        severity: 'warning',
        title: 'High Bridge Latency',
        message: `Bridge latency (${current.toFixed(1)}ms) exceeds warning threshold (${thresholds.warning}ms)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'latency'
      });
    } else {
      this.clearAlert(alertId);
    }
  }

  private checkCompressionAlerts(thresholds: { warning: number; critical: number }): void {
    const current = this.metrics.serialization.compressionRatio;
    const alertId = 'compression-efficiency';

    if (current <= thresholds.critical) {
      this.addAlert({
        id: alertId,
        severity: 'critical',
        title: 'Poor Compression Efficiency',
        message: `Compression ratio (${current.toFixed(1)}%) below critical threshold (${thresholds.critical}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'compression'
      });
    } else if (current <= thresholds.warning) {
      this.addAlert({
        id: alertId,
        severity: 'warning',
        title: 'Low Compression Efficiency',
        message: `Compression ratio (${current.toFixed(1)}%) below warning threshold (${thresholds.warning}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'compression'
      });
    } else {
      this.clearAlert(alertId);
    }
  }

  private checkFailureRateAlerts(thresholds: { warning: number; critical: number }): void {
    const current = this.metrics.reliability.failureRate;
    const alertId = 'failure-rate';

    if (current >= thresholds.critical) {
      this.addAlert({
        id: alertId,
        severity: 'critical',
        title: 'High Failure Rate',
        message: `Bridge failure rate (${current.toFixed(1)}%) exceeds critical threshold (${thresholds.critical}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'reliability'
      });
    } else if (current >= thresholds.warning) {
      this.addAlert({
        id: alertId,
        severity: 'warning',
        title: 'Elevated Failure Rate',
        message: `Bridge failure rate (${current.toFixed(1)}%) exceeds warning threshold (${thresholds.warning}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'reliability'
      });
    } else {
      this.clearAlert(alertId);
    }
  }

  private checkQueueSizeAlerts(thresholds: { warning: number; critical: number }): void {
    const current = this.metrics.batchEfficiency.queueSize;
    const max = this.metrics.batchEfficiency.maxQueueSize;
    const percentage = max > 0 ? (current / max) * 100 : 0;
    const alertId = 'queue-capacity';

    if (percentage >= thresholds.critical) {
      this.addAlert({
        id: alertId,
        severity: 'critical',
        title: 'Queue Near Capacity',
        message: `Message queue (${current}/${max}, ${percentage.toFixed(1)}%) near critical capacity (${thresholds.critical}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'capacity'
      });
    } else if (percentage >= thresholds.warning) {
      this.addAlert({
        id: alertId,
        severity: 'warning',
        title: 'High Queue Usage',
        message: `Message queue (${current}/${max}, ${percentage.toFixed(1)}%) above warning threshold (${thresholds.warning}%)`,
        timestamp: Date.now(),
        acknowledged: false,
        category: 'capacity'
      });
    } else {
      this.clearAlert(alertId);
    }
  }

  private addAlert(alert: BridgeAlert): void {
    this.alerts.set(alert.id, alert);
  }

  private clearAlert(alertId: string): void {
    this.alerts.delete(alertId);
  }

  // Component metric collection methods
  private collectLatencyMetric(): number {
    return this.messageBatcher?.getMetrics?.()?.averageLatency ?? 0;
  }

  private collectCompressionMetric(): number {
    return this.binarySerializer?.getMetrics?.()?.compressionRatio ?? 0;
  }

  private collectFailureCount(): number {
    return this.circuitBreaker?.getMetrics?.()?.failureCount ?? 0;
  }

  private collectSuccessCount(): number {
    return this.circuitBreaker?.getMetrics?.()?.successCount ?? 0;
  }

  private collectQueueSize(): number {
    return this.messageBatcher?.getQueueSize?.() ?? 0;
  }

  private collectPayloadSize(): number {
    return this.binarySerializer?.getMetrics?.()?.averagePayloadSize ?? 0;
  }

  private collectResponseTime(): number {
    return this.queryPaginator?.getMetrics?.()?.averageResponseTime ?? 0;
  }

  private collectSerializationTime(): number {
    return this.binarySerializer?.getMetrics?.()?.serializationTime ?? 0;
  }

  private getCircuitBreakerState(): 'closed' | 'open' | 'half-open' {
    return this.circuitBreaker?.getState?.() ?? 'closed';
  }

  private getStateTransitions(): number {
    return this.circuitBreaker?.getMetrics?.()?.stateTransitions ?? 0;
  }

  private getLastFailureTime(): number | undefined {
    return this.circuitBreaker?.getMetrics?.()?.lastFailureTime;
  }

  private calculateMessagesPerBatch(): number {
    return this.messageBatcher?.getMetrics?.()?.averageBatchSize ?? 0;
  }

  private calculateBatchRate(): number {
    return this.messageBatcher?.getMetrics?.()?.batchesPerSecond ?? 0;
  }

  private getMaxQueueSize(): number {
    return this.messageBatcher?.getQueueLimit?.() ?? 1000;
  }

  private getPageCount(): number {
    return this.queryPaginator?.getMetrics?.()?.totalPages ?? 0;
  }

  private getRecordsPerPage(): number {
    return this.queryPaginator?.getMetrics?.()?.averageRecordsPerPage ?? 50;
  }

  private getCursorCacheHitRate(): number {
    return this.queryPaginator?.getMetrics?.()?.cacheHitRate ?? 0;
  }

  // Utility methods
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }

  private calculateHealthScore(): number {
    // Health score based on multiple factors (0-100)
    let score = 100;

    // Latency impact
    const latency = this.metrics.batchLatency.current;
    if (latency > 16) score -= Math.min(30, (latency - 16) * 2);

    // Failure rate impact
    const failureRate = this.metrics.reliability.failureRate;
    score -= Math.min(40, failureRate * 4);

    // Compression efficiency impact
    const compression = this.metrics.serialization.compressionRatio;
    if (compression < 40) score -= Math.min(20, (40 - compression) * 0.5);

    // Queue capacity impact
    const queueUsage = this.metrics.batchEfficiency.maxQueueSize > 0 ?
      (this.metrics.batchEfficiency.queueSize / this.metrics.batchEfficiency.maxQueueSize) * 100 : 0;
    if (queueUsage > 70) score -= Math.min(10, (queueUsage - 70) * 0.3);

    return Math.max(0, Math.round(score));
  }

  private createDefaultMetrics(): BridgeMetrics {
    return {
      batchLatency: {
        current: 0,
        average: 0,
        p95: 0,
        target: 16
      },
      batchEfficiency: {
        queueSize: 0,
        messagesPerBatch: 0,
        batchRate: 0,
        maxQueueSize: 1000
      },
      serialization: {
        compressionRatio: 0,
        payloadSizeBefore: 0,
        payloadSizeAfter: 0,
        serializationTime: 0
      },
      pagination: {
        pageCount: 0,
        recordsPerPage: 50,
        pageResponseTime: 0,
        cursorCacheHitRate: 0
      },
      reliability: {
        failureRate: 0,
        successRate: 100,
        state: 'closed',
        stateTransitions: 0
      },
      health: {
        overallScore: 100,
        alerts: [],
        timestamp: performance.now()
      }
    };
  }

  private persistMetrics(): void {
    try {
      const data = {
        metrics: this.metrics,
        samples: this.samples.slice(-50), // Keep last 50 samples
        alerts: this.getAlerts()
      };
      localStorage.setItem('isometry-bridge-metrics', JSON.stringify(data));
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to persist metrics:', error);
    }
  }

  private loadPersistedMetrics(): void {
    try {
      const stored = localStorage.getItem('isometry-bridge-metrics');
      if (stored) {
        const data = JSON.parse(stored);
        if (data.metrics) {
          this.metrics = { ...this.metrics, ...data.metrics };
        }
        if (Array.isArray(data.samples)) {
          this.samples = data.samples;
        }
        if (Array.isArray(data.alerts)) {
          this.alerts.clear();
          data.alerts.forEach((alert: BridgeAlert) => {
            this.alerts.set(alert.id, alert);
          });
        }
        console.log('[PerformanceMonitor] Loaded persisted metrics');
      }
    } catch (error) {
      console.warn('[PerformanceMonitor] Failed to load persisted metrics:', error);
    }
  }
}