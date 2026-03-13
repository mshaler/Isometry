import SwiftUI
import WebKit
import UniformTypeIdentifiers
#if os(macOS)
import AppKit
#endif

// MARK: - UTType Extension

extension UTType {
    static let xlsx = UTType(filenameExtension: "xlsx")
        ?? UTType(importedAs: "org.openxmlformats.spreadsheetml.sheet")
}

// MARK: - Notification Names

extension Notification.Name {
    static let importFile = Notification.Name("works.isometry.importFile")
    static let undoAction = Notification.Name("works.isometry.undo")
    static let redoAction = Notification.Name("works.isometry.redo")

    // View switching — menu bar Cmd+1-9 (KEYS-02)
    static let switchToList = Notification.Name("works.isometry.switchToList")
    static let switchToGrid = Notification.Name("works.isometry.switchToGrid")
    static let switchToKanban = Notification.Name("works.isometry.switchToKanban")
    static let switchToCalendar = Notification.Name("works.isometry.switchToCalendar")
    static let switchToTimeline = Notification.Name("works.isometry.switchToTimeline")
    static let switchToGallery = Notification.Name("works.isometry.switchToGallery")
    static let switchToNetwork = Notification.Name("works.isometry.switchToNetwork")
    static let switchToTree = Notification.Name("works.isometry.switchToTree")
    static let switchToSupergrid = Notification.Name("works.isometry.switchToSupergrid")
}

// MARK: - View Model

/// Maps display names to JavaScript viewType strings and SF Symbols.
struct IsometryView: Identifiable, Hashable {
    let id: String          // JS viewType key: "list", "grid", etc.
    let displayName: String
    let systemImage: String
}

private let isometryViews: [IsometryView] = [
    IsometryView(id: "grid",      displayName: "Grid",      systemImage: "square.grid.2x2"),
    IsometryView(id: "list",      displayName: "List",      systemImage: "list.bullet"),
    IsometryView(id: "kanban",    displayName: "Kanban",    systemImage: "rectangle.3.group"),
    IsometryView(id: "calendar",  displayName: "Calendar",  systemImage: "calendar"),
    IsometryView(id: "timeline",  displayName: "Timeline",  systemImage: "timeline.selection"),
    IsometryView(id: "network",   displayName: "Network",   systemImage: "point.3.connected.trianglepath.dotted"),
    IsometryView(id: "tree",      displayName: "Tree",      systemImage: "list.bullet.indent"),
    IsometryView(id: "gallery",   displayName: "Gallery",   systemImage: "square.grid.3x3"),
    IsometryView(id: "supergrid", displayName: "SuperGrid", systemImage: "tablecells"),
]

// MARK: - ContentView

struct ContentView: View {
    /// BridgeManager is owned by IsometryApp and passed in via init.
    /// Using @ObservedObject (not @StateObject) because lifecycle is managed by the parent.
    @ObservedObject var bridgeManager: BridgeManager
    /// SubscriptionManager for tier-aware UI (TIER-03, TIER-04).
    @ObservedObject var subscriptionManager: SubscriptionManager
    @AppStorage("theme") private var theme: String = "dark"
    // MARK: Navigation State

    /// Sidebar visibility — collapsed by default to maximise D3 canvas area (CHRM-01).
    @State private var columnVisibility = NavigationSplitViewVisibility.detailOnly
    /// Currently selected view (matches JS viewType key).
    /// Optional binding required for single-selection List on iOS.
    @State private var selectedViewID: String? = "list"
    /// iPhone compact-width sheet state (CHRM-02).
    @State private var showingViewPicker = false
    /// File import picker state (FILE-01).
    @State private var showingImporter = false
    /// File too large alert state (FILE-04).
    @State private var showingFileTooLargeAlert = false
    /// Settings sheet state (TIER-03).
    @State private var showingSettings = false
    /// Paywall sheet state — shown when Free user triggers a gated feature (TIER-04).
    @State private var showingPaywall = false
    /// Native import source picker state (FNDX-01).
    @State private var showingImportSourcePicker = false
    /// Native import coordinator — manages chunked bridge dispatch (FNDX-05).
    @StateObject private var importCoordinator = NativeImportCoordinator()
    /// Permission sheet state — shown when adapter needs permission (Phase 34+35).
    @State private var showingPermissionSheet = false
    /// Tracks which source type is pending permission approval.
    @State private var pendingImportSourceType: String?
    /// Tracks the permission state that triggered the sheet (controls Grant Access vs Open Settings).
    @State private var pendingPermissionState: PermissionStatus = .notDetermined

    @Environment(\.horizontalSizeClass) private var sizeClass

    /// Maps the stored theme string to a SwiftUI ColorScheme.
    /// Returns nil for "system" so the OS default is used.
    private var preferredScheme: ColorScheme? {
        switch theme {
        case "light": return .light
        case "dark": return .dark
        default: return nil  // "system" — use system default
        }
    }

    // MARK: - Body

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            // MARK: Sidebar (iPad / macOS)
            List(selection: $selectedViewID) {
                ForEach(isometryViews) { view in
                    Label(view.displayName, systemImage: view.systemImage)
                        .tag(view.id)
                }
            }
            .navigationTitle("Views")
        } detail: {
            // MARK: Detail Pane — web content + recovery overlay
            ZStack {
                if let webView = bridgeManager.webView {
                    WebViewContainer(webView: webView)
                        .ignoresSafeArea(edges: .bottom)
                }

                // Crash recovery overlay (SHELL-05)
                // Shown when WebContent process terminates unexpectedly.
                // Auto-dismisses when JS signals native:ready after reload.
                if bridgeManager.showingRecoveryOverlay {
                    recoveryOverlay
                }
            }
            .toolbar {
                // MARK: Sidebar Toggle (iPad/macOS only)
                #if os(iOS)
                if sizeClass != .compact {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button {
                            withAnimation {
                                columnVisibility = columnVisibility == .detailOnly ? .all : .detailOnly
                            }
                        } label: {
                            Image(systemName: "sidebar.left")
                        }
                    }
                }
                #endif

                // MARK: Sync Status (SYNC-09)
                if let syncStatus = bridgeManager.syncStatusPublisher {
                    #if os(iOS)
                    ToolbarItem(placement: .navigationBarLeading) {
                        SyncStatusView(statusPublisher: syncStatus)
                    }
                    #else
                    ToolbarItem(placement: .navigation) {
                        SyncStatusView(statusPublisher: syncStatus)
                    }
                    #endif
                }

                // MARK: Import Menu (file + native) — gated by FeatureGate (TIER-04)
                ToolbarItem(placement: .primaryAction) {
                    Menu {
                        Button {
                            if FeatureGate.isAllowed(.fileImport, for: subscriptionManager.currentTier) {
                                NotificationCenter.default.post(name: .importFile, object: nil)
                            } else {
                                showingPaywall = true
                            }
                        } label: {
                            Label("Import File...", systemImage: "doc")
                        }

                        Button {
                            showingImportSourcePicker = true
                        } label: {
                            Label("Import from...", systemImage: "arrow.down.app")
                        }
                    } label: {
                        Image(systemName: "square.and.arrow.down")
                    }
                }

                // MARK: Settings Button (always visible — TIER-03)
                ToolbarItem(placement: .secondaryAction) {
                    Button {
                        showingSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                }

                // MARK: View Picker Button (iPhone compact only — CHRM-02)
                #if os(iOS)
                if sizeClass == .compact {
                    ToolbarItem(placement: .bottomBar) {
                        Button { showingViewPicker = true } label: {
                            Label("Views", systemImage: "rectangle.3.group")
                        }
                    }
                }
                #endif
            }
        }
        // MARK: Theme Sync
        .preferredColorScheme(preferredScheme)
        .onChange(of: theme) { _, newTheme in
            let js = "window.__isometry?.themeProvider?.setTheme('\(newTheme)')"
            Task { try? await bridgeManager.webView?.evaluateJavaScript(js) }
        }
        // MARK: iPhone View Picker Sheet
        .sheet(isPresented: $showingViewPicker) {
            NavigationStack {
                List {
                    ForEach(isometryViews) { view in
                        Button {
                            selectedViewID = view.id
                            showingViewPicker = false
                        } label: {
                            Label(view.displayName, systemImage: view.systemImage)
                        }
                        .foregroundStyle(.primary)
                    }
                }
                .navigationTitle("Views")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showingViewPicker = false }
                    }
                }
            }
        }
        // MARK: Lifecycle
        .onAppear {
            // LNCH-02: setupWebViewIfNeeded() was called from IsometryApp.task{} before
            // ContentView.onAppear fires. The guard in setupWebViewIfNeeded() prevents
            // double-initialization when webView is already set.
            // Fallback: call here in case .task{} did not fire first (e.g. cold start race).
            let savedTheme = UserDefaults.standard.string(forKey: "theme") ?? "dark"
            bridgeManager.setupWebViewIfNeeded(savedTheme: savedTheme)
            bridgeManager.importCoordinator = importCoordinator
        }
        // MARK: View Switch
        .onChange(of: selectedViewID) { _, newViewID in
            if let newViewID {
                switchView(to: newViewID)
            }
        }
        // MARK: Undo / Redo Notification Handlers
        .onReceive(NotificationCenter.default.publisher(for: .undoAction)) { _ in
            Task {
                try? await bridgeManager.webView?.evaluateJavaScript(
                    "window.__isometry?.mutationManager?.undo()"
                )
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .redoAction)) { _ in
            Task {
                try? await bridgeManager.webView?.evaluateJavaScript(
                    "window.__isometry?.mutationManager?.redo()"
                )
            }
        }
        // MARK: View Switch Notification Handlers (KEYS-02)
        .modifier(ViewSwitchReceiver(selectedViewID: $selectedViewID))
        // MARK: File Import (FILE-01, FILE-02)
        .onReceive(NotificationCenter.default.publisher(for: .importFile)) { _ in
            #if os(macOS)
            showOpenPanel()
            #else
            showingImporter = true
            #endif
        }
        #if os(iOS)
        .fileImporter(
            isPresented: $showingImporter,
            allowedContentTypes: [.json, .plainText, .commaSeparatedText, .xlsx],
            allowsMultipleSelection: false
        ) { result in
            handleFileImportResult(result)
        }
        #endif
        .alert("File Too Large", isPresented: $showingFileTooLargeAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text("Please select a file smaller than 50 MB.")
        }
        // MARK: Settings Sheet (TIER-03)
        .sheet(isPresented: $showingSettings) {
            SettingsView(subscriptionManager: subscriptionManager)
        }
        // MARK: Paywall Sheet (TIER-04)
        .sheet(isPresented: $showingPaywall) {
            PaywallView(subscriptionManager: subscriptionManager)
        }
        // MARK: Import Source Picker Sheet (FNDX-01)
        .sheet(isPresented: $showingImportSourcePicker) {
            ImportSourcePickerView { sourceType in
                Task {
                    await runNativeImport(sourceType: sourceType)
                }
            }
        }
        // MARK: Permission Sheet (Phase 34+35)
        .sheet(isPresented: $showingPermissionSheet) {
            if let sourceType = pendingImportSourceType {
                PermissionSheetView(
                    sourceType: sourceType,
                    permissionState: pendingPermissionState,
                    onGranted: {
                        // Only shown for .notDetermined — retry triggers system dialog
                        Task {
                            await runNativeImport(sourceType: sourceType)
                        }
                    },
                    onOpenSettings: {
                        // Open System Settings to the relevant Privacy pane
                        let pm = PermissionManager()
                        pm.openSystemSettings(for: sourceType)
                    }
                )
            }
        }
        // MARK: Tier Change → Re-send LaunchPayload (TIER-03)
        // When the user subscribes, re-send the full LaunchPayload with the new tier
        // so the web runtime activates features without requiring an app restart.
        .onChange(of: subscriptionManager.currentTier) { _, newTier in
            Task {
                await bridgeManager.sendLaunchPayload()
            }
        }
    }

    // MARK: - Native Import

    /// Runs a native import with the appropriate adapter for the given source type.
    /// Checks permission first and shows PermissionSheetView if needed.
    private func runNativeImport(sourceType: String) async {
        // Wire coordinator to webView
        importCoordinator.webView = bridgeManager.webView

        // Select adapter based on sourceType
        let adapter: any NativeImportAdapter
        switch sourceType {
        case "native_reminders":
            adapter = RemindersAdapter()
        case "native_calendar":
            adapter = CalendarAdapter()
        case "native_notes":
            adapter = NotesAdapter()
        #if DEBUG
        case "mock":
            adapter = MockAdapter()
        case "mock_large":
            adapter = LargeMockAdapter()
        #endif
        default:
            print("[NativeImport] Unknown source type: \(sourceType)")
            return
        }

        // Check permission before running import
        let permission = adapter.checkPermission()
        switch permission {
        case .granted:
            break  // Proceed with import
        case .notDetermined:
            // Request permission (shows system dialog for EventKit, or opens Settings for Notes)
            let result = await adapter.requestPermission()
            guard result == .granted else {
                print("[NativeImport] Permission not granted for \(sourceType)")
                // Re-check actual state after request (may now be .denied)
                let currentState = adapter.checkPermission()
                pendingImportSourceType = sourceType
                pendingPermissionState = currentState
                showingPermissionSheet = true
                return
            }
        case .denied, .restricted:
            // Show permission sheet — only "Open Settings" (system dialog won't re-fire)
            pendingImportSourceType = sourceType
            pendingPermissionState = permission
            showingPermissionSheet = true
            return
        }

        do {
            try await importCoordinator.runImport(adapter: adapter)
            print("[NativeImport] Import complete for \(sourceType)")
        } catch {
            print("[NativeImport] Import failed: \(error)")
        }
    }

    // MARK: - View Switching

    /// Instructs the web runtime to switch to the given view type.
    private func switchView(to viewID: String) {
        let js = "window.__isometry?.viewManager?.switchTo('\(viewID)', window.__isometry?.viewFactory?.['\(viewID)'])"
        Task {
            try? await bridgeManager.webView?.evaluateJavaScript(js)
        }
    }

    // MARK: - File Import (FILE-01 through FILE-04)

    #if os(macOS)
    private func showOpenPanel() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.json, .plainText, .commaSeparatedText, .xlsx]
        panel.allowsMultipleSelection = false
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.prompt = "Import"

        guard panel.runModal() == .OK, let url = panel.url else { return }
        processImportedFile(url: url, needsSecurityScope: false)
    }
    #endif

    private func handleFileImportResult(_ result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            print("[FileImport] Picker error: \(error.localizedDescription)")
        case .success(let urls):
            guard let url = urls.first else { return }
            processImportedFile(url: url, needsSecurityScope: true)
        }
    }

    private func processImportedFile(url: URL, needsSecurityScope: Bool) {
        // Security scope (iOS sandboxed file access)
        if needsSecurityScope {
            guard url.startAccessingSecurityScopedResource() else {
                print("[FileImport] Access denied to: \(url)")
                return
            }
        }
        defer {
            if needsSecurityScope {
                url.stopAccessingSecurityScopedResource()
            }
        }

        // Size check (FILE-04): 50MB cap
        let resourceValues = try? url.resourceValues(forKeys: [.fileSizeKey])
        let fileSize = resourceValues?.fileSize ?? 0
        let maxBytes = 50 * 1024 * 1024
        guard fileSize <= maxBytes else {
            showingFileTooLargeAlert = true
            return
        }

        // Read file bytes
        guard let data = try? Data(contentsOf: url) else {
            print("[FileImport] Failed to read file: \(url.lastPathComponent)")
            return
        }

        // Determine ETL source type from extension
        let ext = url.pathExtension.lowercased()
        let source = etlSource(for: ext)
        let filename = url.lastPathComponent

        // For text formats: decode to UTF-8 string
        // For binary (xlsx): base64 encode
        // CRITICAL: ETL parsers expect UTF-8 text for json/csv/markdown,
        // but base64 for xlsx (Pitfall 5 from RESEARCH.md)
        if ext == "xlsx" {
            let base64 = data.base64EncodedString()
            bridgeManager.sendFileImport(data: base64, source: source, filename: filename)
        } else {
            guard let text = String(data: data, encoding: .utf8) else {
                print("[FileImport] File is not valid UTF-8: \(filename)")
                return
            }
            bridgeManager.sendFileImport(data: text, source: source, filename: filename)
        }
    }

    private func etlSource(for ext: String) -> String {
        switch ext {
        case "json":       return "json"
        case "md", "txt":  return "markdown"
        case "csv":        return "csv"
        case "xlsx":       return "excel"
        default:           return "json"
        }
    }

    // MARK: - Recovery Overlay

    private var recoveryOverlay: some View {
        ZStack {
            Color.black.opacity(0.5)
                .ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .scaleEffect(1.5)
                Text("Restoring...")
                    .font(.headline)
                    .foregroundColor(.white)
                Text("Your data is safe")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.7))
            }
            .padding(40)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        }
    }

}

// ---------------------------------------------------------------------------
// ViewSwitchReceiver — View menu notification handler (KEYS-02)
// ---------------------------------------------------------------------------
// Extracted from ContentView.body to keep the expression type-checkable.
// Menu bar Cmd+1-9 posts notifications; setting selectedViewID triggers
// onChange(of: selectedViewID) which calls switchView(to:) — keeping sidebar in sync.

private struct ViewSwitchReceiver: ViewModifier {
    @Binding var selectedViewID: String?

    func body(content: Content) -> some View {
        content
            .onReceive(NotificationCenter.default.publisher(for: .switchToList)) { _ in
                selectedViewID = "list"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToGrid)) { _ in
                selectedViewID = "grid"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToKanban)) { _ in
                selectedViewID = "kanban"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToCalendar)) { _ in
                selectedViewID = "calendar"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToTimeline)) { _ in
                selectedViewID = "timeline"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToGallery)) { _ in
                selectedViewID = "gallery"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToNetwork)) { _ in
                selectedViewID = "network"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToTree)) { _ in
                selectedViewID = "tree"
            }
            .onReceive(NotificationCenter.default.publisher(for: .switchToSupergrid)) { _ in
                selectedViewID = "supergrid"
            }
    }
}

#if DEBUG
/// Receives JS console messages and prints them to Xcode console
class ConsoleLogHandler: NSObject, WKScriptMessageHandler {
    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        if let body = message.body as? String {
            print("[JS] \(body)")
        }
    }
}
#endif
