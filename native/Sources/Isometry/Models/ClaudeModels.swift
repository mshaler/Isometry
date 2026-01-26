import Foundation

// MARK: - Claude API Request Models

/// Request to Claude API with message and configuration
public struct ClaudeRequest: Codable, Sendable {
    public let model: String
    public let maxTokens: Int
    public let temperature: Double
    public let messages: [ClaudeMessage]

    public init(
        model: String = "claude-3-5-sonnet-20241022",
        maxTokens: Int = 1000,
        temperature: Double = 0.7,
        messages: [ClaudeMessage]
    ) {
        self.model = model
        self.maxTokens = maxTokens
        self.temperature = temperature
        self.messages = messages
    }

    /// Coding keys for JSON serialization with snake_case API
    private enum CodingKeys: String, CodingKey {
        case model
        case maxTokens = "max_tokens"
        case temperature
        case messages
    }

    /// Validate request before sending to API
    public func validate() -> ValidationResult {
        if messages.isEmpty {
            return .failure("Messages array cannot be empty")
        }

        if maxTokens < 1 || maxTokens > 4096 {
            return .failure("Max tokens must be between 1 and 4096")
        }

        if temperature < 0.0 || temperature > 1.0 {
            return .failure("Temperature must be between 0.0 and 1.0")
        }

        // Estimate token count (rough approximation: 4 chars per token)
        let estimatedTokens = messages.reduce(0) { total, message in
            total + message.content.reduce(0) { contentTotal, content in
                contentTotal + (content.text.count / 4)
            }
        }

        if estimatedTokens > 100000 { // Claude's context limit
            return .failure("Estimated input tokens (\(estimatedTokens)) exceeds context limit")
        }

        return .success
    }

    public enum ValidationResult {
        case success
        case failure(String)
    }
}

/// Individual message in conversation with Claude
public struct ClaudeMessage: Codable, Sendable {
    public let role: Role
    public let content: [ClaudeContent]

    public init(role: Role, content: [ClaudeContent]) {
        self.role = role
        self.content = content
    }

    /// Convenience initializer for text-only messages
    public init(role: Role, text: String) {
        self.role = role
        self.content = [ClaudeContent(type: .text, text: text)]
    }

    public enum Role: String, Codable, CaseIterable, Sendable {
        case user = "user"
        case assistant = "assistant"
    }
}

/// Content within a Claude message (text, image, etc.)
public struct ClaudeContent: Codable, Sendable {
    public let type: ContentType
    public let text: String

    public init(type: ContentType, text: String) {
        self.type = type
        self.text = text
    }

    public enum ContentType: String, Codable, CaseIterable, Sendable {
        case text = "text"
        // Future: image support could be added here
    }
}

// MARK: - Claude API Response Models

/// Response from Claude API
public struct ClaudeResponse: Codable, Sendable {
    public let id: String
    public let type: ResponseType
    public let role: String
    public let content: [ClaudeContent]
    public let model: String
    public let stopReason: StopReason?
    public let usage: ClaudeUsage

    public init(
        id: String,
        type: ResponseType,
        role: String,
        content: [ClaudeContent],
        model: String,
        stopReason: StopReason?,
        usage: ClaudeUsage
    ) {
        self.id = id
        self.type = type
        self.role = role
        self.content = content
        self.model = model
        self.stopReason = stopReason
        self.usage = usage
    }

    /// Coding keys for JSON deserialization with snake_case API
    private enum CodingKeys: String, CodingKey {
        case id
        case type
        case role
        case content
        case model
        case stopReason = "stop_reason"
        case usage
    }

    /// Extract text content from response
    public var textContent: String {
        return content
            .filter { $0.type == .text }
            .map { $0.text }
            .joined(separator: "\n")
    }

    public enum ResponseType: String, Codable, Sendable {
        case message = "message"
    }

    public enum StopReason: String, Codable, Sendable {
        case endTurn = "end_turn"
        case maxTokens = "max_tokens"
        case stopSequence = "stop_sequence"
    }
}

/// Token usage information from Claude API
public struct ClaudeUsage: Codable, Sendable {
    public let inputTokens: Int
    public let outputTokens: Int

    public init(inputTokens: Int, outputTokens: Int) {
        self.inputTokens = inputTokens
        self.outputTokens = outputTokens
    }

    /// Coding keys for JSON deserialization with snake_case API
    private enum CodingKeys: String, CodingKey {
        case inputTokens = "input_tokens"
        case outputTokens = "output_tokens"
    }

    /// Total tokens used in API call
    public var totalTokens: Int {
        return inputTokens + outputTokens
    }

    /// Estimated cost in USD (approximate rates as of 2024)
    public var estimatedCostUSD: Double {
        // Claude 3.5 Sonnet pricing (approximate)
        let inputCostPer1K = 0.003  // $3 per 1M input tokens
        let outputCostPer1K = 0.015 // $15 per 1M output tokens

        let inputCost = Double(inputTokens) / 1000.0 * inputCostPer1K
        let outputCost = Double(outputTokens) / 1000.0 * outputCostPer1K

        return inputCost + outputCost
    }
}

// MARK: - Error Models

/// Error response from Claude API
public struct ClaudeError: Codable, Sendable, Error, LocalizedError {
    public let type: ErrorType
    public let message: String

    public init(type: ErrorType, message: String) {
        self.type = type
        self.message = message
    }

    public enum ErrorType: String, Codable, CaseIterable, Sendable {
        case authentication = "authentication_error"
        case permission = "permission_error"
        case notFound = "not_found_error"
        case rateLimitExceeded = "rate_limit_error"
        case apiError = "api_error"
        case overloadedError = "overloaded_error"
        case invalidRequestError = "invalid_request_error"

        /// User-friendly description for terminal display
        public var userDescription: String {
            switch self {
            case .authentication:
                return "Authentication failed. Please check your API key."
            case .permission:
                return "Permission denied. Your API key may not have required access."
            case .notFound:
                return "API endpoint not found. Please check your configuration."
            case .rateLimitExceeded:
                return "Rate limit exceeded. Please wait before trying again."
            case .apiError:
                return "Claude API error occurred. Please try again later."
            case .overloadedError:
                return "Claude servers are overloaded. Please try again in a moment."
            case .invalidRequestError:
                return "Invalid request format. Please check your command."
            }
        }
    }

    public var errorDescription: String? {
        return "\(type.userDescription): \(message)"
    }

    public var localizedDescription: String {
        return errorDescription ?? "Unknown Claude API error"
    }
}

// MARK: - Configuration Models

/// Configuration for Claude API client
public struct APIConfiguration: Codable, Sendable {
    public let apiKey: String
    public let baseURL: String
    public let timeout: TimeInterval
    public let maxRetries: Int
    public let version: String

    public init(
        apiKey: String,
        baseURL: String = "https://api.anthropic.com",
        timeout: TimeInterval = 60.0,
        maxRetries: Int = 3,
        version: String = "2023-06-01"
    ) {
        self.apiKey = apiKey
        self.baseURL = baseURL
        self.timeout = timeout
        self.maxRetries = maxRetries
        self.version = version
    }

    /// Validate API configuration
    public func validate() -> ValidationResult {
        if apiKey.isEmpty {
            return .failure("API key cannot be empty")
        }

        if !apiKey.hasPrefix("sk-ant-") {
            return .failure("API key must start with 'sk-ant-'")
        }

        if timeout <= 0 {
            return .failure("Timeout must be positive")
        }

        if maxRetries < 0 {
            return .failure("Max retries cannot be negative")
        }

        guard let url = URL(string: baseURL), url.scheme != nil else {
            return .failure("Invalid base URL format")
        }

        return .success
    }

    public enum ValidationResult {
        case success
        case failure(String)
    }

    /// Headers for API requests
    public var headers: [String: String] {
        return [
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": version,
            "User-Agent": "Isometry/1.0 (iOS/macOS)"
        ]
    }
}

// MARK: - Debug Support

extension ClaudeRequest: CustomDebugStringConvertible {
    public var debugDescription: String {
        let messageCount = messages.count
        let messagePreview = messages.first?.content.first?.text.prefix(50) ?? ""
        return "ClaudeRequest(model: \(model), messages: \(messageCount), preview: \"\(messagePreview)...\")"
    }
}

extension ClaudeResponse: CustomDebugStringConvertible {
    public var debugDescription: String {
        let responsePreview = textContent.prefix(50)
        return "ClaudeResponse(id: \(id), tokens: \(usage.totalTokens), preview: \"\(responsePreview)...\")"
    }
}

extension ClaudeError: CustomDebugStringConvertible {
    public var debugDescription: String {
        return "ClaudeError(\(type.rawValue): \(message))"
    }
}

// MARK: - Convenience Extensions

extension ClaudeRequest {
    /// Create simple text request
    public static func text(
        prompt: String,
        model: String = "claude-3-5-sonnet-20241022",
        maxTokens: Int = 1000,
        temperature: Double = 0.7
    ) -> ClaudeRequest {
        let message = ClaudeMessage(role: .user, text: prompt)
        return ClaudeRequest(
            model: model,
            maxTokens: maxTokens,
            temperature: temperature,
            messages: [message]
        )
    }

    /// Create conversation request with history
    public static func conversation(
        messages: [ClaudeMessage],
        model: String = "claude-3-5-sonnet-20241022",
        maxTokens: Int = 1000,
        temperature: Double = 0.7
    ) -> ClaudeRequest {
        return ClaudeRequest(
            model: model,
            maxTokens: maxTokens,
            temperature: temperature,
            messages: messages
        )
    }
}

// MARK: - Shell Integration Support

/// Context enrichment for shell commands
public struct ShellContext: Codable, Sendable {
    public let workingDirectory: String
    public let recentCommands: [String]
    public let environment: [String: String]
    public let timestamp: Date

    public init(
        workingDirectory: String,
        recentCommands: [String] = [],
        environment: [String: String] = [:],
        timestamp: Date = Date()
    ) {
        self.workingDirectory = workingDirectory
        self.recentCommands = recentCommands
        self.environment = environment
        self.timestamp = timestamp
    }

    /// Format context for inclusion in Claude prompts
    public var formattedForPrompt: String {
        var context = ["# Shell Context"]

        context.append("Working Directory: \(workingDirectory)")

        if !recentCommands.isEmpty {
            context.append("\nRecent Commands:")
            for command in recentCommands.prefix(5) {
                context.append("  \(command)")
            }
        }

        if !environment.isEmpty {
            context.append("\nEnvironment Variables:")
            for (key, value) in environment.sorted(by: { $0.key < $1.key }).prefix(3) {
                // Only show safe environment variables
                if ["PATH", "HOME", "USER"].contains(key) {
                    context.append("  \(key)=\(value)")
                }
            }
        }

        context.append("") // Empty line before user prompt
        return context.joined(separator: "\n")
    }
}