import Foundation
import WebKit
import OSLog

/// D3 Canvas WebView message handler for bridging React D3 rendering commands to native Canvas
/// Manages render command processing, viewport synchronization, and performance optimization
public class D3CanvasMessageHandler: NSObject, WKScriptMessageHandler {
    // MARK: - Dependencies

    private let canvasRenderer: NativeCanvasRenderer
    private let logger = D3CanvasLogger()

    // MARK: - Performance Monitoring

    private let perfMonitor = D3CanvasPerformanceMonitor()

    // MARK: - Message Ordering

    private var lastSequenceId: UInt64 = 0
    private let sequenceLock = NSLock()

    // MARK: - Update Debouncing (60fps max frequency)

    private var debounceTimer: Timer?
    private var pendingRenderCommands: [D3RenderCommand] = []
    private var pendingViewport: D3Viewport?
    private let debounceInterval: TimeInterval = 0.016 // ~60fps (16ms)
    private let renderQueue = DispatchQueue(label: "d3-canvas-render", qos: .userInitiated)

    // MARK: - Initialization

    public init(canvasRenderer: NativeCanvasRenderer = NativeCanvasRenderer()) {
        self.canvasRenderer = canvasRenderer
        super.init()
        logger.info("D3CanvasMessageHandler initialized with NativeCanvasRenderer")
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
            logger.error("Failed to parse D3 Canvas message")
            sendError(to: message.webView, requestId: nil, error: "Invalid message format")
            return
        }

        // Sequence ID validation for ordering
        if !validateSequenceId(messageData.sequenceId) {
            logger.warning("Out-of-order D3 Canvas message received. Current: \(lastSequenceId), Received: \(messageData.sequenceId)")
            // Still process, but log the ordering issue
        }

        // Route message based on method
        Task { @MainActor in
            await handleD3CanvasMessage(messageData, webView: message.webView)
        }
    }

    // MARK: - Message Parsing

    private func parseMessage(_ message: WKScriptMessage) -> D3CanvasMessageData? {
        guard let messageBody = message.body as? [String: Any],
              let messageId = messageBody["id"] as? String,
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any] else {
            return nil
        }

        // Extract sequence ID (default to 0 if missing)
        let sequenceId = params["sequenceId"] as? UInt64 ?? 0

        return D3CanvasMessageData(
            id: messageId,
            method: method,
            params: params,
            sequenceId: sequenceId
        )
    }

    // MARK: - Message Processing

    @MainActor
    private func handleD3CanvasMessage(_ messageData: D3CanvasMessageData, webView: WKWebView?) async {
        switch messageData.method {
        case "renderCommands":
            await handleRenderCommands(messageData, webView: webView)

        case "canvasUpdate":
            await handleCanvasUpdate(messageData, webView: webView)

        case "getCapabilities":
            await handleGetCapabilities(messageData, webView: webView)

        default:
            logger.warning("Unknown D3 Canvas method: \(messageData.method)")
            sendError(to: webView, requestId: messageData.id, error: "Unknown method: \(messageData.method)")
        }
    }

    // MARK: - Message Handlers

    @MainActor
    private func handleRenderCommands(_ messageData: D3CanvasMessageData, webView: WKWebView?) async {
        let handlerId = perfMonitor.startRenderCommandsUpdate()
        defer { perfMonitor.endRenderCommandsUpdate(handlerId) }

        do {
            // Parse render commands array
            guard let commandsData = messageData.params["commands"] as? [[String: Any]] else {
                throw D3CanvasError.invalidRenderCommandsData
            }

            // Convert to D3RenderCommand structs
            let renderCommands = try commandsData.map { commandData -> D3RenderCommand in
                return try parseRenderCommand(commandData)
            }

            // Schedule debounced rendering
            await scheduleRenderUpdate(renderCommands, requestId: messageData.id, webView: webView)

            logger.debug("Render commands update scheduled: \(renderCommands.count) commands")

        } catch {
            logger.error("Failed to process render commands: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Render commands processing failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleCanvasUpdate(_ messageData: D3CanvasMessageData, webView: WKWebView?) async {
        let handlerId = perfMonitor.startCanvasUpdate()
        defer { perfMonitor.endCanvasUpdate(handlerId) }

        do {
            // Parse viewport parameters
            guard let viewportData = messageData.params["viewport"] as? [String: Any] else {
                throw D3CanvasError.invalidViewportData
            }

            let viewport = try parseViewport(viewportData)

            // Schedule debounced viewport update
            await scheduleViewportUpdate(viewport, requestId: messageData.id, webView: webView)

            logger.debug("Canvas update scheduled: \(viewport)")

        } catch {
            logger.error("Failed to process canvas update: \(error.localizedDescription)")
            sendError(to: webView, requestId: messageData.id, error: "Canvas update failed: \(error.localizedDescription)")
        }
    }

    @MainActor
    private func handleGetCapabilities(_ messageData: D3CanvasMessageData, webView: WKWebView?) async {
        // Query native rendering capabilities
        let capabilities = await canvasRenderer.getCapabilities()

        sendSuccess(to: webView, requestId: messageData.id, result: [
            "nativeRenderingAvailable": capabilities.nativeRenderingAvailable,
            "supportedShapes": capabilities.supportedShapes,
            "maxRenderCommands": capabilities.maxRenderCommands,
            "supportsGradients": capabilities.supportsGradients,
            "supportsTextMetrics": capabilities.supportsTextMetrics,
            "platform": capabilities.platform
        ])

        logger.debug("Canvas capabilities queried: \(capabilities)")
    }

    // MARK: - Command Parsing

    private func parseRenderCommand(_ commandData: [String: Any]) throws -> D3RenderCommand {
        guard let type = commandData["type"] as? String else {
            throw D3CanvasError.invalidCommandType
        }

        switch type {
        case "circle":
            return try parseCircleCommand(commandData)
        case "rectangle":
            return try parseRectangleCommand(commandData)
        case "path":
            return try parsePathCommand(commandData)
        case "text":
            return try parseTextCommand(commandData)
        case "group":
            return try parseGroupCommand(commandData)
        default:
            throw D3CanvasError.unsupportedCommandType(type)
        }
    }

    private func parseCircleCommand(_ data: [String: Any]) throws -> D3RenderCommand {
        guard let centerData = data["center"] as? [String: Any],
              let centerX = centerData["x"] as? Double,
              let centerY = centerData["y"] as? Double,
              let radius = data["radius"] as? Double else {
            throw D3CanvasError.invalidCircleData
        }

        let fill = parseColor(data["fill"] as? String)
        let stroke = parseColor(data["stroke"] as? String)
        let strokeWidth = data["strokeWidth"] as? Double ?? 1.0
        let opacity = data["opacity"] as? Double ?? 1.0

        return .circle(
            center: CGPoint(x: centerX, y: centerY),
            radius: radius,
            fill: fill,
            stroke: stroke,
            strokeWidth: strokeWidth,
            opacity: opacity
        )
    }

    private func parseRectangleCommand(_ data: [String: Any]) throws -> D3RenderCommand {
        guard let boundsData = data["bounds"] as? [String: Any],
              let x = boundsData["x"] as? Double,
              let y = boundsData["y"] as? Double,
              let width = boundsData["width"] as? Double,
              let height = boundsData["height"] as? Double else {
            throw D3CanvasError.invalidRectangleData
        }

        let fill = parseColor(data["fill"] as? String)
        let stroke = parseColor(data["stroke"] as? String)
        let strokeWidth = data["strokeWidth"] as? Double ?? 1.0
        let cornerRadius = data["cornerRadius"] as? Double ?? 0.0
        let opacity = data["opacity"] as? Double ?? 1.0

        return .rectangle(
            bounds: CGRect(x: x, y: y, width: width, height: height),
            fill: fill,
            stroke: stroke,
            strokeWidth: strokeWidth,
            cornerRadius: cornerRadius,
            opacity: opacity
        )
    }

    private func parsePathCommand(_ data: [String: Any]) throws -> D3RenderCommand {
        guard let pathData = data["path"] as? String else {
            throw D3CanvasError.invalidPathData
        }

        let fill = parseColor(data["fill"] as? String)
        let stroke = parseColor(data["stroke"] as? String)
        let strokeWidth = data["strokeWidth"] as? Double ?? 1.0
        let opacity = data["opacity"] as? Double ?? 1.0

        return .path(
            pathData: pathData,
            fill: fill,
            stroke: stroke,
            strokeWidth: strokeWidth,
            opacity: opacity
        )
    }

    private func parseTextCommand(_ data: [String: Any]) throws -> D3RenderCommand {
        guard let content = data["content"] as? String,
              let positionData = data["position"] as? [String: Any],
              let x = positionData["x"] as? Double,
              let y = positionData["y"] as? Double else {
            throw D3CanvasError.invalidTextData
        }

        let color = parseColor(data["color"] as? String) ?? .black
        let fontSize = data["fontSize"] as? Double ?? 12.0
        let fontFamily = data["fontFamily"] as? String ?? "System"
        let alignment = TextAlignment(rawValue: data["alignment"] as? String ?? "left") ?? .left
        let opacity = data["opacity"] as? Double ?? 1.0

        return .text(
            content: content,
            position: CGPoint(x: x, y: y),
            color: color,
            fontSize: fontSize,
            fontFamily: fontFamily,
            alignment: alignment,
            opacity: opacity
        )
    }

    private func parseGroupCommand(_ data: [String: Any]) throws -> D3RenderCommand {
        guard let transformData = data["transform"] as? [String: Any] else {
            throw D3CanvasError.invalidGroupData
        }

        let transform = try parseTransform(transformData)

        // Parse child commands
        let childrenData = data["children"] as? [[String: Any]] ?? []
        let children = try childrenData.map { try parseRenderCommand($0) }

        let opacity = data["opacity"] as? Double ?? 1.0

        return .group(
            transform: transform,
            children: children,
            opacity: opacity
        )
    }

    private func parseTransform(_ data: [String: Any]) throws -> CGAffineTransform {
        let translateX = data["translateX"] as? Double ?? 0.0
        let translateY = data["translateY"] as? Double ?? 0.0
        let scaleX = data["scaleX"] as? Double ?? 1.0
        let scaleY = data["scaleY"] as? Double ?? 1.0
        let rotation = data["rotation"] as? Double ?? 0.0

        var transform = CGAffineTransform.identity
        transform = transform.translatedBy(x: translateX, y: translateY)
        transform = transform.scaledBy(x: scaleX, y: scaleY)
        transform = transform.rotated(by: rotation)

        return transform
    }

    private func parseViewport(_ data: [String: Any]) throws -> D3Viewport {
        guard let x = data["x"] as? Double,
              let y = data["y"] as? Double,
              let width = data["width"] as? Double,
              let height = data["height"] as? Double,
              let scale = data["scale"] as? Double else {
            throw D3CanvasError.invalidViewportData
        }

        return D3Viewport(
            x: x,
            y: y,
            width: width,
            height: height,
            scale: scale
        )
    }

    private func parseColor(_ colorString: String?) -> CGColor? {
        guard let colorString = colorString else { return nil }

        // Handle hex colors (#RRGGBB, #RGB)
        if colorString.hasPrefix("#") {
            let hex = String(colorString.dropFirst())

            if hex.count == 6 {
                let scanner = Scanner(string: hex)
                var rgbValue: UInt64 = 0
                scanner.scanHexInt64(&rgbValue)

                let r = Double((rgbValue & 0xFF0000) >> 16) / 255.0
                let g = Double((rgbValue & 0x00FF00) >> 8) / 255.0
                let b = Double(rgbValue & 0x0000FF) / 255.0

                return CGColor(red: r, green: g, blue: b, alpha: 1.0)
            } else if hex.count == 3 {
                let scanner = Scanner(string: hex)
                var rgbValue: UInt64 = 0
                scanner.scanHexInt64(&rgbValue)

                let r = Double((rgbValue & 0xF00) >> 8) / 15.0
                let g = Double((rgbValue & 0x0F0) >> 4) / 15.0
                let b = Double(rgbValue & 0x00F) / 15.0

                return CGColor(red: r, green: g, blue: b, alpha: 1.0)
            }
        }

        // Handle named colors
        switch colorString.lowercased() {
        case "black":
            return CGColor.black
        case "white":
            return CGColor.white
        case "red":
            return CGColor(red: 1.0, green: 0.0, blue: 0.0, alpha: 1.0)
        case "green":
            return CGColor(red: 0.0, green: 1.0, blue: 0.0, alpha: 1.0)
        case "blue":
            return CGColor(red: 0.0, green: 0.0, blue: 1.0, alpha: 1.0)
        default:
            return nil
        }
    }

    // MARK: - Debounced Updates

    @MainActor
    private func scheduleRenderUpdate(_ commands: [D3RenderCommand], requestId: String, webView: WKWebView?) async {
        // Cancel existing debounce timer
        debounceTimer?.invalidate()

        // Store pending render commands
        pendingRenderCommands = commands

        // Schedule debounced execution
        debounceTimer = Timer.scheduledTimer(withTimeInterval: debounceInterval, repeats: false) { [weak self] _ in
            Task { @MainActor in
                await self?.executePendingRender(requestId: requestId, webView: webView)
            }
        }
    }

    @MainActor
    private func scheduleViewportUpdate(_ viewport: D3Viewport, requestId: String, webView: WKWebView?) async {
        // Store pending viewport (viewport updates don't need debouncing as much)
        pendingViewport = viewport

        // Apply viewport immediately for responsiveness
        await canvasRenderer.updateViewport(viewport)

        sendSuccess(to: webView, requestId: requestId, result: [
            "viewportUpdated": true,
            "viewport": [
                "x": viewport.x,
                "y": viewport.y,
                "width": viewport.width,
                "height": viewport.height,
                "scale": viewport.scale
            ]
        ])

        logger.debug("Viewport updated immediately: \(viewport)")
    }

    @MainActor
    private func executePendingRender(requestId: String, webView: WKWebView?) async {
        guard !pendingRenderCommands.isEmpty else { return }

        let commands = pendingRenderCommands
        let viewport = pendingViewport

        // Execute render on background queue
        let renderStartTime = CFAbsoluteTimeGetCurrent()

        do {
            let renderResult = try await canvasRenderer.render(
                commands: commands,
                viewport: viewport
            )

            let renderDuration = CFAbsoluteTimeGetCurrent() - renderStartTime

            // Send success response
            sendSuccess(to: webView, requestId: requestId, result: [
                "commandsRendered": commands.count,
                "renderTime": renderDuration,
                "primitiveCount": renderResult.primitiveCount,
                "memoryUsage": renderResult.memoryUsage
            ])

            // Clear pending commands
            pendingRenderCommands = []

            logger.debug("Executed render: \(commands.count) commands in \(renderDuration * 1000)ms")

        } catch {
            logger.error("Failed to execute render: \(error.localizedDescription)")
            sendError(to: webView, requestId: requestId, error: "Render execution failed: \(error.localizedDescription)")
        }
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
                        self?.logger.error("Failed to send D3 Canvas bridge response: \(error)")
                    }
                }
            }
        } catch {
            logger.error("Failed to serialize D3 Canvas bridge response: \(error)")
        }
    }

    // MARK: - Performance Statistics

    public var performanceStats: D3CanvasPerformanceStats {
        return perfMonitor.getStats()
    }
}

// MARK: - Supporting Types

struct D3CanvasMessageData {
    let id: String
    let method: String
    let params: [String: Any]
    let sequenceId: UInt64
}

public struct D3Viewport: Hashable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double
    public let scale: Double

    public init(x: Double, y: Double, width: Double, height: Double, scale: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
        self.scale = scale
    }
}

public enum TextAlignment: String, CaseIterable {
    case left = "left"
    case center = "center"
    case right = "right"
}

// MARK: - D3 Canvas Errors

enum D3CanvasError: Error, LocalizedError {
    case invalidRenderCommandsData
    case invalidViewportData
    case invalidCommandType
    case unsupportedCommandType(String)
    case invalidCircleData
    case invalidRectangleData
    case invalidPathData
    case invalidTextData
    case invalidGroupData
    case renderingFailed(String)

    var errorDescription: String? {
        switch self {
        case .invalidRenderCommandsData:
            return "Invalid render commands data format"
        case .invalidViewportData:
            return "Invalid viewport data format"
        case .invalidCommandType:
            return "Missing or invalid command type"
        case .unsupportedCommandType(let type):
            return "Unsupported command type: \(type)"
        case .invalidCircleData:
            return "Invalid circle command data"
        case .invalidRectangleData:
            return "Invalid rectangle command data"
        case .invalidPathData:
            return "Invalid path command data"
        case .invalidTextData:
            return "Invalid text command data"
        case .invalidGroupData:
            return "Invalid group command data"
        case .renderingFailed(let reason):
            return "Rendering failed: \(reason)"
        }
    }
}

// MARK: - Performance Monitoring

class D3CanvasPerformanceMonitor {
    private var messageCount: Int64 = 0
    private var totalMessageTime: TimeInterval = 0
    private var renderCommandsCount: Int64 = 0
    private var canvasUpdateCount: Int64 = 0
    private var capabilityQueriesCount: Int64 = 0

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

    func startRenderCommandsUpdate() -> UUID {
        lock.lock()
        renderCommandsCount += 1
        lock.unlock()
        return UUID()
    }

    func endRenderCommandsUpdate(_ id: UUID) {
        // Tracking end for potential future latency measurement
    }

    func startCanvasUpdate() -> UUID {
        lock.lock()
        canvasUpdateCount += 1
        lock.unlock()
        return UUID()
    }

    func endCanvasUpdate(_ id: UUID) {
        // Tracking end for potential future latency measurement
    }

    func getStats() -> D3CanvasPerformanceStats {
        lock.lock()
        defer { lock.unlock() }

        let avgMessageTime = messageCount > 0 ? totalMessageTime / TimeInterval(messageCount) : 0

        return D3CanvasPerformanceStats(
            messageCount: messageCount,
            averageMessageTime: avgMessageTime,
            renderCommandsUpdates: renderCommandsCount,
            canvasUpdates: canvasUpdateCount,
            capabilityQueries: capabilityQueriesCount
        )
    }
}

public struct D3CanvasPerformanceStats {
    let messageCount: Int64
    let averageMessageTime: TimeInterval
    let renderCommandsUpdates: Int64
    let canvasUpdates: Int64
    let capabilityQueries: Int64
}

// MARK: - Logging

struct D3CanvasLogger {
    private let subsystem = "IsometryD3Canvas"
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