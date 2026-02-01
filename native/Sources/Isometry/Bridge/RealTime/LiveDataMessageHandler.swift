import Foundation
import WebKit
import OSLog

/// Message handler for live data bridge operations
/// Implements WKScriptMessageHandler to process liveData messages from React
/// Delegates to ChangeNotificationBridge for actual database observation functionality
public class LiveDataMessageHandler: NSObject, WKScriptMessageHandler {

    // MARK: - Properties

    private var database: IsometryDatabase?
    private let logger = Logger(subsystem: "IsometryBridge", category: "LiveDataHandler")
    private var changeNotificationBridge: ChangeNotificationBridge?

    // MARK: - Initialization

    public init(database: IsometryDatabase? = nil) {
        self.database = database
        super.init()
        logger.info("LiveDataMessageHandler initialized")
    }

    /// Connect to database after initialization (follows WebViewBridge pattern)
    public func setDatabase(_ database: IsometryDatabase) async {
        self.database = database
        logger.info("LiveDataMessageHandler database connected")
    }

    /// Set up the ChangeNotificationBridge with WebView instance
    @MainActor
    public func setupLiveDataBridge(with webView: WKWebView) {
        guard let database = database else {
            logger.warning("Cannot setup live data bridge without database")
            return
        }

        changeNotificationBridge = ChangeNotificationBridge(
            database: database,
            webView: webView
        )
        logger.info("ChangeNotificationBridge configured for live data notifications")
    }

    // MARK: - WKScriptMessageHandler

    public func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        Task {
            await handleLiveDataMessage(message)
        }
    }

    // MARK: - Message Handling

    /// Handle liveData-specific messages with correlation tracking
    private func handleLiveDataMessage(_ message: WKScriptMessage) async {
        guard let messageBody = message.body as? [String: Any],
              let method = messageBody["method"] as? String,
              let params = messageBody["params"] as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            await sendError(
                to: message.webView,
                error: "Invalid liveData message format",
                requestId: extractRequestId(from: message)
            )
            return
        }

        // Extract correlation ID for tracking (SYNC-05)
        let correlationId = params["correlationId"] as? String ?? UUID().uuidString
        logger.info("Handling liveData message: \(method) (correlation: \(correlationId))")

        // Ensure database is available
        guard let database = database else {
            await sendError(
                to: message.webView,
                error: "Database not connected",
                requestId: requestId
            )
            return
        }

        // Ensure ChangeNotificationBridge is available
        guard let changeNotificationBridge = changeNotificationBridge else {
            await sendError(
                to: message.webView,
                error: "Live data bridge not initialized",
                requestId: requestId
            )
            return
        }

        do {
            switch method {
            case "startObservation":
                await handleStartObservation(
                    params: params,
                    correlationId: correlationId,
                    requestId: requestId,
                    webView: message.webView,
                    bridge: changeNotificationBridge
                )

            case "stopObservation":
                await handleStopObservation(
                    params: params,
                    correlationId: correlationId,
                    requestId: requestId,
                    webView: message.webView,
                    bridge: changeNotificationBridge
                )

            case "getStatistics":
                await handleGetStatistics(
                    correlationId: correlationId,
                    requestId: requestId,
                    webView: message.webView,
                    bridge: changeNotificationBridge
                )

            default:
                throw LiveDataBridgeError.unknownMethod(method)
            }

        } catch {
            await sendError(
                to: message.webView,
                error: "LiveData error: \(error.localizedDescription)",
                requestId: requestId
            )
        }
    }

    // MARK: - Method Handlers

    private func handleStartObservation(
        params: [String: Any],
        correlationId: String,
        requestId: String,
        webView: WKWebView?,
        bridge: ChangeNotificationBridge
    ) async {
        guard let observationId = params["observationId"] as? String,
              let sql = params["sql"] as? String else {
            await sendError(
                to: webView,
                error: "Missing required parameters: observationId and sql",
                requestId: requestId
            )
            return
        }

        let paramsArray = params["params"] as? [Any] ?? []
        let actualObservationId = await bridge.startObservation(
            sql: sql,
            arguments: paramsArray
        )

        await sendResponse(
            to: webView,
            requestId: requestId,
            result: [
                "success": true,
                "observationId": actualObservationId,
                "correlationId": correlationId
            ]
        )
    }

    private func handleStopObservation(
        params: [String: Any],
        correlationId: String,
        requestId: String,
        webView: WKWebView?,
        bridge: ChangeNotificationBridge
    ) async {
        guard let observationId = params["observationId"] as? String else {
            await sendError(
                to: webView,
                error: "Missing required parameter: observationId",
                requestId: requestId
            )
            return
        }

        await bridge.stopObservation(observationId: observationId)
        await sendResponse(
            to: webView,
            requestId: requestId,
            result: [
                "success": true,
                "observationId": observationId,
                "correlationId": correlationId
            ]
        )
    }

    private func handleGetStatistics(
        correlationId: String,
        requestId: String,
        webView: WKWebView?,
        bridge: ChangeNotificationBridge
    ) async {
        let statistics = await bridge.getObservationStatistics()
        await sendResponse(
            to: webView,
            requestId: requestId,
            result: [
                "success": true,
                "statistics": statistics,
                "correlationId": correlationId
            ]
        )
    }

    // MARK: - Helper Methods

    private func extractRequestId(from message: WKScriptMessage) -> String? {
        guard let messageBody = message.body as? [String: Any],
              let requestId = messageBody["id"] as? String else {
            return nil
        }
        return requestId
    }

    /// Send error response back to WebView
    @MainActor
    private func sendError(to webView: WKWebView?, error: String, requestId: String?) async {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId ?? "",
            "success": false,
            "error": error
        ]

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            webView.evaluateJavaScript(script) { [weak self] _, error in
                if let error = error {
                    self?.logger.error("Failed to send bridge error: \(error)")
                }
            }
        } catch {
            logger.error("Failed to serialize bridge error response: \(error)")
        }
    }

    /// Send successful response back to WebView
    @MainActor
    private func sendResponse(to webView: WKWebView?, requestId: String, result: [String: Any]) async {
        guard let webView = webView else { return }

        let response: [String: Any] = [
            "id": requestId,
            "success": true,
            "result": result
        ]

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response)
            let responseString = String(data: responseData, encoding: .utf8) ?? "{}"

            let script = "window._isometryBridge?.handleResponse(\(responseString))"

            webView.evaluateJavaScript(script) { [weak self] _, error in
                if let error = error {
                    self?.logger.error("Failed to send response: \(error)")
                }
            }
        } catch {
            logger.error("Failed to serialize response: \(error)")
        }
    }
}

// MARK: - Error Types

public enum LiveDataBridgeError: Error, LocalizedError {
    case missingParameters(String)
    case bridgeNotInitialized
    case unknownMethod(String)

    public var errorDescription: String? {
        switch self {
        case .missingParameters(let details):
            return "Missing required parameters: \(details)"
        case .bridgeNotInitialized:
            return "Live data bridge not initialized"
        case .unknownMethod(let method):
            return "Unknown live data method: \(method)"
        }
    }
}

// MARK: - Logger Extension

private extension Logger {
    func info(_ message: String) {
        #if DEBUG
        print("[\(subsystem):\(category)] INFO: \(message)")
        #endif
    }

    func error(_ message: String) {
        print("[\(subsystem):\(category)] ERROR: \(message)")
    }
}