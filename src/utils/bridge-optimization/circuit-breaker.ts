/**
 * Circuit Breaker for WebView Bridge Reliability
 *
 * Implements configurable failure thresholds, timeout periods, and half-open state management
 * with automatic state transitions and Promise-based execute() method that wraps bridge operations.
 * Integrates with MessageBatcher for optimized transport and failure recovery.
 */

export enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open'
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  timeoutPeriod?: number;
  halfOpenMaxCalls?: number;
  resetTimeout?: number;
  enableMetrics?: boolean;
  execute?: <T>(operation: () => Promise<T>) => Promise<T>;
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  circuitOpenTime: number | null;
  averageResponseTime: number;
  failureRate: number;
  successRate: number;
}

export interface ExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: Error;
  executionTime: number;
  state: CircuitState;
  timestamp: number;
}

/**
 * CircuitBreaker prevents cascade failures with automatic state transitions
 * and configurable retry logic for bridge reliability
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private totalCalls = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private circuitOpenTime: number | null = null;
  private halfOpenCalls = 0;

  // Configuration
  private readonly failureThreshold: number;
  private readonly timeoutPeriod: number;
  private readonly halfOpenMaxCalls: number;
  private readonly resetTimeout: number;
  private readonly enableMetrics: boolean;

  // Performance tracking
  private responseTimes: number[] = [];
  private readonly maxResponseTimeHistory = 100;

  // Listeners for state changes
  private stateChangeListeners: Array<(state: CircuitState, metrics: CircuitBreakerMetrics) => void> = [];

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.timeoutPeriod = options.timeoutPeriod ?? 60000; // 60 seconds
    this.halfOpenMaxCalls = options.halfOpenMaxCalls ?? 3;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30 seconds
    this.enableMetrics = options.enableMetrics ?? true;
  }

  /**
   * Execute an operation with circuit breaker protection
   */
  async execute<T = unknown>(
    operation: () => Promise<T>,
    operationName?: string
  ): Promise<ExecutionResult<T>> {
    const startTime = performance.now();
    this.totalCalls++;

    const currentState = this.evaluateState();

    // Check if circuit is open
    if (currentState === CircuitState.OPEN) {
      return this.createFailureResult(
        new Error('Circuit breaker is open - operation rejected'),
        startTime,
        operationName
      );
    }

    // Check half-open call limits
    if (currentState === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        return this.createFailureResult(
          new Error('Circuit breaker half-open call limit exceeded'),
          startTime,
          operationName
        );
      }
      this.halfOpenCalls++;
    }

    try {
      // Execute the operation with timeout
      const result = await this.executeWithTimeout(operation, this.timeoutPeriod);
      const executionTime = performance.now() - startTime;

      // Operation succeeded
      this.onSuccess(executionTime, operationName);

      return {
        success: true,
        result,
        executionTime,
        state: this.state,
        timestamp: Date.now()
      };

    } catch (error) {
      const executionTime = performance.now() - startTime;

      // Operation failed
      this.onFailure(error as Error, executionTime, operationName);

      return this.createFailureResult(error as Error, startTime, operationName);
    }
  }

  /**
   * Check if circuit breaker allows operations
   */
  canExecute(): boolean {
    const state = this.evaluateState();
    return state === CircuitState.CLOSED ||
           (state === CircuitState.HALF_OPEN && this.halfOpenCalls < this.halfOpenMaxCalls);
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const averageResponseTime = this.responseTimes.length > 0 ?
      this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length : 0;

    const failureRate = this.totalCalls > 0 ? this.failures / this.totalCalls : 0;
    const successRate = this.totalCalls > 0 ? this.successes / this.totalCalls : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      circuitOpenTime: this.circuitOpenTime,
      averageResponseTime,
      failureRate,
      successRate
    };
  }

  /**
   * Reset circuit breaker to initial state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalCalls = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.circuitOpenTime = null;
    this.halfOpenCalls = 0;
    this.responseTimes = [];

    this.notifyStateChange();
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.setState(CircuitState.OPEN);
    this.circuitOpenTime = Date.now();
  }

  /**
   * Force circuit breaker to closed state
   */
  forceClosed(): void {
    this.setState(CircuitState.CLOSED);
    this.circuitOpenTime = null;
    this.halfOpenCalls = 0;
  }

  /**
   * Add listener for state changes
   */
  onStateChange(listener: (state: CircuitState, metrics: CircuitBreakerMetrics) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Remove state change listener
   */
  removeStateChangeListener(listener: (state: CircuitState, metrics: CircuitBreakerMetrics) => void): void {
    const index = this.stateChangeListeners.indexOf(listener);
    if (index > -1) {
      this.stateChangeListeners.splice(index, 1);
    }
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    recommendations: string[];
    metrics: CircuitBreakerMetrics;
  } {
    const metrics = this.getMetrics();
    const recommendations: string[] = [];
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (this.state === CircuitState.OPEN) {
      status = 'unhealthy';
      recommendations.push('Circuit is open - check underlying service health');
    } else if (this.state === CircuitState.HALF_OPEN) {
      status = 'degraded';
      recommendations.push('Circuit is half-open - monitoring for stability');
    } else if (metrics.failureRate > 0.1) {
      status = 'degraded';
      recommendations.push('High failure rate detected - investigate error causes');
    }

    if (metrics.averageResponseTime > 5000) {
      recommendations.push('High response times - consider timeout adjustment or service optimization');
    }

    if (this.failures > this.failureThreshold * 0.8) {
      recommendations.push('Approaching failure threshold - monitor closely');
    }

    return {
      status,
      recommendations,
      metrics
    };
  }

  /**
   * Evaluate current state based on time and failure conditions
   */
  private evaluateState(): CircuitState {
    const now = Date.now();

    switch (this.state) {
      case CircuitState.OPEN:
        // Check if enough time has passed to try half-open
        if (this.circuitOpenTime && (now - this.circuitOpenTime) >= this.resetTimeout) {
          this.setState(CircuitState.HALF_OPEN);
          this.halfOpenCalls = 0;
        }
        break;

      case CircuitState.HALF_OPEN:
        // Half-open state is managed in execute() method
        break;

      case CircuitState.CLOSED:
        // Check if we should open due to failures
        if (this.failures >= this.failureThreshold) {
          this.setState(CircuitState.OPEN);
          this.circuitOpenTime = now;
        }
        break;
    }

    return this.state;
  }

  /**
   * Handle successful operation
   */
  private onSuccess(executionTime: number, operationName?: string): void {
    this.successes++;
    this.lastSuccessTime = Date.now();
    this.recordResponseTime(executionTime);

    if (this.enableMetrics && process.env.NODE_ENV === 'development') {
      console.log(`[CircuitBreaker] Success: ${operationName || 'unknown'} (${executionTime.toFixed(2)}ms)`);
    }

    // Reset state transitions
    if (this.state === CircuitState.HALF_OPEN) {
      // If we've had enough successful calls in half-open, close the circuit
      if (this.halfOpenCalls >= this.halfOpenMaxCalls) {
        this.setState(CircuitState.CLOSED);
        this.failures = 0; // Reset failure count
        this.halfOpenCalls = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset consecutive failures on success
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: Error, executionTime: number, operationName?: string): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.recordResponseTime(executionTime);

    if (this.enableMetrics && process.env.NODE_ENV === 'development') {
      console.warn(`[CircuitBreaker] Failure: ${operationName || 'unknown'} - ${error.message} (${executionTime.toFixed(2)}ms)`);
    }

    // State transitions
    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open immediately opens the circuit
      this.setState(CircuitState.OPEN);
      this.circuitOpenTime = Date.now();
      this.halfOpenCalls = 0;
    }
    // For closed state, failure threshold is checked in evaluateState()
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutHandle);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutHandle);
          reject(error);
        });
    });
  }

  /**
   * Create failure result object
   */
  private createFailureResult<T>(
    error: Error,
    startTime: number,
    operationName?: string
  ): ExecutionResult<T> {
    const executionTime = performance.now() - startTime;

    return {
      success: false,
      error,
      executionTime,
      state: this.state,
      timestamp: Date.now()
    };
  }

  /**
   * Record response time for metrics
   */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time);

    // Keep only recent response times
    if (this.responseTimes.length > this.maxResponseTimeHistory) {
      this.responseTimes.shift();
    }
  }

  /**
   * Set circuit breaker state and notify listeners
   */
  private setState(newState: CircuitState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;

      if (this.enableMetrics && process.env.NODE_ENV === 'development') {
        console.log(`[CircuitBreaker] State transition: ${oldState} → ${newState}`);
      }

      this.notifyStateChange();
    }
  }

  /**
   * Notify all state change listeners
   */
  private notifyStateChange(): void {
    const metrics = this.getMetrics();
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this.state, metrics);
      } catch (error) {
        console.error('[CircuitBreaker] Error in state change listener:', error);
      }
    });
  }
}

/**
 * Circuit Breaker Registry for managing multiple circuit breakers
 */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a specific service
   */
  getBreaker(serviceName: string, options?: CircuitBreakerOptions): CircuitBreaker {
    let breaker = this.breakers.get(serviceName);

    if (!breaker) {
      breaker = new CircuitBreaker(options);
      this.breakers.set(serviceName, breaker);
    }

    return breaker;
  }

  /**
   * Execute operation with named circuit breaker
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options?: CircuitBreakerOptions
  ): Promise<ExecutionResult<T>> {
    const breaker = this.getBreaker(serviceName, options);
    return breaker.execute(operation, serviceName);
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};

    this.breakers.forEach((breaker, serviceName) => {
      metrics[serviceName] = breaker.getMetrics();
    });

    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => {
      breaker.reset();
    });
  }

  /**
   * Get overall health status
   */
  getOverallHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    breakerCount: number;
    healthyCount: number;
    degradedCount: number;
    unhealthyCount: number;
    details: Record<string, ReturnType<CircuitBreaker['getHealthReport']>>;
  } {
    const details: Record<string, ReturnType<CircuitBreaker['getHealthReport']>> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    this.breakers.forEach((breaker, serviceName) => {
      const health = breaker.getHealthReport();
      details[serviceName] = health;

      switch (health.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'degraded':
          degradedCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
      }
    });

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (unhealthyCount > 0) {
      overallStatus = 'unhealthy';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      breakerCount: this.breakers.size,
      healthyCount,
      degradedCount,
      unhealthyCount,
      details
    };
  }
}

// Default registry instance
export const defaultCircuitBreakerRegistry = new CircuitBreakerRegistry();