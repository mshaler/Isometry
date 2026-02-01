import Foundation

/// Ethical crawler that combines robots.txt compliance and rate limiting
public actor EthicalCrawler {
    private let robotsParser: RobotsTxtParser
    private let rateLimiter: RateLimiter
    private var robotsCache: [String: (rules: RobotsTxtRules, cachedAt: Date)] = [:]
    private let cacheExpiration: TimeInterval = 3600 // 1 hour

    private let userAgent = "IsometryWebClipper/1.0 (+https://isometry.app/bot)"

    public init() {
        self.robotsParser = RobotsTxtParser(userAgent: "IsometryWebClipper")
        self.rateLimiter = RateLimiter()
    }

    // MARK: - Public Interface

    /// Checks if a URL can be crawled and applies appropriate delays
    public func canCrawl(_ url: URL) async throws -> CrawlPermission {
        guard let host = url.host else {
            throw EthicalCrawlerError.invalidURL(url.absoluteString)
        }

        let domain = host.lowercased()

        // Get or fetch robots.txt rules
        let rules = try await getRobotsRules(for: domain, url: url)

        // Check if path is allowed by robots.txt
        let isAllowed = robotsParser.isPathAllowed(url.path, rules: rules)

        if !isAllowed {
            return CrawlPermission(
                allowed: false,
                reason: "Disallowed by robots.txt",
                recommendedDelay: nil
            )
        }

        // Update rate limiter with robots.txt delay
        await rateLimiter.updateDelayFromRobotsTxt(rules, for: domain)

        // Get recommended delay
        let delay = await rateLimiter.getCurrentDelay(for: domain)

        return CrawlPermission(
            allowed: true,
            reason: "Allowed by robots.txt",
            recommendedDelay: delay
        )
    }

    /// Performs ethical crawl with all checks and delays
    public func ethicalRequest(to url: URL, maxRetries: Int = 3) async throws -> (Data, URLResponse) {
        var attempt = 0
        var lastError: Error?

        while attempt < maxRetries {
            do {
                // Check crawl permission
                let permission = try await canCrawl(url)

                guard permission.allowed else {
                    throw EthicalCrawlerError.crawlDisallowed(url.absoluteString, permission.reason)
                }

                // Apply rate limiting
                try await rateLimiter.waitForNextRequest(to: url)

                // Create request with appropriate headers
                var request = URLRequest(url: url)
                request.setValue(userAgent, forHTTPHeaderField: "User-Agent")
                request.setValue("no-cache", forHTTPHeaderField: "Cache-Control")

                // Perform request
                let (data, response) = try await URLSession.shared.data(for: request)

                // Handle response
                if let httpResponse = response as? HTTPURLResponse {
                    try await handleHTTPResponse(httpResponse, url: url, attempt: attempt)

                    // Reset backoff on success
                    await rateLimiter.resetBackoff(for: url)

                    return (data, response)
                }

                return (data, response)

            } catch {
                lastError = error
                attempt += 1

                if attempt < maxRetries {
                    // Apply exponential backoff
                    await rateLimiter.applyBackoff(for: url, attempt: attempt)

                    // Wait before retry
                    let backoffDelay = await rateLimiter.getCurrentDelay(for: url.host?.lowercased() ?? "")
                    try await Task.sleep(nanoseconds: UInt64(backoffDelay * 1_000_000_000))
                }
            }
        }

        throw EthicalCrawlerError.maxRetriesExceeded(url.absoluteString, lastError)
    }

    /// Gets crawler statistics
    public func getStatistics() async -> EthicalCrawlerStatistics {
        let rateLimitStats = await rateLimiter.getStatistics()

        return EthicalCrawlerStatistics(
            robotsCacheEntries: robotsCache.count,
            rateLimitStats: rateLimitStats,
            userAgent: userAgent
        )
    }

    /// Clears expired robots.txt cache entries
    public func cleanupCache() {
        let now = Date()
        robotsCache = robotsCache.filter { _, value in
            now.timeIntervalSince(value.cachedAt) < cacheExpiration
        }
    }

    // MARK: - Private Implementation

    private func getRobotsRules(for domain: String, url: URL) async throws -> RobotsTxtRules {
        let now = Date()

        // Check cache
        if let cached = robotsCache[domain],
           now.timeIntervalSince(cached.cachedAt) < cacheExpiration {
            return cached.rules
        }

        // Fetch new robots.txt
        let rules = try await robotsParser.fetchRobotsTxt(for: url)

        // Cache the results
        robotsCache[domain] = (rules: rules, cachedAt: now)

        return rules
    }

    private func handleHTTPResponse(_ response: HTTPURLResponse, url: URL, attempt: Int) async throws {
        switch response.statusCode {
        case 200...299:
            // Success
            break

        case 301, 302, 307, 308:
            // Redirects are handled automatically by URLSession
            break

        case 403:
            throw EthicalCrawlerError.forbidden(url.absoluteString)

        case 404:
            throw EthicalCrawlerError.notFound(url.absoluteString)

        case 429:
            // Rate limited by server
            let retryAfter = parseRetryAfter(from: response)
            await rateLimiter.setDelay(retryAfter, for: url.host?.lowercased() ?? "")
            throw EthicalCrawlerError.rateLimited(url.absoluteString, retryAfter)

        case 500...599:
            // Server error - apply backoff
            throw EthicalCrawlerError.serverError(response.statusCode, url.absoluteString)

        default:
            throw EthicalCrawlerError.unexpectedStatusCode(response.statusCode, url.absoluteString)
        }
    }

    private func parseRetryAfter(from response: HTTPURLResponse) -> TimeInterval {
        if let retryAfterHeader = response.value(forHTTPHeaderField: "Retry-After") {
            // Try parsing as seconds
            if let seconds = Double(retryAfterHeader) {
                return seconds
            }

            // Try parsing as HTTP date
            let formatter = DateFormatter()
            formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
            if let date = formatter.date(from: retryAfterHeader) {
                return date.timeIntervalSinceNow
            }
        }

        // Default fallback
        return 60.0 // 1 minute
    }
}

// MARK: - Supporting Types

/// Permission result from crawl check
public struct CrawlPermission {
    public let allowed: Bool
    public let reason: String
    public let recommendedDelay: TimeInterval?

    public init(allowed: Bool, reason: String, recommendedDelay: TimeInterval?) {
        self.allowed = allowed
        self.reason = reason
        self.recommendedDelay = recommendedDelay
    }
}

/// Statistics about ethical crawler behavior
public struct EthicalCrawlerStatistics {
    public let robotsCacheEntries: Int
    public let rateLimitStats: RateLimitStatistics
    public let userAgent: String

    public init(robotsCacheEntries: Int, rateLimitStats: RateLimitStatistics, userAgent: String) {
        self.robotsCacheEntries = robotsCacheEntries
        self.rateLimitStats = rateLimitStats
        self.userAgent = userAgent
    }
}

/// Errors that can occur during ethical crawling
public enum EthicalCrawlerError: Error, LocalizedError {
    case invalidURL(String)
    case crawlDisallowed(String, String)
    case forbidden(String)
    case notFound(String)
    case rateLimited(String, TimeInterval)
    case serverError(Int, String)
    case unexpectedStatusCode(Int, String)
    case maxRetriesExceeded(String, Error?)

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL: \(url)"
        case .crawlDisallowed(let url, let reason):
            return "Crawling disallowed for \(url): \(reason)"
        case .forbidden(let url):
            return "Access forbidden: \(url)"
        case .notFound(let url):
            return "URL not found: \(url)"
        case .rateLimited(let url, let delay):
            return "Rate limited for \(url). Retry after \(delay) seconds."
        case .serverError(let code, let url):
            return "Server error \(code) for \(url)"
        case .unexpectedStatusCode(let code, let url):
            return "Unexpected status code \(code) for \(url)"
        case .maxRetriesExceeded(let url, let underlyingError):
            return "Max retries exceeded for \(url): \(underlyingError?.localizedDescription ?? "Unknown error")"
        }
    }
}