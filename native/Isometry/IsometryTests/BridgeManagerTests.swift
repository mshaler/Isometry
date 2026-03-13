import Testing
import Foundation
import WebKit
@testable import Isometry

// ---------------------------------------------------------------------------
// BridgeManager Tests
// ---------------------------------------------------------------------------
// Tests for BRDG-05: WeakScriptMessageHandler must not retain BridgeManager.
// These tests validate the retain cycle prevention pattern.

@MainActor
struct BridgeManagerTests {

    // MARK: - WeakScriptMessageHandler Deallocation (BRDG-05)

    @Test func weakScriptMessageHandler_deallocation() {
        // Create a WKWebViewConfiguration to hold the handler
        let config = WKWebViewConfiguration()

        // Use weak ref to track BridgeManager lifetime
        weak var weakBridgeManager: BridgeManager?

        // Create and register BridgeManager in inner scope
        do {
            let bridgeManager = BridgeManager()
            weakBridgeManager = bridgeManager
            bridgeManager.register(with: config)
            // bridgeManager goes out of scope here
        }

        // WKUserContentController holds the WeakScriptMessageHandler,
        // but that handler has only a weak ref to BridgeManager.
        // BridgeManager should be deallocated once local strong ref drops.
        #expect(weakBridgeManager == nil, "BridgeManager should be deallocated after strong ref drops — WeakScriptMessageHandler must use weak var delegate")
    }

    // MARK: - isDirty delegates to DatabaseManager (no-crash, async)

    @Test func isDirty_isNilWhenNoDatabaseManager() async {
        // Validates that isDirty computed property safely returns false
        // when databaseManager is nil (first launch / no db manager wired up).
        let bridgeManager = BridgeManager()
        let isDirtyResult = await bridgeManager.isDirty
        #expect(isDirtyResult == false, "isDirty should be false when databaseManager is nil")
    }

    // MARK: - isJSReady Initial State

    @Test func isJSReady_initiallyFalse() {
        let bridgeManager = BridgeManager()
        #expect(bridgeManager.isJSReady == false, "isJSReady should start as false before any JS message is received")
    }

    // MARK: - showingRecoveryOverlay Initial State

    @Test func showingRecoveryOverlay_initiallyFalse() {
        let bridgeManager = BridgeManager()
        #expect(bridgeManager.showingRecoveryOverlay == false, "showingRecoveryOverlay should start as false")
    }

    // MARK: - WKWebView Termination Recovery (MMRY-03)

    /// Simulates WKWebView content process termination and verifies recovery behavior:
    /// - isJSReady resets to false
    /// - showingRecoveryOverlay becomes true
    ///
    /// The termination handler dispatches to @MainActor via Task { @MainActor in },
    /// so a brief await is needed for the task to settle.
    @Test func webContentTermination_resetsReadyStateAndShowsOverlay() async {
        let bridgeManager = BridgeManager()

        // Simulate JS having previously signaled ready
        // (use didReceive to set isJSReady via the bridge message path)
        bridgeManager.didReceive(MockMessage(type: "native:ready"))
        #expect(bridgeManager.isJSReady == true, "Precondition: isJSReady should be true after native:ready")

        // Create a minimal WKWebView and wire navigationDelegate
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        bridgeManager.configure(webView: webView)

        // Simulate WebContent process termination
        bridgeManager.webViewWebContentProcessDidTerminate(webView)

        // The termination handler dispatches to @MainActor via Task — wait for it to settle
        try? await Task.sleep(nanoseconds: 100_000_000)  // 0.1s

        #expect(bridgeManager.isJSReady == false, "isJSReady must reset to false after WebContent termination")
        #expect(bridgeManager.showingRecoveryOverlay == true, "showingRecoveryOverlay must be shown after WebContent termination")
    }

    // MARK: - Silent Crash Detection Guard (MMRY-03)

    /// Verifies that checkForSilentCrash() is a no-op when isJSReady is false.
    /// This guards against false positives on cold start (url is naturally nil before load).
    @Test func silentCrashDetection_guardIsJSReadyFalse() {
        let bridgeManager = BridgeManager()
        // isJSReady is false initially — checkForSilentCrash should not show overlay
        bridgeManager.checkForSilentCrash()
        #expect(bridgeManager.showingRecoveryOverlay == false, "checkForSilentCrash should not show overlay when isJSReady is false")
    }

    /// Verifies that checkForSilentCrash() is a no-op when webView is nil.
    /// This guards the nil webView case from the 2026-03-07 fix (webkit bug #176855).
    @Test func silentCrashDetection_guardNilWebView() {
        let bridgeManager = BridgeManager()
        // Simulate JS having signaled ready but webView not yet set
        bridgeManager.didReceive(MockMessage(type: "native:ready"))
        // webView is nil — checkForSilentCrash should not crash or show overlay
        bridgeManager.checkForSilentCrash()
        #expect(bridgeManager.showingRecoveryOverlay == false, "checkForSilentCrash should not show overlay when webView is nil")
    }
}

// MARK: - MockMessage

/// Minimal WKScriptMessage substitute for testing didReceive() in isolation.
/// Creates a real WKScriptMessage body dictionary using KVC.
private final class MockMessage: WKScriptMessage {
    private let _body: Any

    init(type: String, payload: [String: Any]? = nil) {
        var dict: [String: Any] = ["type": type]
        if let payload { dict["payload"] = payload }
        self._body = dict
        super.init()
    }

    override var body: Any { _body }
    override var name: String { "nativeBridge" }
}
