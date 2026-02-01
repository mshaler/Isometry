import Foundation

/// Parser for robots.txt files to ensure ethical crawling compliance
public struct RobotsTxtParser {
    public let userAgent: String
    public let rules: RobotsTxtRules

    public init(userAgent: String = "IsometryWebClipper") {
        self.userAgent = userAgent
        self.rules = RobotsTxtRules()
    }

    // MARK: - Public Interface

    /// Parses robots.txt content and returns rules
    public func parseRobotsTxt(_ content: String) -> RobotsTxtRules {
        var rules = RobotsTxtRules()
        let lines = content.components(separatedBy: .newlines)

        var currentUserAgent: String? = nil
        var isRelevantSection = false

        for line in lines {
            let trimmedLine = line.trimmingCharacters(in: .whitespaces)

            // Skip empty lines and comments
            if trimmedLine.isEmpty || trimmedLine.hasPrefix("#") {
                continue
            }

            let parts = trimmedLine.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }

            let directive = parts[0].lowercased()
            let value = parts[1]

            switch directive {
            case "user-agent":
                currentUserAgent = value.lowercased()
                // Check if this section applies to our user agent
                isRelevantSection = (value.lowercased() == "*" ||
                                    value.lowercased() == userAgent.lowercased() ||
                                    userAgent.lowercased().contains(value.lowercased()))

            case "disallow":
                if isRelevantSection {
                    rules.disallowedPaths.append(value)
                }

            case "allow":
                if isRelevantSection {
                    rules.allowedPaths.append(value)
                }

            case "crawl-delay":
                if isRelevantSection, let delay = Double(value) {
                    rules.crawlDelay = delay
                }

            case "sitemap":
                rules.sitemaps.append(value)

            default:
                break
            }
        }

        return rules
    }

    /// Checks if a URL path is allowed according to robots.txt rules
    public func isPathAllowed(_ path: String, rules: RobotsTxtRules) -> Bool {
        let normalizedPath = normalizePath(path)

        // Check explicit allow rules first (they take precedence)
        for allowedPath in rules.allowedPaths {
            if matchesPattern(normalizedPath, pattern: allowedPath) {
                return true
            }
        }

        // Check disallow rules
        for disallowedPath in rules.disallowedPaths {
            if matchesPattern(normalizedPath, pattern: disallowedPath) {
                return false
            }
        }

        // If no specific rules match, allow by default
        return true
    }

    /// Downloads and parses robots.txt for a given URL
    public func fetchRobotsTxt(for url: URL) async throws -> RobotsTxtRules {
        guard let host = url.host else {
            throw RobotsTxtError.invalidURL(url.absoluteString)
        }

        var robotsURL = URLComponents()
        robotsURL.scheme = url.scheme
        robotsURL.host = host
        robotsURL.port = url.port
        robotsURL.path = "/robots.txt"

        guard let robotsTxtURL = robotsURL.url else {
            throw RobotsTxtError.invalidURL("Failed to construct robots.txt URL")
        }

        do {
            let (data, response) = try await URLSession.shared.data(from: robotsTxtURL)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw RobotsTxtError.networkError("Invalid response type")
            }

            // Handle different HTTP status codes
            switch httpResponse.statusCode {
            case 200:
                // Success - parse the content
                let content = String(data: data, encoding: .utf8) ?? ""
                return parseRobotsTxt(content)

            case 404, 403:
                // No robots.txt found - allow everything
                return RobotsTxtRules()

            case 429:
                // Rate limited - be more restrictive
                var restrictiveRules = RobotsTxtRules()
                restrictiveRules.crawlDelay = 60.0 // 1 minute delay
                return restrictiveRules

            default:
                throw RobotsTxtError.httpError(httpResponse.statusCode)
            }

        } catch {
            // If we can't fetch robots.txt, be conservative and allow with delay
            var conservativeRules = RobotsTxtRules()
            conservativeRules.crawlDelay = 5.0 // 5 second delay
            return conservativeRules
        }
    }

    // MARK: - Private Implementation

    private func normalizePath(_ path: String) -> String {
        var normalized = path

        // Ensure path starts with /
        if !normalized.hasPrefix("/") {
            normalized = "/" + normalized
        }

        // Remove URL parameters and fragments
        if let queryIndex = normalized.firstIndex(of: "?") {
            normalized = String(normalized[..<queryIndex])
        }

        if let fragmentIndex = normalized.firstIndex(of: "#") {
            normalized = String(normalized[..<fragmentIndex])
        }

        return normalized
    }

    private func matchesPattern(_ path: String, pattern: String) -> Bool {
        // Handle empty pattern (matches nothing)
        if pattern.isEmpty {
            return false
        }

        // Handle wildcard patterns
        if pattern.contains("*") {
            return matchesWildcardPattern(path, pattern: pattern)
        }

        // Simple prefix match
        return path.hasPrefix(pattern)
    }

    private func matchesWildcardPattern(_ path: String, pattern: String) -> Bool {
        // Convert robots.txt pattern to regex
        var regexPattern = pattern
        regexPattern = regexPattern.replacingOccurrences(of: "*", with: ".*")
        regexPattern = regexPattern.replacingOccurrences(of: ".", with: "\\.")
        regexPattern = regexPattern.replacingOccurrences(of: "?", with: "\\?")

        // Anchor pattern to start of string
        regexPattern = "^" + regexPattern

        do {
            let regex = try NSRegularExpression(pattern: regexPattern, options: .caseInsensitive)
            let range = NSRange(location: 0, length: path.utf16.count)
            return regex.firstMatch(in: path, range: range) != nil
        } catch {
            // If regex fails, fall back to simple prefix match
            return path.hasPrefix(pattern.replacingOccurrences(of: "*", with: ""))
        }
    }
}

// MARK: - Supporting Types

/// Rules parsed from robots.txt file
public struct RobotsTxtRules {
    public var disallowedPaths: [String] = []
    public var allowedPaths: [String] = []
    public var crawlDelay: Double? = nil
    public var sitemaps: [String] = []

    public init() {}

    /// Returns the recommended delay between requests (in seconds)
    public func getRecommendedDelay() -> TimeInterval {
        return crawlDelay ?? 1.0 // Default to 1 second
    }
}

/// Errors that can occur during robots.txt processing
public enum RobotsTxtError: Error, LocalizedError {
    case invalidURL(String)
    case networkError(String)
    case httpError(Int)
    case parsingError(String)

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "Invalid URL for robots.txt: \(url)"
        case .networkError(let message):
            return "Network error fetching robots.txt: \(message)"
        case .httpError(let statusCode):
            return "HTTP error \(statusCode) when fetching robots.txt"
        case .parsingError(let message):
            return "Error parsing robots.txt: \(message)"
        }
    }
}