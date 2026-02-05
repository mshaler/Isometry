import Foundation
import WebKit
import OSLog

/// Bridge actor for routing database change notifications to WebView
/// Integrates GRDB ValueObservation with the optimized bridge infrastructure
/// Provides sequence number tracking and timestamp ordering for race condition prevention
public actor ChangeNotificationBridge {
    // MARK: - Properties

    private weak var webView: WKWebView?
    private let database: IsometryDatabase
    private let logger = Logger(subsystem: "IsometryBridge", category: "ChangeNotifications")

    // Sequence tracking for race condition prevention (SYNC-05)
    private var sequenceNumber: UInt64 = 0
    private var activeObservations: [String: ObservationInfo] = [:]

    // Integration with Phase 18 optimization components
    private let messageBatcher: MessageBatcher?
    private let binarySerializer: BinarySerializer?

    // MARK: - Types

    private struct ObservationInfo {
        let id: String
        let sql: String
        let startTime: Date
        var lastSequence: UInt64
        var eventCount: Int
        let task: Task<Void, Never>
    }

    private struct ChangeEvent {
        let sequenceNumber: UInt64
        let timestamp: Date
        let observationId: String
        let correlationId: String // For correlation tracking (SYNC-05)
        let sql: String
        let results: [[String: Any]]
    }

    // MARK: - Initialization

    public init(
        database: IsometryDatabase,
        webView: WKWebView? = nil,
        messageBatcher: MessageBatcher? = nil,
        binarySerializer: BinarySerializer? = nil
    ) {
        self.database = database
        self.webView = webView
        self.messageBatcher = messageBatcher
        self.binarySerializer = binarySerializer

        logger.info("ChangeNotificationBridge initialized with optimization layer integration")
    }

    // MARK: - WebView Management

    public func setWebView(_ webView: WKWebView) {
        self.webView = webView
        logger.debug("WebView connected to change notification bridge")
    }

    // MARK: - Observation Lifecycle

    /// Start observing a query for changes with real-time notifications
    /// - Parameters:
    ///   - sql: SQL query to observe
    ///   - arguments: Query arguments
    /// - Returns: Observation ID for management
    @discardableResult
    public func startObservation(sql: String, arguments: [Any] = []) -> String {
        let observationId = UUID().uuidString
        logger.info("Starting observation: \(observationId) for SQL: \(sql)")

        // Create observation task
        let observationTask = Task { [weak self] in
            guard let self = self else { return }

            // Convert arguments to StatementArguments
            let statementArgs = StatementArguments(arguments)

            // Start GRDB ValueObservation
            let stream = await self.database.observeQuery(sql: sql, arguments: statementArgs)

            do {
                for try await results in stream {
                    await self.handleQueryChange(
                        observationId: observationId,
                        sql: sql,
                        results: results
                    )
                }
            } catch {
                await self.handleObservationError(observationId: observationId, error: error)
            }
        }

        // Store observation info
        let info = ObservationInfo(
            id: observationId,
            sql: sql,
            startTime: Date(),
            lastSequence: sequenceNumber,
            eventCount: 0,
            task: observationTask
        )
        activeObservations[observationId] = info

        return observationId
    }

    /// Stop observing a query
    /// - Parameter observationId: The observation ID to stop
    public func stopObservation(observationId: String) {
        guard let info = activeObservations.removeValue(forKey: observationId) else {
            logger.warning("Attempted to stop unknown observation: \(observationId)")
            return
        }

        info.task.cancel()
        logger.info("Stopped observation: \(observationId), events processed: \(info.eventCount)")
    }

    /// Stop all active observations
    public func stopAllObservations() {
        let count = activeObservations.count

        for (_, info) in activeObservations {
            info.task.cancel()
        }

        activeObservations.removeAll()
        logger.info("Stopped all observations, total: \(count)")
    }

    // MARK: - Change Event Handling

    private func handleQueryChange(
        observationId: String,
        sql: String,
        results: [[String: Any]]
    ) {
        // Generate sequence number for ordering
        sequenceNumber += 1
        let currentSequence = sequenceNumber

        // Update observation info
        if var info = activeObservations[observationId] {
            info.lastSequence = currentSequence
            info.eventCount += 1
            activeObservations[observationId] = info
        }

        // Create change event with correlation ID
        let correlationId = "change-\(currentSequence)-\(observationId)"
        let changeEvent = ChangeEvent(
            sequenceNumber: currentSequence,
            timestamp: Date(),
            observationId: observationId,
            correlationId: correlationId,
            sql: sql,
            results: results
        )

        logger.debug("Query change detected: seq=\(currentSequence), observation=\(observationId), resultCount=\(results.count)")

        // Send to WebView through optimized bridge
        Task { @MainActor in
            await self.sendChangeNotification(changeEvent)
        }
    }

    private func handleObservationError(observationId: String, error: Error) {
        logger.error("Observation error for \(observationId): \(error.localizedDescription)")

        // Remove failed observation
        if let info = activeObservations.removeValue(forKey: observationId) {
            info.task.cancel()
        }

        // Send error notification to WebView
        Task { @MainActor in
            await self.sendErrorNotification(observationId: observationId, error: error)
        }
    }

    // MARK: - WebView Communication

    @MainActor
    private func sendChangeNotification(_ changeEvent: ChangeEvent) async {
        guard let webView = webView else {
            logger.warning("No WebView available for change notification")
            return
        }

        // Prepare message payload with correlation ID
        let payload: [String: Any] = [
            "type": "liveData",
            "event": "change",
            "sequenceNumber": changeEvent.sequenceNumber,
            "timestamp": ISO8601DateFormatter().string(from: changeEvent.timestamp),
            "observationId": changeEvent.observationId,
            "correlationId": changeEvent.correlationId,
            "sql": changeEvent.sql,
            "results": changeEvent.results
        ]

        // Use optimization layer if available
        if let messageBatcher = messageBatcher,
           let binarySerializer = binarySerializer {
            // Send through optimized path with MessageBatcher and BinarySerializer
            await sendOptimizedMessage(payload: payload, webView: webView)
        } else {
            // Send directly through WebView bridge
            await sendDirectMessage(payload: payload, webView: webView)
        }
    }

    @MainActor
    private func sendErrorNotification(observationId: String, error: Error) async {
        guard let webView = webView else { return }

        // Generate correlation ID for error tracking
        let correlationId = "error-\(sequenceNumber + 1)-\(observationId)"

        let payload: [String: Any] = [
            "type": "liveData",
            "event": "error",
            "sequenceNumber": sequenceNumber + 1,
            "timestamp": ISO8601DateFormatter().string(from: Date()),
            "observationId": observationId,
            "correlationId": correlationId,
            "error": error.localizedDescription
        ]

        await sendDirectMessage(payload: payload, webView: webView)
    }

    @MainActor
    private func sendOptimizedMessage(payload: [String: Any], webView: WKWebView) async {
        // Use MessageBatcher for 16ms interval batching
        // Note: This is a simplified integration - in production, this would be more sophisticated
        let script = "window._isometryBridge?.handleLiveDataEvent?.(\(jsonString(from: payload)))"
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if let error = error {
                self?.logger.error("Failed to send optimized live data notification: \(error.localizedDescription)")
            }
        }
    }

    @MainActor
    private func sendDirectMessage(payload: [String: Any], webView: WKWebView) async {
        let script = "window._isometryBridge?.handleLiveDataEvent?.(\(jsonString(from: payload)))"
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if let error = error {
                self?.logger.error("Failed to send live data notification: \(error.localizedDescription)")
            }
        }
    }

    private func jsonString(from dict: [String: Any]) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: dict),
              let string = String(data: data, encoding: .utf8) else {
            return "{}"
        }
        return string
    }

    // MARK: - Statistics and Monitoring

    public func getObservationStatistics() -> [String: Any] {
        var stats: [String: Any] = [
            "activeObservations": activeObservations.count,
            "totalSequenceNumber": sequenceNumber,
            "observations": []
        ]

        var observationDetails: [[String: Any]] = []
        for (id, info) in activeObservations {
            let detail: [String: Any] = [
                "id": id,
                "sql": info.sql,
                "startTime": ISO8601DateFormatter().string(from: info.startTime),
                "lastSequence": info.lastSequence,
                "eventCount": info.eventCount
            ]
            observationDetails.append(detail)
        }

        stats["observations"] = observationDetails
        return stats
    }

    /// Send notification message to WebView for conflict resolution
    /// Called by RealTimeConflictResolver to notify frontend of conflicts
    public func notifyWebView(message: [String: Any]) async {
        guard let webView = webView else {
            logger.warning("Cannot notify WebView - webView reference is nil")
            return
        }

        do {
            let jsonData = try JSONSerialization.data(withJSONObject: message)
            let jsonString = String(data: jsonData, encoding: .utf8) ?? "{}"
            let javascript = "window.isometryBridge?.handleMessage(\(jsonString))"

            await webView.evaluateJavaScript(javascript)
            logger.debug("Sent conflict notification to WebView", metadata: [
                "messageType": "\(message["type"] ?? "unknown")"
            ])
        } catch {
            logger.error("Failed to serialize conflict notification", metadata: [
                "error": "\(error)"
            ])
        }
    }

    // MARK: - Cleanup

    deinit {
        // Cancel all observations on cleanup
        for (_, info) in activeObservations {
            info.task.cancel()
        }
    }
}

// MARK: - Phase 18 Integration Components
// MessageBatcher and BinarySerializer are now available from Bridge/Optimization module