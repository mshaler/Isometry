/**
 * CircuitBreaker Actor for WebView Bridge Reliability
 *
 * Implements modern Swift async/await patterns with configurable failure thresholds
 * and timeout logic, proper actor isolation for thread safety, and integration
 * with WebViewBridge message handlers following research patterns.
 */

import Foundation
import OSLog

/// Circuit breaker state enumeration
public enum CircuitState: String, Sendable, Codable {
    case closed
    case open
    case halfOpen
}

/// Configuration options for CircuitBreaker
public struct CircuitBreakerOptions: Sendable {
    public let failureThreshold: Int
    public let timeoutPeriod: TimeInterval
    public let halfOpenMaxCalls: Int
    public let resetTimeout: TimeInterval
    public let enableMetrics: Bool

    public init(
        failureThreshold: Int = 5,
        timeoutPeriod: TimeInterval = 60.0, // 60 seconds
        halfOpenMaxCalls: Int = 3,
        resetTimeout: TimeInterval = 30.0, // 30 seconds
        enableMetrics: Bool = true
    ) {
        self.failureThreshold = failureThreshold
        self.timeoutPeriod = timeoutPeriod
        self.halfOpenMaxCalls = halfOpenMaxCalls
        self.resetTimeout = resetTimeout
        self.enableMetrics = enableMetrics
    }
}

/// Circuit breaker metrics for monitoring
public struct CircuitBreakerMetrics: Sendable {
    public let state: CircuitState
    public let failures: Int
    public let successes: Int
    public let totalCalls: Int
    public let lastFailureTime: TimeInterval?
    public let lastSuccessTime: TimeInterval?
    public let circuitOpenTime: TimeInterval?
    public let averageResponseTime: TimeInterval
    public let failureRate: Double
    public let successRate: Double

    public init(
        state: CircuitState,
        failures: Int,
        successes: Int,
        totalCalls: Int,
        lastFailureTime: TimeInterval?,
        lastSuccessTime: TimeInterval?,
        circuitOpenTime: TimeInterval?,
        averageResponseTime: TimeInterval,
        failureRate: Double,
        successRate: Double
    ) {
        self.state = state
        self.failures = failures
        self.successes = successes
        self.totalCalls = totalCalls
        self.lastFailureTime = lastFailureTime
        self.lastSuccessTime = lastSuccessTime
        self.circuitOpenTime = circuitOpenTime
        self.averageResponseTime = averageResponseTime
        self.failureRate = failureRate
        self.successRate = successRate
    }
}

/// Circuit breaker execution result wrapper
public struct CircuitBreakerResult<T>: Sendable where T: Sendable {
    public let success: Bool
    public let result: T?
    public let error: Error?
    public let executionTime: TimeInterval
    public let state: CircuitState
    public let timestamp: TimeInterval

    public init(
        success: Bool,
        result: T?,
        error: Error?,
        executionTime: TimeInterval,
        state: CircuitState,
        timestamp: TimeInterval = Date().timeIntervalSince1970
    ) {
        self.success = success
        self.result = result
        self.error = error
        self.executionTime = executionTime
        self.state = state
        self.timestamp = timestamp
    }
}

/// CircuitBreaker actor for preventing cascade failures
public actor CircuitBreaker {
    // MARK: - Properties

    private var state: CircuitState = .closed
    private var failures = 0
    private var successes = 0
    private var totalCalls = 0
    private var lastFailureTime: TimeInterval?
    private var lastSuccessTime: TimeInterval?
    private var circuitOpenTime: TimeInterval?
    private var halfOpenCalls = 0

    // Configuration
    private let options: CircuitBreakerOptions
    private let logger = Logger(subsystem: "IsometryBridge", category: "CircuitBreaker")

    // Performance tracking
    private var responseTimes: [TimeInterval] = []
    private let maxResponseTimeHistory = 100

    // State change listeners
    private var stateChangeListeners: [(CircuitState, CircuitBreakerMetrics) -> Void] = []

    // MARK: - Initialization

    public init(options: CircuitBreakerOptions = CircuitBreakerOptions()) {
        self.options = options
    }

    // MARK: - Public Methods

    /// Execute an operation with circuit breaker protection
    public func execute<T: Sendable>(
        operation: @Sendable @escaping () async throws -> T,
        operationName: String = "unknown"
    ) async -> CircuitBreakerResult<T> {
        let startTime = CACurrentMediaTime()
        totalCalls += 1

        let currentState = await evaluateState()

        // Check if circuit is open
        if currentState == .open {
            return createFailureResult(
                error: CircuitBreakerError.circuitOpen,
                startTime: startTime,
                operationName: operationName
            )
        }

        // Check half-open call limits
        if currentState == .halfOpen {
            if halfOpenCalls >= options.halfOpenMaxCalls {
                return createFailureResult(
                    error: CircuitBreakerError.halfOpenLimitExceeded,
                    startTime: startTime,
                    operationName: operationName
                )
            }
            halfOpenCalls += 1
        }

        do {
            // Execute the operation with timeout
            let result = try await executeWithTimeout(operation: operation, timeoutMs: options.timeoutPeriod * 1000)
            let executionTime = CACurrentMediaTime() - startTime

            // Operation succeeded
            await onSuccess(executionTime: executionTime, operationName: operationName)

            return CircuitBreakerResult(
                success: true,
                result: result,
                error: nil,
                executionTime: executionTime,
                state: state
            )

        } catch {
            let executionTime = CACurrentMediaTime() - startTime

            // Operation failed
            await onFailure(error: error, executionTime: executionTime, operationName: operationName)

            return createFailureResult(
                error: error,
                startTime: startTime,
                operationName: operationName
            )
        }
    }

    /// Check if circuit breaker allows operations
    public func canExecute() async -> Bool {
        let currentState = await evaluateState()
        return currentState == .closed ||
               (currentState == .halfOpen && halfOpenCalls < options.halfOpenMaxCalls)
    }

    /// Get current circuit breaker metrics
    public func getMetrics() -> CircuitBreakerMetrics {
        let averageResponseTime = responseTimes.isEmpty ? 0.0 : responseTimes.reduce(0, +) / Double(responseTimes.count)
        let failureRate = totalCalls > 0 ? Double(failures) / Double(totalCalls) : 0.0
        let successRate = totalCalls > 0 ? Double(successes) / Double(totalCalls) : 0.0

        return CircuitBreakerMetrics(
            state: state,
            failures: failures,
            successes: successes,
            totalCalls: totalCalls,
            lastFailureTime: lastFailureTime,
            lastSuccessTime: lastSuccessTime,
            circuitOpenTime: circuitOpenTime,
            averageResponseTime: averageResponseTime,
            failureRate: failureRate,
            successRate: successRate
        )
    }

    /// Reset circuit breaker to initial state
    public func reset() {
        state = .closed
        failures = 0
        successes = 0
        totalCalls = 0
        lastFailureTime = nil
        lastSuccessTime = nil
        circuitOpenTime = nil
        halfOpenCalls = 0
        responseTimes = []

        notifyStateChange()
    }

    /// Force circuit breaker to open state
    public func forceOpen() {
        setState(.open)
        circuitOpenTime = Date().timeIntervalSince1970
    }

    /// Force circuit breaker to closed state
    public func forceClosed() {
        setState(.closed)
        circuitOpenTime = nil
        halfOpenCalls = 0
    }

    /// Add listener for state changes
    public func onStateChange(_ listener: @escaping (CircuitState, CircuitBreakerMetrics) -> Void) {
        stateChangeListeners.append(listener)
    }

    /// Get health report
    public func getHealthReport() -> (
        status: String,
        recommendations: [String],
        metrics: CircuitBreakerMetrics
    ) {
        let metrics = getMetrics()
        var recommendations: [String] = []
        var status = "healthy"

        switch state {
        case .open:
            status = "unhealthy"
            recommendations.append("Circuit is open - check underlying service health")
        case .halfOpen:
            status = "degraded"
            recommendations.append("Circuit is half-open - monitoring for stability")
        case .closed:
            if metrics.failureRate > 0.1 {
                status = "degraded"
                recommendations.append("High failure rate detected - investigate error causes")
            }
        }

        if metrics.averageResponseTime > 5.0 {
            recommendations.append("High response times - consider timeout adjustment or service optimization")
        }

        if failures > Int(Double(options.failureThreshold) * 0.8) {
            recommendations.append("Approaching failure threshold - monitor closely")
        }

        return (status: status, recommendations: recommendations, metrics: metrics)
    }

    // MARK: - Private Methods

    private func evaluateState() async -> CircuitState {
        let now = Date().timeIntervalSince1970

        switch state {
        case .open:
            // Check if enough time has passed to try half-open
            if let openTime = circuitOpenTime, (now - openTime) >= options.resetTimeout {
                setState(.halfOpen)
                halfOpenCalls = 0
            }

        case .halfOpen:
            // Half-open state is managed in execute() method
            break

        case .closed:
            // Check if we should open due to failures
            if failures >= options.failureThreshold {
                setState(.open)
                circuitOpenTime = now
            }
        }

        return state
    }

    private func onSuccess(executionTime: TimeInterval, operationName: String) {
        successes += 1
        lastSuccessTime = Date().timeIntervalSince1970
        recordResponseTime(executionTime)

        if options.enableMetrics {
            logger.info("Circuit breaker success: \(operationName) (\(String(format: "%.2f", executionTime * 1000))ms)")
        }

        // Reset state transitions
        if state == .halfOpen {
            // If we've had enough successful calls in half-open, close the circuit
            if halfOpenCalls >= options.halfOpenMaxCalls {
                setState(.closed)
                failures = 0 // Reset failure count
                halfOpenCalls = 0
            }
        } else if state == .closed {
            // Reset consecutive failures on success
            failures = max(0, failures - 1)
        }
    }

    private func onFailure(error: Error, executionTime: TimeInterval, operationName: String) {
        failures += 1
        lastFailureTime = Date().timeIntervalSince1970
        recordResponseTime(executionTime)

        if options.enableMetrics {
            logger.warning("Circuit breaker failure: \(operationName) - \(error.localizedDescription) (\(String(format: "%.2f", executionTime * 1000))ms)")
        }

        // State transitions
        if state == .halfOpen {
            // Any failure in half-open immediately opens the circuit
            setState(.open)
            circuitOpenTime = Date().timeIntervalSince1970
            halfOpenCalls = 0
        }
        // For closed state, failure threshold is checked in evaluateState()
    }

    private func executeWithTimeout<T: Sendable>(
        operation: @Sendable @escaping () async throws -> T,
        timeoutMs: TimeInterval
    ) async throws -> T {
        return try await withThrowingTaskGroup(of: T.self) { group in
            // Add the operation task
            group.addTask {
                try await operation()
            }

            // Add the timeout task
            group.addTask {
                try await Task.sleep(nanoseconds: UInt64(timeoutMs * 1_000_000))
                throw CircuitBreakerError.operationTimeout
            }

            // Return the first result (either success or timeout)
            guard let result = try await group.next() else {
                throw CircuitBreakerError.operationTimeout
            }

            group.cancelAll()
            return result
        }
    }

    private func createFailureResult<T: Sendable>(
        error: Error,
        startTime: TimeInterval,
        operationName: String
    ) -> CircuitBreakerResult<T> {
        let executionTime = CACurrentMediaTime() - startTime

        return CircuitBreakerResult<T>(
            success: false,
            result: nil,
            error: error,
            executionTime: executionTime,
            state: state
        )
    }

    private func recordResponseTime(_ time: TimeInterval) {
        responseTimes.append(time)

        // Keep only recent response times
        if responseTimes.count > maxResponseTimeHistory {
            responseTimes.removeFirst()
        }
    }

    private func setState(_ newState: CircuitState) {
        if state != newState {
            let oldState = state
            state = newState

            if options.enableMetrics {
                logger.info("Circuit breaker state transition: \(oldState.rawValue) → \(newState.rawValue)")
            }

            notifyStateChange()
        }
    }

    private func notifyStateChange() {
        let metrics = getMetrics()
        for listener in stateChangeListeners {
            listener(state, metrics)
        }
    }
}

// MARK: - Circuit Breaker Registry

/// Registry for managing multiple circuit breakers
public actor CircuitBreakerRegistry {
    private var breakers: [String: CircuitBreaker] = [:]

    public init() {}

    /// Get or create a circuit breaker for a specific service
    public func getBreaker(serviceName: String, options: CircuitBreakerOptions = CircuitBreakerOptions()) async -> CircuitBreaker {
        if let existingBreaker = breakers[serviceName] {
            return existingBreaker
        }

        let newBreaker = CircuitBreaker(options: options)
        breakers[serviceName] = newBreaker
        return newBreaker
    }

    /// Execute operation with named circuit breaker
    public func execute<T: Sendable>(
        serviceName: String,
        operation: @Sendable @escaping () async throws -> T,
        options: CircuitBreakerOptions = CircuitBreakerOptions()
    ) async -> CircuitBreakerResult<T> {
        let breaker = await getBreaker(serviceName: serviceName, options: options)
        return await breaker.execute(operation: operation, operationName: serviceName)
    }

    /// Get all circuit breaker metrics
    public func getAllMetrics() async -> [String: CircuitBreakerMetrics] {
        var allMetrics: [String: CircuitBreakerMetrics] = [:]

        for (serviceName, breaker) in breakers {
            allMetrics[serviceName] = await breaker.getMetrics()
        }

        return allMetrics
    }

    /// Reset all circuit breakers
    public func resetAll() async {
        for breaker in breakers.values {
            await breaker.reset()
        }
    }

    /// Get overall health status
    public func getOverallHealth() async -> (
        status: String,
        breakerCount: Int,
        healthyCount: Int,
        degradedCount: Int,
        unhealthyCount: Int,
        details: [String: (status: String, recommendations: [String], metrics: CircuitBreakerMetrics)]
    ) {
        var details: [String: (status: String, recommendations: [String], metrics: CircuitBreakerMetrics)] = [:]
        var healthyCount = 0
        var degradedCount = 0
        var unhealthyCount = 0

        for (serviceName, breaker) in breakers {
            let health = await breaker.getHealthReport()
            details[serviceName] = health

            switch health.status {
            case "healthy":
                healthyCount += 1
            case "degraded":
                degradedCount += 1
            case "unhealthy":
                unhealthyCount += 1
            default:
                break
            }
        }

        let overallStatus: String
        if unhealthyCount > 0 {
            overallStatus = "unhealthy"
        } else if degradedCount > 0 {
            overallStatus = "degraded"
        } else {
            overallStatus = "healthy"
        }

        return (
            status: overallStatus,
            breakerCount: breakers.count,
            healthyCount: healthyCount,
            degradedCount: degradedCount,
            unhealthyCount: unhealthyCount,
            details: details
        )
    }
}

// MARK: - Error Types

public enum CircuitBreakerError: Error {
    case circuitOpen
    case halfOpenLimitExceeded
    case operationTimeout
}

extension CircuitBreakerError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .circuitOpen:
            return "Circuit breaker is open - operation rejected"
        case .halfOpenLimitExceeded:
            return "Circuit breaker half-open call limit exceeded"
        case .operationTimeout:
            return "Operation timeout"
        }
    }
}

// MARK: - Global Registry

/// Default circuit breaker registry instance
public let defaultCircuitBreakerRegistry = CircuitBreakerRegistry()