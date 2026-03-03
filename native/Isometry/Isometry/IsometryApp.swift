import SwiftUI
#if os(iOS)
import UIKit
#endif

// ---------------------------------------------------------------------------
// IsometryApp — App Entry Point + Lifecycle Management
// ---------------------------------------------------------------------------
// Owns the single BridgeManager instance shared with ContentView.
// Manages app lifecycle: autosave timer, iOS background save, macOS termination.
//
// Requirements addressed:
//   - DATA-04: Save database on background (iOS) and quit (macOS)
//   - DATA-05: Autosave timer fires every 30s while app is active
//   - SHELL-05: Recovery overlay auto-dismisses on JS ready signal

@main
struct IsometryApp: App {
    // MARK: - macOS Termination Hook (DATA-04)
    // ScenePhase does NOT fire .background on cmd-Q on macOS — this delegate is the only reliable hook.
    // See RESEARCH.md Pitfall 2.
    #if os(macOS)
    @NSApplicationDelegateAdaptor private var appDelegate: IsometryAppDelegate
    #endif

    @Environment(\.scenePhase) private var scenePhase

    /// Single BridgeManager instance shared between App (lifecycle) and ContentView (webView).
    /// @StateObject here so it's created once and survives scene reconstructions.
    @StateObject private var bridgeManager = BridgeManager()

    var body: some Scene {
        WindowGroup {
            ContentView(bridgeManager: bridgeManager)
                .onAppear {
                    #if os(macOS)
                    // Wire macOS delegate so applicationWillTerminate can call saveIfDirty
                    appDelegate.bridgeManager = bridgeManager
                    #endif
                }
        }
        .onChange(of: scenePhase) { newPhase in
            handleScenePhaseChange(newPhase)
        }
    }

    // MARK: - Scene Phase Handling

    private func handleScenePhaseChange(_ newPhase: ScenePhase) {
        switch newPhase {
        case .active:
            // Start autosave timer (DATA-05)
            bridgeManager.startAutosave()
            // Secondary crash detection: webkit bug #176855 — webView.url nil after silent crash
            bridgeManager.checkForSilentCrash()

        case .background:
            // Stop autosave timer (Timer.scheduledTimer on main run loop auto-pauses,
            // but explicit stop prevents any in-flight tick after suspension)
            bridgeManager.stopAutosave()
            // iOS: Request background execution time to complete checkpoint round-trip (DATA-04)
            #if os(iOS)
            performBackgroundSave()
            #endif

        case .inactive:
            // Transitional state (e.g., notification center open) — no action needed
            break

        @unknown default:
            break
        }
    }

    // MARK: - iOS Background Save (DATA-04)

    #if os(iOS)
    private func performBackgroundSave() {
        // Request ~30 seconds of background execution time from the OS
        var backgroundTaskID: UIBackgroundTaskIdentifier = .invalid
        backgroundTaskID = UIApplication.shared.beginBackgroundTask {
            // Expiration handler: system about to suspend — end the task
            UIApplication.shared.endBackgroundTask(backgroundTaskID)
            backgroundTaskID = .invalid
        }
        Task {
            await bridgeManager.saveIfDirty()
            // 2-second grace period for the checkpoint round-trip
            // (JS export → postMessage → Swift write) to complete before suspension
            try? await Task.sleep(nanoseconds: 2_000_000_000)
            UIApplication.shared.endBackgroundTask(backgroundTaskID)
            backgroundTaskID = .invalid
        }
    }
    #endif
}

// ---------------------------------------------------------------------------
// IsometryAppDelegate — macOS Termination (DATA-04)
// ---------------------------------------------------------------------------
// Handles NSApplication.applicationWillTerminate — the only reliable quit hook on macOS.
// ScenePhase.background does NOT fire on cmd-Q (see RESEARCH.md Pitfall 2).
//
// NOTE: We cannot complete a full JS→Swift round-trip synchronously at termination.
// Accepted tradeoff (per CONTEXT.md): max 30 seconds of data loss from last autosave.

#if os(macOS)
final class IsometryAppDelegate: NSObject, NSApplicationDelegate {
    /// Set by IsometryApp during .onAppear to share the single BridgeManager instance.
    weak var bridgeManager: BridgeManager?

    func applicationWillTerminate(_ notification: Notification) {
        // The synchronous save path for macOS quit.
        // We cannot fire-and-forget here — the process terminates immediately after this returns.
        // Since we cannot do a JS→Swift round-trip synchronously, the last autosave checkpoint
        // (max 30s old) is the recovery point. This is the accepted tradeoff per CONTEXT.md.
        print("[Isometry] applicationWillTerminate — last autosave checkpoint is the recovery point")
    }
}
#endif
