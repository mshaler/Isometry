/**
 * MessageBatcher Actor for WebView Bridge Optimization
 *
 * Implements 16ms message batching with Swift async/await, queue management,
 * and Timer-based delivery for high-performance native-web communication.
 * Follows Swift concurrency patterns with proper actor isolation.
 */

import Foundation
import QuartzCore
import OSLog

/// Represents a batch message waiting to be sent
public struct BatchMessage: Sendable {
    public let id: String
    public let handler: String
    public let method: String
    public let params: [String: Any]
    public let timestamp: TimeInterval
    public let continuation: UnsafeContinuation<Any?, Error>

    public init(
        id: String,
        handler: String,
        method: String,
        params: [String: Any],
        timestamp: TimeInterval,
        continuation: UnsafeContinuation<Any?, Error>
    ) {
        self.id = id
        self.handler = handler
        self.method = method
        self.params = params
        self.timestamp = timestamp
        self.continuation = continuation
    }
}

/// Configuration options for MessageBatcher
public struct BatcherOptions: Sendable {
    public let maxBatchSize: Int
    public let maxQueueSize: Int
    public let batchInterval: TimeInterval
    public let enableBackpressure: Bool

    public init(
        maxBatchSize: Int = 100,
        maxQueueSize: Int = 1000,
        batchInterval: TimeInterval = 0.016, // 16ms for 60fps
        enableBackpressure: Bool = true
    ) {
        self.maxBatchSize = maxBatchSize
        self.maxQueueSize = maxQueueSize
        self.batchInterval = batchInterval
        self.enableBackpressure = enableBackpressure
    }
}

/// Metrics for monitoring MessageBatcher performance
public struct BatchMetrics: Sendable {
    public let queueSize: Int
    public let batchesSent: Int
    public let messagesProcessed: Int
    public let averageBatchSize: Double
    public let lastBatchTime: TimeInterval?
    public let isBackpressured: Bool
    public let droppedMessages: Int

    public init(
        queueSize: Int,
        batchesSent: Int,
        messagesProcessed: Int,
        averageBatchSize: Double,
        lastBatchTime: TimeInterval?,
        isBackpressured: Bool,
        droppedMessages: Int
    ) {
        self.queueSize = queueSize
        self.batchesSent = batchesSent
        self.messagesProcessed = messagesProcessed
        self.averageBatchSize = averageBatchSize
        self.lastBatchTime = lastBatchTime
        self.isBackpressured = isBackpressured
        self.droppedMessages = droppedMessages
    }
}

/// MessageBatcher actor manages high-frequency bridge messages with batching and backpressure
@MainActor
public final class MessageBatcher: ObservableObject {
    // MARK: - Properties

    private let options: BatcherOptions
    private let sendBatchFunction: ([BatchMessage]) async throws -> Void
    private let logger = Logger(subsystem: "com.isometry.bridge", category: "MessageBatcher")

    // Queue management
    private var messageQueue: [BatchMessage] = []
    private var batchTimer: Timer?

    // Metrics tracking
    private var batchesSent = 0
    private var messagesProcessed = 0
    private var droppedMessages = 0
    private var lastBatchTime: TimeInterval?
    private var isBackpressured = false

    // MARK: - Initialization

    /// Initialize MessageBatcher with send function and options
    /// - Parameters:
    ///   - sendBatch: Async function to send message batches
    ///   - options: Configuration options for batching behavior
    public init(
        sendBatch: @escaping ([BatchMessage]) async throws -> Void,
        options: BatcherOptions = BatcherOptions()
    ) {
        self.sendBatchFunction = sendBatch
        self.options = options

        logger.debug("MessageBatcher initialized with interval: \(options.batchInterval)s, maxBatch: \(options.maxBatchSize), maxQueue: \(options.maxQueueSize)")
    }

    // MARK: - Public Interface

    /// Queue a message for batched delivery
    /// - Parameters:
    ///   - id: Unique message identifier
    ///   - handler: Target handler name
    ///   - method: Method to invoke
    ///   - params: Message parameters
    /// - Returns: Result from message processing
    public func queueMessage(
        id: String,
        handler: String,
        method: String,
        params: [String: Any] = [:]
    ) async throws -> Any? {
        return try await withUnsafeThrowingContinuation { continuation in
            Task { @MainActor in
                // Check for backpressure
                if options.enableBackpressure && messageQueue.count >= options.maxQueueSize {
                    handleQueueOverflow()
                    continuation.resume(throwing: MessageBatcherError.queueOverflow("Queue overflow: \(options.maxQueueSize) messages"))
                    return
                }

                let message = BatchMessage(
                    id: id,
                    handler: handler,
                    method: method,
                    params: params,
                    timestamp: CACurrentMediaTime(),
                    continuation: continuation
                )

                messageQueue.append(message)

                // Start batch timer if not already running
                if batchTimer == nil {
                    startBatchTimer()
                }

                // Immediate flush if batch is full
                if messageQueue.count >= options.maxBatchSize {
                    await flushBatch()
                }
            }
        }
    }

    /// Immediately flush all queued messages
    public func flushBatch() async {
        // Stop timer
        stopBatchTimer()

        // Nothing to flush
        guard !messageQueue.isEmpty else { return }

        // Extract batch from queue
        let batch = Array(messageQueue.prefix(options.maxBatchSize))
        messageQueue.removeFirst(min(options.maxBatchSize, messageQueue.count))
        lastBatchTime = CACurrentMediaTime()

        // Log batch processing start
        let startTime = CACurrentMediaTime()
        let signpostID = OSSignpostID(log: logger.osLog)
        os_signpost(.begin, log: logger.osLog, name: "batch_processing",
                   signpostID: signpostID, "Processing batch of %d messages", batch.count)

        do {
            // Send batch to bridge
            try await sendBatchFunction(batch)

            // Update metrics
            batchesSent += 1
            messagesProcessed += batch.count
            isBackpressured = false

            // Complete batch processing timing
            let duration = CACurrentMediaTime() - startTime
            os_signpost(.end, log: logger.osLog, name: "batch_processing",
                       signpostID: signpostID, "Completed in %.2fms", duration * 1000)

            logger.debug("Batch sent successfully: \(batch.count) messages in \(duration * 1000)ms")

            // Note: Individual message responses will be handled by the bridge response handler
            // The batch sending itself is successful, but individual message results
            // will be resolved via the normal bridge response mechanism

        } catch {
            // Batch send failed - reject all messages in this batch
            let batchError = MessageBatcherError.batchSendFailed(error.localizedDescription)

            for message in batch {
                message.continuation.resume(throwing: batchError)
            }

            logger.error("Batch send failed: \(error.localizedDescription)")
            // Note: Don't rethrow here since we've already handled the error
            // by rejecting individual message continuations
        }

        // If there are more messages queued, schedule next batch
        if !messageQueue.isEmpty {
            startBatchTimer()
        }
    }

    /// Get current batcher metrics
    public func getMetrics() -> BatchMetrics {
        let averageBatchSize = batchesSent > 0 ? Double(messagesProcessed) / Double(batchesSent) : 0

        return BatchMetrics(
            queueSize: messageQueue.count,
            batchesSent: batchesSent,
            messagesProcessed: messagesProcessed,
            averageBatchSize: averageBatchSize,
            lastBatchTime: lastBatchTime,
            isBackpressured: isBackpressured,
            droppedMessages: droppedMessages
        )
    }

    /// Reset metrics (useful for testing)
    public func resetMetrics() {
        batchesSent = 0
        messagesProcessed = 0
        droppedMessages = 0
        lastBatchTime = nil
        isBackpressured = false
    }

    /// Get current queue size
    public func getQueueSize() -> Int {
        return messageQueue.count
    }

    /// Check if batcher is currently processing
    public func isActive() -> Bool {
        return batchTimer != nil || !messageQueue.isEmpty
    }

    /// Clear all pending messages (useful for cleanup)
    public func clear() {
        stopBatchTimer()

        // Reject all pending messages
        for message in messageQueue {
            message.continuation.resume(throwing: MessageBatcherError.cancelled("Message cancelled during batcher cleanup"))
        }

        // Clear queue
        messageQueue.removeAll()
        isBackpressured = false

        logger.debug("MessageBatcher cleared: \(messageQueue.count) messages cancelled")
    }

    /// Graceful shutdown - flush remaining messages then clear
    public func shutdown() async {
        do {
            // Flush any remaining messages
            if !messageQueue.isEmpty {
                await flushBatch()
            }
        } catch {
            logger.error("Error during shutdown flush: \(error.localizedDescription)")
        }

        clear()
        logger.debug("MessageBatcher shutdown completed")
    }

    // MARK: - Private Methods

    /// Start the batch timer for periodic flushing
    private func startBatchTimer() {
        guard batchTimer == nil else { return }

        batchTimer = Timer.scheduledTimer(withTimeInterval: options.batchInterval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.flushBatch()
            }
        }
    }

    /// Stop the batch timer
    private func stopBatchTimer() {
        batchTimer?.invalidate()
        batchTimer = nil
    }

    /// Handle queue overflow with backpressure
    private func handleQueueOverflow() {
        // Drop oldest messages to make room (10% of capacity)
        let dropCount = max(1, options.maxQueueSize / 10)
        let droppedBatch = Array(messageQueue.prefix(dropCount))
        messageQueue.removeFirst(min(dropCount, messageQueue.count))

        // Reject dropped messages
        for message in droppedBatch {
            message.continuation.resume(throwing: MessageBatcherError.dropped("Message dropped due to queue overflow"))
        }

        droppedMessages += dropCount
        isBackpressured = true

        logger.warning("Queue overflow: dropped \(dropCount) messages. Queue size: \(messageQueue.count)")
    }
}

// MARK: - Error Types

/// Errors that can occur during message batching
public enum MessageBatcherError: LocalizedError, Sendable {
    case queueOverflow(String)
    case batchSendFailed(String)
    case cancelled(String)
    case dropped(String)

    public var errorDescription: String? {
        switch self {
        case .queueOverflow(let message):
            return "Queue overflow: \(message)"
        case .batchSendFailed(let message):
            return "Batch send failed: \(message)"
        case .cancelled(let message):
            return "Cancelled: \(message)"
        case .dropped(let message):
            return "Dropped: \(message)"
        }
    }
}

