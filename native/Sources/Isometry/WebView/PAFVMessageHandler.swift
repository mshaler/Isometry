import Foundation
import WebKit
import os.signpost

/// PAFV-specific WebView message handler for bridging React PAFV state to native ViewConfig
/// Handles real-time axis mapping, viewport, and coordinate synchronization between React and Swift
public class PAFVMessageHandler: NSObject, WKScriptMessageHandler {
    // MARK: - Dependencies

    private weak var viewModel: SuperGridViewModel?
    private let logger = PAFVLogger()

    // MARK: - Performance Monitoring

    private let perfMonitor = PAFVPerformanceMonitor()

    // MARK: - Message Ordering

    private var lastSequenceId: UInt64 = 0
    private let sequenceLock = NSLock()

    // MARK: - Update Debouncing (60fps max frequency)

    private var debounceTimer: Timer?
    private var pendingUpdate: PAFVUpdate?
    private let debounceInterval: TimeInterval = 0.016 // ~60fps (16ms)
    private let updateQueue = DispatchQueue(label: "pafv-updates", qos: .userInteractive)

    // MARK: - Initialization

    public init(viewModel: SuperGridViewModel?) {
        self.viewModel = viewModel
        super.init()
        logger.info("PAFVMessageHandler initialized with SuperGridViewModel")
    }

    // MARK: - WKScriptMessageHandler

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        let messageStartTime = CFAbsoluteTimeGetCurrent()
        let messageId = perfMonitor.startMessageProcessing()

        defer {
            perfMonitor.endMessageProcessing(messageId, startTime: messageStartTime)
        }

        // Parse message with type safety
        guard let messageData = parseMessage(message) else {
            logger.error("Failed to parse PAFV message")
            sendError(to: message.webView, requestId: nil, error: "Invalid message format")
            return
        }

        // Sequence ID validation for ordering
        if !validateSequenceId(messageData.sequenceId) {
            logger.warning("Out-of-order message received. Current: \(lastSequenceId), Received: \(messageData.sequenceId)")
            // Still process, but log the ordering issue
        }

        // Route message based on method
        Task { @MainActor in
            await handlePAFVMessage(messageData, webView: message.webView)
        }
    }

    // MARK: - Message Parsing

    private func parseMessage(_ message: WKScriptMessage) -> PAFVMessageData? {
        guard let messageBody = message.body as? [String: Any],
              let messageId = messageBody["id"] as? String,
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any] else {
            return nil
        }

        // Extract sequence ID (default to 0 if missing)
        let sequenceId = params["sequenceId"] as? UInt64 ?? 0

        return PAFVMessageData(
            id: messageId,
            method: method,
            params: params,
            sequenceId: sequenceId
        )
    }

    // MARK: - Message Processing

    @MainActor
    private func handlePAFVMessage(_ messageData: PAFVMessageData, webView: WKWebView?) async {
        do {
            switch messageData.method {
            case "updateAxisMapping":
                await handleUpdateAxisMapping(messageData, webView: webView)

            case "updateViewport":
                await handleUpdateViewport(messageData, webView: webView)

            case "syncCoordinates":
                await handleSyncCoordinates(messageData, webView: webView)

            default:
                logger.warning("Unknown PAFV method: \(messageData.method)")
                sendError(to: webView, requestId: messageData.id, error: "Unknown method: \(messageData.method)")
            }
        } catch {
            logger.error("Error processing PAFV message: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: error.localizedDescription)
        }
    }

    // MARK: - Message Handlers

    @MainActor
    private func handleUpdateAxisMapping(_ messageData: PAFVMessageData, webView: WKWebView?) async {
        let handlerId = perfMonitor.startAxisMappingUpdate()
        defer { perfMonitor.endAxisMappingUpdate(handlerId) }

        do {
            // Parse React AxisMapping[] to ViewConfig
            let pafvState = try parsePAFVState(from: messageData.params)

            // Create ViewConfig from PAFV state
            let newConfig = try ViewConfig.fromPAFVState(
                pafvState,
                sequenceId: messageData.sequenceId,
                baseConfig: viewModel?.currentConfig ?? ViewConfig.default
            )

            // Debounced update to SuperGridViewModel
            await scheduleViewConfigUpdate(newConfig, requestId: messageData.id, webView: webView)

            logger.debug("Axis mapping update scheduled: x=\(newConfig.xAxisMapping), y=\(newConfig.yAxisMapping)")

        } catch {
            logger.error("Failed to process axis mapping update: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Axis mapping processing failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleUpdateViewport(_ messageData: PAFVMessageData, webView: WKWebView?) async {
        let handlerId = perfMonitor.startViewportUpdate()
        defer { perfMonitor.endViewportUpdate(handlerId) }

        do {
            // Parse viewport parameters
            let zoomLevel = messageData.params["zoomLevel"] as? Double ?? 1.0
            let panOffsetX = messageData.params["panOffsetX"] as? Double ?? 0.0
            let panOffsetY = messageData.params["panOffsetY"] as? Double ?? 0.0

            // Validate viewport bounds
            let clampedZoom = max(0.1, min(zoomLevel, 10.0))
            let clampedPanX = max(-5000, min(panOffsetX, 5000))
            let clampedPanY = max(-5000, min(panOffsetY, 5000))

            guard let currentConfig = viewModel?.currentConfig else {
                throw PAFVError.viewModelNotAvailable
            }

            // Update viewport in ViewConfig
            var updatedConfig = currentConfig
            updatedConfig.zoomLevel = clampedZoom
            updatedConfig.panOffsetX = clampedPanX
            updatedConfig.panOffsetY = clampedPanY
            updatedConfig.sequenceId = messageData.sequenceId
            updatedConfig.lastPAFVUpdate = Date()

            // Apply to view model immediately (viewport changes should be real-time)
            viewModel?.updateFromPAFV(updatedConfig)

            // Send success response
            sendSuccess(to: webView, requestId: messageData.id, result: [
                "zoomLevel": clampedZoom,
                "panOffsetX": clampedPanX,
                "panOffsetY": clampedPanY
            ])

            logger.debug("Viewport updated: zoom=\(clampedZoom), pan=(\(clampedPanX), \(clampedPanY))")

        } catch {
            logger.error("Failed to process viewport update: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Viewport update failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleSyncCoordinates(_ messageData: PAFVMessageData, webView: WKWebView?) async {
        let handlerId = perfMonitor.startCoordinateSync()
        defer { perfMonitor.endCoordinateSync(handlerId) }

        do {
            // Parse coordinate data
            guard let coordinatesData = messageData.params["coordinates"] as? [[String: Any]] else {
                throw PAFVError.invalidCoordinateData
            }

            // Convert to coordinate transformations
            let transformations = try coordinatesData.map { coordData -> CoordinateTransformation in
                guard let nodeId = coordData["nodeId"] as? String,
                      let x = coordData["x"] as? Double,
                      let y = coordData["y"] as? Double else {
                    throw PAFVError.invalidCoordinateFormat
                }

                return CoordinateTransformation(
                    nodeId: nodeId,
                    d3X: x,
                    d3Y: y,
                    sequenceId: messageData.sequenceId
                )
            }

            // Apply transformations via CoordinateTransformer
            let transformer = CoordinateTransformer.shared
            await transformer.applyBatchTransformations(transformations)

            // Trigger SuperGridViewModel update
            await viewModel?.updateFromCoordinateSync(transformations)

            // Send success response with processed count
            sendSuccess(to: webView, requestId: messageData.id, result: [
                "processedCount": transformations.count,
                "sequenceId": messageData.sequenceId
            ])

            logger.debug("Coordinate sync processed \(transformations.count) transformations")

        } catch {
            logger.error("Failed to process coordinate sync: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Coordinate sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Debounced Updates

    @MainActor
    private func scheduleViewConfigUpdate(_ config: ViewConfig, requestId: String, webView: WKWebView?) async {
        // Cancel existing debounce timer
        debounceTimer?.invalidate()

        // Store pending update
        pendingUpdate = PAFVUpdate(
            config: config,
            requestId: requestId,
            webView: webView,
            timestamp: Date()
        )

        // Schedule debounced execution
        debounceTimer = Timer.scheduledTimer(withTimeInterval: debounceInterval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.executePendingUpdate()
            }
        }
    }

    @MainActor
    private func executePendingUpdate() async {
        guard let update = pendingUpdate else { return }

        // Apply to view model
        await viewModel?.updateFromPAFV(update.config)

        // Send success response
        sendSuccess(to: update.webView, requestId: update.requestId, result: [
            "success": true,
            "sequenceId": update.config.sequenceId,
            "timestamp": ISO8601DateFormatter().string(from: update.timestamp)
        ])

        // Clear pending update
        pendingUpdate = nil

        logger.debug("Executed debounced ViewConfig update with sequence ID: \(update.config.sequenceId)")
    }

    // MARK: - Sequence ID Validation

    private func validateSequenceId(_ sequenceId: UInt64) -> Bool {
        sequenceLock.lock()
        defer { sequenceLock.unlock() }

        if sequenceId > lastSequenceId {
            lastSequenceId = sequenceId
            return true
        }

        return false
    }

    // MARK: - PAFV State Parsing

    private func parsePAFVState(from params: [String: Any]) throws -> PAFVState {
        guard let mappingsData = params["mappings"] as? [[String: Any]],
              let viewMode = params["viewMode"] as? String else {
            throw PAFVError.invalidPAFVState
        }

        let mappings = try mappingsData.map { mappingData -> PAFVAxisMapping in
            guard let plane = mappingData["plane"] as? String,
                  let axis = mappingData["axis"] as? String,
                  let facet = mappingData["facet"] as? String else {
                throw PAFVError.invalidAxisMapping
            }

            return PAFVAxisMapping(plane: plane, axis: axis, facet: facet)
        }

        return PAFVState(mappings: mappings, viewMode: viewMode)
    }

    // MARK: - Response Helpers

    private func sendSuccess(to webView: WKWebView?, requestId: String, result: [String: Any]) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result
        ]

        sendJSResponse(to: webView, response: response)
    }

    private func sendError(to webView: WKWebView?, requestId: String?, error: String) {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        sendJSResponse(to: webView, response: response)
    }

    private func sendJSResponse(to webView: WKWebView, response: [String: Any]) {
        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            DispatchQueue.main.async {
                webView.evaluateJavaScript(script) { [weak self] _, error in
                    if let error = error {
                        self?.logger.error("Failed to send PAFV bridge response: \(error)")
                    }
                }
            }
        } catch {
            logger.error("Failed to serialize PAFV bridge response: \(error)")
        }
    }

    // MARK: - Performance Statistics

    public var performanceStats: PAFVPerformanceStats {
        return perfMonitor.getStats()
    }
}

// MARK: - Supporting Types

struct PAFVMessageData {
    let id: String
    let method: String
    let params: [String: Any]
    let sequenceId: UInt64
}

struct PAFVUpdate {
    let config: ViewConfig
    let requestId: String
    let webView: WKWebView?
    let timestamp: Date
}

// MARK: - PAFVState Types (compatible with ViewConfig extension)
struct PAFVState {
    let mappings: [PAFVAxisMapping]
    let viewMode: String
}

struct AxisMapping {
    let plane: String
    let axis: String
    let facet: String
}

// MARK: - PAFV Errors

enum PAFVError: Error, LocalizedError {
    case viewModelNotAvailable
    case invalidPAFVState
    case invalidAxisMapping
    case invalidCoordinateData
    case invalidCoordinateFormat
    case sequenceOrderingError

    var errorDescription: String? {
        switch self {
        case .viewModelNotAvailable:
            return "SuperGridViewModel is not available"
        case .invalidPAFVState:
            return "Invalid PAFV state format"
        case .invalidAxisMapping:
            return "Invalid axis mapping data"
        case .invalidCoordinateData:
            return "Invalid coordinate data format"
        case .invalidCoordinateFormat:
            return "Invalid coordinate transformation format"
        case .sequenceOrderingError:
            return "Message sequence ordering error"
        }
    }
}

// MARK: - Performance Monitoring

class PAFVPerformanceMonitor {
    private var messageCount: Int64 = 0
    private var totalMessageTime: TimeInterval = 0
    private var axisMappingCount: Int64 = 0
    private var viewportUpdateCount: Int64 = 0
    private var coordinateSyncCount: Int64 = 0

    private let performanceQueue = DispatchQueue(label: "pafv-perf", qos: .utility)
    private let lock = NSLock()

    func startMessageProcessing() -> UUID {
        return UUID()
    }

    func endMessageProcessing(_ id: UUID, startTime: CFAbsoluteTime) {
        let duration = CFAbsoluteTimeGetCurrent() - startTime

        lock.lock()
        messageCount += 1
        totalMessageTime += duration
        lock.unlock()
    }

    func startAxisMappingUpdate() -> UUID {
        lock.lock()
        axisMappingCount += 1
        lock.unlock()
        return UUID()
    }

    func endAxisMappingUpdate(_ id: UUID) {
        // Tracking end for potential future latency measurement
    }

    func startViewportUpdate() -> UUID {
        lock.lock()
        viewportUpdateCount += 1
        lock.unlock()
        return UUID()
    }

    func endViewportUpdate(_ id: UUID) {
        // Tracking end for potential future latency measurement
    }

    func startCoordinateSync() -> UUID {
        lock.lock()
        coordinateSyncCount += 1
        lock.unlock()
        return UUID()
    }

    func endCoordinateSync(_ id: UUID) {
        // Tracking end for potential future latency measurement
    }

    func getStats() -> PAFVPerformanceStats {
        lock.lock()
        defer { lock.unlock() }

        let avgMessageTime = messageCount > 0 ? totalMessageTime / TimeInterval(messageCount) : 0

        return PAFVPerformanceStats(
            messageCount: messageCount,
            averageMessageTime: avgMessageTime,
            axisMappingUpdates: axisMappingCount,
            viewportUpdates: viewportUpdateCount,
            coordinateSyncs: coordinateSyncCount
        )
    }
}

struct PAFVPerformanceStats {
    let messageCount: Int64
    let averageMessageTime: TimeInterval
    let axisMappingUpdates: Int64
    let viewportUpdates: Int64
    let coordinateSyncs: Int64
}

// MARK: - Logging

struct PAFVLogger {
    private let subsystem = "IsometryPAFV"
    private let category = "Bridge"

    func debug(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] DEBUG: \(message)")
        #endif
    }

    func info(_ message: String) {
        print("[\(subsystem):\(category)] INFO: \(message)")
    }

    func warning(_ message: String) {
        print("[\(subsystem):\(category)] WARNING: \(message)")
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}