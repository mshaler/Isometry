import SwiftUI
import WebKit
import Combine
import os

// ---------------------------------------------------------------------------
// BridgeManager — Swift-side WKWebView Bridge
// ---------------------------------------------------------------------------
// Owns the bidirectional communication channel between Swift and the web runtime.
// All 5 message types dispatched through a single "nativeBridge" handler.
//
// Requirements addressed:
//   - BRDG-01: Sends LaunchPayload (dbData, platform, tier, viewport, safeAreaInsets)
//   - BRDG-02: Handles checkpoint bytes as base64 string (not raw Uint8Array)
//   - BRDG-03: Native action stub (Phase 13 fills this)
//   - BRDG-04: Sync notification sender (Phase 14 fills this)
//   - BRDG-05: WeakScriptMessageHandler prevents WKUserContentController retain cycle
//
// CRITICAL: @MainActor ensures evaluateJavaScript always runs on main thread.
// CRITICAL: Do NOT use WKScriptMessageHandlerWithReply — known 7-year-old Swift 6 bug.

private let logger = Logger(subsystem: "works.isometry.app", category: "Bridge")

// ---------------------------------------------------------------------------
// BridgeManager
// ---------------------------------------------------------------------------

@MainActor
final class BridgeManager: NSObject, ObservableObject {

    // MARK: - Properties

    /// Weak reference to the WKWebView — BridgeManager does not own it.
    weak var webView: WKWebView?

    /// Connected to real DatabaseManager in Plan 12-03.
    /// For Phase 12-01, stub is provided at bottom of this file.
    var databaseManager: DatabaseManager?

    /// SubscriptionManager for tier-aware LaunchPayload and FeatureGate checks.
    /// Wired by IsometryApp.onAppear (TIER-03, TIER-04).
    var subscriptionManager: SubscriptionManager?

    /// NativeImportCoordinator for forwarding chunk-ack messages from JS.
    /// Wired by ContentView.onAppear (FNDX-01).
    var importCoordinator: NativeImportCoordinator?

    /// SyncManager for queuing outgoing mutations to CKSyncEngine.
    /// Wired by IsometryApp.initializeSyncManager() (SYNC-03, SYNC-10).
    var syncManager: SyncManager?

    /// SyncStatusPublisher for SwiftUI toolbar sync icon (SYNC-09).
    /// Wired by IsometryApp.initializeSyncManager().
    @Published var syncStatusPublisher: SyncStatusPublisher?

    /// isDirty is a computed property delegating to DatabaseManager.
    /// DatabaseManager is the single source of truth — no dual flags here.
    var isDirty: Bool {
        get async {
            await databaseManager?.isDirty ?? false
        }
    }

    /// True once JS has signaled "native:ready".
    private(set) var isJSReady: Bool = false

    /// SwiftUI published flag for crash recovery overlay (SHELL-05, Plan 12-03).
    @Published var showingRecoveryOverlay: Bool = false

    // MARK: - WeakScriptMessageHandler (BRDG-05)

    /// Private proxy class that breaks the WKUserContentController retain cycle.
    /// WKUserContentController holds a strong ref to its handlers.
    /// By holding only a weak ref to BridgeManager, deallocation works correctly.
    private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
        weak var delegate: BridgeManager?

        init(_ delegate: BridgeManager) {
            self.delegate = delegate
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            delegate?.didReceive(message)
        }
    }

    // MARK: - Registration

    /// Register the nativeBridge handler with a WKWebViewConfiguration.
    /// Call this before creating WKWebView (in makeWebView()).
    func register(with config: WKWebViewConfiguration) {
        let proxy = WeakScriptMessageHandler(self)
        config.userContentController.add(proxy, name: "nativeBridge")
        logger.info("BridgeManager registered nativeBridge handler")
    }

    // MARK: - Incoming Message Dispatch

    /// Called by WeakScriptMessageHandler when JS posts to nativeBridge.
    /// Dispatches on the "type" field in the message body dictionary.
    func didReceive(_ message: WKScriptMessage) {
        guard let body = message.body as? [String: Any],
              let type = body["type"] as? String else {
            logger.warning("Received non-dictionary or missing type from nativeBridge: \(String(describing: message.body))")
            return
        }

        logger.debug("Bridge received message: \(type)")

        switch type {

        case "native:ready":
            // JS has registered window.__isometry.receive and is ready for LaunchPayload
            isJSReady = true
            showingRecoveryOverlay = false  // Dismiss recovery overlay (SHELL-05)
            logger.info("JS signaled ready — sending LaunchPayload")
            Task {
                await sendLaunchPayload()
            }
            // SYNC-01: Check if initial upload or encryptedDataReset re-upload is needed
            // Must happen AFTER sendLaunchPayload completes (JS database is loaded)
            Task {
                // Small delay to ensure JS has processed the launch payload and database is loaded
                try? await Task.sleep(nanoseconds: 500_000_000)  // 0.5 seconds
                if let needsReupload = await syncManager?.consumeReuploadFlag(), needsReupload {
                    logger.info("Triggering full card export for initial CloudKit upload")
                    let js = "window.__isometry?.exportAllCards?.();"
                    _ = try? await webView?.evaluateJavaScript(js)
                }
            }

        case "checkpoint":
            // JS has exported the database and is sending bytes back as base64
            let payload = body["payload"] as? [String: Any]
            guard let base64String = payload?["dbData"] as? String,
                  let data = Data(base64Encoded: base64String) else {
                logger.error("Checkpoint message missing or invalid dbData payload")
                return
            }
            logger.info("Received checkpoint (\(data.count) bytes) — saving to disk")
            Task {
                do {
                    try await databaseManager?.saveCheckpoint(data)
                    logger.info("Checkpoint saved successfully")
                } catch {
                    logger.error("Checkpoint save failed: \(error.localizedDescription)")
                }
            }

        case "mutated":
            // JS performed a write operation — mark dirty so checkpoint autosave triggers
            // Delegates to DatabaseManager (single source of truth — no local flag)
            Task {
                await databaseManager?.markDirty()
            }
            // Phase 39: Extract changeset for CKSyncEngine offline queue
            if let payload = body["payload"] as? [String: Any],
               let changes = payload["changes"] as? [[String: Any]] {
                Task {
                    for change in changes {
                        guard let recordType = change["recordType"] as? String,
                              let recordId = change["recordId"] as? String,
                              let operation = change["operation"] as? String else { continue }

                        let fields: [String: CodableValue]?
                        if let rawFields = change["fields"] as? [String: Any] {
                            fields = rawFields.mapValues { CodableValue.from($0) }
                        } else {
                            fields = nil
                        }

                        let pending = PendingChange(
                            id: UUID().uuidString,
                            recordType: recordType,
                            recordId: recordId,
                            operation: operation == "delete" ? "delete" : "save",
                            fields: fields,
                            timestamp: Date()
                        )
                        await syncManager?.addPendingChange(pending)
                    }
                }
            }

        case "native:action":
            // TIER-04: FeatureGate integration — check tier before dispatching native actions
            let payload = body["payload"] as? [String: Any]
            let kind = payload?["kind"] as? String ?? ""

            let feature: NativeFeature? = {
                switch kind {
                case "importFile": return .fileImport
                case "cloudSave":  return .cloudSave
                case "exportData": return .exportData
                default:           return nil
                }
            }()

            let currentTier = subscriptionManager?.currentTier ?? .free
            if let feature, !FeatureGate.isAllowed(feature, for: currentTier) {
                logger.warning("FeatureGate blocked \(kind) — requires \(FeatureGate.requiredTier(for: feature).rawValue), current: \(currentTier.rawValue)")
                // Send blocked response back to JS so it can show upgrade prompt
                let requiredTier = FeatureGate.requiredTier(for: feature).rawValue
                let js = """
                window.__isometry.receive({
                  type: 'native:blocked',
                  payload: { feature: '\(kind)', requiredTier: '\(requiredTier)' }
                });
                """
                Task { try? await webView?.evaluateJavaScript(js) }
                return
            }

            // Dispatch allowed action
            logger.info("native:action dispatching: \(kind)")

        case "native:import-chunk-ack":
            let payload = body["payload"] as? [String: Any]
            let chunkIndex = payload?["chunkIndex"] as? Int ?? -1
            let success = payload?["success"] as? Bool ?? false
            logger.debug("native:import-chunk-ack: chunk \(chunkIndex), success: \(success)")
            importCoordinator?.receiveChunkAck(success: success)

        case "native:export-all-cards":
            // SYNC-01, SYNC-02: JS responds with all cards and connections for initial CloudKit upload or encryptedDataReset recovery
            guard let payload = body["payload"] as? [String: Any],
                  let cards = payload["cards"] as? [[String: Any]] else {
                logger.warning("native:export-all-cards: invalid payload")
                return
            }
            // SYNC-02: Connections are optional for backward compatibility (pre-41-02 JS sends cards only)
            let connections = payload["connections"] as? [[String: Any]] ?? []
            logger.info("native:export-all-cards: received \(cards.count) cards and \(connections.count) connections for upload")
            Task {
                for card in cards {
                    guard let recordId = card["id"] as? String else { continue }
                    // Build CodableValue fields from card data
                    var fields: [String: CodableValue] = [:]
                    for (key, value) in card {
                        if key == "id" { continue }  // recordId is separate
                        fields[key] = CodableValue.from(value)
                    }
                    let pending = PendingChange(
                        id: UUID().uuidString,
                        recordType: SyncConstants.cardRecordType,
                        recordId: recordId,
                        operation: "save",
                        fields: fields,
                        timestamp: Date()
                    )
                    await syncManager?.addPendingChange(pending)
                }
                // SYNC-02: Process connections from export-all payload
                for conn in connections {
                    guard let recordId = conn["id"] as? String else { continue }
                    var fields: [String: CodableValue] = [:]
                    for (key, value) in conn {
                        if key == "id" { continue }  // recordId is separate
                        fields[key] = CodableValue.from(value)
                    }
                    let pending = PendingChange(
                        id: UUID().uuidString,
                        recordType: SyncConstants.connectionRecordType,
                        recordId: recordId,
                        operation: "save",
                        fields: fields,
                        timestamp: Date()
                    )
                    await syncManager?.addPendingChange(pending)
                }
                logger.info("native:export-all-cards: queued \(cards.count) cards and \(connections.count) connections as PendingChange entries")
            }

        default:
            logger.warning("Unknown bridge message type: \(type)")
        }
    }

    // MARK: - Outgoing: LaunchPayload (BRDG-01)

    /// Sends LaunchPayload to JS after native:ready signal.
    /// Includes: dbData (base64 or null), platform, tier, viewport, safeAreaInsets.
    func sendLaunchPayload() async {
        // Load database bytes from disk (nil on first launch)
        let dbData = await databaseManager?.loadDatabase()
        let dbDataJS: String
        if let data = dbData {
            dbDataJS = "\"\(data.base64EncodedString())\""
        } else {
            dbDataJS = "null"
        }

        // Platform string
        #if os(macOS)
        let platform = "macos"
        #else
        let platform = "ios"
        #endif

        // Tier: dynamic from SubscriptionManager (TIER-03)
        let tier = subscriptionManager?.currentTier.rawValue ?? "free"

        // Viewport: read from webView frame at call time
        let viewport: String
        if let frame = webView?.frame {
            viewport = "{\"width\":\(frame.width),\"height\":\(frame.height)}"
        } else {
            viewport = "{\"width\":0,\"height\":0}"
        }

        // Safe area insets: iOS reads from webView; macOS has no notch
        let safeAreaInsets: String
        #if os(iOS)
        if let insets = webView?.safeAreaInsets {
            safeAreaInsets = "{\"top\":\(insets.top),\"right\":\(insets.right),\"bottom\":\(insets.bottom),\"left\":\(insets.left)}"
        } else {
            safeAreaInsets = "{\"top\":0,\"right\":0,\"bottom\":0,\"left\":0}"
        }
        #else
        safeAreaInsets = "{\"top\":0,\"right\":0,\"bottom\":0,\"left\":0}"
        #endif

        let js = """
        window.__isometry.receive({
          type: 'native:launch',
          payload: {
            dbData: \(dbDataJS),
            platform: '\(platform)',
            tier: '\(tier)',
            viewport: \(viewport),
            safeAreaInsets: \(safeAreaInsets)
          }
        });
        """

        logger.info("Sending LaunchPayload (platform: \(platform), hasDbData: \(dbData != nil))")

        _ = try? await webView?.evaluateJavaScript(js)
    }

    // MARK: - Outgoing: Checkpoint Request

    /// Ask JS to export the database and post it back via "checkpoint" message.
    /// JS side calls window.__isometry.sendCheckpoint() which posts back base64 bytes.
    func requestCheckpoint() {
        let js = "window.__isometry.sendCheckpoint();"
        logger.info("Requesting checkpoint from JS")
        Task {
            try? await webView?.evaluateJavaScript(js)
        }
    }

    // MARK: - WebView Configuration

    /// Wire BridgeManager to WKWebView: stores weak ref and sets navigationDelegate.
    /// Call this after creating WKWebView, before loading any URL.
    func configure(webView: WKWebView) {
        self.webView = webView
        webView.navigationDelegate = self
        logger.info("BridgeManager configured as navigationDelegate")
    }

    // MARK: - Autosave Timer (DATA-05)

    private var autosaveTimer: Timer?

    /// Start the 30-second autosave timer.
    /// Uses Timer.scheduledTimer on the main run loop so it automatically
    /// pauses when the app enters background — no extra lifecycle management needed.
    func startAutosave() {
        stopAutosave()
        autosaveTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
            Task { @MainActor in
                await self?.autosaveTick()
            }
        }
        logger.info("Autosave timer started (30s interval)")
    }

    /// Stop and invalidate the autosave timer.
    func stopAutosave() {
        autosaveTimer?.invalidate()
        autosaveTimer = nil
    }

    private func autosaveTick() async {
        guard await isDirty else { return }
        logger.info("Autosave: dirty flag set, requesting checkpoint")
        requestCheckpoint()
    }

    // MARK: - Lifecycle Save (DATA-04)

    /// Request a checkpoint save for lifecycle events (background/termination).
    /// Fire-and-forget: iOS relies on beginBackgroundTask providing ~30s for the round-trip.
    func saveIfDirty() async {
        let dirty = await isDirty
        guard dirty, isJSReady else {
            logger.info("saveIfDirty: skipping (isDirty=\(dirty), isJSReady=\(self.isJSReady))")
            return
        }
        logger.info("saveIfDirty: requesting checkpoint for lifecycle event")
        requestCheckpoint()
    }

    // MARK: - Silent Crash Detection (SHELL-05 webkit bug workaround)

    /// Check for silent WebContent process crash (webkit bug #176855).
    /// WebContent can crash without firing webViewWebContentProcessDidTerminate;
    /// the symptom is webView.url returning nil while the view is still showing.
    /// Called when scenePhase returns to .active.
    func checkForSilentCrash() {
        // Guard on isJSReady: on cold start webView.url is naturally nil
        // before navigation completes — that's not a crash.
        guard isJSReady else { return }
        if webView?.url == nil && !showingRecoveryOverlay {
            logger.warning("Silent WebContent crash detected — webView.url is nil")
            showingRecoveryOverlay = true
            webView?.reload()
        }
    }

    // MARK: - Outgoing: Sync Notification (BRDG-04 stub)

    /// Send incoming CloudKit sync records to the web runtime for SyncMerger processing.
    /// Payload must contain a "records" array matching the NativeBridge.ts SyncMerger interface:
    /// each record has recordType, recordId, operation, and optional fields.
    func sendSyncNotification(_ payload: [String: Any]) {
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            logger.error("sendSyncNotification: failed to serialize payload")
            return
        }

        let recordCount = (payload["records"] as? [Any])?.count ?? 0
        let js = "window.__isometry.receive({type:'native:sync',payload:\(jsonString)});"
        logger.info("Sending sync notification with \(recordCount) records")
        Task {
            try? await webView?.evaluateJavaScript(js)
        }
    }
    // MARK: - Outgoing: File Import (FILE-03)

    /// Send file data to the web runtime for ETL processing via native:action bridge message.
    /// Data is either UTF-8 text (json, csv, markdown) or base64 (xlsx).
    /// The NativeBridge.ts handler routes this to WorkerBridge.importFile().
    func sendFileImport(data: String, source: String, filename: String) {
        // Escape the data string for safe embedding in JavaScript.
        // JSONSerialization handles all escaping correctly for quotes, newlines, special chars.
        guard let jsonData = try? JSONSerialization.data(
            withJSONObject: ["kind": "importFile", "data": data, "source": source, "filename": filename]
        ), let jsonString = String(data: jsonData, encoding: .utf8) else {
            logger.error("sendFileImport: failed to serialize payload")
            return
        }

        let js = "window.__isometry.receive({type:'native:action',payload:\(jsonString)});"
        logger.info("Sending file import to JS: \(filename) (\(source), \(data.count) chars)")
        Task {
            do {
                try await webView?.evaluateJavaScript(js)
            } catch {
                logger.error("sendFileImport evaluateJavaScript failed: \(error.localizedDescription)")
            }
        }
    }
}

// DatabaseManager is defined in DatabaseManager.swift (Plan 12-02).
// BridgeManager.swift holds a var databaseManager: DatabaseManager? that is
// wired up by the app at launch (Plan 12-03 ContentView integration).

// ---------------------------------------------------------------------------
// WKNavigationDelegate — WebContent Crash Recovery (SHELL-05)
// ---------------------------------------------------------------------------

extension BridgeManager: WKNavigationDelegate {
    /// Called when the WebContent process terminates unexpectedly.
    /// Shows a recovery overlay and reloads the WebView.
    /// The reload triggers JS re-initialization → native:ready → sendLaunchPayload
    /// with the last checkpoint, restoring state transparently.
    nonisolated func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        Task { @MainActor in
            logger.error("WebContent process terminated — initiating recovery")
            showingRecoveryOverlay = true
            isJSReady = false
            // Reload triggers full page load → JS re-initializes → signals native:ready
            // → sendLaunchPayload sends last checkpoint → overlay dismissed
            webView.reload()
        }
    }
}
