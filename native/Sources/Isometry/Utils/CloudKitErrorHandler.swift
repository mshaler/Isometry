import CloudKit
import Foundation

/// Utility for handling CloudKit errors with user-friendly messages
/// and retry logic with exponential backoff
public struct CloudKitErrorHandler {
    // MARK: - Error Types

    /// User-friendly sync errors
    public enum UserFacingError: LocalizedError, Sendable {
        case networkUnavailable
        case notAuthenticated
        case quotaExceeded
        case serverError(String)
        case partialFailure(failedCount: Int, totalCount: Int)
        case rateLimited(retryAfter: TimeInterval)
        case unknownError(String)

        public var errorDescription: String? {
            switch self {
            case .networkUnavailable:
                return "No internet connection. Changes will sync when online."
            case .notAuthenticated:
                return "Sign in to iCloud to sync your notes."
            case .quotaExceeded:
                return "iCloud storage full. Free up space to continue syncing."
            case .serverError(let message):
                return "Sync error: \(message)"
            case .partialFailure(let failed, let total):
                return "\(failed) of \(total) items failed to sync."
            case .rateLimited(let retryAfter):
                return "Too many requests. Retrying in \(Int(retryAfter)) seconds."
            case .unknownError(let message):
                return "An error occurred: \(message)"
            }
        }

        public var recoverySuggestion: String? {
            switch self {
            case .networkUnavailable:
                return "Check your internet connection and try again."
            case .notAuthenticated:
                return "Open Settings > [Your Name] > iCloud and sign in."
            case .quotaExceeded:
                return "Go to Settings > [Your Name] > iCloud > Manage Storage."
            case .serverError:
                return "Try again later. If the problem persists, contact support."
            case .partialFailure:
                return "Some items will be retried automatically."
            case .rateLimited:
                return "The sync will resume automatically."
            case .unknownError:
                return "Try again later."
            }
        }

        /// Whether this error should trigger an automatic retry
        public var isRetryable: Bool {
            switch self {
            case .networkUnavailable, .rateLimited, .partialFailure, .serverError:
                return true
            case .notAuthenticated, .quotaExceeded, .unknownError:
                return false
            }
        }

        /// Suggested delay before retry (nil if not retryable)
        public var suggestedRetryDelay: TimeInterval? {
            switch self {
            case .rateLimited(let retryAfter):
                return retryAfter
            case .networkUnavailable:
                return 30 // Wait 30 seconds for network
            case .partialFailure:
                return 5 // Quick retry for partial failures
            case .serverError:
                return 60 // Wait a minute for server issues
            default:
                return nil
            }
        }
    }

    // MARK: - Error Handling

    /// Converts a CKError to a user-friendly error
    /// - Parameter error: The CloudKit error to handle
    /// - Returns: A user-friendly error, or nil if the error is not a CKError
    public static func handle(_ error: Error) -> UserFacingError? {
        guard let ckError = error as? CKError else {
            return .unknownError(error.localizedDescription)
        }

        return handleCKError(ckError)
    }

    /// Handles a specific CKError
    private static func handleCKError(_ error: CKError) -> UserFacingError {
        switch error.code {
        case .networkUnavailable, .networkFailure:
            return .networkUnavailable

        case .notAuthenticated:
            return .notAuthenticated

        case .quotaExceeded:
            return .quotaExceeded

        case .requestRateLimited, .serviceUnavailable:
            let retryAfter = error.retryAfterSeconds ?? 60
            return .rateLimited(retryAfter: retryAfter)

        case .partialFailure:
            let failedRecords = extractPartialFailures(from: error)
            return .partialFailure(failedCount: failedRecords.count, totalCount: failedRecords.count)

        case .serverRecordChanged:
            return .serverError("Record conflict detected")

        case .unknownItem:
            return .serverError("Record not found on server")

        case .assetFileNotFound:
            return .serverError("Attachment not found")

        case .operationCancelled:
            return .serverError("Operation was cancelled")

        case .serverRejectedRequest:
            return .serverError("Server rejected the request")

        case .zoneNotFound:
            return .serverError("Sync zone not found. Try signing out and back in.")

        case .internalError:
            return .serverError("iCloud internal error")

        case .permissionFailure:
            return .serverError("Permission denied. Check iCloud settings.")

        case .badContainer:
            return .serverError("Invalid iCloud container configuration")

        default:
            return .unknownError(error.localizedDescription)
        }
    }

    /// Extracts individual record failures from a partial failure error
    private static func extractPartialFailures(from error: CKError) -> [CKRecord.ID: Error] {
        guard let partialErrors = error.partialErrorsByItemID else {
            return [:]
        }

        var failures: [CKRecord.ID: Error] = [:]
        for (recordID, itemError) in partialErrors {
            if let ckRecordID = recordID as? CKRecord.ID {
                failures[ckRecordID] = itemError
            }
        }
        return failures
    }

    // MARK: - Retry Logic

    /// Configuration for exponential backoff retry logic
    public struct RetryConfiguration {
        public let maxRetries: Int
        public let baseDelay: TimeInterval
        public let maxDelay: TimeInterval
        public let jitterFactor: Double

        public static let `default` = RetryConfiguration(
            maxRetries: 5,
            baseDelay: 1.0,
            maxDelay: 300.0,
            jitterFactor: 0.2
        )

        public init(maxRetries: Int, baseDelay: TimeInterval, maxDelay: TimeInterval, jitterFactor: Double) {
            self.maxRetries = maxRetries
            self.baseDelay = baseDelay
            self.maxDelay = maxDelay
            self.jitterFactor = jitterFactor
        }
    }

    /// Calculates the delay for a retry attempt using exponential backoff with jitter
    /// - Parameters:
    ///   - attempt: The retry attempt number (1-indexed)
    ///   - config: The retry configuration
    /// - Returns: The delay in seconds before the next retry
    public static func retryDelay(attempt: Int, config: RetryConfiguration = .default) -> TimeInterval {
        // Exponential backoff: baseDelay * 2^(attempt-1)
        let exponentialDelay = config.baseDelay * pow(2.0, Double(attempt - 1))

        // Cap at maxDelay
        let cappedDelay = min(exponentialDelay, config.maxDelay)

        // Add jitter to prevent thundering herd
        let jitterRange = cappedDelay * config.jitterFactor
        let jitter = Double.random(in: -jitterRange...jitterRange)

        return max(config.baseDelay, cappedDelay + jitter)
    }

    /// Executes an async operation with automatic retry on retryable errors
    /// - Parameters:
    ///   - config: The retry configuration
    ///   - operation: The async operation to execute
    /// - Returns: The result of the operation
    public static func withRetry<T>(
        config: RetryConfiguration = .default,
        operation: @escaping () async throws -> T
    ) async throws -> T {
        var lastError: Error?
        var attempt = 0

        while attempt < config.maxRetries {
            attempt += 1

            do {
                return try await operation()
            } catch {
                lastError = error

                guard let userError = handle(error), userError.isRetryable else {
                    throw error
                }

                if attempt < config.maxRetries {
                    let delay = userError.suggestedRetryDelay ?? retryDelay(attempt: attempt, config: config)
                    try await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
                }
            }
        }

        throw lastError ?? CKError(.internalError)
    }

    // MARK: - Logging

    /// Logs a CloudKit error with context
    public static func logError(_ error: Error, context: String? = nil) {
        let userError = handle(error)
        let contextPrefix = context.map { "[\($0)] " } ?? ""

        if let userError {
            print("\(contextPrefix)CloudKit Error: \(userError.errorDescription ?? "Unknown")")
            if let suggestion = userError.recoverySuggestion {
                print("  Suggestion: \(suggestion)")
            }
            print("  Retryable: \(userError.isRetryable)")
        } else {
            print("\(contextPrefix)Error: \(error.localizedDescription)")
        }
    }
}

// MARK: - CKError Extension

extension CKError {
    /// Returns the retry-after interval for rate-limited errors
    var retryAfterSeconds: TimeInterval? {
        return userInfo[CKErrorRetryAfterKey] as? TimeInterval
    }
}
