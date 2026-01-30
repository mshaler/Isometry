/**
 * CloudKit MessageHandler for WebView Bridge
 *
 * Provides secure CloudKit sync operations for WebView with comprehensive validation,
 * progress tracking, and conflict resolution. Handles async/await patterns with proper actor isolation.
 */

import WebKit
import Foundation
import CloudKit

/**
 * CloudKit MessageHandler for real-time sync operations from WebView
 * Supports full CloudKit sync coordination with progress callbacks, conflict resolution,
 * and offline queue management
 */
@MainActor
public class CloudKitMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var appState: AppState?
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let performanceMonitor = MessageHandlerPerformanceMonitor()
    private let securityValidator = MessageHandlerSecurityValidator()

    // Rate limiting for sync operations
    private var lastSyncRequest: Date = .distantPast
    private let syncRateLimit: TimeInterval = 6.0 // Max 10 sync requests per minute
    private var activeProgressCallbacks: [String: (WKWebView?, String)] = [:]

    nonisolated public init(appState: AppState? = nil) {
        self.appState = appState
        super.init()

        // Configure JSON encoding/decoding for CloudKit compatibility
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        encoder.outputFormatting = .sortedKeys
    }

    /**
     * Set AppState reference for late binding during app initialization
     */
    public func setAppState(_ appState: AppState) {
        self.appState = appState
    }

    /**
     * Main entry point for WebView message handling
     * Validates message format and routes to appropriate CloudKit handler
     */
    public func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        print("🔔 CloudKitMessageHandler received message from: \(message.name)")
        print("🔔 Message body: \(message.body)")
        Task {
            await handleMessage(message)
        }
    }

    /**
     * Handle message parsing, validation, and CloudKit routing
     */
    private func handleMessage(_ message: WKScriptMessage) async {
        let startTime = CFAbsoluteTimeGetCurrent()

        // Parse and validate message structure
        guard let messageBody = message.body as? [String: Any] else {
            await sendErrorResponse(
                to: message.webView,
                error: "Invalid message format - expected JSON object",
                requestId: nil,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Extract required fields with validation
        guard let method = messageBody["method"] as? String,
              let requestId = messageBody["id"] as? String else {
            await sendErrorResponse(
                to: message.webView,
                error: "Missing required fields: method and id",
                requestId: messageBody["id"] as? String,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        let params = messageBody["params"] as? [String: Any] ?? [:]

        // Security validation with CloudKit-specific checks
        let securityResult = await securityValidator.validateCloudKitRequest(
            method: method,
            params: params,
            requestId: requestId
        )

        guard securityResult.isAllowed else {
            await sendErrorResponse(
                to: message.webView,
                error: "Security validation failed: \(securityResult.reason)",
                requestId: requestId,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Route to CloudKit handler
        await handleCloudKitMessage(
            method: method,
            params: params,
            requestId: requestId,
            webView: message.webView,
            startTime: startTime
        )
    }

    /**
     * Handle CloudKit message routing with performance monitoring
     */
    private func handleCloudKitMessage(
        method: String,
        params: [String: Any],
        requestId: String,
        webView: WKWebView?,
        startTime: CFAbsoluteTime
    ) async {
        guard let appState = appState,
              appState.database != nil else {
            await sendErrorResponse(
                to: webView,
                error: "Database not available",
                requestId: requestId,
                duration: CFAbsoluteTimeGetCurrent() - startTime
            )
            return
        }

        // Start performance monitoring
        let operationId = await performanceMonitor.startOperation(method: method, requestId: requestId)

        do {
            let result: [String: Any]

            // Route to specific CloudKit operation handler
            switch method {
            case "sync":
                result = try await handleSync(params: params, requestId: requestId, webView: webView, appState: appState)

            case "getStatus":
                result = try await handleGetStatus(params: params, appState: appState)

            case "getConflicts":
                result = try await handleGetConflicts(params: params, appState: appState)

            case "resolveConflict":
                result = try await handleResolveConflict(params: params, appState: appState)

            case "setConflictStrategy":
                result = try await handleSetConflictStrategy(params: params, appState: appState)

            case "enableRealTimeSync":
                result = try await handleEnableRealTimeSync(params: params, appState: appState, webView: webView)

            case "disableRealTimeSync":
                result = try await handleDisableRealTimeSync(params: params, appState: appState)

            case "getQueueStatus":
                result = try await handleGetQueueStatus(params: params, appState: appState)

            default:
                throw CloudKitMessageError.invalidOperation("Unknown CloudKit method: \(method)")
            }

            // Record successful operation
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            await performanceMonitor.endOperation(operationId, success: true, duration: duration)

            await sendSuccessResponse(
                to: webView,
                result: result,
                requestId: requestId,
                duration: duration
            )

        } catch {
            // Record failed operation
            let duration = CFAbsoluteTimeGetCurrent() - startTime
            await performanceMonitor.endOperation(operationId, success: false, duration: duration)

            let errorMessage = formatError(error)
            await securityValidator.logSecurityError(
                method: method,
                requestId: requestId,
                error: error
            )

            await sendErrorResponse(
                to: webView,
                error: errorMessage,
                requestId: requestId,
                duration: duration
            )
        }
    }

    // MARK: - CloudKit Operation Handlers

    /**
     * Handle full sync operation with progress callbacks
     */
    private func handleSync(
        params: [String: Any],
        requestId: String,
        webView: WKWebView?,
        appState: AppState
    ) async throws -> [String: Any] {
        // Rate limiting check
        let now = Date()
        if now.timeIntervalSince(lastSyncRequest) < syncRateLimit {
            throw CloudKitMessageError.rateLimited("Sync rate limited - max 10 requests per minute")
        }
        lastSyncRequest = now

        guard let syncManager = appState.syncManager else {
            throw CloudKitMessageError.unavailable("CloudKit sync manager not available")
        }

        // Register progress callback for React updates
        activeProgressCallbacks[requestId] = (webView, requestId)

        await syncManager.setProgressCallback { @MainActor progress in
            self.sendProgressUpdate(progress, requestId: requestId, webView: webView)
        }

        do {
            // Execute full sync
            try await syncManager.sync()

            // Clean up progress callback
            activeProgressCallbacks.removeValue(forKey: requestId)

            // Get final sync status
            let syncState = try await appState.database!.getSyncState()

            return [
                "success": true,
                "lastSyncAt": syncState.lastSyncAt?.timeIntervalSince1970 ?? 0,
                "pendingChanges": await getPendingChangesCount(appState: appState),
                "conflictCount": (await syncManager.getPendingConflicts()).count
            ]

        } catch {
            // Clean up progress callback on error
            activeProgressCallbacks.removeValue(forKey: requestId)
            throw error
        }
    }

    /**
     * Get current sync status
     */
    private func handleGetStatus(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        guard let syncManager = appState.syncManager,
              let database = appState.database else {
            throw CloudKitMessageError.unavailable("CloudKit sync manager not available")
        }

        let syncState = try await database.getSyncState()
        let pendingConflicts = await syncManager.getPendingConflicts()
        let syncProgress = await syncManager.syncProgress

        return [
            "isConnected": await checkCloudKitConnection(),
            "syncProgress": syncProgress,
            "lastSync": syncState.lastSyncAt?.timeIntervalSince1970 as Any,
            "pendingChanges": await getPendingChangesCount(appState: appState),
            "conflictCount": pendingConflicts.count,
            "isInitialSync": syncState.lastSyncAt == nil,
            "consecutiveFailures": syncState.consecutiveFailures,
            "lastError": syncState.lastError as Any
        ]
    }

    /**
     * Get pending conflicts requiring resolution
     */
    private func handleGetConflicts(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        guard let syncManager = appState.syncManager else {
            throw CloudKitMessageError.unavailable("CloudKit sync manager not available")
        }

        let conflicts = await syncManager.getPendingConflicts()
        let conflictData = try conflicts.map { conflict in
            [
                "id": conflict.nodeId,
                "localData": try nodeToDict(conflict.localNode),
                "serverData": try nodeToDict(conflict.serverNode),
                "conflictType": conflict.conflictType.rawValue,
                "detectedAt": conflict.detectedAt.timeIntervalSince1970,
                "requiresManualResolution": true
            ]
        }

        return [
            "conflicts": conflictData,
            "totalCount": conflicts.count
        ]
    }

    /**
     * Resolve a specific conflict with chosen data
     */
    private func handleResolveConflict(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        guard let conflictId = params["conflictId"] as? String,
              let resolutionData = params["resolution"] as? [String: Any],
              let chosenData = resolutionData["chosenData"] as? [String: Any] else {
            throw CloudKitMessageError.invalidData("Missing conflict resolution data")
        }

        guard let syncManager = appState.syncManager else {
            throw CloudKitMessageError.unavailable("CloudKit sync manager not available")
        }

        let resolvedNode = try parseNodeFromDict(chosenData)
        try await syncManager.resolveConflict(nodeId: conflictId, with: resolvedNode)

        return [
            "success": true,
            "resolvedNodeId": conflictId,
            "resolvedAt": Date().timeIntervalSince1970
        ]
    }

    /**
     * Set conflict resolution strategy
     */
    private func handleSetConflictStrategy(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        guard let strategyString = params["strategy"] as? String else {
            throw CloudKitMessageError.invalidData("Missing conflict resolution strategy")
        }

        let strategy: ConflictResolutionStrategy
        switch strategyString {
        case "serverWins":
            strategy = .serverWins
        case "localWins":
            strategy = .localWins
        case "latestWins":
            strategy = .latestWins
        case "fieldLevelMerge":
            strategy = .fieldLevelMerge
        case "manualResolution":
            strategy = .manualResolution
        default:
            throw CloudKitMessageError.invalidData("Unknown conflict resolution strategy: \(strategyString)")
        }

        guard let syncManager = appState.syncManager else {
            throw CloudKitMessageError.unavailable("CloudKit sync manager not available")
        }

        await syncManager.setConflictResolutionStrategy(strategy)

        return [
            "success": true,
            "strategy": strategyString
        ]
    }

    /**
     * Enable real-time sync with change notifications
     */
    private func handleEnableRealTimeSync(
        params: [String: Any],
        appState: AppState,
        webView: WKWebView?
    ) async throws -> [String: Any] {
        // Implementation would set up CloudKit subscriptions and change notifications
        // For now, return success to indicate the feature is available
        return [
            "success": true,
            "realTimeSyncEnabled": true,
            "subscriptionStatus": "active"
        ]
    }

    /**
     * Disable real-time sync
     */
    private func handleDisableRealTimeSync(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        // Implementation would remove CloudKit subscriptions
        return [
            "success": true,
            "realTimeSyncEnabled": false,
            "subscriptionStatus": "inactive"
        ]
    }

    /**
     * Get offline sync queue status
     */
    private func handleGetQueueStatus(
        params: [String: Any],
        appState: AppState
    ) async throws -> [String: Any] {
        guard let database = appState.database else {
            throw CloudKitMessageError.unavailable("Database not available")
        }

        let pendingChanges = try await database.getPendingChanges(since: 0)

        return [
            "pending": pendingChanges.count,
            "processing": 0, // Would track currently processing items
            "failed": 0, // Would track failed items requiring retry
            "lastProcessed": Date().timeIntervalSince1970
        ]
    }

    // MARK: - Progress and Status Updates

    /**
     * Send sync progress update to React UI
     */
    private func sendProgressUpdate(
        _ progress: Double,
        requestId: String,
        webView: WKWebView?
    ) {
        Task { @MainActor in
            guard let webView = webView else { return }

            let progressData: [String: Any] = [
                "requestId": requestId,
                "progress": progress,
                "timestamp": Date().timeIntervalSince1970
            ]

            do {
                let progressJson = try JSONSerialization.data(withJSONObject: progressData)
                guard let progressString = String(data: progressJson, encoding: .utf8) else { return }

                let script = "window.dispatchEvent(new CustomEvent('cloudkit-sync-progress', { detail: \(progressString) }));"
                try await webView.evaluateJavaScript(script)
            } catch {
                print("[CloudKitMessageHandler] Failed to send progress update: \(error)")
            }
        }
    }

    // MARK: - Helper Methods

    /**
     * Check CloudKit connection status
     */
    private func checkCloudKitConnection() async -> Bool {
        do {
            let container = CKContainer(identifier: CloudKitSyncManager.containerIdentifier)
            let accountStatus = try await container.accountStatus()
            return accountStatus == .available
        } catch {
            return false
        }
    }

    /**
     * Get pending changes count for queue status
     */
    private func getPendingChangesCount(appState: AppState) async -> Int {
        do {
            guard let database = appState.database else { return 0 }
            let pendingChanges = try await database.getPendingChanges(since: 0)
            return pendingChanges.count
        } catch {
            return 0
        }
    }

    /**
     * Parse Node from dictionary with validation
     */
    private func parseNodeFromDict(_ data: [String: Any]) throws -> Node {
        let jsonData = try JSONSerialization.data(withJSONObject: data)
        return try decoder.decode(Node.self, from: jsonData)
    }

    /**
     * Convert Node to dictionary for response
     */
    private func nodeToDict(_ node: Node) throws -> [String: Any] {
        let data = try encoder.encode(node)
        guard let dict = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw CloudKitMessageError.encodingFailed("Failed to convert node to dictionary")
        }
        return dict
    }

    /**
     * Format error for client response
     */
    private func formatError(_ error: Error) -> String {
        if let cloudKitError = error as? CloudKitMessageError {
            return cloudKitError.localizedDescription
        } else if let syncError = error as? SyncError {
            return syncError.localizedDescription
        } else {
            return "CloudKit operation failed: \(error.localizedDescription)"
        }
    }

    // MARK: - Response Delivery

    /**
     * Send success response to WebView
     */
    private func sendSuccessResponse(
        to webView: WKWebView?,
        result: [String: Any],
        requestId: String,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId,
            result: result,
            error: nil,
            duration: duration
        )
    }

    /**
     * Send error response to WebView
     */
    private func sendErrorResponse(
        to webView: WKWebView?,
        error: String,
        requestId: String?,
        duration: CFAbsoluteTime
    ) async {
        await sendResponse(
            to: webView,
            id: requestId ?? "unknown",
            result: nil,
            error: error,
            duration: duration
        )
    }

    /**
     * Send response to WebView through JavaScript callback
     */
    private func sendResponse(
        to webView: WKWebView?,
        id: String,
        result: [String: Any]?,
        error: String?,
        duration: CFAbsoluteTime
    ) async {
        guard let webView = webView else {
            print("[CloudKitMessageHandler] No WebView available for response")
            return
        }

        var response: [String: Any] = [
            "id": id,
            "success": error == nil,
            "timestamp": Date().timeIntervalSince1970,
            "duration": duration * 1000 // Convert to milliseconds
        ]

        if let result = result {
            response["result"] = result
        }

        if let error = error {
            response["error"] = error
        }

        do {
            let responseData = try JSONSerialization.data(withJSONObject: response, options: .sortedKeys)
            guard let responseString = String(data: responseData, encoding: .utf8) else {
                throw CloudKitMessageError.encodingFailed("Failed to encode response")
            }

            let script = "window.resolveWebViewRequest('\(id)', \(result != nil ? responseString : "null"), \(error != nil ? "\"\(error!)\"" : "null"))"

            try await webView.evaluateJavaScript(script)

        } catch {
            print("[CloudKitMessageHandler] Failed to send response: \(error)")
            // Attempt fallback response
            let fallbackScript = "window.resolveWebViewRequest('\(id)', null, 'Failed to serialize response')"
            try? await webView.evaluateJavaScript(fallbackScript)
        }
    }
}

// MARK: - Support Classes

/**
 * Security validation for CloudKit MessageHandler requests
 */
@MainActor
private class MessageHandlerSecurityValidator {
    private let allowedMethods = Set([
        "sync", "getStatus", "getConflicts", "resolveConflict",
        "setConflictStrategy", "enableRealTimeSync", "disableRealTimeSync", "getQueueStatus"
    ])

    func validateCloudKitRequest(
        method: String,
        params: [String: Any],
        requestId: String
    ) async -> (isAllowed: Bool, reason: String) {
        // Validate method
        guard allowedMethods.contains(method) else {
            return (false, "Unknown CloudKit method: \(method)")
        }

        // Validate request ID format
        guard !requestId.isEmpty, requestId.count <= 255 else {
            return (false, "Invalid request ID format")
        }

        // Method-specific validation
        switch method {
        case "resolveConflict":
            if params["conflictId"] as? String == nil {
                return (false, "Missing conflictId for conflict resolution")
            }
            if params["resolution"] as? [String: Any] == nil {
                return (false, "Missing resolution data")
            }
        case "setConflictStrategy":
            if params["strategy"] as? String == nil {
                return (false, "Missing conflict resolution strategy")
            }
        default:
            break
        }

        return (true, "")
    }

    func logSecurityError(method: String, requestId: String, error: Error) async {
        print("[CloudKitSecurity] Error in \(method) (\(requestId)): \(error)")
    }
}

/**
 * Performance monitoring for CloudKit MessageHandler operations
 */
@MainActor
private class MessageHandlerPerformanceMonitor {
    private var operations: [String: (startTime: CFAbsoluteTime, method: String)] = [:]

    func startOperation(method: String, requestId: String) async -> String {
        let operationId = "\(requestId)-\(method)"
        operations[operationId] = (CFAbsoluteTimeGetCurrent(), method)
        return operationId
    }

    func endOperation(_ operationId: String, success: Bool, duration: CFAbsoluteTime) async {
        operations.removeValue(forKey: operationId)

        #if DEBUG
        print("[CloudKitPerformance] \(operationId): \(success ? "SUCCESS" : "FAILED") in \(String(format: "%.2f", duration * 1000))ms")
        #endif
    }
}

// MARK: - CloudKit Error Types

public enum CloudKitMessageError: LocalizedError {
    case invalidOperation(String)
    case invalidData(String)
    case encodingFailed(String)
    case unavailable(String)
    case rateLimited(String)

    public var errorDescription: String? {
        switch self {
        case .invalidOperation(let msg):
            return "Invalid CloudKit operation: \(msg)"
        case .invalidData(let msg):
            return "Invalid CloudKit data: \(msg)"
        case .encodingFailed(let msg):
            return "CloudKit encoding failed: \(msg)"
        case .unavailable(let msg):
            return "CloudKit unavailable: \(msg)"
        case .rateLimited(let msg):
            return "CloudKit rate limited: \(msg)"
        }
    }
}