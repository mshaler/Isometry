import Foundation

/// Rate limiter for ethical web crawling with per-domain delays
public actor RateLimiter {
    private var domainDelays: [String: TimeInterval] = [:]
    private var lastRequestTimes: [String: Date] = [:]
    private var requestCounts: [String: Int] = [:]
    private var windowStartTimes: [String: Date] = [:]

    private let defaultDelay: TimeInterval = 1.0
    private let maxRequestsPerWindow: Int = 10
    private let windowDuration: TimeInterval = 60.0 // 1 minute
    private let maxRetryDelay: TimeInterval = 300.0 // 5 minutes

    public init() {}

    // MARK: - Public Interface

    /// Sets a custom delay for a specific domain
    public func setDelay(_ delay: TimeInterval, for domain: String) {
        domainDelays[domain] = max(delay, 0.5) // Minimum 0.5 seconds
    }

    /// Waits for the appropriate delay before allowing the next request
    public func waitForNextRequest(to url: URL) async throws {
        guard let domain = url.host else {
            throw RateLimitError.invalidURL(url.absoluteString)
        }

        let normalizedDomain = domain.lowercased()
        let requiredDelay = getRequiredDelay(for: normalizedDomain)

        // Check if we need to wait
        if let lastRequest = lastRequestTimes[normalizedDomain] {
            let timeSinceLastRequest = Date().timeIntervalSince(lastRequest)
            let remainingWait = requiredDelay - timeSinceLastRequest

            if remainingWait > 0 {
                try await Task.sleep(nanoseconds: UInt64(remainingWait * 1_000_000_000))
            }
        }

        // Check request rate limits
        try await enforceRateLimit(for: normalizedDomain)

        // Update last request time
        lastRequestTimes[normalizedDomain] = Date()
    }

    /// Updates delay based on robots.txt rules
    public func updateDelayFromRobotsTxt(_ rules: RobotsTxtRules, for domain: String) {
        let robotsDelay = rules.getRecommendedDelay()
        setDelay(robotsDelay, for: domain.lowercased())
    }

    /// Applies exponential backoff for a domain (used after errors)
    public func applyBackoff(for url: URL, attempt: Int) {
        guard let domain = url.host?.lowercased() else { return }

        let baseDelay = domainDelays[domain] ?? defaultDelay
        let backoffDelay = min(baseDelay * pow(2.0, Double(attempt)), maxRetryDelay)

        setDelay(backoffDelay, for: domain)
    }

    /// Resets backoff for a domain (used after successful requests)
    public func resetBackoff(for url: URL) {
        guard let domain = url.host?.lowercased() else { return }

        // Reset to default or robots.txt specified delay
        domainDelays[domain] = defaultDelay
    }

    /// Gets current delay for a domain
    public func getCurrentDelay(for domain: String) -> TimeInterval {
        return domainDelays[domain.lowercased()] ?? defaultDelay
    }

    /// Gets statistics for rate limiting
    public func getStatistics() -> RateLimitStatistics {
        return RateLimitStatistics(
            domainsTracked: domainDelays.count,
            totalRequests: requestCounts.values.reduce(0, +),
            averageDelay: calculateAverageDelay()
        )
    }

    // MARK: - Private Implementation

    private func getRequiredDelay(for domain: String) -> TimeInterval {
        return domainDelays[domain] ?? defaultDelay
    }

    private func enforceRateLimit(for domain: String) async throws {
        let now = Date()

        // Initialize or reset window if needed
        if windowStartTimes[domain] == nil ||
           now.timeIntervalSince(windowStartTimes[domain]!) > windowDuration {
            windowStartTimes[domain] = now
            requestCounts[domain] = 0
        }

        // Check if we're within request limits
        let currentCount = requestCounts[domain] ?? 0
        if currentCount >= maxRequestsPerWindow {
            // Calculate time until window resets
            let windowStart = windowStartTimes[domain]!
            let timeUntilReset = windowDuration - now.timeIntervalSince(windowStart)

            if timeUntilReset > 0 {
                // Wait until window resets
                try await Task.sleep(nanoseconds: UInt64(timeUntilReset * 1_000_000_000))

                // Reset window
                windowStartTimes[domain] = Date()
                requestCounts[domain] = 0
            }
        }

        // Increment request count
        requestCounts[domain] = (requestCounts[domain] ?? 0) + 1
    }

    private func calculateAverageDelay() -> TimeInterval {
        guard !domainDelays.isEmpty else { return defaultDelay }

        let totalDelay = domainDelays.values.reduce(0, +)
        return totalDelay / Double(domainDelays.count)
    }
}

// MARK: - Supporting Types

/// Statistics about rate limiting behavior
public struct RateLimitStatistics {
    public let domainsTracked: Int
    public let totalRequests: Int
    public let averageDelay: TimeInterval

    public init(domainsTracked: Int, totalRequests: Int, averageDelay: TimeInterval) {
        self.domainsTracked = domainsTracked
        self.totalRequests = totalRequests
        self.averageDelay = averageDelay
    }
}

/// Errors that can occur during rate limiting
public enum RateLimitError: Error, LocalizedError {
    case invalidURL(String)
    case rateLimitExceeded(String, TimeInterval)
    case requestTimeout

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL for rate limiting: \(url)"
        case .rateLimitExceeded(let domain, let waitTime):
            return "Rate limit exceeded for \(domain). Wait \(waitTime) seconds."
        case .requestTimeout:
            return "Request timeout during rate limiting"
        }
    }
}