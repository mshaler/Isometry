import Foundation
import os.log

// Import Claude models - types should be available when built as part of the same module
#if canImport(Isometry)
// For standalone compilation, define minimal imports
#endif

// MARK: - API Client

/// Production-ready Claude API client using Foundation URLSession
/// Handles authentication, request/response processing, error handling, and retry logic
public actor ClaudeAPIClient {
    private let configuration: APIConfiguration
    private let session: URLSession
    private let logger: Logger
    private let retryDelays: [TimeInterval] = [1.0, 2.0, 4.0] // Exponential backoff

    public init(configuration: APIConfiguration) {
        self.configuration = configuration
        self.logger = Logger(subsystem: "com.isometry.app", category: "ClaudeAPIClient")

        // Configure URLSession with timeouts and security
        let sessionConfig = URLSessionConfiguration.default
        sessionConfig.timeoutIntervalForRequest = configuration.timeout
        sessionConfig.timeoutIntervalForResource = configuration.timeout * 2
        sessionConfig.requestCachePolicy = .reloadIgnoringLocalCacheData
        sessionConfig.httpMaximumConnectionsPerHost = 4
        sessionConfig.waitsForConnectivity = true

        self.session = URLSession(configuration: sessionConfig)
    }

    /// Send message to Claude API with automatic retry and error handling
    /// - Parameter request: The Claude request to send
    /// - Returns: Claude response on success
    /// - Throws: ClaudeError on API or network failure
    public func sendMessage(_ request: ClaudeRequest) async throws -> ClaudeResponse {
        // Validate request before sending
        switch request.validate() {
        case .success:
            break
        case .failure(let message):
            logger.error("Request validation failed: \(message)")
            throw ClaudeError(type: .invalidRequestError, message: message)
        }

        // Validate configuration
        switch configuration.validate() {
        case .success:
            break
        case .failure(let message):
            logger.error("Configuration validation failed: \(message)")
            throw ClaudeError(type: .authentication, message: message)
        }

        logger.info("Sending Claude API request: \(request.debugDescription)")

        return try await sendRequestWithRetry(request: request)
    }

    /// Send request with retry logic for transient failures
    private func sendRequestWithRetry(request: ClaudeRequest) async throws -> ClaudeResponse {
        var lastError: Error?

        for attempt in 0..<configuration.maxRetries {
            do {
                let response = try await sendSingleRequest(request: request)

                // Log successful request
                logger.info("Claude API request succeeded on attempt \(attempt + 1)")
                return response

            } catch let error as ClaudeError {
                lastError = error

                // Determine if we should retry based on error type
                let shouldRetry = shouldRetryForError(error) && attempt < configuration.maxRetries - 1

                if shouldRetry {
                    let delay = retryDelays[min(attempt, retryDelays.count - 1)]
                    logger.warning("Claude API request failed (attempt \(attempt + 1)), retrying after \(delay)s: \(error.localizedDescription)")

                    try await Task.sleep(for: .seconds(delay))
                } else {
                    logger.error("Claude API request failed permanently: \(error.localizedDescription)")
                    throw error
                }

            } catch {
                lastError = error
                logger.error("Unexpected error in Claude API request: \(error.localizedDescription)")
                throw ClaudeError(type: .apiError, message: "Network error: \(error.localizedDescription)")
            }
        }

        // All retries failed
        if let lastError = lastError as? ClaudeError {
            throw lastError
        } else {
            throw ClaudeError(type: .apiError, message: "All retry attempts failed")
        }
    }

    /// Send single API request without retry logic
    private func sendSingleRequest(request: ClaudeRequest) async throws -> ClaudeResponse {
        // Build URL
        guard let url = URL(string: "\(configuration.baseURL)/v1/messages") else {
            throw ClaudeError(type: .invalidRequestError, message: "Invalid base URL: \(configuration.baseURL)")
        }

        // Create HTTP request
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"

        // Add headers
        for (key, value) in configuration.headers {
            urlRequest.setValue(value, forHTTPHeaderField: key)
        }

        // Encode request body
        do {
            let encoder = JSONEncoder()
            encoder.keyEncodingStrategy = .convertToSnakeCase
            urlRequest.httpBody = try encoder.encode(request)
        } catch {
            throw ClaudeError(type: .invalidRequestError, message: "Failed to encode request: \(error.localizedDescription)")
        }

        // Log request (without sensitive data)
        logger.debug("Sending request to: \(url.absoluteString)")
        logger.debug("Request headers: \(urlRequest.allHTTPHeaderFields?.description ?? "none")")

        // Perform request
        let (data, response) = try await session.data(for: urlRequest)

        // Validate HTTP response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw ClaudeError(type: .apiError, message: "Invalid response type")
        }

        logger.debug("Received HTTP status: \(httpResponse.statusCode)")

        // Handle HTTP errors
        switch httpResponse.statusCode {
        case 200:
            // Success - continue to decode response
            break
        case 401:
            throw ClaudeError(type: .authentication, message: "Invalid API key")
        case 403:
            throw ClaudeError(type: .permission, message: "API key lacks required permissions")
        case 404:
            throw ClaudeError(type: .notFound, message: "API endpoint not found")
        case 429:
            throw ClaudeError(type: .rateLimitExceeded, message: "Rate limit exceeded")
        case 500..<600:
            throw ClaudeError(type: .apiError, message: "Server error (\(httpResponse.statusCode))")
        default:
            throw ClaudeError(type: .apiError, message: "Unexpected HTTP status: \(httpResponse.statusCode)")
        }

        // Check for rate limit headers
        if let remainingRequests = httpResponse.value(forHTTPHeaderField: "anthropic-ratelimit-requests-remaining"),
           let remaining = Int(remainingRequests), remaining < 5 {
            logger.warning("Rate limit warning: only \(remaining) requests remaining")
        }

        // Decode response
        do {
            let decoder = JSONDecoder()
            decoder.keyDecodingStrategy = .convertFromSnakeCase
            let claudeResponse = try decoder.decode(ClaudeResponse.self, from: data)

            logger.info("Claude API response decoded successfully: \(claudeResponse.debugDescription)")
            return claudeResponse

        } catch {
            // Try to decode as error response
            if let errorResponse = try? JSONDecoder().decode(ClaudeErrorResponse.self, from: data) {
                throw ClaudeError(type: errorResponse.error.type, message: errorResponse.error.message)
            }

            // Fallback for decode errors
            logger.error("Failed to decode response: \(error.localizedDescription)")
            throw ClaudeError(type: .apiError, message: "Failed to decode API response: \(error.localizedDescription)")
        }
    }

    /// Determine if error should trigger a retry
    private func shouldRetryForError(_ error: ClaudeError) -> Bool {
        switch error.type {
        case .rateLimitExceeded, .apiError, .overloadedError:
            return true
        case .authentication, .permission, .notFound, .invalidRequestError:
            return false
        }
    }
}

// MARK: - Configuration Loading

extension ClaudeAPIClient {
    /// Create client with API key from environment or bundle
    /// - Parameter apiKey: Optional API key override
    /// - Returns: Configured client or nil if no key found
    public static func create(apiKey: String? = nil) -> ClaudeAPIClient? {
        let key = apiKey ?? loadAPIKey()
        guard !key.isEmpty else {
            return nil
        }

        let config = APIConfiguration(apiKey: key)
        return ClaudeAPIClient(configuration: config)
    }

    /// Load API key from environment variables or app configuration
    private static func loadAPIKey() -> String {
        // Try environment variable first
        if let envKey = ProcessInfo.processInfo.environment["ANTHROPIC_API_KEY"], !envKey.isEmpty {
            return envKey
        }

        // Try bundle configuration
        if let bundleKey = Bundle.main.infoDictionary?["ANTHROPIC_API_KEY"] as? String, !bundleKey.isEmpty {
            return bundleKey
        }

        // Try UserDefaults for development
        if let userKey = UserDefaults.standard.string(forKey: "anthropic_api_key"), !userKey.isEmpty {
            return userKey
        }

        return ""
    }

    /// Check if API is configured and ready to use
    public static func isConfigured() -> Bool {
        let key = loadAPIKey()
        return !key.isEmpty && key.hasPrefix("sk-ant-")
    }

    /// Get configuration instructions for users
    public static func configurationInstructions() -> [String] {
        return [
            "Claude API Configuration Required",
            "",
            "1. Get API key from: https://console.anthropic.com/account/keys",
            "2. Create new key if needed",
            "3. Set environment variable:",
            "   export ANTHROPIC_API_KEY=sk-ant-your-key-here",
            "4. Or add to Info.plist (development only):",
            "   <key>ANTHROPIC_API_KEY</key>",
            "   <string>sk-ant-your-key-here</string>",
            "",
            "⚠️  Keep your API key secure. Never commit it to version control."
        ]
    }
}

// MARK: - Performance Monitoring

extension ClaudeAPIClient {
    /// Send message with performance tracking
    /// - Parameters:
    ///   - request: Claude request
    ///   - context: Optional context for tracking
    /// - Returns: Response with timing information
    public func sendMessageWithTracking(
        _ request: ClaudeRequest,
        context: String? = nil
    ) async throws -> (response: ClaudeResponse, duration: TimeInterval) {
        let startTime = CFAbsoluteTimeGetCurrent()
        let response = try await sendMessage(request)
        let duration = CFAbsoluteTimeGetCurrent() - startTime

        // Log performance metrics
        logger.info("Claude API call completed in \(Int(duration * 1000))ms (tokens: \(response.usage.totalTokens))")

        // Track with performance monitor if available
        #if canImport(Isometry)
        PerformanceMonitor.shared.recordNotebookCardQuery(
            duration,
            operation: "claude_api_\(context ?? "unknown")"
        )

        if duration > PerformanceMonitor.targetFrameTime * 10 {
            PerformanceMonitor.shared.logEvent(
                "Slow Claude API Call",
                "Duration: \(Int(duration * 1000))ms, Tokens: \(response.usage.totalTokens)"
            )
        }
        #endif

        return (response, duration)
    }
}

// MARK: - Shell Integration Helpers

extension ClaudeAPIClient {
    /// Send command with shell context enrichment
    /// - Parameters:
    ///   - prompt: User prompt
    ///   - context: Shell context for enrichment
    ///   - maxTokens: Maximum tokens in response
    /// - Returns: Claude response
    public func sendShellCommand(
        prompt: String,
        context: ShellContext,
        maxTokens: Int = 1000
    ) async throws -> ClaudeResponse {
        // Enrich prompt with shell context
        let enrichedPrompt = """
        \(context.formattedForPrompt)

        User: \(prompt)
        """

        let request = ClaudeRequest.text(
            prompt: enrichedPrompt,
            maxTokens: maxTokens,
            temperature: 0.7
        )

        return try await sendMessage(request)
    }

    /// Format Claude response for terminal display
    /// - Parameter response: Claude API response
    /// - Returns: Formatted string for shell output
    public static func formatForShell(_ response: ClaudeResponse) -> String {
        let content = response.textContent
        let tokenInfo = "(\(response.usage.totalTokens) tokens)"

        return """
        🤖 Claude \(tokenInfo):
        \(content)
        \("─".repeated(50))
        """
    }
}

// MARK: - Supporting Types

/// Error response wrapper from Claude API
private struct ClaudeErrorResponse: Codable {
    let error: ClaudeAPIError
}

/// Nested error structure in API response
private struct ClaudeAPIError: Codable {
    let type: ClaudeError.ErrorType
    let message: String
}

// MARK: - String Extension

private extension String {
    func repeated(_ count: Int) -> String {
        return String(repeating: self, count: count)
    }
}

// MARK: - Task Extension

// Task.sleep extension defined in ProcessManager.swift