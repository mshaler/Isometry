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
}
