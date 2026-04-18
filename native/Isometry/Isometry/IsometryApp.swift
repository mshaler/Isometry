import MetricKit
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
//   - SYNC-03: SyncManager initialized after DatabaseManager for change token persistence
//   - SYNC-10: SyncManager offline queue loaded on app launch

@main
struct IsometryApp: App {
    // MARK: - Platform Delegates
    // macOS: Termination hook (DATA-04) + remote notification registration (SYNC-06)
    // iOS: Remote notification registration (SYNC-06)
    #if os(macOS)
    @NSApplicationDelegateAdaptor private var appDelegate: IsometryAppDelegate
    #else
    @UIApplicationDelegateAdaptor(AppDelegateIOS.self) private var iosDelegate
    #endif

    @Environment(\.scenePhase) private var scenePhase

    /// Single BridgeManager instance shared between App (lifecycle) and ContentView (webView).
    /// @StateObject here so it's created once and survives scene reconstructions.
    @StateObject private var bridgeManager = BridgeManager()

    /// SubscriptionManager owns StoreKit 2 lifecycle — created once, shared with ContentView.
    @StateObject private var subscriptionManager = SubscriptionManager()

    /// MetricKitSubscriber receives crash + hang diagnostics from the OS (MKIT-01).
    /// Created once at app launch; shared with ContentView → SettingsView for the Diagnostics section.
    @StateObject private var metricKitSubscriber = MetricKitSubscriber()

    var body: some Scene {
        WindowGroup {
            ContentView(
                bridgeManager: bridgeManager,
                subscriptionManager: subscriptionManager,
                metricKitSubscriber: metricKitSubscriber
            )
                .onAppear {
                    // Wire subscriptionManager into bridgeManager for tier-aware LaunchPayload
                    bridgeManager.subscriptionManager = subscriptionManager
                    #if os(macOS)
                    // Wire macOS delegate so applicationWillTerminate can call saveIfDirty
                    appDelegate.bridgeManager = bridgeManager
                    #endif

                    // Initialize SyncManager after DatabaseManager (SYNC-03, SYNC-10)
                    // SyncManager is stored on BridgeManager (not App struct) because
                    // actors cannot be @StateObject and App structs are immutable.
                    initializeSyncManager()
                }
                .task {
                    // LNCH-02: Start WKWebView setup during launch animation so WASM
                    // streaming compile begins before ContentView.onAppear fires.
                    // Guard in setupWebViewIfNeeded() prevents double-initialization.
                    let savedTheme = UserDefaults.standard.string(forKey: "theme") ?? "dark"
                    bridgeManager.setupWebViewIfNeeded(savedTheme: savedTheme)
                }
        }
        #if os(macOS)
        .commands {
            IsometryCommands()
            ViewCommands()
        }
        #endif
        .onChange(of: scenePhase) { _, newPhase in
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
            // SYNC-05: Poll for CloudKit changes on foreground
            Task {
                await bridgeManager.syncManager?.fetchChanges()
            }

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

    // MARK: - SyncManager Initialization (SYNC-03, SYNC-10)

    /// Initialize SyncManager after DatabaseManager.
    /// SyncManager needs Application Support/Isometry/ path for state files.
    /// SyncManager is stored on BridgeManager (class, not struct) for lifetime management.
    /// Runs in a Task because SyncManager.initialize() is async (actor-isolated).
    private func initializeSyncManager() {
        let appSupport = FileManager.default.urls(
            for: .applicationSupportDirectory, in: .userDomainMask
        )[0]
        let appSupportDir = appSupport.appendingPathComponent("Isometry", isDirectory: true)

        let manager = SyncManager(appSupportDir: appSupportDir)

        // Wire bridgeManager for forwarding incoming sync records to JS (Plan 39-03)
        manager.bridgeManager = bridgeManager

        // SYNC-09: Create and wire SyncStatusPublisher for toolbar icon
        let statusPublisher = SyncStatusPublisher()
        manager.statusPublisher = statusPublisher
        bridgeManager.syncStatusPublisher = statusPublisher

        // Store SyncManager on BridgeManager for lifetime management and
        // so outgoing mutations can be queued (Plan 39-03)
        bridgeManager.syncManager = manager

        Task {
            await manager.initialize()
        }
    }
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

    func applicationDidFinishLaunching(_ notification: Notification) {
        // SYNC-06: Register for remote notifications so CKSyncEngine receives push updates.
        // CloudKit uses silent push — no user permission prompt required.
        NSApplication.shared.registerForRemoteNotifications()
    }

    func applicationWillTerminate(_ notification: Notification) {
        // The synchronous save path for macOS quit.
        // We cannot fire-and-forget here — the process terminates immediately after this returns.
        // Since we cannot do a JS→Swift round-trip synchronously, the last autosave checkpoint
        // (max 30s old) is the recovery point. This is the accepted tradeoff per CONTEXT.md.
        print("[Isometry] applicationWillTerminate — last autosave checkpoint is the recovery point")
    }
}
#endif

// ---------------------------------------------------------------------------
// iOS App Delegate — Remote Notification Registration (SYNC-06)
// ---------------------------------------------------------------------------
// Registers for remote notifications so CKSyncEngine can receive push updates.
// CKSyncEngine handles zone subscriptions automatically — the app only needs
// to call registerForRemoteNotifications().

#if os(iOS)
final class AppDelegateIOS: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // SYNC-06: Register for remote notifications so CKSyncEngine receives push updates.
        // CloudKit uses silent push — no user permission prompt required.
        application.registerForRemoteNotifications()
        return true
    }
}
#endif

// ---------------------------------------------------------------------------
// IsometryCommands — macOS Menu Bar (CHRM-03)
// ---------------------------------------------------------------------------
// Provides File > Import File (Cmd+I) and Edit > Undo/Redo (Cmd+Z / Cmd+Shift+Z).
// Commands structs cannot access @EnvironmentObject or @State from ContentView.
// Notification.Name extensions are defined in ContentView.swift (same module).
// ContentView observes these notifications via .onReceive and dispatches actions.

#if os(macOS)
// SYNC REFERENCE: Keep in sync with src/ui/menuDefinitions.ts (single source of truth
// for the web dropdown). When adding/removing menu items here, update menuDefinitions.ts.
struct IsometryCommands: Commands {
    var body: some Commands {
        // File menu: Import File (Cmd+I)
        // Inserted after the system "New" item group.
        CommandGroup(after: .newItem) {
            Button("Import File...") {
                NotificationCenter.default.post(name: .importFile, object: nil)
            }
            .keyboardShortcut("I", modifiers: .command)

            Button("Import from...") {
                NotificationCenter.default.post(name: .importFromSource, object: nil)
            }
            .keyboardShortcut("I", modifiers: [.command, .shift])
        }

        // Edit menu: Undo/Redo — replaces system undo/redo group.
        // Routes through NotificationCenter → ContentView.onReceive → evaluateJavaScript
        // → window.__isometry.mutationManager.undo/redo().
        CommandGroup(replacing: .undoRedo) {
            Button("Undo") {
                NotificationCenter.default.post(name: .undoAction, object: nil)
            }
            .keyboardShortcut("Z", modifiers: .command)

            Button("Redo") {
                NotificationCenter.default.post(name: .redoAction, object: nil)
            }
            .keyboardShortcut("Z", modifiers: [.command, .shift])
        }
    }
}

// ---------------------------------------------------------------------------
// ViewCommands — macOS View Menu (KEYS-02)
// ---------------------------------------------------------------------------
// Provides View > List (Cmd+1) through View > SuperGrid (Cmd+9).
// Each item posts a notification; ContentView.onReceive sets selectedViewID,
// which triggers onChange(of: selectedViewID) → switchView(to:).
// In the native app, SwiftUI captures Cmd+1-9 before WKWebView, so the JS
// ShortcutRegistry handler does not fire — this is correct behavior.

struct ViewCommands: Commands {
    var body: some Commands {
        CommandMenu("View") {
            Button("List") {
                NotificationCenter.default.post(name: .switchToList, object: nil)
            }
            .keyboardShortcut("1", modifiers: .command)

            Button("Grid") {
                NotificationCenter.default.post(name: .switchToGrid, object: nil)
            }
            .keyboardShortcut("2", modifiers: .command)

            Button("Kanban") {
                NotificationCenter.default.post(name: .switchToKanban, object: nil)
            }
            .keyboardShortcut("3", modifiers: .command)

            Button("Calendar") {
                NotificationCenter.default.post(name: .switchToCalendar, object: nil)
            }
            .keyboardShortcut("4", modifiers: .command)

            Button("Timeline") {
                NotificationCenter.default.post(name: .switchToTimeline, object: nil)
            }
            .keyboardShortcut("5", modifiers: .command)

            Button("Gallery") {
                NotificationCenter.default.post(name: .switchToGallery, object: nil)
            }
            .keyboardShortcut("6", modifiers: .command)

            Button("Network") {
                NotificationCenter.default.post(name: .switchToNetwork, object: nil)
            }
            .keyboardShortcut("7", modifiers: .command)

            Button("Tree") {
                NotificationCenter.default.post(name: .switchToTree, object: nil)
            }
            .keyboardShortcut("8", modifiers: .command)

            Button("SuperGrid") {
                NotificationCenter.default.post(name: .switchToSupergrid, object: nil)
            }
            .keyboardShortcut("9", modifiers: .command)
        }
    }
}
#endif
